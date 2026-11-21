-- Apaga os pedidos e embarques que a carga dos pedidos do Sankhya gravou (ids "snk-…") e tudo o
-- que aponta para eles, para refazer a carga do zero (dono, 21/11/2026: "pode apagar tudo e
-- refazer por track"). Não toca em pedidos do portal, cadastros nem na cópia das views.
-- Conferir antes (mesmo filtro, com count) e rodar no SQL Editor do Supabase.
begin;
update public."requests" set "orderId" = null where "orderId" like 'snk-%';
delete from public."order_items" where "orderId" like 'snk-%';
delete from public."stages" where "orderId" like 'snk-%';
delete from public."requirements" where "orderId" like 'snk-%';
delete from public."order_milestones" where "orderId" like 'snk-%';
delete from public."documents" where "orderId" like 'snk-%';
delete from public."payments" where "orderId" like 'snk-%';
delete from public."penalties" where "orderId" like 'snk-%';
delete from public."product_photos" where "orderId" like 'snk-%';
delete from public."purchase_snapshots" where "orderId" like 'snk-%';
delete from public."purchase_schedules" where "orderId" like 'snk-%';
delete from public."container_items" where "orderId" like 'snk-%';
delete from public."review_items" where "orderId" like 'snk-%';
delete from public."inspection_results" where "orderId" like 'snk-%';
delete from public."after_sales" where "orderId" like 'snk-%';
delete from public."purchase_sheets" where "orderId" like 'snk-%';
delete from public."freight_quotes" where "orderId" like 'snk-%';
delete from public."conversation_topics" where "orderId" like 'snk-%';
delete from public."production_tracks" where "orderId" like 'snk-%';
delete from public."shipping_docs" where "orderId" like 'snk-%';
delete from public."showroom_receipts" where "orderId" like 'snk-%';
delete from public."real_media" where "orderId" like 'snk-%';
delete from public."divergence_lots" where "orderId" like 'snk-%';
delete from public."sales_offers" where "orderId" like 'snk-%';
delete from public."sku_inspections" where "orderId" like 'snk-%';
delete from public."import_steps" where "orderId" like 'snk-%';
delete from public."receivings" where "orderId" like 'snk-%';
delete from public."art_issues" where "orderId" like 'snk-%';
delete from public."stock_movements" where "orderId" like 'snk-%';
delete from public."supplier_product_sheets" where "orderId" like 'snk-%';
delete from public."purchase_decisions" where "orderId" like 'snk-%';
delete from public."supplier_requests" where "orderId" like 'snk-%';
delete from public."commission_entries" where "orderId" like 'snk-%';
delete from public."commission_events" where "orderId" like 'snk-%';
delete from public."process_events" where "orderId" like 'snk-%';
delete from public."order_summaries" where "orderId" like 'snk-%';
delete from public."container_items" where "containerId" like 'snk-35-%';
delete from public."containers" where "id" like 'snk-35-%';
delete from public."orders" where "id" like 'snk-%';
delete from public."settings" where "key" = 'sankhya.ordersLoad';
commit;
select (select count(*) from public."orders" where "id" like 'snk-%') pedidos, (select count(*) from public."order_items" where "orderId" like 'snk-%') itens, (select count(*) from public."containers" where "id" like 'snk-35-%') embarques;
