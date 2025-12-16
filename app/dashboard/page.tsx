'use client'

import { useState, useEffect } from 'react'
import JobProposalPopup from '@/components/JobProposalPopup'

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
  const [message, setMessage] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  
  const [apiTested, setApiTested] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        checkUpworkConnection()
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const checkUpworkConnection = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      
      if (data.connected) {
        setUpworkConnected(true)
        setMessage('✅ Upwork connected! Click "Load Real Jobs" to start.')
      } else {
        setMessage('❌ Please connect Upwork account first')
      }
    } catch (error) {
      setMessage('⚠️ Could not check Upwork connection')
    }
  }

  const loadRealJobs = async () => {
    setJobsLoading(true)
    setMessage('🔄 Connecting to Upwork API...')
    
    try {
      // Test API first
      const testResponse = await fetch('/api/upwork/jobs?refresh=true')
      const testData = await testResponse.json()
      
      if (!testResponse.ok) {
        throw new Error(testData.error || 'API test failed')
      }
      
      setApiTested(true)
      
      if (testData.success && testData.jobs?.length > 0) {
        setJobs(testData.jobs)
        setMessage(`✅ SUCCESS: Loaded ${testData.jobs.length} REAL jobs from Upwork!`)
      } else {
        // Try with search to get different results
        const searchResponse = await fetch('/api/upwork/jobs?search=web+development&refresh=true')
        const searchData = await searchResponse.json()
        
        if (searchData.success && searchData.jobs?.length > 0) {
          setJobs(searchData.jobs)
          setMessage(`✅ SUCCESS: Loaded ${searchData.jobs.length} REAL jobs from Upwork!`)
        } else {
          setMessage('⚠️ API working but returned 0 jobs. Trying alternative...')
          loadBackupJobs()
        }
      }
      
    } catch (error: any) {
      console.error('Load jobs error:', error)
      setMessage(`❌ API Error: ${error.message}`)
      loadBackupJobs()
    } finally {
      setJobsLoading(false)
    }
  }

  const loadBackupJobs = async () => {
    setMessage('🔄 Trying backup API method...')
    
    try {
      // Try direct fetch with different parameters
      const responses = await Promise.allSettled([
        fetch('/api/upwork/jobs?search=react&refresh=true'),
        fetch('/api/upwork/jobs?search=javascript&refresh=true'),
        fetch('/api/upwork/jobs?search=python&refresh=true'),
        fetch('/api/upwork/jobs?search=design&refresh=true')
      ])
      
      let allJobs: Job[] = []
      
      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value.ok) {
          const data = await response.value.json()
          if (data.success && data.jobs?.length > 0) {
            allJobs = [...allJobs, ...data.jobs]
          }
        }
      }
      
      // Remove duplicates
      const uniqueJobs = Array.from(new Set(allJobs.map(j => j.id)))
        .map(id => allJobs.find(j => j.id === id))
        .filter(Boolean) as Job[]
      
      if (uniqueJobs.length > 0) {
        setJobs(uniqueJobs.slice(0, 50)) // Limit to 50
        setMessage(`✅ Loaded ${uniqueJobs.length} real jobs using backup method!`)
      } else {
        setMessage('❌ All API methods failed. Please check Upwork connection.')
      }
      
    } catch (error) {
      setMessage('❌ Critical: Could not load any jobs')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      searchJobs(searchInput.trim())
    }
  }

  const searchJobs = async (query: string) => {
    setJobsLoading(true)
    setMessage(`🔍 Searching for "${query}"...`)
    
    try {
      const response = await fetch(`/api/upwork/jobs?search=${encodeURIComponent(query)}&refresh=true`)
      const data = await response.json()
      
      if (data.success) {
        setJobs(data.jobs || [])
        if (data.jobs.length > 0) {
          setMessage(`✅ Found ${data.jobs.length} jobs for "${query}"`)
        } else {
          setMessage(`❌ No jobs found for "${query}"`)
        }
      } else {
        setMessage(`❌ Search failed: ${data.message}`)
      }
    } catch (error: any) {
      setMessage(`❌ Search error: ${error.message}`)
    } finally {
      setJobsLoading(false)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    if (jobs.length > 0) {
      setMessage(`✅ Showing ${jobs.length} real jobs`)
    } else {
      setMessage('✅ Ready to load jobs')
    }
  }

  const handleJobClick = (job: Job) => {
    if (!user) {
      alert('Please login first')
      return
    }
    setSelectedJob(job)
    setShowPopup(true)
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="flex-1 p-4 md:p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">🚀 Upwork Jobs Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                {upworkConnected ? '🔗 Connected to Upwork API' : '❌ Connect Upwork to see real jobs'}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {!upworkConnected ? (
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold shadow-lg"
                >
                  🔗 Connect Upwork First
                </button>
              ) : (
                <button 
                  onClick={loadRealJobs}
                  disabled={jobsLoading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 font-semibold shadow-lg flex items-center justify-center space-x-2"
                >
                  {jobsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Loading Real Jobs...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🚀</span>
                      <span>Load REAL Jobs Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`rounded-xl p-4 mb-6 ${
            message.includes('✅') || message.includes('SUCCESS') 
              ? 'bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 text-green-800' 
              : message.includes('❌') 
              ? 'bg-gradient-to-r from-red-100 to-pink-100 border border-red-300 text-red-800'
              : 'bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 text-yellow-800'
          }`}>
            <div className="flex items-center">
              <span className="text-2xl mr-3">
                {message.includes('✅') ? '✅' : message.includes('❌') ? '❌' : '🔄'}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{message}</p>
                <p className="text-sm opacity-75 mt-1">
                  {jobs.length > 0 
                    ? `${jobs.length} real jobs loaded • 100% from Upwork API`
                    : 'No mock data • 100% real API calls'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <label htmlFor="search" className="block text-lg font-semibold text-gray-900">
              🔍 Search Real Upwork Jobs
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  id="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by job title, skills, or keywords..."
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={jobsLoading}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={jobsLoading || !upworkConnected}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                >
                  {jobsLoading ? 'Searching...' : '🔍 Search'}
                </button>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {searchTerm && (
              <p className="text-sm text-blue-600">
                Searching for: <span className="font-semibold">"{searchTerm}"</span>
              </p>
            )}
          </form>
        </div>

        {/* Jobs List */}
        {jobs.length > 0 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                📊 Real Upwork Jobs ({jobs.length} loaded)
              </h2>
              <div className="text-sm text-gray-600">
                {apiTested ? '✅ API Tested' : '🔄 Testing API...'}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <div 
                  key={job.id}
                  onClick={() => handleJobClick(job)}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-gray-900 text-lg line-clamp-2 hover:text-blue-600">
                        {job.title}
                      </h3>
                      <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg">
                        {job.budget}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                          {job.category || 'General'}
                        </span>
                        <span>{job.postedDate}</span>
                      </div>
                      
                      <p className="text-gray-700 text-sm line-clamp-3">
                        {job.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1">
                        {job.skills.slice(0, 4).map((skill, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                            +{job.skills.length - 4} more
                          </span>
                        )}
                      </div>
                      
                      <div className="pt-4 border-t border-gray-100">
                        <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 font-semibold">
                          🤖 Generate AI Proposal
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-6 text-8xl">💼</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-3">
              {upworkConnected ? 'Ready to Load Real Jobs' : 'Connect Upwork First'}
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {upworkConnected 
                ? 'Click "Load REAL Jobs Now" to fetch thousands of real jobs from Upwork API'
                : 'Please connect your Upwork account to access real job data'
              }
            </p>
            
            {upworkConnected && (
              <div className="space-y-4">
                <button 
                  onClick={loadRealJobs}
                  disabled={jobsLoading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 font-bold text-lg shadow-2xl flex items-center justify-center space-x-3 mx-auto"
                >
                  {jobsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Connecting to Upwork API...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🚀</span>
                      <span>LOAD REAL JOBS NOW</span>
                    </>
                  )}
                </button>
                
                <div className="text-sm text-gray-500 max-w-lg mx-auto p-4 bg-gray-50 rounded-lg">
                  <p className="font-semibold mb-2">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-left">
                    <li>Connects to Upwork API with your credentials</li>
                    <li>Fetches REAL job data (not mock)</li>
                    <li>Shows latest job postings with full details</li>
                    <li>Allows you to generate AI proposals instantly</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job Proposal Popup */}
        {showPopup && selectedJob && user && (
          <JobProposalPopup
            job={selectedJob}
            user={user}
            onClose={() => {
              setShowPopup(false)
              setSelectedJob(null)
            }}
          />
        )}
      </div>
    </div>
  )
}