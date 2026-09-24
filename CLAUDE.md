@AGENTS.md

# Wellmix

Portal Operacional de Importações. Next.js 16 na Vercel; Appwrite em produção e modo memória para desenvolver e testar. Leia antes de codificar:

- `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/OPEN_DECISIONS.md`: o que o sistema faz e as regras.
- `docs/ARQUITETURA.md`: decisões, módulos e convenções.
- `docs/APPWRITE.md` e `docs/AMBIENTE.md`: esquema, permissões, variáveis e limitações da sessão cloud.
- `docs/INTEGRATIONS.md`: adaptadores mock/manual e dependências externas pendentes.
- Skills `.claude/skills/appwrite-cli` e `.claude/skills/appwrite-typescript` antes de rodar o CLI ou escrever código com o SDK.

Regras fixas: toda escrita passa por Server Action em `src/app/app/actions.ts` com zod e checagem de papel; leitura só no servidor; esquema em `src/lib/db/schema.ts` e `appwrite.config.json` gerado por `npm run appwrite:config`; use `TablesDB` (não `Databases`) e parâmetros por objeto no SDK. Antes de commitar: `npm run lint && npm run typecheck && npm test`. O E2E (`npm run test:e2e`) é o teste do caminho principal; mantenha-o passando.

Velocidade: prefira a solução simples que funciona hoje; integrações sem credencial ganham modo manual/mock, nunca dados falsos apresentados como reais.
