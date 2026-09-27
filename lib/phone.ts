export type TypeTelephone = "mobile" | "fixe"

export interface TelephoneCandidat {
  numero: string // format national normalisé : 0612345678
  type: TypeTelephone
  source: string
}

// Les numéros de services (08, souvent surtaxés) ne joignent pas un décideur : on les écarte.
// Les 09 (lignes box) sont conservés comme fixes.
const PREFIXES_EXCLUS = ["08"]

/** Normalise un numéro français (formats +33, 0033, espaces, points, tirets) vers 0XXXXXXXXX. */
export function normaliserTelephone(brut: string | null | undefined): string | null {
  if (!brut) return null
  let chiffres = brut.replace(/\(0\)/g, "").replace(/[^\d+]/g, "")
  if (chiffres.startsWith("+33")) chiffres = "0" + chiffres.slice(3)
  else if (chiffres.startsWith("0033")) chiffres = "0" + chiffres.slice(4)
  else if (chiffres.startsWith("33") && chiffres.length === 11) chiffres = "0" + chiffres.slice(2)
  if (!/^0[1-9]\d{8}$/.test(chiffres)) return null
  if (PREFIXES_EXCLUS.some((p) => chiffres.startsWith(p))) return null
  return chiffres
}

export function typeTelephone(numero: string): TypeTelephone {
  return /^0[67]/.test(numero) ? "mobile" : "fixe"
}

export function formaterTelephone(numero: string): string {
  return numero.replace(/(\d{2})(?=\d)/g, "$1 ")
}

/** Extrait tous les numéros français plausibles d'un texte (page web, fiche…). */
export function extraireTelephones(texte: string): string[] {
  const motif = /(?:\+33\s?(?:\(0\)\s?)?|0033\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g
  const trouves = new Set<string>()
  for (const m of texte.matchAll(motif)) {
    const n = normaliserTelephone(m[0])
    if (n) trouves.add(n)
  }
  return [...trouves]
}

export function candidat(
  numeroBrut: string | null | undefined,
  source: string
): TelephoneCandidat | null {
  const numero = normaliserTelephone(numeroBrut)
  return numero ? { numero, type: typeTelephone(numero), source } : null
}

export interface TelephoneRetenu extends TelephoneCandidat {
  confiance: number // 0–100
  sources: string[]
}

/**
 * Choisit le meilleur numéro parmi les candidats de plusieurs sources :
 * un mobile est préféré à un fixe, puis le numéro confirmé par le plus de sources.
 */
export function choisirTelephone(candidats: (TelephoneCandidat | null)[]): TelephoneRetenu | null {
  const parNumero = new Map<string, { type: TypeTelephone; sources: Set<string> }>()
  for (const c of candidats) {
    if (!c) continue
    const entree = parNumero.get(c.numero) ?? { type: c.type, sources: new Set<string>() }
    entree.sources.add(c.source)
    parNumero.set(c.numero, entree)
  }
  const classes = [...parNumero.entries()].sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === "mobile" ? -1 : 1
    return b.sources.size - a.sources.size
  })
  const premier = classes[0]
  if (!premier) return null
  const [numero, { type, sources }] = premier
  const listeSources = [...sources].sort()
  return {
    numero,
    type,
    source: listeSources.join("+"),
    sources: listeSources,
    confiance: Math.min(100, 50 + 25 * (sources.size - 1)),
  }
}
