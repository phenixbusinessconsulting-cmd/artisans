// Enrichissement des fiches (téléphone, site web, spécialités), les plus anciennes d'abord.
// Usage : npm run enrich [-- --limite=500]
// Google Places est utilisé si GOOGLE_PLACES_API_KEY est défini (API payante).

import { enrichir } from "../lib/enrich"
import { fermer, sql } from "../lib/db"
import { enregistrerEnrichissement, fichesAEnrichir } from "../lib/stockage"

const PAUSE_MS = 250
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9) ?? 200)
  const cleGoogle = process.env.GOOGLE_PLACES_API_KEY
  if (!cleGoogle)
    console.warn("GOOGLE_PLACES_API_KEY absent : seuls les sites web connus seront lus.")

  const db = sql()
  const data = await fichesAEnrichir(db, limite)

  let avecTelephone = 0
  for (const e of data) {
    try {
      const enrichissement = await enrichir(e, { cleGoogle })
      if (enrichissement.telephone) avecTelephone++
      await enregistrerEnrichissement(db, e, enrichissement)
    } catch (err) {
      console.error(`${e.siret} (${e.raison_sociale}) :`, err instanceof Error ? err.message : err)
    }
    await pause(PAUSE_MS)
  }
  console.log(`Terminé : ${data.length} fiches traitées, ${avecTelephone} avec téléphone`)
  await fermer()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
