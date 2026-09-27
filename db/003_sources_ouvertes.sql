-- Sources ouvertes complémentaires : ADEME RGE (e-mail), BODACC (liquidations).

alter table public.entreprises
  add column if not exists email text,
  -- Date de parution BODACC de la liquidation judiciaire : la fiche n'est plus publiée.
  add column if not exists liquidation_le date;
