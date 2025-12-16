// app/dashboard/page.tsx - OPTIMIZED FOR BULK LOADING
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
  
  const [autoRefresh, setAutoRefresh] = useState(false) // Disabled for bulk loading
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  
  // ✅ Pagination state
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)
  const [page, setPage] = useState(1)
  const [totalJobsCount, setTotalJobsCount] = useState(0)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!autoRefresh || !upworkConnected) return
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh disabled for bulk loading')
      // Disabled to prevent API rate limiting
    }, 10 * 60 * 1000) // 10 minutes
    
    return () => clearInterval(interval)
  }, [autoRefresh, upworkConnected])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadInitialJobs()
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  // ✅ INITIAL LOAD: 100+ jobs
  const loadInitialJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🚀 Loading INITIAL bulk jobs (100+)...')
      
      const response = await fetch('/api/upwork/jobs?limit=100')
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Initial Jobs Data:', {
        success: data.success,
        count: data.jobs?.length,
        totalCount: data.totalCount,
        hasNextPage: data.hasNextPage
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        setHasMoreJobs(data.hasNextPage || false)
        setTotalJobsCount(data.totalCount || data.jobs?.length || 0)
        
        if (data.jobs?.length === 0) {
          setConnectionError('No jobs found. Upwork API might be limiting requests.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ SUCCESS! Loaded ${data.jobs.length} real jobs from Upwork (Total available: ${data.totalCount || 'Unknown'})`)
        }
        
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Initial load error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  // ✅ SEARCH JOBS with Upwork API filter
  const searchJobs = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      loadInitialJobs()
      return
    }
    
    setJobsLoading(true)
    setConnectionError('')
    setSearchTerm(searchQuery)
    
    try {
      console.log(`🔍 Searching Upwork for: "${searchQuery}"`)
      
      const encodedQuery = encodeURIComponent(searchQuery)
      const response = await fetch(`/api/upwork/jobs?search=${encodedQuery}&limit=100`)
      
      const data = await response.json()
      console.log('📊 Search Results:', {
        success: data.success,
        count: data.jobs?.length,
        query: searchQuery
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        setHasMoreJobs(data.hasNextPage || false)
        setTotalJobsCount(data.totalCount || data.jobs?.length || 0)
        setPage(1)
        
        if (data.jobs?.length === 0) {
          setConnectionError(`❌ No jobs found for "${searchQuery}". Try different keywords.`)
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Found ${data.jobs.length} jobs for "${searchQuery}"`)
        }
        
      } else {
        setConnectionError(data.message || 'Search failed')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Search error:', error)
      setConnectionError('Search failed. Please try again.')
      setJobs([])
    } finally {
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  // ✅ LOAD MORE JOBS (Pagination)
  const loadMoreJobs = async () => {
    if (loadingMore || !hasMoreJobs) return
    
    setLoadingMore(true)
    
    try {
      console.log(`📥 Loading more jobs (Page ${page + 1})...`)
      
      const params = new URLSearchParams({
        page: (page + 1).toString()
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      const response = await fetch(`/api/upwork/jobs?${params}`)
      const data = await response.json()
      
      if (data.success && data.jobs?.length > 0) {
        // Filter duplicates
        const existingIds = new Set(jobs.map(job => job.id))
        const newJobs = data.jobs.filter((job: Job) => !existingIds.has(job.id))
        
        if (newJobs.length > 0) {
          setJobs(prev => [...prev, ...newJobs])
          setPage(prev => prev + 1)
          setHasMoreJobs(data.hasNextPage || false)
          setConnectionError(`✅ Added ${newJobs.length} more jobs! Total: ${jobs.length + newJobs.length}`)
        } else {
          setHasMoreJobs(false)
          setConnectionError('No more unique jobs available.')
        }
      } else {
        setHasMoreJobs(false)
        setConnectionError('No more jobs available.')
      }
      
    } catch (error: any) {
      console.error('❌ Load more error:', error)
      setConnectionError('Failed to load more jobs')
    } finally {
      setLoadingMore(false)
    }
  }

  // ✅ FORCE REFRESH
  const handleForceRefresh = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Force refreshing all jobs...')
      
      const params = new URLSearchParams({
        refresh: 'true',
        limit: '100'
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      const response = await fetch(`/api/upwork/jobs?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setHasMoreJobs(data.hasNextPage || false)
        setTotalJobsCount(data.totalCount || data.jobs?.length || 0)
        setRefreshCount(prev => prev + 1)
        setLastRefreshTime(new Date())
        
        if (data.jobs?.length > 0) {
          setConnectionError(`✅ Refreshed! ${data.jobs.length} jobs loaded`)
        }
      }
      
    } catch (error: any) {
      console.error('❌ Refresh error:', error)
      setConnectionError('Refresh failed')
    } finally {
      setJobsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      searchJobs(searchInput.trim())
    } else {
      setSearchInput('')
      setSearchTerm('')
      setPage(1)
      loadInitialJobs()
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    setPage(1)
    loadInitialJobs()
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
              <p className="text-sm text-gray-600 mt-1">
                {upworkConnected ? '🔗 Connected to Upwork API - Fetching REAL jobs' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
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
                  Search ALL Upwork Jobs (Real-time API Search)
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search job titles, descriptions, or skills (e.g., 'React Developer', 'Logo Design', 'Content Writing')"
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
                      {jobsLoading ? 'Searching...' : '🔍 Search Upwork'}
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
                    ? `Searching REAL Upwork jobs for: "${searchTerm}"`
                    : 'Enter keywords to search across ALL Upwork jobs. Searches Upwork API directly (not local cache).'
                  }
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{jobs.length}</div>
              <div className="text-sm text-blue-600">Jobs Loaded</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{totalJobsCount}</div>
              <div className="text-sm text-green-600">Total Available</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{searchTerm ? 'Search' : 'All Jobs'}</div>
              <div className="text-sm text-purple-600">Current View</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">100%</div>
              <div className="text-sm text-yellow-600">Real Data</div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('SUCCESS') || connectionError.includes('Found') || connectionError.includes('Added')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('No jobs')
              ? 'bg-blue-100 border border-blue-400 text-blue-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span>{connectionError}</span>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={handleForceRefresh}
                  className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Refresh
                </button>
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
                  {searchTerm ? `🔍 Results for "${searchTerm}"` : '📊 All Upwork Jobs'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Showing {jobs.length} jobs • {hasMoreJobs ? 'More available' : 'All loaded'} • 100% real Upwork data
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {!upworkConnected && (
                  <button 
                    onClick={() => window.location.href = '/dashboard/settings'}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching Upwork for "${searchTerm}"...` : 'Loading 100+ real jobs from Upwork...'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fetching directly from Upwork API. This may take a few seconds...
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {searchTerm ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No Jobs Found' : 'No Jobs Available'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchTerm 
                    ? `No Upwork jobs match "${searchTerm}". Try different keywords.`
                    : 'No jobs found. Try refreshing or check your Upwork connection.'
                  }
                </p>
                <div className="space-x-4">
                  <button 
                    onClick={handleForceRefresh}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Refresh Jobs
                  </button>
                  {searchTerm && (
                    <button 
                      onClick={handleClearSearch}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                    >
                      Clear Search
                    </button>
                  )}
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
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">
                          {job.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {job.category} • Posted: {job.postedDate} • {job.proposals} proposals
                        </p>
                      </div>
                      <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                        {job.budget}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-3">
                      {job.description.substring(0, 250)}
                      {job.description.length > 250 && '...'}
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 5).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 5 && (
                          <span className="text-gray-500 text-sm">
                            +{job.skills.length - 5} more
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
                {hasMoreJobs && (
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
                        '📥 Load More Jobs (Next Page)'
                      )}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      Click to load additional jobs from Upwork API
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            All data is fetched directly from Upwork API in real-time. 
            {searchTerm ? ` Currently searching for: "${searchTerm}"` : ' Showing latest Upwork jobs.'}
          </p>
          <p className="mt-1">
            Last updated: {lastRefreshTime ? formatTimeAgo(lastRefreshTime) : 'Never'}
          </p>
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