import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result: any = {
    step1_basicInternet: null,
    step2_upworkRSS: null,
    step3_rss2json: null,
    errors: []
  }

  // 🔹 STEP 1: Basic internet test
  try {
    const r1 = await fetch('https://example.com')
    result.step1_basicInternet = {
      ok: r1.ok,
      status: r1.status
    }
  } catch (e: any) {
    result.step1_basicInternet = 'FAILED'
    result.errors.push('No basic internet access')
  }

  // 🔹 STEP 2: Direct Upwork RSS
  try {
    const rssUrl =
      'https://www.upwork.com/ab/feed/jobs/rss?q=web'

    const r2 = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml'
      }
    })

    const text = await r2.text()

    result.step2_upworkRSS = {
      ok: r2.ok,
      status: r2.status,
      length: text.length,
      preview: text.slice(0, 200)
    }
  } catch (e: any) {
    result.step2_upworkRSS = 'FAILED'
    result.errors.push('Upwork RSS blocked')
  }

  // 🔹 STEP 3: RSS → JSON proxy
  try {
    const proxyUrl =
      'https://api.rss2json.com/v1/api.json?rss_url=' +
      encodeURIComponent(
        'https://www.upwork.com/ab/feed/jobs/rss?q=web'
      )

    const r3 = await fetch(proxyUrl)
    const json = await r3.json()

    result.step3_rss2json = {
      ok: r3.ok,
      status: r3.status,
      itemCount: Array.isArray(json.items)
        ? json.items.length
        : 0,
      firstItemTitle: json.items?.[0]?.title || null
    }
  } catch (e: any) {
    result.step3_rss2json = 'FAILED'
    result.errors.push('rss2json blocked')
  }

  return NextResponse.json(result)
}
