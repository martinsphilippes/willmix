# Processos: status do portal → estoque e Sankhya

Configurações → **Processos** (`/app/settings/sankhya?tab=process`, só o administrador). Decisão da Wellmix (10/11/2026): a TOP do Sankhya hoje marca a etapa do pedido, mas vai ser descontinuada (uma TOP só para o pedido); os **status do portal** passam a ser os gatilhos da movimentação de estoque e da escrita no Sankhya, com o de-para ajustável pelo admin.

## Eventos

Uma regra por evento (`src/lib/process-rules.ts`, `PROCESS_EVENTS`):

- **Solicitação**: RFQ aberta, cotações recebidas, fornecedor selecionado, aguardando sinal, pedido criado, excluída.
- **Pedido assinado pelos dois** (documento do pedido, docs/ORDER_SIGNATURE.md).
- **Etapas do pedido**: início e conclusão de cada etapa (Pedido criado … Encerramento).
- **Pedido faturado**: botão "Registrar faturamento" no pedido (Wellmix), linha Faturamento; grava `orders.invoicedAt` (`src/lib/services/order-invoicing.ts`).
- **Pedido cancelado**.

Onde são disparados: `src/lib/services/requests.ts` (status da solicitação), `superplan-rfq.ts`, `order-signature.ts`, `order-cancel.ts`, `order-invoicing.ts` e `src/lib/workflow/engine.ts` (início e conclusão de etapa). A carga do histórico do Sankhya não dispara nada.

## Ações

- **Estoque**: nada, entrada ou saída das quantidades do pedido (ou da solicitação), gravadas em `stock_movements` (`process_in` / `process_out`, com `processEventId`), que somam no "No Brasil" (docs/INVENTORY.md). Os containers já dão o estoque do que passa por container: use a regra para o que não passa, para não contar duas vezes.
- **Sankhya** (`src/lib/services/process-engine.ts`, `src/lib/integrations/sankhya-orders.ts`):
  - **Incluir nota (TOP)**: `CACSP.incluirNota` com os códigos da Integração (empresa, condição, comprador, natureza, centro de resultado, projeto, moeda, volume UN), fornecedor e produtos pelo código do Sankhya (`sankhyaCode`, da carga). Sem código, a regra registra o erro e o fluxo segue.
  - **Faturar para a TOP**: `SelecaoDocumentoSP.faturar` da nota ligada para a TOP da regra (o caminho do Sankhya para cotação 1002 → pre-order 1100 → pedido 1101 → nota); o NUNOTA novo vira o vínculo.
  - **Cancelar a nota**: `CACSP.cancelarNota`.
  - A nota ligada é `orders.sankhyaCode` ou, antes de haver pedido, `requests.sankhyaCode`; o número exibido segue a escolha NUNOTA/NUMNOTA da Integração.

Proposta inicial (`DEFAULT_RULES`): aguardando sinal → incluir cotação (1002); pedido criado → faturar para pre-order (1100); assinado pelos dois → faturar para pedido (1101); faturado → faturar (TOP a informar); cancelado → cancelar. Estoque: nada.

## Execução e registro

- **Execução no Sankhya** (mesma tela; `ordersEnabled` dos códigos do ERP): desligada por padrão. Desligada, a regra só registra o que faria ("simulado"); ligada, escreve no Sankhya de produção.
- Cada execução vira uma linha em `process_events` (evento, pedido/solicitação, ações, TOP, resultado feito/simulado/não rodou/erro, detalhe, NUNOTA antes e depois), listada em "Últimos eventos". Cada evento roda uma vez por pedido ou solicitação.
- Nunca derruba o fluxo que chamou: erro fica registrado.
- Regras gravadas em `settings` (`process.rules`), com auditoria (`process.rules`, `sankhya.execution`, `order.invoiced`).

## Esquema

Tabela `process_events`; colunas `requests.sankhyaCode`, `orders.invoicedAt`, `orders.invoicedByUserId`, `stock_movements.processEventId`; tipos `process_in`/`process_out` em `stock_movements.kind`. Publicar o esquema (Actions → "Publicar esquema Appwrite"). Sem ele, as regras ativas só registram erro no log do servidor e o portal segue.
