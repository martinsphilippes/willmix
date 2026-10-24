# Appwrite

## Projeto

| Item        | Valor                                                           |
| ----------- | --------------------------------------------------------------- |
| Console     | https://cloud.appwrite.io                                       |
| Endpoint    | regional, ex.: `https://fra.cloud.appwrite.io/v1` (ver console) |
| Project ID  | `NEXT_PUBLIC_APPWRITE_PROJECT_ID`                               |
| Plataformas | Web: `localhost`, `portal-wellmix.vercel.app` e o domínio final |
| Auth        | E-mail e senha habilitado                                       |

## Publicar o esquema

```bash
npm run appwrite:connect   # valida variáveis, configura o CLI, grava projectId/endpoint no config
npm run appwrite:push      # regenera appwrite.config.json e publica banco, tabelas, colunas, índices e bucket
npm run appwrite:reset     # apaga dados transacionais (demonstração/testes); mantém cadastros
```

**Pelo GitHub (sem terminal):** Actions → "Publicar esquema Appwrite" → Run workflow (`.github/workflows/appwrite-schema.yml`). Uma vez só, cadastre a chave em Settings → Secrets and variables → Actions → New repository secret, nome `APPWRITE_API_KEY` (chave do console com escopos de banco e storage). Endpoint e projeto têm padrão no workflow e podem ser trocados em Variables (`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`). Rode sempre que um PR acrescentar tabela ou coluna em `schema.ts`. Depois do push, o mesmo botão numera as solicitações antigas sem número (`scripts/appwrite-backfill-request-numbers.ts`; só preenche número vazio, idempotente).

O push é feito por `scripts/appwrite-push.ts` com o SDK (TablesDB), idempotente: cria só o que falta e nunca apaga colunas. Motivo: o CLI 27 cria colunas pelas rotas antigas (`collections.*`), que a chave de API do console novo não cobre; as rotas de tabelas funcionam. `appwrite.config.json` continua gerado do `schema.ts` para referência e para `appwrite generate`.

Depois, crie os dados iniciais: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/admin/seed` (em desenvolvimento não exige o header). O seed cria os usuários no Appwrite Auth e as linhas correspondentes em `users`.

Estado: esquema publicado no projeto `6ab41ae700396f0409b8` (região `fra`) em 24/09/2026, com seed e fluxo E2E validados contra o banco real.

## Modelo de dados

Banco "Wellmix" (ID `willmix`, mantido por compatibilidade), 44 tabelas: as 17 originais (`users`, `parties`, `product_lines`, `products`, `requests`, `quotes`, `orders`, `order_items`, `stages`, `requirements`, `documents`, `payments`, `notifications`, `audit_log`, `penalties`, `settings`, `counters`), as 12 da Prioridade Agora (`supplier_visits`, `sourcing_items`, `product_photos`, `measurements`, `purchase_snapshots`, `purchase_schedules`, `containers`, `container_items`, `acknowledgements`, `review_items`, `inspection_results`, `import_batches`), as 3 da Segunda Onda (`tax_classifications`, `certifications`, `after_sales`) as 2 da Visão de Produto (`ai_suggestions`, `marketing_kits`), `product_lookups` (busca por foto/link), `freight_quotes` (frete pedido à companhia marítima por cotação do fornecedor), `freight_tariffs` (tarifário de frete: a planilha de cada companhia marítima, enviada por ela ou pela Wellmix em nome dela, com `shippingLineId`, ou a planilha consolidada, com `shippingLineId` nulo, como os registros de antes do campo; um `active` por companhia (e um consolidado) e os `replaced` no histórico; `data` é `longtext` com companhias, portos, taxas, PTAX/IOF, tarifas e avisos da conferência; índices `by_status` e `by_line` (`shippingLineId`+`status`); a Wellmix lê todas e monta o comparativo; a companhia lê só as dela) `cart_items` (carrinho da vitrine do cliente: um item por produto, variação e login, quantidade e personalização; `variantId` opcional; índice único `user_product_variant_unique` em `userId`+`productId`+`variantId`, que substitui `user_product_unique`: o índice antigo está em `drops` na definição e o push o apaga antes de criar o novo, e só ele), `manufacturer_cards` (cartões do fabricante por produto e fornecedor, índices `by_product` e `by_supplier`; a cotação guarda qual cartão foi confirmado em `quotes.manufacturerCardId`), `sheet_readings` (ficha lida pela foto do quadro: valores lidos, foto e decisões da Wellmix nas divergências, índice `by_sheet`), `product_suppliers` (fornecedores de cada produto do catálogo, vários por produto, com índice único produto+fornecedor: código do item na fábrica, última cotação e histórico; o principal continua em `products.supplierId`), `product_variants` (variações de um produto do catálogo, docs/PRODUCT_VARIANTS.md: `productId`, `name`, `key` normalizada (código de fábrica + nome; índice único `product_key_unique` em `productId`+`key`, índice `by_product`), `sortOrder`, `active`, `factoryItemCode`, `sizeText`, `price`, `currency`, `moq`, caixa master/inner, pesos, medidas, `cbm`, `colorAssortment`, `material`, `packageType`, `capacityMl`, `notes`, `photoDocumentId`, `importBatchId`; as colunas do produto e a ficha mestre espelham a variação de referência; `product_photos.variantId` (índice `by_variant`), `requests.variantId`/`variant` (JSON, cópia dos valores), `order_items.variantId`/`variant`, `purchase_snapshots.variantId` e `cart_items.variantId` são opcionais e só são enviados quando há variação, por isso tudo continua gravando antes de o esquema ser publicado; até lá o portal lê "sem variações") e `purchase_sheets` (ficha de compra da Preparação, uma por pedido e uma por cotação; `colorPantones` JSON com as cores Pantone escolhidas; a ficha mestre de cada produto do catálogo também mora aqui, com `orderId` = id do produto; `product_photos.kind` ganhou `angle`, `business_card`, `prompt` e `supplier`, a foto que veio na planilha do fornecedor, principal provisória até a original). `users`, `parties`, `product_lines`, `products`, `orders`, `documents`, `payments`, `requests` e `sourcing_items` ganharam colunas opcionais (em `requests`, o NCM confirmado, as sugestões de NCM, o `groupId` do lote, com índice `by_group`, quando várias solicitações nascem do mesmo formulário, o `number` da solicitação (inteiro, o mesmo para o lote inteiro, contador `request_number` em `counters`, índice `by_number`), e `schedule` JSON com a programação de entregas pedida pelo cliente; em `parties`, `storeNumber`, o nº da loja do fornecedor no mercado, que vai para a ficha de compra, e `paymentTerms` (JSON: parcelas da condição de pagamento ao fornecedor) com `paymentTermsNote`; em `products`, `colorPantones` JSON com as cores Pantone escolhidas no cadastro (o texto `pantone` continua); em `orders`, `supplierPaymentTerms` (JSON, a condição copiada quando o pedido nasce) e os dados do cancelamento, com `status` ganhando `CANCELLED` e `stages.status` ganhando `cancelled`) (registros antigos ficam nulos). O push acrescenta colunas e valores de enum que faltam e, no bucket, extensões, a permissão `create("users")` (envio direto do navegador com JWT da sessão; leitura continua só pelo servidor em `/api/files`; para isso o domínio do portal precisa estar cadastrado no projeto Appwrite como app Web, em Overview → Apps (o console antigo chamava de Settings → Platforms), ex.: `portal-wellmix.vercel.app`, senão o navegador bloqueia por CORS) e o teto de 50 MB (limite do Appwrite Cloud), sem remover nada; `import_batches.rows` é `longtext` (`json_large`). Colunas e índices em `schema.ts`; campos JSON (`requirements` da linha, `before`/`after` da auditoria, `value` de settings) são texto serializado.

`notifications` ganhou as colunas opcionais `kind` (action/alert/info/done: o que o aviso pede) e `actor` (com quem está o assunto). Enquanto o esquema não for publicado, o serviço detecta o erro de coluna desconhecida e grava o aviso sem elas (a tela classifica pelo assunto), então nenhuma operação cai por causa do aviso; publique o esquema logo após o deploy para os avisos novos saírem com o tipo gravado.

`packaging_briefs` (briefing de embalagem aberto com a RFQ: `requestId`, `agencyId` nulo = marketing Wellmix, `ownerSource`, `status` open/ready/transferred/cancelled, `requiredKeys` JSON, uma coluna por entregável vigente (`dielineDocumentId`, `artDocumentId`, `printReadyDocumentId`, `sampleDocumentId`), `dims` JSON com origem (`dimsSource`, `dimsQuoteId`, `dimsProvisional`, `dimsChangedAt`), textos, prazo, `orderId`/`orderArtRequirementId` depois do pedido; índices `by_request`, `by_agency_status`, `by_status`, `by_order`). `documents` ganhou `packagingBriefId` (opcional, índice `by_packaging_brief`; só os arquivos do briefing a levam, por isso os outros documentos continuam gravando mesmo antes do esquema publicado) e `type` ganhou `print_ready` e `packaging_sample`. Enquanto a tabela não é publicada, abrir a RFQ segue sem briefing (aviso no log), as pendências e listas ficam vazias e as telas do briefing dão 404.

Bucket `arquivos` (30 MB, antivírus e criptografia, gzip; aceita `json` para a tabela fiscal). Metadados em `documents`; acesso sempre por `/api/files/[id]`.

## Permissões

Tabelas e bucket **sem permissões de usuário**: só a API key do servidor lê e escreve. A autorização é feita na aplicação (`src/lib/auth/permissions.ts`, `canSubmitRequirement`, `canAccessDocument`). Permissão de linha no Appwrite fica como segunda barreira no hardening.

## Autenticação

Modo `appwrite`: login cria sessão com a API key (`account.createEmailPasswordSession`), segredo no cookie `a_session_<projectId>` HttpOnly; `getCurrentUser` valida a sessão e busca papel e parceiro na tabela `users` pelo e-mail. Usuários novos são criados por Wellmix em `/app/parties/[id]` (Appwrite Auth + tabela).

Modo `memory` (dev/testes): senha com scrypt na tabela `users`, cookie `wm_session` assinado com `SESSION_SECRET`.

## Realtime e Functions

Não usados nesta fase. Candidatas futuras: realtime na Control Tower; Function cron para lembretes se sair da Vercel.
