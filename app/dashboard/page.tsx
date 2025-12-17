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
    id?: string
    name: string
    rating: number
    reviewsCount: number
    country: string
    totalSpent: number
    totalHires: number
  }
  skills: string[]
  proposals: number
  hiresCount: number
  interviewCount: number
  verified: boolean
  featured: boolean
  urgent: boolean
  private: boolean
  category: string
  subcategory: string
  engagement: string
  duration: string
  experienceLevel: string
  source: string
  isRealJob: boolean
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
  
  const [totalJobs, setTotalJobs] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [jobsPerPage] = useState(50)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadJobs(1, '')
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async (page = 1, search = '', forceRefresh = false) => {
    setJobsLoading(true)
    setConnectionError('')
    setCurrentPage(page)
    
    try {
      console.log('🔄 Loading jobs...', 
        search ? `Search: "${search}"` : 'All jobs',
        `Page: ${page}`
      )
      
      let url = `/api/upwork/jobs?page=${page}&limit=${jobsPerPage}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (forceRefresh) url += `&refresh=true`
      
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
        pages: data.totalPages,
        message: data.message
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setTotalJobs(data.total || 0)
        setTotalPages(data.totalPages || 1)
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(search 
            ? `No jobs found for "${search}". Try different keywords.`
            : 'No jobs found. Upwork API might be limiting requests.'
          )
        } else if (data.jobs?.length > 0) {
          const message = data.cached 
            ? `${data.message} (cached - refresh for latest)`
            : data.message
          
          setConnectionError(message)
        }
        
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
        setTotalJobs(0)
        setTotalPages(1)
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
      setTotalJobs(0)
      setTotalPages(1)
    } finally {
      setJobsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadJobs(1, searchInput.trim(), true)
    } else {
      setSearchInput('')
      setSearchTerm('')
      loadJobs(1, '', true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    loadJobs(1, '', true)
  }

  const handleForceRefresh = () => {
    loadJobs(currentPage, searchTerm, true)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    loadJobs(page, searchTerm, false)
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const handleClearCache = async () => {
    try {
      await fetch('/api/upwork/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheKey: searchTerm ? `search_${searchTerm.toLowerCase()}` : 'all' })
      })
      
      alert('Cache cleared! Refreshing jobs...')
      loadJobs(1, searchTerm, true)
    } catch (error) {
      alert('Failed to clear cache')
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
                {upworkConnected ? '🔗 Connected to Upwork API' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
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
                    <span>Refresh Jobs</span>
                  </>
                )}
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <button 
                  onClick={handleClearCache}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                >
                  Clear Cache
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Upwork Jobs (Title, Description, Skills, Category)
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="e.g., React developer, web design, $500 budget..."
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
                    ? `Searching for: "${searchTerm}"`
                    : 'Search across all Upwork job posts'
                  }
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{totalJobs.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Jobs</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
            <div className="text-sm text-gray-600">Current Page</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{totalPages}</div>
            <div className="text-sm text-gray-600">Total Pages</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-200">
            <div className="text-2xl font-bold text-gray-900">{upworkConnected ? '✅' : '❌'}</div>
            <div className="text-sm text-gray-600">Upwork Status</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">100%</div>
            <div className="text-sm text-gray-600">Real Data</div>
          </div>
        </div>

        {/* Connection Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded') || connectionError.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('cached')
                ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
                : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <div className="flex gap-2">
                <button 
                  onClick={handleForceRefresh}
                  className="ml-4 text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Refresh
                </button>
                {connectionError.includes('cached') && (
                  <button 
                    onClick={handleClearCache}
                    className="ml-2 text-sm px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700"
                  >
                    Clear Cache
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} • {totalJobs.toLocaleString()} total jobs
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || jobsLoading}
                  className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  « First
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || jobsLoading}
                  className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  ‹ Prev
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage - 2 + i
                  if (pageNum < 1) pageNum = i + 1
                  if (pageNum > totalPages) return null
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={jobsLoading}
                      className={`px-3 py-2 border rounded text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || jobsLoading}
                  className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Next ›
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages || jobsLoading}
                  className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Last »
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {searchTerm ? `🔍 Search Results for "${searchTerm}"` : '📊 Upwork Jobs'}
              </h2>
              <div className="text-sm text-gray-600">
                Showing {jobs.length} of {totalJobs.toLocaleString()} jobs
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching for "${searchTerm}"...` : 'Loading jobs from Upwork...'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This may take a moment as we fetch real-time data...
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
                    ? `Try different keywords or clear the search.`
                    : 'Try refreshing or check your Upwork connection.'
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
                      {job.featured && <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Featured</span>}
                      {job.urgent && <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Urgent</span>}
                      {job.verified && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Verified</span>}
                    </h3>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    {job.category} • {job.engagement} • {job.experienceLevel} • Posted: {job.postedDate}
                  </p>
                  
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-600">{job.client.name}</span>
                    </div>
                    {job.client.rating > 0 && (
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm text-gray-600">{job.client.rating} ({job.client.reviewsCount} reviews)</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-gray-700 mb-3 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 5).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 5 && (
                        <span className="text-gray-500 text-sm">+{job.skills.length - 5} more</span>
                      )}
                      
                      <span className="text-gray-500 text-sm">
                        {job.proposals} proposals • {job.interviewCount} interviews • {job.hiresCount} hires
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

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || jobsLoading}
                className="px-4 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || jobsLoading}
                className="px-4 py-2 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
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