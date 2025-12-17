import pool from './database'

let isRunning = false

export async function startBackgroundJobFetcher() {
  if (isRunning) return
  
  isRunning = true
  console.log('🚀 Starting background job fetcher...')
  
  // Fetch jobs immediately
  await fetchAndCacheJobs()
  
  // Then fetch every 5 minutes
  setInterval(fetchAndCacheJobs, 5 * 60 * 1000)
}

async function fetchAndCacheJobs() {
  try {
    console.log('🔄 Background: Fetching jobs from Upwork...')
    
    const upworkResult = await pool.query(
      'SELECT user_id, access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('Background: No Upwork connection found')
      return
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // You would call your fetch function here
    // This is just a placeholder - implement actual fetch
    console.log('✅ Background: Job fetch completed')
    
  } catch (error) {
    console.error('❌ Background fetch error:', error)
  }
}

// Start the background worker
if (typeof window === 'undefined') {
  // Only run on server
  startBackgroundJobFetcher()
}