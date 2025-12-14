// components/JobProposalPopup.tsx
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
}

interface UserSettings {
  basicInfo?: {
    specialty?: string
    provisions?: string
    hourlyRate?: string
    name?: string
    company?: string
  }
  proposalTemplates?: Array<{id: string, content: string}>
  aiSettings?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

interface JobProposalPopupProps {
  job: Job | null
  onClose: () => void
  onProposalGenerated: (proposal: string, jobId: string) => void
}

export default function JobProposalPopup({ job, onClose, onProposalGenerated }: JobProposalPopupProps) {
  const [proposal, setProposal] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>({})
  const [editMode, setEditMode] = useState(false)
  const [editedProposal, setEditedProposal] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (job) {
      loadUserSettings()
    }
  }, [job])

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings || {})
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const generateProposal = async () => {
    if (!job) return
    
    setIsGenerating(true)
    setMessage('')
    
    try {
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
        setProposal(data.proposal)
        setEditedProposal(data.proposal)
        onProposalGenerated(data.proposal, job.id)
        setMessage('✅ Proposal generated successfully!')
        setMessageType('success')
      } else {
        throw new Error(data.error || 'Failed to generate proposal')
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message)
      setMessageType('error')
    } finally {
      setIsGenerating(false)
    }
  }

  const saveProposal = async () => {
    if (!job || !proposal) return
    
    setIsSaving(true)
    
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
          proposalText: editedProposal || proposal,
          status: 'saved'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setMessage('✅ Proposal saved to history!')
        setMessageType('success')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message)
      setMessageType('error')
    } finally {
      setIsSaving(false)
    }
  }

  const sendProposal = async () => {
    if (!job || !proposal) return
    
    setIsSending(true)
    
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: editedProposal || proposal,
          originalProposal: proposal,
          editReason: editMode ? 'User edited' : 'Original'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setMessage(data.upworkSent 
          ? '✅ Proposal sent to Upwork and saved!'
          : '✅ Proposal saved (Upwork not connected)'
        )
        setMessageType('success')
        
        // If Upwork not connected, offer to connect
        if (!data.upworkSent) {
          setTimeout(() => {
            if (confirm('Upwork not connected. Would you like to connect now?')) {
              window.location.href = '/api/upwork/auth'
            }
          }, 1000)
        }
        
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to send')
      }
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message)
      setMessageType('error')
    } finally {
      setIsSending(false)
    }
  }

  const handleEdit = () => {
    setEditMode(true)
    setEditedProposal(proposal)
  }

  const handleSaveEdit = () => {
    setProposal(editedProposal)
    setEditMode(false)
    setMessage('✅ Proposal updated!')
    setMessageType('success')
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditedProposal('')
  }

  if (!job) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{job.title}</h2>
            <p className="text-gray-600">
              Client: {job.client.name} • {job.budget} • Posted: {job.postedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Job Details */}
        <div className="p-6">
          {/* Job Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Budget</h4>
              <p className="text-blue-700 font-semibold">{job.budget}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-1">Client Rating</h4>
              <p className="text-green-700 font-semibold">{job.client.rating} ⭐</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-900 mb-1">Proposals</h4>
              <p className="text-purple-700 font-semibold">{job.proposals} submitted</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-900 mb-1">Client Location</h4>
              <p className="text-yellow-700 font-semibold">{job.client.country}</p>
            </div>
          </div>

          {/* Job Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Required Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Proposal Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Proposal</h3>
              {proposal && !editMode && (
                <button
                  onClick={handleEdit}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ✏️ Edit Proposal
                </button>
              )}
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-lg ${
                messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {message}
              </div>
            )}

            {!proposal ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4 text-6xl">🤖</div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Generate Professional Proposal</h4>
                <p className="text-gray-500 mb-6">
                  AI will create a customized proposal based on your profile and job requirements
                </p>
                <button
                  onClick={generateProposal}
                  disabled={isGenerating}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Proposal'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Proposal Content */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {editMode ? 'Edit Proposal:' : 'Generated Proposal:'}
                  </h4>
                  
                  {editMode ? (
                    <div className="space-y-3">
                      <textarea
                        value={editedProposal}
                        onChange={(e) => setEditedProposal(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Edit your proposal..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-gray-700 whitespace-pre-wrap">{proposal}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveProposal}
                    disabled={isSaving}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        Saving...
                      </>
                    ) : (
                      '💾 Save to History'
                    )}
                  </button>
                  
                  <button
                    onClick={sendProposal}
                    disabled={isSending}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        Sending...
                      </>
                    ) : (
                      '🚀 Send to Upwork'
                    )}
                  </button>
                </div>

                {/* Note */}
                <p className="text-sm text-gray-500 text-center">
                  {userSettings.basicInfo?.name 
                    ? `Proposal will be sent as ${userSettings.basicInfo.name}`
                    : 'Using your profile information'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}