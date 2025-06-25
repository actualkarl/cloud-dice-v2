import { useState } from 'react'

function CardHand({ cards, selectedCard, onCardSelect, isReady, onReady, opponentReady, isMyTurn, firstPlayerName }) {
  const handleCardClick = (cardIndex) => {
    if (!isReady && isMyTurn) {
      onCardSelect(cardIndex)
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
        {cards.map((card, index) => {
          const isSelected = selectedCard === index;
          const cardType = card.cardType || {};
          const typeColor = cardType.color || 'rgba(255, 255, 255, 0.3)';
          
          return (
            <button
              key={index}
              className={`card ${isSelected ? 'selected' : ''} ${isReady ? 'locked' : ''}`}
              onClick={() => handleCardClick(index)}
              disabled={!isMyTurn || isReady}
              style={{
                width: '90px',
                height: '130px',
                borderRadius: '12px',
                border: `3px solid ${isSelected ? '#4CAF50' : typeColor}`,
                background: isSelected 
                  ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.1))' 
                  : `linear-gradient(135deg, ${typeColor}20, ${typeColor}05)`,
                color: 'white',
                fontSize: '2rem',
                fontWeight: 'bold',
                cursor: isMyTurn && !isReady ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                transform: isSelected ? 'translateY(-10px)' : 'none',
                boxShadow: isSelected 
                  ? '0 10px 20px rgba(76, 175, 80, 0.3)' 
                  : `0 4px 8px ${typeColor}30`,
                opacity: isReady ? 0.7 : 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Card type indicator */}
              <div style={{
                position: 'absolute',
                top: '5px',
                left: '5px',
                fontSize: '1rem',
                opacity: 0.8
              }}>
                {cardType.icon}
              </div>
              
              {/* Card type indicator (right) */}
              <div style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                fontSize: '0.7rem',
                opacity: 0.6,
                fontWeight: 'normal'
              }}>
                {cardType.name}
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                <span>{card.value}</span>
                {isSelected && (
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
          );
        })}
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
          {firstPlayerName && (
            <p style={{ color: '#2196F3', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              🎯 {firstPlayerName} goes first this round
            </p>
          )}
          {!isMyTurn && <p style={{ color: '#ff9800' }}>Waiting for your turn...</p>}
          {opponentReady && <p style={{ color: '#4CAF50' }}>Opponent is ready!</p>}
          {!selectedCard && isMyTurn && <p>Select a card to play</p>}
          {selectedCard !== null && isReady && cards[selectedCard] && (
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(76, 175, 80, 0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(76, 175, 80, 0.5)'
            }}>
              <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                Your selected card: {cards[selectedCard].cardType?.icon} {cards[selectedCard].value} ({cards[selectedCard].cardType?.name})
              </p>
              <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                (Only you can see this)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CardHand