# Listas no nível do pedido e o produto dentro do pedido

Pedido do dono (18/11/2026), com as respostas às perguntas: vale para Encomendas, Pedidos, Solicitações ao fornecedor, Ordens de venda e Cotações de compra; o ícone de abrir, para todas as tabelas; o produto clicado dentro do pedido abre o pedido filtrado naquele produto.

## 1. A lista é do pedido, não do produto

Um pedido pode ter milhares de produtos, então as listas não mostram foto, nome ou quantidade de produto.

- **Encomendas** (`/app/requests`): Nº (link) → Cliente → Produtos (SKUs diferentes) → Situação → Containers por programação → Programações → Próximo passo → Prazo → Pedido → Analista → Data → ícones (abrir, excluir, conversa).
  - **Produtos**: os itens do pedido quando já há pedido (histórico do Sankhya), senão as solicitações do lote (`src/lib/request-composition.ts`).
  - **Programações**: a maior programação gravada entre os produtos (`requests.schedule`). Um produto sem programação conta como 1 entrega.
  - **Containers por programação**: quantos containers cada programação enche, pela caixa master (peças e CBM da variação ou do cadastro), no **maior container das Configurações** (a solicitação não grava o tipo escolhido na tela). Aparece como "2 · 1" ou "2 em cada". Fica em "—" quando algum produto não tem caixa master ou CBM, porque a conta sairia menor do que é (`src/lib/request-rounds.ts`).
  - A busca continua procurando pelo nome do produto.
- **Pedidos** (`/app/orders`): a coluna de produto virou **Produtos** (a contagem). Os produtos continuam no painel de itens embaixo da linha escolhida. O filtro de texto da coluna ainda procura pelo nome do produto.
- **Solicitações ao fornecedor**, **Ordens de venda** e **Cotações de compra**: Produtos como contagem. Nas Solicitações ao fornecedor entram também programações e containers por programação (no 40HC, ou no maior tipo). Ordens de venda e cotações não têm dado de programação, então ficam sem essas colunas.

## 2. Abrir é sempre o nível do pedido

- A linha de Encomendas abre `/app/requests/batch/<groupId>`. A solicitação criada sozinha (sem lote) abre o mesmo endereço pelo id dela, como pedido de um produto só. O id de uma solicitação de lote redireciona para o lote.
- Na página do pedido, o produto abre a tela dele naquele pedido: `/app/requests/<id>` na solicitação, com "← Voltar ao pedido" (`data-back-to-order`). No pedido, abre `/app/orders/<id>?item=<item>`, que mostra só aquele item na tabela de itens, com a conversa do item e o link "Ver o pedido inteiro".

## 3. A tabela de produtos dentro do pedido

Cada produto tem foto, peças por caixa, quantidade, caixas e o ícone de mensagem daquele produto naquele pedido:

- na solicitação: alvo `requestId`;
- no pedido: alvo `orderId` + `orderItemId`.

Na tela do pedido, as peças por caixa saem da variação ou da caixa master do cadastro, para todos que veem o pedido. A foto continua com a regra de antes: só para a Wellmix e para a certificadora.

## 4. Abrir é um ícone

`OpenLink` (`src/components/ui.tsx`) é um ícone de abrir sem a palavra. O texto de antes ("Abrir", "Abrir pedido"…) vira o nome acessível e a dica, então quem procura o link pelo nome continua achando. A primeira coluna da linha também leva ao mesmo lugar. Botões de página, links dentro de frases e links de arquivo ficaram como eram.
