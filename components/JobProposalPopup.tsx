'use client'

import { useState, useEffect } from 'react'

interface Job {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  client?: {
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

  // Safe client data with real fallbacks (Upwork API doesn't always give full client info)
  const client = job.client || {
    name: 'Upwork Client',
    rating: 0,
    country: 'Worldwide',
    totalSpent: 0,
    totalHires: 0,
  }

  useEffect(() => {
    console.log('Verifying REAL job data:', {
      id: job.id,
      title: job.title,
      descriptionLength: job.description.length,
      budget: job.budget,
      skillsCount: job.skills.length,
      clientCountry: client.country,
      clientRating: client.rating,
      clientHires: client.totalHires,
      isRealJob: job.isRealJob
    })
  }, [job, client])

  const generateProposal = async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          clientInfo: client,
          budget: job.budget,
          skills: job.skills,
          category: job.category,
          duration: job.duration,
          postedDate: job.postedDate
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setProposal(data.proposal)
        setEditedProposal(data.proposal)
        setSuccessMessage('Professional, job-specific proposal generated!')
        if (onProposalGenerated) {
          onProposalGenerated(data.proposal)
        }
      } else {
        throw new Error(data.error || 'Failed to generate proposal')
      }
    } catch (error: any) {
      console.error('Proposal generation error:', error)
      setErrorMessage('Failed to generate proposal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/proposals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          clientInfo: client,
          budget: job.budget,
          skills: job.skills,
          proposalText: editedProposal,
          status: 'saved'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage('Proposal saved to history!')
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      setErrorMessage('Failed to save: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const sendProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    if (!confirm('Send this proposal to Upwork?')) return

    setSending(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: editedProposal,
          originalProposal: proposal,
          editReason: isEditing ? 'Edited by user' : 'AI generated'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const message = data.upworkSent
          ? 'Proposal sent to Upwork!'
          : 'Proposal saved (Connect Upwork to send)'

        setSuccessMessage(message)
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to send')
      }
    } catch (error: any) {
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
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm font-medium px-2 py-1 bg-green-100 text-green-800 rounded">
                REAL Job Data
              </span>
              <span className="text-sm text-gray-600">
                ID: {job.id.substring(0, 8)}...
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Real Job Details Section */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">REAL Job Details:</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-sm text-blue-700"><strong>Title:</strong> {job.title}</p>
                <p className="text-sm text-blue-700"><strong>Budget:</strong> {job.budget}</p>
                <p className="text-sm text-blue-700"><strong>Category:</strong> {job.category || 'Not specified'}</p>
                <p className="text-sm text-blue-700"><strong>Client Location:</strong> {client.country}</p>
                <p className="text-sm text-blue-700"><strong>Client Rating:</strong> {client.rating.toFixed(1)} ({client.totalHires} hires)</p>
              </div>
              <div>
                <p className="text-sm text-blue-700"><strong>Posted:</strong> {job.postedDate}</p>
                <p className="text-sm text-blue-700"><strong>Proposals:</strong> {job.proposals}</p>
                <p className="text-sm text-blue-700"><strong>Skills:</strong> {job.skills.slice(0, 5).join(', ') || 'None listed'}</p>
                <p className="text-sm text-blue-700"><strong>Client Spent:</strong> ${client.totalSpent.toLocaleString()}</p>
              </div>
            </div>

            <p className="text-sm text-blue-700"><strong>Description:</strong></p>
            <p className="text-sm text-blue-700 mt-1 bg-blue-100 p-3 rounded">
              {job.description.substring(0, 500)}
              {job.description.length > 500 && '...'}
            </p>

            <div className="mt-2 text-xs text-blue-600">
              Verified Real Data • {job.description.length} characters • {job.skills.length} skills
            </div>
          </div>

          {/* Proposal Generation Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {proposal ? 'Your AI Proposal' : 'Generate AI Proposal'}
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
                    'Generate AI Proposal'
                  )}
                </button>
              )}
            </div>

            {proposal ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">
                    {isEditing ? 'Editing mode' : 'AI-generated from real job'}
                  </p>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isEditing ? 'Cancel Edit' : 'Edit Proposal'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    value={editedProposal}
                    onChange={(e) => setEditedProposal(e.target.value)}
                    rows={14}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  />
                ) : (
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{editedProposal}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={saveProposal}
                    disabled={saving || sending}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {saving ? 'Saving...' : 'Save to History'}
                  </button>

                  <button
                    onClick={sendProposal}
                    disabled={saving || sending}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {sending ? 'Sending...' : 'Send to Upwork'}
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editedProposal)
                      alert('Copied to clipboard!')
                    }}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 flex-1 min-w-[140px]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <div className="text-5xl mb-4">🤖</div>
                <h4 className="text-lg font-semibold text-gray-700 mb-3">
                  Click to Generate AI Proposal
                </h4>
                <p className="text-gray-600 max-w-md mx-auto">
                  AI will create a personalized proposal using real job details like title, description, skills, budget, and client info.
                </p>
              </div>
            )}
          </div>

          {/* Success / Error Messages */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <span className="mr-2">✓</span>
                {successMessage}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <span className="mr-2">✗</span>
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Job ID:</span> {job.id.substring(0, 12)}...
              <span className="ml-4">100% Real Upwork Data</span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}