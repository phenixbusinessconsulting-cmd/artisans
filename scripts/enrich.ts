// Enrichissement des fiches (téléphone, site web, spécialités), les plus anciennes d'abord.
// Usage : npm run enrich [-- --limite=500]
// Google Places est utilisé si GOOGLE_PLACES_API_KEY est défini (API payante).

import { enrichir } from "../lib/enrich"
import { clientAdmin } from "../lib/supabase/clients"
import type { Entreprise } from "../lib/types"

const PAUSE_MS = 250
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9) ?? 200)
  const cleGoogle = process.env.GOOGLE_PLACES_API_KEY
  if (!cleGoogle)
    console.warn("GOOGLE_PLACES_API_KEY absent : seuls les sites web connus seront lus.")

  const db = clientAdmin()
  const { data, error } = await db
    .from("entreprises")
    .select("*")
    .eq("masque", false)
    .order("enrichi_le", { ascending: true, nullsFirst: true })
    .limit(limite)
  if (error) throw new Error(`Supabase : ${error.message}`)

  let avecTelephone = 0
  for (const e of (data ?? []) as (Entreprise & { sources: Record<string, unknown> })[]) {
    try {
      const { sources, ...champs } = await enrichir(e, { cleGoogle })
      if (champs.telephone) avecTelephone++
      const { error: err } = await db
        .from("entreprises")
        .update({
          ...champs,
          // Conserver le téléphone précédent si aucune source n'en fournit un nouveau.
          ...(champs.telephone
            ? {}
            : {
                telephone: e.telephone,
                telephone_type: e.telephone_type,
                telephone_source: e.telephone_source,
                telephone_confiance: e.telephone_confiance,
              }),
          sources: { ...e.sources, ...sources, enrichi: new Date().toISOString() },
          enrichi_le: new Date().toISOString(),
        })
        .eq("siret", e.siret)
      if (err) throw new Error(err.message)
    } catch (err) {
      console.error(`${e.siret} (${e.raison_sociale}) :`, err instanceof Error ? err.message : err)
    }
    await pause(PAUSE_MS)
  }
  console.log(`Terminé : ${data?.length ?? 0} fiches traitées, ${avecTelephone} avec téléphone`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
