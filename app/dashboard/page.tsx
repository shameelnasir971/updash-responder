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
  }
  skills: string[]
  proposals: number
  verified: boolean
  category: string
  jobType: string
  experienceLevel: string
  duration: string
  estimatedWorkload: string
  contractTier: string
  source: string
  isRealJob: boolean
  raw?: any
}

interface JobsResponse {
  success: boolean
  jobs: Job[]
  total: number
  page: number
  perPage: number
  totalPages: number
  hasNextPage: boolean
  upworkConnected: boolean
  message: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [lastGeneratedProposal, setLastGeneratedProposal] = useState('')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)
  const [perPage] = useState(20) // 20 jobs per page

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs(currentPage)
    }
  }, [user, currentPage])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!upworkConnected) return
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing jobs...')
      loadJobs(currentPage, true)
    }, 5 * 60 * 1000) // 5 minutes
    
    return () => clearInterval(interval)
  }, [upworkConnected, currentPage])

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

  const loadJobs = async (page: number = 1, silent: boolean = false) => {
    if (!silent) {
      setJobsLoading(true)
    }
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading jobs - Page ${page}...`)
      const response = await fetch(`/api/upwork/jobs?page=${page}&perPage=${perPage}&refresh=${silent}`)
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data: JobsResponse = await response.json()
      console.log('📊 Jobs Response:', {
        success: data.success,
        count: data.jobs?.length,
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        message: data.message
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        setTotalPages(data.totalPages || 1)
        setTotalJobs(data.total || 0)
        
        if (data.jobs?.length === 0) {
          setConnectionError('No matching jobs found. Update your prompts settings to see relevant jobs.')
        } else if (data.jobs?.length > 0) {
          // Check if all jobs are real
          const allRealJobs = data.jobs.every((job: Job) => job.isRealJob && job.source === 'upwork')
          
          if (allRealJobs) {
            setConnectionError(`✅ Found ${data.total} real jobs! Page ${page} of ${data.totalPages}`)
          } else {
            setConnectionError('⚠️ Some data may not be fully loaded. Connect with support.')
          }
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs.')
        setJobs([])
        setTotalPages(1)
        setTotalJobs(0)
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      if (!silent) {
        setJobsLoading(false)
      }
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

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 10
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first 5, last 5, and current page in middle
      if (currentPage <= 5) {
        for (let i = 1; i <= 7; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages - 1)
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 4) {
        pages.push(1)
        pages.push(2)
        pages.push('...')
        for (let i = totalPages - 6; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push(2)
        pages.push('...')
        for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages - 1)
        pages.push(totalPages)
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
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected 
                  ? `📊 Showing ${jobs.length} jobs on page ${currentPage} of ${totalPages} (${totalJobs} total)` 
                  : '🔗 Connect Upwork to see personalized jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                >
                  <span>🔗</span>
                  <span>Connect Upwork</span>
                </button>
              )}
              <button 
                onClick={() => loadJobs(currentPage)}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {jobsLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
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

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-600">Total Jobs</div>
            <div className="text-2xl font-bold text-gray-900">{totalJobs}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-600">Current Page</div>
            <div className="text-2xl font-bold text-gray-900">{currentPage} / {totalPages}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-600">Jobs This Page</div>
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-600">Upwork Status</div>
            <div className="text-2xl font-bold text-green-600">{upworkConnected ? '✅ Connected' : '❌ Disconnected'}</div>
          </div>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') || connectionError.includes('Found')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={() => loadJobs(currentPage)}
                className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? `Jobs (Page ${currentPage})` : 'Connect Upwork First'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length > 0 ? `${jobs.length} jobs on this page` : 'No jobs found'}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading real jobs from Upwork...</p>
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
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md border-l-4 border-transparent hover:border-blue-500"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded text-sm">
                          {job.budget}
                        </span>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium">{job.client.name}</span> • {job.postedDate} • {job.client.country} •
                          Rating: <span className="font-medium">{job.client.rating} ⭐</span> •
                          Hires: <span className="font-medium">{job.client.totalHires}</span>
                        </span>
                      </div>
                    </div>
                    <button 
                      className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                    >
                      <span>🤖</span>
                      <span>Generate Proposal</span>
                    </button>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">{job.description.substring(0, 300)}...</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 flex-wrap">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded mb-1">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="text-gray-500 text-sm">+{job.skills.length - 4} more</span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'} • {job.jobType} • {job.duration}
                      </span>
                    </div>
                    
                    <span className="text-sm text-gray-600 font-medium">
                      Click to view details →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page <span className="font-semibold">{currentPage}</span> of{' '}
                <span className="font-semibold">{totalPages}</span> •{' '}
                <span className="font-semibold">{totalJobs}</span> total jobs
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((pageNum, index) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum as number)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              
              <div className="text-sm text-gray-600">
                <select 
                  value={perPage}
                  onChange={(e) => {
                    // You can implement changing perPage if needed
                    console.log('Change per page to:', e.target.value)
                  }}
                  className="border border-gray-300 rounded px-2 py-1"
                  disabled
                >
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
              </div>
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
          onProposalGenerated={(proposal) => setLastGeneratedProposal(proposal)}
        />
      )}
    </div>
  )
}