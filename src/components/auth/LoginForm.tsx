import { useState } from 'react'
import { useAuthStore } from '../../game/store/authStore'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const login = useAuthStore(s => s.login)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <Panel title="Enter Identity">
      <form onSubmit={handleLogin} className="auth-form">
        <input
          type="text" placeholder="Username" value={username}
          onChange={e => setUsername(e.target.value)} required
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} required
        />
        {error && <p className="form-error">{error}</p>}
        <div
          className="btn-wrapper"
          onMouseEnter={e => setMousePos({ x: e.clientX, y: e.clientY })}
          onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setMousePos(null)}
        >
          <Button type="submit" className="btn-full">Start</Button>
          {mousePos && (
            <div
              className="tooltip visible"
              style={{ left: mousePos.x + 16, top: mousePos.y + 16 }}
            >
              A nation reveals itself not only by the <span style={{ color: '#eab308' }}>men it produces</span>,
              but also by the <span style={{ color: '#ef4444' }}>men it honors</span>,
              the <span style={{ color: '#22c55e' }}>men it remembers</span>.
            </div>
          )}
        </div>
      </form>
    </Panel>
  )
}
