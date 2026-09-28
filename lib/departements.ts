// Départements couverts par l'annuaire. Chacun a sa page ; le département d'une fiche se déduit
// de son code postal. Pour en ajouter un : une entrée ici, une page app/<slug>/page.tsx, et le code
// dans la variable DEPARTEMENTS du workflow refresh-data.

export interface Departement {
  code: string
  nom: string
  /** Chemin de la page du département ("/" pour le département historique). */
  chemin: string
  /** « en Essonne », « en Eure-et-Loir » */
  en: string
  /** « de l'Essonne », « d'Eure-et-Loir » */
  de: string
}

export const DEPARTEMENTS = {
  "91": { code: "91", nom: "Essonne", chemin: "/", en: "en Essonne", de: "de l'Essonne" },
  "28": {
    code: "28",
    nom: "Eure-et-Loir",
    chemin: "/eure-et-loir",
    en: "en Eure-et-Loir",
    de: "d'Eure-et-Loir",
  },
} as const satisfies Record<string, Departement>

export type CodeDepartement = keyof typeof DEPARTEMENTS

// Ordre d'affichage (Object.values trierait les codes numériquement).
export const LISTE_DEPARTEMENTS: Departement[] = [DEPARTEMENTS["91"], DEPARTEMENTS["28"]]

export function departementDeCodePostal(cp: string | null | undefined): Departement | null {
  const code = cp?.slice(0, 2)
  return code && code in DEPARTEMENTS ? DEPARTEMENTS[code as CodeDepartement] : null
}
