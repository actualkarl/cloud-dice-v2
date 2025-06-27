-- Cloud Dice V2 - Gladiator Arena Database Schema
-- PostgreSQL schema for Railway deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table for persistent user profiles
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  current_rating INTEGER DEFAULT 1000,
  highest_rating INTEGER DEFAULT 1000,
  favorite_gladiator_type VARCHAR(20), -- 'light', 'medium', 'heavy'
  total_damage_dealt INTEGER DEFAULT 0,
  total_damage_blocked INTEGER DEFAULT 0
);

-- Match history for analytics and player records
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6),
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  match_type VARCHAR(50) DEFAULT 'quick', -- 'quick', 'ranked', 'tournament', 'ai'
  gladiator_type_p1 VARCHAR(20),
  gladiator_type_p2 VARCHAR(20),
  duration_seconds INTEGER,
  rounds_played INTEGER,
  final_hp_p1 INTEGER,
  final_hp_p2 INTEGER,
  final_stamina_p1 INTEGER,
  final_stamina_p2 INTEGER,
  cards_played_p1 INTEGER,
  cards_played_p2 INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Track individual card performance for balance
CREATE TABLE IF NOT EXISTS card_stats (
  card_id VARCHAR(50) PRIMARY KEY, -- e.g., 'heavy_5', 'light_ace', 'heat_queen'
  card_type VARCHAR(20), -- 'light', 'medium', 'heavy', 'heat'
  times_played INTEGER DEFAULT 0,
  times_won_round INTEGER DEFAULT 0,
  times_in_winning_match INTEGER DEFAULT 0,
  avg_round_played DECIMAL(3,2),
  avg_damage_dealt DECIMAL(5,2),
  avg_damage_blocked DECIMAL(5,2),
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Track Heat of Battle card usage
CREATE TABLE IF NOT EXISTS heat_card_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  player_id UUID REFERENCES players(id),
  card_name VARCHAR(50),
  round_played INTEGER,
  stamina_cost INTEGER,
  effect_description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Balance test results (uploaded from local testing)
CREATE TABLE IF NOT EXISTS balance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date TIMESTAMP DEFAULT NOW(),
  test_type VARCHAR(50), -- 'ai_vs_ai', 'player_pool', 'card_analysis'
  total_matches INTEGER,
  gladiator_win_rates JSONB, -- {"light": 0.33, "medium": 0.34, "heavy": 0.33}
  card_performance JSONB, -- Detailed card statistics
  identified_issues TEXT[],
  recommendations TEXT[],
  raw_data_sample JSONB -- Sample of individual match results
);

-- AI opponent configurations and performance
CREATE TABLE IF NOT EXISTS ai_opponents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  personality VARCHAR(50), -- 'aggressive', 'defensive', 'balanced', 'adaptive'
  difficulty_level INTEGER, -- 1-10
  decision_weights JSONB, -- AI decision parameters
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  avg_match_duration DECIMAL(6,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session analytics for Railway monitoring
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6),
  arena_type VARCHAR(20), -- 'dice', 'gladiator'
  player_count INTEGER,
  spectator_count INTEGER,
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  total_rolls INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  peak_concurrent_users INTEGER
);

-- Indexes for performance
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_rating ON players(current_rating DESC);
CREATE INDEX idx_matches_created ON matches(created_at DESC);
CREATE INDEX idx_matches_players ON matches(player1_id, player2_id);
CREATE INDEX idx_card_stats_performance ON card_stats(times_won_round DESC);
CREATE INDEX idx_sessions_active ON game_sessions(session_end) WHERE session_end IS NULL;

-- Views for common queries
CREATE VIEW player_rankings AS
SELECT 
  name,
  current_rating,
  total_matches,
  wins,
  CASE 
    WHEN total_matches > 0 THEN ROUND((wins::DECIMAL / total_matches) * 100, 2)
    ELSE 0
  END as win_rate,
  favorite_gladiator_type
FROM players
WHERE total_matches >= 10
ORDER BY current_rating DESC;

CREATE VIEW recent_matches AS
SELECT 
  m.id,
  p1.name as player1_name,
  p2.name as player2_name,
  pw.name as winner_name,
  m.match_type,
  m.rounds_played,
  m.duration_seconds,
  m.created_at
FROM matches m
JOIN players p1 ON m.player1_id = p1.id
JOIN players p2 ON m.player2_id = p2.id
LEFT JOIN players pw ON m.winner_id = pw.id
ORDER BY m.created_at DESC
LIMIT 100;

-- Function to update player stats after match
CREATE OR REPLACE FUNCTION update_player_stats() RETURNS TRIGGER AS $$
BEGIN
  -- Update winner stats
  UPDATE players 
  SET 
    wins = wins + 1,
    total_matches = total_matches + 1,
    current_rating = current_rating + 25,
    highest_rating = GREATEST(highest_rating, current_rating + 25),
    last_seen = NOW()
  WHERE id = NEW.winner_id;

  -- Update loser stats
  UPDATE players 
  SET 
    losses = losses + 1,
    total_matches = total_matches + 1,
    current_rating = GREATEST(current_rating - 25, 800),
    last_seen = NOW()
  WHERE id IN (NEW.player1_id, NEW.player2_id) 
    AND id != NEW.winner_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update player stats
CREATE TRIGGER match_completed
AFTER INSERT ON matches
FOR EACH ROW
WHEN (NEW.winner_id IS NOT NULL)
EXECUTE FUNCTION update_player_stats();

-- Sample queries for common operations
/*
-- Get player profile
SELECT * FROM players WHERE name = 'PlayerName';

-- Get recent matches for a player
SELECT * FROM recent_matches 
WHERE player1_name = 'PlayerName' OR player2_name = 'PlayerName';

-- Get card performance stats
SELECT * FROM card_stats 
ORDER BY times_won_round DESC LIMIT 10;

-- Get current active sessions
SELECT * FROM game_sessions 
WHERE session_end IS NULL;

-- Get balance report summary
SELECT 
  test_date,
  total_matches,
  gladiator_win_rates,
  identified_issues
FROM balance_reports 
ORDER BY test_date DESC 
LIMIT 1;
*/