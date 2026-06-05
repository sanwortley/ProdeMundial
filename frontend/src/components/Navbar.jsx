import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Trophy, LogOut, User } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-soccer-dark/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-soccer-green/10 p-1.5 rounded-lg border border-soccer-green/30 group-hover:bg-soccer-green/20 transition-all duration-300">
            <Trophy className="w-5 h-5 text-soccer-green" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-soccer-green bg-clip-text text-transparent">
            PRODE MUNDIAL
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <Link 
              to="/my-groups" 
              className="hidden md:inline-flex text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-soccer-green transition-all"
            >
              Mis Grupos
            </Link>
            
            <Link 
              to="/rules" 
              className="hidden md:inline-flex text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-soccer-green transition-all"
            >
              Reglamento
            </Link>
            
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/50 rounded-full px-3 py-1.5">
              <User className="w-4 h-4 text-soccer-green" />
              <span className="text-xs font-medium text-slate-300 max-w-[120px] truncate">
                {user.nombre}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Navbar
