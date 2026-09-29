# Plano de evolução incremental

Regra desta etapa: **preservar → analisar → reaproveitar → complementar → integrar → testar**. Nada foi removido: telas, rotas, campos, tabelas e fluxos anteriores continuam iguais. Tudo aqui é aditivo e compatível com registros antigos (colunas novas são opcionais; registros antigos ficam com `null`).

## Classificação dos requisitos (Prioridade Agora)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 8 | Sourcing / compras na China | Não existia (o fluxo começava na solicitação) | **Novo**: `supplier_visits`, `sourcing_items`, `product_photos`, `measurements`; telas em `/app/sourcing` |
| 9 | Experiência mobile para sourcing | PWA/manifest já existia; formulários eram de mesa | **Ampliado**: formulários mobile-first, `PhotoInput` com câmera e compressão no aparelho |
| 10 | Histórico de visitas | Não existia | **Novo**: `supplier_visits` (participantes, produtos encontrados, próxima visita, follow-up) |
| 11 | Importação do sistema chinês | Existia CSV direto para parceiros/produtos/linhas (`services/import.ts`), sem preview nem matching | **Ampliado**: `import_batches` com XLSX/CSV → mapeamento → preview → decisão por linha (criar/atualizar/ignorar). O CSV direto antigo continua funcionando |
| 12 | Ficha completa do produto | `Product` tinha só nome, SKU, linha, especificação | **Ampliado**: 25 colunas opcionais (fornecedor, MOQ, preço, caixas, pesos, dimensões, CBM, material, cor, Pantone, fotos, origem, data da negociação). Sem segundo cadastro |
| 13 | Foto original como evidência | Documentos já tinham versionamento; fotos eram só por requisito de pedido | **Novo**: `product_photos.kind` (original × commercial) com `derivedFromPhotoId`; a original nunca é substituída |
| 14 | Evidências de dimensões | Não existia | **Novo**: `product_photos.kind` dimension_front/side/depth/height/scale/other. Sem LiDAR |
| 15 | Evidência de peso | Só requisito `weight` por pedido | **Novo**: `measurements` (declarado × medido, unidade, foto, responsável, data) |
| 16 | Snapshot da negociação | Pedido copiava só FOB e preço de venda | **Novo**: `purchase_snapshots` criado ao nascer o pedido; retroativo sob demanda (`ensureSnapshot`) |
| 17 | Programação de compra | Não existia | **Novo**: `purchase_schedules`, ligado a produto/cliente/pedido |
| 18 | Container e CBM | Não existia | **Novo**: `containers` + `container_items`; tipos e capacidades em `settings.containerTypes` (nada fixo em 68 m³); cálculo determinístico em `src/lib/logistics/cbm.ts` |
| 19 | Mix de produtos | — | Vários itens por container; o mesmo cliente pode ter vários produtos |
| 20 | Regra de consolidação | — | Documentada e codificada: clientes diferentes não são juntados automaticamente (`containerAllowMultiCustomer = false`) |
| 21 | Financeiro do fornecedor | Conta corrente existia (`/app/account`) com pedidos, pagamentos, saldo e confirmação | **Ampliado**: trilha visualizado/confirmado por pagamento, câmbio e comprovante na tabela |
| 22 | Confirmação de visualização | Não existia (só `notifications.readAt`) | **Novo**: `acknowledgements` (viewed ≠ confirmed) para documentos e pagamentos |
| 23 | Inspeção cega | Fornecedor via o peso declarado; comparação só de peso | **Ampliado**: inspetor informa só o encontrado; esperado vem do snapshot e fica oculto; requisitos extras opcionais na inspeção |
| 24 | Comparação comprado × inspecionado | Só peso vs. preparação | **Ampliado**: `inspection_results` com peso líquido/bruto, dimensões, CBM da caixa, caixas, material, cor; tolerâncias em settings |
| 25 | Gates e fila de revisão | Bloqueio de etapa + `blockReason` só para peso | **Novo**: `review_items` (esperado × encontrado, regra, responsável, ação) alimentado pela inspeção, preço zerado e container; tela `/app/reviews` |
| 26 | IA ≠ regra de negócio | — | Princípio registrado abaixo; nenhuma regra determinística usa IA |
| 27 | Dashboard financeiro/operacional | Control Tower tinha buckets por etapa; financeiro em `/app/finance` | **Ampliado**: `loadTowerTotals` reutiliza o financeiro (nenhuma segunda Control Tower) |
| 28 | Visão comercial | Não existia | **Novo, só com dados reais**: vendido × disponível por container = itens com pedido × sem pedido (volume) |

### Desconsiderado (já atendido ou fora desta onda)

- **Cadastro de fornecedor, produto, cliente, pedido, pagamento, documento, notificação**: já existem; foram ampliados, não recriados.
- **Workflow de pedidos e etapas**: preservado por inteiro; `STAGE_KEYS` não mudou (pós-venda virá como entidade própria, não como etapa nova, para não migrar pedidos abertos).
- **Aplicativo nativo**: o PWA responsivo resolve; fora do escopo.
- **Medição 3D/LiDAR**: estrutura preparada (`product_photos.kind`), sem implementação.
- **Motor automático de consolidação entre clientes**: proibido por regra de negócio.
- **Estoque/“disponível” fora de container**: não há dados; a visão comercial só calcula sobre itens de container sem pedido.
- **Segunda parcela do fornecedor, extrato por período, câmbio de referência**: continuam no `BACKLOG_FUTURO.md`.

## Implementado nesta onda

- Esquema aditivo (`src/lib/db/schema.ts`): colunas novas em `parties`, `products`, `documents`; 12 tabelas novas; `PARTY_EXTRA_DEFAULTS`, `PRODUCT_EXTRA_DEFAULTS`, `DOCUMENT_EXTRA_DEFAULTS` para criar registros sem conhecer cada coluna nova.
- Camada de dados: coluna `json_large` (longtext) para planilhas; `appwrite-push` acrescenta valores a enums existentes e extensões ao bucket; `AppwriteStore.list` pagina (não trunca mais em 500) e traduz `id` nos filtros.
- Serviços: `sourcing.ts`, `import-batches.ts` (+ `xlsx.ts` sem dependências), `snapshots.ts`, `inspection.ts`, `reviews.ts`, `acknowledgements.ts`, `containers.ts`, `logistics/cbm.ts`; `control-tower.ts` ganhou totais e exceções de revisão.
- Motor: contexto `inspectionExtendedChecks`; hook de comparação após cada medida da inspeção; aprovação/liberação resolvem os itens de revisão; preço zerado gera item de revisão na criação do pedido.
- Configurações novas (`src/lib/settings.ts`): tolerâncias de dimensão/CBM/quantidade, `inspectionExtendedChecks`, `reviewOnZeroPrice`, `containerTypes`, `containerAllowMultiCustomer`, `containerMaxOccupancyPercent`.

## Reutilizado

`uploadDocument` (versionamento e visibilidade), `audit`, `notify`/`notifyWellmix`, `getSettings`, `loadFinance`, `loadControlTower`, `createRequest`/RFQ (para reposição e sourcing sob demanda na Segunda Onda), kit de componentes `ui.tsx`, `PageHeader` com ajuda contextual, dicionários pt/en/zh.

## Ampliado

`Party`, `Product`, `Document`, `StageContext`/`STAGE_TEMPLATES` (INSPECTION), `submitRequirement`/`decideRequirement`/`unblockStage`, `createOrderFromRequest`, `TowerException`, seed de demonstração, navegação (`navFor`), `docs/`.

## Pendente (próximas ondas)

- Segunda Onda: NCM/tributação com validação humana, integração mais profunda com o sistema chinês (só se houver API oficial), certificações por linha, pós-venda (entidade própria após DELIVERED), análise de oportunidade com fórmula reproduzível, reposição e “nova proposta” reaproveitando solicitação/RFQ, sourcing sob demanda.
- Visão de Produto: cadastro por foto com sugestão de campos (modo manual/mock até haver chave), prompts por linha centralizados, marketing studio, kit de marketing com preço configurável, preparação multi-importador, cliente com/sem RADAR.

## Decisões técnicas

- **Aditivo sempre**: `ADD` antes de `DROP/RENAME`; enums só ganham valores; nenhum registro é apagado.
- **IA ≠ regra**: cálculo, saldo, CBM, tolerância, comparação, workflow, autorização e validação são código determinístico e auditável. IA fica para sugestões (descrição, categoria, leitura de imagem) sempre com confirmação humana.
- **Snapshot em vez de referência**: o pedido guarda o que foi comprado; o cadastro mestre pode evoluir.
- **Inspeção cega**: o esperado nunca aparece ao inspetor; o motivo do bloqueio detalhado é visível só para a Wellmix.
- **Container**: capacidade por tipo em settings; consolidação entre clientes proibida por padrão; “disponível” só existe para itens sem pedido dentro do container.
- **Server Actions divididas** em `src/app/app/actions.ts` (existentes) e `src/app/app/actions/*.ts` (novas), com os mesmos helpers (`zod`, `assert*`, `audit`, `run`).
- **Dicionários por módulo** em `src/i18n/modules/*.ts`, fundidos em `dictionaries.ts`; o teste de paridade pt/en/zh cobre tudo.
- **Fotos no celular**: compressão no aparelho (`PhotoInput`) e `serverActions.bodySizeLimit` de 10 MB; na Vercel o corpo da requisição tem teto de ~4,5 MB, por isso a compressão é obrigatória, não opcional.
- **Limites conhecidos**: `nextNumber` não é atômico (colisão vira 409 no índice único); datas no Appwrite voltam com `+00:00`; MemoryStore não valida enum/tamanho (erros de esquema só aparecem em produção ou no E2E com `E2E_REUSE=1`).

## Recomendações futuras (não executadas por serem remoções ou mudanças de comportamento)

- Unificar `checkWeightDivergence` (peso declarado × medido) dentro de `compareInspection` quando todos os pedidos abertos tiverem snapshot.
- Reduzir as 3 notificações por evento (in-app, e-mail e WhatsApp mock) quando houver provedor real.
