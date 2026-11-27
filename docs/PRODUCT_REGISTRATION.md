# Cadastrar produto

Pedido do dono (26/11/2026, com a imagem da tela "Produto" do Sankhya e a planilha de cadastro `Pasta1.xlsx`, aba CADASTRO): depois que os dois lados concordam na cotação, vem a etapa de criar o produto, quando ele não existe (veio do book). Essa parte saiu da tela da cotação, onde acontece a negociação, e ganhou uma tela própria, **Cadastrar produto**, logo depois de Cotação no menu (dentro do grupo Cotação). Nela a Wellmix faz o cadastro do produto do book para o Sankhya, com tudo o que foi preenchido no processo para aquele item, e com todos os campos do cadastro do Sankhya para preencher no portal e enviar pela API.

## 1. Menu, lista e pendência

| Onde                                          | O que                                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu, grupo Cotação                           | Item **Cadastrar produto** depois de Cotação (passo `new-product/registration` em `src/lib/flow.ts`, tela `productRegistration`). Também no Overview do grupo.                                                                              |
| Lista (`/app/product-registration`)           | Uma linha por produto aprovado na cotação que veio do book: cotação, produto, fornecedor, book, situação, CODPROD e o rascunho. Abas **A cadastrar** (esperando a amostra, a cadastrar, falta o Sankhya) e **Cadastrados** (com o CODPROD). |
| Um produto (`/app/product-registration/<id>`) | O `id` é o da solicitação ao fornecedor (a cotação aprovada).                                                                                                                                                                               |
| Pendências                                    | "Cadastrar o produto: cotação nº N" (tipo `product_registration`) quando a amostra está aprovada e o produto ainda não existe; conta no item do menu. Para a Wellmix com a tela Cadastrar produto.                                          |
| Tela da cotação                               | O bloco Produto virou um atalho: "Abrir em Cadastrar produto" (e, com o produto, o nome, se foi criado ou associado e o CODPROD). O resto da cotação não mudou.                                                                             |

Situações (`registrationState`, `src/lib/product-registration.ts`): **Esperando a amostra** (dá para preencher e gravar o rascunho; cadastrar só com a amostra aprovada, regra de 12/11/2026), **A cadastrar**, **Falta o Sankhya** (produto no portal sem CODPROD) e **Cadastrado**.

### Quem abre

Tela própria no controle de acesso, **Cadastrar produto** (`productRegistration`, grupo Cotação em Funções e acessos). Nasce para o Comprador, o Gerente de produto, o Cadastro e as diretorias; nas funções já gravadas pelo administrador, segue a tela Cotação (`SCREEN_PARENT`), como a Estratégia de compra. O designer, Vendas e a Qualidade, que abrem Produtos, não a recebem. Associar a um produto existente, a vitrine e o CODPROD digitado continuam pedindo também a tela Cotação e Produtos, como antes.

## 2. O formulário

Os campos são a união da tela do Sankhya (aba Compras) com as 72 colunas da planilha de cadastro (70 campos e as duas fotos), em seções: Identificação, Grupo e linha, Supplier e Factory, Unidades e situação, Certificações, Características do produto, Alimentação (pilhas e baterias), Embalagem, A peça (medidas e pesos), Caixa master, Caixa inner, Fiscal e Informações adicionais. O catálogo fica em `REGISTRATION_FIELDS`; o teste `tests/unit/product-registration.test.ts` confere que cada coluna da planilha e cada campo da imagem têm o seu campo.

- Medidas em metros, como na planilha (no portal, o produto guarda em centímetros). Números aceitam vírgula ou ponto.
- Sim/Não para as chaves do Sankhya (vão como S/N); datas vão como DD/MM/AAAA; o NCM só com os dígitos.
- **Listas do Sankhya com busca** (dono, 27/11/2026): Grupo, Cód. Linha, Cód. Tipo Embalagem, Unidade padrão, Unid. Compra, Marca, Marca Wellmix e País de origem são escolhidos nas opções lidas do Sankhya: digita-se e a lista vai filtrando (o buscador padrão dos formulários, `SearchPicker`). O código vai ao Sankhya; a Marca vai com o código (CODMARCA) e o nome (MARCA). O que o processo trouxe continua preenchido: o código gravado, ou a opção com o mesmo nome (ex.: a embalagem "COLOR BOX" do book). Sem a lista (Sankhya fora do ar), o campo volta a ser código e nome digitados. Ver "Listas do Sankhya" abaixo.
- Os outros campos de código (Parceiro fornecedor, Porto) têm o código e o nome ao lado; só o código vai ao Sankhya.
- Campos de lista do dicionário (ex.: Situação Embalagem, Gerente de Produto, Tipo Pilha/Bateria) viram uma lista com as opções do TDDOPC.
- Obrigatórios: para cadastrar no portal, a descrição e o Grupo; para enviar ao Sankhya, também a marca, a unidade padrão e a referência do fornecedor (REFFORN).

### Grupo e linha (dono, 27/11/2026)

- Só se preenchem o **Grupo** e o **Cód. Linha**. O Grupo vem da árvore de grupos do Sankhya (TGFGRU, os do último nível); escolhido, a tela mostra, só para ler, o Grupo, o **Sub grupo**, a **Coleção do grupo** e a **Categoria do grupo** com código e nome (ex.: 10902001 BONECAS FASHION → 10902000 FASHION → 10900000 BONECAS → 10000000 BRINQUEDO; `groupPath`). O Sankhya preenche esses três sozinho a partir do Grupo; o portal não os envia.
- A **Categoria do grupo é a família** do portal, a mesma escolhida no book (e na encomenda). Os grupos da família do book vêm primeiro na lista; escolher um de outra família mostra o aviso de divergência.
- O produto do portal fica na linha desse grupo (`product_lines.sankhyaCode`); grupo sem linha no portal ganha a linha, como na carga do Sankhya (`lineForGroup`).
- Sem a árvore do Sankhya (fora do ar, ou no modo de testes), o campo mostra as linhas do portal, como antes.

### Supplier e Factory (dono, 27/11/2026)

As duas entidades do book, já preenchidas:

| Campo                                                  | De onde                                                                     | Sankhya                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------ |
| Supplier                                               | O Supplier do book (o fornecedor da cotação; sem cadastro, o nome digitado) | Só no portal                               |
| Supplier no Sankhya (parceiro fornecedor preferencial) | O código do Supplier no Sankhya                                             | CODPARCFORN: **é o Supplier que vai**      |
| Factory                                                | A fábrica do book (o cadastro estimado pela planilha)                       | Só no portal                               |
| Código fabricante (nº da loja)                         | O nº da loja digitado na importação do book                                 | Só no portal (sem campo achado no Sankhya) |
| Factory: endereço/telefone (Fornec. Adress Phone)      | O nº da loja e o endereço/telefone da fábrica                               | AD_DADOSFABRICANTE                         |
| Factory code (código do item na fábrica)               | O código da fábrica do item (SKU)                                           | AD_FACTORYCODE                             |
| Referência do fornecedor (código do item)              | O código da fábrica do item                                                 | REFFORN (por ele o portal acha o CODPROD)  |

- Ao lado de cada campo, a coluna do Sankhya para onde ele vai, ou "Só no portal".

### O que vem preenchido

| Campo                                      | De onde                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Descrição (português) e Descrição inglês   | Nome e descrição do item do book                                                              |
| Supplier e Factory                         | O book (ver a tabela acima)                                                                   |
| País de origem e Porto de embarque         | Os mais frequentes nos outros produtos do mesmo fornecedor no Sankhya (`sankhyaRefs`)         |
| Lead time de compra                        | Prazo combinado na negociação                                                                 |
| Gerente de produto                         | O responsável pelo book (ou quem abriu a cotação)                                             |
| Certificações (INMETRO, ANATEL, ANVISA)    | As exigidas pela linha da família do book, quando só uma linha tem essa família               |
| Composição, cores, cor solicitada          | Material, cores do item e a variação da Seleção                                               |
| Capacidade, alimentação, tipo de embalagem | Capacidade (ml), função/bateria e embalagem do item                                           |
| Qtde de peças na embalagem                 | As peças por embalagem da Seleção (sets)                                                      |
| Medidas e pesos da peça                    | Medidas (cm → m) e pesos do item                                                              |
| Caixa master e inner                       | Peças por caixa, CBM e inner do item (a cópia da cotação, já com a caixa alterada na Seleção) |
| NCM                                        | NCM do item do book                                                                           |
| Informações adicionais                     | "O que a Wellmix precisa" e a programação do book                                             |
| Unidades, Solicita compra, Catálogo...     | Padrões: UN; Solicita compra, Permite comprar/vender e Catálogo = Sim; os outros = Não        |

Nada é inventado: o que o processo não tem fica em branco. As fotos (a do item e as da amostra) ficam no alto da tela; não vão ao Sankhya por aqui.

## 3. Botões

- **Gravar rascunho**: grava o formulário na cotação (`supplier_requests.registration`). Os outros dois botões gravam o rascunho antes de qualquer coisa: com uma recusa, nada do que foi digitado se perde, e a tela aponta os campos.
- **Cadastrar produto** (sem produto): cria o produto no portal com o formulário (nome, linha, SKU = código fabricante, marca, NCM, medidas, pesos, caixas, CBM, Pantone...), a ficha mestre e o fornecedor como antes (`createProductFromRequest`), liga os itens do book marcados e tenta enviar ao Sankhya. O produto nasce fora da vitrine, como antes.
- **Gravar e enviar ao Sankhya** (com produto): grava o formulário no produto e envia de novo (inclui sem CODPROD; altera com CODPROD).
- Com o produto cadastrado continuam na tela, com as regras de antes: liberar na vitrine, ligar mais itens e o CODPROD digitado ou buscado no Sankhya (para quem abre também a Cotação).

### É semelhante a algum do catálogo? (dono, 27/11/2026)

No lugar do "Já existe no catálogo?" (que associava a cotação a um produto existente), uma **coluna fixa à direita** (acompanha a rolagem, por cima do resto) com os produtos parecidos: as sugestões pelo código da fábrica e pela descrição, ou a busca por nome, código ou CODPROD.

- Escolhido um, **Associar** grava o rascunho (nada do que foi digitado se perde) e abre o quadro **Trazer do produto semelhante**.
- O quadro lista só os campos que o processo (book, seleção, negociação e fornecedor) **não** preencheu e que o semelhante tem, com o valor dele; os padrões (S/N, unidade) contam como não preenchidos. Vêm marcados os que estão vazios; o que já foi digitado aparece ao lado ("agora: …").
- **Trazer os marcados** copia para o rascunho só esses campos (`applySimilarProduct`, auditoria `product_registration.similar`). O produto da cotação continua novo: nada é associado.
- De onde vem o cadastro do semelhante: o do Sankhya (a linha da TGFPRO pelo CODPROD, pelo mesmo de-para do envio, ao contrário; `valuesFromSankhyaRow`), completado pelo do portal; sem o Sankhya, só o do portal (marca pelo nome, que a lista acha pelo código).

## 4. Envio ao Sankhya

- `DatasetSP.save` na entidade **Produto** (TGFPRO), como a sincronização já fazia (`sankhya-sync.ts`), agora com todos os campos que têm coluna. Na inclusão vão também os valores fixos dos cadastros (Configurações → Sankhya → Processos) e ATIVO = S.
- Antes de incluir, procura pelo REFFORN: achando, liga e altera (não duplica). Depois de incluir, acha o CODPROD pelo REFFORN e grava no produto.
- Só envia com a credencial do Sankhya e a **execução no Sankhya ligada** (a mesma chave dos pedidos). Sem uma delas, o produto fica cadastrado no portal, a tela diz o motivo e o "Gravar e enviar ao Sankhya" fica para depois. Em produção, em 26/11/2026, a execução estava desligada.
- O resultado fica na cotação (`registration.sendStatus`, `sendDetail`, `skipped`), em `process_events` (`sync:product:create|update`) e na Auditoria (`product.registration_send`). Recusa do Sankhya não desfaz o produto do portal.

### De-para dos campos (TGFPRO)

- Colunas padrão conhecidas: DESCRPROD, REFFORN, MARCA, AD_CODMARCAWELL, CODGRUPOPROD, CODPARCFORN, CODPAIS, AD_IDPORTO, CODVOL, CODVOLCOMPRA, AD_DESCONTINUADO, ALTURA, LARGURA, ESPESSURA, PESOLIQ, PESOBRUTO e NCM.
- Os campos personalizados (AD_*) do Sankhya da Wellmix não estão no código: a coluna é achada no **dicionário do Sankhya** (TDDCAM da TGFPRO) pela descrição do campo, que é o nome na tela dele ("Gerente de Produto", "Factory Code", "Obrig. Certif. INMETRO"...) ou o cabeçalho da planilha. As opções das listas vêm do TDDOPC.
- A credencial é a de Configurações → Integração Sankhya (ou as variáveis de ambiente), a mesma do resto da integração.
- O dicionário é lido sozinho na primeira vez que a tela abre com a credencial e guardado no portal (`settings`, chave `sankhya.productDictionary`); o administrador lê de novo pelo botão "Ler os campos do Sankhya" no quadro **Campos no Sankhya**, no fim da tela.
- No mesmo quadro, o administrador corrige a coluna de um campo ou digita "-" para não enviá-lo (`sankhya.productFieldMap`). Com o dicionário lido, coluna que não existe nele não vai (o Sankhya recusaria o cadastro inteiro). Duas vezes a mesma coluna: fica o primeiro campo.
- Campo com valor e sem coluna fica só no portal, e a tela lista quais não foram.
- Os campos só do portal (o nome do Supplier e o da Factory) nunca vão.

### Listas do Sankhya (dono, 27/11/2026)

| Lista               | Tabela                                                     |
| ------------------- | ---------------------------------------------------------- |
| Grupo               | TGFGRU (a árvore, `sankhyaProductGroups`, guardada 30 min) |
| Unidades            | TGFVOL (CODVOL, DESCRVOL)                                  |
| Marca               | TGFMAR (CODIGO, DESCRICAO)                                 |
| País de origem      | TSIPAI (CODPAIS, DESCRICAO)                                |
| Cód. Linha          | Achada no dicionário: a ligação de AD_CODLINHA (TDDLGC)    |
| Marca Wellmix       | Achada no dicionário: a ligação de AD_CODMARCAWELL         |
| Cód. Tipo Embalagem | Achada no dicionário: a ligação de AD_CODTIPOEMB           |

- As listas ficam guardadas no portal por 12 horas (`sankhya.productLookups`, `src/lib/services/sankhya-lookups.ts`). No fim da tela, o administrador vê, no quadro **Listas do Sankhya**, de onde vem cada uma, quantas opções vieram e o erro, se houve; corrige a tabela de uma lista escrevendo `TABELA.CODIGO.NOME` (`sankhya.productLookupSources`) e lê de novo com "Atualizar as listas do Sankhya".
- As tabelas das três listas personalizadas são uma das perguntas ao técnico (seção 8).

## 5. Esquema (aditivo)

- `supplier_requests.registration` (JSON): os valores do formulário, quem gravou e quando, e o último envio.
- Nenhuma tela, rota ou campo saiu. O bloco antigo da cotação continua no código (`RequestProductCard`), usado pela tela nova com o produto já cadastrado; as ações dele voltam para a tela nova com `home=registration`.
- Rascunhos gravados antes de 27/11/2026 com a linha do portal (`lineId`) valem como o Grupo.

## 6. Código

| Parte        | Arquivo                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Regras puras | `src/lib/product-registration.ts` (catálogo, de-para, valores, pré-preenchimento, situação)                              |
| Serviço      | `src/lib/services/product-registration.ts` (lista, tela, rascunho, cadastrar, enviar, dicionário, de-para, pendência)    |
| Ações        | `src/app/app/actions/product-registration.ts`                                                                            |
| Listas       | `src/lib/services/sankhya-lookups.ts` (listas do Sankhya, tabelas, cópia de 12 h)                                        |
| Telas        | `src/app/app/product-registration/page.tsx`, `[id]/page.tsx` e `_components/` (formulário, listas com busca, semelhante) |
| Textos       | `src/i18n/modules/product-registration.ts` (pt, en e zh)                                                                 |
| Testes       | `tests/unit/product-registration.test.ts`; E2E do book ao pedido passando pela tela nova                                 |

## 7. Em aberto (para o dono decidir)

1. **Caixas master e inner no Sankhya**, 2. **Fotos** e 3. **Execução no Sankhya**: o dono leva as perguntas ao técnico do Sankhya (seção 8; dono, 27/11/2026: as fotos devem ir, falta saber como).
2. **Supplier e Factory**: resolvido (27/11/2026): os dois vêm do book e o Supplier é o que vai ao Sankhya (CODPARCFORN).

## 8. Perguntas ao técnico do Sankhya (27/11/2026)

Contexto: o portal inclui e altera o produto na TGFPRO pela API (`DatasetSP.save`, entidade Produto), procura o CODPROD pelo REFFORN depois de incluir, e lê o dicionário (TDDCAM e TDDOPC da TGFPRO) para achar os campos personalizados pela descrição.

**1. Caixas master e inner**

1. Onde cadastrar as duas caixas: nos volumes alternativos (TGFVOA)? Qual é o nome da entidade para o `DatasetSP.save` e quais campos são obrigatórios (CODPROD, CODVOL, QUANTIDADE, DIVIDEMULTIPLICA, M3, medidas, pesos...)?
2. Quais unidades (CODVOL da TGFVOL) usar para a caixa master e para a inner?
3. O M3 da TGFVOA é o volume de uma caixa, em m³? As medidas são em metros?
4. O campo AD_QTPDPECAS ("Qtd. Peças por Caixa") da TGFPRO é a quantidade da caixa master? Devemos preencher?

**2. Fotos** (o dono quer mandar)

1. A foto de origem vai em AD_IMAGEM02 ("Origem China 400x400") e a do produto na balança em AD_IMAGEM04 ("Produto Balança 200x200")? E AD_IMAGEM01 ("Imagem Compras 400x400") e a IMAGEM padrão?
2. Como gravar um campo de imagem (BLOB) pela API: o `DatasetSP.save` aceita a imagem em base64? Ou há outro serviço?
3. Formato e tamanho: JPG ou PNG? Precisamos redimensionar para 400x400 e 200x200 antes de enviar?

**3. Inclusão do produto pela API**

1. Podemos incluir e alterar produtos pela API antes de ligar a escrita dos pedidos?
2. Há regra ou gatilho na inclusão do produto que precisamos saber (campos obrigatórios por customização, "Cadastro Revisado" AD_CAD_REVISADO, "Validado" AD_VALIDADO)?
3. O produto deve nascer ativo (ATIVO = S) ou inativo, para o Cadastro revisar?
4. O REFFORN é único por produto? É seguro achar o CODPROD por ele depois de incluir?

**4. Tabelas das listas**

1. Em que tabela ficam as opções de Cód. Linha (AD_CODLINHA), Marca Wellmix (AD_CODMARCAWELL) e Cód. Tipo Embalagem (AD_CODTIPOEMB)? Quais as colunas do código e da descrição?
2. Marca: a tabela é a TGFMAR (CODIGO, DESCRICAO)? A coluna MARCA (texto) deve ir junto com o CODMARCA?
3. Cód. Tipo Embalagem (AD_CODTIPOEMB, pesquisa) e Tipo de Embalagem (AD_TIPOEMBALAGEM, lista de 120 opções): qual usar? Os dois?
4. Sub Grupo, Coleção do Grupo e Categoria do Grupo (AD_SUBGRUPO, AD_COLECAO, AD_CATEGORIA) são preenchidos pelo Sankhya ao gravar o Grupo? Ou devemos enviar?
5. Gerente de Produto (AD_GP_RESPONSAVEL) é uma lista fixa de 6 opções: o valor é o código do usuário? Como entra um gerente novo?

**5. Medidas da peça e da embalagem**

1. A planilha tem as medidas da peça e as da embalagem individual. No dicionário há ALTURA/LARGURA/ESPESSURA e AD_EMBALTURA/AD_EMBLARGURA/AD_EMBESPESSURA/AD_EMBPROFUNDIDADE ("Produto sem Embalagem (m)"). Confirma: peça → AD_EMB* e embalagem individual → ALTURA/LARGURA/ESPESSURA? (Hoje o portal manda a peça em ALTURA/LARGURA/ESPESSURA.)
2. Os rótulos parecem trocados: AD_EMBESPESSURA diz "Profundidade" e AD_EMBPROFUNDIDADE diz "Espessura". Qual é qual?

**6. Outros campos**

1. "Descrição venda" e "Empresa" da planilha: em que campos da TGFPRO? (Não achamos pelo nome.)
2. "Fornec.Adress Phone" (AD_DADOSFABRICANTE) é o endereço/telefone da fábrica? No exemplo vem "668", o nº da loja. Há um campo para o código da fábrica?
