import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Trophy, ClipboardList, Settings, FolderClosed, PlusCircle, UserPlus, BookOpen, Shield } from 'lucide-react'

const BottomNav = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return null

  // Extract groupId from url if present
  // Matches paths like: /groups/1, /groups/1/predictions, etc.
  const groupMatch = pathname.match(/\/groups\/(\d+)/)
  const groupId = groupMatch ? groupMatch[1] : null

  const isActive = (path) => {
    if (path === `/groups/${groupId}`) {
      // For dashboard, ensure it's exact match or at least doesn't match subroutes
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  const activeClass = "text-soccer-green"
  const inactiveClass = "text-slate-500 hover:text-slate-300"

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 bg-soccer-dark/90 backdrop-blur-lg border-t border-slate-800/80 md:hidden px-2 pb-safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {groupId ? (
          // Group dashboard navigation
          <>
            <Link
              to={`/groups/${groupId}`}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive(`/groups/${groupId}`) ? activeClass : inactiveClass
              }`}
            >
              <Home className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Inicio</span>
            </Link>

            <Link
              to={`/groups/${groupId}/predictions`}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive(`/groups/${groupId}/predictions`) ? activeClass : inactiveClass
              }`}
            >
              <ClipboardList className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Prode</span>
            </Link>

            <Link
              to={`/groups/${groupId}/ranking`}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive(`/groups/${groupId}/ranking`) ? activeClass : inactiveClass
              }`}
            >
              <Trophy className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Posiciones</span>
            </Link>

            <Link
              to={`/groups/${groupId}/fantasy`}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive(`/groups/${groupId}/fantasy`) ? activeClass : inactiveClass
              }`}
            >
              <Shield className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Fantasy</span>
            </Link>

            <Link
              to={`/groups/${groupId}/settings`}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive(`/groups/${groupId}/settings`) ? activeClass : inactiveClass
              }`}
            >
              <Settings className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Config</span>
            </Link>
          </>
        ) : (
          // General dashboard navigation
          <>
            <Link
              to="/my-groups"
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                pathname === '/my-groups' || pathname === '/' ? activeClass : inactiveClass
              }`}
            >
              <FolderClosed className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Grupos</span>
            </Link>

            <Link
              to="/create-group"
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                pathname === '/create-group' ? activeClass : inactiveClass
              }`}
            >
              <PlusCircle className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Crear</span>
            </Link>

            <Link
              to="/join-group"
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                pathname === '/join-group' ? activeClass : inactiveClass
              }`}
            >
              <UserPlus className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Unirse</span>
            </Link>

            <Link
              to="/rules"
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                pathname === '/rules' ? activeClass : inactiveClass
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Reglas</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default BottomNav
