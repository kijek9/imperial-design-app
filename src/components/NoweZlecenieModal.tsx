import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

// Modal tworzenia nowego zlecenia — pyta tylko o numer i nazwę,
// resztę pól uzupełnia się już na karcie zlecenia.
export default function NoweZlecenieModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [numer, setNumer] = useState('')
  const [nazwa, setNazwa] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [zapis, setZapis] = useState(false)

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
              onChange={(e) => setNumer(e.target.value)}
              className="pole"
              placeholder="np. Z63"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="nazwa" className="etykieta">
              Nazwa
            </label>
            <input
              id="nazwa"
              required
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              className="pole"
              placeholder="np. Z63 — Luciny garderoba"
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
