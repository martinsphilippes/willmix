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

Tabela `supplier_requests` (docs/APPWRITE.md): `number` (contador `supplier_request_number`), `status`, `supplierId` (índice `by_supplier`), `bookingItemId` (índice `by_item`), `bookingLotId`, `alternativeItemIds` (JSON), `item` (JSON, cópia do item), `quantity`, `unit`, `needs`, `searchQuery`, a resposta (`supplierCanDo`, `supplierPrice`, `supplierCurrency`, `supplierMoq`, `supplierLeadTimeDays`, `supplierNote`, `respondedAt`, `respondedByUserId`), a decisão (`decidedAt`, `decidedByUserId`, `decisionNote`) e `createdByUserId`; índice `by_status`. Antes de `npm run appwrite:push`, as telas avisam "esquema desatualizado".

## Onde está

| Parte                                                       | Arquivo                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Regras puras (busca, parecidos, US$, melhor caso, decisões) | `src/lib/supplier-requests.ts`                                     |
| Serviço (seleção, abrir, ler, responder, decidir, foto)     | `src/lib/services/supplier-requests.ts`                            |
| Ações                                                       | `src/app/app/actions/supplier-requests.ts`                         |
| Telas                                                       | `src/app/app/booking/selection/`, `src/app/app/supplier-requests/` |
| Textos                                                      | `src/i18n/modules/supplier-requests.ts`                            |
| Testes                                                      | `tests/unit/supplier-requests.test.ts`                             |

## Próximo passo

Solicitação aprovada → criar o produto no portal (nome correto dado pelo analista) ou associar a um existente, ligar a ele os itens iguais de vários bookings (`booking_items.productId`) e refletir no Sankhya (ligar ao CODPROD que já existe; criar no ERP fica para quando a gravação no Sankhya estiver validada).
