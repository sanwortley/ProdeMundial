import { Shield, ShieldCheck } from 'lucide-react'

const FORMATION_POSITIONS = {
  '4-3-3': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'LB',  label: 'LB',  x: 12, y: 100 },
    { id: 'CB',  label: 'CB',  x: 33, y: 102 },
    { id: 'CB',  label: 'CB',  x: 67, y: 102 },
    { id: 'RB',  label: 'RB',  x: 88, y: 100 },
    { id: 'CM',  label: 'CM',  x: 28, y: 74 },
    { id: 'CM',  label: 'CM',  x: 50, y: 70 },
    { id: 'CM',  label: 'CM',  x: 72, y: 74 },
    { id: 'LW',  label: 'LW',  x: 12, y: 48 },
    { id: 'ST',  label: 'ST',  x: 50, y: 34 },
    { id: 'RW',  label: 'RW',  x: 88, y: 48 },
  ],
  '4-4-2': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'LB',  label: 'LB',  x: 12, y: 102 },
    { id: 'CB',  label: 'CB',  x: 33, y: 104 },
    { id: 'CB',  label: 'CB',  x: 67, y: 104 },
    { id: 'RB',  label: 'RB',  x: 88, y: 102 },
    { id: 'LM',  label: 'LM',  x: 8, y: 74 },
    { id: 'CM',  label: 'CM',  x: 35, y: 72 },
    { id: 'CM',  label: 'CM',  x: 65, y: 72 },
    { id: 'RM',  label: 'RM',  x: 92, y: 74 },
    { id: 'ST',  label: 'ST',  x: 35, y: 34 },
    { id: 'ST',  label: 'ST',  x: 65, y: 34 },
  ],
  '3-5-2': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'CB',  label: 'CB',  x: 20, y: 104 },
    { id: 'CB',  label: 'CB',  x: 50, y: 106 },
    { id: 'CB',  label: 'CB',  x: 80, y: 104 },
    { id: 'LM',  label: 'LM',  x: 6, y: 76 },
    { id: 'CM',  label: 'CM',  x: 30, y: 72 },
    { id: 'CM',  label: 'CM',  x: 50, y: 68 },
    { id: 'CM',  label: 'CM',  x: 70, y: 72 },
    { id: 'RM',  label: 'RM',  x: 94, y: 76 },
    { id: 'ST',  label: 'ST',  x: 35, y: 34 },
    { id: 'ST',  label: 'ST',  x: 65, y: 34 },
  ],
  '4-2-3-1': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'LB',  label: 'LB',  x: 12, y: 102 },
    { id: 'CB',  label: 'CB',  x: 33, y: 104 },
    { id: 'CB',  label: 'CB',  x: 67, y: 104 },
    { id: 'RB',  label: 'RB',  x: 88, y: 102 },
    { id: 'CDM', label: 'CDM', x: 35, y: 82 },
    { id: 'CDM', label: 'CDM', x: 65, y: 82 },
    { id: 'LW',  label: 'LW',  x: 8, y: 56 },
    { id: 'CAM', label: 'CAM', x: 50, y: 58 },
    { id: 'RW',  label: 'RW',  x: 92, y: 56 },
    { id: 'ST',  label: 'ST',  x: 50, y: 32 },
  ],
  '5-3-2': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'LB',  label: 'LB',  x: 8, y: 104 },
    { id: 'CB',  label: 'CB',  x: 25, y: 108 },
    { id: 'CB',  label: 'CB',  x: 50, y: 110 },
    { id: 'CB',  label: 'CB',  x: 75, y: 108 },
    { id: 'RB',  label: 'RB',  x: 92, y: 104 },
    { id: 'CM',  label: 'CM',  x: 25, y: 76 },
    { id: 'CM',  label: 'CM',  x: 50, y: 72 },
    { id: 'CM',  label: 'CM',  x: 75, y: 76 },
    { id: 'ST',  label: 'ST',  x: 35, y: 34 },
    { id: 'ST',  label: 'ST',  x: 65, y: 34 },
  ],
  '3-4-3': [
    { id: 'GK',  label: 'GK',  x: 50, y: 126 },
    { id: 'CB',  label: 'CB',  x: 20, y: 104 },
    { id: 'CB',  label: 'CB',  x: 50, y: 106 },
    { id: 'CB',  label: 'CB',  x: 80, y: 104 },
    { id: 'LM',  label: 'LM',  x: 8, y: 74 },
    { id: 'CM',  label: 'CM',  x: 38, y: 72 },
    { id: 'CM',  label: 'CM',  x: 62, y: 72 },
    { id: 'RM',  label: 'RM',  x: 92, y: 74 },
    { id: 'LW',  label: 'LW',  x: 10, y: 46 },
    { id: 'ST',  label: 'ST',  x: 50, y: 32 },
    { id: 'RW',  label: 'RW',  x: 90, y: 46 },
  ],
}

export default function Pitch({ formation = '4-3-3', players = [], onSlotClick, compact = false, selectedSlotId }) {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3']

  // Match players to slot positions by orden (slot index), not by posicion_cancha
  // This correctly handles duplicate IDs like 2 CBs or 2 STs
  const playerBySlot = {}
  players.forEach((p) => {
    if (p.orden !== undefined && p.orden !== null) {
      playerBySlot[p.orden] = p
    }
  })

  const viewBox = compact ? '0 0 100 120' : '0 0 100 140'

  return (
    <svg viewBox={viewBox} className="w-full h-auto rounded-2xl shadow-2xl" xmlns="http://www.w3.org/2000/svg">
      {/* Field background */}
      <rect x="2" y="2" width="96" height={compact ? 116 : 136} rx="4" fill="#2d7d46" stroke="#fff" strokeWidth="0.8" />

      {/* Field pattern (alternating stripes) */}
      {Array.from({ length: compact ? 6 : 7 }).map((_, i) => (
        <rect key={i} x="2" y={2 + i * (compact ? 19 : 20)} width="96" height={compact ? 9.5 : 10}
          fill={i % 2 === 0 ? '#2d7d46' : '#3a8d52'} opacity="0.3" />
      ))}

      {/* Center line */}
      <line x1="2" y1={compact ? 60 : 70} x2="98" y2={compact ? 60 : 70} stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Center circle */}
      <circle cx="50" cy={compact ? 60 : 70} r="8" fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Center dot */}
      <circle cx="50" cy={compact ? 60 : 70} r="0.8" fill="#fff" opacity="0.8" />

      {/* Penalty area top */}
      <rect x="20" y="2" width="60" height={compact ? 12 : 14} fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Goal area top */}
      <rect x="30" y="2" width="40" height={compact ? 5 : 6} fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Penalty area bottom */}
      <rect x="20" y={compact ? 106 : 124} width="60" height={compact ? 12 : 14} fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Goal area bottom */}
      <rect x="30" y={compact ? 113 : 132} width="40" height={compact ? 5 : 6} fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.8" />

      {/* Goals */}
      <rect x="36" y="0" width="28" height="2" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
      <rect x="36" y={compact ? 118 : 138} width="28" height="2" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" />

      {/* Penalty dots */}
      <circle cx="50" cy={compact ? 12 : 14} r="0.6" fill="#fff" opacity="0.6" />
      <circle cx="50" cy={compact ? 108 : 126} r="0.6" fill="#fff" opacity="0.6" />

      {/* Penalty arcs */}
      <path d={`M 38 ${compact ? 16 : 19} Q 50 ${compact ? 22 : 26} 62 ${compact ? 16 : 19}`} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
      <path d={`M 38 ${compact ? 104 : 121} Q 50 ${compact ? 98 : 114} 62 ${compact ? 104 : 121}`} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" />

      {/* Player slots */}
      {positions.map((slot, i) => {
        const player = playerBySlot[i]
        const px = slot.x
        const py = compact ? slot.y * 0.85 : slot.y

        return (
          <g key={i} onClick={() => onSlotClick && onSlotClick(slot, player)}
            className="cursor-pointer">
            {/* Position circle */}
            <circle cx={px} cy={py} r={compact ? 5 : 6}
              fill={selectedSlotId === slot.id ? '#065f46' : (player ? '#1e293b' : '#0f172a')}
              stroke={selectedSlotId === slot.id ? '#34d399' : (player ? '#10b981' : '#334155')}
              strokeWidth={selectedSlotId === slot.id ? 2 : (player ? 1.2 : 0.8)}
              opacity={player ? 1 : 0.6} />

            {player ? (
              <>
                <text x={px} y={py - (compact ? 0.5 : 1)} textAnchor="middle" dominantBaseline="central"
                  fill="#fff" fontSize={compact ? 2.5 : 3} fontWeight="bold">{player.nombre.split(' ').pop()}</text>
                <text x={px} y={py + (compact ? 3 : 4)} textAnchor="middle"
                  fill="#94a3b8" fontSize={compact ? 2 : 2.5}>{player.valor_inicial}M</text>
              </>
            ) : (
              <text x={px} y={py} textAnchor="middle" dominantBaseline="central"
                fill="#475569" fontSize={compact ? 2.5 : 3.5} fontWeight="bold">
                {slot.label === 'CDM' ? 'DM' : slot.label === 'CAM' ? 'AM' : slot.id}
              </text>
            )}
          </g>
        )
      })}

      {/* Formation label */}
      <text x="50" y={compact ? 114 : 134} textAnchor="middle" fill="#94a3b8" fontSize={compact ? 2.5 : 3.5} opacity="0.6">
        {formation}
      </text>
    </svg>
  )
}
