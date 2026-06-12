import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../game/store/authStore'

const SIDEBAR_ITEMS = [
  { path: '/admin', label: 'Dashboard', end: true },
  { path: '/admin/sector-modifiers', label: 'Sector Mods' },
  { path: '/admin/nations', label: 'Nations' },
  { path: '/admin/players', label: 'Players' },
  { path: '/admin/companies', label: 'Companies' },
  { path: '/admin/turns', label: 'Turns' },
  { path: '/admin/orders', label: 'Orders' },
  { path: '/admin/fronts', label: 'Fronts' },
  { path: '/admin/pins', label: 'Map Pins' },
  { path: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#050505' }}>
      <aside style={{
        width: 200, minWidth: 200, background: '#000',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--sans)', fontSize: 13, textTransform: 'uppercase',
          letterSpacing: 2, color: 'var(--cyan-bright)', fontWeight: 700,
        }}>
          GeoRP Admin
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {SIDEBAR_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              style={({ isActive }) => ({
                display: 'block', padding: '8px 16px',
                fontFamily: 'var(--sans)', fontSize: 13,
                textTransform: 'uppercase', letterSpacing: 0.5,
                color: isActive ? 'var(--cyan-bright)' : 'var(--text-dim)',
                background: isActive ? 'rgba(0,255,255,0.05)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--cyan-bright)' : '2px solid transparent',
                textDecoration: 'none', transition: 'all 0.1s',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            {user?.username}
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            style={{
              fontFamily: 'var(--sans)', fontSize: 12, padding: '4px 12px',
              border: '1px solid var(--border)', background: '#000',
              color: 'var(--text-dim)', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          background: '#000', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--sans)', fontSize: 12, padding: '2px 8px',
            background: 'var(--amber-bright)', color: '#000',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>Admin</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)',
          }}>/</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)',
          }}>Dashboard</span>
        </div>
        <div style={{ flex: 1, padding: 20 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
