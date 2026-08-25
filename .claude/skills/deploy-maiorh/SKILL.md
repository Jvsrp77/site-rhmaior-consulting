---
name: deploy-maiorh
description: Use sempre que o usuário pedir para publicar, subir, dar deploy, enviar ou "colocar no ar" alterações do site da MaioRH (site MaioRH) — mesmo que ele só diga "sobe isso" ou "publica". Garante que as mudanças foram testadas localmente antes de qualquer commit/push, e que o usuário aprovou o commit antes de ele acontecer.
---

# Deploy do site MaioRH

Este site não tem deploy automático nem remote git configurado — "publicar" significa: commitar localmente (com aprovação do usuário), sincronizar a pasta `site MaioRH-deploy` (só os arquivos servíveis, sem `.git`/`.claude`/`.sql`/`.md`) e o usuário mesmo arrastar essa pasta em **app.netlify.com/drop** no navegador dele. O assistente não consegue fazer esse arrasto por conta própria (é interação do sistema de arquivos local do usuário com o navegador dele) — apenas deixa a pasta pronta e instrui os passos.

O backend (Supabase) já está criado e conectado (projeto `qaviuelxsokbdpllqrap`, credenciais reais já embutidas em site.js/vagas.js/vaga.js/painel.js) — não confundir com o estado inicial do projeto, quando ainda usava placeholders.

Siga esta ordem, sem pular etapas:

## 1. Teste localmente antes de qualquer coisa

O ambiente sandbox do assistente roda isolado — um servidor local iniciado pela ferramenta Bash/PowerShell do assistente **não é acessível pelo navegador real do usuário**. Portanto:

- Não tente validar a mudança abrindo um servidor você mesmo e checando via browser tool como se o usuário fosse enxergar o resultado — isso serve só para o próprio assistente conferir (DOM, console, requisições), nunca para "mostrar" o site ao usuário.
- Peça para o usuário rodar o servidor local dele mesmo, se ainda não estiver rodando:
  ```powershell
  cd "C:\Users\jrpin\OneDrive\Documentos\site MaioRH"; python -m http.server 8000
  ```
- Nunca sugira abrir o `index.html` direto por duplo-clique (`file://`) — o CSP da página bloqueia o carregamento do CSS e a página aparece sem estilo. Isso não é bug do site.
- Peça para o usuário confirmar visualmente que a alteração funciona como esperado antes de seguir para o commit.

## 2. Revise o que vai ser commitado

Antes de commitar, rode `git status` e `git diff` para conferir exatamente o que está mudando. Se aparecer algo inesperado (arquivo que você não tocou, credencial, dado sensível), pare e pergunte ao usuário antes de continuar.

## 3. Peça aprovação antes do commit

Nunca rode `git commit` sem o usuário confirmar explicitamente. Mostre um resumo do que vai entrar no commit e a mensagem proposta, e espere a confirmação antes de executar.

## 4. Push só se pedido e só se houver remote

Se o repositório ainda não tiver um remote configurado, avise o usuário em vez de tentar configurar um sozinho — a escolha de hospedagem (Netlify/Vercel/GitHub Pages/hospedagem tradicional) é decisão dele. Se já houver remote e o usuário pedir para subir, confirme o destino (branch/remote) antes do `git push`.

## Identidade visual deste site

O site adota a marca real da empresa (RhMaior Consulting, rhmetodo.com.br/maiorh.com.br): tipografia serifada (Fraunces + IBM Plex Sans), cantos quase retos, e a paleta azul petróleo do logo real (`--ink:#0a1d26`, `--orange:#217ba8`, `--gold:#419dcc`) — não é mais roxo/dourado, isso foi uma identidade provisória usada antes de ter acesso à marca real. O logo é a seta em duas tonalidades de azul (vetorizada em `.brand-mark`, `favicon.svg` e nos favicons/og-image gerados via PIL). Não reintroduzir roxo/dourado nem elementos visuais copiados do site irmão (América) aqui.
