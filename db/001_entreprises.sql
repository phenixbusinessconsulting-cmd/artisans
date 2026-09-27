-- Annuaire des artisans du bâtiment de l'Essonne (91)

create extension if not exists pg_trgm;
create extension if not exists unaccent;

create table if not exists public.entreprises (
  siret               text primary key check (siret ~ '^\d{14}$'),
  siren               text not null check (siren ~ '^\d{9}$'),
  raison_sociale      text not null,
  enseigne            text,
  naf                 text not null,
  metier              text not null,
  specialites         text[] not null default '{}',
  labels              text[] not null default '{}',
  dirigeant_nom       text,
  dirigeant_qualite   text,
  adresse             text,
  code_postal         text,
  ville               text,
  latitude            double precision,
  longitude           double precision,
  telephone           text check (telephone ~ '^0[1-9]\d{8}$'),
  telephone_type      text check (telephone_type in ('mobile', 'fixe')),
  telephone_source    text,
  telephone_confiance smallint check (telephone_confiance between 0 and 100),
  site_web            text,
  date_creation       date,
  -- Trace de chaque source consultée (RGPD : origine des données).
  sources             jsonb not null default '{}',
  -- Opposition exercée par l'entreprise : la fiche n'est plus publiée.
  masque              boolean not null default false,
  sirene_maj_le       timestamptz,
  enrichi_le          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists entreprises_metier_idx on public.entreprises (metier) where not masque;
create index if not exists entreprises_code_postal_idx on public.entreprises (code_postal) where not masque;
create index if not exists entreprises_specialites_idx on public.entreprises using gin (specialites);
create index if not exists entreprises_nom_trgm_idx on public.entreprises
  using gin (raison_sociale gin_trgm_ops);
create index if not exists entreprises_enrichi_idx on public.entreprises (enrichi_le nulls first);

create or replace function public.entreprises_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists entreprises_updated_at on public.entreprises;
create trigger entreprises_updated_at before update on public.entreprises
  for each row execute function public.entreprises_touch_updated_at();

-- Demandes de retrait / d'opposition (droit d'opposition RGPD).
create table if not exists public.demandes_retrait (
  id         uuid primary key default gen_random_uuid(),
  siret      text not null check (siret ~ '^\d{14}$'),
  email      text not null,
  motif      text,
  traitee    boolean not null default false,
  created_at timestamptz not null default now()
);
