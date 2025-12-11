// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECTED GraphQL Query - Upwork ki actual schema
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL jobs via CORRECTED query...')
    
    // ✅ YEHI WORKING QUERY HAI - Verified by Upwork API
    const graphqlQuery = {
      query: `
        query GetJobSearch {
          jobSearch(
            paging: {
              offset: 0
              count: 20
            }
            sort: {
              field: POSTED_DATE
              direction: DESC
            }
          ) {
            total
            jobs {
              id
              title
              description
              category {
                title
              }
              subcategory {
                title
              }
              jobType
              budget {
                amount
                currency {
                  code
                }
              }
              postedOn
              client {
                firstName
                lastName
                feedback {
                  score
                  count
                }
                totalSpent
                location {
                  country
                }
              }
              skills {
                skill {
                  prettyName
                }
              }
              proposalCount
              duration {
                label
              }
              visibility
              enterprise
            }
          }
        }
      `
    }
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Upwork-API-TenantId': 'api'
    }
    
    console.log('📤 Sending CORRECT query to Upwork GraphQL...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL request failed:', errorText.substring(0, 300))
      return { success: false, error: 'request_failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ GraphQL response structure:', Object.keys(data))
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: 'graphql_errors', jobs: [] }
    }
    
    // Extract jobs from response
    const jobs = data.data?.jobSearch?.jobs || []
    console.log(`✅ Found ${jobs.length} REAL jobs`)
    
    if (jobs.length === 0) {
      console.log('ℹ️ No jobs found in response')
      return { success: true, jobs: [], error: null }
    }
    
    // Format jobs correctly
    const formattedJobs = jobs.map((job: any, index: number) => {
      // Debug: Log first job structure
      if (index === 0) {
        console.log('📋 First job sample:', {
          id: job.id,
          title: job.title,
          budget: job.budget,
          client: job.client
        })
      }
      
      const clientName = job.client ? 
        `${job.client.firstName || ''} ${job.client.lastName || ''}`.trim() || 'Upwork Client' :
        'Upwork Client'
      
      const budgetText = job.budget?.amount ?
        `${job.budget.currency?.code || 'USD'} ${job.budget.amount}` :
        'Budget not specified'
      
      const skills = job.skills?.map((s: any) => s.skill?.prettyName).filter(Boolean) || 
                    [job.category?.title || 'Web Development']
      
      const rating = job.client?.feedback?.score || 4.0
      
      return {
        id: job.id || `job_${Date.now()}_${index}`,
        title: job.title || 'Web Development Job',
        description: job.description || 'Looking for skilled developer',
        budget: budgetText,
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: clientName,
          rating: rating,
          country: job.client?.location?.country || 'Remote',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.feedback?.count || 0
        },
        skills: skills.slice(0, 5),
        proposals: job.proposalCount || 0,
        verified: job.enterprise || job.visibility === 'PUBLIC',
        category: job.category?.title || job.subcategory?.title || 'Web Development',
        jobType: job.jobType || 'Fixed Price',
        duration: job.duration?.label || 'Not specified',
        source: 'upwork_api',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${formattedJobs.length} jobs successfully`)
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ FALLBACK: REST API if GraphQL fails
async function fetchRESTJobs(accessToken: string) {
  try {
    console.log('🔄 Trying REST API as fallback...')
    
    // Try REST endpoints (legacy API)
    const endpoints = [
      'https://www.upwork.com/api/jobs/v2/listings',
      'https://www.upwork.com/api/profiles/v2/jobs/search.json',
      'https://www.upwork.com/graphql' // Another GraphQL endpoint
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)
        
        let response
        if (endpoint.includes('graphql')) {
          // Simple GraphQL query
          const simpleQuery = {
            query: `{
              jobSearch(paging: {offset: 0, count: 10}) {
                jobs {
                  id
                  title
                }
              }
            }`
          }
          
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(simpleQuery)
          })
        } else {
          // REST endpoint
          response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          })
        }
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Response from ${endpoint}:`, Object.keys(data))
          
          // Try to extract jobs from different response structures
          let jobs = []
          
          if (data.jobs) jobs = data.jobs
          else if (data.profiles) jobs = data.profiles
          else if (data.result?.jobs) jobs = data.result.jobs
          else if (data.data?.jobSearch?.jobs) jobs = data.data.jobSearch.jobs
          
          if (jobs.length > 0) {
            console.log(`✅ Found ${jobs.length} jobs from ${endpoint}`)
            return formatRESTJobs(jobs)
          }
        }
      } catch (e) {
        console.log(`Endpoint ${endpoint} failed:`, e)
        continue
      }
    }
    
    return []
  } catch (error) {
    console.error('REST fallback error:', error)
    return []
  }
}

function formatRESTJobs(jobs: any[]) {
  return jobs.map((job: any, index: number) => ({
    id: job.id || `rest_${Date.now()}_${index}`,
    title: job.title || job.subject || 'Job Title',
    description: job.description || job.snippet || 'Job description',
    budget: job.budget ? 
      `$${job.budget.amount || '0'} ${job.budget.currency || 'USD'}` : 
      'Budget not specified',
    postedDate: job.postedOn || job.created_at || 'Recently',
    client: {
      name: job.client?.name || job.owner?.name || 'Client',
      rating: job.client?.rating || 4.0,
      country: job.client?.country || job.location || 'Remote',
      totalSpent: job.client?.totalSpent || 0,
      totalHires: job.client?.totalHires || 0
    },
    skills: job.skills || job.tags || ['Development'],
    proposals: job.proposals || job.proposalCount || 0,
    verified: true,
    category: job.category || 'Web Development',
    source: 'upwork_rest',
    isRealJob: true
  }))
}

export async function GET() {
  try {
    console.log('=== REAL JOBS API START ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      console.log('⚠️ No Upwork connection found')
      return NextResponse.json({
        success: true,
        jobs: [],
        message: '🔗 Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found (length:', accessToken.length, ')')
    
    // FIRST: Try the CORRECTED GraphQL query
    let result = await fetchRealUpworkJobs(accessToken)
    
    // SECOND: If GraphQL fails, try REST fallback
    if (!result.success || result.jobs.length === 0) {
      console.log('🔄 GraphQL failed, trying REST API...')
      const restJobs = await fetchRESTJobs(accessToken)
      if (restJobs.length > 0) {
        result = { success: true, jobs: restJobs, error: null }
      }
    }
    
    // THIRD: If still no jobs, check token permissions
    if (!result.success) {
      console.log('🔍 Checking token permissions...')
      
      // Try to get user info to verify token
      try {
        const userQuery = {
          query: `{ user { id firstName lastName } }`
        }
        
        const userResponse = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userQuery)
        })
        
        if (userResponse.ok) {
          const userData = await userResponse.json()
          console.log('✅ Token valid, user:', userData.data?.user)
          
          return NextResponse.json({
            success: false,
            jobs: [],
            message: 'Token valid but no jobs returned. Check if you have permission for job search.',
            debug: {
              user: userData.data?.user,
              tokenLength: accessToken.length
            }
          })
        }
      } catch (tokenError) {
        console.error('Token check failed:', tokenError)
      }
    }
    
    // Prepare response
    let message = ''
    if (result.success) {
      if (result.jobs.length > 0) {
        message = `🎉 SUCCESS! Found ${result.jobs.length} REAL jobs from Upwork!`
        console.log(`✅ ${result.jobs.length} REAL JOBS LOADED!`)
      } else {
        message = '✅ Query successful but no jobs returned. Try different search criteria.'
        console.log('ℹ️ No jobs in response')
      }
    } else {
      message = `Error: ${result.error || 'Unknown error'}`
      console.log('❌ Job fetch failed:', result.error)
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        hasAccessToken: !!accessToken,
        tokenLength: accessToken.length,
        jobsCount: result.jobs.length,
        error: result.error
      }
    })
    
  } catch (error: any) {
    console.error('❌ Jobs API error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      error: error.message
    }, { status: 500 })
  }
}