# Rondello Buffet — Site novo · Guia de handoff

Site estático (HTML/CSS/JS puro), pronto para publicar e fácil de manter.

## Estrutura
- `index.html` — Home (todas as seções)
- `conheca-nos.html` — Sobre / história / Chef Paulo
- `servicos.html` — Tipos de evento, buffet completo, Rondello em Casa, galeria
- `como-contratar.html` — Processo (4 etapas) + FAQ
- `assets/styles.css` — sistema visual (cores, tipografia, componentes)
- `assets/main.js` — interações (menu, reveal no scroll, contadores, FAQ, lightbox, form)
- `assets/img/` — **imagens placeholder** (substituir pelas fotos profissionais)

## Antes de publicar — substituir
1. **Fotos**: trocar os arquivos em `assets/img/` pelas fotos reais (mantendo os nomes, ou atualizando os `src`). Sugestão de proporção: hero/CTA/números = paisagem larga; `chef.jpg`/`about-1.jpg` = retrato 4:5; eventos = 4:5; galeria = mista.
2. **Painel do cliente**: o botão aponta para `https://painel.rondellobuffet.com.br/` — ajustar para a URL real do sistema.
3. **Números** (seção de estatísticas em `index.html` e `conheca-nos.html`): valores reais já aplicados — 30 anos, +2.750 eventos, +1.645 casamentos, 430 mil convidados. Ajuste quando os números evoluírem.
4. **Avaliações Google**: os depoimentos na Home linkam para `https://g.page/r/CXyDTcVoQQKHEAE/review` (avaliação real). Conferir se é o link correto e atualizar os textos dos depoimentos por avaliações reais quando quiser.
5. **Redes sociais**: links de Instagram/Facebook no rodapé estão genéricos — apontar para os perfis reais.
6. **Formulário "Fale conosco"**: hoje é demonstrativo (não envia). Conectar a um backend/serviço (ex.: Formspree, e-mail, ou endpoint próprio).

## Identidade
- Cores: marinho profundo `#05111E`/`#08182A`, champanhe `#C2A062`, creme `#F4EEE3` (variáveis CSS em `:root`).
- Tipografia: **Cormorant Garamond** (títulos) + **Hanken Grotesk** (textos) via Google Fonts.
- Logo: recriada em SVG no header/rodapé (monograma R + wordmark).

## Analytics / cliques
Inserir o snippet (GA4, Clarity, Plausible, etc.) antes de `</head>` nas 4 páginas.
Pontos de conversão já marcados por links do WhatsApp (`wa.me/5515997650209`) e pelos CTAs — fáceis de rastrear como eventos de clique.
