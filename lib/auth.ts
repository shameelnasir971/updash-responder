//lib/auth.ts

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from './database'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function createSession(userId: number): Promise<string> {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
  
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  )

  return token
}

export async function getCurrentUser() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('session-token')?.value

    if (!token) {
      console.log('❌ No token found')
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    console.log('🔍 User ID:', decoded.userId)
    
    // Get user with all fields, ensure name exists
    const result = await pool.query(
      `SELECT id, email, name, company_name, profile_photo 
       FROM users WHERE id = $1`,
      [decoded.userId]
    )
    
    if (result.rows.length === 0) {
      console.log('❌ No user found')
      return null
    }
    
    const user = result.rows[0]
    
    // ✅ Ensure name field exists
    if (!user.name) {
      console.log('⚠️ User name is empty, setting default')
      await pool.query(
        'UPDATE users SET name = $1 WHERE id = $2',
        [user.email.split('@')[0] || 'User', user.id]
      )
      user.name = user.email.split('@')[0] || 'User'
    }
    
    console.log('✅ User found:', user.email, 'Name:', user.name)
    return user
    
  } catch (error: any) {
    console.error('❌ Auth error:', error.message)
    return null
  }
}