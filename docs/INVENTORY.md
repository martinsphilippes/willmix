# Estoque (`/app/inventory`)

Tela da Wellmix (mesma permissão da tela Produtos). Mostra, por produto, a mercadoria sem cliente:

- **No Brasil**: item de container sem pedido em container chegado; item de compra para estoque em container chegado/fechado; compra para estoque entregue sem container.
- **Em trânsito**: os mesmos itens em container planejado, carregando ou embarcado.
- **Em produção**: compra para estoque (empresa interna "Estoque Wellmix") ainda fora de container.

Pedido cancelado não conta; mercadoria vendida (item de container com pedido de cliente) não conta. Mercadoria livre em container fechado sai da conta, como na vitrine.

Caixas vêm do item do container (ou da caixa master do produto, para o que ainda está na fábrica). Preço de compra e valor total só para quem abre Finanças. Busca, filtros por situação e CSV (`/app/inventory/export`) usam as mesmas regras (`src/lib/services/inventory.ts`, `src/app/app/inventory/_data.ts`).

## Baixa por venda

Em Estoque, "− Baixa por venda": produto (só os que têm estoque no Brasil), quantidade (nunca mais do que há), pedido do cliente (opcional) e observação. Grava uma movimentação `sale_out` (tabela `stock_movements`, quantidade negativa) que desconta do "No Brasil" na tela e na vitrine. Wellmix com a tela Produtos; vai para a auditoria.

## Movimentação por regra de processo

Configurações → Processos (docs/PROCESSES.md) pode dar entrada (`process_in`) ou saída (`process_out`) das quantidades de um pedido quando ele chega a um status. Essas movimentações somam no "No Brasil" como as demais e aparecem em Registro de perdas/movimentações. Nenhuma regra mexe no estoque por padrão.

## Inventário às cegas (`/app/inventory/counts`)

- Só o admin abre (um por vez). O sistema guarda, para cada produto com estoque no Brasil, a quantidade esperada (`stock_count_items.expected`), que nunca aparece para quem conta (coluna "Sistema" e diferença só para o admin).
- Quem conta (Wellmix com a tela Produtos) grava a quantidade. Bateu: item fechado. Não bateu: "você tem mais 1 chance". Errou de novo: o item vai para "Aguardando admin" e o admin recebe um aviso. As duas tentativas (quantidade, quem, quando) ficam no item e na auditoria; não há terceira tentativa.
- O admin aprova a quantidade final com motivo. A diferença vira `count_loss` (perda) ou `count_gain` (sobra) em `stock_movements`, ligada ao inventário, e ajusta o estoque.
- O inventário só fecha com todos os itens resolvidos.

## Registro de perdas (`/app/inventory/movements`)

Abas: todas, baixas por venda, produtos perdidos e sobras. "Produtos perdidos" agrupa por inventário (período desde o inventário anterior), com o total perdido e, para quem abre Finanças, o valor de custo.

Tabelas novas: `stock_movements`, `stock_counts`, `stock_count_items` (publicar o esquema no Appwrite). Sem elas publicadas, as telas mostram listas vazias e as ações avisam "esquema desatualizado".

## Limite (estoque mínimo)

Coluna "Limite" na tela Estoque: cada produto pode ter um estoque mínimo no Brasil (`products.minStock`, opcional; vazio tira o limite). Selo verde "Acima do limite", amarelo "Abaixo · a caminho" (o que está em trânsito e em produção cobre) ou vermelho "Repor". Cartão-filtro "Abaixo do limite". Produto com limite e sem estoque nenhum também aparece. Quando uma baixa por venda ou um ajuste de inventário faz o estoque no Brasil cruzar o limite para baixo, o admin recebe um aviso (uma vez por cruzamento). CSV com a coluna Limite.

Sugestão de compra: no selo "Repor" aparece "Comprar N", que abre uma compra para estoque já com o produto e a quantidade (`reorderQuantity`): o que falta para o limite contando trânsito e produção, no mínimo o MOQ do produto e arredondado para caixas master inteiras.

## Reserva para cliente (`/app/inventory/reservations`)

Quem trabalha com Estoque (Wellmix com a tela Produtos) separa parte do estoque livre no Brasil para um cliente, com validade em dias (padrão 15, até 120). O reservado continua no físico (o inventário conta normalmente), mas sai do livre: a vitrine não oferece e a baixa por venda comum não deixa passar do livre (erro `stock_reserved`). "Usar" transforma a reserva em baixa por venda (com pedido opcional, ligada à reserva); "Cancelar" devolve ao livre; vencida (passou o dia da validade) deixa de segurar sozinha, sem gravar nada. Abas Ativas, Vencidas, Usadas, Canceladas; na tela Estoque, coluna "Reservado" com o livre embaixo, e a planilha ganha "Reservado". Tudo vai para a auditoria. Tabela nova `stock_reservations` (publicar o esquema; sem ela, nada fica reservado e a tela fica vazia). Regras puras em `src/lib/services/reservation-rules.ts`.

## Produto parado

Produto com estoque no Brasil e sem baixa por venda há 90 dias ou mais (se nunca vendeu, conta desde a última chegada ao Brasil: container chegado ou compra para estoque entregue). Ajustes de inventário não contam como venda. Na tela Estoque: cartão-filtro "Parados (90+ dias)", selo "Parado há N dias" embaixo do nome e "Última venda" na coluna Última movimentação; a planilha ganha a coluna "Dias parado"; o Painel do dono mostra quantos estão parados no cartão de estoque. Sem mudança de esquema (`idleDaysFor` e `IDLE_DAYS` em `src/lib/services/inventory.ts`).

## Painel do dono (`/app/dashboards/owner`)

Só quem abre Finanças (admin); menu Gestão → Painel do dono e link em Painéis por área. Mostra: vendas do mês (com o mês anterior), margem do mês, recebido no mês e a receber, pago a fornecedores no mês e a pagar, estoque (valor de custo e produtos abaixo do limite), perdas do último inventário fechado, solicitações em aberto, aguardando sinal, pedidos em andamento, vendas dos últimos 6 meses, pedidos por etapa e os maiores clientes e fornecedores em 12 meses. Compras para estoque não contam como venda. Cada número leva à tela onde se age. Serviço em `src/lib/services/owner-panel.ts` (funções puras testadas).

## Fluxo de caixa previsto (`/app/dashboards/cashflow`)

Só quem abre Finanças (admin); menu Gestão → Fluxo de caixa, e links no Painel do dono e em Painéis por área. Mostra as próximas 12 semanas (segunda a domingo), mais "Atrasado", "Depois" e "Sem data". Entradas: sinal em aberto das solicitações aguardando pagamento (vence hoje) e o saldo a receber de cada pedido na data prevista da etapa Entregue (já entregue e não pago = atrasado). Saídas: as parcelas em aberto ao fornecedor (as mesmas de Contas a pagar), no vencimento de cada uma; parcela que depende de embarque ou entrega sem data fica em "Sem data". Saldo da semana e acumulado em reais pelo câmbio do dia; sem câmbio de uma moeda o saldo não é inventado (fica "—" e aparece aviso). Avisa a primeira semana em que o acumulado fica negativo. Compras para estoque não entram como recebimento. Sem mudança de esquema. Serviço em `src/lib/services/cashflow.ts` (`buildCashflow` puro e testado).
