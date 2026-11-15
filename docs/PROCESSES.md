# Processos: status do portal → estoque e Sankhya

Configurações → **Processos** (`/app/settings/sankhya?tab=process`, só o administrador). Decisão da Wellmix (10/11/2026): a TOP do Sankhya hoje marca a etapa do pedido, mas vai ser descontinuada (uma TOP só para o pedido); os **status do portal** passam a ser os gatilhos da movimentação de estoque e da escrita no Sankhya, com o de-para ajustável pelo admin.

## Eventos

Uma regra por evento (`src/lib/process-rules.ts`, `PROCESS_EVENTS`):

- **Solicitação**: RFQ aberta, cotações recebidas, fornecedor selecionado, aguardando sinal, pedido criado, excluída.
- **Pedido assinado pelos dois** (documento do pedido, docs/ORDER_SIGNATURE.md).
- **Marcos do pedido** (fase 4d, 15/11/2026; docs/MILESTONES.md "Sankhya, regras e painéis"): `milestone:<marco>:start` (o marco passa a em andamento) e `milestone:<marco>:done` (o marco conclui com todas as subtarefas obrigatórias feitas; desde a fase 5d o item opcional não segura), para os 16 marcos. No editor vêm agrupados por bloco (Pedido, Produção, Entrega), "N. Marco — começa/conclui", antes das etapas antigas.
- **Etapas do pedido (etapa antiga)**: início e conclusão de cada etapa (Pedido criado … Encerramento). **Sem efeito desde a fase 5d** (o motor anda pelos marcos e não dispara mais `stage:*`). O editor mostra cada linha com "Etapa antiga — sem efeito"; a regra gravada que faz alguma coisa mostra também o **evento de marco proposto** e o botão **"Trocar para o marco"** (procedimento abaixo). Nada é reescrito sozinho.
- **Pedido faturado**: botão "Registrar faturamento" no pedido (Wellmix), linha Faturamento; grava `orders.invoicedAt` (`src/lib/services/order-invoicing.ts`).
- **Pedido cancelado**.

Onde são disparados: `src/lib/services/requests.ts` (status da solicitação), `superplan-rfq.ts`, `order-signature.ts`, `order-cancel.ts` e `order-invoicing.ts`. A carga do histórico do Sankhya não dispara nada. Os eventos de marco saem da sincronização dos marcos (fase 5d: `syncMilestones` → `emitMilestoneEvents`, `src/lib/services/order-milestones.ts` e `milestone-events.ts`), chamada pelo motor depois de cada envio, decisão ou criação do pedido e pela fila depois das gravações dos passos do embarque, da certificação, das amostras e da produção; o mesmo ponto do aviso aos informados. "Começa" = o marco em andamento sem linha aberta antes em `order_milestones` (inclusive os que já nascem liberados na criação do pedido); "conclui" = concluído agora com as obrigatórias feitas (o encerramento, que conclui tudo pela situação, não conta). Nunca na reconstrução nem no recálculo do resumo, nem em pedido do histórico em espera ou cancelado, e uma vez por evento e pedido (auditoria `milestone.event`).

### Trocar uma regra de etapa antiga para o marco (fase 5d)

Procedimento do dono, regra por regra (nada é trocado sozinho):

1. Configurações → Sankhya → Processos, tabela das regras, grupo "Etapas antigas".
2. Cada regra gravada que faz alguma coisa mostra "Etapa antiga — sem efeito" e "Evento proposto: N. Marco — começa/conclui". O de-para é o da etapa para o marco (`stage:X:start|done` → `milestone:<marco da etapa X>:start|done`, `stageRuleMilestoneEvent`): Pedido criado e Preparação → 1. Pedido novo; Arte e embalagem → 5. Contrato; Pagamento → 6. Sinal; Inspeção → 8. Inspeção; Embarque → 13. Embarque; Desembaraço → 14. Desembaraço; Transporte → 15. Nota fiscal e transporte; Entregue e Encerramento → 16. Entrega e recebimento.
3. Confira se o marco proposto é o momento certo (o marco pode começar antes da etapa antiga, porque as frentes andam em paralelo) e clique em **"Trocar para o marco"**. A regra (ativa, estoque, Sankhya, TOP, local e observação) passa para o evento de marco; a linha da etapa fica vazia (inativa). Fica na auditoria (`process.rule.rewrite`).
4. Se o evento de marco proposto já tem uma regra que faz alguma coisa, a troca é recusada ("ajuste as duas à mão"): edite as duas linhas e salve.
5. Ação só do administrador (Server Action `rewriteStageRuleAction`, `src/app/app/actions/processes.ts`, com zod); os outros perfis não abrem a tela.

## Ações

- **Estoque**: nada, entrada ou saída das quantidades do pedido (ou da solicitação), gravadas em `stock_movements` (`process_in` / `process_out`, com `processEventId`), que somam no "No Brasil" (docs/INVENTORY.md). Os containers já dão o estoque do que passa por container: use a regra para o que não passa, para não contar duas vezes.
- **Sankhya** (`src/lib/services/process-engine.ts`, `src/lib/integrations/sankhya-orders.ts`):
  - **Incluir nota (TOP)**: `CACSP.incluirNota` com os códigos da Integração (empresa, condição, comprador, natureza, centro de resultado, projeto, moeda, volume UN), fornecedor e produtos pelo código do Sankhya (`sankhyaCode`, da carga). Sem código, a regra registra o erro e o fluxo segue.
  - **Faturar para a TOP**: `SelecaoDocumentoSP.faturar` da nota ligada para a TOP da regra (o caminho do Sankhya para cotação 1002 → pre-order 1100 → pedido 1101 → nota); o NUNOTA novo vira o vínculo.
  - **Cancelar a nota**: `CACSP.cancelarNota`.
  - A nota ligada é `orders.sankhyaCode` ou, antes de haver pedido, `requests.sankhyaCode`; o número exibido segue a escolha NUNOTA/NUMNOTA da Integração.

Proposta inicial (`DEFAULT_RULES`): aguardando sinal → incluir cotação (1002); pedido criado → faturar para pre-order (1100); assinado pelos dois → faturar para pedido (1101); faturado → faturar (TOP a informar); cancelado → cancelar. Estoque: nada.

## Fase 3: cadastros e itens

A mesma execução no Sankhya liga a sincronização de fornecedores, clientes, produtos e itens de pedidos ligados (docs/SANKHYA.md, "Sincronização portal → Sankhya"), com o cartão "Sincronização com o Sankhya" nesta tela.

## Execução e registro

- **Execução no Sankhya** (mesma tela; `ordersEnabled` dos códigos do ERP): desligada por padrão. Desligada, a regra só registra o que faria ("simulado"); ligada, escreve no Sankhya de produção.
- Cada execução vira uma linha em `process_events` (evento, pedido/solicitação, ações, TOP, resultado feito/simulado/não rodou/erro, detalhe, NUNOTA antes e depois), listada em "Últimos eventos". Cada evento roda uma vez por pedido ou solicitação.
- Nunca derruba o fluxo que chamou: erro fica registrado.
- Regras gravadas em `settings` (`process.rules`), com auditoria (`process.rules`, `sankhya.execution`, `order.invoiced`).

## Esquema

Tabela `process_events`; colunas `requests.sankhyaCode`, `orders.invoicedAt`, `orders.invoicedByUserId`, `stock_movements.processEventId`; tipos `process_in`/`process_out` em `stock_movements.kind`. Publicar o esquema (Actions → "Publicar esquema Appwrite"). Sem ele, as regras ativas só registram erro no log do servidor e o portal segue.
