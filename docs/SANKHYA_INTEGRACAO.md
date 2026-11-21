# Integração portal × Sankhya: mapa completo e plano dos pedidos (21/11/2026)

Este documento descreve a integração inteira entre o portal Wellmix e o Sankhya:

- o que o portal lê do Sankhya e no que cada dado se converte;
- como esses dados entram nas etapas e nos marcos do portal;
- como o portal escreve de volta no Sankhya;
- quando o portal consulta o Sankhya ou pede uma ação;
- como cada caso se mantém sincronizado.

A seção "Pedidos" traz o modelo novo, que substitui a carga antiga do histórico, e o plano para refazê-la.

Os detalhes de cada parte continuam nos documentos de origem:

| Assunto                     | Documento                |
| --------------------------- | ------------------------ |
| Cargas e telas              | docs/SANKHYA.md          |
| Análise das views de pedido | docs/SANKHYA_PEDIDOS.md  |
| Regras de Processos         | docs/PROCESSES.md        |
| Marcos                      | docs/MILESTONES.md       |
| Boletos                     | docs/CUSTOMER_PAYMENT.md |
| Venda                       | docs/SALES_ORDERS.md     |

Os números de linha citados são do código em 21/11/2026.

## 0. Decisões do dono (21/11/2026)

| #   | Pergunta                                                                                              | Decisão                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Compra para estoque precisa de uma solicitação de cliente?                                            | **Não.** A reposição é uma compra da própria Wellmix: não abre solicitação de cliente, vai direto para a cotação, e é lá que se abrem as solicitações aos fornecedores. O pedido de compra que vem do Sankhya entra sem solicitação de cliente.                                                            |
| D2  | Onde guardar quanto de cada item já embarcou, foi recebido e está pendente?                           | Sem decisão de negócio. São campos novos no item do pedido (seção 4.3).                                                                                                                                                                                                                                    |
| D3  | Onde guardar a cadeia de documentos (um NUNOTA por TOP)?                                              | Sem decisão de negócio. Campo novo no pedido (seção 4.3).                                                                                                                                                                                                                                                  |
| D4  | Onde ficam recebimento, qualidade e canal?                                                            | Sem decisão de negócio. Campos novos no pedido (seção 4.3).                                                                                                                                                                                                                                                |
| D5  | Pedido com parte embarcada: os marcos de embarque, desembaraço e nota ficam no embarque ou no pedido? | **No pedido, como "embarque parcial".** O pedido mostra quanto já embarcou e segue com o resto. Cada embarque tem o seu andamento.                                                                                                                                                                         |
| D6  | Quando apagar os 16.268 pedidos antigos?                                                              | Depois do plano aprovado e da carga de ensaio conferida (seção 9).                                                                                                                                                                                                                                         |
| D7  | De-para TOP → marco (seção 5.1)                                                                       | Segue a proposta, a confirmar com a Wellmix (21/11/2026). Validar na tela com casos reais. Refinamento do dono: **1104 sem pendência** = tudo embarcado, marco Embarque; **35 pendente** (`STATUS_SHIPPING` 3) = embarcado, faltando documento (BL, invoice, check list), marco Carregamento e documentos. |
| D8  | `CANAL_ADUANEIRO` é o canal que pausa?                                                                | É o canal do desembaraço. Verde segue o fluxo; Vermelho e Cinza pausam o pedido, como na Entrega (docs/DELIVERY.md); Amarelo segue com aviso de conferência documental. A confirmar.                                                                                                                       |
| D9  | Embarque pelo portal com quantidade parcial?                                                          | Sim, pode ser parcial (a confirmar com o técnico do Sankhya na primeira escrita).                                                                                                                                                                                                                          |
| D10 | Cotação 1002 e amostras 1003/140                                                                      | Ligar: a 1002 com a cotação de compra do portal e a 1003/140 com o fluxo de amostra.                                                                                                                                                                                                                       |
| D11 | 1104 pendentes sem `STATUS_SHIPPING` e amostras 140 antigas pendentes                                 | Situação separada **"Aguardando definição"**, com os dois casos à vista para observar e ajustar depois.                                                                                                                                                                                                    |
| D12 | Os 2.125 pedidos interrompidos (1100, 1101 ou 1102 sem pendência e sem documento seguinte)            | Entram como encerrados **"Interrompido no Sankhya"**, sem pendências, numa lista para conferência (dono, 21/11/2026).                                                                                                                                                                                      |
| D13 | Canal Amarelo                                                                                         | Segue o fluxo com aviso de conferência documental, sem pausar (dono, 21/11/2026).                                                                                                                                                                                                                          |

## 1. Como o portal fala com o Sankhya

- **Cliente da API:** `src/lib/integrations/sankhya-client.ts`, com credenciais criptografadas em `settings` (`sankhya.credentials`).
  - Cada chamada tem 25 s.
  - No erro "situação de concorrência" (a mesma sessão com duas chamadas ao mesmo tempo), a chamada é refeita até 3 vezes (`callService`, linha 276).
- **Serviços usados:**

| Serviço                           | Para quê                                                                                                                      | Função no portal  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `DbExplorerSP.executeQuery`       | Consultas SQL só de leitura (views, tabelas, funções). O portal recusa qualquer SQL que não seja SELECT (`assertReadOnlySql`) | `executeQuery`    |
| `CRUDServiceProvider.loadRecords` | Ler registros de uma entidade (Parceiro, Produto, ItemNota)                                                                   | `loadRecords`     |
| `DatasetSP.save`                  | Incluir ou alterar parceiro e produto                                                                                         | `datasetSave`     |
| `CACSP.incluirNota`               | Incluir uma nota (pedido, cotação, pedido de venda)                                                                           | `createNote`      |
| `CACSP.incluirAlterarItemNota`    | Incluir ou alterar itens de uma nota                                                                                          | `upsertNoteItems` |
| `SelecaoDocumentoSP.faturar`      | Gerar o documento da próxima TOP a partir do atual (o "faturar" do Sankhya)                                                   | `invoiceNotes`    |
| `CACSP.cancelarNota`              | Cancelar uma nota                                                                                                             | `cancelNotes`     |

- **Interruptor geral da escrita:** `sankhya.erp.ordersEnabled`, desligado por padrão.
  - Desligado, toda escrita automática vira "simulado": é registrada, mas não chega ao Sankhya.
  - Liga em Configurações → Sankhya → Processos ("Execução no Sankhya"). Ao ligar, grava `syncSince` (só sincroniza o que mudar depois disso), e a ação fica na auditoria.
  - As telas administrativas de teste (`actions/sankhya.ts`) escrevem direto, sem esse interruptor, só para o administrador.

## 2. Entradas: o que o portal lê e no que se converte

### 2.1 Cadastros (carga completa e fila do servidor)

Configurações → Sankhya → Carga do Sankhya → Carga completa. Cada carga lê por faixa de código, grava em lotes e guarda onde parou. O Sankhya é a fonte desses cadastros.

| Origem no Sankhya                                                               | Vira no portal                                                                                              | Chave                   | Observação                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| `sankhya.VW_AD_FORNECEDOR_WELL` (`E_FORNECEDOR = 'S'`); TGFPAR se a view falhar | `parties` tipo fornecedor, com a linha da view em `sankhyaSupplier`                                         | `sankhyaCode` = CODPARC | Contato pela TGFCTT                     |
| `sankhya.VW_AD_CLIENTE_WELL`                                                    | `parties` tipo cliente, com grupo econômico, matriz, RCA (`rcaCode`) e a linha da view em `sankhyaCustomer` | CODPARC                 | docs/ECONOMIC_GROUPS.md                 |
| `sankhya.VW_AD_VENDEDOR_WELL`; TGFVEN se a view falhar                          | Lista de RCAs (`settings.sankhyaSellers`) e `users.sellerCode`, ligado pelo e-mail                          | CODVEND                 | Escolher RCA para cliente sem RCA       |
| `sankhya.VW_AD_PRODUTO_WELL`; TGFPRO se a view falhar                           | `products` e `product_lines` (grupos)                                                                       | CODPROD                 | Nomes da TGFPRO em `sankhyaRefs`        |
| `sankhya.VW_AD_PRODUTO_FORNECEDOR_WELL`                                         | `product_suppliers` com `source = "sankhya"` e os portos em `sankhyaPorts`                                  | produto × fornecedor    | Vários fornecedores por produto         |
| TGFGRU (`GRAU = 1`)                                                             | `product_families` (família)                                                                                | CODGRUPOPROD            | docs/PARTNER_FAMILIES.md                |
| TGFTPV                                                                          | `payment_conditions`                                                                                        | CODTIPVENDA             |                                         |
| TGFLOC                                                                          | `stock_locations`                                                                                           | CODLOCAL                |                                         |
| TGFEST (empresa da Integração)                                                  | `stock_movements` do tipo `sankhya_balance`, a diferença por local                                          | CODPROD × CODLOCAL      | O estoque do portal vem daqui           |
| TGFPRO.IMAGEM e AD_IMAGEM*                                                      | `product_photos` e `documents`                                                                              | CODPROD + versão        | Só baixa o que mudou; recomeça todo dia |
| TGFVOA                                                                          | Caixas: CBM, peças, caixa interna                                                                           | CODPROD                 |                                         |

### 2.2 Consultas na hora, sem gravar no portal

| Origem                                                       | Onde aparece                                                                        | Gatilho            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------ |
| `VW_AD_PEDCLIENTE_ITEM_WELL`                                 | Histórico de compras do cliente na Nova solicitação, aba Análise                    | Ao abrir           |
| `FN_AD_ENC_COTACAO_V2_WELL` e `FN_AD_SUPERPLAN_INVERSA_WELL` | Previsão de preço da Nova solicitação, gravada em `requests.priceForecast` no envio | Na tela e no envio |
| TGFPAR (`TRANSPORTADORA = 'S'`)                              | Lista de transportadoras, com cache de 30 min                                       | Ao abrir           |
| Produto (`loadRecords`)                                      | Busca e conferência do CODPROD na solicitação ao fornecedor                         | Ao buscar          |
| TGFTOP, TGFCAB (só a TOP)                                    | Conferência antes de incluir ou faturar uma nota                                    | Antes de escrever  |

### 2.3 Bases agregadas, gravadas no portal

| Origem                                    | Vira                                                                        | Atualização                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `VW_AD_PEDCLIENTE_ITEM_WELL` + TGFVOA     | `customer_sales_monthly` (mês × cliente × produto) e `customer_sales_loads` | Cron diário `/api/jobs/customer-sales` e botão "Atualizar agora" |
| TGFFIN (`RECDESP = 1`) do pedido de venda | `orders.customerCharges`: boletos, linha digitável, baixa                   | Botão do financeiro e cron diário em `/api/jobs/reminders`       |

### 2.4 Pedidos

**A carga antiga do histórico** (TGFCAB das TOPs de importação, `sankhya-import.ts`) está **errada** e vai ser substituída. Ela criou um pedido por documento, ou seja, um por TOP. Foram 16.268 pedidos, dos quais uns 12 mil repetem a mesma compra. O modelo novo está na seção 4.

**A cópia para análise** (`sankhya_stage_rows`) traz as views de pedido como vêm, só para estudo: cabeçalhos e itens de compra e de venda e as ligações da TGFVAR (docs/SANKHYA_PEDIDOS.md). Ela não alimenta tela nem regra.

## 3. O que os dados mostraram (resumo de docs/SANKHYA_PEDIDOS.md)

- **Compra de importação, até a produção:** 1002 Cotação → 1100 Pre-order → 1101 Pedido de compra → 1102 Marketing → 1103 Check ETD/ETA → 1104 Ativação financeira / produção. É **um pedido ao fornecedor** que muda de TOP. Cada TOP é um documento novo, gerado do anterior e ligado pela TGFVAR. A etapa atual é o documento com `PEDIDO_PENDENTE = 'S'`.
- **Do embarque em diante:** 1104 → 35 Pedido de compra - embarque → 1 Pré-nota → 37 ou 1201, a nota de entrada. O embarque é **muitos para muitos**:
  - um pedido se divide em vários embarques;
  - um embarque junta até 77 pedidos, quase sempre do mesmo fornecedor (1.224 de 1.225).
- **A pendência mora no item.** Dos 411 pedidos pendentes em 1104, 191 já têm parte embarcada. Os campos que dizem isso são `QTD_ENTREGUE` e `ITEM_PENDENTE`.
- **O cabeçalho de compra já traz o acompanhamento,** calculado pela cadeia inteira da compra:

| Campo                | Valores                                          |
| -------------------- | ------------------------------------------------ |
| `STATUS_RECEBIMENTO` | Recebido, Recebimento parcial                    |
| `STATUS_QUALIDADE`   | Inspecionado, Inspecao parcial, Nao inspecionado |
| `CANAL_ADUANEIRO`    | Verde, Amarelo, Vermelho, Cinza                  |

Também vêm as datas de recebimento e de inspeção e a quantidade de processos de importação. Nos 411 pedidos em produção, 131 já têm recebimento parcial.

- **Venda:** 111 Pré-venda FV → 3 Ped venda WMS → 5 Nota de venda; também 61 → 3 → 5 e, na Suframa, 130 → 114 → 51.
  - A pré-venda pendente tem itens à espera de mercadoria: 24.400 itens de 3.887 produtos.
  - Desses produtos, 1.395 estão numa importação em andamento.

### 3.1 Primeiro ensaio da reconstrução (21/11/2026, SQL sobre a cópia)

Cada pedido é a ponta da cadeia de 1100 a 1104/1107: o documento mais avançado, sem sucessor nessas TOPs. Uma divisão (1100 que vira dois 1101) dá dois pedidos.

| Situação da ponta                                     | Pedidos                       | No portal                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1104 sem pendência (tudo embarcado) e 1107            | 3.276                         | Encerrados (ou em embarque, conforme os embarques)                                                                                               |
| 1104 pendente                                         | 409                           | Em andamento: Produção, Inspeção, Embarque parcial; os sem `STATUS_SHIPPING` vão para "Aguardando definição"                                     |
| 1100 / 1102 / 1103 pendente                           | 47 / 15 / 1                   | Em andamento                                                                                                                                     |
| 1100, 1101 ou 1102 **sem pendência e sem sucessor**   | 1.102 + 754 + 269 = **2.125** | **Interrompidos:** o documento saiu de pendente sem gerar o seguinte e sem recebimento. Parecem cancelados ou substituídos no Sankhya (seção 10) |
| 1103 que seguiu pelo caminho antigo (30 Produção, 94) | 150                           | Caminho antigo, encerrados                                                                                                                       |
| **Total**                                             | **cerca de 6.000**            | Contra os 16.268 da carga antiga                                                                                                                 |

## 4. Modelo novo dos pedidos de compra

### 4.1 O que fica no portal e o que fica só como consulta

| Situação no Sankhya                                           | No portal                                                                                                                      | Por quê                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Compra com documento pendente de 1100 a 1104                  | **Pedido** (`orders`), um por cadeia, com itens, etapa, marco e pendências                                                     | É onde a equipe trabalha                                                                |
| Embarque pendente (35 ou 1)                                   | **Embarque** (`containers` + `container_items`), ligado aos itens dos pedidos que leva                                         | O embarque tem o próprio andamento (booking, carregamento, embarque, desembaraço, nota) |
| Compra encerrada (sem documento pendente e recebida)          | **Pedido encerrado e leve:** itens, quantidades, preço, fornecedor e datas, sem etapas nem pendências                          | "Última compra", Estratégia de compra, preço de referência, país de origem              |
| Documentos de cada TOP já passada, impostos, histórico antigo | **Só consulta** na view                                                                                                        | O pedido guarda a lista de NUNOTAs, e o resto se lê quando precisa                      |
| Cotação 1002 e amostras 1003/140 pendentes                    | Ligadas (D10): a 1002 à cotação de compra do portal (`purchase_quotes`); a 1003/140 ao fluxo de amostra (docs/SAMPLE_ORDER.md) |                                                                                         |

**Até quando a compra fica viva no portal:** até o recebimento completo (`STATUS_RECEBIMENTO = Recebido`, sem documento pendente na cadeia). Nesse ponto o pedido se encerra, os marcos terminam e as pendências fecham. O pedido continua no banco como histórico leve.

### 4.2 De-para: view → portal

**Cadeia → pedido** (`orders`):

| View de compra (cabeçalho)                    | Campo do portal                                           | Regra                                                                                    |
| --------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cadeia de NUNOTAs (TGFVAR)                    | `orders.sankhyaChain` (novo)                              | Lista de {NUNOTA, TOP, pendente, data}, do mais antigo ao atual                          |
| NUNOTA pendente                               | `orders.sankhyaCode`                                      | Muda a cada TOP; o portal sempre fatura a partir dele                                    |
| `NUMNOTA`                                     | `orders.erpNumber`                                        | Conforme a escolha NUNOTA/NUMNOTA da Integração                                          |
| `COD_FORNECEDOR`                              | `orders.supplierId`                                       | Pelo `parties.sankhyaCode` do fornecedor                                                 |
| `CODEMP`                                      | `orders.customerId`                                       | A empresa Wellmix compradora (cadastro "EMP-n"), como hoje                               |
| —                                             | `orders.requestId`                                        | **Vazio** (D1): o pedido de reposição não tem solicitação de cliente. Ver seção 4.4      |
| `MOEDA_ORIGEM` / `VALOR_TOTAL_PEDIDO_ORIGEM`  | `fobCurrency` / `fobTotal`                                | Moeda de origem, não mais o R$ do VLRNOTA                                                |
| `COTACAO_MOEDA_ORIGEM`                        | `fxRate`                                                  |                                                                                          |
| `INCOTERM`                                    | `incoterm`                                                | EXW, FCA, FOB                                                                            |
| `COD_TIPO_NEGOCIACAO`                         | `paymentConditionId`                                      | Pela `payment_conditions.code`                                                           |
| `COD_PORTO_DESEMBARQUE`                       | `arrivalPort`                                             | Leva à transportadora padrão (docs/DELIVERY.md)                                          |
| `ETD`, `ETA`                                  | Produção e embarque (`production_tracks`, embarque)       |                                                                                          |
| `STATUS_SHIPPING`                             | Situação da produção                                      | 1 Produção, 2 Inspeção, 8 Aguardando aceite do fornecedor, 9 Compra programada           |
| `STATUS_QUALIDADE`, `DATA_INSPECAO`           | `orders.sankhyaQuality`, `sankhyaInspectedAt` (novos)     | Alimentam o marco Inspeção                                                               |
| `STATUS_RECEBIMENTO`, `DATA_RECEBIMENTO`      | `orders.sankhyaReceipt`, `sankhyaReceivedAt` (novos)      | Alimentam a Entrega e o encerramento                                                     |
| `CANAL_ADUANEIRO`, `QTD_PROCESSOS_IMPORTACAO` | `orders.customsChannel`, `sankhyaImportProcesses` (novos) | Verde segue; Vermelho e Cinza pausam o pedido (`pausedAt`); Amarelo segue com aviso (D8) |
| `TIPO_IMPORTACAO`                             | `operationMode`                                           | N Normal, E/T Encomenda, C Conta e ordem, A Amostra                                      |
| `DATA_ALTERACAO_PEDIDO`                       | `orders.sankhyaChangedAt` (novo)                          | Base da leitura incremental                                                              |
| Linha da view                                 | `orders.sankhyaRefs`                                      | Os códigos, como hoje                                                                    |

**Item do pedido** (`order_items`), pela view de itens do documento pendente:

| View de compra (item)                                    | Campo do portal            | Regra                                                |
| -------------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| `CODPROD`                                                | `productId`                | Pelo `products.sankhyaCode`                          |
| `SEQUENCIA`                                              | `sankhyaCode`              | Sequência no documento pendente                      |
| `QTD_NEGOCIADA`, `UNIDADE_NEGOCIADA`                     | `quantity`, `unit`         |                                                      |
| `PRECO_UNITARIO_ORIGEM`                                  | `unitPrice`                | Na moeda de origem                                   |
| `QTD_ENTREGUE`                                           | `shippedQty` (novo)        | O que já passou para embarque                        |
| Saldo (`QTD_NEGOCIADA − QTD_ENTREGUE`) e `ITEM_PENDENTE` | `pendingQty` (novo)        | É a pendência do item                                |
| `QTD_UNIDADES_POR_CAIXA`, `QTD_CAIXAS_CALCULADA`         | Embalagem do item          | Pela regra única de embalagem (`request-packing.ts`) |
| `IDENTIFICACAO_CONTAINER_ITEM`                           | Container previsto do item |                                                      |

**Embarque** (35 → 1 → nota):

| Origem                                             | Campo do portal                                          | Regra                                       |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| Documento 35 pendente e a sua cadeia (35 → 1 → 37) | `containers` + `containers.sankhyaChain` (novo)          | Um embarque por documento 35                |
| Ligação 1104 → 35 por item (TGFVAR, `QTDATENDIDA`) | `container_items` (`orderId`, `orderItemId`, `quantity`) | É o "muitos para muitos"                    |
| `IDENTIFICACAO_CONTAINER_ITEM`                     | `containers.code`                                        |                                             |
| `ETD`, `ETA`                                       | `containers.etd`, `eta`                                  |                                             |
| `STATUS_SHIPPING` / TOP                            | `containers.status`                                      | planning, loading, shipped, arrived, closed |

### 4.3 Campos novos (só acréscimos ao esquema)

- **`orders`:**
  - `sankhyaChain`: lista dos documentos da cadeia (NUNOTA, TOP, pendente, data);
  - `sankhyaChangedAt`;
  - `sankhyaQuality`, `sankhyaInspectedAt`;
  - `sankhyaReceipt`, `sankhyaReceivedAt`;
  - `customsChannel`, `sankhyaImportProcesses`;
  - `shipmentState`: sem embarque, embarque parcial ou embarcado.
  - `sankhyaSituation`: em andamento, aguardando definição, encerrado, interrompido no Sankhya ou caminho antigo (a mesma do ensaio).
- **`order_items`:** `shippedQty`, `receivedQty`, `pendingQty`.
- **`containers`:** `sankhyaCode` (NUNOTA pendente), `sankhyaChain`, `supplierId`.

Nada é removido. Os pedidos do portal que já nascem no portal continuam iguais.

### 4.4 Pedido sem solicitação de cliente (D1)

Hoje `orders.requestId` é obrigatório: todo pedido nasce de uma solicitação. Com D1, o pedido de reposição que vem do Sankhya entra sem solicitação. Isso pede:

1. `orders.requestId` passa a aceitar vazio. A coluna fica, só deixa de ser obrigatória.
2. Revisar as cerca de 50 leituras de `order.requestId` no código. Telas e regras que abrem a solicitação do pedido passam a tratar o vazio: mostram "Reposição (Sankhya)" e escondem o que é só de cliente.
3. Na cotação de compra do portal (reposição → Estratégia → cotação → solicitação ao fornecedor), o pedido criado no portal segue o caminho de sempre. Só o pedido trazido do Sankhya entra direto.

Como relaxar o "obrigatório" é uma mudança num campo existente, ela vai num PR próprio, com essa revisão e o E2E.

## 5. Etapas, marcos e pendências

### 5.1 De-para do Sankhya para o marco (proposta para a Wellmix validar)

Os 16 marcos do portal (docs/MILESTONES.md) são: Pedido novo, Certificação, Material de arte, Arte, Contrato, Sinal, Pré-produção, Inspeção, Amostras, Produção, Booking e logística, Carregamento e documentos, Embarque, Desembaraço, Nota fiscal e transporte, Entrega e recebimento.

| Onde a compra está no Sankhya                                | Marco atual no portal                                                                                  | Marcos anteriores                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1100 Pre-order pendente                                      | Pedido novo                                                                                            | —                                                                            |
| 1101 Pedido de compra                                        | Contrato (assinado)                                                                                    | Feitos: Pedido novo; Certificação, Material de arte e Arte conforme o pedido |
| 1102 Marketing pendente                                      | Arte / Material de arte                                                                                | Pedido novo e Contrato feitos                                                |
| 1103 Check ETD/ETA pendente                                  | Pré-produção                                                                                           | Arte feita                                                                   |
| 1104 pendente, `STATUS_SHIPPING` 8 Aguardando aceite         | Sinal                                                                                                  |                                                                              |
| 1104 pendente, `STATUS_SHIPPING` 1 Produção ou vazio         | Produção                                                                                               | Sinal feito                                                                  |
| 1104 com `STATUS_QUALIDADE` Inspecao parcial ou Inspecionado | Inspeção (andamento ou feito)                                                                          |                                                                              |
| 1104 com parte embarcada (`QTD_ENTREGUE > 0`)                | **Embarque parcial** (D5): o pedido segue em Produção com o saldo e mostra o que já embarcou           |                                                                              |
| 1104 sem pendência (tudo embarcado)                          | Embarque (D7)                                                                                          | Produção e Inspeção feitos                                                   |
| Embarque 35 pendente (`STATUS_SHIPPING` 3 Embarcado)         | No embarque: Carregamento e documentos, faltando BL, invoice ou check list (D7; docs/SHIPPING_DOCS.md) | No pedido: Embarque                                                          |
| 1 Pré-nota pendente / `CANAL_ADUANEIRO` preenchido           | Desembaraço (Vermelho ou Cinza pausa; D8)                                                              | Carregamento e documentos feito                                              |
| `STATUS_RECEBIMENTO` Recebimento parcial                     | Nota fiscal e transporte, parcial                                                                      |                                                                              |
| `STATUS_RECEBIMENTO` Recebido, sem pendência na cadeia       | Entrega e recebimento feita, e o pedido se encerra                                                     | Todos feitos                                                                 |

Os marcos que só existem no portal (Certificação, Amostras, Booking) seguem as regras do portal. A carga não inventa conclusão para eles: marca feito só o que o Sankhya mostra que já passou, e o resto fica como item do portal a fazer.

### 5.2 Pendências para as pessoas

- Cada marco em andamento abre os itens do portal para quem faz, pela regra de sempre (docs/TURNS.md e Pendências).
- A pendência do item (saldo a embarcar, saldo a receber) aparece no pedido e no "Com quem está".
- **Pedidos que chegam pela carga inicial:** só os em andamento (411 em produção, 15 em marketing, 47 pre-orders, 1 em check ETD/ETA, 46 embarques e 4 pré-notas) ganham pendências. Os encerrados entram sem pendências.
- **"Aguardando definição"** (D11): os 1104 pendentes sem `STATUS_SHIPPING` (172) e as amostras 140 antigas pendentes (16) entram numa situação à parte. Ganham uma lista própria com exemplos dos dois casos, sem marco inventado, até a Wellmix dizer onde ficam.
- Até o go-live, a carga respeita a marca "em espera" (`held`, docs/SANKHYA.md "Histórico em espera"): não gera aviso por e-mail ou WhatsApp, mas os pedidos aparecem na situação real.

## 6. Escrita: portal → Sankhya

### 6.1 O que já existe no código

| O que                           | Gatilho no portal                                                         | Serviço / tabela                                                                 | Volta para o portal                                                      | Proteções                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Parceiro (fornecedor e cliente) | Gravar o cadastro (`syncSoon`) e cron diário                              | `DatasetSP.save` em Parceiro (TGFPAR). Procura por CNPJ ou nome antes de incluir | `parties.sankhyaCode`, `sankhyaSyncedAt`                                 | Só com a execução ligada; registro em `process_events` (`sync:party:*`); erro tenta de novo na rodada seguinte |
| Produto                         | Gravar ou aprovar o produto, cron                                         | `DatasetSP.save` em Produto (TGFPRO). Procura pelo REFFORN                       | `products.sankhyaCode`                                                   | Igual; produto aguardando aprovação não vai                                                                    |
| Itens do pedido                 | Mudou quantidade ou preço                                                 | `CACSP.incluirAlterarItemNota` (TGFITE)                                          | `orders.sankhyaSyncedAt`                                                 | Item removido no portal não é apagado no Sankhya, só avisado                                                   |
| Pedido assinado                 | As duas assinaturas                                                       | `CACSP.incluirNota` na TOP do pedido (`topOrder`), ou o NUNOTA que já existe     | `orders.sankhyaCode`, `erpNumber`, `erpSyncStatus`                       | Desligado = mock, e o número é informado à mão; não envia duas vezes                                           |
| Regras de Processos             | Eventos: pedido assinado, cancelado, faturado; início e fim de cada marco | Incluir nota, faturar para a TOP da regra, cancelar                              | NUNOTA novo em `orders.sankhyaCode`; `process_events` com antes e depois | Uma vez por evento e pedido; o marco é marcado antes de disparar; erro não derruba o fluxo                     |
| Ordem de venda                  | Confirmar a ordem                                                         | `CACSP.incluirNota` na `salesTop`                                                | `sales_orders.erpNumber`, `erpStatus`                                    | Sem a TOP ou desligado: pendente, número à mão; não tenta de novo sozinho                                      |

### 6.2 O que muda com o modelo novo

- **Avanço de etapa = faturar o documento pendente.** Quando o marco do portal que corresponde à próxima TOP conclui, a regra de Processos fatura o NUNOTA pendente para essa TOP. Por exemplo, Contrato concluído → 1101; Arte concluída → 1102.
  - O documento novo entra em `orders.sankhyaChain` e vira o `sankhyaCode`.
  - O de-para marco → TOP é a tabela da seção 5.1 lida ao contrário, e fica nas regras de Processos, editável pelo administrador.
- **Embarque:** montar o embarque no portal (itens e quantidades dos pedidos) fatura do 1104 para a 35 só as quantidades do embarque.
  - **A conferir com o técnico do Sankhya:** se o `SelecaoDocumentoSP.faturar` aceita quantidade parcial por item. Os dados mostram que o Sankhya faz isso (1.636 pedidos divididos). Se a API não aceitar, o embarque continua sendo montado no Sankhya e o portal só lê.
- **Cadastros:** não mudam (6.1).
- **O Sankhya manda nos campos que ele calcula:** TOP, recebimento, qualidade, canal, quantidade entregue. O portal nunca escreve neles; só lê.

### 6.3 Ações que dependem do Sankhya (nota fiscal, boleto)

| Ação                                | Hoje                                                                                           | Proposta                                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nota fiscal de entrada (importação) | Feita no Sankhya; o portal não acompanha                                                       | A leitura incremental traz a nota (37 ou 1201) e o `STATUS_RECEBIMENTO`. O passo do portal conclui sozinho                                                             |
| Nota fiscal de venda (DANFE)        | Registrada à mão no portal (`registerSalesInvoice`)                                            | Ler a nota 5 gerada a partir do pedido 3 (TGFVAR) e preencher o número e a data. O financeiro só confere                                                               |
| Boleto                              | Lido da TGFFIN (botão e cron diário). Gerar no Sankhya não existe; o portal avisa o financeiro | Continua: o financeiro gera no Sankhya, e o portal lê e destrava o pedido quando o boleto é pago. Gerar pelo portal depende do serviço do Sankhya, ainda não levantado |
| Faturamento do pedido               | Botão "Registrar faturamento" e a regra `order:invoiced`, sem TOP padrão                       | O de-para do faturamento entra na tabela da seção 5.1                                                                                                                  |

## 7. Sincronismo: como cada lado fica igual ao outro

**Hoje não existe** leitura de volta do status das notas depois de uma escrita (ver o levantamento da seção 6.1). A única volta real é a dos boletos. O modelo novo fecha essa lacuna assim:

1. **Leitura incremental a cada 15 minutos** (orientação do TI):
   - compra e venda pelo `DATA_ALTERACAO_PEDIDO >=` (última leitura − 5 min), em páginas de 4.000 por `NUNOTA, SEQUENCIA`, sem subconsulta no `IN`;
   - a página encolhe se a view demorar, como na cópia de análise;
   - cada documento alterado atualiza a cadeia, o item e o embarque;
   - a chave de cada registro é o NUNOTA e a cadeia, então ler de novo não duplica.
2. **Quem manda em cada campo:**
   - **Sankhya:** TOP e documento pendente, quantidades entregues e recebidas, recebimento, qualidade, canal, valores, notas e boletos;
   - **portal:** tarefas, documentos, conversas, responsáveis, aprovações e o que só existe no portal;
   - **conflito:** o lado dono do campo vence, e a mudança fica na auditoria.
3. **Escrita com confirmação.** Toda escrita do portal (faturar, incluir, cancelar):
   - fica em `process_events`;
   - na leitura seguinte, o portal confere se o documento novo apareceu na view;
   - se não apareceu em 2 leituras, abre uma pendência "Conferir no Sankhya" para o administrador.
4. **Conferência automática** a cada leitura e toda noite, com o resultado numa tela do administrador:
   - cada compra é um pedido só;
   - os totais de cada pedido (itens, quantidade, valor) batem com a view;
   - todo item pendente na view está pendente no portal, com o mesmo saldo;
   - as quantidades de cada embarque batem com a TGFVAR.
5. **Cadastros:** a carga completa traz o Sankhya para o portal, e a sincronização leva o portal ao Sankhya (`syncSince`, `sankhyaSyncedAt`). A marca `sankhyaSyncedAt` evita que o que acabou de vir do Sankhya volte para lá.

## 8. Vendas

- **Ficam só como consulta**, como hoje: histórico do cliente, Análise e Painel comercial.
- **A base agregada** `customer_sales_monthly` continua.
- **A venda feita no portal** (oferta → ordem de venda) segue o docs/SALES_ORDERS.md: inclui o pedido de venda na `salesTop`, e a leitura incremental passa a trazer a nota 5 e o boleto.
- **Pré-venda à espera de mercadoria:** a ligação com a compra pelo produto (seção 3) pode virar a "demanda em espera" na Reposição. É uma decisão futura, não entra neste plano.

## 9. Plano de execução

Cada etapa é um PR com testes e E2E. Nada apaga dados até a etapa 5.

1. **Esquema aditivo:** os campos da seção 4.3. **Feito em 21/11/2026:** `orders.sankhyaChain`, `sankhyaChangedAt`, `sankhyaQuality`, `sankhyaInspectedAt`, `sankhyaReceipt`, `sankhyaReceivedAt`, `customsChannel`, `sankhyaImportProcesses`, `shipmentState` (`none`, `partial`, `shipped`) e `sankhyaSituation` (a situação do ensaio: `in_progress`, `awaiting_definition`, `closed`, `interrupted`, `legacy_path`); `order_items.shippedQty`, `receivedQty`, `pendingQty`; `containers.sankhyaCode` (com índice), `sankhyaChain`, `supplierId`. Todos opcionais; os pedidos do portal ficam com eles vazios.
2. **Pedido sem solicitação (D1):** `requestId` opcional e a revisão das leituras (seção 4.4).
3. **Carga de ensaio a partir da cópia já no banco** (`sankhya_stage_rows`), sem chamar o Sankhya. **Feita em 21/11/2026:**
   - `scripts/sankhya-projection.sql` monta, no próprio Postgres, um pedido por cadeia (a ponta de 1100 a 1104/1107) e um embarque por documento 35. Grava na tabela de ensaio `sankhya_projection` (apaga e refaz só ela) com situação, marco, estado do embarque, a cadeia de documentos, os itens com o que já embarcou (pela TGFVAR, `QTDATENDIDA`; o `QTD_ENTREGUE` não serve para isso) e o saldo, os status de recebimento, qualidade e canal e os embarques ligados;
   - a tela **Configurações → Sankhya → Pedidos do Sankhya (ensaio)** (`src/app/app/settings/sankhya/_orders.tsx`, só o administrador) mostra as contagens por situação, marco e motivo, a lista com busca por NUNOTA (de qualquer documento da cadeia) ou fornecedor e o detalhe de cada pedido e embarque;
   - para montar de novo depois de uma cópia nova das views, o Claude roda o script pela ferramenta do Supabase.

   **Resultado de 21/11/2026:**

   | Situação                      | Pedidos                                                                                                                                             |
   | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Em andamento                  | 366: Pedido novo 47, Arte 15, Pré-produção 1, Sinal 2, Produção 210 (135 com embarque parcial), Carregamento e documentos 88, Desembaraço 3         |
   | Encerrado                     | 2.139                                                                                                                                               |
   | Caminho antigo                | 11                                                                                                                                                  |
   | Interrompido no Sankhya (D12) | 2.125                                                                                                                                               |
   | Aguardando definição          | 1.382: 197 em produção sem `STATUS_SHIPPING`; 1.185 sem pendência e sem documento seguinte (1.046 em 1104, a maioria de 2024 e 2025, e 139 em 1103) |

   Embarques: 1.510, dos quais 48 em andamento (35 pendente ou pré-nota pendente). Montado na produção em 21/11/2026, 02:30 UTC.

   O encerramento vale quando tudo embarcou e nenhum embarque está aberto, mesmo sem a coluna de recebimento (212 pedidos têm os embarques fechados sem `STATUS_RECEBIMENTO`).

4. **Validação:** o dono e a Wellmix conferem o relatório e o de-para da seção 5.1.
5. **Limpeza (feita em 21/11/2026, a pedido do dono, sem cópia de segurança: "estão errados, ponto") e carga real.** Saíram de vez os 16.268 pedidos da carga antiga e tudo o que veio com eles: 185.457 itens, 161.448 etapas, 613.413 pendências, 50.875 marcos, 16.268 resumos, 27.809 títulos, as 16.268 solicitações da carga e os indicadores prontos. Antes, foi conferido que nenhuma outra tabela (documentos, conversas, avisos, auditoria, estoque, containers e as demais 40 que apontam para pedido) tinha algo ligado a eles. Ficaram as 3 solicitações feitas no portal, todos os cadastros e a cópia das views. A carga antiga ("Histórico de pedidos", entidade `orders` da Carga do Sankhya, e o "Gravar no portal" da amostra) ficou **desligada** (chave `sankhya.legacyOrders`; só os testes da regra antiga a ligam), para os pedidos errados não voltarem. Falta a carga real:
   - apagar os 16.268 pedidos antigos e o que veio junto (solicitações, itens, etapas, pendências, marcos, 27.809 títulos, resumos), em partes, com prévia e a palavra de confirmação. Nenhum trabalho do portal está ligado a eles (conferido em 20/11/2026);
   - gravar os pedidos e embarques novos;
   - reconstruir os resumos.
6. **Leitura incremental de 15 minutos** e a conferência automática.
7. **Escrita do avanço de etapa** (regras de Processos com o de-para marco → TOP), testada primeiro no modo simulado e depois ligada.
8. **Nota de venda e nota de entrada** pela leitura (seção 6.3).

## 10. Em aberto

1. Confirmação da Wellmix do de-para da seção 5.1 (D7). Até lá vale a proposta, validada na tela com casos reais.
2. Confirmação de D8 (canal) e de D9 (embarque parcial pela API, na primeira escrita).
3. Gerar boleto pelo portal: existe serviço no Sankhya para isso? (Em verificação com a Wellmix.)
4. Os 1.046 pedidos em 1104 sem pendência e sem documento seguinte (nem embarque nem recebimento), quase todos de 2024 e 2025: foram cancelados, desmembrados ou embarcados por outro caminho? Estão em "Aguardando definição" na tela de ensaio.
