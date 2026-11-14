# Telas por papel e por função (limpeza de acesso)

Decisão do dono (31/10/2026): cada login vê só as telas do que lhe foi designado, inclusive o operador da Wellmix; só o administrador continua com todas as telas; **financeiro é só do administrador** (o operador vê apenas o operacional).

## 1. Problema

Admin e operador tinham o mesmo menu (quatro grupos, 25 telas) e as mesmas páginas abertas; as funções da equipe (comprador, planner, designer…) só valiam dentro de alguns cartões (aprovação, numerário, dumping, designer). Um comprador via Financeiro, Contas a pagar e os totais vendidos/recebidos; um designer via Sourcing e Containers. Mais cliques, mais erro, menos clareza sobre quem faz o quê. A regra do menu (`nav.ts`) e a de cada página (`page.tsx`) eram escritas em lugares diferentes e podiam divergir.

## 2. Objetivo

Uma única lista de **telas** e uma única regra que diz quais telas cada login abre. O menu, a guarda de cada página, o Control Tower e as Server Actions leem a mesma regra. O administrador marca as funções do login em Gestão → Equipe e divisões, e as telas seguem as funções.

## 3. Regras

1. **Admin**: todas as telas (sem mudança).
2. **Operador Wellmix**: telas básicas + a união das telas das suas funções (padrão). O administrador pode, em Gestão → Equipe e divisões → Editar acessos, trocar para **Personalizado** e marcar as telas uma a uma (`users.screens`): aí valem só as caixas marcadas (mais o básico), seja qual for a função, inclusive Financeiro, Contas a pagar, Configurações, Equipe e Auditoria. "Padrão das funções" apaga a lista e volta à regra das funções. Sem função e sem tela marcada, vê só o básico e um aviso no início.
   - Básico de todo login da Wellmix (card "Início"): Control Tower, Pendências, Painel de SLA, Notificações, Mensagens. Desde 13/11/2026 cada tela do Início é configurável por função (ver "Telas e links" abaixo); login sem função continua com o Início inteiro. Desde 14/11/2026, o Personalizado guarda só as exceções do login (o que o administrador marcou ou desmarcou à mão, inclusive no Início) por cima das funções: mudou a função, muda o resultado e a exceção continua (ver "Equipe e acessos: painel lateral, permissões por módulo e aplicação" abaixo).
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
- `users.screens` (json, opcional): a lista marcada uma a uma, do Personalizado de antes de 14/11/2026 (vale como estava; em produção não havia nenhuma); nula = padrão das funções. `users.screenExceptions` (json, opcional, 14/11/2026): o Personalizado por exceções, `{ added, removed }`, por cima das funções. `setTeamMember` (src/lib/services/team.ts) grava só chaves válidas; auditoria `team.member`.
- `src/lib/auth/guard.ts`: `requireScreen(user, tela)` nas páginas (volta ao início com `?denied=tela`).
- `src/lib/nav.ts`: o menu lateral é montado a partir de `screensFor(user)` (grupos e ordem em docs/ARQUITETURA.md, "Menu lateral"; telas fora do fluxo em `MENU_HIDDEN`).
- Cada `page.tsx` chama `requireScreen` (no lugar de `assertWellmix`/`redirect("/app")`); as Server Actions da Wellmix chamam `assertScreen`; as de pagamento, só o admin.
- Control Tower: faixa Financeiro, valores em R$ e "Comercial por container" só com a tela Financeiro; cartões e tabela de pedidos só com a tela Pedidos; avisos de acesso negado e de login sem função.
- Gestão → Equipe e divisões: lista em linhas (nome, cargo, divisão, responde a, funções, telas: "Todas", "Padrão das funções (N)", "Personalizado (N)" ou "Só o básico") com "Editar acessos", que abre o painel lateral na própria lista (o nome da pessoa leva à página `/app/team/[id]`, com o mesmo editor e o "Excluir acesso"): cargo, funções, divisão, "Responde a", o modo das telas e a prévia de "Acessos efetivos" (telas e ações, com a origem de cada uma). Aviso quando há login só com o básico.
- Contas de demonstração: o operador de demonstração tem as funções comprador e planner (`src/lib/demo-data.ts`); "Criar as contas que faltam" também preenche as funções do operador de demonstração que ainda não tem nenhuma.

## 7. Impacto ao publicar

Operadores já cadastrados em produção não têm função: ao entrar, veem só o básico e o aviso. O administrador marca as funções em Gestão → Equipe e divisões (uma vez por login). Nenhuma tela, rota, campo ou dado foi removido.

## 8. Melhorias futuras

- Esconder, dentro das páginas, os links para telas que o login não abre (hoje o destino avisa e volta ao início).
- Dono da pendência por função (compras × logística), já listado em docs/SLA_PANEL.md.

## Troca de senha e primeiro acesso (decisão do dono, 11/11/2026)

- **Trocar senha** (`/app/password`, no menu do usuário): qualquer login troca a própria senha informando a atual, a nova e a confirmação. A nova tem pelo menos 8 caracteres e é diferente da atual (`src/lib/password-rules.ts`). No Appwrite a troca é feita na identidade de quem está logado (`account.updatePassword`), que confere a senha atual; no modo memória, pelo hash. No Supabase, o login confere a senha atual e o token dele grava a nova (`supabaseChangePassword`). A auditoria registra só que houve troca (`user.password_change`), nunca a senha.
- **Senha provisória** (`users.mustChangePassword`, coluna opcional): enquanto a marca existir, o portal mostra **a troca de senha** no lugar de qualquer tela (`src/app/app/layout.tsx`), e a marca some ao trocar. Login sem a marca (todos os anteriores) entra normalmente.
- **Seguir sem trocar** (decisão do dono, 14/11/2026; até então a provisória não podia ser mantida): o cartão do primeiro acesso tem **"Continuar sem trocar a senha"**. A marca some, a tela aberta segue sem trocar de endereço e o portal não pede mais a troca (nem ao recarregar, nem ao entrar de novo). A senha provisória continua valendo e a troca fica em "Trocar senha", no menu da conta. A auditoria registra `user.password_change_skipped`, para o administrador saber quem seguiu sem trocar (`skipPasswordChange`, `src/lib/services/password-change.ts`).
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

## Equipe e acessos: painel lateral, permissões por módulo e aplicação (pedido do dono, 14/11/2026)

**Funções e acessos** (`/app/team?tab=functions&fn=CHAVE`):

- O nome da função tem o menu ⋯ ao lado: "Renomear função" (o campo do nome só aparece ao escolher), "Restaurar nome padrão" (de fábrica com nome mudado), "Voltar ao padrão (telas e ações)" (de fábrica) e "Desativar/Reativar função" (criadas). O formulário de renomear saiu do conteúdo principal.
- "Telas e links" e "Ações" no mesmo painel (`src/app/app/team/_components/function-permissions.tsx`), em linhas compactas, com busca e seções que abrem e fecham pelos módulos do menu (`src/lib/auth/permission-modules.ts`): Início, Produto novo (o Book do mapa), Pedido, Produção, Entrega, Vendas, Financeiro, Painéis, Cadastros e Gestão. Cada tela e cada ação fica num módulo só e continua sendo uma caixa.
- Um botão só, "Salvar permissões", grava as duas abas numa gravação (`setFunctionPermissions`, auditoria `team.function_permissions`). Trocar de aba não perde o que foi marcado; a tela mostra "Alterações não salvas" e, depois que o servidor terminou, "Permissões salvas às HH:MM".
- Ações que não valem mais (a aprovação do pré-custo e a liberação de dumping saíram do portal em 11/11/2026): não aparecem para marcar e continuam gravadas na função como estavam (`RETIRED_ACTIONS`).
- iPad em pé e celular: a lista de funções vira um seletor no alto, para o editor ficar logo abaixo.

**Equipe → Editar acessos** em painel lateral (`team-access-drawer.tsx` e `team-access-editor.tsx`):

- Abre por cima da lista, sem trocar de tela (no celular, na largura toda). Fechar deixa a lista como estava: busca, ordem, página e rolagem. Os links continuam apontando para `/app/team/[id]` (nova aba, sem JavaScript); a página da pessoa usa o mesmo editor.
- Edita cargo, funções (marcadas como etiquetas, com "+ Adicionar função"), divisão e "Responde a". A prévia de "Acessos efetivos" (telas e ações) é recalculada na hora a cada mudança, com a mesma regra do servidor (`src/lib/auth/screen-picker.ts`). O cargo não libera telas nem ações (regra do portal): trocar o cargo não muda a prévia.
- Cada permissão diz de onde vem: "Herdado de Designer, Planner" (as funções que liberam), "Padrão do portal" (Início de login sem função), "Personalizado" (marcada à mão), "Removida no personalizado" (desmarcada à mão) ou "Administrador".
- Modos: **Padrão das funções** (as caixas mostram o resultado, só leitura) e **Personalizado** (as caixas de telas ficam livres, inclusive Control Tower, Pendências, Painel de SLA, Mensagens e Notificações). O Personalizado grava só as exceções em `users.screenExceptions`; voltar ao padrão apaga. Um cadastro com a lista antiga aparece com as exceções calculadas e é gravado no formato novo ao salvar.
- As ações vêm só das funções: o Personalizado vale para as telas (a aba Ações da prévia é só leitura).
- Salvar fica na lista (sem recarregar), fecha o painel e mostra "Acessos de NOME salvos."; a lista é atualizada no lugar. "Excluir acesso" segue na página da pessoa (link no pé do painel).

**Aplicação das permissões**:

- Uma regra só (`screensFor`, `can`) para o menu lateral, os ícones do cabeçalho (mensagens e sino, quando a tela é permitida), o endereço direto (`requireScreen`), as Server Actions (`assertScreen`, `assertCan`) e a prévia do painel. Personalizado: as funções de agora com as exceções por cima. Administrador: tudo, sempre.
- Salvar uma função muda os acessos dos logins com ela na próxima requisição (o acesso é calculado a cada página e a cada ação no servidor), somando as várias funções do login e respeitando as exceções do Personalizado.
- Sessões abertas: o layout (menu e cabeçalho) não é refeito numa navegação comum do Next. O layout guarda o carimbo do acesso (`src/lib/auth/access-stamp.ts`); `AccessWatcher` confere `/api/access/stamp` a cada navegação, quando a aba volta ao foco e a cada minuto, e refaz a tela quando mudou. Concessões aparecem e revogações somem do menu e do cabeçalho sem recarregar; o endereço e o servidor já recusavam na hora.
- Tela controla a abertura; ação controla a execução. Abrir uma tela não concede as ações dela: "Ver valores e margem" (`canSeeMoney`) passou a depender só da ação (antes quem abria a tela Financeiro via os valores nas outras telas); o administrador continua vendo.
- **Testes**: `tests/unit/team-screens.test.ts` (módulos, prévia igual ao servidor, origem das permissões, Personalizado por exceções, função salva valendo para quem tem uma, duas funções, Personalizado e administrador, ação recusada no servidor e revogada com a sessão aberta, ações que saíram guardadas) e `tests/e2e/team-access.spec.ts` (menu ⋯, um Salvar para as duas abas, Designer com tela do Início e ação aplicadas no painel e no login, sessão aberta perdendo o sino e a faixa de valores sem recarregar, duas funções, Personalizado, administrador, e desktop, iPad e celular).

## Excluir acesso (pedido do dono, 13/11/2026)

Equipe e acessos → acessos de uma pessoa (`/app/team/[id]`), só para o administrador: botão **Excluir acesso** no topo, ao lado de "Voltar à equipe".

- **Confirmação**: a caixa mostra o nome e o login (e-mail ou nome de usuário) da pessoa e explica que ela perde o acesso à equipe Wellmix: não entra mais e, com o portal aberto, é desconectada na próxima tela; o histórico, os registros e a autoria continuam guardados. "Cancelar" fecha sem mudar nada.
- **Opções da confirmação** (pedido do dono, 14/11/2026; marcadas por padrão, aparecem só quando se aplicam):
  - **Passar quem responde a ela para o chefe dela**: cada subordinado direto passa a responder a quem ela respondia, pela mesma regra de "Responde a" (`setTeamMember`, com a Auditoria `team.member` de cada um); cargo e divisão de cada um ficam. Sem chefe ativo, a caixa não aparece e fica o aviso para escolher outro chefe depois. Cadastro antigo com ciclo: a pessoa do ciclo fica para ajustar à mão.
  - **Redistribuir as pendências abertas dela**: só as dela (solicitações abertas e pedidos em andamento), pela divisão da linha de cada produto, a mesma regra de "Distribuir agora" (`distributeUnassigned` com `fromUserId`; Auditoria `team.distribute` com o nome dela). As que não têm para quem ir (produto sem linha, linha sem divisão, divisão sem analista) ficam sem responsável e são contadas. As de outros logins sem responsável não são mexidas.
  - Desmarcada, aparece embaixo o que fazer depois. As opções rodam depois da exclusão gravada: se falharem, a exclusão fica e a lista mostra o que conferir (`delete_followup`).
- **O que faz**: o login fica inativo (`users.active = false`, exclusão lógica). Sai da lista da equipe, da escolha de chefe, da distribuição e dos avisos (todos leem só os ativos); a entrada recusa o login; a sessão já aberta cai na próxima requisição (no Supabase e no modo memória a sessão relê o login a cada página; no Appwrite, a sessão conferida em cache é esquecida na hora naquela instância e, nas outras, em no máximo 60 s).
- **Nada é apagado**: o cadastro do login, a Auditoria, o histórico, os registros com o id dele (dono de solicitação ou pedido, autor de mensagens, aprovações, documentos) e o chefe gravado de quem respondia a ele (sem a opção de passar para o chefe dela) ficam como estavam; as telas continuam mostrando o nome dele no que ele fez. As pendências abertas com ele contam como "sem responsável" em "Distribuir agora" (já era assim para login inativo).
- **Regras no servidor** (`removeTeamMember`, `src/lib/services/team.ts`): só o administrador (`forbidden`); só logins ativos da equipe Wellmix (`not_found` para parceiros e para quem já foi excluído); não exclui o próprio acesso (`delete_self`); não exclui o último administrador ativo (`delete_last_admin`), conferido antes e depois de gravar: se dois administradores se excluírem ao mesmo tempo, a exclusão que deixaria a equipe sem administrador é desfeita. Na tela, nesses dois casos o botão aparece desligado, com o motivo.
- **Auditoria**: `team.member.delete` (módulo Equipe) com quem excluiu, o acesso ("Acesso excluído: nome (login)"), a data e a hora, o antes (papel, cargo, chefe, divisão, funções, telas) e o depois (`active: false`). Se o registro na Auditoria não for gravado, a exclusão é desfeita e a tela mostra o erro: não há exclusão sem registro.
- **Depois**: volta à lista (`/app/team?saved=deleted`) com "Acesso excluído com sucesso" e, quando as opções foram usadas, o resumo: quantas pessoas passaram para quem, quantas pendências foram redistribuídas e, em amarelo, as que ficaram sem responsável. Com erro, volta à pessoa com o motivo; se ela já não estiver na equipe (excluída em outra aba), à lista com o aviso. A página de quem foi excluído não abre mais.
- **Uma equipe só**: o portal tem uma equipe (Wellmix); cada login é dela ou de um parceiro. A exclusão só mexe no login da equipe; logins de parceiros não passam por aqui.
- **Limite conhecido**: não há "reativar" na tela, e um login novo com o mesmo e-mail é recusado (`user_email_taken`), porque o cadastro inativo continua. Para voltar, hoje é preciso reativar no banco (`users.active = true`).
- Peças: `removeTeamMemberAction` (`src/app/app/actions/team.ts`), `teamMemberRemoval` (contagens e o chefe de destino da caixa), `forgetUserSessions` (`src/lib/auth/session.ts`), `QuickDialog` com `tone="danger"` e `disabled`. Textos `team.delete.*`, `team.saved.deleted`, `team.error.delete_self` e `team.error.delete_last_admin` nos três idiomas. Sem mudança no banco.
- Testes: `tests/unit/team-delete.test.ts` e `tests/e2e/team-delete.spec.ts`.

## Pendências por função (decisão do dono, 13/11/2026)

Em Pendências (`/app/tasks`) o **operador** vê só o que as funções dele fazem; o administrador vê tudo, como antes. Cada pendência aponta para uma ação ou tela de Equipe → Funções e acessos (`src/lib/task-owner.ts`):

| Pendência                                                                                                          | Quem (padrão)                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Fazer a arte, arte final, selo na arte (sem agência)                                                               | ação "art.design" (Designer)                                                        |
| Validar a arte, conferir o selo na arte                                                                            | ação "art.validate"                                                                 |
| Assinar o documento pela Wellmix                                                                                   | ação "contract.sign" (diretorias)                                                   |
| Enviar para assinatura, confirmar o pedido, nº no ERP, itens da linha, produção e inspeção, designar o despachante | ação "purchaseOrder.generate" (compras)                                             |
| Embarque, desembaraço, transporte e entrega                                                                        | tela Frete                                                                          |
| Numerário                                                                                                          | ação "numerario.manage"                                                             |
| Solicitação nova, revisão, sourcing                                                                                | telas Solicitações, Revisão, Sourcing                                               |
| Certificação (selo, validação do memorial, certificado)                                                            | despachante do pedido (a regra de "Quem recebe cada tarefa", docs/CERTIFICATION.md) |
| Itens do fornecedor e dos parceiros                                                                                | não aparecem para o operador                                                        |
| Mensagem a responder                                                                                               | o analista da conversa (sem analista: todos)                                        |

O painel de SLA e as outras telas continuam com a lista completa da Wellmix.

## Agência de arte por linha (decisão do dono, 13/11/2026)

Em Linhas de produto, cada linha pode ter a **agência de arte** (`product_lines.agencyId`, só agências ativas). O pedido novo herda a agência da linha (antes da regra "a única agência ativa"); ao salvar, os pedidos abertos da linha ainda sem agência a recebem, com o mesmo efeito da troca em Parceiros do pedido (`src/lib/services/line-agency.ts`).
