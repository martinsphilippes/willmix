# Convite para booking concorrente

Decisão do dono (11/11/2026). Na Seleção de itens, ao avaliar um item de booking, a Wellmix pode, além de agrupar para a seleção, **abrir cotação**: convidar fornecedores e tradings a subir um **booking concorrente** do item. Esse convite substitui a RFQ, que saiu (docs/QUOTE_FLOW.md).

## Fluxo

1. **Abrir cotação:** na aba Itens da Seleção, cada item tem o link "Abrir cotação" (`/app/booking/invite/[itemId]`). Só a Wellmix com a tela Booking abre.
2. **Convidar:**
   - A Wellmix marca fornecedores e tradings ativos, até 30 por vez, e escreve o que precisa (o parceiro lê).
   - Cada parceiro recebe um convite próprio com o mesmo `groupId`, o aviso (sino, e-mail e WhatsApp em modo mock) e a pendência "Enviar booking concorrente".
   - Quem já tem convite aberto para o item não recebe outro (`booking_invite_exists`).
3. **Prazo (SLA):** `bookingInviteSlaDays` em Configurações → SLA, padrão **1 dia** corrido, de 1 a 30. Passado o prazo, o convite aparece como "Atrasado" na tela e na pendência do parceiro.
4. **O que o parceiro vê:** em "Convites de booking" (`/app/supplier-requests/invites`, tela Solicitações ao fornecedor), só os convites dele. Cada convite mostra:
   - o item: descrição, código, quantidade, material, medidas, capacidade, embalagem, cores e foto;
   - o que a Wellmix precisa e o prazo.

   O booking de origem, o fornecedor dele e o preço ficam de fora.

5. **Responder:**
   - O parceiro sobe a planilha do booking dele, com as mesmas colunas do Booking por planilha (docs/BOOKING.md). A Wellmix também pode subir por ele.
   - O booking nasce em **rascunho**, com o parceiro como **responsável** (`booking_lots.partnerId`) e a Wellmix que convidou como dona.
   - O convite fica "Booking enviado", com o link para o booking, e quem convidou é avisado.
6. **Depois:**
   - A Wellmix confere e fecha o booking, como qualquer outro. Os itens dele entram na Seleção para comparar.
   - A solicitação aberta de um item desse booking vai ao responsável, ou seja, ao parceiro que subiu o booking (docs/BOOKING.md, "Responsável pelo booking").
7. **Cancelar:** a Wellmix cancela um convite ainda aberto na tela do item.

## Dados

Tabela `booking_invites`:

- **Identificação:** `number`, `groupId`, `status` (`open`, `answered` ou `cancelled`).
- **Origem:** `bookingItemId` e `bookingLotId`.
- **O que o parceiro vê:** `item` (cópia do item) e `message`.
- **Convidado e prazo:** `partnerId` e `dueAt`.
- **Resposta:** `answeredAt`, `answeredByUserId` e `answeredLotId`.
- **Encerramento e autoria:** `cancelledAt` e `createdByUserId`.

Auditoria:

- `booking_invite.create` e `booking_invite.cancel` no booking de origem;
- `booking_invite.answer` no booking enviado.

## Onde está

| Parte     | Arquivo                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Serviço   | `src/lib/services/booking-invites.ts`                                                                       |
| Ações     | `src/app/app/actions/booking-invites.ts`                                                                    |
| Telas     | `src/app/app/booking/invite/[itemId]` (Wellmix) e `src/app/app/supplier-requests/invites` (lista e convite) |
| Pendência | `bookingInviteTasks` em `src/lib/services/tasks.ts`                                                         |
| Textos    | `src/i18n/modules/booking-invites.ts`                                                                       |
| Testes    | `tests/unit/booking-invites.test.ts`                                                                        |
