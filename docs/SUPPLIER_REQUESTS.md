# Seleção de itens e solicitação ao fornecedor

Decisão do dono (10/11/2026): depois de carregar muitos bookings (docs/BOOKING.md, seção 0), a Wellmix compara itens parecidos de vários bookings, escolhe o melhor caso e abre a **solicitação ao fornecedor** dele. Nesta etapa **não nasce produto, cliente nem estoque**: a Wellmix está avaliando itens que estão na fábrica do fornecedor e perguntando se ele faz o que ela precisa. O produto só é criado (ou associado a um existente) depois que a solicitação for aprovada com o fornecedor; essa é a etapa seguinte, ainda não construída.

O dono também registrou que a "Solicitação" que já existia (a do cliente, `requests`) deveria ter sido sempre ao fornecedor. Como ela sustenta todo o fluxo de cotação, pedido e embarque (e o E2E), a solicitação ao fornecedor nasceu como registro próprio (`supplier_requests`), sem mexer na antiga. Rever a solicitação antiga é uma decisão à parte.

## Telas

| Tela                               | Rota                          | Quem                                                |
| ---------------------------------- | ----------------------------- | --------------------------------------------------- |
| Seleção de itens                   | `/app/booking/selection`      | Wellmix com a tela Booking                          |
| Solicitações ao fornecedor (lista) | `/app/supplier-requests`      | Wellmix e fornecedor com a tela Cotações (`quotes`) |
| Uma solicitação                    | `/app/supplier-requests/[id]` | idem; o fornecedor só a própria                     |

A Seleção de itens **substituiu a fila de produtos** do Booking antigo: o botão da tela `/app/booking` leva a ela. A fila antiga (`/app/booking/products`) foi removida em 11/11/2026 (docs/BOOKING.md). No menu, Pedidos ganhou "Seleção de itens" e "Solicitações ao fornecedor"; o fornecedor ganhou "Solicitações ao fornecedor" ao lado de Cotações.

### Seleção de itens

- Mostra os itens dos bookings **Rascunho, Fechados, Em andamento ou Concluídos** (cancelado só pelo filtro de status; até 11/11/2026 o rascunho ficava fora), até 200 de cada vez, ordenados pela descrição para os parecidos ficarem juntos. O item de rascunho tem o selo do status e não pode ser o escolhido (a solicitação pede o booking fechado); pode entrar como alternativa e nos grupos.
- **Busca em qualquer campo**: cada palavra digitada tem de aparecer (parte da palavra vale) na descrição, nome, código, nº do item, material, embalagem, cores, fornecedor, origem ou nº do booking, sem acento nem caixa (`itemSearchText`, `matchesItemSearch`). O campo sugere (autocompletar) os valores dos itens da lista (`searchSuggestions`). "Ver parecidos" em cada item busca pelas duas primeiras palavras significativas da descrição (`similarQuery`).
- Colunas: escolher (um), alternativa (vários), foto, item (descrição, código, cores), fornecedor e origem, booking (nº e data, com link), preço e incoterm, preço em US$ (RMB convertido pela cotação do dia), MOQ, qtd/caixa e inner, CBM, medidas, capacidade, material e embalagem, quantidade da planilha, Superplan (sinal e preço mínimo) e a solicitação em andamento do item.
- O item de **menor preço mínimo do Superplan** entre os mostrados fica destacado ("Melhor preço mínimo", `bestMinimumItem`).
- **Filtros dos bookings** (`src/lib/booking-selection.ts`, no endereço): status (Rascunho, Fechado, Em andamento, Concluído, Cancelado; padrão: todos menos Cancelado), **período** da data do booking num calendário de intervalo só (dois cliques, atalhos últimos 7/30 dias, este mês, mês passado; `DateRangePicker`), fornecedor e origem (cidade do fornecedor). Mudar status, fornecedor ou origem já filtra.
- **Abas Itens e Seleção** (decisão do dono, 11/11/2026):
  - **Itens**: aba só de agrupamento (decisão do dono, 11/11/2026): sem as colunas "Escolher" e "Alternativa" e sem o quadro "Abrir solicitação ao fornecedor"; a escolha é gravada só na aba Seleção, com o grupo (ver "Escolha por grupo"). Cada linha tem a caixa "Agrupar"; a do cabeçalho marca todos os da tela (o que o filtro e a busca mostram). A cesta (`SelectionBasket`, guardada na aba do navegador) continua entre buscas; "Agrupar para seleção" leva até 60 itens, de vários fornecedores, para a aba Seleção (`?tab=selection&ids=…`).
  - **Seleção**: o grupo para comparar (mesma tabela e formulário de abrir a solicitação, só com os itens do grupo; os filtros não valem para o grupo) e os **blocos sugeridos**: itens dos bookings do filtro com nomes parecidos (palavras significativas com Jaccard ≥ 0,5, ligação transitiva; palavra presente em mais de 400 itens não liga), primeiro os blocos com mais fornecedores (`suggestBlocks`). "Comparar e selecionar" abre o bloco como grupo.
- Gravar a escolha (ver "Escolha por grupo"): o item escolhido, as alternativas, a **quantidade** (em branco = a da planilha: PURCHASE QTY IN PCS, senão TT PCS; sem nenhuma, a tela pede a digitada) e **o que a Wellmix precisa no produto** (texto livre que o fornecedor lê).

### Escolha por grupo (decisão do dono, 11/11/2026)

O quadrante de comparação **não abre a solicitação**: ele grava a escolha do grupo. A solicitação nasce depois, dos blocos.

1. **Gravar escolha** (`saveSelectionGroup`): o item que ganhou (um só, de booking fechado), a quantidade de peças (em branco = a da planilha do ganhador) e o que a Wellmix precisa. O grupo são os itens comparados na aba Seleção (a aba Itens só agrupa). Nada vai ao fornecedor: nem solicitação, nem aviso.
2. Fica em `selection_groups` (`status` saved → requested; `replaced` quando outra escolha toma o lugar). Gravar de novo um grupo com algum item em comum com uma escolha ainda não enviada **troca** a anterior (um item não fica em duas escolhas esperando).
3. **Blocos sugeridos**: o bloco cujo ganhador está nele aparece como **Resolvido**, com o item escolhido em verde e a quantidade (`groupForBlock`). Escolhas de grupos montados à mão (sem bloco sugerido) aparecem como cartões próprios. "Rever a escolha" reabre o grupo com a escolha preenchida.
4. **Abrir a solicitação** (`openGroupRequests`): "dos marcados" (cada bloco resolvido tem uma caixa, já marcada) ou "de todos". Abre **uma solicitação só por fornecedor**, com os ganhadores como produtos dela (ver "Uma solicitação, vários produtos"); de cada grupo vai **só o ganhador**; os outros itens do grupo vão como alternativas (só a Wellmix vê). O grupo passa a mostrar "Solicitação nº N aberta" com o link. Um grupo que não abre (ex.: item com solicitação em andamento) continua gravado e a tela diz o motivo; os demais abrem. Uma solicitação só (um fornecedor), sem falha, leva direto a ela.
5. Só a Wellmix com a tela Booking grava, lista e abre. O fornecedor não tem acesso a `selection_groups`.

### Regras da solicitação

1. Uma solicitação **por item escolhido**; o item com solicitação Aberta ou Respondida recusa outra (`supplier_request_exists`). Depois de decidida, pode ter outra.
2. Vai ao **fornecedor do booking** do item (ativo). O booking Fechado passa a Em andamento.
3. A solicitação guarda uma **cópia do item** (`item`), para o fornecedor ver o que foi pedido mesmo que o booking mude.
4. **Alternativas**: até 30 itens parecidos, guardados por id. Só a Wellmix vê (com fornecedor, origem, preço, mínimo do Superplan e link para o booking).
5. Situações: **Aberta** (esperando o fornecedor) → **Respondida** → **Aprovada** ou **Recusada**; **Cancelada** pela Wellmix. Decisões possíveis (`supplierRequestDecisions`): Aberta → Cancelar ou Recusar; Respondida "faz" → Aprovar ou Recusar; Respondida "não faz" → Recusar.
6. **Resposta do fornecedor**: faz ou não faz; se faz, preço por peça (obrigatório) e moeda; pedido mínimo, prazo de produção (dias), modalidade de entrega (FOB/EXW) e observação. Muda até a Wellmix decidir. A Wellmix pode **registrar a resposta** em nome dele quando ela chega por fora (WeChat, e-mail).
7. Avisos (sino, e-mail e WhatsApp em modo mock): ao fornecedor quando a solicitação abre e quando a Wellmix decide; a quem abriu, quando o fornecedor responde.

## Uma solicitação, vários produtos (decisão do dono, 11/11/2026)

Abrir a solicitação de um ou de vários grupos de uma vez gera **uma solicitação só para cada fornecedor**: um número, uma linha na lista (da Wellmix e do fornecedor), um aviso, e os produtos escolhidos dentro dela. Antes, cada produto virava uma solicitação com número próprio.

- No banco continua um registro `supplier_requests` **por produto** (cada produto tem a sua resposta, negociação, decisão e produto criado). Os abertos juntos para o mesmo fornecedor levam o mesmo `number` e o mesmo `batchId`; na tabela aparecem como 2.1, 2.2, 2.3…
- Itens de **bookings diferentes** do mesmo fornecedor entram na mesma solicitação. Fornecedores diferentes: uma solicitação para cada um.
- `requestGroupKey` diz a que solicitação o produto pertence: o `batchId`. A antiga (sem `batchId`) é uma solicitação sozinha, como a tabela já mostrava. `groupRequests` monta a lista.
- **Lista**: uma linha por solicitação, com os produtos, a soma das peças, as situações (com a contagem), "N de M respondidos", o pior SLA e de quem é a vez. "Finalizada em" só quando todos os produtos foram decididos.
- **Aviso** ao fornecedor: um por solicitação ("{products} produtos"), com o link dela.
- As regras por produto (responder, negociar, decidir, criar o produto) não mudaram.

## Tabela da solicitação (decisão do dono, 11/11/2026)

Quem abre `/app/supplier-requests/[id]` (o fornecedor e, desde a segunda rodada, também a Wellmix) vê **primeiro uma tabela** com o produto **desta solicitação** (`supplierRequestGroup`). Até 11/11/2026 a tabela juntava as outras solicitações do mesmo fornecedor e booking; o dono pediu que a tela mostre só a solicitação aberta.

- **Uma informação por coluna**: foto (miniatura que amplia, `PhotoGallery`), nº, produto, código da fábrica, nº do item, material, quantidade, MOQ, preço, moeda e entrega do booking, o que a Wellmix precisa, "faz?", as **condições iniciais** (a primeira resposta "faz": preço, moeda, MOQ, FOB/EXW e prazo; `initialConditions`) e as **condições finais** (as que valem hoje, depois da negociação; `finalConditions`), situação, SLA (prazo com data e hora, "Atrasada"), de quem é a vez, **aberta em**, **1ª resposta** e **última resposta** (data e hora; `answerTimes`).
- Ações rápidas por linha, **só ícones** (o nome fica na dica e no `aria-label`), cada uma numa caixa pequena (`QuickDialog`):
  - **Mensagem**: texto para a conversa da solicitação.
  - **Sim / Não**: resposta definitiva com preço e moeda, **MOQ** e **modalidade de entrega (FOB/EXW)**; o prazo já respondido fica como está. A Wellmix registra a resposta em nome do fornecedor. Só enquanto se pode responder (Aberta ou Respondida, sem contraproposta esperando).
  - **Abrir produto**: a tela completa, no mesmo link com `?view=item`. "Ver todos os produtos" volta à tabela.
- As ações da tabela voltam para a tabela (`view=table`); as da tela do produto voltam para o produto.

## Tela do produto da solicitação (`?view=item`)

- **Resposta**: o formulário completo tem também a **modalidade de entrega (FOB/EXW)** (`supplierIncoterm`; sem ela, a do item do booking).
- **Histórico de interações** (linha do tempo, `requestTimeline`): abertura, cada resposta do fornecedor (ou registrada pela Wellmix), contrapropostas, aceites, novas propostas, recusas, mensagens e arquivos, a decisão da Wellmix e o produto (criado/associado, vitrine, CODPROD), cada um com data e hora, quem fez e o que ficou resolvido. Cada resposta passa a ser um passo `answer` no histórico; a resposta antiga sem passo entra pela `respondedAt`.
- **Conversa**: ícone flutuante de chat no canto inferior direito; abre uma janela pequena com as mensagens e o campo para mandar outra (foto, PDF ou Excel). O cartão Negociação fica só com a contraproposta e a resposta a ela.

## Lista de solicitações

- Datas com hora (aberta em, finalizada em).
- **Finalizada em**: data e hora da decisão da Wellmix e o selo **Dentro do SLA** ou **Em atraso** (decisão depois de abertura + SLA; `finishedLate`).
- **Produtos distintos**: no topo, quantas solicitações e quantos itens diferentes; em cada linha, quantos produtos distintos tem a tabela daquela solicitação (mesmo fornecedor e booking; `distinctProductsByGroup`).

## Negociação (decisão do dono, 11/11/2026)

No detalhe da solicitação, o bloco **Negociação e conversa** guarda o histórico em ordem (`negotiation`, sem limite de rodadas):

1. **Contraproposta da Wellmix**: na resposta "faz", a Wellmix "devolve com contraproposta" de **preço, pedido mínimo e prazo** (ao menos um valor) com **comentário obrigatório**. Só uma contraproposta espera de cada vez.
2. **Resposta do fornecedor** (ou registrada pela Wellmix em nome dele):
   - **Aceitar**: os valores propostos viram a resposta (`supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`).
   - **Nova proposta**: novos valores (preço obrigatório) e comentário opcional; viram a resposta e a vez volta à Wellmix.
   - **Recusar**: fica a resposta anterior.
3. Com contraproposta esperando o fornecedor, a Wellmix **não aprova** (só recusa) e o fornecedor não muda a resposta pelo formulário de resposta (`supplier_request_proposal_pending`).
4. **Conversa**: mensagens livres dos dois lados, com **foto, PDF ou Excel** opcional, enquanto a solicitação está Aberta, Respondida ou Aprovada. O arquivo é um documento com `supplierRequestId`: só a Wellmix e o fornecedor da solicitação abrem (`canAccessDocument`).
5. **Avisos**: cada contraproposta vai ao fornecedor; cada aceite, nova proposta ou recusa, a quem abriu; cada mensagem ou arquivo, ao outro lado.
6. A lista mostra de quem é a vez ("Esperando o fornecedor" / "Esperando a Wellmix", `negotiationTurn`).

## Pendências do fornecedor

A solicitação aparece em "Minhas pendências" do fornecedor, na etapa **Responder a solicitação** (`supplier.request`, a segunda do caminho, depois de "Analisar o Booking"), enquanto a vez é dele (`negotiationTurn` = fornecedor): Aberta, ou Respondida com contraproposta da Wellmix esperando. O prazo é o SLA da negociação; "Com você desde" é a abertura ou a contraproposta. Sai quando ele responde ou a Wellmix decide (`supplierRequestTasks` em `src/lib/services/tasks.ts`).

## SLA da negociação

- **Configurações → SLA**: "SLA da negociação com o fornecedor (minutos)", `supplierRequestSlaMinutes`, padrão **30** (de 1 a 86.400).
- Conta da **abertura da solicitação** (`createdAt`) até a **decisão da Wellmix** (aprovar, recusar ou cancelar).
- Estourado: o selo **Atrasada** aparece na lista e no detalhe (antes, "SLA até dd/mm hh:mm"), e a solicitação entra no **Painel de SLA**: como atraso do fornecedor quando a vez é dele, senão como pendência de quem abriu.
- **Aviso uma vez só** (`slaNotifiedAt`) a quem abriu e aos logins do fornecedor. Ele sai ao abrir a lista ou o detalhe das solicitações e no job diário (`/api/jobs/reminders`).

## Fornecedor sem acesso ao portal

O fornecedor cadastrado pela planilha do booking nasce sem login. Sem login, a solicitação aberta a ele não chega a ninguém. Por isso a Wellmix vê um aviso (`SupplierNoLoginAlert`, `partiesWithoutLogin`):

- **Detalhe do booking**: quando o fornecedor do booking não tem login ativo.
- **Seleção de itens**: no topo, os fornecedores dos itens mostrados que não têm login, e o selo "Sem acesso" na coluna Fornecedor.
- **Solicitação ao fornecedor** (Aberta ou Respondida): "ele não vê nem responde esta solicitação". O aviso lembra que dá para registrar a resposta em nome dele.

Com a tela Cadastros, cada nome leva ao quadro de acesso do cadastro (`/app/parties/{id}#access`). O login criado ali fica preso ao cadastro e passa a ver as solicitações que já estavam abertas. Sem a tela Cadastros, o aviso pede a quem cuida de Cadastros. A solicitação abre normalmente nos dois casos.

## Isolamento

- O fornecedor vê só as solicitações do próprio cadastro (`supplierId` = `user.partyId`); a de outro dá 404. Não vê as alternativas (outros fornecedores), o Superplan nem o booking.
- A foto do item (documento interno do booking) abre para o fornecedor dono de uma solicitação com aquela foto (`supplierSeesRequestPhoto`, em `canAccessDocument`). Outro fornecedor, não.
- Cliente e demais parceiros não abrem as telas.

## Banco

Tabela `supplier_requests` (docs/APPWRITE.md): `number` (contador `supplier_request_number`; o mesmo nos produtos da mesma solicitação), `batchId` (a solicitação a que o produto pertence), `status`, `supplierId` (índice `by_supplier`), `bookingItemId` (índice `by_item`), `bookingLotId`, `alternativeItemIds` (JSON), `item` (JSON, cópia do item), `quantity`, `unit`, `needs`, `searchQuery`, a resposta (`supplierCanDo`, `supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`, `supplierNote`, `respondedAt`, `respondedByUserId`), a decisão (`decidedAt`, `decidedByUserId`, `decisionNote`), `createdByUserId` e o produto (`productId`, com índice `by_product`, `productAction` created/linked, `productLinkedAt`, `productLinkedByUserId`, `showcaseReleasedAt`, `showcaseReleasedByUserId`, `erpCheckedAt`), a negociação (`negotiation`, `slaNotifiedAt`), a modalidade de entrega da resposta (`supplierIncoterm`); índice `by_status`. Arquivos da conversa: `documents.supplierRequestId`. Antes de `npm run appwrite:push`, as telas avisam "esquema desatualizado".

Tabela `selection_groups` (escolha por grupo): `status` saved/requested/replaced (índice `by_status`), `itemIds` (JSON), `chosenItemId` (índice `by_chosen`), `quantity`, `needs`, `supplierRequestId`, `requestedAt`, `createdByUserId`, `updatedByUserId`. Serviço em `src/lib/services/selection-groups.ts`; testes em `tests/unit/selection-groups.test.ts`.

## Onde está

| Parte                                                       | Arquivo                                                                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras (busca, parecidos, US$, melhor caso, decisões) | `src/lib/supplier-requests.ts`; filtros, grupo e blocos sugeridos em `src/lib/booking-selection.ts`                                                                                               |
| Serviço (seleção, abrir, ler, responder, decidir, foto)     | `src/lib/services/supplier-requests.ts`; negociação e SLA em `src/lib/services/supplier-request-negotiation.ts`                                                                                   |
| Ações                                                       | `src/app/app/actions/supplier-requests.ts`                                                                                                                                                        |
| Telas                                                       | `src/app/app/booking/selection/`, `src/app/app/supplier-requests/` (tabela do fornecedor em `_components/supplier-table.tsx`)                                                                     |
| Textos                                                      | `src/i18n/modules/supplier-requests.ts`                                                                                                                                                           |
| Testes                                                      | `tests/unit/supplier-requests.test.ts`; de ponta a ponta (booking → seleção → solicitação → resposta do fornecedor → produto → vitrine → CODPROD) em `tests/e2e/booking-supplier-request.spec.ts` |

## Produto (depois de aprovada; decisão do dono, 10/11/2026)

Na solicitação **Aprovada**, a Wellmix que abre Cotações e Produtos vê o bloco **Produto**, no próprio detalhe da solicitação.

1. **Criar produto novo**: o analista dá o **nome correto** e escolhe a **linha de produto**. O resto vem preenchido:
   - **Preço, moeda e MOQ da resposta do fornecedor** (os negociados). Sem preço na resposta, valem os do booking.
   - Código da fábrica, medidas, caixa, pesos, CBM, capacidade, embalagem, material, cores e função vêm do item. A ficha mestre é gravada com esses valores (`sheetFromRequest`).
   - O fornecedor da solicitação entra como **principal**. O produto herda o **NCM** do item escolhido (docs/BOOKING.md, "NCM do item"). A foto do item é copiada para o produto ("foto do fornecedor").
   - O que a Wellmix pediu ("needs") vai para as observações da ficha.
2. **Associar a um produto existente**: busca no catálogo por nome, código, código da fábrica ou CODPROD, e escolha de um produto ativo. O cadastro dele não muda.
3. **Itens iguais**: o item escolhido sempre entra. As alternativas da solicitação já vêm marcadas, e a busca acha mais itens nos bookings fechados que ainda não têm produto.
   - Todos ficam ligados ao produto (`booking_items.productId`).
   - O fornecedor de cada item entra na lista de fornecedores do produto (`product_suppliers`): o da solicitação com preço, moeda, MOQ e prazo da resposta (`source` "quote"); o de uma alternativa com código e preço do booking ("manual").
   - Item já ligado a outro produto recusa (`request_product_item_taken`).
   - Depois de criado ou associado, "Ligar mais itens" acrescenta outros.
4. **Vitrine**: o produto **criado** nasce **fora da vitrine do cliente** (vitrine, página do produto, carrinho, nova solicitação e kit de marketing) até "Liberar na vitrine". O produto **associado** já existia e não muda. A regra fica em `booking-visibility.ts`.
5. **Sankhya**: só **ligar ao CODPROD que já existe**; o produto não é criado no ERP. O código aparece no cabeçalho da página do produto ("CODPROD …"; sem código, "CODPROD —").
   - A busca usa a descrição (parte) ou a referência do fornecedor (`Produto`: CODPROD, DESCRPROD, REFFORN) e um botão "Usar" em cada resultado.
   - O código também pode ser digitado. Ele é gravado em `products.sankhyaCode`, o mesmo campo do vínculo da carga do Sankhya (docs/SANKHYA.md).
   - Com o Sankhya configurado, o código é **conferido** no ERP (inexistente recusa). Sem credencial, ou com o ERP fora do ar, fica gravado como **não conferido**, e a tela diz isso.
6. **Depois**: o pedido de compra ao fornecedor junta os produtos aprovados do mesmo fornecedor (docs/PURCHASE_ORDER.md).

Tudo fica na auditoria: `product.create`, `product.link_booking`, `product.showcase_release` e `product.erp_code`.
