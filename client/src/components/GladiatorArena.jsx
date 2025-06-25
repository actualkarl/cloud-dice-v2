import { useState, useEffect } from 'react'
import CardHand from './CardHand'

function GladiatorArena({ socket, room, playerName, players }) {
  const [playerRole, setPlayerRole] = useState(null) // 'fighter' or 'spectator'
  const [selectedCard, setSelectedCard] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [gladiatorState, setGladiatorState] = useState(null)
  const [roundScores, setRoundScores] = useState({})
  const [lastReveal, setLastReveal] = useState(null)
  const [waitingForNextRound, setWaitingForNextRound] = useState(false)
  const [firstPlayerId, setFirstPlayerId] = useState(null)
  const [cardHand, setCardHand] = useState([])

  const currentPlayer = players.find(p => p.name === playerName)
  const isHost = currentPlayer?.isHost || false

  useEffect(() => {
    if (!socket) return

    // Listen for gladiator events
    socket.on('player-role-selected', (data) => {
      console.log('Player role selected:', data)
      // Update local state if needed
    })

    socket.on('card-hand-assigned', (data) => {
      console.log('Card hand assigned:', data)
      setCardHand(data.cardHand)
    })

    socket.on('card-selected', (data) => {
      console.log('Card selection confirmed:', data)
      // Card selection confirmed - no need to update state, already handled locally
    })

    socket.on('player-ready-status', (data) => {
      console.log('Player ready status:', data)
      if (data.playerName !== playerName) {
        setOpponentReady(data.isReady)
      }
    })

    socket.on('cards-revealed', (data) => {
      console.log('Cards revealed:', data)
      setLastReveal(data)
      setRoundScores(data.roundScores)
      setFirstPlayerId(data.nextFirstPlayer)
      // Reset for next round
      setSelectedCard(null)
      setIsReady(false)
      setOpponentReady(false)
    })

    socket.on('round-complete-waiting', (data) => {
      console.log('Round complete, waiting for next round:', data)
      setWaitingForNextRound(true)
    })

    socket.on('next-round', (data) => {
      console.log('Next round:', data)
      setLastReveal(null)
      setWaitingForNextRound(false)
      setFirstPlayerId(data.firstPlayer)
      setSelectedCard(null)
      // Ready for next round - card hands remain the same
    })

    socket.on('match-complete', (data) => {
      console.log('Match complete:', data)
      setLastReveal(null)
      setWaitingForNextRound(false)
      // Match is over - could show final results
    })

    return () => {
      socket.off('player-role-selected')
      socket.off('card-hand-assigned')
      socket.off('card-selected')
      socket.off('player-ready-status')
      socket.off('cards-revealed') 
      socket.off('round-complete-waiting')
      socket.off('next-round')
      socket.off('match-complete')
    }
  }, [socket, playerName])

  // Initialize gladiator state from room
  useEffect(() => {
    if (room?.gladiatorState) {
      setGladiatorState(room.gladiatorState) 
      setRoundScores(room.gladiatorState.roundScores || {})
      setFirstPlayerId(room.gladiatorState.firstPlayer)
      setWaitingForNextRound(room.gladiatorState.waitingForNextRound || false)
    }
  }, [room])

  // Set player role from room data
  useEffect(() => {
    if (currentPlayer?.role) {
      setPlayerRole(currentPlayer.role)
    }
  }, [currentPlayer])
  
  const handleCardSelect = (cardIndex) => {
    if (!isReady && playerRole === 'fighter') {
      setSelectedCard(cardIndex)
    }
  }
  
  const handleReady = () => {
    if (selectedCard !== null && !isReady && playerRole === 'fighter') {
      setIsReady(true)
      if (socket) {
        socket.emit('select-card', { cardIndex: selectedCard })
        socket.emit('player-ready', { playerId: socket.id })
      }
    }
  }
  
  const handleRoleSelect = (role) => {
    setPlayerRole(role)
    // TODO: Emit socket event for role selection
    if (socket) {
      socket.emit('select-role', { role })
    }
  }

  const handleStartNextRound = () => {
    if (socket && isHost) {
      socket.emit('start-next-round', {})
    }
  }

  return (
    <div className="gladiator-arena">
      <div className="arena-content" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '15px',
        padding: '2rem',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>⚔️ Gladiator Arena</h2>
        
        {!playerRole ? (
          // Role selection interface
          <div className="role-selection" style={{ 
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '10px'
        }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Select Your Role</h3>
          
          <div style={{ 
            display: 'flex', 
            gap: '2rem', 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn btn-primary"
              style={{ 
                minWidth: '150px',
                padding: '1rem 2rem',
                fontSize: '1.1rem'
              }}
              onClick={() => handleRoleSelect('fighter')}
            >
              ⚔️ Fighter
            </button>
            
            <button 
              className="btn btn-secondary"
              style={{ 
                minWidth: '150px',
                padding: '1rem 2rem',
                fontSize: '1.1rem'
              }}
              onClick={() => handleRoleSelect('spectator')}
            >
              👁️ Spectator
            </button>
          </div>
        </div>
        ) : playerRole === 'fighter' ? (
          // Fighter interface with card hand
          <div className="fighter-interface">
            {/* Round scores display */}
            {Object.keys(roundScores).length > 0 && (
              <div className="round-scores" style={{
                marginBottom: '2rem',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <h4 style={{ marginBottom: '1rem' }}>Round Scores</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                  {players.filter(p => p.role === 'fighter').map(fighter => (
                    <div key={fighter.id} style={{
                      padding: '0.5rem 1rem', 
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '5px'
                    }}>
                      <strong>{fighter.name}</strong>: {roundScores[fighter.id] || 0} wins
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last round reveal display */}
            {lastReveal && (
              <div className="last-reveal" style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'rgba(76, 175, 80, 0.2)',
                borderRadius: '10px',
                textAlign: 'center',
                border: '2px solid rgba(76, 175, 80, 0.5)'
              }}>
                <h4 style={{ marginBottom: '1rem' }}>Round {lastReveal.roundNumber} Results</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                  {lastReveal.reveals.map(reveal => (
                    <div key={reveal.playerId} style={{
                      padding: '1rem',
                      background: `linear-gradient(135deg, ${reveal.cardType?.color || '#666'}20, ${reveal.cardType?.color || '#666'}05)`,
                      borderRadius: '10px',
                      minWidth: '120px',
                      border: `2px solid ${reveal.cardType?.color || '#666'}60`
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {reveal.playerName}
                      </div>
                      <div style={{ 
                        fontSize: '1rem', 
                        opacity: 0.8,
                        marginBottom: '0.5rem'
                      }}>
                        {reveal.cardType?.icon} {reveal.cardType?.name}
                      </div>
                      <div style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold',
                        color: lastReveal.roundWinner?.id === reveal.playerId ? '#4CAF50' : 'inherit'
                      }}>
                        {reveal.card.value}
                      </div>
                    </div>
                  ))}
                </div>
                {lastReveal.roundWinner ? (
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>
                    🏆 {lastReveal.roundWinner.name} wins this round!
                  </div>
                ) : (
                  <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                    ⚖️ Round tied!
                  </div>
                )}
              </div>
            )}

            {/* Next Round button for host */}
            {waitingForNextRound && isHost && (
              <div style={{
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '1.5rem',
                background: 'rgba(33, 150, 243, 0.2)',
                borderRadius: '10px',
                border: '2px solid rgba(33, 150, 243, 0.5)'
              }}>
                <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                  Round complete! Ready for the next round?
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={handleStartNextRound}
                  style={{
                    fontSize: '1.2rem',
                    padding: '1rem 2rem',
                    minWidth: '200px'
                  }}
                >
                  ▶️ Start Next Round
                </button>
              </div>
            )}

            {/* Waiting message for non-hosts */}
            {waitingForNextRound && !isHost && (
              <div style={{
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '1.5rem',
                background: 'rgba(255, 152, 0, 0.2)',
                borderRadius: '10px',
                border: '2px solid rgba(255, 152, 0, 0.5)'
              }}>
                <p style={{ fontSize: '1.1rem', color: '#ff9800' }}>
                  ⏳ Waiting for host to start the next round...
                </p>
              </div>
            )}

            <CardHand
              cards={cardHand}
              selectedCard={selectedCard}
              onCardSelect={handleCardSelect}
              isReady={isReady}
              onReady={handleReady}
              opponentReady={opponentReady}
              isMyTurn={!firstPlayerId || firstPlayerId === currentPlayer?.id || waitingForNextRound}
              firstPlayerName={firstPlayerId ? players.find(p => p.id === firstPlayerId)?.name : null}
            />
          </div>
        ) : (
          // Spectator interface
          <div className="spectator-interface" style={{
            padding: '2rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '10px',
            marginTop: '2rem'
          }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              👁️ Spectator Mode
            </h3>

            {/* Round scores display for spectators */}
            {Object.keys(roundScores).length > 0 && (
              <div className="round-scores" style={{
                marginBottom: '2rem',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <h4 style={{ marginBottom: '1rem' }}>Round Scores</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                  {players.filter(p => p.role === 'fighter').map(fighter => (
                    <div key={fighter.id} style={{
                      padding: '0.5rem 1rem', 
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '5px'
                    }}>
                      <strong>{fighter.name}</strong>: {roundScores[fighter.id] || 0} wins
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last round reveal display for spectators */}
            {lastReveal && (
              <div className="last-reveal" style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'rgba(76, 175, 80, 0.2)',
                borderRadius: '10px',
                textAlign: 'center',
                border: '2px solid rgba(76, 175, 80, 0.5)'
              }}>
                <h4 style={{ marginBottom: '1rem' }}>Round {lastReveal.roundNumber} Results</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                  {lastReveal.reveals.map(reveal => (
                    <div key={reveal.playerId} style={{
                      padding: '1rem',
                      background: `linear-gradient(135deg, ${reveal.cardType?.color || '#666'}20, ${reveal.cardType?.color || '#666'}05)`,
                      borderRadius: '10px',
                      minWidth: '120px',
                      border: `2px solid ${reveal.cardType?.color || '#666'}60`
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {reveal.playerName}
                      </div>
                      <div style={{ 
                        fontSize: '1rem', 
                        opacity: 0.8,
                        marginBottom: '0.5rem'
                      }}>
                        {reveal.cardType?.icon} {reveal.cardType?.name}
                      </div>
                      <div style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold',
                        color: lastReveal.roundWinner?.id === reveal.playerId ? '#4CAF50' : 'inherit'
                      }}>
                        {reveal.card.value}
                      </div>
                    </div>
                  ))}
                </div>
                {lastReveal.roundWinner ? (
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>
                    🏆 {lastReveal.roundWinner.name} wins this round!
                  </div>
                ) : (
                  <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                    ⚖️ Round tied!
                  </div>
                )}
              </div>
            )}

            {/* Next Round button for spectator host */}
            {waitingForNextRound && isHost && (
              <div style={{
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '1.5rem',
                background: 'rgba(33, 150, 243, 0.2)',
                borderRadius: '10px',
                border: '2px solid rgba(33, 150, 243, 0.5)'
              }}>
                <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                  Round complete! Ready for the next round?
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={handleStartNextRound}
                  style={{
                    fontSize: '1.2rem',
                    padding: '1rem 2rem',
                    minWidth: '200px'
                  }}
                >
                  ▶️ Start Next Round
                </button>
              </div>
            )}

            {/* Waiting message for non-host spectators */}
            {waitingForNextRound && !isHost && (
              <div style={{
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '1.5rem',
                background: 'rgba(255, 152, 0, 0.2)',
                borderRadius: '10px',
                border: '2px solid rgba(255, 152, 0, 0.5)'
              }}>
                <p style={{ fontSize: '1.1rem', color: '#ff9800' }}>
                  ⏳ Waiting for host to start the next round...
                </p>
              </div>
            )}

            {!waitingForNextRound && !lastReveal && (
              <>
                <p style={{ fontSize: '1rem', opacity: 0.8, textAlign: 'center' }}>
                  You are watching the battle. Chat and betting features coming soon!
                </p>
                
                <div style={{ 
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>
                    Waiting for fighters to make their moves...
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="players-info" style={{ 
          marginTop: '2rem',
          fontSize: '0.9rem',
          opacity: 0.7
        }}>
          <p>Players in arena: {players.length}</p>
        </div>
      </div>
    </div>
  )
}

export default GladiatorArena