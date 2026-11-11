# Aplicativo (PWA)

Pedido do dono (10/11/2026): o portal inteiro funciona como aplicativo instalável e responsivo em notebook, MacBook, iPad, iPhone e Galaxy.

## 1. O que o usuário ganha

- **Instalar**: o portal vira um ícone na tela inicial/Dock e abre em janela própria, sem a barra do navegador.
  - Chrome/Edge (notebook Windows, Galaxy, MacBook com Chrome): convite com o botão "Instalar" na tela de início, ou o ícone de instalar na barra de endereço.
  - iPhone e iPad (Safari): Compartilhar → "Adicionar à Tela de Início". O convite mostra esse caminho (a Apple não permite botão).
  - MacBook (Safari): menu Arquivo → "Adicionar ao Dock".
- **Atalhos do ícone** (toque longo no celular, clique direito no computador): Minhas pendências, Pedidos, Notificações.
- **Sem conexão**: em vez do erro do navegador, a tela "Sem conexão com a internet" com "Tentar de novo"; volta sozinha quando a rede retorna.
- **Abre mais rápido**: os arquivos do aplicativo (código e ícones) ficam guardados no aparelho.

## 2. O que não faz (de propósito)

- **Não funciona offline para dados**: pedidos, pendências e arquivos vêm sempre do servidor, com a sessão conferida. O service worker nunca guarda páginas, respostas de API nem arquivos do portal (aparelho compartilhado ou perdido não expõe dado de cliente/fornecedor).
- **Sem notificação push** por enquanto (ver Melhorias).

## 3. Como está montado

| Peça | Onde |
| --- | --- |
| Manifesto (nome, ícones, cor, atalhos, janela própria) | `src/app/manifest.ts` |
| Service worker (arquivos públicos + tela sem conexão) | `public/sw.js` |
| Tela sem conexão (estática, pt/en/zh) | `public/offline.html` |
| Registro do service worker e convite para instalar | `src/components/pwa-install.tsx` (no layout raiz) |
| Cabeçalhos do `sw.js` (sem cache, escopo `/`) | `next.config.ts` |
| Tela toda, margens seguras e ajustes de toque | `src/app/layout.tsx` (viewport) e `src/app/globals.css` |
| Textos | `src/i18n/modules/intro.ts` (`pwa.install.*`) |

Regras:

- O service worker só é registrado em produção (em desenvolvimento ele guardaria arquivos que mudam a cada alteração; o E2E roda sem ele).
- O convite aparece só na tela de início (`/app`), nunca no login (cobriria o botão "Entrar" no celular) nem no meio de um formulário. "Agora não" esconde por 30 dias; instalado, não aparece mais.
- Mudou o `sw.js`: troque `VERSION` para os aparelhos descartarem o que guardaram.

## 4. Responsividade

- Todas as telas de lista e as telas de detalhe (pedido, ficha de compra, documento do pedido, solicitação, cotação, briefing, produto, fornecedor, cliente, vitrine) foram medidas em 375 px (iPhone), 412 px (Galaxy), 820 px (iPad) e 1280 px (notebook): nenhuma estoura para os lados. Tabelas largas rolam dentro do próprio quadro.
- Corrigido nesta entrega: a tabela de blocos da ficha de compra estourava a página no celular.
- iPhone/iPad: campos usam letra de 16 px (o Safari dava zoom ao tocar em campo menor); o conteúdo respeita o recorte da câmera e a barra de início.

## 5. Como testar

1. Abra o portal no aparelho e instale (seção 1).
2. Abra pelo ícone: deve abrir sem a barra do navegador, já em "Início".
3. Ative o modo avião e toque num link: aparece "Sem conexão com a internet"; desative e a tela volta.
4. Toque longo no ícone (ou clique direito): os três atalhos.

## 6. Melhorias futuras

- Notificação push (pendência nova, mensagem) para quem instalou.
- Fotos tiradas sem rede na fábrica, enviadas quando a conexão voltar.
- Telas de abertura (splash) próprias para iPhone/iPad.
