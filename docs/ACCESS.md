# Telas por papel e por função (limpeza de acesso)

Decisão do dono (31/10/2026): cada login vê só as telas do que lhe foi designado, inclusive o operador da Wellmix; só o administrador continua com todas as telas; **financeiro é só do administrador** (o operador vê apenas o operacional).

## 1. Problema

Admin e operador tinham o mesmo menu (quatro grupos, 25 telas) e as mesmas páginas abertas; as funções da equipe (comprador, planner, designer…) só valiam dentro de alguns cartões (aprovação, numerário, dumping, designer). Um comprador via Financeiro, Contas a pagar e os totais vendidos/recebidos; um designer via Sourcing e Containers. Mais cliques, mais erro, menos clareza sobre quem faz o quê. A regra do menu (`nav.ts`) e a de cada página (`page.tsx`) eram escritas em lugares diferentes e podiam divergir.

## 2. Objetivo

Uma única lista de **telas** e uma única regra que diz quais telas cada login abre. O menu, a guarda de cada página, o Control Tower e as Server Actions leem a mesma regra. O administrador marca as funções do login em Gestão → Equipe e divisões, e as telas seguem as funções.

## 3. Regras

1. **Admin**: todas as telas (sem mudança).
2. **Operador Wellmix**: telas básicas + a união das telas das suas funções (padrão). O administrador pode, em Gestão → Equipe e divisões → Editar acessos, trocar para **Personalizado** e marcar as telas uma a uma (`users.screens`): aí valem só as caixas marcadas (mais o básico), seja qual for a função, inclusive Financeiro, Contas a pagar, Configurações, Equipe e Auditoria. "Padrão das funções" apaga a lista e volta à regra das funções. Sem função e sem tela marcada, vê só o básico e um aviso no início.
   - Básico de todo login da Wellmix: Control Tower, Pendências, Painel de SLA, Notificações, Mensagens.
   - As funções continuam mandando no comportamento dentro das telas (quem aprova, quem libera dumping, quem valida numerário, quem é designer); a lista de telas só decide o que abre.
3. **Financeiro é só do administrador** (ou de quem ele liberar tela a tela), seja qual for a função: Financeiro, Contas a pagar, conta corrente do fornecedor, a faixa "Financeiro" do Control Tower (vendido, recebido, a receber, comprado, pago, saldo), os valores em R$ dos cartões de Operação, o painel Financeiro em Painéis por área e, no pedido, o cartão financeiro (venda, custo, margem), os pagamentos do cliente e o pagamento ao fornecedor. O fornecedor continua vendo a previsão de pagamento dele; o cliente, os pagamentos dele. A função "financeiro" abre só a tela Pedidos, para validar e pagar o numerário dentro do pedido (docs/IMPORT_FLOW.md), sem ver pagamentos, valores nem margem; sem ninguém com ela, o admin faz.
4. **Cliente, fornecedor e parceiros**: as mesmas telas de hoje, agora escritas na mesma tabela (nada foi removido).
5. Página fora do permitido: volta ao início com o aviso "Você não tem acesso a X; peça ao administrador" (não é erro técnico). Server Action fora do permitido: recusada (`forbidden`), como já acontece com papéis.
6. Dentro da tela, as regras existentes continuam valendo (quem aprova nível, quem valida numerário, quem é designer, isolamento por empresa e por login). Preços de compra (FOB), preço ao cliente e margem na **solicitação** continuam com quem abre Solicitações: é o trabalho de compra.

## 4. Matriz função → telas (operador Wellmix)

| Tela                                                              | Comprador | Ger. produto | Planner | Cadastro | Dir. compras | Dir. executiva | Designer |
| ----------------------------------------------------------------- | :-------: | :----------: | :-----: | :------: | :----------: | :------------: | :------: |
| Solicitações (e cotações)                                         |     ✓     |      ✓       |    ✓    |          |      ✓       |       ✓        |          |
| Pedidos                                                           |     ✓     |      ✓       |    ✓    |    ✓     |      ✓       |       ✓        |    ✓     |
| Sourcing                                                          |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Fila de revisão                                                   |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Fretes e Tarifário de frete                                       |     ✓     |              |    ✓    |          |      ✓       |       ✓        |          |
| Embalagem (briefings)                                             |     ✓     |      ✓       |         |          |      ✓       |       ✓        |    ✓     |
| Containers                                                        |     ✓     |              |    ✓    |          |      ✓       |       ✓        |          |
| Cadastros (clientes, fornecedores, parceiros)                     |     ✓     |              |         |    ✓     |      ✓       |       ✓        |          |
| Produtos (e importar ficha)                                       |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |    ✓     |
| Linhas de produto                                                 |           |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Vitrine do cliente                                                |           |      ✓       |         |    ✓     |      ✓       |       ✓        |    ✓     |
| Importar planilha (CSV)                                           |           |              |         |    ✓     |      ✓       |       ✓        |          |
| Painéis por área (sem o Financeiro)                               |           |              |    ✓    |          |      ✓       |       ✓        |          |
| Multas                                                            |           |              |         |          |      ✓       |       ✓        |          |
| Pós-venda                                                         |     ✓     |      ✓       |         |          |      ✓       |       ✓        |          |
| Marketing (kits, tabela de preços)                                |           |      ✓       |         |          |      ✓       |       ✓        |    ✓     |
| Histórico comercial                                               |     ✓     |      ✓       |    ✓    |          |      ✓       |       ✓        |          |
| Auditoria                                                         |           |              |         |          |      ✓       |       ✓        |          |
| Financeiro, Contas a pagar, Conta corrente, Configurações, Equipe | só admin  |              |         |          |              |                |          |

A função **financeiro** não aparece na tabela: abre só Pedidos (regra 3).

Motivos (das especificações já escritas): comprador abre RFQ, escolhe fornecedor, valida ficha e imagens, acompanha produção e recebimento; gerente de produto libera dumping e cuida de produto, linha, vitrine, marketing e pós-venda; planner aprova o pré-custo, acompanha ETD e follow, containers e fretes; cadastro valida o cadastro do produto no pedido, importa fichas e planilhas; diretorias aprovam, acompanham painéis e auditoria; designer cuida de artes, embalagem, fotos e marketing.

## 5. Papéis de fora da Wellmix (sem mudança de conteúdo)

| Papel                                      | Telas                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Cliente                                    | Explorar (vitrine e carrinho), Solicitações, Pedidos, Pendências, Notificações, Mensagens, Histórico, Marketing |
| Fornecedor                                 | Pendências, Notificações, Mensagens, Cotações, Pedidos, Conta corrente                                          |
| Agência                                    | Pendências, Notificações, Mensagens, Embalagem, Pedidos                                                         |
| Despachante                                | Pendências, Notificações, Mensagens, Pedidos (e a classificação fiscal do produto a partir do pedido)           |
| Companhia marítima                         | Pendências, Notificações, Mensagens, Fretes, Tarifário (o seu), Pedidos                                         |
| Transportador, Comex, Agente de carga, OCP | Pendências, Notificações, Mensagens, Pedidos                                                                    |
| Jurídico                                   | Pendências, Notificações, Mensagens, Pedidos, Multas                                                            |

## 6. Onde fica no código

- `src/lib/auth/screens.ts`: lista de telas (`SCREENS`), grupos do menu (`SCREEN_GROUPS`), rota → tela (`screenOfPath`), telas por papel (`ROLE_SCREENS`), por função (`FUNCTION_SCREENS`), só do admin por padrão (`ADMIN_ONLY`), `functionScreensFor(user)` (padrão), `screensFor(user)` (lista marcada uma a uma, se houver; senão o padrão), `hasCustomScreens`, `canOpen(user, tela)` e `assertScreen(user, tela)` (Server Actions).
- `users.screens` (json, opcional): a lista marcada uma a uma; nula = padrão das funções. `setTeamMember` (src/lib/services/team.ts) grava só chaves válidas, sem o básico; auditoria `team.member`.
- `src/lib/auth/guard.ts`: `requireScreen(user, tela)` nas páginas (volta ao início com `?denied=tela`).
- `src/lib/nav.ts`: o menu é montado a partir de `screensFor(user)`, na mesma ordem e nos mesmos grupos de antes.
- Cada `page.tsx` chama `requireScreen` (no lugar de `assertWellmix`/`redirect("/app")`); as Server Actions da Wellmix chamam `assertScreen`; as de pagamento, só o admin.
- Control Tower: faixa Financeiro, valores em R$ e "Comercial por container" só com a tela Financeiro; cartões e tabela de pedidos só com a tela Pedidos; avisos de acesso negado e de login sem função.
- Gestão → Equipe e divisões: lista em linhas (nome, cargo, divisão, responde a, funções, telas: "Todas", "Padrão das funções (N)", "Personalizado (N)" ou "Só o básico") com "Editar acessos" → `/app/team/[id]`: Dados, Funções (com o que cada uma faz) e Telas (caixas por grupo do menu; básico sempre marcado; rádio Padrão das funções × Personalizado). Aviso quando há login só com o básico.
- Contas de demonstração: o operador de demonstração tem as funções comprador e planner (`src/lib/demo-data.ts`); "Criar as contas que faltam" também preenche as funções do operador de demonstração que ainda não tem nenhuma.

## 7. Impacto ao publicar

Operadores já cadastrados em produção não têm função: ao entrar, veem só o básico e o aviso. O administrador marca as funções em Gestão → Equipe e divisões (uma vez por login). Nenhuma tela, rota, campo ou dado foi removido.

## 8. Melhorias futuras

- Esconder, dentro das páginas, os links para telas que o login não abre (hoje o destino avisa e volta ao início).
- Dono da pendência por função (compras × logística), já listado em docs/SLA_PANEL.md.
