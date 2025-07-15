
'use client'

import PacmonGame from '@/components/PacmonGame'
import { useFrame } from '@/components/farcaster-provider'
import { SafeAreaContainer } from '@/components/safe-area-container'

export default function Home() {
  const { context, isLoading, isSDKLoaded } = useFrame()

  if (isLoading) {
    return (
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8" style={{ backgroundColor: '#0E100F' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-2" style={{ borderColor: '#836EF9' }}></div>
          <h1 className="text-3xl font-bold text-center" style={{ color: '#FBFAF9' }}>
            Loading Enhanced Pacmon...
          </h1>
          <p className="text-lg text-center" style={{ color: '#836EF9' }}>
            Preparing 6 challenging levels for you!
          </p>
        </div>
      </SafeAreaContainer>
    )
  }

  // For testing purposes, show the game even without Farcaster SDK
  // Uncomment the following block for production deployment
  /*
  if (!isSDKLoaded) {
    return (
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8" style={{ backgroundColor: '#0E100F' }}>
          <h1 className="text-3xl font-bold text-center" style={{ color: '#836EF9' }}>
            Pacmon Enhanced
          </h1>
          <p className="text-lg text-center" style={{ color: '#FBFAF9' }}>
            This enhanced multi-level Pacman game requires the Farcaster app to play.
          </p>
          <p className="text-sm text-center" style={{ color: '#A0055D' }}>
            Please open this link in the Farcaster mobile app to enjoy the full experience.
          </p>
        </div>
      </SafeAreaContainer>
    )
  }
  */

  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <PacmonGame />
    </SafeAreaContainer>
  )
}
