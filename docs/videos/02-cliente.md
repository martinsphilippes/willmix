# Série CLI · Cliente

Vídeos para quem compra da Wellmix pelo portal: a Loja do João (`joao@lojista.com`, tela em pt). O cliente vê **a vitrine (Explorar)** e o grupo **Meus pedidos** (Orçamentos, Pedidos, Pendências, Notificações, Mensagens, Histórico, Marketing). Ele nunca vê o fornecedor, o preço FOB, a margem nem as cotações (docs/SCOPE.md, docs/ACCESS.md).

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os episódios seguem o modelo da seção 5 do guia.

| ID      | Episódio                                       | Duração-alvo | Situação          |
| ------- | ---------------------------------------------- | ------------ | ----------------- |
| CLI-02  | Fazer uma nova solicitação                     | 4:30         | roteirizado (modelo) |

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
- ⚠ O texto exato do botão "Remover" do produto (o teste usa o nome acessível "Remover: Produto 3"); confirmar na tela.
- ⚠ Se a quantidade já vem preenchida com o mínimo ao escolher o produto (docs/WORKFLOW.md diz que sim); na cena 8 a quantidade foi digitada à mão para mostrar o ajuste.
- ⚠ Cena 3: o menu "Meus pedidos" é um grupo; confirmar o nome exato do item "Orçamentos" na gravação (aparece como "Orçamentos" no título da tela).
