// components/AutoRefreshWorker.tsx
'use client'

import { useEffect } from 'react'

interface AutoRefreshWorkerProps {
  enabled: boolean
  intervalMinutes?: number
  onRefresh?: (count: number) => void
}

export default function AutoRefreshWorker({ 
  enabled, 
  intervalMinutes = 3,
  onRefresh 
}: AutoRefreshWorkerProps) {
  
  useEffect(() => {
    if (!enabled) return
    
    console.log(`🔄 AutoRefreshWorker started (${intervalMinutes}min interval)`)
    
    let refreshCount = 0
    
    const fetchBackgroundJobs = async () => {
      try {
        console.log('⚙️ Background: Fetching fresh jobs from Upwork...')
        
        const response = await fetch('/api/upwork/jobs?background=true', {
          method: 'GET',
          // Don't wait too long for background fetch
          signal: AbortSignal.timeout(15000)
        })
        
        if (response.ok) {
          const data = await response.json()
          refreshCount++
          
          console.log(`✅ Background fetch ${refreshCount}: ${data.jobs?.length || 0} jobs`)
          
          if (onRefresh) {
            onRefresh(refreshCount)
          }
        }
      } catch (error) {
        console.error('Background fetch error:', error)
        // Silent fail for background jobs
      }
    }
    
    // Run immediately once
    fetchBackgroundJobs()
    
    // Then set interval
    const intervalMs = intervalMinutes * 60 * 1000
    const intervalId = setInterval(fetchBackgroundJobs, intervalMs)
    
    return () => {
      console.log('🛑 AutoRefreshWorker stopped')
      clearInterval(intervalId)
    }
  }, [enabled, intervalMinutes, onRefresh])
  
  return null // This is a background component, no UI
}