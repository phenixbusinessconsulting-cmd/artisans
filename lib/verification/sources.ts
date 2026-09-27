// Annuaires tiers consultés pour vérifier nos fiches. Uniquement des pages de recherche
// publiques, autorisées par robots.txt, et sans protection anti-robot.
// Rien n'est recopié : on regarde seulement si le nom, le SIREN et notre téléphone y figurent.

import type { Entreprise } from "../types"

export interface SourceVerification {
  id: string
  nom: string
  /** URL de recherche pour cette fiche, ou null si la source ne s'applique pas. */
  url: (e: Entreprise) => string | null
  /** Texte recherché : retiré de la page avant comparaison (les pages de résultats le répètent). */
  recherche?: (e: Entreprise) => string
  /** Pause minimale entre deux requêtes vers ce site (défaut du vérificateur sinon). */
  pauseMs?: number
}

const q = encodeURIComponent
const nomRecherche = (e: Entreprise) => e.enseigne ?? e.raison_sociale

// Sources écartées après essai (27/09/2026) : Qualibat (URL de recherche en 404, et l'ADEME fournit
// déjà ses qualifications), lartisanatenligne.com et pointlocal.fr (blogs dont la recherche
// renvoie le texte cherché, donc des faux positifs).
export const SOURCES_VERIFICATION: SourceVerification[] = [
  {
    id: "monartisan",
    nom: "monartisan.info",
    url: (e) => `https://www.monartisan.info/?q=${e.siret}`,
    // Répond 429 au-delà d'environ une requête toutes les quelques secondes.
    pauseMs: 10_000,
  },
  {
    id: "annuaire-plombiers",
    nom: "annuaire-plombiers.com",
    url: (e) =>
      /plombier|chauffagiste/i.test(e.metier)
        ? `https://www.annuaire-plombiers.com/fiches-plombiers/?keyword_search=${q(nomRecherche(e))}&location_search=${q(e.ville ?? "")}`
        : null,
    recherche: nomRecherche,
  },
]
