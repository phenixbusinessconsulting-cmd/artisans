"use server"

import { z } from "zod"
import { clientAdmin } from "@/lib/supabase/clients"

export interface EtatRetrait {
  statut: "initial" | "ok" | "erreur"
  message?: string
}

const Demande = z.object({
  siret: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{14}$/, "Le SIRET doit comporter 14 chiffres.")),
  email: z.email("Adresse e-mail invalide."),
  motif: z.string().max(1000).optional(),
})

/**
 * Droit d'opposition (RGPD art. 21) : la fiche est masquée immédiatement,
 * la demande est conservée pour vérification et suivi.
 */
export async function demanderRetrait(_: EtatRetrait, formData: FormData): Promise<EtatRetrait> {
  // Champ piège invisible : rempli uniquement par les robots.
  if (formData.get("site")) return { statut: "ok" }

  const resultat = Demande.safeParse({
    siret: formData.get("siret") ?? "",
    email: formData.get("email") ?? "",
    motif: formData.get("motif") || undefined,
  })
  if (!resultat.success) {
    return { statut: "erreur", message: resultat.error.issues[0]?.message ?? "Demande invalide." }
  }

  const db = clientAdmin()
  const { siret, email, motif } = resultat.data
  const { error } = await db.from("demandes_retrait").insert({ siret, email, motif })
  if (error) return { statut: "erreur", message: "La demande n'a pas pu être enregistrée." }
  await db.from("entreprises").update({ masque: true }).eq("siret", siret)

  return { statut: "ok" }
}
