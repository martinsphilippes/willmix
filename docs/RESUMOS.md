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
- as parcelas ao fornecedor (situação e vencimento).

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

## Próximas etapas (plano aprovado em 12/11/2026)

1. Pedidos, Financeiro, Fluxo de caixa, Painel do dono e Contas a pagar lendo do resumo (`facts.money` e `facts.installments` já estão lá).
2. Resumo por parceiro (saldo, pedidos, totais) para Clientes, Fornecedores e Conta corrente. Parceiros e produtos lidos só pelos ids da tela, em vez do cadastro inteiro (umas 20 telas).
3. Jobs com uma consulta por item: lembretes (`runReminders`) e a distribuição de solicitações (`distributeUnassigned`).
