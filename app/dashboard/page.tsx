// app/dashboard/page.tsx - Updated
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
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [userPromptSettings, setUserPromptSettings] = useState<any>(null)

  useEffect(() => {
    checkAuth()
    loadUserPromptSettings()
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

  const loadUserPromptSettings = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setUserPromptSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to load prompt settings:', error)
    }
  }

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading REAL jobs...')
      const response = await fetch('/api/upwork/jobs')
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Jobs Data:', {
        success: data.success,
        count: data.jobs?.length,
        message: data.message
      })

      if (data.success) {
        // Filter jobs based on user's prompt settings
        let filteredJobs = data.jobs || []
        
        if (userPromptSettings) {
          // Apply filters from prompt settings
          filteredJobs = filteredJobs.filter((job: Job) => {
            // Budget filter
            const budgetMatch = checkBudgetMatch(job.budget, userPromptSettings.validationRules)
            // Skills filter
            const skillsMatch = checkSkillsMatch(job.skills, userPromptSettings.validationRules?.requiredSkills)
            // Category filter (if available)
            const categoryMatch = checkCategoryMatch(job, userPromptSettings.basicInfo)
            
            return budgetMatch && skillsMatch && categoryMatch
          })
        }
        
        setJobs(filteredJobs)
        setUpworkConnected(data.upworkConnected || false)
        
        if (filteredJobs.length === 0) {
          setConnectionError(data.message || 'No matching jobs found based on your settings.')
        } else if (filteredJobs.length > 0) {
          setConnectionError(`✅ Success! Loaded ${filteredJobs.length} matching jobs from Upwork!`)
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

  // Helper functions for filtering
  const checkBudgetMatch = (jobBudget: string, validationRules: any) => {
    if (!validationRules?.minBudget && !validationRules?.maxBudget) return true
    
    // Extract numeric value from budget string (e.g., "$500" -> 500)
    const budgetMatch = jobBudget.match(/\$?(\d+\.?\d*)/)
    if (!budgetMatch) return true
    
    const budgetValue = parseFloat(budgetMatch[1])
    const minBudget = validationRules.minBudget || 0
    const maxBudget = validationRules.maxBudget || Infinity
    
    return budgetValue >= minBudget && budgetValue <= maxBudget
  }

  const checkSkillsMatch = (jobSkills: string[], requiredSkills: string[]) => {
    if (!requiredSkills || requiredSkills.length === 0) return true
    if (!jobSkills || jobSkills.length === 0) return false
    
    // Check if any required skill is in job skills
    return requiredSkills.some(skill => 
      jobSkills.some(jobSkill => 
        jobSkill.toLowerCase().includes(skill.toLowerCase())
      )
    )
  }

  const checkCategoryMatch = (job: Job, basicInfo: any) => {
    if (!basicInfo?.specialty) return true
    
    const specialty = basicInfo.specialty.toLowerCase()
    const jobTitle = job.title.toLowerCase()
    const jobDesc = (job.description || '').toLowerCase()
    
    return jobTitle.includes(specialty) || jobDesc.includes(specialty) ||
           (basicInfo.provisions && basicInfo.provisions.toLowerCase().includes(specialty))
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL. Check console.')
        console.error('OAuth error:', data.error)
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  const handleProposalGenerated = (proposal: string, jobId: string) => {
    console.log('Proposal generated for job:', jobId)
    // You can store this in state if needed
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
                {upworkConnected 
                  ? `${jobs.length} jobs based on your prompt settings` 
                  : 'Connect Upwork to see matching jobs'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Upwork'}
                </button>
              )}
              <button 
                onClick={loadJobs}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Loading...' : 'Refresh Jobs'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400'
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
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
                {upworkConnected 
                  ? `Matching Jobs (${jobs.length})`
                  : 'Connect Upwork to See Jobs'
                }
              </h2>
              <div className="text-sm text-gray-500">
                {userPromptSettings?.basicInfo?.specialty 
                  ? `Filtered by: ${userPromptSettings.basicInfo.specialty}`
                  : 'Update prompts for better matches'
                }
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading matching jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">🔍</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {upworkConnected ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {upworkConnected 
                    ? 'No jobs match your current prompt settings. Try updating your prompts or check Upwork directly.' 
                    : 'Connect your Upwork account to see jobs matching your profile.'
                  }
                </p>
                <div className="space-x-3">
                  {upworkConnected ? (
                    <button 
                      onClick={() => window.location.href = '/dashboard/prompts'}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                    >
                      Update Prompt Settings
                    </button>
                  ) : (
                    <button 
                      onClick={handleConnectUpwork}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                    >
                      Connect Upwork
                    </button>
                  )}
                  <button 
                    onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                  >
                    Browse Upwork Directly
                  </button>
                </div>
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => setSelectedJob(job)}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">{job.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">
                        Client: {job.client.name} • {job.postedDate} • {job.client.country} •
                        Rating: {job.client.rating} ⭐ • {job.proposals} proposals
                      </p>
                    </div>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded whitespace-nowrap ml-4">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">{job.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 3} more
                        </span>
                      )}
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedJob(job)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Generate Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Job Proposal Popup */}
      {selectedJob && (
        <JobProposalPopup
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onProposalGenerated={handleProposalGenerated}
        />
      )}
    </div>
  )
}