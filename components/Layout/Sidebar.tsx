'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface User {
  id: number
  name: string
  email: string
  company_name?: string
}

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  user: User | null
  handleSignOut: () => void
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  user,
  handleSignOut
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [upworkConnected, setUpworkConnected] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Jobs', href: '/dashboard/jobs', icon: '💼' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '🤖' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' }
  ]

  // 🔄 Check Upwork connection on load
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    setLoadingStatus(true)
    setError(null)

    try {
      const res = await fetch('/api/upwork/status', {
        credentials: 'include',
        cache: 'no-store'
      })

      const data = await res.json()
      setUpworkConnected(data.connected === true)
    } catch (err) {
      console.error('Upwork status error:', err)
      setError('Unable to check Upwork status')
      setUpworkConnected(false)
    } finally {
      setLoadingStatus(false)
    }
  }

  // 🔗 Connect Upwork
  const handleConnectUpwork = async () => {
    if (connecting) return
    setConnecting(true)
    setError(null)

    try {
      const res = await fetch('/api/upwork/auth', {
        credentials: 'include',
        cache: 'no-store'
      })

      const data = await res.json()

      if (!data.success || !data.url) {
        setError(data.error || 'Authentication failed')
        setConnecting(false)
        return
      }

      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setError('Failed to connect Upwork')
      setConnecting(false)
    }
  }

  // ❌ Disconnect Upwork
  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect Upwork?')) return

    try {
      const res = await fetch('/api/upwork/disconnect', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (data.success) {
        setUpworkConnected(false)
      } else {
        setError('Disconnect failed')
      }
    } catch {
      setError('Disconnect failed')
    }
  }

  return (
    <>
      {/* Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-80 bg-gray-900 text-white
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-2xl font-bold">UPDASH</h1>
          <p className="text-sm text-gray-400">Upwork AI Assistant</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map(item => {
            const active = pathname === item.href
            return (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href)
                  setSidebarOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left
                  transition
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'}
                `}
              >
                <span className="text-xl">{item.icon}</span>
                {item.name}
              </button>
            )
          })}

          {/* Upwork Box */}
          <div className="mt-6 bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Upwork Account</h3>

            {loadingStatus ? (
              <p className="text-gray-400 text-sm">Checking status...</p>
            ) : upworkConnected ? (
              <>
                <p className="text-green-400 mb-3">✅ Connected</p>
                <button
                  onClick={handleDisconnectUpwork}
                  className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-yellow-400 mb-3">⚠️ Not Connected</p>
                <button
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Upwork'}
                </button>
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4">
          {user && (
            <>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>

              <button
                onClick={handleSignOut}
                className="mt-3 w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
