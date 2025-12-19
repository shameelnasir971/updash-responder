import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JobItem = {
  id: string
  title: string
  description: string
  postedDate: string
  category: string
  source: 'upwork'
  isRealJob: true
  link: string
}

// helper
function getTag(xml: string, tag: string) {
  const m = xml.match(
    new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, 's')
  )
  return m ? m[1].trim() : ''
}

export async function GET() {
  try {
    const KEYWORDS = [
      'web development',
      'javascript',
      'react',
      'wordpress',
      'php',
      'python',
      'mobile app',
      'frontend',
      'backend'
    ]

    const jobMap = new Map<string, JobItem>()

    for (const keyword of KEYWORDS) {
      const rssUrl =
        'https://www.upwork.com/ab/feed/jobs/rss?q=' +
        encodeURIComponent(keyword)

      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })

      if (!res.ok) continue

      const xml = await res.text()
      const items = xml.split('<item>').slice(1)

      for (const item of items) {
        const title = getTag(item, 'title')
        const link = getTag(item, 'link')
        const description = getTag(item, 'description')
        const pubDate = getTag(item, 'pubDate')

        if (!title || !link) continue

        const id = link.split('/').pop() || link

        if (!jobMap.has(id)) {
          jobMap.set(id, {
            id,
            title,
            description,
            postedDate: pubDate,
            category: keyword,
            source: 'upwork',
            isRealJob: true,
            link
          })
        }
      }
    }

    const jobs = Array.from(jobMap.values())

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      message: `Loaded ${jobs.length} REAL Upwork jobs`
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
