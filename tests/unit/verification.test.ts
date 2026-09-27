import { describe, expect, it } from "vitest"
import type { Entreprise } from "@/lib/types"
import { comparer, contientNom, Verificateur } from "@/lib/verification"
import { estAutorise, lireRobots } from "@/lib/verification/robots"
import type { SourceVerification } from "@/lib/verification/sources"

const e: Entreprise = {
  siret: "81234567800012",
  siren: "812345678",
  raison_sociale: "Plomberie Dupont",
  enseigne: null,
  naf: "43.22A",
  metier: "Plombier",
  specialites: [],
  labels: [],
  dirigeant_nom: "Jean Dupont",
  dirigeant_qualite: null,
  adresse: null,
  code_postal: "91000",
  ville: "Évry",
  latitude: null,
  longitude: null,
  telephone: "0612345678",
  telephone_type: "mobile",
  telephone_source: "google",
  telephone_confiance: 50,
  site_web: null,
  date_creation: null,
}

describe("robots.txt", () => {
  const regles = lireRobots(`
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /*?sort=
Allow: /admin/public
`)

  it("n'applique que le groupe User-agent: *", () => {
    expect(estAutorise(regles, "/")).toBe(true)
    expect(estAutorise(regles, "/?q=81234567800012")).toBe(true)
  })

  it("gère Disallow, Allow plus précis et jokers", () => {
    expect(estAutorise(regles, "/admin/x")).toBe(false)
    expect(estAutorise(regles, "/admin/public/page")).toBe(true)
    expect(estAutorise(regles, "/liste?sort=nom")).toBe(false)
  })

  it("un Disallow vide autorise tout", () => {
    expect(estAutorise(lireRobots("User-agent: *\nDisallow:"), "/tout")).toBe(true)
  })
})

describe("comparer", () => {
  it("concorde quand la fiche et notre téléphone y figurent", () => {
    expect(comparer("<h2>PLOMBERIE DUPONT</h2><p>06 12 34 56 78</p>", e)).toBe("concorde")
  })

  it("signale un téléphone différent", () => {
    expect(comparer("<h2>Plomberie Dupont</h2><p>01 60 00 00 00</p>", e)).toBe(
      "telephone_different"
    )
  })

  it("reconnaît le SIREN même sans le nom", () => {
    expect(comparer("<p>SIREN 812 345 678</p>", e)).toBe("trouvee")
  })

  it("ignore le texte recherché répété par la page de résultats", () => {
    const page = "<h1>Résultats pour : Plomberie Dupont</h1><p>Aucun résultat</p>"
    expect(comparer(page, e)).toBe("trouvee")
    expect(comparer(page, e, "Plomberie Dupont")).toBe("absente")
    expect(
      comparer(`${page}<h2>Plomberie Dupont</h2><p>06 12 34 56 78</p>`, e, "Plomberie Dupont")
    ).toBe("concorde")
  })

  it("absente si ni le nom ni le SIREN", () => {
    expect(comparer("<p>Plomberie Martin 06 12 34 56 78</p>", e)).toBe("absente")
  })

  it("contientNom ignore les accents, la casse et les formes juridiques", () => {
    expect(contientNom("SARL Élec-Tricité Évry", "Electricite Evry SARL")).toBe(false)
    expect(contientNom("SARL Électricité d'Évry", "Electricite Evry SARL")).toBe(true)
  })
})

describe("Verificateur", () => {
  const source: SourceVerification = {
    id: "test",
    nom: "test",
    url: (x) => `https://annuaire.example/recherche?q=${x.siret}`,
  }

  function fetchSimule(robots: string, page: string) {
    const appels: string[] = []
    const impl = (async (url: string | URL | Request) => {
      appels.push(String(url))
      const corps = String(url).endsWith("/robots.txt") ? robots : page
      return new Response(corps, { status: 200 })
    }) as typeof fetch
    return { impl, appels }
  }

  it("respecte robots.txt sans télécharger la page interdite", async () => {
    const { impl, appels } = fetchSimule("User-agent: *\nDisallow: /recherche", "")
    const r = await new Verificateur(impl, 0).verifier(e, [source])
    expect(r.test?.statut).toBe("interdit")
    expect(appels).toEqual(["https://annuaire.example/robots.txt"])
  })

  it("vérifie la page autorisée et lit robots.txt une seule fois", async () => {
    const { impl, appels } = fetchSimule("", "<p>Plomberie Dupont — 06 12 34 56 78</p>")
    const v = new Verificateur(impl, 0)
    expect((await v.verifier(e, [source])).test?.statut).toBe("concorde")
    await v.verifier(e, [source])
    expect(appels.filter((a) => a.endsWith("robots.txt"))).toHaveLength(1)
  })

  it("arrête de solliciter un site qui répond 429", async () => {
    const appels: string[] = []
    const impl = (async (url: string | URL | Request) => {
      appels.push(String(url))
      if (String(url).endsWith("/robots.txt")) return new Response("")
      return new Response("", { status: 429 })
    }) as typeof fetch
    const v = new Verificateur(impl, 0)
    expect(await v.verifier(e, [source])).toEqual({})
    expect(await v.verifier(e, [source])).toEqual({})
    expect(appels.filter((a) => !a.endsWith("robots.txt"))).toHaveLength(1)
  })

  it("ignore une source qui ne s'applique pas", async () => {
    const { impl } = fetchSimule("", "")
    const r = await new Verificateur(impl, 0).verifier(e, [{ ...source, url: () => null }])
    expect(r).toEqual({})
  })
})
