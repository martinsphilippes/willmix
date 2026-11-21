# Recon Wellmix: o que a equipe interna faz hoje no portal

Inventário para o treinamento em vídeo por papel. Cobre só a equipe interna da Wellmix: o administrador (`admin`) e o operador (`operator`) em cada função de `WELLMIX_FUNCTIONS`. Trabalho só de leitura: nada no repositório foi alterado.

## Como ler

- **Fonte de verdade.** A documentação (`docs/*.md`) define o escopo; o código confirma o que existe e dá os textos. Onde os dois divergem, o item está na seção D e não foi tratado como tarefa.
- **Textos de tela.** Todo rótulo entre aspas é o texto pt efetivo, tirado do dicionário já fundido (`src/i18n/dictionaries.ts` + `src/i18n/modules/*.ts`, 8.778 chaves), com a chave entre parênteses.
- **Menu e permissões.** O menu de cada função (A.4) foi calculado rodando `navFor`/`navFooterFor` (`src/lib/nav.ts`) e `defaultActionsFor` (`src/lib/auth/function-access.ts`) com o padrão do código. O administrador pode ter mudado telas e ações em Equipe e acessos → Funções e acessos (gravado em `settings.teamFunctions`): **o banco de produção não foi consultado**, então o que vale lá pode ser diferente do padrão.
- **⚠ não confirmado** marca o que não consegui confirmar no código ou em E2E.
- **Frequência, criticidade, complexidade e durações** são estimativas minhas, a partir do fluxo e dos prazos (SLA) configurados; não há dado de uso no repositório.
- **E2E** cita o arquivo e o teste que passam pela tarefa (`tests/e2e/*.spec.ts`). "Sem E2E" quer dizer que nenhum teste de ponta a ponta toca a ação (pode haver teste unitário; não conferi um a um).

## Contas e dados para gravar

| Conta | Papel | Observação |
| --- | --- | --- |
| `admin@wellmix.com` (Ana Admin) | admin | Abre tudo. |
| `operador@wellmix.com` (Otávio Operador) | operator, funções `buyer` + `planner` | Única conta de operador na demonstração. |
| `supplier.a@china.com`, `supplier.b@china.com`, `agencia@design.com`, `ocp@certifica.com`, `despachante@comex.com`, `armador@maritima.com`, `transportadora@rodo.com`, `comex@assessoria.com`, `agente@cargo.com`, `agencia@marketing.cn` | parceiros | Necessários para avançar o pedido até cada passo da Wellmix. |

- Senha de todas: `wellmix123` (`src/lib/demo-data.ts`). Em Configurações há o quadro "Contas de demonstração" com "Criar as contas que faltam" (`settings.demo.create`) e, no cabeçalho, o seletor "Conta de demonstração" (`nav.demo`) troca de login sem sair.
- **As outras sete funções não têm conta pronta** (Gerente de produto, Cadastro, Financeiro, Diretorias, Designer, Comex interno): crie em Equipe e acessos → "Novo usuário" (`team.newUser`) → "Criar login" (`team.new.submit`). Só o administrador cria.
- **Estado de dados.** O caminho inteiro está em `tests/e2e/happy-path.spec.ts` (teste "booking → seleção → solicitação ao fornecedor → produto → pedido de compra → raias → contrato → pagamento → inspeção → embarque → desembaraço → transporte → entrega") e os passos comuns em `tests/e2e/helpers.ts`: `importAndClose` (sobe a planilha e fecha o book), `selectAndOpenSupplierRequest` (agrupa, escolhe, grava e abre a solicitação), `fillMyRequirements` (preenche os itens de etapa do login). A planilha de book do teste tem as colunas de `BOOKING_HEADER` e um item (FOB, USD 1,25, 48 por caixa, MOQ 1000, 3.000 peças).
- As contas das linhas do tempo do teste leem em idiomas diferentes (o fornecedor A em chinês): para gravar em português, troque o idioma no seletor do cabeçalho.

---

## A. Matriz função × telas × ações (confirmada no código)

### A.1 Regras

1. **Administrador**: todas as telas e todas as ações, sempre (`screensFor`, `can`).
2. **Operador**: as telas do Início (`WELLMIX_BASE`: Control Tower, Pendências, Painel de SLA, Notificações, Mensagens) mais a união das telas das funções dele (`FUNCTION_SCREENS`). Ações: a união das ações das funções.
3. **Só do administrador por padrão** (`ADMIN_ONLY`): Financeiro, Contas a pagar, Conta corrente, Configurações, Equipe e acessos, Superplan. Nenhuma função de fábrica as libera; o administrador pode liberar por função ou login a login (Personalizado).
4. **Sem função**: o operador vê só o Início e o aviso "Seu login ainda não tem função nem tela liberada…" (`access.noFunction`).
5. **Tela controla a abertura; ação controla a execução.** Sem a tela, o item some do menu, o endereço volta ao início com "Você não tem acesso a {screen}. Peça ao administrador em Gestão → Equipe e divisões." (`access.denied`) e a Server Action recusa. Sem a ação, o botão some e o servidor recusa.
6. **Fora do menu de todos** (`MENU_HIDDEN`): `/app/requests`, `/app/explore`, `/app/sourcing`, `/app/marketing`, `/app/after-sales`, `/app/history`. Abrem pelo endereço para quem tem a tela.
7. **Só no cabeçalho** (`SIDEBAR_HIDDEN`): Mensagens e Notificações (ícones com contador, no alto à direita).

### A.2 Telas por função (padrão do código)

Legenda das colunas: CO = Comprador, GP = Gerente de produto, PL = Planner, CA = Cadastro, FI = Financeiro, DC = Diretoria de compras, DE = Diretoria executiva, DS = Designer, CX = Comex (interno).

| Tela (chave) | O que abre | CO | GP | PL | CA | FI | DC | DE | DS | CX |
| --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Início (`home`, `tasks`, `sla`, `notifications`, `messages`) | Control Tower, Pendências (e Mesa de trabalho), Painel de SLA, Notificações, Mensagens | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `booking` | Bloco Produto novo: Overview, Books, Seleção de itens, convite de book | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | |
| `quotes` | Cotações (convites de book) e Negociações (solicitações ao fornecedor) | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| `orders` | Bloco Pedido (menos Revisão), detalhe do pedido e as telas dele (Die Cut, documento, amostras, fotos reais, documentos do embarque) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reviews` | Pedido → Revisão | ✓ | ✓ | | ✓ | | ✓ | ✓ | | |
| `production` | Bloco Produção (Overview e os nove passos) | ✓ | | ✓ | | | ✓ | ✓ | | |
| `containers` | Bloco Entrega (Overview, os oito passos e Containers) | ✓ | | ✓ | | | ✓ | ✓ | | ✓ |
| `freight` | Entrega → Fretes | ✓ | | ✓ | | | ✓ | ✓ | | ✓ |
| `freightTariff` | Entrega → Tarifário de frete | ✓ | | ✓ | | | ✓ | ✓ | | |
| `products` | Cadastros → Produtos e o bloco Vendas (Estoque, Amostras, Ofertas, Venda) | ✓ | ✓ | | ✓ | | ✓ | ✓ | ✓ | |
| `lines` | Cadastros → Linhas | | ✓ | | ✓ | | ✓ | ✓ | | |
| `parties` | Cadastros → Parceiros (e Clientes, Fornecedores, avaliação) | ✓ | | | ✓ | | ✓ | ✓ | | |
| `import` | Importar planilha (`/app/import`, sem item no menu) | | | | ✓ | | ✓ | ✓ | | |
| `dashboards` | Painéis → Painéis por área | | | ✓ | | | ✓ | ✓ | | |
| `penalties` | Financeiro → Multas | | | | | | ✓ | ✓ | | |
| `audit` | Rodapé → Auditoria | | | | | | ✓ | ✓ | | |
| `requests` (fora do menu) | Solicitações do cliente | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| `sourcing` (fora do menu) | Sourcing (em espera) | ✓ | ✓ | | ✓ | | ✓ | ✓ | | |
| `afterSales` (fora do menu) | Pós-venda | ✓ | ✓ | | | | ✓ | ✓ | | |
| `marketing` (fora do menu) | Marketing (kits, tabela de preços) | | ✓ | | | | ✓ | ✓ | ✓ | |
| `explore` (fora do menu) | Vitrine do cliente | | ✓ | | ✓ | | ✓ | ✓ | ✓ | |
| `history` (fora do menu) | Histórico | ✓ | ✓ | ✓ | | | ✓ | ✓ | | ✓ |
| `finance`, `payables`, `account`, `settings`, `team`, `superplan` | Financeiro, Contas a pagar, Fluxo de caixa, Acordos e comissões, Painel do dono, Conta corrente, Configurações, Equipe e acessos, Superplan | só admin | | | | | | | | |

### A.3 Ações por função (padrão do código, `defaultHolders`)

| Ação (rótulo pt, chave) | CO | GP | PL | CA | FI | DC | DE | DS | CX |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| "Decidir a solicitação ao fornecedor" (`supplierRequest.decide`) | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| "Validar a amostragem" (`sampling.validate`) | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| "Gerar pedido de compra" (`purchaseOrder.generate`) | ✓ | ✓ | ✓ | | | ✓ | ✓ | | |
| "Receber o aviso de pedido de compra (Vendas)" (`purchaseOrder.salesNotice`) | ✓ | ✓ | | | | ✓ | ✓ | | |
| "Validar a arte" (`art.validate`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| "Fazer as artes (designer)" (`art.design`) | | | | | | | | ✓ | |
| "Aprovar as fotos e vídeos reais (troca as fotos e ativa a venda)" (`realMedia.approve`) | | | | | | | | ✓ | |
| "Assinar o contrato pela Wellmix" (`contract.sign`) | | | | | | ✓ | ✓ | | |
| "Cancelar pedido" (`order.cancel`) | só admin | | | | | | | | |
| "Numerário e financeiro do pedido" (`numerario.manage`) | | | | | ✓ | | | | |
| "Acompanhar o recebimento" (`receiving.follow`) | ✓ | | | | | | | | |
| "Rastrear o container (todo dia)" (`container.tracking`) | | | | | | | | | ✓ |
| "Ver valores e margem" (`values.view`) | só admin | | | | | | | | |

- **Ações que saíram** (`RETIRED_ACTIONS`, `src/lib/auth/permission-modules.ts`): "Liberar dumping" e as três "Aprovar o pré-custo". Continuam gravadas na função, não aparecem para marcar e nada as confere.
- **Só o papel admin** (conferido com `assertRole(["admin"])`, fora do catálogo de ações): registrar e confirmar pagamentos (cliente e fornecedor), acerto financeiro do cancelamento, Configurações, tudo de Equipe e acessos, tipos de parceiro e Acessos externos, abrir/aprovar/fechar inventário, aplicar o frete por m³, acordos e comissões, limpar dados, go-live.

### A.4 Menu real de cada função (rótulos pt, na ordem da tela)

Blocos completos, para referência:

- **Produto novo** (`nav.group.newProduct`): Overview · Books · Seleção de itens · Cotações · Negociações
- **Pedido** (`nav.group.order`): Overview · Pedidos · Certificação · Material de arte · Arte · Revisão · Contrato
- **Produção** (`nav.production`): Overview · Pré-produção · Inspeção · Amostra · Produção · Booking · Logística · Carregamento · Documentos de carga · Embarque
- **Entrega** (`nav.group.arrival`): Overview · LPCO · Presença de carga · Canal cinza ou vermelho · Logística · Nota fiscal · Entrega · Retorno · Armazenagem · Containers · Fretes · Tarifário de frete
- **Vendas** (`nav.group.sales`): Estoque · Amostras · Ofertas · Venda
- **Financeiro** (`nav.group.finance`): Financeiro · Contas a pagar · Fluxo de caixa · Acordos e comissões · Multas
- **Painéis** (`nav.group.panels`): Painel do dono · Painéis por área · Painel de SLA
- **Cadastros** (`nav.group.registry`): Parceiros · Produtos · Linhas
- **Rodapé**: Configurações · Equipe e acessos · Auditoria

Grupo com um item só vira link direto (sem o nome do grupo); grupo vazio some.

| Login | Menu lateral |
| --- | --- |
| **Administrador** | Control Tower · Pendências · todos os blocos acima, completos · rodapé completo |
| **Comprador** | Control Tower · Pendências · Produto novo (completo) · Pedido (completo) · Produção (completo) · Entrega (completo) · Vendas (completo) · "Painel de SLA" (link solto) · Cadastros: Parceiros, Produtos |
| **Gerente de produto** | Control Tower · Pendências · Produto novo (completo) · Pedido (completo) · Vendas (completo) · "Painel de SLA" · Cadastros: Produtos, Linhas |
| **Planner** | Control Tower · Pendências · Produto novo (completo) · Pedido **sem Revisão** · Produção (completo) · Entrega (completo) · Painéis: Painéis por área, Painel de SLA |
| **Cadastro** | Control Tower · Pendências · Produto novo: Overview, Books, Seleção de itens (**sem Cotações e Negociações**) · Pedido (completo) · Vendas (completo) · "Painel de SLA" · Cadastros: Parceiros, Produtos, Linhas |
| **Financeiro** | Control Tower · Pendências · Pedido **sem Revisão** · "Painel de SLA" |
| **Diretoria de compras** e **Diretoria executiva** (idênticas) | Control Tower · Pendências · Produto novo, Pedido, Produção, Entrega, Vendas (completos) · "Multas" (link solto) · Painéis: Painéis por área, Painel de SLA · Cadastros: Parceiros, Produtos, Linhas · rodapé: Auditoria |
| **Designer** | Control Tower · Pendências · Pedido **sem Revisão** · Vendas (completo) · "Painel de SLA" · "Produtos" (link solto) |
| **Comex (interno)** | Control Tower · Pendências · Pedido **sem Revisão** · Entrega **sem Tarifário de frete** · "Painel de SLA" |
| **Operador de demonstração** (Comprador + Planner) | Menu do Comprador + Painéis: Painéis por área, Painel de SLA |
| **Operador sem função** | Control Tower · Pendências · Painel de SLA |

Mensagens e Notificações ficam nos ícones do cabeçalho para todos. No menu do usuário: "Trocar senha" (`password.menu`) e "Sair" (`nav.logout`).

### A.5 Rótulo do menu × título da tela (para a narração)

O item do menu e o título da página nem sempre usam a mesma palavra:

| Menu | Rota | Título na tela (chave) |
| --- | --- | --- |
| Pendências | `/app/tasks` | "Minhas pendências" (`tasks.title`) |
| Books | `/app/booking` | "Book" (`bookingLots.title`) |
| Cotações | `/app/supplier-requests/invites` | "Convites de book" (`bookingInvites.list.title`) |
| Negociações | `/app/supplier-requests` | "Solicitações ao fornecedor" (`supplierRequests.list.title`) |
| Revisão | `/app/reviews` | "Itens para revisão" (`reviews.title`) |
| Produção → Overview | `/app/production` | "Produção" |
| Fretes | `/app/freight` | "Cotações de frete" (`freight.title`) |
| Acordos e comissões | `/app/commissions` | "Acordos comerciais e comissões" (`commission.title`) |
| Linhas | `/app/lines` | "Linhas de produto" (`lines.title`) |
| Equipe e acessos | `/app/team` | "Equipe e divisões" (`team.title`) |

### A.6 O que cai em Pendências para cada operador (`src/lib/task-owner.ts`)

O administrador vê todas as pendências da Wellmix. O operador vê só as que passam pela ação ou tela abaixo:

| Pendência | Passa quem tem | Funções no padrão |
| --- | --- | --- |
| Fazer a arte, arte final com o selo, aplicar o selo na arte | ação `art.design` (e ser o designer do pedido) | Designer |
| Validar a arte, conferir o selo na arte, conferir a correção da arte | ação `art.validate` (e ser o responsável do pedido) | todas |
| Assinar o documento pela Wellmix | ação `contract.sign` | Diretorias |
| Definir o pedido de amostras; "Validar amostragem" | ação `sampling.validate` | CO, GP, PL, DC, DE |
| "Responder"/decidir a solicitação ao fornecedor | ação `supplierRequest.decide` | CO, GP, PL, DC, DE |
| Confirmar o pedido, nº no ERP, itens da linha, enviar para assinatura, follow da produção, inspecionar SKU, designar o despachante | ação `purchaseOrder.generate` | CO, GP, PL, DC, DE |
| NCM validado e ficha mestre completa | tela `lines` | GP, CA, DC, DE |
| Passos de embarque, origem, desembaraço, transporte e entrega; o rastreio do container (este, só para quem tem `container.tracking`) | tela `freight` | CO, PL, DC, DE, CX |
| Numerário (validar e pagar); "Registrar faturamento" | ação `numerario.manage` | Financeiro |
| Revisão | tela `reviews` | CO, GP, CA, DC, DE |
| Solicitação nova (cliente) | tela `requests` | CO, GP, PL, DC, DE |
| "Confirmar recebimento", "Convites de book", "Classificar NCM", "Frete", "Fotos reais" (aprovar: quem tem `realMedia.approve`) | sem filtro por função em `kindGate` (aparecem para o operador que a rotina de origem alcançar) | ⚠ alcance por função não confirmado |
| Sinal ao fornecedor, pagamento ao fornecedor, programação de compra na ficha de compra, e os passos da certificação que sobram para a Wellmix (menos vincular a certificadora e o selo na arte) | só o administrador | — |
| Mensagem a responder | o último login da Wellmix que escreveu no assunto (sem ninguém: todos) | — |

Os contadores do menu (a bolinha de cada passo, vermelha com atraso) contam essas mesmas pendências, mais os "casos do menu" que não são pendência: Pré-produção, Armazenagem, Retorno, Vendas → Amostras e Ofertas (`docs/FLOW_MENU.md`).

---
## B. Tarefas por bloco do menu

Cada tarefa tem um código (T01…) usado na seção C. "Quem" traz o padrão do código; **(só admin)** marca o que nenhuma função faz. Caminho de dados: salvo indicação, é o do teste principal de `tests/e2e/happy-path.spec.ts`.

### B.0 Início (todas as funções)

#### T01 · Entrar, primeiro acesso e trocar a senha
- **Quem:** todos.
- **Quando e por quê:** primeiro acesso com senha provisória; troca de senha quando quiser.
- **Frequência · criticidade:** rara · média.
- **Rotas:** `/login`, `/app/password`.
- **Pré-condição:** login criado em Equipe e acessos com "Pedir para trocar a senha no primeiro acesso" (`team.new.mustChange`) marcado.
- **Passos:** em `/login`, "E-mail" e "Senha" → "Entrar" (`login.submit`); o seletor de idioma (globo) fica na própria tela. No primeiro acesso aparece "Primeiro acesso: escolha a sua senha" (`password.first.title`): "Senha provisória (a que você recebeu)", "Senha nova", "Repita a senha nova" → "Salvar senha nova" (`password.submit`), ou "Continuar sem trocar a senha" (`password.first.skip`). Depois: menu da conta → "Trocar senha" (`password.menu`).
- **Depois:** "Senha trocada. Use a senha nova no próximo acesso." (`password.saved`). Pular fica na Auditoria (`user.password_change_skipped`).
- **Erros:** regra da senha: "Pelo menos {min} caracteres, diferente da senha atual." (`password.rule`); "Não foi possível trocar a senha agora. Tente de novo." (`password.error.failed`).
- **Regras:** o bloqueio do primeiro acesso é só da tela (docs/ACCESS.md, "Limite conhecido").
- **E2E:** `first-access.spec.ts` ("primeiro acesso: seguir sem trocar a senha provisória").
- **Complexidade:** baixa.

#### T02 · Ler a Control Tower
- **Quem:** todos (o conteúdo muda com as telas e ações do login).
- **Quando e por quê:** abrir o dia; ver o que precisa de ação e onde cada book, solicitação e pedido está.
- **Frequência · criticidade:** diária · média.
- **Rota:** `/app`.
- **Pré-condição:** qualquer dado; com o resumo dos pedidos reconstruído (Configurações → "Resumos dos pedidos") a tela lê mais rápido.
- **Passos:** título "Control Tower" (`ct.title`). Quadros: "Precisa de ação agora" (`tower.action.title`, "Só o que o seu perfil consegue resolver e que está pendente agora."), "Processo por etapa" (`tower.stages.title`) com as nove etapas: Book, Solicitação ao fornecedor, Preparação, arte e certificação, Contrato e assinaturas, Produção e inspeção, Embarque e mar, Porto e alfândega, Entrega, Encerrado (`tower.stage.*`); "Visões gerais" (`board.general`) e "Exceções" (`ct.exceptions`). Cartões de contagem: "Pedidos ativos", "Em preparação", "Em inspeção", "Em embarque", "Em desembaraço", "Em transporte", "Atrasados", "Com problema", "Concluídos" (`ct.*`). Cada linha tem "Abrir" (`tasks.open`).
- **Depois:** só leitura; cada número leva à tela onde se age.
- **Erros:** login sem a tela Control Tower é levado à primeira tela do menu que abre; lista longa: "Mostrando os {shown} primeiros de {total}. Use Pedidos para ver e filtrar todos." (`ct.list.more`).
- **Regras:** a faixa "Financeiro" (Vendido, Recebido, A receber, Comprado (FOB), Pago ao fornecedor, Saldo a pagar) e os valores em R$ só aparecem com a ação "Ver valores e margem" (só admin no padrão). Pedido importado do Sankhya aparece com o selo "Sankhya" ("Importado do Sankhya: só visibilidade, ainda sem fluxo no portal.", `tower.origin.sankhyaHint`).
- **E2E:** happy-path (passo 13, `/app?filter=closed`); `team-access.spec.ts` (faixa de valores some/aparece com a ação); `home-screens.spec.ts`.
- **Complexidade:** média (muita informação numa tela).

#### T03 · Trabalhar pelas Pendências e pela Mesa de trabalho
- **Quem:** todos; o operador vê só as pendências das funções dele (A.6).
- **Quando e por quê:** é a fila de trabalho do dia.
- **Frequência · criticidade:** diária · alta.
- **Rotas:** `/app/tasks`, `/app/tasks/desk?desk=gp|cadastro|mkt`.
- **Pré-condição:** qualquer pedido de compra aberto gera pendências (happy-path, depois do passo 5).
- **Passos:** "Minhas pendências" (`tasks.title`): colunas "Pendência", "Detalhe", "Prazo", botão "Abrir" (`tasks.open`); filtros "Prazo" e "Tipo" (`tasks.filter.due`, `tasks.filter.type`), "Limpar filtros". Aviso "Ordenadas pelo prazo: as mais urgentes primeiro." (`tasks.sortHint`). Link "Mesa de trabalho" (`desk.link`): mesas "Gerente de produto" (filas "Amostras a avaliar", "Certificados pendentes nos pedidos"), "Cadastro e fiscal" ("NCM a validar", "Fichas mestre incompletas", "Certificações a vencer", "Falhas do Sankhya (7 dias)"), "Marketing" ("Artes a validar", "Produtos fora da vitrine"); colunas "Item", "Pedido", "Prazo", "Abrir"; volta por "← Minhas pendências".
- **Depois:** "Abrir" leva ao ponto do pedido, da solicitação ou do passo onde se resolve; a pendência some quando o item é feito.
- **Erros:** lista vazia: "Nenhuma pendência. Bom trabalho." (`tasks.empty`); mesa vazia: "Nada esperando aqui." (`desk.empty`).
- **Regras:** a Wellmix vê todas as mesas e abre na da função (Cadastro → cadastro, Designer → marketing, Gerente de produto → GP; `defaultDesk`). Só leitura. Arte, validação, certificado e arte final aparecem só para o login que recebe cada uma (o admin vê todas).
- **E2E:** happy-path (passo 5b: `/app/tasks` → `[data-desk-link]` → `?desk=cadastro`, fila NCM).
- **Complexidade:** baixa.

#### T04 · Acompanhar prazos no Painel de SLA
- **Quem:** todos (cada um vê o próprio painel; quem tem equipe vê os subordinados; o admin vê todos e "Sem responsável").
- **Frequência · criticidade:** diária para chefias, semanal para analistas · média.
- **Rota:** `/app/sla`.
- **Pré-condição:** cargo, divisão e "Responde a" definidos em Equipe e acessos; divisão em cada linha de produto. Sem isso: "Você ainda não tem divisão, por isso o painel está vazio…" (`sla.noPortfolio`).
- **Passos:** "Painel de SLA" (`sla.title`). Tabela "Equipe" (Pessoa, Cargo, Divisão, Atrasadas, Vencem hoje, Próx. 7 dias, Parceiros atrasados, Etapas no prazo (30 dias)). Cartões que filtram: "Atrasadas", "Vencem hoje", "Próximos 7 dias", "Depois e sem prazo", "Atrasos de parceiros (cobrar)" e "Etapas no prazo (30 dias)"; "Toque num cartão para ver só aquele grupo embaixo." (`sla.show.hint`). Linha: Pendência, Detalhe, Aguardando, Prazo, "Abrir".
- **Regras:** só leitura. O dono da pendência é automático: divisão da linha do produto → analista da divisão com menos pendências.
- **E2E:** `team-access.spec.ts` (o item some e o endereço recusa quando a tela é desmarcada na função).
- **Complexidade:** média.

#### T05 · Mensagens e notificações
- **Quem:** todos.
- **Frequência · criticidade:** diária · média.
- **Rotas:** `/app/messages`, `/app/messages/control`, `/app/notifications` (ícones do cabeçalho).
- **Passos (Mensagens):** "Nova conversa" (`messages.new`) → "Empresa" → "Abrir conversa"; escrever em "Mensagem" → "Enviar"; "Assuntos"; "Escreva no seu idioma: a mensagem é traduzida automaticamente para quem recebe." (`messages.tr.hint`). "Controladoria" (`msgctl.link`): "Controladoria de mensagens", cartões "Com a Wellmix", "Atrasadas (Wellmix)", "Com a empresa", "No prazo (30 dias)", "Tempo médio de resposta"; filtros "Empresa", "Produto", "Todos"/"Só os meus"; "Baixar CSV".
- **Passos (Notificações):** "Marcar todas como lidas", "Excluir todas", "Ocultar as lidas"/"Mostrar as lidas ({n})"; cada aviso com "Resolver" (`notif.open.action`) ou "Abrir" e "Agora é com você" / "Agora é com a Wellmix".
- **Depois:** assunto com a bola na Wellmix vira a pendência "Responder mensagem" com prazo de 1 dia útil.
- **Erros:** "Escreva a mensagem antes de enviar." (`messages.error.message_empty`); "Você não tem acesso a esta conversa." (`messages.error.forbidden`).
- **Regras:** e-mail e WhatsApp estão em modo mock (o aviso real é o sino do portal).
- **E2E:** `home-screens.spec.ts` ("Mensagens e Notificações ficam só nos ícones do cabeçalho"); `search-pickers.spec.ts` (destinatário pela busca).
- **Complexidade:** baixa.

### B.1 Produto novo

Sequência do bloco: Books → Seleção de itens → (Cotações) → Negociações → produto → pedido de compra.

#### T06 · Ler o Overview de um bloco
- **Quem:** quem abre o bloco (Produto novo: tela `booking`; Pedido: `orders`; Produção: `production`; Entrega: `containers`).
- **Frequência · criticidade:** diária · média.
- **Rotas:** `/app/flow/new-product`, `/app/flow/order`, `/app/production`, `/app/flow/delivery`.
- **Passos:** indicadores no topo ("Books e solicitações" ou "Pedidos no bloco", "Atrasados no bloco", "Completude média do bloco", "Completude geral média", "Pendências"; `flow.kpi.*`); "Linha do tempo geral" (`flow.general.title`) com os quatro blocos; à esquerda os passos ("Todos os passos", "{n} no passo", "{n} atrasada(s)"); à direita a tabela (Pedido ou "Book ou solicitação", Fornecedor, Passos, Etapa do pedido, "No passo há", Atraso, "% do bloco", "% geral"); "Abrir a tela do passo" (`flow.overview.openStep`).
- **Tela do passo (igual em todos os passos):** abas "Pendências" e "Todos no passo" (`flow.tab.*`); "Filtrar por prazo"; colunas "O que espera", "Prazo", "Há", botão "Resolver" (`flow.cases.open`); embaixo "Resolver aqui" (`flow.work.title`) com o cartão do pedido e "Abrir o pedido completo"; "Voltar ao Overview de {block}".
- **Regras:** só leitura no Overview. "Histórico em espera" são os pedidos da carga do Sankhya, fora das linhas e dos atrasos até o go-live.
- **E2E:** happy-path (Overview do Produto novo e do Pedido; aba "Todos no passo" em Pedido → Arte); `production-screen.spec.ts`.
- **Complexidade:** média. **Gravar uma vez** para todas as trilhas.

#### T07 · Importar um book (planilha do fornecedor)
- **Quem:** CO, GP, PL, CA, DC, DE, admin (tela `booking`).
- **Quando e por quê:** chegou a planilha de um fornecedor; é a entrada de todo produto novo.
- **Frequência · criticidade:** semanal (por planilha recebida) · alta.
- **Rotas:** `/app/booking` → `/app/booking/import` → `/app/booking/lots/[id]`.
- **Pré-condição:** planilha .xlsx/.xls com o cabeçalho do modelo (até 80 itens). E2E: `bookingSheet()` em `helpers.ts`.
- **Passos:** Books → "Importar book" (`bookingLots.import`) → "Planilha do book": "Arquivo" ("Excel (.xlsx ou .xls), até 80 itens."), "Ou o link de uma planilha do Google Sheets", "Moeda quando a planilha não diz" → "Importar book" (`bookingLots.import.submit`).
- **Depois:** abre o "Book nº {n}" em **Rascunho**, com "Book carregado com {n} itens. Confira o fornecedor e a data, que vieram da planilha, e complete os itens." Nenhum produto é criado. Itens sem NCM parecido vão para o despachante (aviso a ele).
- **Erros:** "Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo." (`sheetImport.error.no_header`); "Muitos produtos de uma vez (máximo 80 por planilha): divida a planilha." (`sheetImport.error.too_many`); link do Google sem compartilhamento: `sheetImport.error.sheet_private`.
- **Regras:** um fornecedor por book; colunas desconhecidas ficam guardadas e não aparecem; linhas iguais que só mudam a cor viram um item.
- **E2E:** happy-path, `booking-supplier-request.spec.ts`, `booking-invite.spec.ts` (todos via `importAndClose`).
- **Complexidade:** baixa.

#### T08 · Conferir, completar e fechar o book (com o NCM)
- **Quem:** tela `booking` (CO, GP, PL, CA, DC, DE, admin).
- **Quando e por quê:** logo depois de importar; sem fechar, os itens não podem ser escolhidos e não há análise do Superplan.
- **Frequência · criticidade:** por book · alta.
- **Rota:** `/app/booking/lots/[id]`.
- **Pré-condição:** book em Rascunho (T07).
- **Passos:** quadro "Dados do book" (`bookingLots.detail.header`): "Fornecedor" (para quem vão as solicitações; "Vazio: vão para a fábrica."), "Fábrica", "Origem", "Data", "Status", "Planilha", "Responsável", "Observação" → "Salvar observação". Se a fábrica da planilha não existe: "Fornecedor da planilha sem cadastro" → "Cadastrar e usar neste book". Tabela "Itens ({n})": "Cada campo grava sozinho ao sair dele (ou no Enter). * obrigatório para fechar."; coluna "NCM" com "Sugestões", "Recomendado" e "Preencher com o recomendado"; "Estimar o NCM de novo". Quadro "Fechar o book": "Tipo de negócio do Superplan" → "Fechar e analisar" (`bookingLots.detail.close.submit`).
- **Depois:** status **Fechado**; "Book fechado. O Superplan analisou todos os itens."; cada item ganha a coluna "Superplan" com o sinal, "Mínimo {price}", "Lucro {pct}%" e, se faltou dado, "Faltou: {list}". Os itens passam a poder ser escolhidos na Seleção.
- **Erros:** "Há itens com campos obrigatórios vazios. Complete os campos marcados em cada item e feche de novo." (`booking_items_incomplete`), com a lista "{n} item(ns) incompleto(s). Toque num campo para ir até ele na tabela:"; "Escolha o fornecedor do book (ou cadastre o da planilha) antes de fechar." (`supplier_required`); "Esse NCM não está na tabela fiscal carregada." (`booking_ncm_not_in_table`).
- **Regras:** NCM obrigatório para fechar; o tamanho ("8X10") vale como capacidade; fornecedor sem login gera o aviso "Fornecedor do Book sem acesso ao portal: não consegue ver nem responder." com "Criar acesso" (só para quem abre Parceiros).
- **E2E:** `importAndClose` (helpers); `booking-pending-list.spec.ts` ("Book: a lista de pendências do fechamento leva a cada campo e se atualiza").
- **Complexidade:** média.

#### T09 · Mudar o status, refazer a análise e trocar o responsável do book
- **Quem:** tela `booking`.
- **Frequência · criticidade:** rara · baixa.
- **Rota:** `/app/booking/lots/[id]`.
- **Passos:** "Mudar status" → "Novo status" → "Mudar" (Rascunho, Fechado, Em andamento, Concluído, Cancelado); "Refazer a análise" (book fechado, quando câmbio ou parâmetros mudaram); trocar o "Fornecedor" (responsável) no quadro de dados; o NCM continua editável depois de fechado ("O NCM continua editável: ao trocar, a análise do Superplan do item é refeita.").
- **Erros:** "Esse status não pode vir depois do atual." (`booking_lot_move_invalid`); "Este book não está mais em rascunho: os dados não mudam." (`booking_lot_locked`).
- **Regras:** transições em `bookingLotMoves`; abrir uma solicitação passa o book de Fechado para Em andamento sozinho.
- **E2E:** sem E2E para a troca de status à mão.
- **Complexidade:** baixa. **Avançado.**

#### T10 · Seleção de itens: buscar, agrupar e comparar
- **Quem:** tela `booking`.
- **Quando e por quê:** com vários books fechados, juntar itens parecidos de fornecedores diferentes e comparar pelo custo por peça.
- **Frequência · criticidade:** semanal · alta.
- **Rota:** `/app/booking/selection` (abas `?tab=items|selection|blocks|requested`).
- **Pré-condição:** dois books fechados com itens parecidos (happy-path passo 1).
- **Passos:** abas "Itens", "Seleção", "Blocos Sugeridos", "Com Solicitação Aberta" (`supplierRequests.selection.tab.*`). Em Itens: "Buscar em qualquer campo (descrição, código, material, fornecedor, origem…)", filtros "Status", "Período do book", "Fornecedor", "Origem" → "Filtrar"; caixa "Agrupar" por linha ou "Marcar todos os da tela"; "ver parecidos"; cesta "{n} itens marcados" → "Agrupar para seleção" (`…basket.group`). Em Blocos Sugeridos: "Comparar e selecionar" (`…blocks.open`). Na aba Seleção, o selo "Menor custo por peça" marca o item mais barato.
- **Depois:** o grupo abre na aba Seleção para a escolha (T11).
- **Erros:** "Nenhum book fechado ainda. Feche um book para os itens dele aparecerem aqui." (`…noItems`); item de rascunho: "Feche o book para abrir a solicitação deste item" (`…draftHint`); "Até {max} itens por grupo".
- **Regras:** os números do Superplan são o retrato gravado ao fechar o book; o destaque é pelo custo por peça, não pelo preço mínimo. Até 60 itens por grupo, 200 por tela.
- **E2E:** `booking-selection.spec.ts` ("seleção: rascunho, filtros, período, cesta, agrupar e blocos"); helpers `selectAndOpenSupplierRequest`.
- **Complexidade:** média.

#### T11 · Gravar a escolha do grupo (quantidade, programação de compra, cores)
- **Quem:** tela `booking`.
- **Quando e por quê:** decidir o item vencedor do grupo e quanto comprar, antes de falar com o fornecedor.
- **Frequência · criticidade:** por grupo comparado · alta.
- **Rota:** `/app/booking/selection?tab=selection&ids=…`.
- **Pré-condição:** grupo aberto (T10), com o vencedor em book fechado.
- **Passos:** na tabela, botão "Escolher" (`colors.choose`), que vira "Escolhido" (`colors.chosen`); barra "{n} outros itens recolhidos" com "Rever opções" (`colors.review`). Cartão "Gravar a escolha do grupo": "Total de caixas" e "Quantidade (peças)" (um calcula o outro pela caixa master); "O que a Wellmix precisa no produto" ("Cor, embalagem, logo, ajuste… O fornecedor lê este texto."). Opcional: "Comprar em programações nos próximos meses?" → "Programação de compra": "Intervalo entre programações", "Data da 1ª programação", "Programações", "Container", "Gerar programação", e em cada programação "+ Aumentar"/"− Diminuir"; "Sem programação (pedido único)". Com cores no book: card "Variações" (incluir/tirar cor, "Caixas" por cor, "Dividir igualmente") e a prévia "Composição por cor". → "Gravar escolha" (`…form.submit`).
- **Depois:** "Escolha gravada. O grupo aparece abaixo como resolvido, com o item escolhido em verde. Nada foi enviado ao fornecedor ainda."; a tela vai para Blocos Sugeridos.
- **Erros:** "Selecione um item na tabela para gerar a programação de compra" (`purchaseRounds.gen.selectItem`); "A quantidade não fecha caixas master inteiras para dividir entre as cores…" (`selection_colors_cartons`); "A planilha não traz quantidade para este item: digite a quantidade." (`supplier_request_qty_required`).
- **Regras:** quantidade em branco = a da planilha; com programação, a quantidade é a soma das programações (até 12); container conta como cheio a partir de 95%; gravar de novo um grupo com item em comum troca a escolha anterior.
- **E2E:** `booking-selection.spec.ts`; `selection-colors.spec.ts` ("vencedor, variações de cor e composição por data até a solicitação"); `booking-supplier-request.spec.ts` (quantidade em caixas).
- **Complexidade:** alta (programação e cores).

#### T12 · Gerar as referências por IA para o fornecedor (opcional)
- **Quem:** tela `booking`.
- **Frequência · criticidade:** rara · baixa.
- **Rota:** mesma da T11, painel "Prompts de IA para o fornecedor" (`aiRefs.panel.title`).
- **Pré-condição:** `OPENAI_API_KEY` no servidor e IA em AUTO (Configurações mostra "OPENAI_API_KEY configurada" ou "Sem OPENAI_API_KEY"); em MOCK sai "Exemplo mock".
- **Passos:** três prompts ("Imagem 1: produto final", "Imagem 2: detalhes e embalagem", "Arquivo: ficha para o fornecedor") → "Gravar e gerar com IA" (`aiRefs.panel.generate`; "Gerando (1 a 2 minutos)…").
- **Depois:** "{n} arquivo(s) gerado(s) com IA. Eles vão para a solicitação quando ela abrir."; o fornecedor vê "Referências geradas por IA".
- **Erros:** "A OpenAI não respondeu. Tente de novo; a escolha foi gravada." (`aiRefs.error.openai_failed`).
- **E2E:** sem E2E com a OpenAI real (⚠ o comportamento com a chave de produção não foi confirmado).
- **Complexidade:** média. **Avançado.**

#### T13 · Abrir a solicitação ao fornecedor
- **Quem:** tela `booking` para abrir; para **ver** a solicitação aberta é preciso a tela `quotes` (CO, GP, PL, DC, DE, admin). Ver E.1 sobre o Cadastro.
- **Quando e por quê:** enviar ao fornecedor (o responsável pelo book) o item escolhido e o que a Wellmix precisa.
- **Frequência · criticidade:** por grupo resolvido · alta.
- **Rota:** `/app/booking/selection?tab=blocks`.
- **Pré-condição:** grupo resolvido (T11); fornecedor com login (senão ninguém responde).
- **Passos:** em Blocos Sugeridos, "Grupos resolvidos esperando a solicitação: {n}. Vai ao fornecedor só o item escolhido de cada um." → "Abrir solicitação dos marcados" ou "Abrir solicitação de todos ({n})" (`…open.marked`, `…open.all`); "Rever a escolha" reabre o grupo.
- **Depois:** uma solicitação por fornecedor (vários produtos viram 2.1, 2.2…); o fornecedor é avisado; o book passa a Em andamento; o grupo vai para a aba "Com Solicitação Aberta" com o link "Solicitação nº {n} aberta". Com uma solicitação só, a tela vai direto a ela: "Solicitação aberta. O fornecedor foi avisado e responde no portal."
- **Erros:** "Este item já tem uma solicitação em andamento. Abra a que existe." (`supplier_request_exists`); "O book deste item não está fechado. Feche o book antes de abrir a solicitação." (`supplier_request_lot_not_closed`); aviso "Fornecedor sem acesso ao portal: ele não vê nem responde esta solicitação." (`supplierRequests.noLogin.request`).
- **Regras:** os outros itens do grupo vão como alternativas, que só a Wellmix vê.
- **E2E:** happy-path passo 2; `booking-supplier-request.spec.ts`.
- **Complexidade:** baixa.

#### T14 · Abrir cotação: convidar parceiros para um book concorrente
- **Quem:** tela `booking` para convidar; a lista de convites (menu "Cotações") pede a tela `quotes`.
- **Quando e por quê:** quer mais fornecedores para o mesmo item antes de escolher.
- **Frequência · criticidade:** rara a semanal · média.
- **Rotas:** `/app/booking/selection` (aba Itens) → `/app/booking/invite/[itemId]`; acompanhamento em `/app/supplier-requests/invites`.
- **Pré-condição:** um item de book (E2E: `booking-invite.spec.ts`).
- **Passos:** no item, "Abrir cotação" (`bookingInvites.selection.invite`) → "Cotação: book concorrente": "Convidar parceiros": marcar em "Fornecedores e tradings", escrever "O que a Wellmix precisa (o parceiro lê)" → "Convidar" (`bookingInvites.invite.submit`). Em "Convites deste item": Situação ("Aguardando o book", "Book enviado", "Cancelado"), "Prazo", "Abrir o book", "Cancelar".
- **Depois:** "{n} parceiro(s) convidado(s)."; cada parceiro recebe o aviso e a pendência; quando ele sobe a planilha, nasce um book em Rascunho com ele como responsável, que a Wellmix confere e fecha (T08).
- **Erros:** "Os parceiros marcados já têm convite em aberto para este item." (`booking_invite_exists`); "Convide no máximo 30 parceiros de uma vez."
- **Regras:** prazo em Configurações → "Prazo do convite de book (dias)" (padrão 1). O convidado não vê o book de origem, o fornecedor dele nem o preço.
- **E2E:** `booking-invite.spec.ts` ("seleção → abrir cotação → convidado sobe o booking concorrente").
- **Complexidade:** baixa.

#### T15 · Acompanhar e negociar a solicitação (mensagem e contraproposta)
- **Quem:** tela `quotes` (CO, GP, PL, DC, DE, admin).
- **Quando e por quê:** o fornecedor respondeu; negociar preço, pedido mínimo, prazo e FOB/EXW.
- **Frequência · criticidade:** diária · alta (SLA padrão de 30 minutos da abertura à decisão).
- **Rotas:** `/app/supplier-requests` → `/app/supplier-requests/[id]` (tabela) → `?view=item` (produto).
- **Pré-condição:** solicitação Respondida "faz" (happy-path passo 3: o fornecedor A responde 1,40 USD, MOQ 2000, FOB).
- **Passos:** lista "Solicitações ao fornecedor" (colunas Nº, Situação, Fornecedor, Item, Quantidade, Resposta, "Aberta em", "Finalizada em"; selos "Dentro do SLA"/"Em atraso"). Na solicitação, a tabela mostra condições iniciais e finais, "Situação / SLA" ("Atrasada" ou "No prazo") e os ícones "Mensagem" e "Abrir produto". Na tela do produto: cartão "O que está sendo negociado" (com "Preço negociado" e o do book riscado), "Superplan com as condições negociadas", "Alternativas ({n})" com "Abrir solicitação para esta"; "Negociação e conversa" → "Devolver com contraproposta": "Preço por peça", "Moeda", "Pedido mínimo (peças)", "Prazo de produção (dias)", "Modalidade de entrega", "Comentário"; "Estimativa do Superplan" ("Preço mínimo desejado (R$)" → "Usar este preço") → "Enviar contraproposta". Chat flutuante "Abrir a conversa".
- **Depois:** o fornecedor é avisado; ele aceita, manda nova proposta ou recusa; a lista mostra de quem é a vez.
- **Erros:** "Escreva o comentário da contraproposta." (`supplier_request_comment_required`); "Contraproposta só depois de o fornecedor responder que faz." (`supplier_request_propose_invalid`); "A resposta é do fornecedor, pelo portal: a Wellmix não responde por ele." (`supplier_request_supplier_only`).
- **Regras:** com contraproposta esperando o fornecedor, a Wellmix não aprova ("Aprovar fica disponível depois que o fornecedor responder à contraproposta."). A estimativa do Superplan só funciona em USD ou RMB.
- **E2E:** `booking-supplier-request.spec.ts` (passo 3b, contraproposta com o Superplan, chat, linha do tempo).
- **Complexidade:** alta.

#### T16 · Decidir a solicitação (aprovar, recusar, cancelar) e as solicitações ligadas
- **Quem:** tela `quotes` + ação "Decidir a solicitação ao fornecedor" (CO, GP, PL, DC, DE, admin).
- **Frequência · criticidade:** por solicitação · alta.
- **Rota:** `/app/supplier-requests/[id]?view=item`.
- **Pré-condição:** resposta "faz" sem contraproposta pendente.
- **Passos:** cartão "Decisão da Wellmix": "Observação da decisão" → "Aprovar", "Recusar" ou "Cancelar a solicitação" (`supplierRequests.detail.decide.*`). Com alternativas em negociação: cartão "Solicitações ligadas ({n})" → "Continuar negociando" ou "Recusar".
- **Depois:** "Solicitação aprovada. Crie o produto ou associe a um existente no bloco Produto, logo abaixo."; abre a **Amostragem** para o responsável pelo book (aviso a ele); a solicitação sai do SLA.
- **Erros:** "Essa decisão não vale para a situação atual da solicitação." (`supplier_request_decision_invalid`); antes da resposta só dá para cancelar ("Enquanto o fornecedor não responde, a Wellmix só cancela a solicitação ou manda mensagem…").
- **Regras:** Aberta → só Cancelar; Respondida "faz" → Aprovar ou Recusar; "não faz" → Recusar.
- **E2E:** happy-path passo 4; `booking-supplier-request.spec.ts` (passo 4 e ligadas).
- **Complexidade:** média.

#### T17 · Validar a amostragem
- **Quem:** tela `quotes` + ação "Validar a amostragem" (CO, GP, PL, DC, DE, admin). Mesa "Gerente de produto" → "Amostras a avaliar".
- **Quando e por quê:** o responsável pelo book enviou fotos e vídeos da amostra (feita em impressora 3D; não há envio físico).
- **Frequência · criticidade:** por solicitação aprovada · alta (bloqueia o produto e o pedido).
- **Rota:** `/app/supplier-requests/[id]?view=item#amostragem`.
- **Pré-condição:** amostragem "Esperando a validação da Wellmix" (happy-path passo 4: o fornecedor sobe a foto e toca em "Enviar para a validação").
- **Passos:** cartão "Amostragem" ("Rodada {n}", "Prazo: {date}", "Fotos e vídeos da rodada {n}") → "Comentário (obrigatório para reprovar)" → "Aprovar a amostra" ou "Reprovar e pedir de novo" (`sampling.review.*`).
- **Depois:** aprovada: libera o bloco Produto e o pedido de compra. Reprovada: o responsável é avisado com o motivo e abre a rodada seguinte.
- **Erros:** "Para reprovar, escreva o motivo." (`sampling_reason_required`); sem a ação: "Validar a amostragem depende da ação “Validar a amostragem” (Equipe → Funções e acessos)."
- **Regras:** prazo em Configurações → "Prazo da amostragem (dias)" (padrão 1); só o responsável envia.
- **E2E:** happy-path passo 4; `booking-supplier-request.spec.ts` passos 4.1 e 4.2.
- **Complexidade:** baixa.

#### T18 · Criar o produto (ou associar a um existente), liberar na vitrine e ligar o CODPROD
- **Quem:** telas `quotes` **e** `products` (CO, GP, DC, DE, admin). O Planner aprova, mas não cria o produto.
- **Frequência · criticidade:** por solicitação aprovada · alta.
- **Rota:** `/app/supplier-requests/[id]?view=item`, bloco "Produto".
- **Pré-condição:** solicitação Aprovada com a amostra aprovada.
- **Passos:** "Criar produto novo": "Nome do produto", "Linha de produto" → "Criar produto" (`srProduct.create.submit`); o quadro "Condições combinadas" e "Para incluir no Sankhya" mostram o que vem preenchido e o que falta. Ou "Associar a um produto existente": "Buscar produto no catálogo" → "Associar ao produto marcado". "Itens de book ligados ao produto" (as alternativas vêm marcadas) e, depois, "Ligar mais itens" → "Ligar os marcados". "Liberar na vitrine" (`srProduct.release`). Quadro "Sankhya": "Buscar no Sankhya (descrição ou referência)" → "Usar", ou digitar "CODPROD" → "Gravar código".
- **Depois:** produto criado com SKU = código da fábrica, NCM, ficha mestre e foto do item; nasce "Fora da vitrine do cliente até ser liberado."; aviso "Produto cadastrado: gere o pedido de compra em Solicitações ao fornecedor."
- **Erros:** "O produto só é criado ou associado depois da amostra aprovada." (`request_product_sampling_pending`); "\"XPTO\" é texto de exemplo, não nome de produto. Informe o nome real do produto."; "Um dos itens marcados já está ligado a outro produto. Desmarque-o."; "Esse CODPROD não existe no Sankhya."
- **Regras:** a linha escolhida define se o pedido terá certificado (linha com certificação obrigatória) e o grupo do Sankhya. Sem credencial do Sankhya o código fica "não conferido".
- **E2E:** happy-path passo 4 (cria na linha Brinquedos); `booking-supplier-request.spec.ts` passos 4 e 5 (vitrine e CODPROD).
- **Complexidade:** alta.

#### T19 · Gerar o pedido de compra
- **Quem:** telas `quotes` e `orders` + ação "Gerar pedido de compra" (CO, GP, PL, DC, DE, admin).
- **Frequência · criticidade:** por fornecedor com produtos aprovados · alta.
- **Rota:** `/app/supplier-requests`, quadro "Gerar pedido de compra" (`#pedido-de-compra`).
- **Pré-condição:** solicitação aprovada, amostra aprovada e produto cadastrado; cadastro de **cliente** da Wellmix com o código da empresa do Sankhya (CODEMP).
- **Passos:** quadro "Gerar pedido de compra" ("Comprador: {name}"): marcar "Incluir", ajustar "Quantidade (peças)" (colunas Solicitação, Produto, Preço negociado, MOQ, Prazo (dias)) → "Gerar pedido de compra" (`purchaseOrder.card.submit`).
- **Depois:** abre o "Pedido #{n}" na etapa "Preparação, arte e certificação" (na tabela, "Die-Cut, Arte e Certificação"); as três raias começam em paralelo; fornecedor, designer, certificadora e Vendas são avisados. Com programação de compra, é o pedido pai.
- **Erros:** "Os produtos do pedido precisam estar na mesma moeda." (`purchase_order_currency_mixed`); "Comprador não encontrado: falta o cadastro de cliente da Wellmix com o código da empresa do Sankhya (CODEMP, hoje 3)."; "Só entram no pedido de compra os produtos com a amostra aprovada."; "Produtos com programação de compra só entram juntos no pedido quando as programações têm as mesmas datas…"
- **Regras:** um pedido por fornecedor, até 30 produtos; o pedido sai em nome do responsável pelo book (pode ser a trading) e o contrato mostra a fábrica.
- **E2E:** happy-path passo 5; `booking-supplier-request.spec.ts` passo 6.
- **Complexidade:** média.

### B.2 Pedido

O detalhe do pedido (`/app/orders/[id]`) concentra quase tudo; as telas dos passos (`/app/flow/order/<passo>`) mostram o mesmo trabalho por passo. Seções do detalhe para a Wellmix: "Linha do tempo do pedido", "Resumo do pedido", "Itens do pedido", "Etapas do pedido", "Documentos", "Certificação", "Artes", "Produção", "Incoterm do pedido", "Container na origem", "Amostras", "Embarque e desembaraço", "Frete marítimo", "Pagamento ao fornecedor", "Financeiro do pedido", "Recebimento", "Multas", "Parceiros do pedido".

#### T20 · Achar e abrir um pedido; ler "Etapas do pedido"
- **Quem:** todos os que abrem `orders` (todas as funções).
- **Frequência · criticidade:** diária · média.
- **Rotas:** `/app/flow/order/orders` (menu "Pedidos"), `/app/orders` (link "Lista de todos os pedidos", `flow.orders.list`), `/app/orders/[id]`.
- **Passos:** lista "Pedidos": filtros por etapa, situação ("Em andamento", "Bloqueado", "Concluído", "Cancelado"), prazo ("Atrasados", "Vencem em 7 dias"), "Atualizado"; "Ver itens"/"Abrir pedido". No pedido: tabela "Etapas do pedido" (Etapa, Situação, Responsável, Prazo, "Concluída em", Andamento, "Itens da etapa") com "Ver detalhes", "Abrir todas as etapas", "Mostrar só a etapa em andamento"; "Documentos" com "Confirmar leitura".
- **Regras:** o **operador** vê em "Etapas do pedido" só as tarefas do login dele ("Só as tarefas do seu login neste pedido: em destaque, as que você já pode fazer; em cinza, as que ainda espera…", `orderView.mine.hint`; sem nenhuma: "Nenhuma tarefa sua neste pedido." e "Responsável interno: {name}."). O administrador vê a linha do tempo inteira.
- **E2E:** `orders-list.spec.ts`; happy-path (operador vê `[data-stage-mine-empty]`).
- **Complexidade:** média. **Gravar uma vez** (com um trecho por papel mostrando "só as tarefas dele").

#### T21 · Designar os parceiros e o designer do pedido
- **Quem:** Wellmix com a tela `orders`; a pendência "designar" vai para quem tem "Gerar pedido de compra" (o responsável interno).
- **Quando e por quê:** o pedido nasceu sem agência, certificadora, despachante, companhia marítima, transportador, comex, agente de carga ou agência de marketing (só são designados sozinhos quando há exatamente um ativo do tipo).
- **Frequência · criticidade:** por pedido · alta (sem certificadora ninguém envia o selo; sem designer a arte cai em "Responsável não definido").
- **Rota:** `/app/orders/[id]` → "Parceiros do pedido" e "Artes".
- **Passos:** "Parceiros do pedido" (colunas Parceiro, Designado, Trocar) → escolher → "Designar" (`orders.assign`). Em "Artes": "Designer do pedido" → "Salvar designer" (`artwork.saveDesigner`).
- **Depois:** as tarefas abertas passam para quem foi designado, sem duplicar; a pessoa é avisada.
- **Erros:** "Ninguém disponível: dê a função Designer em Equipe ou designe a agência do pedido." (`artwork.noCandidates`); "Essa pessoa não pode ser designer deste pedido."
- **Regras:** a agência padrão vem da linha do produto (Linhas → "Agência de arte"). Sem parceiro designado, a Wellmix faz a parte dele.
- **E2E:** happy-path (designa o transportador "Trans Rodo" em `[data-order-partner="carrier"]`).
- **Complexidade:** baixa.

#### T22 · Cadastro e fiscal: validar o NCM do produto
- **Quem:** tela `products` (CO, GP, CA, DC, DE, DS, admin) e o despachante; a pendência cai para quem abre `lines` (GP, CA, DC, DE). Mesa "Cadastro e fiscal" → "NCM a validar".
- **Quando e por quê:** o contrato só sai com o NCM validado de cada produto do pedido.
- **Frequência · criticidade:** por produto novo em pedido · alta. Prazo: 3 dias do pedido (Configurações).
- **Rota:** `/app/products/[id]/tax` (atalho "Validar o NCM do produto" na linha do pedido).
- **Pré-condição:** pedido de compra gerado (happy-path passo 5b).
- **Passos:** "Classificação fiscal (NCM)": "Sugerir NCM" (`catalog.tax.suggest`) ou "Adicionar candidata" ("NCM", "Descrição da posição", "Fonte", "Alíquotas (%), se conhecidas", "Tratamento administrativo") → na candidata, "Validar" (`catalog.tax.validate`) ou "Rejeitar".
- **Depois:** o item "NCM validado" do pedido conclui sozinho (sem botão no pedido).
- **Erros:** "Só uma classificação validada por produto; validar outra substitui a atual." (`catalog.tax.onlyOne`).
- **Regras:** sugestão (palavra-chave ou IA) nunca é definitiva.
- **E2E:** happy-path passo 5b (`form[data-tax-add]`, `form[data-tax-validate]`).
- **Complexidade:** média.

#### T23 · Cadastro: completar a ficha mestre do produto (campos e cinco fotos)
- **Quem:** tela `products`; pendência para quem abre `lines`. Mesa "Cadastro e fiscal" → "Fichas mestre incompletas".
- **Quando e por quê:** o contrato espera a "Ficha mestre completa".
- **Frequência · criticidade:** por produto novo · alta. Prazo: 3 dias do pedido.
- **Rota:** `/app/products/[id]` (atalho "Completar a ficha do produto").
- **Passos:** seções recolhidas "Produto", "Fornecedor e negociação", "Embalagem", "Observações" → "Salvar ficha" (`catalog.saveSheet`); "Ficha de compra do produto (mestre)" → "Salvar ficha mestre" (`productSheet.save`), com "Faltam: {fields}"; "Fotos": as cinco da ficha (balança, régua, lado, ângulo e original; "Fotos da ficha no cadastro: {n} de 5." → "Ver quais faltam"); "Pantone" (busca na tabela); "Variações".
- **Depois:** "Ficha mestre salva." ou "Ficha mestre salva; faltam: {fields}."; o item do pedido conclui sozinho quando não falta nada.
- **Erros:** nome de exemplo recusado ("XPTO"); campo obrigatório: "Preencha este campo".
- **Regras:** produto com variações: as amostras do pedido são 5 × 3 por variante.
- **E2E:** happy-path passo 5b (cinco fotos e a cor "Transparente").
- **Complexidade:** média.

#### T24 · Material de arte: acompanhar o Die Cut do fornecedor (e confirmar por ele)
- **Quem:** acompanha quem abre `orders`; a Wellmix também pode confirmar o pedido mínimo e o prazo.
- **Frequência · criticidade:** por pedido · média. Prazo do fornecedor: 7 dias.
- **Rotas:** `/app/flow/order/art-material`, `/app/orders/[id]/die-cut`.
- **Passos:** quadro "Die Cut" por produto: "Die Cut" (a faca), "Foto em alta", "Pedido mínimo (MOQ)", "Prazo de entrega"; "Confirmar pedido mínimo e prazo" (`dieCut.terms.submit`); depois de confirmado, selo "Confirmado" e "{moq} peças · {days} dias" com "Editar".
- **Depois:** com a faca e a foto em alta, o designer é avisado para fazer a arte.
- **Erros:** validação do MOQ (inteiro maior que zero) e do prazo (1 a 720 dias).
- **E2E:** happy-path passo 6a (pelo fornecedor).
- **Complexidade:** baixa.

#### T25 · Arte: fazer a arte e a arte final com o selo (Designer)
- **Quem:** ação "Fazer as artes (designer)" **e** ser o designer do pedido (função Designer); sem designer na Wellmix, é a agência do pedido.
- **Frequência · criticidade:** por produto do pedido · alta. Prazos: 5 dias da faca e da foto; 3 dias para a arte final.
- **Rotas:** `/app/flow/order/art`, `/app/orders/[id]`.
- **Pré-condição:** faca e foto em alta enviadas; para a arte final, arte validada **e** certificado.
- **Passos:** na linha "Arte · {produto}", "Escolher arquivo" (`requirement.file.add`; envia ao escolher). Depois, "Arte final com o selo" (a linha traz a arte validada e o "Certificado (selo)" para baixar). No cartão Certificação, o passo "Selo aplicado na arte" → "Enviar".
- **Depois:** quem valida é avisado a cada envio.
- **Erros:** "Ainda não: falta o passo anterior desta raia (validar só a arte enviada; a arte final pede a arte validada e o certificado)." (`lane_prerequisite`); "Esta tarefa é de outro responsável do pedido…" (`lane_not_assignee`); "Arquivo grande demais (máx. 50 MB)."
- **E2E:** happy-path 6b e 6e (pela agência; ⚠ o caminho com um Designer interno da Wellmix não tem E2E).
- **Complexidade:** média.

#### T26 · Arte: validar a arte (aprovar ou devolver)
- **Quem:** ação "Validar a arte" **e** ser o responsável interno do pedido (nunca quem fez ou enviou a arte); o admin sempre. Mesa "Marketing" → "Artes a validar".
- **Frequência · criticidade:** por produto · alta. Prazo: 2 dias do envio.
- **Rotas:** `/app/flow/order/art` (cartão do pedido) ou `/app/orders/[id]`.
- **Pré-condição:** arte enviada (happy-path 6b).
- **Passos:** na linha "Validação da arte pela Wellmix", abrir a "Arte para validar"; "Observação" (motivo, ao devolver) → "Aprovar" (`common.approve`) ou "Reprovar" (`common.reject`).
- **Depois:** aprovada: libera a arte final (ou o contrato, se a linha não exige certificação). Reprovada: volta ao designer com o motivo.
- **Erros:** `lane_not_assignee` (acima).
- **E2E:** happy-path 6c (reprova com "Logo maior" no pedido e aprova na tela do passo Pedido → Arte).
- **Complexidade:** baixa.

#### T27 · Arte: apontar e conferir não conformidade
- **Quem:** apontar: Wellmix com `orders`; aceitar ou reabrir: ação "Validar a arte".
- **Frequência · criticidade:** rara · média.
- **Rota:** `/app/orders/[id]` → "Artes"; também em Pedido → Arte.
- **Passos:** "+ Registrar não conformidade" → "Não conformidade na arte deste SKU" (+ arquivo) → "Apontar" (`artwork.report`); depois da correção: "Aceitar" ou "Reabrir" ("Motivo (obrigatório para reabrir)"). "Baixar todas as artes" gera o zip.
- **Erros:** "Escreva o motivo." (`artwork.error.note_required`).
- **E2E:** sem E2E (o teste só confere que o cartão e o zip existem).
- **Complexidade:** baixa. **Avançado.**

#### T28 · Certificação: acompanhar, vincular a certificadora e validar a arte com o selo
- **Quem:** vincular: responsável interno (ação "Gerar pedido de compra"); validar "Selo aplicado na arte": ação "Validar a arte"; o resto é da certificadora (OCP) do pedido.
- **Frequência · criticidade:** por pedido de linha com certificação · alta. Prazo do certificado: 15 dias.
- **Rotas:** `/app/flow/order/certification` (só a lista, uma linha por produto), `/app/orders/[id]#certification`.
- **Passos:** na lista do passo, "Resolver" abre `/app/flow/order/certification/<pedido>?item=<item>` ("Este produto no passo", "Ver tudo do pedido neste passo"). No cartão "Certificação" a Wellmix acompanha "Memorial descritivo" e "Selo" ("Faz: OCP"), baixa o selo e, quando a arte com o selo chega, "Validar" ou "Recusar" com "Motivo (obrigatório para recusar)". Sem certificadora: "Designar em Parceiros do pedido" (`certFlow.assign.ocp`).
- **Regras:** memorial e selo são enviados **só** pela certificadora (nem o admin envia). Linha sem certificação: "Os produtos deste pedido não exigem certificação (linha do produto)…". Certificação válida até hoje + 120 dias conclui o certificado sozinha.
- **Erros:** "Quem enviou não valida o próprio passo." (`importFlow.error.own_step`).
- **E2E:** happy-path 6d (OCP envia; Comprador só acompanha, sem campos).
- **Complexidade:** média. ⚠ Os passos "Ensaio em laboratório (laudo)" e "Número de registro (certificado)" existem no código, mas não confirmei em que pedidos aparecem hoje (docs/videos/ACHADOS.md, item 7, diz que saíram da tela).

#### T29 · Revisão: resolver ou dispensar itens fora da regra
- **Quem:** tela `reviews` (CO, GP, CA, DC, DE, admin).
- **Frequência · criticidade:** semanal · média.
- **Rota:** `/app/reviews`.
- **Passos:** "Itens para revisão": cada item com "Esperado", "Encontrado", "Responsável", "Ação necessária"; "Abrir"; "Observação" → "Resolver" (`reviews.resolve`) ou "Dispensar" (`reviews.dismiss`).
- **Regras:** os itens nascem de regras fixas (inspeção fora da tolerância, FOB zero, container acima da ocupação, certificação faltando, RADAR). No pedido bloqueado há "Liberar etapa" (`orders.unblock`).
- **Erros:** ⚠ ACHADOS item 8: "Resolver" e "Dispensar" não liberam a inspeção bloqueada; não reverifiquei.
- **E2E:** sem E2E.
- **Complexidade:** média. **Avançado** (no pedido de compra de hoje não há ficha de compra para comparar pesos; a fila tende a ficar vazia).

#### T30 · Contrato: definir o pedido de amostras
- **Quem:** Wellmix com `orders`; a pendência vai para quem tem "Validar a amostragem".
- **Quando e por quê:** obrigatório antes de a Wellmix assinar.
- **Frequência · criticidade:** por pedido (e por pedido filho) · alta. Prazo: 2 dias.
- **Rota:** `/app/orders/[id]/samples` (atalho "Pedido de amostras").
- **Pré-condição:** as três raias concluídas (pedido em "Contrato e assinaturas").
- **Passos:** "Definir o pedido de amostras": "Gerar o pedido de amostras" (`sampleOrder.decide.create`) ou "Motivo (opcional)" + "Sem amostras neste pedido" (`sampleOrder.decide.none`). A tela mostra "Amostras por produto" e a regra "{n} peças (5 × 3) por variante de cada produto do pedido."
- **Depois:** "Pedido de amostras gerado. O fornecedor foi avisado para aceitar." O fornecedor aceita na mesma tela.
- **Erros:** "O pedido de amostras só é definido com o pedido no contrato." (`sample_order_closed`); "O pedido de amostras já foi definido."
- **E2E:** happy-path 7a (total 15).
- **Complexidade:** baixa.

#### T31 · Contrato: assinar pela Wellmix
- **Quem:** ação "Assinar o contrato pela Wellmix": **Diretoria de compras e Diretoria executiva**; o admin sempre.
- **Frequência · criticidade:** por pedido e por pedido filho · alta. Prazo: 2 dias.
- **Rotas:** `/app/flow/order/contract` → `/app/orders/[id]/purchase-order`.
- **Pré-condição:** raias concluídas e pedido de amostras definido.
- **Passos:** "Documento do pedido #{n}"; quadro "Sua vez de assinar"; "Baixar o documento em PDF" (`orderSign.download`) → assinar e carimbar → "Enviar o documento assinado (PDF ou foto)" (`orderSign.option.file.send`). "Arte final de cada produto (com o selo)" aparece no documento.
- **Depois:** "Assinatura registrada."; o fornecedor é avisado e assina em seguida; com os dois arquivos o pedido vai ao Sankhya (ou a Wellmix é avisada para gerar lá) e fica esperando o sinal.
- **Erros:** "Defina o pedido de amostras antes de assinar." (`signature_samples_pending`); "Suba o contrato assinado e carimbado (PDF ou foto)." (`signature_file_required`).
- **Regras:** no pedido de compra só vale o arquivo (não há o aceite com nome e "li e concordo"). O administrador pode "Devolver a assinatura do fornecedor (administrador)" com "Motivo (o fornecedor lê)" → "Devolver para assinar de novo" e registrar assinatura recebida por fora.
- **E2E:** happy-path 7 (`uploadSignedContract`, com o admin).
- **Complexidade:** média.

#### T32 · Pagar o sinal e as parcelas ao fornecedor **(só admin)**
- **Quem:** administrador (as ações conferem o papel `admin`).
- **Quando e por quê:** com as duas assinaturas, o sinal pago (ou a conta corrente) libera a produção.
- **Frequência · criticidade:** por pedido · alta. Prazo do sinal: 3 dias das assinaturas.
- **Rotas:** `/app/payables` e `/app/orders/[id]` (cartão "Pagamento ao fornecedor").
- **Pré-condição:** condição de pagamento no cadastro do fornecedor e dados bancários.
- **Passos:** "Contas a pagar": filtro "Fornecedor" → linha (Vencimento, Pedido, Parcela, Valor, Situação) → "Pagar" ou "Abrir". No pedido: "Dados para a transferência" → "Copiar dados para o banco" (`supplierPay.copy`), "Pedir ao financeiro por e-mail" ou "Pedir ao financeiro por WhatsApp" (marcam a parcela como solicitada); quando o dinheiro sair, "Marcar como pago" (com câmbio e comprovante). Alternativa: "Já pagou? Registrar com valor, câmbio e comprovante" → "Registrar pagamento ao fornecedor".
- **Depois:** o fornecedor confirma o recebimento na Conta corrente dele; o item "Sinal pago ao fornecedor" conclui e a produção começa a contar.
- **Erros:** "Condição de pagamento não configurada para este fornecedor." (`supplierTerms.missing`); "Falta no cadastro do fornecedor: {fields}." (`supplierPay.missingBank`).
- **Regras:** sem parcela no marco "pedido gerado", a condição é conta corrente e a produção abre só com as assinaturas. Parcela "solicitada ao banco" não libera: só paga ou recebida.
- **E2E:** happy-path 8 (operador é barrado em `/app/payables`; admin copia os dados; fornecedor confirma).
- **Complexidade:** média.

#### T33 · Programação de compra: pedido pai e pedidos filhos
- **Quem:** Wellmix com `orders`.
- **Frequência · criticidade:** por pedido com programação · média.
- **Rota:** `/app/orders/[id]` (cartão "Programação de compra (pedido pai)").
- **Passos:** o cartão lista as programações (data, peças, pedido filho ou "Nasce em {date}", `purchaseRounds.order.waiting`) → "Gerar as programações do dia" (`purchaseRounds.order.spawn`). No filho: "Programação {n} de {rounds} do pedido pai" e "Abrir o pedido pai #{n}".
- **Depois:** "{n} programação(ões) viraram pedido." O filho herda artes, certificado, MOQ e prazo feitos e começa no contrato (T30 e T31 de novo, por filho).
- **Regras:** os filhos nascem sozinhos no dia (job diário) ou quando a Preparação do pai conclui; o pai não vai a contrato nem produção e encerra quando o último filho nasce.
- **Erros:** "Nenhuma programação para gerar hoje."
- **E2E:** `booking-selection.spec.ts` cobre o gerador; ⚠ o nascimento dos filhos não tem E2E.
- **Complexidade:** alta. **Avançado.**

#### T34 · Cancelar o pedido **(só admin)**
- **Quem:** ação "Cancelar pedido" (ninguém no padrão; o admin).
- **Frequência · criticidade:** rara · alta.
- **Rota:** `/app/orders/[id]`, cartão "Cancelar pedido".
- **Passos:** "Motivo", "Observação (opcional)", "Acerto financeiro com o cliente (opcional)" → "Cancelar pedido" (`cancel.submit`), com a confirmação "Cancelar este pedido? As etapas abertas serão encerradas e todos serão avisados." Caso da inspeção: quadro "Tentativas de aprovação esgotadas" → "Mensagem para o fornecedor", "Confirmo o cancelamento deste pedido." → "Cancelar o pedido"; atalho "Escolher outro fornecedor na Seleção de itens".
- **Depois:** o pedido fica Cancelado com o histórico; todos são avisados; "Este pedido tem número no Sankhya ({erp}): cancele também no Sankhya."
- **E2E:** sem E2E.
- **Complexidade:** baixa. **Avançado.**

### B.3 Produção

As ações deste bloco moram no detalhe do pedido e aparecem também nas telas dos passos (`/app/flow/production/<passo>`). Para abrir as telas dos passos é preciso a tela `production` (CO, PL, DC, DE, admin); para **agir** basta abrir o pedido (tela `orders`).

#### T35 · Pré-produção: dados da produção e ETD
- **Quem:** Wellmix com `orders` (ou o fornecedor); pendência/caso para quem abre `production`.
- **Quando e por quê:** sinal pago e a produção ainda sem ETD.
- **Frequência · criticidade:** por pedido · alta (os follows e o Overview dependem do ETD).
- **Rotas:** `/app/flow/production/pre-production`, `/app/orders/[id]` (cartão "Produção").
- **Pré-condição:** item "Sinal pago ao fornecedor (ou conta corrente)" concluído (happy-path passo 8).
- **Passos:** "Fornecedor é" ("Fábrica" ou "Trade (revenda)"), "Início da produção", "ETD (saída prevista)", com Trade: "Fábrica" e "Endereço da fábrica" → "Salvar produção" (`production.save`). Mudar o ETD depois pede "Motivo da mudança do ETD (obrigatório ao mudar)"; a tabela "Mudanças do ETD" guarda o histórico.
- **Depois:** salvar o ETD tira o caso da Pré-produção; o fornecedor é avisado quando a Wellmix muda o ETD.
- **Erros:** "Informe o motivo da mudança do ETD." (`etd_reason_required`).
- **Regras:** o início entra sozinho ("Automático: dia do contrato assinado mais {days} dia(s) (prazo do fornecedor).") e conta da liberação da produção (sinal pago ou conta corrente).
- **E2E:** happy-path (confere o cartão em Pré-produção; não salva o ETD).
- **Complexidade:** baixa.

#### T36 · Produção: follow de 5, 15 e 25 dias
- **Quem:** pendência "Follow da produção" para quem tem "Gerar pedido de compra" (CO, GP, PL, DC, DE).
- **Frequência · criticidade:** três vezes por pedido · média.
- **Rotas:** `/app/flow/production/production`, cartão "Produção" do pedido.
- **Pré-condição:** início da produção informado.
- **Passos:** tabela "Follow da produção" (Follow, Situação, Observação, Registrar): escolher "No prazo" ou "Atrasado", "Observação (obrigatória se atrasado)" → "Registrar follow" (`production.followups.save`).
- **Depois:** atrasado avisa o analista do pedido e o planner.
- **Erros:** "Informe primeiro o início da produção." (`no_start`); "Este follow já foi registrado."; "Escreva a observação."
- **E2E:** sem E2E.
- **Complexidade:** baixa.

#### T37 · Inspeção: agendar e aprovar ou reprovar cada SKU
- **Quem:** Wellmix com `orders`; pendência para quem tem "Gerar pedido de compra".
- **Quando e por quê:** o fornecedor mandou fotos, peso, vídeo da produção e a declaração de conformidade; a aprovação da Wellmix libera o embarque.
- **Frequência · criticidade:** por pedido (por SKU) · alta. Prazo: 2 dias da declaração.
- **Rotas:** `/app/flow/production/inspection` (com o relatório ao lado), cartão "Produção" do pedido.
- **Pré-condição:** itens de inspeção do fornecedor enviados (happy-path passo 9).
- **Passos:** "Inspeção": "Data da inspeção", "Observação (inspetor, horário)" → "Agendar inspeção". "Resultado da inspeção" mostra "O que o fornecedor mediu", Esperado × Encontrado e "Fotos da inspeção". "Inspeção por SKU": "Observação (obrigatória para reprovar)" → "Aprovar SKU" ou "Reprovar SKU" (`production.sku.*`).
- **Depois:** com todos aprovados ("Todos aprovados") o item "Inspeção aprovada pela Wellmix (todos os SKUs)" conclui e o pedido vai ao Embarque. Reprovado: o ETD ganha 1 dia, os itens do fornecedor voltam a pendentes e ele informa a correção ("Aguardando a correção do fornecedor.").
- **Erros:** "Espere a declaração de conformidade do fornecedor antes de inspecionar." (`conformity_required`); "Fornecedor trade: informe o endereço da fábrica antes de agendar." (`factory_required`); "As tentativas acabaram: confirme o cancelamento do pedido." (`attempts_exhausted`).
- **Regras:** até 3 tentativas (Configurações); depois, o quadro de cancelamento da T34.
- **E2E:** happy-path passo 9 (aprova na tela do passo); `production-screen.spec.ts`. Reprovar e as tentativas: sem E2E.
- **Complexidade:** média.

#### T38 · Amostra: acompanhar as amostras e aprovar as fotos reais
- **Quem:** aprovar: ação "Aprovar as fotos e vídeos reais" (Designer; admin). Sem agência de marketing designada, a Wellmix faz a parte dela (recebimento, fotos e devolução).
- **Frequência · criticidade:** por pedido com amostras · alta (segura o carregamento do container e ativa a venda).
- **Rotas:** `/app/flow/production/sample`, `/app/orders/[id]#samples`, `/app/orders/[id]/real-media`.
- **Pré-condição:** pedido de amostras gerado e SKU aprovado (happy-path, depois do passo 9).
- **Passos:** cartão "Amostras": divisão por produto ("Show room (Brasil)", "Agência (China)", "Total") e os passos "Retirada das amostras (data)", "Envio ao show room no Brasil…", "Envio à agência de marketing na China…", "Amostras recebidas pela agência (data)", "Amostra devolvida à trading para seguir com o pedido" (cada um com "Enviar"; a devolução, com "Validar" pela trading). Em "Fotos e vídeos reais": "Fotos e vídeos (pode escolher vários)" → "Enviar fotos e vídeos"; o marketing: "Aprovar, trocar as fotos e ativar a venda" (`realMedia.approve`) ou "Motivo (obrigatório para pedir refazer)" + "Pedir para refazer".
- **Depois:** aprovado: as fotos reais viram as principais do catálogo, o produto fica ativo e vira caso em Vendas → Ofertas; as fotos de referência ficam guardadas e escondidas.
- **Erros:** "Escreva o motivo para pedir refazer."; "O container só é carregado depois que a amostra da China volta à trading (cartão Amostras)." (`samples_return_required`).
- **Regras:** divisão fixa: de cada 5, 4 ao Brasil e 1 à China.
- **E2E:** happy-path (amostras e fotos reais feitos pelo admin, sem agência designada). ⚠ Um Designer interno aprovando: sem E2E.
- **Complexidade:** média.

#### T39 · Booking da marítima e container na origem: validar os passos
- **Quem:** quem recebe as pendências de embarque (tela `freight`: CO, PL, DC, DE; o CX também as vê); validar pede abrir o pedido.
- **Frequência · criticidade:** por pedido · alta.
- **Rotas:** `/app/flow/production/booking`, `/logistics`, `/loading`; cartões "Embarque e desembaraço" e "Container na origem" do pedido.
- **Pré-condição:** pedido no Embarque (SKU aprovado).
- **Passos:** cada passo mostra "Faz: {actor} · valida: {validator}". A Wellmix valida com "Validar" (`importFlow.validate`) ou recusa com "Motivo (obrigatório para recusar)" + "Recusar": "Booking" (enviado pelo agente de carga), "Carregamento: fotos, vídeos e check de carga" (enviado pelo fornecedor) e, na compra EXW, "Custos do transporte na origem (POP): valor, moeda e comprovante". Sem parceiro designado, a Wellmix preenche e toca em "Enviar".
- **Depois:** o passo seguinte abre para o parceiro ("Depois de: {step}").
- **Erros:** "Quem enviou não valida o próprio passo." (`own_step`; o admin pode); "Conclua antes o passo anterior."; "Escreva o motivo para recusar."
- **Regras:** "Booking" aqui é a reserva no navio (não é o Book das planilhas). Entrada manual, sem integração com armador.
- **E2E:** happy-path (admin envia o booking; o operador valida; admin valida o carregamento).
- **Complexidade:** média.

#### T40 · Logística: pedir o frete marítimo e definir o incoterm (EXW)
- **Quem:** Wellmix com `orders`.
- **Frequência · criticidade:** por pedido · média.
- **Rotas:** `/app/flow/production/logistics`, cartões "Frete marítimo" e "Incoterm do pedido" do pedido; respostas em `/app/freight`.
- **Pré-condição:** companhia marítima ativa cadastrada e carga conhecida (caixas ou volume).
- **Passos:** "Frete marítimo" → "Pedir frete às companhias marítimas" (`freight.order.request`); depois, "Pedir de novo (carga atualizada)". As respostas aparecem na tabela (Companhia marítima, Carga, Frete, "Pedido em"). "Incoterm do pedido": FOB ou EXW → "Salvar".
- **Depois:** "Frete pedido a {n} companhia(s) marítima(s)."; cada companhia recebe a pendência e informa o valor; a Wellmix é avisada no pedido.
- **Erros:** "Não há companhia marítima ativa cadastrada." (`no_carriers`); "Sem caixas nem volume conhecidos: preencha a ficha de compra ou o cadastro do produto." (`no_cargo`).
- **Regras:** o pedido é EXW quando algum produto é EXW; nesse caso a trading registra transportadora, previsão e custos de origem, e a Wellmix valida os custos.
- **E2E:** sem E2E para o pedido de frete (⚠).
- **Complexidade:** média.

#### T41 · Documentos de carga: acompanhar a conferência e emitir o BL sem marítima
- **Quem:** acompanha quem abre o pedido; sem companhia marítima designada, a Wellmix envia o BL.
- **Frequência · criticidade:** por pedido · alta (o embarque só é confirmado com o BL conferido).
- **Rotas:** `/app/flow/production/cargo-docs`, `/app/orders/[id]/shipping-docs`.
- **Passos:** "Documentos do embarque · pedido #{n}": "1. Check list de carga", "2. Packing list (fornecedor)", "3. Invoice (trading)", "4. BL (companhia marítima)". Quando há diferença: "Diferenças encontradas" com "{item}: {field} esperado {expected}, informado {found}". Para o BL: "Nº do BL", "Nº do container", "Arquivo do documento" → "Enviar o BL".
- **Depois:** BL conferido conclui o passo "BL (original)" do desembaraço, ativa a fatura ("Fatura ativa · vence {date}") e avisa a Wellmix de que o embarque pode ser confirmado.
- **Erros:** "O embarque só é confirmado com o container lacrado no porto e o BL conferido." (`shipping_docs_required`); "Este documento não está aberto agora."
- **Regras:** conferência linha a linha de caixas, peças, peso líquido e bruto; o despachante não participa destes documentos.
- **E2E:** happy-path (fornecedor e marítima enviam; a Wellmix não emite BL no teste).
- **Complexidade:** média.

#### T42 · Embarque: rastreio diário do container (Comex interno)
- **Quem:** ação "Rastrear o container (todo dia)" (função Comex (interno); admin).
- **Quando e por quê:** enquanto não há integração de rastreio, alguém confere e registra o status do container todo dia.
- **Frequência · criticidade:** **diária**, por pedido com container na fábrica, até sair do Desembaraço · alta.
- **Rotas:** Pendências → "Abrir" → `/app/orders/[id]#container-origin`; o passo fica em Produção → Embarque (`/app/flow/production/shipment`).
- **Pré-condição:** "Container vazio no depósito da fábrica (data)" registrado pelo fornecedor.
- **Passos:** no cartão "Container na origem", passo "Rastreio do container (status do dia)": escrever o status → "Enviar" (`importFlow.submit`).
- **Depois:** a pendência some e volta no dia seguinte (dia em Brasília); cada registro fica na Auditoria.
- **Regras:** só a Wellmix vê o rastreio.
- **E2E:** sem E2E. ⚠ No padrão, a função Comex (interno) não abre a tela `production`: o item Produção → Embarque não aparece no menu dela; o caminho é Pendências → pedido (ver E.3).
- **Complexidade:** baixa.

### B.4 Entrega

Telas dos passos em `/app/flow/delivery/<passo>` (tela `containers`: CO, PL, DC, DE, CX, admin).

#### T43 · Desembaraço: validar o numerário e registrar o pagamento (Financeiro)
- **Quem:** ação "Numerário e financeiro do pedido" (função Financeiro; admin).
- **Frequência · criticidade:** por pedido · alta.
- **Rota:** Pendências → `/app/orders/[id]#import-flow` (cartão "Embarque e desembaraço"); o passo é Entrega → Presença de carga.
- **Pré-condição:** o comex enviou o "Numerário" (valor em R$ e demonstrativo).
- **Passos:** passo "Numerário" → "Validar" ou "Recusar" (com motivo); depois "Numerário pago": "Arquivo" (comprovante) → "Enviar".
- **Erros:** "Quem enviou não valida o próprio passo."; ⚠ ACHADOS item 9: o valor "18.500,00" seria recusado com `invalid_input` (não reverifiquei).
- **Regras:** a função Financeiro abre só a tela Pedidos; não vê Financeiro, Contas a pagar nem a faixa de valores.
- **E2E:** sem E2E.
- **Complexidade:** baixa.

#### T44 · LPCO, canal e nota fiscal (DANFE)
- **Quem:** pendências de embarque (tela `freight`); o comex ou, sem ele, a Wellmix.
- **Frequência · criticidade:** por pedido · média (LPCO só em pedido com NCM que exige).
- **Rotas:** `/app/flow/delivery/lpco`, `/channel`, `/invoice`; cartão "Embarque e desembaraço".
- **Passos:** "LPCO (licença da importação)": o comex registra número e arquivo; a Wellmix marca deferida ou indeferida com "Validar"/"Recusar". "Canal de parametrização": informado pelo comex. "DANFE (nota de entrada)" é da Wellmix: número + "Arquivo" → "Enviar", depois da "DI/DUIMP e XML".
- **Regras:** o LPCO só aparece em pedido com produto cujo NCM começa por um prefixo de Configurações → "NCMs que exigem LPCO" (vazio = em nenhum). Canal vermelho ou cinza gera alerta à Wellmix.
- **E2E:** sem E2E.
- **Complexidade:** média. ⚠ O texto exato dos botões de deferir/indeferir o LPCO não foi confirmado além de "Validar"/"Recusar".

#### T45 · Entrega: confirmar o recebimento e encerrar o pedido
- **Quem:** Wellmix com a tela `orders`; o item da etapa Entrega cai em Pendências para quem abre `freight` (CO, PL, DC, DE, CX).
- **Frequência · criticidade:** por pedido · alta.
- **Rotas:** `/app/flow/delivery/delivery`, `/app/orders/[id]`.
- **Pré-condição:** transporte concluído pelo transportador ("Entrega realizada").
- **Passos:** item "Recebimento confirmado" → "Confirmar" (`common.confirm`). Se a fatura está ativa: "Registrar faturamento" (`orderInvoice.register`), com a confirmação "Registrar que este pedido foi faturado? A regra "Pedido faturado" (Configurações → Processos) roda em seguida."
- **Depois:** "Pedido encerrado"; o recebimento no CD segue aberto (T46).
- **Regras:** no pedido de compra o cliente é a própria Wellmix (sem login), então a Wellmix confirma.
- **E2E:** happy-path passo 11.
- **Complexidade:** baixa.

#### T46 · Armazenagem e Retorno: recebimento no CD
- **Quem:** Wellmix com `orders`; os casos aparecem para quem abre `containers`; os avisos da conferência vão para quem tem "Acompanhar o recebimento" (Comprador).
- **Frequência · criticidade:** por pedido entregue · alta (divergência gera reclamação ao fornecedor).
- **Rotas:** `/app/flow/delivery/storage`, `/app/flow/delivery/return`, cartão "Recebimento" do pedido.
- **Passos (Armazenagem):** "Nº do lacre", "Lacre" ("Íntegro"/"Violado"), "Foto do lacre", "Fotos do container (aberto, carga, descarga)", "Checklist" → "Salvar descarga". "Conferência por SKU": "Esperado", "Recebido", "Avariado", "Observação" → "Salvar conferência".
- **Passos (Retorno):** "RIC": "Nº do RIC", "Arquivo" → "Salvar RIC"; "Devolução do container" → "Salvar devolução"; "Fechamento" (pago × total dos dois lados) → "Observação do fechamento" → "Encerrar recebimento" (`receiving.close`).
- **Depois:** "Recebimento encerrado em {date}" (só leitura) e aviso ao financeiro.
- **Erros:** "Quantidade inválida (avariado não pode passar do recebido)."; "Ainda falta conferir algo antes de encerrar." (`incomplete`, com "Falta: {list}").
- **Regras:** lacre violado alerta a equipe; recebido diferente do esperado ou avaria é divergência e avisa analista, compradores e fornecedor.
- **E2E:** happy-path (só confere que o cartão aparece em Armazenagem). Preencher: sem E2E.
- **Complexidade:** média.

#### T47 · Containers, Fretes e Tarifário de frete
- **Quem:** Containers: tela `containers`; Fretes: `freight`; Tarifário: `freightTariff` (CO, PL, DC, DE, admin).
- **Frequência · criticidade:** semanal · média.
- **Rotas:** `/app/containers`, `/app/containers/[id]`, `/app/freight`, `/app/freight/tariff`.
- **Passos (Containers):** "Novo container": "Código", "Tipo", "Cliente (opcional)", "ETD (saída prevista)", "ETA (chegada prevista)", "Observações" → "Criar container". No container: "Adicionar item" ("Por pedido" ou "Estoque / produto") → "Adicionar ao container"; "Mudar situação" (Planejamento, Em carregamento, Embarcado, Chegou, Encerrado); barras de "Ocupação" e "Peso".
- **Passos (Fretes):** "Cotações de frete": lista dos pedidos de frete e respostas das companhias (só consulta para a Wellmix).
- **Passos (Tarifário):** "Importar planilha da companhia marítima": "De quem é a planilha", "Planilha (.xlsx ou .xlsm)", "Data de referência" → "Importar planilha"; comparativo por porto e destino com "Menor custo"; "Baixar CSV do Sankhya (AD_FREINT)"; "Frete por m³" → "Usar R$ {perCbm}/m³ ({dest}) no preço" (só admin).
- **Erros:** "A chegada prevista (ETA) não pode ser antes da saída prevista (ETD)."; "Acima da capacidade: {total} m³ usados de {capacity} m³."; "Container encerrado: não aceita mais itens."
- **Regras:** capacidade e peso por tipo vêm de Configurações → "Tipos de container"; container acima de 95% entra na Revisão.
- **E2E:** `search-pickers.spec.ts` (cliente pela busca em Containers); happy-path (link do tarifário no cartão do Embarque).
- **Complexidade:** média. ⚠ O papel dos Containers no pedido de compra de hoje (em que o container nasce nos passos "Container na origem") não ficou claro: ver D.

### B.5 Vendas

#### T48 · Estoque: consultar, limite mínimo, baixa por venda e reservas
- **Quem:** tela `products` (CO, GP, CA, DC, DE, DS, admin).
- **Frequência · criticidade:** semanal · média.
- **Rotas:** `/app/inventory`, `/app/inventory/reservations`, `/app/inventory/movements`.
- **Passos:** "Estoque": colunas "No Brasil", "Reservado", "Em trânsito", "Em produção", "Total", "Limite"; cartões-filtro (abaixo do limite, parados 90+ dias); "Salvar limite"; "Exportar (CSV)". "− Baixa por venda" (`stockOut.open`): "Produto", "Quantidade", "Pedido do cliente (opcional)", "Observação (NF, cliente, motivo)" → "Dar baixa". "Reservas" → "+ Nova reserva": "Produto", "Cliente", "Quantidade", "Validade (dias)" → "Reservar"; depois "Usar (dar baixa)" ou "Cancelar". "Movimentações e perdas".
- **Erros:** "Parte deste estoque está reservada para clientes. Dê baixa pela reserva (Estoque → Reservas → Usar) ou cancele a reserva." (`stock_reserved`); "Não há estoque livre no Brasil para reservar."
- **Regras:** preço de compra e valor total só para quem tem "Ver valores e margem". "+ Compra para estoque" e "Comprar {n}" abrem a solicitação antiga (ver D.4).
- **E2E:** sem E2E.
- **Complexidade:** média.

#### T49 · Inventário às cegas
- **Quem:** abrir, aprovar e fechar: **só admin**; contar: tela `products`.
- **Frequência · criticidade:** rara · média.
- **Rotas:** `/app/inventory/counts`, `/app/inventory/counts/[id]`.
- **Passos:** "Abrir inventário" (+ "Observação (opcional)"); quem conta: "Quantidade contada" → "Gravar contagem"; admin: "Aprovar quantidade" (+ "Motivo / observação") → "Fechar inventário".
- **Regras:** quem conta não vê a quantidade do sistema; não bateu, tem mais uma chance; errou de novo, vai para "Aguardando admin". A diferença aprovada vira perda ou sobra.
- **E2E:** sem E2E.
- **Complexidade:** média. **Avançado.**

#### T50 · Amostras e Ofertas: registrar a quem foi oferecido
- **Quem:** tela `products`.
- **Frequência · criticidade:** por amostra/produto liberado · média.
- **Rotas:** `/app/flow/sales/samples`, `/app/flow/sales/offers`.
- **Pré-condição:** Amostras: passo "Envio ao show room no Brasil" concluído. Ofertas: foto real aprovada (T38).
- **Passos:** em cada caso, "Oferecido a", "Observação" → "Registrar oferta" (`flow.sales.submit`); embaixo, "Ofertas registradas" (Quando, Pedido, Produto, Por).
- **Depois:** o caso sai da lista e entra no histórico.
- **E2E:** happy-path ("Loja Exemplo E2E", "Rede Exemplo E2E").
- **Complexidade:** baixa.

### B.6 Financeiro (só admin no padrão)

| Código | Tarefa | Rota | Passos e rótulos | Observações |
| --- | --- | --- | --- | --- |
| T51 | Ler o Financeiro e informar câmbio | `/app/finance` | Cartões "Vendido", "Recebido", "A receber", "Pago ao fornecedor", "A pagar", "Margem"; por pedido: "Venda", "FOB", "Câmbio", "Custo"; "Informar câmbio" → "Salvar câmbio" | "~ = estimado" quando falta câmbio. Sem E2E. Complexidade média. |
| T32 | Contas a pagar | `/app/payables` | Ver T32 | E2E: happy-path 8. |
| T52 | Fluxo de caixa | `/app/dashboards/cashflow` | "Fluxo de caixa previsto": 12 semanas, "Atrasado", "Depois", "Sem data" | Só leitura. A página exige as telas Financeiro **e** Painéis por área (E.5). Sem E2E. |
| T53 | Acordos e comissões | `/app/commissions` | Abas "Acordos", "Lançamentos", "Extrato e liquidação", "Simulador"; "Novo acordo"; "Apurar pedido"; "Aprovar os marcados"; "Registrar liquidação" | Só o administrador ("Só o administrador abre os acordos e as comissões."). E2E: `commissions.spec.ts`. Complexidade alta. **Avançado.** |
| T54 | Multas | `/app/penalties`; registrar em `/app/orders/[id]` → "Multas" | "Registrar multa": "Motivo", "Responsável", valor, "Evidência" | Tela `penalties` (DC, DE, admin, jurídico). Sem E2E. **Avançado.** |
| T55 | Receber do cliente | `/app/orders/[id]` → "Financeiro do pedido" | "+ Registrar recebimento do cliente": "Valor", "Moeda", "Forma", "Comprovante (opcional)" → "Registrar recebimento do cliente" | Papel admin. No pedido de compra de hoje o cliente é a própria Wellmix: ⚠ uso real não confirmado. |

### B.7 Painéis

| Código | Tarefa | Quem | Rota | O que mostra |
| --- | --- | --- | --- | --- |
| T56 | Painéis por área | PL, DC, DE, admin | `/app/dashboards?area=…` | Áreas "Compras", "Produção", "Embarque e desembaraço", "Recebimento", "Certificação e artes", "Financeiro"; "Pedidos que pedem atenção". Só leitura; cada número leva à tela. E2E: happy-path 13. |
| T57 | Painel do dono | admin | `/app/dashboards/owner` | Vendas e margem do mês, a receber e a pagar, estoque, perdas, pedidos por etapa. Só leitura. Sem E2E. |
| T04 | Painel de SLA | todos | `/app/sla` | Ver T04. |

### B.8 Cadastros

#### T58 · Parceiros: cadastrar, completar e dar acesso ao portal
- **Quem:** tela `parties` (CO, CA, DC, DE, admin).
- **Quando e por quê:** fornecedor novo de um book, parceiro de logística, trading etc.; sem login o fornecedor não responde a solicitação.
- **Frequência · criticidade:** semanal · alta.
- **Rotas:** `/app/parties` (abas "Cadastros", "Tipos de parceiro", "Acessos externos"), `/app/parties/new`, `/app/parties/[id]`.
- **Passos:** "Novo parceiro" (`parties.new`): "Tipo" ("Selecione o tipo"), nome, "País", "Telefone / WhatsApp", "CNPJ / Tax ID". No cadastro: "Gerar login de acesso" → quadro "Logins de acesso ao portal": nome, "Login", "Senha" (vem sugerida), idioma → "Copiar login e senha" → "Criar acesso" (`portalAccess.create`). Para fornecedor: "Contato e endereço (sourcing)" (com "Nº da loja no mercado") e "Dados bancários (pagamento ao fornecedor)", para quem abre Parceiros; **só o admin** vê e grava "Condição de pagamento ao fornecedor", "Início da produção" ("Dias depois do contrato assinado") e "Fatura ativa" ("Dias depois dos documentos conferidos"). Lista: filtro "Tipo de parceiro", "Buscar parceiro", "Importar CSV".
- **Depois:** "Acesso criado e preso a {name}. Login: {login}. Passe para a pessoa o endereço do portal, o login e a senha…"; o login vê só o que é do cadastro dele, inclusive as solicitações já abertas.
- **Erros:** "Copie antes de criar e mande para a pessoa: a senha não aparece de novo depois." (aviso); "Este login já existe no portal. Use outro e-mail ou nome de usuário."; tipo sem login: "Este tipo foi criado no painel e ainda não tem classe de login…".
- **Regras:** sem condição de pagamento o pedido fica sem parcelas ("Sem condição configurada: os pedidos deste fornecedor ficam sem parcelas nem vencimento em Contas a pagar…"). Trading, Factory, Supplier e GP entram como o Fornecedor entra.
- **E2E:** `partner-types.spec.ts`; `partner-access.spec.ts` (Factory e Trading com login).
- **Complexidade:** média.

#### T59 · Tipos de parceiro e Acessos externos **(só admin)**
- **Quem:** administrador.
- **Frequência · criticidade:** rara · média.
- **Rotas:** `/app/parties/types`, `/app/parties/access`.
- **Passos:** Tipos: "+ Novo tipo" → "Nome", "Nome em inglês", "Nome em chinês", "Os usuários deste tipo podem ter login" → "Criar tipo"; menu ⋯: "Editar", "Renomear", "Inativar"/"Reativar"; "Configurar telas". Acessos externos: visões "Por tipo ou perfil" e "Por tela"; caixas "Abre" e "No menu" por tela; painéis "Comparar acessos" e "Copiar acesso" (com prévia) → salvar.
- **Erros:** "Só o administrador cria ou altera tipos de parceiro."; "Só o administrador muda a Gestão de telas."
- **E2E:** `partner-access-panels.spec.ts`, `partner-access.spec.ts`, `partner-types.spec.ts`.
- **Complexidade:** alta. **Avançado.**

#### T60 · Produtos: cadastrar, editar a ficha e importar a ficha técnica
- **Quem:** tela `products` (CO, GP, CA, DC, DE, DS, admin).
- **Frequência · criticidade:** semanal · alta.
- **Rotas:** `/app/products`, `/app/products/[id]`, `/app/products/import`.
- **Passos:** lista: busca, filtros "Todas as linhas", "Todos os fornecedores", "Exportar (CSV)", "Novo produto" (abre o formulário na própria lista), "Importar ficha técnica", "Ver excluídos ({n})", "Excluir selecionados"/"Restaurar selecionados". Ficha: ver T23 (seções, "Salvar ficha", "Salvar ficha mestre", "Fotos", "Variações", "Fornecedores deste produto", "Classificação fiscal (NCM)", "Certificações e compliance"). Importar: "Planilha (.xlsx ou .xls)" ou link do Google Sheets, "Fornecedor", "Linha do produto", "Moeda do preço", "Resultado", "Nome base (opcional)" → "Importar e cadastrar".
- **Erros:** "\"XPTO\" é texto de exemplo, não nome de produto. Informe o nome real do produto."; "{n} produto(s) não puderam ser apagados de vez porque já estiveram em solicitação, pedido, estoque…".
- **Regras:** "Excluir definitivamente" só aparece para o admin na lista de excluídos. No fluxo de hoje o produto novo nasce na solicitação aprovada (T18); o cadastro direto serve para completar e corrigir.
- **E2E:** `search-pickers.spec.ts` (filtro de fornecedor); happy-path 5b (ficha).
- **Complexidade:** média.

#### T61 · Linhas de produto
- **Quem:** tela `lines` (GP, CA, DC, DE, admin).
- **Frequência · criticidade:** rara · alta (a linha decide certificação, agência e analista).
- **Rota:** `/app/lines`.
- **Passos:** "Nova linha de produto"; em cada linha: "Certificações obrigatórias" ("Separadas por vírgula (ex.: Inmetro, Anvisa)…"), "Agência de arte" ("Sem agência (a Wellmix faz a arte)"), "Checklist de preparação", "Prompts e regras (IA)" → "Salvar prompts e regras".
- **Depois:** "Agência salva. Pedidos abertos que a receberam: {n}."
- **Regras:** linha com certificação obrigatória põe o certificado e a arte final com o selo no pedido; a **divisão** da linha (Wellmix ou WellKids) é definida em Equipe e acessos → "Linha de produto e divisão" (só admin).
- **E2E:** sem E2E direto (o happy-path usa a linha Brinquedos, que exige Inmetro).
- **Complexidade:** média.

#### T62 · Importar planilha (CSV/XLSX) de cadastros
- **Quem:** tela `import` (CA, DC, DE, admin).
- **Frequência · criticidade:** rara · média.
- **Rota:** `/app/import` (pelo botão "Importar CSV" em Parceiros e Produtos; não tem item no menu).
- **Passos:** "Planilha do sistema chinês (XLSX/CSV)": "O que a planilha contém", "Arquivo (.xlsx, .xlsm, .csv)", "Aba (opcional)" → "Ler planilha" → conferência do mapeamento; ou "CSV direto (sem conferência)".
- **Regras:** a importação só cadastra; nunca cria login.
- **E2E:** sem E2E.
- **Complexidade:** média. **Avançado.**

### B.9 Rodapé: Configurações, Equipe e acessos, Auditoria

#### T63 · Equipe e acessos: criar login, funções e acessos da pessoa **(só admin)**
- **Quem:** administrador.
- **Frequência · criticidade:** rara · alta.
- **Rota:** `/app/team` (abas "Equipe", "Funções e acessos", "Linha de produto e divisão"), `/app/team/[id]`.
- **Passos:** "Novo usuário" → "Novo login da equipe": "Nome", "E-mail ou nome de usuário", "Senha", "Tipo de acesso" ("Equipe (só as telas liberadas)" ou "Administrador (todas as telas)"), funções, "Pedir para trocar a senha no primeiro acesso" → "Criar login". Na lista, "Editar acessos" abre o painel lateral: cargo, funções ("Adicionar função"), divisão, "Responde a", modo "Padrão das funções" ou "Personalizado", prévia "Acessos efetivos" (com a origem: "Herdado de {names}", "Padrão do portal", "Personalizado", "Removida no personalizado") → "Salvar alterações". Na página da pessoa: "Excluir acesso" (com as opções de passar os subordinados e redistribuir as pendências).
- **Depois:** "Login criado: {login}. Passe para a pessoa o endereço do portal, o login e a senha…"; "Acessos de {name} salvos."; a sessão aberta da pessoa se atualiza sozinha em até um minuto.
- **Erros:** "Este login já existe no portal. Use outro e-mail ou nome de usuário."; "A senha precisa ter pelo menos 8 caracteres."; "Você não pode excluir o próprio acesso."; "Este é o último administrador ativo da equipe: o acesso não pode ser excluído."
- **Regras:** o cargo não libera telas nem ações; as ações vêm só das funções; não há "reativar" na tela para um acesso excluído.
- **E2E:** `team-access.spec.ts`; `team-delete.spec.ts`.
- **Complexidade:** alta.

#### T64 · Funções e acessos: telas e ações de cada função **(só admin)**
- **Quem:** administrador.
- **Rota:** `/app/team?tab=functions&fn=<função>`.
- **Passos:** lista "Funções" ("Nova função" → "Nome da função" → "Criar função"); na função, abas "Telas e links" e "Ações", com busca ("Buscar permissão") e seções pelos módulos do menu (Início, Produto novo, Pedido, Produção, Entrega, Vendas, Financeiro, Painéis, Cadastros, Gestão) → um botão só, "Salvar permissões". Menu "Mais opções da função": "Renomear função", "Restaurar nome padrão", "Voltar ao padrão (telas e ações)", "Desativar função"/"Reativar função".
- **Depois:** "Permissões salvas às {time}."; vale na próxima tela de quem tem a função.
- **Erros:** "Já existe uma função com esse nome."; "As funções de fábrica não podem ser desativadas."
- **E2E:** `team-access.spec.ts` ("Designer: tela do Início e ação salvas valem no painel, no login e com a sessão aberta"); `production-screen.spec.ts`; `home-screens.spec.ts`.
- **Complexidade:** alta.

#### T65 · Linha de produto e divisão; distribuir pendências **(só admin)**
- **Rota:** `/app/team?tab=lines`.
- **Passos:** definir a divisão (Wellmix ou WellKids) de cada linha → "Distribuir agora" (`team.distribute`).
- **Depois:** "{n} solicitação(ões)/pedido(s) distribuído(s)."
- **Regras:** a solicitação nova cai sozinha no analista da divisão da linha com menos pendências.
- **E2E:** sem E2E direto. **Complexidade:** média.

#### T66 · Configurações **(só admin)**
- **Rota:** `/app/settings` e as abas "Geral", "Integração Sankhya", "Carga do Sankhya", "Condições de pagamento", "Processos", "Sankhya: explorar dados"; atalhos "Abrir o Superplan", "Resumos dos pedidos", "Go-live", "Limpar dados de teste", "Supabase".
- **O que se faz em Geral (seções):** "Fluxo e prazos" (todos os SLA: "SLA da negociação com o fornecedor (minutos)", "Prazo do convite de book (dias)", "Prazo da amostragem (dias)", prazos do pedido de compra, "NCMs que exigem LPCO", "Fatura ativa…", "Início da produção…"), câmbio manual, tabela fiscal (TEC/TIPI), "Inspeção e fila de revisão", "Containers" ("Tipos de container"), "Conformidade e pós-venda", "Pagamento ao fornecedor" (e-mail e WhatsApp do financeiro), "IA, marketing e operação", "Referências por IA na escolha do grupo (OpenAI)", "Contas de demonstração" ("Criar as contas que faltam"), "Testar IA".
- **Subtelas:** "Resumos dos pedidos" → "Reconstruir agora"; "Go-live do histórico do Sankhya" → marcar "Confirmo que a situação dos pedidos do histórico já está atualizada…" → "Fazer o go-live"; "Limpar dados de teste" → digitar APAGAR → "Apagar dados de teste" / "Apagar os testes do portal" / "Apagar os cadastros"; "Superplan" (simulação de viabilidade e "Parâmetros do Superplan").
- **Erros:** "Digite APAGAR para confirmar. Nada foi apagado."; "Marque a confirmação para fazer o go-live."
- **Regras:** pagamento, WhatsApp e e-mail aparecem como fixos ("Pagamento: {payment} · WhatsApp: {whatsapp} · E-mail: {email} (fixos até haver integração)"). A execução no Sankhya (Processos) vem desligada: a regra só registra o que faria.
- **E2E:** happy-path (Resumos, contas de demonstração); `helpers.setManualFx` (câmbio manual); `search-pickers.spec.ts` (Superplan).
- **Complexidade:** alta. Gravar em módulos separados; a maior parte é **Avançado**.

#### T67 · Auditoria
- **Quem:** tela `audit` (DC, DE, admin).
- **Rota:** `/app/audit`.
- **Passos:** filtros "De", "Até", módulo, "Pessoa", "Pedido nº", "Texto" → "Filtrar"; colunas "Quando", "Quem", "Ação", "O quê", "Antes / depois".
- **Regras:** só leitura; a tela lê os registros mais recentes ("Mostrando só os registros mais recentes. Use período, pessoa ou pedido para buscar os mais antigos.").
- **E2E:** happy-path 13; `team-delete.spec.ts`.
- **Complexidade:** baixa.

---
## C. Proposta de papéis de treinamento

Princípios: um módulo tem de 8 a 15 minutos e termina num resultado visível na tela; o que é igual para duas funções é gravado uma vez e entra nas duas trilhas; o raro vai para "Avançado". As durações são alvo de vídeo final, não de gravação.

### C.1 Trilha comum (toda a equipe, gravar uma vez)

| Módulo | Conteúdo (tarefas) | Duração |
| --- | --- | --- |
| COM-1 · Entrar e se localizar | Login, idioma, primeiro acesso e "Trocar senha" (T01); o menu por blocos, os contadores e o que some quando não há a tela | 10 min |
| COM-2 · O dia começa aqui | Control Tower (T02), Pendências e Mesa de trabalho (T03), Painel de SLA (T04) | 13 min |
| COM-3 · Falar com parceiros | Mensagens, Controladoria e Notificações (T05) | 8 min |
| COM-4 · Do bloco ao pedido | Overview de bloco, tela do passo com "Pendências" e "Todos no passo", "Resolver" (T06); achar o pedido e ler "Etapas do pedido" (T20) | 12 min |

Total: cerca de 43 min. No COM-4 vale gravar um trecho curto por papel mostrando "Só as tarefas do seu login neste pedido".

### C.2 Módulos de processo (gravados uma vez, reaproveitados)

| Módulo | Conteúdo (tarefas) | Duração | Quem assiste |
| --- | --- | --- | --- |
| PN-1 · Importar e fechar o book | T07, T08 | 15 min | CO, GP, PL, CA, DC, DE, admin |
| PN-2 · Seleção de itens e a escolha do grupo | T10, T11 (sem programação e sem cores) | 15 min | CO, GP, PL, CA, DC, DE, admin |
| PN-3 · Abrir a solicitação e o convite de book | T13, T14 | 10 min | CO, GP, PL, DC, DE, admin (CA: ver E.1) |
| PN-4 · Negociar e decidir | T15, T16 | 15 min | CO, GP, PL, DC, DE, admin |
| PN-5 · Amostragem | T17 | 8 min | CO, GP, PL, DC, DE, admin |
| PN-6 · Produto, vitrine e CODPROD | T18 | 12 min | CO, GP, DC, DE, admin |
| PN-7 · Gerar o pedido de compra e designar parceiros | T19, T21 | 12 min | CO, GP, PL, DC, DE, admin |
| PE-1 · Cadastro e fiscal: NCM e ficha mestre | T22, T23 | 15 min | CA, GP, DC, DE, admin (CO e DS como consulta) |
| PE-2 · A Preparação vista pela Wellmix | T24, T26, T28 | 14 min | CO, GP, PL, CA, DC, DE, admin |
| PE-3 · Pedido de amostras | T30 | 8 min | CO, GP, PL, DC, DE, admin |
| PR-1 · Pré-produção, follow e inspeção | T35, T36, T37 | 15 min | CO, PL, DC, DE, admin (GP recebe as pendências: ver E.12) |
| PR-2 · Embarque: booking, container na origem e frete | T39, T40 | 14 min | CO, PL, DC, DE, admin |
| PR-3 · Documentos de carga | T41 | 8 min | CO, PL, DC, DE, admin |
| EN-1 · Desembaraço e entrega | T44, T45 | 12 min | CO, PL, DC, DE, CX, admin |
| EN-2 · Recebimento no CD | T46 | 12 min | CO, PL, DC, DE, admin |
| EN-3 · Containers, fretes e tarifário | T47 | 14 min | CO, PL, DC, DE, admin (CX sem o tarifário) |
| VE-1 · Estoque, reservas e ofertas | T48, T50 | 13 min | CO, GP, CA, DC, DE, DS, admin |
| CA-1 · Parceiros e acesso ao portal | T58 | 12 min | CO, CA, DC, DE, admin |
| CA-2 · Produtos e a ficha | T60 (com T23) | 12 min | CO, GP, CA, DC, DE, DS, admin |
| CA-3 · Linhas de produto | T61 | 10 min | GP, CA, DC, DE, admin |

### C.3 Trilhas por papel

| Trilha | Módulos próprios | Módulos reaproveitados | Duração estimada |
| --- | --- | --- | --- |
| **Comprador** | nenhum (é a trilha de referência do processo) | COM-1 a 4; PN-1 a 7; PE-2, PE-3; PR-1 a 3; EN-1 a 3; VE-1; CA-1, CA-2 | 4 h 25 |
| **Planner** | PL-1 · Programação de compra: gerar na Seleção e acompanhar pedido pai e filhos (T11 avançado, T33), 15 min; PL-2 · Painéis por área (T56), 8 min | COM-1 a 4; PN-1 a 5, PN-7; PE-2, PE-3; PR-1 a 3; EN-1 a 3 | 4 h |
| **Gerente de produto** | GP-1 · Mesa do GP: amostras a avaliar e certificados pendentes (T03, T17, T28), 10 min | COM-1 a 4; PN-1 a 7; PE-1 a 3; VE-1; CA-2, CA-3 | 3 h 30 |
| **Cadastro** | CD-1 · Mesa "Cadastro e fiscal" e a rotina do dia (T03, T22, T23), 10 min; CD-2 · Revisão (T29), 8 min | COM-1 a 4; PN-1, PN-2; PE-1, PE-2; VE-1; CA-1 a 3 | 2 h 50 |
| **Designer (marketing)** | DS-1 · Fazer a arte e a arte final com o selo (T25), 14 min; DS-2 · Fotos e vídeos reais: aprovar e ativar a venda (T38), 10 min; DS-3 · Mesa "Marketing" e produtos fora da vitrine (T03), 8 min | COM-1 a 4; CA-2; VE-1 (só Ofertas) | 1 h 40 |
| **Financeiro (função)** | FI-1 · Numerário e faturamento dentro do pedido (T43, T45), 12 min | COM-1 a 4 | 55 min |
| **Comex (interno)** | CX-1 · Rastreio diário do container (T42), 8 min | COM-1 a 4; EN-1; EN-3 (Containers e Fretes) | 1 h 20 |
| **Diretorias** (compras e executiva: uma trilha só) | DI-1 · Assinar o contrato pela Wellmix (T31), 10 min; DI-2 · Acompanhar: Painéis por área, SLA da equipe e Auditoria (T56, T04, T67), 14 min | COM-1 a 4; PN-4, PN-5 (decisões); PE-3; visão geral do processo (um resumo de 15 min montado com trechos dos módulos de processo) | 1 h 55 |
| **Administrador** | AD-1 · Criar logins e editar acessos (T63), 15 min; AD-2 · Funções e acessos (T64), 15 min; AD-3 · Divisões e distribuição (T65), 8 min; AD-4 · Configurações do dia a dia: prazos, câmbio, tabela fiscal, containers, contas de demonstração (T66), 15 min; AD-5 · Pagar o fornecedor: sinal e Contas a pagar (T32), 12 min; AD-6 · Financeiro, Fluxo de caixa e Painel do dono (T51, T52, T57), 12 min; AD-7 · O que só o admin faz no cadastro do fornecedor: condição de pagamento, início da produção, fatura ativa (T58), 10 min | Todos os módulos comuns e de processo (o admin pode assistir à trilha do Comprador como base) | 1 h 30 próprios + 4 h 25 da base |

### C.4 Tarefas idênticas entre trilhas (gravar uma vez)

- Tudo de C.1 (T01 a T06 e T20) é igual para todas as funções; só muda o que aparece na lista.
- PN-1 a PN-5 e PN-7 são iguais para Comprador, Gerente de produto, Planner e Diretorias (mesmas telas e ações no padrão). PN-6 não vale para o Planner.
- PE-1 é igual para Cadastro e Gerente de produto; CA-3 também.
- PR-1 a PR-3 e EN-1 a EN-3 são iguais para Comprador, Planner e Diretorias.
- Diretoria de compras e Diretoria executiva têm exatamente as mesmas telas e ações (as ações que as distinguiam, as aprovações do pré-custo, saíram).
- O operador de demonstração (Comprador + Planner) serve para gravar as duas trilhas com uma conta só.

### C.5 Avançado (raro, gravar depois)

| Módulo | Tarefas | Para quem |
| --- | --- | --- |
| AV-1 · Programação de compra com cores e caixas por cor | T11 (cores), T33 | CO, PL, GP |
| AV-2 · Referências por IA para o fornecedor | T12 | CO, GP |
| AV-3 · Status do book, refazer a análise, responsável | T09 | CO, PL, GP, CA |
| AV-4 · Não conformidade da arte e o zip das artes | T27 | CO, DS |
| AV-5 · Revisão e "Liberar etapa" | T29 | CO, GP, CA |
| AV-6 · Reprovar SKU, tentativas esgotadas e cancelamento | T37, T34 | CO, PL, admin |
| AV-7 · Compra EXW: custos de origem | T39, T40 | CO, PL |
| AV-8 · Inventário às cegas e movimentações | T49 | admin, CO, CA |
| AV-9 · Importar ficha técnica e CSV | T60, T62 | CA |
| AV-10 · Multas | T54 | DC, DE, admin |
| AV-11 · Tipos de parceiro e Acessos externos | T59 | admin |
| AV-12 · Acordos e comissões | T53 | admin |
| AV-13 · Superplan e parâmetros | T66 | admin |
| AV-14 · Sankhya: integração, carga, processos e go-live | T66 | admin |
| AV-15 · Resumos, limpar dados de teste, devolver assinatura | T66, T31 | admin |

---

## D. Divergências doc × código e o que está documentado sem estar em uso

### D.1 Documentos que ainda descrevem o fluxo antigo (RFQ, cotação, proposta, sinal do cliente)

| Onde | O que diz | O que o código faz hoje |
| --- | --- | --- |
| `docs/SCOPE.md` (macrofluxo, tabela de papéis, "Vertical slice 1") | Sourcing → RFQ → cotações → sinal → pedido | Não existe rota `/app/quotes`; o caminho é Book → Seleção → solicitação ao fornecedor → produto → pedido de compra |
| `docs/OPEN_DECISIONS.md` | Chaves `quotationExpirationDays`, `downPaymentPercent`, `packagingBrief*`, Pix do sinal | São da RFQ e do briefing de embalagem, removidos em 11/11/2026 |
| `docs/PURCHASE_FLOW.md` | Dumping com "Liberar dumping", validações do comprador e do cadastro na Preparação | Ações de dumping e pré-custo estão em `RETIRED_ACTIONS`; no pedido de compra, NCM e ficha são conferidos pelo sistema |
| `docs/SUPERPLAN.md` | Tela em "Pedidos → Superplan"; seção 11, "abrir faca e RFQ" pelo Superplan | O Superplan saiu do menu (atalho em Configurações → "Abrir o Superplan"); não há mais o cartão de RFQ na tela |
| `docs/DASHBOARDS.md` | Compras: aguardando cotação, a escolher fornecedor, aprovações pendentes, dumping | A área Compras mostra "Solicitações abertas", "Solicitações ao fornecedor esperando resposta" e "Respondidas, a Wellmix decide" |
| `docs/CERTIFICATION.md` seção 3 | "Pedido gerado (sinal confirmado da solicitação cujo fornecedor ganhou a RFQ)"; briefing de embalagem na RFQ | O pedido nasce no quadro "Gerar pedido de compra" |
| `docs/BOOKING.md` | Campo "Responsável pelo booking" | Na tela o campo é "Fornecedor" e a fábrica é "Fábrica" (`bookingLots.partner.title`, `bookingLots.detail.supplier`) |
| `docs/videos/07` (WSO-01 a WSO-04), `08` (WPE-01, WPE-02) | RFQ, comparação de cotações, proposta e sinal, ficha de compra na Preparação | Não valem para o pedido de compra de hoje; use só WBK-01 a WBK-05 como pista, conferindo os rótulos (a etapa agora se chama Book) |

### D.2 Textos de tela que ficaram para trás

- **Descrição das funções** (`function.desc.*`, mostrada em Equipe e acessos → Funções e acessos): "abre RFQ, escolhe fornecedor…" (Comprador), "aprova o pré-custo (1º nível)…" (Planner), "libera dumping…" (Gerente de produto), "aprova o pré-custo (2º nível)…" e "(3º nível)" (Diretorias). Nada disso existe mais.
- **Aviso de acesso negado**: "Peça ao administrador em Gestão → Equipe e divisões." (`access.denied`). Não há grupo "Gestão" no menu; o item é "Equipe e acessos", no rodapé. A própria tela tem o título "Equipe e divisões".
- **Tela escondida da solicitação do cliente**: "RFQ aberta: os fornecedores respondem pelo link recebido." e "A Wellmix vai cotar com os fornecedores e mandar a proposta."
- **Tipos de pendência que não nascem mais**, ainda no dicionário: "Abrir RFQ", "Responder cotação", "Escolher fornecedor", "Aprovação do pré-custo", "Confirmar sinal", "Embalagem (faca e arte)".
- **Avisos de esquema**: "As tabelas do book ainda não foram publicadas no banco (npm run appwrite:push)." O banco de produção é o Supabase.
- **Painéis por área**: nota "Integração com o Sankhya: em modo manual até as credenciais serem configuradas…" (`dash.erpNote`); ⚠ não confirmei o estado real da integração em produção.

### D.3 `docs/ACCESS.md` × código

- A matriz da seção 4 não tem as colunas **Financeiro** e **Comex (interno)** (o Comex interno abre Pedidos, Containers, Fretes e Histórico) e lista a tela "Embalagem (briefings)", que não existe mais em `SCREENS`.
- A tabela de ações diz que "Assinar o contrato pela Wellmix" é de "quem abre Pedidos"; o código (e a seção de 13/11 do mesmo documento) dá só às Diretorias. A tabela não traz "Validar a amostragem", "Aprovar as fotos e vídeos reais", "Rastrear o container" e "Receber o aviso de pedido de compra".
- "Registrar e confirmar pagamentos … continua exigindo a tela Financeiro": as ações conferem o **papel admin** (`assertRole(["admin"])` em `registerSupplierPaymentAction`, `quickSupplierPaymentAction`, `registerCustomerPaymentAction`, `saveSupplierTermsAction`).
- "Financeiro é só do administrador … no pedido, o cartão financeiro": confere para o cartão "Financeiro do pedido", mas o "Resumo do pedido" mostra "FOB" e "Valor de venda" e os "Itens do pedido" mostram "Preço unitário (FOB)" a qualquer login da Wellmix (`canSeeInternalCosts = isWellmix`). Mesma observação em `docs/videos/ACHADOS.md`, item 3.

### D.4 Documentado e não implementado, em espera ou em modo manual

| Item | Situação | Fonte |
| --- | --- | --- |
| Mesas de trabalho de diretoria, comprador, planner, financeiro, vendas e logística | Não existem; só GP, Cadastro e fiscal, Marketing (e as de agência e certificadora) | `docs/DESKS.md` |
| Solicitação do cliente (vitrine) e **compra para estoque** | A solicitação é criada e fica parada em "Solicitada"; não há continuação. Os botões "+ Compra para estoque" e "Comprar {n}" do Estoque abrem `/app/requests/new`. Vendas → Venda (`/app/flow/sales/sale`) só conta pendências dessas telas escondidas | `docs/QUOTE_FLOW.md`, `src/app/app/inventory/page.tsx` |
| Vitrine do cliente, Orçamentos, Histórico, Marketing (kits, tabela de preços), Pós-venda | Telas prontas, fora do menu de todos | `MENU_HIDDEN` |
| Sourcing | "Sourcing (em espera)": a tela guarda os dados e tem o interruptor do administrador | E2E happy-path |
| Recebimento das amostras no show room do Brasil | "Fica para depois" | `docs/SAMPLE_FLOW.md` |
| Página "Shipping Mark" e foto no PDF do pedido; EAN, DUN, LI, comissão | Em branco no documento | `docs/ORDER_SIGNATURE.md` |
| Extrato de comissão no login do parceiro; permissões separadas de comissão | "Ainda não" | `docs/COMMISSIONS.md` |
| Reativar um acesso excluído | Não há na tela | `docs/ACCESS.md` |
| E-mail e WhatsApp | Mock: o aviso é registrado, não enviado | `docs/INTEGRATIONS.md`, `settings.fixedModes` |
| Pagamento | Manual (o administrador registra) | idem |
| Booking no navio, comex e aduana, rastreio do container | Entrada manual; o rastreio é a pendência diária do Comex interno | `docs/INTEGRATIONS.md`, `docs/ORIGIN_CONTAINER.md` |
| Tarifário de frete | Manual, por planilha de cada companhia | idem |
| Sankhya | Execução desligada por padrão ("simulado"); sem credencial, o CODPROD fica "não conferido". ⚠ Estado em produção não verificado | `docs/PROCESSES.md`, `docs/SANKHYA.md` |
| Histórico do Sankhya | Pedidos da carga ficam "em espera", sem pendências, até o go-live | `docs/FLOW_MENU.md` |
| IA (texto, NCM, imagens) | Depende de chave; sem ela, botão desligado ou exemplo "mock" | `docs/INTEGRATIONS.md` |
| Assinatura do contrato | Arquivo assinado e carimbado; não é certificado digital | `docs/ORDER_SIGNATURE.md` |

### D.5 Telas que existem e estão fora do menu

| Tela | Rota | Como se chega | Quem abre |
| --- | --- | --- | --- |
| Lista de pedidos | `/app/orders` | "Lista de todos os pedidos" em Pedido → Pedidos | tela `orders` |
| Mesa de trabalho | `/app/tasks/desk` | "Mesa de trabalho" em Pendências | tela `tasks` |
| NCM dos books | `/app/ncm-items` | Pendências; link no book | tela `tasks` |
| Controladoria de mensagens | `/app/messages/control` | "Controladoria" em Mensagens | tela `messages` |
| Clientes, Fornecedores, Avaliação de fornecedores | `/app/customers`, `/app/suppliers`, `/app/suppliers/scorecard` | Links em Parceiros | tela `parties` |
| Tipos de parceiro, Acessos externos | `/app/parties/types`, `/app/parties/access` | Abas de Parceiros | `parties`; alterar, só admin |
| Importar planilha | `/app/import` | "Importar CSV" em Parceiros e Produtos | tela `import` (CA, DC, DE) |
| Importar ficha técnica | `/app/products/import` | Botão em Produtos | tela `products` |
| Inventário, Reservas, Movimentações | `/app/inventory/counts`, `/reservations`, `/movements` | Links no Estoque | tela `products` |
| Superplan | `/app/superplan` | Configurações → "Abrir o Superplan" | só admin |
| Resumos, Go-live, Limpar dados, Supabase, abas do Sankhya | `/app/settings/*` | Atalhos e abas de Configurações | só admin |
| Ficha de compra do pedido; invoice e packing list gerados | `/app/orders/[id]/purchase-sheet`, `/app/orders/[id]/invoice` | Dentro do pedido (fluxo antigo) | tela `orders` (ver D.6) |
| Conta corrente do fornecedor | `/app/account?supplier=<id>` | Link "Conta corrente" no cadastro do fornecedor; sem o parâmetro, volta ao início | só admin |
| Solicitações, Vitrine, Sourcing, Marketing, Pós-venda, Histórico | `MENU_HIDDEN` | Só pelo endereço | conforme A.2 |

### D.6 Pontos em que o fluxo de hoje e as telas antigas convivem (confirmar antes de roteirizar)

- **Ficha de compra do pedido.** A pendência "Fazer a programação de compra: pedido #{n}" (só admin) e a tela `/purchase-sheet` são do fluxo antigo. O comentário do E2E diz que os pedidos de compra de hoje não têm ficha de compra. ⚠ Não confirmei se algum pedido de compra novo chega a ter.
- **Containers × "Container na origem".** O caminho principal registra o container nos passos do pedido e não cria nada em `/app/containers`. O Estoque (`docs/INVENTORY.md`) soma itens de container e compras para estoque. ⚠ Não confirmei como a mercadoria de um pedido de compra de hoje entra no Estoque.
- **Certificação: laudo e registro.** `docs/CERTIFICATION.md` diz que são do despachante; no código os passos existem (`cert_lab`, `cert_registration`) com roteamento próprio. ACHADOS (item 7) diz que não aparecem mais na tela. ⚠ Não reverifiquei.
- **Rótulos do menu.** O menu mostra "Canal cinza ou vermelho" (o doc diz "Canal") e "Tarifário de frete" (o doc diz "Tarifário"). O item "Cotações" abre os convites de book, não cotações.
- **ACHADOS.** Confirmei no código os itens 3 (operador vê FOB e venda no resumo) e 6 (Painel do dono e Fluxo de caixa pedem duas telas). O item 14 (cadastro novo nasce inativo) consta como corrigido em `docs/PARTNER_TYPES.md`; não reverifiquei. Os demais não foram reverificados.

---

## E. Dúvidas de permissão

1. **Cadastro abre a solicitação e não consegue vê-la.** Abrir a solicitação pede só a tela `booking`; a tela da solicitação pede `quotes`, que o Cadastro não tem. Depois de "Abrir solicitação de todos", ele seria levado a uma tela que recusa. Decidir se o Cadastro deve abrir solicitações.
2. **Planner aprova, mas não cria o produto.** O bloco Produto pede `quotes` e `products`; o Planner não tem Produtos nem Parceiros (para criar o acesso do fornecedor). O fluxo dele para em "Aprovar" e na amostragem.
3. **Comex (interno) sem a tela Produção.** A tarefa diária dele (rastreio) é do passo Produção → Embarque, que o menu dele não mostra; ele chega pelo "Abrir" das Pendências. Ele também passa no filtro das pendências de embarque (tela `freight`).
4. **"Validar a arte" é de todas as funções no padrão** (quem abre Pedidos), inclusive Financeiro, Comex interno e Designer. A validação vai ao responsável do pedido, mas o reserva "quem tem a ação" alcança todos.
5. **Painel do dono e Fluxo de caixa.** O menu mostra com a tela Financeiro; a página exige também "Painéis por área" (`requireScreen("dashboards")` e depois `canOpen("finance")`).
6. **Valores para o operador.** Além do Resumo e dos Itens do pedido (D.3), o operador vê preço do book, custo por peça, preço mínimo e lucro na Seleção e na Negociação. `docs/ACCESS.md` trata isso como "trabalho de compra"; confirmar se vale também para Cadastro e Designer.
7. **Ações do pedido conferem só a tela Pedidos**, que todas as funções têm: salvar produção e ETD, follow, agendar inspeção, aprovar ou reprovar SKU, pedido de amostras, parceiros e designer, frete marítimo, recebimento, "Registrar faturamento". As pendências são roteadas por função, mas o servidor aceita de qualquer login da Wellmix que abra o pedido.
8. **Pagamentos e condição de pagamento.** Só o papel admin grava, mesmo que um operador receba a tela Financeiro no Personalizado (ele veria o cartão e o botão seria recusado).
9. **Quem valida o NCM.** Qualquer login com Produtos (Comprador e Designer inclusive) e o despachante; a pendência vai para quem abre Linhas (Cadastro, Gerente de produto, Diretorias).
10. **Contraproposta e mensagens** pedem só a tela Cotações; "Aprovar/Recusar/Cancelar" pede a ação. Um login com a tela e sem a ação negocia e não decide.
11. **Tarifário.** Importar a planilha (operador com a tela) atualiza sozinho o frete por m³ das Configurações ("Atualiza sozinho a cada tabela importada…"), enquanto aplicar à mão é só do admin.
12. **Pendências de "compras"** (follow, inspeção, designar despachante, confirmar o pedido) vão a todos com "Gerar pedido de compra": Comprador, Gerente de produto, Planner e Diretorias. O Gerente de produto recebe pendência de inspeção sem ter o bloco Produção.
13. **Função Financeiro** recebe o numerário (passo Entrega → Presença de carga) sem a tela Containers: trabalha só por Pendências → pedido.
14. **Só o admin é lembrado** do sinal ao fornecedor, do pagamento ao fornecedor e do certificado sem certificadora. Se o admin não olhar, ninguém mais recebe a pendência.
15. **Padrão × produção.** Tudo em A vem do padrão do código. Sem E2E para as funções Gerente de produto, Cadastro, Financeiro, Comex interno e Diretorias (só Comprador + Planner e Designer aparecem nos testes): antes de gravar, abrir cada trilha com um login real da função e conferir o menu.
16. **Auditoria no Personalizado** (ACHADOS, item 5: daria 404 para quem não é admin nem diretoria). Não reverifiquei.

---

## F. Termos e siglas de pronúncia ambígua em português (aparecem nas telas)

Decidir a pronúncia de cada um antes de gravar e manter igual em todas as trilhas.

| Termo | Onde aparece | O que é | Dúvida |
| --- | --- | --- | --- |
| Book × Booking | "Books", "Importar book", "Book nº {n}" × "Booking" (Produção) | Book = planilha do fornecedor; Booking = reserva de praça no navio | Duas palavras parecidas com sentidos diferentes; em inglês ou aportuguesado |
| FOB, EXW | Book, solicitação, "Incoterm do pedido", "Valor de compra (FOB)" | Modalidades de entrega (incoterms) | "fób" ou letra a letra; "é-xis-dáblio" ou "ex works" |
| CBM | Book, Seleção, containers | Metro cúbico (volume da caixa) | Letra a letra ou "metro cúbico" |
| NCM | Book, produto, "NCM dos books" | Classificação fiscal | Letra a letra |
| MOQ | Solicitação, Die Cut, contrato ("Pedido mínimo (MOQ)") | Pedido mínimo | "móqui" ou letra a letra |
| SKU | Inspeção por SKU, conferência por SKU | Item do pedido | "esse-cá-u" ou "skiú" |
| SLA | "Painel de SLA", "Situação / SLA" | Prazo combinado | Letra a letra em português ou inglês |
| KPI | **Não aparece nas telas em português** (só em docs e código: `kpi_snapshots`) | Indicador | Usar "indicador" |
| ETD, ETA | "ETD (saída prevista)", "ETA (chegada prevista)" | Datas previstas de saída e chegada | Letra a letra em português ou inglês |
| BL, Draft do BL | "BL (original)", "Nº do BL", "4. BL (companhia marítima)" | Conhecimento de embarque (Bill of Lading) | "bê-ele" ou "bi-él" |
| DI/DUIMP, CE Mercante, CI | "DI/DUIMP e XML", "CE Mercante", "Comprovante de importação (CI)" | Documentos do desembaraço | "duímp"; "cê-é mercante" |
| DANFE | "DANFE (nota de entrada)" | Nota fiscal de entrada | "dânfe" ou "danfê" |
| LPCO | Entrega → "LPCO", "NCMs que exigem LPCO" | Licença da importação | Letra a letra |
| LI | "LI automática" (tratamento administrativo do NCM) | Licença de importação | Letra a letra |
| RIC | Recebimento: "RIC", "Nº do RIC" | Registro de inspeção do container | "rík" ou letra a letra |
| POP | "Custos do transporte na origem (POP)" | Custos de origem na compra EXW | "póp" ou letra a letra |
| RADAR, Siscomex | Cadastro do cliente ("Habilitação RADAR") | Habilitação de importador | Sem dúvida de leitura; explicar na primeira vez |
| TEC, TIPI, II, IPI | Configurações (tabela fiscal), Superplan ("II (%)", "IPI (%)") | Tabelas e impostos | "téc", "tipí"; "II" como "imposto de importação" |
| PTAX, IOF, AFRMM, THC | Tarifário de frete, Superplan | Câmbio de referência, imposto e taxas do frete | "pê-táx"; letra a letra nas demais |
| OCP, Inmetro, Anvisa | "Faz: OCP", "OCP (certificação)", certificações da linha | Organismo de certificação e órgãos | Letra a letra para OCP |
| Superplan | Book, Seleção, Negociação, Configurações | Estudo de viabilidade e preço mínimo | "súper-plan" ou "superplã" |
| Sankhya, CODPROD, CODEMP, CODGRUPOPROD, REFFORN, DESCRPROD, NUNOTA, TOP, AD_FREINT | Bloco Produto da solicitação, Configurações, tarifário | ERP e os campos dele | "sânquia"; os códigos, melhor mostrar na tela e dizer "o código do produto no Sankhya" |
| Die Cut, Die-Cut, faca, dieline | "Die Cut" (quadro), "Die-Cut, Arte e Certificação" (etapa), "Faca (die cut)" (item) | A faca da embalagem | Três grafias na tela; "dái cãt"; escolher "faca" como palavra falada |
| Pantone (C, U, M, P, TCX) | Ficha do produto | Tabela de cores | "pantône" ou "pântone" |
| Control Tower, Overview, Follow, Go-live, Show room, Check list, Packing list, Invoice, Draft | Menu e cartões | Termos em inglês usados como nome de tela ou documento | Pronúncia em inglês ou aportuguesada; manter uma só |
| Trading, Trade (revenda), Factory, Supplier, GP | Tipos de parceiro; "Fornecedor é: Fábrica / Trade (revenda)" | Tipos de parceiro | **GP é ambíguo**: tipo de parceiro "GP" e a mesa "Gerente de produto"; "Supplier" é um tipo e "Fornecedor" é um papel |
| Inner, caixa master | Book, ficha ("Unidades por inner box") | Caixa interna e caixa master | "íner" |
| 40HC, 20GP, 40GP | Tipos de container | Container de 40 pés high cube etc. | "quarenta agá-cê" ou "quarenta high cube" |
| RMB, USD, BRL, US$ | Book, solicitação, Superplan | Moedas | "erre-eme-bê" ou "yuan/renminbi" |
| Numerário | Embarque e desembaraço | Adiantamento das despesas do desembaraço | Sem dúvida de leitura; explicar |
| CC | Só em docs ("sinal ou conta corrente") | Conta corrente | Na tela aparece por extenso |
| Pix, T/T, SWIFT, IBAN, WeChat, Yiwu | Cadastro do fornecedor, financeiro | Meios de pagamento, dados bancários, contato e cidade | "tê-tê"; "suífit"; "í-ban"; "uí-chét"; "í-u" |
| WellKids | Divisão da equipe e das linhas | Divisão infantil | "uél-quids" |
| XLSX, CSV, PDF, QR Code | Importações e documentos | Formatos de arquivo | Letra a letra |
