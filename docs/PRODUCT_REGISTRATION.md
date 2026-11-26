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

Os campos são a união da tela do Sankhya (aba Compras) com as 72 colunas da planilha de cadastro (70 campos e as duas fotos), em seções: Identificação, Grupo e linha, Fornecedor e origem, Unidades e situação, Certificações, Características do produto, Alimentação (pilhas e baterias), Embalagem, A peça (medidas e pesos), Caixa master, Caixa inner, Fiscal e Informações adicionais. O catálogo fica em `REGISTRATION_FIELDS`; o teste `tests/unit/product-registration.test.ts` confere que cada coluna da planilha e cada campo da imagem têm o seu campo.

- Medidas em metros, como na planilha (no portal, o produto guarda em centímetros). Números aceitam vírgula ou ponto.
- Sim/Não para as chaves do Sankhya (vão como S/N); datas vão como DD/MM/AAAA; o NCM só com os dígitos.
- Campos de código (Marca Wellmix, Cód. linha, Parceiro fornecedor, País de origem, Porto, Unidades, Tipo de embalagem) têm o código e o nome ao lado; só o código vai ao Sankhya.
- Campos de lista do Sankhya (ex.: Situação Embalagem) viram uma lista com as opções lidas do dicionário dele.
- Obrigatórios: para cadastrar no portal, a descrição e o grupo (a linha do portal, que leva o CODGRUPOPROD); para enviar ao Sankhya, também a marca, a unidade padrão e o código fabricante (REFFORN), e a linha precisa ter grupo do Sankhya.
- Ao lado de cada campo, a coluna do Sankhya para onde ele vai, ou "Só no portal".

### O que vem preenchido

| Campo                                      | De onde                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Descrição (português) e Descrição inglês   | Nome e descrição do item do book                                                              |
| Factory code e Código fabricante (REFFORN) | Código da fábrica do item                                                                     |
| Fornecedor, parceiro (CODPARC) e contato   | Fornecedor da cotação (nome, código do Sankhya, endereço, cidade e telefone)                  |
| País de origem e Porto de embarque         | Os mais frequentes nos outros produtos do mesmo fornecedor no Sankhya (`sankhyaRefs`)         |
| Lead time de compra                        | Prazo combinado na negociação                                                                 |
| Gerente de produto                         | O responsável pelo book (ou quem abriu a cotação)                                             |
| Grupo (linha)                              | A linha da família do book, quando só uma linha tem essa família                              |
| Certificações (INMETRO, ANATEL, ANVISA)    | As exigidas pela linha sugerida                                                               |
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
- Continuam na tela, com as regras de antes: **Já existe no catálogo?** (associar a um produto existente), liberar na vitrine, ligar mais itens e o CODPROD digitado ou buscado no Sankhya (para quem abre também a Cotação).

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

## 5. Esquema (aditivo)

- `supplier_requests.registration` (JSON): os valores do formulário, quem gravou e quando, e o último envio.
- Nenhuma tela, rota ou campo saiu. O bloco antigo da cotação continua no código (`RequestProductCard`), usado pela tela nova; as ações dele voltam para a tela nova com `home=registration`.

## 6. Código

| Parte        | Arquivo                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Regras puras | `src/lib/product-registration.ts` (catálogo, de-para, valores, pré-preenchimento, situação)                           |
| Serviço      | `src/lib/services/product-registration.ts` (lista, tela, rascunho, cadastrar, enviar, dicionário, de-para, pendência) |
| Ações        | `src/app/app/actions/product-registration.ts`                                                                         |
| Telas        | `src/app/app/product-registration/page.tsx`, `[id]/page.tsx` e `_components/registration-form.tsx`                    |
| Textos       | `src/i18n/modules/product-registration.ts` (pt, en e zh)                                                              |
| Testes       | `tests/unit/product-registration.test.ts`; E2E do book ao pedido passando pela tela nova                              |

## 7. Em aberto (para o dono decidir)

1. **Caixas master e inner no Sankhya.** No Sankhya da Wellmix elas ficam nos volumes alternativos (TGFVOA), não na TGFPRO. Hoje vão para o produto do portal e só vão ao Sankhya se o dicionário tiver um campo da TGFPRO com o nome da planilha. Gravar a TGFVOA pela API precisa do volume (CODVOL) de cada caixa e de um teste no Sankhya.
2. **Fotos.** A foto de origem e a da balança ficam no portal; mandar para as imagens do Sankhya (IMAGEM, AD_IMAGEM*) é outro envio.
3. **Execução no Sankhya.** O envio usa a mesma chave dos pedidos (Configurações → Sankhya → Processos). Se a Wellmix quiser mandar produtos antes de ligar os pedidos, vira uma chave só para o cadastro.
4. **Código fabricante × Factory code.** O código fabricante vai no REFFORN (é por ele que o portal acha o CODPROD) e o Factory code no campo dele; os dois nascem com o código da fábrica do book.
