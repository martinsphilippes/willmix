# Condições do pedido e contatos do cliente (Nova solicitação)

Pedido do dono (15/11/2026) para a tela `/app/requests/new`: um bloco do cliente no lugar da busca por foto ou link, condições no nível do pedido (tipo de operação, formato de venda, entrega, país de origem e grupo de produto) e um aviso claro de que não há devoluções.

## 1. Quem vê

- **Wellmix vendendo ao cliente** (representante ou vendedor; nova solicitação, fora do "adicionar produto"): tudo deste documento.
- **Compra para estoque** (caixa "Compra para estoque"): sem bloco do cliente e sem condições ("Compra para estoque: sem condições de venda nem contatos do cliente"). O país e o grupo também não são pedidos.
- **O próprio cliente** (login de cliente): a tela segue como antes, com a busca por foto ou link. Nada deste documento aparece para ele.
- **Adicionar produto a uma solicitação** (`?addTo=`): como antes (as condições ficam as da solicitação).

## 2. Bloco do cliente (no lugar de "Encontrar o produto por foto ou link")

- Coluna da direita, no alto (no celular, antes do formulário), card "Cliente".
- **Contatos:** Sócio, Comprador, Financeiro e Fiscal, Logística; cada um com telefone e e-mail. Todos obrigatórios.
- **Primeira vez pelo portal, às cegas:** enquanto o portal nunca atualizou os contatos do cliente, os campos chegam vazios. Nada do cadastro (e-mail, telefone, contato que vieram do Sankhya) vai para a tela, nem pela rota.
- **Depois de atualizados pelo portal:** a próxima venda mostra os quatro contatos, a data e quem atualizou, com "Editar contatos" (abre os campos preenchidos; "Cancelar edição" volta).
- **Grava junto com a solicitação** (os campos pertencem ao formulário pelo atributo `form`). Sem os contatos (cliente nunca atualizado e campos não enviados), o envio é recusado: "Preencha os contatos do cliente…".
- **Restrição:** nenhum contato pode ser igual ao do representante ou vendedor. O servidor compara:
  - o e-mail de quem está preenchendo e os e-mails dos logins ativos da Wellmix (admin e operador), sem diferenciar maiúsculas;
  - o telefone, só os dígitos (sem o 55 na frente), contra os telefones desses logins quando houver. **Hoje o login do portal não tem telefone**, então a regra de telefone ainda não tem com o que comparar (ver seção 7).
- **Validação:** telefone com 10 a 13 dígitos (DDD + número, com ou sem 55); e-mail válido.
- **Auditoria:** `party.contacts` ("atualizados pela primeira vez", "editados" ou "confirmados"), com o antes e o depois.

## 3. Condições do pedido (no formulário, antes dos produtos)

Card "Condições do pedido", logo abaixo de Cliente/Solicitante/RCA. Valem para todos os produtos do lote (cada solicitação do lote guarda a mesma cópia).

| Campo                            | Opções                                     | Obrigatório                        |
| -------------------------------- | ------------------------------------------ | ---------------------------------- |
| Tipo de operação                 | TS (Trading Sales) · Venda                 | Sim                                |
| Formato de venda                 | WD · Wellmix                               | Sim                                |
| Formato Wellmix (só com Wellmix) | Pleno · Mega · Hiper · Ultra · Evo · Super | Sim, com Wellmix                   |
| Entrega → Transportador          | Transportadoras do portal e do Sankhya     | Sim (dono, 15/11/2026: ao menos 1) |
| Entrega → Re-despacho            | As mesmas                                  | Não ("Sem re-despacho")            |
| País (de origem)                 | Países dos produtos do catálogo            | Sim                                |
| Grupo de produto                 | Grupos com produto no país escolhido       | Sim                                |

### 3.1 Entrega (Transportador e Re-despacho)

- **Portal:** parceiros do tipo Transportadora, ativos (produção em 15/11/2026: 6).
- **Sankhya:** `SELECT CODPARC, NOMEPARC, NOMECID FROM TGFPAR … WHERE TRANSPORTADORA = 'S' AND ATIVO = 'S'`, lido na hora e guardado por 30 minutos (`src/lib/services/delivery-carriers.ts`). Aparecem com "(Sankhya)". A transportadora do portal ligada ao mesmo código do Sankhya aparece uma vez.
- Sem o Sankhya configurado ou com erro, só as do portal, e a tela avisa.
- Gravado: `{ source: "portal" | "sankhya", code, name }` (o nome do momento da escolha).

### 3.2 País de origem > Grupo de produto

- A ordem é essa: escolher o país libera os grupos daquele país; com os dois escolhidos, a busca de produto de cada linha só oferece os produtos deles (`/api/products/search?scope=catalog&country=…&line=…`). Sem os dois, o campo de produto espera ("Escolha o país de origem e o grupo de produto…").
- **Grupo de produto** = a linha do produto (`products.lineId`), que é o grupo do Sankhya (TGFGRU, `CODGRUPOPROD`).
- **País de origem** = o país do fornecedor do produto: o fornecedor do cadastro (`supplierId`) ou, sem ele, o fornecedor que veio do Sankhya (`sankhyaRefs.CODPARCFORN` → parceiro com esse código). Siglas e grafias se juntam ("CN", "China" e "CHINA" = CHINA).
- **Sem país, não vende (dono, 15/11/2026):** produto sem fornecedor com país não aparece na lista de países nem na busca do pedido, e o servidor recusa. Produção em 15/11/2026 (consulta de leitura): de 13.909 produtos ativos, 4.184 têm país; **9.725 não têm fornecedor ligado no portal** (nem `supplierId` nem `CODPARCFORN` na carga, que trouxe só CODPROD, CODVOL e grupo da maioria). Exemplos: 25260 JARRA VIDRO BOROSSILICATO COM TAMPA LUME 1,5L (JARRAS INDIVIDUAIS), 25255 BOLA DE FUTEBOL SOCIAL N5 KICK PRO COLORFUL (BOLAS), 25250 CJ 4 PORTA CONDIMENTOS BOROSSILICATO HAPPY PRETO (PORTA TEMPEROS), 25246 BOLA INTERATIVA PARA PET BALLROPE (BRINQUEDOS), 25244 CJ 3 FORMAS ANTIADERENTE FENDI DELLY (FORMAS). Eles voltam assim que o fornecedor (e o país dele) chegar ao portal.
- O índice produto → país e grupo é lido do banco e guardado por 10 minutos por instância (`src/lib/services/product-origin.ts`).
- **Servidor:** todo produto do catálogo do lote precisa ser do país e do grupo escolhidos; senão o envio é recusado ("Há produto de outro país ou grupo…"). Produto fora do catálogo (sourcing) não tem cadastro para conferir e passa.

- **Fornecedor pela API do Sankhya (dono, 15/11/2026):** o portal já tem os fornecedores (parceiros com o código do Sankhya), mas a carga não trouxe o fornecedor da maioria dos produtos. Para esses (sem `supplierId` e sem `CODPARCFORN`), o índice lê `SELECT TOP 2000 CODPROD, CODPARCFORN FROM TGFPRO WHERE CODPARCFORN > 0 AND CODPROD > … ORDER BY CODPROD` em páginas (`src/lib/services/sankhya-product-suppliers.ts`), guarda 30 minutos e liga ao parceiro do portal com aquele código (fornecedor ou, se veio como outro tipo, qualquer parceiro com o código) para achar o país. Sem o Sankhya (ou com erro), esses produtos seguem sem país e tenta de novo em 2 minutos. Depois, a carga grava o fornecedor no banco e a leitura pela API deixa de ser necessária.

### 3.3 Aviso (disclaimer)

Caixa vermelha no fim das condições, sempre visível na venda ao cliente:

> **Atenção: sem devoluções** — Não nos responsabilizamos por defeitos ou quebras de produtos neste modelo de venda, ou seja, não há devoluções previstas para esta operação. Isto acontece, pois nosso processo prevê que o cliente seja o responsável pelas inspeções e aprovações necessárias durante o processo de produção.

A solicitação grava `noReturnsNotice: true` (o aviso estava na tela no envio) e mostra o aviso de novo nas condições da solicitação.

## 4. Dados (aditivos)

| Onde                                      | O quê                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parties.customerContacts` (JSON)         | `{ partner, buyer, finance, logistics }`, cada um `{ phone, email }`.                                                                                                                                           |
| `parties.customerContactsUpdatedAt`       | Quando o portal gravou. Nulo = nunca (a tela pede às cegas).                                                                                                                                                    |
| `parties.customerContactsUpdatedByUserId` | Quem gravou.                                                                                                                                                                                                    |
| `requests.orderTerms` (JSON)              | `{ operationType, saleFormat, wellmixTier, carrier, redispatch, originCountry, originCountryName, productLineId, productLineName, noReturnsNotice }`. Nulo nas antigas, na compra para estoque e na do cliente. |

Nada existente foi removido ou alterado.

## 5. Onde aparece depois

- Página da solicitação (`/app/requests/<id>`), card Solicitações: bloco "Condições do pedido" com tudo acima e o aviso. Só a Wellmix vê.

## 6. Código

- Regras puras: `src/lib/order-terms.ts` (listas, país, validação dos contatos).
- Servidor: `src/lib/services/order-terms.ts`, `customer-contacts.ts`, `product-origin.ts`, `delivery-carriers.ts`; ação `createRequestAction` (`src/app/app/actions.ts`).
- Rotas (só Wellmix com Solicitações): `GET /api/requests/order-options` (países e transportadoras; `?country=` = grupos) e `GET /api/customers/contacts?customer=`.
- Tela: `src/components/request-order-terms.tsx`, `request-customer-contacts.tsx`, `request-order-terms-view.tsx`.
- Testes: `tests/unit/order-terms.test.ts` e `tests/e2e/order-terms.spec.ts`.

## 7. Decisões do dono (15/11/2026, segunda rodada)

- Os contatos são do cliente (sócio, comprador, financeiro e logística dele) e ficam gravados no banco do portal (`parties.customerContacts`).
- Ao menos 1 transportador é obrigatório (o Re-despacho segue opcional).
- O aviso tem a caixa obrigatória **"Li e concordo"**; a solicitação grava `noReturnsAccepted: true`.
- Produto sem país de origem não é vendido: não aparece.
- A busca por foto ou link sai da tela da Wellmix (o login do cliente continua com ela).

## 8. Composição de containers (lateral direita)

- Card "Composição de containers" abaixo do bloco do cliente e acima do "Histórico de compras do cliente".
- **Tabela:** linhas = containers (Container 1, 2…); colunas = programações do pedido (nº e data).
- **Célula:** ocupação do container naquela programação = soma das caixas dos produtos do pedido dentro dele (CBM das caixas ÷ CBM do container), para baixo, como nos cartões das programações ("<1%" para quase nada). Cores: verde a partir de 95% (cheio), âmbar de 60%, cinza abaixo.
- **Conta (`src/lib/container-composition.ts`):** por programação, os produtos enchem os containers na ordem das linhas do formulário, em caixas master inteiras; a caixa que não cabe no que sobra vai para o container seguinte. Container de referência = o escolhido (20GP, 40GP, 40HC) na 1ª linha de produto; se outra linha escolheu outro, a tela avisa.
- **Linhas fechadas ao abrir**; "▸ Container N" abre a linha e mostra, por produto, a ocupação dele naquele container e as caixas.
- Produto sem caixa master ou CBM no cadastro, ou com a caixa maior que o container, fica fora da conta e é listado embaixo.
- **Fixo na lateral:** a composição e o histórico ficam juntos num painel `sticky` (abaixo da barra do topo, `z-index` 20) que acompanha a rolagem da página nas telas grandes; no celular e no iPad em pé, ficam depois do formulário.

## 9. Terceira rodada (dono, 15/11/2026): o que mudou

Esta seção vale por cima das anteriores onde elas divergem.

### 9.1 Condições no formulário do vendedor

- **Tipo de operação:** hoje só **TS** (já marcado); **Venda** aparece desabilitada "(em breve)". O servidor recusa Venda (`order_terms_operation_disabled`).
- **País de origem:** com TS, **BRASIL** aparece desabilitado "(não vale no TS)" e o servidor recusa (`order_terms_country_disabled`). Produto sem país continua fora da lista.
- **Re-despacho:** deixou de ser uma transportadora; é **Sim/Não** obrigatório. Com Sim, quem informa a transportadora é o cliente, na confirmação (9.3).
- **Transportador:** continua obrigatório (portal + Sankhya).
- **Grupo de produto = família**, um nível acima da linha: o **grupo pai da linha no Sankhya** (`TGFGRU.CODGRUPAI`, nome em `DESCRGRUPOPROD`). Ex.: 70106001 "CJ COPOS" fica na família do grupo pai de 70106…. O portal só tinha o último nível (as linhas), então o pai e o nome vêm do Sankhya **pela API** (`SELECT TOP 2000 CODGRUPOPROD, DESCRGRUPOPROD, CODGRUPAI FROM TGFGRU …`, em páginas, 30 minutos em memória; `src/lib/services/sankhya-product-families.ts`). Chave da família: `sk:<CODGRUPAI>`. Linha sem código do Sankhya, sem pai ou com o Sankhya fora: a própria linha vale como família (`ln:<id da linha>`). A busca de produto filtra pelas linhas da família e pelo país; o servidor recusa produto de outra família ou país (`order_terms_mismatch`).
- **Aviso "sem devoluções"** saiu do formulário do vendedor (fica uma nota: "depois do envio, o cliente confirma…").
- **Login do cliente com acesso** passou a ser **obrigatório** na venda (`access_required`): é ele quem confirma. Cliente sem login ganha um em Cadastros antes.
- **Contatos do cliente** seguem obrigatórios para enviar (concluir a venda); o rascunho guarda sem conferir.

### 9.2 Rascunho

- Botão **"Salvar rascunho"** ao lado de Enviar (só a Wellmix, na venda ao cliente). Grava o formulário como está, **sem conferir nada** (`formNoValidate`): cliente, login, condições, contatos digitados, produtos (produto, variação, textos fora do catálogo, quantidade e programação), prazo e observação. Arquivos não entram.
- **"Seus rascunhos"** no alto da Nova solicitação: título (1º produto + quantos mais), cliente e data; **Continuar** reabre o formulário igual; **Apagar** tira da lista. Só quem criou vê.
- Enviado o pedido a partir de um rascunho, o rascunho some.
- Tabela nova `request_drafts` (`userId`, `customerId`, `customerName`, `title`, `itemCount`, `payload` com os campos `[nome, valor]`). Serviço `src/lib/services/request-drafts.ts`; ações `src/app/app/actions/request-drafts.ts`.

### 9.3 Confirmação do pedido pelo cliente

- A venda pela Wellmix nasce com a situação nova **"Aguardando confirmação do cliente"** (`AWAITING_CUSTOMER`). Enquanto isso **não entra na fila da Wellmix**: não abre o item de Sourcing nem avisa a Wellmix; quem é avisado é o login do cliente ("Confirme o pedido…"). A página da solicitação mostra à Wellmix o aviso de que espera o cliente.
- O **login do cliente com acesso** abre a solicitação e vê o cartão **"Confirme o seu pedido"**: o aviso "sem devoluções" com **"Li e concordo"** obrigatório e, com Re-despacho = Sim, o **CNPJ da transportadora**:
  - **Buscar** consulta o CNPJ na **BrasilAPI** (dados públicos da Receita, sem credencial; `GET /api/cnpj?cnpj=`) e mostra razão social, nome fantasia e endereço;
  - CNPJ com dígitos inválidos: recusado; não encontrado na Receita: recusado;
  - sem a consulta (BrasilAPI fora do ar ou modo memória dos testes): o cliente digita o nome, e a Wellmix é avisada para conferir o cadastro.
- **Confirmar pedido**: todas as solicitações do lote passam a "Solicitado" (entram na fila), com a confirmação gravada em `orderTerms.confirmation` (quando, quem, aviso aceito e a transportadora). A transportadora do re-despacho é a do cadastro com o mesmo CNPJ ou uma **nova** (tipo Transportadora, com os dados da Receita). Auditoria: `request.customer_confirm` e `party.create`.
- Só o login do cliente escolhido confirma, e só uma vez (`confirm_not_allowed`).
- Serviço `src/lib/services/customer-confirmation.ts`; ação `src/app/app/actions/customer-confirmation.ts`; cartão `src/components/customer-order-confirm.tsx`.

### 9.4 Dados (aditivos)

- `requests.status` ganha o valor `AWAITING_CUSTOMER`.
- `requests.orderTerms` ganha `redispatchRequired`, `productFamily`, `productFamilyName` e `confirmation`; os campos da rodada anterior (`redispatch`, `productLineId`, `productLineName`, `noReturnsAccepted`) ficam para as solicitações já gravadas.
- Tabela nova `request_drafts`.

## 10. Em aberto (para o dono)

- **Telefone do representante/vendedor:** o login do portal não tem telefone; a regra "não pode ser igual ao do representante" confere só o e-mail.
- **Carga no banco (outro dia):** o fornecedor de cada produto (`TGFPRO.CODPARCFORN`) e a árvore de grupos (`TGFGRU.CODGRUPAI`), para não depender da leitura pela API.
- **Envio ao Sankhya:** tipo de operação, formato, transportadora e re-despacho ainda não vão para a nota do Sankhya.
- **Venda (tipo de operação):** fica desabilitada até o dono liberar; com ela, BRASIL volta a valer.
