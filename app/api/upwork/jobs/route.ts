// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching REAL jobs...', searchTerm ? `Search: "${searchTerm}"` : '');
    
    // ✅ SIMPLIFIED GraphQL query without unsupported arguments
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
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
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API error:', error.substring(0, 300));
      return { success: false, error: 'API request failed', jobs: [] };
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { success: false, error: data.errors[0]?.message, jobs: [] };
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    console.log(`✅ Found ${edges.length} job edges`);
    
    // ✅ REAL DATA format karo - NO MOCK CLIENT DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // ✅ BUDGET FORMATTING (Real)
      let budgetText = 'Budget not specified';
      if (node.amount?.rawValue) {
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
      // Try hourly rate
      else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
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
      // Fallback to displayValue
      else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue;
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal;
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`;
        }
      }
      
      // ✅ REAL SKILLS (from API)
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified'];
      
      // ✅ REAL PROPOSAL COUNT
      const realProposals = node.totalApplicants || 0;
      
      // ✅ REAL POSTED DATE
      const postedDate = node.createdDateTime || node.publishedDateTime;
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently';
      
      // ✅ REAL CATEGORY
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
        proposals: realProposals,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _debug: {
          budgetRaw: node.amount?.rawValue,
          skillsCount: realSkills.length,
          hasDescription: !!node.description
        }
      };
    });
    
    // ✅ CLIENT-SIDE FILTERING for search
    let filteredJobs = jobs;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: any[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some(skill => skill.toLowerCase().includes(searchLower)) ||
        job.category.toLowerCase().includes(searchLower)
      );
      console.log(`🔍 Filtered ${filteredJobs.length} jobs for "${searchTerm}"`);
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalFound: filteredJobs.length,
      originalCount: jobs.length,
      error: null 
    };
    
  } catch (error: any) {
    console.error('Fetch error:', error.message);
    return { success: false, error: error.message, jobs: [] };
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===');
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('User:', user.email)
    
    // ✅ GET SEARCH PARAMETER FROM URL
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    console.log('🔍 Search parameter:', search || 'No search (showing all jobs)');
    
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
    
    // ✅ PASS SEARCH TERM TO fetchUpworkJobs (for client-side filtering)
    const result = await fetchUpworkJobs(accessToken, search)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      originalCount: result.originalCount || result.jobs.length,
      message: result.success ? 
        (search 
          ? `🔍 Found ${result.totalFound} jobs for "${search}" (from ${result.originalCount} total)`
          : `✅ Loaded ${result.originalCount} real jobs from Upwork`)
        : `Error: ${result.error}`,
      upworkConnected: true,
      searchTerm: search || null
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