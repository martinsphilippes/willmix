@AGENTS.md

# Wellmix

Portal Operacional de Importações. Next.js 16 na Vercel; Supabase em produção (desde 11/11/2026; o Appwrite ficou parado) e modo memória para desenvolver e testar. Leia antes de codificar:

- `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/OPEN_DECISIONS.md`: o que o sistema faz e as regras.
- `docs/ARQUITETURA.md`: decisões, módulos e convenções.
- `docs/APPWRITE.md` e `docs/AMBIENTE.md`: esquema, permissões, variáveis e limitações da sessão cloud.
- `docs/SUPABASE.md`: troca do Appwrite pelo Supabase (etapas, esquema gerado, publicação).
- `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/SUPERPLAN.md`, `docs/ORDER_SIGNATURE.md` e `docs/PURCHASE_ORDER.md`: do Booking ao pedido (bookings por planilha, seleção de itens e solicitação ao fornecedor, análise, negociação, documento com as duas assinaturas). A RFQ e a cotação saíram em 11/11/2026 (`docs/QUOTE_FLOW.md`).
- `docs/PWA.md`: aplicativo instalável (manifesto, service worker, tela sem conexão) e responsividade.
- `docs/INTEGRATIONS.md`: adaptadores mock/manual e dependências externas pendentes; `docs/SANKHYA.md` para o ERP.
- Skills `.claude/skills/appwrite-cli` e `.claude/skills/appwrite-typescript` antes de rodar o CLI ou escrever código com o SDK.

Regras fixas: toda escrita passa por Server Action em `src/app/app/actions.ts` ou `src/app/app/actions/*.ts` (helpers em `actions/helpers.ts`) com zod e checagem de papel; textos novos em `src/i18n/modules/*.ts` (pt/en/zh, mesmas chaves); evolução aditiva conforme `docs/EVOLUTION_PLAN.md` (não remover telas, rotas, campos ou dados); leitura só no servidor; esquema em `src/lib/db/schema.ts` e `appwrite.config.json` gerado por `npm run appwrite:config`; use `TablesDB` (não `Databases`) e parâmetros por objeto no SDK. Antes de commitar: `npm run lint && npm run typecheck && npm test`. O E2E (`npm run test:e2e`) é o teste do caminho principal; mantenha-o passando.

Velocidade: prefira a solução simples que funciona hoje; integrações sem credencial ganham modo manual/mock, nunca dados falsos apresentados como reais.

## Entrega sem perguntar (autorização do dono)

Ao terminar uma tarefa, sem pedir confirmação:

1. Rodar `npm run lint && npm run typecheck && npm test` e o E2E (`npm run test:e2e`).
2. Abrir o PR para `wellmix`.
3. Esperar o CI (`verify`) ficar verde e mesclar o PR.
4. Se o PR mexeu em `src/lib/db/schema.ts`, publicar o esquema no **Supabase** (banco de produção desde 11/11/2026, projeto `rokbtrvkzllowyqzcauq`) logo depois do merge: migração só aditiva com o que falta do `supabase/schema.sql` (`scripts/supabase-missing.ts`, docs/SUPABASE.md "Publicar o esquema"), aplicada pela ferramenta do Supabase, e conferir as colunas por tabela. Se falhar, avisar o dono com o erro. O Appwrite não recebe mais o esquema.

Exceções (parar e avisar o dono em vez de mesclar):

- CI ou E2E falhando.
- Conflito com a base ou outro PR aberto mexendo na mesma tela ou regra.
- Decisão de negócio tomada sem confirmação do dono.
- Mudança que apaga ou altera dados, telas, rotas ou campos existentes.
