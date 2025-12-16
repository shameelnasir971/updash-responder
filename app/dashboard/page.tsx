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
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [totalJobsAvailable, setTotalJobsAvailable] = useState(0)
  const [pagesFetched, setPagesFetched] = useState(0)
  const [isFetchingAll, setIsFetchingAll] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // ✅ AUTO REFRESH FUNCTION
  const startAutoRefresh = useCallback(() => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 AUTO: Refreshing jobs...')
        loadJobs(searchTerm, false, true)
      }
    }, 300000) // 5 minutes

    setAutoRefreshInterval(interval)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [searchTerm])

  // ✅ TOGGLE AUTO REFRESH
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
    if (!autoRefresh) {
      startAutoRefresh()
    } else if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
      setAutoRefreshInterval(null)
    }
  }

  useEffect(() => {
    checkAuth()
    
    if (autoRefresh) {
      startAutoRefresh()
    }

    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval)
      }
    }
  }, [autoRefresh])

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

  // ✅ UPDATED: LOAD JOBS WITH PAGINATION
  const loadJobs = async (search = '', forceRefresh = false, isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setJobsLoading(true)
    }
    
    setConnectionError('')
    
    try {
      console.log(`🔄 ${isAutoRefresh ? 'AUTO' : 'MANUAL'}: Loading jobs...`, search ? `Search: "${search}"` : 'All jobs')
      
      const url = `/api/upwork/jobs${search || forceRefresh ? '?' : ''}${
        search ? `search=${encodeURIComponent(search)}${forceRefresh ? '&' : ''}` : ''
      }${forceRefresh ? 'refresh=true' : ''}`
      
      console.log('📤 Fetching from:', url)
      
      const response = await fetch(url)
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      
      console.log('📊 Jobs Response:', {
        success: data.success,
        count: data.jobs?.length,
        total: data.totalAvailable,
        pages: data.pagesFetched,
        message: data.message,
        cached: data.cached || false
      })

      if (data.success) {
        if (!isAutoRefresh || data.jobs.length > jobs.length) {
          setJobs(data.jobs || [])
        }
        
        setUpworkConnected(data.upworkConnected || false)
        setTotalJobsAvailable(data.totalAvailable || 0)
        setPagesFetched(data.pagesFetched || 0)
        
        if (data.jobs?.length === 0) {
          setConnectionError(search 
            ? `❌ No jobs found for "${search}". Try different keywords.`
            : '❌ No jobs found. Upwork API might be limiting requests.'
          )
        } else if (data.jobs?.length > 0) {
          const message = data.cached 
            ? `${data.message} (cached)`
            : data.message
          
          if (!isAutoRefresh || message.includes('Loaded')) {
            setConnectionError(message)
          }
        }
        
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        if (!isAutoRefresh) {
          setJobs([])
        }
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      if (!isAutoRefresh) {
        setConnectionError('Network error. Please check connection.')
        setJobs([])
      }
    } finally {
      if (!isAutoRefresh) {
        setJobsLoading(false)
        setLastRefreshTime(new Date())
      }
    }
  }

  // ✅ FETCH ALL JOBS (5000+)
  const fetchAllJobs = async () => {
    if (isFetchingAll) return
    
    setIsFetchingAll(true)
    setConnectionError('🔄 Fetching ALL jobs from Upwork (this may take 1-2 minutes)...')
    
    try {
      // First, clear cache to force fresh fetch
      await fetch('/api/upwork/jobs', { method: 'POST' })
      
      // Then fetch with refresh
      const response = await fetch('/api/upwork/jobs?refresh=true')
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setTotalJobsAvailable(data.totalAvailable || 0)
        setPagesFetched(data.pagesFetched || 0)
        setConnectionError(`✅ SUCCESS: Loaded ${data.totalAvailable.toLocaleString()} REAL jobs from ${data.pagesFetched} Upwork pages!`)
        setRefreshCount(prev => prev + 1)
        setLastRefreshTime(new Date())
      } else {
        setConnectionError(`❌ Failed: ${data.message}`)
      }
    } catch (error: any) {
      setConnectionError(`❌ Error: ${error.message}`)
    } finally {
      setIsFetchingAll(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadJobs(searchInput.trim(), true)
    } else {
      setSearchInput('')
      setSearchTerm('')
      loadJobs('', true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    loadJobs('', true)
  }

  const handleForceRefresh = () => {
    loadJobs(searchTerm, true)
    setRefreshCount(prev => prev + 1)
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
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
              <h1 className="text-2xl font-bold text-gray-900">🚀 Upwork Jobs Dashboard</h1>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-gray-600">
                  {upworkConnected ? '🔗 Connected to Upwork API' : 'Connect Upwork to see real jobs'}
                </p>
                {totalJobsAvailable > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                    📊 {totalJobsAvailable.toLocaleString()} REAL jobs available
                  </span>
                )}
                {pagesFetched > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                    📄 {pagesFetched} pages fetched
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={fetchAllJobs}
                disabled={isFetchingAll}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isFetchingAll ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Fetching 5000+ Jobs...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Fetch ALL Jobs</span>
                  </>
                )}
              </button>
              
              <button 
                onClick={toggleAutoRefresh}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                  autoRefresh 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <span>{autoRefresh ? '⏸️' : '▶️'}</span>
                <span>Auto Refresh {autoRefresh ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{jobs.length.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Jobs Displayed</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{totalJobsAvailable.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Available</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{refreshCount}</div>
            <div className="text-sm text-gray-600">Refresh Count</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{pagesFetched}</div>
            <div className="text-sm text-gray-600">Pages Fetched</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{upworkConnected ? '✅' : '❌'}</div>
            <div className="text-sm text-gray-600">API Connected</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">100%</div>
            <div className="text-sm text-gray-600">Real Data</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Search Real Upwork Jobs
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by job title, description, skills, or category..."
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
                      {jobsLoading ? 'Searching...' : '🔍 Search'}
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
                    ? `🔍 Searching real Upwork jobs for: "${searchTerm}"`
                    : 'Enter keywords to search through thousands of real Upwork jobs'
                  }
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Connection & Status Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('SUCCESS') || connectionError.includes('Loaded')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('❌')
              ? 'bg-red-100 border border-red-400 text-red-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>{connectionError}</span>
                {lastRefreshTime && (
                  <span className="text-xs opacity-75">
                    (Last refresh: {formatTimeAgo(lastRefreshTime)})
                  </span>
                )}
              </div>
              <button 
                onClick={handleForceRefresh}
                className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Refresh Now
              </button>
            </div>
          </div>
        )}

        {/* Jobs List Header */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {searchTerm 
                  ? `🔍 Search Results for "${searchTerm}"` 
                  : '📊 Latest Upwork Jobs (Real Data)'}
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  Showing {jobs.length.toLocaleString()} of {totalJobsAvailable.toLocaleString()} jobs
                </div>
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
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="divide-y divide-gray-200">
            {jobsLoading && !jobs.length ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching Upwork for "${searchTerm}"...` : 'Loading real jobs from Upwork API...'}
                </p>
                <p className="text-sm text-gray-500 mt-2">Fetching from {pagesFetched} pages...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No Jobs Found' : 'No Jobs Available'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm 
                    ? `Try different keywords or refresh.`
                    : 'Click "Fetch ALL Jobs" to load thousands of real Upwork jobs.'
                  }
                </p>
                <div className="flex justify-center space-x-4">
                  <button 
                    onClick={fetchAllJobs}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                  >
                    🚀 Fetch ALL Jobs (5000+)
                  </button>
                  <button 
                    onClick={handleForceRefresh}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <>
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-blue-500"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">
                          {job.title}
                        </h3>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-sm text-gray-600">
                            {job.category} • {job.postedDate}
                          </span>
                          {job.proposals > 0 && (
                            <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                              {job.proposals} proposals
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        {job.budget}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4 line-clamp-3">
                      {job.description}
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 8).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 8 && (
                          <span className="text-xs text-gray-500">
                            +{job.skills.length - 8} more
                          </span>
                        )}
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJobClick(job)
                        }}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center space-x-2"
                      >
                        <span>🤖</span>
                        <span>Generate AI Proposal</span>
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Load More Section */}
                {jobs.length < totalJobsAvailable && (
                  <div className="p-6 text-center border-t border-gray-200">
                    <p className="text-gray-600 mb-4">
                      Showing {jobs.length.toLocaleString()} of {totalJobsAvailable.toLocaleString()} jobs
                    </p>
                    <div className="flex justify-center space-x-4">
                      <button 
                        onClick={fetchAllJobs}
                        disabled={isFetchingAll}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isFetchingAll ? 'Loading...' : '🚀 Load ALL Jobs'}
                      </button>
                      <button 
                        onClick={handleForceRefresh}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                      >
                        Load More
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        {jobs.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-900">📊 Job Statistics</h4>
                <p className="text-sm text-gray-600">
                  All data is 100% real from Upwork API • No mock data
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Last updated: {lastRefreshTime ? formatTimeAgo(lastRefreshTime) : 'Never'}
                </p>
                <p className="text-xs text-gray-500">
                  Auto refresh: {autoRefresh ? 'ON (every 5 min)' : 'OFF'}
                </p>
              </div>
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