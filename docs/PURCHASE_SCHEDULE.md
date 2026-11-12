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
- **Gerar programação pela cubagem** (12/11/2026): digita-se o **total de peças**, escolhe-se o container (tipos de `settings.containerTypes`, padrão 40HC) e quantos containers vão em cada rodada (padrão 1) e "Gerar programação" monta as rodadas com a caixa master e o CBM do item marcado como escolhido (CBM informado; sem ele, pelas medidas da caixa): o total é arredondado para **caixas master inteiras**, cada rodada leva **containers cheios** (caixas inteiras que cabem no container) e a **última fica com o resto**. Passando de 12 rodadas, os containers por rodada sobem até caber. O resultado mostra caixas, m³ e containers, a ocupação da última rodada e dois atalhos: **completar o container** (+peças) ou **só rodadas cheias** (−peças). Cada rodada mostra caixas, m³ e quanto ocupa do container, recalculado ao editar (fração de container em destaque). Caixa maior que o container: aviso para escolher outro. Item sem peças por caixa ou CBM: o total é dividido igualmente pelo número de rodadas digitado. A conta é `planPurchaseRounds`/`roundLoad` (`src/lib/purchase-rounds.ts`); tudo continua editável e o servidor valida como antes.
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

| Parte                                  | Arquivo                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras (resumo, rodadas, chaves) | `src/lib/purchase-rounds.ts`                                                                                                    |
| Pedidos filhos (job, botão)            | `src/lib/services/purchase-rounds.ts`                                                                                           |
| Pai (gerar pedido)                     | `src/lib/services/purchase-order.ts`; parada após a Preparação em `src/lib/workflow/engine.ts`                                  |
| Telas                                  | `src/components/selection-quantity.tsx`, `src/components/purchase-rounds.tsx`, `src/app/app/orders/[id]/_components/rounds.tsx` |
| Ação do botão                          | `src/app/app/actions/purchase-rounds.ts`                                                                                        |
| Textos                                 | `src/i18n/modules/purchase-rounds.ts`                                                                                           |
| Testes                                 | `tests/unit/purchase-rounds.test.ts`                                                                                            |
