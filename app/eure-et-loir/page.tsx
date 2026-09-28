import type { Metadata } from "next"
import { DEPARTEMENTS } from "@/lib/departements"
import { PageAnnuaire } from "../annuaire"

const DEPARTEMENT = DEPARTEMENTS["28"]

export const metadata: Metadata = {
  title: `Artisans du bâtiment ${DEPARTEMENT.en} (${DEPARTEMENT.code})`,
  description: `Annuaire des artisans du bâtiment ${DEPARTEMENT.de} : plombiers, électriciens, maçons, couvreurs… Coordonnées issues des registres officiels.`,
}

export default async function EureEtLoir(props: PageProps<"/eure-et-loir">) {
  return <PageAnnuaire departement={DEPARTEMENT} sp={await props.searchParams} />
}
