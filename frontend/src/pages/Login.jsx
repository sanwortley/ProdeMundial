import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Input from '../components/Input'
import Button from '../components/Button'

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/my-groups'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor, ingresá todos los campos.')
      return
    }
    setLoading(true)
    setError('')
    const result = await login(email, password)
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        /* Mismo fondo de cancha que el body, pero inheritado via background-attachment: fixed */
        background: 'transparent',
      }}
    >
      {/* Líneas de cancha decorativas */}
      <div className="absolute inset-y-0 right-16 w-px pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="absolute bottom-20 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Card */}
      <div
        className="w-full max-w-sm relative"
        style={{
          background: 'rgba(10,18,12,0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '2rem 1.75rem',
        }}
      >
        {/* Franja verde top — línea de campo */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: '#00a651' }} />

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-7">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-xl text-2xl"
            style={{ background: '#0f2a14', border: '1px solid rgba(0,166,81,0.3)' }}
          >
            🏆
          </div>

          <div>
            <h1 className="text-display text-5xl tracking-widest leading-none" style={{ color: '#f5f5f5' }}>
              PRODE
            </h1>
            <h2 className="text-display text-5xl tracking-widest leading-none" style={{ color: '#00a651' }}>
              MUNDIAL
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mt-2" style={{ color: '#4a4a4a' }}>
              🇦🇷 Argentina 2026 🇦🇷
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs font-semibold px-4 py-3 rounded-lg text-center"
            style={{ background: 'rgba(232,25,44,0.1)', border: '1px solid rgba(232,25,44,0.2)', color: '#e8192c' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Correo Electrónico"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
            required
          />
          <Input
            label="Contraseña"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Link
            to="/forgot-password"
            className="text-xs font-semibold -mt-1 self-end transition-colors"
            style={{ color: '#4a4a4a' }}
            onMouseEnter={e => e.currentTarget.style.color = '#00a651'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a4a4a'}
          >
            ¿Olvidaste tu contraseña?
          </Link>

          <Button type="submit" variant="primary" loading={loading} fullWidth className="mt-1 text-sm font-bold tracking-widest py-3.5">
            ⚽ ENTRAR A LA CANCHA
          </Button>
        </form>

        <div className="text-center text-xs mt-5" style={{ color: '#4a4a4a' }}>
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="font-bold" style={{ color: '#00a651' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            Registrate aquí
          </Link>
        </div>
      </div>

      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#2a3a2a' }}>
        FIFA World Cup 2026
      </p>
    </div>
  )
}

export default Login
