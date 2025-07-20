import './globals.css'
import type { Metadata } from 'next'
import { FrameProvider } from '@/components/farcaster-provider'

export const metadata: Metadata = {
  title: 'Pacmon - Enhanced Pac-Man Game',
  description: 'Play the enhanced Pac-Man game with progressive difficulty on Farcaster',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <FrameProvider>
          {children}
        </FrameProvider>
      </body>
    </html>
  )
}
