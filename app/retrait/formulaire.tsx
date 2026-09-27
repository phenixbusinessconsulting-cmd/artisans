"use client"

import { useActionState } from "react"
import { demanderRetrait, type EtatRetrait } from "./actions"

export function FormulaireRetrait({ siret }: { siret?: string }) {
  const [etat, action, enCours] = useActionState<EtatRetrait, FormData>(demanderRetrait, {
    statut: "initial",
  })

  if (etat.statut === "ok") {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
        Votre demande est enregistrée. La fiche n&apos;est plus affichée dans l&apos;annuaire.
      </p>
    )
  }

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-stone-200 bg-white p-6">
      <label className="grid gap-1">
        <span className="text-sm font-medium">SIRET de l&apos;établissement</span>
        <input
          name="siret"
          required
          defaultValue={siret}
          inputMode="numeric"
          className="rounded border border-stone-300 px-3 py-2 font-mono"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-medium">Votre e-mail</span>
        <input
          name="email"
          type="email"
          required
          className="rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-medium">Motif (facultatif)</span>
        <textarea
          name="motif"
          rows={3}
          maxLength={1000}
          className="rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <input name="site" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {etat.statut === "erreur" && <p className="text-sm text-red-700">{etat.message}</p>}
      <button
        disabled={enCours}
        className="bg-marque hover:bg-marque-fonce rounded px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {enCours ? "Envoi…" : "Retirer ma fiche"}
      </button>
    </form>
  )
}
