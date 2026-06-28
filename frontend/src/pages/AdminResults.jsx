import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, Save, Check, ArrowLeft, Search, Trophy, RefreshCw, Zap } from 'lucide-react'

const AdminResults = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [success, setSuccess] = useState({})
  const [error, setError] = useState('')
  const [selectedFase, setSelectedFase] = useState('')
  const [scores, setScores] = useState({})
  const [populating16avos, setPopulating16avos] = useState(false)
  const [populate16avosResult, setPopulate16avosResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/my-groups')
      return
    }
    loadMatches()
  }, [])

  const loadMatches = async () => {
    try {
      const res = await api.get('/matches/grouped')
      setGroups(res.data)
      const fases = Object.keys(res.data)
      if (fases.length > 0) setSelectedFase(fases[0])
      const initial = {}
      Object.entries(res.data).forEach(([fase, matches]) => {
        matches.forEach(m => {
          initial[m.id_partido] = {
            goles_local: m.goles_local ?? '',
            goles_visitante: m.goles_visitante ?? '',
            finalizado: m.finalizado
          }
        })
      })
      setScores(initial)
    } catch (e) {
      setError('Error al cargar partidos')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (id, field, value) => {
    setScores(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value === '' ? '' : parseInt(value) || 0 }
    }))
  }

  const handlePopulate16avos = async () => {
    setPopulating16avos(true)
    setPopulate16avosResult(null)
    try {
      const res = await api.post('/admin/populate-16avos')
      setPopulate16avosResult({ ok: true, ...res.data })
      await loadMatches()
    } catch (e) {
      setPopulate16avosResult({ ok: false, error: e.response?.data?.detail || 'Error al poblar 16avos' })
    } finally {
      setPopulating16avos(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.post('/matches/auto-sync')
      setSyncResult({ ok: true, msg: res.data?.detail || 'Sync iniciado' })
      setTimeout(() => {
        loadMatches()
        setSyncResult(null)
      }, 3000)
    } catch (e) {
      setSyncResult({ ok: false, error: e.response?.data?.detail || 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async (matchId) => {
    setSaving(prev => ({ ...prev, [matchId]: true }))
    setSuccess(prev => ({ ...prev, [matchId]: false }))
    try {
      const s = scores[matchId]
      await api.put(`/matches/${matchId}/result`, {
        goles_local: parseInt(s.goles_local) || 0,
        goles_visitante: parseInt(s.goles_visitante) || 0,
        finalizado: true
      })
      setSuccess(prev => ({ ...prev, [matchId]: true }))
      setTimeout(() => setSuccess(prev => ({ ...prev, [matchId]: false })), 2000)
      await loadMatches()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(prev => ({ ...prev, [matchId]: false }))
    }
  }

  if (!user?.is_admin) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="font-extrabold text-xl text-slate-200">Acceso Denegado</h2>
        <p className="text-sm text-slate-500 mt-2">Solo administradores pueden acceder a esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  const fases = Object.keys(groups)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-800/80 border border-slate-700 hover:text-soccer-green rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-slate-100">Admin: Resultados</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Carga manual de resultados</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Admin quick-action tools */}
      <div className="glass-card rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 flex flex-col gap-3">
        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Herramientas Admin</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-slate-800 border border-slate-700 hover:border-soccer-green/40 hover:text-soccer-green transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync Resultados'}
          </button>
          <button
            onClick={handlePopulate16avos}
            disabled={populating16avos}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-slate-800 border border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 text-amber-400 transition-all disabled:opacity-50"
          >
            <Trophy className={`w-3.5 h-3.5 ${populating16avos ? 'animate-pulse' : ''}`} />
            {populating16avos ? 'Calculando...' : 'Poblar 16avos'}
          </button>
        </div>
        {syncResult && (
          <p className={`text-xs font-semibold ${syncResult.ok ? 'text-soccer-green' : 'text-red-400'}`}>
            {syncResult.ok ? `✓ ${syncResult.msg}` : `✗ ${syncResult.error}`}
          </p>
        )}
        {populate16avosResult && (
          <div className={`text-xs font-semibold ${populate16avosResult.ok ? 'text-amber-300' : 'text-red-400'}`}>
            {populate16avosResult.ok ? (
              <>
                <p>✓ {populate16avosResult.partidos_actualizados} partido(s) actualizados en 16avos</p>
                {populate16avosResult.detalle?.slice(0, 4).map((d, i) => (
                  <p key={i} className="text-[10px] text-slate-400 mt-0.5">#{d.partido}: {d.despues}</p>
                ))}
              </>
            ) : (
              <p>✗ {populate16avosResult.error}</p>
            )}
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col gap-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seleccionar Fecha / Ronda</label>
        <select
          value={selectedFase}
          onChange={(e) => setSelectedFase(e.target.value)}
          className="w-full h-11 px-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-soccer-green"
        >
          {fases.map(fase => (
            <option key={fase} value={fase}>{fase} ({groups[fase].filter(m => m.finalizado).length}/{groups[fase].length})</option>
          ))}
        </select>
      </div>

      {selectedFase && groups[selectedFase] && (
        <div className="flex flex-col gap-3">
          {groups[selectedFase].map(match => {
            const s = scores[match.id_partido] || {}
            const isFin = match.finalizado
            return (
              <div key={match.id_partido} className={`glass-card rounded-2xl p-4 border transition-all ${
                isFin ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-800 hover:border-soccer-green/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
                    #{match.id_partido}
                  </span>
                  {isFin && <span className="text-[9px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded-md">Finalizado</span>}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold text-sm text-slate-200 flex-1 text-right">{match.equipo_local}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0"
                      value={s.goles_local ?? ''}
                      onChange={(e) => handleScoreChange(match.id_partido, 'goles_local', e.target.value)}
                      className="w-12 h-12 bg-slate-950/60 border border-slate-800 rounded-xl text-center font-extrabold text-lg text-slate-100 focus:border-soccer-green"
                    />
                    <span className="text-slate-600 font-bold mx-1">-</span>
                    <input
                      type="number" min="0"
                      value={s.goles_visitante ?? ''}
                      onChange={(e) => handleScoreChange(match.id_partido, 'goles_visitante', e.target.value)}
                      className="w-12 h-12 bg-slate-950/60 border border-slate-800 rounded-xl text-center font-extrabold text-lg text-slate-100 focus:border-soccer-green"
                    />
                  </div>
                  <span className="font-extrabold text-sm text-slate-200 flex-1">{match.equipo_visitante}</span>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => handleSave(match.id_partido)}
                    disabled={saving[match.id_partido]}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      success[match.id_partido]
                        ? 'bg-soccer-green text-soccer-dark border border-soccer-green'
                        : 'bg-slate-800 border border-slate-700 hover:bg-soccer-green hover:text-soccer-dark'
                    } disabled:opacity-50`}
                  >
                    {success[match.id_partido] ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {success[match.id_partido] ? 'Guardado' : 'Guardar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AdminResults
