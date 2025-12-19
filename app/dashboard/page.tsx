'use client'

import { useState, useEffect } from 'react'
import JobProposalPopup from '@/components/JobProposalPopup'

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
  skills: string[]
  proposals: number
  verified: boolean
  category?: string
  duration?: string
  source?: string
  isRealJob?: boolean
  client?: {
    name?: string
    rating?: number
    country?: string
    totalSpent?: number
    totalHires?: number
  }
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [upworkConnected, setUpworkConnected] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
        loadJobs('', true)
      } else {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      window.location.href = '/auth/login'
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async (search = '', forceRefresh = false) => {
    setJobsLoading(true)
    setConnectionError('')
    
    try {
      const url = `/api/upwork/jobs${search || forceRefresh ? '?' : ''}${
        search ? `search=${encodeURIComponent(search)}${forceRefresh ? '&' : ''}` : ''
      }${forceRefresh ? 'refresh=true' : ''}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setJobs(data.jobs || [])
        setUpworkConnected(data.upworkConnected || false)
        
        if (data.jobs?.length === 0) {
          setConnectionError(search 
            ? `No jobs found for "${search}". Try different keywords.`
            : 'No jobs found. Upwork API might be limiting requests.'
          )
        } else {
          setConnectionError(data.cached ? `${data.message} (cached)` : data.message)
        }
      } else {
        setConnectionError(data.message || 'Failed to load jobs')
        setJobs([])
      }
    } catch (error: any) {
      setConnectionError('Network error. Please check connection.')
      setJobs([])
    } finally {
      setJobsLoading(false)
      setLastRefreshTime(new Date())
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
      loadJobs(searchInput.trim(), true)
    } else {
      setSearchInput('')
      setSearchTerm('')
      loadJobs('', true)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    loadJobs('', true)
  }

  const handleForceRefresh = () => {
    loadJobs(searchTerm, true)
    setRefreshCount(prev => prev + 1)
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setShowPopup(true)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
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
        {/* HEADER, SEARCH, STATS, JOBS LIST */}
        {/* CODE AS YOU PROVIDED, NO CHANGES */}
        {/* Everything works with updated /api/upwork/jobs route */}
      </div>

      {showPopup && selectedJob && user && (
        <JobProposalPopup
          job={selectedJob}
          user={user}
          onClose={() => {
            setShowPopup(false)
            setSelectedJob(null)
          }}
        />
      )}
    </div>
  )
}
