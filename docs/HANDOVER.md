# Passagem do projeto (handover)

Guia para quem assume o desenvolvimento do Portal Wellmix. Objetivo: em um dia a pessoa consegue rodar o portal localmente, abrir um PR, publicar e saber o que está pendente. Nada aqui é segredo: chaves e senhas ficam só nos cofres de cada serviço (Vercel, GitHub Secrets, Appwrite) e nunca em chat, e-mail ou WhatsApp.

Atualizado em 24/10/2026.

## 1. O que é

Portal Operacional de Importações da Wellmix: do pedido de orçamento do cliente (vitrine ou formulário) à entrega, passando por RFQ aos fornecedores na China, cotação com ficha de compra, proposta e sinal, pedido com etapas e requisitos (preparação, arte e embalagem, inspeção, embarque, desembaraço, transporte, entrega), parceiros (agência, despachante, companhia marítima, transportador, jurídico), pendências por papel, notificações, financeiro e contas a pagar. O ERP continua sendo o Sankhya (integração em modo mock/manual). Leia `docs/SCOPE.md` e `docs/WORKFLOW.md` para o fluxo e as regras.

## 2. Onde roda

| Peça                      | Onde                                                                   | Observação                                                                                      |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Código                    | GitHub, repositório `willmix`, branch principal `wellmix`              | Toda mudança entra por PR com o CI verde e squash merge.                                        |
| Portal (produção)         | Vercel, projeto `wellmix` (região `fra1`), `portal-wellmix.vercel.app` | Deploy automático a cada merge em `wellmix`; prévia por PR. Variáveis de ambiente ficam lá.     |
| Banco e arquivos          | Appwrite Cloud, projeto `6ab41ae700396f0409b8` (região `fra`)          | Banco `willmix` (TablesDB), bucket `arquivos`, Auth por e-mail e senha. Ver `docs/APPWRITE.md`. |
| Rotinas                   | Vercel Cron (`vercel.json`)                                            | Lembretes diários (`/api/jobs/reminders`) e tabela fiscal mensal (`/api/jobs/fiscal`).          |
| IA                        | Vercel AI Gateway (token OIDC do projeto) ou `ANTHROPIC_API_KEY`       | Sem credencial o portal fica em modo manual. Busca por foto/link aguarda cartão no AI Gateway.  |
| E-mail, WhatsApp, Sankhya | Mock/manual                                                            | Ver `docs/INTEGRATIONS.md`; nada é inventado como real.                                         |

## 3. Acessos a conceder (checklist)

Tudo nominal, com 2FA e o menor papel que resolve. Quem sai perde o acesso e as chaves são giradas.

- [ ] **GitHub**: organização dona do repositório (ou o repositório pessoal) → convite como membro com permissão **Write**. Admin só o dono. Proteção do branch `wellmix` (PR obrigatório e CI). Para usar o Claude Code no repositório: o app GitHub do Claude instalado na organização/repositório.
- [ ] **Vercel**: convite para o time do projeto `wellmix` (Member). Dá deploys, logs, variáveis de ambiente e crons.
- [ ] **Appwrite Cloud**: convite para a organização/projeto (Developer). Dá banco, bucket, Auth e chaves de API.
- [ ] **Portal**: um usuário **admin próprio** criado em Cadastros → Usuários (nunca compartilhar login).
- [ ] **Anthropic Console** (se as funções de IA forem usadas): convite para a organização, em vez de passar a chave.
- [ ] **Claude Code**: a própria conta Claude com o GitHub conectado. O contexto do projeto (`CLAUDE.md`, `docs/`, skills em `.claude/skills`) está no repositório e vale para qualquer sessão.
- [ ] **Domínio final** (quando houver): acesso ao registrador/DNS.

## 4. Como desenvolver

```bash
git clone <repositório> && cd willmix
npm install
DATA_MODE=memory npm run dev        # modo memória: sem Appwrite; seed automático no primeiro /login
```

Logins de demonstração (modo memória, senha `wellmix123`): `admin@wellmix.com`, `operador@wellmix.com`, `joao@lojista.com` (cliente), `supplier.a@china.com` (fornecedor), `agencia@design.com` (agência), entre outros em `src/lib/seed.ts`. Em produção, cada pessoa tem o próprio usuário.

Antes de abrir um PR:

```bash
npm run lint && npm run typecheck && npm test   # obrigatório
npm run test:e2e                                 # caminho principal (sobe o dev server em modo memória)
```

Regras fixas (detalhe em `CLAUDE.md`): toda escrita passa por Server Action com zod e checagem de papel; textos novos em `src/i18n/modules/*.ts` (pt/en/zh, mesmas chaves); evolução aditiva (nada é removido: telas, rotas, campos, dados); leitura só no servidor; esquema em `src/lib/db/schema.ts`; `TablesDB` (não `Databases`) no SDK do Appwrite; isolamento entre clientes, entre fornecedores e nos documentos nunca é enfraquecido.

Fluxo: branch → PR para `wellmix` → CI verde → squash merge → deploy automático.

## 5. Como publicar

1. **Portal**: merge em `wellmix` faz o deploy na Vercel. Variáveis necessárias (nomes; valores só na Vercel): `DATA_MODE=appwrite`, `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `CRON_SECRET`; opcionais `ANTHROPIC_API_KEY`/`AI_GATEWAY_API_KEY`. Lista completa em `docs/AMBIENTE.md`.
2. **Telas por função** (docs/ACCESS.md): depois de publicar, cada operador vê só o básico até o administrador marcar as funções dele em Gestão → Equipe e divisões (uma vez por login). Financeiro é só do administrador.
3. **Esquema do banco**: sempre que um PR acrescentar tabela ou coluna em `schema.ts`, rode uma vez GitHub → Actions → **"Publicar esquema Appwrite"** → Run workflow (só adiciona, nunca apaga). A chave fica em Settings → Secrets (`APPWRITE_API_KEY`). Até rodar, as telas que dependem da novidade ficam vazias e o resto segue (o código trata o esquema desatualizado).
4. **Arquivos grandes** (fotos, planilhas, arte): sobem direto do navegador ao Appwrite. Para isso o domínio do portal precisa estar cadastrado no Appwrite em Settings → Platforms (Web), senão o navegador bloqueia por CORS.
5. **Dados iniciais** num banco novo: `POST /api/admin/seed` com `Authorization: Bearer <CRON_SECRET>`. Com o banco já populado, a mesma chamada só cria as contas de demonstração que faltam (resposta `added`).
6. **Contas de demonstração novas** (um papel novo, como Comex, agente de carga ou OCP): com `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=1`, o admin cria em Configurações → **Contas de demonstração** → "Criar as contas que faltam" (depois de publicar o esquema, se o papel for novo). O seletor "Demo" e a tela de login só listam contas que existem no banco.

## 6. Documentos para ler (nesta ordem)

`CLAUDE.md` → `docs/SCOPE.md` → `docs/WORKFLOW.md` → `docs/ARQUITETURA.md` → `docs/APPWRITE.md` e `docs/AMBIENTE.md` → `docs/INTEGRATIONS.md` → `docs/OPEN_DECISIONS.md` (parâmetros em Configurações) → `docs/EVOLUTION_PLAN.md` (o que já entrou e as decisões técnicas) → `docs/BACKLOG_FUTURO.md`.

## 7. Estado em 24/10/2026 e pendências

Entregues recentemente: notificações por tipo e responsável (#117), cadastro de produtos pela planilha da ficha técnica (#118), briefing de embalagem aberto junto com a RFQ para a agência (#119), pedido mínimo na nova solicitação (#120).

Pendências operacionais:

- Rodar **"Publicar esquema Appwrite"** depois do deploy dos PRs #117 a #119 (colunas `kind`/`actor` em `notifications`, tabela `packaging_briefs`, coluna `documents.packagingBriefId`) e do PR da foto do fornecedor (valor `supplier` no tipo de foto de `product_photos`).
- Conferir o domínio do portal em **Overview → Apps** do Appwrite (o console antigo chamava de Platforms; `willmix.vercel.app` e `portal-wellmix.vercel.app` já estão lá): é o que libera o envio direto de arquivos grandes pelo navegador.
- Cartão de crédito no AI Gateway da Vercel para reativar a busca de produto por foto/link (`lookupPaused` em Configurações).
- Condição de pagamento cadastrada em cada fornecedor (Contas a pagar só gera parcelas com ela).

Importação da ficha técnica em `.xls` (leitor próprio, `src/lib/services/xls.ts`) e pelo link de uma planilha do Google Sheets (`src/lib/services/google-sheet.ts`): entregues no PR #122.

Integrações pendentes de credencial (modo manual/mock até lá): e-mail, WhatsApp, Sankhya. Ver `docs/INTEGRATIONS.md`.

## 8. Segurança e rotina

- 2FA em GitHub, Vercel e Appwrite; convites nominais; nenhum login compartilhado.
- Segredos só nos cofres (Vercel → Environment Variables; GitHub → Secrets; Appwrite → API keys). Nunca em commit, chat, e-mail ou WhatsApp. Se um segredo vazar ou alguém sair: gire a chave no Appwrite e atualize na Vercel e no GitHub.
- Backups: o Appwrite Cloud mantém backups do banco conforme o plano; arquivos ficam no bucket. Antes de scripts de manutenção (`npm run appwrite:*`), confira o que fazem em `scripts/`.
- Revisão: todo PR passa por CI (lint, tipos, testes) e, quando feito com o Claude Code, por uma revisão independente de segurança, fluxo, dados e UX antes do merge.
