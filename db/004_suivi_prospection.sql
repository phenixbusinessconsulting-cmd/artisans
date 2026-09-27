-- Suivi de prospection, visible et modifiable uniquement en mode administrateur.

create table if not exists public.suivi_prospection (
  siret       text primary key references public.entreprises (siret) on delete cascade,
  contacte    boolean not null default false,
  contacte_le timestamptz,
  commentaire text not null default '' check (length(commentaire) <= 5000),
  maj_le      timestamptz not null default now()
);
