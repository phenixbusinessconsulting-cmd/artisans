// Requêtes de lecture de l'annuaire public.

import { clientPublic } from "./supabase/clients"
import type { Entreprise } from "./types"

export const PAR_PAGE = 24

const COLONNES =
  "siret, siren, raison_sociale, enseigne, naf, metier, specialites, labels, dirigeant_nom, dirigeant_qualite, adresse, code_postal, ville, latitude, longitude, telephone, telephone_type, telephone_source, telephone_confiance, site_web, date_creation"

export interface Filtres {
  q?: string
  metier?: string
  ville?: string
  specialite?: string
  page?: number
}

/** Retire les caractères qui ont un sens dans la syntaxe de filtre PostgREST (`,()` et jokers). */
export function nettoyerRecherche(texte: string | undefined): string {
  return (texte ?? "")
    .replace(/[,()*%\\:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

export async function rechercherEntreprises(filtres: Filtres) {
  const page = Math.max(1, filtres.page ?? 1)
  let requete = clientPublic()
    .from("entreprises")
    .select(COLONNES, { count: "estimated" })
    .order("raison_sociale")
    .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1)

  const q = nettoyerRecherche(filtres.q)
  if (q) {
    requete = requete.or(
      `raison_sociale.ilike.%${q}%,enseigne.ilike.%${q}%,dirigeant_nom.ilike.%${q}%`
    )
  }
  if (filtres.metier) requete = requete.eq("metier", filtres.metier)
  if (filtres.specialite) requete = requete.contains("specialites", [filtres.specialite])
  const ville = nettoyerRecherche(filtres.ville)
  if (ville) {
    requete = /^\d{2,5}$/.test(ville)
      ? requete.like("code_postal", `${ville}%`)
      : requete.ilike("ville", `%${ville}%`)
  }

  const { data, count, error } = await requete
  if (error) throw new Error(error.message)
  return { entreprises: (data ?? []) as Entreprise[], total: count ?? 0, page }
}

export async function lireEntreprise(siret: string): Promise<Entreprise | null> {
  if (!/^\d{14}$/.test(siret)) return null
  const { data, error } = await clientPublic()
    .from("entreprises")
    .select(COLONNES)
    .eq("siret", siret)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Entreprise | null
}
