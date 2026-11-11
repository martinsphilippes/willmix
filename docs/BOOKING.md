# Booking: os produtos antes da solicitação

Tela **Pedidos → Booking** (`/app/booking`), só da Wellmix. É onde os produtos que chegam pela ficha técnica (planilha SUPPLIER INFO) são trabalhados antes de existir solicitação: análise de preço no Superplan, aprovação, oferta ao cliente, reserva e, no fim, "Gerar solicitação".

O nome "booking" também existe na etapa de embarque (reserva no navio, `import_steps`). São coisas diferentes: esta tela é a fila de produtos antes do pedido; a reserva do navio continua onde está.

Onde está cada parte:

| Parte                                                     | Arquivo                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Regras puras (etapas, quem move, filtros, colunas)        | `src/lib/booking.ts`                                                    |
| Peso bruto estimado                                       | `src/lib/weights.ts`                                                    |
| Serviço (ler linhas, gravar, analisar, gerar solicitação) | `src/lib/services/booking.ts`                                           |
| Entrada pela importação                                   | `src/lib/services/booking-intake.ts`                                    |
| Vitrine (quem está escondido do cliente)                  | `src/lib/services/booking-visibility.ts`                                |
| Ações                                                     | `src/app/app/actions/booking.ts`                                        |
| Telas                                                     | `src/app/app/booking/`                                                  |
| Textos                                                    | `src/i18n/modules/booking.ts`, `booking-screen.ts`, `booking-detail.ts` |

## 0. Booking por planilha (decisão do dono, 10/11/2026)

A tela **Booking** (`/app/booking`) passou a ser a lista dos **bookings**: cada booking é a planilha que um fornecedor mandou, com status, origem, fornecedor e data, e uma lista de itens. A fila de produtos descrita nas seções seguintes continua existindo, em **`/app/booking/products`** (botão "Fila de produtos"; endereço antigo `/app/booking?…` com filtros é encaminhado para lá).

**Os itens do booking não são produtos.** Nada entra no cadastro de produtos nem no Sankhya ao subir ou fechar um booking. Na **Seleção de itens** (`/app/booking/selection`, docs/SUPPLIER_REQUESTS.md) a Wellmix compara itens parecidos de vários bookings e abre a **solicitação ao fornecedor** do escolhido; só depois de aprovada com o fornecedor o produto é criado ou associado e os itens iguais são ligados a ele (`booking_items.productId`, vazio até lá). A Seleção de itens substitui a fila de produtos: o botão da tela principal leva a ela, e `/app/booking/products` continua existindo sem link.

Decisões:

1. **Status do booking**: Rascunho → Fechado (importação concluída, análise do Superplan feita) → Em andamento → Concluído; e Cancelado. Só o rascunho é editável. À mão: Rascunho → Cancelado; Fechado → Em andamento, Concluído ou Cancelado; Em andamento → Fechado, Concluído ou Cancelado; Concluído → Em andamento; Cancelado → Rascunho (`bookingLotMoves`, `src/lib/booking-lots.ts`).
2. **Origem** é a cidade do fornecedor (`parties.city`). Sem fornecedor no booking, vale a cidade da planilha (coluna LOCAL).
3. **Um fornecedor por booking**, estimado pela planilha (o nome mais frequente na coluna SUPPLIER NAME) e ajustado pelo usuário. A planilha casa com o cadastro pelo nome (sem pontuação nem "Co., Ltd."), senão pelo telefone (8 últimos dígitos), senão, só quando a planilha não traz nome, pelo nº da loja (`matchSheetSupplier`). Sem correspondência, o detalhamento sugere cadastrar o fornecedor com nome, nº da loja, telefone e cidade da planilha (Cadastros → Fornecedores, sem login).
4. **Data** do booking: a da coluna DATE (a mais frequente), ajustável. A data como veio fica guardada para conferência (`sheetDate`).
5. **Colunas**. Lidas com campo próprio: product number list, SKU/factory item code, description, FOB/EXW\*, coin US$/RMB\*, price\*, qty/box\*, qty/inner\*, N.W./pc\*, G.W./pc\*, CBM\*, size (cm) length\*, width\* e height\*, capacity (ml)\*, package\*, material\*, MOQ\* (\* = obrigatório para fechar, `BOOKING_ITEM_REQUIRED`). Informativas: color assortment, function/battery/110/220, purchase schedule, departure interval in days, purchase qty in pcs, TT PCS, foto e supplier business card. **Qualquer outra coluna** fica guardada no item (`extras`, cabeçalho → valor) e não aparece na tela; os nomes dessas colunas ficam em `booking_lots.extraHeaders`. Linhas seguidas iguais com só a cor diferente continuam sendo um item só (regra 4 da seção 3).
6. **Fechar** confere fornecedor, data e os campos obrigatórios de todos os itens e roda o **Superplan em todos os itens** com os valores padrão (câmbio do dia, container e frete padrão, preço mínimo), gravando o retrato em `booking_items.analysis` (mesmo formato de `bookings.analysis`). O item não tem NCM: II e IPI contam 0 (`ncmFound` falso). Um seletor acima do botão escolhe o **tipo de negócio** do Superplan (vazio = o padrão dos parâmetros). Num booking fechado, "Refazer a análise" roda de novo (câmbio ou parâmetros mudaram).

Telas:

- **`/app/booking`**: tabela dos bookings (nº, status, origem, fornecedor, data, planilha, itens, incompletos, sinais do Superplan, responsável, carregado em). Clicar no cabeçalho ordena (de novo inverte); a busca filtra por qualquer campo enquanto se digita. Tudo no navegador (`searchBookingLots`, `sortBookingLots`). Botão **Importar booking**.
- **`/app/booking/import`**: arquivo (.xlsx/.xls, até 80 itens, subido direto ao armazenamento quando grande) ou link do Google Sheets, e a moeda dos preços sem moeda. Usa o mesmo leitor da ficha técnica (`parseProductSheet`); os erros de leitura têm os mesmos textos.
- **`/app/booking/lots/[id]`**: dados do booking (fornecedor e data gravam sozinhos no rascunho), sugestão de cadastro do fornecedor, fechar (tipo de negócio), status, observação e a tabela dos itens com todos os campos (no rascunho, cada campo grava sozinho ao sair dele; obrigatório vazio fica destacado), a conferência do que falta e o resultado do Superplan (sinal, preço mínimo, lucro e o que faltou).

Onde está: regras puras em `src/lib/booking-lots.ts`; serviço em `src/lib/services/booking-lots.ts`; análise dos itens em `analyzeBookingItems` (`src/lib/services/superplan-analysis.ts`); ações em `src/app/app/actions/booking-lots.ts`; campos que gravam sozinhos em `src/components/booking-lot-fields.tsx`; textos em `src/i18n/modules/booking-lots.ts`; testes em `tests/unit/booking-lots.test.ts` e, de ponta a ponta com a seleção e a solicitação ao fornecedor, em `tests/e2e/booking-supplier-request.spec.ts`.

Banco: tabelas `booking_lots` e `booking_items` (docs/APPWRITE.md). Antes da publicação (`npm run appwrite:push`), a lista avisa "esquema desatualizado" e não oferece a importação.

Permissões: só a Wellmix com a tela Booking (como a fila de produtos). Cadastrar o fornecedor sugerido também é dessa tela. Cliente, fornecedor e parceiros não veem bookings, itens, fotos nem a planilha guardada (documentos internos).

## 1. Problema

- A ficha técnica importada virava **um produto com variações** (uma variação por linha). Para o dono, cada linha é um **produto diferente**.
- O produto importado aparecia na vitrine do cliente na hora, antes de alguém olhar preço, margem e se vale a pena.
- Tudo o que acontece entre "chegou a planilha da feira" e "abrir a solicitação" (analisar, aprovar, oferecer, reservar para um cliente) ficava fora do sistema.

## 2. Objetivo

Uma tela em linhas, uma por produto, alimentada pela importação da ficha, onde a Wellmix:

- vê tudo o que veio da planilha e filtra por **qualquer coluna**;
- acompanha a **etapa** de cada produto;
- guarda a **análise do Superplan** (preço de venda e sinal verde/amarelo/vermelho);
- reserva quantidade para um cliente;
- marca várias linhas e gera **uma solicitação** (lote) com todas.

## 3. Decisões do dono (9/11/2026)

1. Etapas: Novo → Em análise → Aprovado → Oferecido ao cliente → Reservado pelo cliente → Virou solicitação; e Descartado.
2. Só a Wellmix usa.
3. Cada linha da ficha vira produto do cadastro na hora (ficha mestre, fotos, fornecedor), mas **fica fora da vitrine até ser aprovada no Booking**.
4. Linhas seguidas com o mesmo código e só a cor diferente são **um produto só**; as cores ficam como cores dele.
5. Colunas: as da planilha, mais etapa, cliente, quantidade reservada, preço de venda e sinal do Superplan, responsável, data de entrada, planilha de origem e observação; e os pesos (**líquido, bruto e "médio"**), que também vão para o Superplan.
6. Saída: marcar as linhas, escolher o cliente e "Gerar solicitação" (um lote com as quantidades reservadas). Quem pode aprovar faz isso direto de Novo ou Em análise, sem passar pelo "Mover".
7. Planilhas antigas (importadas como variações) ficam como estão; há um botão para reimportar uma planilha antiga direto no Booking.

**O "peso médio" (confirmado pelo dono): um terceiro peso, em kg.** É o **Peso médio por peça (kg)** (`purchase_sheets.averageWeightPcKg`), informado pela fábrica ou medido, ao lado do líquido e do bruto. Fica na ficha do produto (bloco do produto, opcional), na coluna "Peso médio (kg)" do Booking (editável no modo de edição) e na Compra do Superplan, só para leitura. Não substitui o líquido nem o bruto e **não entra em conta nenhuma** (container, custo, imposto). Nenhuma planilha lida até hoje traz esse campo: ele é preenchido no portal. Continuam na tela, com os seus nomes:

- **Peso estimado (kg)**: o peso bruto da ficha quando ela traz; senão o peso líquido mais a folga da embalagem (8% por padrão; a planilha da feira usa `N.W × 1,08`).
- **Média (US$)**: a média informada pelo despachante na ficha mestre (`purchase_sheets.averagePrice`), que já existia.

### Booking do fornecedor (decisão do dono, 10/11/2026)

Cada Booking que sobe é de **um fornecedor específico**, escolhido na hora de importar a ficha técnica:

- **Importar ficha técnica** (`/app/products/import`) ganhou o campo **Fornecedor** (lista dos fornecedores ativos). Para quem abre o Booking é obrigatório; em "Mandar para o Booking" o servidor recusa sem ele (`supplier_required`; fornecedor inexistente, de outro tipo ou inativo: `supplier_invalid`). Todos os produtos da planilha ficam com esse fornecedor como principal (`products.supplierId` e o vínculo em `product_suppliers`), qualquer que seja o nome escrito na coluna SUPPLIER NAME, e nenhum fornecedor novo é cadastrado pela planilha. Sem escolha (login que não abre o Booking), vale a planilha, como antes. O lote guarda a escolha (`mapping.__supplierId`), e "Mandar para o Booking" numa importação guardada a reaproveita.
- **Coluna Cliente fora da tabela**: no lugar dela fica a coluna **Fornecedor**, já preenchida pela escolha da importação (continua editável em "Editar dados dos produtos"). O dado `bookings.customerId` continua no banco e pode ser trocado na página da linha. Linha sem cliente é **compra para o estoque da Wellmix**: mover para Oferecido/Reservado e "Gerar solicitação" usam a empresa de estoque (`withStockCustomer`, `ensureStockParty`) em vez de recusar. Linhas de um cliente e linhas sem cliente não vão na mesma solicitação (`booking_customer_mismatch`).
- **Coluna "Local / Porto"** (antes "Local / loja"): é o local/porto **de onde a mercadoria sai no marítimo** (o mesmo campo `location` da ficha, que já é a origem na cotação de frete), não o endereço da loja. O nº da loja continua na segunda caixa da coluna.
- O fornecedor ainda não tem tela própria de Booking: a "análise do Booking" pelo fornecedor e a RFQ em espera são a etapa seguinte desta decisão.

**Cartão do fabricante (10/11/2026).** A coluna do cartão da planilha (`SUPPLIER BUSINESS CARD`, coluna AG do modelo) entra sozinha: a foto fica no produto e, quando a linha vai ao fornecedor, a cotação dele já nasce com o cartão do fabricante confirmado (selo "Veio da planilha do Booking"). Ninguém envia de novo; o fornecedor pode trocar. Só o fornecedor do produto recebe. Linha da planilha sem cartão: a cotação continua pedindo o envio.

### Quantidade planejada e previsão de vendas (racional do dono, 10/11/2026)

A decisão de selecionar o produto parte do custo real (Superplan) e aponta para a **quantidade**. Para isso a linha do Booking guarda um plano (`bookings.plan`, JSON opcional):

- **Qtd. planejada (pç)**: vem sozinha da planilha, coluna **"TT PCS"** (o plano de compra da Wellmix na planilha da feira), somada nas linhas de cor do produto. Planilha sem a coluna: fica vazia (nada é inventado). Reimportar numa linha ainda em Novo atualiza a planejada e mantém a previsão digitada.
- **Previsão encomenda / distribuição / e-commerce (pç)**: digitadas pela equipe (nenhuma planilha lida até hoje traz a venda por canal). **Previsão total** é a soma.
- Todos são digitáveis direto na tabela (gravam sozinhos, campo a campo) e têm filtro e ordenação como as outras colunas.
- **Gerar solicitação** usa: a quantidade digitada na linha; senão a reservada; senão a **planejada** (quando não fica abaixo do pedido mínimo); senão o pedido mínimo (`bookingRequestQuantity`).
- Antes de o esquema ser publicado, a importação grava a linha sem o plano (a linha nunca deixa de nascer por causa dele).

## 4. Requisitos funcionais

- **Entrada**: na importação da ficha técnica, a opção "Mandar para o Booking (um produto por linha)" é a primeira e já vem marcada para quem abre o Booking. Cada grupo de linhas vira um produto (como o modo "um produto por linha") e uma linha do Booking, ligada à planilha de origem. As outras duas opções continuam.
- **Reimportar uma planilha antiga**: no resultado de uma importação antiga, "Mandar para o Booking" relê o arquivo guardado e cria os produtos e as linhas. O produto antigo com variações não é alterado. **O produto que já existe também não**: a planilha é antiga, então preço, pedido mínimo, caixa, pesos, cores e fotos dele ficam como estão hoje; ele só ganha a linha do Booking (o resultado mostra "Já existia (não alterado)"). Só a planilha enviada de novo, como arquivo novo, atualiza o produto. Num lote "um produto por linha", cada linha da planilha cai no **produto que ela criou naquela importação**, mesmo que ele tenha mudado de nome ou de linha desde então; só o que foi apagado de vez é criado de novo (em Novo). E o produto que uma tentativa anterior desta releitura **deixou pela metade** (nasceu, e a ficha ou a foto falhou) é completado ao mandar de novo, **só no que ficou vazio**: sem ficha mestre, a ficha e as fotos são gravadas; com ficha, só as fotos que faltam. É o único caso em que a releitura grava num produto que já existe, e nem nele reescreve o que alguém já preencheu.
- **Lista**: uma linha por produto, 100 por página, com cartões das etapas (contagem; tocar filtra), busca geral, filtro em toda coluna (logo abaixo do título), ordenação por qualquer coluna e o filtro guardado no endereço. A coluna do produto fica parada ao rolar para o lado.
- **Ações em várias linhas** (barra acima da tabela): salvar cliente e quantidades, mover de etapa, trocar o responsável, analisar no Superplan, gerar solicitação. Mover e gerar solicitação pedem confirmação dizendo quantas linhas e para onde. Se a ação for recusada, o que estava digitado e marcado **volta para a tela** (quantidades, linhas marcadas e escolhas da barra), com o aviso e o botão "Descartar". Voltam marcadas só as linhas que estavam marcadas no envio (a linha com quantidade digitada que a pessoa desmarcou continua desmarcada), e só volta o rascunho do envio que aquela recusa responde (voltar a uma recusa antiga pelo botão Voltar do navegador, depois de um envio que deu certo, não devolve nada).
- **Dados do produto direto na tabela** (quem abre Booking e Produtos): não há mais modo de edição nem botão "Salvar dados"; cada célula é um campo que **grava sozinho** ao sair dele ou no Enter (listas gravam ao escolher), pela ação `setBookingProductFieldAction(produto, campo, valor)`. Ela aceita só os campos da lista (`PRODUCT_FIELDS`: os da ficha mestre, as três medidas, o plano da linha, fornecedor e nome), lê o valor pelo mesmo leitor (`readProductEdit`) e grava pelo mesmo serviço (`saveBookingProductEdits`) do envio em lote, que continua existindo (`saveBookingProductsAction`). A célula avisa "Gravando…", "Gravado ✓" ou o motivo; valor que não dá para ler não grava e o que foi digitado fica para corrigir. Gravado, o campo mostra o valor como ficou no servidor (por isso a troca do fornecedor, que traz os dados dele, atualiza os outros campos da linha). O nome vira campo e o link "Abrir" fica embaixo dele. O endereço antigo `?edit=1` continua abrindo a mesma tela. O texto a seguir descreve as regras de gravação, que não mudaram.
- **Editar dados dos produtos** (quem abre Booking e Produtos): o botão acima da tabela põe a lista em modo de edição (`?edit=1`, que acompanha filtros, ordem e páginas). Nome, fornecedor, código, local, loja, data da ficha, preço, moeda, MOQ, peças por caixa e por inner, peso líquido, bruto e médio, média, CBM, medidas da peça, cores, material e embalagem viram campos nas células; "Salvar dados" grava só o que mudou (`saveBookingProductsAction` → `saveBookingProductEdits`), pelos mesmos caminhos da página do produto: fornecedor pela troca do principal, nome e medidas no cadastro (especificação automática remontada), o resto na ficha mestre, que espelha no cadastro. Um valor ilegível recusa o envio inteiro (`booking_data_invalid`) e o que estava digitado volta. Só produto que tem linha no Booking. Não editáveis na tabela: etapa, cliente, quantidade e responsável (barra de ações), observação (página da linha), custo, preço de venda e sinal (Superplan), peso estimado, entrada, planilha e solicitação.
- **Página da linha** (`/app/booking/[id]`): etapa, cliente, quantidade reservada, responsável e observação num formulário; dados da ficha; análise do Superplan; histórico. Só o que a pessoa mudou é gravado: salvar uma observação numa página aberta há tempo não desfaz a etapa, o cliente ou a reserva que alguém mudou nesse meio-tempo.
- **Superplan**: aberto a partir da linha (`/app/superplan?booking=<id>`), já com o produto; "Gravar no Booking" guarda o tipo de negócio, o preço testado e o resultado. Também há "Analisar no Superplan" para várias linhas de uma vez (com os valores padrão), que dá o **custo**, o **preço mínimo** e o **preço para a meta** de cada produto; o sinal verde/amarelo/vermelho só existe depois que alguém testa um preço de venda (regra 9).
- **Vitrine**: produto em Novo, Em análise ou Descartado não aparece para o cliente (vitrine, página do produto, carrinho, nova solicitação, busca por foto, fotos e documentos do produto, kits de marketing).

## 5. Regras de negócio

1. Uma linha do Booking por produto (índice único). Reimportar a mesma planilha atualiza o produto e **não** cria outra linha nem muda a etapa.
2. **Entrada**: o produto que a planilha **criou** entra em **Novo** (fora da vitrine). O produto que **já existia** no cadastro (a planilha só o atualizou) entra em **Aprovado**: ele já estava na vitrine e a importação não tira da vitrine o que já se vende. O produto que já existia mas está **excluído** (desativado) entra em **Novo**: a importação não o restaura e, se alguém o restaurar depois, ele não volta à vitrine sem aprovação.
3. **Etapas** (`BOOKING_FLOW` + `discarded`):
   - "Virou solicitação" só é gravada pelo "Gerar solicitação".
   - Mudança que **põe o produto na vitrine ou tira dela** (aprovar; voltar um aprovado para Novo ou Em análise; descartar um aprovado; recuperar um descartado direto para aprovado) é de quem **analisa**: quem abre a tela Superplan (hoje, o administrador; ele pode liberar a tela a outro login em Equipe).
   - Sair de "Virou solicitação" depende da **solicitação da linha** (a linha guarda o id dela desde que é tomada, regra 8):
     - **sendo criada** (a linha foi tomada há menos de 2 minutos e a solicitação ainda não existe): ninguém mexe, nem quem analisa. A tela diz "criando…";
     - **em andamento** (existe e ainda não virou pedido): ninguém reabre à mão, porque reabrir deixaria a solicitação viva e a linha livre para gerar outra. O caminho é excluir a solicitação (a linha volta sozinha, regra 8);
     - **virou pedido**: só quem analisa reabre (por exemplo, para oferecer o produto de novo). A ligação antiga sai da linha e fica no histórico; o pedido não é tocado;
     - **não existe** (passaram 2 minutos e a solicitação não nasceu, porque a criação caiu no meio; ou ela foi cancelada e a linha não voltou sozinha): qualquer login com a tela devolve a linha para Aprovado, Oferecido ou Reservado. A página da linha avisa.
   - O resto (Novo ↔ Em análise; descartar ou recuperar antes de aprovar; Aprovado ↔ Oferecido ↔ Reservado): qualquer login com a tela.
4. **O que a etapa exige**: Oferecido precisa de cliente; Reservado, de cliente e quantidade. A quantidade reservada é inteira, positiva e **nunca abaixo do pedido mínimo** do produto (ficha mestre, senão cadastro).
5. **Cliente**: empresa cliente ativa, ou "Estoque Wellmix" (compra para estoque, a mesma empresa interna da Nova solicitação). Oferecer ou reservar confere de novo: cliente que deixou de estar ativo é recusado, com a linha. **Responsável**: login ativo da Wellmix; quem importou a planilha, até alguém trocar.
6. **Várias linhas**: tudo ou nada. Primeiro todas são conferidas; a primeira recusa cancela a ação inteira e a tela destaca a linha. No máximo 100 linhas por ação. A quantidade digitada na linha e o cliente escolhido na barra valem só para as linhas marcadas, e valem em **toda** ação da barra (salvar, mover, trocar responsável, analisar e gerar solicitação): são gravados na mesma conferência.
7. **Vitrine**: escondem o produto as etapas Novo, Em análise e Descartado. Aprovado em diante aparece. Produto sem linha no Booking nunca é escondido.
   7c. **O próximo passo na linha**: a linha em "Virou solicitação" mostra, na coluna Etapa, o número da solicitação, o que fazer agora em palavras simples e um botão que leva direto para lá (`bookingNextStep`, em `src/lib/booking.ts`; preenchido em `buildRows` com a situação da solicitação, as cotações e o pedido). Passos: abrir a RFQ; esperando o fornecedor confirmar o preço (o botão abre a cotação, para registrar a resposta dele); o fornecedor não aceitou o preço; cotação devolvida esperando resposta; o fornecedor respondeu (escolher a cotação e o valor de venda); fornecedor escolhido (sinal ou aprovação); virou pedido (o botão abre o pedido); cancelada. Só para quem abre Solicitações; quem não abre Cotações é levado à solicitação.
   7d. **A situação de agora na linha** (pedido do dono, 10/11): ao lado de "Virou solicitação nº N" a linha mostra a situação em uma palavra e o passo seguinte acompanha a cotação e o pedido até o documento assinado. "Cotação em rascunho": a ficha da cotação já foi gravada (ou o prazo guardado) mas a cotação não foi enviada; o botão abre a cotação, para ver o que falta ou registrar a resposta pelo fornecedor. "Cotação enviada": o fornecedor enviou; o botão "Conferir e confirmar" leva à comparação de cotações da solicitação (`#quotes-compare`). Uma cotação enviada com a solicitação ainda em "RFQ aberta" também conta como enviada (a linha não fica "esperando"). Com mais de um fornecedor convidado, a linha diz quantas cotações foram enviadas. Depois do pedido, a linha acompanha o **documento do pedido** (docs/ORDER_SIGNATURE.md): "Pedido: assinar documento" (falta a Wellmix), "Documento com o fornecedor" (ele baixa, assina e anexa) e "Documento assinado"; o botão abre o documento (`/app/orders/{id}/purchase-order`). Pedido antigo, sem os itens de assinatura, continua "Pedido criado" com o botão do pedido. Passos em que a bola está com outro (`BOOKING_NEXT_WAITING`) têm botão secundário.

7b. **Depois do "Gerar solicitação"**: aberta a RFQ, o fornecedor principal do produto recebe o **preço da ficha** como preço desejado e só confirma ou manda o dele (`docs/QUOTE_FLOW.md`, seção 3a). Por isso vale conferir o preço na tabela antes de gerar. As fotos que vieram com o produto também já contam nessa cotação (seção 3b).

7a. **Cliente e quantidade direto na linha**: na tabela, a coluna Cliente é uma lista e a Qtd. reservada é um campo; os dois **gravam sozinhos** (ao escolher o cliente; ao sair do campo da quantidade ou no Enter), sem marcar a linha nem usar a barra. A célula avisa "Gravando…", "Gravado ✓" ou o motivo da recusa (aí a lista volta para o que estava gravado; o número digitado fica para corrigir). São as ações `setBookingCustomerAction` e `setBookingQuantityAction` (`src/app/app/actions/booking.ts`), que devolvem o resultado em vez de redirecionar e passam pelo mesmo `saveBookingRow` da página da linha (mesmas regras: pedido mínimo, cliente ativo, linha que virou solicitação é travada, reserva não fica sem cliente nem quantidade; cada troca vai para a auditoria). A tela não recarrega: o que foi digitado nas outras linhas continua. Linha em Virou solicitação ou Descartado mostra só o texto. A barra de cima continua valendo para várias linhas de uma vez, e a quantidade digitada continua sendo usada pelas ações da barra (`qty_<id>`). Componentes em `src/components/booking-row-fields.tsx`.

8. **Gerar solicitação**: linhas em Aprovado, Oferecido ou Reservado; **para quem pode aprovar (quem abre o Superplan), também linhas em Novo e Em análise** — a aprovação vai junto, num toque só, e a auditoria registra "aprovado junto, por quem gerou" (`bookingCanRequest`). Quem não aprova continua precisando da aprovação antes; Descartado e Virou solicitação nunca geram. No máximo 30 por vez, e só para quem também abre Solicitações. Quando recusa, a tela mostra o que falta em cada passo (etapa, cliente, quantidade) e aponta a linha. Todas viram um lote do cliente escolhido (sem escolha, o cliente das linhas, se for um só). Sem cliente na barra nem nas linhas, a recusa diz isso e aponta a linha sem cliente. Linha reservada para **outro** cliente recusa o envio inteiro (nada é criado). Quantidade: a digitada na linha, senão a reservada, senão o pedido mínimo do produto; sem nenhuma, recusa dizendo qual linha. Produto com variações recusa (use a Nova solicitação, que pede a variação). Depois: as linhas vão para "Virou solicitação" com o cliente, a quantidade e o número da solicitação, e ficam travadas (cliente e quantidade mudam na solicitação). As linhas são tomadas (vão para "Virou solicitação") **antes** de a solicitação nascer, **já com o id que a solicitação de cada uma vai ter** (escolhido pela chamada), o cliente e a quantidade, e são relidas. Com isso: duas chamadas juntas para a mesma linha não criam duas solicitações; enquanto a solicitação é criada ninguém move a linha; se a criação falhar, as linhas voltam para onde estavam **e o que nasceu desta chamada é cancelado pelo id** (nunca uma solicitação que não nasceu dela, nem outra do mesmo login, cliente e produto); se o servidor cair no meio, a linha cuja solicitação nasceu já está ligada a ela. No fecho, a chamada relê as linhas: a que deixou de ser dela (devolvida ou tomada por outra chamada enquanto esta criava) tem a solicitação desta chamada cancelada, para nunca ficarem duas vivas para a mesma linha. **Excluir a solicitação** gerada solta a linha: ela volta para Reservado (ou Aprovado, sem cliente e quantidade), sem a ligação, e pode gerar de novo.
9. **Análise do Superplan** (só quem abre o Superplan): guarda um retrato (`analysis`): tipo de negócio, preço de venda, custo por peça, preço mínimo, lucro %, meta, sinal, preço para a meta, o que faltou e o que foi considerado (câmbio, II/IPI, container, frete, peso estimado). O resultado é sempre refeito no servidor; nunca vem do navegador. A lista mostra o retrato com a data; não recalcula sozinha. Analisar uma linha em Novo leva para Em análise.
   - **Sinal só com preço testado.** A análise em várias linhas não tem preço de venda: ela calcula no preço mínimo, e nesse preço o lucro depende quase só dos parâmetros (todo produto daria o mesmo sinal). Por isso a linha analisada em lote mostra "No preço mínimo" (neutro) com o custo e o preço para a meta, que são os números que mudam de produto para produto. Verde, amarelo ou vermelho aparecem quando alguém testa um preço no Superplan e grava.
   - **A simulação gravada à mão fica.** "Analisar no Superplan" em várias linhas não substitui a análise que alguém gravou pelo Superplan (o preço testado e o tipo de negócio escolhidos ali não se recuperam de outro lugar); a tela diz quantas foram mantidas. Gravar de novo pelo Superplan substitui.
   - **Os mesmos números na linha e na conta.** Preço, moeda, peças por caixa, CBM e pesos vêm de uma leitura só (`productPurchaseView`), usada pela linha do Booking e pelo Superplan: preço e moeda sempre da mesma fonte (o cadastro do produto, que é o gravado por último; sem preço nele, a ficha mestre), caixa e volume do cadastro e, sem eles, da ficha, e os pesos também (cada um do seu campo) (regras em `docs/SUPERPLAN.md`). O retrato guarda o que foi usado (preço, moeda, peças por caixa e CBM), e a página da linha mostra.
   - **Sem II/IPI conhecidos** (produto sem NCM na tabela fiscal ou só com uma das alíquotas): a conta usa 0 no que falta e o custo sai menor. A lista marca a linha com "II/IPI 0", a análise em lote diz quantas ficaram assim, e a página mostra as duas alíquotas usadas com o aviso de que o que faltou entrou como 0.
   - **Preço em outra moeda** (EUR, BRL): a análise diz que falta o preço em RMB ou US$ (e não "falta o preço").
10. **Pesos**: peso líquido e peso bruto por peça, cada um na sua coluna, do jeito que a planilha traz (N.W e G.W). **Peso bruto vazio fica vazio**: o líquido nunca é lido como bruto. O peso estimado (regra da decisão 5) é só uma conta, marcada com "≈", e nunca é gravado como peso bruto do produto.
11. **Média (US$)**: só informação. Não entra em nenhuma conta de imposto ou custo; os impostos são sempre sobre o valor real da compra (ver `docs/SUPERPLAN.md`).

## 6. Casos especiais

- Tabela `bookings` ainda não publicada no Appwrite: a tela mostra o aviso de esquema desatualizado; a importação para o Booking recusa antes de criar qualquer produto; a vitrine e as outras telas seguem como antes (ninguém fica escondido nem a página quebra).
- Produto apagado ou desativado no cadastro: a linha continua, marcada "produto fora do cadastro", fica de fora da análise em lote e não gera solicitação. Excluir o produto de vez apaga a linha dele.
- Limpeza dos dados de venda (Configurações): a linha fica; a que tinha virado solicitação volta para Reservado (ou Aprovado, sem reserva), sem a ligação.
- Planilha com mais de 80 produtos: a importação recusa, como hoje (dividir a planilha).
- Linha que mudou enquanto uma ação rodava (outra pessoa a transformou em solicitação, descartou ou trocou o cliente): a gravação relê a linha logo antes e recusa (`booking_changed`) em vez de gravar por cima; as linhas anteriores daquela ação já ficaram gravadas. O "Gerar solicitação" confere cada linha logo antes de tomá-la.
- Importação interrompida ou com falha: a linha do Booking de um produto novo nasce **antes** do próprio produto (com o id que ele vai ter), então em nenhum momento existe produto novo no cadastro sem a linha que o mantém fora da vitrine. Se a criação do produto falhar, a linha sai junto; antes de tirar a linha, a importação confere se o produto foi gravado mesmo assim (resposta perdida no caminho): se foi, ele fica com a linha, em Novo. Se a linha foi gravada e o registro dela falhou, ela também sai (não sobra linha em branco). Se a importação cair entre a linha e o produto, sobra uma linha em Novo sem produto: a importação seguinte a retira (depois de 10 minutos, para não mexer numa importação ainda rodando). Reimportar completa o que faltou; produto que nasceu numa importação com falha continua em Novo (não é tratado como "já estava no cadastro").
- Sem câmbio do dia, sem volume da caixa ou sem preço: a análise fica "falta dado" e diz o quê (e não entra na contagem "sem II/IPI", que é só de quem teve custo calculado).
- Filtro de opção com vários valores (o "Ver no Booking" de uma importação reimportada): o seletor da coluna leva todos, e refinar a lista por outra coluna não os perde.
- O histórico de importações e a auditoria dizem "já existiam (não alterados)" para a planilha antiga relida, em vez de "atualizados".
- Produto sem NCM na tabela fiscal: a análise usa II e IPI 0, a lista marca "II/IPI 0" e a página avisa (o custo sai menor; ajustar no Superplan e gravar).
- Produto "um por linha" que ganhou variação **à mão** (na página do produto): continua sendo o mesmo produto para a importação (entra no Booking, sem duplicar). Só o produto único de uma importação "com variações" fica de fora.
- Produto sem fornecedor com o mesmo nome de linhas de dois fornecedores na planilha: a primeira linha fica com ele e a outra vira o produto do outro fornecedor; reimportar dá os mesmos dois produtos.
- "Ver no Booking" no resultado de uma importação: abre as linhas dos produtos daquele lote, mesmo quando a linha guarda outra planilha de origem (a linha só troca de planilha enquanto está em Novo).
- Cliente inativo ou que não é cliente: recusado.
- Filtro com endereço estragado: o que não dá para ler é ignorado.
- Recompra pelo pedido ("comprar de novo"): continua como era, mesmo que o produto esteja escondido ou desativado (o produto vem do pedido que o cliente já tem, não do formulário).
- Produto que volta a ficar escondido depois de um pedido ou kit: o kit já oferecido continua aberto para o cliente; kit novo e oferta nova são recusados.

## 7. Fluxo do usuário

1. Cadastros → Produtos → Importar ficha técnica → envia a planilha (opção "Mandar para o Booking" já marcada).
2. Pedidos → Booking: as linhas aparecem em **Novo**.
3. Marca as linhas → "Analisar no Superplan": cada uma ganha custo, preço mínimo e preço para a meta, e vai para **Em análise**. Para ter o sinal de uma, abre o Superplan pela linha, testa o preço de venda e "Gravar no Booking".
4. Aprova as que valem a pena (**Aprovado**): entram na vitrine. Descarta as outras.
5. Escolhe o cliente na barra, digita a quantidade nas linhas e move para **Oferecido** ou **Reservado**.
6. Marca as linhas do cliente → "Gerar solicitação": nasce o lote; as linhas vão para **Virou solicitação** com o link.

## 8. Papéis e permissões

| Quem                                                                                               | O que pode                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador                                                                                      | Tudo.                                                                                                                                                             |
| Operador com a tela Booking (funções comprador, gerente de produto, planner, cadastro; diretorias) | Ver, filtrar, editar cliente, quantidade, responsável e observação, mover entre etapas que não mexem na vitrine, gerar solicitação (se também abre Solicitações). |
| Quem abre o Superplan (hoje só o administrador)                                                    | Além disso: analisar, ver custo, preço de venda, preço para a meta e sinal, aprovar, tirar da vitrine, reabrir (linha cuja solicitação foi cancelada).            |
| Cliente, fornecedor, parceiros                                                                     | Nada: não veem a tela nem os produtos escondidos.                                                                                                                 |

Colunas e filtros de custo, preço de venda, preço para a meta e sinal só existem para quem abre o Superplan (a análise nem sai do servidor para os outros).

## 9. Estrutura do banco de dados

Tabela nova `bookings` (aditiva):

| Coluna                                     | Tipo            | Observação                                                                                         |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `productId`                                | id, obrigatório | único (`product_unique`)                                                                           |
| `status`                                   | enum            | `new`, `analysis`, `approved`, `offered`, `reserved`, `requested`, `discarded`; índice `by_status` |
| `importBatchId`                            | id              | lote da importação; índice `by_batch`                                                              |
| `sourceFileName`                           | texto 200       | planilha de origem                                                                                 |
| `sourceRows`                               | texto 40        | linhas da planilha ("3-5")                                                                         |
| `sourceOrder`                              | inteiro         | primeira linha (ordem da planilha)                                                                 |
| `customerId`                               | id              | cliente da oferta ou reserva                                                                       |
| `reservedQty`                              | inteiro         |                                                                                                    |
| `ownerUserId`                              | id              | responsável                                                                                        |
| `note`                                     | texto 500       | observação                                                                                         |
| `analysis`                                 | JSON            | retrato da análise do Superplan (`manual`: gravada à mão; `inputs`: o que foi usado)               |
| `requestId`, `requestGroupId`              | id              | solicitação gerada; o `requestId` é gravado ao tomar a linha, antes de a solicitação nascer        |
| `requestNumber`                            | inteiro         |                                                                                                    |
| `statusChangedAt`, `statusChangedByUserId` | data, id        | última mudança de etapa                                                                            |
| `createdByUserId`                          | id              | quem importou                                                                                      |

Nenhuma coluna nova nas tabelas que já existem. O "escondido da vitrine" não é uma coluna do produto: sai da etapa da linha (uma fonte só da verdade).

## 10. APIs e integrações

Sem integração externa. Server Actions (todas conferem papel Wellmix e a tela Booking):

- `bulkBookingAction`: a barra de ações (`op` = `assign`, `move`, `owner`, `analyze`, `request`).
- `saveBookingRowAction`: o formulário da página da linha.
- `saveBookingAnalysisAction`: "Gravar no Booking" do Superplan (pede também a tela Superplan).
- `reimportSheetToBookingAction` (em `actions/product-sheet-import.ts`): reimportar planilha antiga.

## 11. Automações

- A importação cria as linhas, liga à planilha e põe o importador como responsável.
- "Analisar no Superplan" em lote, com os valores padrão (câmbio do dia, container e tipo de negócio padrão, despesas dos parâmetros, II/IPI do NCM).
- Analisar leva de Novo para Em análise; gerar solicitação leva para "Virou solicitação".
- Aprovar põe o produto na vitrine sem outro passo.
- Digitar a quantidade numa linha já marca a linha; escolher um filtro de opção ou de data já filtra.

## 12. Relatórios, 13. Dashboards, 14. Indicadores

Na própria tela: cartões com a contagem por etapa (viram filtro), total filtrado e, para quem abre o Superplan, o filtro "sinal" (viável, abaixo da meta, prejuízo, no preço mínimo, falta dado, sem análise).

## 15. Auditoria

Toda mudança grava em `audit_log` (entidade `booking`): `booking.create` (importação), `booking.move` (etapa), `booking.update` (cliente, quantidade, responsável, observação), `booking.analysis`, `booking.request`, `booking.release` (a solicitação foi excluída e a linha voltou) e `booking.sweep` (linha sem produto retirada), com o antes e o depois. A página da linha mostra o histórico. O registro de `booking.analysis` guarda só a etapa e a data: **custo, preço, lucro e sinal não vão para a auditoria**, porque a tela Auditoria é aberta por quem não abre o Superplan. A solicitação que nasceu pela metade e foi cancelada fica como `request.batch_rollback`.

## 16. Segurança

- Página com `requireScreen("booking")`; toda ação e todo serviço conferem papel Wellmix e a tela; aprovar e analisar conferem a tela Superplan; gerar solicitação confere a tela Solicitações.
- Cliente, fornecedor e parceiros não recebem nada do Booking.
- Fornecedor sem login: a planilha cadastra o fornecedor (Cadastros → Fornecedores) sem login. O Booking mostra o aviso "Fornecedor do Booking sem acesso ao portal" e o selo "Sem acesso" na coluna Fornecedor (`options.suppliersWithoutLogin`, só logins ativos contam), com o atalho para o quadro de acesso do cadastro. O login criado ali fica preso ao cadastro (`docs/ARQUITETURA.md`, Convenções) e enxerga o que já tinha sido enviado, porque cotações e pendências são do cadastro, não do login.
- Produto escondido não abre para o cliente nem pelo endereço direto: vitrine, página do produto, carrinho, nova solicitação (lista, envio e nome do produto), busca por foto (o produto nem vai para a IA), fotos da vitrine e documentos do produto (`/api/files`), kit de marketing novo. A recusa é a mesma para "não existe", "desativado" e "escondido" (não dá para descobrir se um produto existe).
- Entradas validadas no servidor (zod): ids, quantidade, etapa, texto com tamanho máximo, simulação do Superplan (números com limite).
- Nada foi afrouxado: todas as mudanças nas telas do cliente só acrescentam restrição.

## 17. Limites conhecidos

- A lista lê todas as linhas e filtra em memória (como as outras telas). O armazenamento devolve até 10.000 linhas por leitura; muito antes disso vale arquivar os descartados.
- A marcação das linhas vale para a página atual (100 linhas) e se perde ao filtrar ou trocar de página. Depois de uma recusa ela volta (guardada no navegador, por login).
- A linha tomada cuja solicitação não nasceu só pode ser devolvida depois de 2 minutos (antes disso a criação pode estar em andamento). Numa chamada que demore mais do que isso, a linha devolvida no meio tem a solicitação daquela chamada cancelada no fecho.
- Resposta perdida ao criar o produto: se o servidor ainda estiver gravando quando a importação confere, a linha sai e o produto pode nascer sem ela; é uma janela de milissegundos numa falha rara de rede.
- "Gravar no Booking" recusado por número fora do limite: a mensagem diz que há um valor inválido na simulação, mas a calculadora ainda não marca qual campo.
- O armazenamento não tem "trocar só se ainda estiver como li". O "Gerar solicitação" toma as linhas com o id da solicitação, relê antes de criar e relê de novo no fecho (cancelando a própria solicitação se a linha deixou de ser dele), o que cobre o toque duplo, duas abas e dois logins. Sobra o caso de duas chamadas simultâneas em que o servidor de uma delas cai antes do fecho: aí podem ficar duas solicitações, e a que sobra é excluída à mão.
- Na lista, a linha em "Virou solicitação" ainda sem o número da solicitação é conferida no banco (existe ou não); as que já têm número não são conferidas de novo.
- Nos filtros de número, colunas de peças e caixas leem "1.200" como mil e duzentos; preço, peso e CBM leem o ponto como decimal.
- A foto da linha é o arquivo original (o `/api/files` não gera miniatura).
- O navegador guarda a foto por até uma hora: esconder de novo um produto não apaga a foto que o cliente já abriu.

## 18. Melhorias futuras

- Reserva por vários clientes no mesmo produto e quantidade por cor.
- Ler as colunas da Wellmix na planilha da feira (caixas por programação, total de peças, CBM e containers): o plano de compra já viria pronto.
- Reanalisar sozinho quando o câmbio ou o frete mudam e avisar quem passou de verde para amarelo ou vermelho.
- Cartão do Booking na Control Tower (antes do pedido).
- Aviso ao responsável quando a linha dele é aprovada, e ao cliente quando um produto oferecido a ele entra na vitrine.
- Colunas escolhidas e filtros salvos por login; exportar a lista filtrada.
