# 🎲 Cloud Dice V2

A real-time multiplayer dice rolling application built for Railway deployment. Create rooms, invite friends, and roll dice together in real-time!

## ✨ Features

- **Real-time multiplayer**: Roll dice with friends simultaneously
- **WebSocket-powered**: Instant updates and communication
- **Room-based system**: Create private rooms with custom player limits
- **Flexible dice rolling**: Support for d2 to d100 dice, multiple dice per roll
- **Roll history**: Track all rolls in your room session
- **Responsive design**: Works on desktop and mobile devices
- **One-command deployment**: Optimized for Railway hosting

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd cloud-dice-v2
   npm run install:all
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```
   This runs both the client (Vite dev server on port 5173) and server (Express on port 3000) concurrently.

3. **Open your browser:**
   ```
   http://localhost:5173
   ```

### Production Build

```bash
npm run build
npm start
```

## 🚂 Railway Deployment

This project is specifically optimized for Railway deployment:

### One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/your-username/cloud-dice-v2)

### Manual Deployment

1. **Connect to Railway:**
   - Create a [Railway](https://railway.app) account
   - Connect your GitHub repository
   - Railway will automatically detect the project

2. **Deployment Configuration:**
   - Railway automatically uses `npm start` as the start command
   - Uses `process.env.PORT` (provided by Railway)
   - Client builds automatically via `postinstall` script

3. **Environment Variables:**
   - No environment variables required!
   - Railway automatically provides `PORT`
   - Optional: Set `NODE_ENV=production`

## 📁 Project Structure

```
cloud-dice-v2/
├── package.json          # Root package with Railway scripts
├── server.js             # Main server (Express + Socket.IO)
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── README.md            # This file
├── client/              # React frontend
│   ├── package.json     # Client dependencies
│   ├── vite.config.js   # Vite configuration
│   ├── index.html       # HTML template
│   └── src/
│       ├── main.jsx     # React entry point
│       ├── App.jsx      # Main App component
│       ├── App.css      # Global styles
│       └── components/
│           ├── HomeScreen.jsx    # Landing page
│           └── GameRoom.jsx      # Game room interface
└── shared/              # Shared constants and utilities
    └── constants.js     # Game configuration constants
```

## 🎮 How to Play

### Creating a Room
1. Enter your name
2. Choose max players (2-16)
3. Click "Create Room"
4. Share the 6-character room ID with friends

### Joining a Room
1. Enter your name
2. Enter the room ID from your friend
3. Click "Join Room"

### Rolling Dice
1. Select dice type (d2 to d100)
2. Choose number of dice (1-20)
3. Optionally add a label
4. Click "Roll Dice"
5. Results appear instantly for all players

## 🔧 Technical Details

### Architecture
- **Single Server**: One Express.js server handles both HTTP API and WebSocket connections
- **In-Memory Storage**: Rooms and game state stored in memory (no database required)
- **Real-time Communication**: Socket.IO for instant updates
- **Static File Serving**: Server serves built React app

### Key Technologies
- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: React 18, Vite
- **Styling**: CSS with modern features
- **Deployment**: Railway-optimized

### API Endpoints

#### HTTP API
- `GET /api/health` - Server health check
- `POST /api/roll` - Single dice roll (for testing)
- `GET /api/rooms/:roomId` - Room information

#### WebSocket Events
- `create-room` - Create a new room
- `join-room` - Join existing room
- `roll-dice` - Roll dice in room
- `get-room-info` - Request room state

## 🎛️ Configuration

### Environment Variables
Copy `.env.example` to `.env` for local development:

```bash
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Game Configuration
Modify `shared/constants.js` to adjust:
- Dice limits (sides, count)
- Room limits (players, history)
- Timeouts and intervals

## 🧪 Scripts

```bash
# Development
npm run dev              # Run both client and server in dev mode
npm run server:dev       # Run server only (with nodemon)
npm run client:dev       # Run client only (Vite dev server)

# Production
npm run build           # Build client for production
npm start              # Start production server
npm run install:all    # Install all dependencies (root + client)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with ❤️ for the Railway community
- Inspired by tabletop gaming and virtual game nights
- Special thanks to the React and Socket.IO communities

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Kill process on port 3000
npx kill-port 3000
```

**Build Fails on Railway:**
- Ensure Node.js version is 18+ in `package.json` engines
- Check that all dependencies are in `dependencies`, not `devDependencies`

**WebSocket Connection Issues:**
- Railway handles WebSocket proxying automatically
- For local development, ensure both servers are running

**Client Not Loading:**
- Make sure `npm run build` completes successfully
- Check that `client/dist` folder exists and contains files

### Support

- Create an issue on GitHub
- Check Railway documentation
- Join our Discord community

---

**Built for Railway** 🚂 | **Real-time Multiplayer** 🎲 | **Zero Configuration** ⚡