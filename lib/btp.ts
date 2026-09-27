// Codes NAF rév. 2 des métiers du bâtiment retenus pour l'annuaire, avec le libellé métier affiché.
// Source des libellés officiels : nomenclature INSEE (sous-classes 41.20 et 43.xx).

export const METIERS_BTP = {
  "41.20A": "Constructeur de maisons individuelles",
  "41.20B": "Construction de bâtiments",
  "43.11Z": "Démolition",
  "43.12A": "Terrassement",
  "43.12B": "Terrassement spécialisé",
  "43.21A": "Électricien",
  "43.22A": "Plombier",
  "43.22B": "Chauffagiste / Climatisation",
  "43.29A": "Isolation",
  "43.29B": "Installations techniques du bâtiment",
  "43.31Z": "Plâtrier",
  "43.32A": "Menuisier",
  "43.32B": "Serrurier / Métallier",
  "43.32C": "Agenceur",
  "43.33Z": "Carreleur / Solier",
  "43.34Z": "Peintre / Vitrier",
  "43.39Z": "Travaux de finition",
  "43.91A": "Charpentier",
  "43.91B": "Couvreur",
  "43.99A": "Étancheur",
  "43.99B": "Structures métalliques",
  "43.99C": "Maçon",
  "43.99D": "Travaux spécialisés du bâtiment",
} as const

export type CodeNafBtp = keyof typeof METIERS_BTP

export const CODES_NAF_BTP = Object.keys(METIERS_BTP) as CodeNafBtp[]

export function estCodeNafBtp(code: string | null | undefined): code is CodeNafBtp {
  return !!code && code in METIERS_BTP
}

export function metierDepuisNaf(code: string | null | undefined): string | null {
  return estCodeNafBtp(code) ? METIERS_BTP[code] : null
}

// Liste dédoublonnée des métiers, pour les filtres de recherche.
export const METIERS = [...new Set(Object.values(METIERS_BTP))].sort((a, b) =>
  a.localeCompare(b, "fr")
)
