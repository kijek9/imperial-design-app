import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ZleceniaListPage from './pages/ZleceniaListPage'
import ZlecenieDetailPage from './pages/ZlecenieDetailPage'
import KalendarzPage from './pages/KalendarzPage'

export default function App() {
  return (
    <Routes>
      {/* Publiczne */}
      <Route path="/logowanie" element={<LoginPage />} />

      {/* Chronione (wymagają zalogowania) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <ZleceniaListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/zlecenie/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ZlecenieDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kalendarz"
        element={
          <ProtectedRoute>
            <Layout>
              <KalendarzPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Nieznane trasy → strona główna */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
