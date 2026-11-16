# Recon dos papéis externos (fora o fornecedor): o que cada um faz HOJE no portal Wellmix

Levantamento só de leitura, feito em 14/11/2026 sobre o repositório `/home/user/willmix` (branch com o merge #429). Fonte de verdade: `docs/*.md` para o escopo; o código para o que está implementado e para os textos. Todo rótulo citado é o texto **pt** do dicionário, com a chave i18n entre crases. Nada foi executado no navegador: o que não pôde ser confirmado por código + teste está marcado com **⚠ não confirmado**.

Papéis cobertos: `customer`, `agency`, `marketing_agency`, `broker`, `shipping_line`, `carrier`, `comex`, `logistics`, `ocp`, `legal`.

---

## 0. O que vale para todos (gravar uma vez só)

### 0.1 Fatos que mudam o roteiro

1. **A carga inicial não tem pedido nenhum.** `src/lib/seed.ts` cria só cadastros (empresas, logins, linhas, produtos, uma certificação, uma visita, um item de sourcing, um kit de marketing). Todo estado de pedido precisa ser produzido pelo fluxo, como o E2E faz.
2. **Hoje só existe um jeito de nascer pedido: o pedido de compra** (`orders.flow = "supplier_request"`, `src/lib/services/purchase-order.ts`), além dos filhos da programação de compra e da carga do Sankhya. O cliente desse pedido é **a própria Wellmix** (cadastro de cliente com o CODEMP do Sankhya, `purchaseOrderCustomer`), **sem login**.
3. **O parceiro só vê o pedido em que a empresa dele está designada** (`canViewOrder`, `src/lib/auth/permissions.ts`). A designação é em **Parceiros do pedido** (`orders.partners`), no detalhe do pedido, pela Wellmix: seletor do tipo + botão **Designar** (`orders.assign`). Com **uma só** empresa ativa do tipo no cadastro, ela entra sozinha no pedido novo (`assignDefaultPartners`, `src/lib/services/requests.ts`); a agência de arte vem antes da linha do produto (`product_lines.agencyId`).
4. **Passos antigos não aparecem no pedido de compra**: "Draft do BL", "Invoice e packing list" e "Invoice e packing assinados" (`PURCHASE_HIDDEN_STEPS`); o passo "BL (original)" fica só leitura e conclui sozinho quando o BL dos Documentos do embarque é conferido.
5. **Contas de demonstração** (`src/lib/demo-data.ts`, senha `wellmix123`, só no modo memória): `joao@lojista.com` (cliente, pt), `agencia@design.com` (agência, pt), `agencia@marketing.cn` (agência de marketing, **zh**), `despachante@comex.com` (despachante, pt; empresa "Comex Despachos"), `armador@maritima.com` (companhia marítima, **en**), `transportadora@rodo.com` (transportador, pt), `comex@assessoria.com` (comex, pt), `agente@cargo.com` (agente de carga, pt), `ocp@certifica.com` (OCP, pt), `juridico@wellmix.com` (jurídico, pt, **sem empresa**). Para gravar em português as contas `zh` e `en`, trocar o idioma no seletor do cabeçalho.

### 0.2 Estados de dados (como o E2E `tests/e2e/happy-path.spec.ts` chega a cada um)

Teste: "booking → seleção → solicitação ao fornecedor → produto → pedido de compra → raias → contrato → pagamento → inspeção → embarque → desembaraço → transporte → entrega". Uso estes rótulos nas pré-condições das tarefas.

| Estado | O que existe | Quem faz (passo do E2E) |
| --- | --- | --- |
| **E0** | Carga inicial: só cadastros | — |
| **E1** | Pedido de compra criado, etapa "Preparação, arte e certificação" (`purchaseOrder.stage.PREPARATION`) aberta. Produto na linha **Brinquedos** (exige Inmetro; sem linha com certificação não há certificado, arte final com selo nem pendências de selo/memorial) | admin: 2 books por planilha → Seleção de itens → solicitação ao fornecedor → fornecedor responde → admin aprova → amostragem → cria o produto → "Gerar pedido de compra" (passos 1–5). Depois, NCM validado e ficha mestre completa (5b) |
| **E2** | Faca (die cut) e foto em alta enviadas (libera a arte) | `supplier.a@china.com` no quadro Die Cut (6a) |
| **E3** | Arte enviada; **E3r** arte devolvida com motivo; **E3v** arte validada | `agencia@design.com` (6b); admin devolve (6c) e valida em Pedido → Arte |
| **E4** | Certificado do produto, memorial e selo enviados | `ocp@certifica.com` (6d) |
| **E5** | Arte final com o selo enviada; pedido de amostras gerado; contrato com as duas assinaturas; sinal pago | agência (6e); admin e fornecedor (7–8) |
| **E6** | Etapa **Inspeção** aberta (daqui em diante valem as pendências de embarque/desembaraço e o cartão Container na origem) | fornecedor manda fotos, peso, vídeo e declaração (9) |
| **E7** | SKU aprovado → etapa **Embarque** aberta; cartão Amostras abre | admin em Produção → Inspeção |
| **E8** | Booking enviado e validado; container vazio na fábrica; check list, packing list e invoice conferidos | admin envia o booking, operador valida; fornecedor faz o resto |
| **E9** | Amostras: retirada, envios ao Brasil e à China, recebidas pela agência, fotos reais aprovadas, devolução validada pela trading | fornecedor; **admin faz a parte da agência de marketing** no E2E |
| **E10** | Carregamento conferido, lacre, container no porto; **BL conferido** | fornecedor; `armador@maritima.com` envia o BL |
| **E11** | Embarque confirmado → etapa **Desembaraço** aberta | `armador@maritima.com` (10) |
| **E12** | Desembaraço concluído → etapa **Transporte** aberta | `despachante@comex.com` (10) |
| **E13** | Entrega realizada → etapa **Entrega**; recebimento confirmado → pedido encerrado | `transportadora@rodo.com`; admin confirma o recebimento (11) |

### 0.3 Anatomia das telas comuns (rótulos exatos)

- **Entrada**: `/login`, campos "E-mail" (`login.email`), "Senha" (`login.password`), botão "Entrar" (`login.submit`). Primeiro acesso com senha provisória: "Primeiro acesso: escolha a sua senha" (`password.first.title`), botão "Salvar senha nova" (`password.submit`) ou "Continuar sem trocar a senha" (`password.first.skip`). Depois: menu da conta → "Trocar senha" (`password.menu`), "Sair" (`nav.logout`).
- **Início do parceiro** (`/app`): título "Minhas pendências" (`tasks.title`), subtítulo "Olá, {name}" (`home.welcome`). Lista vazia: "Nenhuma pendência. Bom trabalho." (`tasks.empty`). Colunas: "Pendência" (`tasks.col.task`), "Detalhe" (`tasks.col.detail`), "Tipo" (`tasks.filter.type`), "Prazo" (`common.due`); atalho "Abrir" (`tasks.open`). Filtros "Prazo": "Todas", "Atrasadas", "Vencem hoje", "Até 7 dias", "Mais adiante", "Sem prazo" (`tasks.filter.*`); "Limpar filtros" (`tasks.filter.clear`). Pendência de etapa sai como "Pedido #{n}: {stage}" (`tasks.orderStage`).
- **Tela do passo do menu** (`/app/flow/<bloco>/<passo>`): abas "Pendências (n)" (`flow.tab.pending`) e "Todos no passo (n)" (`flow.tab.all`); filtros "Todas / Atrasadas / Hoje / Até 7 dias" (`flow.due.*`); colunas "O que espera" (`flow.cases.what`), "Prazo" (`flow.cases.due`), "Há" (`flow.cases.since`); atalho "Resolver" (`flow.cases.open`); vazio "Nada esperando ação neste passo." (`flow.cases.empty`). Aba Todos, texto do parceiro: "Todos os seus pedidos que estão neste passo agora, com o que é seu. Clique para abrir o pedido no passo." (`flow.all.hint.partner`); colunas "Pedido", "Etapa do pedido", "Aberto neste passo", "No passo há"; link "Ver o pedido" (`flow.all.*`). Passo que não é do papel devolve 404. Parceiros **não têm Overview**.
- **Lista de pedidos** (`/app/orders`, título "Pedidos" `orders.title`): só os pedidos do parceiro; busca "Filtrar" (`orders.panel.search`), "Abrir pedido" (`orders.panel.openOrder`).
- **Detalhe do pedido** (`/app/orders/<id>`): índice "Ir para:" (`orderView.index`); "Resumo do pedido" (`orderView.summary`); "Itens do pedido" (`orderView.items`); "Etapas do pedido" (`orderView.stages`) só com as linhas do papel (`stageRowFor`/`partRowFor`, `src/lib/order-view.ts`), "Ver detalhes" (`orderView.stage.open`), "Abrir todas as etapas" (`orderView.stage.all`); "Documentos" (`orders.documents`) com "Visualizado dd/mm/aaaa" (`orders.ack.viewed`) e botão "Confirmar leitura" (`orders.ack.confirmDoc`) → "Leitura confirmada" (`orders.ack.confirmedDoc`); "Multas" (`orders.penalties`) só as da própria empresa.
- **Item de etapa** (formulário `RequirementForm`, `src/components/requirement-form.tsx`): texto/número/data com botão "Enviar" (`common.send`); confirmação com "Confirmar" (`common.confirm`); foto com "Tirar ou escolher foto" (`requirement.photo.add`); arquivo com dois botões, "Tirar ou escolher foto" e "Escolher arquivo" (`requirement.file.add`), **que enviam sozinhos ao escolher** (sem botão Enviar); "Excluir" (`requirement.remove`) troca o arquivo. Situações: "Pendente", "Concluído", "Reprovado" (`reqStatus.*`).
- **Passo de embarque, origem, amostras ou certificação** (`ImportFlowCard`, `src/components/import-flow-card.tsx`): tabela "Passo", "Situação", "Quem faz / valida", "Informado", "Enviado por", "Ação" (`importFlow.col.*`); linha "Faz: {actor} · valida: {validator}" (`importFlow.who`); botões "Enviar" (`importFlow.submit`), "Enviar de novo" (`importFlow.resubmit`), "Validar" (`importFlow.validate`), "Recusar" (`importFlow.reject`) com o campo "Motivo (obrigatório para recusar)" (`importFlow.reasonPh`); arquivo "Arquivo" (`importFlow.file`) e "Arquivo pronto: {name} ({size}). Agora clique no botão para enviar." (`importFlow.fileReady`). Situações: "Pendente", "Enviado, aguardando validação", "Validado", "Recusado", "Concluído" (`importFlow.status.*`); "Depois de: {step}" (`importFlow.waitingPrevious`). Avisos: "Enviado.", "Validado.", "Recusado; quem fez foi avisado." (`importFlow.done.*`).
- **Cabeçalho**: ícones de Mensagens e Notificações (fora da barra lateral desde 14/11/2026). Mensagens: "Fale com a equipe Wellmix. Todos os logins da sua empresa veem esta conversa." (`messages.subtitle.external`); no pedido, "Conversar sobre este pedido ou solicitação" (`chat.open`). Notificações: "Marcar todas como lidas" (`notifications.markAllRead`).
- **Arquivos** (`src/lib/services/documents.ts`): até **50 MB**; PDF, PNG, JPEG, WebP, HEIC, planilha (.xlsx/.xlsm/.xls/.csv), XML, ZIP, SVG, PSD, AI/EPS, CDR, TIFF. Erros: "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." (`orders.error.mime`); "Arquivo grande demais (máx. 50 MB)." (`orders.error.too_large`); nos passos, "Formato de arquivo não aceito: envie PDF, imagem ou planilha." (`importFlow.error.mime`), "O arquivo está vazio." (`importFlow.error.empty`).
- **Erros gerais**: "Você não tem permissão para esta ação." (`common.forbidden`); "Não foi possível concluir. Verifique os dados." (`common.error`, pode vir com o código entre parênteses); "Você não tem acesso a {screen}. Peça ao administrador em Gestão → Equipe e divisões." (`access.denied`).

---

## 1. Cliente (`customer`) — conta `joao@lojista.com` (Loja do João Ltda)

### 1.1 Menu e telas

| Ordem | Rótulo | Rota | Observação |
| --- | --- | --- | --- |
| 1 | Pendências (`nav.tasks`) | `/app/tasks` | |
| 2 | Pedidos (`nav.orders`) | `/app/orders` | grupo "Meus pedidos" com um item só vira link direto |
| cabeçalho | Mensagens, Notificações | `/app/messages`, `/app/notifications` | |

Confirmado em `tests/unit/nav.test.ts` ("cliente: Pendências e os pedidos (a vitrine ainda não abriu)").

**Fora do menu, mas abrindo**: `/app` do cliente **redireciona para `/app/explore`** (vitrine "Explorar"), não para as Pendências (`src/app/app/page.tsx`; o E2E confere `waitForURL(/\/app\/explore$/)`). Também abrem pelo endereço: `/app/explore/cart` ("Carrinho"), `/app/requests` ("Orçamentos", `nav.myQuotes`), `/app/requests/new`, `/app/history`, `/app/marketing`. Ver Divergências.

### 1.2 Tarefas

#### C1. Explorar a vitrine e pedir orçamento pelo carrinho (implementada e testada; fora do menu)
- **Quando e por quê**: escolher produtos do catálogo e pedir orçamento. **Frequência**: por compra. **Criticidade**: alta para o cliente, mas a vitrine "ainda não abriu" (decisão de 12/11/2026).
- **Rotas**: `/app/explore`, `/app/explore/<produto>`, `/app/explore/cart`.
- **Pré-condição**: produtos ativos liberados na vitrine (a carga inicial traz, por exemplo, `prod-panela`, `prod-boneca`, `prod-piscina`); o cliente com empresa vinculada.
- **Passo a passo**:
  1. Buscar: campo "Buscar produtos, categorias, materiais…" (`explore.search.placeholder`), botão "Buscar" (`explore.search.button`).
  2. No cartão do produto: "Adicionar {n} un" (`explore.addQty`), que vira "No carrinho" (`explore.inCart`).
  3. Na página do produto: "Quantidade (un)" (`explore.product.quantity`), "Personalização (opcional)" (`explore.product.notes`), "Adicionar ao carrinho" (`explore.product.addToCart`) ou "Solicitar orçamento agora" (`explore.product.buyNow`).
  4. "Carrinho" (`explore.cartButton`): "Quando você precisa? (opcional)" (`explore.cart.deadline`), "Observações para a Wellmix (opcional)" (`explore.cart.notes`), "Solicitar orçamento" (`explore.cart.checkout`).
- **Depois**: cada produto vira uma solicitação do mesmo lote (`/app/requests/batch/<lote>?fromCart=1`), aviso "Pedido de orçamento enviado! A Wellmix vai cotar com os fornecedores e mandar a proposta." (`explore.sent`). A solicitação fica em "Solicitado" (`reqStatusLabel.REQUESTED`) e vira a pendência "Solicitações novas" da Wellmix. **Não há passo seguinte para o cliente**: a proposta e o sinal saíram em 11/11/2026 (`docs/QUOTE_FLOW.md`).
- **Erros**: "Abaixo do pedido mínimo ({n} un). Ao alterar a quantidade, ela sobe pelo menos até o mínimo." (`explore.cart.belowMoq`); "O carrinho chegou a 50 produtos: envie este orçamento e comece outro." (`explore.error.cart_full`); com a vitrine desligada nas Configurações, "Os pedidos pela vitrine estão desligados no momento: fale com a Wellmix." (`explore.error.cart_disabled`).
- **Regras**: pedido mínimo do produto (a quantidade volta ao mínimo ao sair do campo); só o cliente usa o carrinho (`explore.error.forbidden`).
- **E2E**: `happy-path.spec.ts`, "vitrine: busca, página do produto, carrinho e pedido de orçamento". **Complexidade**: média.

#### C2. Nova solicitação pelo formulário (vários produtos, produto fora do catálogo, programação de entregas)
- **Rota**: `/app/requests/new`; lista em `/app/requests` (título "Orçamentos"; quadro "Precisa importar um produto?" `customerHome.cta.title`; botão "+ Nova solicitação" `requests.new`).
- **Passo a passo**: escolher o produto pela busca (ou marcar "Produto ainda não está no catálogo: quero que a Wellmix encontre fornecedores" `requests.sourcingDemand.label`), "Descrição" (`requests.description`), "Quantidade" (`common.quantity`); "Programação de entregas" (`reqSchedule.toggle`) para dividir em entregas; "Adicionar outro produto" (`reqBatch.add`); "Enviar" (`common.send`).
- **Depois**: lote com um número só ("Solicitação nº {number} · {n} produtos" `reqBatch.titleNumbered`); cada produto é uma solicitação.
- **Erro**: "Abaixo do pedido mínimo ({n} {unit}). Ao sair do campo, a quantidade sobe para o mínimo." (`reqProduct.belowMoq`); o servidor recusa `below_moq`.
- **E2E**: `happy-path.spec.ts`, "vários produtos numa solicitação: cada um vira uma solicitação do mesmo lote"; `request-chat-floating.spec.ts` (cliente cria a solicitação). **Complexidade**: média.

#### C3. Conversar com a Wellmix (Mensagens)
- Cabeçalho → Mensagens, ou "Conversar com a Wellmix" (`messages.chatWellmix`) na solicitação. Diária/rara; baixa complexidade. E2E: `request-chat-floating.spec.ts` cobre o lado da Wellmix.

#### C4. Acompanhar o pedido, confirmar o recebimento, avaliar, comprar de novo e pedir cancelamento (**implementado, sem caminho no fluxo de hoje**)
- **O que o código tem** (`src/app/app/orders/[id]/page.tsx`, `src/app/app/actions/after-sales.ts`, `order-cancel.ts`): o cliente vê as etapas iniciadas, os valores de venda, os próprios pagamentos; confirma o item "Recebimento confirmado" (`req.receipt_confirmed`) com "Confirmar"; responde o pós-venda (cartão "Pós-venda" `orders.afterSales.title`, botão "Enviar avaliação" `orders.afterSales.submit`); "Comprar de novo" (`orders.followup.buyAgain`) e "Quero nova proposta" (`orders.followup.newProposal`); "Solicitar cancelamento" (`cancel.request.submit`) até a produção começar (`cancel.request.closedWindow` depois).
- **Por que não dá para gravar hoje**: o cliente só abre pedido cuja empresa é a dele **e** cujo solicitante é o login dele (`canViewOrder`: `customerId` + `requestedByUserId`). Os pedidos de hoje nascem com a Wellmix como cliente e sem solicitante. No E2E, é o **admin** que confirma o recebimento ("o cliente do pedido é a própria Wellmix … sem login"). **⚠ não confirmado**: se algum pedido da carga do Sankhya chega a um login de cliente em produção.
- **E2E**: nenhum com login de cliente. **Complexidade**: média.

### 1.3 Sugestão de módulos
- **Hoje (o que o menu mostra)**: 1 módulo curto, "Entrar, Pendências, Pedidos e Mensagens" (5–7 min), deixando claro que as listas vêm vazias.
- **Em espera até a vitrine abrir** (testado, mas fora do menu): "Vitrine e carrinho" (10–12 min) e "Nova solicitação e programação de entregas" (10–12 min).
- **Não gravar**: proposta/sinal (removidos) e C4 (sem dado).
- **Total do papel**: 5–7 min agora; cerca de 30 min quando a vitrine abrir.

---

## 2. Agência de arte (`agency`) — conta `agencia@design.com` (Agência Criativa)

### 2.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências (`nav.tasks`) | `/app` |
| 2 | grupo **Pedido** (`nav.group.order`) → Certificação (`flow.step.order.certification`) | `/app/flow/order/certification` |
| 3 | grupo **Pedido** → Arte (`flow.step.order.art`) | `/app/flow/order/art` |
| 4 | Pedidos (`nav.orders`) | `/app/orders` |
| fora do menu | Mesa de trabalho (`desk.link`) | `/app/tasks/desk` (botão só em `/app/tasks`) |

Nas Pendências da agência há dois cartões-filtro de etapa: "Arte do pedido" (`tasks.group.agency.art`) e "Selo na arte" (`tasks.group.agency.seal`), com a introdução "Aqui está tudo que depende de você, da arte na cotação até o selo. Toque numa etapa para ver só as pendências dela." (`agencyTasks.intro`).

### 2.2 Tarefas

#### A1. Enviar a arte de cada produto do pedido (raia da arte)
- **Quando e por quê**: o fornecedor mandou a faca e a foto em alta; a agência cria a arte sobre elas. **Frequência**: por produto de cada pedido. **Criticidade**: alta (segura a validação, a arte final e o contrato).
- **Rotas**: Pendências → "Abrir"; ou Pedido → Arte → "Resolver" (`/app/flow/order/art/<pedido>`); ou o detalhe do pedido, etapa "Preparação, arte e certificação".
- **Pré-condição**: **E2**. A agência designada no pedido e sendo ela quem faz a arte (Configurações "Arte da embalagem feita pela agência" ligada, padrão). Se o pedido tem **Designer do pedido** (cartão Artes), só esse login recebe e pode enviar.
- **Passo a passo**: na linha "Arte · {produto}" (rótulo gravado no item; sem chave i18n), usar como base a faca e a foto em alta do fornecedor (linhas "Faca (die cut)" e "Foto em alta resolução"; o servidor libera esses arquivos a quem faz a arte, `laneDocumentAccess`; **⚠ não confirmado em tela** se o link aparece na linha para a agência); clicar "Escolher arquivo" (`requirement.file.add`) ou "Tirar ou escolher foto" (`requirement.photo.add`). **O envio acontece ao escolher o arquivo.**
- **Depois**: o item fica "Concluído"; nasce a validação "Validação da arte pela Wellmix" para o responsável interno que tem a ação "Validar a arte"; a "Arte final com o selo" mostra "Aguarda: …" (`purchaseSequence.waiting`).
- **Erros**: "Ainda não: falta o passo anterior desta raia (validar só a arte enviada; a arte final pede a arte validada e o certificado)." (`orders.error.lane_prerequisite`); "Esta tarefa é de outro responsável do pedido: só quem a recebe (ou o administrador) pode enviar, trocar o arquivo ou validar." (`orders.error.lane_not_assignee`).
- **Regras**: prazo de 5 dias desde a faca e a foto (`purchaseArtSlaDays`); a Wellmix valida em 2 dias (`purchaseArtReviewSlaDays`); formatos e 50 MB da seção 0.3.
- **E2E**: `happy-path.spec.ts`, passo 6b (`fillMyRequirements` com `agencia@design.com`). **Complexidade**: baixa.

#### A2. Reenviar a arte devolvida pela Wellmix
- **Quando**: a Wellmix devolveu com motivo. **Frequência**: ocasional. **Criticidade**: alta.
- **Rota e passos**: os mesmos de A1; a linha da arte volta para "Reprovado" (`reqStatus.rejected`) e o motivo aparece na tela (o E2E confere o texto "Logo maior" na página). Enviar o arquivo novo.
- **Depois**: a validação volta a pendente para a Wellmix. O que foi enviado antes continua como versão anterior do documento.
- **E2E**: passo 6c. **Complexidade**: baixa.

#### A3. Enviar a arte final com o selo
- **Quando**: a arte foi validada **e** a certificadora enviou o certificado do produto. Só existe quando a linha do produto exige certificação.
- **Pré-condição**: **E3v + E4**.
- **Passo a passo**: linha "Arte final com o selo · {produto}"; a linha traz os arquivos de apoio "Arte validada" (`lane.input.art`) e "Certificado (selo)" (`lane.input.certificate`); enviar como em A1.
- **Depois**: todas as raias concluídas liberam o contrato (pedido de amostras e assinaturas, da Wellmix e do fornecedor).
- **Regra**: 3 dias desde a liberação (`purchaseArtFinalSlaDays`).
- **E2E**: passo 6e. **Complexidade**: baixa.

#### A4. Aplicar o selo de certificação na arte (cartão Certificação, passo "Selo aplicado na arte")
- **Quando**: a certificadora enviou o selo. Pendência "Aplicar o selo de certificação na arte: pedido #{n}" (`tasks.seal.apply.title`), detalhe "Baixe o selo no pedido e envie a arte com o selo aplicado." (`tasks.seal.apply.detail`), tipo "Certificação"/etapa "Selo na arte".
- **Rotas**: Pedido → Certificação → "Resolver" (abre o pedido em `#certification-step-cert_seal_art`), ou o cartão "Certificação" (`certFlow.title`) no pedido.
- **Pré-condição**: **E4** (selo enviado).
- **Passo a passo**: na linha "Selo aplicado na arte" (`importFlow.step.cert_seal_art`): "Baixar o selo" (`certFlow.sealDownload`); escolher o arquivo em "Arquivo"; esperar "Arquivo pronto: …"; "Enviar" (`importFlow.submit`).
- **Depois**: "Enviado, aguardando validação"; a Wellmix (quem tem "Validar a arte") recebe "Validar o selo aplicado na arte: pedido #{n}" e valida ou recusa com motivo. Recusado: "Recusado: {reason}" e o botão vira "Enviar de novo". Se a certificadora **trocar o selo**, o passo reabre com o texto de `certFlow.sealReplaced`.
- **Erros**: "Conclua antes o passo anterior." (`importFlow.error.previous_step`); "Este passo já foi validado." (`importFlow.error.already_validated`); "Envie o arquivo." (`importFlow.error.file_required`).
- **E2E**: **não coberto** (o caminho principal não envia esse passo; o pedido segue sem ele, porque "sem trava por enquanto"). Testes de unidade: `tests/unit/cert-seal.test.ts`. **Complexidade**: média.
- **Atenção para o roteiro**: A3 e A4 são dois envios parecidos da mesma arte com selo (um por produto na etapa, outro por pedido no cartão Certificação). Ver Divergências.

#### A5. Corrigir a arte (não conformidade apontada pela Wellmix)
- **Quando**: a Wellmix apontou um problema num SKU. Pendência "Corrigir a arte de {item}: pedido #{n}" (`tasks.art.fix.title`), tipo "Corrigir arte" (`tasks.group.art_fix`).
- **Rotas**: Pendências → "Abrir" (cai em `#artwork-issue-<id>`); Pedido → Arte; cartão "Artes" (`artwork.title`) do pedido.
- **Passo a passo**: na linha "Não conforme" (`artwork.status.open`): campo "O que foi corrigido" (`artwork.fixPh`), arquivo novo, botão "Enviar correção" (`artwork.sendFix`).
- **Depois**: "Corrigida, aguardando aceite" (`artwork.status.fixed`); quem apontou aceita ("Aceitar") ou reabre ("Reabrir") com motivo.
- **Erros**: "Escreva o motivo." (`artwork.error.note_required`); "Essa não conformidade mudou; recarregue." (`artwork.error.invalid_status`).
- **E2E**: não coberto. Unidade: `tests/unit/certification-artwork.test.ts`, `cert-art-routing.test.ts`. **Complexidade**: média.

#### A6. Baixar todas as artes (zip)
- Cartão Artes → "Baixar todas as artes" (`artwork.downloadAll`): versão mais nova de cada arte, faca, etiqueta, arquivo de gráfica e o selo; só entra o que o login pode abrir. Rara, baixa. E2E: só confere o link no login do admin.

#### A7. Mesa de trabalho "Agência de arte"
- `/app/tasks/desk`: filas "Artes a fazer" (`desk.queue.agency.art`) e "Artes finais com o selo" (`desk.queue.agency.artFinal`), com "Abrir" (`desk.open`) e "atrasado" (`desk.late`). Só leitura. **⚠** o botão "Mesa de trabalho" só existe em `/app/tasks`, e o menu da agência leva a `/app` (ver Divergências). Diária, baixa. Unidade: `purchase-order.test.ts` ("mesas de trabalho").

### 2.3 Sugestão de módulos
1. **Arte do pedido** (A1, A2): 10–12 min.
2. **Selo e arte final** (A3, A4): 10–12 min.
3. **Avançado**: correção de arte, zip e mesa de trabalho (A5–A7): 8–10 min.
- **Total**: cerca de 30–35 min.

---

## 3. Agência de marketing na China (`marketing_agency`) — conta `agencia@marketing.cn` (Yiwu Photo Studio; o login abre em chinês)

### 3.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | Amostra (`flow.step.production.sample`) | `/app/flow/production/sample` (bloco com um passo só vira link direto) |
| 3 | Pedidos | `/app/orders` |

### 3.2 Tarefas

Só existem em pedido de compra **com pedido de amostras gerado** e SKU aprovado (`samplesApply`). Nenhuma tem cobertura E2E **com o login da agência**: o caminho principal faz tudo como admin ("Sem agência na China designada, a Wellmix faz a parte dela"). Unidade: `tests/unit/purchase-order.test.ts`.

#### M1. Registrar o recebimento das amostras
- **Quando**: a trading registrou o "Envio à agência de marketing na China (rastreio e comprovante)". **Frequência**: por pedido. **Criticidade**: alta (abre as fotos reais).
- **Rota**: Pendências → "Abrir" (pedido em `#samples-flow`), ou Produção → Amostra.
- **Pré-condição**: **E7** + retirada e envio à China feitos pelo fornecedor.
- **Passo a passo**: cartão "Amostras" (`samplesFlow.title`), linha "Amostras recebidas pela agência (data)" (`importFlow.step.samples_china_received`): escolher a data, "Enviar".
- **Depois**: passo "Concluído" (sem validação); abre a tela das fotos reais.
- **Erro**: "Conclua antes o passo anterior." (`importFlow.error.previous_step`). **Complexidade**: baixa.

#### M2. Enviar fotos e vídeos reais de cada produto
- **Rota**: `/app/orders/<id>/real-media` ("Fotos e vídeos reais · pedido #{n}" `realMedia.title`); no pedido, botão "Fotos e vídeos reais" (`realMedia.open`). Pendência "Fotos e vídeos reais: pedido #{n}" (`realMedia.task.do.title`), tipo "Fotos reais".
- **Pré-condição**: M1 feito; antes disso a tela diz "Abre quando a agência recebe as amostras (cartão Amostras)." (`realMedia.waiting`).
- **Passo a passo**: por produto, "Fotos e vídeos (pode escolher vários)" (`realMedia.files`), botão "Enviar fotos e vídeos" (`realMedia.upload`).
- **Depois**: "Aguardando o marketing" (`realMedia.status.sent`); quem tem "Aprovar as fotos e vídeos reais" na Wellmix aprova ("Aprovado · à venda") ou pede para refazer.
- **Erros**: "Envie ao menos uma foto (só vídeo não troca a foto do catálogo)." (`realMedia.error.real_media_no_photo`); "Escolha ao menos uma foto ou um vídeo." (`realMedia.error.real_media_empty`); "Esta etapa não está aberta agora." (`realMedia.error.real_media_closed`).
- **Regras**: até 20 arquivos por envio (`MAX_FILES`); aceita imagem e vídeo.
- **Complexidade**: média.

#### M3. Refazer as fotos quando o marketing pede
- Situação "Refazer" (`realMedia.status.rejected`) com o motivo; aviso "Pedido #{n}: refazer fotos e vídeos de {product}". Reenviar como em M2 (os arquivos recusados saem do conjunto). Ocasional, baixa.

#### M4. Devolver a amostra à trading
- **Quando**: as fotos de **todos** os produtos foram aprovadas. **Criticidade**: alta: o carregamento do container espera essa devolução validada.
- **Passo a passo**: cartão Amostras, linha "Amostra devolvida à trading para seguir com o pedido" (`importFlow.step.samples_returned`): campo "Como e quando foi devolvida" (`importFlow.ph.samples_returned`), "Enviar".
- **Depois**: "Enviado, aguardando validação"; a trading (login do fornecedor) valida que recebeu.
- **Erro**: "A amostra só volta à trading com as fotos e vídeos reais de todos os produtos aprovados pelo marketing." (`importFlow.error.real_media_required`).
- **Complexidade**: baixa.

### 3.3 Sugestão de módulos
1. **Amostras e fotos reais** (M1–M4): 12–15 min.
- **Total**: 12–15 min (gravar em português; considerar versão em chinês, que é o idioma da conta).

---

## 4. Despachante (`broker`) — conta `despachante@comex.com` (empresa Comex Despachos)

### 4.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | Documentos de carga (`flow.step.production.cargo-docs`) | `/app/flow/production/cargo-docs` |
| 3 | Presença de carga (`flow.step.delivery.cargo-presence`) | `/app/flow/delivery/cargo-presence` |
| 4 | grupo **Pedidos** (`nav.group.orders`) → Pedidos | `/app/orders` |
| 5 | grupo **Pedidos** → NCM dos books (`nav.ncmItems`) | `/app/ncm-items` |

O texto do menu é **"NCM dos books"**, não "NCM dos itens".

### 4.2 Tarefas

#### D1. Desembaraço do pedido (etapa "Desembaraço")
- **Quando e por quê**: o embarque foi confirmado. **Frequência**: por pedido. **Criticidade**: alta (libera o transporte).
- **Rotas**: Pendências → "Abrir" (pendência "Pedido #{n}: Desembaraço"); Entrega → Presença de carga → "Resolver" (`/app/flow/delivery/cargo-presence/<pedido>`); o detalhe do pedido.
- **Pré-condição**: **E11**; o despachante designado no pedido (sem ele, os itens são da Wellmix).
- **Passo a passo** (rótulos `req.*`): "Número do processo" (texto, "Enviar"); "Documentos aduaneiros" (arquivo); "Custos previstos" (opcional; moeda + valor); "Custos realizados" (moeda + valor, "Enviar"); "Liberação aduaneira" ("Confirmar").
- **Depois**: com os obrigatórios feitos a etapa conclui, o "Transporte" abre e o transportador é avisado.
- **Erros**: "Informe o valor (ex.: 1.234,56)." (`orders.error.money_required`); arquivo fora do formato (`orders.error.mime`).
- **Regras**: o despachante lê a etapa Embarque (BL, navio, chegada) depois que ela começa (`PARTNER_READ_STAGES`). `docs/videos/ACHADOS.md` nº 16: a "Liberação aduaneira" aceita confirmação antes dos outros itens.
- **E2E**: `happy-path.spec.ts`, passo 10 (`fillMyRequirements` com `despachante@comex.com`). **Complexidade**: média.

#### D2. Classificar o NCM dos itens de book
- **Quando**: um book foi importado com item sem produto parecido no cadastro; o book só fecha com o NCM de todos. Pendência "Classificar NCM: {group}" (`bookingNcm.task.title`), detalhe "Itens de book sem NCM: {n}". **Frequência**: a cada book novo. **Criticidade**: alta (trava o fechamento do book).
- **Rota**: Pedidos → NCM dos books (`/app/ncm-items`), título "NCM dos itens de book" (`bookingNcm.page.title`).
- **Pré-condição**: a Wellmix importou um book com item sem semelhante. No E2E quem preenche é a Wellmix, na própria linha do book.
- **Passo a passo**: em cada grupo de parecidos, deixar marcados os itens; "NCM (8 dígitos)" (`bookingNcm.page.ncm`); "Aplicar aos marcados" (`bookingNcm.page.apply`).
- **Depois**: "NCM gravado (itens: {n})." (`bookingNcm.page.done`); o item sai da fila e o book pode ser fechado pela Wellmix.
- **Erros**: "O NCM tem 8 dígitos (ex.: 3924.10.00)." (`bookingNcm.error.booking_ncm_invalid`); "Esse NCM não está na tabela fiscal carregada." (`bookingNcm.error.booking_ncm_not_in_table`); "Marque ao menos um item." (`bookingNcm.error.booking_ncm_no_items`).
- **Regras**: a tela mostra só o produto (sem fornecedor, preço nem cliente). Vale para **qualquer** login de despachante com empresa, não só o do pedido.
- **E2E**: não coberto com o login do despachante. Unidade: `tests/unit/booking-ncm.test.ts`. **Complexidade**: média.

#### D3. Classificação fiscal (NCM) do produto, a partir do pedido
- **Rota**: no "Resumo do pedido", link "Classificação fiscal (NCM)" (`catalog.tax.title`) → `/app/products/<id>/tax` (só o primeiro produto do pedido tem o link).
- **Passo a passo**: "Sugerir NCM" (`catalog.tax.suggest`); "Adicionar candidata" (`catalog.tax.add`) com "NCM" ("4, 6 ou 8 dígitos (ex.: 7615.10 ou 76151000)" `catalog.tax.ncmHint`); "Validar" (`catalog.tax.validate`) ou "Rejeitar" (`catalog.tax.reject`).
- **Regra**: "Só uma classificação validada por produto; validar outra substitui a atual." (`catalog.tax.onlyOne`).
- **E2E**: a mesma tela é usada pelo **admin** no passo 5b; com o despachante, não. Por pedido/rara; média.

#### D4. Classificar o NCM de uma solicitação de cliente
- Pendência "Classificar NCM: {product}" (`tasks.ncm.title`) → `/app/requests/<id>/ncm` ("Classificar NCM" `ncm.work.title`): "Sugerir com IA" (`ncm.suggest`), "Confirmar" (`ncm.confirm`). Depende de solicitações de cliente, que hoje só nascem pela vitrine fechada. **Rara. ⚠ não confirmado** em tela. Complexidade média.

#### D5. Acompanhar a certificação e os documentos (só leitura)
- O despachante **vê** o cartão Certificação (memorial, selo, arte com selo) e abre os arquivos, **sem botão de envio** (o E2E confere que não há "Substituir arquivo" nem "Enviar"). Vê também o BL (somente leitura) em Documentos de carga, o pedido completo como a certificadora (cliente, FOB, ficha de compra, documento do pedido) e confirma a leitura dos documentos com "Confirmar leitura".
- **E2E**: `happy-path.spec.ts`, `expectOrderBlocks` e `expectDocumentAck` (login do despachante). Baixa.

#### D6. Bloco do despachante na ficha de compra do pedido (avançado)
- **O que o código permite**: na ficha de compra do pedido (`/app/orders/<id>/purchase-sheet`, link "Ver ficha de compra" `sheet.view` no resumo do pedido), o despachante do pedido edita só o bloco "Despachante (NCM e impostos)" (`sheet.section.customs`): "NCM", "I.I. (%)", "IPI (%)", "Dumping", "Observação do dumping", "Precisa de certificação" e a observação "Qual certificação, órgão, observações"; grava com "Salvar ficha" (`sheet.save`). Regra em `sheetAccess` (`editCustoms`), `src/lib/services/purchase-sheet.ts`.
- **Ressalva**: a ficha de compra é do fluxo antigo; o pedido de compra de hoje não tem o item "Ficha de compra" na Preparação e o E2E roda "sem ficha de compra". Nenhuma pendência leva o despachante até lá. **⚠ não confirmado** se esse bloco é usado no pedido de compra. Sem E2E. Rara; média.

**Não há tarefa de laudo nem de registro na tela** para pedido novo (ver Divergências).

### 4.3 Sugestão de módulos
1. **Desembaraço do pedido** (D1 + leitura de D5): 10–12 min.
2. **NCM: books e produto** (D2, D3): 10–12 min.
3. **Avançado**: NCM de solicitação (D4) e bloco do despachante na ficha (D6): 5–8 min, só depois de confirmar que são usados.
- **Total**: 20–25 min (sem o avançado).

---

## 5. Companhia marítima (`shipping_line`) — conta `armador@maritima.com` (Marítima SA; o login abre em inglês)

### 5.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | Embarque (`flow.step.production.shipment`) | `/app/flow/production/shipment` |
| 3 | grupo **Pedidos** → Pedidos | `/app/orders` |
| 4 | grupo **Pedidos** → Fretes (`nav.freight`) | `/app/freight` |
| 5 | grupo **Pedidos** → Minha tabela de frete (`nav.myFreightTariff`) | `/app/freight/tariff` |

### 5.2 Tarefas

#### S1. Enviar o BL nos Documentos do embarque
- **Quando e por quê**: a invoice foi conferida com o packing list; o BL precisa bater com a invoice, linha a linha. **Frequência**: por pedido. **Criticidade**: alta (sem BL conferido o embarque não é confirmado).
- **Rota**: Pendências → "Abrir" (pendência "BL: pedido #{n}" `shippingDocs.task.bl.title`) → `/app/orders/<id>/shipping-docs#bl`; no pedido, cartão "Documentos do embarque" (`shippingDocs.open`).
- **Pré-condição**: **E8** (invoice "Conferido"). Sem marítima designada, quem faz é a Wellmix.
- **Passo a passo**: quadro "4. BL (companhia marítima)" (`shippingDocs.bl.title`): "Nº do BL" (`shippingDocs.bl.number`), "Nº do container" (`shippingDocs.bl.container`), conferir por item "Caixas", "Peças", "Peso líquido (kg)", "Peso bruto (kg)", "Arquivo do documento" (`shippingDocs.file`), botão "Enviar o BL" (`shippingDocs.bl.submit`).
- **Depois**: bateu → "Conferido" (`shippingDocs.status.accepted`); o passo "BL (original)" do desembaraço conclui sozinho, a fatura do fornecedor fica ativa e a Wellmix é avisada. Não bateu → "Não bateu: refazer" (`shippingDocs.status.rejected`) com "Diferenças encontradas" (`shippingDocs.mismatch.title`); a marítima é avisada e reenvia.
- **Erros**: "Informe o número do documento." (`shippingDocs.error.shipping_number_required`); "Informe o número do container." (`shippingDocs.error.shipping_container_required`); "Envie o arquivo do documento." (`shippingDocs.error.file_required`); "Este documento não está aberto agora." (`shippingDocs.error.shipping_doc_closed`).
- **Regra**: caixas, peças, peso líquido e bruto por item; o peso bate até o centésimo de kg.
- **E2E**: `happy-path.spec.ts` (BL com `armador@maritima.com`, "BL-E2E", container "MSCU1234567"). **Complexidade**: média.

#### S2. Registrar e confirmar o embarque (etapa "Embarque")
- **Rota**: Pendências; Produção → Embarque (itens da etapa na própria tela); detalhe do pedido.
- **Pré-condição**: **E10** (container lacrado no porto e BL conferido) para confirmar; os dados podem ser enviados antes.
- **Passo a passo** (`req.*`): "Data de embarque" (data, "Enviar"); "Previsão de chegada" (só depois da data de embarque; antes mostra "Aguardando a data de embarque" `orders.waiting.ship_date_first`); "Navio / viagem" (texto); "Bill of Lading (BL)" (arquivo, opcional); "Embarque confirmado (data, chegada, navio e BL são opcionais)" (`req.shipped`, botão "Confirmar").
- **Depois**: a etapa conclui, "Desembaraço" abre e o despachante é avisado. Data, chegada, navio e BL ainda podem ser completados depois da confirmação, até o pedido encerrar (`canCompleteLater`).
- **Erros**: "O embarque só é confirmado com o container lacrado no porto e o BL conferido." (`orders.error.shipping_docs_required`); "A previsão de chegada não pode ser antes da data de embarque." (`orders.error.eta_before_ship_date`).
- **Observação**: no cartão da etapa a marítima vê o quadro "Sua tabela de frete" (`tariff.upload.title`) com "Importar planilha" (`tariff.upload.button`); não vê o comparativo das outras companhias.
- **E2E**: passo 10. **Complexidade**: média.

#### S3. Informar o valor do frete de um pedido
- **Quando**: a Wellmix clicou "Pedir frete às companhias marítimas" no pedido (o pedido vai para **todas** as companhias ativas). Pendência "Frete: pedido #{n}", tipo "Frete" (`tasks.group.freight_quote`).
- **Rota**: Pedidos → Fretes (`/app/freight`, título "Cotações de frete" `freight.title`) → `/app/freight/<id>`.
- **Passo a passo**: ler "Características da carga" (`freight.cargoTitle`); em "Informar o frete" (`freight.formTitle`): "Valor do frete", "Moeda", "Tempo de trânsito (dias)", "Válido até", "Observações (rota, transbordo, taxas inclusas)"; botão "Enviar frete" (`freight.form.save`); depois "Atualizar frete" (`freight.form.update`).
- **Depois**: "Frete enviado à Wellmix." (`freight.saved`); situação "Frete informado" (`freight.status.answered`); a Wellmix é avisada no pedido.
- **Erros**: "Informe um valor de frete maior que zero." (`freight.error.invalid_amount`); "Este pedido de frete já foi encerrado." (`freight.error.closed`).
- **Regra**: a marítima vê só a carga (sem preço, fornecedor ou cliente).
- **E2E**: não coberto. **Complexidade**: baixa.

#### S4. Enviar a tabela de frete (Minha tabela de frete)
- **Rota**: Pedidos → Minha tabela de frete (`/app/freight/tariff`), título "Minha tabela de frete" (`tariff.mine.title`).
- **Passo a passo**: quadro "Enviar minha planilha de fretes" (`tariff.mine.importTitle`): "Planilha (.xlsx ou .xlsm)" (`tariff.import.file`), "Data de referência" (`tariff.import.date`), botão "Enviar planilha" (`tariff.mine.submit`).
- **Depois**: "Planilha enviada: {rates} tarifas. A Wellmix já recebeu." (`tariff.mine.imported`); a planilha nova substitui a anterior; a tela mostra a conferência ("Conferência da planilha ({n})").
- **Erros**: "Planilha grande demais (máximo 4 MB)." (`tariff.error.tariff_too_large`); "Formato .xls antigo: abra no Excel e salve como .xlsx ou .xlsm." (`tariff.error.tariff_xls`); 'Não achei as abas "COMPARATIVO - NVT/ITJ/IOA" com a linha "USD POR 40HQ". Use a planilha modelo.' (`tariff.error.tariff_no_sheets`); planilha com senha (`tariff.error.tariff_encrypted`).
- **Regra**: modelo com as abas COMPARATIVO - NVT, ITJ e IOA; só a companhia e a Wellmix veem.
- **E2E**: só o link no cartão do Embarque. Unidade: `tests/unit/freight-tariff.test.ts`. Rara/periódica; **complexidade alta** (planilha modelo).

### 5.3 Sugestão de módulos
1. **BL e confirmação do embarque** (S1, S2): 12–15 min.
2. **Cotação de frete** (S3): 6–8 min.
3. **Avançado**: tabela de frete por planilha (S4): 10–12 min.
- **Total**: 30–35 min.

---

## 6. Transportador (`carrier`) — conta `transportadora@rodo.com` (Trans Rodo)

### 6.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | grupo **Entrega** (`nav.group.arrival`) → Logística (`flow.step.delivery.logistics`) | `/app/flow/delivery/logistics` |
| 3 | grupo **Entrega** → Entrega (`flow.step.delivery.delivery`) | `/app/flow/delivery/delivery` |
| 4 | Pedidos | `/app/orders` |

### 6.2 Tarefas

#### T1. Registrar o transporte e a entrega (etapa "Transporte")
- **Quando**: o desembaraço foi concluído. **Frequência**: por pedido. **Criticidade**: alta (leva o pedido à etapa Entrega).
- **Rotas**: Pendências → "Abrir" ("Pedido #{n}: Transporte"); Entrega → Logística (placa e previsão) e Entrega → Entrega (situação e entrega realizada): a mesma pendência aparece nos dois passos; detalhe do pedido.
- **Pré-condição**: **E12**; o transportador designado (o E2E designa "Trans Rodo" à mão em Parceiros do pedido, porque só entra sozinho quando há um único ativo).
- **Passo a passo** (`req.*`): "Placa do veículo" (texto, "Enviar"); "Previsão de chegada" (data; **na tela é esse o rótulo**, embora seja a previsão de entrega); "Situação do transporte" (opcional); "Entrega realizada" ("Confirmar").
- **Depois**: a etapa conclui e abre a "Entrega"; quem confirma o recebimento é o cliente ou a Wellmix.
- **Erro**: "A previsão de entrega não pode ser antes da previsão de chegada do navio." (`orders.error.delivery_before_eta`).
- **Regra**: no lugar do cartão do pedido, o transportador vê **"Carga e entrega"** (`orders.cargo.title`): "Mercadoria", "Caixas master", "Volume total (CBM)", "Peso bruto total", "Chegada do navio", "Navio / viagem", "Liberação aduaneira", "Entregar em", "Contato". Nunca vê o fornecedor (`canSeeSupplier`).
- **E2E**: passo 10 (`transportadora@rodo.com`). **Complexidade**: baixa.

### 6.3 Sugestão de módulos
1. **Transporte e entrega** (T1, com a leitura do cartão Carga e entrega): 8–10 min; vale uma versão no celular (o roteiro antigo TRA-02 previa).
- **Total**: 8–10 min.

---

## 7. Comex, assessoria (`comex`) — conta `comex@assessoria.com` (Assessoria Comex)

### 7.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | Certificação | `/app/flow/order/certification` |
| 3 | grupo **Produção** (`nav.production`) → Logística | `/app/flow/production/logistics` |
| 4 | → Carregamento | `/app/flow/production/loading` |
| 5 | → Documentos de carga | `/app/flow/production/cargo-docs` |
| 6 | → Embarque | `/app/flow/production/shipment` |
| 7 | grupo **Entrega** → LPCO | `/app/flow/delivery/lpco` |
| 8 | → Presença de carga | `/app/flow/delivery/cargo-presence` |
| 9 | → Canal cinza ou vermelho (`flow.step.delivery.channel`) | `/app/flow/delivery/channel` |
| 10 | → Nota fiscal (`flow.step.delivery.invoice`) | `/app/flow/delivery/invoice` |
| 11 | Pedidos | `/app/orders` |

Dos onze itens, **só Presença de carga, Canal e LPCO têm ação do comex** no pedido de compra; os demais são de acompanhamento (o comex vê os passos, não envia).

### 7.2 Tarefas

Todas ficam no cartão **"Embarque e desembaraço"** (`importFlow.title`), a última seção do pedido (`#import-flow`). Nenhuma tem E2E com o login do comex; a regra está em `tests/unit/import-flow.test.ts`. As pendências de numerário, canal, DI, CE Mercante e CI **já aparecem quando o pedido entra na Inspeção** (não têm passo anterior).

#### X1. Numerário (valor e demonstrativo)
- **Frequência**: por pedido. **Criticidade**: alta (dinheiro).
- **Pré-condição**: **E6**; o comex designado.
- **Passo a passo**: linha "Numerário" (`importFlow.step.numerario`): "Valor (R$)" (`importFlow.amount`), arquivo do demonstrativo, "Enviar".
- **Depois**: "Enviado, aguardando validação"; o financeiro da Wellmix (ação "Numerário") valida ou recusa com motivo; depois registra "Numerário pago" com o comprovante, que o comex vê.
- **Erros**: "Informe o valor." (`importFlow.error.amount_required`); "Envie o arquivo." (`importFlow.error.file_required`). `ACHADOS.md` nº 9: "18.500,00" é recusado (o campo troca só a vírgula por ponto); digitar `18500,00`.
- **Complexidade**: média.

#### X2. Presença de carga (data)
- **Pré-condição**: BL conferido (**E10**). Linha "Presença de carga" (`importFlow.step.cargo_presence`): data, "Enviar". Sem validação. Erro "Conclua antes o passo anterior." Baixa.

#### X3. Canal de parametrização
- Linha "Canal de parametrização" (`importFlow.step.channel`): seletor "Verde", "Amarelo", "Vermelho", "Cinza" (`importFlow.channel.*`), "Enviar". Vermelho ou cinza dispara o alerta "Pedido #{n}: canal {channel}" à Wellmix. Por pedido; média criticidade; baixa complexidade.

#### X4. DI/DUIMP e XML, CE Mercante e Comprovante de importação (CI)
- "DI/DUIMP e XML" (`importFlow.step.di`): "Nº da DI/DUIMP" + arquivo (o XML baixa como anexo); "CE Mercante": "Nº do CE Mercante"; "Comprovante de importação (CI)": arquivo. Todos sem validação. A DI concluída libera a "DANFE (nota de entrada)", que é da Wellmix. Por pedido; baixa.

#### X5. LPCO (licença da importação)
- Só aparece no pedido com produto cujo NCM começa por um prefixo de Configurações → "NCMs que exigem LPCO" (padrão: lista vazia, ou seja, **nenhum pedido**). Linha "LPCO (licença da importação)": "Nº da LPCO" + arquivo, "Enviar"; a Wellmix valida (deferida) ou recusa (indeferida). Rara. **⚠** o título da pendência sai com a chave crua (ver Divergências).

#### X6. Acompanhar (só leitura)
- Booking, container na origem (Logística, Carregamento, Embarque), BL, DANFE e, quando existir, o registro da certificação. Sem ação.

#### X7. Só em pedido fora do pedido de compra (avançado)
- "Invoice e packing list" com o link "Gerar invoice e packing list" (`importFlow.invoice.generate`, página `/app/orders/<id>/invoice`); validar "Draft do BL", "BL (original)" e "Invoice e packing assinados". **Não aparecem no pedido de compra.** **⚠ não confirmado** se algum pedido de hoje usa esse caminho.

### 7.3 Sugestão de módulos
1. **Numerário, presença de carga e canal** (X1–X3): 10–12 min.
2. **DI, CE Mercante, CI e LPCO** (X4, X5) + o que só se acompanha (X6): 8–10 min.
- **Total**: 20 min. X7 fica fora.

---

## 8. Agente de carga (`logistics`) — conta `agente@cargo.com` (Cargo Agentes de Carga)

### 8.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | grupo **Produção** → Booking (`flow.step.production.booking`) | `/app/flow/production/booking` |
| 3 | → Logística | `/app/flow/production/logistics` |
| 4 | → Carregamento | `/app/flow/production/loading` |
| 5 | → Documentos de carga | `/app/flow/production/cargo-docs` |
| 6 | → Embarque | `/app/flow/production/shipment` |
| 7 | grupo **Entrega** → Presença de carga | `/app/flow/delivery/cargo-presence` |
| 8 | → Canal cinza ou vermelho | `/app/flow/delivery/channel` |
| 9 | → Nota fiscal | `/app/flow/delivery/invoice` |
| 10 | Pedidos | `/app/orders` |

### 8.2 Tarefas

#### G1. Informar o booking (reserva no navio)
- **Quando**: o pedido entrou na Inspeção. **Frequência**: por pedido. **Criticidade**: alta: o container na fábrica (fornecedor) depende do booking **validado**.
- **Rota**: Pendências → "Abrir" (pendência "Booking: pedido #{n}"); Produção → Booking; cartão "Embarque e desembaraço".
- **Pré-condição**: **E6**; o agente designado.
- **Passo a passo**: linha "Booking" (`importFlow.step.booking`): "Nº do booking" (`importFlow.ph.booking`), "Enviar".
- **Depois**: "Enviado, aguardando validação"; a Wellmix valida ("Validar") ou recusa com motivo; validado, o fornecedor é avisado ("sua vez").
- **Erros**: "Preencha o número/data." (`importFlow.error.value_required`); "Este passo já foi validado." (`importFlow.error.already_validated`).
- **E2E**: o caminho principal envia o booking como **admin** e valida como operador (mesma tela e mesma ação; o login do agente não é usado). Unidade: `import-flow.test.ts` ("booking do agente, validado pela Wellmix"). **Complexidade**: baixa.

#### G2. Acompanhar (só leitura)
- Container na origem, BL, presença de carga, canal, CE Mercante, DANFE.

#### G3. Só em pedido fora do pedido de compra (avançado)
- "Draft do BL" (arquivo, valida o comex) e "BL (original)" (nº + arquivo). **Não existem no pedido de compra.**

### 8.3 Sugestão de módulos
1. **Booking e acompanhamento do embarque** (G1, G2): 8–10 min.
- **Total**: 8–10 min.

---

## 9. Certificadora, OCP (`ocp`) — conta `ocp@certifica.com` (Certifica OCP)

### 9.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` |
| 2 | Certificação | `/app/flow/order/certification` |
| 3 | Pedidos | `/app/orders` |
| fora do menu | Mesa de trabalho | `/app/tasks/desk` |

A tela Certificação é **só a lista, uma linha por produto** (sem os cartões por pedido embaixo).

### 9.2 Tarefas

#### O1. Enviar o certificado (Inmetro) de cada produto
- **Quando**: o pedido nasceu com produto de linha que exige certificação. **Frequência**: por produto. **Criticidade**: alta (segura a arte final e o contrato).
- **Rota**: Pedido → Certificação → "Resolver" na linha do produto → `/app/flow/order/certification/<pedido>?item=<item>` (quadro "Este produto no passo" `flow.order.focus.title`, link "Ver tudo do pedido neste passo" `flow.order.focus.all`).
- **Pré-condição**: **E1**; a certificadora vinculada ao pedido (sem ela, ninguém envia, e a Wellmix recebe "Vincular a certificadora (OCP): pedido #{n}").
- **Passo a passo**: na linha "Certificado (Inmetro) · {produto}": "Escolher arquivo" ou "Tirar ou escolher foto" (envia ao escolher).
- **Depois**: a tela volta ao mesmo produto com "Salvo." (`flow.work.saved`); o item fica "Concluído"; com a arte validada, libera a "Arte final com o selo" da agência.
- **Erro**: `orders.error.lane_not_assignee` (login de outra certificadora ou do despachante).
- **Regra**: 15 dias desde o pedido (`purchaseCertSlaDays`). Produto que já tem certificação válida de cada tipo exigido pelo período do pedido: o sistema conclui o item sozinho, sem pendência para a certificadora (`certificationCoversHorizon`, `src/lib/services/purchase-gates.ts`).
- **E2E**: `happy-path.spec.ts`, passo 6d. **Complexidade**: média.

#### O2. Enviar o memorial descritivo e o selo
- **Quando**: desde que o pedido nasce. Pendências "Gerar o selo de certificação: pedido #{n}" (`tasks.seal.issue.title`) e "Enviar o memorial descritivo: pedido #{n}" (`tasks.memorial.send.title`), tipo "Certificação".
- **Rota**: Pendências → "Abrir" (pedido em `#certification-featured`), ou Pedido → Certificação → "Resolver".
- **Passo a passo**: no quadro do alto do cartão "Certificação", com a instrução `certFlow.featured.hint`: quadro **Selo** (`importFlow.step.cert_seal`): "Nº do selo ou do registro (opcional)" (`importFlow.ph.cert_seal`) + arquivo, "Enviar"; quadro **Memorial descritivo** (`importFlow.step.cert_memorial`): arquivo, "Enviar".
- **Depois**: cada quadro recolhe em "Concluído" com o link "Arquivo" e "Nº do selo ou do registro: {value}"; quem faz a arte recebe "Aplicar o selo de certificação na arte". As pendências somem.
- **Erros**: "Envie o arquivo." (`importFlow.error.file_required`); "O arquivo está vazio." (`importFlow.error.empty`).
- **Regra**: só a certificadora do pedido envia os dois; a Wellmix e o despachante só acompanham.
- **E2E**: passo 6d ("SELO-E2E-1"). **Complexidade**: baixa.

#### O3. Substituir o arquivo do selo ou do memorial
- **Passo a passo**: "Substituir arquivo" (`certFlow.replace.start`) → escolher → "Novo arquivo: {name}" → "Confirmar substituição" (`certFlow.replace.confirm`) ou "Cancelar".
- **Depois**: "Arquivo substituído" (`certFlow.replace.done`); o número do selo fica como estava; se a arte com o selo já tinha sido enviada, ela reabre para a agência.
- **Erro**: "A substituição não foi feita: {reason} O arquivo anterior continua valendo." (`certFlow.replace.failed`).
- **E2E**: passo 6d (cancelar, falhar com arquivo vazio, substituir). Rara; baixa.

#### O4. Ler o pedido completo para certificar (só leitura)
- No pedido: "Resumo do pedido" com cliente, fornecedor e FOB; "Ver ficha de compra" (`sheet.view`); "Documento do pedido" → "Abrir o documento" (`orderSign.link.open`); "Itens do pedido" com foto; "Documentos"; no cartão Certificação, a orientação `certFlow.dossier.hint` e "Certificações já registradas do produto e do fornecedor:" (`certFlow.dossier.certs`). E2E: `expectOrderBlocks` confere os atalhos do quadro (com o despachante, que vê o mesmo). Baixa.

#### O5. Mesa de trabalho "Certificadora"
- `/app/tasks/desk`: fila "Certificados a emitir" (`desk.queue.ocp.certificates`). Mesma ressalva de acesso da agência.

### 9.3 Sugestão de módulos
1. **Certificado por produto** (O1 + leitura O4): 10–12 min.
2. **Memorial, selo e substituição de arquivo** (O2, O3, O5): 10–12 min.
- **Total**: 20–25 min.

---

## 10. Jurídico (`legal`) — conta `juridico@wellmix.com` (login sem empresa)

### 10.1 Menu e telas

| Ordem | Rótulo | Rota |
| --- | --- | --- |
| 1 | Pendências | `/app` (sempre vazia: nenhuma regra gera pendência para o jurídico) |
| 2 | grupo **Pedidos** → Pedidos | `/app/orders` (todos os pedidos, só leitura) |
| 3 | grupo **Pedidos** → Multas (`nav.penalties`) | `/app/penalties` |

### 10.2 Tarefas

#### J1. Acompanhar as multas e mudar a situação
- **Quando**: a Wellmix registrou uma multa no pedido ("Registrar multa" `orders.penalty.new`); o jurídico recebe a notificação "Multa registrada no pedido" (texto fixo em português). **Frequência**: rara. **Criticidade**: média.
- **Rota**: Pedidos → Multas (título "Multas" `penalties.title`).
- **Pré-condição**: uma multa registrada por login da Wellmix com a tela Multas (diretorias e admin), no detalhe do pedido.
- **Passo a passo**: colunas "Pedido", "Responsável", "Motivo", "Valor", "Data", "Situação"; botões "Contestada" (`penaltyStatus.disputed`), "Paga" (`penaltyStatus.paid`), "Cancelada" (`penaltyStatus.cancelled`), só os diferentes da situação atual; ícone de conversa do pedido (`chat.open`).
- **Depois**: a situação muda e vai para a auditoria (`penalty.status`). **Ninguém é avisado.**
- **Bloqueios**: não existe botão para voltar a "Em aberto" (`ACHADOS.md` nº 17); o arquivo "Evidência" só abre para a Wellmix.
- **E2E**: não coberto. **Complexidade**: baixa.

#### J2. Consultar qualquer pedido (só leitura)
- O jurídico abre todos os pedidos; vê cliente, fornecedor, etapas iniciadas, documentos e a seção "Multas" com todas as multas do pedido. Sem ação. Rara; baixa.

### 10.3 Sugestão de módulos
1. **Multas e consulta de pedidos** (J1, J2): 6–8 min.
- **Total**: 6–8 min.

---

## Resumo de duração (estimativa)

| Papel | Módulos | Total |
| --- | --- | --- |
| Comum (seção 0.3) | 1 | 10–12 min |
| Cliente | 1 agora (+2 quando a vitrine abrir) | 5–7 min (+25) |
| Agência de arte | 3 | 30–35 min |
| Agência de marketing (China) | 1 | 12–15 min |
| Despachante | 2 (+1 avançado) | 20–25 min |
| Companhia marítima | 3 | 30–35 min |
| Transportador | 1 | 8–10 min |
| Comex | 2 | 20 min |
| Agente de carga | 1 | 8–10 min |
| OCP | 2 | 20–25 min |
| Jurídico | 1 | 6–8 min |

---

## Divergências doc × código / documentado e não implementado

1. **Cliente: o menu diz uma coisa e o início faz outra.** `MENU_HIDDEN` tira a vitrine do menu ("a vitrine ainda não abriu"), mas `/app` do cliente redireciona para `/app/explore`, e o carrinho, as solicitações, o Histórico e o Marketing abrem pelo endereço e funcionam (E2E cobre vitrine e solicitação). `docs/ACCESS.md` seção 5 ainda lista essas telas como do cliente.
2. **Cliente sem pedido no fluxo de hoje.** `docs/WORKFLOW.md` descreve o cliente confirmando o recebimento, avaliando e recomprando; o único gerador de pedido (pedido de compra) usa a Wellmix como cliente e sem solicitante, então o login do cliente não abre pedido nenhum. O E2E confirma o recebimento como admin.
3. **Textos do cliente falam de proposta e sinal**, que saíram em 11/11/2026: `explore.product.how.3` ("Aprovou a proposta? Pague o sinal…"), `help.tasks.customer.body` ("pagar o sinal"), `orders.followup.hint` ("RFQ, cotação, sinal"), `explore.sent` ("mandar a proposta").
4. **Agência: tela "Embalagem" não existe mais.** `docs/ACCESS.md` seção 5 lista "Embalagem" para a agência e `docs/WORKFLOW.md` descreve o briefing em `/app/packaging/{id}` (com o prompt de arte); não há rota `src/app/app/packaging` e o briefing foi removido (`docs/QUOTE_FLOW.md`). Sobram no dicionário `nav.packaging`, `tasks.group.agency.brief` ("Arte na cotação"), `agencyTasks.help.brief` e a frase "da arte na cotação até o selo" em `agencyTasks.intro`.
5. **Agência: texto de ajuda aponta o fornecedor como quem reprova a arte** (`agencyTasks.help.art`: "se o fornecedor reprovar"), mas no pedido de compra quem valida e devolve é a Wellmix. O mesmo em `help.stage.PACKAGING`.
6. **Agência: dois envios da arte com selo.** "Arte final com o selo" (item da etapa, por produto) e "Selo aplicado na arte" (cartão Certificação, por pedido) coexistem; `docs/CERTIFICATION.md` seção 12 lista a unificação como melhoria futura. O E2E só faz o primeiro.
7. **Laudo e registro da certificação.** `docs/CERTIFICATION.md` (tabela do topo e seção 14) diz que são do despachante; o código não os mostra em pedido novo (`orders/[id]/page.tsx`: "Laudo e registro saíram da tela") e não cria pendência de começar (`certCandidate`). `ACHADOS.md` nº 7 e seção 4 já registram. Efeito: o despachante não tem tarefa de certificação hoje.
8. **Textos da certificação citam o despachante como quem envia o selo**, quando só a OCP pode: `certFlow.sealReplaced` ("O despachante trocou o selo…"), `certFlow.notify.sealReady.body`, `certFlow.notify.sealChanged.body`, `certFlow.brief.sealPending` ("aguardando o despachante"), `certFlow.missing.ocp` ("Sem despachante.").
9. **`docs/CERTIFICATION.md` se contradiz sobre o que a OCP vê**: a seção 6 diz que cliente e preço ficam invisíveis; a seção 11.2 e o código mostram cliente e FOB (e a ficha com preço).
10. **"Resolver aqui" na tela do passo (passos de embarque, origem, amostras e certificação).** `docs/FLOW_MENU.md` descreve o cartão de passos na própria tela do passo. Pela leitura do código, `FlowStepWork` só monta o cartão para pendência com `orderId`, e as pendências desses passos são criadas sem `orderId` (`src/lib/services/tasks.ts`, bloco de `importTasks`). O "Resolver" delas leva ao detalhe do pedido na âncora do cartão. Os itens de etapa (arte, certificado, desembaraço, transporte, embarque) têm `orderId` e aparecem na tela do passo. **⚠ não confirmado em tela.**
11. **Mesa de trabalho sem entrada pelo menu do parceiro.** `docs/DESKS.md` diz "Pendências → Mesa de trabalho"; o botão existe só em `/app/tasks`, e o menu da agência e da OCP aponta "Pendências" para `/app`. O parceiro chega lá ao usar um filtro da lista (que leva a `/app/tasks?…`) ou pelo endereço.
12. **Pendência do LPCO com a chave crua.** `IMPORT_STEP_LABEL` (`tasks.ts`) não tem `lpco`; o título sai "lpco: pedido #{n}". **⚠ não confirmado em tela.** Os demais títulos de pendência de embarque são texto fixo em português (não traduzem para en/zh).
13. **BL da marítima fora do passo dela no menu.** A pendência "BL: pedido #{n}" cai em Produção → Documentos de carga (`shipping_*`), e o menu da companhia marítima só tem Produção → Embarque: o contador do menu dela não conta o BL (aparece só em Pendências). O mesmo vale para "Frete" (cai em Produção → Logística).
14. **Menu maior que o trabalho.** Comex e agente de carga têm 9 e 8 passos no menu, mas no pedido de compra agem em poucos (comex: presença, numerário, canal, DI, CE, CI, LPCO; agente: booking). O despachante tem "Documentos de carga" só para ler o BL; `docs/SHIPPING_DOCS.md` confirma que ele não faz nada nesses documentos.
15. **Rótulo "Previsão de chegada" no Transporte**: o item do transportador é a previsão de entrega (rótulo gravado "Previsão de entrega"), mas a tela usa `req.eta` = "Previsão de chegada" (`ACHADOS.md` nº 36).
16. **BL em dois lugares** para a companhia marítima: o BL conferido nos Documentos do embarque e o item opcional "Bill of Lading (BL)" da etapa Embarque (`docs/IMPORT_FLOW.md`, "Limites", já admite a duplicidade).
17. **Pendências do comex antes da hora.** Numerário, canal, DI, CE Mercante e CI não têm passo anterior e viram pendência assim que o pedido entra na Inspeção, antes do embarque. `docs/IMPORT_FLOW.md` não fala de quando elas abrem.
18. **`docs/WORKFLOW.md` desatualizado** nos responsáveis: descreve "Arte e embalagem" com arte da agência e aprovação do fornecedor; no pedido de compra a etapa é "Contrato e assinaturas" e a arte é raia da Preparação. O checklist padrão da Preparação também é antigo (`ACHADOS.md` seção 4).
19. **Roteiros antigos que não valem mais**: `02-cliente.md` CLI-03 (proposta e sinal) e CLI-04 a CLI-06 (sem pedido para o cliente); `04-agencia.md` AGE-01 a AGE-04 (briefing, prompt, valor por item); `05-…` COM-01 e LOG-01 na parte de invoice, draft do BL e BL; `06-…` OCP-01/02 na parte de laudo e registro.
20. **Documento do pedido diz "você assina" para a OCP**, que só lê (`ACHADOS.md` seção 4).
21. **`access.denied` manda o parceiro para "Gestão → Equipe e divisões"**, tela que só a Wellmix tem (`ACHADOS.md` nº 24).

## Dúvidas de permissão

1. **Despachante com a visão da certificadora.** `isOrderCertifier` vale para o despachante do pedido: ele vê cliente, FOB, a ficha de compra com preço, o documento do pedido e todos os passos visíveis à OCP. Com o memorial e o selo só da OCP e o laudo/registro fora da tela, ainda faz sentido ele ver tudo isso?
2. **Laudo e registro: quem pode enviar.** `actsAs(…, "ocp")` aceita o despachante **e** a OCP do pedido; a doc diz que são só do despachante. Hoje é inócuo (passos ocultos), mas a regra está ambígua.
3. **NCM por qualquer despachante.** `canFillBookingNcm` e `canClassifyNcm` aceitam qualquer login de despachante com empresa, sem vínculo com pedido: todo despachante vê todos os itens de book sem NCM e todas as solicitações sem NCM.
4. **Tabela "Documentos" do pedido para os parceiros.** `canSeeDoc` abre a quem não é cliente todo documento com visibilidade "supplier" (arte, faca, arquivos de gráfica, BL). `ACHADOS.md` nº 4 já pergunta se agência, despachante, comex, agente, marítima e transportador deveriam ver.
5. **Jurídico vê todos os pedidos** (`canViewOrder` devolve verdadeiro), com cliente, fornecedor, etapas iniciadas (inclusive os valores informados nelas, por exemplo os custos do desembaraço) e documentos. `stageVisibleTo` trata o jurídico como cliente/fornecedor, não como parceiro. É o desejado?
6. **Multas dentro do pedido**: cliente e fornecedor ainda veem todas as multas do pedido, com o nome do responsável (pendência de decisão registrada em `docs/PARTNER_ACCESS.md`, "Em aberto").
7. **Quem muda a situação da multa**: admin, operador com a tela Multas e jurídico (`updatePenaltyStatusAction`). O operador entra por ter a tela, não por uma ação própria.
8. **Agência com "Designer do pedido"**: havendo designer, só aquele login envia a arte e a arte final; os outros logins da mesma agência veem o pedido mas recebem `lane_not_assignee`. Vale confirmar se a agência sabe quem é o designer (não há indicação para ela na linha; "Com: …" é visão da Wellmix).
9. **Agência de marketing e o pedido de amostras**: ela não abre `/app/orders/<id>/samples` (só a Wellmix e o fornecedor), mas vê a divisão Brasil/China? O código mostra a tabela da divisão só para a Wellmix e o fornecedor (`samplesSplit`); a agência vê os passos e o botão das fotos reais.
10. **Despachante edita a ficha de compra** (bloco "Despachante (NCM e impostos)", `editCustoms`): a regra continua ativa em pedido de compra, onde a ficha não faz parte da Preparação. Deve continuar?
11. **Wellmix faz a parte do parceiro mesmo com ele designado**: `actsAs` devolve verdadeiro para qualquer login da Wellmix em todos os passos (menos memorial, selo, numerário e rastreio). O E2E usa isso (admin envia o booking e a parte da agência de marketing). No vídeo, vale dizer que é exceção?

## Termos e siglas de pronúncia ambígua (os que aparecem na tela desses papéis)

| Termo na tela | Onde aparece | Observação de locução |
| --- | --- | --- |
| **BL**, "BL (original)", "Bill of Lading (BL)", "Draft do BL", "Nº do BL" | marítima, comex, agente, despachante | "bê-éle" ou "bill of lading" |
| **DI/DUIMP**, "DI/DUIMP e XML", "Nº da DI/DUIMP" | comex | "dê-i", "du-imp"; **XML** "xis-eme-éle" |
| **CE Mercante** | comex, agente | "cê-é mercante" |
| **CI**, "Comprovante de importação (CI)" | comex | "cê-i" |
| **LPCO**, "Nº da LPCO" | comex, agente, despachante | "éle-pê-cê-ó" |
| **DANFE (nota de entrada)** | comex e agente (leitura) | "dânfe" |
| **NCM**, "NCM (8 dígitos)", "NCM dos books" | despachante | "ene-cê-eme" |
| **OCP**, "OCP (certificação)", "Faz: OCP" | OCP, agência, despachante | "ó-cê-pê" |
| **Inmetro**, "Certificado (Inmetro)" | OCP, agência | "inmétro" |
| **FOB**, **EXW** | OCP e despachante (resumo); "Incoterm" na carga da marítima | "fób"; "é-xis-dáblio" ou "ex works" |
| **Incoterm** | marítima (carga do frete) | "incotérm" |
| **CBM**, "Volume total (CBM)", "CBM por caixa", "m³" | marítima, transportador | "cê-bê-eme" ou "metro cúbico" |
| **40HQ / 40HC** | marítima (tabela de frete) | "quarenta agá-quê / high cube" |
| **PTAX**, **IOF** | marítima (planilha) | "pê-tax", "i-ó-éfe" |
| **Booking**, "Nº do booking" | agente de carga, comex | reserva no navio; não confundir com "Book" (planilha do fornecedor) |
| **Book**, "NCM dos books", "Book nº {n}" | despachante | planilha de produtos do fornecedor |
| **Numerário** | comex | adiantamento das despesas de desembaraço |
| **Canal de parametrização** (Verde, Amarelo, Vermelho, Cinza) | comex, agente | |
| **Die cut / Faca (die cut)** | agência | "dai-cãt"; a tela usa "Faca (die cut)" |
| **SKU** | agência (não conformidade), OCP | "ésse-cá-u" |
| **Packing list**, **Invoice** | marítima, comex | "péquin list", "invóice" |
| **AWB** ("Rastreio / AWB") | agência de marketing (leitura do envio) | "a-dáblio-bê" |
| **SLA** | prazos das pendências | "ésse-éle-á" |
| **ETA / ETD** | **não aparecem** para esses papéis com a sigla (a tela usa "Previsão de chegada" e "Data de embarque"); ETD só no cartão Produção, que é do fornecedor e da Wellmix | |
| **POP** ("Custos do transporte na origem (POP)") | comex e agente só leem (compra EXW) | "póp" |
| **RADAR**, modalidade de operação | despachante e jurídico (selo no resumo do pedido) | |

## Tarefas idênticas entre papéis (gravar uma vez só)

1. **Entrar, trocar a senha, idioma, Pendências, Mensagens e Notificações**: igual para os dez papéis (seção 0.3). O cliente difere só no início (cai na vitrine) e no endereço das Pendências (`/app/tasks`).
2. **Tela do passo do menu** (abas Pendências e Todos no passo, filtros de prazo, "Resolver"): igual para agência, agência de marketing, despachante, marítima, transportador, comex, agente e OCP; muda só o nome do passo.
3. **Preencher item de etapa do pedido** (texto, data, valor, arquivo, "Confirmar"): o mesmo formulário para o despachante (Desembaraço), a marítima (Embarque), o transportador (Transporte), a agência (arte e arte final) e a OCP (certificado). Um bloco comum "como enviar um item" cobre todos; cada papel grava só os seus campos.
4. **Enviar um passo do cartão** (número, data, valor ou arquivo + "Enviar"; quem valida usa "Validar" ou "Recusar" com motivo): o mesmo componente para o comex (numerário, presença, canal, DI, CE, CI, LPCO), o agente de carga (booking), a agência de marketing (recebimento e devolução da amostra), a agência de arte (selo aplicado na arte) e a OCP (linhas do cartão). Um bloco comum serve para os cinco.
5. **Reenviar depois de recusado** ("Recusado: {reason}" → "Enviar de novo"): igual em todos os passos com validação (booking, numerário, LPCO, selo na arte, devolução da amostra).
6. **Detalhe do pedido: índice, etapas do papel, "Documentos" com "Confirmar leitura", conversa do pedido**: igual para todos os parceiros.
7. **Acompanhar passos sem agir** (Produção → Logística, Carregamento, Documentos de carga, Embarque; Entrega → Presença de carga, Canal, Nota fiscal): comex e agente de carga veem a mesma tela, só leitura. Um trecho serve aos dois.
8. **Classificação fiscal do produto** (`/app/products/<id>/tax`): mesma tela para o despachante e para a Wellmix (o roteiro da Wellmix pode reaproveitar).
9. **Mesa de trabalho** (`/app/tasks/desk`): mesma tela para a agência e a OCP (filas diferentes) e para a Wellmix.
10. **Ler o pedido completo para certificar** (ficha de compra, documento do pedido, itens com foto): a OCP e o despachante veem o mesmo.
11. **Multas dentro do pedido** (seção "Multas", só leitura): igual para qualquer parceiro que seja o responsável; o jurídico vê todas.
