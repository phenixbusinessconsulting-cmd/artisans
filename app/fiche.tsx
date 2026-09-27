import Link from "next/link"
import { formaterTelephone } from "@/lib/phone"
import type { Entreprise } from "@/lib/types"

export function nomAffiche(e: Pick<Entreprise, "enseigne" | "raison_sociale">) {
  return e.enseigne ?? e.raison_sociale
}

export function CarteEntreprise({ e }: { e: Entreprise }) {
  return (
    <li className="flex flex-col rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-marque text-xs font-semibold tracking-wide uppercase">{e.metier}</p>
        {e.contacte && (
          <span className="rounded bg-green-700 px-2 py-0.5 text-xs text-white">Contacté</span>
        )}
      </div>
      <Link href={`/entreprise/${e.siret}`} className="mt-1 font-semibold hover:underline">
        {nomAffiche(e)}
      </Link>
      {e.dirigeant_nom && (
        <p className="text-sm text-stone-600">
          {e.dirigeant_nom}
          {e.dirigeant_qualite && <span className="text-stone-400"> · {e.dirigeant_qualite}</span>}
        </p>
      )}
      <p className="mt-2 text-sm text-stone-600">
        {e.code_postal} {e.ville}
      </p>
      {e.telephone && (
        <a href={`tel:${e.telephone}`} className="text-marque mt-2 text-sm font-medium">
          {formaterTelephone(e.telephone)}
        </a>
      )}
      {(e.labels.length > 0 || e.specialites.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1">
          {e.labels.map((l) => (
            <li key={l} className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
              {l}
            </li>
          ))}
          {e.specialites.slice(0, 4).map((s) => (
            <li key={s} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
              {s}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
