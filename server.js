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
import * as combatEngine from './game-logic/combat-engine.js';

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

// Gladiator combat helper functions
const CARD_TYPES = {
  LIGHT: { name: 'Light', values: [1, 2, 3], icon: '⚡', color: '#4CAF50' },
  GENERAL: { name: 'General', values: [2, 3, 4], icon: '🛡️', color: '#2196F3' },
  HEAVY: { name: 'Heavy', values: [3, 4, 5], icon: '💥', color: '#FF5722' }
};

function getCardType(cardValue) {
  for (const [typeKey, typeInfo] of Object.entries(CARD_TYPES)) {
    if (typeInfo.values.includes(cardValue)) {
      return { key: typeKey, ...typeInfo };
    }
  }
  return null;
}

function generateDeck(gladiatorStats = null) {
  // For now, generate a balanced deck
  // TODO: Later make this dynamic based on gladiator stats
  const deck = [];
  
  // Add 2 cards of each type (6 total, player chooses 5)
  CARD_TYPES.LIGHT.values.forEach(value => {
    if (deck.length < 2) deck.push({ value, type: 'LIGHT' });
  });
  
  CARD_TYPES.GENERAL.values.forEach(value => {
    if (deck.length < 4) deck.push({ value, type: 'GENERAL' });
  });
  
  CARD_TYPES.HEAVY.values.forEach(value => {
    if (deck.length < 6) deck.push({ value, type: 'HEAVY' });
  });
  
  // Shuffle and return first 5 cards
  return deck.sort(() => Math.random() - 0.5).slice(0, 5);
}

function revealCards(room, roomId) {
  console.log(`[DEBUG] revealCards called for room ${roomId}`);
  
  if (!room.gladiatorState) {
    console.log(`[ERROR] No gladiator state in room ${roomId}`);
    return;
  }
  
  const fighters = room.players.filter(p => p.role === 'fighter');
  console.log(`[DEBUG] Found ${fighters.length} fighters:`, fighters.map(f => ({ id: f.id, name: f.name })));
  
  if (fighters.length !== 2) {
    console.log(`[ERROR] Expected 2 fighters, found ${fighters.length} in room ${roomId}`);
    return;
  }
  
  const [fighter1, fighter2] = fighters;
  const card1 = room.gladiatorState.selectedCards[fighter1.id];
  const card2 = room.gladiatorState.selectedCards[fighter2.id];
  
  console.log(`[DEBUG] Selected cards - ${fighter1.name}: ${card1 ? `${card1.value} (${card1.type})` : 'NONE'}, ${fighter2.name}: ${card2 ? `${card2.value} (${card2.type})` : 'NONE'}`);
  console.log(`[DEBUG] Ready players:`, Array.from(room.gladiatorState.readyPlayers));
  
  if (!card1 || !card2) {
    console.log(`[ERROR] Missing cards - card1: ${!!card1}, card2: ${!!card2}`);
    return;
  }
  
  // Determine winner (higher card value wins)
  let roundWinner = null;
  if (card1.value > card2.value) {
    roundWinner = fighter1;
  } else if (card2.value > card1.value) {
    roundWinner = fighter2;
  }
  // If tied, no winner for this round
  
  // Update round scores
  if (!room.gladiatorState.roundScores[fighter1.id]) {
    room.gladiatorState.roundScores[fighter1.id] = 0;
  }
  if (!room.gladiatorState.roundScores[fighter2.id]) {
    room.gladiatorState.roundScores[fighter2.id] = 0;
  }
  
  if (roundWinner) {
    room.gladiatorState.roundScores[roundWinner.id]++;
  }

  // Set turn order for next round (alternate who goes first)
  if (!room.gladiatorState.firstPlayer) {
    room.gladiatorState.firstPlayer = fighter1.id; // Fighter1 goes first in round 1
  } else {
    // Alternate: if fighter1 went first last round, fighter2 goes first next round
    room.gladiatorState.firstPlayer = room.gladiatorState.firstPlayer === fighter1.id ? fighter2.id : fighter1.id;
  }
  
  // Broadcast reveal results
  io.to(roomId).emit('cards-revealed', {
    roundNumber: room.gladiatorState.currentRound,
    reveals: [
      { 
        playerId: fighter1.id, 
        playerName: fighter1.name, 
        card: card1,
        cardType: getCardType(card1.value)
      },
      { 
        playerId: fighter2.id, 
        playerName: fighter2.name, 
        card: card2,
        cardType: getCardType(card2.value)
      }
    ],
    roundWinner: roundWinner ? { id: roundWinner.id, name: roundWinner.name } : null,
    roundScores: {
      [fighter1.id]: room.gladiatorState.roundScores[fighter1.id],
      [fighter2.id]: room.gladiatorState.roundScores[fighter2.id]
    },
    nextFirstPlayer: room.gladiatorState.firstPlayer
  });
  
  // Check for match winner (first to 3 wins)
  const maxScore = Math.max(
    room.gladiatorState.roundScores[fighter1.id],
    room.gladiatorState.roundScores[fighter2.id]
  );
  
  if (maxScore >= 3) {
    // Match complete
    const matchWinner = room.gladiatorState.roundScores[fighter1.id] >= 3 ? fighter1 : fighter2;
    room.gladiatorState.matchWinner = matchWinner.id;
    
    io.to(roomId).emit('match-complete', {
      winner: { id: matchWinner.id, name: matchWinner.name },
      finalScores: {
        [fighter1.id]: room.gladiatorState.roundScores[fighter1.id],
        [fighter2.id]: room.gladiatorState.roundScores[fighter2.id]
      }
    });
  } else {
    // Round complete but match continues - wait for manual next round
    room.gladiatorState.waitingForNextRound = true;
    
    // Notify players that round is complete and waiting
    io.to(roomId).emit('round-complete-waiting', {
      roundNumber: room.gladiatorState.currentRound,
      nextRoundNumber: room.gladiatorState.currentRound + 1
    });
  }
  
  console.log(`Cards revealed in room ${roomId}: ${fighter1.name}(${card1.value} ${card1.type}) vs ${fighter2.name}(${card2.value} ${card2.type}), winner: ${roundWinner?.name || 'tie'}`);
}

// Utility functions
function generateSecureRoomId() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
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

function validateDiceParams(sides, count, modifierOp, modifierValue) {
  if (sides < 2 || sides > 100) {
    return { valid: false, error: 'Sides must be between 2 and 100' };
  }
  if (count < 1 || count > 20) {
    return { valid: false, error: 'Count must be between 1 and 20' };
  }
  
  // Validate modifier
  if (modifierOp && modifierOp !== 'none') {
    if (!['add', 'subtract', 'multiply'].includes(modifierOp)) {
      return { valid: false, error: 'Invalid modifier operation' };
    }
    
    if (modifierOp === 'multiply') {
      if (modifierValue < 0.1 || modifierValue > 100) {
        return { valid: false, error: 'Multiply modifier must be between 0.1 and 100' };
      }
    } else {
      if (modifierValue < -999 || modifierValue > 999) {
        return { valid: false, error: 'Add/subtract modifier must be between -999 and 999' };
      }
    }
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
      chatHistory: [],
      arenaType: 'dice' // Default to dice mode
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
        isActive: room.isActive,
        arenaType: room.arenaType,
        gladiatorState: room.gladiatorState
      }
    });
    
    console.log(`Room created: ${roomId} by ${playerName}`);
  });
  
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    
    // Sanitize inputs
    let sanitizedRoomId = sanitizeInput(roomId, 20).toUpperCase();
    const sanitizedPlayerName = sanitizeInput(playerName, 20);
    
    if (!sanitizedRoomId || !sanitizedPlayerName) {
      socket.emit('error', { message: 'Invalid room ID or player name' });
      return;
    }
    
    // Handle special room names
    if (roomId.toLowerCase() === 'joesroom') {
      sanitizedRoomId = 'JOESRM';
    }
    
    let room = rooms.get(sanitizedRoomId);
    
    // Auto-create joesroom if it doesn't exist
    if (!room && sanitizedRoomId === 'JOESRM') {
      // Create the special room
      room = {
        id: sanitizedRoomId,
        players: [],
        maxPlayers: 16, // Set a good default for joe's room
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        rollHistory: [],
        chatHistory: [],
        arenaType: 'dice' // Default to dice mode
      };
      rooms.set(sanitizedRoomId, room);
      console.log(`Special room created: ${sanitizedRoomId}`);
    }
    
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
      isHost: room.players.length === 0, // First player becomes host
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
        isActive: room.isActive,
        arenaType: room.arenaType,
        gladiatorState: room.gladiatorState
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
    
    const { sides = 6, count = 1, label, modifierOp = 'none', modifierValue = 0 } = data;
    
    const validation = validateDiceParams(sides, count, modifierOp, modifierValue);
    if (!validation.valid) {
      socket.emit('error', { message: validation.error });
      return;
    }
    
    const rolls = rollDice(sides, count);
    const baseTotal = rolls.reduce((sum, roll) => sum + roll, 0);
    
    // Calculate modified total
    let total = baseTotal;
    if (modifierOp !== 'none') {
      switch (modifierOp) {
        case 'add':
          total = baseTotal + modifierValue;
          break;
        case 'subtract':
          total = baseTotal - modifierValue;
          break;
        case 'multiply':
          total = Math.round(baseTotal * modifierValue);
          break;
      }
    }
    
    // Update label to include modifier
    let displayLabel = label || `${count}d${sides}`;
    if (modifierOp !== 'none') {
      const opSymbol = modifierOp === 'add' ? '+' : modifierOp === 'subtract' ? '-' : '×';
      displayLabel += ` ${opSymbol} ${modifierValue}`;
    }
    
    const rollResult = {
      id: Date.now().toString(),
      player: {
        id: player.id,
        name: player.name
      },
      rolls,
      total,
      baseTotal: modifierOp !== 'none' ? baseTotal : undefined,
      sides,
      count,
      label: displayLabel,
      modifierOp,
      modifierValue: modifierOp !== 'none' ? modifierValue : undefined,
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
        total: rollResult.total,
        baseTotal: rollResult.baseTotal,
        modifierOp: rollResult.modifierOp,
        modifierValue: rollResult.modifierValue
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
  
  socket.on('switch-arena-mode', (data) => {
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
    
    // Only host can switch arena mode
    if (!player.isHost) {
      socket.emit('error', { message: 'Only the host can switch arena mode' });
      return;
    }
    
    const { arenaType } = data;
    
    // Validate arena type
    if (!['dice', 'gladiator'].includes(arenaType)) {
      socket.emit('error', { message: 'Invalid arena type' });
      return;
    }
    
    // Update room arena type
    room.arenaType = arenaType;
    room.lastActivity = new Date();
    
    // Broadcast arena change to all players in the room
    io.to(roomId).emit('arena-switched', { arenaType });
    
    console.log(`${player.name} switched arena to: ${arenaType} in room ${roomId}`);
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
          isActive: room.isActive,
          arenaType: room.arenaType,
          gladiatorState: room.gladiatorState
        },
        rollHistory: room.rollHistory.slice(-50),
        chatHistory: room.chatHistory.slice(-50)
      });
    }
  });

  // Gladiator Arena Socket Events
  socket.on('select-role', (data) => {
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
    
    const { role } = data;
    
    // Validate role
    if (!['fighter', 'spectator'].includes(role)) {
      socket.emit('error', { message: 'Invalid role selection' });
      return;
    }
    
    // Check if trying to select fighter when already 2 fighters
    if (role === 'fighter') {
      const currentFighters = room.players.filter(p => p.role === 'fighter').length;
      if (currentFighters >= 2 && player.role !== 'fighter') {
        socket.emit('error', { message: 'Maximum 2 fighters allowed' });
        return;
      }
    }
    
    // Update player role
    player.role = role;
    
    // Generate deck for fighters
    if (role === 'fighter') {
      player.cardHand = generateDeck(player.gladiatorStats);
    } else {
      // Remove card hand if switching from fighter to spectator
      delete player.cardHand;
    }
    
    room.lastActivity = new Date();
    
    // Initialize gladiator state if not exists
    if (!room.gladiatorState) {
      room.gladiatorState = {
        currentRound: 1,
        roundScores: {},
        selectedCards: {},
        readyPlayers: new Set(),
        matchWinner: null,
        spectatorBets: {},
        spectatorChatHistory: [],
        firstPlayer: null, // Will be set when first round starts
        waitingForNextRound: false
      };
    }
    
    // Broadcast role selection to all players (but not card hands - those are private)
    io.to(roomId).emit('player-role-selected', { 
      playerId: player.id, 
      playerName: player.name,
      role: role 
    });
    
    // Send card hand privately to the fighter
    if (role === 'fighter' && player.cardHand) {
      socket.emit('card-hand-assigned', { 
        cardHand: player.cardHand.map((card, index) => ({
          ...card,
          cardType: getCardType(card.value),
          index
        }))
      });
    }
    
    console.log(`${player.name} selected role: ${role} in room ${roomId}`);
  });

  socket.on('select-card', (data) => {
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
    
    // Only fighters can select cards
    if (player.role !== 'fighter') {
      socket.emit('error', { message: 'Only fighters can select cards' });
      return;
    }
    
    // Must be in gladiator mode
    if (room.arenaType !== 'gladiator') {
      socket.emit('error', { message: 'Not in gladiator mode' });
      return;
    }
    
    const { cardIndex } = data;
    
    // Validate card index (0-based for array access)
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= 5) {
      socket.emit('error', { message: 'Invalid card selection' });
      return;
    }
    
    // Validate player has a card hand
    if (!player.cardHand || !player.cardHand[cardIndex]) {
      socket.emit('error', { message: 'No card at that position' });
      return;
    }
    
    const selectedCard = player.cardHand[cardIndex];
    
    // Initialize gladiator state if not exists
    if (!room.gladiatorState) {
      room.gladiatorState = {
        currentRound: 1,
        roundScores: {},
        selectedCards: {},
        readyPlayers: new Set(),
        matchWinner: null,
        spectatorBets: {},
        spectatorChatHistory: [],
        firstPlayer: null, // Will be set when first round starts
        waitingForNextRound: false
      };
    }
    
    // Store the selected card (secretly)
    room.gladiatorState.selectedCards[player.id] = selectedCard;
    room.lastActivity = new Date();
    
    console.log(`${player.name} selected card ${selectedCard.value} (${selectedCard.type}) in room ${roomId}`);
    
    // Confirm selection to the player only (keep secret from others)
    socket.emit('card-selected', { cardIndex, card: selectedCard });
  });

  socket.on('player-ready', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    console.log(`[DEBUG] Player ready request from ${socket.id} in room ${roomId}`);
    
    if (!room) {
      console.log(`[ERROR] Player-ready: No room found for ${socket.id}`);
      socket.emit('error', { message: 'You are not in a room' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      console.log(`[ERROR] Player-ready: Player ${socket.id} not found in room ${roomId}`);
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    
    console.log(`[DEBUG] Player ${player.name} (${player.id}) trying to be ready, role: ${player.role}`);
    
    // Only fighters can be ready
    if (player.role !== 'fighter') {
      console.log(`[ERROR] Player-ready: ${player.name} is not a fighter (role: ${player.role})`);
      socket.emit('error', { message: 'Only fighters can be ready' });
      return;
    }
    
    // Must have selected a card first
    if (!room.gladiatorState || !room.gladiatorState.selectedCards[player.id]) {
      console.log(`[ERROR] Player-ready: ${player.name} has no selected card`);
      console.log(`[DEBUG] Gladiator state exists: ${!!room.gladiatorState}`);
      console.log(`[DEBUG] Selected cards:`, room.gladiatorState?.selectedCards);
      socket.emit('error', { message: 'Must select a card first' });
      return;
    }
    
    // Add player to ready set
    room.gladiatorState.readyPlayers.add(player.id);
    room.lastActivity = new Date();
    
    console.log(`[DEBUG] ${player.name} is now ready. Ready players:`, Array.from(room.gladiatorState.readyPlayers));
    
    // Broadcast ready status (but not card choice)
    io.to(roomId).emit('player-ready-status', { 
      playerId: player.id,
      playerName: player.name,
      isReady: true
    });
    
    console.log(`${player.name} is ready in room ${roomId}`);
    
    // Check if both fighters are ready
    const fighters = room.players.filter(p => p.role === 'fighter');
    const readyFighters = fighters.filter(f => room.gladiatorState.readyPlayers.has(f.id));
    
    console.log(`[DEBUG] Ready check - Total fighters: ${fighters.length}, Ready fighters: ${readyFighters.length}`);
    console.log(`[DEBUG] Fighters:`, fighters.map(f => ({ id: f.id, name: f.name, ready: room.gladiatorState.readyPlayers.has(f.id) })));
    
    if (fighters.length === 2 && readyFighters.length === 2) {
      console.log(`[DEBUG] Both fighters ready - triggering reveal in 1 second`);
      // Both fighters ready - trigger reveal
      setTimeout(() => {
        revealCards(room, roomId);
      }, 1000); // 1 second delay for dramatic effect
    } else {
      console.log(`[DEBUG] Waiting for more fighters to be ready`);
    }
  });

  socket.on('start-next-round', (data) => {
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
    
    // Only host can start next round (for testing)
    if (!player.isHost) {
      socket.emit('error', { message: 'Only the host can start the next round' });
      return;
    }
    
    if (!room.gladiatorState || !room.gladiatorState.waitingForNextRound) {
      socket.emit('error', { message: 'Not waiting for next round' });
      return;
    }

    // Verify we still have exactly 2 fighters
    const fighters = room.players.filter(p => p.role === 'fighter');
    if (fighters.length !== 2) {
      socket.emit('error', { message: 'Need exactly 2 fighters to continue' });
      return;
    }
    
    // Advance to next round
    room.gladiatorState.currentRound++;
    room.gladiatorState.selectedCards = {};
    room.gladiatorState.readyPlayers.clear();
    room.gladiatorState.waitingForNextRound = false;
    room.lastActivity = new Date();
    
    // Notify all players of next round
    io.to(roomId).emit('next-round', {
      roundNumber: room.gladiatorState.currentRound,
      firstPlayer: room.gladiatorState.firstPlayer
    });
    
    console.log(`${player.name} started round ${room.gladiatorState.currentRound} in room ${roomId}`);
  });

  // Debug commands (host only)
  socket.on('debug-get-room-state', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'You are not in a room' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'Debug commands are host-only' });
      return;
    }
    
    // Send complete room state (with sensitive data for debugging)
    socket.emit('debug-room-state', {
      roomId: room.id,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isHost: p.isHost,
        cardHand: p.cardHand ? p.cardHand.map(c => `${c.value} (${c.type})`) : null
      })),
      gladiatorState: room.gladiatorState ? {
        currentRound: room.gladiatorState.currentRound,
        roundScores: room.gladiatorState.roundScores,
        selectedCards: Object.fromEntries(
          Object.entries(room.gladiatorState.selectedCards).map(([playerId, card]) => [
            playerId, 
            `${card.value} (${card.type})`
          ])
        ),
        readyPlayers: Array.from(room.gladiatorState.readyPlayers),
        firstPlayer: room.gladiatorState.firstPlayer,
        waitingForNextRound: room.gladiatorState.waitingForNextRound
      } : null,
      arenaType: room.arenaType
    });
  });

  socket.on('debug-force-reveal', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'You are not in a room' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'Debug commands are host-only' });
      return;
    }
    
    console.log(`[DEBUG] Host ${player.name} forcing card reveal`);
    revealCards(room, roomId);
  });

  // NEW GLADIATOR COMBAT ENGINE EVENTS
  
  socket.on('select-gladiator-type', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room || room.arenaType !== 'gladiator') {
      socket.emit('error', { message: 'Not in gladiator mode' });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== 'fighter') {
      socket.emit('error', { message: 'Only fighters can select gladiator type' });
      return;
    }
    
    const { gladiatorType } = data;
    if (!['light', 'medium', 'heavy'].includes(gladiatorType)) {
      socket.emit('error', { message: 'Invalid gladiator type' });
      return;
    }
    
    // Initialize or update combat game state
    const fighters = room.players.filter(p => p.role === 'fighter');
    
    if (!room.combatState) {
      room.combatState = combatEngine.createGameState(roomId, fighters);
    } else {
      // Add any new fighters to existing combat state
      for (const fighter of fighters) {
        if (!room.combatState.players[fighter.id]) {
          room.combatState.players[fighter.id] = {
            id: fighter.id,
            name: fighter.name,
            gladiatorType: null,
            hp: 10,
            maxHp: 10,
            stamina: 24,
            maxStamina: 24,
            armor: 0,
            deck: [],
            hand: [],
            playedCards: [],
            discardPile: [],
            removedCards: [],
            isGassedOut: false,
            isReady: false,
            selectedCards: []
          };
          if (!room.combatState.activePlayers.includes(fighter.id)) {
            room.combatState.activePlayers.push(fighter.id);
          }
        }
      }
      
      // Remove any players who are no longer fighters
      for (const playerId of room.combatState.activePlayers) {
        if (!fighters.find(f => f.id === playerId)) {
          delete room.combatState.players[playerId];
          room.combatState.activePlayers = room.combatState.activePlayers.filter(id => id !== playerId);
        }
      }
    }
    
    // Verify player exists in combat state
    if (!room.combatState.players[socket.id]) {
      socket.emit('error', { message: 'Player not found in combat state. Please rejoin as a fighter.' });
      return;
    }
    
    // Set gladiator type
    room.combatState.players[socket.id].gladiatorType = gladiatorType;
    
    // Check if all fighters have selected types
    const allTypesSelected = room.combatState.activePlayers.every(playerId => 
      room.combatState.players[playerId].gladiatorType
    );
    
    if (allTypesSelected) {
      try {
        combatEngine.initializePlayerDecks(room.combatState);
        combatEngine.startNewRound(room.combatState);
        
        // Send game state to all players
        io.to(roomId).emit('gladiator-game-started', {
          phase: room.combatState.phase,
          round: room.combatState.round
        });
        
        // Send hands to fighters
        for (const playerId of room.combatState.activePlayers) {
          const playerState = room.combatState.players[playerId];
          io.to(playerId).emit('hand-dealt', {
            hand: playerState.hand,
            stats: {
              hp: playerState.hp,
              stamina: playerState.stamina,
              gladiatorType: playerState.gladiatorType
            }
          });
        }
      } catch (error) {
        console.error('Error initializing combat:', error);
        socket.emit('error', { message: 'Failed to start combat' });
      }
    }
    
    socket.emit('gladiator-type-selected', { gladiatorType });
    console.log(`${player.name} selected ${gladiatorType} gladiator in room ${roomId}`);
  });
  
  socket.on('play-cards', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room || !room.combatState) {
      socket.emit('error', { message: 'No active combat' });
      return;
    }
    
    const { cardIndices } = data;
    
    try {
      const selectedCards = combatEngine.selectCardsForPosturing(
        room.combatState, 
        socket.id, 
        cardIndices
      );
      
      socket.emit('cards-played', { selectedCards: selectedCards.length });
      
      // Check if all players have selected
      if (combatEngine.checkPosturingComplete(room.combatState)) {
        // Notify players that posturing is complete and discard phase has begun
        io.to(roomId).emit('discard-phase-started', {
          gameState: combatEngine.getGameStateSummary(room.combatState, socket.id)
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  // Handle discard phase
  socket.on('gladiator-discard', (data) => {
    const roomId = userRooms.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!room || !room.combatState) {
      socket.emit('error', { message: 'No active combat' });
      return;
    }
    
    const { cardIndices = [], useStamina = false } = data;
    
    try {
      const discardResult = combatEngine.processDiscard(
        room.combatState,
        socket.id,
        cardIndices,
        useStamina
      );
      
      socket.emit('discard-complete', { 
        discarded: discardResult.cards.length,
        staminaCost: discardResult.staminaCost 
      });
      
      // Check if all players have made discard decisions
      if (combatEngine.checkDiscardComplete(room.combatState)) {
        // Resolve battle
        const battleResults = combatEngine.resolveBattle(room.combatState);
        
        // Check for game end
        const gameEnd = combatEngine.checkGameEnd(room.combatState);
        
        // Broadcast battle results
        io.to(roomId).emit('battle-resolved', {
          results: battleResults,
          gameEnd
        });
        
        if (!gameEnd.gameOver) {
          // Prepare for next round
          setTimeout(() => {
            combatEngine.startNewRound(room.combatState);
            
            // Send updated hands
            for (const playerId of room.combatState.activePlayers) {
              const playerState = room.combatState.players[playerId];
              io.to(playerId).emit('new-round-started', {
                round: room.combatState.round,
                hand: playerState.hand,
                stats: {
                  hp: playerState.hp,
                  stamina: playerState.stamina,
                  armor: playerState.armor
                }
              });
            }
          }, 3000); // 3 second delay between rounds
        }
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
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