import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Status, TypWyceny } from '../lib/types'
import { progDlaTypu } from '../constants/wycena'
import { podzialRat, terminRaty2 } from '../lib/raty'
import { formatZl, formatData } from '../lib/format'
import { StatusBadge } from '../components/Badge'
import Spinner from '../components/Spinner'

// Lekki model zlecenia na potrzeby kalendarza.
interface ZlecenieKal {
  id: string
  numer: string
  nazwa: string
  data_montazu: string
  kwota_umowa: number | null
  status: Status
  typ: TypWyceny | null
}

type Widok = 'lista' | 'miesiac'
type Rodzaj = 'montaz' | 'rata2'

interface Wydarzenie {
  data: string // YYYY-MM-DD
  rodzaj: Rodzaj
  z: ZlecenieKal
}

// ── Pomocnicze daty ─────────────────────────────────────────────
function isoZDaty(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dniDo(iso: string): number {
  const dzis = new Date()
  dzis.setHours(0, 0, 0, 0)
  const cel = new Date(iso)
  cel.setHours(0, 0, 0, 0)
  return Math.round((cel.getTime() - dzis.getTime()) / 86_400_000)
}
const NAZWY_MIESIECY = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]
const DNI_TYGODNIA = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz']

export default function KalendarzPage() {
  const navigate = useNavigate()
  const [widok, setWidok] = useState<Widok>('lista')
  const [zlecenia, setZlecenia] = useState<ZlecenieKal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aktywne = true
    async function zaladuj() {
      setLoading(true)
      // Aktywne zlecenia z ustawioną datą montażu.
      const { data: zl } = await supabase
        .from('zlecenia')
        .select('id, numer, nazwa, data_montazu, kwota_umowa, status')
        .eq('zarchiwizowane', false)
        .not('data_montazu', 'is', null)
        .order('data_montazu', { ascending: true })

      // Typy z wycen (do etykiety na liście).
      const { data: wy } = await supabase.from('wyceny').select('zlecenie_id, typ')
      const typy = new Map((wy ?? []).map((w) => [w.zlecenie_id, w.typ]))

      if (aktywne) {
        setZlecenia(
          (zl ?? []).map((z) => ({
            id: z.id,
            numer: z.numer,
            nazwa: z.nazwa,
            data_montazu: z.data_montazu as string,
            kwota_umowa: z.kwota_umowa,
            status: z.status,
            typ: typy.get(z.id) ?? null,
          }))
        )
        setLoading(false)
      }
    }
    zaladuj()
    return () => {
      aktywne = false
    }
  }, [])

  // Lista wszystkich wydarzeń (montaże + terminy raty 2).
  const wydarzenia = useMemo<Wydarzenie[]>(() => {
    const lista: Wydarzenie[] = []
    for (const z of zlecenia) {
      lista.push({ data: z.data_montazu, rodzaj: 'montaz', z })
      const r2 = terminRaty2(z.data_montazu)
      if (r2) lista.push({ data: r2, rodzaj: 'rata2', z })
    }
    return lista.sort((a, b) => a.data.localeCompare(b.data))
  }, [zlecenia])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Kalendarz</h1>
          <p className="mt-1 text-sm text-przygaszony">
            Montaże i terminy płatności (rata 2 — przed montażem)
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-panel p-1">
          <button
            onClick={() => setWidok('lista')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              widok === 'lista'
                ? 'bg-karta text-krem shadow'
                : 'text-przygaszony hover:text-krem'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setWidok('miesiac')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              widok === 'miesiac'
                ? 'bg-karta text-krem shadow'
                : 'text-przygaszony hover:text-krem'
            }`}
          >
            Miesiąc
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner label="Wczytywanie kalendarza…" />
      ) : widok === 'lista' ? (
        <WidokListy wydarzenia={wydarzenia} onOtworz={(id) => navigate(`/zlecenie/${id}`)} />
      ) : (
        <WidokMiesiaca wydarzenia={wydarzenia} onOtworz={(id) => navigate(`/zlecenie/${id}`)} />
      )}
    </div>
  )
}

// ───────────────────────── Widok LISTA ─────────────────────────
function WidokListy({
  wydarzenia,
  onOtworz,
}: {
  wydarzenia: Wydarzenie[]
  onOtworz: (id: string) => void
}) {
  if (wydarzenia.length === 0) {
    return (
      <div className="karta p-10 text-center text-przygaszony">
        Brak nadchodzących montaży. Ustaw datę montażu na zleceniu.
      </div>
    )
  }

  // Grupowanie po dacie z zachowaniem kolejności rosnącej.
  const grupy: { data: string; pozycje: Wydarzenie[] }[] = []
  for (const w of wydarzenia) {
    const ost = grupy[grupy.length - 1]
    if (ost && ost.data === w.data) ost.pozycje.push(w)
    else grupy.push({ data: w.data, pozycje: [w] })
  }

  return (
    <div className="space-y-6">
      {grupy.map((g) => (
        <div key={g.data}>
          <h2 className="mb-2 text-sm font-semibold text-przygaszony">
            {formatData(g.data)}
            <span className="ml-2 font-normal">{etykietaDni(dniDo(g.data))}</span>
          </h2>
          <div className="space-y-2">
            {g.pozycje.map((w, i) =>
              w.rodzaj === 'montaz' ? (
                <WierszMontaz key={i} w={w} onOtworz={onOtworz} />
              ) : (
                <WierszRata2 key={i} w={w} onOtworz={onOtworz} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function etykietaDni(dni: number): string {
  if (dni === 0) return '(dziś)'
  if (dni === 1) return '(jutro)'
  if (dni < 0) return `(${Math.abs(dni)} dni temu)`
  return `(za ${dni} dni)`
}

function WierszMontaz({
  w,
  onOtworz,
}: {
  w: Wydarzenie
  onOtworz: (id: string) => void
}) {
  const { z } = w
  const dni = dniDo(z.data_montazu)
  // Przeterminowane: data montażu w przeszłości, a zlecenie niezamknięte.
  const przeterminowane = dni < 0 && z.status !== 'zakonczone'
  const typEt = z.typ ? progDlaTypu(z.typ).etykieta : '—'

  return (
    <button
      onClick={() => onOtworz(z.id)}
      className={`karta flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left transition hover:bg-white/5 ${
        przeterminowane ? 'ring-1 ring-rose-500/50' : ''
      }`}
    >
      <span className="font-semibold text-krem">{z.numer}</span>
      <span className="flex-1 text-krem">{z.nazwa}</span>
      <span className="text-sm text-przygaszony">{typEt}</span>
      <span className="text-sm text-krem">{formatZl(z.kwota_umowa)}</span>
      <StatusBadge status={z.status} />
      <span
        className={`text-sm ${przeterminowane ? 'font-semibold text-rose-400' : 'text-przygaszony'}`}
      >
        {przeterminowane ? `przeterminowane (${Math.abs(dni)} dni)` : etykietaDni(dni)}
      </span>
    </button>
  )
}

function WierszRata2({
  w,
  onOtworz,
}: {
  w: Wydarzenie
  onOtworz: (id: string) => void
}) {
  const { z } = w
  const kwotaRaty = z.kwota_umowa != null ? podzialRat(z.kwota_umowa)[1] : null
  return (
    <button
      onClick={() => onOtworz(z.id)}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-amber-500/5 p-4 text-left ring-1 ring-amber-500/30 transition hover:bg-amber-500/10"
    >
      <span className="text-amber-300">💸 Płatność: przed montażem</span>
      <span className="font-semibold text-krem">{z.numer}</span>
      <span className="flex-1 text-przygaszony">{z.nazwa}</span>
      {kwotaRaty != null && (
        <span className="text-sm text-krem">{formatZl(kwotaRaty)} (40%)</span>
      )}
    </button>
  )
}

// ──────────────────────── Widok MIESIĄC ────────────────────────
function WidokMiesiaca({
  wydarzenia,
  onOtworz,
}: {
  wydarzenia: Wydarzenie[]
  onOtworz: (id: string) => void
}) {
  const dzis = new Date()
  const [rok, setRok] = useState(dzis.getFullYear())
  const [miesiac, setMiesiac] = useState(dzis.getMonth()) // 0–11

  // Mapa: data ISO → wydarzenia tego dnia.
  const wgDaty = useMemo(() => {
    const m = new Map<string, Wydarzenie[]>()
    for (const w of wydarzenia) {
      const arr = m.get(w.data) ?? []
      arr.push(w)
      m.set(w.data, arr)
    }
    return m
  }, [wydarzenia])

  // Siatka: zaczynamy od poniedziałku tygodnia, w którym jest 1. dzień miesiąca.
  const pierwszy = new Date(rok, miesiac, 1)
  const przesuniecie = (pierwszy.getDay() + 6) % 7 // pon=0 … ndz=6
  const start = new Date(rok, miesiac, 1 - przesuniecie)
  const komorki: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })

  function zmienMiesiac(delta: number) {
    const nowy = new Date(rok, miesiac + delta, 1)
    setRok(nowy.getFullYear())
    setMiesiac(nowy.getMonth())
  }
  function dzisiaj() {
    const t = new Date()
    setRok(t.getFullYear())
    setMiesiac(t.getMonth())
  }

  const dzisIso = isoZDaty(dzis)

  return (
    <div className="karta p-4 sm:p-6">
      {/* Nawigacja */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl">
          {NAZWY_MIESIECY[miesiac]} {rok}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => zmienMiesiac(-1)} className="btn-ghost px-3" aria-label="Poprzedni miesiąc">
            ◀
          </button>
          <button onClick={dzisiaj} className="btn-secondary">
            Dziś
          </button>
          <button onClick={() => zmienMiesiac(1)} className="btn-ghost px-3" aria-label="Następny miesiąc">
            ▶
          </button>
        </div>
      </div>

      {/* Nagłówki dni */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-przygaszony">
        {DNI_TYGODNIA.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Komórki dni */}
      <div className="grid grid-cols-7 gap-1">
        {komorki.map((d) => {
          const iso = isoZDaty(d)
          const wTymMiesiacu = d.getMonth() === miesiac
          const dzisDzien = iso === dzisIso
          const poz = wgDaty.get(iso) ?? []
          return (
            <div
              key={iso}
              className={`min-h-[84px] rounded-lg border p-1.5 ${
                wTymMiesiacu ? 'border-white/10 bg-panel/50' : 'border-transparent opacity-40'
              } ${dzisDzien ? 'ring-1 ring-akcent' : ''}`}
            >
              <div className={`mb-1 text-right text-xs ${dzisDzien ? 'font-bold text-akcent' : 'text-przygaszony'}`}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {poz.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => onOtworz(w.z.id)}
                    title={
                      w.rodzaj === 'montaz'
                        ? `Montaż ${w.z.numer} — ${w.z.nazwa}`
                        : `Płatność (rata 2) ${w.z.numer}`
                    }
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition ${
                      w.rodzaj === 'montaz'
                        ? 'bg-akcent/20 text-krem hover:bg-akcent/30'
                        : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                    }`}
                  >
                    {w.rodzaj === 'montaz' ? '🔧' : '💸'} {w.z.numer}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-4 flex gap-5 text-xs text-przygaszony">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-akcent/30" /> Montaż
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-500/30" /> Płatność (rata 2)
        </span>
      </div>
    </div>
  )
}
