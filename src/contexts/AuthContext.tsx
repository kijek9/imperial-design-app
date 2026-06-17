import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Odczyt istniejącej sesji przy starcie aplikacji.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Nasłuch zmian (logowanie / wylogowanie / odświeżenie tokenu).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error ? tlumaczBlad(error.message) : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth musi być użyty wewnątrz <AuthProvider>')
  }
  return ctx
}

// Prosty słownik tłumaczeń najczęstszych komunikatów Supabase Auth.
function tlumaczBlad(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Adres e-mail nie został potwierdzony.'
  }
  return 'Wystąpił błąd logowania. Spróbuj ponownie.'
}
