import { useState, useEffect } from 'react'

function DebugPanel({ socket, isHost, playerName }) {
  const [debugState, setDebugState] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (!socket || !isHost) return

    socket.on('debug-room-state', (data) => {
      console.log('[DEBUG PANEL] Received room state:', data)
      setDebugState(data)
    })

    return () => {
      socket.off('debug-room-state')
    }
  }, [socket, isHost])

  useEffect(() => {
    if (!autoRefresh || !isHost) return

    const interval = setInterval(() => {
      refreshState()
    }, 2000) // Refresh every 2 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, isHost])

  const refreshState = () => {
    if (socket && isHost) {
      socket.emit('debug-get-room-state', {})
    }
  }

  const forceReveal = () => {
    if (socket && isHost) {
      socket.emit('debug-force-reveal', {})
    }
  }

  if (!isHost) return null

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      borderRadius: '8px',
      border: '2px solid #ff9800',
      minWidth: isVisible ? '400px' : 'auto'
    }}>
      <div style={{
        padding: '10px',
        borderBottom: isVisible ? '1px solid #ff9800' : 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        background: '#ff9800',
        color: 'black',
        fontWeight: 'bold'
      }} onClick={() => setIsVisible(!isVisible)}>
        <span>🔧 DEBUG PANEL</span>
        <span>{isVisible ? '▼' : '▶'}</span>
      </div>

      {isVisible && (
        <div style={{ padding: '15px' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ marginRight: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                Auto-refresh (2s)
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={refreshState}
                style={{
                  padding: '8px 15px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh State
              </button>
              
              <button 
                onClick={forceReveal}
                style={{
                  padding: '8px 15px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ⚡ Force Reveal
              </button>
            </div>
          </div>

          {debugState && (
            <div style={{ 
              fontSize: '12px', 
              fontFamily: 'monospace',
              maxHeight: '400px',
              overflowY: 'auto',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '10px',
              borderRadius: '4px'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>Room: {debugState.roomId}</strong> | Arena: {debugState.arenaType}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong>Players ({debugState.players.length}):</strong>
                {debugState.players.map(player => (
                  <div key={player.id} style={{ 
                    marginLeft: '10px', 
                    marginBottom: '5px',
                    padding: '5px',
                    background: player.isHost ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px'
                  }}>
                    <div>
                      <strong>{player.name}</strong> 
                      {player.isHost && ' 👑'} 
                      | Role: {player.role || 'none'}
                    </div>
                    {player.cardHand && (
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        Hand: [{player.cardHand.join(', ')}]
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {debugState.gladiatorState && (
                <div>
                  <strong>Gladiator State:</strong>
                  <div style={{ marginLeft: '10px' }}>
                    <div>Round: {debugState.gladiatorState.currentRound}</div>
                    <div>Waiting for next: {debugState.gladiatorState.waitingForNextRound ? 'YES' : 'NO'}</div>
                    <div>First player: {debugState.players.find(p => p.id === debugState.gladiatorState.firstPlayer)?.name || 'none'}</div>
                    
                    <div style={{ marginTop: '5px' }}>
                      <strong>Scores:</strong>
                      {Object.entries(debugState.gladiatorState.roundScores).map(([playerId, score]) => (
                        <div key={playerId} style={{ marginLeft: '10px' }}>
                          {debugState.players.find(p => p.id === playerId)?.name}: {score}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '5px' }}>
                      <strong>Selected Cards:</strong>
                      {Object.entries(debugState.gladiatorState.selectedCards).map(([playerId, card]) => (
                        <div key={playerId} style={{ marginLeft: '10px' }}>
                          {debugState.players.find(p => p.id === playerId)?.name}: {card}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '5px' }}>
                      <strong>Ready Players:</strong>
                      <div style={{ marginLeft: '10px' }}>
                        {debugState.gladiatorState.readyPlayers.map(playerId => 
                          debugState.players.find(p => p.id === playerId)?.name
                        ).join(', ') || 'none'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ 
            marginTop: '10px', 
            fontSize: '11px', 
            opacity: 0.7,
            textAlign: 'center'
          }}>
            Host-only debug tools
          </div>
        </div>
      )}
    </div>
  )
}

export default DebugPanel