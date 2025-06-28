import { useState, useEffect } from 'react'

function GladiatorArena({ socket, room, playerName, players }) {
  // Add CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  // New combat engine state
  const [gamePhase, setGamePhase] = useState('selection')
  const [gladiatorType, setGladiatorType] = useState(null)
  const [hand, setHand] = useState([])
  const [selectedCardIndices, setSelectedCardIndices] = useState([])
  const [playerStats, setPlayerStats] = useState({ hp: 10, stamina: 24, armor: 0 })
  const [battleResults, setBattleResults] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [currentRound, setCurrentRound] = useState(0)
  const [playerRole, setPlayerRole] = useState(null)
  const [discardIndices, setDiscardIndices] = useState([])
  const [useStaminaForDiscard, setUseStaminaForDiscard] = useState(false)
  const [opponentInfo, setOpponentInfo] = useState(null)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)

  const currentPlayer = players.find(p => p.name === playerName)
  const isHost = currentPlayer?.isHost || false

  // Phase information
  const getPhaseInfo = () => {
    const phases = {
      'selection': {
        title: '⚔️ Preparation',
        description: 'Choose your role and gladiator type',
        step: 1,
        total: 5
      },
      'posturing': {
        title: '🎯 Posturing Phase',
        description: 'Select 3 cards to play face-down for battle',
        step: 2,
        total: 5
      },
      'discard': {
        title: '🔄 Discard Phase',
        description: 'Optionally discard cards for better ones (costs stamina)',
        step: 3,
        total: 5
      },
      'battle': {
        title: '⚔️ Battle Resolution',
        description: 'Cards are revealed and damage is calculated',
        step: 4,
        total: 5
      },
      'round-end': {
        title: '📊 Round Results',
        description: 'Review the battle outcome and prepare for next round',
        step: 5,
        total: 5
      }
    }
    return phases[gamePhase] || phases['selection']
  }

  useEffect(() => {
    if (!socket) return

    socket.on('gladiator-type-selected', (data) => {
      setGladiatorType(data.gladiatorType)
    })

    socket.on('gladiator-game-started', (data) => {
      setGamePhase(data.phase)
      setCurrentRound(data.round)
      setGameStarted(true)
    })

    socket.on('hand-dealt', (data) => {
      setHand(data.hand)
      setPlayerStats(data.stats)
    })

    socket.on('battle-resolved', (data) => {
      setBattleResults(data.results)
      setGamePhase('round-end')
      
      const myResults = Object.values(data.results).find(result => 
        result.playerName === playerName
      )
      if (myResults) {
        setPlayerStats({
          hp: myResults.hpAfter,
          stamina: myResults.staminaAfter,
          armor: myResults.armorAfter
        })
      }
    })

    socket.on('new-round-started', (data) => {
      setCurrentRound(data.round)
      setGamePhase('posturing')
      setHand(data.hand)
      setPlayerStats(data.stats)
      setSelectedCardIndices([])
      setBattleResults(null)
      setDiscardIndices([])
      setUseStaminaForDiscard(false)
    })

    socket.on('discard-phase-started', () => {
      setGamePhase('discard')
      setDiscardIndices([])
      setUseStaminaForDiscard(false)
    })

    socket.on('game-state-update', (data) => {
      if (data.opponents && data.opponents.length > 0) {
        setOpponentInfo(data.opponents[0]) // For 2-player combat
      }
      setWaitingForOpponent(!data.myStats?.isReady && data.opponents?.some(o => !o.isReady))
    })

    return () => {
      socket.off('gladiator-type-selected')
      socket.off('gladiator-game-started')
      socket.off('hand-dealt')
      socket.off('battle-resolved')
      socket.off('new-round-started')
      socket.off('discard-phase-started')
      socket.off('game-state-update')
    }
  }, [socket, playerName])

  // Set role from player data
  useEffect(() => {
    if (currentPlayer?.role) {
      setPlayerRole(currentPlayer.role)
    }
  }, [currentPlayer])

  const handleSelectGladiatorType = (type) => {
    if (socket) {
      socket.emit('select-gladiator-type', { gladiatorType: type })
    }
  }

  const handleCardClick = (cardIndex) => {
    if (gamePhase === 'posturing') {
      const newSelection = [...selectedCardIndices]
      const existingIndex = newSelection.indexOf(cardIndex)
      
      if (existingIndex >= 0) {
        newSelection.splice(existingIndex, 1)
      } else if (newSelection.length < 3) {
        newSelection.push(cardIndex)
      }
      
      setSelectedCardIndices(newSelection)
    } else if (gamePhase === 'discard') {
      const newDiscard = [...discardIndices]
      const existingIndex = newDiscard.indexOf(cardIndex)
      
      if (existingIndex >= 0) {
        newDiscard.splice(existingIndex, 1)
      } else {
        newDiscard.push(cardIndex)
      }
      
      setDiscardIndices(newDiscard)
    }
  }

  const handlePlayCards = () => {
    if (selectedCardIndices.length === 3 && socket) {
      socket.emit('play-cards', { cardIndices: selectedCardIndices })
    }
  }

  const handleDiscard = () => {
    if (socket) {
      socket.emit('gladiator-discard', { 
        cardIndices: discardIndices,
        useStamina: useStaminaForDiscard
      })
    }
  }

  const handleSelectRole = (role) => {
    if (socket) {
      socket.emit('select-role', { role })
      setPlayerRole(role)
    }
  }

  return (
    <div className="gladiator-arena">
      <div className="arena-content" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '15px',
        padding: '2rem',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>⚔️ Gladiator Arena</h2>
        
        {/* Phase Progress Indicator */}
        {gameStarted && (
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#4CAF50' }}>{getPhaseInfo().title}</h3>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                {getPhaseInfo().description}
              </p>
            </div>
            
            {/* Progress Bar */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '1rem'
            }}>
              {[1, 2, 3, 4, 5].map(step => (
                <div key={step} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  flex: 1
                }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: step <= getPhaseInfo().step ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {step <= getPhaseInfo().step ? '✓' : step}
                  </div>
                  {step < 5 && (
                    <div style={{
                      position: 'absolute',
                      width: '60px',
                      height: '2px',
                      backgroundColor: step < getPhaseInfo().step ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)',
                      marginLeft: '45px',
                      marginTop: '14px'
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Role Selection */}
        {!playerRole && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3>Choose Your Role</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={() => handleSelectRole('fighter')}
              >
                ⚔️ Fighter
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => handleSelectRole('spectator')}
              >
                👁️ Spectator
              </button>
            </div>
          </div>
        )}

        {/* Gladiator Type Selection */}
        {playerRole === 'fighter' && !gladiatorType && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h3>Choose Your Gladiator Type</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={() => handleSelectGladiatorType('light')}
              >
                🗡️ Light
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleSelectGladiatorType('medium')}
              >
                ⚔️ Medium
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleSelectGladiatorType('heavy')}
              >
                🛡️ Heavy
              </button>
            </div>
          </div>
        )}

        {/* Combat Status */}
        {gameStarted && playerRole === 'fighter' && (
          <div style={{ 
            display: 'flex', 
            gap: '2rem', 
            marginBottom: '2rem',
            justifyContent: 'center'
          }}>
            {/* Player Stats */}
            <div style={{ 
              flex: 1,
              padding: '1rem', 
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              textAlign: 'center'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>You ({gladiatorType})</h4>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.9rem' }}>
                <span>❤️ {playerStats.hp}</span>
                <span>⚡ {playerStats.stamina}</span>
                <span>🛡️ {playerStats.armor}</span>
              </div>
            </div>

            {/* Round Info */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: '100px'
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Round {currentRound}</div>
              {waitingForOpponent && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#FF9800',
                  marginTop: '0.5rem',
                  animation: 'pulse 2s infinite'
                }}>
                  ⏳ Waiting...
                </div>
              )}
            </div>

            {/* Opponent Stats */}
            {opponentInfo && (
              <div style={{ 
                flex: 1,
                padding: '1rem', 
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>
                  {opponentInfo.name} ({opponentInfo.gladiatorType})
                  {opponentInfo.isReady && <span style={{ color: '#4CAF50', marginLeft: '0.5rem' }}>✓</span>}
                </h4>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.9rem' }}>
                  <span>❤️ {opponentInfo.hp}</span>
                  <span>⚡ {opponentInfo.stamina}</span>
                  <span>🛡️ {opponentInfo.armor}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hand Display */}
        {gameStarted && playerRole === 'fighter' && hand.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4>Your Hand ({hand.length} cards)</h4>
            
            {/* Separate gladiator and heat cards */}
            {(() => {
              const gladiatorCards = hand.filter((card, index) => card.type !== 'heat').map((card, originalIndex) => ({
                card,
                index: hand.indexOf(card)
              }));
              const heatCards = hand.filter((card, index) => card.type === 'heat').map((card, originalIndex) => ({
                card,
                index: hand.indexOf(card)
              }));
              
              return (
                <div>
                  {/* Gladiator Cards */}
                  {gladiatorCards.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#4CAF50' }}>
                        ⚔️ Gladiator Cards ({gladiatorCards.length})
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {gladiatorCards.map(({ card, index }) => (
                          <div
                            key={index}
                            onClick={() => handleCardClick(index)}
                            title={`${card.name}: ${card.attack || 0} attack, ${card.block || 0} block${card.stamina ? `, ${card.stamina} stamina` : ''}`}
                            style={{
                              border: gamePhase === 'posturing' && selectedCardIndices.includes(index) ? '3px solid #4CAF50' : 
                                      gamePhase === 'discard' && discardIndices.includes(index) ? '3px solid #FF9800' : 
                                      '2px solid #4CAF50',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              minWidth: '120px',
                              cursor: (gamePhase === 'posturing' || gamePhase === 'discard') ? 'pointer' : 'default',
                              backgroundColor: gamePhase === 'posturing' && selectedCardIndices.includes(index) ? 'rgba(76, 175, 80, 0.3)' : 
                                               gamePhase === 'discard' && discardIndices.includes(index) ? 'rgba(255, 152, 0, 0.3)' : 
                                               'rgba(76, 175, 80, 0.1)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#4CAF50' }}>{card.name}</div>
                            <div style={{ fontSize: '0.8rem' }}>
                              ⚔️ {card.attack || 0} | 🛡️ {card.block || 0}
                            </div>
                            {card.stamina && <div style={{ fontSize: '0.8rem', color: '#2196F3' }}>⚡ {card.stamina}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Heat Cards */}
                  {heatCards.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#FF5722' }}>
                        🔥 Heat of Battle Cards ({heatCards.length})
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {heatCards.map(({ card, index }) => (
                          <div
                            key={index}
                            onClick={() => handleCardClick(index)}
                            title={`${card.name}: ${card.description || 'Special effect card'}`}
                            style={{
                              border: gamePhase === 'posturing' && selectedCardIndices.includes(index) ? '3px solid #4CAF50' : 
                                      gamePhase === 'discard' && discardIndices.includes(index) ? '3px solid #FF9800' : 
                                      '2px solid #FF5722',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              minWidth: '120px',
                              cursor: (gamePhase === 'posturing' || gamePhase === 'discard') ? 'pointer' : 'default',
                              backgroundColor: gamePhase === 'posturing' && selectedCardIndices.includes(index) ? 'rgba(76, 175, 80, 0.3)' : 
                                               gamePhase === 'discard' && discardIndices.includes(index) ? 'rgba(255, 152, 0, 0.3)' : 
                                               'rgba(255, 87, 34, 0.1)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#FF5722' }}>🔥 {card.name}</div>
                            <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              {card.description || 'Special Effect'}
                            </div>
                            {card.stamina && <div style={{ fontSize: '0.8rem', color: '#2196F3' }}>⚡ {card.stamina}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Play Cards Button */}
        {gamePhase === 'posturing' && playerRole === 'fighter' && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p>Select 3 cards for battle</p>
            <button 
              className="btn btn-primary"
              onClick={handlePlayCards}
              disabled={selectedCardIndices.length !== 3}
            >
              Play Selected Cards ({selectedCardIndices.length}/3)
            </button>
          </div>
        )}

        {/* Discard Phase UI */}
        {gamePhase === 'discard' && playerRole === 'fighter' && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 152, 0, 0.3)'
          }}>
            <h4 style={{ color: '#FF9800', marginBottom: '1rem' }}>🔄 Discard Phase</h4>
            
            <div style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                💡 <strong>Strategy Tip:</strong> Discard weak cards to draw potentially stronger ones
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>
                Click cards above to select them for discarding. Each card costs 2 stamina to discard.
              </p>
            </div>
            
            {discardIndices.length > 0 ? (
              <div>
                <div style={{ 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 193, 7, 0.3)'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    Selected {discardIndices.length} card{discardIndices.length !== 1 ? 's' : ''} for discard
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    💰 Cost: {discardIndices.length * 2} stamina 
                    (You have {playerStats.stamina} stamina)
                  </div>
                  {playerStats.stamina < discardIndices.length * 2 && (
                    <div style={{ color: '#f44336', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      ⚠️ Not enough stamina! You need {discardIndices.length * 2 - playerStats.stamina} more.
                    </div>
                  )}
                </div>
                
                <button 
                  className="btn btn-primary"
                  onClick={handleDiscard}
                  disabled={playerStats.stamina < discardIndices.length * 2}
                  style={{ 
                    fontSize: '1rem',
                    padding: '0.75rem 2rem',
                    backgroundColor: playerStats.stamina >= discardIndices.length * 2 ? '#FF9800' : '#666',
                    borderColor: playerStats.stamina >= discardIndices.length * 2 ? '#FF9800' : '#666'
                  }}
                >
                  💫 Discard & Draw New Cards
                </button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                  No cards selected. Click cards above to discard them, or continue with your current hand.
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={handleDiscard}
                  style={{ 
                    fontSize: '1rem',
                    padding: '0.75rem 2rem',
                    backgroundColor: '#4CAF50',
                    borderColor: '#4CAF50'
                  }}
                >
                  ✅ Keep Current Hand
                </button>
              </div>
            )}
          </div>
        )}

        {/* Battle Results */}
        {battleResults && (
          <div style={{ 
            marginBottom: '2rem', 
            padding: '2rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '15px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#4CAF50' }}>
              ⚔️ Battle Results
            </h4>
            
            {/* Battle Summary */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr auto 1fr',
              gap: '2rem',
              alignItems: 'center',
              marginBottom: '2rem'
            }}>
              {Object.values(battleResults).map((result, index) => {
                const isWinner = result.damageDealt > result.damageTaken;
                const isDraw = result.damageDealt === result.damageTaken;
                
                return (
                  <div key={result.playerId} style={{
                    padding: '1.5rem',
                    borderRadius: '10px',
                    border: `2px solid ${isWinner && !isDraw ? '#4CAF50' : isDraw ? '#FF9800' : '#f44336'}`,
                    backgroundColor: `rgba(${isWinner && !isDraw ? '76, 175, 80' : isDraw ? '255, 152, 0' : '244, 67, 54'}, 0.1)`,
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                    {/* Winner badge */}
                    {isWinner && !isDraw && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        padding: '0.2rem 0.8rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        🏆 WINNER
                      </div>
                    )}
                    
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem' }}>
                      {result.playerName}
                    </div>
                    
                    {/* Combat breakdown */}
                    <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        ⚔️ Attack: <strong>{result.totalAttack}</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        🛡️ Defense: <strong>{result.totalBlock}</strong>
                      </div>
                      <div style={{ color: '#f44336', fontWeight: 'bold' }}>
                        💥 Damage Dealt: {result.damageDealt}
                      </div>
                      <div style={{ color: '#f44336', fontWeight: 'bold' }}>
                        💔 Damage Taken: {result.damageTaken}
                      </div>
                    </div>
                    
                    {/* Final stats */}
                    <div style={{ 
                      padding: '0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      fontSize: '0.9rem'
                    }}>
                      <div>❤️ HP: {result.hpBefore} → <strong>{result.hpAfter}</strong></div>
                      <div>⚡ Stamina: {result.staminaBefore} → <strong>{result.staminaAfter}</strong></div>
                      <div>🛡️ Armor: <strong>{result.armorAfter}</strong></div>
                    </div>
                    
                    {/* Cards played */}
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Cards Played:</div>
                      {result.playedCards.map((card, cardIndex) => (
                        <div key={cardIndex} style={{
                          display: 'inline-block',
                          margin: '0.2rem',
                          padding: '0.3rem 0.6rem',
                          backgroundColor: card.type === 'heat' ? 'rgba(255, 87, 34, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                          borderRadius: '4px',
                          border: `1px solid ${card.type === 'heat' ? '#FF5722' : '#4CAF50'}`
                        }}>
                          {card.type === 'heat' ? '🔥' : '⚔️'} {card.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* VS indicator in the middle */}
              <div style={{ 
                textAlign: 'center',
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#FF9800'
              }}>
                ⚔️<br/>VS
              </div>
            </div>
            
            {/* Combat explanation */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              textAlign: 'center',
              borderLeft: '3px solid #2196F3'
            }}>
              <strong>💡 How damage was calculated:</strong><br/>
              Each player's Attack total was compared to their opponent's Defense total. 
              Unblocked attack points became damage.
            </div>
          </div>
        )}

        {/* Game Phase Info */}
        <div style={{ textAlign: 'center', marginTop: '2rem', opacity: 0.7 }}>
          <small>Phase: {gamePhase} | Role: {playerRole || 'none'}</small>
        </div>
      </div>
    </div>
  )
}

export default GladiatorArena