// app/dashboard/page.tsx 
'use client'

import { useState, useEffect, useMemo } from 'react'

interface User {
  id: number
  name: string
  email: string
  company_name: string
}

interface Job {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  client: {
    name: string
    rating: number
    country: string
    totalSpent: number
    totalHires: number
  }
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  duration?: string
  source?: string
  isRealJob?: boolean
  jobType?: string
  experienceLevel?: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  
  // ✅ NEW: Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedJobType, setSelectedJobType] = useState('all')
  const [selectedExperience, setSelectedExperience] = useState('all')
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')

  useEffect(() => {
    checkAuth()
    loadJobs()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      console.log('🔄 Loading REAL jobs...')
      const response = await fetch('/api/upwork/jobs')
      
      if (response.status === 401) {
        setConnectionError('Session expired. Please login again.')
        window.location.href = '/auth/login'
        return
      }
      
      const data = await response.json()
      console.log('📊 Jobs Data:', {
        success: data.success,
        count: data.jobs?.length,
        message: data.message
      })

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(data.message || 'No jobs found. Try refreshing.')
        } else if (data.jobs?.length > 0) {
          setConnectionError(`✅ Success! Loaded ${data.jobs.length} real jobs from Upwork!`)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
      }
      
    } catch (error: any) {
      console.error('❌ Load jobs error:', error)
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  const handleConnectUpwork = async () => {
    setConnecting(true)
    
    try {
      const response = await fetch('/api/upwork/auth')
      const data = await response.json()
      
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to generate OAuth URL. Check console.')
        console.error('OAuth error:', data.error)
        setConnecting(false)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
      setConnecting(false)
    }
  }

  // ✅ NEW: Get unique categories, job types, experience levels for filter dropdowns
  const categories = useMemo(() => {
    const cats = jobs.map(job => job.category).filter(Boolean) as string[]
    return Array.from(new Set(cats))
  }, [jobs])

  const jobTypes = useMemo(() => {
    const types = jobs.map(job => job.jobType).filter(Boolean) as string[]
    return Array.from(new Set(types))
  }, [jobs])

  const experienceLevels = useMemo(() => {
    const levels = jobs.map(job => job.experienceLevel).filter(Boolean) as string[]
    return Array.from(new Set(levels))
  }, [jobs])

  // ✅ NEW: Filtered jobs based on all filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const inTitle = job.title.toLowerCase().includes(term)
        const inDescription = job.description.toLowerCase().includes(term)
        const inSkills = job.skills.some(skill => skill.toLowerCase().includes(term))
        const inCategory = job.category?.toLowerCase().includes(term)
        
        if (!(inTitle || inDescription || inSkills || inCategory)) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && job.category !== selectedCategory) {
        return false
      }

      // Job type filter
      if (selectedJobType !== 'all' && job.jobType !== selectedJobType) {
        return false
      }

      // Experience level filter
      if (selectedExperience !== 'all' && job.experienceLevel !== selectedExperience) {
        return false
      }

      // Budget filter
      if (minBudget || maxBudget) {
        // Extract numeric value from budget string (e.g., "$500.00" -> 500)
        const budgetMatch = job.budget.match(/\$?(\d+(\.\d+)?)/)
        if (budgetMatch) {
          const budgetValue = parseFloat(budgetMatch[1])
          
          if (minBudget && budgetValue < parseFloat(minBudget)) {
            return false
          }
          if (maxBudget && budgetValue > parseFloat(maxBudget)) {
            return false
          }
        } else {
          return false // If no budget info, exclude when budget filter is active
        }
      }

      return true
    })
  }, [jobs, searchTerm, selectedCategory, selectedJobType, selectedExperience, minBudget, maxBudget])

  // ✅ NEW: Reset all filters
  const resetFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedJobType('all')
    setSelectedExperience('all')
    setMinBudget('')
    setMaxBudget('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jobs Dashboard</h1>
              <p className="text-sm text-gray-600">
                {upworkConnected ? 'Upwork jobs' : 'Connect Upwork to see jobs'}
              </p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={resetFilters}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Reset Filters
              </button>
              <button 
                onClick={() => window.open('https://www.upwork.com/nx/find-work/', '_blank')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Browse Upwork
              </button>
            </div>
          </div>
        </div>

        {/* ✅ NEW: Filter Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Jobs</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, skills, description..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Type
              </label>
              <select
                value={selectedJobType}
                onChange={(e) => setSelectedJobType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Job Types</option>
                {jobTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Experience Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Experience Level
              </label>
              <select
                value={selectedExperience}
                onChange={(e) => setSelectedExperience(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                {experienceLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Budget Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Budget ($)
              </label>
              <input
                type="number"
                value={minBudget}
                onChange={(e) => setMinBudget(e.target.value)}
                placeholder="e.g., 500"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Budget ($)
              </label>
              <input
                type="number"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredJobs.length}</span> of <span className="font-semibold">{jobs.length}</span> jobs
              </span>
              <button 
                onClick={loadJobs}
                disabled={jobsLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {jobsLoading ? 'Loading...' : 'Refresh Jobs'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {connectionError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <span>{connectionError}</span>
              <button 
                onClick={loadJobs}
                className="ml-4 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {upworkConnected ? 'Upwork Jobs' : 'Connect Upwork'}
                {searchTerm && ` - Results for "${searchTerm}"`}
              </h2>
              {!upworkConnected && (
                <button
                  onClick={handleConnectUpwork}
                  disabled={connecting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : '🔗 Connect Upwork'}
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {jobsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-6xl">🔍</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No Jobs Found
                </h3>
                <p className="text-gray-500 mb-6">
                  {jobs.length === 0
                    ? (upworkConnected 
                        ? 'Try refreshing or check Upwork directly.' 
                        : 'Connect your Upwork account to see jobs.')
                    : 'No jobs match your current filters. Try adjusting your search criteria.'
                  }
                </p>
                {jobs.length > 0 && (
                  <button
                    onClick={resetFilters}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{job.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {job.category && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {job.category.replace(/_/g, ' ')}
                          </span>
                        )}
                        {job.jobType && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {job.jobType}
                          </span>
                        )}
                        {job.experienceLevel && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            {job.experienceLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-green-700 bg-green-50 px-3 py-1 rounded whitespace-nowrap">
                      {job.budget}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    <span className="font-medium">Client:</span> {job.client.name} • 
                    <span className="mx-2">📅</span> {job.postedDate} • 
                    <span className="mx-2">📍</span> {job.client.country} •
                    <span className="mx-2">⭐</span> {job.client.rating} • 
                    <span className="mx-2">💰</span> ${job.client.totalSpent.toLocaleString()} spent
                  </p>
                  
                  <p className="text-gray-700 mb-4 line-clamp-2">
                    {job.description}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center flex-wrap gap-2">
                      {job.skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="text-gray-500 text-sm">
                          +{job.skills.length - 4} more
                        </span>
                      )}
                      <span className="text-gray-500 text-sm ml-2">
                        {job.proposals} proposals • {job.verified ? '✅ Verified' : '⚠️ Not Verified'}
                      </span>
                    </div>
                    
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap">
                      Generate Proposal
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}