// components/Layout/Sidebar.tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  user,
  handleSignOut
}: any) {
  const router = useRouter()
  const pathname = usePathname()
  const [connecting, setConnecting] = useState(false)
  const [upworkStatus, setUpworkStatus] = useState({
    connected: false,
    loading: true
  })

  // Check Upwork connection status
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkStatus({
        connected: data.connected || false,
        loading: false
      })
    } catch (error) {
      setUpworkStatus({ connected: false, loading: false })
    }
  }

  const handleConnectUpwork = async () => {
    if (upworkStatus.connected) {
      // Disconnect logic
      if (confirm('Are you sure you want to disconnect Upwork?')) {
        try {
          setConnecting(true)
          const response = await fetch('/api/upwork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'disconnect' })
          })
          
          const data = await response.json()
          
          if (data.success) {
            setUpworkStatus({ connected: false, loading: false })
            alert('Upwork disconnected successfully!')
          } else {
            alert('Failed to disconnect Upwork: ' + data.error)
          }
        } catch (error) {
          alert('Network error while disconnecting')
        } finally {
          setConnecting(false)
        }
      }
    } else {
      // Connect logic
      setConnecting(true)
      try {
        // Get OAuth URL from our updated API
        const response = await fetch('/api/upwork/auth')
        const data = await response.json()
        
        if (data.success && data.url) {
          window.location.href = data.url
        } else {
          alert('Failed to generate OAuth URL. Check console.')
          console.error('OAuth error:', data.error)
          setConnecting(false)
        }
      } catch (error: any) {
        alert('Error: ' + error.message)
        setConnecting(false)
      }
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '⚙️' },
    { name: 'Settings', href: '/dashboard/settings', icon: '🔧' },
  ]

  return (
    <>
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50
        w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0
        flex flex-col
      `}>
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">UPDASH RESPONDER</h1>
              <p className="text-gray-400 text-xs">Upwork Assistant</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href)
                  setSidebarOpen(false)
                }}
                className={`group w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </nav>

          {/* Upwork Connection Card */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Upwork Connection</h3>
              
              {upworkStatus.loading ? (
                <div className="flex items-center space-x-2 text-gray-300">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Checking status...</span>
                </div>
              ) : (
                <>
                  <p className="text-gray-300 text-sm mb-4">
                    {upworkStatus.connected 
                      ? `✅ Connected to Upwork` 
                      : `❌ Not connected to Upwork`}
                  </p>
                  
                  <button 
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                      upworkStatus.connected
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {connecting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        Processing...
                      </>
                    ) : (
                      upworkStatus.connected ? '🔗 Disconnect Upwork' : '🔗 Connect Upwork'
                    )}
                  </button>
                  
                  {upworkStatus.connected && (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full mt-3 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      View Jobs
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          {user && (
            <div className="flex items-center mb-4 px-2">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0) || 'U'}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-lg"
          >
            <span className="text-lg mr-3">🚪</span>
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}