import React from 'react'
import { Trophy, Flame, Target } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const RankingCard = ({ entry }) => {
  const { user } = useAuth()
  const {
    posicion,
    id_usuario,
    nombre,
    puntos_totales,
    cantidad_exactos,
    mejor_racha
  } = entry

  const isCurrentUser = user && user.id_usuario === id_usuario

  // Top 3 style classes
  const getRankStyles = () => {
    if (posicion === 1) {
      return {
        bg: 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30',
        badge: 'bg-amber-500 text-soccer-dark border-amber-400',
        text: 'text-amber-500 font-black',
        icon: <Trophy className="w-4 h-4 text-amber-500" />
      }
    }
    if (posicion === 2) {
      return {
        bg: 'bg-gradient-to-r from-slate-400/10 via-slate-400/5 to-transparent border-slate-400/20',
        badge: 'bg-slate-400 text-soccer-dark border-slate-300',
        text: 'text-slate-400 font-bold',
        icon: <Trophy className="w-4 h-4 text-slate-400" />
      }
    }
    if (posicion === 3) {
      return {
        bg: 'bg-gradient-to-r from-amber-700/10 via-amber-700/5 to-transparent border-amber-700/20',
        badge: 'bg-amber-700 text-white border-amber-600',
        text: 'text-amber-700 font-bold',
        icon: <Trophy className="w-4 h-4 text-amber-700" />
      }
    }
    return {
      bg: isCurrentUser ? 'bg-slate-800/40 border-soccer-green/30' : 'bg-slate-900/40 border-slate-800/80',
      badge: 'bg-slate-800 text-slate-400 border-slate-700',
      text: 'text-slate-300',
      icon: null
    }
  }

  const styles = getRankStyles()

  return (
    <div className={`border rounded-2xl p-4 flex items-center justify-between transition-all duration-300 ${styles.bg}`}>
      <div className="flex items-center gap-3">
        {/* Position Number */}
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-sm ${styles.badge}`}>
          {posicion}
        </div>
        
        {/* User Info */}
        <div className="flex flex-col">
          <span className={`font-bold text-sm flex items-center gap-1.5 ${isCurrentUser ? 'text-soccer-green' : 'text-slate-200'}`}>
            {nombre}
            {isCurrentUser && (
              <span className="text-[9px] bg-soccer-green/10 text-soccer-green px-1.5 py-0.5 rounded border border-soccer-green/20 uppercase font-black">
                Tú
              </span>
            )}
          </span>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <Target className="w-3 h-3 text-slate-500" />
              {cantidad_exactos} exactos
            </span>
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              Racha: {mejor_racha}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {styles.icon}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Puntos</span>
          <span className="font-extrabold text-lg text-slate-100">{puntos_totales}</span>
        </div>
      </div>
    </div>
  )
}

export default RankingCard
