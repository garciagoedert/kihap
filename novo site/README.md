# Plataforma Web Kihap Martial Arts

## Visão Geral

Este repositório contém o código-fonte da plataforma web da Kihap Martial Arts. O projeto é composto por um site público, um portal para membros e uma intranet administrativa para gerenciamento interno.

A plataforma é construída com HTML, CSS e JavaScript no front-end, e utiliza Firebase Cloud Functions para os serviços de back-end.

## Tecnologias Utilizadas

- **Front-end:**
  - HTML5
  - CSS3 (com Tailwind CSS)
  - JavaScript (Vanilla)
  - Swiper.js para carrosséis

- **Back-end:**
  - Node.js
  - Firebase Cloud Functions

- **Serviços:**
  - Firebase (Authentication, Firestore, Cloud Storage)
  - Stripe para processamento de pagamentos

## Estrutura do Projeto

O projeto está organizado nos seguintes diretórios principais:

- `/`: Contém as páginas públicas do site (ex: `index.html`, `programas/`, `unidades/`).
- `/components`: Módulos de HTML reutilizáveis (header, footer, etc.).
- `/members`: A área restrita para membros da academia.
- `/intranet`: O painel administrativo para gerenciamento da plataforma.
- `/functions`: O código-fonte do back-end (Firebase Cloud Functions).
- `/css`, `/js`, `/imgs`: Diretórios para assets estáticos.
