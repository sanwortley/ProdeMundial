import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Input from '../components/Input'
import Button from '../components/Button'
import { Trophy } from 'lucide-react'

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect to previous requested page or my-groups
  const from = location.state?.from?.pathname || '/my-groups'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor, ingresa todos los campos.')
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
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center p-4 bg-gradient-pitch">
      <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-soccer-green/10 p-3 rounded-2xl border border-soccer-green/20 text-soccer-green shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight mt-2 text-slate-100">
            Iniciar Sesión
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Ingresa a tu prode del mundial
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-center">
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

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            fullWidth
            className="mt-2"
          >
            Entrar a la cancha
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500">
          ¿No tienes una cuenta?{' '}
          <Link to="/register" className="text-soccer-green font-bold hover:underline">
            Regístrate aquí
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
