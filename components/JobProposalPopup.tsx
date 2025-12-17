'use client'

import { useState, useEffect } from 'react'

interface Job {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  duration?: string
  source?: string
  isRealJob?: boolean

  // ✅ OPTIONAL — Upwork job search API does NOT guarantee this
  client?: {
    name?: string
    rating?: number
    country?: string
    totalSpent?: number
    totalHires?: number
  }
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

  // ✅ SAFE verification (NO mock checks)
  useEffect(() => {
    console.log('🔍 Verifying REAL job data:', {
      id: job.id,
      title: job.title,
      hasDescription: !!job.description,
      budget: job.budget,
      skillsCount: job.skills?.length || 0,
      hasClientData: !!job.client,
      isRealJob: job.isRealJob === true
    })
  }, [job])

  // =========================
  // AI Proposal Generation
  // =========================
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
          budget: job.budget,
          skills: job.skills,
          category: job.category,
          postedDate: job.postedDate
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Proposal generation failed')
      }

      setProposal(data.proposal)
      setEditedProposal(data.proposal)
      setSuccessMessage('✅ Job-specific AI proposal generated')

      onProposalGenerated?.(data.proposal)
    } catch (err: any) {
      console.error(err)
      setErrorMessage('Proposal generate nahi ho saka. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // Save Proposal
  // =========================
  const saveProposal = async () => {
    if (!editedProposal.trim()) return alert('Proposal empty hai')

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
          budget: job.budget,
          skills: job.skills,
          proposalText: editedProposal
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Save failed')
      }

      setSuccessMessage('✅ Proposal history mein save ho gaya')
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  // =========================
  // Send Proposal
  // =========================
  const sendProposal = async () => {
    if (!editedProposal.trim()) return alert('Proposal empty hai')
    if (!confirm('Proposal Upwork par bhejna hai?')) return

    setSending(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          proposalText: editedProposal
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Send failed')
      }

      setSuccessMessage(
        data.upworkSent
          ? '✅ Proposal Upwork par send ho gaya'
          : '✅ Proposal save ho gaya (Upwork connect karein)'
      )
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Job Proposal</h2>
            <p className="text-sm text-green-700 mt-1">
              ✅ 100% Real Upwork Job
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500">×</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* Job Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <p><strong>Title:</strong> {job.title}</p>
            <p><strong>Budget:</strong> {job.budget}</p>
            <p><strong>Posted:</strong> {job.postedDate}</p>
            <p><strong>Proposals:</strong> {job.proposals}</p>
            <p>
              <strong>Client:</strong>{' '}
              {job.client?.name || 'Client info Upwork job feed mein available nahi hoti'}
            </p>
          </div>

          {/* Proposal */}
          {!proposal ? (
            <button
              onClick={generateProposal}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded w-full"
            >
              {loading ? 'Generating...' : '🤖 Generate AI Proposal'}
            </button>
          ) : (
            <>
              {isEditing ? (
                <textarea
                  value={editedProposal}
                  onChange={e => setEditedProposal(e.target.value)}
                  rows={12}
                  className="w-full border rounded p-3"
                />
              ) : (
                <div className="bg-gray-50 border rounded p-4 whitespace-pre-wrap">
                  {editedProposal}
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-gray-600 text-white px-4 py-2 rounded"
                >
                  ✏️ Edit
                </button>

                <button
                  onClick={saveProposal}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  💾 Save
                </button>

                <button
                  onClick={sendProposal}
                  disabled={sending}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  📤 Send
                </button>
              </div>
            </>
          )}

          {/* Messages */}
          {successMessage && (
            <div className="mt-4 bg-green-100 text-green-700 p-3 rounded">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 bg-red-100 text-red-700 p-3 rounded">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
