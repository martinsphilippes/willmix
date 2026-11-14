# Mapa do processo (fonte: attilasm/wellmix-presentation, data.json)

Copiado em 14/11/2026 do repositório da apresentação (aba Mapa) para guiar o motor por marcos (docs/FLOW_MENU.md, plano em 5 fases). Os 4 últimos passos da Entrega, "A definir" no mapa, foram nomeados pelo dono em 14/11/2026: Compras, Fornecedor, Evidência e Financeiro. RACI: R faz, A aprova, C é consultado, I é informado.

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

| Passo | Nome                                              | Quem (RACI)                                                    | Decisão                                                                                                                 | Situação no mapa |
| ----- | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| B11   | Book por GP                                       | gp:R, comprador:A                                              |                                                                                                                         | todo             |
| B5    | Existe alternativa?                               | comprador:R, forn:R, trading:R, gp:C                           | Existe alternativa? Sim: Volta à seleção com a alternativa. Não: Abre cotação com outros fornecedores.                  | done             |
| B2    | Book por Wellmix, Trading, ou fornecedor          | trading:R, dircompras:I, forn:R, dono:R                        |                                                                                                                         | done             |
| B1    | Recepção dos books da Wellmix                     | forn:R, comprador:R, dircompras:A, cadastro:C, gp:C, planner:I |                                                                                                                         | done             |
| B12   | Enriquecimento de informações do Book             | comex:R, comprador:A                                           |                                                                                                                         | done             |
| B3    | Estudo de viabilidade (Superplan)                 | comprador:R, dircompras:A, fin:C, planner:C, dono:I            |                                                                                                                         | done             |
| B4    | Seleção de itens (+ produto filho)                | comprador:R, dircompras:A, planner:C, vendas:C, mkt:I          |                                                                                                                         | done             |
| B6    | Imagem de referência (IA) + Programação de envios | mkt:R, comprador:R, forn:I, dircompras:A                       |                                                                                                                         | done             |
| B7    | Solicitação ao fornecedor                         | comprador:R, dircompras:A, gp:C, forn:I, trading:I, planner:I  |                                                                                                                         | done             |
| B8    | Amostragem                                        | forn:R, comprador:A, gp:I, mkt:I                               |                                                                                                                         | done             |
| B9    | Aprovação da amostra                              | gp:R, dircompras:A, comprador:C, fin:C, forn:I                 | Amostra aprovada e produto viável? Sim: Cria ou associa o produto e libera a encomenda. Não: Nova rodada de amostragem. | partial          |
| B10   | Reposição                                         | planner:R, dircompras:A, comprador:C                           |                                                                                                                         | todo             |
| B7?   | Fornecedor aceita?                                | forn:A, trading:R, comprador:I                                 | Fornecedor aceita a solicitação? Sim: Segue para a amostragem. Não: Volta à seleção.                                    | done             |
| B10?  | Condições continuam boas?                         | comprador:R, dircompras:A, fin:C                               | Condições do último pedido continuam boas? Sim: Encomenda direta. Não: Proposta automática ao fornecedor.               | todo             |

## Pedido

**Objetivo:** Formalizar a compra: produto, arte, certificação, contrato e sinal  
**Critério de saída:** Documento do pedido com as duas assinaturas e pagamento inicial resolvido.

| Passo | Nome                              | Quem (RACI)                                                   | Decisão                                                                                                                                           | Situação no mapa |
| ----- | --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P1    | É produto cadastrado?             | cadastro:R, gp:A, comprador:C, planner:I                      | Produto já cadastrado? Sim: Confere certificação e NCM. Não: Cadastra o produto novo.                                                             | done             |
| P8    | Certificação ainda válida?        | cadastro:R, gp:A, ocp:C, comprador:I                          | Certificado válido pelo período do pedido? Sim: Segue para o NCM. Não: Renova a certificação.                                                     | partial          |
| P9    | NCM correto?                      | cadastro:R, gp:A, comex:C, fin:I                              | NCM correto? Sim: Segue para o contrato. Não: Atualiza o NCM do produto.                                                                          | done             |
| P16   | Atualiza o NCM do produto         | cadastro:R, gp:A, comex:C                                     |                                                                                                                                                   | done             |
| P14   | Cadastro do produto novo          | cadastro:R, gp:A, comprador:C, planner:I                      |                                                                                                                                                   | done             |
| P2    | Pedido de compra (avisa Vendas)   | comprador:R, dircompras:A, planner:C, fin:C, vendas:I, forn:I |                                                                                                                                                   | done             |
| P3    | Programação de compra             | planner:R, dircompras:A, comprador:C, forn:C, fin:I           |                                                                                                                                                   | done             |
| P6    | Linha exige certificação?         | gp:A, cadastro:R, ocp:C                                       | Linha exige certificação? Sim: Certificação com o OCP em paralelo ao die cut e à arte. Não: Segue só com die cut e arte.                          | done             |
| P4    | Die cut + foto em alta            | forn:R, comprador:A, agencia:I                                |                                                                                                                                                   | done             |
| P15   | Certificação com o OCP e selo     | ocp:R, agencia:R, gp:A, cadastro:C, comex:I                   |                                                                                                                                                   | done             |
| P5    | Criar arte                        | agencia:R, mkt:A, gp:C, forn:C, comprador:I                   |                                                                                                                                                   | done             |
| P5?   | Arte aprovada?                    | mkt:A, forn:R, gp:C, agencia:I                                | Arte aprovada pela Wellmix e pelo fornecedor? Sim: Segue para a verificação do selo. Não: Volta à agência com o motivo.                           | done             |
| P7?   | Precisa aplicar o selo?           |                                                               | A arte precisa receber o selo de certificação? Sim: Arte final com o selo (aguarda o certificado). Não: Arte aprovada vai direto para o contrato. | done             |
| P7    | Arte final                        | agencia:R, mkt:A, forn:I, ocp:I                               |                                                                                                                                                   | done             |
| P10   | Contrato (documento do pedido)    | comprador:R, dircompras:A, forn:C, fin:I                      |                                                                                                                                                   | partial          |
| P17   | Contratos secundários de amostras | comprador:R, dircompras:A, trading:I, mkt:I                   |                                                                                                                                                   | todo             |
| P11   | Assinatura                        | comprador:R, dircompras:A, forn:R, dono:I                     |                                                                                                                                                   | done             |
| P12?  | Condição de pagamento             | fin:R, dircompras:A                                           | Tem CC com o fornecedor? Sim: Segue direto para a produção. Não: Paga o sinal e segue.                                                            | done             |
| P12   | Paga sinal ao fornecedor          | fin:R, dircompras:A, comprador:C, forn:I, dono:I              |                                                                                                                                                   | done             |

## Produção

**Objetivo:** Produzir, aprovar, reservar o navio, carregar, documentar e embarcar o container  
**Critério de saída:** Container embarcado com documentos conferidos e evidências de carga e lacre.

| Passo | Nome                                  | Quem (RACI)                                          | Decisão                                                                                                                   | Situação no mapa |
| ----- | ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| R1    | Produção                              | forn:R, planner:A, analista:C, comprador:I, vendas:I |                                                                                                                           | done             |
| R3    | Fotos e vídeos para inspeção          | forn:R, analista:A, gp:C                             |                                                                                                                           | partial          |
| R4?   | Conformidade do produto               | trading:A, forn:R, analista:C, gp:I                  | Produto conforme o pedido? Sim: Booking, retirada das amostras e envios em paralelo. Não: Verifica o número da tentativa. | done             |
| R10   | Número da tentativa                   |                                                      | É a 3ª tentativa ou menos? Sim: ETD +1 dia e volta à produção. Não: Volta à seleção de um novo fornecedor.                | todo             |
| R11   | ETD +1 dia                            |                                                      |                                                                                                                           | todo             |
| R8    | Booking automático com a marítima     | maritima:C, analista:I, agente:I                     |                                                                                                                           | partial          |
| R12   | Retirada das amostras                 | trading:R, analista:A, forn:C                        |                                                                                                                           | todo             |
| R13   | Envio das amostras ao Brasil          | trading:R, analista:A, vendas:I, mkt:I               |                                                                                                                           | todo             |
| R14   | Envio à agência de marketing na China | trading:R, mkt:A, agmkt:I                            |                                                                                                                           | todo             |
| R15   | Nova arte: fotos e vídeos             | agmkt:R, mkt:A, trading:C                            |                                                                                                                           | todo             |
| R5    | Ativa venda                           | mkt:R, vendas:A, gp:C, cliente:I                     |                                                                                                                           | partial          |
| R16   | Troca a foto do catálogo              | mkt:R, gp:A, vendas:I                                |                                                                                                                           | todo             |
| R17?  | Incoterm da compra                    |                                                      | A compra é EXW? Sim: Trading solicita a transportadora. Não: FOB: container direto no depósito da fábrica.                | todo             |
| R17   | Solicita transportadora               | trading:R, analista:A, maritima:I                    |                                                                                                                           | todo             |
| R18   | Registra custos (POP)                 | trading:R, analista:A, fin:I                         |                                                                                                                           | todo             |
| R19   | Container no depósito da fábrica      | forn:R, analista:A, trading:I                        |                                                                                                                           | todo             |
| R20   | Fotos e vídeos do container           | forn:R, analista:A, trading:I                        |                                                                                                                           | todo             |
| R7    | Carregamento do container             | forn:R, analista:A, agente:C, comex:I                |                                                                                                                           | partial          |
| R21   | Packing list                          | forn:R, analista:A, trading:I, comex:I               |                                                                                                                           | partial          |
| R22   | Invoice                               | trading:R, analista:A, comex:C                       |                                                                                                                           | done             |
| R22?  | Packing list × invoice                |                                                      | Packing list e invoice batem? Sim: Segue para o BL. Não: Trading refaz o invoice.                                         | todo             |
| R23   | BL                                    | maritima:R, analista:A, agente:C, comex:I            |                                                                                                                           | done             |
| R23?  | BL × invoice                          |                                                      | BL e invoice batem? Sim: Ativa a fatura e libera o embarque. Não: Marítima refaz o BL.                                    | todo             |
| R24   | Ativa a fatura em N dias              | analista:R, fin:A, dono:I                            |                                                                                                                           | partial          |
| R25   | Lacre e número do container           | forn:R, analista:A, trading:I                        |                                                                                                                           | todo             |
| R26   | Container volta ao porto              | trading:R, analista:A, maritima:I                    |                                                                                                                           | todo             |
| R27   | Embarque                              | maritima:R, analista:A, planner:I, vendas:I          |                                                                                                                           | partial          |

## Entrega

**Objetivo:** Acompanhar a viagem, desembaraçar e receber  
**Critério de saída:** Carga entregue, conferida e armazenada, ou divergência registrada.

| Passo | Nome                                    | Quem (RACI)                                          | Decisão                                                                                                              | Situação no mapa |
| ----- | --------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| E5    | LPCO                                    | comex:R, analista:A, cadastro:C, fin:I               |                                                                                                                      | todo             |
| E5?   | LPCO deferida?                          | comex:R, analista:A                                  | LPCO deferida? Sim: Segue para presença de carga. Não: Ajusta e reapresenta.                                         | todo             |
| E6    | Presença de carga e canal               | comex:R, analista:A, fin:I, dono:I                   |                                                                                                                      | done             |
| E7    | Presença de carga: Despacho e liberação | comex:R, fin:A, analista:C                           |                                                                                                                      | done             |
| E7?   | Canal de parametrização                 |                                                      | Canal verde? Sim: Segue para a escolha da transportadora pelo porto. Não: Canal cinza ou vermelho: alerta e encerra. | todo             |
| E11   | Alerta de canal cinza ou vermelho       | dono:I, comex:I, analista:I                          |                                                                                                                      | todo             |
| E12?  | Porto de chegada                        |                                                      | O porto é Itapoá? Sim: Contrata a West Log. Não: Contrata a Edual.                                                   | todo             |
| E13   | Contratar transportadora West Log       | analista:R, planner:A, transp:C                      |                                                                                                                      | todo             |
| E14   | Contratar transportadora Edual          | analista:R, planner:A, transp:C                      |                                                                                                                      | todo             |
| E15   | Programar entrega                       | planner:R, analista:A, transp:C, vendas:I, cliente:I |                                                                                                                      | done             |
| E16   | Emissão de NF                           | fin:R, analista:A, comex:C                           |                                                                                                                      | todo             |
| E17?  | Comprador                               |                                                      | O comprador foi a Wellmix? Sim: Entrega no CD da Wellmix. Não: Entrega no CD do comprador.                           | todo             |
| E9    | Entrega no CD da Wellmix                | transp:R, planner:A, analista:C, qualidade:I         |                                                                                                                      | done             |
| E18   | Entrega no CD do comprador              | transp:R, vendas:A, analista:C, cliente:I            |                                                                                                                      | todo             |
| E10   | Pós-venda e recompra                    | vendas:R, gp:A, cliente:C, planner:I                 |                                                                                                                      | done             |
| E19   | Qualidade                               | qualidade:R, planner:A, analista:C                   |                                                                                                                      | todo             |
| E20   | RIC da transportadora                   | transp:R, analista:A, qualidade:I                    |                                                                                                                      | todo             |
| E19?  | Divergência no produto                  | qualidade:R, planner:A, analista:C                   | Divergência no produto? Sim: Lote (trilha a completar). Não: Armazenamento e oferta de amostra.                      | todo             |
| E21   | Lote                                    | qualidade:R, planner:A                               |                                                                                                                      | todo             |
| E22   | Armazenamento                           | qualidade:R, planner:A                               |                                                                                                                      | todo             |
| E23   | Oferta de amostra                       | vendas:R, gp:A, mkt:C                                |                                                                                                                      | todo             |
| E24   | Compras                                 |                                                      |                                                                                                                      | todo             |
| E25   | Fornecedor                              |                                                      |                                                                                                                      | todo             |
| E26   | Evidência                               |                                                      |                                                                                                                      | todo             |
| E27   | Financeiro                              |                                                      |                                                                                                                      | todo             |

## Venda

**Objetivo:** Em paralelo: vender o que está chegando, com oferta ativa e vitrine, até a ordem de venda e o agendamento  
**Critério de saída:** Produto vendido e entrega agendada antes da chegada.

| Passo | Nome                         | Quem (RACI)                              | Decisão                                                                 | Situação no mapa |
| ----- | ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| V1    | Vendas avisada               | comprador:R, vendas:A, planner:I, gp:I   |                                                                         | partial          |
| V2    | Oferta ativa aos clientes    | vendas:R, dono:A, mkt:C, cliente:I       |                                                                         | todo             |
| V3    | Decisão do cliente           | cliente:A, vendas:R                      | Cliente fecha a compra? Sim: Reserva os produtos. Não: Ajusta a oferta. | todo             |
| V4    | Reserva interna dos produtos | vendas:R, planner:A, analista:C          |                                                                         | partial          |
| V5    | Oferta na vitrine            | mkt:R, vendas:A, gp:C                    |                                                                         | partial          |
| V6    | Cliente pede pela vitrine    | cliente:R, vendas:A                      |                                                                         | partial          |
| V7    | Ordem de venda               | vendas:R, dono:A, fin:C, cliente:I       |                                                                         | todo             |
| V8    | Agendamento da entrega       | vendas:R, planner:A, transp:C, cliente:C |                                                                         | todo             |

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
- B10 Reposição → B10? Condições continuam boas?
- B10? Condições continuam boas? → P2 Pedido de compra (avisa Vendas) (s)
- B10? Condições continuam boas? → B7 Solicitação ao fornecedor (n proposta automática)
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
- E10 Pós-venda e recompra → X2 Recompra volta ao Book
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
- E21 Lote → E24 Compras
- E24 Compras → E25 Fornecedor
- E25 Fornecedor → E26 Evidência
- E26 Evidência → E27 Financeiro
