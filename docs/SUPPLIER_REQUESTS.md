# Seleção de itens e solicitação ao fornecedor

> **22/11/2026 (docs/QUOTATION.md):** para a Wellmix, esta tela é a **Cotação**. A lista mostra também as cotações de compra e os convites de book, e a tela do produto troca o card "O que está sendo negociado" pelo produto da cotação com o quadro comparativo (conversa e histórico de cada fornecedor num modal) e a contraproposta em massa à direita. Para o fornecedor, nada mudou.

Decisão do dono (10/11/2026): depois de carregar muitos bookings (docs/BOOKING.md, seção 0), a Wellmix compara itens parecidos de vários bookings, escolhe o melhor caso e abre a **solicitação ao fornecedor** dele. Nesta etapa **não nasce produto, cliente nem estoque**: a Wellmix está avaliando itens que estão na fábrica do fornecedor e perguntando se ele faz o que ela precisa. O produto só é criado (ou associado a um existente) depois que a solicitação for aprovada com o fornecedor; essa é a etapa seguinte, ainda não construída.

O dono também registrou que a "Solicitação" que já existia (a do cliente, `requests`) deveria ter sido sempre ao fornecedor. Como ela sustenta todo o fluxo de cotação, pedido e embarque (e o E2E), a solicitação ao fornecedor nasceu como registro próprio (`supplier_requests`), sem mexer na antiga. Rever a solicitação antiga é uma decisão à parte.

## Telas

| Tela                               | Rota                          | Quem                                                |
| ---------------------------------- | ----------------------------- | --------------------------------------------------- |
| Seleção de itens                   | `/app/booking/selection`      | Wellmix com a tela Booking                          |
| Solicitações ao fornecedor (lista) | `/app/supplier-requests`      | Wellmix e fornecedor com a tela Cotações (`quotes`) |
| Uma solicitação                    | `/app/supplier-requests/[id]` | idem; o fornecedor só a própria                     |

A Seleção de itens **substituiu a fila de produtos** do Booking antigo: o botão da tela `/app/booking` leva a ela. A fila antiga (`/app/booking/products`) foi removida em 11/11/2026 (docs/BOOKING.md). No menu, Pedidos ganhou "Seleção de itens" e "Solicitações ao fornecedor"; o fornecedor ganhou "Solicitações ao fornecedor" ao lado de Cotações.

### Abas: Em negociação e Encerradas (dono, 18/11/2026)

A lista só mostra negociações (cotações e books), nunca pedidos:

- **Em negociação** (a primeira aba, `/app/supplier-requests`; hoje "Em andamento", docs/QUOTATION.md): solicitações com algum produto ainda aberto ou respondido e, desde 24/11/2026, também as que têm algum produto aprovado com a **amostra ainda não aprovada** (pendente, enviada ou reprovada), para a amostra não sair de vista (decisão do dono, depois da cotação nº 2).
- **Encerradas** (`?tab=closed`): todos os produtos decididos (aprovado, recusado ou cancelado) e, nos aprovados, a amostra aprovada ou dispensada; o aprovado que já está num pedido de compra também conta (`requestClosed`, `src/lib/supplier-request-closing.ts`). Até 24/11/2026 bastava estar decidida, e a aprovada esperando a amostra ia para cá.
- Na aba Encerradas fica o quadro "Gerar pedido de compra" (por fornecedor, para juntar várias solicitações e ajustar a quantidade). A coluna **Pedido** (Wellmix com a tela Pedidos e a ação de gerar o pedido de compra) mostra **"Gerar pedido"** quando todos os produtos aprovados fora de pedido existem no cadastro e têm a amostra aprovada (`requestOrderState`); o botão leva ao quadro com os produtos dela marcados. Senão: "Falta cadastrar N produto(s)", "Esperando a amostra aprovada" ou "Já virou pedido". O pedido segue docs/PURCHASE_ORDER.md, seção 1.
- Saiu do cabeçalho o botão "Seleção de itens" (a Seleção continua no menu e no Booking).

### Seleção de itens

- Desde 26/11/2026 (ver "Trabalho na Seleção"), as abas Itens e Blocos Sugeridos mostram **só os itens ainda não trabalhados dos books fechados** (Fechado, Em andamento ou Concluído), sem o filtro de status. Antes: mostra os itens dos bookings **Rascunho, Fechados, Em andamento ou Concluídos** (cancelado só pelo filtro de status; até 11/11/2026 o rascunho ficava fora), até 200 de cada vez, ordenados pela descrição para os parecidos ficarem juntos. O item de rascunho tem o selo do status e não pode ser o escolhido (a solicitação pede o booking fechado); pode entrar como alternativa e nos grupos.
- **Busca em qualquer campo**: cada palavra digitada tem de aparecer (parte da palavra vale) na descrição, nome, código, nº do item, material, embalagem, cores, fornecedor, origem ou nº do booking, sem acento nem caixa (`itemSearchText`, `matchesItemSearch`). O campo sugere (autocompletar) os valores dos itens da lista (`searchSuggestions`). "Ver parecidos" em cada item busca pelas duas primeiras palavras significativas da descrição (`similarQuery`).
- Colunas: escolher (um), foto, item (descrição, código, cores), fornecedor e origem, booking (nº e data, com link), preço e incoterm, preço em US$ (RMB convertido pela cotação do dia), MOQ, qtd/caixa e inner, CBM, **comprimento, largura e altura** (cm, uma coluna cada; ver "Medidas em três colunas"), capacidade, material e embalagem, quantidade da planilha, **custo por peça** da previsão de preço, a previsão (sinal, venda prevista, com frete e meta) e a solicitação em andamento do item.
- **Sem a coluna "Alternativa"** (pedido do dono, 13/11/2026): a tabela do grupo, na aba Seleção, tinha uma caixa "Alternativa" por linha, entre "Escolher" e "Foto". Ela saiu (cabeçalho e caixas); "Foto" vem logo depois de "Escolher". A caixa não mudava o que era gravado: o grupo são os itens comparados e, ao abrir a solicitação, **todos os outros itens do grupo** vão como alternativas do escolhido (`openGroupRequests`). Nada mudou na regra, na gravação nem no que já estava salvo; a ação continua aceitando o campo `alternatives`, que agora chega vazio.
- **Medidas em três colunas** (pedido do dono, 18/11/2026): a coluna "Medidas (cm)" ("8,3 × 8,3 × 20,5") virou **Comprimento (cm) | Largura (cm) | Altura (cm)**, uma informação por coluna, nas abas Itens e Seleção. Cada coluna lê o seu campo do item do Book, sem separar texto: Comprimento = `lengthCm`, Largura = `widthCm`, Altura = `heightCm` (`SELECTION_DIMENSIONS`, `src/lib/booking-selection.ts`).
  - **Correspondência conferida** (18/11/2026): a planilha do Book traz as medidas em três colunas (SIZE (CM) LENGTH, WIDTH e HEIGHT), lidas cada uma para o seu campo (`product-sheet-import.ts`); a tela do Book, a tabela de consulta do parceiro e o cadastro do produto usam os mesmos nomes para os mesmos campos. Em produção, os 175 itens de Book tinham as três medidas preenchidas, nenhuma guardada junto em texto (o `sizeText` só tem tamanhos de porta-retrato, "A4", "8X10 / 20X25", que ficam na coluna Capacidade) e nenhuma nos `extras`. Nos 9 itens ligados a produto, os iguais ao cadastro batem na mesma ordem (6604: 7 × 8,3 × 17; GRECIE: 21 × 16 × 1,2); os outros são tamanhos diferentes ligados ao mesmo produto. Medida que um dia venha junta numa coluna só de tamanho ("33.5x24.8x1.5") já é separada na importação na ordem comprimento × largura × altura (`parseSize`); a tela não separa texto.
  - **Valor**: em cm, com as casas gravadas (8,3; 15,125; 7), sem arredondar nem completar zeros (`formatMeasure`; teto de 10 casas, que só corta resto de conta), no separador do idioma da tela: vírgula em português, ponto em inglês e chinês, como as outras colunas. Sem a medida, "—" só na coluna dela.
  - **Ordem**: cada título ordena a sua coluna pelo número da célula (crescente, decrescente e a 3ª volta à ordem original); "—" fica sempre no fim, nas duas direções, como nas outras colunas da tabela (`sortKey`/`compareKeys`, `src/lib/table-tools.ts`). A busca da tabela acha a medida como aparece ("15,125").
  - **Visual**: divisórias verticais discretas (as da tabela do Book, `border-zinc-200/70`) antes, entre e depois das três colunas; tipografia e alinhamento das outras colunas numéricas; a largura de cada uma é a do título numa linha, e a tabela continua rolando de lado no computador e no iPad. Nada mais mudou: seleção, cesta, escolha, variações, contas (o CBM pelas medidas quando o item não tem CBM continua o mesmo), filtros, fotos e as outras colunas.
- O item de **menor custo por peça** entre os mostrados fica destacado ("Menor custo por peça", `bestCostItem`). Pelo custo, e não pelo mínimo: o mínimo é custo × markup do tipo de negócio, e bookings fechados com tipos diferentes não se comparam por ele (até 12/11/2026 era o menor mínimo, `bestMinimumItem`).

#### Previsão de preço na seleção (24/11/2026; antes "Superplan na seleção")

Os números vêm do retrato gravado em `booking_items.analysis` pela **previsão de preço do Sankhya** (docs/BOOKING.md, "Previsão de preço do item"), pedida ao **fechar o booking** (o que faltar, o job diário completa; sem botão de refazer desde 24/11/2026); não são refeitos ao abrir a tela. O FOB/EXW não vai para o Sankhya. Quem vê: quem tem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7); sem ela, a Seleção fica sem o custo por peça, a coluna da previsão e o destaque do melhor custo.

- **Custo/peça (previsão)**: o custo por peça que o Sankhya devolveu (`CUSTO_BASE_VENDA`). É o número para comparar com o preço que o cliente paga e decidir o escolhido e as alternativas. A coluna ordena pelo valor; o menor ganha "Menor custo por peça".
- **Previsão de preço**: o sinal (viável, abaixo da meta, prejuízo), a venda prevista, com frete, o lucro e a meta, ou o que faltou ("Sankhya não configurado", a mensagem do Sankhya, NCM, preço, caixa ou CBM). Passar o mouse mostra a data (`BookingItemForecast`, `src/components/booking-item-forecast.tsx`). Retrato antigo, da conta do portal que saiu: "Previsão antiga: refaça a previsão do book".
- O mesmo bloco aparece na solicitação ao fornecedor ("Previsão de preço do item escolhido") e o custo por peça e a venda prevista nas alternativas.
- **Filtros dos bookings** (`src/lib/booking-selection.ts`, no endereço): **nº do book** (desde 26/11/2026, no lugar do status; ver "Trabalho na Seleção"), status (até 26/11/2026: Rascunho, Fechado, Em andamento, Concluído, Cancelado; padrão: todos menos Cancelado), **período** da data do booking num calendário de intervalo só (dois cliques, atalhos últimos 7/30 dias, este mês, mês passado; `DateRangePicker`), fornecedor e origem (cidade do fornecedor). Mudar status, fornecedor ou origem já filtra.
- **Fornecedor = Supplier do book** (dono, 25/11/2026): em toda a Seleção de itens, "Fornecedor" é o Supplier do book, nunca a fábrica: o "Supplier" digitado na importação (`booking_lots.supplierName`) ou, sem ele, o parceiro responsável (`partnerId`; `bookSupplierLabel`). Vale para o filtro (as opções são os Suppliers dos books, um por nome, comparados sem pontuação nem "Co., Ltd.", `supplierFilterKey`; o parâmetro `supplier` leva o nome), a coluna Fornecedor, a busca e as sugestões, a contagem de fornecedores dos blocos e do grupo e a lista Com Solicitação Aberta. O aviso "sem login" segue quem recebe a solicitação (`bookingRecipientId`: o parceiro responsável ou, sem ele, a fábrica). Link antigo com o id da fábrica no `supplier` não filtra mais nada.
- **Abas Itens e Seleção** (decisão do dono, 11/11/2026):
  - **Itens**: aba só de agrupamento (decisão do dono, 11/11/2026): sem as colunas "Escolher" e "Alternativa" e sem o quadro "Abrir solicitação ao fornecedor"; a escolha é gravada só na aba Seleção, com o grupo (ver "Escolha por grupo"). Cada linha tem a caixa "Agrupar"; a do cabeçalho marca todos os da tela (o que o filtro e a busca mostram). A cesta (`SelectionBasket`, guardada na aba do navegador) continua entre buscas; "Agrupar para seleção" leva até 60 itens, de vários fornecedores, para a aba Seleção (`?tab=selection&ids=…`). O link "Abrir cotação" de cada linha faz o mesmo com o item sozinho (dono, 26/11/2026): abre a aba Seleção só com ele (`groupHref([item])`, com os filtros no endereço), para seguir com a solicitação ao fornecedor; não leva mais ao convite de book concorrente (docs/BOOKING_INVITES.md).
  - **Seleção**: o grupo para comparar (mesma tabela e formulário de abrir a solicitação, só com os itens do grupo; os filtros não valem para o grupo). Sem grupo aberto, a aba diz isso e leva a Blocos Sugeridos ou a Itens (`data-selection-group-none`).
  - **Ordem das abas desde 26/11/2026**: Itens, **Blocos Sugeridos**, Seleção e Com Solicitação Aberta (ver "Trabalho na Seleção").
  - **Blocos Sugeridos** e **Com Solicitação Aberta** (pedido do dono, 14/11/2026): duas abas novas, até 26/11/2026 depois de Itens e Seleção, nesta ordem (`SELECTION_TABS` e `parseSelectionTab`, `src/lib/booking-selection.ts`; `?tab=blocks` e `?tab=requested`). Os dois blocos saíram da aba Seleção, onde ficavam embaixo do grupo, e cada aba mostra só o conteúdo dela.
    - **Blocos Sugeridos** (`?tab=blocks`): o quadro "Blocos sugeridos" como era, com os resolvidos esperando a solicitação, os grupos **por resolver**, "Comparar e selecionar" e os botões de abrir a solicitação dos marcados ou de todos. Os blocos são itens dos bookings do filtro com nomes parecidos (palavras significativas com Jaccard ≥ 0,5, ligação transitiva; palavra presente em mais de 400 itens não liga), primeiro os blocos com mais fornecedores (`suggestBlocks`). "Comparar e selecionar" abre o bloco como grupo, na aba Seleção. Os filtros da tela continuam valendo para os blocos.
    - **Com Solicitação Aberta** (`?tab=requested`): a lista compacta (ver "Escolha por grupo", item 4). Ela não depende dos filtros, então a aba não mostra o quadro de filtros; os filtros seguem no endereço e voltam nas outras abas.
    - **Depois de gravar a escolha**, a tela vai para Blocos Sugeridos, onde o grupo aparece resolvido, pronto para abrir a solicitação. Abrir a solicitação dos marcados ou de todos também volta para essa aba. Gravar com "Gravar e gerar com IA" continua na Seleção, com o grupo aberto.
- Gravar a escolha (ver "Escolha por grupo"): o item escolhido (os outros itens do grupo são as alternativas), a **quantidade** (em branco = a da planilha: PURCHASE QTY IN PCS, senão TT PCS; sem nenhuma, a tela pede a digitada) e **o que a Wellmix precisa no produto** (texto livre que o fornecedor lê).

### Escolha por grupo (decisão do dono, 11/11/2026)

O quadrante de comparação **não abre a solicitação**: ele grava a escolha do grupo. A solicitação nasce depois, dos blocos.

1. **Gravar escolha** (`saveSelectionGroup`; desde 26/11/2026, no book da Wellmix, grava e abre a cotação na hora, uma solicitação só com um item por variação × embalagem: ver "Embalagens e variações"): o item que ganhou (um só, de booking fechado), a quantidade de peças (em branco = a da planilha do ganhador) e o que a Wellmix precisa. Opcional: a **programação de compra** (rodadas, peças por rodada e intervalo; a quantidade vira a soma), que vai na solicitação ao responsável pelo booking e faz do pedido de compra um pedido pai com filhos por rodada (docs/PURCHASE_SCHEDULE.md). O grupo são os itens comparados na aba Seleção (a aba Itens só agrupa). Nada vai ao fornecedor: nem solicitação, nem aviso.
2. Fica em `selection_groups` (`status` saved → requested; `replaced` quando outra escolha toma o lugar). Gravar de novo um grupo com algum item em comum com uma escolha ainda não enviada **troca** a anterior (um item não fica em duas escolhas esperando).
3. **Ordem dos blocos** (decisão do dono, 11/11/2026): em cima os **resolvidos** que esperam a solicitação; depois os blocos **por resolver**; separados embaixo, os que já têm **solicitação aberta**. Cada parte com o seu título e a contagem. Desde 14/11/2026, os resolvidos e os por resolver ficam na aba Blocos Sugeridos e os com solicitação aberta, na aba Com Solicitação Aberta.
4. **Blocos sugeridos**: o bloco cujo ganhador está nele aparece como **Resolvido**, com o item escolhido em verde e a quantidade (`groupForBlock`). Cada item do card numa linha com o nome, o fornecedor e o preço (nome e fornecedor encolhem com reticências); no escolhido, o resumo (peças, programações, cores) fica embaixo e quebra a linha: nada passa da borda do card, no computador, no iPad e no celular (dono, 15/11/2026). Escolhas de grupos montados à mão (sem bloco sugerido) aparecem como cartões próprios. "Rever a escolha" reabre o grupo com a escolha preenchida.
   - **"Com solicitação aberta" em lista compacta** (pedido do dono, 13/11/2026): essa parte deixou os cartões e virou uma lista, com **uma linha de largura total por grupo comparado** (`RequestedGroups`, `src/app/app/booking/selection/_components/requested-groups.tsx`). Na linha: o grupo, o link "Solicitação nº N aberta", o resumo do item escolhido (✓ nome, peças, a programação de compra quando houver e o preço em US$) e "Rever a escolha" (o mesmo endereço dos cartões). As outras duas partes continuam em cartões.
   - A linha **começa recolhida**. A seta (o botão é a seta com o nome do grupo; `ExpandRow`, `src/components/expand-row.tsx`) abre, embaixo da própria linha, os **itens comparados que não foram escolhidos**, com os dados dos cartões (nome, fornecedor e preço em US$; o preço fica sob o do escolhido) e o tamanho do grupo; outro toque recolhe. Nada é lembrado entre visitas. O link e "Rever a escolha" ficam fora do botão: tocar neles não abre a linha.
   - A unidade é o **grupo**: dois grupos na mesma solicitação (um fornecedor, vários produtos) são duas linhas, cada uma com o link da própria solicitação.
   - A lista **não depende do filtro da tela**: os itens dos grupos que a busca, os filtros ou o limite da lista deixaram de fora são lidos à parte (só quando faltam; `otherGroupItems`, `src/lib/booking-selection.ts`). Entram o bloco como está hoje e os itens gravados na escolha (`itemIds`). Item sem descrição aparece pelo código da fábrica.
5. **Abrir a solicitação** (`openGroupRequests`): "dos marcados" (cada bloco resolvido tem uma caixa, já marcada) ou "de todos". Abre **uma solicitação só por fornecedor**, com os ganhadores como produtos dela (ver "Uma solicitação, vários produtos"); de cada grupo vai **só o ganhador**; os outros itens do grupo vão como alternativas (só a Wellmix vê). O grupo passa a mostrar "Solicitação nº N aberta" com o link. Um grupo que não abre (ex.: item com solicitação em andamento) continua gravado e a tela diz o motivo; os demais abrem. Uma solicitação só (um fornecedor), sem falha, leva direto a ela.
6. Só a Wellmix com a tela Booking grava, lista e abre. O fornecedor não tem acesso a `selection_groups`.

### Embalagens e variações (dono, 26/11/2026)

Pedido do dono na aba Seleção (`/app/booking/selection?tab=selection&ids=…`), com o vencedor marcado em "Escolher". Tudo fica no card logo abaixo da tabela (`SelectionVariations`, `src/components/selection-variations.tsx`); as contas são regras puras em `src/lib/selection-packing.ts` (testes em `tests/unit/selection-packing.test.ts`; E2E em `tests/e2e/selection-packing.spec.ts`).

1. **Alterar** (ícone ✎): abre uma tabela de uma linha igual ao item escolhido (foto, item, fornecedor, preço e preço em US$ só com "Ver preço de compra", MOQ, Qtd/caixa, CBM, medidas, capacidade e material) com a **Qtd/caixa editável**. Trocar x0 (a do Book) por x1 muda o CBM na proporção: **CBM × x1 ÷ x0** (`alteredCbm`). "Desfazer a alteração" volta à caixa do Book. A conta da programação e dos containers passa a usar a caixa alterada (evento `selection:packing` para o `SelectionQuantity`).
2. **+ Embalagem**: depois da tabela alterada (ou, sem ela, logo abaixo da barra do vencedor) abre, um pouco à direita, a tabela das **novas embalagens**, com a coluna **Qtd/Embalagem** (N) à frente das mesmas colunas. N precisa ser inteiro, 2 ou mais, sem repetir e **dividir a Qtd/caixa final** (a alterada ou a do Book); senão a linha diz o motivo e "Gravar escolha" não envia (o servidor também recusa: `selection_pack_units`, `selection_pack_divide`, `selection_pack_repeat`). Em cada linha: **preço × N** nas duas colunas de preço, **Qtd/caixa ÷ N** e **MOQ ÷ N para cima** (`packSku`); o CBM é o da caixa final. O "+" continua junto da tabela para mais embalagens (até 10).
3. **Toggle no fim da última tabela**: a tabela pai (a alterada; sem alteração, o item escolhido; nunca a avó) **conta ou não como mais uma opção de embalagem** (padrão: conta). Sem embalagem nova, a pai é a única opção.
4. **Card Variações = matriz**: uma linha por variação (as cores do Book, cada uma com a caixa de incluir, e as digitadas) e **uma coluna por embalagem** ("Unitária" e "Emb. N pç", com quantas cabem por caixa). Cada célula tem as **caixas** daquela combinação (divisão igual em caixas master inteiras da caixa final, ou digitadas: mudar uma muda só ela e o total vira a soma) e as peças (ou as embalagens). A conta é a mesma das cores (`splitByColor` sobre as combinações `variação|N`; `splitPacking`), na composição por data do bloco da quantidade. **+ Variação** no fim acrescenta uma variação de texto livre, já incluída, com os mesmos campos; o "×" tira. Sem cor no Book e sem digitada, uma linha só: o item como está.
5. **Mix de cores** (toggle no alto, à direita do card): cores sortidas na mesma embalagem. Muda só a imagem (decisão do dono, 26/11/2026): continua **uma cotação por variação × embalagem**.
6. **Arte de exemplo do SKU**: em cada célula (variação × embalagem) o botão 🖼 carrega a imagem; com o Mix ligado, uma imagem por embalagem (linha "Arte de cada embalagem"). A imagem é reduzida no aparelho e sobe direto ao armazenamento quando dá (`artUploaded.<chave>`), ou vai no formulário (`art.<chave>`); fica como documento interno até a cotação abrir, quando passa a abrir para o fornecedor (`documents.supplierRequestId`).
7. **Prompts de IA para o fornecedor**: o painel saiu da tela por ora (`SHOW_AI_PROMPTS` na página); a geração e o que já foi gerado continuam no código e nas solicitações.
8. **Gravar escolha**: os itens do grupo ficam trabalhados no book (como antes) e a escolha grava `selection_groups.packing` (a caixa alterada e o CBM, as embalagens, o toggle, o Mix, as variações e, por combinação, as peças no total e por data e a arte). **No book subido pela Wellmix** (quem criou o book é da equipe Wellmix; `lotUploadedByWellmix`), a gravação abre na hora **uma solicitação só, com um item por combinação** (mesmo número e mesmo lote, 3.1, 3.2…; `saveAndOpenSelectionGroup` → `openGroupRequests`), direto com o Supplier do book (`bookingRecipientId`), sem Estratégia de compra e sem outros fornecedores, e leva direto a ela. Até a correção do dono de 26/11/2026, cada combinação ganhava número próprio; as quatro cotações abertas assim no mesmo dia (nº 3 a 6) foram juntadas na nº 3, com o lote da nº 3. A combinação sem peças não abre. Uma combinação só, sem nada mudado (uma embalagem, a do Book, sem alteração, sem imagem e com a cor única do Book ou nenhuma) é o fluxo de sempre, sem selo de variação (`trivialPacking`).
9. **Book enviado pelo parceiro** (Trading ou fornecedor pelo portal, "Enviar para Wellmix Conferir"): vai para a **Estratégia de compra** (decisões do dono de 26/11/2026; ver "Book enviado pelo parceiro" logo abaixo). Também quando a escolha gravada antes é aberta pelos Blocos Sugeridos.

**O item de cada SKU** (`supplier_requests.variant`: a chave, a variação, as peças por embalagem, a caixa em peças, o Mix, a arte e a escolha de origem): a cópia do item (`item`) já vem **em embalagens** (`skuItemOf`: preço × N, embalagens por caixa, MOQ ÷ N para cima, CBM da caixa final, inner ÷ N quando divide, pesos × N e a cor da variação) e a quantidade e a programação também (peças ÷ N). Uma cotação em andamento por item e combinação: o item pode ter várias abertas, uma por combinação; a antiga, sem combinação, continua ocupando o item inteiro (`supplier_request_exists`). Na tela da cotação (Wellmix e fornecedor), o quadro **"Variação e embalagem"** (`RequestVariant`, `src/components/request-variant.tsx`) mostra a variação, a embalagem ("Embalagem com 3 peças (8 embalagens por caixa)"), o aviso de que quantidade, mínimo, preço e caixa contam embalagens, o Mix e a arte; na tabela dos produtos, "AZUL · Emb. 3 pç" abaixo do nome.

Esquema (aditivo): `selection_groups.packing` e `supplierRequestIds` (as cotações da escolha), `supplier_requests.variant`. Textos em `src/i18n/modules/selection-packing.ts`.

**Tudo o que a Seleção pôs no item, na cotação** (dono, 26/11/2026: o supplier continua de onde o trabalho parou; antes só apareciam a variação, a embalagem e a arte, e a arte só no detalhe do item). O quadro "Variação e embalagem" (`RequestVariant`, números por `variantFacts` em `src/lib/selection-packing.ts`) mostra a variação (com "Variação digitada na Seleção" quando não é cor do Book), a embalagem, a **caixa master** com a alteração ("Caixa alterada na Seleção (no Book: 60 peças por caixa)"), o **CBM** com a conta (CBM × x1 ÷ x0), o **preço** por embalagem e por peça (só com "Ver preço de compra"), o **mínimo** em embalagens e peças, a **quantidade** em embalagens, peças e caixas master, as **entregas** (data, embalagens, peças e caixas), o Mix e a **arte** (ou "Sem arte de exemplo nesta combinação"). Fica no detalhe do item (`?view=item`), onde a quantidade do resumo vem em embalagens e peças e a arte entra no card Imagens da Wellmix. Na abertura da cotação (a tabela dos produtos), o quadro esteve acima da tabela só no mesmo dia; depois o dono pediu só a tabela, com a arte na galeria da foto (ver "Programação em sublinhas e itens em sets"). A cotação nova grava de onde o SKU partiu no Book (`variant.bookCarton`, `bookCbm`, `bookPrice`, `bookMoq` e `custom`); as abertas antes leem o item do Book (`bookingItemId`).

### Book enviado pelo parceiro (dono, 26/11/2026)

Decisões do dono: o item de book que o parceiro subiu pelo portal vai para a Estratégia de compra; (1) entra como **compra para estoque** ("Estoque Wellmix"); (2) **o parceiro que mandou o book já vem marcado** entre os destinatários; (3) a **cotação de compra aceita o item de book sem produto do cadastro** (o produto continua nascendo só depois da aprovação).

1. **Gravar escolha** (ou "Abrir" nos Blocos Sugeridos) no book do parceiro (`lotUploadedByWellmix` falso: quem criou o book não é da equipe Wellmix): cada combinação variação × embalagem com peças vira uma **demanda** (`requests`) do "Estoque Wellmix", origem `replenishment`, **sem produto**, num **lote só** (uma solicitação na Estratégia), com o nome "Item · variação · embalagem", a quantidade e a programação em embalagens e a ligação ao book em `requests.bookingSource` (item, book, o parceiro `bookingRecipientId`, a cópia do item já em embalagens, a combinação e a escolha). A escolha fica `requested` com `selection_groups.demandIds`; na aba Com Solicitação Aberta, o grupo leva à Estratégia ("Na Estratégia de compra"); a tela avisa "N combinação(ões) foram para a Estratégia de compra" (`groupToStrategy`, `src/lib/services/selection-groups.ts`). Sem embalagens nem variações (ou na combinação trivial), uma demanda com o item como veio do book.
2. **Estratégia de compra**: o cartão da solicitação mostra os SKUs com a embalagem da cópia do item (peças, caixas master e inner, m³; `bookFacts` em `src/lib/services/strategy-packing.ts`), o link leva ao book de origem, e **o parceiro que mandou o book vem marcado** em "Cotar com outros fornecedores" (`strategyBoard`); a busca acrescenta outros. Sem produto não há última compra nem pedido direto: só cotar (`strategy_book_quote_only`), com o aviso "Sem compra anterior".
3. **Cotação de compra**: o item de book entra com a chave da demanda (`bk-<demanda>`, `quoteItemKey`/`isBookKey` em `src/lib/purchase-demand.ts`) e leva a cópia em `PurchaseQuoteItem.book`. O fornecedor convidado vê o nome do SKU, a quantidade, "Wellmix 资料/o que a Wellmix tem" com a caixa, o inner, os pesos, o CBM e o material do book, a foto do item e a arte do SKU (`bookPhotoList`; acesso em `supplierQuotesBookFile`), e responde como sempre (preço, termos, ficha técnica e amostra). A ficha técnica do item de book fica só na resposta: não vai para a revisão do Cadastro (`supplier_product_sheets`), porque não há produto.
4. **Vencedora**: a solicitação ao fornecedor nasce **ligada ao item do book** (`bookingItemId`, `bookingLotId`, a cópia do item com o preço, a moeda, o incoterm e o mínimo da vencedora, a combinação em `variant`, a programação), sem produto; o produto nasce depois da aprovação, pela etapa Produto da solicitação, como na solicitação aberta direto do book.

Esquema (aditivo): `requests.bookingSource`, `selection_groups.demandIds` (o item de book da cotação vai dentro do JSON `purchase_quotes.items`). Testes: `tests/unit/selection-packing-flow.test.ts` (o caminho inteiro, do book à vencedora) e `tests/e2e/partner-book-strategy.spec.ts` (o parceiro sobe e envia, a Wellmix fecha e grava, a Estratégia com o parceiro marcado envia e o parceiro vê a cotação).

### Trabalho na Seleção (dono, 26/11/2026)

Seis ajustes pedidos pelo dono para trabalhar a Seleção de itens book a book:

1. **Itens sem o filtro de status**: a aba Itens (e os Blocos Sugeridos) lista **só os itens não trabalhados dos books fechados** (status Fechado, Em andamento ou Concluído; `CLOSED_SELECTION_STATUSES`; o item trabalhado, `booking_items.workedAt`, sai da lista). O rascunho e o cancelado não aparecem mais (`listSelectionItems` com `pendingOnly`). No lugar das caixas de status, a frase "Só os itens ainda não trabalhados dos books fechados." O parâmetro `status` antigo no endereço é ignorado nessa tela.
2. **Filtro do nº do book** (`?book=<nº>`, `SelectionFilters.lotNumber`): a lista dos books com itens a trabalhar, do maior para o menor ("nº 12 · Supplier · 5 a trabalhar", `SelectionResult.books`), para trabalhar um book inteiro. Vale nas abas Itens e Blocos Sugeridos, junto com a busca, o período, o fornecedor e a origem.
3. **Ordem das abas**: Itens, **Blocos Sugeridos**, Seleção e Com Solicitação Aberta (`SELECTION_TABS`).
4. **Seleção sem filtros, com rascunho e trava**: a aba Seleção é a de trabalhar um grupo já definido, então não tem o quadro de filtros (nem a busca). Depois da primeira mexida (escolher, alterar a caixa, embalagens, variações, Mix, quantidade, programação ou o que a Wellmix precisa), o formulário vai sozinho para o servidor a cada mudança, como **rascunho por login** (`form_drafts`, chave `selection`; `src/lib/services/selection-draft.ts`, `SelectionDraftAutosave`, com "Rascunho salvo às…"). Abrir a aba sem mexer não cria rascunho. **As artes também ficam no rascunho** (dono, 26/11/2026, corrigindo a primeira versão, em que eram escolhidas de novo): a imagem de cada combinação vira um documento do portal assim que é escolhida (foto interna, só a Wellmix vê; `uploadSelectionArtAction` → `registerSelectionArt`), o rascunho guarda o id (`artKeep.<combinação>`) e a arte volta com a seleção. Na gravação, a arte guardada só vale se o documento existir e for imagem. A arte tirada (×) ou a seleção cancelada deixam o documento sem uso, sem apagar.
   - Com um rascunho, a seleção volta como ficou ao abrir a aba Seleção ("Rascunho restaurado"), e as outras abas avisam da seleção em andamento com o link para continuar.
   - **Outra seleção fica travada**: abrir outro grupo na aba Seleção mostra "Você já tem uma seleção em andamento" com "Continuar a seleção em andamento" e "Cancelar a seleção em andamento"; "Gravar escolha" de outro grupo é recusado no servidor (`assertSelectionFree`, erro `selection_draft_other`).
   - **Concluir** ("Gravar escolha", também "Gravar e gerar com IA") apaga o rascunho; **"Cancelar esta seleção"** (embaixo do grupo) descarta o rascunho sem gravar nada e libera (`cancelSelectionDraftAction`, `?cancelled=1`).
5. **Contador no menu**: ao lado de "Seleção de itens", no menu lateral, a soma dos itens ainda não trabalhados (nem trabalhados nem recusados) dos books fechados **travados para o login** (`lockedPendingItems`, `src/lib/services/booking-lots.ts`); fica vermelho quando a trava passou do prazo (`bookingLockSlaHours`). Com book travado, esse número fica **no lugar** do contador do passo: confirmado pelo dono (26/11/2026), porque, com books associados ao analista, o próximo passo dele nesses books é exatamente fazer a seleção e trabalhar cada item. Sem book travado, o contador do passo continua como era.
6. **Família do produto na capa do book**: ver docs/BOOKING.md, "Família do produto na capa do book". Na Estratégia de compra, a demanda do book do parceiro mostra a família do book e os parceiros dessa família (`party_families`) entram como **sugestão** (não marcados); o parceiro que mandou o book continua marcado.

Esquema (aditivo): `booking_lots.familyCode`. Testes: `tests/unit/selection-work.test.ts` e `tests/e2e/booking-selection.spec.ts`.

### Referências por IA (pedido do dono, 12/11/2026)

Logo abaixo do bloco "Gravar a escolha do grupo" fica o painel **Prompts de IA para o fornecedor** (até 13/11/2026 ficava à direita; pedido do dono: os dois cartões um sobre o outro, cada um na largura toda da área de conteúdo, com os três prompts lado a lado; em tela estreita, um por linha): três prompts que a OpenAI transforma em arquivos anexados à solicitação, para o fornecedor ver, além das demais informações, como o produto deve ficar de forma aproximada ao final da produção.

1. **Imagem 1: produto final** e **Imagem 2: detalhes e embalagem** (imagens, modelo `openaiImageModel`, padrão `gpt-image-1`). Com foto no item do booking, a imagem parte dela (`/v1/images/edits`); sem foto, só do texto (`/v1/images/generations`).
2. **Arquivo: ficha para o fornecedor** (texto .txt, em inglês e chinês, modelo `openaiTextModel`, padrão `gpt-5-mini`, `/v1/responses`).
3. Cada prompt vai com os **dados do item** da planilha (descrição, código, material, cores, medidas, capacidade, embalagem, função, caixa) e **o que a Wellmix precisa** (`itemContext`, `src/lib/ai-references.ts`). Só o que a planilha tem: nada de número inventado.
4. **Padrões em Configurações** (Visão de Produto → "Referências por IA na escolha do grupo"): `aiPromptProduct`, `aiPromptDetail`, `aiPromptSheet` e os dois modelos. Na escolha, o painel abre com os prompts dela ou os padrão; só o que difere do padrão é gravado (`selection_groups.aiPrompts`, `promptsToSave`).
5. **"Gravar escolha"** grava os prompts sem gerar. **"Gravar e gerar com IA"** grava a escolha e gera os três arquivos (até 1 a 2 minutos; a página tem `maxDuration` 300 s). Gerar de novo troca os arquivos; o tipo que falhar fica como estava. A escolha fica gravada mesmo se a IA falhar, e o painel diz o motivo (chave recusada, limite/créditos, pedido recusado, sem resposta).
6. Os arquivos ficam com a escolha (`selection_groups.aiAssets`; só a Wellmix abre). Ao **abrir a solicitação**, vão para ela (`supplier_requests.aiAssets` e `documents.supplierRequestId`): o fornecedor da solicitação vê o cartão **Referências geradas por IA** na tela do produto (`?view=item`), com o aviso de que são imagens aproximadas, não fotos de amostra. Outro fornecedor não abre (`canAccessDocument`).
7. Outro ganhador na mesma escolha: os arquivos do anterior saem da escolha.
8. **Modos** (`aiMode` das Configurações; `src/lib/integrations/openai-media.ts`): AUTO usa a OpenAI com `OPENAI_API_KEY` (só no servidor; Configurações mostra se a chave existe, nunca o valor); sem a chave, ou em MANUAL, o botão fica desligado e nada é gerado. MOCK gera exemplos rotulados "EXEMPLO MOCK" (testes e demonstração), com o selo "Exemplo mock".

### Regras da solicitação

1. Uma solicitação **por item escolhido**; o item com solicitação Aberta ou Respondida recusa outra (`supplier_request_exists`). Depois de decidida, pode ter outra.
2. Vai ao **responsável pelo booking** do item (`booking_lots.partnerId`, decisão do dono, 11/11/2026); sem responsável, ao **fornecedor do booking** (ativo). O booking Fechado passa a Em andamento.
3. A solicitação guarda uma **cópia do item** (`item`), para o fornecedor ver o que foi pedido mesmo que o booking mude.
4. **Alternativas**: até 30 itens parecidos, guardados por id. Só a Wellmix vê (com fornecedor, origem, preço, venda prevista e link para o booking).
5. Situações: **Aberta** (esperando o fornecedor) → **Respondida** → **Aprovada** ou **Recusada**; **Cancelada** pela Wellmix. Decisões possíveis (`supplierRequestDecisions`): Aberta → só Cancelar (antes da resposta do fornecedor não há o que aprovar ou recusar; a Wellmix cancela ou manda mensagem; até 12/11/2026 também recusava); Respondida "faz" → Aprovar ou Recusar; Respondida "não faz" → Recusar.
6. **Resposta do fornecedor**: faz ou não faz; se faz, preço por peça (obrigatório) e moeda; pedido mínimo, prazo de produção (dias), modalidade de entrega (FOB/EXW) e observação. Muda até a Wellmix decidir. Só o fornecedor responde, pelo portal (até 12/11/2026 a Wellmix podia registrar a resposta em nome dele).
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

- **Uma informação por coluna**: foto (miniatura que amplia, `PhotoGallery`), nº, produto, código da fábrica, nº do item, material, quantidade, MOQ, preço, moeda e entrega do booking, o que a Wellmix precisa, "faz?", as **condições iniciais** (as do booking, com que a Wellmix abre a solicitação: preço, moeda, MOQ, FOB/EXW; o booking não traz prazo; `initialConditions`) e as **condições finais** (a **última proposta enviada, aceita ou não**: cada passo atualiza as condições em ordem, da resposta do fornecedor à contraproposta da Wellmix, ao aceite/recusa e à nova proposta; com a situação dela: oferta do fornecedor (até 24/11/2026 o selo dizia "Resposta do fornecedor", que parecia uma resposta ainda por vir; o dono pediu a troca), contraproposta enviada, aceita, recusada ou nova proposta do fornecedor; `finalConditions`), de quem é a vez (com a ação e, aprovada, a amostragem; docs/TURNS.md), **aberta em**, **1ª resposta** e **última resposta** (data e hora; `answerTimes`) e, fechando a tabela, a **situação** do produto e o **SLA**, ao lado das ações (ver "Situação, SLA e ações fixas à direita").
- Ações rápidas por linha, **só ícones** (o nome fica na dica e no `aria-label`), em duas linhas (ver "Ações só com ícones"), cada uma numa caixa pequena (`QuickDialog`) ou enviada direto:
  - **Mensagem**: texto para a conversa da solicitação.
  - **Aprovar, Renegociar e Recusar** (desde 13/11/2026, no lugar do "Sim / Não"; só ícones desde 14/11/2026; ver "Três respostas na tabela" e "Ações só com ícones"). O formulário de Renegociar tem preço e moeda, **MOQ** e **modalidade de entrega (FOB/EXW)**; o prazo vigente fica como está. Só o fornecedor responde (desde 12/11/2026 a Wellmix, mesmo admin, não registra a resposta por ele: `supplier_request_supplier_only`). Só enquanto ele pode responder (Aberta ou Respondida; com contraproposta esperando, a oferta é ela).
  - **Abrir produto**: a tela completa, no mesmo link com `?view=item`. "Ver todos os produtos" volta à tabela.
- As ações da tabela voltam para a tabela (`view=table`); as da tela do produto voltam para o produto.

### Programação em sublinhas e itens em sets (dono, 26/11/2026)

Na tabela dos produtos da solicitação (Wellmix e fornecedor), o nível é o dos produtos, não o de um produto:

1. **Sem o quadro "Variação e embalagem"** em cima da tabela. Ele é de um produto e fica no detalhe do item (`?view=item`). Na tabela, a variação fica abaixo do nome e a arte entra na galeria da foto.
2. **Programação como sublinhas** de cada produto, abertas pelos **"Detalhes"** do item. Cada sublinha tem:
   - o número `<nº da solicitação>.<nº da programação>` (6.1, 6.2…; na solicitação com vários produtos, `<nº do produto>.<programação>`, como 2.1.1);
   - a mesma informação do item, com a quantidade da programação e as caixas master e o CBM dessa quantidade (`requestItemSpecs` da programação);
   - a data da programação na coluna Programações;
   - nenhuma ação, porque a resposta é por produto.

   Com programação, cada produto e as suas sublinhas ficam num `tbody` próprio (`data-supplier-table-group`). As sublinhas (`data-supplier-table-round`) só aparecem com o `<details>` do item aberto, pela regra CSS com `:has()` em `src/app/globals.css`. Sem programação, a tabela fica num `tbody` só, como antes, com a ordenação pelos títulos; com os grupos, a tabela não se ordena pelos títulos, para a sublinha não se separar do produto.

3. **Total de peças** sem a linha cinza que somava as unidades.
4. **Item com embalagem modificada vira Set** (`variant.units` ≥ 2):
   - a tabela conta sets: "Total de sets", "Sets por programação", "Sets/caixa master", "Sets/caixa interna" e o MOQ "em sets";
   - a resposta do fornecedor na tabela pede "Preço por set" e "Pedido mínimo (sets)";
   - entra a coluna **"Peças por set"** (`data-supplier-table-pieces-per-set`).

   Os textos ficam em `src/i18n/modules/selection-packing.ts` (`supplierRequests.table.set.*`). Teste: `tests/unit/supplier-table-rounds.test.ts`.

5. **Sem o quadro dos Detalhes** (dono, 26/11/2026, segunda rodada): cores, função, pesos e NCM saíram do "Detalhes" do item. Os "Detalhes" só aparecem quando há programação e só abrem as sublinhas. O link do Book (só da Wellmix) fica abaixo do nome.
6. **Foto, nº e produto fixos** à esquerda na rolagem horizontal, a partir de 768px (`LEFT` em `supplier-table.tsx`; a foto e o nº em caixas de largura certa, `--pin-photo` e `--pin-number`). No celular, as três ocupariam a tela.
8. **"Foto Marketing"** (dono, 26/11/2026): a arte que a Wellmix pôs na variação × embalagem é a segunda coluna, logo depois da Foto, fixa junto com ela, o nº e o produto, e aparece também nas sublinhas (`data-supplier-table-marketing`; a Foto mostra só a foto do Book). A coluna só existe quando a tabela tem itens de variação × embalagem; sem ela, `--pin-mkt` é zero e as colunas fixas ficam como antes.
7. **Conversa no detalhe do item** (`?view=item`): fica na coluna da direita, abaixo do histórico, sempre aberta, para a Wellmix e para o fornecedor (`chatBlock`, `data-negotiation-chat`). A coluna do fornecedor também fica fixa na rolagem. A mensagem enviada volta para `#chat`; no quadro comparativo, o modal da conversa continua como era.

### Três respostas na tabela (pedido do dono, 13/11/2026)

O botão combinado "Sim / Não" da linha deu lugar a **três botões por produto**, só para o fornecedor e só enquanto ele pode responder (Aberta ou Respondida). Mensagem e "Abrir produto" continuam.

- **Oferta vigente** (`currentOffer`, `src/lib/supplier-requests.ts`): com contraproposta da Wellmix esperando, é ela (`proposal`, os valores dela sobre a última resposta); sem resposta ou depois de um "não faço", são as condições do book (`book`); respondida "faz" e sem contraproposta, é a resposta do próprio fornecedor (`own`: a vez é da Wellmix).
- **Aprovar oferta** (até 14/11/2026, o botão "Confirmar {preço}/peça"; o preço continua no nome do botão e na dica): aceita a oferta vigente como está, sem formulário e com confirmação desde 14/11/2026 (ver "Ações só com ícones"; `respondToOffer`, ação `respondOfferAction`). Oferta do book: grava a resposta "faz" com o preço, a moeda, o MOQ e a entrega do book. Contraproposta: o aceite de sempre (`respondToProposal`). Não aparece na oferta `own` (não há o que confirmar) nem em oferta sem preço.
- **Renegociar**: o formulário de antes, já preenchido com a oferta vigente. Sem contraproposta, envia a resposta "faz" com as condições editadas; com contraproposta, envia a nova proposta (`counter`). A vez passa à Wellmix e o item fica em negociação.
- **Recusar oferta**: sem formulário, com confirmação desde 14/11/2026. Oferta do book ou a própria: resposta "não faz". Contraproposta: a recusa de sempre (fica a resposta anterior).
- **Oferta que mudou**: cada botão leva o retrato da oferta mostrada (`token`: origem, passo da negociação e valores). Se ela mudou desde que a tela abriu, nada é gravado (`supplier_request_offer_changed`) e a tela volta com a oferta atual e o aviso.
- Cada formulário leva o `id` do produto da linha: a ação vale só para ele. Permissões, histórico (passos `answer`, `accept`, `counter`, `reject`), auditoria e avisos são os do fluxo que já existia.

### Ações só com ícones (pedido do dono, 14/11/2026)

Os três botões grandes de resposta ("Confirmar 1,25 USD/peça", "Renegociar", "Recusar oferta") deram lugar a ícones compactos, para a coluna Ações ficar mais estreita. As regras e os fluxos são os mesmos: só mudou a forma de mostrar.

- **Duas linhas na célula, alinhadas à direita**: em cima os dois ícones de sempre, mensagem e abrir o produto; embaixo, nesta ordem, **aprovar** (visto, verde), **renegociar** (setas opostas, âmbar) e **recusar** (xis, vermelho). A forma distingue as ações mesmo sem a cor.
- **Disponibilidade por item, como antes** (`currentOffer`): aprovar só na oferta do book ou na contraproposta da Wellmix, com preço; renegociar e recusar sempre que o fornecedor ainda responde. Sem nenhuma das três (produto decidido, ou a tela da Wellmix), a segunda linha não aparece.
- **Nome e dica**: cada ícone tem nome para leitor de tela (`aria-label`; o de aprovar leva o preço, "Aprovar oferta: 1,25 USD/peça") e dica ao passar o mouse com o nome e o que faz (a explicação de antes, que muda com a oferta). A explicação também é lida depois do nome (`aria-describedby`).
- **Legenda**: no toque não existe dica ao passar o mouse; por isso a linha de explicação da tabela mostra os três ícones com o nome ("Na linha de baixo, por item: aprovar, renegociar, recusar"), só para o fornecedor que ainda tem o que responder.
- **Tamanho**: ícones do mesmo conjunto (`icons.tsx`, traço 1,8), desenho de 16 px num quadrado de 28 px com mouse e de 32 px no toque (celular e iPad, `pointer: coarse`), 8 px entre eles. A área de toque vai 4 px além do quadrado (36 px com mouse, 40 px no toque); as áreas vizinhas se encostam sem se sobrepor.
- **Cores com contraste**: verde `emerald-700` (5,4:1 sobre branco), âmbar `amber-600` (3,2:1; o `amber-500`, mais amarelo, ficaria abaixo dos 3:1 exigidos para ícones) e vermelho `red-700` (6,4:1).
- **Confirmação antes de aprovar e de recusar** (decisão do dono, 14/11/2026): ✓ e ✕ abrem uma caixa (`QuickDialog`, como Renegociar) com o produto, as condições da oferta que valem agora (preço e moeda, MOQ, FOB/EXW, prazo) e o que acontece (a explicação de cada oferta). Só o botão da caixa envia: **Aprovar oferta** (verde) ou **Recusar oferta** (contorno vermelho, a regra da marca para ação destrutiva). **Cancelar** (`QuickDialogClose`), o "×", Esc ou tocar fora fecham sem enviar nada, e o foco começa no "×". O envio é o mesmo de antes (`respondOfferAction` com o retrato da oferta).
- **Enviando**: o botão da caixa mostra o indicador e não aceita outro clique; a caixa fecha e a barra do topo acompanha o envio. Um segundo envio da mesma oferta não grava nada (o retrato da oferta já não confere).
- **Largura** (medida em 14/11/2026): a coluna Ações foi de 188 px para 132 px no toque e 120 px com mouse. No celular (390 px), onde só ela fica fixa, ocupava 52% da tabela visível; agora 37%. A linha da tabela baixou de 131 px para 89 px.
- **Teclado**: a ordem do Tab segue a tela (mensagem, abrir, aprovar, renegociar, recusar); antes, "abrir" vinha por último.

### Ficha técnica na tabela (pedido do dono, 13/11/2026)

A tabela ganhou a ficha que o Book já mostra, para o item ser avaliado sem abrir a tela do produto. Nada foi tirado: as colunas e as ações de antes continuam.

- **Colunas novas**, uma informação por coluna: embalagem (ao lado de Material), medidas do produto (cm), capacidade ou tamanho ("350 ml" ou o texto da planilha, como "8X10"), peças por caixa master, peças por caixa interna, CBM por caixa master (m³), total de caixas master e cubagem total (m³). "Quantidade" passou a se chamar "Total de peças" e o MOQ do book mostra a unidade da solicitação (`unit`).
- **De onde vem** (`requestItemSpecs`, `src/lib/supplier-request-specs.ts`): vale a **cópia gravada na solicitação** (`item`); o campo que ela não guarda (solicitação antiga, campo criado depois, como `sizeText`) vem do **item exato do Book** (`bookingItemId`), nunca de outro item com o mesmo nome ou código. Do Book só sai a ficha técnica (`requestBookSpecs`: sem preço nem análise); preço, moeda, entrega e MOQ continuam só os da cópia. Sem dado, "—".
- **Totais**, com as contas que já existiam: caixas inteiras (`roundLoad`; sem CBM, `boxesFor`) e cubagem = caixas × CBM da caixa master. Com programação de compra, cada rodada fecha as suas caixas e os totais são a soma. Sem CBM informado, vale o das medidas (`cbmFromDimensions`, a mesma regra da seleção de itens), mostrado com "≈" e a dica. Sem peças por caixa, os dois ficam "—".
- **Master e interna** são campos separados desde a planilha (QTY/BOX e QTY/INNER): não há valor "36 / 12" guardado junto, então não existe a coluna única "Qtd./caixa".
- **Mais detalhes**, na própria linha (abaixo do nome, abre e fecha): nome do produto quando difere da descrição, cores, função/bateria/voltagem, peso líquido e bruto por peça; para a Wellmix, também o NCM do item do Book e o link do Book. Só aparece o que existe. As medidas da caixa master não são guardadas no Book (só as do item e o CBM da caixa), por isso não aparecem.

### Situação, SLA e ações fixas à direita (pedido do dono, 13/11/2026)

A situação geral do produto e o SLA ficavam no meio da tabela, entre as condições finais e "Vez", e sumiam na rolagem. Passaram para o fim, na ordem **Situação | SLA | Ações**, e o conjunto fica **fixo à direita** enquanto o resto rola.

- **Só essas duas colunas mudaram de lugar.** As outras continuam na mesma ordem; "Vez", "Aberta em", "1ª resposta" e "Última resposta" vêm logo depois das condições finais. A **"Situação" das condições finais** (a da última proposta: "Aceita", "Recusada"…) é outra coluna e não mudou.
- **Situação**: o selo da situação do produto (Aberta, Respondida, Aprovada, Recusada, Cancelada) e, na aprovada, a **amostragem** embaixo (o rótulo "Amostragem" e o selo com a situação dela, com "· Atrasada" quando passou do prazo), que continua levando ao quadro da amostragem no produto.
- **SLA**: o estado em destaque, **Atrasada** (vermelho) ou **No prazo**, e a data e a hora do prazo numa segunda linha menor. Sem SLA (produto já decidido), "—". As regras são as mesmas (`slaOf`): só a forma de mostrar mudou.
- **Coluna compacta "Situação / SLA"** (pedido do dono, 13/11/2026, com imagem de referência): as duas colunas viraram uma só. Em cima o selo da situação (e, na aprovada, a amostragem, como antes); embaixo o selo do SLA (**Atrasada** ou **No prazo**; o "+" vale para os dois, confirmado pelo dono) e, à direita dele na mesma linha, um botão pequeno **"+"**. A data e a hora do prazo começam **recolhidas**; "+" mostra embaixo do selo, dentro da célula, e vira **"−"**, que recolhe de novo. Cada linha abre sozinha (o estado é da linha) e a coluna não muda de largura (a caixa da célula tem largura fixa). Produto já decidido não tem SLA: a célula mostra só a situação. O botão tem nome para leitores de tela ("Mostrar/Ocultar data e hora do prazo") e informa se está aberto (`aria-expanded`). Componente: `sla-due-toggle.tsx`.
- **Ações**: os mesmos botões (mensagem, abrir o produto e as respostas do fornecedor), só com ícones desde 14/11/2026 (ver "Ações só com ícones").
- **Fixas a partir de 1024px de tela** (iPad deitado e computador). Em tela menor (iPad em pé, celular) as fixas tomariam quase toda a largura ao lado do menu: ali só "Ações" fica fixa, como antes, e "Situação / SLA" aparece no fim da rolagem.
- Como é feito (`supplier-table.tsx`): cada coluna fixa precisa saber a largura das que ficam à direita dela, então o conteúdo vai numa caixa de largura certa (variáveis `--pin-*` na moldura da tabela: `--pin-status` para "Situação / SLA"; a das ações muda com o máximo de ícones por linha, 2 ou 3, e com o tipo de tela: 4rem ou 6,25rem com mouse, 4,5rem ou 7rem no toque). As células fixas têm fundo próprio e acompanham o realce da linha.

## Tela do produto da solicitação (`?view=item`)

- **Resposta**: o formulário completo tem também a **modalidade de entrega (FOB/EXW)** (`supplierIncoterm`; sem ela, a do item do booking).
- **Histórico de interações** (linha do tempo, `requestTimeline`), na lateral direita (até 21/11/2026, logo abaixo da resposta do fornecedor; desde então a lateral tem só o Histórico e o Book, ver "Tela da negociação reorganizada"): abertura, cada resposta do fornecedor (as registradas pela Wellmix antes de 12/11/2026 continuam marcadas assim), contrapropostas, aceites, novas propostas, recusas, mensagens e arquivos, a decisão da Wellmix e o produto (criado/associado, vitrine, CODPROD), cada um com data e hora, quem fez e o que ficou resolvido. Cada resposta passa a ser um passo `answer` no histórico. As respostas de antes disso (só a última ficava na solicitação) vêm da auditoria (`supplier_request.answer`, `legacyAnswers`): a hora e o "faz/não faz" de cada uma; só a última tem os valores. A 1ª e a última resposta da tabela usam as mesmas horas.
- **Conversa**: até 21/11/2026, ícone flutuante de chat no canto inferior direito, com uma janela pequena das mensagens e o campo para mandar outra (foto, PDF ou Excel). Desde então fica embutida na seção "Negociação e conversa" do card central, logo abaixo da contraproposta (ver "Tela da negociação reorganizada"); desde 26/11/2026 fica na coluna da direita, abaixo do histórico (ver "Programação em sublinhas e itens em sets", item 7).

### Ficha negociada (decisão do dono, 12/11/2026)

- O cartão principal se chama **"O que está sendo negociado"** (era "O que a Wellmix pede").
- Com a resposta "faz", a ficha do item mostra as **condições combinadas** (`agreedConditions`: resposta do responsável, contraproposta aceita ou nova proposta dele; com contraproposta esperando, a resposta gravada): **preço negociado** (moeda e FOB/EXW), MOQ e prazo de produção. Onde mudou, o valor do booking fica ao lado, **riscado**. O item do booking não é alterado (a planilha continua como veio).
- **Previsão de preço refeita** (só a Wellmix com "Ver preço de compra"): a mesma previsão do booking pela API de preço do Sankhya (`forecastNegotiatedItem`, em `src/lib/services/booking-price-forecast.ts`) com o preço e a moeda negociados, refeita a cada abertura da tela; nada é gravado. Mostra o custo por peça novo com o do booking riscado, a venda prevista e a meta.
- **Alternativas com a nova referência**: a alternativa com custo do booking menor que o custo negociado ganha o selo "mais barata que a negociada"; cada alternativa tem **"Abrir solicitação para esta"** (o item atual e as outras viram alternativas dela, com a mesma quantidade e necessidade; as regras de sempre valem, como `supplier_request_exists`).

### Solicitações ligadas (decisão do dono, 12/11/2026)

- **Ligadas**: as solicitações do item e das alternativas dele, nos dois sentidos (uma lista o item da outra como alternativa; `linkedSupplierRequests`). Só a Wellmix vê, no cartão "Solicitações ligadas" da tela do produto: nº, item, fornecedor e situação.
- **Ao aprovar uma**, cada ligada em andamento (Aberta ou Respondida) passa a **pedir uma resposta** (`linkedApprovalAsking`): **Continuar negociando** (fica o passo `keep` no histórico, só da Wellmix, e a pergunta some até outra aprovação) ou **Recusar** (vai para Recusada mesmo antes da resposta do fornecedor, com a nota "Alternativa aprovada: solicitação nº …"; `resolveLinkedRequest`, permissão `supplierRequest.decide`). A pergunta aparece na aprovada (aviso e botões no cartão) e no topo da ligada até ser respondida.

### Tela da negociação reorganizada (pedido do dono, 21/11/2026)

A mesma tela (`?view=item`), com as mesmas regras, permissões, cálculos, anexos, avisos e histórico; mudou a arrumação. Nada foi apagado: os blocos de antes estão nas seções abaixo. A identidade visual do portal é a de sempre.

**Arrumação**

- **Centro (~75%)**: o card **"O que está sendo negociado"**, com as seções numeradas, nesta ordem e separadas por divisórias discretas:
  1. **Resumo do produto e condições atuais**: foto, nome e códigos; Quantidade (com a programação de compra), Preço/peça, Moeda, Incoterm, Mínimo (peças) e Produção (dias), cada um na sua célula. Com a resposta "faz", as condições combinadas (`agreedConditions`), com o valor do Book riscado ao lado onde mudou; antes dela, as do Book. Para a Wellmix com "Ver preço de compra", a previsão de preço refeita. Logo abaixo, "O que a Wellmix precisa no produto", a programação e as variações de cor.
  2. **Ficha do produto**: uma grade com uma informação por célula, pela mesma regra da tabela da solicitação (`requestItemSpecs`: a cópia gravada na solicitação, completada pelo item exato do Book, com a marca "Book" no que veio dele): Peças por caixa master; Peças por caixa inner (opcional); CBM por caixa master (m³); Caixas master do pedido; CBM total do pedido (m³), com "≈" quando sai das medidas; Comprimento, Largura e Altura **da peça** (cm; dono, 15/11/2026: as medidas do Book são da peça); Capacidade (ml) e Tamanho, separados (`capacityMl` e `sizeText`); Material; Embalagem; Cores; Peso líquido e Peso bruto **por peça** (kg); Função / bateria / 110 / 220; Código da fábrica; Nº do item; o nome do produto quando difere da descrição; e, só para a Wellmix, o NCM e o link "Ver a ficha completa no Book". Zero continua 0; dado ausente é "—".
  3. **Resposta do fornecedor**: a **oferta recebida** numa faixa compacta (selo "Oferta recebida"): Preço/peça, Moeda, Mínimo, Produção, Incoterm, Fornecedor, **Respondida por** (nome e login), Data e hora, Anexos (os arquivos que o fornecedor mandou na conversa), Outras condições (contraproposta aceita, resposta registrada pela Wellmix) e Comentário. A **contraproposta da Wellmix** que espera o fornecedor aparece em outra faixa, azul (selo "Contraproposta da Wellmix", "Enviada em … por …: aguardando o fornecedor"), para não confundir com a oferta recebida. **Rodadas da negociação (n)**, recolhidas: uma linha por passo de oferta (resposta, contraproposta, aceite, nova proposta, recusa), com quem fez, os valores e a hora; a última fica marcada como "Vigente". O formulário de resposta do fornecedor fica logo abaixo da faixa (só ele responde).
  4. **Decisão da Wellmix** (só a Wellmix): "Decidida em … por nome (login)", os avisos de espera e de contraproposta pendente, a observação e Aprovar, Recusar ou Cancelar, com as permissões e efeitos de sempre (`supplierRequest.decide`, `supplierRequestDecisions`).
  5. **Negociação e conversa**: a contraproposta da Wellmix (selo "Em preparação" até enviar) com Preço/peça | Moeda | Mínimo (peças) | Produção (dias) | Incoterm **numa linha só** quando cabe, a previsão de preço do Sankhya, o comentário obrigatório e "Enviar contraproposta"; para o fornecedor, a resposta à contraproposta (Aceitar, Enviar nova proposta, Recusar) na mesma linha de campos; e a **conversa**, embutida e recolhível ("Conversa (n)"), no lugar do chat flutuante.
  6. **Alternativas** (só a Wellmix): a lista de sempre, com "Abrir solicitação para esta".
  - Para o fornecedor, as seções da Wellmix (4 e 6) não aparecem e a numeração segue sem buracos (1 a 4).
  - Abaixo do card, como antes: as referências por IA e as solicitações ligadas.
- **Lateral (~25%)**: só o **Histórico de interações** (`#historico`) e o **Book** (só a Wellmix: o booking, a seleção e a previsão de preço do escolhido).
- **Telas menores que 1280px (iPad)**: a lateral vem depois do conteúdo principal; a partir de 768px, Histórico e Book lado a lado (Wellmix). Nada é cortado nem rola de lado; as grades seguem a largura do próprio quadro (container queries), não a da tela.
- **Visual**: letras de 11 a 13px, campos e botões com 36px de altura nesta tela (toque no iPad; o padrão do portal nas outras telas não mudou), observações curtas que crescem ao arrastar o canto, menos espaço entre os blocos e nenhuma altura fixa além da rolagem da conversa (até 26rem).

**Quem vê a observação da decisão (Opção A do dono, 21/11/2026)**

- A regra não mudou: a observação da decisão aparece para o fornecedor no Histórico de interações (passo da decisão, `requestTimeline`), e o aviso que ele recebe não leva a observação. Agora o campo diz isso: "O fornecedor vê esta observação no Histórico de interações."
- Nada interno passou a ir para o fornecedor com a reorganização: Decisão, Alternativas, Book, previsão de preço, NCM e o passo "Continuar negociando" continuam só da Wellmix; o preço segue "Ver preço de compra" (sem ela, nem o resumo, nem a faixa, nem as rodadas mostram preço e moeda).

**Quem envia e quem recebe**

- Cada mensagem da conversa mostra o autor (nome, "· Você" para quem está vendo, o lado), o login, **"Para:"** e a data e a hora. Acima do campo de escrever, **"Enviando como"** e **"Enviando para"**; nos formulários da resposta, da contraproposta e da resposta a ela, **"De:"** e **"Para:"** acima do botão.
- O destinatário é quem recebe o aviso pela regra que já existia (`notifyOther`, sem mudança): o que a Wellmix manda avisa os **logins ativos do fornecedor** da solicitação (a lista aparece em "Para:"); o que o fornecedor manda avisa o **responsável** (quem abriu a solicitação). A lista é a de hoje: num aviso antigo, os logins do fornecedor podem ter mudado desde então.
- Privacidade (dono, 18/11/2026; docs/CHAT_IDENTITY.md, decisão 2): o fornecedor vê os logins da própria empresa e, da Wellmix, só os de quem já conversa com ele nesta solicitação (quem mandou algum passo que ele vê e o responsável); ninguém mais da equipe aparece (`negotiationPeople`, `src/lib/services/supplier-request-people.ts`). A Wellmix vê todos.
- A conversa continua sendo a da solicitação (quem abre a solicitação na Wellmix e os logins do fornecedor leem); a unificação com o chat privado entre dois logins segue para depois (docs/CHAT_IDENTITY.md).

**Envio sem perder o que foi digitado**

- Resposta, decisão, contraproposta, resposta à contraproposta e mensagem usam as variantes `...StateAction` das mesmas ações (`src/app/app/actions/supplier-requests.ts`, `runState` em `actions/helpers.ts`), que chamam o mesmo serviço: dando certo, a tela volta como antes, com o aviso de sucesso; dando errado, a página não recarrega, o aviso do erro aparece logo abaixo do formulário e o texto, os números e o arquivo escolhidos continuam nos campos (`ActionForm`, `src/components/action-form.tsx`).
- Enquanto envia, campos e botões ficam travados e o botão mostra o indicador: um envio só por clique. Depois de gravar, o formulário volta limpo (a mensagem) ou com os valores gravados (a resposta, com o "✓ Enviado").
- Os avisos, o histórico, a situação, as pendências e as regras de cada passo são os de sempre: o serviço é o mesmo.

**Onde está**: `src/app/app/supplier-requests/[id]/page.tsx` (montagem), `_components/negotiation-sections.tsx` (seção, grade, ficha, faixa da resposta, rodadas, "De / Para"), `_components/offer-row.tsx` (linha de oferta), `_components/negotiation.tsx` (contraproposta e resposta a ela), `_components/negotiation-conversation.tsx` (conversa), textos em `src/i18n/modules/negotiation-screen.ts`.

## Lista de solicitações

- **Vez** (dono, 24/11/2026; docs/TURNS.md): "Aguardando fornecedor" ou "Aguardando Wellmix", a ação embaixo ("Carregar a amostragem", "Responder a solicitação"…), quem age (a peça "Quem pode agir" da tabela da cotação) e, na vez do fornecedor, o **login de quem envia** à vista ("Login: …"), só para o administrador.
- Datas com hora (aberta em, finalizada em).
- **Finalizada em**: data e hora da decisão da Wellmix e o selo **Dentro do SLA** ou **Em atraso** (decisão depois de abertura + SLA; `finishedLate`).
- **Produtos distintos**: no topo, quantas solicitações e quantos itens diferentes; em cada linha, quantos produtos distintos tem a tabela daquela solicitação (mesmo fornecedor e booking; `distinctProductsByGroup`).

## Negociação (decisão do dono, 11/11/2026)

No detalhe da solicitação, o bloco **Negociação e conversa** guarda o histórico em ordem (`negotiation`, sem limite de rodadas):

1. **Contraproposta da Wellmix**: na resposta "faz", a Wellmix "devolve com contraproposta" de **preço, pedido mínimo e prazo** (ao menos um valor) com **comentário obrigatório**. Só uma contraproposta espera de cada vez.
2. **Resposta do fornecedor** (só ele responde, desde 12/11/2026; a Wellmix vê a contraproposta esperando, sem os botões):
   - **Aceitar**: os valores propostos viram a resposta (`supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`).
   - **Nova proposta**: novos valores (preço obrigatório) e comentário opcional; viram a resposta e a vez volta à Wellmix.
   - **Recusar**: fica a resposta anterior.
3. Com contraproposta esperando o fornecedor, a Wellmix **não aprova** (só recusa) e o fornecedor não muda a resposta pelo formulário de resposta (`supplier_request_proposal_pending`).
4. **Conversa**: mensagens livres dos dois lados, com **foto, PDF ou Excel** opcional, enquanto a solicitação está Aberta, Respondida ou Aprovada. O arquivo é um documento com `supplierRequestId`: só a Wellmix e o fornecedor da solicitação abrem (`canAccessDocument`).
5. **Avisos**: cada contraproposta vai ao fornecedor; cada aceite, nova proposta ou recusa, a quem abriu; cada mensagem ou arquivo, ao outro lado.
6. A lista mostra de quem é a vez ("Esperando o fornecedor" / "Esperando a Wellmix", `negotiationTurn`).

### Contraproposta com a previsão de preço (dono, 12/11/2026; previsão do Sankhya desde 24/11/2026)

- **Mesmos campos da resposta**: a contraproposta da Wellmix (e a nova proposta do fornecedor) tem preço, moeda, MOQ, prazo e **modalidade de entrega (FOB/EXW)**. A FOB/EXW aceita ou proposta vira a do fornecedor (`supplierIncoterm`).
- **Previsão de preço** (só a Wellmix com "Ver preço de compra", no formulário "Devolver com contraproposta"): a tela pergunta à API de preço do Sankhya (a mesma da Nova solicitação) pela rota `/api/price-forecast/booking-item`, com a ficha e o NCM do item do book, quando a digitação para (uma chamada de cada vez):
  - digitando o **preço sugerido**: custo por peça e venda prevista (com a venda prevista do book para comparar);
  - pela **inversa**, digitando o **preço de venda desejado (R$ por peça)**: o preço máximo de compra (função inversa do Sankhya) e o botão "Usar este preço". Sem resposta: "O Sankhya não achou um preço de compra para esse preço de venda".
  - Moedas RMB, US$ e euro; faltando dado do item (NCM, caixa, CBM) ou sem o Sankhya configurado, a tela diz isso e nada é estimado. É estimativa: o que vale é o que o fornecedor responde.

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
- **Solicitação ao fornecedor** (Aberta ou Respondida): "ele não vê nem responde esta solicitação". O aviso pede para criar o acesso: só ele responde (até 12/11/2026 o aviso oferecia registrar a resposta em nome dele).

Com a tela Cadastros, cada nome leva ao quadro de acesso do cadastro (`/app/parties/{id}#access`). O login criado ali fica preso ao cadastro e passa a ver as solicitações que já estavam abertas. Sem a tela Cadastros, o aviso pede a quem cuida de Cadastros. A solicitação abre normalmente nos dois casos.

## Isolamento

- O fornecedor vê só as solicitações do próprio cadastro (`supplierId` = `user.partyId`); a de outro dá 404. Não vê as alternativas (outros fornecedores), a previsão de preço nem o booking.
- A foto do item (documento interno do booking) abre para o fornecedor dono de uma solicitação com aquela foto (`supplierSeesRequestPhoto`, em `canAccessDocument`). Outro fornecedor, não.
- Cliente e demais parceiros não abrem as telas.
- Na Wellmix, o preço de compra (booking, resposta, condições, linha do tempo, negociado, alternativas, pedido de compra) e a previsão de preço aparecem só com "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seções 7 e 8). Quem abre a tela sem a permissão vê a resposta como "Faz" e faz contraproposta de MOQ, prazo e FOB/EXW, sem preço; o servidor ignora preço enviado por ele (`proposeCounter`).

## Banco

Tabela `supplier_requests` (docs/APPWRITE.md): `number` (contador `supplier_request_number`; o mesmo nos produtos da mesma solicitação), `batchId` (a solicitação a que o produto pertence), `status`, `supplierId` (índice `by_supplier`), `bookingItemId` (índice `by_item`), `bookingLotId`, `alternativeItemIds` (JSON), `item` (JSON, cópia do item), `quantity`, `unit`, `needs`, `searchQuery`, a resposta (`supplierCanDo`, `supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`, `supplierNote`, `respondedAt`, `respondedByUserId`), a decisão (`decidedAt`, `decidedByUserId`, `decisionNote`), `createdByUserId` e o produto (`productId`, com índice `by_product`, `productAction` created/linked, `productLinkedAt`, `productLinkedByUserId`, `showcaseReleasedAt`, `showcaseReleasedByUserId`, `erpCheckedAt`), a negociação (`negotiation`, `slaNotifiedAt`), a modalidade de entrega da resposta (`supplierIncoterm`); índice `by_status`. Arquivos da conversa: `documents.supplierRequestId`. Antes de `npm run appwrite:push`, as telas avisam "esquema desatualizado".

Tabela `selection_groups` (escolha por grupo): `status` saved/requested/replaced (índice `by_status`), `itemIds` (JSON), `chosenItemId` (índice `by_chosen`), `quantity`, `needs`, `supplierRequestId`, `requestedAt`, `createdByUserId`, `updatedByUserId`, `aiPrompts` (JSON, prompts próprios da escolha) e `aiAssets` (JSON, arquivos gerados pela IA; também em `supplier_requests.aiAssets`). Serviço em `src/lib/services/selection-groups.ts` e `src/lib/services/ai-references.ts`; testes em `tests/unit/selection-groups.test.ts` e `tests/unit/ai-references.test.ts`.

## Onde está

| Parte                                                       | Arquivo                                                                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras (busca, parecidos, US$, melhor caso, decisões) | `src/lib/supplier-requests.ts`; filtros, grupo e blocos sugeridos em `src/lib/booking-selection.ts`                                                                                               |
| Serviço (seleção, abrir, ler, responder, decidir, foto)     | `src/lib/services/supplier-requests.ts`; negociação e SLA em `src/lib/services/supplier-request-negotiation.ts`                                                                                   |
| Ações                                                       | `src/app/app/actions/supplier-requests.ts`                                                                                                                                                        |
| Telas                                                       | `src/app/app/booking/selection/`, `src/app/app/supplier-requests/` (tabela do fornecedor em `_components/supplier-table.tsx`)                                                                     |
| Textos                                                      | `src/i18n/modules/supplier-requests.ts`; tela da negociação reorganizada em `src/i18n/modules/negotiation-screen.ts`                                                                              |
| Testes                                                      | `tests/unit/supplier-requests.test.ts`; de ponta a ponta (booking → seleção → solicitação → resposta do fornecedor → produto → vitrine → CODPROD) em `tests/e2e/booking-supplier-request.spec.ts` |

## Amostragem (depois de aprovada; 12/11/2026)

A aprovação abre a **Amostragem**: o responsável pelo booking envia fotos e vídeos de uma amostra do item e a Wellmix aprova ou reprova (docs/SUPPLIER_SAMPLING.md). O produto e o pedido de compra só saem depois da amostra aprovada; prazo padrão de 1 dia.

## Produto (depois de aprovada; decisão do dono, 10/11/2026)

> **26/11/2026 (docs/PRODUCT_REGISTRATION.md):** o bloco saiu da tela da cotação e virou a tela **Cadastrar produto**, logo depois de Cotação no menu, com todos os campos do cadastro do Sankhya e o envio pela API. As regras abaixo continuam valendo lá (criar com a ficha, associar, itens iguais, vitrine e CODPROD); na cotação fica o atalho.

Na solicitação **Aprovada**, a Wellmix que abre Cotações e Produtos vê o bloco **Produto**, no próprio detalhe da solicitação.

1. **Criar produto novo**: o analista dá o **nome correto** e escolhe a **linha de produto**. O resto vem preenchido:
   - **Condições combinadas** (`agreedConditions`, mostradas no formulário): as finais da negociação (`finalConditions`: resposta do fornecedor, contraproposta aceita ou nova proposta dele) para preço, moeda, MOQ, entrega (FOB/EXW) e prazo; contraproposta recusada ou ainda pendente fica com a resposta gravada do fornecedor; sem preço na resposta, valem os do booking. Até 11/11/2026 só a resposta gravada valia (a contraproposta aceita não chegava ao produto).
   - **SKU = código da fábrica** (11/11/2026): é o REFFORN que o Sankhya recebe e pelo qual a sincronização acha ou vincula o CODPROD (`syncProduct`); antes o SKU nascia vazio e a inclusão no ERP não achava o código depois.
   - **Para incluir no Sankhya** (`erpReadiness`, no formulário): DESCRPROD (nome), REFFORN, NCM, pesos e medidas, com o que falta em vermelho (obrigatório) ou amarelo (completa-se no produto). A lista de linhas mostra o CODGRUPOPROD de cada uma ou "sem grupo do Sankhya" (sem grupo a inclusão no ERP recusa).
   - Código da fábrica, medidas, caixa, pesos, CBM, capacidade, embalagem, material, cores e função vêm do item. A ficha mestre é gravada com esses valores (`sheetFromRequest`).
   - **Medidas da peça, não da caixa** (dono, 15/11/2026): as medidas do Book (SIZE LENGTH/WIDTH/HEIGHT) são da peça. Vão para "Dimensões do produto" no cadastro, como na importação da planilha. A ficha mestre não as recebe em "Medidas da caixa master", que ficam vazias (o Book não traz as da caixa), e o CBM da caixa é o do Book. Até aqui elas entravam como medidas da caixa e o CBM era recalculado pelo volume da peça: nos dois produtos criados assim em produção (GRECIE e Teste), 0,0004 e 0,001 m³ no lugar de 0,0255 e 0,08. Os dois foram corrigidos com o CBM do Book e as medidas da caixa vazias, com registro na auditoria (`product.cbm_fixed`). Nos 75 itens de Book em produção, as medidas nunca bateram com o CBM da caixa.
   - O fornecedor da solicitação entra como **principal**. O produto herda o **NCM** do item escolhido (docs/BOOKING.md, "NCM do item"). A foto do item é copiada para o produto ("foto do fornecedor").
   - O que a Wellmix pediu ("needs") vai para as observações da ficha.
2. **Associar a um produto existente**: busca no catálogo por nome, código, código da fábrica ou CODPROD, e escolha de um produto ativo. O cadastro dele não muda. Sem busca digitada, a lista já traz **sugestões** (`suggestCatalogProducts`): produtos ativos com o código da fábrica do item no SKU ou no código do fornecedor, ou com todas as palavras da descrição. As buscas da tela (itens, catálogo e Sankhya) são formulários GET que mantêm `view=item`; até 11/11/2026 elas voltavam para a tabela da solicitação.
3. **Itens iguais**: o item escolhido sempre entra. Vêm marcados os **itens da seleção** (`selectionItemIds`): as alternativas da solicitação, os itens dos grupos da Seleção de itens em que o escolhido está (de vários bookings) e as alternativas de outra solicitação do mesmo item (a escolha gravada depois da solicitação aprovada abre outra, com as alternativas nela). Sem busca, aparecem desmarcados os itens de **mesmo código da fábrica** de outros bookings (rascunho, fechado, em andamento ou concluído) sem produto; a busca acha outros.
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

## Solicitação nascida da cotação de compra (15/11/2026)

A cotação de compra vencedora, aprovada pela Diretoria de compras (docs/PURCHASE_DEMAND.md), cria a solicitação ao fornecedor sem item de book (`bookingItemId` e `bookingLotId` vazios): uma por produto, com o mesmo número, o produto do catálogo já ligado (`productAction: "linked"`) e a resposta preenchida com o preço, a moeda, o incoterm, o prazo de produção e o pedido mínimo cotados (`status: "answered"`). Guarda `quoteResponseId` e as demandas (`demandIds`). A Wellmix decide, a amostragem e o pedido de compra seguem como sempre; o pedido de compra leva as demandas (`orders.demandIds`).

## Solicitações do cliente e Books no menu do fornecedor (dono, 23/11/2026)

> Desde 27/11/2026 a tela se chama **Consultas** e junta também as cotações de compra, na tabela padrão do fornecedor com Tipo e Completude; a tela do item do fornecedor foi reorganizada (moeda antes do preço, arte no alto, programação na seção 3, resposta à direita). Ver docs/QUOTATION.md, seção 9.

Pedido do dono para a tela do fornecedor (login externo):

- **Books**, primeira opção de "Meus books" (`/app/booking`, `nav.partnerBooks`):
  os books da empresa dele (responsável ou, sem responsável, o fornecedor),
  com o botão **Importar book** acima da tabela. É a mesma tela que a Trading,
  a Factory, o Supplier e o GP já tinham (`PartnerBookingList`,
  `src/lib/services/booking-partner.ts`), semelhante ao Book da Wellmix, mas
  só com os books dele e **sem a Seleção de itens** (atividade só interna).
  O Fornecedor passou a vir com a tela Booking de fábrica
  (`PROFILE_EXTRA["role:supplier"]`, `src/lib/partner-access.ts`); o
  administrador ainda pode tirá-la na Gestão de telas. Perfil do Fornecedor
  já gravado pelo administrador depois das telas extras (`extrasDecided`)
  continua como ele marcou.
- **Solicitações do cliente** (`/app/supplier-requests`,
  `nav.customerRequests`): os **Convites de book** e as **Solicitações ao
  fornecedor** numa tela e numa tabela só, com a coluna **Tipo** ("Convite de
  book" ou "Solicitação"). O convite em aberto fica em "Em negociação" (com o
  item e o prazo); o respondido e o cancelado, em "Encerradas". O item
  "Convites de book" saiu do menu do fornecedor; o endereço antigo
  (`/app/supplier-requests/invites`) continua abrindo e acende "Solicitações
  do cliente", e o convite volta para ela.
- A Wellmix não muda: segue com a Cotação unificada (docs/QUOTATION.md), com
  os convites na aba própria.
- Fotos na conferência (dono, 23/11/2026): o book que o fornecedor importa
  já mostra a foto (e o cartão do fabricante) de cada item na tabela de
  conferência, antes de "Enviar para Wellmix Conferir", na coluna Foto presa
  na rolagem, como na tabela depois do envio. A importação já gravava as
  fotos; só a tabela de conferência não tinha a coluna.
