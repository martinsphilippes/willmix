# RFQ em espera e Booking do fornecedor

Decisão do dono (10/11/2026): a RFQ (pedido de preço a vários fornecedores, com comparação e disputa) **sai do caminho principal por um tempo**. Ela fica guardada, inteira, e volta quando o dono ligar. No lugar dela, cada produto do Booking é de **um fornecedor específico**, que recebe o produto como **análise do Booking**, sem disputa.

Nada foi removido: telas, rotas, tabelas e dados da RFQ continuam como estavam. O que muda é o que aparece no caminho do dia a dia.

## 1. Problema

- O Booking que sobe pela ficha técnica já vem de um fornecedor (a planilha é dele). Tratar esse produto como disputa entre fornecedores não corresponde ao negócio.
- A RFQ pedia um passo manual (escolher fornecedores) que, neste fluxo, sempre tinha a mesma resposta.

## 2. Objetivo

- Escolher o fornecedor **uma vez**, ao importar a ficha (docs/BOOKING.md, "Booking do fornecedor").
- O produto ir **sozinho** para esse fornecedor quando a solicitação nasce do Booking.
- O fornecedor ver o produto como **análise do Booking** dele.
- A RFQ ficar em espera numa tela própria, com um interruptor.

## 3. Como funciona

|                                              | RFQ em espera (padrão)                                                                                                                                                                                    | RFQ ativa                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Configuração                                 | `settings.rfqEnabled = false`                                                                                                                                                                             | `true`                                                                     |
| Booking → "Gerar solicitação"                | A solicitação já vai para o fornecedor do produto (`sendToBookingSuppliers` em `services/booking.ts`): uma cotação convidada, situação "RFQ aberta", um aviso só por fornecedor ("Booking para analisar") | A solicitação fica em "Solicitado" esperando a abertura da RFQ, como antes |
| Solicitação sem cotação                      | Cartão **Enviar ao fornecedor**: um fornecedor só (o do produto já marcado)                                                                                                                               | Cartão **Abrir RFQ**: vários fornecedores                                  |
| Depois de enviada                            | Sem "Convidar mais"                                                                                                                                                                                       | "Convidar mais fornecedores"                                               |
| Lote                                         | Um fornecedor para o lote                                                                                                                                                                                 | Vários                                                                     |
| Disputa de fornecedores                      | Não aparece (só existe com duas ou mais cotações)                                                                                                                                                         | Aparece                                                                    |
| Pendência da Wellmix                         | "Enviar ao fornecedor: produto"                                                                                                                                                                           | "Abrir RFQ: produto"                                                       |
| Pendência do fornecedor (produto do Booking) | "Analisar o Booking: produto"                                                                                                                                                                             | igual                                                                      |

Produto do Booking **sem fornecedor** no cadastro: a solicitação nasce em "Solicitado" e a linha do Booking mostra "Enviar ao fornecedor".

## 4. Regras de negócio

- **Um fornecedor por produto** com a RFQ em espera. As ações da tela (`openRfqAction`, `openBatchRfqAction`) chamam `assertRfqStandby` (`services/requests.ts`) antes de abrir: mais de um fornecedor de uma vez → `rfq_standby_one`; segundo fornecedor numa solicitação já enviada a outro → `rfq_standby_sent`.
- O Superplan ("Abrir faca e RFQ") já manda um fornecedor só e segue igual.
- RFQs abertas antes de colocar em espera continuam valendo: as cotações recebidas aparecem na comparação e podem ser escolhidas.
- O fornecedor nunca vê outros fornecedores nem o cliente (já era assim).

## 5. Visão do fornecedor

Nada de tela nova: é a mesma tela de Cotações, com o texto do Booking quando a solicitação nasceu de uma linha do Booking (`isBookingRequest`):

- aviso "Booking para analisar: produto" (`notif.bookingAnalysis.*`);
- pendência "Analisar o Booking: produto";
- título "Análise do Booking: produto" e o aviso de que não há outros fornecedores no produto;
- selo "Booking" na lista de cotações;
- o que ele responde é o de sempre (docs/QUOTE_FLOW.md): preço desejado (confirmar, mudar ou não aceitar), ficha, fotos, prazo e pedido mínimo.

## 6. Tela Pedidos → RFQ (`/app/rfq`)

Só o administrador (tela `rfq`, em `ADMIN_ONLY`). Mostra: a situação (Em espera / Ativa), como o fluxo está funcionando, o que está guardado, o interruptor e as solicitações em cotação (nº, produto, situação, fornecedores, quantos responderam).

O interruptor (`setRfqEnabledAction`, `src/app/app/actions/rfq.ts`) grava `settings.rfqEnabled` e registra na auditoria (`settings.rfq`). A tela de Configurações não mexe nessa chave.

## 7. Onde está cada parte

| Parte                           | Arquivo                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Configuração                    | `src/lib/settings.ts` (`rfqEnabled`)                                                  |
| Envio do Booking ao fornecedor  | `src/lib/services/booking.ts` (`sendToBookingSuppliers`)                              |
| Trava de um fornecedor só       | `src/lib/services/requests.ts` (`assertRfqStandby`, `isBookingRequest`)               |
| Tela e ação                     | `src/app/app/rfq/page.tsx`, `src/app/app/actions/rfq.ts`                              |
| Cartão da solicitação e do lote | `src/app/app/requests/[id]/page.tsx`, `src/app/app/requests/batch/[groupId]/page.tsx` |
| Textos                          | `src/i18n/modules/rfq-standby.ts`, `notifications.ts`                                 |
| Testes                          | `tests/unit/rfq-standby.test.ts`; o E2E liga a RFQ e segue pelo caminho da disputa    |

## 8. Limites conhecidos e próximos passos

- A situação da solicitação continua se chamando "RFQ aberta" nas listas e na Control Tower (é o nome da etapa no banco). Trocar o rótulo para "Com o fornecedor" é uma mudança só de texto, se o dono quiser.
- O fornecedor vê o produto quando a Wellmix gera a solicitação pelo Booking, não na hora em que a ficha sobe (antes disso a Wellmix ainda está analisando preço e margem). Mostrar ao fornecedor já na importação é possível, se for a decisão.
- A certificação em paralelo com a faca, o pedido mínimo, o prazo e a foto, e o selo da certificadora junto da arte, vêm em seguida.
