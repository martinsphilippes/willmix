# Ficha completa da solicitação (seção "Solicitações")

Pedido do dono (15/11/2026, com a foto da Solicitação nº 1 do bastão lança-bolhas no iPad, login Comprador / Operador Wellmix): a tabela da seção "Solicitações" cortava colunas e só repetia o texto da especificação. Agora cada produto tem uma linha com os dados principais e **"Ver ficha completa"**, com tudo o que o portal já sabe do produto: o que a solicitação gravou, o pedido, a negociação, o Book e a ficha atual do cadastro, cada dado com a origem.

Revisão do dono (15/11/2026, modelo "Linha de visão de produto", `docs/LINHA_DE_VISAO.md`): a ficha completa abre **em linha horizontal**, não em quadros embaixo da linha. O botão fica no alto da tabela e abre todas as linhas juntas (opção A); no celular, a linha resumida é um cartão e a ficha completa é a mesma linha horizontal, rolando dentro da tabela.

## 1. Onde e como funciona

- **Tela:** `/app/requests/<id>`, cartão "Solicitações".
- **Uma linha por produto:** esta solicitação e, se ela faz parte de um lote (Nova solicitação com vários produtos), as outras do lote que o login vê, na ordem em que foram criadas. A linha desta solicitação diz "Esta solicitação"; as outras têm o link "Abrir a solicitação →" embaixo do nome (na linha resumida e na ficha completa).
- **Dados principais na linha (linha resumida):** produto (nome, SKU e variação), total de peças, caixas master, cubagem total, prazo de resposta, custo registrado, compra por peça e venda. Cada um aparece só para quem pode ver (seção 4). Dado que falta: **"—"** ("Não informado" na dica e no leitor de tela).
- **Botão no alto da tabela: "Linha resumida" | "Ver ficha completa".** Vale para todas as linhas de uma vez. É um link da mesma tela (`?ficha=completa#solicitacoes`), sem JavaScript: o endereço pode ser copiado e a tela volta aberta.
- **Ficha completa em linha horizontal:** a linha de cada produto continua para a direita com todos os campos dos quatro grupos, **Produto**, **Embalagem e cubagem**, **Valores** e **Pagamento**, nessa ordem, com uma faixa colorida do grupo em cima e o título de cada campo no cabeçalho. O produto fica fixo à esquerda enquanto a tabela rola; cada valor mostra a origem ao lado (selo) e a conta quando é calculado, recolhida no "ver mais" (seção 6.1, linha fina). As colunas são a união dos campos de todas as linhas: o campo que um produto não tem fica com "—" na linha dele.
- **Largura:** a página nunca rola de lado. Na linha resumida, pela largura do cartão (container query), a partir de ~900 px as linhas viram colunas com cabeçalho; no iPad (com o menu aberto) e no celular, cada linha vira um cartão com o título de cada dado. Na ficha completa, só a tabela rola de lado (iPad e celular também).
- **"Programação de compra":** continua abaixo da tabela, como antes, com a programação desta solicitação. O total de peças da linha é o total dessa programação (seção 3); a programação dos outros produtos do lote aparece na coluna "Total de peças" da ficha completa de cada um ("2 programações: 1.000 + 1.000").
- **Anexos, solicitante do cliente e NCM:** como antes, abaixo.

## 2. Origem de cada dado

Cada valor tem um selo com a origem. A ordem de prioridade é sempre a mesma: **o que a solicitação gravou vem primeiro**; o que falta vem do pedido, da negociação, do Book e, por último, da **ficha atual** do produto.

| Selo                    | O que é                                                      | De onde                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Solicitação             | Gravado nesta solicitação                                    | `requests` (descrição, especificação, observação, NCM, venda, sinal) e a cópia da variação pedida (`requests.variant`)                                 |
| Variação da solicitação | Cópia da variação no momento do pedido                       | `requests.variant` (caixa, pesos, CBM, material, cores, embalagem, preço, MOQ)                                                                         |
| Programação             | A programação de compra gravada                              | `requests.schedule`                                                                                                                                    |
| Pedido nº N             | O pedido da solicitação (quando já virou pedido)             | `orders`, `order_items` (preço de compra e de venda do produto), `purchase_sheets` do pedido (caixa, medidas, pesos, NCM, código na fábrica)           |
| Negociação nº N         | A solicitação ao fornecedor do produto                       | `supplier_requests` do produto: a do pedido; senão a aprovada; senão a respondida; senão a aberta (a mais recente). Canceladas e recusadas ficam fora. |
| Book nº N               | O item do Book (cotação da planilha)                         | `booking_items`: o da negociação escolhida; senão o mais recente do produto                                                                            |
| Superplan               | A análise do item do Book                                    | `booking_items.analysis` (custo nacionalizado, venda sugerida, margem)                                                                                 |
| Ficha atual             | O cadastro do produto hoje (a solicitação não gravou o dado) | `products` e a ficha mestre (`purchase_sheets` com `orderId` = id do produto), lidos como o Booking e o Superplan leem (`productPurchaseView`)         |
| Linha do produto        | Exigência da linha                                           | `product_lines.requiredCertifications` e `prompts.requiredAttributes`                                                                                  |
| Cadastro do fornecedor  | A condição de pagamento do fornecedor                        | `parties.paymentTerms` e `paymentTermsNote`                                                                                                            |
| Calculado               | Conta das regras do portal com os dados gravados             | caixas, cubagem, unitário a partir do total, totais                                                                                                    |

Sem nenhuma fonte: **"—"** ("Não informado" na dica e no leitor de tela). Medida zerada conta como não preenchida (a carga do Sankhya grava 0 no campo vazio).

### O texto da especificação

A especificação gravada na solicitação é lida linha por linha (`src/lib/request-spec-parse.ts`, sem inventar nada):

- "Título: valor" vira um campo com o título escrito ("Composição", "Faixa etária", "Cores", "Contém", "País de origem"…); linhas soltas (o título do produto, "3 Sortimentos de cores") ficam juntas em "Especificação".
- **Medidas com eixo e unidade:** os eixos vêm do que o texto declara: no cabeçalho ("Dimensões (A x L x P)" vale para as linhas seguintes até a linha em branco), no título ou no fim do valor ("13 × 19 × 15 cm (C × L × A)"). A = altura, L = largura, P = profundidade, C = comprimento, D/Ø = diâmetro, E = espessura (em inglês L × W × H; em chinês 长 × 宽 × 高). "Dimensões do produto (cm): 20 × 11 × 35.1", que a Nova solicitação escreve com as colunas do cadastro, é comprimento × largura × altura. Uma linha com o nome de um eixo ("Diâmetro: 10 cm") é aquela medida. Sem eixo declarado ("Dimensões: 5cm x 5cm x 5cm"), a medida aparece como está, com "A especificação não diz os eixos"; sem unidade, "A especificação não diz a unidade".
- **Pesos e caixa:** "Peso líquido (kg)", "Peso bruto", "Peso por unidade: 0,011 kg líquido · 0,054 kg bruto", "Unidades por caixa master", "Unidades por inner box" e "Caixa master: 48 peças · 4 por caixa interna · 52 × 34 × 68 cm · 0,1202 m³" viram os números da ficha, com o selo "Solicitação".
- O que o texto da solicitação não tem e a especificação do cadastro tem (pelo título) entra com o selo "Ficha atual". Material, cores, Pantone, embalagem, capacidade, energia e categoria entram da ficha atual só quando nenhum dos dois textos fala deles.

## 3. Os grupos da ficha

### Produto

- **Identificação** (Wellmix): Código (SKU), Código no Sankhya, Código na fábrica, EAN, NCM (o da solicitação, senão o do pedido, do Book ou da ficha atual), Linha do produto, Marca. Para todos: Variação, Descrição e Observação (da solicitação).
- **Especificações:** as linhas da especificação (seção 2) e os complementos da ficha atual.
- **Exigências da linha do produto** (quando a linha tem): os atributos que a ficha deve ter (cada um com o valor achado ou "—") e as certificações exigidas.
- **Medidas e pesos da peça:** as medidas da especificação com eixos e unidade; sem elas, as da variação, da negociação, do Book (SIZE LENGTH/WIDTH/HEIGHT do Book são as medidas da **peça**, decisão do dono de 15/11/2026, docs/SUPPLIER_REQUESTS.md) ou da ficha atual (comprimento × largura × altura do cadastro). Peso líquido e bruto por peça.

### Embalagem e cubagem

- **Total de peças:** a soma da programação gravada (selo "Programação", com a lista "2 programações: 1.000 + 1.000"); sem programação, a quantidade da solicitação. Em caixas (unidade CX, CTN…), peças = caixas × peças por caixa (Calculado). Se a quantidade gravada na solicitação for diferente da soma da programação, a linha mostra o aviso e a ficha usa a programação.
- **Peças por embalagem interna** e **peças por caixa master** (solicitação → variação → pedido → negociação → Book → ficha atual).
- **Quantidade de caixas master (Calculado):** com programação, uma conta por programação, cada uma em caixas inteiras para cima (a regra do gerador: `cartonsFromPieces`), e a soma; sem programação, peças ÷ peças por caixa, para cima. Em caixas, é a quantidade gravada.
- **Medidas da caixa master** (comprimento × largura × altura) e **cubagem por caixa**: o CBM gravado na fonte; sem ele, das medidas da caixa da mesma fonte (Calculado, "Das medidas da caixa (fonte)"). Desde 19/11/2026 (dono; a mesma regra da Estratégia de compra), só o CBM da caixa contada: quando a fonte do CBM diz outra quantidade de peças por caixa (o cadastro com a caixa de 60 e a variação pedida com 24), ele fica de fora, com a nota "O CBM de Ficha atual é de uma caixa de 60 peças, e a conta usa caixas de 24: fica de fora"; a fonte que não diz de quantas peças é a caixa continua valendo (`cbmForBox` em `src/lib/services/request-packing.ts`). As medidas da caixa vêm só do texto da solicitação, da ficha de compra do pedido e da ficha atual: o Book e a negociação não trazem as da caixa (as deles são da peça), então o CBM deles é o gravado, nunca o volume da peça.
- **Cubagem total (Calculado):** caixas × cubagem por caixa, em m³ com 4 casas. Desde 18/11/2026 a conta usa o m³ da caixa como foi gravado (0,1476375, não 0,1476: preservar as casas decimais, pedido do dono), e a ficha mostra a cubagem por caixa com até 7 casas, para a conta escrita bater com o total.
- **Pedido mínimo (peças)** (Wellmix): o da variação; senão o da ficha mestre ou do cadastro.

### Valores

- **Venda ao cliente:** venda por peça e venda total. Do pedido (preço do produto em `order_items.sellUnitPrice`, ou o total do pedido de um produto só); senão da solicitação (`requests.sellPrice`, que é o total). O unitário a partir do total é Calculado ("R$ 1.000,00 ÷ 2.000 peças").
- **Compra com o fornecedor:** cotação do Book (por peça), preço negociado (por peça, com a situação da negociação), contraproposta da Wellmix em aberto, compra no pedido (por peça), compra total (o FOB do pedido; senão o melhor preço por peça × peças, Calculado, dizendo de onde veio o preço) e Incoterm.
- **Custo interno:** custo registrado por peça (o da variação pedida; senão o da ficha atual), total pelo custo registrado (Calculado), faixas de preço do cadastro e, quando há análise do Superplan, custo nacionalizado, venda sugerida e margem prevista.
- Os rótulos dizem sempre se o valor é **por peça** ou **total**; a moeda vem com o valor (US$, R$, CN¥ para RMB).

### Pagamento

- **Compra com o fornecedor:** fornecedor (do pedido, da negociação ou da ficha atual), condição de pagamento em parcelas (a do pedido; senão a do cadastro do fornecedor), forma de pagamento (a observação da condição do fornecedor, ex. "T/T"), sinal (as parcelas na data do pedido, com o valor sobre a compra total quando ela existe), parcelas, prazo da última parcela, condição do pedido no Sankhya e prazo de produção (da negociação).
- **Venda ao cliente:** a **forma de pagamento do cliente** escolhida no pedido (docs/CUSTOMER_PAYMENT.md, `orders.customerPaymentPlan`), com o selo "Pedido nº N" e a situação da alçada (Aprovada, Em aprovação, Recusada); as **parcelas do cliente** por evento ("10% no pedido (R$ 1.000,00)", "90% no embarque…"), com o valor sobre a venda do pedido e os juros depois da entrega, como na tela do pedido; o **sinal do cliente** (o gravado na solicitação, `requests.downPaymentAmount`; sem ele, as parcelas "no pedido" da forma) e o **prazo da última parcela**. Quem vê é a regra do pedido (`customerPaymentView`): o cliente só a forma aprovada; a Wellmix, quem vê valores e margem. Pedido sem forma escolhida (ou solicitação sem pedido): "—".

## 4. Permissões (no servidor)

O carregador (`loadRequestSheet`) só lê o que o perfil pode ver, e o montador só escreve o que o perfil vê: o que fica de fora não sai do servidor.

| Perfil                                                                                                                                                            | Vê                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wellmix com "Ver valores e margem" (`values.view`; o administrador sempre)                                                                                        | Tudo.                                                                                                                                                                                                                                                                                                             |
| Wellmix com "Ver preço de compra" (`purchasePrice.view`; padrão: comprador, gerente de produto, planejamento, diretorias, financeiro), sem "Ver valores e margem" | Produto e Embalagem e cubagem completos; em Valores, a compra com o fornecedor e o custo registrado (o preço da última compra) com as faixas; em Pagamento, a compra com o fornecedor. Sem venda, sem a análise do Superplan (custo nacionalizado, venda sugerida, margem) e sem a forma de pagamento do cliente. |
| Wellmix sem nenhuma das duas                                                                                                                                      | Produto e Embalagem e cubagem completos (códigos, caixa, medidas, cubagem e ficha atual, como no Histórico de compras). Valores e Pagamento ficam fora da ficha completa, com o aviso de quem vê embaixo da tabela. Sem custo, compra, venda nem condições na linha.                                              |
| Login do cliente (só as solicitações dele)                                                                                                                        | O que a solicitação dele gravou (descrição, variação, especificação, medidas e pesos do texto), total de peças, programação, venda e sinal dele. Nada do cadastro, do Book, da negociação, do fornecedor, nem custo ou compra.                                                                                    |

Desde 15/11/2026 (docs/LINHA_DE_VISAO.md, seção 7), a compra com o fornecedor, o custo registrado e as condições do fornecedor seguem "Ver preço de compra" (`canSeePurchasePrice`); a análise do Superplan e a venda continuam só com "Ver valores e margem"; o cliente vê a venda dele.

Exceção desde 22/11/2026 (decisão do dono; docs/ECONOMIC_GROUPS.md, "Caixas, cubagem e containers por programação"): o login do cliente vê as caixas master, a cubagem e os containers de cada programação da solicitação dele, na Programação de compra e na tabela das empresas do grupo. A ficha continua sem a embalagem para ele (códigos, caixa, medidas, cubagem e ficha atual).

## 5. O que já é preenchido automaticamente

Sem ninguém digitar nada, a ficha já traz:

- **Do texto da solicitação:** todas as linhas da especificação, as medidas com eixos e unidade, pesos, peças por caixa e caixa interna, medidas e CBM da caixa quando escritos.
- **Da programação:** o total de peças e a lista das programações.
- **Do cadastro (ficha atual):** SKU, código no Sankhya, código na fábrica, EAN, NCM, linha, marca, material, cores, Pantone, embalagem, capacidade, energia, medidas da peça, pesos, peças por caixa e por caixa interna, medidas e CBM da caixa, pedido mínimo, custo registrado e faixas de preço, fornecedor.
- **Da linha do produto:** certificações exigidas e atributos obrigatórios.
- **Do Book, da negociação e do pedido**, quando existem: cotação, negociado, contraproposta, compra no pedido, Incoterm, prazo de produção, caixa e CBM, condição de pagamento do pedido, venda por produto.
- **Calculados:** caixas master (por programação), cubagem total, compra total, total pelo custo registrado, venda por peça a partir do total, sinal em valor.

## 6. Validação com os dados de produção (15/11/2026)

Conferido com os registros do Supabase (o montador da ficha rodando sobre as solicitações reais, nos três perfis: administrador, operador sem "Ver valores e margem" e cliente):

- **Solicitação nº 1 (bastão lança-bolhas, WB12112), sem preço negociado:** "Dimensões (A x L x P) / Lança Bolhas: 14,5cm x 3,5cm x 2,5cm" → "Altura 14,5 cm · Largura 3,5 cm · Profundidade 2,5 cm" (Solicitação). Composição, faixa etária, cores, conteúdo e país de origem (Solicitação). Programação 1.000 + 1.000 → 2.000 peças. 192 por caixa master e 24 por embalagem interna (Ficha atual) → 6 + 6 = 12 caixas (Calculado: cada programação de 1.000 peças fecha em 6 caixas). Pesos 0,0112 / 0,0536 kg, NCM 95030099, EAN 7899527199518, Sankhya 12112, linha LANCA BOLHAS, marca WELLKIDS, fornecedor HUADA TOYS (Ficha atual). Custo registrado US$ 0,0809 por peça (Ficha atual) e US$ 161,80 pelo custo registrado (Calculado), só com "Ver preço de compra" (ou "Ver valores e margem"). Sem medidas nem CBM da caixa no cadastro: caixa, cubagem por caixa e cubagem total "—". Sem negociação, Book, venda, sinal ou condição do fornecedor (HUADA sem condição cadastrada): "—".
- **Solicitação nº 2 (vários produtos):** BONECA LIULY e CUBO INTERATIVO, duas linhas, cada uma com 24.000 peças (8.160 + 7.920 + 7.920) e 100 caixas de 240 (34 + 33 + 33). A boneca com os eixos do cabeçalho ("Altura 26,5 cm · Largura 6 cm · Profundidade 3 cm"); o cubo sem eixos declarados ("5 × 5 × 5 cm", com "A especificação não diz os eixos"). Custos US$ 0,1205 e R$ 0,6188 por peça (Ficha atual).
- **Solicitação nº 3 (BONECA ZOEY), sem preço negociado:** "Dimensões do produto (cm): 20 × 11 × 35.1" → "Comprimento 20 cm · Largura 11 cm · Altura 35,1 cm"; peso líquido 0,3728 kg e 6 peças por caixa master do texto (Solicitação); peso bruto 0,7333 kg (Ficha atual); 1.500 + 1.500 = 3.000 peças → 250 + 250 = 500 caixas (Calculado); custo US$ 3,5567 (Ficha atual); compra, venda e condições "—".
- **Operador sem "Ver valores e margem"** (o login da foto): as mesmas linhas com peças, caixas e cubagem; Valores e Pagamento fora da ficha, com o aviso embaixo da tabela. **Cliente:** peças, programação, o texto da solicitação e a venda (ainda "—"); nada do cadastro.

O que falta nos dados (para a ficha ficar completa sem digitação): medidas e CBM da caixa master (só 2 de 16.843 produtos têm), condição de pagamento dos fornecedores (a HUADA não tem) e, para a venda ao cliente, a forma de pagamento escolhida no pedido (só existe depois do pedido; docs/CUSTOMER_PAYMENT.md).

## 6.1 Linha fina na ficha completa (dono, 22/11/2026)

Pedido do dono, com o print da ficha completa no iPad (login de cliente, especificação longa do varal esticando a linha): "Essa linha da ficha completa tem que ficar ultra fina. 1 - onde tiver muito texto deixando grande na vertical, tem que receber o 'ver mais', tem que ficar colapsado, qualquer coisa que expanda muito. 2 - tem que ter a foto do produto na coluna inicial".

- **Uma linha por produto, da altura da foto:** na ficha completa, cada valor fica numa linha só. O texto que não cabe (até 20rem por coluna) termina em "…" com o **"ver mais"** ao lado, e a frase inteira aparece na dica do mouse. O "ver mais" abre só aquela célula: as quebras de linha do texto voltam e a **conta do valor** (a nota do calculado, por exemplo "300 caixas × 0,1202 m³") aparece embaixo; o "ver menos" fecha. Valor com conta sempre tem o "ver mais", mesmo quando cabe.
- **Origem ao lado do valor:** o selo ("Solicitação", "Ficha atual", "Calculado"…) fica na mesma linha, à direita do valor, e não mais embaixo.
- **Primeira coluna:** a **foto do produto** (miniatura de 36 px que amplia ao passar o mouse; sem foto, o quadro vazio do mesmo tamanho), o nome numa linha com "ver mais" e, embaixo, o código, a variação e "Esta solicitação" (ou o ícone de abrir a outra solicitação do lote). Os avisos da linha ficam numa linha só, em âmbar, com "ver mais".
- **A foto** é a primeira da vitrine do catálogo (`catalogShowcasePhotos`: a principal, depois a comercial, a original…; nunca o cartão do fornecedor nem a foto de referência). Fora da Wellmix (o cliente), só a de produto ativo e não escondido pelo Book, a mesma regra que libera o arquivo (`canAccessDocument`), para a miniatura não aparecer quebrada. Produto fora do catálogo: sem foto.
- **Linha resumida:** ganha a mesma foto antes do nome; o resto não muda.
- **O texto não sai da página:** o que está recolhido só fica escondido, então a busca da página, o leitor de tela e os testes leem igual.
- **Peças:** `ClampText` (`src/components/clamp-text.tsx`) ganhou `preserveLines` e `detail`; `ProductThin` e `ThinValue` em `src/components/request-sheet-table.tsx`; `photoId` na linha (`sheetPhotos` em `src/lib/services/request-sheet.ts`); textos `requestSheet.more` e `requestSheet.less` ("ver mais"/"ver menos").
- **Testes:** `tests/unit/request-sheet.test.ts` (a foto da vitrine, nunca o cartão; o cliente só a de produto ativo) e `tests/e2e/request-sheet.spec.ts` (a miniatura na primeira coluna, a linha com até 64 px e o "ver mais" abrindo e fechando a conta).

## 7. Peças

- `src/lib/services/request-packing.ts` (18/11/2026): a regra de peças, peças por caixa, caixas (por programação), inner, medidas e cubagem da caixa e pedido mínimo, com a origem de cada número (`resolvePacking`), a lista única de fontes (`packingCandidates`, também da Estratégia de compra) e a escolha da negociação e do Book (`pickNegotiation`, `pickBook`). É a mesma conta da lista de Encomendas, da página da encomenda e do CSV (docs/ORDER_LEVEL_LISTS.md, seção 5); a ficha só escreve os textos e as notas.

- `src/lib/request-spec-parse.ts`: leitura da especificação (pura).
- `src/lib/services/request-sheet.ts`: permissões (`sheetAccess`), o montador puro (`buildSheetRow`) e o carregador (`loadRequestSheet`).
- `src/components/request-sheet-table.tsx`: a tabela (linha resumida, ficha completa em linha horizontal, selos, container queries).
- `src/app/app/requests/[id]/page.tsx`: o cartão "Solicitações" usa a tabela nova no lugar da linha antiga (`RequestInfoTable`, que continua no código).
- Textos: `src/i18n/modules/request-sheet.ts` (pt/en/zh).
- Testes: `tests/unit/request-sheet.test.ts` (especificação, bastão nº 1, negociação e Book, lote, permissões) e `tests/e2e/request-sheet.spec.ts` (lote com dois produtos, ficha completa em linha horizontal, cliente, administrador, Comprador, Vendas, celular e iPad sem rolagem de lado).

## 7. O produto neste pedido, sem a tabela (dono, 23/11/2026)

Pedido do dono: a tela de um produto (`/app/requests/<id>`) estava mostrando todos os produtos do pedido na tabela da ficha; ali é o detalhamento **daquele** produto, e a tabela nem é necessária.

- **Só o produto da tela**: `loadRequestSheet` é chamado sem as outras solicitações do lote. Os outros produtos ficam na página do pedido (`/app/requests/batch/<id>`), que tem a tabela padrão de itens (docs/ORDER_TABLES.md); o aviso "este pedido tem N produtos" segue levando a cada um.
- **Sem tabela nem "Ver ficha completa"**: `src/components/request-product-sheet.tsx` mostra, no alto, a foto, o código, a variação, o prazo e os números principais (peças, caixas master, cubagem, custo registrado, compra e venda) e, embaixo, um quadro por grupo da ficha (Produto, Embalagem e cubagem, Valores e Pagamento), cada dado com a origem e a conta. O endereço `?ficha=completa` deixa de mudar a tela (tudo já aparece).
- **Mesmos dados e mesmas permissões** da ficha (seções 1 a 6): o que o perfil não vê não sai do servidor; o grupo que ele não vê mostra o aviso. O preço de compra nunca aparece para o cliente (docs/ORDER_TABLES.md, seção 4).
- **Conversa à vista**: na lateral, fixa na rolagem, o quadro "Conversa" com as últimas mensagens da solicitação que o login pode abrir (`src/lib/services/request-chat-preview.ts`, só leitura: não cria assunto nem marca como lido) e o botão de conversar, que abre a caixa do chat de sempre. Abaixo dela, a Classificação fiscal (NCM) da Wellmix.
- **Embaixo dos quadros**: "Programação, condições e anexos" (empresas do grupo econômico, programação de compra, condições do pedido, anexos e o solicitante do cliente), como antes.
- A tabela `RequestSheetTable` continua no código (não é mais usada nesta tela).
