#!/bin/bash

# 1. New Prospect Message from "Notification Test"
PHONE="554899996666"
ID_PREFIX="test_NOTIFY_"
TIMESTAMP=$(date +%s)

echo ">>> Step 1: Simulated New Prospect (${PHONE})"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'001",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Notify Test User",
      "from_me": false,
      "text": {
        "body": "Olá, quero treinar."
      },
      "timestamp": '${TIMESTAMP}',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\nWaiting 5 seconds..."
sleep 5

# 2. Reply with City Keyword (Florianópolis)
echo ">>> Step 2: User replies with 'Florianópolis'"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'002",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Notify Test User",
      "from_me": false,
      "text": {
        "body": "Florianópolis"
      },
      "timestamp": '$(($TIMESTAMP + 10))',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\nWaiting 5 seconds..."
sleep 5

# 3. Reply with Unit Keyword (Santa Mônica - has real number)
echo ">>> Step 3: User replies with 'Santa Mônica' (Should trigger notification)"
curl -S -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "'${ID_PREFIX}'003",
      "from": "'${PHONE}'@s.whatsapp.net",
      "from_name": "Notify Test User",
      "from_me": false,
      "text": {
        "body": "Santa Mônica"
      },
      "timestamp": '$(($TIMESTAMP + 20))',
      "chat_id": "'${PHONE}'@s.whatsapp.net"
    }]
  }'

echo -e "\n\n>>> Verification Instructions:"
echo "Check Firestore logs or UI:"
echo "1. Unit set to 'Kihap - Santa Mônica'."
echo "2. Log should show: '[notifyUnitManager] Sending notification to 554892172423...'"
