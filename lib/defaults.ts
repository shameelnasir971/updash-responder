export const DEFAULT_PROMPT_SETTINGS = {
  basicInfo: {
    feedName: 'Professional Development Feed',
    keywords: '"web development" OR "react" OR "node.js" OR "javascript" OR "typescript" OR "python" OR "full stack" OR "frontend" OR "backend" OR "software engineer" OR "web developer"',
    specialty: 'Full Stack Web Development',
    provisions: 'React Applications, Node.js APIs, MongoDB Databases, REST APIs, Frontend Development, Backend Services',
    hourlyRate: '$25-50',
    location: 'Worldwide',
    experience: '5+ years in web development',
    portfolio: 'Multiple successful projects in React and Node.js'
  },
  validationRules: {
    minBudget: 100,
    maxBudget: 10000,
    jobTypes: ['Fixed', 'Hourly'],
    clientRating: 4.0,
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'HTML', 'CSS'],
    excludedSkills: ['WordPress', 'PHP', 'Java'],
    validationPrompt: `Evaluate if this job matches our criteria:
- Budget between $100 and $10,000
- Client rating 4.0+
- Fixed or Hourly payment
- Requires web development skills
- Clear project requirements
- Professional client history

Return: APPROVE if matches, REJECT if doesn't match.`
  },
  proposalTemplates: [
    {
      id: '1',
      title: 'Main Professional Proposal',
      content: `Write a professional Upwork proposal that:
1. Shows understanding of the specific job requirements
2. Highlights 3-4 relevant skills and experiences
3. Mentions one similar project from portfolio with results
4. Includes specific questions about the project requirements
5. Clear call-to-action for next steps
6. Professional but friendly tone
7. Maximum 250-300 words

Focus on client's pain points and how you can solve them.`
    },
    {
      id: '2',
      title: 'Quick Application Template',
      content: `Short and effective proposal for quick applications:
- Directly address the main requirement
- Highlight most relevant experience (2-3 points)
- Quick call-to-action
- Maximum 150 words

Keep it concise and to the point.`
    },
    {
      id: '3',
      title: 'Detailed Proposal Template',
      content: `Comprehensive proposal for high-value projects:
- Detailed analysis of requirements
- Multiple relevant case studies
- Step-by-step approach with timeline
- Deliverables and milestones
- Questions to clarify requirements
- Maximum 400-500 words

Show expertise and attention to detail.`
    }
  ],
  aiSettings: {
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 800,
    creativity: 'medium'
  }
}