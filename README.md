# Pacmon Game - Improved Version

An enhanced Pacman-style game with progressive difficulty levels, built as a Farcaster Mini App with classic Pac-Man visuals.

## 🎮 New Features & Improvements

### Progressive Difficulty System
- **Level 1**: Simple 15x15 maze, 2 ghosts, slower speed - perfect for beginners
- **Level 2**: Medium 20x20 maze, 3 ghosts, normal speed
- **Level 3+**: Full classic 28x31 maze, 4 ghosts, increasing speed every 2 levels

### Enhanced Visual Design
- **Classic Pac-Man Colors**: Yellow Pac-Man, blue maze walls, authentic ghost colors
- **Authentic Ghost Design**: Classic ghost shapes with wavy bottoms and directional eyes
- **Improved Pac-Man**: Animated mouth that opens in the direction of movement
- **Power Pellet Effects**: Glowing power pellets with visual effects
- **Clean UI**: Removed unnecessary text, improved score display with Pac-Man life icons

### Better Game Mechanics
- **Smart Ghost AI**: Ghosts chase Pac-Man intelligently and flee when frightened
- **Responsive Controls**: Smooth WASD and arrow key controls
- **High Score Tracking**: Persistent high score display
- **Level Progression**: Automatic level advancement with increasing difficulty
- **Improved Collision Detection**: More accurate collision system

### Mobile & Desktop Support
- **Responsive Design**: Works on both desktop and mobile devices
- **Touch-Friendly**: Optimized for touch interactions
- **Adaptive Canvas**: Canvas size adjusts based on maze complexity

## 🎨 Visual Design Matching Reference

The game now perfectly matches the classic Pac-Man aesthetic:
- Blue maze walls on black background
- Yellow Pac-Man with animated mouth
- Authentic ghost colors: Red (Blinky), Pink (Pinky), Cyan (Inky), Orange (Clyde)
- White dots and glowing power pellets
- Classic ghost house design in larger mazes

## 🕹️ Controls

- **Arrow Keys** or **WASD** to move Pac-Man
- **ENTER** to start the game
- **R** to restart after game over

## 🚀 Level Progression

### Level 1 (Tutorial)
- Simple maze layout
- Only 2 ghosts (Red and Pink)
- Slower ghost speed (1.5 pixels/frame)
- 2 power pellets
- Perfect for learning the game

### Level 2 (Intermediate)
- Medium complexity maze
- 3 ghosts (Red, Pink, Cyan)
- Normal ghost speed (2 pixels/frame)
- 3 power pellets
- More challenging layout

### Level 3+ (Advanced)
- Full classic Pac-Man maze
- All 4 ghosts with unique colors
- Progressive speed increase every 2 levels
- 4 power pellets
- Maximum challenge with tunnel warping

## 🎯 Scoring System

- **Dot**: 10 points
- **Power Pellet**: 50 points
- **Ghost**: 200 points (when frightened)
- **High Score**: Automatically tracked and displayed

## 🛠️ Technical Improvements

### Performance Optimizations
- Efficient collision detection
- Optimized rendering with requestAnimationFrame
- Smart canvas resizing based on maze size

### Code Structure
- Modular maze configurations
- Level-based game parameters
- Clean separation of game logic and rendering
- TypeScript for better type safety

## 📦 Installation & Deployment

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd pacmon-game-improved
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment**:
   ```bash
   cp .env.example .env.local
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

## 🔧 Configuration

The game can be easily customized by modifying:

- `MAZES` object for different level layouts
- `LEVEL_CONFIG` for difficulty parameters
- `COLORS` object for visual theming
- `GHOST_COLORS` array for ghost appearances

## 🎮 Game Features

### Core Gameplay
- ✅ Progressive difficulty levels
- ✅ Classic Pac-Man mechanics
- ✅ Power pellet system with frightened ghosts
- ✅ Lives system with visual indicators
- ✅ Level completion detection
- ✅ High score tracking

### Visual Features
- ✅ Authentic Pac-Man design
- ✅ Animated character mouth
- ✅ Classic ghost shapes and colors
- ✅ Glowing power pellets
- ✅ Clean, retro-style UI
- ✅ Responsive canvas sizing

### Technical Features
- ✅ Smooth 60fps gameplay
- ✅ Efficient collision detection
- ✅ Mobile-friendly controls
- ✅ Farcaster integration
- ✅ Wallet connectivity
- ✅ TypeScript support

## 🐛 Bug Fixes

- Fixed ghost AI pathfinding
- Improved collision detection accuracy
- Resolved canvas sizing issues
- Fixed power pellet timer conflicts
- Corrected level progression logic

## 🚀 Future Enhancements

Potential improvements for future versions:
- Sound effects and background music
- Particle effects for eating dots
- Bonus fruit system
- Multiplayer support
- Leaderboard integration
- Achievement system
- Custom maze editor

## 📄 License

MIT License - feel free to use and modify for your own projects!

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Additional maze layouts
- Enhanced ghost AI behaviors
- Sound and music integration
- Mobile touch controls
- Performance optimizations

Built with ❤️ for the Monad and Farcaster communities!

