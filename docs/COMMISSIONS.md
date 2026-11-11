# Acordos comerciais, comissões e liquidação

Pedido do dono (11/11/2026): configurar remunerações pelo painel, negociar exceções individuais, simular e acompanhar cada comissão até a liquidação. Fica em **Gestão → Acordos e comissões** (`/app/commissions`), para quem abre o Financeiro; nesta versão, **só o administrador** cria, ativa, apura, aprova e liquida.

## O que existia e o que foi reaproveitado

- **Pedido**: venda (`sellPrice`, moeda), custo (`fobTotal`, moeda), linha do pedido, itens com quantidade e preço unitário (a linha de cada item vem do produto), e os parceiros ligados (cliente, fornecedor, agência, despachante, companhia marítima, transportador, comex, agente de carga, OCP).
- **Fatos com data**: etapas concluídas (inspeção, embarque, entrega), pedido encerrado, faturado, cancelado; recebimentos do cliente confirmados (`payments`, parciais).
- **Não existia**: comissão, devolução por item, nota de crédito, retorno de baixa do Sankhya. Por isso a liquidação é **registro manual auditado** e a devolução é tratada só como **cancelamento do pedido**.

## Telas

| Aba                  | O que faz                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acordos              | Lista com número, versão, beneficiário, categoria, vigência e situação. "+ Novo acordo".                                                                                                      |
| Acordo               | Quatro partes: beneficiário e abrangência; condições de cálculo (regras); vigência e pagamento; simulação e revisão (simular, ativar, suspender, encerrar, duplicar, nova versão).            |
| Lançamentos          | Apurar um pedido pelo número (com confirmação manual opcional), filtros por situação, beneficiário e período, memória de cálculo de cada lançamento e "Aprovar os marcados".                  |
| Extrato e liquidação | Por beneficiário: totais (estimado, elegível, aprovado a pagar, pago), registrar liquidação (um pagamento para um ou vários lançamentos, parcial ou total) e as liquidações já registradas.   |
| Simulador            | Com um pedido real (pelo número) ou dados de exemplo (duas linhas, tipo e nome do parceiro, fatos ocorridos, recebido). Pode incluir um rascunho. Usa o mesmo cálculo da apuração; não grava. |

## Acordo

- **Beneficiário**: padrão de um **tipo de parceiro** (recebe o parceiro desse tipo ligado ao pedido) ou **individual** (uma empresa ou pessoa do cadastro, com ou sem login). O individual vale quando a empresa está ligada ao pedido, ou quando o acordo diz de que clientes ou fornecedores vale (sem isso pagaria em todo pedido). A empresa é uma só: o número de logins dela não muda a comissão.
- **Abrangência**: clientes, fornecedores, linhas de produto (por regra) e vigência (datas).
- **Regras** (componentes), combináveis no mesmo acordo:
  - **Percentual** sobre: valor dos itens (item a item, com taxa por linha), venda do pedido, custo do pedido (FOB) ou recebido do cliente. Com **faixas** (só sobre o pedido): progressivo ou a taxa da faixa atingida na base inteira.
  - **Valor fixo** e **por unidade**.
  - **Bônus por sucesso**: a regra só vale depois de um fato (ex.: mercadoria entregue).
  - **Acumula**: soma às outras regras; sem isso, disputa com elas.
  - **Piso e teto** por regra.
- **Precedência** na mesma categoria: a exceção individual ganha do padrão do tipo; depois a prioridade maior; depois a regra da linha ganha da geral. A exceção substitui o padrão **só no que ela cobre** (ex.: só a linha A). Duas regras exclusivas de mesma precedência são **conflito**: aparecem na simulação e **bloqueiam a ativação**.
- **Quando**: fato que **gera** a comissão, fato que **libera** o pagamento (ou o recebimento do cliente, proporcional ou só integral) e dias para o **vencimento** depois de liberada.
- **Fatos**: pedido criado, inspeção concluída, embarque concluído, mercadoria entregue, pedido encerrado, faturado, primeiro recebimento, recebimento integral e **confirmação manual** (pessoa autorizada, com justificativa; auditada).
- **Versões**: só o rascunho muda. O ativo ganha uma **nova versão**; ao ativá-la, a anterior encerra na véspera do início da nova. A apuração usa a versão que valia na **data de referência** (a criação do pedido), guardada no lançamento.
- **Situações**: rascunho, ativo, suspenso (com motivo), encerrado (com motivo). Duplicar cria outro acordo em rascunho.

## Cálculo (src/lib/commission.ts)

- Centavos inteiros durante a conta; arredondamento meio para cima em 2 casas, em cada linha.
- **Base indisponível** (ex.: pedido sem valor de venda) ou **moeda diferente** da do pedido: a linha fica **pendente**, com o motivo. O portal não troca uma base por outra nem converte moeda sozinho.
- A **memória de cálculo** guarda cada linha (item, regra, base, taxa, valor, versão), as regras substituídas com o motivo, os conflitos e as pendências.

## Apuração, aprovação e liquidação

1. **Apuração** (`accrueOrder`): um lançamento por **pedido, acordo e beneficiário** (chave única no banco). Cada evento do pedido reapura sozinho (`emitProcessEvent`); também dá para apurar pelo número. Evento repetido ou dois processos ao mesmo tempo dão um lançamento só.
2. **Situações do lançamento**: Estimado (nasceu, ainda não liberado) → Elegível (liberado, com vencimento) → Aprovado → Parcialmente pago → Pago; Estornado.
3. O lançamento em aberto é **recalculado** a cada apuração. O aprovado ou pago **não muda**: a diferença vira um **ajuste** ligado ao original.
4. **Cancelamento**: o lançamento em aberto fica Estornado; o aprovado ou pago ganha um **estorno** (ajuste negativo) ligado ao original, e o pagamento antigo continua registrado. O estorno entra na liquidação seguinte do beneficiário (compensação).
5. **Liquidação** (`settleEntries`): data, referência, observação e quanto de cada lançamento aprovado; só do mesmo beneficiário e moeda; não passa do liberado em aberto; parcial deixa o saldo.
6. **Auditoria**: criar, alterar, versionar, duplicar, ativar, suspender, encerrar, apurar, confirmar à mão, aprovar e liquidar.

## Banco

`commission_agreements` (uma linha por versão), `commission_entries` (chave única `key`), `commission_payments`, `commission_events` (confirmações manuais).

## Onde está

| Parte   | Arquivo                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Cálculo | `src/lib/commission.ts`                                                                                   |
| Serviço | `src/lib/services/commissions.ts`; gatilho em `src/lib/services/process-engine.ts`                        |
| Ações   | `src/app/app/actions/commissions.ts`                                                                      |
| Telas   | `src/app/app/commissions/`                                                                                |
| Textos  | `src/i18n/modules/commissions.ts`                                                                         |
| Testes  | `tests/unit/commission-engine.test.ts`, `tests/unit/commissions.test.ts`, `tests/e2e/commissions.spec.ts` |

## Ainda não

- **Extrato para o parceiro** no login dele (hoje só o administrador vê; nenhuma tela ou ação de comissão abre para outro papel).
- **Permissões separadas** (criar, ativar, aprovar, exportar, liquidar): hoje tudo é do administrador.
- **Metas e faixas por volume acumulado no período** (as faixas valem sobre a base de cada pedido).
- **Divisão de uma comissão entre beneficiários** com validação do rateio (dá para ter um acordo por beneficiário).
- **Base "margem"**, descontos, impostos e frete separados: o pedido não guarda esses valores por item.
- **Devolução por item** e nota de crédito (não existem no portal); **conversão de moeda**; **comprovante anexo** na liquidação; **exportação**; integração com Contas a pagar ou Sankhya.
- Abrangência por unidade, canal, país, contrato, categoria, família e SKU; classe de login como beneficiário.
- Tipos novos (Trading, Factory, Supplier, GP) não estão ligados a pedidos: para remunerá-los, use o acordo individual com os clientes ou fornecedores de que ele vale.
