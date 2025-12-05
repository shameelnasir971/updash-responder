// app/api/upwork/callback/route.ts - COMPLETE FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error from Upwork:', error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=oauth_failed&reason=${error}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=no_auth_code`
      );
    }

    // ✅ 1. Retrieve the PKCE code verifier from the cookie
    const codeVerifier = request.cookies.get('upwork_code_verifier')?.value;
    if (!codeVerifier) {
      throw new Error('PKCE code verifier missing. Auth session may have expired.');
    }

    const clientId = process.env.UPWORK_CLIENT_ID;
    const clientSecret = process.env.UPWORK_CLIENT_SECRET;
    const redirectUri = process.env.UPWORK_REDIRECT_URI;

    // ✅ 2. Prepare the token request with parameters in the BODY
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);
    params.append('client_id', clientId!);
    params.append('code_verifier', codeVerifier); // PKCE parameter

    // ✅ 3. Make the token request - Scopes are implicitly granted from app settings
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    const tokenData = await tokenResponse.json();
    console.log('Token exchange response:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token error details:', tokenData);
      throw new Error(`Upwork token exchange failed: ${tokenData.error || tokenResponse.status}`);
    }

    // ✅ 4. Get the first user from DB and save the tokens
    const users = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = users.rows[0]?.id;

    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2, 
         refresh_token = $3,
         updated_at = NOW()`,
      [userId, tokenData.access_token, tokenData.refresh_token || '']
    );

    console.log('✅ Upwork account connected successfully for user:', userId);

    // ✅ 5. Redirect back to dashboard with success
    const redirectUrl = new URL(`${process.env.NEXTAUTH_URL}/dashboard`);
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('message', 'Upwork connected! Fetching jobs...');
    
    const response = NextResponse.redirect(redirectUrl.toString());
    // Clear the PKCE cookie after use
    response.cookies.delete('upwork_code_verifier');
    
    return response;

  } catch (error: any) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=${encodeURIComponent(error.message || 'callback_failed')}`
    );
  }
}