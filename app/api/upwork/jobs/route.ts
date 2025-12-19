import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
import Parser from 'rss-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 300
const parser = new Parser()

const RSS_KEYWORDS = [
  'web development',
  'react',
  'shopify',
  'figma',
  'wordpress',
  'mobile app',
]

type JobItem = {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  proposals: number
  category: string
  skills: string[]
  verified: boolean
  source: 'upwork'
  isRealJob: true
}

// ================= RSS FETCH =================
async function fetchJobsFromRSS(keyword: string): Promise<JobItem[]> {
  const feed = await parser.parseURL(
    `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(keyword)}`
  )

  return (feed.items || []).map((item: any) => ({
    id: item.guid,
    title: item.title || 'Job',
    description: item.contentSnippet || '',
    budget: 'Not specified',
    postedDate: new Date(item.pubDate).toLocaleDateString(),
    proposals: 0,
    category: keyword,
    skills: [],
    verified: true,
    source: 'upwork',
    isRealJob: true,
  }))
}

// ================= API =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase()

    const keywords = search ? [search] : RSS_KEYWORDS
    const jobMap = new Map<string, JobItem>()

    for (const keyword of keywords) {
      const jobs = await fetchJobsFromRSS(keyword)

      for (const job of jobs) {
        if (!jobMap.has(job.id)) {
          jobMap.set(job.id, job)
        }
      }

      if (jobMap.size >= MAX_JOBS) break
    }

    const allJobs = Array.from(jobMap.values()).slice(0, MAX_JOBS)

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      cached: false,
      message: `Loaded ${allJobs.length} jobs`,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
