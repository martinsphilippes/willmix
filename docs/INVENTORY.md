# Estoque (`/app/inventory`)

Tela da Wellmix (mesma permissão da tela Produtos). Mostra, por produto, a mercadoria sem cliente:

- **No Brasil**: item de container sem pedido em container chegado; item de compra para estoque em container chegado/fechado; compra para estoque entregue sem container.
- **Em trânsito**: os mesmos itens em container planejado, carregando ou embarcado.
- **Em produção**: compra para estoque (empresa interna "Estoque Wellmix") ainda fora de container.

Pedido cancelado não conta; mercadoria vendida (item de container com pedido de cliente) não conta. Mercadoria livre em container fechado sai da conta, como na vitrine.

Caixas vêm do item do container (ou da caixa master do produto, para o que ainda está na fábrica). Preço de compra e valor total só para quem abre Finanças. Busca, filtros por situação e CSV (`/app/inventory/export`) usam as mesmas regras (`src/lib/services/inventory.ts`, `src/app/app/inventory/_data.ts`).

Ainda não existe: baixa de estoque por venda de pronta entrega, estoque mínimo por produto e contagem física (inventário). São os próximos passos se a operação precisar.
