import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatZl } from '../lib/format'
import {
  symulacjaPodatkowa,
  zakresOkresu,
  dodajDni,
  wZakresie,
  dniMiedzy,
  OKRESY,
  DNI_TERMIN_FAKTURY,
  DNI_TERMIN_HURTOWNI,
  type Okres,
} from '../lib/finanse'
import Spinner from '../components/Spinner'

// ── Lekkie modele na potrzeby zbiorczych wyliczeń ───────────────
interface RataFin {
  etap: number
  kwota: number
  zaplacone: boolean
  faktura_wystawiona: boolean
  faktura_wystawiona_at: string | null
}
interface ZlecenieFin {
  id: string
  numer: string
  nazwa: string
  kwota_umowa: number | null
  created_at: string
  zamowiono_materialy: boolean
  zamowiono_materialy_at: string | null
  kosztyRazem: number
  zarobek: number
  raty: RataFin[]
}

function fmtData(d: Date): string {
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function FinansePage() {
  const navigate = useNavigate()
  const [okres, setOkres] = useState<Okres>('miesiac')
  const [zlecenia, setZlecenia] = useState<ZlecenieFin[]>([])
  const [loading, setLoading] = useState(true)

  // Wczytanie wszystkich zleceń + wycen + płatności (łączymy w pamięci).
  // Wliczamy też zarchiwizowane — to głównie zakończone zlecenia tworzące wynik.
  useEffect(() => {
    let aktywne = true
    async function zaladuj() {
      setLoading(true)
      const [zl, wy, pl] = await Promise.all([
        supabase
          .from('zlecenia')
          .select(
            'id, numer, nazwa, kwota_umowa, created_at, zamowiono_materialy, zamowiono_materialy_at'
          ),
        supabase.from('wyceny').select('zlecenie_id, koszty, zarobek'),
        supabase
          .from('platnosci')
          .select(
            'zlecenie_id, etap, kwota, zaplacone, faktura_wystawiona, faktura_wystawiona_at'
          ),
      ])

      const wyceny = new Map(
        (wy.data ?? []).map((w) => [
          w.zlecenie_id,
          {
            kosztyRazem: (w.koszty ?? []).reduce(
              (s, k) => s + (Number(k.v) || 0),
              0
            ),
            zarobek: Number(w.zarobek) || 0,
          },
        ])
      )

      const raty = new Map<string, RataFin[]>()
      for (const p of pl.data ?? []) {
        const arr = raty.get(p.zlecenie_id) ?? []
        arr.push({
          etap: p.etap,
          kwota: p.kwota,
          zaplacone: p.zaplacone,
          faktura_wystawiona: p.faktura_wystawiona,
          faktura_wystawiona_at: p.faktura_wystawiona_at,
        })
        raty.set(p.zlecenie_id, arr)
      }

      const wynik: ZlecenieFin[] = (zl.data ?? []).map((z) => ({
        id: z.id,
        numer: z.numer,
        nazwa: z.nazwa,
        kwota_umowa: z.kwota_umowa,
        created_at: z.created_at,
        zamowiono_materialy: z.zamowiono_materialy,
        zamowiono_materialy_at: z.zamowiono_materialy_at,
        kosztyRazem: wyceny.get(z.id)?.kosztyRazem ?? 0,
        zarobek: wyceny.get(z.id)?.zarobek ?? 0,
        raty: raty.get(z.id) ?? [],
      }))

      if (aktywne) {
        setZlecenia(wynik)
        setLoading(false)
      }
    }
    zaladuj()
    return () => {
      aktywne = false
    }
  }, [])

  // ── BLOK 1: prognozy (wpływy + wydatki) za WYBRANY okres ──────
  const prognozy = useMemo(() => {
    const { od, do_ } = zakresOkresu(okres)

    const wplywy: {
      id: string
      numer: string
      klient: string
      kwota: number
      data: Date
    }[] = []
    const wydatki: {
      id: string
      numer: string
      nazwa: string
      kwota: number
      data: Date
    }[] = []

    for (const z of zlecenia) {
      // Wpływy: faktura wysłana, niezapłacona, termin (faktura + 5 dni) w tygodniu.
      for (const r of z.raty) {
        if (
          r.faktura_wystawiona &&
          !r.zaplacone &&
          r.faktura_wystawiona_at
        ) {
          const termin = dodajDni(r.faktura_wystawiona_at, DNI_TERMIN_FAKTURY)
          if (wZakresie(termin, od, do_)) {
            wplywy.push({
              id: z.id,
              numer: z.numer,
              klient: z.nazwa,
              kwota: r.kwota,
              data: termin,
            })
          }
        }
      }
      // Wydatki: zamówiono materiały, termin hurtowni (+14 dni) w tygodniu.
      if (z.zamowiono_materialy && z.zamowiono_materialy_at) {
        const termin = dodajDni(z.zamowiono_materialy_at, DNI_TERMIN_HURTOWNI)
        if (wZakresie(termin, od, do_)) {
          wydatki.push({
            id: z.id,
            numer: z.numer,
            nazwa: z.nazwa,
            kwota: z.kosztyRazem,
            data: termin,
          })
        }
      }
    }
    wplywy.sort((a, b) => a.data.getTime() - b.data.getTime())
    wydatki.sort((a, b) => a.data.getTime() - b.data.getTime())
    const sumaWplywy = wplywy.reduce((s, x) => s + x.kwota, 0)
    const sumaWydatki = wydatki.reduce((s, x) => s + x.kwota, 0)
    return { wplywy, wydatki, sumaWplywy, sumaWydatki }
  }, [zlecenia, okres])

  // ── BLOK 2: do ściągnięcia / po terminie + brak zadatku ───────
  const alerty = useMemo(() => {
    const dzis = new Date()
    const poTerminie: {
      id: string
      numer: string
      klient: string
      kwota: number
      dniPo: number
    }[] = []
    const brakZadatku: {
      id: string
      numer: string
      nazwa: string
      kwota: number
      zamowioneMimo: boolean
    }[] = []

    for (const z of zlecenia) {
      for (const r of z.raty) {
        if (r.faktura_wystawiona && !r.zaplacone && r.faktura_wystawiona_at) {
          const termin = dodajDni(r.faktura_wystawiona_at, DNI_TERMIN_FAKTURY)
          const dniPo = dniMiedzy(termin, dzis)
          if (dniPo > 0) {
            poTerminie.push({
              id: z.id,
              numer: z.numer,
              klient: z.nazwa,
              kwota: r.kwota,
              dniPo,
            })
          }
        }
      }
      // Zadatek = pierwsza transza (etap 1, 40%). Nieopłacony → nie ruszać produkcji.
      const zadatek = z.raty.find((r) => r.etap === 1)
      if (zadatek && !zadatek.zaplacone) {
        brakZadatku.push({
          id: z.id,
          numer: z.numer,
          nazwa: z.nazwa,
          kwota: zadatek.kwota,
          zamowioneMimo: z.zamowiono_materialy,
        })
      }
    }
    poTerminie.sort((a, b) => b.dniPo - a.dniPo)
    return { poTerminie, brakZadatku }
  }, [zlecenia])

  // ── BLOK 3: wynik finansowy za okres (kotwica = created_at) ───
  const wynik = useMemo(() => {
    const { od, do_ } = zakresOkresu(okres)
    const wOkresie = zlecenia.filter((z) =>
      wZakresie(new Date(z.created_at), od, do_)
    )
    const przychody = wOkresie.reduce((s, z) => s + (z.kwota_umowa ?? 0), 0)
    const koszty = wOkresie.reduce((s, z) => s + z.kosztyRazem, 0)
    const zarobek = wOkresie.reduce((s, z) => s + z.zarobek, 0)
    const sym = symulacjaPodatkowa(koszty, przychody)
    return { liczba: wOkresie.length, przychody, koszty, zarobek, sym }
  }, [zlecenia, okres])

  if (loading) return <Spinner label="Wczytywanie finansów…" />

  // Etykieta + zakres dat wybranego okresu (do nagłówka prognoz).
  const zakres = zakresOkresu(okres)
  const etykietaOkresu = OKRESY.find((o) => o.value === okres)?.etykieta ?? ''
  const zakresTekst =
    zakres.od && zakres.do_
      ? `${fmtData(zakres.od)} – ${fmtData(
          new Date(zakres.do_.getTime() - 86_400_000)
        )}`
      : null

  return (
    <div className="space-y-6">
      {/* Nagłówek + przełącznik okresu (steruje blokiem "Wynik finansowy") */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Finanse</h1>
          <p className="mt-1 text-sm text-przygaszony">
            Przepływy, terminy i wynik — zbiorczo po wszystkich zleceniach
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-panel p-1">
          {OKRESY.map((o) => (
            <button
              key={o.value}
              onClick={() => setOkres(o.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                okres === o.value
                  ? 'bg-karta text-krem shadow'
                  : 'text-przygaszony hover:text-krem'
              }`}
            >
              {o.etykieta}
            </button>
          ))}
        </div>
      </div>

      {/* ───────── BLOK 1: Prognozy (za wybrany okres) ───────── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-krem">
          {etykietaOkresu}
          {zakresTekst && (
            <span className="ml-2 text-sm font-normal text-przygaszony">
              {zakresTekst}
            </span>
          )}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Wpływy */}
          <div className="karta p-5 ring-1 ring-emerald-500/20">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-przygaszony">
                Prognozowane wpływy
              </span>
              <span className="text-xl font-bold text-emerald-300">
                {formatZl(prognozy.sumaWplywy)}
              </span>
            </div>
            {prognozy.wplywy.length === 0 ? (
              <p className="text-sm text-przygaszony">
                Brak faktur z terminem w tym okresie.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prognozy.wplywy.map((w, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(`/zlecenie/${w.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-semibold text-krem">
                          {w.numer}
                        </span>{' '}
                        <span className="text-przygaszony">{w.klient}</span>
                      </span>
                      <span className="text-przygaszony">{fmtData(w.data)}</span>
                      <span className="w-24 text-right font-medium text-krem">
                        {formatZl(w.kwota)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Wydatki */}
          <div className="karta p-5 ring-1 ring-amber-500/20">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-przygaszony">
                Prognozowane wydatki (hurtownie)
              </span>
              <span className="text-xl font-bold text-amber-300">
                {formatZl(prognozy.sumaWydatki)}
              </span>
            </div>
            {prognozy.wydatki.length === 0 ? (
              <p className="text-sm text-przygaszony">
                Brak terminów zapłaty hurtowni w tym okresie.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prognozy.wydatki.map((w, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(`/zlecenie/${w.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-semibold text-krem">
                          {w.numer}
                        </span>{' '}
                        <span className="text-przygaszony">{w.nazwa}</span>
                      </span>
                      <span className="text-przygaszony">{fmtData(w.data)}</span>
                      <span className="w-24 text-right font-medium text-krem">
                        {formatZl(w.kwota)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ───────── BLOK 2: Do ściągnięcia / po terminie ───────── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-krem">
          Do ściągnięcia / po terminie
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Po terminie */}
          <div className="karta p-5 ring-1 ring-rose-500/20">
            <p className="mb-3 text-sm text-przygaszony">
              Faktury po terminie (do ścigania)
            </p>
            {alerty.poTerminie.length === 0 ? (
              <p className="text-sm text-przygaszony">
                Nic po terminie. 👌
              </p>
            ) : (
              <ul className="space-y-1.5">
                {alerty.poTerminie.map((w, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(`/zlecenie/${w.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-semibold text-krem">
                          {w.numer}
                        </span>{' '}
                        <span className="text-przygaszony">{w.klient}</span>
                      </span>
                      <span className="font-medium text-rose-300">
                        {w.dniPo} {w.dniPo === 1 ? 'dzień' : 'dni'} po terminie
                      </span>
                      <span className="w-24 text-right font-medium text-krem">
                        {formatZl(w.kwota)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Brak zadatku — nie zamawiaj bez zadatku */}
          <div className="karta p-5 ring-1 ring-rose-500/20">
            <p className="mb-3 text-sm text-przygaszony">
              Nie zamawiaj bez zadatku (nieopłacona 1. transza)
            </p>
            {alerty.brakZadatku.length === 0 ? (
              <p className="text-sm text-przygaszony">
                Wszystkie zadatki opłacone. 👌
              </p>
            ) : (
              <ul className="space-y-1.5">
                {alerty.brakZadatku.map((w, i) => (
                  <li key={i}>
                    <button
                      onClick={() => navigate(`/zlecenie/${w.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-semibold text-krem">
                          {w.numer}
                        </span>{' '}
                        <span className="text-przygaszony">{w.nazwa}</span>
                        {w.zamowioneMimo && (
                          <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-300">
                            ⚠ materiały zamówione bez zadatku
                          </span>
                        )}
                      </span>
                      <span className="w-24 text-right font-medium text-krem">
                        {formatZl(w.kwota)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ───────── BLOK 3: Wynik finansowy (za okres) ───────── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-krem">
          Wynik finansowy
          <span className="ml-2 text-sm font-normal text-przygaszony">
            {OKRESY.find((o) => o.value === okres)?.etykieta} · {wynik.liczba}{' '}
            {wynik.liczba === 1 ? 'zlecenie' : 'zleceń'}
          </span>
        </h2>
        <div className="karta space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Kafelek label="Przychody (umowy)" wartosc={wynik.przychody} />
            <Kafelek label="Koszty (z wycen)" wartosc={wynik.koszty} />
            <Kafelek label="Zarobek" wartosc={wynik.zarobek} mocne />
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
            <div>
              <WierszPodatek
                label="VAT mebli (należny − naliczony)"
                wartosc={wynik.sym.vatMebli}
                mocne
              />
              {wynik.sym.vatMebli < 0 && (
                <p className="mt-1 text-xs text-przygaszony">
                  nadwyżka VAT naliczonego — wchodzi do ogólnego rozliczenia VAT
                  spółki
                </p>
              )}
            </div>
            <div className="space-y-2 border-t border-white/10 pt-2">
              <WierszPodatek
                label="Dochód (podstawa CIT)"
                wartosc={wynik.sym.dochod}
              />
              <WierszPodatek label="CIT 9%" wartosc={wynik.sym.cit} />
              <WierszPodatek
                label="Zostaje po CIT"
                wartosc={wynik.sym.poCit}
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
    </div>
  )
}

// Kafelek liczbowy w bloku wyniku finansowego.
function Kafelek({
  label,
  wartosc,
  mocne = false,
}: {
  label: string
  wartosc: number
  mocne?: boolean
}) {
  return (
    <div className="rounded-lg bg-panel px-4 py-3">
      <p className="text-xs text-przygaszony">{label}</p>
      <p
        className={`mt-0.5 font-semibold text-krem ${
          mocne ? 'text-2xl' : 'text-xl'
        }`}
      >
        {formatZl(wartosc)}
      </p>
    </div>
  )
}

// Wiersz etykieta + kwota (ujemne na czerwono) — jak w panelu Wyceny.
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
