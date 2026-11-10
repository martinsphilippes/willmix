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
