// app/dashboard/prompts/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProposalTemplate {
  id: string
  title: string
  content: string
}

interface PromptSettings {
  basicInfo: {
    feedName: string
    keywords: string
    specialty: string
    provisions: string
    hourlyRate: string
    location: string
  }
  validationRules: {
    minBudget: number
    maxBudget: number
    jobTypes: string[]
    clientRating: number
    requiredSkills: string[]
    validationPrompt: string
  }
  proposalTemplates: ProposalTemplate[]
  aiSettings: {
    model: string
    temperature: number
    maxTokens: number
    creativity: 'low' | 'medium' | 'high'
  }
}

export default function AdvancedPromptsPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('basic')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState('')

  const [settings, setSettings] = useState<PromptSettings>({
    basicInfo: {
      feedName: 'Your Professional Feed',
      keywords: '"web development" OR "react" OR "node.js" OR "full stack"',
      specialty: 'Full Stack Web Development',
      provisions: 'React Applications, Node.js APIs, MongoDB Databases',
      hourlyRate: '$25-50',
      location: 'Worldwide'
    },
    validationRules: {
      minBudget: 100,
      maxBudget: 10000,
      jobTypes: ['Fixed', 'Hourly'],
      clientRating: 4.0,
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      validationPrompt: `Evaluate if this job matches our criteria:
- Budget between $100 and $10,000
- Client rating 4.0+
- Fixed or Hourly payment
- Requires JavaScript/React/Node.js skills
- Project scope is clear

Return: APPROVE if matches, REJECT if doesn't match.`
    },
    proposalTemplates: [
      {
        id: '1',
        title: 'Main Proposal Template',
        content: `Write a professional Upwork proposal that:
1. Shows understanding of the specific job requirements
2. Highlights 2-3 relevant skills and experiences
3. Mentions one similar project from portfolio
4. Includes specific questions about the project
5. Clear call-to-action for next steps
6. Professional but friendly tone
7. Maximum 250 words

Focus on client's pain points and how you can solve them.`
      },
      {
        id: '2',
        title: 'Quick Proposal Template',
        content: `Short and effective proposal for quick applications:
- Directly address the main requirement
- Highlight most relevant experience
- Quick call-to-action
- Maximum 150 words`
      },
      {
        id: '3',
        title: 'Detailed Proposal Template',
        content: `Comprehensive proposal for high-value projects:
- Detailed analysis of requirements
- Multiple relevant case studies
- Step-by-step approach
- Timeline and deliverables
- Maximum 400 words`
      }
    ],
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 600,
      creativity: 'medium'
    }
  })

  // Popup States
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [showSaveError, setShowSaveError] = useState(false)
  const [showMinTemplateError, setShowMinTemplateError] = useState(false)

  // Load settings and user data
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
          console.log('✅ Settings loaded from database')
        } else {
          console.log('ℹ️ Using default settings')
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true);
    setSaveErrorMessage('');
    
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowSaveSuccess(true);
        console.log('✅ Settings saved successfully!');
      } else {
        console.error('❌ Save failed:', result.error);
        setSaveErrorMessage(result.error || 'Failed to save settings');
        setShowSaveError(true);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('❌ Network error:', error);
      setSaveErrorMessage('Network error: ' + error.message);
      setShowSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const updateBasicInfo = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      basicInfo: {
        ...prev.basicInfo,
        [field]: value
      }
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateValidationRules = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      validationRules: {
        ...prev.validationRules,
        [field]: value
      }
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateAISettings = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      aiSettings: {
        ...prev.aiSettings,
        [field]: value
      }
    }))
  }

  // Proposal Templates Functions
  const addNewTemplate = () => {
    const newTemplate: ProposalTemplate = {
      id: Date.now().toString(),
      title: 'New Template',
      content: 'Write your proposal template content here...'
    }
    
    setSettings(prev => ({
      ...prev,
      proposalTemplates: [...prev.proposalTemplates, newTemplate]
    }))
  }

  const deleteTemplate = (id: string) => {
    if (settings.proposalTemplates.length <= 1) {
      setShowMinTemplateError(true)
      return
    }
    
    setShowDeleteConfirm(id)
  }

  const confirmDeleteTemplate = (id: string) => {
    setSettings(prev => ({
      ...prev,
      proposalTemplates: prev.proposalTemplates.filter(template => template.id !== id)
    }))
    setShowDeleteConfirm(null)
  }

  const updateTemplateTitle = (id: string, title: string) => {
    setSettings(prev => ({
      ...prev,
      proposalTemplates: prev.proposalTemplates.map(template =>
        template.id === id ? { ...template, title } : template
      )
    }))
  }

  const updateTemplateContent = (id: string, content: string) => {
    setSettings(prev => ({
      ...prev,
      proposalTemplates: prev.proposalTemplates.map(template =>
        template.id === id ? { ...template, content } : template
      )
    }))
  }

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
              Prompts & Configuration
            </h1>
            <p className="text-gray-600">
              Manage your feed configurations and AI prompts for better proposal generation
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Navigation */}
            <div className="lg:col-span-1 space-y-6">
              {/* Navigation Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Sections</h2>
                <nav className="space-y-2">
                  {[
                    { id: 'basic', name: 'Basic Information', icon: '👤' },
                    { id: 'validation', name: 'Validation Rules', icon: '🔍' },
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
              {/* Basic Information Section */}
              {activeSection === 'basic' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Basic Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feed Name
                      </label>
                      <input
                        type="text"
                        value={settings.basicInfo.feedName}
                        onChange={(e) => updateBasicInfo('feedName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your Professional Feed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specialty
                      </label>
                      <input
                        type="text"
                        value={settings.basicInfo.specialty}
                        onChange={(e) => updateBasicInfo('specialty', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Full Stack Web Development"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keywords
                      </label>
                      <textarea
                        value={settings.basicInfo.keywords}
                        onChange={(e) => updateBasicInfo('keywords', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder='e.g., "web development" OR "react" OR "node.js"'
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Use OR between keywords to match any of them
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hourly Rate
                      </label>
                      <input
                        type="text"
                        value={settings.basicInfo.hourlyRate}
                        onChange={(e) => updateBasicInfo('hourlyRate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="$25-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={settings.basicInfo.location}
                        onChange={(e) => updateBasicInfo('location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Worldwide"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Services & Provisions
                      </label>
                      <textarea
                        value={settings.basicInfo.provisions}
                        onChange={(e) => updateBasicInfo('provisions', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe your services and what you provide"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Rules Section */}
              {activeSection === 'validation' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Validation Rules</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Budget ($)
                      </label>
                      <input
                        type="number"
                        value={settings.validationRules.minBudget}
                        onChange={(e) => updateValidationRules('minBudget', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Budget ($)
                      </label>
                      <input
                        type="number"
                        value={settings.validationRules.maxBudget}
                        onChange={(e) => updateValidationRules('maxBudget', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        value={settings.validationRules.clientRating}
                        onChange={(e) => updateValidationRules('clientRating', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Job Types
                      </label>
                      <div className="space-y-2">
                        {['Fixed', 'Hourly'].map((type) => (
                          <label key={type} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={settings.validationRules.jobTypes.includes(type)}
                              onChange={(e) => {
                                const newTypes = e.target.checked
                                  ? [...settings.validationRules.jobTypes, type]
                                  : settings.validationRules.jobTypes.filter(t => t !== type)
                                updateValidationRules('jobTypes', newTypes)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Validation Prompt
                    </label>
                    <textarea
                      value={settings.validationRules.validationPrompt}
                      onChange={(e) => updateValidationRules('validationPrompt', e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="Define your job validation criteria..."
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      This prompt helps AI decide which jobs are suitable for you
                    </p>
                  </div>
                </div>
              )}

              {/* Proposal Templates Section */}
              {activeSection === 'proposal' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Proposal Templates</h2>
                    <button
                      onClick={addNewTemplate}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <span>+</span>
                      <span>Add Template</span>
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {settings.proposalTemplates.map((template, index) => (
                      <div key={template.id} className="border border-gray-200 rounded-lg p-6 relative">
                        {/* Delete Button */}
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="absolute top-6 right-6 text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete Template"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Template Title
                          </label>
                          <input
                            type="text"
                            value={template.title}
                            onChange={(e) => updateTemplateTitle(template.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                            placeholder="Enter template title..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Template Content
                          </label>
                          <textarea
                            value={template.content}
                            onChange={(e) => updateTemplateContent(template.id, e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Write your proposal template content..."
                          />
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Template {index + 1} of {settings.proposalTemplates.length}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-sm text-gray-600">
                    {settings.proposalTemplates.length} template(s) configured
                  </div>
                </div>
              )}

              {/* AI Settings Section */}
              {activeSection === 'ai' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">AI Settings</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Model
                      </label>
                      <select
                        value={settings.aiSettings.model}
                        onChange={(e) => updateAISettings('model', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3">Claude 3</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Creativity Level
                      </label>
                      <select
                        value={settings.aiSettings.creativity}
                        onChange={(e) => updateAISettings('creativity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">Low (More Consistent)</option>
                        <option value="medium">Medium (Balanced)</option>
                        <option value="high">High (More Creative)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature: {settings.aiSettings.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.aiSettings.temperature}
                        onChange={(e) => updateAISettings('temperature', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>More Predictable</span>
                        <span>More Creative</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Tokens: {settings.aiSettings.maxTokens}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="100"
                        value={settings.aiSettings.maxTokens}
                        onChange={(e) => updateAISettings('maxTokens', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Shorter</span>
                        <span>Longer</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">AI Settings Guide</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>Temperature:</strong> Lower = more consistent, Higher = more creative</li>
                      <li>• <strong>Max Tokens:</strong> Controls response length</li>
                      <li>• <strong>GPT-4:</strong> Best quality but slower and more expensive</li>
                      <li>• <strong>GPT-3.5:</strong> Faster and cheaper but less accurate</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Save Configuration</h3>
                    <p className="text-sm text-gray-600">Save your prompt settings and AI configurations</p>
                  </div>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Save All Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this template? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteTemplate(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Success Popup */}
      {showSaveSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Settings Saved</h3>
            </div>
            <p className="text-gray-600 mb-6">
              All settings have been saved successfully! AI will use these for better proposals.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Error Popup */}
      {showSaveError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Save Failed</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {saveErrorMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSaveError(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimum Template Error Popup */}
      {showMinTemplateError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Cannot Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              You must have at least one proposal template!
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMinTemplateError(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}