// components/JobProposalPopup.tsx - 100% REAL DATA VERSION
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

  // ✅ REAL DATA VERIFICATION - NO MOCK CHECKING
  useEffect(() => {
    console.log('🔍 Job Data Analysis:', {
      id: job.id,
      title: job.title.substring(0, 50),
      descriptionLength: job.description?.length || 0,
      budget: job.budget,
      skills: job.skills?.length || 0,
      clientName: job.client.name,
      clientRating: job.client.rating,
      source: job.source || 'unknown'
    })
  }, [job])

  // ✅ ENHANCED REAL AI Proposal Generation
  const generateProposal = async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    
    try {
      console.log('🤖 Generating PRO Proposal for:', job.title)
      
      // Load user's REAL profile from database
      const profileResponse = await fetch('/api/prompts')
      const profileData = await profileResponse.json()
      
      let userProfile = {
        specialty: 'Professional Services',
        provisions: 'Various Services',
        hourlyRate: 'Negotiable',
        name: user.name,
        company: user.company_name || ''
      }
      
      if (profileData.success && profileData.settings?.basicInfo) {
        userProfile = {
          ...userProfile,
          ...profileData.settings.basicInfo
        }
      }
      
      // Prepare COMPLETE job data for AI
      const jobData = {
        jobId: job.id,
        jobTitle: job.title,
        jobDescription: job.description,
        budget: job.budget,
        skills: job.skills,
        category: job.category,
        duration: job.duration,
        postedDate: job.postedDate,
        proposalsCount: job.proposals,
        // ✅ REAL CLIENT DATA (if available, otherwise neutral)
        clientInfo: {
          name: job.client.name === 'Upwork Client' ? 'the client' : job.client.name,
          rating: job.client.rating > 0 ? job.client.rating : null,
          country: job.client.country !== 'Not specified' ? job.client.country : null
        },
        // ✅ USER'S REAL PROFILE
        userProfile: userProfile
      }
      
      console.log('📤 Sending to AI:', {
        jobTitle: jobData.jobTitle.substring(0, 30),
        descriptionLength: jobData.jobDescription.length,
        skills: jobData.skills.length,
        userSpecialty: userProfile.specialty
      })
      
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log('✅ AI Response:', {
          proposalLength: data.proposal?.length,
          model: data.details?.model,
          tailored: data.details?.tailored
        })
        
        // Verify proposal quality
        const proposalText = data.proposal || ''
        const qualityChecks = {
          mentionsJobTitle: proposalText.toLowerCase().includes(job.title.toLowerCase().substring(0, 20)),
          mentionsSkills: job.skills.some(skill => 
            proposalText.toLowerCase().includes(skill.toLowerCase())
          ),
          hasCallToAction: proposalText.includes('call') || 
                          proposalText.includes('discuss') || 
                          proposalText.includes('schedule'),
          properLength: proposalText.length >= 200 && proposalText.length <= 800
        }
        
        console.log('📊 Proposal Quality:', qualityChecks)
        
        if (qualityChecks.mentionsJobTitle && qualityChecks.properLength) {
          setProposal(proposalText)
          setEditedProposal(proposalText)
          setSuccessMessage('✅ Tailored proposal generated successfully!')
          
          if (onProposalGenerated) {
            onProposalGenerated(proposalText)
          }
        } else {
          throw new Error('AI generated a generic proposal. Please try again.')
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

  // ✅ Save Proposal with REAL data
  const saveProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    setSaving(true)
    setErrorMessage('')
    
    try {
      console.log('💾 Saving proposal...')
      
      const saveData = {
        jobId: job.id,
        jobTitle: job.title,
        jobDescription: job.description,
        budget: job.budget,
        skills: job.skills,
        proposalText: editedProposal,
        status: 'saved',
        // Metadata for tracking
        metadata: {
          generatedAt: new Date().toISOString(),
          jobSource: job.source || 'upwork',
          jobCategory: job.category,
          userProfile: user.name
        }
      }
      
      const response = await fetch('/api/proposals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessMessage('✅ Proposal saved to history!')
        
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 1500)
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

  // ✅ Send to Upwork
  const sendProposal = async () => {
    if (!editedProposal.trim()) {
      alert('Proposal cannot be empty')
      return
    }

    if (!confirm('Send this proposal to Upwork?')) return

    setSending(true)
    setErrorMessage('')
    
    try {
      console.log('📤 Sending proposal...')
      
      const response = await fetch('/api/proposals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          proposalText: editedProposal,
          originalProposal: proposal,
          editReason: isEditing ? 'User edited' : 'AI generated'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const message = data.upworkSent 
          ? '✅ Proposal sent to Upwork!' 
          : '✅ Proposal saved locally (Upwork not connected)'
        
        setSuccessMessage(message)
        
        setTimeout(() => {
          window.location.href = '/dashboard/history'
        }, 1500)
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
            <h2 className="text-xl font-bold text-gray-900">Generate Proposal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {job.title.substring(0, 60)}...
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
          {/* Job Preview */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{job.title}</h3>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                    {job.budget}
                  </span>
                  <span className="text-sm text-gray-600">
                    {job.category} • {job.postedDate}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-gray-700">
                {job.description.substring(0, 300)}
                {job.description.length > 300 && '...'}
              </p>
            </div>
            
            {job.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {job.skills.slice(0, 5).map((skill, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {skill}
                  </span>
                ))}
                {job.skills.length > 5 && (
                  <span className="text-xs text-gray-500 px-2 py-1">
                    +{job.skills.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Proposal Generator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {proposal ? 'AI Generated Proposal' : 'Create Custom Proposal'}
              </h3>
              {!proposal && (
                <button
                  onClick={generateProposal}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    '🤖 Generate with AI'
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
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Edit your proposal..."
                  />
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-700 whitespace-pre-wrap">{editedProposal}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={saveProposal}
                    disabled={saving || sending}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      '💾 Save to History'
                    )}
                  </button>
                  
                  <button
                    onClick={sendProposal}
                    disabled={saving || sending}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1 min-w-[140px]"
                  >
                    {sending ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      '📤 Send to Upwork'
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(editedProposal)
                      alert('Copied to clipboard!')
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
                  AI-Powered Proposal Generator
                </h4>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Our AI will analyze this job and create a professional proposal 
                  using your profile information and the job requirements.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto mb-6">
                  <div className="bg-white p-4 rounded-lg border text-left">
                    <div className="font-medium text-gray-900 mb-2">What AI will use:</div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Job title & description</li>
                      <li>• Required skills: {job.skills.slice(0, 3).join(', ')}</li>
                      <li>• Your profile from Settings</li>
                      <li>• Professional templates</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border text-left">
                    <div className="font-medium text-gray-900 mb-2">Proposal will include:</div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Personalized greeting</li>
                      <li>• Relevant experience examples</li>
                      <li>• Specific questions about project</li>
                      <li>• Clear call-to-action</li>
                    </ul>
                  </div>
                </div>
                
                <button
                  onClick={generateProposal}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-lg font-semibold"
                >
                  {loading ? 'Generating...' : '🚀 Generate Proposal Now'}
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {successMessage}
              </div>
            </div>
          )}
          
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <span>Job ID: {job.id.substring(0, 8)}...</span>
              <span className="ml-4">👤 {user.name}</span>
            </div>
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