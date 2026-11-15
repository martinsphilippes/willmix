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

## V6: pedido pela vitrine (15/11/2026)

Desenho do dono de 15/11/2026 (docs/PURCHASE_DEMAND.md). Antes, o carrinho virava só solicitações de orçamento. Agora, ao enviar:

- o item que o estoque livre no Brasil ou uma compra a caminho sem pedido (o mesmo saldo dos selos da vitrine, `availableStockByProduct`) atende **por inteiro** vira uma **ordem de venda em rascunho** (`openSalesOrderFromCart`), criada pelo próprio cliente, sem preço; Vendas é avisada (quem tem a ação "Lançar encomenda em nome do cliente"; ninguém, os administradores) e confirma o preço e a entrega, como em qualquer ordem (a reserva nasce na confirmação);
- o resto vira **encomenda** (origem `cart`, porta "vitrine"), que segue para a estratégia de compra (B10?);
- itens do mesmo produto consomem o mesmo saldo, na ordem do carrinho; sem saldo conhecido (o portal ainda não controla o estoque), o item vira encomenda;
- antes de confirmar, o carrinho mostra em cada item "Pronta entrega" ou "Encomenda" e o resumo das duas; depois, a tela diz o número da ordem de venda.
- "Solicitar agora" na página do produto segue a mesma regra, para aquele produto.

## V8: agendamento da entrega

Data e janela ficam na ordem. A **Agenda de entregas** em
`/app/sales-orders` lista as ordens confirmadas ou expedidas (ainda não
entregues) de hoje em diante.

Código: `src/lib/services/sales-orders.ts`, ações em
`src/app/app/actions/sales-orders.ts`. Teste: `tests/unit/sales-orders.test.ts`.

## NF de venda, expedição (baixa) e entrega ao cliente

Decisões do dono (15/11/2026):

1. **NF de venda antes da expedição.** Ao confirmar a ordem, o financeiro
   (função "finance"; sem ninguém, os administradores) é avisado. Ele emite a
   NF no Sankhya e registra na ordem o número e, se quiser, o arquivo. Quem
   registra: a tela Financeiro aberta ou o administrador. Sem a NF a ordem não
   expede (`invoice_required`).
2. **Baixa na expedição.** "Expedir e dar baixa no estoque" grava a
   transportadora cadastrada (ou "o cliente retira"), a data de saída e o frete
   (R$). A ordem fica **Expedida** e cada linha sai do estoque no Brasil:
   - a reserva viva da ordem vira baixa por venda (reserva "usada");
   - a linha sem reserva viva (na chegada ou com a reserva vencida) sai do
     estoque livre. Antes de gravar qualquer baixa, o sistema confere se o
     livre basta para todas as linhas (`stock_insufficient`).

   Toda baixa é um `stock_movements` do tipo `sale_out` com `salesOrderId`.
   Expedida, a ordem não cancela mais.

3. **Entrega.** "Confirmar a entrega" pede a data, quem recebeu e o
   comprovante (canhoto). A ordem fica **Entregue**.

| Dado        | Onde                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| NF de venda | `sales_orders.invoiceNumber`, `invoiceDocumentId`, `invoicedAt`, `invoicedByUserId` |
| Expedição   | `carrierId`, `customerPickup`, `freightValue`, `shippedAt`, `shippedByUserId`       |
| Entrega     | `deliveredAt`, `receivedBy`, `proofDocumentId`, `deliveredByUserId`                 |
| Baixa       | `stock_movements.salesOrderId`                                                      |

Os arquivos (NF e comprovante) são documentos internos da Wellmix.

## Devolução de venda

Decisões do dono (15/11/2026):

1. **Parcial por item.** Numa ordem expedida ou entregue, vendas registra a
   quantidade devolvida de cada produto e o motivo, no bloco "Devoluções" da
   ordem. Pode haver mais de uma devolução até devolver tudo: o limite é o
   expedido menos o já devolvido (as canceladas não contam). O financeiro é
   avisado.
2. **NF de devolução.** O financeiro registra o número e, se quiser, o
   arquivo da NF de devolução emitida no Sankhya. Sem ela a devolução não
   fecha.
3. **A qualidade confere.** Quem tem a ação "Conferir a qualidade"
   (`receiving.quality`; sem ninguém marcado, qualquer login da Wellmix)
   informa por produto quanto está bom. O bom volta ao estoque livre no
   Brasil, como movimentação `return_in` ligada à ordem. O resto fica como
   perda na própria devolução, com o motivo obrigatório. A mercadoria já
   tinha saído na expedição, por isso a perda não gera nova baixa.

Uma devolução aberta pode ser cancelada por vendas. Dados em `sales_returns`
(itens com `goodQty` e `lossQty`, motivo, NF, conferência).

## Frete da venda no Financeiro

Na expedição com transportadora, o frete (R$) vira conta a pagar. Ela vence na
data de saída mais o "Prazo do frete (dias)", que por padrão é 0. Quando o
cliente retira, não há frete. Em **Contas a pagar**, o bloco "Fretes de venda"
lista os fretes em aberto primeiro, com o vencido em vermelho. O financeiro
marca como pago, com o comprovante. Quem faz isso: a tela Contas a pagar
aberta ou o administrador. Dados: `sales_orders.freightDueDate`,
`freightPaidAt`, `freightPaidByUserId` e `freightProofDocumentId`.

**Fluxo de caixa** (Painéis → Fluxo de caixa): o frete em aberto entra como
saída "Frete de venda", em reais, na semana do vencimento. Sem vencimento,
fica em "sem data". O link do item leva a Contas a pagar. Pago, sai do fluxo
(`freightOutflows` em `src/lib/services/cashflow.ts`).

**Custo e margem** (dono, 15/11/2026): quando a ordem de venda aponta o
pedido de compra de origem, o frete entra no custo desse pedido no Financeiro
desde a expedição, pago ou não, e a margem cai. Ele é convertido para a moeda
da venda como os custos de origem: sem câmbio do dia, o custo fica pendente.
Sem pedido de compra ligado, o frete fica só na ordem de venda. Código:
`salesFreightByOrder` e `OrderFinance.salesFreight` em
`src/lib/services/finance.ts`; no resumo por pedido, o campo `sfr`.

## Fica para depois

- Mostrar o frete da venda como linha separada no Financeiro do pedido (hoje ele entra no custo e na margem, como os custos de origem).
- A NF de devolução e a de venda emitidas pelo próprio portal no Sankhya.
