# Programação de compra (rodadas de pedido)

> **Nome na tela (dono, 14/11/2026):** cada rodada aparece como **programação** (plural **programações**) em todos os textos em português da programação de compra: Seleção de itens, solicitação ao fornecedor, pedido pai e filhos e avisos. Neste documento e no código, "rodada" continua sendo o nome técnico.

Decisão do dono (12/11/2026). Ao gravar a escolha do grupo na Seleção de itens (`/app/booking/selection?tab=selection`), a Wellmix pode oferecer ao fornecedor uma **programação de compra para os próximos meses**: em vez de uma quantidade só, diz em quantas rodadas compra, quantas peças em cada uma e o intervalo de dias entre elas.

Decisões do dono (12/11/2026):

- **Pai = total; um filho por rodada.** O pedido de compra gerado vira o **pedido pai**: guarda o total, a negociação e a Preparação. Cada rodada nasce como **pedido filho** no dia combinado.
- **O filho copia as artes e o certificado, mas assina o próprio contrato.**
- **A data da 1ª rodada é escolhida na Seleção**; as outras são 1ª data + intervalo × (n − 1).

O mecanismo é o mesmo da programação de entregas da solicitação do cliente (`RequestScheduleFields` e `parseRequestSchedule`, `src/lib/workflow/request-schedule.ts`), com até **12 rodadas** (`MAX_PURCHASE_ROUNDS`; a do cliente segue com 6).

## 1. Na Seleção (escolha do grupo)

- No alto do cartão, "Comprar em rodadas nos próximos meses?" → **+ Programação de compra**. A "Quantidade (peças)" saiu do alto do cartão e fica na linha do gerador, logo abaixo (ver "Os dois campos de quantidade").
- Escolhe-se o intervalo (30, 45, 60 dias ou outro), a data da 1ª rodada e as peças de cada rodada (o total é dividido igualmente ao ligar; cada rodada pode ser editada; "+ Rodada" acrescenta).
- **Gerar programação pela quantidade** (regra do dono, 12/11/2026; substitui o gerador "pela cubagem" do mesmo dia, que pedia os containers por rodada e montava uma rodada por container). Tudo sai da **quantidade de produto**, como na ficha de compra (`generateLots` e `suggestContainerFill`):
  - **Campos numa linha só** (pedido do dono, 13/11/2026): com o cartão "Gravar a escolha do grupo" na largura toda da área de conteúdo, Total de caixas, Quantidade (peças), Programações, Container, Containers por rodada, Containers no total e o botão "Gerar programação" ficam lado a lado (os números dividem o espaço). A grade segue a largura do bloco (`@container`): com menos largura (tablet deitado com o menu aberto, janela de 1280) os seis campos seguem numa linha e o botão desce para a linha de baixo; em bloco estreito (tablet em pé, celular) os campos vão para 3 ou 2 colunas, sempre com "Quantidade (peças)" ao lado de "Total de caixas".
  - **Os dois campos de quantidade** (pedido do dono, 13/11/2026): "Quantidade (peças)", que ficava no alto do cartão, fica na mesma linha de "Total de caixas", imediatamente à direita, com a mesma largura, altura e estilo e os rótulos alinhados (as duas colunas têm a mesma definição). A dica dela ("Em branco: a quantidade da planilha do item escolhido"; com a programação, "a quantidade é a soma das rodadas") vem logo abaixo da linha dos campos.
    - **São o mesmo número em duas unidades**, nos dois sentidos, pelas peças por caixa master do item escolhido (`quantityFields`, em `src/lib/purchase-rounds.ts`): digitar as caixas calcula as peças (10 caixas de 48 = 480 peças); digitar as peças calcula as caixas, inteiras e para cima (500 peças = 11 caixas; as peças ficam como digitadas). Trocar o item escolhido na tabela refaz a conta com a caixa dele.
    - **Peças em branco** continuam valendo a quantidade da planilha ao gravar, e é ela que as caixas mostram (3.000 peças = 63 caixas). Apagar as caixas deixa as peças em branco e o campo fica vazio enquanto se digita.
    - **Item sem peças por caixa master**: não há conversão; o que se digita num campo não mexe no outro, e o gerador avisa como antes.
    - **Sem programação** (fechada), "Quantidade (peças)" continua na tela, editável, e é a quantidade que "Gravar escolha" grava (o campo vai no formulário como `quantity`). Enter nela grava, como antes de o campo mudar de lugar.
    - **Com a programação** (aberta), a quantidade gravada continua sendo a soma das rodadas (o campo não vai no formulário). Os dois campos passam a ser o total do gerador: o digitado vale ao apertar "Gerar programação" (ou Enter em qualquer um dos dois) e, quando as rodadas mudam, os dois voltam a mostrar a soma delas. Total digitado em peças que não fecha caixas inteiras é arredondado para cima e o Cálculo diz quanto ("Arredondado para caixas master inteiras: +28 peças").
    - **O mesmo valor nos dois modos**: fechar a programação ("Sem programação") mantém o número que estava nos campos; abrir divide esse número nas rodadas.
  - Digita-se o **total de caixas master** (campo "Total de caixas"; decisão do dono em 13/11/2026: o campo recebia peças) e o **número de rodadas** (1 a 12; na tela o campo se chama **"Programações"**, pedido do dono em 13/11/2026). A conta multiplica as caixas pelas **peças por caixa master** do item escolhido (`piecesFromCartons`) e segue em peças: a "Quantidade (peças)" e os cartões das rodadas continuam em peças, e a linha do Cálculo diz as duas ("300 caixas (14.400 peças)"). O campo acompanha a tela: mostra as peças de agora em caixas inteiras, para cima (`cartonsFromPieces`). Sem as peças por caixa master no item não há conversão: o gerador avisa e manda usar "+ Programação de compra", com as peças de cada rodada digitadas; só sem o CBM da caixa, as caixas são divididas igualmente e não há conta de containers. Escolhe-se também o container (tipos de `settings.containerTypes`, padrão 40HC). "Gerar programação" usa a caixa do item marcado como escolhido (CBM informado; sem ele, pelas medidas da caixa) e divide as caixas **igualmente** entre as rodadas, sempre em **caixas master inteiras** (o resto vai para as primeiras). Menos caixas que rodadas: ficam as rodadas que dá, com aviso.
  - **Os containers são consequência**: caixas da rodada ÷ caixas inteiras que cabem no container. "Containers por rodada" continua na tela, **só informativo** (não se digita): mostra **quantos containers cada rodada precisa** (um número quando são iguais; "1 a 2" quando diferem) e acompanha a tela, inclusive a prévia antes de gerar. Ao lado dele, **"Containers no total"** (pedido do dono, 12/11/2026), também só informativo: a soma dos containers de todas as rodadas (o mesmo número da última linha do Cálculo).
  - **O cálculo fica sempre escrito** (bloco "Cálculo" do gerador; pedido do dono em 12/11/2026, depois de a conta sumir da tela): a caixa do item ("48 peças por caixa master · 0,0235 m³ por caixa → 2.893 caixas (138.864 peças) por 40HC"), o total ("3 rodada(s) · 63 caixas · 1,48 m³ · 0,02 container(s) 40HC"), o arredondamento para caixas inteiras, os containers de cada rodada com a ocupação ("Cada rodada: 21 caixas · 0,49 m³ = 1 container 40HC, com <1% ocupado", ou a lista rodada a rodada quando diferem) e os containers no total. Aparece com as rodadas da tela e, antes de gerar, com a prévia do total e das rodadas digitados.
  - **De qual item é a caixa**: só a do item marcado em "Escolher" na tabela (pedido do dono, 13/11/2026; até então, sem item marcado, a conta usava o primeiro item do grupo com peças por caixa master e CBM e dizia qual). O rádio marcado é lido também ao abrir e ao voltar para a página (o navegador pode devolvê-lo marcado, ou nenhum, sem avisar).
    - **Sem item marcado, nada é calculado nem gerado**: o gerador mostra "Selecione um item na tabela para gerar a programação de compra"; "Gerar programação" e "+ Programação de compra" ficam desligados (Enter nos campos também não gera; "+ Rodada" e "×" também param); "Containers por rodada", "Containers no total" e o Cálculo ficam em branco, mesmo com "Total de caixas" e "Programações" preenchidos. Os campos digitados ficam: ao marcar o item, a conta sai com a caixa dele.
    - **Trocar ou desmarcar o item** desfaz o que era do item anterior: o arredondamento anotado, os avisos e a **programação ainda não gravada** (as rodadas saem da tela; "Programações" e a quantidade em peças ficam, e a quantidade volta a ir sozinha no formulário). Com o novo item, a conta é refeita com a caixa dele (`scheduleOnItemChange`, em `src/lib/purchase-rounds.ts`).
    - **A programação gravada não se perde**: ela é do item da escolha gravada. Ao marcar outro item ela sai da tela (no banco continua igual) e, ao marcar de novo o item gravado, volta como foi gravada (mudanças não gravadas feitas nela se perdem). Se o usuário a desligar ("Sem programação") com o item gravado marcado, ela não volta mais na tela; só "Gravar escolha" muda o que está gravado.
    - **Na gravação**, o servidor só aceita a escolha com o item marcado e se ele for um dos itens do grupo comparado (`saveSelectionGroup`; sem isso, "Marque o item escolhido…"), com ou sem programação.
  - **Em cada rodada**, abaixo das peças: caixas, m³ e containers; a situação com a **quantidade de containers** ("1 container: 73% ocupado", "2 containers: o último com 10%", "1 container cheio"); e os **dois botões, sempre**, que mexem só naquela rodada: **+ Aumentar** (acrescenta as peças que faltam para o próximo container cheio) e **− Diminuir** (tira as peças que passam do container cheio de baixo). Sem container cheio abaixo, o "− Diminuir" aparece desligado com o motivo ("menos de 1 container" ou "mínimo de 1 container"): a rodada nunca zera. Valem também com o container já fechado (1 → 2, 2 → 1). O total e o "Containers por rodada" acompanham.
  - **Margem de 5%** (`CONTAINER_FULL_MARGIN_PCT`): o container conta como **cheio com 95% ou mais** de ocupação ("1 container cheio (96%, margem de 5%)"). Nunca acima da capacidade: 2% além de um container é um segundo container com 2%. A ocupação é medida em caixas (o container com todas as caixas inteiras que cabem está 100%).
  - **Mexer numa rodada muda as peças** (complemento do dono, 12/11/2026): Aumentar, Diminuir ou digitar trocam as peças daquela rodada e, em consequência, a quantidade (a soma das rodadas), o "Total de peças" do gerador e o "Containers por rodada". Os dois campos do gerador acompanham a tela mesmo que algo tenha sido digitado neles antes; o digitado só vale até a próxima mudança nas rodadas ou até "Gerar programação".
  - Os cartões das rodadas quebram de linha (não rolam para o lado), para os botões de cada rodada ficarem sempre à vista.
  - "+ Rodada" e o "×" redividem o total em caixas master inteiras (antes, em peças). O resumo "N rodada(s) · caixas · m³ · containers" é o das rodadas da tela, não o da última geração. Caixa maior que o container: aviso para escolher outro. Item sem peças por caixa ou CBM: o total é dividido igualmente pelas rodadas, sem a conta dos containers.
  - A conta é `planPurchaseRounds`, `roundLoad` e `containersPerRound` (`src/lib/purchase-rounds.ts`); tudo continua editável e o servidor valida como antes. Só cubagem: o peso máximo do container não entra na conta.
- Com a programação ligada, **a quantidade é a soma das rodadas**: é ela que a escolha grava (até 13/11/2026 o campo ficava só para leitura; agora ele e "Total de caixas" são o total do gerador, ver "Os dois campos de quantidade"). "Sem programação (pedido único)" desliga.
- Fica em `selection_groups.schedule`. O bloco resolvido mostra "N rodadas a cada X dias" ao lado da quantidade. "Rever a escolha" reabre com a programação.

## 2. Na solicitação ao fornecedor (o que o responsável pelo booking vê)

A solicitação aberta do grupo leva a programação (`supplier_requests.schedule`). O responsável pelo booking passa a ver **rodadas, peças por rodada e total**, em vez de só a quantidade:

- **Tabela da solicitação**: colunas "Programações" e "Peças por programação" (em português; até 13/11/2026 chamavam-se "Rodadas" e "Peças por rodada", troca pedida pelo dono) antes da quantidade (total). Pedido único: 1 rodada com a quantidade toda. Passar o mouse mostra o intervalo e as datas.
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
