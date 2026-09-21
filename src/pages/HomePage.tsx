import { useState } from 'react'
import { LoginForm } from '../components/auth/LoginForm'
import { SignUpForm } from '../components/auth/SignUpForm'

export function HomePage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="page-center">
      <div className="game-title">
        <h1>CATTIUS</h1>
        <p>Nationbuilding Roleplay</p>
      </div>
      <div className="auth-container">
        {mode === 'login' ? (
          <>
            <LoginForm />
            <button type="button" className="auth-switch" onClick={() => setMode('signup')}>
              New nation? Create an account
            </button>
          </>
        ) : (
          <>
            <SignUpForm />
            <button type="button" className="auth-switch" onClick={() => setMode('login')}>
              Already a member? Log in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
