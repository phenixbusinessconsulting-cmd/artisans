"use server"

import { estAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { enregistrerCommentaire, marquerContacte, type Suivi } from "@/lib/suivi"

async function verifier(siret: string) {
  if (!(await estAdmin())) throw new Error("Accès réservé à l'administrateur")
  if (!/^\d{14}$/.test(siret)) throw new Error("SIRET invalide")
}

export async function basculerContacte(siret: string, contacte: boolean): Promise<Suivi> {
  await verifier(siret)
  return marquerContacte(sql(), siret, contacte)
}

export async function sauverCommentaire(siret: string, commentaire: string): Promise<Suivi> {
  await verifier(siret)
  return enregistrerCommentaire(sql(), siret, commentaire)
}
