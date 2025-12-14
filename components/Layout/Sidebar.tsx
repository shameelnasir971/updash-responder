// components/Layout/Sidebar.tsx 
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
  
  // State Management
  const [connecting, setConnecting] = useState(false)
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [loadingConnection, setLoadingConnection] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showReconnectModal, setShowReconnectModal] = useState(false)
  const [reconnectStatus, setReconnectStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle')

  // Navigation Items
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '🤖' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  // ✅ Check Upwork Connection Status
  useEffect(() => {
    checkUpworkStatus()
    
    // Auto-check every 5 minutes
    const interval = setInterval(() => {
      if (upworkConnected) {
        checkUpworkStatus()
      }
    }, 300000) // 5 minutes
    
    return () => clearInterval(interval)
  }, [])

  const checkUpworkStatus = async () => {
    if (!user) return
    
    setLoadingConnection(true)
    setErrorMessage('')
    
    try {
      console.log('🔍 Checking Upwork connection status...')
      
      // First check simple status
      const statusResponse = await fetch('/api/upwork/status')
      const statusData = await statusResponse.json()
      
      if (statusData.success && statusData.connected) {
        console.log('✅ Upwork is connected (basic check)')
        
        // Now test if token actually works
        const testResponse = await fetch('/api/upwork/jobs')
        const testData = await testResponse.json()
        
        if (testResponse.ok && testData.success) {
          setUpworkConnected(true)
          setErrorMessage('')
          console.log('✅ Token is valid and working')
        } else {
          // Token exists but is invalid/expired
          setUpworkConnected(false)
          setErrorMessage(testData.message || 'Token expired or invalid')
          console.warn('⚠️ Token exists but not working:', testData.message)
        }
      } else {
        setUpworkConnected(false)
        setErrorMessage('Not connected to Upwork')
        console.log('ℹ️ Upwork not connected')
      }
    } catch (error: any) {
      console.error('❌ Status check error:', error)
      setUpworkConnected(false)
      setErrorMessage('Failed to check connection')
    } finally {
      setLoadingConnection(false)
    }
  }

  // ✅ Handle Connect/Reconnect Upwork
  const handleConnectUpwork = async () => {
    setConnecting(true)
    setErrorMessage('')
    
    try {
      console.log('🔄 Initiating Upwork connection...')
      
      // First try to get OAuth URL
      const authResponse = await fetch('/api/upwork/auth')
      const authData = await authResponse.json()
      
      if (authData.success && authData.url) {
        console.log('🔗 Redirecting to Upwork OAuth...')
        window.location.href = authData.url
      } else {
        throw new Error(authData.error || 'Failed to generate OAuth URL')
      }
    } catch (error: any) {
      console.error('❌ Connection error:', error)
      setErrorMessage('Failed to connect: ' + error.message)
      setConnecting(false)
    }
  }

  // ✅ Handle Disconnect Upwork
  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect Upwork?\n\nYou will need to reconnect to see real jobs.')) {
      return
    }
    
    try {
      console.log('🔄 Disconnecting Upwork...')
      
      const response = await fetch('/api/upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setUpworkConnected(false)
        setErrorMessage('')
        alert('✅ Upwork disconnected successfully!')
        
        // Refresh dashboard
        setTimeout(() => {
          if (pathname === '/dashboard') {
            window.location.reload()
          } else {
            router.push('/dashboard')
          }
        }, 1000)
      } else {
        throw new Error(data.error || 'Failed to disconnect')
      }
    } catch (error: any) {
      console.error('❌ Disconnect error:', error)
      alert('Failed to disconnect: ' + error.message)
    }
  }

  // ✅ Handle Manual Reconnect (with Refresh Token)
  const handleManualReconnect = async () => {
    setReconnectStatus('connecting')
    setErrorMessage('')
    
    try {
      console.log('🔄 Attempting token refresh...')
      
      // Try to refresh token first
      const refreshResponse = await fetch('/api/upwork/refresh-token', {
        method: 'POST'
      })
      
      const refreshData = await refreshResponse.json()
      
      if (refreshData.success) {
        // Token refreshed successfully
        setReconnectStatus('success')
        setUpworkConnected(true)
        
        setTimeout(() => {
          setShowReconnectModal(false)
          window.location.reload()
        }, 1500)
      } else if (refreshData.requiresReconnect) {
        // Need full reconnection
        setReconnectStatus('error')
        setErrorMessage('Please connect Upwork account again')
        setTimeout(() => {
          setShowReconnectModal(false)
          handleConnectUpwork()
        }, 2000)
      } else {
        throw new Error(refreshData.message || 'Refresh failed')
      }
    } catch (error: any) {
      console.error('❌ Reconnect error:', error)
      setReconnectStatus('error')
      setErrorMessage(error.message || 'Failed to reconnect')
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

          {/* Upwork Connection Card */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">
                {loadingConnection ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking Status...
                  </div>
                ) : upworkConnected ? '✅ Upwork Connected' : '🔗 Upwork Connection'}
              </h3>
              
              {loadingConnection ? (
                <p className="text-gray-300 text-sm mb-4">Checking connection status...</p>
              ) : upworkConnected ? (
                <div>
                  <div className="mb-4">
                    <p className="text-green-300 text-sm mb-2">
                      Your Upwork account is connected and ready!
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="text-green-400">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Data Source:</span>
                        <span className="text-blue-400">Real Upwork API</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handleDisconnectUpwork}
                      className="flex-1 py-2 px-4 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Disconnect
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="flex-1 py-2 px-4 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                      <p className="text-red-300 text-sm">
                        {errorMessage.includes('expired') || errorMessage.includes('invalid') ? (
                          <>
                            <span className="font-medium">⚠️ Token Expired</span>
                            <br />
                            <span className="text-xs">Your Upwork connection needs to be refreshed.</span>
                          </>
                        ) : (
                          errorMessage
                        )}
                      </p>
                      
                      {(errorMessage.includes('expired') || errorMessage.includes('invalid')) && (
                        <button
                          onClick={() => setShowReconnectModal(true)}
                          className="mt-2 text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                        >
                          Fix Connection
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <p className="text-gray-300 text-sm">
                      {errorMessage ? 'Reconnect to access:' : 'Connect to access:'}
                    </p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1 pl-4">
                      <li>• Real Upwork jobs</li>
                      <li>• Live job feeds</li>
                      <li>• Send proposals directly</li>
                      <li>• AI-powered applications</li>
                    </ul>
                  </div>
                  
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
                    ) : errorMessage ? (
                      '🔗 Reconnect Upwork'
                    ) : (
                      '🔗 Connect Upwork'
                    )}
                  </button>
                  
                  {!errorMessage && (
                    <p className="text-xs text-gray-500 text-center mt-3">
                      One-time authorization required
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Section (Optional) */}
          {upworkConnected && !loadingConnection && (
            <div className="px-4 mt-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      router.push('/dashboard')
                      setSidebarOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                  >
                    🚀 Browse New Jobs
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard/prompts')
                      setSidebarOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                  >
                    ⚙️ Update Profile Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Info & Sign Out */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          {user && (
            <div className="mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
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

      {/* Reconnect Modal */}
      {showReconnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Connection Issue Detected</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                {reconnectStatus === 'idle' ? (
                  'Your Upwork connection token may have expired. Would you like to attempt an automatic refresh?'
                ) : reconnectStatus === 'connecting' ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Attempting to refresh connection...</span>
                  </div>
                ) : reconnectStatus === 'success' ? (
                  <span className="text-green-400">✅ Connection refreshed successfully!</span>
                ) : (
                  <span className="text-red-400">❌ Could not refresh. Please reconnect manually.</span>
                )}
              </p>
              
              {reconnectStatus === 'idle' && (
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={() => setShowReconnectModal(false)}
                    className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualReconnect}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Refresh Connection
                  </button>
                </div>
              )}
              
              {reconnectStatus === 'error' && (
                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={handleConnectUpwork}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    🔗 Connect Upwork Again
                  </button>
                </div>
              )}
              
              {(reconnectStatus === 'success' || reconnectStatus === 'error') && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowReconnectModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .connected-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>
    </>
  )
}