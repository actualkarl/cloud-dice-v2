import { useState } from 'react'

function CardHand({ cards, selectedCard, onCardSelect, isReady, onReady, opponentReady, isMyTurn }) {
  const handleCardClick = (cardValue) => {
    if (!isReady && isMyTurn) {
      onCardSelect(cardValue)
    }
  }

  return (
    <div className="card-hand">
      <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Your Hand</h3>
      
      <div className="cards-container" style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        {cards.map((card) => (
          <button
            key={card}
            className={`card ${selectedCard === card ? 'selected' : ''} ${isReady ? 'locked' : ''}`}
            onClick={() => handleCardClick(card)}
            disabled={!isMyTurn || isReady}
            style={{
              width: '80px',
              height: '120px',
              borderRadius: '10px',
              border: `3px solid ${selectedCard === card ? '#4CAF50' : 'rgba(255, 255, 255, 0.3)'}`,
              background: selectedCard === card 
                ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1))' 
                : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold',
              cursor: isMyTurn && !isReady ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              transform: selectedCard === card ? 'translateY(-10px)' : 'none',
              boxShadow: selectedCard === card 
                ? '0 10px 20px rgba(76, 175, 80, 0.3)' 
                : '0 4px 8px rgba(0, 0, 0, 0.2)',
              opacity: isReady ? 0.7 : 1,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <span>{card}</span>
              {selectedCard === card && (
                <span style={{
                  fontSize: '0.8rem',
                  marginTop: '0.5rem',
                  color: '#4CAF50',
                  fontWeight: 'normal'
                }}>
                  Selected
                </span>
              )}
            </div>
            
            {/* Card shine effect */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
              transform: 'rotate(45deg)',
              transition: 'transform 0.5s',
              pointerEvents: 'none'
            }} />
          </button>
        ))}
      </div>

      <div className="card-actions" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <button
          className="btn btn-primary"
          onClick={onReady}
          disabled={!selectedCard || isReady || !isMyTurn}
          style={{
            minWidth: '200px',
            padding: '1rem 2rem',
            fontSize: '1.1rem'
          }}
        >
          {isReady ? '✓ Ready!' : 'Lock Selection'}
        </button>

        <div className="status-info" style={{
          textAlign: 'center',
          fontSize: '0.9rem',
          opacity: 0.8
        }}>
          {!isMyTurn && <p style={{ color: '#ff9800' }}>Waiting for your turn...</p>}
          {opponentReady && <p style={{ color: '#4CAF50' }}>Opponent is ready!</p>}
          {!selectedCard && isMyTurn && <p>Select a card to play</p>}
        </div>
      </div>
    </div>
  )
}

export default CardHand