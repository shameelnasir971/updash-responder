// app/dashboard/page.tsx 
'use client'

import { useState, useEffect, useCallback } from 'react'
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
    paymentVerified: boolean
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  jobType?: string
  experienceLevel?: string
  duration?: string
  source: string
  isRealJob: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Jobs states
  const [jobs, setJobs] = useState<Job[]>([])
  const [totalJobs, setTotalJobs] = useState(0)
  const [loadingJobs, setLoadingJobs] = useState(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [jobsPerPage] = useState(50)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  
  // Connection states
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // Popup states
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs(currentPage)
    }
  }, [user, currentPage])

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

  const loadJobs = useCallback(async (page: number = 1) => {
    setLoadingJobs(true)
    setConnectionError('')
    
    try {
      console.log(`🔄 Loading jobs page ${page}...`)
      
      const response = await fetch(`/api/upwork/jobs?page=${page}&perPage=${jobsPerPage}`)
      
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
        totalPages: data.totalPages,
        message: data.message
      })

      if (data.success) {
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs || [])
        setTotalJobs(data.total || 0)
        setTotalPages(data.totalPages || 1)
        setHasNextPage(data.hasNextPage || false)
        setHasPrevPage(data.hasPrevPage || false)
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try refreshing.')
        } else if (data.jobs?.length > 0) {
          // ✅ SUCCESS MESSAGE
          setConnectionError(`✅ Success! Loaded ${data.jobs.length} real jobs from Upwork!`)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
        setTotalJobs(0)
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check your connection.')
      setJobs([])
      setTotalJobs(0)
    } finally {
      setLoadingJobs(false)
      setRefreshing(false)
    }
  }, [jobsPerPage])

  const refreshJobs = async () => {
    setRefreshing(true)
    setCurrentPage(1)
    await loadJobs(1)
  }

  const handleConnectUpwork = async () => {
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to connect: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // ✅ PAGINATION FUNCTIONS
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // ✅ JOB CLICK HANDLER
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowJobPopup(true)
  }

  // ✅ SIGN OUT FUNCTION
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth', {
        method: 'DELETE'
      })
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // ✅ GENERATE PAGE NUMBERS
  const generatePageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const start = Math.max(1, currentPage - 2)
      const end = Math.min(totalPages, start + maxVisible - 1)
      
      if (start > 1) pages.push(1)
      if (start > 2) pages.push('...')
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (end < totalPages - 1) pages.push('...')
      if (end < totalPages) pages.push(totalPages)
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        handleSignOut={handleSignOut}
      />
      
      {/* Main Content */}
      <div className="flex-1 p-6 lg:ml-80">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${upworkConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {upworkConnected ? '✅ Connected' : '❌ Not Connected'}
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden bg-gray-200 p-2 rounded-lg"
              >
                ☰
              </button>
              
              {/* Refresh Button */}
              <button 
                onClick={refreshJobs}
                disabled={refreshing || loadingJobs}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {refreshing || loadingJobs ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {refreshing ? 'Refreshing...' : 'Loading...'}
                  </>
                ) : '🔄 Refresh'}
              </button>
              
              {/* Connect Button (if not connected) */}
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Connect Upwork
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error/Success Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
          }`}>
            <div className="flex items-center">
              {connectionError.includes('✅') ? '✅' : '⚠️'}
              <span className="ml-2">{connectionError}</span>
            </div>
            <button 
              onClick={refreshJobs}
              disabled={loadingJobs}
              className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{totalJobs}</div>
              <div className="text-sm text-blue-600">Total Jobs Available</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{jobs.length}</div>
              <div className="text-sm text-green-600">Jobs on This Page</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{currentPage}</div>
              <div className="text-sm text-purple-600">Current Page</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{totalPages}</div>
              <div className="text-sm text-yellow-600">Total Pages</div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork'}
              </h2>
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages} • {jobs.length} jobs
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {loadingJobs ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading real jobs from Upwork...</p>
                <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">💼</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try refreshing or adjust your filter settings.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                <button 
                  onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 mr-3"
                >
                  Browse Upwork Directly
                </button>
                {upworkConnected && (
                  <button 
                    onClick={refreshJobs}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                )}
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-all duration-200"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded text-lg">
                        {job.budget}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {job.jobType} • {job.duration}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-gray-600 text-sm mb-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium">👤 {job.client.name}</span>
                      <span className="text-gray-400">•</span>
                      <span className="flex items-center">
                        ⭐ {job.client.rating} 
                        {job.client.paymentVerified && <span className="ml-1 text-green-500">✓</span>}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>📍 {job.client.country}</span>
                      <span className="text-gray-400">•</span>
                      <span>📅 {job.postedDate}</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-3 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                          +{job.skills.length - 4} more
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-500 text-sm">
                        📝 {job.proposals} proposals
                      </span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Generate Proposal
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {jobs.length > 0 && totalPages > 1 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div className="text-sm text-gray-600 mb-4 sm:mb-0">
                Showing <span className="font-semibold">{((currentPage - 1) * jobsPerPage) + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(currentPage * jobsPerPage, totalJobs)}</span> of{' '}
                <span className="font-semibold">{totalJobs}</span> jobs
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={prevPage}
                  disabled={!hasPrevPage}
                  className={`px-4 py-2 rounded-lg flex items-center ${hasPrevPage ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  ← Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {generatePageNumbers().map((pageNum, index) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(Number(pageNum))}
                        className={`px-4 py-2 rounded-lg ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className={`px-4 py-2 rounded-lg flex items-center ${hasNextPage ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Next →
                </button>
              </div>
              
              {/* Page Selector */}
              <div className="mt-4 sm:mt-0 flex items-center space-x-2">
                <span className="text-sm text-gray-600">Go to page:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value)
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page)
                    }
                  }}
                  className="w-16 px-3 py-1 border border-gray-300 rounded text-center"
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Detail Popup */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 flex-wrap gap-2">
                    <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded">
                      {selectedJob.budget}
                    </span>
                    <span>•</span>
                    <span>📅 {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>👤 {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>⭐ {selectedJob.client.rating}</span>
                    <span>•</span>
                    <span>📍 {selectedJob.client.country}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl ml-4"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Client Information</h4>
                  <ul className="space-y-1 text-blue-800">
                    <li>• Total Spent: ${selectedJob.client.totalSpent.toLocaleString()}</li>
                    <li>• Total Hires: {selectedJob.client.totalHires}+</li>
                    <li>• Payment: {selectedJob.client.paymentVerified ? 'Verified ✅' : 'Not Verified'}</li>
                    <li>• Location: {selectedJob.client.country}</li>
                  </ul>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Job Details</h4>
                  <ul className="space-y-1 text-green-800">
                    <li>• Category: {selectedJob.category}</li>
                    <li>• Type: {selectedJob.jobType}</li>
                    <li>• Experience: {selectedJob.experienceLevel}</li>
                    <li>• Duration: {selectedJob.duration}</li>
                    <li>• Proposals: {selectedJob.proposals}</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.skills.map((skill, index) => (
                    <span key={index} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                <button
                  onClick={() => setShowJobPopup(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Generate proposal logic here
                    alert('Proposal generation will be implemented!')
                    setShowJobPopup(false)
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🤖 Generate Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}