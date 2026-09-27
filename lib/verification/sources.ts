// Annuaires tiers consultés pour vérifier nos fiches. Uniquement des pages de recherche
// publiques, autorisées par robots.txt, et sans protection anti-robot.
// Rien n'est recopié : on regarde seulement si le nom, le SIREN et notre téléphone y figurent.

import type { Entreprise } from "../types"

export interface SourceVerification {
  id: string
  nom: string
  /** URL de recherche pour cette fiche, ou null si la source ne s'applique pas. */
  url: (e: Entreprise) => string | null
}

const q = encodeURIComponent

export const SOURCES_VERIFICATION: SourceVerification[] = [
  {
    id: "monartisan",
    nom: "monartisan.info",
    url: (e) => `https://www.monartisan.info/?q=${e.siret}`,
  },
  {
    id: "qualibat",
    nom: "Qualibat",
    url: (e) =>
      `https://www.qualibat.com/entreprise-correspondant-au-sirenraison-sociale/?siren_or_r_soc=${e.siren}`,
  },
  {
    id: "annuaire-plombiers",
    nom: "annuaire-plombiers.com",
    url: (e) =>
      /plombier|chauffagiste/i.test(e.metier)
        ? `https://www.annuaire-plombiers.com/fiches-plombiers/?keyword_search=${q(e.enseigne ?? e.raison_sociale)}&location_search=${q(e.ville ?? "")}`
        : null,
  },
  {
    id: "lartisanatenligne",
    nom: "lartisanatenligne.com",
    url: (e) => `https://www.lartisanatenligne.com/?s=${q(e.enseigne ?? e.raison_sociale)}`,
  },
  {
    id: "pointlocal",
    nom: "pointlocal.fr",
    url: (e) => `https://www.pointlocal.fr/?s=${q(e.enseigne ?? e.raison_sociale)}`,
  },
]
