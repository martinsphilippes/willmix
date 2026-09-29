# Integrações

> Sistema chinês (planilhas do time na China): modo **manual por XLSX/CSV** em `/app/import` com mapeamento, conferência e correspondência (`src/lib/services/import-batches.ts`). Integração automática só quando houver API ou exportação oficial; nada de scraping.
>
> Antes de automatizar, verificar com o fornecedor do sistema: (1) existe API (REST/GraphQL) e documentação? (2) existe exportação agendada estruturada (CSV/XLSX/JSON) para pasta, e-mail ou SFTP? (3) existe webhook de alteração? (4) quem autoriza e com que credencial (chave, OAuth)? (5) quais entidades e campos saem (fornecedor, produto, código, preço, fotos, embalagem, pedidos)? Com resposta positiva em 1 ou 2, o mesmo pipeline de lotes (`createImportBatch` → `previewBatch` → `applyImportBatch`) recebe a fonte automática; sem isso, o XLSX/CSV continua o método funcional.

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
| IA (cadastro por foto, textos de marketing) | `src/lib/integrations/ai.ts` | `api` com `ANTHROPIC_API_KEY` (API Messages, sem SDK); sem chave, `manual`; `aiMode = MOCK` devolve exemplo rotulado. Humano confirma tudo |

## EXTERNAL DEPENDENCIES PENDING

Para ativar cada integração real é preciso fornecer:

1. **Appwrite**: feito. Falta cadastrar as três variáveis na Vercel e trocar a chave de API (a usada na publicação passou pelo chat).
2. **Sankhya**: documentação da API (endpoint de criação de pedido, autenticação, campos obrigatórios) e credenciais. Implementar `SankhyaAdapter.createOrder` real e trocar `getSankhyaAdapter()`.
3. **Boleto/PIX**: gateway ou banco escolhido, credenciais e webhook de confirmação. Implementar `PaymentProvider.createCharge` e um route handler de webhook que chame `confirmDownPayment`.
4. **E-mail**: provedor (Resend, SES, SendGrid) e chave. Trocar `sendEmail` em `notifications.ts`.
5. **WhatsApp**: conta WhatsApp Business API (Meta ou BSP), número, token e templates aprovados. Trocar `sendWhatsapp`.
6. **Vercel**: `SESSION_SECRET`, `CRON_SECRET` e as variáveis do Appwrite no projeto; cron de lembretes já está em `vercel.json`.
7. **IA**: `ANTHROPIC_API_KEY` na Vercel (e `aiModel` nas configurações, padrão `claude-sonnet-5-5`). Sem a chave nada quebra: a tela informa "IA não configurada" e o cadastro segue manual. Geração de imagem comercial ainda não está ligada (só o prompt de imagem é produzido).
