# Livro de perguntas · Wellmix · Booking e produto

> Gerado por `node scripts/treinamento-livro.mjs` a partir de `docs/treinamento/modulos/WBK/`. **Não edite aqui:** edite o YAML do módulo e gere de novo. A letra marcada com ✔ é a resposta certa.

- [WBK-01 · Importar um booking (planilha do fornecedor)](#wbk-01-importar-um-booking-planilha-do-fornecedor)
- [WBK-02 · Fechar o booking e ler a análise do Superplan](#wbk-02-fechar-o-booking-e-ler-a-analise-do-superplan)
- [WBK-03 · Seleção de itens e solicitação ao fornecedor](#wbk-03-selecao-de-itens-e-solicitacao-ao-fornecedor)
- [WBK-04 · Decidir a resposta do fornecedor e criar o produto](#wbk-04-decidir-a-resposta-do-fornecedor-e-criar-o-produto)
- [WBK-05 · Ligar ao Sankhya e liberar na vitrine](#wbk-05-ligar-ao-sankhya-e-liberar-na-vitrine)

---

## WBK-01 · Importar um booking (planilha do fornecedor)

**Duração** 3:30 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Planner; Operador · Cadastro; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:05` · **Abrir a tela Importar booking** (cenas 1 a 4): Chegue à tela Importar booking pelo menu Pedidos e conheça os campos Arquivo, link e moeda.
2. `1:05–2:00` · **Conferir as colunas e importar a planilha** (cenas 5 a 6): Confira as colunas obrigatórias do cartão Colunas lidas e importe a planilha do fornecedor.
3. `2:00–3:30` · **Conferir o booking que nasceu em rascunho** (cenas 7 a 10): Confira fornecedor, data e o que falta no Booking nº 1, que nasce em Rascunho sem criar produto.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Qual é o caminho para subir a planilha de um fornecedor?

- A) **Cadastros** → **Produtos** → **Importar CSV**
- ✔ B) **Pedidos** → **Booking** → **Importar booking**
- C) **Pedidos** → **Seleção de itens** → **Importar booking**
- D) **Início** → **Pendências** → **Abrir**

> No menu, abra **Pedidos**, clique em **Booking** e depois em **Importar booking**. A importação de produtos em Cadastros é outra tela.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Nesta tela, o que é um **booking**?

- A) A reserva de espaço no navio para a carga do pedido
- B) O pedido que o cliente fez à Wellmix
- C) A solicitação que a Wellmix manda ao fornecedor
- ✔ D) A lista de produtos de uma planilha do fornecedor

> Aqui, booking é a lista de produtos da planilha do fornecedor, guardada na Wellmix. Não é a reserva no navio.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

A planilha tem preços sem a moeda escrita. Qual campo da tela decide a moeda deles?

- ✔ A) **Moeda quando a planilha não diz**, só para preços sem moeda
- B) **Arquivo**, que traz a moeda junto com a planilha
- C) **Ou o link de uma planilha do Google Sheets**, que define a moeda
- D) Nenhum: a moeda é escolhida depois, dentro do booking

> A lista **Moeda quando a planilha não diz** (padrão USD) vale só para os preços que vierem sem moeda. Quando a planilha traz a moeda, ela é respeitada.

**Q4** · nível 2 (aplicar) · várias respostas · capítulo 2, cena 5

Quais colunas são obrigatórias para fechar o booking (marcadas com asterisco em **Colunas lidas**)? Marque todas as certas.

- ✔ A) MOQ, o pedido mínimo
- ✔ B) CBM
- ✔ C) Material
- D) Cor / sortimento
- E) Foto do item

> Preço, moeda, caixa, pesos, medidas, capacidade, embalagem, material, CBM e MOQ têm asterisco. Qualquer outra coluna fica guardada só como informação.

**Q5** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 10

Coloque na ordem os passos para importar uma planilha.

- A) Escolher o arquivo e conferir a moeda
- B) Clicar em **Importar booking** para a planilha ser lida
- C) Abrir **Pedidos** → **Booking** e clicar em **Importar booking**
- D) Conferir fornecedor, data e o que falta no booking aberto

Ordem certa: C → A → B → D

> Abra a tela de importação, escolha o arquivo e a moeda, clique em **Importar booking** e só então confira o booking que nasceu em Rascunho.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 5

A importação recusa o arquivo com 'Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo.' O que você faz?

- A) Divide a planilha em duas, de até 40 itens cada uma
- B) Tira os asteriscos dos nomes das colunas e importa de novo
- ✔ C) Usa a planilha no modelo, com o cabeçalho na primeira linha
- D) Troca a moeda em **Moeda quando a planilha não diz**

> O cabeçalho tem de ser o do modelo (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…), na primeira linha da planilha. Os asteriscos e a moeda não têm relação com o erro.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 9

O Booking nº 1 acabou de nascer em **Rascunho**, com 6 itens. Um colega pergunta se os produtos já estão no cadastro. O que você responde?

- ✔ A) Não: são só linhas do booking; o produto nasce depois da seleção
- B) Sim: cada item da planilha já virou um produto no cadastro da Wellmix
- C) Sim, mas só no Sankhya, que é o ERP da Wellmix
- D) Não: só vira produto depois de o cliente fazer um pedido

> Importar não cria produto, cliente nem estoque. O booking em Rascunho fica só com a Wellmix, e o cadastro de produtos só é tocado depois da seleção.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

O booking mostra 'Falta para fechar: itens incompletos (2).' e, na coluna **Conferência**, 'Falta: CBM, MOQ' num item. O que fazer?

- A) Fechar o booking assim mesmo: o Superplan completa os dados sozinho
- B) Apagar os dois itens incompletos da planilha original
- ✔ C) Completar os campos obrigatórios vazios (borda âmbar)
- D) Escolher outra moeda em **Moeda quando a planilha não diz**

> Os campos obrigatórios vazios ficam com borda âmbar, e a coluna **Conferência** diz qual falta. Eles precisam ser preenchidos antes de fechar o booking.

---

## WBK-02 · Fechar o booking e ler a análise do Superplan

**Duração** 4:30 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Planner; Operador · Cadastro; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:35` · **Abrir o booking e conferir fornecedor e data** (cenas 1 a 5): Abra o booking em Rascunho, confira fornecedor e data e cadastre o fornecedor da planilha, se ele não existir.
2. `1:35–2:50` · **Completar os itens e fechar o booking** (cenas 6 a 7): Complete os campos obrigatórios, escolha o tipo de negócio e feche com Fechar e analisar.
3. `2:50–4:30` · **Ler a análise do Superplan e acompanhar o status** (cenas 8 a 11): Leia o selo e o preço mínimo de cada item, refaça a análise quando preciso e acompanhe o status do booking.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 3, cena 8

Na coluna **Superplan**, o que quer dizer o selo **Falta dado**?

- A) O lucro do item bate a meta do tipo de negócio
- B) O lucro do item está abaixo da meta
- ✔ C) Falta preço ou câmbio para calcular o item
- D) O item dá prejuízo no preço mínimo

> Verde é viável, amarelo é abaixo da meta, vermelho é prejuízo, e **Falta dado** aparece quando falta preço ou câmbio. Compare os itens pelo valor do **Mínimo**.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 7

Qual botão fecha o booking e pede a análise do Superplan?

- ✔ A) **Fechar e analisar**
- B) **Refazer a análise**
- C) **Mudar status**
- D) **Cadastrar e usar neste booking**

> No cartão **Fechar o booking**, o botão é **Fechar e analisar**. **Refazer a análise** só aparece depois, no cartão do Superplan.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

No rascunho, você escolhe outro **Fornecedor** na lista. Como a mudança é gravada?

- A) Só quando você fecha o booking, no fim
- ✔ B) Sozinha: a célula mostra 'Gravando…' e depois 'Gravado ✓'
- C) Ao clicar em **Salvar**, no alto da página
- D) Só o administrador consegue gravar a mudança

> No rascunho, fornecedor e data gravam sozinhos, sem botão Salvar. A origem acompanha a cidade do fornecedor. Depois de fechado, o booking deixa de ser editável.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 11

Coloque na ordem o trabalho com um booking em Rascunho.

- A) Completar os campos obrigatórios com borda âmbar
- B) Clicar em **Fechar e analisar**
- C) Conferir **Fornecedor** e **Data** em **Dados do booking**
- D) Ler o selo e o **Mínimo** de cada item
- E) Escolher o **Tipo de negócio do Superplan**

Ordem certa: C → A → E → B → D

> Confira fornecedor e data, complete os itens, escolha o tipo de negócio, feche e só então leia o selo e o preço mínimo.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 6

Você digita 'abc' em **Capacidade (ml)** e aperta Enter. O que a célula mostra?

- A) 'Gravado ✓', com o valor zero
- B) A célula apaga o 'abc' sem avisar
- C) O item sai da tabela de itens do booking
- ✔ D) O aviso 'Valor que não dá para ler. Use número maior que zero…'

> Cada campo grava sozinho ao sair dele ou no Enter, e valor ilegível é recusado ali mesmo. Digite um número maior que zero; a célula confirma com 'Gravado ✓'.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 1, cena 5

O Booking nº 3 mostra o cartão 'Fornecedor da planilha sem cadastro', com Yiwu Glassware Co., Ltd. O que você faz?

- A) Fecha o booking assim mesmo: o fornecedor é cadastrado ao fechar
- B) Escolhe qualquer fornecedor parecido na lista de Fornecedor
- ✔ C) Confere os dados e clica em **Cadastrar e usar neste booking**
- D) Importa a planilha de novo com outro nome de fornecedor

> O fornecedor entra em Cadastros, mas sem login: por isso aparece o aviso de que ele não tem acesso ao portal. Sem fornecedor, o booking não fecha.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 2, cena 7

Ao clicar em **Fechar e analisar**, aparece 'Há itens com campos obrigatórios vazios. Complete os campos marcados em cada item e feche de novo.' O que faz?

- ✔ A) Preenche os campos com borda âmbar (a coluna **Conferência** diz quais) e fecha de novo
- B) Clica em **Refazer a análise** para o sistema completar os campos
- C) Muda o **Tipo de negócio do Superplan** e fecha de novo
- D) Muda o status para **Em andamento** e continua

> O booking só fecha com todos os campos obrigatórios preenchidos. Ache os campos pela borda âmbar e pela coluna **Conferência**.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 3, cena 9

O câmbio do dia mudou depois do fechamento e você vai comparar itens de bookings diferentes. O que faz?

- A) Reabre o booking e corrige o câmbio nos itens
- ✔ B) Clica em **Refazer a análise** no cartão do Superplan
- C) Importa a planilha de novo para recalcular os preços
- D) Espera: a análise se atualiza sozinha todo dia

> Depois de fechado, os itens não mudam mais. Com câmbio ou parâmetros novos, use **Refazer a análise** (dá para trocar o tipo de negócio) e compare itens com o mesmo tipo de negócio.

---

## WBK-03 · Seleção de itens e solicitação ao fornecedor

**Duração** 5:00 · **Capítulos** 4 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Gerente de produto; Operador · Planner; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:30` · **Filtrar e achar itens parecidos** (cenas 1 a 5): Abra a Seleção de itens, busque por parte da descrição e use ver parecidos para reunir itens do mesmo tipo.
2. `1:30–2:50` · **Comparar e escolher o item** (cenas 6 a 7): Compare as colunas lado a lado, escolha um único item e marque as alternativas.
3. `2:50–4:05` · **Preencher e abrir a solicitação ao fornecedor** (cenas 8 a 9): Informe a quantidade e o que a Wellmix precisa, abra a solicitação e saiba o que o fornecedor vê.
4. `4:05–5:00` · **Tratar o fornecedor sem acesso e acompanhar a solicitação** (cenas 10 a 12): Resolva o caso do fornecedor sem login e acompanhe a solicitação na lista Solicitações ao fornecedor.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Quais itens aparecem na **Seleção de itens**?

- A) Itens de bookings em **Rascunho**, assim que são importados
- B) Só produtos que já estão no cadastro da Wellmix
- C) Itens de pedidos que os clientes já fizeram
- ✔ D) Itens de bookings fechados, em andamento ou concluídos

> A Seleção de itens mostra os itens dos bookings fechados, em andamento ou concluídos. Um booking em Rascunho ainda não aparece.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 5

O que faz o link **ver parecidos**, abaixo de um item?

- A) Abre a página do booking onde o item está e mostra a planilha
- ✔ B) Busca pelas duas primeiras palavras da descrição
- C) Marca o item como alternativa da escolha atual
- D) Abre direto a solicitação ao fornecedor desse item

> O link preenche a busca com as duas primeiras palavras da descrição (por exemplo, 'jarra vidro') e mostra os itens do mesmo tipo, para comparar.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 7

Qual a diferença entre a coluna **Escolher** e a coluna **Alternativa**?

- ✔ A) **Escolher** aceita um item só, que vai ao fornecedor; **Alternativa** aceita vários, só para a Wellmix
- B) As duas colunas aceitam um só item, mas **Alternativa** é a que vai ao fornecedor da escolha
- C) **Alternativa** é a que vai ao fornecedor; **Escolher** guarda os parecidos só para a Wellmix, como lista
- D) **Escolher** aceita vários itens, e **Alternativa** aceita um só, que vira a solicitação ao fornecedor

> Marque um só item em **Escolher**: a solicitação vai ao fornecedor dele. Marque em **Alternativa** os parecidos que quer guardar (até 30); eles ficam só com a Wellmix.

**Q4** · nível 2 (aplicar) · várias respostas · capítulo 3, cena 9

O fornecedor abre a solicitação que você criou. O que ele vê? Marque todas as certas.

- ✔ A) O item e a quantidade pedida
- ✔ B) O texto de 'O que a Wellmix precisa no produto'
- ✔ C) O preço que ele mesmo pôs na planilha (**Preço do booking**)
- D) As alternativas de outros fornecedores
- E) O Superplan do item

> O fornecedor vê só o item, a quantidade, o preço do booking e o seu texto. As alternativas, o Superplan e os outros fornecedores ficam só com a Wellmix.

**Q5** · nível 2 (aplicar) · colocar na ordem · capítulo 4, cena 12

Coloque na ordem os passos para abrir uma solicitação ao fornecedor.

- A) Escrever a **Quantidade (peças)** e **O que a Wellmix precisa no produto**
- B) Filtrar por parte da descrição e comparar os itens
- C) Clicar em **Abrir solicitação**
- D) Marcar o item em **Escolher** e os parecidos em **Alternativa**

Ordem certa: B → D → A → C

> Filtre e compare, marque o escolhido e as alternativas, preencha quantidade e o que a Wellmix precisa e só então clique em **Abrir solicitação**.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

A tela avisa 'A planilha não traz quantidade para este item: digite a quantidade.' O que você faz?

- A) Marca outro item como **Alternativa** para a tela aceitar o pedido
- B) Deixa em branco e espera o fornecedor definir a quantidade
- ✔ C) Preenche **Quantidade (peças)** e abre a solicitação de novo
- D) Fecha o booking de novo para a planilha trazer a quantidade

> Em branco, vale a quantidade da planilha. Se a planilha não traz quantidade para o item, digite a quantidade (um número maior que zero) em **Quantidade (peças)**.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 2, cena 7

Na coluna **Situação** de uma jarra aparece o link 'Solicitação nº 2' e o botão de escolha está desligado. O que isso diz?

- A) O fornecedor recusou a jarra e ela não pode mais ser pedida
- ✔ B) O item já tem uma solicitação em andamento: abra a que existe
- C) O booking dessa jarra ainda está em Rascunho, sem fornecedor
- D) A jarra foi marcada como alternativa de outro item da busca

> Item com solicitação Aberta ou Respondida não abre outra: use o link da coluna. Depois que a Wellmix decide (aprova, recusa ou cancela), o item pode ter outra solicitação.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 4, cena 10

Você abriu a solicitação do copo do Yiwu e o aviso diz 'Fornecedor sem acesso ao portal: ele não vê nem responde esta solicitação.' O que faz?

- A) Espera: o fornecedor passa a ver a solicitação quando o booking for concluído
- B) Cancela a solicitação, porque esse fornecedor nunca vai responder
- C) Escolhe o item de outro booking, porque este não tem como andar
- ✔ D) Cria o acesso por **Criar acesso →** ou registra a resposta dele aqui

> Sem login, a solicitação abre, mas não chega a ninguém. Crie o acesso no cadastro dele ou registre aqui a resposta que ele der por fora (WeChat, e-mail).

---

## WBK-04 · Decidir a resposta do fornecedor e criar o produto

**Duração** 5:00 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Gerente de produto; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:50` · **Ler a resposta do fornecedor e decidir** (cenas 1 a 5): Abra o aviso, leia a resposta (ou registre a que veio por fora) e aprove ou recuse no cartão Decisão da Wellmix.
2. `1:50–3:10` · **Ligar os itens iguais e criar o produto** (cenas 6 a 7): Marque só os itens iguais e crie o produto novo, que nasce fora da vitrine do cliente.
3. `3:10–5:00` · **Associar a um produto existente e conferir a ficha** (cenas 8 a 11): Associe o item a um produto que já existe quando for o caso, confira a ficha criada e veja o próximo passo.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 3

Qual selo a solicitação ganha quando o fornecedor responde?

- A) Aprovada pelo fornecedor
- B) Aberta, esperando o fornecedor
- C) Em análise pela Wellmix
- ✔ D) Respondida

> Quando o fornecedor responde, a solicitação fica **Respondida** e falta a sua decisão. Só depois de aprovar ou recusar ela muda de novo.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 2, cena 7

Depois de clicar em **Criar produto**, o cliente já vê o produto na vitrine?

- A) Sim, assim que o produto é criado e ligado aos itens
- ✔ B) Não: ele nasce fora da vitrine até ser liberado
- C) Sim, mas só o cliente que pediu aquela jarra antes
- D) Não: ele só nasce quando o cliente fizer um pedido

> O produto criado pelo booking nasce fora da vitrine. Os próximos passos, o CODPROD do Sankhya e **Liberar na vitrine**, vêm no episódio seguinte.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 5

O fornecedor respondeu que **não faz** o item. Quais botões o cartão **Decisão da Wellmix** oferece?

- A) **Aprovar** e **Recusar**
- B) **Cancelar a solicitação** e **Recusar**
- ✔ C) Só **Recusar**
- D) Só **Aprovar**, para a Wellmix pedir de novo

> Numa solicitação Respondida em que o fornecedor faz, os botões são **Aprovar** e **Recusar**; se ele disse que não faz, só dá para recusar. **Cancelar a solicitação** vale enquanto ela está Aberta.

**Q4** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 4

O fornecedor mandou o preço por WeChat e a solicitação continua **Aberta**. Como você registra a resposta?

- ✔ A) Preenche o cartão e clica em **Registrar a resposta do fornecedor**
- B) Clica em **Aprovar** direto, sem registrar a resposta que ele mandou por fora
- C) Abre outra solicitação ao mesmo fornecedor, com o preço novo informado
- D) Cria o produto agora e pergunta o preço ao fornecedor depois, por fora

> Para resposta que veio por fora, registre por ele: 'Faz o que foi pedido?', preço por peça, moeda, pedido mínimo, prazo e observação. A solicitação passa a **Respondida**.

**Q5** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 11

Coloque na ordem o trabalho com a resposta de um fornecedor.

- A) Marcar os itens de booking que são iguais
- B) Ler a resposta do fornecedor
- C) Criar o produto novo ou associar a um que já existe
- D) Clicar em **Aprovar**

Ordem certa: B → D → A → C

> Leia a resposta, aprove, marque os itens iguais no bloco Produto e só então crie o produto ou associe a um existente.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

No bloco **Produto**, as alternativas já vêm marcadas, mas a jarra 'com bico dosador' do Yiwu não é o mesmo produto. O que você faz?

- A) Deixa marcada: todas as alternativas viram o mesmo produto
- B) Desmarca o item escolhido, que é o que difere
- ✔ C) Desmarca essa alternativa; o item escolhido sempre entra
- D) Cria um produto novo para cada alternativa marcada

> Em itens de booking ligados ao produto, o escolhido sempre entra e as alternativas já vêm marcadas. Desmarque as que não são o mesmo produto.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

Você aprovou a solicitação da panela, e o catálogo já tem 'Jogo de panelas antiaderentes 5 pçs'. O que faz?

- A) Cria um produto novo com o mesmo nome e depois liga os itens iguais
- ✔ B) Busca e marca o produto, e clica em **Associar ao produto marcado**
- C) Recusa a solicitação para não duplicar o produto
- D) Usa **Ligar mais itens** sem escolher nenhum produto

> Se o produto já existe, não crie outro: busque por nome ou código e use **Associar ao produto marcado**. O cadastro dele não muda; só ganha o novo fornecedor.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 1, cena 5

Você já clicou em **Aprovar**. O fornecedor pede para mudar o preço e você tenta registrar uma nova resposta. O que acontece?

- A) A resposta muda e a solicitação volta a ficar Respondida
- B) A solicitação volta a ficar Aberta e o fornecedor responde de novo
- C) A Wellmix ainda pode mudar a resposta, mas o fornecedor não
- ✔ D) A tela recusa: a Wellmix já decidiu e a resposta não muda mais

> O fornecedor e a Wellmix podem mudar a resposta só até a decisão. Depois, aparece 'A Wellmix já decidiu esta solicitação: a resposta não muda mais.'

---

## WBK-05 · Ligar ao Sankhya e liberar na vitrine

**Duração** 3:30 · **Capítulos** 3 · **Perguntas** 8 · **Idiomas** pt

**Quem assiste:** Operador · Comprador; Operador · Gerente de produto; Administrador

### Capítulos (mini vídeos)

1. `0:00–1:20` · **Entender o produto escondido e o CODPROD** (cenas 1 a 4): Veja por que o produto criado pelo booking nasce fora da vitrine e o que é o CODPROD do Sankhya.
2. `1:20–2:30` · **Buscar e gravar o CODPROD** (cenas 5 a 6): Busque o produto no Sankhya ou digite o CODPROD e grave o código, que fica não conferido sem credencial.
3. `2:30–3:30` · **Liberar na vitrine e conferir como o cliente** (cenas 7 a 9): Clique em Liberar na vitrine e confira, na conta do cliente, que o produto já aparece em Explorar.

### Perguntas

**Q1** · nível 1 (lembrar) · uma resposta · capítulo 1, cena 4

O que é o **CODPROD**?

- A) O código do produto na fábrica do fornecedor
- B) O número do booking de onde o item veio
- ✔ C) O código do produto no Sankhya, o ERP da Wellmix
- D) O SKU que o cliente vê na vitrine

> CODPROD é o código do produto no Sankhya, o ERP da Wellmix. O portal só liga o produto a esse código.

**Q2** · nível 1 (lembrar) · uma resposta · capítulo 3, cena 7

Qual botão deixa o produto visível para o cliente?

- ✔ A) **Liberar na vitrine**
- B) **Gravar código**
- C) **Buscar**, no cartão Sankhya
- D) **Usar**, na lista de resultados

> **Liberar na vitrine**, no bloco Produto, passa o produto para a vitrine. O bloco passa a mostrar 'Na vitrine desde' e a data.

**Q3** · nível 2 (aplicar) · uma resposta · capítulo 1, cena 3

O produto criado pelo booking ainda não foi liberado. O que o cliente consegue?

- A) Ver o produto na vitrine, mas sem conseguir pedir
- B) Ver o produto só se abrir o endereço direto dele
- C) Ver o produto na vitrine, com 'Preço sob consulta'
- ✔ D) Não achar o produto na vitrine, na página dele nem no carrinho

> Enquanto não for liberado, o produto fica escondido do cliente: vitrine, página do produto, carrinho, nova solicitação e kit de marketing.

**Q4** · nível 2 (aplicar) · colocar na ordem · capítulo 3, cena 9

Coloque na ordem os passos para deixar o produto pronto para o cliente.

- A) Gravar o código com **Gravar código**
- B) Liberar o produto com **Liberar na vitrine**
- C) Buscar ou digitar o CODPROD
- D) Conferir a ficha do produto

Ordem certa: C → A → D → B

> Ache ou digite o CODPROD, grave, confira a ficha (nome, linha, preço, medidas) e só então libere na vitrine.

**Q5** · nível 2 (aplicar) · uma resposta · capítulo 2, cena 5

O portal está sem credencial do Sankhya. Como você liga o produto ao ERP?

- A) Clica em **Buscar** e depois em **Usar** no resultado da lista
- ✔ B) Digita o CODPROD e grava; ele fica como não conferido
- C) Pede o CODPROD ao fornecedor, que cadastrou o item na fábrica
- D) Espera a credencial: sem ela não dá para gravar o código

> Sem credencial, a busca só mostra o aviso 'Sankhya sem credencial: digite o CODPROD; ele fica gravado como não conferido.' A lista e o botão **Usar** vêm com a integração ligada.

**Q6** · nível 3 (decidir) · uma resposta · capítulo 2, cena 6

Você digitou letras junto com o número em **CODPROD** e clicou em **Gravar código**. A tela diz 'O CODPROD é um número (até 10 dígitos).' O que faz?

- A) Clica em **Usar** na lista de resultados da busca
- B) Libera o produto na vitrine e grava o código depois
- ✔ C) Digita só números, no máximo 10 dígitos, e grava de novo
- D) Digita o SKU do produto no lugar do código

> O CODPROD aceita só números, até 10 dígitos. Corrija o valor e clique em **Gravar código** de novo.

**Q7** · nível 3 (decidir) · uma resposta · capítulo 3, cena 8

Na conta do cliente, o produto liberado aparece com 'Preço sob consulta'. Isso é um erro da liberação?

- ✔ A) Não: o preço estimado só aparece quando o cadastro tem câmbio, frete e impostos
- B) Sim: o produto precisa ser liberado de novo com o preço
- C) Sim: falta gravar o CODPROD para o preço aparecer
- D) Não: o cliente só vê o preço depois de fazer o pedido

> O produto já está na vitrine e o cliente já pode pedir. O preço estimado só aparece quando o cadastro tem câmbio, frete e impostos, então não prometa preço.

**Q8** · nível 3 (decidir) · uma resposta · capítulo 1, cena 4

O produto ainda não existe no Sankhya. Você tenta criá-lo pelo cartão **Sankhya** do portal. O que acontece?

- A) O portal cria o produto no ERP e grava o CODPROD sozinho
- B) O portal cria o produto no ERP, mas só depois de liberar na vitrine
- C) O portal cria o produto no ERP quando a solicitação é aprovada
- ✔ D) Não dá: o portal só liga a um código que já existe no Sankhya

> O portal não cria produto no Sankhya: ele só liga o produto ao código que já existe. O produto precisa estar cadastrado no ERP antes.

