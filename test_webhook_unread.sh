#!/bin/bash

# Test webhook with a new sender to verify UNREAD state
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whapiWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "test_UNREAD_123",
      "from": "5599988877766@s.whatsapp.net",
      "from_name": "Teste Novo Card Não Lido",
      "from_me": false,
      "text": {
        "body": "Este card deve aparecer com um indicador de NOVO!"
      },
      "timestamp": 1733720000,
      "chat_id": "5599988877766@s.whatsapp.net"
    }],
    "event": {
      "type": "messages",
      "event": "post"
    }
  }'

echo ""
echo "Teste enviado! Verifique se o card 'Teste Novo Card Não Lido' aparece com o badge 'Novo' piscando."
