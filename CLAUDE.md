@AGENTS.md

# Willmix

Next.js 16 na Vercel com Appwrite como backend. Leia antes de codificar:

- `docs/ARQUITETURA.md`: decisões, módulos e convenções.
- `docs/APPWRITE.md`: projeto, permissões, tabelas e buckets.
- `docs/AMBIENTE.md`: conexões, variáveis e limitações da sessão cloud.
- Skills `.claude/skills/appwrite-cli` e `.claude/skills/appwrite-typescript` (oficiais do Appwrite): use antes de rodar o CLI ou escrever código com o SDK.

Regras fixas: toda escrita de negócio passa pelo servidor com validação zod; use `TablesDB` (não `Databases`); estilo de parâmetros por objeto no SDK; esquema versionado em `appwrite.config.json` e publicado via CLI, nunca criado à mão no console.
