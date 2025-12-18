// components/Layout/Sidebar.tsx - FINAL VERSION WITH PROPER UPWORK CONNECT/DISCONNECT
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

  // Check Upwork connection status
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
      } else {
        setUpworkConnected(false)
      }
    } catch (err) {
      console.error('Failed to check Upwork status')
      setUpworkConnected(false)
    } finally {
      setLoadingConnection(false)
    }
  }

  // Connect to Upwork - Get auth URL from API
  const handleConnectUpwork = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/upwork/auth')
      const data = await res.json()

      if (data.success && data.url) {
        // Redirect user to official Upwork login page
        window.location.href = data.url
      } else {
        alert('Failed to get Upwork login link: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error(err)
      alert('Connection failed. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect Upwork
  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect your Upwork account?')) return

    try {
      const res = await fetch('/api/upwork/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        setUpworkConnected(false)
        alert('✅ Upwork account disconnected successfully!')
        // Optional: reload to refresh jobs
        window.location.reload()
      } else {
        alert('Failed to disconnect: ' + data.error)
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
      alert('Disconnect failed. Please try again.')
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0
        flex flex-col
      `}>
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">UPDASH RESPONDER</h1>
          <p className="text-gray-400 text-sm mt-1">AI Upwork Assistant</p>
        </div>
        
        {/* Navigation */}
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

          {/* Upwork Connection Section */}
          <div className="px-6 mt-8">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">
                Upwork Account
              </h3>

              {loadingConnection ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  <p className="text-gray-400 text-sm mt-2">Checking connection...</p>
                </div>
              ) : upworkConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center text-green-400">
                    <span className="text-2xl mr-2">✅</span>
                    <span className="font-medium">Connected to Upwork</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Real jobs are now loading from your Upwork account
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDisconnectUpwork}
                      className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                    >
                      Refresh Jobs
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center text-yellow-400">
                    <span className="text-2xl mr-2">⚠️</span>
                    <span className="font-medium">Not Connected</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Connect your Upwork account to see real jobs
                  </p>
                  <button
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white font-bold rounded-lg transition flex items-center justify-center gap-3"
                  >
                    {connecting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">🔗</span>
                        <span>Connect Upwork Account</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="border-t border-gray-700 bg-gray-800 p-6">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {user.name || 'User'}
                  </p>
                  <p className="text-gray-400 text-sm truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <span className="text-xl">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 mb-3">Not logged in</p>
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}