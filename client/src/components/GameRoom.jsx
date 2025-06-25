import { useState, useEffect, useRef } from 'react'
import ArenaSelector from './ArenaSelector'
import GladiatorArena from './GladiatorArena'

function GameRoom({ socket, room, playerName, onLeaveRoom }) {
  const [diceConfig, setDiceConfig] = useState({
    sides: 6,
    count: 1,
    label: '',
    modifierOp: 'none',
    modifierValue: 0
  })
  
  const [currentRoom, setCurrentRoom] = useState(room)
  const [arenaType, setArenaType] = useState('dice')
  const [rollResult, setRollResult] = useState(null)
  const [rollHistory, setRollHistory] = useState([])
  const [isRolling, setIsRolling] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatMessage, setChatMessage] = useState('')
  const chatMessagesRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    // Listen for room updates
    socket.on('room-info', (data) => {
      setCurrentRoom(data.room)
      setRollHistory(data.rollHistory || [])
      setChatHistory(data.chatHistory || [])
      setArenaType(data.room.arenaType || 'dice')
      
      // Find and set the player's last roll
      const myLastRoll = (data.rollHistory || [])
        .filter(roll => roll.player.name === playerName)
        .pop()
      if (myLastRoll) {
        setRollResult(myLastRoll)
      }
    })

    socket.on('room-joined', (data) => {
      setCurrentRoom(data.room)
      setRollHistory(data.rollHistory || [])
      setChatHistory(data.chatHistory || [])
      setArenaType(data.room.arenaType || 'dice')
      
      // Find and set the player's last roll when joining
      const myLastRoll = (data.rollHistory || [])
        .filter(roll => roll.player.name === playerName)
        .pop()
      if (myLastRoll) {
        setRollResult(myLastRoll)
      }
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
        
        // Keep the last roll visible - don't clear it automatically
      }
    })

    socket.on('chat-message', (data) => {
      setChatHistory(prev => [...prev, data])
    })

    socket.on('arena-switched', (data) => {
      setArenaType(data.arenaType)
    })

    // Request current room info
    socket.emit('get-room-info')

    return () => {
      socket.off('room-info')
      socket.off('room-joined')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('dice-rolled')
      socket.off('chat-message')
      socket.off('arena-switched')
    }
  }, [socket, playerName])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatHistory])

  const handleRollDice = (e) => {
    e.preventDefault()
    if (!socket || isRolling) return

    setIsRolling(true)
    // Don't clear rollResult - keep the last roll visible

    const rollData = {
      sides: diceConfig.sides,
      count: diceConfig.count,
      label: diceConfig.label || `${diceConfig.count}d${diceConfig.sides}`,
      modifierOp: diceConfig.modifierOp,
      modifierValue: diceConfig.modifierValue
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


  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!socket || !chatMessage.trim()) return

    socket.emit('send-message', { message: chatMessage })
    setChatMessage('')
  }

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleArenaChange = (newArenaType) => {
    if (!socket) return
    socket.emit('switch-arena-mode', { arenaType: newArenaType })
  }

  if (!currentRoom) {
    return (
      <div className="game-room">
        <div className="loading-message">
          <h2>Loading room...</h2>
        </div>
      </div>
    )
  }

  const currentPlayer = currentRoom.players.find(p => p.name === playerName)
  const isHost = currentPlayer?.isHost || false
  
  console.log('GameRoom render - Arena type:', arenaType, 'Is host:', isHost, 'Current player:', currentPlayer)

  return (
    <div className="game-room">
      <div className="room-header" style={{ marginBottom: '2rem' }}>
        <div className="room-info">
          <h2>Room: {currentRoom.id}</h2>
          <p>{currentRoom.players.length}/{currentRoom.maxPlayers} players</p>
        </div>
        <div className="room-actions">
          {/* DEBUG: Arena type: {arenaType}, Is host: {isHost ? 'YES' : 'NO'} */}
          <div style={{ 
            padding: '10px', 
            background: 'red', 
            color: 'white', 
            marginRight: '10px',
            borderRadius: '5px'
          }}>
            ARENA: {arenaType} | HOST: {isHost ? 'YES' : 'NO'}
          </div>
          <ArenaSelector 
            currentArena={arenaType}
            isHost={isHost}
            onArenaChange={handleArenaChange}
          />
          <button 
            className="btn btn-secondary"
            onClick={onLeaveRoom}
            style={{ marginLeft: '1rem' }}
          >
            Leave Room
          </button>
        </div>
      </div>
      
      <div className="room-content">
        {arenaType === 'dice' ? (
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

              <div className="form-group">
                <label htmlFor="modifier">Modifier</label>
                <select
                  id="modifier"
                  value={diceConfig.modifierOp}
                  onChange={(e) => setDiceConfig(prev => ({ ...prev, modifierOp: e.target.value }))}
                  disabled={isRolling}
                >
                  <option value="none">None</option>
                  <option value="add">Add (+)</option>
                  <option value="subtract">Subtract (-)</option>
                  <option value="multiply">Multiply (×)</option>
                </select>
              </div>

              {diceConfig.modifierOp !== 'none' && (
                <div className="form-group">
                  <label htmlFor="modifierValue">Modifier Value</label>
                  <input
                    id="modifierValue"
                    type="number"
                    value={diceConfig.modifierValue}
                    onChange={(e) => setDiceConfig(prev => ({ ...prev, modifierValue: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    min={diceConfig.modifierOp === 'multiply' ? 0.1 : -999}
                    max={diceConfig.modifierOp === 'multiply' ? 100 : 999}
                    step={diceConfig.modifierOp === 'multiply' ? 0.1 : 1}
                    disabled={isRolling}
                  />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isRolling}
              style={{ width: '100%', fontSize: '1.2rem', padding: '1rem' }}
            >
              {isRolling ? '🎲 Rolling...' : `🎲 Roll ${diceConfig.count}d${diceConfig.sides}${
                diceConfig.modifierOp !== 'none' ? 
                  ` ${diceConfig.modifierOp === 'add' ? '+' : diceConfig.modifierOp === 'subtract' ? '-' : '×'} ${diceConfig.modifierValue}` : 
                  ''
              }`}
            </button>
          </form>

          <div className="dice-results">
            {rollResult ? (
              <>
                <h3>Your Roll: {rollResult.label}</h3>
                <div className="dice-display">
                  {rollResult.rolls.map((roll, index) => (
                    <div key={index} className="die">
                      {roll}
                    </div>
                  ))}
                </div>
                <div className="total-display">
                  Total: {rollResult.baseTotal || rollResult.total}
                  {rollResult.modifierOp && rollResult.modifierOp !== 'none' && (
                    <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', color: '#4CAF50' }}>
                      Modified: {rollResult.total} (
                      {rollResult.modifierOp === 'add' ? '+' : rollResult.modifierOp === 'subtract' ? '-' : '×'}
                      {rollResult.modifierValue})
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3>Your Roll: Ready to roll</h3>
                <div className="dice-display">
                  <div className="die placeholder">
                    ?
                  </div>
                </div>
                <div className="total-display">
                  Total: --
                </div>
              </>
            )}
          </div>
        </div>
        ) : (
          <GladiatorArena 
            socket={socket}
            room={currentRoom}
            playerName={playerName}
            players={currentRoom.players}
          />
        )}

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
                      <span className="total">
                        = {roll.baseTotal || roll.total}
                        {roll.modifierOp && roll.modifierOp !== 'none' && (
                          <span style={{ color: '#4CAF50', marginLeft: '0.5rem' }}>
                            → {roll.total} ({roll.modifierOp === 'add' ? '+' : roll.modifierOp === 'subtract' ? '-' : '×'}{roll.modifierValue})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="chat-section" style={{ marginTop: '2rem' }}>
          <h3>💬 Chat</h3>
          <div className="chat-messages" ref={chatMessagesRef} style={{ 
            height: '200px', 
            overflowY: 'auto', 
            background: 'rgba(0, 0, 0, 0.2)', 
            border: '1px solid rgba(255, 255, 255, 0.2)', 
            borderRadius: '8px', 
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            {chatHistory.length === 0 ? (
              <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No messages yet. Start the conversation!</p>
            ) : (
              chatHistory.map(message => (
                <div key={message.id} className={`chat-message ${message.type}`} style={{ marginBottom: '0.75rem' }}>
                  {message.type === 'dice-roll' ? (
                    <div className="dice-roll-message">
                      <div className="message-header" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span className="player-name" style={{ fontWeight: '600', color: '#4CAF50' }}>{message.player.name}</span>
                        <span className="timestamp" style={{ opacity: '0.6' }}>{formatTimestamp(message.timestamp)}</span>
                      </div>
                      <div className="roll-summary" style={{ color: '#81C784' }}>
                        🎲 {message.rollData.label}: {message.rollData.rolls.join(', ')} = {message.rollData.baseTotal || message.rollData.total}
                        {message.rollData.modifierOp && message.rollData.modifierOp !== 'none' && (
                          <span style={{ color: '#4CAF50' }}>
                            {' → '}{message.rollData.total} ({message.rollData.modifierOp === 'add' ? '+' : message.rollData.modifierOp === 'subtract' ? '-' : '×'}{message.rollData.modifierValue})
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-message">
                      <div className="message-header" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span className="player-name" style={{ fontWeight: '600', color: '#2196F3' }}>{message.player.name}</span>
                        <span className="timestamp" style={{ opacity: '0.6' }}>{formatTimestamp(message.timestamp)}</span>
                      </div>
                      <div className="message-content">{message.message}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder="Type a message..."
              maxLength="200"
              style={{ 
                flex: 1, 
                padding: '0.75rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(255, 255, 255, 0.2)', 
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            <button 
              type="submit" 
              disabled={!chatMessage.trim()}
              className="btn btn-primary"
              style={{ minWidth: '80px' }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default GameRoom