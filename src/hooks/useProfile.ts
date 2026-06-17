import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profil } from '../lib/types'

// Do dropdownu i nazw potrzebujemy tylko trzech pól.
export type ProfilSkrot = Pick<Profil, 'id' | 'email' | 'imie'>

// Ładuje listę użytkowników firmy (mały zespół 2–4 osób) i udostępnia
// mapę id → czytelna nazwa. Wykorzystywane w dropdownie "odpowiedzialny"
// oraz przy wyświetlaniu autorów komentarzy.
export function useProfile() {
  const [profile, setProfile] = useState<ProfilSkrot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aktywne = true
    supabase
      .from('profil')
      .select('id, email, imie')
      .order('imie', { ascending: true })
      .then(({ data }) => {
        if (aktywne) {
          setProfile(data ?? [])
          setLoading(false)
        }
      })
    return () => {
      aktywne = false
    }
  }, [])

  // Czytelna nazwa użytkownika: imię, a w razie braku — e-mail.
  function nazwa(id: string | null | undefined): string {
    if (!id) return '—'
    const p = profile.find((x) => x.id === id)
    return p?.imie || p?.email || 'Nieznany użytkownik'
  }

  return { profile, loading, nazwa }
}
