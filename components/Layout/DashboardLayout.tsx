// components/Layout/DashboardLayout.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      // ✅ FIX: Correct way to get user data
      if (data.authenticated && data.user) {
        console.log('✅ User authenticated:', data.user)
        setUser({
          id: data.user.id || 0,
          name: data.user.name || 'User',
          email: data.user.email || '',
          company_name: data.user.company_name || ''
        })
      } else {
        router.push('/auth/login')
      }
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      router.push('/auth/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user} // ✅ Now guaranteed to have proper structure
        handleSignOut={handleSignOut}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar 
          user={user}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        
        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}