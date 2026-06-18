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

// Pojedyncza pozycja na liście "Tematy otwarte" w zakładce Szczegóły.
// id jest generowane po stronie klienta (crypto.randomUUID) — służy tylko
// jako stabilny klucz Reacta, nie jest powiązane z żadną tabelą.
export type TematOtwarty = {
  id: string
  tresc: string
  domkniete: boolean
}

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
  // Etap 2: gdy true, kwota_umowa była ustawiona ręcznie (rabaty/negocjacje)
  // i NIE jest już auto-nadpisywana z wyceny.
  kwota_umowa_reczna: boolean
  // Szczegóły → sekcja Pomiar
  data_pomiaru: string | null
  pomiar_wykonany: boolean
  przekazany_do_rysowania: boolean
  // Znacznik czasu zaznaczenia "przekazany_do_rysowania" (ustawiany triggerem
  // w bazie). Pod automatyzację — w UI na razie nieużywany.
  przekazany_do_rysowania_at: string | null
  drive_link: string | null
  // Szczegóły → sekcja Tematy otwarte
  tematy_otwarte: TematOtwarty[]
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
// Etap 2 — Wycena
// ─────────────────────────────────────────────────────────────

// Typ zlecenia decyduje o progach czystego zarobku (patrz constants/wycena.ts).
export type TypWyceny = 'szafka' | 'szafa' | 'duza' | 'kuchnia'

// Pojedyncza pozycja kosztu w kalkulacji: l = etykieta, v = kwota (zł).
export type KosztPozycja = { l: string; v: number }

export type Wycena = {
  id: string
  zlecenie_id: string
  typ: TypWyceny
  koszty: KosztPozycja[]
  zarobek: number
  created_at: string
  updated_at: string
}

export type WycenaUpsert = Pick<Wycena, 'zlecenie_id' | 'typ' | 'koszty' | 'zarobek'>

// ─────────────────────────────────────────────────────────────
// Etap 2 — Płatności (raty 40/40/20)
// ─────────────────────────────────────────────────────────────

export type DokumentTyp = 'faktura' | 'paragon'

export type Platnosc = {
  id: string
  zlecenie_id: string
  etap: number // 1 | 2 | 3
  nazwa: string
  procent: number
  kwota: number
  zaplacone: boolean
  data_wplaty: string | null
  dokument_typ: DokumentTyp | null
  dokument_wystawiony: boolean
  created_at: string
}

export type PlatnoscInsert = Pick<
  Platnosc,
  'zlecenie_id' | 'etap' | 'nazwa' | 'procent' | 'kwota'
> &
  Partial<Omit<Platnosc, 'id' | 'created_at'>>

export type PlatnoscUpdate = Partial<Omit<Platnosc, 'id' | 'created_at'>>

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
      wyceny: {
        Row: Wycena
        Insert: WycenaUpsert & Partial<Pick<Wycena, 'id'>>
        Update: Partial<WycenaUpsert>
        Relationships: []
      }
      platnosci: {
        Row: Platnosc
        Insert: PlatnoscInsert
        Update: PlatnoscUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
