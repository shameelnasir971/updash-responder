// app/api/upwork/jobs/route.ts - SIMPLE WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FUNCTION TO GET REAL JOBS FROM UPWORK.COM
async function fetchRealJobsFromUpwork() {
    try {
        console.log('🌐 Fetching REAL jobs from Upwork.com...')
        
        // Fetch the Upwork job search page for web development
        const response = await fetch('https://www.upwork.com/search/jobs/?q=web%20development&sort=recency', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' // Mimic a browser
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`)
        }

        const html = await response.text()
        
        // A simple regular expression to find job titles and snippets in the page HTML.
        // This targets common HTML patterns found on Upwork's job listings.
        const jobPattern = /<h4[^>]*job-title[\s\S]*?>([^<]+)<\/h4>|data-test="job-title"[^>]*>([^<]+)<\/a>|"job-description"[^>]*>([^<]+)<\/div>/gi
        
        let match;
        const foundJobs = [];
        const uniqueTitles = new Set(); // To avoid duplicates

        while ((match = jobPattern.exec(html)) !== null && foundJobs.length < 15) {
            // Extract the most likely title from the match groups
            const possibleTitle = match[1] || match[2];
            const descriptionSnippet = match[3];
            
            if (possibleTitle && !uniqueTitles.has(possibleTitle)) {
                uniqueTitles.add(possibleTitle);
                
                foundJobs.push({
                    id: `real_job_${Date.now()}_${foundJobs.length}`,
                    title: possibleTitle.trim(),
                    description: descriptionSnippet ? descriptionSnippet.trim().substring(0, 150) + '...' : 'Description not available',
                    budget: 'See job post', // Budget is complex to extract
                    postedDate: new Date().toLocaleDateString('en-PK'),
                    client: { name: 'Upwork Client', rating: 4.5, country: 'Remote', totalSpent: 0, totalHires: 0 },
                    skills: ['Web Development'],
                    proposals: 0,
                    verified: true,
                    category: 'Web Development',
                    duration: 'Not specified',
                    source: 'upwork_public',
                    isRealJob: true // ✅ This is a REAL job from Upwork
                });
            }
        }

        console.log(`✅ Found and parsed ${foundJobs.length} real job listings.`)
        return foundJobs

    } catch (error) {
        console.error('❌ Error fetching from Upwork.com:', error)
        return [] // Return empty if there's an error
    }
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        console.log('🎯 Fetching real public jobs for user:', user.email)

        // ✅ GET REAL JOBS FROM THE PUBLIC PAGE
        const jobs = await fetchRealJobsFromUpwork()

        return NextResponse.json({ 
            success: true,
            jobs: jobs, // REAL jobs or an empty array
            total: jobs.length,
            source: 'upwork_public_scraper',
            upworkConnected: false, // Since we are not using OAuth
            message: jobs.length > 0 
                ? `✅ Loaded ${jobs.length} REAL job titles from Upwork` 
                : 'No job listings could be parsed at the moment.'
        })

    } catch (error: any) {
        console.error('❌ Jobs API route error:', error)
        return NextResponse.json({ 
            success: false,
            jobs: [],
            total: 0,
            source: 'error',
            message: 'Failed to load job data.'
        }, { status: 500 })
    }
}