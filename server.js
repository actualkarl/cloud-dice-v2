import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import validator from 'validator';

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

const PORT = process.env.PORT || 3001;

// Security tracking
const ipConnections = new Map();
const roomCreationAttempts = new Map();

// Rate limiting middleware
const roomCreateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 rooms per IP per window
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0] : req.ip;
    return hashIP(ip);
  },
  message: { error: 'Too many room creation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'client/dist')));

// In-memory storage for rooms and games
const rooms = new Map();
const userRooms = new Map(); // Track which room each user is in

// Utility functions
function generateSecureRoomId() {
  return crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 chars
}

// Security utilities
function getClientIP(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0] : socket.handshake.address;
}

function hashIP(ip) {
  const salt = process.env.IP_SALT || 'default-salt-change-in-production';
  return crypto.createHash('sha256')
    .update(ip + salt)
    .digest('hex').substring(0, 16);
}

function sanitizeInput(input, maxLength = 50) {
  if (!input || typeof input !== 'string') return '';
  return validator.escape(input.trim()).substring(0, maxLength);
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

// Remove public room info endpoint for security
// app.get('/api/rooms/:roomId', (req, res) => {
//   // Removed for security - room info only available via WebSocket
// });

// WebSocket handling
io.on('connection', (socket) => {
  const clientIP = getClientIP(socket);
  const hashedIP = hashIP(clientIP);
  
  // Limit connections per IP
  const connections = ipConnections.get(hashedIP) || 0;
  if (connections >= 5) {
    console.log(`Connection limit exceeded for IP: ${hashedIP}`);
    socket.emit('error', { message: 'Too many connections from this IP address' });
    socket.disconnect();
    return;
  }
  
  ipConnections.set(hashedIP, connections + 1);
  console.log(`User connected: ${socket.id} (IP: ${hashedIP}, connections: ${connections + 1})`);
  
  socket.on('create-room', (data) => {
    const { playerName, maxPlayers = 8 } = data;
    
    // Sanitize inputs
    const sanitizedPlayerName = sanitizeInput(playerName, 20);
    if (!sanitizedPlayerName) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    
    // Rate limit room creation per IP
    const now = Date.now();
    const attempts = roomCreationAttempts.get(hashedIP) || [];
    const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000); // 15 minutes
    
    if (recentAttempts.length >= 5) {
      socket.emit('error', { message: 'Too many room creation attempts. Please try again later.' });
      return;
    }
    
    recentAttempts.push(now);
    roomCreationAttempts.set(hashedIP, recentAttempts);
    
    const roomId = generateSecureRoomId();
    
    const room = {
      id: roomId,
      players: [{
        id: socket.id,
        name: sanitizedPlayerName,
        isHost: true,
        joinedAt: new Date()
      }],
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 16),
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      rollHistory: [],
      chatHistory: []
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
    
    // Sanitize inputs
    const sanitizedRoomId = sanitizeInput(roomId, 20);
    const sanitizedPlayerName = sanitizeInput(playerName, 20);
    
    if (!sanitizedRoomId || !sanitizedPlayerName) {
      socket.emit('error', { message: 'Invalid room ID or player name' });
      return;
    }
    
    const room = rooms.get(sanitizedRoomId);
    
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
    if (room.players.some(p => p.name.toLowerCase() === sanitizedPlayerName.toLowerCase())) {
      socket.emit('error', { message: 'Player name already taken' });
      return;
    }
    
    const player = {
      id: socket.id,
      name: sanitizedPlayerName,
      isHost: false,
      joinedAt: new Date()
    };
    
    room.players.push(player);
    room.lastActivity = new Date();
    userRooms.set(socket.id, sanitizedRoomId);
    
    socket.join(sanitizedRoomId);
    
    // Send room info to the joining player
    socket.emit('room-joined', {
      roomId: sanitizedRoomId,
      room: {
        id: room.id,
        players: room.players,
        maxPlayers: room.maxPlayers,
        isActive: room.isActive
      },
      rollHistory: room.rollHistory.slice(-50), // Send last 50 rolls
      chatHistory: room.chatHistory.slice(-50) // Send last 50 messages
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
    
    // Also add dice roll to chat history
    const diceRollChatMessage = {
      id: `dice-${rollResult.id}`,
      type: 'dice-roll',
      player: rollResult.player,
      rollData: {
        label: rollResult.label,
        rolls: rollResult.rolls,
        total: rollResult.total
      },
      timestamp: rollResult.timestamp
    };
    
    room.chatHistory.push(diceRollChatMessage);
    
    // Keep only last 100 messages per room
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }
    
    // Broadcast roll result to all players in the room
    io.to(roomId).emit('dice-rolled', rollResult);
    
    console.log(`${player.name} rolled ${rollResult.label}: ${rolls.join(', ')} (Total: ${total})`);
  });

  socket.on('send-message', (data) => {
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
    
    const { message } = data;
    
    // Sanitize chat message
    const sanitizedMessage = sanitizeInput(message, 200);
    if (!sanitizedMessage || sanitizedMessage.length === 0) {
      socket.emit('error', { message: 'Message cannot be empty or contains invalid characters' });
      return;
    }
    
    const chatMessage = {
      id: Date.now().toString(),
      type: 'text',
      player: {
        id: player.id,
        name: player.name
      },
      message: sanitizedMessage,
      timestamp: new Date().toISOString()
    };
    
    room.chatHistory.push(chatMessage);
    room.lastActivity = new Date();
    
    // Keep only last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }
    
    // Broadcast message to all players in the room
    io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`${player.name} sent message: ${sanitizedMessage}`);
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
        rollHistory: room.rollHistory.slice(-50),
        chatHistory: room.chatHistory.slice(-50)
      });
    }
  });
  
  socket.on('disconnect', () => {
    // Clean up IP connection tracking
    const count = ipConnections.get(hashedIP) || 0;
    if (count > 1) {
      ipConnections.set(hashedIP, count - 1);
    } else {
      ipConnections.delete(hashedIP);
    }
    
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

// Cleanup inactive rooms and old rate limit data periodically
setInterval(() => {
  const now = new Date();
  const INACTIVE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  
  // Clean up inactive rooms
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > INACTIVE_THRESHOLD) {
      rooms.delete(roomId);
      console.log(`Cleaned up inactive room: ${roomId}`);
    }
  }
  
  // Clean up old rate limit data
  for (const [hashedIP, attempts] of roomCreationAttempts.entries()) {
    const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recentAttempts.length === 0) {
      roomCreationAttempts.delete(hashedIP);
    } else {
      roomCreationAttempts.set(hashedIP, recentAttempts);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

server.listen(PORT, () => {
  console.log(`🎲 Cloud Dice V2 server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});