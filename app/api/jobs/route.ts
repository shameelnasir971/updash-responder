// app/api/jobs/route.ts - COMPLETE REAL UPDATED
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ✅ GRAPHQL API FUNCTION
async function fetchUpworkGraphQLJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching jobs via Upwork GraphQL API...')
    
    const graphqlQuery = {
      query: `
        query GetJobs($limit: Int = 10) {
          self {
            id
            jobSearch(first: $limit) {
              edges {
                node {
                  id
                  title
                  description
                  publishedOn
                  amount {
                    amount
                    currencyCode
                  }
                  client {
                    freelancerRating
                    totalSpent
                    totalHires
                    country
                  }
                  skills {
                    name
                  }
                  proposalsCount
                  jobStatus
                  isVerifiedPayment
                }
              }
            }
          }
        }
      `,
      variables: { limit: 10 }
    }

    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📡 GraphQL response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL API error:', errorText)
      throw new Error(`GraphQL API error: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ GraphQL response received')
    
    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors)
      throw new Error('GraphQL query error')
    }

    const jobs = result.data?.self?.jobSearch?.edges || []
    console.log(`✅ Found ${jobs.length} jobs via GraphQL`)

    return jobs.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `upwork_${Date.now()}`,
        title: job.title || 'Untitled Job',
        description: job.description || 'No description available',
        budget: job.amount ? 
          `$${job.amount.amount} ${job.amount.currencyCode}` : 
          'Rate not specified',
        postedDate: job.publishedOn ? 
          new Date(job.publishedOn).toLocaleString() : 
          new Date().toLocaleString(),
        client: {
          name: 'Upwork Client',
          rating: job.client?.freelancerRating || 0,
          country: job.client?.country || 'Not specified',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.totalHires || 0
        },
        skills: job.skills?.map((s: any) => s.name) || [],
        proposals: job.proposalsCount || 0,
        verified: job.isVerifiedPayment || false,
        category: 'Web Development',
        duration: 'Not specified',
        source: 'upwork',
        isRealJob: true,
        isConnectPrompt: false
      }
    })

  } catch (error: any) {
    console.error('❌ GraphQL fetch error:', error.message)
    return [] // Empty array return karen error mein
  }
}

// ✅ FALLBACK REST API FUNCTION (Agar GraphQL fail ho)
async function fetchUpworkRESTJobs(accessToken: string, keywords: string = 'web development') {
  try {
    console.log('🔗 Trying REST API as fallback...')
    
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=${encodeURIComponent(keywords)}&paging=0;10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    console.log('📡 REST API response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ REST API Error:', errorData)
      return [] // Empty array return karen
    }

    const data = await response.json()
    
    if (!data.jobs || data.jobs.length === 0) {
      console.log('ℹ️ No jobs found from REST API')
      return []
    }
    
    return data.jobs.map((job: any) => ({
      id: job.id || `upwork_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || 'No description',
      budget: job.budget?.amount ? `$${job.budget.amount}` : 'Not specified',
      postedDate: job.created_on || new Date().toISOString(),
      client: {
        name: job.client?.name || 'Client',
        rating: job.client?.feedback || 0,
        country: job.client?.country || 'Not specified'
      },
      skills: job.skills || [],
      proposals: job.proposals || 0,
      verified: job.verified || false,
      category: job.category || 'General',
      source: 'upwork',
      isRealJob: true
    }))
    
  } catch (error: any) {
    console.error('❌ REST API error:', error.message)
    return []
  }
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    console.log('🎯 Fetching jobs for user:', user.email)

    // Database se upwork account check karen
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_name FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    let jobs = []
    let source = 'demo'
    let message = ''
    let upworkConnected = false
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // ✅ UPWORK CONNECTED HAI
      upworkConnected = true
      const accessToken = upworkResult.rows[0].access_token
      
      try {
        // 1. Pehle GraphQL API try karen
        jobs = await fetchUpworkGraphQLJobs(accessToken)
        
        if (jobs.length > 0) {
          source = 'upwork_graphql'
          message = `✅ ${jobs.length} real jobs loaded from Upwork GraphQL API`
        } else {
          // 2. Agar GraphQL se jobs nahi aaye, REST API try karen
          console.log('⚠️ GraphQL returned no jobs, trying REST API...')
          jobs = await fetchUpworkRESTJobs(accessToken, 'web development')
          
          if (jobs.length > 0) {
            source = 'upwork_rest'
            message = `✅ ${jobs.length} real jobs loaded from Upwork REST API`
          } else {
            // 3. Dono APIs se jobs nahi aaye toh demo jobs dikhaye
            jobs = getDemoJobs()
            source = 'demo_fallback'
            message = 'No jobs found on Upwork. Showing demo jobs.'
          }
        }
        
      } catch (apiError: any) {
        console.error('❌ API error:', apiError.message)
        jobs = getDemoJobs()
        source = 'api_error'
        message = 'Upwork API error. Showing demo jobs.'
      }
    } else {
      // ❌ UPWORK NOT CONNECTED
      upworkConnected = false
      jobs = [getConnectPromptJob()]
      source = 'not_connected'
      message = '🔗 Connect Upwork to see real jobs'
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      source: source,
      message: message,
      upworkConnected: upworkConnected
    })

  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: getDemoJobs(),
      total: 3,
      source: 'error_fallback',
      message: 'Error loading jobs',
      upworkConnected: false
    })
  }
}

// Demo jobs function
function getDemoJobs() {
  return [
    {
      id: "demo_1",
      title: "Web Developer Needed - React & Node.js",
      description: "Looking for a skilled web developer to build a modern web application using React and Node.js. Must have experience with databases and API integration.",
      budget: "$1000-$2000",
      postedDate: new Date().toLocaleString(),
      client: {
        name: "Tech Solutions Inc.",
        rating: 4.8,
        country: "United States"
      },
      skills: ["React", "Node.js", "JavaScript", "MongoDB"],
      proposals: 12,
      verified: true,
      category: "Web Development",
      source: "demo",
      isRealJob: false
    },
    {
      id: "demo_2",
      title: "Full Stack Mobile App Developer",
      description: "Need a developer to create a cross-platform mobile app using React Native. Should include user authentication and payment integration.",
      budget: "$1500-$3000",
      postedDate: new Date(Date.now() - 86400000).toLocaleString(),
      client: {
        name: "Startup Ventures",
        rating: 4.5,
        country: "Canada"
      },
      skills: ["React Native", "Firebase", "Redux", "API"],
      proposals: 8,
      verified: true,
      category: "Mobile Development",
      source: "demo",
      isRealJob: false
    },
    {
      id: "demo_3",
      title: "UI/UX Designer for E-commerce Website",
      description: "Seeking a creative UI/UX designer to redesign our e-commerce platform. Must provide wireframes and prototypes.",
      budget: "$800-$1500",
      postedDate: new Date(Date.now() - 172800000).toLocaleString(),
      client: {
        name: "Fashion Retail Co.",
        rating: 4.9,
        country: "United Kingdom"
      },
      skills: ["UI/UX", "Figma", "Adobe XD", "Wireframing"],
      proposals: 15,
      verified: true,
      category: "Design",
      source: "demo",
      isRealJob: false
    }
  ]
}

// Single connect prompt job
function getConnectPromptJob() {
  return {
    id: "connect_prompt",
    title: "🔗 Connect Your Upwork Account",
    description: "To view real Upwork job listings and send proposals, please connect your Upwork account. Click the 'Connect Upwork' button in the sidebar to get started.",
    budget: "Free to connect",
    postedDate: new Date().toLocaleString(),
    client: {
      name: "Upwork Platform",
      rating: 5.0,
      country: "Worldwide",
      totalSpent: 0,
      totalHires: 0
    },
    skills: ["Upwork", "Account Setup", "API Connection"],
    proposals: 0,
    verified: true,
    category: "System",
    duration: "Instant",
    isConnectPrompt: true
  }
}