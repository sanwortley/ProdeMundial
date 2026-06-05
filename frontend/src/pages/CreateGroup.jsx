import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import Input from '../components/Input'
import Button from '../components/Button'
import { PlusCircle, Clipboard, Check, Share2, ArrowRight } from 'lucide-react'

const CreateGroup = () => {
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // State for success data
  const [createdGroup, setCreatedGroup] = useState(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombreGrupo) {
      setError('Por favor, ingresa un nombre para el grupo.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post('/groups', { nombre_grupo: nombreGrupo })
      setCreatedGroup(response.data)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'No se pudo crear el grupo.')
    } finally {
      setLoading(false)
    }
  }

  // Get full link to join group
  const getInviteLink = () => {
    if (!createdGroup) return ''
    const base = window.location.origin
    return `${base}/unirse/${createdGroup.codigo_invitacion}`
  }

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

  const getWhatsAppShareUrl = () => {
    if (!createdGroup) return ''
    const text = `¡Súmate a mi prode del Mundial en "Prode Mundial"! 🏆⚽\n\nNombre del grupo: *${createdGroup.nombre_grupo}*\nCódigo de invitación: *${createdGroup.codigo_invitacion}*\n\nÚnete tocando este enlace: ${getInviteLink()}`
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
  }

  if (createdGroup) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          
          {/* Header Success */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 bg-soccer-green/10 rounded-full border border-soccer-green/30 flex items-center justify-center text-soccer-green">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="font-extrabold text-2xl text-slate-100 mt-2">
              ¡Grupo Creado!
            </h2>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Comparte el acceso con tus amigos
            </p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
            
            {/* Display Code */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Código de Invitación</span>
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-4 py-3 rounded-xl">
                <span className="font-mono font-black text-soccer-green tracking-wider">
                  {createdGroup.codigo_invitacion}
                </span>
                <button
                  onClick={() => copyToClipboard(createdGroup.codigo_invitacion, 'code')}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-soccer-green rounded-lg transition-colors"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-soccer-green" /> : <Clipboard className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Display Link */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enlace de Invitación</span>
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-4 py-3 rounded-xl">
                <span className="text-xs text-slate-300 truncate max-w-[200px]">
                  {getInviteLink()}
                </span>
                <button
                  onClick={() => copyToClipboard(getInviteLink(), 'link')}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-soccer-green rounded-lg transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-soccer-green" /> : <Clipboard className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
          </div>

          {/* Social Share Buttons */}
          <div className="flex flex-col gap-2">
            <a
              href={getWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-slate-900 font-bold text-sm rounded-xl transition-all shadow-[0_4px_12px_rgba(37,211,102,0.2)] active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir por WhatsApp</span>
            </a>

            <Link to={`/groups/${createdGroup.id_grupo}`} className="w-full">
              <Button variant="primary" fullWidth className="flex items-center justify-center gap-1.5">
                <span>Ir al Dashboard</span>
                <ArrowRight className="w-4 h-4 text-soccer-dark" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        
        {/* Header Form */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-soccer-green/10 p-3 rounded-2xl border border-soccer-green/20 text-soccer-green">
            <PlusCircle className="w-6 h-6" />
          </div>
          <h2 className="font-extrabold text-2xl text-slate-100 mt-2">
            Crear Grupo
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Arma una sala privada para competir
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nombre del Grupo"
            id="nombreGrupo"
            type="text"
            value={nombreGrupo}
            onChange={(e) => setNombreGrupo(e.target.value)}
            placeholder="Ej: Los Pibes del Fútbol, Oficina 2026"
            required
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            fullWidth
            className="mt-2"
          >
            Crear sala
          </Button>
        </form>

        <div className="text-center">
          <Link to="/my-groups" className="text-xs text-slate-400 hover:text-soccer-green font-bold">
            Volver a mis grupos
          </Link>
        </div>

      </div>
    </div>
  )
}

export default CreateGroup
