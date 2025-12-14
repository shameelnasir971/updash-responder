// app/api/upwork/jobs/route.ts 
async function fetchSimpleRealJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs with CORRECT query...')
    
    // ✅ CORRECT GraphQL Query - engagement as String
    const graphqlQuery = {
      query: `
        query GetJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                amount {
                  displayValue
                }
                skills {
                  name
                }
                totalApplicants
                category
                createdDateTime
                experienceLevel
                engagement  # ✅ Just field name, NO { name }
                location {
                  country
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
        'Accept': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📥 Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API error:', error.substring(0, 200))
      return { success: false, error: `API error ${response.status}`, jobs: [] }
    }

    const data = await response.json()
    
    // ✅ DEBUG: Check actual response
    console.log('📊 Full response received')
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }

    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)

    // ✅ Simple Formatting
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Budget
      const budgetText = node.amount?.displayValue || 'Budget not specified'
      
      // Posted time
      const postedDate = node.createdDateTime
      let postedText = 'Recently'
      if (postedDate) {
        const now = new Date()
        const posted = new Date(postedDate)
        const diffMs = now.getTime() - posted.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        
        if (diffMins < 60) {
          postedText = `${diffMins} minutes ago`
        } else if (diffMins < 1440) {
          postedText = `${Math.floor(diffMins / 60)} hours ago`
        } else {
          postedText = `${Math.floor(diffMins / 1440)} days ago`
        }
      }
      
      // Job Type String
      let jobTypeString = budgetText
      if (node.experienceLevel) {
        const expLevel = node.experienceLevel.toLowerCase()
        jobTypeString += ` - ${expLevel.charAt(0).toUpperCase() + expLevel.slice(1)}`
      }
      
      // Engagement/duration
      const engagement = node.engagement || ''
      if (engagement) {
        jobTypeString += ` - ${engagement}`
      }
      
      return {
        id: node.id || `job_${Date.now()}`,
        title: node.title || 'Job Title',
        description: node.description || '',
        budget: budgetText,
        postedText: postedText,
        jobTypeString: jobTypeString,
        
        // Simple client info
        client: {
          name: 'Upwork Client',
          country: node.location?.country || 'Remote',
        },
        
        skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
        proposals: node.totalApplicants || 0,
        category: node.category || '',
        experienceLevel: node.experienceLevel || '',
        engagement: engagement,
        source: 'upwork',
        isRealJob: true
      }
    })

    console.log(`✅ Formatted ${jobs.length} jobs`)
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}