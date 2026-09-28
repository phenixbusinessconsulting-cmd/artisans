// Import d'une liste d'entreprises identifiées par SIRET (ex. liste d'entreprises certifiées) :
// une fiche existante est complétée, une entreprise absente est ajoutée depuis SIRENE si elle
// respecte les règles de l'annuaire (active, dans le département, diffusible, hors GE/ETI).

import type postgres from "postgres"
import { completerFiche, enregistrerFichesSirene } from "../stockage"
import type { EntrepriseSirene } from "../types"
import { rechercherSiret, versEntreprises, type ResultatApi } from "./recherche-entreprises"

export interface LigneListe {
  siret: string
  telephone?: string | null
  email?: string | null
  trace?: Record<string, unknown>
}

export interface OptionsImport {
  source: string // identifiant court de la source, ex. "amiante"
  departement: string
  specialites?: string[]
  metierHorsBtp?: string
  fetchImpl?: typeof fetch
}

export type ResultatImport =
  | { siret: string; statut: "completee" | "ajoutee"; siretFiche: string }
  | { siret: string; statut: "ignoree"; raison: string }

/** Pourquoi SIRENE ne donne aucune fiche pour cette entreprise (message pour le rapport). */
export function raisonExclusion(r: ResultatApi, siret: string, departement: string): string {
  if (r.statut_diffusion && r.statut_diffusion !== "O") return "diffusion restreinte (SIRENE)"
  if (r.categorie_entreprise === "GE" || r.categorie_entreprise === "ETI")
    return `grande entreprise (${r.categorie_entreprise})`
  const e = [...(r.matching_etablissements ?? []), r.siege].find((x) => x?.siret === siret)
  if (e?.etat_administratif && e.etat_administratif !== "A") return "établissement fermé"
  if (e && !e.code_postal?.startsWith(departement)) return `hors département (${e.code_postal})`
  return "non retenue par les règles de l'annuaire"
}

/**
 * Fiche SIRENE à rattacher : l'établissement de la liste s'il est actif, sinon le siège de la
 * même entreprise s'il est actif dans le département (établissement déménagé ou fermé).
 */
export function ficheDepuisSirene(
  r: ResultatApi,
  siret: string,
  departement: string,
  metierHorsBtp?: string
): EntrepriseSirene | null {
  const options = { metierHorsBtp }
  const directe = versEntreprises(r, departement, options).find((f) => f.siret === siret)
  if (directe) return directe
  return versEntreprises({ ...r, matching_etablissements: null }, departement, options)[0] ?? null
}

export async function importerListe(
  db: postgres.Sql,
  lignes: LigneListe[],
  options: OptionsImport
): Promise<ResultatImport[]> {
  const resultats: ResultatImport[] = []
  for (const l of lignes) {
    let siretFiche = l.siret
    let statut: "completee" | "ajoutee" = "completee"
    const [existe] = await db`select 1 from entreprises where siret = ${l.siret}`
    if (!existe) {
      const r = await rechercherSiret(l.siret, options.fetchImpl)
      if (!r) {
        resultats.push({ siret: l.siret, statut: "ignoree", raison: "introuvable dans SIRENE" })
        continue
      }
      const fiche = ficheDepuisSirene(r, l.siret, options.departement, options.metierHorsBtp)
      if (!fiche) {
        resultats.push({
          siret: l.siret,
          statut: "ignoree",
          raison: raisonExclusion(r, l.siret, options.departement),
        })
        continue
      }
      siretFiche = fiche.siret
      const [dejaLa] = await db`select 1 from entreprises where siret = ${fiche.siret}`
      if (!dejaLa) {
        await enregistrerFichesSirene(db, [fiche])
        statut = "ajoutee"
      }
    }
    await completerFiche(db, {
      siret: siretFiche,
      source: options.source,
      telephone: l.telephone ?? null,
      email: l.email ?? null,
      specialites: options.specialites,
      trace: { siret_liste: l.siret, ...l.trace },
    })
    resultats.push({ siret: l.siret, statut, siretFiche })
  }
  return resultats
}
