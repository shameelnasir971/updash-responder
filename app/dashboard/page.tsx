

// app/dashboard/page.tsx 
'use client'

import { useState, useEffect, ReactNode } from 'react'
import JobProposalPopup from '@/components/JobProposalPopup'

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface Job {
  jobType: ReactNode
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
  const [connecting, setConnecting] = useState(false)
  
  // ✅ NEW: Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // Popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs() // Initial load without search
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

 // EXISTING loadJobs FUNCTION KO YE UPDATED CODE SE REPLACE KAREIN:

const loadJobs = async (searchTerm: string = '') => {
  setJobsLoading(true)
  setIsSearching(!!searchTerm)
  setConnectionError('')
  
  try {
    console.log('🔄 Loading jobs...', searchTerm ? `Search: "${searchTerm}"` : 'All jobs')
    
    const url = searchTerm 
      ? `/api/upwork/jobs?search=${encodeURIComponent(searchTerm)}`
      : '/api/upwork/jobs'
    
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
      searchTerm: data.searchTerm,
      message: data.message
    })

    // ✅ FIX YAHAN HAI: data.success true/false ke hisaab se set karo
    if (data.success === true) {
      setJobs(data.jobs || [])
      setUpworkConnected(data.upworkConnected || false)
      
      if (data.jobs?.length === 0) {
        setConnectionError(
          searchTerm 
            ? `No jobs found for "${searchTerm}". Try different keywords.`
            : 'No jobs found. Try refreshing.'
        )
      } else if (data.jobs?.length > 0) {
        setConnectionError(
          searchTerm 
            ? `🔍 Found ${data.jobs.length} jobs for "${searchTerm}"`
            : `✅ ${data.message || `Loaded ${data.jobs.length} latest jobs`}`
        )
      }
    } else {
      // Agar API ne success: false return kiya
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

  // ✅ NEW: Handle Search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      loadJobs(searchQuery.trim())
    }
  }

  // ✅ NEW: Clear Search
  const handleClearSearch = () => {
    setSearchQuery('')
    loadJobs('') // Load all jobs
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL. Check console.')
        console.error('OAuth error:', data.error)
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
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
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 p-6">
        {/* Header with Search Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Search real Upwork jobs' : 'Connect Upwork to search jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : '🔗 Connect Upwork'}
                </button>
              )}
              <button 
                onClick={() => loadJobs()}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Loading...' : '🔄 Refresh All Jobs'}
              </button>
            </div>
          </div>

          {/* ✅ SEARCH BAR */}
          <div className="max-w-2xl">
            <form onSubmit={handleSearch} className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Upwork jobs by title, skills, or keywords..."
                    className="w-full px-4 py-3 pl-12 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="absolute left-4 top-3.5 text-gray-400">
                    🔍
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={jobsLoading || !searchQuery.trim()}
                  className="bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {jobsLoading && isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1">
                Examples: "Shopify developer", "logo design", "React", "virtual assistant"
              </p>
            </form>
          </div>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('Found') || connectionError.includes('Loaded')
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {connectionError.includes('Found') ? '🔍' : '✅'}
                <span className="ml-2">{connectionError}</span>
              </div>
              <button 
                onClick={() => loadJobs(searchQuery)}
                className={`ml-4 text-sm px-3 py-1 rounded ${
                  connectionError.includes('Found') || connectionError.includes('Loaded')
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
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
                  {isSearching && searchQuery 
                    ? `🔍 Search Results for "${searchQuery}"`
                    : upworkConnected ? '📊 Latest Upwork Jobs' : 'Connect Upwork Account'
                  }
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {isSearching 
                    ? 'These jobs are fetched in real-time from Upwork based on your search'
                    : 'Latest jobs from Upwork (100% real, no mock data)'
                  }
                </p>
              </div>
              <div className="text-sm text-gray-600">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} found
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {isSearching ? `Searching Upwork for "${searchQuery}"...` : 'Loading real jobs from Upwork API...'}
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {isSearching ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {isSearching ? 'No Jobs Found' : upworkConnected ? 'No Jobs Available' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {isSearching 
                    ? `No jobs found for "${searchQuery}". Try different keywords like "web development", "design", or "marketing".`
                    : upworkConnected 
                      ? 'Try searching for specific skills or job titles.' 
                      : 'Connect your Upwork account to search real jobs.'
                  }
                </p>
                {isSearching ? (
                  <button 
                    onClick={handleClearSearch}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                  >
                    Clear Search & Show All Jobs
                  </button>
                ) : !upworkConnected && (
                  <button 
                    onClick={handleConnectUpwork}
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
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {job.skills.slice(0, 4).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    📅 Posted: {job.postedDate} • 
                    👥 Proposals: {job.proposals} • 
                    {job.verified && ' ✅ Verified'}
                  </p>
                  
                  <p className="text-gray-700 mb-3">
                    {job.description.substring(0, 200)}
                    {job.description.length > 200 && '...'}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {job.category} • {job.jobType}
                    </span>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
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