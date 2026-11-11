# Série CLI · Cliente

Vídeos para quem compra da Wellmix pelo portal: a Loja do João (`joao@lojista.com`, tela em pt). O cliente vê **a vitrine (Explorar)** e o grupo **Meus pedidos** (Orçamentos, Pedidos, Pendências, Notificações, Mensagens, Histórico, Marketing). Ele nunca vê o fornecedor, o preço FOB, a margem nem as cotações; só a situação delas ("RFQ aberta", "Cotações recebidas") e o preço de venda que a Wellmix define (docs/SCOPE.md, docs/ACCESS.md). Conta de gravação: `joao@lojista.com` (Loja do João Ltda), senha `wellmix123`, tela em pt. Documentos lidos: `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/ACCESS.md`, `docs/QUOTE_FLOW.md`, `docs/CUSTOMERS.md`, `docs/PRODUCT_VARIANTS.md`, `docs/INVENTORY.md`, `docs/RFQ_STANDBY.md`, `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/RECEIVING.md`; o código de `src/app/app/{explore,requests,orders,history,marketing,notifications,messages,tasks}` e os testes `tests/e2e/happy-path.spec.ts` e `tests/e2e/booking-supplier-request.spec.ts`.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os episódios seguem o modelo da seção 5 do guia.

| ID      | Episódio                                          | Duração-alvo | Situação             |
| ------- | ------------------------------------------------- | ------------ | -------------------- |
| CLI-01  | Explorar a vitrine e montar o carrinho            | 4:30         | roteirizado          |
| CLI-02  | Fazer uma nova solicitação                        | 4:30         | roteirizado (modelo) |
| CLI-03  | Proposta e sinal                                  | 4:30         | roteirizado          |
| CLI-04  | Acompanhar o pedido                               | 4:00         | roteirizado          |
| CLI-05  | Receber a carga e avaliar a compra                | 3:30         | roteirizado          |
| CLI-06  | Comprar de novo, pedir nova proposta e cancelar   | 4:30         | roteirizado          |
| CLI-07  | Histórico e Marketing                             | 3:30         | roteirizado          |

Antes de cada episódio, veja a série [GER · Primeiros passos](01-primeiros-passos.md): GER-01 ensina o login e o menu; GER-02, as pendências, o sino e as mensagens.

---

## CLI-01 · Explorar a vitrine e montar o carrinho

> **Promessa:** ao final do vídeo você sabe achar um produto na vitrine, ler o preço estimado e os selos, montar o carrinho e pedir o orçamento de vários produtos de uma vez.

| Ficha                 |                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                                                                                                                             |
| Conta de gravação     | `joao@lojista.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa)                                                                                                                                                 |
| Duração-alvo          | 4:30                                                                                                                                                                                                                                |
| Ponto da jornada      | Etapa 2 de 9: Solicitação (pelo caminho da vitrine)                                                                                                                                                                                  |
| Telas e rotas         | `/app/explore` (Explorar), `/app/explore/[id]` (página do produto), `/app/explore/cart` (Carrinho), `/app/requests/batch/[grupo]?created=N&fromCart=1` (vários produtos) ou `/app/requests/[id]?fromCart=1` (um produto)               |
| Dados antes de gravar | Ponto de salvamento `antes-CLI-01`: os quatro produtos ativos com **foto, pedido mínimo e preço estimado** (guia, seção 7.5: preço do fornecedor, câmbio, frete marítimo por CBM, caixa master e CBM, II, IPI e ICMS), cliente **sem solicitações** e com o carrinho vazio. Para os selos: "Pronta entrega" e "A caminho" pedem mercadoria sem pedido de cliente num container (Containers, `docs/INVENTORY.md`); "Você já comprou" pede um pedido anterior do mesmo produto (grave essa cena depois do CLI-05) |
| Depois deste vídeo    | Cada produto do carrinho vira uma solicitação **Solicitado**, todas num lote com o mesmo número; o carrinho esvazia. A Wellmix passa a ter a pendência de enviar cada uma ao fornecedor (CLI-03 mostra a resposta)                       |
| Antes · Próximo       | GER-02 · CLI-02 (o outro caminho: pedir pelo formulário)                                                                                                                                                                             |
| Idiomas               | pt (base)                                                                                                                                                                                                                           |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/explore`**

- 🎬 Imagem: a vitrine **Explorar** com os cartões dos produtos, o preço estimado em destaque ("R$ …/un" e "preço estimado") e o botão "Carrinho" com o número no canto.
- 🎙 Narração: "Quer saber quanto custa importar, antes de pedir? A vitrine mostra o preço estimado, já com frete marítimo e impostos, e leva o seu pedido ao carrinho."
- 🔤 Na tela: `[TÍTULO]` "CLI-01 · Explorar a vitrine e montar o carrinho"; `[ZOOM 150 %]` no preço de um cartão.
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:22 · Onde estou na jornada · `/app/explore`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Este é o começo da jornada: a solicitação. Pela vitrine, você escolhe o produto e pede o orçamento num só lugar."
- 🔤 Na tela: `[MAPA etapa 2]` com "Solicitação" acesa e as etapas seguintes apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:52 · A vitrine por dentro · `/app/explore`**

- 🎬 Imagem: o cursor percorre a faixa vermelha com o título **Explorar** e o texto "Produtos importados com preço estimado já com frete marítimo e impostos.", o campo de busca ("Buscar produtos, categorias, materiais…") e o botão "Buscar". Depois, os três selos: "Preço com frete e impostos", "Proposta em até 5 dias úteis" e "Acompanhe até a entrega". O menu do cliente aparece: **Explorar** é o início; o resto fica em **Meus pedidos**.
- 🎙 Narração: "Explorar é a sua primeira tela. Em cima, a busca e o carrinho. Logo abaixo, três promessas: preço com frete e impostos, proposta em até cinco dias úteis e acompanhamento até a entrega."
- 🔤 Na tela: `[PASSO 1/8] Abra Explorar`; `[SETA]` "Preço estimado pelo câmbio de hoje" no primeiro selo; `[SETA]` "A Wellmix cota com os fornecedores" no segundo.
- ✂️ Edição: `[ZOOM 150 %]` nos três selos por 3 s.

**Cena 4 · 0:52–1:25 · Buscar · `/app/explore?q=…`**

- 🎬 Imagem: no campo de busca, digitar devagar "JARRA": a lista se atualiza sozinha a cada pausa; a linha "1 resultado para “JARRA”" e o link "Limpar busca" aparecem. Apagar e digitar "panelas" para mostrar que a busca ignora acento e caixa. Clicar em "Limpar busca".
- 🎙 Narração: "Digite o que procura: produto, categoria ou material. A lista se atualiza sozinha, sem acento nem caixa. Quando quiser todos os produtos de novo, clique em Limpar busca."
- 🔤 Na tela: `[PASSO 2/8] Busque o produto`; `[BOTÃO] "Buscar"`; `[BOTÃO] "Limpar busca"`; `[DICA]` "Não precisa apertar Buscar: a lista atualiza enquanto você digita."
- ✂️ Edição: digitação em tempo real; `[CORTE]` entre cada resultado.

**Cena 5 · 1:25–1:50 · Categorias e ordem · `/app/explore?line=…&sort=…`**

- 🎬 Imagem: os botões de categoria com a contagem: "Todos 4", "Brinquedos", "Infláveis", "Utilidades domésticas". Clicar em uma categoria. À direita, o grupo "Ordenar por": "Mais relevantes", "Menor preço", "Maior preço", "Novidades". Clicar em "Menor preço".
- 🎙 Narração: "As categorias filtram a vitrine e mostram quantos produtos têm. Em Ordenar por, escolha Mais relevantes, Menor preço, Maior preço ou Novidades. Nas ordens por preço, produto sem preço fica no fim."
- 🔤 Na tela: `[PASSO 3/8] Escolha a categoria e a ordem`; `[SETA]` "Quantidade de produtos da categoria" na contagem; `[BOTÃO] "Menor preço"`.
- ✂️ Edição: `[ZOOM 150 %]` na barra de ordem.

**Cena 6 · 1:50–2:25 · O cartão e os selos · `/app/explore`**

- 🎬 Imagem: um cartão de produto de perto: foto, a categoria em letras pequenas, o nome, o preço estimado e a linha "Pedido mínimo: 300 un". Cada selo sobre a foto: "Pronta entrega" (verde), "A caminho" (âmbar) e "Você já comprou". Um cartão com "Preço sob consulta" para mostrar o que acontece quando falta dado.
- 🎙 Narração: "No cartão, o preço é estimado, por unidade, e o pedido mínimo vem logo abaixo. Pronta entrega quer dizer que já está no Brasil. A caminho, que está em trânsito. Você já comprou lembra o que já pediu antes."
- 🔤 Na tela: `[SETA]` "Pronta entrega: já está no Brasil"; `[SETA]` "A caminho: em trânsito"; `[SETA]` "Você já comprou: já está no seu histórico"; `[SETA]` "Preço sob consulta: a Wellmix informa na proposta"; `[QUEM VÊ]` "Você nunca vê o fornecedor nem o preço de compra".
- ✂️ Edição: `[ZOOM 150 %]` em cada selo, 2 s cada; os cartões ficam num ponto de salvamento posterior ao CLI-05 para mostrar "Você já comprou".

**Cena 7 · 2:25–3:05 · A página do produto · `/app/explore/[id]`**

- 🎬 Imagem: clicar no cartão da Piscina inflável 2.000 L. A página abre: as fotos, o nome, o preço estimado, "Pedido mínimo: 300 un". Rolar até "Características". Na caixa de compra: "Quantidade (un)" com os botões − e +, começando no pedido mínimo; digitar 100: aparece "Pedido mínimo: 300 un. Ao sair do campo, volta ao mínimo." Corrigir para 400. No campo "Personalização (opcional)" digitar "Logo da loja na caixa".
- 🎙 Narração: "Abra o produto para ver fotos, características e o pedido mínimo. Escolha a quantidade: o campo não aceita menos que o mínimo. Em Personalização, conte o que precisa, como a cor ou o logo da sua loja."
- 🔤 Na tela: `[PASSO 4/8] Abra o produto`; `[PASSO 5/8] Informe quantidade e personalização`; `[ERRO COMUM]` "Pedido mínimo: 300 un. Ao sair do campo, volta ao mínimo." e a correção; `[DICA]` "Com preço por faixa, a tabela 'Preço por quantidade' mostra o valor a partir de cada quantidade."
- ✂️ Edição: `[ZOOM 150 %]` no aviso do mínimo; digitação em tempo real.

**Cena 8 · 3:05–3:35 · Adicionar ao carrinho · `/app/explore/[id]` → `/app/explore/cart`**

- 🎬 Imagem: a caixa de compra tem dois botões: "Adicionar ao carrinho" e "Solicitar orçamento agora". Clicar em "Adicionar ao carrinho": a faixa verde "Adicionado ao carrinho." com "Ver carrinho". Voltar a Explorar, adicionar a Jarra de vidro pelo botão do cartão ("Adicionar 1 un" muda conforme a quantidade; depois do clique aparece "No carrinho · Ver carrinho"). Clicar em "Carrinho": a página com os dois itens, cada um com quantidade, personalização, "Atualizar" e "Remover", e o resumo "Total estimado".
- 🎙 Narração: "Adicionar ao carrinho guarda o produto para você pedir junto com outros. Solicitar orçamento agora pede só este item. No carrinho, mude a quantidade e a personalização: tudo é salvo ao sair do campo."
- 🔤 Na tela: `[PASSO 6/8] Adicione ao carrinho`; `[BOTÃO] "Adicionar ao carrinho"`; `[BOTÃO] "Solicitar orçamento agora"`; `[PASSO 7/8] Confira o carrinho`; `[BOTÃO] "Atualizar"`; `[BOTÃO] "Remover"`; `[SETA]` "As quantidades e a personalização são salvas ao sair do campo".
- ✂️ Edição: manter 3 s no resumo "Total estimado" (ou "Sob consulta" quando algum item não tem preço).

**Cena 9 · 3:35–4:05 · Prazo desejado e observações · `/app/explore/cart`**

- 🎬 Imagem: no resumo, o campo de data "Quando você precisa? (opcional)": escolher 20/12/2026. Em "Observações para a Wellmix (opcional)", digitar "Entrega em Curitiba". Rolar até o botão vermelho "Solicitar orçamento" e o texto "Cada produto vira um orçamento. A proposta chega até 17/11/2026."
- 🎙 Narração: "Se tiver uma data em mente, informe em Quando você precisa. É só um aviso para a Wellmix planejar: a proposta continua chegando no prazo combinado. Use as observações para qualquer detalhe, como o endereço de entrega."
- 🔤 Na tela: `[SETA]` "A data é um aviso, não muda o prazo da proposta"; `[ATENÇÃO]` "Cada produto vira uma solicitação própria"; `[ERRO COMUM]` "Data inválida: escolha uma data a partir de hoje." e a correção.
- ✂️ Edição: a data precisa aparecer em dd/mm/aaaa; `[ZOOM 150 %]` no texto "A proposta chega até …".

**Cena 10 · 4:05–4:20 · Solicitar orçamento · `/app/explore/cart` → `/app/requests/batch/[grupo]`**

- 🎬 Imagem: clicar em "Solicitar orçamento". A barra vermelha corre no topo e abre a página "Solicitação nº 1 · 2 produtos", com a faixa verde "Pedido de orçamento enviado! A Wellmix vai cotar com os fornecedores e mandar a proposta. 2 solicitações criadas num lote." e a tabela dos dois produtos, cada um com a situação **Solicitado**.
- 🎙 Narração: "Clique em Solicitar orçamento. Pronto: cada produto nasceu como Solicitado, com o mesmo número de lote. A Wellmix cota com os fornecedores e a proposta chega até a data indicada."
- 🔤 Na tela: `[PASSO 8/8] Clique em Solicitar orçamento`; `[BOTÃO] "Solicitar orçamento"`; `[SETA]` "Situação: Solicitado"; `[DEPOIS]` "A Wellmix recebe a pendência de enviar cada produto ao fornecedor. Você acompanha em Orçamentos."
- ✂️ Edição: `[CORTE]` na abertura da página; cartão `[DEPOIS]` de 4 s.

**Cena 11 · 4:20–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-02.
- 🎙 Narração: "Resumindo: busque, abra o produto, informe a quantidade, adicione ao carrinho e peça o orçamento. Não achou? No próximo vídeo, peça pelo formulário."
- 🔤 Na tela: `[RESUMO]` "1 Busque e escolha o produto · 2 Informe quantidade e personalização · 3 Adicione ao carrinho · 4 Solicitar orçamento"; chamada "Próximo: CLI-02 · Fazer uma nova solicitação".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** quantidade abaixo do pedido mínimo. A página do produto avisa "Pedido mínimo: {n} un. Ao sair do campo, volta ao mínimo." e, se o valor chegar ao servidor, ele recusa com "Quantidade abaixo do pedido mínimo deste produto." → **Correção:** use pelo menos o mínimo que a tela mostra. No carrinho, o item antigo que ficou abaixo do mínimo mostra "Abaixo do pedido mínimo ({n} un). Ao alterar a quantidade, ela sobe pelo menos até o mínimo."
- **Erro:** produto com variações adicionado sem escolher uma. A tela mostra "Escolha a variação do produto antes de adicionar." → **Correção:** abra a página do produto (o cartão traz o selo "{n} variações" e o botão "Escolher variação"), escolha a variação (o cartão mostra "a partir de" o menor preço) e adicione.
- **Erro:** data de prazo no passado. A tela mostra "Data inválida: escolha uma data a partir de hoje." → **Correção:** escolha hoje ou uma data futura, ou deixe em branco.
- **Erro:** produto que saiu do catálogo depois de entrar no carrinho. O item mostra "Este produto saiu do catálogo e não será enviado. Remova-o do carrinho." (e, ao adicionar, "Este produto não está mais disponível no catálogo.") → **Correção:** clique em "Remover".
- **Erro:** carrinho cheio. A tela mostra "O carrinho chegou a 50 produtos: envie este orçamento e comece outro." → **Correção:** envie o orçamento e comece outro carrinho.
- **Aviso:** com os pedidos pela vitrine desligados, a tela mostra "Para pedir orçamento, fale com a Wellmix: os pedidos pela vitrine estão desligados no momento." → **Correção:** falar com a Wellmix pelo botão de conversa.

### Passo a passo em texto

1. No menu, clique em **Explorar** (é a sua primeira tela depois do login).
2. Digite na busca o produto, a categoria ou o material. A lista se atualiza sozinha; **Limpar busca** mostra tudo de novo.
3. Escolha uma categoria nos botões e, em **Ordenar por**, **Mais relevantes**, **Menor preço**, **Maior preço** ou **Novidades**.
4. Leia o cartão: o preço é **estimado** (com frete marítimo e impostos, pelo câmbio de hoje) e vem em R$ por unidade; abaixo, o **Pedido mínimo**. Os selos: **Pronta entrega** (já no Brasil), **A caminho** (em trânsito) e **Você já comprou**. **Preço sob consulta** quer dizer que a Wellmix informa o valor na proposta.
5. Clique no cartão para abrir a página do produto: fotos, preço, **Preço por quantidade** (quando existe) e **Características**. Se o produto tem variações, escolha uma em **Escolha a variação**.
6. Informe a **Quantidade (un)** (nunca abaixo do mínimo) e, se quiser, a **Personalização (opcional)**.
7. Clique em **Adicionar ao carrinho** (para pedir junto com outros) ou em **Solicitar orçamento agora** (só este produto, sem passar pelo carrinho).
8. Clique em **Carrinho**. Ajuste quantidade e personalização (**Atualizar** ou sair do campo) e use **Remover** no que não quer mais.
9. Em **Quando você precisa? (opcional)** escolha uma data e, em **Observações para a Wellmix (opcional)**, escreva o que for útil.
10. Clique em **Solicitar orçamento**. Cada produto vira uma solicitação **Solicitado**, todas no mesmo lote. Acompanhe em **Orçamentos**.

### Notas de gravação

- **Preço e foto:** sem preparar o cadastro, os cartões mostram "Sem foto" e "Preço sob consulta" (guia, seção 7.5). A Wellmix vê, nesses cartões, o aviso "Para o preço aparecer, falta: …"; **o cliente nunca vê esse aviso**. Grave só com a conta do cliente e depois que o preço aparecer.
- **Quantidade inicial do cartão:** com preço, o botão do cartão ("Adicionar N un") já vem com a quantidade de referência da conta do preço; sem preço, com o pedido mínimo; **sem pedido mínimo nem preço, vem "Adicionar 1 un"**. Cadastre o pedido mínimo da Jarra na ficha antes de gravar, para o exemplo não começar em uma unidade.
- **Busca ao vivo:** a lista atualiza a cada pausa de 0,35 s na digitação; digite devagar para a tela acompanhar.
- **Prazo "até 17/11/2026":** a data da frase "A proposta chega até …" são 5 dias úteis (valor das Configurações) contados no horário de Brasília; confira no dia da gravação e não cite o número de dias na narração além do que a tela mostra.
- **Data do campo:** o Chrome em pt-BR mostra dd/mm/aaaa; em outro idioma do navegador o campo sai mm/dd/yyyy.
- **Selos "Pronta entrega" e "A caminho":** ver "Pontos a confirmar". **"Você já comprou"** aparece depois que existe um pedido (não cancelado) do produto para o cliente.
- **Sem fornecedor, sem FOB:** o roteiro nunca mostra a tela da vitrine da Wellmix (menu Cadastros → Vitrine do cliente), que tem o aviso azul "Você está vendo a vitrine como o cliente vê…" e o que falta no preço.
- **Faixa âmbar e seletor DEMO:** esconda os dois (guia, seção 7.3).

### Pontos a confirmar

- ⚠ **Pronta entrega e A caminho:** não consegui vê-los na tela (a carga de demonstração não tem mercadoria em container). Pelo código (`stockBadges`): "Pronta entrega" = mercadoria sem pedido de cliente em container já chegado; "A caminho" = só há mercadoria em container planejado, carregando ou embarcado. Gravar depois de montar um container de estoque e conferir os dois selos.
- ⚠ **Produto com variações:** a carga de demonstração não tem produto com variação; o texto "Escolha a variação", "Escolher variação", "{n} variações" e "a partir de" vem do dicionário e de `docs/PRODUCT_VARIANTS.md`, sem conferência visual.
- ⚠ **Preço estimado:** só aparece com o cadastro completo (guia, seção 7.5). A frase da cena 1 ("preço estimado, com frete marítimo e impostos") vem do texto da própria vitrine; conferir a conta com o dono antes de dizer que o preço é "final": a página do produto avisa "O valor final vem na proposta."
- ⚠ **Quantidade inicial "1 un":** sem pedido mínimo cadastrado, o cartão e a página do produto começam em 1 unidade, o que para importação é pouco realista. Possível ajuste de tela, avisado ao dono.
- ⚠ **"Solicitação nº 1" do lote:** o lote recebe um único número (visto no teste: "Solicitação nº 1 · 2 produtos"); na lista de Orçamentos ele aparece como uma linha só ("Solicitado ×2").

---

## CLI-02 · Fazer uma nova solicitação

> **Promessa:** ao final do vídeo você sabe pedir um produto à Wellmix, em uma ou várias entregas, e entende o que acontece depois do **Enviar**.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                               |
| Conta de gravação     | `joao@lojista.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa)                                                    |
| Duração-alvo          | 4:30                                                                                                                                  |
| Ponto da jornada      | Etapa 2 de 9: Solicitação                                                                                                             |
| Telas e rotas         | `/app/requests` (Orçamentos), `/app/requests/new` (Nova solicitação), `/app/requests/[id]` (a solicitação criada)                      |
| Dados antes de gravar | Produto "Jarra de vidro 1,5 L (UTL-001)" e "Piscina inflável 2.000 L" ativos no catálogo e visíveis ao cliente, com foto; o cliente **sem** solicitações (ponto de salvamento `antes-CLI-02`) |
| Depois deste vídeo    | A solicitação nasce como **Solicitado** e a Wellmix passa a ter a pendência de enviá-la ao fornecedor (CLI-03 mostra a resposta)        |
| Antes · Próximo       | CLI-01 (Explorar a vitrine) · CLI-03 (Proposta e sinal)                                                                                |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/requests`**

- 🎬 Imagem: a tela **Orçamentos** com o cartão rosa "Precisa importar um produto?" em destaque e o botão vermelho "+ Nova solicitação". O cursor repousa perto do botão.
- 🎙 Narração: "Precisa de um produto da China? Em poucos minutos você faz o pedido e a Wellmix cuida do resto."
- 🔤 Na tela: `[TÍTULO]` "CLI-02 · Fazer uma nova solicitação"; `[ZOOM 150 %]` no cartão "Precisa importar um produto?".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/requests`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Este é o começo da jornada: a solicitação. Depois vêm a cotação, o sinal e o acompanhamento até a entrega."
- 🔤 Na tela: `[MAPA etapa 2]` com "Solicitação" acesa e as etapas seguintes apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:36 · Abrir o formulário · menu → `/app/requests` → `/app/requests/new`**

- 🎬 Imagem: o cursor vai ao menu **Meus pedidos**, abre o grupo e clica em **Orçamentos** (a tela já está nela; mostre o caminho do menu e volte). Em seguida clica em **+ Nova solicitação**. A tela **Nova solicitação** carrega.
- 🎙 Narração: "No menu, abra Meus pedidos e clique em Orçamentos. Aqui ficam todas as suas solicitações. Clique em Nova solicitação."
- 🔤 Na tela: `[PASSO 1/7] Abra Orçamentos`; `[BOTÃO] "+ Nova solicitação"`; `[DICA]` "Na vitrine, o cartão 'Não encontrou? Peça um produto' leva ao mesmo formulário."
- ✂️ Edição: `[CORTE]` seco para a nova tela quando ela termina de carregar; clique com onda de destaque.

**Cena 4 · 0:36–0:52 · As duas partes da tela · `/app/requests/new`**

- 🎬 Imagem: a tela inteira. O cursor percorre o cartão da esquerda ("Encontrar o produto por foto ou link") e depois o cartão da direita ("Produtos").
- 🎙 Narração: "A tela tem duas partes. À esquerda, a busca por foto ou link, que está temporariamente pausada. À direita, o formulário do seu pedido."
- 🔤 Na tela: `[SETA]` "Busca por foto ou link: pausada por enquanto" apontando o aviso âmbar do cartão da esquerda; `[SETA]` "Aqui você preenche o pedido" no cartão "Produtos".
- ✂️ Edição: apagar o realce da esquerda ao passar para a direita.

**Cena 5 · 0:52–1:15 · Escolher o produto do catálogo · `/app/requests/new`**

- 🎬 Imagem: em **Produto 1**, abrir a lista "Produto" e escolher **Jarra de vidro 1,5 L (UTL-001)**. Aparecem a caixa verde "Produto do catálogo Wellmix" e o selo "Preenchido com a ficha"; o campo "Produto (Nome)" fica com "Jarra de vidro 1,5 L".
- 🎙 Narração: "No campo Produto, escolha o item do catálogo da Wellmix: aqui, a jarra de vidro de um litro e meio. Repare que o nome já foi preenchido com a ficha do produto, e você pode editar."
- 🔤 Na tela: `[PASSO 2/7] Escolha o produto`; `[SETA]` "Preenchido com a ficha" no selo verde; `[ZOOM 150 %]` na caixa verde "Produto do catálogo Wellmix".
- ✂️ Edição: manter 2 s parado na caixa verde para a leitura.

**Cena 6 · 1:15–1:40 · Descrição, quantidade e unidade · `/app/requests/new`**

- 🎬 Imagem: no campo "Descrição" digitar "Jarra de vidro com tampa de bambu". Em "Quantidade" digitar 1200; mostrar "Unidade" = "un". Passar o cursor sobre "Especificação" (opcional).
- 🎙 Narração: "Na Descrição, conte o que você precisa, como o material e a tampa. Em Quantidade, digite mil e duzentos e confira a Unidade. A Especificação é opcional."
- 🔤 Na tela: `[PASSO 3/7] Descreva e informe a quantidade`; `[SETA]` "Obrigatório" em Descrição e Quantidade; `[DICA]` "Quanto mais detalhe, menos perguntas da Wellmix."
- ✂️ Edição: digitação em tempo real, sem aceleração (texto curto).

**Cena 7 · 1:40–2:15 · Programação de entregas · `/app/requests/new`**

- 🎬 Imagem: clicar em **+ Programação de entregas** ("Quer receber em mais de uma entrega?"). O painel **Programação de entregas** abre com duas programações de 600 un. Clicar em **30 dias** (intervalo) e ver as datas em "Previsão" mudarem. Mostrar "1ª entrega prevista" e "Total: 1.200 un". Mostrar também o botão "+ Programação" e o link "Sem programação (entrega única)".
- 🎙 Narração: "Quer receber em mais de uma entrega? Clique em Programação de entregas. Escolha o intervalo, trinta, quarenta e cinco ou sessenta dias, e a data da primeira entrega. Divida a quantidade: o sistema calcula a previsão de cada uma, e o total acompanha."
- 🔤 Na tela: `[PASSO 4/7] Programe as entregas (opcional)`; `[BOTÃO] "+ Programação de entregas"`; `[SETA]` "As datas previstas são calculadas" em "Previsão"; `[ATENÇÃO]` "A Wellmix e o fornecedor seguem esta programação na ficha de compra."
- ✂️ Edição: `[ZOOM 150 %]` nos cartões "Programação 1" e "Programação 2" quando o intervalo muda; pausa de 1 s no "Total: 1.200 un".

**Cena 8 · 2:15–2:50 · Mais de um produto e pedido mínimo · `/app/requests/new`**

- 🎬 Imagem: clicar em **+ Adicionar outro produto**. Aparece "Produto 2" vazio, com a caixa "Produto ainda não está no catálogo: quero que a Wellmix encontre fornecedores". Apontar a caixa. Escolher **Piscina inflável 2.000 L** em "Produto": aparece "Pedido mínimo: 300 un". Digitar 100 em "Quantidade" e sair do campo: a quantidade sobe para 300 e o aviso "Abaixo do pedido mínimo (300 un). Ao sair do campo, a quantidade sobe para o mínimo." aparece. Clicar em **Remover** no "Produto 2" para voltar ao pedido da jarra.
- 🎙 Narração: "Precisa de mais de um item? Clique em Adicionar outro produto. Cada produto vira uma solicitação própria, mas todas nascem juntas, num lote. Veja o pedido mínimo: a piscina pede trezentas unidades. Se digitar menos, a quantidade sobe para o mínimo ao sair do campo."
- 🔤 Na tela: `[PASSO 5/7] Adicione outro produto (opcional)`; `[BOTÃO] "+ Adicionar outro produto"`; `[SETA]` "Não achou? Marque aqui e descreva o que procura" na caixa "Produto ainda não está no catálogo"; `[ERRO COMUM]` "Abaixo do pedido mínimo (300 un). Ao sair do campo, a quantidade sobe para o mínimo."; `[BOTÃO] "Remover"`.
- ✂️ Edição: `[ZOOM 150 %]` na caixa de pedido mínimo; cortar a espera do campo atualizar; ao remover, voltar à tela da jarra com um `[CORTE]`.

**Cena 9 · 2:50–3:15 · Prazo de resposta e observação · `/app/requests/new`**

- 🎬 Imagem: rolar até "Prazo de resposta (SLA)" (campo cinza, só leitura, com a data de 5 dias úteis à frente) e o texto "Prazo definido pela Wellmix: resposta da cotação em até 5 dias úteis." Clicar em "Observação" e digitar "Embalar cada jarra em caixa individual."
- 🎙 Narração: "O prazo de resposta é definido pela Wellmix: até cinco dias úteis. Em Observação, escreva qualquer detalhe extra, como o tipo de embalagem."
- 🔤 Na tela: `[PASSO 6/7] Confira o prazo e deixe uma observação`; `[SETA]` "Definido pela Wellmix, não dá para editar" no campo cinza; `[QUEM VÊ]` "O fornecedor não vê o seu nome".
- ✂️ Edição: a data do campo precisa aparecer em dd/mm/aaaa (Chrome em pt-BR).

**Cena 10 · 3:15–3:30 · Enviar · `/app/requests/new` → `/app/requests/[id]`**

- 🎬 Imagem: rolar até o fim e clicar em **Enviar**. A barra de progresso vermelha corre no topo; a página da solicitação abre.
- 🎙 Narração: "Confira tudo e clique em Enviar."
- 🔤 Na tela: `[PASSO 7/7] Clique em Enviar`; `[BOTÃO] "Enviar"`.
- ✂️ Edição: `[CORTE]` na abertura da página; manter o clique com onda.

**Cena 11 · 3:30–3:55 · Resultado · `/app/requests/[id]`**

- 🎬 Imagem: a página com o título "Jarra de vidro 1,5 L", "Solicitação nº 1" e o selo **Solicitado**; a tabela "Solicitações" com Quantidade (1200 un), Prazo de resposta (SLA) e Descrição; o botão "Conversar com a Wellmix". Cursor passa por cada coluna e termina no botão.
- 🎙 Narração: "Pronto! Sua solicitação nasceu com um número e a situação Solicitado. Se tiver alguma dúvida, é só clicar em Conversar com a Wellmix."
- 🔤 Na tela: `[SETA]` "Número da solicitação" em "Solicitação nº 1"; `[SETA]` "Situação" no selo; `[BOTÃO] "Conversar com a Wellmix"`; `[ZOOM 150 %]` na tabela.
- ✂️ Edição: manter a tabela 3 s em tela.

**Cena 12 · 3:55–4:15 · E agora? · `/app/requests`**

- 🎬 Imagem: voltar para **Orçamentos**. A solicitação aparece em "Suas solicitações". Abrir o sino de notificações e mostrar a lista, ainda sem avisos novos.
- 🎙 Narração: "Agora a Wellmix cuida do resto. Quando houver algo para você fazer, aparece em Pendências e no sino de notificações. É só acompanhar por aqui."
- 🔤 Na tela: `[DEPOIS]` "A Wellmix envia ao fornecedor e traz a proposta. Você acompanha em Orçamentos."; `[SETA]` "Sino: seus avisos".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s, depois a tela de Orçamentos ao fundo.

**Cena 13 · 4:15–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-03.
- 🎙 Narração: "Resumindo: escolha o produto, descreva, informe a quantidade, programe as entregas se quiser e envie. No próximo vídeo, veja a proposta da Wellmix e como pagar o sinal."
- 🔤 Na tela: `[RESUMO]` "1 Escolha o produto · 2 Descreva e informe a quantidade · 3 Programe as entregas (opcional) · 4 Clique em Enviar"; chamada "Próximo: CLI-03 · Proposta e sinal".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** quantidade abaixo do pedido mínimo. A tela avisa "Abaixo do pedido mínimo ({n} {unidade}). Ao sair do campo, a quantidade sobe para o mínimo." e, se o valor chegar ao servidor, ele recusa com "Quantidade abaixo do pedido mínimo do produto. Use pelo menos o mínimo cadastrado (a tela mostra o valor)." → **Correção:** use pelo menos o mínimo que a tela mostra.
- **Erro:** campo obrigatório vazio. A tela mostra "Confira os produtos: nome, descrição e quantidade são obrigatórios." → **Correção:** preencha o nome (vem da ficha), a descrição e a quantidade.
- **Erro:** mais de 30 produtos numa solicitação. A tela mostra "São no máximo 30 produtos por solicitação. Envie o restante em outra." → **Correção:** divida em duas solicitações.
- **Aviso:** com as solicitações pela vitrine desligadas, a tela mostra "Para pedir orçamento, fale com a Wellmix: os pedidos pela vitrine estão desligados no momento." → **Correção:** falar com a Wellmix pelo botão de conversa.

### Passo a passo em texto

1. No menu, abra **Meus pedidos** e clique em **Orçamentos**.
2. Clique em **+ Nova solicitação**.
3. Em **Produto**, escolha o item do catálogo. O nome, a descrição e a especificação vêm da ficha e podem ser editados. Se o produto não está no catálogo, marque **Produto ainda não está no catálogo: quero que a Wellmix encontre fornecedores** e descreva o que procura.
4. Preencha **Descrição**, **Quantidade** e **Unidade**. A **Especificação** é opcional. A quantidade não pode ficar abaixo do pedido mínimo do produto.
5. Para receber em mais de uma entrega, clique em **+ Programação de entregas**, escolha o **Intervalo entre entregas** (30, 45, 60 dias ou outro), a **1ª entrega prevista** e divida a quantidade. O total acompanha as entregas.
6. Para pedir outro produto, clique em **+ Adicionar outro produto**. Cada produto vira uma solicitação própria, e todas nascem juntas, num lote.
7. Confira o **Prazo de resposta (SLA)**, definido pela Wellmix, e use **Observação** para qualquer detalhe extra.
8. Clique em **Enviar**. A solicitação nasce com um número e a situação **Solicitado**.
9. Acompanhe em **Orçamentos**. Dúvidas: **Conversar com a Wellmix**.

### Notas de gravação

- Prepare o ponto de salvamento `antes-CLI-02` (guia, seção 7.2) com o cliente sem solicitações.
- A busca por foto ou link está pausada: o cartão da esquerda mostra um aviso âmbar ("Para a utilização desse recurso, a utilização de tokens por fora aguarda Cartão de Crédito."). Não grave nada dentro dele; mostre-o sem clicar, como na cena 4. Se preferir tirar o aviso da imagem, use um zoom de 130 % no cartão da direita a partir da cena 5.
- O campo "Fotos do cadastro" mostra "Este produto ainda não tem fotos no cadastro." quando o produto não tem foto; suba fotos antes (guia, seção 7.5).
- O prazo (SLA) e as datas da programação mudam com o dia da gravação; não os cite na narração, só mostre.
- Na cena 8, depois de **Remover**, confira que sobrou só o "Produto 1" (a jarra) antes de rolar para o Enviar. Com dois produtos, o resultado vira um lote ("2 solicitações criadas num lote."), outro tema.

### Pontos a confirmar

- ⚠ Se há aviso no sino da Wellmix no instante em que o cliente envia (na cena 12 só se mostra o sino do cliente; a pendência "Enviar ao fornecedor: produto" da Wellmix é a que está em docs/RFQ_STANDBY.md, seção 3).
- ✔ Conferido na tela: o botão se chama "Remover" (o nome acessível é "Remover: Produto N") e só aparece quando há dois ou mais produtos na solicitação.
- ✔ Conferido na tela: ao escolher o produto, a quantidade já vem com o pedido mínimo (Piscina inflável: 300). Atenção: ao trocar de um produto com mínimo para um sem mínimo (ex.: da piscina para a jarra), a quantidade fica no valor anterior (300); na cena 8, digite a quantidade à mão como o roteiro já faz.
- ✔ Conferido na tela (cena 3): o grupo do menu é "Meus pedidos" e o item é "Orçamentos" (o mesmo título da tela).

---

## CLI-03 · Proposta e sinal

> **Promessa:** ao final do vídeo você sabe ler a proposta da Wellmix, aprová-la, pagar o sinal e entender como o pedido nasce.

| Ficha                 |                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                                                                                                                                      |
| Conta de gravação     | `joao@lojista.com`, tela em pt (Chrome em pt-BR). Cortes rápidos com `admin@wellmix.com` só para confirmar o sinal                                                                                                                           |
| Duração-alvo          | 4:30                                                                                                                                                                                                                                         |
| Ponto da jornada      | Etapas 3 e 4 de 9: Cotação (a resposta) e Sinal e pedido                                                                                                                                                                                      |
| Telas e rotas         | `/app/requests` (Orçamentos), `/app/requests/[id]#proposal` (cartão Proposta), `/app/notifications`, `/app/tasks`, `/app/orders/[id]` (o pedido que nasce)                                                                                    |
| Dados antes de gravar | Pontos de salvamento `antes-CLI-03` (a solicitação da Jarra, enviada ao fornecedor) e `antes-sinal` (fornecedor respondeu, a Wellmix escolheu, definiu **R$ 28.000,00** e sinal de **40 %** = **R$ 11.200,00** e aprovou os dois níveis do pré-custo). Para o cartão **Pague com Pix** aparecer, o administrador cadastra uma chave Pix de demonstração em Configurações (seção do Pix do sinal) |
| Depois deste vídeo    | O pedido nasce ("Pedido pré-aprovado"); o cliente recebe "Pedido #N criado" (Novidades); o fornecedor recebe "Pedido #N: preencha a ficha de compra" e a Wellmix passa a conferir o pedido (CLI-04 acompanha)                                  |
| Antes · Próximo       | CLI-02 · CLI-04 (Acompanhar o pedido)                                                                                                                                                                                                         |
| Idiomas               | pt (base)                                                                                                                                                                                                                                    |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/notifications`**

- 🎬 Imagem: a tela **Notificações** com o aviso "Proposta pronta: Jarra de vidro 1,5 L" (selo "Sua vez"), o valor "1.200 un por R$ 28.000,00" e o botão vermelho "Resolver" em destaque.
- 🎙 Narração: "A Wellmix preparou o seu preço. Falta você aprovar a proposta e pagar o sinal, a entrada que faz o seu pedido nascer. Vamos ver como."
- 🔤 Na tela: `[TÍTULO]` "CLI-03 · Proposta e sinal"; `[ZOOM 150 %]` no aviso.
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:22 · Onde estou na jornada**

- 🎬 Imagem: a mesma tela. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Depois da solicitação vêm a cotação e o sinal. Aqui o fornecedor já respondeu e a Wellmix já fez a conta."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" e "Sinal e pedido" acesas e as demais apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–1:00 · As situações da solicitação · `/app/requests`**

- 🎬 Imagem: a tela **Orçamentos** (menu **Meus pedidos**). A coluna "Situação" da solicitação da Jarra passa por quatro momentos, em quatro tomadas curtas: **Solicitado** → **RFQ aberta** → **Cotações recebidas** → **Aguardando sinal**.
- 🎙 Narração: "Em Orçamentos, a situação conta a história. Solicitado: a Wellmix ainda não enviou. RFQ aberta, o pedido de cotação: está com o fornecedor. Cotações recebidas: ele respondeu e a Wellmix está comparando. Nesses três momentos, você não precisa fazer nada."
- 🔤 Na tela: `[SETA]` "Solicitado · RFQ aberta · Cotações recebidas: nada a fazer"; `[QUEM VÊ]` "Você não vê a cotação do fornecedor, só a situação"; `[ATENÇÃO]` "Aguardando sinal: agora é com você".
- ✂️ Edição: quatro cortes de 5 s, com o selo da situação em `[ZOOM 150 %]` em cada um.

**Cena 4 · 1:00–1:35 · O aviso e a pendência · `/app/notifications` e `/app/tasks`**

- 🎬 Imagem: o sino do cabeçalho com o número. Em **Notificações**: o bloco **Precisa de você**, a linha "Proposta pronta: Jarra de vidro 1,5 L" com "Agora é com você". Clicar em "Resolver". (Em outra tomada: **Pendências**, a linha "Aprovar proposta: Jarra de vidro 1,5 L", tipo "Aprovar proposta", e o botão "Abrir".)
- 🎙 Narração: "Quando a proposta fica pronta, você recebe um aviso no sino e uma pendência. Clique em Resolver, ou em Abrir nas Pendências: os dois levam direto ao cartão Proposta, na solicitação."
- 🔤 Na tela: `[PASSO 1/6] Abra o aviso da proposta`; `[BOTÃO] "Resolver"`; `[BOTÃO] "Abrir"`; `[DICA]` "O aviso 'Proposta atualizada' chega se o câmbio mudar e a Wellmix atualizar o valor."
- ✂️ Edição: `[CORTE]` seco para a solicitação; clique com onda de destaque.

**Cena 5 · 1:35–2:20 · Ler a proposta · `/app/requests/[id]#proposal`**

- 🎬 Imagem: a página da solicitação com a situação **Aguardando sinal**. Rolar até o cartão **Proposta**, com a borda vermelha: "Valor ao cliente" (R$ 28.000,00), "Sinal" (R$ 11.200,00) e "Situação" (Pendente). Em cima, a tabela "Solicitações" com a quantidade, o prazo de resposta e a descrição. Abaixo, a caixa: "Confira quantidade, valor e prazo. Ao aprovar, aparecem os dados para pagar o sinal."
- 🎙 Narração: "No cartão Proposta, confira o Valor ao cliente e o Sinal. O valor é o total do pedido, e o sinal é a entrada. Compare com a quantidade e a descrição da sua solicitação, logo acima. Estando tudo certo, siga."
- 🔤 Na tela: `[PASSO 2/6] Abra o cartão Proposta`; `[PASSO 3/6] Confira os valores`; `[SETA]` "Valor ao cliente: o total do pedido"; `[SETA]` "Sinal: a entrada que inicia o pedido"; `[QUEM VÊ]` "O fornecedor, o preço de compra e a margem não aparecem para você".
- ✂️ Edição: `[ZOOM 150 %]` nos dois valores; manter 3 s na tela.

**Cena 6 · 2:20–2:45 · Aprovar a proposta · `/app/requests/[id]#proposal`**

- 🎬 Imagem: clicar em "Aprovar proposta". A faixa verde "Proposta aprovada. Agora é só pagar o sinal." aparece; embaixo, em verde pequeno: "Proposta aprovada em 11/11/2026 por João Cliente."
- 🎙 Narração: "Clique em Aprovar proposta. O portal registra quem aprovou e quando, e só então mostra os dados para pagar o sinal."
- 🔤 Na tela: `[PASSO 4/6] Aprove a proposta`; `[BOTÃO] "Aprovar proposta"`; `[ATENÇÃO]` "Se preferir negociar, converse antes: Conversar com a Wellmix".
- ✂️ Edição: `[ZOOM 150 %]` na faixa verde; a data deve sair em dd/mm/aaaa.

**Cena 7 · 2:45–3:30 · Pagar o sinal · `/app/requests/[id]`**

- 🎬 Imagem: o aviso âmbar "Pague o sinal de R$ 11.200,00 para iniciar o pedido. A Wellmix confirma o recebimento." À direita, o cartão **Pague com Pix**: o QR Code, "Recebedor", "Chave Pix", "Valor", "Referência", o campo "Pix copia e cola" e o botão "Copiar código Pix". Clicar nele: "Código copiado". (Tomada alternativa, sem Pix configurado: o quadro "A Wellmix vai informar os dados para pagamento. Depois de pagar, anexe o comprovante aqui.")
- 🎙 Narração: "Para pagar, use o Pix: leia o QR Code no app do seu banco, ou copie o código e cole em Pix copia e cola. Valor e referência já vão preenchidos. Se não houver Pix, a Wellmix informa como pagar."
- 🔤 Na tela: `[PASSO 5/6] Pague o sinal`; `[BOTÃO] "Copiar código Pix"`; `[SETA]` "Valor e referência já vêm preenchidos"; `[ATENÇÃO]` "O pagamento é confirmado à mão pela Wellmix".
- ✂️ Edição: `[ZOOM 150 %]` no QR Code (use a chave de demonstração, nunca uma chave real); o código copiado não deve ficar legível.

**Cena 8 · 3:30–3:55 · Enviar o comprovante · `/app/requests/[id]`**

- 🎬 Imagem: no quadro "Comprovante do pagamento" ("Foto ou PDF do comprovante do banco."), escolher o arquivo e clicar em "Enviar comprovante". Aparece a faixa verde: "Comprovante enviado. A Wellmix confere o recebimento e confirma o sinal; você recebe um aviso quando o pedido for criado." com o link "Ver comprovante" e, abaixo, "Enviar outro comprovante".
- 🎙 Narração: "Depois de pagar, anexe o comprovante: uma foto ou um PDF do banco. A Wellmix confere o recebimento e confirma o sinal. Você recebe um aviso quando o pedido for criado."
- 🔤 Na tela: `[PASSO 6/6] Envie o comprovante`; `[BOTÃO] "Enviar comprovante"`; `[DICA]` "Enviou o arquivo errado? Use 'Enviar outro comprovante'."
- ✂️ Edição: a escolha do arquivo em tempo real; `[CORTE]` ao enviar.

**Cena 9 · 3:55–4:20 · O pedido nasce · `/app/requests/[id]`**

- 🎬 Imagem: corte curto para a Wellmix (conta do administrador): "Confirmar sinal recebido". Volta ao cliente: a solicitação com o selo **Pedido pré-aprovado**, o botão vermelho "Ver pedido" e o cartão Proposta com "Situação: Confirmado". O sino traz "Pedido #1 criado" em **Novidades**, "Agora é com: Fornecedor".
- 🎙 Narração: "A Wellmix confirma o sinal e o pedido nasce, com o selo Pedido pré-aprovado. O próximo passo é do fornecedor, que prepara a ficha de compra. Clique em Ver pedido para acompanhar."
- 🔤 Na tela: `[BOTÃO] "Ver pedido"`; `[SETA]` "Situação: Pedido pré-aprovado"; `[DEPOIS]` "O fornecedor é avisado (sino e Pendências dele) para preencher a ficha de compra. Você acompanha em Pedidos."; `[QUEM VÊ]` "Só a Wellmix confirma o sinal".
- ✂️ Edição: cartão `[DEPOIS]` de 4 s; o corte para a Wellmix dura 3 s e não mostra valores de compra.

**Cena 10 · 4:20–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-04.
- 🎙 Narração: "Resumindo: abra o aviso, confira a proposta, aprove, pague o sinal e envie o comprovante. No próximo vídeo, acompanhe o pedido até a entrega."
- 🔤 Na tela: `[RESUMO]` "1 Abra o aviso · 2 Confira o Valor ao cliente e o Sinal · 3 Aprovar proposta · 4 Pague o sinal e envie o comprovante"; chamada "Próximo: CLI-04 · Acompanhar o pedido".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** enviar o comprovante sem escolher o arquivo. A tela mostra "Escolha o arquivo do comprovante." → **Correção:** escolha uma foto ou um PDF e envie de novo.
- **Erro:** arquivo em formato errado. A tela mostra "Formato não aceito. Envie uma foto ou um PDF." → **Correção:** converta para foto (JPG, PNG) ou PDF.
- **Erro:** arquivo grande demais. A tela mostra "Arquivo grande demais (máximo 30 MB)." → **Correção:** reduza o arquivo.
- **Erro:** tentar enviar o comprovante depois que o sinal foi confirmado. A tela mostra "Esta solicitação não está mais aguardando o sinal." → **Correção:** não é preciso: o pedido já nasceu; acompanhe em Pedidos.
- **Aviso:** sem Pix para o seu caso, o cartão mostra "Este valor não é em reais, então não há Pix. A Wellmix informa como pagar; depois, anexe o comprovante aqui." ou "O valor do sinal ainda não foi definido. A Wellmix avisa quando estiver pronto." → **Correção:** aguarde a orientação da Wellmix e anexe o comprovante depois.
- **Aviso:** o câmbio mudou antes de você pagar e a Wellmix atualizou a proposta. Chega "Proposta atualizada: {produto}", com "Novo valor {total} (câmbio do dia). Sinal: {down}." → **Correção:** confira o novo valor antes de pagar; o Pix já vem com o valor atualizado.

### Passo a passo em texto

1. Acompanhe a situação da solicitação em **Orçamentos** (menu **Meus pedidos**). **Solicitado**, **RFQ aberta** e **Cotações recebidas** não pedem nada de você.
2. Quando a proposta ficar pronta, chega o aviso **Proposta pronta: …** (sino) e a pendência **Aprovar proposta: …**. Clique em **Resolver** ou em **Abrir**.
3. Na solicitação (situação **Aguardando sinal**), abra o cartão **Proposta** e confira **Valor ao cliente** e **Sinal**.
4. Clique em **Aprovar proposta**. O portal registra quem aprovou e quando, e mostra os dados do sinal.
5. Pague o sinal pelo **Pix**: leia o QR Code ou use **Copiar código Pix** no seu banco ("Pix copia e cola"). Sem Pix, aguarde as instruções da Wellmix.
6. Em **Comprovante do pagamento**, escolha a foto ou o PDF do banco e clique em **Enviar comprovante**.
7. A Wellmix confere e confirma o sinal. A solicitação passa a **Pedido pré-aprovado**, você recebe **Pedido #N criado** e o botão **Ver pedido** aparece.

### Notas de gravação

- **Duas tomadas do cartão do sinal:** (a) com a chave Pix cadastrada em Configurações (use uma chave de demonstração; o QR Code e o código aparecem); (b) sem a chave, para mostrar o quadro "A Wellmix vai informar os dados para pagamento…". Escolha uma só para o corte final; a (a) é mais bonita. Nenhuma chave real do dono aparece.
- **Pagamento manual:** o cliente paga no banco fora do portal. O portal **não** processa o pagamento: diga "a Wellmix confirma o recebimento" e nunca "o portal cobra" (guia, seção 7.5).
- **Aprovação interna:** antes do aviso, a Wellmix compara, define o valor ao cliente e o sinal e envia a escolha para aprovação (planner e diretoria de compras, `docs/APPROVALS.md`). Isso o cliente não vê; ao dar o ponto de salvamento `antes-sinal`, as duas aprovações já estão feitas.
- **Confirmar o sinal:** é do administrador (financeiro só do administrador): botão "Confirmar sinal recebido". O campo de comprovante da Wellmix é opcional ("Comprovante (opcional)"), então a Wellmix pode confirmar sem o comprovante do cliente.
- **Comprovante de exemplo:** use um PNG ou PDF pequeno com um comprovante de teste, sem dados reais.
- **Pendência e aviso:** a pendência **Aprovar proposta** some depois de aprovar; a **Sinal pendente** (tipo "Pagar sinal") toma o lugar até o comprovante ser enviado ou o sinal confirmado (pelo código de `pendingTasksFor`; não capturei essa tela). O aviso "Proposta pronta" fica na lista como "Sua vez" até o cliente clicar em "Resolver" ou excluí-lo.
- **Data:** a data de aprovação e as datas da tabela saem em dd/mm/aaaa (Chrome em pt-BR).

### Pontos a confirmar

- ⚠ **Saldo depois do sinal:** o pedido mostra "A receber do cliente" (no exemplo, R$ 16.800,00), mas não encontrei no código do cliente um passo para pagar o saldo. O texto "(restante)" aparece só na tela da Wellmix. Combinar com o dono o que dizer ("o saldo é combinado com a Wellmix") e se haverá uma segunda cobrança no portal.
- ⚠ **Validade da proposta:** a pendência tem prazo "—" e a proposta não mostra data de validade. Não afirmar prazo para aprovar na narração.
- ⚠ **Percentual do sinal:** vem das Configurações (30 % por padrão; o exemplo usa 40 %). A narração não cita o percentual.
- ⚠ **Pendências em formato cru:** a pendência "Aprovar proposta" mostra "BRL 28000.00 · depois de aprovar, o sinal de BRL 11200.00" (sem R$, ponto e vírgula), enquanto o aviso mostra "R$ 28.000,00". Para a cena 4, prefira o enquadramento do aviso.
- ⚠ **Aviso "Sua vez" que não sai:** depois de aprovar a proposta e pagar, o aviso "Proposta pronta" continua em Precisa de você até ser aberto ("Resolver") ou excluído. Mostrar o clique em "Resolver" na cena 4 e comentar na revisão.
- ⚠ **"RFQ aberta" para o cliente:** o selo usa o termo RFQ (o nome da etapa no banco; docs/RFQ_STANDBY.md, seção 8, sugere trocar por "Com o fornecedor"). A narração explica "RFQ, o pedido de cotação" na primeira vez; se o dono trocar o rótulo, ajustar a cena 3.
- ⚠ **Aviso ao cliente em "Cotações recebidas":** no teste, o cliente não recebeu notificação nessa mudança de situação (só em "Proposta pronta"). Confirmar se é o desejado antes de afirmar na narração que "ele é avisado".
- ⚠ **Quem aprova:** o cartão "Aprovar proposta" aparece para o login que vê a solicitação (o solicitante, ver `docs/ACCESS.md`); outro login da mesma empresa pode não ver.

---

## CLI-04 · Acompanhar o pedido

> **Promessa:** ao final do vídeo você sabe achar o seu pedido, ler as etapas e o progresso, ver o que já foi pago e conversar com a Wellmix, sem precisar ligar para ninguém.

| Ficha                 |                                                                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                                                                                                                          |
| Conta de gravação     | `joao@lojista.com`, tela em pt                                                                                                                                                                                                   |
| Duração-alvo          | 4:00                                                                                                                                                                                                                             |
| Ponto da jornada      | Etapas 4 a 9 de 9: do pedido nascido à entrega                                                                                                                                                                                   |
| Telas e rotas         | `/app/requests` (cartão "Pedidos em andamento"), `/app/orders` (lista), `/app/orders/[id]` (o pedido, em linhas)                                                                                                                  |
| Dados antes de gravar | Dois pontos de salvamento do pedido da Jarra: `ped-arte` (etapa **Arte e embalagem** em andamento: ficha de compra pronta, arte ainda por enviar) e `ped-entrega` (etapa **Entrega** em andamento, com o BL e fotos nos documentos). Valor de venda R$ 28.000,00 e sinal R$ 11.200,00 pago |
| Depois deste vídeo    | Nada muda no sistema; o cliente sabe onde o pedido está. Quando chega a etapa **Entrega**, o cliente recebe a pendência de confirmar o recebimento (CLI-05)                                                                       |
| Antes · Próximo       | CLI-03 · CLI-05 (Receber a carga e avaliar a compra)                                                                                                                                                                              |
| Idiomas               | pt (base)                                                                                                                                                                                                                        |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/orders/[id]`**

- 🎬 Imagem: a tela do **Pedido #1** inteira, de cima para baixo: os três cartões coloridos, a tabela das etapas com os círculos verdes e a etapa em andamento destacada em vermelho.
- 🎙 Narração: "Onde está o meu pedido? Quem está com ele agora, e até quando? A tela do pedido responde, etapa por etapa, sem você precisar perguntar."
- 🔤 Na tela: `[TÍTULO]` "CLI-04 · Acompanhar o pedido"; `[ZOOM 150 %]` na etapa em andamento.
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:22 · Onde estou na jornada**

- 🎬 Imagem: a mesma tela. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Depois do sinal, o pedido percorre cinco etapas até chegar a você. Este vídeo mostra como acompanhar todas."
- 🔤 Na tela: `[MAPA etapa 5]` com as etapas 4 a 9 acesas, uma a uma.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:55 · Achar o pedido · `/app/requests`**

- 🎬 Imagem: a tela **Orçamentos**. Acima da lista, "Pedidos em andamento" com o cartão do pedido: "#1", "Jarra de vidro 1,5 L", o selo da etapa, a barra de andamento, "Próximo passo: Com a Wellmix" (ou "Com você"), "Prazo desta etapa" e, quando existe, "Chegada prevista". O cursor clica em "Acompanhar".
- 🎙 Narração: "O jeito mais rápido é a tela Orçamentos. Em Pedidos em andamento, cada cartão mostra a etapa, o próximo passo e o prazo. Com a Wellmix quer dizer que você não precisa fazer nada. Com você, que é a sua vez. Clique em Acompanhar."
- 🔤 Na tela: `[PASSO 1/6] Abra Orçamentos`; `[BOTÃO] "Acompanhar"`; `[SETA]` "Com a Wellmix: nada a fazer · Com você: a sua vez"; `[DICA]` "O menu Pedidos mostra todos, em andamento ou encerrados."
- ✂️ Edição: `[ZOOM 150 %]` no "Próximo passo".

**Cena 4 · 0:55–1:30 · A lista de pedidos · `/app/orders`**

- 🎬 Imagem: menu **Meus pedidos** → **Pedidos**. A tabela: "#", "Produto", "Etapa", "Situação", "Progresso" (barra com o percentual e o nome do passo), "Prazo", "Atualizado". Sob o título de cada coluna, o campo "Filtrar" ou a lista "Todos". Embaixo, "Itens de #1 (1)" e o link "Abrir pedido →".
- 🎙 Narração: "Em Pedidos, uma linha por pedido: etapa, situação, progresso e prazo. Cada coluna tem filtro. A barra mostra em que passo da viagem o pedido está. Clique no número do pedido para abrir."
- 🔤 Na tela: `[PASSO 2/6] Abra o pedido`; `[SETA]` "Progresso: a posição na viagem inteira"; `[SETA]` "Filtre por etapa, situação ou prazo"; `[ATENÇÃO]` "O percentual desta lista é o da jornada; a barra da etapa, na tela do pedido, é só da etapa."
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Progresso".

**Cena 5 · 1:30–2:10 · Valores e resumo · `/app/orders/[id]`**

- 🎬 Imagem: o alto da tela do pedido: "Pedido #1", "Jarra de vidro 1,5 L · 1200 un", o selo da etapa e "Solicitação nº 1". Os três cartões: "Valor de venda", "Recebido do cliente" e "A receber do cliente". Depois, as tabelas "Resumo do pedido" (valor de venda, data, modalidade de operação) e "Itens do pedido" (nº, produto, variação, quantidade).
- 🎙 Narração: "No alto, os valores: o de venda, o que você já pagou e o que ainda falta. Logo abaixo, o resumo do pedido e os itens, com a variação escolhida, se houver. Você só vê o preço de venda, nunca o custo da Wellmix."
- 🔤 Na tela: `[PASSO 3/6] Leia os valores`; `[SETA]` "Recebido do cliente: o sinal já pago"; `[QUEM VÊ]` "Você não vê o fornecedor, o preço de compra nem a margem".
- ✂️ Edição: `[ZOOM 150 %]` nos três cartões, 1 s em cada.

**Cena 6 · 2:10–3:00 · As etapas do pedido · `/app/orders/[id]`**

- 🎬 Imagem: a tabela "Etapas do pedido" (ponto de salvamento `ped-arte`): "#", "Etapa", "Situação", "Responsável", "Prazo", "Concluída em", "Andamento", "Itens da etapa". As nove linhas: Pedido pré-aprovado, Preparação, Arte e embalagem, Inspeção, Embarque, Desembaraço, Transporte, Entrega e Encerramento. Etapa concluída: círculo verde e "Concluída"; em andamento: vermelho; adiante: "Pendente". A coluna "Responsável" mostra o papel (Operador Wellmix, Fornecedor, Agência…). Embaixo, a etapa em andamento aberta, com os itens "Pendente" e quem os faz. Clicar em "Ver detalhes" numa etapa concluída e em "Abrir todas as etapas".
- 🎙 Narração: "Esta é a linha do tempo do pedido. Cada etapa tem situação, responsável, prazo e andamento. Verde, concluída. Vermelha, em andamento. A etapa atual abre embaixo, com o que falta e com quem está. Clique em Ver detalhes para rever uma etapa concluída."
- 🔤 Na tela: `[PASSO 4/6] Leia as etapas`; `[SETA]` "Responsável: o papel de quem está com o pedido agora"; `[SETA]` "Etapa em andamento, aberta embaixo"; `[BOTÃO] "Ver detalhes"`; `[BOTÃO] "Abrir todas as etapas"`; `[ATENÇÃO]` "Se uma etapa aparecer como Bloqueada, a Wellmix está resolvendo: nada a fazer."
- ✂️ Edição: percorrer as linhas de cima para baixo em 20 s; pausa de 2 s na etapa em andamento.

**Cena 7 · 3:00–3:25 · Pagamentos e documentos · `/app/orders/[id]`**

- 🎬 Imagem: rolar até a tabela **Pagamentos** ("Data", "De", "Valor", "Situação", "Observação", "Comprovante"): o sinal de R$ 11.200,00, "Confirmado". Depois **Documentos** (ponto de salvamento `ped-entrega`): "Documento", "Tipo", "Versão", "Visualizado / Confirmado" e o link "Confirmar leitura". Abaixo da tabela, a frase: "Visualizar é registrado automaticamente ao abrir; confirmar é um ato explícito. Um nunca vale pelo outro."
- 🎙 Narração: "Em Pagamentos, o que você já pagou. Em Documentos, os arquivos liberados para você, como o conhecimento de embarque. Abrir registra que você viu; Confirmar leitura registra que você concorda."
- 🔤 Na tela: `[PASSO 5/6] Confira pagamentos e documentos`; `[BOTÃO] "Confirmar leitura"`; `[SETA]` "Visualizado: registrado ao abrir".
- ✂️ Edição: `[ZOOM 150 %]` na última coluna da tabela de documentos.

**Cena 8 · 3:25–3:45 · Conversar com a Wellmix · `/app/orders/[id]`**

- 🎬 Imagem: o botão "Conversar com a Wellmix" no alto e os pequenos ícones de balão nas linhas (item do pedido e responsável). Clicar no botão: abre a conversa do pedido, em **Mensagens**, no assunto "Pedido #1".
- 🎙 Narração: "Ficou com dúvida? Clique em Conversar com a Wellmix. A conversa abre já no assunto deste pedido, e a equipe responde por aqui."
- 🔤 Na tela: `[PASSO 6/6] Converse com a Wellmix`; `[BOTÃO] "Conversar com a Wellmix"`; `[QUEM VÊ]` "Todos os logins da sua empresa veem esta conversa".
- ✂️ Edição: `[CORTE]` seco para a conversa; mostrar o assunto "Pedido #1" na lista.

**Cena 9 · 3:45–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-05.
- 🎙 Narração: "Resumindo: ache o pedido, leia os valores e as etapas, confira pagamentos e documentos. No próximo vídeo, confirme o recebimento e avalie a compra."
- 🔤 Na tela: `[RESUMO]` "1 Acompanhar em Orçamentos ou Pedidos · 2 Valores no alto · 3 Etapas: situação, responsável e prazo · 4 Pagamentos e documentos"; chamada "Próximo: CLI-05 · Receber a carga e avaliar a compra".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Engano:** procurar o pedido logo depois de enviar a solicitação. Ele só existe depois do sinal confirmado pela Wellmix; até lá a solicitação mostra **Aguardando sinal**. → **Correção:** acompanhe em Orçamentos; o aviso "Pedido #N criado" marca o nascimento.
- **Engano:** achar que uma etapa **Pendente** está parada. → **Correção:** etapa Pendente é a que ainda não começou; a que está em andamento é a que aparece em vermelho e aberta embaixo.
- **Engano:** achar que uma etapa **Bloqueada** pede algo de você. → **Correção:** o bloqueio é da Wellmix (por exemplo, uma divergência de peso na inspeção); ela resolve e o pedido segue. Se tiver dúvida, use Conversar com a Wellmix.
- **Engano:** estranhar não ver o nome do fornecedor nem os custos. → **Correção:** é a regra do portal: o cliente vê só o preço de venda, o que pagou e o andamento.

### Passo a passo em texto

1. No menu **Meus pedidos**, abra **Orçamentos**: o cartão **Pedidos em andamento** mostra a etapa, o **Próximo passo** (**Com a Wellmix** ou **Com você**), o **Prazo desta etapa** e, quando houver, a **Chegada prevista**. Clique em **Acompanhar**.
2. Ou abra **Pedidos** e clique no número do pedido. Use os filtros de cada coluna para achar um pedido entre vários.
3. Na tela do pedido, leia os cartões **Valor de venda**, **Recebido do cliente** e **A receber do cliente**, o **Resumo do pedido** e os **Itens do pedido**.
4. Em **Etapas do pedido**, veja a **Situação**, o **Responsável**, o **Prazo**, a data em que foi **Concluída em**, o **Andamento** e os **Itens da etapa**. A etapa em andamento fica aberta embaixo; use **Ver detalhes** ou **Abrir todas as etapas** para ver as outras.
5. Em **Pagamentos**, confira o que já foi pago. Em **Documentos**, abra os arquivos liberados e, se quiser, clique em **Confirmar leitura**.
6. Para qualquer dúvida, clique em **Conversar com a Wellmix**.

### Notas de gravação

- **Pontos de salvamento:** grave as cenas 3 a 6 em `ped-arte` (a tela do pedido com a etapa "Arte e embalagem" em andamento, três etapas concluídas e a lista de itens "Pendente" embaixo) e a cena 7 em `ped-entrega` (já com documentos). Se só houver um ponto, use o de `Entrega` e acrescente a explicação "Pendente / Em andamento" na legenda.
- **Linhas da tabela:** a tabela do cliente tem **nove** linhas (o pagamento ao fornecedor fica fora do fluxo e não aparece). Não confunda com as **nove etapas da jornada** do `[MAPA]`: o pedido tem as suas nove linhas, a jornada tem as suas nove marcas (guia, seção 6.1). Na narração, diga "etapas do pedido" para as linhas e "jornada" para o mapa.
- **O que aparece ao cliente na etapa em andamento:** os itens da etapa e o papel responsável (por exemplo, "Arte da embalagem · Pendente · Agência"; "Aprovação da arte pelo fornecedor · Pendente · Fornecedor"). Nunca aparece o nome da empresa do fornecedor.
- **Termos de bastidor:** a primeira etapa traz "Número no Sankhya (opcional)" e, no progresso da lista, "Conferência e Sankhya". O Sankhya é o ERP da Wellmix; na narração, passe por cima ou diga "o sistema interno da Wellmix".
- **Documentos:** no teste, o cliente viu o BL e as fotos do pedido. Para a cena 7, deixe pelo menos um BL e uma foto.
- **Faixa âmbar e seletor DEMO:** esconda os dois (guia, seção 7.3).
- **Data:** prazo e datas saem em dd/mm/aaaa (Chrome em pt-BR).

### Pontos a confirmar

- ⚠ **Dois percentuais diferentes:** o cartão "Pedidos em andamento" (em Orçamentos) mostra o andamento da etapa (0 % no pedido recém-criado), e a lista "Pedidos" mostra o progresso da jornada (35 %, "Conferência e Sankhya") para o mesmo pedido, no mesmo instante. O roteiro explica a diferença na cena 4; confirmar com o dono se vale unificar ou rotular.
- ⚠ **Quais documentos o cliente vê:** no teste, o BL e as fotos apareceram; a arte e a ficha de compra não. Conferir a regra de visibilidade (`canAccessDocument`) antes de dizer "documentos liberados para você".
- ⚠ **Avisos de etapa ao cliente:** no teste, o cliente só recebeu avisos em dois momentos do pedido: "Pedido #1 criado" e "Entrega precisa de você". Não vi avisos de "no mar" ou "no porto". Confirmar se há outros; a narração não promete aviso de cada etapa.
- ⚠ **Itens de bastidor visíveis:** o cliente vê itens como "Número no Sankhya (opcional)" e, em produto que exige certificação, "Conformidade: certificação obrigatória conferida · Faltam: Inmetro". Confirmar se é intencional mostrar isso ao cliente.
- ⚠ **Modalidade de operação:** "Via trade" (Resumo do pedido) é jargão para o cliente; confirmar o que significa (docs/OPEN_DECISIONS.md, modalidade de operação do cliente) antes de explicar.
- ⚠ **Quem vê o pedido:** só o login solicitante vê a solicitação e o pedido (`docs/ACCESS.md`); colegas da mesma empresa podem não ver. Conferir o que o colega vê (404 ou lista vazia) antes de gravar uma cena sobre isso.

---

## CLI-05 · Receber a carga e avaliar a compra

> **Promessa:** ao final do vídeo você sabe confirmar o recebimento da carga, encerrar o pedido e contar à Wellmix como foi a compra, em um minuto.

| Ficha                 |                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                                                                                                              |
| Conta de gravação     | `joao@lojista.com`, tela em pt                                                                                                                                                                                       |
| Duração-alvo          | 3:30                                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 9 de 9: Entrega e pós-venda                                                                                                                                                                                    |
| Telas e rotas         | `/app/tasks` (Pendências), `/app/notifications`, `/app/orders/[id]` (etapa Entrega e cartão Pós-venda, âncora `#after-sales`)                                                                                         |
| Dados antes de gravar | Ponto de salvamento `antes-recebimento`: o pedido da Jarra com a etapa **Transporte** concluída e a etapa **Entrega** em andamento. A confirmação de entrega aceita o cliente **ou** a Wellmix (padrão "ambos" em Configurações) |
| Depois deste vídeo    | O pedido fica **Encerrado**; abre-se o pós-venda ("Aguardando cliente") com o aviso "Pedido #N: como foi a sua compra?" e a pendência "Avalie a compra: pedido #N". Ao enviar, a Wellmix é avisada e o pós-venda vira "Respondido" |
| Antes · Próximo       | CLI-04 · CLI-06 (Comprar de novo, pedir nova proposta e cancelar)                                                                                                                                                    |
| Idiomas               | pt (base)                                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/orders/[id]`**

- 🎬 Imagem: a etapa **Entrega** em andamento, com o botão vermelho "Confirmar" ao lado de "Recebimento confirmado · Pendente · Cliente".
- 🎙 Narração: "A jarra chegou? Confirme o recebimento: assim o pedido se encerra e a Wellmix sabe que deu tudo certo. Depois, conte como foi a compra."
- 🔤 Na tela: `[TÍTULO]` "CLI-05 · Receber a carga e avaliar a compra"; `[ZOOM 150 %]` no botão "Confirmar".
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:20 · Onde estou na jornada**

- 🎬 Imagem: a mesma tela. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Esta é a última etapa: entrega e pós-venda. A carga já passou pela alfândega e pelo transporte."
- 🔤 Na tela: `[MAPA etapa 9]` com todas as marcas acesas até "Entrega e pós-venda".
- ✂️ Edição: o mapa sai em 6 s, deslizando para cima.

**Cena 3 · 0:20–0:55 · O aviso e a pendência · `/app/notifications` e `/app/tasks`**

- 🎬 Imagem: o sino traz "Pedido #1: Entrega precisa de você", com "Falta: Recebimento confirmado." e o selo "Sua vez". Em **Pendências**, a linha "Pedido #1: Entrega" com o detalhe "Recebimento confirmado", o tipo "Entrega", o prazo "vence em N dias" e o botão "Abrir".
- 🎙 Narração: "Quando a carga chega, o pedido entra na etapa Entrega e a vez é sua. O sino avisa, e a pendência aparece em Pendências, com o prazo. Clique em Abrir, ou em Resolver no sino."
- 🔤 Na tela: `[PASSO 1/5] Abra a pendência da entrega`; `[BOTÃO] "Abrir"`; `[SETA]` "Falta: Recebimento confirmado"; `[SETA]` "Prazo: vence em N dias".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Prazo".

**Cena 4 · 0:55–1:30 · Conferir a carga · `/app/orders/[id]`**

- 🎬 Imagem: o cartão da etapa: "Entrega · Em andamento · Responsável: Cliente" e o texto "Cliente confirma o recebimento (a Wellmix pode confirmar por ele). Com a confirmação o pedido é encerrado." O cursor passa pela tabela "Itens do pedido" (produto e quantidade) enquanto uma legenda lembra de conferir a carga.
- 🎙 Narração: "Antes de confirmar, confira a carga: a quantidade e o estado das caixas. Se algo não estiver certo, converse com a Wellmix antes de clicar. Confirmando, você diz que recebeu e o pedido é encerrado."
- 🔤 Na tela: `[PASSO 2/5] Confira a carga`; `[ATENÇÃO]` "Confirmar encerra o pedido"; `[BOTÃO] "Conversar com a Wellmix"`.
- ✂️ Edição: `[ZOOM 150 %]` no texto do cartão; pausa de 2 s.

**Cena 5 · 1:30–1:50 · Confirmar · `/app/orders/[id]`**

- 🎬 Imagem: clicar em "Confirmar". A página recarrega: a faixa verde "Pedido encerrado", a tabela com todas as nove etapas "Concluída" e o selo "Encerramento".
- 🎙 Narração: "Clique em Confirmar. Pronto: todas as etapas ficam concluídas e o pedido aparece como encerrado."
- 🔤 Na tela: `[PASSO 3/5] Clique em Confirmar`; `[BOTÃO] "Confirmar"`; `[SETA]` "Pedido encerrado".
- ✂️ Edição: `[CORTE]` na recarga; pausa de 2 s na faixa verde.

**Cena 6 · 1:50–2:30 · O convite para avaliar · `/app/tasks` e `/app/orders/[id]#after-sales`**

- 🎬 Imagem: o sino traz "Pedido #1: como foi a sua compra?" ("Avalie a experiência, conte problemas e diga se quer repor. Leva um minuto."). Em **Pendências**: "Avalie a compra: pedido #1", detalhe "Como foi a experiência? Quer repor?", tipo "Pós-venda". Clicar em "Abrir": o cartão **Pós-venda** com a etiqueta "Aguardando cliente" e o texto "O processo não termina na entrega. Conte como foi a compra: a Wellmix usa as respostas para corrigir problemas e planejar a reposição."
- 🎙 Narração: "Encerrado o pedido, a Wellmix pergunta como foi. É o pós-venda: o processo não termina na entrega. Você recebe um aviso e uma pendência, Avalie a compra. É rápido, leva cerca de um minuto, e ajuda a Wellmix a corrigir problemas e planejar a reposição."
- 🔤 Na tela: `[PASSO 4/5] Abra Avalie a compra`; `[SETA]` "Pós-venda: aguardando você"; `[DEPOIS]` "A Wellmix recebe a sua resposta no sino e, se houver problema, com destaque de atenção."
- ✂️ Edição: `[ZOOM 150 %]` na etiqueta "Aguardando cliente".

**Cena 7 · 2:30–3:10 · Avaliar a compra · `/app/orders/[id]#after-sales`**

- 🎬 Imagem: o formulário do cartão **Pós-venda**: "Nota da compra (1 a 5)" com os botões 1 a 5 e a dica "1 = muito ruim · 5 = excelente"; clicar em 5. "Interesse em nova compra": Sim, Talvez, Não; clicar em "Sim". Os quatro campos de texto: "Como foi a experiência?", "Houve problemas? (produto, prazo, embalagem, transporte)", "Custos percebidos (impostos, frete, extras)", "Sugestões". Digitar "Chegou no prazo e bem embalado." e "Avisar a data de chegada por WhatsApp." Clicar em "Enviar avaliação".
- 🎙 Narração: "Dê a sua nota de um a cinco e diga se tem interesse em comprar de novo. Conte como foi a experiência, se houve algum problema e se os custos foram o que você esperava. Só a nota é obrigatória. Clique em Enviar avaliação."
- 🔤 Na tela: `[PASSO 5/5] Envie a avaliação`; `[BOTÃO] "Enviar avaliação"`; `[SETA]` "Só a nota é obrigatória"; `[DICA]` "Houve problema? Conte no campo 'Houve problemas?': a Wellmix recebe um aviso de atenção."
- ✂️ Edição: digitação em tempo real, sem aceleração; `[ZOOM 150 %]` nas notas.

**Cena 8 · 3:10–3:20 · Resultado · `/app/orders/[id]#after-sales`**

- 🎬 Imagem: o cartão agora "Respondido": a faixa verde "Obrigado pela avaliação. A Wellmix vai analisar as respostas." e a tabela com as cinco estrelas, "Interesse em nova compra: Sim" e o texto digitado.
- 🎙 Narração: "Pronto. A Wellmix recebeu a sua avaliação e vai analisar as respostas. Se houve problema, ela é avisada na hora."
- 🔤 Na tela: `[SETA]` "Respondido"; `[DEPOIS]` "A Wellmix lê a avaliação e encerra o pós-venda."
- ✂️ Edição: `[ZOOM 150 %]` nas estrelas.

**Cena 9 · 3:20–3:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-06.
- 🎙 Narração: "Resumindo: confira a carga, confirme o recebimento e avalie a compra. No próximo vídeo, veja como comprar de novo ou cancelar."
- 🔤 Na tela: `[RESUMO]` "1 Confira a carga · 2 Confirmar · 3 Avalie a compra · 4 Enviar avaliação"; chamada "Próximo: CLI-06 · Comprar de novo, pedir nova proposta e cancelar".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Engano:** não ver o botão "Confirmar". **Correção:** a etapa **Entrega** só abre quando o **Transporte** termina (a Wellmix também pode confirmar por você, conforme a configuração). Enquanto ela estiver "Pendente", ainda não é a sua vez.
- **Engano:** achar que não dá mais para mudar a avaliação enviada. **Correção:** depois de enviada, ela fica "Respondida" e só a Wellmix a encerra. Antes de enviar, confira a nota.
- **Engano:** esperar um e-mail ou WhatsApp com o convite. **Correção:** o convite chega só no sino e em Pendências (guia, seção 7.5).
- **Aviso do navegador (não do portal):** a nota é obrigatória; sem ela, o navegador pede para preencher o campo antes de enviar.

### Passo a passo em texto

1. Quando a carga chegar, abra a pendência **Pedido #N: Entrega** (em **Pendências**, com **Abrir**) ou o aviso **Pedido #N: Entrega precisa de você** (no sino, com **Resolver**).
2. Na etapa **Entrega**, confira a carga. Se algo estiver errado, clique em **Conversar com a Wellmix** antes de confirmar.
3. Clique em **Confirmar**. O pedido passa a **Pedido encerrado**.
4. Abra a pendência **Avalie a compra: pedido #N** (tipo **Pós-venda**) ou o aviso **Pedido #N: como foi a sua compra?**.
5. No cartão **Pós-venda**, escolha a **Nota da compra (1 a 5)** e o **Interesse em nova compra** (**Sim**, **Talvez** ou **Não**).
6. Escreva, se quiser, **Como foi a experiência?**, **Houve problemas? (produto, prazo, embalagem, transporte)**, **Custos percebidos (impostos, frete, extras)** e **Sugestões**.
7. Clique em **Enviar avaliação**. O cartão passa a **Respondido**.

### Notas de gravação

- **Ordem real das telas:** depois de **Confirmar**, a mesma página mostra o cartão **Pós-venda** logo abaixo da tabela de etapas, seguido de **Comprar de novo / Nova proposta** (CLI-06). Para a cena 7, role até o cartão.
- **Cartão Comprar de novo:** ele já aparece quando o pedido chega à etapa **Entrega**, antes mesmo da confirmação (a regra é "pedido em Entrega ou Encerrado"). Na cena 4, o cartão aparece abaixo da etapa; ignore-o aqui e mostre-o no CLI-06.
- **Avaliação sem "Houve problemas?":** o aviso à Wellmix sai como informativo; com texto em "Houve problemas?", sai como "Atenção". Grave a avaliação sem problema para o exemplo.
- **Ponto de salvamento:** guarde `antes-avaliacao` logo depois de **Confirmar** para repetir só a avaliação (o CLI-06 também parte daí).
- **Modo de confirmação:** a configuração "Confirmação de entrega" (padrão: cliente ou Wellmix). Com o modo "Wellmix", o botão não aparece para o cliente: não grave assim.
- **Faixa âmbar e seletor DEMO:** esconda os dois (guia, seção 7.3).

### Pontos a confirmar

- ⚠ **Carga com avaria ou diferença:** a tela do cliente na etapa Entrega só tem o botão "Confirmar". Não há botão "Informar problema"; o registro de divergência é feito pela Wellmix (cartão Recebimento, `docs/RECEIVING.md`). A cena 4 manda o cliente conversar com a Wellmix antes de confirmar; confirmar com o dono se é isso que ele quer ensinar.
- ⚠ **Saldo a pagar:** depois da entrega, o pedido ainda mostra "A receber do cliente" (no exemplo, R$ 16.800,00). Não achei no código do cliente o passo do pagamento do saldo; confirmar o que dizer (relacionado ao CLI-03).
- ⚠ **Aviso "Entrega precisa de você" continua como "Sua vez" depois de confirmado** até o cliente abri-lo ou excluí-lo (visto no teste). Mostrar o sino só até a cena 3.
- ⚠ **Prazo da etapa Entrega:** a pendência mostra "vence em N dias" a partir do prazo da etapa; não afirmar o número de dias na narração.
- ⚠ **Aviso à Wellmix:** a ação de pós-venda dispara um aviso à Wellmix (informativo, ou de atenção se houver problemas). O texto do aviso é interno (código `answerAfterSales`) e não aparece ao cliente; não citá-lo.

---

## CLI-06 · Comprar de novo, pedir nova proposta e cancelar

> **Promessa:** ao final do vídeo você sabe repor um produto com poucos cliques, pedir uma nova proposta com outro preço ou prazo, e sabe até quando e como cancelar uma solicitação ou um pedido.

| Ficha                 |                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente (cortes curtos com `admin@wellmix.com` só para responder ao cancelamento)                                                                                                                                                 |
| Conta de gravação     | `joao@lojista.com`, tela em pt                                                                                                                                                                                                    |
| Duração-alvo          | 4:30                                                                                                                                                                                                                              |
| Ponto da jornada      | Etapa 9 de 9 e a volta ao começo do ciclo (etapa 2); e a saída de emergência: cancelamento                                                                                                                                        |
| Telas e rotas         | `/app/orders/[id]#followup` (cartão Comprar de novo / Nova proposta), `/app/history`, `/app/requests/[id]` (a nova solicitação), `/app/requests` (excluir), `/app/orders/[id]#cancel` (Solicitar cancelamento)                      |
| Dados antes de gravar | Ponto de salvamento `antes-avaliacao` (o pedido da Jarra **encerrado**, com a avaliação respondida) e, para o cancelamento, um segundo pedido recém-criado da Piscina inflável 2.000 L em **Pedido pré-aprovado** (ponto `ped2-recem-criado`), com o administrador pronto para responder |
| Depois deste vídeo    | A nova solicitação nasce **Solicitado** e segue o fluxo de sempre (cotação, proposta, sinal: CLI-03). O pedido cancelado fica "Cancelado", o cliente recebe "Pedido #N cancelado" (Atenção) e o acerto do sinal é combinado com a Wellmix |
| Antes · Próximo       | CLI-05 · CLI-07 (Histórico e Marketing)                                                                                                                                                                                            |
| Idiomas               | pt (base)                                                                                                                                                                                                                         |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/orders/[id]#followup`**

- 🎬 Imagem: o cartão **Comprar de novo / Nova proposta** com a foto, o produto, "Última quantidade", "Último preço unitário de venda" e os dois botões: "Comprar de novo" (vermelho) e "Quero nova proposta".
- 🎙 Narração: "Gostou da jarra? Comprar de novo leva dois cliques. Quer renegociar o preço? Peça uma nova proposta. E, se mudou de ideia, veja até quando dá para cancelar."
- 🔤 Na tela: `[TÍTULO]` "CLI-06 · Comprar de novo, pedir nova proposta e cancelar"; `[ZOOM 150 %]` nos dois botões.
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:22 · Onde estou na jornada**

- 🎬 Imagem: o mapa com as nove marcas acesas. Uma seta curva sai da marca 9 e volta à marca 2.
- 🎙 Narração: "A jornada é um ciclo: terminou a entrega, você pode começar de novo na solicitação, já com os dados preenchidos."
- 🔤 Na tela: `[MAPA etapa 9]` com a seta de volta à etapa 2.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–1:00 · Onde encontrar · `/app/orders/[id]` e `/app/history`**

- 🎬 Imagem: no pedido da Jarra (menu **Pedidos**, abrir o #1), rolar até o cartão **Comprar de novo / Nova proposta**: a foto (ou "Sem foto"), "Produto", "Última quantidade", "Último preço unitário de venda" (R$ 23,33 / un) e "Data da compra". Corte para o **Histórico**: a linha da Jarra com os botões "Comprar de novo" e "Nova proposta" na coluna "Último pedido".
- 🎙 Narração: "O cartão aparece no pedido, assim que ele chega à entrega. Ele mostra o que você comprou: quantidade, preço unitário e data. Também dá para chegar pelo Histórico, nos botões da linha do produto."
- 🔤 Na tela: `[PASSO 1/7] Abra o pedido entregue`; `[SETA]` "Último preço unitário de venda: o que você pagou"; `[DICA]` "No Histórico, os botões levam a este mesmo cartão."
- ✂️ Edição: `[ZOOM 150 %]` nos dados do último pedido.

**Cena 4 · 1:00–1:40 · Comprar de novo · `/app/orders/[id]#followup`**

- 🎬 Imagem: no formulário do cartão: "Nova quantidade" (já vem com a última, 1200); trocar para 2000. "Prazo de resposta (SLA)" em cinza, só leitura, com "Prazo definido pela Wellmix: resposta da cotação em até 5 dias úteis." Em "Observação para a Wellmix", digitar "Mesma jarra, só mudar a quantidade." Clicar em "Comprar de novo". A página da nova solicitação abre: "Solicitação nº 2", o selo **Solicitado**, o selo **Recompra**, o link "Pedido de origem #1 →" e a tabela já preenchida: quantidade, material, cor, peso por unidade, embalagem e caixa master.
- 🎙 Narração: "Em Comprar de novo, a especificação é a mesma, e você só define a nova quantidade. O prazo de resposta é da Wellmix. Clique em Comprar de novo: nasce uma solicitação já preenchida, ligada ao pedido de origem."
- 🔤 Na tela: `[PASSO 2/7] Escolha Comprar de novo`; `[PASSO 3/7] Defina a nova quantidade`; `[BOTÃO] "Comprar de novo"`; `[SETA]` "Selo Recompra e o link para o pedido de origem"; `[SETA]` "Especificação copiada do pedido".
- ✂️ Edição: `[CORTE]` ao abrir a nova solicitação; `[ZOOM 150 %]` nos selos.

**Cena 5 · 1:40–2:10 · Quero nova proposta · `/app/orders/[id]#followup`**

- 🎬 Imagem: de volta ao cartão, em 1500, clicar em "Quero nova proposta". A solicitação nº 3 abre com o selo **Nova proposta**, a observação "Nova proposta a partir do pedido #1 (última quantidade 1200 un)." e o mesmo link de origem. Em seguida, no pé do cartão, a lista "Solicitações originadas deste pedido" com as duas.
- 🎙 Narração: "Quero nova proposta é para renegociar: a Wellmix busca outro preço, outro prazo ou outras condições. A solicitação nasce igual, só com outro selo. Daí em diante, é o caminho de sempre: cotação, proposta e sinal."
- 🔤 Na tela: `[BOTÃO] "Quero nova proposta"`; `[SETA]` "Comprar de novo: mesma especificação, nova quantidade"; `[SETA]` "Nova proposta: a Wellmix renegocia preço, prazo ou condições"; `[DICA]` "A lista do cartão guarda as solicitações geradas por este pedido."
- ✂️ Edição: `[ZOOM 150 %]` na legenda do cartão (a frase em cinza com as duas explicações).

**Cena 6 · 2:10–2:40 · O Histórico · `/app/history`**

- 🎬 Imagem: a tela **Histórico comercial**: "Cliente → produto → compras → quantidade → preço → data → frequência → reposição." A linha da Jarra com "Compras", "Qtd. total", "Última qtd.", "Último preço unit. (venda)", "Primeira / última compra", "Frequência média", "Reposições", "Recompra" ("Sim", vindo da avaliação) e "Último pedido" (#1).
- 🎙 Narração: "O Histórico guarda tudo o que você comprou, por produto: quantas vezes, em que quantidade e a que preço. Reposições conta os pedidos de recompra e de nova proposta. Recompra vem da sua avaliação."
- 🔤 Na tela: `[SETA]` "Reposições: pedidos de recompra e de nova proposta"; `[SETA]` "Recompra: o interesse que você marcou na avaliação"; `[QUEM VÊ]` "Você vê só o seu histórico, sem custo".
- ✂️ Edição: `[ZOOM 150 %]` nas colunas "Reposições" e "Recompra".

**Cena 7 · 2:40–3:20 · Excluir antes de virar pedido · `/app/requests`**

- 🎬 Imagem: **Orçamentos**, a lista "Suas solicitações". Na linha da solicitação nº 3 (**Solicitado**), clicar na lixeira vermelha "Excluir solicitação": a confirmação do navegador "Excluir esta solicitação? Ela sai da lista e as cotações em aberto são encerradas." Confirmar: a linha some. No alto da lista, o link "Ver canceladas e excluídas (1)" abre a lista com a situação **Excluída**. Mostrar também "Selecionar todas" e "Excluir selecionadas".
- 🎙 Narração: "Mudou de ideia antes de virar pedido? Exclua a solicitação pela lixeira, ou marque várias e clique em Excluir selecionadas. Nada é apagado de verdade: ela sai da lista e fica em Ver canceladas e excluídas. Depois que vira pedido, não dá mais para excluir aqui."
- 🔤 Na tela: `[PASSO 6/7] Exclua a solicitação`; `[BOTÃO] "Excluir solicitação"`; `[ERRO COMUM]` "Já virou pedido: não pode ser excluída aqui (o pedido continua)." e a correção; `[SETA]` "Situação: Excluída".
- ✂️ Edição: a caixa de confirmação do navegador deve aparecer na gravação; `[ZOOM 150 %]` no texto.

**Cena 8 · 3:20–4:05 · Cancelar o pedido · `/app/orders/[id]#cancel`**

- 🎬 Imagem: no pedido da Piscina (ponto `ped2-recem-criado`), rolar até o fim: o cartão **Solicitar cancelamento**: "Você pode pedir o cancelamento até o produto entrar em produção. A Wellmix analisa e responde." Em "Por que deseja cancelar?", digitar "Mudei de ideia: o fornecedor atual atende melhor." e clicar em "Solicitar cancelamento". A faixa verde "Pedido de cancelamento enviado. A Wellmix vai responder." e, no cartão, "Cancelamento solicitado em 11/11/2026. Aguardando a análise da Wellmix." Em tomadas separadas, as duas respostas: (a) recusa: "A Wellmix recusou o cancelamento: O produto já está reservado na fábrica…" com o formulário para pedir de novo; (b) aceita: a faixa "Pedido cancelado em 11/11/2026 por Ana Admin… Motivo: Desistência do cliente", a situação **Cancelado** e o aviso "Pedido #2 cancelado" em **Atenção**.
- 🎙 Narração: "Já virou pedido? Você pode pedir o cancelamento até o produto entrar em produção. Conte o motivo e clique em Solicitar cancelamento. A Wellmix analisa: ela aceita, e o pedido fica Cancelado, ou recusa, com uma resposta. Nada é apagado, tudo fica registrado."
- 🔤 Na tela: `[PASSO 7/7] Solicite o cancelamento`; `[BOTÃO] "Solicitar cancelamento"`; `[SETA]` "Aguardando a análise da Wellmix"; `[QUEM VÊ]` "Só o administrador da Wellmix cancela ou recusa"; `[ERRO COMUM]` "O produto já entrou em produção: o cancelamento só pode ser tratado diretamente com a Wellmix." e a correção.
- ✂️ Edição: três tomadas curtas (pedido, recusa, aceite); a da Wellmix mostra só o formulário "Resposta ao cliente", sem valores de compra.

**Cena 9 · 4:05–4:20 · O que acontece com o sinal**

- 🎬 Imagem: no pedido cancelado, o cartão azul "Acerto financeiro com o cliente: Acerto financeiro ainda não registrado." e os cartões de valores ("Recebido do cliente" R$ 4.500,00, "A receber do cliente" R$ 0,00).
- 🎙 Narração: "E o sinal? Devolução, crédito ou retenção são combinados com a Wellmix, que registra o acerto no pedido. Converse antes de decidir."
- 🔤 Na tela: `[ATENÇÃO]` "O destino do sinal é combinado com a Wellmix"; `[BOTÃO] "Conversar com a Wellmix"`.
- ✂️ Edição: `[ZOOM 150 %]` no cartão azul.

**Cena 10 · 4:20–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do CLI-07.
- 🎙 Narração: "Resumindo: compre de novo ou peça nova proposta, exclua antes do pedido e cancele até a produção. Agora, Histórico e Marketing."
- 🔤 Na tela: `[RESUMO]` "1 Comprar de novo: mesma especificação · 2 Quero nova proposta: renegociar · 3 Excluir: antes de virar pedido · 4 Solicitar cancelamento: até a produção"; chamada "Próximo: CLI-07 · Histórico e Marketing".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** nova quantidade abaixo do pedido mínimo. O servidor recusa com "Quantidade abaixo do pedido mínimo do produto. Use pelo menos o mínimo cadastrado (a tela mostra o valor)." → **Correção:** use pelo menos o mínimo do produto (vale também na recompra).
- **Erro:** excluir uma solicitação que já virou pedido. A lista mostra "Já virou pedido: não pode ser excluída aqui (o pedido continua)." e, se nada puder ser excluído, "Nada foi excluído: as solicitações escolhidas já viraram pedido ou já estavam excluídas." → **Correção:** use "Solicitar cancelamento" no pedido.
- **Erro:** pedir o cancelamento tarde demais. A tela mostra "O produto já entrou em produção: o cancelamento só pode ser tratado diretamente com a Wellmix." (e, se o pedido já passou da janela, "O cancelamento não é mais possível pelo portal: o produto já entrou em produção.") → **Correção:** converse com a Wellmix pelo botão de conversa.
- **Aviso:** cancelamento recusado. A tela mostra "A Wellmix recusou o cancelamento: {resposta}" → **Correção:** leia a resposta; se quiser, escreva um novo motivo e peça de novo.
- **Aviso:** pedido já cancelado. O sistema responde "Este pedido já está cancelado." → **Correção:** nada a fazer.

### Passo a passo em texto

1. Abra o pedido **entregue** em **Pedidos** (ou clique em **Comprar de novo** / **Nova proposta** na linha do produto, no **Histórico**).
2. No cartão **Comprar de novo / Nova proposta**, confira o **Produto**, a **Última quantidade** e o **Último preço unitário de venda**.
3. Informe a **Nova quantidade** (nunca abaixo do pedido mínimo). O **Prazo de resposta (SLA)** é definido pela Wellmix. Use **Observação para a Wellmix** se precisar.
4. Clique em **Comprar de novo** (mesma especificação, nova quantidade) ou em **Quero nova proposta** (a Wellmix renegocia preço, prazo ou condições). Nasce uma solicitação **Solicitado**, com o selo **Recompra** ou **Nova proposta** e o link **Pedido de origem**.
5. Acompanhe a nova solicitação como as outras: cotação, proposta e sinal (CLI-03).
6. Para desistir **antes** de virar pedido: em **Orçamentos**, clique na lixeira (**Excluir solicitação**), ou marque várias e use **Excluir selecionadas** (ou **Excluir o lote**). Ela passa a **Excluída** e fica em **Ver canceladas e excluídas (N)**.
7. Para desistir **depois** de virar pedido: no pedido, em **Solicitar cancelamento**, escreva **Por que deseja cancelar?** e clique em **Solicitar cancelamento**. Isso só vale até o produto entrar em produção. A Wellmix aceita (**Cancelado**) ou recusa com uma resposta.

### Notas de gravação

- **Regras da janela de cancelamento (código):** o cliente só pode pedir enquanto o pedido está em **Pedido pré-aprovado**, **Preparação** ou **Arte e embalagem**, **antes** da data de início da produção da ficha de compra e **antes** de qualquer pagamento ao fornecedor confirmado. A tela do cliente não explica essas regras: só mostra o cartão ou a frase "O produto já entrou em produção…". Não cite as regras na narração além do que a tela diz.
- **Cancelamento só pelo administrador:** "Só o administrador cancela, em qualquer etapa" (`cancel.hint`, tela da Wellmix). A Wellmix responde pelo pedido: "Recusar pedido de cancelamento" (com o campo "Resposta ao cliente") ou o cartão "Cancelar pedido" (motivo, observação, acerto financeiro e confirmação). Grave os dois cortes com `admin@wellmix.com`.
- **Dois pedidos:** o da Jarra (encerrado) serve para Comprar de novo e Nova proposta; um segundo pedido, recém-criado, serve para o cancelamento. Guarde os dois pontos de salvamento (`antes-avaliacao`, `ped2-recem-criado`).
- **Excluir:** a caixa "Excluir esta solicitação?…" é do navegador (`window.confirm`), então a gravação de tela tem de captar a janela do navegador.
- **Cartão da recompra:** o campo "Prazo de resposta (SLA)" é cinza (só leitura) para o cliente; o servidor recalcula o prazo. Em Chrome fora do pt-BR a data sai mm/dd/aaaa.
- **Faixa âmbar e seletor DEMO:** esconda os dois (guia, seção 7.3).

### Pontos a confirmar

- ⚠ **Destino do sinal no cancelamento:** o portal registra um texto livre ("Acerto financeiro com o cliente") escrito pela Wellmix; não há devolução automática. O pedido cancelado continua mostrando "Recebido do cliente R$ 4.500,00" e "A receber do cliente R$ 0,00". Confirmar com o dono a regra de negócio (devolve? credita? retém?) antes de falar do sinal na cena 9; o roteiro diz só "é combinado com a Wellmix".
- ⚠ **Cartão "Comprar de novo" antes da confirmação da entrega:** ele aparece assim que o pedido chega à etapa **Entrega** (visto no teste), não só depois de **Encerrado**. A narração diz "assim que ele chega à entrega"; confirmar com o dono se é o desejado.
- ⚠ **"Reposições" no Histórico:** o número conta pedidos de recompra **e** de nova proposta (no teste, 2 para as duas solicitações criadas). O título fala em "reposição"; confirmar o rótulo.
- ⚠ **Nome do botão:** no cartão do pedido o botão é "Quero nova proposta"; no Histórico é "Nova proposta". A narração usa os dois conforme a tela.
- ⚠ **Briefing de embalagem do pedido cancelado:** a lista da agência (Embalagens) continuou mostrando a Piscina como "No pedido" depois do cancelamento (visto no teste). Fora do escopo do cliente; avisar o dono.
- ⚠ **Quem cancela pedido que já tem pagamento ao fornecedor:** depois da janela, o cliente deve falar com a Wellmix; o caminho depois disso (multa, devolução) não está no portal do cliente.

---

## CLI-07 · Histórico e Marketing

> **Promessa:** ao final do vídeo você sabe ler o seu histórico de compras e entende o que é o Marketing: o kit de arte e textos que a Wellmix pode preparar para o seu produto, a prévia, a oferta e a compra.

| Ficha                 |                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Cliente                                                                                                                                                                                                                                     |
| Conta de gravação     | `joao@lojista.com`, tela em pt. Corte rápido com `admin@wellmix.com` só para oferecer o kit                                                                                                                                                  |
| Duração-alvo          | 3:30                                                                                                                                                                                                                                        |
| Ponto da jornada      | Fora da linha das 9 etapas: consulta (Histórico) e serviço extra (Marketing), depois da etapa 9                                                                                                                                             |
| Telas e rotas         | `/app/history` (Histórico comercial), `/app/marketing` (Marketing), `/app/marketing/[id]` (o kit)                                                                                                                                           |
| Dados antes de gravar | Ponto de salvamento `antes-CLI-07`: ao menos **um pedido não cancelado** do cliente (a Jarra, encerrado, com avaliação "Sim" em "Interesse em nova compra"); e **um kit oferecido**: a Wellmix abre o kit de marketing da panela (carga: "Kit de marketing · Jogo de panelas antiaderentes 5 pçs", R$ 200,00), envia ao menos uma **prévia** (imagem ou PDF) em "Enviar prévias" e clica em "Oferecer ao cliente" |
| Depois deste vídeo    | Ao comprar o kit, a Wellmix recebe o pedido, confirma o pagamento à mão e libera os arquivos finais; o cliente baixa em "Arquivos finais"                                                                                                   |
| Antes · Próximo       | CLI-06 · (fim da série do cliente; os vídeos seguintes são dos outros papéis)                                                                                                                                                                |
| Idiomas               | pt (base)                                                                                                                                                                                                                                   |

### Roteiro

**Cena 1 · 0:00–0:12 · Gancho · `/app/history`**

- 🎬 Imagem: a tela **Histórico comercial** com a linha da Jarra: compras, quantidade, preço, frequência, e os botões "Comprar de novo" e "Nova proposta".
- 🎙 Narração: "O que eu já comprei, e quando? E a Wellmix pode criar a arte e os textos do meu produto? Veja o Histórico e o Marketing."
- 🔤 Na tela: `[TÍTULO]` "CLI-07 · Histórico e Marketing"; `[ZOOM 150 %]` na linha da Jarra.
- ✂️ Edição: vinheta de 6,5 s e título de 2 s antes; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:12–0:20 · Onde estou na jornada**

- 🎬 Imagem: o mapa da jornada com a etapa 9 acesa e, à direita, dois ícones "Histórico" e "Marketing" fora da linha.
- 🎙 Narração: "Estas telas ficam fora do caminho do pedido: uma para consultar o passado, outra para um serviço extra."
- 🔤 Na tela: `[MAPA etapa 9]` com os dois ícones soltos ao lado.
- ✂️ Edição: o mapa sai em 6 s, deslizando para cima.

**Cena 3 · 0:20–1:10 · Histórico comercial · `/app/history`**

- 🎬 Imagem: menu **Meus pedidos** → **Histórico**. O título "Histórico comercial" e o subtítulo "Cliente → produto → compras → quantidade → preço → data → frequência → reposição." A tabela, de perto, coluna a coluna: "Produto", "Compras", "Qtd. total", "Última qtd.", "Último preço unit. (venda)", "Primeira / última compra", "Frequência média", "Reposições", "Recompra" e "Último pedido". No canto, o contador "1 linha(s)".
- 🎙 Narração: "Cada linha é um produto que você comprou. Veja quantas compras foram, a quantidade total, a última quantidade e o último preço por unidade. Frequência média é o intervalo, em dias, entre as compras do mesmo produto. Com uma compra só, fica em branco."
- 🔤 Na tela: `[PASSO 1/5] Abra Histórico`; `[PASSO 2/5] Leia a linha do produto`; `[SETA]` "Frequência média: dias entre as compras (em branco com uma compra)"; `[SETA]` "Último preço unit. (venda): o que você pagou"; `[QUEM VÊ]` "Você vê só o seu histórico, sem custo".
- ✂️ Edição: `[ZOOM 150 %]` em cada grupo de colunas, 3 s cada; sem cortar a tabela.

**Cena 4 · 1:10–1:40 · Comprar de novo pelo histórico · `/app/history`**

- 🎬 Imagem: na coluna "Último pedido": o link "Pedido #1" e os botões "Comprar de novo" e "Nova proposta". Clicar em "Comprar de novo": a tela leva ao cartão do pedido (`#followup`), o mesmo do CLI-06. Voltar.
- 🎙 Narração: "Na última coluna, abra o último pedido, ou use Comprar de novo e Nova proposta: eles levam ao cartão do pedido, que você já conhece. Os números de Compras e Reposições só contam o que foi lançado no portal."
- 🔤 Na tela: `[PASSO 3/5] Compre de novo pelo Histórico`; `[BOTÃO] "Comprar de novo"`; `[BOTÃO] "Nova proposta"`; `[DICA]` "Pedido cancelado não conta como compra."
- ✂️ Edição: `[CORTE]` seco para o cartão do pedido e de volta.

**Cena 5 · 1:40–2:15 · O que é o Marketing · `/app/marketing`**

- 🎬 Imagem: menu **Meus pedidos** → **Marketing**. O título e o subtítulo "Kits de marketing por produto: prévia → oferta → compra → pagamento → liberação." A faixa azul: "Prévia → compra → liberação. Você recebe a prévia quando a Wellmix faz a oferta; depois da compra e da confirmação do pagamento, os arquivos finais ficam disponíveis para download." Primeiro, a lista vazia: "Nenhum kit oferecido a você ainda." Depois, com o kit: a tabela "Kit", "Produto", "Preço", "Situação", "Criado", "Oferta", "Liberação".
- 🎙 Narração: "Marketing é um serviço à parte: a Wellmix prepara um kit de imagens e textos para o seu produto. Você recebe a prévia quando ela faz a oferta. Se gostar, compra o kit. Depois do pagamento, os arquivos finais ficam liberados para baixar."
- 🔤 Na tela: `[PASSO 4/5] Abra Marketing`; `[SETA]` "Kit: imagens e textos de divulgação do produto"; `[SETA]` "Prévia → oferta → compra → pagamento → liberação"; `[QUEM VÊ]` "Você só vê os kits oferecidos a você".
- ✂️ Edição: duas tomadas: a lista vazia (2 s) e a lista com o kit (5 s); o aviso "Kit de marketing disponível" chega no sino em **Novidades**.

**Cena 6 · 2:15–3:00 · Abrir o kit · `/app/marketing/[id]`**

- 🎬 Imagem: clicar em "Abrir" na linha do kit. A página: o título "Kit de marketing · Jogo de panelas antiaderentes 5 pçs" com o selo **Oferecido**, o cliente e o preço (R$ 200,00). Os cartões: "Produto" (somente leitura), "Linha do tempo" (Rascunho, Prévia, Oferta, Compra, Pagamento, Liberação, com a etapa atual em vermelho), "Textos do kit" (Conceito, Slogan, Descrição comercial, Campanha, Cores, Pantone), "Prévias" (a miniatura e o link "Baixar") e "Arquivos finais" com o aviso "Os arquivos finais são liberados após a confirmação do pagamento." No cartão "Situação e ações": "A Wellmix ofereceu este kit a você." e o preço grande.
- 🎙 Narração: "Abra o kit para ver o produto, os textos propostos e as prévias, que você pode baixar. A linha do tempo mostra em que passo ele está. Os arquivos finais só aparecem depois da compra e da confirmação do pagamento."
- 🔤 Na tela: `[PASSO 5/5] Veja a prévia e decida`; `[SETA]` "Prévias: visíveis desde a oferta"; `[SETA]` "Arquivos finais: só depois da liberação"; `[SETA]` "Linha do tempo: a etapa atual em vermelho".
- ✂️ Edição: percorrer os cartões em 30 s; `[ZOOM 150 %]` na linha do tempo.

**Cena 7 · 3:00–3:20 · Comprar o kit · `/app/marketing/[id]`**

- 🎬 Imagem: no cartão "Situação e ações", clicar em "Comprar kit". A faixa verde "Ação registrada." e, no cartão, "Compra registrada. Aguardando a confirmação do pagamento pela Wellmix." (Tomada seguinte, depois de a Wellmix confirmar e liberar: "Arquivos liberados: baixe em “Arquivos finais”." e o cartão "Arquivos finais" com a lista.)
- 🎙 Narração: "Para comprar, clique em Comprar kit. O pagamento fica pendente e a Wellmix confirma o recebimento. Confirmado e liberado o kit, baixe os arquivos em Arquivos finais."
- 🔤 Na tela: `[BOTÃO] "Comprar kit"`; `[ATENÇÃO]` "Ao comprar, um pagamento pendente é registrado: só compre se quiser o kit"; `[DEPOIS]` "A Wellmix confirma o pagamento e libera os arquivos finais. Você é avisado no sino."
- ✂️ Edição: `[ZOOM 150 %]` na frase "Compra registrada…"; sem mostrar dados de pagamento.

**Cena 8 · 3:20–3:30 · Resumo e fim da série**

- 🎬 Imagem: fundo vermelho com a lista; no fim, o cartão "Série CLI concluída" com os sete episódios e a vinheta de encerramento.
- 🎙 Narração: "Resumindo: o Histórico mostra o que você comprou, e o Marketing oferece kits de imagens e textos. Pronto: você conhece o portal do cliente."
- 🔤 Na tela: `[RESUMO]` "1 Histórico: o que comprou, quando e a que preço · 2 Marketing: prévia, oferta e compra do kit · 3 Arquivos finais só depois da liberação"; chamada "Série CLI concluída".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Engano:** histórico vazio. A tela mostra "Nenhuma compra registrada ainda." → **Correção:** o histórico só mostra pedidos criados e não cancelados; peça um produto e acompanhe (CLI-02, CLI-03).
- **Engano:** achar que um pedido ainda em andamento ou cancelado conta como compra. **Correção:** pedido cancelado fica de fora; pedido em andamento já conta.
- **Engano:** marketing vazio. A tela mostra "Nenhum kit oferecido a você ainda." → **Correção:** a Wellmix é quem oferece o kit; peça pela conversa com a Wellmix.
- **Aviso:** com o estúdio desligado, a tela mostra "O marketing studio está desligado nas configurações (marketingEnabled). Os kits existentes continuam visíveis, mas nenhuma ação nova é possível." → **Correção:** falar com a Wellmix.
- **Engano:** esperar os arquivos finais logo depois de comprar. **Correção:** o cartão "Arquivos finais" diz "Os arquivos finais são liberados após a confirmação do pagamento." e só mostra os arquivos depois da liberação.

### Passo a passo em texto

1. No menu **Meus pedidos**, abra **Histórico**. Cada linha é um produto: **Compras**, **Qtd. total**, **Última qtd.**, **Último preço unit. (venda)**, **Primeira / última compra**, **Frequência média**, **Reposições**, **Recompra** e **Último pedido**.
2. Para repor, clique em **Comprar de novo** ou **Nova proposta** na linha do produto: você vai ao cartão do último pedido (CLI-06).
3. No menu **Meus pedidos**, abra **Marketing**. Cada linha é um kit oferecido a você: **Kit**, **Produto**, **Preço**, **Situação**, **Criado**, **Oferta** e **Liberação**. Clique em **Abrir**.
4. No kit, veja o **Produto**, a **Linha do tempo**, os **Textos do kit** e as **Prévias** (use **Baixar**).
5. Se quiser o kit, clique em **Comprar kit**. O pagamento fica pendente até a Wellmix confirmar o recebimento.
6. Depois da liberação, baixe os arquivos em **Arquivos finais**.

### Notas de gravação

- **Preparar a oferta (Wellmix):** com `admin@wellmix.com`, abra Gestão → Marketing → o kit; no cartão "Prévias", clique em "Enviar prévias" e escolha uma imagem; em "Situação e ações", clique em "Oferecer ao cliente" (o kit precisa do cliente definido). O cliente recebe "Kit de marketing disponível: {nome}" ("Veja a prévia e, se quiser, compre por R$ 200,00") em **Novidades**.
- **Grave as duas tomadas da cena 5:** a lista vazia (antes da oferta) e com o kit (depois).
- **Cena 7:** a compra cria um pagamento pendente. Para a segunda tomada, a Wellmix confirma o pagamento, envia os arquivos finais e clica em "Liberar arquivos" (ponto de salvamento `kit-liberado`).
- **Imagem do kit:** o cartão "Produto" do kit mostra "Nenhuma imagem disponível para este kit." se o produto não tem foto; suba fotos antes (guia, seção 7.5).
- **Campos em branco:** "Textos do kit" mostra "—" em Conceito, Slogan, Descrição comercial e Campanha quando a Wellmix ainda não preencheu; preencha antes de gravar para a tela ficar completa. A IA do estúdio é opcional e fica em modo manual sem credencial (nada a mostrar ao cliente).
- **Faixa âmbar e seletor DEMO:** esconda os dois (guia, seção 7.3).

### Pontos a confirmar

- ⚠ **Preço do kit:** vem do cadastro do kit (R$ 200,00 na carga) e é cobrado à parte do pedido; confirmar com o dono se o valor pode aparecer no vídeo.
- ⚠ **Como o cliente paga o kit:** o portal registra "um pagamento pendente" e a Wellmix confirma à mão (modo manual). Não achei tela de Pix para o kit; confirmar como o cliente é orientado a pagar antes de gravar a cena 7.
- ⚠ **Compra sem confirmação:** "Comprar kit" registra a compra na hora, sem caixa de confirmação (visto no teste; o retorno é só "Ação registrada."). Confirmar se é intencional.
- ⚠ **Texto técnico para o cliente:** o aviso do estúdio desligado cita "marketingEnabled", que é nome de configuração. Se o dono quiser, trocar por texto simples.
- ⚠ **Fluxo depois da compra:** as mensagens "Pagamento confirmado. Aguardando a liberação dos arquivos finais." e "Arquivos liberados: baixe em “Arquivos finais”." vêm do dicionário; conferi a oferta e a compra na tela, mas não a confirmação do pagamento nem a liberação.
- ⚠ **"Recompra" no Histórico:** "Sim" vem da última avaliação respondida do pedido (CLI-05); sem avaliação, a coluna mostra "—".
