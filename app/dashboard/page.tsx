// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import JobPopup from '@/components/JobPopup'

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
  
  // ✅ NEW STATE FOR JOB POPUP
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs()
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
        // ✅ FILTER JOBS BASED ON USER'S PROMPT SETTINGS
        const filteredJobs = await filterJobsByPromptSettings(data.jobs || [])
        setJobs(filteredJobs)
        setUpworkConnected(data.upworkConnected || false)
        
        if (filteredJobs.length === 0) {
          setConnectionError('No matching jobs found based on your prompt settings.')
        } else if (filteredJobs.length > 0) {
          setConnectionError(`✅ Loaded ${filteredJobs.length} matching jobs!`)
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

  // ✅ FILTER JOBS BASED ON USER'S PROMPT SETTINGS
  const filterJobsByPromptSettings = async (jobs: Job[]) => {
    try {
      // Get user's prompt settings
      const response = await fetch('/api/prompts')
      const data = await response.json()
      
      if (!data.success || !data.settings) {
        return jobs // Return all jobs if no settings
      }
      
      const settings = data.settings
      const { keywords, minBudget, maxBudget, requiredSkills } = settings.validationRules
      
      // Filter jobs
      return jobs.filter(job => {
        // 1. Keyword matching
        const jobText = (job.title + ' ' + job.description).toLowerCase()
        const keywordMatches = keywords.toLowerCase().includes('or') 
          ? keywords.split(' OR ').some((keyword: string) => 
              jobText.includes(keyword.trim().toLowerCase().replace(/"/g, ''))
            )
          : jobText.includes(keywords.toLowerCase())
        
        // 2. Budget matching
        const budget = parseBudget(job.budget)
        const budgetMatches = !minBudget || !maxBudget || 
          (budget >= minBudget && budget <= maxBudget)
        
        // 3. Skills matching
        const skillsMatches = !requiredSkills || requiredSkills.length === 0 ||
          requiredSkills.some((skill: string) => 
            job.skills.some(jobSkill => 
              jobSkill.toLowerCase().includes(skill.toLowerCase())
            )
          )
        
        return keywordMatches && budgetMatches && skillsMatches
      })
    } catch (error) {
      console.error('Filter error:', error)
      return jobs
    }
  }

  // ✅ PARSE BUDGET STRING TO NUMBER
  const parseBudget = (budgetStr: string): number => {
    const match = budgetStr.match(/\$?(\d+(?:\.\d+)?)/)
    return match ? parseFloat(match[1]) : 0
  }

  // ✅ HANDLE JOB CLICK
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowJobPopup(true)
  }

  // ✅ HANDLE SAVE PROPOSAL
  const handleSaveProposal = async (proposal: string, jobId: string) => {
    if (!selectedJob) return
    
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
          proposalText: proposal,
          status: 'saved'
        })
      })
      
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save')
      }
      return data
    } catch (error) {
      throw error
    }
  }

  // ✅ HANDLE SEND PROPOSAL
  const handleSendProposal = async (proposal: string, jobId: string) => {
    if (!selectedJob) return
    
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          proposalText: proposal,
          originalProposal: proposal
        })
      })
      
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send')
      }
      return data
    } catch (error) {
      throw error
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
      {/* ✅ Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Filtered jobs based on your prompt settings' : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            <button 
              onClick={loadJobs}
              disabled={jobsLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {jobsLoading ? 'Loading...' : '🔄 Refresh Jobs'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 ${connectionError.includes('✅') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-yellow-100 border border-yellow-400 text-yellow-700'}`}>
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={loadJobs}
                className={`ml-4 text-sm px-3 py-1 rounded ${connectionError.includes('✅') ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}
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
                {upworkConnected ? 'Filtered Upwork Jobs' : 'Connect Upwork'}
              </h2>
              <div className="text-sm text-gray-600">
                {jobs.length} jobs • Based on your prompt settings
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
                  {upworkConnected ? 'No Matching Jobs Found' : 'Upwork Not Connected'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {upworkConnected 
                    ? 'Try adjusting your prompt settings or check Upwork directly.' 
                    : 'Connect your Upwork account to see jobs.'}
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
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-sm"
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg hover:text-blue-600">
                      {job.title}
                    </h3>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded border border-green-200">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    👤 {job.client.name} • 📅 {job.postedDate} • 🌍 {job.client.country} •
                    ⭐ {job.client.rating} • 📊 {job.proposals} proposals
                  </p>
                  
                  <p className="text-gray-700 mb-3">{job.description.substring(0, 250)}...</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded border border-blue-200">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 3} more
                        </span>
                      )}
                      <span className="text-gray-500 text-sm ml-2">
                        {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                      </span>
                    </div>
                    
                    <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90">
                      ✨ Generate Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ✅ JOB POPUP */}
      {showJobPopup && selectedJob && (
        <JobPopup 
          job={selectedJob}
          onClose={() => {
            setShowJobPopup(false)
            setSelectedJob(null)
          }}
          onSave={handleSaveProposal}
          onSend={handleSendProposal}
        />
      )}
    </div>
  )
}