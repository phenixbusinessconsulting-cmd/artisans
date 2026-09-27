// Contrôle croisé des fiches sur les annuaires tiers (voir lib/verification/sources.ts).
// Usage : npm run verify [-- --limite=100]
// Les fiches jamais vérifiées passent en premier ; seuls des statuts sont enregistrés.

import { fermer, sql } from "../lib/db"
import { enregistrerVerifications, fichesAVerifier } from "../lib/stockage"
import { Verificateur } from "../lib/verification"

async function main() {
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9) ?? 100)
  const db = sql()
  const fiches = await fichesAVerifier(db, limite)
  const verificateur = new Verificateur()
  const bilan: Record<string, Record<string, number>> = {}

  for (const e of fiches) {
    try {
      const resultats = await verificateur.verifier(e)
      await enregistrerVerifications(db, e.siret, resultats)
      for (const [source, v] of Object.entries(resultats)) {
        bilan[source] ??= {}
        bilan[source][v.statut] = (bilan[source][v.statut] ?? 0) + 1
      }
    } catch (err) {
      console.error(`${e.siret} (${e.raison_sociale}) :`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`Terminé : ${fiches.length} fiches vérifiées`)
  console.table(bilan)
  await fermer()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
