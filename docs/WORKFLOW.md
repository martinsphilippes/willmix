# Workflow

Modelo: **solicitação → pedido → item → etapa → requisito → submissão/documento**. Código em `src/lib/workflow/`.

## Fase de solicitação (tabela `requests`)

| Status                 | Quem age          | Ação                                                                 |
| ---------------------- | ----------------- | -------------------------------------------------------------------- |
| `REQUESTED`            | Wellmix           | Seleciona fornecedores e abre a RFQ (`openRfq`)                      |
| `RFQ_OPEN`             | Fornecedores      | Respondem preço, moeda, prazo, condições (`answerQuote`)             |
| `QUOTATION_RECEIVED`   | Wellmix           | Compara e seleciona; define valor ao cliente e sinal (`selectQuote`) |
| `WAITING_DOWN_PAYMENT` | Cliente / Wellmix | Cliente paga; Wellmix confirma manualmente (`confirmDownPayment`)    |
| `ORDERED`              |                   | Pedido criado; fluxo continua nas etapas                             |

Quem responde a cotação de um produto do catálogo entra na lista de fornecedores do produto (`product_suppliers`), com o código do item, o preço, o MOQ e o prazo da resposta; escolher a cotação soma no histórico dele. O fornecedor principal continua sendo o do cadastro do produto.

## Etapas do pedido (tabela `stages`, chave `key`)

Ordem fixa em `STAGE_KEYS`. Cada etapa tem status (`pending`, `active`, `blocked`, `done`), responsável, prazo (`dueAt`, calculado por `stageDueDays`), percentual e requisitos.

| Etapa              | Requisitos obrigatórios (papel)                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ORDER_CREATED`    | Pedido conferido (operador). Opcional: número no Sankhya                                                                           |
| `PREPARATION`      | Checklist da linha de produto (fornecedor). Padrão: dieline, foto profissional, peso, foto na balança, etiqueta                    |
| `SUPPLIER_PAYMENT` | Fora do fluxo: sem requisitos, conclui sozinha (`OFF_FLOW_STAGES`). O pagamento segue a condição do fornecedor (abaixo)            |
| `PACKAGING`        | Arte (agência designada; sem agência ou com `agencyValidationEnabled` desligado, a Wellmix) + aprovação da arte (fornecedor)       |
| `INSPECTION`       | Foto sem embalagem, foto com embalagem, foto na balança, peso medido (fornecedor). Divergência acima da tolerância bloqueia        |
| `SHIPPING`         | Embarque confirmado (companhia marítima; operador se não houver designada). Opcionais: data de embarque, previsão de chegada, navio, BL |
| `CUSTOMS`          | Número do processo, documentos aduaneiros, custos realizados, liberação (despachante; operador se não houver). Opcional: previstos |
| `TRANSPORT`        | Placa, previsão de entrega, entrega realizada (transportador; operador se não houver). Opcional: situação                          |
| `DELIVERED`        | Recebimento confirmado (cliente; operador se `deliveryConfirmationMode = WELLMIX`)                                                 |
| `CLOSED`           | Sem requisitos; conclui automaticamente e grava `closedAt`                                                                         |

No Embarque, data de embarque, previsão de chegada, navio e BL são opcionais (dá para avançar sem eles); o item **Embarque confirmado** conclui a etapa. Com a data preenchida, as regras de ordem continuam (chegada depois do embarque); sem ela, o marco de pagamento ao fornecedor é o dia em que o Embarque foi concluído. Pedidos criados antes (com os três obrigatórios) passam para o modelo novo ao abrir a página do pedido ou no job diário (`normalizeShipping`, em `src/lib/services/shipping-stage.ts`).

No cartão Embarque, a Wellmix vê o **frete pelo comparativo** das tabelas de todas as companhias (rota do pedido pelo local do fornecedor na ficha, da opção mais barata para a mais cara, com a companhia do pedido marcada) e o botão **Importar planilha da companhia marítima** (com a companhia do pedido já marcada: a planilha vai inteira para ela, com qualquer nome no arquivo); a companhia marítima do pedido vê só o botão de enviar a tabela dela (e quando mandou a última). Os dois levam a Fretes → Tarifário de frete (para a companhia, "Minha tabela de frete").

Datas em ordem: a previsão de chegada só abre depois de a data de embarque ser enviada e nunca fica antes dela (o calendário não oferece os dias anteriores e o envio é recusado, na tela e no servidor); a data de embarque não pode passar da chegada já informada; a previsão de entrega (transporte) não fica antes da chegada do navio.

## Regra de avanço

`evaluateStage` roda após cada submissão. Percentual = obrigatórios concluídos / obrigatórios. Quando todos os obrigatórios estão `done`, a etapa vira `done`, a próxima vira `active` (com prazo e responsável), o pedido recebe o novo status e o responsável é notificado. O responsável exibido é sempre o papel do próximo requisito pendente.

## Arte e embalagem

A agência de marketing faz a arte da embalagem e envia no pedido; o fornecedor confere a arte que tem de produzir e aprova (ou reprova com observação):

- **Quem envia a arte**: a agência do pedido. Sem agência designada (ou com "Arte da embalagem feita pela agência" desligado nas configurações, `agencyValidationEnabled`), a Wellmix envia.
- **Aprovação do fornecedor** só depois de a arte chegar: antes disso o item mostra "Aguardando a arte", não vira pendência e o servidor recusa (`art_missing`). Quando a arte chega, o fornecedor é avisado.
- **Reprovada**: a arte volta para quem a fez (agência ou Wellmix), com a observação e um aviso; reenviar a arte põe a aprovação de novo como pendente.
- **Designar ou trocar a agência** no pedido passa a arte ainda não enviada para ela (ou de volta à Wellmix, sem agência), com aviso ao novo dono. Mudar a configuração não tira a arte de quem já a tem nos pedidos em andamento (vale para os novos).
- **Aprovação decidida** só a Wellmix refaz, e só com a etapa aberta (`already_decided`, `stage_not_active`).
- **Avisos** a parceiro sem empresa definida no pedido (ex.: agência retirada) vão para a Wellmix, nunca para todas as empresas daquele papel.
- **Pedidos de antes da inversão** (arte do fornecedor, aprovação da agência) passam sozinhos para o fluxo novo ao abrir o pedido, em Pendências ou no job diário, sem mexer no que já foi enviado; aprovação marcada como concluída sem arte enviada volta a pendente. Auditoria `stage.packaging_flow`.

## Pagamento ao fornecedor (fora do fluxo)

O pagamento da Wellmix ao fornecedor é negociado com cada um e costuma vencer meses depois da entrega, por isso não segura o pedido:

- **Condição no cadastro do fornecedor** (`parties.paymentTerms`, só a Wellmix edita em Cadastros → fornecedor → "Condição de pagamento ao fornecedor"): até 6 parcelas, cada uma com % do FOB, marco (pedido gerado, embarque, entrega ao cliente) e dias depois do marco; soma 100%. Observação livre em `paymentTermsNote`. Sem condição = "não configurada" (nada é presumido).
- **Cópia no pedido**: o pedido guarda a condição do dia em que nasceu (`orders.supplierPaymentTerms`); mudar o cadastro depois não mexe nele, até a Wellmix usar "Usar a condição atual do cadastro" no pedido, o que só vale enquanto o pedido não tem pagamento ao fornecedor lançado (`terms_has_payments`). Pedidos antigos (sem cópia) seguem a condição atual do fornecedor até o primeiro pagamento de parcela, que fixa no pedido a condição que valia.
- **Marcos**: pedido gerado = criação do pedido; embarque = "Data de embarque" do embarque (ou a conclusão da etapa); entrega = início da etapa Entregue (entrega registrada). Vencimento = marco + dias; sem o marco, a parcela "aguarda".
- **Parcelas**: valor = % do FOB (a última fica com o resto dos centavos). A condição é salva na ordem em que vence (marco, depois dias). Pagamento feito para uma parcela ("Parcela 1/2", gravado pelas ações rápidas e pelo registro à mão da parcela da vez) quita aquela parcela; o resto do dinheiro na moeda do FOB quita as parcelas na ordem fixa da condição (marco, dias), não muda quando as datas chegam: recebido, depois pago, depois solicitado. A parcela da vez é a primeira a vencer com valor em aberto. Percentuais valem em centésimos e somam exatamente 100%. Situação: vencida, vence em 7 dias, programada, aguardando o marco, solicitada (dados copiados/pedido ao financeiro), paga (falta o fornecedor confirmar), recebida, cancelada (pedido cancelado).
- **Onde fica**: Gestão → **Contas a pagar** (`/app/payables`, uma linha por parcela, vencidas primeiro, filtros por situação e fornecedor, fornecedores sem condição listados); card **Pagamento ao fornecedor** no pedido (Wellmix: cronograma e pagamento da parcela da vez; fornecedor do pedido: só a previsão); **Previsão de pagamentos** na conta corrente do fornecedor, onde ele confirma o recebimento. Pendências da Wellmix ganham as parcelas vencidas ou da semana e o job diário manda um resumo.
- **Pedido ao banco/financeiro → pago**: as ações rápidas registram o pagamento como solicitado; quando ele sai, a Wellmix usa "Marcar como pago" no card (câmbio e comprovante opcionais), sem criar outro pagamento. O "Já pagou?" fica para pagamentos feitos por fora (também em pedido sem FOB). O fornecedor tem a pendência "Confirmar recebimento" até confirmar na conta corrente, e o job diário o lembra de pagamento feito há mais de 3 dias ainda não confirmado. Nos pedidos antigos, só os pagamentos lançados até a confirmação feita pela etapa contam como recebidos; os lançados depois seguem pedindo a confirmação. O lembrete ao fornecedor e o resumo à Wellmix saem no máximo uma vez a cada 20 horas, mesmo que o job rode de novo.
- **Pedidos pagos no fluxo antigo** (algum item da etapa antiga concluído) não ganham parcelas: o card diz que foram pagos pela etapa e nada vai para Contas a pagar, Pendências ou o resumo diário.
- **Observação da condição** (`paymentTermsNote`) aparece para o fornecedor na conta corrente dele; o campo avisa isso.
- **Pedidos parados na etapa antiga** seguem para a Embalagem sozinhos (ao abrir o pedido, Pendências, Contas a pagar ou no job diário), com auditoria `stage.off_flow`. Também o pedido que ficou com a etapa concluída mas o status nela (a próxima ainda não começou). Cada etapa é liberada uma vez por instância mesmo com chamadas ao mesmo tempo; as telas repetem a passada geral no máximo a cada 10 minutos, o job sempre.
- **Cancelamento pelo cliente**: continua até a produção começar e até haver pagamento ao fornecedor feito: pagamento confirmado/recebido ou, nos pedidos antigos, o recebimento confirmado na etapa (agora inclui a Embalagem, porque o pedido não para mais no pagamento).

## Quem preenche

Wellmix (admin e operador) pode preencher qualquer requisito. Os demais só preenchem requisitos do próprio papel e em pedidos em que o seu parceiro está designado (`ROLE_PARTY_FIELD`).

## Inspeção cega e comparação comprado × inspecionado

- Ao nascer, o pedido recebe um **snapshot da compra** (`purchase_snapshots`): ficha do produto + cotação congeladas. O cadastro mestre pode mudar depois; o snapshot não.
- Com `inspectionExtendedChecks` (padrão ligado), a INSPECTION pede também, como opcionais do fornecedor: peso bruto, comprimento, largura, altura, CBM da caixa master, unidades por caixa master e inner box, material e cor encontrados. **O inspetor nunca vê o valor esperado**; ele informa o que encontrou. Inner box 0 na ficha é "Sem caixa inner": bate com 0 encontrado.
- A cada medida enviada, `compareInspection` compara com o snapshot (tolerâncias `weightTolerancePercent`, `cbmTolerancePercent` para CBM e peso bruto, `dimensionTolerancePercent`, `quantityTolerancePercent`; texto compara igualdade normalizada). Resultado em `inspection_results` (`APPROVED`, `DIVERGENT`, `REVIEW_REQUIRED`). Só atributos presentes no snapshot e medidos entram na comparação: pedidos antigos sem snapshot seguem só com a regra de peso.
- Cada divergência abre um item na **fila de revisão** (`review_items`: regra, esperado, encontrado, responsável, ação) e bloqueia a etapa com o mesmo requisito `inspection_review`. Aprovar resolve os itens e libera; nova medição dentro da tolerância resolve o item e, sem outros abertos, libera sozinha. `unblockStage` dispensa os itens.
- Outros gates que alimentam a fila: FOB zerado na criação do pedido (`reviewOnZeroPrice`), container acima da ocupação máxima ou do peso (`containerMaxOccupancyPercent`).

## Bloqueio e revisão

- **Peso divergente** (inspeção vs. preparação, tolerância `weightTolerancePercent`): etapa `blocked`, motivo em `blockReason`, requisito extra `inspection_review` (aprovação da Wellmix). Aprovar libera; nova medição dentro da tolerância libera automaticamente. Também abre o item `inspection.weightDeclared` na fila de revisão.
- **Arte reprovada** pelo fornecedor: o requisito `art` volta para `rejected`; quem faz a arte (agência ou Wellmix) reenvia (nova versão do documento) e a aprovação volta a pendente.

## Documentos

Substituir um arquivo do mesmo requisito cria nova versão (`version`, `previousDocumentId`); o anterior é mantido. Download em `/api/files/[id]` com checagem de sessão, pedido e visibilidade.

## Conformidade (certificações)

A linha de produto pode exigir certificações (`requiredCertifications`, ex.: Inmetro). Ao nascer o pedido, se o produto não tem certificação válida (não vencida) de cada tipo exigido, abre-se o item `compliance.missingCertification` na fila de revisão e a etapa ORDER_CREATED ganha o requisito obrigatório `compliance_check` (Wellmix). Registrar ou validar a certificação resolve o item e conclui o requisito sozinho. Sem exigência na linha, nada muda.

## Pós-venda

Ao concluir DELIVERED, abre-se um registro em `after_sales` (entidade própria; as etapas não mudam) e o cliente recebe a pendência "Avalie a compra". Ele responde nota, experiência, problemas, custos percebidos, sugestões e interesse em recompra; a Wellmix é avisada e encerra. Do pedido encerrado saem "Comprar de novo" (origem `replenishment`) e "Quero nova proposta" (origem `proposal`), que criam uma solicitação normal pré-preenchida e ligada ao pedido de origem.

## Sourcing sob demanda

Solicitação com "produto ainda não está no catálogo" (origem `sourcing_demand`) cria um item de sourcing em rascunho com a demanda do cliente; o time na China localiza fornecedores e, ao promover o item a produto, a solicitação passa a apontar para ele e a RFQ segue o fluxo normal.

## Confirmação de visualização

`acknowledgements` registra `viewed` (automático ao baixar um documento ou ao ver um pagamento na conta corrente) e `confirmed` (ato explícito). São eventos diferentes: visualizar nunca vale como confirmar.

## Pendências e lembretes

`pendingTasksFor(user)` lista o que o usuário precisa fazer (requisitos pendentes das etapas ativas, RFQs a responder, seleção, sinal). `runReminders` (cron diário em `/api/jobs/reminders`) avisa o responsável de etapas vencidas ou a vencer, no máximo uma vez a cada 24h por etapa.
