// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching 100+ REAL jobs...');
    
    // ✅ UPDATED QUERY with FIRST 100 parameter
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(first: 100) {  // ✅ YAHAN "first: 100" ADD KARO
            edges {
              node {
                id
                title
                description
                amount { rawValue currency displayValue }
                hourlyBudgetMin { rawValue currency displayValue }
                hourlyBudgetMax { rawValue currency displayValue }
                skills { name }
                totalApplicants
                category
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `
    };
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    });
    
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API error:', error.substring(0, 300));
      return { success: false, error: 'API request failed', jobs: [] };
    }
    
    const data = await response.json();
    
    // DEBUG: Check response
    console.log('📊 API Response structure:', {
      hasData: !!data.data,
      hasSearch: !!data.data?.marketplaceJobPostingsSearch,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    });
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      // Try with smaller limit if 100 fails
      return await trySmallerLimit(accessToken);
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    console.log(`✅ Found ${edges.length} job edges`);
    
    // ✅ Format jobs (same as before, no mock data)
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // Budget formatting (same as before)
      let budgetText = 'Budget not specified';
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue);
        const currency = node.amount.currency || 'USD';
        budgetText = formatCurrency(rawValue, currency);
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0;
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal;
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD';
        budgetText = formatHourlyRate(minVal, maxVal, currency);
      }
      
      // Skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified'];
      
      // Date
      const postedDate = node.createdDateTime || node.publishedDateTime;
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently';
      
      // Category
      const category = node.category || 'General';
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        // ✅ NEUTRAL CLIENT DATA - NO FAKE NAMES
        client: {
          name: 'Upwork Client',
          rating: 0,
          country: 'Not specified',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 5),
        proposals: node.totalApplicants || 0,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _debug: {
          budgetRaw: node.amount?.rawValue,
          skillsCount: realSkills.length
        }
      };
    });
    
    console.log(`✅ Formatted ${jobs.length} REAL jobs (Target: 100+)`);
    
    // If less than 100, try pagination
    if (jobs.length < 100 && data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage) {
      console.log('🔄 Less than 100 jobs, implementing pagination...');
      const moreJobs = await fetchMoreJobs(accessToken, data.data.marketplaceJobPostingsSearch.pageInfo.endCursor);
      jobs.push(...moreJobs);
    }
    
    return { 
      success: true, 
      jobs: jobs.slice(0, 100), // Max 100 return karo
      total: jobs.length,
      error: null 
    };
    
  } catch (error: any) {
    console.error('Fetch error:', error.message);
    return { success: false, error: error.message, jobs: [] };
  }
}

// ✅ Helper function: Agar 100 fail ho to choti limit try karo
async function trySmallerLimit(accessToken: string) {
  console.log('🔄 Trying with smaller limit (50)...');
  
  const smallerQuery = {
    query: `
      query GetMarketplaceJobs {
        marketplaceJobPostingsSearch(first: 50) {  // 50 try karo
          edges {
            node {
              id
              title
              description
              amount { rawValue currency displayValue }
              skills { name }
              totalApplicants
              category
              createdDateTime
            }
          }
        }
      }
    `
  };
  
  try {
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smallerQuery)
    });
    
    const data = await response.json();
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    
    console.log(`✅ Found ${edges.length} jobs with limit 50`);
    
    // Format jobs (simplified for smaller query)
    const jobs = edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title || 'Job Title',
      description: edge.node.description || 'Job Description',
      budget: edge.node.amount?.displayValue || '$0.00',
      postedDate: 'Recently',
      client: { name: 'Upwork Client', rating: 0, country: 'Not specified', totalSpent: 0, totalHires: 0 },
      skills: edge.node.skills?.map((s: any) => s.name).slice(0, 3) || [],
      proposals: edge.node.totalApplicants || 0,
      verified: true,
      category: 'General',
      source: 'upwork',
      isRealJob: true
    }));
    
    return { success: true, jobs: jobs, error: null };
    
  } catch (error: any) {
    return { success: false, error: 'Failed with smaller limit too', jobs: [] };
  }
}

// ✅ Pagination ke liye extra jobs fetch karo
async function fetchMoreJobs(accessToken: string, cursor: string) {
  try {
    const paginationQuery = {
      query: `
        query GetMoreJobs {
          marketplaceJobPostingsSearch(first: 50, after: "${cursor}") {
            edges {
              node {
                id
                title
                description
                amount { displayValue }
                skills { name }
              }
            }
          }
        }
      `
    };
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paginationQuery)
    });
    
    const data = await response.json();
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    
    return edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title || 'Job Title',
      description: edge.node.description || 'Job Description',
      budget: edge.node.amount?.displayValue || '$0.00',
      postedDate: 'Recently',
      client: { name: 'Upwork Client', rating: 0, country: 'Not specified', totalSpent: 0, totalHires: 0 },
      skills: edge.node.skills?.map((s: any) => s.name).slice(0, 3) || [],
      proposals: 0,
      verified: true,
      category: 'General',
      source: 'upwork',
      isRealJob: true
    }));
    
  } catch (error) {
    return [];
  }
}

// Helper functions for formatting
function formatCurrency(value: number, currency: string): string {
  const symbols: { [key: string]: string } = { 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${value.toFixed(2)}`;
}

function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbols: { [key: string]: string } = { 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const symbol = symbols[currency] || currency + ' ';
  if (min === max || max === 0) return `${symbol}${min.toFixed(2)}/hr`;
  return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`;
}

export async function GET() {
  try {
    console.log('=== JOBS API: UPDATED BUDGET VERSION ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('User:', user.email)
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    const result = await fetchUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} jobs with properly formatted budgets` : 
        `Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.success ? 'Real budgets with proper currency formatting' : 'Fix needed'
    })
    
  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}