import { NextResponse } from "next/server"

// app/api/upwork/debug/route.ts - NEW FILE FOR DEBUGGING
export async function GET() {
  const clientId = process.env.UPWORK_CLIENT_ID
  const redirectUri = process.env.UPWORK_REDIRECT_URI
  
  return NextResponse.json({
    clientId: clientId ? 'Present' : 'Missing',
    redirectUri: redirectUri,
    scopes: 'r_jobs r_mktplace_jobs r_common',
    oauthUrl: `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=r_jobs r_mktplace_jobs r_common`
  })
}