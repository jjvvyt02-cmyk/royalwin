const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.TELEGRAM_CHANNEL;

const payload = JSON.stringify({
  chat_id: channel,
  text: "Royalwin Test Message"
});

const req = https.request(
  `https://api.telegram.org/bot${token}/sendMessage`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  (res) => {
    console.log("Status:", res.statusCode);
    res.on('data', chunk => console.log(chunk.toString()));
  }
);

req.on('error', console.error);
req.write(payload);
req.end();
