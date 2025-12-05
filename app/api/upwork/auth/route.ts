// app/api/upwork/auth/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const clientId = process.env.UPWORK_CLIENT_ID;
    const redirectUri = process.env.UPWORK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { success: false, error: 'Upwork API not configured' },
        { status: 500 }
      );
    }

    // ✅ 1. Generate PKCE Code Verifier & Challenge (for security)
    const codeVerifier = crypto.randomBytes(96).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // ✅ 2. Store the verifier in a secure, HTTP-only cookie for the callback
    const response = NextResponse.json({
      success: true,
      url: `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`
    });

    response.cookies.set({
      name: 'upwork_code_verifier',
      value: codeVerifier,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Auth endpoint error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}