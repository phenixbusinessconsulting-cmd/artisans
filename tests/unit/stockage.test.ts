// Tests contre une vraie base PostgreSQL : lancés seulement si TEST_DATABASE_URL est défini
// (base de test jetable, avec db/001_entreprises.sql appliqué).

import { afterAll, beforeEach, describe, expect, it } from "vitest"
import postgres from "postgres"
import { lireEntreprise, rechercherEntreprises } from "@/lib/annuaire"
import { fermer } from "@/lib/db"
import type { Enrichissement } from "@/lib/enrich"
import {
  completerFiche,
  enregistrerEnrichissement,
  enregistrerLiquidations,
  enregistrerFichesSirene,
  enregistrerVerifications,
  fichesAEnrichir,
  fichesAVerifier,
  masquerFiche,
} from "@/lib/stockage"
import { enregistrerCommentaire, lireSuivi, marquerContacte, SUIVI_VIDE } from "@/lib/suivi"
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
    await db`truncate entreprises, demandes_retrait, suivi_prospection`
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
    expect(
      (await rechercherEntreprises({ telephone: "oui" })).entreprises.map((e) => e.siret)
    ).toEqual([fiche.siret])
    expect((await rechercherEntreprises({ telephone: "mobile" })).total).toBe(1)
    expect((await rechercherEntreprises({ telephone: "oui", metier: "Couvreur" })).total).toBe(0)
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

  it("complète une fiche : téléphone mis en concurrence, labels ajoutés, site conservé", async () => {
    process.env.DATABASE_URL = url
    await enregistrerFichesSirene(db, [fiche])
    const [aEnrichir] = await fichesAEnrichir(db, 1)
    await enregistrerEnrichissement(db, aEnrichir!, {
      ...enrichissement,
      telephone: "0160123456",
      telephone_type: "fixe",
      telephone_source: "google",
      telephone_confiance: 50,
    })

    await completerFiche(db, {
      siret: fiche.siret,
      source: "ademe",
      telephone: "0612345678",
      site_web: "https://autre.example/",
      email: "contact@dupont.fr",
      specialites: ["Isolation"],
      labels: ["RGE", "Qualibat"],
      trace: { qualifications: 2 },
    })
    // Réexécution : pas de doublon de source ni de label.
    await completerFiche(db, {
      siret: fiche.siret,
      source: "ademe",
      telephone: "0612345678",
      labels: ["RGE", "Qualibat"],
      trace: {},
    })
    // Un enrichissement ultérieur sans téléphone ne fait pas perdre celui de l'ADEME.
    const [ensuite] = await fichesAEnrichir(db, 1)
    await enregistrerEnrichissement(db, ensuite!, {
      ...enrichissement,
      telephone: null,
      telephone_type: null,
      telephone_source: null,
      telephone_confiance: null,
    })

    const [e] = await db`select * from entreprises where siret = ${fiche.siret}`
    expect(e).toMatchObject({
      telephone: "0612345678",
      telephone_type: "mobile",
      telephone_source: "ademe",
      site_web: "https://dupont.example/",
      email: "contact@dupont.fr",
      labels: ["Qualibat", "RGE"],
    })
    expect(e!.specialites).toEqual(expect.arrayContaining(["Chauffage", "Isolation"]))
    expect(e!.sources).toHaveProperty("ademe")
    expect(
      await completerFiche(db, {
        siret: "00000000000000",
        source: "osm",
        telephone: null,
        trace: {},
      })
    ).toBe(false)
  })

  it("retire les entreprises en liquidation de l'annuaire public", async () => {
    process.env.DATABASE_URL = url
    await enregistrerFichesSirene(db, [fiche])
    expect(await enregistrerLiquidations(db, new Map([[fiche.siren, "2026-02-01"]]))).toBe(1)
    expect(await lireEntreprise(fiche.siret)).toBeNull()
    expect((await rechercherEntreprises({})).total).toBe(0)
    expect(await fichesAEnrichir(db, 10)).toHaveLength(0)
    // Une liquidation qui n'apparaît plus (annulée, hors fenêtre) est levée.
    expect(await enregistrerLiquidations(db, new Map())).toBe(0)
    expect(await lireEntreprise(fiche.siret)).not.toBeNull()
  })

  it("suivi de prospection : contacté, commentaire, réservé à l'administrateur", async () => {
    process.env.DATABASE_URL = url
    const autre = { ...fiche, siret: "90000000000011", siren: "900000000", raison_sociale: "Autre" }
    await enregistrerFichesSirene(db, [fiche, autre])
    expect(await lireSuivi(db, fiche.siret)).toEqual(SUIVI_VIDE)

    const s1 = await marquerContacte(db, fiche.siret, true)
    expect(s1.contacte).toBe(true)
    expect(s1.contacte_le).not.toBeNull()
    const s2 = await enregistrerCommentaire(db, fiche.siret, "  Rappeler lundi  ")
    expect(s2).toMatchObject({ contacte: true, commentaire: "Rappeler lundi" })
    // Un commentaire sur une fiche jamais contactée crée le suivi sans la marquer.
    expect(await enregistrerCommentaire(db, autre.siret, "Pas de réponse")).toMatchObject({
      contacte: false,
      commentaire: "Pas de réponse",
    })

    // Public : aucune information de suivi, et le filtre est ignoré.
    const publique = await rechercherEntreprises({ suivi: "contacte" })
    expect(publique.total).toBe(2)
    expect(publique.entreprises.every((e) => e.contacte === undefined)).toBe(true)
    // Administrateur : badge et filtres.
    const contactes = await rechercherEntreprises({ suivi: "contacte" }, { admin: true })
    expect(contactes.entreprises.map((e) => [e.siret, e.contacte])).toEqual([[fiche.siret, true]])
    const aContacter = await rechercherEntreprises({ suivi: "a_contacter" }, { admin: true })
    expect(aContacter.entreprises.map((e) => e.siret)).toEqual([autre.siret])

    const s3 = await marquerContacte(db, fiche.siret, false)
    expect(s3).toMatchObject({ contacte: false, contacte_le: null, commentaire: "Rappeler lundi" })
  })
})
