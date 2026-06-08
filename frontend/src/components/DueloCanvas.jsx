import { useRef, useEffect, useState, useCallback } from 'react'

const GOAL_ZONES = [
  { id: 1, label: 'SI',  x: 0.25, y: 0.15 },
  { id: 2, label: 'SD',  x: 0.75, y: 0.15 },
  { id: 3, label: 'C',   x: 0.50, y: 0.35 },
  { id: 4, label: 'II',  x: 0.25, y: 0.70 },
  { id: 5, label: 'ID',  x: 0.75, y: 0.70 },
]

const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)]
const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1)
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]
const getZoneFromAngle = (deg) => {
  const a = Math.abs(deg)
  if (a < 12) return 3              // C
  if (a > 25) return deg < 0 ? 4 : 5  // II / ID
  return deg < 0 ? 1 : 2              // SI / SD
}

function getScript(ronda, pateadorNombre, pateadorPosicion, retadorJugadores, rivalJugadores) {
  const atk = retadorJugadores.length ? retadorJugadores : [{nombre: pateadorNombre || 'El delantero', posicion: pateadorPosicion || 'FWD', posicion_especifica: 'ST'}]
  const def = rivalJugadores.length ? rivalJugadores : [{nombre: 'El rival', posicion: 'DEF', posicion_especifica: 'CB'}]
  const shootName = pateadorNombre || (atk.find(p => p.posicion === 'FWD')?.nombre) || atk[0]?.nombre || '?'

  const mids = atk.filter(p => p.posicion === 'MID')
  const fwds = atk.filter(p => p.posicion === 'FWD')
  const defs = atk.filter(p => p.posicion === 'DEF')
  const allOutfield = atk

  const pickByPos = (pool) => pool.length ? pickRandom(pool) : pickRandom(allOutfield)

  const passer = pickByPos(mids)
  const receiver = pickByPos(fwds)
  const playmaker = pickByPos(mids)
  const crosser = pickByPos(fwds)
  const runner1 = pickByPos(fwds)
  const runner2 = pickByPos(fwds.length > 1 ? fwds : allOutfield)
  const dummy1 = pickByPos(defs)
  const dummy2 = pickByPos(defs)

  const idx = (p) => atk.indexOf(p)
  const pIdx = idx(passer)
  const rIdx = idx(receiver)
  const plIdx = idx(playmaker)
  const cIdx = idx(crosser)
  const r1Idx = idx(runner1)
  const r2Idx = idx(runner2)
  const d1Idx = idx(dummy1)
  const d2Idx = idx(dummy2)
  const sIdx = idx(atk.find(p => p.nombre === shootName) || receiver)

  const scriptTemplates = [
    // Ronda 1: build-up through middle
    [
      { text: `${passer.nombre} toca para ${receiver.nombre}...`, dur: 2.5, action: 'pass', highlights: [pIdx, rIdx] },
      { text: `${playmaker.nombre} levanta y ve a ${runner1.nombre}...`, dur: 2.5, action: 'look', highlights: [plIdx, r1Idx] },
      { text: `${crosser.nombre} mete un centro al area!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, r1Idx, d1Idx, d2Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) cabecea!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 2: playmaker dribble
    [
      { text: `${playmaker.nombre} la pisa en tres cuartos...`, dur: 2.5, action: 'dribble', highlights: [plIdx] },
      { text: `${playmaker.nombre} se saca a ${dummy2.nombre} de encima...`, dur: 2.5, action: 'dribble', highlights: [plIdx, d2Idx] },
      { text: `${crosser.nombre} abre a la banda y centra!`, dur: 2.5, action: 'cross', highlights: [cIdx, plIdx, rIdx, r1Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) de palomita!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 3: counter attack
    [
      { text: `${dummy1.nombre} agarra un rebote en el area...`, dur: 2.5, action: 'pass', highlights: [d1Idx, plIdx] },
      { text: `${playmaker.nombre} amaga, enrieda...`, dur: 2.5, action: 'dribble', highlights: [plIdx, r1Idx] },
      { text: `${crosser.nombre} tira el centro al segundo palo!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, r1Idx, plIdx, d1Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) conecta!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 4: hold-up play
    [
      { text: `${receiver.nombre} recibe de espaldas al arco...`, dur: 2.5, action: 'pass', highlights: [rIdx, pIdx] },
      { text: `${receiver.nombre} aguanta la marca, gira...`, dur: 2.5, action: 'dribble', highlights: [rIdx, d1Idx] },
      { text: `${crosser.nombre} busca el corazon del area!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, plIdx, d1Idx, d2Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) se estira!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 5: long ball
    [
      { text: `${dummy1.nombre} baja un pelotazo...`, dur: 2.5, action: 'pass', highlights: [d1Idx, plIdx] },
      { text: `${playmaker.nombre} descarga para ${crosser.nombre}...`, dur: 2.5, action: 'pass', highlights: [plIdx, cIdx] },
      { text: `${crosser.nombre} centra al punto penal!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, r1Idx, d1Idx, d2Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) gana de arriba!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
  ]

  return scriptTemplates[(ronda - 1) % scriptTemplates.length]
}

export default function DueloCanvas({
  phase,
  ronda,
  isAtacante,
  pateadorNombre,
  pateadorPosicion,
  arqueroNombre,
  resultado,
  onShoot,
  onDefend,
  retadorJugadores,
  rivalJugadores,
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const scriptRef = useRef(null)
  const scriptStartRef = useRef(0)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [countdown, setCountdown] = useState(10)
  const countdownRef = useRef(null)
  const scriptLineRef = useRef(0)
  const resultAnimRef = useRef(null)
  // Swipe state
  const [swipeStart, setSwipeStart] = useState(null)
  const [swipeCurrent, setSwipeCurrent] = useState(null)
  const swipeStartTimeRef = useRef(0)
  const swipeStartRef = useRef(null)
  const swipeCurrentRef = useRef(null)

  useEffect(() => {
    if (phase === 'penalty') {
      setSelectedGoal(null)
      setCountdown(10)
      setSwipeStart(null)
      setSwipeCurrent(null)
      swipeStartRef.current = null
      swipeCurrentRef.current = null
    } else {
      setSelectedGoal(null)
    }
  }, [phase, ronda])

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
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [phase, ronda])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    if (phase === 'animation') {
      scriptRef.current = getScript(ronda, pateadorNombre || '', pateadorPosicion || '', retadorJugadores, rivalJugadores)
      scriptStartRef.current = Date.now()
      scriptLineRef.current = 0
      drawNarration(ctx, w, h, animRef, scriptRef, scriptStartRef, scriptLineRef)
    } else if (phase === 'penalty') {
      const loop = () => {
        drawGoal(ctx, w, h, phase, resultado, selectedGoal, 1, isAtacante, swipeStartRef.current, swipeCurrentRef.current)
        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
    } else if (phase === 'result') {
      if (resultAnimRef.current) cancelAnimationFrame(resultAnimRef.current)
      const startTime = Date.now()
      const duration = 400
      const loop = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        drawGoal(ctx, w, h, phase, resultado, selectedGoal, progress, isAtacante)
        if (progress < 1) {
          resultAnimRef.current = requestAnimationFrame(loop)
        }
      }
      resultAnimRef.current = requestAnimationFrame(loop)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      drawWaiting(ctx, w, h)
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (resultAnimRef.current) cancelAnimationFrame(resultAnimRef.current)
    }
  }, [phase, resultado, ronda, pateadorNombre, pateadorPosicion, selectedGoal, retadorJugadores, rivalJugadores, isAtacante])

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    return { x, y }
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (phase !== 'penalty' || selectedGoal !== null) return
    const pos = getCanvasPos(e)
    if (!pos) return
    swipeStartRef.current = pos
    swipeCurrentRef.current = pos
    setSwipeStart(pos)
    setSwipeCurrent(pos)
    swipeStartTimeRef.current = Date.now()
  }, [phase, selectedGoal, getCanvasPos])

  const handlePointerMove = useCallback((e) => {
    if (!swipeStartRef.current) return
    const pos = getCanvasPos(e)
    if (!pos) return
    swipeCurrentRef.current = pos
    setSwipeCurrent(pos)
  }, [getCanvasPos])

  const handlePointerUp = useCallback((e) => {
    if (!swipeStartRef.current) return
    const pos = getCanvasPos(e)
    if (!pos) { resetSwipe(); return }

    // Use swipe direction (start → end) for both roles
    const sx = swipeStartRef.current.x
    const sy = swipeStartRef.current.y
    const dx = pos.x - sx
    const dy = pos.y - sy
    const dist = Math.hypot(dx, dy)

    // Too short → ignore
    if (dist < 15) { resetSwipe(); return }

    // Attacker must swipe upward
    if (isAtacante && dy >= 0) { resetSwipe(); return }

    // Angle: 0° = straight up, negative = left, positive = right
    const angleRad = Math.atan2(dx, -dy)
    const angleDeg = angleRad * (180 / Math.PI)
    const zone = getZoneFromAngle(angleDeg)

    // Force only matters for attacker
    const elapsed = Date.now() - swipeStartTimeRef.current
    const speed = elapsed > 0 ? dist / elapsed : 0
    const fuerza = isAtacante ? Math.round(Math.min(speed * 100, 100)) : 50

    resetSwipe()

    if (zone) {
      setSelectedGoal(zone)
      if (isAtacante) onShoot?.(zone, fuerza)
      else onDefend?.(zone)
    }
  }, [isAtacante, onShoot, onDefend, getCanvasPos])

  const resetSwipe = useCallback(() => {
    swipeStartRef.current = null
    swipeCurrentRef.current = null
    setSwipeStart(null)
    setSwipeCurrent(null)
  }, [])

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={resetSwipe}
      />

      {phase === 'penalty' && (
        <div className="absolute -top-2 left-0 right-0 flex flex-col items-center gap-1 px-2 pointer-events-none">
          {/* Role indicator */}
          <div className={`px-4 py-1.5 rounded-xl text-sm font-extrabold tracking-wide shadow-lg ${
            isAtacante
              ? 'bg-soccer-green/25 text-soccer-green border border-soccer-green/40 animate-pulse'
              : 'bg-yellow-500/25 text-yellow-400 border border-yellow-500/40 animate-pulse'
          }`}>
            {isAtacante ? '⚽ TU TURNO: PATEÁ' : '🧤 TU TURNO: ATAJÁ'}
          </div>
          {/* Player matchup */}
          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2 mt-1">
            <span className="text-soccer-green">⚽ {pateadorNombre || '?'}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-yellow-400">🧤 {arqueroNombre || 'Arquero'}</span>
          </div>
          <div className="flex items-center justify-between w-full px-2 mt-1">
            <span className="text-[10px] font-bold text-slate-500">
              {isAtacante ? 'Deslizá hacia el arco' : 'Deslizá para atajar'}
            </span>
            <span className={`text-base font-black ${countdown <= 3 ? 'text-red-400' : 'text-slate-300'}`}>
              {countdown}s
            </span>
          </div>
        </div>
      )}

      {phase === 'penalty' && (
        <div className="absolute top-14 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden pointer-events-none">
          <div
            className={`h-full rounded-full transition-all ${countdown <= 3 ? 'bg-red-500' : countdown <= 5 ? 'bg-yellow-500' : 'bg-soccer-green'}`}
            style={{ width: `${(countdown / 10) * 100}%` }}
          />
        </div>
      )}

      {pateadorNombre && phase === 'animation' && (
        <div className="absolute -bottom-10 left-0 right-0 text-center">
          <span className="text-[11px] text-slate-400 font-semibold">
            ⚽ {pateadorNombre} <span className="text-slate-500">({pateadorPosicion})</span>
            {arqueroNombre && (
              <> <span className="text-slate-600">vs</span> 🧤 {arqueroNombre}</>
            )}
          </span>
        </div>
      )}

      {phase === 'result' && resultado && (
        <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
          <div className={`px-6 py-3 rounded-xl font-bold text-sm animate-bounce ${resultado.es_gol ? 'bg-soccer-green/20 text-soccer-green border border-soccer-green/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {resultado.es_gol ? '⚽ GOL!' : '🧤 Atajó!'}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PITCH
// ---------------------------------------------------------------------------
function drawPitch(ctx, w, h) {
  const m = 10
  const cx = w / 2
  const cy = h / 2

  ctx.fillStyle = '#1a6b30'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#1a7335'
  for (let y = m; y < h - m; y += 16) {
    ctx.fillRect(m, y, w - m * 2, 8)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(m, m, w - m * 2, h - m * 2)

  ctx.beginPath()
  ctx.moveTo(m, cy)
  ctx.lineTo(w - m, cy)
  ctx.stroke()
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.arc(cx, cy, 28, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()

  const paX = cx - 80, paY = m, paW = 160, paH = 50
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(paX, paY, paW, paH)
  ctx.strokeRect(paX, h - m - paH, paW, paH)

  const gaX = cx - 35, gaY = m, gaW = 70, gaH = 18
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(gaX, gaY, gaW, gaH)
  ctx.strokeRect(gaX, h - m - gaH, gaW, gaH)

  ctx.beginPath()
  ctx.arc(cx, m + 36, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, h - m - 36, 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, m + 36, 16, -Math.PI * 0.4, Math.PI * 0.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, h - m - 36, 16, Math.PI * 0.6, Math.PI * 1.4)
  ctx.stroke()

  const cr = 7
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  for (const [ax, ay] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    ctx.beginPath()
    ctx.arc(ax, ay, cr, ax === m ? (ay === m ? 0 : Math.PI * 1.5) : (ay === m ? Math.PI / 2 : Math.PI), ax === m ? (ay === m ? Math.PI / 2 : Math.PI * 2) : (ay === m ? Math.PI : Math.PI * 1.5))
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// PLAYER FIGURE
// ---------------------------------------------------------------------------
function drawPlayer(ctx, x, y, jerseyColor, isHighlight, shirtLabel) {
  ctx.save()
  const hScale = isHighlight ? 1.4 : 1

  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 10 * hScale, 5 * hScale, 2 * hScale, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#1a1a2e'
  ctx.lineWidth = 1.5 * hScale
  ctx.beginPath()
  ctx.moveTo(x - 2 * hScale, y + 3 * hScale)
  ctx.lineTo(x - 2.5 * hScale, y + 9 * hScale)
  ctx.moveTo(x + 2 * hScale, y + 3 * hScale)
  ctx.lineTo(x + 2.5 * hScale, y + 9 * hScale)
  ctx.stroke()

  ctx.fillStyle = jerseyColor
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.ellipse(x, y, 5 * hScale, 6 * hScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.ellipse(x - 4 * hScale, y - 1 * hScale, 2.5 * hScale, 4 * hScale, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + 4 * hScale, y - 1 * hScale, 2.5 * hScale, 4 * hScale, 0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#1a1a2e'
  ctx.beginPath()
  ctx.rect(x - 3.5 * hScale, y + 4 * hScale, 7 * hScale, 3 * hScale)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y - 7 * hScale, 3.5 * hScale, 0, Math.PI * 2)
  ctx.fillStyle = '#f5d6a8'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  ctx.fillStyle = isHighlight ? '#eab308' : '#2d1b0e'
  ctx.beginPath()
  ctx.arc(x, y - 8.5 * hScale, 3 * hScale, Math.PI, 0)
  ctx.fill()

  if (shirtLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `${Math.round(5 * hScale)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(shirtLabel, x, y + 0.5)
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// SCENE-AWARE PLAYER POSITIONS (dynamic, driven by script)
// ---------------------------------------------------------------------------
function getPlayerPositions(w, h, t, totalDur, lineIdx, scriptAction, highlights = []) {
  const cx = w / 2
  const cy = h / 2
  const lineStart = lineIdx * 2.5
  const progLine = clamp((t - lineStart) / 2.5, 0, 1)
  const overall = clamp(t / totalDur, 0, 1)

  function pos(startX, startY, endX, endY, wobble = 1) {
    return {
      x: lerp(startX, endX, overall) + Math.sin(t * 1.1 + startX * 0.1) * 4 * wobble,
      y: lerp(startY, endY, overall) + Math.cos(t * 0.9 + startY * 0.1) * 3 * wobble,
    }
  }

  const baseAtkY = cy - 80
  const baseDefY = cy + 80

  const atkDef = [
    pos(cx - 50, baseAtkY, cx - 40, cy + 60),
    pos(cx - 20, baseAtkY + 5, cx - 15, cy + 62),
    pos(cx + 20, baseAtkY + 5, cx + 15, cy + 62),
    pos(cx + 50, baseAtkY, cx + 40, cy + 60),
  ]
  const atkMid = [
    pos(cx - 35, baseAtkY + 35, cx - 20, cy + 20),
    pos(cx, baseAtkY + 40, cx, cy + 25),
    pos(cx + 35, baseAtkY + 35, cx + 20, cy + 20),
  ]
  const atkFwd = [
    pos(cx - 30, baseAtkY + 75, cx - 15, cy - 5),
    pos(cx, baseAtkY + 80, cx, cy),
    pos(cx + 30, baseAtkY + 75, cx + 15, cy - 5),
  ]

  const defDef = [
    pos(cx - 45, baseDefY, cx - 35, cy - 55),
    pos(cx - 15, baseDefY + 5, cx - 10, cy - 58),
    pos(cx + 15, baseDefY + 5, cx + 10, cy - 58),
    pos(cx + 45, baseDefY, cx + 35, cy - 55),
  ]
  const defMid = [
    pos(cx - 30, baseDefY - 35, cx - 15, cy - 20),
    pos(cx, baseDefY - 40, cx + 5, cy - 22),
    pos(cx + 30, baseDefY - 35, cx + 15, cy - 20),
  ]
  const defFwd = [
    pos(cx - 18, baseDefY - 75, cx - 8, cy + 5),
    pos(cx + 18, baseDefY - 75, cx + 8, cy + 5),
  ]

  const allPos = [...atkDef, ...atkMid, ...atkFwd, ...defDef, ...defMid, ...defFwd]

  // Dynamic offsets based on script action and highlights
  let offsetPlayers = []

  if (scriptAction === 'pass') {
    // Two players close together, ball between them
    const [aIdx = 4, bIdx = 7] = highlights
    const dist = 15 * Math.sin(progLine * Math.PI)
    offsetPlayers = [
      { idx: aIdx, dx: -dist * 0.5, dy: 0 },
      { idx: bIdx, dx: dist * 0.5, dy: 0 },
    ]
    // Runners in behind
    if (highlights.length > 2) {
      offsetPlayers.push({ idx: highlights[2], dx: 0, dy: -5 * progLine })
    }
  }

  else if (scriptAction === 'look') {
    // Playmaker looks up, runners go forward
    const [plIdx = 5, r1Idx = 7] = highlights
    offsetPlayers = [
      { idx: plIdx, dx: 0, dy: -3 * Math.sin(progLine * Math.PI) },
      { idx: r1Idx, dx: 0, dy: -8 * progLine },
    ]
    if (highlights.length > 2) {
      offsetPlayers.push({ idx: highlights[2], dx: 0, dy: -8 * progLine })
    }
  }

  else if (scriptAction === 'dribble') {
    // Playmaker moves forward with ball, defender closes
    const [plIdx = 5, defIdx] = highlights
    offsetPlayers = [
      { idx: plIdx, dx: 0, dy: -10 * progLine },
    ]
    if (highlights.length > 1 && defIdx !== undefined) {
      offsetPlayers.push({ idx: defIdx, dx: 0, dy: 8 * progLine })
    }
  }

  else if (scriptAction === 'cross') {
    // Winger goes wide and crosses, forwards and defenders attack the ball
    const [cIdx = 8, f1Idx = 7, f2Idx = 9, d1Idx = 0, d2Idx = 3] = highlights
    const widePush = 20 * progLine
    offsetPlayers = [
      { idx: cIdx, dx: widePush, dy: -5 * progLine },
      { idx: f1Idx, dx: -5, dy: -10 * progLine },
      { idx: f2Idx !== undefined ? f2Idx : f1Idx, dx: 5, dy: -10 * progLine },
    ]
    // Defenders track back into box
    if (d1Idx !== undefined) offsetPlayers.push({ idx: d1Idx, dx: 0, dy: -5 * progLine })
    if (d2Idx !== undefined) offsetPlayers.push({ idx: d2Idx, dx: 0, dy: -5 * progLine })
  }

  else if (scriptAction === 'header') {
    // Striker jumps for header, support runners
    const [sIdx = 9, sup1Idx = 7, sup2Idx = 8] = highlights
    const jumpY = -12 * Math.sin(progLine * Math.PI)
    offsetPlayers = [
      { idx: sIdx, dx: 0, dy: jumpY },
    ]
    if (sup1Idx !== undefined) offsetPlayers.push({ idx: sup1Idx, dx: -3, dy: -5 * progLine })
    if (sup2Idx !== undefined) offsetPlayers.push({ idx: sup2Idx, dx: 3, dy: -5 * progLine })
  }

  // Apply offsets
  for (const o of offsetPlayers) {
    if (allPos[o.idx]) {
      allPos[o.idx].x += o.dx
      allPos[o.idx].y += o.dy
    }
  }

  const highlightSet = new Set(highlights)

  return allPos.map((p, i) => ({
    x: clamp(p.x, 15, w - 15),
    y: clamp(p.y, 15, h - 15),
    color: i < 10 ? '#3b82f6' : '#ef4444',
    isHome: i < 10,
    isHighlight: highlightSet.has(i),
  }))
}

// ---------------------------------------------------------------------------
// BALL POSITION (driven by script action)
// ---------------------------------------------------------------------------
function getBallPos(t, totalDur, w, h, lineIdx, scriptAction) {
  const cx = w / 2
  const cy = h / 2
  const lineStart = lineIdx * 2.5
  const prog = clamp((t - lineStart) / 2.5, 0, 1)
  const s = (a, b, p) => lerp(a, b, p)

  if (scriptAction === 'pass') {
    // Ball travels between two players
    const x1 = cx - 10, y1 = cy - 25
    const x2 = cx - 15, y2 = cy + 10
    return {
      x: s(x1, x2, prog) + Math.sin(t * 3 + lineIdx) * 2,
      y: s(y1, y2, prog) - Math.sin(prog * Math.PI) * 8 + Math.cos(t * 2) * 2,
    }
  }

  if (scriptAction === 'look' || scriptAction === 'dribble') {
    // Ball at playmaker's feet, moving forward
    return {
      x: cx + 5 + Math.sin(t * 1.5) * 4,
      y: s(cy, cy - 8, prog) + Math.sin(t * 1.8 + lineIdx) * 3,
    }
  }

  if (scriptAction === 'cross') {
    // Ball arcs from flank into the box
    const side = (lineIdx % 2 === 0) ? 1 : -1
    const sx = cx + side * 40, sy = cy - 15
    const ex = cx - side * 5, ey = cy + 40
    return {
      x: s(sx, ex, prog) + Math.sin(t * 2) * 3,
      y: s(sy, ey, prog) - Math.sin(prog * Math.PI) * 14 + Math.cos(t * 1.5) * 2,
    }
  }

  if (scriptAction === 'header') {
    // Ball at penalty spot with bounce
    const bounce = Math.sin(prog * Math.PI * 2) * Math.max(1 - prog, 0) * 4
    return {
      x: cx + Math.sin(t * 2 + lineIdx) * 2,
      y: cy + 45 + bounce,
    }
  }

  return { x: cx, y: cy }
}

// ---------------------------------------------------------------------------
// NARRATION
// ---------------------------------------------------------------------------
function drawNarration(ctx, w, h, animRef, scriptRef, scriptStartRef, scriptLineRef) {
  const t = (Date.now() - scriptStartRef.current) / 1000
  const script = scriptRef.current
  if (!script) return

  ctx.fillStyle = '#0e4d22'
  ctx.fillRect(0, 0, w, h)
  drawPitch(ctx, w, h)

  const totalDur = script.reduce((s, l) => s + l.dur, 0)

  let elapsed = 0
  let lineIdx = 0
  for (let i = 0; i < script.length; i++) {
    if (t >= elapsed && t < elapsed + script[i].dur) { lineIdx = i; break }
    elapsed += script[i].dur
    lineIdx = i + 1
  }
  lineIdx = Math.min(lineIdx, script.length - 1)
  scriptLineRef.current = lineIdx

  const lineData = script[lineIdx]
  const action = lineData?.action || 'pass'
  const highlights = lineData?.highlights || []

  const players = getPlayerPositions(w, h, t, totalDur, lineIdx, action, highlights)

  for (const p of players) {
    if (!p) continue
    drawPlayer(ctx, p.x, p.y, p.color, p.isHighlight)
  }

  const ball = getBallPos(t, totalDur, w, h, lineIdx, action)

  // ball shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.beginPath()
  ctx.ellipse(ball.x, ball.y + 5, 5, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // ball
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // pentagons
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t
    ctx.beginPath()
    ctx.arc(ball.x + Math.cos(a) * 1.5, ball.y + Math.sin(a) * 1.5, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#222'
    ctx.fill()
  }
  ctx.restore()

  // narration text
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#10b981'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(script[lineIdx]?.text || '', w / 2, h - 10)
  ctx.restore()

  animRef.current = requestAnimationFrame(() => {
    drawNarration(ctx, w, h, animRef, scriptRef, scriptStartRef, scriptLineRef)
  })
}

// ---------------------------------------------------------------------------
// WAITING
// ---------------------------------------------------------------------------
function drawWaiting(ctx, w, h) {
  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff20'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Esperando...', w / 2, h / 2)
}

// ---------------------------------------------------------------------------
// GOAL / PENALTY — natural, no lines, GK dives, swipe for attacker
// ---------------------------------------------------------------------------
function drawGoal(ctx, w, h, phase, resultado, selectedGoal, animProgress = 1, isAtacante = false, swipeStart = null, swipeCurrent = null) {
  const gkLeft = 60
  const gkRight = w - 60
  const gkTop = 20
  const gkBottom = gkTop + 140
  const gkCx = (gkLeft + gkRight) / 2
  const gkRestY = gkBottom - 12

  // Pitch background
  ctx.fillStyle = '#0a3d1a'
  ctx.fillRect(0, 0, w, h)

  // Goal area (darker green)
  ctx.fillStyle = '#1a6b30'
  ctx.fillRect(gkLeft - 5, gkTop - 10, gkRight - gkLeft + 10, gkBottom - gkTop + 15)

  // Goal frame
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(gkLeft, gkBottom)
  ctx.lineTo(gkLeft, gkTop)
  ctx.lineTo(gkRight, gkTop)
  ctx.lineTo(gkRight, gkBottom)
  ctx.stroke()

  // Net pattern (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 0.5
  for (let x = gkLeft; x <= gkRight; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, gkTop)
    ctx.lineTo(x, gkBottom)
    ctx.stroke()
  }
  for (let y = gkTop; y <= gkBottom; y += 16) {
    ctx.beginPath()
    ctx.moveTo(gkLeft, y)
    ctx.lineTo(gkRight, y)
    ctx.stroke()
  }

  const zones = GOAL_ZONES.map((z) => ({
    ...z,
    rx: gkLeft + z.x * (gkRight - gkLeft),
    ry: gkTop + z.y * (gkBottom - gkTop),
  }))

  const now = Date.now()

  // --- Penalty phase ---
  if (phase === 'penalty') {
    // --- BALL (shown to both) ---
    const ballX = 200
    const ballY = 270

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(ballX, ballY + 4, 7, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 0.5
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + now / 400
      ctx.beginPath()
      ctx.arc(ballX + Math.cos(a) * 2.5, ballY + Math.sin(a) * 2.5, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#222'
      ctx.fill()
    }
    ctx.restore()

    if (isAtacante) {
      // --- ATTACKER swipe: arrow from ball + power bar ---
      if (swipeStart && swipeCurrent) {
        const endX = swipeCurrent.x
        const endY = swipeCurrent.y

        if (endY < ballY) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.beginPath()
          ctx.moveTo(ballX, ballY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
          ctx.setLineDash([])

          const angle = Math.atan2(endY - ballY, endX - ballX)
          const headLen = 10
          ctx.beginPath()
          ctx.moveTo(endX, endY)
          ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4))
          ctx.moveTo(endX, endY)
          ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4))
          ctx.stroke()

          // Power bar
          const dist = Math.hypot(endX - ballX, endY - ballY)
          const fuerza = Math.min(dist / 2.5, 100)
          const pct = Math.min(fuerza / 80, 1)
          const barW = 60
          const barH = 6
          const barX = (w - barW) / 2
          const barY = 205

          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)

          const color = pct > 1 ? '#ef4444' : pct > 0.7 ? '#facc15' : '#22c55e'
          ctx.fillStyle = color
          const fillW = Math.min(pct, 1) * barW
          ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2)

          ctx.fillStyle = pct > 1 ? '#ef4444' : '#ffffffa0'
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText(pct > 1 ? '💥 MUY FUERTE!' : 'Potencia', barX, barY - 2)
          ctx.restore()
        }
      }

      // Selected zone
      if (selectedGoal) {
        const z = zones.find(zn => zn.id === selectedGoal)
        if (z) {
          ctx.beginPath()
          ctx.arc(z.rx, z.ry, 18, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fill()
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.fillStyle = '#22c55e'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(z.label, z.rx, z.ry)
        }
      }
    } else {
      // --- DEFENDER swipe: arrow from GK + zone highlight ---
      if (swipeStart && swipeCurrent) {
        const endX = swipeCurrent.x
        const endY = swipeCurrent.y
        const gkSX = gkCx
        const gkSY = gkRestY

        ctx.save()
        ctx.strokeStyle = 'rgba(234,179,8,0.7)'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(gkSX, gkSY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
        ctx.setLineDash([])

        const angle = Math.atan2(endY - gkSY, endX - gkSX)
        const headLen = 10
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4))
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4))
        ctx.stroke()

        // Show target zone from angle
        const dx = endX - gkSX
        const dy = endY - gkSY
        const aRad = Math.atan2(dx, -dy)
        const aDeg = aRad * (180 / Math.PI)
        const targetZone = getZoneFromAngle(aDeg)
        if (targetZone) {
          const tz = zones.find(z => z.id === targetZone)
          if (tz) {
            ctx.beginPath()
            ctx.arc(tz.rx, tz.ry, 20, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(234,179,8,0.15)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(234,179,8,0.6)'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      // Selected zone
      if (selectedGoal) {
        const z = zones.find(zn => zn.id === selectedGoal)
        if (z) {
          ctx.beginPath()
          ctx.arc(z.rx, z.ry, 22, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(234,179,8,0.2)'
          ctx.fill()
          ctx.strokeStyle = '#eab308'
          ctx.lineWidth = 2.5
          ctx.stroke()

          ctx.fillStyle = '#eab308'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(z.label, z.rx, z.ry)
        }
      }
    }

    // GK waiting — slight sway (shown to both)
    const swayX = Math.sin(now / 300) * 3
    const swayY = Math.sin(now / 250) * 1.5
    drawGoalkeeper(ctx, gkCx + swayX, gkRestY + swayY, 1.7, false, 0)

    if (!selectedGoal) {
      ctx.save()
      ctx.globalAlpha = 0.15 + Math.sin(now / 600) * 0.08
      ctx.fillStyle = '#ffffff'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('~ deslizá para elegir ~', gkCx, h - 5)
      ctx.restore()
    }
  }

  // --- Result phase: GK dives, ball appears ---
  if (phase === 'result' && resultado) {
    const atkZone = zones.find(z => z.id === resultado.posicion_atacante)
    const defZone = zones.find(z => z.id === resultado.posicion_arquero)

    // GK dives from center to chosen zone
    if (defZone) {
      const ease = animProgress < 0.5
        ? 2 * animProgress * animProgress
        : 1 - Math.pow(-2 * animProgress + 2, 2) / 2
      const diveX = lerp(gkCx, defZone.rx, ease)
      const diveY = lerp(gkRestY, defZone.ry + 8, ease)
      const armsOut = 0.8 + ease * 0.6
      drawGoalkeeper(ctx, diveX, diveY, 1.7, true, armsOut)
    } else {
      drawGoalkeeper(ctx, gkCx, gkRestY, 1.7, false, 0)
    }

    // Ball appears at attacker's zone (no trajectory)
    if (atkZone) {
      const ballShow = Math.min(animProgress * 2, 1)
      const bx = atkZone.rx
      const by = atkZone.ry - lerp(20, 0, ballShow)

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.beginPath()
      ctx.ellipse(atkZone.rx, atkZone.ry + 4, 6, 2, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ball
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(bx, by, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#888'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Pentagon details
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + now / 400
        ctx.beginPath()
        ctx.arc(bx + Math.cos(a) * 2, by + Math.sin(a) * 2, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = '#222'
        ctx.fill()
      }
      ctx.restore()

      // Net ripple on goal
      if (resultado.es_gol && animProgress >= 0.3) {
        const ripple = Math.sin((animProgress - 0.3) * Math.PI * 4) * (1 - animProgress) * 8
        ctx.strokeStyle = `rgba(255,255,255,${(1 - animProgress) * 0.3})`
        ctx.lineWidth = 1.5
        for (let i = 0; i < 3; i++) {
          const rr = Math.max(0, ripple + i * 6)
          ctx.beginPath()
          ctx.arc(bx, by, rr, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    // Goal/save label (appears after short delay)
    if (animProgress >= 0.15) {
      const labelAlpha = Math.min((animProgress - 0.15) * 5, 1)
      ctx.save()
      ctx.globalAlpha = labelAlpha
      const gol = resultado.es_gol
      ctx.fillStyle = gol ? '#22c55e' : '#ef4444'
      ctx.font = `bold ${18 + (1 - animProgress) * 4}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(gol ? '⚽ GOL!' : '🧤 ATAJÓ!', gkCx, gkBottom + 18)
      ctx.restore()
    }
  }
}

// ---------------------------------------------------------------------------
// GOALKEEPER FIGURE
// ---------------------------------------------------------------------------
function drawGoalkeeper(ctx, x, y, scale = 1, isDiving = false, armSpread = 0.8) {
  ctx.save()
  const s = scale
  const aSpread = armSpread

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(x, y + 8 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  ctx.strokeStyle = '#1a1a2e'
  ctx.lineWidth = 2 * s
  const legSpread = isDiving ? 6 * s : 3 * s
  ctx.beginPath()
  ctx.moveTo(x - 3 * s, y - 2 * s)
  ctx.lineTo(x - legSpread, y + 6 * s)
  ctx.moveTo(x + 3 * s, y - 2 * s)
  ctx.lineTo(x + legSpread, y + 6 * s)
  ctx.stroke()

  // Body
  ctx.fillStyle = '#eab308'
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 1
  ctx.beginPath()
  const bw = 12 * s
  const bh = 16 * s
  const tilt = isDiving ? (armSpread - 0.8) * 6 : 0
  ctx.ellipse(x + tilt, y - 8 * s, bw / 2, bh / 2, isDiving ? 0.2 : 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Arms (extend more when diving)
  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = 2.5 * s
  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.moveTo(x - 6 * s + tilt, y - 11 * s)
  ctx.lineTo(x - (6 + aSpread * 8) * s, y - 6 * s)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 6 * s + tilt, y - 11 * s)
  ctx.lineTo(x + (6 + aSpread * 8) * s, y - 6 * s)
  ctx.stroke()

  // Gloves (hands)
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.arc(x - (6 + aSpread * 8) * s, y - 6 * s, 3.5 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + (6 + aSpread * 8) * s, y - 6 * s, 3.5 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Head
  ctx.beginPath()
  ctx.arc(x + tilt, y - 18 * s, 5.5 * s, 0, Math.PI * 2)
  ctx.fillStyle = '#f5d6a8'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Hair
  ctx.fillStyle = '#2d1b0e'
  ctx.beginPath()
  ctx.arc(x + tilt, y - 20 * s, 5 * s, Math.PI, 0)
  ctx.fill()

  // Cap
  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.arc(x + tilt, y - 20 * s, 5.2 * s, Math.PI, 0)
  ctx.fill()

  ctx.restore()
}
