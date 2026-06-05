import React from 'react'
import { Link } from 'react-router-dom'
import { Users, Award, ShieldAlert } from 'lucide-react'

const GroupCard = ({ group }) => {
  const {
    id_grupo,
    nombre_grupo,
    codigo_invitacion,
    rol,
    puntos_totales,
    posicion_ranking
  } = group

  return (
    <div className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between h-44">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg text-slate-100 line-clamp-1">
            {nombre_grupo}
          </h3>
          {rol === 'admin' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-soccer-green/10 border border-soccer-green/20 rounded-md text-[10px] font-bold uppercase text-soccer-green">
              Creador
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 font-semibold tracking-wider mt-1">
          Cód: {codigo_invitacion}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Puntos</span>
            <span className="font-extrabold text-xl text-soccer-green">
              {puntos_totales}
            </span>
          </div>

          <div className="w-px h-8 bg-slate-800"></div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Puesto</span>
            <span className="font-extrabold text-xl text-soccer-gold flex items-center gap-1">
              #{posicion_ranking}
            </span>
          </div>
        </div>

        <Link
          to={`/groups/${id_grupo}`}
          className="px-4 py-2 bg-slate-800 border border-slate-700/50 hover:bg-soccer-green hover:text-soccer-dark hover:border-soccer-green rounded-xl text-xs font-bold transition-all duration-300"
        >
          Entrar
        </Link>
      </div>
    </div>
  )
}

export default GroupCard
