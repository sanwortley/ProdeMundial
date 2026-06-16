import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import MatchCard from '../components/MatchCard'
import Input from '../components/Input'
import Button from '../components/Button'
import { ClipboardList, ArrowLeft, Trophy, Save, Check } from 'lucide-react'

const equiposMundial = [
  "Alemania", "Argelia", "Argentina", "Australia", "Austria", "Bélgica",
  "Bolivia", "Bosnia y Herzegovina", "Brasil", "Cabo Verde", "Canadá",
  "Chile", "Colombia", "Congo", "Corea del Sur", "Costa de Marfil",
  "Costa Rica", "Croacia", "Curazao", "Dinamarca", "Ecuador", "Egipto",
  "España", "Estados Unidos", "Francia", "Ghana", "Haití", "Honduras",
  "Inglaterra", "Irán", "Irak", "Italia", "Jamaica", "Japón", "Jordania",
  "Marruecos", "México", "Nigeria", "Noruega", "Nueva Zelanda", "Países Bajos",
  "Panamá", "Paraguay", "Perú", "Portugal", "Qatar", "República Checa",
  "Senegal", "Sudáfrica", "Suecia", "Suiza", "Túnez", "Turquía", "Uruguay",
  "Uzbekistán", "Venezuela"
].sort();

const Predictions = () => {
  const { groupId } = useParams()
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [championPred, setChampionPred] = useState(null)
  const [selectedFase, setSelectedFase] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Champion input state
  const [campeonInput, setCampeonInput] = useState('')
  const [savingCamp, setSavingCamp] = useState(false)
  const [campSuccess, setCampSuccess] = useState(false)
  const [campError, setCampError] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupInfo, setGroupInfo] = useState(null)

  // Fetch all necessary data
  const fetchData = async () => {
    try {
      const [matchesRes, predsRes, champRes, groupRes] = await Promise.all([
        api.get('/matches'),
        api.get(`/predictions/group/${groupId}`),
        api.get(`/predictions/group/${groupId}/champion`),
        api.get(`/groups/${groupId}`)
      ])
      
      setMatches(matchesRes.data)
      setPredictions(predsRes.data)
      setGroupInfo(groupRes.data)
      
      // Set default selected phase if not set yet
      if (matchesRes.data.length > 0) {
        const uniqueFases = [...new Set(matchesRes.data.map(m => m.fase))]
        if (uniqueFases.length > 0) {
          setSelectedFase(uniqueFases[0])
        }
      }
      
      if (champRes.data) {
        setChampionPred(champRes.data)
        setCampeonInput(champRes.data.equipo_campeon)
      }
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los partidos o pronósticos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [groupId])

  // Save/Update prediction handler
  const handleSavePrediction = async (predictionPayload) => {
    // Inject group ID
    const payload = {
      ...predictionPayload,
      id_grupo: parseInt(groupId)
    }
    
    await api.post('/predictions', payload)
    
    // Refresh predictions in state
    const predsRes = await api.get(`/predictions/group/${groupId}`)
    setPredictions(predsRes.data)
  }

  // Save Champion Prediction handler
  const handleSaveChampion = async (e) => {
    e.preventDefault()
    if (!campeonInput.trim()) return

    setSavingCamp(true)
    setCampError('')
    setCampSuccess(false)

    try {
      const response = await api.post('/predictions/champion', {
        id_grupo: parseInt(groupId),
        equipo_campeon: campeonInput.trim()
      })
      setChampionPred(response.data)
      setCampSuccess(true)
      setTimeout(() => setCampSuccess(false), 2000)
    } catch (err) {
      console.error(err)
      setCampError(err.response?.data?.detail || 'No se pudo guardar la predicción de campeón.')
    } finally {
      setSavingCamp(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide">Cargando partidos...</p>
      </div>
    )
  }

  // Derived states for rules calculation
  const hasJokerUsed = predictions.some(p => p.usa_joker)
  
  // Map to check if double is used in a specific stage/fase
  const usedDoblesByFase = {}
  predictions.forEach(p => {
    if (p.usa_doble) {
      const match = matches.find(m => m.id_partido === p.id_partido)
      if (match) {
        usedDoblesByFase[match.fase] = true
      }
    }
  })

  // Get unique phases in correct order
  const uniqueFases = [...new Set(matches.map(m => m.fase))]

  // Filter matches based on selectedFase and searchTerm
  const filteredMatches = matches.filter(match => {
    // Phase filter
    if (selectedFase && selectedFase !== 'Todas' && match.fase !== selectedFase) {
      return false
    }
    // Team filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      return match.equipo_local.toLowerCase().includes(term) || 
             match.equipo_visitante.toLowerCase().includes(term)
    }
    return true
  })

  // Group filtered matches by phase
  const groupedFilteredMatches = {}
  filteredMatches.forEach(m => {
    if (!groupedFilteredMatches[m.fase]) {
      groupedFilteredMatches[m.fase] = []
    }
    groupedFilteredMatches[m.fase].push(m)
  })

  // Check if Fecha 3 last match has started (to lock champion input)
  const fecha3Matches = matches.filter(m => m.fase === 'Fecha 3')
  const lastGroupMatch = fecha3Matches.length > 0
    ? fecha3Matches.reduce((latest, current) => new Date(current.fecha) > new Date(latest.fecha) ? current : latest, fecha3Matches[0])
    : null
  const isChampionLocked = lastGroupMatch && new Date() >= new Date(lastGroupMatch.fecha)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to={`/groups/${groupId}`}
          className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-soccer-green" />
            Cargar Pronósticos
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            {groupInfo?.nombre_grupo}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Selector de Fecha/Fase */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-2 shadow-sm">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Seleccionar Fecha / Ronda
          </label>
          <select
            value={selectedFase}
            onChange={(e) => setSelectedFase(e.target.value)}
            className="w-full h-11 px-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-soccer-green"
          >
            <option value="Todas">Todas las Rondas</option>
            {uniqueFases.map(fase => (
              <option key={fase} value={fase}>
                {fase}
              </option>
            ))}
          </select>
        </div>

        {/* Buscador de Equipos */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-2 shadow-sm">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Filtrar por Equipo
          </label>
          <input
            type="text"
            placeholder="Ej: Argentina, México, España..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 px-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-soccer-green"
          />
        </div>
      </div>

      {/* Champion Prediction Card */}
      <div className="glass-card rounded-3xl p-5 border border-slate-800 shadow-md">
        <h2 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Trophy className="w-4 h-4 text-soccer-gold" />
          Predicción del Campeón del Torneo
        </h2>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          Arriesga quién será el campeón del torneo por +50 puntos. Se puede cargar y editar hasta el inicio del último partido de la Fecha 3.
        </p>

        <form onSubmit={handleSaveChampion} className="flex flex-col sm:flex-row items-end gap-3 mt-4">
          <div className="flex-1 w-full">
            <div className="flex flex-col gap-1.5 w-full text-left">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Equipo Campeón
              </label>
              <select
                id="equipoCampeon"
                value={campeonInput}
                onChange={(e) => setCampeonInput(e.target.value)}
                disabled={isChampionLocked}
                required
                className="w-full h-11 px-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-soccer-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Selecciona tu candidato...</option>
                {equiposMundial.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
          </div>
          
          {!isChampionLocked ? (
            <Button
              type="submit"
              variant={campSuccess ? 'primary' : 'secondary'}
              loading={savingCamp}
              className="w-full sm:w-auto h-11 flex items-center justify-center gap-1.5"
            >
              {campSuccess ? <Check className="w-4 h-4 text-soccer-dark" /> : <Save className="w-4 h-4" />}
              <span>{campSuccess ? 'Guardado' : 'Guardar'}</span>
            </Button>
          ) : (
            <div className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-bold uppercase tracking-wider h-11 flex items-center justify-center">
              Bloqueado (Fecha 3 terminada)
            </div>
          )}
        </form>

        {campError && (
          <p className="text-xs text-red-400 font-semibold mt-2">{campError}</p>
        )}
      </div>

      {/* Active Phase Matches Section */}
      <div className="flex flex-col gap-8">
        {Object.keys(groupedFilteredMatches).length > 0 ? (
          Object.keys(groupedFilteredMatches).map(fase => {
            const doubleUsedInThisFase = !!usedDoblesByFase[fase]

            return (
              <div key={fase} className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h2 className="font-extrabold text-base text-slate-200 tracking-tight">
                    {fase}
                  </h2>
                  {doubleUsedInThisFase && (
                    <span className="text-[10px] bg-soccer-green/10 text-soccer-green border border-soccer-green/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                      Doble usado
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {groupedFilteredMatches[fase].map(match => {
                    const pred = predictions.find(p => p.id_partido === match.id_partido)
                    
                    return (
                      <MatchCard
                        key={match.id_partido}
                        match={match}
                        prediction={pred}
                        onSave={handleSavePrediction}
                        hasJokerUsed={hasJokerUsed}
                        hasDobleUsed={doubleUsedInThisFase}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-slate-500 font-semibold">
            No hay partidos disponibles para los filtros seleccionados.
          </div>
        )}
      </div>
      
    </div>
  )
}

export default Predictions
