// app/api/upwork/jobs/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()
const MAX_JOBS = 300
const CATEGORY_LIST = ['web+development','mobile+development','design+creative','writing','customer+service','sales+marketing']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    let allJobs: any[] = []

    for (const cat of CATEGORY_LIST) {
      const query = search ? `${cat}+${search}` : cat
      const rssUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${query}&sort=recency`
      const feed = await parser.parseURL(rssUrl)

      if (!feed?.items || !Array.isArray(feed.items)) continue

      const jobs = feed.items.map((item: any) => ({
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

    // Remove duplicates
    const uniqueJobs = Array.from(new Map(allJobs.map(j => [j.id,j])).values()).slice(0, MAX_JOBS)

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
