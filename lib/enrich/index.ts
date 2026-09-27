// Croise les sources d'enrichissement pour une fiche : Google Places puis site web.

import { candidat, choisirTelephone, type TelephoneCandidat } from "../phone"
import { detecterSpecialites } from "../specialites"
import type { Entreprise } from "../types"
import { chercherPlace } from "./google-places"
import { analyserSite } from "./site-web"

// Au-delà, les numéros d'un site sont trop ambigus (agence web, partenaires…) sans SIREN affiché.
const TELEPHONES_SITE_MAX_SANS_SIREN = 2

export type Enrichissement = Pick<
  Entreprise,
  | "telephone"
  | "telephone_type"
  | "telephone_source"
  | "telephone_confiance"
  | "site_web"
  | "specialites"
> & { sources: Record<string, unknown> }

export async function enrichir(
  e: Entreprise,
  options: { cleGoogle?: string; fetchImpl?: typeof fetch }
): Promise<Enrichissement> {
  const fetchImpl = options.fetchImpl ?? fetch
  const candidats: (TelephoneCandidat | null)[] = []
  const textes: string[] = []
  const sources: Record<string, unknown> = {}
  let siteWeb = e.site_web

  if (options.cleGoogle) {
    const place = await chercherPlace(e, options.cleGoogle, fetchImpl)
    sources.google_places = place ? { trouve: true } : { trouve: false }
    if (place) {
      candidats.push(candidat(place.telephone, "google"))
      textes.push(place.texte)
      siteWeb ??= place.siteWeb
    }
  }

  if (siteWeb) {
    const site = await analyserSite(siteWeb, e.siren, fetchImpl)
    sources.site_web = site
      ? { url: siteWeb, siren_confirme: site.sirenConfirme, telephones: site.telephones.length }
      : { url: siteWeb, lisible: false }
    if (site) {
      textes.push(site.texte)
      if (site.sirenConfirme || site.telephones.length <= TELEPHONES_SITE_MAX_SANS_SIREN) {
        site.telephones.forEach((t) => candidats.push(candidat(t, "site")))
      }
    }
  }

  const tel = choisirTelephone(candidats)
  return {
    telephone: tel?.numero ?? null,
    telephone_type: tel?.type ?? null,
    telephone_source: tel?.source ?? null,
    telephone_confiance: tel?.confiance ?? null,
    site_web: siteWeb,
    specialites: detecterSpecialites(...textes),
    sources,
  }
}
