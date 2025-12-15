

// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobProposalPopup from '@/components/JobProposalPopup'

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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  
  // ✅ NEW: Popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

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
      console.log('🔄 Loading REAL jobs...')
      const response = await fetch('/api/upwork/jobs')
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Jobs Data:', {
        success: data.success,
        count: data.jobs?.length,
        message: data.message
      })

      if (data.success) {
        // ✅ REAL JOBS SET KARO - NO MOCK DATA
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError('No jobs found. Try refreshing.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Success! Loaded ${data.jobs.length} real jobs from Upwork!`)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
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
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL. Check console.')
        console.error('OAuth error:', data.error)
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  // ✅ NEW: Handle job click - open popup
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
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
      {/* ✅ Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Real Upwork jobs from API' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : '🔗 Connect Upwork'}
                </button>
              )}
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

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('Success') 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={loadJobs}
                className={`ml-4 text-sm px-3 py-1 rounded ${
                  connectionError.includes('Success')
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
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
                {upworkConnected ? '📊 Real Upwork Jobs' : 'Connect Upwork Account'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length} jobs available
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading real jobs from Upwork API...</p>
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
                {!upworkConnected && (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork Now
                  </button>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">
                      {job.title}
                    </h3>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    <span className="font-medium">{job.client.name}</span> • 
                    Posted: {job.postedDate} • 
                    Location: {job.client.country} •
                    Rating: {job.client.rating} ⭐ •
                    Proposals: {job.proposals}
                  </p>
                  
                  <p className="text-gray-700 mb-3">
                    {job.description.substring(0, 250)}
                    {job.description.length > 250 && '...'}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      <span className="text-gray-500 text-sm">
                        {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                      </span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Generate Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ✅ NEW: Job Proposal Popup */}
        {showPopup && selectedJob && user && (
          <JobProposalPopup
            job={selectedJob}
            user={user}
            onClose={() => {
              setShowPopup(false)
              setSelectedJob(null)
            }}
          />
        )}
      </div>
    </div>
  )
}