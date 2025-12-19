import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import pool from '../../../../lib/database'
import { getCurrentUser } from '../../../../lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 50

const cache: Record<string, { jobs: any[]; time: number }> = {}

const DEFAULT_KEYWORDS = [
  'web development',
  'react',
  'next js',
  'javascript',
  'shopify',
  'wordpress',
]

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    // 🔐 check upwork connected
    const tokenCheck = await pool.query(
      'SELECT 1 FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenCheck.rowCount === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        upworkConnected: false,
        message: 'Upwork not connected',
      })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const refresh = searchParams.get('refresh') === 'true'

    const cacheKey = search || '__ALL__'

    // ✅ CACHE
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
    const parser = new XMLParser({ ignoreAttributes: false })
    const jobMap = new Map<string, any>()

    for (const keyword of keywords) {
      const rssUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(
        keyword
      )}`

      const res = await fetch(rssUrl, {
        headers: {
          // 🔥 THIS IS THE KEY FIX
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UpDashBot/1.0',
          Accept: 'application/rss+xml,application/xml',
        },
        cache: 'no-store',
      })

      if (!res.ok) continue

      const xml = await res.text()
      if (!xml.includes('<item>')) continue

      const json = parser.parse(xml)
      const items = json?.rss?.channel?.item || []

      for (const item of items) {
        const id = item.guid || item.link
        if (!id || jobMap.has(id)) continue

        jobMap.set(id, {
          id,
          title: item.title || 'Untitled Job',
          description: item.description || '',
          budget: 'Check on Upwork',
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}
