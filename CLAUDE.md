# Cloud Dice V2 - Gladiator Arena Combat System

## Project Overview
Extending the real-time multiplayer dice roller to include a full gladiator card combat system based on the Ludus TTRPG. Maintains room-based multiplayer infrastructure while adding persistent player stats and complex card mechanics.

## Architecture Evolution
- **Real-time multiplayer** using Socket.IO + Express ✅
- **Room-based system** with WebSocket communication ✅
- **React frontend** with Vite dev server ✅
- **Hybrid state management**:
  - In-memory: Active games (fast, ephemeral)
  - PostgreSQL: Player stats, match history, card balance data
- **Railway-optimized deployment** with PostgreSQL addon

## Railway PostgreSQL Setup
```bash
# Add PostgreSQL to Railway project
railway add postgresql

# Environment variables automatically added:
# DATABASE_URL, PGDATABASE, PGHOST, PGPASSWORD, PGPORT, PGUSER

# Local development with Railway PostgreSQL
railway run npm run dev
```

## Database Schema (PostgreSQL)
```sql
-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  current_rating INTEGER DEFAULT 1000
);

-- Match history
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  match_type VARCHAR(50), -- 'quick', 'ranked', 'tournament'
  duration_seconds INTEGER,
  rounds_played INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Card performance tracking
CREATE TABLE card_stats (
  card_id VARCHAR(50) PRIMARY KEY, -- e.g., 'heavy_5', 'light_ace'
  times_played INTEGER DEFAULT 0,
  times_won INTEGER DEFAULT 0,
  avg_round_played DECIMAL(3,2),
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Balance test results (uploaded from local)
CREATE TABLE balance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date TIMESTAMP DEFAULT NOW(),
  total_matches INTEGER,
  results JSONB, -- Detailed win matrices
  recommendations TEXT
);
```

## Development Phases

### Phase 1: Foundation ✅ COMPLETED
- Arena selector, role selection, basic UI

### Phase 2: Real Card Combat System 🎯 CURRENT
**Step 6: Gladiator Card Implementation**
```javascript
// Transition from simple 1-5 cards to full system
const CARD_TYPES = {
  LIGHT: { attack: 4, block: 1, stamina: 5, health: 5 },
  MEDIUM: { attack: 2, block: 2, stamina: 10, health: 5 },
  HEAVY: { attack: 1, block: 4, stamina: 5, health: 5 }
};

// Card definitions from Ludus TTRPG
const GLADIATOR_CARDS = {
  light: {
    1: { name: 'Ace', attack: 3, block: 0, stamina: 0 },
    2: { name: 'Blind Strike', attack: 1, block: 0, stamina: -5, special: 'removeFromGame' },
    // ... full card set
  },
  medium: { /* ... */ },
  heavy: { /* ... */ }
};
```

**Step 7: Posturing & Battle Phases**
- Select gladiator type before match
- Deal 10 gladiator cards + 5 heat cards
- Posturing: Play 3 cards face down
- Optional discard for stamina cost
- Battle: Simultaneous reveal & resolution

**Step 8: Combat Resolution Engine**
- Calculate total attack vs total block
- Apply unblocked damage to HP
- Track stamina (gas out mechanics)
- Handle armor persistence
- Process Heat card special abilities

### Phase 3: Database Integration
**Step 9: Player Persistence**
```javascript
// server.js additions
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Track player stats
async function recordMatch(matchData) {
  await pool.query(
    'INSERT INTO matches (player1_id, player2_id, winner_id, match_type, duration_seconds, rounds_played) VALUES ($1, $2, $3, $4, $5, $6)',
    [matchData.player1_id, matchData.player2_id, matchData.winner_id, matchData.type, matchData.duration, matchData.rounds]
  );
}
```

**Step 10: Card Balance Tracking**
- Log every card played with context
- Track win rates by card
- Export data for local analysis
- Upload balance reports from local testing

### Phase 4: AI Opponents
**Step 11: Basic AI Implementation**
```javascript
// AI runs on server for single player
class GladiatorAI {
  constructor(personality) {
    this.personality = personality; // 'aggressive', 'defensive', 'balanced'
  }
  
  selectCards(hand, gameState) {
    // Decision logic based on personality
    // Returns 3 card indices for posturing phase
  }
  
  makeDiscardDecision(hand, stamina) {
    // Personality-driven discard choices
  }
}
```

**Step 12: Local Balance Testing**
```javascript
// balance-tester.js (runs locally, not on Railway)
async function runBalanceTests() {
  const results = await simulateMatches(10000);
  const report = analyzeResults(results);
  
  // Upload summary to Railway PostgreSQL
  await uploadBalanceReport(report);
}
```

### Phase 5: UI Polish & Mobile
**Step 13: Card UI Components**
- Visual card representations
- Drag or click to play
- Animation system for reveals
- Mobile-responsive layout

**Step 14: Match Statistics**
- Post-match summary
- Player rating changes
- Card performance display
- Rematch options

## File Structure
```
cloud-dice-v2/
├── server.js (MODIFY - add PostgreSQL, AI logic)
├── db/
│   ├── schema.sql (NEW - database structure)
│   ├── migrations/ (NEW - database versioning)
│   └── queries.js (NEW - database helpers)
├── game-logic/
│   ├── gladiator-cards.js (NEW - card definitions)
│   ├── combat-engine.js (NEW - battle resolution)
│   ├── ai-players.js (NEW - AI opponents)
│   └── balance-tracker.js (NEW - stats collection)
├── client/src/components/
│   ├── GameRoom.jsx (MODIFY - arena modes)
│   ├── GladiatorArena.jsx (MODIFY - full combat)
│   ├── CardDisplay.jsx (NEW - visual cards)
│   ├── CombatPhases.jsx (NEW - phase management)
│   └── MatchStats.jsx (NEW - statistics display)
└── tools/
    ├── balance-tester.js (NEW - local simulation)
    └── db-backup.js (NEW - data export)
```

## Socket Events (Extended)
```javascript
// Player Management
'register-player' → { name: string } // Create/retrieve player
'get-player-stats' → { playerId: string }

// Gladiator Selection
'select-gladiator-type' → { type: 'light'|'medium'|'heavy' }

// Combat Phases
'start-posturing' → { roomId: string }
'play-cards' → { cards: [index, index, index] }
'discard-cards' → { cards: [index], staminaCost: number }
'ready-for-battle' → { playerId: string }
'resolve-battle' → { /* automated */ }

// AI Opponents
'request-ai-opponent' → { difficulty: 'easy'|'normal'|'hard' }
'ai-turn-complete' → { /* AI actions */ }
```

## State Management (Hybrid)
```javascript
// In-memory (server RAM)
const activeGames = {
  [roomId]: {
    players: [...],
    gameState: {
      phase: 'posturing'|'battle'|'end',
      playerHands: { /* current cards */ },
      battlefield: { /* played cards */ },
      hp: { player1: 10, player2: 10 },
      stamina: { player1: 24, player2: 24 },
      armor: { player1: 0, player2: 0 }
    }
  }
};

// PostgreSQL (persistent)
// - Player profiles and ratings
// - Match history and results
// - Card performance metrics
// - Balance test reports
```

## Testing Strategy
**Development Testing:**
1. Unit tests for combat engine
2. Integration tests for Socket.IO events
3. Multi-browser manual testing
4. AI vs AI automated testing (local)

**Balance Testing (Local Only):**
```bash
# Run locally to avoid Railway costs
node tools/balance-tester.js --matches 10000 --output report.json
node tools/upload-balance-report.js report.json
```

## Performance Optimizations
- **Stateless game resolution** - can recover from crashes
- **Batch database writes** - queue match results
- **Client-side animations** - reduce server load
- **Compression for card data** - minimize payload size

## Railway-Specific Considerations
- **Graceful shutdown** - save active games before restart
- **Database connection pooling** - reuse connections
- **Environment-based config** - dev vs production
- **Health checks** - include database status

## Success Metrics
- Sub-100ms card play response time
- 95%+ uptime with automatic recovery
- Balanced win rates (45-55% for each gladiator type)
- Player retention through progression system
- <$50/month Railway hosting costs

## Current Focus: Step 6-8 Implementation
1. Replace simple 1-5 cards with full gladiator cards
2. Implement posturing and battle phases
3. Add combat resolution with all mechanics
4. Test with existing multiplayer infrastructure
5. Ensure dice mode still works perfectly

## Future Roadmap
- Tournament brackets
- Seasonal rankings
- Card pack expansions
- Spectator mode enhancements
- Mobile app consideration