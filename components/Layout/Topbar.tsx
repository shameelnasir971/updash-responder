//components/Layout/Topbar.tsx


'use client'

interface User {
  id: number
  name: string
  email: string
  company_name: string
  profile_photo?: string
}

interface TopbarProps {
  user: User | null
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export default function Topbar({ user, setSidebarOpen }: TopbarProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center">
          {/* 🍔 Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 mr-3 rounded-md hover:bg-gray-100"
          >
            ☰
          </button>

          <h1 className="text-2xl font-bold text-gray-900">DASHBOARD</h1>
        </div>

        {/* User */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.company_name}</p>
          </div>

          {user?.profile_photo ? (
            <img
              src={user.profile_photo}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
              {user?.name?.charAt(0)}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
