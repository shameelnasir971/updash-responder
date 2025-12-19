import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Job type
type JobItem = {
  id: string
  title: string
  description: string
  link: string
  category: string
  postedDate: string
  source: 'upwork'
  isRealJob: true
}

// Helper function to parse CDATA from XML
function getCDATA(tag: string, xml: string) {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, 's')
  const match = xml.match(regex)
  return match ? match[1] : ''
}

// API route
export async function GET() {
  try {
    const keywords = [
      'web development',
      'javascript',
      'react',
      'wordpress',
      'php',
      'python',
      'mobile app',
      'frontend'
    ]

    const jobMap = new Map<string, JobItem>()

    for (const keyword of keywords) {
      const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(keyword)}`

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/rss+xml, application/xml'
        }
      })
      if (!res.ok) continue

      const xml = await res.text()
      const items = xml.split('<item>').slice(1) // ignore first part

      for (const item of items) {
        const title = getCDATA('title', item)
        const link = getCDATA('link', item)
        const description = getCDATA('description', item)
        const pubDate = getCDATA('pubDate', item)

        if (!title || !link) continue

        const id = link.split('/').pop() || link
        if (!jobMap.has(id)) {
          jobMap.set(id, {
            id,
            title,
            description,
            link,
            category: keyword,
            postedDate: pubDate,
            source: 'upwork',
            isRealJob: true
          })
        }
      }
    }

    const jobs = Array.from(jobMap.values())

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      message: `Loaded ${jobs.length} REAL Upwork jobs via RSS`
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
