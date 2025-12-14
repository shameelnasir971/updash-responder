// app/api/proposals/generate/route.ts 
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
    console.log('=== PROPOSAL GENERATION START ===')
    
    // 1. Get authenticated user
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ Not authenticated')
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    // 2. Get job details from request
    const { jobId, jobTitle, jobDescription, clientInfo, budget, skills } = await request.json()
    
    console.log('📥 Request data:', {
      jobId,
      jobTitle: jobTitle?.substring(0, 50),
      descriptionLength: jobDescription?.length,
      budget,
      skillsCount: skills?.length || 0
    })

    // 3. Validate required fields
    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 })
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    console.log('🤖 Generating professional proposal for user:', user.id)

    // 4. Load user's prompt settings for personalized proposals
    const settingsResult = await pool.query(
      'SELECT basic_info, proposal_templates, ai_settings FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )

    console.log('📊 User settings found:', settingsResult.rows.length > 0)

    // 5. Default user settings
    let userSettings = {
      basicInfo: {
        specialty: 'Full Stack Development',
        provisions: 'Web Applications, Mobile Apps, API Development',
        hourlyRate: '$25-50',
        name: user.name || 'Freelancer',
        company: user.company_name || '',
        experience: '5+ years',
        portfolio: 'Multiple successful projects delivered',
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express'],
        education: 'Computer Science Degree',
        certifications: []
      },
      proposalTemplates: [
        {
          id: '1',
          title: 'Professional Proposal Template',
          content: `Write a professional Upwork proposal that:
1. Shows understanding of client requirements
2. Highlights relevant skills and experience
3. Mentions 1-2 specific portfolio projects
4. Asks thoughtful questions about the project
5. Includes clear call-to-action
6. Professional yet friendly tone
7. 200-250 words maximum`
        }
      ],
      aiSettings: {
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        maxTokens: 800,
        creativity: 'medium'
      }
    }

    // 6. Override with database settings if available
    if (settingsResult.rows.length > 0) {
      const dbSettings = settingsResult.rows[0]
      
      if (dbSettings.basic_info) {
        userSettings.basicInfo = { ...userSettings.basicInfo, ...dbSettings.basic_info }
      }
      
      if (dbSettings.proposal_templates && Array.isArray(dbSettings.proposal_templates)) {
        userSettings.proposalTemplates = dbSettings.proposal_templates
      }
      
      if (dbSettings.ai_settings) {
        userSettings.aiSettings = { ...userSettings.aiSettings, ...dbSettings.ai_settings }
      }
      
      console.log('✅ Using customized user settings')
    } else {
      console.log('ℹ️ Using default settings for user')
    }

    // 7. Load AI training patterns for this user
    let trainingPatterns = null
    try {
      const trainingResult = await pool.query(
        `SELECT learned_patterns FROM ai_training_data 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [user.id]
      )
      
      if (trainingResult.rows.length > 0) {
        trainingPatterns = trainingResult.rows[0].learned_patterns
        console.log('🧠 Loaded AI training patterns:', trainingPatterns)
      }
    } catch (trainingError) {
      console.log('No training patterns found')
    }

    // 8. Select the best template based on job
    const selectedTemplate = selectBestTemplate(jobDescription, userSettings.proposalTemplates)
    console.log('📝 Selected template:', selectedTemplate.title)

    // 9. Extract job category for better targeting
    const jobCategory = extractJobCategory(jobTitle, jobDescription)
    console.log('🏷️ Detected job category:', jobCategory)

    // 10. Build comprehensive prompt with ALL real data
    const prompt = buildProposalPrompt({
      jobTitle: jobTitle || 'Upwork Job',
      jobDescription: jobDescription,
      budget: budget || 'Not specified',
      skills: skills || [],
      clientInfo: clientInfo || {},
      user: {
        name: userSettings.basicInfo.name,
        specialty: userSettings.basicInfo.specialty,
        provisions: userSettings.basicInfo.provisions,
        hourlyRate: userSettings.basicInfo.hourlyRate,
        company: userSettings.basicInfo.company,
        experience: userSettings.basicInfo.experience,
        portfolio: userSettings.basicInfo.portfolio,
        keySkills: userSettings.basicInfo.skills,
        education: userSettings.basicInfo.education,
        certifications: userSettings.basicInfo.certifications
      },
      template: selectedTemplate.content,
      trainingPatterns: trainingPatterns,
      jobCategory: jobCategory
    })

    console.log('📝 Prompt length:', prompt.length, 'characters')

    // 11. Call OpenAI with real data - NO MOCK/FALLBACK
    try {
      console.log('🚀 Calling OpenAI API...')
      
      const completion = await openai.chat.completions.create({
        model: userSettings.aiSettings.model || 'gpt-4-turbo-preview',
        messages: [
          { 
            role: "system", 
            content: "You are an expert freelance professional who writes winning Upwork proposals. You analyze job requirements carefully and create personalized, professional proposals that get high response rates." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: userSettings.aiSettings.maxTokens || 800,
        temperature: userSettings.aiSettings.temperature || 0.3,
      })

      console.log('✅ OpenAI API call successful')

      const rawProposal = completion.choices[0]?.message?.content

      if (!rawProposal) {
        console.error('❌ OpenAI returned empty proposal')
        return NextResponse.json({ 
          error: 'AI could not generate proposal. Please try again.' 
        }, { status: 500 })
      }

      // 12. Clean and validate the proposal
      const cleanedProposal = cleanProposal(rawProposal, userSettings.basicInfo.name)
      
      console.log('🧹 Proposal cleaned, length:', cleanedProposal.length)

      // 13. Validate proposal quality
      if (cleanedProposal.length < 100) {
        console.error('❌ Proposal too short:', cleanedProposal.length)
        return NextResponse.json({ 
          error: 'Generated proposal is too short. Please try again.' 
        }, { status: 500 })
      }

      // 14. Save to database for history and AI training
      console.log('💾 Saving proposal to database...')
      
      try {
        await pool.query(
          `INSERT INTO proposals 
           (user_id, job_id, job_title, job_description, client_info, budget, skills, 
            generated_proposal, ai_model, temperature, status, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'generated', NOW()) 
           RETURNING id`,
          [
            user.id, 
            jobId, 
            jobTitle || 'Upwork Job',
            jobDescription,
            clientInfo || {},
            budget || 'Not specified',
            skills || [],
            cleanedProposal,
            userSettings.aiSettings.model,
            userSettings.aiSettings.temperature
          ]
        )
        
        console.log('✅ Proposal saved to database')
      } catch (dbError: any) {
        console.error('❌ Database save error:', dbError.message)
        // Don't fail the request if database save fails
      }

      // 15. Return successful response
      return NextResponse.json({ 
        success: true,
        proposal: cleanedProposal,
        message: 'Professional proposal generated successfully!',
        details: {
          model: userSettings.aiSettings.model,
          temperature: userSettings.aiSettings.temperature,
          length: cleanedProposal.length,
          wordCount: cleanedProposal.split(/\s+/).length,
          template: selectedTemplate.title,
          jobCategory: jobCategory,
          quality: 'real_ai_generated'
        }
      })

    } catch (aiError: any) {
      console.error('❌ OpenAI API error:', aiError.message)
      
      // NO FALLBACK PROPOSAL - Return error
      return NextResponse.json({ 
        success: false,
        error: 'Failed to generate proposal: ' + aiError.message,
        message: 'Please check your OpenAI API key and try again.'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Proposal generation error:', error.message)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}

// ==================== HELPER FUNCTIONS ====================

// Select best template based on job description
function selectBestTemplate(jobDescription: string, templates: any[]) {
  if (!templates || templates.length === 0) {
    return {
      id: 'default',
      title: 'Professional Template',
      content: 'Write a professional proposal addressing client needs with specific examples.'
    }
  }
  
  const description = jobDescription.toLowerCase()
  
  // Check for keywords to match templates
  const templateScores = templates.map(template => {
    let score = 0
    const title = template.title?.toLowerCase() || ''
    const content = template.content?.toLowerCase() || ''
    
    // Score based on template title keywords
    if (title.includes('main') || title.includes('default') || title.includes('professional')) {
      score += 3
    }
    
    // Check if template mentions specific technologies
    const techKeywords = ['web', 'mobile', 'api', 'frontend', 'backend', 'fullstack']
    techKeywords.forEach(keyword => {
      if (description.includes(keyword) && content.includes(keyword)) {
        score += 2
      }
    })
    
    return { ...template, score }
  })
  
  // Return highest scoring template
  templateScores.sort((a, b) => b.score - a.score)
  return templateScores[0]
}

// Extract job category from title and description
function extractJobCategory(title: string = '', description: string = ''): string {
  const text = (title + ' ' + description).toLowerCase()
  
  if (text.includes('react') || text.includes('javascript') || text.includes('frontend')) {
    return 'Frontend Development'
  } else if (text.includes('node') || text.includes('api') || text.includes('backend')) {
    return 'Backend Development'
  } else if (text.includes('full stack') || text.includes('fullstack')) {
    return 'Full Stack Development'
  } else if (text.includes('mobile') || text.includes('app')) {
    return 'Mobile Development'
  } else if (text.includes('web') || text.includes('website')) {
    return 'Web Development'
  } else if (text.includes('design') || text.includes('ui') || text.includes('ux')) {
    return 'Design'
  } else if (text.includes('wordpress') || text.includes('shopify')) {
    return 'CMS Development'
  }
  
  return 'General Development'
}

// Build comprehensive prompt with all real data
function buildProposalPrompt(data: {
  jobTitle: string
  jobDescription: string
  budget: string
  skills: string[]
  clientInfo: any
  user: {
    name: string
    specialty: string
    provisions: string
    hourlyRate: string
    company: string
    experience: string
    portfolio: string
    keySkills: string[]
    education: string
    certifications: string[]
  }
  template: string
  trainingPatterns: any
  jobCategory: string
}): string {
  
  const clientDetails = data.clientInfo.name 
    ? `Client Name: ${data.clientInfo.name}
Client Rating: ${data.clientInfo.rating || 'N/A'}
Client Location: ${data.clientInfo.country || 'Remote'}
Client History: ${data.clientInfo.totalHires || 'N/A'} hires, $${data.clientInfo.totalSpent || 'N/A'} spent`
    : 'Client information not provided'
  
  const userSkills = data.user.keySkills?.join(', ') || data.user.specialty
  const requiredSkills = data.skills?.join(', ') || 'Various technical skills'
  
  let trainingInstructions = ''
  if (data.trainingPatterns) {
    if (data.trainingPatterns.addedSections?.includes('portfolio_links')) {
      trainingInstructions += '- Include specific portfolio examples\n'
    }
    if (data.trainingPatterns.addedSections?.includes('call_to_action')) {
      trainingInstructions += '- Add clear call-to-action for next steps\n'
    }
    if (data.trainingPatterns.toneChanges?.addedEnthusiasm) {
      trainingInstructions += '- Use enthusiastic and passionate tone\n'
    }
    if (data.trainingPatterns.toneChanges?.addedProfessionalism) {
      trainingInstructions += '- Use highly professional and formal tone\n'
    }
  }
  
  return `# UPMORK PROPOSAL GENERATION

## JOB DETAILS (REAL DATA FROM UPWORK):
**Job Title:** ${data.jobTitle}
**Budget:** ${data.budget}
**Required Skills:** ${requiredSkills}
**Job Category:** ${data.jobCategory}

## CLIENT INFORMATION:
${clientDetails}

## JOB DESCRIPTION (EXACT TEXT FROM UPWORK):
${data.jobDescription}

## FREELANCER PROFILE (USER'S REAL INFORMATION):
**Name:** ${data.user.name}
**Specialty:** ${data.user.specialty}
**Services Provided:** ${data.user.provisions}
**Hourly Rate:** ${data.user.hourlyRate}
**Company:** ${data.user.company || 'Independent Professional'}
**Experience:** ${data.user.experience}
**Key Skills:** ${userSkills}
**Education:** ${data.user.education}
**Portfolio Background:** ${data.user.portfolio}
${data.user.certifications?.length > 0 ? `**Certifications:** ${data.user.certifications.join(', ')}` : ''}

## PROPOSAL TEMPLATE INSTRUCTIONS:
${data.template}

## SPECIFIC REQUIREMENTS FOR THIS PROPOSAL:
1. **Personalization:** Address the client by name if provided, or use professional greeting
2. **Understanding:** Show you've read and understood the job description
3. **Relevance:** Match your ${data.user.specialty} skills to the job requirements
4. **Examples:** Mention 1-2 specific relevant experiences from your portfolio
5. **Questions:** Ask 1-2 intelligent questions about the project specifics
6. **Call-to-Action:** Clearly state next steps (call, meeting, start date)
7. **Length:** 200-300 words maximum, concise but comprehensive
8. **Tone:** Professional, confident, friendly, and solution-oriented
9. **Format:** Proper business letter format with greeting and signature
10. **Uniqueness:** Avoid generic phrases, be specific about this job

## AI TRAINING GUIDELINES (Based on user's past preferences):
${trainingInstructions || '- Follow the template instructions above'}

## IMPORTANT RULES:
- DO NOT make up facts about the client
- DO NOT include placeholders like [Your Name]
- DO NOT use markdown formatting
- DO NOT hallucinate details not in job description
- DO write as ${data.user.name}
- DO use real skills from the freelancer profile
- DO keep it professional and persuasive

## EXPECTED OUTPUT:
A complete, ready-to-send Upwork proposal that:
- Addresses the client's specific needs
- Highlights the freelancer's relevant experience
- Includes specific examples
- Asks thoughtful questions
- Has clear next steps
- Is properly formatted

Now generate the proposal:`
}

// Clean up AI-generated proposal
function cleanProposal(proposal: string, userName: string): string {
  let cleaned = proposal.trim()
  
  // Remove any markdown formatting
  cleaned = cleaned.replace(/```json|```|\[|\]|#+|\*\*/g, '')
  
  // Remove "Proposal:" or similar headers
  cleaned = cleaned.replace(/^(Proposal|Cover Letter|Dear Client)[:\s]*/i, '')
  
  // Ensure proper signature
  const signatureOptions = [
    'Best regards,',
    'Sincerely,',
    'Kind regards,',
    'Respectfully,',
    'Thank you,'
  ]
  
  let hasSignature = false
  for (const signoff of signatureOptions) {
    if (cleaned.includes(signoff)) {
      hasSignature = true
      break
    }
  }
  
  if (!hasSignature) {
    cleaned += `\n\nBest regards,\n${userName}`
  }
  
  // Ensure single line breaks between paragraphs
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')
  
  // Trim extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Proposal generation endpoint. Use POST with job details.',
    required_fields: ['jobId', 'jobDescription', 'jobTitle', 'budget', 'skills', 'clientInfo'],
    note: 'All proposals are generated by OpenAI GPT-4 with real job data'
  })
}