import type { Metadata } from "next"
import { connection } from "next/server"
import { adminConfigure } from "@/lib/admin"
import { FormulaireConnexion } from "./formulaire"

export const metadata: Metadata = {
  title: "Connexion administrateur",
  robots: { index: false, follow: false },
}

export default async function Connexion() {
  // ADMIN_PASSWORD est lu à l'exécution, jamais au build.
  await connection()
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Mode administrateur</h1>
      <p className="mt-2 text-stone-600">Suivi de prospection : contacté, commentaires.</p>
      <div className="mt-6">
        {adminConfigure() ? (
          <FormulaireConnexion />
        ) : (
          <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Le mode administrateur n&apos;est pas configuré (ADMIN_PASSWORD absent sur le serveur).
          </p>
        )}
      </div>
    </div>
  )
}
