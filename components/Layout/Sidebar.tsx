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
  const [checkingConnection, setCheckingConnection] = useState(true)

  // ✅ UPWORK CONNECTION STATUS CHECK
  const checkUpworkConnection = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkConnected(data.connected)
    } catch (error) {
      console.error('Connection check failed:', error)
    } finally {
      setCheckingConnection(false)
    }
  }

  useEffect(() => {
    checkUpworkConnection()
  }, [])

  // ✅ HANDLE UPWORK CONNECT
  const handleConnectUpwork = async () => {
    setConnecting(true)
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to connect Upwork: ' + data.error)
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  // ✅ HANDLE UPWORK DISCONNECT
  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect Upwork account?')) {
      return
    }
    
    setConnecting(true)
    try {
      const response = await fetch('/api/upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      const data = await response.json()
      if (response.ok) {
        setUpworkConnected(false)
        alert('Upwork disconnected successfully!')
      } else {
        alert('Failed to disconnect: ' + data.error)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setConnecting(false)
    }
  }

  // ✅ SIMPLE NAVIGATION
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'History', href: '/dashboard/history', icon: '📝' },
    { name: 'Prompts', href: '/dashboard/prompts', icon: '⚙️' },
  ]

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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Upwork Connection</h3>
                <div className={`w-3 h-3 rounded-full ${upworkConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                {upworkConnected 
                  ? '✅ Your Upwork account is connected' 
                  : 'Connect your Upwork account to access job data'}
              </p>
              
              {checkingConnection ? (
                <div className="w-full py-2 px-4 rounded-lg font-semibold bg-gray-600 text-white text-center">
                  Checking...
                </div>
              ) : (
                <button 
                  onClick={upworkConnected ? handleDisconnectUpwork : handleConnectUpwork}
                  disabled={connecting}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                    upworkConnected 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {connecting ? 'Processing...' : 
                   upworkConnected ? '🚫 Disconnect Upwork' : '🔗 Connect Upwork'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          {user && (
            <div className="mb-3 px-2">
              <p className="text-white font-medium truncate">{user.name}</p>
              <p className="text-gray-400 text-sm truncate">{user.email}</p>
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