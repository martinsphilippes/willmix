# Booking: as planilhas de fornecedor

Tela **Pedidos → Booking** (`/app/booking`), só da Wellmix. Cada **booking** é a planilha que um fornecedor mandou (status, origem, fornecedor, data e os itens). Os itens são comparados na **Seleção de itens** e o escolhido vira uma **solicitação ao fornecedor** (docs/SUPPLIER_REQUESTS.md); só depois de aprovada com o fornecedor o produto é criado ou associado.

O nome "booking" também existe na etapa de embarque (reserva no navio, `import_steps`). São coisas diferentes: esta tela é a lista das planilhas de fornecedor; a reserva do navio continua onde está.

## Nome na tela: Book (dono, 13/11/2026)

Decisão do dono: esta etapa chama-se **Book** em todas as telas ("todas as palavras que sejam da responsabilidade desta etapa"), nos três idiomas. Confirmado por ele para o chinês: "Book em tudo, menos na área de marítimo/navio".

1. **O que mudou**: só o texto. Onde a tela dizia Booking (ou booking, bookings) passou a dizer Book (book, books): menu, lista, importar, lançar, dados do book, fechar, NCM dos books, convites de book, Seleção de itens, solicitação ao fornecedor ("Preço do book", "MOQ do book", "Condições iniciais (book)"), amostragem, Control Tower, pendências, avisos e as mensagens novas do histórico. No chinês, as palavras 订舱, 订舱表, 订舱单, 预订 e 预订单 que nomeavam esta etapa também viraram "Book" (订舱 quer dizer reserva de navio).
2. **O que não mudou**: a reserva de praça no navio, no embarque, continua **booking** (`importFlow.step.booking`, `importFlow.ph.booking`, `containers.codeHint`, `board.card.ordBooking`). Também não mudam os nomes internos, que não aparecem na tela: endereços (`/app/booking/...`), chaves do dicionário (`bookingLots.*`), tabelas (`booking_lots`, `booking_items`, `booking_invites`), a tela `booking` das permissões e os arquivos. Nenhum dado foi alterado: avisos e histórico já gravados continuam com o texto de quando nasceram.
3. **Regra para textos novos**: escreva Book. O teste `tests/unit/book-wording.test.ts` falha se um texto de tela disser Booking fora da lista do navio, ou se inglês e chinês não usarem a mesma palavra.

Este documento e o código continuam dizendo "booking" como nome interno; na tela, leia Book.

**Booking antigo removido (decisão do dono, 11/11/2026).** A fila antiga de produtos (tabela `bookings`, uma linha por produto, etapas Novo → Em análise → Aprovado → Oferecido → Reservado → Virou solicitação → Descartado, "Gerar solicitação" e o envio automático da RFQ ao fornecedor do produto) saiu inteira: telas `/app/booking/products` e `/app/booking/[id]`, a opção "Mandar para o Booking" da importação da ficha técnica, o "Gravar no Booking" da antiga tela de viabilidade, o bloco do Booking na Control Tower e o preço desejado na cotação. A tabela saiu do esquema (`src/lib/db/schema.ts`); o fluxo que vale é o desta página.

Onde está cada parte:

| Parte                                               | Arquivo                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Regras puras (status, colunas, busca e ordenação)   | `src/lib/booking-lots.ts`                                                               |
| Serviço (importar, editar, fechar, status)          | `src/lib/services/booking-lots.ts`                                                      |
| NCM do item                                         | `src/lib/services/booking-ncm.ts`, `src/lib/ncm-match.ts`                               |
| Previsão de preço dos itens (API do Sankhya)        | `src/lib/booking-forecast.ts`, `src/lib/services/booking-price-forecast.ts`             |
| Vitrine (produto de solicitação ainda não liberado) | `src/lib/services/booking-visibility.ts`                                                |
| Ações                                               | `src/app/app/actions/booking-lots.ts`, `actions/booking-ncm.ts`                         |
| Telas                                               | `src/app/app/booking/`, `src/app/app/ncm-items/`                                        |
| Textos                                              | `src/i18n/modules/booking-lots.ts`, `booking-ncm.ts`, `booking.ts`, `booking-screen.ts` |

## 0. Booking por planilha (decisão do dono, 10/11/2026)

A tela **Booking** (`/app/booking`) é a lista dos **bookings**: cada booking é a planilha que um fornecedor mandou, com status, origem, fornecedor e data, e uma lista de itens.

**Os itens do booking não são produtos.** Nada entra no cadastro de produtos nem no Sankhya ao subir ou fechar um booking. Na **Seleção de itens** (`/app/booking/selection`, docs/SUPPLIER_REQUESTS.md) a Wellmix compara itens parecidos de vários bookings e abre a **solicitação ao fornecedor** do escolhido; só depois de aprovada com o fornecedor o produto é criado ou associado e os itens iguais são ligados a ele (`booking_items.productId`, vazio até lá). O botão da tela principal leva à Seleção de itens.

Decisões:

1. **Status do booking**: Rascunho → Fechado (importação concluída, previsão de preço pedida) → Em andamento → Concluído; e Cancelado. Só o rascunho é editável. À mão: Rascunho → Cancelado; Fechado → Em andamento, Concluído ou Cancelado; Em andamento → Fechado, Concluído ou Cancelado; Concluído → Em andamento; Cancelado → Rascunho (`bookingLotMoves`, `src/lib/booking-lots.ts`).
2. **Origem** é a cidade do fornecedor (`parties.city`). Sem fornecedor no booking, vale a cidade da planilha (coluna LOCAL).
3. **Um fornecedor por booking**, estimado pela planilha (o nome mais frequente na coluna SUPPLIER NAME) e ajustado pelo usuário. A planilha casa com o cadastro pelo nome (sem pontuação nem "Co., Ltd."), senão pelo telefone (8 últimos dígitos), senão, só quando a planilha não traz nome, pelo nº da loja (`matchSheetSupplier`). Sem correspondência, o detalhamento sugere cadastrar o fornecedor com nome, nº da loja, telefone e cidade da planilha (Cadastros → Fornecedores, sem login).
4. **Data** do booking: a da coluna DATE (a mais frequente), ajustável. A data como veio fica guardada para conferência (`sheetDate`).
5. **Colunas**. Lidas com campo próprio: product number list, SKU/factory item code, description, FOB/EXW\*, coin US$/RMB\* (também "RMB/USD", "USD / RMB": cabeçalho só com nomes de moeda é a coluna da moeda, 16/11/2026), price\*, qty/box\*, qty/inner (opcional desde 16/11/2026), N.W./pc\*, G.W./pc\*, CBM\*, size (cm) length\*, width\* e height\*, capacity (ml)\*, package\*, material\*, MOQ\* (\* = obrigatório para fechar, `BOOKING_ITEM_REQUIRED`). Informativas: color assortment, function/battery/110/220, purchase schedule, departure interval in days, purchase qty in pcs, TT PCS, foto e supplier business card. **Qualquer outra coluna** fica guardada no item (`extras`, cabeçalho → valor) e não aparece na tela; os nomes dessas colunas ficam em `booking_lots.extraHeaders`. Linhas seguidas iguais com só a cor diferente continuam sendo um item só.
6. **Fechar** confere fornecedor, data e os campos obrigatórios de todos os itens e pede a **previsão de preço de todos os itens** à API de preço do Sankhya (seção "Previsão de preço do item", abaixo), gravando o retrato em `booking_items.analysis` (`BookingAnalysis`). Num booking fechado, "Refazer a previsão" pede de novo (câmbio ou ficha mudaram).
   - **Lista de pendências** (dono, 14/11/2026): quando o fechamento para por campos obrigatórios vazios, o aviso lista os itens incompletos, na ordem da tabela, identificados pelo nome e pelo código (sem nome, a descrição; sem código, o nº do item; sem nenhum, a linha), e embaixo de cada um todos os campos que faltam, com os nomes das colunas da tabela. A lista sai de `bookingLotPending`, a mesma validação que trava o fechamento e que monta o "Falta para fechar": a contagem é a mesma, e nenhuma exigência nova entra (`incompleteBookingItems`, `src/lib/booking-lots.ts`). Tocar num campo (`src/components/booking-pending-list.tsx`) leva até ele: a tabela mostra a linha (limpa a busca que a esconde e vai à página dela), a tela rola até o campo, que recebe o foco, e a célula fica destacada por alguns segundos. Nada é recarregado, então o que já foi digitado continua. Cada campo grava sozinho ao sair dele e a tela se atualiza, com a lista junto; sem pendências, o aviso diz para clicar de novo em "Fechar e analisar", que segue o fluxo normal.

Telas:

- **`/app/booking`**: tabela dos bookings (nº, status, origem, fornecedor, data, planilha, itens, incompletos, sinais da previsão de preço, responsável, carregado em). Os sinais da previsão, a coluna da previsão na grade do booking e o cartão "Refazer a previsão" só aparecem com "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7). Clicar no cabeçalho ordena (de novo inverte); a busca filtra por qualquer campo enquanto se digita. Tudo no navegador (`searchBookingLots`, `sortBookingLots`). Botão **Importar booking**.
- **`/app/booking/import`**: arquivo (.xlsx/.xls, até 80 itens, subido direto ao armazenamento quando grande) ou link do Google Sheets, e a moeda dos preços sem moeda (só completa a linha sem moeda na coluna nem no cabeçalho do preço; nunca troca a moeda que veio no arquivo). Usa o mesmo leitor da ficha técnica (`parseProductSheet`); os erros de leitura têm os mesmos textos.
- **`/app/booking/lots/[id]`**: dados do booking (fornecedor e data gravam sozinhos no rascunho), sugestão de cadastro do fornecedor, fechar, status, observação e a tabela dos itens com todos os campos (no rascunho, cada campo grava sozinho ao sair dele; obrigatório vazio fica destacado), a conferência do que falta e a previsão de preço (sinal, venda prevista, com frete, lucro, meta e o que faltou).
- **Ligações do item** (fase 4b, docs/MILESTONES.md "Ligações entre book, seleção, produto e pedido"): na tabela dos itens do book, a coluna "Ligações" leva à seleção, às solicitações ao fornecedor, ao produto e aos pedidos de cada item (só a Wellmix, só as telas que o login abre).

Onde está: regras puras em `src/lib/booking-lots.ts`; serviço em `src/lib/services/booking-lots.ts`; previsão de preço dos itens em `src/lib/services/booking-price-forecast.ts`; ações em `src/app/app/actions/booking-lots.ts`; campos que gravam sozinhos em `src/components/booking-lot-fields.tsx`; textos em `src/i18n/modules/booking-lots.ts`; testes em `tests/unit/booking-lots.test.ts` e, de ponta a ponta com a seleção e a solicitação ao fornecedor, em `tests/e2e/booking-supplier-request.spec.ts`.

Banco: tabelas `booking_lots` e `booking_items` (docs/APPWRITE.md). Antes da publicação (`npm run appwrite:push`), a lista avisa "esquema desatualizado" e não oferece a importação.

Permissões: importar, editar, fechar, analisar e selecionar são só da Wellmix com a tela Booking. Cadastrar o fornecedor sugerido também é dessa tela. Cliente, fornecedor e parceiros não veem bookings, itens, fotos nem a planilha guardada (documentos internos). Única exceção: o login externo com a tela Booking no perfil (de fábrica, só a Trading) lança e lê os bookings da própria empresa, sem a análise ("Booking do Trading", abaixo).

### Dinâmica dos books (dono, 23/11/2026)

Sete pedidos do dono, dos dois lados (fornecedor e Wellmix). Regras puras em `src/lib/booking-locks.ts`; serviços em `src/lib/services/booking-lots.ts` e `booking-partner.ts`; textos em `src/i18n/modules/book-work.ts`; testes em `tests/unit/booking-work.test.ts` e `tests/e2e/book-work.spec.ts`.

1. **Nº da loja, nome do supplier e Tipo de item.** Quem importa informa os três, na Wellmix e no parceiro: `booking_lots.storeNumber` e `booking_lots.supplierName` são campos abertos, só informativos (não mudam o fornecedor do book, `supplierId`), e `booking_lots.itemType` é texto obrigatório, com os tipos já usados como sugestão (o parceiro só vê os dos books dele). A Wellmix ajusta os três na caixa "Dados do book" (e completa nos books antigos), em qualquer situação menos Cancelado (`setBookingLotMeta`, auditoria `booking_lot.meta`). Aparecem na lista de Books e a **Seleção de itens busca por eles** (loja, supplier e tipo de item do book de cada item). Correção do dono (24/11/2026): a primeira versão tinha uma escolha "Loja ou Fábrica" (`sourceKind`); a coluna ficou no esquema, sem uso.
   - **FOB ou EXW** (dono, 24/11/2026): na importação, na Wellmix e no parceiro, quem importa escolhe FOB ou EXW (obrigatório). A escolha fica no book (`booking_lots.incoterm`) e **vale para todos os itens**, seja qual for o que a planilha trazia (`booking_items.incoterm`). Com EXW abre o campo **Valor do EXW** (obrigatório, acima de zero, na moeda dos preços do book), gravado em `booking_lots.exwValue`. No rascunho a Wellmix troca os dois em "Dados do book" (os itens acompanham); depois de fechado, só consulta. A coluna FOB/EXW de cada item continua editável na tabela, como antes. O valor do EXW é informativo: a previsão de preço não o usa (o Incoterm vai com o item).
2. **Colunas da importação e várias planilhas.** As tabelas de conferência (a do parceiro em preenchimento e a da Wellmix) não têm mais Nome, Nº do item, Programação de compra, Intervalo de saída, Qtd de compra e Peças planejadas (TT PCS); as duas do meio saíram em 24/11/2026, por confirmação do dono. O que a planilha trouxer nesses campos continua gravado no item (a Seleção de itens e a solicitação ao fornecedor usam o nome); a tabela de consulta do parceiro, depois de enviado, não mudou. O campo de arquivo aceita **várias planilhas** (até 10, `BOOKING_SHEETS_MAX`): o book é a soma delas, na ordem escolhida, e os itens de cada uma entram depois dos da anterior. Todas são lidas antes de gravar (uma que não abre não deixa book pela metade). `booking_lots.sheetFiles` guarda cada planilha (nome, arquivo e quantos itens); `fileName` junta os nomes com " + ". Juntas acima do teto da requisição, sobem direto ao armazenamento (um `uploadedFileId` por arquivo).
3. **A linha de cima preenche todas.** No preenchimento em massa, sem nenhuma linha marcada o valor digitado acima da coluna vai para **todas** as linhas à vista; com linhas marcadas, só para elas (como antes). **Enter** no campo de cima carrega, como o botão. Antes, sem linha marcada o "Carregar" ficava desligado, e por isso a linha de cima "não funcionava".
4. **Seta para baixo e para cima.** Num campo da tabela de itens, a seta leva o foco ao campo da mesma coluna na linha de baixo ou de cima (o que foi digitado grava ao sair, como sempre). Da linha de preenchimento em massa, para baixo cai na primeira linha. As listas (FOB/EXW, moeda) ficam com as setas delas. Vale nas duas telas (`arrowKeys`, `src/components/booking-bulk-fill.tsx`).
5. **Itens trabalhados.** O item fica marcado no book de origem (`booking_items.workedAt`, `workedByUserId`) quando entra numa escolha de grupo gravada na Seleção de itens (todos os itens do grupo comparado) ou numa solicitação ao fornecedor (o escolhido e as alternativas); `markItemsWorked`. A marca não sai. A lista de Books mostra o percentual e "x de y" em cada book, na Wellmix e para o fornecedor que publicou; dentro do book, a coluna "Seleção" ("Trabalhado" ou "A trabalhar") e a linha do item trabalhado em verde claro. O fornecedor vê só o fato, sem a análise.
6. **Seleção direto do book.** Na tela do book da Wellmix, "Selecionar os marcados" leva os itens marcados (um ou vários, até 60) para a Seleção de itens como um grupo para comparar (`/app/booking/selection?tab=selection&ids=…`).
7. **Travar books.** Tabela `booking_locks`. O analista trava um book (na linha dele ou na caixa "Com quem está" do book) ou todos os de um tipo de item (faixa "Travar books" acima da lista; vale também para os books do tipo que chegarem depois; o tipo é comparado sem acento nem maiúsculas). A trava do book vale mais que a do tipo.
   - **Quem vê o quê** (`visibleLots`): o analista com algum book travado vê só os dele; os outros analistas veem os que ninguém travou (o travado por outro some da lista, o endereço direto responde "não encontrado" e os itens saem da Seleção de itens dele).
   - **Supervisão**: o administrador e quem tem a ação **"Supervisionar os books"** (`booking.supervise`; de fábrica, a Diretoria de compras; o administrador libera para o cargo de gerente de compras em Funções e acessos) veem todos os books, com quem está cada um, há quanto tempo e o selo do prazo, e liberam a trava de qualquer pessoa.
   - **Prazo**: 3 horas por book (`bookingLockSlaHours`, Configurações), contadas de quando a pessoa travou (no book que chegou depois de o tipo ser travado, da chegada). Passou, o selo fica "Atrasado".
   - **Liberar**: quem travou ou quem supervisiona. Nada libera sozinho. Auditoria: `booking_lock.lock` e `booking_lock.unlock`.
   - A trava organiza o trabalho (o que cada um vê); as gravações continuam conferidas pela tela Booking, como antes.

Decisões do dono (24/11/2026): a supervisão fica com a Diretoria de compras de fábrica; o Tipo de item continua texto aberto, editável pela Wellmix; a marcação dos itens de books antigos com escolha gravada ou solicitação foi autorizada, mas não havia nenhum em produção (2 books, 46 itens, nenhuma escolha gravada; as 2 solicitações existentes não apontam para itens desses books): nada foi alterado. Em aberto: se fechar ou concluir o book deve liberar a trava sozinho; aviso (pendência) para o analista com book atrasado.

### Card "Planilha do book" (dono, 24/11/2026)

Só a apresentação do card da Wellmix em Importar book (`/app/booking/import`). Os campos, os nomes enviados, as validações e a ação `importBookingAction` são os mesmos.

O layout segue o desenho do dono.

- **Moeda padrão.** É o rótulo novo do seletor de moeda.
  - Tem um ⓘ ao lado (`InfoTip`, fora do `<label>` para o toque não abrir o seletor) que mostra "Aplicada apenas aos preços sem moeda na coluna ou no cabeçalho.".
  - Abaixo da linha vem "Moeda padrão: aplicada apenas aos preços sem moeda na coluna ou no cabeçalho.".
  - As opções, o USD já marcado e a regra continuam iguais: a moeda vale só para o preço sem moeda na linha nem no cabeçalho, sem conversão.
- **FOB ou EXW numa linha própria.** O campo obrigatório do #674, que entrou depois do desenho, fica entre o link do Google Sheets e a linha do desenho.
  - O seletor tem 120 px e, com EXW, o "Valor do EXW" (130 px) aparece ao lado. As duas dicas ficam abaixo.
  - É o `BookIncotermFields` com `compact`. O lançamento do parceiro e a tela do book seguem com o formato de sempre.
  - A posição aguarda a confirmação do dono.
- **Uma linha.** Moeda padrão | Nº da loja | Nome do supplier | Tipo de item ficam numa linha. Moeda e loja são estreitas (112 e 124 px; 110 e 110 px em card mais estreito), e supplier e tipo dividem o resto até a borda.
  - A troca de layout segue a largura do card (`@container`), não a da tela.
  - A partir de 470 px de card, a linha é única. Ela cabe no computador e no iPad deitado, inclusive no iPad de 1080 px.
  - A partir de 590 px, a dica da moeda fica sob as três primeiras colunas e a do tipo sob o próprio campo.
  - Mais estreito, as duas dicas ficam abaixo da linha, a do tipo com o prefixo "Tipo de item:".
  - No celular ficam duas linhas, com a moeda sempre compacta.
  - As dicas ficam ligadas aos campos por `aria-describedby`.
- **Padrão minimalista.**
  - Título de 20 px, rótulos de 13 px e textos auxiliares de 12 px em cinza escuro.
  - Campos de 36 px (40 px em tela de toque, `pointer-coarse`) e cantos de 10 px.
  - Card com cantos de 22 px e espaçamento interno de 20 px (24 px a partir de 1280 px).
  - "Escolher arquivos" compacto, com 32 px e letra média; "Importar book" com 36 px; os dois na largura do texto.
  - Nos aparelhos da Apple os campos seguem com 16 px, pela regra global que evita o zoom do Safari.
- **Textos do desenho.** "Ou link do Google Sheets" e as dicas do arquivo, do link e do tipo de item usam chaves novas, só deste card (`bookingLots.import.*Compact`). Mantêm os formatos e limites, as várias planilhas num book só, o compartilhamento, as fotos e a regra "se houver arquivo e link, será usado o arquivo". A ordem das planilhas continua a de escolha, mesmo sem o texto dizer.
- **Só este formulário.** As peças compartilhadas ganharam opções que só este card usa: `BookMetaFields` com `layout="inline"` e `SheetFileInput` com `className`. O lançamento do parceiro, a tela do book e o convite de book continuam como estavam, sem estilo global novo.

Teste: `tests/e2e/book-import-card.spec.ts` confere:
- os rótulos, a dica e o ⓘ;
- a linha única a 1440 px, com supplier e tipo iguais até a borda e a dica do tipo sob o campo;
- a linha única a 1080 px;
- as duas linhas a 390 px;
- que nenhuma tela rola para o lado;
- que, com RMB escolhido e uma planilha sem moeda, o item fica em RMB.

### Responsável pelo booking (decisão do dono, 11/11/2026)

- Cada booking tem um **parceiro responsável** (`booking_lots.partnerId`): o fornecedor dos itens ou outro parceiro (Trading, Factory, Supplier, GP ou tipo criado no painel), ativo.
- **Toda solicitação** aberta de um item do booking vai para ele (aviso, tela e resposta), e o pedido de compra gerado dessas solicitações sai em nome dele. Vazio (e nos bookings antigos): vale o fornecedor do booking.
- **Pedido e contrato** (decisão do dono, 11/11/2026): o pedido sai em nome do responsável (ex.: a trading), mas o contrato traz a **fábrica** que executa a produção, o fornecedor do booking (`OrderDocument.manufacturers`, também na planilha do pedido). Na Produção, ao marcar "trade", a fábrica do booking entra sozinha (`bookingFactory`).
- Muda na tela do booking, campo "Responsável pelo booking", em qualquer situação menos cancelado; as solicitações já abertas ficam com quem as recebeu. Auditoria: `booking_lot.partner`.
- Quem é: a Wellmix com a tela Booking (`setBookingLotPartner`); o parceiro tem de ser de um dos tipos acima (`booking_partner_invalid`).

### Booking do Trading (decisão do dono, 11 e 12/11/2026)

Pedidos do dono: os logins de Trading têm de ver a tela Booking, **só com os bookings da empresa dele**; têm de poder **lançar o booking** que a Trading faz; ao lançar, os campos ficam **abertos e já preenchidos** para ele conferir, e só então ele aperta **"Enviar para Wellmix Conferir"**; e os tipos **Factory, GP e Supplier** recebem o mesmo Booking.

- **Quem abre**: o login cujo perfil tem a tela Booking. De fábrica, os quatro tipos em destaque de Outros parceiros: **Trading, Factory, Supplier e GP** (`type:trading`, `type:factory`, `type:supplier_partner`, `type:gp`). Para o Fornecedor ou um tipo criado no painel, o administrador libera em Gestão de telas (docs/PARTNER_ACCESS.md).
- **Lançar, passo 1 (carregar)**: botão "Lançar booking" na lista dele → sobe a planilha (.xlsx ou .xls, as mesmas colunas de sempre, até 80 itens; só arquivo, sem link) e escolhe a moeda dos preços sem moeda. Nasce o booking **em preenchimento** (`status: "preparing"`), com a empresa dele como **responsável** (`partnerId`), sem dono interno (`ownerUserId` vazio), sem número e criado pelo login dele. O fornecedor (a fábrica) é o que vier na planilha, pela regra de sempre.
- **Passo 2 (conferir)**: a tela do booking mostra **todos os campos da planilha**, um por coluna, abertos e já preenchidos (nome, nº do item, código, descrição, FOB/EXW, moeda, preço, MOQ, caixa, inner, CBM, medidas, capacidade, pesos, material, embalagem, cores, função, programação, intervalo, quantidades). Cada campo grava ao sair dele, com o aviso na célula, pelas mesmas regras da tela da Wellmix (`readBookingItemValue`). Os campos com * (o que a Wellmix exige para fechar) em branco ficam destacados em amarelo e são contados; não impedem o envio (pede confirmação).
- **Passo 3 (enviar)**: botão **"Enviar para Wellmix Conferir"**, em cima e embaixo da tabela. O booking ganha o **número** (da mesma sequência dos bookings da Wellmix, sem buracos), vira **rascunho**, passa pela aproximação de NCM e quem da Wellmix abre o Booking recebe o aviso "Booking nº N lançado por um parceiro", com o link. Dali em diante segue como qualquer outro (conferir, NCM, fechar, previsão de preço, Seleção de itens) e ele só consulta.
- **Antes do envio a Wellmix não vê o booking**: fica fora da lista, da tela do booking (o endereço responde "não encontrado"), da Seleção de itens, da fila de NCM do despachante, dos convites e do painel; ninguém é avisado. As rotinas da Wellmix recusam um booking em preenchimento.
- **Descartar**: enquanto não enviou, ele pode descartar (planilha errada). Somem o booking, os itens e os arquivos que aquele lançamento criou; nada chegou à Wellmix. Auditoria: `booking_lot.partner_discard`.
- **Quem pode lançar**: login externo com a tela, de um cadastro **ativo** de um tipo que responde por booking (fornecedor, Trading, Factory, Supplier, GP ou tipo criado no painel). Cliente, agência e os demais, mesmo com a tela liberada, só consultam (e a lista vem vazia).
- **O que vê**: os bookings pelos quais a empresa dele **responde**: aqueles em que ela é o responsável (`booking_lots.partnerId`) ou, quando o booking não tem responsável, o fornecedor (`supplierId`). É a mesma regra de para quem vão as solicitações (`bookingRecipientId`). Na lista, os não enviados vêm primeiro, com o aviso de que falta enviar.
- **O que não vê**: bookings de outras empresas (o endereço direto responde "não encontrado", sem dizer se existe); o booking de uma trading não aparece para a fábrica citada na planilha dela (o preço é o da trading); a análise da Wellmix (previsão de preço, venda prevista, lucro, margem); o NCM; o produto do cadastro ligado ao item; as colunas extras da planilha; a observação interna; o nome do fornecedor e de quem importou; a planilha guardada (documento interno, regra de sempre). As fotos dos itens e os cartões do fabricante dos books da empresa dele aparecem na tabela de consulta, também os que a Wellmix carregou por ele (abaixo).
- **Situação, nas palavras dele**: em preenchimento, "Em preenchimento: falta enviar"; rascunho, "Em conferência na Wellmix"; fechado, "Conferido pela Wellmix"; as outras, como na Wellmix.
- **Depois de enviado**: corrigir, fechar ou cancelar é da Wellmix (ele fala com a Wellmix). Seleção de itens e convite para booking concorrente continuam só da Wellmix (abertos por um login externo, voltam para a lista dele).
- **Tabela de consulta, depois de enviado** (dono, 16/11/2026; "Itens do book" em Meus books → Book): uma tabela, uma linha por item e **um dado por coluna**, nesta ordem: Nº da linha, Foto, Nome do item, SKU / Código da fábrica, Nº do item (campo próprio da planilha, nem o nº da linha nem o SKU), Valor, Moeda, FOB/EXW, MOQ, Peças por caixa master, Peças por caixa inner, CBM, Comprimento, Largura e Altura (cm), Capacidade (ml), Tamanho, Cor(es), Material e Embalagem; depois, os outros campos que ele preencheu (descrição, pesos, energia, programação de compra, intervalo de saída e quantidades), para nada da ficha se perder. Cada célula vem do seu campo do registro, sem separar texto: "4 USD EXW" eram três campos juntados só na tela (`price`, `currency`, `incoterm`); "24 / 12" eram a caixa master e a inner (`masterCartonQty`, `innerQty`); "A4" é o tamanho (`sizeText`), e a capacidade mostra só os mililitros (`capacityMl`). Sem dado: "—". Conferido em produção (155 itens, 16/11/2026): a inner nunca é maior que a master; todo preço tem moeda e Incoterm; o tamanho em texto ("A4", "4X6 / 10 X 15") está sempre em `sizeText`; o Nº do item nunca repete o SKU. Achado: 20 porta-retratos têm 0,5 em `capacityMl` junto do tamanho (provável erro da planilha). Regra do dono (16/11/2026): item com tamanho em texto **e** mililitros ao mesmo tempo mostra a capacidade **do cadastro do produto** ligado ao item (ficha mestre, `purchase_sheets` com `orderId` = id do produto); sem produto ligado ou com o campo em branco no cadastro, "—". O registro do book não muda (`capacityMlShown` é só leitura). Os demais itens mostram os mililitros do book. Em produção, dos 20: 15 sem produto ligado ("—") e 5 GRECIE (SKU MY-060A) cujo cadastro também tem 0,5 ml (copiado do book; corrigir no cadastro, se for o caso).
  - **Cabeçalho fixo** logo abaixo da barra do Portal enquanto a página rola, até o fim da tabela; as colunas que não cabem **rolam de lado dentro da tabela**, com os títulos acompanhando (as mesmas larguras de coluna no título e na célula); **Nº da linha e Foto ficam congelados** na rolagem lateral, com uma sombra leve à direita da foto. É o mesmo mecanismo das tabelas do Book da Wellmix (`Table stickyHead`, seção abaixo), com a busca, a ordem pelo título e as páginas da tabela padrão. Divisórias verticais discretas; números alinhados à direita, com o título junto.
  - **Fotos** (dono, 16/11/2026: "o parceiro vê as fotos"): a foto do item e o cartão do fabricante de cada item dos books da empresa dele, também os do book que a Wellmix carregou por ele. O arquivo abre pela regra `partnerSeesBookingPhoto` (`src/lib/services/booking-partner.ts`, chamada por `canAccessDocument`): login externo com a tela Booking e book pelo qual a empresa dele responde (`bookingRecipientId`, a regra da tela). Outra empresa, a fábrica citada no book de uma trading e o login sem a tela continuam sem abrir.
  - A tabela de edição (em preenchimento) não mudou. Componentes: `SentItems` em `src/app/app/booking/_components/partner-booking.tsx` (com `Table stickyHead` e as classes de coluna congelada de `src/lib/booking-bulk-ui.ts`). A tabela usa bordas separadas (`border-separate border-spacing-0`, via `tableClassName`): com as bordas "coladas", o fundo da célula presa cobria a borda desenhada pela tabela e as divisórias sumiam em Nº e Foto. A coluna Foto tem 6,5 rem (cabem foto e cartão) e mostra a miniatura (`?thumb=1`); o clique abre o arquivo inteiro. Nome em branco: a descrição no lugar.
- **Vínculo feito pela Wellmix**: no campo "Responsável pelo booking" da tela do booking. O booking aparece para o parceiro assim que ele vira o responsável, em qualquer situação.
- **Travas**: até 20 bookings carregados pela mesma empresa em 24 horas (`booking_launch_limit`); a chave de arquivo enviada por um login externo tem de ser de um arquivo recém-subido, nunca a de um documento já registrado (vale também para a resposta ao convite).

Situação nova no ciclo do booking: `preparing` (antes de `draft`), só para o booking lançado pelo parceiro. Sem mudança no banco (a coluna é texto); `appwrite.config.json` foi gerado de novo.

Onde está: `src/lib/services/booking-partner.ts` (`launchPartnerBooking`, `setPartnerBookingItemField`, `sendPartnerBooking`, `discardPartnerBooking`, `canLaunchBooking` e as leituras; nunca lê bookings de outra empresa); `releasePreparingLot` e as travas do lado da Wellmix em `src/lib/services/booking-lots.ts` (`wellmixLot`), `booking-ncm.ts` e `booking-invites.ts`; ações em `src/app/app/actions/booking-lots.ts`; tela em `src/app/app/booking/_components/partner-booking.tsx` e campos em `src/components/partner-booking-fields.tsx`; regras puras em `src/lib/booking-lots.ts` (`bookingLotPreparing`, `bookingItemFieldKind`, `BOOKING_PARTNER_TYPES`, `bookingRecipientId`); regra das telas em `src/lib/partner-access.ts` (`ADAPTED`, `PROFILE_EXTRA`); testes em `tests/unit/booking-partner.test.ts` e `tests/e2e/partner-access.spec.ts`.

Fica para o dono decidir: a Wellmix devolver o booking para o parceiro corrigir; o parceiro baixar um modelo de planilha; ser avisado quando um booking passa a ser dele ou é conferido; lembrete para o booking carregado e não enviado; a Wellmix enxergar (sem mexer) os bookings ainda em preenchimento.

### Tabela dos itens: cabeçalho congelado e preenchimento em massa (dono, 16/11/2026)

Vale para todo login que abre o Book: a tela da Wellmix (`/app/booking/lots/[id]`) e a do parceiro em "Meus books → Book" (a Trading, a Factory, o Supplier e o GP que lançam o book deles).

- **Cabeçalho congelado**: os títulos das colunas e a linha de preenchimento ficam presos logo abaixo da barra vermelha enquanto a tabela passa; no fim da tabela saem junto com ela. Na rolagem para o lado, cada título e cada campo acompanham a coluna deles. A primeira coluna (a caixa, o número da linha e, no cabeçalho, "Carregar") fica presa à esquerda; na tela da Wellmix, a coluna das fotos também, logo depois dela (dono, 16/11/2026: ver qual é o item enquanto a tabela anda para o lado). Na tela da Wellmix, busca, ordem pelo título e páginas continuam como antes; na do parceiro continua sem elas. Também na tabela "Itens do book" do parceiro depois de enviado (só consulta).
  - Como: `TableTools` com `stickyHead` (`src/components/table-tools.tsx`). O `<thead>` vai para uma tabela própria, presa com `position: sticky` dentro do quadro da tabela. As duas tabelas usam o mesmo `<colgroup>`, com `table-layout: fixed`, e a rolagem lateral de uma move a outra. A largura de cada coluna sai da largura do campo dela (`colRem`, `src/lib/booking-bulk-ui.ts`). Um campo levado à vista (a lista de pendências, o foco) para abaixo do cabeçalho: `scroll-margin-top` com a altura dele, `--wm-table-head`.
- **Marcar linhas**: há uma caixa no início de cada linha. A caixa do cabeçalho, sem nenhuma linha marcada, marca todas as que a busca deixa à vista, em qualquer página; com alguma marcada, desmarca todas. A linha marcada fica destacada.
- **Preencher em massa**: logo abaixo dos títulos há um campo, inicialmente vazio, acima de cada coluna editável. O tipo e as opções são os da coluna: listas em FOB/EXW e Moeda, número nos números, texto no resto, e a capacidade aceita letras.
  - **"Carregar"** grava de uma vez os valores preenchidos nas linhas marcadas, numa coluna ou em várias. Cada valor troca o daquela coluna nas linhas marcadas. As linhas desmarcadas e as colunas com o campo vazio ficam como estão.
  - **Validação**: "Carregar" só liga com pelo menos uma linha marcada e todo campo preenchido válido. Um valor que a célula recusaria fica apontado ("Valor inválido"); um campo preenchido e válido fica verde.
  - **Depois de gravar**: o aviso diz quantos itens foram atualizados, os campos esvaziam e as linhas continuam marcadas. Na falha, o aviso diz quais linhas não gravaram e por quê ("linha 5 (Preço: …)") e oferece "Tentar de novo", que manda os mesmos valores só para elas.
  - **O que dá para preencher**: na tela da Wellmix, no rascunho, as colunas do item (preço e moeda só com "Ver preço de compra") e o NCM. Fechado ou em andamento, só o NCM; cancelado, nada (sem caixas nem campos). Na tela do parceiro, todas as colunas enquanto ele preenche, antes de enviar.
- **Regras**: as da célula, sem nada novo.
  - **Leitura do valor**: `bookingItemPatch` (`src/lib/booking-lots.ts`), a mesma leitura de `setBookingItemField` e `setPartnerBookingItemField`.
  - **Permissões**: a tela Booking, "Ver preço de compra", o rascunho e, no parceiro, o book dele antes de enviar.
  - **NCM**: o mesmo serviço da célula, `setBookingItemsNcm`, que refaz a análise do book fechado.
  - **Como grava**: cada item grava ou é recusado sozinho. Item de outro book fica de fora. A auditoria registra `booking_item.bulk`.
  - **Código**: as ações são `bulkSetBookingItemsAction` e `bulkSetPartnerBookingItemsAction` (`src/app/app/actions/booking-lots.ts`); os serviços, `setBookingItemsFields` e `setPartnerBookingItemsFields`. A tela fica em `src/components/booking-bulk-fill.tsx`.

### INNER opcional (dono, 16/11/2026)

- **INNER (qty/inner, peças por caixa inner)**: saiu de `BOOKING_ITEM_REQUIRED`. Sem asterisco e sem o destaque amarelo, na tela da Wellmix e na do parceiro; em branco não trava gravar o item, enviar o Book para a Wellmix conferir nem fechar, e não aparece em "Falta para fechar" nem na Conferência do item. Em branco fica sem valor (nulo, nunca zero), da planilha e da tela; preenchido, segue as regras de número (inteiro positivo). Na consulta, INNER sem valor aparece "—".

### Capacidade: mililitros ou tamanho (dono, 12/11/2026)

Achado do dono: a planilha de porta-retratos trazia a coluna de capacidade preenchida e a tela mostrava o campo vazio.

- **Causa**: a coluna "capacity" da planilha traz mililitros quando o produto tem volume ("350", "350 ml", "1,5 L") e um **tamanho** quando não tem ("8X10", "A4"). O leitor já separava: o número em `booking_items.capacityMl`, o texto em `booking_items.sizeText`. Só que nenhuma tela do booking mostrava o `sizeText`, e a coluna só aceitava número. O dado não se perdia; ficava escondido.
- **Agora** a coluna Capacidade ("ml ou tamanho") mostra os mililitros ou, sem eles, o tamanho, e **aceita letras**: número (com ou sem "ml"/"L") grava em `capacityMl`; qualquer outro texto grava em `sizeText`; vazio apaga. Vale na tela do parceiro em preenchimento (na consulta, depois de enviado, a capacidade em ml e o tamanho ganharam colunas separadas em 16/11/2026), na tela do booking da Wellmix, na Seleção de itens e na solicitação ao fornecedor (a cópia do item passou a levar o `sizeText`).
- **Para fechar o booking, o tamanho vale como capacidade** (`missingItemFields`): um porta-retrato não precisa de mililitros inventados.
- Os bookings já carregados não precisam ser enviados de novo: o tamanho já estava gravado e passa a aparecer.
- Regras em `src/lib/booking-lots.ts` (`parseCapacityMl`, `readBookingCapacity`, `bookingCapacityShown`); testes em `tests/unit/booking-capacity.test.ts` e `tests/unit/booking-partner.test.ts`. Sem mudança no banco.
- Em aberto: a ficha de compra do pedido e a ficha do produto continuam com a capacidade só em mililitros; o tamanho ainda não segue para elas.

### Previsão de preço do item (decisão do dono, 24/11/2026)

A conta própria do portal (o antigo Superplan: tela, parâmetros, tipos de negócio e a análise dos itens) saiu do sistema. O preço dos itens do book vem da **mesma API de preço da Nova solicitação** de encomenda e de reposição: a cotação V2 do Sankhya (`FN_AD_ENC_COTACAO_V2_WELL`, adaptador em `src/lib/integrations/price-forecast.ts`).

1. **Quando**: ao fechar o book, em "Refazer a previsão" (cartão "Previsão de preço" no detalhe do book) e ao trocar o NCM de um item de book fechado. Roda depois da resposta (`after()`), item a item e um de cada vez (o Sankhya recusa duas chamadas simultâneas da mesma sessão); a página do book tem até 300 s para isso.
2. **O que vai**: a ficha do item como a planilha trouxe, **com o NCM**: NCM, peso líquido e bruto por peça, peças por caixa, CBM da caixa, preço, moeda, Incoterm (o do item ou o do book) e a quantidade (purchase qty, senão TT PCS). **Nunca o CODPROD**: o item ainda não é produto, o Sankhya calcula pelo NCM. Sem cliente, vendedor, VIP nem frete de entrega (o Sankhya usa os padrões). Regra pura em `bookingItemForecastQuery` (`src/lib/booking-forecast.ts`).
3. **O que volta e fica no item** (`booking_items.analysis`, com `source: "price_forecast"`): venda prevista (`VENDA_IPI`), com frete (Wellmix e WD), custo por peça (`CUSTO_BASE_VENDA`), lucro, meta e o preço para a meta, a situação da cotação e o que foi enviado (`sent`). O sinal: **viável** quando o Sankhya diz que a meta foi atingida; **abaixo da meta** com lucro positivo; **prejuízo** com lucro zero ou negativo.
4. **Faltou dado ou Sankhya fora**: o item sem NCM, preço, moeda conhecida (RMB, US$ ou euro), peças por caixa ou CBM nem vai ao Sankhya e o retrato diz o que faltou; o Sankhya não configurado grava "nenhum preço é previsto"; um erro do Sankhya grava a mensagem dele. Nada é estimado no lugar.
5. **Quem vê**: só a Wellmix com "Ver preço de compra" (o custo sai do preço do fornecedor). O fornecedor e os parceiros nunca veem a previsão.
6. **Retratos antigos** (gravados pela conta do portal, sem `source`): não aparecem mais; a tela pede para refazer a previsão do book. O "melhor custo" da Seleção de itens e os sinais da lista contam só a previsão nova.
7. Mesma previsão na **negociação** (docs/SUPPLIER_REQUESTS.md, "Contraproposta com a previsão de preço"): a ficha negociada refaz a previsão com o preço e a moeda combinados, e a contraproposta pergunta pela rota `/api/price-forecast/booking-item` (venda prevista e custo; pela inversa, o preço máximo de compra).

Dados: nenhuma coluna nova (o retrato é o JSON de `booking_items.analysis`, que ganhou campos opcionais). `booking_lots.businessType` e a chave `superplan` das Configurações ficam no banco sem uso (evolução aditiva). Testes em `tests/unit/booking-forecast.test.ts`.

### NCM do item (decisão do dono, 11/11/2026)

O NCM é **obrigatório para fechar o booking** e vai com o item para a previsão de preço do Sankhya (que calcula os impostos pelo NCM).

1. **Aproximação com o cadastro**, na importação e de novo ao fechar, para os itens ainda sem NCM (`classifyBookingItems`, `src/lib/services/booking-ncm.ts`; regra em `src/lib/ncm-match.ts`).
   - O nome do item (descrição e nome) é comparado, palavra a palavra (sem números, medidas e palavras vazias), com os produtos do cadastro que têm NCM (o do produto; sem ele, o da ficha mestre).
   - Cada produto é reconhecido pelo próprio nome e pelas descrições dos itens de booking já ligados a ele. Assim o produto com nome em português aprende o nome em inglês da planilha.
   - Código de fábrica igual (do produto, dos fornecedores dele ou dos itens ligados) vale como certo.
   - Semelhança mínima de 50% (`NCM_MATCH_MIN`). Vale o NCM do produto mais provável; com vários igualmente prováveis, a **moda** entre eles; empate na moda conta como sem correspondência.
   - O item guarda a origem ("Aproximação" com a %), os produtos que deram o NCM (`ncmMatchProductIds`) e a semelhança (`ncmScore`).
2. **Sem correspondência: o despachante.** O item é marcado (`ncmRequestedAt`) e os despachantes com login recebem um aviso.
   - Na tela **NCM dos bookings** (`/app/ncm-items`, menu do despachante e Pendências, um item por grupo), os itens ficam agrupados pelos parecidos (as duas palavras principais do nome, `ncmGroupKey`).
   - O despachante marca os itens do grupo, informa o NCM e aplica a todos de uma vez.
   - Ele vê só o produto: descrição, código, material, embalagem, capacidade, medidas, cores e função. Nunca o fornecedor nem o preço.
   - O detalhe do booking avisa quantos itens estão com o despachante, com o link para a tela. Sem despachante com login, o aviso pede que a Wellmix preencha.
   - **Estimar o NCM de novo** (botão no detalhe do booking, enquanto houver item sem NCM; `reclassifyBookingLot`): refaz a aproximação, para o booking importado antes de o cadastro ter os produtos (ex.: antes da carga do Sankhya). Os candidatos são lidos sem o teto padrão de 10 mil linhas.
   - **Sugestões** (11/11/2026, `suggestNcms` em `src/lib/ncm-match.ts`): sem certeza, cada item sem NCM mostra até 3 NCMs prováveis para a Wellmix escolher com um clique (nada é gravado sozinho). O mais bem qualificado (o primeiro da ordem abaixo) vem em destaque como **Recomendado**, com o botão "Preencher com o recomendado"; os demais ficam como "Outras opções" (12/11/2026). A planilha vem em inglês e o cadastro do Sankhya em português: cada palavra do item vale também pela tradução de um glossário (`EN_PT`). A nota é a parte das palavras do item que aparecem no nome do produto (mínimo 50%); código de fábrica igual vale 100%; empate desfeito pelo material da planilha e depois pelo número de produtos. Descrições que só dizem a estampa ("GRECIE", "WD STRIBY VERT") podem não ter sugestão: o despachante ou a Wellmix preenche.
3. **A Wellmix também preenche**, na coluna NCM da tabela de itens. A coluna grava sozinha e continua **editável depois de fechado** (menos no Cancelado). Ao trocar o NCM de um item de booking fechado, a previsão de preço daquele item é pedida de novo. Apagar o NCM só no rascunho.
4. Com a tabela fiscal carregada, o NCM tem de estar nela (`booking_ncm_not_in_table`).
5. **Tabela fiscal carregada depois**: não refaz mais nada nos books. Desde 24/11/2026 os impostos da previsão são do Sankhya, pelo NCM; a análise refeita pela tabela fiscal (`reanalyzeLotsForFiscalTable`) saiu junto com a conta antiga do portal.
6. O produto criado na solicitação ao fornecedor aprovada **herda o NCM** do item escolhido (cadastro e ficha mestre; docs/SUPPLIER_REQUESTS.md).

Origem do NCM (`ncmSource`): `match` (aproximação), `broker` (despachante) ou `manual` (Wellmix). Tudo fica na auditoria (`booking_item.ncm`). Testes em `tests/unit/booking-ncm.test.ts`.
