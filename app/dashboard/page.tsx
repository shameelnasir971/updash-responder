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
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [stats, setStats] = useState({
    totalJobs: 0,
    uniqueSkills: 0,
    totalBudget: 0,
    averageProposals: 0
  })

  useEffect(() => {
    checkAuth()
  }, [])

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

  const loadJobs = async (search = '', forceRefresh = false) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading jobs...', search ? `Search: "${search}"` : 'All jobs')
      
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
        cached: data.cached || false,
        meta: data.meta
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Calculate statistics
        if (data.jobs?.length > 0) {
          calculateStats(data.jobs)
        }
        
      if (data.jobs?.length === 0) {
  setConnectionError(search 
    ? `No jobs found for "${search}". Try different keywords.`
    : 'No jobs found. Upwork API might be limiting requests.'
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
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  const calculateStats = (jobsList: Job[]) => {
    const totalJobs = jobsList.length
    
    // Get all unique skills
    const allSkills = jobsList.flatMap(job => job.skills || [])
    const uniqueSkills = [...new Set(allSkills)].length
    
    // Calculate total budget (estimate)
    let totalBudget = 0
    let budgetCount = 0
    
    jobsList.forEach(job => {
      const budgetMatch = job.budget?.match(/\$([\d,.]+)/)
      if (budgetMatch) {
        const amount = parseFloat(budgetMatch[1].replace(/,/g, ''))
        if (!isNaN(amount)) {
          totalBudget += amount
          budgetCount++
        }
      }
    })
    
    // Calculate average proposals
    const totalProposals = jobsList.reduce((sum, job) => sum + (job.proposals || 0), 0)
    const averageProposals = totalJobs > 0 ? Math.round(totalProposals / totalJobs) : 0
    
    setStats({
      totalJobs,
      uniqueSkills,
      totalBudget: Math.round(totalBudget),
      averageProposals
    })
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

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never'
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
              <p className="text-sm text-gray-600">
                {upworkConnected ? '🔗 Connected to Upwork API' : 'Connect Upwork to see real jobs'}
                {lastRefreshTime && ` • Last updated: ${formatTimeAgo(lastRefreshTime)}`}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded border">
                🔄 {refreshCount} refreshes
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
                    <span>Refresh Jobs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.totalJobs}</div>
              <div className="text-sm text-gray-600">Total Jobs</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.uniqueSkills}</div>
              <div className="text-sm text-gray-600">Unique Skills</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">${stats.totalBudget.toLocaleString()}+</div>
              <div className="text-sm text-gray-600">Total Budget</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.averageProposals}</div>
              <div className="text-sm text-gray-600">Avg. Proposals</div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Search Upwork Jobs (Last Month Only)
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by job title, description, or skills..."
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
                    ? `Searching for: "${searchTerm}" in last month's jobs`
                    : 'Enter keywords to search jobs from last month'
                  }
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Connection Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Loaded') || connectionError.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : connectionError.includes('Using cached')
                ? 'bg-yellow-100 border border-yellow-400 text-yellow-700'
                : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
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
              <h2 className="text-xl font-bold text-gray-900">
                {searchTerm ? `🔍 Search Results for "${searchTerm}"` : '📊 Upwork Jobs (Last Month)'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length} jobs loaded
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {searchTerm ? `Searching for "${searchTerm}"...` : 'Loading jobs from last month...'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Fetching multiple pages (100 jobs per page)...
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
                    ? `Try different keywords or check if jobs were posted in last month.`
                    : 'No jobs found in last month. Try refreshing or check your Upwork connection.'
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
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-blue-500"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600 mb-1">
                        {job.title}
                      </h3>
                      <div className="flex items-center space-x-3 text-sm text-gray-600">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {job.category || 'General'}
                        </span>
                        <span>📅 {job.postedDate}</span>
                        <span>👥 {job.proposals} proposals</span>
                        {job.client.rating > 0 && (
                          <span>⭐ {job.client.rating} rating</span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center flex-wrap gap-2">
                      {job.skills.slice(0, 6).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 6 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 6} more
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
                      <span>📝</span>
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
      </div>
    </div>
  )
}