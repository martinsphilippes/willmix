# Nova solicitação por tipo de operação: TS - Trading Sales e Venda - Encomenda

Pedido do dono (16/11/2026): duas telas de nova solicitação, iguais à Nova solicitação da Wellmix (docs/ORDER_TERMS.md), com regras de negócio separadas pelo tipo de operação. **Desde a segunda decisão do dono (16/11/2026) elas não estão mais no menu**: abrem pelos botões "+ Adicionar" de Encomendas (TS) e de Reposição (Venda); ver as seções 2 e 7. A Nova solicitação que fica em **Encomendas** (`/app/requests/new`) não muda: mesma rota, mesmo funcionamento, mesmos dados e regras. O que fazer com ela, o dono decide depois.

## 1. As duas telas

| Tela                   | Rota                    | Chave de acesso | Tipo de operação gravado |
| ---------------------- | ----------------------- | --------------- | ------------------------ |
| **TS - Trading Sales** | `/app/new-request/ts`   | `requestTs`     | TS (Trading Sales)       |
| **Venda - Encomenda**  | `/app/new-request/sale` | `requestSale`   | Venda                    |

- **Mesmo formulário, mesmo visual:**
  - os blocos de sempre: Cliente, Login do cliente com acesso, Solicitante, RCA do cliente, Condições do pedido, produtos com a programação, prazo e observação, Salvar rascunho e Enviar;
  - na lateral, a Composição de containers e o Histórico de compras do cliente.

  O código é um só: `renderNewRequest` em `src/app/app/_new-request/new-request-screen.tsx`, chamado pelas três páginas (Encomendas com `mode` nulo, TS com `"ts"` e Venda com `"sale"`).

- **Identificação:** o título é o nome da tela ("TS - Trading Sales" ou "Venda - Encomenda"), com a explicação embaixo de que o tipo de operação é definido pela tela.
- **Tipo de operação fixo pela tela:** em "Tipo de operação" aparece só o tipo da tela, já marcado, com a nota "Definido pela tela…". O servidor grava o tipo da tela e ignora o que vier no formulário (`resolveOrderTerms(…, { operationType })`). Não dá para criar, por engano, uma solicitação de outro tipo.
- **Regras do tipo, as que já existiam** (`src/lib/order-terms.ts`):
  - **TS** é importação, então **BRASIL** não vale como país de origem;
  - na **Venda**, BRASIL vale (a regra que já estava pronta para "quando Venda for liberada").

  Todo o resto é igual nas duas: formato de venda (WD ou Wellmix com o nível), quem chama o transportador, re-despacho, país e família, login do cliente obrigatório, contatos, aviso "sem devoluções" na confirmação do cliente e a solicitação nascendo "Aguardando confirmação do cliente". O fluxo depois disso é o da encomenda (docs/PURCHASE_DEMAND.md): estratégia de compra, pedido ou cotação de compra.

- **Só a venda ao cliente:** nas duas telas não há "Compra para estoque (sem cliente)", porque sem cliente não há tipo de operação; o servidor recusa com `request_screen_stock`. Também não há "Adicionar produto" a uma solicitação existente. As duas coisas continuam na tela de Encomendas.
- **Rascunhos por tela:** o rascunho guarda a tela de onde veio (campo `requestScreen` no conteúdo, gravado pelo servidor). Cada tela lista, reabre e apaga só os dela. Os rascunhos de antes (sem a marca) continuam só em Encomendas.
- **Depois de enviar:**
  - quem abre Encomendas vai para a solicitação criada, como antes;
  - quem não abre Encomendas volta à tela com o aviso "Solicitação nº N criada".

## 2. Menu e botões "+ Adicionar"

**Fora do menu** (dono, 16/11/2026: estavam listadas de forma equivocada). Quem abre cada tela:

| Onde                             | Botão           | Abre                                                                                                      |
| -------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Encomendas (`/app/requests`)     | **+ Adicionar** | **TS - Trading Sales** (`/app/new-request/ts`); sem a tela `requestTs`, a Nova solicitação de Encomendas. |
| Reposição (`/app/replenishment`) | **+ Adicionar** | **Venda - Encomenda** (`/app/new-request/sale?from=replenishment`); ver a seção 7.                        |

- O botão de Encomendas é só da Wellmix (o cliente cria pela vitrine, como sempre). Quem não abre TS (a função Vendas, por exemplo) segue para `/app/requests/new`: ninguém perde o caminho que já tinha.
- O botão de Reposição aparece para quem tem a ação `replenishment.open` (abre a entrada da Reposição) ou, sem ela, para quem abre `requestSale` (abre a tela Venda de sempre).
- No menu, **Encomendas** acende em `/app/new-request/ts` e **Reposição** em `/app/new-request/sale` (`match` em `withOpenedScreens`, `src/lib/nav.ts`).
- O endereço direto das duas telas continua valendo, com o acesso da seção 3.

## 3. Acesso (Equipe, Acessos e Parceiros)

As duas telas entram no controle de telas que já existe (`src/lib/auth/screens.ts`), sem sistema paralelo:

- o menu (`navFor`);
- a página (`requireScreen`): sem a tela, `/app?denied=requestTs` ou `/app?denied=requestSale`;
- as Server Actions (`assertScreen`): `createTsRequestAction`, `createSaleRequestAction`, `saveScreenRequestDraftAction` e `deleteScreenRequestDraftAction`.

O administrador marca cada tela por função em **Equipe → Funções e acessos** (módulo Produto novo) e, login a login, no Personalizado de **Editar acessos**.

Padrão (pedido do dono), com os perfis que já existem no código:

| Perfil do pedido | Função no portal                                                                               | TS - Trading Sales      | Venda - Encomenda       |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- |
| Comprador        | Comprador (`buyer`)                                                                            | Permitido               | Sem acesso inicial      |
| Administrador    | papel administrador                                                                            | Permitido               | Permitido               |
| Gestor           | Gerente de produto (`product_manager`)                                                         | Permitido               | Permitido               |
| Liderança        | Diretoria de compras e Diretoria executiva                                                     | Permitido               | Permitido               |
| Demais perfis    | Planner, Cadastro, Financeiro, Designer, Comex interno, Qualidade, Vendas e as funções criadas | Conforme a configuração | Conforme a configuração |

- "Gestor" e "Liderança" não existem como função no portal. Foram ligados às funções mais próximas: o Gerente de produto e as duas diretorias. O administrador muda isso em Funções e acessos.
- **Funções já gravadas** (como em produção): a configuração guarda as telas de cada função. A lista nova `knownScreens` diz quais telas existiam quando a função foi salva. Tela nova depois disso vale pelo padrão do código até o administrador salvar a função de novo. As gravadas antes dela usam `LEGACY_SCREENS` (as telas de antes de 16/11/2026). Assim o Comprador, o Gerente de produto e as diretorias recebem as telas novas sem mexer em nada do que o administrador já marcou, e sem alterar dados.
- **Fora da Wellmix**, nunca: as telas não aparecem na Gestão de telas dos parceiros (`GRANTABLE_SCREENS`), e a página recusa quem não é da Wellmix.
- **Consultas do formulário:**
  - quais são: opções do pedido, contatos do cliente, RCA, histórico de compras (portal e Sankhya), previsão de preço, busca e ficha de produto, lupa e CNPJ;
  - valem para quem abre **qualquer** tela de nova solicitação (`canOpenNewRequest`: Encomendas, TS ou Venda). Quem já abria continua abrindo, e quem recebe só uma das telas novas tem o formulário completo.

## 4. Onde está

- Regras e rotas: `src/lib/request-screens.ts`.
- Telas e acesso: `src/lib/auth/screens.ts` (`SCREENS`, `SCREEN_ROUTES`, `FUNCTION_SCREENS`, `SCREEN_GROUPS`, `canOpenNewRequest`), `src/lib/auth/function-access.ts` (`knownScreens`, `LEGACY_SCREENS`), `src/lib/services/team-functions.ts` (grava `knownScreens`) e `src/lib/auth/permission-modules.ts` (módulo Produto novo).
- Páginas: `src/app/app/new-request/ts/page.tsx`, `src/app/app/new-request/sale/page.tsx` e a de Encomendas, `src/app/app/requests/new/page.tsx`, todas com `renderNewRequest`.
- Servidor: `createRequest` em `src/app/app/actions.ts` (com `createRequestAction`, `createTsRequestAction` e `createSaleRequestAction`), `src/app/app/actions/request-drafts.ts`, `src/lib/services/request-drafts.ts` e `resolveOrderTerms` em `src/lib/services/order-terms.ts`.
- Tela: `RequestOrderTerms` (`fixedOperation`) e `RequestCustomerField` (`allowStock`).
- Textos: `src/i18n/modules/request-screens.ts` (pt, en e zh).
- Testes: `tests/unit/request-screens.test.ts`, `tests/unit/order-terms.test.ts` (o tipo da tela; Venda com BRASIL) e `tests/e2e/request-screens.spec.ts`.

## 6. Programações = entregas previstas ao cliente (textos)

Pedido do dono (16/11/2026): nas telas TS e Venda, a programação é a data em que o **cliente deve receber** o pedido, não a de produção, embarque ou saída da mercadoria. Só os textos mudam. O conceito de programação, os cálculos, os intervalos, as regras de datas, a distribuição das quantidades, a composição dos containers e os nomes técnicos (código e banco) ficam como estão.

| Antes                                  | Nas telas TS e Venda                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Datas das programações                 | Datas previstas de recebimento pelo cliente                                                             |
| Data da 1ª programação                 | Data prevista do 1º recebimento                                                                         |
| Programação 1: 16/03/2027              | Programação 1 — Recebimento previsto: 16/03/2027                                                        |
| Programações (número)                  | Quantidade de entregas programadas                                                                      |
| Intervalo entre programações           | Intervalo entre recebimentos previstos                                                                  |
| Programação de compra do pedido        | Programação de entregas ao cliente                                                                      |
| Pedido em: 16/03/2027 (cartão)         | Recebimento previsto: 16/03/2027                                                                        |
| Composição: Programação 1 / 16/03/2027 | Programação 1 / Recebimento previsto: / 16/03/2027 (três linhas curtas, para a coluna caber na lateral) |

- **Onde:**
  - o bloco do pedido: título, explicação, quantidade de entregas, intervalo, 1º recebimento, datas, primeira data permitida, troca e volta da data e avisos de ordem;
  - os cartões de cada produto ("Recebimento previsto: data");
  - o gerador pela quantidade: título, explicação, quantidade de entregas, containers por entrega, resultado, avisos de caixas e falta de dados;
  - a Composição de containers: explicação e, em cada coluna, "Programação N" com "Recebimento previsto:" e a data embaixo, em linhas curtas para a coluna caber na lateral;
  - as recusas do envio que falam das datas (`schedule_too_soon`, `schedule_out_of_order`, `schedule_mismatch`, `schedule_product_changed`) e a da etapa depois de criar (`after_create`: "anexo, foto da busca ou entregas programadas ao cliente").
- **Como:** os textos ficam em `src/i18n/modules/delivery-schedule.ts` (pt, en e zh, chaves `deliverySchedule.*`). `src/components/delivery-schedule-labels.ts` troca, por cima dos rótulos de sempre, só os que falam das programações; `renderNewRequest` usa esses rótulos quando `mode` é "ts" ou "sale". Os componentes ganharam dois rótulos opcionais, que só as telas novas passam: `receipt` no bloco do pedido (`OrderPlanLabels`) e `roundDate` na Composição (`ContainerCompositionLabels`). Sem eles, a tela mostra o que mostrava.
- **Não muda:** a Nova solicitação de Encomendas, a Seleção de itens, o pedido, a ficha de compra e as outras telas que falam de programação; ficam com os textos de antes.
- **Revisão completa** (dono, 16/11/2026, segundo pedido com o mesmo padrão): conferidos todos os textos que as telas TS e Venda recebem (bloco do pedido, cartões, gerador, Composição, recusas, nos três idiomas). Faltava só a recusa `after_create`; um teste confere que toda recusa do envio que fala de programação tem a versão das entregas. **Fica como está**, de propósito, o histórico de compras do cliente na lateral ("Pedidos da programação", "Rodada N, prevista para…"): são as rodadas da programação de compra dos pedidos antigos, de todos os fluxos, e a data delas não é a de recebimento pelo cliente.
- **Testes:** `tests/unit/delivery-schedule-labels.test.ts` e `tests/e2e/request-screens.spec.ts`. O E2E confere o bloco do pedido, os chips "Programação N — Recebimento previsto", o cartão do produto e a Composição em TS e Venda, e os textos de sempre em Encomendas.

## 7. Reposição: o "+ Adicionar" abre a tela Venda como compra para estoque

Pedido do dono (16/11/2026): o bloco "Abrir reposição" da página de Reposição saiu; o caminho natural é o botão **+ Adicionar** do alto da página, que abre a tela Venda - Encomenda. Como a reposição é compra para estoque (sem cliente) e a Venda sempre recusou o estoque, a entrada da Reposição tem regra própria (decisão do dono):

- **Entrada:** `/app/new-request/sale?from=replenishment` (`src/lib/request-screens.ts`: `REPLENISHMENT_QUERY`, `isReplenishmentEntry`). Título "Reposição - Adicionar".
- **O que muda nessa entrada** (o resto é a tela Venda de sempre):
  - a caixa "Compra para estoque" aparece e começa marcada; desmarcada e com cliente, vale a Venda de sempre;
  - na compra para estoque a solicitação nasce com a **origem reposição** (`origin = "replenishment"`, empresa "Estoque Wellmix", sem cliente nem condições do pedido) e cai na fila de Reposição, com a etiqueta de reposição na lista geral; ao enviar, volta a `/app/replenishment?opened=<id>`;
  - só produto do catálogo (`replenishment_product`), como era no "Abrir reposição";
  - sem rascunhos (o formulário é curto) e com os textos de programação de sempre (a data não é recebimento previsto pelo cliente).
- **Acesso:** entra quem tem a ação `replenishment.open` (padrão: Planner) e abre Encomendas (`requests`), **mesmo sem a tela `requestSale`**; o servidor confere as duas coisas (`createSaleRequestAction`). Vender a um cliente por essa entrada continua pedindo `requestSale`. Fora da entrada, a Venda recusa o estoque como antes (`request_screen_stock`).
- **O que não mudou:** `openReplenishment` e `openReplenishmentAction` seguem no código (sem tela); a recompra do pós-venda continua entrando na mesma fila.

## 5. Fica para o dono decidir

- O que fazer com a Nova solicitação de Encomendas (hoje igual a antes, com TS marcado e Venda "(em breve)").
- Se a função **Vendas** (que lança encomendas em nome do cliente) deve abrir "Venda - Encomenda" por padrão. Pelo pedido, ficou "conforme a configuração": o administrador marca em Funções e acessos.
- Se "Gestor" e "Liderança" devem ser funções próprias (criadas em Funções e acessos) em vez do Gerente de produto e das diretorias.
