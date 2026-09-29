# Decisões em aberto

Defaults provisórios para não travar o desenvolvimento. Todos ajustáveis em `/app/settings` (admin) ou em `src/lib/settings.ts`.

| Chave                      | Default    | Observação                                                                  |
| -------------------------- | ---------- | --------------------------------------------------------------------------- |
| `customerCanCreateRequest` | `true`     | Cliente cria solicitação diretamente                                        |
| `wellmixCanCreateRequest`  | `true`     | Wellmix cria em nome do cliente (mesmo formulário)                          |
| `deliveryConfirmationMode` | `BOTH`     | Cliente confirma; Wellmix pode confirmar por ele. `WELLMIX` tira do cliente |
| `agencyValidationEnabled`  | `true`     | Exige aprovação da arte pela agência quando há agência designada            |
| `weightTolerancePercent`   | `3`        | Divergência acima disso bloqueia a inspeção                                 |
| `paymentMode`              | `MANUAL`   | Operador confirma o sinal e anexa comprovante                               |
| `sankhyaMode`              | `MOCK`     | Pedido nasce com `erpSyncStatus = pending`; operador informa o número       |
| `whatsappMode`             | `MOCK`     | Notificação registrada com status `mock`                                    |
| `emailMode`                | `MOCK`     | Idem                                                                        |
| `quotationExpirationDays`  | `15`       | Validade padrão da RFQ                                                      |
| `downPaymentPercent`       | `30`       | Sinal sugerido sobre o valor ao cliente (editável na seleção)               |
| `stageDueDays`             | ver código | Prazo por etapa, em dias                                                    |
| `reminderDaysBeforeDue`    | `1`        | Lembrete antes do vencimento                                                |
| `dimensionTolerancePercent` | `5`      | Divergência de comprimento/largura/altura entre snapshot e inspeção        |
| `cbmTolerancePercent`      | `5`        | Divergência de CBM da caixa e de peso bruto                                 |
| `quantityTolerancePercent` | `0`        | Divergência de unidades por caixa (0 = exato)                               |
| `inspectionExtendedChecks` | `true`     | Inspeção pede medidas, caixa, material e cor (opcionais, cegos)             |
| `reviewOnZeroPrice`        | `true`     | Pedido sem FOB entra na fila de revisão                                     |
| `containerTypes`           | 20GP/40GP/40HC | Capacidade útil (m³) e peso máximo por tipo; nada fixo em código        |
| `containerAllowMultiCustomer` | `false` | Clientes diferentes no mesmo container só manualmente e se ligado           |
| `containerMaxOccupancyPercent` | `95`   | Acima disso, item na fila de revisão                                        |
| `afterSalesEnabled`        | `true`     | Abre o pós-venda ao concluir a entrega                                      |
| `complianceGateEnabled`    | `true`     | Linha com certificação obrigatória sem certificação válida bloqueia a liberação |
| `certificationExpiryWarningDays` | `30` | Aviso de certificação a vencer                                              |

## Decisões de modelagem tomadas

- Parceiros (agência, despachante, armador, transportador) são designados por pedido. Quando existe exatamente um parceiro ativo de cada tipo, é designado automaticamente na criação do pedido.
- Sem parceiro designado, o próprio operador Wellmix assume os requisitos de embarque, desembaraço e transporte (entrada manual).
- Moeda do FOB vem da cotação; moeda ao cliente definida na seleção (padrão BRL). Câmbio é informado por pagamento.
- A conta corrente do fornecedor considera FOB total do pedido menos pagamentos registrados e recebidos.
- Auditoria registra usuário, ação, entidade, resumo e, quando relevante, antes/depois.

- Consolidação: vários produtos do mesmo cliente podem dividir o container; não existe motor automático que junte pedidos de clientes diferentes.
- Snapshot da compra é criado ao nascer o pedido; para pedidos anteriores, gerado retroativamente sob demanda e marcado como tal.
- Visão comercial: "disponível" é o volume de itens de container sem pedido; sem estoque cadastrado, não se inventa valor.
- NCM: sugestão (heurística ou IA) nunca é definitiva; só a classificação validada por Wellmix ou despachante vale e é copiada ao produto e ao snapshot.
- Oportunidade de compra: só com faixas de preço negociadas e espaço real em container; a fórmula é exibida.

## A confirmar com o negócio

- Sinal: percentual real e se há segunda parcela antes do embarque.
- Quem paga custos aduaneiros e como entram na conta do cliente.
- Tolerância de peso por linha de produto (hoje global).
- Papéis internos além de admin e operador (financeiro?).
