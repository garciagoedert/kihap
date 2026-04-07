#!/bin/bash

# Test auto-reply with a simulated message from a NEW number
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "test_AUTOREPLY_001",
      "from": "5548888877799@s.whatsapp.net",
      "from_name": "Teste Auto Reply",
      "from_me": false,
      "text": {
        "body": "Olá, gostaria de informações sobre aulas."
      },
      "timestamp": 1733730000,
      "chat_id": "5548888877799@s.whatsapp.net"
    }],
    "event": {
      "type": "messages",
      "event": "post"
    }
  }'

echo ""
echo "Teste enviado! Verifique nos logs se:"
echo "1. Prospect 'Teste Auto Reply' foi criado."
echo "2. Mensagem 'Auto-reply sent' aparece."
echo "3. O contato tem a mensagem de auto-reply no log."
