// Liste des entreprises RGE de l'ADEME (open data, Licence Ouverte).
// https://data.ademe.fr/datasets/liste-des-entreprises-rge-2
// Une ligne par qualification : on regroupe par SIRET.

import { normaliserTelephone } from "../phone"
import { detecterSpecialites } from "../specialites"

const API = "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines"

export interface LigneRge {
  siret?: string | null
  nom_entreprise?: string | null
  telephone?: string | null
  email?: string | null
  site_internet?: string | null
  domaine?: string | null
  meta_domaine?: string | null
  organisme?: string | null
  nom_qualification?: string | null
  lien_date_fin?: string | null
}

export interface FicheRge {
  siret: string
  telephone: string | null
  email: string | null
  site_web: string | null
  specialites: string[]
  labels: string[]
  qualifications: number
}

// Organismes de qualification → label affiché. Les architectes (cnoa) ne sont pas des artisans :
// leurs lignes sont ignorées. Les organismes inconnus ne donnent pas de label.
const ORGANISMES: Record<string, string> = {
  qualibat: "Qualibat",
  qualitenr: "Qualit'EnR",
  qualifelec: "Qualifelec",
  certibat: "Certibat",
  cerqual: "Cerqual",
  cequami: "Cequami",
  opqibi: "OPQIBI",
}
const ORGANISMES_EXCLUS = new Set(["cnoa"])

function cleOrganisme(organisme: string | null | undefined): string {
  return (organisme ?? "")
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase()
}

export function labelOrganisme(organisme: string | null | undefined): string | null {
  return ORGANISMES[cleOrganisme(organisme)] ?? null
}

function siteValide(url: string | null | undefined): string | null {
  const brut = url?.trim()
  if (!brut) return null
  const avecSchema = /^https?:\/\//i.test(brut) ? brut : `https://${brut}`
  try {
    const u = new URL(avecSchema)
    return u.hostname.includes(".") ? u.toString() : null
  } catch {
    return null
  }
}

function emailValide(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase()
  return e && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null
}

/** Regroupe les qualifications en cours par SIRET. */
export function regrouperParSiret(lignes: LigneRge[], aujourdhui = new Date()): FicheRge[] {
  const parSiret = new Map<
    string,
    { lignes: LigneRge[]; organismes: Set<string>; textes: string[] }
  >()
  const jour = aujourdhui.toISOString().slice(0, 10)
  for (const l of lignes) {
    const siret = l.siret?.replace(/\s/g, "")
    if (!siret || !/^\d{14}$/.test(siret)) continue
    if (l.lien_date_fin && l.lien_date_fin < jour) continue // qualification expirée
    if (ORGANISMES_EXCLUS.has(cleOrganisme(l.organisme))) continue // architectes
    const organisme = labelOrganisme(l.organisme)
    const g = parSiret.get(siret) ?? { lignes: [], organismes: new Set(), textes: [] }
    g.lignes.push(l)
    if (organisme) g.organismes.add(organisme)
    g.textes.push(l.domaine ?? "", l.meta_domaine ?? "", l.nom_qualification ?? "")
    parSiret.set(siret, g)
  }

  return [...parSiret.entries()].map(([siret, g]) => {
    const premier = <T>(f: (l: LigneRge) => T | null) =>
      g.lignes.map(f).find((v) => v !== null) ?? null
    return {
      siret,
      telephone: premier((l) => normaliserTelephone(l.telephone)),
      email: premier((l) => emailValide(l.email)),
      site_web: premier((l) => siteValide(l.site_internet)),
      specialites: detecterSpecialites(...g.textes),
      labels: ["RGE", ...[...g.organismes].sort()],
      qualifications: g.lignes.length,
    }
  })
}

/** Toutes les lignes RGE d'un département (pagination par curseur `next`). */
export async function lireRge(
  departement: string,
  fetchImpl: typeof fetch = fetch
): Promise<LigneRge[]> {
  const lignes: LigneRge[] = []
  let url: string | undefined =
    `${API}?size=1000&qs=${encodeURIComponent(`code_postal:${departement}*`)}`
  while (url) {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`ADEME RGE : HTTP ${res.status}`)
    const page = (await res.json()) as { results: LigneRge[]; next?: string }
    lignes.push(...page.results)
    url = page.results.length ? page.next : undefined
  }
  return lignes
}
