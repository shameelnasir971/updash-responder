// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ UPDATED CODE - MOCK CLIENT DATA HATA DO
async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL jobs with REAL client data...');
    
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
                # ✅ Client related fields agar available hain to use karo
                client { 
                  id
                  # firstName aur lastName fields bhi check karo
                  # rating (agar available ho)
                }
                clientActivity { 
                  totalSpent
                  totalHired
                  totalPosted
                }
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
    console.log(`✅ Found ${edges.length} job edges with real data`);
    
    // ✅ REAL DATA ke saath format karo, MOCK DATA banane se bacho
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {};
      
      // ✅ BUDGET FORMATTING (Real)
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
      } else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue;
      }
      
      // ✅ REAL CLIENT DATA - FAKE NAMES BANANE SE BACHO
      // Agar API se client ka naam aata hai to use karo, nahi to simple placeholder
      let clientName = 'Client';
      // GraphQL response ke structure ke mutabiq check karo
      if (node.client?.firstName && node.client?.lastName) {
        clientName = `${node.client.firstName} ${node.client.lastName}`;
      } else if (node.client?.id) {
        // Ya to client ID se koi logical naam banao, ya fir "Client" hi rahne do
        clientName = `Client ${node.client.id.substring(0, 8)}`;
      }
      
      // ✅ REAL CLIENT ACTIVITY (Agar API se aaye to)
      const clientActivity = node.clientActivity || {};
      const totalSpent = clientActivity.totalSpent || 0;
      const totalHires = clientActivity.totalHired || clientActivity.totalHired || 0;
      
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
      
      // ❌❌❌ YEH PURA FAKE CLIENT OBJECT HATA DO ❌❌❌
      // Iski jagah sirf REAL data use karo
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        // ✅ SIRF REAL YA LOGICAL CLIENT DATA
        client: {
          name: clientName, // REAL ya logical naam
          rating: 0, // Default 0, agar API se rating aaye to use karo
          country: 'Not specified', // Default, agar API se country aaye to use karo
          totalSpent: totalSpent, // REAL data from API
          totalHires: totalHires  // REAL data from API
        },
        skills: realSkills.slice(0, 5),
        proposals: realProposals,
        verified: true, // Yeh bhi API se aana chahiye
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _debug: {
          budgetRaw: node.amount?.rawValue,
          clientId: node.client?.id,
          hasRealClientData: !!node.client
        }
      };
    });
    
    console.log(`✅ Formatted ${jobs.length} jobs with REAL client data`);
    
    return { success: true, jobs: jobs, error: null };
    
  } catch (error: any) {
    console.error('Fetch error:', error.message);
    return { success: false, error: error.message, jobs: [] };
  }
}

// Helper functions for formatting
function formatCurrency(value: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£'
  };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${value.toFixed(2)}`;
}

function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£'
  };
  const symbol = symbols[currency] || currency + ' ';
  if (min === max || max === 0) {
    return `${symbol}${min.toFixed(2)}/hr`;
  } else {
    return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`;
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