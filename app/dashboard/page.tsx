// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'
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
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Popup states
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)

  useEffect(() => {
    checkAuth()
    loadJobs()
    checkUpworkStatus()
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

  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      const data = await response.json()
      setUpworkConnected(data.connected)
    } catch (error) {
      console.error('Failed to check Upwork status')
    }
  }

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      const response = await fetch('/api/upwork/jobs')
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try refreshing.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Success! Loaded ${data.jobs.length} real jobs from Upwork!`)
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

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowJobPopup(true)
    setProposal('')
    setEditingProposal(false)
  }

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
      
      if (response.ok) {
        setProposal(data.proposal)
        alert('✅ Proposal generated successfully!')
      } else {
        alert('❌ Failed to generate proposal: ' + data.error)
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setGeneratingProposal(false)
    }
  }

  const handleSaveProposal = async () => {
    if (!selectedJob || !proposal.trim()) {
      alert('❌ Please generate a proposal first')
      return
    }
    
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
          proposalText: proposal,
          status: 'saved'
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert('✅ Proposal saved to history!')
        setShowJobPopup(false)
        loadJobs()
      } else {
        alert('❌ Failed to save: ' + data.error)
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setSavingProposal(false)
    }
  }

  const handleSendProposal = async () => {
    if (!selectedJob || !proposal.trim()) {
      alert('❌ Please generate a proposal first')
      return
    }
    
    if (!upworkConnected) {
      alert('❌ Please connect Upwork account first to send proposals')
      return
    }
    
    setSendingProposal(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          proposalText: proposal,
          originalProposal: proposal,
          editReason: 'Generated and sent'
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert('✅ Proposal sent successfully to Upwork!')
        setShowJobPopup(false)
        loadJobs()
      } else {
        alert('❌ Failed to send: ' + data.error)
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setSendingProposal(false)
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
      <div className="flex-1 lg:ml-80">
        <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {upworkConnected ? ' Real Upwork jobs' : 'Connect Upwork to see real jobs'}
                </p>
              </div>
              
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                ☰
              </button>
            </div>
          </div>

          {/* Error Message */}
          {connectionError && (
            <div className={`mb-6 p-4 rounded-lg ${
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
                  Refresh Jobs
                </button>
              </div>
            </div>
          )}

          {/* Jobs List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork to See Jobs'}
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
                  <p className="text-gray-600">Loading real jobs from Upwork...</p>
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
                      : 'Connect your Upwork account to see real jobs.'}
                  </p>
                  {!upworkConnected && (
                    <button 
                      onClick={() => window.location.href = '/dashboard?connect=true'}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Connect Upwork Now
                    </button>
                  )}
                </div>
              ) : (
                jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                          {job.isRealJob && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              REAL
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                          <span className="font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                            {job.budget}
                          </span>
                          <span>Client: {job.client.name}</span>
                          <span>Rating: {job.client.rating} ⭐</span>
                          <span>{job.postedDate}</span>
                          <span>{job.client.country}</span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 mb-4 line-clamp-2">
                      {job.description.substring(0, 300)}...
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {job.skills.slice(0, 4).map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="text-gray-500 text-sm">
                            +{job.skills.length - 4} more
                          </span>
                        )}
                        <span className="text-gray-500 text-sm">
                          {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                        </span>
                      </div>
                      
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Generate Proposal →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Details Popup */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h2>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900">Budget</h4>
                  <p className="text-blue-700 font-semibold">{selectedJob.budget}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900">Client</h4>
                  <p className="text-green-700 font-semibold">
                    {selectedJob.client.name} ({selectedJob.client.rating}⭐)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Job Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedJob.description}
                  </p>
                </div>
              </div>

              {/* Skills */}
              {selectedJob.skills && selectedJob.skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.skills.map((skill, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Proposal Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {proposal ? 'Generated Proposal' : 'Generate Proposal'}
                </h3>
                
                {!proposal ? (
                  <button
                    onClick={handleGenerateProposal}
                    disabled={generatingProposal}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {generatingProposal ? (
                      <>
                        <span className="animate-spin inline-block mr-2">⟳</span>
                        Generating Professional Proposal...
                      </>
                    ) : (
                      '🤖 Generate Professional Proposal'
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Proposal Content</h4>
                      <button
                        onClick={() => setEditingProposal(!editingProposal)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {editingProposal ? '📋 View' : '✏️ Edit Proposal'}
                      </button>
                    </div>
                    
                    {editingProposal ? (
                      <textarea
                        value={proposal}
                        onChange={(e) => setProposal(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Edit your proposal..."
                      />
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <p className="text-gray-700 whitespace-pre-wrap">{proposal}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveProposal}
                        disabled={savingProposal}
                        className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                      >
                        {savingProposal ? 'Saving...' : '💾 Save to History'}
                      </button>
                      
                      <button
                        onClick={handleSendProposal}
                        disabled={sendingProposal || !upworkConnected}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                      >
                        {sendingProposal ? 'Sending...' : upworkConnected ? '🚀 Send to Upwork' : 'Connect Upwork First'}
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center">
                      Save: Stores in History • Send: Sends to Upwork + Saves in History
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