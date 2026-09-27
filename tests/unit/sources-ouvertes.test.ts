import { describe, expect, it } from "vitest"
import { candidatsExistants, choisirTelephone, candidat } from "@/lib/phone"
import { labelOrganisme, lireRge, regrouperParSiret } from "@/lib/sources/ademe-rge"
import { liquidations } from "@/lib/sources/bodacc"
import { rapprocher, versLieux } from "@/lib/sources/osm"

describe("ADEME RGE", () => {
  // Lignes au format réel de l'API (relevé le 27/09/2026).
  const lignes = [
    {
      siret: "81234567800012",
      nom_entreprise: "PLOMBERIE DUPONT",
      telephone: "06 12 34 56 78",
      email: "Contact@Dupont.fr",
      site_internet: "www.dupont.fr",
      domaine: "Pompe à chaleur : chauffage",
      meta_domaine: "Travaux d'efficacité énergétique",
      organisme: "qualitenr",
      nom_qualification: "QualiPAC",
      lien_date_fin: "2099-01-01",
    },
    {
      siret: "81234567800012",
      telephone: "",
      domaine: "Isolation des murs par l'extérieur",
      organisme: "qualibat",
      lien_date_fin: "2099-01-01",
    },
    {
      siret: "82834693200019",
      nom_entreprise: "AGENCE COOS GARNIER",
      telephone: "06 69 58 26 06",
      domaine: "Architecte",
      organisme: "cnoa",
      lien_date_fin: "2099-01-01",
    },
    {
      siret: "90000000000011",
      telephone: "01 60 00 00 00",
      domaine: "Chaudière condensation",
      organisme: "qualibat",
      lien_date_fin: "2020-01-01",
    },
  ]

  it("regroupe par SIRET, exclut architectes et qualifications expirées", () => {
    const fiches = regrouperParSiret(lignes, new Date("2026-09-27"))
    expect(fiches).toHaveLength(1)
    expect(fiches[0]).toEqual({
      siret: "81234567800012",
      telephone: "0612345678",
      email: "contact@dupont.fr",
      site_web: "https://www.dupont.fr/",
      specialites: ["Pompe à chaleur", "Chauffage", "Isolation"],
      labels: ["RGE", "Qualibat", "Qualit'EnR"],
      qualifications: 2,
    })
  })

  it("labelOrganisme", () => {
    expect(labelOrganisme("qualitenr")).toBe("Qualit'EnR")
    expect(labelOrganisme("Non renseigné")).toBeNull()
    expect(labelOrganisme(null)).toBeNull()
  })

  it("suit la pagination par curseur", async () => {
    const pages: Record<string, unknown> = {
      premiere: { results: [{ siret: "1" }], next: "https://suite" },
      "https://suite": { results: [{ siret: "2" }], next: "https://fin" },
      "https://fin": { results: [] },
    }
    const fetchImpl = (async (url: string | URL | Request) => {
      const cle = String(url).startsWith("https://data.ademe.fr") ? "premiere" : String(url)
      return new Response(JSON.stringify(pages[cle]))
    }) as typeof fetch
    expect((await lireRge("91", fetchImpl)).map((l) => l.siret)).toEqual(["1", "2"])
  })
})

describe("OpenStreetMap", () => {
  const lieux = versLieux([
    {
      lat: 48.63,
      lon: 2.44,
      tags: { name: "Plomberie Dupont", phone: "+33 1 60 12 34 56;+33 6 12 34 56 78" },
    },
    { center: { lat: 48.7, lon: 2.3 }, tags: { name: "X", "ref:FR:SIRET": "900 000 000 00011" } },
  ])
  const fiches = [
    {
      siret: "81234567800012",
      raison_sociale: "Plomberie Dupont",
      enseigne: null,
      latitude: 48.6301,
      longitude: 2.4401,
    },
    {
      siret: "90000000000011",
      raison_sociale: "Toitures Martin",
      enseigne: null,
      latitude: 48.7,
      longitude: 2.3,
    },
  ]

  it("lit les tags et préfère le portable", () => {
    expect(lieux[0]).toMatchObject({ telephone: "0612345678", lat: 48.63 })
    expect(lieux[1]).toMatchObject({ siret: "90000000000011", lat: 48.7, lon: 2.3 })
  })

  it("rapproche par SIRET, sinon par nom à moins de 300 m", () => {
    expect(rapprocher(lieux[0]!, fiches)).toBe("81234567800012")
    expect(rapprocher(lieux[1]!, fiches)).toBe("90000000000011")
    const loin = { ...lieux[0]!, lat: 48.7 }
    expect(rapprocher(loin, fiches)).toBeNull()
  })
})

describe("BODACC", () => {
  const annonce = (nature: string, date: string, registre = ["812 345 678", "812345678"]) => ({
    registre,
    dateparution: date,
    jugement: JSON.stringify({ nature }),
  })

  it("retient la dernière liquidation par SIREN et ignore les redressements", () => {
    const r = liquidations([
      annonce("Jugement d'ouverture d'une procédure de redressement judiciaire", "2025-01-10"),
      annonce("Jugement de conversion en liquidation judiciaire", "2025-06-01"),
      annonce("Jugement de clôture pour insuffisance d'actif", "2026-02-01"),
      annonce("Jugement d'ouverture d'une procédure de sauvegarde", "2026-03-01", ["900000000"]),
      { registre: ["111111111"], dateparution: "2026-01-01", jugement: "pas du json" },
    ])
    expect([...r.entries()]).toEqual([["812345678", "2026-02-01"]])
  })
})

it("candidatsExistants et choisirTelephone : une source confirmant l'existant augmente la confiance", () => {
  const existants = candidatsExistants("0612345678", "google+site", ["site"])
  expect(existants.map((c) => c.source)).toEqual(["google"])
  const t = choisirTelephone([...existants, candidat("06 12 34 56 78", "ademe")])
  expect(t).toMatchObject({ numero: "0612345678", source: "ademe+google", confiance: 75 })
})
