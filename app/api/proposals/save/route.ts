// app/api/proposals/save/route.ts - FINAL & PERFECT VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    const {
      jobId,
      jobTitle,
      jobDescription,
      clientInfo,
      budget,
      skills,
      proposalText,        // Yeh final text hai jo user ne edit kiya ya generate kiya
      generatedProposal,   // Optional: agar generate karte waqt bheja jaye
      status = 'saved'     // saved, sent, draft etc.
    } = await request.json()

    if (!proposalText || !jobId) {
      return NextResponse.json({ 
        error: 'Proposal text and Job ID are required' 
      }, { status: 400 })
    }

    console.log('💾 Saving proposal for job:', jobTitle)
    console.log('🎯 Job ID:', jobId)
    console.log('📝 Status:', status)

    // Check if proposal already exists for this user + job
    const existingResult = await pool.query(
      `SELECT id, generated_proposal FROM proposals 
       WHERE user_id = $1 AND job_id = $2`,
      [user.id, jobId]
    )

    let isNew = false
    let proposalId: number

    if (existingResult.rows.length > 0) {
      // UPDATE existing proposal
      const existing = existingResult.rows[0]
      proposalId = existing.id

      await pool.query(
        `UPDATE proposals SET
          job_title = $1,
          job_description = $2,
          client_info = $3,
          budget = $4,
          skills = $5,
          generated_proposal = COALESCE($6, generated_proposal),  -- Only update if provided
          edited_proposal = $7,                                  -- Always update with latest edited text
          status = $8,
          updated_at = NOW()
         WHERE id = $9 AND user_id = $10`,
        [
          jobTitle || null,
          jobDescription || null,
          clientInfo || {},
          budget || 'Not specified',
          skills || [],
          generatedProposal || existing.generated_proposal,  // Keep old if not provided
          proposalText,                                      // This is the final edited version
          status,
          proposalId,
          user.id
        ]
      )

      console.log('✅ Proposal UPDATED successfully (ID:', proposalId, ')')
    } else {
      // INSERT new proposal
      isNew = true
      const insertResult = await pool.query(
        `INSERT INTO proposals 
         (user_id, job_id, job_title, job_description, client_info, budget, skills,
          generated_proposal, edited_proposal, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          user.id,
          jobId,
          jobTitle || 'Untitled Job',
          jobDescription || '',
          clientInfo || {},
          budget || 'Not specified',
          skills || [],
          generatedProposal || proposalText,  // If generated not provided, use final text
          proposalText,                       // Final edited version
          status
        ]
      )

      proposalId = insertResult.rows[0].id
      console.log('✅ New proposal SAVED successfully (ID:', proposalId, ')')
    }

    return NextResponse.json({
      success: true,
      message: isNew 
        ? '✅ Proposal saved to history!' 
        : '✅ Proposal updated with your changes!',
      proposalId,
      isNew,
      status
    })

  } catch (error: unknown) {
    console.error('❌ Save proposal error:', error)

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown database error'

    return NextResponse.json({
      success: false,
      error: 'Failed to save proposal: ' + errorMessage
    }, { status: 500 })
  }
}