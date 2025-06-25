# Cloud Dice V2 - Gladiator Card Combat Integration

## Project Overview
We're extending the existing real-time multiplayer dice roller to include a gladiator card combat system. The goal is to add flexible "arena modes" where users can switch between dice rolling and card-based combat while maintaining the same room/multiplayer infrastructure.

## Current Architecture
- **Real-time multiplayer** using Socket.IO + Express
- **Room-based system** with WebSocket communication
- **React frontend** with Vite dev server
- **In-memory state management** (no database)
- **Railway-optimized deployment**

## Development Approach
**Build incrementally with testable steps** - each feature should be fully functional and testable before moving to the next step.

## Implementation Plan

### Phase 1: Foundation (Steps 1-5) ✅ COMPLETED
1. Arena selector dropdown in room header
2. Role selection (Fighter vs Spectator) 
3. Basic fighter card display (private hands)
4. Spectator-only chat system
5. Basic betting interface (vote counting)

### Phase 2: Card Combat MVP (Steps 6-8) 🎯 CURRENT FOCUS
**Step 6: Card Selection Interface**
- Fighter interface: 5 clickable card buttons [1][2][3][4][5]
- Card highlighting when selected
- "Ready" button to lock selection
- Show opponent selection status (not card choice)

**Step 7: Simultaneous Reveal System** 
- Both players select cards secretly
- Simultaneous reveal when both ready
- Higher card wins round
- Visual feedback for round winner

**Step 8: Round Scoring & Match Completion**
- Track round wins: "Player 1: 2 wins, Player 2: 1 win"  
- First to 3 rounds wins match
- Used cards disappear after each round
- Match completion detection and winner announcement

### Phase 3: Enhanced Combat (Steps 9-11)
**Step 9: Card Types System**
- Heavy cards (3,4,5), Light cards (1,2,3), General cards (2,3,4)
- Dynamic deck building based on gladiator stats
- Visual card type indicators

**Step 10: Debug & Balance Tools**
- Host debug panel for live adjustments
- Auto-simulation for balance testing
- Data export for analysis

**Step 11: Campaign Integration**
- Persistent gladiator stats
- Match result tracking
- Tournament bracket system

## Technical Implementation Details

### File Structure Extensions
```
client/src/components/
├── GameRoom.jsx (MODIFY - add arena switching)
├── ArenaSelector.jsx (NEW - mode switching UI)
├── GladiatorArena.jsx (NEW - main gladiator component)
├── CardHand.jsx (NEW - fighter card interface)
├── SpectatorInterface.jsx (NEW - chat + betting)
└── CardCombat.jsx (NEW - combat resolution)
```

### Socket Event Schema
```javascript
// Arena Management
'switch-arena-mode' → { arenaType: 'dice'|'gladiator' }
'select-role' → { role: 'fighter'|'spectator' }

// Card Combat
'select-card' → { cardIndex: number, playerId: string }
'player-ready' → { playerId: string }
'reveal-cards' → { /* trigger simultaneous reveal */ }
'round-complete' → { winner: string, scores: object }
'match-complete' → { winner: string, finalScores: object }

// Spectator Features  
'spectator-chat' → { message: string, playerId: string }
'place-bet' → { bettingOn: string, playerId: string }
```

### State Management Extensions
```javascript
// Room state additions
{
  arenaType: 'dice' | 'gladiator',
  players: [
    { id, name, role: 'fighter'|'spectator', cardHand?, selectedCard? }
  ],
  gladiatorState: {
    currentRound: number,
    roundScores: { player1: number, player2: number },
    selectedCards: { player1?: number, player2?: number },
    readyPlayers: Set<string>,
    matchWinner?: string,
    spectatorBets: { player1: number, player2: number },
    chatHistory: []
  }
}
```

## Testing Protocol
**Multi-browser testing required for every step:**
1. **Chrome**: Host creates room, switches to gladiator mode
2. **Firefox**: Join as Fighter 1
3. **Chrome Incognito**: Join as Fighter 2  
4. **Edge/Safari**: Join as Spectators

**Success criteria for each step:**
- Feature works for intended user type
- Feature hidden/disabled for wrong user type  
- Real-time updates across all browser windows
- State persists through page refresh
- Error handling for edge cases

## Code Quality Standards
- **ES6 modules** throughout (maintain consistency)
- **Socket.IO event validation** using existing patterns
- **Error handling** for all async operations
- **Rate limiting** for new actions (prevent spam)
- **Security validation** for all user inputs
- **Responsive design** (mobile + desktop support)

## Current MVP Card Rules (Simple)
- Each fighter gets cards valued 1,2,3,4,5
- Secret simultaneous selection  
- Higher card wins round
- First to 3 round wins wins match
- Used cards are discarded
- No special abilities or card types (Phase 2 feature)

## Development Commands
```bash
# Development mode (both client + server)
npm run dev

# Individual components
npm run server:dev  # Server only
npm run client:dev  # Client only  

# Production build
npm run build
npm start
```

## Key Integration Points
1. **Preserve existing dice functionality** - no breaking changes
2. **Reuse Socket.IO infrastructure** - extend don't rebuild
3. **Maintain Railway deployment compatibility** 
4. **Follow existing error handling patterns**
5. **Use existing room ID + player management systems**

## Performance Considerations
- **Minimize socket event frequency** during card selection
- **Batch state updates** where possible
- **Efficient card hand rendering** (avoid re-renders)
- **Memory cleanup** for completed matches

## Debugging Support
- Maintain existing `/api/health` and room info endpoints
- Add gladiator-specific state in room data
- Console logging for all card combat events
- Error boundary components for React crashes

## Future Extensibility
Design with these future features in mind:
- Multiple simultaneous matches in one room
- Advanced card types with special abilities  
- Integration with the detailed TTRPG dice combat system
- Tournament bracket management
- Persistent campaign data storage

## Success Metrics
**Phase 2 MVP Success:**
- Complete 1v1 card matches with 4+ browser windows
- Zero breaking changes to existing dice functionality
- Smooth transitions between arena modes
- Spectators remain engaged throughout matches
- Sub-second response times for card plays

---

## Think Deeply Instructions
When tackling complex problems during this integration:

**Use "ultrathink" for:**
- Architecture decisions affecting multiple components
- Socket event design and state synchronization
- Performance optimization strategies
- Multi-browser testing edge cases

**Use "think hard" for:**
- Individual component implementation
- Error handling strategies  
- UI/UX design decisions

**Standard thinking for:**
- Simple bug fixes
- Style adjustments
- Minor feature additions