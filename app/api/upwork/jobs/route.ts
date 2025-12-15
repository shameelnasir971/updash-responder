// app/api/upwork/jobs/route.ts - ADVANCED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache for faster response (optional)
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60 * 1000 // 1 minute cache

// ✅ Function to fetch ALL jobs from Upwork with pagination
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching ALL jobs from Upwork...');
    
    // ✅ SIMPLE but effective GraphQL query
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
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
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
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || edges.length;
    const hasNextPage = data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false;
    
    console.log(`✅ Found ${edges.length} jobs (Total in Upwork: ${totalCount})`);
    
    // ✅ REAL DATA format karo
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // ✅ BUDGET FORMATTING
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
      else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue;
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal;
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`;
        }
      }
      
      // ✅ REAL SKILLS
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
        // ✅ NEUTRAL CLIENT DATA
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
        postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now(),
        _debug: {
          budgetRaw: node.amount?.rawValue,
          skillsCount: realSkills.length,
          hasDescription: !!node.description
        }
      };
    });
    
    // ✅ Sort by latest first
    jobs.sort((a: any, b: any) => b.postedTimestamp - a.postedTimestamp);
    
    // ✅ Apply search filter if provided
    let filteredJobs = jobs;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      );
      console.log(`🔍 Filtered ${filteredJobs.length} jobs for "${searchTerm}"`);
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalFound: filteredJobs.length,
      totalCount: totalCount,
      hasNextPage: hasNextPage,
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
    
    // ✅ Get parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const forceRefresh = searchParams.get('refresh') === 'true';
    console.log('🔍 Search parameter:', search || 'No search');
    console.log('🔄 Force refresh:', forceRefresh);
    
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
    
    // ✅ Use cache if available and not forced refresh
    const now = Date.now();
    if (!forceRefresh && jobsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...');
      
      // Apply search filter to cached jobs
      let cachedJobs = jobsCache;
      if (search) {
        const searchLower = search.toLowerCase();
        cachedJobs = jobsCache.filter((job: any) => 
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
        );
      }
      
      return NextResponse.json({
        success: true,
        jobs: cachedJobs,
        total: cachedJobs.length,
        totalCount: cachedJobs.length,
        message: search 
          ? `🔍 Found ${cachedJobs.length} jobs for "${search}" (from cache)`
          : `✅ ${cachedJobs.length} jobs loaded (from cache)`,
        upworkConnected: true,
        searchTerm: search || null,
        cached: true
      })
    }
    
    // ✅ Fetch fresh data from Upwork
    console.log('🔄 Fetching fresh data from Upwork...');
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    // ✅ Update cache
    if (result.success && !search) {
      jobsCache = result.jobs;
      cacheTimestamp = now;
      console.log('💾 Updated cache with', result.jobs.length, 'jobs');
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      totalCount: result.totalCount || result.jobs.length,
      message: result.success ? 
        (search 
          ? `🔍 Found ${result.totalFound} jobs for "${search}"`
          : `✅ Loaded ${result.totalFound} real jobs from Upwork (${result.totalCount} total)`
        ) : `Error: ${result.error}`,
      upworkConnected: true,
      searchTerm: search || null,
      cached: false,
      hasMore: result.hasNextPage || false
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

// ✅ NEW: Webhook for real-time updates (optional)
export async function POST(request: NextRequest) {
  try {
    // This would be called by a scheduled job or webhook
    // For now, just clear cache to force refresh
    jobsCache = null;
    cacheTimestamp = 0;
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared, next request will fetch fresh data'
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: 'Error: ' + error.message
    }, { status: 500 })
  }
}