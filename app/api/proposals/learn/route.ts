// app/api/proposals/learn/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { jobCategory, originalProposal, editedProposal, improvements } = await request.json()

    // Analyze the edits to learn patterns
    const learnedPatterns = analyzeImprovements(originalProposal, editedProposal)
    
    // Save to training database
    await pool.query(
      `INSERT INTO ai_training_data 
       (user_id, job_category, original_proposal, edited_proposal, improvements, learned_patterns) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, jobCategory, originalProposal, editedProposal, improvements || [], learnedPatterns]
    )

    return NextResponse.json({ 
      success: true,
      message: 'AI training data saved successfully',
      patterns: learnedPatterns
    })

  } catch (error: any) {
    console.error('Training error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to save training data: ' + error.message 
    }, { status: 500 })
  }
}

function analyzeImprovements(original: string, edited: string): any {
  const patterns: any = {
    addedSections: [],
    removedSections: [],
    toneChanges: {},
    structureChanges: {},
    lengthChange: 0
  }

  // Calculate length change
  patterns.lengthChange = edited.length - original.length

  // Check for common improvements
  const originalLower = original.toLowerCase()
  const editedLower = edited.toLowerCase()

  // Check if portfolio links were added
  if ((editedLower.includes('portfolio') || editedLower.includes('github') || editedLower.includes('linkedin')) && 
      !originalLower.includes('portfolio') && !originalLower.includes('github') && !originalLower.includes('linkedin')) {
    patterns.addedSections.push('portfolio_links')
  }

  // Check if call-to-action was added
  const ctaKeywords = ['contact', 'call', 'meeting', 'schedule', 'discuss', 'available']
  if (ctaKeywords.some(keyword => editedLower.includes(keyword) && !originalLower.includes(keyword))) {
    patterns.addedSections.push('call_to_action')
  }

  // Check if specific experience was added
  if (editedLower.includes('experience') && !originalLower.includes('experience')) {
    patterns.addedSections.push('experience_details')
  }

  // Check tone changes
  const enthusiasticWords = ['excited', 'enthusiastic', 'passionate', 'thrilled']
  const professionalWords = ['professional', 'expertise', 'qualified', 'certified']
  
  patterns.toneChanges.addedEnthusiasm = enthusiasticWords.some(word => 
    editedLower.includes(word) && !originalLower.includes(word)
  )
  
  patterns.toneChanges.addedProfessionalism = professionalWords.some(word => 
    editedLower.includes(word) && !originalLower.includes(word)
  )

  return patterns
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's training data to improve future proposals
    const result = await pool.query(
      `SELECT job_category, learned_patterns 
       FROM ai_training_data 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [user.id]
    )

    // Analyze patterns to create better proposals
    const userPatterns = analyzeUserPatterns(result.rows)
    
    return NextResponse.json({
      success: true,
      patterns: userPatterns,
      totalSamples: result.rows.length
    })

  } catch (error: any) {
    console.error('Get patterns error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get training patterns: ' + error.message 
    }, { status: 500 })
  }
}

function analyzeUserPatterns(trainingData: any[]) {
  const patterns: any = {
    preferredSections: [],
    commonImprovements: [],
    averageLength: 0,
    tonePreferences: {}
  }

  // Aggregate patterns from all training data
  trainingData.forEach(data => {
    const learned = data.learned_patterns || {}
    
    if (learned.addedSections) {
      patterns.preferredSections.push(...learned.addedSections)
    }
    
    if (learned.toneChanges) {
      if (learned.toneChanges.addedEnthusiasm) {
        patterns.tonePreferences.enthusiasm = (patterns.tonePreferences.enthusiasm || 0) + 1
      }
      if (learned.toneChanges.addedProfessionalism) {
        patterns.tonePreferences.professionalism = (patterns.tonePreferences.professionalism || 0) + 1
      }
    }
  })

  // Calculate frequencies
  patterns.preferredSections = patterns.preferredSections.reduce((acc: any, section: string) => {
    acc[section] = (acc[section] || 0) + 1
    return acc
  }, {})

  // Sort by frequency
  patterns.commonImprovements = Object.entries(patterns.preferredSections)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5)
    .map(([section, count]) => ({ section, count }))

  return patterns
}