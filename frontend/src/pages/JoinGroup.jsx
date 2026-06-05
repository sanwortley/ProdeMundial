import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import Input from '../components/Input'
import Button from '../components/Button'
import { UserPlus } from 'lucide-react'

const JoinGroup = () => {
  const { user, loading: authLoading } = useAuth()
  const { code: urlCode } = useParams() // For /unirse/:code routing
  const navigate = useNavigate()

  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Trigger automatic joining if code is present in URL
  useEffect(() => {
    if (authLoading) return

    if (urlCode) {
      if (!user) {
        // Not logged in: store pending code and redirect
        sessionStorage.setItem('pendingJoinCode', urlCode)
        navigate('/register', { replace: true })
      } else {
        // Logged in: auto-join
        handleAutoJoin(urlCode)
      }
    }
  }, [urlCode, user, authLoading])

  // Look for pending codes on manual mount as well
  useEffect(() => {
    if (authLoading || urlCode) return

    const pendingCode = sessionStorage.getItem('pendingJoinCode')
    if (pendingCode && user) {
      sessionStorage.removeItem('pendingJoinCode')
      handleAutoJoin(pendingCode)
    }
  }, [user, authLoading, urlCode])

  const handleAutoJoin = async (codeToJoin) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.post(`/groups/join/${codeToJoin}`)
      navigate(`/groups/${response.data.id_grupo}`, { replace: true })
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'No se pudo unir al grupo.')
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!codigo) {
      setError('Por favor, ingresa el código de invitación.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post(`/groups/join/${codigo.trim().toUpperCase()}`)
      navigate(`/groups/${response.data.id_grupo}`)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'No se pudo unir al grupo. Verifica el código.')
    } finally {
      setLoading(false)
    }
  }

  if (urlCode && loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide animate-pulse">Entrando a la sala...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-soccer-green/10 p-3 rounded-2xl border border-soccer-green/20 text-soccer-green">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="font-extrabold text-2xl text-slate-100 mt-2">
            Unirse a un Grupo
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Ingresa el código para unirte
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Código de Invitación"
            id="codigo"
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej: MUNDIAL-A7K9"
            required
            className="uppercase"
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            fullWidth
            className="mt-2"
          >
            Unirse al grupo
          </Button>
        </form>

        <div className="text-center">
          <Link to="/my-groups" className="text-xs text-slate-400 hover:text-soccer-green font-bold">
            Volver a mis grupos
          </Link>
        </div>

      </div>
    </div>
  )
}

export default JoinGroup
