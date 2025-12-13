// app/dashboard/page.tsx 
'use client'

import router from 'next/router'
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

  // ✅ PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1)
  const [jobsPerPage] = useState(20) // 20 jobs per page
  const [totalPages, setTotalPages] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)

  // ✅ POPUP STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [editProposalText, setEditProposalText] = useState('')

  // ✅ FETCH JOBS WITH PAGINATION
  const loadJobs = async (page: number = 1) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading jobs for page ${page}...`)
      const response = await fetch(`/api/upwork/jobs?page=${page}&limit=${jobsPerPage}`)
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Jobs Data:', {
        success: data.success,
        count: data.jobs?.length,
        total: data.totalJobs,
        pages: data.totalPages,
        message: data.message
      })

      if (data.success) {
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs || [])
        setTotalJobs(data.totalJobs || 0)
        setTotalPages(data.totalPages || 1)
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try adjusting your filters.')
        } else if (data.jobs?.length > 0) {
          // ✅ SUCCESS MESSAGE
          const startJob = ((page - 1) * jobsPerPage) + 1
          const endJob = Math.min(page * jobsPerPage, data.totalJobs)
          setConnectionError(`✅ Loaded ${data.jobs.length} jobs (${startJob}-${endJob} of ${data.totalJobs})`)
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
      setTotalJobs(0)
      setTotalPages(1)
    } finally {
      setJobsLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
    loadJobs(1)
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

  // ✅ PAGE CHANGE HANDLER
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    loadJobs(page)
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ✅ PAGINATION COMPONENT
  const Pagination = () => {
    const pageNumbers = []
    const maxPagesToShow = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i)
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-6">
        {/* First Page */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          « First
        </button>

        {/* Previous Page */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ‹ Prev
        </button>

        {/* Page Numbers */}
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => handlePageChange(number)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg ${
              currentPage === number
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {number}
          </button>
        ))}

        {/* Next Page */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next ›
        </button>

        {/* Last Page */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Last »
        </button>
      </div>
    )
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
                {upworkConnected ? 'Real Upwork jobs with smart filtering' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            {/* Connection Status & Stats */}
            <div className="flex items-center space-x-4">
              {upworkConnected && totalJobs > 0 && (
                <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                  📊 {totalJobs} jobs total
                </div>
              )}
              
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
        {upworkConnected && totalJobs > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Total Jobs</div>
              <div className="text-2xl font-bold text-gray-900">{totalJobs}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Current Page</div>
              <div className="text-2xl font-bold text-gray-900">{currentPage} of {totalPages}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Jobs This Page</div>
              <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Per Page</div>
              <div className="text-2xl font-bold text-gray-900">{jobsPerPage}</div>
            </div>
          </div>
        )}

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
                onClick={() => loadJobs(currentPage)}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
              <button 
                onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              >
                Browse Upwork
              </button>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork'}
              </h2>
              <div className="flex space-x-3">
                {upworkConnected && totalJobs > 0 && (
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} • Showing {Math.min(jobs.length, jobsPerPage)} jobs
                  </div>
                )}
                <button 
                  onClick={() => loadJobs(currentPage)}
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
                <p className="text-gray-600">Loading real Upwork jobs...</p>
                <p className="text-sm text-gray-500 mt-2">Fetching latest job listings from Upwork</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Jobs Match Your Filters' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {upworkConnected 
                    ? 'Try adjusting your keywords or budget range in the Prompts page.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                <div className="space-x-3">
                  {upworkConnected && (
                    <button 
                      onClick={() => router.push('/dashboard/prompts')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Adjust Filters
                    </button>
                  )}
                  <button 
                    onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Browse Upwork
                  </button>
                </div>
              </div>
            ) : (
              <>
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-blue-500"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                          {job.verified && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                              ✅ Verified
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {job.category || 'General'}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">
                          📍 {job.client.country} • ⭐ {job.client.rating} • 👤 {job.client.name} • 📅 {job.postedDate} • 📨 {job.proposals} proposals
                        </p>
                      </div>
                      <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
                        {job.budget}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4 line-clamp-2">{job.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 4).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="text-gray-500 text-sm">
                            +{job.skills.length - 4} more
                          </span>
                        )}
                      </div>
                      
                      <button 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJobClick(job)
                        }}
                      >
                        🤖 Generate Proposal
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * jobsPerPage + 1} to {Math.min(currentPage * jobsPerPage, totalJobs)} of {totalJobs} jobs
                </div>
                <Pagination />
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        {upworkConnected && totalJobs > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="text-blue-600 mr-3">💡</div>
              <div className="text-sm text-blue-800">
                <strong>Real-time Jobs:</strong> These are live jobs fetched directly from Upwork API. 
                Click any job to generate a personalized proposal. Jobs are automatically filtered based on your settings in the Prompts page.
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
                    <span>Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>Client: {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>Rating: {selectedJob.client.rating} ⭐</span>
                    <span>•</span>
                    <span>Proposals: {selectedJob.proposals}</span>
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
                <div className="grid grid-cols-2 gap-4 mt-4">
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
                    <p className="text-green-700">Verified: {selectedJob.verified ? 'Yes ✅' : 'No ⚠️'}</p>
                    <p className="text-green-700">Category: {selectedJob.category || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">AI Proposal Generator</h3>
                  
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