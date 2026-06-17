// ─────────────────────────────────────────────────────────────
// Definicje statusów i etapów wraz z polskimi etykietami i kolorami
// "pigułek" (badge). Trzymamy to w jednym miejscu, żeby cała aplikacja
// (lista, karta, filtry) korzystała ze spójnych nazw i kolorów.
// ─────────────────────────────────────────────────────────────

import type { Status, Etap } from '../lib/types'

export interface OpcjaBadge<T> {
  wartosc: T
  etykieta: string
  // Klasy Tailwind dla "pigułki"
  klasy: string
}

export const STATUSY: OpcjaBadge<Status>[] = [
  {
    wartosc: 'nowy',
    etykieta: 'Nowy',
    klasy: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
  },
  {
    wartosc: 'w_trakcie',
    etykieta: 'W trakcie',
    klasy: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  },
  {
    wartosc: 'wstrzymane',
    etykieta: 'Wstrzymane',
    klasy: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
  },
  {
    wartosc: 'zakonczone',
    etykieta: 'Zakończone',
    klasy: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  },
]

export const ETAPY: OpcjaBadge<Etap>[] = [
  {
    wartosc: 'wycena',
    etykieta: 'Wycena',
    klasy: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30',
  },
  {
    wartosc: 'przeslano_do_klienta',
    etykieta: 'Przesłano do klienta',
    klasy: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30',
  },
  {
    wartosc: 'projekt_na_gotowo',
    etykieta: 'Projekt na gotowo',
    klasy: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30',
  },
  {
    wartosc: 'w_produkcji',
    etykieta: 'W produkcji',
    klasy: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
  },
  {
    wartosc: 'montaz',
    etykieta: 'Montaż',
    klasy: 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30',
  },
  {
    wartosc: 'odbior',
    etykieta: 'Odbiór',
    klasy: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  },
]

// Pomocnicze mapy do szybkiego wyszukania po wartości.
export const STATUS_MAP = Object.fromEntries(
  STATUSY.map((s) => [s.wartosc, s])
) as Record<Status, OpcjaBadge<Status>>

export const ETAP_MAP = Object.fromEntries(
  ETAPY.map((e) => [e.wartosc, e])
) as Record<Etap, OpcjaBadge<Etap>>
