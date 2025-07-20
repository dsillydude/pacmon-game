# Pacmon - Monad Pacman Game

A Pacman-style game with Monad theming, built as a Farcaster Mini App.

## 🎮 Game Features

- **Classic Pacman Gameplay**: Navigate through a maze, eat pellets, and avoid ghosts
- **Monad Theming**: Beautiful Monad color palette and branding
- **Farcaster Integration**: Runs as a native mini-app within Farcaster
- **Responsive Design**: Works on both desktop and mobile devices
- **Power Pellets**: Temporarily turn ghosts vulnerable and eat them for bonus points

## 🎨 Visual Design

- **Pacmon Character**: Monad Purple (#836EF9) themed Pacman
- **Ghosts**: Monad Blue (#200052), Monad Berry (#A0055D), and Monad Off-White (#FBFAF9)
- **Maze**: Monad Blue walls on Monad Black background
- **Pellets**: Monad Off-White dots
- **Power Pellets**: Larger Monad Purple glowing orbs

## 🕹️ Controls

- **Arrow Keys** or **WASD** to move Pacmon
- Eat all pellets to complete the level
- Avoid ghosts or lose a life
- Eat power pellets to temporarily make ghosts vulnerable

## 🚀 Local Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd pacmon-game
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📦 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Deploy with default settings
4. Update your `.env.local` with the production URL:
```
NEXT_PUBLIC_URL=https://your-app.vercel.app
```

### Farcaster Integration

1. Deploy your app to a public URL (Vercel recommended)
2. Update the `NEXT_PUBLIC_URL` environment variable
3. Go to Farcaster Settings > Developer > Domains
4. Add your domain and generate the domain manifest
5. Your mini-app will be available in Farcaster!

## 🛠️ Built With

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Farcaster Frame SDK** - Mini-app integration
- **HTML5 Canvas** - Game rendering

## 📁 Project Structure

```
pacmon-game/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page with frame metadata
│   └── .well-known/       # Farcaster configuration
├── components/
│   ├── PacmonGame.tsx     # Main game component
│   └── pages/app.tsx      # App wrapper with Farcaster integration
├── public/images/         # Game assets and images
├── lib/                   # Utilities and constants
└── README.md
```

## 🎯 Game Mechanics

- **Score**: 10 points per pellet, 50 points per power pellet, 200 points per ghost
- **Lives**: Start with 3 lives, lose one when touched by a ghost
- **Power Mode**: Lasts 6 seconds, makes ghosts vulnerable
- **Level Complete**: Eat all pellets and power pellets to win

## 🔧 Configuration

The game can be customized by modifying:
- `COLORS` object in `PacmonGame.tsx` for theming
- `MAZE` array for different level layouts
- Game constants like `GRID_SIZE`, `CELL_SIZE` for sizing
- Ghost AI behavior and movement patterns

## 📄 License

MIT License - feel free to use and modify for your own projects!

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Add new levels or maze layouts
- Improve ghost AI
- Add sound effects
- Enhance mobile controls
- Add multiplayer features

## 🐛 Known Issues

- Game requires Farcaster SDK to run in production
- Mobile touch controls could be improved
- No sound effects currently implemented

## 📞 Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

Built with ❤️ for the Monad and Farcaster communities!

