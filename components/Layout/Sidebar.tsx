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
  const [isUpworkConnected, setIsUpworkConnected] = useState(false)

  // ✅ Upwork connection status check karo
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setIsUpworkConnected(data.connected || false)
    } catch (error) {
      console.log('Status check error:', error)
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '⚙️' },
    { name: 'Settings', href: '/dashboard/settings', icon: '🔧' },
  ]

  const handleConnectDisconnect = async () => {
    if (isUpworkConnected) {
      // ✅ DISCONNECT KARO
      if (confirm('Are you sure you want to disconnect Upwork?')) {
        setConnecting(true)
        try {
          await fetch('/api/upwork/disconnect', { method: 'POST' })
          setIsUpworkConnected(false)
          alert('Upwork disconnected successfully!')
        } catch (error) {
          alert('Disconnect failed')
        } finally {
          setConnecting(false)
        }
      }
    } else {
      // ✅ CONNECT KARO
      setConnecting(true)
      try {
        const response = await fetch('/api/upwork/auth')
        const data = await response.json()
        
        if (data.success && data.url) {
          window.location.href = data.url
        } else {
          alert('Failed to generate OAuth URL')
        }
      } catch (error: any) {
        alert('Error: ' + error.message)
      } finally {
        setConnecting(false)
      }
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
              <p className="text-gray-400 text-xs">Upwork Assistant</p>
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
                {isUpworkConnected ? '✅ Upwork Connected' : '🔗 Connect Upwork'}
              </h3>
              
              <div className="flex items-center mb-3">
                <div className={`w-3 h-3 rounded-full mr-2 ${isUpworkConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-gray-300 text-sm">
                  {isUpworkConnected ? 'Real jobs available' : 'Connect to see real jobs'}
                </p>
              </div>
              
              <button 
                onClick={handleConnectDisconnect}
                disabled={connecting}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                  isUpworkConnected 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {connecting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : isUpworkConnected ? (
                  'Disconnect Upwork'
                ) : (
                  'Connect Upwork'
                )}
              </button>
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