import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Artisans du bâtiment en Essonne (91) — Annuaire",
    template: "%s — Artisans 91",
  },
  description:
    "Annuaire des artisans du bâtiment de l'Essonne : plombiers, électriciens, maçons, couvreurs… Coordonnées issues des registres officiels.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold">
              <span className="text-marque">Artisans</span> 91
            </Link>
            <span className="text-sm text-stone-500">Bâtiment · Essonne</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 bg-white text-sm text-stone-500">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6">
            <span>
              Données : registres SIRENE / RNE (open data), fiches publiques des entreprises.
            </span>
            <Link href="/mentions-legales" className="underline">
              Mentions légales et données personnelles
            </Link>
            <Link href="/retrait" className="underline">
              Retirer ma fiche
            </Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
