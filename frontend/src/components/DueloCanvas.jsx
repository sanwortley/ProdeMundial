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
// SCENE-AWARE PLAYER POSITIONS
// ---------------------------------------------------------------------------
function getPlayerPositions(w, h, t, totalDur, lineIdx) {
  const cx = w / 2
  const cy = h / 2
  const lineStart = lineIdx * 2.5
  const progLine = clamp((t - lineStart) / 2.5, 0, 1)

  // overall advancement: 0 → 1 during the 10s
  const overall = clamp(t / totalDur, 0, 1)

  // Base formation: 4-3-3 attacking (blue) vs 4-3-2 defending (red)
  // positions y advance as overall increases

  function pos(startX, startY, endX, endY) {
    return {
      x: lerp(startX, endX, overall) + Math.sin(t * 1.1 + startX * 0.1) * 4,
      y: lerp(startY, endY, overall) + Math.cos(t * 0.9 + startY * 0.1) * 3,
    }
  }

  const baseAtkY = cy - 80
  const baseDefY = cy + 80

  // Attackers (blue) — move from top to bottom
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

  // Defenders (red) — move from bottom to top
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

  // --- Scene-specific adjustments ---
  let highlightIdx = -1
  let offsetPlayers = []

  if (lineIdx === 0) {
    // "X toca para Y" — two players close, ball passes between them
    const passerIdx = 4  // central midfielder
    const recvIdx = 7    // left forward
    highlightIdx = 7

    const dist = 15 * Math.sin(progLine * Math.PI)
    offsetPlayers = [
      { idx: 4, dx: -dist * 0.5, dy: 0 },
      { idx: 7, dx: dist * 0.5, dy: 0 },
    ]
  }

  else if (lineIdx === 1) {
    // "Z levanta y ve" — playmaker looks, runners go
    highlightIdx = 5 // central mid playmaker
    offsetPlayers = [
      { idx: 5, dx: 0, dy: -3 * Math.sin(progLine * Math.PI) },
      { idx: 7, dx: 0, dy: -8 * progLine },
      { idx: 9, dx: 0, dy: -8 * progLine },
    ]
  }

  else if (lineIdx === 2) {
    // "W mete un centro" — winger goes wide, crosses
    highlightIdx = 8 // right winger
    const widePush = 20 * progLine
    offsetPlayers = [
      { idx: 8, dx: widePush, dy: -5 * progLine },
      { idx: 7, dx: -5, dy: -10 * progLine },
      { idx: 9, dx: 5, dy: -10 * progLine },
      { idx: 0, dx: 0, dy: -5 * progLine },
      { idx: 3, dx: 0, dy: -5 * progLine },
    ]
  }

  else if (lineIdx === 3) {
    // "P cabecea!" — header moment
    highlightIdx = 9 // central forward (shooter)
    const jumpY = -12 * Math.sin(progLine * Math.PI)
    offsetPlayers = [
      { idx: 9, dx: 0, dy: jumpY },
      { idx: 7, dx: -3, dy: -5 * progLine },
      { idx: 8, dx: 3, dy: -5 * progLine },
    ]
  }

  const allPos = [...atkDef, ...atkMid, ...atkFwd, ...defDef, ...defMid, ...defFwd]

  // apply offsets
  for (const o of offsetPlayers) {
    if (allPos[o.idx]) {
      allPos[o.idx].x += o.dx
      allPos[o.idx].y += o.dy
    }
  }

  return allPos.map((p, i) => ({
    x: clamp(p.x, 15, w - 15),
    y: clamp(p.y, 15, h - 15),
    color: i < 10 ? '#3b82f6' : '#ef4444',
    isHome: i < 10,
    isHighlight: i === (highlightIdx + (i < 10 ? 0 : 0)),
  }))
}

// ---------------------------------------------------------------------------
// SCENE-AWARE BALL POSITION
// ---------------------------------------------------------------------------
function getBallPos(t, totalDur, w, h, lineIdx) {
  const cx = w / 2
  const cy = h / 2
  const lineStart = lineIdx * 2.5
  const prog = clamp((t - lineStart) / 2.5, 0, 1)

  const s = (a, b, p) => lerp(a, b, p)

  if (lineIdx === 0) {
    // pass from midfielder to forward
    const x1 = cx - 10, y1 = cy - 25
    const x2 = cx - 20, y2 = cy + 5
    return {
      x: s(x1, x2, prog) + Math.sin(t * 3) * 2,
      y: s(y1, y2, prog) + Math.cos(t * 2) * 2,
    }
  }

  if (lineIdx === 1) {
    // ball at playmaker's feet, slight movement
    return {
      x: cx + 5 + Math.sin(t * 1.5) * 5,
      y: cy + Math.sin(t * 1.8) * 4,
    }
  }

  if (lineIdx === 2) {
    // cross: ball arcs from right flank to the box
    const sx = cx + 40, sy = cy - 10
    const mx = cx + 25, my = cy + 15
    const ex = cx + 5, ey = cy + 40
    const p = prog
    return {
      x: sx + (mx - sx) * p + (ex - mx) * p * p,
      y: sy + (my - sy) * p + (ey - my) * p * p - Math.sin(p * Math.PI) * 12,
    }
  }

  if (lineIdx === 3) {
    // ball at penalty spot, header moment
    const bounce = Math.sin(prog * Math.PI * 2) * Math.max(1 - prog, 0) * 3
    return {
      x: cx + Math.sin(t * 2) * 2,
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

  const players = getPlayerPositions(w, h, t, totalDur, lineIdx)

  for (const p of players) {
    if (!p) continue
    drawPlayer(ctx, p.x, p.y, p.color, p.isHighlight)
  }

  const ball = getBallPos(t, totalDur, w, h, lineIdx)

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
