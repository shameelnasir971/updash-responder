//components/JobPopup/JobPopup.tsx


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
  category: string
  jobType: string
  experienceLevel: string
  source: string
  isRealJob: boolean
  _raw?: any
}

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface JobPopupProps {
  job: Job | null
  user: User | null
  onClose: () => void
  onProposalGenerated: (proposal: string) => void
}

export default function JobPopup({ job, user, onClose, onProposalGenerated }: JobPopupProps) {
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedProposal, setEditedProposal] = useState('')
  const [showTrainingConfirm, setShowTrainingConfirm] = useState(false)

  useEffect(() => {
    if (job) {
      setProposal('')
      setEditMode(false)
      setEditedProposal('')
    }
  }, [job])

  const handleGenerateProposal = async () => {
    if (!job || !user) return
    
    setGenerating(true)
    try {
      console.log('🤖 Generating proposal for job:', job.id)
      
      // Get user's prompt settings for AI
      const settingsResponse = await fetch('/api/prompts')
      const settingsData = await settingsResponse.json()
      
      const requestData = {
        jobId: job.id,
        jobTitle: job.title,
        jobDescription: job.description,
        clientInfo: job.client,
        budget: job.budget,
        skills: job.skills,
        userSettings: settingsData.settings || {}
      }
      
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setProposal(data.proposal)
        setEditedProposal(data.proposal)
        onProposalGenerated(data.proposal)
        console.log('✅ Proposal generated:', data.details)
      } else {
        alert('❌ Failed to generate proposal: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('❌ Generate error:', error)
      alert('Error generating proposal: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveProposal = async (status = 'saved') => {
    if (!job || !user || !editedProposal) {
      alert('Please generate and edit proposal first')
      return
    }
    
    setSaving(true)
    try {
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
          status: status
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        alert(`✅ Proposal ${status === 'sent' ? 'sent and ' : ''}saved to history!`)
        setProposal(editedProposal)
        setEditMode(false)
        
        // Show AI training confirmation if user edited
        if (proposal !== editedProposal && status === 'sent') {
          setShowTrainingConfirm(true)
        }
        
        if (status === 'sent') {
          onClose() // Close popup after sending
        }
      } else {
        alert('❌ Failed to save: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('❌ Save error:', error)
      alert('Error saving proposal: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSendToUpwork = async () => {
    if (!job || !user || !editedProposal) return
    
    setSending(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: editedProposal,
          originalProposal: proposal,
          editReason: 'User approved with edits'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        alert('✅ Proposal sent to Upwork successfully!')
        handleSaveProposal('sent')
      } else {
        alert('❌ Failed to send: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('❌ Send error:', error)
      alert('Error sending proposal: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  if (!job) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {job.budget}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {job.jobType}
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {job.experienceLevel}
                  </span>
                  <span className="text-sm text-gray-600">
                    Posted: {job.postedDate}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Job Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Job Description */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                  </div>
                </div>

                {/* Client Info */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Client Name</p>
                      <p className="font-semibold">{job.client.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Rating</p>
                      <div className="flex items-center">
                        <span className="font-semibold text-yellow-600">{job.client.rating} ⭐</span>
                        <span className="text-sm text-gray-500 ml-2">({job.client.totalHires} hires)</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Country</p>
                      <p className="font-semibold">{job.client.country}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Spent</p>
                      <p className="font-semibold">${job.client.totalSpent}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Proposal */}
              <div className="space-y-6">
                {/* Skills Required */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Required</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Proposals: {job.proposals}</p>
                    <p>Verified: {job.verified ? '✅ Yes' : '❌ No'}</p>
                  </div>
                </div>

                {/* Proposal Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {proposal ? (editMode ? 'Edit Proposal' : 'Generated Proposal') : 'Generate Proposal'}
                  </h3>
                  
                  {proposal ? (
                    editMode ? (
                      <div className="space-y-4">
                        <textarea
                          value={editedProposal}
                          onChange={(e) => setEditedProposal(e.target.value)}
                          rows={12}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Edit your proposal..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditMode(false)
                              setEditedProposal(proposal)
                            }}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setProposal(editedProposal)
                              setEditMode(false)
                            }}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Save Edit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="prose max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                          <p className="text-gray-700 whitespace-pre-wrap">{proposal}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditMode(true)}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(proposal)}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={handleGenerateProposal}
                      disabled={generating}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 font-semibold text-lg"
                    >
                      {generating ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Generating...
                        </span>
                      ) : (
                        '🤖 Generate Professional Proposal'
                      )}
                    </button>
                  )}

                  {/* Action Buttons */}
                  {proposal && !editMode && (
                    <div className="mt-6 space-y-3">
                      <button
                        onClick={() => handleSaveProposal('saved')}
                        disabled={saving}
                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                      >
                        {saving ? 'Saving...' : '💾 Save to History'}
                      </button>
                      <button
                        onClick={handleSendToUpwork}
                        disabled={sending}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 font-semibold"
                      >
                        {sending ? 'Sending...' : '🚀 Send to Upwork'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Training Confirmation */}
      {showTrainingConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI Training Complete!</h3>
              <p className="text-gray-600 mb-6">
                Your proposal edits have been saved and will help AI generate better proposals in the future!
              </p>
              <button
                onClick={() => setShowTrainingConfirm(false)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold"
              >
                Awesome! Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}