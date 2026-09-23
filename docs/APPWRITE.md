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
npm run appwrite -- client --endpoint "$NEXT_PUBLIC_APPWRITE_ENDPOINT" \
  --project-id "$NEXT_PUBLIC_APPWRITE_PROJECT_ID" --key "$APPWRITE_API_KEY"
npm run appwrite -- pull settings        # gera appwrite.config.json válido
# editar appwrite.config.json com o esquema abaixo
npm run appwrite:push                    # push table && push bucket
npm run appwrite:generate                # wrapper TypeScript tipado em src/generated
```

`appwrite.config.json` é versionado (sem segredos). Nunca criar tabelas à mão no console: o próximo `push` não saberia delas.

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

## Esquema proposto (a confirmar com o negócio)

Banco `willmix`. Permissões de tabela mínimas; linhas recebem permissões explícitas no momento da escrita (servidor).

| Tabela          | Colunas principais                                                                   | Leitura                              |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| `marcas`        | nome, slug, ativa                                                                    | qualquer usuário autenticado         |
| `produtos`      | sku, nome, marcaId, linha, ean, embalagem, precoTabela, fotoFileId, ativo            | qualquer usuário autenticado         |
| `tabelas_preco` | nome, vigenciaInicio, vigenciaFim, itens (produtoId, preco)                          | comercial, representantes            |
| `clientes`      | razaoSocial, cnpj, enderecos, condicaoPagamento, representanteUserId, ativo          | comercial; representante só os seus  |
| `pedidos`       | numero, clienteId, representanteUserId, status, itens, total, observacoes, pdfFileId | comercial; representante só os seus  |
| `estoque`       | produtoId, disponivel, reservado, previsaoChegada                                    | comercial, representantes, logistica |
| `comissoes`     | pedidoId, representanteUserId, competencia, percentual, valor, status                | comercial; representante só as suas  |
| `auditoria`     | entidade, entidadeId, acao, usuarioId, antes, depois, criadoEm                       | admin                                |

Índices iniciais: `produtos.sku` (único), `clientes.cnpj` (único), `pedidos.numero` (único), `pedidos.status`, `pedidos.representanteUserId`, `comissoes.competencia`.

## Buckets

| Bucket ID  | Conteúdo                             | Limite | Permissão                         |
| ---------- | ------------------------------------ | ------ | --------------------------------- |
| `arquivos` | PDFs de pedido, comprovantes, anexos | 30 MB  | por arquivo, definida no servidor |
| `produtos` | Fotos de produto                     | 10 MB  | leitura para autenticados         |

Antivírus e criptografia ligados nos dois. Extensões: `pdf, png, jpg, jpeg, webp, xlsx, csv`.

## Realtime

Usar no browser apenas para listas vivas (pedidos em aprovação, estoque). Canal: `tablesdb.willmix.tables.<tabela>.rows`. O browser precisa de sessão própria para assinar canais; quando isso for necessário, expor `POST /api/auth/jwt` que devolve um JWT curto criado pelo cliente de sessão.

## Functions (adiar)

Candidatas: fechamento mensal de comissões (cron), notificação de pedido aprovado (evento em `pedidos`), geração de PDF do pedido.
