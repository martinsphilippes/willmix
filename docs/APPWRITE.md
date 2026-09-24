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

O push é feito por `scripts/appwrite-push.ts` com o SDK (TablesDB), idempotente: cria só o que falta e nunca apaga colunas. Motivo: o CLI 27 cria colunas pelas rotas antigas (`collections.*`), que a chave de API do console novo não cobre; as rotas de tabelas funcionam. `appwrite.config.json` continua gerado do `schema.ts` para referência e para `appwrite generate`.

Depois, crie os dados iniciais: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/admin/seed` (em desenvolvimento não exige o header). O seed cria os usuários no Appwrite Auth e as linhas correspondentes em `users`.

Estado: esquema publicado no projeto `6ab41ae700396f0409b8` (região `fra`) em 24/09/2026, com seed e fluxo E2E validados contra o banco real.

## Modelo de dados

Banco `wellmix`, 17 tabelas: `users`, `parties`, `product_lines`, `products`, `requests`, `quotes`, `orders`, `order_items`, `stages`, `requirements`, `documents`, `payments`, `notifications`, `audit_log`, `penalties`, `settings`, `counters`. Colunas e índices em `schema.ts`; campos JSON (`requirements` da linha, `before`/`after` da auditoria, `value` de settings) são texto serializado.

Bucket `arquivos` (30 MB, antivírus e criptografia, gzip). Metadados em `documents`; acesso sempre por `/api/files/[id]`.

## Permissões

Tabelas e bucket **sem permissões de usuário**: só a API key do servidor lê e escreve. A autorização é feita na aplicação (`src/lib/auth/permissions.ts`, `canSubmitRequirement`, `canAccessDocument`). Permissão de linha no Appwrite fica como segunda barreira no hardening.

## Autenticação

Modo `appwrite`: login cria sessão com a API key (`account.createEmailPasswordSession`), segredo no cookie `a_session_<projectId>` HttpOnly; `getCurrentUser` valida a sessão e busca papel e parceiro na tabela `users` pelo e-mail. Usuários novos são criados por Wellmix em `/app/parties/[id]` (Appwrite Auth + tabela).

Modo `memory` (dev/testes): senha com scrypt na tabela `users`, cookie `wm_session` assinado com `SESSION_SECRET`.

## Realtime e Functions

Não usados nesta fase. Candidatas futuras: realtime na Control Tower; Function cron para lembretes se sair da Vercel.
