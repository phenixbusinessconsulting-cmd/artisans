// Lecture du site web de l'artisan : page d'accueil, contact et mentions légales.
// On y cherche les numéros de téléphone publiés, et le SIRET/SIREN pour confirmer que le site
// appartient bien à l'entreprise (les mentions légales doivent l'afficher).

import { extraireTelephones } from "../phone"

const PAGES = ["", "/contact", "/nous-contacter", "/mentions-legales"]
const DELAI_MS = 10_000
const USER_AGENT = "Annuaire-Artisans-91/1.0 (+https://artisans.monsitedemo-talens.fr/retrait)"

export interface ResultatSite {
  telephones: string[]
  sirenConfirme: boolean
  texte: string // titres et descriptions, pour la détection de spécialités
}

export function texteVisible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
}

export function texteDescriptif(html: string): string {
  const morceaux: string[] = []
  const motifs = [
    /<title[^>]*>([\s\S]*?)<\/title>/gi,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/gi,
    /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi,
  ]
  for (const motif of motifs) for (const m of html.matchAll(motif)) if (m[1]) morceaux.push(m[1])
  return texteVisible(morceaux.join(" \n "))
}

export function contientSiren(texte: string, siren: string): boolean {
  return texte.replace(/[\s. ]/g, "").includes(siren)
}

async function lire(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(DELAI_MS),
      redirect: "follow",
    })
    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function analyserSite(
  siteWeb: string,
  siren: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResultatSite | null> {
  let base: URL
  try {
    base = new URL(siteWeb)
  } catch {
    return null
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return null

  const telephones = new Set<string>()
  const descriptifs: string[] = []
  let sirenConfirme = false
  let lu = false
  for (const chemin of PAGES) {
    const html = await lire(new URL(chemin || "/", base).toString(), fetchImpl)
    if (!html) continue
    lu = true
    const texte = texteVisible(html)
    extraireTelephones(texte).forEach((t) => telephones.add(t))
    // Les liens tel: sont la source la plus fiable sur un site.
    for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
      extraireTelephones(decodeURIComponent(m[1] ?? "")).forEach((t) => telephones.add(t))
    }
    if (contientSiren(texte, siren)) sirenConfirme = true
    descriptifs.push(texteDescriptif(html))
  }
  if (!lu) return null
  return { telephones: [...telephones], sirenConfirme, texte: descriptifs.join(" \n ") }
}
