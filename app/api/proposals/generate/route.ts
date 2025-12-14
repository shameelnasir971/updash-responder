// app/api/proposals/generate/route.ts 
// app/api/proposals/generate/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    const { jobId, jobTitle, jobDescription, clientInfo, budget, skills } = await request.json()

    // ✅ Validation
    if (!jobId || !jobTitle || !jobDescription) {
      return NextResponse.json({ error: 'Job ID, title, and description are required' }, { status: 400 })
    }

    console.log('🤖 [PROPOSAL REQUEST] Generating for job:', jobId)

    // ✅ Step 1: User ki Personal Details & Templates Load Karo (Prompts Page se)
    const settingsResult = await pool.query(
      'SELECT basic_info, proposal_templates, ai_settings FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )

    // Default settings agar database mein na ho
    let userBasicInfo = {
      specialty: 'Full Stack Development',
      provisions: 'Web Applications, Mobile Apps, API Development',
      hourlyRate: '$25-50',
      name: user.name || 'Freelancer',
      company: user.company_name || ''
    }
    let userAISettings = { model: 'gpt-4', temperature: 0.3, maxTokens: 600 }

    if (settingsResult.rows.length > 0) {
      const dbSettings = settingsResult.rows[0]
      userBasicInfo = { ...userBasicInfo, ...(dbSettings.basic_info || {}) }
      userAISettings = { ...userAISettings, ...(dbSettings.ai_settings || {}) }
    }

    // ✅ Step 2: SMART PROMPT Banayein (Job Details + User Profile)
    const smartPrompt = `
TASK: Write a HIGHLY TARGETED and PROFESSIONAL Upwork proposal for the specific job below.
The goal is to get an interview by showing you understand the client's EXACT needs and have the PERFECT skills.

IMPORTANT RULES:
1. NEVER use "Dear Client". Start directly with a professional greeting like "Hello," or "I read your job post with interest."
2. Address the client by their name if known (${clientInfo?.name || 'Hello'}).
3. Analyze the job description deeply. Mention 2-3 SPECIFIC requirements from it and explain how you will solve them.
4. Integrate MY PROFILE naturally. Show why MY SPECIFIC background (${userBasicInfo.specialty}, ${userBasicInfo.provisions}) makes me the ideal candidate.
5. Ask 1-2 INTELLIGENT QUESTIONS about the project that show you've thought about it.
6. Keep it CONCISE (180-220 words), professional, and friendly.
7. End with a single, clear call-to-action (e.g., "I'm available to discuss this further on a call.").
8. Sign off with ONLY ONE "Best regards," followed by my name: ${userBasicInfo.name}.

--- JOB TO APPLY FOR ---
JOB TITLE: ${jobTitle}

FULL DESCRIPTION:
${jobDescription}

BUDGET: ${budget || 'Not specified'}
REQUIRED SKILLS: ${Array.isArray(skills) ? skills.join(', ') : skills || 'Various'}
CLIENT INFO: ${clientInfo?.name || 'N/A'} (Rating: ${clientInfo?.rating || 'N/A'})

--- MY PROFILE TO USE ---
MY NAME: ${userBasicInfo.name}
MY SPECIALTY: ${userBasicInfo.specialty}
MY SERVICES: ${userBasicInfo.provisions}
MY RATE/RANGE: ${userBasicInfo.hourlyRate}
MY COMPANY: ${userBasicInfo.company || 'Freelance Professional'}

--- NOW, WRITE THE PERFECT PROPOSAL ---
`

    console.log('📝 [PROPOSAL REQUEST] Calling OpenAI with smart prompt...')

    // ✅ Step 3: OpenAI ko Call Karein (NO FALLBACK)
    const completion = await openai.chat.completions.create({
      model: userAISettings.model,
      messages: [
        {
          role: "system",
          content: "You are a top-rated Upwork freelancer who writes compelling, personalized proposals that win projects. You avoid generic phrases and focus on the client's specific problems."
        },
        { role: "user", content: smartPrompt }
      ],
      max_tokens: userAISettings.maxTokens,
      temperature: userAISettings.temperature,
    })

    let proposal = completion.choices[0]?.message?.content

    if (!proposal) {
      console.error('❌ [PROPOSAL REQUEST] OpenAI returned empty response.')
      return NextResponse.json({
        success: false,
        error: 'AI could not generate a proposal. Please try again.',
        proposal: null
      }, { status: 500 })
    }

    // ✅ Step 4: Final Cleanup (FIX Duplicate "Best regards")
    // Pehle check karein kitni baar "Best regards" aya hai
    const bestRegardsRegex = /(Best\s+regards,|Regards,|Sincerely,)/gi
    const matches = proposal.match(bestRegardsRegex)

    // Agar ek se zyada baar aya hai, to last wale ke baad ka sab kuch hata do
    if (matches && matches.length > 1) {
      const parts = proposal.split(bestRegardsRegex)
      // Last signature block ko rakhne ke liye
      proposal = parts.slice(0, 5).join('') // Pehla "Best regards," aur uske aage ka text rakho
      // Ensure it ends with the user's name
      if (!proposal.trim().endsWith(userBasicInfo.name)) {
        proposal += `\n${userBasicInfo.name}`
      }
    }
    // Ensure it ends properly
    proposal = proposal.trim()

    console.log('✅ [PROPOSAL REQUEST] Proposal successfully generated.')

    // ✅ Step 5: Database mein Save Karein (Optional, for history)
    try {
      await pool.query(
        `INSERT INTO proposals (user_id, job_id, job_title, job_description, client_info, budget, skills, generated_proposal, ai_model, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated', NOW())`,
        [
          user.id, jobId, jobTitle, jobDescription,
          clientInfo || {}, budget || 'Not specified',
          skills || [], proposal, userAISettings.model
        ]
      )
      console.log('💾 [PROPOSAL REQUEST] Draft saved to database.')
    } catch (dbError) {
      console.error('⚠️ [PROPOSAL REQUEST] Could not save to DB, but proposal was created:', dbError)
      // Database error par proposal generation fail nahi honi chahiye
    }

    // ✅ Step 6: Final Response
    return NextResponse.json({
      success: true,
      proposal: proposal,
      message: 'Professional, targeted proposal generated successfully!',
      details: {
        model: userAISettings.model,
        length: proposal.length,
        tailored: true // Confirm it's not a fallback
      }
    })

  } catch (error: any) {
    // ✅ YEH FINAL CATCH BLOCK HAI. Yeh sirf UNEXPECTED errors ke liye hai.
    console.error('❌ [PROPOSAL REQUEST] CRITICAL ERROR in route:', error)

    // ✅ OPENAI SPECIFIC ERROR Check (Network, Auth, etc.)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({
        success: false,
        error: `OpenAI API Error: ${error.message}. Please check your API key and balance.`,
        proposal: null
      }, { status: 500 })
    }

    // ✅ GENERAL SERVER ERROR
    return NextResponse.json({
      success: false,
      error: 'Failed to generate proposal: ' + (error.message || 'Unknown server error.'),
      proposal: null
    }, { status: 500 })
  }
}

// ❌❌❌ "generateFallbackProposal" FUNCTION KO POORA DELETE KAR DEIN. ❌❌❌
// ❌❌❌ "selectBestTemplate" FUNCTION BHI DELETE KAR SAKTE HAIN AGAR USE NAHI HO RAHA. ❌❌❌