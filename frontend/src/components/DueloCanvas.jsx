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

function getScript(ronda, pateadorNombre, pateadorPosicion, retadorJugadores, rivalJugadores) {
  const atk = retadorJugadores.length ? retadorJugadores : [pateadorNombre || 'El delantero']
  const def = rivalJugadores.length ? rivalJugadores : ['El rival']
  const shootName = pateadorNombre || randItem(atk)

  const lines = [
    [
      `${randItem(atk)} toca para ${randItem(atk)}...`,
      `${randItem(atk)} levanta y ve a ${randItem(atk)}...`,
      `${randItem(atk)} mete un centro al area!`,
      `💥 ${shootName} (${pateadorPosicion}) cabecea!`,
    ],
    [
      `${randItem(atk)} la pisa en tres cuartos...`,
      `${randItem(atk)} se saca a ${randItem(def)} de encima...`,
      `${randItem(atk)} abre a la banda y centra!`,
      `💥 ${shootName} (${pateadorPosicion}) de palomita!`,
    ],
    [
      `${randItem(atk)} agarra un rebote en el area...`,
      `${randItem(atk)} amaga, enrieda...`,
      `${randItem(atk)} tira el centro al segundo palo!`,
      `💥 ${shootName} (${pateadorPosicion}) conecta!`,
    ],
    [
      `${randItem(atk)} recibe de espaldas al arco...`,
      `${randItem(atk)} aguanta la marca, gira...`,
      `${randItem(atk)} busca el corazon del area!`,
      `💥 ${shootName} (${pateadorPosicion}) se estira!`,
    ],
    [
      `${randItem(atk)} baja un pelotazo...`,
      `${randItem(atk)} descarga para ${randItem(atk)}...`,
      `${randItem(atk)} centra al punto penal!`,
      `💥 ${shootName} (${pateadorPosicion}) gana de arriba!`,
    ],
  ]
  return lines[(ronda - 1) % lines.length].map((t) => ({ text: t, dur: 2.5 }))
}

export default function DueloCanvas({
  phase,
  ronda,
  isAtacante,
  pateadorNombre,
  pateadorPosicion,
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

  useEffect(() => {
    if (phase === 'penalty') {
      setSelectedGoal(null)
      setCountdown(10)
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
          if (isAtacante && !selectedGoal) onShoot?.(0)
          else if (!isAtacante && !selectedGoal) onDefend?.(0)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [phase, ronda, isAtacante])

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
        drawGoal(ctx, w, h, phase, resultado, selectedGoal)
        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
    } else if (phase === 'result') {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      drawGoal(ctx, w, h, phase, resultado, selectedGoal)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      drawWaiting(ctx, w, h)
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [phase, resultado, ronda, pateadorNombre, pateadorPosicion, selectedGoal, retadorJugadores, rivalJugadores])

  const handleCanvasClick = useCallback((e) => {
    if (phase !== 'penalty' || selectedGoal !== null) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const gkLeft = 60 / 400
    const gkRight = (400 - 60) / 400
    const gkTop = 20 / 300
    const gkBottom = (20 + 140) / 300
    for (const zone of GOAL_ZONES) {
      const zx = gkLeft + zone.x * (gkRight - gkLeft)
      const zy = gkTop + zone.y * (gkBottom - gkTop)
      const radius = 0.065
      const dx = x - zx
      const dy = y - zy
      if (dx * dx + dy * dy < radius * radius) {
        setSelectedGoal(zone.id)
        if (isAtacante) onShoot?.(zone.id)
        else onDefend?.(zone.id)
        return
      }
    }
  }, [phase, selectedGoal, isAtacante, onShoot, onDefend])

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 cursor-crosshair"
        onClick={handleCanvasClick}
      />

      {phase === 'penalty' && (
        <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-2">
          <span className="text-xs font-bold text-slate-400">
            {isAtacante ? 'Tocá la zona del arco' : 'Tocá dónde tirarte'}
          </span>
          <span className={`text-lg font-bold ${countdown <= 3 ? 'text-red-400' : 'text-slate-300'}`}>
            {countdown}s
          </span>
        </div>
      )}

      {phase === 'penalty' && (
        <div className="absolute -top-4 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${countdown <= 3 ? 'bg-red-500' : countdown <= 5 ? 'bg-yellow-500' : 'bg-soccer-green'}`}
            style={{ width: `${(countdown / 10) * 100}%` }}
          />
        </div>
      )}

      {pateadorNombre && (phase === 'penalty' || phase === 'animation') && (
        <div className="absolute -bottom-10 left-0 right-0 text-center">
          <span className="text-[11px] text-slate-400 font-semibold">
            ⚽ {pateadorNombre} <span className="text-slate-500">({pateadorPosicion})</span>
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

  // grass fill
  ctx.fillStyle = '#1a6b30'
  ctx.fillRect(0, 0, w, h)

  // grass stripes
  ctx.fillStyle = '#1a7335'
  for (let y = m; y < h - m; y += 16) {
    ctx.fillRect(m, y, w - m * 2, 8)
  }

  // outer boundary
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(m, m, w - m * 2, h - m * 2)

  // center line
  ctx.beginPath()
  ctx.moveTo(m, cy)
  ctx.lineTo(w - m, cy)
  ctx.stroke()
  ctx.lineWidth = 1

  // center circle
  ctx.beginPath()
  ctx.arc(cx, cy, 28, 0, Math.PI * 2)
  ctx.stroke()

  // center spot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()

  // top penalty area
  const paX = cx - 80, paY = m, paW = 160, paH = 50
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(paX, paY, paW, paH)

  // bottom penalty area
  ctx.strokeRect(paX, h - m - paH, paW, paH)

  // top goal area (6-yard)
  const gaX = cx - 35, gaY = m, gaW = 70, gaH = 18
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(gaX, gaY, gaW, gaH)

  // bottom goal area
  ctx.strokeRect(gaX, h - m - gaH, gaW, gaH)

  // penalty spots
  ctx.beginPath()
  ctx.arc(cx, m + 36, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, h - m - 36, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // penalty arcs
  ctx.beginPath()
  ctx.arc(cx, m + 36, 16, -Math.PI * 0.4, Math.PI * 0.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, h - m - 36, 16, Math.PI * 0.6, Math.PI * 1.4)
  ctx.stroke()

  // corner arcs
  const cr = 7
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(m, m, cr, 0, Math.PI / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(w - m, m, cr, Math.PI / 2, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(m, h - m, cr, Math.PI * 1.5, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(w - m, h - m, cr, Math.PI, Math.PI * 1.5)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// PLAYER FIGURE
// ---------------------------------------------------------------------------
function drawPlayer(ctx, x, y, jerseyColor, isHighlight, shirtLabel) {
  ctx.save()
  const hScale = isHighlight ? 1.3 : 1

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 10 * hScale, 5 * hScale, 2 * hScale, 0, 0, Math.PI * 2)
  ctx.fill()

  // legs
  ctx.strokeStyle = '#1a1a2e'
  ctx.lineWidth = 1.5 * hScale
  ctx.beginPath()
  ctx.moveTo(x - 2 * hScale, y + 3 * hScale)
  ctx.lineTo(x - 2.5 * hScale, y + 9 * hScale)
  ctx.moveTo(x + 2 * hScale, y + 3 * hScale)
  ctx.lineTo(x + 2.5 * hScale, y + 9 * hScale)
  ctx.stroke()

  // body (jersey)
  ctx.fillStyle = jerseyColor
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.ellipse(x, y, 5 * hScale, 6 * hScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // jersey detail (sleeves)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.ellipse(x - 4 * hScale, y - 1 * hScale, 2.5 * hScale, 4 * hScale, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + 4 * hScale, y - 1 * hScale, 2.5 * hScale, 4 * hScale, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // shorts
  ctx.fillStyle = '#1a1a2e'
  ctx.beginPath()
  ctx.rect(x - 3.5 * hScale, y + 4 * hScale, 7 * hScale, 3 * hScale)
  ctx.fill()

  // head
  ctx.beginPath()
  ctx.arc(x, y - 7 * hScale, 3.5 * hScale, 0, Math.PI * 2)
  ctx.fillStyle = '#f5d6a8'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // hair
  ctx.fillStyle = isHighlight ? '#eab308' : '#2d1b0e'
  ctx.beginPath()
  ctx.arc(x, y - 8.5 * hScale, 3 * hScale, Math.PI, 0)
  ctx.fill()

  // label (number or initial)
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
// PLAYER POSITIONS (keyframes)
// ---------------------------------------------------------------------------
function getPlayerPositions(w, h, t, totalDur) {
  const prog = clamp(t / totalDur, 0, 1)
  const cx = w / 2
  const cy = h / 2

  // attacking team: top → bottom
  // defending team: bottom → top

  const atkDef = [
    { x: [cx - 40, cx - 35, cx - 30, cx - 30], y: [cy - 100, cy - 95, cy - 90, cy - 85] },
    { x: [cx + 40, cx + 35, cx + 30, cx + 30], y: [cy - 100, cy - 95, cy - 90, cy - 85] },
    { x: [cx - 70, cx - 60, cx - 50, cx - 40], y: [cy - 80, cy - 80, cy - 75, cy - 70] },
    { x: [cx + 70, cx + 60, cx + 50, cx + 40], y: [cy - 80, cy - 80, cy - 75, cy - 70] },
  ]
  const atkMid = [
    { x: [cx - 20, cx - 25, cx - 30, cx - 20], y: [cy - 50, cy - 40, cy - 30, cy - 20] },
    { x: [cx, cx, cx, cx], y: [cy - 40, cy - 30, cy - 20, cy - 10] },
    { x: [cx + 20, cx + 25, cx + 30, cx + 20], y: [cy - 50, cy - 40, cy - 30, cy - 20] },
  ]
  const atkFwd = [
    { x: [cx - 30, cx - 25, cx - 15, cx - 10], y: [cy + 10, cy + 25, cy + 40, cy + 50] },
    { x: [cx, cx - 5, cx - 5, cx], y: [cy + 10, cy + 30, cy + 45, cy + 55] },
    { x: [cx + 30, cx + 25, cx + 15, cx + 10], y: [cy + 10, cy + 25, cy + 40, cy + 50] },
  ]

  const defDef = [
    { x: [cx - 35, cx - 30, cx - 25, cx - 20], y: [cy + 100, cy + 95, cy + 90, cy + 85] },
    { x: [cx + 35, cx + 30, cx + 25, cx + 20], y: [cy + 100, cy + 95, cy + 90, cy + 85] },
    { x: [cx - 60, cx - 50, cx - 40, cx - 30], y: [cy + 80, cy + 75, cy + 70, cy + 65] },
    { x: [cx + 60, cx + 50, cx + 40, cx + 30], y: [cy + 80, cy + 75, cy + 70, cy + 65] },
  ]
  const defMid = [
    { x: [cx - 15, cx - 10, cx - 5, cx], y: [cy + 50, cy + 40, cy + 30, cy + 20] },
    { x: [cx, cx + 5, cx + 10, cx + 10], y: [cy + 45, cy + 35, cy + 25, cy + 15] },
    { x: [cx + 15, cx + 10, cx + 5, cx], y: [cy + 50, cy + 40, cy + 30, cy + 20] },
  ]
  const defFwd = [
    { x: [cx - 20, cx - 15, cx - 10, cx - 5], y: [cy - 10, cy - 20, cy - 30, cy - 35] },
    { x: [cx + 20, cx + 15, cx + 10, cx + 5], y: [cy - 10, cy - 20, cy - 30, cy - 35] },
  ]

  function interp(kf) {
    const idx = prog < 0.33 ? 0 : prog < 0.66 ? 1 : 2
    const frac = prog < 0.33 ? prog / 0.33 : prog < 0.66 ? (prog - 0.33) / 0.33 : (prog - 0.66) / 0.34
    const xi = lerp(kf.x[idx], kf.x[idx + 1], frac)
    const yi = lerp(kf.y[idx], kf.y[idx + 1], frac)
    return { x: xi, y: yi }
  }

  const players = []

  for (const kf of atkDef) players.push({ ...interp(kf), color: '#3b82f6', isHome: true })
  for (const kf of atkMid) players.push({ ...interp(kf), color: '#3b82f6', isHome: true })
  for (const kf of atkFwd) players.push({ ...interp(kf), color: '#3b82f6', isHome: true })

  for (const kf of defDef) players.push({ ...interp(kf), color: '#ef4444', isHome: false })
  for (const kf of defMid) players.push({ ...interp(kf), color: '#ef4444', isHome: false })
  for (const kf of defFwd) players.push({ ...interp(kf), color: '#ef4444', isHome: false })

  return players
}

// ---------------------------------------------------------------------------
// BALL POSITION
// ---------------------------------------------------------------------------
function getBallPos(t, totalDur, w, h) {
  const prog = clamp(t / totalDur, 0, 1)
  const cx = w / 2
  const cy = h / 2

  // ball arcs from midfield towards the penalty area
  const startX = cx, startY = cy - 30
  const midX = cx - 30 + Math.sin(t * 2.5) * 15, midY = cy + 5
  const crossX = cx + 20 + Math.sin(t * 3) * 10, crossY = cy + 35
  const endX = cx + Math.sin(t * 4) * 8, endY = cy + 58

  let bx, by
  if (prog < 0.3) {
    const p = prog / 0.3
    bx = lerp(startX, midX, p)
    by = lerp(startY, midY, p) + Math.sin(t * 3) * 6
  } else if (prog < 0.6) {
    const p = (prog - 0.3) / 0.3
    bx = lerp(midX, crossX, p) + Math.sin(t * 2) * 8
    by = lerp(midY, crossY, p)
  } else {
    const p = (prog - 0.6) / 0.4
    bx = lerp(crossX, endX, p)
    by = lerp(crossY, endY, p) - Math.sin(t * 5) * 3
  }

  return { x: bx, y: by }
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

  const players = getPlayerPositions(w, h, t, totalDur)

  let elapsed = 0
  let lineIdx = 0
  for (let i = 0; i < script.length; i++) {
    if (t >= elapsed && t < elapsed + script[i].dur) { lineIdx = i; break }
    elapsed += script[i].dur
    lineIdx = i + 1
  }
  lineIdx = Math.min(lineIdx, script.length - 1)
  scriptLineRef.current = lineIdx

  for (const p of players) {
    if (!p) continue
    drawPlayer(ctx, p.x, p.y, p.color, false)
  }

  const ball = getBallPos(t, totalDur, w, h)

  // ball
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // ball pentagons
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t
    ctx.beginPath()
    ctx.arc(ball.x + Math.cos(a) * 1.5, ball.y + Math.sin(a) * 1.5, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#222'
    ctx.fill()
  }
  ctx.restore()

  // text narration on canvas
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#10b981'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const text = script[lineIdx]?.text || ''
  ctx.fillText(text, w / 2, h - 10)
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
// GOAL / PENALTY
// ---------------------------------------------------------------------------
function drawGoal(ctx, w, h, phase, resultado, selectedGoal) {
  ctx.fillStyle = '#0a3d1a'
  ctx.fillRect(0, 0, w, h)

  const gkLeft = 60
  const gkRight = w - 60
  const gkTop = 20
  const gkBottom = gkTop + 140

  ctx.fillStyle = '#1a6b30'
  ctx.fillRect(gkLeft - 5, gkTop - 10, gkRight - gkLeft + 10, gkBottom - gkTop + 15)

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(gkLeft, gkBottom)
  ctx.lineTo(gkLeft, gkTop)
  ctx.lineTo(gkRight, gkTop)
  ctx.lineTo(gkRight, gkBottom)
  ctx.stroke()

  ctx.strokeStyle = '#ffffff15'
  ctx.lineWidth = 0.5
  for (let x = gkLeft; x <= gkRight; x += 18) {
    ctx.beginPath()
    ctx.moveTo(x, gkTop)
    ctx.lineTo(x, gkBottom)
    ctx.stroke()
  }
  for (let y = gkTop; y <= gkBottom; y += 14) {
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

  if (phase === 'penalty') {
    const now = Date.now()
    for (const z of zones) {
      const pulseR = 18 + Math.sin(now / 400 + z.id) * 4
      const alpha = 0.06 + Math.sin(now / 500 + z.id * 0.7) * 0.04

      ctx.beginPath()
      ctx.arc(z.rx, z.ry, pulseR, 0, Math.PI * 2)
      ctx.fillStyle = selectedGoal === z.id ? 'rgba(255,255,255,0.25)' : `rgba(255,255,255,${alpha})`
      ctx.fill()
      ctx.strokeStyle = selectedGoal === z.id ? '#ffffff' : 'rgba(255,255,255,0.3)'
      ctx.lineWidth = selectedGoal === z.id ? 3 : 1.5
      ctx.stroke()

      if (!selectedGoal) {
        ctx.beginPath()
        ctx.arc(z.rx, z.ry, pulseR + 3, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`
        ctx.lineWidth = 4
        ctx.stroke()
      }

      ctx.fillStyle = selectedGoal === z.id ? '#ffffff' : 'rgba(255,255,255,0.5)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(z.label, z.rx, z.ry)
    }

    const gkX = (gkLeft + gkRight) / 2
    const gkY = gkBottom - 15
    ctx.beginPath()
    ctx.arc(gkX, gkY, 12, 0, Math.PI * 2)
    ctx.fillStyle = '#eab308'
    ctx.fill()
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#ffffff60'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ARQ', gkX, gkY)

    if (!selectedGoal) {
      ctx.save()
      ctx.globalAlpha = 0.15 + Math.sin(now / 600) * 0.1
      ctx.fillStyle = '#ffffff'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('~ tocá el arco ~', (gkLeft + gkRight) / 2, h - 5)
      ctx.restore()
    }
  }

  if (phase === 'result' && resultado) {
    const ballZones = {}
    for (const z of zones) {
      ballZones[z.id] = { x: z.rx, y: z.ry }
    }

    const atkZone = ballZones[resultado.posicion_atacante]
    const defZone = ballZones[resultado.posicion_arquero]

    if (atkZone) {
      ctx.beginPath()
      ctx.moveTo(w / 2, h + 10)
      ctx.quadraticCurveTo(w / 2, h * 0.35, atkZone.x, atkZone.y)
      ctx.strokeStyle = resultado.es_gol ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.beginPath()
      ctx.arc(atkZone.x, atkZone.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = resultado.es_gol ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()

      if (resultado.es_gol) {
        ctx.strokeStyle = '#22c55e60'
        ctx.lineWidth = 3
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Date.now() / 500
          ctx.beginPath()
          ctx.moveTo(atkZone.x, atkZone.y)
          ctx.lineTo(atkZone.x + Math.cos(a) * 18, atkZone.y + Math.sin(a) * 18)
          ctx.stroke()
        }
      }
    }

    if (defZone) {
      const gkX = (gkLeft + gkRight) / 2
      const gkY = gkBottom - 15
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(gkX, gkY)
      ctx.lineTo(defZone.x, defZone.y)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(defZone.x, defZone.y, 10, 0, Math.PI * 2)
      ctx.fillStyle = '#eab30840'
      ctx.fill()
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🧤', defZone.x, defZone.y)
    }
  }
}
