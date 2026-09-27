import type { Metadata } from "next"
import { FormulaireRetrait } from "./formulaire"

export const metadata: Metadata = { title: "Retirer ma fiche" }

export default async function Retrait(props: PageProps<"/retrait">) {
  const { siret } = await props.searchParams
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Retirer ma fiche</h1>
      <p className="mt-2 text-stone-600">
        Vous pouvez vous opposer à la publication des informations de votre entreprise. La fiche est
        masquée dès réception de la demande.
      </p>
      <div className="mt-6">
        <FormulaireRetrait siret={typeof siret === "string" ? siret : undefined} />
      </div>
    </div>
  )
}
