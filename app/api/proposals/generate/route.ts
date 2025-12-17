// app/api/proposals/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Tumhari paid key yahan se use ho rahi hai
})

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
      budget,
      skills,
      category,
      postedDate,
    } = await request.json()

    if (!jobId || !jobTitle || !jobDescription) {
      return NextResponse.json({ error: 'Missing job details' }, { status: 400 })
    }

    console.log('Generating REAL AI proposal for job:', jobId)

    // Step 1: Load user's saved prompts from database
    const settingsResult = await pool.query(
      'SELECT basic_info, proposal_templates, ai_settings FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )

    const defaultBasicInfo = {
      name: user.name || 'Professional Freelancer',
      specialty: 'Full Stack Web Development',
      provisions: 'High-quality web applications, APIs, and databases',
      hourlyRate: '$30-60',
      company: user.company_name || '',
    }

    const defaultAISettings = {
      model: 'gpt-4-turbo',
      temperature: 0.4,
      maxTokens: 800,
    }

    let basicInfo = defaultBasicInfo
    let aiSettings = defaultAISettings
    let mainTemplate = `Write a highly personalized, professional Upwork proposal that:
- Directly addresses the client's specific needs
- Highlights 2-3 most relevant experiences
- Shows deep understanding of the project
- Ends with a clear call-to-action
- Uses friendly but professional tone
Keep it under 300 words.`

    if (settingsResult.rows.length > 0) {
      const db = settingsResult.rows[0]
      basicInfo = { ...defaultBasicInfo, ...(db.basic_info || {}) }
      aiSettings = { ...defaultAISettings, ...(db.ai_settings || {}) }
      if (db.proposal_templates && db.proposal_templates.length > 0) {
        mainTemplate = db.proposal_templates[0].content // First template as main
      }
    }

    // Step 2: Build SMART, TARGETED prompt for OpenAI
    const systemPrompt = `You are a top-rated Upwork freelancer with 100% job success score. 
You write winning proposals that get interviews. 
You NEVER use generic templates. 
You always personalize based on the exact job description.`

    const userPrompt = `
${mainTemplate}

--- JOB DETAILS ---
Title: ${jobTitle}
Category: ${category || 'Not specified'}
Budget: ${budget}
Posted: ${postedDate}
Skills Required: ${Array.isArray(skills) ? skills.join(', ') : 'Various'}

Job Description:
${jobDescription}

--- MY PROFILE ---
Name: ${basicInfo.name}
Specialty: ${basicInfo.specialty}
Services: ${basicInfo.provisions}
Rate: ${basicInfo.hourlyRate}
${basicInfo.company ? `Company: ${basicInfo.company}` : ''}

Write the proposal now.
`

    // Step 3: Call REAL OpenAI (no fallback)
    const completion = await openai.chat.completions.create({
      model: aiSettings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: aiSettings.temperature,
      max_tokens: aiSettings.maxTokens,
    })

    const proposal = completion.choices[0]?.message?.content?.trim()

    if (!proposal) {
      return NextResponse.json({
        success: false,
        error: 'AI returned empty response. Try again.',
      }, { status: 500 })
    }

    // Step 4: Save draft to history (for future training & user access)
    try {
      await pool.query(
        `INSERT INTO proposals (
          user_id, job_id, job_title, job_description, budget, skills,
          generated_proposal, ai_model, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated', NOW())`,
        [
          user.id,
          jobId,
          jobTitle,
          jobDescription,
          budget,
          skills || [],
          proposal,
          aiSettings.model,
        ]
      )
    } catch (dbErr) {
      console.warn('Could not save proposal draft to DB:', dbErr)
      // Not critical — proposal already generated
    }

    console.log('REAL AI Proposal generated successfully')

    return NextResponse.json({
      success: true,
      proposal,
      details: {
        model: aiSettings.model,
        length: proposal.length,
        source: 'Real OpenAI API',
        tailored: true,
      },
    })
  } catch (error: any) {
    console.error('Proposal generation failed:', error)

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({
        success: false,
        error: `OpenAI Error: ${error.message}. Check your API key or balance.`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate proposal. Please try again.',
    }, { status: 500 })
  }
}