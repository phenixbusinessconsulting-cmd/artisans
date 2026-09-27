"use client"

import { useActionState } from "react"
import { seConnecter, type EtatConnexion } from "./actions"

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(seConnecter, {})
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-stone-200 bg-white p-6">
      <label className="grid gap-1">
        <span className="text-sm font-medium">Mot de passe</span>
        <input
          name="motDePasse"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-stone-300 px-3 py-2"
        />
      </label>
      {etat.erreur && <p className="text-sm text-red-700">{etat.erreur}</p>}
      <button
        disabled={enCours}
        className="bg-marque hover:bg-marque-fonce rounded px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  )
}
