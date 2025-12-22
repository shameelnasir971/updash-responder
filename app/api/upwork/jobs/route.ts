import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 20

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
  link: string
}

// ---------------- SAFE RSS HELPERS ----------------
function getTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}>(<!\\[CDATA\\[)?([\\s\\S]*?)(\\]\\]>)?</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[2].trim() : ''
}

async function fetchUpworkRSS(): Promise<JobItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(
      'https://www.upwork.com/ab/feed/jobs/rss?q=shopify',
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    )

    clearTimeout(timeout)

    if (!res.ok) {
      console.error('RSS HTTP Error:', res.status)
      return []
    }

    const xml = await res.text()
    if (!xml || !xml.includes('<item>')) {
      console.error('RSS Empty or invalid XML')
      return []
    }

    const items = xml.split('<item>').slice(1)
    const jobs: JobItem[] = []

    for (const item of items) {
      const title = getTag(item, 'title')
      const link = getTag(item, 'link')
      const description = getTag(item, 'description')
      const pubDate = getTag(item, 'pubDate')

      if (!title || !link) continue

      jobs.push({
        id: link.split('/').pop() || link,
        title,
        description,
        budget: 'Check job on Upwork',
        postedDate: pubDate || '',
        proposals: 0,
        category: 'Shopify',
        skills: [],
        verified: true,
        source: 'upwork',
        isRealJob: true,
        link
      })

      if (jobs.length >= MAX_JOBS) break
    }

    return jobs
  } catch (err: any) {
    console.error('RSS Fetch Failed:', err.message)
    return []
  }
}

// ---------------- API HANDLER ----------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const jobs = await fetchUpworkRSS()

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: jobs.length
        ? `Loaded ${jobs.length} Shopify jobs`
        : 'Upwork RSS temporarily unavailable. Please refresh later.'
    })
  } catch (error: any) {
    console.error('Final API Error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Temporary server issue. Please try again.'
    })
  }
}
