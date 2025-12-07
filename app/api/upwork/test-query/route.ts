// app/api/upwork/test-query/route.ts - NEW FILE (Create this)
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ error: 'No token' })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Test 1: Simple query to see if API responds
    const testQueries = [
      {
        name: 'Test 1 - Simple Query',
        query: `{ __typename }`
      },
      {
        name: 'Test 2 - Job Search',
        query: `{ jobs { search(first: 5) { edges { node { title } } } } }`
      },
      {
        name: 'Test 3 - Marketplace Query',
        query: `{ marketplace { jobPostings { search(first: 5) { edges { node { title } } } } } }`
      },
      {
        name: 'Test 4 - Find Jobs',
        query: `{ findJobs(input: {limit: 5}) { jobs { title } } }`
      }
    ]
    
    const results = []
    
    for (const test of testQueries) {
      try {
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: test.query })
        })
        
        const data = await response.json()
        results.push({
          name: test.name,
          status: response.status,
          ok: response.ok,
          errors: data.errors,
          data: data.data
        })
      } catch (error: any) {
        results.push({
          name: test.name,
          error: error.message
        })
      }
    }
    
    return NextResponse.json({
      tokenPresent: true,
      tokenPreview: accessToken.substring(0, 30) + '...',
      results
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    })
  }
}