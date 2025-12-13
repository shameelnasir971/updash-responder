// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  
  // ✅ PAGINATION STATES
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })
  
  // ✅ POPUP STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [editProposalText, setEditProposalText] = useState('')

  useEffect(() => {
    checkAuth()
    // Get page from URL or default to 1
    const page = parseInt(searchParams.get('page') || '1')
    setPagination(prev => ({ ...prev, page }))
    loadJobs(page)
  }, [searchParams])

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
      console.log(`🔄 Loading REAL jobs for page ${page}...`)
      
      const url = `/api/upwork/jobs?page=${page}&limit=${pagination.limit}&refresh=${page === 1 ? 'true' : 'false'}`
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
        page: data.page,
        pages: data.pages,
        message: data.message
      })

      if (data.success) {
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Update pagination info
        if (data.total !== undefined && data.pages !== undefined) {
          setPagination({
            page: data.page || page,
            limit: data.limit || pagination.limit,
            total: data.total || 0,
            pages: data.pages || 1
          })
        }
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try adjusting your filters.')
        } else if (data.jobs?.length > 0) {
          // ✅ SUCCESS MESSAGE
          const startJob = (page - 1) * pagination.limit + 1
          const endJob = startJob + data.jobs.length - 1
          setConnectionError(`✅ Success! Showing ${data.jobs.length} real jobs (${startJob}-${endJob} of ${data.total || 'many'})`)
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

  // ✅ PAGINATION FUNCTIONS
  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.pages) return
    setPagination(prev => ({ ...prev, page }))
    router.push(`/dashboard?page=${page}`)
    loadJobs(page)
  }

  const handlePageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const page = parseInt(e.target.value)
    goToPage(page)
  }

  // ✅ REFRESH JOBS
  const handleRefreshJobs = () => {
    loadJobs(pagination.page)
  }

  // ✅ JOB CLICK HANDLER
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setProposal('')
    setEditProposalText('')
    setEditingProposal(false)
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
        setEditProposalText(data.proposal)
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

  // ✅ SAVE PROPOSAL FUNCTION
  const handleSaveProposal = async () => {
    if (!selectedJob || !proposal) return
    
    setSavingProposal(true)
    try {
      const response = await fetch('/api/proposals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          jobDescription: selectedJob.description,
          clientInfo: selectedJob.client,
          budget: selectedJob.budget,
          skills: selectedJob.skills,
          proposalText: editingProposal ? editProposalText : proposal,
          status: 'saved'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert('✅ Proposal saved to history!')
        // Close popup
        setShowJobPopup(false)
        setSelectedJob(null)
      } else {
        alert('❌ Failed to save: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Save error:', error)
      alert('❌ Error saving proposal: ' + error.message)
    } finally {
      setSavingProposal(false)
    }
  }

  // ✅ SEND PROPOSAL FUNCTION (UPWORK + HISTORY)
  const handleSendProposal = async () => {
    if (!selectedJob || !proposal) return
    
    setSendingProposal(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          proposalText: editingProposal ? editProposalText : proposal,
          originalProposal: proposal,
          editReason: editingProposal ? 'User edited before sending' : 'Original AI proposal'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        const successMessage = data.upworkSent 
          ? '✅ Proposal sent to Upwork and saved to history!' 
          : '✅ Proposal saved to history (Upwork not connected)'
        alert(successMessage)
        
        // Close popup
        setShowJobPopup(false)
        setSelectedJob(null)
      } else {
        alert('❌ Failed to send: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Send error:', error)
      alert('❌ Error sending proposal: ' + error.message)
    } finally {
      setSendingProposal(false)
    }
  }

  // ✅ EDIT PROPOSAL TOGGLE
  const toggleEditProposal = () => {
    if (editingProposal) {
      // Save edited changes
      setProposal(editProposalText)
    }
    setEditingProposal(!editingProposal)
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
                {upworkConnected ? ' Real Upwork Jobs' : 'Connect Upwork to see real jobs'}
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

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
          }`}>
            <span>{connectionError}</span>
            <div className="flex space-x-2">
              <button 
                onClick={handleRefreshJobs}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
              <button 
                onClick={() => loadJobs(1)}
                className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Pagination Controls - TOP */}
        {pagination.pages > 1 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-semibold">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span> of{' '}
                <span className="font-semibold">{pagination.total}</span> real jobs
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Page Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Page:</span>
                  <select 
                    value={pagination.page}
                    onChange={handlePageChange}
                    className="border border-gray-300 rounded px-3 py-1 text-sm"
                  >
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(pageNum => (
                      <option key={pageNum} value={pageNum}>
                        {pageNum}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">of {pagination.pages}</span>
                </div>
                
                {/* Page Navigation */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                  
                  {/* Page Numbers */}
                  {(() => {
                    const pages = []
                    const maxVisible = 5
                    let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2))
                    let end = Math.min(pagination.pages, start + maxVisible - 1)
                    
                    // Adjust start if we're near the end
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1)
                    }
                    
                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => goToPage(i)}
                          className={`px-3 py-1 border rounded ${
                            pagination.page === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {i}
                        </button>
                      )
                    }
                    
                    return pages
                  })()}
                  
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork'}
                </h2>
                <p className="text-sm text-gray-600">
                  {jobs.length > 0 && `Page ${pagination.page} of ${pagination.pages}`}
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  onClick={handleRefreshJobs}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {jobsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    '🔄 Refresh Jobs'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading real jobs from Upwork...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {upworkConnected 
                    ? 'No jobs match your current filters. Try adjusting keywords or budget in Prompts page, or check back later for new jobs.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                {upworkConnected ? (
                  <button 
                    onClick={() => router.push('/dashboard/prompts')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adjust Filters
                  </button>
                ) : (
                  <button 
                    onClick={handleConnectUpwork}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Connect Upwork Account
                  </button>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-blue-500"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    <span className="font-medium">Client:</span> {job.client.name} • 
                    <span className="ml-2">📅 {job.postedDate}</span> • 
                    <span className="ml-2">📍 {job.client.country}</span> •
                    <span className="ml-2">⭐ {job.client.rating}/5</span>
                  </p>
                  
                  <p className="text-gray-700 mb-3">{job.description.substring(0, 250)}...</p>
                  
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
                      <span className="text-gray-500 text-sm ml-2">
                        📝 {job.proposals} proposals
                      </span>
                    </div>
                    
                    <button 
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
                    >
                      Generate Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination Controls - BOTTOM */}
        {pagination.pages > 1 && jobs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
            <div className="flex flex-col items-center">
              <div className="flex space-x-2 mb-4">
                {pagination.page > 1 && (
                  <button
                    onClick={() => goToPage(1)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    « First
                  </button>
                )}
                
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  ← Previous
                </button>
                
                {/* Page numbers */}
                {(() => {
                  const pages = []
                  const totalPages = pagination.pages
                  const currentPage = pagination.page
                  
                  // Always show first page
                  if (currentPage > 3) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => goToPage(1)}
                        className={`px-3 py-1 rounded ${1 === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                      >
                        1
                      </button>
                    )
                    if (currentPage > 4) {
                      pages.push(<span key="ellipsis1" className="px-2">...</span>)
                    }
                  }
                  
                  // Show pages around current
                  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => goToPage(i)}
                        className={`px-3 py-1 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                      >
                        {i}
                      </button>
                    )
                  }
                  
                  // Always show last page
                  if (currentPage < totalPages - 2) {
                    if (currentPage < totalPages - 3) {
                      pages.push(<span key="ellipsis2" className="px-2">...</span>)
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => goToPage(totalPages)}
                        className={`px-3 py-1 rounded ${totalPages === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                      >
                        {totalPages}
                      </button>
                    )
                  }
                  
                  return pages
                })()}
                
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next →
                </button>
                
                {pagination.page < pagination.pages && (
                  <button
                    onClick={() => goToPage(pagination.pages)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Last »
                  </button>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Real Jobs:</span> Page {pagination.page} of {pagination.pages} • 
                Total {pagination.total} jobs • {pagination.limit} per page
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ JOB DETAIL POPUP */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">{selectedJob.budget}</span>
                    <span>•</span>
                    <span>📅 Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>👤 Client: {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>⭐ Rating: {selectedJob.client.rating}/5</span>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Job Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
                
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Client Info</h4>
                    <p className="text-blue-700">Name: {selectedJob.client.name}</p>
                    <p className="text-blue-700">Country: {selectedJob.client.country}</p>
                    <p className="text-blue-700">Total Spent: ${selectedJob.client.totalSpent.toLocaleString()}</p>
                    <p className="text-blue-700">Total Hires: {selectedJob.client.totalHires}</p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h4 className="text-sm font-medium text-green-900 mb-1">Job Info</h4>
                    <p className="text-green-700">Skills: {selectedJob.skills.join(', ')}</p>
                    <p className="text-green-700">Proposals: {selectedJob.proposals}</p>
                    <p className="text-green-700">Verified: {selectedJob.verified ? '✅ Yes' : '⚠️ No'}</p>
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Proposal</h3>
                  
                  {!proposal && (
                    <button
                      onClick={handleGenerateProposal}
                      disabled={generatingProposal}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                      {generatingProposal ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        '🤖 Generate Proposal'
                      )}
                    </button>
                  )}
                </div>

                {proposal ? (
                  <div className="space-y-4">
                    {/* Proposal Display/Edit */}
                    {editingProposal ? (
                      <textarea
                        value={editProposalText}
                        onChange={(e) => setEditProposalText(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Edit your proposal..."
                      />
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <p className="text-gray-700 whitespace-pre-wrap">{proposal}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4">
                      {/* Edit Toggle Button */}
                      <button
                        onClick={toggleEditProposal}
                        className={`px-4 py-2 rounded-lg font-medium ${
                          editingProposal 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-yellow-600 text-white hover:bg-yellow-700'
                        }`}
                      >
                        {editingProposal ? '💾 Save Edit' : '✏️ Edit Proposal'}
                      </button>

                      {/* Save Button */}
                      <button
                        onClick={handleSaveProposal}
                        disabled={savingProposal}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingProposal ? 'Saving...' : '💾 Save to History'}
                      </button>

                      {/* Send Button */}
                      <button
                        onClick={handleSendProposal}
                        disabled={sendingProposal}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {sendingProposal ? 'Sending...' : '🚀 Send to Upwork'}
                      </button>

                      {/* Close Button */}
                      <button
                        onClick={() => setShowJobPopup(false)}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Close
                      </button>
                    </div>
                    
                    {/* AI Training Info */}
                    <div className="text-sm text-gray-500 mt-4">
                      💡 AI will learn from your edits to generate better proposals next time!
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border">
                    <div className="text-gray-400 mb-4 text-6xl">🤖</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Proposal Generated Yet</h3>
                    <p className="text-gray-500 mb-6">
                      Click "Generate Proposal" to create a professional proposal using AI
                    </p>
                    <p className="text-sm text-gray-400">
                      AI will use your prompts from Settings page to personalize the proposal
                    </p>
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