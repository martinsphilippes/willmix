# Aprovação do pré-custo e funções da equipe (Fase A) (removido)

Decisão do dono (11/11/2026): a RFQ, a cotação do fornecedor (tabela `quotes`), a aprovação do pré-custo (`approvals`), o briefing de embalagem (`packaging_briefs`) e a proposta e o sinal do cliente saíram do portal. Em produção nenhuma dessas tabelas tinha dados.

O caminho de hoje é Booking → Seleção de itens → solicitação ao fornecedor → produto → pedido de compra (docs/BOOKING.md, docs/SUPPLIER_REQUESTS.md e docs/PURCHASE_ORDER.md). A arte é a raia da agência no pedido de compra.

O que ficou:

- A solicitação do cliente (vitrine, `requests`) continua como entrada de pedidos: é criada, listada (chat, NCM, exportação) e vira a pendência "Solicitação nova" da Wellmix, parada em "Solicitada" até seguir o processo das solicitações ao fornecedor.
- A cotação de frete com as companhias marítimas passa a ser pedida pelo pedido (docs/PURCHASE_ORDER.md, "Frete marítimo").
- O cartão do fabricante fica no produto (os já enviados continuam lá).
- A avaliação do fornecedor conta as respostas às solicitações ao fornecedor no lugar dos convites da cotação.
