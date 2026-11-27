# Forma de pagamento do cliente e boletos

Pedido do dono (15/11/2026). Na área de pagamento do pedido, a Wellmix escolhe a **forma de pagamento** do cliente. A forma diz quanto o cliente paga e em que momento do pedido. Em cada momento, o financeiro gera o boleto no Sankhya, e o portal traz o boleto para o cliente e o vendedor verem, pagarem ou cobrarem.

Decisões do dono (15/11/2026):

- A forma 1 da lista ("10% no pedido; 80% no embarque") era a mesma da forma 2. Ficam duas formas de partida:
  - "10% no pedido; 90% no embarque"
  - "20% no pedido; 0% no embarque; 80% na Presença de Carga"
- O boleto nasce no Sankhya. O financeiro gera o boleto lá; o portal avisa quando é a hora e lê os títulos.
- O pedido ganha o campo **Vendedor**, um login da Wellmix escolhido junto com a forma.

## 1. Formas de pagamento (Configurações)

A tela fica em **Configurações → Formas de pagamento do cliente** (`/app/settings/payment-plans`) e só o administrador acessa. A tabela é `payment_plans`.

- **Parcelas**: de 1 a 12. Cada parcela tem:
  - um percentual da venda ao cliente;
  - o evento do pedido em que vence: no pedido, no embarque, na Presença de Carga ou na entrega;
  - os dias depois do evento.
- **Soma**: as parcelas precisam somar 100%. Uma parcela de 0% só marca o evento, sem cobrança (como o "0% no embarque").
- **Alçada**: a opção "Solicitar aprovação por alçada" exige escolher quem aprova, um login ativo da Wellmix.
- **Juros**: a forma pode ter juros compostos ao mês, de 0 a 20%. Eles valem só nas **parcelas depois da entrega**, ou seja, evento "Na entrega" com dias. A conta é valor × (1 + juros)^(dias ÷ 30), com o mês de 30 dias e o centavo arredondado para cima a partir de meio.
- **Situação e ordem**: a forma pode ficar inativa (some da escolha no pedido) e tem uma posição na lista.
- **Formas de partida**: quando a tabela está vazia, as duas formas de partida são gravadas na primeira leitura.

## 2. No pedido (seção "Pagamento do cliente")

A seção fica em `/app/orders/<id>#customer-payment`, logo abaixo de "Venda ao cliente". Desde 27/11/2026 (dono), as duas ficam recolhidas na lateral direita do pedido, sem fixar na rolagem; o pagamento abre sozinho na volta das ações dele (`?payment=`, `?charges=`, `?charge=`) e pela âncora. Quem vê é o mesmo (`customerPaymentVisible`, o teste do `customerPaymentView`).

- **Escolher**: quem tem a ação "Gravar a venda ao cliente" (`sale.record`) escolhe três coisas:
  - a forma de pagamento;
  - o vendedor;
  - o **NUNOTA do pedido de venda no Sankhya**, cujos títulos a receber são os boletos deste pedido.
- **Vinda da solicitação** (dono, 16/11/2026): a forma escolhida na Nova solicitação (docs/ORDER_TERMS.md seção 11.10) já vem marcada na escolha enquanto o pedido não tem forma.
- **Cópia da forma**: o pedido guarda uma cópia da forma (`orders.customerPaymentPlan`). Mudar a forma em Configurações depois não muda o pedido.
- **Alçada**: forma com alçada fica "Em aprovação" (`orders.paymentPlanStatus = pending`) e avisa quem responde. Quem responde, ou o administrador, aprova ou recusa, com observação opcional, e quem escolheu e o vendedor recebem o aviso. Forma sem alçada vale na hora.
- **Troca**: a forma pode ser trocada enquanto não há boleto registrado. Depois do primeiro boleto, só o vendedor e o NUNOTA mudam.
- **Parcelas na tela**: para cada parcela aparecem o percentual, o evento (com os dias), a data do evento, o valor (venda × %, mais os juros depois da entrega), o vencimento e o boleto.
  - **Datas dos eventos**:
    - "No pedido" é o dia em que a forma passou a valer, nunca antes da criação do pedido.
    - "No embarque" é a data de embarque informada, ou a conclusão da etapa de embarque.
    - "Na Presença de Carga" é a validação do passo `cargo_presence`, ou o envio dele.
    - "Na entrega" é o início da etapa "Entregue".
  - **Situações**:
    - **Sem cobrança**: parcela de 0%.
    - **Aguardando o evento**.
    - **Gerar o boleto no Sankhya**: o evento aconteceu e não há boleto.
    - **Boleto em aberto**.
    - **Boleto vencido**: vencimento passado sem baixa.
    - **Pago**.
- **Quem vê**:
  - Na Wellmix: quem vê valores e margem, quem grava a venda, o financeiro, o vendedor e quem aprova.
  - O cliente do pedido vê a forma **aprovada**, as parcelas e os boletos.
  - Fornecedores e outros parceiros não veem a seção.
- **Pedido filho**: a rodada da programação de compra não tem forma própria, porque o pagamento é do pedido pai.

## 3. Boletos

- **O momento**: o job de lembretes (`/api/jobs/reminders`, `notifyChargesToIssue`) confere os pedidos com forma aprovada. Quando o evento de uma parcela aconteceu e ela ainda não tem boleto, ele avisa o financeiro e o vendedor, **uma vez por parcela** (`orders.chargeNotices`). O aviso diz "gerar o boleto da parcela N", com o valor, o vencimento e o NUNOTA da venda.
- **Buscar boletos no Sankhya** (financeiro): o portal lê os títulos a receber do pedido de venda com `SELECT * FROM TGFFIN WHERE NUNOTA = <NUNOTA> AND RECDESP = 1 ORDER BY DTVENC, DESDOBRAMENTO`, só leitura, pelo DbExplorer.
  - Os títulos vão para as parcelas que têm valor, na ordem.
  - De cada título o portal lê: NUFIN, vencimento (DTVENC), valor (VLRDESDOB), nosso número (NOSSONUM), linha digitável (LINHADIGITAVEL, CODIGOBARRA ou CODBARRA, o que existir) e a baixa (DHBAIXA = pago).
  - Buscar de novo atualiza os títulos e mantém o PDF registrado à mão quando o título é o mesmo.
- **Busca diária** (dono, 15/11/2026): o job de lembretes (`syncAllSankhyaCharges`) faz a mesma busca todo dia para cada pedido com forma aprovada e o NUNOTA da venda, antes do aviso de "gerar o boleto" e da trava. O boleto pago no Sankhya destrava o pedido no mesmo dia. Pula o pedido com todas as parcelas pagas; sem o Sankhya configurado, não faz nada; o erro de um pedido não impede os outros.
- **Registrar à mão** (financeiro), para cada parcela: vencimento, valor, linha digitável, nosso número, o PDF do boleto (visível ao cliente) e "Pago".
- **Cobrar o cliente**: o vendedor, o financeiro ou quem grava a venda envia ao login do cliente que pediu um aviso com o vencimento e a linha digitável. A seção mostra a data da última cobrança.
- **Cliente**: vê a linha digitável, o nosso número, o valor, o PDF e se está pago.

## 3b. Parcela em aberto trava o pedido (dono, 15/11/2026)

- **Trava**: uma parcela com valor, vencida (o vencimento chegou) e sem pagamento pausa o pedido (`orders.pausedAt`, motivo `payment_open`). É a mesma pausa do canal cinza ou vermelho (docs/DELIVERY.md): nada anda no pedido enquanto ele está pausado. A parcela "no pedido" vence no dia em que a forma passa a valer, então trava na hora até o pagamento.
- **Quando é conferido**: ao escolher ou aprovar a forma, ao buscar os boletos no Sankhya (no botão ou na busca diária), ao registrar o boleto à mão e todo dia no job de lembretes (que pega os eventos do pedido, como o embarque).
- **Avisos**: o administrador, o financeiro e o vendedor recebem "Pedido #n travado: parcela em aberto".
- **Destravar**:
  - **O pagamento entra** (baixa do título no Sankhya ou "Pago" no registro à mão): a trava sai sozinha.
  - **Antes do pagamento, só o administrador** destrava, pelo botão de retomar do aviso de pausa no pedido. As parcelas que travavam ficam **liberadas** (`customerPaymentPlan.releases`, com quem e quando) e não travam de novo; a seção mostra "Liberada pelo administrador em …".
- Pedido já pausado por outro motivo (canal) fica como está; pedido cancelado, rodada da programação e pedido do histórico em espera não travam.

## 4. O que ainda não existe

- **O portal não gera o boleto nem grava título no Sankhya.** Por ora (dono, 15/11/2026) o financeiro gera o boleto no Sankhya e o portal o recebe: pela busca dos títulos ou pelo registro à mão (PDF e linha digitável). A integração para gerar fica para depois. Para o portal gerar sozinho, falta a documentação do serviço (da Amplio ou do banco).
- **O NUNOTA da venda é informado no pedido.** O pedido do portal ainda não tem ligação automática com o pedido de venda do Sankhya.
- **As colunas de TGFFIN** foram escolhidas pelos nomes usuais do Sankhya. Se a linha digitável vier vazia, a coluna dela na base da Wellmix tem outro nome; basta acrescentá-lo em `titleFromRow`.

## 5. Código e testes

- **Conta**: `src/lib/customer-payment.ts` (`planProblem`, `withInterest`, `customerSchedule`, `chargesFromTitles`).
- **Serviço**: `src/lib/services/customer-payment.ts` (`listPaymentPlans`, `savePaymentPlan`, `chooseOrderPaymentPlan`, `decideOrderPaymentPlan`, `customerPaymentView`, `syncSankhyaCharges`, `saveManualCharge`, `chargeCustomer`, `notifyChargesToIssue`).
- **Ações**: `src/app/app/actions/customer-payment.ts`.
- **Telas**: `src/app/app/orders/[id]/_components/customer-payment.tsx` e `src/app/app/settings/payment-plans/page.tsx`.
- **Textos**: `src/i18n/modules/customer-payment.ts`.
- **Banco** (aditivo):
  - tabela `payment_plans`;
  - em `orders`: `customerPaymentPlan`, `paymentPlanStatus` (com índice), `customerCharges`, `chargeNotices` e `sellerUserId`.
- **Testes**: `tests/unit/customer-payment.test.ts` e `tests/e2e/customer-payment.spec.ts`.
