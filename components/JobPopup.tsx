//components/JobPopup/JobPopup.tsx


'use client'

import { useState, useEffect } from 'react'
// import { XMarkIcon } from '@heroicons/react/24/outline'

interface JobPopupProps {
  job: any
  isOpen: boolean
  onClose: () => void
  onProposalGenerated: (proposal: string) => void
}

export default function JobPopup({ job, isOpen, onClose, onProposalGenerated }: JobPopupProps) {
  const [proposal, setProposal] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [originalProposal, setOriginalProposal] = useState('')
  const [showSuccess, setShowSuccess] = useState('')

  if (!isOpen || !job) return null

  const generateProposal = async () => {
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
      
      if (data.success) {
        setProposal(data.proposal)
        setOriginalProposal(data.proposal)
        setEditMode(false)
        onProposalGenerated(data.proposal)
      } else {
        alert('Failed to generate proposal: ' + data.error)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const saveProposal = async () => {
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
          proposalText: proposal,
          status: 'saved'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setShowSuccess('✅ Proposal saved to history!')
        setTimeout(() => setShowSuccess(''), 3000)
      } else {
        alert('Failed to save: ' + data.error)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const sendProposal = async () => {
    if (!confirm('Send this proposal to Upwork?')) return
    
    setSending(true)
    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: proposal,
          originalProposal: originalProposal,
          editReason: editMode ? 'User edited' : 'AI generated'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setShowSuccess('✅ Proposal sent to Upwork and saved!')
        setTimeout(() => {
          setShowSuccess('')
          onClose()
        }, 3000)
      } else {
        alert('Failed to send: ' + data.error)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setSending(false)
    }
  }

  const enableEdit = () => {
    setEditMode(true)
  }

  const cancelEdit = () => {
    setProposal(originalProposal)
    setEditMode(false)
  }

  const saveEdit = () => {
    setOriginalProposal(proposal)
    setEditMode(false)
    setShowSuccess('✅ Changes saved!')
    setTimeout(() => setShowSuccess(''), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      {/* Popup */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {job.budget}
                </span>
                <span className="text-sm text-gray-600">
                  {job.client?.name} • {job.postedDate}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-500"
            >
              {/* <XMarkIcon className="h-6 w-6" /> */}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Success Message */}
            {showSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg">
                {showSuccess}
              </div>
            )}

            {/* Job Details */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
              </div>
            </div>

            {/* Job Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Client</div>
                <div className="font-medium">{job.client?.name}</div>
                <div className="text-sm text-gray-500">
                  Rating: {job.client?.rating} ⭐ • {job.client?.country}
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Skills Required</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {job.skills?.slice(0, 5).map((skill: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Proposal Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Proposal</h3>
                {proposal && !editMode && (
                  <button
                    onClick={enableEdit}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    ✏️ Edit Proposal
                  </button>
                )}
              </div>

              {proposal ? (
                <div>
                  <textarea
                    value={proposal}
                    onChange={(e) => setProposal(e.target.value)}
                    rows={12}
                    readOnly={!editMode}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      editMode 
                        ? 'border-blue-300 bg-white' 
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  />
                  
                  {editMode && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 text-4xl mb-3">📝</div>
                  <p className="text-gray-600">No proposal generated yet</p>
                  <button
                    onClick={generateProposal}
                    disabled={generating}
                    className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Generate Professional Proposal'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            {showSuccess ? (
              <div className="text-center text-green-600 font-medium">
                {showSuccess}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={saveProposal}
                  disabled={!proposal || saving}
                  className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : '💾 Save to History'}
                </button>
                
                <button
                  onClick={sendProposal}
                  disabled={!proposal || sending}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : '🚀 Send to Upwork'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}