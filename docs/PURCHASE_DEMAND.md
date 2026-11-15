# Compra por demanda: reposição, encomenda, estratégia e cotação

Desenho do dono de 15/11/2026 (mapa do processo, layout 15; docs/MAPA_PROCESSO.md). Reposição (B10) e Encomenda do cliente (B14) entram na mesma decisão, "Qual a estratégia de compra?" (B10?), que leva direto ao pedido de compra (P2) ou à Cotação de compra (B13), cuja vencedora vira a Solicitação ao fornecedor (B7). As decisões estão em docs/OPEN_DECISIONS.md.

Situação: **PRs 1 a 5 entregues (15/11/2026)**. As seções abaixo descrevem o alvo; cada PR marca o que entregou em "Andamento".

## O caminho

```
I3 Encomenda (vitrine, cliente, vendedor, operador) ─► B14 Encomenda do cliente ─┐
E10 Pós-venda e recompra ─► B10 Reposição ────────────────────────────────────────┤
                                                                                  ▼
                                                      B10? Qual a estratégia de compra?
                                    fornecedor da última compra │        │ cotar entre fornecedores
                                                                ▼        ▼
                                              P2 Pedido de compra    B13 Cotação de compra (24 h)
                                                                ▲        │ vencedora aprovada
                                                                │        ▼
                                                                └─ B7 Solicitação ao fornecedor (amostragem, aceite)
```

V6 (vitrine) manda para a ordem de venda (V7) o que o estoque livre ou uma compra a caminho atende, e para a B14 o resto.

## Como era em 15/11/2026 (antes desta mudança)

- **Solicitação do cliente** (`requests`, `/app/requests/new`, fora do menu): o cliente cria só para si (`customerCanCreateRequest`); a Wellmix cria para qualquer cliente indicando o login solicitante (`requestedForUserId`) ou "Compra para estoque". `wellmixCanCreateRequest` não é conferida em lugar nenhum. Depois da remoção da RFQ (11/11), a solicitação fica em "Solicitada" sem caminho até o pedido: o único movimento é cancelar.
- **Carrinho da vitrine** (`cart_items`, `checkoutCart` em `src/lib/services/cart.ts`): gera só solicitações (lote com `groupId`, origem `manual`, status `REQUESTED`), nunca ordem de venda. O saldo livre e o que está a caminho (`availableStockByProduct`) só desenham os selos da vitrine.
- **Ordem de venda** (docs/SALES_ORDERS.md): nasce da oferta ou é aberta pela Wellmix; ao confirmar, a linha com saldo livre ganha reserva e a sem saldo fica "na chegada" (`onArrival`), sem efeito.
- **Reposição**: só pelo "Comprar de novo" do pedido encerrado ou entregue (`createFollowUpRequest`, origem `replenishment`), com o mesmo beco sem saída da solicitação.
- **Pedido de compra** (`createPurchaseOrder`): só de solicitações ao fornecedor aprovadas e com amostragem aprovada; não guarda vínculo com a solicitação do cliente.
- **Última compra**: espalhada entre `product_suppliers` (preço, moeda, MOQ, prazo; sem data nem incoterm), `orders.incoterm`, `purchase_sheets` e `supplier_requests`.
- **Cotação**: as tabelas `quotes` e `approvals` já saíram do esquema (11/11). Restam a chave de tela `quotes` (que hoje quer dizer "Solicitações ao fornecedor e convites"), módulos de texto mortos e `quotationExpirationDays` (só texto). `quoteSlaBusinessDays` continua viva como SLA da solicitação do cliente.
- **Convite de book** (docs/BOOKING_INVITES.md): até 30 parceiros, prazo de 1 dia, isolamento por fornecedor no servidor, sem lembrete nem vencimento automático; no menu aparece como "Cotações".
- **Fornecedor × linha**: não há vínculo explícito; só dá para deduzir pelos produtos da linha.
- **Vendas**: não há papel nem função; "vender" é abrir a tela Produtos.

## Modelo de dados (alvo; tudo aditivo)

- **Demanda de compra = `requests`.** Origem em `origin` (`replenishment` = reposição; `manual` e `cart` = encomenda). Campo novo `channel`: `vitrine | cliente | vendedor | operador` (só na encomenda). Status reaproveitados:

  | Status               | Significado                                         |
  | -------------------- | --------------------------------------------------- |
  | `REQUESTED`          | Esperando a estratégia de compra (B10?)             |
  | `RFQ_OPEN`           | Cotação de compra aberta (B13)                      |
  | `QUOTATION_RECEIVED` | Prazo encerrado ou todos responderam                |
  | `SUPPLIER_SELECTED`  | Vencedora aprovada, solicitação ao fornecedor feita |
  | `ORDERED`            | Pedido de compra gerado                             |

- **`purchase_decisions`** (B10?): uma ou mais demandas do mesmo produto ou linha; escolha `last_supplier | quote`; a última compra de referência; quem escolheu; aprovação da Diretoria de compras (`pending | approved | rejected`, quem e quando).
- **`purchase_quotes`** e **`purchase_quote_responses`** (B13): uma resposta por fornecedor com `dueAt` em UTC, preço por item, incoterm, prazo de produção, porto, MOQ, observação, recusa e o aviso de lembrete; a vencedora com a mesma aprovação.
- **`supplier_lines`**: fornecedor × linha, preenchido uma vez a partir dos produtos de cada linha e editável no cadastro do fornecedor.
- **Vínculos**: `orders.demandIds` (de qual encomenda ou reposição o pedido veio); `supplier_requests.demandIds` e `supplier_requests.quoteResponseId`.
- **Acessos**: função `sales` (Vendas) e as ações `demand.createForCustomer`, `replenishment.open`, `purchaseStrategy.choose`, `purchaseStrategy.approve`, `purchaseQuote.choose` e `purchaseQuote.approve`.
- **Configurações**: `purchaseQuoteHours` (24) e `autoReplenishmentByStock` (desligada, sem efeito).

## Telas (alvo; bloco Produto novo)

1. **Encomendas**: a tela de solicitações volta ao menu com esse nome; etiqueta e filtro de origem e de porta. O cliente vê só as próprias, sem fornecedor, custo nem cotação.
2. **Reposição**: fila do Planner, com "Abrir reposição" (produto, quantidade, data desejada) e o que vem do pós-venda.
3. **Estratégia de compra**: fila do Comprador, com a última compra de cada item, as duas saídas e a opção de juntar demandas. Produto sem compra anterior só pode ser cotado, com o motivo escrito.
4. **Cotação de compra**: contagem das 24 h e quadro comparativo para a Wellmix (com a última compra como referência); para o fornecedor, só a própria cotação, em PT, EN ou ZH.
5. O item "Cotações" de hoje (convites de book) passa a se chamar **"Convites de book"**; tela, rota e atalho continuam.

## O que o PR 2 entregou

- **Porta de entrada** (`requests.channel`), gravada pelo servidor: carrinho = `vitrine`; cliente = `cliente`; Wellmix com a função Vendas = `vendedor`; outro login da Wellmix (e o administrador) = `operador`. Reposição e compra para estoque ficam sem porta. Regra em `src/lib/purchase-demand.ts` (`demandChannel`, `demandKind`, `splitCart`).
- **Data desejada** (`requests.desiredAt`): a do carrinho ("Quando você precisa?") e a da reposição.
- **Lançar em nome do cliente**: a Wellmix só cria encomenda para um cliente com a ação `demand.createForCustomer` (padrão: a função Vendas e quem já abria a tela de solicitações; o administrador sempre). Compra para estoque e reposição não pedem a ação.
- **Carrinho dividido** (docs/SALES_ORDERS.md, "V6"): pronta entrega vira ordem de venda em rascunho; o resto vira encomenda (origem `cart`).
- **Reposição manual** (`/app/replenishment`, `openReplenishment`): ação `replenishment.open` (padrão: Planner). Vai para a empresa "Estoque Wellmix", origem `replenishment`; produto com variações entra pelo produto inteiro (a variação, se importar, vai na observação). A recompra do pós-venda (origem `replenishment`) aparece na mesma fila.
- **Configuração** `autoReplenishmentByStock`: desligada e sem efeito (Configurações mostra o campo travado).
- **Função Vendas** (`sales`): telas Encomendas (`requests`), Produtos (ofertas, amostras, venda, ordens de venda, reservas) e Pós-venda; ação `demand.createForCustomer`. Demonstração: `vendas@wellmix.com`.
- **Ações novas em funções já gravadas**: a função guarda `knownActions` (as ações que existiam quando foi salva). Ação que a função não conhecia vale pelo padrão do código até o administrador salvar a função de novo; as gravadas antes de 15/11/2026 usam `LEGACY_ACTIONS`. Assim ninguém perde o que fazia hoje.
- **Avisos**: "Encomenda nova" e "Reposição nova" para a Wellmix (e-mail e WhatsApp simulados); a ordem de venda da vitrine avisa Vendas.
- **Auditoria**: `request.create` diz "Encomenda (porta)" ou "Reposição"; `cart.checkout` registra a ordem de venda e as encomendas; `sales.order_from_cart`.
- **Menu**: passos Encomendas e Reposição (docs/FLOW_MENU.md); "Cotações" virou "Convites de book".
- **Testes**: `tests/unit/purchase-demand.test.ts` (portas, carrinho, reposição, permissões, isolamento do cliente), `tests/unit/function-access.test.ts` (ações novas) e `tests/e2e/purchase-demand.spec.ts` (vendedor e operador em nome do cliente; carrinho com pronta entrega e encomenda; reposição do Planner).

## O que o PR 3 entregou

- **Tela** `/app/purchase-strategy` (passo "Estratégia de compra" do Produto novo; tela `quotes`, a de quem abre Solicitações ao fornecedor): uma fila só, com reposições e encomendas que esperam a escolha (`REQUESTED`, sem estratégia), agrupadas pela linha do produto. Cada produto mostra a **última compra** (`lastPurchases`): o pedido de compra mais recente com o produto, não cancelado; fornecedor, preço unitário e moeda do item, data e incoterm do pedido; prazo de produção e pedido mínimo do vínculo produto × fornecedor (`product_suppliers`).
- **Escolha** (`chooseStrategy`, ação `purchaseStrategy.choose`, padrão: Comprador): as demandas marcadas, do mesmo produto ou da mesma linha, viram uma `purchase_decisions` "pendente"; cada demanda guarda `purchaseDecisionId` e sai da fila. "Fornecedor da última compra" só com um produto e com compra anterior; sem ela, só "Cotar entre fornecedores", com o motivo escrito. Demanda sem produto do catálogo fica à parte (cadastrar o produto antes).
- **Aprovação** (`decideStrategy`, ação `purchaseStrategy.approve`, padrão: Diretoria de compras; o administrador sempre): aprovar ou recusar (com o motivo). Recusada, as demandas voltam para a fila. Não há tabela genérica de aprovações (saiu em 11/11/2026): a aprovação fica na própria decisão, com quem e quando, aviso e auditoria.
- **Pedido de compra direto** (`orderFromStrategy` → `createDirectPurchaseOrder`, ação `purchaseOrder.generate`): com a estratégia "fornecedor da última compra" aprovada, o formulário vem com a quantidade somada e as condições da última compra (preço, moeda, prazo, incoterm), editáveis. O pedido nasce no fluxo do pedido de compra (`flow: supplier_request`, etapas, raias, parceiros, condição de pagamento), sem nova solicitação ao fornecedor e sem nova amostragem, com `orders.demandIds`. As demandas viram "Pedido" (`ORDERED`, `orderId`). Vendas é avisada como no V1.
- **Reserva da encomenda**: para cada encomenda (não reposição), uma reserva ativa para o cliente, sem validade, com `requestId` e a nota "Encomenda nº N: pedido de compra #M (reservada na chegada)". A reserva conta só no que chegou ao Brasil, então vale quando a mercadoria chega.
- **"Cotar entre fornecedores" aprovada** fica esperando a Cotação de compra (PR 4).
- **Pendências** (passo Estratégia de compra): `purchase_strategy` (cada demanda esperando a escolha, para quem escolhe), `purchase_strategy_approve` (cada estratégia pendente, para quem aprova) e `purchase_strategy_order` (aprovada sem pedido, para quem gera pedido de compra). Quem escolhe a estratégia não recebe também a pendência "Encomenda nova"/"Reposição" da mesma demanda.
- **O cliente** não vê o botão do pedido de compra na encomenda (o pedido é da Wellmix); continua sem fornecedor, custo nem cotação.
- **Reposição**: a busca de produto passou a ser a de produtos ativos (também os que ainda não estão na vitrine).
- **Demonstração**: `diretoria@wellmix.com` (Diretoria de compras).
- **Esquema (aditivo)**: tabela `purchase_decisions`; `requests.purchaseDecisionId`; `orders.demandIds`; `stock_reservations.requestId`.
- **Testes**: `tests/unit/purchase-strategy.test.ts` (última compra, produto sem compra anterior, junção por produto e linha, aprovação, recusa, pedido com vínculo e reserva) e `tests/e2e/purchase-strategy.spec.ts` ((a) reposição → última compra → pedido; (c) encomenda do cliente → estratégia → pedido com o vínculo e a reserva).

## O que o PR 4 entregou

- **Abertura sem ação manual**: quando a Diretoria de compras aprova a estratégia "cotar entre fornecedores", `openQuoteForDecision` cria a `purchase_quotes` (produtos das demandas somados por produto) e uma `purchase_quote_responses` por fornecedor convidado; as demandas vão para `RFQ_OPEN`.
- **Quem é convidado** (`supplierIdsForLines`): os fornecedores **ativos** com o vínculo cadastrado na linha (`supplier_lines`, tela Cadastros → fornecedor → "Linhas atendidas"), o fornecedor principal dos produtos ativos da linha e os fornecedores ligados aos produtos cotados (`product_suppliers`). Sem nenhum, a cotação nasce vazia e o Comprador é avisado.
- **Prazo**: `purchaseQuoteHours` (Configurações → SLA, padrão 24, aceita fração de hora) a partir do convite, gravado em UTC (`dueAt`); a tela mostra o que falta e a hora em Brasília e na China. O vencimento é calculado na leitura (`responseState`), exato. O lembrete ao fornecedor sai uma vez, a 1/6 do prazo do fim (4 h em 24 h), e o aviso "sem resposta" ao Comprador, uma vez: os dois rodam no agendamento diário (`/api/jobs/reminders`) e a cada abertura das telas da cotação (`sweepQuotes`). Um agendamento de hora em hora na Vercel ficou de fora (o plano não foi confirmado).
- **Fornecedor** (`/app/purchase-quotes`, no menu dele como "Cotações de compra"): vê só os próprios convites; responde no idioma dele (PT, EN, ZH) com preço por item, moeda, incoterm, prazo de produção, porto, pedido mínimo e observação, ou recusa; pode corrigir enquanto o prazo corre. O servidor lê só a resposta dele (`ownResponse` por `supplierId`): nunca quem mais foi convidado, as outras respostas, as demandas nem o cliente.
- **Quadro comparativo** (`/app/purchase-quotes/[id]`, Wellmix): uma linha por fornecedor com a situação, o preço de cada item, o total e a condição de envio, e a última compra de cada produto como referência. A escolha abre quando todos responderam ou o prazo de todos passou.
- **Escolha e aprovação**: o Comprador escolhe a vencedora (ação `purchaseQuote.choose`); a Diretoria de compras aprova ou recusa com o motivo (`purchaseQuote.approve`). Aprovada, nasce a **Solicitação ao fornecedor (B7)**, uma por produto com o mesmo número, já "respondida" com o preço, a moeda, o incoterm, o prazo e o pedido mínimo cotados, o produto do catálogo ligado e sem item de book; guarda `quoteResponseId` e `demandIds`. As demandas vão para `SUPPLIER_SELECTED`. O resto é o caminho de sempre (decisão, amostragem, pedido de compra); ao gerar o pedido de compra dessas solicitações, as demandas viram "pedido" e a encomenda ganha a reserva para o cliente.
- **Sem nenhuma resposta**: o Comprador reabre por mais um prazo (para quem não respondeu), convida outro fornecedor ativo (com o prazo cheio) ou volta para a estratégia (a cotação é cancelada e as demandas voltam para a fila).
- **Pendências** (passo "Cotação de compra"): `purchase_quote_answer` (fornecedor), `purchase_quote_choose` e `purchase_quote_empty` (Comprador), `purchase_quote_approve` (Diretoria). Avisos (e-mail e WhatsApp simulados): convite, lembrete, reabertura, nova resposta, vencedora escolhida, aprovada ou recusada, vencedora avisada. Auditoria de abertura, resposta, recusa, escolha, aprovação, reabertura, convite e volta à estratégia.
- **Esquema (aditivo)**: `purchase_quotes`, `purchase_quote_responses`, `supplier_lines`; `supplier_requests.quoteResponseId` e `demandIds`.
- **Testes**: `tests/unit/purchase-quote.test.ts` (fornecedores pela linha, prazo de 24 h com data e fuso explícitos, isolamento, escolha e aprovação até a B7, um responde e outro não, sem nenhuma resposta, lembrete) e `tests/e2e/purchase-quote.spec.ts` ((b) e o isolamento entre fornecedores e do cliente).

## O que o PR 5 entregou (limpeza da RFQ)

- Um modelo de cotação só: a Cotação de compra (B13). As tabelas `quotes` e `approvals` já tinham saído em 11/11/2026; os status antigos da solicitação foram reaproveitados (docs/QUOTE_FLOW.md, "Desde 15/11/2026").
- Saíram 684 textos sem uso (grupos `rfq`, `rfqStandby`, `quoteFlow`, `quoteSheet`, `quoteSent`, `quotes`, `spRfq` e `approvals` menos `approvals.error.*`) e o rótulo da configuração `quotationExpirationDays`. Ficaram as chaves ainda lidas pelo código, inclusive as montadas na hora (erros, nomes de funções, origens).
- Ficaram, de propósito: a chave de tela `quotes` (gravada nas funções), as ações aposentadas em `RETIRED_ACTIONS` e `quoteSlaBusinessDays`, renomeada na tela para "SLA de resposta da encomenda".
- docs/QUOTE_FLOW.md, docs/RFQ_STANDBY.md e docs/APPROVALS.md apontam para a cotação de compra.

## Andamento

| PR  | Entrega                                                                                       | Situação |
| --- | --------------------------------------------------------------------------------------------- | -------- |
| 1   | Mapa (MAPA_PROCESSO.md gerado do data.json), decisões e este documento                        | feito    |
| 2   | Demanda única: encomenda pelas 4 portas, divisão do carrinho, reposição manual, função Vendas | feito    |
| 3   | Estratégia de compra, aprovação e pedido de compra direto                                     | feito    |
| 4   | Cotação de compra: fornecedor × linha, 24 h, isolamento, quadro comparativo                   | feito    |
| 5   | Limpeza dos restos da RFQ                                                                     | feito    |
