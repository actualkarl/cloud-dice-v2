import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// In-memory storage for rooms and games
const rooms = new Map();
const userRooms = new Map(); // Track which room each user is in

// Utility functions
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(sides, count) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

function validateDiceParams(sides, count) {
  if (sides < 2 || sides > 100) {
    return { valid: false, error: 'Sides must be between 2 and 100' };
  }
  if (count < 1 || count > 20) {
    return { valid: false, error: 'Count must be between 1 and 20' };
  }
  return { valid: true };
}

// HTTP API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount
  });
});

app.post('/api/roll', (req, res) => {
  const { sides = 6, count = 1 } = req.body;
  
  const validation = validateDiceParams(sides, count);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  const rolls = rollDice(sides, count);
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  
  res.json({
    rolls,
    total,
    sides,
    count,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId: room.id,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    isActive: room.isActive,
    lastActivity: room.lastActivity
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('create-room', (data) => {
    const { playerName, maxPlayers = 8 } = data;
    const roomId = generateRoomId();
    
    const room = {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        isHost: true,
        joinedAt: new Date()
      }],
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 16),
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      rollHistory: []
    };
    
    rooms.set(roomId, room);
    userRooms.set(socket.id, roomId);
    
    socket.join(roomId);
    
    socket.emit('room-created', {
      roomId,
      room: {
        id: room.id,
        players: room.players,
        maxPlayers: room.maxPlayers,
        isActive: room.isActive
      }
    });
    
    console.log(`Room created: ${roomId} by ${playerName}`);
  });
  
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (!room.isActive) {
      socket.emit('error', { message: 'Room is not active' });
      return;
    }
    
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    // Check if player name is already taken
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      socket.emit('error', { message: 'Player name already taken' });
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      isHost: false,
      joinedAt: new Date()
    };
    
    room.players.push(player);
    room.lastActivity = new Date();
    userRooms.set(socket.id, roomId);
    
    socket.join(roomId);
    
    // Send room info to the joining player
    socket.emit('room-joined', {
      roomId,
      room: {
        id: room.id,
        players: room.players,
        maxPlayers: room.maxPlayers,
        isActive: room.isActive
      },
      rollHistory: room.rollHistory.slice(-50) // Send last 50 rolls
    });
    
    // Notify all other players in the room
    socket.to(roomId).emit('player-joined', { player });
    
    console.log(`${playerName} joined room: ${roomId}`);
  });
  
  socket.on('roll-dice', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'You are not in a room' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    
    const { sides = 6, count = 1, label } = data;
    
    const validation = validateDiceParams(sides, count);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error });
      return;
    }
    
    const rolls = rollDice(sides, count);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    
    const rollResult = {
      id: Date.now().toString(),
      player: {
        id: player.id,
        name: player.name
      },
      rolls,
      total,
      sides,
      count,
      label: label || `${count}d${sides}`,
      timestamp: new Date().toISOString()
    };
    
    room.rollHistory.push(rollResult);
    room.lastActivity = new Date();
    
    // Keep only last 100 rolls per room
    if (room.rollHistory.length > 100) {
      room.rollHistory = room.rollHistory.slice(-100);
    }
    
    // Broadcast roll result to all players in the room
    io.to(roomId).emit('dice-rolled', rollResult);
    
    console.log(`${player.name} rolled ${rollResult.label}: ${rolls.join(', ')} (Total: ${total})`);
  });
  
  socket.on('get-room-info', () => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (room) {
      socket.emit('room-info', {
        roomId,
        room: {
          id: room.id,
          players: room.players,
          maxPlayers: room.maxPlayers,
          isActive: room.isActive
        },
        rollHistory: room.rollHistory.slice(-50)
      });
    }
  });
  
  socket.on('disconnect', () => {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        // Remove player from room
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);
          
          // If room is empty, delete it
          if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Room deleted: ${roomId}`);
          } else {
            // If the host left, make the first remaining player the host
            if (player.isHost && room.players.length > 0) {
              room.players[0].isHost = true;
            }
            
            room.lastActivity = new Date();
            
            // Notify remaining players
            socket.to(roomId).emit('player-left', { 
              player: { id: player.id, name: player.name },
              newHost: room.players.find(p => p.isHost)
            });
          }
        }
      }
      userRooms.delete(socket.id);
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Cleanup inactive rooms periodically
setInterval(() => {
  const now = new Date();
  const INACTIVE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > INACTIVE_THRESHOLD) {
      rooms.delete(roomId);
      console.log(`Cleaned up inactive room: ${roomId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

server.listen(PORT, () => {
  console.log(`🎲 Cloud Dice V2 server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});