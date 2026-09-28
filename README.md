# Annuaire des artisans du bâtiment — Essonne (91) et Eure-et-Loir (28)

Chaque département a sa page : `/` pour l'Essonne, `/eure-et-loir` pour l'Eure-et-Loir. Les fiches
sont dans la même base ; le département se déduit du code postal. Pour ajouter un département : une
entrée dans `lib/departements.ts`, une page `app/<slug>/page.tsx`, et son code dans l'entrée
`departements` du workflow `refresh-data.yml` (les scripts d'import lisent la variable `DEPARTEMENT`).

Annuaire public en ligne sur `artisans.monsitedemo-talens.fr`. Pour chaque établissement : nom de la
société, décideur, téléphone (portable de préférence, sinon fixe), adresse, SIRET, métier, spécialités
et labels.

## Sources croisées

| Donnée                                                                                       | Source                                                                                                               | Coût                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Raison sociale, enseigne, SIRET, adresse, code NAF, dirigeants                               | [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) (SIRENE + RNE)                        | Gratuit                        |
| Téléphone, e-mail, site, domaines de travaux, organismes (Qualibat, Qualit'EnR, Qualifelec…) | [Liste des entreprises RGE de l'ADEME](https://data.ademe.fr/datasets/liste-des-entreprises-rge-2) (Licence Ouverte) | Gratuit                        |
| Téléphone, site des artisans cartographiés                                                   | OpenStreetMap / Overpass (© contributeurs OSM, ODbL)                                                                 | Gratuit                        |
| Entreprises en liquidation judiciaire (retirées)                                             | [BODACC](https://bodacc-datadila.opendatasoft.com/) (DILA)                                                           | Gratuit                        |
| Téléphone, site web                                                                          | Google Places API (New), fiche publique de l'établissement                                                           | Payant (quota gratuit mensuel) |
| Téléphone, spécialités, confirmation du SIREN                                                | Site web de l'entreprise (accueil, contact, mentions légales)                                                        | Gratuit                        |
| Site web (quand aucune source n'en donne)                                                    | Noms de domaine probables (`nom-entreprise.fr`…), retenus seulement si le site affiche le SIREN                      | Gratuit                        |

Ordre du rafraîchissement (`.github/workflows/refresh-data.yml`) : `npm run ingest` (SIRENE) →
`npm run sources` (ADEME, OSM, BODACC) → `npm run enrich` (Google, sites) → `npm run verify`
(annuaires tiers).

Règles de fusion (`lib/phone.ts`, `lib/enrich/`) :

- chaque source propose au plus un numéro ; un portable est préféré à un fixe, puis le numéro
  confirmé par le plus de sources (la confiance augmente avec chaque source concordante) ;
- la fiche Google n'est retenue qu'à moins d'1 km de l'adresse SIRENE ;
- les numéros d'un site ne sont retenus que si le site affiche le SIREN, ou s'il en publie au plus deux ;
- chaque fiche garde la trace de ses sources (colonne `sources`) et un indice de confiance.

## Contrôle croisé avec les annuaires tiers

`npm run verify` (`lib/verification/`) recherche chaque fiche sur des annuaires publics
(monartisan.info par SIRET, annuaire-plombiers.com pour les plombiers et chauffagistes) et
enregistre **seulement un statut** par source dans la colonne `verifications` :
`concorde`, `telephone_different`, `trouvee`, `absente`, `interdit` ou `erreur`. Le contenu de ces
sites n'est jamais stocké ni publié.

- `robots.txt` respecté (page exclue → statut `interdit`, rien n'est téléchargé) ;
- 2 s minimum entre deux requêtes vers un même site (10 s pour monartisan.info), user-agent
  identifiable ; un site qui répond 429 n'est plus sollicité jusqu'à l'exécution suivante ;
- quand la page de résultats répète le nom cherché, seul le SIREN ou notre téléphone vaut preuve ;
- sites protégés par un anti-robot (Leboncoin, plus-que-pro…) exclus : aucun contournement.

## Mode administrateur (suivi de prospection)

`/connexion` ouvre une session (cookie de 30 jours) avec le mot de passe `ADMIN_PASSWORD`
(secret GitHub du même nom, recopié dans `/var/www/artisans/.env` au déploiement). En mode
administrateur, chaque fiche affiche un bouton « contacté » et un commentaire (table
`suivi_prospection`), la liste montre un badge « Contacté » et un filtre « À contacter / Déjà
contactés ». Rien de tout cela n'est visible ni modifiable par le public.

## Données personnelles (RGPD)

- Les entreprises en diffusion partielle au registre SIRENE ne sont jamais importées.
- Seuls les numéros publiés par l'entreprise elle-même (site, fiche Google) sont affichés.
- `/retrait` : opposition en ligne, la fiche est masquée immédiatement (`masque = true`) et la
  demande est conservée dans `demandes_retrait`. L'import ne réaffiche jamais une fiche masquée.
- `/mentions-legales` : origine des données et droits. **Coordonnées de l'éditeur à compléter.**

## Développement

```bash
npm ci
export DATABASE_URL=postgres://artisans:motdepasse@localhost:5432/artisans
npm run dev
npm run test:unit
npm run ingest -- --naf=43.22A   # import d'une seule activité
npm run enrich -- --limite=50
```

Schéma : `db/001_entreprises.sql` (idempotent, rejoué à chaque déploiement).
Tests sur une vraie base : `TEST_DATABASE_URL=postgres://… npm run test:unit` (base jetable).

## Production (VPS)

- `db` : PostgreSQL 16 dédié à l'annuaire (volume `artisans_db-data`), non exposé.
- `app` : Next.js standalone, publié sur `127.0.0.1:3014` ; Nginx fait le relais HTTPS.
- `worker` : scripts d'import, lancés par `.github/workflows/refresh-data.yml` (chaque lundi, ou à la
  main depuis l'onglet Actions).
- Déploiement automatique à chaque push sur `main` (`.github/workflows/ci.yml`) : le code est
  envoyé en archive dans `/var/www/artisans/app` (aucune clé d'accès au dépôt n'est nécessaire sur le
  serveur) ; `/var/www/artisans/.env` est créé au premier déploiement avec un mot de passe aléatoire.

Secrets GitHub : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. Variable de dépôt `DEPLOY_ENABLED = true` pour activer le déploiement et le rafraîchissement des données. Variables du serveur : fichier
`/var/www/artisans/.env` (voir `.env.example`), où ajouter `GOOGLE_PLACES_API_KEY`.
