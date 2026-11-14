# Sankhya (ERP)

Integração com o Sankhya Om pela **API Gateway oficial** (https://developer.sankhya.com.br). Código: `src/lib/integrations/sankhya-client.ts` (cliente), `src/lib/integrations/sankhya-dictionary.ts` (dicionário de dados), `src/app/app/actions/sankhya.ts` (escritas) e a tela **Configurações → Sankhya** (`/app/settings/sankhya`, só o administrador).

## Credenciais (3 + 1 opcional)

| Variável                | De onde vem                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `SANKHYA_CLIENT_ID`     | Área do Desenvolvedor da Sankhya (a aplicação criada lá)                                |
| `SANKHYA_CLIENT_SECRET` | Área do Desenvolvedor da Sankhya                                                        |
| `SANKHYA_X_TOKEN`       | No Sankhya Om da empresa: tela **Configurações Gateway** (token da integração)          |
| `SANKHYA_BASE_URL`      | Opcional. `https://api.sankhya.com.br` (padrão) ou `https://api.sandbox.sankhya.com.br` |

Dois jeitos de informar: na tela **Configurações → Integração Sankhya** (tem prioridade) ou nas variáveis acima na Vercel (Production e Preview, e publicar de novo). Na tela, cada campo vazio mantém o valor gravado; sem nada gravado, vale a variável. Os segredos gravados pela tela ficam cifrados (AES-256-GCM) na tabela `settings` (chave `sankhya.credentials`), com a chave derivada de `SANKHYA_ENCRYPTION_KEY` ou, na falta, de `SESSION_SECRET` / `APPWRITE_API_KEY`; trocar esse segredo invalida o que foi gravado (a tela avisa "não decifra" e pede para gravar de novo). A tela nunca mostra os valores, só os 4 últimos caracteres; a auditoria registra só quais campos mudaram. Em produção sem nenhum desses segredos, a tela não grava credenciais. O cliente só aceita os dois endereços oficiais (o segredo não vai para outro host). As permissões no ERP são as do usuário vinculado ao token do gateway: o que ele não pode ver ou gravar no Sankhya, a API também recusa.

## Teste por curl

```bash
export SANKHYA_CLIENT_ID=...
export SANKHYA_CLIENT_SECRET=...
export SANKHYA_X_TOKEN=...
bash scripts/sankhya-curl.sh
```

Para não deixar os segredos no histórico do terminal, leia-os sem eco. No zsh (padrão do macOS): `read -rs "SANKHYA_CLIENT_SECRET?Client Secret: "`; no bash: `read -rsp "Client Secret: " SANKHYA_CLIENT_SECRET`; depois `export` as três. O X-Token da tela "Configurações Gateway" do Sankhya Om é de produção: contra o sandbox ele devolve `invalid_client`.

Autentica, lê 5 empresas (loadRecords), produtos (REST), busca tabelas no dicionário (SQL) e mostra as colunas de TDDLIG e TDDINS (para confirmar os nomes usados em `sankhya-dictionary.ts`). Mostra a resposta de cada passo; credencial errada para no passo 1 com o texto do Sankhya (`invalid_client`).

## Autenticação

`POST {BASE}/authenticate`, `Content-Type: application/x-www-form-urlencoded`, cabeçalho `X-Token`, corpo `grant_type=client_credentials&client_id=…&client_secret=…`. Devolve `access_token` (Bearer) com `expires_in` (≈ 300 s). O portal guarda o token em memória por instância até 30 s antes de vencer; um 401 renova uma vez. O login antigo (`/login` com usuário, senha, appkey e token) é legado e não é usado.

## O que o cliente faz

| Necessidade                                   | Como (serviço do Sankhya)                                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consultar qualquer entidade, com ligações     | `loadRecords` → `CRUDServiceProvider.loadRecords` (entidade, campos ou `*`, ligações por `path`, critério com `?`, paginação `hasMoreResult`)                                       |
| Ver todas as tabelas, campos e relações       | `searchTables` / `describeTable` → SQL nas tabelas do dicionário: `TDDTAB` (tabelas), `TDDINS` (entidades), `TDDCAM` (campos), `TDDLIG` (ligações). Inclui as personalizadas `AD_*` |
| SQL livre somente leitura                     | `executeQuery` → `DbExplorerSP.executeQuery` (só `SELECT`/`WITH`; o portal recusa o resto). Exige o usuário do gateway com acesso ao Explorador de banco                            |
| Incluir/alterar registro de qualquer entidade | `datasetSave` → `DatasetSP.save` (sem `pk` inclui, com `pk` altera)                                                                                                                 |
| Pedido de venda/compra, orçamento, cotação    | `createNote` → `CACSP.incluirNota` (módulo `mgecom`). O tipo da nota vem da **TOP** (`CODTIPOPER`) e do `TIPMOV` do ERP                                                             |
| Editar itens do pedido/cotação                | `upsertNoteItems` → `CACSP.incluirAlterarItemNota` (com `SEQUENCIA` altera o item); cabeçalho por `DatasetSP.save` na entidade `CabecalhoNota` com `pk` `NUNOTA`                    |
| Cancelar                                      | `cancelNotes` → `CACSP.cancelarNota` (faturadas não cancelam)                                                                                                                       |
| Faturar (pedido → nota)                       | `invoiceNotes` → `SelecaoDocumentoSP.faturar` (TOP de destino)                                                                                                                      |
| Sincronizar só o que mudou                    | `tableChanges` → `GatewayServiceProviderSP.logAlteracoesTabelas`; ou `modifiedSince` no loadRecords (exige o log de alterações ligado no ERP)                                       |
| API REST v1                                   | `rest("GET", "/v1/produtos")`, `/v1/vendas/pedidos` (incluir, alterar, consultar, cancelar), estoque, preços, parceiros, financeiro                                                 |

Entidades comuns: `Produto` (TGFPRO), `Parceiro` (TGFPAR, clientes e fornecedores), `CabecalhoNota` (TGFCAB) e `ItemNota` (TGFITE) para pedidos e cotações, `Estoque` (TGFEST), `TipoOperacao` (TGFTOP), `TipoNegociacao` (TGFTPV), `Vendedor` (TGFVEN), `Empresa` (TSIEMP), `Financeiro` (TGFFIN).

## Tela Configurações → Integração Sankhya

`/app/settings/sankhya` (aba padrão; só o administrador; código em `src/app/app/settings/sankhya/_integration.tsx`, ações em `src/app/app/actions/sankhya-integration.ts`, configuração em `src/lib/integrations/sankhya-settings.ts`):

1. **Credenciais**: ambiente, Client ID, Client Secret e X-Token (ver acima), com a origem de cada um (tela ou variável).
2. **Teste de autenticação**: token novo + leitura das empresas; mostra tempos, validade e tamanho do token (nunca o token).
3. **Códigos do ERP** (chave `sankhya.erp` em `settings`): na tela só o que ainda se escolhe — tipo de negociação (CODTIPVENDA, escolhido da aba Condições de pagamento), moeda e CODMOEDA, e qual número do Sankhya vira o número do pedido (NUNOTA ou NUMNOTA). Os valores fixos das respostas da Wellmix (empresa 3, natureza 203005, centro de resultado 101006, projeto 0, comprador 0) ficam num bloco recolhido. As TOPs não são mais digitadas aqui: salvar as regras em Processos grava `topQuote` (regra "aguardando sinal → incluir nota") e `topOrder` (regra "assinado pelos dois"), usadas pelo adaptador e pelo pedido de teste. O volume é sempre UN (`volumeMode` fixo, `codVol` UN). `paymentFromSupplier` e `autoLink` continuam gravados mas saíram da tela (não tinham efeito). `ordersEnabled` liga em Processos → "Execução no Sankhya".
4. **Consultas de exemplo**: empresas, produto pela referência do fornecedor (REFFORN), parceiro pelo nome, TOPs de pedido/cotação e últimas notas das TOPs gravadas; mostra o pedido feito ao Sankhya, a tabela e o JSON.
5. **Pedido ou cotação de teste**: pré-visualização (confere no ERP parceiro, produto e TOP, lê TIPMOV e o volume, e mostra o JSON do `CACSP.incluirNota`), envio, o que ficou gravado (CabecalhoNota e ItemNota) e o cancelamento. Tudo na auditoria (`sankhya.note.test`, `sankhya.note.cancel`).

## Tela Configurações → Carga do Sankhya (mapeamento e amostra)

`/app/settings/sankhya?tab=load` (só o administrador; mapeamento em `src/lib/integrations/sankhya-mapping.ts`, amostra em `sankhya-sample.ts`, tela em `src/app/app/settings/sankhya/_load.tsx`). Primeiro passo da carga do histórico: **só leitura, nada é gravado no portal**.

| Sankhya                | Portal                    | Casamento com o que já existe |
| ---------------------- | ------------------------- | ----------------------------- |
| CabecalhoNota (TGFCAB) | `orders`                  | `erpNumber` = NUNOTA          |
| Parceiro (TGFPAR)      | `parties`                 | CNPJ/CPF ou nome              |
| ItemNota (TGFITE)      | `order_items`             | —                             |
| Produto (TGFPRO)       | `products`                | `sku` = REFFORN (código WX)   |
| GrupoProduto (TGFGRU)  | `product_lines`           | nome                          |
| Estoque (TGFEST)       | saldo inicial (calculado) | —                             |
| Financeiro (TGFFIN)    | `payments`                | —                             |

A amostra (1 a 5 por entidade) é coerente: as últimas notas das TOPs de importação (descrição com "IMP") e, delas, os parceiros, itens e financeiro; dos itens, os produtos; dos produtos, os grupos e o estoque. Tudo por SQL somente leitura com listas de inteiros. Se uma coluna do mapeamento não existir no ERP, a tela refaz a consulta com `*`, mostra as colunas que faltam e as que a tabela tem. Para cada registro, a tela mostra o valor convertido (e o original quando muda) e se já existe um cadastro equivalente no portal.

### Todas as colunas e ligações (10/11/2026)

- **Todas as colunas**: a amostra pede `SELECT *` (poucos registros) e cada entidade tem o bloco "Todas as colunas do Sankhya": coluna, destino no portal e o valor de cada registro. As colunas com valor e **sem destino** aparecem primeiro (campos `AD_` no topo); as vazias em todos os registros ficam numa linha no fim. É dali que se escolhe o que ainda mapear.
- **Ligações** (`src/lib/integrations/sankhya-relations.ts`): valores de outras tabelas, buscados à parte com `SELECT *` e tolerantes (tabela ou coluna que não existe deixa só aquele valor vazio). No mapeamento, são os campos com `via`.
  - Parceiro: cidade "Cidade - UF" (TSICID + TSIUFS), país (TSIPAI), endereço (TSIEND + NUMEND + COMPLEMENTO + TSIBAI + CEP), contato (primeiro de TGFCTT; o e-mail e o telefone dele quando o parceiro não tem). Do próprio TGFPAR: razão social (`legalName`), inscrição estadual (`stateRegistration`) e tipo de pessoa F/J (`personType`).
  - Produto: fornecedor e preço da última nota de importação com o produto (TGFITE + TGFCAB; preço ÷ câmbio da nota, na moeda do pedido), caixas master e interna pelos volumes alternativos (TGFVOA: o maior volume é a master; com dois ou mais, o menor acima de 1 é a interna), observações = COMPLDESC + marca. Só preenchem o que estiver vazio no portal.
  - Pedido: condição de pagamento (CODTIPVENDA → `paymentConditionId`, pela tabela Condições de pagamento), Incoterm (CIF_FOB: C → CIF, F → FOB; `incoterm`), câmbio (`fxRate`), transportadora (CODPARCTRANSP → parceiro do tipo transportadora, `carrierId`), previsão de entrega (DTPREVENT, nas observações).
  - Título: forma de pagamento (CODTIPTIT → TGFTIT) e o câmbio do pedido.
- Colunas novas (aditivas): `parties.legalName`, `parties.stateRegistration`, `parties.personType`, `orders.incoterm`, `orders.paymentConditionId`, `orders.fxRate`. Publicar o esquema antes de usar. A ficha do parceiro mostra razão social e inscrição estadual; o pedido mostra Incoterm, condição de pagamento e câmbio (só a Wellmix).

### Migração (10/11/2026)

Decisão da Wellmix: o que hoje está no portal (vendas e cadastros equivalentes aos do Sankhya) é teste; o Sankhya passa a ser a fonte de todo o histórico.

1. **Configurações → Limpar dados de teste**: apaga as vendas (como antes; agora também os eventos de processo).
2. **Mesma tela, "Apagar também os cadastros que vêm do Sankhya"** (`src/lib/services/catalog-reset.ts`, ação `resetCatalogDataAction`, palavra APAGAR): só com as vendas já apagadas. Apaga fornecedores, clientes e transportadoras, produtos (com fotos, variações, fornecedores do produto, classificação fiscal), linhas, condições de pagamento e locais de estoque. Mantém usuários, os outros tipos de parceiro, o cliente "Estoque Wellmix" e as configurações. O que fica e apontava para um cadastro apagado: coluna obrigatória → sai junto; opcional → perde a ligação. Usuários não são apagados nem desativados: o fornecedor ou cliente que tem usuário fica (a carga o liga ao Sankhya pelo CNPJ ou nome). Zera os cursores da carga (`sankhya.load.*`).
3. **Carga do Sankhya → Carga completa**, nesta ordem: condições de pagamento, fornecedores e clientes, produtos, locais de estoque, saldos por local, histórico de pedidos. "Rodar até o fim" reenvia sozinho enquanto a página estiver aberta.

### Limpar os testes do portal (12/11/2026)

**Configurações → Limpar dados de teste → "Apagar só os testes do portal (mantém o Sankhya)"** (`src/lib/services/portal-test-reset.ts`, ação `resetPortalTestsAction`, palavra APAGAR). Para refazer os testes e, no roll-out, zerar o que foi criado na fase de testes. A tela mostra antes quantos registros de cada tabela saem.

- Sai: bookings (lotes, itens, convites), solicitações ao fornecedor, agrupamentos da seleção, carrinho e chat; produtos, pedidos e solicitações sem `sankhyaCode` (a solicitação de um pedido do Sankhya fica); o que depende deles (obrigatório sai, opcional perde a ligação); documentos e fotos desses registros, com o arquivo, e documentos soltos que ninguém usa; avisos, histórico e confirmações dos registros apagados. A numeração de bookings, convites e solicitações ao fornecedor recomeça do 1.
- Fica: tudo com `sankhyaCode` (nunca apaga linha com código), saldos `sankhya_balance`, usuários, parceiros (os sem código têm usuário), acordos de comissão, configurações e a carga do Sankhya.
- Pode rodar de novo: se parar no limite de tempo, continua de onde parou.

**Duplicados de 11/11/2026**: o `SupabaseStore.list` parava em 10 mil linhas sem avisar; a carga, que procura o cadastro já existente na lista inteira de parceiros e produtos, não achava os de depois e criava de novo (4.341 produtos, 565 parceiros e 94 linhas com o mesmo código). Corrigido: a lista lê a tabela inteira (o total vem na primeira página, as outras em paralelo) e o lote de notas do histórico ficou de 1 a 3 (de 3 a 8 desde 12/11/2026, depois de a nota ficar rápida no portal). Cada nota do histórico lê só os parceiros, produtos e linhas dos códigos que ela usa (mais os nascidos no portal, sem código, que a carga liga por CNPJ, nome ou referência; `importContext` com escopo), em vez das tabelas inteiras. Os duplicados foram unificados no banco (decisão do dono): ficou o cadastro mais antigo de cada código, as ligações (`productId`, `lineId` e as colunas de parceiro) passaram para ele e uma cópia do que saiu está em `backup_dedupe_20261111_*`.

**Carga no servidor (11/11/2026)**: "Rodar tudo no servidor" (ou "No servidor" numa entidade) liga uma fila (`src/lib/integrations/sankhya-load-queue.ts`, settings `sankhya.load.server`) que roda mesmo com o navegador fechado. Ordem da fila: condições, locais, parceiros, produtos, saldos, pedidos, fotos dos produtos (só as que faltam). A cada 30 segundos (desde 11/11/2026; antes, a cada minuto) o agendador do Supabase (pg_cron + pg_net) chama `GET /api/jobs/sankhya-load`, que roda uma rodada de ~30 s da primeira entidade, com a pessoa que ligou a fila (admin ativo). Terminada a entidade, passa para a próxima; fila vazia desliga sozinha. O progresso é gravado a cada lote (uma rodada cortada no limite de 60 s da Vercel não perde o que já gravou) e lotes de parceiros e produtos são de até 120 linhas. Uma rodada de cada vez (trava de 90 s; o agendador às vezes entrega duas chamadas no mesmo instante, então cada rodada grava uma marca própria, espera 1,5 s e relê: só segue a que encontrar a sua — antes disso, em 11/11/2026, duas rodadas juntas gravaram 10 notas e 4 linhas em dobro, já unificadas); cinco erros seguidos param a fila e mostram o erro. A rota aceita `CRON_SECRET` ou a chave `sankhya.load.cronToken` (gerada ao ligar a fila e guardada no banco; o agendador a lê de lá). O agendador só chama enquanto a fila está ativa:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('wellmix-sankhya-load', '30 seconds', $$
  select net.http_get(
    url := 'https://portal-wellmix.vercel.app/api/jobs/sankhya-load',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select value #>> '{}' from public.settings where key = 'sankhya.load.cronToken' limit 1)),
    timeout_milliseconds := 60000)
  where exists (select 1 from public.settings
    where key = 'sankhya.load.server' and (value->>'active')::boolean);
$$);
```

O que a carga guarda para não perder vínculos:

- `sankhyaCode` em parceiro (CODPARC), produto (CODPROD), linha (CODGRUPOPROD), pedido (NUNOTA), item do pedido (SEQUENCIA, novo), pagamento (NUFIN) e local (CODLOCAL).
- `sankhyaRefs` (JSON, novo) em parceiro, produto, pedido, item e pagamento: todas as colunas COD* e NU*, SEQUENCIA e as de endereço (NUMEND, COMPLEMENTO, CEP, TIPPESSOA, TIPMOV, CIF_FOB, STATUSNOTA) do registro de origem. Guarda as ligações que o portal não tem como campo (empresa, vendedor, natureza, centro de resultado, cidade, bairro, logradouro, local do item...). Na carga completa de parceiros e produtos a consulta pede todas as colunas para isso.
- Marca: `products.brand` (MARCA), no cadastro do produto.

**Locais de estoque** (CODLOCAL): tabela `stock_locations` (TGFLOC). Saldos: TGFEST da empresa da Integração (CODEMP), somados por produto e local (os lotes/CONTROLE juntos). A carga grava a diferença entre o saldo do Sankhya e o do portal naquele local como movimentação `sankhya_balance` com `locationId`; rodar de novo só grava o que mudou. A tela Estoque mostra, abaixo de "No Brasil", a quantidade por local; Movimentações tem a coluna Local. As regras de Processos ganharam "Local de estoque": as entradas e saídas da regra vão para aquele local. Pedidos do histórico não contam no estoque (o estoque vem dos saldos).

**Fotos dos produtos** (14/11/2026, orientação do técnico da Sankhya; `src/lib/integrations/sankhya-images.ts`): entidade "Fotos dos produtos" da Carga completa, a última da fila do servidor.

- Leitura: `DbExplorerSP.executeQuery` com `SELECT CODPROD, NUVERSAOIMG, IMAGEM FROM TGFPRO WHERE CODPROD = n`, **uma foto por chamada** (a resposta passa de 1 MB), sempre pelo servidor. A imagem vem em hexadecimal (com ou sem `0x`); o formato sai dos primeiros bytes (JPEG, PNG, GIF, WebP, BMP). Nula ou que não é imagem = sem foto.
- Colunas e onde ficam no cadastro (`product_photos`, legenda "Sankhya: …"): `IMAGEM` → comercial, principal quando o produto não tem outra; `AD_IMAGEM05` (arte 800x800) → comercial; `AD_IMAGEM02` (origem China) → fornecedor; `AD_IMAGEM03` (arte) → outra; `AD_IMAGEM04` (balança) → balança. Coluna AD_ que o ERP não tem é avisada na tela ("colunas que faltam") e pulada.
- Passada por faixa de CODPROD: a lista traz `CODPROD`, `NUVERSAOIMG` e, por coluna, `CASE WHEN col IS NULL THEN 0 ELSE 1 END` (sem a imagem; vale no SQL Server e no Oracle). Só baixa a coluna com imagem cujo `NUVERSAOIMG` mudou ou que o portal ainda não tem; a coluna que ficou vazia sai do cadastro. Estado em `products.sankhyaImages` (`version`, foto de cada coluna). Três downloads em paralelo; cursor gravado a cada grupo.
- Arquivo original guardado inteiro (até 3000x3000) e miniatura JPEG de lado maior 640 px (`documents.thumbKey`). As listas e vitrines pedem `/api/files/<id>?thumb=1` (sem miniatura, vem o original); a galeria aberta e o link mostram o original. Foto trocada: a linha antiga de `product_photos` sai; o documento e o arquivo ficam (podem estar copiados numa ficha ou pedido).
- Link: `/produto/{CODPROD}.jpg` (IMAGEM), `/produto/{CODPROD}-mini.jpg` (miniatura), `-arte800`, `-china`, `-arte`, `-balanca` (e `-mini` no fim de cada um). Exige sessão; leva a `/api/files`, que confere o acesso.
- Atualização: o job diário (`/api/jobs/reminders`) recomeça a passada quando a anterior terminou há mais de 20 h e põe na fila do servidor, com a pessoa que ligou a fila da última vez (admin ativo).
- Carga inicial: ~11,2 mil produtos ativos com foto. Na fila do servidor (rodadas de ~30 s a cada 30 s), algumas horas.
- Permissão: o usuário da integração precisa de acesso ao `DbExplorerSP`; erro de permissão aparece na tela (erro da fila) com o texto do Sankhya, e aí é avisar o técnico.

**Histórico de pedidos**: TGFCAB das TOPs de importação por faixa de NUNOTA, em lotes de 3 a 10 notas (cada uma vira solicitação, pedido, itens, etapas e títulos, como na amostra). Já carregada = pulada.

**Histórico em espera até o go-live** (decisão do dono, 13/11/2026): os 16.268 pedidos da carga do histórico tinham 489 mil pendências abertas e 16 mil etapas ativas. Os lembretes geraram 52 mil avisos em dois dias (sino, e-mail e WhatsApp em mock), e as telas que leem pendências (Pendências, Pedidos, Solicitações ao fornecedor) chegaram a 47 s, com estouro de memória e de tempo no banco.

- **Marca:** pedidos, etapas e pendências desses pedidos ganharam `held` (coluna opcional em `orders`, `stages` e `requirements`). A situação real não muda.
- **Etapas e pendências:** a linha marcada fica fora das listas gerais, que filtram só por situação ou chave (Pendências, lembretes, SLA, torre, contagens). A leitura de um pedido (`orderId`), de uma etapa (`stageId`), por `id` e quem filtra `held` de propósito veem tudo, então a tela do pedido e as ações nele funcionam como antes. A regra fica em `hidesHeld` (`src/lib/db/store.ts`), nos três stores; no Supabase vira `held=not.is.true`, com índices parciais (`*_live_by_status`, `requirements_live_by_key`).
- **Pedidos:** a marca não esconde o pedido. As telas de pedidos continuam mostrando todos, e só as pendências por pedido (produção, embarque, desembaraço, certificação, artes, pagamento a confirmar e a pagar) leem `held: null` (`src/lib/services/tasks.ts`, `artwork.ts`). Contas a pagar continua mostrando as parcelas.
- **Resumos:** não trazem pendência de etapa em espera (`order_summaries.tasks` desses pedidos foi esvaziado).
- **Avisos:** os gerados por esses pedidos foram apagados.
- **Carga:** marca sozinha os pedidos novos do histórico até o go-live.
- **Overview dos blocos** (14/11/2026): aparecem à parte, pela situação ("+N em espera" em cada bloco e passo, e a lista), sem pendências, atraso nem completude (docs/FLOW_MENU.md).

**Go-live** (Configurações → Go-live, `/app/settings/go-live`, só admin): mostra quantos pedidos, etapas e pendências estão em espera. Antes, traga a situação real do Sankhya; depois, marque a confirmação e clique em "Fazer o go-live". A liberação desliga a marca nas cargas seguintes e tira `held` em partes, 100 pedidos por gravação e até 1.500 por rodada, com barra de andamento (`src/lib/services/go-live.ts`). Em 13/11/2026 uma gravação única das 613 mil linhas encheu o disco do banco. Fechou a tela: para onde estava e continua na volta. No fim, reconstrua os resumos (Configurações → Resumos dos pedidos) ou espere a reconstrução da noite. Estado em `settings` (`sankhya_history_hold`); auditoria `sankhya.go_live.start` e `sankhya.go_live`.

**Incluir no Sankhya a partir do portal**: parceiro leva razão social, tipo de pessoa, inscrição estadual e os códigos de endereço (de `sankhyaRefs`; nascido no portal, o CODCID é procurado pela cidade "Nome - UF" em TSICID/TSIUFS); produto leva a marca; a nota leva a condição de pagamento do pedido (senão a da Integração), o Incoterm (CIF_FOB) e o câmbio (VLRMOEDA). Integração → **6. O que o Sankhya exige para incluir** (`sankhya-required.ts`) lê do catálogo do banco do ERP (SQL Server ou Oracle) as colunas NOT NULL sem padrão de TGFPAR, TGFPRO, TGFCAB e TGFITE e mostra, para cada uma, se o portal envia (cadastro, valor fixo, gerada pelo Sankhya) ou se falta. Faltando, o valor fixo vai em Processos → valores fixos dos cadastros. Resultado no ERP da Wellmix (SQL Server, 10/11/2026): faltavam só DTALTER/DTCAD (datas de controle), DHTIPOPER (versão da TOP), CODEMPNEGOC e NUMNOTA no cabeçalho e CODEMP no item. As datas e a versão da TOP o Sankhya preenche ao incluir (status "Preenchida pelo Sankhya"); CODEMPNEGOC (= empresa), NUMNOTA (0, o Sankhya numera) e o CODEMP do item passaram a ir explícitos. A conferência cobre também as tabelas que o portal só lê, com o motivo: grupos (TGFGRU) e condições (TGFTPV) nascem no Sankhya e vêm pela carga; locais (TGFLOC) são do Sankhya/WMS; o saldo (TGFEST) muda pelas notas e TOPs, nunca gravado direto; o financeiro (TGFFIN) é só consulta (decisão 16). Pedido e cotação são a nota (TGFCAB + TGFITE).

### Gravar a amostra no portal

Botão **Gravar no portal** na mesma aba (`src/lib/integrations/sankhya-import.ts`, ação `sankhyaImportSampleAction`, auditoria `sankhya.import`). Decisões da Wellmix (10/11/2026): os pedidos do Sankhya entram como **pedidos normais**, a **TOP define a etapa** e os **valores ficam em R$**.

- Cada nota (das N últimas, 1 a 5) vira uma solicitação (`ORDERED`) + pedido (`erpNumber` = NUNOTA, `erpSyncStatus` = synced, `fobTotal` = VLRNOTA em BRL) + itens (TGFITE) + as etapas do portal. As etapas antes da etapa da TOP ficam concluídas (requisitos dados como feitos, nota "Etapa concluída no Sankhya"), a da TOP fica ativa; FINALIZADO encerra o pedido.
- TOP → etapa (`TOP_STAGES` em `sankhya-mapping.ts`): 33 e 1101 pedido → Pedido criado; 1104 ATV FIN/PRODUÇÃO → Pagamento ao fornecedor; 1102 MARKETING → Embalagem; 1105 INSPECTION → Inspeção; 1103 CHECK ETD/ETA e 1106 CHECK-IN → Embarque; 1107 EMBARCADO e 1109 VALIDAÇÃO DI → Desembaraço; 1201 NOTA IMPORTAÇÃO → Transporte; 1401 RECEBIMENTO WMS → Entregue; 1402 FECHAMENTO → Encerramento; 1403 FINALIZADO → encerrado. Cotações, pré-pedidos, amostras e notas avulsas não viram pedido.
- Fornecedor = parceiro da nota; cliente = a empresa da nota (TSIEMP, código `EMP-<CODEMP>`). Produtos sem grupo vão para a linha "Importados do Sankhya". Financeiro (TGFFIN) vira pagamento ao fornecedor/recebimento em BRL, pendente ou confirmado pela baixa.
- **Vínculo**: coluna opcional `sankhyaCode` em `parties`, `product_lines`, `products` e `payments` (índice `by_sankhya`). Rodar de novo não duplica: reaproveita pelo código; sem código, por CNPJ/nome, SKU = REFFORN ou nome da linha (e grava o código). Estoque não é gravado (o portal calcula).
- **Produção**: antes do primeiro uso, publicar o esquema (Actions → "Publicar esquema Appwrite") para criar as colunas `sankhyaCode`.

## Tela Configurações → Sankhya: explorar dados

`/app/settings/sankhya?tab=explore`. Teste de conexão, busca no dicionário (tabela → entidades, campos e ligações, com link para a tabela ligada), consulta de entidade com ligações e paginação, SQL somente leitura, e as escritas: registro (DatasetSP.save), pedido/orçamento/cotação (CACSP) e cancelamento. Leituras rodam no servidor por GET; escritas são Server Actions do admin, com zod e registro na auditoria (`sankhya.*`). Erros mostram o código e o texto do Sankhya.

## Validado contra o ERP da Wellmix (10/11/2026, produção)

- Autenticação em `https://api.sankhya.com.br` (o X-Token do Sankhya Om é de produção; no sandbox dá `invalid_client`). Token de ~2300 caracteres, `expires_in` 300.
- `loadRecords`: `entities.total`, `hasMoreResult`, `metadata.fields.field[].name` e células `f0`, `f1`… no formato `{"$": "valor"}` (37 empresas; 1 = WELLMIX - MTZ, 2 = WELLMIX - SP, 3 = WELLMIX - SC).
- REST `GET /v1/produtos`: `{"produtos": [...]}` com `codigoProduto`, `nome`, `referencia` (EAN), `referenciaFornecedor`, `volume`, `ncm`, `pesoBruto` etc. Atenção: a chave da data vem como `"dataAlteracao:"` (com dois-pontos no nome).
- `DbExplorerSP.executeQuery`: `fieldsMetadata[].name` + `rows` (matriz).
- Dicionário: TDDLIG tem `NUINSTORIG`, `NUINSTDEST`, `TIPLIGACAO`, `EXPRESSAO`, `NOMELIGACAO`…; TDDINS tem `NUINSTANCIA`, `NOMETAB`, `NOMEINSTANCIA`, `DESCRINSTANCIA`, `NUINSTANCIAPAI`… (os nomes usados em `sankhya-dictionary.ts` conferem).
- Tabelas personalizadas de importação existentes: `AD_NFIMPORTACAO` (Notas Importação Wellmix), `AD_NFIMPORTACAOFILHA` (Notas Filha), `DEV_VW_NOTANACIO` (Notas Nacionalização).

`bash scripts/sankhya-curl.sh codigos` lista os códigos para o pedido (TOPs de compra, tipos de negociação, vendedores/compradores, locais) e as colunas de `AD_NFIMPORTACAO`.

## Sincronização portal → Sankhya (fase 3)

Decisões 8 e 14: o que nasce ou muda no portal vai para o Sankhya, e os dois ficam iguais (`src/lib/integrations/sankhya-sync.ts`, `src/lib/integrations/sankhya.ts`).

- **Fornecedor e cliente** (`parties` supplier/customer) → Parceiro (TGFPAR) por `DatasetSP.save`: NOMEPARC, RAZAOSOCIAL (ao incluir), TIPPESSOA (CPF = F), CGC_CPF, EMAIL, TELEFONE, ATIVO, FORNECEDOR ou CLIENTE = S, mais os **campos fixos** do parceiro.
- **Produto** → Produto (TGFPRO): DESCRPROD, REFFORN (SKU), REFERENCIA (EAN), NCM, CODVOL (UN), CODGRUPOPROD (grupo da linha, obrigatório ao incluir), pesos, medidas em metros, ATIVO, mais os campos fixos do produto.
- Antes de incluir, procura no Sankhya (CNPJ/CPF ou nome; REFFORN): se já existe, só **vincula** (`sankhyaCode`) e manda os dados do portal. Depois de incluir, lê o código gerado do mesmo jeito.
- **Pedido**: depois das duas assinaturas, `getSankhyaAdapter().createOrder` usa a nota já ligada (cotação/pre-order das regras de processo) ou inclui o pedido com a TOP de pedido; sem a execução ligada, segue manual como antes. A regra "assinado → faturar para 1101" pula a nota que já está na TOP. **Itens** do pedido ligado: quantidade e preço alterados e itens novos vão para a nota (`CACSP.incluirAlterarItemNota`); item que saiu do pedido é avisado (remover no Sankhya). Cancelamento: regra de processo.
- **Pendente** = criado depois de `syncSince` (gravado na primeira vez que a execução é ligada) e sem código, ou alterado depois de `sankhyaSyncedAt`. A carga grava `sankhyaSyncedAt`: o que veio do Sankhya não volta duplicado.
- **Quando roda**: logo depois das telas de cadastro de parceiro e de produto gravarem; no job diário (`/api/jobs/reminders`); em `/api/jobs/sankhya-sync` (agendador externo, com `CRON_SECRET`); e no botão "Sincronizar agora" (Configurações → Processos), que mostra as pendências. Só com a execução no Sankhya ligada. Cada envio fica em `process_events` (`sync:party|product|order:create|update`).
- **Campos fixos** (Configurações → Processos): JSON com colunas que o Sankhya exige ao incluir e o portal não tem (ex.: `{"USOPROD": "R"}`). A recusa do Sankhya aparece em "Últimos eventos" com o texto dele.

## Decisões da Wellmix (10/11/2026)

| #   | Tema                     | Decisão                                                                                                                                                            | Onde está                                                |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | Empresa                  | Pedido de compra sempre na empresa 3 (WELLMIX - SC)                                                                                                                | Integração → códigos (`codEmp` = 3)                      |
| 2   | TOP × status             | Hoje a TOP marca a etapa; vai ser descontinuada (uma TOP só para o pedido). O portal ganha uma tela de processos: status → movimentação de estoque                 | Processos (docs/PROCESSES.md); carga usa `TOP_STAGES`    |
| 3   | CODTIPVENDA              | É a tabela de condições de pagamento (compra e venda); o portal tem uma igual, vista e editada em Configurações                                                    | Aba Condições de pagamento (`payment_conditions`)        |
| 4   | CODLOCAL                 | O portal não usa: quem cuida é o WMS                                                                                                                               | Não é enviado nem mostrado                               |
| 5   | CODVOL                   | Sempre UN                                                                                                                                                          | Integração → códigos (volume fixo UN)                    |
| 6   | Cadastros                | Fornecedores, produtos e clientes inteiros vão para o portal                                                                                                       | Carga do Sankhya → Carga completa                        |
| 7   | Códigos do produto       | REFFORN = código interno (SKU), CODPROD = código único (vínculo), REFERENCIA = EAN                                                                                 | `products.sku`, `sankhyaCode`, `ean`                     |
| 8   | Novos cadastros          | Produto, fornecedor, cliente e pedido novos no portal são criados no Sankhya pela integração                                                                       | Fase 3: sincronização (abaixo) e regras de processo      |
| 9   | Moeda                    | Pedido em USD (502 de 518) com o câmbio no pedido (ex.: 5,16); moeda de origem do fornecedor (RMB) registrada à parte                                              | Carga: USD = VLRNOTA ÷ VLRMOEDA; códigos: moeda/CODMOEDA |
| 10  | Incoterm                 | Campo próprio no pedido: FOB (380), EXW (137), nenhum CIF                                                                                                          | A mapear (nome da coluna)                                |
| 11  | Natureza                 | 203005 (COMPRA INTERNACIONAL), centro de resultado 101006 (IMPORTACAO), projeto 0                                                                                  | Integração → códigos                                     |
| 12  | Momento de envio         | Cotação (1002) → pre-order (1100) → pedido (1101), feitos pelo planejamento: cada passo é um gatilho de status que escreve a TOP no Sankhya (sem mexer no estoque) | Configurações → Processos (docs/PROCESSES.md)            |
| 13  | Número de referência     | Configurável: NUNOTA ou NUMNOTA                                                                                                                                    | Integração → códigos (`erpNumberField`)                  |
| 14  | Alteração/cancelamento   | Sempre refletem no Sankhya: os dois sistemas ficam sincronizados                                                                                                   | Fase 3: sincronização (abaixo) e regras de processo      |
| 15  | Faturamento              | Evento de status no portal que escreve a TOP no Sankhya                                                                                                            | Configurações → Processos (docs/PROCESSES.md)            |
| 16  | Frete, financeiro, notas | Só consulta (o que o portal não tem como entrada)                                                                                                                  | Explorar dados / leitura                                 |
| 17  | Pedido de teste          | Depois que todos os dados estiverem no portal                                                                                                                      | Integração → parte 5                                     |

Depois de testadas as cargas, a Wellmix trunca as mesmas tabelas no portal e importa de novo, para ficar igual ao Sankhya.

### Carga completa dos cadastros

Aba Carga do Sankhya → **Carga completa** (`src/lib/integrations/sankhya-full-load.ts`, ação `sankhyaFullLoadAction`): condições de pagamento (TGFTPV, uma linha por CODTIPVENDA), fornecedores e clientes (TGFPAR com FORNECEDOR ou CLIENTE = S; quem é os dois vira dois cadastros com o mesmo `sankhyaCode`) e produtos (TGFPRO, com os grupos de cada lote virando linhas). Lê por faixas de código (`CODIGO > a AND CODIGO <= b`, vale no Oracle e no SQL Server), com a faixa ajustada para ~100–400 linhas por lote; cada clique trabalha ~40 s e guarda o cursor em `settings` (`sankhya.load.<entidade>`). O Sankhya é a fonte desses cadastros: os que já têm vínculo são atualizados (a especificação do produto só é preenchida se estiver vazia). "Recomeçar" volta o cursor ao início sem apagar nada.

## Pendências (decisões com a Wellmix)

1. Nomes das colunas do Incoterm e da moeda de origem do fornecedor no TGFCAB (provavelmente campos AD_).
2. Fase 2 feita (docs/PROCESSES.md): ligar a execução no Sankhya depois de conferir a simulação.
3. Fase 3 feita (seção abaixo): conferir os campos que o Sankhya exige ao incluir parceiro e produto (campos fixos) no primeiro uso.
4. Automatizações candidatas: importar/atualizar produtos, parceiros, estoque e preços do Sankhya (com `logAlteracoesTabelas`); criar no ERP o pedido de compra/venda quando o pedido nasce no portal; enviar a tabela de frete (AD_FREINT, hoje CSV) por `DatasetSP.save`; ler títulos financeiros (a receber/pagar, boletos) e NF-e emitidas para conciliar com o portal.

## Cadastros de teste para apagar no fim do teste do Sankhya

Anotados para apagar no portal **e** no Sankhya quando o teste de inclusão terminar:

- **Produto da solicitação ao fornecedor nº 1** (`supplier_requests.id` `4138bcd8-e113-417a-bdb4-4e51c1c6e1bf`, item "WD STRIBY VERT", código da fábrica/REFFORN `MY-059A`, booking nº 1). O produto é criado na tela `/app/supplier-requests/4138bcd8-e113-417a-bdb4-4e51c1c6e1bf?view=item` (11/11/2026). Para achar o id e o CODPROD: `select "productId" from supplier_requests where id = '4138bcd8-e113-417a-bdb4-4e51c1c6e1bf'` e `select id, name, sku, "sankhyaCode" from products where id = <productId>`. Apagar também: a ligação dos itens (`booking_items.productId`), `product_suppliers`, a ficha mestre (`purchase_sheets.orderId` = id do produto), a foto copiada e, na solicitação, `productId`/`productAction`/`productLinkedAt`; no Sankhya, o TGFPRO com esse CODPROD (ou REFFORN `MY-059A`).
