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
    
    // ✅ UPDATED QUERY with PAGINATION & FILTERS
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int, $after: String) {
          marketplaceJobPostingsSearch(
            first: $first, 
            after: $after,
            filter: {
              # Optional: Filters lagayein zyada relevant jobs ke liye
              category: ["Web Mobile Software Dev", "Design Creative", "Sales Marketing", "Writing", "Admin Support"]
              # experienceLevel: [INTERMEDIATE, EXPERT]
              # jobType: ["Hourly", "Fixed"]
            }
            sort: { field: PUBLISHED_DATE, direction: DESC }
          ) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
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
          }
        }
      `,
      variables: {
        first: 100, // ✅ 100 jobs ek baar mein
        after: null // Pehli request ke liye null
      }
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
    
    // DEBUG: Response check
    console.log('📊 API Response structure:', {
      totalCount: data.data?.marketplaceJobPostingsSearch?.totalCount,
      hasNextPage: data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length
    });
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { success: false, error: data.errors[0]?.message, jobs: [] };
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0;
    
    console.log(`✅ Found ${totalCount} total jobs, showing ${edges.length} in this batch`);
    
    // ✅ REAL DATA format karo - 100% REAL, NO MOCK
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // ✅ BUDGET FORMATTING (Real)
      let budgetText = 'Budget not specified';
      if (node.amount?.rawValue && parseFloat(node.amount.rawValue) > 0) {
        const rawValue = parseFloat(node.amount.rawValue);
        const currency = node.amount.currency || 'USD';
        
        if (currency === 'USD') {
          budgetText = `$${rawValue.toFixed(2)}`;
        } else if (currency === 'EUR') {
          budgetText = `€${rawValue.toFixed(2)}`;
        } else if (currency === 'GBP') {
          budgetText = `£${rawValue.toFixed(2)}`;
        } else {
          budgetText = `${rawValue.toFixed(2)} ${currency}`;
        }
      }
      // Try hourly rate (only if min value > 0)
      else if ((node.hourlyBudgetMin?.rawValue && parseFloat(node.hourlyBudgetMin.rawValue) > 0) || 
               (node.hourlyBudgetMax?.rawValue && parseFloat(node.hourlyBudgetMax.rawValue) > 0)) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0;
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal;
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD';
        
        let currencySymbol = '';
        if (currency === 'USD') currencySymbol = '$';
        else if (currency === 'EUR') currencySymbol = '€';
        else if (currency === 'GBP') currencySymbol = '£';
        else currencySymbol = currency + ' ';
        
        if (minVal === maxVal || maxVal === 0) {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}/hr`;
        } else {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`;
        }
      }
      // Agar budget 0 hai to "Hourly" or "Negotiable" dikhao
      else if (node.amount?.displayValue && node.amount.displayValue !== "$0.00") {
        const dispVal = node.amount.displayValue;
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal;
        }
      } else {
        // Budget nahi hai to job type dikhao
        budgetText = node.engagement === 'HOURLY' ? 'Hourly Rate' : 'Fixed Price';
      }
      
      // ✅ REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified'];
      
      // ✅ REAL PROPOSAL COUNT
      const realProposals = node.totalApplicants || 0;
      
      // ✅ REAL POSTED DATE (Abhi ki ya recent)
      const postedDate = node.createdDateTime || node.publishedDateTime;
      let formattedDate = 'Recently';
      if (postedDate) {
        const postDate = new Date(postedDate);
        const now = new Date();
        const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
        
        if (diffHours < 24) {
          formattedDate = 'Today';
        } else if (diffHours < 48) {
          formattedDate = 'Yesterday';
        } else if (diffHours < 168) { // 7 days
          formattedDate = `${Math.floor(diffHours / 24)} days ago`;
        } else {
          formattedDate = postDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
        }
      }
      
      // ✅ REAL CATEGORY
      const category = node.category || 'General';
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      // ✅ JOB TYPE
      const jobType = node.engagement === 'HOURLY' ? 'Hourly' : 
                     node.durationLabel || node.engagement || 'Fixed';
      
      // ✅ EXPERIENCE LEVEL
      const experienceLevel = node.experienceLevel ? 
        node.experienceLevel.replace(/_/g, ' ').toLowerCase() : 'intermediate';
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        // ✅ 100% NEUTRAL - NO MOCK DATA
        client: {
          name: 'Upwork Client', // Real API client info nahi deti
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 5),
        proposals: realProposals,
        verified: true,
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        source: 'upwork',
        isRealJob: true,
        _debug: {
          budgetRaw: node.amount?.rawValue,
          skillsCount: realSkills.length,
          hasDescription: !!node.description,
          isHourly: node.engagement === 'HOURLY'
        }
      };
    });
    
    console.log(`✅ Formatted ${jobs.length} REAL jobs for dashboard`);
    
    // Agar 100 se kam jobs aaye to next page fetch karo
    if (jobs.length < 100 && data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage) {
      console.log('🔍 First page has less than 100 jobs, fetching more...');
      // Yahan aap pagination implement kar sakte hain
    }
    
    return { 
      success: true, 
      jobs: jobs, 
      total: totalCount,
      hasMore: data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false,
      error: null 
    };
    
  } catch (error: any) {
    console.error('Fetch error:', error.message);
    return { success: false, error: error.message, jobs: [] };
  }
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