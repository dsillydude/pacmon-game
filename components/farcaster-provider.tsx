'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface FrameContext {
  isEthProviderAvailable: boolean
  client?: any
  safeAreaInsets?: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

interface FrameProviderProps {
  children: React.ReactNode
}

const FrameContext = createContext<{
  context: FrameContext | null
  isLoading: boolean
  isSDKLoaded: boolean
}>({
  context: null,
  isLoading: true,
  isSDKLoaded: false,
})

export function FrameProvider({ children }: FrameProviderProps) {
  const [context, setContext] = useState<FrameContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)

  useEffect(() => {
    const initializeFrame = async () => {
      try {
        // Check if we're in a Farcaster frame environment
        const isInFrame = typeof window !== 'undefined' && 
          (window.parent !== window || window.location !== window.parent.location)

        // Mock frame context for development/testing
        const mockContext: FrameContext = {
          isEthProviderAvailable: true,
          client: {
            safeAreaInsets: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },
          },
        }

        setContext(mockContext)
        setIsSDKLoaded(isInFrame)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to initialize frame:', error)
        setIsLoading(false)
      }
    }

    initializeFrame()
  }, [])

  return (
    <FrameContext.Provider value={{ context, isLoading, isSDKLoaded }}>
      {children}
    </FrameContext.Provider>
  )
}

export function useFrame() {
  const frameContext = useContext(FrameContext)
  if (!frameContext) {
    throw new Error('useFrame must be used within a FrameProvider')
  }
  return frameContext
}
