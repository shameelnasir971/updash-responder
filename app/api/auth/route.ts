// app/api/auth/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../../../lib/database'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ HELPER FUNCTION: Create session WITHOUT redirect
async function createSession(userId: number) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
  
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  )

  return token
}

// ✅ GET CURRENT USER WITHOUT REDIRECT
async function getCurrentUserSafe() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('session-token')?.value

    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    
    const result = await pool.query(
      'SELECT id, email, name, company_name FROM users WHERE id = $1',
      [decoded.userId]
    )
    
    return result.rows[0] || null
  } catch (error) {
    return null
  }
}

// ✅ GET: Check authentication status (NO REDIRECT)
export async function GET() {
  try {
    const user = await getCurrentUserSafe()
    
    if (!user) {
      // ❌ 401 MAT BHEJO - JSON response bhejo
      return NextResponse.json({ 
        authenticated: false,
        error: 'Not authenticated' 
      }, { status: 200 }) // ✅ STATUS 200 use karo
    }

    return NextResponse.json({
      authenticated: true,
      user: user
    })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'Internal error' 
    }, { status: 200 }) // ✅ STATUS 200
  }
}

// ✅ POST: Login/Signup (NO REDIRECT)
export async function POST(request: NextRequest) {
  try {
    const { action, email, password, name, company_name } = await request.json()

    if (!action || !email || !password) {
      return NextResponse.json({ 
        error: 'Email and password required' 
      }, { status: 400 })
    }

    // ✅ SINGLE USER CHECK
    if (action === 'signup') {
      const existingUsers = await pool.query('SELECT COUNT(*) as count FROM users')
      const userCount = parseInt(existingUsers.rows[0].count)
      
      if (userCount > 0) {
        return NextResponse.json({ 
          error: 'This application is for single user only. Please login.' 
        }, { status: 200 })
      }
    }

    if (action === 'signup') {
      if (!name) {
        return NextResponse.json({ 
          error: 'Name required' 
        }, { status: 400 })
      }

      const existingUser = await pool.query(
        'SELECT * FROM users WHERE email = $1', 
        [email.toLowerCase().trim()]
      )
      
      if (existingUser.rows.length > 0) {
        return NextResponse.json({ 
          error: 'User already exists' 
        }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(password, 12)

      const result = await pool.query(
        'INSERT INTO users (name, email, password, company_name) VALUES ($1, $2, $3, $4) RETURNING id, name, email, company_name',
        [name, email.toLowerCase().trim(), hashedPassword, company_name || '']
      )

      const user = result.rows[0]
      const token = await createSession(user.id)

      // ✅ Set cookie WITHOUT redirect
      const response = NextResponse.json({ 
        success: true,
        message: 'Account created',
        user: user
      })
      
      response.cookies.set('session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      })

      return response
    }

    if (action === 'login') {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1', 
        [email.toLowerCase().trim()]
      )
      
      if (result.rows.length === 0) {
        return NextResponse.json({ 
          error: 'Invalid email or password' 
        }, { status: 400 })
      }

      const user = result.rows[0]
      const isValidPassword = await bcrypt.compare(password, user.password)
      
      if (!isValidPassword) {
        return NextResponse.json({ 
          error: 'Invalid email or password' 
        }, { status: 400 })
      }

      const token = await createSession(user.id)

      // ✅ Set cookie WITHOUT redirect
      const response = NextResponse.json({ 
        success: true,
        message: 'Login successful',
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email,
          company_name: user.company_name
        }
      })
      
      response.cookies.set('session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      })

      return response
    }

    return NextResponse.json({ 
      error: 'Invalid action' 
    }, { status: 400 })

  } catch (error: any) {
    console.error('Auth POST error:', error.message)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// ✅ DELETE: Logout (NO REDIRECT)
export async function DELETE() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('session-token')?.value
    
    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token])
    }
    
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out' 
    })
    
    response.cookies.delete('session-token')
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ 
      error: 'Internal error' 
    }, { status: 500 })
  }
}