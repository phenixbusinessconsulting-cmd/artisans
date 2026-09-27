import { describe, expect, it } from "vitest"
import {
  candidat,
  choisirTelephone,
  extraireTelephones,
  formaterTelephone,
  normaliserTelephone,
} from "@/lib/phone"

describe("normaliserTelephone", () => {
  it.each([
    ["06 12 34 56 78", "0612345678"],
    ["06.12.34.56.78", "0612345678"],
    ["+33 6 12 34 56 78", "0612345678"],
    ["+33 (0)1 60 12 34 56", "0160123456"],
    ["0033160123456", "0160123456"],
    ["33612345678", "0612345678"],
  ])("%s → %s", (brut, attendu) => {
    expect(normaliserTelephone(brut)).toBe(attendu)
  })

  it("rejette les numéros invalides et les numéros de services 08", () => {
    expect(normaliserTelephone("12345")).toBeNull()
    expect(normaliserTelephone("0012345678")).toBeNull()
    expect(normaliserTelephone("08 92 12 34 56")).toBeNull()
    expect(normaliserTelephone(null)).toBeNull()
  })
})

describe("extraireTelephones", () => {
  it("trouve les numéros dans un texte et les dédoublonne", () => {
    const texte =
      "Appelez le 06 12 34 56 78 ou le 01.60.12.34.56 — mobile : +33 6 12 34 56 78. SIRET 12345678901234"
    expect(extraireTelephones(texte).sort()).toEqual(["0160123456", "0612345678"])
  })

  it("ne prend pas un SIRET pour un téléphone", () => {
    expect(extraireTelephones("SIRET : 81234567800012")).toEqual([])
  })
})

describe("choisirTelephone", () => {
  it("préfère un mobile à un fixe", () => {
    const t = choisirTelephone([candidat("0160123456", "google"), candidat("0612345678", "site")])
    expect(t).toMatchObject({ numero: "0612345678", type: "mobile", source: "site" })
  })

  it("augmente la confiance quand plusieurs sources concordent", () => {
    const t = choisirTelephone([
      candidat("0612345678", "google"),
      candidat("06 12 34 56 78", "site"),
    ])
    expect(t).toMatchObject({ source: "google+site", confiance: 75 })
  })

  it("renvoie null sans candidat", () => {
    expect(choisirTelephone([null, candidat("abc", "site")])).toBeNull()
  })
})

it("formaterTelephone", () => {
  expect(formaterTelephone("0612345678")).toBe("06 12 34 56 78")
})
