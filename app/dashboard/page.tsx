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
  source?: string
  isRealJob?: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadJobs()
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
    setMessage('')
    setNeedsReconnect(false)
    
    try {
      console.log('🔄 Loading jobs...')
      setMessage('🔄 Loading jobs from Upwork...')
      setMessageType('info')
      
      const response = await fetch('/api/upwork/jobs')
      const data = await response.json()
      
      console.log('📊 API Response:', data)
      
      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setMessage(data.message || 'No jobs found')
          setMessageType('info')
        } else {
          setMessage(data.message || '')
          setMessageType('success')
        }
      } else {
        setJobs([])
        setUpworkConnected(data.upworkConnected || false)
        
        // Check if we need to reconnect
        if (data.action === 'reconnect' || data.message.includes('expired') || data.message.includes('reconnect')) {
          setNeedsReconnect(true)
          setMessage(`🔴 ${data.message}`)
        } else {
          setMessage(`❌ ${data.message}`)
        }
        setMessageType('error')
      }
      
    } catch (error: any) {
      console.error('Load error:', error)
      setJobs([])
      setMessage('Network error. Please try again.')
      setMessageType('error')
    } finally {
      setJobsLoading(false)
    }
  }

  const handleDisconnectUpwork = async () => {
    if (!confirm('Are you sure you want to disconnect Upwork? You will need to reconnect.')) {
      return
    }
    
    setDisconnecting(true)
    setMessage('🔄 Disconnecting Upwork...')
    
    try {
      const response = await fetch('/api/upwork/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage('✅ Upwork disconnected. Please reconnect from sidebar.')
        setMessageType('success')
        setJobs([])
        setUpworkConnected(false)
        setNeedsReconnect(false)
        
        // Show reconnect instructions
        setTimeout(() => {
          setMessage('📢 Click "Connect Upwork" in the sidebar to reconnect with fresh token.')
          setMessageType('info')
        }, 2000)
      } else {
        setMessage(`❌ ${data.message}`)
        setMessageType('error')
      }
    } catch (error: any) {
      setMessage(`❌ Disconnect failed: ${error.message}`)
      setMessageType('error')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleReconnect = () => {
    // This will trigger the sidebar connect button
    const sidebarButton = document.querySelector('[href*="upwork/auth"]') as HTMLElement
    if (sidebarButton) {
      sidebarButton.click()
    } else {
      setMessage('Please use the "Connect Upwork" button in the sidebar')
      setMessageType('info')
    }
  }

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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
        <p className="text-sm text-gray-600">
          {upworkConnected ? '✅ Connected to Upwork' : '❌ Upwork not connected'}
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          messageType === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          messageType === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex justify-between items-center">
            <span>{message}</span>
            <div className="flex space-x-2">
              {needsReconnect && (
                <button
                  onClick={handleDisconnectUpwork}
                  disabled={disconnecting}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
              <button
                onClick={loadJobs}
                disabled={jobsLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          
          {needsReconnect && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 font-semibold">⚠️ Action Required:</p>
              <p className="text-sm text-yellow-700 mt-1">
                Your Upwork token has expired. Please:
              </p>
              <ol className="text-sm text-yellow-700 mt-2 ml-4 list-decimal space-y-1">
                <li>Click "Disconnect" button above</li>
                <li>Click "Connect Upwork" in sidebar</li>
                <li>Re-authorize in Upwork</li>
                <li>Jobs will load automatically</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
          <div className="text-sm text-gray-600">Jobs Loaded</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{upworkConnected ? '✅' : '❌'}</div>
          <div className="text-sm text-gray-600">Upwork Status</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">100%</div>
          <div className="text-sm text-gray-600">Real Data</div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {jobs.length > 0 ? '📊 Upwork Jobs' : 'No Jobs Available'}
            </h2>
            <div className="text-sm text-gray-600">
              {jobs.length} jobs • {upworkConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {jobsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading jobs from Upwork API...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4 text-6xl">💼</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {needsReconnect ? 'Upwork Token Expired' : 'No Jobs Available'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {needsReconnect 
                  ? 'Your Upwork connection needs to be refreshed. Please disconnect and reconnect.'
                  : 'Connect Upwork to see real jobs or try refreshing.'
                }
              </p>
              <div className="flex justify-center space-x-3">
                {needsReconnect ? (
                  <>
                    <button
                      onClick={handleDisconnectUpwork}
                      disabled={disconnecting}
                      className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect Upwork'}
                    </button>
                    <button
                      onClick={loadJobs}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </>
                ) : (
                  <button
                    onClick={loadJobs}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Refresh Jobs
                  </button>
                )}
              </div>
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
                  {job.category} • Posted: {job.postedDate} • {job.proposals} proposals
                </p>
                
                <p className="text-gray-700 mb-3">
                  {job.description.substring(0, 200)}...
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    {job.skills.slice(0, 3).map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                        {skill}
                      </span>
                    ))}
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

      {/* Job Proposal Popup */}
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
  )
}