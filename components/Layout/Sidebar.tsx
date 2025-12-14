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

  // ✅ Upwork connection status check karo
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkConnected(data.connected || false)
    } catch (error) {
      console.error('Connection status error:', error)
      setUpworkConnected(false)
    } finally {
      setLoadingConnection(false)
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '🤖' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      // ✅ Use server-generated OAuth URL
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL')
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect Upwork?')) return
    
    try {
      const response = await fetch('/api/upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setUpworkConnected(false)
        alert('✅ Upwork disconnected successfully')
        window.location.reload()
      } else {
        alert('Failed to disconnect: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  return (
    <>
      {/* Mobile Sidebar Overlay */}
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
        {/* Header Section */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">UPDASH RESPONDER</h1>
              <p className="text-gray-400 text-xs">AI-Powered Upwork Assistant</p>
            </div>
          </div>
        </div>
        
        {/* Navigation Section */}
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

          {/* Upwork Connection Card - DYNAMIC */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">
                {loadingConnection ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking Connection...
                  </div>
                ) : upworkConnected ? '✅ Upwork Connected' : 'Upwork Connection'}
              </h3>
              
              {loadingConnection ? (
                <p className="text-gray-300 text-sm mb-4">Loading status...</p>
              ) : upworkConnected ? (
                <div>
                  <p className="text-green-300 text-sm mb-4">
                    Your Upwork account is connected. You can see real jobs and send proposals.
                  </p>
                  <button 
                    onClick={handleDisconnectUpwork}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    🔗 Disconnect Upwork
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-300 text-sm mb-4">
                    Connect your Upwork account to access real jobs and send proposals.
                  </p>
                  <button 
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Connecting...
                      </div>
                    ) : (
                      '🔗 Connect Upwork'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
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