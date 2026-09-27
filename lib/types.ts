import type { TypeTelephone } from "./phone"

/** Une fiche de l'annuaire = un établissement (SIRET). Correspond à la table `entreprises`. */
export interface Entreprise {
  siret: string
  siren: string
  raison_sociale: string
  enseigne: string | null
  naf: string
  metier: string
  specialites: string[]
  labels: string[]
  dirigeant_nom: string | null
  dirigeant_qualite: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  latitude: number | null
  longitude: number | null
  telephone: string | null
  telephone_type: TypeTelephone | null
  telephone_source: string | null
  telephone_confiance: number | null
  site_web: string | null
  date_creation: string | null
  /** Suivi de prospection : renseigné uniquement pour l'administrateur. */
  contacte?: boolean
}

/** Champs issus des registres officiels, écrits par l'ingestion. */
export type EntrepriseSirene = Pick<
  Entreprise,
  | "siret"
  | "siren"
  | "raison_sociale"
  | "enseigne"
  | "naf"
  | "metier"
  | "labels"
  | "dirigeant_nom"
  | "dirigeant_qualite"
  | "adresse"
  | "code_postal"
  | "ville"
  | "latitude"
  | "longitude"
  | "date_creation"
>
