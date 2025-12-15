// app/dashboard/page.tsx - COMPLETE BULK JOBS VERSION
'use client'

import { useState, useEffect, useCallback } from 'react'
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
  postedTimestamp: number
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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<number>(0)

  useEffect(() => {
    checkAuth()
  }, [])

  // ✅ Auto-refresh for NEW jobs only (every 2 minutes)
  useEffect(() => {
    if (!autoRefresh || !upworkConnected || jobs.length === 0) return
    
    const interval = setInterval(() => {
      checkForNewJobs()
    }, 2 * 60 * 1000) // 2 minutes
    
    return () => clearInterval(interval)
  }, [autoRefresh, upworkConnected, jobs.length])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadAllJobs() // Load ALL jobs on startup
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  // ✅ Load ALL jobs (1000+) from Upwork
  const loadAllJobs = async (search = '', forceRefresh = false) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🚀 Loading ALL Upwork jobs...')
      
      const url = `/api/upwork/jobs?${search ? `search=${encodeURIComponent(search)}&` : ''}${forceRefresh ? 'refresh=true&' : ''}`
      
      const response = await fetch(url)
      
      if (response.status === 401) {
        setConnectionError('Session expired')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(true)
        
        if (data.jobs?.length === 0) {
          setConnectionError(search 
            ? `No jobs found for "${search}"`
            : 'No jobs found. Try refreshing.'
          )
        } else {
          const msg = data.cached 
            ? `${data.message} (from cache)`
            : `✅ Loaded ${data.jobs.length} REAL jobs from Upwork`
          
          setConnectionError(msg)
          
          // Set last fetch timestamp for new job detection
          if (data.jobs?.length > 0) {
            const latestTimestamp = Math.max(...data.jobs.map((j: any) => j.postedTimestamp || 0))
            setLastFetchTimestamp(latestTimestamp)
          }
        }
        
        // Auto-clear success messages after 5 seconds
        if (!search && !forceRefresh) {
          setTimeout(() => {
            if (connectionError.includes('✅')) setConnectionError('')
          }, 5000)
        }
        
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('Load error:', error)
      setConnectionError('Network error')
      setJobs([])
    } finally {
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  // ✅ Check for NEW jobs only (for auto-refresh)
  const checkForNewJobs = async () => {
    if (!lastFetchTimestamp) return
    
    try {
      console.log('🔍 Checking for new jobs...')
      
      const response = await fetch(`/api/upwork/jobs?newOnly=true&since=${lastFetchTimestamp}`)
      const data = await response.json()
      
      if (data.success && data.newJobs?.length > 0) {
        // Get full details of new jobs
        const newJobsWithDetails = await Promise.all(
          data.newJobs.map(async (newJob: any) => {
            // Fetch full job details
            const jobResponse = await fetch(`/api/upwork/jobs?search=${encodeURIComponent(newJob.title)}`)
            const jobData = await jobResponse.json()
            
            if (jobData.success && jobData.jobs?.length > 0) {
              return jobData.jobs.find((j: Job) => j.id === newJob.id) || newJob
            }
            return newJob
          })
        )
        
        // Add new jobs to top
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id))
          const uniqueNewJobs = newJobsWithDetails.filter((j: any) => !existingIds.has(j.id))
          
          if (uniqueNewJobs.length > 0) {
            const updatedJobs = [...uniqueNewJobs, ...prev]
            setConnectionError(`🆕 ${uniqueNewJobs.length} new jobs added!`)
            
            // Update timestamp
            const latestTimestamp = Math.max(...updatedJobs.map(j => j.postedTimestamp || 0))
            setLastFetchTimestamp(latestTimestamp)
            
            return updatedJobs.slice(0, 500) // Keep 500 latest jobs
          }
          return prev
        })
      }
    } catch (error) {
      console.error('Check new jobs error:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadAllJobs(searchInput.trim(), true)
    } else {
      setSearchTerm('')
      loadAllJobs('', true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    loadAllJobs('', true)
  }

  const handleForceRefresh = () => {
    setRefreshCount(prev => prev + 1)
    loadAllJobs(searchTerm, true)
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ALL Upwork Jobs...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching 1000+ jobs, please wait...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">🚀 Upwork Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? `Connected to Upwork API • ${jobs.length} jobs loaded` : 'Connect Upwork to see ALL jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    <div className={`block w-14 h-8 rounded-full ${autoRefresh ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${autoRefresh ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-gray-700 font-medium text-sm">
                    Auto-check new jobs
                  </div>
                </label>
              </div>
              
              <button 
                onClick={handleForceRefresh}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {jobsLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading ALL Jobs...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh ALL Jobs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search ALL Upwork Jobs (1000+ jobs database)
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search across ALL Upwork jobs by title, skills, or description..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex space-x-3 ml-3">
                    <button
                      type="submit"
                      disabled={jobsLoading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold"
                    >
                      {jobsLoading ? 'Searching...' : '🔍 Search ALL'}
                    </button>
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {searchTerm 
                    ? `Searching across ${jobs.length} jobs for: "${searchTerm}"`
                    : 'Search across ALL Upwork jobs (1000+). System fetches jobs from multiple categories.'
                  }
                </p>
              </div>
            </div>
            
            {/* Quick Search Suggestions */}
            <div className="flex flex-wrap gap-2">
              {['Web Developer', 'Shopify', 'Graphic Design', 'WordPress', 'Virtual Assistant', 'Content Writing', 
                'Social Media', 'React', 'Python', 'Logo Design', 'Marketing', 'Data Entry'].map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => {
                    setSearchInput(keyword)
                    setSearchTerm(keyword)
                    loadAllJobs(keyword, true)
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{jobs.length}</div>
              <div className="text-sm text-blue-700">Total Jobs Loaded</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {autoRefresh ? 'ON' : 'OFF'}
              </div>
              <div className="text-sm text-green-700">Auto-check New Jobs</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">{refreshCount}</div>
              <div className="text-sm text-purple-700">Refresh Count</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-900">
                {searchTerm || 'All Jobs'}
              </div>
              <div className="text-sm text-orange-700">Current Filter</div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('🆕')
              ? 'bg-blue-100 border border-blue-400 text-blue-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {connectionError.includes('✅') ? '✅' : 
                 connectionError.includes('🆕') ? '🆕' : '⚠️'}
                <span className="ml-2">{connectionError}</span>
              </div>
              <button 
                onClick={handleForceRefresh}
                className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
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
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {searchTerm ? `🔍 Search Results for "${searchTerm}"` : '📊 ALL Upwork Jobs'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} loaded
                  {lastRefreshTime && ` • Last refresh: ${formatTimeAgo(lastRefreshTime)}`}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {!upworkConnected && (
                  <button 
                    onClick={() => window.open('/dashboard?tab=connect', '_self')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork
                  </button>
                )}
                <button 
                  onClick={handleForceRefresh}
                  disabled={jobsLoading}
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
                      <span>Refresh All</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm 
                    ? `Searching ALL Upwork jobs for "${searchTerm}"...`
                    : 'Loading ALL Upwork jobs (1000+ jobs)...'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fetching jobs from multiple categories. This may take 10-15 seconds...
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {searchTerm ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchTerm 
                    ? `No jobs match "${searchTerm}". Try different keywords.`
                    : 'Connect your Upwork account to see ALL jobs from Upwork marketplace.'
                  }
                </p>
                <div className="space-x-4">
                  {!upworkConnected && (
                    <button 
                      onClick={() => window.open('/dashboard?tab=connect', '_self')}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                    >
                      🔗 Connect Upwork Now
                    </button>
                  )}
                  <button 
                    onClick={handleForceRefresh}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
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
                    <span className="font-medium">{job.category}</span> • 
                    Posted: {job.postedDate} •
                    Proposals: {job.proposals} •
                    {job.verified && ' ✅ Verified'}
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
                      {job.skills.length > 3 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 3} more
                        </span>
                      )}
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
    </div>
  )
}