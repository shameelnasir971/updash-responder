// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobPopup from '@/components/JobPopup/JobPopup'

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
  budgetAmount: number
  postedDate: string
  postedTimestamp: string
  client: {
    name: string
    rating: number
    country: string
    totalSpent: number
    totalHires: number
    company: string
    isEnterprise: boolean
  }
  skills: string[]
  proposals: number
  verified: boolean
  category: string
  subcategory: string
  jobType: string
  experienceLevel: string
  duration: string
  workload: string
  preferredLocation: string
  locationMandatory: boolean
  engagement: string
  source: string
  isRealJob: boolean
  cursor: string
  rawData: {
    hasBudget: boolean
    hasClient: boolean
    enterprise: boolean
  }
}

interface PaginationInfo {
  currentPage: number
  pageSize: number
  totalJobs: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  
  // Pagination states
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    pageSize: 10,
    totalJobs: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  })
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs(pagination.currentPage, pageSize)
    }
  }, [user])

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

  const loadJobs = async (page: number = 1, size: number = pageSize, refresh: boolean = false) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading page ${page} with ${size} jobs...`)
      
      const url = `/api/upwork/jobs?page=${page}&pageSize=${size}&refresh=${refresh}`
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
        total: data.pagination?.totalJobs,
        pages: data.pagination?.totalPages
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.pagination) {
          setPagination(data.pagination)
        }
        
        if (data.jobs?.length === 0) {
          if (data.pagination?.totalJobs === 0) {
            setConnectionError('No matching jobs found. Update your prompts settings or try different keywords.')
          } else if (page > 1) {
            setConnectionError('No more jobs on this page.')
          }
        } else {
          const message = `✅ Page ${page}: ${data.jobs.length} jobs (Total: ${data.pagination?.totalJobs || 0})`
          setConnectionError(message)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs.')
        setJobs([])
        setPagination(prev => ({ ...prev, totalJobs: 0, totalPages: 0 }))
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleConnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }))
      loadJobs(newPage, pageSize)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleRefreshJobs = () => {
    loadJobs(1, pageSize, true) // Force refresh
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    loadJobs(1, newSize)
  }

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5
    const { currentPage, totalPages } = pagination
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, start + maxPagesToShow - 1)
      
      if (end - start + 1 < maxPagesToShow) {
        start = Math.max(1, end - maxPagesToShow + 1)
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    
    return pages
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
      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected 
                  ? `📊 Showing ${jobs.length} jobs (Total: ${pagination.totalJobs})` 
                  : '🔗 Connect Upwork to see personalized jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected ? (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  🔗 Connect Upwork
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Page Size Selector */}
                  <select 
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                    disabled={jobsLoading}
                  >
                    <option value="10">10 per page</option>
                    <option value="20">20 per page</option>
                    <option value="30">30 per page</option>
                    <option value="50">50 per page</option>
                  </select>
                  
                  <button 
                    onClick={handleRefreshJobs}
                    disabled={jobsLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {jobsLoading ? '🔄 Loading...' : '🔄 Refresh Jobs'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {upworkConnected && pagination.totalJobs > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-sm text-gray-600">Total Jobs</div>
              <div className="text-2xl font-bold text-gray-900">{pagination.totalJobs}+</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-sm text-gray-600">Current Page</div>
              <div className="text-2xl font-bold text-gray-900">{pagination.currentPage}/{pagination.totalPages}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-sm text-gray-600">Showing</div>
              <div className="text-2xl font-bold text-gray-900">{jobs.length} jobs</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="text-sm text-gray-600">Real Data</div>
              <div className="text-2xl font-bold text-green-600">100% ✅</div>
            </div>
          </div>
        )}

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Page')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              {connectionError.includes('Update') && (
                <button 
                  onClick={() => window.location.href = '/dashboard/prompts'}
                  className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Update Settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Personalized Jobs for You' : 'Connect Upwork First'}
              </h2>
              <div className="text-sm text-gray-600">
                {pagination.totalJobs > 0 
                  ? `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalJobs} total jobs)` 
                  : 'No jobs found'}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading jobs from Upwork...</p>
                <p className="text-sm text-gray-500 mt-2">Fetching 50+ real jobs for you</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try updating your prompts settings or try different keywords.' 
                    : 'Connect your Upwork account to see personalized jobs.'}
                </p>
                {upworkConnected ? (
                  <button 
                    onClick={() => window.location.href = '/dashboard/prompts'}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    ⚙️ Update Prompts Settings
                  </button>
                ) : (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                  >
                    🔗 Connect Upwork Account
                  </button>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {job.client.isEnterprise && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                            🏢 Enterprise
                          </span>
                        )}
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {job.category}
                        </span>
                        {job.subcategory && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                            {job.subcategory}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded text-sm">
                          {job.budget}
                        </span>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium">{job.client.name}</span>
                          {job.client.company && ` (${job.client.company})`}
                          {' • '}
                          {job.postedDate}
                          {' • '}
                          {job.client.country}
                          {' • '}
                          Rating: <span className="font-medium">{job.client.rating} ⭐</span>
                          {job.client.totalHires > 0 && ` (${job.client.totalHires} hires)`}
                        </span>
                      </div>
                    </div>
                    <button 
                      className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                    >
                      Generate Proposal
                    </button>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">
                    {job.description.substring(0, 300)}...
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 flex-wrap">
                      {job.skills.slice(0, 5).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 5 && (
                        <span className="text-gray-500 text-sm">+{job.skills.length - 5} more</span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'} • {job.jobType}
                        {job.duration && ` • ${job.duration}`}
                        {job.workload && ` • ${job.workload}`}
                        {job.preferredLocation !== 'Anywhere' && ` • 🌍 ${job.preferredLocation}`}
                      </span>
                    </div>
                    
                    <span className="text-sm text-gray-600 font-medium hidden md:inline">
                      Click to generate proposal →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing page {pagination.currentPage} of {pagination.totalPages}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage || jobsLoading}
                  className={`px-4 py-2 rounded-lg ${
                    pagination.hasPrevPage 
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ← Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {generatePageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={jobsLoading}
                      className={`px-3 py-2 rounded-lg min-w-[40px] ${
                        pageNum === pagination.currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  
                  {/* Ellipsis for many pages */}
                  {pagination.totalPages > 5 && pagination.currentPage < pagination.totalPages - 2 && (
                    <span className="px-2 py-2 text-gray-500">...</span>
                  )}
                  
                  {/* Last page if not shown */}
                  {pagination.totalPages > 5 && pagination.currentPage < pagination.totalPages - 2 && (
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={jobsLoading}
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      {pagination.totalPages}
                    </button>
                  )}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage || jobsLoading}
                  className={`px-4 py-2 rounded-lg ${
                    pagination.hasNextPage 
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next →
                </button>
              </div>
              
              <div className="text-sm text-gray-600">
                {pagination.totalJobs.toLocaleString()} total jobs
              </div>
            </div>
            
            {/* Quick Page Jumper */}
            <div className="mt-4 flex justify-center items-center space-x-2">
              <span className="text-sm text-gray-600">Go to page:</span>
              <input
                type="number"
                min="1"
                max={pagination.totalPages}
                defaultValue={pagination.currentPage}
                className="w-20 px-3 py-1 border border-gray-300 rounded text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt((e.target as HTMLInputElement).value)
                    if (page >= 1 && page <= pagination.totalPages) {
                      handlePageChange(page)
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="number"]') as HTMLInputElement
                  const page = parseInt(input.value)
                  if (page >= 1 && page <= pagination.totalPages) {
                    handlePageChange(page)
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Go
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job Popup */}
      {selectedJob && user && (
        <JobPopup 
          job={selectedJob}
          user={user}
          onClose={() => setSelectedJob(null)}
          onProposalGenerated={() => {}}
        />
      )}
    </div>
  )
}