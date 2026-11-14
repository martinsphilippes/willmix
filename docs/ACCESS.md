# Telas por papel e por função (limpeza de acesso)

Decisão do dono (31/10/2026): cada login vê só as telas do que lhe foi designado, inclusive o operador da Wellmix; só o administrador continua com todas as telas; **financeiro é só do administrador** (o operador vê apenas o operacional).

## 1. Problema

Admin e operador tinham o mesmo menu (quatro grupos, 25 telas) e as mesmas páginas abertas; as funções da equipe (comprador, planner, designer…) só valiam dentro de alguns cartões (aprovação, numerário, dumping, designer). Um comprador via Financeiro, Contas a pagar e os totais vendidos/recebidos; um designer via Sourcing e Containers. Mais cliques, mais erro, menos clareza sobre quem faz o quê. A regra do menu (`nav.ts`) e a de cada página (`page.tsx`) eram escritas em lugares diferentes e podiam divergir.

## 2. Objetivo

Uma única lista de **telas** e uma única regra que diz quais telas cada login abre. O menu, a guarda de cada página, o Control Tower e as Server Actions leem a mesma regra. O administrador marca as funções do login em Gestão → Equipe e divisões, e as telas seguem as funções.

## 3. Regras

1. **Admin**: todas as telas (sem mudança).
2. **Operador Wellmix**: telas básicas + a união das telas das suas funções (padrão). O administrador pode, em Gestão → Equipe e divisões → Editar acessos, trocar para **Personalizado** e marcar as telas uma a uma (`users.screens`): aí valem só as caixas marcadas (mais o básico), seja qual for a função, inclusive Financeiro, Contas a pagar, Configurações, Equipe e Auditoria. "Padrão das funções" apaga a lista e volta à regra das funções. Sem função e sem tela marcada, vê só o básico e um aviso no início.
   - Básico de todo login da Wellmix (card "Início"): Control Tower, Pendências, Painel de SLA, Notificações, Mensagens. Desde 13/11/2026 cada tela do Início é configurável por função (ver "Telas e links" abaixo); login sem função ou com telas marcadas uma a uma continua com o Início inteiro.
   - As funções continuam mandando no comportamento dentro das telas (quem aprova, quem libera dumping, quem valida numerário, quem é designer); a lista de telas só decide o que abre.
3. **Financeiro é só do administrador** (ou de quem ele liberar tela a tela), seja qual for a função: Financeiro, Contas a pagar, conta corrente do fornecedor, a faixa "Financeiro" do Control Tower (vendido, recebido, a receber, comprado, pago, saldo), os valores em R$ dos cartões de Operação, o painel Financeiro em Painéis por área e, no pedido, o cartão financeiro (venda, custo, margem), os pagamentos do cliente e o pagamento ao fornecedor. O fornecedor continua vendo a previsão de pagamento dele; o cliente, os pagamentos dele. A função "financeiro" abre só a tela Pedidos, para validar e pagar o numerário dentro do pedido (docs/IMPORT_FLOW.md), sem ver pagamentos, valores nem margem; sem ninguém com ela, o admin faz.
4. **Cliente, fornecedor e parceiros**: as mesmas telas de hoje, agora escritas na mesma tabela (nada foi removido).
5. Página fora do permitido: volta ao início com o aviso "Você não tem acesso a X; peça ao administrador" (não é erro técnico). Server Action fora do permitido: recusada (`forbidden`), como já acontece com papéis.
6. Dentro da tela, as regras existentes continuam valendo (quem aprova nível, quem valida numerário, quem é designer, isolamento por empresa e por login). Preços de compra (FOB), preço ao cliente e margem na **solicitação** continuam com quem abre Solicitações: é o trabalho de compra.

## 4. Matriz função → telas (operador Wellmix)

| Tela                                                                         | Comprador | Ger. produto | Planner | Cadastro | Dir. compras | Dir. executiva | Designer |
| ---------------------------------------------------------------------------- | :-------: | :----------: | :-----: | :------: | :----------: | :------------: | :------: |
| Booking (planilhas de fornecedor)                                            |     ✓     |      ✓       |    ✓    |    ✓     |      ✓       |       ✓        |          |
| Solicitações (e cotações)                                                    |     ✓     |      ✓       |    ✓    |          |      ✓       |       ✓        |          |
| Pedidos                                                                      |     ✓     |      ✓       |    ✓    |    ✓     |      ✓       |       ✓        |    ✓     |
| Produção (13/11/2026)                                                        |     ✓     |              |    ✓    |          |      ✓       |       ✓        |          |
| Sourcing                                                                     |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Fila de revisão                                                              |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Fretes e Tarifário de frete                                                  |     ✓     |              |    ✓    |          |      ✓       |       ✓        |          |
| Embalagem (briefings)                                                        |     ✓     |      ✓       |         |          |      ✓       |       ✓        |    ✓     |
| Containers                                                                   |     ✓     |              |    ✓    |          |      ✓       |       ✓        |          |
| Cadastros (clientes, fornecedores, parceiros)                                |     ✓     |              |         |    ✓     |      ✓       |       ✓        |          |
| Produtos (e importar ficha)                                                  |     ✓     |      ✓       |         |    ✓     |      ✓       |       ✓        |    ✓     |
| Linhas de produto                                                            |           |      ✓       |         |    ✓     |      ✓       |       ✓        |          |
| Vitrine do cliente                                                           |           |      ✓       |         |    ✓     |      ✓       |       ✓        |    ✓     |
| Importar planilha (CSV)                                                      |           |              |         |    ✓     |      ✓       |       ✓        |          |
| Painéis por área (sem o Financeiro)                                          |           |              |    ✓    |          |      ✓       |       ✓        |          |
| Multas                                                                       |           |              |         |          |      ✓       |       ✓        |          |
| Pós-venda                                                                    |     ✓     |      ✓       |         |          |      ✓       |       ✓        |          |
| Marketing (kits, tabela de preços)                                           |           |      ✓       |         |          |      ✓       |       ✓        |    ✓     |
| Histórico comercial                                                          |     ✓     |      ✓       |    ✓    |          |      ✓       |       ✓        |          |
| Auditoria                                                                    |           |              |         |          |      ✓       |       ✓        |          |
| Financeiro, Contas a pagar, Conta corrente, Configurações, Equipe, Superplan | só admin  |              |         |          |              |                |          |

A função **financeiro** não aparece na tabela: abre só Pedidos (regra 3).

Motivos (das especificações já escritas): comprador abre RFQ, escolhe fornecedor, valida ficha e imagens, acompanha produção e recebimento; gerente de produto libera dumping e cuida de produto, linha, vitrine, marketing e pós-venda; planner aprova o pré-custo, acompanha ETD e follow, containers e fretes; cadastro valida o cadastro do produto no pedido, importa fichas e planilhas; diretorias aprovam, acompanham painéis e auditoria; designer cuida de artes, embalagem, fotos e marketing.

## 5. Papéis de fora da Wellmix (sem mudança de conteúdo)

| Papel                                      | Telas                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente                                    | Explorar (vitrine e carrinho), Solicitações, Pedidos, Pendências, Notificações, Mensagens, Histórico, Marketing                                    |
| Fornecedor                                 | Pendências, Notificações, Mensagens, Cotações, Pedidos, Conta corrente                                                                             |
| Agência                                    | Pendências, Notificações, Mensagens, Embalagem, Pedidos                                                                                            |
| Despachante                                | Pendências, Notificações, Mensagens, Pedidos (e a classificação fiscal do produto a partir do pedido)                                              |
| Companhia marítima                         | Pendências, Notificações, Mensagens, Fretes, Tarifário (o seu), Pedidos                                                                            |
| Transportador, Comex, Agente de carga, OCP | Pendências, Notificações, Mensagens, Pedidos (a OCP abre também a ficha de compra e o documento do pedido dos pedidos dela, só leitura, com preço) |
| Jurídico                                   | Pendências, Notificações, Mensagens, Pedidos, Multas                                                                                               |

## 6. Onde fica no código

- `src/lib/auth/screens.ts`: lista de telas (`SCREENS`), grupos do menu (`SCREEN_GROUPS`), rota → tela (`screenOfPath`), telas por papel (`ROLE_SCREENS`), por função (`FUNCTION_SCREENS`), só do admin por padrão (`ADMIN_ONLY`), `functionScreensFor(user)` (padrão), `screensFor(user)` (lista marcada uma a uma, se houver; senão o padrão), `hasCustomScreens`, `canOpen(user, tela)` e `assertScreen(user, tela)` (Server Actions).
- `users.screens` (json, opcional): a lista marcada uma a uma; nula = padrão das funções. `setTeamMember` (src/lib/services/team.ts) grava só chaves válidas, sem o básico; auditoria `team.member`.
- `src/lib/auth/guard.ts`: `requireScreen(user, tela)` nas páginas (volta ao início com `?denied=tela`).
- `src/lib/nav.ts`: o menu lateral é montado a partir de `screensFor(user)` (grupos e ordem em docs/ARQUITETURA.md, "Menu lateral"; telas fora do fluxo em `MENU_HIDDEN`).
- Cada `page.tsx` chama `requireScreen` (no lugar de `assertWellmix`/`redirect("/app")`); as Server Actions da Wellmix chamam `assertScreen`; as de pagamento, só o admin.
- Control Tower: faixa Financeiro, valores em R$ e "Comercial por container" só com a tela Financeiro; cartões e tabela de pedidos só com a tela Pedidos; avisos de acesso negado e de login sem função.
- Gestão → Equipe e divisões: lista em linhas (nome, cargo, divisão, responde a, funções, telas: "Todas", "Padrão das funções (N)", "Personalizado (N)" ou "Só o básico") com "Editar acessos" → `/app/team/[id]`: Dados, Funções (com o que cada uma faz) e Telas (caixas por grupo do menu; básico sempre marcado; rádio Padrão das funções × Personalizado). Aviso quando há login só com o básico.
- Contas de demonstração: o operador de demonstração tem as funções comprador e planner (`src/lib/demo-data.ts`); "Criar as contas que faltam" também preenche as funções do operador de demonstração que ainda não tem nenhuma.

## 7. Impacto ao publicar

Operadores já cadastrados em produção não têm função: ao entrar, veem só o básico e o aviso. O administrador marca as funções em Gestão → Equipe e divisões (uma vez por login). Nenhuma tela, rota, campo ou dado foi removido.

## 8. Melhorias futuras

- Esconder, dentro das páginas, os links para telas que o login não abre (hoje o destino avisa e volta ao início).
- Dono da pendência por função (compras × logística), já listado em docs/SLA_PANEL.md.

## Troca de senha e primeiro acesso (decisão do dono, 11/11/2026)

- **Trocar senha** (`/app/password`, no menu do usuário): qualquer login troca a própria senha informando a atual, a nova e a confirmação. A nova tem pelo menos 8 caracteres e é diferente da atual (`src/lib/password-rules.ts`). No Appwrite a troca é feita na identidade de quem está logado (`account.updatePassword`), que confere a senha atual; no modo memória, pelo hash. No Supabase, o login confere a senha atual e o token dele grava a nova (`supabaseChangePassword`). A auditoria registra só que houve troca (`user.password_change`), nunca a senha.
- **Senha provisória** (`users.mustChangePassword`, coluna opcional): enquanto a marca existir, o portal mostra **só a troca de senha** no lugar de qualquer tela (`src/app/app/layout.tsx`), e a marca some ao trocar. A senha provisória não pode ser mantida. Login sem a marca (todos os anteriores) entra normalmente.
- **Login de administrador com senha provisória**: `scripts/appwrite-admin-login.ts` cria a conta no Appwrite e o cadastro com papel `admin` e a marca ligada. E-mail, nome e senha vêm de variáveis de ambiente (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`); a senha não fica no repositório. Pelo GitHub, sem terminal: Actions → "Criar login de administrador" (`.github/workflows/appwrite-admin-login.yml`), informando e-mail, nome e a senha provisória. Só cria: se o e-mail já existe, para sem alterar nada. `createPortalLogin` aceita `mustChangePassword` para os logins criados pelo portal.
- **Limite conhecido**: o bloqueio é da tela. As Server Actions e `/api` não recusam um login com senha provisória; ele só não tem como chegar a elas pelo portal antes de trocar.

## Idioma na tela de entrada (pedido do dono, 11/11/2026)

A tela de entrada (`/login`) mostra o seletor de idioma com o ícone do globo: Português, English e 中文. Um toque troca na hora e fica guardado em cookie, então o portal já abre no idioma escolhido depois do login. É o mesmo componente do cabeçalho (`src/components/locale-switcher.tsx`, ação `setLocaleAction`).

## Funções e acessos configuráveis (decisão do dono, 11/11/2026)

Gestão → Equipe (`/app/team`, só o administrador) ganhou três abas:

1. **Equipe**: a equipe interna da Wellmix em linhas (como antes) e o botão **Novo usuário**, que abre o formulário de novo login num modal (`?tab=team&new=1`; erro volta para o modal).
2. **Funções e acessos** (`?tab=functions&fn=CHAVE&view=screens|actions`): as funções à esquerda (2/12 da largura) e, no resto, a função escolhida em duas abas:
   - **Telas e links**: as telas que a função abre, nos grupos do menu. As telas do card "Início" (Control Tower, Pendências, Painel de SLA, Notificações, Mensagens) também são configuráveis por função: vêm marcadas (padrão, o acesso de antes) e as desmarcadas ficam em `baseOff` da função, no mesmo `settings.teamFunctions`. O login abre uma tela do Início se qualquer função ativa dele a deixar marcada; sem função ativa, ou com telas marcadas uma a uma (`users.screens`), abre todas; o administrador abre tudo. Vale para o menu, os ícones do cabeçalho (mensagens e sino) e o endereço direto. Sem o Control Tower, `/app` leva à primeira tela do menu que o login abre (`startPathFor`); sem nenhuma, mostra só a saudação. O que não estiver marcado não aparece no menu e não abre: a página volta ao início com o aviso e as Server Actions recusam (`requireScreen`/`assertScreen`, como antes). As telas "normalmente só do administrador" (Financeiro, Contas a pagar, Conta corrente, Configurações, Equipe, Superplan) podem ser liberadas por função, como já era possível login a login.
   - **Ações**: o que a função pode fazer dentro das telas. Sem a permissão, o botão some e o servidor recusa (`can`/`assertCan`).
   - Criar função (chave `fn_<nome>`), renomear (a de fábrica volta ao nome original com o campo vazio), voltar ao padrão (as de fábrica) e desativar ou reativar (as criadas; desativada não libera nada, a marca continua no cadastro do login).
3. **Linha de produto e divisão**: a divisão de cada linha e a distribuição das pendências (o mesmo de antes).

### Ações (catálogo em `src/lib/auth/function-access.ts`)

| Ação                                                          | Onde é conferida                                                                                                                          | Padrão (igual ao de antes)    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Decidir a solicitação ao fornecedor                           | `decideSupplierRequest`; botões na solicitação                                                                                            | quem abre Cotações            |
| Liberar dumping                                               | `canReleaseDumping`                                                                                                                       | gerente de produto, comprador |
| Aprovar o pré-custo (planner / dir. compras / dir. executiva) | `approvals.ts` (quem decide e quem é avisado)                                                                                             | a função de mesmo nome        |
| Gerar pedido de compra                                        | `createPurchaseOrder`; quadro em Solicitações ao fornecedor                                                                               | quem abre Cotações e Pedidos  |
| Validar a arte (pedido de compra)                             | `canSubmitRequirement` (`art_review__item`)                                                                                               | quem abre Pedidos             |
| Fazer as artes (designer)                                     | avisos e candidatos a designer (`artwork.ts`, `import-flow.ts`)                                                                           | designer                      |
| Assinar o contrato pela Wellmix                               | `canSubmitRequirement` e `signOrderDocument`                                                                                              | quem abre Pedidos             |
| Cancelar pedido                                               | `cancelOrder`, `rejectCancelRequest`; cartão no pedido                                                                                    | ninguém (só o admin)          |
| Numerário e financeiro do pedido                              | `isFinance` (numerário) e avisos de recebimento encerrado                                                                                 | financeiro                    |
| Acompanhar o recebimento                                      | avisos da conferência no armazém                                                                                                          | comprador                     |
| Ver valores e margem                                          | `canSeeMoney`: Control Tower (faixa Financeiro e valores), Solicitações, Estoque, Clientes/Fornecedores (conta e vendas) e as exportações | ninguém (só o admin)          |

Registrar e confirmar pagamentos (sinal, pagamento ao fornecedor, marketing) continua exigindo a tela Financeiro.

### Onde fica

- Configuração: tabela `settings`, chave `teamFunctions` (`src/lib/services/team-functions.ts`; sem coluna nova, sem publicar esquema). Função de fábrica sem nada gravado segue o padrão do código (`FUNCTION_SCREENS` e o padrão das ações). Cada mudança vai para a auditoria (`team.function_*`).
- `getCurrentUser` resolve as telas e ações das funções do login uma vez por requisição (`src/lib/auth/access-cache.ts`); `screensFor`, `canOpen` e `can` leem dali. Para outro login (lista da equipe, avisos), quem chama passa a configuração.
- `users.functions` aceita as chaves das funções criadas; só funções existentes e ativas são gravadas (`setTeamMember`).
- O administrador continua abrindo e fazendo tudo. A lista de telas marcada login a login (Editar acessos → Personalizado) continua valendo por cima das funções.

### Fica para depois

- Bloqueio por política no banco (RLS por usuário no Supabase): hoje o banco já é fechado e só o servidor do portal lê e grava; a conferência é no servidor (decisão do dono: não agora).
- Pendências: um login sem a permissão de validar a arte ou assinar o contrato ainda pode ver a pendência em Minhas pendências; ao abrir, o botão não aparece.

## Excluir acesso (pedido do dono, 13/11/2026)

Equipe e acessos → acessos de uma pessoa (`/app/team/[id]`), só para o administrador: botão **Excluir acesso** no topo, ao lado de "Voltar à equipe".

- **Confirmação**: a caixa mostra o nome e o login (e-mail ou nome de usuário) da pessoa e explica que ela perde o acesso à equipe Wellmix: não entra mais e, com o portal aberto, é desconectada na próxima tela; o histórico, os registros e a autoria continuam guardados. Se alguém responde a ela ou se há pendências abertas com ela, a caixa avisa o que fazer depois ("Responde a"; "Distribuir agora" na aba "Linha de produto e divisão"). "Cancelar" fecha sem mudar nada.
- **O que faz**: o login fica inativo (`users.active = false`, exclusão lógica). Sai da lista da equipe, da escolha de chefe, da distribuição e dos avisos (todos leem só os ativos); a entrada recusa o login; a sessão já aberta cai na próxima requisição (no Supabase e no modo memória a sessão relê o login a cada página; no Appwrite, a sessão conferida em cache é esquecida na hora naquela instância e, nas outras, em no máximo 60 s).
- **Nada é apagado**: o cadastro do login, a Auditoria, o histórico, os registros com o id dele (dono de solicitação ou pedido, autor de mensagens, aprovações, documentos) e o chefe gravado de quem respondia a ele ficam como estavam; as telas continuam mostrando o nome dele no que ele fez. As pendências abertas com ele contam como "sem responsável" em "Distribuir agora" (já era assim para login inativo).
- **Regras no servidor** (`removeTeamMember`, `src/lib/services/team.ts`): só o administrador (`forbidden`); só logins ativos da equipe Wellmix (`not_found` para parceiros e para quem já foi excluído); não exclui o próprio acesso (`delete_self`); não exclui o último administrador ativo (`delete_last_admin`), conferido antes e depois de gravar: se dois administradores se excluírem ao mesmo tempo, a exclusão que deixaria a equipe sem administrador é desfeita. Na tela, nesses dois casos o botão aparece desligado, com o motivo.
- **Auditoria**: `team.member.delete` (módulo Equipe) com quem excluiu, o acesso ("Acesso excluído: nome (login)"), a data e a hora, o antes (papel, cargo, chefe, divisão, funções, telas) e o depois (`active: false`). Se o registro na Auditoria não for gravado, a exclusão é desfeita e a tela mostra o erro: não há exclusão sem registro.
- **Depois**: volta à lista (`/app/team?saved=deleted`) com "Acesso excluído com sucesso". Com erro, volta à pessoa com o motivo; se ela já não estiver na equipe (excluída em outra aba), à lista com o aviso. A página de quem foi excluído não abre mais.
- **Uma equipe só**: o portal tem uma equipe (Wellmix); cada login é dela ou de um parceiro. A exclusão só mexe no login da equipe; logins de parceiros não passam por aqui.
- **Limite conhecido**: não há "reativar" na tela, e um login novo com o mesmo e-mail é recusado (`user_email_taken`), porque o cadastro inativo continua. Para voltar, hoje é preciso reativar no banco (`users.active = true`).
- Peças: `removeTeamMemberAction` (`src/app/app/actions/team.ts`), `teamMemberRemoval` (os avisos da caixa), `forgetUserSessions` (`src/lib/auth/session.ts`), `QuickDialog` com `tone="danger"` e `disabled`. Textos `team.delete.*`, `team.saved.deleted`, `team.error.delete_self` e `team.error.delete_last_admin` nos três idiomas. Sem mudança no banco.
- Testes: `tests/unit/team-delete.test.ts` e `tests/e2e/team-delete.spec.ts`.
