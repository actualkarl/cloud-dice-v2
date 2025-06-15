import { useState, useEffect } from 'react'

function GameRoom({ socket, room, playerName, onLeaveRoom }) {
  const [diceConfig, setDiceConfig] = useState({
    sides: 6,
    count: 1,
    label: ''
  })
  
  const [currentRoom, setCurrentRoom] = useState(room)
  const [rollResult, setRollResult] = useState(null)
  const [rollHistory, setRollHistory] = useState([])
  const [isRolling, setIsRolling] = useState(false)

  useEffect(() => {
    if (!socket) return

    // Listen for room updates
    socket.on('room-info', (data) => {
      setCurrentRoom(data.room)
      setRollHistory(data.rollHistory || [])
    })

    socket.on('player-joined', (data) => {
      setCurrentRoom(prev => ({
        ...prev,
        players: [...prev.players, data.player]
      }))
    })

    socket.on('player-left', (data) => {
      setCurrentRoom(prev => ({
        ...prev,
        players: prev.players.filter(p => p.id !== data.player.id).map(p => ({
          ...p,
          isHost: data.newHost && p.id === data.newHost.id ? true : p.isHost
        }))
      }))
    })

    socket.on('dice-rolled', (data) => {
      setRollHistory(prev => [...prev, data])
      
      // If this is our roll, show the result
      if (data.player.name === playerName) {
        setRollResult(data)
        setIsRolling(false)
        
        // Clear result after 5 seconds
        setTimeout(() => {
          setRollResult(null)
        }, 5000)
      }
    })

    // Request current room info
    socket.emit('get-room-info')

    return () => {
      socket.off('room-info')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('dice-rolled')
    }
  }, [socket, playerName])

  const handleRollDice = (e) => {
    e.preventDefault()
    if (!socket || isRolling) return

    setIsRolling(true)
    setRollResult(null)

    const rollData = {
      sides: diceConfig.sides,
      count: diceConfig.count,
      label: diceConfig.label || `${diceConfig.count}d${diceConfig.sides}`
    }

    socket.emit('roll-dice', rollData)
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(currentRoom.id)
    alert('Room ID copied to clipboard!')
  }

  if (!currentRoom) {
    return (
      <div className="game-room">
        <div className="room-header">
          <div className="room-info">
            <h2>Loading room...</h2>
          </div>
        </div>
      </div>
    )
  }

  const currentPlayer = currentRoom.players.find(p => p.name === playerName)
  const isHost = currentPlayer?.isHost || false

  return (
    <div className="game-room">
      <div className="room-header">
        <div className="room-info">
          <h2>Room: {currentRoom.id}</h2>
          <p>{currentRoom.players.length}/{currentRoom.maxPlayers} players • You are: {playerName}</p>
        </div>
        <div className="room-actions">
          <button onClick={copyRoomId} className="btn btn-secondary">
            📋 Copy Room ID
          </button>
          <button onClick={onLeaveRoom} className="btn btn-primary">
            🚪 Leave Room
          </button>
        </div>
      </div>

      <div className="room-content">
        <div className="dice-section">
          <h3>🎲 Roll Dice</h3>
          
          <form onSubmit={handleRollDice}>
            <div className="dice-controls">
              <div className="form-group">
                <label htmlFor="sides">Sides</label>
                <select
                  id="sides"
                  value={diceConfig.sides}
                  onChange={(e) => setDiceConfig(prev => ({ ...prev, sides: parseInt(e.target.value) }))}
                  disabled={isRolling}
                >
                  <option value={2}>d2</option>
                  <option value={4}>d4</option>
                  <option value={6}>d6</option>
                  <option value={8}>d8</option>
                  <option value={10}>d10</option>
                  <option value={12}>d12</option>
                  <option value={20}>d20</option>
                  <option value={100}>d100</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="count">Count</label>
                <select
                  id="count"
                  value={diceConfig.count}
                  onChange={(e) => setDiceConfig(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                  disabled={isRolling}
                >
                  {[...Array(20)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="label">Label (optional)</label>
                <input
                  id="label"
                  type="text"
                  value={diceConfig.label}
                  onChange={(e) => setDiceConfig(prev => ({ ...prev, label: e.target.value }))}
                  placeholder={`${diceConfig.count}d${diceConfig.sides}`}
                  maxLength="20"
                  disabled={isRolling}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isRolling}
              style={{ width: '100%', fontSize: '1.2rem', padding: '1rem' }}
            >
              {isRolling ? '🎲 Rolling...' : `🎲 Roll ${diceConfig.count}d${diceConfig.sides}`}
            </button>
          </form>

          {rollResult && (
            <div className="dice-results">
              <h3>Your Roll: {rollResult.label}</h3>
              <div className="dice-display">
                {rollResult.rolls.map((roll, index) => (
                  <div key={index} className="die">
                    {roll}
                  </div>
                ))}
              </div>
              <div className="total-display">
                Total: {rollResult.total}
              </div>
            </div>
          )}
        </div>

        <div className="players-section">
          <h3>👥 Players ({currentRoom.players.length}/{currentRoom.maxPlayers})</h3>
          <ul className="players-list">
            {currentRoom.players.map(player => (
              <li key={player.id} className="player-item">
                <span className="player-name">{player.name}</span>
                {player.isHost && <span className="host-badge">Host</span>}
                {player.name === playerName && <span style={{ opacity: 0.6 }}>(You)</span>}
              </li>
            ))}
          </ul>

          <div className="roll-history">
            <h4>📊 Recent Rolls</h4>
            {rollHistory.length === 0 ? (
              <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No rolls yet. Be the first to roll!</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {rollHistory.slice().reverse().map(roll => (
                  <div key={roll.id} className="roll-item">
                    <div className="roll-header">
                      <span className="player-name">{roll.player.name}</span>
                      <span className="timestamp">{formatTimestamp(roll.timestamp)}</span>
                    </div>
                    <div className="roll-details">
                      <span>{roll.label}:</span>
                      <div className="roll-dice">
                        {roll.rolls.map((die, index) => (
                          <span key={index} className="mini-die">{die}</span>
                        ))}
                      </div>
                      <span className="total">= {roll.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameRoom