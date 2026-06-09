const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://royalwin-32d97-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

async function main() {
  const snap = await db.ref('wingo/wingo5min').once('value');
  const data = snap.val();

  console.log('Firebase Connected');
  console.log('Last Result:', data.lastResult);
  console.log('Last Period:', data.lastProcessedPeriod);
}

main().catch(console.error);
