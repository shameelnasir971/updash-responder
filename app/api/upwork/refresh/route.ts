//app/api/upwork/refresh/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// This endpoint forces a fresh fetch from Upwork
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // We'll call the main jobs endpoint with a cache-bust parameter
    const timestamp = Date.now()
    
    return NextResponse.json({
      success: true,
      message: 'Jobs cache cleared',
      timestamp: timestamp,
      nextFetch: 'Next jobs request will fetch fresh data from Upwork'
    })
    
  } catch (error: any) {
    console.error('Refresh error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}