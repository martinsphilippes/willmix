# Integrações

Regra: toda integração externa crítica tem modo manual ou mock para o fluxo funcionar antes da integração real.

| Integração          | Contrato                            | Estado                                                         |
| ------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Appwrite (dados)    | `src/lib/db/appwrite-store.ts`      | Publicado e validado com o E2E contra o banco real             |
| Appwrite (auth)     | `src/lib/auth/session.ts`           | Implementado (modo `appwrite`); modo `memory` para dev/testes  |
| Sankhya             | `src/lib/integrations/sankhya.ts`   | `MockSankhyaAdapter`: `erpSyncStatus = pending`, número manual |
| Pagamento (cliente) | `src/lib/integrations/payments.ts`  | `ManualPaymentProvider`: operador confirma e anexa comprovante |
| E-mail              | `src/lib/services/notifications.ts` | Mock (registro com status `mock`)                              |
| WhatsApp            | `src/lib/services/notifications.ts` | Mock                                                           |
| Booking / armador   | requisitos da etapa `SHIPPING`      | Entrada manual                                                 |
| Comex / aduana      | requisitos da etapa `CUSTOMS`       | Entrada manual                                                 |

## EXTERNAL DEPENDENCIES PENDING

Para ativar cada integração real é preciso fornecer:

1. **Appwrite**: feito. Falta cadastrar as três variáveis na Vercel e trocar a chave de API (a usada na publicação passou pelo chat).
2. **Sankhya**: documentação da API (endpoint de criação de pedido, autenticação, campos obrigatórios) e credenciais. Implementar `SankhyaAdapter.createOrder` real e trocar `getSankhyaAdapter()`.
3. **Boleto/PIX**: gateway ou banco escolhido, credenciais e webhook de confirmação. Implementar `PaymentProvider.createCharge` e um route handler de webhook que chame `confirmDownPayment`.
4. **E-mail**: provedor (Resend, SES, SendGrid) e chave. Trocar `sendEmail` em `notifications.ts`.
5. **WhatsApp**: conta WhatsApp Business API (Meta ou BSP), número, token e templates aprovados. Trocar `sendWhatsapp`.
6. **Vercel**: `SESSION_SECRET`, `CRON_SECRET` e as variáveis do Appwrite no projeto; cron de lembretes já está em `vercel.json`.
