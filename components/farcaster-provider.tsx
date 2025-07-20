'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'

interface FrameContext {
  context: any
  isLoading: boolean
  isSDKLoaded: boolean
}

const FrameContext = createContext<FrameContext>({
  context: null,
  isLoading: true,
  isSDKLoaded: false
})

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)

  useEffect(() => {
    const initFrame = async () => {
      try {
        if (typeof window !== 'undefined') {
          const frameContext = await farcasterFrame.getContext()
          setContext(frameContext)
          setIsSDKLoaded(true)
        }
      } catch (error) {
        console.log('Farcaster SDK not available:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initFrame()
  }, [])

  return (
    <FrameContext.Provider value={{ context, isLoading, isSDKLoaded }}>
      {children}
    </FrameContext.Provider>
  )
}

export const useFrame = () => useContext(FrameContext)
