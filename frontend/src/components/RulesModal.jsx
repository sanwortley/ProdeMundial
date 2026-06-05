import React from 'react'
import { Trophy, Sparkles, ArrowRightLeft, TrendingUp, X } from 'lucide-react'
import Button from './Button'

const RulesModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto relative animate-scaleUp">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-soccer-green/10 p-3 rounded-2xl border border-soccer-green/20 text-soccer-green shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Trophy className="w-8 h-8 text-soccer-gold animate-bounce" />
          </div>
          <h2 className="font-extrabold text-xl tracking-tight mt-2 text-slate-100">
            Reglamento del Prode Mundial
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Repasa las reglas rápidas antes de empezar
          </p>
        </div>

        {/* Rules Summary */}
        <div className="flex flex-col gap-4">
          
          {/* Puntos Básicos */}
          <div className="flex gap-3 items-start p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
            <div className="bg-soccer-green/10 p-2 rounded-xl text-soccer-green shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-xs text-slate-200">Sistema de Puntos Básicos</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Acierto exacto del marcador = **+10 puntos**. Acierto de ganador o empate (no exacto) = **+5 puntos**.
              </p>
            </div>
          </div>

          {/* Doble */}
          <div className="flex gap-3 items-start p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
            <div className="bg-soccer-green/10 p-2 rounded-xl text-soccer-green shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-xs text-slate-200">Comodín: Doble (1 por fecha)</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Duplica tus puntos si aciertas exacto (**+20 puntos**). Si fallas el resultado exacto sumas **0 puntos** (sin red de seguridad).
              </p>
            </div>
          </div>

          {/* Joker */}
          <div className="flex gap-3 items-start p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
            <div className="bg-soccer-gold/10 p-2 rounded-xl text-soccer-gold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-xs text-slate-200">Comodín: Joker (1 por torneo)</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Multiplica por tres si aciertas exacto (**+30 puntos**). Pero si no es exacto, se te restan **-10 puntos**.
              </p>
            </div>
          </div>

          {/* Bonos */}
          <div className="flex gap-3 items-start p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
            <div className="bg-soccer-gold/10 p-2 rounded-xl text-soccer-gold shrink-0">
              <TrendingUp className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-xs text-slate-200">Bonos Especiales</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Bono de **+15 puntos** por cada racha de 5 aciertos seguidos. Predicción del campeón (**+50 puntos**, cierra al inicio del último partido de la Fecha 3).
              </p>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <Button
          onClick={onClose}
          variant="primary"
          fullWidth
          className="h-12 text-sm font-black uppercase"
        >
          ¡Entendido, a jugar!
        </Button>
        
      </div>
    </div>
  )
}

export default RulesModal
