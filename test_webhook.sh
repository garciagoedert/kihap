#!/bin/bash

# Test webhook with a simulated incoming message
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "test_message_123",
      "from": "5511999998888@s.whatsapp.net",
      "from_me": false,
      "text": {
        "body": "Olá! Esta é uma mensagem de teste do webhook."
      },
      "timestamp": 1733700000,
      "chat_id": "5511999998888@s.whatsapp.net"
    }],
    "event": {
      "type": "messages",
      "event": "post"
    }
  }'

echo ""
echo "Teste enviado! Verifique os logs e o Kanban."
