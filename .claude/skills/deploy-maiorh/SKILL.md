---
name: deploy-maiorh
description: Use sempre que o usuário pedir para publicar, subir, dar deploy, enviar ou "colocar no ar" alterações do site da MaioRH (site MaioRH) — mesmo que ele só diga "sobe isso" ou "publica". Garante que as mudanças foram testadas localmente antes de qualquer commit/push, e que o usuário aprovou o commit antes de ele acontecer.
---

# Deploy do site MaioRH

Este site ainda não tem deploy automático (sem remote configurado até o momento em que esta skill foi escrita) — "publicar" aqui significa, no mínimo, commitar as mudanças localmente, e possivelmente fazer push se/quando houver um remote configurado.

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

A MaioRH tem identidade visual própria e deliberadamente diferente do site irmão (América): tipografia serifada (Fraunces + IBM Plex Sans), sem radar/glow/marquee, cantos quase retos, roxo mais profundo (`#6b21a8`) e dourado (`#c9a227`) como assinatura, e um motivo gráfico de "picos ascendentes" (do próprio logo) usado como recorte de seção e no rodapé. Não reintroduzir elementos visuais copiados do site da América aqui.
