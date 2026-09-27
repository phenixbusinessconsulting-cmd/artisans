// Détection des spécialités à partir de texte libre (site web, fiche Google, description d'activité).
// Chaque spécialité est reconnue par une expression régulière insensible à la casse et aux accents.

const SPECIALITES: [label: string, motif: RegExp][] = [
  ["Pompe à chaleur", /pompes? a chaleur|\bpac\b/],
  ["Chauffage", /chauffage|chaudiere|chauffagiste/],
  ["Climatisation", /climatisation|climatiseur/],
  ["Salle de bain", /salles? de bains?/],
  ["Dépannage", /depannage|urgence/],
  ["Plomberie", /plomberie/],
  ["Électricité", /electricite|electricien|tableau electrique/],
  ["Borne de recharge", /bornes? de recharge|\birve\b/],
  ["Photovoltaïque", /photovoltaique|panneaux? solaires?/],
  ["Domotique", /domotique/],
  ["VMC", /\bvmc\b|ventilation/],
  ["Isolation", /isolation|\bite\b/],
  ["Toiture", /toiture|couverture/],
  ["Zinguerie", /zinguerie|gouttieres?/],
  ["Charpente", /charpente/],
  ["Étanchéité", /etancheite/],
  ["Ravalement", /ravalement|facades?/],
  ["Maçonnerie", /maconnerie/],
  ["Extension", /extensions?|agrandissement|surelevation/],
  ["Rénovation", /renovation/],
  ["Terrassement", /terrassement/],
  ["Assainissement", /assainissement|fosses? septiques?/],
  ["Démolition", /demolition/],
  ["Désamiantage", /desamiantage|amiante/],
  ["Carrelage", /carrelage|carreleur/],
  ["Parquet", /parquet/],
  ["Peinture", /peinture/],
  ["Plâtrerie", /platrerie|placo|cloisons?/],
  ["Menuiserie", /menuiserie/],
  ["Fenêtres", /fenetres?|baies? vitrees?/],
  ["Volets", /volets?|stores?/],
  ["Portails et clôtures", /portails?|clotures?/],
  ["Serrurerie", /serrurerie|serrurier/],
  ["Vitrerie", /vitrerie|vitrier/],
  ["Cuisine", /cuisines?/],
  ["Piscine", /piscines?/],
]

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function detecterSpecialites(...textes: (string | null | undefined)[]): string[] {
  const corpus = sansAccents(textes.filter(Boolean).join(" \n "))
  if (!corpus) return []
  return SPECIALITES.filter(([, motif]) => motif.test(corpus)).map(([label]) => label)
}
