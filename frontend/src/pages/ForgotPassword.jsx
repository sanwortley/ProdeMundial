import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import { Trophy, ArrowLeft } from 'lucide-react'
import api from '../api/axios'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Ingresá tu correo electrónico.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar el correo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center p-4 bg-gradient-pitch">
      <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-soccer-green/10 p-3 rounded-2xl border border-soccer-green/20 text-soccer-green shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight mt-2 text-slate-100">
            Olvidaste tu contraseña
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Te enviamos un link al correo
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-soccer-green/10 border border-soccer-green/20 text-soccer-green text-sm font-semibold px-4 py-6 rounded-xl">
              Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña.
            </div>
            <Link
              to="/login"
              className="text-soccer-green font-bold text-xs hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
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
            <Button type="submit" variant="primary" loading={loading} fullWidth className="mt-2">
              Enviar link
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-slate-500">
          <Link to="/login" className="text-soccer-green font-bold hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
