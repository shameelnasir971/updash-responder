//components/JobPopup.tsx


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
}

interface JobPopupProps {
  job: Job | null
  onClose: () => void
  onSave: (proposal: string, jobId: string) => void
  onSend: (proposal: string, jobId: string) => void
}

export default function JobPopup({ job, onClose, onSave, onSend }: JobPopupProps) {
  const [proposal, setProposal] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [originalProposal, setOriginalProposal] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  // ✅ Reset when job changes
  useEffect(() => {
    if (job) {
      setProposal('')
      setOriginalProposal('')
      setEditing(false)
      setShowEdit(false)
    }
  }, [job])

  // ✅ GENERATE PROPOSAL USING USER'S PROMPT SETTINGS
  const handleGenerateProposal = async () => {
    if (!job) return
    
    setGenerating(true)
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
      if (response.ok && data.proposal) {
        setProposal(data.proposal)
        setOriginalProposal(data.proposal)
        setShowEdit(true)
        alert('✅ Proposal generated successfully!')
      } else {
        alert('❌ Failed to generate: ' + (data.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  // ✅ SAVE PROPOSAL TO HISTORY
  const handleSaveProposal = async () => {
    if (!job || !proposal.trim()) {
      alert('Please generate a proposal first')
      return
    }
    
    setSaving(true)
    try {
      await onSave(proposal, job.id)
      alert('✅ Proposal saved to history!')
      setSaving(false)
    } catch (error: any) {
      alert('❌ Failed to save: ' + error.message)
      setSaving(false)
    }
  }

  // ✅ SEND PROPOSAL TO UPWORK
  const handleSendProposal = async () => {
    if (!job || !proposal.trim()) {
      alert('Please generate a proposal first')
      return
    }
    
    if (!confirm('Send this proposal to Upwork?')) {
      return
    }
    
    setSending(true)
    try {
      await onSend(proposal, job.id)
      alert('✅ Proposal sent to Upwork!')
      setSending(false)
    } catch (error: any) {
      alert('❌ Failed to send: ' + error.message)
      setSending(false)
    }
  }

  if (!job) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{job.title}</h2>
              <div className="flex items-center space-x-4 text-sm">
                <span>📅 {job.postedDate}</span>
                <span>⭐ {job.client.rating} Rating</span>
                <span>📍 {job.client.country}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl ml-4"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Job Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">💰 Budget</h4>
              <p className="text-blue-700 font-bold text-lg">{job.budget}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <h4 className="text-sm font-semibold text-green-900 mb-1">👤 Client</h4>
              <p className="text-green-700 font-bold">{job.client.name}</p>
              <p className="text-green-600 text-sm">Spent: ${job.client.totalSpent}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <h4 className="text-sm font-semibold text-purple-900 mb-1">📊 Proposals</h4>
              <p className="text-purple-700 font-bold">{job.proposals} proposals</p>
              <p className="text-purple-600 text-sm">{job.verified ? '✅ Verified' : '⚠️ Not Verified'}</p>
            </div>
          </div>

          {/* Skills */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">🛠️ Skills Required</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">📄 Job Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Proposal Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">📝 Proposal</h3>
              
              {!showEdit ? (
                <button
                  onClick={handleGenerateProposal}
                  disabled={generating}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold flex items-center"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    '✨ Generate Proposal'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setEditing(!editing)}
                  className={`px-4 py-2 rounded-lg font-semibold ${editing ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'} hover:opacity-90`}
                >
                  {editing ? '💾 Done Editing' : '✏️ Edit Proposal'}
                </button>
              )}
            </div>

            {/* Proposal Textarea */}
            {showEdit && (
              <div className="space-y-4">
                <textarea
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  rows={12}
                  disabled={!editing}
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${editing ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
                  placeholder="Your proposal will appear here..."
                />
                
                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleSaveProposal}
                    disabled={saving || !proposal.trim()}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      '💾 Save to History'
                    )}
                  </button>
                  
                  <button
                    onClick={handleSendProposal}
                    disabled={sending || !proposal.trim()}
                    className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold flex items-center"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      '🚀 Send to Upwork'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t p-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Proposal will be generated using your prompt settings
            </p>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}