import { NextResponse } from 'next/server'
import postgres from 'postgres'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DATABASE URL check
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing. Set it in Railway or .env file.')
}

// Connect to Railway Postgres
const sql = postgres(DATABASE_URL, { ssl: 'require' })

export async function GET() {
  try {
    // Example user id
    const userId = 1

    // Get Upwork access_token from DB
    const result = await sql`SELECT access_token FROM upwork_accounts WHERE user_id = ${userId} LIMIT 1`
    if (!result || !result[0]?.access_token) {
      return NextResponse.json({ success: false, jobs: [], message: 'No Upwork token found in DB' })
    }
    const UPWORK_TOKEN = result[0].access_token

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
