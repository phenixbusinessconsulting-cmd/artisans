// Mode administrateur : un mot de passe (ADMIN_PASSWORD, au moins 12 caractères) ouvre une session
// par cookie. Le cookie contient une empreinte HMAC du mot de passe : changer le mot de passe
// invalide toutes les sessions.

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const COOKIE = "artisans_admin"
const DUREE_S = 30 * 24 * 3600

function motDePasse(): string | null {
  const mdp = process.env.ADMIN_PASSWORD
  return mdp && mdp.length >= 12 ? mdp : null
}

function jeton(mdp: string): string {
  return createHmac("sha256", mdp).update("artisans-admin-v1").digest("hex")
}

function egaux(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function adminConfigure(): boolean {
  return motDePasse() !== null
}

export function motDePasseValide(saisi: string): boolean {
  const mdp = motDePasse()
  return !!mdp && egaux(saisi, mdp)
}

export async function estAdmin(): Promise<boolean> {
  // Les cookies sont lus avant tout test : la page reste rendue à chaque requête, même quand
  // ADMIN_PASSWORD est absent au moment du build (sinon Next.js la figerait).
  const valeur = (await cookies()).get(COOKIE)?.value
  const mdp = motDePasse()
  return !!mdp && !!valeur && egaux(valeur, jeton(mdp))
}

export async function ouvrirSession() {
  const mdp = motDePasse()
  if (!mdp) throw new Error("ADMIN_PASSWORD non configuré")
  ;(await cookies()).set(COOKIE, jeton(mdp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DUREE_S,
    path: "/",
  })
}

export async function fermerSession() {
  ;(await cookies()).delete(COOKIE)
}
