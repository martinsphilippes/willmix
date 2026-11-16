# Menu por blocos do mapa e contadores de trabalho

Pedido do dono (14/11/2026): o menu lateral segue os blocos do mapa do processo (repositório `attilasm/wellmix-presentation`, aba Mapa) para o analista ver onde tem trabalho esperando por ele. Cada passo do menu tem uma bolinha com quantas pendências esperam ação ali, vermelha quando alguma já passou do prazo.

## Estrutura

| Bloco (mapa)        | Itens                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto novo (Book) | Overview, Books, Seleção de itens, Convites de book, Encomendas (B14), Reposição (B10), Estratégia de compra (B10?), Cotação de compra (B13), Negociações (solicitações ao fornecedor, com a amostragem) |
| Pedido              | Overview, Pedidos, Certificação, Material de arte, Arte, Revisão, Contrato                                                                                                                               |
| Produção            | Overview (`/app/production`), Pré-produção, Inspeção, Amostra, Produção, Booking (marítima), Logística, Carregamento, Documentos de carga, Embarque                                                      |
| Entrega             | Overview, LPCO, Presença de carga, Canal cinza ou vermelho, Logística, Nota fiscal, Entrega, Retorno, Armazenagem; Containers, Fretes e Tarifário seguem no fim                                          |
| Vendas              | Estoque, Amostras, Ofertas, Venda                                                                                                                                                                        |
| Financeiro          | Financeiro, Contas a pagar, Fluxo de caixa (saiu de Painéis), Acordos e comissões, Multas                                                                                                                |
| Painéis             | Painel do dono, Painéis por área, Painel de SLA (só leitura, sem contador)                                                                                                                               |
| Cadastros           | Clientes, Produtos, Linhas                                                                                                                                                                               |

Fixos embaixo: Configurações, **Equipe Acessos e Parceiros** e Auditoria. Parceiros saiu de Cadastros (dono, 15/11/2026) e virou uma seção de Equipe Acessos e Parceiros; veja "Equipe Acessos e Parceiros" abaixo.

Mensagens e Notificações saíram do menu de todos os papéis; ficam no cabeçalho, com o contador de não lidas. O Superplan saiu de Painéis e virou atalho em Configurações. Nenhuma tela ou rota foi removida.

## Equipe Acessos e Parceiros

Pedido do dono (15/11/2026): a área de Parceiros (antes Cadastros → Parceiros) entrou na área de Equipe, que passou a se chamar **Equipe Acessos e Parceiros** no menu e no título.

- **Seções** (no padrão de abas da área, `src/components/team-area-nav.tsx`): Equipe, Áreas (16/11/2026; docs/ACCESS.md, "Áreas da equipe"), Funções e acessos, Linha de produto e divisão (`/app/team?tab=team|areas|functions|lines`) e **Parceiros** (`/app/parties`).
- **Abas de Parceiros**: dentro da seção Parceiros, as três de sempre: Cadastros (`/app/parties`), Tipos de parceiro (`/app/parties/types`) e Acessos externos (`/app/parties/access`). As telas, os filtros, as ações e os dados não mudaram.
- **Endereços**: não mudaram. Os links antigos (`/app/parties` com os filtros `?type=…&q=…`, `/types`, `/access` com os painéis, `/app/parties/<id>`, `/app/parties/new`, `/app/customers` e `/app/suppliers`) continuam abrindo a mesma tela, sem redirecionamento.
- **Sem clientes** (dono, 15/11/2026): a lista de Parceiros não mostra clientes, nem em "Todos os tipos", e o filtro não tem mais a opção Clientes (veja "Cadastros → Clientes" abaixo).
- **Permissões**: as mesmas.
  - Equipe, Funções e acessos e Linha de produto e divisão: quem abre Equipe (o administrador).
  - Parceiros (Cadastros e Tipos de parceiro): quem abre Parceiros (administrador, Comprador, Catálogo, diretorias e quem recebeu a tela).
  - Acessos externos: só o administrador.
  - Cada login vê no menu e na área só as seções que já abria. As páginas e as ações conferem de novo.
- **Menu**: um item só no rodapé, "Equipe Acessos e Parceiros".
  - Para quem abre Equipe, ele leva à Equipe; para quem só abre Parceiros, direto a Parceiros.
  - Acende nas telas de Equipe e de Parceiros (`NavLink.match`), e o "Voltar" sem tela anterior continua levando a Parceiros.
  - Quem não abre nenhuma das duas não vê o item.

## Cadastros → Clientes

Pedido do dono (15/11/2026): os clientes saíram de Equipe Acessos e Parceiros → Parceiros → Cadastros e ganharam a página própria em Cadastros.

- **Página**: `/app/customers`, a tela Clientes que já existia (só clientes; antes fora do menu, com o link no subtítulo de Parceiros). Tem a busca (nome, CNPJ, telefone, e-mail, cidade), o filtro Ativos/Inativos/Todos, a operação em lote e a exportação, a conta de cada cliente (só para quem vê valores) e os atalhos de cada linha (nova solicitação, ficha, editar o cadastro, conversa).
- **Vindo de Parceiros**: o Login de acesso de cada cliente (os logins ativos, com o link para o quadro de acesso do cadastro, `/app/parties/<id>#access`), embaixo do nome para a tabela seguir cabendo em 1366 px, e o botão Importar CSV.
- **Ficha e cadastro**: os de sempre. A ficha (`/app/customers/<id>`) tem a conta e os logins; o cadastro (`/app/parties/<id>`) tem a edição, o RCA e o quadro de acesso.
- **Parceiros**: sem clientes na lista, nem em "Todos os tipos". O filtro não tem mais Clientes e o subtítulo não leva mais à lista de clientes. Fornecedores e os demais tipos seguem lá, com as três abas.
- **Endereço antigo**: `/app/parties?type=customer` leva a `/app/customers`.
  - Leva junto a busca (`q`) e a ordem por nome (`sort=name` ou `-name`), a única coluna que existe nas duas listas.
  - O tipo e a página não vão, porque não existem lá.
- **Permissões**: as de antes. Clientes aparece em Cadastros e abre para quem abre Parceiros: administrador, Comprador, Catálogo, diretorias e quem recebeu a tela. Os valores continuam só para quem vê valores.
- **Dados**: nada mudou. Os mesmos cadastros (`parties` do tipo cliente), IDs, RCA, logins, solicitações e pedidos. O seletor de cliente (`/api/parties/search`) e a Nova solicitação seguem iguais.
- **Menu**: Clientes acende na lista e na ficha do cliente; o item Equipe Acessos e Parceiros deixou de acender em `/app/customers`. No cadastro do cliente (`/app/parties/<id>`, o mesmo de todos os parceiros), o menu acende Equipe Acessos e Parceiros.

## Telas

- **Overview do bloco** (`/app/flow/<bloco>`; o da Produção é `/app/production`): à esquerda, a linha do tempo vertical dos passos na ordem do mapa, com quantas esperam ação, quantas atrasaram e há quantos dias (média e a mais antiga); à direita, a tabela com os casos do passo escolhido (`?step=…`) e o atalho para resolver.
- **Tela do passo** (`/app/flow/<bloco>/<passo>`): os casos do passo, com o prazo, há quantos dias chegaram, filtros de prazo (`?due=overdue|today|week`) e o botão Resolver, que leva à tela focada do pedido quando ela existe (Die Cut, documento do pedido, documentos de embarque, amostras, fotos reais) ou ao ponto do pedido onde se faz. Desde 14/11/2026 a tela é só a lista na Certificação e na Arte (todos os logins) e em todos os passos para a Wellmix; os cartões abaixo ("Resolver aqui", itens de etapa e produção) ficam para os parceiros nos outros passos deles (ver "Arte no mesmo padrão e as outras telas só com a lista para a Wellmix").
- **Resolver aqui** (na tela do passo): para cada pedido com caso aberto no passo (até 15), o mesmo cartão de passos do detalhe do pedido, só com os passos deste ponto do mapa: Certificação (memorial, selo e arte com o selo), Booking, Logística (container na fábrica e vazio), Carregamento (carregado e lacrado), Documentos de carga (draft BL, invoice e packing, BL), Embarque (container no porto e rastreio), Amostra (retirada, envios, devolução), Presença de carga (presença, numerário, DI, CE Mercante, CI), Canal e Nota fiscal (DANFE). Mesmas regras e Server Actions do pedido; a ação volta para a tela do passo (`returnTo`, só `/app/flow/<bloco>/<passo>`). O detalhe do pedido continua com tudo.
- **Itens de etapa e produção na tela do passo** (segunda parte, 14/11/2026): os itens de etapa do pedido que caem no passo, pedido a pedido, com o mesmo formulário do detalhe do pedido (`RequirementForm`): arte, validação (com a arte enviada para abrir) e arte final com o selo em Arte; o certificado em Certificação; medidas, ficha e assinatura nos passos deles. Só aparecem os itens que o login pode fazer agora (mesma regra do pedido, com a do responsável por login nas quatro tarefas da Preparação). Em Produção → Produção, o cartão de produção com dados, ETD e follow 5/15/25; em Produção → Inspeção, a agenda e a inspeção por SKU com a correção do fornecedor; em Pedido → Arte, as não conformidades da arte (correção da agência e revisão da Wellmix). As Server Actions de requisito, produção, arte e embarque aceitam `returnTo` (só `/app/flow/<bloco>/<passo>`, `flowReturnTo` em `src/app/app/actions/helpers.ts`) e voltam para a tela do passo.
- **Terceira parte** (14/11/2026):
  - **Itens com tela e ação próprias** não ganham o formulário comum na tela do passo (o envio comum recusa): o documento do pedido e as assinaturas (documento do pedido), o pedido de amostras, o pedido mínimo e o prazo (quadro Die Cut) e a ficha de compra. No lugar, o botão para a tela deles (`ownScreenOf` em `src/components/flow-step-forms.tsx`).
  - **Recebimento no CD** em Entrega: Armazenagem (descarga, lacre, fotos, checklist e contagem por SKU) e Retorno (RIC, devolução do container e fechamento), com o cartão de recebimento do pedido dividido em duas partes (`sections`). Os casos saem dos recebimentos abertos de pedidos já entregues no CD (ou com a descarga começada): falta descarga ou contagem, Armazenagem; senão, Retorno. Contam no menu, mas não são pendências: a tela Pendências e a bolinha dela não mudam (`flowReceivingCasesFor` em `src/lib/services/flow.ts`, só para a Wellmix com a tela Containers).
- **Quarta parte** (14/11/2026):
  - **Pré-produção** ganha casos: pedido em andamento com o sinal ao fornecedor pago (item `down_payment` concluído) e a produção sem ETD. A tela mostra a parte "dados e ETD" do cartão de produção; salvar o ETD tira o caso. Contam no menu, fora das Pendências (`flowPreProductionCasesFor`, Wellmix com a tela Produção).
  - **Produção → Logística** traz o frete marítimo do pedido (pedir às companhias e as respostas), para os pedidos com caso no passo. O pedido de frete aceita `returnTo` e volta para a tela do passo.
- **Quinta parte** (14/11/2026): o **relatório da inspeção** (medidas × comprado, fotos, decisão da revisão, divergências) saiu do detalhe do pedido para um componente próprio (`src/components/inspection-result-card.tsx`) e aparece também em Produção → Inspeção, ao lado da agenda e da decisão por SKU, para todo pedido com caso no passo (inclusive o item "inspeção aprovada pela Wellmix" da etapa). O caminho principal aprova o SKU nessa tela.
- Passos que já tinham tela (Books, Seleção, Convites de book, Encomendas, Negociações, Pedidos, Revisão, Estoque) abrem a tela de sempre, com o contador.
- Todos os passos do menu têm fonte de pendência (LPCO, Amostras e Ofertas desde 14/11/2026).

## Abas da tela do passo (14/11/2026)

- **Pendências** (padrão): o que espera ação do login no passo, como acima.
- **Todos no passo** (`?tab=all`, só a Wellmix): todos os pedidos que estão no passo agora, de qualquer responsável, com o fornecedor, a etapa do pedido, o que está aberto no passo e há quantos dias; o link abre o detalhe do pedido. Fonte (`flowAllFor` em `src/lib/services/flow.ts`, leitura sob demanda, fora do menu):
  - itens não concluídos dos marcos em andamento (ou travados), no passo do item (fase 5g: pelo passo gravado no item e pela linha do marco, `openMilestoneItems`; antes, as etapas em andamento);
  - passos do embarque, da origem, da certificação e das amostras prontos e não concluídos (`openImportStepKeys` em `src/lib/services/import-flow.ts`): embarque, origem e amostras só com o contrato concluído e, sem conta corrente com o fornecedor, o sinal pago (dono, 15/11/2026; `shipmentStepsOpen`, docs/MILESTONES.md; antes, a situação "Inspeção" em diante); certificação só com ela começada; amostras só com elas pedidas;
  - recebimentos abertos (Armazenagem e Retorno) e a pré-produção, os mesmos casos do menu;
  - produção em andamento: pedido com ETD, da pré-produção até o booking começar (fase 5e: pelos marcos; antes, a etapa de inspeção).
- O Overview do bloco mostra, em cada passo da linha do tempo, quantos pedidos estão nele ("N no passo"), além das pendências. Passos com tela de antes (Books, Pedidos, Revisão, Estoque) listam na própria tela.

## Encomendas e Reposição (15/11/2026)

Compra por demanda (docs/PURCHASE_DEMAND.md): dois passos novos no bloco Produto novo, antes de Negociações.

- **Encomendas** (`new-product/demands`, tela `/app/requests`, a de solicitações, que saiu de MENU_HIDDEN): a encomenda do cliente (B14) pelas quatro portas, com etiqueta e filtro de tipo (encomenda ou reposição) e a porta de entrada (vitrine, cliente, vendedor, operador). **A lista só mostra o que ainda é encomenda** (dono, 16/11/2026): o que já virou pedido sai da lista, dos contadores e do filtro "Viraram pedido" e segue de Pedido em diante (`/app/orders`); as canceladas e excluídas ficam em "Ver canceladas e excluídas". A exportação CSV segue a mesma regra e o mesmo filtro de tipo. A tela lê do banco só as encomendas em andamento (`src/lib/services/request-list-data.ts`), não o histórico inteiro. Botão **+ Adicionar** → TS - Trading Sales (docs/REQUEST_SCREENS.md). Contador: a pendência `new_request` ("Encomenda nova"). O cliente vê a mesma tela, só com as dele, como "Encomendas" no menu "Meus pedidos".
  - **Tabela da Wellmix** (dono, 16/11/2026):
    - **Ordem das colunas**: Foto → Pedido → Produtos → Quantidade → Cliente → Situação → Próximo passo → Prazo de resposta, Analista e Data.
    - **Cada linha mostra o pedido inteiro**, calculado por pedido em `requestComposition` (`src/lib/request-composition.ts`). Com pedido, valem os itens do pedido (`order_items`, cada pedido uma vez). Sem pedido, vale o produto da solicitação. No lote, entra a soma das solicitações.
    - **Foto**: uma miniatura por produto diferente, com a primeira foto real do cadastro; produto sem foto mostra a inicial. Cabem até 4 no quadrado, com "+N" na última quando há mais. Com um produto só, aparecem a foto dele e a galeria dele, sem o número de fotos no canto. O clique abre a galeria com a foto de cada produto (até 12).
    - **Produtos**: o início do nome de cada um. Todos aparecem; depois de 6, "+N produtos" abre o resto.
    - **Quantidade**: a soma das peças. un, pcs, pç e peças somam juntas; outra unidade fica à parte.
    - **Desempenho**: itens, produtos e fotos são lidos só para as linhas da página (50 na lista grande), com `listColumns`. A lista inteira tem ~16 mil pedidos e ~185 mil itens.
    - **Ordenação**:
      - **Lista grande** (mais de 200 linhas, ordem no servidor): ordenar por Produtos e Quantidade continua pela solicitação.
      - **Lista filtrada** (até 200 linhas): a ordem segue o que a tela mostra, com o total do pedido.
    - **Cliente**: a visão dele continua como era.
- **Reposição** (`new-product/replenishment`, tela `/app/replenishment`): a fila do Planner, com o botão "+ Adicionar" (abre a tela Venda como compra para estoque com a origem reposição; ação `replenishment.open`; docs/REQUEST_SCREENS.md seção 7) e a recompra do pós-venda. A fila mostra só as reposições que ainda esperam a compra; a que virou pedido sai dela (dono, 16/11/2026). Contador: a pendência `replenishment_request`.
- "Cotações" (os convites de book) passou a se chamar **Convites de book**: a tela, a rota e o atalho continuam; a cotação de preço é a Cotação de compra (B13, PR 4).
- O link "Solicitações" que ficava no bloco Vendas (fora do menu) saiu: as encomendas estão no Produto novo.
- **Estratégia de compra** (`new-product/strategy`, tela `/app/purchase-strategy`, 15/11/2026): a fila do Comprador com reposições e encomendas, a aprovação da Diretoria de compras e o pedido de compra direto. Contadores: `purchase_strategy`, `purchase_strategy_approve` e `purchase_strategy_order`.
- **Cotação de compra** (`new-product/purchase-quotes`, tela `/app/purchase-quotes`, 15/11/2026): as cotações abertas pelo sistema, o quadro comparativo, a escolha, a aprovação e o que fazer sem resposta. Contadores: `purchase_quote_choose`, `purchase_quote_empty` e `purchase_quote_approve`; o fornecedor tem "Cotações de compra" no menu dele e a pendência `purchase_quote_answer`.

## "Todos no passo" paginado (15/11/2026)

- Com o histórico do Sankhya são milhares de pedidos em alguns passos (4.974 em Pedidos), e a tela do passo estourava a memória lendo etapas e itens de todos. Agora a contagem da aba vem da contribuição de cada pedido (`order_summaries.kpi.f`) e a aba "Todos no passo" lê só os 50 pedidos da página (`?tab=all&page=N`, `flowStepEntities`): os em andamento primeiro, depois o histórico em espera, cada grupo pelo número.
- Sem os resumos em uso, ou num passo fora de Pedido, Produção e Entrega, a lista vem das tabelas sem o histórico em espera (que não tem pendência).

## O pedido na tela do passo (14/11/2026)

A visão é do passo e das necessidades operacionais dele, não do pedido inteiro (a visão do pedido, com entidades e linha do tempo, é outra frente). Abrir um pedido de dentro de um passo leva a `/app/flow/<bloco>/<passo>/<pedido>` (só a Wellmix; os parceiros seguem no detalhe do pedido):

- os itens de etapa do passo para esse pedido, de qualquer etapa, feitos e abertos (quem enviou, quando, o arquivo ou o valor; o formulário onde ainda dá para agir; o atalho para a tela própria do contrato, das amostras, do Die Cut e da ficha);
- os passos do embarque, da origem, da certificação e das amostras do passo (cartão de passos, com os feitos);
- o cartão do passo: produção (Pré-produção, Produção, Inspeção, com o relatório na Inspeção), recebimento (Armazenagem, Retorno), artes (Arte), frete marítimo (Logística).
- **Pedidos** (o passo em que o pedido é criado) tem tela própria em `/app/flow/order/orders` (o menu "Pedidos" leva a ela; a lista `/app/orders` continua, com link na tela). O pedido nesse passo mostra só a criação: resumo, itens, programação de compra (pai e filhos) e os itens da criação (confirmação, número do ERP, ficha).
- "Todos no passo" e o "Resolver" das pendências abrem o pedido na tela do passo; as telas focadas que já existem (Die Cut, documento do pedido, documentos do embarque, amostras, fotos reais) seguem diretas. As ações voltam para o pedido no passo (`flowReturnTo` aceita `/app/flow/<bloco>/<passo>/<pedido>`).
- O detalhe do pedido (`/app/orders/[id]`) não mudou nesta frente.

## Criar pedido (14/11/2026)

- A encomenda do cliente entra por `/app/requests/new`. Com a lista `/app/requests` fora do menu (MENU_HIDDEN), o botão **+ Criar pedido** fica no cabeçalho do Overview do bloco Pedido (`/app/flow/order`), do passo Pedidos (`/app/flow/order/orders`, nas duas abas) e da lista `/app/orders`.
- Aparece para quem cria: a Wellmix e o cliente, com a tela de solicitações liberada (`canCreateOrder`). Fornecedor e parceiros da operação não veem.
- O cliente tem também o link "Criar pedido" no grupo "Meus pedidos" do menu.

## Pedido → Certificação: só a lista, uma linha por produto (14/11/2026)

Pedido do dono (com a foto da tela no login admin): os cartões dos pedidos embaixo da tabela repetiam os itens que já estavam na lista.

- A tela do passo (`/app/flow/order/certification`) é só a lista: as abas Pendências e Todos no passo, os filtros de prazo e os contadores continuam; os cartões por pedido embaixo (itens de etapa e passos da certificação) saíram desta tela (`isListOnlyStep` em `src/lib/flow.ts`). Os outros passos seguem com os cartões.
- Uma linha por produto: o certificado é de cada produto, então a pendência de etapa que junta vários produtos do pedido vira uma linha para cada um, só com o item daquele produto (`splitByProduct` e `casesInStep`). O contador do menu, os filtros, a aba Pendências e o Overview contam as mesmas linhas (`countByStep`). A aba Todos no passo segue com uma linha por pedido.
- O "Resolver" da linha abre o pedido no passo já no produto: `/app/flow/order/certification/<pedido>?item=<item do pedido>` (`productOfCase`, `orderInStepHref`). Ali aparece só o item daquele produto, com o envio da foto ou do arquivo para quem pode enviar (a mesma regra de antes: etapa aberta, `canSubmitRequirement` e o responsável por login) e o link "Ver tudo do pedido neste passo". O envio volta ao mesmo produto (`flowReturnTo` aceita `?item=` só depois do pedido, com o mesmo formato de identificador). Produto que não é do pedido mostra o aviso e tudo do passo; pedido de outra empresa não abre.
- As linhas do pedido inteiro (memorial, laudo, registro, selo, arte com o selo) abrem o pedido no passo, no quadro do passo (a mesma âncora do link da pendência).
- No celular, a tabela dos casos rola de lado e a coluna do "Resolver" fica fixa à direita, sempre à vista (em todos os passos e no Overview; `FlowCases`).

## Arte no mesmo padrão e as outras telas só com a lista para a Wellmix (14/11/2026)

Pedido do dono: em Pedido → Arte, a mesma simplificação da Certificação; depois, "em outras telas também, semelhantemente, no acesso dos ADMs e gestores". Padrão escolhido pelo dono para o "Resolver": o pedido no passo, já no produto (o mesmo da Certificação).

- **Arte**, para todos os logins, igual à Certificação: só a lista, uma linha por produto (arte, validação e arte final do produto; `PER_PRODUCT_STEPS` e `LIST_ONLY_STEPS` em `src/lib/flow.ts`) e o "Resolver" em `/app/flow/order/art/<pedido>?item=<item do pedido>`, com os botões da tarefa (foto e arquivo; aprovar e reprovar na validação) para quem pode agir. O menu, as abas, os filtros e o Overview contam as linhas (confirmado pelo dono). A não conformidade da arte abre o pedido no passo, com o cartão Artes.
- **Wellmix nos outros passos** (administradores e operadores; `listOnlyFor`): toda tela de passo é só a lista, sem os cartões por pedido embaixo (itens de etapa, produção, inspeção, frete, recebimento e os passos do embarque e da certificação). O "Resolver" abre o pedido no passo (ou a tela focada, quando existe: Die Cut, documento do pedido, documentos do embarque, amostras, fotos reais), onde ficam os mesmos cartões e formulários; as ações voltam para o pedido no passo. Nesses passos, uma linha por pendência, como antes. Exceção: Vendas → Amostras e Ofertas seguem com o registro de a quem foi oferecido e o histórico embaixo da lista, porque esse registro só existe ali (não repete a lista).
- **Parceiros** nos outros passos deles (fornecedor na Inspeção, nos Documentos de carga etc.): os cartões continuam na tela do passo, como antes.
- **No pedido no passo, só o que dá para fazer agora**: a tarefa que espera outra diz o que falta, como no detalhe do pedido, sem os botões (a validação espera a arte; a arte final, a validação e o certificado; a aprovação da arte do pedido antigo, a arte; `stepWaiting` em `src/lib/requirement-waiting.ts`, a mesma regra do detalhe). Antes, os botões apareciam e o servidor recusava.
- `FlowArtworkWork` (as não conformidades da arte na tela do passo) saiu: a Arte é só a lista para todos, e o cartão Artes segue no pedido no passo e no detalhe do pedido.

## Overview pelos pedidos e visão do pedido entre os blocos (14/11/2026)

Pedido do dono: o Overview de Pedido, Produção e Entrega (só a Wellmix) passa a mostrar os pedidos do bloco, e não só as pendências.

- **KPIs no topo** (`data-flow-kpis`): pedidos no bloco, atrasados no bloco, completude média do bloco, completude geral média e as pendências (com o pedido há mais tempo no bloco).
- **Linha do tempo geral** (`data-flow-general`): os três blocos (Pedido → Produção → Entrega) com quantos pedidos estão em cada um, a completude média do bloco e os atrasados; o bloco aberto em cor, os outros em cinza; cada um leva ao Overview dele.
- **Passos à esquerda**: o número grande é quantos pedidos estão no passo; as pendências, os atrasos e os dias ficam embaixo, em letra menor. "Todos os passos" no topo mostra o bloco inteiro (padrão).
- **Tabela dos pedidos** (`FlowEntities`, `src/components/flow-entities.tsx`): pedido, fornecedor, passos (na visão do bloco inteiro), etapa, há quantos dias está no bloco, atraso, % do bloco e % geral; os atrasados primeiro, até 500 linhas. Com um passo escolhido, as pendências dele aparecem embaixo, como antes.
- **Visão do pedido** (`OrderProgressCard`, `src/components/order-progress-card.tsx`, no topo do detalhe do pedido para a Wellmix; o Overview abre com `?from=<bloco>#order-progress`): a viagem inteira do pedido, com a completude geral; o bloco de onde veio em cor, com os marcos dele (situação, %, prazo, conclusão e atraso; atributo `data-order-progress-milestone`, e `data-order-progress-stage` com a mesma chave) e o relatório de atraso (atraso agora e marcos concluídos depois do prazo); os outros blocos em cinza com o percentual. Clicar num bloco muda o foco. Sem `from`, o foco é o bloco atual do pedido.
- **Regra** (`src/lib/flow-progress.ts`, pura; fase 5g: pelos 16 marcos, não mais pelas etapas): cada marco cai no bloco dele (Pedido: Pedido novo a Sinal; Produção: Pré-produção a Embarque; Entrega: Desembaraço a Entrega e recebimento). Marco concluído vale 100%, em andamento ou travado o andamento das subtarefas dele (até 99%), aguardando 0%; o marco que não se aplica ao pedido não entra. O bloco é a média dos marcos dele; o geral, a média de todos. Atraso pelo prazo gravado (`order_milestones.dueAt`): marco aberto com o prazo vencido (dias desde o prazo) e marco concluído depois do prazo.
- **Leitura** (indicadores prontos, 14/11/2026): os números do topo, da linha do tempo geral e de cada passo vêm de uma linha só (`kpi_snapshots`, chave "flow"); a lista do bloco sai da contribuição de cada pedido guardada no resumo (`order_summaries.kpi.f`). Sem os resumos em uso, tudo é somado das tabelas pela mesma regra. Ver docs/RESUMOS.md, "Indicadores prontos do Overview dos blocos".
- **Produto novo** (segunda parte, 14/11/2026, pedido do dono): as entidades são os **books** e as **solicitações ao fornecedor** (`newProductEntities` em `src/lib/services/flow.ts`).
  - Book em preenchimento ou rascunho: passo Books; fechado ou em andamento: Seleção de itens; com convite de book concorrente aberto: também Convites de book (o atraso é o do convite vencido). Completude pela situação: em preenchimento 10%, rascunho 25%, fechado 50%, em andamento 75%, concluído 100%.
  - Solicitação aberta ou respondida, ou aprovada com a amostra ainda não aprovada e sem pedido: Negociações. Completude: aberta 25%, respondida 50%, aprovada 70%, amostra enviada 85%, amostra aprovada 100%. Atraso: o SLA da negociação (Configurações) vencido, em dias (o que passou já conta 1). A solicitação com vários produtos (mesmo `batchId`) é uma linha só, com a média.
  - % geral: sem pedido, a mesma do bloco; com pedidos que nasceram das solicitações, o Produto novo vale como um bloco ao lado dos três do pedido (`overallOf`).
  - A tela do book (`/app/booking/lots/[id]`) e a da solicitação (`/app/supplier-requests/[id]`) ganham, para a Wellmix, o cartão **Linha do tempo** (`EntityTimelineCard`, `src/lib/services/entity-timeline.ts`): os passos do Produto novo em cor, com a situação e o atraso, e Pedido, Produção e Entrega em cinza com o percentual dos pedidos dela.
  - A linha do tempo geral do Overview passa a ter os quatro blocos.
- Os logins de fora da Wellmix seguem com o Overview das pendências.
- **Marco atual na tabela do Overview** (fase 4d, 15/11/2026; docs/MILESTONES.md): nos blocos Pedido, Produção e Entrega, a coluna "Marco atual" mostra "N. Marco" (pelo resumo, `facts.m`, ou pela situação) no lugar do nome da etapa; o Produto novo continua com a situação do book ou da solicitação.
- **Histórico do Sankhya em espera** (14/11/2026, decisão do dono): os pedidos da carga do histórico (`held`) aparecem na situação real, nos passos em que têm atividade, como os outros, com o selo "Histórico" na tabela; o indicador "Do histórico (sem avisos)" e o "N do histórico" em cada bloco e passo dizem quantos são. Sem avisos; as pendências deles ficam à parte na tela Pendências (docs/SANKHYA.md).

## Parceiros nos passos (14/11/2026)

Os parceiros (fornecedor, agência, certificadora, despachante, comex, agente de carga, companhia marítima, transportador e agência de marketing) ganham no menu os passos deles no mapa, por bloco, com o contador do que espera ação deles (`PARTNER_FLOW_STEPS` em `src/lib/flow.ts`, tirado de quem faz, valida e vê cada passo do embarque e da certificação e do responsável de cada etapa do pedido). O grupo com as telas do papel (bookings, pedidos, fretes, conta corrente, multas) continua embaixo. O cliente e o jurídico não mudam.

| Parceiro             | Passos                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Fornecedor           | Pedidos (ficha e medidas), Material de arte, Contrato, Inspeção, Amostra, Logística, Carregamento, Documentos de carga, Embarque |
| Agência              | Certificação (arte com o selo), Arte                                                                                             |
| Certificadora        | Certificação                                                                                                                     |
| Despachante          | Documentos de carga, Presença de carga                                                                                           |
| Comex                | Certificação, Logística, Carregamento, Documentos de carga, Embarque, Presença de carga, Canal, Nota fiscal                      |
| Agente de carga      | Booking, Logística, Carregamento, Documentos de carga, Embarque, Presença de carga, Canal, Nota fiscal                           |
| Companhia marítima   | Embarque                                                                                                                         |
| Transportador        | Logística, Entrega                                                                                                               |
| Agência de marketing | Amostra                                                                                                                          |

- A tela do passo do parceiro tem as duas abas: Pendências (o que espera ação dele) e Todos no passo (os pedidos dele no passo, só com o que é dele: itens de etapa do papel ou que ele pode fazer e os passos que ele vê; sem a coluna do fornecedor; `flowPartnerAllFor`).
- O pedido no passo abre para o parceiro só nos passos dele e só nos pedidos dele (`canViewOrder`): os itens do papel, os passos que ele vê, o cartão de produção só para o fornecedor do pedido, sem o fornecedor e o cliente no cabeçalho. Recebimento, relatório da inspeção, frete e a criação do pedido seguem só da Wellmix. Passo que não é do parceiro não abre (404).
- Sem Overview para os parceiros. O detalhe do pedido (`/app/orders/[id]`) continua como estava para eles.

## LPCO, Amostras e Ofertas (14/11/2026)

- **Entrega → LPCO** (mapa E5, E5?): passo novo do embarque, `lpco` (`IMPORT_STEPS`): o comex registra o pedido da licença (número e arquivo) e a Wellmix marca deferida ou indeferida. Só no pedido com produto cujo NCM começa por um dos prefixos de Configurações → "NCMs que exigem LPCO" (`lpcoNcmPrefixes`; vazio, em nenhum pedido). A regra é `lpcoApplies` / `lpcoOrderIds` em `src/lib/services/import-flow.ts`; `stepApplies` recebe o resultado (sem ele, o LPCO não aparece). Não segura a presença de carga (passo sem dependente). Também no menu do comex. O resumo do pedido subiu para a versão 11 (o LPCO entra na contribuição do Overview).
- **Vendas → Amostras** (E23): a amostra que chegou ao Brasil (recebida e conferida no show room, passo `samples_brazil_received`; antes de 14/11/2026 contava o envio, `samples_brazil`) e ainda não foi oferecida. A tela tem o registro de a quem foi oferecida e a lista das ofertas registradas.
- **Vendas → Ofertas** (V2): o produto com a venda ativada (foto real aprovada pelo marketing, R5, `real_media` aprovada) e ainda não oferecido, com o mesmo registro.
- As ofertas ficam na tabela nova `sales_offers` (tipo amostra ou produto, pedido, produto, a quem, observação, quem e quando); `recordSalesOfferAction` (só a Wellmix, com a tela Produtos). Os casos contam no menu, fora das Pendências (`flowSalesCasesFor`). Limpar dados de teste apaga as ofertas.

## De onde vem o contador

- As mesmas pendências da tela Pendências (`pendingTasksFor` + `tasksForFunctions`: o operador vê só as das funções dele), lidas uma vez por página (`flowTasksFor`, cache do React). Só leitura; nada novo no banco. A bolinha de Pendências é o total.
- Cada pendência cai no passo de onde vem (`flowStepsOf` em `src/lib/flow.ts`): pelo item da etapa (arte, certificado, die cut, assinatura, inspeção…), pelo passo do embarque e da importação (`stepKey`) ou pelo tipo. A pendência de etapa que junta itens de passos diferentes conta uma vez em cada um. Mensagem a responder não entra (fica no cabeçalho).
- Grupo fechado mostra a soma dos itens; com o menu recolhido, um ponto. Vermelho quando alguma atrasou.

## Próximas etapas (divisão das telas que juntam muitas atividades)

O detalhe do pedido (`/app/orders/[id]`) concentra quase todas as ações. Esta entrega já tira dele os passos do embarque, da importação, da certificação e das amostras (seção "Resolver aqui") e leva os demais casos à tela focada quando ela existe (Die Cut, documento do pedido, documentos de embarque, fotos reais). A segunda parte trouxe as raias de arte e as linhas de requisito (arte, validação, arte final, certificado), a inspeção dos SKUs, o follow da produção e as não conformidades da arte. A divisão segue por blocos, uma entrega por vez, sem remover o detalhe do pedido: as ações de cada passo passam a aparecer também na tela do passo (Arte, Certificação, Inspeção, Documentos de carga, Presença de carga…), reaproveitando os mesmos componentes e Server Actions.

Código: `src/lib/flow.ts` (blocos, passos e classificação), `src/lib/services/flow.ts`, `src/components/flow-overview.tsx`, `src/components/flow-cases.tsx`, `src/components/flow-step-work.tsx` (passos do embarque e da certificação), `src/components/flow-step-forms.tsx` (itens de etapa, produção e arte), `laneInputKeys` em `src/lib/purchase-lanes.ts` (arquivos que a validação e a arte final usam, no pedido e no passo), `src/app/app/flow/`, textos em `src/i18n/modules/flow.ts`. Testes: `tests/unit/flow-menu.test.ts`, `tests/unit/flow-certification.test.ts` (linhas por produto na Certificação e na Arte, `listOnlyFor`), `tests/unit/nav.test.ts`, `tests/e2e/production-screen.spec.ts` e o caminho principal (`tests/e2e/happy-path.spec.ts`: a Wellmix valida a arte reenviada pelo "Resolver" da Arte, no pedido no passo já no produto, e abre a pré-produção, a inspeção (com a aprovação do SKU) e a armazenagem pelo "Resolver" das telas só com a lista).
