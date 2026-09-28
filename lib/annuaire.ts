// Requêtes de lecture de l'annuaire public. Les fiches masquées (opposition) ne sont jamais renvoyées.

import { sql } from "./db"
import type { Entreprise } from "./types"

export const PAR_PAGE = 24

export interface Filtres {
  /** Code du département (préfixe du code postal) : chaque page n'affiche que le sien. */
  departement?: string
  q?: string
  metier?: string
  ville?: string
  specialite?: string
  /** « oui » : un téléphone est renseigné ; « mobile » : un portable est renseigné. */
  telephone?: "oui" | "mobile"
  /** « oui » : un site web est renseigné ; « non » : aucun site connu. */
  site?: "oui" | "non"
  /** Réservé à l'administrateur : « a_contacter » ou « contacte ». */
  suivi?: "a_contacter" | "contacte"
  page?: number
}

/** Normalise une saisie de recherche : espaces, longueur, et jokers LIKE (`%`, `_`, `\`) neutralisés. */
export function nettoyerRecherche(texte: string | undefined): string {
  return (texte ?? "")
    .replace(/[\\%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function colonnes(db: ReturnType<typeof sql>) {
  return db`siret, siren, raison_sociale, enseigne, naf, metier, specialites, labels,
    dirigeant_nom, dirigeant_qualite, adresse, code_postal, ville, latitude, longitude,
    telephone, telephone_type, telephone_source, telephone_confiance, site_web,
    date_creation::text as date_creation`
}

export async function rechercherEntreprises(filtres: Filtres, options: { admin?: boolean } = {}) {
  const db = sql()
  const page = Math.max(1, filtres.page ?? 1)
  const q = nettoyerRecherche(filtres.q)
  const ville = nettoyerRecherche(filtres.ville)

  const conditions = [db`not masque and liquidation_le is null`]
  if (q) {
    const motif = `%${q}%`
    conditions.push(
      db`(unaccent(raison_sociale) ilike unaccent(${motif})
        or unaccent(enseigne) ilike unaccent(${motif})
        or unaccent(dirigeant_nom) ilike unaccent(${motif}))`
    )
  }
  if (filtres.departement && /^\d{2}$/.test(filtres.departement))
    conditions.push(db`code_postal like ${filtres.departement + "%"}`)
  if (filtres.metier) conditions.push(db`metier = ${filtres.metier}`)
  if (filtres.specialite) conditions.push(db`${filtres.specialite} = any(specialites)`)
  if (options.admin && filtres.suivi === "contacte")
    conditions.push(db`coalesce(s.contacte, false)`)
  if (options.admin && filtres.suivi === "a_contacter")
    conditions.push(db`not coalesce(s.contacte, false)`)
  if (filtres.telephone === "oui") conditions.push(db`telephone is not null`)
  // Portable : numéros en 06 ou 07 (voir typeTelephone dans lib/phone.ts).
  if (filtres.telephone === "mobile") conditions.push(db`telephone_type = 'mobile'`)
  if (filtres.site === "oui") conditions.push(db`site_web is not null`)
  if (filtres.site === "non") conditions.push(db`site_web is null`)
  if (ville) {
    conditions.push(
      /^\d{2,5}$/.test(ville)
        ? db`code_postal like ${ville + "%"}`
        : db`unaccent(ville) ilike unaccent(${`%${ville}%`})`
    )
  }
  const where = conditions.reduce((acc, c) => db`${acc} and ${c}`)

  // Le suivi de prospection n'est joint (et donc lisible) qu'en mode administrateur.
  const lignes = await db<(Entreprise & { total: number })[]>`
    select ${colonnes(db)}, count(*) over ()::int as total
      ${options.admin ? db`, coalesce(s.contacte, false) as contacte` : db``}
    from entreprises
      ${options.admin ? db`left join suivi_prospection s using (siret)` : db``}
    where ${where}
    order by raison_sociale
    limit ${PAR_PAGE} offset ${(page - 1) * PAR_PAGE}`

  const total = lignes[0]?.total ?? 0
  const entreprises: Entreprise[] = lignes
  return { entreprises, total, page }
}

export async function lireEntreprise(siret: string): Promise<Entreprise | null> {
  if (!/^\d{14}$/.test(siret)) return null
  const db = sql()
  const [e] = await db<Entreprise[]>`
    select ${colonnes(db)} from entreprises
    where siret = ${siret} and not masque and liquidation_le is null`
  return e ?? null
}
