// components/Layout/Sidebar.tsx - SIMPLE VERSION
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  user: any
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
  const [connecting, setConnecting] = useState(false)
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('')
  
  // ✅ Check Upwork connection status
  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      
      if (data.success && data.connected) {
        setUpworkConnected(true)
        setConnectionStatus('✅ Connected')
      } else {
        setUpworkConnected(false)
        setConnectionStatus('❌ Not Connected')
      }
    } catch (error) {
      setUpworkConnected(false)
      setConnectionStatus('❌ Error checking')
    }
  }
  
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  // ✅ Navigation items
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Filters', href: '/dashboard/filters', icon: '🔍' },
    { name: 'Proposals', href: '/dashboard/proposals', icon: '📝' },
    { name: 'History', href: '/dashboard/history', icon: '📅' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  // ✅ Handle Connect Upwork - SIMPLE VERSION
  const handleConnectUpwork = async () => {
    setConnecting(true)
    setConnectionStatus('Connecting...')
    
    try {
      // ✅ REQUIRED SCOPES for job access
      const clientId = 'b2cf4bfa369cac47083f664358d3accb'
      const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
      
      // Scopes needed for job access
      const scopes = encodeURIComponent('jobs') // Main scope for job posting access
      
      // Build OAuth URL with scopes
      const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`
      
      console.log('🔗 Redirecting to Upwork OAuth...')
      console.log('🎯 Scopes requested: jobs')
      
      window.location.href = authUrl
      
    } catch (error: any) {
      console.error('❌ OAuth error:', error)
      alert('Connection error: ' + error.message)
      setConnectionStatus('❌ Failed')
      setConnecting(false)
    }
  }

  // ✅ Handle Disconnect Upwork
  const handleDisconnectUpwork = async () => {
    try {
      setConnectionStatus('Disconnecting...')
      
      const response = await fetch('/api/upwork/disconnect', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setUpworkConnected(false)
        setConnectionStatus('❌ Disconnected')
        alert('Upwork account disconnected successfully')
      }
    } catch (error) {
      alert('Error disconnecting Upwork account')
      setConnectionStatus('❌ Error')
    }
  }

  // ✅ Refresh jobs
  const handleRefreshJobs = () => {
    // Trigger a page refresh or call jobs API
    window.location.reload()
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
        w-80 bg-gradient-to-b from-gray-900 to-gray-800 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0
        flex flex-col shadow-xl
      `}>
        
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">UPWORK AI</h1>
              <p className="text-gray-400 text-sm">Automated Job Responder</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="mt-6 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div className="ml-3">
                  <p className="text-white font-medium">{user.name || 'User'}</p>
                  <p className="text-gray-400 text-xs truncate">{user.email || ''}</p>
                </div>
              </div>
            </div>
          )}
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
                    ? 'bg-blue-600 text-white shadow-lg transform scale-[1.02]' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:shadow-md'
                }`}
              >
                <span className="text-lg mr-3">{item.icon}</span>
                <span className="truncate">{item.name}</span>
                {pathname === item.href && (
                  <span className="ml-auto w-2 h-2 bg-blue-300 rounded-full"></span>
                )}
              </button>
            ))}
          </nav>

          {/* Upwork Connection Card */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Upwork Connection</h3>
                <div className={`px-2 py-1 text-xs rounded-full ${
                  upworkConnected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {upworkConnected ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                {upworkConnected 
                  ? 'Your Upwork account is connected. You can fetch real jobs.' 
                  : 'Connect your Upwork account to access real job postings.'}
              </p>
              
              {connectionStatus && (
                <p className="text-sm mb-3 p-2 bg-gray-900 rounded text-center">
                  Status: <span className="font-medium">{connectionStatus}</span>
                </p>
              )}
              
              <div className="space-y-2">
                {upworkConnected ? (
                  <>
                    <button 
                      onClick={handleRefreshJobs}
                      className="w-full py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      🔄 Refresh Jobs
                    </button>
                    <button 
                      onClick={handleDisconnectUpwork}
                      className="w-full py-2 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      🚫 Disconnect Upwork
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleConnectUpwork}
                    disabled={connecting}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
                      connecting 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {connecting ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        Connecting...
                      </>
                    ) : (
                      <>
                        🔗 Connect Upwork Account
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {!upworkConnected && (
                <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-800 rounded text-xs text-yellow-200">
                  ℹ️ Required permission: <strong>"Read marketplace Job Postings"</strong>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {upworkConnected && (
            <div className="px-4 mt-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => router.push('/dashboard?filter=recent')}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded text-center"
                  >
                    🕐 Recent Jobs
                  </button>
                  <button 
                    onClick={() => router.push('/dashboard?filter=highpay')}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded text-center"
                  >
                    💰 High Paying
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Sign Out */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">v1.0.0</span>
            <span className="text-xs text-gray-400">Upwork AI Assistant</span>
          </div>
          
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg transition-all shadow-lg hover:shadow-red-900/30"
          >
            <span className="text-lg mr-3">🚪</span>
            <span className="truncate">Sign Out</span>
            <span className="ml-auto text-xs opacity-70">({user?.name || 'User'})</span>
          </button>
        </div>
      </div>
    </>
  )
}