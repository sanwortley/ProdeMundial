import React, { useState, useEffect } from 'react'
import { Save, AlertCircle, Sparkles, AlertTriangle, ArrowRightLeft } from 'lucide-react'

const KNOCKOUT_PHASES = new Set([
  'Dieciseisavos de Final', 'Octavos de Final',
  'Cuartos de Final', 'Semifinal', 'Final'
])

const MatchCard = ({
  match,
  prediction,
  onSave,
  hasJokerUsed,
  hasDobleUsed
}) => {
  const {
    id_partido,
    fecha,
    fase,
    equipo_local,
    equipo_visitante,
    goles_local,
    goles_visitante,
    finalizado,
    status,
    minute,
    injury_time
  } = match

  const isKnockout = KNOCKOUT_PHASES.has(fase)

  // State for prediction inputs
  const [golesLocal, setGolesLocal] = useState('')
  const [golesVisitante, setGolesVisitante] = useState('')
  const [ganadorPredicho, setGanadorPredicho] = useState(null)
  const [usaJoker, setUsaJoker] = useState(false)
  const [usaDoble, setUsaDoble] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Sync state with prediction props when they load
  useEffect(() => {
    if (prediction) {
      setGolesLocal(prediction.goles_local_predicho !== undefined ? prediction.goles_local_predicho : '')
      setGolesVisitante(prediction.goles_visitante_predicho !== undefined ? prediction.goles_visitante_predicho : '')
      setGanadorPredicho(prediction.ganador_predicho || null)
      setUsaJoker(!!prediction.usa_joker)
      setUsaDoble(!!prediction.usa_doble)
    } else {
      setGolesLocal('')
      setGolesVisitante('')
      setGanadorPredicho(null)
      setUsaJoker(false)
      setUsaDoble(false)
    }
  }, [prediction])

  // Force UTC parsing by appending Z (backend stores dates in UTC)
  // The browser automatically converts this to the user's local timezone
  const fechaUtc = fecha.endsWith('Z') || fecha.includes('+') ? fecha : fecha + 'Z'
  const matchDate = new Date(fechaUtc)
  const [timeState, setTimeState] = useState({ isStarted: false, formattedTime: '', timeOnly: '' })

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const isStarted = now >= matchDate

      // Format day/month in local timezone
      const day   = matchDate.getDate().toString().padStart(2, '0')
      const month = (matchDate.getMonth() + 1).toString().padStart(2, '0')
      // Format HH:MM in the user's local timezone (always 24h)
      const hours   = matchDate.getHours().toString().padStart(2, '0')
      const minutes = matchDate.getMinutes().toString().padStart(2, '0')

      const dateStr = `${day}/${month}`
      const timeStr = `${hours}:${minutes}`
      const formattedTime = `${dateStr} ${timeStr}hs`

      setTimeState({ isStarted, formattedTime, timeOnly: `${timeStr}hs` })
    }

    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [fecha])

  const handleSave = async () => {
    if (golesLocal === '' || golesVisitante === '') {
      setErrorMsg('Debes ingresar goles para ambos equipos.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccess(false)

    const isDraw = golesLocal !== '' && golesVisitante !== '' && parseInt(golesLocal) === parseInt(golesVisitante)
    if (isKnockout && isDraw && !ganadorPredicho) {
      setErrorMsg('Empate: elegí quién gana.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        id_partido,
        goles_local_predicho: parseInt(golesLocal),
        goles_visitante_predicho: parseInt(golesVisitante),
        ganador_predicho: (isKnockout && isDraw) ? ganadorPredicho : null,
        usa_joker: usaJoker,
        usa_doble: usaDoble
      }

      await onSave(payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (error) {
      setErrorMsg(error.response?.data?.detail || 'Error al guardar pronóstico')
    } finally {
      setLoading(false)
    }
  }

  // Determine if options are locked
  const isInputDisabled = timeState.isStarted || finalizado

  // A user can use Joker on THIS match even if hasJokerUsed is true, provided THIS match is already the one using the Joker
  const canUseJoker = !hasJokerUsed || (prediction && prediction.usa_joker)
  const canUseDoble = !hasDobleUsed || (prediction && prediction.usa_doble)

  const isLive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE'

  const getLiveTimeLabel = (useStatus = true) => {
    if (useStatus && status === 'PAUSED') {
      return 'Entretiempo'
    }
    if (minute !== undefined && minute !== null) {
      if (minute === 45 && injury_time > 0) {
        return `45+${injury_time}'`
      }
      if (minute === 90 && injury_time > 0) {
        return `90+${injury_time}'`
      }
      return `${minute}'`
    }
    // Fallback estimation using matchDate
    const now = new Date()
    const elapsedMinutes = Math.floor((now - matchDate) / 60000)
    if (elapsedMinutes < 1) return "1'"
    if (elapsedMinutes <= 45) return `${elapsedMinutes}'`
    if (elapsedMinutes <= 60) return "45+'"
    const secondHalfMinute = elapsedMinutes - 15
    if (secondHalfMinute <= 90) return `${secondHalfMinute}'`
    return "90+'"
  }

  const timeLabel = isLive ? getLiveTimeLabel() : (timeState.isStarted ? getLiveTimeLabel(false) : '')
  const showScore = isLive || (timeState.isStarted && !finalizado)

  return (
    <div className={`glass-card rounded-3xl p-5 flex flex-col gap-4 border transition-all duration-300 ${
      finalizado 
        ? 'border-slate-800/80 bg-slate-900/30' 
        : isLive 
          ? 'border-red-500/30 bg-red-500/5'
          : timeState.isStarted 
            ? 'border-yellow-600/30 bg-yellow-500/5' 
            : 'border-slate-800 hover:border-soccer-green/20'
    }`}>
      
      {/* Card Header (Fase / Date / Badges) */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
          {fase}
        </span>
        
        <div className="flex items-center gap-1.5">
          {finalizado ? (
            <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              Terminado
            </span>
          ) : isLive ? (
            <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
              {timeLabel === 'Entretiempo' ? 'Entretiempo' : `En Vivo (${timeLabel})`}
            </span>
          ) : timeState.isStarted ? (
            <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"></span>
              Jugando ({timeLabel})
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-soccer-green/10 border border-soccer-green/20 text-soccer-green font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                Pendiente
              </span>
              <span className="text-xs text-slate-400 font-semibold" title="Horario en tu zona horaria local">
                {timeState.formattedTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Teams and Inputs Layout */}
      <div className="flex items-center justify-between gap-4 py-2">
        {/* Local Team */}
        <div className="flex-1 flex flex-col items-center text-center gap-2">
          <span className="font-extrabold text-sm text-slate-200 line-clamp-2">
            {equipo_local}
          </span>
        </div>

        {/* Goals Inputs / Real Result */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <input
              type="number"
              min="0"
              disabled={isInputDisabled}
              value={golesLocal}
              onChange={(e) => setGolesLocal(e.target.value)}
              className="w-12 h-12 bg-slate-950/60 border border-slate-800 focus:border-soccer-green rounded-xl text-center font-extrabold text-lg text-slate-100 disabled:opacity-75 disabled:bg-slate-900/30 disabled:border-slate-800/50"
              placeholder="-"
            />
            <span className="text-slate-600 font-bold">vs</span>
            <input
              type="number"
              min="0"
              disabled={isInputDisabled}
              value={golesVisitante}
              onChange={(e) => setGolesVisitante(e.target.value)}
              className="w-12 h-12 bg-slate-950/60 border border-slate-800 focus:border-soccer-green rounded-xl text-center font-extrabold text-lg text-slate-100 disabled:opacity-75 disabled:bg-slate-900/30 disabled:border-slate-800/50"
              placeholder="-"
            />
          </div>

          {/* Live Score Display */}
          {showScore && (
            <div className="flex items-center justify-center gap-1.5 py-0.5 px-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <span className="text-[9px] text-red-400 uppercase tracking-widest font-black">
                {isLive ? 'En Vivo:' : 'Jugando:'}
              </span>
              <span className="text-xs font-black text-slate-200">
                {goles_local !== null ? goles_local : 0} - {goles_visitante !== null ? goles_visitante : 0}
              </span>
            </div>
          )}
        </div>

        {/* Visitor Team */}
        <div className="flex-1 flex flex-col items-center text-center gap-2">
          <span className="font-extrabold text-sm text-slate-200 line-clamp-2">
            {equipo_visitante}
          </span>
        </div>
      </div>

      {/* Finished Game: Real Result Display & Points */}
      {finalizado && (
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>Resultado:</span>
              <span className="font-black text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                {goles_local} - {goles_visitante}
              </span>
              {isKnockout && match.ganador && (
                <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Ganador: {match.ganador}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Mi Pronóstico:</span>
              <span className="text-xs font-bold text-slate-200">
                {prediction ? `${prediction.goles_local_predicho}-${prediction.goles_visitante_predicho}` : 'Ninguno'}
              </span>
              {prediction && isKnockout && prediction.ganador_predicho && (
                <span className="text-[10px] text-slate-400">(+{prediction.ganador_predicho})</span>
              )}
              {prediction && (
                <span className={`ml-2 text-xs font-black px-2.5 py-1 rounded-lg border ${
                  prediction.puntos_obtenidos > 0
                    ? 'bg-soccer-green/10 border-soccer-green/20 text-soccer-green'
                    : prediction.puntos_obtenidos < 0
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {prediction.puntos_obtenidos > 0 ? '+' : ''}{prediction.puntos_obtenidos} pts
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Winner selector: only shown for knockout matches when score prediction is a draw */}
      {isKnockout && !finalizado && (() => {
        const isDraw = golesLocal !== '' && golesVisitante !== '' && parseInt(golesLocal) === parseInt(golesVisitante)
        if (!isDraw) return null
        return (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-amber-500/20">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Empate — ¿Quién gana? (+5pts)</span>
            <div className="flex gap-2">
              <button
                disabled={isInputDisabled}
                onClick={() => setGanadorPredicho(ganadorPredicho === equipo_local ? null : equipo_local)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  ganadorPredicho === equipo_local
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:border-amber-500/30 hover:text-amber-400'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {equipo_local}
              </button>
              <button
                disabled={isInputDisabled}
                onClick={() => setGanadorPredicho(ganadorPredicho === equipo_visitante ? null : equipo_visitante)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  ganadorPredicho === equipo_visitante
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:border-amber-500/30 hover:text-amber-400'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {equipo_visitante}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Toggles (Joker and Double Match) */}
      {!finalizado && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/40">
          <div className="flex gap-4">
            {/* Joker Option */}
            <label className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all ${
              usaJoker 
                ? 'text-soccer-gold font-extrabold' 
                : canUseJoker && !isInputDisabled
                  ? 'text-slate-400 hover:text-slate-300' 
                  : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}>
              <input
                type="checkbox"
                disabled={isInputDisabled || !canUseJoker}
                checked={usaJoker}
                onChange={(e) => {
                  setUsaJoker(e.target.checked)
                  if (e.target.checked) setUsaDoble(false) // Mutually exclusive for the same match
                }}
                className="rounded border-slate-800 bg-slate-950 text-soccer-gold focus:ring-soccer-gold/20"
              />
              <Sparkles className="w-3.5 h-3.5" />
              <span>Joker</span>
            </label>

            {/* Double Match Option */}
            <label className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all ${
              usaDoble 
                ? 'text-soccer-green font-extrabold' 
                : canUseDoble && !isInputDisabled
                  ? 'text-slate-400 hover:text-slate-300' 
                  : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}>
              <input
                type="checkbox"
                disabled={isInputDisabled || !canUseDoble}
                checked={usaDoble}
                onChange={(e) => {
                  setUsaDoble(e.target.checked)
                  if (e.target.checked) setUsaJoker(false) // Mutually exclusive
                }}
                className="rounded border-slate-800 bg-slate-950 text-soccer-green focus:ring-soccer-green/20"
              />
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Doble</span>
            </label>
          </div>

          {/* Action Save Button */}
          {!isInputDisabled && (
            <div className="flex items-center justify-end gap-2">
              {errorMsg && (
                <span className="text-[10px] text-red-400 font-semibold max-w-[150px] truncate" title={errorMsg}>
                  {errorMsg}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={loading || golesLocal === '' || golesVisitante === ''}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  success 
                    ? 'bg-soccer-green text-soccer-dark border border-soccer-green'
                    : 'bg-slate-800 border border-slate-700/50 hover:bg-soccer-green hover:text-soccer-dark hover:border-soccer-green text-slate-200'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{success ? 'Guardado' : 'Guardar'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MatchCard
