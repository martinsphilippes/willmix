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

## Classificação dos requisitos (Segunda Onda)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 30 | NCM / tributação | Nenhum campo ou tabela | **Novo**: `tax_classifications` (candidatas por heurística de palavras-chave, despachante, manual ou IA quando houver) com validação humana obrigatória; só a validada vai para `products.ncm` e para o snapshot. Rota `/app/products/[id]/tax` para o despachante |
| 31 | Integração mais profunda com o sistema chinês | Sem API, exportação estruturada ou webhook conhecidos | **Desconsiderado por ora**: XLSX/CSV continua o método oficial (`docs/INTEGRATIONS.md` traz a lista do que verificar antes de automatizar). Nada de scraping |
| 32 | Certificações e compliance | Nada além do checklist da linha | **Novo**: `certifications` (produto ou fornecedor, documento, validade), `product_lines.requiredCertifications`; gate na criação do pedido (item de revisão + requisito `compliance_check`); certificação a vencer vira exceção na Control Tower |
| 33 | Pós-venda | `CLOSED` era o fim | **Novo, sem mudar `STAGE_KEYS`**: `after_sales` aberto ao concluir DELIVERED; pendência do cliente; Wellmix encerra |
| 34 | Análise de oportunidade | Nenhuma | **Novo, determinístico**: faixas de preço (`products.priceTiers`) → custo marginal até a próxima faixa com fórmula exibida; espaço livre em container do cliente → caixas que cabem. Nada estimado por IA |
| 35 | Reposição | Fluxo de solicitação já existia | **Reutilizado**: `createFollowUpRequest` cria a solicitação (origem `replenishment`) a partir do pedido; nenhum segundo motor de compras |
| 36 | Nova proposta | Idem | **Reutilizado**: mesma função com origem `proposal`; pré-preenchida com produto, quantidade e especificação |
| 37 | Histórico comercial | Financeiro e Control Tower existiam; nada por cliente × produto | **Novo**: `loadCommercialHistory` (compras, quantidade, custo, datas, frequência média, reposições, interesse em recompra); FOB só para a Wellmix |
| 38 | Sourcing sob demanda | Solicitação sem produto já era possível | **Ampliado**: origem `sourcing_demand` cria item de sourcing para o time na China; promovido, o produto volta à solicitação e a RFQ segue normal |

### Desconsiderado (já atendido ou fora desta onda)

- **Cadastro de fornecedor, produto, cliente, pedido, pagamento, documento, notificação**: já existem; foram ampliados, não recriados.
- **Workflow de pedidos e etapas**: preservado por inteiro; `STAGE_KEYS` não mudou (pós-venda virá como entidade própria, não como etapa nova, para não migrar pedidos abertos).
- **Aplicativo nativo**: o PWA responsivo resolve; fora do escopo.
- **Medição 3D/LiDAR**: estrutura preparada (`product_photos.kind`), sem implementação.
- **Motor automático de consolidação entre clientes**: proibido por regra de negócio.
- **Estoque/“disponível” fora de container**: não há dados; a visão comercial só calcula sobre itens de container sem pedido.
- **Segunda parcela do fornecedor, extrato por período, câmbio de referência**: continuam no `BACKLOG_FUTURO.md`.

## Classificação dos requisitos (Visão de Produto)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 40 | IA de cadastro por foto | Fotos e ficha existiam; nenhuma sugestão automática | **Novo**: `ai_suggestions` + `src/lib/integrations/ai.ts` (modos `api` com `ANTHROPIC_API_KEY`, `mock` rotulado, `manual`). FOTO → ANÁLISE → SUGESTÃO → HUMANO CONFIRMA campo a campo → CADASTRO. Material e dados comerciais só entram se o operador escolher; preço/MOQ/dimensões nunca são sugeridos |
| 41 | Prompts por Product Line | Nenhum prompt no sistema | **Novo, centralizado**: `src/lib/ai/prompts.ts` (Prompt Base + Linha + Produto + Contexto) e `product_lines.prompts` (descrição, marketing, imagem, atributos exigidos, regras). Atributos exigidos são conferidos por código (`checkRequiredAttributes`), não por IA |
| 42 | Marketing studio | Fotos comerciais (`product_photos.kind = commercial`) existiam | **Novo, alimentado pela ficha**: `marketing_kits` (conceito, slogan, descrição, campanha, cores, Pantone, prévias, arquivos finais); textos sugeridos por IA com confirmação; reutiliza documentos e fotos |
| 43 | Prévia do marketing | Nenhuma | **Novo**: prévias visíveis ao cliente a partir da oferta; arquivos finais só depois da liberação (`canViewKitDocument`) |
| 44 | Venda de kit de marketing | Nenhuma | **Novo, reutilizando `payments`**: preço por kit com padrão em `marketingKitDefaultPrice` (nada de R$ 200 fixo); compra cria pagamento `customer_in` (modo manual); Wellmix confirma e libera |
| 45 | Plataforma multi-importador | Wellmix implícita em `WELLMIX_ROLES` e nas configurações globais | **Preparado, sem virar SaaS**: `users.importerId` e `parties.importerId` (nulos = Wellmix), `importerName` nas configurações e estratégia registrada em `docs/ARQUITETURA.md`. Nenhum filtro mudou |
| 46 | Cliente com ou sem RADAR | Nenhum campo | **Novo**: `parties.operationMode` (importação própria, via trade, outra) + `radar`; o pedido copia a modalidade (`orders.operationMode`); importação própria sem RADAR abre item de revisão (`customer.radarMissing`). Cadastro antigo = "não informado", sem gate |
| 47 | Ciclo contínuo | Fluxo terminava no pedido; pós-venda e reposição vieram na Segunda Onda | **Ampliado**: `loadProductCycle` reúne sourcing → produto → solicitações → pedidos → pós-venda → reposição → kits por relacionamento; macrofluxo em `docs/SCOPE.md` |
| 48 | Princípio de dados | Produto já era a origem da ficha e do snapshot | **Reutilizado**: nada duplicado; kit, sugestão e ciclo apontam para o produto; snapshots continuam onde a história importa |

## Implementado na Visão de Produto

- Esquema aditivo (34 tabelas): `ai_suggestions`, `marketing_kits`; `product_lines.prompts`; `parties.operationMode/radar/radarNotes/importerId`; `users.importerId`; `orders.operationMode`; `documents.kitId`; `payments.kitId`.
- `src/lib/ai/prompts.ts` (prompts centralizados, conferência determinística de atributos), `src/lib/integrations/ai.ts` (adaptador api/mock/manual), `services/ai-suggestions.ts`, `services/marketing.ts`, `services/operations.ts`, `services/product-cycle.ts`; gate de operação em `createOrderFromRequest`; acesso a arquivos de kit em `canAccessDocument`.
- Configurações: `aiMode`, `aiModel`, `marketingEnabled`, `marketingKitDefaultPrice`, `marketingKitCurrency`, `radarGateEnabled`, `importerName`.
- Actions em `src/app/app/actions/vision.ts`; 7 testes novos (29 no total).

### Busca de produto por foto ou link (nova solicitação)

- `/app/requests/new` ganhou "Encontrar o produto por foto ou link" (cliente e Wellmix). A foto dispara a busca sozinha; o link é lido com segurança (Open Graph e JSON-LD, sem endereços internos, tempo e tamanho limitados).
- Catálogo: mesma foto por impressão digital visual (dHash via `sharp`, sem IA; `documents.imageHash`), mesma foto do link, nome ou SKU parecido com o do link e, com IA, produto reconhecido na lista do catálogo. "Usar este produto" seleciona o item.
- Sem produto: cada campo (nome, descrição, especificação) recebe várias sugestões com a origem (link, catálogo, IA). "Nenhuma dessas" vem marcado; nada é preenchido sem a escolha da pessoa. Sem correspondência, "produto fora do catálogo" vem marcado.
- A foto enviada vira anexo da solicitação e o link vai para a observação. Registro em `product_lookups`. Serviços: `services/product-lookup.ts`, `services/image-hash.ts`, `integrations/link-preview.ts`.
- Limite honesto: sem chave de IA, a foto só acha fotos iguais ou muito parecidas às cadastradas; muitos marketplaces chineses bloqueiam a leitura automática do link (a tela avisa).

### Telas entregues na Visão de Produto

- `/app/lines`: "Prompts e regras (IA)" por linha (prompts de descrição, marketing e imagem; atributos exigidos; regras), com badges-resumo.
- `/app/products/[id]`: cards "Atributos exigidos pela linha" (conferência determinística: presente, faltando, manual), "Sugestão por foto (IA)" (foto escolhida, contexto, sugestão rotulada mock/api com modelo, prompt em auditoria; aplicação campo a campo com caixas desmarcadas, material e cor por escolha explícita, descarte com nota) e "Ciclo do produto" (sourcing de origem, solicitações, pedidos com pós-venda e recompra, kits, programações). `/app/sourcing/items/[id]`: a mesma sugestão por foto.
- `/app/marketing` (Wellmix: todos os kits com filtros; cliente: os seus a partir da oferta), `/app/marketing/new` (produto, cliente, preço padrão das configurações) e `/app/marketing/[id]` (studio: produto e imagens comerciais da ficha, textos do kit, sugestão de textos por IA confirmada, prévias, arquivos finais, linha do tempo prévia → oferta → compra → pagamento → liberação e ações por situação; cliente compra, acompanha e baixa depois da liberação).
- `/app/parties/[id]` (cliente): "Modalidade de operação" (importação própria, via trade, outra; RADAR; observações) com aviso quando importação própria sem RADAR; badge na lista de parceiros; pedido mostra a modalidade para Wellmix, cliente, despachante e jurídico.
- `/app/settings`: seção "IA, marketing e operação" com o modo efetivo da IA (api/mock/manual) sem expor a chave.

### Validação da Visão de Produto

Lint, typecheck, 29 testes unitários, E2E do caminho principal sobre o banco anterior à onda e sobre seed novo, build de produção, esquema publicado no Appwrite (aditivo); isolamento conferido no navegador pelos revisores com admin, operador, cliente, fornecedor, despachante, agência, armador, transportador e jurídico.

## Implementado na Segunda Onda

- Esquema aditivo publicado (32 tabelas): `tax_classifications`, `certifications`, `after_sales`; `products.ncm`/`priceTiers`; `product_lines.requiredCertifications`; `requests.origin`/`sourceOrderId`; `sourcing_items.requestId`/`priceTiers`; `purchase_snapshots.ncm`.
- Serviços: `taxes.ts`, `compliance.ts`, `after-sales.ts`, `history.ts`, `opportunities.ts`; `requests.ts` (`createFollowUpRequest`, sourcing sob demanda, gate de conformidade); `sourcing.ts` (promoção devolve o produto à solicitação); `tasks.ts` (pendências de pós-venda e de demanda); `control-tower.ts` (certificação a vencer); `engine.ts` (pós-venda ao concluir a entrega).
- Configurações: `afterSalesEnabled`, `complianceGateEnabled`, `certificationExpiryWarningDays`.
- Configurações expostas em `/app/settings` (seção "Conformidade e pós-venda").
- 7 testes novos (22 no total).

### Telas entregues na Segunda Onda

- `/app/products/[id]`: seções "Classificação fiscal (NCM)" (sugestão heurística por palavra-chave, candidatas manuais/do despachante, validar/rejeitar; só a validada vai para o produto), "Certificações e compliance" (exigido pela linha × válido, vencendo, documento, validar/vencer/rejeitar) e "Oportunidade" (faixas de preço editáveis e custo marginal até a próxima faixa, com a fórmula; containers do cliente com espaço).
- `/app/products/[id]/tax`: página só de classificação fiscal para Wellmix e despachante (sem preço, fornecedor ou cliente); o pedido linka para ela (Wellmix e despachante).
- `/app/lines`: certificações obrigatórias por linha (badges + formulário). `/app/parties/[id]` (fornecedor): certificações do fornecedor. `/app/account` (fornecedor): registra as próprias certificações, que entram pendentes.
- `/app/sourcing` e `/app/sourcing/items/[id]`: badge "Demanda de cliente" com link à solicitação, faixas de preço do item (copiadas na promoção), vínculo manual item ↔ solicitação em aberto sem produto.
- Pedido: card "Pós-venda" (cliente avalia: nota 1–5, experiência, problemas, custos percebidos, sugestões, interesse em repor; Wellmix vê e encerra), card "Comprar de novo / Nova proposta" (solicitação derivada pré-preenchida), badge de origem e link ao pedido de origem (só para quem pode abri-lo). `/app/requests/[id]` mostra a mesma origem.
- `/app/requests/new`: "produto fora do catálogo" cria a solicitação como sourcing sob demanda (item de sourcing + pendência da Wellmix).
- `/app/after-sales` (Wellmix): avaliações por situação, nota, problemas e interesse. `/app/history` (Wellmix filtra por cliente; cliente vê o seu): produto → compras → quantidade → custo (FOB só Wellmix) → frequência → reposição.
- Acesso a documentos: certificado (PDF) abre para o despachante e para o fornecedor dono do cadastro/produto; cliente e outros fornecedores não.

### Validação da Segunda Onda

Lint, typecheck, 22 testes unitários, E2E do caminho principal sobre o banco antigo (`.data-e2e` anterior à onda) e sobre seed novo, build de produção, esquema publicado no Appwrite (aditivo).

## Implementado na Prioridade Agora

- Esquema aditivo (`src/lib/db/schema.ts`): colunas novas em `parties`, `products`, `documents`; 12 tabelas novas; `PARTY_EXTRA_DEFAULTS`, `PRODUCT_EXTRA_DEFAULTS`, `DOCUMENT_EXTRA_DEFAULTS` para criar registros sem conhecer cada coluna nova.
- Camada de dados: coluna `json_large` (longtext) para planilhas; `appwrite-push` acrescenta valores a enums existentes e extensões ao bucket; `AppwriteStore.list` pagina (não trunca mais em 500) e traduz `id` nos filtros.
- Serviços: `sourcing.ts`, `import-batches.ts` (+ `xlsx.ts` sem dependências), `snapshots.ts`, `inspection.ts`, `reviews.ts`, `acknowledgements.ts`, `containers.ts`, `logistics/cbm.ts`; `control-tower.ts` ganhou totais e exceções de revisão.
- Motor: contexto `inspectionExtendedChecks`; hook de comparação após cada medida da inspeção; aprovação/liberação resolvem os itens de revisão; preço zerado gera item de revisão na criação do pedido.
- Configurações novas (`src/lib/settings.ts`): tolerâncias de dimensão/CBM/quantidade, `inspectionExtendedChecks`, `reviewOnZeroPrice`, `containerTypes`, `containerAllowMultiCustomer`, `containerMaxOccupancyPercent`.

### Telas entregues nesta onda

- `/app/sourcing` (itens e visitas), `/app/sourcing/visits/new|[id]`, `/app/sourcing/items/new|[id]`: mobile-first, câmera com compressão no aparelho, galeria por tipo de foto, medições, promoção a produto, descarte sem apagar.
- `/app/products/[id]` (ficha completa, fotos, medições, programação de compra → nova solicitação pré-preenchida); `/app/products` com colunas novas; `/app/parties/[id]` com contato/WeChat, visitas e produtos do fornecedor.
- `/app/import` (lote XLSX/CSV ao lado do CSV direto antigo) e `/app/import/[batchId]` (mapeamento → conferência → decisão → resumo).
- `/app/containers` e `/app/containers/[id]` (ocupação, peso, visão comercial, itens por pedido ou estoque, regra de consolidação); `/app/reviews` (fila com filtro e histórico); Control Tower com faixas Financeiro e Operação e visão comercial por container; `/app/settings` com as chaves novas.
- Pedido: snapshot da compra (Wellmix), resultado da inspeção, itens em revisão, nova medição (`?remeasure=1`), containers do pedido, trilha enviado → visualizado → confirmado em pagamentos e documentos; conta corrente com comprovante, câmbio e trilha.
- `src/app/app/error.tsx`: limite de erro amigável (papel sem acesso ou falha) em vez da tela padrão.

### Validação da onda

Lint, typecheck, 15 testes unitários, E2E do caminho principal sobre o banco antigo (registros sem as colunas novas) e sobre seed novo, build de produção, esquema publicado no Appwrite (`npm run appwrite:push`, aditivo).

## Reutilizado

`uploadDocument` (versionamento e visibilidade), `audit`, `notify`/`notifyWellmix`, `getSettings`, `loadFinance`, `loadControlTower`, `createRequest`/RFQ (para reposição e sourcing sob demanda na Segunda Onda), kit de componentes `ui.tsx`, `PageHeader` com ajuda contextual, dicionários pt/en/zh.

## Ampliado

`Party`, `Product`, `Document`, `StageContext`/`STAGE_TEMPLATES` (INSPECTION), `submitRequirement`/`decideRequirement`/`unblockStage`, `createOrderFromRequest`, `TowerException`, seed de demonstração, navegação (`navFor`), `docs/`.

## Pendente (próximas ondas)

- Segunda Onda: NCM/tributação com validação humana, integração mais profunda com o sistema chinês (só se houver API oficial), certificações por linha, pós-venda (entidade própria após DELIVERED), análise de oportunidade com fórmula reproduzível, reposição e “nova proposta” reaproveitando solicitação/RFQ, sourcing sob demanda.
- Visão de Produto, próximos passos: geração de imagem comercial por IA (hoje só o prompt de imagem), cobrança do kit por gateway (hoje manual), importador como entidade própria quando houver um segundo importador (ver `docs/ARQUITETURA.md`), medição 3D/LiDAR.

## Decisões técnicas

- **Aditivo sempre**: `ADD` antes de `DROP/RENAME`; enums só ganham valores; nenhum registro é apagado.
- **IA ≠ regra**: cálculo, saldo, CBM, tolerância, comparação, workflow, autorização e validação são código determinístico e auditável. IA fica para sugestões (descrição, categoria, leitura de imagem) sempre com confirmação humana.
- **IA sem credencial = manual, nunca inventada**: sem `ANTHROPIC_API_KEY` o adaptador é manual (a tela explica); `aiMode = MOCK` devolve um exemplo com "(mock)" em todo campo, para demonstração e testes. Toda sugestão guarda prompt, origem e modelo e só vira cadastro pelo formulário de confirmação.
- **Multi-importador por preparação, não por refatoração**: colunas `importerId` nulas (= Wellmix) hoje; a separação real vem com entidade `importers`, configurações por importador e filtro em `canView*` quando houver um segundo importador.
- **Modalidade de operação é dado do cliente e snapshot do pedido**: nenhum cliente é presumido com ou sem RADAR; só o cadastro explícito dispara o gate.
- **Snapshot em vez de referência**: o pedido guarda o que foi comprado; o cadastro mestre pode evoluir.
- **Inspeção cega**: o esperado nunca aparece ao inspetor; o motivo do bloqueio detalhado é visível só para a Wellmix.
- **Container**: capacidade por tipo em settings; consolidação entre clientes proibida por padrão; “disponível” só existe para itens sem pedido dentro do container.
- **Server Actions divididas** em `src/app/app/actions.ts` (existentes) e `src/app/app/actions/*.ts` (novas), com os mesmos helpers (`zod`, `assert*`, `audit`, `run`).
- **Dicionários por módulo** em `src/i18n/modules/*.ts`, fundidos em `dictionaries.ts`; o teste de paridade pt/en/zh cobre tudo.
- **Fotos no celular**: compressão no aparelho (`PhotoInput`) e `serverActions.bodySizeLimit` de 10 MB; na Vercel o corpo da requisição tem teto de ~4,5 MB, por isso a compressão é obrigatória, não opcional.
- **Limites conhecidos**: `nextNumber` não é atômico (colisão vira 409 no índice único); datas no Appwrite voltam com `+00:00`; MemoryStore não valida enum/tamanho (erros de esquema só aparecem em produção ou no E2E com `E2E_REUSE=1`).

## Recomendações futuras (não executadas por serem remoções ou mudanças de comportamento)

- Correspondência de fornecedor na importação por nome em chinês (hoje só por nome cadastrado, CNPJ e e-mail): acrescentar um nome alternativo ao parceiro.
- `PageHelp` recolhido por padrão nas telas de campo (o painel empurra o campo de foto para baixo da primeira dobra no celular).
- Programação de compra como cards no celular (a tabela rola na horizontal).
- Excluir container vazio em planejamento (hoje só encerra).
- Unificar `savePartyAction` com os campos de contato/WeChat (hoje um segundo formulário na tela do parceiro).

- Unificar `checkWeightDivergence` (peso declarado × medido) dentro de `compareInspection` quando todos os pedidos abertos tiverem snapshot.
- Reduzir as 3 notificações por evento (in-app, e-mail e WhatsApp mock) quando houver provedor real.
