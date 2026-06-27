const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

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
    const snap = await db.ref('wingo/wingo5min').once('value');
    const data = snap.val();
    if (!data) return;

    const currentPeriod = data.lastProcessedPeriod;
    const lastResult = data.lastResult;

    // Step 1: Resolve pending prediction (silent)
    if (pendingPrediction && lastResult) {
      const resultRound = String(lastResult.round);
      const pendingRound = String(pendingPrediction.period);

      if (resultRound === pendingRound) {
        let actualColor = lastResult.color.toLowerCase();
        const num = lastResult.num;
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

        console.log(`Period ${resultRound}: ${isWin ? 'WIN' : 'LOSS'} | streak: ${lossStreak}`);
        pendingPrediction = null;
      }
    }

    // Step 2: New prediction for next period
    if (currentPeriod && currentPeriod !== lastPredictedPeriod) {
      const color = randomColor();
      const nextPeriod = currentPeriod + 1;
      const multiplier = getMultiplier();
      const stakeLabel = multiplier === 1
        ? '1x 🟡 (Base Stake)'
        : `${multiplier}x 🔺 (Recover Loss)`;

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
    console.error('Bot error:', err);
  }
}

console.log('RoyalWin Prediction Bot started...');
runBot();
setInterval(runBot, 30000);
