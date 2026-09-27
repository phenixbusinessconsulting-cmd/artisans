// Suivi de prospection (contacté, commentaire) : données internes, jamais affichées au public.

import type postgres from "postgres"

export interface Suivi {
  contacte: boolean
  contacte_le: string | null
  commentaire: string
  maj_le: string | null
}

export const SUIVI_VIDE: Suivi = {
  contacte: false,
  contacte_le: null,
  commentaire: "",
  maj_le: null,
}
export const COMMENTAIRE_MAX = 5000

export async function lireSuivi(db: postgres.Sql, siret: string): Promise<Suivi> {
  const [s] = await db<Suivi[]>`
    select contacte, contacte_le::text as contacte_le, commentaire, maj_le::text as maj_le
    from suivi_prospection where siret = ${siret}`
  return s ?? SUIVI_VIDE
}

export async function marquerContacte(
  db: postgres.Sql,
  siret: string,
  contacte: boolean
): Promise<Suivi> {
  await db`
    insert into suivi_prospection (siret, contacte, contacte_le)
    values (${siret}, ${contacte}, ${contacte ? db`now()` : null})
    on conflict (siret) do update set
      contacte = excluded.contacte,
      contacte_le = excluded.contacte_le,
      maj_le = now()`
  return lireSuivi(db, siret)
}

export async function enregistrerCommentaire(
  db: postgres.Sql,
  siret: string,
  commentaire: string
): Promise<Suivi> {
  const texte = commentaire.trim().slice(0, COMMENTAIRE_MAX)
  await db`
    insert into suivi_prospection (siret, commentaire)
    values (${siret}, ${texte})
    on conflict (siret) do update set commentaire = excluded.commentaire, maj_le = now()`
  return lireSuivi(db, siret)
}
