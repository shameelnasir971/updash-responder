// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'

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
    verified: boolean
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  jobType?: string
  experienceLevel?: string
  duration?: string
  source?: string
  isRealJob?: boolean
}

interface Pagination {
  page: number
  perPage: number
  totalPages: number
  totalItems: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  
  // ✅ PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage] = useState(50)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  
  // ✅ POPUP STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs(currentPage)
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

  const loadJobs = async (page: number = 1) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading REAL jobs - Page ${page}...`)
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
        page: data.pagination?.page,
        totalPages: data.pagination?.totalPages
      })

      if (data.success) {
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // ✅ SET PAGINATION
        if (data.pagination) {
          setCurrentPage(data.pagination.page || 1)
          setTotalPages(data.pagination.totalPages || 1)
          setTotalItems(data.pagination.totalItems || 0)
          setHasNextPage(data.pagination.hasNextPage || false)
          setHasPreviousPage(data.pagination.hasPreviousPage || false)
        }
        
        // ✅ SUCCESS MESSAGE
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try adjusting filters.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Page ${page} of ${data.pagination?.totalPages || 1} | ${data.jobs.length} jobs loaded`)
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

  // ✅ JOB CLICK HANDLER
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setProposal('')
    setShowJobPopup(true)
  }

  // ✅ GENERATE PROPOSAL FUNCTION
  const handleGenerateProposal = async () => {
    if (!selectedJob) return
    
    setGeneratingProposal(true)
    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          jobDescription: selectedJob.description,
          clientInfo: selectedJob.client,
          budget: selectedJob.budget,
          skills: selectedJob.skills
        })
      })

      const data = await response.json()
      
      if (data.success && data.proposal) {
        setProposal(data.proposal)
        alert('✅ Proposal generated successfully!')
      } else {
        alert('❌ Failed to generate proposal: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Generate error:', error)
      alert('❌ Error generating proposal: ' + error.message)
    } finally {
      setGeneratingProposal(false)
    }
  }

  // ✅ PAGINATION FUNCTIONS
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const goToPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // ✅ GENERATE PAGE NUMBERS FOR PAGINATION
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, start + maxVisible - 1)
      
      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1)
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
      {/* ✅ Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upwork Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Real-time Upwork jobs' : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${upworkConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {upworkConnected ? '✅ Connected' : '❌ Not Connected'}
              </div>
              
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Upwork'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
            <div className="text-gray-600 text-sm">Total Jobs</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
            <div className="text-gray-600 text-sm">Current Page</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">Page {currentPage} of {totalPages}</div>
            <div className="text-gray-600 text-sm">Pagination</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{perPage}</div>
            <div className="text-gray-600 text-sm">Jobs Per Page</div>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
          }`}>
            <span>{connectionError}</span>
            <button 
              onClick={() => loadJobs(currentPage)}
              className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork'}
                </h2>
                <p className="text-gray-600 text-sm">
                  Showing {jobs.length} jobs • Page {currentPage} of {totalPages}
                </p>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => loadJobs(currentPage)}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Loading...' : '🔄 Refresh Jobs'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading real jobs from Upwork...</p>
                <p className="text-gray-400 text-sm mt-2">This may take a few seconds</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try adjusting your filters or check if Upwork has available jobs.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                {upworkConnected && (
                  <button 
                    onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Browse Upwork Directly
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Jobs List */}
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-blue-500"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">{job.title}</h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                            {job.client.name}
                          </span>
                          <span>•</span>
                          <span>{job.postedDate}</span>
                          <span>•</span>
                          <span>{job.client.country}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            {job.client.rating} ⭐
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
                        {job.budget}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4 line-clamp-2">{job.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 4).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-lg border border-blue-200">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="text-gray-500 text-xs">+{job.skills.length - 4} more</span>
                        )}
                        <span className="text-gray-500 text-sm ml-2">
                          📨 {job.proposals} proposals
                        </span>
                        {job.client.verified && (
                          <span className="text-green-600 text-sm">✅ Verified</span>
                        )}
                      </div>
                      
                      <button 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJobClick(job)
                        }}
                      >
                        Generate Proposal
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-6 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        Showing {jobs.length} of {totalItems} jobs
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Previous Button */}
                        <button
                          onClick={goToPreviousPage}
                          disabled={!hasPreviousPage || jobsLoading}
                          className={`px-3 py-2 rounded-lg ${hasPreviousPage ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-100 text-gray-400'} disabled:opacity-50`}
                        >
                          ← Previous
                        </button>
                        
                        {/* Page Numbers */}
                        <div className="flex space-x-1">
                          {getPageNumbers().map(pageNum => (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                currentPage === pageNum 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              } ${jobsLoading ? 'opacity-50' : ''}`}
                              disabled={jobsLoading}
                            >
                              {pageNum}
                            </button>
                          ))}
                          
                          {/* Ellipsis for many pages */}
                          {totalPages > 5 && currentPage < totalPages - 2 && (
                            <span className="px-2">...</span>
                          )}
                          
                          {/* Last Page */}
                          {totalPages > 5 && currentPage < totalPages - 1 && (
                            <button
                              onClick={() => goToPage(totalPages)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                currentPage === totalPages 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                            >
                              {totalPages}
                            </button>
                          )}
                        </div>
                        
                        {/* Next Button */}
                        <button
                          onClick={goToNextPage}
                          disabled={!hasNextPage || jobsLoading}
                          className={`px-3 py-2 rounded-lg ${hasNextPage ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-100 text-gray-400'} disabled:opacity-50`}
                        >
                          Next →
                        </button>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ✅ JOB DETAIL POPUP */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded border border-green-200">
                      {selectedJob.budget}
                    </span>
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                      {selectedJob.client.name}
                    </span>
                    <span>•</span>
                    <span>Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>{selectedJob.client.country}</span>
                    <span>•</span>
                    <span className="flex items-center">
                      {selectedJob.client.rating} ⭐ Rating
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-200"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Job Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Job Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
                
                {/* Job Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">👤 Client Info</h4>
                    <div className="space-y-1 text-blue-800">
                      <p><span className="font-semibold">Name:</span> {selectedJob.client.name}</p>
                      <p><span className="font-semibold">Country:</span> {selectedJob.client.country}</p>
                      <p><span className="font-semibold">Total Spent:</span> ${selectedJob.client.totalSpent}</p>
                      <p><span className="font-semibold">Total Hires:</span> {selectedJob.client.totalHires}</p>
                      <p><span className="font-semibold">Rating:</span> {selectedJob.client.rating} ⭐</p>
                      <p><span className="font-semibold">Status:</span> {selectedJob.client.verified ? '✅ Verified' : '⚠️ Not Verified'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <h4 className="text-sm font-medium text-green-900 mb-2">📊 Job Info</h4>
                    <div className="space-y-1 text-green-800">
                      <p><span className="font-semibold">Job Type:</span> {selectedJob.jobType || 'Not specified'}</p>
                      <p><span className="font-semibold">Experience Level:</span> {selectedJob.experienceLevel || 'Not specified'}</p>
                      <p><span className="font-semibold">Duration:</span> {selectedJob.duration || 'Not specified'}</p>
                      <p><span className="font-semibold">Category:</span> {selectedJob.category || 'General'}</p>
                      <p><span className="font-semibold">Proposals:</span> {selectedJob.proposals}</p>
                      <p><span className="font-semibold">Source:</span> {selectedJob.source || 'Upwork'}</p>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">🛠️ Required Skills:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-lg border border-purple-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">💌 Proposal</h3>
                  
                  {!proposal && (
                    <button
                      onClick={handleGenerateProposal}
                      disabled={generatingProposal}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 flex items-center shadow-md"
                    >
                      {generatingProposal ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🤖</span>
                          Generate Professional Proposal
                        </>
                      )}
                    </button>
                  )}
                </div>

                {proposal ? (
                  <div className="space-y-6">
                    {/* Proposal Display */}
                    <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg border shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900">Your Proposal</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(proposal)
                            alert('✅ Proposal copied to clipboard!')
                          }}
                          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
                        >
                          📋 Copy
                        </button>
                      </div>
                      <div className="bg-white p-4 rounded border">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{proposal}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          // Save to history
                          fetch('/api/proposals/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              jobId: selectedJob.id,
                              jobTitle: selectedJob.title,
                              proposalText: proposal,
                              status: 'saved'
                            })
                          }).then(() => {
                            alert('✅ Proposal saved to history!')
                            setShowJobPopup(false)
                          })
                        }}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 flex items-center"
                      >
                        💾 Save to History
                      </button>

                      <button
                        onClick={() => {
                          // Send to Upwork
                          fetch('/api/proposals/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              jobId: selectedJob.id,
                              jobTitle: selectedJob.title,
                              proposalText: proposal
                            })
                          }).then(() => {
                            alert('✅ Proposal sent to Upwork!')
                            setShowJobPopup(false)
                          })
                        }}
                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 flex items-center"
                      >
                        🚀 Send to Upwork
                      </button>

                      <button
                        onClick={() => setShowJobPopup(false)}
                        className="bg-gray-600 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200">
                    <div className="text-gray-400 mb-4 text-6xl">🤖</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Ready to Generate Proposal</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      Click the button above to generate a professional proposal using AI.
                      The AI will use your profile information from the Prompts page.
                    </p>
                    <div className="text-sm text-gray-400">
                      💡 Tip: Make sure your profile is complete in the Prompts section for better proposals.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}