# Listas no nível do pedido e o produto dentro do pedido

Pedido do dono (18/11/2026), com as respostas às perguntas: vale para Encomendas, Pedidos, Solicitações ao fornecedor, Ordens de venda e Cotações de compra; o ícone de abrir, para todas as tabelas; o produto clicado dentro do pedido abre o pedido filtrado naquele produto.

## 1. A lista é do pedido, não do produto

Um pedido pode ter milhares de produtos, então as listas não mostram foto, nome ou quantidade de produto.

- **Encomendas** (`/app/requests`): Nº (link) → Cliente → Produtos (SKUs diferentes) → Preço total → MOQ total (UN) → Peças total (UN) → Caixas master total → Inner total (CX) → CBM total (m³) → Situação → Containers por programação → Programações → Próximo passo → Prazo → Pedido → Analista → Data → ícones (abrir, excluir, conversa). Os totais estão na seção 5.
  - **Produtos**: os itens do pedido quando já há pedido (histórico do Sankhya), senão as solicitações do lote (`src/lib/request-composition.ts`).
  - **Programações**: a maior programação gravada entre os produtos (`requests.schedule`). Um produto sem programação conta como 1 entrega.
  - **Containers por programação**: quantos containers cada programação enche, pela caixa master (peças e CBM pela mesma regra da ficha completa desde 18/11/2026, seção 5), no **maior container das Configurações** (a solicitação não grava o tipo escolhido na tela). Aparece como "2 · 1" ou "2 em cada". Fica em "—" quando algum produto não tem caixa master ou CBM, porque a conta sairia menor do que é (`src/lib/request-rounds.ts`).
  - A busca continua procurando pelo nome do produto.
- **Pedidos** (`/app/orders`): a coluna de produto virou **Produtos** (a contagem). Os produtos continuam no painel de itens embaixo da linha escolhida. O filtro de texto da coluna ainda procura pelo nome do produto.
- **Solicitações ao fornecedor**, **Ordens de venda** e **Cotações de compra**: Produtos como contagem. Nas Solicitações ao fornecedor entram também programações e containers por programação (no 40HC, ou no maior tipo). Ordens de venda e cotações não têm dado de programação, então ficam sem essas colunas.

## 2. Abrir é sempre o nível do pedido

- Depois de **Enviar** (Nova solicitação, carrinho e "Solicitar orçamento agora"), a tela também cai na página da solicitação, com "Solicitação enviada." quando é um produto só.
- A linha de Encomendas abre `/app/requests/batch/<groupId>`. A solicitação criada sozinha (sem lote) abre o mesmo endereço pelo id dela, como pedido de um produto só. O id de uma solicitação de lote redireciona para o lote.
- Na página do pedido, o produto abre a tela dele naquele pedido: `/app/requests/<id>` na solicitação, com "← Voltar ao pedido" (`data-back-to-order`). No pedido, abre `/app/orders/<id>?item=<item>`, que mostra só aquele item na tabela de itens, com a conversa do item e o link "Ver o pedido inteiro".

## 3. A tabela de produtos dentro do pedido

Cada produto tem foto, peças por caixa, quantidade, caixas e o ícone de mensagem daquele produto naquele pedido:

- na solicitação: alvo `requestId`;
- no pedido: alvo `orderId` + `orderItemId`.

Na tela do pedido, as peças por caixa saem da variação ou da caixa master do cadastro, para todos que veem o pedido. A foto continua com a regra de antes: só para a Wellmix e para a certificadora.

## 4. Abrir é um ícone

`OpenLink` (`src/components/ui.tsx`) é um ícone de abrir sem a palavra. O texto de antes ("Abrir", "Abrir pedido"…) vira o nome acessível e a dica, então quem procura o link pelo nome continua achando. A primeira coluna da linha também leva ao mesmo lugar. Botões de página, links dentro de frases e links de arquivo ficaram como eram.

## 5. Totais de cada encomenda (dono, 18/11/2026)

Encomendas ganhou, depois de Produtos: **Preço total | MOQ total (UN) | Peças total (UN) | Caixas master total | Inner total (CX) | CBM total (m³)**, e depois Situação, Containers por programação, Programações, Próximo passo e Prazo, como antes. Cada linha soma todos os produtos e todas as programações da encomenda, cada quantidade uma vez. Decisões do dono (18/11/2026, sobre a análise da origem de cada dado): 1, 2 e 3 como recomendado; 4, o MOQ do Sankhya primeiro.

### Origem e regra de cada total

| Total | Origem | Regra |
| --- | --- | --- |
| Preço total | `requests.priceForecast` (novo): a cotação V2 do Sankhya (`FN_AD_ENC_COTACAO_V2_WELL`) recalculada pelo servidor depois do envio da Nova solicitação, com as condições do pedido (formato, nível, quem chama o transportador, valor do transporte), o cliente e as peças do produto | Venda ao cliente, em R$: preço com frete (`PRECO_COM_FRETE_REFERENCIA`; no formato WD, `PRECO_WD_COM_FRETE_REFERENCIA`) × peças, somado por moeda. O VIP do formato e do nível já entra na conta do Sankhya (não há outro desconto na encomenda). |
| MOQ total (UN) | Pedido mínimo em peças: variação → ficha mestre → cadastro (`effectiveMoq`, a mesma regra que barra quantidade abaixo do mínimo) | O mínimo de cada produto (produto + variação) uma vez só, mesmo que apareça em duas linhas; vale para a quantidade total do produto, não por programação. Não existe MOQ compartilhado entre variações no portal. |
| Peças total (UN) | A programação gravada (`requests.schedule`); sem ela, a quantidade; em caixas (CX, CTN…), caixas × peças por caixa | Soma de todas as programações de todos os produtos. Outra unidade (kg, m) não vira peça (o produto fica de fora, "Total parcial"). |
| Caixas master total | Peças por caixa master | Peças ÷ peças por caixa, para cima **em cada programação** (cada entrega fecha as suas caixas), e soma. 1.000 peças em 2 × 500 com 48 por caixa são 11 + 11 = 22 caixas (pelo total seriam 21). |
| Inner total (CX) | `innerBoxQty` = **peças por inner** ("Unidades por inner box"; no Sankhya, o menor volume alternativo acima de 1) | Peças ÷ peças por inner, para cima em cada programação, e soma. Inner continua opcional: sem ele, "—". |
| CBM total (m³) | m³ **por caixa master** (no Sankhya, o M3 do volume da master) | Caixas de cada produto × m³ da caixa, com o m³ como foi gravado (sem arredondar), e soma. Só o m³ **da caixa contada**: o CBM de uma caixa com outra quantidade de peças (ex.: o cadastro com a caixa de 60 e a variação pedida com 24) fica de fora, e o produto entra como "Total parcial" (dono, 19/11/2026, a mesma regra da Estratégia de compra). A tela mostra 3 casas (a soma dos produtos na página da encomenda bate com o total: 271,938 + 135,966 = 407,904); a dica, 4. |

A caixa, o inner e o m³ de cada produto saem da **mesma regra da ficha completa** (docs/REQUEST_SHEET.md, seção 3): o texto da solicitação → a variação pedida → a ficha de compra do pedido → a negociação → o Book → a ficha atual (cadastro e ficha mestre). O código é um só (`src/lib/services/request-packing.ts`: as fontes em `packingCandidates`, as mesmas da Estratégia de compra, e a conta em `resolvePacking`) para a ficha, a lista, a página da encomenda, o CSV e a coluna **Containers por programação**, que passou a usar a mesma caixa e o mesmo m³ (antes olhava só variação → cadastro). Os totais da encomenda: `src/lib/request-totals.ts` (`encomendaTotals`).

### Dado ausente, zero e "Total parcial"

- Nenhum produto com o dado: **"—"**, com a dica "Sem o dado: …". Zero só aparece quando o valor é zero.
- Alguns produtos sem o dado: a soma do que existe com **"Total parcial"** embaixo, e na dica a regra e os produtos que ficaram de fora (até 8 nomes e "e mais N").
- Itens do pedido (histórico do Sankhya) que não estão nas linhas da encomenda entram como "faltando" em todos os totais.
- Preço sem previsão gravada: "—" com a explicação (encomenda sem as condições do pedido, enviada antes de 18/11/2026 ou sem resposta do Sankhya).

### Quem vê

- **Preço total**: só a Wellmix com "Ver valores e margem" (a mesma regra da venda na ficha completa). O cliente não vê (é previsão até virar pedido).
- **MOQ total**: só a Wellmix (como o pedido mínimo na ficha).
- Peças, caixas, inner e CBM: todos que veem a encomenda (as caixas já apareciam para todos na página da encomenda, seção 3).

### Ordenação, tela e CSV

- As colunas novas ordenam por número (o texto de ordem é o número com ponto e 6 casas; sem dado, fica no fim). Na lista longa (ordem no servidor), ordenar por um total lê os totais de todas as linhas; sem isso, só os da página.
- Cabeçalhos com a unidade; as demais colunas continuam pela rolagem dentro da tabela (a página não rola de lado no computador nem no iPad, deitado ou em pé).
- **Página da encomenda** (`/app/requests/batch/<id>`): o quadro "Totais da encomenda" com os mesmos números da lista e, por produto, Peças por caixa, Peças (UN), Caixas (a dica mostra as de cada programação), Inner (CX), CBM (m³), MOQ (UN) e Preço previsto (com o preço por peça, as peças e a data na dica).
- **CSV** (`/app/requests/export`): continua uma linha por produto; no fim, Peças (UN), Caixas master, Inner (CX), CBM (m³), MOQ (UN) e, para quem vê valores, Preço previsto (R$), com os valores daquele produto (somar as linhas de um Nº dá o total da lista, sem contar nada duas vezes). Números sem milhar, com a vírgula decimal em pt.

### Previsão de venda gravada no envio (decisão 1)

O "Valor total" da Nova solicitação era só da tela. Agora, depois do envio (`after()`, sem atrasar a resposta), o servidor refaz a mesma consulta da tela (`forecastQuery`, também usada por `/api/price-forecast`) para cada produto e grava `requests.priceForecast` (preço por peça, peças, total, R$, base, formato, nível, quem chama, frete e a data). O número que o navegador mostrou não é aceito. Sem o Sankhya configurado ou se a cotação falhar, a encomenda nasce do mesmo jeito e fica sem previsão. O produto acrescentado depois a uma encomenda com condições do pedido também ganha a previsão. As encomendas enviadas antes de 18/11/2026 ficam com "—". Código: `src/lib/services/request-price-forecast.ts`.

### Em aberto

- **MOQ do Sankhya** (decisão 4: Sankhya → ficha → cadastro → "—"; o dono deixou para depois em 19/11/2026): o portal não lê pedido mínimo do Sankhya em lugar nenhum (a carga de produtos não tem esse campo e as credenciais do ERP não ficam na sessão de desenvolvimento). Falta o nome do campo no Sankhya (ex.: um `AD_` do TGFPRO). Com ele, a carga grava o mínimo do Sankhya e a regra passa a ser Sankhya → variação → ficha mestre → cadastro. Hoje, em produção, só 2 dos 13.910 produtos ativos têm mínimo cadastrado.
- **Frete na previsão de vários produtos**: a cotação V2 recebe o valor do transporte total em cada produto (`@FRETE_ENTREGA_BRL`), como a tela sempre fez. Se a função do Sankhya divide o frete pelas peças de cada produto, numa encomenda com N produtos o frete entra N vezes no Valor total. A conferir com o Sankhya antes de mudar.

## 6. Encomendas: cards por solicitação, número do rascunho e quem age (dono, 19/11/2026)

Pedido do dono com as decisões de 19/11/2026: 1, numeração do rascunho pela sequência das solicitações; 2, título "Entregas"; 3, responsável da Wellmix como equipe; 4, prazo da etapa atual.

### Cards

**Total | Abertas | Rascunhos | Atrasadas** (`listCards`, `src/lib/services/request-list-cards.ts`):

- **Total**: as solicitações da lista mais os rascunhos de quem vê.
- **Abertas**: solicitações enviadas com alguma etapa pendente, de quem for a vez (cliente, fornecedor ou Wellmix).
- **Rascunhos**: os rascunhos de quem vê (só o dono do rascunho o vê, como sempre).
- **Atrasadas**: abertas com o prazo da etapa atual vencido (subconjunto de Abertas). Prazo por dia vence no dia seguinte; prazo com hora (SLA), na hora.

**Causa da divergência anterior**: os cards contavam cada produto (a solicitação nº 6, com 2 produtos, entrava 2 vezes; em produção, "Todas" e "Em aberto" mostravam 3 para 2 solicitações), não contavam os rascunhos e ignoravam a busca, o tipo e o "Com quem está".

**Regras**:

- Cada solicitação conta uma vez, com quantos produtos, programações ou pendências tiver.
- Os cards contam tudo o que a busca, o tipo (`?kind=`) e o "Com quem está" (`?vez=`) deixam, antes da paginação. O card escolhido (`?situ=all|open|draft|late`) filtra a lista sem mudar a contagem dos outros.
- O "Com quem está" conta cada solicitação uma vez por parte (com ações paralelas, ela entra em cada parte) e conta com a busca, o tipo e o card. O rascunho é da Wellmix.
- A busca e o "Com quem está" trazem a solicitação inteira quando um produto passa (antes vinham só os produtos que passavam, com totais parciais).
- Canceladas e excluídas continuam fora dos cards, em "Ver canceladas e excluídas".

### Coluna Solicitação e o número do rascunho

- Só o número real e persistente, como link: abre a solicitação (`/app/requests/batch/<id>`) ou continua o rascunho. Sem "#", nome de produto, "Sem produto", subtítulo ou etiqueta. A Situação do rascunho é "Rascunho".
- **O rascunho tinha só o id interno (UUID) e o título.** Agora ele reserva o número da solicitação no primeiro salvamento, da mesma sequência das enviadas (`request_number`), em `request_drafts.number`. Ao enviar, a solicitação repete o número (`createRequestBatch`, `internal.number`).
- Rascunho descartado deixa o número sem uso (salto na sequência).
- Rascunho de antes da coluna ganha número no próximo salvamento. Os 3 que havia em produção foram numerados uma vez, depois de publicar a coluna.
- A busca acha o rascunho pelo número; a coluna ordena por número.

### Colunas e cabeçalhos

**Solicitação | Cliente | Itens | Valor | Peças | Master | Inner | CBM (m³) | Situação | Cont./prog. | Entregas | Próxima ação | Prazo | Analista | Data**, cada título numa linha, com a explicação por mouse, toque e teclado (`InfoTip`, `src/components/info-tip.tsx`). O balão fica na camada do topo: não é cortado pela rolagem da tabela, e clicar no "i" não ordena a coluna (`data-table-hint`).

- **MOQ e Pedido saíram da tabela.** O MOQ segue na página da solicitação e no CSV; o vínculo do pedido, na página da solicitação e no CSV. Nenhum dado mudou.
- **Valor**: previsão de venda ao cliente, em R$ (a cotação V2 do Sankhya com frete, gravada no envio, seção 5). Não é o valor do pedido.
- **Entregas** (antes "Programações"): as programações de compra. Cada uma vira um pedido filho com embarque e entrega próprios. A data gravada de cada programação é a da compra, não a da entrega; uma entrega dividida depois não aparece aqui.
- **Data**: a criação da solicitação; no rascunho, a criação dele (antes mostrava a última alteração).
- Nomes longos de cliente em até duas linhas, com "mais" para o texto completo (`ClampText`). Células mais baixas (`px-2 py-1.5`); a tabela rola de lado no computador e no iPad, e a página não.

### Próxima ação e quem age

Duas linhas: a ação e, embaixo, quem deve agir ("João Cliente · Cliente", "Comprador (3) · Wellmix", "3 parceiros · Fornecedor"). Tocar no responsável abre os nomes autorizados e o que falta. O login (e-mail) só aparece para o administrador, como na Equipe Externa.

Origem (`src/lib/request-responsible.ts` e `src/lib/services/request-responsible.ts`). Nada é gravado; é a mesma regra que põe a ação nas Pendências:

- **Cliente**: os logins que podem confirmar a venda (`confirmersOf`: o "Login do cliente com acesso" escolhido, ou todos os do cliente quando marcado).
- **Wellmix**: quem tem a função ou a tela da etapa pela porta das Pendências (`kindGate`). Enviar para cotação vai para quem abre Encomendas; Encomenda nova, para quem abre Encomendas menos quem escolhe a estratégia. As demais etapas seguem pela ação: escolher e aprovar a estratégia, gerar o pedido direto, escolher, decidir e aprovar a cotação, decidir a resposta do fornecedor e validar a amostragem.
  - Uma pessoa aparece pelo nome. Uma função só, com várias pessoas, aparece pela função e quantidade; mais de uma função, pela quantidade.
  - Ficam de fora os logins suspensos, quem saiu da equipe e os administradores. Os administradores aparecem à parte: "também podem agir".
- **Fornecedor**: o parceiro convidado da cotação (cada um com o prazo dele), o da solicitação ao fornecedor (negociação) e o da amostragem, com os logins ativos dele.
- **O Analista não entra**: é o analista vinculado à solicitação, escolhido pela divisão da linha.
- **"Responsável não definido"**, com a pendência de cadastro:
  - ninguém da equipe tem a função;
  - o cliente não tem login que confirme;
  - o parceiro não tem login (aparece a empresa com o aviso);
  - a etapa ainda não tem responsável no fluxo: "Gerar o pedido de compra" depois da amostragem (docs/TURNS.md, decisão 5).
- **Ações paralelas** (produtos da mesma solicitação em passos ou com responsáveis diferentes): a que vence antes fica na célula, e "N ações" abre a lista com cada ação, quem age, quantos produtos e o prazo.
- **Sem ação pendente** (excluída, pedido cancelado, encerrado): o estado.
- **Rascunho**: "Concluir e enviar", com quem o salvou (quem vê).

### Prazo

O prazo da pendência da etapa atual, o mesmo das Pendências (`stepDue`):

- **Cotação**: o prazo do convite de cada parceiro (o mais próximo).
- **Negociação na solicitação ao fornecedor, para responder ou para decidir**: o SLA dela.
- **Amostragem a enviar**: o SLA da amostragem.
- **Pedido**: o prazo do marco.
- **Demais etapas**: não têm prazo próprio; vale o prazo de resposta da solicitação.

A hora aparece nos prazos de SLA. Vencido: em vermelho, com "Etapa atrasada".

### CSV

O CSV usa os mesmos cards e filtros, por solicitação (cada linha continua sendo um produto) e com os rascunhos de quem exporta. Depois de "Com quem" vêm três colunas novas:

- **Responsável**: todos os nomes e a parte.
- **Prazo da ação**: AAAA-MM-DD ou AAAA-MM-DD HH:MM.
- **Login do responsável**: só para o administrador.

Os totais continuam no fim.

### Testes

- `tests/unit/request-list-cards.test.ts`: o exemplo de produção (2 enviadas, uma de 2 produtos, e 2 rascunhos dão Total 4, Abertas 2 e Rascunhos 2), card × contagem, Atrasadas por dia e por hora, busca por número e "#", "Com quem está" com ações paralelas e o tipo.
- `tests/unit/request-responsible.test.ts`: porta de cada passo, prazo da pendência, cliente, equipe, parceiros, sem atribuição e chave das ações paralelas.
- `tests/unit/request-list-people.test.ts`: número do rascunho ao enviado e diretório de pessoas (sem admin, suspenso ou quem saiu; login só para o admin; confirmação do cliente e logins do parceiro).
- E2E: `turns.spec.ts` (o responsável "João Cliente · Cliente"), `order-terms.spec.ts` (o número do rascunho no card Rascunhos e repetido no envio), `requests-composition.spec.ts` e `requests-totals.spec.ts` (cabeçalhos curtos, sem MOQ nem Pedido).

## 7. Detalhes do rascunho: a mesma tela da solicitação enviada (dono, 19/11/2026)

Pedido do dono (19/11/2026, com os prints da lista, do rascunho e da Solicitação nº 6): em Encomendas, clicar no número do rascunho abria o formulário da Nova solicitação, e clicar no número de uma solicitação aberta abria a página de detalhes. O número e o ícone passam a abrir a mesma estrutura de detalhes para os dois.

Revisão do dono (19/11/2026): a nº 3, da AFC, abria "Solicitação nº 3", e o nº 5, da Campineira, em rascunho, abria o formulário. A tela de detalhes existente é que passa a carregar o rascunho, sem página paralela.

### 7.1 A causa da diferença

Os vínculos reais em produção mostram a divergência:

| | Nº 3 (AFC) | Nº 5 (Campineira) |
| --- | --- | --- |
| Tabela | `requests` (sem lote) | `request_drafts` (tela TS, 1 produto) |
| Link do número na lista | `solicitationHref` → `/app/requests/batch/<id>` | o `href` de `listDraftsForList` = `draftResumeHref` → `/app/new-request/ts?draft=<id>` |
| Destino | a página de detalhes (busca o lote; sem lote, a solicitação pelo id) | o formulário de edição |

- O número exibido não entra na rota: os dois links usam o id do registro, e não há confusão entre o número e os ids de solicitação, lote, produto ou rascunho. A diferença era o ramo "rascunho" da linha na lista.
- O rascunho não tinha tela de detalhes: ele é o formulário guardado em `request_drafts` (pares campo → valor), e a página de detalhes só lia `requests`.

### 7.2 O que mudou

- **Uma tela só, a mesma rota**: o número e o ícone do rascunho levam a `/app/requests/batch/<id do rascunho>`, o mesmo endereço e a mesma página das enviadas (`src/app/app/requests/batch/[groupId]/page.tsx`). A página procura o lote, depois a solicitação pelo id e, sem nenhum dos dois, o rascunho de quem vê (`loadDraftDetails`, `src/app/app/requests/_details/draft-details.ts`). Sem nenhum, 404.
- **O mesmo esqueleto** (`RequestDetailsScreen`, `src/app/app/requests/_details/details-view.tsx`): cabeçalho (número, cliente, data, situação, próxima ação e quem age), avisos, resumo (produtos, programações e containers), totais e tabela de produtos (foto, produto, peças por caixa, peças, caixas, inner, CBM, MOQ, preço, programações, situação, prazo e pedido).
  - O que é do estado de rascunho fica em `src/app/app/requests/_details/draft-screen.tsx`. A solicitação enviada passa pelo mesmo esqueleto, com a mesma marcação e os mesmos atributos de antes.
  - A conta é a de sempre: `request-packing.ts` e `request-totals.ts`.
- **Na lista**: o número e o ícone do rascunho (`data-request-draft-open` e `data-request-list-draft-open`) têm o mesmo destino e a mesma aparência das enviadas. "Continuar edição" fica nos detalhes.
- **Quem age também na enviada**: a Próxima ação do cabeçalho ganhou a 2ª linha da lista ("3 pessoas · Wellmix", com o balão dos nomes), pela mesma regra (`ResponsibleTip`, `src/components/request-responsible-tip.tsx`, usado pela lista e pela tela de detalhes).

### 7.3 A tela do rascunho

- **Cabeçalho**: "Solicitação nº N · X produtos" com o número persistente. Rascunho antigo, sem número: "Rascunho · X produtos", e o número não é criado ao abrir. Depois vêm o cliente (o nome atual do cadastro; senão o salvo; sem cliente, "Sem cliente"), a data em que foi criado, o selo "Rascunho" e "Próximo passo: Concluir e enviar", com quem o salvou ("Ana Admin · Wellmix"; o login só para o administrador).
- **Aviso privado**: "Rascunho salvo por você; só você vê. Nada foi enviado…", com a data do último salvamento. O administrador que abre o rascunho de outro login vê "Rascunho salvo por X. Você vê porque é administrador; só X continua a edição e envia" (seção 9).
- **"Continuar edição"**: o formulário da tela de onde o rascunho veio (`draftResumeHref`), com tudo o que foi salvo, só para quem salvou. O envio continua só por lá, com as validações de sempre.
- **Totais e tabela**: os dados disponíveis, mesmo incompletos. O que falta aparece como "—", e o total com algum produto sem o dado leva "Total parcial". O preço total é "—": a previsão de venda só é gravada no envio. Os containers são "—" quando algum produto ainda não tem quantidade, porque a conta sairia menor do que é.
- **Situação por produto**: "Rascunho". O produto sem produto escolhido, sem nome ou sem quantidade também leva "Incompleto", como no formulário.
- **Sem etapa, prazo ou pedido**: Prazo e Pedido mostram "—", com a dica "o prazo começa quando a solicitação é enviada". Não há SLA, pendência, "Enviar para cotação" nem excluir. A conversa do rascunho veio depois, na seção 8.
- **Detalhes de cada produto**: `/app/requests/batch/<id do rascunho>?item=<posição>`. Mostra o produto (catálogo ou "Fora do catálogo", com o link para a ficha no cadastro quando a pessoa abre Produtos). Também mostra a descrição, a especificação, a quantidade digitada e a embalagem, cada número com a origem: Rascunho, Variação, Ficha atual, Calculado, Programação, Negociação ou Book do produto. Seguem a programação, entrega por entrega, e as empresas do grupo econômico. A tabela mostra só esse produto, com "Ver todos os N produtos do rascunho".
- **Quantidade em branco × zero**: uma entrega em branco aparece como "—" (com "Sem quantidade digitada nesta entrega"), e um zero digitado aparece como "0 un". O produto sem nenhuma quantidade digitada fica sem peças, caixas, inner e cubagem. A variação escolhida entra como no envio, só na leitura: o nome "Produto · Variação", a cópia dos valores e a especificação dela quando o rascunho não tem. Assim a embalagem bate com a que a solicitação terá.

### 7.4 Privacidade e só leitura

- **Quem abre** (`getDraftForDetails`, `src/app/app/requests/_details/draft-details.ts`) é a mesma regra de "Continuar": só quem salvou, da Wellmix, e só se ainda abre a tela de onde o rascunho veio (`canDraft`). Fora disso, inclusive pela URL direta, a resposta é 404, sem dizer se o rascunho existe. Até 19/11/2026 o administrador não via o rascunho de outra pessoa; desde a seção 9, vê (só consulta).
- **A solicitação enviada vem primeiro**: o endereço só cai no rascunho quando não há lote nem solicitação com aquele id. Os ids são aleatórios (UUID), e as regras de visão das enviadas (`canViewRequest`) não mudaram.
- **Rascunho da entrada da Reposição**: fica de fora. Ele é da fila de Reposição, que continua abrindo o formulário.
- **Só leitura**: abrir lê o rascunho, o cliente, os produtos, as variações e a embalagem. Não grava, não reserva número, não audita, não avisa, não envia e não muda situação, contadores ou vínculos. O teste unitário compara o banco antes e depois (rascunhos, solicitações, auditoria e avisos), e o E2E confere os cards, o número e o sino.

### 7.5 Voltar para a lista como estava

- Ao abrir uma linha pelo número ou pelo ícone (`data-list-return`), a lista guarda nesta aba (`sessionStorage`, por 30 minutos; `src/lib/list-return.ts`) o endereço com a busca, os filtros, a ordem e a página do servidor. Guarda também a busca, a ordem e a página da tabela (TableTools com `returnKey`) e a rolagem.
- **"Voltar às solicitações"** (`ListReturnLink`), nos detalhes do rascunho e da solicitação enviada, leva a esse endereço. Sem nada guardado (link aberto direto, outra aba), leva à lista do início.
- **A lista, ao voltar** pelo link, pelo "Voltar" do topo ou pelo voltar do navegador, abre na mesma página da tabela, com a mesma busca e ordem, e na mesma rolagem (`ListReturnMemory`). Outra vista da lista (outro filtro) descarta o guardado, e a pessoa rolando interrompe a volta da rolagem. Os endereços dos links não mudaram.

### 7.6 "Continuar edição" mantém a divisão salva das entregas (corrigido em 19/11/2026)

Reabrir o rascunho no formulário ("Continuar" ou "Continuar edição") mostrava a quantidade de cada produto dividida por igual entre as entregas, no lugar da divisão salva: 720 / 480 / 240 voltava como 480 / 480 / 480, com o mesmo total. Se a pessoa salvasse de novo, a divisão salva se perdia. Foi o que aconteceu com o rascunho nº 5 em produção, às 19:39 de 19/11/2026: 22.320 / 22.320 / 22.320 / 18.000 virou 21.240 em cada entrega. O dono autorizou corrigir e restaurar.

- **Causa**: em `src/components/request-schedule.tsx`, com a programação do pedido (`fixed`, a da Nova solicitação), a quantidade inicial de cada entrega ignorava a programação gravada (`initial`) e repartia o total nas datas.
- **Correção**: a programação gravada volta como foi salva, entrega por entrega, quando tem o mesmo número de datas do pedido e alguma quantidade. Sem nenhuma quantidade, as entregas continuam em branco. Com outro número de datas, o total é repartido como antes. Vale também para "Editar a encomenda", que reabre a enviada pela mesma tela.
- Uma entrega em branco no meio volta como 0, como o envio também a conta.
- **Testes**: `tests/e2e/request-draft-details.spec.ts` reabre o rascunho e confere cada entrega (100 / 0 / 0 no copo, 720 em cada da boneca e o caso do nº 5, 22.320 / 22.320 / 22.320 / 18.000 com 465 / 465 / 465 / 375 caixas). Também salva de novo e confere que a divisão continua.

### 7.7 Testes

- `tests/unit/request-draft-details.test.ts`: leitura do que foi salvo, em branco × zero, totais parciais, containers "—", banco igual antes e depois, e privacidade (outro login, cliente, id inválido, Reposição, sem a tela).
- `tests/unit/list-return.test.ts`: só o endereço da própria lista, valores estranhos e os 30 minutos.
- E2E `tests/e2e/request-draft-details.spec.ts`. O caso do dono, pelo clique real no número: o rascunho de um cliente e a enviada de outro. Ida e volta pelo link, pelo voltar do navegador e pelo ícone, sem misturar os dados; atualizar a página; URL direta; "Continuar edição"; segue rascunho com o mesmo número e os mesmos cards; iPad. E, de ponta a ponta:
  - rascunho com vários produtos, programações e um produto incompleto; número e ícone com o mesmo destino;
  - cabeçalho, totais parciais, detalhes do produto (em branco "—", zero "0 un"), atualizar a página e voltar com o filtro e a rolagem;
  - cards, número e avisos iguais; "Continuar edição" com os produtos e os totais salvos;
  - iPad sem rolagem lateral da página; 404 para outro login da Wellmix e para o cliente.
- `tests/e2e/order-terms.spec.ts`: o ícone leva aos detalhes, e "Continuar edição" volta ao formulário.

## 8. Conversa ligada ao rascunho (dono, 19/11/2026)

Pedido do dono (19/11/2026, com o print de Encomendas): o ícone de mensagem também nos rascunhos. Decisão do dono: a conversa ligada ao rascunho, que passa para a solicitação quando ela é enviada (no lugar de uma conversa geral com o cliente ou de um ícone só desativado).

- **Onde**: na linha do rascunho em Encomendas, ao lado do ícone de abrir (como nas enviadas), e em cada produto dos detalhes do rascunho. É uma conversa só para o rascunho todo (`ChatOpenButton` com `draftId`; `data-chat-open="draft:<id>"`).
- **Com quem**: quem salvou o rascunho (Wellmix; também o administrador, na conversa dele, seção 9) e um login do cliente do rascunho, ativo e com a tela Mensagens (o painel lista os logins do cliente; com um só, abre direto). Sem cliente ou sem login, o painel avisa que não há com quem conversar.
- **Assunto**: "Solicitação #N (rascunho)", com o número reservado e o produto (`conversation_topics.kind = "draft"`, `draftId`). Fica na conversa privada dos dois. O cliente lê e responde em Mensagens; o aviso leva à caixa de Mensagens, porque a tela do rascunho é só de quem o salvou.
- **Privacidade**: abrir pelo rascunho segue a regra dos detalhes (`getListedDraft`: quem salvou, da tela de onde veio, e o administrador; outro login da Wellmix, o cliente ou login de outra empresa são recusados). O administrador lê as conversas, como sempre.
- **No envio**: o assunto passa a ser o da solicitação (a primeira do lote; `moveDraftTopics` no envio, antes de o rascunho sair), com as mensagens. O `draftId` fica anotado. Abrir a conversa pela solicitação acha o mesmo assunto.
- **Esquema**: coluna nova `conversation_topics.draftId` (opcional) e o índice `conversation_topics_by_draft`. O tipo "draft" entra em `TOPIC_KINDS` (no Supabase, `kind` é texto livre).
- **Testes**:
  - `tests/unit/draft-chat.test.ts`: o contexto e o assunto do rascunho, a mensagem lida pelo cliente, a privacidade e a passagem para a solicitação no envio.
  - `tests/e2e/draft-chat.spec.ts`: o ícone na lista e nos detalhes, a mensagem, o cliente lendo em Mensagens e, depois de enviar, a mesma mensagem na conversa da solicitação.

## 9. Administrador vê os rascunhos de todos (dono, 19/11/2026)

Pedido do dono (19/11/2026): o rascunho salvo por outro login não aparecia para os administradores, e "os ADMs têm que poder ver os rascunhos". Em produção havia três logins de administrador, e os rascunhos 4 e 5, salvos por dois deles, não apareciam para os outros.

- **Causa**: a lista de Encomendas, o CSV e a tela de detalhes liam só os rascunhos de quem vê (`request_drafts.userId` igual ao login).
- **Agora**:
  - **Lista de Encomendas** (`listDraftsForList(user, "requests")`): o administrador (`role = admin`) vê os rascunhos de todos os logins: os da Nova solicitação, de TS e de Venda. Os cards (Total, Rascunhos), a busca, os filtros e o CSV contam todos eles.
  - **Quem salvou**: a Próxima ação mostra quem salvou cada rascunho ("Concluir e enviar", depois "Otávio Operador · Wellmix"), na lista, no CSV e nos detalhes. O login (e-mail) aparece só para o administrador, como antes. Login que não existe mais: "—".
  - **Detalhes** (`/app/requests/batch/<id do rascunho>`, `getListedDraft`): abrem para quem salvou e para o administrador, também pela URL direta. Para o administrador, o aviso diz quem salvou e que só essa pessoa continua e envia (`data-draft-owner="other"`; para quem salvou, `"me"`).
  - **"Continuar edição"**: só para quem salvou (`DraftDetails.mine`, `ListedDraft.mine`). O formulário só reabre o rascunho do próprio login (`getRequestDraft`), e o envio continua sendo dele, com o mesmo número. Ver não é continuar.
  - **Conversa do rascunho**: o administrador também abre pelo ícone, na conversa dele com um login do cliente. No envio, todos os assuntos do rascunho passam para a solicitação.
- **Não muda**:
  - Quem não é administrador continua vendo só os seus rascunhos (lista, detalhes e URL direta, que responde 404).
  - A Reposição (`/app/replenishment`) continua com os rascunhos de quem vê: o rascunho dela abre direto no formulário, que é só de quem salvou.
  - Abrir continua só consulta: nada é gravado, numerado, auditado ou avisado.
- **Testes**:
  - `tests/unit/request-draft-details.test.ts`: o administrador abre o rascunho de outro login sem gravar nada, sem "Continuar" e com quem salvou; outro login e o cliente, 404; o formulário não reabre o rascunho para ele.
  - `tests/unit/request-screens.test.ts`: a lista do administrador com os rascunhos dos outros (quem salvou, `mine`); a de quem não é administrador, só os seus; a Reposição sem mudança.
  - `tests/unit/draft-chat.test.ts`: o administrador abre a conversa do rascunho de outro login, na conversa dele; outro login, não.
  - `tests/e2e/request-draft-details.spec.ts`: o rascunho do Otávio na lista da Ana (administradora), com quem salvou; os detalhes pelo número e recarregando, sem "Continuar edição"; o Otávio com "Continuar edição"; a Vera (que não é administradora) sem a linha e com 404 pela URL.

## 10. Resolver pelo balão "Quem pode agir" (dono, 20/11/2026)

Pedido do dono (20/11/2026, com o print de Encomendas, no login de administrador): no balão "Quem pode agir" que diz "Nenhum login do cliente pode confirmar…", um botão ali mesmo para criar o login e resolver a pendência. Decisões do dono:

1. **Formulário curto no balão**: Login (e-mail ou nome de usuário), Nome e Senha provisória, já sugeridos. Um toque em "Criar login do cliente" cria o acesso no cadastro do cliente e a encomenda passa a ter quem confirma. A tela mostra o login e a senha provisória para o administrador passar ao cliente, que troca a senha no 1º acesso.
2. **Botão também nos outros avisos** ("Sim, nos três"): parceiro sem login, ninguém com a função e cliente com login mas nenhum escolhido.

### Quem vê cada botão

A regra é `responsibleFix` (`src/lib/request-responsible.ts`). Quem não pode resolver vê o aviso como antes, sem botão. Gerar login continua só do administrador (docs/EQUIPE_ACESSOS.md, R5).

| Aviso                                                       | Botão                                                           | Quem vê                      | Leva a                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| Cliente sem nenhum login ativo                              | formulário "Criar login do cliente"                             | administrador                | o próprio balão                             |
| Cliente com login ativo, mas nenhum confirma esta encomenda | "Escolher o login na encomenda"                                 | Wellmix (quem troca o login) | `/app/requests/<id>#requester`              |
| Parceiro sem login                                          | "Criar o acesso de {parceiro}", um para cada parceiro sem login | administrador                | `/app/parties/<id>#access` (Equipe Externa) |
| Ninguém da equipe com a função da etapa                     | "Abrir Funções e acessos"                                       | administrador                | `/app/team?tab=functions`                   |
| Etapa sem responsável no fluxo ("Gerar o pedido de compra") | nenhum (decisão em aberto, docs/TURNS.md)                       | —                            | —                                           |

### Sugestões do formulário

Feitas no servidor (`fixDirectory`, `src/lib/services/request-fix.ts`); tudo pode ser trocado antes de criar:

- **Login**: o primeiro e-mail dos contatos do cliente (comprador, sócio, financeiro e fiscal, logística) ou o do cadastro que ainda não é login de ninguém. Sem e-mail, um nome de usuário pelo nome do cliente, com um número no fim se já for de alguém.
- **Nome**: o nome do cliente.
- **Senha provisória**: a mesma sugestão do cadastro do parceiro, com pelo menos 8 caracteres.

### O que acontece ao criar

Ação `createRequestCustomerLoginAction` (`src/app/app/actions/request-fix.ts`) e serviço `createCustomerLoginForRequest`:

- **Só o administrador**: o servidor confere. Outro papel recebe "Só o administrador cria o login do cliente."
- **O login nasce no cadastro do cliente** (`createPortalLogin`): papel Cliente, idioma pt e troca da senha no 1º acesso (`mustChangePassword`). Como no primeiro acesso de sempre, o cliente pode seguir sem trocar.
- **A encomenda passa a ter quem confirma**:
  - sem login com acesso escolhido, ela vale para todos os logins do cliente: nada a trocar;
  - no lote da encomenda, a que aguarda o cliente com um login com acesso que não confirma mais (inativo) passa para o login novo (`setRequester`, com o registro de sempre).
- **Pendências**: a "Definir o login do cliente que confirma" dos administradores some, e o cliente recebe "Confirmar pedido".
- **Auditoria**: `user.create`, como no cadastro, e `request.customer_login` na encomenda, com o login e quantas encomendas passaram a tê-lo. A senha não entra.
- **Erros com o motivo**: login já usado, login inválido, senha curta, encomenda ou cliente não encontrado. O que foi digitado continua nos campos.

### A senha não some antes de ser copiada

- A resposta mostra o login e a senha provisória, com "Copiar login e senha" (endereço do portal, login e senha) e "Atualizar a tela".
- A tela só é relida em "Atualizar a tela". O balão com formulário fica aberto enquanto se digita (o mouse saindo não fecha). Fechado com Esc ou com um toque fora, ele guarda a resposta até a tela ser atualizada.
- A senha não vai no endereço da página nem fica gravada em lugar nenhum além da conta. Depois de atualizar a tela, ela não aparece de novo.

### Onde aparece

- Na lista de Encomendas (2ª linha da Próxima ação) e na página da encomenda (`/app/requests/batch/<id>`), pela mesma peça (`ResponsibleTip`).
- O balão com botões vira um diálogo (`InfoTip` com `interactive`). Funciona com toque, mouse e teclado: Enter abre e leva o foco para dentro; Esc fecha e volta ao nome.
- **Tela baixa** (iPad em janela menor ou com o teclado aberto; dono, 20/11/2026): o balão abre embaixo do nome ou, sem espaço, em cima. Se não couber em nenhum dos dois lados, ocupa a altura visível da tela e rola por dentro, para o formulário aparecer inteiro. A conta usa a parte visível da tela (`visualViewport`) e refaz a posição quando ela muda. Antes, o balão passava do fim da tela e o resto não aparecia.
- O rascunho não muda: quem age nele é sempre quem o salvou.
- O selo "Sem responsável definido" da coluna Situação continua só um selo, sem balão. Em 20/11/2026 ele chegou a abrir o mesmo balão da Próxima ação (PR #600), e o dono pediu para desfazer no mesmo dia (PR seguinte). Quem resolve continua usando o "Responsável não definido" da Próxima ação ou a pendência "Login do cliente a definir".

### Nas Pendências

Pedido do dono (20/11/2026, depois do balão): o mesmo formulário nas Pendências. A pendência "Login do cliente a definir" é do administrador e aparece também no início do portal. Ela ganha, embaixo do detalhe:

- **Cliente sem nenhum login ativo**: "Criar login do cliente…" abre o mesmo formulário num balão, com as mesmas sugestões, a mesma ação e a mesma resposta (login e senha provisória, "Copiar login e senha" e "Atualizar a tela").
- **Cliente com login, mas nenhum que confirme**: "Escolher o login na encomenda".

Criado o login e atualizada a tela, a pendência some. A regra é a mesma do balão (`responsibleFix`), por encomenda da pendência (`taskFixes`, `src/lib/services/request-fix.ts`).

### Testes

- `tests/unit/request-responsible.test.ts`: o botão de cada aviso e quem o vê.
- `tests/unit/request-fix.test.ts`:
  - a sugestão pelo e-mail do comprador, só para o administrador;
  - o login criado com a troca no 1º acesso, quem confirma, as pendências e a auditoria sem a senha;
  - o lote com o login inativo passa para o novo;
  - "Escolher o login na encomenda" quando o cliente já tem outro login;
  - os erros;
  - nas Pendências, o formulário ou o "Escolher o login" só para o administrador, e a pendência que some depois de criar o login.
- `tests/e2e/turns.spec.ts`: um cliente novo sem login recebe uma venda; no balão, o formulário com as sugestões e o login criado; fechar e abrir sem perder; "Atualizar a tela" mostra quem confirma; o cliente entra com a senha provisória e acha "Confirmar pedido". Nas Pendências, o mesmo formulário pela pendência "Login do cliente a definir", que some depois de criar o login.

## 11. Encomenda confirmada: a pendência reconhecível e a ação rápida no selo (dono, 20/11/2026)

Pedido do dono (20/11/2026, com o print de Encomendas): a encomenda nº 9, confirmada pela cliente ("Aguardando Wellmix"), "nem apareceu nas Pendências", e a Situação deveria deixar seguir dali.

- **Pendências**: a pendência existia, mas o título trazia só o produto ("Enviar para cotação: BERCO DE BONECA 17CM X 30CM"), sem o número da encomenda nem o cliente. Agora:
  - título: "Enviar para cotação: encomenda nº {N} · {cliente}";
  - detalhe: o produto e a quantidade.

  Encomenda sem número segue como antes. A regra de quem recebe não muda: quem abre Encomendas, o Comprador também (docs/PURCHASE_DEMAND.md). Fica em `src/lib/services/tasks.ts`, com os textos `strategy.task.toSend.titleNumbered` e `detailProduct`.
- **Ação rápida no selo**: na lista de Encomendas, o selo "Aguardando Wellmix" da encomenda que espera o "Enviar para cotação" vira botão para quem pode enviar (Wellmix, a mesma regra da seleção em massa).
  - O balão mostra "Próxima ação: Enviar para cotação" e o botão "Enviar para cotação".
  - Um toque envia a encomenda inteira para a Estratégia de compra (`sendToStrategyAction`, as mesmas regras e a mesma mensagem de envio).
  - Enviada, a vez segue na Estratégia de compra e o selo volta a ser só o selo.
  - Para quem não pode enviar e nas outras situações, o selo fica como era. Componente: `SituationQuickSend` (`src/components/request-quick-action.tsx`).
- **Não é o selo desfeito da seção 10**: aquele repetia no selo o balão "Quem pode agir" da Próxima ação e foi desfeito a pedido do dono. Este faz a próxima ação.
- **Testes**:
  - `tests/unit/strategy-send.test.ts`: o título e o detalhe da pendência;
  - `tests/e2e/turns.spec.ts`: a venda confirmada pelo cliente, a pendência com o nº, o selo que envia num toque e a vez na Estratégia de compra.
