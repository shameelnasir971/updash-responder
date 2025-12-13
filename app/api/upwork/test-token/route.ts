import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork connection' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Minimal working query
    const testQuery = {
      query: `
        query QuickTest {
          marketplaceJobPostingsSearch {
            totalCount
            edges {
              node {
                id
                title
                amount {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                }
                client {
                  displayName
                }
              }
            }
          }
        }
      `
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      queryWorks: !data.errors,
      totalJobs: data.data?.marketplaceJobPostingsSearch?.totalCount,
      sampleJob: data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node,
      availableFields: data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node ? 
        Object.keys(data.data.marketplaceJobPostingsSearch.edges[0].node) : []
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      success: false
    })
  }
}