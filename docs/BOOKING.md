# Booking: as planilhas de fornecedor

Tela **Pedidos → Booking** (`/app/booking`), só da Wellmix. Cada **booking** é a planilha que um fornecedor mandou (status, origem, fornecedor, data e os itens). Os itens são comparados na **Seleção de itens** e o escolhido vira uma **solicitação ao fornecedor** (docs/SUPPLIER_REQUESTS.md); só depois de aprovada com o fornecedor o produto é criado ou associado.

O nome "booking" também existe na etapa de embarque (reserva no navio, `import_steps`). São coisas diferentes: esta tela é a lista das planilhas de fornecedor; a reserva do navio continua onde está.

## Nome na tela: Book (dono, 13/11/2026)

Decisão do dono: esta etapa chama-se **Book** em todas as telas ("todas as palavras que sejam da responsabilidade desta etapa"), nos três idiomas. Confirmado por ele para o chinês: "Book em tudo, menos na área de marítimo/navio".

1. **O que mudou**: só o texto. Onde a tela dizia Booking (ou booking, bookings) passou a dizer Book (book, books): menu, lista, importar, lançar, dados do book, fechar, NCM dos books, convites de book, Seleção de itens, solicitação ao fornecedor ("Preço do book", "MOQ do book", "Condições iniciais (book)"), amostragem, Control Tower, pendências, avisos e as mensagens novas do histórico. No chinês, as palavras 订舱, 订舱表, 订舱单, 预订 e 预订单 que nomeavam esta etapa também viraram "Book" (订舱 quer dizer reserva de navio).
2. **O que não mudou**: a reserva de praça no navio, no embarque, continua **booking** (`importFlow.step.booking`, `importFlow.ph.booking`, `containers.codeHint`, `board.card.ordBooking`). Também não mudam os nomes internos, que não aparecem na tela: endereços (`/app/booking/...`), chaves do dicionário (`bookingLots.*`), tabelas (`booking_lots`, `booking_items`, `booking_invites`), a tela `booking` das permissões e os arquivos. Nenhum dado foi alterado: avisos e histórico já gravados continuam com o texto de quando nasceram.
3. **Regra para textos novos**: escreva Book. O teste `tests/unit/book-wording.test.ts` falha se um texto de tela disser Booking fora da lista do navio, ou se inglês e chinês não usarem a mesma palavra.

Este documento e o código continuam dizendo "booking" como nome interno; na tela, leia Book.

**Booking antigo removido (decisão do dono, 11/11/2026).** A fila antiga de produtos (tabela `bookings`, uma linha por produto, etapas Novo → Em análise → Aprovado → Oferecido → Reservado → Virou solicitação → Descartado, "Gerar solicitação" e o envio automático da RFQ ao fornecedor do produto) saiu inteira: telas `/app/booking/products` e `/app/booking/[id]`, a opção "Mandar para o Booking" da importação da ficha técnica, o "Gravar no Booking" do Superplan, o bloco do Booking na Control Tower e o preço desejado na cotação. A tabela saiu do esquema (`src/lib/db/schema.ts`); o fluxo que vale é o desta página.

Onde está cada parte:

| Parte                                               | Arquivo                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Regras puras (status, colunas, busca e ordenação)   | `src/lib/booking-lots.ts`                                                               |
| Serviço (importar, editar, fechar, status)          | `src/lib/services/booking-lots.ts`                                                      |
| NCM do item                                         | `src/lib/services/booking-ncm.ts`, `src/lib/ncm-match.ts`                               |
| Análise do Superplan dos itens                      | `analyzeBookingItems` (`src/lib/services/superplan-analysis.ts`)                        |
| Vitrine (produto de solicitação ainda não liberado) | `src/lib/services/booking-visibility.ts`                                                |
| Ações                                               | `src/app/app/actions/booking-lots.ts`, `actions/booking-ncm.ts`                         |
| Telas                                               | `src/app/app/booking/`, `src/app/app/ncm-items/`                                        |
| Textos                                              | `src/i18n/modules/booking-lots.ts`, `booking-ncm.ts`, `booking.ts`, `booking-screen.ts` |

## 0. Booking por planilha (decisão do dono, 10/11/2026)

A tela **Booking** (`/app/booking`) é a lista dos **bookings**: cada booking é a planilha que um fornecedor mandou, com status, origem, fornecedor e data, e uma lista de itens.

**Os itens do booking não são produtos.** Nada entra no cadastro de produtos nem no Sankhya ao subir ou fechar um booking. Na **Seleção de itens** (`/app/booking/selection`, docs/SUPPLIER_REQUESTS.md) a Wellmix compara itens parecidos de vários bookings e abre a **solicitação ao fornecedor** do escolhido; só depois de aprovada com o fornecedor o produto é criado ou associado e os itens iguais são ligados a ele (`booking_items.productId`, vazio até lá). O botão da tela principal leva à Seleção de itens.

Decisões:

1. **Status do booking**: Rascunho → Fechado (importação concluída, análise do Superplan feita) → Em andamento → Concluído; e Cancelado. Só o rascunho é editável. À mão: Rascunho → Cancelado; Fechado → Em andamento, Concluído ou Cancelado; Em andamento → Fechado, Concluído ou Cancelado; Concluído → Em andamento; Cancelado → Rascunho (`bookingLotMoves`, `src/lib/booking-lots.ts`).
2. **Origem** é a cidade do fornecedor (`parties.city`). Sem fornecedor no booking, vale a cidade da planilha (coluna LOCAL).
3. **Um fornecedor por booking**, estimado pela planilha (o nome mais frequente na coluna SUPPLIER NAME) e ajustado pelo usuário. A planilha casa com o cadastro pelo nome (sem pontuação nem "Co., Ltd."), senão pelo telefone (8 últimos dígitos), senão, só quando a planilha não traz nome, pelo nº da loja (`matchSheetSupplier`). Sem correspondência, o detalhamento sugere cadastrar o fornecedor com nome, nº da loja, telefone e cidade da planilha (Cadastros → Fornecedores, sem login).
4. **Data** do booking: a da coluna DATE (a mais frequente), ajustável. A data como veio fica guardada para conferência (`sheetDate`).
5. **Colunas**. Lidas com campo próprio: product number list, SKU/factory item code, description, FOB/EXW\*, coin US$/RMB\*, price\*, qty/box\*, qty/inner\*, N.W./pc\*, G.W./pc\*, CBM\*, size (cm) length\*, width\* e height\*, capacity (ml)\*, package\*, material\*, MOQ\* (\* = obrigatório para fechar, `BOOKING_ITEM_REQUIRED`). Informativas: color assortment, function/battery/110/220, purchase schedule, departure interval in days, purchase qty in pcs, TT PCS, foto e supplier business card. **Qualquer outra coluna** fica guardada no item (`extras`, cabeçalho → valor) e não aparece na tela; os nomes dessas colunas ficam em `booking_lots.extraHeaders`. Linhas seguidas iguais com só a cor diferente continuam sendo um item só.
6. **Fechar** confere fornecedor, data e os campos obrigatórios de todos os itens e roda o **Superplan em todos os itens** com os valores padrão (câmbio do dia, container e frete padrão, preço mínimo), gravando o retrato em `booking_items.analysis` (`BookingAnalysis`). II e IPI vêm da tabela fiscal pelo NCM do item (veja "NCM do item", abaixo). Um seletor acima do botão escolhe o **tipo de negócio** do Superplan (vazio = o padrão dos parâmetros). Num booking fechado, "Refazer a análise" roda de novo (câmbio ou parâmetros mudaram).

Telas:

- **`/app/booking`**: tabela dos bookings (nº, status, origem, fornecedor, data, planilha, itens, incompletos, sinais do Superplan, responsável, carregado em). Clicar no cabeçalho ordena (de novo inverte); a busca filtra por qualquer campo enquanto se digita. Tudo no navegador (`searchBookingLots`, `sortBookingLots`). Botão **Importar booking**.
- **`/app/booking/import`**: arquivo (.xlsx/.xls, até 80 itens, subido direto ao armazenamento quando grande) ou link do Google Sheets, e a moeda dos preços sem moeda. Usa o mesmo leitor da ficha técnica (`parseProductSheet`); os erros de leitura têm os mesmos textos.
- **`/app/booking/lots/[id]`**: dados do booking (fornecedor e data gravam sozinhos no rascunho), sugestão de cadastro do fornecedor, fechar (tipo de negócio), status, observação e a tabela dos itens com todos os campos (no rascunho, cada campo grava sozinho ao sair dele; obrigatório vazio fica destacado), a conferência do que falta e o resultado do Superplan (sinal, preço mínimo, lucro e o que faltou).

Onde está: regras puras em `src/lib/booking-lots.ts`; serviço em `src/lib/services/booking-lots.ts`; análise dos itens em `analyzeBookingItems` (`src/lib/services/superplan-analysis.ts`); ações em `src/app/app/actions/booking-lots.ts`; campos que gravam sozinhos em `src/components/booking-lot-fields.tsx`; textos em `src/i18n/modules/booking-lots.ts`; testes em `tests/unit/booking-lots.test.ts` e, de ponta a ponta com a seleção e a solicitação ao fornecedor, em `tests/e2e/booking-supplier-request.spec.ts`.

Banco: tabelas `booking_lots` e `booking_items` (docs/APPWRITE.md). Antes da publicação (`npm run appwrite:push`), a lista avisa "esquema desatualizado" e não oferece a importação.

Permissões: importar, editar, fechar, analisar e selecionar são só da Wellmix com a tela Booking. Cadastrar o fornecedor sugerido também é dessa tela. Cliente, fornecedor e parceiros não veem bookings, itens, fotos nem a planilha guardada (documentos internos). Única exceção: o login externo com a tela Booking no perfil (de fábrica, só a Trading) lança e lê os bookings da própria empresa, sem a análise ("Booking do Trading", abaixo).

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
- **Passo 3 (enviar)**: botão **"Enviar para Wellmix Conferir"**, em cima e embaixo da tabela. O booking ganha o **número** (da mesma sequência dos bookings da Wellmix, sem buracos), vira **rascunho**, passa pela aproximação de NCM e quem da Wellmix abre o Booking recebe o aviso "Booking nº N lançado por um parceiro", com o link. Dali em diante segue como qualquer outro (conferir, NCM, fechar, Superplan, Seleção de itens) e ele só consulta.
- **Antes do envio a Wellmix não vê o booking**: fica fora da lista, da tela do booking (o endereço responde "não encontrado"), da Seleção de itens, da fila de NCM do despachante, dos convites e do painel; ninguém é avisado. As rotinas da Wellmix recusam um booking em preenchimento.
- **Descartar**: enquanto não enviou, ele pode descartar (planilha errada). Somem o booking, os itens e os arquivos que aquele lançamento criou; nada chegou à Wellmix. Auditoria: `booking_lot.partner_discard`.
- **Quem pode lançar**: login externo com a tela, de um cadastro **ativo** de um tipo que responde por booking (fornecedor, Trading, Factory, Supplier, GP ou tipo criado no painel). Cliente, agência e os demais, mesmo com a tela liberada, só consultam (e a lista vem vazia).
- **O que vê**: os bookings pelos quais a empresa dele **responde**: aqueles em que ela é o responsável (`booking_lots.partnerId`) ou, quando o booking não tem responsável, o fornecedor (`supplierId`). É a mesma regra de para quem vão as solicitações (`bookingRecipientId`). Na lista, os não enviados vêm primeiro, com o aviso de que falta enviar.
- **O que não vê**: bookings de outras empresas (o endereço direto responde "não encontrado", sem dizer se existe); o booking de uma trading não aparece para a fábrica citada na planilha dela (o preço é o da trading); a análise da Wellmix (Superplan, viabilidade, preço mínimo, lucro, margem); o NCM; o produto do cadastro ligado ao item; as colunas extras da planilha; a observação interna; o nome do fornecedor e de quem importou; as fotos e a planilha guardada (documentos internos, regra de sempre).
- **Situação, nas palavras dele**: em preenchimento, "Em preenchimento: falta enviar"; rascunho, "Em conferência na Wellmix"; fechado, "Conferido pela Wellmix"; as outras, como na Wellmix.
- **Depois de enviado**: corrigir, fechar ou cancelar é da Wellmix (ele fala com a Wellmix). Seleção de itens e convite para booking concorrente continuam só da Wellmix (abertos por um login externo, voltam para a lista dele).
- **Vínculo feito pela Wellmix**: no campo "Responsável pelo booking" da tela do booking. O booking aparece para o parceiro assim que ele vira o responsável, em qualquer situação.
- **Travas**: até 20 bookings carregados pela mesma empresa em 24 horas (`booking_launch_limit`); a chave de arquivo enviada por um login externo tem de ser de um arquivo recém-subido, nunca a de um documento já registrado (vale também para a resposta ao convite).

Situação nova no ciclo do booking: `preparing` (antes de `draft`), só para o booking lançado pelo parceiro. Sem mudança no banco (a coluna é texto); `appwrite.config.json` foi gerado de novo.

Onde está: `src/lib/services/booking-partner.ts` (`launchPartnerBooking`, `setPartnerBookingItemField`, `sendPartnerBooking`, `discardPartnerBooking`, `canLaunchBooking` e as leituras; nunca lê bookings de outra empresa); `releasePreparingLot` e as travas do lado da Wellmix em `src/lib/services/booking-lots.ts` (`wellmixLot`), `booking-ncm.ts` e `booking-invites.ts`; ações em `src/app/app/actions/booking-lots.ts`; tela em `src/app/app/booking/_components/partner-booking.tsx` e campos em `src/components/partner-booking-fields.tsx`; regras puras em `src/lib/booking-lots.ts` (`bookingLotPreparing`, `bookingItemFieldKind`, `BOOKING_PARTNER_TYPES`, `bookingRecipientId`); regra das telas em `src/lib/partner-access.ts` (`ADAPTED`, `PROFILE_EXTRA`); testes em `tests/unit/booking-partner.test.ts` e `tests/e2e/partner-access.spec.ts`.

Fica para o dono decidir: a Wellmix devolver o booking para o parceiro corrigir; o parceiro ver as fotos dos itens e baixar um modelo de planilha; ser avisado quando um booking passa a ser dele ou é conferido; lembrete para o booking carregado e não enviado; a Wellmix enxergar (sem mexer) os bookings ainda em preenchimento.

### Capacidade: mililitros ou tamanho (dono, 12/11/2026)

Achado do dono: a planilha de porta-retratos trazia a coluna de capacidade preenchida e a tela mostrava o campo vazio.

- **Causa**: a coluna "capacity" da planilha traz mililitros quando o produto tem volume ("350", "350 ml", "1,5 L") e um **tamanho** quando não tem ("8X10", "A4"). O leitor já separava: o número em `booking_items.capacityMl`, o texto em `booking_items.sizeText`. Só que nenhuma tela do booking mostrava o `sizeText`, e a coluna só aceitava número. O dado não se perdia; ficava escondido.
- **Agora** a coluna Capacidade ("ml ou tamanho") mostra os mililitros ou, sem eles, o tamanho, e **aceita letras**: número (com ou sem "ml"/"L") grava em `capacityMl`; qualquer outro texto grava em `sizeText`; vazio apaga. Vale na tela do parceiro (em preenchimento e depois de enviado), na tela do booking da Wellmix, na Seleção de itens e na solicitação ao fornecedor (a cópia do item passou a levar o `sizeText`).
- **Para fechar o booking, o tamanho vale como capacidade** (`missingItemFields`): um porta-retrato não precisa de mililitros inventados.
- Os bookings já carregados não precisam ser enviados de novo: o tamanho já estava gravado e passa a aparecer.
- Regras em `src/lib/booking-lots.ts` (`parseCapacityMl`, `readBookingCapacity`, `bookingCapacityShown`); testes em `tests/unit/booking-capacity.test.ts` e `tests/unit/booking-partner.test.ts`. Sem mudança no banco.
- Em aberto: a ficha de compra do pedido e a ficha do produto continuam com a capacidade só em mililitros; o tamanho ainda não segue para elas.

### NCM do item (decisão do dono, 11/11/2026)

O NCM é **obrigatório para fechar o booking** e entra na análise do Superplan (II e IPI da tabela fiscal).

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
3. **A Wellmix também preenche**, na coluna NCM da tabela de itens. A coluna grava sozinha e continua **editável depois de fechado** (menos no Cancelado). Ao trocar o NCM de um item de booking fechado, a análise do Superplan daquele item é refeita na hora. Apagar o NCM só no rascunho.
4. Com a tabela fiscal carregada, o NCM tem de estar nela (`booking_ncm_not_in_table`).
5. **Tabela fiscal carregada depois** (12/11/2026, `reanalyzeLotsForFiscalTable` em `src/lib/services/booking-lots.ts`): ao subir a TEC ou a TIPI em Configurações, ou quando o robô baixa a tabela, o sistema refaz sozinho a análise do Superplan dos bookings **fechados, em andamento ou concluídos** que têm algum item cujo II ou IPI pelo NCM mudou (inclusive o item que antes estava fora da tabela e contava 0%). Cada booking refeito usa o próprio tipo de negócio e o câmbio do dia, como "Refazer a análise"; os outros ficam como estão, para o robô não trocar câmbio e parâmetros de análises que a tabela não mexeu. Rascunho e cancelado ficam de fora. Configurações mostra quantos bookings e itens foram refeitos; cada um fica na auditoria (`booking_lot.analyze`, quem carregou a tabela, ou "system" pelo robô). Uma falha aqui não desfaz a tabela carregada. Testes em `tests/unit/booking-fiscal-reanalyze.test.ts`.
6. O produto criado na solicitação ao fornecedor aprovada **herda o NCM** do item escolhido (cadastro e ficha mestre; docs/SUPPLIER_REQUESTS.md).

Origem do NCM (`ncmSource`): `match` (aproximação), `broker` (despachante) ou `manual` (Wellmix). Tudo fica na auditoria (`booking_item.ncm`). Testes em `tests/unit/booking-ncm.test.ts`.
