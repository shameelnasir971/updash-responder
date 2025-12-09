// app/dashboard/page.tsx - SIMPLE VERSION
'use client'

import Sidebar from '@/components/Layout/Sidebar'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

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
  jobType?: string
  experienceLevel?: string
}

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalBudget: 0,
    averageProposals: 0,
    highPayJobs: 0
  })
  
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  useEffect(() => {
    checkAuth()
    
    // Show success/error messages from URL params
    if (success === 'upwork_connected' && message) {
      alert(decodeURIComponent(message))
    }
    if (error && message) {
      setConnectionError(decodeURIComponent(message))
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadJobs()
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

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading jobs from Upwork API...')
      const response = await fetch('/api/upwork/jobs')
      const data = await response.json()

      console.log('📊 Jobs API Response:', {
        success: data.success,
        count: data.jobs?.length,
        message: data.message,
        connected: data.upworkConnected
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Calculate statistics
        if (data.jobs?.length > 0) {
          const totalBudget = data.jobs.reduce((sum: number, job: Job) => {
            const budgetMatch = job.budget?.match(/\$?(\d+)/)
            return sum + (budgetMatch ? parseInt(budgetMatch[1]) : 0)
          }, 0)
          
          const highPayJobs = data.jobs.filter((job: Job) => {
            const budgetMatch = job.budget?.match(/\$?(\d+)/)
            return budgetMatch && parseInt(budgetMatch[1]) > 500
          }).length
          
          const avgProposals = data.jobs.reduce((sum: number, job: Job) => 
            sum + (job.proposals || 0), 0) / data.jobs.length
          
          setStats({
            totalJobs: data.jobs.length,
            totalBudget: totalBudget,
            averageProposals: Math.round(avgProposals * 10) / 10,
            highPayJobs: highPayJobs
          })
        }
        
        if (data.jobs?.length === 0) {
          if (data.upworkConnected) {
            setConnectionError('No active jobs found matching your criteria. Try different keywords.')
          } else {
            setConnectionError('Connect your Upwork account to see real job postings.')
          }
        }
      } else {
        setConnectionError(data.error || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Connection error. Please try again.')
      setJobs([])
    } finally {
      setJobsLoading(false)
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

  const handleConnectUpwork = () => {
    // This will trigger the Sidebar's connect function
    // The button is in Sidebar component
  }

  const handleGenerateProposal = (job: Job) => {
    alert(`Generating proposal for: ${job.title}\n\nThis feature will use AI to create a customized proposal for this job.`)
    // TODO: Implement proposal generation
  }

  const handleViewOnUpwork = (job: Job) => {
    // Open job on Upwork
    const upworkUrl = `https://www.upwork.com/job-posting/${job.id}`
    window.open(upworkUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
          <p className="text-gray-500 text-sm mt-2">Please wait</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        handleSignOut={handleSignOut}
      />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-sm z-30 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            ☰
          </button>
          <h1 className="text-lg font-bold text-gray-900">Jobs Dashboard</h1>
          <div className="w-8"></div>
        </div>
      </div>
      
      <div className="lg:pl-80 pt-16 lg:pt-0">
        <div className="flex-1 p-4 lg:p-8">
          
          {/* Header Section */}
          <div className="mb-6 lg:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Jobs Dashboard</h1>
                <p className="text-sm lg:text-base text-gray-600 mt-1">
                  {upworkConnected 
                    ? `Connected to Upwork • ${jobs.length} jobs available` 
                    : 'Connect Upwork to see real job postings'}
                </p>
              </div>
              
              <div className="flex gap-2 mt-4 lg:mt-0">
                <button 
                  onClick={loadJobs}
                  disabled={jobsLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
                >
                  {jobsLoading ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Loading...
                    </>
                  ) : (
                    '🔄 Refresh Jobs'
                  )}
                </button>
                
                {!upworkConnected && (
                  <button 
                    onClick={handleConnectUpwork}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    🔗 Connect Upwork
                  </button>
                )}
              </div>
            </div>
            
            {/* Stats Cards */}
            {jobs.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-blue-600 text-lg">📊</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Jobs</p>
                      <p className="text-xl font-bold text-gray-900">{stats.totalJobs}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-green-600 text-lg">💰</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Budget</p>
                      <p className="text-xl font-bold text-gray-900">${stats.totalBudget}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-purple-600 text-lg">👥</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg. Proposals</p>
                      <p className="text-xl font-bold text-gray-900">{stats.averageProposals}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-yellow-600 text-lg">⭐</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">High Pay Jobs</p>
                      <p className="text-xl font-bold text-gray-900">{stats.highPayJobs}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error/Info Message */}
          {connectionError && (
            <div className={`mb-6 p-4 rounded-lg ${connectionError.includes('Connect') ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              <div className="flex items-start">
                <span className="text-lg mr-3">
                  {connectionError.includes('Connect') ? 'ℹ️' : '⚠️'}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{connectionError}</p>
                  {connectionError.includes('Connect') && (
                    <button 
                      onClick={handleConnectUpwork}
                      className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                    >
                      Connect Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            {/* Jobs Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                <div>
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                    {upworkConnected ? 'Upwork Job Postings' : 'Connect Upwork Account'}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {jobs.length > 0 
                      ? 'Latest job postings from Upwork marketplace'
                      : 'Real jobs will appear here after connecting Upwork'}
                  </p>
                </div>
                
                {jobs.length > 0 && (
                  <div className="mt-3 lg:mt-0 flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      Showing {jobs.length} jobs
                    </span>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Jobs List */}
            <div className="divide-y divide-gray-100">
              {jobsLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Jobs...</h3>
                  <p className="text-gray-500">Fetching latest job postings from Upwork</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="text-gray-300 mb-6 text-7xl">💼</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">
                    {upworkConnected ? 'No Jobs Found' : 'Upwork Not Connected'}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-8">
                    {upworkConnected 
                      ? 'No active job postings match your current criteria. Try refreshing or check Upwork directly for more opportunities.' 
                      : 'Connect your Upwork account to access real job postings and automate your proposals.'}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {upworkConnected ? (
                      <>
                        <button 
                          onClick={loadJobs}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          🔄 Refresh Jobs
                        </button>
                        <button 
                          onClick={() => window.open('https://www.upwork.com/nx/find-work/best-matches', '_blank')}
                          className="px-6 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium border border-gray-300"
                        >
                          🔍 Browse Upwork
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={handleConnectUpwork}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        🔗 Connect Upwork Account
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between">
                      <div className="flex-1">
                        {/* Job Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg lg:text-xl mb-1">
                              {job.title}
                              {job.verified && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  ✓ Verified
                                </span>
                              )}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                              <span className="flex items-center">
                                👤 {job.client.name}
                              </span>
                              <span>•</span>
                              <span>⭐ {job.client.rating}/5</span>
                              <span>•</span>
                              <span>📍 {job.client.country}</span>
                              <span>•</span>
                              <span>📅 {job.postedDate}</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 lg:mt-0 text-right">
                            <div className="text-xl font-bold text-green-700 mb-1">{job.budget}</div>
                            <div className="text-xs text-gray-500">
                              {job.proposals} proposals • {job.jobType || 'Fixed Price'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Job Description */}
                        <p className="text-gray-700 mb-4 line-clamp-3">
                          {job.description}
                        </p>
                        
                        {/* Skills */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {job.skills.map((skill, index) => (
                            <span 
                              key={index} 
                              className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-100"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                        
                        {/* Client Info */}
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="flex items-center mr-4">
                            <span className="mr-1">💼</span>
                            <span>{job.client.totalHires || 0} hires</span>
                          </div>
                          <div className="flex items-center">
                            <span className="mr-1">💰</span>
                            <span>${job.client.totalSpent || 0} spent</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => handleGenerateProposal(job)}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium flex-1 flex items-center justify-center"
                      >
                        <span className="mr-2">🤖</span>
                        Generate AI Proposal
                      </button>
                      
                      <button 
                        onClick={() => handleViewOnUpwork(job)}
                        className="px-5 py-2.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium border border-gray-300 flex items-center justify-center"
                      >
                        <span className="mr-2">🔗</span>
                        View on Upwork
                      </button>
                      
                      <button 
                        onClick={() => {
                          // Save job for later
                          alert(`Saved job: ${job.title}`)
                        }}
                        className="px-5 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium border border-gray-200 flex items-center justify-center"
                      >
                        <span className="mr-2">⭐</span>
                        Save Job
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            {jobs.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between">
                  <p className="text-sm text-gray-600 mb-2 sm:mb-0">
                    Showing {jobs.length} of many available jobs on Upwork
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={loadJobs}
                      className="text-sm px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border border-gray-300"
                    >
                      Load More Jobs
                    </button>
                    <button 
                      onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                      className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Search on Upwork
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer Note */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              ⚠️ Note: Always review job details and client history before submitting proposals.
              {upworkConnected && ' Jobs are fetched in real-time from Upwork API.'}
            </p>
            <p className="mt-1">
              Need help? Contact support@updash.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}