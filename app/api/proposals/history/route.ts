// app/api/proposals/history/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - Load proposal history
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('📝 Loading proposal history for user:', user.id)

    try {
      const result = await pool.query(
        `SELECT id, job_title, job_description, client_info, budget, skills, 
                generated_proposal, edited_proposal, status, sent_at, created_at
         FROM proposals 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [user.id]
      )

      console.log(`✅ Loaded ${result.rows.length} proposals for user:`, user.id)

      // Format the data properly
      const proposals = result.rows.map(proposal => ({
        ...proposal,
        client_info: proposal.client_info || {},
        budget: proposal.budget || 'Not specified',
        skills: proposal.skills || []
      }))

      return NextResponse.json({ 
        success: true,
        proposals: proposals 
      })
    } catch (tableError) {
      console.log('📋 Proposals table not found, returning empty array')
      return NextResponse.json({ 
        success: true,
        proposals: [] 
      })
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('❌ History API error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message,
      proposals: []
    }, { status: 500 })
  }
}

// PUT - Update a proposal
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { proposalId, editedProposal } = await request.json()

    if (!proposalId || !editedProposal) {
      return NextResponse.json({ error: 'Proposal ID and content are required' }, { status: 400 })
    }

    // Update proposal
    await pool.query(
      `UPDATE proposals 
       SET edited_proposal = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [editedProposal, proposalId, user.id]
    )

    return NextResponse.json({ 
      success: true,
      message: 'Proposal updated successfully' 
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Update proposal error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}

// DELETE - Delete a proposal
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { proposalId } = await request.json()

    if (!proposalId) {
      return NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 })
    }

    await pool.query(
      'DELETE FROM proposals WHERE id = $1 AND user_id = $2',
      [proposalId, user.id]
    )

    return NextResponse.json({ 
      success: true,
      message: 'Proposal deleted successfully' 
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Delete proposal error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}