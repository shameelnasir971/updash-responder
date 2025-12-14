// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobPopup from '@/components/JobPopup/JobPopup'

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
  category: string
  jobType: string
  experienceLevel: string
  source: string
  isRealJob: boolean
  _raw?: any
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [lastGeneratedProposal, setLastGeneratedProposal] = useState('')

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
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

const loadJobs = async () => {
  setJobsLoading(true)
  setConnectionError('')
  
  try {
    console.log('🔄 Loading REAL jobs (no mock data)...')
    const response = await fetch('/api/upwork/jobs')
    
    if (response.status === 401) {
      setConnectionError('Session expired. Please login again.')
      window.location.href = '/auth/login'
      return
    }
    
    const data = await response.json()
    console.log('📊 REAL Jobs Response:', {
      success: data.success,
      count: data.jobs?.length,
      message: data.message,
      mockDataUsed: data.debug?.mockDataUsed
    })

    if (data.success) {
      setJobs(data.jobs || [])
      setUpworkConnected(data.upworkConnected || false)
      
      if (data.jobs?.length === 0) {
        setConnectionError('No matching jobs found. Update your prompts settings to see relevant jobs.')
      } else if (data.jobs?.length > 0) {
        // Check if any job has mock data
        const hasMockData = data.jobs.some((job: any) => 
          job.source === 'upwork_simple' || 
          !job.isRealJob || 
          (job.client?.name || '').startsWith('Client ')
        )
        
        if (hasMockData) {
          setConnectionError('⚠️ Some data may not be fully loaded. Connect with support.')
        } else {
          setConnectionError(`✅ Found ${data.jobs.length} REAL jobs matching your criteria!`)
        }
      }
    } else {
      setConnectionError(data.message || 'Failed to load jobs.')
      setJobs([])
    }
    
  } catch (error: any) {
    console.error('❌ Load jobs error:', error)
    setConnectionError('Network error. Please check connection.')
    setJobs([])
  } finally {
    setJobsLoading(false)
  }
}

  const handleConnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
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
      {/* ✅ Main Content WITHOUT extra sidebar */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected 
                  ? '📊 Showing jobs based on your prompts & settings' 
                  : '🔗 Connect Upwork to see personalized jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  🔗 Connect Upwork
                </button>
              )}
              <button 
                onClick={loadJobs}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {jobsLoading ? '🔄 Loading...' : '🔄 Refresh Jobs'}
              </button>
            </div>
          </div>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
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

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Personalized Jobs for You' : 'Connect Upwork First'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length > 0 ? `${jobs.length} jobs found` : 'No jobs found'}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading personalized jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try updating your prompts settings or try different keywords.' 
                    : 'Connect your Upwork account to see personalized jobs.'}
                </p>
                {upworkConnected ? (
                  <button 
                    onClick={() => window.location.href = '/dashboard/prompts'}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    ⚙️ Update Prompts Settings
                  </button>
                ) : (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork Account
                  </button>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded text-sm">
                          {job.budget}
                        </span>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium">{job.client.name}</span> • {job.postedDate} • {job.client.country} •
                          Rating: <span className="font-medium">{job.client.rating} ⭐</span>
                        </span>
                      </div>
                    </div>
                    <button 
                      className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                    >
                      Generate Proposal
                    </button>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">{job.description.substring(0, 250)}...</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className="text-gray-500 text-sm">+{job.skills.length - 3} more</span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'} • {job.jobType}
                      </span>
                    </div>
                    
                    <span className="text-sm text-gray-600 font-medium">
                      Click to generate proposal →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Job Popup */}
      {selectedJob && user && (
        <JobPopup 
          job={selectedJob}
          user={user}
          onClose={() => setSelectedJob(null)}
          onProposalGenerated={(proposal) => setLastGeneratedProposal(proposal)}
        />
      )}
    </div>
  )
}