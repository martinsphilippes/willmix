# Histórico de compras do cliente (Nova solicitação)

Pedido do dono (14/11/2026, com as fotos da Nova solicitação no iPad, login Comprador / Operador Wellmix): na coluna da esquerda, logo abaixo de "Encontrar o produto por foto ou link", um card com as compras do cliente escolhido no formulário, para quem monta a solicitação ver o que o cliente já comprou (produto, quantidade, caixa, cubagem, preço) sem sair da tela.

## 1. Onde e como funciona

- **Tela:** `/app/requests/new`. Em telas grandes (a partir de 1024 px, o iPad deitado e o computador), o card fica na coluna da **direita**, embaixo da busca por foto ou link (as duas com a largura de sempre), e o formulário fica à esquerda (dono, 15/11/2026; antes a coluna estreita era a da esquerda). No celular e no iPad em pé (uma coluna só), a ordem é a de sempre: busca, formulário e, por último, o histórico.
- **Sem cliente escolhido:** "Selecione um cliente para ver o histórico."
- **Ao escolher o cliente:** carrega as 10 compras mais recentes, do mais recente para o mais antigo, com "Carregar mais" (mais 10 por vez) enquanto houver.
- **Ao trocar o cliente** (ou apagar o nome e digitar outro): a lista anterior some na hora e carrega a do novo cliente; resposta atrasada do cliente anterior é descartada.
- **"Compra para estoque (sem cliente)":** o card some; ao desmarcar, volta.
- **Login do cliente:** vê o histórico dele direto, sem escolher (só os pedidos dele, como na lista de Pedidos).
- **"Adicionar à solicitação"** (`?addTo=`): sem o card (o cliente já é o da solicitação e a busca por foto também não aparece).
- **Ordem:** pelo número do pedido, maior primeiro. Na carga do Sankhya o número segue o NUNOTA, que segue a data do pedido lá (conferido em 14/11/2026: a ordem do número bate com a do NUNOTA e só 2 de 10.398 pares invertem pela data). A data de criação no portal não serve para ordenar: nos pedidos importados ela é o dia da carga.
- **Cancelados** não são compra (a mesma regra do Histórico comercial): ficam fora.

## 2. Linha do pedido (fechada)

| Campo               | De onde vem                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Número              | `orders.number` ("Pedido #n")                                                                                                                                                                                                                                                         |
| Data                | Pedido do portal: `orders.createdAt`. Pedido da carga do Sankhya: o fim (`completedAt`) da etapa "Pedido criado" já concluída, que a carga grava com a data do pedido no Sankhya (DTNEG). Sem essa etapa concluída: "—" (a dica diz "Data original não gravada na carga do Sankhya"). |
| Situação            | `orders.status`, com o nome das etapas usado nas outras telas                                                                                                                                                                                                                         |
| Valor total e moeda | Venda ao cliente: `orders.sellPrice` e `orders.sellCurrency`, só para quem vê valores (seção 5). Sem venda gravada: "—". O custo do fornecedor (`orders.fobTotal`) nunca aparece.                                                                                                     |

Expandida, a linha mostra os produtos do pedido, a programação (se for pedido pai) e o link "Abrir o pedido #n (nova aba)", que abre `/app/orders/<id>` em outra aba para não perder a solicitação em andamento.

## 3. Produto do pedido (expandido)

Cada dado vem primeiro do que ficou **gravado no pedido** (o pedido, os itens, a solicitação, a ficha de compra do pedido ou a cópia da variação no item). Quando o pedido não gravou e a ficha atual do produto tem o dado, ele aparece com o selo **"Ficha atual"** (o dado é de hoje, não necessariamente o da compra). Sem nenhum dos dois: "—". Medida física zerada (peso, medida, cubagem, peças por caixa) conta como não preenchida: a carga do Sankhya grava 0 no campo vazio.

| Campo (na tela)                                        | Gravado no pedido                                                                                                                                                                                                                                                                                                        | Ficha atual (selo)                                             | Quem vê                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------- |
| Nome                                                   | `order_items.name`                                                                                                                                                                                                                                                                                                       | —                                                              | todos                                  |
| Código (SKU)                                           | — (o item não guarda o SKU)                                                                                                                                                                                                                                                                                              | `products.sku`                                                 | Wellmix                                |
| Código no Sankhya                                      | `order_items.sankhyaRefs.CODPROD`                                                                                                                                                                                                                                                                                        | —                                                              | Wellmix                                |
| Código na fábrica                                      | `purchase_sheets.factoryItemCode` → `order_items.variant.factoryItemCode`                                                                                                                                                                                                                                                | `products.supplierSku`                                         | Wellmix                                |
| Quantidade pedida                                      | `order_items.quantity` + `unit`                                                                                                                                                                                                                                                                                          | —                                                              | todos                                  |
| Total em peças                                         | a quantidade, se a unidade é peça (UN, PC, PCS…); se é caixa (CX, CTN…), quantidade × peças por caixa                                                                                                                                                                                                                    | (marcada se as peças por caixa vierem da ficha atual)          | Wellmix                                |
| Peças por caixa master                                 | `purchase_sheets.masterCartonQty` → `variant.masterBoxQty`                                                                                                                                                                                                                                                               | `products.masterBoxQty`                                        | Wellmix                                |
| Total de caixas                                        | a quantidade, se a unidade é caixa; senão peças ÷ peças por caixa, arredondado para cima                                                                                                                                                                                                                                 | (marcada se vier da ficha atual)                               | Wellmix                                |
| Medidas do produto (C × L × A), cm                     | `variant.lengthCm/widthCm/heightCm`                                                                                                                                                                                                                                                                                      | `products.lengthCm/widthCm/heightCm`                           | Wellmix                                |
| Medidas da caixa master (C × L × A), cm                | `purchase_sheets.lengthCm/widthCm/heightCm`                                                                                                                                                                                                                                                                              | `products.boxLengthCm/boxWidthCm/boxHeightCm`                  | Wellmix                                |
| Cubagem por caixa, m³                                  | `purchase_sheets.cbmPerCarton` → calculada das medidas da caixa da ficha de compra → `variant.cbm`                                                                                                                                                                                                                       | `products.cbm` → calculada das medidas da caixa da ficha atual | Wellmix                                |
| Cubagem total, m³                                      | cubagem por caixa × total de caixas                                                                                                                                                                                                                                                                                      | (marcada se uma das duas vier da ficha atual)                  | Wellmix                                |
| Descrição                                              | `requests.description` (pedido do fluxo de sempre, com um produto) → `purchase_sheets.ecommerceDescription`                                                                                                                                                                                                              | `products.notes` (só quando marcada para o e-commerce)         | todos (o cliente, só a da solicitação) |
| Especificação                                          | `requests.specification` (mesma condição)                                                                                                                                                                                                                                                                                | `products.specification`                                       | todos (o cliente, só a da solicitação) |
| Material                                               | `purchase_sheets.material` → `variant.material`                                                                                                                                                                                                                                                                          | `products.material`                                            | Wellmix                                |
| Embalagem                                              | `purchase_sheets.packageType` → `variant.packageType`                                                                                                                                                                                                                                                                    | —                                                              | Wellmix                                |
| Capacidade, ml                                         | `purchase_sheets.capacityMl`                                                                                                                                                                                                                                                                                             | —                                                              | Wellmix                                |
| Cores                                                  | `purchase_sheets.colorAssortment` → `variant.colorAssortment`                                                                                                                                                                                                                                                            | `products.color`                                               | Wellmix                                |
| Peças por caixa interna                                | `purchase_sheets.innerQty` → `variant.innerBoxQty`                                                                                                                                                                                                                                                                       | `products.innerBoxQty`                                         | Wellmix                                |
| Peso líquido e bruto por peça, kg                      | `purchase_sheets.netWeightPcKg/grossWeightPcKg` → `variant.netWeightKg/grossWeightKg`                                                                                                                                                                                                                                    | `products.netWeightKg/grossWeightKg`                           | Wellmix                                |
| NCM                                                    | `purchase_sheets.ncm`                                                                                                                                                                                                                                                                                                    | `products.ncm`                                                 | Wellmix                                |
| EAN                                                    | —                                                                                                                                                                                                                                                                                                                        | `products.ean`                                                 | Wellmix                                |
| Valor unitário (venda) e Subtotal (venda), com a moeda | O preço de venda gravado no produto (`order_items.sellUnitPrice`, na moeda do pedido; docs/ORDER_SALE.md) e subtotal = preço × quantidade. Sem ele (pedidos antigos, com a venda só no pedido inteiro): pedido de um produto, unitário = total ÷ quantidade e subtotal = total; pedido de vários produtos, "—" por item. | —                                                              | quem vê valores (seção 5)              |

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
- **Valor de venda:** na Wellmix, só com a ação "Ver valores e margem" (`canSeeMoney`, a mesma regra das listas, exportações e do Histórico comercial; o administrador sempre); sem ela, o card mostra as compras e os produtos com "—" nos valores. O login do cliente vê a venda dos pedidos dele (`canSeeSellPrice`). **Custo** (FOB do pedido, preço unitário do fornecedor `order_items.unitPrice`): nunca sai do servidor.
- **Folha do fornecedor** (códigos, caixa, medidas, cubagem, dados técnicos, ficha atual): só para a Wellmix, como na lista de Pedidos. Para o cliente, nem a ficha de compra nem a ficha do produto são lidas.
- Tudo é leitura: nenhuma Server Action nova, nada gravado, sem mudança no banco.

## 6. Desempenho

Um cliente tem ~15,7 mil pedidos em produção. A consulta não lê todos: lê uma janela do topo (o que a tela já mostra, a página de 10 e mais um, para saber se há "Carregar mais"), em ordem do número, com o filtro do cliente e "sem pai"; a janela só cresce se faltar linha (cancelados). Depois, só os pedidos da página: os filhos deles, os itens (do registro do ERP, só o `CODPROD`), a etapa "Pedido criado" dos importados, as solicitações do fluxo de sempre e, para a Wellmix, as fichas de compra e os produtos.

## 7. O que ainda não existe no histórico (produção, 14/11/2026)

Consulta só de leitura no Supabase: 16.270 pedidos (16.268 da carga do Sankhya), 6 clientes com pedido, 185.459 itens, 16.843 produtos.

| Dado                               | Situação                                                                                                                             | Na tela                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Data original do pedido no Sankhya | 11.209 importados têm (etapa "Pedido criado" concluída); 5.059 não têm, e o pedido não guarda a DTNEG em coluna própria              | "—" com a dica                                                                             |
| Valor de venda ao cliente          | nenhum pedido tem venda gravada                                                                                                      | total, unitário e subtotal "—"                                                             |
| Venda por produto                  | gravada no card "Venda ao cliente" do pedido desde 14/11/2026 (docs/ORDER_SALE.md); os pedidos antigos não têm                       | "—" por item nos antigos de vários produtos                                                |
| Ficha de compra do pedido          | 2 no banco todo                                                                                                                      | caixa, medidas da caixa, cubagem e dados técnicos "gravados no pedido" quase nunca existem |
| Cópia da variação no item          | 0 itens                                                                                                                              | medidas do produto só pela ficha atual                                                     |
| Peças por caixa                    | ficha atual: 15.009 produtos                                                                                                         | aparece com o selo "Ficha atual"                                                           |
| Medidas da caixa master e cubagem  | ficha atual: só 2 produtos                                                                                                           | cubagem por caixa e total "—" em quase todos                                               |
| Medidas do produto                 | ficha atual: 14.915 completas (247 com uma medida 0)                                                                                 | com o selo; a medida 0 vira "—"                                                            |
| Peso por peça                      | ficha atual: 15.087 com peso (1.756 com 0)                                                                                           | com o selo; o 0 não aparece                                                                |
| Descrição do produto               | pedidos importados não têm (a solicitação de apoio não descreve o produto); nenhum produto tem a descrição marcada para o e-commerce | "—"                                                                                        |
| Especificação                      | ficha atual: 8.761 produtos                                                                                                          | com o selo                                                                                 |
| Material, cores, código na fábrica | ficha atual: 2 produtos cada                                                                                                         | quase sempre ausentes (a linha não aparece)                                                |
| SKU, NCM, EAN                      | ficha atual: 16.465, 16.534 e 14.717 produtos                                                                                        | com o selo                                                                                 |
| Programação                        | 1 pedido pai com rodadas, nenhum filho ainda                                                                                         | as rodadas aparecem como previstas                                                         |
| Custo do fornecedor (FOB, VLRUNIT) | existe nos importados                                                                                                                | não aparece (custo interno, fora do pedido)                                                |

Para o histórico ficar completo: gravar a venda ao cliente nos pedidos (card "Venda ao cliente", por produto), trazer a DTNEG de todos os pedidos do Sankhya e preencher a caixa master e a cubagem nos produtos (ou a ficha de compra nos pedidos novos).

## 8. Código e testes

- Leitura e regras: `src/lib/services/purchase-history.ts` (`loadPurchaseHistory`, `itemSheet`, `purchaseHistoryView`).
- Rota de leitura: `src/app/api/purchase-history/route.ts` (GET, `?customer=&before=&shown=`, sem cache).
- Tela: `src/components/customer-purchase-history.tsx` (o card), `src/components/request-customer-context.tsx` (a grade da tela, com o cliente escolhido no formulário para o card), `request-customer-field.tsx` e `search-picker.tsx` (`onDeselect`: apagar o nome escolhido limpa o cliente), `src/app/app/requests/new/page.tsx` (a grade com a coluna da esquerda).
- Textos: `src/i18n/modules/purchase-history.ts` (pt/en/zh).
- Testes: `tests/unit/purchase-history.test.ts` (cliente sem histórico, vários pedidos com "Carregar mais" e a janela lida, venda por pedido e por item, ficha de compra × ficha atual, medida zero, pedido antigo incompleto em caixas, data do Sankhya com e sem a etapa, programação com filho e rodada prevista também no login do cliente, permissões, inclusive o operador sem "Ver valores e margem"); E2E: `tests/e2e/search-pickers.spec.ts` (sem cliente, estoque, escolher, apagar e escolher de novo) e o caminho principal (o pedido de compra novo no topo do histórico da Wellmix SC, o detalhe e o link do pedido).

## 9. Pela API do Sankhya (dono, 15/11/2026)

Para a Wellmix, o card lê o histórico **direto do Sankhya**, na hora, pelo DbExplorer (`DbExplorerSP.executeQuery`), com as views do documento "API consultas pedidos Wellmix" (Amplio, 14/11/2026):

- **Cliente:** o código do Sankhya gravado no cadastro do cliente (`parties.sankhyaCode`), que é o parceiro comprador do pedido (`COD_CLIENTE` = `TGFCAB.CODPARC`). O navegador manda só o cliente do portal; o código sai do cadastro no servidor e só inteiros entram no SQL.
- **Lista:** `sankhya.VW_AD_PEDCLIENTE_ITEM_WELL`, um registro por pedido (`GROUP BY NUNOTA, DATA_PEDIDO`, `ORDER BY DATA_PEDIDO DESC, NUNOTA DESC`), pendentes e sem pendência, de todas as empresas e TOPs do cliente. 10 por vez; "Carregar mais" lê o topo de novo com mais linhas (até 500 pedidos), sem cursor de data. Cada linha: NUNOTA, NUMNOTA, data, pendência (PEDIDO_PENDENTE), TOP com a descrição, empresa, valor total (VALOR_TOTAL_PEDIDO_BRL, contado uma vez por pedido) e o número de itens.
- **Itens** (ao tocar no pedido): a mesma view com `COD_CLIENTE` e `NUNOTA` no filtro, 100 por vez (`SEQUENCIA >` a última) até vir menos de 100. Produto (CODPROD, descrição, referência, referência do fornecedor, NCM), unidade, quantidade pedida e entregue, preço unitário antes do desconto (PRECO_UNITARIO_BRL), desconto, preço unitário e total após desconto e o container do item.
- **Permissões:** só a Wellmix com a tela Solicitações; os valores só com "Ver valores e margem" (`canSeeMoney`). O login do cliente continua com o histórico gravado no portal (só os pedidos que ele pediu; o Sankhya não sabe quem pediu).
- **Sem o Sankhya configurado** ou **cliente sem código do Sankhya**: o card avisa e mostra o histórico gravado no portal (seções 1 a 8). Erro do Sankhya: a mensagem dele, com "Tentar de novo".
- **Requisito no ERP:** o usuário do token do gateway precisa de acesso ao DbExplorer e às views (o documento diz que a chamada com o token do portal não foi testada pela Amplio). A view de compras por fornecedor (`VW_AD_PEDCOMPRA_ITEM_WELL`) ainda não é usada nesta tela.
- Código: `src/lib/services/sankhya-customer-history.ts` (SQL e leitura), `src/app/api/purchase-history/sankhya/route.ts` (GET `?customer=&shown=` ou `&nunota=`), `src/components/sankhya-purchase-history.tsx` (o card). Testes: `tests/unit/sankhya-customer-history.test.ts`.

## 10. Produto do catálogo só para leitura (dono, 15/11/2026)

Na Nova solicitação, ao escolher um produto do catálogo, nada da ficha se altera: descrição e especificação aparecem à direita da busca, só para ler, e o nome não se repete (fica no campo da busca). O servidor grava os textos da ficha (`productTexts` e `variantSpecificationText` em `src/lib/services/request-product-fill.ts`), ignorando o que vier diferente no formulário. Produto com nome de exemplo ("Produto novo XPTO") e produto fora do catálogo: os campos continuam editáveis.

## 11. Seletor Pedido | Produto (dono, 15/11/2026)

No card do histórico pelo Sankhya (seção 9), um seletor **"Pedido | Produto"** no topo, logo abaixo de "Do Sankhya, consultado agora". **Pedido** vem marcado. O seletor troca o conteúdo logo abaixo, no mesmo card, uma visão por vez.

- **Pedido:** a lista de sempre (número, data, situação, itens, valor, TOP e empresa), com o toque no pedido para ver os produtos e os preços.
- **Produto:** abre direto pelo seletor, sem abrir pedido.
  - Mostra os produtos dos pedidos da lista (os mesmos que a visão Pedido já leu), agrupados pelo **código do produto no Sankhya** (CODPROD).
  - Em cada produto: o nome à esquerda e o **total pedido no período** à direita, na mesma linha, e o código embaixo.
  - Abaixo, a **quantidade pedida em cada data**, da mais recente para a mais antiga. Dois pedidos do mesmo produto no mesmo dia somam numa linha.
  - O total é a soma das datas. O nome é o do pedido mais recente.
  - Ordem: do produto comprado mais recentemente para o mais antigo; no mesmo dia, pelo nome.
- **Período consultado:** os pedidos que a lista já leu (10 de início), com as datas do mais antigo ao mais recente e o número de pedidos ("Período consultado: 01/08/2026 a 15/09/2026 (3 pedido(s))"). "Carregar mais pedidos" lê mais 10 na lista e soma de novo; o período e os totais crescem juntos.
- **Quantidades e unidades do Sankhya:** a quantidade pedida (QTD_NEGOCIADA) na unidade negociada (UNIDADE_NEGOCIADA). Unidades diferentes do mesmo produto não se somam: "Total 2 CX · 10 UN".
- **Ordenar e valor total (dono, 15/11/2026):**
  - **Seletor "Ordenar":** fica no canto superior direito, ao lado do "Período consultado" e acima da lista. Na coluna estreita, o período quebra na própria coluna e o seletor continua ao lado, com o rótulo pequeno em cima.
  - **Quatro ordens:** "Mais un.", "Menos un.", "Maior valor" e "Menor valor"; "Mais un." vem marcada.
    - Por unidades: a quantidade total pedida do produto no período. Com unidades diferentes, as quantidades somam só para ordenar.
    - Por valor: o valor total do produto no período. Produto sem valor fica no fim das duas ordens por valor.
    - Empates: mais unidades, depois o nome.
    - A ordem fica ao voltar de Pedido e ao trocar de cliente.
    - As datas de cada produto continuam da mais recente para a mais antiga.
  - **Totais à direita do nome, um embaixo do outro:** as unidades ("2.592 UN") e o valor ("R$ 12.450,00"), em qualquer ordem.
  - **Valor:** a soma dos valores líquidos dos itens do produto, após descontos (VALOR_ITEM_APOS_DESCONTO_BRL, a mesma coluna do "Total do item após desconto" na visão Pedido).
    - Se algum item vier sem valor, o produto mostra "—" (o total ficaria incompleto). Valor zero é valor (R$ 0,00).
    - Só com "Ver valores e margem", a regra da lista. Sem ela, o valor fica "—" e o seletor mostra só "Mais un." e "Menos un." (nenhuma ordem por valor, que deixaria inferir valores).
  - Código: `src/lib/sankhya-product-sort.ts` (`sortProducts`) e o `value` de `productHistory`.
- **Muitos produtos:** 50 por vez, com "Mostrar mais produtos". Se o teto de leituras cortar itens (mais de 20 mil itens no período), o card avisa que os totais podem estar menores.
- **Troca de cliente:** a visão escolhida fica e o conteúdo passa a ser o do cliente novo. A leitura fica guardada ao voltar de Pedido para Produto.
- **Leitura:** `GET /api/purchase-history/sankhya?customer=&view=products&shown=N`.
  - O servidor lê de novo os N pedidos mais recentes do cliente, na mesma ordem da lista.
  - Depois lê os itens desses pedidos, com o cliente e os pedidos no filtro (`COD_CLIENTE = … AND NUNOTA IN (…)`), 500 por vez, pela posição (NUNOTA, SEQUENCIA), só com inteiros no SQL.
  - A soma é no servidor (`productHistory`).
- **Permissões:** as da lista (só a Wellmix com a tela Solicitações; cliente com código do Sankhya). A visão Produto não mostra valores, então quem não tem "Ver valores e margem" também a vê. Sem o Sankhya ou sem o código do cliente, o card continua com o histórico gravado no portal, sem o seletor.
- Código: `customerItemsSql`, `productHistory` e `sankhyaCustomerProducts` em `src/lib/services/sankhya-customer-history.ts`; `ProductsPanel` em `src/components/sankhya-purchase-history.tsx`; textos em `src/i18n/modules/purchase-history.ts`.
- Testes: `tests/unit/sankhya-history-products.test.ts` e o E2E `tests/e2e/purchase-history-products.spec.ts`.
  - Unitário: SQL, um produto em vários pedidos com dois no mesmo dia, unidades diferentes, leitura em páginas, cliente sem pedidos e permissões.
  - E2E, com o Sankhya simulado na rota do portal: Pedido por padrão, Produto sem abrir pedido, totais e datas, volta para Pedido com a expansão, "Carregar mais pedidos" e troca de cliente.

## Preço da última compra ao fornecedor (15/11/2026)

Pedido do dono: ao escolher o produto na Nova solicitação, o quadro verde "Produto do catálogo Wellmix" mostra, só para a Wellmix, "Última compra: US$ 0,1205 por UN · 120.148 UN · pedido 11556 (Sankhya 1185804) · fornecedor" (`src/lib/services/last-purchase.ts`, campo `lastPurchase` da ficha em `request-product-fill.ts`).

- Origem: o item do pedido de compra mais recente do produto (maior número de pedido, sem os cancelados), com o preço unitário na moeda do pedido (`order_items.unitPrice` e `orders.fobCurrency`; na carga do Sankhya, VLRUNIT ÷ câmbio da nota). As notas de um mesmo pedido em várias TOPs (1101 → 1104) têm o mesmo preço.
- Sem pedido: "Preço da última compra (cadastro)", com `products.price` e `products.currency`. A carga do Sankhya só preenche esse preço quando ele está vazio, então ele pode ser de uma compra antiga.
- O cliente não vê (preço de fornecedor).
- Na Wellmix, o preço segue "Ver preço de compra" (dono, 15/11/2026, opção C; docs/LINHA_DE_VISAO.md, seção 8). Quem não tem a permissão (Vendas, por padrão) vê a mesma linha sem o preço: "Última compra: 120.148 UN · pedido 11556 (Sankhya 1185804) · fornecedor". Sem pedido, o preço do cadastro não aparece para ele (a linha seria só o preço). O texto sem o preço sai do servidor (`lastPurchaseTexts(..., { withPrice })`): o preço nem chega ao navegador.

Consulta para conferir no banco (Supabase), trocando o código:

```sql
select o.number, o."sankhyaCode" as nunota, o."sankhyaRefs"->>'CODTIPOPER' as top,
       oi."unitPrice", o."fobCurrency", o."fxRate", oi.quantity, oi.unit, s.name as fornecedor
from order_items oi
join orders o on o.id = oi."orderId"
join products p on p.id = oi."productId"
left join parties s on s.id = o."supplierId"
where p.sku = 'WBU2191' and o."cancelledAt" is null
order by o.number desc
limit 10;
```
