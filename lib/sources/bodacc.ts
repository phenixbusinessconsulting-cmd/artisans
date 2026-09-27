// BODACC (DILA, open data) : procédures collectives publiées dans le département.
// Sert à retirer de l'annuaire les entreprises en liquidation judiciaire, que SIRENE
// peut encore indiquer « actives » tant que la radiation n'est pas enregistrée.

const API =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/exports/json"

export interface AnnonceBodacc {
  registre?: string[] | null
  jugement?: string | null
  dateparution?: string | null
}

const FIN_ACTIVITE = /liquidation judiciaire|cl[ôo]ture pour insuffisance d'actif/i

/** SIREN → date de parution de la dernière liquidation (ou clôture pour insuffisance d'actif). */
export function liquidations(annonces: AnnonceBodacc[]): Map<string, string> {
  const parSiren = new Map<string, string>()
  for (const a of annonces) {
    if (!a.dateparution || !a.jugement) continue
    let nature = ""
    try {
      const j = JSON.parse(a.jugement) as { nature?: string; complementJugement?: string }
      nature = `${j.nature ?? ""} ${j.complementJugement ?? ""}`
    } catch {
      continue
    }
    if (!FIN_ACTIVITE.test(nature)) continue
    const siren = (a.registre ?? []).map((r) => r.replace(/\s/g, "")).find((r) => /^\d{9}$/.test(r))
    if (!siren) continue
    const precedente = parSiren.get(siren)
    if (!precedente || a.dateparution > precedente) parSiren.set(siren, a.dateparution)
  }
  return parSiren
}

export async function lireBodacc(
  departement: string,
  depuis: string,
  fetchImpl: typeof fetch = fetch
): Promise<AnnonceBodacc[]> {
  const params = new URLSearchParams({
    select: "registre,jugement,dateparution",
    where: `numerodepartement="${departement}" and familleavis="collective" and dateparution>=date'${depuis}'`,
  })
  const res = await fetchImpl(`${API}?${params}`, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`BODACC : HTTP ${res.status}`)
  return (await res.json()) as AnnonceBodacc[]
}
