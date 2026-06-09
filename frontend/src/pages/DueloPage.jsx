import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Swords } from 'lucide-react'
import api from '../api/axios'
import DueloCanvas from '../components/DueloCanvas'
import useDuelWebSocket from '../hooks/useDuelWebSocket'

export default function DueloPage() {
  const { dueloId } = useParams()
  const navigate = useNavigate()
  const { connected, gameState, shoot, defend, sendMessage } = useDuelWebSocket(dueloId)
  const [dueloInfo, setDueloInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const audioRefs = useRef({})

  useEffect(() => {
    loadDuelo()
  }, [dueloId])

  useEffect(() => {
    if (gameState.phase === 'match_end') {
      playSound(gameState.ganadorId ? 'win' : 'lose')
    }
    if (gameState.phase === 'result') {
      playSound(gameState.resultado?.es_gol ? 'goal' : 'save')
    }
    if (gameState.phase === 'animation') {
      playSound('whistle')
    }
  }, [gameState.phase])

  useEffect(() => {
    if (gameState.phase === 'match_end' && gameState.walkover && dueloInfo) {
      const t = setTimeout(() => {
        navigate(`/groups/${dueloInfo.id_grupo}/fantasy`)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [gameState.phase, gameState.walkover])

  async function loadDuelo() {
    try {
      setLoading(true)
      const res = await api.get(`/fantasy/duel/${dueloId}`)
      setDueloInfo(res.data)
    } catch (e) {
      setError('Error al cargar el duelo')
    } finally {
      setLoading(false)
    }
  }

  const soundCacheRef = useRef({})
  const audioCtxRef = useRef(null)

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtxRef.current
  }

  useEffect(() => {
    // Preload all sounds as audio buffers (no range requests)
    const names = ['whistle', 'goal', 'save', 'shoot', 'crowd', 'win', 'lose']
    const ctx = getAudioCtx()
    names.forEach(async (n) => {
      try {
        const res = await fetch(`/sounds/${n}.mp3`)
        if (res.ok) {
          const buf = await res.arrayBuffer()
          const audioBuf = await ctx.decodeAudioData(buf)
          soundCacheRef.current[n] = audioBuf
        }
      } catch {}
    })
    return () => {
      soundCacheRef.current = {}
    }
  }, [])

  function playSound(name) {
    const buf = soundCacheRef.current[name]
    if (!buf) return
    try {
      const ctx = getAudioCtx()
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      ctx.resume()
    } catch {}
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm">Cargando duelo...</p>
      </div>
    )
  }

  if (error || !dueloInfo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-red-400 text-sm mb-4">{error || 'Duelo no encontrado'}</p>
        <button onClick={() => navigate(-1)}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-sm font-bold">
          Volver
        </button>
      </div>
    )
  }

  const userId = getUserId()
  const isRetador = userId === dueloInfo.id_retador
  const myNombre = isRetador ? dueloInfo.retador_nombre : dueloInfo.rival_nombre
  const rivalNombre = isRetador ? dueloInfo.rival_nombre : dueloInfo.retador_nombre
  const myGoles = isRetador ? gameState.golesRetador : gameState.golesRival
  const rivalGoles = isRetador ? gameState.golesRival : gameState.golesRetador

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate(-1)}
          className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-soccer-green" />
          <span className="text-sm font-bold text-slate-200">Duelo</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-soccer-green' : 'bg-red-400'}`} />
      </div>

      {/* Scoreboard */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className={`text-lg font-extrabold ${gameState.ganadorId === userId ? 'text-soccer-green' : ''}`}>
              {myNombre}
            </div>
            <div className="text-3xl font-black text-slate-100 mt-1">{myGoles}</div>
          </div>
          <div className="px-4 text-center">
            <div className="text-xs text-slate-500 font-bold uppercase">Ronda</div>
            <div className="text-lg font-black text-soccer-green">{gameState.ronda}/10</div>
          </div>
          <div className="flex-1 text-center">
            <div className={`text-lg font-extrabold ${gameState.ganadorId && gameState.ganadorId !== userId ? 'text-soccer-green' : ''}`}>
              {rivalNombre}
            </div>
            <div className="text-3xl font-black text-slate-100 mt-1">{rivalGoles}</div>
          </div>
        </div>
      </div>

      {/* Matchup info */}
      {(gameState.phase === 'animation' || gameState.phase === 'penalty') && (
        <div className="glass-card rounded-xl px-3 py-2 border border-slate-800 mb-3">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className={`font-bold ${gameState.isAtacante ? 'text-soccer-green' : 'text-slate-300'}`}>
              {gameState.isAtacante ? '⚽ ' : ''}{gameState.atacanteNombre || '?'}
            </span>
            <span className="text-slate-600 text-xs">vs</span>
            <span className={`font-bold ${!gameState.isAtacante ? 'text-yellow-400' : 'text-slate-300'}`}>
              {!gameState.isAtacante ? '🧤 ' : ''}{gameState.arqueroNombre ? `Arq: ${gameState.arqueroNombre}` : '?'}
            </span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <DueloCanvas
          phase={gameState.phase}
          ronda={gameState.ronda}
          isAtacante={gameState.isAtacante}
          pateadorNombre={gameState.pateadorNombre}
          pateadorPosicion={gameState.pateadorPosicion}
          arqueroNombre={gameState.arqueroNombre}
          resultado={gameState.resultado}
          onShoot={shoot}
          onDefend={defend}
          retadorJugadores={gameState.retadorJugadores}
          rivalJugadores={gameState.rivalJugadores}
        />
      </div>

      {/* Phase info */}
      <div className="text-center mt-4">
        {gameState.phase === 'connecting' && (
          <p className="text-slate-400 text-sm">Conectando...</p>
        )}
        {gameState.phase === 'reconnecting' && (
          <p className="text-yellow-400 text-sm animate-pulse">Conexión perdida. Reconectando...</p>
        )}
        {gameState.phase === 'waiting' && (
          <p className="text-slate-400 text-sm animate-pulse">Esperando rival...</p>
        )}
        {gameState.phase === 'animation' && (
          <p className="text-slate-400 text-sm animate-pulse">⚽ Partido en juego...</p>
        )}
        {gameState.phase === 'penalty' && (
          <p className="text-soccer-green text-sm font-bold">
            {gameState.isAtacante
              ? 'Elegí dónde tirar el penal'
              : 'Elegí dónde atajar'}
          </p>
        )}
        {gameState.phase === 'result' && (
          <p className="text-slate-300 text-sm font-bold">
            {gameState.resultado?.es_gol ? '⚽ GOL!' : '🧤 Atajó!'}
          </p>
        )}
        {gameState.phase === 'match_end' && (
          <div>
            {gameState.walkover ? (
              <>
                <div className="text-soccer-green text-lg font-black">🏆 GANASTE!</div>
                <p className="text-slate-400 text-xs mt-1">
                  {gameState.walkoverReason === 'rival_left'
                    ? 'Tu rival abandonó el partido'
                    : 'Tu rival se desconectó'}
                </p>
                <p className="text-slate-600 text-[10px] mt-1">Volviendo al inicio...</p>
              </>
            ) : (
              <>
                {gameState.ganadorId === userId ? (
                  <div className="text-soccer-green text-lg font-black">GANASTE! 🏆</div>
                ) : gameState.ganadorId ? (
                  <div className="text-red-400 text-lg font-black">Perdiste 😔</div>
                ) : (
                  <div className="text-slate-300 text-lg font-black">Empate 🤝</div>
                )}
                <button onClick={() => { sendMessage({ type: 'leave' }); navigate(`/groups/${dueloInfo.id_grupo}/fantasy`) }}
                  className="mt-3 px-6 py-2.5 bg-gradient-green text-white font-bold rounded-xl">
                  Volver
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getUserId() {
  try {
    const user = localStorage.getItem('user')
    if (user) return JSON.parse(user).id_usuario
  } catch {}
  return null
}
