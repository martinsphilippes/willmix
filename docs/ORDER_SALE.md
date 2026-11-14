# Venda ao cliente por pedido e por produto

Decisões do dono em 14/11/2026, depois do histórico de compras do cliente (docs/PURCHASE_HISTORY.md), que mostrava "—" no valor de venda porque nenhum pedido tinha venda gravada. Desde a saída da cotação (11/11/2026) não havia tela para gravar a venda.

1. **Onde se digita:** no pedido, por produto. O card fica no detalhe do pedido, logo depois de "Itens do pedido".
2. **Total:** o total do pedido é sempre a soma dos produtos (preço unitário × quantidade).
3. **Quem grava:** quem tem a ação nova configurável "Gravar a venda ao cliente" (`sale.record`). Padrão: só o administrador, que libera para outras funções em Equipe → Funções e acessos. Toda alteração vai para a Auditoria.

## O card "Venda ao cliente"

- Uma linha por produto do pedido: produto, quantidade, preço unitário e subtotal.
- Uma moeda para o pedido todo (Real, Yuan, Dólar ou Euro; padrão Real).
- Subtotais e total são recalculados enquanto se digita; o servidor refaz a conta ao gravar.
- **Total completo:** com o preço de todos os produtos, o total do pedido é a soma.
- **Parcial:** a tela mostra a soma parcial e quantos produtos faltam. O total do pedido só vale quando todos têm preço, para o Financeiro, as comissões e os painéis não usarem um total incompleto.
- **Pedido antigo:** quando a venda foi gravada só no pedido inteiro, sem preço por produto, a tela mostra esse total. Ele fica como está até todos os produtos terem preço.
- **Apagar um preço:** quando o total já era a soma e um preço é apagado, o total do pedido fica vazio até completar de novo.
- **Trocar a moeda:** vale para o pedido todo. Se a soma não está completa, o total antigo em outra moeda não é aproveitado.
- **Pedido cancelado:** a tabela fica só para leitura.
- **Rodada da programação (pedido filho):** não tem venda própria. O card aponta para o pedido pai, que é a compra; é a mesma regra do histórico de compras, para a compra não contar duas vezes.

## Quem vê

| Login | Vê | Grava |
| --- | --- | --- |
| Administrador | sim | sim |
| Wellmix com "Gravar a venda ao cliente" | sim | sim |
| Wellmix com "Ver valores e margem" | sim (com o aviso de quem altera) | não |
| Wellmix sem nenhuma das duas | o card não aparece | não |
| Cliente (pedido dele) | sim, só leitura (ele já via o total do pedido) | não |
| Fornecedor e demais parceiros | não | não |

A Server Action e o serviço conferem a permissão de novo.

## Dados

| Dado | Onde |
| --- | --- |
| Preço de venda por unidade do produto | `order_items.sellUnitPrice` (novo, opcional, na moeda do pedido) |
| Total do pedido | `orders.sellPrice` (já existia): a soma com todos os produtos com preço |
| Moeda | `orders.sellCurrency` (já existia) |
| Auditoria | `audit_log`, ação `order.sale_recorded`, com antes e depois (moeda, total e preço de cada produto) |

## Onde o preço por produto é usado

- **Quantidade nova pela ficha de compra** (`applySheetQuantity` e a ficha salva antes do pagamento): com o preço de todos os produtos, o total é a soma com a quantidade nova; sem ele, a proporção de antes.
- **Histórico de compras do cliente** (Nova solicitação): unitário e subtotal de cada produto.
- **Histórico comercial** (`history.ts`) e **ficha de vendas** do cliente (`sale-sheet.ts`): o preço gravado no produto no lugar da média do pedido (total ÷ quantidade).
- Financeiro, comissões e containers continuam lendo o total do pedido (`orders.sellPrice`), que agora é a soma.

## Código e testes

- Regra: `src/lib/services/order-sale.ts` (`itemsSale`, `nextOrderTotal`, `orderSaleView`, `recordOrderSale`).
- Ação: `src/app/app/actions/order-sale.ts` (`recordOrderSaleAction`; zod e permissão).
- Tela: `src/components/order-sale-form.tsx` e `src/app/app/orders/[id]/_components/order-sale.tsx`.
- Permissão: `sale.record` em `src/lib/auth/function-access.ts` (grupo "money") e no módulo Financeiro de `permission-modules.ts`.
- Textos: `src/i18n/modules/order-sale.ts` e a ação em `team-access.ts` (pt/en/zh).
- Testes: `tests/unit/order-sale.test.ts` e o caminho principal do E2E (o administrador grava o preço no pedido e o histórico de compras mostra o unitário).

## Fica para depois

- A ordem de venda (Vendas, docs/SALES_ORDERS.md) ligada a um pedido de compra pode trazer os preços deste card como sugestão.
- A venda dos pedidos antigos do Sankhya vem da nota de venda de lá, ainda não importada.
