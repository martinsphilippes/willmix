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

| Etapa                                                                                                 | Situação                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Arquitetura e inventário de rotas                                                                     | feito                                                           |
| Evidência de produção (banco, Vercel)                                                                 | feito (janela de 10 h do `pg_stat_statements`, 7 dias de erros) |
| PR 1 (#396) — leitura em páginas por keyset, sem contagem; resumos refeitos sozinhos depois de deploy | mesclado em 14/11, 10:15 UTC                                    |
| PR 2 — só as partes do resumo que cada tela usa; Pedidos sem ler todos os itens (formato 9)           | em entrega                                                      |
| Linha de base por tela (local, volume de produção sintético)                                          | pendente                                                        |

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

| Problema                                                                                            | Local                                                                            | Evidência                                                                                                              | Sev. | Causa raiz                                                                                                               | Solução                                                                                                                                           | Risco                                                                         | Ganho esperado                                                               | Ganho medido                                                                                                                                                                      | Status                                      |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Resumos fora de formato após deploy derrubam todas as telas no caminho antigo                       | `src/lib/services/order-summary.ts` (`readMarker`)                               | marcador v6 × código v8; consultas 1–3, 6, 8, 9; 313 timeouts, 30 OOM                                                  | P0   | `SUMMARY_VERSION` sobe no deploy, reconstrução só às 03:05 UTC                                                           | `summary-kick.ts`: a 1ª tela que vê o formato antigo pede ao job da reconstrução (produção, só para cima, 1×/2 min/instância, trava do job)       | Baixo                                                                         | Janela lenta de até 24 h cai para os ~2–4 min da reconstrução                | **medido:** deploy 10:10 UTC; 1ª tela às ~10:18; job chamado; versão 8 gravada às 10:20:22 (116,6 s, 16.270 pedidos)                                                              | validado em produção (PR 1)                 |
| Paginação por OFFSET (N²)                                                                           | `SupabaseStore.list`                                                             | EXPLAIN 672 ms × 6,2 ms; consultas 1–3, 6–9                                                                            | P0   | OFFSET relê as linhas puladas                                                                                            | Keyset `col >= v AND (col > v OR id > id)`, faixa dos nulos tratada como no Postgres                                                              | Baixo (mesma ordem e conjunto; testes com nulos, repetidos, asc/desc, limite) | 10–100× menos banco por página em listas longas                              | EXPLAIN: 108× numa página de `order_items`; produção (`pg_stat_statements`, após o deploy): páginas de `order_summaries` 7–15 ms (antes 691 ms), `orders` 6 ms (antes 430–519 ms) | validado em produção (PR 1)                 |
| Contagem exata em toda lista                                                                        | `SupabaseStore.list`                                                             | `pgrst_source_count` nas consultas 4–5                                                                                 | P1   | `Prefer: count=exact` na 1ª página                                                                                       | Sem contagem: para quando a página vem incompleta                                                                                                 | Baixo                                                                         | até ~metade do custo das listas filtradas                                    | a medir no `pg_stat_statements`                                                                                                                                                   | implementado (PR 1)                         |
| Tela Pedidos lê todos os itens (184 mil)                                                            | `pipelineFor`                                                                    | consulta 3 (2.533 × 465 ms); timeouts e OOM em `/app/orders`                                                           | P0   | itens de todos os pedidos para mostrar o 1º produto e filtrar                                                            | itens só da página; nome do 1º produto e busca por produto sem a tabela inteira                                                                   | Médio                                                                         | `/app/orders` sem leitura de 184 mil linhas                                  | a medir após o deploy                                                                                                                                                             | implementado (PR 2)                         |
| Financeiro lê todos os pagamentos e itens (caminho antigo) ou todos os resumos (52 MB de JSON)      | `finance.ts` (`financeLookup`, `loadFinance`)                                    | consultas 2, 7, 8                                                                                                      | P1   | leitura de todos os pedidos para a tela                                                                                  | colunas e linhas necessárias                                                                                                                      | Médio                                                                         | menos JSON por leitura (só `pays`, `customer`, `supplier`, `product`, `pop`) | a medir                                                                                                                                                                           | implementado (PR 2: só as partes do resumo) |
| Histórico comercial lê pedidos, itens e solicitações inteiros (todas as colunas) e busca quadrática | `history.ts` (`loadCommercialHistory`)                                           | código: `store.list("orders"/"order_items"/"requests")` sem filtro; `requests.filter` dentro do laço de 16 mil pedidos | P1   | leitura de tudo + 16 mil × 16 mil comparações                                                                            | colunas usadas; itens só dos pedidos do cliente filtrado; reposições só das solicitações de reposição/proposta; mapas no lugar de `filter`/`find` | Baixo                                                                         | sem a cópia do ERP (~60% de pedidos e itens) e sem o laço quadrático         | a medir                                                                                                                                                                           | implementado (PR 2)                         |
| Revisões, Pós-venda e Multas leem todos os pedidos para achar poucos                                | `reviews/page.tsx`, `after-sales/page.tsx`, `penalties/page.tsx`                 | código: `store.list("orders")` sem filtro + `orders.find` por linha                                                    | P1   | busca do número/situação do pedido                                                                                       | `listByIds` só dos pedidos citados + mapa                                                                                                         | Baixo                                                                         | de ~50 MB (16 mil pedidos com a cópia do ERP) para os poucos pedidos citados | a medir                                                                                                                                                                           | implementado (PR 2)                         |
| Parceiros, Clientes e Fornecedores renderizam todas as linhas                                       | `parties/page.tsx`, `_party-accounts/list.tsx`                                   | medido local (servidor compilado, 32 mil parceiros sintéticos): 108 MB / 5,2 s; 281 MB / 19 s; 54 MB / 3,6 s           | P0   | lista inteira no HTML; a TableTools só escondia as linhas                                                                | busca, ordem e página no servidor acima de 200 linhas (`server-table.ts`), mesmas regras da TableTools                                            | Baixo                                                                         | KB em vez de centenas de MB                                                  | 258 KB / 0,25 s; 625 KB / 0,30 s; 560 KB / 0,10 s (local)                                                                                                                         | implementado (PR 3)                         |
| Histórico, Contas a pagar, Solicitações e Financeiro renderizam todas as linhas                     | `history/page.tsx`, `payables/page.tsx`, `requests/page.tsx`, `finance/page.tsx` | local, volume de produção: 266 MB/25,7 s; 182 MB/14,7 s; 134 MB/16,6 s; 129 MB/14,9 s                                  | P0   | lista inteira no HTML (e no Histórico, tabela + cartões + seletor com 26 mil clientes)                                   | ordem e página no servidor acima de 200 linhas; filtro de cliente por busca                                                                       | Baixo                                                                         | KB em vez de centenas de MB                                                  | 890 KB/1,1 s; 951 KB/2,6 s; 516 KB/0,7 s; 491 KB/1,4 s (local)                                                                                                                    | implementado (PR 4)                         |
| Configurações com um campo de margem por cliente                                                    | `pricing-settings.tsx`, `settings/page.tsx`                                      | local: 62 MB (26 mil campos)                                                                                           | P1   | lista de todos os clientes no formulário                                                                                 | cadastro grande: só os clientes com margem própria + busca para incluir (mesmos campos e gravação)                                                | Baixo                                                                         | 62 MB → KB                                                                   | 242 KB/0,2 s (local)                                                                                                                                                              | implementado (PR 4)                         |
| Conta de cada cliente percorria todos os pedidos (N×M)                                              | `customer-accounts.ts` (`accountOf`)                                             | local: `/app/customers` 31,9 s de servidor                                                                             | P1   | `finance.filter` e `requests.filter` por empresa (26 mil × 16 mil)                                                       | agrupar uma vez por empresa, na mesma ordem                                                                                                       | Baixo                                                                         | ~20× menos CPU                                                               | 1,7 s (local)                                                                                                                                                                     | implementado (PR 4)                         |
| `/api/files/[id]` "body disturbed or locked" e exportações executadas sem clique                    | `TextLink`/`LinkButton` (`src/components/ui.tsx`)                                | 6 erros em 7 dias, rota `/api/files/[id].rsc` (pedido RSC = pré-carregamento do `<Link>`)                              | P1   | o Next pré-carrega todo `<Link>` visível; para rota de API/exportação isso executa a rota (baixa o arquivo, monta o CSV) | `prefetch={false}` automático para `/api/...` e `.../export`                                                                                      | Baixo                                                                         | sem downloads e exportações fantasmas a cada tela                            | a medir (erros `.rsc` devem sumir)                                                                                                                                                | implementado (PR 3)                         |

## G. Antes e depois

| Medida                                                            | Antes                                               | Depois                                                             | Como                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Página de 1.000 linhas no deslocamento 150 mil (`order_items`)    | 672 ms / 147.969 blocos                             | 6,2 ms / 992 blocos                                                | `EXPLAIN (ANALYZE, BUFFERS)` em produção, só leitura     |
| Leitura inteira de `order_items` (estimada pelas páginas medidas) | ~117 s de banco                                     | ~1,1 s de banco                                                    | 185 páginas × tempo medido                               |
| Resumos em formato antigo após deploy                             | até ~24 h                                           | ~2–4 min (tempo da reconstrução noturna medida: 03:05 → 03:07 UTC) | marcador em `settings`                                   |
| Resumos em formato antigo após o deploy do PR 1 (medido)          | v6 desde ~03:44 UTC até a reconstrução da madrugada | v8 às 10:20:22 UTC, 116,6 s depois do pedido da 1ª tela            | `settings.orderSummaries` + log de `/api/jobs/summaries` |
| Página de `order_summaries` (inteira, 1.000 linhas)               | 691 ms (média, 240 chamadas, OFFSET)                | 7,2–15,1 ms (média, 96 chamadas, keyset)                           | `pg_stat_statements` antes × depois do deploy            |
| Página de `orders`                                                | 430–519 ms (OFFSET)                                 | 6,2 ms (keyset)                                                    | `pg_stat_statements`                                     |
| Requisitos por pedidos (`orderId IN`, com contagem)               | 51–56 ms                                            | 35,9 ms (keyset, sem contagem)                                     | `pg_stat_statements`                                     |

Telas: ainda não medidas (sem acesso de usuário em produção — as contas de
demonstração estão desligadas lá por decisão do dono, e não serão usadas). A linha
de base por tela será local, em modo memória com volume sintético igual ao de
produção.

### Varredura de todas as telas sem parâmetro (local, volume de produção)

Servidor compilado (`next build` + `next start`), modo memória, login de
administrador, base sintética do tamanho da produção: 16 mil pedidos, 61 mil
itens, 16 mil solicitações, 16 mil pagamentos, 32 mil parceiros, 17 mil
produtos e 17 mil registros de auditoria. É medição local: mede o trabalho do
servidor e o tamanho da página, não a latência do banco de produção (no modo
memória a leitura é instantânea). As 37 telas com parâmetro (`[id]`) não
entraram nesta varredura; são telas de um registro.

Antes das entregas 4 em diante (com as entregas 1 a 3 já aplicadas):

| Tela                             | HTTP | Tempo do servidor (s) |     HTML |
| -------------------------------- | ---: | --------------------: | -------: |
| `/app`                           |  200 |                  0.35 |   110 KB |
| `/app/account`                   |  307 |                  0.05 |    37 KB |
| `/app/after-sales`               |  200 |                  0.05 |    68 KB |
| `/app/audit`                     |  200 |                  0.08 |   295 KB |
| `/app/booking`                   |  200 |                  0.07 |   103 KB |
| `/app/booking/import`            |  200 |                  0.03 |    74 KB |
| `/app/booking/selection`         |  200 |                  0.06 |   376 KB |
| `/app/commissions`               |  200 |                  0.04 |    78 KB |
| `/app/containers`                |  200 |                  0.51 |   6.7 MB |
| `/app/customers`                 |  200 |                 31.87 |   651 KB |
| `/app/dashboards`                |  200 |                  0.35 |    72 KB |
| `/app/dashboards/cashflow`       |  200 |                 11.38 |  51.0 MB |
| `/app/dashboards/owner`          |  200 |                  3.79 |    96 KB |
| `/app/explore`                   |  200 |                  4.29 |  70.3 MB |
| `/app/explore/cart`              |  307 |                  0.10 |    37 KB |
| `/app/finance`                   |  200 |                 14.87 | 123.1 MB |
| `/app/freight`                   |  200 |                  0.07 |    66 KB |
| `/app/freight/tariff`            |  200 |                  0.03 |    75 KB |
| `/app/history`                   |  200 |                 25.72 | 254.0 MB |
| `/app/import`                    |  200 |                  0.06 |    76 KB |
| `/app/inventory`                 |  200 |                  0.33 |    80 KB |
| `/app/inventory/counts`          |  200 |                  0.02 |    69 KB |
| `/app/inventory/movements`       |  200 |                  0.03 |    69 KB |
| `/app/inventory/reservations`    |  200 |                  0.03 |    70 KB |
| `/app/lines`                     |  200 |                  0.18 |    87 KB |
| `/app/marketing`                 |  200 |                  0.49 |   5.3 MB |
| `/app/marketing/new`             |  200 |                  1.25 |  11.9 MB |
| `/app/marketing/price-table`     |  200 |                  5.74 |  32.4 MB |
| `/app/messages`                  |  200 |                  0.77 |   8.6 MB |
| `/app/messages/control`          |  200 |                  0.04 |    76 KB |
| `/app/ncm-items`                 |  200 |                  0.04 |    78 KB |
| `/app/notifications`             |  200 |                  0.06 |   235 KB |
| `/app/orders`                    |  200 |                  2.33 |   399 KB |
| `/app/parties`                   |  200 |                  0.25 |   255 KB |
| `/app/parties/access`            |  200 |                  0.03 |   200 KB |
| `/app/parties/new`               |  200 |                  0.02 |    80 KB |
| `/app/parties/types`             |  200 |                  0.04 |   230 KB |
| `/app/password`                  |  200 |                  0.02 |    65 KB |
| `/app/payables`                  |  200 |                 14.74 | 173.5 MB |
| `/app/penalties`                 |  200 |                  0.04 |    63 KB |
| `/app/production`                |  200 |                  0.03 |    83 KB |
| `/app/products`                  |  200 |                  0.36 |   2.0 MB |
| `/app/products/import`           |  200 |                  0.13 |   1.6 MB |
| `/app/requests`                  |  200 |                 16.56 | 128.0 MB |
| `/app/requests/new`              |  200 |                  1.15 |  14.1 MB |
| `/app/reviews`                   |  200 |                  0.03 |    67 KB |
| `/app/settings`                  |  200 |                  2.23 |  59.3 MB |
| `/app/settings/go-live`          |  200 |                  0.19 |    66 KB |
| `/app/settings/reset`            |  200 |                 31.45 |    99 KB |
| `/app/settings/sankhya`          |  200 |                  0.04 |   103 KB |
| `/app/settings/summaries`        |  200 |                  0.03 |    66 KB |
| `/app/settings/supabase`         |  200 |                  0.03 |    65 KB |
| `/app/sla`                       |  200 |                  0.04 |   141 KB |
| `/app/sourcing`                  |  200 |                  0.07 |    83 KB |
| `/app/sourcing/items/new`        |  200 |                  0.04 |   129 KB |
| `/app/sourcing/visits/new`       |  200 |                  0.14 |   1.6 MB |
| `/app/superplan`                 |  200 |                  0.30 |   4.1 MB |
| `/app/supplier-requests`         |  200 |                  0.03 |    86 KB |
| `/app/supplier-requests/invites` |  200 |                  0.03 |    70 KB |
| `/app/suppliers`                 |  200 |                  4.35 |   597 KB |
| `/app/suppliers/scorecard`       |  200 |                  4.53 |  23.5 MB |
| `/app/tasks`                     |  200 |                  0.05 |   116 KB |
| `/app/tasks/desk`                |  200 |                  0.06 |    71 KB |
| `/app/team`                      |  200 |                  0.03 |    86 KB |

`/app/settings/reset` (31 s) é a tela do administrador que apaga dados de
teste; ela conta o que seria apagado. Fica registrada, sem mudança.

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

- Leituras inteiras ainda abertas (inventário de 14/11, `store.list` sem filtro em tabela grande):
  `/app/parties` (32 mil parceiros), `/app/products` e `/app/marketing` (17 mil produtos),
  `commissions.ts` (parceiros), `supplier-score-load.ts` e `team.ts` (pedidos),
  `customer-accounts.ts` (solicitações), caminho antigo da Control Tower e do quadro
  (pedidos e itens), jobs do Sankhya (parceiros, produtos, pedidos, itens: são jobs).
- Linha de base local por tela, com volume de produção sintético.
- Conferir no `pg_stat_statements` (depois do deploy do PR 1) o fim das leituras
  com OFFSET e a queda das médias.
- `/api/files/[id]`: erro "body disturbed or locked".
