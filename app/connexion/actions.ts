"use server"

import { redirect } from "next/navigation"
import { fermerSession, motDePasseValide, ouvrirSession } from "@/lib/admin"

export interface EtatConnexion {
  erreur?: string
}

export async function seConnecter(_: EtatConnexion, formData: FormData): Promise<EtatConnexion> {
  const saisi = String(formData.get("motDePasse") ?? "")
  if (!motDePasseValide(saisi)) {
    // Ralentit les essais en série.
    await new Promise((r) => setTimeout(r, 1000))
    return { erreur: "Mot de passe incorrect." }
  }
  await ouvrirSession()
  redirect("/")
}

export async function seDeconnecter() {
  await fermerSession()
  redirect("/")
}
