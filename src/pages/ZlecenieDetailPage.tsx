import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { STATUSY, ETAPY } from '../constants/enums'
import type { Zlecenie, ZlecenieUpdate } from '../lib/types'
import Spinner from '../components/Spinner'
import Komentarze from '../components/Komentarze'

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

  // Stan formularza (edytowalna kopia zlecenia).
  const [form, setForm] = useState<Zlecenie | null>(null)
  const [zapis, setZapis] = useState(false)
  const [komunikat, setKomunikat] = useState<string | null>(null)

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

  // Pomocnik do aktualizacji pojedynczego pola formularza.
  function ustaw<K extends keyof Zlecenie>(klucz: K, wartosc: Zlecenie[K]) {
    setForm((f) => (f ? { ...f, [klucz]: wartosc } : f))
    setKomunikat(null)
  }

  async function zapiszZmiany() {
    if (!form || !id) return
    setZapis(true)
    setKomunikat(null)

    const zmiany: ZlecenieUpdate = {
      numer: form.numer.trim(),
      nazwa: form.nazwa.trim(),
      status: form.status,
      etap: form.etap,
      data_montazu: form.data_montazu,
      data_max: form.data_max,
      adres: form.adres,
      link_maps: form.link_maps,
      telefon: form.telefon,
      kwota_umowa: form.kwota_umowa,
      odpowiedzialny: form.odpowiedzialny,
      projekt_sprawdzony: form.projekt_sprawdzony,
      protokol_odbioru: form.protokol_odbioru,
    }

    const { data, error } = await supabase
      .from('zlecenia')
      .update(zmiany)
      .eq('id', id)
      .select('*')
      .single()

    setZapis(false)

    if (error) {
      setKomunikat(
        error.code === '23505'
          ? 'Zlecenie o tym numerze już istnieje.'
          : 'Nie udało się zapisać zmian.'
      )
      return
    }
    setForm(data)
    setKomunikat('Zapisano zmiany.')
  }

  // Archiwizacja / przywrócenie zlecenia.
  async function przelaczArchiwum() {
    if (!form || !id) return
    const nowy = !form.zarchiwizowane
    setZapis(true)
    const { data, error } = await supabase
      .from('zlecenia')
      .update({ zarchiwizowane: nowy })
      .eq('id', id)
      .select('*')
      .single()
    setZapis(false)
    if (!error && data) {
      setForm(data)
      // Po archiwizacji wracamy do listy.
      navigate('/')
    }
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
              className="pole"
            />
          </div>
          <div>
            <label className="etykieta">Nazwa</label>
            <input
              value={form.nazwa}
              onChange={(e) => ustaw('nazwa', e.target.value)}
              className="pole"
            />
          </div>
        </div>
      </div>

      {/* Szczegóły zlecenia */}
      <div className="karta space-y-5 p-6">
        <h2 className="text-xl">Szczegóły</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etykieta">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                ustaw('status', e.target.value as Zlecenie['status'])
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
              onChange={(e) => ustaw('etap', e.target.value as Zlecenie['etap'])}
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
              onChange={(e) => ustaw('data_montazu', pustyNaNull(e.target.value))}
              className="pole"
            />
          </div>

          <div>
            <label className="etykieta">Data maksymalna (deadline)</label>
            <input
              type="date"
              value={form.data_max ?? ''}
              onChange={(e) => ustaw('data_max', pustyNaNull(e.target.value))}
              className="pole"
            />
          </div>

          <div>
            <label className="etykieta">Telefon</label>
            <input
              value={form.telefon ?? ''}
              onChange={(e) => ustaw('telefon', pustyNaNull(e.target.value))}
              className="pole"
              placeholder="np. 600 100 200"
            />
          </div>

          <div>
            <label className="etykieta">Kwota na umowie (zł)</label>
            <input
              type="number"
              step="0.01"
              value={form.kwota_umowa ?? ''}
              onChange={(e) =>
                ustaw(
                  'kwota_umowa',
                  e.target.value === '' ? null : Number(e.target.value)
                )
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
              className="pole"
              placeholder="ul. Przykładowa 1, 00-000 Miasto"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etykieta">Link do Google Maps</label>
            <input
              value={form.link_maps ?? ''}
              onChange={(e) => ustaw('link_maps', pustyNaNull(e.target.value))}
              className="pole"
              placeholder="https://maps.google.com/…"
            />
          </div>

          <div>
            <label className="etykieta">Odpowiedzialny</label>
            <select
              value={form.odpowiedzialny ?? ''}
              onChange={(e) =>
                ustaw('odpowiedzialny', e.target.value || null)
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
              onChange={(e) => ustaw('projekt_sprawdzony', e.target.checked)}
              className="h-4 w-4 accent-akcent"
            />
            Projekt sprawdzony
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.protokol_odbioru}
              onChange={(e) => ustaw('protokol_odbioru', e.target.checked)}
              className="h-4 w-4 accent-akcent"
            />
            Protokół odbioru
          </label>
        </div>

        {/* Metadane */}
        <p className="border-t border-white/10 pt-4 text-xs text-przygaszony">
          Utworzył: {nazwa(form.utworzyl)}
        </p>

        {/* TODO Etap 2: wycena (kalkulator, kalkulacja kosztów, marża) */}
        {/* TODO Etap 3: zadania, akcesoria, AGD */}
        {/* TODO Etap 4: załączniki / pliki */}

        {/* Akcje */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
          <button
            onClick={przelaczArchiwum}
            disabled={zapis}
            className="btn-secondary"
          >
            {form.zarchiwizowane ? 'Przywróć z archiwum' : 'Archiwizuj'}
          </button>

          <div className="flex items-center gap-4">
            {komunikat && (
              <span className="text-sm text-przygaszony">{komunikat}</span>
            )}
            <button
              onClick={zapiszZmiany}
              disabled={zapis}
              className="btn-primary"
            >
              {zapis ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>

      {/* Komentarze */}
      <Komentarze zlecenieId={form.id} />
    </div>
  )
}
