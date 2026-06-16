#!/bin/bash

# Test Meta WhatsApp webhook with a simulated incoming message
curl -X POST https://us-central1-intranet-kihap.cloudfunctions.net/whatsappWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "979744408224312",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5548988780389",
            "phone_number_id": "1116033658265418"
          },
          "contacts": [{
            "profile": {
              "name": "Teste Miles"
            },
            "wa_id": "5548988780389"
          }],
          "messages": [{
            "from": "5548988780389",
            "id": "wamid.HBgNNTU0ODk4ODc4MDM4ORUCABEYEjY1RDc0M0MxOTRDQjE4QjA1QQA=",
            "timestamp": "1733730000",
            "text": {
              "body": "Olá Miles! Meu nome é Teste Webhook e gostaria de agendar uma aula experimental no Centro de Florianópolis."
            },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'

echo ""
echo "Simulação de mensagem do WhatsApp enviada para o webhook!"
