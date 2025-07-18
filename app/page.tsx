import PacmonGame from '@components/PacmonGame'

export default function Home() {
  return <PacmonGame />
}

export const metadata = {
  title: 'Pacmon Game - Enhanced Pacman with Progressive Levels',
  description: 'Play the enhanced Pacman game with progressive difficulty levels, classic visuals, and Farcaster integration.',
  openGraph: {
    title: 'Pacmon Game - Enhanced Pacman',
    description: 'Enhanced Pacman game with progressive difficulty levels',
    images: ['/api/og'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${process.env.NEXT_PUBLIC_URL}/api/frame`,
    'fc:frame:post_url': `${process.env.NEXT_PUBLIC_URL}/api/frame`,
    'fc:frame:button:1': 'Play Game',
    'fc:frame:button:2': 'View Leaderboard',
  },
}

