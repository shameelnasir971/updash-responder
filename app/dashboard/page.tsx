// app/dashboard/page.tsx - SIMPLE VERSION
'use client'

import Sidebar from '@/components/Layout/Sidebar'
import { useState, useEffect } from 'react'
// import Sidebar from '../../../components/Layout/Sidebar'

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface Job {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  client: {
    name: string
    rating: number
    country: string
    totalSpent: number
    totalHires: number
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  duration?: string
  source?: string
  isRealJob?: boolean
}

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        // Login page pe redirect
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  // ✅ SIMPLE LOAD JOBS FUNCTION
  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      const response = await fetch('/api/upwork/jobs')
      const data = await response.json()
      
      console.log('Jobs response:', data)
      
      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0 && data.message) {
          setConnectionError(data.message)
        }
      } else {
        setConnectionError(data.error || 'Failed to load jobs')
        setJobs([])
      }
    } catch (error: any) {
      console.error('Load jobs error:', error)
      setConnectionError('Connection error')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Logout error:', error)
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
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        handleSignOut={handleSignOut}
      />
      
      <div className="lg:pl-80">
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
            <p className="text-sm text-gray-600">
              {upworkConnected ? 'Real Upwork jobs' : 'Connect Upwork to see real jobs'}
            </p>
          </div>

          {/* Error Message */}
          {connectionError && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6">
              {connectionError}
              <button 
                onClick={loadJobs}
                className="ml-4 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Jobs List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {upworkConnected ? 'Upwork Jobs' : 'Connect Upwork'}
                </h2>
                <button 
                  onClick={loadJobs}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Refresh Jobs
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {jobsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4 text-6xl">💼</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {upworkConnected 
                      ? 'Try refreshing or check Upwork directly.' 
                      : 'Connect your Upwork account to see real jobs.'}
                  </p>
                  <button 
                    onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Browse Upwork
                  </button>
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="p-6 hover:bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">{job.title}</h3>
                    <p className="text-gray-600 text-sm mb-3">
                      Client: {job.client.name} • {job.postedDate} • {job.client.country}
                    </p>
                    <p className="text-gray-700 mb-3">{job.description.substring(0, 200)}...</p>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-green-700">{job.budget}</span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Generate Proposal
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}