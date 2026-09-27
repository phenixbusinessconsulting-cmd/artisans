import Link from "next/link"
import { PAR_PAGE, rechercherEntreprises, type Filtres } from "@/lib/annuaire"
import { METIERS } from "@/lib/btp"
import { CarteEntreprise } from "./fiche"

function valeur(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined
}

function lienPage(filtres: Filtres, page: number) {
  const params = new URLSearchParams()
  for (const [cle, v] of Object.entries({ ...filtres, page })) if (v) params.set(cle, String(v))
  return `/?${params}`
}

export default async function Accueil(props: PageProps<"/">) {
  const sp = await props.searchParams
  const filtres: Filtres = {
    q: valeur(sp.q),
    metier: valeur(sp.metier),
    ville: valeur(sp.ville),
    specialite: valeur(sp.specialite),
    page: Number(valeur(sp.page)) || 1,
  }
  const { entreprises, total, page } = await rechercherEntreprises(filtres)
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE))

  return (
    <>
      <h1 className="text-2xl font-bold sm:text-3xl">Artisans du bâtiment en Essonne</h1>
      <p className="mt-2 text-stone-600">
        Trouvez un plombier, un électricien, un maçon ou un couvreur près de chez vous.
      </p>

      <form className="mt-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={filtres.q}
          placeholder="Nom de l'entreprise ou du dirigeant"
          className="rounded border border-stone-300 px-3 py-2 sm:col-span-2"
        />
        <select
          name="metier"
          defaultValue={filtres.metier ?? ""}
          className="rounded border border-stone-300 px-3 py-2"
        >
          <option value="">Tous les métiers</option>
          {METIERS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          name="ville"
          defaultValue={filtres.ville}
          placeholder="Ville ou code postal"
          className="rounded border border-stone-300 px-3 py-2"
        />
        {filtres.specialite && <input type="hidden" name="specialite" value={filtres.specialite} />}
        <button className="bg-marque hover:bg-marque-fonce rounded px-4 py-2 font-medium text-white sm:col-start-4">
          Rechercher
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-500">
        {total.toLocaleString("fr-FR")} artisan{total > 1 ? "s" : ""}
        {filtres.specialite && (
          <>
            {" "}
            · spécialité <strong>{filtres.specialite}</strong>{" "}
            <Link href={lienPage({ ...filtres, specialite: undefined }, 1)} className="underline">
              retirer
            </Link>
          </>
        )}
      </p>

      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entreprises.map((e) => (
          <CarteEntreprise key={e.siret} e={e} />
        ))}
      </ul>

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link href={lienPage(filtres, page - 1)} className="underline">
              ← Précédent
            </Link>
          )}
          <span>
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link href={lienPage(filtres, page + 1)} className="underline">
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
