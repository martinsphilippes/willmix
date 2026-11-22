# Tabelas padrão: pedidos e itens do pedido

Pedido do dono (22/11/2026). Toda tela que lista pedidos (encomenda, pedido, cotação ou solicitação ao fornecedor) usa as mesmas colunas, na mesma ordem; e toda tela que lista os itens de um pedido usa outro conjunto fixo. O que colaborador externo não vê hoje continua sem ver.

A ordem das colunas e a leitura das condições do pedido ficam em `src/lib/order-table.ts` (`ORDER_COLUMNS`, `ORDER_ITEM_COLUMNS`, `orderTermsCells`); os textos, em `src/i18n/modules/order-table.ts`.

## 1. Tabela de pedidos

| #   | Coluna          | O que mostra                                                | De onde vem hoje                                      | Quem vê                |
| --- | --------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ---------------------- |
| 1   | Nº do pedido    | O número do pedido (um só; o nº AFV saiu até segunda ordem) | `requests.number`                                     | Todos                  |
| 2   | Data negociação | Dia em que o pedido foi lançado                             | `requests.createdAt`                                  | Todos                  |
| 3   | Tipo de venda   | Trading Sales (encomenda) ou Wellmix STK (estoque)          | `orderTerms.operationType`; estoque e reposição = STK | Todos                  |
| 4   | Prazo pgto.     | Número de parcelas                                          | `orderTerms.paymentPlan.installments`                 | Todos                  |
| 5   | Forma pgto.     | Forma de pagamento escolhida no pedido                      | `orderTerms.paymentPlan.name`                         | Todos                  |
| 6   | Faturamento     | WX (Wellmix) ou WD (distribuidora)                          | `orderTerms.saleFormat`                               | Todos                  |
| 7   | VIP             | Nível do cliente no pedido                                  | `orderTerms.wellmixTier`                              | Wellmix                |
| 8   | Grupo econômico | Grupo do cliente no Sankhya                                 | `parties.economicGroupName`                           | Wellmix                |
| 9   | Cliente nº      | Código do cliente no Sankhya                                | `parties.sankhyaCode`                                 | Wellmix                |
| 10  | Cliente nome    |                                                             | `parties.name`                                        | Wellmix                |
| 11  | Status          | O que o pedido está esperando (de quem é a vez)             | `requestNextStep().who` (docs/TURNS.md)               | Todos                  |
| 12  | Situação        | O momento do passo em que ele está, com quem pode agir      | `requestNextStep()`                                   | Wellmix                |
| 13  | Prazo resposta  | Prazo (SLA) da ação esperada; vermelho quando atrasado      | `stepDue`                                             | Todos                  |
| 14  | Itens           | Quantos produtos diferentes                                 | `requestComposition`                                  | Todos                  |
| 15  | Entregas        | Quantas entregas foram programadas no pedido                | `schedule.items`                                      | Todos                  |
| 16  | Total CBM (m³)  | Cubagem total                                               | `encomendaTotals().cbm`                               | Todos                  |
| 17  | Valor total     | Valor previsto do pedido, com frete                         | `priceForecast.total`                                 | "Ver valores e margem" |
| 18  | Fornecedor      | A partir de quando o pedido o define                        | `orders.supplierId` do pedido da solicitação          | Wellmix                |

Dado que o portal não tem aparece como "—"; nada é inventado.

Saíram da lista (seguem na página do pedido e no CSV): Peças, Master, Inner, Cont./prog., Analista e Data (que virou "Data negociação").

### Onde já está aplicada

- **Encomendas** (`/app/requests`), para a Wellmix e para o cliente.

### Onde falta aplicar

Pedidos (`/app/orders`), Cotação (`/app/supplier-requests`), Reposição, Ordens de venda e as listas dos passos do fluxo. Nessas, o cliente e as condições do pedido chegam pela solicitação ligada (`orders.requestId`; `demandIds` na cotação e na solicitação ao fornecedor).

## 2. Tabela de itens do pedido

Na ordem: Sequência, Foto, Situação, Status, Prazo de resposta (SLA), Código Wellmix, Descrição, Valor s/ IPI, Valor com IPI, Valor IPI com frete, Qtd. peças na caixa, Qtd. peças na inner, Qtd. pedido em caixas, Qtd. pedido em peças, CBM total. No nível do produto não há linha que abra mais informação.

Ainda não aplicada em nenhuma tela.

## 3. O que o portal não tem hoje (decisões do dono)

| Coluna                         | Situação                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nº do pedido igual ao Sankhya  | A solicitação, o pedido, a cotação e a solicitação ao fornecedor têm numerações próprias; o pedido tem ainda o nº do Sankhya (`erpNumber`) e o Track ID. Hoje a lista de Encomendas mostra o nº da solicitação. |
| Data da negociação             | Não há campo próprio. Usei a data em que o pedido foi lançado no portal.                                                                                                                                        |
| Wellmix STK                    | Não é um valor gravado. Mostro STK quando o cliente é o estoque da Wellmix ou a origem é reposição.                                                                                                             |
| Prazo de pagamento do cadastro | O cadastro do cliente não tem prazo de pagamento padrão. Mostro o nº de parcelas da forma escolhida no pedido.                                                                                                  |
| Forma de pagamento "Boleto"    | O portal não grava o meio (boleto). Mostro o nome da forma de pagamento do pedido.                                                                                                                              |
| VIP                            | Fica no pedido, não no cadastro do cliente. Existe um sexto nível, Evo.                                                                                                                                         |
| Valor s/ IPI e com IPI         | Não são gravados; só o preço unitário com frete da previsão. O Sankhya devolve valores com IPI na cotação, mas o portal não os guarda.                                                                          |
