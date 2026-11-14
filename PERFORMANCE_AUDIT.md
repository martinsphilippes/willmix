# Auditoria de performance — Portal Wellmix

Início: 14/11/2026. Responsável: Claude (sessão autônoma pedida pelo dono).
Este arquivo é atualizado a cada etapa (o que foi medido, o que mudou, o que falta).
Medições de produção são **somente leitura** (estatísticas do Postgres, `EXPLAIN`,
logs e erros da Vercel). Nada foi alterado direto em produção: toda mudança vai
por PR para `wellmix`, com testes, como manda o `CLAUDE.md`.

## Como retomar

1. Ler a seção **Estado** e a **Matriz** abaixo.
2. Evidência de produção: consultas da seção **Como medir** (Supabase MCP,
   projeto `rokbtrvkzllowyqzcauq`; Vercel MCP, time `team_KE0D4tFPVnAvcJpOhxsrbH5G`,
   projeto `prj_4v6dAgUxYt1Dde0Y60UMiPNEaavs`).
3. Próximos itens: seção **Pendências**.

## Estado

| Etapa                                                                                          | Situação                                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Arquitetura e inventário de rotas                                                              | feito                                                           |
| Evidência de produção (banco, Vercel)                                                          | feito (janela de 10 h do `pg_stat_statements`, 7 dias de erros) |
| PR 1 — leitura em páginas por keyset, sem contagem; resumos refeitos sozinhos depois de deploy | em entrega                                                      |
| PR 2 — tela Pedidos e financeiro sem ler tabelas inteiras                                      | pendente                                                        |
| Linha de base por tela (local, volume de produção sintético)                                   | pendente                                                        |

## A. Arquitetura identificada

- **Next.js 16.3.6 (App Router) + React 19.2.8**, TypeScript, Tailwind 4. Server
  Components leem no servidor; toda escrita é Server Action (`src/app/app/actions*`).
  `src/proxy.ts` (o antigo middleware) só confere se há cookie de sessão em `/app/*`;
  a sessão real é validada em cada página (`getCurrentUser`, com `cache` do React).
- **Banco:** Supabase (Postgres 17.11, `sa-east-1`), acessado pelo PostgREST com a
  chave `service_role` (`src/lib/db/supabase-store.ts`). Sem ORM: um `Store` com
  `list/get/create/update/updateWhere/count/upsertMany`; `CachedStore` memoriza
  leituras por requisição (`DB_TRACE=1` registra cada chamada). Modo memória
  (`DATA_MODE=memory`) para desenvolvimento e testes. Appwrite parado desde 11/11.
- **Hospedagem:** Vercel, plano Pro, região de funções `gru1` (São Paulo) — a mesma
  do banco (`sa-east-1`): **não há latência entre regiões**. Node 24. Páginas com
  `maxDuration` padrão de **60 s**; jobs com 60–300 s.
- **Resumos prontos** (`docs/RESUMOS.md`): `order_summaries` (um JSON `facts` por
  pedido) e `kpi_snapshots`, atualizados por evento e reconstruídos às 03:05 UTC
  (`/api/jobs/summaries`). Telas leem o resumo **somente** quando o marcador
  `settings.orderSummaries.version` é igual a `SUMMARY_VERSION` do código; senão,
  caem no caminho antigo (tabelas inteiras).
- **Integrações:** Sankhya (ERP: carga e sincronização por jobs), Supabase Storage
  (arquivos em `/api/files/[id]`), e-mail/lembretes por cron.
- **Prévias da Vercel:** não têm `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (só
  produção) — as prévias não conseguem abrir telas com dados. Limitação registrada:
  não há ambiente de teste com volume real; a validação de tela é local (modo
  memória) e a de banco é por `EXPLAIN` somente leitura.

Fluxo de uma tela: navegador → CDN da Vercel → função `gru1` (proxy confere o
cookie) → layout `/app` (sessão, mensagens não lidas, sino, **contadores do menu =
cálculo das Pendências**, desde o PR #394) → página (leituras pelo `Store`) →
PostgREST → Postgres → HTML/RSC.

### Volume real (14/11/2026)

| Tabela          |  Linhas |                         Tamanho |
| --------------- | ------: | ------------------------------: |
| requirements    | 612.945 |                          487 MB |
| order_items     | 184.328 |                          169 MB |
| stages          | 161.468 |                          116 MB |
| order_summaries |  16.270 | 84 MB (`facts` = 44 MB de JSON) |
| orders          |  16.270 |                           59 MB |
| parties         |  32.419 |                           36 MB |
| payments        |  25.697 |                           29 MB |
| products        |  16.842 |                           24 MB |
| requests        |  15.742 |                           13 MB |

Dos 16.270 pedidos, **16.268 são histórico do Sankhya em espera (`held`)** e só 2
estão no fluxo. Toda tela que lê "todos os pedidos" carrega 8 mil vezes mais do que
o trabalho do dia.

### Inventário de rotas (101 telas + 22 rotas de API)

Telas (`src/app/**/page.tsx`): `/login`, `/login/forgot`, `/login/reset`, `/app`,
`/app/account`, `/app/after-sales`, `/app/audit`, `/app/booking`,
`/app/booking/import`, `/app/booking/invite/[itemId]`, `/app/booking/lots/[id]`,
`/app/booking/selection`, `/app/commissions`, `/app/commissions/agreements/[id]`,
`/app/containers`, `/app/containers/[id]`, `/app/customers`, `/app/customers/[id]`,
`/app/customers/[id]/orders/[orderId]`, `/app/dashboards`, `/app/dashboards/cashflow`,
`/app/dashboards/owner`, `/app/explore`, `/app/explore/[id]`, `/app/explore/cart`,
`/app/finance`, `/app/freight`, `/app/freight/[id]`, `/app/freight/tariff`,
`/app/history`, `/app/import`, `/app/import/[batchId]`, `/app/inventory`,
`/app/inventory/counts`, `/app/inventory/counts/[id]`, `/app/inventory/movements`,
`/app/inventory/reservations`, `/app/lines`, `/app/marketing`, `/app/marketing/[id]`,
`/app/marketing/new`, `/app/marketing/price-table`, `/app/messages`,
`/app/messages/control`, `/app/ncm-items`, `/app/notifications`, `/app/orders`,
`/app/orders/[id]` (+ `die-cut`, `invoice`, `purchase-order`, `purchase-sheet`,
`real-media`, `samples`, `shipping-docs`), `/app/parties`, `/app/parties/[id]`,
`/app/parties/access`, `/app/parties/new`, `/app/parties/types`, `/app/password`,
`/app/payables`, `/app/penalties`, `/app/production`, `/app/products`,
`/app/products/[id]`, `/app/products/[id]/tax`, `/app/products/import`,
`/app/products/import/[batchId]`, `/app/requests`, `/app/requests/[id]`,
`/app/requests/[id]/ncm`, `/app/requests/batch/[groupId]`, `/app/requests/new`,
`/app/reviews`, `/app/settings` (+ `go-live`, `reset`, `sankhya`, `summaries`,
`supabase`), `/app/sla`, `/app/sourcing` (+ `items/[id]`, `items/new`,
`visits/[id]`, `visits/new`), `/app/superplan`, `/app/supplier-requests`
(+ `[id]`, `invites`, `invites/[id]`), `/app/suppliers`, `/app/suppliers/[id]`,
`/app/suppliers/[id]/orders/[orderId]`, `/app/suppliers/scorecard`, `/app/tasks`,
`/app/tasks/desk`, `/app/team`, `/app/team/[id]`.

APIs (`route.ts`): `/api/admin/seed`, `/api/auth/session`, `/api/files/[id]`,
`/api/freight-tariff/[id]/sankhya`, `/api/health`, `/api/jobs/fiscal`,
`/api/jobs/reminders`, `/api/jobs/sankhya-load`, `/api/jobs/sankhya-sync`,
`/api/jobs/summaries`, `/api/marketing/price-table`, `/api/orders/[id]/artwork`,
`/api/orders/[id]/purchase-order`, `/api/parties/search` e as exportações
(`/app/*/export`).

A matriz por tela (tempo, leituras, linhas) está na seção **G**; as telas sem
medição aparecem como "não medida" — nenhuma é dada como validada sem medição.

## B. Vercel (somente leitura)

- Projeto `wellmix`, plano Pro, Node 24.x, região `gru1`, produção em
  `portal-wellmix.vercel.app` / `portal.wellmix.com.br`. Proteção por SSO só nas
  prévias.
- **Erros de produção (7 dias, `get_runtime_errors`):**
  - 313× `Task timed out after 60 seconds` (e alguns de 300 s) — `/app`,
    `/app/orders`, `/app/orders/[id]`, `/app/tasks`, `/app/settings/summaries`,
    `/app/settings/sankhya`, `/api/jobs/sankhya-load`; 7 usuários; último às
    07:40 UTC de 14/11.
  - 30× `instance was killed because it ran out of available memory` — `/app`,
    `/app/orders`, `/app/tasks`, `/app/messages`, `/app/settings/reset`.
  - 8× `canceling statement due to statement timeout` (57014) — `/app/tasks`,
    `/app/customers/[id]`, `/app/orders`, `/app`.
  - 6× `Response body object should not be disturbed or locked` em
    `/api/files/[id]` (a investigar; pendência P2).
- Sem acesso a métricas de duração por rota (Observability da Vercel não está
  disponível neste plano pelo MCP) e logs retidos só 1 dia.

## C. Banco (somente leitura)

Janela do `pg_stat_statements`: 13/11 23:40 UTC → 14/11 09:32 UTC (~10 h).

| #   | Consulta (PostgREST)                                                 | Chamadas |  Média |   Total |
| --- | -------------------------------------------------------------------- | -------: | -----: | ------: |
| 1   | `order_items.*` inteira, `ORDER BY createdAt,id LIMIT 1000 OFFSET n` |    4.254 | 639 ms | 2.717 s |
| 2   | `order_items(id,orderId,name)` inteira, idem                         |    4.254 | 622 ms | 2.648 s |
| 3   | `order_items` (7 colunas, a da tela Pedidos) inteira                 |    2.533 | 465 ms | 1.177 s |
| 4   | `requirements` por `orderId IN` + `key IN` (com contagem)            |    5.987 |  51 ms |   306 s |
| 5   | `stages` por `orderId IN` (com contagem)                             |    3.217 |  56 ms |   180 s |
| 6   | `orders.*` inteira por `number desc`                                 |      320 | 519 ms |   166 s |
| 7   | `order_summaries.*` inteira por `number desc`                        |      240 | 691 ms |   166 s |
| 8   | `payments` inteira (colunas)                                         |      621 | 240 ms |   149 s |
| 9   | `parties` ativas inteiras por nome                                   |      536 | 224 ms |   120 s |

**Achados confirmados:**

1. **P0 — resumos "fora de formato" depois de cada deploy.** O banco está com os
   resumos na versão **6** (reconstruídos às 03:07 UTC); o código publicado exige a
   **8** (`SUMMARY_VERSION` subiu às 01:44 e 03:44 UTC). Até a reconstrução da
   madrugada seguinte, **todas** as telas que usam o resumo caem no caminho antigo
   e leem tabelas inteiras (consultas 1–3, 6, 8, 9). É a causa direta dos timeouts
   e da falta de memória.
2. **P0 — paginação por OFFSET custa N².** Cada página de 1.000 linhas obriga o
   Postgres a reler todas as linhas puladas. Medido com `EXPLAIN (ANALYZE, BUFFERS)`
   em produção, página no deslocamento 150.000 de `order_items`:
   - OFFSET: **672 ms**, 147.969 blocos lidos;
   - keyset na forma `createdAt >= v AND (createdAt > v OR id > id)`: **6,2 ms**,
     992 blocos (**108× menos**);
   - keyset na forma `OR` pura (`createdAt > v OR (createdAt = v AND id > id)`):
     **1.218 ms** — o Postgres não usa o índice; por isso a forma escolhida é a
     primeira.
     Ler `order_items` inteira: ~185 páginas × ~630 ms ≈ **117 s de banco** por
     leitura, contra ~185 × 6 ms ≈ 1,1 s com keyset.
3. **P1 — `Prefer: count=exact` em toda lista.** A primeira página de cada lista
   pedia a contagem exata, e o PostgREST rodava a consulta de novo inteira só para
   contar (o `pgrst_source_count` das consultas 4 e 5).
4. Índices: `createdAt,id` existe em todas as tabelas; `orderId` nas filhas;
   parciais `held IS NOT TRUE` nas pendências. **Nenhum índice novo é necessário**
   para as correções do PR 1 (o keyset usa os índices existentes).

## D. Frontend

- Tela Pedidos já filtra, ordena e pagina no servidor (50 grupos por página), mas
  **monta as linhas a partir de todos os pedidos, todos os itens (184 mil) e todas
  as solicitações** a cada abertura (`pipelineFor`). Pendência P0 do PR 2.
- Layout `/app`: desde o PR #394 calcula as Pendências inteiras do login em cada
  carga completa de página (contadores do menu). Com os resumos em dia é barato;
  sem eles, repete o trabalho pesado da tela Pendências em todas as telas. Mitigado
  pelo item 1 (resumos refeitos sozinhos); medir no PR 2.

## E. APIs

- `/api/jobs/summaries` (reconstrução em partes, 4 min por rodada, encadeada) — ok.
- `/api/files/[id]`: 6 erros "body disturbed or locked" (P2, a investigar).

## F. Matriz de prioridades

| Problema                                                                                       | Local                                              | Evidência                                                             | Sev. | Causa raiz                                                     | Solução                                                                                                                                     | Risco                                                                         | Ganho esperado                                                | Ganho medido                                 | Status              |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | ------------------- |
| Resumos fora de formato após deploy derrubam todas as telas no caminho antigo                  | `src/lib/services/order-summary.ts` (`readMarker`) | marcador v6 × código v8; consultas 1–3, 6, 8, 9; 313 timeouts, 30 OOM | P0   | `SUMMARY_VERSION` sobe no deploy, reconstrução só às 03:05 UTC | `summary-kick.ts`: a 1ª tela que vê o formato antigo pede ao job da reconstrução (produção, só para cima, 1×/2 min/instância, trava do job) | Baixo                                                                         | Janela lenta de até 24 h cai para os ~2–4 min da reconstrução | a medir após o deploy (marcador na versão 8) | implementado (PR 1) |
| Paginação por OFFSET (N²)                                                                      | `SupabaseStore.list`                               | EXPLAIN 672 ms × 6,2 ms; consultas 1–3, 6–9                           | P0   | OFFSET relê as linhas puladas                                  | Keyset `col >= v AND (col > v OR id > id)`, faixa dos nulos tratada como no Postgres                                                        | Baixo (mesma ordem e conjunto; testes com nulos, repetidos, asc/desc, limite) | 10–100× menos banco por página em listas longas               | EXPLAIN: 108× numa página de `order_items`   | implementado (PR 1) |
| Contagem exata em toda lista                                                                   | `SupabaseStore.list`                               | `pgrst_source_count` nas consultas 4–5                                | P1   | `Prefer: count=exact` na 1ª página                             | Sem contagem: para quando a página vem incompleta                                                                                           | Baixo                                                                         | até ~metade do custo das listas filtradas                     | a medir no `pg_stat_statements`              | implementado (PR 1) |
| Tela Pedidos lê todos os itens (184 mil)                                                       | `pipelineFor`                                      | consulta 3 (2.533 × 465 ms); timeouts e OOM em `/app/orders`          | P0   | itens de todos os pedidos para mostrar o 1º produto e filtrar  | itens só da página; nome do 1º produto e busca por produto sem a tabela inteira                                                             | Médio                                                                         | `/app/orders` sem leitura de 184 mil linhas                   | —                                            | pendente (PR 2)     |
| Financeiro lê todos os pagamentos e itens (caminho antigo) ou todos os resumos (52 MB de JSON) | `finance.ts` (`financeLookup`, `loadFinance`)      | consultas 2, 7, 8                                                     | P1   | leitura de todos os pedidos para a tela                        | colunas e linhas necessárias                                                                                                                | Médio                                                                         | —                                                             | —                                            | pendente (PR 2)     |
| `/api/files/[id]` "body disturbed or locked"                                                   | `src/app/api/files/[id]/route.ts`                  | 6 erros em 7 dias                                                     | P2   | a investigar                                                   | —                                                                                                                                           | —                                                                             | —                                                             | —                                            | pendente            |

## G. Antes e depois

| Medida                                                            | Antes                   | Depois                                                             | Como                                                 |
| ----------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Página de 1.000 linhas no deslocamento 150 mil (`order_items`)    | 672 ms / 147.969 blocos | 6,2 ms / 992 blocos                                                | `EXPLAIN (ANALYZE, BUFFERS)` em produção, só leitura |
| Leitura inteira de `order_items` (estimada pelas páginas medidas) | ~117 s de banco         | ~1,1 s de banco                                                    | 185 páginas × tempo medido                           |
| Resumos em formato antigo após deploy                             | até ~24 h               | ~2–4 min (tempo da reconstrução noturna medida: 03:05 → 03:07 UTC) | marcador em `settings`                               |

Telas: ainda não medidas (sem acesso de usuário em produção — as contas de
demonstração estão desligadas lá por decisão do dono, e não serão usadas). A linha
de base por tela será local, em modo memória com volume sintético igual ao de
produção.

## H. Registro de alterações

PR 1:

- `src/lib/db/supabase-store.ts`: páginas por keyset (`keysetAfter`), sem
  `Prefer: count=exact` nas listas.
- `src/lib/services/summary-kick.ts` (novo) e `order-summary.ts` (`readMarker`).
- Testes: `tests/unit/supabase-store.test.ts` (PostgREST falso com árvore lógica,
  `gte/lte`, ordem de nulos do Postgres; casos de keyset), `tests/unit/summary-kick.test.ts`.

Rollback: reverter o merge do PR (sem migração, sem dado alterado). O keyset não
depende de índice novo; o pedido de reconstrução só chama o job que já roda toda
noite.

## Como medir (consultas usadas)

```sql
-- Tabelas maiores
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)), seq_scan, idx_scan
from pg_stat_user_tables where schemaname='public' order by pg_total_relation_size(relid) desc limit 40;
-- Consultas mais caras
select calls, mean_exec_time, total_exec_time, left(query, 260)
from extensions.pg_stat_statements order by total_exec_time desc limit 30;
-- Formato dos resumos gravados
select value->>'version', value->>'builtAt' from settings where key = 'orderSummaries';
```

## Pendências

- PR 2: tela Pedidos (`pipelineFor`) e financeiro sem ler tabelas inteiras.
- Linha de base local por tela, com volume de produção sintético.
- Conferir no `pg_stat_statements` (depois do deploy do PR 1) o fim das leituras
  com OFFSET e a queda das médias.
- `/api/files/[id]`: erro "body disturbed or locked".
