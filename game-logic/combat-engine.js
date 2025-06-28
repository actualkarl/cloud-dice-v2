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
  
  // Process immediate Heat effects from selected cards
  const immediateEffects = [];
  for (const selection of player.selectedCards) {
    const card = selection.card;
    if (card.type === 'heat' && card.timing === 'immediate') {
      immediateEffects.push(card);
      
      // Apply immediate effects
      switch (card.effect) {
        case 'block5armor10':
          player.armor += 10;
          break;
          
        case 'heal5':
          player.hp = Math.min(player.maxHp, player.hp + 5);
          break;
          
        case 'peek3draw1':
          // Draw 1 card from deck
          if (player.deck.length > 0) {
            drawCards(player, 1);
          }
          break;
      }
      
      // Handle stamina cost
      if (typeof card.stamina === 'number') {
        player.stamina = Math.max(0, player.stamina + card.stamina);
        if (player.stamina === 0) {
          player.isGassedOut = true;
        }
      }
    }
  }
  
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
  
  // Process posturing phase Heat effects before moving to discard
  const posturingEffects = processHeatCardEffects(gameState, 'posturing');
  
  // Handle specific posturing effects
  for (const effect of posturingEffects) {
    if (effect.effect === 'randomDiscard') {
      // Each player randomly discards one face-down card
      for (const playerId of gameState.activePlayers) {
        const player = gameState.players[playerId];
        if (player.selectedCards.length > 0) {
          const randomIndex = Math.floor(Math.random() * player.selectedCards.length);
          const discarded = player.selectedCards.splice(randomIndex, 1)[0];
          player.discardPile.push(discarded.card);
        }
      }
    }
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

// Process player discard decision
export function processDiscard(gameState, playerId, cardIndices, useStaminaForDiscard = false) {
  if (gameState.phase !== GAME_PHASES.DISCARD) {
    throw new Error('Not in discard phase');
  }
  
  const player = gameState.players[playerId];
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Validate discard request
  if (cardIndices.length > 0) {
    // Check card indices are valid
    for (const index of cardIndices) {
      if (index < 0 || index >= player.hand.length) {
        throw new Error(`Invalid card index: ${index}`);
      }
    }
    
    // Check for duplicates
    if (new Set(cardIndices).size !== cardIndices.length) {
      throw new Error('Cannot discard the same card multiple times');
    }
    
    // If using stamina for discard, check stamina cost
    if (useStaminaForDiscard) {
      const staminaCost = cardIndices.length * 2; // 2 stamina per discarded card
      if (player.stamina < staminaCost) {
        throw new Error(`Not enough stamina (need ${staminaCost}, have ${player.stamina})`);
      }
      
      // Pay stamina cost
      player.stamina = Math.max(0, player.stamina - staminaCost);
      
      // Check for gas out
      if (player.stamina === 0) {
        player.isGassedOut = true;
      }
    }
    
    // Discard selected cards (in reverse order to maintain indices)
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    const discardedCards = [];
    
    for (const index of sortedIndices) {
      const discardedCard = player.hand.splice(index, 1)[0];
      player.discardPile.push(discardedCard);
      discardedCards.push(discardedCard);
    }
    
    // Draw replacement cards
    drawCards(player, cardIndices.length);
    
    player.discardedThisPhase = {
      cards: discardedCards,
      staminaCost: useStaminaForDiscard ? cardIndices.length * 2 : 0
    };
  } else {
    // Player chooses not to discard
    player.discardedThisPhase = {
      cards: [],
      staminaCost: 0
    };
  }
  
  player.isReady = true;
  gameState.lastActivity = Date.now();
  
  return player.discardedThisPhase;
}

// Check if all players have made discard decisions
export function checkDiscardComplete(gameState) {
  if (gameState.phase !== GAME_PHASES.DISCARD) {
    return false;
  }
  
  if (!allPlayersReady(gameState)) {
    return false;
  }
  
  // Move to battle phase
  gameState.phase = GAME_PHASES.BATTLE;
  
  // Reset ready states for battle phase  
  for (const playerId of gameState.activePlayers) {
    gameState.players[playerId].isReady = true; // Auto-ready for battle
  }
  
  return true;
}

// Skip discard phase (for compatibility)
export function skipDiscardPhase(gameState) {
  if (gameState.phase !== GAME_PHASES.DISCARD) {
    throw new Error('Not in discard phase');
  }
  
  // Set all players as having made no discards
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    player.discardedThisPhase = {
      cards: [],
      staminaCost: 0
    };
    player.isReady = true;
  }
  
  gameState.phase = GAME_PHASES.BATTLE;
  return true;
}

// BATTLE PHASE FUNCTIONS

// Process Heat card effects based on timing
function processHeatCardEffects(gameState, timing) {
  const effects = [];
  
  for (const playerId of gameState.activePlayers) {
    const player = gameState.players[playerId];
    
    for (const selection of player.selectedCards) {
      const card = selection.card;
      
      // Check if this is a Heat card with the right timing
      if (card.type === 'heat' && card.timing === timing) {
        effects.push({
          playerId,
          card,
          effect: card.effect
        });
        
        // Apply immediate effects
        switch (card.effect) {
          case 'block5armor10':
            player.armor += 10;
            // Block will be added in battle calculation
            break;
            
          case 'heal5':
            player.hp = Math.min(player.maxHp, player.hp + 5);
            break;
            
          case 'peek3draw1':
            // Draw 1 card from deck
            if (player.deck.length > 0) {
              drawCards(player, 1);
            }
            break;
            
          case 'extraCard':
            // Draw 1 extra card
            drawCards(player, 1);
            break;
        }
        
        // Handle stamina cost
        if (card.stamina === 'all') {
          player.stamina = 0;
          player.isGassedOut = true;
        } else if (typeof card.stamina === 'number') {
          player.stamina = Math.max(0, player.stamina + card.stamina);
          if (player.stamina === 0) {
            player.isGassedOut = true;
          }
        }
        
        // Remove card from game if needed
        if (card.removeFromGame) {
          player.removedCards.push(card);
        }
      }
    }
  }
  
  return effects;
}

// Resolve combat between all players
export function resolveBattle(gameState) {
  if (gameState.phase !== GAME_PHASES.BATTLE) {
    throw new Error('Not in battle phase');
  }
  
  // Process pre-battle Heat effects
  const preBattleEffects = processHeatCardEffects(gameState, 'battleStart');
  
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
    let heatBlockBonus = 0;
    let heatAttackBonus = 0;
    
    const playedCards = [];
    
    for (const selection of player.selectedCards) {
      const card = selection.card;
      
      totalAttack += card.attack || 0;
      totalBlock += card.block || 0;
      
      // Handle regular stamina (Heat card stamina handled separately)
      if (card.type !== 'heat' && card.stamina !== undefined) {
        staminaChange += card.stamina;
      }
      
      // Handle armor cards
      if (card.special === 'addArmor' && card.armor) {
        armorGain += card.armor;
      }
      
      // Handle Heat card battle bonuses
      if (card.type === 'heat') {
        switch (card.effect) {
          case 'block5armor10':
            heatBlockBonus += 5;
            break;
          case 'addAttack2':
            heatAttackBonus += 2;
            break;
        }
      }
      
      playedCards.push(card);
    }
    
    // Add gladiator type bonuses
    const gladiatorStats = GLADIATOR_TYPES[player.gladiatorType.toUpperCase()];
    totalAttack += gladiatorStats.baseAttack;
    totalBlock += gladiatorStats.baseBlock;
    
    // Add Heat card bonuses
    totalAttack += heatAttackBonus;
    totalBlock += heatBlockBonus;
    
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
      staminaBefore: player.stamina,
      heatEffects: preBattleEffects.filter(e => e.playerId === playerId)
    };
  }
  
  // Apply damage between players (2-player for now)
  const playerIds = gameState.activePlayers;
  if (playerIds.length === 2) {
    const [p1Id, p2Id] = playerIds;
    const p1Result = battleResults[p1Id];
    const p2Result = battleResults[p2Id];
    
    // Calculate evasion bonuses
    // Light gladiators get +1 evasion (block) when at full stamina
    let p1EvasionBonus = 0;
    let p2EvasionBonus = 0;
    
    const p1Gladiator = gameState.players[p1Id].gladiatorType;
    const p2Gladiator = gameState.players[p2Id].gladiatorType;
    
    if (p1Gladiator === 'light' && gameState.players[p1Id].stamina >= gameState.players[p1Id].maxStamina * 0.8) {
      p1EvasionBonus = 1;
    }
    if (p2Gladiator === 'light' && gameState.players[p2Id].stamina >= gameState.players[p2Id].maxStamina * 0.8) {
      p2EvasionBonus = 1;
    }
    
    // Apply evasion to block totals
    p1Result.totalBlock += p1EvasionBonus;
    p2Result.totalBlock += p2EvasionBonus;
    
    // Calculate damage dealt
    let p1Damage = Math.max(0, p1Result.totalAttack - p2Result.totalBlock);
    let p2Damage = Math.max(0, p2Result.totalAttack - p1Result.totalBlock);
    
    // Check for damage negation Heat effects (battleEnd timing)
    const postBattleEffects = processHeatCardEffects(gameState, 'battleEnd');
    
    // Check if any player has Sacrificial Queen (negateAllDamage)
    const hasNegation = postBattleEffects.some(effect => effect.effect === 'negateAllDamage');
    if (hasNegation) {
      p1Damage = 0;
      p2Damage = 0;
    }
    
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