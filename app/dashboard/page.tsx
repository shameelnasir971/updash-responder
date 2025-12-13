
// app/dashboard/page.tsx 
'use client'

import { useState, useEffect } from 'react'

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

  // ✅ POPUP STATES
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showJobPopup, setShowJobPopup] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generatingProposal, setGeneratingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState(false)
  const [editProposalText, setEditProposalText] = useState('')

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
        // ✅ REAL JOBS SET KARO
        setJobs(data.jobs || [])
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
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to connect: ' + (data.error || 'Unknown error'))
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  // ✅ JOB CLICK HANDLER
  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setProposal('')
    setEditProposalText('')
    setEditingProposal(false)
    setShowJobPopup(true)
  }

  // ✅ GENERATE PROPOSAL FUNCTION
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
      
      if (data.success && data.proposal) {
        setProposal(data.proposal)
        setEditProposalText(data.proposal)
        alert('✅ Proposal generated successfully!')
      } else {
        alert('❌ Failed to generate proposal: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Generate error:', error)
      alert('❌ Error generating proposal: ' + error.message)
    } finally {
      setGeneratingProposal(false)
    }
  }

  // ✅ SAVE PROPOSAL FUNCTION
  const handleSaveProposal = async () => {
    if (!selectedJob || !proposal) return
    
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
          proposalText: editingProposal ? editProposalText : proposal,
          status: 'saved'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert('✅ Proposal saved to history!')
        // Close popup
        setShowJobPopup(false)
        setSelectedJob(null)
      } else {
        alert('❌ Failed to save: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Save error:', error)
      alert('❌ Error saving proposal: ' + error.message)
    } finally {
      setSavingProposal(false)
    }
  }

  // ✅ SEND PROPOSAL FUNCTION (UPWORK + HISTORY)
  const handleSendProposal = async () => {
    if (!selectedJob || !proposal) return
    
    setSendingProposal(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          proposalText: editingProposal ? editProposalText : proposal,
          originalProposal: proposal,
          editReason: editingProposal ? 'User edited before sending' : 'Original AI proposal'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        const successMessage = data.upworkSent 
          ? '✅ Proposal sent to Upwork and saved to history!' 
          : '✅ Proposal saved to history (Upwork not connected)'
        alert(successMessage)
        
        // Close popup
        setShowJobPopup(false)
        setSelectedJob(null)
      } else {
        alert('❌ Failed to send: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Send error:', error)
      alert('❌ Error sending proposal: ' + error.message)
    } finally {
      setSendingProposal(false)
    }
  }

  // ✅ EDIT PROPOSAL TOGGLE
  const toggleEditProposal = () => {
    if (editingProposal) {
      // Save edited changes
      setProposal(editProposalText)
    }
    setEditingProposal(!editingProposal)
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
                {upworkConnected ? ' Upwork jobs' : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${upworkConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {upworkConnected ? '✅ Connected' : '❌ Not Connected'}
              </div>
              
              {!upworkConnected && (
                <button 
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Upwork'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            connectionError.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-400' 
              : 'bg-yellow-100 text-yellow-700 border border-yellow-400'
          }`}>
            <span>{connectionError}</span>
            <button 
              onClick={loadJobs}
              className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Refresh
            </button>
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
                    
                    <button 
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJobClick(job)
                      }}
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

      {/* ✅ JOB DETAIL POPUP */}
      {showJobPopup && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">{selectedJob.budget}</span>
                    <span>•</span>
                    <span>Posted: {selectedJob.postedDate}</span>
                    <span>•</span>
                    <span>Client: {selectedJob.client.name}</span>
                    <span>•</span>
                    <span>Rating: {selectedJob.client.rating} ⭐</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowJobPopup(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Job Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
                
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Client Info</h4>
                    <p className="text-blue-700">Name: {selectedJob.client.name}</p>
                    <p className="text-blue-700">Country: {selectedJob.client.country}</p>
                    <p className="text-blue-700">Total Spent: ${selectedJob.client.totalSpent}</p>
                    <p className="text-blue-700">Total Hires: {selectedJob.client.totalHires}</p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h4 className="text-sm font-medium text-green-900 mb-1">Job Info</h4>
                    <p className="text-green-700">Skills: {selectedJob.skills.join(', ')}</p>
                    <p className="text-green-700">Proposals: {selectedJob.proposals}</p>
                    <p className="text-green-700">Verified: {selectedJob.verified ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Proposal Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Proposal</h3>
                  
                  {!proposal && (
                    <button
                      onClick={handleGenerateProposal}
                      disabled={generatingProposal}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                      {generatingProposal ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        '🤖 Generate Proposal'
                      )}
                    </button>
                  )}
                </div>

                {proposal ? (
                  <div className="space-y-4">
                    {/* Proposal Display/Edit */}
                    {editingProposal ? (
                      <textarea
                        value={editProposalText}
                        onChange={(e) => setEditProposalText(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Edit your proposal..."
                      />
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <p className="text-gray-700 whitespace-pre-wrap">{proposal}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4">
                      {/* Edit Toggle Button */}
                      <button
                        onClick={toggleEditProposal}
                        className={`px-4 py-2 rounded-lg font-medium ${
                          editingProposal 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-yellow-600 text-white hover:bg-yellow-700'
                        }`}
                      >
                        {editingProposal ? '💾 Save Edit' : '✏️ Edit Proposal'}
                      </button>

                      {/* Save Button */}
                      <button
                        onClick={handleSaveProposal}
                        disabled={savingProposal}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingProposal ? 'Saving...' : '💾 Save to History'}
                      </button>

                      {/* Send Button */}
                      <button
                        onClick={handleSendProposal}
                        disabled={sendingProposal}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {sendingProposal ? 'Sending...' : '🚀 Send to Upwork'}
                      </button>

                      {/* Close Button */}
                      <button
                        onClick={() => setShowJobPopup(false)}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Close
                      </button>
                    </div>
                    
                    {/* AI Training Info */}
                    <div className="text-sm text-gray-500 mt-4">
                      💡 AI will learn from your edits to generate better proposals next time!
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border">
                    <div className="text-gray-400 mb-4 text-6xl">🤖</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No Proposal Generated Yet</h3>
                    <p className="text-gray-500 mb-6">
                      Click "Generate Proposal" to create a professional proposal using AI
                    </p>
                    <p className="text-sm text-gray-400">
                      AI will use your prompts from Settings page to personalize the proposal
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