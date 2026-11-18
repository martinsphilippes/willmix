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

- **Tipo de operação:** hoje só **TS** (já marcado); **Venda** aparece desabilitada "(em breve)". O servidor recusa Venda (`order_terms_operation_disabled`). Desde 16/11/2026, a Venda tem tela própria no Produto novo, **Venda - Encomenda**, e o TS também, **TS - Trading Sales**. Nas duas o tipo é fixo pela tela (docs/REQUEST_SCREENS.md); esta tela de Encomendas continua como está.
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

## 10. Quarta rodada (dono, 15/11/2026): família, histórico → pedido e composição

### 10.1 Família

- A família ficou **dois níveis acima da linha** (o avô no Sankhya; o pai ainda era detalhado demais): `FAMILY_LEVELS_UP = 2` em `src/lib/services/product-origin.ts`. Árvore mais rasa: o nível mais alto abaixo do topo.
- **Mesmo nome = mesma família:** grupos do Sankhya com o mesmo nome em ramos diferentes viram uma família só, com todos os produtos deles (antes apareciam vários "iguais"). A chave é o nome sem acento e sem caixa: `fm:<NOME>` (ex.: `fm:UTILIDADES_DOMESTICAS`).

### 10.2 Histórico de compras do cliente → pedido

- **Filtro pela família:** com a família escolhida nas condições do pedido, o histórico (Sankhya: lista de pedidos e visão Produto; portal: pedidos gravados) mostra só os produtos dela, com o aviso "Só os produtos da família escolhida (N de outras famílias não aparecem)". Sem família, todos.
- **Clique no produto = mais um produto no pedido:** o nome do produto do catálogo é clicável ("Acrescentar ao pedido"); ele entra como uma linha nova (no lugar da primeira linha, se ela ainda está vazia), com a ficha e o mínimo dele, e a página rola até a linha. Item sem produto do catálogo (código do Sankhya sem produto no portal) não é clicável.
- **Marca de "já entrou":** produto que já está nas linhas aparece riscado com o check "✓ No pedido".
- Como o histórico sabe o produto e a família: o servidor liga o `CODPROD` de cada item do Sankhya ao produto do portal (`products.sankhyaCode`) e à família (`originsByCode`); no histórico do portal, pelo `productId` do item do pedido.
- Só na venda pela Wellmix; o login do cliente vê o histórico como antes.
- Código: `src/components/history-product-pick.tsx`; o contexto `request-customer-context.tsx` guarda os produtos das linhas e o pedido de acrescentar.

### 10.3 Composição de containers

- Com a linha do container aberta, **clicar no nome do produto leva a página até a linha dele no pedido**, com um destaque rápido.

## 11. Quinta rodada (dono e técnico do Sankhya, 15/11/2026)

### 11.1 Família = 1º nível da árvore

- A API de produtos do Sankhya só traz o último nível do grupo (`codigoGrupoProduto`). A **família é o primeiro nível da árvore** (`TGFGRU.GRAU = 1`). Substitui os critérios das seções 9 e 10 (pai e avô).
- Consulta passada pelo técnico, pelo DbExplorer (`DbExplorerSP.executeQuery`, o mesmo caminho da API de custo), **só produtos ativos**, em páginas de 2 mil pelo `CODPROD`:

```sql
SELECT P.CODPROD, F.CODGRUPOPROD AS COD_FAMILIA, RTRIM(F.DESCRGRUPOPROD) AS FAMILIA
FROM TGFPRO P
JOIN TGFGRU G1 ON G1.CODGRUPOPROD = P.CODGRUPOPROD
LEFT JOIN TGFGRU G2 ON G2.CODGRUPOPROD = G1.CODGRUPAI
LEFT JOIN TGFGRU G3 ON G3.CODGRUPOPROD = G2.CODGRUPAI
LEFT JOIN TGFGRU G4 ON G4.CODGRUPOPROD = G3.CODGRUPAI
JOIN TGFGRU F ON F.CODGRUPOPROD = CASE WHEN G1.GRAU = 1 THEN G1.CODGRUPOPROD
  WHEN G2.GRAU = 1 THEN G2.CODGRUPOPROD WHEN G3.GRAU = 1 THEN G3.CODGRUPOPROD
  ELSE G4.CODGRUPOPROD END
WHERE P.ATIVO = 'S' AND P.CODPROD > <último> ORDER BY P.CODPROD
```

- Exemplo testado pelo técnico: 7429 → 160000000 "CERAMICA"; 21952 → 90000000 "WELLCLEAN".
- Cada produto do portal pega a família pelo seu código do Sankhya (`products.sankhyaCode` = `CODPROD`), guardada 30 minutos (`sankhyaFamiliesByProduct`, em `src/lib/services/sankhya-product-families.ts`). Sem ela (produto sem código, Sankhya fora): a raiz da árvore de grupos da linha; sem a árvore, o nome da linha. Famílias de mesmo nome continuam uma só (`fm:<NOME>`).

### 11.2 Lateral: composição fixa, histórico rola dentro do bloco

- Nas telas grandes, a **Composição de containers fica fixa** no alto da lateral (até 60% da altura, com rolagem própria se passar), e o **Histórico de compras do cliente rola dentro do espaço que sobra** (`data-request-history-scroll`). Ver os produtos ou pedidos mais abaixo no histórico não tira a composição da tela.

### 11.3 Trocar o país ou a família com produtos no pedido

- Com produto do catálogo no pedido, trocar o **país** ou a **família** abre um aviso: "Este pedido já tem produtos do país e da família escolhidos. Recomendamos terminar este pedido assim e começar outro depois…".
- **Manter e terminar este pedido** (o botão em foco): a troca é desfeita, nada muda.
- **Trocar e remover os produtos**: a troca vale e todas as linhas de produto saem (fica uma linha vazia; a composição e as marcas do histórico acompanham).
- Sem produto do catálogo no pedido, a troca é direta, sem aviso.

### 11.4 Histórico com cabeçalho fixo, foto e código Wellmix; resumo do cliente e do transportador (dono, 15/11/2026)

- **Histórico de compras do cliente**: o cabeçalho (título, filtros e abas) fica fixo no topo do bloco e só a lista rola. Cada produto mostra à esquerda a foto principal do cadastro (`products.photoIds[0]`, por `/api/files`; sem foto, um quadro vazio) e o código é o **da Wellmix** (`products.sku`); o código do Sankhya só aparece quando o produto não está no catálogo do portal. A ligação é por `src/lib/services/product-faces.ts` (SKU e foto por id, em lotes de 200).
- **Cliente** (busca no topo): ao escolher, logo abaixo aparece "Código X · Nome" (código do parceiro no Sankhya, `parties.sankhyaCode`; sem ele, "—").
- **Transportador**: um campo de busca filtrava a lista por nome, código (CODPARC) ou CNPJ (saiu em 16/11/2026, seção 11.7), e abaixo do escolhido aparece "Código · CNPJ · Nome". O CNPJ vem de `TGFPAR.CGC_CPF` (Sankhya) ou de `parties.taxId` (portal); o código, de `CODPARC` ou `parties.sankhyaCode`. A lista mostra o código antes do nome.

### 11.5 Seletor de produtos pela lupa (dono, 16/11/2026)

Ao lado da busca de produto de cada linha, uma **lupa** abre o seletor (um só na tela, fora das linhas: acrescentar troca a linha vazia sem fechar o seletor). Só com o país e a família do pedido escolhidos.

- **Filtros**: Grupo, Sub grupo e Coleção do grupo, os três níveis da árvore de grupos do Sankhya logo abaixo da família (TGFGRU, de cima para baixo: família = GRAU 1, Grupo = 2º nível, Sub grupo = 3º, Coleção do grupo = 4º). O grupo de cada produto vem da consulta do técnico (`TGFPRO.CODGRUPOPROD`, coluna `COD_GRUPO`) ou, sem ela, do código da linha; sobe-se na árvore até a família. Mesmo nome no mesmo nível = uma opção só (como a família). Cada filtro mostra só as opções que sobram com os outros (com a contagem), e a lista acompanha; trocar um nível limpa os de baixo.
- **Lista**: tabela paginada (12 por página, por nome) só com Foto (grande, 160 px) e Nome; o código Wellmix e as marcas "No pedido" e "Visto" ficam sob o nome.
- **Acrescentar**: clique na foto ou no nome acrescenta ao pedido e o seletor continua aberto. O seletor à esquerda da foto (e "Selecionar todos desta página") acrescenta vários de uma vez. Produto que já está no pedido não entra de novo.
- **Quantidade padrão** (caixas master desde 16/11/2026, seção 11.9; antes em peças): cada produto acrescentado entra com caixas × peças por caixa, nunca abaixo do pedido mínimo em caixas inteiras; vazia, o pedido mínimo como sempre.
- **Filtro visto**: "Marcar este filtro como visto" guarda a combinação atual (Grupo, Sub grupo, Coleção). As opções mostram "✓ … · visto" quando todos os produtos delas já entraram num filtro visto, ou "n/m vistos"; os produtos ganham a marca "Visto" e o rodapé diz "n de m produtos da família já vistos". Fica no navegador de quem usa (por cliente, país e família), não no banco.
- Leitura: `GET /api/products/browse` (`browseOrigin` em `src/lib/services/product-origin.ts`), para quem busca no catálogo. Nome, SKU e foto vêm do índice de origem (10 minutos).

### 11.6 Quem chama o transportador e a previsão de preço pela cotação V2 (dono, 16/11/2026)

- **Quem chama o transportador?** (Cliente ou Wellmix), ao lado de Re-despacho, é obrigatória. Re-despacho = Sim agora só quer dizer que o pedido tem **duas transportadoras**: a do pedido e a do re-despacho. Quem chama define quem as vincula:
  - **Wellmix**: o vendedor escolhe na solicitação o Transportador (portal ou Sankhya) e, com Sim, também o **Transportador do re-despacho** (`orderTerms.carrier` e `orderTerms.redispatch`). O cliente não informa nenhuma na confirmação.
  - **Cliente**: os campos de transportadora saem da solicitação. Na confirmação, o cliente informa pelo CNPJ a **transportadora do pedido** (`confirmation.carrier`) e, com Sim, a do re-despacho (`confirmation.redispatchCarrier`). Cada CNPJ é buscado na BrasilAPI e cadastrado como Transportadora se ainda não existir.
  - Solicitações antigas (sem `carrierCaller`) seguem como eram: o vendedor escolheu o transportador e o cliente informou o re-despacho.
- **Previsão de preço ao cliente final**: a ida é a cotação de encomenda V2 do Sankhya (`FN_AD_ENC_COTACAO_V2_WELL`, 71 posições; docs/INTEGRATIONS.md item 8). Ela leva:
  - o **VIP** pelo formato: WD = 5; Wellmix pelo nível (Pleno 1, Mega 2, Hiper 3, Ultra 5, Evo 1,42857143, Super 4);
  - a **rota** por quem chama (Cliente → `PORTO_CLIENTE`, Wellmix → `VIA_DEPOSITO`);
  - o **frete de entrega** total das Configurações (padrão R$ 8.000; vazio = pendente);
  - o RCA do cliente como vendedor e a data de hoje.
- A tela mostra o preço do produto, o frete por peça, as referências com frete e WD e o aviso de frete pendente. Também diz o que foi enviado (formato, VIP, rota e frete).

### 11.7 Produtos recolhidos, campos de texto fora e transportador sem busca (dono, 16/11/2026)

- **Produtos no pedido**: ao clicar "+ Adicionar outro produto", os produtos que estavam abertos se recolhem numa tabela **"Produtos no pedido"**, abaixo da ficha nova (e do botão). Cada linha mostra nº, foto, produto (nome da ficha; fora do catálogo, o nome digitado), variação, quantidade, **Preenchimento** (Completo ✓ ou **Incompleto** em âmbar) e as ações **Abrir** e **Remover**. Aberta, a ficha volta ao lugar com tudo o que foi preenchido e tem **Recolher** no título. Recolhida, a ficha continua no formulário (escondida) e vai no envio.
- Produtos acrescentados de uma vez (histórico de compras, seletor pela lupa) entram todos abertos; cada um se recolhe pelo próprio "Recolher". Rascunho com vários produtos: só o último abre.
- **Incompleto** = sem produto escolhido (e não é fora do catálogo), sem quantidade ou com algum campo obrigatório inválido (variação, nome e descrição fora do catálogo, quantidade). A marca aparece também no título da ficha aberta. Ao enviar com uma ficha recolhida incompleta, ela se abre para mostrar o campo.
- **Produto (Nome), Descrição e Especificação** saíram da tela do pedido (sobra da versão anterior), inclusive o quadro só de leitura do produto do catálogo. Os textos da ficha vão escondidos no formulário e o servidor grava os da ficha, como antes; ficha sem descrição usa o nome. **Fora do catálogo** os três campos continuam: não há ficha e eles são a única descrição do que se procura (encomenda B14).
- **Transportador**: saiu o campo "Buscar por nome, código ou CNPJ"; fica só a lista "Escolha o transportador" (com o resumo Código · CNPJ · Nome abaixo). Com Wellmix chamando o transportador e Re-despacho = Sim, abre-se a segunda lista igual, do transportador do re-despacho (como na 11.6).

### 11.8 Previsão automática só com o Preço, valor do transporte e valor total (dono, 16/11/2026)

- **Quadro "Produto do catálogo Wellmix"** saiu da venda da Wellmix. Fica só um aviso para leitor de tela.
- **Previsão de preço ao cliente final**:
  - **Sem o botão Calcular**: com o produto escolhido, a conta roda sozinha. Ela roda de novo (com espera de 0,6 s) sempre que muda algo que vai para a API: quantidade, cliente, formato, nível, quem chama o transportador ou valor do transporte.
  - O quadro verde mostra só o **Preço** e o **Valor total** (preço × quantidade). O Preço é o "Preço com frete (referência)" (`PRECO_COM_FRETE_REFERENCIA`) quando a Wellmix chama o transportador, e o "Preço WD" (`PRECO_WD_REFERENCIA`) quando é o cliente (desde a 11.9: sempre com frete; WD com frete no formato WD).
  - Saíram as demais linhas, a linha "Enviado" e a "Memória de cálculo do Sankhya (auditoria)". Os avisos de frete pendente, erro e modo manual continuam.
- **Valor do transporte (R$)**: um campo logo abaixo do Transportador (quando a Wellmix chama). É o total da entrega, gravado em `orderTerms.deliveryFreightBrl`. Quando preenchido, vai em `@FRETE_ENTREGA_BRL` no lugar do frete padrão das Configurações; vazio, vale o padrão.
- **Valor total** do pedido: ao lado de "Formato de venda", na mesma linha. É a soma do valor total de cada produto, inclusive dos recolhidos em "Produtos no pedido".
- **Informar o preço de venda desejado** (preço máximo de compra): só aparece com "Compra para estoque (sem cliente)". Ao marcar a compra para estoque, o cliente sai da busca, que fica em branco.

### 11.9 Lupa em caixas, produtos recolhidos e preço pelo formato (dono, 16/11/2026)

- **Quantidade padrão da lupa em caixas master**: cada produto entra com caixas × peças por caixa (`masterCartonQty` da ficha), nunca abaixo do pedido mínimo em caixas inteiras. Produto sem peças por caixa não converte: entra com o mínimo e a ficha aberta.
- **Recolhidos**: com a quantidade padrão, os produtos da lupa entram já recolhidos em "Produtos no pedido"; sem ela, abertos como antes. Com todos recolhidos, "+ Adicionar outro produto" abre a ficha nova, que tem a lupa.
- **Correção**: com a ficha do produto demorando (Sankhya), acrescentar dois produtos seguidos pela lupa apagava o primeiro e as linhas ficavam sem a quantidade. As linhas agora são lidas no momento em que a ficha chega.
- **Preço da previsão**: formato **WD** → `PRECO_WD_COM_FRETE_REFERENCIA`; **Wellmix chamando o transportador** (formato Wellmix) → `PRECO_COM_FRETE_REFERENCIA`; formato Wellmix com o cliente chamando → também `PRECO_COM_FRETE_REFERENCIA` (o preço é sempre com frete; sem valor digitado, o frete padrão das Configurações). No formato WD, o **Valor do transporte (R$)** aparece mesmo com o cliente chamando, vai em `@FRETE_ENTREGA_BRL` e é gravado em `orderTerms.deliveryFreightBrl`.

### 11.10 Forma de pagamento e previsão de pagamento (dono, 16/11/2026)

- **Onde**: nas condições do pedido, logo abaixo da linha do **Valor total**. O campo é **Forma de pagamento**, obrigatório na venda ao cliente pela Wellmix, com as formas **ativas** de Configurações → Formas de pagamento do cliente (`/app/settings/payment-plans`), na ordem da lista. A forma com alçada aparece com "(com aprovação por alçada)".
- **Previsão de pagamento**: ao escolher, aparece cada parcela com o percentual, o momento (evento + dias: No pedido, No embarque, Na Presença de Carga, Na entrega) e o valor previsto. O valor é o Valor total do pedido × o percentual, mais os juros compostos ao mês nas parcelas depois da entrega, a mesma conta do pedido (docs/CUSTOMER_PAYMENT.md). Parcela de 0% mostra "sem cobrança". Sem Valor total (produtos sem preço previsto), os valores ficam "—". As datas não aparecem aqui: saem no pedido, quando cada evento acontece.
- **Gravação**: a solicitação guarda uma cópia da forma em `orderTerms.paymentPlan` (id, nome, parcelas, juros e alçada; sem coluna nova). O servidor recusa sem forma ou com forma inativa ou inexistente (`order_terms_payment_plan`). O rascunho guarda a escolha.
- **No pedido**: a seção "Pagamento do cliente" já vem com a forma da solicitação marcada. A escolha que vale, com alçada, vendedor, NUNOTA e boletos, continua sendo feita lá.
- Código: `PaymentPlanField` em `src/components/request-order-terms.tsx`, `resolveRequestPaymentPlan` em `src/lib/services/order-terms.ts`, o tipo `RequestPaymentPlan` em `src/lib/order-terms.ts`.

## 11.11 Sétima rodada (dono, 17/11/2026)

Vale para as três telas (Encomendas, TS e Venda), que usam o mesmo código (`src/app/app/_new-request/new-request-screen.tsx`; as páginas só passam o `mode`).

- **Mais de um contato por área:** no bloco Cliente, o "+" ao lado de Sócio, Comprador, Financeiro e Fiscal e Logística acrescenta mais uma linha de telefone e e-mail (até 5 extras por área), com a lixeira para tirar. O primeiro de cada área continua obrigatório; cada extra acrescentado também precisa de telefone e e-mail válidos e diferentes dos do vendedor. Campos `contact.<área>.<n>.phone|email`; gravados no mesmo JSON `parties.customerContacts`, em `more` (aditivo; o JSON antigo segue valendo).
- **Salvar dados do cliente:** botão no bloco Cliente que grava os contatos na hora, sem enviar o pedido (`saveCustomerContactsAction`, mesmas regras e auditoria do envio). Gravado, o bloco volta para a visão com "Editar".
- **Rascunho automático:** a tela grava o pedido sozinha a cada pausa (digitação, escolha, produto que entra ou sai pela lupa ou pelo histórico), sem recarregar (`autosaveRequestDraftAction`, `src/components/request-draft-autosave.tsx`). Abrir a tela não cria rascunho; o primeiro salvamento cria e põe `?draft=` no endereço, os seguintes gravam por cima. O "Salvar rascunho" continua; o envio apaga o rascunho como antes. Fora da entrada da Reposição (sem rascunho) e do login do cliente.
- O histórico de compras perdeu o texto "Do Sankhya, consultado agora".
- "+ Adicionar outro produto" rola a tela até o produto novo.

## 11.12 Rascunhos nas listas (dono, 17/11/2026)

- **Onde ficam:** além do quadro "Seus rascunhos" na própria tela, os rascunhos aparecem no alto das listas, com a situação **Rascunho** e "Continuar": em **Encomendas** (`/app/requests`) os da Nova solicitação, de TS e de Venda; em **Reposição** (`/app/replenishment`) os da entrada da Reposição (`/app/new-request/sale?from=replenishment`). Só de quem criou, das telas que a pessoa abre (`listDraftsForList`, `draftResumeHref`).
- Em Encomendas, os rascunhos aparecem na primeira página, com qualquer filtro de situação e com o tipo "Todos" ou "Encomenda"; a busca vale pelo título e pelo cliente do rascunho.
- **Entrada da Reposição com rascunho:** antes ela não tinha rascunho. Agora tem o mesmo de sempre ("Salvar rascunho", o automático e a lista no alto), marcado pelo campo `from=replenishment` do formulário; vale para quem abre a fila (ação "Abrir reposição" e tela Encomendas), mesmo sem a tela de Venda. O rascunho da Reposição só abre nessa entrada, e o da Venda comum só na Venda.
- O histórico de compras perdeu a explicação "Pedidos de venda do cliente no Sankhya, do mais recente para o mais antigo…".

## 11.13 Rascunho reaberto sem os produtos (dono, 18/11/2026)

- **O que acontecia:** ao reabrir um rascunho, a leitura dos produtos era a mesma do envio (estrita). Bastava um campo incompleto numa linha (a programação gerada com uma data ainda sem quantidade, por exemplo) para a tela descartar todos os produtos. Em seguida, o rascunho automático gravava a tela vazia por cima.
- **Agora:** o rascunho volta como foi salvo (`parseRequestItems(form, { lenient: true })` e `parseRequestSchedule(..., { draft: true })`): a quantidade em branco ou inválida da programação vira zero, e a programação que não dá para ler (ou é de outro produto) sai só daquela linha. O envio continua estrito.
- **O rascunho automático só grava depois de uma ação da pessoa na tela** (tecla, clique ou toque). Abrir um rascunho, com a tela se completando sozinha, nunca grava por cima.
- **Quem vê o rascunho:** só quem criou (listar, abrir, gravar por cima e apagar conferem o login).

## 11.14 Contatos opcionais para a equipe interna (dono, 18/11/2026)

- Quando o Solicitante está na Equipe Interna (a lista de `/app/team`: login ativo de administrador ou operador da Wellmix), os contatos do bloco Cliente são **opcionais**: o pedido sai sem eles. O bloco continua na tela, com o aviso "Opcional para a equipe interna", e pode ser preenchido e salvo ("Salvar dados do cliente").
- O que for preenchido continua conferido (telefone e e-mail válidos, diferentes dos do vendedor); um contato todo em branco fica de fora, e um meio preenchido é cobrado. Tudo em branco não grava nada.
- Quem não está na equipe (um representante externo, quando houver) segue com todos os contatos obrigatórios, como antes.
- Código: `contactsOptionalFor` (src/lib/services/customer-contacts.ts) e `contactIssues(..., { optional })` (src/lib/order-terms.ts).

## 11.15 Todos os logins do cliente e o valor do transporte (dono, 18/11/2026)

- **Login do cliente com acesso não se escolhe mais** na Nova solicitação (Encomendas, TS e Venda): o campo só mostra "Todos os logins do cliente (N)". A venda da Wellmix sem login escolhido (`requestedForUserId` nulo, com as condições do pedido) vai para **todos os logins daquele cliente**: qualquer um vê a solicitação, confirma o pedido e recebe o aviso de confirmar (`forAllCustomerLogins` em src/lib/auth/permissions.ts, `canConfirm` e `notifyCustomerToConfirm`). As solicitações antigas sem as condições do pedido e as com um login escolhido seguem como antes. O pedido (depois da confirmação) segue a regra de antes para o cliente.
- **Valor do transporte (R$) também quando o cliente chama o transportador:** só a escolha da transportadora sai; o valor aparece, entra na previsão de preço e é gravado em `orderTerms.deliveryFreightBrl` (antes, só quando a Wellmix chamava ou no formato WD).

## 12. Em aberto (para o dono)

- **Telefone do representante/vendedor:** o login do portal não tem telefone; a regra "não pode ser igual ao do representante" confere só o e-mail.
- **Carga no banco (outro dia):** o fornecedor de cada produto (`TGFPRO.CODPARCFORN`) e a família de cada produto (a consulta da seção 11.1), para não depender da leitura pela API.
- **Envio ao Sankhya:** tipo de operação, formato, transportadora e re-despacho ainda não vão para a nota do Sankhya.
- **Venda (tipo de operação):** fica desabilitada até o dono liberar; com ela, BRASIL volta a valer.
