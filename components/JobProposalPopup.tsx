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

  // ✅ REAL AI Proposal Generation - NO MOCK DATA
  const generateProposal = async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    
    try {
      console.log('🤖 Generating REAL AI proposal for job:', job.id)
      
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
        
        // Refresh after 2 seconds
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
        
        // Refresh after 2 seconds
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
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Job Proposal</h2>
            <p className="text-sm text-gray-600">
              Generate and send proposal for: <strong>{job.title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Job Details */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Job Details:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-sm text-blue-700"><strong>Title:</strong> {job.title}</p>
                <p className="text-sm text-blue-700"><strong>Budget:</strong> {job.budget}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700"><strong>Client:</strong> {job.client.name}</p>
                <p className="text-sm text-blue-700"><strong>Rating:</strong> {job.client.rating} ⭐</p>
              </div>
            </div>
            <p className="text-sm text-blue-700"><strong>Description:</strong></p>
            <p className="text-sm text-blue-700 mt-1 bg-blue-100 p-3 rounded">
              {job.description.substring(0, 300)}...
            </p>
          </div>

          {/* Proposal Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {proposal ? 'Your Proposal' : 'Generate Proposal'}
              </h3>
              {!proposal && (
                <button
                  onClick={generateProposal}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </div>
                  ) : (
                    '🤖 Generate Proposal'
                  )}
                </button>
              )}
            </div>

            {proposal ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">
                    {isEditing ? 'Editing mode' : 'AI-generated proposal'}
                  </p>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isEditing ? 'Cancel Edit' : '✏️ Edit Proposal'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    value={editedProposal}
                    onChange={(e) => setEditedProposal(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Edit your proposal..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{editedProposal}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={saveProposal}
                    disabled={saving || sending}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {saving ? 'Saving...' : '💾 Save to History'}
                  </button>
                  
                  <button
                    onClick={sendProposal}
                    disabled={saving || sending}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {sending ? 'Sending...' : '📤 Send to Upwork'}
                  </button>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editedProposal)
                      alert('Proposal copied to clipboard!')
                    }}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 flex-1 min-w-[140px]"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-4xl mb-4">🤖</div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">
                  Generate AI Proposal
                </h4>
                <p className="text-gray-600 mb-6">
                  Click "Generate Proposal" to create a professional proposal using AI based on:
                </p>
                <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
                  <li>• Job details (title, description, budget)</li>
                  <li>• Your profile information from Prompts page</li>
                  <li>• Your proposal templates and settings</li>
                  <li>• ChatGPT will analyze everything and create personalized proposal</li>
                </ul>
              </div>
            )}
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              {successMessage}
            </div>
          )}
          
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Using AI to generate personalized proposals based on your profile
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}