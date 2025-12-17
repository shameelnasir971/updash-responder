//app/layout.tsx

import type { Metadata } from 'next'
import './globals.css'
import { startBackgroundJobFetcher } from '@/lib/background-worker'

// Start background worker on server
if (typeof window === 'undefined') {
  startBackgroundJobFetcher()
}

export const metadata: Metadata = {
  title: 'Upwork Assistant - AI Proposal Generator',
  description: 'Automate your Upwork proposals with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-gray-50" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}