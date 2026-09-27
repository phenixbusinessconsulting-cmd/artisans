import { describe, expect, it } from "vitest"
import {
  urlRecherche,
  versEntreprises,
  type ResultatApi,
} from "@/lib/sources/recherche-entreprises"

const base: ResultatApi = {
  siren: "812345678",
  nom_complet: "PLOMBERIE DUPONT",
  nom_raison_sociale: "PLOMBERIE DUPONT",
  categorie_entreprise: "PME",
  statut_diffusion: "O",
  dirigeants: [
    { type_dirigeant: "personne morale", nom: null },
    {
      type_dirigeant: "personne physique",
      nom: "DUPONT",
      prenoms: "JEAN PIERRE",
      qualite: "GERANT",
    },
  ],
  matching_etablissements: [
    {
      siret: "81234567800012",
      adresse: "12 RUE DE LA GARE 91000 EVRY-COURCOURONNES",
      code_postal: "91000",
      libelle_commune: "EVRY-COURCOURONNES",
      latitude: "48.63",
      longitude: "2.44",
      activite_principale: "43.22A",
      etat_administratif: "A",
      liste_enseignes: ["DUPONT CHAUFFAGE"],
    },
    {
      siret: "81234567800020",
      code_postal: "75011",
      activite_principale: "43.22A",
      etat_administratif: "A",
    },
  ],
  complements: { est_rge: true },
}

describe("versEntreprises", () => {
  it("produit une fiche par établissement actif du département", () => {
    const fiches = versEntreprises(base, "91")
    expect(fiches).toHaveLength(1)
    expect(fiches[0]).toMatchObject({
      siret: "81234567800012",
      siren: "812345678",
      raison_sociale: "Plomberie Dupont",
      enseigne: "Dupont Chauffage",
      metier: "Plombier",
      labels: ["RGE"],
      dirigeant_nom: "Jean Dupont",
      dirigeant_qualite: "Gerant",
      ville: "Evry-Courcouronnes",
      latitude: 48.63,
      longitude: 2.44,
    })
  })

  it("utilise l'entrepreneur comme décideur d'une entreprise individuelle", () => {
    const [fiche] = versEntreprises(
      {
        ...base,
        nom_raison_sociale: "MARTIN PAUL",
        dirigeants: [],
        complements: { est_entrepreneur_individuel: true },
      },
      "91"
    )
    expect(fiche).toMatchObject({
      dirigeant_nom: "Martin Paul",
      dirigeant_qualite: "Entrepreneur individuel",
    })
  })

  it("exclut les entreprises en diffusion partielle", () => {
    expect(versEntreprises({ ...base, statut_diffusion: "P" }, "91")).toEqual([])
    expect(versEntreprises({ ...base, nom_complet: "[NON-DIFFUSIBLE]" }, "91")).toEqual([])
  })

  it("exclut les grandes entreprises, les établissements fermés et les activités hors bâtiment", () => {
    expect(versEntreprises({ ...base, categorie_entreprise: "GE" }, "91")).toEqual([])
    const [etab] = base.matching_etablissements!
    expect(
      versEntreprises(
        { ...base, matching_etablissements: [{ ...etab!, etat_administratif: "F" }] },
        "91"
      )
    ).toEqual([])
    expect(
      versEntreprises(
        { ...base, matching_etablissements: [{ ...etab!, activite_principale: "56.10A" }] },
        "91"
      )
    ).toEqual([])
  })
})

it("urlRecherche filtre par code postal quand il est fourni", () => {
  const url = new URL(
    urlRecherche({ departement: "91", naf: "43.22A", codePostal: "91000", page: 2 })
  )
  expect(url.searchParams.get("code_postal")).toBe("91000")
  expect(url.searchParams.get("departement")).toBeNull()
  expect(url.searchParams.get("activite_principale")).toBe("43.22A")
  expect(url.searchParams.get("page")).toBe("2")
})
