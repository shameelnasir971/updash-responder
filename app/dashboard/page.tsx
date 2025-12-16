//app/dashboard/page.tsx

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
  
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  
  // ✅ NEW: Load more state
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!autoRefresh || !upworkConnected) return
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing jobs...')
      loadJobs(searchTerm, false, true)
      setRefreshCount(prev => prev + 1)
      setLastRefreshTime(new Date())
    }, 3 * 60 * 1000) // 3 minutes
    
    return () => clearInterval(interval)
  }, [autoRefresh, upworkConnected, searchTerm])

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

  // ✅ IMPROVED: Load jobs with pagination
 // Find the loadJobs function and update it:

const loadJobs = useCallback(async (search = '', forceRefresh = false, background = false) => {
  if (!background) setJobsLoading(true)
  setConnectionError('')
  
  try {
    console.log('🔄 Loading REAL jobs...', 
      search ? `Search: "${search}"` : '', 
      forceRefresh ? '(Force Refresh)' : ''
    )
    
    // ✅ SIMPLE URL - REMOVE PAGINATION PARAMS
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
    console.log('📊 Jobs Data:', {
      success: data.success,
      count: data.jobs?.length,
      message: data.message,
      cached: data.cached || false
    })

    if (data.success) {
      // If it's a background refresh, only update if we have more jobs
      if (background && data.jobs?.length <= jobs.length) {
        console.log('No new jobs in background refresh')
        return
      }
      
      setJobs(data.jobs || [])
      setUpworkConnected(data.upworkConnected || false)
      
      if (data.jobs?.length === 0) {
        setConnectionError(search 
          ? `No jobs found for "${search}". Try different keywords.`
          : 'No jobs found. Upwork API might be limiting requests. Try refreshing.'
        )
      } else if (data.jobs?.length > 0) {
        const message = data.cached 
          ? `${data.message} (cached)`
          : data.message
        
        setConnectionError(message)
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
    if (!background) setJobsLoading(false)
  }
}, [connectionError, jobs.length])

  // ✅ NEW: Load more jobs
  const loadMoreJobs = async () => {
    if (loadingMore || !hasMoreJobs) return
    
    setLoadingMore(true)
    try {
      console.log(`📥 Loading more jobs (page ${page + 1})...`)
      
      // For now, we'll just trigger a force refresh to get different jobs
      // In future, we can implement proper pagination
      const response = await fetch(`/api/upwork/jobs?refresh=true&page=${page + 1}`)
      const data = await response.json()
      
      if (data.success && data.jobs?.length > 0) {
        // Filter out duplicates and add new jobs
        const existingIds = new Set(jobs.map(job => job.id))
        const newJobs = data.jobs.filter((job: Job) => !existingIds.has(job.id))
        
        if (newJobs.length > 0) {
          setJobs(prev => [...prev, ...newJobs])
          setPage(prev => prev + 1)
          setConnectionError(`✅ Added ${newJobs.length} more jobs! Total: ${jobs.length + newJobs.length}`)
        } else {
          setConnectionError('No new jobs found. Try refreshing.')
        }
        
        setHasMoreJobs(data.totalUnique > (jobs.length + newJobs.length))
      }
    } catch (error: any) {
      console.error('Load more error:', error)
      setConnectionError('Failed to load more jobs')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      setPage(1)
      loadJobs(searchInput.trim(), true)
    } else {
      setSearchTerm('')
      setPage(1)
      loadJobs('', true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    setPage(1)
    loadJobs('', true)
  }

  const handleForceRefresh = () => {
    setPage(1)
    loadJobs(searchTerm, true)
    setRefreshCount(prev => prev + 1)
    setLastRefreshTime(new Date())
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
              <h1 className="text-2xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
              <div className="flex items-center space-x-4 mt-2">
                <p className="text-sm text-gray-600">
                  {upworkConnected ? '🔗 Connected to Upwork API' : 'Connect Upwork to see real jobs'}
                </p>
                {lastRefreshTime && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Last refresh: {formatTimeAgo(lastRefreshTime)}
                  </span>
                )}
              </div>
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
                    Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
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
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh All Jobs</span>
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
                  Search ALL Upwork Jobs
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by job title, description, or skills (e.g., 'Shopify', 'Web Developer', 'Logo Design')"
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
                      {jobsLoading ? 'Searching...' : '🔍 Search ALL Jobs'}
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
                    ? `Searching across ALL Upwork jobs for: "${searchTerm}"`
                    : 'Enter keywords to search across ALL Upwork jobs. System fetches 50+ jobs on each refresh.'
                  }
                </p>
              </div>
            </div>
            
            {/* Quick Search Suggestions */}
            <div className="flex flex-wrap gap-2">
              {['Shopify', 'Web Developer', 'Graphic Design', 'WordPress', 'Logo Design', 'Virtual Assistant', 'Content Writing', 'Social Media', 'React', 'Python'].map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => {
                    setSearchInput(keyword)
                    setSearchTerm(keyword)
                    loadJobs(keyword, true)
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Status Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <div>
                <div className="text-sm text-gray-600">Jobs Loaded</div>
                <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Auto-refresh</div>
                <div className={`font-semibold ${autoRefresh ? 'text-green-600' : 'text-red-600'}`}>
                  {autoRefresh ? 'Every 3 minutes' : 'Disabled'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Refresh Count</div>
                <div className="text-xl font-bold text-blue-600">{refreshCount}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Search Term</div>
                <div className="font-semibold text-gray-900">
                  {searchTerm || 'All Jobs'}
                </div>
              </div>
            </div>
            
            {lastRefreshTime && (
              <div className="text-sm text-gray-500">
                Last updated: {lastRefreshTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded') || connectionError.includes('Added')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('Found')
              ? 'bg-blue-100 border border-blue-400 text-blue-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {connectionError.includes('✅') || connectionError.includes('Loaded') || connectionError.includes('Added') ? (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : connectionError.includes('Found') ? (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
                <span>{connectionError}</span>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={handleForceRefresh}
                  className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Refresh
                </button>
                {!autoRefresh && (
                  <button 
                    onClick={() => setAutoRefresh(true)}
                    className="ml-2 text-sm px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Enable Auto-refresh
                  </button>
                )}
              </div>
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
                  {searchTerm && (
                    <button 
                      onClick={handleClearSearch}
                      className="ml-3 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Clear search
                    </button>
                  )}
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
                      <span>Refreshing...</span>
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
                  {searchTerm ? `Searching ALL Upwork jobs for "${searchTerm}"...` : 'Loading ALL real jobs from Upwork...'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fetching 50+ jobs from Upwork marketplace. This may take a few seconds...
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
                    ? `No jobs match "${searchTerm}". Try different keywords or refresh to get latest jobs.`
                    : 'Connect your Upwork account to see real jobs from the Upwork marketplace.'
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
              <>
                {jobs.map((job) => (
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
                ))}
                
                {/* Load More Button */}
                {hasMoreJobs && !searchTerm && (
                  <div className="p-6 text-center border-t border-gray-200">
                    <button
                      onClick={loadMoreJobs}
                      disabled={loadingMore}
                      className="bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors font-semibold"
                    >
                      {loadingMore ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Loading more jobs...</span>
                        </div>
                      ) : (
                        '📥 Load More Jobs'
                      )}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      Click to load additional jobs from Upwork
                    </p>
                  </div>
                )}
              </>
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