// ─────────────────────────────────────────────────────────────
// Cennik "z głowy" właściciela — progi CZYSTEGO ZAROBKU zależne od
// typu zlecenia. To stała konfiguracyjna (nie wymyślaj wartości).
//
// Zarobek = czysta gotówka do kieszeni PO opłaceniu wszystkich kosztów.
// Cena dla klienta = suma kosztów + zarobek.
// ─────────────────────────────────────────────────────────────

import type { TypWyceny, KosztPozycja } from '../lib/types'

export interface ProgTypu {
  value: TypWyceny
  etykietaSelect: string // tekst w dropdownie kalkulacji
  etykieta: string // tytuł w ofercie dla klienta
  min: number
  standard: number
  premium: number
}

export const TYPY_WYCENY: ProgTypu[] = [
  {
    value: 'szafka',
    etykietaSelect: 'Szafka',
    etykieta: 'Szafka na wymiar',
    min: 800,
    standard: 1000,
    premium: 1500,
  },
  {
    value: 'szafa',
    etykietaSelect: 'Szafa sypialnia',
    etykieta: 'Szafa na wymiar',
    min: 2000,
    standard: 3000,
    premium: 4000,
  },
  {
    value: 'duza',
    etykietaSelect: 'Duża szafa / garderoba',
    etykieta: 'Garderoba na wymiar',
    min: 3500,
    standard: 5000,
    premium: 7000,
  },
  {
    value: 'kuchnia',
    etykietaSelect: 'Kuchnia',
    etykieta: 'Kuchnia na wymiar',
    min: 10000,
    standard: 11000,
    premium: 14000,
  },
]

export function progDlaTypu(typ: TypWyceny): ProgTypu {
  return TYPY_WYCENY.find((t) => t.value === typ) ?? TYPY_WYCENY[0]
}

// Domyślne pozycje kosztów przy nowej wycenie (wszystkie z wartością 0).
export const DOMYSLNE_KOSZTY: KosztPozycja[] = [
  { l: 'Płyta Egger (CDW)', v: 0 },
  { l: 'Akcesoria / okucia', v: 0 },
  { l: 'Robocizna', v: 0 },
  { l: 'Projekt', v: 0 },
  { l: 'Transport / paliwo', v: 0 },
]

// Stały opis w ofercie dla klienta.
export const OPIS_OFERTY =
  'Zabudowa na wymiar z płyty Egger, okucia Blum, uchwyty Zobal. ' +
  'Projekt w technologii CAD, montaż przez nasz zespół.'

// Atuty pokazywane w ofercie.
export const ATUTY_OFERTY = [
  'Umowa + projekt w załączniku',
  'Podpis online (Autenti)',
  'Porządek po montażu',
]
