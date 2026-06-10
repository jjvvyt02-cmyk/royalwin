const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    'https://royalwin-32d97-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: process.env.TELEGRAM_CHANNEL,
      text
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

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('Telegram Response:', data);
          resolve(data);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const snap = await db.ref('wingo/wingo5min/history').once('value');
  const history = snap.val();

  const recent = Array.isArray(history)
    ? history.slice(0, 10)
    : Object.values(history).slice(0, 10);

  let red = 0;
  let green = 0;

  for (const item of recent) {
    if (!item) continue;

    if (item.color === 'red') red++;
    if (item.color === 'green') green++;
  }

  const prediction = green > red ? '🔴 RED' : '🟢 GREEN';

  const current = await db.ref('wingo/wingo5min').once('value');
  const data = current.val();

  const message = `🎯 ROYALWIN 5 MIN SIGNAL

Period: ${data.lastProcessedPeriod}

Prediction: ${prediction}

📊 Statistics
🔴 Red: ${red}
🟢 Green: ${green}`;

  console.log(message);

  await sendTelegram(message);
}

async function runBot() {
  try {
    console.log('Running bot:', new Date().toISOString());
    await main();
    console.log('Bot completed successfully');
  } catch (err) {
    console.error('Bot error:', err);
  }
}

// Run immediately on startup
runBot();

// Run every 5 minutes
setInterval(() => {
  runBot();
}, 5 * 60 * 1000);
