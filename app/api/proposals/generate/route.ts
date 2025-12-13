// app/api/proposals/generate/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 })
    }

    console.log('🤖 Generating professional proposal for:', jobTitle)

    // Load user's prompt settings for personalized proposals
    const settingsResult = await pool.query(
      'SELECT basic_info, proposal_templates, ai_settings FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )

    let userSettings = {
      basicInfo: {
        specialty: 'Full Stack Development',
        provisions: 'Web Applications, Mobile Apps, API Development',
        hourlyRate: '$25-50',
        name: user.name,
        company: user.company_name || ''
      },
      proposalTemplates: [
        {
          id: '1',
          content: `Write a professional Upwork proposal that shows understanding of client needs and highlights relevant experience.`
        }
      ],
      aiSettings: {
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 600
      }
    }

    if (settingsResult.rows.length > 0) {
      const dbSettings = settingsResult.rows[0]
      userSettings = {
        basicInfo: dbSettings.basic_info || userSettings.basicInfo,
        proposalTemplates: dbSettings.proposal_templates || userSettings.proposalTemplates,
        aiSettings: dbSettings.ai_settings || userSettings.aiSettings
      }
    }

    // Select the best template based on job
    const selectedTemplate = selectBestTemplate(jobDescription, userSettings.proposalTemplates)

    // Build advanced prompt with user's personal info
    const prompt = `
ROLE: You are ${user.name}, a professional ${userSettings.basicInfo.specialty}.

JOB DETAILS:
Title: ${jobTitle}
Description: ${jobDescription}
Budget: ${budget || 'Not specified'}
Required Skills: ${Array.isArray(skills) ? skills.join(', ') : skills || 'Not specified'}
Client: ${clientInfo?.name || 'Unknown'} (Rating: ${clientInfo?.rating || 'N/A'})

YOUR PROFILE:
Specialty: ${userSettings.basicInfo.specialty}
Services: ${userSettings.basicInfo.provisions}
Hourly Rate: ${userSettings.basicInfo.hourlyRate}
Company: ${userSettings.basicInfo.company || 'Freelance Professional'}

TEMPLATE INSTRUCTIONS:
${selectedTemplate.content}

SPECIFIC REQUIREMENTS:
1. Address EXACT requirements from job description
2. Show 2-3 relevant skills from: ${userSettings.basicInfo.provisions}
3. Mention similar project experience briefly
4. Ask 1-2 specific questions about the project
5. Keep professional but friendly tone
6. Maximum 250 words
7. Include clear call-to-action
8. Sign off as: ${user.name}

IMPORTANT: Do NOT make up facts about client. Only use information provided.
`

    try {
      const completion = await openai.chat.completions.create({
        model: userSettings.aiSettings.model || 'gpt-4',
        messages: [
          { 
            role: "system", 
            content: "You are an expert freelancer who writes winning Upwork proposals that get high response rates. You understand client needs and provide specific, relevant examples." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: userSettings.aiSettings.maxTokens || 600,
        temperature: userSettings.aiSettings.temperature || 0.3,
      })

      const proposal = completion.choices[0]?.message?.content

      if (!proposal) {
        throw new Error('AI could not generate proposal')
      }

      // Clean up the proposal
      const cleanedProposal = cleanProposal(proposal, user.name)

      // Save to database for AI training and history
      await pool.query(
        `INSERT INTO proposals (user_id, job_id, job_title, job_description, generated_proposal, ai_model, temperature, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'generated', NOW())`,
        [user.id, jobId, jobTitle, jobDescription, cleanedProposal, 
         userSettings.aiSettings.model, userSettings.aiSettings.temperature]
      )

      return NextResponse.json({ 
        success: true,
        proposal: cleanedProposal,
        message: 'Professional proposal generated successfully!',
        details: {
          model: userSettings.aiSettings.model,
          temperature: userSettings.aiSettings.temperature,
          length: cleanedProposal.length,
          template: selectedTemplate.title
        }
      })

    } catch (aiError: any) {
      console.error('OpenAI error:', aiError)
      
      // Fallback proposal
      const fallbackProposal = generateFallbackProposal(jobTitle, jobDescription, user.name, skills)
      
      // Save fallback to database
      await pool.query(
        `INSERT INTO proposals (user_id, job_id, job_title, job_description, generated_proposal, ai_model, temperature, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'generated_fallback', NOW())`,
        [user.id, jobId, jobTitle, jobDescription, fallbackProposal, 
         'fallback', 0]
      )

      return NextResponse.json({ 
        success: true,
        proposal: fallbackProposal,
        message: 'Proposal generated successfully (fallback mode)',
        details: {
          model: 'fallback',
          temperature: 0,
          length: fallbackProposal.length,
          template: 'fallback'
        }
      })
    }

  } catch (error: any) {
    console.error('Proposal generation error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate proposal: ' + error.message 
    }, { status: 500 })
  }
}

// Helper function to select best template
function selectBestTemplate(jobDescription: string, templates: any[]) {
  if (!templates || templates.length === 0) {
    return {
      id: 'default',
      title: 'Default Template',
      content: 'Write a professional proposal addressing client needs.'
    }
  }
  
  // Simple keyword matching to select template
  const description = jobDescription.toLowerCase()
  
  for (const template of templates) {
    const title = template.title?.toLowerCase() || ''
    if (title.includes('main') || title.includes('default')) {
      return template
    }
  }
  
  return templates[0]
}

// Clean up AI-generated proposal
function cleanProposal(proposal: string, userName: string): string {
  let cleaned = proposal.trim()
  
  // Remove any markdown formatting
  cleaned = cleaned.replace(/```json|```|\[|\]/g, '')
  
  // Ensure it ends with proper sign-off
  if (!cleaned.includes(userName)) {
    cleaned += `\n\nBest regards,\n${userName}`
  }
  
  return cleaned
}

// Generate fallback proposal
function generateFallbackProposal(jobTitle: string, jobDescription: string, userName: string, skills: any): string {
  const skillText = Array.isArray(skills) ? skills.slice(0, 3).join(', ') : 'this field'
  
  return `Dear Client,

I am writing to express my interest in your "${jobTitle}" project. 

Based on the job description, I understand you need someone with experience in ${skillText}. I have successfully completed similar projects where I delivered high-quality results on time and within budget.

My approach focuses on clear communication, regular updates, and attention to detail to ensure your project's success.

I would be happy to discuss your requirements in more detail. Could you please share more information about the project timeline and specific deliverables?

Looking forward to the opportunity to work with you.

Best regards,
${userName}`
}