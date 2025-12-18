// components/Layout/Sidebar.tsx - FINAL FIXED VERSION
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  user: {
    id: number
    name: string
    email: string
    company_name: string
  } | null
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
  const [loadingConnection, setLoadingConnection] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '🤖' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  // Check connection status on load
  useEffect(() => {
    checkUpworkConnection()
  }, [])

  const checkUpworkConnection = async () => {
    setLoadingConnection(true)
    try {
      const res = await fetch('/api/upwork/status')
      if (res.ok) {
        const data = await res.json()
        setUpworkConnected(data.connected === true)
      }
    } catch (err) {
      console.error('Failed to check Upwork status:', err)
      setUpworkConnected(false)
    } finally {
      setLoadingConnection(false)
    }
  }

  // Connect Button Click
  const handleConnectUpwork = async () => {
    if (connecting) return
    setConnecting(true)

    try {
      const res = await fetch('/api/upwork/auth')
      const data = await res.json()

      if (data.success && data.url) {
        // Safe redirect to Upwork login
        window.location.href = data.url
      } else {
        alert('Error: ' + (data.error || 'Cannot get login link'))
        setConnecting(false)
      }
    } catch (err) {
      console.error('Connect failed:', err)
      alert('Connection failed. Check internet or try again.')
      setConnecting(false)
    }
  }

  // Disconnect Button
  const handleDisconnectUpwork = async () => {
    if (!confirm('Disconnect Upwork account? All jobs will stop loading.')) return

    try {
      const res = await fetch('/api/upwork/disconnect', {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        setUpworkConnected(false)
        alert('✅ Upwork disconnected!')
        window.location.reload()
      } else {
        alert('Failed: ' + data.error)
      }
    } catch (err) {
      alert('Disconnect failed')
    }
  }

  return (
    <>
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-gray-900 transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0 flex flex-col
      `}>
        <div className="flex-shrink-0 px-6 py-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">UPDASH RESPONDER</h1>
          <p className="text-gray-400 text-sm mt-1">AI Upwork Assistant</p>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-4 space-y-2">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center px-5 py-3 text-sm font-medium rounded-lg transition-all ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-xl mr-4">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </nav>

          {/* Upwork Connection Card */}
          <div className="px-6 mt-8">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Upwork Account</h3>

              {loadingConnection ? (
                <p className="text-gray-400 text-center py-4">Checking...</p>
              ) : upworkConnected ? (
                <div className="space-y-4">
                  <p className="text-green-400 font-medium flex items-center">
                    <span className="text-2xl mr-2">✅</span>
                    Connected Successfully
                  </p>
                  <p className="text-gray-300 text-sm">
                    Real Upwork jobs are loading
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDisconnectUpwork}
                      className="py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-yellow-400 font-medium flex items-center">
                    <span className="text-2xl mr-2">⚠️</span>
                    Not Connected
                  </p>
                  <p className="text-gray-300 text-sm">
                    Connect to see real jobs from Upwork
                  </p>
                  <button
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white font-bold rounded-lg flex items-center justify-center gap-3"
                  >
                    {connecting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🔗</span>
                        <span>Connect Upwork</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="border-t border-gray-700 bg-gray-800 p-6">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-white font-semibold">{user.name || 'User'}</p>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <span className="text-xl">🚪</span>
                Sign Out
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400">Not logged in</p>
          )}
        </div>
      </div>
    </>
  )
}