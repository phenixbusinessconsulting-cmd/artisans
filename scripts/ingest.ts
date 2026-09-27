// Import des artisans du bâtiment du département depuis l'API Recherche d'entreprises.
// Usage : npm run ingest [-- --naf=43.22A]
// Les champs d'enrichissement (téléphone, spécialités…) et le masquage ne sont jamais écrasés.

import { CODES_NAF_BTP } from "../lib/btp"
import {
  PAR_PAGE,
  RESULTATS_MAX,
  rechercher,
  versEntreprises,
  type Recherche,
} from "../lib/sources/recherche-entreprises"
import { clientAdmin } from "../lib/supabase/clients"
import type { EntrepriseSirene } from "../lib/types"

const DEPARTEMENT = process.env.DEPARTEMENT ?? "91"
// 7 requêtes/s autorisées : on reste en dessous.
const PAUSE_MS = 180

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function toutesLesPages(base: Omit<Recherche, "page">): Promise<{
  fiches: EntrepriseSirene[]
  total: number
}> {
  const fiches: EntrepriseSirene[] = []
  let page = 1
  let totalPages = 1
  let total = 0
  do {
    const res = await rechercher({ ...base, page })
    total = res.total_results
    totalPages = Math.min(res.total_pages, Math.floor(RESULTATS_MAX / PAR_PAGE))
    for (const r of res.results) fiches.push(...versEntreprises(r, DEPARTEMENT))
    page++
    await pause(PAUSE_MS)
  } while (page <= totalPages)
  return { fiches, total }
}

async function codesPostauxDuDepartement(naf: string): Promise<string[]> {
  // Découpage par code postal quand une activité dépasse la limite de 10 000 résultats.
  const res = await fetch(
    `https://geo.api.gouv.fr/departements/${DEPARTEMENT}/communes?fields=codesPostaux`
  )
  if (!res.ok) throw new Error(`geo.api.gouv.fr : HTTP ${res.status} (${naf})`)
  const communes = (await res.json()) as { codesPostaux: string[] }[]
  return [...new Set(communes.flatMap((c) => c.codesPostaux))].sort()
}

async function main() {
  const filtre = process.argv.find((a) => a.startsWith("--naf="))?.slice(6)
  const codes = filtre ? [filtre] : CODES_NAF_BTP
  const db = clientAdmin()
  let totalFiches = 0

  for (const naf of codes) {
    const premier = await toutesLesPages({ departement: DEPARTEMENT, naf })
    let fiches = premier.fiches
    if (premier.total > RESULTATS_MAX) {
      console.log(`${naf} : ${premier.total} résultats, découpage par code postal`)
      fiches = []
      for (const codePostal of await codesPostauxDuDepartement(naf)) {
        fiches.push(...(await toutesLesPages({ departement: DEPARTEMENT, naf, codePostal })).fiches)
      }
    }

    const uniques = [...new Map(fiches.map((f) => [f.siret, f])).values()]
    const maintenant = new Date().toISOString()
    for (let i = 0; i < uniques.length; i += 500) {
      const lot = uniques.slice(i, i + 500).map((f) => ({ ...f, sirene_maj_le: maintenant }))
      const { error } = await db.from("entreprises").upsert(lot, { onConflict: "siret" })
      if (error) throw new Error(`Supabase (${naf}) : ${error.message}`)
    }
    totalFiches += uniques.length
    console.log(`${naf} : ${uniques.length} établissements importés`)
  }
  console.log(`Terminé : ${totalFiches} établissements`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
