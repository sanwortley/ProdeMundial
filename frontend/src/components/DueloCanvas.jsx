import { useRef, useEffect, useState, useCallback } from 'react'

const GOAL_POSITIONS = [
  { id: 1, label: 'SI', x: 18, y: 12 },
  { id: 2, label: 'SD', x: 82, y: 12 },
  { id: 3, label: 'C',  x: 50, y: 35 },
  { id: 4, label: 'II', x: 18, y: 75 },
  { id: 5, label: 'ID', x: 82, y: 75 },
]

export default function DueloCanvas({
  phase,           // 'waiting' | 'animation' | 'penalty' | 'result'
  duracion,
  ronda,
  atacanteId,
  isAtacante,
  pateadorNombre,
  pateadorPosicion,
  pateadorValor,
  resultado,
  onShoot,
  onDefend,
  myUserId,
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [showGoalSelector, setShowGoalSelector] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [countdown, setCountdown] = useState(10)
  const countdownRef = useRef(null)

  // Reset when phase changes to penalty
  useEffect(() => {
    if (phase === 'penalty') {
      setShowGoalSelector(true)
      setSelectedGoal(null)
      setCountdown(10)
    } else {
      setShowGoalSelector(false)
      setSelectedGoal(null)
    }
  }, [phase, ronda])

  // Countdown timer
  useEffect(() => {
    if (phase !== 'penalty') {
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }
    setCountdown(10)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current)
          if (isAtacante && !selectedGoal) {
            onShoot?.(0)
          } else if (!isAtacante && !selectedGoal) {
            onDefend?.(0)
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [phase, ronda, isAtacante])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    if (phase === 'animation') {
      drawAnimation(ctx, w, h, animRef)
    } else if (phase === 'penalty' || phase === 'result') {
      drawGoal(ctx, w, h, phase, resultado)
    } else {
      drawWaiting(ctx, w, h)
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
  }, [phase, resultado])

  const handleGoalClick = useCallback((posId) => {
    if (selectedGoal !== null) return
    setSelectedGoal(posId)
    if (isAtacante) {
      onShoot?.(posId)
    } else {
      onDefend?.(posId)
    }
  }, [isAtacante, onShoot, onDefend, selectedGoal])

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full rounded-xl border border-slate-700 bg-slate-900"
      />

      {/* Goal selector overlay */}
      {showGoalSelector && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[70%] h-[60%] mt-[15%]">
            {/* Timer bar */}
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-bold text-slate-400">
                {isAtacante ? 'Elegí dónde tirar' : 'Elegí dónde atajar'}
              </span>
              <span className={`text-lg font-bold ${countdown <= 3 ? 'text-red-400' : 'text-slate-300'}`}>
                {countdown}s
              </span>
            </div>
            <div className="absolute -top-4 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${countdown <= 3 ? 'bg-red-500' : countdown <= 5 ? 'bg-yellow-500' : 'bg-soccer-green'}`}
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
            {/* Pateador info */}
            {pateadorNombre && (
              <div className="absolute -bottom-10 left-0 right-0 text-center">
                <span className="text-[11px] text-slate-400 font-semibold">
                  ⚽ {pateadorNombre} <span className="text-slate-500">({pateadorPosicion})</span>
                </span>
              </div>
            )}
            {/* Goal grid */}
            <div className="grid grid-cols-2 gap-2 h-full">
              <button onClick={() => handleGoalClick(1)}
                className="bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={selectedGoal !== null}>
                SI
              </button>
              <button onClick={() => handleGoalClick(2)}
                className="bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={selectedGoal !== null}>
                SD
              </button>
              <button onClick={() => handleGoalClick(3)}
                className="bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50 col-span-2"
                disabled={selectedGoal !== null}>
                CENTRO
              </button>
              <button onClick={() => handleGoalClick(4)}
                className="bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={selectedGoal !== null}>
                II
              </button>
              <button onClick={() => handleGoalClick(5)}
                className="bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                disabled={selectedGoal !== null}>
                ID
              </button>
            </div>
            {selectedGoal && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-slate-900/80 rounded-xl px-4 py-2 text-center">
                  <p className="text-white font-bold text-sm">Elección enviada</p>
                  <p className="text-slate-400 text-xs">Esperando al rival...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result overlay */}
      {phase === 'result' && resultado && (
        <div className="absolute top-4 left-0 right-0 flex justify-center">
          <div className={`px-6 py-3 rounded-xl font-bold text-sm ${resultado.es_gol ? 'bg-soccer-green/20 text-soccer-green border border-soccer-green/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {resultado.es_gol ? '⚽ GOL!' : '🧤 Atajó el arquero!'}
          </div>
        </div>
      )}
    </div>
  )
}

// Canvas draw functions

function drawWaiting(ctx, w, h) {
  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff20'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Esperando...', w / 2, h / 2)
}

function drawAnimation(ctx, w, h, animRef) {
  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)

  const t = Date.now() / 1000

  // Draw pitch lines
  ctx.strokeStyle = '#ffffff40'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, w - 20, h - 20)

  // Center circle
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w / 2, 10)
  ctx.lineTo(w / 2, h - 10)
  ctx.stroke()

  // Penalty areas
  ctx.strokeRect(w / 2 - 60, 10, 120, 50)
  ctx.strokeRect(w / 2 - 60, h - 60, 120, 50)

  // Draw player circles
  const homePlayers = generatePositions(w, h, true, t)
  const awayPlayers = generatePositions(w, h, false, t)

  for (const p of homePlayers) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  for (const p of awayPlayers) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Ball
  const ballX = w / 2 + Math.sin(t * 2) * 80
  const ballY = h / 2 + Math.cos(t * 1.7) * 60
  ctx.beginPath()
  ctx.arc(ballX, ballY, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Label
  ctx.fillStyle = '#ffffff80'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('⚽ Partido en juego...', w / 2, h - 4)

  animRef.current = requestAnimationFrame(() => drawAnimation(ctx, w, h, animRef))
}

function drawGoal(ctx, w, h, phase, resultado) {
  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)

  // Goal posts
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  const gkLeft = 60
  const gkRight = w - 60
  const gkTop = 20
  const gkBottom = gkTop + 120

  // Posts
  ctx.beginPath()
  ctx.moveTo(gkLeft, gkBottom)
  ctx.lineTo(gkLeft, gkTop)
  ctx.lineTo(gkRight, gkTop)
  ctx.lineTo(gkRight, gkBottom)
  ctx.stroke()

  // Net pattern
  ctx.strokeStyle = '#ffffff20'
  ctx.lineWidth = 0.5
  for (let x = gkLeft; x <= gkRight; x += 20) {
    ctx.beginPath()
    ctx.moveTo(x, gkTop)
    ctx.lineTo(x, gkBottom)
    ctx.stroke()
  }
  for (let y = gkTop; y <= gkBottom; y += 15) {
    ctx.beginPath()
    ctx.moveTo(gkLeft, y)
    ctx.lineTo(gkRight, y)
    ctx.stroke()
  }

  // Goal zones labels
  const zones = [
    { x: gkLeft + 25, y: gkTop + 25, label: 'SI' },
    { x: gkRight - 25, y: gkTop + 25, label: 'SD' },
    { x: (gkLeft + gkRight) / 2, y: (gkTop + gkBottom) / 2, label: 'C' },
    { x: gkLeft + 25, y: gkBottom - 25, label: 'II' },
    { x: gkRight - 25, y: gkBottom - 25, label: 'ID' },
  ]

  // Show ball trajectory on result
  if (phase === 'result' && resultado) {
    const ballZones = {
      1: { x: gkLeft + 20, y: gkTop + 15 },
      2: { x: gkRight - 20, y: gkTop + 15 },
      3: { x: (gkLeft + gkRight) / 2, y: (gkTop + gkBottom) / 2 },
      4: { x: gkLeft + 25, y: gkBottom - 20 },
      5: { x: gkRight - 25, y: gkBottom - 20 },
    }

    // Draw ball trajectory
    const atkZone = ballZones[resultado.posicion_atacante]
    const defZone = ballZones[resultado.posicion_arquero]

    if (atkZone) {
      ctx.beginPath()
      ctx.moveTo(w / 2, h)
      ctx.quadraticCurveTo(w / 2, h * 0.4, atkZone.x, atkZone.y)
      ctx.strokeStyle = resultado.es_gol ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Ball
      ctx.beginPath()
      ctx.arc(atkZone.x, atkZone.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    // Draw goalie stretch
    if (defZone) {
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo((gkLeft + gkRight) / 2, gkBottom)
      ctx.lineTo(defZone.x, defZone.y)
      ctx.stroke()
    }
  }

  if (phase === 'penalty') {
    ctx.fillStyle = '#ffffff60'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Arco', (gkLeft + gkRight) / 2, gkBottom + 30)
  }
}

function generatePositions(w, h, isHome, t) {
  const positions = []
  const offset = isHome ? 0 : Math.PI
  const baseX = isHome ? w * 0.25 : w * 0.75
  const spreadX = 60
  const spreadY = 80

  // GK
  positions.push({
    x: baseX + Math.sin(t * 0.5 + offset) * 5,
    y: h / 2 + Math.cos(t * 0.3 + offset) * 5,
  })

  // DEF
  for (let i = 0; i < 4; i++) {
    positions.push({
      x: baseX + Math.sin(t * 0.7 + i * 1.5 + offset) * spreadX * 0.6,
      y: h * 0.3 + i * 20 + Math.cos(t * 0.4 + i + offset) * 8,
    })
  }

  // MID
  for (let i = 0; i < 3; i++) {
    positions.push({
      x: baseX + Math.sin(t * 0.5 + i * 2 + offset) * spreadX,
      y: h * 0.45 + i * 18 + Math.cos(t * 0.6 + i * 1.5 + offset) * 6,
    })
  }

  // FWD
  for (let i = 0; i < 3; i++) {
    positions.push({
      x: baseX + Math.sin(t * 0.8 + i * 2.5 + offset) * spreadX * 0.8,
      y: h * 0.7 + i * 15 + Math.cos(t * 0.5 + i * 2 + offset) * 5,
    })
  }

  return positions
}
