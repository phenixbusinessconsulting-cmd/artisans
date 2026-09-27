// Clients Supabase côté serveur uniquement. Les variables sont lues à l'exécution (pas au build),
// ce qui permet de construire l'image Docker sans secrets.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function variable(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return valeur
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }

/** Lecture publique, soumise aux règles RLS (fiches non masquées uniquement). */
export function clientPublic(): SupabaseClient {
  return createClient(variable("SUPABASE_URL"), variable("SUPABASE_ANON_KEY"), options)
}

/** Accès complet (ingestion, enrichissement, retrait). Ne jamais exposer au navigateur. */
export function clientAdmin(): SupabaseClient {
  return createClient(variable("SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), options)
}
