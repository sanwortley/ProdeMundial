import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, X, Check } from 'lucide-react'
import api from '../api/axios'

const POLL_INTERVAL = 10000

export default function DueloNotification({ groupId }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [aceptando, setAceptando] = useState(null)

  const loadPending = useCallback(async () => {
    try {
      const res = await api.get('/fantasy/duel/mis-duelos')
      const pend = res.data.filter((d) => d.estado === 'pending' && d.id_rival === getUserId())
      setPending(pend)
    } catch {}
  }, [])

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [loadPending])

  async function handleAccept(dueloId) {
    try {
      setAceptando(dueloId)
      await api.post(`/fantasy/duel/${dueloId}/accept`)
      setPending((p) => p.filter((d) => d.id_duelo !== dueloId))
      navigate(`/duel/${dueloId}`)
    } catch {
      setAceptando(null)
    }
  }

  async function handleReject(dueloId) {
    try {
      await api.post(`/fantasy/duel/${dueloId}/reject`)
      setPending((p) => p.filter((d) => d.id_duelo !== dueloId))
    } catch {}
  }

  if (pending.length === 0) return null

  return (
    <div className="fixed bottom-20 right-4 z-50 space-y-2 max-w-xs">
      {pending.map((d) => (
        <div key={d.id_duelo}
          className="glass-card rounded-xl p-3 border border-soccer-green/30 bg-slate-900/95 shadow-xl animate-slide-up">
          <div className="flex items-start gap-2 mb-2">
            <Swords className="w-5 h-5 text-soccer-green mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-200">
                {d.retador_nombre}
              </p>
              <p className="text-[11px] text-slate-400">te reta a un partido!</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleAccept(d.id_duelo)}
              disabled={aceptando === d.id_duelo}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-soccer-green text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {aceptando === d.id_duelo ? '...' : 'Aceptar'}
            </button>
            <button onClick={() => handleReject(d.id_duelo)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition-all">
              <X className="w-3.5 h-3.5" />
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function getUserId() {
  try {
    const user = localStorage.getItem('user')
    if (user) return JSON.parse(user).id_usuario
  } catch {}
  return null
}
