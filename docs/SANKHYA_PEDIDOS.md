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
- **Acompanhamento já está no cabeçalho do pedido de compra** (dicionário de 20/11/2026, conferido pelo TI contra o banco). São 6 colunas calculadas no fim da `VW_AD_PEDCOMPRA_CAB_WELL`, que não existem na view de itens:

| Coluna                     | O que é                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANAL_ADUANEIRO`          | Verde, Amarelo, Vermelho ou Cinza (vale o mais severo entre os processos de importação do pedido); vazio = sem processo de importação ligado |
| `QTD_PROCESSOS_IMPORTACAO` | Quantos processos de importação entram na conta do canal                                                                                     |
| `STATUS_RECEBIMENTO`       | Recebido (há entrada e nenhum saldo pendente) ou Recebimento parcial (há entrada e ainda há saldo); vazio = sem entrada                      |
| `DATA_RECEBIMENTO`         | Data da entrada mais recente entre os processos do pedido                                                                                    |
| `STATUS_QUALIDADE`         | Inspecionado (todos os itens do 1104 inspecionados), Inspecao parcial ou Nao inspecionado; vazio = documento fora da cadeia de um 1104       |
| `DATA_INSPECAO`            | Data da inspeção mais recente                                                                                                                |

A cópia dos cabeçalhos de compra de 20/11/2026 é anterior a elas. Para trazê-las, copie de novo só os cabeçalhos de compra (os itens não mudaram). A cópia lê a view inteira (`SELECT *`), então não precisa mudar código. Colunas por view em 20/11/2026: venda cabeçalho 58, venda item 75, compra cabeçalho 79, compra item 97.

- A leitura das views segue `LEITURA-VIEWS-PEDIDOS` do TI:
  - filtro por `DATA_ALTERACAO_PEDIDO`;
  - páginas de 4.000 por `NUNOTA, SEQUENCIA`;
  - nada de subconsulta dentro do `IN`;
  - rotina a cada 15 minutos, desde a última leitura menos 5 minutos.

## Cópia bruta para análise (stage)

Configurações → Sankhya → Carga do Sankhya → Carga completa, linhas "Análise: …" (só o administrador; também na fila do servidor). As linhas ficam em `sankhya_stage_rows` (`dataset`, `rowKey`, `nunota`, `runId`, `row`), como vêm do Sankhya, sem os campos vazios. A tabela não alimenta tela nem regra (`src/lib/integrations/sankhya-stage.ts`).

| Cópia             | Origem                                                                                   | O que entra                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purchaseHeaders` | `VW_AD_PEDCOMPRA_CAB_WELL`                                                               | Inteira                                                                                                                                                                                            |
| `purchaseItems`   | `VW_AD_PEDCOMPRA_ITEM_WELL`                                                              | Inteira                                                                                                                                                                                            |
| `purchaseLinks`   | `TGFVAR` (de que documento cada um foi gerado), com a TOP e o TIPMOV de origem e destino | Ligações com origem ou destino num documento de compra, lidas a partir dos cabeçalhos já copiados                                                                                                  |
| `saleHeaders`     | `VW_AD_PEDCLIENTE_CAB_WELL`                                                              | Inteira                                                                                                                                                                                            |
| `saleItems`       | `VW_AD_PEDCLIENTE_ITEM_WELL`                                                             | Itens dos pedidos de venda pendentes (pedido ou algum item, de qualquer data) ou alterados nos últimos 90 dias. Os pedidos saem dos cabeçalhos já copiados e os itens vêm pelo `NUNOTA IN (lista)` |
| `saleLinks`       | `TGFVAR` das vendas                                                                      | De que documento cada venda foi gerada e no que ela virou, a partir dos pedidos da cópia dos itens de venda                                                                                        |

A view de itens de venda tem 4,4 milhões de linhas, uns 5 GB copiada inteira, e o banco tem 8 GB, já com 1,4 GB em uso. As pendências moram no item de venda (dono, 20/11/2026). A primeira versão filtrava a view inteira com `OR` (pendente ou alterado). A consulta passava de 60 s e a rodada seguinte da fila chegava com a anterior ainda rodando no Sankhya, o que dava o erro "O serviço foi cancelado por situação de concorrência" (20/11/2026). Pela lista de pedidos no `IN`, cada chamada é curta.

**Página que encolhe (20/11/2026):** cada chamada ao Sankhya tem 25 s. (A primeira versão procurava o texto do erro no lugar errado: o `SankhyaError` guarda o código em `message` e o texto em `detail`. Corrigido na segunda.) Com as colunas novas de recebimento e qualidade, calculadas na view, a página de 4.000 cabeçalhos de compra passou desse tempo. A cópia agora corta a página pela metade a cada estouro (4.000, 2.000, 1.000… até 100) e guarda o tamanho que funcionou (`pageSize`). Se a consulta que estourou ainda estiver rodando no Sankhya, vem o erro de concorrência; a rodada então só espera a próxima, sem contar como falha da fila.

Ler de novo não duplica: a linha é gravada pela chave da origem (`dataset:NUNOTA[:SEQUENCIA[:NUNOTAORIG:SEQUENCIAORIG]]`). "Recomeçar" relê tudo, e `runId` diz de que rodada cada linha veio.

## O que a análise responde (a preencher com os dados)

1. **O que é uma compra:** como os documentos de uma mesma compra se ligam (TGFVAR, itens, fornecedor), se há compra que se divide ou que se junta, e se há compra sem documento posterior.
2. **Em que etapa ela está:** a TOP do documento pendente, comparada com `STATUS_SHIPPING`, `STATUS_NOTA`, `ITEM_PENDENTE`, `QTD_ENTREGUE` e as datas (ETD, ETA).
3. **Quando ela termina:** o que marca uma compra finalizada (último documento sem pendência, pré-nota, nota de entrada) e quantas estão em andamento.
4. **Vendas:** TOPs, tipos (`TIPO_IMPORTACAO`), o que é pendente no pedido e no item, e a ligação com a compra (container, produto, cliente de referência).
5. **O que fica no portal e o que fica só como consulta:** o que vira pedido com etapa, marco e pendências, o que vira resumo, até quando fica e o que o portal escreve no Sankhya a cada mudança (faturar para a próxima TOP, nota, boleto).

Os achados ficam aqui e no documento para a Wellmix validar. Só depois vêm a nova carga dos pedidos e a limpeza dos 16.268 pedidos antigos, que não têm trabalho do portal ligado a eles (conferido em 20/11/2026).

## Achados da primeira análise (20/11/2026)

Dados da cópia de 20/11/2026:

| Cópia                | Linhas  |
| -------------------- | ------- |
| Cabeçalhos de compra | 28.908  |
| Itens de compra      | 378.223 |
| Ligações (TGFVAR)    | 311.623 |
| Cabeçalhos de venda  | 222.871 |

Os itens de venda ainda não estavam copiados. As consultas que geraram cada número estão no histórico da sessão e podem ser refeitas direto em `sankhya_stage_rows`.

### 1. O caminho de uma compra de importação

As ligações da TGFVAR confirmam o fluxo informado pela Wellmix e mostram onde ele muda de forma:

| De → para                                  | Documentos de destino | Formato                                                                                                    |
| ------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1002 Cotação → 1100 Pre-order              | 766                   | Em linha (36 cotações viram mais de um pre-order)                                                          |
| 1100 Pre-order → 1101 Pedido de compra     | 4.475                 | Em linha (37 se dividem)                                                                                   |
| 1101 → 1102 Marketing                      | 3.891                 | Em linha (17 se dividem)                                                                                   |
| 1102 → 1103 Check ETD/ETA                  | 3.614                 | Em linha (6 se dividem)                                                                                    |
| 1103 → 1104 Ativação financeira / produção | 3.521                 | Em linha (48 se dividem)                                                                                   |
| **1104 → 35 Pedido de compra - embarque**  | **1.225**             | **Muitos para muitos:** 1.636 pedidos se dividem em vários embarques e 942 embarques juntam vários pedidos |
| 35 → 1 Pedido de compra - pré-nota         | 1.312                 | Um para um                                                                                                 |
| 1 → 37 (TIPMOV C, nota de compra)          | 1.232                 | Fim: a nota de entrada. 37 não está na view de compra, que só tem pedidos (TIPMOV O)                       |
| 1 → 1201 (TIPMOV C)                        | 63                    | Fim, outra TOP de nota                                                                                     |

Caminho antigo (2020 a 2022), fora de uso: 117 → 33 → 30 → 35 → 1 → 37. A 1107 Embarcado tem um documento só (2026). Na prática, o embarque vai de 1104 direto para 35.

**Leitura:** até a 1104, a compra é **um pedido ao fornecedor** que muda de TOP, sempre como um documento novo gerado do anterior. Da 1104 em diante, o que anda é o **embarque**, que junta itens de vários pedidos e leva só parte de cada um. Por isso a carga antiga, com um pedido por documento, repetiu as compras: cada TOP do mesmo pedido virou um pedido no portal.

### 2. Em que etapa cada uma está agora (`PEDIDO_PENDENTE = 'S'`)

| Etapa (documento pendente)          | Documentos | Observação                                                                                |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1002 Cotação                        | 17         |                                                                                           |
| 1003 / 140 Amostra                  | 33 / 17    | 16 das 140 são de 2021 a 2025 e parecem abandonadas                                       |
| 1100 Pre-order                      | 47         | Datas até 06/2027 (compras planejadas)                                                    |
| 1101 Pedido de compra               | 0          | Passa para 1102 logo                                                                      |
| 1102 Marketing                      | 15         |                                                                                           |
| 1103 Check ETD/ETA                  | 1          |                                                                                           |
| 1104 Ativação financeira / produção | 411        | `STATUS_SHIPPING` 1 Produção em 210, vazio em 172, 8 Aguardando aceite do fornecedor em 2 |
| 35 Embarque                         | 46         | Todos com `STATUS_SHIPPING` 3 Embarcado                                                   |
| 1 Pré-nota                          | 4          | Embarcado, aguardando a nota                                                              |

**A pendência mora no item.** Dos 411 pedidos pendentes em 1104, 191 já têm parte embarcada:

| Itens                     | Quantidade |
| ------------------------- | ---------- |
| Ainda sem embarque        | 3.435      |
| Parciais                  | 160        |
| Já embarcados por inteiro | 2.267      |

O pedido só sai de "pendente" quando todos os itens passam para um embarque. Os campos que dizem isso estão no item: `QTD_ENTREGUE` e `ITEM_PENDENTE`.

### 3. Quando uma compra termina

- **O pedido ao fornecedor** termina quando todos os itens foram para embarque: a 1104 sem pendência, com `QTD_ENTREGUE` igual a `QTD_NEGOCIADA` em todos os itens.
- **O embarque** termina na nota de compra (37 ou 1201), que é o recebimento no Brasil. Com as colunas novas, o próprio pedido diz isso (`STATUS_RECEBIMENTO` Recebido ou Recebimento parcial, `DATA_RECEBIMENTO`), sem precisar seguir a TGFVAR até a nota. A inspeção (`STATUS_QUALIDADE`) e o canal aduaneiro (`CANAL_ADUANEIRO`) também vêm prontos no pedido.
- **A compra inteira** termina quando todos os embarques dos seus itens chegaram à nota.

### 4. Vendas

- Todas são pedidos (TIPMOV P). Nenhuma tem `TIPO_IMPORTACAO` preenchido, então a encomenda do cliente não aparece por esse campo na venda.
- TOPs principais:

| TOP                                     | Pedidos | Pendentes                  |
| --------------------------------------- | ------- | -------------------------- |
| 3 Ped venda - WMS                       | 111.479 | 1.162                      |
| 61 Ped venda FV                         | 77.377  | 195                        |
| 111 Ped pré-venda FV                    | 24.354  | 4.822, quase todos de 2026 |
| 158, 114, 50, 130 (Suframa, reservando) |         |                            |
| 135 Multi-loja encomenda                |         | 23                         |
| 34 Orçamento sob encomenda              |         | 12                         |

- **O caminho da venda** (cópia `saleLinks`: 303.898 ligações dos 16 mil pedidos de venda pendentes ou alterados em 90 dias):

| De → para                                     | Documentos de destino | Formato                                                                      |
| --------------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| 111 Pré-venda FV → 3 Ped venda WMS            | 9.749                 | Uma pré-venda vira vários pedidos WMS (5.542 pré-vendas): atendida em partes |
| 61 Ped venda FV → 3 Ped venda WMS             | 2.776                 | Um para um                                                                   |
| 3 Ped venda WMS → 5 (TIPMOV V, nota de venda) | 5.315                 | Um para um: o fim da venda                                                   |
| 130 → 114 → 51 (Suframa)                      | 147 → 111             | O mesmo caminho para a Zona Franca                                           |
| 158 (reservando) → 3, 70 → 3, 72 → 73 → 5     |                       | Variações (reserva, multi-loja)                                              |
| 17 → 19, 40 → 41, 135 → 136                   |                       | Bonificação/amostra, feiras e multi-loja encomenda, direto para a nota       |

- **Onde mora a pendência da venda** (itens dos pedidos pendentes):

| TOP             | Pedidos pendentes | Itens   | Ainda sem atendimento     | Já passaram para a etapa seguinte |
| --------------- | ----------------- | ------- | ------------------------- | --------------------------------- |
| 111 Pré-venda   | 4.822             | 160.493 | 24.400                    | 135.726                           |
| 3 Ped venda WMS | 1.162             | 9.032   | 9.032 (aguardando a nota) | 0                                 |
| 61 Ped venda FV | 195               | 6.102   | 6.102                     | 0                                 |

A pré-venda pendente não está parada. A maior parte dela já virou pedido WMS, e o que sobra são itens à espera de mercadoria.

- **A venda se liga à compra pelo produto:** 3.887 produtos têm item de pré-venda sem atendimento, e 1.395 deles estão num pedido de compra de importação em andamento (itens pendentes de 1100 a 1104, 35 ou 1). É a demanda que espera a importação.

### 5. Proposta de modelo para validar

1. **No portal (com etapa, marco e pendências):**
   - os pedidos de compra em andamento (o documento pendente de cada cadeia 1002 → 1104), como **um pedido por cadeia**, com os itens e o quanto de cada um já foi para embarque;
   - os embarques em andamento (35 e 1 pendentes), como **embarques** ligados aos itens dos pedidos que levam.
2. **Resumo no portal:** pedidos e embarques terminados, só com fornecedor, produtos, quantidades, preço e datas, para a "última compra", a Estratégia de compra e o histórico.
3. **Só consulta na view:** os documentos de cada etapa já passada, os impostos e o histórico completo de vendas.
4. **Etapa e marco:** pela TOP do documento pendente (1100 Pre-order … 1104 Produção, 35 Embarque, 1 Pré-nota) e pelo `STATUS_SHIPPING`, que completa a 1104 (Produção, Inspeção, Aguardando aceite). O de-para TOP → marco do portal fica para a Wellmix validar.
5. **Escrita no Sankhya:** o avanço de etapa no portal fatura o documento pendente para a próxima TOP (`SelecaoDocumentoSP.faturar`, já usado em Processos). O documento novo passa a ser o "pendente" da cadeia, e a leitura a cada 15 minutos traz o que mudou no Sankhya.

### Perguntas para a Wellmix

1. Os 172 pedidos em 1104 sem `STATUS_SHIPPING` estão em produção ou aguardando outra coisa?
2. As 16 amostras 140 de 2021 a 2025 ainda pendentes podem ser dadas como encerradas?
3. O embarque (35) é o container? Um container pode juntar pedidos de fornecedores diferentes?
4. Na venda, a 111 pré-venda fica pendente com os itens que esperam mercadoria (24.400 itens, 1.395 produtos com importação em andamento). É assim que a força de vendas trabalha a falta de estoque? O portal deve mostrar essa espera ligada ao pedido de compra (quando chega)?
5. Respondida pelo dicionário de 20/11/2026: `STATUS_RECEBIMENTO` (Recebido, Recebimento parcial), `STATUS_QUALIDADE` (Inspecionado, Inspecao parcial, Nao inspecionado) e o `CANAL_ADUANEIRO` (Verde, Amarelo, Vermelho, Cinza). O canal Cinza ou Vermelho pausa o pedido no portal (docs/DELIVERY.md); vale confirmar se é o mesmo canal.
