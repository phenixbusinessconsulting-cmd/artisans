import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { estAdmin } from "@/lib/admin"
import { lireEntreprise } from "@/lib/annuaire"
import { sql } from "@/lib/db"
import { lireSuivi } from "@/lib/suivi"
import { formaterTelephone } from "@/lib/phone"
import { nomAffiche } from "../../fiche"
import { SuiviProspection } from "./suivi"

const SOURCES_TELEPHONE: Record<string, string> = {
  google: "fiche Google de l'entreprise",
  site: "site web de l'entreprise",
  ademe: "liste RGE de l'ADEME",
  osm: "OpenStreetMap",
  amiante: "liste des entreprises certifiées amiante (édition 2017)",
}

function formaterSiret(siret: string) {
  return siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4")
}

export async function generateMetadata(props: PageProps<"/entreprise/[siret]">): Promise<Metadata> {
  const { siret } = await props.params
  const e = await lireEntreprise(siret)
  if (!e) return {}
  return {
    title: `${nomAffiche(e)} — ${e.metier} à ${e.ville ?? "Essonne"}`,
    description: `${nomAffiche(e)}, ${e.metier.toLowerCase()} à ${e.ville ?? ""} (${e.code_postal ?? "91"}).`,
  }
}

export default async function FicheEntreprise(props: PageProps<"/entreprise/[siret]">) {
  const { siret } = await props.params
  const e = await lireEntreprise(siret)
  if (!e) notFound()
  const admin = await estAdmin()
  const suivi = admin ? await lireSuivi(sql(), e.siret) : null

  const sourcesTel = (e.telephone_source ?? "")
    .split("+")
    .map((s) => SOURCES_TELEPHONE[s])
    .filter(Boolean)

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm text-stone-500 underline">
        ← Retour à l&apos;annuaire
      </Link>
      <p className="text-marque mt-4 text-sm font-semibold tracking-wide uppercase">{e.metier}</p>
      <h1 className="text-2xl font-bold sm:text-3xl">{nomAffiche(e)}</h1>
      {e.enseigne && e.enseigne !== e.raison_sociale && (
        <p className="text-stone-600">{e.raison_sociale}</p>
      )}

      <dl className="mt-6 grid gap-4 rounded-lg border border-stone-200 bg-white p-6 sm:grid-cols-2">
        {e.dirigeant_nom && (
          <div>
            <dt className="text-sm text-stone-500">Dirigeant</dt>
            <dd className="font-medium">
              {e.dirigeant_nom}
              {e.dirigeant_qualite && (
                <span className="font-normal text-stone-500"> · {e.dirigeant_qualite}</span>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-stone-500">Téléphone</dt>
          <dd className="font-medium">
            {e.telephone ? (
              <a href={`tel:${e.telephone}`} className="text-marque">
                {formaterTelephone(e.telephone)}
              </a>
            ) : (
              <span className="text-stone-400">Non renseigné</span>
            )}
          </dd>
          {sourcesTel.length > 0 && (
            <dd className="text-xs text-stone-400">Source : {sourcesTel.join(", ")}</dd>
          )}
        </div>
        <div>
          <dt className="text-sm text-stone-500">Adresse</dt>
          <dd>{e.adresse ?? `${e.code_postal ?? ""} ${e.ville ?? ""}`}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-500">SIRET</dt>
          <dd className="font-mono">{formaterSiret(e.siret)}</dd>
        </div>
        {e.site_web && (
          <div>
            <dt className="text-sm text-stone-500">Site web</dt>
            <dd>
              <a
                href={e.site_web}
                rel="nofollow noopener"
                target="_blank"
                className="text-marque underline"
              >
                {e.site_web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </dd>
          </div>
        )}
        {e.date_creation && (
          <div>
            <dt className="text-sm text-stone-500">Création</dt>
            <dd>{new Date(e.date_creation).toLocaleDateString("fr-FR")}</dd>
          </div>
        )}
      </dl>

      {(e.labels.length > 0 || e.specialites.length > 0) && (
        <section className="mt-6">
          <h2 className="font-semibold">Spécialités et labels</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {e.labels.map((l) => (
              <li key={l} className="rounded bg-green-100 px-2 py-1 text-sm text-green-800">
                {l}
              </li>
            ))}
            {e.specialites.map((s) => (
              <li key={s}>
                <Link
                  href={`/?specialite=${encodeURIComponent(s)}`}
                  className="block rounded bg-stone-100 px-2 py-1 text-sm text-stone-700 hover:bg-stone-200"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suivi && <SuiviProspection siret={e.siret} initial={suivi} />}

      <p className="mt-8 text-sm text-stone-500">
        Vous êtes cette entreprise ?{" "}
        <Link href={`/retrait?siret=${e.siret}`} className="underline">
          Demander le retrait de cette fiche
        </Link>
      </p>
    </article>
  )
}
