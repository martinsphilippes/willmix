# Tabelas padrão: pedidos e itens do pedido

Pedido do dono (22/11/2026). Toda tela que lista pedidos (encomenda, pedido, cotação ou solicitação ao fornecedor) usa as mesmas colunas, na mesma ordem; e toda tela que lista os itens de um pedido usa outro conjunto fixo. O que colaborador externo não vê hoje continua sem ver.

A ordem das colunas e a leitura das condições do pedido ficam em `src/lib/order-table.ts` (`ORDER_COLUMNS`, `ORDER_ITEM_COLUMNS`, `orderTermsCells`); os textos, em `src/i18n/modules/order-table.ts`.

## 1. Tabela de pedidos

| #   | Coluna          | O que mostra                                                | De onde vem hoje                                      | Quem vê                |
| --- | --------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ---------------------- |
| 1   | Nº do pedido    | O número do pedido (um só; o nº AFV saiu até segunda ordem) | `requests.number`                                     | Todos                  |
| 2   | Data negociação | Dia em que o pedido foi lançado                             | `requests.createdAt`                                  | Todos                  |
| 3   | Tipo de venda   | Trading Sales (encomenda) ou Wellmix STK (estoque)          | `orderTerms.operationType`; estoque e reposição = STK | Todos                  |
| 4   | Prazo pgto.     | Número de parcelas                                          | `orderTerms.paymentPlan.installments`                 | Todos                  |
| 5   | Forma pgto.     | Forma de pagamento escolhida no pedido                      | `orderTerms.paymentPlan.name`                         | Todos                  |
| 6   | Faturamento     | WX (Wellmix) ou WD (distribuidora)                          | `orderTerms.saleFormat`                               | Todos                  |
| 7   | VIP             | Nível do cliente no pedido                                  | `orderTerms.wellmixTier`                              | Wellmix                |
| 8   | Grupo econômico | Grupo do cliente no Sankhya                                 | `parties.economicGroupName`                           | Wellmix                |
| 9   | Cliente nº      | Código do cliente no Sankhya                                | `parties.sankhyaCode`                                 | Wellmix                |
| 10  | Cliente nome    |                                                             | `parties.name`                                        | Wellmix                |
| 11  | Status          | O que o pedido está esperando (de quem é a vez)             | `requestNextStep().who` (docs/TURNS.md)               | Todos                  |
| 12  | Situação        | O momento do passo em que ele está, com quem pode agir      | `requestNextStep()`                                   | Wellmix                |
| 13  | Prazo resposta  | Prazo (SLA) da ação esperada; vermelho quando atrasado      | `stepDue`                                             | Todos                  |
| 14  | Itens           | Quantos produtos diferentes                                 | `requestComposition`                                  | Todos                  |
| 15  | Entregas        | Quantas entregas foram programadas no pedido                | `schedule.items`                                      | Todos                  |
| 16  | Total CBM (m³)  | Cubagem total                                               | `encomendaTotals().cbm`                               | Todos                  |
| 17  | Valor total     | Valor previsto do pedido, com frete                         | `priceForecast.total`                                 | "Ver valores e margem" |
| 18  | Fornecedor      | A partir de quando o pedido o define                        | `orders.supplierId` do pedido da solicitação          | Wellmix                |

Dado que o portal não tem aparece como "—"; nada é inventado.

Saíram da lista (seguem na página do pedido e no CSV): Peças, Master, Inner, Cont./prog., Analista e Data (que virou "Data negociação").

### Onde já está aplicada

- **Encomendas** (`/app/requests`), para a Wellmix e para o cliente.
- **Pedidos** (`/app/orders`). As condições (tipo de venda, pagamento, faturamento, VIP, grupo, cliente nº, entregas, m³ e valor) vêm da solicitação ligada a cada pedido (`orders.requestId`), lidas só para as linhas da página (`src/lib/services/order-cells.ts`). Pedido que veio só do Sankhya, sem solicitação no portal, mostra "—" nessas colunas. Nesta tela:
  - Status = de quem é a vez (encerrado ou cancelado, isso mesmo); Situação = o marco atual (com "Travado" quando está); Prazo resposta = o prazo do marco.
  - Quem vê o quê: fornecedor e demais parceiros só veem Nº, Data, Status, Situação, Prazo e Itens (o que já viam); o cliente vê também as condições, as entregas e o m³ do pedido dele; VIP, grupo, cliente e fornecedor só a Wellmix; o valor, só com "Ver valores e margem".
  - Saíram da tabela: Progresso (a barra), a situação da linha (Em andamento, Travado…) e Atualizado. Os três filtros seguem valendo, acima da tabela.

- **Cotação** (`/app/supplier-requests`), **Reposição** (`/app/replenishment`) e **Ordens de venda** (`/app/sales-orders`), só para a Wellmix (dono, 23/11/2026): as colunas padrão primeiro, na ordem, e as colunas próprias de cada tela no fim. Cabeçalhos e células comuns em `src/components/order-standard-cells.tsx`.
  - **Cotação**: no fim, Origem, Resposta, Finalizada e, em Encerradas, o pedido ("Gerar pedido"). Saíram Quantidade, Containers por programação e "Criada em" (virou Data negociação). Status = de quem é a vez; Situação = o momento da cotação ou de cada produto; Prazo resposta = o prazo do convite ou o SLA. O fornecedor segue com a lista dele, sem as colunas de cliente e de venda.
  - **Um cliente por cotação**: cada cotação nasce de uma solicitação só, inteira (regra de 18/11/2026, `assertWholeRequest`), então o cliente e as condições vêm dessa solicitação. A cotação de book não tem cliente ("—"). Conferido em produção em 23/11/2026: nenhuma cotação com mais de uma solicitação.
  - **Reposição**: no fim, Fonte e Data desejada. Saíram Produto e Quantidade (o produto fica na dica da coluna Itens e na página da solicitação). Tipo de venda = Wellmix STK.
  - **Ordens de venda**: no fim, Sankhya e Entrega. A ordem sai do estoque e não tem solicitação ligada: Tipo de venda = Venda, Forma de pagamento = a condição da ordem, Valor = soma das linhas; Prazo, Faturamento, VIP, Entregas, m³ e Fornecedor ficam "—".

### Onde falta aplicar

As listas dos passos do fluxo (telas dos blocos do menu).

## 2. Tabela de itens do pedido

| #   | Coluna              | O que mostra                                         | De onde vem hoje                                                  |
| --- | ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Seq.                | A ordem do produto no pedido                         | Ordem em que foram pedidos                                        |
| 2   | Foto                |                                                      | Fotos do cadastro do produto                                      |
| 3   | Situação            | O momento do passo em que o produto está             | `requestDisplayStatus`                                            |
| 4   | Status              | O que ele espera (de quem é a vez)                   | `requestNextStep().who`                                           |
| 5   | Prazo resposta      | Prazo (SLA) da ação esperada                         | `stepDue`; sem ação com prazo, o prazo da solicitação             |
| 6   | Código Wellmix      |                                                      | `products.sku`                                                    |
| 7   | Descrição           | Nome, variação e a especificação pedida (numa linha) | `requests.productName`, `specification`                           |
| 8   | Valor s/ IPI        | "—": o portal ainda não tem (dono, 22/11/2026)       | —                                                                 |
| 9   | Valor com IPI       | Preço Wellmix (não WD) por peça, sem frete           | `priceForecast.wellmixPrice` (`PRECO_PRODUTO_META`)               |
| 10  | Valor IPI com frete | Preço Wellmix por peça, com frete                    | `priceForecast.wellmixWithFreight` (`PRECO_COM_FRETE_REFERENCIA`) |
| 11  | Pçs na caixa        | Peças por caixa master                               | `RequestPacking.perBox`                                           |
| 12  | Pçs na inner        | Peças por caixa inner                                | `RequestPacking.inner`                                            |
| 13  | Qtd. caixas         | Caixas master do pedido                              | `RequestPacking.boxes`                                            |
| 14  | Qtd. peças          | Peças do pedido                                      | `TotalsLine.pieces`                                               |
| 15  | CBM total (m³)      |                                                      | `RequestPacking.cbmTotal`                                         |

- Os três valores só aparecem para quem tem "Ver valores e margem".
- Os dois preços Wellmix passaram a ser gravados junto com a previsão de venda (`wellmixPrices`, campos novos dentro de `requests.priceForecast`, sem coluna nova no banco). Previsão gravada antes disso mostra só o "com frete", e só quando o formato não era WD.
- No nível do produto não há linha que abra mais informação; o nome leva à ficha do produto.
- Saíram desta tabela MOQ, Programações e Pedido (seguem nos totais do pedido, na ficha do produto e no CSV).

Aplicada na **página do pedido da encomenda** (`/app/requests/batch/<id>`, enviada e rascunho) e no **painel de itens da tela Pedidos** (os itens da linha escolhida). No painel de Pedidos saíram Cód. do item, Cor, Peso, Preço unitário de compra, Valor, Fornecedor, Pedido e Progresso (seguem na página do pedido); os dois preços Wellmix aparecem quando o pedido é de um produto só com solicitação no portal. Aplicada também (23/11/2026), com as colunas padrão primeiro e as próprias da tela no fim:

- **Página do pedido** (`/app/orders/<id>`, "Itens do pedido"): no fim, Preço unitário e Total de compra (FOB), só com "Ver preço de compra". Situação, Status e Prazo são os do pedido (o marco atual, de quem é a vez e o prazo do marco), iguais em todos os itens. A variação foi para dentro da Descrição. Foto, Código e Pçs na inner só para quem já via a foto (Wellmix e certificadora); m³ só a Wellmix; os preços Wellmix só com "Ver valores e margem" e quando o pedido é de um produto só.
- **Cotação** ("Produtos da cotação", só Wellmix): no fim, Inner exigida. Situação, Status e Prazo são os da cotação; os preços Wellmix vêm da encomenda de cada produto.
- **Ordem de venda** (`/app/sales-orders/<id>`): no fim, Preço unitário da ordem, Reserva e Remover. Os três valores padrão ficam "—" (a ordem não guarda preço com e sem IPI); a quantidade segue editável na coluna Qtd. peças.

Falta nas listas dos passos do fluxo.

## 3. Decisões do dono (22/11/2026)

1. **Nº do pedido**: o número do portal; quando o pedido existe no Sankhya, o Track ID aparece junto.
2. **Prazo e forma de pagamento**: os que ficaram registrados no pedido (a forma escolhida e o número de parcelas). Sem campo novo no cadastro do cliente.
3. **IPI**: o valor com IPI é o preço Wellmix (não WD). Sem IPI o portal não tem por enquanto ("—").
4. **Largura**: a tabela de pedidos tem 18 colunas e rola para o lado; fica assim.

O que o portal continua sem ter: uma data de negociação própria (uso a data em que o pedido foi lançado), o valor "Wellmix STK" gravado (mostro STK no estoque da Wellmix e na reposição) e o VIP no cadastro do cliente (fica no pedido; há um sexto nível, Evo).
