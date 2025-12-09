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
// app/dashboard/page.tsx - loadJobs function update
const loadJobs = async () => {
  setJobsLoading(true)
  setConnectionError('')
  
  try {
    console.log('🔄 Loading jobs...')
    const response = await fetch('/api/upwork/jobs')
    const data = await response.json()

    console.log('📊 Jobs Response:', {
      success: data.success,
      count: data.jobs?.length,
      source: data.source,
      message: data.message
    })

    if (data.success) {
      if (Array.isArray(data.jobs)) {
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs)
        setUpworkConnected(data.upworkConnected)
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalJobs: data.jobs.length,
          matchedJobs: data.jobs.length
        }))
        
        if (data.jobs.length > 0) {
          console.log(`✅ ${data.jobs.length} real jobs loaded`)
        } else {
          setConnectionError(data.message || 'No jobs found')
        }
      }
    } else {
      setConnectionError(data.error || 'Failed to load jobs')
      setJobs([])
    }
    
  } catch (error: any) {
    console.error('❌ Load jobs error:', error)
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

  function handleGenerateProposalClick(job: Job): void {
    throw new Error('Function not implemented.')
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
              // app/dashboard/page.tsx - Jobs display section
{jobs.length === 0 ? (
  <div className="text-center py-12">
    <div className="text-gray-400 mb-4 text-6xl">
      {upworkConnected ? '🔍' : '🔗'}
    </div>
    <h3 className="text-lg font-semibold text-gray-700 mb-2">
      {upworkConnected ? 'No Active Jobs Found' : 'Connect Upwork Account'}
    </h3>
    <p className="text-gray-500 mb-6">
      {upworkConnected 
        ? 'Try refreshing or visit Upwork directly for more jobs.'
        : 'Connect your Upwork account to see real job listings.'}
    </p>
    <div className="flex gap-3 justify-center">
      <button 
        onClick={loadJobs} 
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        {upworkConnected ? '🔄 Refresh' : 'Connect Upwork'}
      </button>
      <button 
        onClick={() => window.open('https://www.upwork.com/nx/find-work/best-matches', '_blank')}
        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
      >
        Browse Upwork
      </button>
    </div>
  </div>
) : (
  jobs.map((job) => (
    <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors border-b border-gray-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-lg">
              {job.title}
            </h3>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {job.source === 'upwork_rest' ? 'Real Job' : 'Public Feed'}
            </span>
            {job.verified && (
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-medium">{job.client.name}</span>
            <span className="mx-2">•</span>
            <span>{job.postedDate}</span>
            <span className="mx-2">•</span>
            <span>{job.client.country}</span>
          </div>

          <p className="text-gray-700 mb-3">{job.description}</p>

          <div className="flex flex-wrap gap-1 mb-3">
            {job.skills.map((skill, index) => (
              <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded border border-gray-300">
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="font-semibold text-green-700">{job.budget}</span>
            <span>Proposals: {job.proposals}</span>
            <span>Rating: {job.client.rating}/5</span>
            {job.category && <span>Category: {job.category}</span>}
          </div>
        </div>

        <button 
          onClick={() => handleGenerateProposalClick(job)}
          className="ml-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm font-semibold min-w-[140px]"
        >
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

function setStats(arg0: (prev: any) => any) {
  throw new Error('Function not implemented.')
}
