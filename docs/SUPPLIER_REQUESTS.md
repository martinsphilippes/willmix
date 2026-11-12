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
- Colunas: escolher (um), alternativa (vários), foto, item (descrição, código, cores), fornecedor e origem, booking (nº e data, com link), preço e incoterm, preço em US$ (RMB convertido pela cotação do dia), MOQ, qtd/caixa e inner, CBM, medidas, capacidade, material e embalagem, quantidade da planilha, **custo por peça** do Superplan, Superplan (preço mínimo, preço para a meta e avisos) e a solicitação em andamento do item.
- O item de **menor custo por peça** entre os mostrados fica destacado ("Menor custo por peça", `bestCostItem`). Pelo custo, e não pelo mínimo: o mínimo é custo × markup do tipo de negócio, e bookings fechados com tipos diferentes não se comparam por ele (até 12/11/2026 era o menor mínimo, `bestMinimumItem`).

#### Superplan na seleção (12/11/2026)

Os números vêm do retrato gravado em `booking_items.analysis` ao **fechar o booking** (ou "Refazer a análise"), não são refeitos ao abrir a tela. A conta é a mesma da tela do Superplan (`analyzeBookingItems`, docs/SUPERPLAN.md seção 5), com os valores padrão: câmbio do dia do fechamento, container e frete padrão, tipo de negócio escolhido ao fechar, II e IPI pela tabela fiscal com o NCM do item.

- **Custo/peça (Superplan)**: quanto cada peça custa posta no depósito (compra no dólar futuro, frete, seguro, impostos da importação, despesas no Brasil e na China, ÷ peças que cabem no container). É o número para comparar com o preço que o cliente paga e decidir o escolhido e as alternativas. A coluna ordena pelo valor.
- **Superplan**: preço mínimo (custo × markup), **preço para a meta** ("Meta 22%: R$ …", ou "inalcançável") e avisos que tornam o custo menos confiável: "Sem II/IPI (NCM fora da tabela fiscal): custo abaixo do real" e "Peso bruto estimado pelo líquido". Passar o mouse mostra data, tipo de negócio, container, frete e dólar usados (`BookingItemSuperplan`, `src/components/booking-item-superplan.tsx`).
- **Sem o selo viável / abaixo da meta / prejuízo** quando a conta foi feita no preço mínimo (sempre, no fechamento do booking): nesse preço o lucro depende quase só dos parâmetros e todo item saía "Abaixo da meta" (com os parâmetros padrão, lucro de 13% a 19% para meta de 22%, qualquer que fosse o produto). Regra da seção 5.2 do docs/SUPERPLAN.md. O selo continua quando há preço testado; "Falta dado" continua, com o que faltou.
- O mesmo bloco aparece na solicitação ao fornecedor ("Superplan do item escolhido") e o custo por peça nas alternativas.
- **Filtros dos bookings** (`src/lib/booking-selection.ts`, no endereço): status (Rascunho, Fechado, Em andamento, Concluído, Cancelado; padrão: todos menos Cancelado), **período** da data do booking num calendário de intervalo só (dois cliques, atalhos últimos 7/30 dias, este mês, mês passado; `DateRangePicker`), fornecedor e origem (cidade do fornecedor). Mudar status, fornecedor ou origem já filtra.
- **Abas Itens e Seleção** (decisão do dono, 11/11/2026):
  - **Itens**: aba só de agrupamento (decisão do dono, 11/11/2026): sem as colunas "Escolher" e "Alternativa" e sem o quadro "Abrir solicitação ao fornecedor"; a escolha é gravada só na aba Seleção, com o grupo (ver "Escolha por grupo"). Cada linha tem a caixa "Agrupar"; a do cabeçalho marca todos os da tela (o que o filtro e a busca mostram). A cesta (`SelectionBasket`, guardada na aba do navegador) continua entre buscas; "Agrupar para seleção" leva até 60 itens, de vários fornecedores, para a aba Seleção (`?tab=selection&ids=…`).
  - **Seleção**: o grupo para comparar (mesma tabela e formulário de abrir a solicitação, só com os itens do grupo; os filtros não valem para o grupo) e os **blocos sugeridos**: itens dos bookings do filtro com nomes parecidos (palavras significativas com Jaccard ≥ 0,5, ligação transitiva; palavra presente em mais de 400 itens não liga), primeiro os blocos com mais fornecedores (`suggestBlocks`). "Comparar e selecionar" abre o bloco como grupo.
- Gravar a escolha (ver "Escolha por grupo"): o item escolhido, as alternativas, a **quantidade** (em branco = a da planilha: PURCHASE QTY IN PCS, senão TT PCS; sem nenhuma, a tela pede a digitada) e **o que a Wellmix precisa no produto** (texto livre que o fornecedor lê).

### Escolha por grupo (decisão do dono, 11/11/2026)

O quadrante de comparação **não abre a solicitação**: ele grava a escolha do grupo. A solicitação nasce depois, dos blocos.

1. **Gravar escolha** (`saveSelectionGroup`): o item que ganhou (um só, de booking fechado), a quantidade de peças (em branco = a da planilha do ganhador) e o que a Wellmix precisa. Opcional: a **programação de compra** (rodadas, peças por rodada e intervalo; a quantidade vira a soma), que vai na solicitação ao responsável pelo booking e faz do pedido de compra um pedido pai com filhos por rodada (docs/PURCHASE_SCHEDULE.md). O grupo são os itens comparados na aba Seleção (a aba Itens só agrupa). Nada vai ao fornecedor: nem solicitação, nem aviso.
2. Fica em `selection_groups` (`status` saved → requested; `replaced` quando outra escolha toma o lugar). Gravar de novo um grupo com algum item em comum com uma escolha ainda não enviada **troca** a anterior (um item não fica em duas escolhas esperando).
3. **Ordem dos blocos** (decisão do dono, 11/11/2026): em cima os **resolvidos** que esperam a solicitação; depois os blocos **por resolver**; separados embaixo, os que já têm **solicitação aberta**. Cada parte com o seu título e a contagem.
4. **Blocos sugeridos**: o bloco cujo ganhador está nele aparece como **Resolvido**, com o item escolhido em verde e a quantidade (`groupForBlock`). Escolhas de grupos montados à mão (sem bloco sugerido) aparecem como cartões próprios. "Rever a escolha" reabre o grupo com a escolha preenchida.
5. **Abrir a solicitação** (`openGroupRequests`): "dos marcados" (cada bloco resolvido tem uma caixa, já marcada) ou "de todos". Abre **uma solicitação só por fornecedor**, com os ganhadores como produtos dela (ver "Uma solicitação, vários produtos"); de cada grupo vai **só o ganhador**; os outros itens do grupo vão como alternativas (só a Wellmix vê). O grupo passa a mostrar "Solicitação nº N aberta" com o link. Um grupo que não abre (ex.: item com solicitação em andamento) continua gravado e a tela diz o motivo; os demais abrem. Uma solicitação só (um fornecedor), sem falha, leva direto a ela.
6. Só a Wellmix com a tela Booking grava, lista e abre. O fornecedor não tem acesso a `selection_groups`.

### Referências por IA (pedido do dono, 12/11/2026)

À direita do bloco "Gravar a escolha do grupo" fica o painel **Prompts de IA para o fornecedor**: três prompts que a OpenAI transforma em arquivos anexados à solicitação, para o fornecedor ver, além das demais informações, como o produto deve ficar de forma aproximada ao final da produção.

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
4. **Alternativas**: até 30 itens parecidos, guardados por id. Só a Wellmix vê (com fornecedor, origem, preço, mínimo do Superplan e link para o booking).
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

- **Uma informação por coluna**: foto (miniatura que amplia, `PhotoGallery`), nº, produto, código da fábrica, nº do item, material, quantidade, MOQ, preço, moeda e entrega do booking, o que a Wellmix precisa, "faz?", as **condições iniciais** (as do booking, com que a Wellmix abre a solicitação: preço, moeda, MOQ, FOB/EXW; o booking não traz prazo; `initialConditions`) e as **condições finais** (a **última proposta enviada, aceita ou não**: cada passo atualiza as condições em ordem, da resposta do fornecedor à contraproposta da Wellmix, ao aceite/recusa e à nova proposta; com a situação dela: resposta do fornecedor, contraproposta enviada, aceita, recusada ou nova proposta do fornecedor; `finalConditions`), situação, SLA (prazo com data e hora, "Atrasada"), de quem é a vez, **aberta em**, **1ª resposta** e **última resposta** (data e hora; `answerTimes`).
- Ações rápidas por linha, **só ícones** (o nome fica na dica e no `aria-label`), cada uma numa caixa pequena (`QuickDialog`):
  - **Mensagem**: texto para a conversa da solicitação.
  - **Sim / Não**: resposta definitiva com preço e moeda, **MOQ** e **modalidade de entrega (FOB/EXW)**; o prazo já respondido fica como está. Só o fornecedor responde (desde 12/11/2026 a Wellmix, mesmo admin, não registra a resposta por ele: `supplier_request_supplier_only`). Só enquanto se pode responder (Aberta ou Respondida, sem contraproposta esperando).
  - **Abrir produto**: a tela completa, no mesmo link com `?view=item`. "Ver todos os produtos" volta à tabela.
- As ações da tabela voltam para a tabela (`view=table`); as da tela do produto voltam para o produto.

## Tela do produto da solicitação (`?view=item`)

- **Resposta**: o formulário completo tem também a **modalidade de entrega (FOB/EXW)** (`supplierIncoterm`; sem ela, a do item do booking).
- **Histórico de interações** (linha do tempo, `requestTimeline`), na coluna da direita logo abaixo da resposta do fornecedor: abertura, cada resposta do fornecedor (as registradas pela Wellmix antes de 12/11/2026 continuam marcadas assim), contrapropostas, aceites, novas propostas, recusas, mensagens e arquivos, a decisão da Wellmix e o produto (criado/associado, vitrine, CODPROD), cada um com data e hora, quem fez e o que ficou resolvido. Cada resposta passa a ser um passo `answer` no histórico. As respostas de antes disso (só a última ficava na solicitação) vêm da auditoria (`supplier_request.answer`, `legacyAnswers`): a hora e o "faz/não faz" de cada uma; só a última tem os valores. A 1ª e a última resposta da tabela usam as mesmas horas.
- **Conversa**: ícone flutuante de chat no canto inferior direito; abre uma janela pequena com as mensagens e o campo para mandar outra (foto, PDF ou Excel). O cartão Negociação fica só com a contraproposta e a resposta a ela.

### Ficha negociada (decisão do dono, 12/11/2026)

- O cartão principal se chama **"O que está sendo negociado"** (era "O que a Wellmix pede").
- Com a resposta "faz", a ficha do item mostra as **condições combinadas** (`agreedConditions`: resposta do responsável, contraproposta aceita ou nova proposta dele; com contraproposta esperando, a resposta gravada): **preço negociado** (moeda e FOB/EXW), MOQ e prazo de produção. Onde mudou, o valor do booking fica ao lado, **riscado**. O item do booking não é alterado (a planilha continua como veio).
- **Superplan refeito** (só a Wellmix): a mesma conta do booking (`analyzeNegotiatedItem`, em `superplan-analysis.ts`) com o preço e a moeda negociados, o tipo de negócio do retrato do booking e o câmbio do dia, refeita a cada abertura da tela; nada é gravado. Mostra o custo por peça novo com o do booking riscado, o preço mínimo e a meta.
- **Alternativas com a nova referência**: a alternativa com custo do booking menor que o custo negociado ganha o selo "mais barata que a negociada"; cada alternativa tem **"Abrir solicitação para esta"** (o item atual e as outras viram alternativas dela, com a mesma quantidade e necessidade; as regras de sempre valem, como `supplier_request_exists`).

### Solicitações ligadas (decisão do dono, 12/11/2026)

- **Ligadas**: as solicitações do item e das alternativas dele, nos dois sentidos (uma lista o item da outra como alternativa; `linkedSupplierRequests`). Só a Wellmix vê, no cartão "Solicitações ligadas" da tela do produto: nº, item, fornecedor e situação.
- **Ao aprovar uma**, cada ligada em andamento (Aberta ou Respondida) passa a **pedir uma resposta** (`linkedApprovalAsking`): **Continuar negociando** (fica o passo `keep` no histórico, só da Wellmix, e a pergunta some até outra aprovação) ou **Recusar** (vai para Recusada mesmo antes da resposta do fornecedor, com a nota "Alternativa aprovada: solicitação nº …"; `resolveLinkedRequest`, permissão `supplierRequest.decide`). A pergunta aparece na aprovada (aviso e botões no cartão) e no topo da ligada até ser respondida.

## Lista de solicitações

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

### Contraproposta com o Superplan (decisão do dono, 12/11/2026)

- **Mesmos campos da resposta**: a contraproposta da Wellmix (e a nova proposta do fornecedor) tem preço, moeda, MOQ, prazo e **modalidade de entrega (FOB/EXW)**. A FOB/EXW aceita ou proposta vira a do fornecedor (`supplierIncoterm`).
- **Estimativa do Superplan** (só a Wellmix, no formulário "Devolver com contraproposta"): a tela recebe a entrada do Superplan do item (`superplanBaseForItem`: tipo de negócio do retrato do booking, container, frete e câmbio do dia) e refaz a conta no navegador a cada tecla (`computeSuperplan` é pura):
  - digitando o **preço sugerido**: custo por peça e preço mínimo (com o mínimo do booking para comparar);
  - pela **inversa**, digitando o **preço mínimo desejado (R$)**: o preço por peça necessário (`priceForMinimum`, em `src/lib/superplan-inverse.ts`, busca binária, arredondado para baixo) e o botão "Usar este preço". Mínimo abaixo do que o frete e as despesas já custam: "não alcançável".
  - Só USD e RMB entram na conta; faltando dado do item (caixa, volume, frete, câmbio), a tela diz isso. É estimativa: o que vale é o que o fornecedor responde.

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

- O fornecedor vê só as solicitações do próprio cadastro (`supplierId` = `user.partyId`); a de outro dá 404. Não vê as alternativas (outros fornecedores), o Superplan nem o booking.
- A foto do item (documento interno do booking) abre para o fornecedor dono de uma solicitação com aquela foto (`supplierSeesRequestPhoto`, em `canAccessDocument`). Outro fornecedor, não.
- Cliente e demais parceiros não abrem as telas.

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
| Textos                                                      | `src/i18n/modules/supplier-requests.ts`                                                                                                                                                           |
| Testes                                                      | `tests/unit/supplier-requests.test.ts`; de ponta a ponta (booking → seleção → solicitação → resposta do fornecedor → produto → vitrine → CODPROD) em `tests/e2e/booking-supplier-request.spec.ts` |

## Amostragem (depois de aprovada; 12/11/2026)

A aprovação abre a **Amostragem**: o responsável pelo booking envia fotos e vídeos de uma amostra do item e a Wellmix aprova ou reprova (docs/SUPPLIER_SAMPLING.md). Não bloqueia o produto nem o pedido.

## Produto (depois de aprovada; decisão do dono, 10/11/2026)

Na solicitação **Aprovada**, a Wellmix que abre Cotações e Produtos vê o bloco **Produto**, no próprio detalhe da solicitação.

1. **Criar produto novo**: o analista dá o **nome correto** e escolhe a **linha de produto**. O resto vem preenchido:
   - **Condições combinadas** (`agreedConditions`, mostradas no formulário): as finais da negociação (`finalConditions`: resposta do fornecedor, contraproposta aceita ou nova proposta dele) para preço, moeda, MOQ, entrega (FOB/EXW) e prazo; contraproposta recusada ou ainda pendente fica com a resposta gravada do fornecedor; sem preço na resposta, valem os do booking. Até 11/11/2026 só a resposta gravada valia (a contraproposta aceita não chegava ao produto).
   - **SKU = código da fábrica** (11/11/2026): é o REFFORN que o Sankhya recebe e pelo qual a sincronização acha ou vincula o CODPROD (`syncProduct`); antes o SKU nascia vazio e a inclusão no ERP não achava o código depois.
   - **Para incluir no Sankhya** (`erpReadiness`, no formulário): DESCRPROD (nome), REFFORN, NCM, pesos e medidas, com o que falta em vermelho (obrigatório) ou amarelo (completa-se no produto). A lista de linhas mostra o CODGRUPOPROD de cada uma ou "sem grupo do Sankhya" (sem grupo a inclusão no ERP recusa).
   - Código da fábrica, medidas, caixa, pesos, CBM, capacidade, embalagem, material, cores e função vêm do item. A ficha mestre é gravada com esses valores (`sheetFromRequest`).
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
