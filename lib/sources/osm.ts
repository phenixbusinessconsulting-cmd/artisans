// Artisans du bâtiment cartographiés dans OpenStreetMap (API Overpass).
// Données © contributeurs OpenStreetMap, licence ODbL : attribution obligatoire.

import { distanceMetres } from "../enrich/google-places"
import { normaliserTelephone } from "../phone"
import { contientNom } from "../verification"

const API = "https://overpass-api.de/api/interpreter"
const USER_AGENT = "Annuaire-Artisans-91/1.0 (+https://artisans.monsitedemo-talens.fr/retrait)"
const METIERS_OSM =
  "plumber|electrician|roofer|carpenter|builder|painter|plasterer|tiler|hvac|stonemason|glaziery|window_construction|insulation|floorer|metal_construction|locksmith|scaffolder|heating_engineer"
// Rapprochement par le nom seulement si le point OSM est tout près de l'adresse SIRENE.
const DISTANCE_MAX_M = 300

interface Element {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface LieuOsm {
  nom: string | null
  siret: string | null
  telephone: string | null
  site_web: string | null
  lat: number | null
  lon: number | null
}

export function requeteOverpass(departement: string): string {
  return `[out:json][timeout:90];area["ISO3166-2"="FR-${departement}"]->.a;nwr[craft~"^(${METIERS_OSM})$"](area.a);out tags center;`
}

export function versLieux(elements: Element[]): LieuOsm[] {
  return elements.map((e) => {
    const t = e.tags ?? {}
    const telephones = [t["contact:mobile"], t.mobile, t.phone, t["contact:phone"]]
      .flatMap((v) => (v ?? "").split(";"))
      .map((v) => normaliserTelephone(v))
      .filter((v): v is string => !!v)
    const siret = (t["ref:FR:SIRET"] ?? "").replace(/\s/g, "")
    return {
      nom: t.name ?? null,
      siret: /^\d{14}$/.test(siret) ? siret : null,
      // Un portable publié est préféré, comme pour les autres sources.
      telephone: telephones.find((n) => /^0[67]/.test(n)) ?? telephones[0] ?? null,
      site_web: t.website ?? t["contact:website"] ?? null,
      lat: e.lat ?? e.center?.lat ?? null,
      lon: e.lon ?? e.center?.lon ?? null,
    }
  })
}

export interface FichePourRapprochement {
  siret: string
  raison_sociale: string
  enseigne: string | null
  latitude: number | null
  longitude: number | null
}

/** SIRET de la fiche correspondant au lieu OSM : par SIRET, sinon par nom et proximité. */
export function rapprocher(lieu: LieuOsm, fiches: FichePourRapprochement[]): string | null {
  if (lieu.siret) return fiches.some((f) => f.siret === lieu.siret) ? lieu.siret : null
  if (!lieu.nom || lieu.lat === null || lieu.lon === null) return null
  const candidates = fiches.filter(
    (f) =>
      f.latitude !== null &&
      f.longitude !== null &&
      distanceMetres({ lat: lieu.lat!, lon: lieu.lon! }, { lat: f.latitude, lon: f.longitude }) <=
        DISTANCE_MAX_M &&
      (contientNom(lieu.nom!, f.raison_sociale) ||
        (!!f.enseigne && contientNom(lieu.nom!, f.enseigne)))
  )
  // Ambigu (plusieurs fiches possibles) : on s'abstient.
  return candidates.length === 1 ? candidates[0]!.siret : null
}

export async function lireOsm(departement: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(API, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ data: requeteOverpass(departement) }),
  })
  if (!res.ok) throw new Error(`Overpass : HTTP ${res.status}`)
  const { elements } = (await res.json()) as { elements: Element[] }
  return versLieux(elements)
}
