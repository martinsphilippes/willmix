# Arquitetura

## 1. Problema

A Wellmix é uma importadora e distribuidora, atuante desde 2010, de utilidades domésticas, brinquedos, infláveis e itens de decoração, com marcas próprias (Wellmix, Wellclean, Ease Care, WellKids, PetWell, FUNS) e uma rede de mais de 80 representantes comerciais em todo o Brasil. A venda é B2B: lojistas e atacadistas compram por meio dos representantes.

Fontes: LinkedIn da empresa, página "Quem Somos" indexada e catálogos de revendedores. O site oficial não pôde ser acessado da sessão (rede bloqueada).

Hipótese de trabalho: o Willmix é a plataforma interna que organiza o ciclo comercial B2B (catálogo, pedidos dos representantes, clientes lojistas, estoque e comissões). **Esta hipótese precisa ser confirmada antes de modelar os módulos.**

## 2. Objetivo

Reduzir trabalho manual entre representante, escritório e cliente, dar visibilidade em tempo real de pedidos e estoque, e gerar indicadores comerciais automaticamente.

## 3. Decisões técnicas

| Decisão             | Escolha                          | Motivo                                                                                          |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Front e API         | Next.js 16 App Router na Vercel  | Um só deploy, Server Components, Route Handlers como backend. Região `gru1` (São Paulo).        |
| Auth                | Firebase Auth + cookie de sessão | Login no browser, cookie HttpOnly no servidor. Evita token no localStorage.                     |
| Banco               | Firestore                        | Sem servidor para gerenciar, tempo real nativo, escala com o uso.                               |
| Arquivos            | Firebase Storage                 | Fotos de produto, PDFs de pedido, comprovantes.                                                 |
| Escritas de negócio | Só pelo servidor (Admin SDK)     | Regras de negócio e auditoria em um único lugar. Rules do cliente ficam mínimas.                |
| Validação           | zod                              | Mesmo schema para env, formulários e Route Handlers.                                            |
| Supabase            | Não usado neste projeto          | Já existe conector, mas dois backends dobram auth, custo e manutenção.                          |
| Cloud Functions     | Adiar                            | Route Handlers e Server Actions cobrem o backend. Functions só para triggers de Firestore/cron. |

### Ponto de atenção: Firestore versus Postgres

O Firestore atende bem catálogo, pedidos e tempo real. Ele é fraco em relatórios com muitos cruzamentos (comissão por representante por região por período, curva ABC, ruptura de estoque). Dois caminhos quando isso pesar:

1. Manter Firestore como fonte e exportar para BigQuery (extensão oficial) para relatórios.
2. Migrar o núcleo transacional para Postgres (Supabase já está disponível).

Recomendação: começar no Firestore, com coleções desenhadas para consultas conhecidas, e ativar a exportação para BigQuery quando os relatórios chegarem.

## 4. Módulos propostos (a validar)

1. **Usuários e papéis**: admin, comercial interno, representante, cliente lojista.
2. **Catálogo**: produtos por marca, linha, SKU, foto, embalagem, preço por tabela.
3. **Clientes**: lojistas com CNPJ, endereços, condição de pagamento, representante vinculado.
4. **Pedidos**: rascunho, enviado, aprovado, faturado, entregue; histórico e PDF.
5. **Estoque**: disponibilidade por SKU, chegada de contêineres, reservas.
6. **Comissões**: cálculo automático por pedido faturado, fechamento mensal.
7. **Dashboards**: vendas por representante, região, marca; ticket médio; ruptura.
8. **Auditoria**: quem alterou o quê e quando, em toda escrita do servidor.

## 5. Convenções

- Rotas públicas na raiz; área autenticada em `/app/*`.
- Toda escrita passa por Route Handler ou Server Action com validação zod e registro de auditoria.
- Firestore Rules negam por padrão; liberar leitura coleção a coleção.
- Variáveis de ambiente validadas em `src/lib/env.ts`.
- Português nos textos de interface e documentação; inglês em identificadores de código.
