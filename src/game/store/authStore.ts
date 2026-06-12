import { create } from 'zustand'
import { getSupabase } from '../../services/supabase'

const supabase = getSupabase()

interface AuthState {
  user: { id: string; username: string } | null
  loading: boolean
  init: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      set({ user: null, loading: false })
      return
    }
    const email = session.user.email || ''
    const username = email.replace('@georp.game', '')
    set({ user: { id: session.user.id, username }, loading: false })

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const u = session.user.email?.replace('@georp.game', '') || ''
        set({ user: { id: session.user.id, username: u } })
      } else {
        set({ user: null })
      }
    })
  },

  login: async (username: string, password: string) => {
    const email = `${username}@georp.game`
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: { id: data.user.id, username } })
  },

  register: async (username: string, password: string) => {
    const email = `${username}@georp.game`
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    set({ user: { id: data.user!.id, username } })
  },

  logout: () => {
    supabase.auth.signOut()
    set({ user: null })
  },
}))
