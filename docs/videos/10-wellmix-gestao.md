# Série WGE · Wellmix, gestão, finanças e administração

Vídeos para quem comanda a operação pela Wellmix: o **administrador** (`admin@wellmix.com`, Ana Admin, tela em pt). Ele abre todas as telas: no menu **Início** (Control Tower, Pendências, Painel de SLA, Notificações, Mensagens), **Pedidos**, **Cadastros** e **Gestão** (Painel do dono, Fluxo de caixa, Painéis por área, Financeiro, Contas a pagar, Multas, Pós-venda, Marketing, Histórico, Configurações, Equipe e divisões, Auditoria). Financeiro, Contas a pagar, Configurações, Equipe e Superplan são **só do administrador**, ou de quem ele liberar tela a tela (docs/ACCESS.md).

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e lista de qualidade). Os episódios seguem o modelo da seção 5 do guia e a qualidade do [CLI-02](02-cliente.md).

**Documentos lidos para esta série:** docs/SCOPE.md, docs/WORKFLOW.md (Control Tower, pagamento ao fornecedor, pós-venda), docs/ACCESS.md, docs/SLA_PANEL.md, docs/OPEN_DECISIONS.md, docs/APPROVALS.md, docs/DASHBOARDS.md, docs/INVENTORY.md (Painel do dono e Fluxo de caixa), docs/EVOLUTION_PLAN.md (itens 33 a 37), docs/RFQ_STANDBY.md e a parte de Configurações de docs/SANKHYA.md. A interface foi conferida no código, nos dicionários (`src/i18n`) e numa execução real do build de produção com os dados da Jarra.

## O que o administrador vê e o que o operador vê de menos

O operador de demonstração (`operador@wellmix.com`, Otávio Operador) tem as funções **comprador** e **planner**. Conferido na tela, ele **não vê**:

| Tela ou parte                                           | Administrador | Operador (comprador + planner)                                                      |
| ------------------------------------------------------- | :-----------: | ----------------------------------------------------------------------------------- |
| Control Tower: faixa "Financeiro"                       | sim           | não                                                                                 |
| Control Tower: valores em R$ nos quadrados              | sim           | não (só a quantidade e o selo de atrasados)                                         |
| Control Tower: quadrados de dinheiro (parcelas, "A receber do cliente") e "Visão comercial por container" | sim | não |
| Gestão → Painel do dono e Fluxo de caixa                | sim           | não                                                                                 |
| Gestão → Painéis por área                               | todas as abas | sem a aba "Financeiro"                                                              |
| Gestão → Financeiro e Contas a pagar                    | sim           | não: volta ao início com o aviso "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões." |
| Gestão → Multas, Marketing, Configurações, Equipe e divisões, Auditoria | sim | não (mesmo aviso)                                                                   |
| Gestão → Pós-venda e Histórico                          | sim           | sim (comprador e planner abrem)                                                     |
| Pedido: cartões coloridos de valores, "Financeiro do pedido", "Pagamentos" e "Pagamento ao fornecedor" | sim | não |
| Pedido: "Resumo do pedido" com FOB e valor de venda     | sim           | **sim** (⚠ ver pontos a confirmar do WGE-01)                                        |

Cada episódio traz um `[QUEM VÊ]` onde isso importa. O vídeo do administrador nunca mostra a conta de um login real; só os dados da Jornada da Jarra.

## Conta de gravação e preparo

- Conta principal: `admin@wellmix.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa). Para os trechos "o operador vê de menos", troque de perfil do Chrome para `operador@wellmix.com`; para o jurídico (WGE-08), `juridico@wellmix.com`; para o cliente (WGE-06 e WGE-07), `joao@lojista.com`. Senha `wellmix123`.
- Entre por `/login?intro=off` e esconda a faixa de demonstração e o seletor DEMO (GUIA, seção 7.3).
- **A RFQ com vários fornecedores está em espera** (docs/RFQ_STANDBY.md). Grave com o interruptor **desligado** (padrão). Os quadrados "RFQ aberta" e "Comparação de cotações" da Control Tower continuam existindo, mas hoje a solicitação vai a **um fornecedor** (Pedidos → RFQ, "Enviar ao fornecedor").
- **Só um login interno de demonstração** existe com função: o Otávio. Não há conta pronta de financeiro, diretoria ou designer. O WGE-10 mostra como criar mais um acesso interno (Cadastros → Outros parceiros → um parceiro → "Acesso ao portal", papel "Operador Wellmix").
- Sugestão de pontos de salvamento (GUIA, seção 7.2): `antes-WGE-01`, `antes-WGE-03`, `antes-WGE-04`, `antes-WGE-06`, `antes-WGE-07`, `antes-WGE-08`, `antes-WGE-11`. Os episódios 03, 04, 06 e 11 **gravam dados** (recebimento, pagamento, encerramento, limpeza).

| ID     | Episódio                                           | Duração-alvo | Situação      |
| ------ | -------------------------------------------------- | ------------ | ------------- |
| WGE-01 | Control Tower: o painel de comando                 | 4:30         | roteirizado   |
| WGE-02 | Painel de SLA e painéis por área                   | 4:00         | roteirizado   |
| WGE-03 | Financeiro: vendido, recebido e a receber          | 4:30         | roteirizado   |
| WGE-04 | Contas a pagar e a conta corrente do fornecedor    | 5:00         | roteirizado   |
| WGE-05 | Painel do dono e fluxo de caixa                    | 3:30         | roteirizado   |
| WGE-06 | Pós-venda e histórico comercial                    | 4:00         | roteirizado   |
| WGE-07 | Marketing: kits e tabela de preços                 | 4:30         | roteirizado   |
| WGE-08 | Multas (visão da Wellmix)                          | 3:00         | roteirizado   |
| WGE-09 | Configurações: os parâmetros do sistema            | 5:30         | roteirizado   |
| WGE-10 | Equipe e divisões: funções e telas por login       | 5:00         | roteirizado   |
| WGE-11 | Auditoria e dados de demonstração                  | 3:30         | roteirizado   |

---

## WGE-01 · Control Tower: o painel de comando

> **Promessa:** ao final do vídeo você lê a Control Tower de cima a baixo (financeiro, blocos de quadrados e visões gerais), toca num quadrado para ver os pedidos dele e sabe o que o operador não enxerga.

| Ficha                 |                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, administrador (e o operador, só como contraste)                                                                                               |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; no fim, `operador@wellmix.com`                                                                                        |
| Duração-alvo          | 4:30                                                                                                                                                   |
| Ponto da jornada      | As 9 etapas, vistas de cima (a Control Tower é o mapa vivo da jornada)                                                                                 |
| Telas e rotas         | `/app` (Control Tower), `/app?card=CHAVE` (lista de um quadrado), `/app?filter=exceptions` (Exceções), `/app/finance` (ao tocar a faixa Financeiro)      |
| Dados antes de gravar | Jarra (pedido #1) criada com o sinal confirmado e um pagamento ao fornecedor pedido; de preferência mais 2 ou 3 pedidos em etapas diferentes (com só a Jarra, quase todo quadrado fica cinza). Ponto `antes-WGE-01` |
| Depois deste vídeo    | Nada é gravado: a Control Tower é só leitura. O próximo passo é ver por pessoa e por prazo (WGE-02)                                                      |
| Antes · Próximo       | GER-01 (Primeiros passos) · WGE-02                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                              |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a Control Tower inteira, rolando devagar do alto até o fim: faixa Financeiro, quadrados coloridos, cartões brancos. O cursor repousa sobre a faixa Financeiro.
- 🎙 Narração: "Quantos pedidos estão rodando, onde cada um está parado e quanto já entrou? Tudo isso cabe numa tela só: a Control Tower."
- 🔤 Na tela: `[TÍTULO]` "WGE-01 · Control Tower: o painel de comando"; `[ZOOM 150 %]` na faixa "Financeiro".
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a tela parada. O mapa da jornada aparece sobre ela, com as nove etapas acesas.
- 🎙 Narração: "A Control Tower acompanha a jornada inteira, da solicitação do cliente à entrega. Ela mostra o pedido de ponta a ponta, em quadrados por etapa."
- 🔤 Na tela: `[MAPA etapas 1 a 9]` com todas as marcas acesas; `[QUEM VÊ]` "Toda a Wellmix abre; o que aparece depende das telas liberadas".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:44 · A faixa Financeiro · menu Início → Control Tower**

- 🎬 Imagem: o cursor abre o menu **Início** e clica em **Control Tower**. Em destaque a faixa **Financeiro** com seis cartões: "Vendido", "Recebido", "A receber", "Comprado (FOB)", "Pago ao fornecedor" e "Saldo a pagar". O cursor passa por cada um. Aparece a frase "Totais só com o que foi lançado (pedidos, pagamentos, recebimentos e containers); nada é estimado." No fim, clica em "A receber" e a tela do Financeiro abre (corte de volta).
- 🎙 Narração: "No menu Início, clique em Control Tower. No alto está a faixa Financeiro: vendido, recebido, a receber, comprado, pago ao fornecedor e saldo a pagar. São só valores lançados; nada é estimado. Clique num cartão para abrir o Financeiro."
- 🔤 Na tela: `[PASSO 1/6] Abra Início → Control Tower`; `[SETA]` "Só o que foi lançado" na frase pequena à direita; `[QUEM VÊ]` "Faixa Financeiro: só o administrador (ou quem ele liberar)"; `[SETA]` "Vendido, recebido e a receber: em reais. Comprado, pago e saldo: na moeda do FOB (dólar)".
- ✂️ Edição: `[ZOOM 150 %]` na faixa; `[CORTE]` para o Financeiro e volta.

**Cena 4 · 0:44–1:10 · Os blocos da Operação · `/app`**

- 🎬 Imagem: rolar até o título "Operação" e a frase "Toque num quadrado: os pedidos dele aparecem logo abaixo. Toque de novo para fechar." O cursor desce bloco por bloco: **Booking** ("produtos antes de virar solicitação; toque para abrir o Booking nessa etapa"), **Antes de virar pedido** ("ainda é solicitação"), **Onde o pedido está agora** ("cada pedido aparece em um só quadrado"), **Acontece ao mesmo tempo** ("o mesmo pedido pode aparecer aqui e no bloco de cima") e **Problemas** ("o que precisa de atenção").
- 🎙 Narração: "Abaixo vem a Operação, em quatro blocos de quadrados: antes de virar pedido, onde o pedido está agora, acontece ao mesmo tempo e problemas. Quem abre a tela Booking vê, antes deles, o bloco Booking."
- 🔤 Na tela: `[PASSO 2/6] Leia os blocos de cima para baixo`; `[SETA]` com o nome de cada bloco, na ordem; `[DICA]` "O Booking é o bloco 0: é onde o fluxo começa."
- ✂️ Edição: realce de cada bloco por 2 s, apagando o anterior.

**Cena 5 · 1:10–1:32 · Como ler um quadrado · `/app`**

- 🎬 Imagem: zoom num quadrado colorido (por exemplo "Conferência e Sankhya": 1, "R$ 28.000,00") e num cinza (0). Mostrar o selo vermelho "1 atrasado" num quadrado que o tenha (se houver na gravação).
- 🎙 Narração: "Cada quadrado mostra a quantidade. Um selo vermelho diz quantos estão com o prazo vencido ali. Para quem abre as finanças, aparece também o valor de venda. Quadrado com zero fica cinza, mas não some."
- 🔤 Na tela: `[SETA]` "Quantidade"; `[SETA]` "Selo vermelho: prazo vencido" (texto real do selo: "1 atrasado" ou "N atrasados"); `[SETA]` "Valor de venda: só com Financeiro"; `[SETA]` "Cinza = zero".
- ✂️ Edição: `[ZOOM 200 %]` no quadrado colorido, depois no cinza.

**Cena 6 · 1:32–2:08 · Tocar num quadrado · `/app?card=ordConference`**

- 🎬 Imagem: clicar em **Conferência e Sankhya**. A tela não volta ao topo: uma tabela abre logo abaixo do bloco, com o título "Conferência e Sankhya" e as colunas "#", "Cliente", "Produto", "Etapa", "Responsável" e "Prazo". Linha: #1, Loja do João Ltda, Jarra de vidro 1,5 L, selo "Pedido pré-aprovado", "Operador Wellmix", prazo. Passar o cursor no número `#1` e no balão de conversa. Clicar de novo no quadrado: a lista fecha.
- 🎙 Narração: "Toque num quadrado, como Conferência e Sankhya. Os pedidos dele aparecem logo abaixo: número, cliente, produto, etapa, responsável e prazo. Clique no número para abrir o pedido, ou no balão para conversar. Toque de novo para fechar."
- 🔤 Na tela: `[PASSO 3/6] Toque num quadrado`; `[SETA]` "A lista abre aqui, sem rolar a página"; `[SETA]` "Número: abre o pedido"; `[SETA]` "Balão: conversa com a empresa"; `[ATENÇÃO]` "Prazo vencido aparece em vermelho."
- ✂️ Edição: manter a lista aberta 4 s; fechar com um clique visível.

**Cena 7 · 2:08–2:30 · Atalhos: "+" e quadrados que levam a outra tela · `/app`**

- 🎬 Imagem: o cursor aponta o "+" no canto do quadrado **Solicitação nova** (aparece quando há uma solicitação nova; clicar nele abre a tela de nova solicitação) e o botão "+ Nova solicitação" na lista aberta. Depois passa em **Containers abertos** e **Itens para revisão**, que abrem as telas deles em vez de uma lista. Passa nos quadrados do Booking ("Novo", "Em análise", "Aprovado", "Oferecido ao cliente", "Reservado pelo cliente", "Virou solicitação", "Descartado"): cada um abre o Booking na etapa.
- 🎙 Narração: "O mais, no quadrado Solicitação nova, abre uma nova solicitação. Quem abre o Booking só vê esse quadrado quando existe solicitação do cliente. Containers abertos, Itens para revisão e os do Booking levam direto às telas deles."
- 🔤 Na tela: `[BOTÃO] "+ Nova solicitação"`; `[SETA]` "Abre outra tela, não uma lista"; `[DICA]` "Para quem tem o Booking, 'Solicitação nova' só aparece enquanto houver alguma."
- ✂️ Edição: `[CORTE]` seco ao abrir cada tela e voltar.

**Cena 8 · 2:30–3:05 · Onde está agora × ao mesmo tempo × problemas · `/app`**

- 🎬 Imagem: o bloco "Onde o pedido está agora" com os quadrados em ordem da jornada ("Conferência e Sankhya", "Ficha de compra", "Validação da ficha", "Arte da embalagem", "Aprovação da arte", "Inspeção", "Inspeção com problema", "Esperando reserva no navio", "Esperando o navio sair", "No mar", "No porto / alfândega", "Esperando caminhão", "A caminho do cliente", "Entregue, falta confirmar", "Encerrados no mês", "Cancelados no mês"). Depois "Acontece ao mesmo tempo" ("Em produção na fábrica", "Certificação pendente", "Numerário para pagar", "Recebendo no armazém"...) e "Problemas" ("Atrasados", "Bloqueados", "Documento rejeitado", "Sem número no Sankhya", "Multa aberta", "Itens para revisão", "Certificação vencendo", "Pedido de cancelamento"). O cursor para em "Certificação pendente" (o mesmo pedido da Jarra também está em "Conferência e Sankhya").
- 🎙 Narração: "No bloco Onde o pedido está agora, cada pedido ocupa um quadrado só. Em Acontece ao mesmo tempo, o mesmo pedido pode aparecer em vários: produção, certificação, numerário, canal amarelo. Em Problemas fica o que pede atenção: atrasados, bloqueados, multa aberta."
- 🔤 Na tela: `[SETA]` "Um pedido, um quadrado"; `[SETA]` "Um pedido, vários quadrados"; `[DICA]` "A Jarra aparece em 'Conferência e Sankhya' e também em 'Certificação pendente'."
- ✂️ Edição: um traço liga a Jarra nos dois quadrados (animação de 2 s).

**Cena 9 · 3:05–3:35 · Visões gerais e Exceções · `/app?filter=exceptions`**

- 🎬 Imagem: rolar até "Visões gerais": doze cartões brancos ("Pedidos ativos", "Solicitações em aberto", "Aguardando fornecedor", "Aguardando cliente", "Em preparação", "Em inspeção", "Em embarque", "Em desembaraço", "Em transporte", "Atrasados", "Com problema", "Concluídos") mais "Exceções" e "Visão comercial por container". Clicar em **Exceções**: abre o cartão com cada exceção (selo, detalhe e o link "Abrir"). Clicar de novo fecha.
- 🎙 Narração: "Mais abaixo ficam as Visões gerais: os doze cartões de sempre. Em Exceções, cada problema traz o atalho Abrir para o pedido. A Visão comercial por container mostra o volume vendido e o disponível, só para quem abre o Financeiro."
- 🔤 Na tela: `[PASSO 4/6] Veja as Visões gerais`; `[BOTÃO] "Exceções"`; `[QUEM VÊ]` "Visão comercial por container: só com a tela Financeiro".
- ✂️ Edição: manter a lista de Exceções 3 s.

**Cena 10 · 3:35–4:10 · O que o operador vê de menos · `/app` (Otávio)**

- 🎬 Imagem: troca de perfil para `operador@wellmix.com`. A Control Tower dele: sem a faixa Financeiro, quadrados só com número, sem "Parcela vencida", "Parcela vencendo", "Pago no banco, falta marcar" e "A receber do cliente". Digitar `/app/finance` na barra de endereço (ou clicar num link): volta ao início com o aviso amarelo "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões."
- 🎙 Narração: "Agora, o operador. Ele não tem a faixa Financeiro, os quadrados não mostram valores e os de dinheiro nem aparecem. Se tentar abrir o Financeiro, volta ao início com um aviso: peça ao administrador. Quem libera as telas é o administrador."
- 🔤 Na tela: `[PASSO 5/6] Compare com a visão do operador`; `[QUEM VÊ]` "Operador: só o operacional, sem valores"; `[SETA]` "Aviso: você não tem acesso a Financeiro"; `[ATENÇÃO]` "Não é erro técnico: é a regra de acesso."
- ✂️ Edição: tela dividida por 5 s (admin à esquerda, operador à direita); depois só o aviso, em zoom.

**Cena 11 · 4:10–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-02.
- 🎙 Narração: "Resumindo: o financeiro no alto, os quadrados no meio, a lista ao tocar. No próximo vídeo, o Painel de SLA: o que cada analista deve, pelo prazo."
- 🔤 Na tela: `[RESUMO]` "1 Faixa Financeiro: só o lançado · 2 Quatro blocos de quadrados (e o Booking) · 3 Tocar no quadrado abre a lista · 4 Visões gerais e Exceções · 5 O operador não vê valores"; `[PASSO 6/6] Conclua`; chamada "Próximo: WGE-02 · Painel de SLA e painéis por área".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Aviso:** "Você não tem acesso a {tela}. Peça ao administrador em Gestão → Equipe e divisões." Aparece no alto da Control Tower quando o login abre uma tela que não lhe foi liberada. → **Correção:** pedir ao administrador para liberar a tela (WGE-10).
- **Aviso:** "Seu login ainda não tem função nem tela liberada. Por enquanto você vê só o básico: Pendências, Painel de SLA, Notificações e Mensagens. Peça ao administrador para liberar seus acessos em Gestão → Equipe e divisões." Vale para um login interno novo, sem função. → **Correção:** o administrador marca as funções do login.
- **Dúvida comum:** o quadrado "Containers abertos" ou "Itens para revisão" não abre lista embaixo. → **Correção:** esses dois (e os do Booking) levam à tela deles, que é onde se age.
- **Dúvida comum:** a lista de um quadrado sem pedidos mostra "Nada por aqui." → **Correção:** não é erro; o quadrado estava em zero.

### Passo a passo em texto

1. No menu, abra **Início** e clique em **Control Tower**.
2. No alto, confira a faixa **Financeiro**: **Vendido**, **Recebido**, **A receber**, **Comprado (FOB)**, **Pago ao fornecedor** e **Saldo a pagar**. Clique num cartão para abrir o **Financeiro**. Só o administrador (ou quem ele liberar) vê esta faixa.
3. Em **Operação**, leia os blocos de cima para baixo: **Booking** (só para quem abre a tela Booking), **Antes de virar pedido**, **Onde o pedido está agora** (cada pedido em um quadrado só), **Acontece ao mesmo tempo** (o mesmo pedido pode estar em vários) e **Problemas**.
4. Em cada quadrado: a quantidade, o selo vermelho com os atrasados e, para quem abre o Financeiro, o valor de venda. Zero fica cinza.
5. Toque num quadrado para ver os pedidos dele logo abaixo (número, cliente, produto, etapa, responsável e prazo). Clique no número para abrir o pedido. Toque de novo para fechar.
6. No quadrado **Solicitação nova**, o **+** abre uma nova solicitação. **Containers abertos**, **Itens para revisão** e os quadrados do Booking abrem a tela deles.
7. Em **Visões gerais**, use os cartões e **Exceções**. A **Visão comercial por container** só aparece com o Financeiro.

### Notas de gravação

- A Control Tower recalcula a cada abertura; grave logo depois de restaurar o ponto de salvamento. Os prazos (vermelho) mudam com o dia: não cite datas na narração.
- Para ver "N atrasados" num quadrado, use um pedido com a etapa vencida (por exemplo, a Jarra com o prazo de "Pedido pré-aprovado" ultrapassado). Sem isso, só aparece o quadrado, sem o selo.
- A RFQ em espera: o quadrado "RFQ aberta" mostra a solicitação que foi ao fornecedor (o nome é o da etapa no banco, docs/RFQ_STANDBY.md, seção 8). Não explique disputa entre fornecedores.
- Esconda o seletor DEMO e a faixa de demonstração (GUIA, 7.3). No celular, os quadrados formam 2 colunas; este roteiro é só desktop.
- O texto da cena 5 do operador usa o mesmo pedido da Jarra: confira que o operador também aparece como "Responsável" nos quadrados.

### Pontos a confirmar

- ⚠ O pedido do código diz "quatro blocos"; a tela traz um quinto, **Booking**, para quem abre a tela Booking (o administrador abre). O roteiro diz "quatro blocos e, antes, o Booking". Confirmar com o dono se prefere esse texto.
- ⚠ No **Resumo do pedido** e em **Itens do pedido**, o operador vê "FOB" e "Valor de venda" (`canSeeInternalCosts` é verdadeiro para toda a Wellmix), embora docs/ACCESS.md (regra 3) diga que a função financeiro "não vê valores". Conferido na tela com o Otávio. É decisão de negócio: manter ou esconder.
- ⚠ O selo de atrasados ("1 atrasado", "N atrasados") só foi lido no código (`board.late.one` e `board.late.many`); confirmar na gravação com um pedido vencido.
- ⚠ O ID do episódio anterior ("GER-01 · Primeiros passos") vem do GUIA, seção 7.4; confirmar o código no README.

---

## WGE-02 · Painel de SLA e painéis por área

> **Promessa:** ao final do vídeo você sabe ver o que cada analista deve, pelo prazo, e abrir os painéis de Compras, Produção, Embarque, Recebimento, Certificação e Financeiro.

| Ficha                 |                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, administrador (e o operador, como contraste)                                                                                                   |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; no fim, `operador@wellmix.com`                                                                                         |
| Duração-alvo          | 4:00                                                                                                                                                    |
| Ponto da jornada      | As 9 etapas: o prazo de cada etapa e de cada pendência (docs/SLA_PANEL.md)                                                                               |
| Telas e rotas         | `/app/sla` (Início → Painel de SLA), `/app/sla?show=week`, `/app/sla?u=...`, `/app/dashboards` (Gestão → Painéis por área), `/app/dashboards?area=...`    |
| Dados antes de gravar | Em Equipe e divisões (WGE-10): o Otávio com cargo "Analista", divisão "Wellmix" e "Responde a" Ana Admin; a linha "Utilidades domésticas" na divisão "Wellmix"; **a Ana sem divisão** (com divisão ela também recebe pendências). Uma solicitação nova da Loja do João (Jogo de panelas) e a Jarra já como pedido. Ponto `antes-WGE-02` |
| Depois deste vídeo    | Nada é gravado. O que se acompanha aqui é cobrado nas telas de cada área                                                                                |
| Antes · Próximo       | WGE-01 · WGE-03                                                                                                                                          |
| Idiomas               | pt (base)                                                                                                                                               |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/sla`**

- 🎬 Imagem: o Painel de SLA com a tabela Equipe, cartões e a lista de pendências. O cursor repousa na coluna "Vencem hoje".
- 🎙 Narração: "Quem está devendo o quê, e para quando? O Painel de SLA responde por pessoa, pelo prazo, sem ninguém precisar perguntar."
- 🔤 Na tela: `[TÍTULO]` "WGE-02 · Painel de SLA e painéis por área"; `[ZOOM 150 %]` na tabela Equipe.
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:22 · Onde estou · menu Início → Painel de SLA**

- 🎬 Imagem: o cursor abre **Início** e clica em **Painel de SLA**. O título "Painel de SLA" e a frase "O que cada analista deve, pelo prazo, nas solicitações e pedidos da divisão dele, e o que está atrasado com parceiros para ele cobrar."
- 🎙 Narração: "O prazo mantém a jornada andando. O Painel de SLA fica no menu Início e todo login da Wellmix abre. Aqui você vê o que está devendo."
- 🔤 Na tela: `[MAPA etapas 1 a 9]` com um relógio sobre todas; `[PASSO 1/6] Abra Início → Painel de SLA`; `[QUEM VÊ]` "Toda a Wellmix abre; cada um vê o seu painel (e o da equipe, quem tem equipe)".
- ✂️ Edição: mapa sai em 8 s.

**Cena 3 · 0:22–0:50 · De quem é cada pendência · `/app/sla`**

- 🎬 Imagem: a coluna "Responsável" da lista de pendências, com os nomes. Em seguida o link "Equipe e divisões" no canto do título (só o administrador vê esse link).
- 🎙 Narração: "Cada pendência tem um dono, escolhido pelo sistema. A solicitação nova cai no analista da divisão da linha do produto que tiver menos pendências abertas. O pedido herda esse dono. Ninguém escolhe à mão."
- 🔤 Na tela: `[SETA]` "Dono automático: divisão da linha → analista com menos pendências"; `[SETA]` "Link: Equipe e divisões (cargo, divisão e chefe ficam lá, WGE-10)"; `[ATENÇÃO]` "Sem divisão ou sem analista: a pendência fica em 'Sem responsável'."
- ✂️ Edição: seta animada da linha do produto ao analista.

**Cena 4 · 0:50–1:20 · A tabela Equipe · `/app/sla`**

- 🎬 Imagem: o cartão **Equipe** com as colunas "Pessoa", "Cargo", "Divisão", "Atrasadas", "Vencem hoje", "Próx. 7 dias", "Parceiros atrasados" e "Etapas no prazo (30 dias)". Linhas: "Ana Admin" (Diretor, Wellmix), "↳ Otávio Operador" (Analista, Wellmix) recuado, e "Sem responsável". Abaixo, os links "Todos" e "Ana Admin".
- 🎙 Narração: "Para o administrador, a tabela Equipe lista todos. Cada linha traz cargo, divisão e quantas pendências estão atrasadas, vencem hoje ou nos próximos sete dias. O recuo mostra a quem a pessoa responde. Em Sem responsável ficam as que ainda não têm dono."
- 🔤 Na tela: `[PASSO 2/6] Leia a tabela Equipe`; `[SETA]` "Recuo ↳ = responde a quem está acima"; `[SETA]` "Vermelho: atrasadas. Âmbar: vencem hoje"; `[QUEM VÊ]` "Só quem tem equipe (ou é administrador) vê esta tabela".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Atrasadas".

**Cena 5 · 1:20–1:52 · Cartões como filtros · `/app/sla?show=week`**

- 🎬 Imagem: os seis cartões: "Atrasadas", "Vencem hoje", "Próx. 7 dias", "Depois / sem prazo", "Parceiros atrasados" e "Etapas no prazo (30 dias)". A frase "Toque num cartão para ver só aquele grupo embaixo." Clicar em **Próx. 7 dias**: abre "Próximos 7 dias (1)" com as colunas "Pendência", "Detalhe", "Cliente", "Responsável", "Prazo" e o botão vermelho "Abrir". O prazo traz um selo: "vence hoje", "em N dia(s)" ou "N dia(s) de atraso". Clicar em "Todas as pendências" para voltar.
- 🎙 Narração: "Os cartões são filtros. Toque num deles e só aquele grupo aparece embaixo. Cada linha traz a pendência, o cliente, o responsável e o prazo, com um selo: vence hoje, em tantos dias ou dias de atraso. Clique em Abrir para ir ao pedido."
- 🔤 Na tela: `[PASSO 3/6] Toque num cartão`; `[BOTÃO] "Abrir"`; `[SETA]` "Selo do prazo"; `[SETA]` "Link: Todas as pendências"
- ✂️ Edição: manter a tabela 3 s; o cartão escolhido fica com borda vermelha.

**Cena 6 · 1:52–2:22 · Parceiros atrasados e Etapas no prazo · `/app/sla`**

- 🎬 Imagem: clicar em **Parceiros atrasados**: aparece a tabela "Atrasos de parceiros (cobrar)" com a coluna "Aguardando" (quem está devendo). Depois clicar em **Etapas no prazo (30 dias)**: a tabela com "#", "Etapa", "Cliente", "Prazo", "Concluída em" e "Situação" ("No prazo" ou "Fora do prazo"); o cartão mostra algo como "100% (2 de 2)".
- 🎙 Narração: "Parceiros atrasados lista o que um fornecedor, a agência ou outro parceiro deve. Não conta contra o analista, mas é ele quem cobra. Etapas no prazo é o percentual das etapas concluídas até o dia do prazo, nos últimos trinta dias."
- 🔤 Na tela: `[SETA]` "Aguardando: quem está devendo"; `[SETA]` "Percentual: concluída até o dia do prazo"; `[DICA]` "Verde a partir de 90%, âmbar de 70%, vermelho abaixo."
- ✂️ Edição: `[ZOOM 150 %]` no percentual.

**Cena 7 · 2:22–2:48 · Escolher uma pessoa e o painel do operador · `/app/sla?u=...`**

- 🎬 Imagem: clicar no nome "Otávio Operador" na tabela: a tela passa a "Mostrando: Otávio Operador". Depois o perfil do operador: o painel dele não tem a tabela Equipe (ele não tem equipe), só os cartões e a lista. Se o operador não tem divisão: o aviso azul "Você ainda não tem divisão, por isso o painel está vazio. Peça ao administrador para definir em Equipe e divisões."
- 🎙 Narração: "Clique num nome para ver o painel dele. Quem não tem equipe vê só o próprio painel. E se o login ainda não tem divisão, o painel fica vazio, com um aviso para pedir ao administrador."
- 🔤 Na tela: `[SETA]` "Mostrando: Otávio Operador"; `[QUEM VÊ]` "Cada pessoa: o próprio painel e o de quem está abaixo; administrador: todos"; `[ATENÇÃO]` "Painel vazio com aviso = falta a divisão."
- ✂️ Edição: troca de perfil com `[CORTE]`.

**Cena 8 · 2:48–3:28 · Painéis por área · menu Gestão → Painéis por área**

- 🎬 Imagem: no menu **Gestão**, clicar em **Painéis por área**. Título "Painéis por área" e a frase "Os números de cada área, calculados agora. Clique para ir aonde se age." No alto à direita, os links "Painel do dono", "Fluxo de caixa" e "Auditoria". As abas: "Compras", "Produção", "Embarque e desembaraço", "Recebimento", "Certificação e artes" e "Financeiro". Clicar em **Compras** (cartões "Solicitações abertas", "Aguardando cotação", "Cotadas, escolher fornecedor", "Aprovações pendentes", "Dias médios para aprovar", "Taxa de reprovação", "Seguradas por dumping") e depois em **Financeiro** (cartões "Sinais a confirmar", "Pagamentos a fornecedor pendentes", "Numerários a validar", "Valor dos numerários a validar", "Pedidos sem lançamento no ERP"). Abaixo, o cartão "Pedidos que pedem atenção" com "Nada pedindo atenção agora." ou a lista.
- 🎙 Narração: "Em Gestão, abra Painéis por área. Há uma aba para Compras, Produção, Embarque, Recebimento, Certificação e Financeiro. Os números são calculados na hora e cada um leva à tela onde se age. Embaixo, os pedidos que pedem atenção."
- 🔤 Na tela: `[PASSO 4/6] Abra Gestão → Painéis por área`; `[BOTÃO] "Compras"`; `[BOTÃO] "Financeiro"`; `[QUEM VÊ]` "Aba Financeiro: só o administrador. O operador planner vê as outras cinco."
- ✂️ Edição: `[ZOOM 150 %]` nos cartões de Compras; `[CORTE]` ao trocar de aba.

**Cena 9 · 3:28–3:48 · O operador e os painéis · `/app/dashboards` (Otávio)**

- 🎬 Imagem: perfil do operador (planner): "Painéis por área" abre, sem a aba "Financeiro" e sem os links "Painel do dono" e "Fluxo de caixa". Digitar `?area=finance` na barra: volta ao início com o aviso de acesso.
- 🎙 Narração: "O operador com a função planner também abre os painéis, mas sem a aba Financeiro e sem o Painel do dono. Se forçar o endereço, volta ao início com o aviso de acesso."
- 🔤 Na tela: `[PASSO 5/6] Compare com o operador`; `[QUEM VÊ]` "Planner: painéis sem o Financeiro"; `[SETA]` "Aviso: você não tem acesso a Financeiro".
- ✂️ Edição: tela dividida por 4 s.

**Cena 10 · 3:48–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-03.
- 🎙 Narração: "Resumindo: cada pendência tem um dono, os cartões filtram e os painéis levam à ação. A seguir, o Financeiro: vendido, recebido e a receber."
- 🔤 Na tela: `[RESUMO]` "1 Dono automático por divisão · 2 Cartões = filtros · 3 Parceiros atrasados são para cobrar · 4 Painéis por área levam à ação"; `[PASSO 6/6] Conclua`; "Próximo: WGE-03 · Financeiro".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Aviso:** "Você ainda não tem divisão, por isso o painel está vazio. Peça ao administrador para definir em Equipe e divisões." → **Correção:** o administrador define a divisão do login (WGE-10).
- **Aviso (administrador):** "Pendências sem analista: produto fora do catálogo, linha sem divisão ou divisão sem analista. Ajuste em Equipe e divisões e use "Distribuir agora"." (aparece ao escolher "Sem responsável"). → **Correção:** definir a divisão da linha e do analista e tocar em **Distribuir agora** em Equipe e divisões.
- **Mensagem:** "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões." quando o operador força a aba Financeiro em Painéis por área. → **Correção:** só o administrador abre o Financeiro, ou quem ele liberar.
- **Estado normal:** "Tudo em dia." (sem nenhuma pendência) e "Nada pendente aqui." (o grupo escolhido está vazio) não são erro.

### Passo a passo em texto

1. No menu, abra **Início** e clique em **Painel de SLA**.
2. Na tabela **Equipe** (só para quem tem equipe), veja por pessoa: **Atrasadas**, **Vencem hoje**, **Próx. 7 dias**, **Parceiros atrasados** e **Etapas no prazo (30 dias)**. O recuo ↳ mostra a quem cada um responde; **Sem responsável** junta o que ainda não tem dono.
3. Clique no nome de uma pessoa para ver o painel dela, ou em **Todos** para ver o conjunto.
4. Toque num cartão (**Atrasadas**, **Vencem hoje**, **Próx. 7 dias**, **Depois / sem prazo**, **Parceiros atrasados**, **Etapas no prazo (30 dias)**) para ver só aquele grupo embaixo. Use **Abrir** para ir à pendência e **Todas as pendências** para voltar.
5. **Parceiros atrasados** é a lista do que um parceiro deve: serve para cobrar e não conta como atraso do analista.
6. No menu **Gestão**, abra **Painéis por área** e escolha a aba (**Compras**, **Produção**, **Embarque e desembaraço**, **Recebimento**, **Certificação e artes** ou **Financeiro**). Clique num número para ir à tela onde se age.

### Notas de gravação

- Antes da gravação, em Equipe e divisões: Otávio com cargo, divisão e chefe; a linha do produto da Jarra com divisão; depois **Distribuir agora**. **Deixe a Ana sem divisão**: com divisão, ela entra na escolha automática e recebe a pendência (conferido na execução). Isso só vale para as pendências criadas depois; as que já nasceram com dono não mudam.
- O prazo de cada pendência muda com o dia da gravação: mostre sem citar datas.
- Para o selo "vence hoje" aparecer, a gravação precisa de uma pendência com prazo no dia (por exemplo, uma parcela ao fornecedor vencendo). Caso contrário, só "em N dia(s)".
- O link "Equipe e divisões" no título só aparece para o administrador.

### Pontos a confirmar

- ⚠ O título de uma pendência de etapa aparece com o código técnico: "Pedido #1: ORDER_CREATED" (a etapa traduzida, "Pedido pré-aprovado", vem na linha de baixo). Texto estranho para o espectador; confirmar se vira "Pedido #1: Pedido pré-aprovado".
- ⚠ O detalhe da pendência "Pagar fornecedor" aparece como "Shenzhen Supplier A · parcela 1/2 · USD 846.00", com "USD" e ponto decimal, diferente do "US$ 846,00" das outras telas.
- ⚠ docs/SLA_PANEL.md (seções 1 a 3 e 6) ainda fala em "carteira de clientes"; a tela e o subtítulo falam em **divisão**. O roteiro segue a tela.
- ⚠ A pendência "Responder {empresa}" da Controladoria de mensagens (`/app/messages/control`) também cai neste painel (docs/SLA_PANEL.md, 5a). Não faz parte deste episódio; confirmar se entra num vídeo de Mensagens.
- ⚠ Os limites 90% e 70% das cores de "Etapas no prazo" foram lidos no código (`OnTime`); confirmar com o dono se devem aparecer na narração.

---

## WGE-03 · Financeiro: vendido, recebido e a receber

> **Promessa:** ao final do vídeo você lê o Financeiro (venda, recebimento, custo e margem por pedido), registra um recebimento do cliente e informa o câmbio do banco quando ele faltar.

| Ficha                 |                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, administrador                                                                                                                                   |
| Conta de gravação     | `admin@wellmix.com`, tela em pt                                                                                                                          |
| Duração-alvo          | 4:30                                                                                                                                                     |
| Ponto da jornada      | Etapa 4 de 9 (Sinal e pedido) até a 9: o dinheiro acompanha o pedido. O pagamento ao fornecedor é o selo "paralelo" (WGE-04)                              |
| Telas e rotas         | `/app/finance` (Gestão → Financeiro), `/app/orders/[id]` (cartão "Financeiro do pedido" e tabela "Pagamentos"), `/app/requests/[id]` (botão "Confirmar sinal recebido") |
| Dados antes de gravar | Pedido #1 da Jarra criado, com o **sinal já confirmado** (cliente com comprovante enviado no CLI-03; a Wellmix confirmou), saldo a receber e um pagamento ao fornecedor **feito sem câmbio** (para o fim do episódio). Ponto `antes-WGE-03` |
| Depois deste vídeo    | O recebimento registrado vai para a conta do cliente e para os totais; o cliente é avisado ("Pedido #n: pagamento recebido"). O câmbio informado recalcula custo e margem na hora |
| Antes · Próximo       | WGE-02 · WGE-04                                                                                                                                           |
| Idiomas               | pt (base)                                                                                                                                                |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/finance`**

- 🎬 Imagem: a tela Financeiro: seis cartões no alto e a tabela com o pedido #1. O cursor repousa nos cartões "A receber" e "A pagar", ambos em destaque âmbar.
- 🎙 Narração: "Quanto você vendeu, quanto já recebeu e quanto ainda falta? O Financeiro mostra isso, pedido por pedido, com o custo e a margem."
- 🔤 Na tela: `[TÍTULO]` "WGE-03 · Financeiro: vendido, recebido e a receber"; `[ZOOM 150 %]` nos seis cartões.
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:24 · Onde estou na jornada · `/app/finance`**

- 🎬 Imagem: a tela parada; o mapa da jornada aparece com as etapas 4 a 9 acesas e um selo "paralelo" ao lado.
- 🎙 Narração: "O dinheiro começa no sinal, na etapa quatro, e acompanha o pedido até a entrega. O Financeiro junta tudo o que já foi lançado."
- 🔤 Na tela: `[MAPA etapa 4]` com as etapas 4 a 9 acesas; selo "paralelo" sobre o pagamento ao fornecedor.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:24–0:56 · Abrir e ler os cartões · menu Gestão → Financeiro**

- 🎬 Imagem: o cursor abre **Gestão** e clica em **Financeiro**. Os seis cartões: "Vendido", "Recebido", "A receber", "Pago ao fornecedor", "A pagar" e "Margem" (com "(pedidos estimados: 1)" e o "~" na frente do valor). Passar o cursor em cada um.
- 🎙 Narração: "Em Gestão, abra Financeiro. Vendido, recebido e a receber ficam em reais, a moeda da venda. Pago ao fornecedor e a pagar ficam na moeda do FOB, o dólar. Reais e dólares nunca se misturam. A margem vem por último."
- 🔤 Na tela: `[PASSO 1/7] Abra Gestão → Financeiro`; `[SETA]` "Venda: em reais"; `[SETA]` "Fornecedor: na moeda do FOB"; `[QUEM VÊ]` "Só o administrador (ou quem ele liberar)".
- ✂️ Edição: `[ZOOM 150 %]` nos cartões "A receber" e "A pagar".

**Cena 4 · 0:56–1:30 · A tabela por pedido · `/app/finance`**

- 🎬 Imagem: a tabela com as colunas "#", "Cliente", "Produto", "Venda", "Recebido", "A receber", "FOB", "Pago ao fornecedor", "A pagar", "Câmbio", "Custo" e "Margem". Na linha do pedido #1: o número é link (abre o pedido) e, embaixo, a etapa ("Pedido pré-aprovado"). O cursor percorre da esquerda para a direita; no fim, o balão de conversa.
- 🎙 Narração: "Cada pedido é uma linha: venda, recebido e a receber, de um lado; FOB, pago e a pagar ao fornecedor, do outro. Câmbio, custo e margem fecham a conta. O número abre o pedido, e o balão abre a conversa."
- 🔤 Na tela: `[PASSO 2/7] Leia a linha do pedido`; `[SETA]` "Cliente: venda, recebido, a receber"; `[SETA]` "Fornecedor: FOB, pago, a pagar"; `[SETA]` "Câmbio → custo → margem".
- ✂️ Edição: realce em duas faixas de cor (cliente e fornecedor), 3 s cada.

**Cena 5 · 1:30–2:00 · Como o sinal entra · `/app/requests/[id]` → `/app/orders/[id]`**

- 🎬 Imagem: mostrar, sem repetir, o fim do CLI-03: na solicitação, o aviso "O cliente enviou o comprovante. Confira o recebimento na conta e confirme o sinal." e o botão **Confirmar sinal recebido**. Corte para o pedido: tabela "Pagamentos" com a linha "Cliente", valor, situação "Confirmado" e observação "Sinal".
- 🎙 Narração: "O sinal entra assim: o cliente paga e anexa o comprovante, e a Wellmix confere na conta e clica em Confirmar sinal recebido. O pedido nasce, e o sinal aparece no pedido, em Pagamentos, como confirmado."
- 🔤 Na tela: `[BOTÃO] "Confirmar sinal recebido"`; `[SETA]` "Situação: Confirmado"; `[DEPOIS]` "O sinal vira 'Recebido' no Financeiro."
- ✂️ Edição: `[CORTE]` entre as duas telas; selo verde "Confirmado" em zoom.

**Cena 6 · 2:00–2:50 · Registrar um recebimento · `/app/orders/[id]`**

- 🎬 Imagem: no pedido #1, rolar até **Financeiro do pedido** (a tabela com "Custo", "Câmbio" e "Margem"). Clicar em **+ Registrar recebimento do cliente**: o formulário abre com "Valor" (já com o que falta, por exemplo R$ 16.800,00), "Moeda" (Real (BRL)), "Forma" (placeholder "PIX, boleto, TED") e "Comprovante (opcional)". Digitar um valor menor (por exemplo 8.400,00), "PIX" em Forma e clicar no botão vermelho **Registrar recebimento do cliente**. Voltar ao Financeiro: "Recebido" subiu e "A receber" caiu.
- 🎙 Narração: "Chegou mais dinheiro do cliente? Abra o pedido, vá em Financeiro do pedido e clique em Registrar recebimento do cliente. O valor já vem com o que falta. Ajuste, escolha a forma, anexe o comprovante se tiver e confirme. O Financeiro se atualiza na hora."
- 🔤 Na tela: `[PASSO 3/7] Abra o pedido → Financeiro do pedido`; `[BOTÃO] "+ Registrar recebimento do cliente"`; `[PASSO 4/7] Valor, moeda, forma e comprovante`; `[BOTÃO] "Registrar recebimento do cliente"`; `[ATENÇÃO]` "Quando não resta nada a receber, o botão some."
- ✂️ Edição: digitação em tempo real; `[CORTE]` seco para o Financeiro com os números novos; `[ZOOM 150 %]` em "Recebido" e "A receber".

**Cena 7 · 2:50–3:25 · Margem, "~" e câmbio · `/app/finance`**

- 🎬 Imagem: zoom no cartão "Margem" (valor com "~", percentual embaixo) e na coluna "Câmbio" do pedido: "~5,5517", "~ cotação automática de 10/11", "câmbio da venda: 5,5517". Aparece a legenda no pé da tabela: "~ = estimado: o que foi pago com o câmbio do banco informado usa esse câmbio; o que foi pago sem câmbio e o que falta pagar ao fornecedor usam a cotação automática do dia, até alguém informar o câmbio do banco."
- 🎙 Narração: "A margem é a venda menos o custo em reais. O til diz que o custo é estimado: o que foi pago com o câmbio do banco é real; o que ainda falta pagar usa a cotação automática do dia. Quando o câmbio do banco é informado, o til some."
- 🔤 Na tela: `[PASSO 5/7] Entenda o "~"`; `[SETA]` "~ = estimado pela cotação do dia"; `[SETA]` "Câmbio da venda: o da proposta"; `[DICA]` "Quanto antes o câmbio do banco entra, mais real é a margem."
- ✂️ Edição: `[ZOOM 150 %]` no "~" do cartão e depois na legenda do pé da tabela.

**Cena 8 · 3:25–4:05 · Informar câmbio · `/app/finance`**

- 🎬 Imagem: na coluna "Câmbio", o aviso âmbar "Falta o câmbio do banco de 2 pagamentos (US$ 1.346,00)" (ou "...do pagamento de US$ 500,00 (11/11)", se só um) e o botão **Informar câmbio**. Clicar: abre um campo por pagamento, com o texto "US$ 846,00, pago em 11/11" e o campo "R$ por 1 USD". Digitar 5,40 e clicar em **Salvar câmbio**. A linha mostra "5,4000", "câmbio do banco, pago em 11/11" e a mensagem "Câmbio salvo; custo e margem recalculados." O custo e a margem mudam.
- 🎙 Narração: "Pagou o fornecedor sem o câmbio do banco? A linha avisa. Clique em Informar câmbio, digite quantos reais o banco cobrou por dólar e salve. Custo e margem são recalculados na hora, e a coluna mostra quanto o câmbio mudou o resultado."
- 🔤 Na tela: `[PASSO 6/7] Informe o câmbio do banco`; `[BOTÃO] "Informar câmbio"`; `[BOTÃO] "Salvar câmbio"`; `[SETA]` "R$ por 1 USD: o que o banco cobrou"; `[ERRO COMUM]` "Câmbio inválido: informe R$ por 1 unidade da moeda (maior que zero)."
- ✂️ Edição: `[ZOOM 150 %]` no campo; antes e depois da margem lado a lado por 3 s.

**Cena 9 · 4:05–4:20 · O operador vê de menos · `/app/finance` (Otávio)**

- 🎬 Imagem: perfil do operador: no pedido #1 não há cartões coloridos de valores, nem "Financeiro do pedido", nem "Pagamentos". Ao abrir o endereço do Financeiro, volta ao início com o aviso de acesso.
- 🎙 Narração: "O operador não abre o Financeiro e não vê, no pedido, os cartões de valores nem os pagamentos. Esse é um trabalho do administrador."
- 🔤 Na tela: `[QUEM VÊ]` "Financeiro, pagamentos e margem: só o administrador"; `[SETA]` "Aviso: você não tem acesso a Financeiro".
- ✂️ Edição: tela dividida por 4 s.

**Cena 10 · 4:20–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-04.
- 🎙 Narração: "Resumindo: leia a linha do pedido, registre o que entrou e informe o câmbio. Em seguida, o lado do fornecedor: Contas a pagar."
- 🔤 Na tela: `[RESUMO]` "1 Seis cartões: venda, recebido, a receber, pago, a pagar, margem · 2 Registrar recebimento no pedido · 3 O til é estimativa · 4 Informar câmbio tira o til"; `[PASSO 7/7] Conclua`; "Próximo: WGE-04 · Contas a pagar".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** valor do recebimento zerado ou em branco. A tela volta ao pedido com "Confira o valor de: Valor." e "Toque em um item para ir até ele." → **Correção:** digitar um valor maior que zero.
- **Erro:** câmbio com valor inválido. A tela mostra "Câmbio inválido: informe R$ por 1 unidade da moeda (maior que zero)." → **Correção:** informar quantos reais vale 1 dólar (ou 1 unidade da moeda), por exemplo 5,40.
- **Erro:** informar câmbio de um pagamento que ainda não foi feito. A tela mostra "O câmbio é informado em pagamento já feito (confirmado ou recebido)." → **Correção:** marcar o pagamento como pago antes (WGE-04).
- **Erro:** informar câmbio de um pagamento em reais. A tela mostra "Pagamento em reais não tem câmbio." → **Correção:** não é preciso câmbio em pagamento em reais.
- **Aviso (não é erro):** o selo âmbar "Câmbio pendente" na coluna Custo, e "Câmbio pendente: N" no cartão Margem, aparecem quando não há câmbio nenhum para converter. → **Correção:** informar o câmbio do banco ou configurar o câmbio do dia em Configurações (WGE-09).

### Passo a passo em texto

1. No menu, abra **Gestão** e clique em **Financeiro**.
2. Leia os cartões: **Vendido**, **Recebido** e **A receber** (na moeda da venda, normalmente reais); **Pago ao fornecedor** e **A pagar** (na moeda do FOB, normalmente dólar); **Margem** (com "~" quando é estimada).
3. Na tabela, cada pedido mostra **Venda**, **Recebido**, **A receber**, **FOB**, **Pago ao fornecedor**, **A pagar**, **Câmbio**, **Custo** e **Margem**. Clique no número do pedido para abri-lo.
4. O **sinal** entra quando a Wellmix clica em **Confirmar sinal recebido** na solicitação; ele aparece no pedido, em **Pagamentos**, como confirmado.
5. Para registrar outro recebimento, abra o pedido, vá a **Financeiro do pedido** e clique em **+ Registrar recebimento do cliente**. Confira **Valor** e **Moeda**, preencha **Forma** (PIX, boleto, TED) e, se quiser, o **Comprovante (opcional)**. Clique em **Registrar recebimento do cliente**.
6. Se uma linha disser "Falta o câmbio do banco…", clique em **Informar câmbio**, digite o câmbio (R$ por 1 unidade da moeda) e clique em **Salvar câmbio**. Custo e margem são recalculados.

### Notas de gravação

- Valores da gravação (podem variar): venda R$ 28.000,00; FOB US$ 2.820,00 (1.200 un a US$ 2,35). Não cite valores na narração, só mostre.
- O "~" some do custo só quando **todos** os pagamentos têm o câmbio do banco e nada resta a pagar. No fim do episódio, ele continua enquanto houver saldo a pagar (isso é o esperado).
- Para a cena 8, o pagamento sem câmbio nasce em Contas a pagar (WGE-04, "Já pagou? Registrar…" sem preencher o câmbio) ou em "Marcar como pago" sem câmbio.
- O campo do câmbio é numérico: no Chrome em pt-BR aceita vírgula; se não aceitar, use ponto. Confirmar na gravação (⚠ abaixo).
- No Financeiro, a etapa do pedido aparece como "Pedido pré-aprovado" sob o número (é o nome da etapa 1 do pedido); mostre sem explicar.

### Pontos a confirmar

- ⚠ Os totais "Vendido", "Recebido" e "A receber" usam a moeda de venda do **primeiro pedido da lista** (`rows[0]` em `loadFinance`); pedidos vendidos em outra moeda ficam só na tabela e fora dos três cartões. Hoje a Wellmix vende em reais, então não aparece; confirmar com o dono antes de ensinar o contrário.
- ⚠ A data "pago em 11/11" do aviso "Falta o câmbio do banco…" usa a data em UTC, enquanto o vencimento usa o dia de Brasília: entre 21h e meia-noite as duas datas ficam um dia diferentes (visto na execução: pagamento em 11/11 e vencimento em 10/11). Possível bug de fuso.
- ⚠ Se o recebimento é feito por Pix com chave configurada (Configurações → "Chave Pix"), o cliente vê o Pix copia e cola e o QR Code na proposta (CLI-03). Este episódio não mostra isso; confirmar se a chave estará configurada na gravação.
- ⚠ O botão "Registrar recebimento do cliente" aparece duas vezes no pedido com nomes quase iguais: o título que abre o formulário ("+ Registrar recebimento do cliente") e o botão que grava ("Registrar recebimento do cliente"). O roteiro cita os dois; confirmar na tela.

---

## WGE-04 · Contas a pagar e a conta corrente do fornecedor

> **Promessa:** ao final do vídeo você configura a condição de pagamento de um fornecedor, acompanha as parcelas em Contas a pagar, pede e marca o pagamento como pago e entende o que o fornecedor vê e confirma.

| Ficha                 |                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, administrador (com o fornecedor como contraponto)                                                                                                   |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; no fim, `supplier.a@china.com` (Li Wei, em zh ou en) só para mostrar a confirmação                                          |
| Duração-alvo          | 5:00                                                                                                                                                         |
| Ponto da jornada      | Selo "paralelo" nas etapas 4 a 9: o pagamento ao fornecedor corre fora do fluxo do pedido (docs/WORKFLOW.md)                                                 |
| Telas e rotas         | `/app/suppliers` e `/app/suppliers/[id]` (conta do fornecedor), `/app/parties/[id]#payment-terms` (condição), `/app/payables` (Contas a pagar), `/app/orders/[id]#supplier-payment` (card "Pagamento ao fornecedor"), `/app/account` (conta corrente, vista pelo fornecedor) |
| Dados antes de gravar | Shenzhen Supplier A com a condição que já vem na carga (30% no pedido + 70% 90 dias após a entrega); **dados bancários do fornecedor preenchidos** (Beneficiário, Banco, Conta / IBAN, SWIFT); pedido #1 com parcela 1/2 vencendo. Ponto `antes-WGE-04` |
| Depois deste vídeo    | A parcela vira "Solicitado ao banco/financeiro" e depois "Pago · falta o fornecedor confirmar"; o fornecedor recebe o aviso "Pedido #n: pagamento enviado, confirme o recebimento"; o Financeiro e a Control Tower se atualizam |
| Antes · Próximo       | WGE-03 · WGE-05                                                                                                                                               |
| Idiomas               | pt (base). A cena do fornecedor mostra a tela dele; se gravada em zh ou en, use os rótulos do próprio idioma (GUIA, seção 2)                                   |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/payables`**

- 🎬 Imagem: a tela Contas a pagar: cartões de situação, abas e a lista de parcelas. O cursor repousa na parcela "Vence em breve".
- 🎙 Narração: "Quando vence a próxima parcela de cada fornecedor, e quanto ainda falta pagar? Em Contas a pagar, tudo aparece parcela por parcela."
- 🔤 Na tela: `[TÍTULO]` "WGE-04 · Contas a pagar e a conta corrente do fornecedor"; `[ZOOM 150 %]` no selo "Vence em breve".
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:25 · Onde estou na jornada · `/app/payables`**

- 🎬 Imagem: tela parada; o mapa da jornada aparece com as etapas 4 a 9 e o selo "paralelo" bem visível.
- 🎙 Narração: "O pagamento ao fornecedor corre ao lado do pedido e não o segura. Cada fornecedor tem a sua condição, combinada à parte, e as parcelas vencem meses depois."
- 🔤 Na tela: `[MAPA etapa 4]` com as etapas 4 a 9 e o selo "paralelo"; legenda "Não segura o pedido".
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:25–1:05 · A condição de pagamento do fornecedor · `/app/parties/[id]#payment-terms`**

- 🎬 Imagem: no menu **Cadastros**, abrir **Fornecedores**, clicar em "Shenzhen Supplier A" e em **Editar cadastro**. Rolar até **Condição de pagamento ao fornecedor**: duas parcelas, "30 % do FOB, Conta a partir de Pedido gerado, Dias depois 0" e "70 %, Entrega ao cliente, 90 dias", "Total 100%". Mostrar os atalhos (por exemplo "30% na data do pedido + 70% 90 dias após a entrega ao cliente"), "+ Adicionar parcela", "Observação para o fornecedor" e o botão **Salvar condição**.
- 🎙 Narração: "Tudo começa no cadastro do fornecedor. Em Condição de pagamento, cada parcela é uma parte do FOB, paga alguns dias depois de um marco: pedido gerado, embarque ou entrega ao cliente. As parcelas precisam somar cem por cento. Os pedidos novos copiam essa condição ao nascer."
- 🔤 Na tela: `[PASSO 1/7] Cadastros → Fornecedores → Editar cadastro`; `[SETA]` "% do FOB · Conta a partir de · Dias depois"; `[BOTÃO] "Salvar condição"`; `[ATENÇÃO]` "Pedido já gerado guarda a condição dele; mudar o cadastro não mexe nele."; `[ERRO COMUM]` "Total 90%: as parcelas precisam somar 100%".
- ✂️ Edição: `[ZOOM 150 %]` nas duas parcelas; o "Total 100%" fica 2 s na tela.

**Cena 4 · 1:05–1:40 · A lista de Contas a pagar · menu Gestão → Contas a pagar**

- 🎬 Imagem: no menu **Gestão**, clicar em **Contas a pagar**. Título e frase "Parcelas a pagar aos fornecedores, pela condição combinada com cada um." Os cartões "Vencidas", "Próximos 7 dias", "Programadas", "Aguardando embarque/entrega" e "Solicitadas" (cada um com a contagem e o valor). As abas "Em aberto", "Vencidas", "Próximos 7 dias", "Programadas", "Aguardando embarque/entrega", "Solicitadas", "Pagas" e "Todas". A tabela: "Vencimento", "Fornecedor", "Pedido", "Parcela", "Valor", "Situação" e o botão "Pagar". Na base, "Total US$ …".
- 🎙 Narração: "Em Gestão, abra Contas a pagar. Cada linha é uma parcela, com as vencidas primeiro. Os cartões e as abas filtram por situação, e dá para filtrar por fornecedor. O botão Pagar leva ao pedido, onde o pagamento é feito."
- 🔤 Na tela: `[PASSO 2/7] Abra Gestão → Contas a pagar`; `[SETA]` "Vencidas primeiro"; `[BOTÃO] "Pagar"`; `[QUEM VÊ]` "Só o administrador (ou quem ele liberar)".
- ✂️ Edição: `[ZOOM 150 %]` na linha da parcela; clique nas abas com onda.

**Cena 5 · 1:40–2:10 · As situações da parcela · `/app/payables`**

- 🎬 Imagem: o cursor passa pelos selos: "Vencida" (vermelho), "Vence em breve" (âmbar), "Programada", "Aguardando o marco" (cinza), "Solicitado ao banco/financeiro" (azul), "Pago · falta o fornecedor confirmar" e "Recebido pelo fornecedor" (verdes). Na segunda parcela da Jarra, o vencimento aparece como "90 dias após a entrega ao cliente: aguardando".
- 🎙 Narração: "A parcela passa por situações: vencida, vence em breve, programada, ou aguardando o marco, quando ainda falta o embarque ou a entrega. Depois vem solicitada, paga, e recebida, quando o fornecedor confirma."
- 🔤 Na tela: `[SETA]` com cada selo; `[SETA]` "Vencimento = marco + dias; sem o marco, a parcela aguarda"; `[DICA]` "Marcos: pedido gerado, embarque, entrega ao cliente."
- ✂️ Edição: realce de cada selo por 1 s.

**Cena 6 · 2:10–3:00 · Pedir o pagamento · `/app/orders/[id]#supplier-payment`**

- 🎬 Imagem: clicar em **Pagar** na parcela 1/2. O pedido abre no card **Pagamento ao fornecedor**: "Condição: 30% na data do pedido + 70% 90 dias após a entrega ao cliente", a tabela de parcelas e o painel aberto **Pagar a parcela 1/2 · US$ 846,00**. Mostrar "Valor a pagar ao fornecedor" e "Dados para a transferência" (Beneficiary, Bank, Account / IBAN, SWIFT, Amount, Reference). Mostrar os três botões: **Copiar dados para o banco**, **Pedir ao financeiro por e-mail** e **Pedir ao financeiro por WhatsApp**. Clicar em **Copiar dados para o banco**: a parcela passa a "Solicitado ao banco/financeiro".
- 🎙 Narração: "No pedido, o card Pagamento ao fornecedor mostra a parcela da vez e os dados para a transferência. Copie os dados para o banco, ou peça ao financeiro por e-mail ou WhatsApp. Qualquer um dos três registra a parcela como solicitada."
- 🔤 Na tela: `[PASSO 3/7] Clique em "Pagar" e escolha como pedir`; `[BOTÃO] "Copiar dados para o banco"`; `[BOTÃO] "Pedir ao financeiro por e-mail"`; `[BOTÃO] "Pedir ao financeiro por WhatsApp"`; `[ATENÇÃO]` "Os três registram o pedido: escolha um só e não clique em dois."
- ✂️ Edição: `[ZOOM 150 %]` nos dados da transferência; o selo muda para "Solicitado ao banco/financeiro" (zoom 2 s).

**Cena 7 · 3:00–3:40 · Marcar como pago · `/app/orders/[id]#supplier-payment`**

- 🎬 Imagem: o novo bloco azul **Pedidos ao banco/financeiro** com "Quando o pagamento sair, use "Marcar como pago" (com câmbio e comprovante, se tiver). Não registre outro pagamento para o mesmo valor." A tabela: "Valor", "Observação" ("Parcela 1/2"), "Pedido ao banco em" e a coluna "Marcar como pago": o campo amarelo **Câmbio do banco (R$ por 1 USD)** com a referência "cotação automática de 10/11, 1 USD = R$ 5,5517", o "Comprovante (opcional)" e o botão **Marcar como pago**. Digitar o câmbio, clicar. Aparece o aviso verde "Pagamento marcado como pago; o fornecedor foi avisado para confirmar o recebimento." e a parcela fica "Pago · falta o fornecedor confirmar".
- 🎙 Narração: "Quando o dinheiro sair do banco, volte aqui e clique em Marcar como pago. Digite o câmbio que o banco cobrou, anexe o comprovante se tiver, e pronto. O fornecedor é avisado para confirmar o recebimento. Não registre outro pagamento do mesmo valor."
- 🔤 Na tela: `[PASSO 4/7] Marque como pago`; `[BOTÃO] "Marcar como pago"`; `[SETA]` "Câmbio do banco: opcional, mas tira o ~ do custo"; `[DEPOIS]` "O fornecedor recebe o aviso e confirma na conta corrente."
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` no aviso verde.

**Cena 8 · 3:40–4:00 · Já pagou por fora? · `/app/orders/[id]#supplier-payment`**

- 🎬 Imagem: abrir "Pagar a parcela 2/2" e a linha recolhida **Já pagou? Registrar com valor, câmbio e comprovante**: "Valor", "Moeda", "Câmbio do banco (R$ por 1 unidade)", "Comprovante (opcional)" e o botão **Registrar pagamento ao fornecedor**.
- 🎙 Narração: "Pagou por fora do portal? Abra Já pagou e registre com valor, câmbio e comprovante. Serve também para pedido sem valor FOB."
- 🔤 Na tela: `[PASSO 5/7] Registre o que já foi pago`; `[BOTÃO] "Registrar pagamento ao fornecedor"`; `[ERRO COMUM]` "Esta parcela já foi registrada (por outra pessoa ou por um clique duplo). Confira o cronograma."
- ✂️ Edição: manter 2 s o formulário aberto, sem preencher.

**Cena 9 · 4:00–4:40 · A conta do fornecedor, dos dois lados · `/app/suppliers/[id]` e `/app/account`**

- 🎬 Imagem: do lado da Wellmix, **Cadastros → Fornecedores**: os cartões "Valor do contrato", "Mercadoria entregue", "Pagamento antecipado", "A pagar" e "Pago", e na ficha as abas "Registros de compras", "Pagamentos" e "Informações do fornecedor", com o botão "Registrar pagamento". Corte para o perfil do fornecedor (Li Wei): a tela **Conta corrente** com "Previsão de pagamentos" e, na lista, o botão **Confirmar recebimento** ao lado do pagamento enviado.
- 🎙 Narração: "A conta de cada fornecedor está em Cadastros, em Fornecedores: contratado, entregue, a pagar e pago. Do outro lado, o fornecedor vê a previsão de pagamentos dele na Conta corrente e confirma o recebimento quando o dinheiro chega."
- 🔤 Na tela: `[PASSO 6/7] Veja a conta do fornecedor`; `[QUEM VÊ]` "O fornecedor vê a previsão dele, sem os dados do banco da Wellmix nem as ações"; `[BOTÃO] "Confirmar recebimento"`; `[SETA]` "Condição combinada: a observação que você escreveu aparece aqui".
- ✂️ Edição: `[CORTE]` entre os perfis; tela dividida por 4 s.

**Cena 10 · 4:40–4:50 · O operador vê de menos · `/app/payables` (Otávio)**

- 🎬 Imagem: o operador tenta abrir Contas a pagar: volta ao início com o aviso "Você não tem acesso a Contas a pagar. Peça ao administrador em Gestão → Equipe e divisões."
- 🎙 Narração: "O operador não abre Contas a pagar nem o card de pagamento no pedido. Pagar o fornecedor é do administrador."
- 🔤 Na tela: `[QUEM VÊ]` "Contas a pagar e pagamento ao fornecedor: só o administrador"; `[SETA]` "Aviso de acesso".
- ✂️ Edição: `[CORTE]` seco para o aviso.

**Cena 11 · 4:50–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-05.
- 🎙 Narração: "Resumindo: configure a condição, pague pela parcela e marque como pago. A seguir, o Painel do dono e o fluxo de caixa."
- 🔤 Na tela: `[RESUMO]` "1 Condição no cadastro do fornecedor · 2 Contas a pagar: uma linha por parcela · 3 Pedir (copiar, e-mail ou WhatsApp) · 4 Marcar como pago · 5 O fornecedor confirma"; `[PASSO 7/7] Conclua`; "Próximo: WGE-05".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Esta parcela já foi registrada (por outra pessoa ou por um clique duplo). Confira o cronograma." → **Correção:** abrir o cronograma do card e usar a parcela seguinte; não clicar duas vezes.
- **Erro:** "Este pagamento já não está pendente (outra pessoa marcou ou o fornecedor confirmou)." → **Correção:** recarregar o pedido; o pagamento já foi marcado.
- **Erro:** "Câmbio inválido: informe R$ por 1 unidade da moeda (maior que zero)." → **Correção:** informar quantos reais vale 1 unidade da moeda do pagamento.
- **Erro:** "Pagamento em reais não tem câmbio." → **Correção:** deixar o câmbio em branco em pagamento em reais.
- **Erro (cadastro):** "Total {n}%: as parcelas precisam somar 100%" e "Confira esta parcela: % maior que 0 e até 100, e de 0 a 720 dias." → **Correção:** ajustar os percentuais e os dias antes de **Salvar condição**.
- **Aviso:** "Condição de pagamento não configurada para este fornecedor." (com o link "Configurar no cadastro do fornecedor") e, em Contas a pagar, a lista "Fornecedores sem condição de pagamento" → **Correção:** configurar a condição; sem ela os pedidos ficam sem parcelas nem vencimento.
- **Erro:** "Este pedido já tem pagamento ao fornecedor lançado pela condição dele; a condição não muda mais." (ao usar "Usar a condição atual do cadastro") → **Correção:** só vale antes do primeiro pagamento.
- **Aviso:** "Falta no cadastro do fornecedor: Beneficiário, Banco, Conta / IBAN, SWIFT." (com o link "Preencher dados bancários") → **Correção:** preencher os dados bancários na ficha do fornecedor.

### Passo a passo em texto

1. Em **Cadastros → Fornecedores**, abra o fornecedor e clique em **Editar cadastro**. Em **Condição de pagamento ao fornecedor**, defina as parcelas (**% do FOB**, **Conta a partir de**: Pedido gerado, Embarque ou Entrega ao cliente, e **Dias depois**) somando 100%, use **Observação para o fornecedor** (ele vê) e clique em **Salvar condição**.
2. Em **Gestão → Contas a pagar**, veja uma linha por parcela, com as vencidas primeiro. Filtre pelos cartões, pelas abas (**Em aberto**, **Vencidas**, **Próximos 7 dias**, **Programadas**, **Aguardando embarque/entrega**, **Solicitadas**, **Pagas**, **Todas**) e por fornecedor.
3. Clique em **Pagar** na parcela. No card **Pagamento ao fornecedor** do pedido, abra **Pagar a parcela n/m**.
4. Escolha **Copiar dados para o banco**, **Pedir ao financeiro por e-mail** ou **Pedir ao financeiro por WhatsApp**. A parcela passa a **Solicitado ao banco/financeiro**.
5. Quando o pagamento sair, em **Pedidos ao banco/financeiro** digite o **Câmbio do banco (R$ por 1 USD)**, anexe o **Comprovante (opcional)** e clique em **Marcar como pago**. O fornecedor é avisado.
6. Se pagou por fora, abra **Já pagou? Registrar com valor, câmbio e comprovante** e clique em **Registrar pagamento ao fornecedor**.
7. O fornecedor confirma na **Conta corrente** ("Confirmar recebimento"). A conta de cada fornecedor (contratado, entregue, a pagar, pago) fica em **Cadastros → Fornecedores**.

### Notas de gravação

- Preencha os dados bancários da Shenzhen Supplier A (ficha do cadastro, "Dados bancários (pagamento ao fornecedor)") antes de gravar; sem eles, o texto da transferência sai com "—" e o aviso âmbar aparece.
- As ações "Pedir ao financeiro por e-mail" e "Pedir ao financeiro por WhatsApp" abrem o aplicativo do computador (e-mail e WhatsApp do portal são mock, GUIA seção 7.5). Para não abrir janela estranha na gravação, mostre só o botão **Copiar dados para o banco**, e cite os outros dois.
- "Solicitado" e "Pago" são dois momentos: grave um ponto de salvamento entre eles para repetir a tomada.
- O destino do pedido ao financeiro (e-mail e WhatsApp) se configura em Configurações → "Pagamento ao fornecedor" (WGE-09).
- O vencimento da parcela 2 depende da entrega ao cliente; sem entrega, fica "aguardando". Não force datas na gravação.
- Mostre o fornecedor com a tela no idioma dele; nome de botão no idioma da tela (em zh: "确认收款").

### Pontos a confirmar

- ⚠ Em `/app/account`, a tela "Conta corrente" é do **fornecedor**. Para o administrador a rota volta ao início (conferido), apesar de a lista de telas do administrador trazer "Conta corrente". A conta do fornecedor pela Wellmix é Cadastros → Fornecedores. O roteiro segue assim.
- ⚠ O campo "Câmbio do banco" é numérico: na automação só o ponto funcionou ("5.4"); no Chrome em pt-BR deve aceitar a vírgula. Confirmar na gravação.
- ⚠ O que "Pedir ao financeiro por e-mail" e "por WhatsApp" abrem na tela (cliente de e-mail, WhatsApp Web) e se o destino já vem de Configurações. Não foi gravado na verificação.
- ⚠ O job diário (lembrete ao fornecedor de pagamento feito há mais de 3 dias sem confirmação, e resumo à Wellmix) não aparece na tela; só descrito em docs/WORKFLOW.md. Confirmar se entra na narração.
- ⚠ O "Pagar fornecedor: pedido #1" também aparece como pendência da Wellmix (Painel de SLA, "Pagar fornecedor: pedido #1"), com o valor escrito "USD 846.00". Ver ⚠ do WGE-02.

---

## WGE-05 · Painel do dono e fluxo de caixa

> **Promessa:** ao final do vídeo você lê o Painel do dono (vendas, margem, a receber e a pagar, estoque e operação) e o Fluxo de caixa previsto, semana a semana, e sabe quando o saldo fica negativo.

| Ficha                 |                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, administrador                                                                                                                                  |
| Conta de gravação     | `admin@wellmix.com`, tela em pt                                                                                                                         |
| Duração-alvo          | 3:30                                                                                                                                                    |
| Ponto da jornada      | Visão do dono sobre as 9 etapas: vendas e margem (etapas 4 a 9), dinheiro a receber e a pagar (paralelo)                                                 |
| Telas e rotas         | `/app/dashboards/owner` (Gestão → Painel do dono), `/app/dashboards/cashflow` (Gestão → Fluxo de caixa)                                                  |
| Dados antes de gravar | Pedido #1 da Jarra com sinal recebido e parcela 1/2 ao fornecedor vencendo; câmbio do dia disponível (Configurações → "Preço ao cliente"). Para a lista de "Vendas dos últimos 6 meses" ficar com mais de uma barra, pedidos em meses diferentes (⚠ ver notas). Ponto `antes-WGE-05` |
| Depois deste vídeo    | Nada é gravado. Cada número leva à tela onde se age (Financeiro, Clientes, Contas a pagar, Solicitações, Pedidos, Estoque)                                |
| Antes · Próximo       | WGE-04 · WGE-06                                                                                                                                          |
| Idiomas               | pt (base)                                                                                                                                               |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/dashboards/owner`**

- 🎬 Imagem: o Painel do dono inteiro: quatro cartões de dinheiro no alto, cinco de operação embaixo, gráfico de barras vermelhas e as listas de maiores clientes e fornecedores.
- 🎙 Narração: "Como está o negócio hoje? Vendas, margem, o que entra, o que sai e o estoque, numa tela só: o Painel do dono."
- 🔤 Na tela: `[TÍTULO]` "WGE-05 · Painel do dono e fluxo de caixa"; `[ZOOM 150 %]` nos quatro cartões do alto.
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/dashboards/owner`**

- 🎬 Imagem: tela parada; o mapa da jornada aparece com todas as etapas e o selo "paralelo" sobre o pagamento ao fornecedor.
- 🎙 Narração: "Este painel resume a jornada em dinheiro: o que foi vendido, o que ainda falta receber do cliente e o que falta pagar ao fornecedor."
- 🔤 Na tela: `[MAPA etapas 4 a 9]` com o selo "paralelo"; `[QUEM VÊ]` "Só o administrador (ou quem ele liberar)".
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:58 · Os quatro cartões do alto · menu Gestão → Painel do dono**

- 🎬 Imagem: o cursor abre **Gestão** e clica em **Painel do dono**. Título "Painel do dono" e a frase "Mês de nov. de 26". Os quatro cartões: "Vendas do mês" (com "sem vendas no mês anterior · 1 pedido(s)" ou "+N% vs mês anterior"), "Margem do mês" (valor e percentual), "Recebido no mês" (com "A receber (total): …") e "Pago a fornecedores no mês" (com "A pagar a fornecedores: …"). Passar o cursor em cada um; o cartão inteiro é um link.
- 🎙 Narração: "Em Gestão, abra Painel do dono. Vendas do mês são os pedidos criados no mês, comparadas com o mês anterior. Logo ao lado, a margem. Depois, o que entrou dos clientes e o que saiu para os fornecedores no mês, cada um com o total ainda por receber ou por pagar."
- 🔤 Na tela: `[PASSO 1/6] Abra Gestão → Painel do dono`; `[SETA]` "Vendas: pedidos criados no mês"; `[SETA]` "Recebido e pago: pagamentos confirmados no mês"; `[DICA]` "Cada cartão leva à tela onde se age: Financeiro, Clientes, Contas a pagar."
- ✂️ Edição: `[ZOOM 150 %]` em cada cartão por 2 s.

**Cena 4 · 0:58–1:28 · Estoque e operação · `/app/dashboards/owner`**

- 🎬 Imagem: a segunda linha de cartões: "Estoque (valor de custo)" (com "N produto(s) abaixo do limite" e "N parado(s) há 90+ dias"), "Perdas no último inventário" (ou "Nenhum inventário fechado ainda"), "Solicitações em aberto", "Aguardando sinal" e "Pedidos em andamento".
- 🎙 Narração: "Na linha de baixo, o estoque no Brasil, a custo, com os produtos abaixo do limite e os parados há noventa dias. Depois, as perdas do último inventário, as solicitações abertas, as que esperam sinal e os pedidos em andamento."
- 🔤 Na tela: `[SETA]` "Estoque: valor de custo"; `[SETA]` "Parado há 90+ dias"; `[SETA]` "Aguardando sinal: já com proposta aprovada"; `[ATENÇÃO]` "Compras para estoque não contam como venda."
- ✂️ Edição: `[ZOOM 150 %]` no cartão do estoque.

**Cena 5 · 1:28–1:58 · Gráfico e listas · `/app/dashboards/owner`**

- 🎬 Imagem: o cartão "Vendas dos últimos 6 meses": uma barra por mês (a do mês atual em vermelho mais forte), o valor e "margem R$ …" ao lado. Ao lado, "Pedidos em andamento por etapa" ("Pedido pré-aprovado: 1"). Embaixo, "Maiores clientes (12 meses)" e "Maiores fornecedores (12 meses, FOB)", cada um com o número de pedidos e o valor; os nomes são links.
- 🎙 Narração: "O gráfico mostra as vendas dos últimos seis meses, com a margem de cada um. Ao lado, os pedidos em andamento por etapa. Embaixo, os maiores clientes e os maiores fornecedores dos últimos doze meses. Os nomes levam à ficha."
- 🔤 Na tela: `[SETA]` "Barra vermelha forte: mês atual"; `[SETA]` "Margem do mês, abaixo do valor"; `[SETA]` "Nome = link para a ficha".
- ✂️ Edição: `[ZOOM 150 %]` na barra do mês atual.

**Cena 6 · 1:58–2:38 · O fluxo de caixa · `/app/dashboards/cashflow`**

- 🎬 Imagem: clicar no botão **Fluxo de caixa** (no alto do painel, ou no menu Gestão → Fluxo de caixa). Título "Fluxo de caixa previsto" e a frase de entradas e saídas. A tabela: "Semana", "Entradas", "Saídas", "Saldo da semana (R$)" e "Saldo acumulado (R$)". A primeira linha "09/11 a 15/11 (esta semana)" com o link "Ver 1 lançamento(s)"; abrir: "11/11 Parcela ao fornecedor … −US$ 846,00". As linhas seguintes semana a semana, e no fim "Sem data (aguarda embarque ou entrega)".
- 🎙 Narração: "O Fluxo de caixa previsto vai semana a semana. Entram o sinal que ainda espera pagamento e o saldo de cada pedido, na data prevista da entrega. Saem as parcelas dos fornecedores, pelo vencimento. Clique em Ver lançamentos para abrir cada um."
- 🔤 Na tela: `[PASSO 2/6] Abra Fluxo de caixa`; `[BOTÃO] "Fluxo de caixa"`; `[SETA]` "Entradas: sinal e saldo do pedido"; `[SETA]` "Saídas: parcelas ao fornecedor"; `[SETA]` "Ver N lançamento(s)".
- ✂️ Edição: `[ZOOM 150 %]` nos cabeçalhos; abrir "Ver 1 lançamento(s)" e manter 3 s.

**Cena 7 · 2:38–3:08 · Saldo negativo e linhas especiais · `/app/dashboards/cashflow`**

- 🎬 Imagem: o alerta vermelho "Atenção: o saldo acumulado fica negativo em 09/11 a 15/11." As linhas "Atrasado" (em vermelho, quando há), "Depois de …" e "Sem data (aguarda embarque ou entrega)", onde o saldo acumulado é "—". Se faltar câmbio, o aviso âmbar "Sem câmbio do dia para …: essas saídas aparecem na moeda delas, mas ficam fora do saldo em reais."
- 🎙 Narração: "Se o saldo acumulado ficar negativo, o painel avisa em qual semana. A linha Atrasado junta o que já devia ter entrado ou saído. Sem data é o que espera embarque ou entrega. Sem câmbio do dia, a saída fica de fora do saldo em reais."
- 🔤 Na tela: `[SETA]` "Alerta: primeira semana negativa"; `[SETA]` "Sem data: aguarda embarque ou entrega"; `[ATENÇÃO]` "O saldo em reais usa o câmbio do dia; sem câmbio, nada é inventado."
- ✂️ Edição: `[ZOOM 150 %]` no alerta, 2 s.

**Cena 8 · 3:08–3:22 · O operador vê de menos · `/app/dashboards/owner` (Otávio)**

- 🎬 Imagem: perfil do operador (planner): em Gestão não há "Painel do dono" nem "Fluxo de caixa". Digitar o endereço do painel: volta para Painéis por área.
- 🎙 Narração: "O operador não vê o Painel do dono nem o Fluxo de caixa. Se forçar o endereço, volta aos Painéis por área."
- 🔤 Na tela: `[QUEM VÊ]` "Painel do dono e Fluxo de caixa: só quem abre o Financeiro"; `[SETA]` "Volta para Painéis por área".
- ✂️ Edição: `[CORTE]` seco.

**Cena 9 · 3:22–3:30 · Resumo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-06.
- 🎙 Narração: "Resumindo: vendas, margem, a receber e a pagar, e o caixa por semana. Agora, o pós-venda e o histórico."
- 🔤 Na tela: `[RESUMO]` "1 Painel do dono: negócio numa tela · 2 Cada número leva à ação · 3 Fluxo de caixa semana a semana · 4 Alerta de saldo negativo"; `[PASSO 6/6] Conclua`; "Próximo: WGE-06 · Pós-venda e histórico comercial".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Estado (não é erro):** "Margem do mês" mostra "—" e "sem câmbio para calcular" quando falta o câmbio. → **Correção:** informar o câmbio do banco nos pagamentos (WGE-03) ou conferir o câmbio do dia em Configurações (WGE-09).
- **Aviso:** "Sem câmbio do dia para {moedas}: essas saídas aparecem na moeda delas, mas ficam fora do saldo em reais." → **Correção:** buscar as cotações em Configurações → "Preço ao cliente" → **Buscar cotações**.
- **Estado:** "Nada a receber nem a pagar por enquanto." (Fluxo de caixa vazio), "Nenhum pedido em andamento." e "Sem pedidos nos últimos 12 meses." → **Correção:** não é erro; ainda não há lançamentos.
- **Aviso de acesso:** quem não tem a tela Financeiro volta aos Painéis por área; quem tem o Financeiro mas não "Painéis por área" recebe "Você não tem acesso a Painéis por área. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** liberar as duas telas (WGE-10).

### Passo a passo em texto

1. No menu **Gestão**, abra **Painel do dono**.
2. No alto, leia **Vendas do mês** (pedidos criados no mês, comparados com o mês anterior), **Margem do mês**, **Recebido no mês** (com **A receber (total)**) e **Pago a fornecedores no mês** (com **A pagar a fornecedores**). Clique num cartão para ir à tela onde se age.
3. Na linha de baixo: **Estoque (valor de custo)**, **Perdas no último inventário**, **Solicitações em aberto**, **Aguardando sinal** e **Pedidos em andamento**.
4. Veja **Vendas dos últimos 6 meses**, **Pedidos em andamento por etapa**, **Maiores clientes (12 meses)** e **Maiores fornecedores (12 meses, FOB)**.
5. Clique em **Fluxo de caixa** (ou em Gestão → **Fluxo de caixa**). A tabela traz as próximas semanas com **Entradas**, **Saídas**, **Saldo da semana (R$)** e **Saldo acumulado (R$)**; abra **Ver N lançamento(s)** para detalhar. As linhas **Atrasado**, **Depois de…** e **Sem data (aguarda embarque ou entrega)** completam o quadro.
6. Se aparecer "Atenção: o saldo acumulado fica negativo em…", é a primeira semana em que as saídas passam das entradas.

### Notas de gravação

- Não cite valores: eles mudam com o dia e com o câmbio. Mostre só as telas.
- O gráfico só fica interessante com vendas em vários meses; o ambiente de demonstração tem só o mês corrente (todas as barras de meses anteriores ficam em R$ 0,00). Mostre assim, ou grave com pedidos antigos.
- As 12 semanas do fluxo começam na segunda-feira da semana atual (o código usa 12 semanas, docs/INVENTORY.md). Não diga "doze semanas" na narração: o roteiro diz "semana a semana".
- O botão "Fluxo de caixa" fica no alto do Painel do dono e também no menu Gestão; use um dos dois e mantenha igual nas gravações.
- Para o alerta de saldo negativo, o ponto de salvamento precisa de uma parcela ao fornecedor vencendo e nenhuma entrada na mesma semana.

### Pontos a confirmar

- ⚠ A frase "Mês de nov. de 26" (cabeçalho do Painel do dono) e os rótulos "jun. de 26", "jul. de 26"… do gráfico usam mês abreviado e ano com 2 dígitos; texto estranho. Confirmar se o formato é o desejado.
- ⚠ O menu mostra "Painel do dono" e "Fluxo de caixa" para quem tem a tela **Financeiro**, mas as duas páginas exigem também **Painéis por área** (`requireScreen(user, "dashboards")`). Com acesso personalizado (WGE-10) só com o Financeiro, o clique leva ao início com aviso de acesso negado. Inconsistência possível; lida no código, não gravada.
- ⚠ "Vendas do mês" usa a data de criação do pedido (`order.createdAt`), não a da entrega nem a do sinal. Confirmar se é a intenção do dono (docs/INVENTORY.md diz só "vendas do mês").
- ⚠ O cartão "Recebido no mês" leva a Cadastros → Clientes (`/app/customers`) e "Pago a fornecedores no mês" a Contas a pagar; "Vendas do mês" e "Margem do mês" levam ao Financeiro. Conferir se é o destino esperado.

---

## WGE-06 · Pós-venda e histórico comercial

> **Promessa:** ao final do vídeo você acompanha as avaliações dos clientes, encerra um pós-venda, lê o Histórico comercial (compras, frequência e interesse em recompra) e abre uma nova compra a partir dele.

| Ficha                 |                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, administrador (e o operador, com as mesmas telas); o cliente só aparece para responder                                                              |
| Conta de gravação     | `admin@wellmix.com`, tela em pt; `joao@lojista.com` na cena em que ele avalia                                                                                |
| Duração-alvo          | 4:00                                                                                                                                                         |
| Ponto da jornada      | Etapa 9 de 9: Entrega e pós-venda; o histórico fecha o ciclo e leva à nova compra                                                                             |
| Telas e rotas         | `/app/after-sales` (Gestão → Pós-venda), `/app/orders/[id]#after-sales` (card "Pós-venda"), `/app/history` (Gestão → Histórico), `/app/orders/[id]#followup` ("Comprar de novo / Nova proposta") |
| Dados antes de gravar | Pedido #1 da Jarra **entregue** (etapa Entrega concluída; o pós-venda abre sozinho e o cliente recebe a pendência "Avalie a compra"). Ponto `antes-WGE-06`. Para repetir "Respondidos", grave outro ponto depois da avaliação do cliente |
| Depois deste vídeo    | O pós-venda vira "Encerrado" com a observação da Wellmix; "Comprar de novo" cria uma solicitação pré-preenchida ligada ao pedido (origem reposição) e a Wellmix recebe a pendência de enviá-la ao fornecedor |
| Antes · Próximo       | WGE-05 · WGE-07                                                                                                                                               |
| Idiomas               | pt (base)                                                                                                                                                    |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/after-sales`**

- 🎬 Imagem: a tela Pós-venda com um registro "Respondido": estrelas, o selo "Sim" em Recompra e o texto dos problemas.
- 🎙 Narração: "O cliente gostou da compra? Vai comprar de novo? O pós-venda responde, com as palavras do próprio cliente."
- 🔤 Na tela: `[TÍTULO]` "WGE-06 · Pós-venda e histórico comercial"; `[ZOOM 150 %]` nas cinco estrelas.
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:26 · Onde estou na jornada · `/app/orders/[id]`**

- 🎬 Imagem: o mapa da jornada com a etapa 9 acesa. Em seguida, a notificação do cliente: "Pedido #1: como foi a sua compra?" com "Avalie a experiência, conte problemas e diga se quer repor. Leva um minuto."
- 🎙 Narração: "O processo não termina na entrega. Ao concluir a entrega, o pedido abre um pós-venda e o cliente é convidado a avaliar a compra. Ele recebe um aviso e uma pendência."
- 🔤 Na tela: `[MAPA etapa 9]` "Entrega e pós-venda"; `[DEPOIS]` "O cliente recebe o aviso e a pendência 'Avalie a compra'."
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:26–0:52 · O que o cliente responde · `/app/orders/[id]#after-sales` (João)**

- 🎬 Imagem: no perfil do cliente, o card **Pós-venda** do pedido, com o selo "Aguardando cliente": "Nota da compra (1 a 5)" com os botões 1 a 5 e "1 = muito ruim · 5 = excelente"; "Interesse em nova compra" com "Sim", "Talvez" e "Não"; os campos "Como foi a experiência?", "Houve problemas? (produto, prazo, embalagem, transporte)", "Custos percebidos (impostos, frete, extras)" e "Sugestões". Escolher 5 e "Sim", escrever os textos e clicar em **Enviar avaliação**. Aparece "Obrigado pela avaliação. A Wellmix vai analisar as respostas."
- 🎙 Narração: "O cliente dá uma nota de um a cinco, diz se tem interesse em comprar de novo e conta como foi: experiência, problemas, custos e sugestões. Ao enviar, a Wellmix é avisada, e se houve problema o aviso vem como alerta."
- 🔤 Na tela: `[QUEM VÊ]` "Quem responde: o cliente dono do pedido (a Wellmix também pode responder por ele)"; `[BOTÃO] "Enviar avaliação"`; `[DEPOIS]` "A Wellmix recebe o aviso 'Pedido #1: avaliação de pós-venda recebida'."
- ✂️ Edição: digitação acelerada 2×; `[CORTE]` para o admin.

**Cena 4 · 0:52–1:32 · A tela Pós-venda · menu Gestão → Pós-venda**

- 🎬 Imagem: no menu **Gestão**, clicar em **Pós-venda**. Título e a frase "Avaliações dos clientes após a entrega: nota, problemas e interesse em recompra." As abas "Aguardando cliente", "Respondidos" e "Encerrados", cada uma com a contagem. Clicar em **Respondidos**: o registro com o selo "Respondido", o link "Pedido #1", o cliente, "Aberto em … · Respondido em …", "Nota" (estrelas e 5/5), "Recompra" (selo "Sim") e "Problemas" (o texto, ou "Sem problemas relatados"). À direita, o link "Abrir pedido →".
- 🎙 Narração: "Em Gestão, abra Pós-venda. As abas separam quem ainda não respondeu, quem respondeu e o que já foi encerrado. Cada registro mostra a nota, o interesse em recompra e os problemas relatados. Clique em Abrir pedido para tratar."
- 🔤 Na tela: `[PASSO 1/6] Abra Gestão → Pós-venda`; `[BOTÃO] "Respondidos"`; `[SETA]` "Nota em estrelas"; `[SETA]` "Recompra: Sim, Talvez ou Não"; `[QUEM VÊ]` "Comprador, gerente de produto, diretorias e administrador".
- ✂️ Edição: `[ZOOM 150 %]` no registro respondido.

**Cena 5 · 1:32–2:20 · Encerrar o pós-venda · `/app/orders/[id]#after-sales`**

- 🎬 Imagem: clicar em "Abrir pedido →". No card **Pós-venda**, com o selo "Respondido", a tabela com as respostas ("Nota da compra (1 a 5)", "Interesse em nova compra", "Como foi a experiência?", "Houve problemas?", "Custos percebidos", "Sugestões", "Respondido em"). Embaixo, **Observação da Wellmix** com a dica "Registre o que foi feito com o retorno do cliente (ação, contato, ajuste)." Escrever "Ligamos para o cliente e enviamos 2 tampas de reposição." e clicar em **Encerrar pós-venda**. O selo vira "Encerrado". Voltar à lista: aba "Encerrados".
- 🎙 Narração: "No pedido, leia as respostas e registre na Observação da Wellmix o que foi feito: contato, ajuste, reposição. Clique em Encerrar pós-venda. O registro passa para Encerrados, com a sua observação."
- 🔤 Na tela: `[PASSO 2/6] Escreva o que foi feito`; `[BOTÃO] "Encerrar pós-venda"`; `[DICA]` "Dá para encerrar também sem a resposta do cliente."; `[DEPOIS]` "O registro vai para 'Encerrados' e a observação fica no histórico."
- ✂️ Edição: digitação em tempo real; `[CORTE]` para a lista.

**Cena 6 · 2:20–3:00 · O Histórico comercial · menu Gestão → Histórico**

- 🎬 Imagem: no menu **Gestão**, clicar em **Histórico**. Título "Histórico comercial" e a frase "Cliente → produto → compras → quantidade → preço → data → frequência → reposição." O filtro "Cliente" ("Todos os clientes") e o botão **Filtrar**. A tabela: "Cliente", "Produto", "Compras", "Qtd. total", "Última qtd.", "Último preço unit. (venda)", "Último FOB unit.", "Primeira / última compra", "Frequência média", "Reposições", "Recompra" e "Último pedido". Linha: Loja do João Ltda, Jarra de vidro 1,5 L, 1, 1200 un, R$ 23,33, US$ 2,35, "—" na frequência, selo "Sim" em Recompra.
- 🎙 Narração: "Em Gestão, abra Histórico. Para cada cliente e produto, você vê quantas vezes comprou, quanto, a que preço e quando. A frequência é a média de dias entre as compras. A recompra vem da última avaliação respondida."
- 🔤 Na tela: `[PASSO 3/6] Abra Gestão → Histórico`; `[BOTÃO] "Filtrar"`; `[SETA]` "Frequência média: só com 2 ou mais compras"; `[SETA]` "Recompra: do último pós-venda"; `[QUEM VÊ]` "Wellmix: todos os clientes e o FOB. Cliente: só o próprio histórico, sem custo."
- ✂️ Edição: `[ZOOM 150 %]` nas colunas "Frequência média" e "Recompra".

**Cena 7 · 3:00–3:36 · Comprar de novo ou Nova proposta · `/app/orders/[id]#followup`**

- 🎬 Imagem: na linha do histórico, os botões **Comprar de novo** (vermelho) e **Nova proposta**. Clicar: abre o pedido no card **Comprar de novo / Nova proposta** com "Produto", "Última quantidade", "Último preço unitário de venda" e "Data da compra"; os campos "Nova quantidade", "Prazo de resposta (SLA)" e "Observação para a Wellmix"; os botões **Comprar de novo** e **Quero nova proposta**. A dica: "Comprar de novo: mesma especificação, nova quantidade. Nova proposta: a Wellmix renegocia preço, prazo ou condições." Clicar em **Comprar de novo**: nasce uma solicitação pré-preenchida.
- 🎙 Narração: "Na linha do histórico, clique em Comprar de novo ou em Nova proposta. As duas levam ao pedido, onde você ajusta a quantidade e o prazo. Comprar de novo repete a especificação; nova proposta renegocia preço, prazo ou condições. Nasce uma solicitação já preenchida."
- 🔤 Na tela: `[PASSO 4/6] Clique em "Comprar de novo" ou "Nova proposta"`; `[BOTÃO] "Comprar de novo"`; `[BOTÃO] "Quero nova proposta"`; `[ATENÇÃO]` "Os dois botões da linha levam ao mesmo card do pedido."; `[DEPOIS]` "A solicitação segue o fluxo normal (a Wellmix a envia ao fornecedor)."
- ✂️ Edição: `[CORTE]` seco para a solicitação criada.

**Cena 8 · 3:36–3:50 · O operador e o cliente · `/app/history`**

- 🎬 Imagem: perfil do operador: mesmo menu Gestão com "Pós-venda" e "Histórico" (sem os demais). Depois o cliente: Meus pedidos → **Histórico**, só com o histórico dele e sem a coluna de FOB.
- 🎙 Narração: "O operador comprador e planner abre Pós-venda e Histórico. O cliente vê só o histórico dele, sem custo e sem fornecedor."
- 🔤 Na tela: `[QUEM VÊ]` "Operador: Pós-venda e Histórico. Cliente: só o próprio histórico, sem FOB"; `[SETA]` "Sem a coluna 'Último FOB unit.'".
- ✂️ Edição: `[CORTE]` entre os perfis.

**Cena 9 · 3:50–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WGE-07.
- 🎙 Narração: "Resumindo: leia a avaliação, encerre com uma observação e use o histórico para vender de novo. A seguir, o Marketing."
- 🔤 Na tela: `[RESUMO]` "1 Pós-venda abre na entrega · 2 Leia nota, problemas e recompra · 3 Encerre com observação · 4 Histórico: frequência e reposição · 5 Comprar de novo"; `[PASSO 5/6] Conclua`; "Próximo: WGE-07 · Marketing".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** enviar a avaliação de novo depois de respondida. A tela mostra "Não foi possível concluir. Verifique os dados. (already_answered)". → **Correção:** a avaliação já foi enviada; use **Encerrar pós-venda** na Wellmix.
- **Erro:** tentar abrir o pós-venda de um pedido que ainda não foi entregue (botão **Abrir pós-venda**, só para pedido encerrado antes do recurso). A tela mostra "Não foi possível concluir. Verifique os dados. (order_not_delivered)". → **Correção:** esperar a entrega.
- **Erro:** "Não foi possível concluir. Verifique os dados. (already_closed)" ao encerrar duas vezes, e "(after_sales_disabled)" quando "Pós-venda ativo" está desligado em Configurações. → **Correção:** conferir o registro; ligar "Pós-venda ativo" (WGE-09).
- **Estado (não é erro):** "Nenhum pós-venda nesta situação." (aba vazia) e "Nenhuma compra registrada ainda." (Histórico vazio).
- **Aviso:** "O cliente ainda não respondeu. Ele foi avisado por notificação." → **Correção:** aguardar, ou encerrar com uma observação.

### Passo a passo em texto

1. Ao concluir a entrega, o pedido abre o pós-venda; o cliente recebe o aviso e a pendência para avaliar a compra.
2. No menu **Gestão**, abra **Pós-venda**. Use as abas **Aguardando cliente**, **Respondidos** e **Encerrados**.
3. Em **Respondidos**, leia **Nota**, **Recompra** e **Problemas**. Clique em **Abrir pedido →**.
4. No card **Pós-venda** do pedido, escreva a **Observação da Wellmix** (o que foi feito com o retorno do cliente) e clique em **Encerrar pós-venda**.
5. No menu **Gestão**, abra **Histórico**. Filtre por **Cliente** e **Filtrar**. Leia **Compras**, **Última qtd.**, **Último preço unit. (venda)**, **Frequência média**, **Reposições** e **Recompra**.
6. Para vender de novo, clique em **Comprar de novo** (mesma especificação, nova quantidade) ou **Nova proposta** (renegociar) e confirme no card **Comprar de novo / Nova proposta** do pedido.

### Notas de gravação

- O pós-venda só abre com a etapa de Entrega concluída. Para gravar a partir do pedido #1, conclua as etapas da Jarra (outros episódios) até a entrega; no ambiente de verificação este caminho não foi percorrido: o pedido foi marcado como encerrado e o pós-venda foi aberto à mão com "Abrir pós-venda" (que só existe para pedido já entregue ou encerrado).
- "Frequência média" só aparece com **duas ou mais** compras do mesmo produto pelo mesmo cliente; com uma compra só, o campo fica "—" (é o esperado; mostre assim).
- As estrelas e os selos "Sim", "Talvez" e "Não" vêm do que o cliente respondeu; combine o texto do cliente antes (a cena 3 usa um problema pequeno: "Duas jarras com a tampa de bambu arranhada.").
- "Comprar de novo" cria uma solicitação nova; guarde um ponto de salvamento antes, para repetir a tomada.

### Pontos a confirmar

- ⚠ Mensagens de erro do pós-venda saem com o código técnico entre parênteses ("(already_answered)", "(already_closed)", "(order_not_delivered)", "(already_open)", "(after_sales_disabled)"): não há texto traduzido para eles (`fallbackError`). Confirmar se o dono quer textos próprios.
- ⚠ Em **Histórico**, os botões "Comprar de novo" e "Nova proposta" da linha levam ao mesmo endereço (`/app/orders/[id]#followup`); a escolha acontece no card do pedido. O roteiro diz isso; confirmar se é o desejado.
- ⚠ O mesmo card permite à Wellmix responder pelo cliente (o serviço aceita, docs/WORKFLOW.md fala só em "Wellmix encerra"); na tela do administrador, com o pós-venda aguardando, só apareceu "Encerrar pós-venda", sem formulário de resposta. Confirmar se existe o formulário de resposta para a Wellmix.
- ⚠ Os itens 34 (análise de oportunidade) e 36 (nova proposta com preços negociados) de docs/EVOLUTION_PLAN.md não aparecem nestas telas; este episódio não os cobre. Confirmar se haverá vídeo próprio.
- ⚠ A pendência "Avalie a compra" do cliente (docs/WORKFLOW.md) e o aviso "Pedido #n: como foi a sua compra?" foram lidos no código e nos dicionários; confirmar o texto exato da pendência na tela do cliente.
