import { NextResponse } from "next/server"

// app/api/upwork/permissions/route.ts - NEW FILE
export async function GET() {
  try {
    // Yeh check karo ke kya aap kay API key mein jobs read ka permission hai
    const scopes = [
      'r_jobs',           // Jobs read
      'r_workdiary',      // Work diary read (optional)
      'r_workrooms'       // Workrooms read (optional)
    ]
    
    return NextResponse.json({
      availableScopes: scopes,
      currentScopes: ['r_jobs'], // Aap ke screenshot se
      canReadJobs: true,
      canSendProposals: false, // IMPORTANT: Aap ke paas yeh permission nahi hai!
      message: 'Sirf jobs read kar sakte hain, proposals send nahi'
    })
  } catch (error) {
    console.error('Permissions error:', error)
  }
}