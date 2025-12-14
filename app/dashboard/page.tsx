// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobPopup from '@/components/JobPopup'

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
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)
  const itemsPerPage = 50

  useEffect(() => {
    checkAuth()
    checkConnection()
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

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkConnected(data.connected)
    } catch (error) {
      console.error('Connection check failed')
    }
  }

  const loadJobs = async (page: number) => {
    setJobsLoading(true)
    try {
      const response = await fetch(`/api/jobs/real?page=${page}&limit=${itemsPerPage}`)
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        setTotalJobs(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage))
      } else {
        console.error('Failed to load jobs:', data.message)
        setJobs([])
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setIsPopupOpen(true)
  }

  const handleProposalGenerated = (proposal: string) => {
    console.log('Proposal generated:', proposal)
  }

  const handleConnectClick = async () => {
    const response = await fetch('/api/upwork/auth')
    const data = await response.json()
    
    if (data.success && data.url) {
      window.location.href = data.url
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
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
                {upworkConnected 
                  ? `Showing ${totalJobs} real jobs from Upwork` 
                  : 'Connect Upwork to see real jobs'}
              </p>
            </div>
            
            {!upworkConnected && (
              <button
                onClick={handleConnectClick}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
              >
                🔗 Connect Upwork Account
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {upworkConnected && jobs.length > 0 && (
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-gray-900">{totalJobs}</div>
              <div className="text-gray-600">Total Jobs</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{jobs.length}</div>
              <div className="text-gray-600">Current Page</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{itemsPerPage}</div>
              <div className="text-gray-600">Per Page</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">{totalPages}</div>
              <div className="text-gray-600">Total Pages</div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Real Upwork Jobs' : 'Upwork Connection Required'}
              </h2>
              <button 
                onClick={() => loadJobs(currentPage)}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Refreshing...' : '🔄 Refresh Jobs'}
              </button>
            </div>
          </div>

          {!upworkConnected ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4 text-6xl">🔗</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Connect Upwork Account
              </h3>
              <p className="text-gray-500 mb-6">
                Connect your Upwork account to see real jobs and generate proposals
              </p>
              <button 
                onClick={handleConnectClick}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
              >
                🔗 Connect Upwork Now
              </button>
            </div>
          ) : jobsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading real jobs from Upwork...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4 text-6xl">💼</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Jobs Found</h3>
              <p className="text-gray-500 mb-6">
                Try adjusting your search criteria in Prompts page
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">
                          {job.title}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600 space-x-4 mb-2">
                          <span className="font-semibold text-green-700">
                            {job.budget}
                          </span>
                          <span>Client: {job.client?.name}</span>
                          <span>Rating: {job.client?.rating} ⭐</span>
                          <span>{job.client?.country}</span>
                          <span>{job.postedDate}</span>
                        </div>
                        
                        <p className="text-gray-700 mb-3 line-clamp-2">
                          {job.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1">
                            {job.skills?.slice(0, 5).map((skill, index) => (
                              <span 
                                key={index} 
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">
                            {job.proposals} proposals
                          </span>
                        </div>
                      </div>
                      
                      <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                        Generate Proposal
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {jobs.length} jobs on page {currentPage} of {totalPages}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      
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
                            className={`px-4 py-2 rounded-lg ${
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
                          <span className="px-2">...</span>
                          <button
                            onClick={() => handlePageChange(totalPages)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Job Popup */}
      {selectedJob && (
        <JobPopup
          job={selectedJob}
          isOpen={isPopupOpen}
          onClose={() => {
            setIsPopupOpen(false)
            setSelectedJob(null)
          }}
          onProposalGenerated={handleProposalGenerated}
        />
      )}
    </div>
  )
}