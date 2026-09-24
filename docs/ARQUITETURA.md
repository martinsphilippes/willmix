# Arquitetura

## 1. Problema

A Wellmix importa utilidades domésticas, brinquedos, infláveis e decoração de fornecedores na China e vende B2B. Hoje o processo roda em Excel e e-mail: o fornecedor recebe planilha, preenche, devolve; um funcionário confere, relança e cobra o próximo responsável. A Wellmix vira a cobradora do processo.

## 2. Objetivo

Cada agente recebe um aviso, abre um link, vê a própria pendência, preenche, salva. A etapa completa, o portal avança e o próximo responsável é avisado. A Wellmix acompanha tudo pela Control Tower. O Sankhya continua sendo o ERP: o portal cuida do fluxo, não do faturamento.

## 3. Decisões técnicas

| Decisão                | Escolha                                            | Motivo                                                                                            |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Front e API            | Next.js 16 App Router, Server Components e Actions | Um só deploy na Vercel (`gru1`); toda escrita passa pelo servidor com zod e checagem de papel     |
| Backend gerenciado     | Appwrite Cloud (Auth, TablesDB, Storage)           | Auth, banco e arquivos em um serviço, com console simples                                         |
| Camada de dados        | `Store` com MemoryStore e AppwriteStore            | Desenvolver e testar sem credenciais; produção no Appwrite. Esquema único em `schema.ts`          |
| Autorização            | Server-side, por papel e parceiro                  | Cliente não vê outro cliente, fornecedor não vê outro fornecedor nem margem; Wellmix vê tudo      |
| Permissões no Appwrite | Tabelas sem permissão de usuário (só API key)      | Simplifica: leitura e escrita sempre pelo servidor. Permissão de linha fica como hardening futuro |
| Workflow               | Etapas e requisitos em tabelas, engine simples     | Flexível o bastante para a Wellmix sem motor BPMN                                                 |
| Integrações            | Adaptadores com modo manual/mock                   | Sankhya, boleto, e-mail e WhatsApp não bloqueiam o fluxo                                          |
| i18n                   | Dicionários pt, en, zh em código                   | Fornecedores em chinês e inglês; sem plataforma de tradução                                       |
| Testes                 | vitest (fluxo e permissões) e Playwright (E2E)     | Happy path garantido antes de aumentar cobertura                                                  |

## 4. Módulos

1. Solicitações e RFQ (`services/requests.ts`): cliente ou Wellmix cria; Wellmix escolhe fornecedores; fornecedores cotam; Wellmix seleciona e define valor e sinal; sinal confirmado manualmente cria o pedido.
2. Pedidos e workflow (`workflow/`): etapas fixas, requisitos por etapa (checklist da linha na preparação), avanço automático, bloqueio por divergência de peso, aprovação de arte.
3. Documentos (`services/documents.ts`): storage com metadados, versionamento, visibilidade e download controlado.
4. Pendências e notificações (`services/tasks.ts`, `services/notifications.ts`, `services/reminders.ts`): o que cada um precisa fazer, avisos in-app, e-mail e WhatsApp (mock), lembretes por prazo.
5. Control Tower (`services/control-tower.ts`): pedidos ativos, onde estão, quem precisa agir, atrasos e exceções.
6. Conta corrente do fornecedor, multas (jurídico), cadastros com importação CSV, configurações.
7. Auditoria (`services/audit.ts`): usuário, ação, entidade, resumo, antes/depois.

## 5. Convenções

- Rotas públicas na raiz; área autenticada em `/app/*`. Proxy faz checagem otimista do cookie; páginas e ações validam a sessão.
- Toda escrita passa por Server Action em `src/app/app/actions.ts` com zod e `assert*` de papel. Erros voltam por `?error=` na mesma página.
- Nunca ler dados no browser: Server Components recebem dados já filtrados por papel.
- Esquema em `src/lib/db/schema.ts`; `appwrite.config.json` é gerado (`npm run appwrite:config`), nunca editado à mão.
- Português na interface e docs; inglês em identificadores.

## 6. Identidade visual

- Cor da marca: vermelho Wellmix `#BF2026`. Escala `brand-50…950` em `src/app/globals.css` (`brand-600` = cor do logo; `brand-700` para links e texto de destaque, contraste AA sobre branco).
- Logomarca: `public/brand/wellmix-logo.svg` (selo vermelho, fundo claro) e `wellmix-logo-white.svg` (fundo vermelho/escuro), usadas pelo componente `WellmixLogo` (`src/components/brand.tsx`). Ícones do navegador, atalho no celular e imagem de compartilhamento ficam nos arquivos de metadados do Next (`src/app/icon.svg`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png`, `manifest.ts`).
- Onde a marca aparece: cabeçalho vermelho com logo branco e item de menu ativo sublinhado; login com painel vermelho (apresentação e fluxo) e formulário branco; rodapé com logo colorido; barra do navegador no celular (`themeColor`).
- Regras de uso: vermelho = ação principal, item ativo, seleção e progresso. Estados usam verde (concluído), âmbar (atenção) e vermelho de erro, sempre com texto. Ação destrutiva é botão de contorno, nunca igual ao principal. Azul só em avisos informativos (`tone="info"`).
- Componentes: use o kit de `src/components/ui.tsx` (`Button`, `LinkButton`, `TextLink`/`linkClass`, `rowClass`, `Badge`, `Alert`, `Stat`, `Progress`, `StepDot`, `Empty`) em vez de classes de cor soltas; assim a marca muda em um lugar só.
