import type { ReactNode } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'

// Wspólny szkielet zalogowanej części aplikacji: górny pasek z logo,
// nawigacją, e-mailem użytkownika i przyciskiem wylogowania.
export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/logowanie', { replace: true })
  }

  const linkKlasy = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-karta text-krem' : 'text-przygaszony hover:text-krem'
    }`

  return (
    <div className="min-h-screen bg-grafit">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="text-xl transition hover:opacity-80"
              aria-label="Strona główna"
            >
              <Logo />
            </button>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={linkKlasy}>
                Zlecenia
              </NavLink>
              <NavLink to="/kalendarz" className={linkKlasy}>
                Kalendarz
              </NavLink>
              <NavLink to="/finanse" className={linkKlasy}>
                Finanse
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user?.email && (
              <span className="hidden text-sm text-przygaszony sm:inline">
                {user.email}
              </span>
            )}
            <button onClick={handleSignOut} className="btn-secondary">
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
