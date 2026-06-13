import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './game/store/authStore'
import { HomePage } from './pages/HomePage'
import { GamePage } from './pages/GamePage'
import {
  AdminLayout, DashboardPage, NationsPage, PlayersPage,
  CompaniesPage, TurnsPage, OrdersPage, SettingsPage, PinsPage, FrontsPage,
  SectorModifiersPage,
} from './pages'

function App() {
  const { user, loading, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  const isAdmin = user?.username === 'admin'

  if (loading) {
    return <div className="page-center"><div className="loading">Loading...</div></div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          user ? (isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/game" replace />) : <HomePage />
        } />
        <Route path="/game" element={user ? <GamePage /> : <Navigate to="/" replace />} />
        <Route path="/admin" element={user && isAdmin ? <AdminLayout /> : <Navigate to="/" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="nations" element={<NationsPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="turns" element={<TurnsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="pins" element={<PinsPage />} />
          <Route path="fronts" element={<FrontsPage />} />
          <Route path="sector-modifiers" element={<SectorModifiersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
