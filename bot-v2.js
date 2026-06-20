const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://royalwin-32d97-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

let lastPredictedPeriod = null;
let pendingPrediction = null; // { period, color }

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
        res.on('end', () => { console.log('Telegram:', data); resolve(data); });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function randomColor() {
  const colors = ['Red', 'Green', 'Violet'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function colorEmoji(color) {
  if (color === 'Red') return '🔴';
  if (color === 'Green') return '🟢';
  if (color === 'Violet') return '🟣';
  return '';
}

// Map result number to color (same logic as game engine)
function numToColor(num) {
  if (num === 0) return 'Violet'; // 0 is violet+red
  if (num === 5) return 'Violet'; // 5 is violet+green
  if ([1, 3, 7, 9].includes(num)) return 'Green';
  if ([2, 4, 6, 8].includes(num)) return 'Red';
  return 'Red';
}

async function runBot() {
  try {
    const snap = await db.ref('wingo/wingo5min').once('value');
    const data = snap.val();

    if (!data) return;

    const currentPeriod = data.lastProcessedPeriod;
    const lastResult = data.lastResult;

    // Step 1: Check if there's a pending prediction to resolve
    if (pendingPrediction && lastResult) {
      const resultPeriod = lastResult.period || lastResult.round;
      if (resultPeriod && resultPeriod === pendingPrediction.period) {
        const actualColor = numToColor(lastResult.num);
        const predicted = pendingPrediction.color;
        // Check win: exact match, or Violet counts as win if 0 or 5
        const isWin = predicted === actualColor;

        const resultMsg =
          `📊 <b>Period ${resultPeriod} Result</b>\n` +
          `Predicted: ${colorEmoji(predicted)} ${predicted}\n` +
          `Actual: ${colorEmoji(actualColor)} ${actualColor} (Number: ${lastResult.num})\n` +
          (isWin ? `✅ <b>WIN!</b>` : `❌ <b>LOSS</b>`);

        await sendTelegram(resultMsg);
        console.log(`Result sent for period ${resultPeriod}: ${isWin ? 'WIN' : 'LOSS'}`);
        pendingPrediction = null;
      }
    }

    // Step 2: Post new prediction for next period
    if (currentPeriod && currentPeriod !== lastPredictedPeriod) {
      const color = randomColor();
      const nextPeriod = currentPeriod + 1;

      const predMsg =
        `🎯 <b>RoyalWin 5Min Signal</b>\n` +
        `Period: <b>${nextPeriod}</b>\n` +
        `Prediction: ${colorEmoji(color)} <b>${color}</b>\n` +
        `⏰ Next round starting soon!\n\n` +
        `🔗 Play: https://jjvvyt02-cmyk.github.io/royalwin/`;

      await sendTelegram(predMsg);
      console.log(`Prediction sent: Period ${nextPeriod} → ${color}`);

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
