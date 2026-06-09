import { useRef, useEffect, useState, useCallback } from 'react'

const GOAL_ZONES = [
  { id: 1, label: 'IZQ', x: 0.20, y: 0.40 },
  { id: 3, label: 'CEN', x: 0.50, y: 0.40 },
  { id: 2, label: 'DER', x: 0.80, y: 0.40 },
  { id: 6, label: 'AI',  x: -0.15, y: 0.40 },
  { id: 7, label: 'AD',  x: 1.15, y: 0.40 },
]

const MISS_LABELS = {
  1: '📐 ANCHO!',
  2: '📐 ANCHO!',
  3: '📐 ANCHO!',
  6: '📐 ANCHO!',
  7: '📐 ANCHO!',
}

const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)]
const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1)
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]
const getClosestZone = (x, y, isGK = false) => {
  const gkLeft = 60
  const gkRight = 340
  const gkTop = 20
  const gkBottom = 160
  
  let minDist = Infinity
  let closestId = null
  
  GOAL_ZONES.forEach(z => {
    if (isGK && (z.id === 6 || z.id === 7)) return
    
    const rx = gkLeft + z.x * (gkRight - gkLeft)
    const ry = gkTop + z.y * (gkBottom - gkTop)
    const dist = Math.hypot(x - rx, y - ry)
    if (dist < minDist) {
      minDist = dist
      closestId = z.id
    }
  })
  
  return closestId
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
      { text: `💥 ${shootName} (${pateadorPosicion}) define al arco!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 3: counter attack
    [
      { text: `${dummy1.nombre} agarra un rebote en el area...`, dur: 2.5, action: 'pass', highlights: [d1Idx, plIdx] },
      { text: `${playmaker.nombre} amaga, enrieda...`, dur: 2.5, action: 'dribble', highlights: [plIdx, r1Idx] },
      { text: `${crosser.nombre} tira el centro al segundo palo!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, r1Idx, plIdx, d1Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) remata de primera!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 4: hold-up play
    [
      { text: `${receiver.nombre} recibe de espaldas al arco...`, dur: 2.5, action: 'pass', highlights: [rIdx, pIdx] },
      { text: `${receiver.nombre} aguanta la marca, gira...`, dur: 2.5, action: 'dribble', highlights: [rIdx, d1Idx] },
      { text: `${crosser.nombre} busca el corazon del area!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, plIdx, d1Idx, d2Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) saca el remate!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
    ],
    // Ronda 5: long ball
    [
      { text: `${dummy1.nombre} baja un pelotazo...`, dur: 2.5, action: 'pass', highlights: [d1Idx, plIdx] },
      { text: `${playmaker.nombre} descarga para ${crosser.nombre}...`, dur: 2.5, action: 'pass', highlights: [plIdx, cIdx] },
      { text: `${crosser.nombre} centra al punto penal!`, dur: 2.5, action: 'cross', highlights: [cIdx, rIdx, r1Idx, d1Idx, d2Idx] },
      { text: `💥 ${shootName} (${pateadorPosicion}) cabecea cruzado!`, dur: 2.5, action: 'header', highlights: [sIdx, rIdx, cIdx] },
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
  tipoDisparo = 'penalty',
  posIniArquero = 'centro',
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

  // Preload goalkeeper PNGs
  const gkCenterImg = useRef(null)
  const gkLeftImg = useRef(null)
  const gkRightImg = useRef(null)

  useEffect(() => {
    const img1 = new Image()
    img1.src = '/images/gk_center.png'
    gkCenterImg.current = img1

    const img2 = new Image()
    img2.src = '/images/gk_left.png'
    gkLeftImg.current = img2

    const img3 = new Image()
    img3.src = '/images/gk_right.png'
    gkRightImg.current = img3
  }, [])
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
        const images = {
          center: gkCenterImg.current,
          left: gkLeftImg.current,
          right: gkRightImg.current,
        }
        drawGoal(ctx, w, h, phase, resultado, selectedGoal, 1, isAtacante, swipeStartRef.current, swipeCurrentRef.current, images, tipoDisparo, posIniArquero)
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
        const images = {
          center: gkCenterImg.current,
          left: gkLeftImg.current,
          right: gkRightImg.current,
        }
        drawGoal(ctx, w, h, phase, resultado, selectedGoal, progress, isAtacante, null, null, images, tipoDisparo, posIniArquero)
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
  }, [phase, resultado, ronda, pateadorNombre, pateadorPosicion, selectedGoal, retadorJugadores, rivalJugadores, isAtacante, tipoDisparo, posIniArquero])

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

    const dx = pos.x - swipeStartRef.current.x
    const dy = pos.y - swipeStartRef.current.y
    const dist = Math.hypot(dx, dy)

    // Too short → ignore
    if (dist < 15) { resetSwipe(); return }

    const refX = tipoDisparo === 'costado_izq' ? 120 : tipoDisparo === 'costado_der' ? 280 : 200
    const refY = tipoDisparo === 'fuera_area' ? 285 : 270

    // Attacker must swipe upward
    if (isAtacante && dy >= 10) { resetSwipe(); return }

    // Calculate virtual target position
    const SENSITIVITY = 2.0
    const targetX = refX + dx * SENSITIVITY
    const targetY = refY + dy * SENSITIVITY

    // Find closest zone
    const zone = getClosestZone(targetX, targetY, !isAtacante)

    // Force/fuerza: based on distance of drag
    // 225px ≈ desde punto penal hasta arriba del travesaño → fuerza 80
    const fuerza = isAtacante ? Math.min(100, Math.round(20 + (dist / 300) * 80)) : 50

    resetSwipe()

    if (zone) {
      setSelectedGoal(zone)
      if (isAtacante) onShoot?.(zone, fuerza)
      else onDefend?.(zone)
    }
  }, [isAtacante, onShoot, onDefend, getCanvasPos, tipoDisparo])

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
          <div className={`px-6 py-3 rounded-xl font-bold text-sm animate-bounce ${
            resultado.es_gol
              ? 'bg-soccer-green/20 text-soccer-green border border-soccer-green/30'
              : resultado.posicion_atacante >= 6 || resultado.fuerza > 80
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {resultado.es_gol
              ? '⚽ GOL!'
              : resultado.posicion_atacante >= 6 || resultado.fuerza > 80
                ? (MISS_LABELS[resultado.posicion_atacante] || '🚀 AFUERA!')
                : '🧤 Atajó!'}
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
  ctx.arc(cx, m + 36, 16, 0.34 * Math.PI, 0.66 * Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, h - m - 36, 16, 1.34 * Math.PI, 1.66 * Math.PI)
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
function getPlayerBasePos(i, w, h) {
  const cx = w / 2
  const cy = h / 2
  const basePositions = [
    // Attacking team (Blue): starts at top, attacks downward (vertical layout spread out)
    { x: cx - 130, y: cy - 70 }, // Defender Left (0)
    { x: cx - 45,  y: cy - 80 }, // Defender Center-Left (1)
    { x: cx + 45,  y: cy - 80 }, // Defender Center-Right (2)
    { x: cx + 130, y: cy - 70 }, // Defender Right (3)
    { x: cx - 90,  y: cy - 20 }, // Midfielder Left (4)
    { x: cx,       y: cy - 30 }, // Midfielder Center (5)
    { x: cx + 90,  y: cy - 20 }, // Midfielder Right (6)
    { x: cx - 110, y: cy + 40 }, // Forward Left (7)
    { x: cx,       y: cy + 50 }, // Forward Center (8)
    { x: cx + 110, y: cy + 40 }, // Forward Right (9)

    // Defending team (Red): starts at bottom, defends upward
    { x: cx - 120, y: cy + 80 }, // Defender Left (10)
    { x: cx - 40,  y: cy + 90 }, // Defender Center-Left (11)
    { x: cx + 40,  y: cy + 90 }, // Defender Center-Right (12)
    { x: cx + 120, y: cy + 80 }, // Defender Right (13)
    { x: cx - 80,  y: cy + 30 }, // Midfielder Left (14)
    { x: cx,       y: cy + 20 }, // Midfielder Center (15)
    { x: cx + 80,  y: cy + 30 }, // Midfielder Right (16)
    { x: cx - 50,  y: cy - 40 }, // Forward Left (17)
    { x: cx + 50,  y: cy - 40 }  // Forward Right (18)
  ]
  return basePositions[i] || { x: cx, y: cy }
}

function getPlayerPositions(w, h, t, totalDur, lineIdx, scriptAction, highlights = []) {
  const cx = w / 2
  const cy = h / 2
  const progLine = clamp((t - (lineIdx * 2.5)) / 2.5, 0, 1)

  const pIdx = highlights[0] !== undefined ? highlights[0] : 4
  const rIdx = highlights[1] !== undefined ? highlights[1] : 7
  const plIdx = highlights[0] !== undefined ? highlights[0] : 5
  const r1Idx = highlights[1] !== undefined ? highlights[1] : 7
  const cIdx = highlights[0] !== undefined ? highlights[0] : 8
  const f1Idx = highlights[1] !== undefined ? highlights[1] : 7
  const f2Idx = highlights[2] !== undefined ? highlights[2] : 9
  const sIdx = highlights[0] !== undefined ? highlights[0] : 9

  // Get ball position for dynamic tracking
  const ball = getBallPos(t, totalDur, w, h, lineIdx, scriptAction, highlights)

  // 2. Generate final positions
  const allPos = Array.from({ length: 19 }, (_, i) => {
    const base = getPlayerBasePos(i, w, h)
    
    // Small breathing wobble for inactive players
    const wobbleX = Math.sin(t * 1.5 + i * 2) * 2
    const wobbleY = Math.cos(t * 1.3 + i * 3) * 1.5
    
    if (scriptAction === 'pass') {
      if (i === pIdx) {
        // Passer stands near ball start, moves slightly forward to kick
        return {
          x: base.x + 8 * Math.sin(progLine * Math.PI * 0.5),
          y: base.y + 5 * progLine
        }
      }
      if (i === rIdx) {
        // Receiver runs to meet the ball!
        return {
          x: lerp(base.x - 15, base.x, progLine),
          y: lerp(base.y - 10, base.y, progLine)
        }
      }
      // Opponent midfielder (15) moves to close down passing lane
      if (i === 15) {
        return {
          x: base.x + lerp(0, -10, progLine),
          y: base.y + lerp(0, -10, progLine)
        }
      }
    }
    
    if (scriptAction === 'look') {
      if (i === plIdx) {
        // Playmaker holds the ball
        return {
          x: base.x + wobbleX,
          y: base.y + wobbleY
        }
      }
      // Runner runs forward into space
      if (i === r1Idx) {
        return {
          x: base.x + wobbleX,
          y: base.y + 15 * progLine
        }
      }
    }
    
    if (scriptAction === 'dribble') {
      if (i === plIdx) {
        // Playmaker runs with the ball
        return {
          x: base.x + 12 * progLine,
          y: base.y + 20 * progLine
        }
      }
      // Opponent midfielder (15) runs to close down playmaker
      if (i === 15) {
        return {
          x: lerp(base.x, base.x + 10, progLine),
          y: lerp(base.y, base.y - 15, progLine)
        }
      }
    }
    
    if (scriptAction === 'cross') {
      if (i === cIdx) {
        // Winger runs deep down their respective flank
        const isRight = (base.x >= cx)
        const targetWingerX = isRight ? w - 45 : 45
        const targetWingerY = cy + 70
        return {
          x: lerp(base.x, targetWingerX, progLine),
          y: lerp(base.y, targetWingerY, progLine)
        }
      }
      if (i === f1Idx || i === f2Idx) {
        // Forwards rush into the center of the box to receive the cross
        return {
          x: lerp(base.x, cx + (i === f1Idx ? -20 : 20), progLine),
          y: lerp(base.y, cy + 85, progLine)
        }
      }
      // Opponent defenders (11, 12) track back into the box to mark attackers
      if (i === 11 || i === 12) {
        return {
          x: lerp(base.x, cx + (i === 11 ? -15 : 15), progLine),
          y: lerp(base.y, cy + 90, progLine)
        }
      }
    }
    
    if (scriptAction === 'header') {
      if (i === sIdx) {
        // Shooter moves directly to the landing zone and jumps for header
        const jumpY = -12 * Math.sin(progLine * Math.PI)
        return {
          x: cx + jumpY * 0.2,
          y: cy + 85 + jumpY
        }
      }
      // Opponent defenders (11, 12) jump to block/challenge
      if (i === 11 || i === 12) {
        const jumpY = -8 * Math.sin(progLine * Math.PI)
        return {
          x: base.x + (i === 11 ? -5 : 5),
          y: cy + 90 + jumpY
        }
      }
    }
    
    // Inactive player stays in zone with breathing wobble
    return {
      x: base.x + wobbleX,
      y: base.y + wobbleY
    }
  })

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
function getBallPos(t, totalDur, w, h, lineIdx, scriptAction, highlights = []) {
  const cx = w / 2
  const cy = h / 2
  const lineStart = lineIdx * 2.5
  const prog = clamp((t - lineStart) / 2.5, 0, 1)
  const s = (a, b, p) => lerp(a, b, p)

  const pIdx = highlights[0] !== undefined ? highlights[0] : 4
  const rIdx = highlights[1] !== undefined ? highlights[1] : 7
  const plIdx = highlights[0] !== undefined ? highlights[0] : 5
  const cIdx = highlights[0] !== undefined ? highlights[0] : 8
  const sIdx = highlights[0] !== undefined ? highlights[0] : 9

  if (scriptAction === 'pass') {
    // Ball travels between two players
    const pPos = getPlayerBasePos(pIdx, w, h)
    const rPos = getPlayerBasePos(rIdx, w, h)
    return {
      x: s(pPos.x, rPos.x, prog) + Math.sin(t * 3 + lineIdx) * 2,
      y: s(pPos.y, rPos.y, prog) - Math.sin(prog * Math.PI) * 8 + Math.cos(t * 2) * 2,
    }
  }

  if (scriptAction === 'look') {
    const plPos = getPlayerBasePos(plIdx, w, h)
    return {
      x: plPos.x + 3 + Math.sin(t * 1.5) * 2,
      y: plPos.y + 3 + Math.cos(t * 1.8) * 1.5,
    }
  }

  if (scriptAction === 'dribble') {
    // Ball stays attached to the dribbling playmaker
    const plPos = getPlayerBasePos(plIdx, w, h)
    return {
      x: plPos.x + 12 * prog + 2 + Math.sin(t * 2.5) * 1.5,
      y: plPos.y + 20 * prog + 2 + Math.cos(t * 2.8) * 1.0,
    }
  }

  if (scriptAction === 'cross') {
    // Ball crosses in a high realistic arc from deep wing to the center of the penalty box
    const cPos = getPlayerBasePos(cIdx, w, h)
    const isRight = (cPos.x >= cx)
    const endWingerX = isRight ? w - 45 : 45
    const endWingerY = cy + 70

    const startX = endWingerX
    const startY = endWingerY
    const targetX = cx
    const targetY = cy + 85

    return {
      x: s(startX, targetX, prog),
      y: s(startY, targetY, prog) - Math.sin(prog * Math.PI) * 45,
    }
  }

  if (scriptAction === 'header') {
    // Shot/Header: ball flies from the center of the box to the goal
    const startX = cx
    const startY = cy + 85
    const targetX = cx + (Math.sin(lineIdx * 5) * 30)
    const targetY = h - 12
    return {
      x: s(startX, targetX, prog),
      y: s(startY, targetY, prog),
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

  const ball = getBallPos(t, totalDur, w, h, lineIdx, action, highlights)

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
function drawGoal(ctx, w, h, phase, resultado, selectedGoal, animProgress = 1, isAtacante = false, swipeStart = null, swipeCurrent = null, images = {}, tipoDisparo = 'penalty', posIniArquero = 'centro') {
  const td = (resultado && resultado.tipo_disparo) ? resultado.tipo_disparo : tipoDisparo
  const pia = (resultado && resultado.pos_ini_arquero) ? resultado.pos_ini_arquero : posIniArquero

  const isOutside = (td === 'fuera_area')
  const gkLeft = isOutside ? 85 : 60
  const gkRight = isOutside ? w - 85 : w - 60
  const gkTop = isOutside ? 35 : 20
  const gkBottom = isOutside ? gkTop + 95 : gkTop + 140
  const gkCx = (gkLeft + gkRight) / 2
  const gkRestY = gkBottom - 12

  // Goalkeeper starting position offset
  const goalieRestX = pia === 'izquierda' ? gkCx - 45 : pia === 'derecha' ? gkCx + 45 : gkCx
  const goalieScale = isOutside ? 2.2 : 3.2

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

  // Zone indicators (faint, shown during penalty phase)
  if (phase === 'penalty') {
    ctx.save()
    ctx.globalAlpha = 0.12
    zones.forEach((z) => {
      if (z.id === 6 || z.id === 7) return // skip wide zones for visual
      ctx.beginPath()
      ctx.arc(z.rx, z.ry, 16, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(z.label, z.rx, z.ry + 0.5)
    })
    ctx.restore()
  }

  const now = Date.now()

  // --- Penalty phase ---
  if (phase === 'penalty') {
    // --- BALL (shown to both) ---
    const ballX = td === 'costado_izq' ? 120 : td === 'costado_der' ? 280 : 200
    const ballY = td === 'fuera_area' ? 285 : 270

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
        const dx = swipeCurrent.x - swipeStart.x
        const dy = swipeCurrent.y - swipeStart.y
        const dist = Math.hypot(dx, dy)

        if (dy < 10) {
          const SENSITIVITY = 2.0
          const targetX = ballX + dx * SENSITIVITY
          const targetY = ballY + dy * SENSITIVITY

          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.beginPath()
          ctx.moveTo(ballX, ballY)
          ctx.lineTo(targetX, targetY)
          ctx.stroke()
          ctx.setLineDash([])

          const angle = Math.atan2(targetY - ballY, targetX - ballX)
          const headLen = 10
          ctx.beginPath()
          ctx.moveTo(targetX, targetY)
          ctx.lineTo(targetX - headLen * Math.cos(angle - 0.4), targetY - headLen * Math.sin(angle - 0.4))
          ctx.moveTo(targetX, targetY)
          ctx.lineTo(targetX - headLen * Math.cos(angle + 0.4), targetY - headLen * Math.sin(angle + 0.4))
          ctx.stroke()

          // Power bar
          const fuerza = Math.min(100, Math.round(20 + (dist / 300) * 80))
          const pct = fuerza / 80
          const barW = 60
          const barH = 6
          const barX = (w - barW) / 2
          const barY = 205

          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)

          const color = fuerza > 80 ? '#ef4444' : pct > 0.7 ? '#facc15' : '#22c55e'
          ctx.fillStyle = color
          const fillW = Math.min(pct, 1) * barW
          ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2)

          ctx.fillStyle = fuerza > 80 ? '#ef4444' : '#ffffffa0'
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText(fuerza > 80 ? '💥 MUY FUERTE!' : 'Potencia', barX, barY - 2)
          ctx.restore()

          // Preview closest zone
          const targetZone = getClosestZone(targetX, targetY, false)
          if (targetZone) {
            const tz = zones.find(z => z.id === targetZone)
            if (tz) {
              ctx.beginPath()
              ctx.arc(tz.rx, tz.ry, 20, 0, Math.PI * 2)
              ctx.fillStyle = 'rgba(255,255,255,0.15)'
              ctx.fill()
              ctx.strokeStyle = 'rgba(255,255,255,0.6)'
              ctx.lineWidth = 1.5
              ctx.stroke()
            }
          }
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
        const dx = swipeCurrent.x - swipeStart.x
        const dy = swipeCurrent.y - swipeStart.y
        const gkSX = goalieRestX
        const gkSY = gkRestY

        const SENSITIVITY = 2.0
        const targetX = gkSX + dx * SENSITIVITY
        const targetY = gkSY + dy * SENSITIVITY

        ctx.save()
        ctx.strokeStyle = 'rgba(234,179,8,0.7)'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(gkSX, gkSY)
        ctx.lineTo(targetX, targetY)
        ctx.stroke()
        ctx.setLineDash([])

        const angle = Math.atan2(targetY - gkSY, targetX - gkSX)
        const headLen = 10
        ctx.beginPath()
        ctx.moveTo(targetX, targetY)
        ctx.lineTo(targetX - headLen * Math.cos(angle - 0.4), targetY - headLen * Math.sin(angle - 0.4))
        ctx.moveTo(targetX, targetY)
        ctx.lineTo(targetX - headLen * Math.cos(angle + 0.4), targetY - headLen * Math.sin(angle + 0.4))
        ctx.stroke()

        // Show target zone from angle/closest
        const targetZone = getClosestZone(targetX, targetY, true)
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
    drawGoalkeeper(ctx, goalieRestX + swayX, gkRestY + swayY, goalieScale, false, 0, images)

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
    const isMiss = !resultado.es_gol && (resultado.posicion_atacante >= 6 || resultado.fuerza > 80)
    const isSideMiss = isMiss && resultado.posicion_atacante !== 3

    if (isMiss) {
      // --- Ball flies wide / over the goal ---
      const penaltyX = td === 'costado_izq' ? 120 : td === 'costado_der' ? 280 : 200
      const penaltyY = td === 'fuera_area' ? 285 : 270

      const missDir = resultado.posicion_atacante === 3 ? 'up' : 'side'

      let endX, endY
      if (missDir === 'up') {
        endX = gkCx + 40
        endY = -80
      } else if (resultado.posicion_atacante === 2 || resultado.posicion_atacante === 7) {
        endX = w + 60
        endY = gkRestY - 30
      } else {
        endX = -60
        endY = gkRestY - 30
      }

      const gkLookUp = Math.min(animProgress * 3, 1)
      drawGoalkeeper(ctx, goalieRestX, gkRestY, goalieScale, false, 0, images)
      ctx.save()
      ctx.globalAlpha = gkLookUp * 0.15
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('😮', goalieRestX, gkRestY - 30 * goalieScale)
      ctx.restore()

      const arcX = lerp(penaltyX, endX, animProgress)
      const arcY = lerp(penaltyY, endY, animProgress)

      const ballSize = lerp(6, 2, Math.min(animProgress * 2, 1))

      // Trajectory arc line
      ctx.save()
      ctx.globalAlpha = 0.3 * (1 - animProgress)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(penaltyX, penaltyY)
      for (let t = 0; t <= 1; t += 0.02) {
        const tx = lerp(penaltyX, endX, t)
        const ty = lerp(penaltyY, endY, t) - Math.sin(t * Math.PI) * 40
        ctx.lineTo(tx, ty)
      }
      ctx.stroke()
      ctx.restore()

      // Shadow
      ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - animProgress)})`
      ctx.beginPath()
      ctx.ellipse(arcX + 10, penaltyY - 2, ballSize, ballSize * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ball
      ctx.save()
      const bx = arcX
      const by = arcY
      ctx.beginPath()
      ctx.arc(bx, by, ballSize, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#888'
      ctx.lineWidth = 0.5
      ctx.stroke()
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + now / 400
        ctx.beginPath()
        ctx.arc(bx + Math.cos(a) * (ballSize * 0.4), by + Math.sin(a) * (ballSize * 0.4), ballSize * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = '#222'
        ctx.fill()
      }
      ctx.restore()

      // AFUERA label
      if (animProgress >= 0.15) {
        const labelAlpha = Math.min((animProgress - 0.15) * 5, 1)
        const missLabel = MISS_LABELS[resultado.posicion_atacante] || '🚀 AFUERA!'
        ctx.save()
        ctx.globalAlpha = labelAlpha
        ctx.fillStyle = '#ef4444'
        ctx.font = `bold ${18 + (1 - animProgress) * 4}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(missLabel, gkCx, gkBottom + 18)
        ctx.restore()
      }
    } else {
      // GK dives from center to chosen zone
      if (defZone) {
        const ease = animProgress < 0.5
          ? 2 * animProgress * animProgress
          : 1 - Math.pow(-2 * animProgress + 2, 2) / 2
        const diveX = lerp(goalieRestX, defZone.rx, ease)
        const diveY = lerp(gkRestY, defZone.ry + 8, ease)
        const armsOut = 0.8 + ease * 0.6
        drawGoalkeeper(ctx, diveX, diveY, goalieScale, true, armsOut, images, defZone.id)
      } else {
        drawGoalkeeper(ctx, goalieRestX, gkRestY, goalieScale, false, 0, images)
      }

      if (atkZone) {
        const ballShow = Math.min(animProgress * 2, 1)
        const bx = atkZone.rx
        const by = atkZone.ry - lerp(20, 0, ballShow)

        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.beginPath()
        ctx.ellipse(atkZone.rx, atkZone.ry + 4, 6, 2, 0, 0, Math.PI * 2)
        ctx.fill()

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
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + now / 400
          ctx.beginPath()
          ctx.arc(bx + Math.cos(a) * 2, by + Math.sin(a) * 2, 1.2, 0, Math.PI * 2)
          ctx.fillStyle = '#222'
          ctx.fill()
        }
        ctx.restore()

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
    }

    // Goal/save/miss label (appears after short delay)
    if (animProgress >= 0.15) {
      const labelAlpha = Math.min((animProgress - 0.15) * 5, 1)
      ctx.save()
      ctx.globalAlpha = labelAlpha
      const gol = resultado.es_gol
      ctx.fillStyle = gol ? '#22c55e' : '#ef4444'
      ctx.font = `bold ${18 + (1 - animProgress) * 4}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (isMiss) {
        ctx.fillText(MISS_LABELS[resultado.posicion_atacante] || '🚀 AFUERA!', gkCx, gkBottom + 18)
      } else {
        ctx.fillText(gol ? '⚽ GOL!' : '🧤 ATAJÓ!', gkCx, gkBottom + 18)
      }
      ctx.restore()
    }
  }
}

// ---------------------------------------------------------------------------
// GOALKEEPER FIGURE
// ---------------------------------------------------------------------------
function drawGoalkeeper(ctx, x, y, scale = 1, isDiving = false, armSpread = 0.8, images = {}, defZoneId = null) {
  const s = scale

  // Select the appropriate goalkeeper sprite image based on diving state and target zone
  let img = images.center
  if (isDiving) {
    if (defZoneId === 1 || defZoneId === 4 || defZoneId === 6) {
      img = images.left
    } else if (defZoneId === 2 || defZoneId === 5 || defZoneId === 7) {
      img = images.right
    } else if (defZoneId === 3) {
      img = images.center
    } else {
      // Fallback coordinate check if no zone ID is provided
      if (x < 195) {
        img = images.left
      } else if (x > 205) {
        img = images.right
      } else {
        img = images.center
      }
    }
  }

  // Draw PNG sprite if fully loaded, otherwise fall back to vector representation
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save()
    // Realistic shadow under the goalie sprite
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(x, y + 8 * s, 10 * s, 2.8 * s, 0, 0, Math.PI * 2)
    ctx.fill()

    // Render the sprite centered at x, bottom-aligned at y + 8 * s
    const imgSize = 36 * s
    ctx.drawImage(img, x - imgSize / 2, y + 8 * s - imgSize, imgSize, imgSize)
    ctx.restore()
    return
  }

  ctx.save()
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
