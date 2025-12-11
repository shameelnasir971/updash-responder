import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork token' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Discover what fields are available on SEARCH RESULT node
    const discoveryQuery = {
      query: `{
        __type(name: "MarketplaceJobPostingSearchResult") {
          name
          fields {
            name
            type {
              name
              kind
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