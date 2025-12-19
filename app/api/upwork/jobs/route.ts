import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JobItem = {
  id: string
  title: string
  description: string
  postedDate: string
  link: string
  source: 'upwork'
  isRealJob: true
}

export async function GET() {
  try {
    const keywords = [
      'web development',
      'javascript',
      'react',
      'wordpress',
      'php'
    ]

    const jobMap = new Map<string, JobItem>()

    for (const key of keywords) {
      const rssUrl =
        'https://www.upwork.com/ab/feed/jobs/rss?q=' +
        encodeURIComponent(key)

      // 🔥 RSS → JSON PROXY
      const apiUrl =
        'https://api.rss2json.com/v1/api.json?rss_url=' +
        encodeURIComponent(rssUrl)

      const res = await fetch(apiUrl)
      if (!res.ok) continue

      const json: any = await res.json()
      const items = json.items || []

      for (const item of items) {
        if (!item.link || !item.title) continue

        if (!jobMap.has(item.link)) {
          jobMap.set(item.link, {
            id: item.link,
            title: item.title,
            description: item.description || '',
            postedDate: item.pubDate || '',
            link: item.link,
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
      message: `Loaded ${jobs.length} REAL Upwork jobs`
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      message: e.message
    })
  }
}
