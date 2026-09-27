import { describe, expect, it } from "vitest"
import { nettoyerRecherche } from "@/lib/annuaire"
import { enrichir } from "@/lib/enrich"
import { correspond } from "@/lib/enrich/google-places"
import { contientSiren, texteDescriptif } from "@/lib/enrich/site-web"
import { detecterSpecialites } from "@/lib/specialites"
import type { Entreprise } from "@/lib/types"

const entreprise: Entreprise = {
  siret: "81234567800012",
  siren: "812345678",
  raison_sociale: "Plomberie Dupont",
  enseigne: null,
  naf: "43.22A",
  metier: "Plombier",
  specialites: [],
  labels: [],
  dirigeant_nom: "Jean Dupont",
  dirigeant_qualite: "Gérant",
  adresse: null,
  code_postal: "91000",
  ville: "Évry",
  latitude: 48.63,
  longitude: 2.44,
  telephone: null,
  telephone_type: null,
  telephone_source: null,
  telephone_confiance: null,
  site_web: null,
  date_creation: null,
}

function reponse(corps: string, type = "text/html") {
  return new Response(corps, { status: 200, headers: { "content-type": type } })
}

describe("detecterSpecialites", () => {
  it("reconnaît les spécialités sans tenir compte des accents", () => {
    expect(
      detecterSpecialites("Installation de POMPE A CHALEUR et rénovation de salle de bains")
    ).toEqual(["Pompe à chaleur", "Salle de bain", "Rénovation"])
  })
})

describe("site web", () => {
  it("confirme le SIREN même formaté avec des espaces", () => {
    expect(contientSiren("SIRET : 812 345 678 00012", "812345678")).toBe(true)
    expect(contientSiren("SIRET : 999 999 999", "812345678")).toBe(false)
  })

  it("extrait titres et description", () => {
    const html = `<title>Dupont</title><meta name="description" content="Chauffagiste à Évry"><h2>Dépannage</h2><p>ignoré</p>`
    expect(texteDescriptif(html)).toContain("Chauffagiste à Évry")
    expect(texteDescriptif(html)).not.toContain("ignoré")
  })
})

describe("correspond", () => {
  it("accepte une fiche Google à moins d'un kilomètre", () => {
    expect(correspond({ location: { latitude: 48.631, longitude: 2.441 } }, entreprise)).toBe(true)
    expect(correspond({ location: { latitude: 48.7, longitude: 2.44 } }, entreprise)).toBe(false)
  })
})

describe("enrichir", () => {
  it("croise Google et le site, et préfère le mobile", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes("places.googleapis.com")) {
        return reponse(
          JSON.stringify({
            places: [
              {
                displayName: { text: "Plomberie Dupont" },
                nationalPhoneNumber: "01 60 12 34 56",
                websiteUri: "https://dupont.example/",
                types: ["plumber"],
                location: { latitude: 48.6301, longitude: 2.4401 },
              },
            ],
          }),
          "application/json"
        )
      }
      if (u === "https://dupont.example/mentions-legales") {
        return reponse("<p>SIREN 812 345 678</p>")
      }
      return reponse(`<title>Plombier chauffagiste</title><a href="tel:+33612345678">Appeler</a>`)
    }) as typeof fetch

    const r = await enrichir(entreprise, { cleGoogle: "cle", fetchImpl })
    expect(r).toMatchObject({
      telephone: "0612345678",
      telephone_type: "mobile",
      telephone_source: "site",
      site_web: "https://dupont.example/",
    })
    expect(r.specialites).toContain("Chauffage")
    expect(r.sources.site_web).toMatchObject({ siren_confirme: true })
  })
})

it("nettoyerRecherche retire la syntaxe PostgREST", () => {
  expect(nettoyerRecherche("dupont,raison_sociale.eq.x)")).toBe("dupont raison_sociale.eq.x")
  expect(nettoyerRecherche(undefined)).toBe("")
})
