-- Ensaio da reconstrução dos pedidos de compra do Sankhya (docs/SANKHYA_INTEGRACAO.md,
-- seções 3.1, 4 e 5). Lê só a cópia bruta (sankhya_stage_rows) e grava o resultado em
-- sankhya_projection (apaga e refaz só essa tabela). Não toca em pedidos do portal.
-- São quatro comandos (apagar, pedidos, embarques e as compras 33 -> 30); cada um tem os
-- próprios "with".
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
      when top in (1100, 1102, 1103) and pend then 'in_progress'
      when top = 1104 and pend and ss is null then 'awaiting_definition'
      when top = 1104 and pend then 'in_progress'
      when not pend and top in (1100, 1101, 1102) and out_tops is null then 'interrupted'
      when not pend and top = 1103 and out_tops && array[30, 94] then 'legacy_path'
      -- 1104 sem pendência e sem documento seguinte: nem embarque nem recebimento.
      when not pend and out_tops is null then 'awaiting_definition'
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
    when top = 1100 then 'new-order'
    when top = 1101 then 'contract'
    when top = 1102 then 'art'
    when top = 1103 then 'pre-production'
    when top = 1104 and pend and ss = '8' then 'down-payment'
    when top = 1104 and pend then 'production'
    when coalesce(customs_open, false) or canal is not null and rec is null then 'customs'
    when rec = 'Recebimento parcial' then 'invoice-transport'
    when coalesce(ship_open, false) then 'loading'
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
-- sempre encerrado. Os 10 que vêm da cadeia nova (1103 -> 30) já são os "Caminho antigo" do
-- primeiro comando e ficam fora daqui.
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
leaf as (
  select h.* from h where h.top = 30
  and not exists (
    select 1 from ld join h a on a.n = ld.o
    where ld.d = h.n and a.top in (1100, 1101, 1102, 1103, 1104, 1107))
),
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

commit;
