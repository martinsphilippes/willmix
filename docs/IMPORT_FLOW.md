# Embarque e desembaraço (Fase D)

Cartão **Embarque e desembaraço** no pedido (a partir da Preparação). Cada passo tem quem faz, quem valida e quem vê. Recusar exige motivo e devolve o passo a quem fez. Quem enviou não valida o próprio passo (exceto admin).

## Novos logins
- **Comex (assessoria)**: papel `comex`, empresa do tipo Comex, designada no pedido em "Parceiros" (`orders.comexId`).
- **Agente de carga**: papel `logistics` (`orders.logisticsId`).

Sem parceiro designado, a Wellmix faz a parte dele. Havendo uma só empresa do tipo, ela entra sozinha nos pedidos novos (como os outros parceiros).

O **financeiro** é uma função da Wellmix (Equipe → Funções). Só ele (ou o admin) valida e paga o numerário.

## Passos

| Passo | Faz | Valida | Vê (além da Wellmix) | Depois de |
|---|---|---|---|---|
| Booking (nº) | agente de carga | Wellmix | agente, comex, fornecedor | — |
| Draft do BL (arquivo) | agente de carga | comex | agente, comex, fornecedor | booking |
| Invoice e packing list (arquivo) | comex | fornecedor | comex, fornecedor, agente | — |
| Invoice e packing assinados | fornecedor | comex | comex, fornecedor, agente | invoice |
| BL original (nº + arquivo) | agente de carga | comex | agente, comex, fornecedor, despachante | draft BL |
| Presença de carga (data) | comex | — | comex, agente | BL |
| Numerário (R$ + demonstrativo) | comex | financeiro | comex | — |
| Numerário pago (comprovante) | financeiro | — | comex | numerário |
| Canal de parametrização | comex | — | comex, agente | — |
| DI/DUIMP (nº + XML) | comex | — | comex | — |
| CE Mercante (nº) | comex | — | comex, agente | — |
| Comprovante de importação (CI) | comex | — | comex | — |
| DANFE (nº + arquivo) | Wellmix | — | comex, agente | DI |

- **Invoice e packing list gerados**: o link "Gerar invoice e packing list" abre uma página com a invoice comercial e o packing list montados com os itens, o preço da cotação e a ficha de compra (caixas, pesos e CBM). O comex confere, salva em PDF e envia no passo. O fornecedor valida e devolve assinado.
- **Canal vermelho ou cinza**: alerta à Wellmix (prazo de liberação e armazenagem).
- **Arquivos**:
  - cada arquivo de passo é do tipo `import_step` e só abre para quem vê aquele passo (o fornecedor nunca abre numerário, DI ou CI; o cliente não vê nada);
  - um arquivo só entra num passo se for do mesmo pedido;
  - o XML da DI baixa como anexo.

## Pendências
- O parceiro vê os passos dele que já podem ser feitos, e os que recusaram.
- Quem valida vê os passos enviados.
- O financeiro vê o numerário.
- A Wellmix só recebe a pendência quando valida, quando o passo é dela (DANFE) ou quando valida no lugar de um parceiro não designado.

## Limites
O cartão não substitui as etapas Embarque e Desembaraço do pedido. O BL e os custos continuam também nelas, por enquanto. Juntar os dois fica para quando o fluxo for usado de verdade.
