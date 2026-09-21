import { useState } from 'react'
import { LoginForm, SignUpForm } from '../components/auth'
import { Button } from '../components/ui/Button'

export function HomePage() {
  const [showSignup, setShowSignup] = useState(false)

  return (
    <div className="page-center">
      <div className="game-title">
        <h1>CATTIUS</h1>
        <p>Nationbuilding Roleplay</p>
      </div>
      <div className="auth-container">
        {showSignup ? (
          <div className="switch-stack">
            <SignUpForm />
            <div className="auth-container" style={{ marginTop: 16 }}>
              <Button variant="primary" className="btn-full" onClick={() => setShowSignup(false)}>
                Already a member? Log in
              </Button>
            </div>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
      {!showSignup && (
        <div className="auth-container" style={{ marginTop: 16 }}>
          <Button variant="primary" className="btn-full" onClick={() => setShowSignup(true)}>
            New nation? Create an account
          </Button>
        </div>
      )}
    </div>
  )
}