// app/dashboard/page.tsx - SIMPLE VERSION
'use client'

import { useState, useEffect } from 'react'

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
  jobType?: string
  source: string
  isRealJob: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalProposals: 0,
    avgBudget: 0
  })

  // Check authentication
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadJobs() // Auto-load jobs after auth
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  // Load jobs from Upwork
  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading REAL Upwork jobs...')
      const response = await fetch('/api/upwork/jobs')
      const data = await response.json()

      console.log('📊 Jobs Response:', {
        success: data.success,
        count: data.jobs?.length,
        message: data.message
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Calculate statistics
        if (data.jobs?.length > 0) {
          const totalProposals = data.jobs.reduce((sum: number, job: Job) => sum + job.proposals, 0)
          const budgets = data.jobs
            .map((j: { budget: string }) => j.budget.replace(/[^0-9]/g, ''))
            .filter((b: any) => b)
            .map(Number)
          const avgBudget = budgets.length > 0 ? 
            Math.round(budgets.reduce((a: any, b: any) => a + b) / budgets.length) : 0
            
          setStats({
            totalJobs: data.jobs.length,
            totalProposals: totalProposals,
            avgBudget: avgBudget
          })
        }
        
        if (data.jobs?.length === 0) {
          setConnectionError('No active jobs found. Try changing search criteria.')
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Connection error. Please try again.')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  // Connect to Upwork
  const handleConnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Error generating auth URL')
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // Generate proposal for a job
  const handleGenerateProposal = (jobId: string) => {
    alert(`Generating proposal for job: ${jobId}`)
    // TODO: Implement proposal generation
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
      {/* Main Content */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back, <span className="font-semibold">{user?.name}</span>
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {!upworkConnected ? (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
                >
                  🔗 Connect Upwork Account
                </button>
              ) : (
                <div className="text-right">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    ✅ Upwork Connected
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {upworkConnected && jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-gray-500 text-sm font-medium">Total Jobs</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalJobs}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-gray-500 text-sm font-medium">Total Proposals</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProposals}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-gray-500 text-sm font-medium">Avg Budget</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">${stats.avgBudget}</p>
            </div>
          </div>
        )}

        {/* Connection Status */}
        {connectionError && (
          <div className={`mb-6 p-4 rounded-lg ${connectionError.includes('SUCCESS') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-yellow-100 border border-yellow-400 text-yellow-700'}`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={loadJobs}
                className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Jobs Section */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {upworkConnected ? 'Upwork Marketplace Jobs' : 'Connect Upwork Account'}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {upworkConnected 
                    ? 'Real jobs fetched from Upwork API' 
                    : 'Connect your Upwork account to see available jobs'}
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Browse Upwork
                </button>
                <button 
                  onClick={loadJobs}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Loading...' : '🔄 Refresh Jobs'}
                </button>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="divide-y divide-gray-100">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading REAL Upwork jobs...</p>
                <p className="text-gray-400 text-sm mt-2">Fetching from Upwork API</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                {upworkConnected ? (
                  <>
                    <div className="text-gray-400 mb-4 text-6xl">💼</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Jobs Found</h3>
                    <p className="text-gray-500 mb-6">
                      Try refreshing or change your search criteria.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-gray-400 mb-4 text-6xl">🔗</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Upwork Not Connected</h3>
                    <p className="text-gray-500 mb-6">
                      Connect your Upwork account to see real job listings.
                    </p>
                    <button 
                      onClick={handleConnectUpwork}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
                    >
                      Connect Upwork Account
                    </button>
                  </>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
                        {job.verified && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            ✅ Verified
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600 mb-3">
                        <span className="mr-4">👤 {job.client.name}</span>
                        <span className="mr-4">📍 {job.client.country}</span>
                        <span className="mr-4">⭐ {job.client.rating} Rating</span>
                        <span>📅 {job.postedDate}</span>
                      </div>
                      
                      <p className="text-gray-700 mb-4 line-clamp-2">
                        {job.description}
                      </p>
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="font-bold text-green-700 text-xl mb-1">
                        {job.budget}
                      </div>
                      <div className="text-gray-500 text-sm">
                        {job.proposals} proposals
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-100"
                        >
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 4} more
                        </span>
                      )}
                      <span className="text-gray-500 text-sm ml-2">
                        {job.jobType} • {job.source === 'upwork' ? 'Real Upwork Job' : 'Mock Data'}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => window.open(`https://www.upwork.com/jobs/${job.id.replace('~', '_')}`, '_blank')}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        View on Upwork
                      </button>
                      <button 
                        onClick={() => handleGenerateProposal(job.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Generate Proposal
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>UpDash Responder • Real Upwork API Integration • {new Date().getFullYear()}</p>
          <p className="mt-1">
            {jobs.length > 0 ? `Showing ${jobs.length} real jobs from Upwork` : 'No jobs to display'}
          </p>
        </div>
      </div>
    </div>
  )
}