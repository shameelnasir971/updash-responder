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
  duration?: string
  source?: string
  isRealJob?: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)

  // ✅ MODAL STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobModal, setShowJobModal] = useState(false)
  const [generatedProposal, setGeneratedProposal] = useState('')
  const [editedProposal, setEditedProposal] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
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
      console.error('Status check failed')
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
      console.log('📊 Jobs Data:', data)

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError('No jobs found. Try refreshing.')
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

  // ✅ JOB CLICK HANDLER
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setGeneratedProposal('')
    setEditedProposal('')
    setShowJobModal(true)
  }

  // ✅ GENERATE PROPOSAL HANDLER
  const handleGenerateProposal = async () => {
    if (!selectedJob) return
    
    setProposalLoading(true)
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
        setGeneratedProposal(data.proposal)
        setEditedProposal(data.proposal)
        alert('✅ Proposal generated successfully!')
      } else {
        alert('❌ ' + (data.error || 'Failed to generate proposal'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setProposalLoading(false)
    }
  }

  // ✅ SAVE PROPOSAL HANDLER
  const handleSaveProposal = async () => {
    if (!selectedJob || !editedProposal) return
    
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
          proposalText: editedProposal,
          status: 'saved'
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert('✅ Proposal saved to history!')
        setShowJobModal(false)
      } else {
        alert('❌ ' + (data.error || 'Failed to save proposal'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setSavingProposal(false)
    }
  }

  // ✅ SEND PROPOSAL HANDLER
  const handleSendProposal = async () => {
    if (!selectedJob || !editedProposal) return
    
    if (!upworkConnected) {
      alert('⚠️ Please connect Upwork account first to send proposals')
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
          proposalText: editedProposal,
          originalProposal: generatedProposal,
          editReason: 'User edited before sending'
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert('✅ Proposal sent successfully to Upwork!')
        setShowJobModal(false)
      } else {
        alert('❌ ' + (data.error || 'Failed to send proposal'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
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
      <div className="lg:pl-80">
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {upworkConnected ? ' Real Upwork jobs' : 'Connect Upwork to see real jobs'}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden bg-gray-800 text-white p-2 rounded-lg"
                >
                  ☰
                </button>
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
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <span>{connectionError}</span>
                <button 
                  onClick={loadJobs}
                  className="ml-4 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
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
                  {upworkConnected ? 'Upwork Jobs' : 'Connect Upwork to See Jobs'}
                </h2>
                <div className="text-sm text-gray-600">
                  {jobs.length} jobs found
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
                      ? 'Try refreshing or check Upwork directly.' 
                      : 'Connect your Upwork account to see real jobs.'}
                  </p>
                  {!upworkConnected && (
                    <button 
                      onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Browse Upwork
                    </button>
                  )}
                </div>
              ) : (
                jobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
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
                    
                    <p className="text-gray-700 mb-3 line-clamp-2">
                      {job.description}
                    </p>
                    
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
                      
                      <span className="text-blue-600 font-semibold">
                        Click to generate proposal →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ JOB MODAL POPUP - RIGHT SIDE */}
      {showJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h2 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h2>
                <button 
                  onClick={() => setShowJobModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Job Details */}
              <div className="mb-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Budget</h4>
                    <p className="text-blue-700 font-semibold text-lg">{selectedJob.budget}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-900 mb-1">Client Rating</h4>
                    <p className="text-green-700 font-semibold text-lg">{selectedJob.client.rating} ⭐</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h4>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-700 whitespace-pre-line">{selectedJob.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Client Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600 text-sm">Name</p>
                      <p className="font-semibold">{selectedJob.client.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Country</p>
                      <p className="font-semibold">{selectedJob.client.country}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Total Spent</p>
                      <p className="font-semibold">${selectedJob.client.totalSpent}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Total Hires</p>
                      <p className="font-semibold">{selectedJob.client.totalHires}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.skills.map((skill, index) => (
                      <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Generate Proposal</h3>
                
                {!generatedProposal ? (
                  <button
                    onClick={handleGenerateProposal}
                    disabled={proposalLoading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {proposalLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      '🤖 Generate Professional Proposal'
                    )}
                  </button>
                ) : (
                  <div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Edit Your Proposal
                      </label>
                      <textarea
                        value={editedProposal}
                        onChange={(e) => setEditedProposal(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Your proposal will appear here..."
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveProposal}
                        disabled={savingProposal}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                      >
                        {savingProposal ? 'Saving...' : '💾 Save to History'}
                      </button>
                      
                      <button
                        onClick={handleSendProposal}
                        disabled={sendingProposal || !upworkConnected}
                        className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                      >
                        {sendingProposal ? 'Sending...' : '🚀 Send to Upwork'}
                      </button>
                    </div>
                    
                    {!upworkConnected && (
                      <p className="text-red-600 text-sm mt-2 text-center">
                        ⚠️ Connect Upwork account to send proposals
                      </p>
                    )}
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