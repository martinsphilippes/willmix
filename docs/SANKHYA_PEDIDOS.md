# Pedidos do Sankhya: entender antes de carregar (20/11/2026)

A carga antiga do histórico (11 e 12/11/2026) criou 16.268 pedidos no portal, um por documento (NUNOTA) das TOPs de importação. Cerca de 12 mil deles são a mesma compra repetida em etapas diferentes: o mesmo fornecedor, os mesmos itens e o mesmo valor aparecem em vários pedidos. Antes de refazer, os dados do Sankhya são estudados sem hipóteses herdadas do trabalho anterior (dono, 20/11/2026). A Wellmix valida as conclusões depois.

## O que a Wellmix informou (20/11/2026)

- O que define a compra de importação é a **TOP** (`CODTIPOPER`). Na ordem do fluxo:
  1. 1100 Pre-order
  2. 1101 Pedido de compra
  3. 1102 Marketing
  4. 1103 Check ETD/ETA
  5. 1104 Ativação financeira / produção
  6. 1107 Embarcado
  7. 35 Pedido de compra - embarque
  8. 1 Pedido de compra - pré-nota
- Também são de importação: 1002 Cotação, 1003 Amostra e 140 Amostra de importação.
- Cada etapa é um **documento novo, gerado a partir do anterior**. A mesma compra aparece em várias TOPs, e a etapa em que ela está agora é a do documento com `PEDIDO_PENDENTE = 'S'`.
- Ficam fora: compra nacional e de consumo (7, 176 e 1120).
- `NUMERO_IMPORTACAO` está vazio: não liga os documentos de uma compra. Na view de compra, 28.908 documentos em 19 TOPs, de 552 fornecedores, 752 pendentes.
- A leitura das views segue `LEITURA-VIEWS-PEDIDOS` do TI:
  - filtro por `DATA_ALTERACAO_PEDIDO`;
  - páginas de 4.000 por `NUNOTA, SEQUENCIA`;
  - nada de subconsulta dentro do `IN`;
  - rotina a cada 15 minutos, desde a última leitura menos 5 minutos.

## Cópia bruta para análise (stage)

Configurações → Sankhya → Carga do Sankhya → Carga completa, linhas "Análise: …" (só o administrador; também na fila do servidor). As linhas ficam em `sankhya_stage_rows` (`dataset`, `rowKey`, `nunota`, `runId`, `row`), como vêm do Sankhya, sem os campos vazios. A tabela não alimenta tela nem regra (`src/lib/integrations/sankhya-stage.ts`).

| Cópia             | Origem                                                                                   | O que entra                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `purchaseHeaders` | `VW_AD_PEDCOMPRA_CAB_WELL`                                                               | Inteira                                                                                           |
| `purchaseItems`   | `VW_AD_PEDCOMPRA_ITEM_WELL`                                                              | Inteira                                                                                           |
| `purchaseLinks`   | `TGFVAR` (de que documento cada um foi gerado), com a TOP e o TIPMOV de origem e destino | Ligações com origem ou destino num documento de compra, lidas a partir dos cabeçalhos já copiados |
| `saleHeaders`     | `VW_AD_PEDCLIENTE_CAB_WELL`                                                              | Inteira                                                                                           |
| `saleItems`       | `VW_AD_PEDCLIENTE_ITEM_WELL`                                                             | Só com pendência (pedido ou item pendente, de qualquer data) ou alterada nos últimos 90 dias      |

A view de itens de venda tem 4,4 milhões de linhas, uns 5 GB copiada inteira, e o banco tem 8 GB, já com 1,4 GB em uso. As pendências moram no item de venda (dono, 20/11/2026).

Ler de novo não duplica: a linha é gravada pela chave da origem (`dataset:NUNOTA[:SEQUENCIA[:NUNOTAORIG:SEQUENCIAORIG]]`). "Recomeçar" relê tudo, e `runId` diz de que rodada cada linha veio.

## O que a análise responde (a preencher com os dados)

1. **O que é uma compra:** como os documentos de uma mesma compra se ligam (TGFVAR, itens, fornecedor), se há compra que se divide ou que se junta, e se há compra sem documento posterior.
2. **Em que etapa ela está:** a TOP do documento pendente, comparada com `STATUS_SHIPPING`, `STATUS_NOTA`, `ITEM_PENDENTE`, `QTD_ENTREGUE` e as datas (ETD, ETA).
3. **Quando ela termina:** o que marca uma compra finalizada (último documento sem pendência, pré-nota, nota de entrada) e quantas estão em andamento.
4. **Vendas:** TOPs, tipos (`TIPO_IMPORTACAO`), o que é pendente no pedido e no item, e a ligação com a compra (container, produto, cliente de referência).
5. **O que fica no portal e o que fica só como consulta:** o que vira pedido com etapa, marco e pendências, o que vira resumo, até quando fica e o que o portal escreve no Sankhya a cada mudança (faturar para a próxima TOP, nota, boleto).

Os achados ficam aqui e no documento para a Wellmix validar. Só depois vêm a nova carga dos pedidos e a limpeza dos 16.268 pedidos antigos, que não têm trabalho do portal ligado a eles (conferido em 20/11/2026).
