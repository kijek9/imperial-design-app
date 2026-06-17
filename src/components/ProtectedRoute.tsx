import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Spinner from './Spinner'

// Chroni trasy wymagające zalogowania. Niezalogowany użytkownik
// jest przekierowany na ekran logowania.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Wczytywanie…" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/logowanie" replace state={{ from: location }} />
  }

  return <>{children}</>
}
