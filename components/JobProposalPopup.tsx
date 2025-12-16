'use client'

import { useState, useEffect } from 'react'

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

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface JobProposalPopupProps {
  job: Job
  user: User
  onClose: () => void
  onProposalGenerated?: (proposal: string) => void
}

export default function JobProposalPopup({ 
  job, 
  user, 
  onClose,
  onProposalGenerated 
}: JobProposalPopupProps) {
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState('')
  const [editedProposal, setEditedProposal] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [userPrompts, setUserPrompts] = useState<any>(null)

  // Load user's prompt settings
  useEffect(() => {
    const loadUserPrompts = async () => {
      try {
        const response = await fetch('/api/prompts')
        if (response.ok) {
          const data = await response.json()
          setUserPrompts(data.settings)
        }
      } catch (error) {
        console.error('Failed to load user prompts:', error)
      }
    }
    
    loadUserPrompts()
  }, [])

  // ✅ REAL AI Proposal Generation - NO MOCK DATA
  const generateProposal = async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    
    try {
      console.log('🤖 Generating REAL AI proposal for job:', job.id)
      
      // Load user prompts if not loaded
      if (!userPrompts) {
        const response = await fetch('/api/prompts')
        const data = await response.json()
        if (data.settings) {
          setUserPrompts(data.settings)
        }
      }
      
      // ✅ COMPLETE REAL DATA ChatGPT ko bhej rahe hain
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          clientInfo: job.client,
          budget: job.budget,
          skills: job.skills
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log('✅ AI Proposal generated:', data.details)
        setProposal(data.proposal)
        setEditedProposal(data.proposal)
        setSuccessMessage('✅ Professional proposal generated! Review and edit if needed.')
        
        if (onProposalGenerated) {
          onProposalGenerated(data.proposal)
        }
      } else {
        throw new Error(data.error || 'Failed to generate proposal')
      }
    } catch (error: any) {
      console.error('❌ Proposal generation error:', error)
      setErrorMessage('Failed to generate proposal: ' + error.message)
      
      // Show user-friendly error
      if (error.message.includes('API key')) {
        setErrorMessage('OpenAI API key issue. Please check your configuration.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ✅ Save Proposal to History
  const saveProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    setSaving(true)
    setErrorMessage('')
    
    try {
      console.log('💾 Saving proposal to history...')
      
      const response = await fetch('/api/proposals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          clientInfo: job.client,
          budget: job.budget,
          skills: job.skills,
          proposalText: editedProposal,
          status: 'saved'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage('✅ Proposal saved to history successfully!')
        
        // Redirect to history after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('❌ Save error:', error)
      setErrorMessage('Failed to save: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // ✅ Send Proposal to Upwork
  const sendProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    if (!confirm('Are you sure you want to send this proposal to Upwork?')) {
      return
    }

    setSending(true)
    setErrorMessage('')
    
    try {
      console.log('📤 Sending proposal to Upwork...')
      
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: editedProposal,
          originalProposal: proposal,
          editReason: isEditing ? 'User edited proposal' : 'Direct AI generation'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const message = data.upworkSent 
          ? '✅ Proposal sent to Upwork successfully!' 
          : '✅ Proposal saved (Upwork not connected)'
        
        setSuccessMessage(message)
        
        // Redirect to history after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to send')
      }
    } catch (error: any) {
      console.error('❌ Send error:', error)
      setErrorMessage('Failed to send: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">🤖 AI Proposal Generator</h2>
            <p className="text-sm text-gray-600">
              Generate personalized proposal for: <strong className="text-blue-700">{job.title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl bg-white rounded-full p-2 hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Job Details Card */}
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 rounded-xl border border-blue-200">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center">
              <span className="mr-2">📋</span> Job Details
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm font-medium text-blue-900 mb-1">Title & Budget</p>
                <p className="text-blue-700 font-semibold">{job.title}</p>
                <p className="text-green-700 font-bold mt-1">{job.budget}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm font-medium text-blue-900 mb-1">Client Info</p>
                <p className="text-blue-700">{job.client.name} • {job.client.country}</p>
                <p className="text-yellow-600">Rating: {job.client.rating} ⭐</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-sm font-medium text-blue-900 mb-1">Category & Skills</p>
                <p className="text-blue-700">{job.category || 'General'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {job.skills.slice(0, 3).map((skill, index) => (
                    <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-900 mb-2">Full Description:</p>
              <div className="bg-white p-4 rounded-lg border max-h-40 overflow-y-auto">
                <p className="text-gray-700 text-sm">{job.description}</p>
              </div>
            </div>
          </div>

          {/* Proposal Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center">
                <span className="mr-2">📝</span>
                {proposal ? 'Your AI-Generated Proposal' : 'Generate AI Proposal'}
              </h3>
              
              {!proposal && (
                <button
                  onClick={generateProposal}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>AI is Generating...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🤖</span>
                      <span className="font-semibold">Generate AI Proposal</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {proposal ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <p className="text-sm text-gray-600">
                      {isEditing ? '✏️ Editing Mode' : '✅ AI-Generated Proposal'}
                    </p>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        isEditing 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {isEditing ? 'Cancel Edit' : 'Edit Proposal'}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {editedProposal.length} characters
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      value={editedProposal}
                      onChange={(e) => setEditedProposal(e.target.value)}
                      rows={15}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                      placeholder="Edit your proposal here..."
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setEditedProposal(proposal)
                          setIsEditing(false)
                        }}
                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 mr-3"
                      >
                        Reset Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="prose max-w-none">
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                        {editedProposal}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={saveProposal}
                    disabled={saving || sending}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-4 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 shadow-lg flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl mb-1">💾</span>
                    <span className="font-semibold">{saving ? 'Saving...' : 'Save to History'}</span>
                  </button>
                  
                  <button
                    onClick={sendProposal}
                    disabled={saving || sending}
                    className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-4 rounded-lg hover:from-green-600 hover:to-teal-700 disabled:opacity-50 shadow-lg flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl mb-1">📤</span>
                    <span className="font-semibold">{sending ? 'Sending...' : 'Send to Upwork'}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editedProposal)
                      alert('✅ Proposal copied to clipboard!')
                    }}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-4 rounded-lg hover:from-purple-600 hover:to-pink-700 shadow-lg flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl mb-1">📋</span>
                    <span className="font-semibold">Copy to Clipboard</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-blue-300">
                <div className="text-7xl mb-6 animate-pulse">🤖</div>
                <h4 className="text-2xl font-bold text-gray-800 mb-3">
                  Generate AI-Powered Proposal
                </h4>
                <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                  Click the button to create a professional, personalized proposal using AI based on:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
                  <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                    <div className="text-blue-600 text-2xl mb-2">🎯</div>
                    <h5 className="font-semibold text-gray-800 mb-2">Job-Specific Analysis</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Complete job description analysis</li>
                      <li>• Client requirements matching</li>
                      <li>• Budget and timeline considerations</li>
                      <li>• Required skills assessment</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm">
                    <div className="text-green-600 text-2xl mb-2">👤</div>
                    <h5 className="font-semibold text-gray-800 mb-2">Your Personal Profile</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Your specialty and skills</li>
                      <li>• Previous work experience</li>
                      <li>• Hourly rate and services</li>
                      <li>• Proposal templates</li>
                    </ul>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 max-w-2xl mx-auto p-4 bg-white rounded-lg border">
                  <strong>AI Process:</strong> ChatGPT will analyze the job requirements, match them with your profile, 
                  create a personalized proposal highlighting your relevant experience, and include specific questions 
                  about the project to show genuine interest.
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-400 text-green-800 px-5 py-4 rounded-lg mb-4 shadow-lg">
              <div className="flex items-center">
                <span className="text-xl mr-3">✅</span>
                <div>
                  <p className="font-semibold">{successMessage}</p>
                  {successMessage.includes('history') && (
                    <p className="text-sm opacity-75 mt-1">Redirecting to history in 2 seconds...</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {errorMessage && (
            <div className="bg-gradient-to-r from-red-100 to-pink-100 border border-red-400 text-red-800 px-5 py-4 rounded-lg mb-4 shadow-lg">
              <div className="flex items-center">
                <span className="text-xl mr-3">❌</span>
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                  <p className="text-sm opacity-75 mt-1">Please try again or check your OpenAI API key</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">AI Powered:</span> Personalized proposals using ChatGPT with your profile data
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Using job details + your prompts page settings for maximum relevance
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}