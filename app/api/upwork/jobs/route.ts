import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extract(xml: string, tag: string) {
  const r = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, 's')
  const m = xml.match(r)
  return m ? m[1] : ''
}

export async function GET() {
  try {
    const keywords = [
      'web',
      'javascript',
      'react',
      'wordpress',
      'php'
    ]

    const jobs: any[] = []
    const seen = new Set<string>()

    for (const key of keywords) {
      const url =
        'https://www.upwork.com/ab/feed/jobs/rss?q=' +
        encodeURIComponent(key)

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/rss+xml'
        }
      })

      if (!res.ok) continue

      const xml = await res.text()
      const items = xml.split('<item>').slice(1)

      for (const item of items) {
        const title = extract(item, 'title')
        const link = extract(item, 'link')
        const desc = extract(item, 'description')
        const date = extract(item, 'pubDate')

        if (!title || !link) continue
        if (seen.has(link)) continue

        seen.add(link)

        jobs.push({
          id: link,
          title,
          description: desc,
          postedDate: date,
          source: 'upwork',
          isRealJob: true,
          link
        })
      }
    }

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
