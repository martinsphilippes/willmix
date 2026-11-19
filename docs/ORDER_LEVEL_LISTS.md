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
