# Ambiente

## Conexões

| Serviço  | Estado                   | Observações                                                                 |
| -------- | ------------------------ | --------------------------------------------------------------------------- |
| GitHub   | conectado                | `martinsphilippes/willmix`. CI em `.github/workflows/ci.yml`.               |
| Vercel   | conectado                | Projeto `willmix`, time `martinsphilippes`, região `gru1`. Deploy por push. |
| Appwrite | conectado e publicado    | Projeto `6ab41ae700396f0409b8` em `fra`; esquema e seed publicados          |
| Supabase | conectado, não utilizado | Decisão: um único backend (Appwrite).                                       |

## Modos de dados

- `DATA_MODE=memory` (padrão sem Appwrite): JSON em `.data/` (ou `/tmp/wellmix-data` na Vercel, efêmero). Seed automático no primeiro `/login`.
- `DATA_MODE=appwrite`: exige `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.

## Variáveis de ambiente

Fonte única: `.env.example`. As mesmas chaves em `.env.local`, na Vercel (Production e Preview) e no ambiente cloud do Claude Code. No ambiente cloud, use o formato `CHAVE=valor`, uma por linha, com os valores reais (não os textos de exemplo). Variáveis são lidas na inicialização: depois de alterar, abra nova sessão.

## Testes

```bash
npm test                                   # vitest
PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e   # Playwright (na sessão cloud; local não precisa da variável)
```

O E2E sobe o próprio servidor em `localhost:3100` com `DATA_DIR=.data-e2e`. Não deixe outro `next dev` rodando na mesma pasta.

## Limitações conhecidas da sessão cloud

- `api.vercel.com` bloqueado: o Vercel CLI não funciona; use o conector ou push no GitHub.
- Playwright instalado pelo npm procura outra versão do Chromium; use `PW_CHROMIUM=/opt/pw-browsers/chromium`.

## Nomenclatura

O nome oficial é **Wellmix** (empresa, portal e equipe). Ocorrências de `willmix` que permanecem por compatibilidade com recursos já provisionados:

| Onde                                   | Motivo                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_ID = "willmix"` (Appwrite)   | ID do banco já criado com dados; o nome exibido é "Wellmix". Renomear o ID exigiria recriar. |
| Repositório `martinsphilippes/willmix` | Nome no GitHub. Renomear é decisão do dono do repositório (GitHub redireciona o antigo).     |
| Projeto e domínio `willmix.vercel.app` | Nome do projeto na Vercel. Renomear muda a URL pública; fazer junto com o domínio final.     |

Dados de demonstração: `scripts/appwrite-rename-brand.ts` atualiza o nome do banco e as contas `@willmix.com` → `@wellmix.com` (senha `wellmix123`) sem recriar nada.
