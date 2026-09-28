import { DEPARTEMENTS } from "@/lib/departements"
import { PageAnnuaire } from "./annuaire"

export default async function Accueil(props: PageProps<"/">) {
  return <PageAnnuaire departement={DEPARTEMENTS["91"]} sp={await props.searchParams} />
}
