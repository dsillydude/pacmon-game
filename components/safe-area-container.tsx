interface SafeAreaInsets {
  top: number
  bottom: number
  left: number
  right: number
}

interface SafeAreaContainerProps {
  children: React.ReactNode
  insets?: SafeAreaInsets
}

export function SafeAreaContainer({ children, insets }: SafeAreaContainerProps) {
  const style = insets
    ? {
        paddingTop: `${insets.top}px`,
        paddingBottom: `${insets.bottom}px`,
        paddingLeft: `${insets.left}px`,
        paddingRight: `${insets.right}px`,
      }
    : {}

  return (
    <div style={style} className="min-h-screen">
      {children}
    </div>
  )
}
