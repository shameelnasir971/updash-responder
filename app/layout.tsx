//app/layout.tsx

import type { Metadata } from 'next'
import './globals.css'

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