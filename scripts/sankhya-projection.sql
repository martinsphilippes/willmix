-- Ensaio da reconstrução dos pedidos de compra do Sankhya (docs/SANKHYA_INTEGRACAO.md,
-- seções 3.1, 4 e 5). Lê só a cópia bruta (sankhya_stage_rows) e grava o resultado em
-- sankhya_projection (apaga e refaz só essa tabela). Não toca em pedidos do portal.
-- Comandos: apagar, pedidos (pontas de cadeia), embarques, compras 33 -> 30 e a junção por
-- TRACK_ID (que precisa da cópia purchaseTracks); cada um tem os próprios "with".
-- Rodar de novo depois de copiar as views: o resultado é sempre o da cópia atual.
begin;
delete from public.sankhya_projection;

with recursive
h as (
  select nunota n, row r,
    (row->>'CODTIPOPER')::int top,
    row->>'PEDIDO_PENDENTE' = 'S' pend,
    row->>'COD_FORNECEDOR' forn
  from public.sankhya_stage_rows where dataset = 'purchaseHeaders'
),
pre as (select * from h where top in (1100, 1101, 1102, 1103, 1104, 1107)),
lk as (
  select (row->>'NUNOTAORIG')::bigint o, (row->>'SEQUENCIAORIG')::int os,
         (row->>'NUNOTA')::bigint d, (row->>'SEQUENCIA')::int ds,
         coalesce((row->>'QTDATENDIDA')::numeric, 0) q,
         (row->>'TOP_ORIGEM')::int topo, (row->>'TOP_DESTINO')::int topd
  from public.sankhya_stage_rows where dataset = 'purchaseLinks'
),
ld as (select distinct o, d, topo, topd from lk where o <> d),
-- Ponta de cada cadeia de pedido: sem sucessor dentro de 1100..1104/1107.
leaf as (
  select p.* from pre p
  where not exists (select 1 from ld join pre b on b.n = ld.d where ld.o = p.n)
),
-- Ancestrais (cadeia) de cada ponta.
anc(leaf, n, depth) as (
  select n, n, 0 from leaf
  union
  select a.leaf, ld.o, a.depth + 1
  from anc a join ld on ld.d = a.n join pre p on p.n = ld.o
  where a.depth < 12
),
chain as (
  select a.leaf, jsonb_agg(jsonb_build_object(
      'nunota', p.n, 'top', p.top, 'pending', p.pend,
      'confirmed', p.r->>'STATUS_NOTA' = 'L',
      'date', p.r->>'DATA_PEDIDO', 'numnota', p.r->>'NUMNOTA')
      order by a.depth desc) docs
  from anc a join pre p on p.n = a.n group by a.leaf
),
-- Saídas da ponta para fora da cadeia (35 embarque, 1 pré-nota, 30/94 caminho antigo).
outs as (
  select o leaf, array_agg(distinct topd) tops, array_agg(distinct d) docs
  from ld where topd not in (1100, 1101, 1102, 1103, 1104, 1107) group by o
),
-- Itens da ponta com o que já saiu (TGFVAR) e o saldo.
shipped as (
  select o, os, sum(q) q from lk where topd not in (1100, 1101, 1102, 1103, 1104, 1107)
  group by o, os
),
items as (
  select i.nunota leaf, jsonb_agg(jsonb_build_object(
      'seq', (i.row->>'SEQUENCIA')::int,
      'codprod', i.row->>'CODPROD',
      'name', i.row->>'DESCRICAO_PRODUTO',
      'ref', i.row->>'REFERENCIA_FORNECEDOR',
      'unit', i.row->>'UNIDADE_NEGOCIADA',
      'qty', (i.row->>'QTD_NEGOCIADA')::numeric,
      'shipped', coalesce(s.q, 0),
      'pendingQty', greatest((i.row->>'QTD_NEGOCIADA')::numeric - coalesce(s.q, 0), 0),
      'itemPending', i.row->>'ITEM_PENDENTE' = 'S',
      'price', (i.row->>'PRECO_UNITARIO_ORIGEM')::numeric,
      'boxes', (i.row->>'QTD_CAIXAS_CALCULADA')::numeric)
      order by (i.row->>'SEQUENCIA')::int) list,
    sum(coalesce(s.q, 0)) shipped_total,
    sum((i.row->>'QTD_NEGOCIADA')::numeric) qty_total
  from public.sankhya_stage_rows i
  join leaf on leaf.n = i.nunota
  left join shipped s on s.o = i.nunota and s.os = (i.row->>'SEQUENCIA')::int
  where i.dataset = 'purchaseItems'
  group by i.nunota
),
-- Embarques (35) e o caminho deles (35 -> 1 -> nota).
ship as (
  select h.n, h.pend, h.r,
    exists (select 1 from ld x join h y on y.n = x.d where x.o = h.n and y.top = 1 and y.pend) prenota_pend,
    exists (select 1 from ld x join h y on y.n = x.d where x.o = h.n and y.top = 1) has_prenota,
    exists (select 1 from ld x join ld z on z.o = x.d where x.o = h.n and z.topd in (37, 1201)) has_nota
  from h where h.top = 35
),
orders as (
  select l.n leaf, l.top, l.pend, l.forn, l.r,
    c.docs chain, o.tops out_tops, o.docs out_docs,
    it.list items, coalesce(it.shipped_total, 0) shipped_total, coalesce(it.qty_total, 0) qty_total,
    l.r->>'STATUS_SHIPPING' ss, l.r->>'STATUS_RECEBIMENTO' rec,
    l.r->>'STATUS_QUALIDADE' qual, l.r->>'CANAL_ADUANEIRO' canal,
    (select bool_or(s.pend or s.prenota_pend) from ship s where s.n = any(o.docs)) ship_open,
    (select bool_or(s.prenota_pend) from ship s where s.n = any(o.docs)) customs_open
  from leaf l
  left join chain c on c.leaf = l.n
  left join outs o on o.leaf = l.n
  left join items it on it.leaf = l.n
),
classified as (
  select *,
    case
      -- De-para aprovado (dono, 21/11/2026; docs/SANKHYA_INTEGRACAO.md, 9.4): a 1101 pendente e
      -- a 1104 pendente sem STATUS_SHIPPING (o "caso 1") seguem em andamento.
      when top in (1100, 1101, 1102, 1103) and pend then 'in_progress'
      when top = 1104 and pend then 'in_progress'
      when not pend and top = 1103 and out_tops && array[30, 94] then 'legacy_path'
      -- Sem pendência e sem documento seguinte: encerrado no meio do processo (cancelado), em
      -- qualquer etapa (técnico do Sankhya e dono, 23/11/2026). Não entra no portal. A 1104 com
      -- entrada direta pela TOP 32 no mesmo track vira "encerrado" na junção por track, abaixo.
      when not pend and out_tops is null then 'interrupted'
      -- Tudo embarcado e nenhum embarque aberto: encerrado (com ou sem a coluna de recebimento).
      when not pend and not coalesce(ship_open, false) then 'closed'
      when not pend then 'in_progress'
      else 'awaiting_definition'
    end situation,
    case
      when top = 1104 and pend and ss is null then 'no_status_shipping'
      when not pend and out_tops is null and top in (1103, 1104, 1107) then 'no_successor'
      else null
    end reason
  from orders
)
insert into public.sankhya_projection
  ("id", "kind", "key", "situation", "milestone", "top", "supplierCode", "supplierName",
   "shipmentState", "data", "computedAt")
select 'order:' || leaf, 'order', leaf::text, situation,
  case
    when situation in ('interrupted', 'legacy_path', 'closed') then null
    when situation = 'awaiting_definition' then null
    -- 1100 é reposição (a carga não cria pedido); o marco final, com as datas de inspeção, ETD
    -- e ETA, sai da carga (trackMilestone em src/lib/integrations/sankhya-orders-plan.ts).
    when top = 1100 then null
    when top = 1101 then 'new-order'
    when top = 1102 then 'art'
    when top = 1103 then 'contract'
    when top = 1104 and pend and r->>'STATUS_NOTA' = 'A' and nullif(r->>'DATA_INSPECAO', '') is null then 'contract'
    when top = 1104 and pend and ss = '8' then 'down-payment'
    when top = 1104 and pend and qual ~* '^inspe[cç][aã]o parcial$' then 'inspection'
    when top = 1104 and pend and (qual ~* '^inspecionado$' or nullif(r->>'DATA_INSPECAO', '') is not null) then 'booking'
    when top = 1104 and pend then 'production'
    when rec = 'Recebimento parcial' then 'delivery'
    when coalesce(customs_open, false) or canal is not null and rec is null then 'customs'
    else 'shipment'
  end,
  top, forn, r->>'NOME_FORNECEDOR',
  case
    when shipped_total <= 0 then 'none'
    when pend then 'partial'
    else 'shipped'
  end,
  jsonb_build_object(
    'chain', chain, 'items', coalesce(items, '[]'::jsonb),
    'qtyTotal', qty_total, 'shippedTotal', shipped_total,
    'shipments', coalesce(to_jsonb(out_docs), '[]'::jsonb),
    'statusShipping', ss, 'receipt', rec, 'receivedAt', r->>'DATA_RECEBIMENTO',
    'quality', qual, 'inspectedAt', r->>'DATA_INSPECAO', 'customsChannel', canal,
    'currency', r->>'MOEDA_ORIGEM', 'total', (r->>'VALOR_TOTAL_PEDIDO_ORIGEM')::numeric,
    'incoterm', r->>'INCOTERM', 'etd', r->>'ETD', 'eta', r->>'ETA',
    'orderedAt', r->>'DATA_PEDIDO', 'changedAt', r->>'DATA_ALTERACAO_PEDIDO',
    'importType', r->>'TIPO_IMPORTACAO', 'numnota', r->>'NUMNOTA',
    'reason', reason),
  now()
from classified;

-- Embarques (35): os pedidos e as quantidades que cada um leva.
with
h as (
  select nunota n, row r,
    (row->>'CODTIPOPER')::int top,
    row->>'PEDIDO_PENDENTE' = 'S' pend
  from public.sankhya_stage_rows where dataset = 'purchaseHeaders'
),
lk as (
  select (row->>'NUNOTAORIG')::bigint o, (row->>'SEQUENCIAORIG')::int os,
         (row->>'NUNOTA')::bigint d, coalesce((row->>'QTDATENDIDA')::numeric, 0) q,
         (row->>'TOP_DESTINO')::int topd
  from public.sankhya_stage_rows where dataset = 'purchaseLinks'
),
ld as (select distinct o, d, topd from lk where o <> d),
-- Pedidos e quantidades de cada embarque, juntados uma vez (por embarque).
carried as (
  select d, jsonb_agg(jsonb_build_object('order', o, 'seq', os, 'qty', q)) list
  from lk where topd = 35 group by d
),
ship as (
  select h.n, h.pend, h.r,
    exists (select 1 from ld x join h y on y.n = x.d where x.o = h.n and y.top = 1 and y.pend) prenota_pend,
    exists (select 1 from ld x join h y on y.n = x.d where x.o = h.n and y.top = 1) has_prenota,
    exists (select 1 from ld x join ld z on z.o = x.d where x.o = h.n and z.topd in (37, 1201)) has_nota
  from h where h.top = 35
)
insert into public.sankhya_projection
  ("id", "kind", "key", "situation", "milestone", "top", "supplierCode", "supplierName",
   "shipmentState", "data", "computedAt")
select 'shipment:' || s.n, 'shipment', s.n::text,
  case when s.pend or s.prenota_pend then 'in_progress' else 'closed' end,
  case
    when s.prenota_pend then 'customs'
    when s.pend then 'loading'
    else 'delivery'
  end,
  35, s.r->>'COD_FORNECEDOR', s.r->>'NOME_FORNECEDOR', null,
  jsonb_build_object(
    'orders', coalesce(c.list, '[]'::jsonb),
    'prenota', s.has_prenota, 'nota', s.has_nota,
    'statusShipping', s.r->>'STATUS_SHIPPING', 'receipt', s.r->>'STATUS_RECEBIMENTO',
    'customsChannel', s.r->>'CANAL_ADUANEIRO', 'etd', s.r->>'ETD', 'eta', s.r->>'ETA',
    'orderedAt', s.r->>'DATA_PEDIDO', 'numnota', s.r->>'NUMNOTA'),
  now()
from ship s
left join carried c on c.d = s.n;
-- Compras de 2020 a 2022 pelo caminho 117 -> 33 -> 30 -> 35 (dono, 21/11/2026: "traga como
-- histórico encerrado"): um pedido por documento 30, com a cadeia (117, 33) e os itens do 30,
-- sempre encerrado.
with recursive
h as (
  select nunota n, row r,
    (row->>'CODTIPOPER')::int top,
    row->>'PEDIDO_PENDENTE' = 'S' pend
  from public.sankhya_stage_rows where dataset = 'purchaseHeaders'
),
lk as (
  select (row->>'NUNOTAORIG')::bigint o, (row->>'SEQUENCIAORIG')::int os,
         (row->>'NUNOTA')::bigint d, coalesce((row->>'QTDATENDIDA')::numeric, 0) q,
         (row->>'TOP_DESTINO')::int topd
  from public.sankhya_stage_rows where dataset = 'purchaseLinks'
),
ld as (select distinct o, d from lk where o <> d),
-- Inclui os 10 que vêm da cadeia nova (1103 -> 30): o 30 tem o mesmo track do 1103 e é dele
-- que sai o embarque; o "Caminho antigo" some na junção por track, mais abaixo.
leaf as (select h.* from h where h.top = 30),
anc(leaf, n, depth) as (
  select n, n, 0 from leaf
  union
  select a.leaf, ld.o, a.depth + 1
  from anc a join ld on ld.d = a.n join h p on p.n = ld.o and p.top in (117, 33, 30)
  where a.depth < 6
),
chain as (
  select a.leaf, jsonb_agg(jsonb_build_object(
      'nunota', p.n, 'top', p.top, 'pending', p.pend,
      'date', p.r->>'DATA_PEDIDO', 'numnota', p.r->>'NUMNOTA')
      order by a.depth desc) docs
  from anc a join h p on p.n = a.n group by a.leaf
),
outs as (
  select o leaf, array_agg(distinct d) docs from lk where topd = 35 group by o
),
shipped as (select o, os, sum(q) q from lk where topd = 35 group by o, os),
items as (
  select i.nunota leaf, jsonb_agg(jsonb_build_object(
      'seq', (i.row->>'SEQUENCIA')::int,
      'codprod', i.row->>'CODPROD',
      'name', i.row->>'DESCRICAO_PRODUTO',
      'ref', i.row->>'REFERENCIA_FORNECEDOR',
      'unit', i.row->>'UNIDADE_NEGOCIADA',
      'qty', (i.row->>'QTD_NEGOCIADA')::numeric,
      'shipped', coalesce(s.q, 0),
      'pendingQty', greatest((i.row->>'QTD_NEGOCIADA')::numeric - coalesce(s.q, 0), 0),
      'itemPending', i.row->>'ITEM_PENDENTE' = 'S',
      'price', (i.row->>'PRECO_UNITARIO_ORIGEM')::numeric,
      'boxes', (i.row->>'QTD_CAIXAS_CALCULADA')::numeric)
      order by (i.row->>'SEQUENCIA')::int) list,
    sum(coalesce(s.q, 0)) shipped_total,
    sum((i.row->>'QTD_NEGOCIADA')::numeric) qty_total
  from public.sankhya_stage_rows i
  join leaf on leaf.n = i.nunota
  left join shipped s on s.o = i.nunota and s.os = (i.row->>'SEQUENCIA')::int
  where i.dataset = 'purchaseItems'
  group by i.nunota
)
insert into public.sankhya_projection
  ("id", "kind", "key", "situation", "milestone", "top", "supplierCode", "supplierName",
   "shipmentState", "data", "computedAt")
select 'order:' || l.n, 'order', l.n::text, 'closed', null, 30,
  l.r->>'COD_FORNECEDOR', l.r->>'NOME_FORNECEDOR',
  case
    when coalesce(it.shipped_total, 0) <= 0 then 'none'
    when coalesce(it.shipped_total, 0) < coalesce(it.qty_total, 0) then 'partial'
    else 'shipped'
  end,
  jsonb_build_object(
    'chain', c.docs, 'items', coalesce(it.list, '[]'::jsonb),
    'qtyTotal', coalesce(it.qty_total, 0), 'shippedTotal', coalesce(it.shipped_total, 0),
    'shipments', coalesce(to_jsonb(o.docs), '[]'::jsonb),
    'statusShipping', l.r->>'STATUS_SHIPPING', 'receipt', l.r->>'STATUS_RECEBIMENTO',
    'receivedAt', l.r->>'DATA_RECEBIMENTO',
    'quality', l.r->>'STATUS_QUALIDADE', 'inspectedAt', l.r->>'DATA_INSPECAO',
    'customsChannel', l.r->>'CANAL_ADUANEIRO',
    'currency', l.r->>'MOEDA_ORIGEM', 'total', (l.r->>'VALOR_TOTAL_PEDIDO_ORIGEM')::numeric,
    'incoterm', l.r->>'INCOTERM', 'etd', l.r->>'ETD', 'eta', l.r->>'ETA',
    'orderedAt', l.r->>'DATA_PEDIDO', 'changedAt', l.r->>'DATA_ALTERACAO_PEDIDO',
    'numnota', l.r->>'NUMNOTA',
    'legacy', '33-30', 'pendingInSankhya', l.pend),
  now()
from leaf l
left join chain c on c.leaf = l.n
left join outs o on o.leaf = l.n
left join items it on it.leaf = l.n
on conflict ("id") do nothing;

-- Pedido por TRACK_ID (docs/SANKHYA_TRACK_ID.md; dono, 21/11/2026): as pontas de cadeia do mesmo
-- track viram um pedido só (chave = track; sem track, "-NUNOTA"). Situação pela ponta mais
-- adiantada; itens das pontas que valem (a interrompida só conta se o track inteiro parou); a
-- cadeia é a de todos os documentos do track (cópia purchaseTracks). Os embarques levam o track.
with
t as (select nunota n, nullif(row->>'TRACK_ID', '') tr, (row->>'CODTIPOPER')::int top from public.sankhya_stage_rows where dataset = 'purchaseTracks'),
h as (select nunota n, row r from public.sankhya_stage_rows where dataset = 'purchaseHeaders'),
leaf0 as (select p.*, coalesce(t.tr, '-' || p.key) trk from public.sankhya_projection p left join t on t.n::text = p.key where p.kind = 'order'),
lf as (select * from leaf0 l where not (l.situation = 'legacy_path' and exists (select 1 from leaf0 o where o.trk = l.trk and o.key <> l.key))),
lfi as (select * from lf x where x.situation <> 'interrupted' or not exists (select 1 from lf y where y.trk = x.trk and y.situation <> 'interrupted')),
ms as (select array['new-order','certification','art-material','art','contract','down-payment','pre-production','inspection','samples','production','booking','loading','shipment','customs','invoice-transport','delivery'] a),
ranked as (select lf.*, row_number() over (partition by trk order by (situation = 'in_progress') desc, (situation = 'closed') desc, (situation = 'awaiting_definition') desc, key::bigint desc) rk from lf),
agg as (
  select trk,
    case when bool_or(situation = 'in_progress') then 'in_progress' when bool_or(situation = 'closed') then 'closed' when bool_or(situation = 'awaiting_definition') then 'awaiting_definition' when bool_or(situation = 'legacy_path') then 'legacy_path' else 'interrupted' end situation,
    max(top) top,
    (select x.milestone from lf x, ms where x.trk = lf.trk and x.situation = 'in_progress' and x.milestone is not null order by array_position(ms.a, x.milestone) desc limit 1) milestone,
    jsonb_agg(to_jsonb(key) order by key::bigint) leaves
  from lf group by trk),
tot as (
  select trk, sum(coalesce((data->>'qtyTotal')::numeric, 0)) qty_total, sum(coalesce((data->>'shippedTotal')::numeric, 0)) shipped_total,
    bool_and(coalesce("shipmentState", 'none') = 'shipped') all_shipped
  from lfi group by trk),
items as (select x.trk, jsonb_agg(i || jsonb_build_object('doc', x.key::bigint) order by x.key::bigint, (i->>'seq')::int) list from lfi x, jsonb_array_elements(case when jsonb_typeof(x.data->'items') = 'array' then x.data->'items' else '[]'::jsonb end) i group by x.trk),
ships as (select x.trk, jsonb_agg(distinct s) list from lf x, jsonb_array_elements(case when jsonb_typeof(x.data->'shipments') = 'array' then x.data->'shipments' else '[]'::jsonb end) s group by x.trk),
chain as (select t.tr trk, jsonb_agg(jsonb_build_object('nunota', t.n, 'top', t.top, 'pending', h.r->>'PEDIDO_PENDENTE' = 'S', 'confirmed', h.r->>'STATUS_NOTA' = 'L', 'date', h.r->>'DATA_PEDIDO', 'numnota', h.r->>'NUMNOTA') order by t.n) docs from t left join h on h.n = t.n where t.tr is not null and t.top <> 32 group by t.tr),
-- Entrada direta pela TOP 32 (Pré-venda INV +) no mesmo track: a compra seguiu por outro caminho.
direct as (select tr trk, max(n) doc from t where top = 32 and tr is not null group by tr)
insert into public.sankhya_projection ("id", "kind", "key", "situation", "milestone", "top", "supplierCode", "supplierName", "shipmentState", "data", "computedAt")
select 'track:' || a.trk, 'track', a.trk,
  case when a.situation = 'interrupted' and a.top in (1104, 1107) and d.doc is not null then 'closed' else a.situation end,
  a.milestone, a.top, m."supplierCode", m."supplierName",
  case when coalesce(tt.shipped_total, 0) <= 0 then 'none' when tt.all_shipped then 'shipped' else 'partial' end,
  m.data || jsonb_build_object('track', a.trk, 'mainKey', m.key, 'leaves', a.leaves,
    'chain', coalesce(c.docs, m.data->'chain'), 'items', coalesce(i.list, '[]'::jsonb), 'shipments', coalesce(s.list, '[]'::jsonb),
    'qtyTotal', coalesce(tt.qty_total, 0), 'shippedTotal', coalesce(tt.shipped_total, 0))
    || case when a.situation = 'interrupted' and a.top in (1104, 1107) and d.doc is not null
         then jsonb_build_object('directEntry', d.doc, 'reason', 'direct_entry') else '{}'::jsonb end,
  now()
from agg a join ranked m on m.trk = a.trk and m.rk = 1
left join tot tt on tt.trk = a.trk left join items i on i.trk = a.trk left join ships s on s.trk = a.trk left join chain c on c.trk = a.trk
left join direct d on d.trk = a.trk;
delete from public.sankhya_projection where kind = 'order';
update public.sankhya_projection set kind = 'order', id = 'order:' || key where kind = 'track';
update public.sankhya_projection s set data = jsonb_set(s.data, '{orders}', coalesce((
  select jsonb_agg(o || jsonb_build_object('track', coalesce(t.tr, '-' || (o->>'order'))))
  from jsonb_array_elements(case when jsonb_typeof(s.data->'orders') = 'array' then s.data->'orders' else '[]'::jsonb end) o
  left join (select nunota n, nullif(row->>'TRACK_ID', '') tr from public.sankhya_stage_rows where dataset = 'purchaseTracks') t on t.n = (o->>'order')::bigint
), '[]'::jsonb))
where s.kind = 'shipment';
commit;
