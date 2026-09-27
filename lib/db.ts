// Connexion PostgreSQL (base dédiée à l'annuaire, conteneur `db`).
// Créée à la première requête : le build Next.js n'a pas besoin de DATABASE_URL.

import postgres from "postgres"

let client: postgres.Sql | undefined

export function sql(): postgres.Sql {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("Variable d'environnement manquante : DATABASE_URL")
    client = postgres(url, { max: 5, idle_timeout: 30 })
  }
  return client
}

export async function fermer() {
  await client?.end()
  client = undefined
}
