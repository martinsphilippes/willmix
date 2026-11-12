# Resumos (tabelas agregadas)

Pedido do dono (12/11/2026): a Control Tower estava lenta. Com a carga do histórico do Sankhya, o banco passou a ter cerca de 7,8 mil pedidos em andamento, 94 mil itens, 73 mil etapas, 277 mil requisitos, 32 mil parceiros e 17 mil produtos.

A cada abertura, a tela baixava essas tabelas inteiras pela API do Supabase, em páginas de mil linhas: mais de 140 MB e centenas de idas ao banco. Depois procurava o primeiro item de cada pedido com `.find` sobre todos os itens, cerca de 350 milhões de comparações.

O banco não era o gargalo. O gargalo era levar tudo para o servidor da Vercel e fazer as contas lá.

## Resumo por pedido (`order_summaries`)

Uma linha por pedido, com o mesmo id do pedido. O campo `facts` (`OrderFacts`, em `src/lib/services/order-summary.ts`) guarda o que as telas de visão geral leem do pedido:

- o pedido, só com os campos que os quadros usam;
- o nome do cliente e do fornecedor e o primeiro item;
- as etapas em andamento ou bloqueadas;
- os requisitos que dividem os quadros e, no pedido de compra, os das raias;
- embarque, produção, inspeção por SKU, arte e recebimento;
- os valores do financeiro sem estimativa (venda, recebido, a receber, FOB, pago e a pagar);
- as parcelas ao fornecedor (situação e vencimento);
- desde o formato 2: os pagamentos do pedido (sem os códigos do Sankhya), as etapas de embarque e entrega (início, conclusão, prazo) e os itens do cronograma de pagamento; e o percentual da etapa em andamento.

As colunas `number`, `status` e `live` servem para ordenar e filtrar.

**As regras não mudaram.** O resumo guarda os dados de entrada já filtrados. Os quadros (`buildTowerBoard`), as visões gerais e exceções (`buildControlTower`) e os totais (`summarizeFinance`) continuam sendo montados pelas mesmas funções, na hora da leitura.

O que depende do tempo é calculado contra o "agora" da leitura:
- prazo vencido;
- parcela vencida ou a vencer (`installmentStatusOn`);
- produção atrasada;
- encerrados no mês.

Por isso a passagem do tempo não precisa de job.

Continuam lidas na hora, por serem pequenas:
- multas em aberto;
- itens recusados;
- revisão;
- certificações a vencer;
- solicitações abertas;
- bookings e solicitações ao fornecedor;
- containers.

O teste `tests/unit/order-summary.test.ts` monta a Control Tower pelos dois caminhos (resumo e tabelas) e exige resultado igual: quadros com e sem Finanças, visões gerais, exceções e totais, também depois de gravações.

## Atualização por evento

Toda gravação passa pelo `CachedStore` (`src/lib/db/cached-store.ts`), que avisa `src/lib/db/summary-dirty.ts`. O pedido fica marcado quando muda:

- o próprio pedido;
- uma etapa, requisito, item, pagamento, passo de embarque, acompanhamento de produção, inspeção por SKU, problema de arte ou recebimento;
- o nome ou a condição de pagamento de um parceiro (vale para todos os pedidos dele).

Para saber o pedido de uma linha apagada, a linha é lida antes de apagar.

O resumo dos pedidos marcados é recalculado depois da resposta, pelo `after()` do Next. Se a mesma instância ler os resumos antes disso, recalcula logo antes da leitura (`readOrderSummaries`). Assim a tela aberta depois de uma ação já vem certa.

Uma falha no recálculo só vai para o log. A reconstrução noturna corrige.

## Reconstrução (reserva)

- **Job noturno:** `/api/jobs/summaries`, às 6h17 UTC (3h17 em Brasília; `vercel.json`, protegido por `CRON_SECRET`).
- **Manual:** Configurações → **Resumos dos pedidos** → "Reconstruir agora" (só o administrador; auditoria `order_summaries.rebuild`).

A reconstrução lê tudo de uma vez e grava em lote (`upsertMany`), só o que mudou. A comparação ignora a ordem das chaves, que o `jsonb` reordena. Ela apaga o resumo de pedido que não existe mais e não sobrescreve resumo recalculado por evento durante ela.

Ao terminar, grava o marcador `orderSummaries` em `settings`: quando, quantos pedidos, quantos gravados e apagados, duração.

**Caminho antigo.** As telas leem as tabelas inteiras, como antes, em três casos:
- enquanto não houver marcador;
- com o formato do resumo diferente de `SUMMARY_VERSION`;
- com a tabela ainda não publicada.

Mudou o formato de `facts`? Suba `SUMMARY_VERSION`. As telas voltam ao caminho antigo até a próxima reconstrução.

Sem marcador, as gravações não recalculam nada; custam uma leitura de `settings` por requisição com escrita.

## Outros ganhos nesta etapa

- `loadFinance`: mapas por id no lugar de `.find`/`.filter` dentro do laço. Vale para Financeiro, Fluxo de caixa, Painel do dono e Clientes.
- `listContainers`: só os clientes dos containers, em vez do cadastro inteiro de parceiros.
- Control Tower, caminho antigo: só os produtos das certificações, em vez do cadastro inteiro.

## Outras telas que leem o resumo (formato 2, 12/11/2026)

Cada tela continua lendo a lista de pedidos (cerca de 15 MB) e passa a tirar do resumo, com `factsForOrders`, o que antes vinha das tabelas grandes: pagamentos, itens, parceiros, etapas e requisitos (mais de 200 MB por abertura). Um pedido ainda sem resumo, porque acabou de ser gravado em outra instância, é calculado na hora. Sem os resumos em uso, todas seguem pelo caminho antigo.

- **Financeiro, Fluxo de caixa, Painel do dono, Clientes e Fornecedores** (`loadFinance`): pagamentos, nomes e primeiro item de cada pedido. O câmbio da venda (auditoria) passa a ser lido por ação, sem os lotes de 100 ids.
- **Contas a pagar, conta corrente do fornecedor, Fluxo de caixa e aviso diário de parcelas** (`listPayables`): o cronograma de cada pedido (`payableFor`) é montado com os pagamentos, os marcos e os itens do cronograma do resumo.
- **Fluxo de caixa:** a etapa "Entregue" sai do resumo. Os clientes das solicitações são lidos só pelos ids.
- **Painel do dono:** só os pagamentos confirmados ou recebidos e só as solicitações abertas ou à espera do sinal.
- **Pedidos** (`pipelineFor`): etapas em andamento e a viagem (`journeyIndex`) saem do resumo. Os itens de todos os pedidos continuam vindo da tabela, porque a tela manda todos para o navegador (os filtros por produto e por progresso rodam lá).
- **Saldo por parceiro:** sai do mesmo resumo por pedido, somado na hora (`customerAccounts`), sem uma segunda tabela.
- **Tipos de parceiro:** conta só os parceiros desses tipos.

O teste `tests/unit/order-summary.test.ts` compara todas essas telas pelos dois caminhos. Também confere que, com o resumo, nenhuma delas lê pagamentos, etapas ou requisitos por pedido.

## Jobs (12/11/2026)

- **Lembrete de prazo** (`runReminders`): pedidos e itens pendentes das etapas vencidas são lidos de uma vez, em vez de duas leituras por etapa. Teste em `tests/unit/reminders.test.ts`.
- **Distribuição de solicitações** (`distributeUnassigned`): solicitações, primeiro item, produtos e linhas são lidos em lote, em vez de quatro leituras por pedido.
- **Carga de cada analista** (`openLoad`, a cada solicitação nova): só os pedidos e solicitações com dono na equipe, em vez de todos os pedidos.
- **Aviso de confirmação de pagamento** (`notifySuppliersToConfirm`): mapas por pedido no lugar de `.find`/`.filter` dentro do laço.

## O que ainda pesa

1. **Pedidos:** a tela manda todos os pedidos com todos os itens para o navegador. Resolver isso pede paginação ou carregar os itens da linha escolhida, o que muda a tela e é decisão do dono.
2. **Pendências** (`pendingTasksFor`): lê os itens de todas as etapas em andamento a cada abertura, e é o início dos parceiros.
3. **Escolha de itens para o container e sugestões de produto:** leem os itens de todos os pedidos em aberto.
4. **Painel de SLA:** lê as etapas concluídas de todos os pedidos para medir durações.
