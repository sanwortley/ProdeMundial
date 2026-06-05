import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Input from '../components/Input'
import Button from '../components/Button'
import { Trophy } from 'lucide-react'

const Register = () => {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secret_phrase, setSecretPhrase] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre || !email || !password) {
      setError('Por favor, completa todos los campos.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    const result = await register(nombre, email, password, secret_phrase)
    if (result.success) {
      navigate('/my-groups')
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
            Crear Cuenta
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Regístrate para jugar con tus amigos
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nombre Completo"
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez"
            required
          />

          <Input
            label="Correo Electrónico"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@correo.com"
            required
          />

          <Input
            label="Contraseña (mínimo 6 caracteres)"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Input
            label="Frase secreta (para recuperar tu cuenta si olvidás la contraseña)"
            id="secret_phrase"
            type="text"
            value={secret_phrase}
            onChange={(e) => setSecretPhrase(e.target.value)}
            placeholder="ej: Mi equipo favorito es River"
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            fullWidth
            className="mt-2"
          >
            Fichar jugador
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-soccer-green font-bold hover:underline">
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
