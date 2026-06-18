import { OPIS_OFERTY, ATUTY_OFERTY } from '../constants/wycena'
import { podzialRat } from '../lib/raty'
import { formatZl } from '../lib/format'

interface Props {
  numer: string
  nazwa: string
  telefon: string | null
  tytul: string // etykieta typu, np. "Garderoba na wymiar"
  cena: number
}

// Dokument oferty — TO, CO WIDZI KLIENT. Nigdy nie pokazuje kosztów,
// marży ani słowa "zarobek". Stylizowany jako jasna "kartka" (czytelny
// zarówno w podglądzie na ekranie, jak i na wydruku PDF).
export default function OfertaWidok({
  numer,
  nazwa,
  telefon,
  tytul,
  cena,
}: Props) {
  const [r1, r2, r3] = podzialRat(cena)

  return (
    <div className="rounded-xl bg-white p-6 text-zinc-900 sm:p-8">
      {/* Nagłówek */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="font-naglowek text-2xl font-extrabold">
            <span style={{ color: '#E3242B' }}>Imperial</span> Design
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">Meble na wymiar</p>
        </div>
        <div className="text-right text-sm text-zinc-500">
          <p className="font-medium text-zinc-700">Oferta {numer}</p>
          <p>Ważna 30 dni</p>
          <p className="mt-1">{nazwa}</p>
          {telefon && <p>{telefon}</p>}
        </div>
      </div>

      {/* Tytuł + opis */}
      <div className="py-5">
        <h3 className="font-naglowek text-xl font-bold">{tytul}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {OPIS_OFERTY}
        </p>
      </div>

      {/* Pozycja */}
      <div className="flex items-center justify-between border-y border-zinc-200 py-4">
        <span className="font-medium">Komplet — projekt, materiały, montaż</span>
        <span className="font-semibold">{formatZl(cena)}</span>
      </div>

      {/* Wartość zlecenia */}
      <div className="py-5">
        <p className="text-sm text-zinc-500">Wartość zlecenia</p>
        <p className="font-naglowek text-3xl font-extrabold">{formatZl(cena)}</p>
        <p className="mt-1 text-sm text-zinc-500">
          brutto, z montażem · płatność 40/40/20
        </p>
      </div>

      {/* Raty 40/40/20 */}
      <div className="grid grid-cols-3 gap-3">
        <RataKafelek opis="Zadatek" procent="40%" kwota={r1} />
        <RataKafelek opis="Przed montażem" procent="40%" kwota={r2} />
        <RataKafelek opis="Po odbiorze" procent="20%" kwota={r3} />
      </div>

      {/* Pasek atutów */}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
        {ATUTY_OFERTY.map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5">
            <span style={{ color: '#E3242B' }}>✓</span>
            {a}
          </span>
        ))}
      </div>
    </div>
  )
}

function RataKafelek({
  opis,
  procent,
  kwota,
}: {
  opis: string
  procent: string
  kwota: number
}) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-center ring-1 ring-zinc-200">
      <p className="text-xs text-zinc-500">{opis}</p>
      <p className="text-xs font-medium text-zinc-400">{procent}</p>
      <p className="mt-1 font-semibold">{formatZl(kwota)}</p>
    </div>
  )
}
