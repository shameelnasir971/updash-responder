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
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [loadingConnection, setLoadingConnection] = useState(true)

  // ✅ SAFE USER ACCESS
  const userName = user?.name || 'User'
  const userEmail = user?.email || ''
  const userInitial = userName ? userName.charAt(0).toUpperCase() : 'U'

  // Navigation
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '🤖' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  // Check connection
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkConnected(data.connected || false)
    } catch (error) {
      setUpworkConnected(false)
    } finally {
      setLoadingConnection(false)
    }
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const clientId = 'b2cf4bfa369cac47083f664358d3accb'
      const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
      
      const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
      
      window.location.href = authUrl
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  const handleDisconnectUpwork = async () => {
    if (!confirm('Disconnect Upwork?')) return
    
    try {
      const response = await fetch('/api/upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      if (response.ok) {
        setUpworkConnected(false)
        window.location.reload()
      }
    } catch (error) {
      console.error('Disconnect error:', error)
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
              <p className="text-gray-400 text-xs">AI Upwork Assistant</p>
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

          {/* Upwork Connection */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">
                {loadingConnection ? 'Checking...' : 
                 upworkConnected ? '✅ Upwork Connected' : 'Upwork Connection'}
              </h3>
              
              {upworkConnected ? (
                <div>
                  <p className="text-green-300 text-sm mb-4">
                    Connected to Upwork API
                  </p>
                  <button 
                    onClick={handleDisconnectUpwork}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Disconnect Upwork
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-300 text-sm mb-4">
                    Connect to fetch real Upwork jobs
                  </p>
                  <button 
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {connecting ? 'Connecting...' : '🔗 Connect Upwork'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ FIXED: User Info - SAFE ACCESS */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          <div className="mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {userName}
                </p>
                {userEmail && (
                  <p className="text-xs text-gray-400 truncate">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <span className="text-lg mr-3">🚪</span>
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}