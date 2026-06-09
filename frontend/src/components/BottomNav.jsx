import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Trophy, ClipboardList, Settings, FolderClosed, PlusCircle, UserPlus, BookOpen, Shield } from 'lucide-react'

const BottomNav = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return null

  const groupMatch = pathname.match(/\/groups\/(\d+)/)
  const groupId = groupMatch ? groupMatch[1] : null

  const isActive = (path) => {
    if (path === `/groups/${groupId}`) return pathname === path
    return pathname.startsWith(path)
  }

  const NavItem = ({ to, icon: Icon, label, active }) => (
    <Link
      to={to}
      className="flex flex-col items-center justify-center w-16 h-full transition-colors duration-150 relative"
      style={{ color: active ? '#f5f5f5' : '#4a4a4a' }}
    >
      {/* Barra superior de pestaña activa — color verde FIFA */}
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
          style={{ background: '#00a651' }}
        />
      )}
      <Icon className="w-5 h-5 mb-0.5" />
      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  )

  return (
    <nav
      className="sticky bottom-0 z-40 md:hidden"
      style={{
        backgroundColor: '#0d0d0d',
        borderTop: '1px solid #222',
      }}
    >
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-2">
        {groupId ? (
          <>
            <NavItem to={`/groups/${groupId}`}             icon={Home}          label="Inicio"     active={isActive(`/groups/${groupId}`)} />
            <NavItem to={`/groups/${groupId}/predictions`} icon={ClipboardList} label="Prode"      active={isActive(`/groups/${groupId}/predictions`)} />
            <NavItem to={`/groups/${groupId}/ranking`}     icon={Trophy}        label="Posiciones" active={isActive(`/groups/${groupId}/ranking`)} />
            <NavItem to={`/groups/${groupId}/fantasy`}     icon={Shield}        label="Fantasy"    active={isActive(`/groups/${groupId}/fantasy`)} />
            <NavItem to={`/groups/${groupId}/settings`}    icon={Settings}      label="Config"     active={isActive(`/groups/${groupId}/settings`)} />
          </>
        ) : (
          <>
            <NavItem to="/my-groups"    icon={FolderClosed} label="Grupos" active={pathname === '/my-groups' || pathname === '/'} />
            <NavItem to="/create-group" icon={PlusCircle}   label="Crear"  active={pathname === '/create-group'} />
            <NavItem to="/join-group"   icon={UserPlus}     label="Unirse" active={pathname === '/join-group'} />
            <NavItem to="/rules"        icon={BookOpen}     label="Reglas" active={pathname === '/rules'} />
          </>
        )}
      </div>
    </nav>
  )
}

export default BottomNav
