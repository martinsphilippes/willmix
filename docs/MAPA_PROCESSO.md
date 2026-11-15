# Mapa do processo (fonte: attilasm/wellmix-presentation, data.json)

Gerado em 2026-11-15 por `scripts/mapa-processo.mjs` a partir do data.json do repositório da apresentação (aba Mapa, layout 15, revisão 15). Não edite à mão: mude o mapa e gere de novo. RACI: R faz, A aprova, C é consultado, I é informado. "Situação no mapa" e "Nota" são da varredura do dono (done: atende; partial: parcial; todo: falta).

## Personas

| Chave        | Persona                      |
| ------------ | ---------------------------- |
| `dono`       | Dono / Diretoria executiva   |
| `dircompras` | Diretoria de compras         |
| `gp`         | Gerente de produto (GP)      |
| `comprador`  | Comprador                    |
| `planner`    | Planner                      |
| `analista`   | Analista / Operador          |
| `cadastro`   | Cadastro e fiscal            |
| `mkt`        | Marketing Wellmix            |
| `fin`        | Financeiro                   |
| `vendas`     | Comercial / Vendas           |
| `forn`       | Fornecedor (fábrica)         |
| `trading`    | Trading                      |
| `agencia`    | Agência de arte              |
| `ocp`        | Certificadora (OCP)          |
| `agente`     | Agente de carga              |
| `maritima`   | Companhia marítima           |
| `comex`      | Comex / Despachante          |
| `transp`     | Transportador                |
| `cliente`    | Cliente                      |
| `agmkt`      | Agência de marketing (China) |
| `qualidade`  | Qualidade (CD)               |

## Book

**Objetivo:** Descobrir, comparar e validar o produto com o fornecedor  
**Critério de saída:** Amostra aprovada e produto criado ou associado no cadastro.

| Passo | Nome                                              | Quem (RACI)                                                    | Decisão                                                                                                                                                       | Saída                                                         | Situação no mapa | Nota                                                                                                                                                                                                          |
| ----- | ------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B11   | Book por GP                                       | gp:R, comprador:A                                              |                                                                                                                                                               | Book do parceiro no portal com arte                           | partial          | Varredura de 15/11: parcial. O book entra por planilha pela Wellmix ou por parceiro externo; não há lançamento de book do GP interno com arte. O tipo de parceiro 'GP' existe, mas sem vínculo com a operação |
| B5    | Existe alternativa?                               | comprador:R, forn:R, trading:R, gp:C                           | Existe alternativa? Sim: Volta à seleção com a alternativa. Não: Abre cotação com outros fornecedores.                                                        | Cotações concorrentes recebidas                               | done             | Varredura de 15/11: atende. Convite de book concorrente: até 30 parceiros, prazo de 1 dia (Seleção → Abrir cotação)                                                                                           |
| B2    | Book por Wellmix, Trading, ou fornecedor          | trading:R, dircompras:I, forn:R, dono:R                        |                                                                                                                                                               | Book no portal                                                | done             | Varredura de 15/11: atende. Booking por planilha; Trading lança o próprio booking                                                                                                                             |
| B1    | Recepção dos books da Wellmix                     | forn:R, comprador:R, dircompras:A, cadastro:C, gp:C, planner:I |                                                                                                                                                               | Book importado, com itens e fornecedor identificados          | done             | Varredura de 15/11: atende. Importação .xlsx/.xls/Google Sheets                                                                                                                                               |
| B12   | Enriquecimento de informações do Book             | comex:R, comprador:A                                           |                                                                                                                                                               | Book completo e pronto para uso                               | done             | Varredura de 15/11: atende. NCM do item do book pelo despachante/comex; card Dados do book                                                                                                                    |
| B3    | Estudo de viabilidade (Superplan)                 | comprador:R, dircompras:A, fin:C, planner:C, dono:I            |                                                                                                                                                               | Custo por peça, preço mínimo e meta por item                  | done             | Varredura de 15/11: atende. Superplan                                                                                                                                                                         |
| B4    | Seleção de itens (+ produto filho)                | comprador:R, dircompras:A, planner:C, vendas:C, mkt:I          |                                                                                                                                                               | Item escolhido e variantes                                    | done             | Varredura de 15/11: atende. Seleção de itens, grupos e blocos sugeridos                                                                                                                                       |
| B6    | Imagem de referência (IA) + Programação de envios | mkt:R, comprador:R, forn:I, dircompras:A                       |                                                                                                                                                               | Imagens e ficha de referência (EN/中文)                       | partial          | Varredura de 15/11: parcial. Tela pronta; a imagem por IA depende da chave da OpenAI na Vercel (sem ela, nada é gerado)                                                                                       |
| B7    | Solicitação ao fornecedor                         | comprador:R, dircompras:A, gp:C, forn:I, trading:I, planner:I  |                                                                                                                                                               | Condições aceitas pelo fornecedor                             | done             | Varredura de 15/11: atende. Solicitação ao fornecedor (Negociações)                                                                                                                                           |
| B8    | Amostragem                                        | forn:R, comprador:A, gp:I, mkt:I                               |                                                                                                                                                               | Fotos e vídeos da amostra no portal                           | done             | Varredura de 15/11: atende. Amostragem com fotos e vídeos                                                                                                                                                     |
| B9    | Aprovação da amostra                              | gp:R, dircompras:A, comprador:C, fin:C, forn:I                 | Amostra aprovada e produto viável? Sim: Cria ou associa o produto e libera a encomenda. Não: Nova rodada de amostragem.                                       |                                                               | done             | Varredura de 15/11: atende. Aprovação da amostra; mesa do GP                                                                                                                                                  |
| B10   | Reposição                                         | planner:R, dircompras:A, comprador:C                           |                                                                                                                                                               | Necessidade de reposição                                      | partial          | Varredura de 15/11: parcial. Reposição nasce do Pós-venda e do Histórico comercial (telas fora do menu); não há sugestão por estoque para o Planner                                                           |
| B7?   | Fornecedor aceita?                                | forn:A, trading:R, comprador:I                                 | Fornecedor aceita a solicitação? Sim: Segue para a amostragem. Não: Volta à seleção.                                                                          |                                                               | done             | Varredura de 15/11: atende. Fornecedor responde no portal                                                                                                                                                     |
| B14   | Encomenda do cliente                              | vendas:R, cliente:C, comprador:I, planner:I                    |                                                                                                                                                               | Encomenda registrada (produtos, quantidades e prazo desejado) | partial          | Varredura de 15/11: parcial. A solicitação do cliente e o carrinho existem, mas seguem um fluxo próprio, sem passar pela estratégia de compra nem pela cotação.                                               |
| B10?  | Estratégia de compra                              | comprador:R, dircompras:A, fin:C                               | Qual a estratégia de compra? Sim: Fornecedor da última compra: segue direto para o pedido de compra. Não: Cotar entre fornecedores: abre a cotação de compra. |                                                               | todo             | Varredura de 15/11: falta. Não existe a escolha entre fornecedor da última compra e cotar entre fornecedores                                                                                                  |
| B13   | Cotação de Compra                                 | forn:R, comprador:R, dircompras:A                              |                                                                                                                                                               | Preço e condição de envio dos produtos solicitados            | todo             | Varredura de 15/11: falta. A cotação (RFQ) foi removida em 11/11. Não há cotação automática por linha com prazo de 24 h; o mais próximo é o convite de book concorrente, manual e por item                    |

<details><summary>Descrição de cada passo</summary>

- **B11 Book por GP**: O GP desenvolve um produto novo, que não pode existir em nenhum dos fornecedores conhecidos
- **B5 Existe alternativa?**: Convite de book concorrente para até 30 fornecedores e tradings, com prazo de 1 dia. Caso tenham, no próximo passo eles sobem um book concorrente
- **B2 Book por Wellmix, Trading, ou fornecedor**: Trading e fornecedor lançam o próprio book no portal ou o pessoal da Well mix depois de uma viagem à China
- **B1 Recepção dos books da Wellmix**: Fornecedores mandam vários books (planilhas). A Wellmix importa .xlsx, .xls ou link do Google Sheets; o portal casa o fornecedor pelo nome, telefone ou nº da loja e guarda todas as colunas.
- **B12 Enriquecimento de informações do Book**: Preenchimento de informações sobre o item do book de NCM e Preço/kg
- **B3 Estudo de viabilidade (Superplan)**: Ao fechar o book, o Superplan calcula para cada item o custo por peça posto no depósito, o preço mínimo e o preço para bater a meta do tipo de negócio, com II e IPI pelo NCM.
- **B4 Seleção de itens (+ produto filho)**: Compara itens parecidos de vários books, destaca o menor custo por peça e define o escolhido. Variações (produto filho) ficam ligadas ao produto.
- **B6 Imagem de referência (IA) + Programação de envios**: Na escolha do grupo, 1 prompt gera com IA, a imagem do produto final, a de detalhes e embalagem e a ficha em inglês e chinês, anexadas à solicitação ao fornecedor. Faz também a programação de envio
- **B7 Solicitação ao fornecedor**: Uma solicitação por um conjunto de itens escolhidos. O fornecedor responde as condições e a Wellmix decide.
- **B8 Amostragem**: O fornecedor desenvolve a amostra (impressão 3D) e sobe fotos e vídeos na plataforma, em rodadas, com prazo de 1 dia.
- **B9 Aprovação da amostra**: O time da Wellmix avalia a amostra enviada e decide se o produto é viável. Produto e pedido só liberam com a aprovação.
- **B10 Reposição**: Produto ativo que precisa repor: o planner abre a reposição à mão, a partir do pós-venda ou por decisão própria. A sugestão automática pelo estoque fica desligada enquanto o estoque não é controlado no portal.
- **B7? Fornecedor aceita?**: O fornecedor (ou a trading) decide se aceita a solicitação nas condições pedidas.
- **B14 Encomenda do cliente**: O cliente quer comprar: pela vitrine, por um novo pedido na tela dele, ou por um novo pedido lançado pelo vendedor ou por um operador da Wellmix. A encomenda segue o mesmo caminho da reposição. Na vitrine, vira encomenda só o que o estoque livre ou uma compra a caminho não atende; o resto segue para a ordem de venda.
- **B10? Estratégia de compra**: Na reposição ou na encomenda do cliente, o comprador escolhe entre repetir o fornecedor da última compra ou cotar entre fornecedores.
- **B13 Cotação de Compra**: O sistema abre cotação de preço com os Fornecedores que atendem as Linhas dos produtos que foram solicitados, que tem 24 horas para responder a cotação. O comprador escolhe a cotação vencedora e a diretoria de compras aprova. Sem resposta em 24 h, o comprador reabre, convida outros fornecedores ou volta ao fornecedor da última compra.

</details>

## Pedido

**Objetivo:** Formalizar a compra: produto, arte, certificação, contrato e sinal  
**Critério de saída:** Documento do pedido com as duas assinaturas e pagamento inicial resolvido.

| Passo | Nome                              | Quem (RACI)                                                   | Decisão                                                                                                                                           | Saída                                                            | Situação no mapa | Nota                                                                                                                                   |
| ----- | --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P1    | É produto cadastrado?             | cadastro:R, gp:A, comprador:C, planner:I                      | Produto já cadastrado? Sim: Confere certificação e NCM. Não: Cadastra o produto novo.                                                             |                                                                  | done             | Varredura de 15/11: atende. Cadastro e fiscal                                                                                          |
| P8    | Certificação ainda válida?        | cadastro:R, gp:A, ocp:C, comprador:I                          | Certificado válido pelo período do pedido? Sim: Segue para o NCM. Não: Renova a certificação.                                                     |                                                                  | partial          | Varredura de 15/11: parcial. Aviso de certificação a vencer; validade pelo período do pedido não é conferida                           |
| P9    | NCM correto?                      | cadastro:R, gp:A, comex:C, fin:I                              | NCM correto? Sim: Segue para o contrato. Não: Atualiza o NCM do produto.                                                                          |                                                                  | done             | Varredura de 15/11: atende. NCM validado                                                                                               |
| P16   | Atualiza o NCM do produto         | cadastro:R, gp:A, comex:C                                     |                                                                                                                                                   | NCM corrigido no produto                                         | done             |                                                                                                                                        |
| P14   | Cadastro do produto novo          | cadastro:R, gp:A, comprador:C, planner:I                      |                                                                                                                                                   | Produto com ficha mestre completa                                | done             | Varredura de 15/11: atende. Ficha mestre; aprovação do GP no fim do marco                                                              |
| P2    | Pedido de compra (avisa Vendas)   | comprador:R, dircompras:A, planner:C, fin:C, vendas:I, forn:I |                                                                                                                                                   | Pedido de compra por fornecedor registrado no Sankhya (TOP 1101) | done             | Varredura de 15/11: atende. Pedido de compra; Vendas avisada                                                                           |
| P3    | Programação de compra             | planner:R, dircompras:A, comprador:C, forn:C, fin:I           |                                                                                                                                                   | Pedidos filhos programados                                       | done             | Varredura de 15/11: atende. Programação de compra (pai e filhos)                                                                       |
| P6    | Linha exige certificação?         | gp:A, cadastro:R, ocp:C                                       | Linha exige certificação? Sim: Certificação com o OCP em paralelo ao die cut e à arte. Não: Segue só com die cut e arte.                          |                                                                  | done             | Varredura de 15/11: atende. Pela linha do produto                                                                                      |
| P4    | Die cut + foto em alta            | forn:R, comprador:A, agencia:I                                |                                                                                                                                                   | Faca e foto em alta                                              | done             | Varredura de 15/11: atende. Quadro Die Cut                                                                                             |
| P15   | Certificação com o OCP e selo     | ocp:R, agencia:R, gp:A, cadastro:C, comex:I                   |                                                                                                                                                   | Certificado e selo aplicado                                      | done             | Varredura de 15/11: atende. Memorial, laboratório, registro, selo                                                                      |
| P5    | Criar arte                        | agencia:R, mkt:A, gp:C, forn:C, comprador:I                   |                                                                                                                                                   | Arte para aprovação                                              | done             | Varredura de 15/11: atende. Raia da agência                                                                                            |
| P5?   | Arte aprovada?                    | mkt:A, forn:R, gp:C, agencia:I                                | Arte aprovada pela Wellmix e pelo fornecedor? Sim: Segue para a verificação do selo. Não: Volta à agência com o motivo.                           |                                                                  | partial          | Varredura de 15/11: diverge. Quem valida a arte é o analista/comprador (ação Validar a arte), não o Marketing; o fornecedor não aprova |
| P7?   | Precisa aplicar o selo?           |                                                               | A arte precisa receber o selo de certificação? Sim: Arte final com o selo (aguarda o certificado). Não: Arte aprovada vai direto para o contrato. |                                                                  | done             | Varredura de 15/11: atende. Automático                                                                                                 |
| P7    | Arte final                        | agencia:R, mkt:A, forn:I, ocp:I                               |                                                                                                                                                   | Arte final para a gráfica                                        | done             | Varredura de 15/11: atende. Arte final com o selo                                                                                      |
| P10   | Contrato (documento do pedido)    | comprador:R, dircompras:A, forn:C, fin:I                      |                                                                                                                                                   | Documento do pedido                                              | done             | Varredura de 15/11: atende. Documento do pedido                                                                                        |
| P17   | Contratos secundários de amostras | comprador:R, dircompras:A, trading:I, mkt:I                   |                                                                                                                                                   | Pedidos de amostras registrados                                  | done             | Varredura de 15/11: atende. Pedido de amostras (5 × 3 × variantes)                                                                     |
| P11   | Assinatura                        | comprador:R, dircompras:A, forn:R, dono:I                     |                                                                                                                                                   | Pedido assinado pelas duas partes                                | done             | Varredura de 15/11: atende. Duas assinaturas no portal (sem provedor de assinatura eletrônica)                                         |
| P12?  | Condição de pagamento             | fin:R, dircompras:A                                           | Tem CC com o fornecedor? Sim: Segue direto para a produção. Não: Paga o sinal e segue.                                                            |                                                                  | done             | Varredura de 15/11: atende. Conta corrente do fornecedor                                                                               |
| P12   | Paga sinal ao fornecedor          | fin:R, dircompras:A, comprador:C, forn:I, dono:I              |                                                                                                                                                   | Sinal pago e parcelas programadas                                | done             | Varredura de 15/11: atende. Contas a pagar; ver função Financeiro sem a tela                                                           |

<details><summary>Descrição de cada passo</summary>

- **P1 É produto cadastrado?**: Verifica se o produto aprovado já existe no cadastro.
- **P8 Certificação ainda válida?**: Para produto que já existe: a certificação precisa valer pelo horizonte do pedido (no quadro, cerca de 4 meses).
- **P9 NCM correto?**: Classificação fiscal sugerida e validada por uma pessoa; só a validada vai para o produto e para o retrato do pedido.
- **P16 Atualiza o NCM do produto**: Corrige a classificação fiscal no cadastro antes do contrato.
- **P14 Cadastro do produto novo**: Produto novo ganha cadastro e ficha mestre (medidas, pesos, caixa, CBM, Pantone e 5 fotos obrigatórias) e é enviado ao Sankhya.
- **P2 Pedido de compra (avisa Vendas)**: Um pedido por fornecedor, com preço, moeda, MOQ e prazo negociados. Vendas fica sabendo do que vem.
- **P3 Programação de compra**: Produtos com rodadas viram pedido pai; cada rodada nasce como pedido filho na data combinada (ex.: 1 pedido de 4×3 pct ou 4 pedidos de 3 pct).
- **P6 Linha exige certificação?**: Logo depois do cadastro do produto, define se a linha exige certificação. Se exigir, a certificação com o OCP corre em paralelo ao die cut e à criação da arte.
- **P4 Die cut + foto em alta**: Raia do fornecedor: faca da embalagem, foto em alta resolução, MOQ e prazo de produção confirmados.
- **P15 Certificação com o OCP e selo**: Certificação com o OCP em passos validados: memorial, ensaio, registro e selo. A agência aplica o selo na arte e a Wellmix confere a aplicação. Corre em paralelo ao die cut e à criação da arte.
- **P5 Criar arte**: A agência cria a arte a partir do briefing aberto já na cotação (com prompt pronto para IA); a Wellmix valida e o fornecedor aprova o que vai produzir.
- **P5? Arte aprovada?**: A Wellmix valida a arte da agência e o fornecedor aprova o que vai produzir.
- **P7? Precisa aplicar o selo?**: Verificação automática do sistema: usa a resposta de "Linha exige certificação?" para decidir se a arte passa pela arte final.
- **P7 Arte final**: A agência aplica o selo de certificação na arte aprovada e gera o arquivo final para a gráfica. Só acontece quando a linha exige certificação e depende do certificado emitido.
- **P10 Contrato (documento do pedido)**: Itens, preço, incoterm, prazo, pagamento e embalagem aprovada num documento. O quadro traz regras de mix (ex.: 12+3, N assortments × 5).
- **P17 Contratos secundários de amostras**: Junto com o contrato, os pedidos das amostras que vão para o show room no Brasil e para a agência de marketing na China.
- **P11 Assinatura**: A Wellmix assina; o fornecedor baixa o PDF, assina e anexa de volta (ou aceita no portal).
- **P12? Condição de pagamento**: Verifica se o fornecedor trabalha com conta corrente ou exige sinal.
- **P12 Paga sinal ao fornecedor**: Condição de pagamento de cada fornecedor (até 6 parcelas por marco); contas a pagar com câmbio do banco e comprovante.

</details>

## Produção

**Objetivo:** Produzir, aprovar, reservar o navio, carregar, documentar e embarcar o container  
**Critério de saída:** Container embarcado com documentos conferidos e evidências de carga e lacre.

| Passo | Nome                                  | Quem (RACI)                                          | Decisão                                                                                                                   | Saída                                                | Situação no mapa | Nota                                                                                                                                 |
| ----- | ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1    | Produção                              | forn:R, planner:A, analista:C, comprador:I, vendas:I |                                                                                                                           | Plano de produção e ETD                              | done             | Varredura de 15/11: atende. Cartão Produção, ETD com histórico                                                                       |
| R3    | Fotos e vídeos para inspeção          | forn:R, analista:A, gp:C                             |                                                                                                                           | Fotos e vídeos do produto produzido                  | done             | Varredura de 15/11: atende. Fotos, peso e vídeo em 7 dias                                                                            |
| R4?   | Conformidade do produto               | trading:A, forn:R, analista:C, gp:I                  | Produto conforme o pedido? Sim: Booking, retirada das amostras e envios em paralelo. Não: Verifica o número da tentativa. |                                                      | partial          | Varredura de 15/11: diverge. O fornecedor declara a conformidade e a Wellmix aprova por SKU; no mapa quem decide é a trading         |
| R10   | Número da tentativa                   |                                                      | É a 3ª tentativa ou menos? Sim: ETD +1 dia e volta à produção. Não: Volta à seleção de um novo fornecedor.                |                                                      | done             | Varredura de 15/11: atende. Até 3 tentativas (configurável)                                                                          |
| R11   | ETD +1 dia                            |                                                      |                                                                                                                           | ETD atualizado                                       | done             | Varredura de 15/11: atende. ETD +1 dia automático                                                                                    |
| R8    | Booking automático com a marítima     | maritima:C, analista:I, agente:I                     |                                                                                                                           | Container solicitado no porto                        | partial          | Varredura de 15/11: parcial. Passo Booking é lançado à mão pelo agente/marítima; não há envio automático à marítima em D + prazo + A |
| R12   | Retirada das amostras                 | trading:R, analista:A, forn:C                        |                                                                                                                           | Amostras retiradas                                   | done             |                                                                                                                                      |
| R13   | Envio das amostras ao Brasil          | trading:R, analista:A, vendas:I, mkt:I               |                                                                                                                           | Amostras a caminho do show room                      | done             |                                                                                                                                      |
| R14   | Envio à agência de marketing na China | trading:R, mkt:A, agmkt:I                            |                                                                                                                           | Amostras com a agência                               | done             |                                                                                                                                      |
| R15   | Nova arte: fotos e vídeos             | agmkt:R, mkt:A, trading:C                            |                                                                                                                           | Fotos e vídeos do produto real                       | done             | Varredura de 15/11: atende. Fotos reais pela agência na China                                                                        |
| R5    | Ativa venda                           | mkt:R, vendas:A, gp:C, cliente:I                     |                                                                                                                           | Produto à venda                                      | done             | Varredura de 15/11: atende. Venda ativada                                                                                            |
| R16   | Troca a foto do catálogo              | mkt:R, gp:A, vendas:I                                |                                                                                                                           | Catálogo com fotos reais                             | done             | Varredura de 15/11: atende. Marketing aprova e troca as fotos                                                                        |
| R17?  | Incoterm da compra                    |                                                      | A compra é EXW? Sim: Trading solicita a transportadora. Não: FOB: container direto no depósito da fábrica.                |                                                      | done             | Varredura de 15/11: atende. Incoterm do pedido, automático                                                                           |
| R17   | Solicita transportadora               | trading:R, analista:A, maritima:I                    |                                                                                                                           | Transportadora contratada                            | done             |                                                                                                                                      |
| R18   | Registra custos (POP)                 | trading:R, analista:A, fin:I                         |                                                                                                                           | Custos de origem registrados                         | done             | Varredura de 15/11: atende. Custos de origem entram no custo do pedido                                                               |
| R19   | Container no depósito da fábrica      | forn:R, analista:A, trading:I                        |                                                                                                                           | Container na fábrica                                 | done             |                                                                                                                                      |
| R20   | Fotos e vídeos do container           | forn:R, analista:A, trading:I                        |                                                                                                                           | Evidências do container vazio                        | done             |                                                                                                                                      |
| R7    | Carregamento do container             | forn:R, analista:A, agente:C, comex:I                |                                                                                                                           | Container carregado, check de carga e fotos e vídeos | done             | Varredura de 15/11: atende. Check list de carga por caixas                                                                           |
| R21   | Packing list                          | forn:R, analista:A, trading:I, comex:I               |                                                                                                                           | Packing list                                         | done             | Geração do packing list pronta; preenchimento pelo fornecedor no portal a construir.                                                 |
| R22   | Invoice                               | trading:R, analista:A, comex:C                       |                                                                                                                           | Invoice                                              | done             |                                                                                                                                      |
| R22?  | Packing list × invoice                |                                                      | Packing list e invoice batem? Sim: Segue para o BL. Não: Trading refaz o invoice.                                         |                                                      | done             | Varredura de 15/11: atende. Conferência linha a linha, automática                                                                    |
| R23   | BL                                    | maritima:R, analista:A, agente:C, comex:I            |                                                                                                                           | BL                                                   | done             | Varredura de 15/11: atende. Marítima faz o BL                                                                                        |
| R23?  | BL × invoice                          |                                                      | BL e invoice batem? Sim: Ativa a fatura e libera o embarque. Não: Marítima refaz o BL.                                    |                                                      | done             | Varredura de 15/11: atende. Automática                                                                                               |
| R24   | Ativa a fatura em N dias              | analista:R, fin:A, dono:I                            |                                                                                                                           | Fatura ativa para pagamento em N dias                | done             | Varredura de 15/11: atende. Fatura ativa em N dias por fornecedor                                                                    |
| R25   | Lacre e número do container           | forn:R, analista:A, trading:I                        |                                                                                                                           | Fotos do lacre e nº do container                     | done             |                                                                                                                                      |
| R26   | Container volta ao porto              | trading:R, analista:A, maritima:I                    |                                                                                                                           | Container no porto                                   | done             |                                                                                                                                      |
| R27   | Embarque                              | maritima:R, analista:A, planner:I, vendas:I          |                                                                                                                           | Embarque confirmado e previsão de chegada            | done             | Varredura de 15/11: atende. Só com container no porto e BL conferido                                                                 |

<details><summary>Descrição de cada passo</summary>

- **R1 Produção**: Início da produção com ETD definido; mudanças de ETD ficam registradas com o motivo.
- **R3 Fotos e vídeos para inspeção**: Até 7 dias depois do início da produção (SLA), o fornecedor envia fotos e vídeos do produto produzido para inspeção.
- **R4? Conformidade do produto**: O fornecedor (trading) avalia se o produto produzido está conforme o que foi pedido.
- **R10 Número da tentativa**: Verificação automática: conta as tentativas de aprovação deste produto.
- **R11 ETD +1 dia**: O sistema soma 1 dia ao ETD e devolve o produto à produção para novas fotos, vídeos e inspeção.
- **R8 Booking automático com a marítima**: O sistema envia o agendamento à companhia marítima pedindo o container no porto vinculado ao pedido, no dia D (início da produção) + prazo + A (atrasos na confirmação).
- **R12 Retirada das amostras**: O fornecedor (trading) retira as amostras dos pedidos secundários.
- **R13 Envio das amostras ao Brasil**: Envio das amostras para o show room no Brasil.
- **R14 Envio à agência de marketing na China**: Envio das amostras para a agência de marketing na China.
- **R15 Nova arte: fotos e vídeos**: A agência de marketing na China produz as fotos e vídeos do produto real.
- **R5 Ativa venda**: Com a nova arte, o produto é liberado para venda na vitrine e na oferta ativa.
- **R16 Troca a foto do catálogo**: As fotos e vídeos da agência substituem as imagens de referência no catálogo.
- **R17? Incoterm da compra**: Verificação automática do sistema pelo incoterm do pedido.
- **R17 Solicita transportadora**: Na compra EXW, o fornecedor (trading) contrata a transportadora que leva o container até a fábrica.
- **R18 Registra custos (POP)**: O fornecedor (trading) registra todos os custos do transporte na origem (POP).
- **R19 Container no depósito da fábrica**: O container vazio chega ao depósito da fábrica para o carregamento. Aqui começa o tracking do container via API.
- **R20 Fotos e vídeos do container**: Já no depósito, o fornecedor envia fotos e vídeos do container antes de carregar.
- **R7 Carregamento do container**: O fornecedor carrega o container, registra fotos e vídeos do carregamento e preenche o check de carga.
- **R21 Packing list**: Finalizada a carga, o fornecedor faz o packing list; a trading acessa pelo portal.
- **R22 Invoice**: Com o packing list, a trading faz o invoice.
- **R22? Packing list × invoice**: Verificação automática do sistema entre packing list e invoice.
- **R23 BL**: A companhia marítima faz o BL (draft e original).
- **R23? BL × invoice**: Verificação automática do sistema entre BL e invoice.
- **R24 Ativa a fatura em N dias**: Com os documentos conferidos, começa a contar o prazo de faturamento; o evento "pedido faturado" escreve no Sankhya.
- **R25 Lacre e número do container**: No fechamento do container, o fornecedor manda fotos do lacre e o número do container lacrado.
- **R26 Container volta ao porto**: O fornecedor (trading) leva o container lacrado até o porto.
- **R27 Embarque**: A companhia marítima embarca o container, depois do container no porto e do BL validado.

</details>

## Entrega

**Objetivo:** Acompanhar a viagem, desembaraçar e receber  
**Critério de saída:** Carga entregue, conferida e armazenada, ou divergência registrada.

| Passo | Nome                                        | Quem (RACI)                                          | Decisão                                                                                                              | Saída                                                                   | Situação no mapa | Nota                                                                                                                                                      |
| ----- | ------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E5    | LPCO                                        | comex:R, analista:A, cadastro:C, fin:I               |                                                                                                                      | LPCO lançada                                                            | done             | Varredura de 15/11: atende. LPCO por prefixo de NCM                                                                                                       |
| E5?   | LPCO deferida?                              | comex:R, analista:A                                  | LPCO deferida? Sim: Segue para presença de carga. Não: Ajusta e reapresenta.                                         |                                                                         | done             |                                                                                                                                                           |
| E6    | Presença de carga e canal                   | comex:R, analista:A, fin:I, dono:I                   |                                                                                                                      | Canal de parametrização definido                                        | done             |                                                                                                                                                           |
| E7    | Presença de carga: Despacho e liberação     | comex:R, fin:A, analista:C                           |                                                                                                                      | Carga liberada (DI/DUIMP, DANFE)                                        | done             |                                                                                                                                                           |
| E7?   | Canal de parametrização                     |                                                      | Canal verde? Sim: Segue para a escolha da transportadora pelo porto. Não: Canal cinza ou vermelho: alerta e encerra. |                                                                         | done             |                                                                                                                                                           |
| E11   | Alerta de canal cinza ou vermelho           | dono:I, comex:I, analista:I                          |                                                                                                                      | Dono avisado                                                            | partial          | Varredura de 15/11: diverge. O pedido pausa até o administrador retomar; no mapa o processo encerra com o dono avisado                                    |
| E12?  | Porto de chegada                            |                                                      | O porto é Itapoá? Sim: Contrata a West Log. Não: Contrata a Edual.                                                   |                                                                         | done             | Varredura de 15/11: atende. Pelo porto de chegada                                                                                                         |
| E13   | Contratar transportadora West Log           | analista:R, planner:A, transp:C                      |                                                                                                                      | West Log contratada                                                     | done             | Varredura de 15/11: atende. West Log (Itapoá)                                                                                                             |
| E14   | Contratar transportadora Edual              | analista:R, planner:A, transp:C                      |                                                                                                                      | Edual contratada                                                        | done             | Varredura de 15/11: atende. Edual (demais)                                                                                                                |
| E15   | Programar entrega                           | planner:R, analista:A, transp:C, vendas:I, cliente:I |                                                                                                                      | Entrega programada                                                      | done             | Varredura de 15/11: atende. Marco 15 e agenda de entregas                                                                                                 |
| E16   | Emissão de NF                               | fin:R, analista:A, comex:C                           |                                                                                                                      | NF emitida                                                              | done             | Varredura de 15/11: atende. DANFE pelo financeiro                                                                                                         |
| E17?  | Comprador                                   |                                                      | O comprador foi a Wellmix? Sim: Entrega no CD da Wellmix. Não: Entrega no CD do comprador.                           |                                                                         | done             | Varredura de 15/11: atende. Pelo CODEMP do comprador                                                                                                      |
| E9    | Entrega no CD da Wellmix                    | transp:R, planner:A, analista:C, qualidade:I         |                                                                                                                      | Carga no CD da Wellmix                                                  | done             |                                                                                                                                                           |
| E18   | Entrega no CD do comprador                  | transp:R, vendas:A, analista:C, cliente:I            |                                                                                                                      | Carga entregue ao comprador                                             | done             |                                                                                                                                                           |
| E10   | Pós-venda e recompra                        | vendas:R, gp:A, cliente:C, planner:I                 |                                                                                                                      | Pós-venda e recompra                                                    | partial          | Varredura de 15/11: parcial. Pós-venda existe, mas a tela está fora do menu                                                                               |
| E19   | Qualidade                                   | qualidade:R, planner:A, analista:C                   |                                                                                                                      | Produto conferido                                                       | done             | Varredura de 15/11: atende. Contagem por SKU, por unidade ou caixas                                                                                       |
| E20   | RIC da transportadora                       | transp:R, analista:A, qualidade:I                    |                                                                                                                      | RIC emitido                                                             | partial          | Varredura de 15/11: diverge. Quem registra o RIC é a Wellmix; a transportadora não tem essa tarefa                                                        |
| E19?  | Divergência no produto                      | qualidade:R, planner:A, analista:C                   | Divergência no produto? Sim: Lote (trilha a completar). Não: Armazenamento e oferta de amostra.                      |                                                                         | done             | Varredura de 15/11: atende. Divergência nasce da contagem                                                                                                 |
| E21   | Lote                                        | qualidade:R, planner:A                               |                                                                                                                      |                                                                         | partial          | Varredura de 15/11: parcial. Não existe a entidade Lote; a divergência abre direto os quatro passos                                                       |
| E22   | Armazenamento                               | qualidade:R, planner:A                               |                                                                                                                      | Produto em estoque                                                      | partial          | Varredura de 15/11: parcial. A contagem fecha o recebimento; a entrada no estoque depende de regra de processo ou do Sankhya, sem endereço de armazenagem |
| E23   | Oferta de amostra                           | vendas:R, gp:A, mkt:C                                |                                                                                                                      | Amostra ofertada                                                        | done             | Varredura de 15/11: atende. Vendas → Amostras                                                                                                             |
| E24   | Comunica ao time de Compras                 | dircompras:I, comprador:I                            |                                                                                                                      | Compras avisada da divergência                                          | partial          | Varredura de 15/11: diverge. Feito pela Qualidade e validado pelo Planner; no mapa o sistema avisa Compras                                                |
| E25   | Fornecedor é comunicado sobre a divergência | dircompras:R, trading:A                              |                                                                                                                      | Divergência aberta e resposta do fornecedor (aceita, contesta ou repõe) | partial          | Varredura de 15/11: diverge. Comprador faz e o fornecedor responde; no mapa Diretoria de compras faz e a Trading aprova                                   |
| E26   | Evidências da divergência                   | dircompras:R, trading:A                              |                                                                                                                      | Fotos e vídeos da divergência no sistema                                | partial          | Varredura de 15/11: diverge. Qualidade faz e o Analista valida; no mapa Compras com a Logística, aprovado pela Trading                                    |
| E27   | Mitigação financeira                        | fin:R, trading:A, agente:R                           |                                                                                                                      | Acordo de Divergência                                                   | partial          | Varredura de 15/11: diverge. Financeiro faz e a Diretoria de compras valida; no mapa Financeiro e Agente de carga, aprovado pela Trading                  |

<details><summary>Descrição de cada passo</summary>

- **E5 LPCO**: O despachante lança a LPCO (no quadro, 15 dias) e acompanha o deferimento. A viagem do container é acompanhada a partir do embarque.
- **E5? LPCO deferida?**: Acompanha o deferimento da LPCO.
- **E6 Presença de carga e canal**: Presença de carga, verificação do container pela Receita e canal (verde, amarelo, vermelho ou cinza) com alerta para vermelho e cinza.
- **E7 Presença de carga: Despacho e liberação**: Numerário, DI/DUIMP, CE Mercante, comprovante de importação e DANFE, com validação do financeiro.
- **E7? Canal de parametrização**: O canal sai no despacho; o sistema lê o canal e segue o fluxo.
- **E11 Alerta de canal cinza ou vermelho**: O sistema soa o alerta e avisa o dono da Wellmix; o processo é encerrado aqui.
- **E12? Porto de chegada**: Verificação automática do porto de chegada do pedido.
- **E13 Contratar transportadora West Log**: Para cargas que chegam por Itapoá, o responsável interno da Wellmix contrata a West Log.
- **E14 Contratar transportadora Edual**: Para os demais portos, o responsável interno da Wellmix contrata a Edual.
- **E15 Programar entrega**: Data, destino e janela da entrega combinados com a transportadora.
- **E16 Emissão de NF**: Emissão da nota fiscal da mercadoria nacionalizada para o transporte.
- **E17? Comprador**: Verificação automática de quem é o comprador do pedido.
- **E9 Entrega no CD da Wellmix**: A transportadora entrega a carga no CD da Wellmix.
- **E18 Entrega no CD do comprador**: A transportadora entrega a carga no CD do comprador (trading, rede ou distribuidor).
- **E10 Pós-venda e recompra**: Pós-venda aberto na entrega; histórico e oportunidade geram reposição ou nova proposta, que volta para o Book.
- **E19 Qualidade**: A qualidade confere o produto recebido no CD contra o pedido.
- **E20 RIC da transportadora**: A transportadora emite o RIC (registro de inspeção do container) na entrega. Com o RIC, o tracking do container via API se encerra.
- **E19? Divergência no produto**: A qualidade decide se há divergência entre o produto recebido e o pedido.
- **E21 Lote**: Tratamento do lote com divergência: Compras é avisada, abre a divergência com o fornecedor, junta evidências e o financeiro negocia a mitigação.
- **E22 Armazenamento**: Sem divergência, o produto é armazenado no CD.
- **E23 Oferta de amostra**: Com o produto em estoque, a amostra é oferecida para a venda.
- **E24 Comunica ao time de Compras**: O time de compras é comunicado pelo sistema para tomar providências sobre a divergência dos produtos que chegaram
- **E25 Fornecedor é comunicado sobre a divergência**: O time de Compras abre Divergência junto ao Fornecedor. Este aceita, contesta ou repõe, com texto
- **E26 Evidências da divergência**: O time de Compras, juntamente com o time Logístico geram evidências para tornar visível, com fotos e videos no sistema, a divergência ao Fornecedor
- **E27 Mitigação financeira**: Financeiro negocia tratativa com o Fornecedor para mitigar perdas.

</details>

## Venda

**Objetivo:** Em paralelo: vender o que está chegando, com oferta ativa e vitrine, até a ordem de venda e o agendamento  
**Critério de saída:** Produto vendido e entrega agendada antes da chegada.

| Passo | Nome                         | Quem (RACI)                              | Decisão                                                                 | Saída                              | Situação no mapa | Nota                                                                                               |
| ----- | ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| V1    | Vendas avisada               | comprador:R, vendas:A, planner:I, gp:I   |                                                                         | Comercial sabe o que vem e quando  | done             | Varredura de 15/11: atende. Aviso no pedido de compra gerado                                       |
| V2    | Oferta ativa aos clientes    | vendas:R, dono:A, mkt:C, cliente:I       |                                                                         | Oferta enviada com fotos e vídeos  | done             | Varredura de 15/11: atende. Vendas → Ofertas                                                       |
| V3    | Decisão do cliente           | cliente:A, vendas:R                      | Cliente fecha a compra? Sim: Reserva os produtos. Não: Ajusta a oferta. |                                    | done             | Varredura de 15/11: atende. Decisão registrada por Vendas                                          |
| V4    | Reserva interna dos produtos | vendas:R, planner:A, analista:C          |                                                                         | Produtos reservados para o cliente | done             | Varredura de 15/11: atende. Reserva de 30 dias e reserva na chegada                                |
| V5    | Oferta na vitrine            | mkt:R, vendas:A, gp:C                    |                                                                         | Oferta publicada na vitrine        | partial          | Varredura de 15/11: parcial. Vitrine existe e recebe as fotos reais, mas está fora do menu interno |
| V6    | Cliente pede pela vitrine    | cliente:R, vendas:A                      |                                                                         | Pedido do cliente na vitrine       | done             | Varredura de 15/11: atende. Vitrine e carrinho do cliente                                          |
| V7    | Ordem de venda               | vendas:R, dono:A, fin:C, cliente:I       |                                                                         | Ordem de venda registrada          | done             | Varredura de 15/11: atende. Ordem de venda com reserva e Sankhya                                   |
| V8    | Agendamento da entrega       | vendas:R, planner:A, transp:C, cliente:C |                                                                         | Entrega agendada com o cliente     | done             | Varredura de 15/11: atende. Agenda de entregas                                                     |

<details><summary>Descrição de cada passo</summary>

- **V1 Vendas avisada**: O comercial recebe do pedido de compra os produtos, as quantidades e a previsão de chegada.
- **V2 Oferta ativa aos clientes**: Oferta para distribuidores, redes de lojas, lojas e e-commerce, com envio de fotos e vídeos do produto.
- **V3 Decisão do cliente**: O cliente avalia a oferta e decide se compra.
- **V4 Reserva interna dos produtos**: Tratativa interna para reservar as quantidades para o cliente, na chegada ou no estoque.
- **V5 Oferta na vitrine**: Construção da oferta na vitrine para a busca ativa dos clientes, com fotos, vídeos, preço e previsão de chegada.
- **V6 Cliente pede pela vitrine**: O cliente encontra o produto na vitrine e faz o pedido.
- **V7 Ordem de venda**: Aquisição da ordem de venda, com condições comerciais e de pagamento.
- **V8 Agendamento da entrega**: Agenda com o cliente a entrega dos produtos reservados, de acordo com a previsão de chegada.

</details>

## Inícios e fins

- I1 (início): Book do GP (produto novo)
- I2 (início): Book da Wellmix, trading ou fornecedor
- X2 (fim): Recompra volta à Cotação
- X3 (fim): Encerrado: canal cinza ou vermelho
- I3 (início): Encomenda: vitrine, cliente, vendedor ou operador

## Ligações (de → para)

- I1 Book do GP (produto novo) → B11 Book por GP
- I2 Book da Wellmix, trading ou fornecedor → B2 Book por Wellmix, Trading, ou fornecedor
- B11 Book por GP → B5 Existe alternativa?
- B5 Existe alternativa? → B2 Book por Wellmix, Trading, ou fornecedor (s)
- B5 Existe alternativa? → B1 Recepção dos books da Wellmix (n)
- B2 Book por Wellmix, Trading, ou fornecedor → B1 Recepção dos books da Wellmix
- B1 Recepção dos books da Wellmix → B12 Enriquecimento de informações do Book
- B12 Enriquecimento de informações do Book → B3 Estudo de viabilidade (Superplan)
- B3 Estudo de viabilidade (Superplan) → B4 Seleção de itens (+ produto filho)
- B4 Seleção de itens (+ produto filho) → B6 Imagem de referência (IA) + Programação de envios
- B6 Imagem de referência (IA) + Programação de envios → B7 Solicitação ao fornecedor
- B7 Solicitação ao fornecedor → B7? Fornecedor aceita?
- B7? Fornecedor aceita? → B8 Amostragem (s)
- B8 Amostragem → B9 Aprovação da amostra
- B9 Aprovação da amostra → P1 É produto cadastrado? (s)
- B9 Aprovação da amostra → B8 Amostragem (n nova rodada)
- B10 Reposição → B10? Estratégia de compra
- B10? Estratégia de compra → P2 Pedido de compra (avisa Vendas) (s fornecedor da última compra)
- B10? Estratégia de compra → B13 Cotação de Compra (n cotar entre fornecedores)
- P1 É produto cadastrado? → P8 Certificação ainda válida? (s)
- P1 É produto cadastrado? → P14 Cadastro do produto novo (n)
- P4 Die cut + foto em alta → P5 Criar arte
- P5 Criar arte → P5? Arte aprovada?
- P5? Arte aprovada? → P5 Criar arte (n volta à agência)
- P15 Certificação com o OCP e selo → P7 Arte final
- P8 Certificação ainda válida? → P9 NCM correto? (s)
- P8 Certificação ainda válida? → P15 Certificação com o OCP e selo (n renovar)
- P9 NCM correto? → P10 Contrato (documento do pedido) (s)
- P9 NCM correto? → P16 Atualiza o NCM do produto (n)
- P16 Atualiza o NCM do produto → P10 Contrato (documento do pedido)
- P2 Pedido de compra (avisa Vendas) → P3 Programação de compra
- P3 Programação de compra → P10 Contrato (documento do pedido)
- P10 Contrato (documento do pedido) → P11 Assinatura
- P11 Assinatura → P12? Condição de pagamento
- P12? Condição de pagamento → R1 Produção (s)
- P12? Condição de pagamento → P12 Paga sinal ao fornecedor (n)
- P12 Paga sinal ao fornecedor → R1 Produção
- E5 LPCO → E5? LPCO deferida?
- E5? LPCO deferida? → E6 Presença de carga e canal (s)
- E5? LPCO deferida? → E5 LPCO (n reapresenta)
- E6 Presença de carga e canal → E7 Presença de carga: Despacho e liberação
- E10 Pós-venda e recompra → X2 Recompra volta à Cotação
- E10 Pós-venda e recompra → B10 Reposição
- B7? Fornecedor aceita? → B7 Solicitação ao fornecedor (n)
- P1 É produto cadastrado? → P2 Pedido de compra (avisa Vendas) (s)
- P14 Cadastro do produto novo → P2 Pedido de compra (avisa Vendas)
- P2 Pedido de compra (avisa Vendas) → V1 Vendas avisada (avisa Vendas)
- V1 Vendas avisada → V2 Oferta ativa aos clientes
- V1 Vendas avisada → V5 Oferta na vitrine
- V2 Oferta ativa aos clientes → V3 Decisão do cliente
- V3 Decisão do cliente → V4 Reserva interna dos produtos (s)
- V3 Decisão do cliente → V2 Oferta ativa aos clientes (n ajusta a oferta)
- V4 Reserva interna dos produtos → V7 Ordem de venda
- V5 Oferta na vitrine → V6 Cliente pede pela vitrine
- V6 Cliente pede pela vitrine → V7 Ordem de venda
- V7 Ordem de venda → V8 Agendamento da entrega
- P14 Cadastro do produto novo → P6 Linha exige certificação?
- P6 Linha exige certificação? → P4 Die cut + foto em alta (s)
- P6 Linha exige certificação? → P15 Certificação com o OCP e selo (s em paralelo)
- P5? Arte aprovada? → P7? Precisa aplicar o selo? (s)
- P7? Precisa aplicar o selo? → P7 Arte final (s)
- P7? Precisa aplicar o selo? → P10 Contrato (documento do pedido) (n sem selo)
- P7 Arte final → P10 Contrato (documento do pedido)
- R1 Produção → R3 Fotos e vídeos para inspeção
- R3 Fotos e vídeos para inspeção → R4? Conformidade do produto
- R4? Conformidade do produto → R8 Booking automático com a marítima (s)
- R4? Conformidade do produto → R12 Retirada das amostras (s)
- R4? Conformidade do produto → R10 Número da tentativa (n)
- R10 Número da tentativa → R11 ETD +1 dia (s)
- R10 Número da tentativa → B4 Seleção de itens (+ produto filho) (n novo fornecedor)
- R11 ETD +1 dia → R1 Produção (volta à produção)
- R12 Retirada das amostras → R13 Envio das amostras ao Brasil
- R12 Retirada das amostras → R14 Envio à agência de marketing na China
- R14 Envio à agência de marketing na China → R15 Nova arte: fotos e vídeos
- R15 Nova arte: fotos e vídeos → R5 Ativa venda
- R15 Nova arte: fotos e vídeos → R16 Troca a foto do catálogo
- P10 Contrato (documento do pedido) → P17 Contratos secundários de amostras
- P17 Contratos secundários de amostras → P11 Assinatura
- R8 Booking automático com a marítima → R17? Incoterm da compra
- R17? Incoterm da compra → R17 Solicita transportadora (s)
- R17? Incoterm da compra → R19 Container no depósito da fábrica (n FOB)
- R17 Solicita transportadora → R18 Registra custos (POP)
- R18 Registra custos (POP) → R19 Container no depósito da fábrica
- R19 Container no depósito da fábrica → R20 Fotos e vídeos do container
- R20 Fotos e vídeos do container → R7 Carregamento do container
- R7 Carregamento do container → R21 Packing list
- R7 Carregamento do container → R25 Lacre e número do container (em paralelo)
- R21 Packing list → R22 Invoice
- R22 Invoice → R22? Packing list × invoice
- R22? Packing list × invoice → R23 BL (s)
- R22? Packing list × invoice → R22 Invoice (n refaz o invoice)
- R23 BL → R23? BL × invoice
- R23? BL × invoice → R27 Embarque (s)
- R23? BL × invoice → R24 Ativa a fatura em N dias (s)
- R23? BL × invoice → R23 BL (n refaz o BL)
- R25 Lacre e número do container → R26 Container volta ao porto
- R26 Container volta ao porto → R27 Embarque
- R27 Embarque → E5 LPCO
- E7 Presença de carga: Despacho e liberação → E7? Canal de parametrização
- E7? Canal de parametrização → E12? Porto de chegada (s)
- E7? Canal de parametrização → E11 Alerta de canal cinza ou vermelho (n)
- E11 Alerta de canal cinza ou vermelho → X3 Encerrado: canal cinza ou vermelho
- E12? Porto de chegada → E13 Contratar transportadora West Log (s)
- E12? Porto de chegada → E14 Contratar transportadora Edual (n)
- E13 Contratar transportadora West Log → E15 Programar entrega
- E14 Contratar transportadora Edual → E15 Programar entrega
- E15 Programar entrega → E16 Emissão de NF
- E16 Emissão de NF → E17? Comprador
- E17? Comprador → E9 Entrega no CD da Wellmix (s)
- E17? Comprador → E18 Entrega no CD do comprador (n)
- E18 Entrega no CD do comprador → E10 Pós-venda e recompra
- E9 Entrega no CD da Wellmix → E19 Qualidade
- E9 Entrega no CD da Wellmix → E20 RIC da transportadora (em paralelo)
- E19 Qualidade → E19? Divergência no produto
- E19? Divergência no produto → E21 Lote (s)
- E19? Divergência no produto → E22 Armazenamento (n)
- E22 Armazenamento → E23 Oferta de amostra
- V8 Agendamento da entrega → E15 Programar entrega (entrega agendada)
- E21 Lote → E24 Comunica ao time de Compras
- E24 Comunica ao time de Compras → E25 Fornecedor é comunicado sobre a divergência
- E25 Fornecedor é comunicado sobre a divergência → E26 Evidências da divergência
- E26 Evidências da divergência → E27 Mitigação financeira
- B13 Cotação de Compra → B7 Solicitação ao fornecedor
- I3 Encomenda: vitrine, cliente, vendedor ou operador → B14 Encomenda do cliente
- B14 Encomenda do cliente → B10? Estratégia de compra
- V6 Cliente pede pela vitrine → B14 Encomenda do cliente (encomenda)
