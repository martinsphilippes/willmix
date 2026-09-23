# Willmix

Plataforma de gestão comercial para a Wellmix (importadora e distribuidora B2B de utilidades domésticas e brinquedos).

Stack: **Next.js 16** (App Router, TypeScript, Tailwind 4) hospedado na **Vercel**, com **Appwrite** (Auth, TablesDB, Storage, Functions, Realtime) como backend gerenciado.

## Começando

```bash
nvm use            # Node 22
npm ci
cp .env.example .env.local   # preencha endpoint, project id e API key do Appwrite
npm run dev        # http://localhost:3000
```

Diagnóstico das integrações: `GET /api/health`.

## Scripts

| Script                     | O que faz                                                   |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Servidor de desenvolvimento                                 |
| `npm run build`            | Build de produção (mesmo comando usado na Vercel)           |
| `npm run lint`             | ESLint                                                      |
| `npm run typecheck`        | Gera tipos de rota e verifica TypeScript                    |
| `npm run format`           | Prettier                                                    |
| `npm run appwrite -- …`    | Appwrite CLI (`login`, `init`, `pull`, `push`)              |
| `npm run appwrite:connect` | Conecta o CLI ao projeto a partir das variáveis de ambiente |
| `npm run appwrite:push`    | Publica teams, tabelas e buckets de `appwrite.config.json`  |
| `npm run appwrite:pull`    | Traz teams, tabelas e buckets do servidor para o config     |

## Estrutura

```
src/
  app/                   rotas (App Router)
    api/health           diagnóstico do ambiente
    api/auth/session     login (POST) e logout (DELETE)
    login                tela de login
    app                  área autenticada
  components/            componentes de interface
  lib/
    env.ts               validação das variáveis de ambiente (zod)
    appwrite/server.ts   clientes admin (API key) e de sessão (cookie)
    appwrite/client.ts   SDK Web (realtime, uploads)
    auth/session.ts      login, logout e usuário atual
  proxy.ts               checagem otimista de sessão em /app/*
scripts/                 automações de desenvolvimento (conexão com o Appwrite)
docs/                    arquitetura, ambiente, Appwrite e decisões
appwrite.config.json     esquema do Appwrite (teams, tabelas, buckets), publicado via CLI
```

## Documentação

- [docs/AMBIENTE.md](docs/AMBIENTE.md): conexões, variáveis e passos de configuração.
- [docs/APPWRITE.md](docs/APPWRITE.md): projeto Appwrite, permissões, tabelas e buckets.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): entendimento do negócio, decisões técnicas e módulos propostos.
