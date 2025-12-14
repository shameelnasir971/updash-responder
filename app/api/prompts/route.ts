//app/api/prompts/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('📝 Loading prompts for user:', user.id)

    const result = await pool.query(
      'SELECT basic_info, validation_rules, proposal_templates, ai_settings FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )

    let settings = getDefaultSettings()
    
    if (result.rows.length > 0) {
      const dbSettings = result.rows[0]
      settings = {
        basicInfo: dbSettings.basic_info || settings.basicInfo,
        validationRules: dbSettings.validation_rules || settings.validationRules,
        proposalTemplates: dbSettings.proposal_templates || settings.proposalTemplates,
        aiSettings: dbSettings.ai_settings || settings.aiSettings
      }
    }
    
    console.log('✅ Prompts loaded successfully for user:', user.id)
    
    return NextResponse.json({ 
      success: true,
      settings 
    })
  } catch (error) {
    console.error('Prompts GET error:', error)
    return NextResponse.json({ 
      success: true,
      settings: getDefaultSettings(),
      message: 'Using default settings'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { settings } = await request.json()

    console.log('💾 Saving prompts for user:', user.id)

    // ✅ PROPER JSON handling
    const basicInfo = settings.basicInfo || getDefaultSettings().basicInfo
    const validationRules = settings.validationRules || getDefaultSettings().validationRules
    const proposalTemplates = settings.proposalTemplates || getDefaultSettings().proposalTemplates
    const aiSettings = settings.aiSettings || getDefaultSettings().aiSettings

    try {
      await pool.query(
        `INSERT INTO prompt_settings (user_id, basic_info, validation_rules, proposal_templates, ai_settings) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           basic_info = $2, 
           validation_rules = $3, 
           proposal_templates = $4, 
           ai_settings = $5,
           updated_at = CURRENT_TIMESTAMP`,
        [user.id, basicInfo, validationRules, proposalTemplates, aiSettings]
      )

      console.log('✅ Prompts saved successfully for user:', user.id)

      return NextResponse.json({ 
        success: true,
        message: 'Prompt settings saved successfully' 
      })
    } catch (dbError) {
      console.error('Database save error:', dbError)
      return NextResponse.json({ 
        success: false,
        error: 'Failed to save settings to database' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Prompts POST error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Helper function for default settings
function getDefaultSettings() {
  return {
   basicInfo: {
  feedName: 'My Upwork Feed',
  keywords: '"web development" OR "react" OR "node.js" OR "javascript" OR "full stack" OR "frontend" OR "backend"',
  specialty: 'Full Stack Web Development',
  provisions: 'React Applications, Node.js APIs, MongoDB Databases, REST APIs, Responsive Design',
  hourlyRate: '$25-50',
  location: 'Worldwide'
},
    validationRules: {
      minBudget: 100,
      maxBudget: 10000,
      jobTypes: ['Fixed', 'Hourly'],
      clientRating: 4.0,
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      validationPrompt: `Evaluate if this job matches our criteria:
- Budget between $100 and $10,000
- Client rating 4.0+
- Fixed or Hourly payment
- Requires JavaScript/React/Node.js skills
- Project scope is clear

Return: APPROVE if matches, REJECT if doesn't match.`
    },
    proposalTemplates: [
      {
        id: '1',
        title: 'Main Proposal Template',
        content: `Write a professional Upwork proposal that shows understanding of job requirements and highlights relevant skills. Focus on client pain points.`
      }
    ],
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 600,
      creativity: 'medium'
    }
  }
}