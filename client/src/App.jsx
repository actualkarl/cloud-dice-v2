import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import HomeScreen from './components/HomeScreen'
import GameRoom from './components/GameRoom'

function App() {
  const [socket, setSocket] = useState(null)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [playerName, setPlayerName] = useState('')
  const [gameState, setGameState] = useState('home') // 'home', 'room'
  const [connectionStatus, setConnectionStatus] = useState('disconnected') // 'connected', 'connecting', 'disconnected'

  useEffect(() => {
    // Initialize socket connection
    const serverURL = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000';
    
    const newSocket = io(serverURL, {
      transports: ['polling', 'websocket'],
      forceNew: true
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setConnectionStatus('connected')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setConnectionStatus('disconnected')
      setGameState('home')
      setCurrentRoom(null)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setConnectionStatus('disconnected')
    })

    // Room events
    newSocket.on('room-created', (data) => {
      setCurrentRoom(data.room)
      setGameState('room')
    })

    newSocket.on('room-joined', (data) => {
      setCurrentRoom(data.room)
      setGameState('room')
    })

    newSocket.on('error', (data) => {
      alert(data.message)
    })

    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      newSocket.close()
    }
  }, [])

  const createRoom = (name, maxPlayers = 8) => {
    if (!socket || connectionStatus !== 'connected') {
      alert('Not connected to server')
      return
    }
    
    setPlayerName(name)
    setConnectionStatus('connecting')
    socket.emit('create-room', { playerName: name, maxPlayers })
  }

  const joinRoom = (roomId, name) => {
    if (!socket || connectionStatus !== 'connected') {
      alert('Not connected to server')
      return
    }
    
    setPlayerName(name)
    setConnectionStatus('connecting')
    socket.emit('join-room', { roomId: roomId, playerName: name })
  }

  const leaveRoom = () => {
    if (socket) {
      socket.disconnect()
      socket.connect()
    }
    setCurrentRoom(null)
    setGameState('home')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>🎲 Cloud Dice V2</h1>
        </div>
        <div className="header-right">
          {gameState === 'room' && currentRoom && (
            <div className="room-info-compact">
              <span className="room-name">Room: {currentRoom.id}</span>
              <span className="player-count">{currentRoom.players.length}/{currentRoom.maxPlayers} players</span>
            </div>
          )}
          {gameState === 'room' && currentRoom && (
            <div className="room-actions-header">
              <button onClick={() => {
                navigator.clipboard.writeText(currentRoom.id)
                alert('Room ID copied to clipboard!')
              }} className="btn btn-secondary btn-sm">
                📋 Copy ID
              </button>
              <button onClick={leaveRoom} className="btn btn-primary btn-sm">
                🚪 Leave
              </button>
            </div>
          )}
          <div className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' && '🟢 Connected'}
            {connectionStatus === 'connecting' && '🟡 Connecting...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected'}
          </div>
        </div>
      </header>

      <main className="app-main">
        {gameState === 'home' ? (
          <HomeScreen 
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            connectionStatus={connectionStatus}
          />
        ) : (
          <GameRoom 
            socket={socket}
            room={currentRoom}
            playerName={playerName}
            onLeaveRoom={leaveRoom}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Real-time multiplayer dice rolling • Built for Railway</p>
      </footer>
    </div>
  )
}

export default App