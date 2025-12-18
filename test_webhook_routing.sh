#!/bin/bash

# 1. New Prospect Message from "Router Test"
PHONE="554199998888"
ID_PREFIX="test_ROUTING_"
TIMESTAMP=$(date +%s)

echo ">>> Step 1: Simulated New Prospect (${PHONE})"
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'001",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Router Test User",
      "from_me": false,
      "text": {
        "body": "Olá, vi o anúncio."
      },
      "timestamp": '${TIMESTAMP}',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\nWaiting 5 seconds..."
sleep 5

# 2. Reply with City Keyword
echo ">>> Step 2: User replies with 'Brasília'"
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'002",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Router Test User",
      "from_me": false,
      "text": {
        "body": "Gostaria de treinar em Brasília"
      },
      "timestamp": '$(($TIMESTAMP + 10))',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\n>>> Verification Instructions:"
echo "Check Firestore logs or UI:"
echo "1. Prospect 'Router Test User' created."
echo "2. Welcome message sent."
echo "3. Unit Updated to 'Kihap - Brasília'."
echo "4. Confirmation message sent."
