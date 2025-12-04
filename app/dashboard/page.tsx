// app/dashboard/page.tsx - UPDATED (REAL JOBS)
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
  subcategory?: string
  jobType?: string
  source?: string
  isRealJob?: boolean
  isConnectPrompt?: boolean
}

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  // Popup states
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [generatedProposal, setGeneratedProposal] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [sendingProposal, setSendingProposal] = useState(false)
  const [savingProposal, setSavingProposal] = useState(false)
  const [proposalGenerated, setProposalGenerated] = useState(false)

  const [stats, setStats] = useState({
    totalJobs: 0,
    matchedJobs: 0,
    proposalsSent: 0,
    successRate: 0
  })

  useEffect(() => {
  checkAuth()
  loadJobs()
    
    // Check for success message from Upwork connection
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success === 'upwork_connected') {
      alert('✅ Upwork account connected successfully! Loading real jobs...')
      setTimeout(() => {
        loadJobs()
      }, 1000)
    }
    
    if (error) {
      setConnectionError(`Upwork connection failed: ${searchParams.get('message') || error}`)
    }
  }, [searchParams])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        router.push('/auth/login')
      }
    } catch (error) {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      const response = await fetch('/api/jobs')
      const data = await response.json()

      if (response.ok) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        // Update stats
        const realJobs = data.jobs.filter((job: Job) => !job.isConnectPrompt)
        const matchedJobs = realJobs.filter((job: Job) => 
          job.isRealJob && !job.isConnectPrompt
        ).length
        
        setStats(prev => ({
          ...prev,
          totalJobs: data.total || 0,
          matchedJobs: matchedJobs
        }))
        
        console.log('✅ Loaded jobs:', {
          total: data.total,
          source: data.source,
          message: data.message,
          upworkConnected: data.upworkConnected
        })
        
      } else {
        setJobs([])
        setConnectionError(data.error || 'Failed to load jobs')
      }
    } catch (error) {
      console.error('Jobs loading error:', error)
      setJobs([])
      setConnectionError('Network error. Please try again.')
    } finally {
      setJobsLoading(false)
    }
  }

  // Handle Generate Proposal Button Click
  const handleGenerateProposalClick = (job: Job) => {
    if (job.isConnectPrompt) {
      return // Do nothing for connect prompt
    }
    
    setSelectedJob(job)
    setShowPopup(true)
    setProposalGenerated(false)
    setGeneratedProposal('')
  }

  // Generate AI Proposal
  const generateAIProposal = async () => {
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

      if (response.ok) {
        const data = await response.json()
        setGeneratedProposal(data.proposal)
        setProposalGenerated(true)
      } else {
        // Fallback mock proposal
        setGeneratedProposal(`Dear ${selectedJob.client.name},

I am excited to apply for your "${selectedJob.title}" position. With my extensive experience in ${selectedJob.skills.slice(0, 2).join(' and ')}, I am confident I can deliver exceptional results for your project.

I have successfully completed similar projects where I achieved [mention relevant achievement]. My approach focuses on [key methodology] to ensure [desired outcome].

I would be happy to discuss how I can contribute to your project's success. Please let me know a convenient time for a quick call.

Best regards,
${user?.name || 'Professional Freelancer'}`)
        setProposalGenerated(true)
      }
    } catch (error) {
      console.error('Proposal generation error:', error)
      setGeneratedProposal(`Dear ${selectedJob?.client.name || 'Client'},

I am writing to express my interest in your project "${selectedJob?.title}".

Based on the requirements, I believe my skills in ${selectedJob?.skills.slice(0, 2).join(' and ')} are a perfect match for this role.

Looking forward to discussing this opportunity further.

Best regards,
${user?.name || 'Professional Freelancer'}`)
      setProposalGenerated(true)
    } finally {
      setProposalLoading(false)
    }
  }

  const handleSaveProposal = async () => {
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
        alert(data.message || '✅ Proposal saved to history successfully!')
      } else {
        alert(data.error || 'Failed to save proposal')
      }
    } catch (error) {
      console.error('Proposal save error:', error)
      alert('Failed to save proposal. Please try again.')
    } finally {
      setSavingProposal(false)
    }
  }

  const sendProposal = async () => {
    if (!selectedJob || !generatedProposal) return

    setSendingProposal(true)
    
    try {
      // First save the proposal to history
      const saveResponse = await fetch('/api/proposals/save', {
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
          status: 'sent'
        })
      })

      const saveData = await saveResponse.json()

      if (saveResponse.ok && saveData.success) {
        // Then send the proposal to Upwork
        const sendResponse = await fetch('/api/proposals/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: selectedJob.id,
            jobTitle: selectedJob.title,
            proposalText: generatedProposal,
            originalProposal: generatedProposal,
            editReason: 'User reviewed and sent'
          })
        })

        const sendData = await sendResponse.json()

        if (sendResponse.ok && sendData.success) {
          if (sendData.upworkSent) {
            alert('🎉 Proposal sent successfully to Upwork!')
          } else {
            alert('✅ Proposal saved and marked as sent (Upwork not connected)')
          }
          
          // Close popup and reset
          setShowPopup(false)
          setSelectedJob(null)
          setGeneratedProposal('')
          setProposalGenerated(false)
          
          // Update stats
          setStats(prev => ({
            ...prev,
            proposalsSent: prev.proposalsSent + 1
          }))
          
          // Refresh jobs list
          loadJobs()
        } else {
          alert(sendData.error || 'Failed to send proposal')
        }
      } else {
        throw new Error(saveData.error || 'Failed to save proposal')
      }
    } catch (error: any) {
      console.error('Proposal send error:', error)
      alert('Failed to send proposal: ' + error.message)
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
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-600 hidden sm:block">
            {upworkConnected ? 'Real Upwork jobs fetched live' : 'Connect Upwork to see real jobs'}
          </p>
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {connectionError}
            </div>
            <button 
              onClick={loadJobs}
              className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">{stats.totalJobs}</div>
              <div className="text-sm text-gray-600">Total Jobs</div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">{stats.matchedJobs}</div>
              <div className="text-sm text-gray-600">Matched Jobs</div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">{stats.proposalsSent}</div>
              <div className="text-sm text-gray-600">Proposals Sent</div>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">{stats.successRate}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6">
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {upworkConnected ? 'Real Upwork Jobs' : 'Connect Upwork to See Jobs'}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {upworkConnected 
                      ? 'Live jobs fetched from your Upwork account' 
                      : 'Click "Connect Upwork" in sidebar to see real jobs'}
                  </p>
                </div>
                
                <div className="text-sm text-gray-600">
                  {upworkConnected ? `Showing ${jobs.length} real jobs` : 'Connect Upwork to load jobs'}
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {jobsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {upworkConnected ? 'Fetching real jobs from Upwork...' : 'Loading...'}
                  </p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4 text-6xl">💼</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Jobs Found</h3>
                  <p className="text-gray-500 mb-6">Try adjusting your search criteria or connect Upwork</p>
                  <button onClick={loadJobs} className="btn-primary">🔄 Refresh Jobs</button>
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 text-base">
                                {job.isConnectPrompt ? '🔗 ' : ''}{job.title}
                              </h3>
                              {job.verified && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                                  Verified
                                </span>
                              )}
                              {job.isRealJob && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1"></span>
                                  Real Job
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-3">
                              <span className="font-medium">{job.client.name}</span>
                              <span className="mx-2">•</span>
                              <span>{job.postedDate}</span>
                            </div>

                            <p className="text-gray-700 text-sm mb-3 line-clamp-2">{job.description}</p>

                            <div className="flex flex-wrap gap-1 mb-3">
                              {job.skills.map((skill, index) => (
                                <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded border border-gray-300">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Budget: {job.budget}</span>
                          {job.category && <span>Category: {job.category}</span>}
                          {job.jobType && <span>Type: {job.jobType}</span>}
                        </div>
                      </div>

                      {/* GENERATE PROPOSAL BUTTON */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[140px]">
                        <button 
                          onClick={() => handleGenerateProposalClick(job)}
                          disabled={proposalLoading || job.isConnectPrompt}
                          className={`btn-primary text-sm py-2 px-4 ${
                            job.isConnectPrompt ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {job.isConnectPrompt ? 'Connect Upwork First' : 'Generate Proposal'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Animated Proposal Popup */}
      {showPopup && selectedJob && !selectedJob.isConnectPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
          <div 
            className={`bg-white h-full w-[500px] transform transition-transform duration-300 ${
              showPopup ? 'translate-x-0' : 'translate-x-full'
            } overflow-y-auto shadow-2xl`}
          >
            {/* Popup content */}
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Job Details</h2>
                <button 
                  onClick={() => {
                    setShowPopup(false)
                    setSelectedJob(null)
                    setProposalGenerated(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Job Title Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Title</h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {selectedJob.title}
                </p>
              </div>

              {/* Budget, Posted, Client Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Budget</h4>
                  <p className="text-blue-700 font-semibold text-sm">{selectedJob.budget}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <h4 className="text-sm font-medium text-green-900 mb-1">Posted</h4>
                  <p className="text-green-700 font-semibold text-sm">{selectedJob.postedDate}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <h4 className="text-sm font-medium text-purple-900 mb-1">Client</h4>
                  <p className="text-purple-700 font-semibold text-sm">{selectedJob.client.name}</p>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <textarea 
                  readOnly
                  value={selectedJob.description}
                  className="w-full h-40 p-4 border border-gray-300 rounded-lg bg-gray-50 resize-none focus:outline-none text-sm"
                />
              </div>

              {/* Generate Response Button */}
              {!proposalGenerated && (
                <div className="border-t pt-6">
                  <button 
                    onClick={generateAIProposal}
                    disabled={proposalLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {proposalLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Generating AI Response...
                      </>
                    ) : (
                      'Generate Response'
                    )}
                  </button>
                </div>
              )}

              {/* Generated Proposal Section */}
              {proposalGenerated && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Generated Proposal</h3>
                  <textarea 
                    value={generatedProposal}
                    onChange={(e) => setGeneratedProposal(e.target.value)}
                    className="w-full h-56 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="AI generated proposal will appear here..."
                  />
                  
                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-3">
                    <button 
                      onClick={() => {
                        setProposalGenerated(false)
                        setGeneratedProposal('')
                      }}
                      className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                    >
                      Regenerate
                    </button>
                    
                    <button 
                      onClick={handleSaveProposal}
                      disabled={savingProposal || !generatedProposal.trim()}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {savingProposal ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        '💾 Save'
                      )}
                    </button>
                    
                    <button 
                      onClick={sendProposal}
                      disabled={sendingProposal || !generatedProposal.trim()}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {sendingProposal ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        'Send Proposal'
                      )}
                    </button>
                  </div>

                  {/* AI Training Note */}
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      💡 <strong>AI Training:</strong> Any edits you make will help train our AI to generate better proposals in the future!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}