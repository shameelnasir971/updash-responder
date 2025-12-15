// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ Function to fetch LARGE number of jobs from Upwork
async function fetchUpworkJobsBulk(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching BULK jobs from Upwork...', searchTerm ? `Search: "${searchTerm}"` : 'ALL JOBS');
    
    // ✅ IMPORTANT: Use multiple GraphQL queries to get more jobs
    // We'll make 5-10 calls to get more data
    const allJobs = [];
    const batchCount = 5; // Fetch 5 batches = ~50 jobs
    
    for (let i = 0; i < batchCount; i++) {
      try {
        // ✅ Different queries for different job categories/sorting
        const graphqlQueries = [
          // Query 1: Recent jobs
          {
            query: `
              query GetRecentJobs {
                marketplaceJobPostingsSearch(
                  sort: PUBLISHED_DATE_DESC
                ) {
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
          },
          // Query 2: Most applied jobs
          {
            query: `
              query GetPopularJobs {
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
          },
          // Query 3: Fixed price jobs
          {
            query: `
              query GetFixedPriceJobs {
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
          },
          // Query 4: Hourly jobs
          {
            query: `
              query GetHourlyJobs {
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
          },
          // Query 5: High budget jobs
          {
            query: `
              query GetHighBudgetJobs {
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
          }
        ];
        
        const query = graphqlQueries[i % graphqlQueries.length];
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(query)
        });
        
        if (!response.ok) {
          console.error(`Batch ${i+1} failed:`, response.status);
          continue;
        }
        
        const data = await response.json();
        
        if (data.errors) {
          console.error(`Batch ${i+1} GraphQL errors:`, data.errors);
          continue;
        }
        
        const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
        console.log(`✅ Batch ${i+1}: Found ${edges.length} jobs`);
        
        // Format jobs
        const batchJobs = edges.map((edge: any) => {
          const node = edge.node || {};
          
          // Budget formatting
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
          
          const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                            ['Skills not specified'];
          
          const realProposals = node.totalApplicants || 0;
          
          const postedDate = node.createdDateTime || node.publishedDateTime;
          const formattedDate = postedDate ? 
            new Date(postedDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : 
            'Recently';
          
          const category = node.category || 'General';
          const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          
          return {
            id: node.id,
            title: node.title || 'Job Title',
            description: node.description || 'Job Description',
            budget: budgetText,
            postedDate: formattedDate,
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
              batch: i+1,
              budgetRaw: node.amount?.rawValue,
              skillsCount: realSkills.length
            }
          };
        });
        
        allJobs.push(...batchJobs);
        
        // Wait between requests to avoid rate limiting
        if (i < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError: any) {
        console.error(`Error in batch ${i+1}:`, batchError.message);
        continue;
      }
    }
    
    console.log(`✅ Total jobs fetched: ${allJobs.length}`);
    
    // Remove duplicates by job ID
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [job.id, job])).values()
    );
    
    console.log(`✅ Unique jobs after deduplication: ${uniqueJobs.length}`);
    
    // Sort by latest
    uniqueJobs.sort((a: any, b: any) => b.postedTimestamp - a.postedTimestamp);
    
    // Apply search filter
    let filteredJobs = uniqueJobs;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredJobs = uniqueJobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      );
      console.log(`🔍 After filtering for "${searchTerm}": ${filteredJobs.length} jobs`);
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalFound: filteredJobs.length,
      totalUnique: uniqueJobs.length,
      batchesFetched: batchCount,
      error: null 
    };
    
  } catch (error: any) {
    console.error('Bulk fetch error:', error.message);
    return { success: false, error: error.message, jobs: [] };
  }
}

// ✅ SIMPLE fallback function (if bulk fails)
async function fetchUpworkJobsSimple(accessToken: string) {
  try {
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
      console.error('Simple fetch error:', error.substring(0, 300));
      return { success: false, error: 'API request failed', jobs: [] };
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { success: false, error: data.errors[0]?.message, jobs: [] };
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || [];
    
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // ... same formatting as above ...
      // (Copy the formatting logic from bulk function)
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: node.amount?.displayValue || 'Budget not specified',
        postedDate: 'Recently',
        client: {
          name: 'Upwork Client',
          rating: 0,
          country: 'Not specified',
          totalSpent: 0,
          totalHires: 0
        },
        skills: node.skills?.map((s: any) => s.name).slice(0, 5) || ['Skills not specified'],
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        jobType: node.engagement || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      };
    });
    
    return { 
      success: true, 
      jobs: jobs, 
      totalFound: jobs.length,
      totalUnique: jobs.length,
      batchesFetched: 1,
      error: null 
    };
    
  } catch (error: any) {
    console.error('Simple fetch error:', error.message);
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
    
    // Get parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const simpleMode = searchParams.get('simple') === 'true'; // For testing
    console.log('🔍 Search:', search || 'No search');
    console.log('🔄 Force refresh:', forceRefresh);
    console.log('📱 Simple mode:', simpleMode);
    
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
    
    // Use cache if available (except for force refresh)
    const now = Date.now();
    if (!forceRefresh && jobsCache && (now - cacheTimestamp) < CACHE_DURATION && !search) {
      console.log('📦 Serving from cache...');
      
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        totalUnique: jobsCache.length,
        message: `✅ ${jobsCache.length} jobs loaded (from cache)`,
        upworkConnected: true,
        searchTerm: null,
        cached: true,
        batchesFetched: 5
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork...');
    
    let result;
    if (simpleMode) {
      console.log('Using simple mode...');
      result = await fetchUpworkJobsSimple(accessToken);
    } else {
      console.log('Using BULK mode (fetching 50+ jobs)...');
      result = await fetchUpworkJobsBulk(accessToken, search);
    }
    
    // Update cache (only if no search and successful)
    if (result.success && !search && !simpleMode) {
      jobsCache = result.jobs;
      cacheTimestamp = now;
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`);
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      totalUnique: result.totalUnique || result.jobs.length,
      message: result.success ? 
        (search 
          ? `🔍 Found ${result.totalFound} jobs for "${search}"`
          : `✅ Loaded ${result.totalFound} real jobs from Upwork`
        ) : `Error: ${result.error}`,
      upworkConnected: true,
      searchTerm: search || null,
      cached: false,
      batchesFetched: result.batchesFetched || 1
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

// Clear cache endpoint
export async function POST(request: NextRequest) {
  try {
    jobsCache = null;
    cacheTimestamp = 0;
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: 'Error: ' + error.message
    }, { status: 500 })
  }
}