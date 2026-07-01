const { Pool } = require('pg');
const https = require('https');

// ── NEON DATABASE ──
let _pool;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return _pool;
}
async function query(sql, params) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

let lastPredictedPeriod = null;
let pendingPrediction = null; // { period, color }
let lossStreak = 0;

const MULTIPLIERS = [1, 3, 9, 27, 81, 243];

function getMultiplier() {
  const idx = Math.min(lossStreak, MULTIPLIERS.length - 1);
  return MULTIPLIERS[idx];
}

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: process.env.TELEGRAM_CHANNEL,
      text,
      parse_mode: 'HTML'
    });
    const req = https.request(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => { console.log('Telegram sent'); resolve(data); });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function randomColor() {
  const colors = ['Red', 'Green'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function colorEmoji(color) {
  const c = color.toLowerCase();
  if (c === 'red') return '🔴';
  if (c === 'green') return '🟢';
  if (c === 'violet') return '🟣';
  return '⚪';
}

async function runBot() {
  try {
    // Get game state for 5min timer from Neon
    const stateRes = await query(
      `SELECT last_result, last_period_id FROM game_state WHERE timer = 5`,
      []
    );
    if (stateRes.rows.length === 0) return;
    const state = stateRes.rows[0];

    const currentPeriod = state.last_period_id ? parseInt(state.last_period_id) : null;
    const lastResult = state.last_result !== null ? state.last_result : null;

    // Step 1: Resolve pending prediction (silent)
    if (pendingPrediction && lastResult !== null) {
      // Get last history entry for 5min to get color
      const histRes = await query(
        `SELECT win_num, color FROM game_history
         WHERE timer = 5 AND period_id = $1 LIMIT 1`,
        [String(pendingPrediction.period)]
      );
      if (histRes.rows.length > 0) {
        const hist = histRes.rows[0];
        let actualColor = hist.color.toLowerCase();
        const num = parseInt(hist.win_num);
        // violet+red (0) = red, violet+green (5) = green
        if (actualColor === 'violet') {
          actualColor = num === 0 ? 'red' : 'green';
        }
        const predicted = pendingPrediction.color.toLowerCase();
        const isWin = predicted === actualColor;

        if (isWin) {
          lossStreak = 0;
        } else {
          lossStreak++;
        }

        console.log(`Period ${pendingPrediction.period}: ${isWin ? 'WIN' : 'LOSS'} | streak: ${lossStreak}`);
        pendingPrediction = null;
      }
    }

    // Step 2: New prediction for next period
    if (currentPeriod && currentPeriod !== lastPredictedPeriod) {
      const color = randomColor();
      const nextPeriod = currentPeriod + 1;
      const multiplier = getMultiplier();

      const msg =
        `🎯 <b>RoyalWin 5Min Signal</b>\n` +
        `─────────────────\n` +
        `📌 Period: <b>${nextPeriod}</b>\n` +
        `${colorEmoji(color)} Prediction: <b>${color.toUpperCase()}</b>\n` +
        `💰 Stake: <b>${multiplier}x</b>\n` +
        `─────────────────\n` +
        `🔗 Play: https://royalwingames.com`;

      await sendTelegram(msg);
      console.log(`Prediction: Period ${nextPeriod} → ${color} | ${multiplier}x`);

      lastPredictedPeriod = currentPeriod;
      pendingPrediction = { period: nextPeriod, color };
    }

  } catch (err) {
    console.error('Bot error:', err.message);
  }
}

console.log('RoyalWin Prediction Bot started...');
runBot();
setInterval(runBot, 30000);
