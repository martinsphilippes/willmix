# Willmix

Plataforma de gestão comercial para a Wellmix (importadora e distribuidora B2B de utilidades domésticas e brinquedos).

Stack: **Next.js 16** (App Router, TypeScript, Tailwind 4) hospedado na **Vercel**, com **Firebase** (Auth, Firestore, Storage, Analytics) como backend gerenciado.

## Começando

```bash
nvm use            # Node 22
npm ci
cp .env.example .env.local   # preencha as chaves do Firebase
npm run dev        # http://localhost:3000
```

Diagnóstico das integrações: `GET /api/health`.

## Scripts

| Script                          | O que faz                                          |
| ------------------------------- | -------------------------------------------------- |
| `npm run dev`                   | Servidor de desenvolvimento                        |
| `npm run build`                 | Build de produção (mesmo comando usado na Vercel)  |
| `npm run lint`                  | ESLint                                             |
| `npm run typecheck`             | Verificação de tipos                               |
| `npm run format`                | Prettier                                           |
| `npm run emulators`             | Emuladores Firebase (Auth, Firestore, Storage, UI) |
| `npm run firebase:deploy:rules` | Publica regras e índices do Firestore/Storage      |

## Estrutura

```
src/
  app/                 rotas (App Router)
    api/health         diagnóstico do ambiente
    api/auth/session   troca idToken -> cookie de sessão / logout
    login              tela de login (placeholder)
    app                área autenticada
  lib/
    env.ts             validação das variáveis de ambiente (zod)
    firebase/client.ts SDK Web (browser)
    firebase/admin.ts  Admin SDK (servidor)
    auth/session.ts    cookie de sessão HttpOnly
  proxy.ts             checagem otimista de sessão em /app/*
firebase.json          emuladores e caminhos de regras
firestore.rules        regras Firestore (negar tudo por padrão)
storage.rules          regras Storage (negar tudo por padrão)
docs/                  arquitetura, ambiente e decisões
```

## Documentação

- [docs/AMBIENTE.md](docs/AMBIENTE.md): conexões, variáveis e passos de configuração.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): entendimento do negócio, decisões técnicas e módulos propostos.
