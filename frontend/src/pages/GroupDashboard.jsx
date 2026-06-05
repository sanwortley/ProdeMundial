import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { Trophy, CalendarDays, Settings, ShieldAlert, Award, Star, Flame, Target } from 'lucide-react'

const GroupDashboard = () => {
  const { groupId } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        const response = await api.get(`/groups/${groupId}`)
        setGroup(response.data)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar la información del grupo.')
      } finally {
        setLoading(false)
      }
    }

    fetchGroupDetails()
  }, [groupId])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide">Cargando vestuario...</p>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center flex flex-col items-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <h2 className="font-extrabold text-xl text-slate-200">Error de Acceso</h2>
        <p className="text-sm text-slate-500">{error || 'El grupo no existe.'}</p>
        <Link to="/my-groups" className="text-soccer-green font-bold hover:underline">
          Volver a mis grupos
        </Link>
      </div>
    )
  }

  // Find current user's stats
  const sortedMiembros = [...group.miembros].sort((a, b) => {
    if (b.puntos_totales !== a.puntos_totales) return b.puntos_totales - a.puntos_totales
    if (b.cantidad_exactos !== a.cantidad_exactos) return b.cantidad_exactos - a.cantidad_exactos
    return b.mejor_racha - a.mejor_racha
  })

  const currentUserIndex = sortedMiembros.findIndex(m => m.id_usuario === user.id_usuario)
  const rankingPos = currentUserIndex !== -1 ? currentUserIndex + 1 : '-'
  const userStats = currentUserIndex !== -1 ? sortedMiembros[currentUserIndex] : {
    puntos_totales: 0,
    cantidad_exactos: 0,
    mejor_racha: 0
  }

  // Get Top 3
  const topThree = sortedMiembros.slice(0, 3)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
      {/* Group Title and Info */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-soccer-green font-black uppercase tracking-widest">Dashboard del Grupo</span>
        <h1 className="font-extrabold text-3xl tracking-tight text-slate-100">
          {group.nombre_grupo}
        </h1>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          Código: {group.codigo_invitacion}
        </p>
      </div>

      {/* User Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
        
        {/* Standings Position */}
        <div className="flex items-center gap-3 p-2">
          <div className="bg-soccer-gold/10 p-2.5 rounded-2xl border border-soccer-gold/20 text-soccer-gold">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Posición</span>
            <span className="font-black text-xl text-slate-200">#{rankingPos}</span>
          </div>
        </div>

        {/* Total Points */}
        <div className="flex items-center gap-3 p-2">
          <div className="bg-soccer-green/10 p-2.5 rounded-2xl border border-soccer-green/20 text-soccer-green">
            <Star className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Puntos</span>
            <span className="font-black text-xl text-soccer-green">{userStats.puntos_totales}</span>
          </div>
        </div>

        {/* Exact Hits */}
        <div className="flex items-center gap-3 p-2">
          <div className="bg-sky-500/10 p-2.5 rounded-2xl border border-sky-500/20 text-sky-400">
            <Target className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Exactos</span>
            <span className="font-black text-xl text-slate-200">{userStats.cantidad_exactos}</span>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-3 p-2">
          <div className="bg-orange-500/10 p-2.5 rounded-2xl border border-orange-500/20 text-orange-400">
            <Flame className="w-5 h-5 animate-pulse-subtle" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mejor Racha</span>
            <span className="font-black text-xl text-slate-200">{userStats.mejor_racha}</span>
          </div>
        </div>
        
      </div>

      {/* Main Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Pronosticos Card */}
        <Link 
          to={`/groups/${groupId}/predictions`}
          className="glass-card glass-card-hover rounded-3xl p-6 flex flex-col gap-4 shadow-md group"
        >
          <div className="bg-soccer-green/10 w-12 h-12 rounded-2xl border border-soccer-green/20 text-soccer-green flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-200">
              Pronósticos
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Carga tus predicciones para los próximos partidos del mundial y saca ventaja.
            </p>
          </div>
        </Link>

        {/* Ranking Card */}
        <Link 
          to={`/groups/${groupId}/ranking`}
          className="glass-card glass-card-hover rounded-3xl p-6 flex flex-col gap-4 shadow-md group"
        >
          <div className="bg-soccer-gold/10 w-12 h-12 rounded-2xl border border-soccer-gold/20 text-soccer-gold flex items-center justify-center group-hover:scale-110 transition-transform">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-200">
              Tabla de Posiciones
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Revisa el ranking del grupo en tiempo real. Mira quién lidera y la racha de cada uno.
            </p>
          </div>
        </Link>

        {/* Settings Card */}
        <Link 
          to={`/groups/${groupId}/settings`}
          className="glass-card glass-card-hover rounded-3xl p-6 flex flex-col gap-4 shadow-md group"
        >
          <div className="bg-slate-800 w-12 h-12 rounded-2xl border border-slate-700 text-slate-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-200">
              Configuración
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Mira el código de invitacion, listado de miembros y controles del administrador.
            </p>
          </div>
        </Link>
        
      </div>

      {/* Mini Leaderboard Widget */}
      <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider">
            Podio del Grupo
          </h3>
          <Link to={`/groups/${groupId}/ranking`} className="text-xs text-soccer-green hover:underline font-bold">
            Ver tabla completa
          </Link>
        </div>
        
        <div className="flex flex-col gap-2">
          {topThree.map((miembro, index) => {
            const colors = [
              'border-amber-500/20 text-amber-500 bg-amber-500/5',
              'border-slate-400/20 text-slate-400 bg-slate-400/5',
              'border-amber-700/20 text-amber-700 bg-amber-700/5'
            ]
            return (
              <div 
                key={miembro.id_usuario} 
                className={`flex items-center justify-between p-3 rounded-2xl border ${colors[index] || 'border-slate-800 text-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm w-5 text-center">
                    #{index + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-200">
                    {miembro.nombre}
                  </span>
                </div>
                <span className="font-black text-sm text-slate-300">
                  {miembro.puntos_totales} pts
                </span>
              </div>
            )
          })}
        </div>
      </div>
      
    </div>
  )
}

export default GroupDashboard
