import { useState } from 'react'

function HomeScreen({ onCreateRoom, onJoinRoom, connectionStatus }) {
  const [createForm, setCreateForm] = useState({
    playerName: '',
    maxPlayers: 8,
    createSpecialRoom: false
  })
  
  const [joinForm, setJoinForm] = useState({
    playerName: '',
    roomId: ''
  })

  const handleCreateRoom = (e) => {
    e.preventDefault()
    if (!createForm.playerName.trim()) {
      alert('Please enter your name')
      return
    }
    if (createForm.playerName.length > 20) {
      alert('Name must be 20 characters or less')
      return
    }
    const customRoomId = createForm.createSpecialRoom ? 'joesroom' : null
    onCreateRoom(createForm.playerName.trim(), createForm.maxPlayers, customRoomId)
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    if (!joinForm.playerName.trim()) {
      alert('Please enter your name')
      return
    }
    if (!joinForm.roomId.trim()) {
      alert('Please enter a room ID')
      return
    }
    if (joinForm.playerName.length > 20) {
      alert('Name must be 20 characters or less')
      return
    }
    // Simple validation - just check if room ID exists
    if (joinForm.roomId.length < 1) {
      alert('Please enter a room ID')
      return
    }
    onJoinRoom(joinForm.roomId.trim(), joinForm.playerName.trim())
  }

  const isDisabled = connectionStatus !== 'connected'

  return (
    <div className="home-screen">
      <h2>Welcome to Cloud Dice V2</h2>
      <p style={{ marginBottom: '2rem', opacity: 0.8, fontSize: '1.1rem' }}>
        Create a room or join an existing one to start rolling dice with friends!
      </p>

      <div className="home-actions">
        <div className="action-card">
          <h3>🎲 Create Room</h3>
          <p>Start a new dice room and invite your friends to join</p>
          
          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label htmlFor="create-name">Your Name</label>
              <input
                id="create-name"
                type="text"
                value={createForm.playerName}
                onChange={(e) => setCreateForm(prev => ({ ...prev, playerName: e.target.value }))}
                placeholder="Enter your name"
                maxLength="20"
                disabled={isDisabled}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="max-players">Max Players</label>
              <select
                id="max-players"
                value={createForm.maxPlayers}
                onChange={(e) => setCreateForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                disabled={isDisabled}
              >
                <option value={2}>2 Players</option>
                <option value={4}>4 Players</option>
                <option value={6}>6 Players</option>
                <option value={8}>8 Players</option>
                <option value={12}>12 Players</option>
                <option value={16}>16 Players</option>
              </select>
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createForm.createSpecialRoom}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, createSpecialRoom: e.target.checked }))}
                  style={{ width: 'auto' }}
                  disabled={isDisabled}
                />
                <span>Create special room "joesroom" ✨</span>
              </label>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isDisabled}
            >
              {isDisabled ? 'Connecting...' : 'Create Room'}
            </button>
          </form>
        </div>

        <div className="action-card">
          <h3>🚪 Join Room</h3>
          <p>Enter a room ID to join an existing dice room</p>
          
          <form onSubmit={handleJoinRoom}>
            <div className="form-group">
              <label htmlFor="join-name">Your Name</label>
              <input
                id="join-name"
                type="text"
                value={joinForm.playerName}
                onChange={(e) => setJoinForm(prev => ({ ...prev, playerName: e.target.value }))}
                placeholder="Enter your name"
                maxLength="20"
                disabled={isDisabled}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="room-id">Room ID</label>
              <input
                id="room-id"
                type="text"
                value={joinForm.roomId}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow lowercase for special rooms, uppercase for regular room codes
                  if (value.toLowerCase().includes('joesroom') || value.length > 6) {
                    setJoinForm(prev => ({ ...prev, roomId: value }))
                  } else {
                    setJoinForm(prev => ({ ...prev, roomId: value.toUpperCase() }))
                  }
                }}
                placeholder="6-letter code or 'joesroom'"
                maxLength="20"
                style={{ 
                  fontFamily: 'monospace',
                  letterSpacing: '1px'
                }}
                disabled={isDisabled}
              />
              {joinForm.roomId.toLowerCase() === 'joesroom' && (
                <small style={{ color: '#4CAF50', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  ✨ Special room detected!
                </small>
              )}
            </div>
            
            <button 
              type="submit" 
              className="btn btn-secondary"
              disabled={isDisabled}
            >
              {isDisabled ? 'Connecting...' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>

      {isDisabled && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          background: 'rgba(255, 255, 0, 0.2)', 
          borderRadius: '8px',
          fontSize: '0.9rem'
        }}>
          ⚠️ Connecting to server... Please wait.
        </div>
      )}
    </div>
  )
}

export default HomeScreen