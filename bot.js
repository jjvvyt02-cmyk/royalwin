const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://royalwin-32d97-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

async function main() {
  const snap = await db.ref('wingo/wingo5min/history').once('value');

  const history = snap.val();

  console.log(JSON.stringify(history, null, 2));
}

main().catch(console.error);
