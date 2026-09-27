// Client de l'API Recherche d'entreprises (data.gouv.fr / DINUM), gratuite et sans clé.
// Doc : https://recherche-entreprises.api.gouv.fr/docs/ — limite : 7 requêtes/s, 25 résultats/page,
// 10 000 résultats maximum par recherche.

import { metierDepuisNaf } from "../btp"
import type { EntrepriseSirene } from "../types"

const API = "https://recherche-entreprises.api.gouv.fr/search"
export const PAR_PAGE = 25
export const RESULTATS_MAX = 10_000

interface Dirigeant {
  type_dirigeant?: string
  nom?: string | null
  prenoms?: string | null
  qualite?: string | null
}

interface Etablissement {
  siret: string
  adresse?: string | null
  code_postal?: string | null
  libelle_commune?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  activite_principale?: string | null
  etat_administratif?: string | null
  date_creation?: string | null
  liste_enseignes?: string[] | null
}

export interface ResultatApi {
  siren: string
  nom_complet?: string | null
  nom_raison_sociale?: string | null
  nature_juridique?: string | null
  categorie_entreprise?: string | null
  statut_diffusion?: string | null
  date_creation?: string | null
  dirigeants?: Dirigeant[] | null
  siege?: Etablissement | null
  matching_etablissements?: Etablissement[] | null
  complements?: { est_rge?: boolean | null; est_entrepreneur_individuel?: boolean | null } | null
}

export interface PageApi {
  results: ResultatApi[]
  total_results: number
  page: number
  total_pages: number
}

const NON_DIFFUSIBLE = /NON-DIFFUSIBLE/i

function versNombre(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function titre(texte: string): string {
  return texte.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase())
}

function decideur(r: ResultatApi): { nom: string | null; qualite: string | null } {
  const personne = (r.dirigeants ?? []).find(
    (d) => d.type_dirigeant === "personne physique" && d.nom
  )
  if (personne) {
    const prenom = personne.prenoms?.split(/\s+/)[0] ?? ""
    return {
      nom: titre(`${prenom} ${personne.nom}`.trim()),
      qualite: personne.qualite ? titre(personne.qualite) : null,
    }
  }
  // Entreprise individuelle : le décideur est l'entrepreneur lui-même, dont le nom est la raison sociale.
  if (r.complements?.est_entrepreneur_individuel && r.nom_raison_sociale) {
    return { nom: titre(r.nom_raison_sociale), qualite: "Entrepreneur individuel" }
  }
  return { nom: null, qualite: null }
}

/**
 * Transforme un résultat de l'API en fiches (une par établissement actif du département).
 * Les entreprises en diffusion partielle (opposition au registre SIRENE) sont exclues :
 * leurs données personnelles ne doivent pas être publiées.
 */
export function versEntreprises(r: ResultatApi, departement: string): EntrepriseSirene[] {
  if (r.statut_diffusion && r.statut_diffusion !== "O") return []
  if (NON_DIFFUSIBLE.test(r.nom_complet ?? "") || NON_DIFFUSIBLE.test(r.nom_raison_sociale ?? ""))
    return []
  // Un annuaire d'artisans : on écarte les grandes entreprises et ETI.
  if (r.categorie_entreprise === "GE" || r.categorie_entreprise === "ETI") return []

  const etablissements = r.matching_etablissements?.length
    ? r.matching_etablissements
    : r.siege
      ? [r.siege]
      : []
  const { nom, qualite } = decideur(r)
  const raisonSociale = titre(r.nom_raison_sociale || r.nom_complet || "")
  if (!raisonSociale) return []

  const fiches: EntrepriseSirene[] = []
  for (const e of etablissements) {
    if (e.etat_administratif && e.etat_administratif !== "A") continue
    if (!e.code_postal?.startsWith(departement)) continue
    const metier = metierDepuisNaf(e.activite_principale)
    if (!metier || !e.activite_principale) continue
    const enseigne = e.liste_enseignes?.find((x) => x && !NON_DIFFUSIBLE.test(x))
    fiches.push({
      siret: e.siret,
      siren: r.siren,
      raison_sociale: raisonSociale,
      enseigne: enseigne ? titre(enseigne) : null,
      naf: e.activite_principale,
      metier,
      labels: r.complements?.est_rge ? ["RGE"] : [],
      dirigeant_nom: nom,
      dirigeant_qualite: qualite,
      adresse: e.adresse ?? null,
      code_postal: e.code_postal ?? null,
      ville: e.libelle_commune ? titre(e.libelle_commune) : null,
      latitude: versNombre(e.latitude),
      longitude: versNombre(e.longitude),
      date_creation: e.date_creation ?? r.date_creation ?? null,
    })
  }
  return fiches
}

export interface Recherche {
  departement: string
  naf: string
  codePostal?: string
  page: number
}

export function urlRecherche({ departement, naf, codePostal, page }: Recherche): string {
  const params = new URLSearchParams({
    activite_principale: naf,
    etat_administratif: "A",
    per_page: String(PAR_PAGE),
    page: String(page),
    limite_matching_etablissements: "100",
  })
  if (codePostal) params.set("code_postal", codePostal)
  else params.set("departement", departement)
  return `${API}?${params}`
}

export async function rechercher(
  recherche: Recherche,
  fetchImpl: typeof fetch = fetch
): Promise<PageApi> {
  for (let tentative = 1; ; tentative++) {
    const res = await fetchImpl(urlRecherche(recherche), {
      headers: { Accept: "application/json" },
    })
    if (res.ok) return (await res.json()) as PageApi
    // 429 = limite de débit : on patiente et on réessaie.
    if ((res.status === 429 || res.status >= 500) && tentative < 5) {
      await new Promise((r) => setTimeout(r, 1000 * tentative))
      continue
    }
    throw new Error(
      `API Recherche d'entreprises : HTTP ${res.status} pour ${urlRecherche(recherche)}`
    )
  }
}
