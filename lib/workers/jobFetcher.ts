// lib/workers/jobFetcher.ts
import pool from '../database'

let isFetching = false

export async function fetchNewJobsAutomatically() {
  if (isFetching) {
    console.log('⏳ Job fetcher already running...')
    return
  }
  
  try {
    isFetching = true
    console.log('🤖 AUTO: Checking for new Upwork jobs...')
    
    // Get access token
    const users = await pool.query(
      'SELECT u.id, ua.access_token FROM users u JOIN upwork_accounts ua ON u.id = ua.user_id LIMIT 1'
    )
    
    if (users.rows.length === 0) {
      console.log('⏭️ No connected users found')
      return
    }
    
    const accessToken = users.rows[0].access_token
    
    // Fetch jobs from last 1 hour only
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    console.log('🕐 Fetching jobs from last 1 hour...')
    
    // Use the same fetch function but for recent jobs
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetRecentJobs($first: Int) {
            marketplaceJobPostingsSearch(
              first: $first,
              filter: { postedDate: { gte: "${oneHourAgo.toISOString()}" } }
            ) {
              edges {
                node {
                  id
                  title
                  description
                  amount { rawValue currency displayValue }
                  skills { name }
                  category
                  createdDateTime
                }
              }
            }
          }
        `,
        variables: { first: 50 }
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      const newJobs = data.data?.marketplaceJobPostingsSearch?.edges || []
      
      if (newJobs.length > 0) {
        console.log(`🎉 AUTO: Found ${newJobs.length} new jobs in last hour`)
        
        // You can notify user here or update database
        // For now, just log
      } else {
        console.log('ℹ️ AUTO: No new jobs in last hour')
      }
    }
    
  } catch (error: any) {
    console.error('❌ AUTO: Error fetching new jobs:', error.message)
  } finally {
    isFetching = false
  }
}

// Start auto-fetch on server start
if (typeof window === 'undefined') {
  console.log('🚀 Starting auto job fetcher...')
  
  // Run immediately
  fetchNewJobsAutomatically()
  
  // Then run every 5 minutes
  setInterval(fetchNewJobsAutomatically, 5 * 60 * 1000)
}