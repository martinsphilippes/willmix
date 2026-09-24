# Decisões em aberto

Defaults provisórios para não travar o desenvolvimento. Todos ajustáveis em `/app/settings` (admin) ou em `src/lib/settings.ts`.

| Chave                      | Default    | Observação                                                                  |
| -------------------------- | ---------- | --------------------------------------------------------------------------- |
| `customerCanCreateRequest` | `true`     | Cliente cria solicitação diretamente                                        |
| `willmixCanCreateRequest`  | `true`     | Willmix cria em nome do cliente (mesmo formulário)                          |
| `deliveryConfirmationMode` | `BOTH`     | Cliente confirma; Willmix pode confirmar por ele. `WILLMIX` tira do cliente |
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

## Decisões de modelagem tomadas

- Parceiros (agência, despachante, armador, transportador) são designados por pedido. Quando existe exatamente um parceiro ativo de cada tipo, é designado automaticamente na criação do pedido.
- Sem parceiro designado, o próprio operador Willmix assume os requisitos de embarque, desembaraço e transporte (entrada manual).
- Moeda do FOB vem da cotação; moeda ao cliente definida na seleção (padrão BRL). Câmbio é informado por pagamento.
- A conta corrente do fornecedor considera FOB total do pedido menos pagamentos registrados e recebidos.
- Auditoria registra usuário, ação, entidade, resumo e, quando relevante, antes/depois.

## A confirmar com o negócio

- Sinal: percentual real e se há segunda parcela antes do embarque.
- Quem paga custos aduaneiros e como entram na conta do cliente.
- Tolerância de peso por linha de produto (hoje global).
- Papéis internos além de admin e operador (financeiro?).
