// game-logic/gladiator-cards.js - Card definitions from Ludus TTRPG

// Gladiator type base stats
const GLADIATOR_TYPES = {
  LIGHT: {
    name: 'Light',
    baseAttack: 4,
    baseBlock: 1,
    baseStamina: 5,
    baseHealth: 5,
    staminaDrain: 1,
    evasionBonus: 3
  },
  MEDIUM: {
    name: 'Medium',
    baseAttack: 2,
    baseBlock: 2,
    baseStamina: 10,
    baseHealth: 5,
    staminaDrain: 3,
    evasionBonus: 1
  },
  HEAVY: {
    name: 'Heavy',
    baseAttack: 1,
    baseBlock: 4,
    baseStamina: 5,
    baseHealth: 5,
    staminaDrain: 4,
    evasionBonus: 0
  }
};

// Light Gladiator Cards (Spades in original)
const LIGHT_CARDS = {
  ace: {
    id: 'light_ace',
    name: 'Swift Strike',
    attack: 3,
    block: 0,
    stamina: 0,
    special: null
  },
  2: {
    id: 'light_2',
    name: 'Blind Strike',
    attack: 1,
    block: 0,
    stamina: -5,
    special: 'removeFromGame',
    description: 'Remove from game after use'
  },
  3: {
    id: 'light_3',
    name: 'Desperate Dodge',
    attack: 0,
    block: 0,
    stamina: -5,
    special: 'removeFromGame',
    description: 'Remove from game after use'
  }
};
// Continue Light Cards
const LIGHT_CARDS_CONTINUED = {
  4: {
    id: 'light_4',
    name: 'Precise Strike',
    attack: 3,
    block: 1,
    stamina: 0,
    special: null
  },
  5: {
    id: 'light_5',
    name: 'Dancing Blade',
    attack: 3,
    block: 0,
    stamina: 0,
    special: null
  },
  6: {
    id: 'light_6',
    name: 'Quick Guard',
    attack: 2,
    block: 1,
    stamina: 0,
    special: null
  },
  7: {
    id: 'light_7',
    name: 'Stamina Burst',
    attack: 1,
    block: 1,
    stamina: 3,
    special: null
  }
};
// More Light Cards
const LIGHT_CARDS_FINAL = {
  8: {
    id: 'light_8',
    name: 'Defensive Dance',
    attack: 1,
    block: 2,
    stamina: 3,
    special: null
  },
  9: {
    id: 'light_9',
    name: 'Aggressive Assault',
    attack: 3,
    block: 1,
    stamina: 2,
    special: null
  },
  10: {
    id: 'light_10',
    name: 'All Out Attack',
    attack: 2,
    block: 0,
    stamina: -5,
    special: 'removeFromGame',
    description: 'Remove from game after use'
  }
};

// Merge all light cards
const LIGHT_DECK = {
  ...LIGHT_CARDS,
  ...LIGHT_CARDS_CONTINUED,
  ...LIGHT_CARDS_FINAL
};
// Medium Gladiator Cards (Clubs in original)
const MEDIUM_DECK = {
  ace: {
    id: 'medium_ace',
    name: 'Balanced Strike',
    attack: 3,
    block: 1,
    stamina: 0,
    special: null
  },
  2: {
    id: 'medium_2',
    name: 'Shield Bash',
    attack: 2,
    block: 1,
    stamina: 0,
    special: null
  },
  3: {
    id: 'medium_3',
    name: 'Defensive Stance',
    attack: 2,
    block: 2,
    stamina: 0,
    special: null
  },
  4: {
    id: 'medium_4',
    name: 'Cautious Advance',
    attack: 1,
    block: 2,
    stamina: 1,
    special: null
  },
  5: {
    id: 'medium_5',
    name: 'Stamina Conservation',
    attack: 1,
    block: 2,
    stamina: 2,
    special: null
  }
};
// Continue Medium Cards
const MEDIUM_DECK_CONTINUED = {
  6: {
    id: 'medium_6',
    name: 'Stamina Builder',
    attack: 2,
    block: 1,
    stamina: 2,
    special: null
  },
  7: {
    id: 'medium_7',
    name: 'Endurance Fighter',
    attack: 1,
    block: 2,
    stamina: 3,
    special: null
  },
  8: {
    id: 'medium_8',
    name: 'Balanced Defense',
    attack: 2,
    block: 2,
    stamina: 3,
    special: null
  },
  9: {
    id: 'medium_9',
    name: 'Power Strike',
    attack: 3,
    block: 0,
    stamina: 3,
    special: null
  },
  10: {
    id: 'medium_10',
    name: 'Total Defense',
    attack: 0,
    block: 3,
    stamina: 4,
    special: null
  }
};
// Merge Medium deck
Object.assign(MEDIUM_DECK, MEDIUM_DECK_CONTINUED);

// Heavy Gladiator Cards (Diamonds in original)
const HEAVY_DECK = {
  ace: {
    id: 'heavy_ace',
    name: 'Crushing Blow',
    attack: 0,
    block: 4,
    stamina: 0,
    special: null
  },
  2: {
    id: 'heavy_2',
    name: 'Shield Wall',
    attack: 0,
    block: 3,
    stamina: 0,
    special: null
  },
  3: {
    id: 'heavy_3',
    name: 'Armored Advance',
    attack: 2,
    block: 0,
    stamina: 0,
    special: null
  },
  4: {
    id: 'heavy_4',
    name: 'Defensive Strike',
    attack: 1,
    block: 2,
    stamina: 0,
    special: null
  }
};
// Continue Heavy Cards
const HEAVY_DECK_CONTINUED = {
  5: {
    id: 'heavy_5',
    name: 'Armor Up',
    attack: 1,
    block: 2,
    stamina: -1,
    armor: 1,
    special: 'addArmor',
    description: 'Gain 1 armor'
  },
  6: {
    id: 'heavy_6',
    name: 'Heavy Armor',
    attack: 0,
    block: 0,
    stamina: -2,
    armor: 2,
    special: 'addArmor',
    description: 'Gain 2 armor'
  },
  7: {
    id: 'heavy_7',
    name: 'Balanced Heavy',
    attack: 1,
    block: 3,
    stamina: 2,
    special: null
  },
  8: {
    id: 'heavy_8',
    name: 'Armor Specialist',
    attack: 2,
    block: 2,
    stamina: -2,
    armor: 2,
    special: 'addArmor',
    description: 'Gain 2 armor'
  }
};
// Final Heavy Cards
const HEAVY_DECK_FINAL = {
  9: {
    id: 'heavy_9',
    name: 'Fortress Mode',
    attack: 1,
    block: 3,
    stamina: -2,
    armor: 2,
    special: 'addArmor',
    description: 'Gain 2 armor'
  },
  10: {
    id: 'heavy_10',
    name: 'Maximum Defense',
    attack: 0,
    block: 0,
    stamina: -3,
    armor: 3,
    special: 'addArmor',
    description: 'Gain 3 armor'
  }
};

// Merge Heavy deck
Object.assign(HEAVY_DECK, HEAVY_DECK_CONTINUED, HEAVY_DECK_FINAL);

// Heat of Battle Cards (Hearts in original)
const HEAT_OF_BATTLE_DECK = {
  ace: {
    id: 'heat_ace',
    name: 'Brick Shithouse',
    stamina: -10,
    effect: 'block5armor10',
    timing: 'immediate',
    description: 'Gain 5 block and 10 armor'
  }
};
// Continue Heat of Battle Cards
const HEAT_CARDS_CONTINUED = {
  king: {
    id: 'heat_king',
    name: 'Caesar\'s Mercy',
    stamina: 'all',
    effect: 'endRound',
    timing: 'battleStart',
    removeFromGame: true,
    description: 'Return all cards, reshuffle, all players gas out next round'
  },
  queen: {
    id: 'heat_queen',
    name: 'Sacrificial Queen',
    stamina: 'all',
    effect: 'negateAllDamage',
    timing: 'battleEnd',
    removeFromGame: true,
    description: 'Negate all damage this round, gas out'
  },
  jack: {
    id: 'heat_jack',
    name: 'The Pointy End',
    stamina: -8,
    effect: 'addAttack2',
    timing: 'battleStart',
    description: 'Add 2 attack, replace this card with one from hand'
  },
  10: {
    id: 'heat_10',
    name: 'Desperate Gambit',
    stamina: -4,
    effect: 'randomDiscard',
    timing: 'posturing',
    description: 'Each player randomly discards one face-down card'
  }
};
// More Heat Cards
const HEAT_CARDS_FINAL = {
  9: {
    id: 'heat_9',
    name: 'The Sneaky Peek',
    stamina: -4,
    effect: 'peek3draw1',
    timing: 'immediate',
    description: 'Peek at top 3 cards, draw 1'
  },
  8: {
    id: 'heat_8',
    name: 'Adrenaline Rush',
    stamina: -3,
    effect: 'extraCard',
    timing: 'posturing',
    description: 'Draw one extra card this round'
  },
  7: {
    id: 'heat_7',
    name: 'Hera\'s Blessing',
    stamina: -5,
    effect: 'heal5',
    timing: 'immediate',
    description: 'Heal 5 damage (max to starting HP)'
  },
  6: {
    id: 'heat_6',
    name: 'Divine Intervention',
    stamina: -6,
    effect: 'reshuffleHand',
    timing: 'posturing',
    description: 'Shuffle hand back into deck, draw new hand'
  },
  5: {
    id: 'heat_5',
    name: 'Paragon of Balance',
    stamina: 0,
    effect: 'freeDiscard',
    timing: 'posturing',
    removeFromGame: true,
    description: 'Discard cards for free this phase'
  },
  4: {
    id: 'heat_4',
    name: 'Second Wind',
    stamina: -2,
    effect: 'staminaBoost5',
    timing: 'immediate',
    description: 'Gain 5 stamina immediately'
  },
  3: {
    id: 'heat_3',
    name: 'Elegant Defence',
    stamina: -5,
    effect: 'addEvasion',
    timing: 'battle',
    description: 'Add highest evasion score to block'
  },
  2: {
    id: 'heat_2',
    name: 'Crowd Favorite',
    stamina: -7,
    effect: 'doubleAttack',
    timing: 'battle',
    description: 'Double your total attack this round'
  },
  joker: {
    id: 'heat_joker',
    name: 'Wild Card',
    stamina: -1,
    effect: 'copyOpponent',
    timing: 'battle',
    description: 'Copy one of opponent\'s played cards'
  }
};

// Merge Heat deck
Object.assign(HEAT_OF_BATTLE_DECK, HEAT_CARDS_CONTINUED, HEAT_CARDS_FINAL);
// Utility functions for deck building
function buildGladiatorDeck(gladiatorType) {
  const deckMap = {
    'light': LIGHT_DECK,
    'medium': MEDIUM_DECK,
    'heavy': HEAVY_DECK
  };
  
  const selectedDeck = deckMap[gladiatorType.toLowerCase()];
  if (!selectedDeck) {
    throw new Error(`Invalid gladiator type: ${gladiatorType}`);
  }
  
  // Convert to array for easier shuffling
  return Object.entries(selectedDeck).map(([key, card]) => ({
    ...card,
    originalKey: key
  }));
}

function buildHeatDeck() {
  return Object.entries(HEAT_OF_BATTLE_DECK).map(([key, card]) => ({
    ...card,
    originalKey: key
  }));
}

function createPlayerDeck(gladiatorType) {
  const gladiatorCards = buildGladiatorDeck(gladiatorType);
  const heatCards = buildHeatDeck();
  
  // Standard deck is 10 gladiator + 5 heat cards
  // For MVP, take all gladiator cards and random 5 heat cards
  const shuffledHeat = [...heatCards].sort(() => Math.random() - 0.5);
  const selectedHeat = shuffledHeat.slice(0, 5);
  
  return {
    cards: [...gladiatorCards, ...selectedHeat],
    gladiatorType: gladiatorType
  };
}

export {
  GLADIATOR_TYPES,
  LIGHT_DECK,
  MEDIUM_DECK,
  HEAVY_DECK,
  HEAT_OF_BATTLE_DECK,
  buildGladiatorDeck,
  buildHeatDeck,
  createPlayerDeck
};