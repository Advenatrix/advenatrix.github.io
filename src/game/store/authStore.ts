import { create } from 'zustand'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
const TOKEN_KEY = 'georp_token'

interface User {
  id: string
  username: string
}

interface AuthState {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

function decodeToken(token: string): { sub: string; username: string; exp: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function getStoredUser(): User | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload) return null
  if (payload.exp * 1000 < Date.now()) {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
  return { id: payload.sub, username: payload.username }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const user = getStoredUser()
    set({ user, loading: false })

    window.addEventListener('storage', (e) => {
      if (e.key === TOKEN_KEY) {
        const user = e.newValue ? getStoredUser() : null
        set({ user })
      }
    })
  },

  login: async (username: string, password: string) => {
    const res = await fetch(`${FUNCTIONS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Login failed')
    }
    const { token, user } = await res.json()
    localStorage.setItem(TOKEN_KEY, token)
    set({ user })
  },

  register: async (username: string, password: string) => {
    const res = await fetch(`${FUNCTIONS_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Registration failed')
    }
    const { token, user } = await res.json()
    localStorage.setItem(TOKEN_KEY, token)
    set({ user })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null })
  },
}))

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getTokenUser(): { sub: string; username: string } | null {
  const token = getToken()
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload || payload.exp * 1000 < Date.now()) return null
  return { sub: payload.sub, username: payload.username }
}
