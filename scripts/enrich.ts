// Enrichissement des fiches (téléphone, site web, spécialités), les plus anciennes d'abord.
// Usage : npm run enrich [-- --limite=500]
// Google Places est utilisé si GOOGLE_PLACES_API_KEY est défini (API payante). Sans site connu,
// le site est cherché par nom de domaine et retenu seulement s'il affiche le SIREN.

import { enrichir } from "../lib/enrich"
import { fermer, sql } from "../lib/db"
import { enregistrerEnrichissement, fichesAEnrichir } from "../lib/stockage"

// Fiches traitées en parallèle : chacune interroge des sites différents.
const PARALLELE = 4

async function main() {
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9) ?? 200)
  const cleGoogle = process.env.GOOGLE_PLACES_API_KEY
  if (!cleGoogle)
    console.warn("GOOGLE_PLACES_API_KEY absent : sites connus et découverte par nom de domaine.")

  const db = sql()
  const data = await fichesAEnrichir(db, limite)

  let avecTelephone = 0
  let sitesDecouverts = 0
  let traitees = 0
  const file = [...data]
  async function travailleur() {
    for (let e = file.shift(); e; e = file.shift()) {
      try {
        const enrichissement = await enrichir(e, { cleGoogle })
        if (enrichissement.telephone) avecTelephone++
        if (!e.site_web && enrichissement.site_web) sitesDecouverts++
        await enregistrerEnrichissement(db, e, enrichissement)
      } catch (err) {
        console.error(
          `${e.siret} (${e.raison_sociale}) :`,
          err instanceof Error ? err.message : err
        )
      }
      if (++traitees % 500 === 0) console.log(`${traitees}/${data.length}…`)
    }
  }
  await Promise.all(Array.from({ length: PARALLELE }, travailleur))
  console.log(
    `Terminé : ${data.length} fiches traitées, ${avecTelephone} avec téléphone, ${sitesDecouverts} sites découverts`
  )
  await fermer()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
