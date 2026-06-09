import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import GroupCard from '../components/GroupCard'
import Button from '../components/Button'
import { PlusCircle, UserPlus, FolderOpen } from 'lucide-react'
import RulesModal from '../components/RulesModal'

const MyGroups = () => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.get('/groups/my')
        setGroups(response.data)
      } catch (err) {
        console.error(err)
        setError('No se pudieron cargar tus grupos.')
      } finally {
        setLoading(false)
      }
    }
    fetchGroups()

    const hasSeenRules = localStorage.getItem('rules_modal_shown')
    if (hasSeenRules !== 'true') setShowRules(true)
  }, [])

  const handleCloseRules = () => {
    localStorage.setItem('rules_modal_shown', 'true')
    setShowRules(false)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center gap-4">
        {/* Spinner celeste */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full" style={{ border: '3px solid rgba(99,184,224,0.12)' }} />
          <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '3px solid transparent', borderTopColor: '#63b8e0' }} />
        </div>
        <p className="text-slate-400 text-sm font-semibold tracking-widest uppercase">Cargando grupos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8 flex flex-col gap-6">

      {/* ── Header Banner ── */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden argentina-stripe-top"
        style={{
          background: 'linear-gradient(135deg, rgba(12,26,48,0.95) 0%, rgba(29,78,216,0.15) 100%)',
          border: '1px solid rgba(99,184,224,0.12)',
        }}
      >
        {/* Glow fondo */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 80% 50%, rgba(99,184,224,0.08) 0%, transparent 70%)',
          }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Kicker */}
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1"
              style={{ color: 'rgba(99,184,224,0.6)' }}>
              🏆 FIFA World Cup 2026 🇦🇷
            </p>
            {/* Título display */}
            <h1 className="text-display text-4xl leading-none text-wc-white">
              MIS GRUPOS
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1.5">
              Competí con tus amigos en diferentes salas
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/join-group" className="flex-1 sm:flex-none">
              <Button variant="secondary" className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs">
                <UserPlus className="w-3.5 h-3.5" />
                <span>Unirse</span>
              </Button>
            </Link>
            <Link to="/create-group" className="flex-1 sm:flex-none">
              <Button variant="primary" className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Crear Grupo</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Grid de grupos ── */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
          {groups.map((group) => (
            <GroupCard key={group.id_grupo} group={group} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          className="rounded-2xl p-8 text-center flex flex-col items-center gap-4 py-16"
          style={{
            background: 'rgba(10, 22, 42, 0.6)',
            border: '1px solid rgba(99,184,224,0.08)',
          }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(99,184,224,0.08)', border: '1px solid rgba(99,184,224,0.15)' }}>
            <FolderOpen className="w-7 h-7 text-slate-500" />
          </div>
          <div>
            <h3 className="text-display text-2xl text-wc-white">SIN GRUPOS AÚN</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Creá tu propia sala para invitar a tus amigos, o unite a una existente con un código.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-xs">
            <Link to="/join-group" className="w-full">
              <Button variant="secondary" className="w-full text-xs">Unirse a un grupo</Button>
            </Link>
            <Link to="/create-group" className="w-full">
              <Button variant="primary" className="w-full text-xs">Crear nuevo grupo</Button>
            </Link>
          </div>
        </div>
      )}

      <RulesModal isOpen={showRules} onClose={handleCloseRules} />
    </div>
  )
}

export default MyGroups
