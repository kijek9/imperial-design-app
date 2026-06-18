// ─────────────────────────────────────────────────────────────
// Wspólna logika finansowa: symulacja podatkowa + zakresy okresów.
//
// Model (sp. z o.o., meble): koszty wpisywane BRUTTO z VAT 23%, cena
// klienta BRUTTO z VAT 8%, CIT 9% (mały podatnik). Robocizny nie wpisuje
// się jako koszt. Te same wzory używa zakładka Wycena i Finanse — trzymamy
// je w JEDNYM miejscu, żeby liczyły identycznie.
// ─────────────────────────────────────────────────────────────

export interface SymulacjaPodatkowa {
  vatNaliczony: number // VAT do odliczenia z zakupów (z kosztów 23%)
  vatNalezny: number // VAT od sprzedaży (8%)
  vatMebli: number // należny − naliczony (zwykle ujemny = nadwyżka naliczonego)
  dochod: number // podstawa CIT: przychód netto − koszty netto
  cit: number // 9% od dodatniego dochodu
  poCit: number // dochód − CIT
}

// Liczy symulację z sumy kosztów (brutto 23%) i ceny klienta (brutto 8%).
// Wszystkie składowe są liniowe względem kosztów i ceny, więc tę samą funkcję
// stosujemy zarówno do pojedynczej wyceny, jak i do sum zbiorczych w Finansach.
export function symulacjaPodatkowa(
  kosztyRazem: number,
  cena: number
): SymulacjaPodatkowa {
  const vatNaliczony = kosztyRazem - kosztyRazem / 1.23
  const vatNalezny = cena - cena / 1.08
  const vatMebli = vatNalezny - vatNaliczony
  const dochod = cena / 1.08 - kosztyRazem / 1.23
  const cit = 0.09 * Math.max(0, dochod)
  const poCit = dochod - cit
  return { vatNaliczony, vatNalezny, vatMebli, dochod, cit, poCit }
}

// ── Terminy płatności (dni kalendarzowe) ────────────────────────
export const DNI_TERMIN_FAKTURY = 5 // klient: data faktury + 5 dni
export const DNI_TERMIN_HURTOWNI = 14 // hurtownia: data zamówienia + 14 dni

// ─────────────────────────────────────────────────────────────
// Zakresy okresów (lokalny czas, północ). Konwencja: [od, do) — „do"
// jest wyłączne, co upraszcza porównania na granicach.
// ─────────────────────────────────────────────────────────────

export type Okres = 'tydzien' | 'miesiac' | 'kwartal' | 'rok' | 'wszystko'

export const OKRESY: { value: Okres; etykieta: string }[] = [
  { value: 'tydzien', etykieta: 'Ten tydzień' },
  { value: 'miesiac', etykieta: 'Ten miesiąc' },
  { value: 'kwartal', etykieta: 'Ten kwartał' },
  { value: 'rok', etykieta: 'Ten rok' },
  { value: 'wszystko', etykieta: 'Wszystko' },
]

function poczatekDnia(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Poniedziałek bieżącego tygodnia (północ).
export function poczatekTygodnia(ref: Date = new Date()): Date {
  const d = poczatekDnia(ref)
  const odPon = (d.getDay() + 6) % 7 // pon=0 … ndz=6
  d.setDate(d.getDate() - odPon)
  return d
}

// Poniedziałek następnego tygodnia (granica wyłączna bieżącego tygodnia).
export function koniecTygodnia(ref: Date = new Date()): Date {
  const d = poczatekTygodnia(ref)
  d.setDate(d.getDate() + 7)
  return d
}

// Zakres [od, do) dla wybranego okresu; dla „wszystko" → { od: null, do_: null }.
export function zakresOkresu(
  okres: Okres,
  ref: Date = new Date()
): { od: Date | null; do_: Date | null } {
  const dzis = poczatekDnia(ref)
  switch (okres) {
    case 'wszystko':
      return { od: null, do_: null }
    case 'tydzien':
      return { od: poczatekTygodnia(ref), do_: koniecTygodnia(ref) }
    case 'miesiac':
      return {
        od: new Date(dzis.getFullYear(), dzis.getMonth(), 1),
        do_: new Date(dzis.getFullYear(), dzis.getMonth() + 1, 1),
      }
    case 'kwartal': {
      const q = Math.floor(dzis.getMonth() / 3)
      return {
        od: new Date(dzis.getFullYear(), q * 3, 1),
        do_: new Date(dzis.getFullYear(), q * 3 + 3, 1),
      }
    }
    case 'rok':
      return {
        od: new Date(dzis.getFullYear(), 0, 1),
        do_: new Date(dzis.getFullYear() + 1, 0, 1),
      }
  }
}

// Data + N dni (przyjmuje ISO / timestamp z bazy), zwraca Date o północy.
export function dodajDni(iso: string, dni: number): Date {
  const d = poczatekDnia(new Date(iso))
  d.setDate(d.getDate() + dni)
  return d
}

// Czy data mieści się w [od, do)? Przy null-owych granicach (okres „wszystko")
// zawsze true.
export function wZakresie(
  d: Date,
  od: Date | null,
  do_: Date | null
): boolean {
  if (od && d < od) return false
  if (do_ && d >= do_) return false
  return true
}

// Pełne dni między dwiema datami (b − a), po normalizacji do północy.
export function dniMiedzy(a: Date, b: Date): number {
  const x = poczatekDnia(a).getTime()
  const y = poczatekDnia(b).getTime()
  return Math.round((y - x) / 86_400_000)
}
