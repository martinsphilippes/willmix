# Appwrite

## Projeto

| Item        | Valor                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Console     | https://cloud.appwrite.io                                             |
| Endpoint    | regional, ex.: `https://fra.cloud.appwrite.io/v1` (ver console)       |
| Project ID  | `NEXT_PUBLIC_APPWRITE_PROJECT_ID`                                     |
| Plataformas | Web: `localhost`, `willmix.vercel.app` e o domínio final              |
| Auth        | E-mail e senha habilitado; OAuth (Google/Microsoft) quando necessário |

## Primeiro uso (nova sessão, com rede e chave liberadas)

```bash
npm run appwrite:connect   # appwrite client + grava projectId/endpoint em appwrite.config.json
npm run appwrite:push      # push team, table e bucket (--all --force)
npm run appwrite:generate  # wrapper TypeScript tipado em src/generated
```

`appwrite.config.json` é versionado (sem segredos) e já contém o esquema abaixo. Nunca criar tabelas à mão no console: o próximo `push` não saberia delas. Para trazer mudanças feitas no console, `npm run appwrite:pull` e revise o diff.

## Modelo de autenticação

- Login no servidor (`/api/auth/session`): cliente admin cria a sessão, segredo vai para cookie `a_session_<projectId>` HttpOnly, `SameSite=Strict`.
- Cada requisição autenticada recria um cliente com `setSession(secret)`. Permissões de linha valem para o usuário.
- Escritas de negócio usam o cliente admin **depois** de validar papel e regras. O cliente admin nunca é exposto a rotas sem checagem.

## Papéis

Teams do Appwrite, com IDs estáveis:

| Team ID          | Quem                     | Uso                                      |
| ---------------- | ------------------------ | ---------------------------------------- |
| `admin`          | Diretoria e TI           | Tudo                                     |
| `comercial`      | Equipe interna de vendas | Aprova pedidos, edita catálogo, clientes |
| `representantes` | Representantes externos  | Cria pedidos dos próprios clientes       |
| `logistica`      | Estoque e expedição      | Estoque, status de entrega               |

Lojistas (clientes) autenticam como usuários sem team; o vínculo com o representante vem da tabela `clientes`.

## Esquema (versão 1, em `appwrite.config.json`)

Banco `willmix`. Permissões de tabela dão leitura por papel; escrita só pelo servidor (cliente admin). Tabelas com `rowSecurity` recebem permissões por linha no momento da escrita (ex.: `read(user:<representante>)` em `clientes`, `pedidos` e `comissoes`).

| Tabela                | Colunas                                                                                                                | Leitura (tabela)                            | Linha |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----- |
| `marcas`              | nome, slug, ativa                                                                                                      | `users`                                     | não   |
| `produtos`            | sku, nome, marcaId, linha, ean, embalagem, precoTabela, fotoFileId, ativo                                              | `users`                                     | não   |
| `tabelas_preco`       | nome, vigenciaInicio, vigenciaFim, ativa                                                                               | admin, comercial, representantes            | não   |
| `tabelas_preco_itens` | tabelaPrecoId, produtoId, preco                                                                                        | admin, comercial, representantes            | não   |
| `clientes`            | razaoSocial, nomeFantasia, cnpj, email, telefone, enderecos (JSON), condicaoPagamento, representanteUserId, ativo      | admin, comercial                            | sim   |
| `pedidos`             | numero, clienteId, representanteUserId, tabelaPrecoId, status, condicaoPagamento, total, observacoes, pdfFileId, datas | admin, comercial, logistica                 | sim   |
| `pedidos_itens`       | pedidoId, produtoId, sku, descricao, quantidade, precoUnitario, subtotal                                               | admin, comercial, logistica                 | sim   |
| `estoque`             | produtoId, disponivel, reservado, previsaoChegada                                                                      | admin, comercial, representantes, logistica | não   |
| `comissoes`           | pedidoId, representanteUserId, competencia (AAAA-MM), percentual, valor, status                                        | admin, comercial                            | sim   |
| `auditoria`           | entidade, entidadeId, acao, usuarioId, antes (JSON), depois (JSON)                                                     | admin                                       | não   |

Status: `pedidos.status` em `rascunho, enviado, aprovado, faturado, entregue, cancelado`; `comissoes.status` em `prevista, aprovada, paga, cancelada`.

Índices: únicos em `marcas.slug`, `produtos.sku`, `clientes.cnpj`, `pedidos.numero`, `estoque.produtoId`, `tabelas_preco_itens(tabelaPrecoId, produtoId)` e `pedidos_itens(pedidoId, produtoId)`; chaves em `produtos.marcaId`, `pedidos.status`, `pedidos.representanteUserId`, `pedidos.clienteId`, `clientes.representanteUserId`, `comissoes.competencia`, `comissoes(representanteUserId, competencia)`, `auditoria(entidade, entidadeId)`.

Decisões de modelagem:

- **Itens em tabelas próprias** (`pedidos_itens`, `tabelas_preco_itens`) em vez de JSON dentro do pedido: permite consultar "quanto vendeu do SKU X", "preço do produto Y na tabela Z" e agregar por produto sem carregar o pedido inteiro. O pedido guarda `total` desnormalizado, calculado no servidor.
- **`pedidos_itens` copia `sku`, `descricao` e `precoUnitario`**: o pedido registra o que foi vendido no momento; mudanças posteriores no catálogo não alteram pedidos antigos.
- **Referências por ID em `varchar(36)`**, não relationships do Appwrite: consultas mais simples e previsíveis, sem carregamento aninhado nem permissões cruzadas. Integridade referencial é garantida no servidor (zod + validação antes da escrita).
- **`enderecos` como JSON em coluna `text`**: raramente filtrado; validado por zod no servidor. Vira tabela própria se surgir necessidade de consulta por cidade/UF.
- **`criadoEm` e `atualizadoEm` não existem como colunas**: usar `$createdAt` e `$updatedAt` do Appwrite.
- **`estoque` tem uma linha por produto** (`produtoId` único); reservas são atualizadas pelo servidor na aprovação do pedido.

## Buckets

| Bucket ID  | Conteúdo                             | Limite | Permissão                                                |
| ---------- | ------------------------------------ | ------ | -------------------------------------------------------- |
| `arquivos` | PDFs de pedido, comprovantes, anexos | 30 MB  | `fileSecurity` ligado, por arquivo, definida no servidor |
| `produtos` | Fotos de produto                     | 10 MB  | leitura para `users`                                     |

Antivírus e criptografia ligados nos dois. `arquivos` aceita `pdf, png, jpg, jpeg, webp, xlsx, csv` com compressão gzip; `produtos` aceita só imagens (`png, jpg, jpeg, webp`), sem compressão.

## Realtime

Usar no browser apenas para listas vivas (pedidos em aprovação, estoque). Canal: `tablesdb.willmix.tables.<tabela>.rows`. O browser precisa de sessão própria para assinar canais; quando isso for necessário, expor `POST /api/auth/jwt` que devolve um JWT curto criado pelo cliente de sessão.

## Functions (adiar)

Candidatas: fechamento mensal de comissões (cron), notificação de pedido aprovado (evento em `pedidos`), geração de PDF do pedido.
