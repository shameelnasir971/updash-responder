// app/dashboard/prompts/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdvancedPromptsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('basic')
  
  const [settings, setSettings] = useState({
    basicInfo: {
      feedName: 'Upwork Professional Jobs',
      keywords: 'react node.js javascript python web development',
      specialty: 'Full Stack Web Development',
      provisions: 'Web Applications, Mobile Apps, API Development, Database Design',
      hourlyRate: '$25-75',
      location: 'Worldwide',
      name: '',
      company: ''
    },
    jobPreferences: {
      minBudget: 100,
      maxBudget: 10000,
      categories: ['Web Development', 'Mobile App Development', 'Front-End Development', 'Back-End Development'],
      countries: ['Worldwide', 'USA', 'UK', 'Canada', 'Australia'],
      jobTypes: ['Fixed', 'Hourly'],
      experienceLevels: ['Intermediate', 'Expert'],
      onlyVerifiedClients: true,
      onlyTopRated: true,
      minClientRating: 4.0
    },
    proposalTemplates: [
      {
        id: '1',
        title: 'Main Proposal Template',
        content: `Write a professional Upwork proposal that addresses client needs and highlights relevant experience.`
      }
    ],
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 600,
      creativity: 'medium'
    }
  })

  useEffect(() => {
    checkAuth()
    loadSettings()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth')
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        setSettings(prev => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            name: userData.name || '',
            company: userData.company_name || ''
          }
        }))
      } else {
        router.push('/auth/login')
      }
    } catch (error) {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert('✅ Settings saved successfully! Jobs will be filtered based on your preferences.')
      } else {
        alert('Failed to save: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // ... (rest of the component remains similar, add job preferences section)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Prompts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Prompts & Job Preferences
            </h1>
            <p className="text-gray-600">
              Configure your job search criteria and AI settings for better proposals
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Navigation */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
                <nav className="space-y-2">
                  {[
                    { id: 'basic', name: 'Profile Info', icon: '👤' },
                    { id: 'jobs', name: 'Job Preferences', icon: '🔍' },
                    { id: 'proposal', name: 'Proposal Templates', icon: '📝' },
                    { id: 'ai', name: 'AI Settings', icon: '🤖' }
                  ].map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-3 ${
                        activeSection === section.id 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">{section.icon}</span>
                      <span>{section.name}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Job Preferences Section */}
              {activeSection === 'jobs' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Job Search Preferences</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Budget ($)
                      </label>
                      <input
                        type="number"
                        value={settings.jobPreferences.minBudget}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          jobPreferences: {
                            ...prev.jobPreferences,
                            minBudget: parseInt(e.target.value) || 100
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Budget ($)
                      </label>
                      <input
                        type="number"
                        value={settings.jobPreferences.maxBudget}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          jobPreferences: {
                            ...prev.jobPreferences,
                            maxBudget: parseInt(e.target.value) || 10000
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Client Rating
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={settings.jobPreferences.minClientRating}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          jobPreferences: {
                            ...prev.jobPreferences,
                            minClientRating: parseFloat(e.target.value) || 4.0
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Job Types
                      </label>
                      {['Fixed', 'Hourly'].map((type) => (
                        <label key={type} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={settings.jobPreferences.jobTypes.includes(type)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...settings.jobPreferences.jobTypes, type]
                                : settings.jobPreferences.jobTypes.filter(t => t !== type)
                              setSettings(prev => ({
                                ...prev,
                                jobPreferences: {
                                  ...prev.jobPreferences,
                                  jobTypes: newTypes
                                }
                              }))
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categories
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          'Web Development', 'Mobile App Development', 
                          'Front-End Development', 'Back-End Development',
                          'Full Stack Development', 'WordPress',
                          'E-Commerce Development', 'API Development'
                        ].map((category) => (
                          <label key={category} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={settings.jobPreferences.categories.includes(category)}
                              onChange={(e) => {
                                const newCategories = e.target.checked
                                  ? [...settings.jobPreferences.categories, category]
                                  : settings.jobPreferences.categories.filter(c => c !== category)
                                setSettings(prev => ({
                                  ...prev,
                                  jobPreferences: {
                                    ...prev.jobPreferences,
                                    categories: newCategories
                                  }
                                }))
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{category}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.jobPreferences.onlyVerifiedClients}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            jobPreferences: {
                              ...prev.jobPreferences,
                              onlyVerifiedClients: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Only Verified Clients</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.jobPreferences.onlyTopRated}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            jobPreferences: {
                              ...prev.jobPreferences,
                              onlyTopRated: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Only Top Rated Clients</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Save Configuration</h3>
                    <p className="text-sm text-gray-600">Your settings will be used to filter Upwork jobs</p>
                  </div>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {saving ? 'Saving...' : '💾 Save All Settings'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}