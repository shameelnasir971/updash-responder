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
  workload?: string
  location?: string
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)
  const [hasMore, setHasMore] = useState(false)

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

  // ✅ UPDATED: Load jobs with pagination
  const loadJobs = useCallback(async (search = '', forceRefresh = false, background = false, page = 1) => {
    if (!background) setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading REAL jobs... Page ${page}`, 
        search ? `Search: "${search}"` : '', 
        forceRefresh ? '(Force Refresh)' : ''
      )
      
      const url = `/api/upwork/jobs?page=${page}${
        search ? `&search=${encodeURIComponent(search)}` : ''
      }${forceRefresh ? '&refresh=true' : ''}`
      
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
        total: data.total,
        showing: data.showing,
        message: data.message,
        cached: data.cached || false,
        stats: data.stats
      })

      if (data.success) {
        // If it's page 1, replace jobs. Otherwise, append
        if (page === 1) {
          setJobs(data.jobs || [])
        } else {
          // Filter out duplicates
          const existingIds = new Set(jobs.map(job => job.id))
          const newJobs = (data.jobs || []).filter((job: Job) => !existingIds.has(job.id))
          setJobs(prev => [...prev, ...newJobs])
        }
        
        setUpworkConnected(data.upworkConnected || false)
        setTotalJobs(data.total || 0)
        setTotalPages(data.stats?.totalPages || 1)
        setHasMore(data.stats?.hasMore || false)
        setCurrentPage(page)
        
        if (data.jobs?.length === 0) {
          setConnectionError(search 
            ? `No REAL jobs found for "${search}". Try different keywords.`
            : 'No REAL jobs found from Upwork. Try refreshing.'
          )
        } else if (data.jobs?.length > 0) {
          const cachedText = data.cached ? ' (cached)' : ''
          const pageText = page > 1 ? ` - Page ${page}` : ''
          const message = `✅ ${data.total || 0} REAL jobs available${pageText}${cachedText}`
          setConnectionError(message)
        }
        
        if (!background) {
          setLastRefreshTime(new Date())
        }
        
      } else {
        setConnectionError(data.message || 'Failed to load REAL jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      if (!background) setJobsLoading(false)
    }
  }, [jobs])

  const loadNextPage = () => {
    if (hasMore && !jobsLoading) {
      loadJobs(searchTerm, false, false, currentPage + 1)
    }
  }

  const loadPrevPage = () => {
    if (currentPage > 1 && !jobsLoading) {
      loadJobs(searchTerm, false, false, currentPage - 1)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      setCurrentPage(1)
      loadJobs(searchInput.trim(), true, false, 1)
    } else {
      setSearchTerm('')
      setCurrentPage(1)
      loadJobs('', true, false, 1)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    setCurrentPage(1)
    loadJobs('', true, false, 1)
  }

  const handleForceRefresh = () => {
    setCurrentPage(1)
    loadJobs(searchTerm, true, false, 1)
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
              <h1 className="text-2xl font-bold text-gray-900">Upwork REAL Jobs Dashboard</h1>
              <p className="text-sm text-gray-600 mt-2">
                100% REAL data from Upwork API • 0% mock data • Auto-refresh every 3 minutes
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
                    <span>Refresh ALL Jobs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalJobs}</div>
              <div className="text-sm text-gray-600">Total REAL Jobs</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{jobs.length}</div>
              <div className="text-sm text-gray-600">Showing</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{refreshCount}</div>
              <div className="text-sm text-gray-600">Refresh Count</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{upworkConnected ? '✅' : '❌'}</div>
              <div className="text-sm text-gray-600">Upwork Status</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search ALL REAL Upwork Jobs
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  id="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by job title, description, or skills (e.g., 'Shopify', 'Web Developer', 'Logo Design')"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
            </div>
          </form>
        </div>

        {/* Connection Status */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') ? 'bg-green-100 border border-green-400 text-green-700' :
            connectionError.includes('❌') ? 'bg-red-100 border border-red-400 text-red-700' :
            'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {connectionError.includes('✅') ? '✅' : connectionError.includes('❌') ? '❌' : '⚠️'}
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
                  {searchTerm ? `🔍 Results for "${searchTerm}"` : '📊 ALL REAL Upwork Jobs'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Showing {jobs.length} of {totalJobs} REAL jobs • Page {currentPage} of {totalPages}
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
                      <span>Refresh</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <button
                  onClick={loadPrevPage}
                  disabled={currentPage === 1 || jobsLoading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} • {totalJobs} total jobs
                </div>
                <button
                  onClick={loadNextPage}
                  disabled={!hasMore || jobsLoading}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching REAL Upwork jobs for "${searchTerm}"...` : 'Loading ALL REAL jobs from Upwork...'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fetching 100% REAL data from Upwork API (0% mock data)...
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {searchTerm ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No REAL Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchTerm 
                    ? `No REAL jobs match "${searchTerm}". Try different keywords.`
                    : 'Connect your Upwork account to see REAL jobs from Upwork marketplace.'
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
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{job.category}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Posted: {job.postedDate}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Proposals: {job.proposals}</span>
                    {job.verified && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅ Verified</span>}
                  </div>
                  
                  <p className="text-gray-700 mb-3 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 4} more
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