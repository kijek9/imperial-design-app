import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [wysylanie, setWysylanie] = useState(false)

  // Dokąd wrócić po zalogowaniu (jeśli ktoś trafił tu z chronionej trasy).
  const cel =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  // Już zalogowany? Przekieruj od razu.
  if (!loading && session) {
    return <Navigate to={cel} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBlad(null)
    setWysylanie(true)
    const { error } = await signIn(email.trim(), haslo)
    setWysylanie(false)
    if (error) {
      setBlad(error)
      return
    }
    navigate(cel, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grafit px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-3xl" />
          <p className="mt-2 text-sm text-przygaszony">
            Panel firmowy — zaloguj się, aby kontynuować
          </p>
        </div>

        <form onSubmit={handleSubmit} className="karta space-y-4 p-6">
          <div>
            <label htmlFor="email" className="etykieta">
              Adres e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pole"
              placeholder="np. jan@imperialdesign.pl"
            />
          </div>

          <div>
            <label htmlFor="haslo" className="etykieta">
              Hasło
            </label>
            <input
              id="haslo"
              type="password"
              autoComplete="current-password"
              required
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              className="pole"
              placeholder="••••••••"
            />
          </div>

          {blad && (
            <p className="rounded-lg bg-akcent/10 px-3 py-2 text-sm text-akcent ring-1 ring-akcent/30">
              {blad}
            </p>
          )}

          <button
            type="submit"
            disabled={wysylanie}
            className="btn-primary w-full"
          >
            {wysylanie ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-przygaszony/70">
          Konta zakłada administrator w panelu Supabase.
        </p>
      </div>
    </div>
  )
}
