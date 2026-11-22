# Compra por demanda: reposição, encomenda, estratégia e cotação

> **22/11/2026 (docs/QUOTATION.md):** a cotação de compra aparece para a Wellmix dentro da **Cotação** (`/app/supplier-requests`), com o quadro comparativo por produto, a conversa e a contraproposta por fornecedor ainda antes de escolher a vencedora (`purchase_quote_responses.negotiation`). `/app/purchase-quotes` continua abrindo.

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
- **`supplier_lines`**: fornecedor × linha, preenchido uma vez a partir dos produtos de cada linha e editável no cadastro do fornecedor. Desde 18/11/2026 a seção "Linhas atendidas" deu lugar a "Grupo de produto (família)" (`party_families`, docs/PARTNER_FAMILIES.md); cada vínculo antigo vira a família da linha uma vez só (`familyConvertedAt`) e continua no banco.
- **`product_families`** e **`party_families`** (18/11/2026): o cadastro de famílias (1º nível da árvore de grupos do Sankhya, pelo código) e as famílias que cada Fornecedor, Trading, Supplier e Factory atende; `product_lines.familyCode` é a família de cada linha.
- **Vínculos**: `orders.demandIds` (de qual encomenda ou reposição o pedido veio); `supplier_requests.demandIds` e `supplier_requests.quoteResponseId`.
- **Acessos**: função `sales` (Vendas) e as ações `demand.createForCustomer`, `replenishment.open`, `purchaseStrategy.choose`, `purchaseStrategy.approve`, `purchaseQuote.choose` e `purchaseQuote.approve`.
- **Configurações**: `purchaseQuoteHours` (24) e `autoReplenishmentByStock` (desligada, sem efeito).

## Telas (alvo; bloco Produto novo)

1. **Encomendas**: a tela de solicitações volta ao menu com esse nome; etiqueta e filtro de origem e de porta. O cliente vê só as próprias, sem fornecedor, custo nem cotação. Os chips Todas / Encomendas / Reposições saíram da lista (dono, 18/11/2026: a Reposição tem tela própria); o `?kind=` dos links antigos continua filtrando.
2. **Reposição**: fila do Planner, com o botão "+ Adicionar" (desde 16/11/2026, no lugar do bloco "Abrir reposição": abre a tela Venda como compra para estoque, docs/REQUEST_SCREENS.md seção 7) e o que vem do pós-venda.
3. **Estratégia de compra**: fila do Comprador, com a última compra de cada item, as duas saídas e a opção de juntar demandas. Produto sem compra anterior só pode ser cotado, com o motivo escrito.
4. **Cotação de compra**: contagem das 24 h e quadro comparativo para a Wellmix (com a última compra como referência); para o fornecedor, só a própria cotação, em PT, EN ou ZH.
5. O item "Cotações" de hoje (convites de book) passa a se chamar **"Convites de book"**; tela, rota e atalho continuam.

**Preço de compra (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seções 7 e 8):** na estratégia, o preço da última compra aparece só com "Ver preço de compra"; quem gera o pedido sem a permissão não vê nem digita o preço, e o pedido sai com o preço e a moeda da última compra gravados na decisão. Na cotação, preços por item, total e a linha "Última compra" só com a permissão; sem ela, o quadro mostra fornecedores, situação e condições, com o aviso de quem vê.

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
  - **Texto nos três idiomas** (16/11/2026): o título e o detalhe das três vão por chave e valores (`Task.text`, chaves `strategy.task.*` e `strategy.choice.*`), e a tela traduz no idioma de quem lê; a quantidade (`text.numbers`) sai com o separador do idioma (4.800 em pt, 4,800 em en; `taskTextValues` em `src/lib/task-text.ts`). `title` e `detail` seguem gravados em português, para quem não traduz. O filtro e a coluna "Tipo" de Pendências têm o rótulo de cada tipo (`tasks.group.purchase_strategy*`, e também `tasks.group.replenishment_request` e `tasks.group.purchase_quote_*`, que saíam como chave crua).
- **O cliente** não vê o botão do pedido de compra na encomenda (o pedido é da Wellmix); continua sem fornecedor, custo nem cotação.
- **Reposição**: a busca de produto passou a ser a de produtos ativos (também os que ainda não estão na vitrine).
- **Demonstração**: `diretoria@wellmix.com` (Diretoria de compras).
- **Esquema (aditivo)**: tabela `purchase_decisions`; `requests.purchaseDecisionId`; `orders.demandIds`; `stock_reservations.requestId`.
- **Testes**: `tests/unit/purchase-strategy.test.ts` (última compra, produto sem compra anterior, junção por produto e linha, aprovação, recusa, pedido com vínculo e reserva) e `tests/e2e/purchase-strategy.spec.ts` ((a) reposição → última compra → pedido; (c) encomenda do cliente → estratégia → pedido com o vínculo e a reserva).

## O que o PR 4 entregou

- **Abertura sem ação manual**: quando a Diretoria de compras aprova a estratégia "cotar entre fornecedores", `openQuoteForDecision` cria a `purchase_quotes` (produtos das demandas somados por produto) e uma `purchase_quote_responses` por fornecedor convidado; as demandas vão para `RFQ_OPEN`.
- **Quem é convidado** (`supplierIdsForLines`): os fornecedores **ativos** com o vínculo cadastrado na linha (`supplier_lines`, tela Cadastros → fornecedor → "Linhas atendidas"), o fornecedor principal dos produtos ativos da linha e os fornecedores ligados aos produtos cotados (`product_suppliers`). Sem nenhum, a cotação nasce vazia e o Comprador é avisado. **Desde 18/11/2026** (dono; docs/PARTNER_FAMILIES.md): entram também quem marcou a família de alguma das linhas ("Grupo de produto (família)" no cadastro), dos quatro tipos (Fornecedor, Trading, Supplier e Factory), cada um uma vez só; o vínculo antigo da linha vale até ser convertido em família, e depois a família manda. O convite manual busca nos quatro tipos, e a vencedora de qualquer um deles vira o fornecedor da solicitação.
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

## Estratégia de Compra por produto (dono, 18/11/2026)

Pedido do dono: depois de Encomendas, a "Estratégia de Compra" com um produto por linha, a escolha e os destinatários de cada produto, o resumo antes de confirmar, os parceiros vendo e respondendo a cotação pelo portal e o resultado por destinatário, com reenvio sem duplicar. Decisões D1 a D7 aprovadas pelo dono ("Ok com as recomendações"):

| #   | Decisão                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | A encomenda do cliente só entra na fila depois de **Encomendas → "Enviar para cotação"** (produtos soltos, o lote inteiro ou um produto na página do lote). A reposição continua entrando sozinha. As encomendas que já esperavam não foram mexidas: esperam o envio.                                                                |
| D2  | **Cotar não passa mais pela aprovação**: a cotação vai na hora. A Diretoria de compras continua aprovando a vencedora (já existia) e o pedido direto.                                                                                                                                                                                |
| D3  | Três escolhas por produto: **Cotar com o fornecedor da última compra** (a cotação vai só para ele), **Cotar com outros fornecedores** (os parceiros marcados) e **Pedido direto com o fornecedor da última compra (sem cotação)**, o caminho de antes, com a aprovação.                                                              |
| D4  | **Trading, Supplier e Factory recebem e respondem** a cotação e aparecem no comparativo. A trava "ainda não vencem" ficou sem efeito: o dono decidiu no mesmo dia (docs/PARTNER_FAMILIES.md, decisão 1) que quem vence, de qualquer desses tipos, vira o fornecedor da solicitação e do pedido de compra.                            |
| D5  | Os parceiros vêm do **"Grupo de produto (família)"** do cadastro (docs/PARTNER_FAMILIES.md, `party_families`, a vinculação que estava sendo feita em paralelo): quem marcou a família da linha do produto aparece para cotar. Além deles, a linha sugere quem já forneceu produtos das linhas da família ("sem vínculo") e há busca. |
| D6  | O parceiro vê o produto, a quantidade, a **especificação**, a **programação de entrega** e a data desejada; **nunca o cliente**.                                                                                                                                                                                                     |
| D7  | Os itens 1 e 2 do PR #509 (Pendências da estratégia nos três idiomas) entraram nesta entrega; o item 3 (tirar os códigos do mapa dos subtítulos dos passos) ficou no #509 para o dono decidir.                                                                                                                                       |

- **Encomendas** (`/app/requests`): a seleção da lista serve para enviar e para excluir; o botão **Enviar para cotação** só manda as encomendas com a situação Solicitado ainda não enviadas (as outras são contadas no aviso). O "Próximo passo" mostra "Enviar para cotação" e, depois, "Estratégia de compra". A pendência "Encomenda nova" da encomenda ainda não enviada vira **"Enviar para cotação"** (também para o Comprador); a já enviada segue com quem escolhe a estratégia. Grava `requests.strategySentAt` e `strategySentByUserId`, com a Auditoria `purchase_strategy.send_request`, e avisa quem escolhe a estratégia.
- **Estratégia de Compra** (`/app/purchase-strategy`, a mesma rota; passo logo depois de Encomendas no menu Produto novo): cada linha é uma demanda (um produto), com a encomenda de origem (link), o lote, o cliente, a quantidade, a data desejada, o prazo, a família, a especificação, a programação de entrega e a última compra (fornecedor, pedido e data; preço só com "Ver preço de compra"). Sem compra anterior, a linha diz isso e só libera "Cotar com outros fornecedores". "Não enviar agora" é o padrão.
- **Destinatários** de "Cotar com outros fornecedores": os que marcaram a família da linha do produto no "Grupo de produto (família)" (`product_lines.familyCode` × `party_families`, já marcados quando aptos; a família aparece com o nome e o código), os sugeridos pelo histórico (a última compra, o fornecedor do produto, os ligados ao produto e quem mais forneceu produtos das linhas da família, até 8) e a busca pelos quatro tipos (`/api/parties/search?type=supplier&also=trading,supplier_partner,factory`). Cada parceiro mostra o tipo, o país, quantos logins tem e se está **apto**; quem não está mostra o motivo e o link para o cadastro: tipo que não cota, cadastro inativo, tipo desativado, sem login ativo, tela Cotação fechada no perfil do tipo (Gestão de telas). Login sem e-mail é só aviso (o aviso fica no portal). Regras em `src/lib/purchase-recipients.ts`; conferência em `src/lib/services/purchase-recipients.ts` (a busca confere o escolhido por `/api/purchase-strategy/recipient`).
- **Resumo e confirmação**: "Revisar o envio" mostra, por produto, quem recebe e quem fica de fora (com o motivo) ou "vai para a aprovação" (pedido direto). Cada cotação precisa de pelo menos um parceiro apto (a tela e o servidor conferem). As escolhas ficam na tela se o servidor recusar.
- **Envio** (`sendStrategy`): uma estratégia (`purchase_decisions`) e uma Cotação de compra por produto (o comparativo escolhe uma vencedora por cotação), com `recipientIds` e `sendId`; cotar nasce aprovada sem aprovador ("Sem aprovação antes da cotação"). Os convites reaproveitam a Cotação de compra inteira (prazo, lembrete, resposta no portal, comparativo, vencedora, aprovação e a Solicitação ao fornecedor). Um convite por cotação e parceiro (índice único `quote_supplier_unique` e conferência antes de convidar): o clique duplo não duplica.
- **Resultado** (`/app/purchase-strategy/sends/[id]`, tabela `purchase_strategy_sends`): por produto, a cotação aberta (link) ou o pedido direto, e por destinatário **Recebeu** (com quantos logins foram avisados; e-mail e WhatsApp ainda simulados), **Já tinha recebido**, **Ficou de fora** (com o motivo) ou **Erro no envio**. **Tentar de novo** confere de novo só quem ficou de fora ou deu erro e convida quem agora está apto; a linha que não chegou a virar estratégia (ou cuja cotação não abriu) é retomada. Os envios recentes ficam na tela da Estratégia. Pendência `purchase_strategy_send` (quem escolhe a estratégia) enquanto houver parceiro sem receber.
- **Tela própria** `purchaseStrategy` (Gestão de telas, módulo Produto novo): nasce aberta para quem abre as cotações (`SCREEN_PARENT` em `src/lib/auth/screens.ts`: nas exceções do Personalizado, na lista antiga marcada uma a uma e nas funções gravadas antes dela, a tela nova segue a de cotações; depois que o administrador grava, vale o que ele marcou). Padrão do código: Comprador, Gerente de produto, Planejamento e as diretorias.
- **Esquema (aditivo)**: `requests.strategySentAt`, `strategySentByUserId`; `purchase_decisions.recipientIds`, `sendId` (e a escolha `quote_last`); `purchase_quotes.items` com `specification`, `schedule` e `desiredAt` (JSON); tabela `purchase_strategy_sends`; índice único `purchase_quote_responses (quoteId, supplierId)`. O vínculo parceiro × família é o `party_families` do "Grupo de produto (família)".
- **Testes**: `tests/unit/strategy-send.test.ts` (envio na Encomenda, fila, pendências, conferência dos parceiros, a família do cadastro na fila, as três escolhas, recusas, reenvio sem duplicar, cotação encerrada, Trading vencendo, o que o parceiro vê, tela própria sem perda de acesso) e as E2E `tests/e2e/purchase-strategy.spec.ts` (envio pela Encomenda, pedido direto e cotar com a última compra até o fornecedor responder) e `tests/e2e/purchase-quote.spec.ts` (Grupo de produto (família) no cadastro, cotar com outros, resultado por destinatário).
- **Fica para depois**: juntar o mesmo produto de encomendas diferentes numa cotação só (volume); convite por e-mail para quem não tem login (depende do provedor de e-mail). A condição de pagamento, o início da produção e a fatura da Trading, do Supplier e da Factory vencedora já foram resolvidos (docs/PARTNER_FAMILIES.md, "Condição de pagamento, início da produção e fatura").

## Estratégia por solicitação (dono, 18/11/2026)

Pedido do dono, depois da Estratégia de Compra por produto: a estratégia é da **solicitação**, não do produto; e "não dá mais para juntar demandas de solicitações diferentes numa estratégia só" (confirmado).

- **Fila por solicitação**: um cartão por solicitação (o lote da Nova solicitação, mesmo `groupId` e número; sem lote, a própria demanda; `requestKey`), com o cliente, o selo **País › Família** e todos os produtos dela, cada um com os dados de antes (encomenda de origem, quantidade, especificação, programação, última compra). **Uma escolha só** para a solicitação inteira; o resumo e o envio também são por solicitação.
- **Enviar para cotação** (Encomendas e a página do pedido): manda a solicitação inteira; um produto marcado leva os outros do mesmo lote que ainda esperam o envio (`sendToStrategy`). Na página do pedido fica o botão "Enviar para cotação" do pedido todo (o de cada produto saiu).
- **O servidor confere** (`sendStrategy` e `chooseStrategy`): uma solicitação só por escolha (`strategy_same_request`) e todas as demandas dela que estão na fila (`strategy_whole_request`). Juntar demandas de solicitações diferentes (antes, "mesma linha") saiu.
- **Cotar com outros fornecedores**: os destinatários vêm da lista do **País × Família** da solicitação (`strategySuppliers`), já marcados quando aptos: os parceiros ativos dos quatro tipos, do país de origem, que marcaram a família no cadastro (`party_families`) ou fornecem produto da família (`products.supplierId`, `product_suppliers`). O Comprador desmarca quem não deve receber e pode marcar de novo; os sugeridos do histórico fora dessa lista e a busca continuam. País e família vêm das condições do pedido (`orderTerms.originCountry` e `productFamily`); sem elas (reposição, antigas), do produto do catálogo. Até 200 destinatários por solicitação.
- **Fornecedor da última compra** (cotar com ele ou pedido direto): vale quando **todos os produtos têm compra anterior do mesmo fornecedor** (`sameLastSupplier`); senão a tela diz o motivo (algum sem compra anterior, ou fornecedores diferentes; `strategy_no_last_purchase`, `strategy_last_same_supplier`). O pedido direto sai com uma linha por produto (quantidade somada e preço da última compra de cada um, editáveis; o prazo vem com o maior).
- **Uma estratégia e uma cotação por solicitação**, com todos os produtos (os itens da cotação somados por produto; a vencedora é da solicitação). O envio guarda as demandas de cada linha (`purchase_strategy_sends.lines[].demandIds`, dentro do JSON; os envios de antes ficam com `demandId`), e o "Tentar de novo" refaz a solicitação inteira.
- **Testes**: `tests/unit/strategy-send.test.ts` ("por solicitação": a fila junta o lote, a lista do País × Família, a recusa da solicitação pela metade e uma cotação com os dois produtos) e `tests/unit/purchase-strategy.test.ts` (solicitação inteira; última compra com vários produtos do mesmo fornecedor e com fornecedores diferentes); a E2E `purchase-quote` desmarca e marca de novo um fornecedor da lista.

## Embalagem e cubagem na Estratégia (dono, 18/11/2026)

Pedido do dono (foto da Estratégia nº 1 no iPad): ao lado da quantidade, quatro campos separados, **Quantidade (peças) | Caixas master (total) | Caixas inner (total) | Cubagem total (m³)**, com os dados reais do produto, da embalagem e da solicitação, e os campos da tela menores e alinhados.

- **Onde aparece**: em cada produto da fila ("Solicitações esperando a estratégia") e em "Em andamento" (só leitura); no formulário do pedido direto (estratégia aprovada, fornecedor da última compra), a quantidade é editável e os três totais são refeitos a cada tecla. A linha seguinte do formulário é **Preço unitário | Moeda | Prazo de produção (dias) | Incoterm** (com vários produtos, o preço fica em cada produto e Moeda, Prazo e Incoterm numa linha só). O preço vem com a precisão gravada (ex.: 0.48331065); o prazo continua editável, também vazio.
- **De onde vêm os dados**: as mesmas fontes, na mesma ordem, da ficha completa da solicitação (docs/REQUEST_SHEET.md, "Embalagem e cubagem"): a especificação gravada, a variação, o pedido, a negociação, o Book e a ficha atual do produto (`packingCandidates` em `src/lib/services/request-packing.ts`, a lista única de fontes que a ficha e os totais de Encomendas também usam, e `packingFactsOf` em `src/lib/services/request-sheet.ts`, lidas por `loadSheetInputs`). **O CBM só vale se for da mesma caixa contada** (CBM de uma caixa com outra quantidade de peças fica "—", com o aviso); desde 19/11/2026 a ficha completa e os totais de Encomendas seguem a mesma regra (`cbmForBox`). Uma diferença, só nesta tela: **0 peças por inner gravado é "Sem caixa inner"** (0 caixas; a ficha pula o 0).
- **A base do CBM**: no portal o CBM é sempre o da **caixa master** (no Sankhya, o M3 do volume da master, TGFVOA; o M3 do produto, TGFPRO, é por peça e não é usado). Cubagem total = caixas master × CBM da master, com 4 casas.
- **As contas** (`src/lib/strategy-packing.ts`, pura, a mesma na tela e no servidor): caixas master = peças ÷ peças por master, em caixas inteiras para cima (`cartonsFromPieces`, a regra do gerador e da ficha). **Com programação de entrega, uma conta por programação** (decisão do dono de 18/11/2026: "por programação, igual à ficha completa"; 1.000 + 1.000 com 192 por caixa são 6 + 6 = 12 caixas); quantidade mudada no formulário conta pelo total digitado. Caixas inner: a mesma conta com as peças por inner, quando a inner fecha a master. Encomenda em caixas (CX) é convertida em peças pela master (hoje nenhuma encomenda da estratégia está em caixas).
- **Dado ausente × zero**: sem o dado necessário, "—" com a linha de apoio "não informado"; "Sem caixa inner" é 0. Embaixo das caixas, discretamente, as peças por master e "Peças por inner"; embaixo da cubagem, o CBM da master. A conta aparece escrita embaixo ("2.193 + 2.193 caixas master, uma conta por programação · 4.386 × 0,031 m³ = 135,966 m³").
- **Incompatibilidades avisadas** (em âmbar): a última caixa master (ou inner) incompleta; **inner que não fecha a master, "—" com o aviso** (decisão do dono de 18/11/2026: em 342 dos 1.485 produtos com inner a inner não fecha a master, muitas vezes porque o Sankhya grava as peças do conjunto, ex.: "CJ 6 COPOS" com master 8 e inner 6); inner maior que a master; CBM de outra caixa; programação que não soma a quantidade (as caixas saem pelo total); encomendas do mesmo produto com embalagens diferentes; encomenda em caixas sem peças por master.
- **Conferência no servidor ao gerar o pedido**: o formulário manda, por produto, o que a tela mostrou (`seal__<produto>`: caixas master, inner e cubagem); o servidor refaz a conta com a embalagem de agora e, se mudou, recusa sem criar nada (`strategy_packing_changed`, "A embalagem de algum produto mudou desde que a tela abriu"). Os totais vão para a Auditoria do pedido (`purchase_strategy.order`). A quantidade em peças é lida como número inteiro ("526.320" = 526.320 peças, antes lido como 526,32), na tela e no servidor.
- **Campos da tela**: mais baixos (32 px; 40 px no toque), sem sombra, borda discreta, cantos levemente arredondados, rótulo acima e largura pelo conteúdo; no celular, dois por linha. Editável = fundo branco com borda; calculado = fundo cinza sem borda; letra de 13 px no computador e no iPad e 16 px no iPhone (o Safari não dá zoom; `data-compact-fields` em `src/app/globals.css`).
- **Estratégia parada por encomenda cancelada** (decisão do dono de 18/11/2026, "Bloquear e avisar"): a Estratégia nº 1 de produção estava aprovada com a encomenda nº 5 excluída (cancelada) depois da aprovação, e "Gerar pedido de compra" criaria o pedido, voltaria a encomenda cancelada para "Pedido feito" e reservaria as peças para o cliente. Agora, com encomenda **cancelada ou já em outro pedido** (`closedDemands` em `src/lib/purchase-demand.ts`): a tela mostra o selo na encomenda e o aviso "Estratégia parada"; o servidor não aprova (`decideStrategy`) nem gera o pedido (`orderFromStrategy`, `strategy_demand_closed`); a pendência "Gerar pedido" some. Nada gravado muda; esperando aprovação, a Diretoria ainda pode recusar (é como ela sai de Em andamento).
- **Testes**: `tests/unit/strategy-packing.test.ts` (a lousa de produção com 2 programações, com e sem inner, inner 0, inner que não fecha, embalagem ausente, outras quantidades por caixa, a quantidade mudada, a encomenda em caixas, a conferência no servidor e a encomenda cancelada) e a E2E `tests/e2e/purchase-strategy.spec.ts` (os quatro campos e o recálculo no formulário).

## Encerrar a estratégia parada (dono, 19/11/2026)

Depois da estratégia parada (seção anterior), o dono pediu o botão para tirá-la de Em andamento. Decisões de 19/11/2026: **o Comprador e a Diretoria de compras encerram** (o administrador sempre pode) e **as encomendas da solicitação que continuam abertas voltam para a fila** da Estratégia, como na recusa. Na mesma data, o dono decidiu **não corrigir o inner do Sankhya** nos 342 produtos em que ele não fecha a master: a tela continua com "—" e o aviso.

- **Onde aparece:** só na estratégia **aprovada** que parou (encomenda cancelada ou já em outro pedido), dentro do aviso "Estratégia parada": "Encerrar estratégia", com observação opcional e a confirmação "Encerrar a estratégia nº N?". Esperando aprovação, continua valendo "Recusar" (da Diretoria).
- **O que grava** (`closeStrategy` em `src/lib/services/purchase-strategy.ts`, ação `closeStrategyAction`): a estratégia passa para a situação nova **Encerrada** (`closed`, acrescentada a `PURCHASE_DECISION_STATUSES`; a coluna `status` é texto, então o banco não muda) e sai de Em andamento e das Pendências. As encomendas deixam de apontar para ela (`purchaseDecisionId` vazio): a cancelada segue cancelada, a que está em outro pedido segue nele e as abertas voltam para "Solicitações esperando a estratégia". Nenhum pedido é criado e nada é apagado.
- **Quem e por quê:** a Auditoria (`purchase_strategy.close`) guarda quem encerrou, quando, as encomendas que pararam a estratégia, quantas voltaram para a fila e a observação. Quem escolheu a estratégia recebe o aviso, quando não foi ele que encerrou.
- **O servidor confere:** quem pode (`canCloseStrategy`: ação "Escolher a estratégia de compra" ou "Aprovar a estratégia de compra"), que a estratégia está aprovada sem pedido nem cotação aberta e que ela parou mesmo (`strategy_not_stopped`, "Só dá para encerrar a estratégia aprovada que parou").
- **Testes:** `tests/unit/strategy-packing.test.ts` ("Encerrar a estratégia parada": Comprador e Diretoria encerram, Vendas não, a encomenda aberta do lote volta para a fila, a cancelada segue cancelada, Auditoria, sem pendência; esperando aprovação não encerra) e a E2E `tests/e2e/purchase-strategy.spec.ts`, parte (e) (encomenda cancelada depois da aprovação, estratégia parada sem "Gerar pedido" e encerrada pela tela).

## Grade de estratégias (dono, 19/11/2026)

A tela mostra mais estratégias de uma vez, em cards pequenos. Os dados, as regras e as ações são os mesmos de antes.

- **Grade**: três colunas lado a lado ("Esperando estratégia" e "Em andamento"), com fundo branco, borda discreta e fonte menor. Em tela estreita, as três colunas continuam numa área com rolagem para os lados, e cada card tem uma largura mínima legível. A página rola para baixo quando os cards não cabem. Com a fila vazia, aparece só uma faixa baixa ("Nenhuma solicitação esperando estratégia"). "Envios recentes" fica depois da grade. O cabeçalho da página é mais baixo (`PageHeader dense`).
- **Card "Em andamento"**, nesta ordem:
  1. Estratégia nº e situação, com "Estratégia parada" quando a solicitação foi cancelada ou já está em outro pedido.
  2. Modalidade.
  3. Solicitação nº (link) e a situação dela.
  4. Cliente e as etiquetas (Encomenda, Cliente…).
  5. Produto.
  6. Peças | Cx master | Cx inner | m³ total. Embaixo de cada total, o que vai em cada caixa ("48 pç/cx", "0,12 m³/cx"). INNER sem cadastro aparece como "—".
  7. Programação (uma linha, ou "N programações").
  8. Última compra: fornecedor, preço un. e moeda (só com "Ver preço de compra"), pedido anterior e data, prazo de produção, Incoterm e pedido mínimo.
  9. Observação (duas linhas).
  10. Ações: Aprovar e Recusar, com a observação no próprio card; "Gerar pedido de compra", que abre o formulário de sempre num painel; "Detalhes".
- **Card da fila**: a solicitação e "Esperando estratégia", o cliente, País › Família, até dois produtos com a embalagem e a programação (os outros: "+N produtos (veja Detalhes)"), a última compra, a escolha e os destinatários (no próprio card) e "Detalhes".
- **Rótulos curtos**: a explicação aparece ao passar o mouse, ao tocar ou com o foco do teclado (`Tip`, `src/app/app/purchase-strategy/_components/strategy-card.tsx`).
- **Painel Detalhes** (`QuickDialog`): a embalagem completa (os seis números, a conta escrita e os avisos), a especificação, a entrega desejada, o prazo, a família, a programação inteira, a última compra completa, a observação inteira e, na estratégia parada, a explicação completa. Fechar o painel não muda filtros, escolhas nem a rolagem.
- **Encerrar estratégia** (seção anterior, #575): no card da estratégia aprovada que parou, com a observação opcional, a explicação e a confirmação.
- **Menu**: em Produto novo, a ordem é Encomendas, Reposição, Estratégia de compra e Cotação de compra (`FLOW_STEPS`, `src/lib/flow.ts`).

### Cards mais baixos (dono, 19/11/2026)

Para caberem três linhas de cards no Mac e no Full HD, o card de "Em andamento" ficou mais baixo. Os campos e as regras não mudam; só mudam de lugar:

- **Aprovar** continua no card, em um toque (a observação é opcional).
- **Recusar** abre uma caixa que pede o motivo, obrigatório como antes (`strategy_reject_note` no servidor).
- **Aprovar ou recusar com observação**: o formulário de sempre fica no painel Detalhes.
- **Encerrar estratégia** (estratégia aprovada que parou) abre uma caixa com a explicação e a observação opcional.
- **Última compra** em duas linhas (`LastLines`):
  - "Última compra: fornecedor · preço · Pedido #N · data";
  - embaixo, Prazo | Incoterm | Mín.
- **Uma linha só**, com o texto inteiro ao passar o mouse e no painel Detalhes: modalidade, programação, observação e aviso da parada (o selo diz "Parada").
- **Solicitação de um lote**: aparece uma vez (mesmo número e situação).
- **Produtos**: até dois por card; os outros ficam em "+N produtos (veja Detalhes)".
- **Fila**: os cards usam a mesma última compra em duas linhas.
- **Dicas dos rótulos curtos**: ficam dentro do próprio card, com até 10rem. A grade rola para os lados e cortaria o que sai dela; por isso nada em volta de uma dica pode cortar o texto (sem `truncate`).

## Abas, resumo por card e entrada direta (dono, 22/11/2026)

- **Pedido confirmado pelo cliente segue direto**: na venda pela Wellmix, a confirmação do cliente já põe a encomenda na fila da Estratégia de Compra, sem o "Enviar para cotação" da Wellmix. A confirmação grava `requests.strategySentAt` (com a Auditoria `purchase_strategy.send_request`) e avisa quem escolhe a estratégia (`enterStrategyOnConfirm`). A regra da fila (`inStrategyQueue`) também aceita a confirmação gravada (`orderTerms.confirmation`), então as confirmadas antes desta mudança entram sem ninguém reenviar. A encomenda aberta pelo próprio cliente (sem confirmação) continua com o "Enviar para cotação" em Encomendas.
- **Uma aba por estágio** (`/app/purchase-strategy?tab=`): **Esperando estratégia** (`waiting`, a fila), **Em andamento** (`open`, as estratégias esperando aprovação ou pedido) e **Enviadas** (`sent`), cada uma com a contagem. Sem `tab`, abre a fila; depois de escolher ou decidir, abre "Em andamento". Os endereços antigos `#decision-<id>` sem a aba são levados para "Em andamento" (`_components/hash-tab.tsx`).
- **Enviadas**: uma linha por cotação de cada envio (os 30 envios mais recentes). A linha abre a **cotação de fato** (`/app/purchase-quotes/<id>`); o pedido direto abre a estratégia em "Em andamento"; a que não saiu abre o resultado do envio. A coluna "Envio" continua levando ao resultado por destinatário (`/app/purchase-strategy/sends/<id>`).
- **Resumo do envio por card**: cada solicitação com uma escolha mostra o seu "Resumo do envio" logo abaixo do próprio card, na mesma largura (quem recebe, quem fica de fora e o problema, se houver). A barra fixa do rodapé ficou só com "Revisar o envio", a observação e "Confirmar o envio".
- Prática para as próximas telas: estágios diferentes de um mesmo fluxo ficam em abas, não empilhados na mesma tela.

## Ficha técnica na cotação (dono, 20/11/2026)

Pedido do dono: o fornecedor que nunca negociou o produto informa a ficha técnica na cotação e o que já negociou confere e ratifica o que temos, uma vez só, com o aviso de que o portal novo está revalidando o cadastro. Decisões do dono ("1 a 6 recomendado"; depois "Sankhya fora", "porto sempre", "Sem código", "regra nova só na foto da balança", "dados da empresa ficam como estão"):

| #   | Decisão                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Foto na balança**: pedida na cotação, não exigida; exigida da vencedora na ficha de compra, sem aceitar a do cadastro que é de outro fornecedor.                                                              |
| 2   | **Ficha técnica obrigatória na cotação**, na primeira vez do par produto × fornecedor.                                                                                                                          |
| 3   | **A ratificação fica dentro da cotação**, só dos produtos cotados.                                                                                                                                              |
| 4   | **A correção passa pelo Cadastro** e **não muda o cadastro do produto nem o Sankhya** (o cadastro acompanha o Sankhya, a carga o atualiza): fica na ficha do fornecedor, usada nas cotações e nos pedidos dele. |
| 5   | **O preço da última compra não aparece** para o fornecedor (o comparativo continua mostrando para a Wellmix).                                                                                                   |
| 6   | **Os dados da empresa** (endereço, contatos, banco) ficam como estão: sem revalidação nesta entrega.                                                                                                            |
| 7   | **Comercial obrigatório em toda cotação**: preço, moeda, incoterm, prazo de produção, pedido mínimo e porto (também no EXW).                                                                                    |
| 8   | **Peso bruto da caixa master** (o que o fornecedor tem na caixa e no packing list); peso líquido por peça. A ficha de compra guarda o bruto por peça (caixa ÷ peças).                                           |

- **A ficha técnica** (`supplier_product_sheets`, uma linha por par; regras puras em `src/lib/supplier-sheet.ts`, serviço em `src/lib/services/supplier-sheets.ts`): peças por caixa master; peças por inner ou **"Sem inner"** (0); medidas da caixa master ou o CBM dela (o das medidas sem arredondar); peso líquido por peça; peso bruto da caixa master; material; código do item na fábrica ou **"Sem código"**. Avisos que não impedem o envio: medidas e CBM que não batem (tolerância de CBM das Configurações), inner maior que a master ou que não fecha a master, caixa mais leve que as peças dentro dela.
- **Quem nunca vendeu** (sem pedido de compra não cancelado com o produto e sem o vínculo do Sankhya com última compra): a ficha vem em branco e a cotação deixa de mostrar a nossa caixa (as caixas saem da caixa dele: "Pela sua caixa: N caixas master · X m³", uma conta por programação). Grava como **informada**.
- **Quem já vendeu**: a ficha vem com o que temos (a ficha do último pedido dele com o produto, senão a ficha mestre, senão o cadastro; a caixa vem inteira de uma fonte só, a regra "CBM só da mesma caixa"; o código da fábrica só o dele). O aviso de revalidação aparece no topo, o campo que ele muda fica marcado com "Cadastro: X" e **"Confirmo os dados deste produto"** é obrigatório. Sem mudar nada, grava como **confirmada**; com mudança, **corrigida** e vai para o Cadastro. Arredondamento do que mostramos (até 0,5%), medidas em outra ordem e campo que estava vazio não são correção.
- **Uma vez por par**: confirmada ou informada, a ficha não é pedida de novo; nas próximas cotações aparece "Ficha técnica confirmada em dd/mm/aaaa" e só o comercial. Enquanto o prazo corre, ele corrige a ficha que mandou na mesma cotação. Recusada pelo Cadastro, volta a ser pedida (com o motivo).
- **Foto na balança** (opcional na cotação): sobe na hora, sem apagar o que foi digitado (`addQuoteScalePhotoAction`, documento sem pedido: só a Wellmix e quem enviou abrem). Para quem já vendeu, só é pedida onde o produto não tem foto na balança no cadastro.
- **Comparativo** (`/app/purchase-quotes/[id]`, "Ficha técnica das respostas"): por fornecedor e produto, a ficha (informada, confirmada, corrigida ou confirmada antes), peças por master, inner, medidas, CBM, pesos, material, código, **caixas master e m³ total pela caixa dele**, a foto e os avisos em relação ao cadastro com a tolerância da inspeção (peso, medidas, CBM; outra quantidade por caixa sempre avisa). Sem preço: vale para quem não tem "Ver preço de compra".
  - **Linha fina** (dono, 21/11/2026, com a foto do iPad): letra menor (12 px; cabeçalho 10 px) e nenhum texto quebra a linha, nem os títulos das colunas. Fornecedor, produto, material, código e avisos ficam numa linha só, cortados com "…" e com o **"mais"** ao lado (o "menos" volta; o texto inteiro também na dica do mouse). Ao abrir, a coluna mantém a largura. A foto fica em 24 px e amplia ao passar o mouse; o toque abre a foto. Componente `ClampText` com `lines={1}` (`src/components/clamp-text.tsx`); Encomendas segue com duas linhas.
- **A vencedora**: a Solicitação ao fornecedor nasce com a caixa master, o inner, o CBM, os pesos, o material e o código que ela informou (as medidas da solicitação são do produto e não recebem as da caixa).
- **Revisão do Cadastro** (`/app/supplier-sheets` e `/app/supplier-sheets/[id]`, tela Produtos; fora do menu, pelas Pendências e pelo comparativo): o nosso cadastro ao lado do informado, campo a campo ("Mudou", "Preencheu"), a foto e **Aceitar** ou **Recusar** (motivo obrigatório; o fornecedor é avisado na língua dele). Ação nova **"Revisar a ficha técnica do fornecedor"** (`supplierSheet.review`), padrão da função Cadastro (`catalog`); pendência `supplier_sheet_review` (Cadastros → Produtos). Nada muda no cadastro do produto nem no Sankhya.
- **Ficha de compra do pedido**: a foto na balança do cadastro só vale para quem já vendeu o produto (fora este pedido), para o fornecedor principal (o de referência da ficha mestre) ou quando foi ele que a enviou; a que ele mandou na cotação vale e aparece na ficha ("Foto na balança enviada na cotação"). As outras 4 fotos seguem como antes. O rascunho da ficha nasce da ficha técnica dele (`sheet.prefilled.supplier`), antes da ficha mestre e do cadastro; a ficha do último pedido dele só manda se for mais nova. **Pedido direto**: a ficha de compra salva completa pelo fornecedor, com o inner e o código, vale como a ficha técnica do par (mesmo aviso). A ficha de compra continua completando o cadastro com o que falta, como antes.
- **Esquema (aditivo)**: tabela `supplier_product_sheets` (índice único produto × fornecedor) e `purchase_quote_responses.items` (JSON). Nenhuma cotação de compra nem ficha de compra existia em produção: nada a migrar.
- **Dependência**: em 20/11/2026, nenhum dos 78 fornecedores com compra (15.971 pares produto × fornecedor nos produtos ativos) tinha login no portal; sem login a cotação não chega (a Estratégia mostra "sem login ativo"), e a revalidação começa com os logins.
- **Testes**: `tests/unit/supplier-sheet.test.ts` (o que falta, avisos, o que mudou, comparativo, a caixa de uma fonte só, caixas por programação; comercial obrigatório; quem nunca vendeu e a próxima cotação; quem já vendeu, correção recusada e depois confirmada, sem mudar o cadastro; aceitar; pedido direto; a foto da balança no pedido; a vencedora na Solicitação ao fornecedor) e as E2E `tests/e2e/purchase-quote.spec.ts` (a ficha no envio, o que falta, as caixas pela caixa dele no comparativo, a lista e a ficha do Cadastro) e `tests/e2e/purchase-strategy.spec.ts` (o aviso de revalidação para o fornecedor da última compra).

## Login do parceiro na Estratégia (dono, 20/11/2026)

Pedido do dono (20/11/2026, com o print da Estratégia de compra): no "Sem login ativo" da lista de parceiros, o "Abrir o cadastro" levava ao cadastro para gerar o acesso. O pedido é gerar o acesso ali mesmo.

- **Quem**: só o administrador (gerar login é dele; docs/EQUIPE_ACESSOS.md, R5). Para os outros, a linha fica como era, com o "Abrir o cadastro".
- **Como**:
  - embaixo do aviso, "Gerar o login aqui" abre um formulário curto, já preenchido;
  - **login**: o e-mail do cadastro, se ainda não é login de ninguém, ou um nome de usuário pelo nome do parceiro;
  - **nome**: o contato do cadastro, ou o nome do parceiro;
  - **senha provisória**: sugerida; o parceiro troca no 1º acesso;
  - **idioma**: China em chinês, Brasil em português, os outros em inglês;
  - **papel**: o do tipo do parceiro (`loginRoleOfParty`, a mesma regra do cadastro).
- **Depois de criar**:
  - a linha mostra o login e a senha para passar ao parceiro, com "Copiar login e senha";
  - a tela confere o parceiro de novo (`/api/purchase-strategy/recipient`): ele vira Apto e fica marcado nos produtos em que é da família ou foi escolhido na busca;
  - as escolhas da tela continuam (nada é recarregado).
- **Recusas com o motivo**: login já usado ou inválido, senha curta, tipo de parceiro sem login.
- **Peças**:
  - `partnerLoginSuggestion` e `createPartnerLogin` (`src/lib/services/partner-login.ts`);
  - as ações em `src/app/app/actions/partner-login.ts`;
  - o formulário `PartnerLoginFix` (`src/components/partner-login-fix.tsx`);
  - a lista (`strategy-queue.tsx`) e os textos `partnerLogin.*`.
- **Testes**:
  - `tests/unit/partner-login.test.ts`: a sugestão, a criação com o papel e a troca no 1º acesso, o parceiro Apto e as recusas;
  - `tests/e2e/strategy-partner-login.spec.ts`: um fornecedor novo sem login, gerar o login na Estratégia, o login e a senha na tela, o parceiro Apto e marcado.

## Moeda e preço na cotação (dono, 20/11/2026)

Pedido do dono (20/11/2026, com o print da resposta da cotação de compra no iPad): o preço unitário tem de aceitar RMB ou Dólar, com RMB fixado como padrão; o campo segue o símbolo da moeda escolhida e a vírgula das casas entra sozinha (a pessoa digita 4000 e o campo mostra 40,00), com vírgula ou ponto conforme a moeda.

- **Moeda ao lado do preço**:
  - o seletor fica junto do preço unitário de cada item, na ordem pedida pelo dono: RMB (selecionado quando o fornecedor ainda não respondeu), Dólar, Euro e Real (as quatro que já existiam);
  - a moeda é uma só por resposta, para todos os itens (o quadro compara por resposta); com mais de um item, trocar num item troca em todos, e o aviso embaixo diz isso;
  - o seletor "Moeda" das condições comerciais (embaixo) saiu: o campo continua o mesmo (`currency` da resposta), só mudou de lugar.
- **Digitação do preço (caixa registradora)**:
  - só números; a cada número a vírgula se ajusta (4 → 0.04, 40 → 0.40, 400 → 4.00, 4000 → 40.00), e apagar tira o último número;
  - separador da moeda: Yuan e Dólar com ponto decimal (¥ 1,234.56, US$ 1,234.56); Real e Euro com vírgula (R$ 1.234,56, € 1.234,56); trocar a moeda refazia o texto com o mesmo número (desde 21/11/2026 converte o valor pelo câmbio do dia, com "Manter os valores digitados" para o mesmo número; ver "Conversão ao trocar a moeda");
  - duas casas decimais; até 999.999.999,99;
  - colar um número no campo vale como está escrito ("40,50", "US$ 1,234.56", "4000" = quatro mil);
  - embaixo do campo, o exemplo na moeda escolhida: "Digite só os números: 4000 vira 40.00".
- **O que vai ao servidor**: o número com ponto ("40.00"), lido pela mesma regra de antes; a ação e o serviço não mudaram.
- **Peças**:
  - a regra pura em `src/lib/money-mask.ts`;
  - o modo `autoDecimal` do `MoneyInput` (`src/components/money-input.tsx`): desligado, o campo de dinheiro das outras telas segue igual;
  - a tela em `quote-answer-form.tsx` e os textos `quote.priceHint` e `quote.currencyAll`.
- **Testes**:
  - `tests/unit/money-mask.test.ts`: a digitação número a número, apagar, os separadores por moeda, o valor lido pelo servidor, o preço gravado de volta no campo, o texto colado e o limite;
  - `tests/e2e/purchase-quote.spec.ts`: RMB e ¥ por padrão, 210 digitado vira 2.10, a troca para Real e para Dólar converte (21/11/2026) e o "Manter" mostra o mesmo número com vírgula no Real e ponto no Dólar, e a moeda de cada fornecedor no quadro da Wellmix.
- **Para depois** (não pedido): as mesmas casas automáticas nos outros campos de preço do portal (é ligar `autoDecimal`) e três casas para itens muito baratos (US$ 0,085), se aparecer.

## Conversão ao trocar a moeda (dono, 21/11/2026)

Pedido do dono (21/11/2026, com o vídeo da ficha do produto no iPad): no quadro "Fornecedor e negociação", trocar a moeda de Dólar para Yuan ou Real mudava só o símbolo (US$ 1,0194 virava ¥ 1,0194). Os campos com valor, inclusive os já preenchidos, têm de converter a moeda e o valor na hora.

- **Regra**: trocar a moeda de um campo de valor converte o número pelo câmbio do dia do portal, passando pelo Real, e arredonda às casas do campo (4 no preço do produto e na negociação, 2 na cotação). É o mesmo câmbio do preço ao cliente: PTAX de venda do Banco Central, as fontes de reserva, o último obtido ou o câmbio manual das Configurações.
- **Aviso** embaixo do campo: "Convertido de US$ 1,0194 · câmbio de 21/11/2026" e o botão **"Manter R$ 1,0194"**, que volta ao número de antes na moeda nova (para quando a moeda estava errada e o número certo). Digitar no campo tira o aviso. Sem câmbio de uma das moedas, o valor fica igual e o aviso diz isso: nunca um número inventado.
- **Onde vale**:
  - todo campo de dinheiro com seletor de moeda (`MoneyInput` com seletor próprio ou seguido): ficha do produto, ficha de compra, sourcing, kit de marketing, frete, custos e pagamentos do pedido, venda ao cliente e o frete por m³ das Configurações;
  - a resposta da cotação de compra: a moeda é uma por resposta, então trocar converte o preço de todos os itens, com "Manter os valores digitados";
  - a negociação com o fornecedor: a contraproposta da Wellmix, a resposta do fornecedor e a resposta pela tabela de fornecedores.
- **Só a troca feita pela pessoa converte**: a moeda posta pelo portal (valor inicial, rascunho restaurado) não mexe no número.
- **Câmbio no navegador**: `/api/fx` (só com login) devolve o câmbio e os textos do aviso no idioma de quem usa. É uma busca por página, feita quando o seletor de moeda ganha o foco, para a conversão sair na hora.
- **Peças**:
  - `src/lib/fx-convert.ts`: a conta e o texto do aviso;
  - `src/components/fx-conversion.tsx`: câmbio, aviso e "Manter";
  - `src/components/fx-field-watch.tsx`: formulários de campo simples (a oferta da negociação);
  - `FormDraftGuard` marca o formulário enquanto devolve um rascunho (`data-draft-restoring`): a moeda que volta não converte;
  - `src/app/api/fx/route.ts`, o `MoneyInput`, `quote-answer-form.tsx`, `proposal-fields.tsx` e os textos `moneyFx.*`.
- **Testes**: `tests/unit/fx-convert.test.ts`, `tests/e2e/currency-conversion.spec.ts` (ficha do produto: Dólar → Real, "Manter", Real → Yuan e o aviso que sai ao digitar) e `tests/e2e/purchase-quote.spec.ts` (a resposta da cotação: RMB → Real → Dólar convertendo, com "Manter os valores digitados").
- **Para depois**: os outros campos de preço em texto simples ao lado de uma moeda (ex.: o lote do pedido) convertem quando migrarem para o `MoneyInput` ou ganharem o `FxFieldWatch`.

## Rascunho automático da cotação (dono, 20/11/2026)

Pedido do dono (20/11/2026, com dois prints do iPad): o fornecedor preencheu a ficha técnica, enviou a foto na balança e tudo o que estava digitado sumiu. O pedido é salvar sozinho, para não perder nada do que foi digitado.

- **A causa**: às 23h24 (Brasília), no mesmo minuto da foto, entrou no ar uma versão nova do portal (o PR #608, de outra sessão). A foto foi gravada, mas a resposta veio da versão nova. Quando a versão muda, o Next.js recarrega a página inteira, e o que estava só na tela (preço, ficha, condições ainda não enviados) se perdeu. Fora isso, a foto não apaga nada (conferido com o teste local). O mesmo pode acontecer com o iPad recarregando a aba, com a conexão caindo ou com a aba fechada.
- **Como ficou**:
  - a cada pausa da digitação (0,7 s), tudo o que está na tela vai para o servidor, por login: preço e moeda de cada item, a ficha técnica (números, material, código, "Sem inner", "Sem código" e "Confirmo") e as condições (incoterm, prazo, porto, mínimo e observação);
  - a página aberta de novo traz tudo de volta, com o aviso "Recuperamos o que você tinha digitado (salvo automaticamente)…";
  - antes de a foto subir, o rascunho é salvo na hora;
  - ao lado dos botões, a situação: "Tudo o que você digita é salvo automaticamente", "Salvando o rascunho…", "Rascunho salvo às 23:24" (a hora do aparelho) ou o aviso de falha (tenta de novo na próxima alteração);
  - enviar ou recusar a cotação apaga o rascunho; com o prazo vencido ou a cotação fechada, nada é salvo.
- **Onde fica**: na tabela `form_drafts` (a mesma do rascunho do Novo parceiro; sem mudança de esquema), com a chave `quote:<cotação>`, um por login e cotação; cada login só lê o próprio, e só o fornecedor convidado grava. O rascunho guarda os campos pelo nome do formulário, só texto, e só os desta cotação.
- **Peças**:
  - o serviço `src/lib/services/quote-draft.ts` (`cleanQuoteDraft`, `loadQuoteDraft`, `saveQuoteDraft` e `clearQuoteDraft`, este chamado pelo `answerQuote`);
  - a ação `saveQuoteDraftAction` (`src/app/app/actions/purchase-demand.ts`);
  - o `useDraftAutosave` e a volta do rascunho em `quote-answer-form.tsx`;
  - os textos `quote.draft.*`.
- **Testes**:
  - `tests/unit/quote-draft.test.ts`: só os campos desta cotação, salvar e recuperar, um rascunho por login e cotação, quem não foi convidado não salva nem lê, prazo vencido não salva e enviar a resposta apaga;
  - `tests/e2e/purchase-quote.spec.ts`: o fornecedor A digita, espera "salvo", recarrega a página e encontra o preço, a ficha e a moeda de volta.
- **Sugestão para o dono (não feito)**: ligar a proteção de versão da Vercel ("Skew Protection", em Settings → Advanced do projeto). Com ela, quem está com a página aberta continua falando com a versão em que abriu, e nenhuma tela de nenhum formulário recarrega quando sai uma versão nova. Vale para o portal todo, não só para a cotação. É uma configuração do projeto na Vercel e pode depender do plano.

## Card da cotação mais enxuto (dono, 21/11/2026)

Pedido do dono (21/11/2026, com o print do iPad): o card da resposta da cotação tinha muito espaço aberto; caixas de digitação menores, mais minimalista e bonito.

- **Ficha técnica em quatro linhas**, com o nome da linha à esquerda e os campos lado a lado, cada um do tamanho do número e com a unidade dentro da caixa:
  - **Peças por caixa**: master e inner (pçs), com "Sem inner";
  - **Caixa master**: C × L × A (cm) ou o CBM (m³), com "Pelas medidas: … m³" embaixo;
  - **Peso**: líquido por peça e bruto da caixa (kg);
  - **Material e código**: material, código na fábrica e "Sem código".
- O texto de ajuda da ficha fica na mesma linha do título. O nome completo de cada campo continua para o leitor de tela e aparece ao passar o mouse.
- **Condições comerciais numa linha**: incoterm, prazo de produção (com "dias" dentro), porto e pedido mínimo, cada um do tamanho do que se digita; a observação logo abaixo.
- **Letra dos campos** de 13 px também no iPad, como na Estratégia de compra (`data-compact-fields`); no iPhone segue 16 px para o Safari não dar zoom.
- **O que não muda**: os nomes dos campos do formulário, as regras (o que falta, os avisos, o rascunho automático) e os testes (`data-sheet-field`).

## Correção da resposta até o prazo (dono, 21/11/2026)

Pergunta do dono, com o print da cotação nº 1 em produção: "Como assim dá para alterar enquanto o prazo não acabar? Qual prazo?". O prazo é o da resposta de cada fornecedor (`purchaseQuoteHours`, padrão 24 h a partir do convite; o "Vence em" do topo, em Brasília e na China). Decisão do dono: **opção 1**, manter a correção com o texto claro e a tela travada no prazo.

- **Regra única** (`quoteEditable` em `src/lib/services/purchase-quote.ts`): o fornecedor envia e corrige enquanto a cotação está aberta e o prazo dele corre. A escolha da vencedora (ou o cancelamento) trava antes do prazo. O servidor já recusava fora disso (`quote_closed`, `quote_expired`), também na foto e no rascunho automático.
- **O aviso depois do envio** diz até quando: "Cotação enviada. Você pode corrigir até 21/11, 23:12 (Brasília) · 22/11, 10:12 (China), enquanto a Wellmix não escolher a vencedora." Na recusa, o mesmo prazo para mudar de ideia. Os horários saem de `dueTimes` (`src/app/app/purchase-quotes/_time.tsx`), o mesmo do "Vence em".
- **Tela travada** (o defeito corrigido: depois do prazo, quem já tinha respondido ainda via o formulário e só no envio recebia "O prazo para responder acabou"): passado o prazo, ou escolhida a vencedora, o formulário sai e fica a resposta enviada, só leitura (`QuoteAnswerSummary`): o motivo da trava, o preço de cada produto, a ficha técnica, a foto na balança e as condições (moeda, incoterm, prazo de produção, porto, pedido mínimo e observação). Sem resposta, "Você não respondeu esta cotação"; recusada, "Você recusou esta cotação".
- **A regra do peso bruto** (caixa mais leve que as peças) continua só como aviso.
- **Testes**: `tests/unit/purchase-quote.test.ts` (a regra: aberta e no prazo, no limite exato, vencedora escolhida e cancelada; a resposta trocada no prazo e recusada depois) e `tests/e2e/purchase-quote.spec.ts` (o aviso com a hora de Brasília depois do envio; passado o prazo, o fornecedor A vê a resposta enviada, com o preço, e nenhum formulário).

## Inner do cliente, material do catálogo e Sem peso (dono, 21/11/2026)

Pedido do dono, com o desenho da tela: o inner só quando o cliente pede, o aviso de atualização da ficha, "Sem peso" no peso bruto, o material escolhido num catálogo e a tela em duas colunas. Antes de codificar, o levantamento mostrou duas coisas que não existiam: nenhum campo registrava "o cliente pediu inner" (o inner da cotação vinha do cadastro do produto, a ficha antiga) e não havia catálogo de materiais (o campo Material do cadastro estava vazio nos 16.841 produtos; a "Composição:" do Sankhya está em 8.019 produtos ativos, com 654 textos e ~255 grafias). Decisões do dono: **1A** (campo na Nova solicitação e a exigência travada na cotação), **2A** (cadastro de Materiais com a carga inicial pela Composição, seleção múltipla) e **3** (a lista entra direto e o Cadastro ajusta).

- **Caixa inner exigida pelo cliente** (Nova solicitação de Encomendas, TS e Venda, em cada produto; `src/components/request-inner-field.tsx`): "Não" por padrão, "Sim" com as peças por inner obrigatórias (`inner_qty_required`). O inner do cadastro aparece só como dica ("Cadastro do produto: 12 por inner (não marca sozinho)"). Grava em `requests.innerRequirement` (`{ qty }`; nulo = não pediu); rascunho e "Editar a encomenda" voltam com ele. A embalagem da encomenda (inner, caixas inner) usa a exigência do cliente antes de tudo (`request-packing.ts`).
- **Na cotação** (`PurchaseQuoteItem.inner`, `src/lib/quote-inner.ts`): a exigência vem das demandas do produto. Ninguém pediu: o fornecedor não vê nada de inner (nem "Sem inner", nem aviso). Todas pediram o mesmo número: "Peças por inner: 24 · Exigência do cliente", travado, numa linha própria; se ele não atende, explica na observação e a negociação segue na Solicitação ao fornecedor (contraproposta e mensagem), sem trocar a exigência. Pedida sem número, ou diferente entre as demandas (uma pediu 24 e outra 12, ou uma pediu e outra não): a Wellmix define na cotação ("Caixa inner a definir", ação do Comprador `purchaseQuote.choose`; "Definir o inner" ou "Não exigir inner"; `setQuoteItemInner`, auditado) e ganha a pendência `purchase_quote_inner`; o fornecedor vê "a Wellmix vai confirmar a quantidade" e o envio não trava. Nada é inventado. A Estratégia leva uma encomenda só e a encomenda não repete produto, então o caso de exigências diferentes quase não acontece; fica para dado antigo ou importado.
- **A ficha técnica do par não pergunta mais o inner** (`SupplierSheetData.innerBoxQty` nulo = não perguntado; as fichas antigas ficam como estão). A resposta guarda a exigência que ele viu (`QuoteResponseItem.innerRequired`), o comparativo mostra o inner exigido e a vencedora leva para a Solicitação ao fornecedor o inner do cliente (nas fichas antigas, o que ele informava). O aviso "inner que não fecha a master" agora compara o inner exigido com a caixa dele. Na ficha de compra do pedido direto, o inner deixou de ser condição para valer como a ficha do par (só o código do item na fábrica).
- **Aviso "Atualização da ficha do produto"**, no lugar da "Revalidação do cadastro": "Nesta cotação, solicitamos novamente os dados técnicos para atualizar as informações dos produtos da Wellmix. Informe os dados do produto e da embalagem que serão fornecidos." Letra pequena, no alto da coluna do preenchimento, sempre que a ficha é pedida. O processo de validação e de revisão do Cadastro não muda (nada vai para o cadastro do produto nem para o Sankhya sem as verificações de sempre).
- **"Sem peso"** ao lado do peso bruto da caixa master ("Marque se você não sabe informar o peso bruto."): começa desmarcado; marcado, o campo trava, mostra "Peso bruto não informado" e o envio sai sem o bruto; desmarcado, o número digitado volta (fica no rascunho). Grava `grossWeightBoxKg` nulo com `grossWeightUnknown` verdadeiro, nunca zero (informado, em branco e "Sem peso" são três coisas). A Wellmix vê "Sem peso (declarado)" no comparativo, no resumo travado e na revisão do Cadastro; para quem já vendeu, "Sem peso" com o nosso peso vira correção (ele não confirma o que temos). A Solicitação ao fornecedor nasce sem o bruto, e a ficha de compra continua exigindo o peso no pedido. O peso líquido por peça continua obrigatório.
- **Material do catálogo** (Cadastros → Materiais, `/app/materials`, tela Produtos; tabela `materials` com nome em pt, en e zh e ativo; `src/lib/materials.ts` e `src/lib/services/materials.ts`): a carga inicial (64 materiais, ids fixos como `mat-vidro`) é a Composição unificada (as grafias diferentes viram apelidos) e entra sozinha quando o catálogo está vazio. Quem tem **"Manter o catálogo de materiais"** (`materials.manage`, padrão Cadastro) inclui, renomeia, desativa e reativa; nada é apagado, e o desativado sai da escolha mas continua com o nome nas fichas que o citam. Na cotação, o material é um seletor com busca (em qualquer um dos três idiomas), seleção múltipla e sem texto livre; sem a opção certa, a lista orienta a falar com a Wellmix pela conversa da cotação. O servidor aceita só ids ativos (`material_not_in_catalog`); a ficha grava os ids (`materialIds`) e os nomes em português ("Plástico / Papel"). Fichas antigas, de texto livre (ou com material desativado), aparecem em "Fichas com material fora do catálogo" na tela de Materiais e marcadas "fora do catálogo, revisar" no comparativo e na revisão; o rascunho com material digitado mostra "Material digitado antes: X. Escolha no catálogo.". A ficha de compra (texto) vira os materiais do catálogo quando todas as partes batem; senão fica o texto, para revisar.
- **Tela em duas colunas** (`quote-answer-form.tsx`, `material-picker.tsx`): à esquerda, um terço com o produto, a quantidade, a especificação e as programações, uma por linha; à direita, o aviso, o preço e a moeda lado a lado e a ficha em linhas (peças por master, código na fábrica com "Sem código" e material; comprimento, largura e altura em cm e o CBM em m³; peso líquido por peça e peso bruto da caixa master com "Sem peso"); a foto na balança; embaixo, os termos comerciais (incoterm, prazo de produção, porto e pedido mínimo numa linha, a observação e o envio). Controles de 36 px, rótulos acima de cada campo; no celular, uma coluna só. O rascunho automático guarda os campos novos (`grossUnknown`, `materialIds`).
- **Esquema (aditivo)**: coluna `requests.innerRequirement` (JSON) e a tabela `materials` (índice único pelo nome). O resto fica no JSON que já existia (`purchase_quotes.items`, `purchase_quote_responses.items`, `supplier_product_sheets.data`).
- **Testes**: `tests/unit/quote-inner-materials.test.ts` (inner das demandas: ninguém, o mesmo, diferente, sem número; o que o fornecedor vê; "Sim" exige o número; a Composição vira o catálogo; a vencedora com o inner do cliente; a Wellmix define e a pendência some; material inventado ou desativado recusado no servidor; "Sem peso" grava nulo; o catálogo carregado uma vez, nome repetido, só o Cadastro), `tests/unit/supplier-sheet.test.ts` (as regras puras novas), `tests/unit/quote-draft.test.ts` (os campos novos no rascunho) e a E2E `tests/e2e/purchase-quote.spec.ts` (material pelo seletor; depois de recarregar, o material volta; "Sem peso" trava o campo e, desmarcado, o número volta).

## Cotação nas Pendências do fornecedor (dono, 21/11/2026)

Pergunta do dono (21/11/2026, print das Pendências do PETER): com o pedido em cotação, a barra "Etapas que chegam até você" não mostrava a cotação. A pendência aparecia na lista, mas nenhuma etapa acendia: a barra vai do Book à Invoice, e a cotação de compra ficava fora dela.

Decisão do dono: a cotação a responder acende a etapa **"Responder a solicitação"**, em amarelo ("A fazer, no prazo"), ou em vermelho quando atrasada. Ao tocar na etapa, a lista mostra a pendência da cotação, que abre a resposta.

- **Como ficou**:
  - a pendência da cotação (`purchase_quote_answer`) tem a etapa do fornecedor `request` (`supplier.request`): conta na etapa, na cor dela, e aparece no filtro dela; a coluna Etapa diz "Responder a solicitação";
  - "Com você desde" mostra a data do convite (antes "—");
  - título e detalhe no idioma de quem lê: "Cotação de compra nº N" (`quote.one`) e "produto · quantidade unidade", com "e mais N produto(s)" quando a cotação tem mais de um (`quote.task.answer.*`);
  - a ajuda da etapa "Responder a solicitação" cita a cotação ("Na cotação de compra, responda preço, moeda, ficha técnica e condições até o prazo").
- **O que não muda**: as etapas e a numeração da barra, o tipo da pendência, quem a recebe e o prazo.
- **Peças**: `quoteTaskDrafts` (`src/lib/services/purchase-quote.ts`) e os textos em `purchase-demand.ts` e `supplier-tasks.ts`.
- **Testes**:
  - `tests/unit/quote-supplier-step.test.ts`: etapa, "desde" do convite e textos em pt e zh;
  - `tests/e2e/purchase-quote.spec.ts`: o fornecedor C vê "Responder a solicitação" amarela com 1, toca e abre a cotação pela lista.

## Andamento

| PR  | Entrega                                                                                          | Situação |
| --- | ------------------------------------------------------------------------------------------------ | -------- |
| 1   | Mapa (MAPA_PROCESSO.md gerado do data.json), decisões e este documento                           | feito    |
| 2   | Demanda única: encomenda pelas 4 portas, divisão do carrinho, reposição manual, função Vendas    | feito    |
| 3   | Estratégia de compra, aprovação e pedido de compra direto                                        | feito    |
| 4   | Cotação de compra: fornecedor × linha, 24 h, isolamento, quadro comparativo                      | feito    |
| 5   | Limpeza dos restos da RFQ                                                                        | feito    |
| 6   | Estratégia de Compra por produto: envio pela Encomenda, destinatários, resultado e reenvio       | feito    |
| 7   | Estratégia por solicitação: uma escolha para todos os produtos, lista do País × Família          | feito    |
| 8   | Embalagem e cubagem na Estratégia; estratégia parada por encomenda cancelada                     | feito    |
| 9   | Encerrar a estratégia parada (Comprador e Diretoria; as abertas voltam para a fila)              | feito    |
| 10  | Grade de estratégias: três colunas de cards compactos, Detalhes e Gerar pedido em painel         | feito    |
| 11  | Ficha técnica na cotação: quem nunca vendeu informa, quem já vendeu ratifica uma vez; Cadastro   | feito    |
| 12  | Correção da resposta até o prazo: aviso com a hora exata e a tela travada com a resposta enviada | feito    |
| 13  | Inner do cliente, material do catálogo, "Sem peso" e a cotação em duas colunas                   | feito    |
| 14  | Conversão ao trocar a moeda: campos de valor, cotação e negociação, com o aviso e o "Manter"     | feito    |
