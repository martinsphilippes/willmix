# Livro de perguntas · Wellmix · Logística e estoque

> Gerado por `node scripts/treinamento-livro.mjs` a partir de `docs/treinamento/modulos/WLO/`. **Não edite aqui:** edite o YAML do módulo e gere de novo. A letra marcada com ✔ é a resposta certa.

- [WLO-01 · Fretes e tarifário de frete](#wlo-01-fretes-e-tarifario-de-frete)
- [WLO-02 · Containers: CBM, mix e ocupação](#wlo-02-containers-cbm-mix-e-ocupacao)
- [WLO-03 · Estoque](#wlo-03-estoque)
- [WLO-04 · Produção: follow e ETD](#wlo-04-producao-follow-e-etd)

---

## WLO-01 · Fretes e tarifário de frete

**Duração** 4:15 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:30` · **Responder o pedido de frete** (cenas 1 a 4): Achar os pedidos de frete em Pedidos → Fretes e registrar o valor em nome da companhia marítima.
2. `1:30–2:40` · **Importar a planilha e ler a conferência** (cenas 5 a 6): Importar a planilha de cada companhia no Tarifário de frete e entender os avisos da conferência.
3. `2:40–4:15` · **Comparar por porto e usar o frete no pedido** (cenas 7 a 10): Ler o comparativo de menor custo, o frete por m³ e onde o frete aparece no pedido.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Na tela Fretes, que selo mostra que a companhia marítima ainda não respondeu o pedido de frete?

- A) Frete enviado à Wellmix
- B) Responder até
- ✔ C) Aguardando valor

> O selo 'Aguardando valor' fica no produto enquanto a companhia não responde. Sem a resposta dela, o preço usa um frete estimado por metro cúbico.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 5

Em **Importar planilha da companhia marítima**, que tipo de arquivo você escolhe?

- ✔ A) Um .xlsx ou .xlsm
- B) Um .xls antigo, salvo do Excel 95
- C) Um PDF com a tabela da companhia

> O portal lê .xlsx ou .xlsm. Se vier no formato .xls antigo, o portal pede para abrir no Excel e salvar de novo no formato novo.

**Q3** · nível 2 (aplicar) · colocar na ordem · capítulo 1, cena 4

A companhia mandou o frete por e-mail e você vai registrá-lo em nome dela. Coloque os passos na ordem.

- A) Preencher Valor do frete, Moeda, Tempo de trânsito (dias) e Válido até
- B) Clicar em **Enviar frete**
- C) Abrir Pedidos → Fretes e clicar no produto

Ordem certa: C → A → B

> Você abre o pedido de frete pelo produto, preenche valor, moeda, dias de trânsito e validade, e só então clica em **Enviar frete**. O valor entra no custo da cotação e fica na auditoria.

**Q4** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 5

Você já importou uma planilha da Marítima SA e agora importa outra, também de 'De quem é a planilha' = Marítima SA. O que acontece com a tabela anterior?

- A) Todas as planilhas de todas as companhias são apagadas
- B) A nova é somada à anterior da mesma companhia
- C) A nova só vale depois de a anterior vencer
- ✔ D) A nova substitui só a anterior daquela companhia

> Cada importação substitui apenas a planilha anterior da companhia escolhida em 'De quem é a planilha'. As planilhas das outras companhias ficam como estão.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 3, cena 7

No comparativo do Tarifário de frete, o que a célula verde da tabela Porto de origem × companhia indica?

- A) A companhia que a Wellmix já escolheu para o pedido
- ✔ B) O menor custo daquele porto de origem, em reais
- C) A tarifa mais recente importada

> Em verde fica o **Menor custo** de cada porto: o custo total de um container de 40 pés em reais, com o mesmo câmbio para todas as companhias.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

Na **Conferência da planilha** aparece: 'o total em R$ de BETA CARGO soma as taxas de ALFA LINES. O portal recalculou com as taxas da própria BETA CARGO.' O que você faz?

- A) Pede à BETA CARGO outra planilha antes de olhar o comparativo
- B) Corrige a fórmula na planilha do Excel e importa tudo de novo
- ✔ C) Segue: o portal recalculou e o comparativo usa a conta dele

> Onde há erro de conta, o portal recalcula, avisa e usa a conta dele. A conferência serve para você saber o que parecia estranho na planilha.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 1, cena 4

Você abre o pedido de frete da jarra, deixa o Valor do frete zerado e clica em **Enviar frete**. O que o portal mostra e o que você faz?

- ✔ A) 'Informe um valor de frete maior que zero.' Você digita o valor.
- B) 'Frete enviado à Wellmix.' Você segue, pois o preço usa o frete estimado.
- C) 'Este pedido de frete já foi encerrado.' Você cria outro pedido de frete.
- D) Nada: o portal guarda o frete em branco até a companhia responder.

> O valor de frete precisa ser maior que zero. Digite o valor total e envie de novo. A mensagem de 'já foi encerrado' é outra: aparece quando outro fornecedor foi escolhido ou a solicitação foi cancelada.

**Q8** · nível 3 (decidir) · várias respostas · capítulo 3, cena 9

Marque o que é verdade sobre onde o frete aparece e quem vê o quê.

- ✔ A) No cartão Embarque do pedido, a Wellmix vê o 'Frete pelo tarifário' da rota da carga
- B) A companhia marítima vê o comparativo com as tarifas das outras companhias
- ✔ C) Em 'Minha tabela de frete', a companhia só vê o botão para enviar a tabela dela
- D) A companhia vê o preço, o fornecedor e o cliente da compra
- ✔ E) No pedido de frete, a companhia vê só a carga: caixas, volume e peso

> A companhia vê só a carga e a própria tabela, nunca preço, fornecedor, cliente nem as tarifas das outras. O tarifário é só da Wellmix; no pedido, o cartão Embarque mostra o frete da rota.

---

## WLO-02 · Containers: CBM, mix e ocupação

**Duração** 4:15 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:30` · **Criar o container e adicionar os itens** (cenas 1 a 4): Criar o container em Pedidos → Containers e adicionar os itens por pedido, com caixas, CBM e peso.
2. `1:30–2:45` · **Respeitar o cliente e vigiar a ocupação** (cenas 5 a 6): Entender a regra de um cliente por container e reagir aos avisos de ocupação e peso.
3. `2:45–4:15` · **Ler o vendido e avançar a situação** (cenas 7 a 9): Separar o que é vendido do que é disponível e mudar a situação do container ao longo da viagem.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Qual botão do cartão **Novo container** grava o container novo?

- A) Salvar
- B) Adicionar ao container
- ✔ C) Criar container
- D) Mudar situação

> No cartão **Novo container** você preenche código, tipo, cliente (opcional), ETD e ETA e clica em **Criar container**. **Adicionar ao container** é do cartão de itens, já dentro do container.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 6

A partir de que ocupação o cartão **Ocupação** mostra o aviso amarelo 'Ocupação acima do máximo recomendado'?

- ✔ A) 95%
- B) 100%
- C) 80%
- D) 90%

> Acima de 95% (parâmetro 'Ocupação máxima do container (%)', do administrador) o portal avisa e abre um item em Pedidos → Revisão. Passar da capacidade ou do peso máximo também gera aviso.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

No cartão **Adicionar item · Por pedido** você escolhe o pedido e deixa a **Quantidade** vazia. De onde vêm quantidade, caixas, CBM e peso?

- A) Nenhuma: o portal exige que você digite a quantidade e as caixas
- B) Da quantidade total do cliente; CBM e peso vêm do tipo do container
- C) Do pedido mínimo do produto; as caixas você preenche à mão
- ✔ D) A do item do pedido; caixas, CBM e peso vêm da ficha do produto

> A quantidade padrão é a do item do pedido, e caixas, CBM e peso vêm da ficha do produto. Se a ficha não tiver a caixa, o portal pede 'Un/caixa', 'CBM/caixa' e 'Peso (kg)'.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 8

Coloque as situações do container na ordem da viagem, da primeira à última.

- A) Embarcado
- B) Planejamento
- C) Chegou
- D) Encerrado
- E) Em carregamento

Ordem certa: B → E → A → C → D

> A situação segue a viagem: Planejamento, Em carregamento, Embarcado, Chegou e Encerrado. Use **Mudar situação** para avançar; container encerrado não aceita mais itens.

**Q5** · nível 2 (aplicar) · várias respostas · capítulo 2, cena 6

Marque o que faz o portal avisar e abrir um item em Pedidos → Revisão para um container.

- ✔ A) Ocupação acima do máximo recomendado (95%)
- ✔ B) Peso acima do máximo do tipo de container
- C) Dois pedidos do mesmo cliente no mesmo container
- ✔ D) Ocupação acima da capacidade em m³
- E) Um container com um só pedido

> Ocupação acima de 95%, acima da capacidade ou acima do peso máximo geram aviso e item em Revisão (sem bloquear). Vários pedidos do mesmo cliente são exatamente o que o container aceita.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 5

O container já é da Loja do João. Ao adicionar o pedido da compra para estoque aparece 'Regra de consolidação: este container já é de outro cliente.' O que você faz?

- A) Apaga o primeiro pedido para o container mudar de cliente e tenta de novo
- B) Muda o tipo do container para um maior, que aceite mais clientes
- ✔ C) Usa outro container, ou pede ao administrador para liberar 'Container com vários clientes'
- D) Clica em **Adicionar ao container** de novo até o portal aceitar

> O primeiro pedido define o cliente do container, e clientes diferentes não são juntados automaticamente. Só o administrador libera uma consolidação manual, em Configurações.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

O cartão **Ocupação** mostra 96,4% e há um item novo em Pedidos → Revisão sobre o container. Como você resolve?

- A) Apaga o item da fila de Revisão
- ✔ B) Clica em **Remover** no maior item (ou troca o tipo de container)
- C) Muda a situação para Embarcado
- D) Espera: o aviso some quando o container chegar

> A ação indicada é remover itens ou trocar o tipo de container. Ao fazer isso o aviso se resolve sozinho e o cartão da fila vai para Resolvidos.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 7

Você adiciona um produto pelo cartão **Adicionar item · Estoque / produto**, sem pedido. Como ele aparece na tabela e na Visão comercial?

- A) Como 'Vendido', porque está dentro do container
- B) Como 'Reservado', até o container chegar
- C) Como 'Em trânsito', só no Estoque
- ✔ D) Como 'Disponível': estoque no container

> Item com pedido é Vendido; item sem pedido é Disponível. A Visão comercial só soma o que foi lançado, sem estimar nada.

---

## WLO-03 · Estoque

**Duração** 4:45 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:30` · **Ler o estoque e entender as colunas** (cenas 1 a 4): Abrir Cadastros → Estoque e saber de onde vêm No Brasil, Em trânsito e Em produção.
2. `1:30–3:10` · **Dar baixa, definir o limite e reservar** (cenas 5 a 7): Registrar a baixa por venda, definir o estoque mínimo de cada produto e reservar estoque para um cliente.
3. `3:10–4:45` · **Contar às cegas e conferir as perdas** (cenas 8 a 10): Participar do inventário às cegas e achar baixas, perdas e produtos parados.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Em que menu fica a tela **Estoque**?

- A) Pedidos → Containers
- ✔ B) Cadastros → Estoque
- C) Gestão → Estoque

> O Estoque fica em **Cadastros → Estoque**. É a mercadoria da Wellmix, sem pedido de cliente, produto por produto.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 3, cena 8

Quem abre o inventário, aprova a quantidade final de um item e fecha o inventário?

- A) O operador que conta
- B) O planner do pedido
- ✔ C) O administrador

> Abrir inventário, **Aprovar quantidade** e **Fechar inventário** são só do administrador. Quem conta, o operador, não vê a quantidade do sistema.

**Q3** · nível 2 (aplicar) · várias respostas · capítulo 1, cena 4

Marque o que conta na coluna **No Brasil**.

- ✔ A) Mercadoria de um container que chegou e não tem pedido de cliente
- ✔ B) Compra para estoque já entregue
- C) Carga em container embarcado, ainda no mar
- D) Mercadoria já vendida a um cliente
- E) Compra para estoque ainda na fábrica

> No Brasil é o que chegou em container sem pedido de cliente, ou compra para estoque entregue. Carga no mar é Em trânsito, e a que ainda está na fábrica é Em produção. Mercadoria vendida e pedido cancelado não contam.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 2, cena 5

Você vendeu 400 un do estoque no balcão. Coloque os passos para registrar a baixa na ordem.

- A) Escolher o produto e digitar a Quantidade
- B) Clicar em **Dar baixa**
- C) Clicar em **− Baixa por venda**
- D) Escrever a observação (NF, cliente, motivo)

Ordem certa: C → A → D → B

> Abra **− Baixa por venda**, escolha o produto e a quantidade (e o pedido do cliente, se houver), escreva a nota na observação e clique em **Dar baixa**. O portal não deixa sair mais do que há no Brasil.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 7

Na tela de Reservas, o que faz o botão **Usar (dar baixa)** numa reserva ativa?

- ✔ A) Transforma a reserva em baixa por venda
- B) Devolve a quantidade reservada ao estoque livre
- C) Prorroga a validade da reserva
- D) Cria uma compra para estoque

> **Usar (dar baixa)** vira baixa por venda. **Cancelar** é que devolve a quantidade ao livre, e a reserva vencida deixa de segurar sozinha.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

O Jogo de panelas tem 1.600 no Brasil, limite de 1.800 e nada em trânsito. O que a linha mostra e o que você faz?

- A) Selo 'Acima do limite'; não faz nada
- B) Selo 'Abaixo · a caminho'; espera a carga chegar
- C) Selo 'Parado há N dias'; faz uma oferta
- ✔ D) Selo 'Repor' e **Comprar N**; abre a compra com a quantidade que falta

> Abaixo do limite e sem nada a caminho é o selo vermelho **Repor**, com o botão **Comprar N**, que abre a compra para estoque com o produto e a quantidade que falta. 'Abaixo · a caminho' só aparece quando há carga em trânsito.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

No inventário, você conta 1.500 do Jogo de panelas e aparece 'A contagem não confere. Você tem mais 1 chance.' O que faz?

- A) Pede ao administrador para aprovar a quantidade já
- ✔ B) Conta de novo com atenção e clica em **Gravar contagem**
- C) Corrige o número em **− Baixa por venda**
- D) Fecha o inventário para o administrador resolver

> Você tem uma segunda chance: conte de novo e grave. Só se errar outra vez o administrador é avisado e usa **Aprovar quantidade**; a diferença vira perda.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 2, cena 7

Ao dar baixa por venda aparece: 'Parte deste estoque está reservada para clientes. Dê baixa pela reserva ou cancele a reserva.' O que você faz?

- A) Dá a baixa com uma quantidade menor, ignorando as reservas
- B) Abre um inventário para ajustar o estoque reservado
- ✔ C) Vai em Estoque → Reservas e usa **Usar (dar baixa)**, ou cancela a reserva
- D) Cancela o pedido do cliente que fez a reserva

> O reservado sai do livre, e a baixa comum não passa dele. Para vender o que está reservado, use **Usar (dar baixa)** na reserva; para liberar, **Cancelar** devolve ao livre.

---

## WLO-04 · Produção: follow e ETD

**Duração** 4:15 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:25` · **Abrir o cartão Produção e conferir o início** (cenas 1 a 4): Achar o cartão Produção no pedido, escolher o tipo de fornecedor e entender o início automático.
2. `1:25–2:45` · **Mudar o ETD e registrar os follows** (cenas 5 a 6): Registrar o ETD com motivo nas mudanças e fazer os follows de 5, 15 e 25 dias.
3. `2:45–4:15` · **Agendar a inspeção e acompanhar os atrasos** (cenas 7 a 9): Agendar a inspeção, usar a Inspeção por SKU e achar o que está atrasado na Control Tower.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Onde você registra o ETD e acompanha a fábrica de um pedido?

- ✔ A) No cartão **Produção** do pedido
- B) Em Pedidos → Containers, na ficha do container
- C) Em Cadastros → Fornecedores, na ficha do fornecedor
- D) Em Pendências, na lista de tarefas

> O cartão **Produção** do pedido reúne o tipo do fornecedor, o início, o ETD e a fábrica. A produção corre ao lado das etapas Preparação e Inspeção, por isso tem um cartão próprio.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 6

Com quantos dias do início da produção vencem os follows?

- A) 7, 14 e 21 dias
- B) 10, 20 e 30 dias
- ✔ C) 5, 15 e 25 dias
- D) 3, 10, 20 e 30 dias

> Os follows vencem aos 5, 15 e 25 dias do início e viram pendência da Wellmix. Em 'Fazer agora' está o que venceu e ainda não foi registrado.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

Como é definido o **Início da produção** de um pedido?

- A) Você digita a data no cartão Produção, ao salvar
- ✔ B) Sozinho: contrato assinado mais o prazo do fornecedor
- C) No dia em que o sinal do cliente é confirmado
- D) No dia em que a inspeção é agendada pela Wellmix

> Ninguém digita o início. Ele entra no dia em que o contrato fica assinado (a segunda assinatura), mais o prazo do fornecedor. O follow de 5, 15 e 25 dias conta a partir dele.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 2, cena 5

O pedido já tem um primeiro ETD salvo e o fornecedor avisou que a data mudou. Coloque os passos na ordem.

- A) Conferir o histórico em **Mudanças do ETD**
- B) Mudar a data do ETD
- C) Clicar em **Salvar produção**
- D) Escrever o 'Motivo da mudança do ETD'

Ordem certa: B → D → C → A

> Mude a data, escreva o motivo (obrigatório ao mudar) e clique em **Salvar produção**. O histórico mostra de quando, para quando, quem e por quê.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 6

Você escolhe **Atrasado** no follow de 15 dias e clica em **Registrar follow** sem escrever nada. O que acontece?

- A) Registra como Atrasado e pede a observação depois, por aviso
- B) Registra como No prazo, por padrão, e segue
- C) Alerta 'Informe o motivo da mudança do ETD.'
- ✔ D) Alerta 'Escreva a observação.'

> Atrasado exige a observação. Escreva o que aconteceu e registre de novo. O alerta do motivo é do ETD, não do follow.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 5

O pedido já tinha um ETD salvo. Você troca a data e clica em **Salvar produção**: 'Informe o motivo da mudança do ETD.' O que faz?

- ✔ A) Escreve o motivo no campo e salva de novo
- B) Apaga o ETD e salva sem data para esconder a mudança
- C) Pede ao fornecedor para mudar no lugar da Wellmix
- D) Registra um follow Atrasado para explicar a mudança

> O primeiro ETD não precisa de motivo, mas qualquer mudança depois exige. O campo 'Motivo da mudança do ETD (obrigatório ao mudar)' aparece e o histórico guarda a mudança.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 7

Ao clicar em **Agendar inspeção** de um fornecedor trade aparece: 'Informe o endereço da fábrica antes de agendar.' O que faz?

- A) Escreve o endereço em 'Observação (inspetor, horário)' e agenda de novo
- B) Agenda como está: a observação já diz onde inspecionar
- ✔ C) Preenche o endereço da fábrica no cartão Produção, salva a produção e agenda
- D) Troca 'Fornecedor é' para Fábrica sem preencher o endereço

> Em fornecedor trade a inspeção acontece na fábrica de verdade. Informe a fábrica e o endereço no cartão Produção, clique em **Salvar produção** e então agende.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

Na Control Tower, o quadrado **Acompanhamento vencido** mostra 2. O que isso quer dizer e o que você faz?

- A) São SKUs reprovados na inspeção; você inspeciona de novo
- B) O último follow foi Atrasado ou o ETD venceu; você muda o ETD
- C) São inspeções sem data; você agenda as duas
- ✔ D) Follow sem registro; você o registra no cartão Produção

> Acompanhamento vencido é follow sem registro: abra o pedido e registre No prazo ou Atrasado. Produção atrasada é outra coisa: último follow atrasado ou ETD vencido.
