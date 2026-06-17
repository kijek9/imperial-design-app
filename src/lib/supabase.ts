import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Czytelny komunikat, gdy ktoś zapomni utworzyć plik .env
  throw new Error(
    'Brak konfiguracji Supabase. Skopiuj plik ".env.example" jako ".env" ' +
      'i uzupełnij VITE_SUPABASE_URL oraz VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
