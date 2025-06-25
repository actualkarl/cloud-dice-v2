import { useState } from 'react'

function ArenaSelector({ currentArena, isHost, onArenaChange }) {
  const [isChanging, setIsChanging] = useState(false)

  const handleArenaChange = (e) => {
    const newArena = e.target.value
    if (newArena !== currentArena && isHost) {
      setIsChanging(true)
      onArenaChange(newArena)
      
      // Reset changing state after a short delay
      setTimeout(() => setIsChanging(false), 1000)
    }
  }

  return (
    <div className="arena-selector" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <label htmlFor="arena-select" style={{ marginRight: '0.5rem', fontWeight: '500' }}>Arena Mode:</label>
      <select
        id="arena-select"
        value={currentArena}
        onChange={handleArenaChange}
        disabled={!isHost || isChanging}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          fontSize: '0.9rem',
          cursor: isHost ? 'pointer' : 'not-allowed',
          opacity: isHost ? 1 : 0.6,
          transition: 'all 0.3s ease'
        }}
      >
        <option value="dice" style={{ background: '#333' }}>🎲 Dice Rolling</option>
        <option value="gladiator" style={{ background: '#333' }}>⚔️ Gladiator Combat</option>
      </select>
      {!isHost && (
        <span style={{
          marginLeft: '0.5rem',
          fontSize: '0.8rem',
          opacity: 0.6,
          fontStyle: 'italic'
        }}>
          (Host only)
        </span>
      )}
    </div>
  )
}

export default ArenaSelector