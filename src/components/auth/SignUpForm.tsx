import { useState } from 'react'
import { useAuthStore } from '../../game/store/authStore'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'

export function SignUpForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const register = useAuthStore(s => s.register)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await register(username, password)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <Panel title="Sign Up">
      <form onSubmit={handleSignUp} className="auth-form">
        <input
          type="text" placeholder="Username" value={username}
          onChange={e => setUsername(e.target.value)} required
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} required
        />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit">Create account</Button>
      </form>
    </Panel>
  )
}
