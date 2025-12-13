// app/dashboard/page.tsx 
'use client'

import { useState, useEffect, useCallback } from 'react'
// import debounce from 'lodash/debounce'
import Sidebar from '@/components/Layout/Sidebar'

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
  jobType?: string
  experienceLevel?: string
  source?: string
  isRealJob?: boolean
  duration?: string
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalJobs: number
  jobsPerPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalJobs: 0,
    jobsPerPage: 50,
    hasNextPage: false,
    hasPrevPage: false
  })
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  // ✅ POPUP STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [editProposalText, setEditProposalText] = useState('')

  // Check authentication
  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-refresh jobs every 2 minutes
  useEffect(() => {
    if (!autoRefresh || !upworkConnected) return
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing jobs...')
      loadJobs(pagination.currentPage, searchQuery, false)
    }, 120000) // 2 minutes
    
    return () => clearInterval(interval)
  }, [autoRefresh, upworkConnected, pagination.currentPage, searchQuery])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadJobs(1, '')
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async (page: number = 1, search: string = '', showLoading: boolean = true) => {
    if (showLoading) setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log(`📥 Loading jobs - Page: ${page}, Search: "${search}"`)
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50'
      })
      
      if (search.trim()) {
        params.append('search', search.trim())
      }
      
      const response = await fetch(`/api/upwork/jobs?${params.toString()}`)
      
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
          if (search) {
            setConnectionError(`No jobs found for "${search}". Try different keywords.`)
          } else {
            setConnectionError(data.message || 'No jobs found. Try refreshing or adjust your filter settings.')
          }
        } else {
          setConnectionError(data.message || '')
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalJobs: 0,
          jobsPerPage: 50,
          hasNextPage: false,
          hasPrevPage: false
        })
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check your connection.')
      setJobs([])
    } finally {
      if (showLoading) setJobsLoading(false)
    }
  }

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      loadJobs(1, query)
    }, 500),
    []
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    debouncedSearch(value)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadJobs(1, searchQuery)
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

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Logout error:', error)
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

  // ✅ SEND PROPOSAL FUNCTION
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
      setProposal(editProposalText)
    }
    setEditingProposal(!editingProposal)
  }

  // ✅ PAGINATION HANDLERS
  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return
    loadJobs(page, searchQuery)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      handlePageChange(pagination.currentPage - 1)
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const total = pagination.totalPages
    const current = pagination.currentPage
    const pages: (number | string)[] = []
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', total)
      } else if (current >= total - 2) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total)
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', total)
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
      {/* Sidebar */}
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        handleSignOut={handleSignOut}
      />

      {/* ✅ Main Content */}
      <div className="lg:pl-80">
        <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {upworkConnected ? '📡 Connected to Upwork - Real-time jobs' : 'Connect Upwork to see real jobs'}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Auto-refresh toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Auto-refresh:</span>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${autoRefresh ? 'bg-green-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${autoRefresh ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                {/* Connection Status */}
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
                
                {/* Refresh Button */}
                <button 
                  onClick={() => loadJobs(pagination.currentPage, searchQuery)}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? '🔄 Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="🔍 Search jobs by title, skills, or description..."
                  className="w-full px-4 py-3 pl-12 pr-24 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute left-4 top-3.5 text-gray-400">
                  🔍
                </div>
                <div className="absolute right-2 top-1.5">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
                  >
                    Search
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tip: Copy job title from Upwork and paste here to find similar jobs
              </p>
            </form>
          </div>

          {/* Error/Success Message */}
          {connectionError && (
            <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
              connectionError.includes('✅') || connectionError.includes('Found')
                ? 'bg-green-100 text-green-700 border border-green-400' 
                : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
            }`}>
              <div className="flex items-center">
                <span className="mr-2">
                  {connectionError.includes('✅') ? '✅' : 'ℹ️'}
                </span>
                <span>{connectionError}</span>
              </div>
              {connectionError.includes('No jobs') && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}

          {/* Jobs Counter */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Jobs Found</h3>
                  <p className="text-gray-600">
                    Showing <span className="font-bold">{jobs.length}</span> of <span className="font-bold">{pagination.totalJobs}</span> jobs
                    {searchQuery && <span> for "<span className="font-semibold">{searchQuery}</span>"</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Page {pagination.currentPage} of {pagination.totalPages}</p>
                  <p className="text-xs text-gray-500">
                    {autoRefresh ? '🔄 Auto-refresh every 2 minutes' : 'Auto-refresh disabled'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading jobs...</p>
                <p className="text-sm text-gray-500 mt-2">Fetching real-time data from Upwork</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No Jobs Found' : 'No Jobs Available'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchQuery 
                    ? `No jobs found for "${searchQuery}". Try different keywords or browse all jobs.`
                    : upworkConnected 
                      ? 'No jobs match your current filters. Try adjusting your settings in the Prompts page.'
                      : 'Connect your Upwork account to see real jobs from the marketplace.'
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                    >
                      Clear Search
                    </button>
                  )}
                  {!upworkConnected && (
                    <button 
                      onClick={handleConnectUpwork}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                    >
                      Connect Upwork
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {jobs.map((job, index) => (
                    <div 
                      key={`${job.id}_${index}`}
                      className="p-6 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-blue-500"
                      onClick={() => handleJobClick(job)}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg flex-1">
                              {job.title}
                            </h3>
                            <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded whitespace-nowrap">
                              {job.budget}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                            <span className="flex items-center">
                              👤 {job.client.name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center">
                              ⭐ {job.client.rating}/5
                            </span>
                            <span>•</span>
                            <span className="flex items-center">
                              📍 {job.client.country}
                            </span>
                            <span>•</span>
                            <span className="flex items-center">
                              📅 {job.postedDate}
                            </span>
                            <span>•</span>
                            <span className="flex items-center">
                              💼 {job.proposals} proposals
                            </span>
                          </div>
                          
                          <p className="text-gray-700 mb-4 line-clamp-2">
                            {job.description}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {job.skills.slice(0, 5).map((skill, skillIndex) => (
                              <span 
                                key={skillIndex} 
                                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-lg border border-blue-200"
                              >
                                {skill}
                              </span>
                            ))}
                            {job.skills.length > 5 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                                +{job.skills.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex md:flex-col gap-2">
                          <button 
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleJobClick(job)
                            }}
                          >
                            Generate Proposal
                          </button>
                          <button 
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(job.title)
                              alert('Job title copied to clipboard!')
                            }}
                          >
                            Copy Title
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ✅ PAGINATION */}
                {pagination.totalPages > 1 && (
                  <div className="border-t border-gray-200">
                    <div className="px-6 py-4">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                          Showing {((pagination.currentPage - 1) * pagination.jobsPerPage) + 1} to{' '}
                          {Math.min(pagination.currentPage * pagination.jobsPerPage, pagination.totalJobs)} of{' '}
                          {pagination.totalJobs} jobs
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Previous Button */}
                          <button
                            onClick={handlePrevPage}
                            disabled={!pagination.hasPrevPage || jobsLoading}
                            className={`px-3 py-2 rounded-lg ${pagination.hasPrevPage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                          >
                            ← Previous
                          </button>
                          
                          {/* Page Numbers */}
                          <div className="flex items-center gap-1">
                            {getPageNumbers().map((pageNum, idx) => (
                              pageNum === '...' ? (
                                <span key={`dots_${idx}`} className="px-3 py-2">...</span>
                              ) : (
                                <button
                                  key={pageNum}
                                  onClick={() => handlePageChange(pageNum as number)}
                                  className={`px-3 py-2 min-w-[40px] rounded-lg ${
                                    pagination.currentPage === pageNum
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              )
                            ))}
                          </div>
                          
                          {/* Next Button */}
                          <button
                            onClick={handleNextPage}
                            disabled={!pagination.hasNextPage || jobsLoading}
                            className={`px-3 py-2 rounded-lg ${pagination.hasNextPage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                          >
                            Next →
                          </button>
                        </div>
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
            <div className="p-6 border-b border-gray-200 bg-blue-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span className="font-semibold text-green-700 bg-white px-3 py-1 rounded">{selectedJob.budget}</span>
                    <span>•</span>
                    <span>Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>Client: {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>Rating: {selectedJob.client.rating} ⭐</span>
                    <span>•</span>
                    <span>Country: {selectedJob.client.country}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl bg-white rounded-full p-2 hover:bg-gray-100"
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
                
                {/* Client Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">👤 Client Information</h4>
                    <div className="space-y-2">
                      <p className="text-blue-700"><span className="font-medium">Name:</span> {selectedJob.client.name}</p>
                      <p className="text-blue-700"><span className="font-medium">Country:</span> {selectedJob.client.country}</p>
                      <p className="text-blue-700"><span className="font-medium">Rating:</span> {selectedJob.client.rating}/5 ⭐</p>
                      <p className="text-blue-700"><span className="font-medium">Total Spent:</span> ${selectedJob.client.totalSpent}</p>
                      <p className="text-blue-700"><span className="font-medium">Total Hires:</span> {selectedJob.client.totalHires}</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="text-sm font-medium text-green-900 mb-2">💼 Job Information</h4>
                    <div className="space-y-2">
                      <p className="text-green-700"><span className="font-medium">Category:</span> {selectedJob.category || 'General'}</p>
                      <p className="text-green-700"><span className="font-medium">Job Type:</span> {selectedJob.jobType || 'Not specified'}</p>
                      <p className="text-green-700"><span className="font-medium">Experience Level:</span> {selectedJob.experienceLevel || 'Not specified'}</p>
                      <p className="text-green-700"><span className="font-medium">Proposals:</span> {selectedJob.proposals}</p>
                      <p className="text-green-700"><span className="font-medium">Skills:</span> {selectedJob.skills.join(', ')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">📝 Proposal</h3>
                  
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
                    <div className="text-sm text-gray-500 mt-4 p-3 bg-blue-50 rounded-lg">
                      💡 <span className="font-medium">AI Learning:</span> The AI will learn from your edits to generate better proposals next time!
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border">
                    <div className="text-gray-400 mb-4 text-6xl">🤖</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Proposal Generated Yet</h3>
                    <p className="text-gray-500 mb-6">
                      Click "Generate Proposal" to create a professional proposal using AI
                    </p>
                    <p className="text-sm text-gray-400 max-w-md mx-auto">
                      The AI will use your personal information and templates from the Prompts page to create a customized proposal.
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

function debounce(arg0: (query: string) => void, arg1: number): any {
  throw new Error('Function not implemented.')
}
