# Chive Cutter 🔪🌿

An unofficial rhythm-based mini-game for r/KitchenConfidential where you perfect your chive-cutting skills! Built as a Reddit app using the Devvit platform.

## 🎮 About

Chive Cutter is a fun, addictive rhythm game where players cut falling chives by pressing the correct keys (A, S, D) when they reach the cut line. Play daily to build your streak and compete on the leaderboards!

### Features

- **Two Game Modes**:
  - **Classic**: Traditional chive-cutting gameplay
  - **F1exican**: Spicy variant with increased difficulty
  
- **Progression System**:
  - Daily practice system
  - Streak tracking (play every day to maintain your streak!)
  - Multiple unlockable weapons (Chef's Knife, Scissors, Cleaver, Scythe, Katana)

- **Leaderboards**:
  - Daily High Scores
  - All-Time Records
  - Daily Streak Competition
  - Per-mode leaderboards

- **Mobile-Friendly**: Fully responsive design with touch controls and optimized UI

## 🚀 Installation

### Prerequisites

- Node.js (v18 or higher)
- Reddit Developer Account
- Devvit CLI installed (`npm install -g devvit`)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MSVWalker/Reddit-Games.git
   cd Reddit-Games/chive-cutter-remix
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Login to Devvit**:
   ```bash
   npm run login
   ```

4. **Configure environment** (optional):
   ```bash
   cp .env.template .env
   # Edit .env with your settings
   ```

## 🎯 Development

### Local Development

Run the development server with live reload:

```bash
npm run dev
```

This will start:
- Client build watcher
- Server build watcher  
- Devvit playtest environment

### Building

Build for production:

```bash
npm run build
```

This compiles both client and server code for deployment.

## 📦 Deployment

### Deploy to Test Subreddit

```bash
npm run deploy
```

This will deploy to your configured test subreddit (default: r/chive_remix_dev).

### Publish Publicly

```bash
npm run launch
```

This will:
1. Build the app
2. Deploy the latest version
3. Submit for Reddit review
4. Once approved, you can install it on any subreddit where you're a moderator

## 🎨 UI Improvements (v2.0)

Version 2.0 includes significant splash screen enhancements:

- **Wider Buttons**: Mode selection and start buttons now use full screen width on mobile
- **Improved Layout**: Better spacing and visual hierarchy
- **Cleaner Footer**: Removed version numbers for a cleaner look
- **Fixed Leaderboard**: Game over screen buttons now properly display full text
- **Retro Aesthetic**: Square buttons with arcade-style feel

## 🏗️ Project Structure

```
chive-cutter-remix/
├── src/
│   ├── client/          # Client-side game code
│   │   ├── game/        # Main game logic and styles
│   │   │   ├── game.ts  # Game engine
│   │   │   └── game.css # Game styles
│   │   └── splash/      # Splash screen
│   └── server/          # Server-side Reddit app code
│       ├── index.ts     # Main app entry
│       └── lib/         # Server utilities
├── assets/              # Game assets (images, etc.)
├── tools/               # Build tools and scripts
└── dist/                # Built output
```

## 🎮 How to Play

1. **Start**: Click the START button on the splash screen
2. **Controls**: 
   - Desktop: Press A, S, or D keys
   - Mobile: Tap the lane buttons
3. **Objective**: Hit the correct key when a chive reaches the cut line
4. **Scoring**: Perfect cuts give more points. Build combos for bonus multipliers!
5. **Daily Play**: Come back every day to maintain your streak! 🔥

## 🏆 Unlockables

Earn new weapons by reaching score milestones:
- **Chef's Knife** (Default)
- **Scissors** - Unlock at 5 points
- **Cleaver** - Unlock at 10 points
- **Scythe** - Unlock at 20 points
- **Katana** - Unlock at 35 points

## 🛠️ Technologies

- **Devvit**: Reddit's developer platform
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **CSS Grid**: Modern responsive layouts
- **HTML5 Canvas**: Game rendering

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Credits

Created for the r/KitchenConfidential community. Special thanks to all the line cooks who inspired this game!

---

**"Cutting a couple of chives every day until r/KitchenConfidential says they're perfect."** ✨
