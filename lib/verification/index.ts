// Contrôle croisé d'une fiche sur les annuaires tiers.
// Seul le résultat de la comparaison est conservé (présence du nom, du SIREN, concordance du
// téléphone), jamais le contenu des pages consultées.

import { extraireTelephones } from "../phone"
import { contientSiren, texteVisible } from "../enrich/site-web"
import type { Entreprise } from "../types"
import { estAutorise, lireRobots, type Regle } from "./robots"
import { SOURCES_VERIFICATION, type SourceVerification } from "./sources"

const USER_AGENT = "Annuaire-Artisans-91/1.0 (+https://artisans.monsitedemo-talens.fr/retrait)"
const DELAI_MS = 15_000

export type StatutVerification =
  | "concorde" // fiche trouvée, notre téléphone y figure
  | "telephone_different" // fiche trouvée, d'autres numéros mais pas le nôtre
  | "trouvee" // fiche trouvée, pas de téléphone comparable
  | "absente" // aucune trace de l'entreprise
  | "interdit" // page exclue par robots.txt
  | "erreur" // site injoignable ou page refusée

export interface Verification {
  statut: StatutVerification
  verifie_le: string
}

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Le nom est présent si tous ses mots significatifs (3 lettres et plus) figurent dans la page. */
export function contientNom(texte: string, nom: string): boolean {
  const page = ` ${normaliser(texte)} `
  const mots = normaliser(nom)
    .split(" ")
    .filter(
      (m) => m.length >= 3 && !["sarl", "sas", "sasu", "eurl", "ets", "entreprise"].includes(m)
    )
  return mots.length > 0 && mots.every((m) => page.includes(` ${m} `))
}

export function comparer(html: string, e: Entreprise, recherche?: string): StatutVerification {
  const texte = texteVisible(html)
  const telephones = extraireTelephones(texte)
  const avecSiren = contientSiren(texte, e.siren)
  if (recherche && !avecSiren) {
    // La page répète le nom cherché (« Résultats pour … ») : sa présence ne prouve rien.
    // Seul notre téléphone dans les résultats vaut confirmation.
    return e.telephone && telephones.includes(e.telephone) ? "concorde" : "absente"
  }
  const trouvee =
    avecSiren ||
    contientNom(texte, e.raison_sociale) ||
    (!!e.enseigne && contientNom(texte, e.enseigne))
  if (!trouvee) return "absente"
  if (e.telephone && telephones.includes(e.telephone)) return "concorde"
  if (e.telephone && telephones.length > 0) return "telephone_different"
  return "trouvee"
}

export class Verificateur {
  private robots = new Map<string, Promise<Regle[]>>()
  private dernierAppel = new Map<string, number>()
  /** Sites qui ont demandé de ralentir (HTTP 429) : plus sollicités pendant cette exécution. */
  readonly sitesSatures = new Set<string>()

  constructor(
    private fetchImpl: typeof fetch = fetch,
    private pauseParSiteMs = 2_000
  ) {}

  private reglesPour(origine: string): Promise<Regle[]> {
    let r = this.robots.get(origine)
    if (!r) {
      r = this.lire(`${origine}/robots.txt`)
        .then((t) => lireRobots(t ?? ""))
        .catch(() => [])
      this.robots.set(origine, r)
    }
    return r
  }

  private async lire(url: string): Promise<string | null> {
    const res = await this.fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(DELAI_MS),
      redirect: "follow",
    })
    if (res.status === 429) {
      this.sitesSatures.add(new URL(url).host)
      return null
    }
    return res.ok ? res.text() : null
  }

  /** Espace les requêtes vers un même site. */
  private async patienter(hote: string, pauseMs: number) {
    const attente = (this.dernierAppel.get(hote) ?? 0) + pauseMs - Date.now()
    if (attente > 0) await new Promise((r) => setTimeout(r, attente))
    this.dernierAppel.set(hote, Date.now())
  }

  async verifierSource(source: SourceVerification, e: Entreprise): Promise<Verification | null> {
    const adresse = source.url(e)
    if (!adresse) return null
    const url = new URL(adresse)
    if (this.sitesSatures.has(url.host)) return null
    const maintenant = () => new Date().toISOString()
    if (!estAutorise(await this.reglesPour(url.origin), url.pathname + url.search)) {
      return { statut: "interdit", verifie_le: maintenant() }
    }
    await this.patienter(url.host, source.pauseMs ?? this.pauseParSiteMs)
    try {
      const html = await this.lire(url.toString())
      // Site saturé : aucun statut, la fiche sera vérifiée lors d'une prochaine exécution.
      if (this.sitesSatures.has(url.host)) return null
      if (html === null) return { statut: "erreur", verifie_le: maintenant() }
      return { statut: comparer(html, e, source.recherche?.(e)), verifie_le: maintenant() }
    } catch {
      return { statut: "erreur", verifie_le: maintenant() }
    }
  }

  async verifier(
    e: Entreprise,
    sources = SOURCES_VERIFICATION
  ): Promise<Record<string, Verification>> {
    const resultats: Record<string, Verification> = {}
    for (const source of sources) {
      const v = await this.verifierSource(source, e)
      if (v) resultats[source.id] = v
    }
    return resultats
  }
}
