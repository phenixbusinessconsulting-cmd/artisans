// Enrichissement via Google Places API (New) — Text Search.
// Doc : https://developers.google.com/maps/documentation/places/web-service/text-search
// Renvoie le téléphone et le site affichés publiquement par l'entreprise sur sa fiche Google.

import type { Entreprise } from "../types"

const API = "https://places.googleapis.com/v1/places:searchText"
const CHAMPS = [
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.types",
  "places.location",
].join(",")

// Au-delà de cette distance, la fiche Google est considérée comme une autre entreprise.
const DISTANCE_MAX_M = 1_000

export interface ResultatPlace {
  telephone: string | null
  siteWeb: string | null
  texte: string // nom + types, pour la détection de spécialités
}

interface Place {
  displayName?: { text?: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  types?: string[]
  location?: { latitude: number; longitude: number }
}

export function distanceMetres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Vérifie que la fiche Google correspond bien à l'établissement (même adresse ou très proche). */
export function correspond(
  place: Place,
  e: Pick<Entreprise, "code_postal" | "latitude" | "longitude">
) {
  if (e.latitude !== null && e.longitude !== null && place.location) {
    return (
      distanceMetres(
        { lat: e.latitude, lon: e.longitude },
        { lat: place.location.latitude, lon: place.location.longitude }
      ) <= DISTANCE_MAX_M
    )
  }
  return !!e.code_postal && !!place.formattedAddress?.includes(e.code_postal)
}

export async function chercherPlace(
  e: Pick<
    Entreprise,
    "raison_sociale" | "enseigne" | "ville" | "code_postal" | "latitude" | "longitude"
  >,
  cleApi: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResultatPlace | null> {
  const nom = e.enseigne ?? e.raison_sociale
  const body: Record<string, unknown> = {
    textQuery: `${nom} ${e.code_postal ?? ""} ${e.ville ?? ""}`.trim(),
    languageCode: "fr",
    regionCode: "FR",
    pageSize: 3,
  }
  if (e.latitude !== null && e.longitude !== null) {
    body.locationBias = {
      circle: { center: { latitude: e.latitude, longitude: e.longitude }, radius: 2000 },
    }
  }
  const res = await fetchImpl(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": cleApi,
      "X-Goog-FieldMask": CHAMPS,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Google Places : HTTP ${res.status}`)
  const { places = [] } = (await res.json()) as { places?: Place[] }
  const place = places.find((p) => correspond(p, e))
  if (!place) return null
  return {
    telephone: place.nationalPhoneNumber ?? null,
    siteWeb: place.websiteUri ?? null,
    texte: [place.displayName?.text, ...(place.types ?? [])].filter(Boolean).join(" "),
  }
}
