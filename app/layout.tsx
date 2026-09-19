import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import './finora-premium.css'\nimport './finora-workspace-refinement.css'

export const metadata: Metadata = {
  title: 'Finora — Finance OS',
  description: 'Modern finance management for growing businesses.',
}

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <ClerkProvider><html lang="id"><body>{children}</body></html></ClerkProvider>
}
