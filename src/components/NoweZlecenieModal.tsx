import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

// Separator między numerem a właściwą nazwą zlecenia, np. "Z66 — Garderoba".
const SEP = ' — '

// Wylicza kolejny wolny numer w formacie "Z" + liczba.
// Sortuje po WARTOŚCI liczbowej (nie alfabetycznie), więc Z100 > Z9.
// Brak pasujących numerów → "Z1".
function nastepnyNumer(numery: string[]): string {
  let max = 0
  for (const n of numery) {
    const m = /^z0*(\d+)/i.exec(n.trim())
    if (m) {
      const val = parseInt(m[1], 10)
      if (val > max) max = val
    }
  }
  return `Z${max + 1}`
}

// Modal tworzenia nowego zlecenia — pyta tylko o numer i nazwę,
// resztę pól uzupełnia się już na karcie zlecenia.
export default function NoweZlecenieModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [numer, setNumer] = useState('')
  const [nazwa, setNazwa] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [zapis, setZapis] = useState(false)
  const [podpowiedziano, setPodpowiedziano] = useState(false)
  const nazwaRef = useRef<HTMLInputElement>(null)

  // Po otwarciu modala pobieramy numery WSZYSTKICH zleceń (aktywnych
  // i zarchiwizowanych) i podpowiadamy kolejny wolny numer.
  useEffect(() => {
    let aktualne = true
    supabase
      .from('zlecenia')
      .select('numer')
      .then(({ data, error }) => {
        if (!aktualne) return
        const next = error
          ? 'Z1'
          : nastepnyNumer((data ?? []).map((z) => z.numer ?? ''))
        setNumer(next)
        setNazwa(next + SEP)
        setPodpowiedziano(true)
      })
    return () => {
      aktualne = false
    }
  }, [])

  // Gdy podpowiedź jest gotowa — ustawiamy kursor w polu "Nazwa" na końcu
  // prefiksu, żeby od razu dopisać resztę nazwy.
  useEffect(() => {
    if (!podpowiedziano) return
    const el = nazwaRef.current
    if (!el) return
    el.focus()
    const koniec = el.value.length
    el.setSelectionRange(koniec, koniec)
  }, [podpowiedziano])

  // Zmiana numeru aktualizuje też prefiks w nazwie — ale tylko gdy użytkownik
  // nie zaczął jeszcze wpisywać własnego tekstu po prefiksie.
  function zmienNumer(nowy: string) {
    const staryPrefiks = numer + SEP
    const nowyPrefiks = nowy.trim() ? nowy + SEP : ''
    setNazwa((stara) => {
      if (stara === '' || stara === staryPrefiks) return nowyPrefiks
      if (stara.startsWith(staryPrefiks)) {
        return nowyPrefiks + stara.slice(staryPrefiks.length)
      }
      // Użytkownik wpisał nazwę niezgodną z prefiksem — nie ruszamy jej.
      return stara
    })
    setNumer(nowy)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBlad(null)
    setZapis(true)

    const { data, error } = await supabase
      .from('zlecenia')
      .insert({
        numer: numer.trim(),
        nazwa: nazwa.trim(),
        utworzyl: user?.id ?? null,
      })
      .select('id')
      .single()

    setZapis(false)

    if (error) {
      // 23505 = naruszenie unikalności (numer już istnieje)
      if (error.code === '23505') {
        setBlad('Zlecenie o tym numerze już istnieje.')
      } else {
        setBlad('Nie udało się utworzyć zlecenia. Spróbuj ponownie.')
      }
      return
    }

    onCreated(data.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="karta w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl">Nowe zlecenie</h2>
        <p className="mb-5 text-sm text-przygaszony">
          Podaj numer i nazwę. Pozostałe szczegóły uzupełnisz na karcie.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="numer" className="etykieta">
              Numer
            </label>
            <input
              id="numer"
              required
              value={numer}
              onChange={(e) => zmienNumer(e.target.value)}
              className="pole"
              placeholder="np. Z63"
            />
          </div>

          <div>
            <label htmlFor="nazwa" className="etykieta">
              Nazwa
            </label>
            <input
              id="nazwa"
              ref={nazwaRef}
              required
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              className="pole"
              placeholder="np. Z66 — Luciny garderoba"
            />
          </div>

          {blad && (
            <p className="rounded-lg bg-akcent/10 px-3 py-2 text-sm text-akcent ring-1 ring-akcent/30">
              {blad}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Anuluj
            </button>
            <button type="submit" disabled={zapis} className="btn-primary">
              {zapis ? 'Tworzenie…' : 'Utwórz i otwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
