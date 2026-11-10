# Seleção de itens e solicitação ao fornecedor

Decisão do dono (10/11/2026): depois de carregar muitos bookings (docs/BOOKING.md, seção 0), a Wellmix compara itens parecidos de vários bookings, escolhe o melhor caso e abre a **solicitação ao fornecedor** dele. Nesta etapa **não nasce produto, cliente nem estoque**: a Wellmix está avaliando itens que estão na fábrica do fornecedor e perguntando se ele faz o que ela precisa. O produto só é criado (ou associado a um existente) depois que a solicitação for aprovada com o fornecedor; essa é a etapa seguinte, ainda não construída.

O dono também registrou que a "Solicitação" que já existia (a do cliente, `requests`) deveria ter sido sempre ao fornecedor. Como ela sustenta todo o fluxo de cotação, pedido e embarque (e o E2E), a solicitação ao fornecedor nasceu como registro próprio (`supplier_requests`), sem mexer na antiga. Rever a solicitação antiga é uma decisão à parte.

## Telas

| Tela                               | Rota                          | Quem                                                |
| ---------------------------------- | ----------------------------- | --------------------------------------------------- |
| Seleção de itens                   | `/app/booking/selection`      | Wellmix com a tela Booking                          |
| Solicitações ao fornecedor (lista) | `/app/supplier-requests`      | Wellmix e fornecedor com a tela Cotações (`quotes`) |
| Uma solicitação                    | `/app/supplier-requests/[id]` | idem; o fornecedor só a própria                     |

A Seleção de itens **substitui a fila de produtos** do Booking: o botão da tela `/app/booking` agora leva a ela. A rota `/app/booking/products` continua existindo (evolução aditiva), sem link na tela principal. No menu, Pedidos ganhou "Seleção de itens" e "Solicitações ao fornecedor"; o fornecedor ganhou "Solicitações ao fornecedor" ao lado de Cotações.

### Seleção de itens

- Mostra os itens dos bookings **Fechados, Em andamento ou Concluídos** (rascunho e cancelado ficam fora), até 200 de cada vez, ordenados pela descrição para os parecidos ficarem juntos.
- **Busca por parte da descrição**: cada palavra digitada tem de aparecer (parte da palavra vale) na descrição, nome, código, nº do item, material, embalagem ou cores, sem acento nem caixa (`itemSearchText`, `matchesItemSearch`). "Ver parecidos" em cada item busca pelas duas primeiras palavras significativas da descrição (`similarQuery`).
- Colunas: escolher (um), alternativa (vários), foto, item (descrição, código, cores), fornecedor e origem, booking (nº e data, com link), preço e incoterm, preço em US$ (RMB convertido pela cotação do dia), MOQ, qtd/caixa e inner, CBM, medidas, capacidade, material e embalagem, quantidade da planilha, Superplan (sinal e preço mínimo) e a solicitação em andamento do item.
- O item de **menor preço mínimo do Superplan** entre os mostrados fica destacado ("Melhor preço mínimo", `bestMinimumItem`).
- Abrir: o item escolhido, as alternativas, a **quantidade** (em branco = a da planilha: PURCHASE QTY IN PCS, senão TT PCS; sem nenhuma, a tela pede a digitada) e **o que a Wellmix precisa no produto** (texto livre que o fornecedor lê).

### Regras da solicitação

1. Uma solicitação **por item escolhido**; o item com solicitação Aberta ou Respondida recusa outra (`supplier_request_exists`). Depois de decidida, pode ter outra.
2. Vai ao **fornecedor do booking** do item (ativo). O booking Fechado passa a Em andamento.
3. A solicitação guarda uma **cópia do item** (`item`), para o fornecedor ver o que foi pedido mesmo que o booking mude.
4. **Alternativas**: até 30 itens parecidos, guardados por id. Só a Wellmix vê (com fornecedor, origem, preço, mínimo do Superplan e link para o booking).
5. Situações: **Aberta** (esperando o fornecedor) → **Respondida** → **Aprovada** ou **Recusada**; **Cancelada** pela Wellmix. Decisões possíveis (`supplierRequestDecisions`): Aberta → Cancelar ou Recusar; Respondida "faz" → Aprovar ou Recusar; Respondida "não faz" → Recusar.
6. **Resposta do fornecedor**: faz ou não faz; se faz, preço por peça (obrigatório) e moeda; pedido mínimo, prazo de produção (dias) e observação. Muda até a Wellmix decidir. A Wellmix pode **registrar a resposta** em nome dele quando ela chega por fora (WeChat, e-mail).
7. Avisos (sino, e-mail e WhatsApp em modo mock): ao fornecedor quando a solicitação abre e quando a Wellmix decide; a quem abriu, quando o fornecedor responde.

## Isolamento

- O fornecedor vê só as solicitações do próprio cadastro (`supplierId` = `user.partyId`); a de outro dá 404. Não vê as alternativas (outros fornecedores), o Superplan nem o booking.
- A foto do item (documento interno do booking) abre para o fornecedor dono de uma solicitação com aquela foto (`supplierSeesRequestPhoto`, em `canAccessDocument`). Outro fornecedor, não.
- Cliente e demais parceiros não abrem as telas.

## Banco

Tabela `supplier_requests` (docs/APPWRITE.md): `number` (contador `supplier_request_number`), `status`, `supplierId` (índice `by_supplier`), `bookingItemId` (índice `by_item`), `bookingLotId`, `alternativeItemIds` (JSON), `item` (JSON, cópia do item), `quantity`, `unit`, `needs`, `searchQuery`, a resposta (`supplierCanDo`, `supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`, `supplierNote`, `respondedAt`, `respondedByUserId`), a decisão (`decidedAt`, `decidedByUserId`, `decisionNote`), `createdByUserId` e o produto (`productId`, com índice `by_product`, `productAction` created/linked, `productLinkedAt`, `productLinkedByUserId`, `showcaseReleasedAt`, `showcaseReleasedByUserId`, `erpCheckedAt`); índice `by_status`. `products` ganhou `erpCode` (CODPROD do Sankhya), opcional e só gravado quando informado. Antes de `npm run appwrite:push`, as telas avisam "esquema desatualizado".

## Onde está

| Parte                                                       | Arquivo                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Regras puras (busca, parecidos, US$, melhor caso, decisões) | `src/lib/supplier-requests.ts`                                     |
| Serviço (seleção, abrir, ler, responder, decidir, foto)     | `src/lib/services/supplier-requests.ts`                            |
| Ações                                                       | `src/app/app/actions/supplier-requests.ts`                         |
| Telas                                                       | `src/app/app/booking/selection/`, `src/app/app/supplier-requests/` |
| Textos                                                      | `src/i18n/modules/supplier-requests.ts`                            |
| Testes                                                      | `tests/unit/supplier-requests.test.ts`                             |

## Produto (depois de aprovada; decisão do dono, 10/11/2026)

Na solicitação **Aprovada**, a Wellmix que abre Cotações e Produtos vê o bloco **Produto**, no próprio detalhe da solicitação.

1. **Criar produto novo**: o analista dá o **nome correto** e escolhe a **linha de produto**. O resto vem preenchido:
   - **Preço, moeda e MOQ da resposta do fornecedor** (os negociados). Sem preço na resposta, valem os do booking.
   - Código da fábrica, medidas, caixa, pesos, CBM, capacidade, embalagem, material, cores e função vêm do item. A ficha mestre é gravada com esses valores (`sheetFromRequest`).
   - O fornecedor da solicitação entra como **principal**. A foto do item é copiada para o produto ("foto do fornecedor").
   - O que a Wellmix pediu ("needs") vai para as observações da ficha.
2. **Associar a um produto existente**: busca no catálogo por nome, código, código da fábrica ou CODPROD, e escolha de um produto ativo. O cadastro dele não muda.
3. **Itens iguais**: o item escolhido sempre entra. As alternativas da solicitação já vêm marcadas, e a busca acha mais itens nos bookings fechados que ainda não têm produto.
   - Todos ficam ligados ao produto (`booking_items.productId`).
   - O fornecedor de cada item entra na lista de fornecedores do produto (`product_suppliers`): o da solicitação com preço, moeda, MOQ e prazo da resposta (`source` "quote"); o de uma alternativa com código e preço do booking ("manual").
   - Item já ligado a outro produto recusa (`request_product_item_taken`).
   - Depois de criado ou associado, "Ligar mais itens" acrescenta outros.
4. **Vitrine**: o produto **criado** nasce **fora da vitrine do cliente** (vitrine, página do produto, carrinho, nova solicitação e kit de marketing) até "Liberar na vitrine". O produto **associado** já existia e não muda. A regra fica em `booking-visibility.ts`, junto com a do Booking.
5. **Sankhya**: só **ligar ao CODPROD que já existe**; o produto não é criado no ERP.
   - A busca usa a descrição (parte) ou a referência do fornecedor (`Produto`: CODPROD, DESCRPROD, REFFORN) e um botão "Usar" em cada resultado.
   - O código também pode ser digitado. Ele é gravado em `products.erpCode`.
   - Com o Sankhya configurado, o código é **conferido** no ERP (inexistente recusa). Sem credencial, ou com o ERP fora do ar, fica gravado como **não conferido**, e a tela diz isso.
6. **Depois**: o pedido de compra ao fornecedor é outra etapa (ainda não construída).

Tudo fica na auditoria: `product.create`, `product.link_booking`, `product.showcase_release` e `product.erp_code`.
