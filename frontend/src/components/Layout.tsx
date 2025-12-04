import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  HomeIcon,
  ServerStackIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useCallback, useMemo } from 'react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  const navigation = useMemo(() => [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Servers', href: '/servers', icon: ServerStackIcon },
    ...(user?.role === 'admin' ? [{ name: 'Users', href: '/users', icon: UsersIcon }] : []),
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ], [user?.role])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Optimized */}
      <aside className="w-64 flex flex-col relative z-20 bg-dark-900/90 border-r border-white/5">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center">
            <img src="/obsidian.svg" alt="Obsidian" className="h-8 w-8" />
            <div className="ml-3">
              <span className="text-xl font-bold text-white">Obsidian</span>
              <span className="text-xl font-light text-obsidian-400 ml-1">Panel</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
              end={item.href === '/'}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="px-3 py-4 border-t border-white/5">
          <NavLink
            to="/servers/create"
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>New Server</span>
          </NavLink>
        </div>

        {/* User Section */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-obsidian-500 to-obsidian-700 flex items-center justify-center text-sm font-bold text-white">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">{user?.username}</p>
                <p className="text-xs text-obsidian-400 capitalize flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  {user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-400 rounded-xl transition-colors duration-200 hover:bg-red-500/10"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
