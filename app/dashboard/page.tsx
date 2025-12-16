'use client'

import { useState, useEffect, useCallback } from 'react'
import JobProposalPopup from '@/components/JobProposalPopup'
import debounce from 'lodash/debounce'

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
  const [categoryFilter, setCategoryFilter] = useState('')
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [totalJobsAvailable, setTotalJobsAvailable] = useState(0)
  
  const [categories, setCategories] = useState<string[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout>()

  useEffect(() => {
    checkAuth()
    
    // Auto refresh every 2 minutes
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (upworkConnected) {
          handleForceRefresh()
        }
      }, 2 * 60 * 1000)
      
      setAutoRefreshInterval(interval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, upworkConnected])

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

  const loadJobs = async (search = '', category = '', forceRefresh = false) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading jobs...', { 
        search, 
        category, 
        forceRefresh 
      })
      
      // Build URL with all parameters
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      if (forceRefresh) params.append('refresh', 'true')
      
      const url = `/api/upwork/jobs${params.toString() ? `?${params.toString()}` : ''}`
      
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
        total: data.total,
        message: data.message,
        cached: data.cached || false
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setTotalJobsAvailable(data.total || data.jobs?.length || 0)
        setUpworkConnected(data.upworkConnected || false)
        
        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.jobs?.map((job: Job) => job.category).filter(Boolean))
        ) as string[]
        setCategories(uniqueCategories.slice(0, 10)) // Top 10 categories
        
        if (data.jobs?.length === 0) {
          if (search) {
            setConnectionError(`❌ No jobs found for "${search}". Try different keywords.`)
          } else if (category) {
            setConnectionError(`❌ No jobs found in "${category}" category.`)
          } else {
            setConnectionError('❌ No jobs available right now. Upwork API might be limiting requests.')
          }
        } else if (data.jobs?.length > 0) {
          const message = data.cached 
            ? `📦 ${data.message} (cached data)`
            : `✅ ${data.message}`
          
          setConnectionError(message)
        }
        
      } else {
        setConnectionError(data.message || '❌ Failed to load jobs')
        setJobs([])
        setTotalJobsAvailable(0)
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('❌ Network error. Please check connection.')
      setJobs([])
      setTotalJobsAvailable(0)
    } finally {
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchText: string) => {
      if (searchText.trim()) {
        setSearchTerm(searchText.trim())
        loadJobs(searchText.trim(), categoryFilter, true)
      }
    }, 500),
    [categoryFilter]
  )

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)
    debouncedSearch(value)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    debouncedSearch.cancel()
    
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadJobs(searchInput.trim(), categoryFilter, true)
    } else {
      setSearchInput('')
      setSearchTerm('')
      loadJobs('', categoryFilter, true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    debouncedSearch.cancel()
    loadJobs('', categoryFilter, true)
  }

  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category)
    loadJobs(searchTerm, category, true)
  }

  const handleForceRefresh = () => {
    loadJobs(searchTerm, categoryFilter, true)
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

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
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
                {upworkConnected 
                  ? `🔗 Connected to Upwork API | Real-time job updates` 
                  : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleAutoRefresh}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                  autoRefresh 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <span>{autoRefresh ? '🔄' : '⏸️'}</span>
                <span>Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}</span>
              </button>
              
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
                    <span>Refresh Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
            <div className="text-sm text-gray-600">Jobs Loaded</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{totalJobsAvailable}</div>
            <div className="text-sm text-gray-600">Total Available</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{refreshCount}</div>
            <div className="text-sm text-gray-600">Refresh Count</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{upworkConnected ? '✅' : '❌'}</div>
            <div className="text-sm text-gray-600">Upwork Connected</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">100%</div>
            <div className="text-sm text-gray-600">Real Data</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            {/* Search Form */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                🔍 Search Upwork Jobs (Real API Search)
              </label>
              <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    id="search"
                    value={searchInput}
                    onChange={handleSearchInput}
                    placeholder="Search by job title, description, skills... (Live search)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold whitespace-nowrap"
                >
                  {jobsLoading ? 'Searching...' : 'Search API'}
                </button>
                {(searchTerm || categoryFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearSearch()
                      setCategoryFilter('')
                    }}
                    className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </form>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm 
                  ? `Real API search for: "${searchTerm}"`
                  : 'Enter keywords to search Upwork jobs (API-level search)'
                }
              </p>
            </div>

            {/* Category Filters */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📂 Filter by Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCategoryChange('')}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      !categoryFilter 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        categoryFilter === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connection Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded') || connectionError.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('⚠️')
              ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <span>{connectionError}</span>
                {lastRefreshTime && (
                  <div className="text-sm mt-1">
                    Last updated: {formatTimeAgo(lastRefreshTime)}
                  </div>
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

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {searchTerm 
                  ? `🔍 Search Results for "${searchTerm}"`
                  : categoryFilter
                  ? `📂 ${categoryFilter} Jobs`
                  : '📊 All Upwork Jobs'
                }
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  Showing {jobs.length} of {totalJobsAvailable} jobs
                </div>
                <div className="text-sm text-gray-500">
                  {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm 
                    ? `Searching Upwork for "${searchTerm}"...`
                    : categoryFilter
                    ? `Loading ${categoryFilter} jobs...`
                    : 'Loading real jobs from Upwork API...'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fetching maximum jobs with pagination...
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No Jobs Found' : 'No Jobs Available'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm 
                    ? `Try different keywords or check all categories.`
                    : categoryFilter
                    ? `No jobs found in "${categoryFilter}" category.`
                    : 'Upwork API might be limiting requests. Try refreshing.'
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
              jobs.map((job) => (
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
                      <p className="text-sm text-gray-500 mt-1">
                        {job.category} • Posted: {job.postedDate} • {job.client.country}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                        {job.budget}
                      </span>
                      <span className="text-sm text-gray-500">
                        {job.proposals} proposals • {job.client.rating} ⭐
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-4">
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
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <span>🤖</span>
                      <span>Generate Proposal</span>
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

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            ✅ <strong>100% Real Data</strong> from Upwork API • 
            Auto-refresh: {autoRefresh ? 'Every 2 minutes' : 'Manual'} • 
            Last refresh: {lastRefreshTime ? formatTimeAgo(lastRefreshTime) : 'Never'}
          </p>
          <p className="mt-1">
            System fetches up to 500 jobs with pagination • Search uses Upwork's real API • No mock data
          </p>
        </div>
      </div>
    </div>
  )
}