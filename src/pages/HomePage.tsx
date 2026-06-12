import { LoginForm } from '../components/auth/LoginForm'

export function HomePage() {
  return (
    <div className="page-center">
      <div className="game-title">
        <h1>CATTIUS</h1>
        <p>Nationbuilding Roleplay</p>
      </div>
      <div className="auth-container">
        <LoginForm />
      </div>
    </div>
  )
}
