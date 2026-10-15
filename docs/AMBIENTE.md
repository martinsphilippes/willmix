# Ambiente

## Conexões

| Serviço  | Estado                   | Observações                                                                 |
| -------- | ------------------------ | --------------------------------------------------------------------------- |
| GitHub   | conectado                | `martinsphilippes/willmix`. CI em `.github/workflows/ci.yml`.               |
| Vercel   | conectado                | Projeto `wellmix`, time `martinsphilippes`, região `fra1` (Frankfurt, a mesma do Appwrite). Deploy por push. |
| Appwrite | conectado e publicado    | Projeto `6ab41ae700396f0409b8` em `fra`; esquema e seed publicados          |
| Supabase | conectado, não utilizado | Decisão: um único backend (Appwrite).                                       |

## Modos de dados

- `DATA_MODE=memory` (padrão sem Appwrite): JSON em `.data/` (ou `/tmp/wellmix-data` na Vercel, efêmero). Seed automático no primeiro `/login`.
- `DATA_MODE=appwrite`: exige `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.
- IA: na Vercel usa o AI Gateway com o token OIDC do projeto, sem chave. Opcionais: `AI_GATEWAY_API_KEY` ou `ANTHROPIC_API_KEY` (prioridade). Fora da Vercel e sem chave, modo manual. Configurações → Testar IA confirma.

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

| Onde                                   | Motivo                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_ID = "willmix"` (Appwrite)   | ID do banco já criado com dados; o nome exibido é "Wellmix". Renomear o ID exigiria recriar.                                                                                           |
| Repositório `martinsphilippes/willmix` | Nome no GitHub. Renomear é decisão do dono do repositório (GitHub redireciona o antigo).                                                                                               |
| Domínio `willmix.vercel.app`           | Endereço antigo: redireciona (308) para `portal-wellmix.vercel.app`, o endereço principal (`next.config.ts`). `wellmix.vercel.app` pertence a outra conta. Branch de produção na Vercel deve ser `wellmix`. |

Dados de demonstração: `scripts/appwrite-rename-brand.ts` atualiza o nome do banco e as contas `@willmix.com` → `@wellmix.com` (senha `wellmix123`) sem recriar nada.

## Appwrite pausado por inatividade

No plano gratuito (Free), o Appwrite pausa o projeto depois de 7 dias seguidos sem atividade de desenvolvimento no console. O uso do portal não conta: o cron diário de lembretes consulta o banco todos os dias pela chave de API, e o projeto foi pausado mesmo assim (out/2026). Enquanto pausado, nenhum login funciona e nenhuma tela carrega dados. Os dados não somem na pausa, mas o Appwrite apaga projetos gratuitos que ficam pausados por 90 dias (avisa o dono por e-mail antes).

- Sinal: `/api/health` mostra `"database": "appwrite_paused"`; a tela de login diz que o banco foi pausado e como reativar (código `paused` na resposta de `/api/auth/session`). Outras falhas do banco seguem com "tente de novo em alguns minutos".
- Correção: com a conta dona do projeto, abrir o console do Appwrite (cloud.appwrite.io), entrar no projeto e clicar em Restore. Volta em poucos minutos, sem perda de dados. Se o login continuar com o aviso depois de uns 10 minutos, abrir chamado no suporte do Appwrite.
- Prevenção: plano Pro (US$ 25/mês por projeto) não pausa. No Free, abrir o projeto no console pelo menos uma vez por semana. Rotina automática com a chave de API não serve (ver acima); automatizar login no console exigiria guardar a senha do dono, que dá acesso a tudo, e não é recomendado.

## Desempenho

- O servidor roda em `fra1`, ao lado do Appwrite (`fra`). Com o servidor em São Paulo, cada consulta cruzava o Atlântico (cerca de 200 ms) e uma página com 20 consultas levava segundos. O usuário no Brasil paga uma viagem por página; as consultas ficam locais.
- Leituras repetidas na mesma requisição saem uma vez só (`src/lib/db/cached-store.ts`; qualquer escrita limpa). `DB_TRACE=1` registra cada consulta com o tempo; `DB_CACHE=0` desliga a memorização.
- Sessão conferida fica 60 s em memória por instância (hash do segredo), sem 2 idas ao Appwrite por página e por foto; logout apaga na hora.
- Fotos e arquivos (`/api/files`) ficam 1 h no navegador (`private`); versão nova é documento novo.
- Páginas pesadas buscam em lote e em paralelo (pendências, pedido, início do cliente, Control Tower). Filtro com mais de 100 valores vira consultas paralelas (limite do Appwrite).
- Barra de progresso no topo na hora do clique em qualquer link (`navigation-progress.tsx`); sem `loading.tsx`, para as páginas manterem o 404 do isolamento.
- Medição local contra o banco real: build com `set -a && . ./.env.local && set +a` (a sessão cloud tem `NEXT_PUBLIC_APPWRITE_PROJECT_ID` de exemplo no ambiente, que o build gravaria).
