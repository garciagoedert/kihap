#!/bin/bash

# Test webhook with a simulated incoming message including NAME
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "test_NAME_123",
      "from": "555199998888@s.whatsapp.net",
      "from_name": "Cliente Teste com Nome",
      "from_me": false,
      "text": {
        "body": "Olá! Quero testar se meu nome aparece no card."
      },
      "timestamp": 1733710000,
      "chat_id": "555199998888@s.whatsapp.net"
    }],
    "event": {
      "type": "messages",
      "event": "post"
    }
  }'

echo ""
echo "Teste enviado! Verifique se o card 'Cliente Teste com Nome' aparece no Kanban."
