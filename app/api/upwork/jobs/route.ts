// app/api/upwork/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 300
const CATEGORY_LIST = [
  'web+development', 'mobile+development', 'design+creative',
  'writing', 'customer+service', 'sales+marketing'
]

type JobItem = {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  category: string
  source: 'upwork'
  link: string
}

const parser = new Parser()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''

    let allJobs: JobItem[] = []

    for (const cat of CATEGORY_LIST) {
      const query = search ? `${cat}+${search}` : cat
      const rssUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${query}&sort=recency`

      let feed
      try {
        feed = await parser.parseURL(rssUrl)
      } catch (e) {
        console.error('RSS Fetch Error for category', cat, e)
        continue
      }

      if (!feed?.items || !Array.isArray(feed.items)) continue

      const jobs: JobItem[] = feed.items.map(item => ({
        id: item.guid || item.link || Math.random().toString(),
        title: item.title || 'Job',
        description: item.contentSnippet || item.content || '',
        budget: 'Not specified',
        postedDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '',
        category: cat.replace(/\+/g, ' '),
        source: 'upwork',
        link: item.link || ''
      }))

      if (jobs.length > 0) allJobs.push(...jobs)
      if (allJobs.length >= MAX_JOBS) break
    }

    // Remove duplicate jobs
    const uniqueJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values())
      .slice(0, MAX_JOBS)

    return NextResponse.json({
      success: true,
      jobs: uniqueJobs,
      total: uniqueJobs.length,
      cached: false,
      upworkConnected: true,
      message: search ? `Found ${uniqueJobs.length} jobs for "${search}"` : `Loaded ${uniqueJobs.length} jobs`
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      cached: false,
      upworkConnected: true,
      message: err.message
    })
  }
}
