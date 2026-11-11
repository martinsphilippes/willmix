# Achados de interface nos roteiros

Enquanto redigiam os roteiros, os oito redatores abriram cada tela no build de produção, com as contas de demonstração, e conferiram os botões contra o sistema. O que eles viram de estranho está aqui, para o dono decidir o que corrigir **antes de gravar** (o vídeo mostra a tela como ela é) e o que fica como está.

**Como ler.** Cada item vem de quem testou na tela e de uma leitura do código; **não foi reproduzido uma segunda vez** por quem consolidou a lista, então trate como "a confirmar". O episódio entre parênteses é onde o achado apareceu (e onde há um ⚠ no roteiro). Nada disto foi corrigido: este PR só traz documentação.

Conferência automática: dos 311 botões citados nos roteiros com `[BOTÃO]`, 309 existem nos textos do sistema; os outros dois são rótulos que mudam com o dado ("Confirmar US$ 1,25") ou levam seta ("Ver no pedido →").

## 1. Regra de negócio, dado e acesso (prioridade alta)

| # | O que foi visto | Onde |
| - | --------------- | ---- |
| 1 | **Criar o produto a partir do booking troca as medidas da peça pelas da caixa** e o CBM sai 0,0035 em vez de 0,069. O erro chega à ficha da cotação (CBM travado), ao pedido do cliente e ao Superplan (21.192 em vez de 11.820 peças por container). A origem provável é `sheetFromRequest`. | WBK-04, WSO-05 |
| 2 | **"Limpar dados de teste"** fica disponível a qualquer administrador **em produção** e apaga também a Auditoria das vendas. | WGE-11 |
| 3 | O **operador vê FOB e valor de venda** no "Resumo do pedido", contra a regra de docs/ACCESS.md (financeiro só do administrador). | WGE-01 |
| 4 | **Agência, despachante, comex, agente de carga, companhia marítima e transportador** veem a tabela "Documentos" do pedido com fotos, arte, faca, arquivos da gráfica e BL (ver o que cada papel deveria ver em docs/ACCESS.md). | AGE, DES, MAR, TRA |
| 5 | **Auditoria** marcada em "Personalizado" dá 404 para quem não é administrador nem diretoria (docs/ACCESS.md diz que vale). | WGE-10, WGE-11 |
| 6 | **Painel do dono e Fluxo de caixa** aparecem no menu só com a tela Financeiro, mas as páginas exigem também "Painéis por área". | WGE-05 |
| 7 | O quadro **"Certificação pendente"** da Control Tower nunca esvazia para pedido com OCP, porque laudo e registro não aparecem mais na tela. | OCP-02, WGE-01 |
| 8 | Na fila de revisão, **"Resolver" e "Dispensar" não liberam a inspeção bloqueada**; "Liberar etapa" libera, mas deixa a aprovação pendente. | WPE-04 |
| 9 | O **numerário** rejeita "18.500,00" com `invalid_input`. | WPE-05 |
| 10 | A **conformidade** pode ser confirmada sem certificação registrada, e o aviso na fila de revisão continua aberto. | WPE-01 |
| 11 | **Importar o tarifário** atualiza o frete por m³ nas Configurações sozinho, mesmo vindo do operador. | WLO-01 |
| 12 | Em **Containers**, o operador vê "Valor vendido" e a compra para estoque conta como "Vendido". | WLO-02 |
| 13 | **Reprovar a arte sem observação** é aceito pelo servidor (o fornecedor pode reprovar sem dizer por quê). | FOR-06 |
| 14 | **Cliente, fornecedor ou parceiro novo nasce Inativo**: o formulário de criação não tem "Situação" e a ação grava `active=false`. | WCA-01 |
| 15 | O quadro de acesso de um cadastro de parceiro oferece o papel Admin/Operador (papel da Wellmix dentro do cadastro de fora). | WCA-02 |
| 16 | **"Liberação aduaneira"** pode ser confirmada antes dos outros itens da etapa. | DES-01 |
| 17 | **Multas**: não há como voltar a "Em aberto"; o quadrado "Multa aberta" conta as Contestadas; mudar o status não avisa ninguém. | JUR-01, WGE-08 |
| 18 | Os **totais do Financeiro** usam a moeda do primeiro pedido; a data "pago em" usa UTC e o vencimento usa Brasília; o Pix só tem o campo da chave. | WGE-03, WGE-04 |
| 19 | O selo do **Superplan** sai "Abaixo da meta" (lucro 18,5 %) em todos os itens; docs/BOOKING.md prevê "No preço mínimo". A carga de demonstração vem com margem 0 %. | WBK-02, WSO-05 |

## 2. Fluxo e avisos (prioridade média)

| # | O que foi visto | Onde |
| - | --------------- | ---- |
| 20 | A **solicitação ao fornecedor** não vira pendência dele, só aviso no sino; o aviso "Sua vez" continua não lido depois da resposta. Do mesmo jeito, "Proposta pronta" e "Entrega precisa de você" não saem depois da ação. | FOR-02, CLI-03 |
| 21 | A **resposta do fornecedor** não aparece nas Pendências da Wellmix e não há link para a ficha da cotação. | WSO-01, WSO-02 |
| 22 | Com a RFQ em espera, o aviso do sino diz "Abra a RFQ…", a pendência repete "Enviar ao fornecedor" com tipo "Abrir RFQ" e o menu fica "RFQ (em espera)" mesmo com ela ativa. | WSO-01, WSO-04 |
| 23 | "Aguardando sua decisão (Planner)" chega a quem enviou a escolha; a Control Tower ainda mostra a faixa BOOKING da fila antiga. | WBK-03, WGE-01 |
| 24 | O aviso de **acesso negado** manda cliente e parceiros para "Gestão → Equipe e divisões", que só existe para a Wellmix. | GER-01 |
| 25 | O **login** ainda lista 12 passos com a RFQ antiga, não tem seletor de idioma e o cookie de idioma vence a preferência do usuário. | GER-01 |
| 26 | O **progresso** do mesmo pedido é 0 % no cartão de Orçamentos e 35 % na lista de Pedidos; sem pedido mínimo, o cartão da vitrine vem com "Adicionar 1 un"; trocar de produto na solicitação não refaz a quantidade. | CLI-01, CLI-02, CLI-04 |
| 27 | **Pedido cancelado** continua "No pedido" na lista da agência. | AGE-01 |
| 28 | O cliente não tem passo para **pagar o saldo** e não há regra do sinal no cancelamento. | CLI-03, CLI-06 |
| 29 | Produto do booking sem aprovação só aparece na vitrine de prévia por **endereço direto**. | WCA-06 |
| 30 | Botões que levam a **tela sem acesso**: "Importar CSV" (comprador) e "Conta corrente" (fornecedor). A tela de produto tem **dois "Voltar"**. | WCA-04, FOR-10 |
| 31 | A **abertura animada** toca na primeira abertura do dia **em qualquer endereço** (inclusive um link direto para um pedido). Foi a regra pedida; se preferir, dá para limitar à página inicial. | GER-01 |

## 3. Textos crus, traduções e formatos (prioridade baixa)

| # | O que foi visto | Onde |
| - | --------------- | ---- |
| 32 | **Código ou nome técnico na tela**: `stage.agency.brief` e `stage.agency.art` na coluna "Tipo"; `(already_answered)`, `(invalid_name)`, `(invalid_input)` nos erros; `radarGateEnabled`, `marketingEnabled`, `compliance.missingCertification`, `docType.import_step`, `containerAllowMultiCustomer`; "ORDER_CREATED" e "Pedido #1: ORDER_CREATED" no Painel de SLA. | vários |
| 33 | **Português nas telas em en e zh**: tabela da solicitação na cotação ("COR", "PESO POR UNIDADE", "CAIXA MASTER"), "Faltam: Inmetro", pendências "Confirmar recebimento" e "Validar/Invoice assinada", coluna "Detalhe" e título "Frete: …", avisos fixos ao jurídico e à Wellmix (multa registrada, avaliação recebida). | FOR, MAR |
| 34 | O **cliente vê** "Número no Sankhya", "Faltam: Inmetro" e o aviso "tokens… Cartão de Crédito". | CLI-04, CLI-02 |
| 35 | **Formatos de data e valor**: datas em ISO ("2026-11-08") no Embarque; o tarifário mistura formatos; "USD 846.00", "BRL 8400" e "BRL 28000.00" na pendência, contra "R$ 28.000,00" no aviso; Auditoria e Notificações usam fusos diferentes. | WPE-05, MAR-02, WGE-11 |
| 36 | **Rótulos que enganam**: o passo "Booking" do embarque é a reserva no navio; o campo da previsão de entrega do Transporte aparece como "Previsão de chegada"; "Ambos" e "Cliente" em "Quem confirma a entrega" fazem o mesmo; o aviso de arte reprovada diz "Aprovação da arte pelo fornecedor reprovado, refaça". | LOG-01, TRA-01, WPE-06 |
| 37 | **Ajuda desatualizada**: `quoteSheet.intro` fala de programação de lotes e da Preparação concluída; `account.forecast.hint` diz "lista acima" (a lista está abaixo); a ajuda do Die Cut cita DXF/CDR, mas DXF não é aceito; o texto da Preparação diz que o fornecedor faz a programação. | FOR-03, FOR-04, FOR-10, WPE-02 |
| 38 | O **PDF do pedido** omite caracteres não latinos (chinês). | FOR-07 |
| 39 | O campo "Número no Sankhya" some depois de "Pedido conferido", mas o aviso da segunda assinatura manda informá-lo no pedido. | WPE-01 |
| 40 | Em **chinês**, a data de embarque tem dois termos (装运日期 e 装船日期). | MAR-01 |
| 41 | **Fornecedor novo** já sai "A (100)" na avaliação; criar produto sem linha mostra "Algum valor não dá para ler. Use números maiores que zero."; a jarra criada pelo booking nasce sem SKU e a de demonstração UTL-001 duplica. | WCA-01, WBK-04 |

## 4. Documentação que ficou para trás

- `docs/CERTIFICATION.md` diz que a OCP registra laudo e registro (saíram da tela) e se contradiz sobre a OCP ver preço e cliente.
- `docs/WORKFLOW.md` cita um checklist padrão de preparação antigo; o código traz só "Ficha de compra".
- `docs/BOOKING.md` prevê o selo "No preço mínimo" para o Superplan dos itens do booking.
- O documento do pedido diz "você assina" para a OCP, que não assina.

## 5. Ajustes já feitos no guia por causa dos redatores

- O nome da empresa do despachante é **Comex Despachos** (Diego Despachante é o nome do login).
- A planilha `produtos-china.xlsx` é da importação de cadastros, não um booking.
- O quadro de contas de demonstração do `/login` também precisa ser escondido na gravação (estilo testado no guia, seção 7.3).
- A tela de Equipe só marca funções e telas; **não cria login**. Para gravar financeiro, diretorias e designer é preciso criar um login interno antes.
- A agência **não envia a faca**: quem envia é o fornecedor escolhido (ou a Wellmix).
- A trilha do operador de Cadastro não inclui WBK-04 e WBK-05 (essa função não abre Cotações).
