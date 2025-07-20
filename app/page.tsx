import App from '@/components/pages/app'
import { APP_URL } from '@/lib/constants'
import type { Metadata } from 'next'

const frame = {
  version: 'next',
  imageUrl: `${APP_URL}/images/feed.png`,
  button: {
    title: 'Play Pacmon',
    action: {
      type: 'launch_frame',
      name: 'Pacmon - Monad Pacman Game',
      url: APP_URL,
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: '#200052',
    },
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pacmon - Monad Pacman Game',
    openGraph: {
      title: 'Pacmon - Monad Pacman Game',
      description: 'Play Pacmon, a Pacman-style game with Monad theming on Farcaster',
    },
    other: {
      'fc:frame': JSON.stringify(frame),
    },
  }
}

export default function Home() {
  return <App />
}
