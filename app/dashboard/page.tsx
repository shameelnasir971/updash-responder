

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
  experienceLevel: any
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
  
  // ✅ NEW: Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [totalJobs, setTotalJobs] = useState(0)
  
  // ✅ NEW: Popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs()
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

  // ✅ UPDATED: Load jobs with search
  const loadJobs = async (searchTerm: string = '') => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading jobs...', searchTerm ? `Search: ${searchTerm}` : 'All jobs')
      
      const url = searchTerm 
        ? `/api/upwork/jobs?search=${encodeURIComponent(searchTerm)}&limit=100`
        : '/api/upwork/jobs?limit=100'
      
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
        total: data.totalAvailable,
        message: data.message
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setTotalJobs(data.totalAvailable || data.jobs?.length || 0)
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(searchTerm 
            ? `No jobs found for "${searchTerm}"` 
            : 'No jobs found. Try searching.')
        } else {
          setConnectionError(`✅ ${data.jobs.length} jobs loaded${searchTerm ? ` for "${searchTerm}"` : ''}`)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
        setTotalJobs(0)
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
      setTotalJobs(0)
    } finally {
      setJobsLoading(false)
      setSearchLoading(false)
    }
  }

  // ✅ NEW: Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchLoading(true)
      loadJobs(searchQuery.trim())
    }
  }

  // ✅ NEW: Clear search
  const clearSearch = () => {
    setSearchQuery('')
    loadJobs()
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

  // Handle job click - open popup
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
        {/* Header with Search */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected 
                  ? `Browse ${totalJobs}+ real Upwork jobs` 
                  : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              {/* ✅ SEARCH BAR */}
              <form onSubmit={handleSearch} className="flex-1 md:flex-none">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs by title, skills, keyword..."
                    className="w-full md:w-96 px-4 py-2 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    🔍
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </form>
              
              <div className="flex gap-2">
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
                  onClick={() => loadJobs(searchQuery)}
                  disabled={jobsLoading || searchLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {(jobsLoading || searchLoading) ? 'Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Search Tips */}
          {searchQuery && (
            <div className="mt-3 text-sm text-gray-600">
              Searching for: <span className="font-semibold">"{searchQuery}"</span>
              <button 
                onClick={clearSearch}
                className="ml-3 text-blue-600 hover:text-blue-800"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={() => loadJobs(searchQuery)}
                className={`ml-4 text-sm px-3 py-1 rounded ${
                  connectionError.includes('✅')
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                }`}
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Jobs Stats */}
        {jobs.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
              <div className="text-gray-600 text-sm">Jobs Loaded</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-green-600">
                {jobs.filter(j => j.budget !== 'Budget not specified' && j.budget !== '$0.00').length}
              </div>
              <div className="text-gray-600 text-sm">Paid Jobs</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">
                {[...new Set(jobs.map(j => j.category))].length}
              </div>
              <div className="text-gray-600 text-sm">Categories</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">
                {totalJobs}
              </div>
              <div className="text-gray-600 text-sm">Total Available</div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {searchQuery ? `Search Results for "${searchQuery}"` : '📊 Latest Upwork Jobs'}
                <span className="ml-2 text-sm font-normal text-gray-600">
                  ({jobs.length} of {totalJobs} total)
                </span>
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length} jobs shown
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchQuery ? `Searching for "${searchQuery}"...` : 'Loading 100+ jobs from Upwork...'}
                </p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">
                  {searchQuery ? '🔍' : '💼'}
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery 
                    ? `Try different keywords or browse all jobs.`
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                {!upworkConnected && !searchQuery && (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork Now
                  </button>
                )}
                {searchQuery && (
                  <button 
                    onClick={clearSearch}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Browse All Jobs
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
                    <span className={`font-semibold px-3 py-1 rounded ${
                      job.budget === '$0.00' || job.budget === 'Budget not specified'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-green-50 text-green-700'
                    }`}>
                      {job.budget}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {job.category}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {job.jobType}
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      {job.experienceLevel?.toLowerCase()}
    </span>
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                      {job.proposals} proposals
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-3 text-sm">
                    {job.description.substring(0, 300)}
                    {job.description.length > 300 && '...'}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="text-gray-500 text-xs">
                          +{job.skills.length - 4} more
                        </span>
                      )}
                    </div>
                    
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
          
          {/* Load More Button (if available) */}
          {jobs.length > 0 && jobs.length < totalJobs && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button 
                onClick={() => loadJobs(searchQuery)}
                disabled={jobsLoading}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Load More Jobs ({totalJobs - jobs.length} remaining)
              </button>
            </div>
          )}
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