import pool from "@/lib/database"
import { NextResponse } from "next/server"

// app/api/upwork/test/route.ts - NEW FILE
export async function GET() {
  try {
    // Get user's Upwork token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Upwork account connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Test simple GraphQL query
    const testQuery = {
      query: `{
        graphql {
          jobs {
            search(first: 5) {
              totalCount
            }
          }
        }
      }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      totalJobs: data.data?.graphql?.jobs?.search?.totalCount || 0,
      response: data,
      tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'No token'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}