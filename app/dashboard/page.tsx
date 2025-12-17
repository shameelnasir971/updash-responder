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
  const [message, setMessage] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  const [searchInput, setSearchInput] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        checkUpworkStatus()
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      
      if (data.connected) {
        setUpworkConnected(true)
        loadJobs()
      } else {
        setMessage('🔗 Connect your Upwork account to see real jobs')
      }
    } catch (error) {
      setMessage('Unable to check Upwork connection')
    }
  }

  const loadJobs = async (search = '') => {
    if (!upworkConnected) {
      setMessage('Please connect Upwork account first')
      return
    }
    
    setJobsLoading(true)
    setMessage('')
    
    try {
      const url = `/api/upwork/jobs${search ? `?search=${encodeURIComponent(search)}` : ''}`
      
      const response = await fetch(url)
      
      if (response.status === 401) {
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setMessage(data.message || '')
        setUpworkConnected(data.upworkConnected || false)
      } else {
        setMessage(data.message || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      setMessage('Network error. Please try again.')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadJobs(searchInput.trim())
  }

  const handleClearSearch = () => {
    setSearchInput('')
    loadJobs('')
  }

  const handleForceRefresh = () => {
    loadJobs(searchInput.trim())
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const handleConnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        setMessage('Failed to generate OAuth URL')
      }
    } catch (error: any) {
      setMessage('Error: ' + error.message)
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
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? '🔗 Connected to Upwork' : 'Disconnected'}
              </p>
            </div>
            
            <button 
              onClick={handleForceRefresh}
              disabled={jobsLoading || !upworkConnected}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {jobsLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Refresh Jobs</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Connect Button if not connected */}
        {!upworkConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Upwork Not Connected</h3>
                <p className="text-yellow-700">Connect your Upwork account to see real jobs and send proposals.</p>
              </div>
              <button
                onClick={handleConnectUpwork}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
              >
                🔗 Connect Upwork
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {upworkConnected && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                    Search Upwork Jobs (Last 30 Days)
                  </label>
                  <div className="flex items-center">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        id="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by job title, description, or skills..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                        disabled={jobsLoading}
                      />
                    </div>
                    <div className="flex space-x-3 ml-3">
                      <button
                        type="submit"
                        disabled={jobsLoading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold"
                      >
                        {jobsLoading ? 'Searching...' : '🔍 Search'}
                      </button>
                      {searchInput && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          disabled={jobsLoading}
                          className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            message.includes('✅') || message.includes('Loaded') || message.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : message.includes('❌') || message.includes('Error')
              ? 'bg-red-100 border border-red-400 text-red-700'
              : 'bg-blue-100 border border-blue-400 text-blue-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{message}</span>
              {upworkConnected && (
                <button 
                  onClick={handleForceRefresh}
                  className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
        )}

        {/* Jobs List */}
        {upworkConnected && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {searchInput ? `🔍 Search Results` : '📊 Latest Upwork Jobs (Last 30 Days)'}
                </h2>
                <div className="text-sm text-gray-600">
                  {jobs.length} jobs
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {jobsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading real jobs from Upwork...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4 text-6xl">💼</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No Jobs Found
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {searchInput 
                      ? `Try different keywords.`
                      : 'No jobs available in the last 30 days.'
                    }
                  </p>
                  <button 
                    onClick={handleForceRefresh}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Refresh Jobs
                  </button>
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
                      {job.client.name} • {job.postedDate} • {job.proposals} proposals • {job.client.country}
                    </p>
                    
                    <p className="text-gray-700 mb-3">
                      {job.description.substring(0, 300)}
                      {job.description.length > 300 && '...'}
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 5).map((skill, index) => (
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
        )}

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
    </div>
  )
}