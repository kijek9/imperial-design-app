// Pomocnicze funkcje formatujące daty i kwoty po polsku.

// Data w formacie dd.mm.rrrr (puste pola wyświetlamy jako "—").
export function formatData(data: string | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Data + godzina (np. dla komentarzy).
export function formatDataGodzina(data: string | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Kwota w PLN, np. "12 500,00 zł".
export function formatKwota(kwota: number | null | undefined): string {
  if (kwota === null || kwota === undefined) return '—'
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(kwota)
}
