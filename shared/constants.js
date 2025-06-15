// Game Configuration Constants
export const GAME_CONFIG = {
  // Dice limits
  MIN_DICE_SIDES: 2,
  MAX_DICE_SIDES: 100,
  MIN_DICE_COUNT: 1,
  MAX_DICE_COUNT: 20,
  
  // Room limits
  MIN_ROOM_PLAYERS: 2,
  MAX_ROOM_PLAYERS: 16,
  DEFAULT_MAX_PLAYERS: 8,
  
  // String limits
  MAX_PLAYER_NAME_LENGTH: 20,
  MAX_DICE_LABEL_LENGTH: 20,
  ROOM_ID_LENGTH: 6,
  
  // History limits
  MAX_ROOM_ROLL_HISTORY: 100,
  CLIENT_ROLL_HISTORY_DISPLAY: 50,
  
  // Timeouts and intervals
  ROOM_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  INACTIVE_ROOM_THRESHOLD: 30 * 60 * 1000, // 30 minutes
  ROLL_RESULT_DISPLAY_TIME: 5000, // 5 seconds
  
  // Socket events
  SOCKET_EVENTS: {
    // Client to Server
    CREATE_ROOM: 'create-room',
    JOIN_ROOM: 'join-room',
    ROLL_DICE: 'roll-dice',
    GET_ROOM_INFO: 'get-room-info',
    
    // Server to Client
    ROOM_CREATED: 'room-created',
    ROOM_JOINED: 'room-joined',
    PLAYER_JOINED: 'player-joined',
    PLAYER_LEFT: 'player-left',
    DICE_ROLLED: 'dice-rolled',
    ROOM_INFO: 'room-info',
    ERROR: 'error'
  }
}

// Dice preset configurations
export const DICE_PRESETS = [
  { sides: 2, name: 'Coin Flip', emoji: '🪙' },
  { sides: 4, name: 'Tetrahedron', emoji: '🔺' },
  { sides: 6, name: 'Standard Die', emoji: '🎲' },
  { sides: 8, name: 'Octahedron', emoji: '🔶' },
  { sides: 10, name: 'Pentagonal', emoji: '🔟' },
  { sides: 12, name: 'Dodecahedron', emoji: '🔸' },
  { sides: 20, name: 'Icosahedron', emoji: '🎯' },
  { sides: 100, name: 'Percentile', emoji: '💯' }
]

// Common roll configurations for quick access
export const QUICK_ROLLS = [
  { count: 1, sides: 6, label: 'Standard' },
  { count: 2, sides: 6, label: '2d6' },
  { count: 3, sides: 6, label: '3d6' },
  { count: 4, sides: 6, label: '4d6' },
  { count: 1, sides: 20, label: 'd20' },
  { count: 1, sides: 100, label: 'Percentile' }
]

// Error messages
export const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: 'Room not found',
  ROOM_FULL: 'Room is full',
  ROOM_INACTIVE: 'Room is not active',
  PLAYER_NAME_TAKEN: 'Player name already taken',
  PLAYER_NOT_IN_ROOM: 'You are not in a room',
  PLAYER_NOT_FOUND: 'Player not found in room',
  INVALID_DICE_SIDES: `Sides must be between ${GAME_CONFIG.MIN_DICE_SIDES} and ${GAME_CONFIG.MAX_DICE_SIDES}`,
  INVALID_DICE_COUNT: `Count must be between ${GAME_CONFIG.MIN_DICE_COUNT} and ${GAME_CONFIG.MAX_DICE_COUNT}`,
  INVALID_PLAYER_NAME: `Player name must be 1-${GAME_CONFIG.MAX_PLAYER_NAME_LENGTH} characters`,
  INVALID_ROOM_ID: `Room ID must be ${GAME_CONFIG.ROOM_ID_LENGTH} characters`,
  CONNECTION_ERROR: 'Connection error',
  SERVER_ERROR: 'Server error'
}

// API endpoints
export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  ROLL: '/api/roll',
  ROOM_INFO: '/api/rooms/:roomId'
}

// Default values
export const DEFAULTS = {
  DICE_SIDES: 6,
  DICE_COUNT: 1,
  MAX_PLAYERS: 8,
  ROOM_NAME: 'Dice Room'
}

// Export for CommonJS compatibility (server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GAME_CONFIG,
    DICE_PRESETS,
    QUICK_ROLLS,
    ERROR_MESSAGES,
    API_ENDPOINTS,
    DEFAULTS
  }
}