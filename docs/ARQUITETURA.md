# Arquitetura

## 1. Problema

A Wellmix é uma importadora e distribuidora, atuante desde 2010, de utilidades domésticas, brinquedos, infláveis e itens de decoração, com marcas próprias (Wellmix, Wellclean, Ease Care, WellKids, PetWell, FUNS) e uma rede de mais de 80 representantes comerciais em todo o Brasil. A venda é B2B: lojistas e atacadistas compram por meio dos representantes.

Fontes: LinkedIn da empresa, página "Quem Somos" indexada e catálogos de revendedores. O site oficial não pôde ser acessado da sessão (rede bloqueada).

Hipótese de trabalho: o Willmix é a plataforma interna que organiza o ciclo comercial B2B (catálogo, pedidos dos representantes, clientes lojistas, estoque e comissões). **Esta hipótese precisa ser confirmada antes de modelar os módulos.**

## 2. Objetivo

Reduzir trabalho manual entre representante, escritório e cliente, dar visibilidade em tempo real de pedidos e estoque, e gerar indicadores comerciais automaticamente.

## 3. Decisões técnicas

| Decisão             | Escolha                          | Motivo                                                                                                |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Front e API         | Next.js 16 App Router na Vercel  | Um só deploy, Server Components, Route Handlers como backend. Região `gru1` (São Paulo).              |
| Backend gerenciado  | Appwrite Cloud                   | Auth, banco, arquivos, funções e realtime em um só serviço, com console simples e opção de self-host. |
| Auth                | Appwrite Auth, padrão SSR        | Sessão criada no servidor com API key, segredo em cookie HttpOnly. Nada de token no localStorage.     |
| Banco               | Appwrite TablesDB                | Tabelas com colunas tipadas, índices, relacionamentos e permissões por linha.                         |
| Arquivos            | Appwrite Storage                 | Fotos de produto, PDFs de pedido, comprovantes. Bucket com permissões por papel.                      |
| Escritas de negócio | Só pelo servidor (cliente admin) | Regras de negócio e auditoria em um único lugar. Permissões de linha ficam como segunda barreira.     |
| Papéis              | Appwrite Teams + labels          | Teams para grupos (admin, comercial, representantes); labels para atalhos de permissão.               |
| Validação           | zod                              | Mesmo schema para env, formulários e Route Handlers.                                                  |
| Supabase e Firebase | Não usados                       | Firebase foi descartado antes de qualquer módulo. Dois backends dobram auth, custo e manutenção.      |
| Appwrite Functions  | Adiar                            | Route Handlers cobrem o backend. Functions só para eventos de banco, cron e integrações externas.     |

### Ponto de atenção: relatórios

O TablesDB atende bem catálogo, pedidos e tempo real, e aceita consultas com filtros e ordenação por índice. Ele não faz agregações complexas (comissão por representante por região por período, curva ABC) em uma única consulta. Dois caminhos quando isso pesar:

1. Tabelas de resumo mantidas por Appwrite Functions disparadas em eventos de escrita (agregação incremental).
2. Exportação periódica para um Postgres analítico (Supabase já está disponível) só para relatórios.

Recomendação: começar com tabelas de resumo, que são simples e baratas, e migrar para o Postgres analítico apenas se a demanda de relatórios crescer.

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
- Permissões de linha no Appwrite negam por padrão; liberar leitura tabela a tabela.
- Variáveis de ambiente validadas em `src/lib/env.ts`.
- Esquema de tabelas e buckets versionado em `appwrite.config.json` e publicado via CLI.
- Português nos textos de interface e documentação; inglês em identificadores de código.
