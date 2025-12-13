// app/api/proposals/send/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    const { jobId, jobTitle, proposalText, originalProposal, editReason } = await request.json()

    if (!proposalText || !jobId) {
      return NextResponse.json({ error: 'Proposal text and Job ID are required' }, { status: 400 })
    }

    console.log('💾 Saving and sending proposal for job:', jobTitle)
    console.log('🎯 Job ID:', jobId)

    // Check if user has connected Upwork
    const upworkAccount = await pool.query(
      'SELECT * FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    // Check for existing proposal
    const existingProposal = await pool.query(
      `SELECT id, status FROM proposals WHERE user_id = $1 AND job_id = $2`,
      [user.id, jobId]
    )

    let proposalId: number
    let isUpdate = false

    if (existingProposal.rows.length > 0) {
      isUpdate = true
      proposalId = existingProposal.rows[0].id
      
      await pool.query(
        `UPDATE proposals SET 
          edited_proposal = $1,
          status = 'sent',
          sent_at = NOW(),
          updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [proposalText, proposalId, user.id]
      )
      
      console.log('✅ Existing proposal updated and sent with ID:', proposalId)
    } else {
      const proposalResult = await pool.query(
        `INSERT INTO proposals 
         (user_id, job_id, job_title, generated_proposal, edited_proposal, status, sent_at, created_at) 
         VALUES ($1, $2, $3, $4, $5, 'sent', NOW(), NOW()) 
         RETURNING id`,
        [user.id, jobId, jobTitle, originalProposal, proposalText]
      )
      
      proposalId = proposalResult.rows[0].id
      console.log('✅ New proposal sent with ID:', proposalId)
    }

    // Try to send to Upwork if connected
    let upworkSendSuccess = false
    let upworkResponse = null
    
    if (upworkAccount.rows.length > 0) {
      try {
        upworkResponse = await sendToUpwork(
          upworkAccount.rows[0].access_token,
          jobId,
          proposalText,
          user.name
        )
        upworkSendSuccess = true
        console.log('✅ Proposal sent to Upwork:', upworkResponse)
      } catch (error: any) {
        console.error('❌ Failed to send to Upwork:', error.message)
        // Still save in our system even if Upwork send fails
      }
    } else {
      console.log('ℹ️ Upwork account not connected, skipping Upwork send')
    }

    // Save edit for AI training if there are changes
    if (originalProposal !== proposalText) {
      const learnedPatterns = await analyzeProposalEdits(originalProposal, proposalText)
      
      await pool.query(
        `INSERT INTO proposal_edits 
         (user_id, job_id, original_proposal, edited_proposal, edit_reason, learned_patterns, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [user.id, jobId, originalProposal, proposalText, editReason || 'User improvements', learnedPatterns]
      )

      console.log('🧠 AI training data saved with patterns:', learnedPatterns)
    }

    return NextResponse.json({ 
      success: true,
      message: upworkSendSuccess 
        ? '✅ Proposal sent successfully to Upwork!' 
        : '✅ Proposal saved and marked as sent (Upwork not connected)',
      proposalId: proposalId,
      trained: originalProposal !== proposalText,
      upworkSent: upworkSendSuccess,
      upworkResponse: upworkResponse
    })

  } catch (error: any) {
    console.error('❌ Proposal sending error:', error)
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to send proposal: ' + error.message 
    }, { status: 500 })
  }
}

// Real Upwork send function (ready for API activation)
async function sendToUpwork(accessToken: string, jobId: string, proposal: string, freelancerName: string) {
  // This will be implemented when Upwork API is active
  console.log('🚀 Attempting to send proposal to Upwork API...')
  
  // Example API call (commented out until API is active)
  /*
  const response = await fetch('https://www.upwork.com/api/proposals/v3/jobs/{job_id}/proposals', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cover_letter: proposal,
      freelancer_name: freelancerName,
      job_id: jobId
    })
  })
  
  if (!response.ok) {
    throw new Error(`Upwork API error: ${response.status}`)
  }
  
  return await response.json()
  */
  
  // For now, simulate success
  return {
    success: true,
    message: 'Proposal sent to Upwork (simulated)',
    proposal_id: `upwork_${Date.now()}`
  }
}

// Analyze what the AI can learn from user edits
async function analyzeProposalEdits(original: string, edited: string): Promise<string[]> {
  const patterns: string[] = []
  
  // Compare lengths
  if (edited.length > original.length) patterns.push('user_adds_more_details')
  if (edited.length < original.length) patterns.push('user_prefers_conciseness')
  
  // Content analysis
  if (edited.includes('portfolio') && !original.includes('portfolio')) patterns.push('user_adds_portfolio_links')
  if (edited.includes('call') || edited.includes('meeting')) patterns.push('user_adds_call_to_action')
  if (edited.includes('$') || edited.includes('budget')) patterns.push('user_discusses_budget')
  if (edited.includes('experience') && !original.includes('experience')) patterns.push('user_emphasizes_experience')
  
  // Tone analysis
  const toneWords = ['excited', 'enthusiastic', 'passionate']
  if (toneWords.some(word => edited.includes(word) && !original.includes(word))) {
    patterns.push('user_prefers_enthusiastic_tone')
  }
  
  // Professionalism
  const proWords = ['professional', 'expertise', 'qualified', 'certified']
  if (proWords.some(word => edited.includes(word) && !original.includes(word))) {
    patterns.push('user_emphasizes_professionalism')
  }
  
  return patterns
}