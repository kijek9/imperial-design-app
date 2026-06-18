import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { STATUSY, ETAPY } from '../constants/enums'
import type { Zlecenie, ZlecenieUpdate, TematOtwarty } from '../lib/types'
import Spinner from '../components/Spinner'
import Komentarze from '../components/Komentarze'
import Wycena from '../components/Wycena'
import Platnosci from '../components/Platnosci'

type Zakladka = 'szczegoly' | 'wycena' | 'platnosci'

// Konwersja: '' z formularza → null do bazy (dla pól opcjonalnych).
function pustyNaNull(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

export default function ZlecenieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, nazwa } = useProfile()

  const [loading, setLoading] = useState(true)
  const [nieznalezione, setNieznalezione] = useState(false)
  const [zakladka, setZakladka] = useState<Zakladka>('szczegoly')

  // Lokalne (niezapisywane w bazie) położenie sekcji Pomiar: góra / dół.
  const [pomiarNaDole, setPomiarNaDole] = useState(false)

  // Stan formularza (edytowalna kopia zlecenia).
  const [form, setForm] = useState<Zlecenie | null>(null)
  const [zajety, setZajety] = useState(false) // blokada przycisku Archiwizuj
  // Dyskretny sygnał autozapisu + ewentualny komunikat błędu.
  const [zapisano, setZapisano] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const zapisanoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  // Krótki błysk „Zapisano" po udanym autozapisie.
  function pokazZapisano() {
    setBlad(null)
    setZapisano(true)
    clearTimeout(zapisanoTimer.current)
    zapisanoTimer.current = setTimeout(() => setZapisano(false), 1500)
  }
  useEffect(() => () => clearTimeout(zapisanoTimer.current), [])

  // Autozapis: utrwala podany zestaw pól zlecenia od razu do bazy.
  async function zapiszPatch(patch: ZlecenieUpdate) {
    if (!id) return
    const { error } = await supabase.from('zlecenia').update(patch).eq('id', id)
    if (error) {
      setZapisano(false)
      setBlad(
        error.code === '23505'
          ? 'Zlecenie o tym numerze już istnieje.'
          : 'Nie udało się zapisać zmiany.'
      )
    } else {
      pokazZapisano()
    }
  }

  useEffect(() => {
    if (!id) return
    let aktywne = true
    setLoading(true)

    supabase
      .from('zlecenia')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!aktywne) return
        if (error || !data) {
          setNieznalezione(true)
        } else {
          setForm(data)
        }
        setLoading(false)
      })

    return () => {
      aktywne = false
    }
  }, [id])

  // Zmiana pola tylko lokalnie — dla pól tekstowych (zapis nastąpi na onBlur).
  function ustaw<K extends keyof Zlecenie>(klucz: K, wartosc: Zlecenie[K]) {
    setForm((f) => (f ? { ...f, [klucz]: wartosc } : f))
  }

  // Zmiana pola z natychmiastowym autozapisem — selecty, checkboxy, daty.
  function ustawZapisz<K extends keyof Zlecenie>(klucz: K, wartosc: Zlecenie[K]) {
    setForm((f) => (f ? { ...f, [klucz]: wartosc } : f))
    zapiszPatch({ [klucz]: wartosc } as ZlecenieUpdate)
  }

  // Zapis pojedynczego pola tekstowego po wyjściu z pola (onBlur).
  function zapiszPole<K extends keyof Zlecenie>(klucz: K) {
    if (!form) return
    zapiszPatch({ [klucz]: form[klucz] } as ZlecenieUpdate)
  }

  // numer / nazwa: przy zapisie przycinamy białe znaki.
  function zapiszPoleTrim(klucz: 'numer' | 'nazwa') {
    if (!form) return
    const wartosc = form[klucz].trim()
    if (wartosc !== form[klucz]) setForm({ ...form, [klucz]: wartosc })
    zapiszPatch({ [klucz]: wartosc })
  }

  // ── Tematy otwarte: autozapis listy (czyścimy puste wiersze przy zapisie) ─
  function zapiszTematy(lista: TematOtwarty[]) {
    zapiszPatch({
      tematy_otwarte: lista
        .map((t) => ({ ...t, tresc: t.tresc.trim() }))
        .filter((t) => t.tresc !== ''),
    })
  }

  // Dodanie pustej pozycji — lokalnie; zapis nastąpi po wpisaniu treści.
  function dodajTemat() {
    const nowy: TematOtwarty = {
      id: crypto.randomUUID(),
      tresc: '',
      domkniete: false,
    }
    setForm((f) =>
      f ? { ...f, tematy_otwarte: [...f.tematy_otwarte, nowy] } : f
    )
  }

  // Edycja treści — tylko lokalnie; utrwalenie na onBlur pola.
  function zmienTresc(id: string, tresc: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            tematy_otwarte: f.tematy_otwarte.map((t) =>
              t.id === id ? { ...t, tresc } : t
            ),
          }
        : f
    )
  }

  // Odhaczenie tematu — natychmiastowy autozapis.
  function przelaczTemat(id: string, domkniete: boolean) {
    if (!form) return
    const lista = form.tematy_otwarte.map((t) =>
      t.id === id ? { ...t, domkniete } : t
    )
    setForm({ ...form, tematy_otwarte: lista })
    zapiszTematy(lista)
  }

  // Usunięcie pozycji — natychmiastowy autozapis.
  function usunTemat(id: string) {
    if (!form) return
    const lista = form.tematy_otwarte.filter((t) => t.id !== id)
    setForm({ ...form, tematy_otwarte: lista })
    zapiszTematy(lista)
  }

  // Przywróć kwotę umowy z zapisanej wyceny (koszty + zarobek) i wyłącz
  // tryb ręczny, by znów była auto-synchronizowana.
  async function przywrocZWyceny() {
    if (!form || !id) return
    setBlad(null)
    const { data: w } = await supabase
      .from('wyceny')
      .select('koszty, zarobek')
      .eq('zlecenie_id', id)
      .maybeSingle()

    if (!w) {
      setBlad('Brak zapisanej wyceny dla tego zlecenia.')
      return
    }
    const kosztyRazem = (w.koszty ?? []).reduce(
      (s, k) => s + (Number(k.v) || 0),
      0
    )
    const cena = kosztyRazem + w.zarobek

    const { data, error } = await supabase
      .from('zlecenia')
      .update({ kwota_umowa: cena, kwota_umowa_reczna: false })
      .eq('id', id)
      .select('*')
      .single()
    if (!error && data) {
      setForm(data)
      pokazZapisano()
    }
  }

  // Archiwizacja / przywrócenie zlecenia.
  async function przelaczArchiwum() {
    if (!form || !id) return
    const nowy = !form.zarchiwizowane
    setZajety(true)
    const { data, error } = await supabase
      .from('zlecenia')
      .update({ zarchiwizowane: nowy })
      .eq('id', id)
      .select('*')
      .single()
    setZajety(false)
    if (!error && data) {
      setForm(data)
      // Po archiwizacji wracamy do listy.
      navigate('/')
    }
  }

  // ── Sekcja Pomiar (renderowana na górze lub na dole zakładki) ─────────
  function sekcjaPomiar() {
    if (!form) return null
    return (
      <div className="karta space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl">Pomiar</h2>
          <button
            type="button"
            onClick={() => setPomiarNaDole((v) => !v)}
            className="btn-ghost text-sm"
          >
            {pomiarNaDole ? '↑ Przesuń na górę' : '↓ Przesuń na dół'}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etykieta">Data pomiaru</label>
            <input
              type="date"
              value={form.data_pomiaru ?? ''}
              onChange={(e) =>
                ustawZapisz('data_pomiaru', pustyNaNull(e.target.value))
              }
              className="pole"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etykieta">Link do folderu Google Drive</label>
            <div className="flex items-center gap-2">
              <input
                value={form.drive_link ?? ''}
                onChange={(e) =>
                  ustaw('drive_link', pustyNaNull(e.target.value))
                }
                onBlur={() => zapiszPole('drive_link')}
                className="pole flex-1"
                placeholder="https://drive.google.com/…"
              />
              {form.drive_link && (
                <a
                  href={form.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary whitespace-nowrap"
                >
                  Otwórz materiały
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.pomiar_wykonany}
              onChange={(e) => ustawZapisz('pomiar_wykonany', e.target.checked)}
              className="h-4 w-4 accent-akcent"
            />
            Pomiar wykonany
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.przekazany_do_rysowania}
              onChange={(e) =>
                ustawZapisz('przekazany_do_rysowania', e.target.checked)
              }
              className="h-4 w-4 accent-akcent"
            />
            Przekazany do rysowania
          </label>
        </div>
      </div>
    )
  }

  // ── Sekcja Tematy otwarte ─────────────────────────────────────────────
  function sekcjaTematy() {
    if (!form) return null
    return (
      <div className="karta space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl">Tematy otwarte</h2>
            <p className="mt-1 text-sm text-przygaszony">
              Lista spraw do domknięcia. Odhacz, gdy temat załatwiony.
            </p>
          </div>
          <button
            type="button"
            onClick={dodajTemat}
            className="btn-secondary whitespace-nowrap"
          >
            + dodaj temat
          </button>
        </div>

        {form.tematy_otwarte.length === 0 ? (
          <p className="text-sm text-przygaszony">Brak tematów.</p>
        ) : (
          <ul className="space-y-2">
            {form.tematy_otwarte.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.domkniete}
                  onChange={(e) => przelaczTemat(t.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-akcent"
                />
                <input
                  value={t.tresc}
                  onChange={(e) => zmienTresc(t.id, e.target.value)}
                  onBlur={() => form && zapiszTematy(form.tematy_otwarte)}
                  className={`pole flex-1 ${
                    t.domkniete ? 'text-przygaszony line-through' : ''
                  }`}
                  placeholder="Opisz temat do domknięcia…"
                />
                <button
                  type="button"
                  onClick={() => usunTemat(t.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-przygaszony transition hover:bg-white/10 hover:text-krem"
                  aria-label="Usuń temat"
                  title="Usuń temat"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (loading) {
    return <Spinner label="Wczytywanie zlecenia…" />
  }

  if (nieznalezione || !form) {
    return (
      <div className="karta p-10 text-center">
        <p className="mb-4 text-przygaszony">Nie znaleziono zlecenia.</p>
        <Link to="/" className="btn-secondary">
          ← Wróć do listy
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pasek powrotu */}
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="btn-ghost">
          ← Lista zleceń
        </Link>
        {form.zarchiwizowane && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-przygaszony">
            Zarchiwizowane
          </span>
        )}
      </div>

      {/* Nagłówek — numer + nazwa (edytowalne) */}
      <div className="karta space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="etykieta">Numer</label>
            <input
              value={form.numer}
              onChange={(e) => ustaw('numer', e.target.value)}
              onBlur={() => zapiszPoleTrim('numer')}
              className="pole"
            />
          </div>
          <div>
            <label className="etykieta">Nazwa</label>
            <input
              value={form.nazwa}
              onChange={(e) => ustaw('nazwa', e.target.value)}
              onBlur={() => zapiszPoleTrim('nazwa')}
              className="pole"
            />
          </div>
        </div>
      </div>

      {/* Zakładki sekcji karty */}
      <div className="inline-flex rounded-lg border border-white/10 bg-panel p-1">
        <button
          onClick={() => setZakladka('szczegoly')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            zakladka === 'szczegoly'
              ? 'bg-karta text-krem shadow'
              : 'text-przygaszony hover:text-krem'
          }`}
        >
          Szczegóły
        </button>
        <button
          onClick={() => setZakladka('wycena')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            zakladka === 'wycena'
              ? 'bg-karta text-krem shadow'
              : 'text-przygaszony hover:text-krem'
          }`}
        >
          Wycena
        </button>
        <button
          onClick={() => setZakladka('platnosci')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            zakladka === 'platnosci'
              ? 'bg-karta text-krem shadow'
              : 'text-przygaszony hover:text-krem'
          }`}
        >
          Płatności
        </button>
      </div>

      {/* ───────── Zakładka: Płatności ───────── */}
      {zakladka === 'platnosci' && (
        <Platnosci
          zlecenie={form}
          onZlecenieUpdate={(patch) =>
            setForm((f) => (f ? { ...f, ...patch } : f))
          }
          onZapisano={pokazZapisano}
        />
      )}

      {/* ───────── Zakładka: Wycena ───────── */}
      {zakladka === 'wycena' && (
        <Wycena
          zlecenie={form}
          onKwotaUmowaZWyceny={(cena) =>
            setForm((f) =>
              f ? { ...f, kwota_umowa: cena, kwota_umowa_reczna: false } : f
            )
          }
          onZapisano={pokazZapisano}
        />
      )}

      {/* ───────── Zakładka: Szczegóły ───────── */}
      {zakladka === 'szczegoly' && (
      <div className="space-y-6">
        {!pomiarNaDole && sekcjaPomiar()}

      <div className="karta space-y-5 p-6">
        <h2 className="text-xl">Szczegóły</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etykieta">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                ustawZapisz('status', e.target.value as Zlecenie['status'])
              }
              className="pole"
            >
              {STATUSY.map((s) => (
                <option key={s.wartosc} value={s.wartosc}>
                  {s.etykieta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etykieta">Etap</label>
            <select
              value={form.etap}
              onChange={(e) =>
                ustawZapisz('etap', e.target.value as Zlecenie['etap'])
              }
              className="pole"
            >
              {ETAPY.map((et) => (
                <option key={et.wartosc} value={et.wartosc}>
                  {et.etykieta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etykieta">Data montażu</label>
            <input
              type="date"
              value={form.data_montazu ?? ''}
              onChange={(e) =>
                ustawZapisz('data_montazu', pustyNaNull(e.target.value))
              }
              className="pole"
            />
          </div>

          <div>
            <label className="etykieta">Data maksymalna (deadline)</label>
            <input
              type="date"
              value={form.data_max ?? ''}
              onChange={(e) =>
                ustawZapisz('data_max', pustyNaNull(e.target.value))
              }
              className="pole"
            />
          </div>

          <div>
            <label className="etykieta">Telefon</label>
            <input
              value={form.telefon ?? ''}
              onChange={(e) => ustaw('telefon', pustyNaNull(e.target.value))}
              onBlur={() => zapiszPole('telefon')}
              className="pole"
              placeholder="np. 600 100 200"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="etykieta mb-0">Kwota na umowie (zł)</label>
              {form.kwota_umowa_reczna && (
                <span className="flex items-center gap-2 text-xs text-przygaszony">
                  <span className="rounded bg-white/10 px-1.5 py-0.5">ręcznie</span>
                  <button
                    type="button"
                    onClick={przywrocZWyceny}
                    className="text-akcent hover:underline"
                  >
                    przywróć z wyceny
                  </button>
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={form.kwota_umowa ?? ''}
              onChange={(e) => {
                // Ręczna zmiana kwoty → przestajemy auto-synchronizować z wyceny.
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        kwota_umowa:
                          e.target.value === '' ? null : Number(e.target.value),
                        kwota_umowa_reczna: true,
                      }
                    : f
                )
              }}
              onBlur={() =>
                form &&
                zapiszPatch({
                  kwota_umowa: form.kwota_umowa,
                  kwota_umowa_reczna: form.kwota_umowa_reczna,
                })
              }
              className="pole"
              placeholder="np. 12500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etykieta">Adres</label>
            <input
              value={form.adres ?? ''}
              onChange={(e) => ustaw('adres', pustyNaNull(e.target.value))}
              onBlur={() => zapiszPole('adres')}
              className="pole"
              placeholder="ul. Przykładowa 1, 00-000 Miasto"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etykieta">Link do Google Maps</label>
            <input
              value={form.link_maps ?? ''}
              onChange={(e) => ustaw('link_maps', pustyNaNull(e.target.value))}
              onBlur={() => zapiszPole('link_maps')}
              className="pole"
              placeholder="https://maps.google.com/…"
            />
          </div>

          <div>
            <label className="etykieta">Odpowiedzialny</label>
            <select
              value={form.odpowiedzialny ?? ''}
              onChange={(e) =>
                ustawZapisz('odpowiedzialny', e.target.value || null)
              }
              className="pole"
            >
              <option value="">— nieprzypisane —</option>
              {profile.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.imie || p.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checkboxy */}
        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.projekt_sprawdzony}
              onChange={(e) =>
                ustawZapisz('projekt_sprawdzony', e.target.checked)
              }
              className="h-4 w-4 accent-akcent"
            />
            Projekt sprawdzony
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.protokol_odbioru}
              onChange={(e) =>
                ustawZapisz('protokol_odbioru', e.target.checked)
              }
              className="h-4 w-4 accent-akcent"
            />
            Protokół odbioru
          </label>
        </div>

        {/* Metadane */}
        <p className="border-t border-white/10 pt-4 text-xs text-przygaszony">
          Utworzył: {nazwa(form.utworzyl)}
        </p>

        {/* Etap 2: wycena → zakładka „Wycena" powyżej */}
        {/* TODO Etap 3: zadania, akcesoria, AGD */}
        {/* TODO Etap 4: załączniki / pliki */}
      </div>

        {sekcjaTematy()}

        {pomiarNaDole && sekcjaPomiar()}

        {/* Akcje — zmiany zapisują się automatycznie (autosave) */}
        <div className="karta flex flex-wrap items-center justify-between gap-4 p-6">
          <button
            onClick={przelaczArchiwum}
            disabled={zajety}
            className="btn-secondary"
          >
            {form.zarchiwizowane ? 'Przywróć z archiwum' : 'Archiwizuj'}
          </button>
          <span className="text-xs text-przygaszony">
            Zmiany zapisują się automatycznie.
          </span>
        </div>
      </div>
      )}

      {/* Komentarze */}
      <Komentarze zlecenieId={form.id} />

      {/* Dyskretny sygnał autozapisu (prawy dolny róg) */}
      {blad ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-akcent/15 px-3 py-1.5 text-sm text-akcent shadow ring-1 ring-akcent/30">
          {blad}
        </div>
      ) : zapisano ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300 shadow ring-1 ring-emerald-500/30">
          ✓ Zapisano
        </div>
      ) : null}
    </div>
  )
}
