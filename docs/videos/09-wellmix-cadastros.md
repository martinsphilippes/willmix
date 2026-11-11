# Série WCA · Wellmix, os cadastros

Vídeos para quem cuida dos cadastros da Wellmix: o administrador (`admin@wellmix.com`, Ana Admin, tela em pt) e o operador com as funções que abrem o menu **Cadastros** (`operador@wellmix.com`, Otávio Operador, funções comprador e planner). O menu **Cadastros** reúne **Clientes**, **Fornecedores**, **Outros parceiros**, **Produtos**, **Estoque**, **Linhas** e **Vitrine do cliente** (a prévia da vitrine, como o cliente a vê). A tela **Importação de cadastros** (rota `/app/import`, chamada "Importar planilha" na matriz de acessos) só abre para a função "cadastro", as diretorias e o administrador e **não tem item no menu**: chega-se a ela pelos botões **Importar CSV** de Produtos e de Outros parceiros (WCA-04).

O que esse papel **não** vê: o cliente nunca vê o fornecedor, o FOB nem a margem; o fornecedor nunca vê o cliente nem o preço de venda; e, entre os logins da Wellmix, **os valores financeiros só aparecem para quem abre Finanças** (o administrador, ou quem ele liberar tela a tela em Gestão → Equipe e divisões). Nas telas de Cadastros isso vira uma regra visível: sem Finanças, os cartões de dinheiro de Clientes e Fornecedores somem e a tela avisa "Valores só para quem tem acesso a Finanças." (docs/ACCESS.md, regra 3; docs/CUSTOMERS.md, regra 6).

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade) e o episódio-modelo [02-cliente.md](02-cliente.md). Os episódios seguem o modelo da seção 5 do guia. Documentos lidos para esta série: `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/ACCESS.md`, `docs/CUSTOMERS.md`, `docs/ARQUITETURA.md` (seção 5, "Acesso ao portal" e "Login sem e-mail"), `docs/PRODUCT_VARIANTS.md`, `docs/INVENTORY.md`, `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/OPEN_DECISIONS.md` e `docs/EVOLUTION_PLAN.md`, mais o código das telas de Cadastros e os dicionários pt.

### Quem abre o quê (use sempre `[QUEM VÊ]` com esta tabela; docs/ACCESS.md, seção 4, conferida com `src/lib/auth/screens.ts`)

| Item do menu Cadastros                | Tela do sistema | Administrador | Comprador | Ger. produto | Planner | Cadastro | Diretorias | Designer |
| ------------------------------------- | --------------- | :-----------: | :-------: | :----------: | :-----: | :------: | :--------: | :------: |
| Clientes, Fornecedores, Outros parceiros | Cadastros      |       ✓       |     ✓     |              |         |    ✓     |     ✓      |          |
| Produtos e Estoque (e Importar ficha técnica) | Produtos  |       ✓       |     ✓     |      ✓       |         |    ✓     |     ✓      |    ✓     |
| Linhas                                | Linhas          |       ✓       |           |      ✓       |         |    ✓     |     ✓      |          |
| Vitrine do cliente                    | Vitrine do cliente |    ✓       |           |      ✓       |         |    ✓     |     ✓      |    ✓     |
| Importação de cadastros (CSV, sem item de menu) | Importar planilha |  ✓ |           |              |         |    ✓     |     ✓      |          |
| Valores em R$ (cartões e colunas de dinheiro) | Finanças |       ✓       |           |              |         |          |            |          |

Na gravação, o operador de demonstração (comprador e planner) abre Clientes, Fornecedores, Outros parceiros, Produtos e Estoque, e **não** vê Linhas nem Vitrine do cliente. Para mostrar a função "cadastro", use um login da Wellmix com essa função marcada pelo administrador em Gestão → Equipe e divisões → "Editar acessos" (docs/ACCESS.md; ver a seção 7.5 do guia).

| ID      | Episódio                                              | Duração-alvo | Situação     |
| ------- | ----------------------------------------------------- | ------------ | ------------ |
| WCA-01  | Clientes e fornecedores: a ficha e a conta            | 5:30         | roteirizado  |
| WCA-02  | Dar acesso ao portal: criar o login de um parceiro    | 5:05         | roteirizado  |
| WCA-03  | Produtos: a ficha, as fotos e as variações            | 5:30         | roteirizado  |
| WCA-04  | Importar a ficha técnica (planilha) e o CSV           | 5:15         | roteirizado  |
| WCA-05  | Linhas de produto                                     | 3:40         | roteirizado  |
| WCA-06  | A vitrine como o cliente vê                           | 3:30         | roteirizado  |

**Recursos em espera ou manuais que aparecem nas telas desta série (guia, seção 7.5; não apresente como ao vivo):** Sourcing (o cartão "Visitas" do fornecedor tem o botão "Sourcing (em espera)"); RFQ com vários fornecedores (em espera, docs/RFQ_STANDBY.md); CODPROD do Sankhya (digitado, "não conferido" sem credencial); "Sugestão por foto (IA)" (mostra o aviso de IA não configurada); e-mail e WhatsApp (mock: nenhum login ou aviso desta série sai por e-mail).

**Fora desta série:** Estoque (`/app/inventory`, docs/INVENTORY.md) tem tela própria, mas não faz parte dos seis episódios pedidos; ver "Pontos a confirmar" do WCA-03.

---
## WCA-01 · Clientes e fornecedores: a ficha e a conta

> **Promessa:** ao final do vídeo você sabe achar um cliente ou um fornecedor, ler a conta dele (contrato, pago e o que falta), abrir a ficha com as abas e o pedido em lista, e consultar a avaliação dos fornecedores.

| Ficha                 |                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, cadastros (administrador; o operador comprador aparece só na cena 5)                                                                                                         |
| Conta de gravação     | `admin@wellmix.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa); `operador@wellmix.com` na cena 5                                                                |
| Duração-alvo          | 5:30                                                                                                                                                                                  |
| Ponto da jornada      | Base de todas as etapas: Cadastros não é uma etapa da jornada (ver "Pontos a confirmar" sobre o `[MAPA]`)                                                                              |
| Telas e rotas         | `/app/customers`, `/app/customers/[id]`, `/app/customers/[id]/orders/[orderId]`, `/app/customers/export`, `/app/suppliers`, `/app/suppliers/[id]`, `/app/suppliers/scorecard`, `/app/parties/[id]` |
| Dados antes de gravar | A Jornada da Jarra gravada até o sinal confirmado: o pedido nº 1 da **Loja do João Ltda** com **Shenzhen Supplier A** (Jarra de vidro 1,5 L), para os cartões e as abas terem valores (ponto de salvamento `antes-WCA-01`) |
| Depois deste vídeo    | Nada muda, é leitura. A única escrita é "Ativar marcados"/"Desativar marcados" (cena 8), que vai para a auditoria; nada é apagado                                                      |
| Antes · Próximo       | abre a série · WCA-02                                                                                                                                                                 |
| Idiomas               | pt (base)                                                                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/customers`**

- 🎬 Imagem: a tela **Clientes** com os cinco cartões coloridos no alto (Valor do contrato, Entregue, Pagamento antecipado, A receber, Recebido) e a linha da Loja do João Ltda com a conta dela. O cursor passa sobre os cartões.
- 🎙 Narração: "Quanto cada cliente contratou, pagou e ainda deve? Está tudo na tela Clientes, e os fornecedores seguem o mesmo desenho."
- 🔤 Na tela: `[TÍTULO]` "WCA-01 · Clientes e fornecedores: a ficha e a conta"; `[ZOOM 150 %]` nos cinco cartões.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou · `/app/customers`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Cadastros não é uma etapa: é a base de todas elas. Aqui você cuida de quem compra e de quem vende."
- 🔤 Na tela: `[MAPA]` com as nove etapas apagadas e uma faixa "Cadastros: a base" sob elas (ver "Pontos a confirmar").
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:40 · Abrir a tela · menu → `/app/customers`**

- 🎬 Imagem: o cursor abre o menu **Cadastros** e mostra os sete itens (Clientes, Fornecedores, Outros parceiros, Produtos, Estoque, Linhas, Vitrine do cliente). Clica em **Clientes**.
- 🎙 Narração: "No menu, abra Cadastros e clique em Clientes. Se o seu login não vê esse item, peça ao administrador: ele libera por função."
- 🔤 Na tela: `[PASSO 1/9] Abra Cadastros → Clientes`; `[QUEM VÊ]` "Administrador, comprador, cadastro e diretorias".
- ✂️ Edição: clique com onda de destaque; o menu fica aberto 2 s para a leitura.

**Cena 4 · 0:40–1:12 · Os cinco cartões · `/app/customers`**

- 🎬 Imagem: o cursor para sobre cada cartão, na ordem. Aparecem os valores da Loja do João (contrato, pagamento antecipado, a receber, recebido; "Entregue" ainda em zero, porque o pedido não foi entregue).
- 🎙 Narração: "No alto, cinco cartões somam a conta dos clientes da lista. Valor do contrato é a venda dos pedidos não cancelados. Entregue é o que já chegou. Pagamento antecipado é o que ele pagou antes da entrega, sinal incluído. A receber é o que falta. Recebido é tudo o que entrou."
- 🔤 Na tela: `[PASSO 2/9] Leia os cinco cartões`; `[SETA]` em cada cartão com a frase curta do dicionário ("Venda dos pedidos não cancelados.", "Venda dos pedidos já entregues ou encerrados.", "Recebido de pedidos ainda não entregues, mais o sinal pago na solicitação.", "Venda menos o que já foi recebido.", "Tudo o que entrou, inclusive o sinal.").
- ✂️ Edição: `[ZOOM 150 %]` em cada cartão por 3 s; não cite os valores na narração, só mostre.

**Cena 5 · 1:12–1:32 · Só quem abre Finanças vê dinheiro · `/app/customers`**

- 🎬 Imagem: corte para o login do operador (`operador@wellmix.com`) abrindo a mesma tela: os cartões e as colunas de valor somem e no lugar aparece o texto "Valores só para quem tem acesso a Finanças.". Volta para o administrador.
- 🎙 Narração: "Atenção: os valores só aparecem para quem abre Finanças, ou seja, o administrador. Para os outros logins, os cartões somem. Real e dólar nunca são somados."
- 🔤 Na tela: `[QUEM VÊ]` "Valores: só Finanças (administrador)"; `[ATENÇÃO]` "Cada moeda fica separada: real e dólar nunca são somados".
- ✂️ Edição: `[CORTE]` seco entre os perfis; o texto do aviso fica 2 s em `[ZOOM 150 %]`.

**Cena 6 · 1:32–1:55 · Busca e filtro · `/app/customers`**

- 🎬 Imagem: no campo "Buscar por nome, CNPJ, telefone, e-mail ou cidade" digitar "joão"; a lista filtra enquanto se digita; clicar em **Buscar**. Passar pelos três filtros **Ativos**, **Inativos** e **Todos**; o ativo está em vermelho.
- 🎙 Narração: "Procure por nome, CNPJ, telefone, e-mail ou cidade e clique em Buscar. Os filtros Ativos, Inativos e Todos separam os grupos. Por padrão, só os ativos aparecem."
- 🔤 Na tela: `[PASSO 3/9] Busque e filtre`; `[BOTÃO] "Buscar"`; `[DICA]` "Sumiu um cliente? Olhe em Inativos ou em Todos."
- ✂️ Edição: digitação em tempo real; o resultado aparece no endereço da página (mostre a barra de endereço por 1 s).

**Cena 7 · 1:55–2:25 · A linha e os atalhos · `/app/customers`**

- 🎬 Imagem: o cursor percorre a linha: nome, selo "Via trade" (modalidade de operação), telefone e e-mail, pedidos ("1" e "1 em andamento") e a conta. No fim da linha, passa por quatro ícones, parando 2 s em cada um para mostrar a dica (tooltip).
- 🎙 Narração: "Cada linha traz o cliente, o contato, quantos pedidos ele tem e a conta dele. No fim ficam quatro atalhos: nova solicitação para este cliente, abrir a ficha, editar o cadastro e conversar com ele."
- 🔤 Na tela: `[PASSO 4/9] Use os atalhos da linha`; `[SETA]` nos ícones com os textos "Nova solicitação para este cliente", "Abrir a ficha do cliente", "Editar o cadastro", "Conversar com este cliente".
- ✂️ Edição: os ícones não têm texto; o tooltip tem de aparecer na gravação (pausa de 1 s sobre cada ícone).

**Cena 8 · 2:25–2:55 · Operação em lote e CSV · `/app/customers`**

- 🎬 Imagem: marcar a caixa de um cliente e clicar em **Desativar marcados**: aparece "1 cliente(s) atualizado(s)." Mostrar o filtro **Todos** com o cliente esmaecido e o selo "Inativo"; marcar de novo e clicar em **Ativar marcados**. Clicar em **Exportar a lista (CSV)** e mostrar o arquivo baixado.
- 🎙 Narração: "Para mexer em vários de uma vez, marque as caixas e use Ativar marcados ou Desativar marcados. Nada é apagado: a mudança vai para a auditoria. Exportar a lista em CSV leva a tabela para a planilha."
- 🔤 Na tela: `[PASSO 5/9] Ative ou desative em lote`; `[BOTÃO] "Desativar marcados"`; `[BOTÃO] "Ativar marcados"`; `[BOTÃO] "Exportar a lista (CSV)"`; `[ATENÇÃO]` "Nada é apagado; vai para a auditoria"; `[ERRO COMUM]` "Marque ao menos um cliente."
- ✂️ Edição: no [ERRO COMUM], clicar no botão sem marcar nada (a mensagem aparece em verde ou vermelho no alto da lista).

**Cena 9 · 2:55–3:25 · A ficha do cliente · `/app/customers/[id]`**

- 🎬 Imagem: clicar no nome "Loja do João Ltda". A ficha abre com o cartão **Contas a receber** (a barra colorida com as cinco partes) e as três abas **Registros de vendas**, **Recebimentos** e **Informações do cliente**. No alto à direita, o botão **Editar cadastro**.
- 🎙 Narração: "Clique no nome para abrir a ficha. No alto, a barra Contas a receber repete as cinco partes só para este cliente. Embaixo, três abas: Registros de vendas, Recebimentos e Informações do cliente."
- 🔤 Na tela: `[PASSO 6/9] Abra a ficha`; `[SETA]` "A conta só deste cliente" na barra; `[BOTÃO] "Editar cadastro"`.
- ✂️ Edição: `[ZOOM 150 %]` na barra de contas.

**Cena 10 · 3:25–3:55 · Registros de vendas e Recebimentos · `/app/customers/[id]`**

- 🎬 Imagem: na aba **Registros de vendas**, uma linha: pedido "#1", data, produto "Jarra de vidro 1,5 L", valor do contrato, entregue, a receber, recebido, o selo de recebimento ("Parcial") e a entrega ("Em andamento", com a etapa embaixo). Mostrar os botões **Registrar recebimento**, **Só entregues** e **+ Nova solicitação**. Abrir a aba **Recebimentos**: a linha do sinal, com valor, forma, a situação "Confirmado" e o comprovante.
- 🎙 Narração: "Em Registros de vendas, cada pedido é uma linha, com o recebimento e a entrega. Em Recebimentos aparece cada pagamento, inclusive o sinal da solicitação, com a forma e o comprovante."
- 🔤 Na tela: `[PASSO 7/9] Confira vendas e recebimentos`; `[SETA]` "Parcial: já entrou o sinal, falta o resto" no selo; `[BOTÃO] "Registrar recebimento"` com a nota "abre o pedido mais antigo com saldo".
- ✂️ Edição: o botão "Registrar recebimento" só aparece para quem abre Finanças e quando há saldo; não clique nele neste vídeo (o recebimento tem episódio próprio).

**Cena 11 · 3:55–4:20 · O pedido em lista · `/app/customers/[id]/orders/[orderId]`**

- 🎬 Imagem: clicar em "#1". Abre **Pedido de venda #1**: o cabeçalho (data da venda, embarque, entrega, situação, analista, endereço de entrega, valor do contrato), a tabela **Informações do pedido** com uma linha por produto e a linha **Total**, a tabela **Informações de recebimento**, as caixas **Observações** e **Anexos**. Passar pelos botões **Voltar ao cliente**, **Exportar (CSV)**, **Imprimir**, **Registrar recebimento** e **Abrir pedido completo**.
- 🎙 Narração: "Clique no número do pedido para vê-lo em lista: um produto por linha, recebimentos, observações e anexos. É só leitura. Para mexer no pedido, use Abrir pedido completo."
- 🔤 Na tela: `[PASSO 8/9] Abra o pedido em lista`; `[BOTÃO] "Abrir pedido completo"`; `[QUEM VÊ]` "Valores: só Finanças".
- ✂️ Edição: `[ZOOM 150 %]` na linha da jarra e na linha de Total; manter 3 s.

**Cena 12 · 4:20–4:50 · Fornecedores: o mesmo desenho, do lado da compra · `/app/suppliers`**

- 🎬 Imagem: menu Cadastros → **Fornecedores**. Os cartões trocam de nome: **Valor do contrato**, **Mercadoria entregue**, **Pagamento antecipado**, **A pagar**, **Pago** (em dólar, FOB). Abrir "Shenzhen Supplier A": subtítulo "Avaliação: A (100)", barra **Contas a pagar**, abas **Registros de compras**, **Pagamentos** e **Informações do fornecedor** (nº da loja, condição de pagamento, dados bancários, logins da empresa). Mostrar os botões **Registrar pagamento**, **Só embarcados** e **+ Nova compra**.
- 🎙 Narração: "Em Fornecedores a tela é a mesma, do lado da compra: contrato em FOB, mercadoria entregue no embarque, a pagar e pago. Na aba de informações ficam o nº da loja, a condição de pagamento e os dados bancários."
- 🔤 Na tela: `[PASSO 9/9] Veja o fornecedor`; `[SETA]` "FOB na moeda do fornecedor" no cartão de contrato; `[SETA]` "Condição de pagamento" no texto da aba, que mostra "30% na data do pedido + 70% 90 dias após a entrega ao cliente" (a condição de Shenzhen Supplier A vem assim da carga).
- ✂️ Edição: não clique em "Registrar pagamento" nem em "+ Nova compra" (têm episódios próprios); a condição de pagamento se edita em `/app/parties/[id]` (só o administrador, cena 13).

**Cena 13 · 4:50–5:12 · Avaliação e condição de pagamento · `/app/suppliers/scorecard`, `/app/parties/[id]`**

- 🎬 Imagem: voltar à lista de Fornecedores e clicar em **Avaliação**. A tabela mostra, por fornecedor, a nota (letra e número) e as colunas Prazo (ETD), 1ª inspeção, Recebimento, Arte, Cotações e Pedidos; a legenda embaixo ("A: 90 ou mais · B: 75 a 89 · C: 60 a 74 · D: abaixo de 60"). Clicar em um fornecedor e, na ficha, em **Editar cadastro**: o cartão "Condição de pagamento ao fornecedor" aparece só para o administrador.
- 🎙 Narração: "O botão Avaliação mostra a nota de cada fornecedor, de zero a cem, por prazo, inspeção, recebimento, arte e cotações. Só a Wellmix vê. A condição de pagamento é do administrador."
- 🔤 Na tela: `[BOTÃO] "Avaliação"`; `[SETA]` "Sem dados ainda: sem nota" na linha de um fornecedor novo; `[QUEM VÊ]` "Nota e condição de pagamento: só a Wellmix; condição: só o administrador".
- ✂️ Edição: a nota de quem acabou de receber o primeiro pedido pode aparecer alta com pouco dado; mostre a tela sem comentar o número (ver "Pontos a confirmar").

**Cena 14 · 5:12–5:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WCA-02.
- 🎙 Narração: "Resumindo: busque, leia a conta, abra a ficha e o pedido em lista, e confira a nota do fornecedor. No próximo vídeo, veja como dar acesso ao portal a um parceiro."
- 🔤 Na tela: `[RESUMO]` "1 Cadastros → Clientes ou Fornecedores · 2 Cinco cartões e busca · 3 Ficha com três abas · 4 Pedido em lista · 5 Avaliação"; chamada "Próximo: WCA-02 · Dar acesso ao portal".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** marcar nada e clicar em "Ativar marcados" ou "Desativar marcados". A tela mostra "Marque ao menos um cliente." (na lista de fornecedores, "Marque ao menos um fornecedor.") → **Correção:** marque as caixas das linhas antes de clicar.
- **Erro:** "cadastrei a empresa e ela não aparece". A lista abre no filtro **Ativos** e um cadastro novo nasce **inativo** (ver "Pontos a confirmar"); a tela mostra "Nenhum cliente encontrado." (ou "Nenhum fornecedor encontrado.") → **Correção:** clique em **Inativos** ou **Todos**, abra o cadastro e marque "Situação: Sim" (WCA-02, cena 5).
- **Erro:** esperar ver dinheiro na tela. Sem Finanças, a tela mostra "Valores só para quem tem acesso a Finanças." e os cartões não aparecem → **Correção:** peça ao administrador; só ele (ou quem ele liberar em Gestão → Equipe e divisões) abre Finanças.
- **Aviso:** login sem a tela Cadastros ao tentar abrir `/app/customers` volta ao início com "Você não tem acesso a {tela}. Peça ao administrador em Gestão → Equipe e divisões." (o nome da tela sai do dicionário; ver "Pontos a confirmar") → **Correção:** o administrador marca a função (comprador, cadastro ou diretoria) ou a tela.

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Clientes** (ou **Fornecedores**).
2. Leia os cinco cartões do alto: **Valor do contrato**, **Entregue**, **Pagamento antecipado**, **A receber** e **Recebido** (em Fornecedores: **Mercadoria entregue**, **A pagar** e **Pago**). Eles somam todos os cadastros da lista, cada moeda à parte. Só quem abre Finanças vê os valores.
3. Digite no campo de busca (nome, CNPJ, telefone, e-mail ou cidade) e clique em **Buscar**. Troque entre **Ativos**, **Inativos** e **Todos**.
4. Na linha, use os atalhos: nova solicitação para este cliente, abrir a ficha, editar o cadastro e conversar.
5. Para vários de uma vez, marque as caixas e clique em **Ativar marcados** ou **Desativar marcados**. Nada é apagado. **Exportar a lista (CSV)** baixa a tabela.
6. Clique no nome para abrir a ficha: barra **Contas a receber** e as abas **Registros de vendas**, **Recebimentos** e **Informações do cliente**.
7. Em **Registros de vendas**, clique no número do pedido para abrir o **Pedido de venda** em lista (só leitura). **Abrir pedido completo** leva ao pedido de verdade.
8. Em **Fornecedores**, a ficha mostra **Registros de compras**, **Pagamentos** e **Informações do fornecedor** (nº da loja, condição de pagamento e dados bancários).
9. O botão **Avaliação** abre a nota dos fornecedores (A a D). A condição de pagamento ao fornecedor se edita em **Editar cadastro**, e só o administrador a vê.

### Notas de gravação

- Prepare o ponto de salvamento `antes-WCA-01` (guia, seção 7.2) com o pedido nº 1 da Loja do João já nascido (sinal confirmado). Sem pedido, os cartões ficam em R$ 0,00 e as abas, vazias ("Nenhum pedido deste cliente.", "Nenhum recebimento lançado.").
- Valores e datas mudam conforme o cenário; não os cite na narração, só mostre. "Entregue" fica em zero até o pedido ser entregue.
- Os atalhos da linha são só ícones: grave a pausa de 1 s sobre cada um para o texto da dica aparecer.
- Cena 5: abra o operador em outro perfil do Chrome já logado; não use o seletor DEMO (guia, seção 7.3).
- Cena 13: a condição de pagamento de Shenzhen Supplier A vem da carga (30% no pedido e 70% 90 dias após a entrega, guia, seção 7.5). O cartão "Condição de pagamento ao fornecedor" só existe no cadastro (`/app/parties/[id]`), para o administrador.
- "Desativar marcados" muda o cadastro de verdade. A carga só tem um cliente (Loja do João): na cena 8, desative e ative de novo na mesma tomada (ou crie antes um cliente de teste) e restaure o ponto de salvamento se repetir.

### Pontos a confirmar

- ⚠ `[MAPA]`: Cadastros não é uma das nove etapas (guia, seção 6.1). Decidir se o mapa dos episódios WCA-01, WCA-02 e WCA-05 mostra as nove etapas apagadas com a faixa "Cadastros: a base", como sugerido, ou fica de fora.
- ⚠ Um cadastro novo (Novo cliente, Novo fornecedor, Novo parceiro) nasce **Inativo**: o formulário de criação não tem a caixa "Situação" e o servidor grava `active = false` quando ela não vem. Foi visto na tela (build atual). Confirmar com o dono se é intencional; o roteiro ensina a ativar (WCA-02, cena 5).
- ⚠ A mensagem de acesso negado usa o nome da tela do sistema: para Cadastros, o dicionário `nav.parties` ("Parceiros"), e não "Clientes" ou "Fornecedores". Não conferido na tela (só lido no código, `SCREEN_LABEL`).
- ⚠ O botão "Conta corrente" do cadastro do fornecedor leva a `/app/account`, tela só do administrador: o operador (comprador) vê o botão, clica e volta ao início com "Você não tem acesso a Conta corrente…". Visto na tela.
- ⚠ A nota de um fornecedor com um único pedido recém-nascido já sai "A (100)" (critérios Arte e Cotações com dados, sem problema registrado ainda). Para o vídeo, mostre a tela sem explicar o número; confirmar se é o desejado.
- ⚠ `Entregue` e `Mercadoria entregue` só saem de zero quando o pedido chega às etapas do dicionário (docs/CUSTOMERS.md, regras 2 e 1 de Fornecedores); o vídeo não mostra isso acontecendo.

---
## WCA-02 · Dar acesso ao portal: criar o login de um parceiro

> **Promessa:** ao final do vídeo você sabe cadastrar uma empresa nova, criar o login dela dentro do cadastro, copiar login e senha para mandar à pessoa e entende o que cada tipo de parceiro passa a ver.

| Ficha                 |                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, cadastros                                                                                                                                           |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; na cena 11 a pessoa nova entra em outro perfil do Chrome (o login criado na própria gravação)                                |
| Duração-alvo          | 5:05                                                                                                                                                         |
| Ponto da jornada      | Base de todas as etapas (como no WCA-01); a pessoa que ganha o acesso é quem faz a etapa dela na jornada (fornecedor, agência, despachante…)                  |
| Telas e rotas         | `/app/suppliers`, `/app/parties/new?type=supplier`, `/app/parties/[id]` (âncora `#access`, quadro "Usuários"), `/app/parties` (Outros parceiros), `/login`   |
| Dados antes de gravar | A carga de demonstração (3 fornecedores, 1 cliente e os parceiros). **Nenhum** fornecedor chamado "Yiwu Glass Factory" (ponto de salvamento `antes-WCA-02`)  |
| Depois deste vídeo    | A empresa existe e tem um login ativo preso a ela. A pessoa entra em `/login` com o login e a senha que a Wellmix mandar. Nada é avisado por e-mail: a Wellmix passa os dados por fora. A criação vai para a auditoria (`user.create`) |
| Antes · Próximo       | WCA-01 · WCA-03                                                                                                                                              |
| Idiomas               | pt (base)                                                                                                                                                    |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/parties/[id]#access`**

- 🎬 Imagem: o quadro **Usuários** de um cadastro, com o aviso verde "Acesso criado e preso a Yiwu Glass Factory. Login: yiwu.glass.factory. Passe para a pessoa o endereço do portal, o login e a senha." O cursor repousa sobre o aviso.
- 🎙 Narração: "Como um fornecedor novo entra no portal? A Wellmix cria o login dele, dentro do cadastro, em menos de um minuto."
- 🔤 Na tela: `[TÍTULO]` "WCA-02 · Dar acesso ao portal"; `[ZOOM 150 %]` no aviso verde.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:25 · A regra · `/app/parties/[id]`**

- 🎬 Imagem: o cadastro da Shenzhen Supplier A: o cartão **Perfil** (quadro "Acesso ao portal" com o login) e o texto "O acesso criado aqui fica preso a Shenzhen Supplier A: a pessoa entra e vê só o que é deste cadastro."
- 🎙 Narração: "Ninguém entra sozinho. A Wellmix cria o acesso dentro do cadastro da empresa, e a pessoa vê só o que é daquela empresa."
- 🔤 Na tela: `[MAPA]` com a faixa "Cadastros: a base" (como no WCA-01); `[SETA]` "Preso ao cadastro" no texto do quadro; `[QUEM VÊ]` "Quem cria acessos: administrador, comprador, cadastro e diretorias".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:25–0:45 · Novo fornecedor · menu → `/app/suppliers` → `/app/parties/new?type=supplier`**

- 🎬 Imagem: menu **Cadastros → Fornecedores**; clicar em **+ Novo fornecedor**. Abre **Novo parceiro** com o campo "Tipo" já em "Fornecedor". Mostrar de passagem que em Clientes o botão é "+ Novo cliente".
- 🎙 Narração: "Vamos cadastrar uma fábrica nova. Em Cadastros, abra Fornecedores e clique em Novo fornecedor. O tipo já vem escolhido. Em Clientes, o botão é Novo cliente."
- 🔤 Na tela: `[PASSO 1/8] Abra Fornecedores → Novo fornecedor`; `[BOTÃO] "+ Novo fornecedor"`.
- ✂️ Edição: `[CORTE]` seco para a tela nova quando ela termina de carregar.

**Cena 4 · 0:45–1:15 · Preencher e salvar · `/app/parties/new`**

- 🎬 Imagem: no campo "Nome" digitar "Yiwu Glass Factory"; em "País" digitar "CN" (a dica do campo é "BR, CN"); em "Telefone / WhatsApp" digitar "+86 579 8888 0001". Mostrar "E-mail", "CNPJ / Tax ID" e "Observação" em branco. Clicar em **Salvar**. Abre o cadastro, com o cartão **Perfil** no alto.
- 🎙 Narração: "Digite o nome da empresa, o país e o telefone. E-mail e CNPJ podem ficar para depois. Clique em Salvar e o cadastro abre, com o Perfil no alto."
- 🔤 Na tela: `[PASSO 2/8] Preencha e clique em Salvar`; `[BOTÃO] "Salvar"`; `[SETA]` "Nome é obrigatório" no campo.
- ✂️ Edição: digitação em tempo real, sem aceleração (texto curto).

**Cena 5 · 1:15–1:40 · Ative o cadastro · `/app/parties/[id]`**

- 🎬 Imagem: no cartão **Perfil**, o campo "Situação" mostra o selo "Inativo". Descer até o cartão "Editar": a caixa "Situação: Sim" está desmarcada. Marcar e clicar em **Salvar**. O selo vira "Ativo".
- 🎙 Narração: "Repare na Situação: o cadastro novo nasce Inativo. Marque Situação: Sim e clique em Salvar de novo. Sem isso, a empresa não aparece na lista de Ativos."
- 🔤 Na tela: `[PASSO 3/8] Marque "Situação: Sim" e salve`; `[ATENÇÃO]` "Cadastro novo nasce inativo"; `[SETA]` no selo "Inativo" → "Ativo".
- ✂️ Edição: `[ZOOM 150 %]` no selo antes e depois; ver "Pontos a confirmar" (comportamento a confirmar com o dono).

**Cena 6 · 1:40–2:05 · O quadro Usuários · `/app/parties/[id]#access`**

- 🎬 Imagem: no Perfil, o quadro "Acesso ao portal" mostra o selo "Sem acesso" e o atalho "Criar acesso →". Clicar no atalho: a página rola até o cartão **Usuários**, com o aviso amarelo "Este cadastro ainda não tem acesso ao portal. Crie abaixo." e a lista "Nada por aqui."
- 🎙 Narração: "No Perfil, o selo Sem acesso tem o atalho Criar acesso, que leva ao quadro Usuários. O aviso amarelo diz que este cadastro ainda não tem acesso ao portal."
- 🔤 Na tela: `[PASSO 4/8] Vá ao quadro "Usuários"`; `[SETA]` "Sem acesso" no selo; `[DICA]` "O Booking também avisa: Fornecedor do Booking sem acesso ao portal: não consegue ver nem responder."
- ✂️ Edição: o rolar da página em 600 ms; manter o aviso 2 s em tela.

**Cena 7 · 2:05–2:45 · Os campos do acesso · `/app/parties/[id]#access`**

- 🎬 Imagem: percorrer os campos do formulário do quadro, um a um: **Nome** (já vem com o nome do contato ou da empresa), **Login** (sugestão pelo nome da empresa: "yiwu.glass.factory"), **Papel** ("Fornecedor"), **Idioma** ("中文", porque o país é CN) e **Senha** (sugestão aleatória). Mostrar as dicas embaixo de Login e de Senha.
- 🎙 Narração: "Confira o Nome da pessoa. O Login pode ser um nome de usuário, sem espaços: letras, números, ponto ou hífen. Não precisa de e-mail. O Papel já vem escolhido pelo tipo do cadastro. O Idioma vem em chinês para empresa da China. A Senha vem sugerida, com pelo menos oito caracteres."
- 🔤 Na tela: `[PASSO 5/8] Confira nome, login, idioma e senha`; `[SETA]` "Nome de usuário, sem espaços: letras, números, ponto ou hífen. Não precisa de e-mail." no Login; `[SETA]` "Pelo menos 8 caracteres. Já vem uma sugestão; pode trocar." na Senha.
- ✂️ Edição: `[ZOOM 150 %]` no formulário inteiro; não troque a senha sugerida (a senha da gravação é descartável).

**Cena 8 · 2:45–3:10 · Copiar login e senha · `/app/parties/[id]#access`**

- 🎬 Imagem: clicar em **Copiar login e senha**; o botão vira "Copiado ✓" por alguns segundos. Cortar para um bloco de notas em branco e colar: três linhas, "Portal: …/login", "Login: …" e "Senha: …".
- 🎙 Narração: "Antes de criar, clique em Copiar login e senha. A senha não aparece de novo depois. O texto leva o endereço do portal, o login e a senha, pronto para colar numa mensagem."
- 🔤 Na tela: `[PASSO 6/8] Copie antes de criar`; `[BOTÃO] "Copiar login e senha"`; `[ATENÇÃO]` "A senha não aparece de novo depois"; `[SETA]` "Copie antes de criar e mande para a pessoa: a senha não aparece de novo depois." no texto da tela.
- ✂️ Edição: o bloco de notas só mostra dados da gravação (login e senha descartáveis); aparecer por 3 s.

**Cena 9 · 3:10–3:35 · Criar acesso · `/app/parties/[id]#access`**

- 🎬 Imagem: clicar em **+ Criar acesso**. A página volta ao quadro com o aviso verde, o login na lista ("Yiwu Glass Factory · yiwu.glass.factory", selo "Fornecedor") e, no Perfil, o login em destaque com a nota "A senha não fica à vista: é a que foi passada na criação do acesso." O formulário já vem com outro login sugerido ("yiwu.glass.factory2") para uma segunda pessoa.
- 🎙 Narração: "Clique em Criar acesso. Aparece a confirmação com o login. A lista e o Perfil mostram o login, nunca a senha. Agora é só mandar a mensagem para a pessoa."
- 🔤 Na tela: `[PASSO 7/8] Clique em Criar acesso`; `[BOTÃO] "+ Criar acesso"`; `[DEPOIS]` "O login nasce ativo e preso a este cadastro. A Wellmix passa os dados por fora; nenhum e-mail sai."
- ✂️ Edição: cartão `[DEPOIS]` por 4 s depois do clique.

**Cena 10 · 3:35–4:00 · Dois erros comuns · `/app/parties/[id]#access`**

- 🎬 Imagem: digitar o mesmo login de novo ("yiwu.glass.factory") com outro nome e clicar em **+ Criar acesso**: aparece o aviso vermelho "Este e-mail já tem acesso ao portal. Use outro e-mail ou procure o login que já existe." Em seguida, digitar "maria silva" (com espaço): "Login inválido. Use de 3 a 40 letras minúsculas, números, ponto ou hífen, sem espaços (ou um e-mail)."
- 🎙 Narração: "Dois erros comuns. Login repetido: o sistema avisa que já existe, então escolha outro. Login com espaço ou curto demais é recusado. Corrija e crie de novo."
- 🔤 Na tela: `[ERRO COMUM]` "Este e-mail já tem acesso ao portal. Use outro e-mail ou procure o login que já existe."; `[ERRO COMUM]` "Login inválido. Use de 3 a 40 letras minúsculas, números, ponto ou hífen, sem espaços (ou um e-mail)."; correção "Use outro login, sem espaços".
- ✂️ Edição: depois de cada erro, a página recarrega com o formulário refeito (Nome vazio e login sugerido); refaça a digitação em tempo real.

**Cena 11 · 4:00–4:25 · A pessoa entra · `/login`**

- 🎬 Imagem: outro perfil do Chrome abre o endereço do portal em `/login`: campos "Login ou e-mail" e "Senha", botão **Entrar**. Digitar o login e a senha criados e entrar. A pessoa cai em Pendências, com a tela em chinês.
- 🎙 Narração: "A pessoa abre o endereço do portal, digita o login e a senha e entra na própria tela, no idioma escolhido. O fornecedor começa pelas Pendências."
- 🔤 Na tela: `[PASSO 8/8] A pessoa entra em /login`; `[BOTÃO] "Entrar"`; `[QUEM VÊ]` "Fornecedor: Pendências, Notificações, Mensagens, Cotações, Pedidos e Conta corrente; só o que é da empresa dele".
- ✂️ Edição: corte para o perfil da pessoa. No modo demonstração a tela de login mostra o quadro "Contas de demonstração" (com e-mails e a senha única) abaixo do formulário; o estilo do guia, seção 7.3, não o esconde. Recorte ou borre esse quadro na edição.

**Cena 12 · 4:25–4:50 · Outros parceiros · `/app/parties`**

- 🎬 Imagem: menu **Cadastros → Outros parceiros**. A lista mostra, com filtros em formato de pílula, **Todos**, **Agência**, **Despachante**, **Companhia marítima**, **Transportador**, **Jurídico**, **Comex (assessoria)**, **Agente de carga** e **OCP (certificação)**. Clicar em **+ Novo parceiro**: o campo "Tipo" abre com a lista de tipos.
- 🎙 Narração: "Agências, despachantes, companhias marítimas, transportadoras, jurídico, comex, agentes de carga e OCP ficam em Outros parceiros. O caminho é o mesmo: Novo parceiro, escolha o Tipo, Salvar e Criar acesso."
- 🔤 Na tela: `[BOTÃO] "+ Novo parceiro"`; `[ATENÇÃO]` "Escolha o Tipo: a lista abre em Fornecedor"; `[QUEM VÊ]` "Cada tipo vê só a tela do seu papel (Embalagem, Fretes, Multas…)".
- ✂️ Edição: `[ZOOM 150 %]` nos filtros por tipo; clientes e fornecedores não estão nesta lista (têm tela própria).

**Cena 13 · 4:50–5:05 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WCA-03.
- 🎙 Narração: "Resumindo: cadastre, ative, crie o acesso, copie e mande. No próximo vídeo, veja os produtos: ficha, fotos e variações."
- 🔤 Na tela: `[RESUMO]` "1 Cadastre e ative · 2 Quadro Usuários · 3 Login, papel, idioma e senha · 4 Copiar login e senha · 5 Criar acesso"; chamada "Próximo: WCA-03 · Produtos".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** login que já existe. A tela mostra "Este e-mail já tem acesso ao portal. Use outro e-mail ou procure o login que já existe." → **Correção:** escolha outro login (a sugestão já vem com um número no fim quando o nome está em uso).
- **Erro:** login com espaço, acento ou fora do tamanho. A tela mostra "Login inválido. Use de 3 a 40 letras minúsculas, números, ponto ou hífen, sem espaços (ou um e-mail)." → **Correção:** troque por um nome de usuário simples.
- **Erro:** senha com menos de 8 caracteres. O navegador barra o envio (o campo exige o mínimo); se o valor chegar ao servidor, ele recusa com "A senha precisa ter pelo menos 8 caracteres." → **Correção:** use a sugestão ou digite pelo menos oito caracteres.
- **Erro:** clicar em "Copiar login e senha" com o login ou a senha vazios. A tela mostra "Preencha o login e a senha antes de copiar." → **Correção:** preencha os dois e clique de novo.
- **Erro:** esquecer de copiar antes de criar. Depois de criado, o aviso diz "Passe para a pessoa o endereço do portal, o login e a senha." e a senha não aparece mais (o Perfil só mostra "A senha não fica à vista: é a que foi passada na criação do acesso.") → **Correção:** a Wellmix precisa ter anotado a senha na criação; hoje não há tela para consultá-la (ver "Pontos a confirmar").

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Fornecedores** (ou **Clientes**, **Outros parceiros**).
2. Clique em **+ Novo fornecedor** (em Outros parceiros, **+ Novo parceiro** e escolha o **Tipo**).
3. Preencha **Nome**, **País** e **Telefone / WhatsApp** (e-mail e CNPJ / Tax ID são opcionais) e clique em **Salvar**. O cadastro abre.
4. No cartão **Editar**, marque **Situação: Sim** e clique em **Salvar**. O cadastro novo nasce inativo.
5. No **Perfil**, o quadro "Acesso ao portal" mostra **Sem acesso**; clique em **Criar acesso →** (ou desça até o cartão **Usuários**).
6. Confira **Nome**, **Login** (nome de usuário sem espaços, ou e-mail), **Papel**, **Idioma** e **Senha** (pelo menos oito caracteres; já vem uma sugestão).
7. Clique em **Copiar login e senha** e guarde o texto para mandar à pessoa. A senha não aparece de novo.
8. Clique em **+ Criar acesso**. Aparece "Acesso criado e preso a {empresa}. Login: {login}." Mande a mensagem à pessoa: endereço do portal, login e senha.
9. A pessoa abre `/login`, digita **Login ou e-mail** e **Senha**, e clica em **Entrar**. Cada cadastro pode ter mais de um login: para a segunda pessoa, repita os passos 6 a 8.

### Notas de gravação

- Prepare o ponto de salvamento `antes-WCA-02`. Se repetir a cena 4 sem restaurar, o nome "Yiwu Glass Factory" já existe e o login sugerido ganha um número no fim.
- O Idioma vem em "中文" só quando o país do cadastro é CN (ou China, 中国); para empresa do Brasil, vem em "Português".
- Cena 8: a permissão de área de transferência do Chrome precisa estar liberada para o botão copiar. O texto copiado usa o endereço do servidor da gravação; se for `localhost`, corte a colagem na edição ou grave com o endereço do ambiente de demonstração.
- Cena 10: depois de um erro, o formulário volta com o Nome vazio, um login e uma senha novos; grave a digitação de novo, sem cortar.
- Cena 11: use outro perfil do Chrome, já aberto em `/login?intro=off`. A senha da gravação é descartável e nunca aparece nos vídeos finais.
- A pessoa criada é só um login: o cliente vê só o que ele mesmo pediu (cada login de cliente tem a sua carteira, docs/OPEN_DECISIONS.md); os demais papéis veem só o que é do cadastro deles.

### Pontos a confirmar

- ⚠ **Cadastro novo nasce inativo.** Visto na tela: ao salvar "Novo fornecedor", o selo do Perfil fica "Inativo" e a empresa só aparece em **Inativos** ou **Todos**; o cartão "Editar" tem "Situação: Sim" desmarcada. A causa é que o formulário de criação não traz a caixa "Situação" e a ação grava `active = false` sem ela. Confirmar com o dono se é intencional; o roteiro ensina a ativar (cena 5) e deve ser regravado se for corrigido.
- ⚠ **Login curto demais** (ex.: "ab", menos de 3 caracteres) volta com `?error=invalid_input` e a mensagem "Dados inválidos. Verifique os campos." aparece no **topo** da página, fora do quadro Usuários; quem está no quadro não vê nada e o formulário é refeito. Visto na tela.
- ⚠ A mensagem de login repetido fala em "e-mail" mesmo quando se digitou um nome de usuário; e a de login inválido não cita o sublinhado, que o código aceita (docs/ARQUITETURA.md: minúsculas, números, ponto, hífen e sublinhado). Letras maiúsculas digitadas viram minúsculas.
- ⚠ O campo **Papel** do administrador inclui "Admin Wellmix" e "Operador Wellmix" dentro do cadastro de um parceiro (os demais logins só veem o papel do tipo). Confirmar se é intencional; não use no vídeo.
- ⚠ Não há tela para **trocar a senha** nem para **desativar** um login depois de criado (o Perfil só mostra o selo "Inativo" se o login já estiver inativo). O vídeo não promete isso.
- ⚠ O aviso do Booking ("Fornecedor do Booking sem acesso ao portal…", textos `portalAccess.booking.*`) está no dicionário, mas não foi conferido na tela do Booking.
- ⚠ Nenhum aviso automático chega à pessoa (e-mail e WhatsApp são mock, guia seção 7.5). O roteiro diz "mande a mensagem"; o texto copiado é o que se manda.

---
## WCA-03 · Produtos: a ficha, as fotos e as variações

> **Promessa:** ao final do vídeo você sabe achar um produto, cadastrar um novo à mão, completar a ficha e as cinco fotos e criar variações (modelo, tamanho, acabamento) com preço e pedido mínimo próprios.

| Ficha                 |                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, cadastros                                                                                                                                                               |
| Conta de gravação     | `admin@wellmix.com`, tela em pt (Chrome em pt-BR)                                                                                                                                 |
| Duração-alvo          | 5:30                                                                                                                                                                              |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                   |
| Telas e rotas         | `/app/products`, `/app/products/[id]` (âncoras `#sheet-photos`, `#variants`, `#product-sheet`), `/app/products/export`                                                            |
| Dados antes de gravar | **Jarra de vidro 1,5 L (UTL-001)** da carga, sem foto e sem fornecedor; 5 fotos limpas da jarra (balança, régua, lado, outro ângulo e original, guia 7.5); ponto de salvamento `antes-WCA-03`. Se o Shenzhen Supplier A já tiver respondido a cotação da jarra, ele aparece sozinho em "Fornecedores deste produto" (cena 7) |
| Depois deste vídeo    | O produto passa a ter ficha, fotos e variações. Produto ativo e fora do Booking já aparece na vitrine do cliente (WCA-06). Nenhum aviso é enviado                                  |
| Antes · Próximo       | WCA-02 · WCA-04                                                                                                                                                                  |
| Idiomas               | pt (base)                                                                                                                                                                        |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/products`**

- 🎬 Imagem: a lista **Produtos** com a linha da Jarra de vidro 1,5 L: foto com o selo "5", o nome com o selo "2 variação(ões)", o preço "a partir de US$ 2,35" e a coluna da ficha mestre "Completa". O cursor repousa na foto.
- 🎙 Narração: "Uma jarra, dois acabamentos, cinco fotos e uma ficha completa. É assim que fica um produto bem cadastrado na Wellmix."
- 🔤 Na tela: `[TÍTULO]` "WCA-03 · Produtos: a ficha, as fotos e as variações"; `[ZOOM 150 %]` na linha da jarra.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz. Para esta cena, grave a lista no fim, com tudo já preenchido, e coloque no começo.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/products`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "O produto é o começo da jornada. Ele nasce no cadastro, pela planilha do fornecedor ou pela solicitação ao fornecedor, e só então vai para a vitrine."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa e as etapas seguintes apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:50 · A lista · menu → `/app/products`**

- 🎬 Imagem: menu **Cadastros → Produtos**. Passar pelas colunas: Foto, Categoria, Nome, SKU, Cód. do fornecedor, Linhas, Preço, MOQ, Caixa master, Material / cor, Observações, Fornecedor, Origem e Ficha mestre ("Completa", "Parcial" ou "—"). Digitar "jarra" no campo "Buscar por nome, SKU, código do fornecedor, categoria ou observação" e clicar em **Buscar**; mostrar os filtros "Todas as linhas" e "Todos os fornecedores" e, ao lado, "Exportar (CSV)".
- 🎙 Narração: "Em Cadastros, abra Produtos. Cada linha traz foto, nome, SKU, linha, preço, pedido mínimo, fornecedor e a situação da ficha mestre. Busque por nome, SKU ou código do fornecedor, e filtre por linha ou fornecedor."
- 🔤 Na tela: `[PASSO 1/10] Abra Cadastros → Produtos`; `[QUEM VÊ]` "Administrador, comprador, gerente de produto, cadastro, diretorias e designer"; `[BOTÃO] "Buscar"`; `[BOTÃO] "Exportar (CSV)"`.
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Ficha mestre" com os três estados; o preço é o FOB do fornecedor, interno: o cliente nunca o vê.

**Cena 4 · 0:50–1:15 · Novo produto · `/app/products`**

- 🎬 Imagem: clicar em **+ Novo produto**: abre o formulário curto com "Nome", "SKU", "Linha" (lista), "Especificação". Preencher "Tigela de vidro 600 ml", "UTL-005", "Utilidades domésticas" e a especificação; clicar em **Salvar**. A lista volta com o produto novo. Voltar ao estado anterior (restaurar o ponto de salvamento) para seguir com a jarra.
- 🎙 Narração: "Para cadastrar à mão, clique em Novo produto: nome, SKU, linha e especificação. Salvar. O produto já nasce ativo; o resto você completa na ficha."
- 🔤 Na tela: `[PASSO 2/10] Clique em "+ Novo produto"`; `[BOTÃO] "+ Novo produto"`; `[ATENÇÃO]` "Produto ativo e fora do Booking já aparece na vitrine do cliente, ainda sem preço".
- ✂️ Edição: use um nome de exemplo (a tigela); não apareça a lista com o produto de teste na versão final.

**Cena 5 · 1:15–1:45 · Abrir a ficha · `/app/products/[id]`**

- 🎬 Imagem: clicar em "Jarra de vidro 1,5 L". No alto, o título e os selos: o SKU "UTL-001", a linha "Utilidades domésticas", "CODPROD —" e "Origem: Manual". Passar pelos cartões **Identificação**, **Fornecedor e negociação**, **Produto**, **Embalagem** e **Observações**; no fim, o botão **Salvar ficha**.
- 🎙 Narração: "Clique no nome para abrir a ficha. No alto ficam o SKU, a linha, o CODPROD do Sankhya e a origem. Os cinco cartões se salvam juntos, no botão Salvar ficha."
- 🔤 Na tela: `[PASSO 3/10] Abra a ficha do produto`; `[SETA]` "CODPROD: o código do produto no Sankhya (hoje digitado)" no selo; `[BOTÃO] "Salvar ficha"`.
- ✂️ Edição: `[ZOOM 150 %]` no cabeçalho; mostre o rolar da página por 4 s.

**Cena 6 · 1:45–2:15 · Especificação, ativo e excluir · `/app/products/[id]` e `/app/products`**

- 🎬 Imagem: no cartão **Identificação**, o campo "Especificação" já vem montado ("Material: Glass", "Cor: White"…) com a dica "Montada com os dados do produto: acompanha o que você preencher até ser editada à mão." Mostrar a caixa "Produto ativo". Voltar à lista, marcar a caixa de um produto e clicar em **Excluir selecionados**: a confirmação diz que o produto sai do cadastro, da vitrine e da nova solicitação, e que dá para restaurar em "Ver excluídos".
- 🎙 Narração: "A Especificação é montada com os dados do produto e acompanha o que você preencher, até ser editada à mão. Para tirar um produto de uso, marque-o na lista e clique em Excluir selecionados. Dá para restaurar em Ver excluídos."
- 🔤 Na tela: `[PASSO 4/10] Excluir é reversível`; `[BOTÃO] "Excluir selecionados"`; `[SETA]` "Ver excluídos" na lista; `[ATENÇÃO]` "Pedidos e histórico continuam; só o administrador exclui de vez".
- ✂️ Edição: cancele a confirmação na gravação (ou restaure o ponto de salvamento); o "Excluir definitivamente" só aparece ao administrador, dentro de "Ver excluídos", e não é gravado neste vídeo.

**Cena 7 · 2:15–2:40 · Fornecedores deste produto · `/app/products/[id]`**

- 🎬 Imagem: descer até **Fornecedores deste produto**. A linha "Shenzhen Supplier A" com o selo "Cotação", o preço, o prazo e o MOQ da última cotação e os links **Tornar principal** e **Retirar**; o campo "Código do item" com **Salvar código**. Embaixo, "Fornecedor cadastrado", "Código do item (opcional)", **Incluir** e **Cadastrar novo fornecedor**. Sem cotação ainda, a área mostra "Nenhum fornecedor ainda. Escolha um abaixo ou abra uma cotação."
- 🎙 Narração: "Todo fornecedor que responde a uma cotação deste produto entra aqui sozinho, com o código do item. Para escolher o principal, use Tornar principal. Também dá para incluir um fornecedor à mão."
- 🔤 Na tela: `[PASSO 5/10] Veja os fornecedores do produto`; `[BOTÃO] "Tornar principal"`; `[BOTÃO] "Incluir"`; `[QUEM VÊ]` "Fornecedor e preço FOB: só a Wellmix".
- ✂️ Edição: não clique em "Retirar"; mostre só a leitura.

**Cena 8 · 2:40–3:05 · A ficha mestre · `/app/products/[id]#product-sheet`**

- 🎬 Imagem: descer até **Ficha de compra do produto (mestre)**. O selo ao lado do título ("Ficha mestre: faltam 2 item(ns)"), o aviso "Faltam: …" com cada campo clicável e a tabela de blocos (Fornecedor, Produto, Caixa e embalagem, Preço e condições, Fotos…). Clicar em um campo faltante: a página leva até ele. No fim, o botão **Salvar ficha mestre**.
- 🎙 Narração: "Mais abaixo, a Ficha de compra do produto, a ficha mestre. Cotações e pedidos deste produto já nascem com os dados dela. O selo diz o que falta, e cada item é clicável. Salve em Salvar ficha mestre."
- 🔤 Na tela: `[PASSO 6/10] Complete a ficha mestre`; `[SETA]` "O que falta, campo a campo" no aviso "Faltam: …"; `[BOTÃO] "Salvar ficha mestre"`; `[DICA]` "Preço, MOQ, caixa, medidas, cor e material são o mesmo dado dos cartões do alto: salvar um atualiza o outro".
- ✂️ Edição: `[ZOOM 150 %]` no selo; o texto de apoio diz que a ficha é referência da Wellmix; não mostre dados de pagamento.

**Cena 9 · 3:05–3:45 · As cinco fotos · `/app/products/[id]#sheet-photos`**

- 🎬 Imagem: no cartão **Fotos**, o quadro "Fotos da ficha mestre" com "0 de 5 enviadas" e cinco linhas vermelhas: "Balança (peso)", "Medida: com escala", "Medida: lado", "Outro ângulo" e "Original (evidência)", cada uma com "Falta enviar" e o botão **Adicionar fotos**. Escolher a imagem de cada uma; a linha fica verde com "1 foto(s) enviada(s)" e o botão vira **Adicionar mais**. No fim: "5 de 5 enviadas".
- 🎙 Narração: "No cartão Fotos, a ficha mestre pede cinco: balança, medida com escala, medida de lado, outro ângulo e original. Em cada linha vermelha, clique em Adicionar fotos; ao escolher a imagem, ela já sobe. Com as cinco, os pedidos deste produto não pedem as fotos de novo."
- 🔤 Na tela: `[PASSO 7/10] Envie as cinco fotos`; `[BOTÃO] "Adicionar fotos"`; `[SETA]` "0 de 5 enviadas → 5 de 5 enviadas"; `[DICA]` "A foto original é a evidência da equipe; a do fornecedor é provisória".
- ✂️ Edição: acelere 2× só o intervalo entre as escolhas; mantenha o contador visível; as fotos de gravação são próprias, nunca de terceiros (guia, seção 7.5).

**Cena 10 · 3:45–4:05 · A foto principal · `/app/products/[id]`**

- 🎬 Imagem: descer até as miniaturas, agrupadas por tipo ("Original (evidência)", "Medida: lado"…). Na primeira, o selo "Principal"; nas outras, o link **Definir como principal**. Clicar em um: o selo muda de foto. Voltar à lista: a foto da linha mudou.
- 🎙 Narração: "A foto principal é a que aparece na lista e na vitrine. Para trocar, clique em Definir como principal na foto que você quer."
- 🔤 Na tela: `[PASSO 8/10] Escolha a foto principal`; `[BOTÃO] "Definir como principal"`; `[SETA]` "Principal" no selo.
- ✂️ Edição: `[CORTE]` seco para a lista no fim.

**Cena 11 · 4:05–4:55 · Variações · `/app/products/[id]#variants`**

- 🎬 Imagem: descer até **Variações**. Clicar em **Adicionar variação**: abre o formulário com "Nome da variação", "Código de fábrica", "Tamanho (texto)", "Preço", "Moeda", "Pedido mínimo (MOQ)", "Peças por caixa master", "CBM por caixa master", "Cores", "Material"… Preencher a primeira ("Tampa de bambu", JR-1500-B, US$ 2,35, MOQ 1.200, 24 por caixa) e clicar no botão **Adicionar variação**; repetir com "Tampa de aço inox" (US$ 2,80). A tabela **Variações** mostra as duas, com o selo "Referência" na de menor preço, o estado "Ativa" e o link **Desativar**. Voltar à lista: o selo "2 variação(ões)" e "a partir de US$ 2,35".
- 🎙 Narração: "Produto com modelos, tamanhos ou acabamentos usa Variações. Clique em Adicionar variação, dê o nome, como Tampa de bambu, e preencha preço, moeda, pedido mínimo e caixa. A de menor preço vira a Referência, e o produto mostra os valores dela. Na lista, ganha o selo de variações e o preço a partir de."
- 🔤 Na tela: `[PASSO 9/10] Adicione as variações`; `[BOTÃO] "Adicionar variação"`; `[SETA]` "Referência: a de menor preço; o produto espelha os valores dela"; `[ATENÇÃO]` "Quem pede ou compra precisa escolher a variação"; `[BOTÃO] "Desativar"`.
- ✂️ Edição: os valores são de exemplo para a gravação (o preço de US$ 2,35 é o do roteiro da Jornada da Jarra); não os leia na narração.

**Cena 12 · 4:55–5:15 · Quando o produto vai para a vitrine · `/app/explore`**

- 🎬 Imagem: o menu **Cadastros → Vitrine do cliente**: a jarra aparece com a foto principal e o selo "2 variações". Em seguida, um cartão azul de texto: a regra da vitrine.
- 🎙 Narração: "Produto ativo aparece na vitrine do cliente. O criado por planilha ou por solicitação ao fornecedor fica de fora até ser aprovado no Booking ou liberado na vitrine. O vídeo seis mostra isso."
- 🔤 Na tela: `[PASSO 10/10] Confira a vitrine`; `[SETA]` "Liberar na vitrine" no cartão de texto (botão do bloco Produto da solicitação ao fornecedor aprovada); `[DEPOIS]` "O cliente passa a ver o produto, com as variações para escolher."
- ✂️ Edição: não aprove nem libere nada aqui; só mostre a vitrine (a liberação é do episódio do Booking).

**Cena 13 · 5:15–5:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WCA-04.
- 🎙 Narração: "Resumindo: abra a ficha, complete a ficha mestre, envie as cinco fotos e crie as variações. No próximo vídeo, importe a ficha técnica do fornecedor."
- 🔤 Na tela: `[RESUMO]` "1 Abra a ficha · 2 Ficha mestre · 3 Cinco fotos · 4 Foto principal · 5 Variações"; chamada "Próximo: WCA-04 · Importar a ficha técnica e o CSV".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** pedir um produto que tem variações sem escolher a variação. A solicitação, o carrinho e o "pedir agora" exigem a variação (docs/PRODUCT_VARIANTS.md, regra 1: o servidor recusa com `variant_required`) → **Correção:** escolha a variação na vitrine ou na Nova solicitação.
- **Erro:** variação repetida. A tela mostra "Já existe uma variação com este código e nome neste produto." → **Correção:** mude o código de fábrica ou o nome.
- **Erro:** variação sem nome. A tela mostra "Informe o nome da variação." → **Correção:** preencha "Nome da variação".
- **Erro:** ficha mestre salva com campos faltando. A tela mostra "Ficha mestre salva; faltam: {campos}." e cada campo vira um link → **Correção:** clique no campo e complete.
- **Erro:** esperar que o produto apareça na vitrine com preço. Sem o que falta, o cartão mostra "Preço sob consulta" e o aviso "Para o preço aparecer, falta: …" → **Correção:** WCA-06, cena 5.
- **Aviso:** "Excluir selecionados" não apaga: confirma com "Excluir {n} produto(s)? Eles saem do cadastro, da vitrine e da nova solicitação; pedidos e histórico continuam. Dá para restaurar em "Ver excluídos"." → **Correção:** em **Ver excluídos**, marque e clique em **Restaurar selecionados**.

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Produtos**. Busque por nome, SKU, código do fornecedor, categoria ou observação, e filtre por linha ou fornecedor. **Exportar (CSV)** baixa a lista.
2. Para cadastrar à mão, clique em **+ Novo produto**, preencha **Nome**, **SKU**, **Linha** e **Especificação** e clique em **Salvar**.
3. Clique no nome do produto para abrir a ficha. Complete os cartões **Identificação**, **Fornecedor e negociação**, **Produto**, **Embalagem** e **Observações** e clique em **Salvar ficha**.
4. Em **Fornecedores deste produto**, use **Tornar principal** para escolher o principal; quem responde a cotação entra sozinho.
5. Em **Ficha de compra do produto (mestre)**, complete o que o aviso "Faltam: …" aponta e clique em **Salvar ficha mestre**.
6. No cartão **Fotos**, envie as cinco fotos da ficha mestre com **Adicionar fotos**: Balança (peso), Medida: com escala, Medida: lado, Outro ângulo e Original (evidência).
7. Use **Definir como principal** para escolher a foto que aparece na lista e na vitrine.
8. Em **Variações**, clique em **Adicionar variação**, preencha o nome, o preço, a moeda, o pedido mínimo, a caixa e as medidas, e salve. A de menor preço é a **Referência**. **Desativar** tira uma variação de uso.
9. Para tirar produtos de uso, marque-os na lista e clique em **Excluir selecionados**; **Ver excluídos** e **Restaurar selecionados** os trazem de volta.
10. Confira o resultado em **Cadastros → Vitrine do cliente** (WCA-06).

### Notas de gravação

- Prepare o ponto de salvamento `antes-WCA-03` com a jarra sem foto. Grave a cena 1 (a lista com tudo pronto) por último e coloque no começo na edição.
- As cinco imagens da jarra devem ser próprias (fotografadas ou geradas), nunca de terceiros (guia, seção 7.5). Nomeie os arquivos pelo tipo (balanca.png, regua.png, lado.png, angulo.png, original.png) para escolher sem erro.
- Na cena 4, o produto de teste (tigela) entra na vitrine na hora; restaure o ponto de salvamento depois da cena para ele não aparecer nos demais vídeos.
- Valores da variação (US$ 2,35, US$ 2,80, MOQ 1.200, 24 por caixa, CBM 0,06) são de exemplo; mostre sem narrar números.
- A foto principal nasce sozinha: a primeira foto do tipo "Original (evidência)" (ou comercial) vira "Principal" quando o produto ainda não tem principal; as outras só mudam com "Definir como principal". Na gravação, envie a "Original (evidência)" e confira o selo.
- Cena 6: com a jarra recém-carregada, a "Especificação" aparece vazia; preencha antes Material, Cor, peso e caixa (cartões Produto e Embalagem) e salve a ficha, para ela se montar sozinha antes de gravar a cena.
- "Origem: Manual" aparece no cabeçalho de produto cadastrado à mão; produto da planilha mostra "Importação" e o de visita de sourcing, "Sourcing".

### Pontos a confirmar

- ⚠ **"Liberar na vitrine"** não está na tela Produtos: o botão fica no bloco **Produto** da solicitação ao fornecedor aprovada (Pedidos → solicitação ao fornecedor), para quem abre Cotações e Produtos (docs/SUPPLIER_REQUESTS.md). O roteiro só o cita; o episódio do Booking o mostra.
- ⚠ O texto "produto sem foto" não tem erro próprio: a lista mostra o ícone de câmera e a vitrine, "Sem foto".
- ⚠ A mensagem `variant_required` aparece na Nova solicitação como o texto do dicionário do erro (não conferido na tela nesta série).
- ⚠ O cartão "Sugestão por foto (IA)" da ficha mostra o aviso "A IA não está configurada: defina ANTHROPIC_API_KEY no ambiente ou escolha o modo MOCK…". Não use no vídeo.
- ⚠ **Estoque** (`/app/inventory`, mesma permissão de Produtos) não tem episódio nesta série; sugerir um WCA-07 (Estoque: no Brasil, em trânsito, em produção, baixa por venda, reservas e inventário às cegas, docs/INVENTORY.md).
- ⚠ Produto cadastrado à mão em **+ Novo produto** vai direto à vitrine (visto na tela: ele nasce ativo e sem linha no Booking, e a vitrine o mostra na hora, sem preço). Confirmar com o dono se é o desejado; a cena 4 avisa disso.

---
## WCA-04 · Importar a ficha técnica (planilha) e o CSV

> **Promessa:** ao final do vídeo você sabe cadastrar vários produtos de uma vez pela planilha do fornecedor, escolher o tipo de resultado, ler o que falta em cada produto e usar a Importação de cadastros (planilha ou CSV) com conferência.

| Ficha                 |                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, cadastros                                                                                                                                                                   |
| Conta de gravação     | `admin@wellmix.com`, tela em pt (o administrador abre Produtos, Booking e Importar; o operador comprador abriria só a primeira parte)                                                  |
| Duração-alvo          | 5:15                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                      |
| Telas e rotas         | `/app/products`, `/app/products/import`, `/app/products/import/[batchId]`, `/app/import`, `/app/import/[batchId]`                                                                    |
| Dados antes de gravar | Duas planilhas prontas: **(1)** a ficha técnica do modelo SUPPLIER INFO com 2 a 8 itens e a **jarra** entre eles (ver "Notas de gravação" para as colunas), de um fornecedor da carga (Shenzhen Supplier A); **(2)** `tests/fixtures/produtos-china.xlsx` (cabeçalhos em chinês) para a Importação de cadastros. A linha "Utilidades domésticas" existe na carga. Ponto de salvamento `antes-WCA-04` |
| Depois deste vídeo    | Os produtos importados estão no cadastro com ficha mestre e o fornecedor ligado. Em "Mandar para o Booking", os novos ficam fora da vitrine até serem aprovados no Booking; o que já existia entra como Aprovado. O lote fica guardado (Importações anteriores / Lotes anteriores). Nenhum aviso é enviado |
| Antes · Próximo       | WCA-03 · WCA-05                                                                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/products/import/[batchId]`**

- 🎬 Imagem: a tela de resultado "Importação: ficha-jarra.xlsx": o resumo no alto, o aviso azul do Booking, o aviso amarelo "…ainda com informação faltando" e a tabela com a jarra ("Atualizado") e o copo ("Criado"), com os selos amarelos do que falta em cada um.
- 🎙 Narração: "Uma planilha do fornecedor vira produtos cadastrados, com ficha e fotos, num passo só. E o portal diz o que falta."
- 🔤 Na tela: `[TÍTULO]` "WCA-04 · Importar a ficha técnica e o CSV"; `[ZOOM 150 %]` na tabela de resultado.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz. Grave esta cena no fim, depois da importação, e coloque no começo.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/products`**

- 🎬 Imagem: a lista **Produtos**, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "É o começo da jornada: o fornecedor manda a ficha técnica, a Wellmix importa, e o portal cadastra tudo."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa e as etapas seguintes apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:42 · Os dois botões · menu → `/app/products`**

- 🎬 Imagem: menu **Cadastros → Produtos**. No alto à direita, dois botões: **Importar CSV** (branco) e **Importar ficha técnica** (vermelho). O cursor passa pelos dois e clica em **Importar ficha técnica**.
- 🎙 Narração: "Em Produtos há dois botões. Importar ficha técnica lê a planilha do fornecedor. Importar CSV é outro caminho, mais simples, que vemos no fim."
- 🔤 Na tela: `[PASSO 1/8] Clique em "Importar ficha técnica"`; `[BOTÃO] "Importar ficha técnica"`; `[BOTÃO] "Importar CSV"`; `[QUEM VÊ]` "Ficha técnica: quem abre Produtos. Importar CSV: cadastro, diretorias e administrador".
- ✂️ Edição: `[CORTE]` seco para a tela de importação; o botão "Importar CSV" aparece também para quem não pode abri-lo (ver "Pontos a confirmar").

**Cena 4 · 0:42–1:10 · A planilha · `/app/products/import`**

- 🎬 Imagem: a tela **Importar ficha técnica**: o cartão **Planilha** com o campo "Planilha (.xlsx ou .xls)" e, embaixo, "Ou o link de uma planilha do Google Sheets". Escolher o arquivo "ficha-jarra.xlsx": o nome dele aparece ao lado do botão. (Em produção, planilha acima de 3,5 MB sobe direto ao armazenamento, com "Enviando a planilha… {n}%" e depois "Planilha enviada: {nome} ({tamanho}). Agora clique em Importar e cadastrar."; no modo demonstração o arquivo segue no próprio formulário.) À direita, o cartão **Como o portal lê a planilha**.
- 🎙 Narração: "Escolha a planilha do modelo, em xlsx ou xls, ou cole o link do Google Sheets compartilhado com o link. O portal reconhece o cabeçalho em inglês, português ou chinês: não precisa mapear coluna por coluna."
- 🔤 Na tela: `[PASSO 2/8] Escolha a planilha`; `[SETA]` "Aceita .xlsx e .xls; com fotos, até 50 MB" no texto de apoio; `[SETA]` "Google Sheets: Compartilhar → Qualquer pessoa com o link (Leitor)"; `[ATENÇÃO]` "Se enviar arquivo e link, vale o arquivo".
- ✂️ Edição: `[ZOOM 150 %]` no texto de apoio dos dois campos; o cartão da direita fica 3 s em tela.

**Cena 5 · 1:10–1:32 · Fornecedor, linha e moeda · `/app/products/import`**

- 🎬 Imagem: no campo **Fornecedor** (começa em "Selecione o fornecedor"), escolher "Shenzhen Supplier A · A 154678". Em **Linha do produto**, escolher "Utilidades domésticas". Mostrar **Moeda do preço** ("USD") e a dica de que o cabeçalho "PRICE / U$" já diz dólar.
- 🎙 Narração: "Escolha o Fornecedor: todos os produtos da planilha ficam ligados a ele, e é ele quem vai analisar o Booking. Escolha a Linha do produto, porque a planilha não diz. A Moeda só vale se o cabeçalho não disser."
- 🔤 Na tela: `[PASSO 3/8] Fornecedor e linha`; `[SETA]` "Obrigatório para quem abre o Booking" em Fornecedor; `[SETA]` "A planilha não diz a linha: todos entram nela" em Linha do produto; `[DICA]` "O fornecedor não está na lista? Cadastre antes em Cadastros → Fornecedores."
- ✂️ Edição: `[ZOOM 150 %]` nas três caixas, uma por vez.

**Cena 6 · 1:32–2:20 · O tipo de resultado · `/app/products/import`**

- 🎬 Imagem: o quadro **Resultado** com três opções (botões de rádio), cada uma com um texto cinza embaixo. A primeira, **Mandar para o Booking (um produto por linha)**, já vem marcada para quem abre o Booking. Passar o cursor pelas outras duas: **Um produto com variações (uma por linha da planilha)** e **Um produto por linha (como antes)**.
- 🎙 Narração: "Em Resultado há três jeitos. Mandar para o Booking: cada grupo de linhas vira um produto, que fica fora da vitrine até ser aprovado lá; é o padrão de quem abre o Booking. Um produto com variações: a planilha inteira é um produto e cada grupo vira uma variação. Um produto por linha: cada grupo vira um produto do catálogo, como antes."
- 🔤 Na tela: `[PASSO 4/8] Escolha o Resultado`; `[SETA]` "Novo fica fora da vitrine até aprovar; o que já existia entra como Aprovado" na primeira opção; `[SETA]` "Reimportar atualiza, não duplica" nas três; `[QUEM VÊ]` "Quem não abre o Booking só vê as duas últimas opções (a padrão é a de variações)".
- ✂️ Edição: `[ZOOM 150 %]` em cada opção por 6 s, lendo o texto de apoio; o Booking tem série própria.

**Cena 7 · 2:20–2:40 · Nome base e importar · `/app/products/import`**

- 🎬 Imagem: o campo **Nome base (opcional)** com a dica e o exemplo "ex.: Porta-retrato". Deixar em branco (a planilha tem coluna de nome). Clicar em **Importar e cadastrar**: o botão mostra "Lendo a planilha…".
- 🎙 Narração: "O Nome base é opcional: entra antes da descrição e do tamanho. Se a planilha tem coluna de nome, vale ela. Clique em Importar e cadastrar."
- 🔤 Na tela: `[PASSO 5/8] Clique em "Importar e cadastrar"`; `[BOTÃO] "Importar e cadastrar"`; `[ATENÇÃO]` "Máximo de 80 produtos por planilha".
- ✂️ Edição: `[CORTE]` seco para o resultado quando a página abre; pode levar alguns segundos.

**Cena 8 · 2:40–3:20 · O resultado · `/app/products/import/[batchId]`**

- 🎬 Imagem: a tela "Importação: ficha-jarra.xlsx": o resumo ("{n} produto(s) criado(s), {n} atualizado(s), {n} com erro · … foto(s)") e os botões **Importar outra planilha**, **Ver produtos** e **Ver no Booking**. O aviso azul explica o Booking. O aviso amarelo diz "{n} produto(s) ainda com informação faltando: abra cada um e complete o que está marcado." Na tabela (Produto, Fornecedor, Preço, Fotos, O que falta, Situação), a jarra aparece como "Atualizado" e o copo como "Criado", com os selos "Foto na balança", "Foto com régua (medida com escala)", "Foto da medida de lado", "Foto de outro ângulo" e "Foto original (evidência)". Clicar no nome da jarra para abrir a ficha.
- 🎙 Narração: "O portal mostra o resumo: quantos produtos foram criados, atualizados ou com erro, e quantas fotos. Na tabela, cada produto traz fornecedor, preço, fotos e, em amarelo, o que falta na ficha mestre. Clique no produto para completar."
- 🔤 Na tela: `[PASSO 6/8] Leia o que falta`; `[SETA]` "Criado ou Atualizado" na coluna Situação; `[SETA]` "O que falta na ficha mestre" na coluna amarela; `[DEPOIS]` "O produto novo está no cadastro e no Booking, fora da vitrine; o que já existia entrou como Aprovado."
- ✂️ Edição: `[ZOOM 150 %]` na tabela; manter 4 s. Os produtos de planilha com foto na coluna PHOTO mostram "Fotos" maior que zero; sem imagem na planilha, "0".

**Cena 9 · 3:20–3:38 · Importar de novo · `/app/products/import`**

- 🎬 Imagem: voltar com **Importar outra planilha**. Descer até o cartão **Importações anteriores**: uma linha por planilha, com o nome, a data, o selo "No Booking" e o resumo "{n} criado(s) · {n} atualizado(s) · {n} erro(s)". Clicar no nome reabre o resultado.
- 🎙 Narração: "Importar a mesma planilha de novo atualiza os mesmos produtos, sem duplicar. As importações anteriores ficam listadas no fim da tela."
- 🔤 Na tela: `[SETA]` "Mesma planilha: atualiza, não duplica"; `[SETA]` "Selo No Booking"; `[DICA]` "Corrigiu a planilha? Importe de novo."
- ✂️ Edição: não reimporte na gravação; só mostre a lista.

**Cena 10 · 3:38–4:08 · A Importação de cadastros · `/app/import`**

- 🎬 Imagem: voltar a Produtos e clicar em **Importar CSV**. Abre **Importação de cadastros** com dois cartões lado a lado: **Planilha do sistema chinês (XLSX/CSV)** e **CSV direto (sem conferência)**. No primeiro, escolher "Produtos" em "O que a planilha contém", escolher `produtos-china.xlsx` em "Arquivo (.xlsx, .xlsm, .csv)" e clicar em **Ler planilha**. Abre o lote, no passo **Mapeamento**: "Linha padrão", "Moeda padrão" e a tabela "Coluna da planilha / Amostra / Campo no portal" já com cada coluna chinesa ligada ao campo certo (Nome, Fornecedor, Preço, MOQ…).
- 🎙 Narração: "Agora o outro caminho. Importar CSV abre a Importação de cadastros, para quem tem a função de cadastro. Escolha o que a planilha contém, envie o arquivo e clique em Ler planilha. O portal sugere o campo de cada coluna, mesmo com cabeçalho em chinês."
- 🔤 Na tela: `[PASSO 7/8] Clique em "Importar CSV"`; `[BOTÃO] "Ler planilha"`; `[SETA]` "Sugestão pelos cabeçalhos em português, inglês e chinês" na coluna Campo no portal; `[QUEM VÊ]` "Função cadastro, diretorias e administrador; sem item no menu".
- ✂️ Edição: `[ZOOM 150 %]` na tabela de mapeamento; escolha "Linha padrão" = "Utilidades domésticas" e "Moeda padrão" = "Dólar (USD)" antes de seguir.

**Cena 11 · 4:08–4:38 · Conferência e Importar · `/app/import/[batchId]`**

- 🎬 Imagem: clicar em **Ver conferência**. O passo "Conferência": o aviso "2 a criar · 0 a atualizar · 0 a ignorar" e a tabela (Linha, Dados, Correspondência, Problemas, Decisão), com o selo "Novo registro" e, em cada linha, a lista "Criar / Atualizar / Ignorar". Mostrar uma linha com problema (por exemplo, sem linha padrão: "Linha não encontrada", decisão sugerida "Ignorar"). Clicar em **Importar**: "Importação concluída. 2 criados, 0 atualizados, 0 ignorados, 0 erros." com o botão **Ver lista**.
- 🎙 Narração: "Na Conferência, cada linha mostra se já existe um cadastro igual e o que está errado. Decida por linha: Criar, Atualizar ou Ignorar. Só ao clicar em Importar os registros são gravados."
- 🔤 Na tela: `[PASSO 8/8] Confira e clique em "Importar"`; `[BOTÃO] "Ver conferência"`; `[BOTÃO] "Importar"`; `[ERRO COMUM]` "Linha não encontrada" (corrija a Linha padrão); `[ATENÇÃO]` "Nada é gravado até clicar em Importar; Cancelar lote descarta".
- ✂️ Edição: para o `[ERRO COMUM]`, grave uma tomada sem a Linha padrão e outra com ela.

**Cena 12 · 4:38–4:58 · O CSV direto · `/app/import`**

- 🎬 Imagem: de volta à Importação de cadastros, o cartão **CSV direto (sem conferência)**: a lista "Parceiros / Produtos / Linhas de produto", o campo "CSV" e a dica "CSV com cabeçalho. Colunas aceitas: …". Escolher um CSV pequeno e clicar em **Importar CSV**: aparece "{n} registros criados, {n} ignorados."
- 🎙 Narração: "Há também o CSV direto, sem conferência: grava na hora, e as linhas inválidas são ignoradas e contadas. Use só com arquivo já conferido."
- 🔤 Na tela: `[BOTÃO] "Importar CSV"`; `[ATENÇÃO]` "Sem conferência: grava na hora"; `[ERRO COMUM]` "2 registros criados, 1 ignorados." (a linha ignorada tinha tipo ou linha inválidos).
- ✂️ Edição: use um CSV de 3 linhas, com uma inválida de propósito, e mostre o resultado por 3 s.

**Cena 13 · 4:58–5:15 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WCA-05.
- 🎙 Narração: "Resumindo: escolha o fornecedor, a linha e o resultado, importe e complete o que falta. No próximo vídeo, as linhas de produto."
- 🔤 Na tela: `[RESUMO]` "1 Importar ficha técnica · 2 Fornecedor, linha e Resultado · 3 Leia o que falta · 4 Importação de cadastros com conferência · 5 CSV direto só com arquivo conferido"; chamada "Próximo: WCA-05 · Linhas de produto".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** nenhuma planilha escolhida. A tela mostra "Escolha a planilha (.xlsx ou .xls) ou cole o link do Google Sheets." → **Correção:** escolha o arquivo ou cole o link.
- **Erro:** fornecedor em branco no Booking. O campo exige o fornecedor; se o valor não chegar, a tela mostra "Escolha o fornecedor: cada Booking que sobe precisa estar ligado a um fornecedor." → **Correção:** escolha o fornecedor (cadastre antes em Cadastros → Fornecedores, se não está na lista).
- **Erro:** planilha que não é o modelo. A tela mostra "Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo." → **Correção:** use a planilha do modelo SUPPLIER INFO.
- **Erro:** planilha vazia ou grande demais. "A planilha não tem linhas de produto preenchidas." ou "Muitos produtos de uma vez (máximo 80 por planilha): divida a planilha." → **Correção:** preencha as linhas ou divida em planilhas menores.
- **Erro:** Excel muito antigo ou com senha. "Arquivo .xls muito antigo (Excel 95 ou anterior): abra no Excel e salve como .xlsx." ou "A planilha está protegida por senha: abra no Excel, tire a senha (Arquivo → Informações → Proteger Pasta de Trabalho) e envie de novo." → **Correção:** salve como .xlsx ou tire a senha.
- **Erro:** link do Google que não abre. "O Google não entregou a planilha: ela não está compartilhada com "Qualquer pessoa com o link". Ajuste o compartilhamento e tente de novo." (ou, com o link de "Publicar na web", "Esse é o link de "Publicar na web", que não serve para importar. Na planilha, use Compartilhar → Copiar link (com "Qualquer pessoa com o link") e cole esse.") → **Correção:** compartilhe como Leitor e cole o link de compartilhar.
- **Erro:** login sem a tela Importar clica em "Importar CSV" e volta ao início com "Você não tem acesso a Importar planilha. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** o administrador marca a função "cadastro" (ou a tela).
- **Aviso:** "Seu login não pode fazer isso. Mandar para o Booking é só para quem abre a tela Booking (o administrador libera em Gestão → Equipe e divisões)." → **Correção:** escolha outra opção de Resultado ou peça a tela Booking.

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Produtos**. Clique em **Importar ficha técnica**.
2. Em **Planilha**, escolha o arquivo (.xlsx ou .xls) do modelo SUPPLIER INFO, ou cole o link de uma planilha do Google Sheets compartilhada como "Qualquer pessoa com o link" (Leitor).
3. Escolha o **Fornecedor** (obrigatório para quem abre o Booking) e a **Linha do produto**. A **Moeda do preço** só vale quando o cabeçalho não diz.
4. Em **Resultado**, escolha: **Mandar para o Booking (um produto por linha)**, **Um produto com variações (uma por linha da planilha)** ou **Um produto por linha (como antes)**.
5. Se quiser, preencha o **Nome base (opcional)** e clique em **Importar e cadastrar**.
6. Leia o resultado: o resumo, a coluna **Situação** (Criado, Atualizado, Já existia) e **O que falta** em cada produto. Clique no produto para completar a ficha. **Ver no Booking** e **Ver produtos** seguem para as outras telas.
7. Para importar de novo a mesma planilha, use **Importar outra planilha**; os mesmos produtos são atualizados, sem duplicar. Os lotes ficam em **Importações anteriores**.
8. Para a Importação de cadastros, clique em **Importar CSV** (em Produtos ou em Outros parceiros). No cartão **Planilha do sistema chinês (XLSX/CSV)**, escolha o que a planilha contém, o arquivo e clique em **Ler planilha**.
9. No **Mapeamento**, confira a **Linha padrão**, a **Moeda padrão** e o **Campo no portal** de cada coluna; clique em **Ver conferência**. Na **Conferência**, decida por linha (**Criar**, **Atualizar** ou **Ignorar**) e clique em **Importar**.
10. O **CSV direto (sem conferência)** grava na hora: escolha o tipo (Parceiros, Produtos ou Linhas de produto), o arquivo e clique em **Importar CSV**.

### Notas de gravação

- **Planilha da ficha técnica (exemplo da gravação).** Monte uma planilha do modelo, com a linha de cabeçalho: `DATE`, `LOCAL`, `SUPPLIER NAME`, `SUPPLIER STORE NO YIWU`, `SUPPLIER PHONE NO`, `SKU/FACTORY ITEM CODE`, `PRODUCT NAME`, `FOB/EXW`, `PRICE / U$`, `QTY/BOX`, `QTY/INNER`, `N.W./PC`, `G.W./PC`, `CBM`, `SIZE(CM) LENGTH`, `SIZE(CM) WIDTH`, `SIZE(CM) HEIGHT`, `CAPACITY(ML)`, `PACKAGE`, `COLOR`, `MATERIAL`, `MOQ`; e duas linhas de produto de Shenzhen Supplier A (a jarra, "Jarra de vidro 1,5 L", código JR-1500, US$ 2,35, 12 por caixa, MOQ 1.200, e um item novo, como "Copo de vidro 300 ml"). Os dados são de exemplo, não de um fornecedor real. Para mostrar fotos no resultado, cole uma imagem na coluna `PHOTO` de cada linha; sem imagem, a coluna "Fotos" fica em 0.
- **Nome do produto.** Com a coluna `PRODUCT NAME`, a jarra da carga ("Jarra de vidro 1,5 L", linha Utilidades domésticas) é reconhecida e aparece como **Atualizado**; sem ela, o nome sai de "nome base + descrição + tamanho" e a jarra viria como um produto novo, parecido com o da carga. Se isso acontecer, restaure o ponto de salvamento e use a coluna de nome.
- Resultado "Mandar para o Booking": no teste da gravação, o resumo disse "1 produto(s) criado(s), 1 atualizado(s) … 2 produto(s) novo(s) no Booking". Os dois entram no Booking (o que já existia, como Aprovado).
- **Planilha do sistema chinês.** Use `tests/fixtures/produtos-china.xlsx` (2 linhas, cabeçalhos em chinês). Escolha "Linha padrão" antes de ver a conferência; sem ela as duas linhas vêm com "Linha não encontrada" e decisão "Ignorar". "Fornecedor não encontrado (fica sem vínculo)" aparece porque os nomes em chinês não existem no cadastro: é esperado.
- **CSV direto.** Use `type,name,country,email,phone,taxId` para parceiros (o `type` é o código em inglês: customer, supplier, agency, broker, shipping_line, carrier, legal, comex, logistics, ocp) ou `line,name,sku,specification` para produtos. Linha com tipo ou linha inexistente vai para "ignorados".
- O operador comprador, que abre Produtos mas não Importar, serve para mostrar o aviso de acesso negado ao clicar em "Importar CSV" (ver "Pontos a confirmar"). Mostre só se o episódio de acessos precisar.
- Para repetir a tomada, restaure o ponto de salvamento: a importação cria produtos, fornecedor e linhas do Booking de verdade.

### Pontos a confirmar

- ⚠ **Planilha `produtos-china.xlsx`**: o guia (seção 7.5) a descreve como ficha técnica do fluxo "Produtos → importar ficha". No código ela alimenta a **Importação de cadastros** (`/app/import`, mapeamento de colunas, cabeçalhos em chinês), e a ficha técnica do modelo SUPPLIER INFO usa outras colunas. O roteiro usa cada uma no seu fluxo; confirmar o texto do guia.
- ⚠ O botão **Importar CSV** aparece em Produtos para quem só abre Produtos (comprador, designer, ger. de produto). Para esses logins, clicar nele volta ao início com "Você não tem acesso a Importar planilha…" (visto na tela com o operador de demonstração). O mesmo vale para Outros parceiros.
- ⚠ O resumo da importação para o Booking diz "{n} produto(s) novo(s) no Booking" também para o produto que já existia e só ganhou a linha como Aprovado (visto na tela: "1 criado(s), 1 atualizado(s) … 2 novo(s) no Booking"). Confirmar se o texto deve separar os dois casos.
- ⚠ No CSV direto de parceiros o `type` tem de ser o código interno em inglês; "cliente" é ignorado em silêncio, e a dica da tela lista só os nomes das colunas. A lista do cartão diz "Parceiros", enquanto o menu diz "Outros parceiros" (e o CSV aceita cliente e fornecedor).
- ⚠ O download do Google Sheets e o arquivo `.xls` antigo não foram testados nesta sessão (sem rede e sem arquivo de exemplo): as mensagens vêm do dicionário.
- ⚠ O cartão "Como o portal lê a planilha" diz que o fornecedor da planilha é cadastrado se não existir; no Booking o fornecedor tem de ser escolhido na lista. O roteiro ensina o caminho do Booking.
- ⚠ Limite de 2.000 linhas e 80 produtos por planilha (código e docs/EVOLUTION_PLAN.md); só o de 80 aparece na tela ("Muitos produtos de uma vez (máximo 80 por planilha)").

---
## WCA-05 · Linhas de produto

> **Promessa:** ao final do vídeo você sabe criar uma linha de produto, escrever o checklist que o fornecedor cumpre, definir as certificações exigidas e configurar os prompts e os atributos que a IA e a ficha usam.

| Ficha                 |                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, cadastros                                                                                                                                               |
| Conta de gravação     | `admin@wellmix.com`, tela em pt (gerente de produto, cadastro e diretorias também abrem Linhas; o operador comprador não)                                         |
| Duração-alvo          | 3:40                                                                                                                                                             |
| Ponto da jornada      | Base de todas as etapas; o checklist vale na etapa 5 de 9, Preparação (ver `[MAPA]` em "Pontos a confirmar")                                                       |
| Telas e rotas         | `/app/lines`, `/app/lines?edit=[id]`, `/app/products/[id]` (cartões "Certificações e compliance" e "Atributos exigidos pela linha")                              |
| Dados antes de gravar | A carga de demonstração: as linhas Brinquedos, Infláveis (as duas com Inmetro) e Utilidades domésticas (com prompts, atributos "material, cor, dimensões" e uma regra). Ponto de salvamento `antes-WCA-05` |
| Depois deste vídeo    | A linha nova aparece na tabela e pode ser escolhida em Novo produto e nas importações. Certificações e prompts valem para os produtos da linha. Nenhum aviso é enviado |
| Antes · Próximo       | WCA-04 · WCA-06                                                                                                                                                  |
| Idiomas               | pt (base)                                                                                                                                                        |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/lines`**

- 🎬 Imagem: a tabela **Linhas de produto**, com a coluna "Certificações obrigatórias": "Inmetro" em vermelho em Brinquedos e em Infláveis, e "Nenhuma exigida" em Utilidades domésticas. O cursor passa pela coluna.
- 🎙 Narração: "Brinquedo e inflável exigem Inmetro; jarra e panela, não. Quem decide é a linha de produto."
- 🔤 Na tela: `[TÍTULO]` "WCA-05 · Linhas de produto"; `[ZOOM 150 %]` na coluna de certificações.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · O que é a linha · `/app/lines`**

- 🎬 Imagem: a mesma tabela. Um cartão de texto sobre ela com três linhas: "Checklist da Preparação", "Certificações exigidas" e "Prompts e regras (IA)".
- 🎙 Narração: "A linha é o molde dos produtos: define o checklist que o fornecedor cumpre, as certificações exigidas e as instruções para a IA."
- 🔤 Na tela: `[MAPA]` com as nove etapas apagadas e a faixa "Cadastros: a base"; `[QUEM VÊ]` "Administrador, gerente de produto, cadastro e diretorias".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · Abrir Linhas · menu → `/app/lines`**

- 🎬 Imagem: menu **Cadastros → Linhas**. Passar pelas colunas da tabela: Nome, Checklist de preparação, Certificações obrigatórias, Prompts e regras (IA), Produtos, Manual e Ações. Em Utilidades domésticas, mostrar os selos "material", "cor", "dimensões", "1 regra(s)" e "Prompts configurados"; nas outras, "Sem prompts". O número em "Produtos" é um link para a lista de produtos da linha.
- 🎙 Narração: "Em Cadastros, abra Linhas. A tabela mostra o checklist, as certificações obrigatórias, os prompts, quantos produtos a linha tem e o manual em PDF."
- 🔤 Na tela: `[PASSO 1/6] Abra Cadastros → Linhas`; `[SETA]` "Clique no número para ver os produtos da linha" na coluna Produtos; `[SETA]` "Ficha de compra: o checklist padrão".
- ✂️ Edição: `[ZOOM 150 %]` nas colunas, uma por vez, 2 s cada.

**Cena 4 · 0:45–1:20 · Nova linha e checklist · `/app/lines`**

- 🎬 Imagem: clicar em **+ Nova linha de produto**: abre o formulário com "Nome", "Manual (PDF)" e "Checklist de preparação" (a caixa já traz o exemplo `purchase_sheet | Ficha de compra | text | 1` e a dica "chave | rótulo | tipo (file, photo, text, number, date, confirm) | obrigatório (1/0)"). Digitar o nome "Cozinha e mesa" e trocar o checklist por três linhas: `purchase_sheet | Ficha de compra | text | 1`, `label_photo | Foto da etiqueta | photo | 1` e `manual_pdf | Manual de uso | file | 0`.
- 🎙 Narração: "Clique em Nova linha de produto. Dê o nome e, se quiser, envie o manual em PDF. No Checklist, escreva um item por linha: chave, rótulo, tipo e obrigatório, separados por barra vertical. Zero no fim deixa o item opcional."
- 🔤 Na tela: `[PASSO 2/6] Clique em "+ Nova linha de produto"`; `[SETA]` nos quatro campos de cada linha ("chave | rótulo | tipo | obrigatório"); `[DICA]` "Tipos: file, photo, text, number, date e confirm"; `[ATENÇÃO]` "Tipo desconhecido vira file; obrigatório é 1, e só 0 deixa opcional".
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` na caixa do checklist por 4 s.

**Cena 5 · 1:20–1:45 · Salvar · `/app/lines`**

- 🎬 Imagem: clicar em **Salvar**. A tabela volta com a linha "Cozinha e mesa": os itens do checklist aparecem como selos ("Ficha de compra", "Foto da etiqueta", "Manual de uso*"), o último com asterisco, e "Nenhuma exigida" nas certificações.
- 🎙 Narração: "Salvar. A linha aparece na tabela, e o item opcional ganha um asterisco. Esse é o checklist que o fornecedor cumpre na Preparação dos pedidos da linha."
- 🔤 Na tela: `[PASSO 3/6] Clique em "Salvar"`; `[BOTÃO] "Salvar"`; `[SETA]` "Asterisco: item opcional"; `[ERRO COMUM]` "Não foi possível concluir. Verifique os dados. (invalid_name)" (nome com menos de 2 letras).
- ✂️ Edição: para o `[ERRO COMUM]`, grave uma tomada com o nome "A" antes da certa; depois da tomada certa, restaure o ponto de salvamento para a linha de teste não ficar.

**Cena 6 · 1:45–2:25 · Certificações obrigatórias · `/app/lines?edit=[id]`**

- 🎬 Imagem: clicar em **Editar** na linha Infláveis: abre uma faixa com três cartões, "Editar: Infláveis", **Certificações obrigatórias** e **Prompts e regras (IA)**. No segundo, o campo com "Inmetro" e o botão **Salvar**, e a dica "Separadas por vírgula (ex.: Inmetro, Anvisa). Sem certificação válida no produto, o pedido entra na fila de revisão." Cortar para a ficha da Piscina inflável 2.000 L: o cartão **Certificações e compliance** com "Obrigatórias pela linha: Inmetro", "Faltantes: Inmetro" e o aviso vermelho.
- 🎙 Narração: "Clique em Editar para abrir os cartões da linha. Em Certificações obrigatórias, escreva o que todo produto precisa ter válido, separado por vírgula, como Inmetro. Sem certificação válida, o pedido entra na fila de revisão, e a ficha do produto mostra o que falta."
- 🔤 Na tela: `[PASSO 4/6] Defina as certificações obrigatórias`; `[BOTÃO] "Editar"`; `[SETA]` "Faltam certificações obrigatórias: Inmetro. Pedidos deste produto entram na fila de revisão até haver certificação válida."; `[QUEM VÊ]` "Certificações do produto: só a Wellmix".
- ✂️ Edição: `[ZOOM 150 %]` no aviso vermelho; o nome da certificação no produto tem de ser o mesmo exigido pela linha ("Mesmo nome exigido pela linha (ex.: Inmetro)").

**Cena 7 · 2:25–3:05 · Prompts e regras (IA) · `/app/lines?edit=[id]`**

- 🎬 Imagem: voltar a Linhas, abrir **Editar** em Utilidades domésticas e ir ao cartão **Prompts e regras (IA)**: o texto "Prompt Base + Linha + Produto + Contexto; nenhum prompt fica fixo em tela. A IA só sugere: a confirmação é sempre humana." e os campos "Prompt de descrição (cadastro)", "Prompt de marketing", "Prompt de imagem comercial", "Atributos exigidos" (material, cor, dimensões) e "Regras de validação" ("Não citar marcas de terceiros"). No fim, **Salvar prompts e regras**.
- 🎙 Narração: "O cartão Prompts e regras serve à IA, que só sugere: a confirmação é sempre humana. Há três prompts: descrição, marketing e imagem. Em Atributos exigidos, liste o que a ficha precisa ter, como material, cor e dimensões. As Regras de validação orientam o operador."
- 🔤 Na tela: `[PASSO 5/6] Configure os prompts e os atributos`; `[BOTÃO] "Salvar prompts e regras"`; `[SETA]` "Um por linha ou separados por vírgula" em Atributos exigidos; `[SETA]` "Entram no prompt e orientam o operador" em Regras de validação.
- ✂️ Edição: `[ZOOM 150 %]` nos campos preenchidos da carga; não salve nada (a carga já traz o exemplo); o cartão só tem efeito com a IA configurada, que na demonstração mostra o aviso na ficha do produto.

**Cena 8 · 3:05–3:25 · Atributos na ficha do produto · `/app/products/[id]`**

- 🎬 Imagem: ficha da Jarra de vidro 1,5 L, cartão **Atributos exigidos pela linha**: "Presentes (3)" com os selos "material", "cor" e "dimensões" marcados, "Faltando (0)", "Conferência manual (0)" e a frase "Todos os atributos exigidos estão preenchidos." (com a jarra incompleta, "Faltando" lista o que falta e o link "Preencher na ficha").
- 🎙 Narração: "Na ficha de cada produto, o cartão Atributos exigidos pela linha mostra o que está presente, o que falta e o que pede conferência manual."
- 🔤 Na tela: `[PASSO 6/6] Confira na ficha do produto`; `[SETA]` "Conferência por código, sem IA"; `[BOTÃO] "Preencher na ficha"` (quando falta algum).
- ✂️ Edição: grave duas tomadas, com a jarra completa e incompleta; mostre a incompleta antes.

**Cena 9 · 3:25–3:40 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WCA-06.
- 🎙 Narração: "Resumindo: crie a linha, escreva o checklist, defina as certificações e configure os prompts. No próximo vídeo, a vitrine como o cliente vê."
- 🔤 Na tela: `[RESUMO]` "1 Nova linha de produto · 2 Checklist da Preparação · 3 Certificações obrigatórias · 4 Prompts e atributos · 5 Confira na ficha"; chamada "Próximo: WCA-06 · A vitrine como o cliente vê".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** nome da linha com menos de duas letras. A tela mostra "Não foi possível concluir. Verifique os dados. (invalid_name)" (o código aparece no fim) → **Correção:** dê um nome com pelo menos duas letras.
- **Erro:** certificação cadastrada com nome diferente do exigido pela linha (por exemplo, "Inmetro 2026" no produto e "Inmetro" na linha). Maiúsculas e espaços nas pontas não contam, mas o resto tem de ser igual, e certificação vencida não vale. O produto continua com "Faltantes: Inmetro" → **Correção:** use o mesmo nome (a dica diz "Mesmo nome exigido pela linha (ex.: Inmetro)") e confira a validade.
- **Erro:** tipo do checklist escrito errado (por exemplo, "foto" em vez de "photo"). Não há mensagem: o item vira o tipo `file` → **Correção:** use um dos tipos da dica (file, photo, text, number, date, confirm).
- **Aviso:** pedido de produto sem certificação válida. "Faltam certificações obrigatórias: Inmetro. Pedidos deste produto entram na fila de revisão até haver certificação válida." → **Correção:** registre a certificação do produto (cartão "Certificações e compliance", **+ Registrar certificação**) ou valide a existente.
- **Aviso:** login sem a tela Linhas volta ao início com "Você não tem acesso a Linhas. Peça ao administrador em Gestão → Equipe e divisões." (visto na tela com o operador comprador) → **Correção:** o administrador marca a função (gerente de produto, cadastro ou diretoria) ou a tela.

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Linhas**. A tabela mostra o **Checklist de preparação**, as **Certificações obrigatórias**, os **Prompts e regras (IA)**, o número de **Produtos** e o **Manual**.
2. Clique em **+ Nova linha de produto**. Escreva o **Nome**; se quiser, escolha o **Manual (PDF)**.
3. No **Checklist de preparação**, escreva um item por linha no formato `chave | rótulo | tipo | obrigatório`. Os tipos são file, photo, text, number, date e confirm; 1 é obrigatório e 0, opcional. Clique em **Salvar**.
4. Para mudar uma linha, clique em **Editar** (ou no nome). Abrem três cartões: **Editar: {linha}** (nome, manual e checklist), **Certificações obrigatórias** e **Prompts e regras (IA)**. **Fechar** recolhe os cartões.
5. Em **Certificações obrigatórias**, escreva as certificações separadas por vírgula (ex.: Inmetro, Anvisa) e clique em **Salvar**. Sem certificação válida no produto, o pedido entra na fila de revisão.
6. Em **Prompts e regras (IA)**, preencha o **Prompt de descrição (cadastro)**, o **Prompt de marketing**, o **Prompt de imagem comercial**, os **Atributos exigidos** e as **Regras de validação**, e clique em **Salvar prompts e regras**.
7. Na ficha de cada produto, confira o cartão **Atributos exigidos pela linha** (Presentes, Faltando, Conferência manual) e, para produto com certificação exigida, o cartão **Certificações e compliance**.

### Notas de gravação

- Prepare o ponto de salvamento `antes-WCA-05`. A linha "Cozinha e mesa" da cena 4 é de exemplo: restaure o ponto depois da cena para ela não aparecer nos outros vídeos.
- Para a cena 6 use a ficha da **Piscina inflável 2.000 L** (linha Infláveis exige Inmetro e o produto não tem certificação): o aviso vermelho aparece na carga. A boneca tem Inmetro válido, e a jarra, sem exigência.
- O número de "Produtos" de cada linha conta só os produtos ativos.
- O manual em PDF fica visível ao fornecedor (visibilidade "supplier" no envio). Se gravar o envio, use um PDF próprio e curto.
- O cartão "Sugestão por foto (IA)" da ficha mostra o aviso de IA não configurada; não o abra neste vídeo.

### Pontos a confirmar

- ⚠ `[MAPA]`: o checklist da linha vale na etapa **5 · Preparação**; decidir se a cena 2 acende a etapa 5 em vez da faixa "Cadastros" (ver WCA-01).
- ⚠ O padrão do checklist: `docs/WORKFLOW.md` diz "dieline, foto profissional, peso, foto na balança, etiqueta", mas o código (`DEFAULT_PREPARATION_REQUIREMENTS`) e a tela trazem só "Ficha de compra" (visto na tela). A Preparação ainda soma as validações da Wellmix ("Ficha e imagens validadas pelo comprador" e "Cadastro do produto validado (cadastro)"). O roteiro segue o código.
- ⚠ Não conferido se mudar o checklist de uma linha altera pedidos que já existem (a lógica lê a linha na hora de montar as etapas); o vídeo diz "pedidos da linha" sem prometer o que acontece com os antigos.
- ⚠ Salvar o cartão "Editar: {linha}" (nome, manual e checklist) não mostra "Dados salvos."; os cartões de Certificações e de Prompts mostram. Visto na tela só na criação de linha nova; o resto, pelo código.
- ⚠ O erro de nome curto mostra o código técnico `(invalid_name)` no texto. Visto na tela.
- ⚠ A tolerância de peso por linha ainda é global (docs/OPEN_DECISIONS.md, "A confirmar com o negócio"); a margem por linha fica em Configurações (só o administrador). Nenhuma das duas está na tela Linhas: o vídeo não as cita.
- ⚠ Os prompts só têm efeito com a IA configurada ou em modo de demonstração rotulado (docs/OPEN_DECISIONS.md, `aiMode`); na demonstração a IA aparece como não configurada.

---
## WCA-06 · A vitrine como o cliente vê

> **Promessa:** ao final do vídeo você sabe abrir a prévia da vitrine, ler o que falta para o preço de um produto aparecer, corrigir e entender por que um produto ainda não aparece para o cliente.

| Ficha                 |                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, cadastros                                                                                                                                                                       |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; `joao@lojista.com` (cliente) só na cena 8, para mostrar o que o cliente faz a mais                                                                       |
| Duração-alvo          | 3:30                                                                                                                                                                                     |
| Ponto da jornada      | Entre a etapa 1 de 9 (Produto e Booking: produto na vitrine) e a etapa 2 (Solicitação: o cliente pede pela vitrine)                                                                       |
| Telas e rotas         | `/app/explore` (Cadastros → Vitrine do cliente), `/app/explore/[id]`, e as telas que corrigem o que falta: `/app/products/[id]` (ficha e ficha mestre) e `/app/settings` (só o administrador) |
| Dados antes de gravar | A Jarra de vidro 1,5 L com 5 fotos e 2 variações (WCA-03); os outros produtos da carga ("Sem foto", "Preço sob consulta"); o **Copo de vidro 300 ml**, importado no WCA-04 em "Mandar para o Booking" (etapa Novo, fora da vitrine). Configurações **sem** frete marítimo por CBM nem ICMS (como na carga), para a cena 5 mostrar o que falta (ponto de salvamento `antes-WCA-06`) |
| Depois deste vídeo    | Nada é enviado. Cada correção (frete, ICMS, II e IPI) vale para todos os produtos que dependem dela, e o preço aparece na vitrine do cliente na hora                                     |
| Antes · Próximo       | WCA-05 · fim da série (para ver o cliente usando a vitrine: CLI-01)                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                                                                |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/explore`**

- 🎬 Imagem: a vitrine **Explorar** com o cartão da jarra (foto, "2 variações", preço "a partir de" em reais) ao lado de cartões "Preço sob consulta" com o aviso amarelo. O cursor passa de um para o outro.
- 🎙 Narração: "Antes de o cliente ver, veja você: a vitrine mostra o produto com preço estimado e o que falta para o preço aparecer."
- 🔤 Na tela: `[TÍTULO]` "WCA-06 · A vitrine como o cliente vê"; `[ZOOM 150 %]` no cartão da jarra.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz. Grave esta cena no fim, depois de corrigir a jarra.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/explore`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Entre o cadastro do produto e o pedido do cliente está a vitrine: é ela que mostra o produto e o preço estimado."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa e "Solicitação" piscando uma vez; `[SETA]` "Aqui o cliente escolhe e pede".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · Abrir a prévia · menu → `/app/explore`**

- 🎬 Imagem: menu **Cadastros → Vitrine do cliente**. A tela abre com o aviso azul "Você está vendo a vitrine como o cliente vê (com a margem padrão). Só o cliente adiciona produtos ao carrinho." e, abaixo, o título **Explorar**, o campo de busca "Buscar produtos, categorias, materiais…" e o botão **Buscar**.
- 🎙 Narração: "Em Cadastros, clique em Vitrine do cliente. O aviso azul lembra: você vê a vitrine como o cliente vê, com a margem padrão. Só o cliente adiciona ao carrinho."
- 🔤 Na tela: `[PASSO 1/6] Abra Cadastros → Vitrine do cliente`; `[SETA]` "Margem padrão: o cliente pode ter margem própria"; `[QUEM VÊ]` "Administrador, gerente de produto, cadastro, diretorias e designer; o comprador e o planner não abrem esta tela".
- ✂️ Edição: `[ZOOM 150 %]` no aviso azul por 3 s.

**Cena 4 · 0:45–1:15 · O cartão do produto · `/app/explore`**

- 🎬 Imagem: no cartão da jarra: a linha "Utilidades domésticas", o nome, "2 variações", o preço em reais "a partir de … por unidade, preço estimado" e o "Pedido mínimo: … un". Mostrar a faixa de três quadros no alto ("Preço com frete e impostos", "Proposta em até 5 dias úteis", "Acompanhe até a entrega"), as pílulas de categoria ("Todos", "Brinquedos", "Infláveis", "Utilidades domésticas", cada uma com a contagem) e a ordem ("Mais relevantes", "Menor preço", "Maior preço", "Novidades"). Abrir o cartão da jarra: a página do produto com as fotos em miniatura e "Características".
- 🎙 Narração: "Cada cartão tem foto, linha, nome, preço estimado com frete marítimo e impostos, pedido mínimo e selos, como Pronta entrega ou A caminho. Com variações, aparece o selo de variações e o preço a partir de."
- 🔤 Na tela: `[PASSO 2/6] Leia o cartão`; `[SETA]` "Preço estimado já com frete e impostos" no preço; `[SETA]` "Menor preço entre as variações" no "a partir de"; `[DICA]` "A foto do cartão é a principal do produto (WCA-03)".
- ✂️ Edição: `[ZOOM 150 %]` no preço e no selo de variações; os selos "Pronta entrega" e "A caminho" só aparecem com estoque (a demonstração não tem).

**Cena 5 · 1:15–1:55 · O que falta para o preço aparecer · `/app/explore`**

- 🎬 Imagem: o cartão da Boneca articulada 30 cm: "Preço sob consulta" e, em âmbar, "Para o preço aparecer, falta: frete marítimo por CBM (Configurações), II (NCM), IPI (NCM), ICMS (Configurações)". Mostrar também o da jarra antes da correção: "falta: preço do fornecedor, frete marítimo por CBM (Configurações), II (NCM), IPI (NCM), ICMS (Configurações)". Na página do produto, o mesmo aviso e a frase "A Wellmix informa o valor na proposta."
- 🎙 Narração: "Sem preço, o cartão diz Preço sob consulta. Só a Wellmix vê o aviso amarelo: Para o preço aparecer, falta. Ele lista o que falta: preço do fornecedor, câmbio, frete marítimo e ICMS nas Configurações, caixa master e CBM na ficha, e II e IPI pelo NCM."
- 🔤 Na tela: `[PASSO 3/6] Leia "Para o preço aparecer, falta"`; `[QUEM VÊ]` "O aviso é só da Wellmix; o cliente vê apenas Preço sob consulta"; `[SETA]` em cada item do aviso com onde se corrige: "preço do fornecedor" (ficha), "câmbio da moeda" (Configurações), "frete marítimo por CBM" (Configurações), "caixa master e CBM" (ficha), "II (NCM)" e "IPI (NCM)" (NCM ou ficha mestre), "ICMS" (Configurações).
- ✂️ Edição: `[ZOOM 150 %]` no aviso por 4 s; cada `[SETA]` entra no ritmo da narração.

**Cena 6 · 1:55–2:25 · Corrigir e conferir · `/app/settings`, `/app/products/[id]`, `/app/explore`**

- 🎬 Imagem: corte rápido para três lugares, sem narrar campo por campo: Configurações, onde o administrador informa o "Frete marítimo estimado por CBM" e o "ICMS da importação (%)"; a ficha mestre da jarra, no bloco "Despachante (NCM e impostos)", com os campos "I.I. (%)" e "IPI (%)"; e a ficha, com "Preço" e "Moeda" (ou o preço da variação). De volta à vitrine, o cartão da jarra agora mostra o preço, e o aviso sumiu.
- 🎙 Narração: "Corrija o que falta e o preço aparece. Frete e ICMS são do administrador, em Configurações. II e IPI vêm do NCM ou da ficha mestre. O preço vem da ficha ou da variação. O cliente vê só o preço, nunca o fornecedor."
- 🔤 Na tela: `[PASSO 4/6] Corrija e volte à vitrine`; `[QUEM VÊ]` "Configurações: só o administrador"; `[BOTÃO] "Salvar ficha mestre"`; `[ATENÇÃO]` "O cliente nunca vê fornecedor, preço FOB, moeda nem código da fábrica".
- ✂️ Edição: `[CORTE]` seco entre as telas; os números de frete, ICMS, II e IPI do vídeo são de exemplo e não devem ser lidos nem aparecer em zoom (ver "Pontos a confirmar").

**Cena 7 · 2:25–2:55 · Produto escondido pelo Booking · `/app/explore/[id]`**

- 🎬 Imagem: o Copo de vidro 300 ml não aparece na grade (a contagem "Todos" também não o inclui). Abrir o endereço direto do copo (`/app/explore/<id do copo>`): a página mostra o aviso âmbar "Em Booking: o cliente ainda não vê este produto. Ele entra na vitrine quando for aprovado no Booking." com o link **Abrir o Booking**.
- 🎙 Narração: "Atenção: produto que veio por planilha e ainda não foi aprovado no Booking não aparece na grade, nem para você. Pelo endereço direto, a página avisa que o cliente ainda não o vê. O mesmo vale para o produto criado por solicitação, até Liberar na vitrine."
- 🔤 Na tela: `[PASSO 5/6] Entenda por que o produto não aparece`; `[ATENÇÃO]` "Novo, Em análise e Descartado ficam fora da vitrine"; `[SETA]` "Aprovado em diante aparece" ; `[BOTÃO] "Abrir o Booking"`.
- ✂️ Edição: mostre a barra de endereço com o `/app/explore/…` digitado; o id do produto sai da barra de endereço de `/app/products/[id]`.

**Cena 8 · 2:55–3:15 · Teste como o cliente · `/app/explore` e entrada do cliente**

- 🎬 Imagem: na vitrine, digitar "jarra" e clicar em **Buscar**; clicar na pílula "Utilidades domésticas" (categoria) e em "Menor preço". Corte para o cliente (`joao@lojista.com`) na página da jarra: o quadro "Escolha a variação" com as duas variações, o campo "Quantidade (un)" e o botão **Adicionar ao carrinho**; a Wellmix não vê esses controles.
- 🎙 Narração: "Teste como o cliente: busque, filtre por categoria, que são as linhas, e ordene por preço ou novidades. Para escolher variação e usar o carrinho, entre como o cliente: só ele faz isso."
- 🔤 Na tela: `[PASSO 6/6] Teste a busca, as categorias e a ordem`; `[BOTÃO] "Buscar"`; `[SETA]` "Escolha a variação: só o cliente vê"; `[QUEM VÊ]` "Cliente: variação, carrinho e Solicitar orçamento agora".
- ✂️ Edição: o corte para o cliente usa outro perfil do Chrome já logado; `[ZOOM 150 %]` no seletor de variação.

**Cena 9 · 3:15–3:30 · Resumo e fim da série**

- 🎬 Imagem: fundo vermelho com a lista; no fim, o cartão "Série WCA concluída" e a miniatura do CLI-01.
- 🎙 Narração: "Resumindo: abra a prévia, leia o que falta, corrija e lembre do Booking. Para ver o cliente usando a vitrine, assista ao vídeo do cliente."
- 🔤 Na tela: `[RESUMO]` "1 Cadastros → Vitrine do cliente · 2 Leia o cartão · 3 Para o preço aparecer, falta · 4 Corrija · 5 Booking esconde o produto"; chamada "Próximo: CLI-01 · Explorar a vitrine".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** produto que o cliente não vê. Três causas: o produto está excluído ou desativado (ficha: "Produto ativo" desmarcado); veio de planilha e está em Novo, Em análise ou Descartado no Booking (a página mostra "Em Booking: o cliente ainda não vê este produto. Ele entra na vitrine quando for aprovado no Booking."); ou foi criado por solicitação ao fornecedor e ainda não foi liberado ("Fora da vitrine do cliente até ser liberado.") → **Correção:** reative, aprove no Booking ou use "Liberar na vitrine".
- **Erro:** "o preço não aparece". O cartão mostra "Preço sob consulta" e, para a Wellmix, "Para o preço aparecer, falta: …" com os itens (preço do fornecedor, câmbio da moeda, frete marítimo por CBM (Configurações), caixa master e CBM, II (NCM), IPI (NCM), ICMS (Configurações)) → **Correção:** complete cada item no lugar indicado (cena 6).
- **Aviso:** login sem a tela Vitrine do cliente volta ao início com "Você não tem acesso a Vitrine do cliente. Peça ao administrador em Gestão → Equipe e divisões." (visto na tela com o operador comprador) → **Correção:** o administrador marca a função (gerente de produto, cadastro, diretoria ou designer) ou a tela.
- **Aviso (cliente):** com os pedidos pela vitrine desligados, o cliente vê "Para pedir orçamento, fale com a Wellmix: os pedidos pela vitrine estão desligados no momento." → **Correção:** o administrador religa em Configurações.

### Passo a passo em texto

1. No menu, abra **Cadastros** e clique em **Vitrine do cliente**. O aviso azul diz que você vê a vitrine como o cliente vê, com a margem padrão.
2. Leia o cartão do produto: foto, linha, nome, preço estimado (com frete marítimo e impostos), pedido mínimo e selos (**Pronta entrega**, **A caminho**, **Você já comprou** só para o cliente). Com variações, aparecem o selo de variações e o preço a partir de.
3. Em produto sem preço, leia o aviso "Para o preço aparecer, falta: …". Só a Wellmix o vê; o cliente vê "Preço sob consulta".
4. Corrija cada item: **preço do fornecedor** e **caixa master e CBM** na ficha do produto; **câmbio**, **frete marítimo por CBM** e **ICMS** em Configurações (só o administrador); **II (NCM)** e **IPI (NCM)** pela tabela fiscal (NCM) ou na ficha mestre, nos campos "I.I. (%)" e "IPI (%)".
5. Volte à vitrine: o preço aparece sem outro passo.
6. Produto que veio por planilha e está em Novo, Em análise ou Descartado no Booking, ou produto criado por solicitação ao fornecedor ainda não liberado, não aparece na grade. Pelo endereço direto, a página mostra "Em Booking: o cliente ainda não vê este produto…".
7. Use a busca, as categorias (as linhas de produto) e a ordem (**Mais relevantes**, **Menor preço**, **Maior preço**, **Novidades**) para testar. Escolher variação e adicionar ao carrinho é do cliente.

### Notas de gravação

- Grave a cena 5 **antes** da cena 6 e a cena 1 **depois**: com o ponto de salvamento `antes-WCA-06` a jarra mostra o aviso; depois da correção, o preço.
- Para a cena 6 foram usados, na verificação, o frete marítimo estimado por CBM em dólar, o ICMS da importação, o câmbio manual do dólar e, na ficha mestre da jarra, "I.I. (%)" e "IPI (%)". Todos são números de exemplo; não os leia nem os mostre em zoom. O preço estimado da vitrine muda com eles e com o dia, por isso a narração não cita valores.
- Os campos de II e IPI da ficha mestre ficam no bloco "Despachante (NCM e impostos)"; a ficha abre um bloco por vez: clique em "Mostrar tudo" para ver todos.
- Cena 7: o produto escondido não tem link na vitrine. Abra a ficha do copo em Produtos, copie o código do endereço (`/app/products/<id>`) e digite `/app/explore/<id>`.
- Cena 8: o cliente vê "Você já comprou" na jarra se o pedido da Jornada existir; o selo é só dele.
- A busca por foto ou link (Nova solicitação) está pausada e não faz parte desta vitrine (guia, seção 7.5).

### Pontos a confirmar

- ⚠ A grade nunca lista produto escondido pelo Booking, nem para a Wellmix (a prévia é "como o cliente vê"). O aviso "Em Booking: o cliente ainda não vê este produto…" só aparece abrindo o endereço do produto, que não tem link em nenhuma tela. Confirmar se é o comportamento desejado; o roteiro ensina o endereço direto.
- ⚠ A Wellmix vê "N variações" mas não o seletor de variação nem o carrinho; só o cliente vê. Visto na tela.
- ⚠ O preço da prévia usa a margem padrão (geral ou da linha, sem margem de cliente). O cliente pode ter margem própria em Configurações, então o preço que ele vê pode diferir do da prévia (docs/OPEN_DECISIONS.md; código `resolveMargin`). Não conferido na tela com margem de cliente.
- ⚠ Os selos "Pronta entrega" e "A caminho" dependem de estoque (Estoque está vazio na carga) e não foram vistos na tela; o texto vem do dicionário.
- ⚠ "Proposta em até 5 dias úteis" usa o prazo de resposta das Configurações (5 na carga); o número muda se o administrador mudar.
- ⚠ O item "câmbio da moeda" do aviso não apareceu na demonstração (há câmbio padrão); o texto vem do dicionário.
- ⚠ Valores de frete, ICMS, câmbio, II e IPI são decisões de negócio do dono (docs/OPEN_DECISIONS.md); o roteiro não afirma nenhum valor.
- ⚠ O vídeo CLI-01 (Explorar a vitrine) é citado em 02-cliente.md como o episódio anterior ao CLI-02; confirmar o título e a ordem no README da série.

---

## Antes de publicar a série WCA

- Regravar os episódios afetados quando um PR mudar as rotas da ficha de cada um (guia, seção 11): WCA-01 (`/app/customers`, `/app/suppliers`, `/app/parties/[id]`), WCA-02 (`/app/parties/[id]`, `/login`), WCA-03 (`/app/products`, `/app/products/[id]`), WCA-04 (`/app/products/import`, `/app/import`), WCA-05 (`/app/lines`), WCA-06 (`/app/explore`).
- Se o dono confirmar que o cadastro novo deve nascer **ativo**, regrave o WCA-02, cena 5, e retire o alerta de "Erros comuns" do WCA-01.
- Se o dono decidir mostrar o produto escondido na grade da prévia (com um selo "Em Booking"), regrave o WCA-06, cena 7.
