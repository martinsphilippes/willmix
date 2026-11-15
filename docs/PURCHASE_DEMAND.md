# Compra por demanda: reposição, encomenda, estratégia e cotação

Desenho do dono de 15/11/2026 (mapa do processo, layout 15; docs/MAPA_PROCESSO.md). Reposição (B10) e Encomenda do cliente (B14) entram na mesma decisão, "Qual a estratégia de compra?" (B10?), que leva direto ao pedido de compra (P2) ou à Cotação de compra (B13), cuja vencedora vira a Solicitação ao fornecedor (B7). As decisões estão em docs/OPEN_DECISIONS.md.

Situação: **PR 1 de 5 (mapa e documentação)**. As seções abaixo descrevem o alvo; cada PR marca o que entregou em "Andamento".

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

## Andamento

| PR  | Entrega                                                                                       | Situação |
| --- | --------------------------------------------------------------------------------------------- | -------- |
| 1   | Mapa (MAPA_PROCESSO.md gerado do data.json), decisões e este documento                        | feito    |
| 2   | Demanda única: encomenda pelas 4 portas, divisão do carrinho, reposição manual, função Vendas | a fazer  |
| 3   | Estratégia de compra, aprovação e pedido de compra direto                                     | a fazer  |
| 4   | Cotação de compra: fornecedor × linha, 24 h, isolamento, quadro comparativo                   | a fazer  |
| 5   | Limpeza dos restos da RFQ                                                                     | a fazer  |
