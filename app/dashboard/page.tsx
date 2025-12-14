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
  category: string
  jobType: string
  experienceLevel: string
  source: string
  isRealJob: boolean
  _raw?: any
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalJobs: number
  hasNext: boolean
  hasPrev: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalJobs: 0,
    hasNext: false,
    hasPrev: false
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs(pagination.currentPage)
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

  const loadJobs = async (page: number = 1) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading REAL jobs page ${page}...`)
      const response = await fetch(`/api/upwork/jobs?page=${page}&limit=50`)
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Jobs Response:', {
        success: data.success,
        count: data.jobs?.length,
        page: data.page,
        totalPages: data.totalPages,
        totalJobs: data.total
      })

      if (data.success) {
        // ✅ REAL JOBS ONLY - NO MOCK DATA CHECK
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Update pagination info
        setPagination({
          currentPage: data.page || 1,
          totalPages: data.totalPages || 1,
          totalJobs: data.total || 0,
          hasNext: data.hasNextPage || false,
          hasPrev: data.hasPrevPage || false
        })
        
        if (data.jobs?.length === 0) {
          if (page > 1) {
            setConnectionError('No more jobs found. Go back to previous page.')
          } else {
            setConnectionError('No jobs found. Connect Upwork or update prompts settings.')
          }
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Page ${data.page}/${data.totalPages} - ${data.jobs.length} real jobs`)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs.')
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
      loadJobs(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const totalPages = pagination.totalPages
    const currentPage = pagination.currentPage
    
    // Show first page, current page, and last page with ellipsis
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
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
      {/* ✅ Main Content WITHOUT extra sidebar */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected 
                  ? `📊 Showing ${pagination.totalJobs.toLocaleString()} real jobs from Upwork` 
                  : '🔗 Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex gap-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  🔗 Connect Upwork
                </button>
              )}
              <button 
                onClick={() => loadJobs(pagination.currentPage)}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {jobsLoading ? '🔄 Loading...' : '🔄 Refresh Jobs'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {upworkConnected && pagination.totalJobs > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{pagination.totalJobs.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Jobs</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{jobs.length}</div>
              <div className="text-sm text-gray-600">Jobs This Page</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{pagination.currentPage}</div>
              <div className="text-sm text-gray-600">Current Page</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{pagination.totalPages}</div>
              <div className="text-sm text-gray-600">Total Pages</div>
            </div>
          </div>
        )}

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
                onClick={() => loadJobs(pagination.currentPage)}
                className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
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
                {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork First'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length > 0 ? `Showing ${jobs.length} jobs (Page ${pagination.currentPage})` : 'No jobs found'}
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
                  {upworkConnected ? 'No Jobs Found On This Page' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try going to a different page or refreshing.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                {upworkConnected ? (
                  <button 
                    onClick={() => loadJobs(1)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Go to First Page
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
              <>
                {/* Jobs List */}
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600 transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded text-sm">
                            {job.budget}
                          </span>
                          <span className="text-sm text-gray-600">
                            <span className="font-medium">{job.client.name}</span> • {job.postedDate} • {job.client.country} •
                            Rating: <span className="font-medium">{job.client.rating} ⭐</span>
                          </span>
                        </div>
                      </div>
                      <button 
                        className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJobClick(job)
                        }}
                      >
                        Generate Proposal
                      </button>
                    </div>
                    
                    <p className="text-gray-700 mb-4 line-clamp-2">{job.description.substring(0, 250)}...</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 3 && (
                          <span className="text-gray-500 text-sm">+{job.skills.length - 3} more</span>
                        )}
                        <span className="text-gray-500 text-sm">
                          {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'} • {job.jobType}
                        </span>
                      </div>
                      
                      <span className="text-sm text-gray-600 font-medium">
                        Click to generate proposal →
                      </span>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="p-6 border-t border-gray-200">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                      <div className="text-sm text-gray-600 mb-4 md:mb-0">
                        Showing page {pagination.currentPage} of {pagination.totalPages} • {pagination.totalJobs.toLocaleString()} total jobs
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Previous Button */}
                        <button
                          onClick={() => handlePageChange(pagination.currentPage - 1)}
                          disabled={!pagination.hasPrev || jobsLoading}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ← Previous
                        </button>
                        
                        {/* Page Numbers */}
                        <div className="flex items-center space-x-1">
                          {getPageNumbers().map((pageNum, index) => (
                            pageNum === '...' ? (
                              <span key={`dots-${index}`} className="px-3 py-2 text-gray-500">
                                ...
                              </span>
                            ) : (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum as number)}
                                disabled={jobsLoading}
                                className={`px-4 py-2 rounded-lg ${
                                  pagination.currentPage === pageNum
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            )
                          ))}
                        </div>
                        
                        {/* Next Button */}
                        <button
                          onClick={() => handlePageChange(pagination.currentPage + 1)}
                          disabled={!pagination.hasNext || jobsLoading}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next →
                        </button>
                      </div>
                      
                      <div className="mt-4 md:mt-0">
                        <span className="text-sm text-gray-600">Go to page:</span>
                        <input
                          type="number"
                          min="1"
                          max={pagination.totalPages}
                          defaultValue={pagination.currentPage}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(e.currentTarget.value)
                              if (page >= 1 && page <= pagination.totalPages) {
                                handlePageChange(page)
                              }
                            }
                          }}
                          className="ml-2 w-20 px-3 py-1 border border-gray-300 rounded-lg text-center"
                          placeholder="Page"
                        />
                      </div>
                    </div>
                    
                    {/* Quick Page Navigation */}
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {[1, 2, 3, 4, 5].map(num => (
                        pagination.totalPages >= num && (
                          <button
                            key={num}
                            onClick={() => handlePageChange(num)}
                            disabled={jobsLoading}
                            className={`px-3 py-1 text-sm rounded ${
                              pagination.currentPage === num
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </button>
                        )
                      ))}
                      {pagination.totalPages > 10 && (
                        <>
                          <span className="px-2 text-gray-500">...</span>
                          <button
                            onClick={() => handlePageChange(Math.floor(pagination.totalPages / 2))}
                            disabled={jobsLoading}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            {Math.floor(pagination.totalPages / 2)}
                          </button>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages - 2)}
                            disabled={jobsLoading}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            {pagination.totalPages - 2}
                          </button>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages - 1)}
                            disabled={jobsLoading}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            {pagination.totalPages - 1}
                          </button>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages)}
                            disabled={jobsLoading}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            {pagination.totalPages}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Job Popup */}
      {selectedJob && user && (
        <JobPopup 
          job={selectedJob}
          user={user}
          onClose={() => setSelectedJob(null)}
          onProposalGenerated={(proposal) => console.log('Proposal generated:', proposal)}
        />
      )}
    </div>
  )
}