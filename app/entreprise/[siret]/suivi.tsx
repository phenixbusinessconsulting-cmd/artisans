"use client"

import { useState, useTransition } from "react"
import { COMMENTAIRE_MAX, type Suivi } from "@/lib/suivi"
import { basculerContacte, sauverCommentaire } from "./actions"

function date(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : ""
}

export function SuiviProspection({ siret, initial }: { siret: string; initial: Suivi }) {
  const [suivi, setSuivi] = useState(initial)
  const [commentaire, setCommentaire] = useState(initial.commentaire)
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = commentaire.trim() !== suivi.commentaire

  function executer(action: () => Promise<Suivi>) {
    setErreur(null)
    demarrer(async () => {
      try {
        const s = await action()
        setSuivi(s)
        setCommentaire(s.commentaire)
      } catch {
        setErreur("Enregistrement impossible. Êtes-vous toujours connecté ?")
      }
    })
  }

  return (
    <section className="mt-8 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-6">
      <h2 className="font-semibold text-amber-900">Suivi de prospection (visible par vous seul)</h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={enCours}
          onClick={() => executer(() => basculerContacte(siret, !suivi.contacte))}
          className={
            suivi.contacte
              ? "rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
              : "rounded border border-stone-400 bg-white px-4 py-2 font-medium hover:bg-stone-100 disabled:opacity-60"
          }
        >
          {suivi.contacte ? "✓ Contacté" : "Marquer comme contacté"}
        </button>
        {suivi.contacte && (
          <span className="text-sm text-stone-600">
            le {date(suivi.contacte_le)} ·{" "}
            <button
              type="button"
              disabled={enCours}
              onClick={() => executer(() => basculerContacte(siret, false))}
              className="underline"
            >
              annuler
            </button>
          </span>
        )}
      </div>

      <label className="mt-4 grid gap-1">
        <span className="text-sm font-medium">Commentaire</span>
        <textarea
          value={commentaire}
          onChange={(ev) => setCommentaire(ev.target.value)}
          rows={4}
          maxLength={COMMENTAIRE_MAX}
          placeholder="Ex. : rappeler lundi, intéressé par…"
          className="rounded border border-stone-300 bg-white px-3 py-2"
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={enCours || !modifie}
          onClick={() => executer(() => sauverCommentaire(siret, commentaire))}
          className="bg-marque hover:bg-marque-fonce rounded px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer le commentaire"}
        </button>
        {suivi.maj_le && !modifie && (
          <span className="text-sm text-stone-500">Enregistré le {date(suivi.maj_le)}</span>
        )}
      </div>
      {erreur && <p className="mt-2 text-sm text-red-700">{erreur}</p>}
    </section>
  )
}
