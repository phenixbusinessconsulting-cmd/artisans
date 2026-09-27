// Lecture minimale de robots.txt : règles Disallow/Allow du groupe « User-agent: * ».
// La règle la plus longue qui correspond l'emporte (comme Google), `*` et `$` sont gérés.

export interface Regle {
  autorise: boolean
  motif: string
}

export function lireRobots(texte: string): Regle[] {
  const regles: Regle[] = []
  let groupeEtoile = false
  let dansAgents = false
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/#.*/, "").trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(ligne)
    if (!m) continue
    const cle = m[1]!.toLowerCase()
    const valeur = m[2]!.trim()
    if (cle === "user-agent") {
      // Plusieurs lignes User-agent consécutives forment un seul groupe.
      groupeEtoile = dansAgents ? groupeEtoile || valeur === "*" : valeur === "*"
      dansAgents = true
      continue
    }
    dansAgents = false
    if (!groupeEtoile) continue
    if ((cle === "disallow" || cle === "allow") && valeur) {
      regles.push({ autorise: cle === "allow", motif: valeur })
    }
  }
  return regles
}

function versRegex(motif: string): RegExp {
  const echappe = motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\$$/, "$")
  return new RegExp("^" + echappe.replace(/\*/g, ".*"))
}

export function estAutorise(regles: Regle[], cheminEtRequete: string): boolean {
  let meilleure: Regle | undefined
  for (const r of regles) {
    if (!versRegex(r.motif).test(cheminEtRequete)) continue
    if (
      !meilleure ||
      r.motif.length > meilleure.motif.length ||
      (r.motif.length === meilleure.motif.length && r.autorise)
    ) {
      meilleure = r
    }
  }
  return meilleure?.autorise ?? true
}
