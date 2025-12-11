import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    // 1. Token lo database se
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork token' })
    }
    const accessToken = result.rows[0].access_token

    // 2. Schema discovery query bhejo
    const discoveryQuery = {
      query: `{
        __type(name: "JobPosting") {
          name
          fields {
            name
            type {
              name
              kind
              ofType { name kind }
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