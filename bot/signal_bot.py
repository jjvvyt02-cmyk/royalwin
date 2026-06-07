import os
import json
import random
import requests
import firebase_admin

from firebase_admin import credentials
from firebase_admin import db

service_account = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account)
    firebase_admin.initialize_app(
        cred,
        {
            "databaseURL": "https://royalwin-32d97-default-rtdb.asia-southeast1.firebasedatabase.app"
        },
    )

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHANNEL = os.environ["TELEGRAM_CHANNEL"]

ref = db.reference("wingo/wingo5min/history")
history = ref.get()

if not history:
    print("No history found")
    exit()

if isinstance(history, dict):
    history = list(history.values())

history = history[:20]

greens = 0
reds = 0

for row in history:
    n = int(row["num"])

    if n in [1, 3, 7, 9]:
        greens += 1
    elif n in [2, 4, 6, 8]:
        reds += 1
    elif n == 0:
        reds += 1
    elif n == 5:
        greens += 1

if greens > reds:
    prediction = "🔴 RED"
elif reds > greens:
    prediction = "🟢 GREEN"
else:
    prediction = random.choice(["🟢 GREEN", "🔴 RED"])

message = f"""
🎯 ROYALWIN 5 MIN SIGNAL

Prediction: {prediction}

Strategy: Trend Analysis
Risk: Medium

⚠️ Educational signal only.
"""

url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

requests.post(
    url,
    json={
        "chat_id": CHANNEL,
        "text": message
    }
)

print("Signal posted")
