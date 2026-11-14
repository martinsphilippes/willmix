# Histórico de compras do cliente (Nova solicitação)

Pedido do dono (14/11/2026, com as fotos da Nova solicitação no iPad, login Comprador / Operador Wellmix): na coluna da esquerda, logo abaixo de "Encontrar o produto por foto ou link", um card com as compras do cliente escolhido no formulário, para quem monta a solicitação ver o que o cliente já comprou (produto, quantidade, caixa, cubagem, preço) sem sair da tela.

## 1. Onde e como funciona

- **Tela:** `/app/requests/new`. Em telas grandes (a partir de 1024 px, o iPad deitado e o computador), o card fica na coluna da esquerda, embaixo da busca por foto ou link, e o formulário continua à direita com a largura de sempre. No celular e no iPad em pé (uma coluna só), a ordem é a de sempre: busca, formulário e, por último, o histórico.
- **Sem cliente escolhido:** "Selecione um cliente para ver o histórico."
- **Ao escolher o cliente:** carrega as 10 compras mais recentes, do mais recente para o mais antigo, com "Carregar mais" (mais 10 por vez) enquanto houver.
- **Ao trocar o cliente** (ou apagar o nome e digitar outro): a lista anterior some na hora e carrega a do novo cliente; resposta atrasada do cliente anterior é descartada.
- **"Compra para estoque (sem cliente)":** o card some; ao desmarcar, volta.
- **Login do cliente:** vê o histórico dele direto, sem escolher (só os pedidos dele, como na lista de Pedidos).
- **"Adicionar à solicitação"** (`?addTo=`): sem o card (o cliente já é o da solicitação e a busca por foto também não aparece).
- **Ordem:** pelo número do pedido, maior primeiro. Na carga do Sankhya o número segue o NUNOTA, que segue a data do pedido lá (conferido em 14/11/2026: a ordem do número bate com a do NUNOTA e só 2 de 10.398 pares invertem pela data). A data de criação no portal não serve para ordenar: nos pedidos importados ela é o dia da carga.
- **Cancelados** não são compra (a mesma regra do Histórico comercial): ficam fora.

## 2. Linha do pedido (fechada)

| Campo | De onde vem |
| --- | --- |
| Número | `orders.number` ("Pedido #n") |
| Data | Pedido do portal: `orders.createdAt`. Pedido da carga do Sankhya: o fim (`completedAt`) da etapa "Pedido criado" já concluída, que a carga grava com a data do pedido no Sankhya (DTNEG). Sem essa etapa concluída: "—" (a dica diz "Data original não gravada na carga do Sankhya"). |
| Situação | `orders.status`, com o nome das etapas usado nas outras telas |
| Valor total e moeda | Venda ao cliente: `orders.sellPrice` e `orders.sellCurrency`, só para quem vê venda (`canSeeSellPrice`). Sem venda gravada: "—". O custo do fornecedor (`orders.fobTotal`) nunca aparece. |

Expandida, a linha mostra os produtos do pedido, a programação (se for pedido pai) e o link "Abrir o pedido #n (nova aba)", que abre `/app/orders/<id>` em outra aba para não perder a solicitação em andamento.

## 3. Produto do pedido (expandido)

Cada dado vem primeiro do que ficou **gravado no pedido** (o pedido, os itens, a solicitação, a ficha de compra do pedido ou a cópia da variação no item). Quando o pedido não gravou e a ficha atual do produto tem o dado, ele aparece com o selo **"Ficha atual"** (o dado é de hoje, não necessariamente o da compra). Sem nenhum dos dois: "—". Medida física zerada (peso, medida, cubagem, peças por caixa) conta como não preenchida: a carga do Sankhya grava 0 no campo vazio.

| Campo (na tela) | Gravado no pedido | Ficha atual (selo) | Quem vê |
| --- | --- | --- | --- |
| Nome | `order_items.name` | — | todos |
| Código (SKU) | — (o item não guarda o SKU) | `products.sku` | Wellmix |
| Código no Sankhya | `order_items.sankhyaRefs.CODPROD` | — | Wellmix |
| Código na fábrica | `purchase_sheets.factoryItemCode` → `order_items.variant.factoryItemCode` | `products.supplierSku` | Wellmix |
| Quantidade pedida | `order_items.quantity` + `unit` | — | todos |
| Total em peças | a quantidade, se a unidade é peça (UN, PC, PCS…); se é caixa (CX, CTN…), quantidade × peças por caixa | (marcada se as peças por caixa vierem da ficha atual) | Wellmix |
| Peças por caixa master | `purchase_sheets.masterCartonQty` → `variant.masterBoxQty` | `products.masterBoxQty` | Wellmix |
| Total de caixas | a quantidade, se a unidade é caixa; senão peças ÷ peças por caixa, arredondado para cima | (marcada se vier da ficha atual) | Wellmix |
| Medidas do produto (C × L × A), cm | `variant.lengthCm/widthCm/heightCm` | `products.lengthCm/widthCm/heightCm` | Wellmix |
| Medidas da caixa master (C × L × A), cm | `purchase_sheets.lengthCm/widthCm/heightCm` | `products.boxLengthCm/boxWidthCm/boxHeightCm` | Wellmix |
| Cubagem por caixa, m³ | `purchase_sheets.cbmPerCarton` → calculada das medidas da caixa da ficha de compra → `variant.cbm` | `products.cbm` → calculada das medidas da caixa da ficha atual | Wellmix |
| Cubagem total, m³ | cubagem por caixa × total de caixas | (marcada se uma das duas vier da ficha atual) | Wellmix |
| Descrição | `requests.description` (pedido do fluxo de sempre, com um produto) → `purchase_sheets.ecommerceDescription` | `products.notes` (só quando marcada para o e-commerce) | todos (o cliente, só a da solicitação) |
| Especificação | `requests.specification` (mesma condição) | `products.specification` | todos (o cliente, só a da solicitação) |
| Material | `purchase_sheets.material` → `variant.material` | `products.material` | Wellmix |
| Embalagem | `purchase_sheets.packageType` → `variant.packageType` | — | Wellmix |
| Capacidade, ml | `purchase_sheets.capacityMl` | — | Wellmix |
| Cores | `purchase_sheets.colorAssortment` → `variant.colorAssortment` | `products.color` | Wellmix |
| Peças por caixa interna | `purchase_sheets.innerQty` → `variant.innerBoxQty` | `products.innerBoxQty` | Wellmix |
| Peso líquido e bruto por peça, kg | `purchase_sheets.netWeightPcKg/grossWeightPcKg` → `variant.netWeightKg/grossWeightKg` | `products.netWeightKg/grossWeightKg` | Wellmix |
| NCM | `purchase_sheets.ncm` | `products.ncm` | Wellmix |
| EAN | — | `products.ean` | Wellmix |
| Valor unitário (venda) e Subtotal (venda), com a moeda | A venda é gravada no pedido inteiro (`orders.sellPrice`). Pedido de um produto: subtotal = total do pedido e unitário = total ÷ quantidade. Pedido de vários produtos: "—" por item (o total fica na linha do pedido). | — | quem vê venda |

- **Solicitação de apoio** (pedido da carga do Sankhya, pedido de compra pela solicitação ao fornecedor e rodada da programação): o texto da solicitação ("Importado do Sankhya…", "Rodada 1 de 2…") não é descrição de produto e não aparece.
- **Rodada sem ficha de compra própria** usa a do pedido pai.
- **Código no Sankhya, Código na fábrica e os dados técnicos** (material, embalagem, capacidade, cores, caixa interna, pesos, NCM, EAN) só aparecem quando existem; as outras linhas (SKU, quantidade, peças, caixa, medidas, cubagem, descrição, especificação, valores) aparecem sempre, com "—" quando faltam.

## 4. Programação de compra (pedido pai e filhos)

- A compra é o pedido **sem pai** (`parentOrderId` vazio). Os pedidos filhos (as rodadas, docs/PURCHASE_SCHEDULE.md) nunca aparecem como compra à parte, para a mesma compra não contar duas vezes.
- No detalhe do pai, "Pedidos da programação": cada rodada de `orders.purchaseRounds` com o número, a data, a situação e as peças do filho (com link para abrir em outra aba) e os produtos dele; a rodada que ainda não virou pedido aparece como "prevista para <data>, ainda sem pedido".
- **Login do cliente:** o filho não leva quem pediu (`requestedByUserId`), então o cliente não o abre (`canViewOrder`, a regra de sempre). A rodada já criada aparece como "prevista para <data>, pedido criado", sem o número nem o link.

## 5. Permissões (no servidor)

- **Quem lê:** só quem abre Solicitações (`canOpen(user, "requests")`) e é da Wellmix ou cliente. Parceiros (fornecedor, agência, despachante…) recebem "não encontrado".
- **Wellmix:** qualquer cliente (o `customer` da consulta). **Cliente:** só a empresa dele (o `customer` da consulta é ignorado) e só os pedidos que ele pediu (o mesmo `canViewOrder` da lista de Pedidos), já no filtro da consulta.
- **Valor de venda:** só para quem vê venda (`canSeeSellPrice`). **Custo** (FOB do pedido, preço unitário do fornecedor `order_items.unitPrice`): nunca sai do servidor.
- **Folha do fornecedor** (códigos, caixa, medidas, cubagem, dados técnicos, ficha atual): só para a Wellmix, como na lista de Pedidos. Para o cliente, nem a ficha de compra nem a ficha do produto são lidas.
- Tudo é leitura: nenhuma Server Action nova, nada gravado, sem mudança no banco.

## 6. Desempenho

Um cliente tem ~15,7 mil pedidos em produção. A consulta não lê todos: lê uma janela do topo (o que a tela já mostra, a página de 10 e mais um, para saber se há "Carregar mais"), em ordem do número, com o filtro do cliente e "sem pai"; a janela só cresce se faltar linha (cancelados). Depois, só os pedidos da página: os filhos deles, os itens (do registro do ERP, só o `CODPROD`), a etapa "Pedido criado" dos importados, as solicitações do fluxo de sempre e, para a Wellmix, as fichas de compra e os produtos.

## 7. O que ainda não existe no histórico (produção, 14/11/2026)

Consulta só de leitura no Supabase: 16.270 pedidos (16.268 da carga do Sankhya), 6 clientes com pedido, 185.459 itens, 16.843 produtos.

| Dado | Situação | Na tela |
| --- | --- | --- |
| Data original do pedido no Sankhya | 11.209 importados têm (etapa "Pedido criado" concluída); 5.059 não têm, e o pedido não guarda a DTNEG em coluna própria | "—" com a dica |
| Valor de venda ao cliente | nenhum pedido tem venda gravada | total, unitário e subtotal "—" |
| Venda por produto | o portal grava a venda só no pedido inteiro | "—" por item em pedido de vários produtos |
| Ficha de compra do pedido | 2 no banco todo | caixa, medidas da caixa, cubagem e dados técnicos "gravados no pedido" quase nunca existem |
| Cópia da variação no item | 0 itens | medidas do produto só pela ficha atual |
| Peças por caixa | ficha atual: 15.009 produtos | aparece com o selo "Ficha atual" |
| Medidas da caixa master e cubagem | ficha atual: só 2 produtos | cubagem por caixa e total "—" em quase todos |
| Medidas do produto | ficha atual: 14.915 completas (247 com uma medida 0) | com o selo; a medida 0 vira "—" |
| Peso por peça | ficha atual: 15.087 com peso (1.756 com 0) | com o selo; o 0 não aparece |
| Descrição do produto | pedidos importados não têm (a solicitação de apoio não descreve o produto); nenhum produto tem a descrição marcada para o e-commerce | "—" |
| Especificação | ficha atual: 8.761 produtos | com o selo |
| Material, cores, código na fábrica | ficha atual: 2 produtos cada | quase sempre ausentes (a linha não aparece) |
| SKU, NCM, EAN | ficha atual: 16.465, 16.534 e 14.717 produtos | com o selo |
| Programação | 1 pedido pai com rodadas, nenhum filho ainda | as rodadas aparecem como previstas |
| Custo do fornecedor (FOB, VLRUNIT) | existe nos importados | não aparece (custo interno, fora do pedido) |

Para o histórico ficar completo: gravar a venda ao cliente (por item, se o comercial quiser unitário por produto), trazer a DTNEG de todos os pedidos do Sankhya e preencher a caixa master e a cubagem nos produtos (ou a ficha de compra nos pedidos novos).

## 8. Código e testes

- Leitura e regras: `src/lib/services/purchase-history.ts` (`loadPurchaseHistory`, `itemSheet`, `purchaseHistoryView`).
- Rota de leitura: `src/app/api/purchase-history/route.ts` (GET, `?customer=&before=&shown=`, sem cache).
- Tela: `src/components/customer-purchase-history.tsx` (o card), `src/components/request-customer-context.tsx` (o cliente escolhido no formulário, para o card), `request-customer-field.tsx` e `search-picker.tsx` (`onDeselect`: apagar o nome escolhido limpa o cliente), `src/app/app/requests/new/page.tsx` (a grade com a coluna da esquerda).
- Textos: `src/i18n/modules/purchase-history.ts` (pt/en/zh).
- Testes: `tests/unit/purchase-history.test.ts` (cliente sem histórico, vários pedidos com "Carregar mais" e a janela lida, venda por pedido e por item, ficha de compra × ficha atual, medida zero, pedido antigo incompleto em caixas, data do Sankhya com e sem a etapa, programação com filho e rodada prevista também no login do cliente, permissões); E2E: `tests/e2e/search-pickers.spec.ts` (sem cliente, estoque, escolher, apagar e escolher de novo) e o caminho principal (o pedido de compra novo no topo do histórico da Wellmix SC, o detalhe e o link do pedido).
