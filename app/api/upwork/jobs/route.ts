// app/api/upwork/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
import { XMLParser } from 'fast-xml-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 min
const MAX_JOBS = 100

const cache: Record<string, { jobs: any[]; time: number }> = {}

const DEFAULT_KEYWORDS = [
  'web development',
  'react',
  'next.js',
  'shopify',
  'wordpress',
  'ui ux',
]

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.toLowerCase() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    // Upwork connected?
    const tokenRes = await pool.query(
      'SELECT 1 FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        upworkConnected: false,
        message: 'Upwork not connected',
      })
    }

    // CACHE
    if (
      !refresh &&
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].time < CACHE_TTL
    ) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded jobs from cache',
      })
    }

    const keywords = search ? [search] : DEFAULT_KEYWORDS
    const jobMap = new Map<string, any>()
    const parser = new XMLParser()

    for (const keyword of keywords) {
      const rssUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(
        keyword
      )}`

      const res = await fetch(rssUrl)
      const xml = await res.text()
      const json = parser.parse(xml)

      const items = json?.rss?.channel?.item || []

      for (const item of items) {
        const id = item.guid
        if (!id || jobMap.has(id)) continue

        jobMap.set(id, {
          id,
          title: item.title,
          description: item.description || '',
          budget: 'Check Upwork',
          postedDate: item.pubDate
            ? new Date(item.pubDate).toLocaleDateString()
            : '',
          proposals: 0,
          category: 'Upwork',
          skills: [],
          verified: true,
          source: 'upwork',
          isRealJob: true,
        })

        if (jobMap.size >= MAX_JOBS) break
      }

      if (jobMap.size >= MAX_JOBS) break
    }

    const jobs = Array.from(jobMap.values())

    cache[cacheKey] = {
      jobs,
      time: Date.now(),
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      upworkConnected: true,
      message: `Loaded ${jobs.length} jobs`,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e.message },
      { status: 500 }
    )
  }
}
