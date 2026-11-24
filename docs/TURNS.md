# De quem é a vez: responsabilidade e Pendências

Pedido do dono (18/11/2026): se existe uma ação a fazer, o sistema mostra qual é a ação, de quem é a vez e põe a ação nas Pendências de quem pode executá-la. A mesma regra vale nas listas, nos detalhes, nos cartões, nas Pendências e no Painel de SLA.

## 1. Como o sistema sabe de quem é a vez

Nada é gravado de novo. A vez é calculada na leitura, a partir do estado atual dos registros. Por isso os registros que já estavam em andamento mostram a vez certa, e concluir uma ação encerra a pendência sem passo extra.

As fontes são as regras que já existiam, agora usadas em todo lugar:

| Registro                       | Regra (fonte única)                                                                                                           | Onde está                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Partes, textos, tom e filtro   | `TURN_PARTIES`, `partyOfRole`, `turnWaitingKey`, `turnWithKey`, `turnNameKey`, `turnTone`, `turnCounts`                       | `src/lib/turn.ts`                                                      |
| Encomenda (solicitação)        | `requestNextStep`: a ação (`key`) e quem está com a vez (`who`)                                                               | `src/lib/services/request-list.ts`                                     |
| O que a encomenda precisa ler  | `requestTurnContext`, `requestStepsFor` e `canConfirmAs` (o mesmo `canConfirm` do cartão de confirmação)                      | `src/lib/services/request-turns.ts`                                    |
| Estratégia e cotação de compra | `inStrategyQueue`, `awaitingStrategySend`, `quoteClosed` e `quoteEmpty` (as regras das pendências da estratégia e da cotação) | `services/purchase-strategy.ts`, `services/purchase-quote.ts`          |
| Solicitação ao fornecedor      | `negotiationTurn` (com a contraproposta) e `samplingTurn`                                                                     | `src/lib/supplier-requests.ts`, `src/lib/supplier-request-sampling.ts` |
| Pedido                         | `responsibleOfItems`: o papel do próximo item obrigatório do marco atual (guardado no resumo do pedido como `resp`)           | `src/lib/milestones.ts`, `services/order-summary.ts`                   |

Cada papel vira uma parte (`partyOfRole`):

- o administrador e os operadores são a parte **Wellmix**;
- o fornecedor do tipo Trading aparece como **Trading**;
- os outros papéis são a própria parte (cliente, fornecedor, agência, certificadora (OCP), despachante, comex, agente de carga, companhia marítima, transportadora, agência de marketing, jurídico);
- **Sem responsável definido** (`unassigned`) é quando falta informação para saber quem age; o caso vai para quem administra o fluxo.

A situação diz quem está com a vez ("Aguardando cliente"); o Próximo passo diz a ação ("Confirmar pedido") e com quem ("com o cliente"). Para o cliente, a contraparte é sempre a Wellmix (a compra e o pedido são internos); quem está com a vez lê "Aguardando você".

## 2. Mapa dos fluxos

### Encomenda até o pedido de compra

| Etapa                                                                 | Ação (Próximo passo)                                  | Com quem             | Quem recebe a pendência                                                                                                                                                                                          | Depois                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Venda pela Wellmix aguardando o cliente                               | Confirmar pedido                                      | Cliente              | o login do cliente com acesso (sem login escolhido, todos os logins do cliente): "Confirmar pedido", uma por encomenda; lembrete diário (docs/ORDER_TERMS.md, 11.27)                                             | cotação na hora (sem parceiro apto: fila da Estratégia)                     |
| Ninguém pode confirmar (cliente sem login ou login escolhido inativo) | Definir o login do cliente que confirma               | Sem responsável      | o administrador: "Login do cliente a definir" (abre a encomenda ou o cadastro do cliente); no balão "Quem pode agir" de Encomendas, o administrador cria o login ali mesmo (docs/ORDER_LEVEL_LISTS.md, seção 10) | volta para o cliente                                                        |
| Venda confirmada pelo cliente (dono, 22/11/2026)                      | Responder a cotação de compra                         | Fornecedor           | vira cotação na hora (docs/PURCHASE_DEMAND.md, "Encomenda vira cotação na hora"); só o produto fora do catálogo fica na fila                                                                                     | a Wellmix escolhe a vencedora                                               |
| Encomenda aberta pelo próprio cliente (dono, 22/11/2026)              | Responder a cotação de compra                         | Fornecedor           | vira cotação na hora, o lote inteiro numa cotação só (docs/PURCHASE_DEMAND.md, "Encomenda vira cotação na hora")                                                                                                 | a Wellmix escolhe a vencedora                                               |
| Na fila                                                               | Escolher a estratégia de compra                       | Wellmix              | quem escolhe a estratégia (`purchaseStrategy.choose`)                                                                                                                                                            | pedido direto ou cotação                                                    |
| Pedido direto                                                         | Aprovar a estratégia de compra                        | Wellmix              | Diretoria de compras (`purchaseStrategy.approve`)                                                                                                                                                                | recusada: volta à fila (devolução); aprovada: gerar o pedido                |
| Pedido direto aprovado                                                | Gerar o pedido de compra                              | Wellmix              | `purchaseOrder.generate`                                                                                                                                                                                         | pedido                                                                      |
| Cotação aberta, no prazo                                              | Responder a cotação de compra                         | Fornecedor           | cada parceiro convidado, o seu convite                                                                                                                                                                           | encerra no prazo ou com todos respondidos                                   |
| Cotação encerrada (com ou sem resposta)                               | Escolher a vencedora / Decidir a cotação sem resposta | Wellmix              | `purchaseQuote.choose`                                                                                                                                                                                           | escolhida                                                                   |
| Vencedora escolhida                                                   | Aprovar a vencedora da cotação                        | Wellmix              | `purchaseQuote.approve`                                                                                                                                                                                          | recusada: volta a escolher (devolução); aprovada: solicitação ao fornecedor |
| Solicitação ao fornecedor respondida                                  | Decidir a resposta do fornecedor                      | Wellmix              | quem decide (`supplierRequest.decide`): **pendência nova** "Decidir a resposta do fornecedor"                                                                                                                    | contraproposta (devolução ao fornecedor), aprovação ou recusa               |
| Contraproposta da Wellmix                                             | Responder a solicitação                               | Fornecedor           | o fornecedor da solicitação                                                                                                                                                                                      | volta à Wellmix                                                             |
| Amostragem da aprovada                                                | Carregar a amostragem / Validar a amostragem          | Fornecedor / Wellmix | o fornecedor / `sampling.validate`                                                                                                                                                                               | aprovada: gerar o pedido de compra                                          |

### Pedido (marcos)

A vez é o papel do próximo item obrigatório do marco atual. Cada item é uma pendência de quem o faz, pelas regras que já existiam (o papel do item, as tarefas por login da arte e do certificado, os passos do embarque, da origem, das amostras e da certificação, a produção):

- **Pedido novo**: a ficha de compra é do fornecedor; o cadastro e a validação são da Wellmix.
- **Certificação**: a certificadora (OCP) do pedido; sem ela, a Wellmix designa.
- **Material de arte (Die Cut)**: o fornecedor.
- **Arte**: a agência (ou a Wellmix); a validação é da Wellmix; a aprovação é do fornecedor.
- **Contrato**: a Wellmix assina, depois o fornecedor (e o aceite do pedido de amostras).
- **Sinal**: o financeiro da Wellmix paga; o fornecedor confirma o recebimento.
- **Pré-produção e Inspeção**: o fornecedor envia; a Wellmix aprova; o SKU reprovado volta ao fornecedor.
- **Amostras**: a Trading retira e envia; a agência de marketing recebe e devolve.
- **Booking, transportadora e carregamento**: o agente de carga e a Trading; os documentos são do fornecedor, da Trading e da companhia marítima.
- **Embarque**: a companhia marítima.
- **Desembaraço, nota e transporte**: o despachante, o comex, o financeiro e a transportadora.
- **Entrega**: a transportadora; o cliente confirma o recebimento.

## 3. Onde aparece

**O status leva ao lugar de agir** (dono, 24/11/2026): em toda linha de tabela, o selo de quem está com a vez é um link para onde se faz a etapa em aguardo, o mesmo lugar da pendência (`StatusLink` e `requestStepHref`; docs/ORDER_TABLES.md, seção 2). Na Próxima ação de Encomendas, todos os passos ganharam o link (antes, só os da solicitação ao fornecedor).

- **Encomendas** (`/app/requests`):
  - a Situação é quem está com a vez (a situação gravada fica na dica);
  - a Próxima ação é a ação e, embaixo, quem deve agir: a pessoa, a equipe (função) ou o parceiro, pela mesma regra das Pendências, com os nomes ao tocar (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 6);
  - "Abertas" e "Atrasadas" contam também a venda aguardando o cliente, por solicitação; o Prazo é o da pendência da etapa;
  - o filtro **Com quem está** (`?vez=`, com a contagem de cada parte) vale também no CSV.
- **Detalhe da encomenda e página do lote**: o selo da vez e o Próximo passo. O cliente que confirma vê "Aguardando você" e, no lote, o atalho "Confirmar pedido".
- **Pedidos** (`/app/orders`): a coluna e o filtro **Com quem está** (`?w=`). No detalhe do pedido, o selo da vez no cabeçalho.
- **Cotações de compra**: o selo da vez ao lado da situação.
- **Solicitações ao fornecedor**: "Aguardando fornecedor" ou "Aguardando Wellmix", com a ação embaixo. Na coluna **Vez** da cotação (tabela dos produtos) e na lista de cotações, a regra é uma só (`supplierRequestTurn`, `src/lib/supplier-request-sampling.ts`; dono, 24/11/2026): na negociação, "Responder a solicitação" (fornecedor) ou "Decidir a resposta do fornecedor" (Wellmix); **aprovada, a amostragem**: "Carregar a amostragem" (fornecedor, pendente ou reprovada; nome do dono, 24/11/2026, antes "Enviar a amostragem") ou "Validar a amostragem" (Wellmix, enviada); com a amostra aprovada, "—". Antes, a aprovada com a amostra pendente aparecia com "—". Na tabela da cotação, para a Wellmix, embaixo vem **quem age** (a mesma peça "Quem pode agir" de Encomendas, `supplierRequestResponsibles`, `src/lib/services/supplier-request-turns.ts`): o nome e a empresa e, no balão, o login, só para o administrador; o fornecedor sem login ativo aparece em aviso, com o atalho para gerar o login. **Login de quem envia à vista** (dono, 24/11/2026: "tem escrito aguardando fornecedor, mas não tem o login de quem vai mandar"): na vez do fornecedor (responder ou carregar a amostragem), embaixo de quem age vem a linha "Login: …" com os logins ativos dele, sem abrir o balão, na tabela da cotação e também na **lista de cotações**, que passou a mostrar quem age (a mesma peça; cada linha com o tipo do seu fornecedor, Trading aparece como Trading). O login continua só para o administrador (`partnerLogins`, `src/lib/request-responsible.ts`; `ResponsibleLogins`, `src/components/request-responsible-tip.tsx`); na vez da Wellmix, a equipe fica no balão.
- **A ação leva ao lugar de agir** (dono, 24/11/2026, com o print da cotação nº 59842):
  - nos passos da solicitação ao fornecedor, o texto da ação é um link para onde ela se faz, o mesmo endereço da pendência (`supplierRequestStepHref`, `src/lib/supplier-request-sampling.ts`);
  - "Responder a solicitação" e "Decidir a resposta do fornecedor" abrem a solicitação;
  - "Carregar a amostragem" e "Validar a amostragem" abrem o produto no quadro da amostragem (`?view=item#amostragem`);
  - vale em três lugares:
    - na lista de cotações (`data-supplier-request-turn-action`), do produto com a vez;
    - na coluna Vez da tabela dos produtos (`data-supplier-table-turn-action`);
    - na Próxima ação de Encomendas (`data-request-next-link`), que leva à solicitação ao fornecedor com a vez (`NextStep.supplierRequestId`). Em Encomendas, só para quem abre a tela de Cotação.
  - O fornecedor vê o link só quando a vez é dele.
  - Na lista de cotações do fornecedor, a vez voltou a mostrar a parte ("Aguardando fornecedor"): desde 24/11/2026 aparecia a chave crua do texto.
- **Pendências**: "Confirmar pedido" (cliente), "Login do cliente a definir" (administrador) e "Decidir a resposta do fornecedor" (Wellmix), além das que já existiam.
- **Painel de SLA**: a venda aguardando o cliente com o prazo vencido aparece em "Parceiros atrasados". A decisão da Wellmix na negociação entra pelas Pendências da equipe, sem repetir a linha.

## 4. Devoluções, trocas e ações simultâneas

- **Concluir** encerra a pendência e mostra a próxima ao novo responsável. Repetir uma ação ou uma nova tentativa não duplica, porque as pendências saem do estado e não são gravadas.
- **Devoluções**:
  - contraproposta, que volta ao fornecedor;
  - vencedora recusada, que volta a escolher;
  - estratégia recusada, que volta à fila;
  - arte reprovada, que volta a quem fez;
  - invoice e BL que não batem, que voltam para refazer.
- **Troca de responsável**: o login do cliente com acesso, o analista e os parceiros do pedido. A pendência passa a ser de quem assumiu, e o anterior deixa de ver.
- **Ações simultâneas**: as raias do pedido de compra (fornecedor, agência, certificadora) e os passos paralelos (amostras e carregamento). Cada responsável recebe a sua; a situação mostra quem segura o marco.

## 5. Testes

- `tests/unit/turns.test.ts`: as partes, os textos nos três idiomas, o filtro e cada passo da encomenda até o pedido de compra.
- `tests/unit/turns-flow.test.ts`: a venda aguardando o cliente em aberto, a pendência só de quem confirma, a troca do login, o caso sem responsável para o administrador e, depois da confirmação, a próxima ação só para quem pode.
- `tests/unit/supplier-request-negotiation.test.ts`: fornecedor × Wellmix com as permissões, a contraproposta e nada duplicado.
- `tests/unit/orders-filter.test.ts` e `tests/unit/request-next-step.test.ts`.
- `tests/e2e/turns.spec.ts`: o caminho no navegador e o filtro da tela Pedidos.

## 6. Decisões de negócio em aberto

1. **Pedido com ações simultâneas**: a lista mostra uma parte, a do primeiro item obrigatório do marco atual. Decidir se mostra todas as partes com ação aberta.
2. **Login do cliente trocado em um produto só do lote**: a confirmação vale para o lote inteiro. Decidir se a troca do login com acesso passa a valer para o lote todo.
3. **Prazo e lembrete da confirmação do cliente**: decidido em 22/11/2026. Um lembrete por dia até o limite das Configurações (padrão 3) e, com o último, o vendedor é avisado (docs/ORDER_TERMS.md, 11.27). Confirmada, a cotação sai sozinha (docs/PURCHASE_DEMAND.md, "Cotação na confirmação do cliente").
4. **Compra para estoque e solicitação que não é encomenda**: o Próximo passo é "Analisar a solicitação". Definir a ação esperada.
5. **Depois da amostragem aprovada**: "Gerar o pedido de compra" aparece no Próximo passo e no Control Tower, mas ainda não é pendência de ninguém. Definir quem recebe.
6. **Parceiro do papel não designado no pedido** (por exemplo, sem agente de carga): hoje a Wellmix faz a parte dele. Decidir se vira pendência de designar o parceiro.
7. **"Reposição" e "Encomenda nova" para quem não escolhe a estratégia**: continuam nas Pendências desses logins (decisão de 15/11/2026), embora a ação seja do Comprador.
