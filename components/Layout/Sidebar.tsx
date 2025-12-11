// components/Layout/Sidebar.tsx - SIMPLE VERSION
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
  const [upworkStatus, setUpworkStatus] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check Upwork connection status
  useEffect(() => {
    checkUpworkStatus()
  }, [])

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkStatus(data.connected || false)
    } catch (error) {
      console.log('Status check failed')
    }
  }

  // Navigation items
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Proposals', href: '/dashboard/proposals', icon: '📝' },
    { name: 'Filters', href: '/dashboard/filters', icon: '⚡' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ]

  // Handle Upwork connection
  const handleConnectUpwork = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to get auth URL')
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
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

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        w-80 bg-gradient-to-b from-gray-900 to-gray-800
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0
        flex flex-col shadow-2xl
      `}>
        
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center">
            <div className="bg-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white text-xl font-bold">U</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">UpDash AI</h1>
              <p className="text-gray-400 text-xs">Upwork Automation Assistant</p>
            </div>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="mt-6 p-3 bg-gray-800 rounded-lg">
              <p className="text-white font-medium">{user.name}</p>
              <p className="text-gray-400 text-sm truncate">{user.email}</p>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-4 space-y-2">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href)
                  setSidebarOpen(false)
                }}
                className={`group w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white shadow-lg transform scale-[1.02]' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:shadow-md'
                }`}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                <span className="truncate">{item.name}</span>
                {pathname === item.href && (
                  <span className="ml-auto w-2 h-2 bg-white rounded-full"></span>
                )}
              </button>
            ))}
          </nav>

          {/* Upwork Connection Card */}
          <div className="px-4 mt-6">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
              <div className="flex items-center mb-3">
                <div className={`w-3 h-3 rounded-full mr-2 ${upworkStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h3 className="text-lg font-semibold text-white">
                  {upworkStatus ? 'Upwork Connected' : 'Connect Upwork'}
                </h3>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                {upworkStatus 
                  ? 'Your Upwork account is connected and ready.' 
                  : 'Connect to access real job data and proposals.'}
              </p>
              
              <button 
                onClick={upworkStatus ? checkUpworkStatus : handleConnectUpwork}
                disabled={loading}
                className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all ${
                  upworkStatus
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
                } disabled:opacity-50`}
              >
                {loading ? 'Connecting...' : upworkStatus ? '✅ Connected' : '🔗 Connect Upwork'}
              </button>
              
              {upworkStatus && (
                <button 
                  onClick={() => router.push('/dashboard/jobs')}
                  className="w-full mt-2 py-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  View Jobs →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            <span className="text-lg mr-3">🚪</span>
            <span>Sign Out</span>
          </button>
          
          <div className="text-center mt-3">
            <p className="text-gray-400 text-xs">
              UpDash v1.0 • Real API Mode
            </p>
          </div>
        </div>
      </div>
    </>
  )
}