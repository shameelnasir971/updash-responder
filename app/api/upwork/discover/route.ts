// NAYA FILE: /app/api/upwork/discover/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    // Get token
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork token' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Schema discovery query
    const discoveryQuery = {
      query: `{
        __schema {
          queryType {
            fields {
              name
              description
              args {
                name
                type {
                  name
                }
              }
              type {
                name
                fields {
                  name
                  type {
                    name
                  }
                }
              }
            }
          }
        }
      }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discoveryQuery)
    })
    
    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message })
  }
}