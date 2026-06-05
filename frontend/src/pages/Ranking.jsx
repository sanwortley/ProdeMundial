import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import RankingCard from '../components/RankingCard'
import { Trophy, ArrowLeft, ShieldAlert } from 'lucide-react'

const Ranking = () => {
  const { groupId } = useParams()
  const [rankingData, setRankingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Trigger auto-sync of finished matches (non-blocking)
    api.post('/matches/auto-sync').catch(() => {})

    const fetchRanking = async () => {
      try {
        const response = await api.get(`/ranking/${groupId}`)
        setRankingData(response.data)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar la tabla de posiciones.')
      } finally {
        setLoading(false)
      }
    }

    fetchRanking()
  }, [groupId])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide">Calculando tabla...</p>
      </div>
    )
  }

  if (error || !rankingData) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center flex flex-col items-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <h2 className="font-extrabold text-xl text-slate-200">Error</h2>
        <p className="text-sm text-slate-500">{error || 'No se pudieron cargar los datos.'}</p>
        <Link to={`/groups/${groupId}`} className="text-soccer-green font-bold hover:underline">
          Volver al Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to={`/groups/${groupId}`}
          className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-soccer-gold" />
            Tabla de Posiciones
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            {rankingData.nombre_grupo}
          </p>
        </div>
      </div>

      {/* Leaderboard Cards */}
      <div className="flex flex-col gap-2.5">
        {rankingData.ranking.length > 0 ? (
          rankingData.ranking.map((entry) => (
            <RankingCard key={entry.id_usuario} entry={entry} />
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 font-semibold">
            No hay jugadores registrados en esta tabla.
          </div>
        )}
      </div>

    </div>
  )
}

export default Ranking
