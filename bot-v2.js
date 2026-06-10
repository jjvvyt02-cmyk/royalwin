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
          console.log(data);
          resolve(data);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runBot() {
  try {
    const currentSnap = await db.ref('wingo/wingo5min').once('value');
    const current = currentSnap.val();

    const historySnap = await db.ref('wingo/wingo5min/history').once('value');
    const history = historySnap.val();

    console.log('Current Period:', current.lastProcessedPeriod);
    console.log('Latest Result:', history[0]);

  } catch (err) {
    console.error(err);
  }
}

runBot();

setInterval(runBot, 30000);
