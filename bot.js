const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.TELEGRAM_CHANNEL;

const text = '✅ Royalwin bot test message from GitHub Actions';

const url = `https://api.telegram.org/bot${token}/sendMessage`;

const data = JSON.stringify({
  chat_id: channel,
  text: text
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(url, options, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', console.error);
req.write(data);
req.end();
