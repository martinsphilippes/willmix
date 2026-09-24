# Wellmix

Portal Operacional de Importações da Wellmix: solicitação do cliente, RFQ com fornecedores na China, seleção, sinal, pedido, checklists, inspeção, embarque, desembaraço, transporte e entrega, com Control Tower para a equipe. O Sankhya continua sendo o ERP.

Stack: **Next.js 16** (App Router, Server Actions, TypeScript, Tailwind 4) na **Vercel**, com **Appwrite** (Auth, TablesDB, Storage) em produção e um modo de dados em memória para desenvolvimento e testes.

## Começando

```bash
nvm use            # Node 22
npm ci
npm run dev        # http://localhost:3000 (modo memória, dados em .data/)
```

Na primeira abertura de `/login` o sistema cria os dados de demonstração. Senha de todas as contas: `wellmix123`.

| Conta                   | Papel              |
| ----------------------- | ------------------ |
| admin@wellmix.com       | Admin Wellmix      |
| operador@wellmix.com    | Operador Wellmix   |
| joao@lojista.com        | Cliente            |
| supplier.a@china.com    | Fornecedor (中文)  |
| supplier.b@china.com    | Fornecedor (EN)    |
| supplier.c@china.com    | Fornecedor (中文)  |
| agencia@design.com      | Agência            |
| despachante@comex.com   | Despachante        |
| armador@maritima.com    | Companhia marítima |
| transportadora@rodo.com | Transportador      |
| juridico@wellmix.com    | Jurídico           |

Para produção, preencha `.env.example` (Appwrite, `SESSION_SECRET`, `CRON_SECRET`) e publique o esquema: `npm run appwrite:connect && npm run appwrite:push`.

## Scripts

| Script                     | O que faz                                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`              | Servidor de desenvolvimento                                              |
| `npm run build`            | Build de produção (mesmo comando da Vercel)                              |
| `npm run lint`             | ESLint                                                                   |
| `npm run typecheck`        | Tipos de rota + TypeScript                                               |
| `npm test`                 | Testes unitários (workflow completo, permissões, dicionários)            |
| `npm run test:e2e`         | Playwright: solicitação → entrega no navegador (`PW_CHROMIUM=` opcional) |
| `npm run appwrite:connect` | Conecta o CLI ao projeto a partir das variáveis de ambiente              |
| `npm run appwrite:config`  | Regenera `appwrite.config.json` a partir de `src/lib/db/schema.ts`       |
| `npm run appwrite:push`    | Publica tabelas e bucket no Appwrite                                     |

## Estrutura

```
src/
  app/
    login                      login (contas de demonstração no modo memória)
    app/                       área autenticada (layout com navegação por papel)
      actions.ts               Server Actions (toda escrita, com zod e checagem de papel)
      requests, quotes, orders, tasks, notifications, account, penalties,
      parties, products, lines, import, settings
    api/auth/session           login e logout
    api/files/[id]             download de documentos com controle de acesso
    api/jobs/reminders         cron de lembretes
    api/admin/seed             dados de demonstração (produção exige CRON_SECRET)
  components/                  kit de UI, formulários, Control Tower
  i18n/                        dicionários pt, en, zh
  lib/
    db/                        schema.ts (fonte única), MemoryStore, AppwriteStore
    auth/                      sessão, senha, token, permissões por papel
    workflow/                  etapas, requisitos, engine de avanço
    services/                  solicitações, documentos, pendências, notificações,
                               auditoria, lembretes, importação, Control Tower
    integrations/              Sankhya (mock) e pagamento (manual)
scripts/                       conexão com o Appwrite e geração do config
tests/unit, tests/e2e          vitest e Playwright
docs/                          SCOPE, WORKFLOW, OPEN_DECISIONS, INTEGRATIONS, BACKLOG_FUTURO,
                               ARQUITETURA, APPWRITE, AMBIENTE
```

## Documentação

- [docs/SCOPE.md](docs/SCOPE.md): escopo, papéis, o que está entregue.
- [docs/WORKFLOW.md](docs/WORKFLOW.md): estados, etapas, requisitos e regras de avanço.
- [docs/OPEN_DECISIONS.md](docs/OPEN_DECISIONS.md): defaults provisórios e o que confirmar com o negócio.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): adaptadores, modos manual/mock e dependências externas pendentes.
- [docs/BACKLOG_FUTURO.md](docs/BACKLOG_FUTURO.md): próximos vertical slices.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md), [docs/APPWRITE.md](docs/APPWRITE.md), [docs/AMBIENTE.md](docs/AMBIENTE.md): decisões técnicas, esquema e ambiente.
