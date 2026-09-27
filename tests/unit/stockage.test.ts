// Tests contre une vraie base PostgreSQL : lancés seulement si TEST_DATABASE_URL est défini
// (base de test jetable, avec db/001_entreprises.sql appliqué).

import { afterAll, beforeEach, describe, expect, it } from "vitest"
import postgres from "postgres"
import { lireEntreprise, rechercherEntreprises } from "@/lib/annuaire"
import { fermer } from "@/lib/db"
import type { Enrichissement } from "@/lib/enrich"
import {
  enregistrerEnrichissement,
  enregistrerFichesSirene,
  enregistrerVerifications,
  fichesAEnrichir,
  fichesAVerifier,
  masquerFiche,
} from "@/lib/stockage"
import type { EntrepriseSirene } from "@/lib/types"

const url = process.env.TEST_DATABASE_URL

const fiche: EntrepriseSirene = {
  siret: "81234567800012",
  siren: "812345678",
  raison_sociale: "Plomberie Dupont",
  enseigne: null,
  naf: "43.22A",
  metier: "Plombier",
  labels: ["RGE"],
  dirigeant_nom: "Jean Dupont",
  dirigeant_qualite: "Gérant",
  adresse: "12 rue de la Gare",
  code_postal: "91000",
  ville: "Évry",
  latitude: 48.63,
  longitude: 2.44,
  date_creation: "2015-03-01",
}

const enrichissement: Enrichissement = {
  telephone: "0612345678",
  telephone_type: "mobile",
  telephone_source: "google+site",
  telephone_confiance: 75,
  site_web: "https://dupont.example/",
  specialites: ["Chauffage", "Salle de bain"],
  sources: { google_places: { trouve: true } },
}

describe.skipIf(!url)("stockage PostgreSQL", () => {
  const db = postgres(url ?? "", { max: 1, onnotice: () => {} })

  beforeEach(async () => {
    await db`truncate entreprises, demandes_retrait`
  })
  afterAll(async () => {
    await db.end()
    await fermer()
  })

  it("importe, enrichit, puis réimporte sans perdre l'enrichissement", async () => {
    await enregistrerFichesSirene(db, [fiche])
    const [aEnrichir] = await fichesAEnrichir(db, 10)
    expect(aEnrichir).toMatchObject({ siret: fiche.siret, specialites: [], labels: ["RGE"] })

    await enregistrerEnrichissement(db, aEnrichir!, enrichissement)
    await enregistrerFichesSirene(db, [{ ...fiche, raison_sociale: "Dupont Plomberie" }])

    const [e] = await db`select * from entreprises`
    expect(e).toMatchObject({
      raison_sociale: "Dupont Plomberie",
      telephone: "0612345678",
      telephone_type: "mobile",
      specialites: ["Chauffage", "Salle de bain"],
      masque: false,
    })
    expect(e!.sources).toMatchObject({ google_places: { trouve: true } })
  })

  it("garde l'ancien téléphone si l'enrichissement n'en trouve pas", async () => {
    await enregistrerFichesSirene(db, [fiche])
    const [premiere] = await fichesAEnrichir(db, 10)
    await enregistrerEnrichissement(db, premiere!, enrichissement)
    const [seconde] = await fichesAEnrichir(db, 10)
    await enregistrerEnrichissement(db, seconde!, {
      ...enrichissement,
      telephone: null,
      telephone_type: null,
      telephone_source: null,
      telephone_confiance: null,
    })
    const [e] = await db`select telephone from entreprises`
    expect(e!.telephone).toBe("0612345678")
  })

  it("masque la fiche et la réimport ne la réaffiche pas", async () => {
    await enregistrerFichesSirene(db, [fiche])
    await masquerFiche(db, { siret: fiche.siret, email: "a@b.fr" })
    await enregistrerFichesSirene(db, [fiche])
    const [e] = await db`select masque from entreprises`
    expect(e!.masque).toBe(true)
    expect(await fichesAEnrichir(db, 10)).toHaveLength(0)
    const demandes = await db`select siret, email from demandes_retrait`
    expect(demandes).toEqual([{ siret: fiche.siret, email: "a@b.fr" }])
  })

  it("recherche publique : filtres, pagination et fiches masquées exclues", async () => {
    process.env.DATABASE_URL = url
    const autre = {
      ...fiche,
      siret: "90000000000011",
      siren: "900000000",
      raison_sociale: "Toitures Martin",
      dirigeant_nom: "Paul Martin",
      naf: "43.91B",
      metier: "Couvreur",
      ville: "Massy",
      code_postal: "91300",
    }
    await enregistrerFichesSirene(db, [fiche, autre])
    const [aEnrichir] = await fichesAEnrichir(db, 1)
    await enregistrerEnrichissement(db, aEnrichir!, enrichissement)

    expect((await rechercherEntreprises({})).total).toBe(2)
    expect(
      (await rechercherEntreprises({ metier: "Couvreur" })).entreprises.map((e) => e.siret)
    ).toEqual([autre.siret])
    expect((await rechercherEntreprises({ ville: "913" })).total).toBe(1)
    expect((await rechercherEntreprises({ ville: "evry" })).total).toBe(1) // sans accent : Évry
    expect((await rechercherEntreprises({ q: "dupont" })).total).toBe(1)
    expect((await rechercherEntreprises({ specialite: "Chauffage" })).total).toBe(1)
    expect((await rechercherEntreprises({ page: 2 })).entreprises).toEqual([])

    const e = await lireEntreprise(fiche.siret)
    expect(e).toMatchObject({ date_creation: "2015-03-01", labels: ["RGE"], latitude: 48.63 })

    await masquerFiche(db, { siret: fiche.siret, email: "a@b.fr" })
    expect(await lireEntreprise(fiche.siret)).toBeNull()
    expect((await rechercherEntreprises({})).total).toBe(1)
  })

  it("fusionne les vérifications par source et priorise les fiches jamais vérifiées", async () => {
    const autre = { ...fiche, siret: "90000000000011", siren: "900000000" }
    await enregistrerFichesSirene(db, [fiche, autre])
    const date = "2026-09-27T16:40:00.000Z"
    await enregistrerVerifications(db, fiche.siret, {
      qualibat: { statut: "absente", verifie_le: date },
    })
    await enregistrerVerifications(db, fiche.siret, {
      monartisan: { statut: "concorde", verifie_le: date },
    })

    const [e] = await db`select verifications from entreprises where siret = ${fiche.siret}`
    expect(e!.verifications).toEqual({
      qualibat: { statut: "absente", verifie_le: date },
      monartisan: { statut: "concorde", verifie_le: date },
    })
    expect((await fichesAVerifier(db, 1))[0]!.siret).toBe(autre.siret)
  })
})
