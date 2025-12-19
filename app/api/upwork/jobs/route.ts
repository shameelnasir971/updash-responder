import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

// Simple XML helpers
function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, 's'))
  return match ? match[1] : ''
}

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
          'User-Agent': 'Mozilla/5.0'
        }
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
            budget: 'Check job',
            postedDate: pubDate,
            proposals: 0,
            category: keyword,
            skills: [],
            verified: true,
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
      message: `Loaded ${jobs.length} REAL Upwork jobs via RSS`
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}
