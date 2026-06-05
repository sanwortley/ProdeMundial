import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import GroupCard from '../components/GroupCard'
import Button from '../components/Button'
import { FolderClosed, PlusCircle, UserPlus, ShieldAlert } from 'lucide-react'
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

    // Check if the rules modal has been shown to this user
    const hasSeenRules = localStorage.getItem('rules_modal_shown')
    if (hasSeenRules !== 'true') {
      setShowRules(true)
    }
  }, [])

  const handleCloseRules = () => {
    localStorage.setItem('rules_modal_shown', 'true')
    setShowRules(false)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide">Buscando tus grupos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
            <FolderClosed className="w-6 h-6 text-soccer-green" />
            Mis Grupos
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Compite con tus amigos en diferentes salas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/join-group" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5">
              <UserPlus className="w-4 h-4" />
              <span>Unirse</span>
            </Button>
          </Link>
          <Link to="/create-group" className="flex-1 sm:flex-none">
            <Button variant="primary" className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5">
              <PlusCircle className="w-4 h-4 text-soccer-dark" />
              <span>Crear Grupo</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Grid of Groups */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((group) => (
            <GroupCard key={group.id_grupo} group={group} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-card rounded-3xl p-8 text-center flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 bg-slate-800/40 rounded-full border border-slate-700/50 flex items-center justify-center text-slate-500">
            <FolderClosed className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-200">
              No tienes ningún grupo todavía
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Crea tu propia sala para invitar a tus amigos, o únete a una existente usando un código de invitación.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-xs">
            <Link to="/join-group" className="w-full">
              <Button variant="secondary" className="w-full">
                Unirse a un grupo
              </Button>
            </Link>
            <Link to="/create-group" className="w-full">
              <Button variant="primary" className="w-full">
                Crear nuevo grupo
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={handleCloseRules} />
    </div>
  )
}

export default MyGroups
