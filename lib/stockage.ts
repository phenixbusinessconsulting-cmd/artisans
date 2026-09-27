// Écritures en base : import des registres, enrichissement, retrait.

import type postgres from "postgres"
import type { Enrichissement } from "./enrich"
import type { Entreprise, EntrepriseSirene } from "./types"

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
    where not masque
    order by enrichi_le asc nulls first
    limit ${limite}`
}

export async function enregistrerEnrichissement(
  db: postgres.Sql,
  e: FicheAEnrichir,
  { sources, ...champs }: Enrichissement
) {
  // Conserver le téléphone précédent si aucune source n'en fournit un nouveau.
  const tel = champs.telephone ? champs : e
  await db`
    update entreprises set
      telephone = ${tel.telephone},
      telephone_type = ${tel.telephone_type},
      telephone_source = ${tel.telephone_source},
      telephone_confiance = ${tel.telephone_confiance},
      site_web = ${champs.site_web},
      specialites = ${champs.specialites}::text[],
      sources = ${db.json({ ...e.sources, ...sources, enrichi: new Date().toISOString() } as never)},
      enrichi_le = now()
    where siret = ${e.siret}`
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
