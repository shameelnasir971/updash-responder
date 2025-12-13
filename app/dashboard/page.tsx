// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
// import JobPopup from '@/components/JobPopup' 

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
    rating: string
    country: string
    totalSpent: number
    totalHires: number
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  jobType?: string
  experienceLevel?: string
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
  const [connecting, setConnecting] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)
  const [perPage] = useState(50)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPrevPage, setHasPrevPage] = useState(false)

  // Popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs()
  }, [currentPage])

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

  const loadJobs = async (page: number = currentPage) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading page ${page} with ${perPage} jobs...`)
      
      const response = await fetch(`/api/upwork/jobs?page=${page}&perPage=${perPage}`)
      
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
        setHasNextPage(data.hasNextPage || false)
        setHasPrevPage(data.hasPrevPage || false)
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try adjusting your filters.')
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
    } finally {
      setJobsLoading(false)
    }
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to connect: ' + (data.error || 'Unknown error'))
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowJobPopup(true)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const refreshJobs = () => {
    loadJobs(currentPage)
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
                {upworkConnected ? `Real Upwork Jobs • Page ${currentPage} of ${totalPages}` : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${upworkConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {upworkConnected ? '✅ Connected' : '❌ Not Connected'}
              </div>
              
              {!upworkConnected ? (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Upwork'}
                </button>
              ) : (
                <button 
                  onClick={refreshJobs}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {upworkConnected && totalJobs > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{totalJobs.toLocaleString()}</div>
              <div className="text-gray-600 text-sm">Total Jobs</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{currentPage}</div>
              <div className="text-gray-600 text-sm">Current Page</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{perPage}</div>
              <div className="text-gray-600 text-sm">Jobs Per Page</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{totalPages}</div>
              <div className="text-gray-600 text-sm">Total Pages</div>
            </div>
          </div>
        )}

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
          }`}>
            <span>{connectionError}</span>
            <button 
              onClick={refreshJobs}
              className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? `Upwork Jobs (Page ${currentPage})` : 'Connect Upwork'}
              </h2>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  Showing {jobs.length} of {totalJobs.toLocaleString()} jobs
                </span>
                <button 
                  onClick={refreshJobs}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Loading...' : 'Refresh Jobs'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try adjusting your filters in Prompts page or refresh.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                {upworkConnected ? (
                  <button 
                    onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Browse Upwork Directly
                  </button>
                ) : (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Connect Upwork
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
                    <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    Client: {job.client.name} • {job.postedDate} • {job.client.country} •
                    Rating: {job.client.rating} ⭐ • {job.proposals} proposals
                  </p>
                  
                  <p className="text-gray-700 mb-3">{job.description.substring(0, 250)}...</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className="text-gray-500 text-xs">
                          +{job.skills.length - 3} more
                        </span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                      </span>
                    </div>
                    
                    <button 
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} • {totalJobs.toLocaleString()} total jobs
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    First
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!hasPrevPage}
                    className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-2 py-2">...</span>
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasNextPage}
                    className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Job Popup Component */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">{selectedJob.budget}</span>
                    <span>•</span>
                    <span>Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>Client: {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>Rating: {selectedJob.client.rating} ⭐</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Client Information</h4>
                  <p className="text-blue-800">Name: {selectedJob.client.name}</p>
                  <p className="text-blue-800">Country: {selectedJob.client.country}</p>
                  <p className="text-blue-800">Rating: {selectedJob.client.rating}/5</p>
                  <p className="text-blue-800">Total Spent: ${selectedJob.client.totalSpent}</p>
                  <p className="text-blue-800">Total Hires: {selectedJob.client.totalHires}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Job Details</h4>
                  <p className="text-green-800">Proposals: {selectedJob.proposals}</p>
                  <p className="text-green-800">Category: {selectedJob.category}</p>
                  <p className="text-green-800">Job Type: {selectedJob.jobType}</p>
                  <p className="text-green-800">Experience: {selectedJob.experienceLevel}</p>
                  <p className="text-green-800">Verified: {selectedJob.verified ? 'Yes' : 'No'}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-6">
                <div className="flex justify-between">
                  <button
                    onClick={() => {
                      // Handle generate proposal
                      setShowJobPopup(false)
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    🤖 Generate Proposal
                  </button>
                  <button
                    onClick={() => setShowJobPopup(false)}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}