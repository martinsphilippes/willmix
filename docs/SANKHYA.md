# Sankhya (ERP)

Integração com o Sankhya Om pela **API Gateway oficial** (https://developer.sankhya.com.br). Código: `src/lib/integrations/sankhya-client.ts` (cliente), `src/lib/integrations/sankhya-dictionary.ts` (dicionário de dados), `src/app/app/actions/sankhya.ts` (escritas) e a tela **Configurações → Sankhya** (`/app/settings/sankhya`, só o administrador).

## Credenciais (3 + 1 opcional)

| Variável                | De onde vem                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `SANKHYA_CLIENT_ID`     | Área do Desenvolvedor da Sankhya (a aplicação criada lá)                                |
| `SANKHYA_CLIENT_SECRET` | Área do Desenvolvedor da Sankhya                                                        |
| `SANKHYA_X_TOKEN`       | No Sankhya Om da empresa: tela **Configurações Gateway** (token da integração)          |
| `SANKHYA_BASE_URL`      | Opcional. `https://api.sankhya.com.br` (padrão) ou `https://api.sandbox.sankhya.com.br` |

Cadastrar na Vercel (Production e Preview) e publicar de novo. O cliente só aceita os dois endereços oficiais (o segredo não vai para outro host). As permissões no ERP são as do usuário vinculado ao token do gateway: o que ele não pode ver ou gravar no Sankhya, a API também recusa.

## Teste por curl

```bash
export SANKHYA_CLIENT_ID=...
export SANKHYA_CLIENT_SECRET=...
export SANKHYA_X_TOKEN=...
bash scripts/sankhya-curl.sh
```

Autentica, lê 5 empresas (loadRecords), produtos (REST) e busca tabelas no dicionário (SQL). Mostra a resposta de cada passo; credencial errada para no passo 1 com o texto do Sankhya (`invalid_client`).

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

## Tela Configurações → Sankhya

Teste de conexão, busca no dicionário (tabela → entidades, campos e ligações, com link para a tabela ligada), consulta de entidade com ligações e paginação, SQL somente leitura, e as escritas: registro (DatasetSP.save), pedido/orçamento/cotação (CACSP) e cancelamento. Leituras rodam no servidor por GET; escritas são Server Actions do admin, com zod e registro na auditoria (`sankhya.*`). Erros mostram o código e o texto do Sankhya.

## Pendências (decisões com a Wellmix)

1. Códigos do ERP para os pedidos do portal: empresa (`CODEMP`), TOP de pedido e de cotação (`CODTIPOPER`), tipo de negociação (`CODTIPVENDA`), vendedor, local e volume padrão. Com eles, `getSankhyaAdapter().createOrder` (hoje `MockSankhyaAdapter`, número manual) passa a enviar o pedido.
2. Ligação cadastro do portal ↔ Sankhya: `CODPARC` de cada cliente/fornecedor e `CODPROD` de cada produto (casar por CNPJ e SKU/referência e guardar o código).
3. Automatizações candidatas: importar/atualizar produtos, parceiros, estoque e preços do Sankhya (com `logAlteracoesTabelas`); criar no ERP o pedido de compra/venda quando o pedido nasce no portal; enviar a tabela de frete (AD_FREINT, hoje CSV) por `DatasetSP.save`; ler títulos financeiros (a receber/pagar, boletos) e NF-e emitidas para conciliar com o portal.
