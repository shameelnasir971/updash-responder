//components/Layout/Sidebar.tsx

'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface User {
  id: number
  name: string
  email: string
  company_name: string
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
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '⚡' },
    { name: 'History', href: '/dashboard/history', icon: '📝' }, 
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  const isActive = (path: string) => pathname === path

  // Check Upwork connection status
  useEffect(() => {
    checkConnectionStatus()
    
    // Check every 30 seconds
    const interval = setInterval(checkConnectionStatus, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      if (response.ok) {
        const data = await response.json()
        const connected = data.connected === true
        
        setUpworkConnected(connected)
        setConnectionStatus(connected ? 'connected' : 'idle')
        
        if (connected) {
          console.log('✅ Upwork connected:', data)
        }
      }
    } catch (error) {
      console.error('Connection check error:', error)
      setUpworkConnected(false)
      setConnectionStatus('error')
    }
  }

  const handleConnectUpwork = async () => {
    if (connecting) return
    
    setConnecting(true)
    setConnectionStatus('connecting')
    
    try {
      // Get OAuth URL
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Failed to get OAuth URL')
      }

      console.log('Opening Upwork auth URL...')
      
      // **CRITICAL FIX: Open in same tab instead of popup**
      // Popups are blocked by browsers, same tab works better
      window.location.href = data.url
      
      // Don't set connecting to false - page will redirect
      // The checkConnectionStatus will update when user returns
      
    } catch (error: any) {
      console.error('❌ Connection error:', error)
      setConnectionStatus('error')
      setConnecting(false)
      
      // Fallback: Direct Upwork OAuth URL
      const directUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=b2cf4bfa369cac47083f664358d3accb&response_type=code&redirect_uri=https://updash.shameelnasir.com/api/upwork/callback&scope=search:jobs%20read:jobs`
      
      if (confirm('API failed. Open Upwork directly?')) {
        window.location.href = directUrl
      }
    }
  }

  const handleDisconnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/disconnect', {
        method: 'POST'
      })
      
      if (response.ok) {
        setUpworkConnected(false)
        setConnectionStatus('idle')
        console.log('🔌 Upwork disconnected')
        router.refresh()
      }
    } catch (error) {
      console.error('Error disconnecting Upwork:', error)
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
              <h1 className="text-xl font-bold text-white">UPWORK RESPONDER</h1>
              <p className="text-gray-400 text-xs">AI Upwork Assistant</p>
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
                  isActive(item.href) 
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
              <p className="text-gray-300 text-sm mb-4">
                {upworkConnected 
                  ? '✅ Your Upwork account is connected. Real jobs are loading.' 
                  : 'Connect your Upwork account to access real job data.'
                }
              </p>
              
              {/* Connection Status Indicator */}
              <div className="flex items-center mb-3">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-sm text-gray-300">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'connecting' ? 'Redirecting to Upwork...' :
                   connectionStatus === 'error' ? 'Connection Error' : 'Not Connected'}
                </span>
              </div>

              <button 
                onClick={upworkConnected ? handleDisconnectUpwork : handleConnectUpwork}
                disabled={connecting}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
                  upworkConnected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                } ${connecting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : upworkConnected ? (
                  '🔌 Disconnect Upwork'
                ) : (
                  '🔗 Connect Upwork Account'
                )}
              </button>
              
              {!upworkConnected && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  You'll be redirected to Upwork for authorization
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="px-4 mt-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Jobs Available</span>
                  <span className="font-semibold text-white">24</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Response Rate</span>
                  <span className="font-semibold text-green-400">78%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Avg. Proposal Time</span>
                  <span className="font-semibold text-white">2.3 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User & Sign Out */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          {user && (
            <div className="mb-3 px-2">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
              <p className="text-xs text-gray-500 mt-1">{user.company_name}</p>
            </div>
          )}
          
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
          >
            <span className="mr-2">🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}