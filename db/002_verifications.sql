-- Contrôle croisé avec les annuaires tiers : un statut par source, jamais leur contenu.
-- Exemple : {"monartisan": {"statut": "concorde", "verifie_le": "2026-09-27T16:40:00Z"}}

alter table public.entreprises
  add column if not exists verifications jsonb not null default '{}',
  add column if not exists verifie_le timestamptz;

create index if not exists entreprises_verifie_idx on public.entreprises (verifie_le nulls first);
