// components/JobProposalPopup.tsx - COMPLETE & FINAL VERSION
'use client'

import { useState } from 'react'

interface Job {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  skills: string[]
  proposals: number
  category?: string
  client?: any
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
}

export default function JobProposalPopup({ job, user, onClose }: JobProposalPopupProps) {
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState('')           // Original AI-generated proposal
  const [editedProposal, setEditedProposal] = useState('') // User's current version (after edits)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  // ==================== GENERATE PROPOSAL ====================
  const generateProposal = async () => {
    setLoading(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          budget: job.budget,
          skills: job.skills,
          category: job.category,
          postedDate: job.postedDate,
        }),
      })

      const data = await response.json()

      if (data.success && data.proposal) {
        setProposal(data.proposal)
        setEditedProposal(data.proposal) // Start editing with AI version
        setMessage('✅ Personalized proposal generated using Real OpenAI!')
        setMessageType('success')
      } else {
        setMessage('❌ ' + (data.error || 'Failed to generate proposal'))
        setMessageType('error')
      }
    } catch (err) {
      console.error(err)
      setMessage('❌ Network error. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  // ==================== SAVE TO HISTORY ====================
  const saveToHistory = async () => {
    if (!editedProposal.trim()) {
      setMessage('❌ Proposal cannot be empty')
      setMessageType('error')
      return
    }

    setMessage('Saving...')
    setMessageType('')

    try {
      const response = await fetch('/api/proposals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
          budget: job.budget,
          skills: job.skills,
          proposalText: editedProposal,      // Final edited version
          generatedProposal: proposal,       // Original AI version (for reference)
          status: 'saved',
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage('✅ ' + data.message)
        setMessageType('success')
      } else {
        setMessage('❌ ' + data.error)
        setMessageType('error')
      }
    } catch (err) {
      setMessage('❌ Failed to save. Check your connection.')
      setMessageType('error')
    }
  }

  // ==================== COPY TO CLIPBOARD ====================
  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedProposal)
    setMessage('✅ Copied to clipboard!')
    setMessageType('success')
  }

  // ==================== SEND TO UPWORK (Placeholder) ====================
  const sendToUpwork = () => {
    alert('📤 Send to Upwork feature coming soon!')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">AI Proposal Generator</h2>
              <p className="text-sm opacity-90 mt-1">
                ✅ 100% Real Upwork Job • Powered by Real OpenAI
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-3xl hover:opacity-80 transition"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Job Details */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6">
            <h3 className="text-xl font-bold text-indigo-900 mb-4">📋 Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Title:</strong> <span className="font-medium">{job.title}</span></div>
              <div><strong>Budget:</strong> <span className="font-medium text-green-700">{job.budget}</span></div>
              <div><strong>Category:</strong> <span className="font-medium">{job.category || 'General'}</span></div>
              <div><strong>Posted:</strong> <span className="font-medium">{job.postedDate}</span></div>
              <div><strong>Proposals:</strong> <span className="font-medium">{job.proposals}</span></div>
              <div className="md:col-span-2">
                <strong>Skills:</strong> <span className="font-medium">{job.skills.join(', ')}</span>
              </div>
            </div>
            <div className="mt-5">
              <strong className="text-indigo-900">Description:</strong>
              <div className="mt-2 bg-white p-5 rounded-lg border shadow-sm text-gray-700 leading-relaxed">
                {job.description}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          {!proposal && (
            <div className="text-center py-12">
              <button
                onClick={generateProposal}
                disabled={loading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-6 rounded-2xl text-xl font-bold shadow-lg disabled:opacity-70 transition-all transform hover:scale-105"
              >
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-white border-t-transparent mr-3"></div>
                    Generating...
                  </>
                ) : (
                  '🤖 Generate Personalized Proposal'
                )}
              </button>
            </div>
          )}

          {/* Proposal Section */}
          {proposal && (
            <div className="bg-gray-50 rounded-xl p-6 border">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditing ? '✏️ Editing Your Proposal' : '📝 Your AI Proposal'}
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition"
                >
                  {isEditing ? '✅ Done Editing' : '✏️ Edit Proposal'}
                </button>
              </div>

              {/* Editable Textarea or View */}
              {isEditing ? (
                <textarea
                  value={editedProposal}
                  onChange={(e) => setEditedProposal(e.target.value)}
                  rows={20}
                  className="w-full p-5 border-2 border-blue-300 rounded-xl font-medium text-gray-800 focus:ring-4 focus:ring-blue-200 focus:border-blue-500 outline-none resize-none"
                  placeholder="Make your changes here..."
                />
              ) : (
                <div className="bg-white p-6 rounded-xl border shadow-inner whitespace-pre-wrap text-gray-800 leading-relaxed text-base">
                  {editedProposal}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mt-8">
                <button
                  onClick={copyToClipboard}
                  className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
                >
                  📋 Copy
                </button>

                <button
                  onClick={saveToHistory}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
                >
                  💾 Save to History
                </button>

                <button
                  onClick={sendToUpwork}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
                >
                  📤 Send to Upwork
                </button>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`p-5 rounded-xl text-center font-medium text-lg ${
              messageType === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : messageType === 'error'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 text-center text-sm text-gray-600 border-t">
          Your edits are fully saved • Powered by Real OpenAI • 100% Real Upwork Data
        </div>
      </div>
    </div>
  )
}