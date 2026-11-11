# Série FOR · Fornecedor

Vídeos para quem fabrica e vende para a Wellmix na China. O fornecedor entra no portal e vê **Pendências** (início), **Notificações**, **Mensagens**, **Cotações**, **Solicitações ao fornecedor**, **Pedidos** e **Conta corrente**. Ele **não vê** o cliente final, outros fornecedores, o preço de venda nem a margem (docs/SCOPE.md, docs/ACCESS.md). Cliente, outro fornecedor e demais parceiros recebem "não encontrado" ao abrir uma tela dele (confirmado: `supplier.b@china.com` recebe 404 na solicitação e no pedido do Shenzhen Supplier A).

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela) e o [02-cliente.md](02-cliente.md) (episódio-modelo). Os episódios seguem a seção 5 do guia, com duas diferenças próprias desta série: (a) cada episódio traz a tabela **"Legendas na tela em EN e ZH"** (rótulos copiados das chaves `en` e `zh` do dicionário) e (b) a **narração completa em EN e em ZH**, cena a cena, para as gravações em outros idiomas.

## Contas e idiomas de gravação

| Conta (senha `wellmix123`) | Papel                | Idioma da tela e da narração |
| -------------------------- | -------------------- | ---------------------------- |
| `supplier.a@china.com`     | Li Wei, Shenzhen Supplier A | **zh** (gravação principal) |
| `supplier.b@china.com`     | Chen Yu, Guangzhou Supplier B | **en** (mesma sequência, outra conta) |

- O roteiro-base (cenas, 🎬 e 🎙 em pt) serve de guia para o editor e para quem revisa. Para gravar em **zh** ou **en**, use a coluna do idioma na tabela de legendas e a tabela de narração completa do episódio.
- O fornecedor B só tem dados se a sequência for repetida na conta dele (nenhum dado de A aparece para ele). Para gravar em en, repita os passos de preparação com o Guangzhou Supplier B (planilha de booking de B, solicitação a B).
- Nomes de botões, menus e campos vêm **sempre** do dicionário do sistema, no idioma da gravação (guia, seção 2). Nada foi traduzido à mão: onde o texto aparece com `{n}`, `{product}` etc., o valor entra no lugar.
- Esconda a faixa de demonstração e o seletor **DEMO** (guia, seção 7.3). Entre por `/login?intro=off`.

## A história

Todos os episódios acompanham a **Jarra de vidro 1,5 L (UTL-001)**. Na gravação de demonstração, o item aparece como "Glass jar 1.5L with bamboo lid" (código UTL-001), porque a planilha do fornecedor é em inglês. Mantenha esse nome na tela e diga "a jarra" na narração.

## O que foi lido para escrever esta série

`docs/SCOPE.md`, `WORKFLOW.md`, `ACCESS.md`, `SUPPLIER_REQUESTS.md`, `QUOTE_FLOW.md`, `RFQ_STANDBY.md`, `ARQUITETURA.md` (etapa Die Cut e Pendências do fornecedor), `SUPERPLAN.md` (seção 11), `PURCHASE_FLOW.md`, `ORDER_SIGNATURE.md`, `PRODUCTION.md`, `IMPORT_FLOW.md`, `ARTWORK.md`; o código de `src/lib/services/tasks.ts`, `src/components/task-list.tsx`, `src/app/app/{tasks,quotes,supplier-requests,orders,account,notifications}`, `src/components/{die-cut-step-card,quote-flow-cards,import-flow-card,production-card,requirement-form}.tsx`, `src/lib/workflow/stages.ts` e os dicionários (pt, en, zh); e os E2E `happy-path.spec.ts` e `booking-supplier-request.spec.ts`. As telas principais foram abertas num build de produção em modo memória (capturas em zh).

## Estado do negócio que o roteiro respeita

- **RFQ com vários fornecedores está em espera** (docs/RFQ_STANDBY.md): o fornecedor recebe o produto como **análise do Booking**, sem disputa, e a tela diz que "não há outros fornecedores neste produto". Os vídeos não ensinam disputa.
- **Solicitação ao fornecedor** (docs/SUPPLIER_REQUESTS.md) é o primeiro contato: "você faz isto?". A **cotação** (Análise do Booking) vem depois, quando a Wellmix gera a solicitação do produto.
- E-mail e WhatsApp são mock: só o **sino** e a tela **Notificações** avisam de verdade. Não prometa mensagem por e-mail nem por WhatsApp.
- A assinatura do documento do pedido é um **aceite no portal** (ou o PDF assinado enviado de volta), não um certificado digital (docs/ORDER_SIGNATURE.md).

| ID     | Episódio                                             | Duração-alvo | Situação     |
| ------ | ---------------------------------------------------- | ------------ | ------------ |
| FOR-01 | Seu painel: as pendências por etapa                  | 4:00         | roteirizado  |
| FOR-02 | Responder à solicitação do Booking                   | 3:30         | roteirizado  |
| FOR-03 | Responder à cotação (Análise do Booking)             | 4:30         | roteirizado  |
| FOR-04 | Die Cut (faca da caixa), pedido mínimo e foto em alta | 3:30         | roteirizado  |
| FOR-05 | Ficha de compra                                      | 4:30         | roteirizado  |
| FOR-06 | Aprovar ou reprovar a arte                           | 3:00         | roteirizado  |
| FOR-07 | Assinar o documento do pedido                        | 4:00         | roteirizado  |
| FOR-08 | Produção e inspeção                                  | 4:30         | roteirizado  |
| FOR-09 | Embarque e documentos                                | 3:30         | roteirizado  |
| FOR-10 | Conta corrente e pagamentos                          | 3:30         | roteirizado  |

Ordem de gravação recomendada: FOR-02 (antes da cotação), FOR-03, FOR-04, FOR-05, FOR-06, FOR-07, FOR-08, FOR-09, FOR-10 e, por último, FOR-01 (o painel só fica bonito com várias pendências). Guarde um ponto de salvamento antes de cada episódio (guia, seção 7.2).

---

## FOR-01 · Seu painel: as pendências por etapa

> **Promessa:** ao final do vídeo você sabe ler a tela inicial, entender as sete etapas, abrir uma pendência e acompanhar os avisos.

| Ficha                 |                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                              |
| Conta de gravação     | `supplier.a@china.com` (Li Wei), tela em **zh**; versão en com `supplier.b@china.com` (Chen Yu)                          |
| Duração-alvo          | 4:00                                                                                                                    |
| Ponto da jornada      | Visão geral: etapas 1, 3, 5, 6 e 7 do mapa (guia, seção 6.1)                                                              |
| Telas e rotas         | `/app` (Pendências), `/app/notifications`, `/app/tasks?type=supplier.booking`                                            |
| Dados antes de gravar | A conta com 3 a 5 pendências em etapas diferentes (uma atrasada, se possível). Ponto de salvamento `antes-FOR-01` com os pedidos já na Preparação ou na Arte |
| Depois deste vídeo    | O fornecedor sabe onde começa cada tarefa (FOR-02 em diante)                                                              |
| Antes · Próximo       | — · FOR-02                                                                                                              |
| Idiomas               | pt (base), en, zh                                                                                                       |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a tela **Minhas pendências** de Li Wei com a etapa 1 em âmbar e uma linha na tabela. O cursor repousa no cartão âmbar.
- 🎙 Narração: "Tudo o que a Wellmix espera de você fica num só lugar. Em dez segundos você sabe o que fazer hoje."
- 🔤 Na tela: `[TÍTULO]` "FOR-01 · Seu painel: as pendências por etapa"; `[ZOOM 150 %]` na faixa das sete etapas.
- ✂️ Edição: vinheta de 6,5 s antes; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:28 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Sete etapas chegam até você, do Booking ao embarque. Depois do embarque, nada mais depende de você."
- 🔤 Na tela: `[MAPA etapas 1, 3, 5, 6, 7]` com as etapas do fornecedor acesas; `[SETA]` "Depois do embarque: só acompanhar em Pedidos".
- ✂️ Edição: o mapa sai em 8 s. A frase vem do próprio sistema ("Depois do embarque (desembaraço, transporte e entrega ao cliente) nada depende de você").

**Cena 3 · 0:28–1:05 · As sete etapas · `/app`**

- 🎬 Imagem: o cursor percorre a faixa da esquerda para a direita, em ordem: "Analisar o Booking", "Die Cut", "Ficha de compra", "Aprovar a arte", "Assinar o pedido", "Produção e inspeção", "Embarque". Em seguida aponta a legenda de cores e o chip "Todas as etapas · N".
- 🎙 Narração: "A faixa mostra as sete etapas, na ordem. Vermelho: atrasado. Amarelo: a fazer, no prazo. Verde: nada a fazer. O número ao lado diz quantas pendências a etapa tem."
- 🔤 Na tela: `[PASSO 1/5] Leia a faixa das etapas`; `[SETA]` em cada cor da legenda ("Atrasado", "A fazer, no prazo", "Concluído ou nada a fazer"); `[SETA]` "Número = pendências da etapa".
- ✂️ Edição: `[ZOOM 150 %]` na faixa; pausa de 1 s na legenda.

**Cena 4 · 1:05–1:35 · Filtrar por etapa · `/app/tasks?type=supplier.booking`**

- 🎬 Imagem: clicar na etapa **Analisar o Booking**. A lista filtra e aparece, abaixo da faixa, o texto de ajuda da etapa ("Confira preço, pedido mínimo, prazo e fotos do produto e envie a resposta."). Clicar de novo na etapa (ou em "Todas as etapas") limpa o filtro.
- 🎙 Narração: "Toque numa etapa para ver só as pendências dela. Abaixo aparece uma explicação curta do que fazer. Toque de novo para voltar à lista completa."
- 🔤 Na tela: `[PASSO 2/5] Toque numa etapa`; `[BOTÃO] "Analisar o Booking"` (em zh: "审核 Booking"); `[DICA]` "Passe o mouse sobre a etapa: a explicação também aparece como dica."
- ✂️ Edição: `[ZOOM 150 %]` no texto de ajuda.

**Cena 5 · 1:35–2:25 · A tabela e "Com você desde" · `/app`**

- 🎬 Imagem: a tabela com as colunas Pendência, Detalhe, Etapa, **Com você desde**, Prazo e o botão **Abrir**. O cursor para na coluna "Com você desde" (data, "hoje" ou "há N dias" e, abaixo, "produto no sistema desde …") e depois na coluna Prazo ("vence em N dias", "vence hoje" ou "atrasada há N dias").
- 🎙 Narração: "Cada linha é uma tarefa. Com você desde diz quando ela chegou à sua mão, e abaixo, desde quando o produto está no sistema. Em Prazo, veja se vence hoje, em quantos dias, ou se já está atrasada."
- 🔤 Na tela: `[PASSO 3/5] Confira "Com você desde" e o prazo`; `[SETA]` "Quando chegou até você" na coluna; `[SETA]` "Prazo" com o selo "Atrasado" quando houver; `[QUEM VÊ]` "Só você vê as suas pendências".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Com você desde"; segurar 2 s.

**Cena 6 · 2:25–2:50 · Filtros de prazo · `/app`**

- 🎬 Imagem: os chips **Prazo**: "Todas", "Atrasadas", "Vencem hoje", "Até 7 dias", "Mais adiante", "Sem prazo", cada um com a contagem; só aparecem os que têm pendência. Clicar em "Atrasadas".
- 🎙 Narração: "Em Prazo, filtre pelo vencimento. A lista já vem com as mais urgentes primeiro."
- 🔤 Na tela: `[BOTÃO] "Atrasadas"`; `[DICA]` "Limpar filtros leva de volta à lista inteira."
- ✂️ Edição: corte seco para a lista filtrada.

**Cena 7 · 2:50–3:10 · Abrir uma pendência · `/app` → `/app/quotes/[id]`**

- 🎬 Imagem: clicar em **Abrir** na linha "Analisar o Booking: Glass jar 1.5L with bamboo lid". A cotação abre. Voltar. Mostrar o ícone de balão ao lado do botão (abre a conversa com a Wellmix).
- 🎙 Narração: "Clique em Abrir para ir direto ao lugar de resolver. O balão ao lado abre a conversa com a Wellmix sobre aquele assunto."
- 🔤 Na tela: `[PASSO 4/5] Clique em Abrir`; `[BOTÃO] "Abrir"`; `[SETA]` "Conversa com a Wellmix".
- ✂️ Edição: `[CORTE]` na abertura da cotação.

**Cena 8 · 3:10–3:45 · Notificações e sino · `/app/notifications`**

- 🎬 Imagem: o sino do cabeçalho com o número de avisos. Abrir **Notificações**: blocos "Precisa de você", "Atenção" e "Novidades". Numa linha "Sua vez", clicar em **Resolver** (em zh: "去处理"): o aviso leva ao lugar certo e some da lista.
- 🎙 Narração: "O sino conta os avisos novos. Em Notificações, o bloco Precisa de você traz o que está na sua vez. Clique em Resolver: o sistema leva você ao lugar e marca o aviso como lido."
- 🔤 Na tela: `[PASSO 5/5] Abra o sino`; `[BOTÃO] "Resolver"`; `[SETA]` "Agora é com você / com a Wellmix"; `[ATENÇÃO]` "Aviso lido sai da lista; Mostrar as lidas traz de volta."
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Com quem".

**Cena 9 · 3:45–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, miniatura do FOR-02.
- 🎙 Narração: "Resumindo: leia a faixa, filtre por etapa, abra a pendência e acompanhe o sino. No próximo vídeo, responda à primeira solicitação da Wellmix."
- 🔤 Na tela: `[RESUMO]` "1 Leia a faixa das etapas · 2 Filtre por etapa · 3 Veja 'Com você desde' e o prazo · 4 Abra a pendência · 5 Acompanhe o sino"; chamada "Próximo: FOR-02 · Responder à solicitação do Booking".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Aviso:** nenhuma tarefa. A tela mostra "Nenhuma pendência agora. Quando algo chegar para você, aparece aqui, na etapa certa." → **Correção:** nada a fazer; as sete etapas continuam visíveis em verde.
- **Aviso:** filtro sem resultado. "Nenhuma pendência com esse filtro." → **Correção:** clique em "Limpar filtros".
- **Erro:** esperar a solicitação ao fornecedor em Pendências. Ela **não** vira pendência: chega só no **sino** e em **Notificações** (e na lista "Solicitações ao fornecedor") → **Correção:** abra o sino (FOR-02).
- **Aviso:** abrir um endereço que não é seu. O sistema mostra "Página não encontrada" ("Este endereço não existe ou não está disponível para a sua conta…") → **Correção:** volte ao início.

### Passo a passo em texto

1. Entre no portal. O início é **Pendências** ("Minhas pendências").
2. Leia a faixa **Etapas que chegam até você**: Analisar o Booking, Die Cut, Ficha de compra, Aprovar a arte, Assinar o pedido, Produção e inspeção, Embarque. Vermelho é atrasado, amarelo é a fazer no prazo, verde é nada a fazer. O número é a quantidade de pendências.
3. Clique numa etapa para filtrar a lista. Clique de novo (ou em **Todas as etapas**) para voltar.
4. Na tabela, veja **Pendência**, **Detalhe**, **Etapa**, **Com você desde** (quando chegou à sua mão e desde quando o produto está no sistema) e **Prazo**.
5. Use os chips de **Prazo** (Atrasadas, Vencem hoje, Até 7 dias, Mais adiante, Sem prazo) para priorizar.
6. Clique em **Abrir** para ir ao lugar de resolver. O balão ao lado abre a conversa com a Wellmix.
7. Abra o sino (**Notificações**) e clique em **Resolver** nos avisos da sua vez.
8. Depois do embarque nada depende de você; acompanhe em **Pedidos**.

### Legendas na tela em EN e ZH

| Marca                       | EN                                              | ZH                                |
| --------------------------- | ----------------------------------------------- | --------------------------------- |
| Título da tela              | My tasks                                        | 我的待办                          |
| Faixa (título)              | Steps that reach you                            | 需要您处理的环节                  |
| Chip "todas"                | All steps                                       | 全部环节                          |
| Etapa 1                     | Review the Booking                              | 审核 Booking                      |
| Etapa 2                     | Die Cut                                         | 刀模 (Die Cut)                    |
| Etapa 3                     | Purchase sheet                                  | 采购表                            |
| Etapa 4                     | Approve the artwork                             | 确认设计稿                        |
| Etapa 5                     | Sign the order                                  | 签署订单                          |
| Etapa 6                     | Production and inspection                       | 生产与验货                        |
| Etapa 7                     | Shipment                                        | 装运                              |
| Legenda vermelho            | Overdue                                         | 已逾期                            |
| Legenda âmbar               | To do, on time                                  | 待办，未逾期                      |
| Legenda verde               | Done or nothing to do                           | 已完成或无待办                    |
| Colunas                     | Task · Detail · Step · With you since · Due     | 待办 · 详情 · 环节 · 到您手上的日期 · 截止 |
| Botão da linha              | Open                                            | 打开                              |
| Chips de prazo              | All · Overdue · Due today · Within 7 days · Later · No due date | 全部 · 已逾期 · 今天到期 · 7 天内 · 更晚 · 无期限 |
| Limpar                      | Clear filters                                   | 清除筛选                          |
| Sino (página)               | Notifications                                   | 通知                              |
| Blocos                      | Needs you · Attention · Updates                 | 需要您处理 · 注意 · 动态          |
| Tipo "sua vez"              | Your turn                                       | 轮到您                            |
| "Com quem"                  | It's with you now                               | 现在由您处理                      |
| Botão do aviso              | Resolve                                         | 去处理                            |
| Mostrar lidas               | Show read ({n})                                 | 显示已读（{n}）                   |
| PASSO 1/5                   | Read the strip of steps                         | 看环节条                          |
| PASSO 2/5                   | Tap a step                                      | 点击一个环节                      |
| PASSO 3/5                   | Check "With you since" and the due date         | 查看"到您手上的日期"和截止日期    |
| PASSO 4/5                   | Click Open                                      | 点击"打开"                        |
| PASSO 5/5                   | Open the bell                                   | 打开铃铛                          |
| RESUMO                      | Read the strip · Filter by step · Check dates · Open the task · Watch the bell | 看环节条 · 按环节筛选 · 看日期 · 打开待办 · 关注铃铛 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Everything Wellmix is waiting for from you is in one place. In ten seconds, you know what to do today. |
| 2 (0:10–0:28)  | Seven steps reach you, from the Booking to shipment. After shipment, nothing else depends on you. |
| 3 (0:28–1:05)  | The strip shows the seven steps, in order. Red means overdue. Amber means to do, on time. Green means nothing to do. The number beside a step is how many tasks it has. |
| 4 (1:05–1:35)  | Tap a step to see only its tasks. A short explanation of what to do appears below. Tap again to go back to the full list. |
| 5 (1:35–2:25)  | Each row is a task. "With you since" says when it reached you, and below it, since when the product has been in the system. Under "Due", see if it is due today, in how many days, or already overdue. |
| 6 (2:25–2:50)  | Under "Due", filter by deadline. The list already shows the most urgent first. |
| 7 (2:50–3:10)  | Click Open to go straight to where you solve it. The bubble beside it opens the conversation with Wellmix about that subject. |
| 8 (3:10–3:45)  | The bell counts new notices. In Notifications, the block "Needs you" lists what is your turn. Click Resolve: the system takes you there and marks the notice as read. |
| 9 (3:45–4:00)  | To sum up: read the strip, filter by step, open the task and watch the bell. Next, answer Wellmix's first request. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix 等您处理的事项，都在这一个页面。十秒钟，您就知道今天要做什么。 |
| 2 (0:10–0:28)  | 从 Booking 到装运，共有七个环节需要您处理。装运之后，就不再需要您处理了。 |
| 3 (0:28–1:05)  | 这条环节带按顺序显示七个环节。红色表示已逾期，黄色表示待办、未逾期，绿色表示无待办。环节旁边的数字，是这个环节的待办数量。 |
| 4 (1:05–1:35)  | 点击一个环节，只看这个环节的待办。下方会显示简短的操作说明。再点一次，回到完整列表。 |
| 5 (1:35–2:25)  | 每一行是一项待办。"到您手上的日期"告诉您它什么时候到了您手上，下面还有产品录入系统的日期。在"截止"一栏，可以看到今天到期、几天后到期，或者已经逾期。 |
| 6 (2:25–2:50)  | 在"期限"里，按到期时间筛选。列表已经把最紧急的排在最前面。 |
| 7 (2:50–3:10)  | 点击"打开"，直接到处理的地方。旁边的对话图标，可以就这件事和 Wellmix 沟通。 |
| 8 (3:10–3:45)  | 铃铛显示新通知的数量。在"通知"页面，"需要您处理"列出轮到您的事项。点击"去处理"，系统带您过去，并把通知标为已读。 |
| 9 (3:45–4:00)  | 小结：看环节条，按环节筛选，打开待办，关注铃铛。下一个视频，回复 Wellmix 的第一个询单。 |

### Notas de gravação

- A faixa das etapas é uma fileira de **quadrados pequenos** ligados por setas (não são cartões grandes). A explicação de cada etapa aparece em dica (passar o mouse) e, abaixo da faixa, ao filtrar. Use `[ZOOM 150 %]`.
- Para o vermelho aparecer, é preciso uma pendência com prazo vencido. O prazo da cotação vem da data de validade; sem pendência atrasada, mostre o vermelho só na legenda.
- Em **zh**, a faixa fica em uma linha em 1440 px; em telas menores ela rola para o lado.
- Os chips de prazo só aparecem para os prazos que têm pendência (na captura de teste, só "全部" e "更晚").
- O balão ao lado de **Abrir** abre a conversa daquela solicitação ou pedido.
- Não cite datas nem prazos na narração; mostre só.
- A coluna "Com você desde" mostra a data em que a tarefa chegou; "produto no sistema desde …" vem da linha do Booking.

### Pontos a confirmar

- ⚠ Pendências geradas por um **pagamento a confirmar** ("Confirmar recebimento: pedido #n") e pela **validação da invoice** saem com o título em português mesmo para quem usa zh/en (`tasks.ts` não define `text` nessas pendências). Conferir na gravação; se aparecer, gravar a tela como está e avisar o dono.
- ⚠ A pendência de recebimento não pertence a nenhuma das 7 etapas: aparece na lista e no filtro "Tipo", não na faixa.
- ⚠ Se o mapa da jornada deve acender as etapas 3 (cotação), 5, 6 e 7 ou todas as nove: usei 1, 3, 5, 6 e 7 por causa do que o fornecedor faz.

---

## FOR-02 · Responder à solicitação do Booking

> **Promessa:** ao final do vídeo você sabe dizer à Wellmix se faz o item, com preço por peça, moeda, pedido mínimo e prazo, e sabe até quando pode mudar a resposta.

| Ficha                 |                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                                       |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com` com uma solicitação aberta para ele)                           |
| Duração-alvo          | 3:30                                                                                                                             |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking (solicitação ao fornecedor)                                                                       |
| Telas e rotas         | `/app/notifications`, `/app/supplier-requests`, `/app/supplier-requests/[id]`                                                     |
| Dados antes de gravar | A Wellmix subiu a planilha de booking do Shenzhen Supplier A com a jarra (UTL-001), fechou o booking e, na **Seleção de itens**, abriu a solicitação com "O que a Wellmix precisa no produto" (ex.: tampa de bambu) e quantidade 1.200. Ponto `antes-FOR-02` |
| Depois deste vídeo    | A solicitação fica **Respondida**. A Wellmix aprova (o fornecedor é avisado) ou recusa; aprovada, a Wellmix cria o produto. A cotação vem depois (FOR-03) |
| Antes · Próximo       | FOR-01 · FOR-03                                                                                                                  |
| Idiomas               | pt (base), en, zh                                                                                                                |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/notifications`**

- 🎬 Imagem: o sino com o número 1. A tela **Notificações**, bloco "Precisa de você": "Wellmix 新询单第 1 号" (em en: "New Wellmix request no. 1"), tipo "Sua vez", "Agora é com você".
- 🎙 Narração: "A Wellmix quer saber se você faz esta jarra. Em três minutos você responde, com preço, pedido mínimo e prazo."
- 🔤 Na tela: `[TÍTULO]` "FOR-02 · Responder à solicitação do Booking"; `[SETA]` "Chegou pelo sino".
- ✂️ Edição: vinheta antes; título em 2 s.

**Cena 2 · 0:10–0:25 · Onde estou na jornada**

- 🎬 Imagem: a mesma tela; o mapa aparece sobre ela.
- 🎙 Narração: "Este é o primeiro contato com a Wellmix: ela escolheu um item do seu booking e pergunta se você faz."
- 🔤 Na tela: `[MAPA etapa 1]` "Produto e Booking" acesa; `[QUEM VÊ]` "Só o seu cadastro vê esta solicitação".
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:25–0:45 · Resolver o aviso · `/app/notifications` → `/app/supplier-requests/[id]`**

- 🎬 Imagem: clicar em **Resolver** ("去处理") na linha do aviso. A página **Solicitação ao fornecedor nº 1** abre, com a situação **Aberta**.
- 🎙 Narração: "Clique em Resolver. O sistema abre a solicitação e marca o aviso como lido. Ela também fica em Solicitações ao fornecedor, no menu Pedidos."
- 🔤 Na tela: `[PASSO 1/6] Clique em Resolver`; `[BOTÃO] "Resolver"`; `[DICA]` "Menu Pedidos → Solicitações ao fornecedor lista todas."
- ✂️ Edição: `[CORTE]` na abertura da página.

**Cena 4 · 0:45–1:25 · O que a Wellmix pede · `/app/supplier-requests/[id]`**

- 🎬 Imagem: o cartão **O que a Wellmix pede**: item e código, **Quantidade** (1.200 peças), **Preço do booking** (1,25 USD FOB), MOQ, **O que a Wellmix precisa no produto** (o texto livre), medidas, peso, CBM, material, embalagem. O cursor percorre cada bloco.
- 🎙 Narração: "À esquerda, o que a Wellmix pede: o item da sua planilha, a quantidade e, em destaque, o que ela precisa no produto, como a tampa de bambu. Confira o preço do booking e as medidas."
- 🔤 Na tela: `[PASSO 2/6] Leia o pedido`; `[SETA]` "O que a Wellmix precisa no produto"; `[SETA]` "Preço do seu booking"; `[QUEM VÊ]` "O fornecedor não vê outros itens nem outros fornecedores".
- ✂️ Edição: `[ZOOM 150 %]` no texto de necessidades; 2 s parado.

**Cena 5 · 1:25–2:10 · Responder "Sim, faço" · `/app/supplier-requests/[id]`**

- 🎬 Imagem: no cartão **Resposta do fornecedor**, em **Faz o que foi pedido?** escolher "Sim, faço"; digitar **Preço por peça** 1,40; **Moeda** USD; **Pedido mínimo (peças)** 1000; **Prazo de produção (dias)** 35; em **Observação**, uma frase. Clicar em **Enviar resposta**.
- 🎙 Narração: "Em Faz o que foi pedido, escolha Sim, faço. Digite o preço por peça, a moeda, o pedido mínimo e o prazo de produção. Use Observação para avisar de algo, como a tampa. Clique em Enviar resposta."
- 🔤 Na tela: `[PASSO 3/6] Escolha "Sim, faço" e preencha`; `[BOTÃO] "Enviar resposta"`; `[SETA]` "Obrigatório se faz: preço por peça"; `[DICA]` "Pedido mínimo, prazo e observação são opcionais, mas ajudam a decidir."
- ✂️ Edição: digitação em tempo real; mostrar 2 s o formulário preenchido.

**Cena 6 · 2:10–2:35 · Erro: faltou o preço · `/app/supplier-requests/[id]`**

- 🎬 Imagem: repetir com "Sim, faço" sem preço e clicar em **Enviar resposta**: a faixa vermelha aparece no alto.
- 🎙 Narração: "Se disser que faz e esquecer o preço, o sistema avisa: informe o preço por peça. Preencha e envie de novo."
- 🔤 Na tela: `[ERRO COMUM]` "Informe o preço por peça para dizer que faz."; correção em verde.
- ✂️ Edição: gravar este erro **antes** da resposta certa e cortar a ordem na montagem.

**Cena 7 · 2:35–3:05 · Resultado e mudança de ideia · `/app/supplier-requests/[id]`**

- 🎬 Imagem: o aviso verde "Resposta registrada."; a situação vira **Respondida**; o cartão mostra "Faz: 1,4 USD", o pedido mínimo, o prazo, a observação e "Respondido em …". Abaixo, a frase "Você pode mudar a resposta até a Wellmix decidir." e o formulário preenchido de novo. Mostrar também, em tela dividida, a opção "Não faço" (sem preço).
- 🎙 Narração: "Pronto: a situação virou Respondida. Se mudar de ideia, edite e envie de novo, até a Wellmix decidir. Se não fizer o item, escolha Não faço: não precisa de preço."
- 🔤 Na tela: `[PASSO 4/6] Confira a resposta`; `[ZOOM 150 %]` em "Você pode mudar a resposta até a Wellmix decidir."; `[ATENÇÃO]` "Depois da decisão da Wellmix a resposta não muda mais."
- ✂️ Edição: tela dividida para a opção "Não faço".

**Cena 8 · 3:05–3:20 · E agora? · `/app/notifications`**

- 🎬 Imagem: abrir o sino depois de a Wellmix aprovar. O aviso "Solicitação nº 1 aprovada" (tipo "Concluído") aparece em "Novidades". Abrir a solicitação: a situação é **Aprovada** e não há mais formulário.
- 🎙 Narração: "A Wellmix decide: aprova, recusa ou cancela, e você é avisado no sino. Aprovada, os próximos passos chegam pelo portal."
- 🔤 Na tela: `[PASSO 5/6] Acompanhe pelo sino`; `[DEPOIS]` "A Wellmix aprova e cria o produto. Você recebe a cotação (Análise do Booking) em Cotações e em Pendências."
- ✂️ Edição: cartão `[DEPOIS]` em 4 s.

**Cena 9 · 3:20–3:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, miniatura do FOR-03.
- 🎙 Narração: "Resumindo: abra o aviso, confira o pedido, diga se faz e informe preço, pedido mínimo e prazo. Próximo: a cotação do Booking."
- 🔤 Na tela: `[RESUMO]` "1 Abra o aviso · 2 Leia o pedido · 3 Sim, faço ou Não faço · 4 Preço, pedido mínimo, prazo · 5 Mude até a Wellmix decidir"; "Próximo: FOR-03".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Sim, faço" sem preço. Mensagem: "Informe o preço por peça para dizer que faz." → **Correção:** digite o preço por peça.
- **Erro:** responder depois da decisão. Mensagem: "A Wellmix já decidiu esta solicitação: a resposta não muda mais." → **Correção:** fale com a Wellmix pelas Mensagens.
- **Erro:** valor ilegível ou zero. Mensagem: "Algum valor não dá para ler. Use números maiores que zero." → **Correção:** use números positivos; pedido mínimo e prazo são inteiros.
- **Erro:** abrir uma solicitação de outro cadastro. Mensagem: "Página não encontrada" (404) → **Correção:** só as do seu cadastro aparecem na lista.

### Passo a passo em texto

1. Abra o sino e clique em **Resolver** no aviso "Nova solicitação da Wellmix nº N", ou vá a **Pedidos → Solicitações ao fornecedor** e abra a linha.
2. Leia **O que a Wellmix pede**: item, **Quantidade**, **Preço do booking**, MOQ, **O que a Wellmix precisa no produto**, medidas e embalagem.
3. Em **Faz o que foi pedido?**, escolha **Sim, faço** ou **Não faço**.
4. Se faz, digite **Preço por peça** (obrigatório) e escolha a **Moeda**. Se quiser, informe **Pedido mínimo (peças)**, **Prazo de produção (dias)** e **Observação**.
5. Clique em **Enviar resposta**. A situação vira **Respondida**.
6. Pode mudar a resposta e enviar de novo até a Wellmix decidir (**Aprovada**, **Recusada** ou **Cancelada**).
7. Acompanhe a decisão no sino.

### Legendas na tela em EN e ZH

| Marca                    | EN                                         | ZH                          |
| ------------------------ | ------------------------------------------ | --------------------------- |
| Menu                     | Orders → Supplier requests                 | 订单 → 供应商询单           |
| Título do aviso          | New Wellmix request no. {n}                | Wellmix 新询单第 {n} 号     |
| Botão do aviso           | Resolve                                    | 去处理                      |
| Título da página         | Supplier request no. {n}                   | 供应商询单第 {n} 号         |
| Situações                | Open · Answered · Approved · Declined · Cancelled | 待回复 · 已回复 · 已批准 · 已拒绝 · 已取消 |
| Cartão do pedido         | What Wellmix asks                          | Wellmix 的要求              |
| Campos                   | Quantity · Booking price                   | 数量 · Booking 价格         |
| Texto livre              | What Wellmix needs in the product          | Wellmix 对产品的要求        |
| Cartão da resposta       | Supplier's answer                          | 供应商回复                  |
| Pergunta                 | Can you do what was asked?                 | 能否按要求生产？            |
| Opções                   | Yes, I can · No, I can't                   | 可以 · 不可以               |
| Campos                   | Price per piece · Currency · Minimum order (pieces) · Production lead time (days) · Note | 单价 · 币种 · 最小起订量（件） · 生产周期（天） · 备注 |
| Botão                    | Send answer                                | 发送回复                    |
| Aviso de sucesso         | Answer recorded.                           | 回复已记录。                |
| Frase de mudança         | You can change the answer until Wellmix decides. | 在 Wellmix 决定之前，您可以修改回复。 |
| Erro (sem preço)         | Enter the price per piece to say you can do it. | 如能生产，请填写单价。  |
| Erro (decidida)          | Wellmix has already decided this request: the answer no longer changes. | Wellmix 已对该询单作出决定：回复不能再修改。 |
| Resposta na lista        | Can do: {price} · Cannot do                | 可以生产：{price} · 无法生产 |
| Aviso de decisão         | Request no. {n} approved                   | 询单第 {n} 号已批准         |
| PASSO 1/6                | Click Resolve                              | 点击"去处理"                |
| PASSO 2/6                | Read the request                           | 阅读询单                    |
| PASSO 3/6                | Choose "Yes, I can" and fill in            | 选择"可以"并填写            |
| PASSO 4/6                | Check your answer                          | 核对您的回复                |
| PASSO 5/6                | Follow the decision in the bell            | 在铃铛中跟进结果            |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix wants to know if you make this glass jar. In three minutes you answer, with price, minimum order and lead time. |
| 2 (0:10–0:25)  | This is the first contact with Wellmix: it picked an item from your booking and asks whether you make it. |
| 3 (0:25–0:45)  | Click Resolve. The system opens the request and marks the notice as read. It also stays in Supplier requests, under the Orders menu. |
| 4 (0:45–1:25)  | On the left, what Wellmix asks: the item from your spreadsheet, the quantity and, highlighted, what Wellmix needs in the product, like the bamboo lid. Check the booking price and the measurements. |
| 5 (1:25–2:10)  | Under "Can you do what was asked", choose Yes, I can. Type the price per piece, the currency, the minimum order and the production lead time. Use Note to warn about anything. Click Send answer. |
| 6 (2:10–2:35)  | If you say you can do it but forget the price, the system warns you: enter the price per piece. Fill it in and send again. |
| 7 (2:35–3:05)  | Done: the status is now Answered. If you change your mind, edit and send again, until Wellmix decides. If you do not make the item, choose No, I can't: no price needed. |
| 8 (3:05–3:20)  | Wellmix decides: approves, declines or cancels, and you are notified in the bell. Once approved, the next steps come through the portal. |
| 9 (3:20–3:30)  | In short: open the notice, check the request, say if you can do it, and give price, minimum order and lead time. Next: the quotation. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix 想知道您能不能生产这款玻璃罐。三分钟内，您就能回复价格、起订量和交期。 |
| 2 (0:10–0:25)  | 这是和 Wellmix 的第一次联系：它从您的 Booking 里选了一个条目，问您能不能生产。 |
| 3 (0:25–0:45)  | 点击"去处理"。系统会打开询单，并把通知标为已读。它也会保留在"订单"菜单的"供应商询单"里。 |
| 4 (0:45–1:25)  | 左边是 Wellmix 的要求：您表格里的条目、数量，以及重点的"Wellmix 对产品的要求"，比如竹盖。请核对 Booking 价格和尺寸。 |
| 5 (1:25–2:10)  | 在"能否按要求生产"里选择"可以"。填写单价、币种、最小起订量和生产周期。有需要说明的，写在备注里。然后点击"发送回复"。 |
| 6 (2:10–2:35)  | 如果选了能生产，却忘了填单价，系统会提示：请填写单价。补上以后再发送一次。 |
| 7 (2:35–3:05)  | 好了，状态变成"已回复"。如果改变主意，修改后再发一次，直到 Wellmix 作出决定。如果不能生产，选"不可以"，不用填单价。 |
| 8 (3:05–3:20)  | Wellmix 会批准、拒绝或取消，您在铃铛里会收到通知。批准后，后续步骤会通过门户通知您。 |
| 9 (3:20–3:30)  | 小结：打开通知，核对要求，说明能不能生产，并填写单价、起订量和交期。下一个视频：Booking 报价。 |

### Notas de gravação

- Prepare o ponto `antes-FOR-02` com a solicitação **Aberta** e o aviso não lido. O texto "O que a Wellmix precisa no produto" deve estar preenchido (senão a tela mostra "Nada além do item como está.").
- A solicitação **não** gera pendência: não procure na faixa de etapas (cena 1 mostra o sino de propósito).
- O **Preço do booking** e o **MOQ** que o fornecedor vê são os da planilha dele mesmo (cópia do item); não aparece preço de venda.
- Quando a solicitação é do fornecedor B (en), repita a preparação com a planilha dele; a conta A não vê a de B.
- Preço digitado "1,40" aparece depois como "1,4 USD" (sem zero à direita).
- Grave a cena 6 (erro) antes da 5.

### Pontos a confirmar

- ⚠ O aviso original "Sua vez" **continua não lido** depois de o fornecedor responder (só some ao clicar em "Resolver"). A cena 3 usa o botão de propósito; confirmar com o dono se deve sumir ao responder.
- ⚠ Por pedido do dono (docs/SUPPLIER_REQUESTS.md), depois da aprovação a Wellmix cria o produto; o que o fornecedor recebe depois (cotação) depende de a Wellmix gerar a solicitação do produto. O tempo entre as duas não é fixo.
- ⚠ Sem login, a solicitação não chega ao fornecedor: a Wellmix registra a resposta por ele. Este vídeo supõe fornecedor com login.

---

## FOR-03 · Responder à cotação (Análise do Booking)

> **Promessa:** ao final do vídeo você sabe confirmar o preço desejado pela Wellmix, mandar o seu preço ou dizer que não aceita, e sabe quando precisa preencher a ficha completa.

| Ficha                 |                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                                          |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                                  |
| Duração-alvo          | 4:30                                                                                                                                |
| Ponto da jornada      | Etapa 3 de 9: Cotação                                                                                                               |
| Telas e rotas         | `/app` (Pendências), `/app/quotes`, `/app/quotes/[id]` (`#offer`, `#negotiation`)                                                     |
| Dados antes de gravar | Solicitação nascida do **Booking** (Wellmix: fila de produtos → "Gerar solicitação"), produto com preço na ficha (1,25 USD) e fornecedor principal = Shenzhen Supplier A. Ponto `antes-FOR-03` |
| Depois deste vídeo    | Confirmando ou mandando preço, a cotação fica **Respondida** e a Wellmix é avisada. Se a Wellmix escolher o fornecedor, vêm Die Cut (FOR-04), ficha (FOR-05) etc. |
| Antes · Próximo       | FOR-02 · FOR-04                                                                                                                     |
| Idiomas               | pt (base), en, zh                                                                                                                   |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: Pendências com a linha "Analisar o Booking: Glass jar 1.5L with bamboo lid" e o botão **Abrir**.
- 🎙 Narração: "A Wellmix já sabe quanto quer pagar pela jarra. Você só confirma o preço, ou manda o seu."
- 🔤 Na tela: `[TÍTULO]` "FOR-03 · Responder à cotação"; `[MAPA etapa 3]`.
- ✂️ Edição: vinheta antes; mapa sai em 8 s.

**Cena 2 · 0:10–0:35 · Abrir e entender a tela · `/app/quotes/[id]`**
- 🎬 Imagem: **Abrir**. Título "Análise do Booking: …", número da solicitação, situação **Convidado**, aviso azul "Este produto é do seu Booking com a Wellmix… Não há outros fornecedores neste produto." O botão **Conversar com a Wellmix** (zh: "联系 Wellmix") no alto.
- 🎙 Narração: "Este produto é do seu Booking. Não há outros fornecedores concorrendo: é só você e a Wellmix. Para conversar, use o botão de mensagens no alto."
- 🔤 Na tela: `[PASSO 1/6] Abra a pendência`; `[BOTÃO] "Abrir"`; `[QUEM VÊ]` "O fornecedor não vê outros fornecedores nem o cliente".
- ✂️ Edição: `[ZOOM 150 %]` no aviso azul.

**Cena 3 · 0:35–1:10 · O preço desejado · `#offer`**
- 🎬 Imagem: o cartão **Preço desejado pela Wellmix**: "Preço por peça US$ 1,25" e "Quantidade 1.200 un". Abaixo, **Prazo de produção (dias)**, **Outro preço por peça (USD)** ("Só se você não vende pelo preço acima.") e **Comentário (opcional)**.
- 🎙 Narração: "Aqui está o preço que a Wellmix quer pagar e a quantidade. Se vende por esse preço, informe só o prazo de produção. O outro preço é só se não vende por ele."
- 🔤 Na tela: `[PASSO 2/6] Leia o preço desejado`; `[SETA]` "Obrigatório: prazo de produção"; `[QUEM VÊ]` "Só você vê este preço".
- ✂️ Edição: `[ZOOM 150 %]` no preço; 2 s parado.

**Cena 4 · 1:10–1:55 · Confirmar o preço · `#offer` → `#negotiation`**
- 🎬 Imagem: digitar 35 em **Prazo de produção (dias)**, um comentário curto e clicar em **Confirmar US$ 1,25**. A tela mostra "Preço confirmado. A cotação está respondida e a Wellmix foi avisada." e o cartão **Negociação** com o histórico (duas linhas).
- 🎙 Narração: "Digite o prazo e clique em Confirmar. A cotação fica respondida, a Wellmix é avisada, e você não precisa preencher a ficha abaixo."
- 🔤 Na tela: `[PASSO 3/6] Informe o prazo e confirme`; `[BOTÃO] "Confirmar US$ 1,25"`; `[SETA]` "Histórico da negociação".
- ✂️ Edição: `[CORTE]` no resultado; cartão `[DEPOIS]` em 3 s: "A Wellmix compara e escolhe".

**Cena 5 · 1:55–2:45 · Mandar outro preço · `#offer`**
- 🎬 Imagem: (em outra tomada) digitar o seu preço em **Outro preço por peça (USD)** e clicar em **Enviar outro preço**. Mostrar a faixa vermelha quando falta o preço: "Para enviar outro preço, digite o preço por peça." Depois, o resultado: "Preço enviado. A Wellmix foi avisada e vai responder; use as mensagens para conversar." e o aviso amarelo "O preço do fornecedor … é diferente do desejado pela Wellmix …".
- 🎙 Narração: "Se não vende pelo preço da Wellmix, digite o seu e clique em Enviar outro preço. A Wellmix é avisada, e vocês conversam pelas mensagens. Sem o preço, o sistema pede para digitar."
- 🔤 Na tela: `[PASSO 4/6] Mande o seu preço`; `[BOTÃO] "Enviar outro preço"`; `[ERRO COMUM]` "Para enviar outro preço, digite o preço por peça."; `[ATENÇÃO]` "Outro preço igual ao desejado conta como confirmação."
- ✂️ Edição: tela dividida entre o erro e o resultado.

**Cena 6 · 2:45–3:20 · Não aceitar · `#offer`**
- 🎬 Imagem: (outra tomada) clicar em **Não aceito este preço** (sem prazo nem preço). Aparece "Registrado: o preço não foi aceito. A Wellmix foi avisada; use as mensagens para conversar." e o aviso amarelo com a data. O cartão continua: depois de conversar, dá para confirmar ou mandar o preço.
- 🎙 Narração: "Se não aceita, um toque: Não aceito este preço. Não precisa de prazo nem de preço. A Wellmix é avisada e vocês conversam. Depois você ainda pode confirmar ou mandar o seu."
- 🔤 Na tela: `[PASSO 5/6] Não aceita? Um toque`; `[BOTÃO] "Não aceito este preço"`; `[SETA]` "Botão de mensagens".
- ✂️ Edição: `[ZOOM 150 %]` no aviso amarelo.

**Cena 7 · 3:20–4:05 · Sem preço desejado: a ficha completa · `#quote-sheet`**
- 🎬 Imagem: numa cotação sem preço desejado, a tela traz a ficha: aviso "Para enviar, falta preencher: …", a tabela **Blocos da ficha** (Fornecedor, Produto, Caixa e embalagem, Preço e condições, Fotos), o quadro **Cartão do fabricante** (obrigatório), as fotos (balança, régua, lado, outro ângulo, original), **Prazo de produção (dias)** e **Enviar cotação** / **Salvar rascunho**.
- 🎙 Narração: "Sem preço desejado, você responde com a ficha completa: preencha o que falta em vermelho, envie o cartão do fabricante e as cinco fotos. Salve o rascunho quando quiser. Só no fim, clique em Enviar cotação."
- 🔤 Na tela: `[PASSO 6/6] Sem preço desejado: preencha a ficha`; `[BOTÃO] "Enviar cotação"`; `[BOTÃO] "Salvar rascunho"`; `[DICA]` "Se o produto já veio do Booking com foto, as 5 fotos de conferência são opcionais agora."
- ✂️ Edição: avançar rápido pelos campos; detalhes em FOR-05.

**Cena 8 · 4:05–4:30 · Depois e resumo**
- 🎬 Imagem: **Cotações** com as abas "Para responder", "Enviadas", "Escolhidas", "Não escolhidas"; fundo vermelho com o resumo; miniatura do FOR-04.
- 🎙 Narração: "Enviada a cotação, ela fica em Enviadas até a Wellmix decidir. Próximo vídeo: o Die Cut, quando você é o escolhido."
- 🔤 Na tela: `[DEPOIS]` "A Wellmix compara e escolhe. Escolhido, você é avisado: 'Sua cotação foi escolhida'."; `[RESUMO]` "1 Abra a pendência · 2 Leia o preço desejado · 3 Confirme, mande outro ou não aceite · 4 Sem preço desejado: ficha completa"; "Próximo: FOR-04".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** confirmar sem prazo. "Informe o prazo de produção em dias (número inteiro)." → **Correção:** digite o prazo em dias, inteiro.
- **Erro:** "Enviar outro preço" sem preço. "Para enviar outro preço, digite o preço por peça." → **Correção:** digite o preço por peça.
- **Erro:** a tela estava desatualizada. "Esta cotação não tem preço desejado esperando resposta. Atualize a página." → **Correção:** recarregue a página.
- **Erro:** recusar o mesmo preço duas vezes. "Este preço já foi recusado. Use as mensagens para conversar, ou confirme ou envie outro preço."
- **Erro:** enviar a ficha sem o cartão do fabricante. "Falta o cartão do fabricante: envie ou escolha um no quadro "Cartão do fabricante" para enviar a cotação."
- **Erro:** ficha incompleta. "A ficha foi salva, mas ainda está incompleta: preencha os campos com * e todas as fotos para enviar a cotação."

### Passo a passo em texto

1. Em Pendências, clique em **Abrir** na linha "Analisar o Booking: produto" (ou abra **Pedidos → Cotações** e clique em **Preencher cotação**).
2. Leia o cartão **Preço desejado pela Wellmix**: preço por peça e quantidade.
3. Para aceitar: digite o **Prazo de produção (dias)**, escreva um **Comentário** se quiser e clique em **Confirmar {preço}**.
4. Para propor outro preço: digite o **Outro preço por peça** e clique em **Enviar outro preço**. A Wellmix é avisada e conversa com você pelas mensagens.
5. Para não aceitar: clique em **Não aceito este preço**. Depois da conversa, você ainda pode confirmar ou mandar o seu.
6. Sem preço desejado: preencha a ficha, o cartão do fabricante e as fotos, informe o prazo e clique em **Enviar cotação** (ou **Salvar rascunho**).
7. Até a decisão da Wellmix, dá para corrigir e reenviar pela própria cotação.

### Legendas na tela em EN e ZH

| Marca                | EN                                              | ZH                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------- |
| Título da tela       | Booking review: {product}                       | Booking 分析：{product}             |
| Selo "convidado"     | Invited                                         | 已邀请                              |
| Aviso azul           | This product is from your Booking with Wellmix… | 此产品来自您与 Wellmix 的 Booking…  |
| Cartão               | Price wanted by Wellmix                         | Wellmix 的期望价格                  |
| Campos               | Price per piece · Quantity                      | 单价 · 数量                         |
| Prazo                | Production lead time (days)                     | 生产周期（天）                      |
| Outro preço          | Another price per piece ({currency})            | 其他单价（{currency}）              |
| Dica do outro preço  | Only if you do not sell at the price above.     | 仅在您不能按上述价格供货时填写。    |
| Comentário           | Comment (optional)                              | 备注（选填）                        |
| Botão 1              | Confirm {price}                                 | 确认 {price}                        |
| Botão 2              | Send another price                              | 发送其他价格                        |
| Botão 3              | I do not accept this price                      | 不接受此价格                        |
| Sucesso (confirmar)  | Price confirmed. The quote is answered and Wellmix was notified. | 价格已确认。报价已完成，并已通知 Wellmix。 |
| Sucesso (outro)      | Price sent. Wellmix was notified and will reply; use the messages to talk. | 价格已发送。已通知 Wellmix，对方会回复；请通过消息沟通。 |
| Sucesso (não aceito) | Recorded: the price was not accepted. Wellmix was notified; use the messages to talk. | 已登记：未接受该价格。已通知 Wellmix；请通过消息沟通。 |
| Erro (prazo)         | Enter the production lead time in days (whole number). | 请填写生产周期（天，整数）。 |
| Erro (outro preço)   | To send another price, type the price per piece. | 如需发送其他价格，请填写单价。     |
| Histórico            | Negotiation history                             | 议价记录                            |
| Ficha                | Quotation purchase sheet                        | 报价采购单                          |
| Botões da ficha      | Send quotation · Save draft                     | 提交报价 · 保存草稿                 |
| Cartão do fabricante | Manufacturer's card                             | 工厂名片                            |
| Abas da lista        | To answer · Sent · Selected · Not selected      | 待回复 · 已提交 · 已选中 · 未选中   |
| PASSO 1/6 a 6/6      | Open the task · Read the wanted price · Enter the lead time and confirm · Send your price · Do not accept? One tap · No wanted price: fill in the sheet | 打开待办 · 看期望价格 · 填交期并确认 · 发送您的价格 · 不接受？点一下 · 没有期望价格：填写采购单 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix already knows what it wants to pay for the jar. You just confirm the price, or send yours. |
| 2 (0:10–0:35)  | This product is from your Booking. No other suppliers compete: it is just you and Wellmix. To talk, use the messages button at the top. |
| 3 (0:35–1:10)  | Here is the price Wellmix wants to pay, and the quantity. If you sell at that price, only enter the production lead time. The other price is only if you do not sell at it. |
| 4 (1:10–1:55)  | Type the lead time and click Confirm. The quote is answered, Wellmix is notified, and you do not need to fill in the sheet below. |
| 5 (1:55–2:45)  | If you do not sell at Wellmix's price, type yours and click Send another price. Wellmix is notified and you talk through the messages. Without the price, the system asks you to type it. |
| 6 (2:45–3:20)  | If you do not accept, one tap: I do not accept this price. No lead time or price needed. Wellmix is notified and you talk. Afterwards you can still confirm or send yours. |
| 7 (3:20–4:05)  | Without a wanted price, you answer with the full sheet: fill in what is red, send the manufacturer's card and the five photos. Save a draft any time. Only at the end, click Send quotation. |
| 8 (4:05–4:30)  | Once sent, the quote stays under Sent until Wellmix decides. Next video: the Die Cut, when you are the chosen one. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix 已经知道这款玻璃罐想按什么价格采购。您只需确认价格，或者报出自己的价格。 |
| 2 (0:10–0:35)  | 这个产品来自您的 Booking，没有其他供应商竞争，只有您和 Wellmix。需要沟通，请用页面顶部的消息按钮。 |
| 3 (0:35–1:10)  | 这里是 Wellmix 想采购的价格和数量。如果您能按这个价格供货，只需填写生产周期。"其他单价"只在您不能按此价供货时填写。 |
| 4 (1:10–1:55)  | 填好生产周期，点击"确认"。报价随即完成，Wellmix 会收到通知，下方的采购单不用再填。 |
| 5 (1:55–2:45)  | 如果不能按 Wellmix 的价格供货，填写您的单价，点击"发送其他价格"。Wellmix 会收到通知，双方通过消息沟通。没填单价，系统会提示您填写。 |
| 6 (2:45–3:20)  | 如果不接受，点一下"不接受此价格"，不用填交期，也不用填单价。Wellmix 会收到通知，双方沟通。之后您仍然可以确认价格，或者发送自己的价格。 |
| 7 (3:20–4:05)  | 没有期望价格时，请填写完整的采购单：补全标红的内容，上传工厂名片和五张照片。随时可以保存草稿，最后再点击"提交报价"。 |
| 8 (4:05–4:30)  | 报价提交后，会留在"已提交"里，等待 Wellmix 决定。下一个视频：您被选中以后的刀模环节。 |

### Notas de gravação

- Grave as três respostas (confirmar, outro preço, não aceitar) em **três cotações diferentes** (ou refaça pelo ponto de salvamento): depois de confirmar, o cartão do preço desejado some.
- O cartão do preço desejado só aparece quando a solicitação nasce do Booking, a cotação ainda não foi respondida e o fornecedor é o **principal do produto**. Se aparecer só a ficha, a cotação não é do Booking: grave a cena 7 nela.
- Na cena 7, a captura mostra o texto "Responda a cotação preenchendo a ficha de compra completa…" mesmo com o cartão do preço desejado acima; se atrapalhar, enquadre só o cartão (nota abaixo em Pontos a confirmar).
- O prazo vem vazio se a Wellmix nunca recebeu prazo desse fornecedor para o produto; se vier preenchido, mostre que dá para corrigir.

### Pontos a confirmar

- ⚠ A tela mostra, ao mesmo tempo, "Confirmando, a cotação fica respondida: não é preciso preencher a ficha abaixo" e o texto "Responda a cotação preenchendo a ficha de compra completa: … a programação dos lotes e as 5 fotos … o pedido já nasce com a Preparação concluída" (`quoteSheet.intro`). O segundo está desatualizado (a programação saiu da cotação; as fotos são opcionais com foto do Booking). Possível texto a rever.
- ⚠ A tabela **"Solicitação"** da cotação mostra rótulos em português mesmo na tela zh/en ("COR", "PESO POR UNIDADE", "CAIXA MASTER", "0,62 kg líquido · 0,7 kg bruto", "6 peças · 0,045 m³") e a unidade "un". Verificado em zh. Gravar como está e avisar o dono.
- ⚠ As cenas 5 e 6 (outro preço e não aceitar) foram escritas pelo código e pelos dicionários; a tela de confirmar e o erro de prazo foram vistos na gravação de teste.
- ⚠ "Cartão do fabricante" é só da ficha; na resposta pelo cartão do preço desejado ele não é exigido.

---

## FOR-04 · Die Cut (faca da caixa), pedido mínimo e foto em alta

> **Promessa:** ao final do vídeo você sabe enviar a faca da caixa e a foto em alta, e confirmar o pedido mínimo e o prazo de entrega, para a agência poder fazer a arte.

| Ficha                 |                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Fornecedor                                                                                                                     |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                             |
| Duração-alvo          | 3:30                                                                                                                           |
| Ponto da jornada      | Etapa 5 de 9: Preparação (faca e arte), com a cotação já escolhida                                                              |
| Telas e rotas         | `/app` (etapa "Die Cut"), `/app/quotes/[id]#die-cut`, `/app/orders/[id]#die-cut`                                                 |
| Dados antes de gravar | Cotação do Shenzhen Supplier A **escolhida** (ou pedido já criado) e o briefing de embalagem com o die-cut entre os entregáveis. Ponto `antes-FOR-04` |
| Depois deste vídeo    | Quem faz a arte (agência ou Wellmix) é avisado na hora ("Die-cut enviado. Quem faz a arte já foi avisado."). A Wellmix é avisada quando os quatro itens completam e quando pedido mínimo ou prazo mudam |
| Antes · Próximo       | FOR-03 · FOR-05                                                                                                                |
| Idiomas               | pt (base), en, zh                                                                                                              |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: a faixa com a etapa **Die Cut** em âmbar e a linha "Die Cut: Glass jar 1.5L with bamboo lid", detalhe "Pedido #1 · die-cut, foto em alta, pedido mínimo e prazo de entrega".
- 🎙 Narração: "Sua cotação foi escolhida. Agora a agência precisa da faca da caixa para fazer a arte. É você quem envia."
- 🔤 Na tela: `[TÍTULO]` "FOR-04 · Die Cut"; `[MAPA etapa 5]`.
- ✂️ Edição: vinheta antes; mapa sai em 8 s.

**Cena 2 · 0:10–0:35 · Abrir a etapa · `/app` → `/app/orders/[id]#die-cut`**
- 🎬 Imagem: clicar em **Abrir**. O cartão **Die Cut** abre com a etiqueta "1/4" e o aviso âmbar "Falta: Die Cut, Foto em alta, Pedido mínimo (MOQ)."
- 🎙 Narração: "Clique em Abrir. A etapa tem quatro itens: o die-cut, a foto em alta, o pedido mínimo e o prazo de entrega. O aviso mostra o que ainda falta."
- 🔤 Na tela: `[PASSO 1/5] Abra a etapa Die Cut`; `[BOTÃO] "Abrir"`; `[QUEM VÊ]` "Só o fornecedor da cotação escolhida vê esta etapa".
- ✂️ Edição: `[ZOOM 150 %]` no aviso "Falta".

**Cena 3 · 0:35–1:10 · 1. Enviar o die-cut · `#die-cut`**
- 🎬 Imagem: no item "1. Die Cut", clicar em **Escolher arquivo** (PDF, AI, CDR…) ou **Tirar ou escolher foto**. O arquivo sobe sozinho; aparece "Die-cut enviado. Quem faz a arte já foi avisado." e o item vira **Feito**, com o nome do arquivo e "v1".
- 🎙 Narração: "Primeiro, o die-cut, a faca da caixa. Escolha o arquivo ou tire uma foto. Ele sobe sozinho, e quem faz a arte é avisado na hora. Enviar de novo cria uma nova versão."
- 🔤 Na tela: `[PASSO 2/5] Envie o die-cut`; `[BOTÃO] "Escolher arquivo"`; `[BOTÃO] "Tirar ou escolher foto"`; `[DICA]` "Enviar de novo cria uma versão nova (v2)."
- ✂️ Edição: mostrar a barra de envio; 2 s no selo "Feito".

**Cena 4 · 1:10–1:50 · 2. Foto em alta · `#die-cut`**
- 🎬 Imagem: no item "2. Foto em alta", clicar em **Adicionar foto em alta** e escolher uma ou mais fotos. Aparece "Foto em alta enviada." e o nome do arquivo.
- 🎙 Narração: "Depois, a foto em alta do produto, a original, sem passar por aplicativo de mensagem. Pode enviar mais de uma."
- 🔤 Na tela: `[PASSO 3/5] Envie a foto em alta`; `[BOTÃO] "Adicionar foto em alta"`; `[DICA]` "Mande a foto original: aplicativos de mensagem reduzem a qualidade."
- ✂️ Edição: `[ZOOM 150 %]` na lista de arquivos enviados.

**Cena 5 · 1:50–2:40 · 3 e 4. Pedido mínimo e prazo · `#die-cut`**
- 🎬 Imagem: os campos **Pedido mínimo (peças)** (1000) e **Prazo de entrega (dias)** (35) já vêm preenchidos com o que o sistema conhece. Conferir, corrigir se mudou e clicar em **Confirmar pedido mínimo e prazo**. Aparece "Pedido mínimo e prazo de entrega confirmados." e os itens 3 e 4 viram **Feito**.
- 🎙 Narração: "Por fim, o pedido mínimo e o prazo. Já vêm preenchidos com o que sabemos. Se estão certos, só confirme. Se mudaram, corrija e confirme: a Wellmix é avisada da mudança."
- 🔤 Na tela: `[PASSO 4/5] Confirme pedido mínimo e prazo`; `[BOTÃO] "Confirmar pedido mínimo e prazo"`; `[ATENÇÃO]` "Mudar pedido mínimo ou prazo avisa a Wellmix, com o valor de antes."
- ✂️ Edição: `[ZOOM 150 %]` nos dois campos.

**Cena 6 · 2:40–3:05 · Erros comuns · `#die-cut`**
- 🎬 Imagem: digitar 0 ou texto em **Pedido mínimo** e confirmar: faixa vermelha. Depois, enviar a foto em alta sem escolher arquivo.
- 🎙 Narração: "Pedido mínimo é um número inteiro de peças, maior que zero. Prazo, de um a setecentos e vinte dias. E a foto precisa de pelo menos um arquivo."
- 🔤 Na tela: `[ERRO COMUM]` "Pedido mínimo inválido: informe um número inteiro de peças, maior que zero."; `[ERRO COMUM]` "Escolha pelo menos uma foto."
- ✂️ Edição: tela dividida com os dois erros.

**Cena 7 · 3:05–3:30 · Depois e resumo**
- 🎬 Imagem: o cartão mostra "Os quatro itens estão feitos. Obrigado!" e a etiqueta "Feito"; a pendência some da faixa. Fundo vermelho com o resumo; miniatura do FOR-05.
- 🎙 Narração: "Com os quatro itens, a etapa está completa e a Wellmix é avisada. Próximo vídeo: a ficha de compra do pedido."
- 🔤 Na tela: `[DEPOIS]` "A agência faz a arte em cima do seu die-cut. Quando ela chegar, você aprova (FOR-06)."; `[RESUMO]` "1 Die-cut · 2 Foto em alta · 3 Pedido mínimo · 4 Prazo de entrega"; "Próximo: FOR-05".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** pedido mínimo zero ou decimal. "Pedido mínimo inválido: informe um número inteiro de peças, maior que zero."
- **Erro:** prazo fora do intervalo. "Prazo inválido: informe um número inteiro de dias, de 1 a 720."
- **Erro:** campos vazios. "Preencha o pedido mínimo e o prazo de entrega para confirmar."
- **Erro:** enviar a foto em alta sem escolher. "Escolha pelo menos uma foto."
- **Erro:** arquivo grande. "Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado." → **Correção:** comprima ou mande ZIP/PDF.
- **Aviso:** formato recusado. "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)."

### Passo a passo em texto

1. Em Pendências, na etapa **Die Cut**, clique em **Abrir** (ou abra a cotação escolhida ou o pedido, no cartão **Die Cut**).
2. Item 1: clique em **Escolher arquivo** ou **Tirar ou escolher foto** e envie o die-cut. Enviar de novo cria uma nova versão.
3. Item 2: clique em **Adicionar foto em alta** e envie a foto original (pode ser mais de uma).
4. Itens 3 e 4: confira **Pedido mínimo (peças)** e **Prazo de entrega (dias)**, corrija se preciso e clique em **Confirmar pedido mínimo e prazo**.
5. Quando os quatro itens estão **Feito**, o cartão diz "Os quatro itens estão feitos. Obrigado!".

### Legendas na tela em EN e ZH

| Marca                  | EN                                           | ZH                                  |
| ---------------------- | -------------------------------------------- | ----------------------------------- |
| Etapa / título         | Die Cut                                      | 刀模 (Die Cut)                      |
| Pendência              | Die Cut: {product}                           | 刀模 (Die Cut)：{product}           |
| Aviso "falta"          | Missing: {list}.                             | 尚缺：{list}。                      |
| Item 1                 | Die Cut                                      | 刀模 (Die Cut)                      |
| Item 2                 | High-resolution photo                        | 高清照片                            |
| Item 3                 | Minimum order (MOQ)                          | 起订量 (MOQ)                        |
| Item 4                 | Lead time                                    | 交期                                |
| Estados                | Done · Pending                               | 已完成 · 待处理                     |
| Botões de arquivo      | Choose file · Take or choose photo           | 选择文件 · 拍照或选择照片           |
| Botão da foto em alta  | Add high-resolution photo                    | 添加高清照片                        |
| Campos                 | Minimum order (pieces) · Lead time (days)    | 起订量（件） · 交期（天）           |
| Botão                  | Confirm minimum order and lead time          | 确认起订量和交期                    |
| Sucesso 1              | Die-cut sent. Whoever makes the artwork was told. | 刀模已上传，已通知设计方。      |
| Sucesso 2              | High-resolution photo sent.                  | 高清照片已上传。                    |
| Sucesso 3              | Minimum order and lead time confirmed.       | 起订量和交期已确认。                |
| Concluído              | All four items are done. Thank you!          | 四项均已完成，谢谢！                |
| Erro MOQ               | Invalid minimum order: enter a whole number of pieces, above zero. | 起订量无效：请输入大于零的整数件数。 |
| Erro prazo             | Invalid lead time: enter a whole number of days, from 1 to 720. | 交期无效：请输入 1 到 720 之间的整数天数。 |
| Erro foto              | Choose at least one photo.                   | 请至少选择一张照片。                |
| PASSO 1/5 a 4/5        | Open the Die Cut step · Send the die-cut · Send the high-res photo · Confirm minimum order and lead time | 打开刀模环节 · 上传刀模 · 上传高清照片 · 确认起订量和交期 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Your quote was chosen. Now the agency needs the box die-cut to make the artwork. You are the one who sends it. |
| 2 (0:10–0:35)  | Click Open. The step has four items: the die-cut, the high-resolution photo, the minimum order and the lead time. The warning shows what is still missing. |
| 3 (0:35–1:10)  | First, the die-cut, the box template. Choose the file or take a photo. It uploads by itself and whoever makes the artwork is told right away. Sending again creates a new version. |
| 4 (1:10–1:50)  | Then, the high-resolution photo of the product, the original, not sent through a messaging app. You can send more than one. |
| 5 (1:50–2:40)  | Finally, the minimum order and the lead time. They come prefilled with what we know. If they are right, just confirm. If they changed, correct and confirm: Wellmix is told about the change. |
| 6 (2:40–3:05)  | The minimum order is a whole number of pieces, above zero. The lead time, from one to seven hundred twenty days. And the photo needs at least one file. |
| 7 (3:05–3:30)  | With all four items, the step is complete and Wellmix is notified. Next video: the order's purchase sheet. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | 您的报价被选中了。现在设计公司需要包装盒刀模来做设计稿，由您来上传。 |
| 2 (0:10–0:35)  | 点击"打开"。这个环节有四项：刀模、高清照片、起订量和交期。黄色提示会告诉您还缺什么。 |
| 3 (0:35–1:10)  | 先传刀模，也就是包装盒的模版。选择文件，或者拍照。文件会自动上传，负责设计稿的一方马上收到通知。再次上传会生成新版本。 |
| 4 (1:10–1:50)  | 然后是产品的高清照片，要原图，不要通过聊天软件发送。可以上传多张。 |
| 5 (1:50–2:40)  | 最后是起订量和交期。系统已按现有资料填好。如果正确，直接确认；如果有变化，修改后确认，Wellmix 会收到变更通知。 |
| 6 (2:40–3:05)  | 起订量必须是大于零的整数件数。交期是一到七百二十天。照片至少要选一个文件。 |
| 7 (3:05–3:30)  | 四项都完成后，这个环节就完成了，Wellmix 也会收到通知。下一个视频：订单的采购单。 |

### Notas de gravação

- O cartão tem um destaque (borda rosada e etiqueta "n/4"). Na captura de teste, o prazo (35) veio já feito pela cotação e o pedido mínimo (1000) veio sugerido; os itens 1 e 2 estavam pendentes.
- O link da pendência leva a `/app/quotes/[id]#die-cut` (antes do pedido) ou `/app/orders/[id]#die-cut` (com pedido). Grave pelo pedido.
- O die-cut e a foto em alta são **internos**: o cliente e outros fornecedores não os veem; a agência só baixa o die-cut.
- Mostre o formato com um PDF de exemplo; evite imagens de terceiros.

### Pontos a confirmar

- ⚠ O texto de ajuda do envio cita "PDF, AI, DXF ou foto" (`packBrief.dieline.hint`) e "PDF, AI, CDR" (`spRfq.dieline.hint`); a lista de tipos aceitos não traz DXF (traz AI, PSD, EPS, CDR, TIFF, ZIP, PDF e imagem). Confirmar se DXF é recusado e, se for, orientar a mandar ZIP.
- ⚠ A pendência só existe enquanto falta algum dos quatro itens; em pedido que já passou da arte, só cobra o die-cut que faltou.
- ⚠ Na primeira vez, o prazo costuma vir da cotação (item 4 já "Feito"); o vídeo diz "confirme" para não prometer isso.

---

## FOR-05 · Ficha de compra

> **Promessa:** ao final do vídeo você sabe preencher a ficha de compra do pedido, enviar as cinco fotos e entender o que falta para a Preparação concluir.

| Ficha                 |                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                           |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                   |
| Duração-alvo          | 4:30                                                                                                                 |
| Ponto da jornada      | Etapa 5 de 9: Preparação                                                                                              |
| Telas e rotas         | `/app` (etapa "Ficha de compra"), `/app/orders/[id]`, `/app/orders/[id]/purchase-sheet`                                |
| Dados antes de gravar | Pedido criado (etapa "Pedido pré-aprovado"), ficha ainda incompleta. Ponto `antes-FOR-05`                              |
| Depois deste vídeo    | Ficha completa (campos com * e 5 fotos) conclui o item "Ficha de compra"; o comprador e o cadastro da Wellmix validam; o peso líquido vira o peso comparado na inspeção |
| Antes · Próximo       | FOR-04 · FOR-06                                                                                                      |
| Idiomas               | pt (base), en, zh                                                                                                    |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: a etapa "Ficha de compra" em âmbar; linha "Pedido #1: Ficha de compra".
- 🎙 Narração: "O pedido nasceu. Agora a Wellmix precisa da ficha técnica da compra: caixa, pesos, medidas e fotos."
- 🔤 Na tela: `[TÍTULO]` "FOR-05 · Ficha de compra"; `[MAPA etapa 5]`.
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–0:40 · Abrir a ficha · `/app/orders/[id]` → `/purchase-sheet`**
- 🎬 Imagem: **Abrir**; na etapa **Preparação**, o item "Ficha de compra" com o botão **Preencher ficha de compra** (ou **Completar ficha (faltam N)** se já começou). A ficha abre.
- 🎙 Narração: "Abra o pedido e, na Preparação, clique em Preencher ficha de compra. Se já começou, o botão diz quantos itens faltam."
- 🔤 Na tela: `[PASSO 1/5] Abra a ficha`; `[BOTÃO] "Preencher ficha de compra"`.
- ✂️ Edição: `[CORTE]` na abertura da ficha.

**Cena 3 · 0:40–1:30 · O que falta e os blocos · `/purchase-sheet`**
- 🎬 Imagem: o aviso "Para concluir, falta: …" com cada item clicável; a tabela **Blocos da ficha** (Fornecedor, Produto, Caixa e embalagem, Preço e condições, Fotos), cada um "Completo" ou "Faltam: …"; o aviso "Ficha preenchida com a ficha mestre do produto (cadastro)".
- 🎙 Narração: "A ficha já vem preenchida com o que a Wellmix sabe do produto. Em vermelho está o que falta, bloco por bloco. Clique num item e a tela leva você ao campo."
- 🔤 Na tela: `[PASSO 2/5] Veja o que falta`; `[SETA]` "Vermelho = falta"; `[BOTÃO] "Mostrar tudo"` / "Um bloco por vez".
- ✂️ Edição: `[ZOOM 150 %]` na tabela de blocos.

**Cena 4 · 1:30–2:50 · Preencher os campos · `/purchase-sheet`**
- 🎬 Imagem: preencher: **Nome do fornecedor**, **FOB / EXW**, **Moeda**, **Preço por peça**, **MOQ**, **Peças por caixa master**, **CBM da caixa master** (ou as três medidas), **Embalagem (ex.: color box)**, **Peso líquido** e **Peso bruto por peça (kg)**, **Cor / sortimento**, **Material**. A tela avisa quando a caixa inner não fecha ou a medida parece em milímetros.
- 🎙 Narração: "Preencha os campos com asterisco: incoterm, moeda, preço, pedido mínimo, peças por caixa, cubagem, embalagem, pesos, cor e material. O peso líquido será o peso comparado na inspeção, então meça com cuidado."
- 🔤 Na tela: `[PASSO 3/5] Preencha os campos com *`; `[SETA]` "Peso líquido: comparado na inspeção"; `[ATENÇÃO]` "Medidas da caixa em centímetros"; `[QUEM VÊ]` "Programação de compra, despachante e e-commerce são da Wellmix".
- ✂️ Edição: digitação acelerada 2×.

**Cena 5 · 2:50–3:50 · As cinco fotos · `/purchase-sheet`**
- 🎬 Imagem: o quadro **Fotos**, uma linha por tipo: **Foto na balança**, **Foto com régua (medida com escala)**, **Foto da medida de lado**, **Foto de outro ângulo**, **Foto original (evidência)**. Clicar em **Adicionar fotos** em cada uma; a foto sobe na hora e a linha ganha a miniatura.
- 🎙 Narração: "Agora as cinco fotos: balança, régua, medida de lado, outro ângulo e a original. Cada foto sobe na hora, sem apagar o que você digitou. O cliente não vê estas fotos."
- 🔤 Na tela: `[PASSO 4/5] Envie as 5 fotos`; `[BOTÃO] "Adicionar fotos"`; `[QUEM VÊ]` "O cliente não vê estas fotos".
- ✂️ Edição: `[ZOOM 150 %]` nas miniaturas.

**Cena 6 · 3:50–4:30 · Salvar e depois · `/purchase-sheet`**
- 🎬 Imagem: clicar em **Salvar ficha**. "Ficha salva e completa." (ou "Ficha salva. Ainda falta: …"). Voltar ao pedido: o item "Ficha de compra" fica **Concluído**. Fundo vermelho com o resumo.
- 🎙 Narração: "Clique em Salvar ficha. Pode salvar quantas vezes quiser. Completa, o item fica concluído. A Wellmix valida e a Preparação termina. Próximo: a arte."
- 🔤 Na tela: `[PASSO 5/5] Salve a ficha`; `[BOTÃO] "Salvar ficha"`; `[DEPOIS]` "A Wellmix valida a ficha e as imagens; o cadastro valida o produto; então abre a Arte e embalagem."; `[RESUMO]` "1 Abra a ficha · 2 Veja o que falta · 3 Campos com * · 4 Cinco fotos · 5 Salve".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Aviso:** ficha salva incompleta. "Ficha salva. Ainda falta: {campos}." → **Correção:** preencha o que está em vermelho.
- **Erro:** valor ilegível. "Algum campo tem valor inválido. Confira números (sem letras), datas e NCM (só números e pontos)." → **Correção:** use só números.
- **Erro:** foto grande. "Foto grande demais. Tire de novo ou envie uma menor."; formato: "Formato não aceito: envie foto (JPG, PNG, WEBP, HEIC) ou PDF."; foto que não terminou: "A foto não terminou de subir. Escolha de novo (de preferência no Wi-Fi)."
- **Erro:** nenhuma foto escolhida. "Escolha ao menos uma foto."
- **Erro:** sem permissão. "Você não pode editar esta ficha."

### Passo a passo em texto

1. Em Pendências, na etapa **Ficha de compra**, clique em **Abrir**; no pedido, clique em **Preencher ficha de compra** (ou **Completar ficha**).
2. Veja o aviso do que falta e a tabela **Blocos da ficha**; clique num item para ir ao campo.
3. Preencha os campos com *: nome do fornecedor, **FOB / EXW**, **Moeda**, **Preço por peça**, **MOQ**, **Peças por caixa master**, medidas ou **CBM da caixa master**, **Embalagem**, **Peso líquido por peça (kg)**, **Peso bruto por peça (kg)**, **Cor / sortimento**, **Material**.
4. Envie as cinco fotos: balança, régua, lado, outro ângulo e original.
5. Clique em **Salvar ficha**. Com tudo completo, o item "Ficha de compra" é concluído.

### Legendas na tela em EN e ZH

| Marca                   | EN                                             | ZH                          |
| ----------------------- | ---------------------------------------------- | --------------------------- |
| Título da página        | Purchase sheet                                 | 采购单                      |
| Botões do pedido        | Fill in purchase sheet · Complete sheet ({count} missing) · View purchase sheet | 填写采购单 · 补全采购单（还缺 {count} 项） · 查看采购单 |
| Blocos                  | Supplier · Product · Carton and packaging · Price and terms · Photos | 供应商 · 产品 · 外箱和包装 · 价格和条款 · 照片 |
| Situação do bloco       | Complete · Missing: {fields}                   | 已完成 · 缺少：{fields}     |
| Campos                  | Supplier name · FOB / EXW · Currency · Price per piece | 供应商名称 · FOB / EXW · 币种 · 单价 |
| Campos                  | MOQ (minimum order, pieces) · Pieces per master carton | 起订量（件） · 每外箱件数 |
| Campos                  | Master carton CBM (m³) · Package (e.g. color box) | 外箱体积（立方米） · 包装（例如彩盒） |
| Campos                  | Net weight per piece (kg) · Gross weight per piece (kg) | 每件净重（千克） · 每件毛重（千克） |
| Campos                  | Color / assortment · Material                  | 颜色 / 搭配 · 材质          |
| Fotos                   | Photo on the scale · Photo with ruler (measure with scale) · Side measurement photo · Other angle photo · Original photo (evidence) | 称重照片 · 带尺子的照片（带刻度测量） · 侧面尺寸照片 · 其他角度照片 · 原始照片（证据） |
| Botão das fotos         | Add photos                                     | 添加照片                    |
| Botão final             | Save sheet                                     | 保存采购单                  |
| Sucesso                 | Sheet saved and complete.                      | 采购单已保存并完成。        |
| Parcial                 | Sheet saved. Still missing: {fields}.          | 采购单已保存。仍缺少：{fields}。 |
| Erro (valor)            | A field has an invalid value. Check numbers (no letters), dates and NCM (digits and dots only). | 有字段的值无效。请检查数字（不含字母）、日期和 NCM（仅数字和点）。 |
| PASSO 1/5 a 5/5         | Open the sheet · See what is missing · Fill in the fields with * · Send the 5 photos · Save | 打开采购单 · 看缺少什么 · 填写带 * 的字段 · 上传 5 张照片 · 保存 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | The order was created. Now Wellmix needs the purchase data sheet: carton, weights, measurements and photos. |
| 2 (0:10–0:40)  | Open the order and, in Preparation, click Fill in purchase sheet. If you already started, the button says how many items are missing. |
| 3 (0:40–1:30)  | The sheet already comes filled with what Wellmix knows about the product. Red marks what is missing, block by block. Click an item and the screen takes you to the field. |
| 4 (1:30–2:50)  | Fill in the fields with an asterisk: incoterm, currency, price, minimum order, pieces per carton, volume, packaging, weights, color and material. The net weight will be the weight compared at inspection, so measure carefully. |
| 5 (2:50–3:50)  | Now the five photos: scale, ruler, side measurement, another angle and the original. Each photo uploads right away, without erasing what you typed. The customer does not see these photos. |
| 6 (3:50–4:30)  | Click Save sheet. You can save as often as you like. When complete, the item is done. Wellmix validates and Preparation ends. Next: the artwork. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | 订单已经生成。现在 Wellmix 需要这次采购的技术资料：外箱、重量、尺寸和照片。 |
| 2 (0:10–0:40)  | 打开订单，在"备货准备"里点击"填写采购单"。如果已经填了一部分，按钮会显示还缺几项。 |
| 3 (0:40–1:30)  | 采购单已按 Wellmix 掌握的产品资料预填。红色表示缺少的内容，按区块列出。点击某一项，页面会带您到对应字段。 |
| 4 (1:30–2:50)  | 填写带星号的字段：贸易术语、币种、单价、起订量、每箱件数、体积、包装、重量、颜色和材质。净重会作为验货时的比对重量，请认真称量。 |
| 5 (2:50–3:50)  | 接着是五张照片：称重、带尺子、侧面尺寸、其他角度和原始照片。每张照片立即上传，不会清除您已填的内容。客户看不到这些照片。 |
| 6 (3:50–4:30)  | 点击"保存采购单"，可以随时保存。填写完整后，这一项就完成了。Wellmix 核对后，备货阶段结束。下一个视频：设计稿。 |

### Notas de gravação

- Use um pedido novo; a ficha vem pré-preenchida (ficha mestre, cotação ou pedido anterior). Para a cena 4 ser útil, apague 2 ou 3 campos antes.
- A **Programação de compra** (lotes, container, início da produção) **não aparece** para o fornecedor: é da Wellmix. O início da produção é automático depois do contrato assinado.
- Os blocos "Despachante (NCM e impostos)" e "Descrição para e-commerce" não aparecem para o fornecedor.
- A caixa com as três medidas dispensa o CBM; com o CBM informado, as medidas deixam de ser obrigatórias.
- Cada foto sobe na hora; mostre a miniatura. Use imagens próprias (nunca de terceiros).

### Pontos a confirmar

- ⚠ A tela da ficha traz o texto "…a Preparação se conclui sozinha" (`sheet.intro`), mas a Wellmix ainda valida a ficha e o cadastro depois (docs/PURCHASE_FLOW.md); o vídeo diz que "o item fica concluído".
- ⚠ A "programação de entregas" pedida pelo cliente aparece na cotação (tabela da solicitação), não na ficha do pedido do fornecedor. Confirmar se o fornecedor deve vê-la na ficha.
- ⚠ Rótulos de campo só nos dicionários en e zh acima; a gravação da ficha inteira em zh/en não foi feita nesta sessão (só os dados, as tabelas de blocos e o aviso "falta").

---

## FOR-06 · Aprovar ou reprovar a arte

> **Promessa:** ao final do vídeo você sabe conferir a arte da embalagem e aprová-la para a produção, ou reprová-la dizendo o que mudar.

| Ficha                 |                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                        |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                |
| Duração-alvo          | 3:00                                                                                                              |
| Ponto da jornada      | Etapa 5 de 9: Preparação (arte e embalagem)                                                                        |
| Telas e rotas         | `/app` (etapa "Aprovar a arte"), `/app/orders/[id]` (etapa Arte e embalagem)                                       |
| Dados antes de gravar | A agência (ou a Wellmix) já enviou a arte, e a etapa "Arte e embalagem" está aberta. Ponto `antes-FOR-06`           |
| Depois deste vídeo    | Aprovada, a etapa segue para a assinatura (FOR-07). Reprovada, a arte volta para quem a fez, com a observação e um aviso |
| Antes · Próximo       | FOR-05 · FOR-07                                                                                                   |
| Idiomas               | pt (base), en, zh                                                                                                 |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: o sino traz "Pedido #1: arte da embalagem para aprovar"; a etapa "Aprovar a arte" em âmbar.
- 🎙 Narração: "A arte da sua embalagem chegou. Você é o último a conferir: aprove para produzir, ou peça ajustes."
- 🔤 Na tela: `[TÍTULO]` "FOR-06 · Aprovar a arte"; `[MAPA etapa 5]`.
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–0:35 · Antes da arte chegar · `/app/orders/[id]`**
- 🎬 Imagem: no pedido, etapa "Arte e embalagem": o item "Aprovação da arte pelo fornecedor" com o texto "Aguardando a arte (agência ou Wellmix)". Não há botões e não é pendência.
- 🎙 Narração: "Enquanto a arte não chega, o item mostra Aguardando a arte. Você não precisa fazer nada, e o sistema não deixa aprovar antes."
- 🔤 Na tela: `[SETA]` "Aguardando a arte"; `[ATENÇÃO]` "Antes de a arte chegar, a aprovação é recusada."
- ✂️ Edição: `[ZOOM 150 %]` no texto de espera.

**Cena 3 · 0:35–1:25 · Conferir a arte · `/app/orders/[id]`**
- 🎬 Imagem: depois do aviso, o item "Arte da embalagem" mostra o arquivo (nome e versão, ex.: "arte.pdf (v1)"). Clicar no nome para abrir. Conferir: faca, textos, selo de certificação, cores.
- 🎙 Narração: "Abra a arte e confira com calma: ela segue a faca que você mandou, os textos estão corretos e o selo de certificação aparece. É isto que você vai imprimir."
- 🔤 Na tela: `[PASSO 1/4] Abra o arquivo da arte`; `[SETA]` "Arquivo e versão"; `[DICA]` "Se a arte voltar corrigida, a versão sobe (v2)."
- ✂️ Edição: `[ZOOM 150 %]` na arte aberta.

**Cena 4 · 1:25–2:05 · Aprovar · `/app/orders/[id]`**
- 🎬 Imagem: no item "Aprovação da arte pelo fornecedor", o campo **Observação** (opcional) e os botões **Aprovar** e **Reprovar**. Clicar em **Aprovar**: o item fica **Concluído**.
- 🎙 Narração: "Se está tudo certo, clique em Aprovar. A aprovação é a prova de que você aceita a arte para produzir. Depois de decidir, só a Wellmix pode refazer."
- 🔤 Na tela: `[PASSO 2/4] Clique em Aprovar`; `[BOTÃO] "Aprovar"`; `[ATENÇÃO]` "Esta aprovação já foi decidida; só a Wellmix pode refazer."
- ✂️ Edição: `[ZOOM 150 %]` nos botões.

**Cena 5 · 2:05–2:40 · Reprovar com observação · `/app/orders/[id]`**
- 🎬 Imagem: (outra tomada) digitar em **Observação** "Aumentar o logo na tampa" e clicar em **Reprovar**. O item fica **Reprovado** e a arte volta a quem a fez.
- 🎙 Narração: "Se algo está errado, escreva em Observação o que mudar e clique em Reprovar. A arte volta para quem a fez, com o seu recado, e você será avisado quando chegar a nova versão."
- 🔤 Na tela: `[PASSO 3/4] Escreva o que mudar e reprove`; `[BOTÃO] "Reprovar"`; `[DICA]` "Escreva sempre o que mudar: o sistema aceita reprovar sem observação, mas a agência precisa do recado."
- ✂️ Edição: tela dividida entre aprovar e reprovar.

**Cena 6 · 2:40–3:00 · Depois e resumo**
- 🎬 Imagem: fundo vermelho com a lista; miniatura do FOR-07.
- 🎙 Narração: "Aprovada a arte, o documento do pedido vai para assinatura. No próximo vídeo, você assina."
- 🔤 Na tela: `[DEPOIS]` "Reprovada: a arte volta com o seu recado. Aprovada: a Wellmix assina e depois você."; `[RESUMO]` "1 Abra a arte · 2 Aprove · 3 Ou reprove com observação · 4 A Wellmix refaz se precisar"; "Próximo: FOR-07".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** aprovar antes da arte. "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar."
- **Erro:** refazer a decisão. "Esta aprovação já foi decidida; só a Wellmix pode refazer."
- **Aviso:** etapa fechada. A aprovação só vale com a etapa aberta (`stage_not_active`).

### Passo a passo em texto

1. Abra o aviso "arte da embalagem para aprovar" ou a pendência **Aprovar a arte**.
2. No pedido, em **Arte e embalagem**, abra o arquivo em **Arte da embalagem** e confira.
3. Em **Aprovação da arte pelo fornecedor**, escreva uma **Observação** (opcional) e clique em **Aprovar**, ou em **Reprovar** dizendo o que mudar.
4. Reprovada, a arte volta para a agência (ou a Wellmix), com o seu recado; quando a nova arte chegar, você é avisado e aprova de novo.

### Legendas na tela em EN e ZH

| Marca                 | EN                                              | ZH                          |
| --------------------- | ----------------------------------------------- | --------------------------- |
| Etapa do pedido       | Artwork and packaging                           | 设计与包装                  |
| Etapa (pendência)     | Approve the artwork                             | 确认设计稿                  |
| Item da arte          | Packaging artwork                               | 包装设计稿                  |
| Item da aprovação     | Artwork approval by supplier                    | 供应商审核设计稿            |
| Espera                | Waiting for the artwork (agency or Wellmix)     | 等待设计稿（设计公司或 Wellmix） |
| Campo                 | Note                                            | 备注                        |
| Botões                | Approve · Reject                                | 批准 · 驳回                 |
| Situações             | Pending · Done · Rejected                       | 待处理 · 已完成 · 已驳回    |
| Aviso (sino)          | Order #{n}: packaging artwork to approve        | 订单 #{n}：包装稿待审批     |
| Texto do aviso        | The artwork was uploaded. Check it and approve it for production, or reject it with a note. | 包装稿已上传。请核对并批准投产，或附说明驳回。 |
| Erro (cedo)           | The artwork has not been uploaded yet: the supplier approves it once it arrives. | 设计稿尚未上传：上传后由供应商审核批准。 |
| Erro (decidida)       | This approval was already decided; only Wellmix can redo it. | 该审批已作出决定；只有 Wellmix 可以重新处理。 |
| PASSO 1/4 a 3/4       | Open the artwork file · Click Approve · Write what to change and reject | 打开设计稿文件 · 点击"批准" · 写明修改意见并驳回 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | The artwork for your packaging has arrived. You are the last to check it: approve it for production, or ask for changes. |
| 2 (0:10–0:35)  | While the artwork has not arrived, the item says Waiting for the artwork. You do nothing, and the system does not let you approve early. |
| 3 (0:35–1:25)  | Open the artwork and check it calmly: it follows the die-cut you sent, the texts are right and the certification seal appears. This is what you will print. |
| 4 (1:25–2:05)  | If everything is right, click Approve. Your approval proves you accept the artwork for production. Once decided, only Wellmix can redo it. |
| 5 (2:05–2:40)  | If something is wrong, write in Note what to change and click Reject. The artwork goes back to whoever made it, with your message, and you are notified when the new version arrives. |
| 6 (2:40–3:00)  | Once the artwork is approved, the order document goes for signature. In the next video, you sign. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | 您的包装设计稿到了。您是最后一道核对：批准投产，或者要求修改。 |
| 2 (0:10–0:35)  | 设计稿到达之前，这一项显示"等待设计稿"。您不用做任何事，系统也不允许提前批准。 |
| 3 (0:35–1:25)  | 打开设计稿，仔细核对：是否按您上传的刀模制作，文字是否正确，认证标志是否出现。这就是您要印刷的内容。 |
| 4 (1:25–2:05)  | 一切无误，点击"批准"。您的批准，就是接受设计稿投产的依据。一旦决定，只有 Wellmix 可以重新处理。 |
| 5 (2:05–2:40)  | 如果有问题，在"备注"里写明要修改的地方，点击"驳回"。设计稿会带着您的意见退回制作方，新版本到达时，您会收到通知。 |
| 6 (2:40–3:00)  | 设计稿批准后，订单文件进入签署。下一个视频，您来签署。 |

### Notas de gravação

- A etapa só abre depois da Preparação; antes, o item aparece em "pendente" sem botões.
- Grave a reprovação numa cópia do ponto de salvamento (depois de reprovar, a arte volta e é preciso reenviá-la).
- O arquivo da arte aceita PDF, imagem, AI, PSD, EPS, CDR, TIFF; o fornecedor abre o arquivo da arte do **seu** pedido; outro fornecedor e o cliente não.
- Sem agência no pedido (ou com "arte feita pela Wellmix"), a Wellmix envia a arte.

### Pontos a confirmar

- ⚠ O servidor **aceita reprovar sem observação** (a nota é opcional no código); o texto de ajuda do sistema diz "reprove dizendo o que mudar". A cena 5 recomenda escrever; confirmar com o dono se a observação deve ser obrigatória.
- ⚠ A mensagem exata que o fornecedor recebe quando a arte é refeita não foi verificada; o texto diz que ele é avisado "quando a arte chega" (docs/WORKFLOW.md).
- ⚠ "Aprovar a arte" aparece como pendência só depois que a arte chega; o aviso vem do sino (`notif.artwork`).

---

## FOR-07 · Assinar o documento do pedido

> **Promessa:** ao final do vídeo você sabe conferir o documento do pedido e assiná-lo de duas formas: no portal ou com o PDF assinado.

| Ficha                 |                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                       |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                               |
| Duração-alvo          | 4:00                                                                                                             |
| Ponto da jornada      | Etapa 5 de 9: Preparação (assinatura do pedido)                                                                   |
| Telas e rotas         | `/app` (etapa "Assinar o pedido"), `/app/orders/[id]/purchase-order`, `/api/orders/[id]/purchase-order` (PDF)      |
| Dados antes de gravar | Arte enviada, selo aplicado, documento **enviado para assinatura** e **assinado pela Wellmix**. Ponto `antes-FOR-07` |
| Depois deste vídeo    | Assinado pelos dois, o pedido está autorizado e vai ao Sankhya (com integração, o número volta sozinho; sem ela, a Wellmix gera e informa). A Wellmix é avisada |
| Antes · Próximo       | FOR-06 · FOR-08                                                                                                  |
| Idiomas               | pt (base), en, zh                                                                                                |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: a etapa "Assinar o pedido" em âmbar; linha com o atalho direto ao documento.
- 🎙 Narração: "A Wellmix já assinou. Agora é a sua vez de assinar o documento do pedido: produto, quantidade, preço e prazo."
- 🔤 Na tela: `[TÍTULO]` "FOR-07 · Assinar o documento do pedido"; `[MAPA etapa 5]`.
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–0:40 · A ordem das assinaturas · `/purchase-order`**
- 🎬 Imagem: a página **Documento do pedido #1**. Antes do envio, a faixa "Em preparação: vai para assinatura depois da arte e do selo" e o texto "Primeiro a agência conclui a arte e aplica o selo; depois a Wellmix assina e você assina em seguida." Depois do envio e da assinatura da Wellmix, o quadro **Sua vez de assinar**.
- 🎙 Narração: "A ordem é fixa: arte, selo, Wellmix e depois você. Antes da vez da Wellmix, a página avisa que ainda não dá para assinar. Quando chegar a sua, aparece o quadro Sua vez de assinar."
- 🔤 Na tela: `[PASSO 1/5] Espere a sua vez`; `[SETA]` "Quadro: Sua vez de assinar"; `[QUEM VÊ]` "Só a Wellmix e o fornecedor do pedido abrem este documento".
- ✂️ Edição: `[ZOOM 150 %]` na faixa de situação.

**Cena 3 · 0:40–1:25 · Conferir o documento · `/purchase-order`**
- 🎬 Imagem: o cursor percorre **Comprador**, **Fornecedor**, a tabela (Produto, Quantidade, Preço por unidade, Total), **Pedido mínimo (MOQ)**, **Prazo de produção**, **Condição de pagamento** (30 % no pedido e 70 % 90 dias depois da entrega) e, se houver, **Embalagem**. No rodapé, **Versão do documento**.
- 🎙 Narração: "Confira cada ponto: produto, quantidade, preço por unidade, pedido mínimo, prazo e condição de pagamento. A versão do documento fica registrada na sua assinatura."
- 🔤 Na tela: `[PASSO 2/5] Confira o documento`; `[SETA]` "Preço por unidade e total"; `[SETA]` "Condição de pagamento"; `[ATENÇÃO]` "Se algo estiver errado, fale com a Wellmix antes de assinar."
- ✂️ Edição: `[ZOOM 150 %]` na tabela; 3 s.

**Cena 4 · 1:25–2:25 · Opção 1: assinar no portal · `#assinar`**
- 🎬 Imagem: no quadro, **Opção 1: assinar aqui no portal**: **Seu nome completo** (já vem preenchido), marcar "Li o documento acima e concordo…" e clicar em **Assinar o documento**. Aparece "Assinatura registrada."
- 🎙 Narração: "Opção um: assinar aqui no portal. Confira seu nome, marque que leu e concorda e clique em Assinar o documento. O sistema grava seu nome, seu login, a data e a versão. É um aceite no portal, não um certificado digital."
- 🔤 Na tela: `[PASSO 3/5] Assine no portal`; `[BOTÃO] "Assinar o documento"`; `[ATENÇÃO]` "É um aceite no portal, não um certificado digital."
- ✂️ Edição: `[ZOOM 150 %]` na caixa de aceite.

**Cena 5 · 2:25–3:25 · Opção 2: enviar o PDF assinado · `#assinar`**
- 🎬 Imagem: ao lado, **Opção 2: enviar o documento assinado**: clicar em **Baixar o documento em PDF**, mostrar o PDF (folha do pedido com os quadros de assinatura), "assinar e carimbar" no papel, voltar e clicar em **Enviar o documento assinado (PDF ou foto)**. Ao escolher o arquivo, a assinatura é registrada e o arquivo fica no pedido.
- 🎙 Narração: "Opção dois: baixe o PDF, assine e carimbe no quadro e envie de volta, em PDF ou foto. Ao escolher o arquivo, a assinatura já fica registrada. Arquivo errado? A Wellmix pode devolver para você assinar de novo."
- 🔤 Na tela: `[PASSO 4/5] Ou envie o PDF assinado`; `[BOTÃO] "Baixar o documento em PDF"`; `[BOTÃO] "Enviar o documento assinado (PDF ou foto)"`; `[QUEM VÊ]` "O arquivo assinado tem o preço de compra: só a Wellmix e você o abrem."
- ✂️ Edição: mostrar o PDF 3 s; `[CORTE]` no envio.

**Cena 6 · 3:25–4:00 · Depois e resumo**
- 🎬 Imagem: a seção **Assinaturas** com os dois lados "…, em …" e o selo "Assinado pelos dois: pedido autorizado, falta gerar no Sankhya". Fundo vermelho com o resumo; miniatura do FOR-08.
- 🎙 Narração: "Assinado pelos dois, o pedido está autorizado e a produção pode começar. A Wellmix é avisada. Próximo vídeo: produção e inspeção."
- 🔤 Na tela: `[DEPOIS]` "A Wellmix é avisada; o pedido vai ao Sankhya e o início da produção passa a contar."; `[RESUMO]` "1 Espere a sua vez · 2 Confira · 3 Assine no portal · 4 Ou envie o PDF assinado"; "Próximo: FOR-08".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** assinar antes da Wellmix. "A Wellmix assina primeiro. Aguarde a assinatura dela."
- **Erro:** documento ainda não enviado. "O documento ainda não foi enviado para assinatura (falta a arte, o selo ou o envio)."
- **Erro:** nome curto. "Digite o nome completo (pelo menos 3 letras)."
- **Erro:** sem aceite. "Marque que leu e concorda para assinar."
- **Erro:** arquivo inválido. "O arquivo assinado precisa ser PDF ou foto (JPG, PNG ou WebP)." / "O arquivo assinado não chegou. Envie de novo."
- **Erro:** o pedido mudou enquanto lia. "O pedido mudou enquanto você lia. Confira o documento de novo e assine."
- **Aviso:** já assinou. "Este documento já foi assinado por este lado."

### Passo a passo em texto

1. Em Pendências, na etapa **Assinar o pedido**, clique em **Abrir** (ou abra **Ver o documento do pedido** no pedido).
2. Confira produto, quantidade, preço, MOQ, prazo e condição de pagamento.
3. No quadro **Sua vez de assinar**, escolha: **Opção 1** (assinar no portal): confira o nome, marque "Li o documento…" e clique em **Assinar o documento**.
4. Ou **Opção 2**: clique em **Baixar o documento em PDF**, assine e carimbe, e clique em **Enviar o documento assinado (PDF ou foto)**.
5. Veja "Assinatura registrada." e a seção **Assinaturas**.

### Legendas na tela em EN e ZH

| Marca               | EN                                              | ZH                              |
| ------------------- | ----------------------------------------------- | ------------------------------- |
| Etapa               | Sign the order                                  | 签署订单                        |
| Título da página    | Order document #{n}                             | 订单文件 #{n}                   |
| Situação            | In preparation: goes for signature after the artwork and the seal | 准备中：设计稿和认证标志完成后发送签署 |
| Quadro              | Your turn to sign                               | 轮到您签署                      |
| Opção 1             | Option 1: sign here in the portal               | 方式一：在平台上直接签署        |
| Opção 2             | Option 2: send the signed document              | 方式二：上传已签署的文件        |
| Campos              | Your full name · Order document · Total · Production lead time · Payment terms | 您的全名 · 订单文件 · 合计 · 生产交期 · 付款条件 |
| Aceite              | I have read the document above and agree with product, quantity, price, lead time and payment terms. | 我已阅读上述文件，并同意产品、数量、价格、交期和付款条件。 |
| Botão 1             | Sign the document                               | 签署文件                        |
| Botão PDF           | Download the document as PDF                    | 下载 PDF 文件                   |
| Botão arquivo       | Send the signed document (PDF or photo)         | 上传已签署的文件（PDF 或照片）  |
| Sucesso             | Signature registered.                           | 签署已登记。                    |
| Nota                | It is an acceptance in the portal, not a digital certificate. | 这是系统内的确认，不是数字证书。 |
| Esperar Wellmix     | Wellmix has not signed yet. You sign after them. | Wellmix 尚未签署。请在其之后签署。 |
| Estado final        | Signed by both: order authorized, still to be created in Sankhya | 双方已签署：订单已授权，尚待在 Sankhya 生成 |
| PASSO 1/5 a 4/5     | Wait for your turn · Check the document · Sign in the portal · Or send the signed PDF | 等待轮到您 · 核对文件 · 在平台签署 · 或上传已签署的 PDF |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix has already signed. Now it is your turn to sign the order document: product, quantity, price and lead time. |
| 2 (0:10–0:40)  | The order is fixed: artwork, seal, Wellmix, then you. Before Wellmix's turn, the page says you cannot sign yet. When yours comes, the box Your turn to sign appears. |
| 3 (0:40–1:25)  | Check each point: product, quantity, unit price, minimum order, lead time and payment terms. The document version is recorded with your signature. |
| 4 (1:25–2:25)  | Option one: sign here in the portal. Check your name, tick that you read and agree, and click Sign the document. The system records your name, login, date and version. It is an acceptance in the portal, not a digital certificate. |
| 5 (2:25–3:25)  | Option two: download the PDF, sign and stamp it in the box, and send it back as PDF or photo. When you choose the file, the signature is recorded. Wrong file? Wellmix can return it for you to sign again. |
| 6 (3:25–4:00)  | Signed by both, the order is authorized and production can start. Wellmix is notified. Next video: production and inspection. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix 已经签署。现在轮到您签署订单文件：产品、数量、价格和交期。 |
| 2 (0:10–0:40)  | 顺序是固定的：设计稿、认证标志、Wellmix，然后是您。在 Wellmix 之前，页面会提示您还不能签署。轮到您时，会出现"轮到您签署"。 |
| 3 (0:40–1:25)  | 逐项核对：产品、数量、单价、起订量、交期和付款条件。文件版本会随您的签署一起记录。 |
| 4 (1:25–2:25)  | 方式一：在平台上直接签署。核对姓名，勾选已阅读并同意，点击"签署文件"。系统会记录您的姓名、登录账号、日期和版本。这是系统内的确认，不是数字证书。 |
| 5 (2:25–3:25)  | 方式二：下载 PDF，在方框内签字盖章，再以 PDF 或照片上传。选择文件后，签署即被记录。文件有误？Wellmix 可以退回，让您重新签署。 |
| 6 (3:25–4:00)  | 双方签署后，订单即获授权，可以开始生产。Wellmix 会收到通知。下一个视频：生产与验货。 |

### Notas de gravação

- A página mostra três situações em sequência: "Em preparação" (antes do envio), "A Wellmix ainda não assinou. Você assina depois dela." e "Sua vez de assinar". Grave as três ou escolha a segunda e a terceira.
- O quadro "Sua vez" só aparece para o fornecedor **depois** da assinatura da Wellmix.
- O PDF baixado é a folha do pedido no modelo da Wellmix (rótulos em inglês e português).
- No alto da página, "Suas pendências neste pedido" lista outras pendências do pedido.

### Pontos a confirmar

- ⚠ O PDF omite caracteres fora do alfabeto latino (docs/ORDER_SIGNATURE.md, seção 7): nomes em chinês podem sair em branco. Conferir um PDF real com o nome do fornecedor.
- ⚠ O botão do portal chama-se "Assinar o documento", mas a ajuda diz "toque em Assinar" (`orderSign.option.portal.hint`).
- ⚠ Preencher o MOQ: no teste, "Pedido mínimo (MOQ)" saiu "—" porque o pedido mínimo ainda não tinha sido confirmado no Die Cut; mostrar o episódio com o MOQ preenchido (FOR-04 antes).
- ⚠ Fluxo do papel sem aceite no portal (assinatura por fora) é só do administrador; o vídeo não o ensina.

---

## FOR-08 · Produção e inspeção

> **Promessa:** ao final do vídeo você sabe manter o início e o ETD atualizados, enviar as fotos e o peso do produto pronto e responder a um SKU reprovado.

| Ficha                 |                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                                 |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                         |
| Duração-alvo          | 4:30                                                                                                                       |
| Ponto da jornada      | Etapa 6 de 9: Inspeção                                                                                                      |
| Telas e rotas         | `/app` (etapa "Produção e inspeção"), `/app/orders/[id]#production`, `/app/orders/[id]` (etapa Inspeção)                    |
| Dados antes de gravar | Pedido assinado pelos dois; a etapa **Inspeção** aberta. Para a cena 5, um SKU reprovado pela Wellmix. Ponto `antes-FOR-08` |
| Depois deste vídeo    | Tudo dentro da tolerância: a etapa Inspeção conclui e abre o Embarque. Divergência: a etapa **bloqueia** e a Wellmix revisa |
| Antes · Próximo       | FOR-07 · FOR-09                                                                                                            |
| Idiomas               | pt (base), en, zh                                                                                                          |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: a etapa "Produção e inspeção" em âmbar, com a linha do pedido.
- 🎙 Narração: "O produto está pronto? Mostre à Wellmix com fotos e o peso medido. É assim que a produção libera o embarque."
- 🔤 Na tela: `[TÍTULO]` "FOR-08 · Produção e inspeção"; `[MAPA etapa 6]`.
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–1:10 · O cartão Produção · `/app/orders/[id]#production`**
- 🎬 Imagem: o cartão **Produção**, numa linha: **Fornecedor é** (Fábrica ou Trade), **Início da produção** (automático depois do contrato assinado), **ETD (saída prevista)**, **Fábrica**, **Endereço da fábrica**; botão **Salvar produção**. Mudar o ETD pede **Motivo da mudança do ETD**, e "Primeiro ETD: …" mostra a diferença em dias.
- 🎙 Narração: "No cartão Produção, diga se você é fábrica ou trade, informe o ETD, a saída prevista, e o endereço da fábrica. Se o ETD mudar, escreva o motivo: a Wellmix é avisada. Mantenha tudo atualizado."
- 🔤 Na tela: `[PASSO 1/5] Informe fábrica e ETD`; `[BOTÃO] "Salvar produção"`; `[ATENÇÃO]` "Mudar o ETD exige motivo."; `[DICA]` "Trade: informe a fábrica e o endereço onde se inspeciona."
- ✂️ Edição: `[ZOOM 150 %]` no ETD.

**Cena 3 · 1:10–1:50 · Follow e inspeção agendada · `#production`**
- 🎬 Imagem: a tabela **Follow da produção** (5, 15 e 25 dias: "Ainda não", "Fazer agora", "No prazo", "Atrasado") e **Inspeção** ("Agendada para …"). Quem registra é a Wellmix.
- 🎙 Narração: "A Wellmix acompanha a produção com follows aos cinco, quinze e vinte e cinco dias, e agenda a inspeção. Você vê tudo aqui e é avisado da data."
- 🔤 Na tela: `[PASSO 2/5] Acompanhe os follows`; `[QUEM VÊ]` "O follow e a data da inspeção são registrados pela Wellmix."
- ✂️ Edição: corte seco.

**Cena 4 · 1:50–3:20 · Fotos e peso do produto pronto · `/app/orders/[id]` (etapa Inspeção)**
- 🎬 Imagem: na etapa **Inspeção**: **Foto sem embalagem**, **Foto com embalagem**, **Foto na balança** (botão "Tirar ou escolher foto") e **Peso medido (kg)** (campo numérico + Enviar). Opcionais: peso bruto, comprimento, largura, altura, CBM da caixa master, unidades por caixa master e por inner, material e cor encontrados.
- 🎙 Narração: "Na etapa Inspeção, envie as fotos do produto sem e com embalagem, a foto na balança e digite o peso medido. Se quiser, informe também medidas, caixa, material e cor. Informe o que encontrou, sem consultar a ficha."
- 🔤 Na tela: `[PASSO 3/5] Envie fotos e o peso`; `[BOTÃO] "Tirar ou escolher foto"`; `[SETA]` "Peso medido (kg)"; `[QUEM VÊ]` "Inspeção cega: você nunca vê o valor esperado."
- ✂️ Edição: `[ZOOM 150 %]` nos quatro itens obrigatórios; digitação em tempo real.

**Cena 5 · 3:20–4:00 · Divergência e correção · `#production` / etapa Inspeção**
- 🎬 Imagem: (a) peso muito diferente do esperado: a etapa mostra "Divergência detectada; aguardando revisão da Wellmix." (sem os valores esperados); (b) no cartão, um SKU **Reprovado** com a observação da Wellmix e o campo **O que foi corrigido** + **Enviar correção**; mostrar "Correção enviada à Wellmix."
- 🎙 Narração: "Se o peso ou as medidas fogem da tolerância, a etapa fica bloqueada até a Wellmix revisar. Nunca mostramos o valor esperado. Se um SKU for reprovado, diga o que corrigiu e envie a correção para uma nova inspeção."
- 🔤 Na tela: `[PASSO 4/5] Divergência? Aguarde a revisão`; `[PASSO 5/5] SKU reprovado: envie a correção`; `[BOTÃO] "Enviar correção"`; `[ATENÇÃO]` "Nova medição dentro da tolerância libera sozinha."
- ✂️ Edição: tela dividida (a) e (b).

**Cena 6 · 4:00–4:30 · Depois e resumo**
- 🎬 Imagem: a etapa Inspeção **Concluída** e o Embarque aberto. Fundo vermelho com o resumo; miniatura do FOR-09.
- 🎙 Narração: "Aprovada a inspeção, o embarque se abre. Resumindo: mantenha ETD e fábrica, envie fotos e peso e responda às correções. Próximo: embarque e documentos."
- 🔤 Na tela: `[DEPOIS]` "Dentro da tolerância: a etapa conclui e o embarque abre. Fora: a Wellmix revisa."; `[RESUMO]` "1 ETD e fábrica · 2 Fotos sem e com embalagem · 3 Foto na balança · 4 Peso medido · 5 Correção de SKU"; "Próximo: FOR-09".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** mudar o ETD sem motivo. "Informe o motivo da mudança do ETD."
- **Erro:** trade sem fábrica. "Fornecedor trade: informe o endereço da fábrica antes de agendar."
- **Aviso:** peso fora da tolerância. "Divergência detectada; aguardando revisão da Wellmix."
- **Erro:** correção em branco. O campo "O que foi corrigido" é obrigatório (a tela não envia vazio).
- **Erro:** enviar fora da etapa aberta: o sistema recusa; espere a etapa abrir.

### Passo a passo em texto

1. Em Pendências, na etapa **Produção e inspeção**, clique em **Abrir**.
2. No cartão **Produção**, escolha **Fornecedor é** (Fábrica ou Trade), confira **Início da produção**, informe o **ETD (saída prevista)**, **Fábrica** e **Endereço da fábrica** e clique em **Salvar produção**. Se mudar o ETD, escreva o **Motivo da mudança do ETD**.
3. Acompanhe os follows de 5, 15 e 25 dias e a **Inspeção** agendada (registrados pela Wellmix).
4. Na etapa **Inspeção**, envie **Foto sem embalagem**, **Foto com embalagem**, **Foto na balança** e **Peso medido (kg)**. Opcionais: medidas, caixa, material e cor encontrados.
5. Se um SKU for **Reprovado**, escreva **O que foi corrigido** e clique em **Enviar correção**.
6. Se o sistema avisar de divergência, aguarde a revisão da Wellmix.

### Legendas na tela em EN e ZH

| Marca                | EN                                              | ZH                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------- |
| Etapa                | Production and inspection                       | 生产与验货                          |
| Cartão               | Production                                      | 生产                                |
| Campos               | Supplier is · Production start · ETD (estimated departure) | 供应商类型 · 开始生产 · 预计离港日（ETD） |
| Tipos                | Factory · Trading company                       | 工厂 · 贸易公司                     |
| Fábrica              | Factory · Factory address                       | 工厂 · 工厂地址                     |
| Motivo               | Reason for the ETD change (required when changing) | ETD 变更原因（变更时必填）       |
| Botão                | Save production                                 | 保存生产信息                        |
| Follow               | Production follow-up · On track · Delayed · Due now · Not yet | 生产跟进 · 按期 · 延误 · 现在跟进 · 未到期 |
| Inspeção             | Inspection · Scheduled for {date}               | 验货 · 已安排于 {date}              |
| Itens                | Photo without packaging · Photo with packaging · Photo on the scale · Measured weight (kg) | 无包装照片 · 带包装照片 · 称重照片 · 实测重量（kg） |
| Botão                | Take or choose photo                            | 拍照或选择照片                      |
| SKU                  | Inspection per SKU · Approved · Rejected        | 按 SKU 验货 · 通过 · 不通过         |
| Correção             | What was fixed · Send fix                       | 整改内容 · 提交整改                 |
| Sucesso              | Fix sent to Wellmix.                            | 整改已提交给 Wellmix。              |
| Divergência          | Divergence detected; waiting for Wellmix review. | 检测到差异，等待 Wellmix 复核。    |
| Erro ETD             | Enter the reason for the ETD change.            | 请填写 ETD 变更原因。               |
| Erro trade           | Trading supplier: enter the factory address before scheduling. | 贸易公司：安排验货前请填写工厂地址。 |
| Dica                 | Keep the start and ETD up to date; Wellmix is notified when the ETD changes. | 请及时更新开始生产日期和 ETD；ETD 变更会通知 Wellmix。 |
| PASSO 1/5 a 5/5      | Enter factory and ETD · Follow the follow-ups · Send photos and weight · Divergence? Wait for the review · Rejected SKU: send the fix | 填写工厂和 ETD · 关注跟进 · 上传照片和重量 · 有差异？等待复核 · SKU 不通过：提交整改 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Is the product ready? Show Wellmix with photos and the measured weight. That is how production releases shipment. |
| 2 (0:10–1:10)  | In the Production card, say whether you are a factory or a trading company, enter the ETD, the estimated departure, and the factory address. If the ETD changes, write the reason: Wellmix is notified. Keep everything up to date. |
| 3 (1:10–1:50)  | Wellmix follows production with follow-ups at five, fifteen and twenty-five days, and schedules the inspection. You see it all here and are told the date. |
| 4 (1:50–3:20)  | In the Inspection step, send the photos of the product without and with packaging, the photo on the scale, and type the measured weight. If you like, also enter measurements, carton, material and color. Report what you found, without checking the sheet. |
| 5 (3:20–4:00)  | If the weight or measurements fall outside the tolerance, the step is blocked until Wellmix reviews it. We never show the expected value. If an SKU is rejected, say what you fixed and send the fix for a new inspection. |
| 6 (4:00–4:30)  | Once inspection is approved, shipment opens. To sum up: keep ETD and factory up to date, send photos and weight and answer the fixes. Next: shipment and documents. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | 产品做好了吗？用照片和实测重量告诉 Wellmix。生产就是这样放行装运的。 |
| 2 (0:10–1:10)  | 在"生产"卡片里，说明您是工厂还是贸易公司，填写预计离港日（ETD）和工厂地址。如果 ETD 有变化，请写明原因，Wellmix 会收到通知。请随时更新。 |
| 3 (1:10–1:50)  | Wellmix 在第五、十五和二十五天跟进生产，并安排验货。您可以在这里看到全部内容，也会收到验货日期的通知。 |
| 4 (1:50–3:20)  | 在"验货"环节，上传产品的无包装照片、带包装照片和称重照片，并填写实测重量。需要的话，还可以填写尺寸、外箱、材质和颜色。请填写您实际看到的，不用对照资料表。 |
| 5 (3:20–4:00)  | 如果重量或尺寸超出容差，环节会被锁定，直到 Wellmix 复核。我们不会显示期望值。如果某个 SKU 不通过，请说明整改内容并提交，等待再次验货。 |
| 6 (4:00–4:30)  | 验货通过后，装运环节开启。小结：及时更新 ETD 和工厂，上传照片和重量，回复整改。下一个视频：装运和文件。 |

### Notas de gravação

- Tolerâncias padrão (docs/OPEN_DECISIONS.md): peso 3 %, medidas 5 %, CBM e peso bruto 5 %, unidades por caixa 0 %. Não cite na narração (são configuráveis); mostre só a mensagem.
- Para a cena 5(a), meça um peso bem diferente do esperado e deixe a etapa bloquear; o "esperado" nunca aparece para o fornecedor.
- A cena 5(b) precisa de o SKU ter sido reprovado pela Wellmix (cartão Produção).
- O **Início da produção** é automático depois do contrato assinado (o campo fica desabilitado).

### Pontos a confirmar

- ⚠ A ordem real na tela do pedido: cartão **Produção** e etapa **Inspeção** são partes diferentes da página; o vídeo as mostra em sequência. Conferir a posição na gravação (a captura de teste mostrou a Produção embaixo da tabela de etapas).
- ⚠ Não foi possível gravar a etapa Inspeção em zh/en nesta sessão (a sequência até a inspeção não foi percorrida); as frases vêm dos dicionários.
- ⚠ O botão exato para reenviar o peso medido depois de aprovado e o nome de "nova medição" (`remeasureAction`) não foram verificados em tela.

---

## FOR-09 · Embarque e documentos

> **Promessa:** ao final do vídeo você sabe quais documentos do embarque são seus (conferir e devolver assinada a invoice e o packing list) e o que você nunca vê.

| Ficha                 |                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                              |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                      |
| Duração-alvo          | 3:30                                                                                                                    |
| Ponto da jornada      | Etapa 7 de 9: Embarque e mar                                                                                            |
| Telas e rotas         | `/app` (etapa "Embarque"), `/app/orders/[id]#import-flow` (cartão "Embarque e desembaraço")                              |
| Dados antes de gravar | Pedido na Inspeção ou além; o comex enviou "Invoice e packing list". Ponto `antes-FOR-09`                                |
| Depois deste vídeo    | O comex valida a invoice assinada; depois seguem desembaraço, transporte e entrega, sem ação sua                          |
| Antes · Próximo       | FOR-08 · FOR-10                                                                                                         |
| Idiomas               | pt (base), en, zh                                                                                                       |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**
- 🎬 Imagem: a etapa "Embarque" em âmbar com a linha "Validar Invoice e packing list: pedido #1".
- 🎙 Narração: "A carga vai embarcar. Falta só conferir a invoice e o packing list, e devolver assinados."
- 🔤 Na tela: `[TÍTULO]` "FOR-09 · Embarque e documentos"; `[MAPA etapa 7]`.
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–0:50 · O cartão Embarque e desembaraço · `#import-flow`**
- 🎬 Imagem: **Abrir**; o cartão **Embarque e desembaraço** mostra só os passos que você vê: **Booking**, **Draft do BL**, **Invoice e packing list**, **Invoice e packing assinados** e **BL (original)**, cada um com situação, "Faz: … · valida: …", valor e arquivo.
- 🎙 Narração: "O cartão lista os passos do embarque que dizem respeito a você: booking, draft do BL, invoice e packing list, a invoice assinada e o BL original. O resto do desembaraço você nunca vê."
- 🔤 Na tela: `[PASSO 1/4] Abra o cartão Embarque`; `[QUEM VÊ]` "O fornecedor nunca abre numerário, DI, CE Mercante nem comprovante de importação."; `[SETA]` "Faz · valida".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Quem faz / valida".

**Cena 3 · 0:50–1:50 · Validar a invoice e o packing list · `#import-flow`**
- 🎬 Imagem: na linha **Invoice e packing list** (feita pelo comex, validada por você): abrir o arquivo (link **Arquivo**), conferir quantidades, preços, caixas e pesos. Escrever em "Motivo (obrigatório para recusar)" só se recusar. Clicar em **Validar** (ou **Recusar**).
- 🎙 Narração: "Primeiro, o comex envia a invoice e o packing list. Abra o arquivo e confira quantidade, preço, caixas e pesos. Estando certo, clique em Validar. Se algo está errado, escreva o motivo e clique em Recusar."
- 🔤 Na tela: `[PASSO 2/4] Confira e valide`; `[BOTÃO] "Validar"`; `[BOTÃO] "Recusar"`; `[ATENÇÃO]` "Para recusar, o motivo é obrigatório."
- ✂️ Edição: `[ZOOM 150 %]` no arquivo e nos botões.

**Cena 4 · 1:50–2:50 · Devolver a invoice assinada · `#import-flow`**
- 🎬 Imagem: depois de validar, a linha **Invoice e packing assinados** destrava ("Depois de: Invoice e packing list" some). Escolher o arquivo assinado e clicar em **Enviar** (ou **Enviar de novo** se foi recusado). A situação vira "Enviado, aguardando validação".
- 🎙 Narração: "Validou? Agora a linha da invoice assinada abre. Assine e carimbe, escolha o arquivo e clique em Enviar. O comex valida em seguida. Se ele recusar, você vê o motivo e envia de novo."
- 🔤 Na tela: `[PASSO 3/4] Envie a invoice assinada`; `[BOTÃO] "Enviar"`; `[SETA]` "Enviado, aguardando validação"; `[DICA]` "Recusado: o motivo aparece em vermelho; corrija e use Enviar de novo."
- ✂️ Edição: `[CORTE]` no envio.

**Cena 5 · 2:50–3:30 · Depois e resumo**
- 🎬 Imagem: o texto "Depois do embarque (desembaraço, transporte e entrega ao cliente) nada depende de você. Para acompanhar, abra Pedidos." Fundo vermelho com o resumo; miniatura do FOR-10.
- 🎙 Narração: "Com a invoice assinada e validada, o embarque segue. Depois dele, nada mais depende de você. Próximo vídeo: sua conta corrente e os pagamentos."
- 🔤 Na tela: `[DEPOIS]` "Comex valida; companhia marítima confirma o embarque; desembaraço e entrega são da Wellmix e dos parceiros."; `[RESUMO]` "1 Abra o cartão · 2 Valide invoice e packing list · 3 Devolva assinada · 4 O resto não é seu"; "Próximo: FOR-10".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** enviar fora de ordem. "Conclua antes o passo anterior."
- **Erro:** enviar sem arquivo. "Envie o arquivo."
- **Erro:** recusar sem motivo. "Escreva o motivo para recusar."
- **Erro:** validar o que você mesmo enviou. "Quem enviou não valida o próprio passo."
- **Aviso:** passo já validado. "Este passo já foi validado."
- **Aviso:** pedido encerrado. "Pedido encerrado ou cancelado."

### Passo a passo em texto

1. Em Pendências, etapa **Embarque**, clique em **Abrir** (cartão **Embarque e desembaraço**).
2. Na linha **Invoice e packing list**, abra o **Arquivo** enviado pelo comex, confira e clique em **Validar** (ou **Recusar**, com o motivo).
3. Na linha **Invoice e packing assinados**, escolha o arquivo assinado e carimbado e clique em **Enviar**.
4. Se for recusado, leia o motivo, corrija e clique em **Enviar de novo**.
5. Booking, Draft do BL e BL original você só acompanha.

### Legendas na tela em EN e ZH

| Marca                 | EN                                               | ZH                                  |
| --------------------- | ------------------------------------------------ | ----------------------------------- |
| Etapa                 | Shipment                                         | 装运                                |
| Cartão                | Shipping and customs                             | 装运与清关                          |
| Passos                | Booking · Draft BL · Invoice and packing list · Signed invoice and packing · BL (original) | 订舱 · 提单草稿 · 发票和装箱单 · 已签署的发票和装箱单 · 提单（正本） |
| Colunas               | Step · Status · Done / validated by · Entered · Sent by · Action | 步骤 · 状态 · 执行 / 审核 · 已填写 · 提交人 · 操作 |
| Quem faz              | Done by: {actor} · validated by: {validator}     | 负责：{actor} · 审核：{validator}   |
| Situações             | Pending · Sent, awaiting validation · Validated · Rejected · Done | 待处理 · 已提交，待审核 · 已审核 · 已退回 · 已完成 |
| Botões                | Validate · Reject · Send · Send again            | 审核通过 · 退回 · 提交 · 重新提交   |
| Campo                 | Reason (required to reject)                      | 原因（退回时必填）                  |
| Arquivo               | File                                             | 文件                                |
| Espera                | After: {step}                                    | 需先完成：{step}                    |
| Progresso             | {done} of {total} done                           | 已完成 {done}/{total}               |
| Sucesso               | Sent. · Validated. · Rejected; the sender was notified. | 已提交。 · 已审核。 · 已退回，已通知提交人。 |
| Erro (ordem)          | Finish the previous step first.                  | 请先完成上一步。                    |
| Erro (arquivo)        | Send the file.                                   | 请上传文件。                        |
| Erro (motivo)         | Write the reason to reject.                      | 退回请填写原因。                    |
| Erro (próprio passo)  | The sender cannot validate their own step.       | 提交人不能审核自己的步骤。          |
| Fim                   | After shipment (customs, transport and delivery to the customer) nothing depends on you. To follow up, open Orders. | 装运之后（清关、运输、交付客户）不再需要您处理。如需跟进，请打开"订单"。 |
| PASSO 1/4 a 3/4       | Open the Shipping card · Check and validate · Send the signed invoice | 打开装运卡片 · 核对并审核 · 提交已签署的发票 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | The cargo is about to ship. You only need to check the invoice and packing list, and send them back signed. |
| 2 (0:10–0:50)  | The card lists the shipping steps that concern you: booking, draft BL, invoice and packing list, the signed invoice and the original BL. The rest of customs you never see. |
| 3 (0:50–1:50)  | First, the comex sends the invoice and packing list. Open the file and check quantity, price, cartons and weights. If it is right, click Validate. If something is wrong, write the reason and click Reject. |
| 4 (1:50–2:50)  | Validated? Now the signed invoice line opens. Sign and stamp it, choose the file and click Send. The comex validates next. If rejected, you see the reason and send again. |
| 5 (2:50–3:30)  | With the signed invoice validated, shipping goes on. After it, nothing else depends on you. Next video: your account statement and payments. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | 货物即将装运。您只需核对发票和装箱单，并签署后回传。 |
| 2 (0:10–0:50)  | 这张卡片列出与您有关的装运步骤：订舱、提单草稿、发票和装箱单、已签署的发票，以及提单正本。清关的其余部分，您看不到。 |
| 3 (0:50–1:50)  | 首先，Comex 上传发票和装箱单。打开文件，核对数量、单价、箱数和重量。无误就点击"审核通过"；有问题，写明原因并点击"退回"。 |
| 4 (1:50–2:50)  | 审核通过后，"已签署的发票和装箱单"这一行开启。签字盖章，选择文件，点击"提交"。接着由 Comex 审核。如果被退回，您会看到原因，再重新提交。 |
| 5 (2:50–3:30)  | 签署的发票审核通过后，装运继续。装运之后，不再需要您处理。下一个视频：往来账和付款。 |

### Notas de gravação

- O fornecedor só enxerga os cinco passos acima (docs/IMPORT_FLOW.md): Booking, Draft do BL, Invoice e packing list, Invoice e packing assinados e BL original. **Numerário, DI, CE Mercante, CI, canal e presença de carga nunca aparecem.**
- O botão "Gerar invoice e packing list" é do comex (aparece para quem envia o passo); o fornecedor recebe o arquivo pronto.
- Estas pendências só existem depois que o pedido chega à Inspeção (não antes).
- Mostre o cartão da conta de um pedido real do ponto `antes-FOR-09` e esconda nomes de pessoas.

### Pontos a confirmar

- ⚠ As pendências **"Validar Invoice e packing list: pedido #n"** e **"Invoice assinada: pedido #n"** saem em português mesmo em zh/en (o título não é traduzido em `tasks.ts`). A cena 1 usa o texto como a tela mostra.
- ⚠ O fornecedor pode abrir `/app/orders/[id]/invoice` pelo endereço (o código permite), mas não há link dele no cartão; o vídeo só mostra o **Arquivo** enviado.
- ⚠ Nesta sessão o cartão não foi gravado (pedido ainda na Preparação); descrições vêm do código e dos dicionários.
- ⚠ Reserva no navio: o passo "Booking" do cartão é a reserva no navio (diga "reserva no navio" na narração em pt para não confundir com o Booking da planilha).

---

## FOR-10 · Conta corrente e pagamentos

> **Promessa:** ao final do vídeo você sabe ler a previsão de pagamentos da Wellmix, entender cada situação e confirmar o recebimento quando o dinheiro chegar.

| Ficha                 |                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Fornecedor                                                                                                            |
| Conta de gravação     | `supplier.a@china.com`, tela em **zh** (en: `supplier.b@china.com`)                                                    |
| Duração-alvo          | 3:30                                                                                                                  |
| Ponto da jornada      | Pagamento ao fornecedor: **fora** do fluxo do pedido, paralelo às etapas 4 a 9 (guia, seção 6.1)                        |
| Telas e rotas         | `/app/account`, `/app/notifications`                                                                                  |
| Dados antes de gravar | O Shenzhen Supplier A com condição "30 % no pedido + 70 % 90 dias após a entrega" e a parcela 1 já **paga** pela Wellmix. Ponto `antes-FOR-10` |
| Depois deste vídeo    | Confirmado, o pagamento fica "Recebido pelo fornecedor" e a parcela sai da previsão                                    |
| Antes · Próximo       | FOR-09 · FOR-01 (revisão)                                                                                             |
| Idiomas               | pt (base), en, zh                                                                                                     |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/account`**
- 🎬 Imagem: o aviso "Pedido #1: pagamento enviado, confirme o recebimento" e a **Conta corrente** com os três totais.
- 🎙 Narração: "A Wellmix pagou. Veja quanto, quando vêm as próximas parcelas e confirme que o dinheiro chegou."
- 🔤 Na tela: `[TÍTULO]` "FOR-10 · Conta corrente e pagamentos"; selo `[MAPA]` "paralelo".
- ✂️ Edição: vinheta antes.

**Cena 2 · 0:10–0:35 · Onde fica e o que não segura · menu → `/app/account`**
- 🎬 Imagem: menu **Pedidos → Conta corrente**. Cabeçalho com o nome do fornecedor.
- 🎙 Narração: "No menu Pedidos, abra Conta corrente. O pagamento não segura o andamento do pedido: a produção segue enquanto a Wellmix paga pela condição combinada."
- 🔤 Na tela: `[PASSO 1/5] Abra Conta corrente`; `[QUEM VÊ]` "Só os seus pedidos e pagamentos".
- ✂️ Edição: mapa pequeno com selo "paralelo".

**Cena 3 · 0:35–1:10 · Os totais · `/app/account`**
- 🎬 Imagem: os três números **Total** (valor FOB dos pedidos), **Recebido** e **Saldo**.
- 🎙 Narração: "No alto, o total dos seus pedidos, o quanto você já recebeu e o saldo. Pedido cancelado não entra na conta."
- 🔤 Na tela: `[PASSO 2/5] Leia os totais`; `[SETA]` em cada número.
- ✂️ Edição: `[ZOOM 150 %]` nos três números.

**Cena 4 · 1:10–2:10 · Previsão de pagamentos · `/app/account`**
- 🎬 Imagem: o cartão **Previsão de pagamentos**: "Condição combinada: 30 % no pedido + 70 % 90 dias após a entrega" e, abaixo, a observação da Wellmix para você. A tabela: **Pedido**, **Parcela** (1/2, 30 %), **Vencimento**, **Valor**, **Situação** ("Vence em breve", "Aguardando o marco", "Programada", "Vencida", "Solicitado ao banco/financeiro", "Pago · falta o fornecedor confirmar").
- 🎙 Narração: "A Previsão de pagamentos mostra a condição combinada e cada parcela: vencimento, valor e situação. Aguardando o marco quer dizer que ainda falta o evento, como a entrega. A observação da Wellmix aparece logo abaixo da condição."
- 🔤 Na tela: `[PASSO 3/5] Leia a previsão`; `[SETA]` "Condição combinada"; `[SETA]` "Observação da Wellmix"; `[ATENÇÃO]` "Pedidos antigos seguem a condição combinada em cada um."
- ✂️ Edição: `[ZOOM 150 %]` na coluna Situação.

**Cena 5 · 2:10–3:05 · Confirmar o recebimento · `/app/account`**
- 🎬 Imagem: mais abaixo, a tabela dos pedidos e pagamentos: a linha do pedido (Data, Valor, Câmbio, Situação) e, indentada, a linha do pagamento com "− US$ …", **Comprovante**, **Trilha** ("visualizado", "confirmado") e o botão **Confirmar recebimento**. Quando o dinheiro entrar na conta, clicar nele: a situação vira "Recebido" e o histórico registra "Recebimento confirmado".
- 🎙 Narração: "Quando o dinheiro entrar no seu banco, clique em Confirmar recebimento, na linha do pagamento. A trilha guarda quando você viu e quando confirmou. Só confirme depois de receber."
- 🔤 Na tela: `[PASSO 4/5] Confirme quando o dinheiro chegar`; `[BOTÃO] "Confirmar recebimento"`; `[ATENÇÃO]` "Confirmar é um ato seu; ver a lista não confirma."
- ✂️ Edição: `[ZOOM 150 %]` na coluna Trilha; `[CORTE]` na confirmação.

**Cena 6 · 3:05–3:30 · Depois e resumo**
- 🎬 Imagem: "Resumo por pedido" (Contratado, Pago, A confirmar, Saldo) e "Histórico". Fundo vermelho com o resumo.
- 🎙 Narração: "Confirmado, o pagamento fica como Recebido. O resumo por pedido mostra contratado, pago, a confirmar e o saldo. Pronto: você conhece o caminho inteiro do fornecedor."
- 🔤 Na tela: `[DEPOIS]` "A Wellmix vê 'Recebido pelo fornecedor'; a parcela sai da previsão."; `[RESUMO]` "1 Conta corrente · 2 Totais · 3 Previsão por parcela · 4 Confirmar recebimento"; chamada "Rever: FOR-01 · Seu painel".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Aviso:** nenhuma condição. "A condição de pagamento ainda não foi configurada pela Wellmix." → **Correção:** fale com a Wellmix pelas Mensagens.
- **Aviso:** sem parcelas abertas. "Nenhuma parcela em aberto."
- **Erro:** esperar a confirmação sem clicar. Pago, mas "falta o fornecedor confirmar": a parcela fica pendente até você clicar em Confirmar recebimento.
- **Erro:** confirmar antes de receber. Não há desfazer; só a Wellmix ajusta.

### Passo a passo em texto

1. No menu **Pedidos**, abra **Conta corrente**.
2. Leia **Total**, **Recebido** e **Saldo**.
3. Em **Previsão de pagamentos**, veja a **Condição combinada** (e a observação da Wellmix) e, por parcela, **Vencimento**, **Valor** e **Situação**.
4. Quando o dinheiro entrar, clique em **Confirmar recebimento** na linha do pagamento. A pendência "Confirmar recebimento" e o aviso "pagamento enviado" saem.
5. Use **Resumo por pedido** e **Histórico** para conferir o que foi pago e confirmado.

### Legendas na tela em EN e ZH

| Marca                 | EN                                               | ZH                                  |
| --------------------- | ------------------------------------------------ | ----------------------------------- |
| Menu / título         | Account statement                                | 往来账                              |
| Totais                | Total · Received · Balance                       | 合计 · 已收 · 余额                  |
| Cartão                | Payment forecast                                 | 付款预计                            |
| Condição              | Agreed terms: {terms}                            | 约定条件：{terms}                   |
| Colunas               | Order · Installment · Due · Amount · Status      | 订单 · 分期 · 到期日 · 金额 · 状态  |
| Situações             | Due soon · Waiting for milestone · Scheduled · Overdue · Requested from bank/finance · Paid · awaiting supplier confirmation · Received by supplier | 即将到期 · 等待节点 · 已排期 · 已逾期 · 已向银行/财务申请 · 已付款 · 待供应商确认 · 供应商已收款 |
| Colunas (pagamentos)  | Order · Date · Amount · Exchange rate · Status · Proof · Trail | 订单 · 日期 · 金额 · 汇率 · 状态 · 凭证 · 跟踪记录 |
| Trilha                | viewed on · confirmed                            | 查看时间 · 已确认                   |
| Botão                 | Confirm receipt                                  | 确认收款                            |
| Resumo                | Summary per order · Contracted · Paid · To confirm · Balance | 按订单汇总 · 合同金额 · 已付 · 待确认 · 余额 |
| Histórico             | History · Receipt confirmed                      | 历史记录 · 已确认收款               |
| Aviso (sino)          | Order #{n}: payment sent, please confirm receipt | 订单 #{n}：款项已汇出，请确认收款   |
| Vazio                 | No open installments.                            | 没有未结分期。                      |
| Sem condição          | Wellmix has not set the payment terms yet.       | Wellmix 尚未设置付款条件。          |
| PASSO 1/5 a 4/5       | Open Account statement · Read the totals · Read the forecast · Confirm when the money arrives | 打开往来账 · 看合计 · 看付款预计 · 款项到账后确认 |

### Narração completa em EN

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix has paid. See how much, when the next installments come, and confirm the money arrived. |
| 2 (0:10–0:35)  | Under the Orders menu, open Account statement. Payment does not hold up the order: production goes on while Wellmix pays under the agreed terms. |
| 3 (0:35–1:10)  | At the top, the total of your orders, how much you already received, and the balance. A cancelled order does not count. |
| 4 (1:10–2:10)  | The Payment forecast shows the agreed terms and each installment: due date, amount and status. Waiting for milestone means the event is still missing, like delivery. Wellmix's note appears right below the terms. |
| 5 (2:10–3:05)  | When the money arrives in your bank, click Confirm receipt, on the payment line. The trail keeps when you saw it and when you confirmed. Only confirm after you receive it. |
| 6 (3:05–3:30)  | Once confirmed, the payment is Received. The summary per order shows contracted, paid, to confirm and the balance. Done: you now know the supplier's whole path. |

### Narração completa em ZH

| Cena (tempo)   | Texto |
| -------------- | ----- |
| 1 (0:00–0:10)  | Wellmix 已经付款。看看付了多少、下一期什么时候付，并确认款项到账。 |
| 2 (0:10–0:35)  | 在"订单"菜单里打开"往来账"。付款不影响订单进度：Wellmix 按约定条件付款，生产照常进行。 |
| 3 (0:35–1:10)  | 顶部是您的订单合计、已收金额和余额。已取消的订单不计入。 |
| 4 (1:10–2:10)  | "付款预计"显示约定条件和每一期：到期日、金额和状态。"等待节点"表示还缺某个节点，比如交付。Wellmix 的备注就在条件下面。 |
| 5 (2:10–3:05)  | 款项到您的银行账户后，在这笔付款的那一行点击"确认收款"。跟踪记录会保存您查看和确认的时间。收到后再确认。 |
| 6 (3:05–3:30)  | 确认后，付款变为"已收到"。按订单汇总显示合同金额、已付、待确认和余额。完成了：您已经了解供应商的全部流程。 |

### Notas de gravação

- Para a cena 5, a Wellmix tem de registrar o pagamento da parcela 1 (no pedido: "Copiar dados para o banco" ou "Marcar como pago"); só então a linha do pagamento e o botão aparecem.
- A **Previsão de pagamentos** só lista parcelas ainda não recebidas; recebida sai da lista.
- A lista de pagamentos fica **abaixo** da previsão e traz o botão; o texto da previsão diz "na lista acima" (veja Pontos a confirmar).
- Abrir a Conta corrente registra "visualizado" de cada pagamento; só o botão confirma.
- O fornecedor vê o câmbio da linha do pagamento; não vê o cliente nem a venda.
- Esconda a seção "Certificações do fornecedor" no enquadramento (tema de outro episódio).

### Pontos a confirmar

- ⚠ A frase da previsão diz "Quando o dinheiro chegar, confirme o recebimento **na lista acima**" (`account.forecast.hint`), mas a lista com o botão **Confirmar recebimento** está **abaixo** da previsão (verificado na tela). O roteiro diz "mais abaixo". Possível texto a corrigir.
- ⚠ A condição em zh traz "30% 订单日期当天 + 70% 交付客户后 90 天": confirmar se "订单日期当天" é a tradução certa de "na data do pedido" (marco "pedido gerado").
- ⚠ O tipo de pendência "Confirmar recebimento" sai em português para zh/en (título e detalhe hardcoded em `tasks.ts`).
- ⚠ O dado de "Observação da condição de pagamento" só aparece se a Wellmix preencheu em Cadastros → fornecedor; sem ela a linha some.
