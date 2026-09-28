import Link from "next/link"
import { PAR_PAGE, rechercherEntreprises, type Filtres } from "@/lib/annuaire"
import { estAdmin } from "@/lib/admin"
import { METIERS } from "@/lib/btp"
import type { Departement } from "@/lib/departements"
import { CarteEntreprise } from "./fiche"

type Parametres = Record<string, string | string[] | undefined>

function valeur(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined
}

function lienPage(chemin: string, filtres: Filtres, page: number) {
  const params = new URLSearchParams()
  // Le département est porté par le chemin de la page, pas par l'URL.
  for (const [cle, v] of Object.entries({ ...filtres, page }))
    if (v && cle !== "departement") params.set(cle, String(v))
  return `${chemin}?${params}`
}

function filtreSuivi(v: string | undefined): Filtres["suivi"] {
  return v === "a_contacter" || v === "contacte" ? v : undefined
}

function filtreSite(v: string | undefined): Filtres["site"] {
  return v === "oui" || v === "non" ? v : undefined
}

function filtreTelephone(v: string | undefined): Filtres["telephone"] {
  return v === "oui" || v === "mobile" ? v : undefined
}

/** Page annuaire d'un département : recherche et liste des fiches dont le code postal y est. */
export async function PageAnnuaire({
  departement,
  sp,
}: {
  departement: Departement
  sp: Parametres
}) {
  const filtres: Filtres = {
    departement: departement.code,
    q: valeur(sp.q),
    metier: valeur(sp.metier),
    ville: valeur(sp.ville),
    specialite: valeur(sp.specialite),
    telephone: filtreTelephone(valeur(sp.telephone)),
    site: filtreSite(valeur(sp.site)),
    suivi: filtreSuivi(valeur(sp.suivi)),
    page: Number(valeur(sp.page)) || 1,
  }
  const admin = await estAdmin()
  const { entreprises, total, page } = await rechercherEntreprises(filtres, { admin })
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE))

  return (
    <>
      <h1 className="text-2xl font-bold sm:text-3xl">
        Artisans du bâtiment {departement.en} ({departement.code})
      </h1>
      <p className="mt-2 text-stone-600">
        Trouvez un plombier, un électricien, un maçon ou un couvreur près de chez vous.
      </p>

      <form
        action={departement.chemin}
        className="mt-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-4"
      >
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
        <select
          name="telephone"
          defaultValue={filtres.telephone ?? ""}
          aria-label="Téléphone"
          className="rounded border border-stone-300 px-3 py-2"
        >
          <option value="">Avec ou sans téléphone</option>
          <option value="oui">Téléphone renseigné (fixe ou portable)</option>
          <option value="mobile">Portable (06 / 07)</option>
        </select>
        <select
          name="site"
          defaultValue={filtres.site ?? ""}
          aria-label="Site web"
          className="rounded border border-stone-300 px-3 py-2"
        >
          <option value="">Avec ou sans site web</option>
          <option value="oui">Avec site web</option>
          <option value="non">Sans site web</option>
        </select>
        {admin && (
          <select
            name="suivi"
            defaultValue={filtres.suivi ?? ""}
            aria-label="Suivi de prospection"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2"
          >
            <option value="">Tous (suivi)</option>
            <option value="a_contacter">À contacter</option>
            <option value="contacte">Déjà contactés</option>
          </select>
        )}
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
            <Link
              href={lienPage(departement.chemin, { ...filtres, specialite: undefined }, 1)}
              className="underline"
            >
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
            <Link href={lienPage(departement.chemin, filtres, page - 1)} className="underline">
              ← Précédent
            </Link>
          )}
          <span>
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link href={lienPage(departement.chemin, filtres, page + 1)} className="underline">
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
