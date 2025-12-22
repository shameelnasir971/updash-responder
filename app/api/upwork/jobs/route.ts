import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 20 // RSS se zyada mil jati hain

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

// ---------- Simple RSS helpers ----------
function getTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}>(<!\\[CDATA\\[)?([\\s\\S]*?)(\\]\\]>)?</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[2].trim() : ''
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // 🔥 OFFICIAL UPWORK RSS (Shopify)
    const rssUrl = 'https://www.upwork.com/ab/feed/jobs/rss?q=shopify'
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (!res.ok) {
      throw new Error('Failed to load Upwork RSS')
    }

    const xml = await res.text()
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

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: `Loaded ${jobs.length} Shopify jobs`
    })
  } catch (error: any) {
    console.error('RSS Jobs Error:', error)
    return NextResponse.json(
      { success: false, jobs: [], message: error.message },
      { status: 500 }
    )
  }
}
