// ─────────────────────────────────────────────────────────────
// Typy domenowe + typ bazy danych dla klienta Supabase.
//
// Struktura "Database" jest zgodna z konwencją supabase-js, dzięki
// czemu zapytania są typowane. Przy rozbudowie (Etap 2–4) dopisuj
// kolejne tabele i pola tutaj.
// ─────────────────────────────────────────────────────────────

export type Status = 'nowy' | 'w_trakcie' | 'wstrzymane' | 'zakonczone'

export type Etap =
  | 'wycena'
  | 'przeslano_do_klienta'
  | 'projekt_na_gotowo'
  | 'w_produkcji'
  | 'montaz'
  | 'odbior'

// Uwaga: typy wierszy to aliasy `type`, nie `interface` — dzięki temu
// pasują do `Record<string, unknown>` wymaganego przez typy supabase-js.
export type Zlecenie = {
  id: string
  numer: string
  nazwa: string
  status: Status
  etap: Etap
  data_montazu: string | null
  data_max: string | null
  adres: string | null
  link_maps: string | null
  telefon: string | null
  kwota_umowa: number | null
  projekt_sprawdzony: boolean
  protokol_odbioru: boolean
  utworzyl: string | null
  odpowiedzialny: string | null
  zarchiwizowane: boolean
  created_at: string
  // TODO Etap 2: pola wyceny (np. kalkulacja, marża)
  // TODO Etap 3: zadania, akcesoria, AGD, załączniki
}

// Pola, które ustawiamy przy tworzeniu nowego zlecenia.
export type ZlecenieInsert = Pick<Zlecenie, 'numer' | 'nazwa'> &
  Partial<Omit<Zlecenie, 'id' | 'created_at'>>

// Pola, które można aktualizować na karcie zlecenia.
export type ZlecenieUpdate = Partial<Omit<Zlecenie, 'id' | 'created_at'>>

export type Komentarz = {
  id: string
  zlecenie_id: string
  autor: string
  tresc: string
  created_at: string
}

export type KomentarzInsert = Pick<Komentarz, 'zlecenie_id' | 'autor' | 'tresc'>

export type Profil = {
  id: string
  email: string | null
  imie: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Typ bazy danych dla createClient<Database>()
// ─────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      zlecenia: {
        Row: Zlecenie
        Insert: ZlecenieInsert
        Update: ZlecenieUpdate
        Relationships: []
      }
      komentarze: {
        Row: Komentarz
        Insert: KomentarzInsert
        Update: Partial<KomentarzInsert>
        Relationships: []
      }
      profil: {
        Row: Profil
        Insert: Partial<Profil> & Pick<Profil, 'id'>
        Update: Partial<Profil>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
