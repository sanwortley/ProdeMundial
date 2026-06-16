import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import Input from '../components/Input'
import Button from '../components/Button'
import { Settings, ArrowLeft, Clipboard, Check, Trash2, ShieldAlert, Trophy } from 'lucide-react'

const GroupSettings = () => {
  const { groupId } = useParams()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [updatingName, setUpdatingName] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Invite states
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)



  const fetchDetails = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`)
      setGroup(response.data)
      setNombreGrupo(response.data.nombre_grupo)
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la configuración del grupo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [groupId])

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'code') {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
      } else {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  const getInviteLink = () => {
    if (!group) return ''
    return `${window.location.origin}/unirse/${group.codigo_invitacion}`
  }

  const handleUpdateName = async (e) => {
    e.preventDefault()
    if (!nombreGrupo.trim()) return

    setUpdatingName(true)
    try {
      await api.put(`/groups/${groupId}`, { nombre_grupo: nombreGrupo.trim() })
      await fetchDetails()
      alert('¡Nombre de grupo actualizado!')
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al actualizar nombre')
    } finally {
      setUpdatingName(false)
    }
  }

  const handleDeleteGroup = async () => {
    setDeleting(true)
    try {
      await api.delete(`/groups/${groupId}`)
      navigate('/my-groups')
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar grupo')
      setDeleting(false)
    }
  }



  if (loading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-soccer-green/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-soccer-green rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 text-sm font-semibold tracking-wide">Cargando ajustes...</p>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center flex flex-col items-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <h2 className="font-extrabold text-xl text-slate-200">Error</h2>
        <p className="text-sm text-slate-500">{error || 'No se pudo cargar la configuración.'}</p>
        <Link to="/my-groups" className="text-soccer-green font-bold hover:underline">
          Volver a mis grupos
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col gap-6">
      
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
            <Settings className="w-6 h-6 text-slate-400" />
            Configuración
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            {group.nombre_grupo}
          </p>
        </div>
      </div>

      {/* Invitations details */}
      <div className="glass-card rounded-3xl p-5 flex flex-col gap-4 border border-slate-800">
        <h2 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider">
          Invitar amigos
        </h2>
        
        <div className="flex flex-col gap-3">
          {/* Display Code */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Código de Invitación</span>
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-4 py-2.5 rounded-xl">
              <span className="font-mono font-black text-soccer-green tracking-wider">
                {group.codigo_invitacion}
              </span>
              <button
                onClick={() => copyToClipboard(group.codigo_invitacion, 'code')}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-soccer-green rounded-lg transition-colors"
              >
                {copiedCode ? <Check className="w-4.5 h-4.5 text-soccer-green" /> : <Clipboard className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Display Link */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enlace directo</span>
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-4 py-2.5 rounded-xl">
              <span className="text-xs text-slate-300 truncate max-w-[400px]">
                {getInviteLink()}
              </span>
              <button
                onClick={() => copyToClipboard(getInviteLink(), 'link')}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-soccer-green rounded-lg transition-colors"
              >
                {copiedLink ? <Check className="w-4.5 h-4.5 text-soccer-green" /> : <Clipboard className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="glass-card rounded-3xl p-5 border border-slate-800">
        <h2 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider mb-3">
          Miembros del Grupo ({group.miembros.length})
        </h2>
        
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
          {group.miembros.map((miembro) => (
            <div key={miembro.id_usuario} className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/50 rounded-2xl">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-200">
                  {miembro.nombre}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {miembro.rol === 'admin' ? 'Administrador' : 'Miembro'}
                </span>
              </div>
              <span className="font-black text-sm text-soccer-green">
                {miembro.puntos_totales} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Group Creator Admin Operations */}
      {group.es_creador && (
        <>
          <div className="glass-card rounded-3xl p-5 border border-slate-800 flex flex-col gap-4">
            <h2 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider">
              Ajustes de Administrador
            </h2>

            {/* Change Name */}
            <form onSubmit={handleUpdateName} className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <Input
                  label="Nombre del Grupo"
                  id="nombreGrupoSettings"
                  type="text"
                  value={nombreGrupo}
                  onChange={(e) => setNombreGrupo(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="secondary" loading={updatingName} className="w-full sm:w-auto h-11">
                Guardar
              </Button>
            </form>

            <div className="h-px bg-slate-800"></div>

            {/* Delete Group */}
            <div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta acción es irreversible y eliminará el grupo, a todos sus miembros y sus respectivas predicciones cargadas.
              </p>
              
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Grupo</span>
                </button>
              ) : (
                <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="text-xs font-bold text-red-400">¿Estás seguro de eliminar este grupo?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteGroup}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
    </div>
  )
}

export default GroupSettings
