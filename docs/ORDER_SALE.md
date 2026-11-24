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

## Preços pela API (dono, 24/11/2026)

Pedido do dono: o preço do card não se digita mais. Vem da API de preço (a cotação V2 do Sankhya, a mesma da Nova solicitação), com o preço WD e o preço Wellmix lado a lado, fixos, em letreiro e campo pequenos. O card também mostra as caixas, a cubagem e os containers.

Decisões do dono (24/11/2026):

1. **Nível do preço Wellmix:** o nível do pedido (Nova solicitação). Sem nível, como nos pedidos que vieram do Sankhya, vale o padrão do Sankhya: o portal não manda o VIP.
2. **Venda gravada:** um seletor WD | Wellmix no card. "Salvar a venda" grava o preço do formato escolhido de cada produto, recalculado no servidor pela cotação. O pedido com formato (o da Nova solicitação ou o da venda já gravada) já vem marcado.

### Como fica

- **Preços:** por peça, em R$, com frete.
  - WD: VIP 5, `PRECO_WD_COM_FRETE_REFERENCIA` (o mesmo da Nova solicitação no formato WD).
  - Wellmix: `PRECO_COM_FRETE_REFERENCIA`, com o VIP do nível.
  - Entradas: o produto (CODPROD ou a ficha do portal), as peças do item (item em caixas: × a caixa master), o cliente e o RCA dele, quem chama o transportador, o frete do pedido (ou o padrão das Configurações) e a data de hoje.
  - Só leitura: dois campos pequenos lado a lado; o do formato escolhido fica destacado.
  - Produto sem preço: "—", com o motivo embaixo (a mensagem do Sankhya ou a situação da cotação, como FRETE_PENDENTE).
- **Carregamento:** o pedido abre sem esperar o Sankhya. A tela busca os preços aos poucos, 3 produtos por vez (`GET /api/orders/<id>/sale-prices?items=`), e mostra quantos já chegaram.
- **Cotação do dia:** fica no item (`order_items.saleQuote`). A próxima visita e a gravação usam a mesma, sem chamar o Sankhya de novo. Vale no dia (Brasília) e com as mesmas entradas: mudou a quantidade, o cliente, o nível ou o frete, cota de novo.
- **Gravar:** só o formato vai da tela. O servidor usa a cotação do dia (ou cota o que falta) e grava `sellUnitPrice` em R$ (item em caixas: o preço da caixa), a moeda BRL, o total (a soma, como antes) e o formato em `orders.saleFormat`. Produto sem preço fica sem venda e o total, parcial (a regra de sempre). Se nenhum produto tem o preço do formato (o Sankhya fora, por exemplo), nada é gravado e a venda de antes continua. A auditoria leva o formato.
- **Sem o Sankhya ligado** (desenvolvimento e testes): o card continua com o preço digitado e a moeda; a venda digitada grava o formato vazio.
- **Caixas, cubagem e containers** (Wellmix):
  - no topo do card, os totais;
  - na tabela, as caixas e a cubagem de cada produto (a mesma conta da tabela "Itens do pedido");
  - containers = cubagem ÷ capacidade do tipo da ficha de compra (sem ficha, o 40HC das Configurações, 68 m³), com 2 casas, como na ficha;
  - produto sem caixa master ou sem cubagem fica fora da soma, e o aviso diz quantos.
- **Quem vê:** os preços da cotação, a Wellmix que vê valores ou grava a venda (a mesma regra do card). O cliente continua vendo só a venda gravada. Caixas, cubagem e containers, só a Wellmix.

| Dado novo | Onde |
| --- | --- |
| Cotação do dia de cada produto (WD, Wellmix, nível, dia, entradas) | `order_items.saleQuote` (json, opcional) |
| Formato da venda gravada (WD ou Wellmix) | `orders.saleFormat` (texto, opcional) |

Código: `src/lib/order-sale-quote.ts` (regras puras), `src/lib/services/order-sale-quote.ts` (cotação, cotação do dia e gravação pelo formato), `src/app/api/orders/[id]/sale-prices/route.ts`, `src/components/order-sale-quote-form.tsx` e `recordOrderSaleFormatAction` em `src/app/app/actions/order-sale.ts`. Testes: `tests/unit/order-sale-quote.test.ts` e o caminho principal do E2E (o resumo de caixas, cubagem e containers, sem o Sankhya).

## Fica para depois

- A ordem de venda (Vendas, docs/SALES_ORDERS.md) ligada a um pedido de compra pode trazer os preços deste card como sugestão.
- A venda dos pedidos antigos do Sankhya vem da nota de venda de lá, ainda não importada.
- Os 6 níveis do Wellmix lado a lado no card (o dono escolheu um preço Wellmix só, no nível do pedido).
- A tabela "Itens do pedido" conta as caixas dos itens em caixas ("CX", 127 de 45.806 itens em produção) como se fossem peças. O card "Venda ao cliente" já conta certo.
