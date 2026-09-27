// Écritures en base : import des registres, enrichissement, retrait.

import type postgres from "postgres"
import type { Enrichissement } from "./enrich"
import { candidat, candidatsExistants, choisirTelephone, type TelephoneCandidat } from "./phone"
import type { FicheRge } from "./sources/ademe-rge"
import type { Entreprise, EntrepriseSirene } from "./types"
import type { Verification } from "./verification"

const COLONNES_SIRENE = [
  "siret",
  "siren",
  "raison_sociale",
  "enseigne",
  "naf",
  "metier",
  "labels",
  "dirigeant_nom",
  "dirigeant_qualite",
  "adresse",
  "code_postal",
  "ville",
  "latitude",
  "longitude",
  "date_creation",
] as const satisfies readonly (keyof EntrepriseSirene)[]

/**
 * Insère ou met à jour les fiches issues des registres. Seuls les champs des registres sont
 * modifiés : l'enrichissement (téléphone, spécialités…) et le masquage sont conservés.
 */
export async function enregistrerFichesSirene(db: postgres.Sql, fiches: EntrepriseSirene[]) {
  for (let i = 0; i < fiches.length; i += 500) {
    const lot = fiches.slice(i, i + 500)
    await db`
      insert into entreprises (${db(COLONNES_SIRENE)}, sirene_maj_le)
      select ${db(COLONNES_SIRENE)}, now()
      from jsonb_populate_recordset(null::entreprises, ${db.json(lot as never)})
      on conflict (siret) do update set
        ${db.unsafe(COLONNES_SIRENE.map((c) => `${c} = excluded.${c}`).join(", "))},
        sirene_maj_le = excluded.sirene_maj_le`
  }
}

export type FicheAEnrichir = Entreprise & { sources: Record<string, unknown> }

export async function fichesAEnrichir(db: postgres.Sql, limite: number) {
  return db<FicheAEnrichir[]>`
    select *, date_creation::text as date_creation from entreprises
    where not masque and liquidation_le is null
    -- D'abord les fiches dont on connaît le site mais pas encore le téléphone.
    order by (site_web is not null and telephone is null) desc, enrichi_le asc nulls first
    limit ${limite}`
}

export async function enregistrerEnrichissement(
  db: postgres.Sql,
  e: FicheAEnrichir,
  { sources, ...champs }: Enrichissement
) {
  // Google et le site sont recalculés à chaque enrichissement ; les numéros venant des autres
  // sources (ADEME, OSM…) sont conservés et mis en concurrence avec les nouveaux.
  const tel = choisirTelephone([
    ...candidatsExistants(e.telephone, e.telephone_source, ["google", "site"]),
    ...candidatsExistants(champs.telephone, champs.telephone_source),
  ]) ?? {
    numero: e.telephone,
    type: e.telephone_type,
    source: e.telephone_source,
    confiance: e.telephone_confiance,
  }
  await db`
    update entreprises set
      telephone = ${tel.numero},
      telephone_type = ${tel.type},
      telephone_source = ${tel.source},
      telephone_confiance = ${tel.confiance},
      site_web = ${champs.site_web},
      specialites = (select array(select distinct unnest(specialites || ${champs.specialites}::text[]) order by 1)),
      sources = ${db.json({ ...e.sources, ...sources, enrichi: new Date().toISOString() } as never)},
      enrichi_le = now()
    where siret = ${e.siret}`
}

interface CompletementSource {
  siret: string
  source: string // identifiant court : "ademe", "osm"
  telephone: string | null
  site_web?: string | null
  email?: string | null
  specialites?: string[]
  labels?: string[]
  trace: Record<string, unknown>
}

/**
 * Complète une fiche avec une source ouverte : le téléphone est mis en concurrence avec
 * l'existant (un portable l'emporte, puis le nombre de sources qui concordent), les
 * spécialités et labels sont ajoutés, le site et l'e-mail ne remplacent jamais une valeur.
 */
export async function completerFiche(db: postgres.Sql, c: CompletementSource) {
  const [e] = await db<
    Pick<Entreprise, "telephone" | "telephone_source" | "telephone_type" | "telephone_confiance">[]
  >`select telephone, telephone_source, telephone_type, telephone_confiance
    from entreprises where siret = ${c.siret}`
  if (!e) return false
  const candidats: (TelephoneCandidat | null)[] = [
    ...candidatsExistants(e.telephone, e.telephone_source, [c.source]),
    candidat(c.telephone, c.source),
  ]
  const tel = choisirTelephone(candidats)
  await db`
    update entreprises set
      telephone = ${tel?.numero ?? e.telephone},
      telephone_type = ${tel?.type ?? e.telephone_type},
      telephone_source = ${tel?.source ?? e.telephone_source},
      telephone_confiance = ${tel?.confiance ?? e.telephone_confiance},
      site_web = coalesce(site_web, ${c.site_web ?? null}),
      email = coalesce(email, ${c.email ?? null}),
      specialites = (select array(select distinct unnest(specialites || ${c.specialites ?? []}::text[]) order by 1)),
      labels = (select array(select distinct unnest(labels || ${c.labels ?? []}::text[]) order by 1)),
      sources = sources || ${db.json({ [c.source]: { ...c.trace, maj: new Date().toISOString() } } as never)}
    where siret = ${c.siret}`
  return true
}

export function completementRge(f: FicheRge): CompletementSource {
  return {
    siret: f.siret,
    source: "ademe",
    telephone: f.telephone,
    site_web: f.site_web,
    email: f.email,
    specialites: f.specialites,
    labels: f.labels,
    trace: { qualifications: f.qualifications },
  }
}

/** Marque les entreprises en liquidation (par SIREN) ; les autres sont démarquées. */
export async function enregistrerLiquidations(db: postgres.Sql, parSiren: Map<string, string>) {
  const lignes = [...parSiren.entries()].map(([siren, date]) => ({ siren, date }))
  await db.begin(async (tx) => {
    await tx`update entreprises set liquidation_le = null where liquidation_le is not null`
    if (lignes.length) {
      await tx`
        update entreprises e set liquidation_le = l.date::date
        from jsonb_to_recordset(${tx.json(lignes as never)}) as l(siren text, date text)
        where e.siren = l.siren`
    }
  })
  const [ligne] = await db<{ n: number }[]>`
    select count(*)::int as n from entreprises where liquidation_le is not null`
  return ligne?.n ?? 0
}

export async function fichesPourRapprochement(db: postgres.Sql) {
  return db<
    Pick<Entreprise, "siret" | "raison_sociale" | "enseigne" | "latitude" | "longitude">[]
  >`select siret, raison_sociale, enseigne, latitude, longitude from entreprises where not masque`
}

/** Droit d'opposition : enregistre la demande et masque la fiche, dans une même transaction. */
export async function masquerFiche(
  db: postgres.Sql,
  demande: { siret: string; email: string; motif?: string }
) {
  await db.begin(async (tx) => {
    await tx`
      insert into demandes_retrait (siret, email, motif)
      values (${demande.siret}, ${demande.email}, ${demande.motif ?? null})`
    await tx`update entreprises set masque = true where siret = ${demande.siret}`
  })
}

export async function fichesAVerifier(db: postgres.Sql, limite: number) {
  return db<Entreprise[]>`
    select *, date_creation::text as date_creation from entreprises
    where not masque and liquidation_le is null
    order by verifie_le asc nulls first
    limit ${limite}`
}

export async function enregistrerVerifications(
  db: postgres.Sql,
  siret: string,
  resultats: Record<string, Verification>
) {
  await db`
    update entreprises set
      verifications = verifications || ${db.json(resultats as never)},
      verifie_le = now()
    where siret = ${siret}`
}
