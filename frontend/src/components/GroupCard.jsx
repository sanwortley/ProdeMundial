import React from 'react'
import { Link } from 'react-router-dom'

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
    <div
      className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between h-44 jersey-stripe relative overflow-hidden"
    >
      {/* Decoración de fondo sutil */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 90% 10%, rgba(99,184,224,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg text-wc-white line-clamp-1">
            {nombre_grupo}
          </h3>
          {rol === 'admin' && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{
                background: 'rgba(99,184,224,0.12)',
                color: '#63b8e0',
                border: '1px solid rgba(99,184,224,0.25)',
              }}
            >
              Creador
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 font-semibold tracking-wider mt-1">
          Cód: <span className="text-slate-400">{codigo_invitacion}</span>
        </p>
      </div>

      <div className="flex items-center justify-between mt-4 relative">
        <div className="flex items-center gap-5">
          {/* Puntos */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Puntos</span>
            <span className="font-display text-2xl leading-tight" style={{ color: '#22c55e' }}>
              {puntos_totales}
            </span>
          </div>

          <div className="w-px h-8 bg-wc-navy border-r border-slate-700/60" />

          {/* Puesto */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Puesto</span>
            <span className="font-display text-2xl leading-tight" style={{ color: '#f59e0b' }}>
              #{posicion_ranking}
            </span>
          </div>
        </div>

        {/* Botón Entrar */}
        <Link
          to={`/groups/${id_grupo}`}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105"
          style={{
            background: 'rgba(99,184,224,0.10)',
            border: '1px solid rgba(99,184,224,0.25)',
            color: '#63b8e0',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #63b8e0, #2563c4)'
            e.currentTarget.style.color = '#050e1d'
            e.currentTarget.style.borderColor = 'transparent'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(99,184,224,0.10)'
            e.currentTarget.style.color = '#63b8e0'
            e.currentTarget.style.borderColor = 'rgba(99,184,224,0.25)'
          }}
        >
          Entrar
        </Link>
      </div>
    </div>
  )
}

export default GroupCard
