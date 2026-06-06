import { useRef, useEffect, useState, useCallback } from 'react'

const GOAL_ZONES = [
  { id: 1, label: 'SI',  x: 0.25, y: 0.15 },
  { id: 2, label: 'SD',  x: 0.75, y: 0.15 },
  { id: 3, label: 'C',   x: 0.50, y: 0.35 },
  { id: 4, label: 'II',  x: 0.25, y: 0.70 },
  { id: 5, label: 'ID',  x: 0.75, y: 0.70 },
]

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

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
  return lines[(ronda - 1) % lines.length].map(t => ({ text: t, dur: 2.5 }))
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
    const gkBottom = (20 + 120) / 300
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

function drawWaiting(ctx, w, h) {
  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff20'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Esperando...', w / 2, h / 2)
}

function drawNarration(ctx, w, h, animRef, scriptRef, scriptStartRef, scriptLineRef) {
  const t = (Date.now() - scriptStartRef.current) / 1000
  const script = scriptRef.current

  if (!script) return

  ctx.fillStyle = '#1a5730'
  ctx.fillRect(0, 0, w, h)

  drawPitch(ctx, w, h)

  const totalDur = script.reduce((s, l) => s + l.dur, 0)

  const homePlayers = generateNarrationPlayers(w, h, true, t, totalDur)
  const awayPlayers = generateNarrationPlayers(w, h, false, t, totalDur)

  for (const p of homePlayers) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  for (const p of awayPlayers) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  let elapsed = 0
  let lineIdx = 0
  for (let i = 0; i < script.length; i++) {
    if (t >= elapsed && t < elapsed + script[i].dur) {
      lineIdx = i
      break
    }
    elapsed += script[i].dur
    lineIdx = i + 1
  }
  if (lineIdx >= script.length) lineIdx = script.length - 1

  const ballX = getBallNarrationX(t, totalDur, w)
  const ballY = getBallNarrationY(t, totalDur, h)

  ctx.beginPath()
  ctx.arc(ballX, ballY, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.stroke()

  const currentLine = Math.min(lineIdx, script.length - 1)
  scriptLineRef.current = currentLine

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#10b981'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const text = script[currentLine]?.text || ''
  ctx.fillText(text, w / 2, h - 8)
  ctx.restore()

  animRef.current = requestAnimationFrame(() => {
    drawNarration(ctx, w, h, animRef, scriptRef, scriptStartRef, scriptLineRef)
  })
}

function drawPitch(ctx, w, h) {
  ctx.strokeStyle = '#ffffff30'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w / 2, 10)
  ctx.lineTo(w / 2, h - 10)
  ctx.stroke()
  ctx.strokeRect(w / 2 - 55, 10, 110, 45)
  ctx.strokeRect(w / 2 - 55, h - 55, 110, 45)

  ctx.fillStyle = '#ffffff08'
  ctx.fillRect(w / 2 - 2, 10, 4, h - 20)
}

function generateNarrationPlayers(w, h, isHome, t, totalDur) {
  const players = []
  const progress = Math.min(t / totalDur, 1)

  const baseGo = { x: w * (isHome ? 0.25 : 0.75), y: h * 0.5 }
  const attGo = { x: w * (isHome ? 0.7 : 0.3), y: h * 0.45 }

  const defLine = [
    { x: pulse(t, 0, 10), y: h * 0.22 },
    { x: pulse(t, 1, 8), y: h * 0.26 },
    { x: pulse(t, 2, 12), y: h * 0.24 },
    { x: pulse(t, 3, 9), y: h * 0.28 },
  ]
  for (const d of defLine) {
    players.push({
      x: lerp(baseGo.x + d.x * 0.1, attGo.x + d.x * 0.05, progress),
      y: lerp(baseGo.y + d.y * 0.1 - h * 0.15, attGo.y + d.y * 0.05, progress),
    })
  }

  const midLine = [
    { x: pulse(t, 0.5, 15), y: h * 0.4 },
    { x: pulse(t, 1.5, 12), y: h * 0.5 },
    { x: pulse(t, 2.5, 14), y: h * 0.6 },
  ]
  for (const m of midLine) {
    players.push({
      x: lerp(baseGo.x + m.x * 0.1, attGo.x + m.x * 0.1, progress),
      y: lerp(baseGo.y + m.y * 0.1 - h * 0.1, attGo.y + m.y * 0.05, progress),
    })
  }

  const fwdLine = [
    { x: pulse(t, 0.7, 18), y: h * 0.65 },
    { x: pulse(t, 1.7, 14), y: h * 0.72 },
    { x: pulse(t, 2.7, 16), y: h * 0.60 },
  ]
  for (const f of fwdLine) {
    players.push({
      x: lerp(baseGo.x + f.x * 0.15, attGo.x + f.x * 0.1, progress),
      y: lerp(baseGo.y + f.y * 0.1 - h * 0.05, attGo.y + f.y * 0.1, progress),
    })
  }

  return players
}

function getBallNarrationX(t, total, w) {
  const prog = Math.min(t / total, 1)
  const start = w * 0.3
  const mid = w * 0.6 + Math.sin(t * 2) * 20
  const end = w * 0.5 + Math.sin(t * 3) * 10
  if (prog < 0.4) return w * 0.3 + (w * 0.6 - w * 0.3) * (prog / 0.4) + Math.sin(t * 2) * 10
  if (prog < 0.7) return w * 0.6 + Math.sin(t * 2) * 15
  return w * 0.6 - (w * 0.6 - w * 0.5) * ((prog - 0.7) / 0.3) + Math.sin(t * 3) * 8
}

function getBallNarrationY(t, total, h) {
  const prog = Math.min(t / total, 1)
  if (prog < 0.4) return h * 0.5 + Math.cos(t * 1.5) * 8
  if (prog < 0.7) return h * 0.4 + Math.sin(t * 2) * 10 - (prog - 0.4) / 0.3 * (h * 0.15)
  return h * 0.25 + Math.sin(t * 4) * 5
}

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

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1)
}

function pulse(t, phase, amp) {
  return Math.sin(t * 1.2 + phase) * amp
}
