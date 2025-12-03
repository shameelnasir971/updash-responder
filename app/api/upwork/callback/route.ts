// app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      console.error('OAuth error:', error)
      // ✅ ABSOLUTE URL USE KAREIN
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=' + encodeURIComponent(error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_authorization_code')
    }

    console.log('✅ Received authorization code:', code)
    
    // ✅ ABSOLUTE URL WITH CODE
    return NextResponse.redirect(`https://updash.shameelnasir.com/dashboard?upwork_code=${code}&success=upwork_connected`)
    
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed')
  }
}