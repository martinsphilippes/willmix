# Programação de compra (rodadas de pedido)

Decisão do dono (12/11/2026). Ao gravar a escolha do grupo na Seleção de itens (`/app/booking/selection?tab=selection`), a Wellmix pode oferecer ao fornecedor uma **programação de compra para os próximos meses**: em vez de uma quantidade só, diz em quantas rodadas compra, quantas peças em cada uma e o intervalo de dias entre elas.

Decisões do dono (12/11/2026):

- **Pai = total; um filho por rodada.** O pedido de compra gerado vira o **pedido pai**: guarda o total, a negociação e a Preparação. Cada rodada nasce como **pedido filho** no dia combinado.
- **O filho copia as artes e o certificado, mas assina o próprio contrato.**
- **A data da 1ª rodada é escolhida na Seleção**; as outras são 1ª data + intervalo × (n − 1).

O mecanismo é o mesmo da programação de entregas da solicitação do cliente (`RequestScheduleFields` e `parseRequestSchedule`, `src/lib/workflow/request-schedule.ts`), com até **12 rodadas** (`MAX_PURCHASE_ROUNDS`; a do cliente segue com 6).

## 1. Na Seleção (escolha do grupo)

- Abaixo da quantidade, "Comprar em rodadas nos próximos meses?" → **+ Programação de compra**.
- Escolhe-se o intervalo (30, 45, 60 dias ou outro), a data da 1ª rodada e as peças de cada rodada (o total é dividido igualmente ao ligar; cada rodada pode ser editada; "+ Rodada" acrescenta).
- **Gerar programação pela quantidade** (regra do dono, 12/11/2026; substitui o gerador "pela cubagem" do mesmo dia, que pedia os containers por rodada e montava uma rodada por container). Tudo sai da **quantidade de produto**, como na ficha de compra (`generateLots` e `suggestContainerFill`):
  - **Campos numa linha só** (pedido do dono, 13/11/2026): com o cartão "Gravar a escolha do grupo" na largura toda da área de conteúdo, Total de peças, Programações, Container, Containers por rodada, Containers no total e o botão "Gerar programação" ficam lado a lado (os quatro números dividem o espaço). A grade segue a largura do bloco (`@container`): em bloco estreito (tablet em pé, celular) os campos vão para 3 ou 2 colunas.
  - Digita-se o **total de peças** e o **número de rodadas** (1 a 12; na tela o campo se chama **"Programações"**, pedido do dono em 13/11/2026) e escolhe-se o container (tipos de `settings.containerTypes`, padrão 40HC). "Gerar programação" arredonda o total para **caixas master inteiras** do item marcado como escolhido (CBM informado; sem ele, pelas medidas da caixa) e divide as caixas **igualmente** entre as rodadas (o resto vai para as primeiras). Menos caixas que rodadas: ficam as rodadas que dá, com aviso.
  - **Os containers são consequência**: caixas da rodada ÷ caixas inteiras que cabem no container. "Containers por rodada" continua na tela, **só informativo** (não se digita): mostra **quantos containers cada rodada precisa** (um número quando são iguais; "1 a 2" quando diferem) e acompanha a tela, inclusive a prévia antes de gerar. Ao lado dele, **"Containers no total"** (pedido do dono, 12/11/2026), também só informativo: a soma dos containers de todas as rodadas (o mesmo número da última linha do Cálculo).
  - **O cálculo fica sempre escrito** (bloco "Cálculo" do gerador; pedido do dono em 12/11/2026, depois de a conta sumir da tela): a caixa do item ("48 peças por caixa master · 0,0235 m³ por caixa → 2.893 caixas (138.864 peças) por 40HC"), o total ("3 rodada(s) · 63 caixas · 1,48 m³ · 0,02 container(s) 40HC"), o arredondamento para caixas inteiras, os containers de cada rodada com a ocupação ("Cada rodada: 21 caixas · 0,49 m³ = 1 container 40HC, com <1% ocupado", ou a lista rodada a rodada quando diferem) e os containers no total. Aparece com as rodadas da tela e, antes de gerar, com a prévia do total e das rodadas digitados.
  - **De qual item é a caixa**: a do item marcado como escolhido na tabela. **Sem nenhum marcado, a conta usa o primeiro item do grupo que tem peças por caixa master e CBM** e diz qual ("Conta com SKU · Fornecedor", com o aviso para marcar o escolhido): o cálculo, os containers e os botões não somem. Antes, sem item marcado, a tela mostrava só "Marque o item escolhido" e escondia tudo. O rádio marcado também é lido ao abrir e ao voltar para a página (o navegador pode devolvê-lo marcado sem avisar). Rodadas geradas com a caixa de um item e depois outro item marcado: aviso para gerar de novo.
  - **Em cada rodada**, abaixo das peças: caixas, m³ e containers; a situação com a **quantidade de containers** ("1 container: 73% ocupado", "2 containers: o último com 10%", "1 container cheio"); e os **dois botões, sempre**, que mexem só naquela rodada: **+ Aumentar** (acrescenta as peças que faltam para o próximo container cheio) e **− Diminuir** (tira as peças que passam do container cheio de baixo). Sem container cheio abaixo, o "− Diminuir" aparece desligado com o motivo ("menos de 1 container" ou "mínimo de 1 container"): a rodada nunca zera. Valem também com o container já fechado (1 → 2, 2 → 1). O total e o "Containers por rodada" acompanham.
  - **Margem de 5%** (`CONTAINER_FULL_MARGIN_PCT`): o container conta como **cheio com 95% ou mais** de ocupação ("1 container cheio (96%, margem de 5%)"). Nunca acima da capacidade: 2% além de um container é um segundo container com 2%. A ocupação é medida em caixas (o container com todas as caixas inteiras que cabem está 100%).
  - **Mexer numa rodada muda as peças** (complemento do dono, 12/11/2026): Aumentar, Diminuir ou digitar trocam as peças daquela rodada e, em consequência, a quantidade (a soma das rodadas), o "Total de peças" do gerador e o "Containers por rodada". Os dois campos do gerador acompanham a tela mesmo que algo tenha sido digitado neles antes; o digitado só vale até a próxima mudança nas rodadas ou até "Gerar programação".
  - Os cartões das rodadas quebram de linha (não rolam para o lado), para os botões de cada rodada ficarem sempre à vista.
  - "+ Rodada" e o "×" redividem o total em caixas master inteiras (antes, em peças). O resumo "N rodada(s) · caixas · m³ · containers" é o das rodadas da tela, não o da última geração. Caixa maior que o container: aviso para escolher outro. Item sem peças por caixa ou CBM: o total é dividido igualmente pelas rodadas, sem a conta dos containers.
  - A conta é `planPurchaseRounds`, `roundLoad` e `containersPerRound` (`src/lib/purchase-rounds.ts`); tudo continua editável e o servidor valida como antes. Só cubagem: o peso máximo do container não entra na conta.
- Com a programação ligada, **a quantidade é a soma das rodadas** (o campo fica só para leitura). "Sem programação (pedido único)" desliga.
- Fica em `selection_groups.schedule`. O bloco resolvido mostra "N rodadas a cada X dias" ao lado da quantidade. "Rever a escolha" reabre com a programação.

## 2. Na solicitação ao fornecedor (o que o responsável pelo booking vê)

A solicitação aberta do grupo leva a programação (`supplier_requests.schedule`). O responsável pelo booking passa a ver **rodadas, peças por rodada e total**, em vez de só a quantidade:

- **Tabela da solicitação**: colunas "Rodadas" e "Peças por rodada" antes da quantidade (total). Pedido único: 1 rodada com a quantidade toda. Passar o mouse mostra o intervalo e as datas.
- **Tela do produto**: "3 rodadas de 1.000 peças · total 3.000 peças" sob a quantidade e o quadro **Programação de compra** com a data e as peças de cada rodada.
- **Lista de solicitações**: a mesma linha de resumo sob as peças.

## 3. Pedido de compra: o pai

- No quadro "Gerar pedido de compra", o produto com programação mostra o total e as rodadas; a quantidade não se ajusta ali.
- Produtos com programação só entram juntos no mesmo pedido quando as rodadas têm **as mesmas datas** (1ª data, intervalo e número de rodadas); com e sem programação também não se misturam (`purchase_order_schedule_mixed`).
- O pedido nasce como de sempre (itens com o **total**) e grava `orders.purchaseRounds`: cada rodada com a data, as peças de cada produto e, depois, o pedido filho.
- **Preparação no pai**: as três raias (fornecedor, agência de arte, certificadora) acontecem uma vez, no pai. Concluída a Preparação, o pai **não vai a contrato nem produção** (`completeStage`, `isRoundsParent`): fica parado ali até a última rodada nascer, quando **encerra** (CLOSED).
- No pedido pai, o cartão **Programação de compra (pedido pai)** lista as rodadas: data, peças (por produto quando há mais de um) e o pedido filho, ou "Nasce em dd/mm".

## 4. Pedidos filhos

- **Quando nascem**: no dia da rodada, pelo job diário (`/api/jobs/reminders`, `spawnDueRounds`); quando a Preparação do pai conclui (as rodadas já vencidas nascem na hora); ou pelo botão **Gerar as rodadas do dia** no pai (só a Wellmix).
- **Rodada vencida com a Preparação do pai aberta**: espera (o cartão diz "nasce quando a preparação deste pedido concluir").
- **O que herdam**: itens com as peças da rodada e o preço negociado, moeda, fornecedor, comprador, condição de pagamento, incoterm e os parceiros do pai (agência, certificadora, transitário etc.). Os itens da Preparação feitos no pai entram **feitos** no filho, com os mesmos arquivos (faca, foto, arte, validação, certificado, arte final, MOQ e prazo confirmados), então o filho começa no **contrato**.
- **Contrato**: cada rodada tem o seu documento e as duas assinaturas. MOQ, prazo e a fábrica vêm das solicitações do pai (`parentOrderId`).
- O filho mostra "Rodada N de M do pedido pai" com o link. Avisos: Wellmix e fornecedor, com o link do filho.
- **Sem duplicar**: antes de criar, os filhos existentes do pai (`parentOrderId` + `roundIndex`) valem mais que a marca no pai.
- **Pai cancelado** não gera mais rodadas.

## Banco (só colunas opcionais)

- `selection_groups.schedule` e `supplier_requests.schedule` (JSON: `intervalDays`, `firstDate`, `items[index, quantity, expectedAt]`).
- `orders.purchaseRounds` (JSON grande), `orders.parentOrderId` (índice `by_parent`), `orders.roundIndex`.

## Onde está

| Parte                                  | Arquivo                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras (resumo, rodadas, chaves) | `src/lib/purchase-rounds.ts`                                                                                                     |
| Pedidos filhos (job, botão)            | `src/lib/services/purchase-rounds.ts`                                                                                            |
| Pai (gerar pedido)                     | `src/lib/services/purchase-order.ts`; parada após a Preparação em `src/lib/workflow/engine.ts`                                   |
| Telas                                  | `src/components/selection-quantity.tsx`, `src/components/purchase-rounds.tsx`, `src/app/app/orders/[id]/_components/rounds.tsx`  |
| Ação do botão                          | `src/app/app/actions/purchase-rounds.ts`                                                                                         |
| Textos                                 | `src/i18n/modules/purchase-rounds.ts`                                                                                            |
| Testes                                 | `tests/unit/purchase-rounds.test.ts`, `tests/unit/purchase-rounds-plan.test.ts` (gerador), `tests/e2e/booking-selection.spec.ts` |
