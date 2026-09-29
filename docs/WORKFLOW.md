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

## Etapas do pedido (tabela `stages`, chave `key`)

Ordem fixa em `STAGE_KEYS`. Cada etapa tem status (`pending`, `active`, `blocked`, `done`), responsável, prazo (`dueAt`, calculado por `stageDueDays`), percentual e requisitos.

| Etapa              | Requisitos obrigatórios (papel)                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ORDER_CREATED`    | Pedido conferido (operador). Opcional: número no Sankhya                                                                           |
| `PREPARATION`      | Checklist da linha de produto (fornecedor). Padrão: dieline, foto profissional, peso, foto na balança, etiqueta                    |
| `SUPPLIER_PAYMENT` | Pagamento registrado (operador) + recebimento confirmado (fornecedor)                                                              |
| `PACKAGING`        | Arte (fornecedor) + aprovação da arte (agência, quando `agencyValidationEnabled` e há agência designada)                           |
| `INSPECTION`       | Foto sem embalagem, foto com embalagem, foto na balança, peso medido (fornecedor). Divergência acima da tolerância bloqueia        |
| `SHIPPING`         | Data de embarque, previsão de chegada, BL (companhia marítima; operador se não houver designada). Opcional: navio                  |
| `CUSTOMS`          | Número do processo, documentos aduaneiros, custos realizados, liberação (despachante; operador se não houver). Opcional: previstos |
| `TRANSPORT`        | Placa, previsão de entrega, entrega realizada (transportador; operador se não houver). Opcional: situação                          |
| `DELIVERED`        | Recebimento confirmado (cliente; operador se `deliveryConfirmationMode = WELLMIX`)                                                 |
| `CLOSED`           | Sem requisitos; conclui automaticamente e grava `closedAt`                                                                         |

## Regra de avanço

`evaluateStage` roda após cada submissão. Percentual = obrigatórios concluídos / obrigatórios. Quando todos os obrigatórios estão `done`, a etapa vira `done`, a próxima vira `active` (com prazo e responsável), o pedido recebe o novo status e o responsável é notificado. O responsável exibido é sempre o papel do próximo requisito pendente.

## Quem preenche

Wellmix (admin e operador) pode preencher qualquer requisito. Os demais só preenchem requisitos do próprio papel e em pedidos em que o seu parceiro está designado (`ROLE_PARTY_FIELD`).

## Inspeção cega e comparação comprado × inspecionado

- Ao nascer, o pedido recebe um **snapshot da compra** (`purchase_snapshots`): ficha do produto + cotação congeladas. O cadastro mestre pode mudar depois; o snapshot não.
- Com `inspectionExtendedChecks` (padrão ligado), a INSPECTION pede também, como opcionais do fornecedor: peso bruto, comprimento, largura, altura, CBM da caixa master, unidades por caixa master e inner box, material e cor encontrados. **O inspetor nunca vê o valor esperado**; ele informa o que encontrou.
- A cada medida enviada, `compareInspection` compara com o snapshot (tolerâncias `weightTolerancePercent`, `cbmTolerancePercent` para CBM e peso bruto, `dimensionTolerancePercent`, `quantityTolerancePercent`; texto compara igualdade normalizada). Resultado em `inspection_results` (`APPROVED`, `DIVERGENT`, `REVIEW_REQUIRED`). Só atributos presentes no snapshot e medidos entram na comparação: pedidos antigos sem snapshot seguem só com a regra de peso.
- Cada divergência abre um item na **fila de revisão** (`review_items`: regra, esperado, encontrado, responsável, ação) e bloqueia a etapa com o mesmo requisito `inspection_review`. Aprovar resolve os itens e libera; nova medição dentro da tolerância resolve o item e, sem outros abertos, libera sozinha. `unblockStage` dispensa os itens.
- Outros gates que alimentam a fila: FOB zerado na criação do pedido (`reviewOnZeroPrice`), container acima da ocupação máxima ou do peso (`containerMaxOccupancyPercent`).

## Bloqueio e revisão

- **Peso divergente** (inspeção vs. preparação, tolerância `weightTolerancePercent`): etapa `blocked`, motivo em `blockReason`, requisito extra `inspection_review` (aprovação da Wellmix). Aprovar libera; nova medição dentro da tolerância libera automaticamente. Também abre o item `inspection.weightDeclared` na fila de revisão.
- **Arte reprovada** pela agência: o requisito `art` volta para `rejected`; o fornecedor reenvia (nova versão do documento) e a aprovação volta a pendente.

## Documentos

Substituir um arquivo do mesmo requisito cria nova versão (`version`, `previousDocumentId`); o anterior é mantido. Download em `/api/files/[id]` com checagem de sessão, pedido e visibilidade.

## Confirmação de visualização

`acknowledgements` registra `viewed` (automático ao baixar um documento ou ao ver um pagamento na conta corrente) e `confirmed` (ato explícito). São eventos diferentes: visualizar nunca vale como confirmar.

## Pendências e lembretes

`pendingTasksFor(user)` lista o que o usuário precisa fazer (requisitos pendentes das etapas ativas, RFQs a responder, seleção, sinal). `runReminders` (cron diário em `/api/jobs/reminders`) avisa o responsável de etapas vencidas ou a vencer, no máximo uma vez a cada 24h por etapa.
