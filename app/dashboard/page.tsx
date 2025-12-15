

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
  
  // ✅ NEW: Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  // ✅ NEW: Popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs() // Load all jobs initially
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

  // ✅ UPDATED: Accept search parameter (client-side filtering now)
  const loadJobs = async (search = '') => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading REAL jobs...', search ? `Will filter for: "${search}"` : '')
      
      // ✅ Always load all jobs, client-side filter
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
        originalCount: data.originalCount,
        message: data.message
      })

      if (data.success) {
        let filteredJobs = data.jobs || []
        
        // ✅ Client-side filtering if search term exists
        if (search) {
          const searchLower = search.toLowerCase()
          filteredJobs = filteredJobs.filter((job: Job) => 
            job.title.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower) ||
            job.skills.some(skill => skill.toLowerCase().includes(searchLower)) ||
            (job.category && job.category.toLowerCase().includes(searchLower))
          )
        }
        
        setJobs(filteredJobs)
        setUpworkConnected(data.upworkConnected || false)
        
        if (filteredJobs.length === 0) {
          setConnectionError(search 
            ? `No jobs found for "${search}". Try different keywords.`
            : 'No jobs found. Try refreshing.'
          )
        } else if (filteredJobs.length > 0) {
          setConnectionError(data.message || 
            (search 
              ? `🔍 Found ${filteredJobs.length} jobs for "${search}"`
              : `✅ Loaded ${data.originalCount} real jobs from Upwork`
            )
          )
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

  // ✅ Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadJobs(searchInput.trim())
    } else {
      setSearchTerm('')
      loadJobs() // Load all jobs if search is empty
    }
  }

  // ✅ Clear search
  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    loadJobs()
  }

  // ✅ Handle job click - open popup
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
              <h1 className="text-2xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? '🔗 Connected to Upwork API' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ NEW: Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Jobs by Keyword
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
                    ? `Showing filtered results for: "${searchTerm}"`
                    : 'Enter keywords to filter jobs. All jobs are loaded from Upwork and filtered locally for instant results.'
                  }
                </p>
              </div>
            </div>
            
            {/* Quick Search Suggestions */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchInput('Shopify')
                  setSearchTerm('Shopify')
                  loadJobs('Shopify')
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Shopify
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('Web Developer')
                  setSearchTerm('Web Developer')
                  loadJobs('Web Developer')
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Web Developer
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('Graphic Design')
                  setSearchTerm('Graphic Design')
                  loadJobs('Graphic Design')
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Graphic Design
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('Social Media')
                  setSearchTerm('Social Media')
                  loadJobs('Social Media')
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Social Media
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('Content Writing')
                  setSearchTerm('Content Writing')
                  loadJobs('Content Writing')
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Content Writing
              </button>
            </div>
          </form>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('Found')
              ? 'bg-blue-100 border border-blue-400 text-blue-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {connectionError.includes('✅') || connectionError.includes('Loaded') ? (
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
              <button 
                onClick={() => loadJobs(searchTerm)}
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
                  {searchTerm ? `🔍 Search Results for "${searchTerm}"` : '📊 All Upwork Jobs'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} available
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
                  onClick={() => loadJobs(searchTerm)}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching for "${searchTerm}"...` : 'Loading real jobs from Upwork...'}
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {searchTerm ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchTerm 
                    ? `No jobs match "${searchTerm}". Try different keywords like "developer", "design", "marketing", etc.`
                    : 'Connect your Upwork account to see real jobs from the Upwork marketplace.'
                  }
                </p>
                {!upworkConnected && (
                  <button 
                    onClick={() => window.open('/dashboard?tab=connect', '_self')}
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

        {/* ✅ Job Proposal Popup */}
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