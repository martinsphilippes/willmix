# Venda: decisão do cliente, ordem de venda e agenda de entrega

Mapa do processo, etapa Venda (V3, V4, V7 e V8). Os outros passos já
existiam: V1 aviso a vendas, V2 ofertas (Vendas → Ofertas e Amostras), V4
reservas (`/app/inventory/reservations`), V5/V6 vitrine e carrinho.
Decisões do dono em 14/11/2026.

## V3: decisão do cliente (vendas registra)

Em Vendas → Ofertas e Amostras, a lista das ofertas registradas ganhou a
coluna **Decisão do cliente**:

- **Fechou:** escolhe o cliente cadastrado e a quantidade. Abre a **ordem de
  venda** em rascunho, com o produto da oferta (na amostra, os itens do
  pedido de onde ela veio) e o pedido de compra de origem.
- **Não fechou:** o motivo é obrigatório. A oferta fica marcada e vendas
  ajusta e oferta de novo.
- Dados: em `sales_offers`, `decision` (`closed`/`declined`),
  `decisionNote`, `decidedAt`, `decidedByUserId` e `salesOrderId`.

## V7: ordem de venda (registro + Sankhya)

Tela `/app/sales-orders`: a lista, a agenda e "Nova ordem de venda" para um
cliente. A ordem fica em `/app/sales-orders/<id>`. Wellmix com a tela
Produtos.

- **Rascunho:** itens (produto, quantidade, preço unitário), condição de
  pagamento, moeda, nº do pedido de compra de onde vem a mercadoria (para a
  chegada), data e janela da entrega, observação.
- **Confirmar** exige itens com preço e a data da entrega. Ao confirmar:
  - **reserva (V4):** cada item reserva o que há livre no Brasil (reserva de
    30 dias na tela Reservas). O que ainda não chegou fica como **reserva na
    chegada**;
  - **Sankhya:** com a execução no Sankhya ligada e a **TOP de venda** em
    Configurações (`salesTop`), vai sozinho como pedido de venda (cliente e
    produtos precisam do código do Sankhya). Sem isso, fica **"a lançar"** e
    vendas informa o número do pedido de venda. Erro no envio fica
    registrado na ordem;
  - o **planner** recebe o aviso da entrega agendada (sem planner, os
    administradores).
- **Cancelar** (rascunho ou confirmada): as reservas voltam a ficar livres.
- Dados: tabela `sales_orders` (número, cliente, oferta, pedido de compra,
  itens com a reserva, moeda, condição, situação, entrega, Sankhya).

## V8: agendamento da entrega

Data e janela ficam na ordem. A **Agenda de entregas** em
`/app/sales-orders` lista as ordens confirmadas de hoje em diante.

Código: `src/lib/services/sales-orders.ts`, ações em
`src/app/app/actions/sales-orders.ts`. Teste: `tests/unit/sales-orders.test.ts`.

## Fica para depois

- Ligar a ordem de venda à baixa por venda (usar a reserva na entrega) e à
  programação do transporte até o cliente.
