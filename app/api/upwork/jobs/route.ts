import { NextResponse } from 'next/server'
import postgres from 'postgres'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ----------------------------
// Step 0: DATABASE_URL check
// ----------------------------
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing. Please set it in Railway or .env file.')
}

// ----------------------------
// Step 1: Connect to Railway Postgres
// ----------------------------
const sql = postgres(DATABASE_URL, {
  ssl: 'require', // Railway me SSL required hota hai
})

// ----------------------------
// Step 2: API Route
// ----------------------------
export async function GET() {
  try {
    // Example user email
    const userEmail = 'syedalibukharishah16@gmail.com'

    // Get Upwork token from DB
    const result = await sql`SELECT upwork_token FROM upwork_accounts WHERE user_email = ${userEmail} LIMIT 1`
    if (!result || !result[0]?.upwork_token) {
      return NextResponse.json({ success: false, jobs: [], message: 'No Upwork token found in DB' })
    }
    const UPWORK_TOKEN = result[0].upwork_token

    // GraphQL query
    const query = `
      query {
        marketplaceJobPostingsSearch(input: {paging: {offset: 0, limit: 50}}) {
          jobs {
            id
            title
            description
            url
            startDate
          }
        }
      }
    `
    
    const res = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPWORK_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    })

    if (!res.ok) throw new Error('Upwork GraphQL fetch failed')

    const json = await res.json()
    const jobsData = json.data?.marketplaceJobPostingsSearch?.jobs || []

    const jobs = jobsData.map((job: any) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      link: job.url,
      postedDate: job.startDate,
      source: 'upwork'
    }))

    // Save jobs to DB
    for (const job of jobs) {
      await sql`
        INSERT INTO upwork_jobs (job_id, title, description, url, start_date, source)
        VALUES (${job.id}, ${job.title}, ${job.description}, ${job.link}, ${job.postedDate}, ${job.source})
        ON CONFLICT (job_id) DO NOTHING
      `
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      message: `Loaded ${jobs.length} REAL Upwork jobs and saved to DB`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      message: error.message
    }, { status: 500 })
  }
}
