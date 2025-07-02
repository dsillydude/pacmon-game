import EnhancedApp from '@/components/pages/enhanced-app'
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
      splashBackgroundColor: '#836EF9', // Updated to use Monad purple
    },
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pacmon - Monad Pacman Game',
    description: 'PacMon is a nostalgic arcade adventure reimagined for the Web3 era, seamlessly integrated as a Farcaster mini-app. Dive into a vibrant world infused with Monad\'s distinctive style, where you\'ll outsmart mischievous ghosts, collect glowing dots, and navigate intricate mazes.',
    openGraph: {
      title: 'PacMon: The Web3 Arcade Adventure You Can\'t Miss!',
      description: 'Dive into PacMon, the ultimate Web3 arcade experience! Outsmart ghosts, collect crypto, and conquer mazes in this Monad-themed adventure. Play now and relive the classic thrill with a modern twist!',
      images: [`${APP_URL}/images/hero_banner.png`],
    },
    other: {
      'fc:frame': JSON.stringify(frame),
    },
  }
}

export default function EnhancedHome() {
  return <EnhancedApp />
}

