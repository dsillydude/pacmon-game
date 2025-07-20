'use client'

import React from 'react'

interface SafeAreaInsets {
  top: number
  bottom: number
  left: number
  right: number
}

interface SafeAreaContainerProps {
  children: React.ReactNode
  insets?: SafeAreaInsets
  className?: string
}

export function SafeAreaContainer({ 
  children, 
  insets = { top: 0, bottom: 0, left: 0, right: 0 },
  className = ''
}: SafeAreaContainerProps) {
  const style = {
    paddingTop: `${insets.top}px`,
    paddingBottom: `${insets.bottom}px`,
    paddingLeft: `${insets.left}px`,
    paddingRight: `${insets.right}px`,
  }

  return (
    <div 
      className={`min-h-screen ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
