import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  TYPY_WYCENY,
  DOMYSLNE_KOSZTY,
  progDlaTypu,
} from '../constants/wycena'
import type { TypWyceny, KosztPozycja, Zlecenie } from '../lib/types'
import { symulacjaPodatkowa } from '../lib/finanse'
import { formatZl } from '../lib/format'
import Spinner from './Spinner'
import OfertaWidok from './OfertaWidok'

interface Props {
  zlecenie: Zlecenie
  // Wywoływane po zapisie wyceny, gdy kwota umowy została auto-zsynchronizowana
  // (kwota_umowa_reczna = false) — pozwala rodzicowi odświeżyć swój formularz.
  onKwotaUmowaZWyceny: (cena: number) => void
  // Sygnał udanego autozapisu (wspólny toast „Zapisano" w karcie zlecenia).
  onZapisano?: () => void
}

export default function Wycena({
  zlecenie,
  onKwotaUmowaZWyceny,
  onZapisano,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [typ, setTyp] = useState<TypWyceny>('szafka')
  const [koszty, setKoszty] = useState<KosztPozycja[]>(DOMYSLNE_KOSZTY)
  const [zarobek, setZarobek] = useState<number>(progDlaTypu('szafka').standard)
  const [komunikat, setKomunikat] = useState<string | null>(null)
  // Migawka ostatnio zapisanego stanu — chroni przed zbędnym zapisem po
  // wczytaniu i przy braku faktycznej zmiany. Timer = debounce autozapisu.
  const ostatniZapisRef = useRef<string>('')
  const debTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Wczytaj istniejącą wycenę (jeśli jest), inaczej zostaw domyślne.
  useEffect(() => {
    let aktywne = true
    setLoading(true)
    supabase
      .from('wyceny')
      .select('*')
      .eq('zlecenie_id', zlecenie.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!aktywne) return
        // Wartości po wczytaniu (data z bazy lub domyślne z initial state).
        let tt = typ
        let kk = koszty
        let zz = zarobek
        if (data) {
          tt = data.typ
          kk =
            Array.isArray(data.koszty) && data.koszty.length > 0
              ? data.koszty
              : DOMYSLNE_KOSZTY
          zz = data.zarobek
          setTyp(tt)
          setKoszty(kk)
          setZarobek(zz)
        }
        // Zapamiętaj migawkę, żeby autozapis nie wystrzelił od razu po wczytaniu.
        ostatniZapisRef.current = JSON.stringify({ typ: tt, koszty: kk, zarobek: zz })
        setLoading(false)
      })
    return () => {
      aktywne = false
    }
  }, [zlecenie.id])

  const prog = progDlaTypu(typ)
  const kosztyRazem = useMemo(
    () => koszty.reduce((s, k) => s + (Number(k.v) || 0), 0),
    [koszty]
  )
  const cena = kosztyRazem + zarobek
  const marza = cena > 0 ? Math.round((zarobek / cena) * 100) : 0
  const maxSuwak = Math.round(prog.premium * 1.6)

  // Symulacja podatkowa — wspólna funkcja (ta sama logika w zakładce Finanse).
  const symulacja = useMemo(
    () => symulacjaPodatkowa(kosztyRazem, cena),
    [kosztyRazem, cena]
  )

  // Zmiana typu → suwak ustawia się na "standard" nowego typu.
  function zmienTyp(nowy: TypWyceny) {
    setTyp(nowy)
    setZarobek(progDlaTypu(nowy).standard)
    setKomunikat(null)
  }

  function ustawKoszt(i: number, patch: Partial<KosztPozycja>) {
    setKoszty((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)))
    setKomunikat(null)
  }
  function usunKoszt(i: number) {
    setKoszty((prev) => prev.filter((_, idx) => idx !== i))
  }
  function dodajKoszt() {
    setKoszty((prev) => [...prev, { l: '', v: 0 }])
  }

  // Autozapis wyceny (upsert + ewentualna synchronizacja kwoty umowy).
  // Logika zapisu bez zmian — zmienił się tylko wyzwalacz (auto, nie przycisk).
  async function zapiszWycene() {
    const snap = JSON.stringify({ typ, koszty, zarobek })

    // Oczyść puste nazwy kosztów przed zapisem.
    const koszteOczyszczone = koszty.filter(
      (k) => k.l.trim() !== '' || (Number(k.v) || 0) !== 0
    )

    const { error } = await supabase.from('wyceny').upsert(
      {
        zlecenie_id: zlecenie.id,
        typ,
        koszty: koszteOczyszczone,
        zarobek,
      },
      { onConflict: 'zlecenie_id' }
    )

    if (error) {
      setKomunikat('Nie udało się zapisać wyceny.')
      return
    }

    // Auto-aktualizacja kwoty umowy — tylko jeśli nie ustawiono jej ręcznie.
    if (!zlecenie.kwota_umowa_reczna) {
      const { error: e2 } = await supabase
        .from('zlecenia')
        .update({ kwota_umowa: cena })
        .eq('id', zlecenie.id)
      if (!e2) onKwotaUmowaZWyceny(cena)
    }

    ostatniZapisRef.current = snap
    setKomunikat(null)
    onZapisano?.()
  }

  // Autozapis: po każdej zmianie typu / kosztów / zarobku zapisz z krótkim
  // debounce (chroni bazę przy przeciąganiu suwaka; kwoty zapisują się po
  // przerwie w pisaniu). Symulacja podatkowa liczy się na żywo i nic nie pisze.
  useEffect(() => {
    if (loading) return
    const snap = JSON.stringify({ typ, koszty, zarobek })
    if (snap === ostatniZapisRef.current) return
    clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => {
      void zapiszWycene()
    }, 500)
    return () => clearTimeout(debTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typ, koszty, zarobek, loading])

  // Sprzątanie timera debounce przy odmontowaniu.
  useEffect(() => () => clearTimeout(debTimer.current), [])

  if (loading) return <Spinner label="Wczytywanie wyceny…" />

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ───────── LEWA: Kalkulacja (tylko firma) ───────── */}
        <div className="karta space-y-5 p-6">
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-500/30">
            🔒 Tylko dla Ciebie — klient tego nie widzi
          </div>

          <div>
            <label className="etykieta">Typ zlecenia</label>
            <select
              value={typ}
              onChange={(e) => zmienTyp(e.target.value as TypWyceny)}
              className="pole"
            >
              {TYPY_WYCENY.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.etykietaSelect}
                </option>
              ))}
            </select>
          </div>

          {/* Lista kosztów */}
          <div>
            <label className="etykieta">Koszty</label>
            <div className="space-y-2">
              {koszty.map((k, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={k.l}
                    onChange={(e) => ustawKoszt(i, { l: e.target.value })}
                    className="pole flex-1"
                    placeholder="Nazwa pozycji"
                  />
                  <input
                    type="number"
                    value={k.v === 0 ? '' : k.v}
                    onChange={(e) =>
                      ustawKoszt(i, {
                        v: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    className="pole w-32"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => usunKoszt(i)}
                    className="btn-ghost px-2"
                    aria-label="Usuń koszt"
                    title="Usuń"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={dodajKoszt}
              className="btn-ghost mt-2 px-2"
            >
              + dodaj koszt
            </button>
          </div>

          {/* Koszty razem */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-przygaszony">Koszty razem</span>
            <span className="text-lg font-semibold">{formatZl(kosztyRazem)}</span>
          </div>

          {/* Zarobek + suwak */}
          <div>
            <label className="etykieta">Twój czysty zarobek</label>
            <p className="font-naglowek text-3xl font-extrabold text-krem">
              {formatZl(zarobek)}
            </p>
            <input
              type="range"
              min={0}
              max={maxSuwak}
              step={50}
              value={zarobek}
              onChange={(e) => {
                setZarobek(Number(e.target.value))
                setKomunikat(null)
              }}
              className="mt-3 w-full accent-akcent"
            />
            <Podpowiedz zarobek={zarobek} marza={marza} prog={prog} />

            {/* Co realnie zostaje (widok podatkowy) — pomaga zdecydować o cenie */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-panel px-3 py-2">
                <p className="text-xs text-przygaszony">Zostaje przed CIT</p>
                <p className="text-base font-semibold text-krem">
                  {formatZl(symulacja.dochod)}
                </p>
              </div>
              <div className="rounded-lg bg-panel px-3 py-2">
                <p className="text-xs text-przygaszony">Zostaje po CIT</p>
                <p className="text-base font-semibold text-krem">
                  {formatZl(symulacja.poCit)}
                </p>
              </div>
            </div>
          </div>

          {/* Cena dla klienta */}
          <div className="flex items-center justify-between rounded-lg bg-panel px-4 py-3">
            <span className="text-sm text-przygaszony">
              Cena dla klienta (koszty + zarobek)
            </span>
            <span className="text-xl font-bold text-krem">{formatZl(cena)}</span>
          </div>

          {/* ───────── Symulacja podatkowa (tylko właściciel) ───────── */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-naglowek text-lg text-krem">
                Symulacja podatkowa
              </h3>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-500/30">
                🔒 tylko właściciel
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <WierszPodatek
                label="VAT naliczony (z kosztów, 23%)"
                wartosc={symulacja.vatNaliczony}
              />
              <WierszPodatek
                label="VAT należny (sprzedaż, 8%)"
                wartosc={symulacja.vatNalezny}
              />
              <div className="border-t border-white/10 pt-2">
                <WierszPodatek
                  label="VAT mebli (należny − naliczony)"
                  wartosc={symulacja.vatMebli}
                  mocne
                />
                {symulacja.vatMebli < 0 && (
                  <p className="mt-1 text-xs text-przygaszony">
                    nadwyżka VAT naliczonego — wchodzi do ogólnego rozliczenia
                    VAT spółki
                  </p>
                )}
              </div>
              <div className="space-y-2 border-t border-white/10 pt-2">
                <WierszPodatek
                  label="Dochód (podstawa CIT)"
                  wartosc={symulacja.dochod}
                />
                <WierszPodatek label="CIT 9%" wartosc={symulacja.cit} />
                <WierszPodatek
                  label="Zostaje po CIT"
                  wartosc={symulacja.poCit}
                  mocne
                />
              </div>
            </div>

            <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-przygaszony ring-1 ring-white/10">
              ⚠ Symulacja poglądowa — nie podstawa do rozliczeń. Zweryfikuj z
              księgową.
            </p>
          </div>
        </div>

        {/* ───────── PRAWA: Oferta (podgląd klienta) ───────── */}
        <div className="space-y-2">
          <p className="text-sm text-przygaszony">
            Podgląd oferty — to widzi klient
          </p>
          <OfertaWidok
            numer={zlecenie.numer}
            nazwa={zlecenie.nazwa}
            telefon={zlecenie.telefon}
            tytul={prog.etykieta}
            cena={cena}
          />
        </div>
      </div>

      {/* Akcje — wycena zapisuje się automatycznie (autosave) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-secondary"
        >
          Eksport oferty PDF
        </button>
        <div className="flex items-center gap-4">
          {komunikat ? (
            <span className="text-sm text-akcent">{komunikat}</span>
          ) : (
            <span className="text-xs text-przygaszony">
              Zmiany zapisują się automatycznie.
            </span>
          )}
        </div>
      </div>

      {/* Wersja do druku — ukryta na ekranie, pokazywana tylko przy window.print().
          Zawiera WYŁĄCZNIE ofertę (bez kalkulacji, kosztów, zarobku). */}
      <div id="oferta-druk">
        <OfertaWidok
          numer={zlecenie.numer}
          nazwa={zlecenie.nazwa}
          telefon={zlecenie.telefon}
          tytul={prog.etykieta}
          cena={cena}
        />
      </div>
    </div>
  )
}

// Podpowiedź pod suwakiem — kolor i treść wg progów aktywnego typu.
function Podpowiedz({
  zarobek,
  marza,
  prog,
}: {
  zarobek: number
  marza: number
  prog: ReturnType<typeof progDlaTypu>
}) {
  let klasy: string
  let tresc: string

  if (zarobek < prog.min) {
    klasy = 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
    tresc = `⚠ Poniżej Twojego minimum (${formatZl(prog.min)}). Tu nie schodź.`
  } else if (zarobek < prog.standard) {
    klasy = 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
    tresc = `Bezpiecznie — klient prawie pewnie weźmie. Czysta marża ${marza}%.`
  } else if (zarobek < prog.premium) {
    klasy = 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
    tresc = `Twój standard. Dobry sweet spot. Czysta marża ${marza}%.`
  } else {
    klasy = 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
    tresc = `Poziom premium — dla klienta z polecenia, który Ci ufa. Czysta marża ${marza}%.`
  }

  return (
    <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${klasy}`}>{tresc}</div>
  )
}

// Wiersz w panelu symulacji podatkowej: etykieta + kwota (ujemne na czerwono).
function WierszPodatek({
  label,
  wartosc,
  mocne = false,
}: {
  label: string
  wartosc: number
  mocne?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={mocne ? 'text-krem' : 'text-przygaszony'}>{label}</span>
      <span
        className={`tabular-nums ${mocne ? 'font-semibold ' : ''}${
          wartosc < 0 ? 'text-rose-300' : 'text-krem'
        }`}
      >
        {formatZl(wartosc)}
      </span>
    </div>
  )
}
