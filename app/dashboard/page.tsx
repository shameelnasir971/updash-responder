// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
import Sidebar from '../../components/Layout/Sidebar'

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

interface PromptSettings {
  basicInfo: {
    feedName: string
    keywords: string
    specialty: string
    provisions: string
    hourlyRate: string
    location: string
  }
  validationRules: {
    minBudget: number
    maxBudget: number
    jobTypes: string[]
    clientRating: number
    requiredSkills: string[]
    validationPrompt: string
  }
  proposalTemplates: any[]
  aiSettings: {
    model: string
    temperature: number
    maxTokens: number
    creativity: string
  }
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  // Popup states
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [generatedProposal, setGeneratedProposal] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [proposalMessage, setProposalMessage] = useState('')
  const [promptSettings, setPromptSettings] = useState<PromptSettings | null>(null)

  useEffect(() => {
    checkAuth()
    loadJobs()
    loadPromptSettings()
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

  const loadPromptSettings = async () => {
    try {
      const response = await fetch('/api/prompts')
      const data = await response.json()
      if (data.settings) {
        setPromptSettings(data.settings)
      }
    } catch (error) {
      console.log('Using default prompt settings')
    }
  }

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading jobs...')
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
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try refreshing.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Success! Loaded ${data.jobs.length} jobs from Upwork!`)
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

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
    setGeneratedProposal('')
    setEditingProposal(false)
    setProposalMessage('')
  }

  const generateProposal = async () => {
    if (!selectedJob) return
    
    setProposalLoading(true)
    setProposalMessage('')
    
    try {
      const jobData = {
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        jobDescription: selectedJob.description,
        clientInfo: selectedJob.client,
        budget: selectedJob.budget,
        skills: selectedJob.skills
      }
      
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setGeneratedProposal(data.proposal)
        setProposalMessage('✅ Proposal generated successfully!')
        setEditingProposal(true) // Allow editing after generation
      } else {
        throw new Error(data.error || 'Failed to generate proposal')
      }
    } catch (error: any) {
      console.error('Generate proposal error:', error)
      setProposalMessage(`❌ Error: ${error.message}`)
    } finally {
      setProposalLoading(false)
    }
  }

  const saveProposal = async () => {
    if (!selectedJob || !generatedProposal) return
    
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
          proposalText: generatedProposal,
          status: 'saved'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setProposalMessage('✅ Proposal saved to history!')
      } else {
        throw new Error(data.error || 'Failed to save proposal')
      }
    } catch (error: any) {
      console.error('Save proposal error:', error)
      setProposalMessage(`❌ Error: ${error.message}`)
    } finally {
      setSavingProposal(false)
    }
  }

  const sendProposal = async () => {
    if (!selectedJob || !generatedProposal) return
    
    setSendingProposal(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          proposalText: generatedProposal,
          originalProposal: generatedProposal, // For AI training
          editReason: 'Direct send'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setProposalMessage(
          data.upworkSent 
            ? '✅ Proposal sent to Upwork successfully!' 
            : '✅ Proposal saved as sent (Upwork not connected)'
        )
      } else {
        throw new Error(data.error || 'Failed to send proposal')
      }
    } catch (error: any) {
      console.error('Send proposal error:', error)
      setProposalMessage(`❌ Error: ${error.message}`)
    } finally {
      setSendingProposal(false)
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
      {/* Sidebar */}
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        handleSignOut={handleSignOut}
      />

      {/* Main Content */}
      <div className="lg:pl-80 flex flex-col flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <div className="w-6"></div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {upworkConnected ? ' Upwork jobs' : 'Connect Upwork to see jobs'}
                </p>
              </div>
              
              <div className="flex space-x-3">
                {promptSettings && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <p className="text-sm text-blue-800">
                      Using: <span className="font-semibold">{promptSettings.basicInfo.specialty}</span>
                    </p>
                  </div>
                )}
                <button 
                  onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Browse Upwork
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
                  {upworkConnected ? 'Upwork Jobs' : 'Connect Upwork'}
                </h2>
                <button 
                  onClick={loadJobs}
                  disabled={jobsLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {jobsLoading ? 'Loading...' : 'Refresh Jobs'}
                </button>
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
                      ? 'Try refreshing or check Upwork directly.' 
                      : 'Connect your Upwork account to see jobs.'}
                  </p>
                </div>
              ) : (
                jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-sm"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                      <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
                        {job.budget}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">
                      Client: {job.client.name} • {job.postedDate} • {job.client.country} •
                      Rating: {job.client.rating} ⭐
                    </p>
                    
                    <p className="text-gray-700 mb-3">{job.description.substring(0, 250)}...</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            {skill}
                          </span>
                        ))}
                        <span className="text-gray-500 text-sm">
                          {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                        </span>
                      </div>
                      
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Details & Proposal Popup */}
      {showPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm">
                      {selectedJob.budget}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
                      {selectedJob.category || 'General'}
                    </span>
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
                      {selectedJob.client.rating} ⭐ Rating
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPopup(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Job Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
              </div>

              {/* Client Info */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Client Information</h4>
                  <p className="text-blue-800"><strong>Name:</strong> {selectedJob.client.name}</p>
                  <p className="text-blue-800"><strong>Country:</strong> {selectedJob.client.country}</p>
                  <p className="text-blue-800"><strong>Total Spent:</strong> ${selectedJob.client.totalSpent}</p>
                  <p className="text-blue-800"><strong>Total Hires:</strong> {selectedJob.client.totalHires}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">Job Details</h4>
                  <p className="text-green-800"><strong>Posted:</strong> {selectedJob.postedDate}</p>
                  <p className="text-green-800"><strong>Proposals:</strong> {selectedJob.proposals}</p>
                  <p className="text-green-800"><strong>Skills:</strong> {selectedJob.skills.join(', ')}</p>
                  <p className="text-green-800"><strong>Verified:</strong> {selectedJob.verified ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Proposal</h3>
                  {promptSettings && (
                    <div className="text-sm text-gray-600">
                      Using: <span className="font-semibold">{promptSettings.basicInfo.specialty}</span> template
                    </div>
                  )}
                </div>

                {proposalMessage && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    proposalMessage.includes('✅') 
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {proposalMessage}
                  </div>
                )}

                <div className="mb-4">
                  {editingProposal ? (
                    <textarea
                      value={generatedProposal}
                      onChange={(e) => setGeneratedProposal(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Edit your proposal here..."
                    />
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[200px]">
                      {generatedProposal ? (
                        <p className="text-gray-700 whitespace-pre-wrap">{generatedProposal}</p>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">📝</div>
                          <p>Generate a proposal to see it here</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-wrap gap-3 justify-between">
                <div className="flex gap-3">
                  {!generatedProposal ? (
                    <button
                      onClick={generateProposal}
                      disabled={proposalLoading}
                      className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center"
                    >
                      {proposalLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">✨</span>
                          Generate Proposal with AI
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingProposal(!editingProposal)}
                        className="bg-gray-600 text-white px-4 py-2.5 rounded-lg hover:bg-gray-700 font-medium"
                      >
                        {editingProposal ? 'Done Editing' : '✏️ Edit Proposal'}
                      </button>
                      
                      <button
                        onClick={saveProposal}
                        disabled={savingProposal}
                        className="bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {savingProposal ? 'Saving...' : '💾 Save to History'}
                      </button>
                      
                      <button
                        onClick={sendProposal}
                        disabled={sendingProposal}
                        className="bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                      >
                        {sendingProposal ? 'Sending...' : '🚀 Send to Upwork'}
                      </button>
                    </>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPopup(false)}
                    className="bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  
                  {generatedProposal && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedProposal)
                        setProposalMessage('✅ Proposal copied to clipboard!')
                      }}
                      className="bg-blue-100 text-blue-700 px-4 py-2.5 rounded-lg hover:bg-blue-200 font-medium"
                    >
                      📋 Copy Proposal
                    </button>
                  )}
                </div>
              </div>
              
              {/* Training Info */}
              {generatedProposal && (
                <div className="mt-4 text-sm text-gray-600 text-center">
                  <p>💡 Your edits are automatically saved to train the AI for better proposals next time!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}