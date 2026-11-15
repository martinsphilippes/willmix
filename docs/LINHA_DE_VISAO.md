# Linha de visão de produto

Modelo padrão para mostrar produtos em qualquer tela do portal, aprovado pelo dono em 15/11/2026. Quando o dono pedir "use a linha de visão de produto nesta tela", siga este documento: as colunas, a ordem, a ficha completa, a origem de cada dado, as regras de dado ausente e quem vê.

Antes do modelo, o inventário dos campos de produto foi conferido no código e nos registros reais do Supabase (15/11/2026). Os pontos que mudaram o modelo estão na seção 9.

## 1. Linha

- Uma linha por produto do contexto da tela. Produto com variações: **uma linha por variação**, com o nome dela junto do produto.
- Cores e rodadas da programação ficam na ficha completa (seção 3), não em linhas separadas.
- A ordem das colunas é a mesma em todas as telas. Uma coluna só sai quando não vale para a etapa ou quando o login não pode vê-la (seção 7).

## 2. Colunas da linha resumida, nesta ordem

| # | Coluna | Unidade e formato | De onde vem |
| --- | --- | --- | --- |
| 1 | Produto | foto, nome · variação; embaixo, CODPROD · código da fábrica | Ficha atual; código da fábrica do Book ou da negociação |
| 2 | NCM | 8 dígitos com pontos (6911.10.10) | o validado no cadastro; senão pedido, negociação ou Book |
| 3 | Material | texto | origem da tela (seção 4) |
| 4 | Embalagem | texto (tipo: color box, PVC bag…) | origem da tela |
| 5 | Cores | texto do sortimento | origem da tela |
| 6 | Peça C × L × A | cm, 1 casa (comprimento × largura × altura) | origem da tela; as medidas do Book são da **peça** |
| 7 | Capacidade / tamanho | ml ou o texto da planilha ("4X6 / 10 X 15") | origem da tela |
| 8 | Peso líq. / bruto | kg por peça, 3 casas | origem da tela |
| 9 | Pç/caixa master · inner | peças | origem da tela |
| 10 | CBM/caixa | m³, 4 casas | o gravado; senão calculado das medidas da caixa master da mesma fonte; nunca pelo volume da peça |
| 11 | MOQ | peças | negociação → Book → ficha atual |
| 12 | Peças | peças | solicitação, programação ou pedido |
| 13 | Caixas | caixas inteiras | Calculado: por rodada, arredondado para cima (`cartonsFromPieces`) |
| 14 | Cubagem | m³, 4 casas | Calculado: caixas × CBM/caixa |
| 15 | Compra por peça 🔒 | moeda e FOB/EXW, até 4 casas | a da tela: Book, combinada na negociação, do pedido ou do cadastro |
| 16 | Compra total 🔒 | moeda, 2 casas | FOB do pedido; senão Calculado (compra por peça × peças) |
| 17 | Coluna da etapa | conforme a tela (tabela abaixo) | — |
| 18 | Situação e Ações | selo da etapa e botões | da tela |

Coluna da etapa (17):

| Tela | Coluna |
| --- | --- |
| Book | Superplan 🔒 (veredito) |
| Solicitação ao fornecedor | Prazo de produção |
| Pedido | Venda por peça 🔒 |
| Programação | Data da rodada |
| Ficha de compra | I.I. / IPI |
| Inspeção | Conferido (medido × declarado) |
| Container | Caixas no container |
| Produtos (cadastro e listas) | Fornecedor |

## 3. Ficha completa: em linha horizontal

**"Ver ficha completa" é um botão no alto da tabela** ("Linha resumida | Ver ficha completa") e vale para todas as linhas de uma vez. A própria linha de cada produto continua para a direita, com todos os campos, um ao lado do outro: **nunca um bloco ou quadros embaixo da linha**. Assim as colunas de todos os produtos ficam alinhadas.

- Faixas de grupo em cima das colunas, na ordem: **Produto · Composição · Peça · Específicos da linha · Embalagem e cubagem · 🔒 Compra · 🔒 Custo interno · 🔒 Venda · 🔒 Pagamento · Programação · Controle**.
- **Produto fixo à esquerda**; **Situação e Ações fixas à direita** enquanto a linha rola para o lado (a página não rola; só a tabela).
- A ordem é a da linha resumida; a ficha completa só acrescenta colunas.
- Os grupos 🔒 não aparecem para quem não pode ver (a linha fica mais curta para esse login).

Colunas da ficha completa (62 no exemplo do pedido #16281):

| Grupo | Colunas |
| --- | --- |
| Produto | Produto · Variação · CODPROD · SKU · Código na fábrica · EAN · Marca · Linha · NCM · Fornecedor |
| Composição | Material · Embalagem · Cores · Peças por cor |
| Peça | C × L × A (cm) · Capacidade · Tamanho · Peso líq. (kg/pç) · Peso bruto (kg/pç) |
| Específicos da linha | Energia / voltagem · Certificação (Inmetro) · Pantone |
| Embalagem e cubagem | Pç/caixa master · Pç/inner · Caixa master C × L × A (cm) · CBM/caixa · Peso bruto da caixa (Calculado, "≈") · MOQ do Book · MOQ combinado · Peças · Caixas · Cubagem |
| 🔒 Compra | Compra por peça · FOB/EXW · Compra total · No Book (por peça) · Resposta do fornecedor · Contraproposta Wellmix · Negociação (situação) · No cadastro (por peça) |
| 🔒 Custo interno | Custo nacionalizado · Preço mínimo · Meta · Margem prevista · Veredito (Superplan) |
| 🔒 Venda | Venda por peça · Venda total · Câmbio |
| 🔒 Pagamento | Condição do fornecedor · Prazo de produção · Forma de pagamento do cliente |
| Programação | Rodada 1 … Rodada N (data · peças · caixas · m³; N = o maior número de rodadas da tabela) · Pedidos filhos |
| Controle | Essenciais · Alertas · Situação · Ações |

Os campos que só valem para algumas linhas de produto (capacidade, tamanho, energia/voltagem, certificação, Pantone) **aparecem sempre**, com "—" quando o produto não tem o dado (decisão do dono).

**Telas:**
- Computador e iPad deitado: tabela; na ficha completa, a linha rola para o lado com as colunas fixas.
- iPad em pé e celular: a linha resumida vira **cartão** (produto, situação, Peças · Caixas · Cubagem em destaque, compra 🔒 e alertas). "Ver ficha completa" abre a **mesma linha horizontal**, arrastando para o lado, com o produto fixo à esquerda.

## 4. Origem de cada valor e prioridade

Cada valor mostra embaixo um selo com a origem, com os nomes que a ficha da solicitação já usa (docs/REQUEST_SHEET.md):

| Selo | O que é |
| --- | --- |
| Book nº N | o item do Book (a planilha do fornecedor ou trading) |
| Negociação nº N | a solicitação ao fornecedor: resposta, contraproposta, aceite (condições combinadas, `agreedConditions`) |
| Pedido nº N | o pedido (itens, ficha de compra do pedido, rodadas) |
| Solicitação / Programação | o que a solicitação do cliente gravou |
| Ficha atual | o cadastro do produto hoje e a ficha mestre |
| Superplan | a análise do item do Book |
| Linha do produto | exigência da linha (certificação, atributos) |
| Cadastro do fornecedor | a condição de pagamento do fornecedor |
| Calculado | conta do portal com os dados gravados |

**Vale o dado da própria tela**; o que faltar vem, nesta ordem, do pedido, da negociação, do Book e, por último, da ficha atual. Na solicitação do cliente, o que a solicitação gravou vem primeiro (regra que já está no ar). Quando o valor da tela difere do anterior (ex.: negociado × Book), o anterior aparece riscado ao lado.

## 5. Dado ausente, unidades e alertas

- Sem dado: **"—"** (para leitor de tela e na dica: "Não informado"). Zero vindo do Sankhya em peso ou medida conta como sem dado.
- Calculado só com todos os dados; senão "—" e a ficha diz o que falta ("falta peças por caixa").
- Medida sem eixo declarado aparece como está, com "sem eixos".
- **CBM da caixa sem informação: "—"** (sem estimativa pelas medidas da peça; decisão do dono).
- Unidade no cabeçalho, não na célula: cm 1 casa; kg 3; m³ 4; compra por peça até 4 casas; totais 2; moeda sempre com o valor (US$, R$, CN¥ para RMB, €).
- Alertas ⚠ (na linha e na coluna Alertas): CBM da caixa menor que o volume da peça × peças por caixa; pedido abaixo do MOQ combinado; peso bruto igual ou menor que o líquido; comprado diferente da ficha atual.

## 6. Campos essenciais e edição na própria linha

Essenciais: nome, código da fábrica, peça C × L × A, peças por caixa master, CBM por caixa, peso bruto por peça, NCM e compra com moeda e FOB/EXW.

- Faltou: "—". **Quem já pode gravar aquele campo naquela tela edita ali mesmo**, pela mesma Server Action e com auditoria (sem regra nova de permissão):

| Essencial | Book (rascunho) | Solicitação ao fornecedor | Cadastro do produto | Ficha de compra do pedido |
| --- | --- | --- | --- | --- |
| Nome | Wellmix (tela Booking) | — | Wellmix (tela Produtos) | — |
| Código da fábrica, pç/caixa, CBM, peso bruto | Wellmix (tela Booking) | o fornecedor, na resposta | Wellmix (tela Produtos) | fornecedor do pedido; Wellmix |
| Peça C × L × A | Wellmix (tela Booking) | o fornecedor, na resposta | Wellmix (tela Produtos) | (a ficha não tem) |
| NCM | Wellmix (tela Booking) ou despachante | — | Wellmix ou despachante (validação) | despachante; Wellmix |
| Compra (preço, moeda, FOB/EXW) | quem vê preço de compra | o fornecedor, na resposta | quem vê preço de compra | fornecedor; quem vê preço de compra |

- **Na solicitação ao fornecedor, o fornecedor completa na resposta o dado técnico que faltou no Book** (decisão do dono).
- Editar exige ver: quem não vê o preço de compra não o edita.

## 7. Quem vê

O servidor só lê e só monta o que o login pode ver; o que fica de fora não sai do servidor. Vale em todas as telas, inclusive nas que já existiam antes do modelo (decisão do dono).

| Dado | Quem vê |
| --- | --- |
| Compra (Book, negociação, pedido, cadastro, faixas de preço) | permissão **"Ver preço de compra"** (Equipe → Funções e acessos). Padrão: Comprador, Gerente de produto, Planejamento (15/11/2026), Diretoria de compras, Diretoria executiva, Financeiro; o administrador sempre; e quem tem "Ver valores e margem". Fora da Wellmix: o **fornecedor**, só a dele; o **despachante** do pedido. A certificadora e o cliente nunca. |
| Superplan no Book, na Seleção de itens e na negociação (custo por peça, mínimo, meta, veredito) | "Ver preço de compra" (dono, 15/11/2026: o Comprador decide a compra com ele) |
| Custo interno e margem (ficha da solicitação: custo nacionalizado, venda sugerida, margem prevista) | "Ver valores e margem" |
| Venda e forma de pagamento do cliente | "Ver valores e margem" ou "Gravar a venda ao cliente"; o cliente vê a dele (docs/ORDER_SALE.md, docs/CUSTOMER_PAYMENT.md) |
| Nome do fornecedor | regra de sempre: o cliente e o transportador nunca |
| Identificação, peça, caixa, cubagem, programação | quem vê o item na tela |

## 8. Onde já está aplicado

| Tela | Situação |
| --- | --- |
| Solicitação do cliente, seção "Solicitações" (docs/REQUEST_SHEET.md) | **aplicada** (15/11/2026): linha resumida e o botão "Linha resumida \| Ver ficha completa" no alto da tabela, que abre todas as linhas juntas; a ficha completa é a linha horizontal com Produto, Embalagem e cubagem, Valores e Pagamento e o produto fixo à esquerda; sem dado, "—". No celular e no iPad, a linha resumida é cartão e a ficha completa rola dentro da tabela. As faixas são os quatro grupos que a seção já tinha; ainda não tem as faixas separadas da seção 3 (Composição, Peça, Específicos da linha, Programação e Controle), a coluna Situação e a edição na própria linha (seção 6). |
| Demais telas | quando o dono pedir "use a linha de visão de produto nesta tela" |

**Permissão "Ver preço de compra" (seção 7), já aplicada** (`canSeePurchasePrice`, `canSeeOrderPurchasePrice` em `src/lib/auth/function-access.ts`; o servidor não envia o valor e recusa a gravação de quem não vê):

- Produtos: lista (coluna Preço), exportação CSV (Preço e Moeda vazios), ficha (preço e moeda, faixas e oportunidade, preço de cada fornecedor, preço das variações, divergência de preço na leitura da planilha por foto). Salvar a ficha sem os campos de preço mantém o preço gravado.
- Book (grade do lote: colunas Preço e Moeda; o servidor recusa a edição) e Seleção de itens (preço e preço em US$, também nos grupos já pedidos).
- Pedido: FOB, preço por item e total, cópia da compra, preço da variação, fechamento do recebimento (lado do fornecedor; o lado do cliente segue "Ver valores e margem" ou "Gravar a venda"), lista de pedidos (preço dos itens). A certificadora deixou de ver o preço do pedido.
- Ficha de compra do pedido (moeda e preço; o servidor descarta de quem não vê). O resumo do requisito "Ficha de compra" deixou de levar o preço (o antigo aparece sem ele para quem não vê).
- Ficha da solicitação (compra, custo registrado, faixas e condições do fornecedor; a análise do Superplan continua com "Ver valores e margem").
- Histórico comercial (FOB unitário da última compra), produtos do fornecedor (Cadastros → Fornecedores) e a tabela de preços do marketing (FOB unitário, também no CSV).

- Solicitação ao fornecedor (15/11/2026): lista (resposta "Faz", sem o preço), tabela (preço e moeda do booking e das condições iniciais e finais), tela do produto (preço do booking ou negociado, resposta, alternativas, linha do tempo, condições combinadas), card "Pedido de compra" (preço negociado). A contraproposta de quem não vê o preço tem MOQ, prazo e FOB/EXW, sem preço e sem a simulação do Superplan; o servidor ignora preço enviado por ela. O Superplan (negociado, do item escolhido e das alternativas) some junto, porque custo e mínimo saem do preço. O fornecedor vê o dele, como antes.
- Estratégia de compra: o preço da última compra (fila e decisão). O pedido "fornecedor da última compra" gerado por quem não vê o preço sai com o preço e a moeda gravados na decisão (o formulário fica sem os dois campos).
- Cotação de compra: o quadro comparativo mostra fornecedores, situação e condições; preços por item, total e a linha "Última compra" só com a permissão, com o aviso de quem vê.
- Sourcing: preço na lista, na visita e no item; faixas de preço (lista, texto e o botão de salvar, que o servidor recusa). Salvar o item sem a permissão mantém o preço e a moeda gravados.

**Quem abre essas telas sem a permissão (padrão de fábrica):** o Cadastro (Sourcing, confirmado pelo dono em 15/11/2026: quem vai à feira, Comprador ou GP, grava o preço) e funções criadas pelo administrador. O Planejamento passou a ter "Ver preço de compra" por padrão (dono, 15/11/2026): ele decide a solicitação ao fornecedor e gera o pedido de compra.

**Decidido pelo dono (15/11/2026):**

- O pedido de compra (tela e PDF) saiu da certificadora (`canViewOrderDocument`); o despachante do pedido continua lendo. A invoice comercial (comex e logística), as linhas da invoice (companhia marítima) e os arquivos de invoice e packing list (agência, transportador e jurídico) continuam com quem precisa deles para embarque e alfândega.
- O Superplan no Book (coluna e cartão da análise), na Seleção de itens (custo por peça, coluna Superplan e o destaque do melhor custo) e na negociação segue "Ver preço de compra".

**Em conversa com o dono:** o preço da última compra na Nova solicitação (PR #488) aparece para toda a Wellmix, inclusive Vendas; nada muda até o dono decidir.

## 9. O que o inventário mostrou (15/11/2026)

- **Medidas do Book são da peça.** Em nenhum dos 75 itens de Book em produção as medidas batem com o CBM da caixa. O produto criado pela solicitação levava essas medidas para "Medidas da caixa master" e recalculava o CBM pelo volume da peça (GRECIE 0,0004 no lugar de 0,0255 m³; Teste 0,001 no lugar de 0,08). Corrigido no código (PR #464) e nos dados, com auditoria `product.cbm_fixed` (docs/SUPPLIER_REQUESTS.md).
- **Medidas da embalagem individual e da caixa inner não existem** no sistema; as da caixa master estão em 2 de 16.843 produtos.
- **Nenhuma das 1.080 linhas de produto** (os grupos do Sankhya) tem atributos ou certificação exigidos configurados; por isso os campos específicos aparecem sempre, com "—".
- O "Preço" do cadastro é o da **última compra** (carga do Sankhya: VLRUNIT ÷ câmbio), não custo nem venda.
- Material, cor, MOQ e caixa master vêm do Book e da solicitação; no cadastro vindo do Sankhya estão quase sempre vazios.
- Moeda: RMB (planilhas) e CNY (cadastro) são o mesmo yuan; mostrar CN¥.
