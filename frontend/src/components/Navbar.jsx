import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, BookOpen, Shield } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header
      className="sticky top-0 z-40 argentina-stripe-top"
      style={{
        backgroundColor: 'rgba(13,13,13,0.96)',
        borderBottom: '1px solid #222',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-display text-2xl text-wc-white tracking-widest">PRODE</span>
          <span className="text-display text-2xl tracking-widest" style={{ color: '#00a651' }}>MUNDIAL</span>
          <span className="text-sm ml-0.5">🇦🇷</span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <Link to="/my-groups"
              className="hidden md:inline text-[11px] font-bold uppercase tracking-widest text-wc-muted hover:text-wc-white transition-colors">
              Mis Grupos
            </Link>
            <Link to="/rules"
              className="text-wc-muted hover:text-wc-white transition-colors flex items-center"
              title="Reglamento"
            >
              <span className="hidden md:inline text-[11px] font-bold uppercase tracking-widest">
                Reglamento
              </span>
              <BookOpen className="w-4 h-4 md:hidden" />
            </Link>

            {user.is_admin && (
              <Link to="/admin/results"
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
                title="Admin Resultados"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Resultados</span>
              </Link>
            )}

            {/* User chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: '#1a2a1a', border: '1px solid #2a3a2a' }}>
              <User className="w-3.5 h-3.5" style={{ color: '#00a651' }} />
              <span className="text-xs font-semibold text-wc-white max-w-[100px] truncate">{user.nombre}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-full transition-colors"
              style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" style={{ color: '#6b6b6b' }} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Navbar
