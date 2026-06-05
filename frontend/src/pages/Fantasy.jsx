import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, Search, Shield, Trophy, Swords, X, Play, Zap } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import Pitch from '../components/Pitch'
import DueloNotification from '../components/DueloNotification'

const POSITIONS_MAP = [
  { value: '', label: 'Todas' },
  { value: 'GK', label: 'Arquero' },
  { value: 'DEF', label: 'Defensor' },
  { value: 'MID', label: 'Mediocampista' },
  { value: 'FWD', label: 'Delantero' },
]

const SPECIFIC_POSITIONS_MAP = [
  { value: '', label: 'Todas' },
  { value: 'CB', label: 'Central' },
  { value: 'LB', label: 'Lateral Izq.' },
  { value: 'RB', label: 'Lateral Der.' },
  { value: 'CM', label: 'Mediocentro' },
  { value: 'CDM', label: 'Pivote' },
  { value: 'CAM', label: 'Mediapunta' },
  { value: 'LM', label: 'Interior Izq.' },
  { value: 'RM', label: 'Interior Der.' },
  { value: 'LW', label: 'Extremo Izq.' },
  { value: 'RW', label: 'Extremo Der.' },
  { value: 'ST', label: 'Delantero' },
]

const FORMATIONS = ['4-3-3']

export default function Fantasy() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const [tab, setTab] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const [team, setTeam] = useState(null)
  const [rankings, setRankings] = useState([])
  const [formation, setFormation] = useState('4-3-3')
  const [filtroPos, setFiltroPos] = useState('')
  const [filtroPosEsp, setFiltroPosEsp] = useState('')
  const [filtroEquipo, setFiltroEquipo] = useState('')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  const [budget, setBudget] = useState(300)
  const [h2hMatches, setH2hMatches] = useState([])
  const [h2hLoading, setH2hLoading] = useState(false)
  const [fechas, setFechas] = useState([])
  const [simulating, setSimulating] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [selectedSlot, setSelectedSlot] = useState(null)

  const SLOT_SPECIFIC = {
    "GK": "GK", "LB": "LB", "CB": "CB", "RB": "RB",
    "LM": "LM", "CM": "CM", "CDM": "CDM", "CAM": "CAM", "RM": "RM",
    "LW": "LW", "RW": "RW", "ST": "ST",
  }

  const SPECIFIC_LABELS = {
    "GK": "ARQ", "CB": "CB", "LB": "LI", "RB": "LD",
    "CM": "MC", "CDM": "PIV", "CAM": "MP", "LM": "MI", "RM": "MD",
    "LW": "EI", "RW": "ED", "ST": "DC",
  }

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Duelo state
  const [duelos, setDuelos] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [showDueloModal, setShowDueloModal] = useState(false)
  const [challenging, setChallenging] = useState(false)

  // Unique teams extracted from allPlayers
  const teams = useMemo(() => {
    const t = [...new Set(allPlayers.map((p) => p.equipo_nacional))]
    return t.sort()
  }, [allPlayers])

  // Filtered players (local, no API call)
  const players = useMemo(() => {
    let filtered = allPlayers
    if (filtroPos) filtered = filtered.filter((p) => p.posicion === filtroPos)
    if (filtroPosEsp) filtered = filtered.filter((p) => p.posicion_especifica === filtroPosEsp)
    if (filtroEquipo) filtered = filtered.filter((p) => p.equipo_nacional === filtroEquipo)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((p) => p.nombre.toLowerCase().includes(q))
    }
    return filtered
  }, [allPlayers, filtroPos, filtroPosEsp, filtroEquipo, search])

  useEffect(() => {
    loadTeam()
    loadAllPlayers()
    loadRanking()
    loadH2H()
    loadFechas()
    loadDuelos()
  }, [groupId])

  async function loadAllPlayers() {
    try {
      const res = await api.get('/fantasy/players')
      setAllPlayers(res.data)
    } catch (e) {
      console.error('Error loading players:', e)
    }
  }

  async function loadTeam() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/fantasy/team/${groupId}`)
      setTeam(res.data)
      setFormation(res.data.formacion || '4-4-2')
      setBudget(res.data.presupuesto_restante)
    } catch (e) {
      if (e.response?.status === 404) {
        setTeam(null)
      } else {
        setError('Error al cargar tu equipo')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadRanking() {
    try {
      const res = await api.get(`/fantasy/group/${groupId}/ranking`)
      setRankings(res.data)
    } catch (e) {
      console.error('Error loading ranking:', e)
    }
  }

  async function loadH2HMatches() {
    try {
      const res = await api.get(`/fantasy/h2h/matches/${groupId}`)
      setH2hMatches(res.data)
    } catch (e) {
      console.error('Error loading h2h:', e)
    }
  }

  async function loadH2H() {
    await loadH2HMatches()
  }

  async function loadDuelos() {
    try {
      const res = await api.get('/fantasy/duel/mis-duelos')
      setDuelos(res.data)
    } catch (e) {
      console.error('Error loading duelos:', e)
    }
  }

  async function loadDisponibles() {
    try {
      const res = await api.get(`/fantasy/duel/disponibles`, { params: { grupo_id: groupId } })
      setDisponibles(res.data)
    } catch (e) {
      console.error('Error loading disponibles:', e)
    }
  }

  async function handleChallenge(rivalId) {
    try {
      setChallenging(true)
      const res = await api.post(`/fantasy/duel/challenge/${rivalId}`, null, { params: { grupo_id: groupId } })
      setShowDueloModal(false)
      await loadDuelos()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al retar')
    } finally {
      setChallenging(false)
    }
  }

  async function handleAcceptDuelo(dueloId) {
    try {
      const res = await api.post(`/fantasy/duel/${dueloId}/accept`)
      window.location.href = `/duel/${dueloId}`
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al aceptar')
    }
  }

  async function handleRejectDuelo(dueloId) {
    try {
      await api.post(`/fantasy/duel/${dueloId}/reject`)
      await loadDuelos()
    } catch (e) {
      console.error('Error rejecting:', e)
    }
  }

  async function handleCancelDuelo(dueloId) {
    try {
      await api.post(`/fantasy/duel/${dueloId}/cancel`)
      await loadDuelos()
    } catch (e) {
      console.error('Error cancelling:', e)
    }
  }

  async function loadFechas() {
    try {
      const res = await api.get('/fantasy/fechas')
      setFechas(res.data)
    } catch (e) {
      console.error('Error loading fechas:', e)
    }
  }

  async function handleSimulate(fecha) {
    try {
      setSimulating(true)
      await api.post(`/admin/simulate-fecha/${encodeURIComponent(fecha)}`)
      await loadFechas()
      await loadTeam()
      await loadRanking()
      await loadH2H()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al simular fecha')
    } finally {
      setSimulating(false)
    }
  }

  async function handleInitH2H() {
    try {
      await api.post(`/fantasy/h2h/init/${groupId}`)
      await loadH2H()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al generar fixture')
    }
  }

  async function handleInitTeam() {
    try {
      setLoading(true)
      const res = await api.post(`/fantasy/team/init/${groupId}`, { formacion: formation })
      setTeam(res.data)
      setBudget(res.data.presupuesto_restante)
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al crear equipo')
    } finally {
      setLoading(false)
    }
  }

  async function handlePick(player, slotPos) {
    if (!team) return
    try {
      setPicking(true)
      setError(null)
      const res = await api.post('/fantasy/team/pick', {
        id_grupo: parseInt(groupId),
        fecha: team.fecha,
        id_jugador: player.id_jugador,
        posicion_cancha: slotPos || null,
      })
      setTeam(res.data)
      setBudget(res.data.presupuesto_restante)
      setSelectedSlot(null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al seleccionar jugador')
    } finally {
      setPicking(false)
    }
  }

  async function handleDrop(jugadorId) {
    if (!team) return
    try {
      setError(null)
      const res = await api.delete(`/fantasy/team/${groupId}/player/${jugadorId}`, {
        params: { fecha: team.fecha }
      })
      setTeam(res.data)
      setBudget(res.data.presupuesto_restante)
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al dropear jugador')
    }
  }

  async function handleClearTeam() {
    if (!team) return
    let currentTeam = team
    for (const j of [...currentTeam.jugadores]) {
      try {
        const res = await api.delete(`/fantasy/team/${groupId}/player/${j.id_jugador}`, {
          params: { fecha: team.fecha }
        })
        currentTeam = res.data
        setTeam(res.data)
        setBudget(res.data.presupuesto_restante)
      } catch (e) {
        break
      }
    }
  }

  async function handleChangeFormation(f) {
    setFormation(f)
    if (team) {
      try {
        const res = await api.post(`/fantasy/team/init/${groupId}`, { formacion: f })
        setTeam(res.data)
      } catch (e) {
        console.error('Error updating formation:', e)
      }
    }
  }

  // Available players (not on my team, not taken by others in the group)
  const myPlayerIds = new Set((team?.jugadores || []).map((j) => j.id_jugador))
  const takenPlayerIds = new Set(team?.jugadores_no_disponibles || [])
  let availablePlayers = players.filter((p) => !myPlayerIds.has(p.id_jugador) && !takenPlayerIds.has(p.id_jugador))
  const takenPlayers = players.filter((p) => takenPlayerIds.has(p.id_jugador))

  // Filter by specific position when a pitch slot is selected
  const targetSpecific = selectedSlot ? SLOT_SPECIFIC[selectedSlot.id] : null
  if (targetSpecific) {
    availablePlayers = availablePlayers.filter((p) => p.posicion_especifica === targetSpecific)
  }

  const tabs = [
    { id: 'draft', label: 'Armar', icon: Shield },
    { id: 'team', label: 'Mi Equipo', icon: Users },
    { id: 'h2h', label: 'Partidos', icon: Swords },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
  ]

  if (loading && !team) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm">Cargando fantasy...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to={`/groups/${groupId}`} className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100">Fantasy</h1>
          <p className="text-[11px] text-slate-500 font-semibold">Armá tu equipo ideal por fecha</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all flex-1 justify-center ${
              tab === t.id ? 'bg-soccer-green text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}>
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Draft */}
      {tab === 'draft' && (
        <><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Player list */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="glass-card rounded-2xl p-4 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Search className="w-3.5 h-3.5" /> Jugadores disponibles
              </h3>

              {/* Filters */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex gap-2">
                  <select value={filtroPos} onChange={(e) => setFiltroPos(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 flex-1">
                    {POSITIONS_MAP.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <select value={filtroPosEsp} onChange={(e) => setFiltroPosEsp(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 flex-1">
                    {SPECIFIC_POSITIONS_MAP.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <select value={filtroEquipo} onChange={(e) => setFiltroEquipo(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 flex-[2] truncate">
                    <option value="">Todos los equipos</option>
                    {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <input placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 w-full" />
              </div>

              {/* Budget bar */}
              {team && (
                <div className="bg-slate-800/50 rounded-xl p-3 mb-3">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-400">Presupuesto</span>
                    <span className={budget < 20 ? 'text-red-400' : 'text-soccer-green'}>${budget}M</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-soccer-green to-emerald-400 rounded-full transition-all"
                      style={{ width: `${(budget / 300) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{team.jugadores.length}/11 jugadores</div>
                </div>
              )}

                {/* Player list */}
              {selectedSlot && (
                <div className="flex items-center gap-2 mb-2 bg-soccer-green/10 border border-soccer-green/20 rounded-xl px-3 py-2">
                  <span className="text-[10px] font-bold text-soccer-green flex-1">
                    Elegí un jugador para <strong>{selectedSlot.id}</strong>
                  </span>
                  <button onClick={() => setSelectedSlot(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 font-bold">X</button>
                </div>
              )}
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                <div className="text-[10px] text-slate-500 font-semibold mb-1">
                  {availablePlayers.length} disponibles {takenPlayers.length > 0 ? `· ${takenPlayers.length} no disponibles` : ''}
                </div>
                {availablePlayers.map((p) => (
                  <div key={p.id_jugador}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      team ? 'hover:bg-slate-700/50 cursor-pointer' : 'opacity-50'
                    }`}
                    onClick={() => team && handlePick(p, targetSpecific ? selectedSlot.id : null)}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-200 truncate">{p.nombre}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{p.equipo_nacional}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.posicion === 'GK' ? 'bg-yellow-500/20 text-yellow-400' :
                          p.posicion === 'DEF' ? 'bg-blue-500/20 text-blue-400' :
                          p.posicion === 'MID' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{p.posicion}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.posicion_especifica === 'GK' ? 'bg-yellow-500/10 text-yellow-300' :
                          p.posicion_especifica === 'CB' || p.posicion_especifica === 'LB' || p.posicion_especifica === 'RB' ? 'bg-blue-500/10 text-blue-300' :
                          p.posicion_especifica === 'CM' || p.posicion_especifica === 'CDM' || p.posicion_especifica === 'CAM' || p.posicion_especifica === 'LM' || p.posicion_especifica === 'RM' ? 'bg-purple-500/10 text-purple-300' :
                          'bg-red-500/10 text-red-300'
                        }`}>{SPECIFIC_LABELS[p.posicion_especifica] || p.posicion_especifica}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-300">${p.valor_inicial}M</div>
                      {team && budget >= p.valor_inicial && (
                        <div className="text-[10px] text-soccer-green">+ Agregar</div>
                      )}
                      {team && budget < p.valor_inicial && (
                        <div className="text-[10px] text-red-400">Sin fondo</div>
                      )}
                    </div>
                  </div>
                ))}
                {takenPlayers.length > 0 && (
                  <div className="border-t border-slate-800 pt-2 mt-2">
                    {takenPlayers.map((p) => (
                      <div key={p.id_jugador}
                        className="flex items-center justify-between p-2 rounded-xl opacity-40">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-400 truncate">{p.nombre}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-600">
                            <span>{p.equipo_nacional}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              p.posicion === 'GK' ? 'bg-yellow-500/20 text-yellow-400' :
                              p.posicion === 'DEF' ? 'bg-blue-500/20 text-blue-400' :
                              p.posicion === 'MID' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>{p.posicion}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-red-400 font-semibold">No disponible</div>
                      </div>
                    ))}
                  </div>
                )}
                {availablePlayers.length === 0 && takenPlayers.length === 0 && (
                  <div className="text-center text-slate-500 text-xs py-4">No hay jugadores disponibles</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Pitch + formation */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            {!team ? (
              <div className="glass-card rounded-2xl p-6 border border-slate-800 text-center">
                <Shield className="w-12 h-12 text-soccer-green mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-100 mb-2">Armá tu equipo para esta fecha</h3>
                <p className="text-sm text-slate-400 mb-4">Formación <strong className="text-slate-200">4-3-3</strong>. Empezá a armar tu equipo ideal.</p>
                <button onClick={handleInitTeam}
                  className="bg-gradient-green text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all">
                  Crear equipo
                </button>
              </div>
            ) : (
              <>
                {/* Status + Save bar */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fecha:</span>
                    <span className="text-sm font-bold text-soccer-green">{team.fecha}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      team.jugadores.length === 11
                        ? 'bg-soccer-green/20 text-soccer-green'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {team.jugadores.length === 11 ? 'Completo' : `${11 - team.jugadores.length} libres`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-300">${budget}M</span>
                    {team.jugadores.length === 11 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-soccer-green bg-soccer-green/10 px-2 py-1 rounded-lg">
                        <Shield className="w-3 h-3" /> Guardado
                      </span>
                    )}
                  </div>
                </div>

                {/* Pitch */}
                <Pitch formation={formation} players={team.jugadores} compact={isMobile}
                  selectedSlotId={selectedSlot?.id}
                  onSlotClick={(slot) => {
                    if (selectedSlot?.id === slot.id) {
                      setSelectedSlot(null)
                    } else {
                      setSelectedSlot(slot)
                    }
                  }} />

                {/* Current squad summary */}
                <div className="glass-card rounded-2xl p-4 border border-slate-800 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tu plantel ({team.jugadores.length}/11)</h4>
                    {team.jugadores.length > 0 && (
                      <button onClick={handleClearTeam}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300">
                        Vaciar equipo
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {team.jugadores.map((j) => (
                      <div key={j.id} className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-2 py-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          j.posicion === 'GK' ? 'bg-yellow-500/20 text-yellow-400' :
                          j.posicion === 'DEF' ? 'bg-blue-500/20 text-blue-400' :
                          j.posicion === 'MID' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{SPECIFIC_LABELS[j.posicion_especifica] || j.posicion_especifica || j.posicion}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-200 truncate">{j.nombre}</div>
                          <div className="text-[10px] text-slate-500">${j.valor_inicial}M</div>
                        </div>
                        <button onClick={() => handleDrop(j.id_jugador)}
                          className="text-red-400 hover:text-red-300 text-[10px] font-bold px-1">X</button>
                      </div>
                    ))}
                  </div>
                  {team.jugadores.length === 11 && (
                    <div className="mt-3 bg-soccer-green/10 border border-soccer-green/20 rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-soccer-green">Equipo confirmado para {team.fecha}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Los puntos se sumarán automáticamente cuando se jueguen los partidos</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Admin: Simulate fecha */}
        {user?.is_admin && fechas.length > 0 && (
          <div className="mt-4 glass-card rounded-2xl p-4 border border-amber-700/30 bg-amber-900/5">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Admin — Simular fecha</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {fechas.filter(f => f.pendientes > 0).map((f) => (
                <button key={f.fase} onClick={() => handleSimulate(f.fase)} disabled={simulating}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-600/30 transition-all disabled:opacity-50">
                  {simulating ? '...' : `${f.fase} (${f.pendientes} pend)`}
                </button>
              ))}
              {fechas.filter(f => f.pendientes > 0).length === 0 && (
                <span className="text-xs text-slate-500">Todas las fechas están finalizadas</span>
              )}
            </div>
          </div>
        )}
      </>)}

      {/* Tab: My Team */}
      {tab === 'team' && (
        <div>
          {team ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Fecha: </span>
                  <span className="text-sm font-bold text-soccer-green">{team.fecha}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">Presupuesto: <strong className="text-slate-200">${budget}M</strong></span>
                  <span className="text-slate-400">Puntos: <strong className="text-soccer-green">{team.puntos_totales}</strong></span>
                </div>
              </div>
              <Pitch formation={formation} players={team.jugadores} compact={isMobile} />
              <div className="glass-card rounded-2xl p-4 border border-slate-800 mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {team.jugadores.map((j) => (
                    <div key={j.id} className="bg-slate-800/50 rounded-xl p-2">
                      <div className="text-xs font-bold text-slate-200 truncate">{j.nombre}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{j.equipo_nacional}</span>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                          j.posicion === 'GK' ? 'bg-yellow-500/20 text-yellow-400' :
                          j.posicion === 'DEF' ? 'bg-blue-500/20 text-blue-400' :
                          j.posicion === 'MID' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{j.posicion}</span>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                          j.posicion_especifica === 'GK' ? 'bg-yellow-500/10 text-yellow-300' :
                          j.posicion_especifica === 'CB' || j.posicion_especifica === 'LB' || j.posicion_especifica === 'RB' ? 'bg-blue-500/10 text-blue-300' :
                          j.posicion_especifica === 'CM' || j.posicion_especifica === 'CDM' || j.posicion_especifica === 'CAM' || j.posicion_especifica === 'LM' || j.posicion_especifica === 'RM' ? 'bg-purple-500/10 text-purple-300' :
                          'bg-red-500/10 text-red-300'
                        }`}>{SPECIFIC_LABELS[j.posicion_especifica] || j.posicion_especifica}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">${j.valor_inicial}M | {j.posicion_cancha || j.posicion}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl p-6 border border-slate-800 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No armaste equipo para esta fecha todavía.</p>
              <button onClick={() => setTab('draft')} className="mt-3 text-soccer-green font-bold text-sm">
                Ir a armar equipo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Duelo Notification */}
      <DueloNotification groupId={groupId} />

      {/* Tab: H2H */}
      {tab === 'h2h' && (
        <div>
          {h2hMatches.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 border border-slate-800 text-center">
              <Swords className="w-12 h-12 text-soccer-green mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-100 mb-2">Partidos entre miembros</h3>
              <p className="text-sm text-slate-400 mb-4">Cada fecha los miembros del grupo se enfrentan según un fixture round-robin. Gana el que más puntos fantasy acumule en esa fecha.</p>
              <button onClick={handleInitH2H}
                className="bg-gradient-green text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all">
                Generar fixture
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Duelos */}
              <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-soccer-green" /> Duelos ⚽
                  </h3>
                  {team?.jugadores?.length === 11 && (
                    <button onClick={() => { loadDisponibles(); setShowDueloModal(true) }}
                      className="text-[10px] font-bold bg-soccer-green/20 text-soccer-green px-2.5 py-1 rounded-lg hover:bg-soccer-green/30 transition-all">
                      Retar a un jugador
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-800/50">
                  {duelos.filter(d => d.estado !== 'finished' && d.estado !== 'cancelled').length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      {team?.jugadores?.length === 11
                        ? 'Retá a un jugador para jugar un partido!'
                        : 'Necesitás 11 jugadores para retar'}
                    </div>
                  ) : (
                    duelos.filter(d => d.estado !== 'finished' && d.estado !== 'cancelled').map((d) => {
                      const soyRetador = d.id_retador === user?.id_usuario
                      const otroNombre = soyRetador ? d.rival_nombre : d.retador_nombre
                      return (
                        <div key={d.id_duelo} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Zap className={`w-4 h-4 ${d.estado === 'playing' ? 'text-soccer-green animate-pulse' : 'text-yellow-400'}`} />
                            <div>
                              <span className="text-sm font-semibold text-slate-200">vs {otroNombre}</span>
                              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                d.estado === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-soccer-green/20 text-soccer-green'
                              }`}>
                                {d.estado === 'pending' ? 'Pendiente' : 'Jugando'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {d.estado === 'playing' && (
                              <>
                              <a href={`/duel/${d.id_duelo}`}
                                className="text-[10px] font-bold bg-soccer-green/20 text-soccer-green px-2.5 py-1 rounded-lg hover:bg-soccer-green/30">
                                Ir al partido
                              </a>
                              <button onClick={() => handleCancelDuelo(d.id_duelo)}
                                className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-500/30">
                                Cancelar
                              </button>
                              </>
                            )}
                            {d.estado === 'pending' && !soyRetador && (
                              <>
                                <button onClick={() => handleAcceptDuelo(d.id_duelo)}
                                  className="text-[10px] font-bold bg-soccer-green/20 text-soccer-green px-2.5 py-1 rounded-lg hover:bg-soccer-green/30">
                                  Aceptar
                                </button>
                                <button onClick={() => handleRejectDuelo(d.id_duelo)}
                                  className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-500/30">
                                  Rechazar
                                </button>
                              </>
                            )}
                            {d.estado === 'pending' && soyRetador && (
                              <span className="text-[10px] text-slate-500 px-2.5 py-1">Esperando...</span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {/* Duelos finalizados */}
                {duelos.filter(d => d.estado === 'finished' || d.estado === 'cancelled').length > 0 && (
                  <div className="border-t border-slate-800/50">
                    <div className="p-3">
                      <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Historial</h4>
                      <div className="space-y-1">
                        {duelos.filter(d => d.estado === 'finished' || d.estado === 'cancelled').slice(0, 5).map((d) => {
                          const soyRetador = d.id_retador === user?.id_usuario
                          const otroNombre = soyRetador ? d.rival_nombre : d.retador_nombre
                          const misGoles = soyRetador ? d.goles_retador : d.goles_rival
                          const susGoles = soyRetador ? d.goles_rival : d.goles_retador
                          const gane = d.ganador_id === user?.id_usuario
                          return (
                            <div key={d.id_duelo} className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">vs {otroNombre}</span>
                              <span className={`font-bold ${gane ? 'text-soccer-green' : d.ganador_id ? 'text-red-400' : 'text-slate-400'}`}>
                                {misGoles}-{susGoles} {gane ? '🏆' : d.ganador_id ? '😔' : '🤝'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Duelo modal */}
      {showDueloModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowDueloModal(false)}>
          <div className="glass-card rounded-2xl border border-slate-700 w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200">Jugadores disponibles</h3>
              <button onClick={() => setShowDueloModal(false)}
                className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            {disponibles.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">No hay jugadores disponibles con 11 jugadores</p>
            ) : (
              <div className="space-y-2">
                {disponibles.map((u) => (
                  <div key={u.id_usuario}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50">
                    <span className="text-sm font-semibold text-slate-200">{u.nombre}</span>
                    <button onClick={() => handleChallenge(u.id_usuario)}
                      disabled={challenging}
                      className="text-[10px] font-bold bg-soccer-green/20 text-soccer-green px-2.5 py-1 rounded-lg hover:bg-soccer-green/30 transition-all disabled:opacity-50">
                      {challenging ? '...' : 'Retar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Ranking */}
      {tab === 'ranking' && (
        <div>
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ranking Fantasy</h3>
            </div>
            {rankings.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Sin datos de fantasy todavía</div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {rankings.map((r, i) => (
                  <div key={r.id_usuario} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-all">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-slate-400/20 text-slate-300' :
                      i === 2 ? 'bg-amber-700/20 text-amber-600' :
                      'bg-slate-800 text-slate-500'
                    }`}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-200">{r.nombre}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-soccer-green">{r.puntos_totales} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
