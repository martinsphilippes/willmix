# Nova solicitação por tipo de operação: TS - Trading Sales e Venda - Encomenda

Pedido do dono (16/11/2026): duas telas de nova solicitação no módulo **Produto novo**, iguais à Nova solicitação da Wellmix (docs/ORDER_TERMS.md), com regras de negócio separadas pelo tipo de operação. A Nova solicitação que fica em **Encomendas** (`/app/requests/new`) não muda: mesma rota, mesmo funcionamento, mesmos dados e regras. O que fazer com ela, o dono decide depois.

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

## 2. Menu

No menu lateral **Produto novo**, logo abaixo de **Overview**, nesta ordem: **TS - Trading Sales** e **Venda - Encomenda** (`withRequestScreens` em `src/lib/nav.ts`). Cada item aparece só para quem abre a tela dele.

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

## 5. Fica para o dono decidir

- O que fazer com a Nova solicitação de Encomendas (hoje igual a antes, com TS marcado e Venda "(em breve)").
- Se a função **Vendas** (que lança encomendas em nome do cliente) deve abrir "Venda - Encomenda" por padrão. Pelo pedido, ficou "conforme a configuração": o administrador marca em Funções e acessos.
- Se "Gestor" e "Liderança" devem ser funções próprias (criadas em Funções e acessos) em vez do Gerente de produto e das diretorias.
