// app/dashboard/page.tsx 
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
  isConnectPrompt?: boolean
}

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [upworkConnected, setUpworkConnected] = useState(false) // ✅ YEH LINE ADD KI
  
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
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        
        console.log('📊 Jobs API response:', {
          success: data.success,
          total: data.total,
          source: data.source,
          upworkConnected: data.upworkConnected,
          jobsLength: data.jobs?.length
        })
        
        // Check if we got the connect prompt
        if (data.jobs && data.jobs.length === 1 && data.jobs[0].isConnectPrompt) {
          // Show connect prompt
          setJobs([data.jobs[0]])
          setUpworkConnected(false)
        } else {
          // Real jobs from Upwork or fallback
          setJobs(data.jobs || [])
          setUpworkConnected(data.upworkConnected || false)
        }
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalJobs: data.total || 0,
          matchedJobs: data.jobs?.length || 0
        }))
        
      } else {
        console.error('Jobs API failed:', response.status)
        setJobs([])
        setUpworkConnected(false)
      }
    } catch (error) {
      console.error('Jobs loading error:', error)
      setJobs([])
      setUpworkConnected(false)
    } finally {
      setJobsLoading(false)
    }
  }

  // Handle Generate Proposal Button Click
  const handleGenerateProposalClick = (job: Job) => {
    // Agar connect prompt job hai to connect karne ko bolen
    if (job.isConnectPrompt) {
      alert('Please connect your Upwork account first!')
      return
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

I have successfully completed similar projects where I [mention relevant achievement]. My approach focuses on [key methodology] to ensure [desired outcome].

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

  // Save Proposal to History
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

  // Send Proposal Function
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
          // Show appropriate message based on Upwork connection
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
          
          // Refresh jobs list if needed
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

  // Check Upwork connection status
  const checkUpworkStatus = async () => {
    try {
      const response = await fetch('/api/upwork/status')
      if (response.ok) {
        const data = await response.json()
        setUpworkConnected(data.connected)
      }
    } catch (error) {
      console.error('Upwork status check error:', error)
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
          <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
          <p className="text-sm text-gray-600">
            {upworkConnected ? 'Connected to Upwork ✓' : 'Upwork not connected'}
          </p>
        </div>

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

        {/* Connection Status Banner */}
        {!upworkConnected && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-yellow-500 text-white p-2 rounded-full mr-3">
                ⚠️
              </div>
              <div>
                <p className="font-semibold text-yellow-800">Upwork Account Not Connected</p>
                <p className="text-yellow-700 text-sm">
                  Connect your Upwork account to see real job listings and send proposals.
                </p>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
            >
              🔄 Refresh Status
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6">
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {upworkConnected ? 'Upwork Jobs' : 'Job Listings'}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {upworkConnected 
                      ? 'Real jobs from your Upwork account' 
                      : 'Connect Upwork to see real job listings'}
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <div className="text-sm text-gray-600">
                    Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                  </div>
                  <button 
                    onClick={loadJobs}
                    disabled={jobsLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {jobsLoading ? 'Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {jobsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading job listings...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4 text-6xl">💼</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Jobs Found</h3>
                  <p className="text-gray-500 mb-6">
                    {upworkConnected 
                      ? 'No jobs match your current filters' 
                      : 'Connect Upwork to see job listings'}
                  </p>
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
                              {job.verified && !job.isConnectPrompt && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                                  Verified
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-3">
                              <span className="font-medium">{job.client.name}</span>
                              {!job.isConnectPrompt && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>{job.postedDate}</span>
                                </>
                              )}
                            </div>

                            <p className="text-gray-700 text-sm mb-3 line-clamp-2">{job.description}</p>

                            {!job.isConnectPrompt && job.skills && job.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {job.skills.map((skill, index) => (
                                  <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded border border-gray-300">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {!job.isConnectPrompt && (
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Proposals: {job.proposals}</span>
                            <span>Budget: {job.budget}</span>
                            {job.category && <span>Category: {job.category}</span>}
                          </div>
                        )}
                      </div>

                      {/* BUTTON SECTION */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[140px]">
                        {job.isConnectPrompt ? (
                          <button 
                            onClick={() => window.location.reload()}
                            className="btn-primary text-sm py-2 px-4"
                          >
                            🔗 Connect Upwork
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleGenerateProposalClick(job)}
                            disabled={proposalLoading}
                            className="btn-primary text-sm py-2 px-4"
                          >
                            Generate Proposal
                          </button>
                        )}
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
                  
                  {/* BUTTONS */}
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
                    
                    {/* SAVE BUTTON */}
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