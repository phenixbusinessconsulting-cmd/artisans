// Découverte du site web d'une entreprise qui n'en a pas encore : on essaie les noms de domaine
// les plus probables (nom commercial ou raison sociale, en .fr et .com). Un site n'est retenu
// que s'il affiche le SIREN de l'entreprise (mentions légales obligatoires), ce qui écarte les
// homonymes.

import { resolve4 } from "node:dns/promises"
import type { Entreprise } from "../types"
import { analyserSite, type ResultatSite } from "./site-web"

const FORMES_JURIDIQUES = new Set([
  "sarl",
  "sas",
  "sasu",
  "eurl",
  "sa",
  "snc",
  "ei",
  "eirl",
  "ets",
  "etablissements",
  "societe",
  "ste",
])
const EXTENSIONS = [".fr", ".com"]
const MAX_CANDIDATS = 8

function mots(nom: string): string[] {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((m) => m && !FORMES_JURIDIQUES.has(m))
}

/** Noms de domaine candidats, du plus probable au moins probable. */
export function domainesCandidats(e: Pick<Entreprise, "enseigne" | "raison_sociale">): string[] {
  const domaines: string[] = []
  for (const nom of [e.enseigne, e.raison_sociale]) {
    if (!nom) continue
    const m = mots(nom)
    // Un seul mot très court (« abc ») donne trop d'homonymes pour valoir une requête.
    if (m.length === 0 || m.join("").length < 5) continue
    for (const base of [m.join("-"), m.join("")]) {
      for (const ext of EXTENSIONS) domaines.push(base + ext)
    }
  }
  return [...new Set(domaines)].slice(0, MAX_CANDIDATS)
}

async function existe(domaine: string): Promise<boolean> {
  try {
    return (await resolve4(domaine)).length > 0
  } catch {
    return false
  }
}

export interface SiteDecouvert {
  url: string
  analyse: ResultatSite
}

export async function decouvrirSite(
  e: Pick<Entreprise, "enseigne" | "raison_sociale" | "siren">,
  options: { fetchImpl?: typeof fetch; resoudre?: (domaine: string) => Promise<boolean> } = {}
): Promise<SiteDecouvert | null> {
  const resoudre = options.resoudre ?? existe
  for (const domaine of domainesCandidats(e)) {
    if (!(await resoudre(domaine))) continue
    const url = `https://www.${domaine}/`
    const analyse = await analyserSite(url, e.siren, options.fetchImpl)
    if (analyse?.sirenConfirme) return { url, analyse }
  }
  return null
}
