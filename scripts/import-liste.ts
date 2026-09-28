// Importe une liste d'entreprises (JSON) : complète les fiches existantes, ajoute les autres.
// Usage : npm run import-liste -- <fichier.json> --source=amiante [--specialite=Désamiantage]
//         [--metier-hors-btp=Désamiantage]
// Le fichier contient un tableau de { siret, telephone?, email?, trace? }.

import { readFile } from "node:fs/promises"
import { fermer, sql } from "../lib/db"
import { importerListe, type LigneListe } from "../lib/sources/liste-entreprises"

const DEPARTEMENT = process.env.DEPARTEMENT ?? "91"

function option(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3)
}

async function main() {
  const fichier = process.argv.slice(2).find((a) => !a.startsWith("--"))
  const source = option("source")
  if (!fichier || !source) throw new Error("usage : import-liste <fichier.json> --source=<id>")
  const lignes = JSON.parse(await readFile(fichier, "utf8")) as LigneListe[]
  const specialite = option("specialite")

  const resultats = await importerListe(sql(), lignes, {
    source,
    departement: DEPARTEMENT,
    specialites: specialite ? [specialite] : [],
    metierHorsBtp: option("metier-hors-btp"),
  })
  for (const r of resultats) {
    const detail =
      r.statut === "ignoree" ? r.raison : r.siretFiche !== r.siret ? `→ ${r.siretFiche}` : ""
    console.log(`${r.siret} ${r.statut} ${detail}`.trim())
  }
  const compte = (s: string) => resultats.filter((r) => r.statut === s).length
  console.log(
    `${lignes.length} lignes : ${compte("completee")} complétées, ${compte("ajoutee")} ajoutées, ${compte("ignoree")} ignorées`
  )
  await fermer()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
