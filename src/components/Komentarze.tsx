import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { formatDataGodzina } from '../lib/format'
import type { Komentarz } from '../lib/types'
import Spinner from './Spinner'

// Sekcja komentarzy zlecenia — odwzorowuje sposób, w jaki wspólnicy
// zostawiają sobie ustalenia ("Do sprawdzenia przed zamówieniem…").
export default function Komentarze({ zlecenieId }: { zlecenieId: string }) {
  const { user } = useAuth()
  const { nazwa } = useProfile()

  const [komentarze, setKomentarze] = useState<Komentarz[]>([])
  const [loading, setLoading] = useState(true)
  const [tresc, setTresc] = useState('')
  const [wysylanie, setWysylanie] = useState(false)

  useEffect(() => {
    let aktywne = true
    setLoading(true)
    supabase
      .from('komentarze')
      .select('*')
      .eq('zlecenie_id', zlecenieId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!aktywne) return
        setKomentarze(data ?? [])
        setLoading(false)
      })
    return () => {
      aktywne = false
    }
  }, [zlecenieId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const czysta = tresc.trim()
    if (!czysta || !user) return

    setWysylanie(true)
    const { data, error } = await supabase
      .from('komentarze')
      .insert({ zlecenie_id: zlecenieId, autor: user.id, tresc: czysta })
      .select('*')
      .single()
    setWysylanie(false)

    if (!error && data) {
      setKomentarze((prev) => [...prev, data])
      setTresc('')
    }
  }

  return (
    <section className="karta p-6">
      <h2 className="mb-4 text-xl">Komentarze</h2>

      {loading ? (
        <Spinner />
      ) : komentarze.length === 0 ? (
        <p className="mb-4 text-sm text-przygaszony">
          Brak komentarzy. Dodaj pierwszą notatkę dla zespołu.
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {komentarze.map((k) => (
            <li key={k.id} className="rounded-lg bg-panel p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-krem">
                  {nazwa(k.autor)}
                </span>
                <span className="text-xs text-przygaszony">
                  {formatDataGodzina(k.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-krem/90">
                {k.tresc}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          className="pole min-h-[90px] resize-y"
          placeholder="Napisz komentarz dla zespołu…"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={wysylanie || !tresc.trim()}
            className="btn-primary"
          >
            {wysylanie ? 'Dodawanie…' : 'Dodaj komentarz'}
          </button>
        </div>
      </form>
    </section>
  )
}
