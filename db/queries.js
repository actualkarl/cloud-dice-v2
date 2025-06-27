// db/queries.js - PostgreSQL query helpers for Cloud Dice V2
const { Pool } = require('pg');

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Player Management Queries
const playerQueries = {
  // Get or create player
  async upsertPlayer(name) {
    const query = `
      INSERT INTO players (name) 
      VALUES ($1) 
      ON CONFLICT (name) 
      DO UPDATE SET last_seen = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [name]);
    return result.rows[0];
  },

  // Get player stats
  async getPlayerStats(playerId) {
    const query = `
      SELECT 
        p.*,
        CASE 
          WHEN total_matches > 0 THEN ROUND((wins::DECIMAL / total_matches) * 100, 2)
          ELSE 0
        END as win_rate
      FROM players p
      WHERE id = $1
    `;
    const result = await pool.query(query, [playerId]);
    return result.rows[0];
  },

  // Get player by name
  async getPlayerByName(name) {
    const query = 'SELECT * FROM players WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0];
  },

  // Update favorite gladiator type
  async updateFavoriteGladiator(playerId, gladiatorType) {
    const query = `
      UPDATE players 
      SET favorite_gladiator_type = $2 
      WHERE id = $1
    `;
    await pool.query(query, [playerId, gladiatorType]);
  }
};

// Match Management Queries
const matchQueries = {
  // Create new match
  async createMatch(matchData) {
    const query = `
      INSERT INTO matches (
        room_code, player1_id, player2_id, 
        match_type, gladiator_type_p1, gladiator_type_p2
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const result = await pool.query(query, [
      matchData.roomCode,
      matchData.player1Id,
      matchData.player2Id,
      matchData.matchType || 'quick',
      matchData.gladiatorTypeP1,
      matchData.gladiatorTypeP2
    ]);
    return result.rows[0].id;
  },

  // Complete match
  async completeMatch(matchId, matchResults) {
    const query = `
      UPDATE matches SET
        winner_id = $2,
        duration_seconds = $3,
        rounds_played = $4,
        final_hp_p1 = $5,
        final_hp_p2 = $6,
        final_stamina_p1 = $7,
        final_stamina_p2 = $8,
        cards_played_p1 = $9,
        cards_played_p2 = $10,
        completed_at = NOW()
      WHERE id = $1
    `;
    await pool.query(query, [
      matchId,
      matchResults.winnerId,
      matchResults.durationSeconds,
      matchResults.roundsPlayed,
      matchResults.finalHpP1,
      matchResults.finalHpP2,
      matchResults.finalStaminaP1,
      matchResults.finalStaminaP2,
      matchResults.cardsPlayedP1,
      matchResults.cardsPlayedP2
    ]);
  },

  // Get recent matches
  async getRecentMatches(limit = 10) {
    const query = `
      SELECT * FROM recent_matches LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  },

  // Get player match history
  async getPlayerMatches(playerId, limit = 20) {
    const query = `
      SELECT 
        m.*,
        p1.name as player1_name,
        p2.name as player2_name,
        pw.name as winner_name
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      LEFT JOIN players pw ON m.winner_id = pw.id
      WHERE m.player1_id = $1 OR m.player2_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [playerId, limit]);
    return result.rows;
  }
};

// Card Statistics Queries
const cardQueries = {
  // Update card statistics
  async updateCardStats(cardId, cardType, stats) {
    const query = `
      INSERT INTO card_stats (
        card_id, card_type, times_played, times_won_round,
        avg_damage_dealt, avg_damage_blocked
      ) VALUES ($1, $2, 1, $3, $4, $5)
      ON CONFLICT (card_id) DO UPDATE SET
        times_played = card_stats.times_played + 1,
        times_won_round = card_stats.times_won_round + $3,
        avg_damage_dealt = (
          (card_stats.avg_damage_dealt * card_stats.times_played) + $4
        ) / (card_stats.times_played + 1),
        avg_damage_blocked = (
          (card_stats.avg_damage_blocked * card_stats.times_played) + $5
        ) / (card_stats.times_played + 1),
        last_updated = NOW()
    `;
    await pool.query(query, [
      cardId,
      cardType,
      stats.wonRound ? 1 : 0,
      stats.damageDealt || 0,
      stats.damageBlocked || 0
    ]);
  },

  // Get card performance stats
  async getCardStats(orderBy = 'times_played', limit = 20) {
    const validOrderColumns = ['times_played', 'times_won_round', 'avg_damage_dealt'];
    const orderColumn = validOrderColumns.includes(orderBy) ? orderBy : 'times_played';
    
    const query = `
      SELECT * FROM card_stats 
      ORDER BY ${orderColumn} DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  },

  // Track Heat card usage
  async trackHeatCardUsage(matchId, playerId, cardName, round, staminaCost, effect) {
    const query = `
      INSERT INTO heat_card_usage (
        match_id, player_id, card_name, round_played, 
        stamina_cost, effect_description
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [matchId, playerId, cardName, round, staminaCost, effect]);
  }
};

// Session Analytics Queries
const sessionQueries = {
  // Create game session
  async createSession(roomCode, arenaType, playerCount) {
    const query = `
      INSERT INTO game_sessions (room_code, arena_type, player_count)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const result = await pool.query(query, [roomCode, arenaType, playerCount]);
    return result.rows[0].id;
  },

  // Update session stats
  async updateSession(sessionId, updates) {
    const setClauses = [];
    const values = [sessionId];
    let paramCount = 1;

    if (updates.playerCount !== undefined) {
      setClauses.push(`player_count = $${++paramCount}`);
      values.push(updates.playerCount);
    }
    if (updates.spectatorCount !== undefined) {
      setClauses.push(`spectator_count = $${++paramCount}`);
      values.push(updates.spectatorCount);
    }
    if (updates.totalRolls !== undefined) {
      setClauses.push(`total_rolls = total_rolls + $${++paramCount}`);
      values.push(updates.totalRolls);
    }
    if (updates.totalMatches !== undefined) {
      setClauses.push(`total_matches = total_matches + $${++paramCount}`);
      values.push(updates.totalMatches);
    }

    if (setClauses.length > 0) {
      const query = `UPDATE game_sessions SET ${setClauses.join(', ')} WHERE id = $1`;
      await pool.query(query, values);
    }
  },

  // End session
  async endSession(sessionId) {
    const query = 'UPDATE game_sessions SET session_end = NOW() WHERE id = $1';
    await pool.query(query, [sessionId]);
  }
};

// Balance Report Queries
const balanceQueries = {
  // Upload balance report from local testing
  async uploadBalanceReport(report) {
    const query = `
      INSERT INTO balance_reports (
        test_type, total_matches, gladiator_win_rates,
        card_performance, identified_issues, recommendations, raw_data_sample
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(query, [
      report.testType,
      report.totalMatches,
      JSON.stringify(report.gladiatorWinRates),
      JSON.stringify(report.cardPerformance),
      report.identifiedIssues,
      report.recommendations,
      JSON.stringify(report.rawDataSample)
    ]);
  },

  // Get latest balance report
  async getLatestBalanceReport() {
    const query = `
      SELECT * FROM balance_reports 
      ORDER BY test_date DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }
};

// Utility functions
const utils = {
  // Health check
  async checkConnection() {
    try {
      const result = await pool.query('SELECT NOW()');
      return { connected: true, time: result.rows[0].now };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  },

  // Get pool stats
  getPoolStats() {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
};

module.exports = {
  pool,
  playerQueries,
  matchQueries,
  cardQueries,
  sessionQueries,
  balanceQueries,
  utils
};