//components/JobPopup/JobPopup.tsx
'use client'

import { useState } from 'react'

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
}

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface JobPopupProps {
  job: Job
  user: User | null
  onClose: () => void
  onSaveSuccess: () => void
}

export default function JobPopup({ job, user, onClose, onSaveSuccess }: JobPopupProps) {
  const [proposal, setProposal] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const generateProposal = async () => {
    if (!user) {
      setError('Please login first')
      return
    }

    setGenerating(true)
    setError('')
    setSuccess('')

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
        setGenerated(true)
        setSuccess('✅ Proposal generated successfully!')
      } else {
        setError(data.error || 'Failed to generate proposal')
      }
    } catch (error: any) {
      setError('Network error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const saveProposal = async () => {
    if (!proposal.trim()) {
      setError('Proposal cannot be empty')
      return
    }

    setSaving(true)
    setError('')

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
          proposalText: proposal,
          status: 'saved'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess('✅ Proposal saved to history!')
        setGenerated(false)
        setEditing(false)
        onSaveSuccess()
      } else {
        setError(data.error || 'Failed to save proposal')
      }
    } catch (error: any) {
      setError('Network error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const sendProposal = async () => {
    if (!proposal.trim()) {
      setError('Proposal cannot be empty')
      return
    }

    setSending(true)
    setError('')

    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: proposal,
          originalProposal: proposal
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(data.message || '✅ Proposal sent successfully!')
        setGenerated(false)
        setEditing(false)
        onSaveSuccess()
      } else {
        setError(data.error || 'Failed to send proposal')
      }
    } catch (error: any) {
      setError('Network error: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h2>
            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                {job.budget}
              </span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                ⭐ {job.client.rating}
              </span>
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                👤 {job.client.name}
              </span>
              <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
                📅 {job.postedDate}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Job Details */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Client Info */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">Total Spent</div>
                <div className="font-semibold text-green-700">${job.client.totalSpent}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">Total Hires</div>
                <div className="font-semibold text-blue-700">{job.client.totalHires}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">Country</div>
                <div className="font-semibold text-purple-700">{job.client.country}</div>
              </div>
            </div>
          </div>

          {/* Proposal Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Proposal</h3>
              {generated && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  ✏️ Edit Proposal
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {proposal ? (
              <div>
                <textarea
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  readOnly={!editing}
                  rows={8}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editing ? 'border-blue-300 bg-white' : 'border-gray-300 bg-gray-50'
                  }`}
                />
                <div className="mt-4 flex gap-3">
                  {!generated ? (
                    <button
                      onClick={generateProposal}
                      disabled={generating}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                    >
                      {generating ? (
                        <span className="flex items-center">
                          <svg className="animate-spin h-4 w-4 mr-2 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </span>
                      ) : (
                        '🤖 Generate Proposal'
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={saveProposal}
                        disabled={saving}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                      >
                        {saving ? 'Saving...' : '💾 Save to History'}
                      </button>
                      <button
                        onClick={sendProposal}
                        disabled={sending}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                      >
                        {sending ? 'Sending...' : '📤 Send to Upwork'}
                      </button>
                      {editing && (
                        <button
                          onClick={() => setEditing(false)}
                          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-5xl mb-4">🤖</div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Generate Proposal</h4>
                <p className="text-gray-600 mb-6">
                  AI will create a professional proposal based on this job and your profile
                </p>
                <button
                  onClick={generateProposal}
                  disabled={generating}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-lg"
                >
                  {generating ? 'Generating...' : 'Generate Proposal with AI'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}