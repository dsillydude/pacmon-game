# Pacmon - Monad Pacman Game

A classic Pacman-style game with progressive difficulty, built as a Farcaster Mini App.

## Features

- **Progressive Difficulty**: Starts easy with 2 ghosts and simple maze, increases complexity
- **Classic Visual Design**: Exact match to original Pac-Man aesthetics
- **Farcaster Integration**: Native mini-app with wallet connectivity
- **On-Chain Scoring**: Save high scores to Monad Testnet
- **Mobile Responsive**: Touch controls for mobile devices

## Game Mechanics

### Progressive Levels
- **Level 1**: Simple maze, 2 ghosts, slower speed
- **Level 2**: Medium complexity, 3 ghosts, moderate speed  
- **Level 3+**: Full complexity, 4 ghosts, faster speed, smarter AI

### Visual Design
- Yellow Pac-Man with animated mouth
- Classic ghost colors: Red (Blinky), Pink (Pinky), Cyan (Inky), Orange (Clyde)
- Blue maze walls on black background
- White pellets and power pellets

## Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env.local
```

3. Start development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel Deployment
1. Push to GitHub
2. Connect repository to Vercel
3. Deploy with default settings
4. Update `NEXT_PUBLIC_URL` environment variable

### Farcaster Integration
1. Deploy to public URL
2. Update environment variables
3. Configure Farcaster domain manifest
4. Mini-app will be available in Farcaster!

## Controls

- **Arrow Keys** or **WASD**: Move Pac-Man
- **Mobile**: Touch on-screen directional buttons
- Eat all pellets to complete level
- Avoid ghosts or lose a life
- Power pellets make ghosts vulnerable temporarily

## Built With

- Next.js 14
- TypeScript
- Tailwind CSS
- Farcaster Frame SDK
- Wagmi (Ethereum integration)
- HTML5 Canvas

## License

MIT License
