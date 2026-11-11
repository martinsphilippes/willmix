# RFQ em espera

Decisão do dono (10/11/2026): a RFQ (pedido de preço a vários fornecedores, com comparação e disputa) **sai do caminho principal por um tempo**. Ela fica guardada, inteira, e volta quando o dono ligar. No lugar dela, cada produto vai para **um fornecedor só**, sem disputa.

Nada foi removido: telas, rotas, tabelas e dados da RFQ continuam como estavam. O que muda é o que aparece no caminho do dia a dia.

**Booking antigo removido (11/11/2026).** O envio automático da solicitação nascida do Booking antigo ao fornecedor do produto ("Gerar solicitação", "Analisar o Booking", `isBookingRequest`) saiu com a fila antiga de produtos (docs/BOOKING.md). O caminho de hoje é a solicitação ao fornecedor aberta na Seleção de itens (docs/SUPPLIER_REQUESTS.md).

## 1. Como funciona

|                         | RFQ em espera (padrão)                                                                                                                                                                                                        | RFQ ativa                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Configuração            | `settings.rfqEnabled = false`                                                                                                                                                                                                 | `true`                                    |
| Solicitação sem cotação | Sem cartão na tela da solicitação (pedido do dono): só o aviso "ainda não foi enviado" com o atalho. O envio é na tela **Pedidos → RFQ**: uma lista com o fornecedor do produto já escolhido e o botão "Enviar ao fornecedor" | Cartão **Abrir RFQ**: vários fornecedores |
| Depois de enviada       | Sem "Convidar mais"                                                                                                                                                                                                           | "Convidar mais fornecedores"              |
| Lote                    | Sem cartão no lote; cada produto é enviado pela tela Pedidos → RFQ                                                                                                                                                            | Vários                                    |
| Disputa de fornecedores | Não aparece (só existe com duas ou mais cotações)                                                                                                                                                                             | Aparece                                   |
| Pendência da Wellmix    | "Enviar ao fornecedor: produto"                                                                                                                                                                                               | "Abrir RFQ: produto"                      |

## 2. Regras de negócio

- **Um fornecedor por produto** com a RFQ em espera. As ações da tela (`openRfqAction`, `openBatchRfqAction`) chamam `assertRfqStandby` (`services/requests.ts`) antes de abrir: mais de um fornecedor de uma vez → `rfq_standby_one`; segundo fornecedor numa solicitação já enviada a outro → `rfq_standby_sent`.
- O Superplan ("Abrir faca e RFQ") já manda um fornecedor só e segue igual.
- RFQs abertas antes de colocar em espera continuam valendo: as cotações recebidas aparecem na comparação e podem ser escolhidas.
- O fornecedor nunca vê outros fornecedores nem o cliente (já era assim).

## 3. Tela Pedidos → RFQ (`/app/rfq`)

Abre para o administrador e para as funções que abrem Solicitações (comprador, gerente de produto, planejamento). Mostra: a situação (Em espera / Ativa), como o fluxo está funcionando, o que está guardado, o interruptor e as solicitações em cotação (nº, produto, situação, fornecedores, quantos responderam).

Na lista, a solicitação que ainda não foi a nenhum fornecedor tem o envio ali mesmo (`sendRequestToSupplierAction`: um fornecedor, com a trava `assertRfqStandby`). A pendência "Enviar ao fornecedor" leva a esta tela (`/app/rfq#req-<id>`).

O interruptor é só do administrador (`setRfqEnabledAction`, `src/app/app/actions/rfq.ts`): grava `settings.rfqEnabled` e registra na auditoria (`settings.rfq`). A tela de Configurações não mexe nessa chave.

## 4. Onde está cada parte

| Parte                           | Arquivo                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Configuração                    | `src/lib/settings.ts` (`rfqEnabled`)                                                  |
| Trava de um fornecedor só       | `src/lib/services/requests.ts` (`assertRfqStandby`)                                   |
| Tela e ação                     | `src/app/app/rfq/page.tsx`, `src/app/app/actions/rfq.ts`                              |
| Cartão da solicitação e do lote | `src/app/app/requests/[id]/page.tsx`, `src/app/app/requests/batch/[groupId]/page.tsx` |
| Textos                          | `src/i18n/modules/rfq-standby.ts`, `notifications.ts`                                 |
| Testes                          | `tests/unit/rfq-standby.test.ts`; o E2E liga a RFQ e segue pelo caminho da disputa    |

## 5. Limites conhecidos e próximos passos

- A situação da solicitação continua se chamando "RFQ aberta" nas listas e na Control Tower (é o nome da etapa no banco). Trocar o rótulo para "Com o fornecedor" é uma mudança só de texto, se o dono quiser.
- Certificação e selo (docs/CERTIFICATION.md): a certificadora recebe quando o pedido é criado, envia o selo, quem faz a arte aplica e a Wellmix confere. A faca continua sendo pedida ao fornecedor depois da confirmação da cotação. As duas decisões são do dono (10/11/2026).

## 6. Tela da solicitação (pedido do dono, 10/11/2026)

Saíram da tela da solicitação, como cartões:

- **RFQ**: com a RFQ em espera não há cartão (nem na solicitação, nem no lote). O cartão "Abrir RFQ" só volta com a RFQ ligada.
- **Solicitante do cliente**: virou uma linha no cartão da solicitação (lista e "Salvar"), e só aparece quando a compra é de um cliente com login. Compra para o Estoque Wellmix não tem solicitante. A regra não mudou: só o login escolhido vê a solicitação e o pedido (docs de acesso).

## Sourcing em espera (10/11/2026)

Decisão do dono: o Sourcing fica em espera, igual à RFQ. Os produtos chegam pelos bookings (planilhas de fornecedor), já com o fornecedor; o Sourcing (visitas, itens encontrados, sourcing sob demanda) sai do dia a dia e fica guardado.

|                                    | Sourcing em espera (padrão)                                                                                                         | Sourcing ativo                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Configuração                       | `settings.sourcingEnabled = false`                                                                                                  | `true`                                                            |
| Menu                               | "Sourcing (em espera)", no fim do grupo Pedidos, junto da RFQ                                                                       | o mesmo item                                                      |
| Pedido de produto fora do catálogo | A solicitação nasce igual (origem `sourcing_demand` guardada), mas **não** abre item de Sourcing nem o aviso "Sourcing sob demanda" | Abre o item de Sourcing em rascunho e avisa a equipe (como antes) |
| Pendência "Sourcing sob demanda"   | Não aparece                                                                                                                         | Aparece                                                           |
| Tela Pedidos → Sourcing            | Quadro no alto com a situação, o que está guardado e o interruptor; as visitas e os itens continuam embaixo, utilizáveis            | igual, com a situação "Ativo"                                     |

- O interruptor é só do administrador (`setSourcingEnabledAction`, `src/app/app/actions/sourcing.ts`): grava `settings.sourcingEnabled` e registra na auditoria (`settings.sourcing`).
- Nada foi removido: telas, rotas, tabelas e dados do Sourcing continuam. Busca por foto ou link, promoção de item a produto e os atalhos nas páginas de produto não mudam.
- Solicitação fora do catálogo criada em espera não ganha item de Sourcing depois, ao ativar (o item pode ser cadastrado à mão na tela).
- Textos em `src/i18n/modules/sourcing-standby.ts`; o nome no menu, em `dictionaries.ts` (`nav.sourcing`).
