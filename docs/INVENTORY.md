# Estoque (`/app/inventory`)

Tela da Wellmix (mesma permissão da tela Produtos). Mostra, por produto, a mercadoria sem cliente:

- **No Brasil**: item de container sem pedido em container chegado; item de compra para estoque em container chegado/fechado; compra para estoque entregue sem container.
- **Em trânsito**: os mesmos itens em container planejado, carregando ou embarcado.
- **Em produção**: compra para estoque (empresa interna "Estoque Wellmix") ainda fora de container.

Pedido cancelado não conta; mercadoria vendida (item de container com pedido de cliente) não conta. Mercadoria livre em container fechado sai da conta, como na vitrine.

Caixas vêm do item do container (ou da caixa master do produto, para o que ainda está na fábrica). Preço de compra e valor total só para quem abre Finanças. Busca, filtros por situação e CSV (`/app/inventory/export`) usam as mesmas regras (`src/lib/services/inventory.ts`, `src/app/app/inventory/_data.ts`).

## Baixa por venda

Em Estoque, "− Baixa por venda": produto (só os que têm estoque no Brasil), quantidade (nunca mais do que há), pedido do cliente (opcional) e observação. Grava uma movimentação `sale_out` (tabela `stock_movements`, quantidade negativa) que desconta do "No Brasil" na tela e na vitrine. Wellmix com a tela Produtos; vai para a auditoria.

## Inventário às cegas (`/app/inventory/counts`)

- Só o admin abre (um por vez). O sistema guarda, para cada produto com estoque no Brasil, a quantidade esperada (`stock_count_items.expected`), que nunca aparece para quem conta (coluna "Sistema" e diferença só para o admin).
- Quem conta (Wellmix com a tela Produtos) grava a quantidade. Bateu: item fechado. Não bateu: "você tem mais 1 chance". Errou de novo: o item vai para "Aguardando admin" e o admin recebe um aviso. As duas tentativas (quantidade, quem, quando) ficam no item e na auditoria; não há terceira tentativa.
- O admin aprova a quantidade final com motivo. A diferença vira `count_loss` (perda) ou `count_gain` (sobra) em `stock_movements`, ligada ao inventário, e ajusta o estoque.
- O inventário só fecha com todos os itens resolvidos.

## Registro de perdas (`/app/inventory/movements`)

Abas: todas, baixas por venda, produtos perdidos e sobras. "Produtos perdidos" agrupa por inventário (período desde o inventário anterior), com o total perdido e, para quem abre Finanças, o valor de custo.

Tabelas novas: `stock_movements`, `stock_counts`, `stock_count_items` (publicar o esquema no Appwrite). Sem elas publicadas, as telas mostram listas vazias e as ações avisam "esquema desatualizado".

Ainda não existe: estoque mínimo por produto (alerta de limite).
