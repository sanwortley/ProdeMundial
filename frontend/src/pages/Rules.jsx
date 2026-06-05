import React from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Sparkles, ArrowRightLeft, TrendingUp, HelpCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'

const Rules = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/my-groups"
          className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-soccer-gold animate-bounce" />
            Reglamento Oficial
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Aprende cómo sumar puntos y vencer a tus amigos
          </p>
        </div>
      </div>

      {/* Grid Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Puntuación Básica */}
        <div className="glass-card rounded-3xl p-6 border border-slate-850 flex flex-col gap-4">
          <h2 className="font-extrabold text-base text-slate-200 tracking-tight flex items-center gap-2 border-b border-slate-800 pb-2">
            <Trophy className="w-5 h-5 text-soccer-green" />
            Sistema de Puntos Básicos
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cada partido del Mundial te permite sumar puntos según la precisión de tu predicción:
          </p>
          
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-200">Marcador Exacto</span>
                <span className="text-[10px] text-slate-500">Aciertas goles locales y visitantes</span>
              </div>
              <span className="font-black text-sm text-soccer-green bg-soccer-green/10 border border-soccer-green/20 px-3 py-1 rounded-xl">+10 pts</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-200">Ganador o Empate</span>
                <span className="text-[10px] text-slate-500">Aciertas el resultado, pero no los goles exactos</span>
              </div>
              <span className="font-black text-sm text-slate-green bg-slate-800/50 border border-slate-700/50 px-3 py-1 rounded-xl text-slate-300">+5 pts</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-200">Predicción Incorrecta</span>
                <span className="text-[10px] text-slate-500">No aciertas ganador ni empate</span>
              </div>
              <span className="font-black text-sm text-slate-500 bg-slate-950 border border-slate-850 px-3 py-1 rounded-xl">0 pts</span>
            </div>
          </div>
        </div>

        {/* Bonos de Racha y Campeón */}
        <div className="glass-card rounded-3xl p-6 border border-slate-855 flex flex-col gap-4">
          <h2 className="font-extrabold text-base text-slate-200 tracking-tight flex items-center gap-2 border-b border-slate-800 pb-2">
            <TrendingUp className="w-5 h-5 text-soccer-gold" />
            Bonificaciones Especiales
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Puedes obtener ventajas estratégicas con bonos especiales:
          </p>

          <div className="flex flex-col gap-3 mt-1">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-200">Predicción del Campeón</span>
                <span className="text-[10px] text-slate-500">Elige al campeón antes del fin de la Fecha 3</span>
              </div>
              <span className="font-black text-sm text-soccer-gold bg-soccer-gold/10 border border-soccer-gold/20 px-3 py-1 rounded-xl text-soccer-gold">+50 pts</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-slate-200">Bono por Racha</span>
                <span className="text-[10px] text-slate-500">Por cada 5 partidos consecutivos sumando puntos (&gt;0)</span>
              </div>
              <span className="font-black text-sm text-soccer-green bg-soccer-green/10 border border-soccer-green/20 px-3 py-1 rounded-xl">+15 pts</span>
            </div>
          </div>
        </div>

        {/* Comodín: Doble */}
        <div className="glass-card rounded-3xl p-6 border border-slate-850 flex flex-col gap-3">
          <h2 className="font-extrabold text-base text-slate-200 tracking-tight flex items-center gap-2 border-b border-slate-800 pb-2">
            <ArrowRightLeft className="w-5 h-5 text-soccer-green" />
            Comodín: Partido Doble (1 por Ronda)
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Te permite duplicar los puntos si aciertas el resultado exacto en un partido seleccionado.
          </p>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl text-[11px] leading-relaxed text-slate-300 flex flex-col gap-2">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-soccer-green shrink-0 mt-0.5" />
              <span>Puedes usar **un Doble por cada ronda** del mundial (Fecha 1, Fecha 2, Fecha 3, Octavos, etc.).</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-soccer-green shrink-0 mt-0.5" />
              <span>Si aciertas el resultado exacto, recibes **+20 puntos** (10 x 2).</span>
            </div>
            <div className="flex items-start gap-1.5 text-red-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <span>**¡Sin Red de Seguridad!** Si el resultado final no es exacto, sumas **0 puntos**, incluso si acertaste al ganador.</span>
            </div>
          </div>
        </div>

        {/* Comodín: Joker */}
        <div className="glass-card rounded-3xl p-6 border border-slate-850 flex flex-col gap-3">
          <h2 className="font-extrabold text-base text-slate-200 tracking-tight flex items-center gap-2 border-b border-slate-800 pb-2">
            <Sparkles className="w-5 h-5 text-soccer-gold" />
            Comodín: Joker Único (1 por Torneo)
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            El mayor multiplicador del torneo, pero con riesgo de penalización negativa si fallas.
          </p>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl text-[11px] leading-relaxed text-slate-300 flex flex-col gap-2">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-soccer-gold shrink-0 mt-0.5" />
              <span>Puedes usarlo en **un solo partido de todo el torneo**.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-soccer-gold shrink-0 mt-0.5" />
              <span>Si aciertas el resultado exacto, recibes **+30 puntos** (10 x 3).</span>
            </div>
            <div className="flex items-start gap-1.5 text-red-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <span>**¡Puntos Negativos!** Si el resultado no es exacto, se te restan **-10 puntos** del total de tu tabla.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="glass-card rounded-3xl p-5 border border-slate-800/80 text-center flex flex-col items-center gap-1.5 max-w-xl mx-auto mt-4">
        <HelpCircle className="w-5 h-5 text-slate-400" />
        <span className="font-extrabold text-xs text-slate-300 uppercase tracking-wider">Cierre de Predicciones</span>
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
          Las predicciones de cada partido se bloquean en el segundo de inicio oficial del encuentro. El campeón se bloquea al iniciar el último partido de la Fecha 3.
        </p>
      </div>

    </div>
  )
}

export default Rules
