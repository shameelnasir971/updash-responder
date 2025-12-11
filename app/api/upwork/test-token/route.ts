import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No token' })
    }
    
    const token = result.rows[0].access_token
    
    // SUPER SIMPLE QUERY
    const query = {
      query: `{
        marketplaceJobPostingsSearch(input: {paging: {first: 5}}) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query)
    })
    
    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message })
  }
}