import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Mentions légales et données personnelles" }

export default function MentionsLegales() {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Mentions légales et données personnelles</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Éditeur</h2>
        {/* À compléter : raison sociale, adresse, SIRET, directeur de publication, hébergeur. */}
        <p>Phenix Group International — coordonnées à compléter.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Origine des données</h2>
        <ul className="list-disc pl-6">
          <li>
            Identité, adresse, SIRET, activité et dirigeants : registres publics SIRENE (INSEE) et
            RNE (INPI), via l&apos;API Recherche d&apos;entreprises de l&apos;État (open data).
          </li>
          <li>
            Labels RGE, organismes de qualification, domaines de travaux et coordonnées publiées par
            les entreprises qualifiées : liste des entreprises RGE de l&apos;ADEME (Licence
            Ouverte).
          </li>
          <li>
            Entreprises en liquidation judiciaire, retirées de l&apos;annuaire : BODACC (DILA).
          </li>
          <li>
            Téléphones et sites d&apos;artisans cartographiés : © les contributeurs
            d&apos;OpenStreetMap, données disponibles sous licence ODbL
            (openstreetmap.org/copyright).
          </li>
          <li>
            Téléphone, site web et spécialités : informations publiées par l&apos;entreprise
            elle-même (site internet, fiche d&apos;établissement Google).
          </li>
        </ul>
        <p>
          Les entreprises ayant demandé la diffusion partielle de leurs données au registre SIRENE
          ne sont pas publiées.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Vos droits</h2>
        <p>
          Finalité : mettre en relation les particuliers et professionnels avec les artisans du
          bâtiment de l&apos;Essonne. Base légale : intérêt légitime (art. 6.1.f du RGPD).
        </p>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement et
          d&apos;opposition. Pour retirer une fiche, utilisez le{" "}
          <Link href="/retrait" className="underline">
            formulaire de retrait
          </Link>
          . Vous pouvez également saisir la CNIL (cnil.fr).
        </p>
      </section>
    </article>
  )
}
