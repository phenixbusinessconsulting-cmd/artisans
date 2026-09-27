# Artisans 91 — annuaire des artisans du bâtiment de l'Essonne

Annuaire public en ligne sur `artisans.monsitedemo-talens.fr`. Pour chaque établissement : nom de la
société, décideur, téléphone (portable de préférence, sinon fixe), adresse, SIRET, métier, spécialités
et labels.

## Sources croisées

| Donnée                                                              | Source                                                                                                | Coût                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| Raison sociale, enseigne, SIRET, adresse, code NAF, dirigeants, RGE | [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) (SIRENE + RNE + ADEME) | Gratuit              |
| Téléphone, site web                                                 | Google Places API (New), fiche publique de l'établissement                                            | ~17 € / 1 000 fiches |
| Téléphone, spécialités, confirmation du SIREN                       | Site web de l'entreprise (accueil, contact, mentions légales)                                         | Gratuit              |

Règles de fusion (`lib/phone.ts`, `lib/enrich/`) :

- un portable est préféré à un fixe ; à type égal, le numéro confirmé par le plus de sources gagne ;
- la fiche Google n'est retenue qu'à moins d'1 km de l'adresse SIRENE ;
- les numéros d'un site ne sont retenus que si le site affiche le SIREN, ou s'il en publie au plus deux ;
- chaque fiche garde la trace de ses sources (colonne `sources`) et un indice de confiance.

## Données personnelles (RGPD)

- Les entreprises en diffusion partielle au registre SIRENE ne sont jamais importées.
- Seuls les numéros publiés par l'entreprise elle-même (site, fiche Google) sont affichés.
- `/retrait` : opposition en ligne, la fiche est masquée immédiatement (`masque = true`) et la
  demande est conservée dans `demandes_retrait`. L'import ne réaffiche jamais une fiche masquée.
- `/mentions-legales` : origine des données et droits. **Coordonnées de l'éditeur à compléter.**

## Développement

```bash
npm ci
cp .env.example .env   # renseigner Supabase
npm run dev
npm run test:unit
npm run ingest -- --naf=43.22A   # import d'une seule activité
npm run enrich -- --limite=50
```

Schéma : `supabase/migrations/001_entreprises.sql`.

## Production (VPS)

- `app` : Next.js standalone, publié sur `127.0.0.1:3014` ; Nginx fait le relais HTTPS.
- `worker` : scripts d'import, lancés par `.github/workflows/refresh-data.yml` (chaque lundi, ou à la
  main depuis l'onglet Actions).
- Déploiement automatique à chaque push sur `main` (`.github/workflows/ci.yml`).

Secrets GitHub : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. Variable de dépôt `DEPLOY_ENABLED = true` pour activer le déploiement et le rafraîchissement des données. Variables du serveur : fichier
`/var/www/artisans/.env` (voir `.env.example`).
