#!/bin/bash

# 1. New Prospect Message from "Multiturn Test"
PHONE="554199997777"
ID_PREFIX="test_MULTI_"
TIMESTAMP=$(date +%s)

echo ">>> Step 1: Simulated New Prospect (${PHONE})"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'001",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Multiturn Test User",
      "from_me": false,
      "text": {
        "body": "Olá, como funciona?"
      },
      "timestamp": '${TIMESTAMP}',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\nWaiting 5 seconds..."
sleep 5

# 2. Reply with City Keyword (Brasília)
echo ">>> Step 2: User replies with 'Brasília'"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'002",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Multiturn Test User",
      "from_me": false,
      "text": {
        "body": "Moro em Brasília"
      },
      "timestamp": '$(($TIMESTAMP + 10))',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\nWaiting 5 seconds..."
sleep 5

# 3. Reply with Unit Keyword (Asa Sul)
echo ">>> Step 3: User replies with 'Asa Sul'"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'003",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Multiturn Test User",
      "from_me": false,
      "text": {
        "body": "Gostaria na Asa Sul, por favor"
      },
      "timestamp": '$(($TIMESTAMP + 20))',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\n>>> Verification Instructions:"
echo "Check Firestore logs or UI:"
echo "1. Step 1: Welcome message sent."
echo "2. Step 2: City menu sent (Asa Sul, Sudoeste..., Unit NOT set)."
echo "3. Step 3: Unit set to 'Kihap - Asa Sul'. Confirmation sent ('pra você ou outra pessoa?')."
