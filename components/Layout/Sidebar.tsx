//components/Layout/Sidebar.tsx

'use client'

import pool from '@/lib/database'
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
  const checkConnection = async () => {
    try {
      // ✅ SIMPLE CHECK - Just check if token exists in DB
      const users = await pool.query('SELECT COUNT(*) FROM upwork_accounts')
      const hasToken = parseInt(users.rows[0].count) > 0
      
      setUpworkConnected(hasToken)
      setConnectionStatus(hasToken ? 'connected' : 'idle')
      
      console.log('🔍 Connection check:', hasToken ? 'Connected' : 'Not connected')
    } catch (error) {
      console.error('Connection check error:', error)
      setUpworkConnected(false)
      setConnectionStatus('error')
    }
  }
  
  checkConnection()
}, [])

const handleConnectUpwork = async () => {
  setConnecting(true)
  setConnectionStatus('connecting')
  
  try {
    // ✅ Get OAuth URL from NEW endpoint
    const response = await fetch('/api/upwork/auth') // NOTICE: '/auth' endpoint
    const data = await response.json()

    if (response.ok && data.success && data.url) {
      console.log('🔗 Opening Upwork OAuth URL:', data.url)
      
      // Open in same tab (better for mobile)
      window.location.href = data.url
      
    } else {
      throw new Error(data.error || 'Failed to get OAuth URL')
    }
  } catch (error) {
    console.error('❌ Error connecting Upwork:', error)
    setConnectionStatus('error')
    alert('❌ Failed to connect Upwork: ' + (error as Error).message)
    setConnecting(false)
  }
}

  const handleDisconnectUpwork = async () => {
    try {
      setUpworkConnected(false)
      setConnectionStatus('idle')
      console.log('🔌 Upwork disconnected')
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
                  ? 'Your Upwork account is connected and ready to use.' 
                  : 'Connect your Upwork account to access real job data and send proposals directly.'
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
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   connectionStatus === 'error' ? 'Connection Error' : 'Not Connected'}
                </span>
              </div>

              <button 
                onClick={upworkConnected ? handleDisconnectUpwork : handleConnectUpwork}
                disabled={connecting}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                  upworkConnected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                } ${connecting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {connecting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </div>
                ) : upworkConnected ? (
                  '🔌 Disconnect Upwork'
                ) : (
                  '🔗 Connect Upwork'
                )}
              </button>
            </div>
          </div>

          {/* AI Training Progress */}
          <div className="px-4 mt-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">AI Training Progress</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Proposals Generated</span>
                  <span className="font-semibold text-white">48</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">User Edits</span>
                  <span className="font-semibold text-white">23</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">AI Learning Score</span>
                  <span className="font-semibold text-green-400">85%</span>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Training Progress</span>
                    <span>85%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: '85%' }}
                    ></div>
                  </div>
                </div>
              </div>
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