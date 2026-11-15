# RFQ em espera (removido)

Decisão do dono (11/11/2026): a RFQ, a cotação do fornecedor (tabela `quotes`), a aprovação do pré-custo (`approvals`), o briefing de embalagem (`packaging_briefs`) e a proposta e o sinal do cliente saíram do portal. Em produção nenhuma dessas tabelas tinha dados.

O caminho de hoje é Booking → Seleção de itens → solicitação ao fornecedor → produto → pedido de compra (docs/BOOKING.md, docs/SUPPLIER_REQUESTS.md e docs/PURCHASE_ORDER.md). A arte é a raia da agência no pedido de compra.

O que ficou:

- A solicitação do cliente (vitrine, `requests`) continua como entrada de pedidos: é criada, listada (chat, NCM, exportação) e vira a pendência "Solicitação nova" da Wellmix, parada em "Solicitada" até seguir o processo das solicitações ao fornecedor.
- A cotação de frete com as companhias marítimas passa a ser pedida pelo pedido (docs/PURCHASE_ORDER.md, "Frete marítimo").
- O cartão do fabricante fica no produto (os já enviados continuam lá).
- A avaliação do fornecedor conta as respostas às solicitações ao fornecedor no lugar dos convites da cotação.

## Desde 15/11/2026: a cotação de compra (B13)

A cotação voltou com outro desenho, sem nada do modelo removido: a **Cotação de compra** do mapa (B13), aberta pelo sistema na estratégia "cotar entre fornecedores", com 24 h por fornecedor, quadro comparativo, escolha do Comprador e aprovação da Diretoria de compras (docs/PURCHASE_DEMAND.md). Tabelas `purchase_quotes` e `purchase_quote_responses`; a vencedora vira a Solicitação ao fornecedor.

- A solicitação do cliente virou a **Encomenda** (B14) e segue pela estratégia de compra (B10?), não fica mais parada em "Solicitada".
- Os status antigos da solicitação foram reaproveitados com o sentido novo: `RFQ_OPEN` = cotação de compra aberta, `QUOTATION_RECEIVED` (reservado), `SUPPLIER_SELECTED` = vencedora aprovada, `ORDERED` = pedido de compra.
- Restos limpos em 15/11/2026: os textos dos grupos `rfq`, `rfqStandby`, `quoteFlow`, `quoteSheet`, `quoteSent`, `quotes`, `spRfq` e `approvals` (menos `approvals.error.*`, ainda usado) e o rótulo da configuração `quotationExpirationDays`, que não existia mais. A chave de tela `quotes` continua (é a das Solicitações ao fornecedor, dos convites e agora das cotações de compra; renomear apagaria o que está gravado nas funções). As ações aposentadas (`approval.*`, `dumping.release`) continuam listadas em `RETIRED_ACTIONS`, sem efeito. `quoteSlaBusinessDays` continua: é o SLA de resposta da encomenda.
