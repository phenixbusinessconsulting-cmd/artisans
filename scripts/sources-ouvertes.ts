// Complète les fiches avec les sources ouvertes gratuites, après l'import SIRENE :
//  - ADEME RGE : téléphone, e-mail, site, domaines de travaux, organismes de qualification ;
//  - OpenStreetMap : téléphone et site des artisans cartographiés ;
//  - BODACC : entreprises en liquidation judiciaire, retirées de l'annuaire.
// Usage : npm run sources [-- --seulement=ademe,osm,bodacc]
// Une source en échec n'empêche pas les autres de tourner.

import { fermer, sql } from "../lib/db"
import { lireRge, regrouperParSiret } from "../lib/sources/ademe-rge"
import { liquidations, lireBodacc } from "../lib/sources/bodacc"
import { lireOsm, rapprocher } from "../lib/sources/osm"
import {
  completementRge,
  completerFiche,
  enregistrerLiquidations,
  fichesPourRapprochement,
} from "../lib/stockage"

const DEPARTEMENT = process.env.DEPARTEMENT ?? "91"
// Procédures collectives prises en compte : les 3 dernières années.
const BODACC_ANNEES = 3

type Etape = () => Promise<string>

async function main() {
  const seulement = process.argv
    .find((a) => a.startsWith("--seulement="))
    ?.slice(12)
    .split(",")
  const db = sql()

  const etapes: Record<string, Etape> = {
    ademe: async () => {
      const fiches = regrouperParSiret(await lireRge(DEPARTEMENT))
      let completees = 0
      for (const f of fiches) if (await completerFiche(db, completementRge(f))) completees++
      return `${fiches.length} entreprises RGE, ${completees} fiches complétées`
    },
    osm: async () => {
      const lieux = await lireOsm(DEPARTEMENT)
      const fiches = await fichesPourRapprochement(db)
      let completees = 0
      for (const lieu of lieux) {
        const siret = rapprocher(lieu, fiches)
        if (!siret) continue
        const ok = await completerFiche(db, {
          siret,
          source: "osm",
          telephone: lieu.telephone,
          site_web: lieu.site_web,
          trace: { nom: lieu.nom },
        })
        if (ok) completees++
      }
      return `${lieux.length} lieux OSM, ${completees} fiches complétées`
    },
    bodacc: async () => {
      const depuis = new Date()
      depuis.setFullYear(depuis.getFullYear() - BODACC_ANNEES)
      const annonces = await lireBodacc(DEPARTEMENT, depuis.toISOString().slice(0, 10))
      const n = await enregistrerLiquidations(db, liquidations(annonces))
      return `${annonces.length} annonces, ${n} fiches en liquidation retirées`
    },
  }

  let echecs = 0
  for (const [nom, etape] of Object.entries(etapes)) {
    if (seulement && !seulement.includes(nom)) continue
    try {
      console.log(`${nom} : ${await etape()}`)
    } catch (err) {
      echecs++
      console.error(`${nom} : échec —`, err instanceof Error ? err.message : err)
    }
  }
  await fermer()
  if (echecs) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
