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

**Em partes (12/11/2026).** Com 15,7 mil pedidos, ler e gravar tudo de uma vez passava dos 5 minutos que a Vercel dá a uma requisição, e as tentativas pela tela eram cortadas sem terminar. Agora a reconstrução (`rebuildOrderSummariesStep`) anda em fatias de 500 pedidos, em ordem de id. Cada fatia lê só os dados desses pedidos, como o recálculo por evento.

- Cada rodada trabalha até o tempo dado (ao menos uma fatia) e guarda onde parou em `settings` (`orderSummariesRebuild`: início, último id, processados, total, gravados).
- A próxima rodada continua do último id. Uma trava (`lockUntil`, o fim da rodada mais um minuto) evita duas rodadas ao mesmo tempo; a outra só devolve o andamento.
- A última rodada apaga o resumo de pedido que não existe mais, resume o pedido criado durante a reconstrução que ficou antes do cursor, grava o marcador e refaz os indicadores (`kpi_snapshots`).
- Reconstrução parada há mais de 12 horas, ou de outro formato, recomeça do zero.
- **Tela:** "Reconstruir agora" faz a primeira rodada (45 s). Se não terminar, a tela mostra quantos pedidos já foram e pede as rodadas seguintes até o fim. Fechou a tela: a reconstrução fica parada e continua ao abrir de novo ou no job noturno.
- **Job noturno:** rodadas de até 4 minutos; sem terminar, chama a si mesmo (`?hop=n`, no máximo 30 vezes) depois da resposta.
- Até o marcador novo ser gravado, as telas seguem pelo caminho antigo (o marcador velho é de outro formato) ou pelos resumos anteriores (mesmo formato).
- Teste em `tests/unit/order-summary.test.ts`: fatias de 2 pedidos, uma por rodada, com a trava, chegam à mesma Control Tower.

Cada fatia grava em lote (`upsertMany`), só o que mudou. A comparação ignora a ordem das chaves, que o `jsonb` reordena. Ela apaga o resumo de pedido que não existe mais e não sobrescreve resumo recalculado por evento durante ela.

Ao terminar, grava o marcador `orderSummaries` em `settings`: quando, quantos pedidos, quantos gravados e apagados, duração.

**Caminho antigo.** As telas leem as tabelas inteiras, como antes, em três casos:

- enquanto não houver marcador;
- com o formato do resumo diferente de `SUMMARY_VERSION`;
- com a tabela ainda não publicada.

Mudou o formato de `facts`? Suba `SUMMARY_VERSION`. **Formato 10 (14/11/2026):** entrou a contribuição de cada pedido para o Overview dos blocos (`kpi.f`, abaixo). As telas voltam ao caminho antigo até a próxima reconstrução.

**Reconstrução depois do deploy (auditoria de performance, 14/11/2026).** Antes, subir `SUMMARY_VERSION` deixava todas as telas no caminho antigo até a reconstrução da madrugada (até 24 h). Em 14/11 o banco estava na versão 6 e o código na 8; as telas liam tabelas inteiras, e houve timeouts de 60 s e quedas por falta de memória. Agora `readMarker` chama `kickStaleSummaries` (`src/lib/services/summary-kick.ts`): a primeira tela que encontra o formato mais velho que o do código pede ao `/api/jobs/summaries` da própria publicação (`VERCEL_URL`, com `CRON_SECRET`) que comece a reconstrução, depois da resposta. Isso só acontece em produção, só quando o formato do código é mais novo (rollback não refaz o resumo) e no máximo uma vez a cada 2 minutos por instância; a trava do job descarta os pedidos repetidos. A janela lenta cai para o tempo da reconstrução (cerca de 2 minutos para 16 mil pedidos na madrugada de 14/11).

**Só as partes do resumo que a tela usa (14/11/2026).** `readOrderSummaries(ids, keys)` e `factsForOrders(orders, keys)` pedem ao banco só as chaves de `facts` que a tela lê (`listColumns` com `jsonKeys`: `facts__chave:facts->chave` no PostgREST). O tipo de volta é `Pick<OrderFacts, chaves>`, e o compilador recusa uma chave que a tela usa sem pedir. O resumo inteiro tem cerca de 2,7 kB por pedido (44 MB de JSON para os 16 mil pedidos); os pagamentos sozinhos são 15 MB. Partes lidas por tela:

- Pedidos: `order`, `active`, `reqs`, `lane`, `steps`, `product` e `itemCount`.
- Financeiro: `pays`, `customer`, `supplier`, `product` e `pop`.
- Contas a pagar: `pays`, `ship`, `sreqs` e `product`.
- Fluxo de caixa: `ship`.

As outras telas leem o resumo inteiro, como antes.

**Formato 9 (14/11/2026).** Entrou `itemCount`, a quantidade de itens do pedido. Com o resumo em uso, a tela Pedidos não lê mais os itens de todos os pedidos: em produção eram 184 mil itens a cada abertura, 2.533 consultas de 465 ms em média em 10 h. O painel (`pipelineFor(user, { lazyItems: true })`) vem com o primeiro produto e a quantidade de itens do resumo. A tela lê os itens com `loadPipelineItems`:

- o item inteiro só dos pedidos da página;
- só nome e variação de todos os pedidos, quando há filtro de produto.

O resultado é o mesmo do painel com todos os itens (`tests/unit/pipeline.test.ts`).

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
- **Pedidos** (`pipelineFor`): etapas em andamento e a viagem (`journeyIndex`) saem do resumo. Os itens continuam vindo da tabela, só com as colunas usadas, porque o filtro por produto e a ordem percorrem todos.
- **Saldo por parceiro:** sai do mesmo resumo por pedido, somado na hora (`customerAccounts`), sem uma segunda tabela.
- **Tipos de parceiro:** conta só os parceiros desses tipos.

O teste `tests/unit/order-summary.test.ts` compara todas essas telas pelos dois caminhos. Também confere que, com o resumo, nenhuma delas lê pagamentos, etapas ou requisitos por pedido.

## Jobs (12/11/2026)

- **Lembrete de prazo** (`runReminders`): pedidos e itens pendentes das etapas vencidas são lidos de uma vez, em vez de duas leituras por etapa. Teste em `tests/unit/reminders.test.ts`.
- **Distribuição de solicitações** (`distributeUnassigned`): solicitações, primeiro item, produtos e linhas são lidos em lote, em vez de quatro leituras por pedido.
- **Carga de cada analista** (`openLoad`, a cada solicitação nova): só os pedidos e solicitações com dono na equipe, em vez de todos os pedidos.
- **Aviso de confirmação de pagamento** (`notifySuppliersToConfirm`): mapas por pedido no lugar de `.find`/`.filter` dentro do laço.

## Regra: indicadores leem tabelas agregadas (decisão do dono, 12/11/2026)

KPIs e indicadores (números de quadrados, contagens, totais, "no prazo") leem uma tabela agregada no nível do indicador (`kpi_snapshots`), e não tabelas por pedido ou produto. A tabela por pedido (`order_summaries`) serve de contribuição para somar o agregado e para montar a lista de um quadrado quando ele é escolhido.

Cada indicador:

- é refeito por evento, na gravação que muda o número;
- é refeito quando passa o `validUntil`, o próximo instante em que um prazo vence ou o dia vira;
- tem a reconstrução noturna (00h05 em Brasília) como reserva;
- tem teste que compara os números com o cálculo completo.

## Indicadores prontos da Control Tower (`kpi_snapshots`, chave "tower")

A tela lê uma linha só. Com o indicador válido, são duas consultas: o marcador em `settings` e a linha agregada. A linha traz:

- a contagem, os atrasados, os em risco e o valor de cada quadrado;
- as visões gerais e o total de exceções;
- os totais da faixa do financeiro e a visão comercial;
- `validUntil`.

**Contribuição de cada pedido** (`order_summaries.kpi`, `OrderKpi`, em `src/lib/services/tower-kpis.ts`):

- em que quadrados entra, e se está atrasado ou em risco;
- em que visões gerais aparece;
- quantas exceções tem;
- os valores do financeiro;
- até quando a contribuição vale (`u`, via `nextChange`).

A contribuição é calculada pelas mesmas funções da tela (`buildTowerBoard`, `buildControlTower`) só com o pedido, as multas, os itens recusados e a revisão dele.

O momento em que a contribuição muda (`nextChange`) é o mais próximo entre:

- o prazo da etapa;
- dois dias antes do prazo (entrada em "em risco");
- as datas de chegada e embarque;
- o ETD e os follow-ups da produção;
- a entrada da parcela em "a vencer" e o vencimento;
- a virada do mês, para encerrados e cancelados.

**Agregado** (`rebuildTowerKpis`):

- lê só a coluna `kpi`;
- recalcula antes os pedidos com a contribuição vencida;
- soma, e o valor de cada quadrado só conta na moeda principal;
- acrescenta o que não é de pedido, lido na hora: bookings, solicitações ao fornecedor (SLA), certificações, revisão, containers e solicitações do cliente;
- grava a linha.

**Quando é refeito:**

- a cada leva de gravações, depois do recálculo dos pedidos marcados;
- em gravações de bookings, solicitações, certificações, containers, revisão e configurações, que marcam `kpi`;
- antes da leitura, se o `validUntil` passou.

**Listas:** só a do quadrado, visão ou exceções escolhido é montada. A tela lê os pedidos membros na coluna `kpi`, busca o resumo das primeiras 200 linhas e usa as mesmas funções da tela. Acima de 200, mostra "Mostrando os 200 primeiros de N".

**Etapas:** os passos que não são "em paralelo" são exclusivos, então a etapa é a soma dos passos (`buildTowerStages` usa as contagens).

**Testes** (`tests/unit/tower-kpis.test.ts`): o indicador comparado ao cálculo completo em cada quadrado, etapa, visão, exceções, totais e listas:

- logo depois da reconstrução;
- quando um prazo vence, sem gravação;
- 40 dias depois;
- depois de gravações;
- depois de uma revisão nova.

Outro teste confere que, com o indicador válido, a leitura são só as duas consultas.

## Pendências

- **Parceiros e cliente** (a tela inicial deles): leem só as etapas dos próprios pedidos (`involvedOrderIds`, a regra de `isInvolved`). Antes, liam as 13 mil etapas em andamento e os 50 mil itens pendentes.
- **Wellmix: lista pronta por pedido (formato 6, 14/11/2026).** Decisão do dono: as pendências por pedido ficam guardadas no resumo de cada pedido (`order_summaries.tasks`, `StoredTasks` em `src/lib/services/order-summary.ts`), atualizadas por evento e reconstruídas toda noite. A tela de Pendências e o painel de SLA (opção `team`) leem só as linhas com pendência (coluna `hasTasks`, com índice) e não leem pedidos, passos de embarque, produção, artes nem pagamentos. Assim a tela não depende do número de pedidos: no go-live, os 16 mil do histórico voltam a contar só quando tiverem pendência.
- **Pedido em espera** (`held`, histórico do Sankhya): não guarda pendência nenhuma (`hasTasks` falso).

O que cada pedido guarda:

| Tipo                                  | O que fica no resumo                                                                                                                                                                      | O que a leitura decide                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Etapas (itens pendentes)              | a pendência pronta e a ordem da etapa (`stageTaskDrafts`, as mesmas para toda a equipe)                                                                                                   | só o prazo                                                                                                                                                                                                                                                                                                                     |
| Produção (follow 5/15/25, reinspeção) | todos os follows ainda não registrados, com a data, e a reinspeção (`wellmixProductionCandidates`)                                                                                        | o follow aparece quando a data passa (`dueProductionCandidates`)                                                                                                                                                                                                                                                               |
| Embarque, desembaraço e certificação  | os passos que pedem algo da Wellmix agora (`wellmixImportCandidates`): fazer ou validar, quem enviou, o papel de quem faz ou valida e, no rastreio do container, o dia do último registro | para quem é (`routeImportCandidates`): a rota da certificação (`Route`, pelo encaminhamento do momento), o dono (`routeOwnerUserId`), quem enviou não valida, as funções do login (financeiro, comex interno, validar arte), a arte pela agência (Configurações) e o rastreio que volta quando o último registro não é de hoje |
| Artes (corrigir, conferir)            | as não conformidades abertas ou corrigidas: quem apontou, quem corrigiu, datas e o nome do item                                                                                           | para quem é (`routeArtIssue`): a rota, o dono e quem pode validar arte                                                                                                                                                                                                                                                         |
| "Pagar fornecedor" (admin)            | as parcelas em aberto vencidas, vencendo ou agendadas, com vencimento, valor, moeda e o nome do fornecedor (`payableFor`, como em Contas a pagar)                                         | a situação do dia (`installmentStatusOn`): vencida ou vencendo em 7 dias                                                                                                                                                                                                                                                       |

Junto vai o pedido só com o que as pendências e o encaminhamento leem (`TaskOrder`: número, cliente, solicitação, situação, fluxo, analista, designer, agência, despachante e os outros parceiros) e a ordem do pedido (criação, id), para a lista sair na mesma ordem de antes.

**Por que a rota não é gravada pronta.** Quem recebe a certificação e a arte depende da equipe ativa, das funções e das Configurações (arte feita pela agência), que mudam sem gravar no pedido. O resumo guarda o que a rota usa (os campos do pedido, quem enviou, quem apontou e quem corrigiu) e a leitura calcula a rota com o encaminhamento do momento (`loadRoutingContext`: usuários ativos, funções e configurações, tabelas pequenas). Trocar o analista, o designer ou o despachante grava no pedido e marca o resumo.

**Prazos que vencem sem gravação.** O follow guarda a data; o rastreio do container guarda o dia do último registro; a parcela guarda o vencimento e a situação é refeita com o dia da leitura. Nada disso precisa de job.

**Mesma regra nos dois caminhos.** As funções puras (`wellmixProductionCandidates`, `wellmixImportCandidates` e `routeImportCandidates`, `routeArtIssue`) também montam o caminho pelas tabelas, que segue igual sem os resumos prontos.

**Recálculo por evento.** As gravações que mudam essas pendências já marcam o pedido: o próprio pedido (situação, espera, analista, designer, parceiros, condição de pagamento), etapas, requisitos (certificado do pedido de compra, marcos do cronograma), itens (nome na arte), pagamentos, passos de embarque e certificação, produção, inspeção por SKU, artes e o nome ou a condição de pagamento do fornecedor. Equipe, funções e configurações não precisam: entram na leitura.

**Testes** (`tests/unit/tasks-ready-list.test.ts`): cada login da Wellmix, também com a opção `team`, recebe a mesma lista pelos dois caminhos, com cada tipo presente; também 1, 6, 15 e 22 dias depois sem gravação (follow de 25 dias, rastreio, 2ª parcela), depois de gravações (follow registrado, analista, despachante, designer, pagamento, arte aceita) e com o encaminhamento mudado sem gravar no pedido (arte pela agência desligada, operador inativo). Outro teste confere que a leitura não toca `import_steps`, `production_tracks`, `sku_inspections`, `art_issues` nem `payments`, e que pedidos só são lidos por id. O pedido em espera não guarda nada.

**Fora da lista pronta** (seguem calculadas na hora):

- as do fornecedor, dos parceiros, da agência e do cliente, que leem só os pedidos deles;
- solicitações novas, revisão, Sourcing, mensagens, amostragem e NCM, que não são por pedido;
- a programação de compra do admin (etapas de Preparação em andamento e os pedidos delas, por id).

## Indicadores prontos do Overview dos blocos (`kpi_snapshots`, chave "flow")

Pedido do dono (14/11/2026): o Overview de Produto novo, Pedido, Produção e Entrega (docs/FLOW_MENU.md) lê os números de uma linha só.

**Regra única** (`src/lib/services/flow-contribution.ts`, pura): em que passo o pedido está (`orderFlowEntries`: itens de etapa abertos das etapas em andamento, passos do embarque, da origem, da certificação e das amostras, produção em andamento, recebimento no CD e pré-produção) e a contribuição dele (`buildOrderFlow`). O "Todos no passo" lido das tabelas usa a mesma função, com as leituras em lote (antes, uma leitura das amostras por pedido).

**Contribuição de cada pedido** (`order_summaries.kpi.f`, `OrderFlow`, desde o formato 10 do resumo): número, situação, fornecedor, os passos em que está e desde quando, a completude de Pedido, Produção e Entrega e a geral, o prazo mais antigo das etapas abertas de cada bloco e o início de cada bloco. Só datas e números: o atraso é contado na leitura. Pedido encerrado ou cancelado não contribui. O pedido do histórico em espera (formato 11) contribui só com o número, a situação e o fornecedor (`h`), para o contador e a lista à parte do Overview (`held` na linha agregada, `heldStepOf`).

**Agregado** (`src/lib/services/flow-kpis.ts`, `rebuildFlowKpis`):

- lê só `kpi->f` dos resumos em andamento (`live`);
- monta as linhas de cada bloco (`entitiesFromFlows`) e as do Produto novo das tabelas pequenas (books, convites e solicitações ao fornecedor, lidas na hora; `newProductData`);
- soma por bloco (quantas, atrasadas, completude média do bloco e geral, a mais antiga) e por passo (`aggregateFlow`);
- grava a linha com `validUntil`: o próximo instante em que um atraso muda (um dia inteiro depois do prazo de uma etapa aberta; o prazo do convite e o SLA da negociação).

**Quando é refeito:** junto com o da Control Tower, a cada leva de gravações (pedido, etapa, item, embarque, recebimento…; book, convite e solicitação ao fornecedor marcam `kpi`), no fim da reconstrução dos resumos e antes da leitura, se o `validUntil` passou. Mudou o formato? Suba `FLOW_KPI_VERSION` (a linha) ou `SUMMARY_VERSION` (a contribuição).

**Tela:** os números vêm da linha pronta; a tabela, da contribuição dos pedidos em andamento (o bloco aberto) ou das tabelas pequenas (Produto novo). Sem os resumos em uso (marcador ausente ou de outro formato), tudo é somado das tabelas pela mesma regra (`flowOverviewKpis`).

**Testes** (`tests/unit/flow-kpis.test.ts`): números e listas de cada bloco pelo resumo e pelas tabelas, iguais logo depois da reconstrução, quando um prazo vence (um dia depois, sem gravação), 40 dias depois e depois de gravações; com a linha válida, a leitura não toca etapas, itens, pedidos nem passos do embarque.

## Painel de SLA

- **"No prazo"** (indicador `kpi_snapshots`, chave "sla.done"): as etapas concluídas com prazo nos últimos 30 dias. É refeito quando uma etapa com prazo é concluída ou reaberta, e quando a primeira sai da janela. Antes, a tela lia as cerca de 31 mil etapas concluídas a cada abertura.
- **Pendências por pessoa:** vêm das Pendências, agora leves. Os atrasos de parceiros leem só as colunas usadas das etapas em andamento.

## Container e sugestões de produto

- **Escolha de itens do container:** lê só as colunas usadas de pedidos e itens. A lista em si continua com todos os itens dos pedidos em aberto. Uma busca no lugar da lista é decisão de tela, do dono.
- **Sugestões para completar o container:** leem só os pedidos dos clientes dos containers em planejamento ou carga.

## O que ainda pesa

1. **Pedidos:** a lista ainda lê todos os pedidos, as solicitações e as partes do resumo de todos para filtrar e ordenar no servidor (página de 50). Desde 14/11/2026 os itens são lidos só da página. Com filtro de produto, a tela lê nome e variação de todos os itens.
2. **Escolha de itens do container:** a lista do formulário tem todos os itens dos pedidos em aberto.
3. **Programação de compra do admin nas Pendências:** lê as etapas de Preparação em andamento e os pedidos delas.
4. **Documentos do embarque nas Pendências** (`shippingDocTasks`, docs/SHIPPING_DOCS.md): lê os pedidos de compra em inspeção ou embarque e, de cada um, o container vazio, os itens e os documentos. São poucos pedidos; entram na lista pronta se crescerem.
5. **Recebimento no show room nas Pendências** (`showroomTasks`, docs/SAMPLE_FLOW.md): lê o passo `samples_brazil` pela chave (envios das amostras ao Brasil), os pedidos deles por id e os recebimentos já registrados. Entra na lista pronta se crescer.

As tarefas de embarque, produção, artes e "Pagar fornecedor" da Wellmix saíram desta lista em 14/11/2026 (lista pronta, acima).
