// ─────────────────────────────────────────────────────────────
// Podział płatności 40 / 40 / 20 (stały, z umowy — nie zmieniać proporcji).
// Suma trzech rat zawsze równa kwocie umowy — ewentualne grosze
// zaokrąglenia dorzucamy do ostatniej raty.
// ─────────────────────────────────────────────────────────────

export const PROCENTY_RAT = [40, 40, 20] as const

export const NAZWY_RAT = ['Zadatek', 'Przed montażem', 'Po odbiorze'] as const

export function podzialRat(kwota: number): [number, number, number] {
  const baza = Math.max(0, Math.round(kwota))
  const r1 = Math.round(baza * 0.4)
  const r2 = Math.round(baza * 0.4)
  const r3 = baza - r1 - r2 // reszta trafia do ostatniej raty
  return [r1, r2, r3]
}

// Termin raty 2 = data montażu − 5 dni (zwraca 'YYYY-MM-DD' lub null).
export function terminRaty2(dataMontazu: string | null): string | null {
  if (!dataMontazu) return null
  const d = new Date(dataMontazu)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() - 5)
  return d.toISOString().slice(0, 10)
}
