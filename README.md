# Pacmon Game - Improved Version

An enhanced Pac-Man style game built for Farcaster with progressive difficulty, classic visuals, and blockchain integration.

## 🎮 Game Improvements

### Visual Design Enhancements
- **Classic Pac-Man Colors**: Bright blue walls (#0000FF), black background (#000000), white pellets (#FFFFFF)
- **Authentic Ghost Colors**: Red (Blinky), Pink (Pinky), Cyan (Inky), Orange (Clyde)
- **Purple Pacman**: Maintained the requested purple color (#836EF9) for the main character
- **Enhanced Visual Effects**: Glowing power pellets, smooth animations, classic arcade feel

### Progressive Difficulty System
- **Level 1**: 2 ghosts, slower speed, fewer pellets, simpler maze
- **Level 2**: 3 ghosts, moderate speed, more pellets
- **Level 3**: 3 ghosts, faster speed, complex maze
- **Level 4**: 4 ghosts, high speed, maximum complexity
- **Level 5**: 4 ghosts, fastest speed, ultimate challenge

### Clean User Interface
- **Simplified Start Screen**: Removed unnecessary text like "adventure", "new features", "progressive difficulty"
- **Essential Elements Only**: "Pacmon", "Current High Score", "Connect Wallet to Play", "View Leaderboard"
- **Mobile-Friendly Controls**: Touch controls for mobile devices
- **Responsive Design**: Works on both desktop and mobile

### Authentic Gameplay
- **No Mock Data**: Removed all fake leaderboard scores - only real player scores shown
- **Enhanced AI**: Improved ghost behavior with classic Pac-Man AI patterns
- **Power Pellet Mechanics**: Proper vulnerable ghost behavior
- **Level Progression**: Automatic advancement with bonus scoring

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pacmon-game-improved
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your configuration:
   ```
   NEXT_PUBLIC_URL=http://localhost:3000
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Game Features

### Core Gameplay
- **Classic Pac-Man Mechanics**: Eat pellets, avoid ghosts, use power pellets
- **Progressive Levels**: 5 levels with increasing difficulty
- **Lives System**: Start with 3 lives, earn extra lives every 2 levels
- **Scoring System**: Points for pellets, power pellets, ghosts, and level completion bonuses

### Controls
- **Desktop**: Arrow keys or WASD
- **Mobile**: Touch controls (directional buttons)

### Blockchain Integration
- **Wallet Connection**: Connect via Farcaster Frame
- **Score Storage**: Save high scores to Monad Testnet
- **Leaderboard**: View real player scores (no mock data)

## 🔧 Technical Improvements

### Code Quality
- **TypeScript**: Full type safety throughout
- **Clean Architecture**: Separated concerns, modular components
- **Performance**: Optimized game loop and rendering
- **Error Handling**: Robust error handling for blockchain operations

### Game Engine
- **Canvas Rendering**: Smooth 60fps gameplay
- **Collision Detection**: Precise collision system
- **Sound System**: Complete audio management (when sound files are available)
- **State Management**: Clean React state management

### Farcaster Integration
- **Frame SDK**: Native Farcaster mini-app support
- **Wallet Integration**: Seamless wallet connection
- **Chain Switching**: Automatic Monad Testnet switching

## 🎨 Visual Design

### Color Palette
```typescript
const COLORS = {
  PACMAN_PURPLE: '#836EF9',    // Purple Pacman
  WALL_BLUE: '#0000FF',        // Bright blue walls
  BACKGROUND_BLACK: '#000000',  // Black background
  PELLET_WHITE: '#FFFFFF',     // White pellets
  GHOST_RED: '#FF0000',        // Blinky (red)
  GHOST_PINK: '#FFB6C1',       // Pinky (pink)
  GHOST_ORANGE: '#FFA500',     // Clyde (orange)
  GHOST_CYAN: '#00FFFF',       // Inky (cyan)
}
```

### Maze Design
- **Classic Layout**: Authentic Pac-Man maze structure
- **Ghost House**: Central ghost spawn area
- **Progressive Complexity**: Simpler mazes for early levels

## 🚀 Deployment

### Vercel Deployment
1. **Connect to Vercel**
   ```bash
   vercel --prod
   ```

2. **Environment Variables**
   Set in Vercel dashboard:
   ```
   NEXT_PUBLIC_URL=https://your-app.vercel.app
   ```

### Farcaster Integration
1. Deploy to public URL
2. Update environment variables
3. Configure Farcaster domain manifest
4. Test in Farcaster app

## 🎮 Game Mechanics

### Scoring System
- **Pellets**: 10-30 points (increases with level)
- **Power Pellets**: 50-150 points (increases with level)
- **Ghosts**: 200+ points (bonus multiplier per level)
- **Level Completion**: Time bonus + level bonus

### Difficulty Progression
| Level | Ghosts | Speed | Pellet Value | Power Duration |
|-------|--------|-------|--------------|----------------|
| 1     | 2      | Slow  | 10 pts       | 40 ticks       |
| 2     | 3      | Med   | 15 pts       | 35 ticks       |
| 3     | 3      | Fast  | 20 pts       | 30 ticks       |
| 4     | 4      | Faster| 25 pts       | 25 ticks       |
| 5     | 4      | Max   | 30 pts       | 20 ticks       |

## 🐛 Known Issues & Solutions

### Common Issues
1. **Wallet Connection**: Ensure you're using Farcaster app
2. **Chain Switching**: May require manual approval
3. **Sound**: Audio files need to be added to `/public/sounds/`

### Performance
- Game runs at 60fps on modern devices
- Optimized for mobile and desktop
- Minimal memory usage

## 🤝 Contributing

### Development Guidelines
1. Follow TypeScript best practices
2. Maintain game balance in difficulty progression
3. Test on both mobile and desktop
4. Ensure Farcaster compatibility

### Adding Features
- New levels: Update `MAZE_LAYOUTS` and `LEVEL_CONFIG`
- New ghosts: Add to ghost initialization
- New sounds: Add to `SoundManager` class

## 📝 License

MIT License - Feel free to use and modify for your projects!

## 🎯 Future Enhancements

### Suggested Improvements
1. **Multiplayer Mode**: Real-time multiplayer gameplay
2. **NFT Integration**: Collectible Pacman skins
3. **Tournament Mode**: Competitive leaderboards
4. **Power-ups**: Additional game mechanics
5. **Custom Mazes**: User-generated content

### Technical Roadmap
- [ ] Add sound effects
- [ ] Implement particle effects
- [ ] Add screen shake on ghost collision
- [ ] Implement ghost AI difficulty scaling
- [ ] Add achievement system

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Contact the development team
- Check Farcaster documentation for frame-specific issues

---

**Built with ❤️ for the Monad and Farcaster communities!**
