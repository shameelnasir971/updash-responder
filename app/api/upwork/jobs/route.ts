import { NextResponse } from 'next/server'
import postgres from 'postgres'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is missing')

const sql = postgres(DATABASE_URL, { ssl: 'require' })

export async function GET() {
  try {
    const userId = 1 // user jiska token use karna hai

    // Get access token
    const tokenResult = await sql`SELECT access_token FROM upwork_accounts WHERE user_id = ${userId} LIMIT 1`
    if (!tokenResult?.[0]?.access_token) {
      return NextResponse.json({ success: false, jobs: [], message: 'No Upwork token found in DB' })
    }
    const UPWORK_TOKEN = tokenResult[0].access_token

    let allJobs: any[] = []
    let offset = 0
    const limit = 50 // Upwork max limit per request
    let keepFetching = true

    while (keepFetching) {
      // GraphQL query
      const query = `
        query {
          marketplaceJobPostingsSearch(
            input: {
              paging: { offset: ${offset}, limit: ${limit} }
              filter: { categories: [], countries: [], jobTypes: [], duration: [], experienceLevels: [] }
            }
          ) {
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

      if (!res.ok) throw new Error(`Upwork API returned ${res.status}`)

      const json = await res.json()
      const jobs = json.data?.marketplaceJobPostingsSearch?.jobs || []

      if (jobs.length === 0) break // no more jobs

      allJobs.push(...jobs)
      offset += limit
    }

    // Save to DB
    for (const job of allJobs) {
      await sql`
        INSERT INTO upwork_jobs (job_id, title, description, url, start_date, source)
        VALUES (${job.id}, ${job.title}, ${job.description}, ${job.url}, ${job.startDate}, 'upwork')
        ON CONFLICT (job_id) DO NOTHING
      `
    }

    return NextResponse.json({
      success: true,
      count: allJobs.length,
      jobs: allJobs,
      message: `Loaded ${allJobs.length} REAL Upwork jobs and saved to DB`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      jobs: [],
      count: 0,
      message: error.message
    }, { status: 500 })
  }
}
