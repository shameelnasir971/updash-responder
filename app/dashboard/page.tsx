// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobPopup from '@/components/JobPopup'
import Pagination from '@/components/Pagination'
// import Pagination from '@/components/Pagination'

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
  engagement?: string
  experienceLevel?: string
  rawValue?: number
  currency?: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalJobs, setTotalJobs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20
  
  // Job popup state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs()
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

 const loadJobs = async () => {
  setJobsLoading(true)
  setConnectionError('')
  
  try {
    console.log(`🔄 Loading REAL jobs page ${currentPage}...`)
    
    // First check token validity
    const tokenCheck = await fetch('/api/upwork/check-token')
    const tokenData = await tokenCheck.json()
    
    console.log('🔑 Token check:', {
      authenticated: tokenData.authenticated,
      upworkConnected: tokenData.upworkConnected,
      tokenValid: tokenData.tokenValid
    })
    
    if (!tokenData.authenticated) {
      window.location.href = '/auth/login'
      return
    }
    
    if (!tokenData.upworkConnected || !tokenData.tokenValid) {
      setConnectionError('⚠️ Upwork connection issue. Please reconnect your Upwork account.')
      setUpworkConnected(false)
      setJobs([])
      setJobsLoading(false)
      return
    }
    
    // Now fetch jobs
    const response = await fetch(`/api/upwork/jobs?page=${currentPage}&limit=50`)
    
    if (response.status === 401) {
      setConnectionError('Session expired. Please login again.')
      window.location.href = '/auth/login'
      return
    }
    
    const data = await response.json()
    console.log('📊 Jobs API Response:', {
      success: data.success,
      count: data.jobs?.length,
      total: data.total,
      message: data.message,
      dataQuality: data.dataQuality
    })

    if (data.success) {
      // ✅ REAL JOBS SET KARO
      setJobs(data.jobs || [])
      setTotalJobs(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setUpworkConnected(true)
      
      if (data.jobs?.length === 0) {
        setConnectionError('No jobs found matching your criteria. Try adjusting your keywords in Prompts page.')
      } else if (data.jobs?.length > 0) {
        setConnectionError(`✅ Success! Loaded ${data.jobs.length} REAL jobs from Upwork!`)
      }
    } else {
      setConnectionError(data.message || 'Failed to load jobs. Please try again.')
      setJobs([])
    }
    
  } catch (error: any) {
    console.error('❌ Load jobs error:', error)
    setConnectionError('Network error. Please check your connection and try again.')
    setJobs([])
  } finally {
    setJobsLoading(false)
  }
}

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
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
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Real Upwork jobs' : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Total: <span className="font-semibold">{totalJobs}</span> jobs
              </div>
              <button 
                onClick={loadJobs}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${
            connectionError.includes('✅') 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={loadJobs}
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
                {upworkConnected ? `Upwork Jobs (Page ${currentPage})` : 'Connect Upwork'}
              </h2>
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalJobs)} of {totalJobs}
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
                    ? 'Try adjusting your filter settings or check Upwork directly.' 
                    : 'Connect your Upwork account to see real jobs.'}
                </p>
                <button 
                  onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Browse Upwork
                </button>
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">
                      {job.title}
                    </h3>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded mb-1">
                        {job.budget}
                      </span>
                      {job.rawValue && job.currency && (
                        <span className="text-xs text-gray-500">
                          {job.rawValue} {job.currency}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-gray-600 text-sm mb-3 flex flex-wrap gap-2">
                    <span className="flex items-center">
                      👤 {job.client.name}
                    </span>
                    <span className="flex items-center">
                      📅 {job.postedDate}
                    </span>
                    <span className="flex items-center">
                      🌍 {job.client.country}
                    </span>
                    <span className="flex items-center">
                      ⭐ {job.client.rating}
                    </span>
                    {job.experienceLevel && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                        {job.experienceLevel}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-700 mb-3 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.skills.slice(0, 5).map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200 transition-colors"
                        >
                          {skill}
                        </span>
                      ))}
                      <span className="text-gray-500 text-sm flex items-center">
                        📨 {job.proposals} proposals
                      </span>
                      {job.verified && (
                        <span className="text-green-600 text-sm flex items-center">
                          ✅ Verified
                        </span>
                      )}
                    </div>
                    
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                      Generate Proposal →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {jobs.length > 0 && totalPages > 1 && (
            <div className="p-6 border-t border-gray-200">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Job Popup */}
      {showPopup && selectedJob && (
        <JobPopup
          job={selectedJob}
          user={user}
          onClose={() => {
            setShowPopup(false)
            setSelectedJob(null)
          }}
          onSaveSuccess={() => {
            // Reload jobs if needed
            loadJobs()
          }}
        />
      )}
    </div>
  )
}