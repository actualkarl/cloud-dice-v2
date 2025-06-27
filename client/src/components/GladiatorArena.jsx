import { useState, useEffect } from 'react'

function GladiatorArena({ socket, room, playerName, players }) {
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

  const currentPlayer = players.find(p => p.name === playerName)
  const isHost = currentPlayer?.isHost || false

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
    })

    return () => {
      socket.off('gladiator-type-selected')
      socket.off('gladiator-game-started')
      socket.off('hand-dealt')
      socket.off('battle-resolved')
      socket.off('new-round-started')
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
    if (gamePhase !== 'posturing') return
    
    const newSelection = [...selectedCardIndices]
    const existingIndex = newSelection.indexOf(cardIndex)
    
    if (existingIndex >= 0) {
      newSelection.splice(existingIndex, 1)
    } else if (newSelection.length < 3) {
      newSelection.push(cardIndex)
    }
    
    setSelectedCardIndices(newSelection)
  }

  const handlePlayCards = () => {
    if (selectedCardIndices.length === 3 && socket) {
      socket.emit('play-cards', { cardIndices: selectedCardIndices })
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

        {/* Player Stats */}
        {gameStarted && playerRole === 'fighter' && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h4>Round {currentRound} | {gladiatorType} Gladiator</h4>
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
              <span>❤️ HP: {playerStats.hp}</span>
              <span>⚡ Stamina: {playerStats.stamina}</span>
              <span>🛡️ Armor: {playerStats.armor}</span>
            </div>
          </div>
        )}

        {/* Hand Display */}
        {gameStarted && playerRole === 'fighter' && hand.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4>Your Hand</h4>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {hand.map((card, index) => (
                <div
                  key={index}
                  onClick={() => handleCardClick(index)}
                  style={{
                    border: selectedCardIndices.includes(index) ? '3px solid #4CAF50' : '1px solid #ccc',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    minWidth: '120px',
                    cursor: gamePhase === 'posturing' ? 'pointer' : 'default',
                    backgroundColor: selectedCardIndices.includes(index) ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{card.name}</div>
                  <div style={{ fontSize: '0.8rem' }}>
                    Attack: {card.attack || 0} | Block: {card.block || 0}
                  </div>
                  {card.stamina && <div style={{ fontSize: '0.8rem' }}>Stamina: {card.stamina}</div>}
                </div>
              ))}
            </div>
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

        {/* Battle Results */}
        {battleResults && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h4>Battle Results</h4>
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
              {Object.values(battleResults).map(result => (
                <div key={result.playerId} style={{
                  padding: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{result.playerName}</div>
                  <div>Attack: {result.totalAttack} | Block: {result.totalBlock}</div>
                  <div>Damage Dealt: {result.damageDealt} | Taken: {result.damageTaken}</div>
                  <div>HP: {result.hpAfter} | Stamina: {result.staminaAfter}</div>
                </div>
              ))}
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