// game-logic/combat-engine.js - Core combat mechanics for gladiator arena

import { GLADIATOR_TYPES, createPlayerDeck } from './gladiator-cards.js';

// Game phases
export const GAME_PHASES = {
  SELECTION: 'selection',
  POSTURING: 'posturing', 
  DISCARD: 'discard',
  BATTLE: 'battle',
  ROUND_END: 'round-end',
  GAME_END: 'game-end'
};

// Create initial game state for a gladiator match
export function createGameState(roomId, players) {
  const gameState = {
    roomId,
    phase: GAME_PHASES.SELECTION,
    round: 0,
    players: {},
    activePlayers: [], // Array of player IDs who are fighters
    spectators: [], // Array of player IDs who are spectators
    lastActivity: Date.now()
  };

  // Initialize player data
  players.forEach(player => {
    if (player.role === 'fighter') {
      gameState.players[player.id] = {
        id: player.id,
        name: player.name,
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
        selectedCards: [] // For posturing phase
      };
      gameState.activePlayers.push(player.id);
    } else {
      gameState.spectators.push(player.id);
    }
  });

  return gameState;
}

// Initialize player decks after gladiator type selection
export function initializePlayerDecks(gameState) {
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    if (!player.gladiatorType) {
      throw new Error(`Player ${playerId} must select gladiator type first`);
    }

    // Create player deck (10 gladiator + 5 heat cards)
    const deckData = createPlayerDeck(player.gladiatorType);
    player.deck = shuffleDeck([...deckData.cards]);
    
    // Update stamina based on gladiator type
    const gladiatorStats = GLADIATOR_TYPES[player.gladiatorType.toUpperCase()];
    player.maxStamina = gladiatorStats.baseStamina * 4 + 4; // Base formula from TTRPG
    player.stamina = player.maxStamina;
    
    // Deal initial hand (7 cards)
    player.hand = player.deck.splice(0, 7);
  }
}

// Shuffle array utility
function shuffleDeck(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Draw cards from deck
export function drawCards(player, count) {
  const drawn = [];
  for (let i = 0; i < count && player.deck.length > 0; i++) {
    drawn.push(player.deck.shift());
  }
  player.hand.push(...drawn);
  return drawn;
}

// Start a new round
export function startNewRound(gameState) {
  gameState.round++;
  gameState.phase = GAME_PHASES.POSTURING;
  
  // Reset round state for all players
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    player.playedCards = [];
    player.selectedCards = [];
    player.isReady = false;
    
    // Check for gas out recovery
    if (player.isGassedOut) {
      // Recover some stamina when gassed out
      const gladiatorStats = GLADIATOR_TYPES[player.gladiatorType.toUpperCase()];
      player.stamina = Math.min(player.maxStamina, player.stamina + gladiatorStats.baseStamina);
      
      // Check if recovered enough to continue fighting
      if (player.stamina >= 5) {
        player.isGassedOut = false;
      }
    }
    
    // Draw cards if needed (back to 7 in hand)
    const cardsNeeded = 7 - player.hand.length;
    if (cardsNeeded > 0) {
      drawCards(player, cardsNeeded);
    }
  }
  
  gameState.lastActivity = Date.now();
}

// Check if all players are ready for current phase
export function allPlayersReady(gameState) {
  return gameState.activePlayers.every(playerId => 
    gameState.players[playerId].isReady
  );
}

// Get game state summary for clients
export function getGameStateSummary(gameState, playerId) {
  const player = gameState.players[playerId];
  const isSpectator = gameState.spectators.includes(playerId);
  
  return {
    phase: gameState.phase,
    round: gameState.round,
    myRole: isSpectator ? 'spectator' : 'fighter',
    myStats: player ? {
      hp: player.hp,
      maxHp: player.maxHp,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      armor: player.armor,
      handSize: player.hand.length,
      isGassedOut: player.isGassedOut,
      gladiatorType: player.gladiatorType
    } : null,
    opponents: gameState.activePlayers
      .filter(id => id !== playerId)
      .map(id => ({
        id,
        name: gameState.players[id].name,
        hp: gameState.players[id].hp,
        maxHp: gameState.players[id].maxHp,
        stamina: gameState.players[id].stamina,
        maxStamina: gameState.players[id].maxStamina,
        armor: gameState.players[id].armor,
        handSize: gameState.players[id].hand.length,
        isGassedOut: gameState.players[id].isGassedOut,
        gladiatorType: gameState.players[id].gladiatorType,
        isReady: gameState.players[id].isReady
      })),
    lastActivity: gameState.lastActivity
  };
}

// POSTURING PHASE FUNCTIONS

// Player selects 3 cards for posturing phase
export function selectCardsForPosturing(gameState, playerId, cardIndices) {
  if (gameState.phase !== GAME_PHASES.POSTURING) {
    throw new Error('Not in posturing phase');
  }
  
  if (cardIndices.length !== 3) {
    throw new Error('Must select exactly 3 cards');
  }
  
  const player = gameState.players[playerId];
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Validate card indices
  for (const index of cardIndices) {
    if (index < 0 || index >= player.hand.length) {
      throw new Error(`Invalid card index: ${index}`);
    }
  }
  
  // Check for duplicates
  if (new Set(cardIndices).size !== cardIndices.length) {
    throw new Error('Cannot select the same card multiple times');
  }
  
  // Store selected cards (face down)
  player.selectedCards = cardIndices.map(index => ({
    card: player.hand[index],
    handIndex: index
  }));
  
  player.isReady = true;
  gameState.lastActivity = Date.now();
  
  return player.selectedCards;
}

// Check if both players have selected cards and advance to discard phase
export function checkPosturingComplete(gameState) {
  if (gameState.phase !== GAME_PHASES.POSTURING) {
    return false;
  }
  
  if (!allPlayersReady(gameState)) {
    return false;
  }
  
  // Move to discard phase
  gameState.phase = GAME_PHASES.DISCARD;
  
  // Reset ready states for discard phase
  for (const playerId of gameState.activePlayers) {
    gameState.players[playerId].isReady = false;
  }
  
  return true;
}

// Get selected cards for a player (for UI display)
export function getSelectedCards(gameState, playerId) {
  const player = gameState.players[playerId];
  if (!player || !player.selectedCards) {
    return [];
  }
  
  return player.selectedCards.map(selection => ({
    ...selection.card,
    selected: true
  }));
}

// Clear player selections (if they want to reselect)
export function clearCardSelection(gameState, playerId) {
  if (gameState.phase !== GAME_PHASES.POSTURING) {
    throw new Error('Can only clear selection during posturing phase');
  }
  
  const player = gameState.players[playerId];
  if (!player) {
    throw new Error('Player not found');
  }
  
  player.selectedCards = [];
  player.isReady = false;
  gameState.lastActivity = Date.now();
}

// DISCARD PHASE FUNCTIONS

// Skip discard phase for now, go straight to battle
export function skipDiscardPhase(gameState) {
  if (gameState.phase !== GAME_PHASES.DISCARD) {
    throw new Error('Not in discard phase');
  }
  
  gameState.phase = GAME_PHASES.BATTLE;
  
  // Reset ready states for battle phase
  for (const playerId of gameState.activePlayers) {
    gameState.players[playerId].isReady = true; // Auto-ready for battle
  }
  
  return true;
}

// BATTLE PHASE FUNCTIONS

// Resolve combat between all players
export function resolveBattle(gameState) {
  if (gameState.phase !== GAME_PHASES.BATTLE) {
    throw new Error('Not in battle phase');
  }
  
  const battleResults = {};
  
  // Calculate each player's totals
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    
    if (!player.selectedCards || player.selectedCards.length !== 3) {
      throw new Error(`Player ${playerId} has not selected 3 cards`);
    }
    
    // Calculate base totals from selected cards
    let totalAttack = 0;
    let totalBlock = 0;
    let staminaChange = 0;
    let armorGain = 0;
    
    const playedCards = [];
    
    for (const selection of player.selectedCards) {
      const card = selection.card;
      
      totalAttack += card.attack || 0;
      totalBlock += card.block || 0;
      staminaChange += (card.stamina !== undefined) ? card.stamina : 0;
      
      // Handle armor cards
      if (card.special === 'addArmor' && card.armor) {
        armorGain += card.armor;
      }
      
      playedCards.push(card);
    }
    
    // Add gladiator type bonuses
    const gladiatorStats = GLADIATOR_TYPES[player.gladiatorType.toUpperCase()];
    totalAttack += gladiatorStats.baseAttack;
    totalBlock += gladiatorStats.baseBlock;
    
    // Apply gas out penalties
    if (player.isGassedOut) {
      totalAttack = Math.max(0, totalAttack - 2); // -2 attack when gassed out
      totalBlock = Math.max(0, totalBlock - 1);   // -1 block when gassed out
    }
    
    // Add existing armor to block
    totalBlock += player.armor;
    
    battleResults[playerId] = {
      playerId,
      playerName: player.name,
      totalAttack,
      totalBlock,
      staminaChange,
      armorGain,
      playedCards,
      hpBefore: player.hp,
      staminaBefore: player.stamina
    };
  }
  
  // Apply damage between players (2-player for now)
  const playerIds = gameState.activePlayers;
  if (playerIds.length === 2) {
    const [p1Id, p2Id] = playerIds;
    const p1Result = battleResults[p1Id];
    const p2Result = battleResults[p2Id];
    
    // Calculate damage dealt
    const p1Damage = Math.max(0, p1Result.totalAttack - p2Result.totalBlock);
    const p2Damage = Math.max(0, p2Result.totalAttack - p1Result.totalBlock);
    
    // Apply damage
    gameState.players[p1Id].hp = Math.max(0, gameState.players[p1Id].hp - p2Damage);
    gameState.players[p2Id].hp = Math.max(0, gameState.players[p2Id].hp - p1Damage);
    
    // Apply stamina changes and check for gas out
    gameState.players[p1Id].stamina = Math.max(0, gameState.players[p1Id].stamina + p1Result.staminaChange);
    gameState.players[p2Id].stamina = Math.max(0, gameState.players[p2Id].stamina + p2Result.staminaChange);
    
    // Check for gas out (stamina drops to 0)
    if (gameState.players[p1Id].stamina === 0) {
      gameState.players[p1Id].isGassedOut = true;
    }
    if (gameState.players[p2Id].stamina === 0) {
      gameState.players[p2Id].isGassedOut = true;
    }
    
    // Apply armor gains
    gameState.players[p1Id].armor += p1Result.armorGain;
    gameState.players[p2Id].armor += p2Result.armorGain;
    
    // Update results with final values
    p1Result.damageDealt = p1Damage;
    p1Result.damageTaken = p2Damage;
    p1Result.hpAfter = gameState.players[p1Id].hp;
    p1Result.staminaAfter = gameState.players[p1Id].stamina;
    p1Result.armorAfter = gameState.players[p1Id].armor;
    
    p2Result.damageDealt = p2Damage;
    p2Result.damageTaken = p1Damage;
    p2Result.hpAfter = gameState.players[p2Id].hp;
    p2Result.staminaAfter = gameState.players[p2Id].stamina;
    p2Result.armorAfter = gameState.players[p2Id].armor;
  }
  
  // Move played cards to discard pile and remove from hand
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    
    // Remove selected cards from hand (in reverse order to maintain indices)
    const indicesToRemove = player.selectedCards
      .map(s => s.handIndex)
      .sort((a, b) => b - a);
      
    for (const index of indicesToRemove) {
      const removedCard = player.hand.splice(index, 1)[0];
      player.discardPile.push(removedCard);
    }
    
    player.playedCards = player.selectedCards.map(s => s.card);
    player.selectedCards = [];
  }
  
  gameState.phase = GAME_PHASES.ROUND_END;
  gameState.lastActivity = Date.now();
  
  return battleResults;
}

// Check if game is over (someone reached 0 HP)
export function checkGameEnd(gameState) {
  const alivePlayers = gameState.activePlayers.filter(playerId => 
    gameState.players[playerId].hp > 0
  );
  
  if (alivePlayers.length <= 1) {
    gameState.phase = GAME_PHASES.GAME_END;
    return {
      gameOver: true,
      winner: alivePlayers.length === 1 ? alivePlayers[0] : null,
      winnerName: alivePlayers.length === 1 ? gameState.players[alivePlayers[0]].name : 'Draw'
    };
  }
  
  return { gameOver: false };
}

// Validate game state
export function validateGameState(gameState) {
  if (!gameState.roomId || !gameState.phase) {
    return false;
  }
  
  if (gameState.activePlayers.length < 2) {
    return false;
  }
  
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    if (!player || player.hp < 0) {
      return false;
    }
  }
  
  return true;
}