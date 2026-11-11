# Séries MAR, TRA, JUR e OCP

Roteiros dos vídeos de quatro papéis do Portal Wellmix: a **companhia marítima** (MAR), o **transportador** (TRA), o **jurídico** (JUR) e a **certificadora**, o OCP (OCP). Todos acompanham a **Jarra de vidro 1,5 L (UTL-001)** e seguem o modelo de episódio do [GUIA.md](GUIA.md) (seção 5), com o episódio CLI-02 ([02-cliente.md](02-cliente.md)) como referência de tom e de nível de detalhe.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os nomes de botões, menus, campos, selos e mensagens entre aspas foram copiados do dicionário do sistema (`src/i18n/dictionaries.ts` e `src/i18n/modules/*.ts`); a série MAR traz também as chaves en e zh. Os textos e telas foram conferidos no build de produção, em modo demonstração, repetindo as ações do E2E em cada papel.

A narração de cada cena cabe no tempo (pt: até 2,4 palavras por segundo; en: até 2,5; zh: até 4 caracteres por segundo, contando cada palavra latina como 2).

| ID | Episódio | Duração-alvo | Situação |
| --- | --- | --- | --- |
| MAR-01 | Confirmar o embarque | 3:50 | roteirizado |
| MAR-02 | Enviar a tabela de frete | 4:14 | roteirizado |
| TRA-01 | Registrar o transporte e a entrega | 3:33 | roteirizado |
| TRA-02 | Versão no celular | 2:16 | roteirizado |
| JUR-01 | Multas: visualizar e mudar o status | 3:16 | roteirizado |
| OCP-01 | Receber o pedido de certificação e a ficha | 3:45 | roteirizado |
| OCP-02 | Enviar o selo e o memorial e acompanhar a validação | 3:14 | roteirizado |
| MAR-03 | Responder um pedido de frete (tela Fretes, por produto) | a definir | sugerido; não roteirizado |

---

## Série MAR · Companhia marítima

Vídeos para a companhia marítima (o armador): a Marítima SA (`armador@maritima.com`), com a tela em **en** (e também em **zh**, trocando o idioma em PT / EN / ZH no alto da tela). Como o público é estrangeiro, cada episódio traz, além do roteiro em pt-BR, as **legendas na tela em EN e ZH** e a **narração completa em EN e em ZH**, cena a cena. Os nomes de botões e campos entre aspas, no roteiro em pt, são os do dicionário pt; na gravação aparecem os da tabela "Legendas na tela em EN e ZH" (copiados das chaves en e zh do dicionário).

**O que a companhia vê** (docs/ACCESS.md, docs/WORKFLOW.md): menu **Início** ("Pendências", "Notificações", "Mensagens"; na tela en, "My tasks", "Notifications" e "Messages") e **Pedidos** ("Fretes", "Minha tabela de frete" e "Pedidos"). Nos pedidos em que ela está designada, vê o resumo com o fornecedor, os itens e a **etapa Embarque** (a etapa dela aparece mesmo antes de começar). Ela confirma o embarque (data, previsão de chegada, navio e BL são opcionais) e envia a **sua** tabela de frete.

**O que a companhia não vê:** o cliente, os preços e os valores comerciais, as etapas dos outros parceiros e as tabelas de frete das outras companhias (o comparativo é só da Wellmix). A tela "Fretes" (pedidos de cotação de frete por produto) **não** é coberta por estes episódios: fica como candidato a um MAR-03.

**Conta de gravação:** `armador@maritima.com` (senha `wellmix123`), idioma en; segunda gravação em zh. Chrome em en-US (as datas saem em mm/dd/aaaa; em zh, aaaa/mm/dd).

**Documentos lidos:** GUIA.md, 02-cliente.md (modelo), SCOPE.md, WORKFLOW.md (Embarque e frete, datas em ordem, quem vê o quê), ACCESS.md, os módulos de dicionário `freight` e `freight-tariff`, `src/app/app/freight`, `src/lib/services/freight-tariff*.ts`, `src/lib/workflow/engine.ts` (ordem das datas), `src/components/requirement-form.tsx` e `freight-tariff-box.tsx`, e o E2E `tests/e2e/happy-path.spec.ts` (passo 12).

### MAR-01 · Confirmar o embarque

> **Promessa:** ao final do vídeo você sabe confirmar o embarque de um pedido, informar data, previsão de chegada, navio e BL no que tiver e respeitar a ordem das datas.

| Ficha | |
| --- | --- |
| Série e papel | Companhia marítima (Marítima SA) |
| Conta de gravação | `armador@maritima.com`, tela em **en** (segunda gravação em **zh**, pelo seletor PT / EN / ZH); Chrome em en-US |
| Duração-alvo | 3:50 |
| Ponto da jornada | Etapa 7 de 9: Embarque e mar |
| Telas e rotas | `/app` (Pendências), `/app/orders/[id]` (cartão Embarque), `/app/notifications` |
| Dados antes de gravar | Pedido da Jarra de vidro 1,5 L (UTL-001) com a inspeção aprovada e a etapa Embarque em andamento, com a Marítima SA no pedido (na demonstração o pedido já nasce com ela); um BL de exemplo em PDF. Ponto de salvamento `antes-MAR-01` |
| Depois deste vídeo | A etapa Embarque conclui, o Desembaraço abre e o despachante recebe o aviso no sino e em Pendências |
| Antes · Próximo | Inspeção (fornecedor) · MAR-02 |
| Idiomas | pt (base), en e zh |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: A tela inicial ("Minhas pendências") com a linha "Pedido #1: Embarque" em destaque; o cursor repousa perto do botão "Abrir".
- 🎙 Narração: "O navio saiu? Em poucos cliques você confirma o embarque e o despachante já fica sabendo que pode começar."
- 🔤 Na tela: `[TÍTULO]` "MAR-01 · Confirmar o embarque"; `[ZOOM 150 %]` na linha da pendência
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: A mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Estamos na etapa sete da jornada: embarque e mar. A fábrica já produziu e a inspeção passou. Agora a companhia marítima confirma o embarque."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa e as outras etapas apagadas
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:38 · Abrir a pendência · `/app` → `/app/orders/[id]`**

- 🎬 Imagem: O cursor passa pelo sino (com o número de avisos) e pela linha da pendência (título, detalhe, tipo e prazo) e clica em "Abrir". A página do pedido carrega.
- 🎙 Narração: "Sua pendência aparece em Pendências e também no sino de notificações. A linha mostra o pedido, o tipo e o prazo. Clique em Abrir."
- 🔤 Na tela: `[PASSO 1/5]` Abra a pendência; `[BOTÃO]` "Abrir"; `[SETA]` "Sino: seus avisos" apontando o sino
- ✂️ Edição: clique com onda de destaque; `[CORTE]` seco para a página do pedido quando terminar de carregar.

**Cena 4 · 0:38–0:58 · O que você vê no pedido · `/app/orders/[id]`**

- 🎬 Imagem: Título "Pedido #1", selo da etapa e o botão "Conversar com a Wellmix". O cursor percorre "Resumo do pedido" (só o fornecedor), "Itens do pedido" e "Etapas do pedido" (uma linha só: Embarque).
- 🎙 Narração: "Aqui você vê só o que é seu: o fornecedor, o item e a etapa Embarque. O cliente e os preços não aparecem. Em caso de dúvida, use Conversar com a Wellmix."
- 🔤 Na tela: `[QUEM VÊ]` "A companhia marítima não vê o cliente nem os preços"; `[SETA]` "Só a sua etapa aparece" na tabela de etapas; `[BOTÃO]` "Conversar com a Wellmix"
- ✂️ Edição: manter 3 s parado na tabela de etapas.

**Cena 5 · 0:58–1:14 · O botão da tabela de frete · `/app/orders/[id]`**

- 🎬 Imagem: Rolar até o cartão "Embarque" (em andamento). No topo, o quadro azul "Sua tabela de frete" com o botão "Importar planilha" e o aviso "Você ainda não enviou sua tabela de frete para a Wellmix." O cursor aponta o botão, sem clicar.
- 🎙 Narração: "No topo do cartão, o botão Importar planilha leva à sua tabela de frete. Esse é o assunto do próximo vídeo. Por ora, siga para os itens do embarque."
- 🔤 Na tela: `[ZOOM 150 %]` no quadro azul; `[BOTÃO]` "Importar planilha" (sem clicar); `[SETA]` "Tabela de frete: veja o MAR-02"
- ✂️ Edição: zoom de 600 ms e volta; sem clicar no botão.

**Cena 6 · 1:14–1:34 · Só o último item é obrigatório · `/app/orders/[id]`**

- 🎬 Imagem: O cursor percorre os cinco itens do cartão: "Data de embarque", "Previsão de chegada", "Navio / viagem", "Bill of Lading (BL)" e "Embarque confirmado (data, chegada, navio e BL são opcionais)". Os quatro primeiros trazem "opcional" e o selo "Pendente".
- 🎙 Narração: "Data de embarque, previsão de chegada, navio e BL são opcionais: preencha só o que já tiver. O único item obrigatório é o de confirmação, e é ele que conclui a etapa."
- 🔤 Na tela: `[SETA]` "opcional" nos quatro primeiros itens; `[SETA]` "Obrigatório: este conclui a etapa" no último; `[ZOOM 150 %]` no cartão inteiro
- ✂️ Edição: pausa de 2 s no último item.

**Cena 7 · 1:34–1:58 · Data de embarque · `/app/orders/[id]`**

- 🎬 Imagem: No item "Data de embarque", abrir o calendário, escolher o dia e clicar em "Enviar". O item vira "Concluído" e mostra "Enviado por": o nome da companhia e a data. Antes disso, o item da chegada mostrava "Aguardando a data de embarque".
- 🎙 Narração: "Comece pela data de embarque. Escolha o dia no calendário e clique em Enviar. O item muda para Concluído e mostra quem enviou e quando."
- 🔤 Na tela: `[PASSO 2/5]` Informe a data de embarque; `[BOTÃO]` "Enviar"; `[SETA]` "Aguardando a data de embarque" no item da chegada, antes do envio
- ✂️ Edição: o valor do item concluído aparece como data bruta (2026-11-16): não dê zoom nele (ver Notas).

**Cena 8 · 1:58–2:30 · Previsão de chegada e a ordem das datas · `/app/orders/[id]`**

- 🎬 Imagem: No item "Previsão de chegada", abrir o calendário: os dias antes do embarque aparecem bloqueados. Digitar uma data anterior ao embarque: o campo fica com borda vermelha e o aviso aparece embaixo. Corrigir para uma data igual ou posterior e clicar em "Enviar".
- 🎙 Narração: "A previsão de chegada só abre depois da data de embarque e nunca pode ficar antes dela. O calendário já bloqueia os dias anteriores. Se você digitar uma data menor, aparece um aviso vermelho e o envio fica bloqueado. Escolha uma data igual ou posterior e clique em Enviar."
- 🔤 Na tela: `[PASSO 3/5]` Informe a previsão de chegada; `[ERRO COMUM]` "A previsão de chegada não pode ser antes da data de embarque (16/11/2026)."; `[BOTÃO]` "Enviar"; `[ZOOM 150 %]` na mensagem vermelha
- ✂️ Edição: segurar 2 s na mensagem vermelha; embarque e chegada com dias diferentes o bastante para a mensagem ficar legível.

**Cena 9 · 2:30–2:55 · Navio e BL · `/app/orders/[id]`**

- 🎬 Imagem: No item "Navio / viagem", digitar "MARÍTIMA AURORA / 612E" e clicar em "Enviar". No item "Bill of Lading (BL)", clicar em "Escolher arquivo" e escolher o PDF de exemplo; o arquivo sobe sozinho e o item vira "Concluído".
- 🎙 Narração: "Informe o navio e a viagem e clique em Enviar. Para o BL, o conhecimento de embarque, escolha o arquivo no computador. Se ainda não tiver, deixe para depois: dá para enviar mesmo com a etapa concluída."
- 🔤 Na tela: `[PASSO 4/5]` Informe o navio e anexe o BL (opcional); `[BOTÃO]` "Escolher arquivo"; `[DICA]` "Também dá para fotografar o documento: Tirar ou escolher foto"
- ✂️ Edição: o envio do arquivo é automático (não há botão Enviar); corte a espera do upload.

**Cena 10 · 2:55–3:15 · Confirmar o embarque · `/app/orders/[id]`**

- 🎬 Imagem: No item "Embarque confirmado (data, chegada, navio e BL são opcionais)", clicar em "Confirmar". A página recarrega: a etapa "Embarque" fica "Concluída" (100 %) e o selo do pedido passa para "Desembaraço".
- 🎙 Narração: "Agora o passo decisivo. No item de embarque confirmado, clique em Confirmar. A etapa fecha, o pedido passa para o desembaraço e o despachante recebe o aviso."
- 🔤 Na tela: `[PASSO 5/5]` Confirme o embarque; `[BOTÃO]` "Confirmar"; `[ATENÇÃO]` "Confirmar conclui a etapa e avisa o despachante"
- ✂️ Edição: clique com onda; `[CORTE]` na recarga da página.

**Cena 11 · 3:15–3:35 · Depois · `/app/orders/[id]` → `/app`**

- 🎬 Imagem: A tabela de etapas mostra "Embarque" "Concluída" com a data. No cartão, o que ainda estava pendente (por exemplo, o BL) continua com o formulário. Voltar a "Minhas pendências": a linha do embarque sumiu.
- 🎙 Narração: "Pronto: a etapa aparece como Concluída e a pendência sai da sua lista. Navio e BL ainda podem ser enviados depois, até o pedido ser encerrado."
- 🔤 Na tela: `[DEPOIS]` "Desembaraço aberto: o despachante recebe o aviso no sino e em Pendências."; `[DICA]` "Navio e BL pendentes ainda podem ser enviados depois"
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s; depois a tela de pendências ao fundo.

**Cena 12 · 3:35–3:50 · Resumo e próximo vídeo**

- 🎬 Imagem: Fundo vermelho com a lista; no fim, a miniatura do MAR-02.
- 🎙 Narração: "Resumindo: abra a pendência, preencha o que tiver, respeitando a ordem das datas, e clique em Confirmar. No próximo vídeo, veja como enviar a sua tabela de frete."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência · 2 Data de embarque · 3 Previsão de chegada (nunca antes do embarque) · 4 Navio e BL (opcionais) · 5 Confirmar"; chamada "Próximo: MAR-02 · Enviar a tabela de frete"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Erro:** previsão de chegada antes do embarque. O campo avisa na hora "A previsão de chegada não pode ser antes da data de embarque (16/11/2026)." e o envio fica bloqueado; se chegar ao servidor, ele recusa com "A previsão de chegada não pode ser antes da data de embarque." → **Correção:** escolha uma data igual ou posterior à data de embarque.
- **Erro:** tentar a chegada antes de informar o embarque. O item mostra "Aguardando a data de embarque" e, se o envio chegar ao servidor, a recusa é "Informe primeiro a data de embarque: a previsão de chegada é conferida com ela." → **Correção:** envie primeiro a data de embarque.
- **Erro:** chegada depois da previsão de entrega que o transportador já informou. A recusa é "A previsão de chegada não pode ser depois da previsão de entrega já informada." → **Correção:** corrija a chegada para antes dessa previsão ou peça à Wellmix para ajustar a entrega.
- **Erro:** data que não existe. A recusa é "Informe uma data válida." → **Correção:** escolha o dia pelo calendário.
- **Erro:** arquivo do BL em formato não aceito ou grande demais. As mensagens são "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." e "Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado." → **Correção:** envie PDF, imagem, planilha, ZIP ou arte, com até 50 MB.

#### Passo a passo em texto

1. No menu, abra "Pendências" (na tela en, "My tasks") e clique em "Abrir" na linha "Pedido #1: Embarque".
2. No pedido, confira o cartão "Embarque": "Data de embarque", "Previsão de chegada", "Navio / viagem" e "Bill of Lading (BL)" levam o aviso "opcional"; só "Embarque confirmado (data, chegada, navio e BL são opcionais)" é obrigatório.
3. Em "Data de embarque", escolha o dia e clique em "Enviar".
4. Em "Previsão de chegada", escolha um dia igual ou posterior ao embarque e clique em "Enviar". Enquanto o embarque não for enviado, o item mostra "Aguardando a data de embarque".
5. Em "Navio / viagem", digite o navio e a viagem e clique em "Enviar".
6. Em "Bill of Lading (BL)", clique em "Escolher arquivo" (ou "Tirar ou escolher foto") e escolha o arquivo: ele sobe sozinho.
7. No item "Embarque confirmado (data, chegada, navio e BL são opcionais)", clique em "Confirmar". A etapa conclui e o Desembaraço abre para o despachante.
8. Navio, BL e as datas que ficaram pendentes ainda podem ser enviados depois, até o pedido ser encerrado.
9. Dúvidas: clique em "Conversar com a Wellmix".

#### Legendas na tela em EN e ZH

| Marca | EN | ZH |
| --- | --- | --- |
| `[TÍTULO]` | MAR-01 · Confirm the shipment | MAR-01 · 确认装运 |
| `[MAPA etapa 7]` | Stage 7 of 9: Shipping and sea | 第 7 阶段（共 9 个）：装运与海运 |
| `[PASSO 1/5]` | Open the task | 打开待办 |
| `[BOTÃO]` abrir a pendência | "Open" | “打开” |
| `[SETA]` sino | Bell: your notices | 铃铛：你的通知 |
| `[QUEM VÊ]` | The shipping line does not see the customer or the prices | 船公司看不到客户和价格 |
| `[BOTÃO]` conversa | "Chat with Wellmix" | “联系 Wellmix” |
| `[SETA]` etapas | Only your stage appears | 只显示你负责的阶段 |
| `[BOTÃO]` tabela de frete | "Import spreadsheet" | “导入表格” |
| `[SETA]` tabela de frete | Your freight table: see MAR-02 | 你的运价表：见 MAR-02 |
| `[SETA]` opcional | "optional" on the first four items | 前四项标有“可选” |
| `[SETA]` obrigatório | Required: this one closes the stage | 必填：此项完成本阶段 |
| `[PASSO 2/5]` | Enter the shipping date: "Shipping date" | 填写装运日期：“装运日期” |
| `[BOTÃO]` enviar | "Send" | “提交” |
| `[SETA]` aguardar | "Waiting for the shipping date" | “等待装船日期” |
| `[PASSO 3/5]` | Enter the estimated arrival: "Estimated arrival" | 填写预计到达：“预计到达” |
| `[ERRO COMUM]` | "The arrival estimate cannot be earlier than the shipment date (11/16/2026)." | “预计到港日期不能早于装船日期（2026/11/16）。” |
| `[PASSO 4/5]` | Enter the vessel and attach the BL (optional): "Vessel / voyage", "Bill of Lading (BL)" | 填写船名并上传提单（可选）：“船名 / 航次”、“提单（BL）” |
| `[BOTÃO]` arquivo | "Choose file" | “选择文件” |
| `[DICA]` | You can also photograph the document: "Take or choose photo" | 也可以拍摄文件：“拍照或选择照片” |
| `[PASSO 5/5]` | Confirm the shipment | 确认装运 |
| `[BOTÃO]` confirmar | "Confirm" | “确认” |
| `[ATENÇÃO]` | Confirming closes the stage and notifies the customs broker | 确认后本阶段完成，并通知报关行 |
| `[DEPOIS]` | Customs clearance is open: the customs broker is notified (bell and My tasks). | 清关阶段已开启：报关行会在铃铛和待办中收到通知。 |
| `[DICA]` depois | Vessel and BL still pending can be sent later | 尚未提交的船名和提单之后仍可补交 |
| `[RESUMO]` | 1 Open the task · 2 Shipping date · 3 Estimated arrival (never before shipping) · 4 Vessel and BL (optional) · 5 Confirm | 1 打开待办 · 2 装运日期 · 3 预计到达（不能早于装运） · 4 船名和提单（可选） · 5 确认 |
| chamada final | Next: MAR-02 · Send your freight table | 下一集：MAR-02 · 上传你的运价表 |

#### Narração completa em EN

| Cena | Tempo | Narração (EN) |
| --- | --- | --- |
| 1 · Gancho | 0:00–0:10 | Has the ship sailed? In a few clicks you confirm the shipment, and the customs broker knows they can start. |
| 2 · Onde estou na jornada | 0:10–0:22 | We are at stage seven of the journey: shipping and sea. The factory has produced and inspection is done. Now the shipping line confirms the shipment. |
| 3 · Abrir a pendência | 0:22–0:38 | Your task shows up in My tasks and in the notification bell. The row shows the order, the type and the due date. Click Open. |
| 4 · O que você vê no pedido | 0:38–0:58 | Here you see only what is yours: the supplier, the item and the Shipping stage. The customer and prices do not appear. Any question, use Chat with Wellmix. |
| 5 · O botão da tabela de frete | 0:58–1:14 | At the top of the card, the Import spreadsheet button takes you to your freight table. That is the next video. For now, move on to the shipping items. |
| 6 · Só o último item é obrigatório | 1:14–1:34 | Shipping date, estimated arrival, vessel and BL are optional: fill in only what you already have. The only required item is the confirmation, and it is what closes the stage. |
| 7 · Data de embarque | 1:34–1:58 | Start with the shipping date. Pick the day on the calendar and click Send. The item changes to Done and shows who sent it and when. |
| 8 · Previsão de chegada e a ordem das datas | 1:58–2:30 | The estimated arrival only opens after the shipping date, and can never be earlier than it. The calendar already blocks earlier days. If you type an earlier date, a red warning appears and sending is blocked. Choose the same day or later, and click Send. |
| 9 · Navio e BL | 2:30–2:55 | Enter the vessel and voyage and click Send. For the BL, the bill of lading, choose the file from your computer. If you do not have it yet, leave it for later: you can still send it after the stage is done. |
| 10 · Confirmar o embarque | 2:55–3:15 | Now the decisive step. On the shipment confirmed item, click Confirm. The stage closes, the order moves to customs clearance, and the customs broker is notified. |
| 11 · Depois | 3:15–3:35 | Done: the stage shows as Done and the task leaves your list. Vessel and BL can still be sent later, until the order is closed. |
| 12 · Resumo e próximo vídeo | 3:35–3:50 | In short: open the task, fill in what you have, respecting the order of the dates, and click Confirm. In the next video, see how to send your freight table. |

#### Narração completa em ZH

| Cena | Tempo | Narração (ZH) |
| --- | --- | --- |
| 1 · Gancho | 0:00–0:10 | 船已经开了吗？几次点击就能确认装运，清关代理随即知道可以开始。 |
| 2 · Onde estou na jornada | 0:10–0:22 | 现在是旅程的第七步：装运与海运。工厂已生产完毕，验货已通过，轮到船公司确认装运。 |
| 3 · Abrir a pendência | 0:22–0:38 | 待办会出现在“我的待办”和通知铃铛里。这一行显示订单、类型和截止日期。点击“打开”。 |
| 4 · O que você vê no pedido | 0:38–0:58 | 这里只显示与你有关的内容：供应商、产品和装运阶段。客户和价格不会显示。有疑问请点“联系 Wellmix”。 |
| 5 · O botão da tabela de frete | 0:58–1:14 | 卡片顶部的“导入表格”按钮通向你的运价表，那是下一个视频的内容。现在先看装运各项。 |
| 6 · Só o último item é obrigatório | 1:14–1:34 | 装运日期、预计到达、船名和提单都是可选的，有什么填什么。唯一必填的是确认项，它会完成本阶段。 |
| 7 · Data de embarque | 1:34–1:58 | 先填装运日期。在日历里选好日期，点击“提交”。该项变为“已完成”，并显示提交人和时间。 |
| 8 · Previsão de chegada e a ordem das datas | 1:58–2:30 | 预计到达要在填写装运日期之后才能填，而且不能早于装运日期。日历会自动禁用更早的日期。如果手动输入更早的日期，会出现红色提示，并且无法提交。请选择同一天或更晚的日期，再点击“提交”。 |
| 9 · Navio e BL | 2:30–2:55 | 填写船名和航次，然后点击“提交”。提单（BL）请从电脑中选择文件。如果还没有，可以稍后补交：阶段完成后仍可提交。 |
| 10 · Confirmar o embarque | 2:55–3:15 | 现在是关键一步。在确认已装运这一项上点击“确认”。阶段完成，订单进入清关，报关行会收到通知。 |
| 11 · Depois | 3:15–3:35 | 完成：该阶段显示为已完成，待办也从列表中消失。船名和提单仍可稍后补交，直到订单关闭。 |
| 12 · Resumo e próximo vídeo | 3:35–3:50 | 总结：打开待办，有什么填什么，注意日期的先后顺序，然后点击“确认”。下一个视频讲如何上传你的运价表。 |

#### Notas de gravação

- Prepare o ponto de salvamento `antes-MAR-01` (guia, seção 7.2) com a Jornada da Jarra até a inspeção aprovada e a etapa Embarque em andamento.
- Duas gravações da mesma tela: en (conta `armador@maritima.com`) e zh (clique em ZH no alto, antes de começar). Em zh as datas saem em aaaa/mm/dd. A narração em pt é a base de revisão; a voz de en e de zh vem das tabelas "Narração completa".
- Esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3). Na tela en a faixa diz "Demo mode: in-memory data, not persisted. Configure Appwrite for production."
- Use nome de navio fictício ("MARÍTIMA AURORA / 612E") e um BL de exemplo em PDF; nunca nome de armador real nem documento real. Datas: embarque daqui a poucos dias e chegada algumas semanas depois, sempre com a chegada igual ou posterior ao embarque; não cite as datas na narração.
- A coluna "Detalhe" da pendência e o título da pendência de frete ("Frete: …") saem em **português** mesmo com a tela em en ou zh (texto fixo em `src/lib/services/tasks.ts`). Evite zoom nessa coluna ou regrave depois da correção.
- Depois de enviada, a data aparece no item como valor bruto ("2026-11-16"). Evite zoom nela. O progresso do cartão fica em 0 % até a confirmação (só o item obrigatório conta) enquanto o contador diz "2 of 5"; não comente.
- A tabela "Documents" no fim da página do pedido lista as fotos e a arte do pedido, que a companhia marítima não precisa ver: não role até o fim na gravação.
- O quadro "Your freight table" (cena 5) só existe com a etapa Embarque aberta. Grave a cena 3 do MAR-02 (botão no cartão do pedido) **antes** de confirmar o embarque, ou use um segundo pedido em Embarque.
- O aviso "Order #1: Shipping needs you" continua em Notificações depois da confirmação até clicar em "Resolve"; se mostrar o sino, resolva antes.

#### Pontos a confirmar

- ⚠ O texto do item de confirmação é longo e traz a explicação junto ("Embarque confirmado (data, chegada, navio e BL são opcionais)"); confirmar se a Wellmix quer encurtá-lo.
- ⚠ A coluna "Detalhe" da pendência (nomes dos itens) e o título "Frete: …" não são traduzidos para en e zh (ver Notas).
- ⚠ Datas dos itens concluídos aparecem no formato bruto AAAA-MM-DD (por exemplo "2026-12-18"), diferente das outras datas da tela.
- ⚠ Termos em zh: o item usa "装运日期" e "预计到达", mas a mensagem de erro fala em "装船日期" e "预计到港日期"; confirmar com quem fala o idioma qual termo manter.
- ⚠ Não reproduzi a recusa do servidor para a ordem das datas na tela (o calendário e o aviso na página bloqueiam antes); a faixa de erro do servidor usa as mensagens `orders.error.*` do dicionário, mas confirme na gravação.
- ⚠ A etapa Embarque aparece à companhia mesmo antes de começar e a lista de Pedidos mostra pedidos que ainda estão em etapas anteriores; é a regra de docs/WORKFLOW.md (parceiro vê a própria etapa), mas confirme se o vídeo deve mencioná-la.

---

### MAR-02 · Enviar a tabela de frete

> **Promessa:** ao final do vídeo você sabe enviar a planilha de frete da sua companhia, ler a conferência e substituir a tabela quando os preços mudarem.

| Ficha | |
| --- | --- |
| Série e papel | Companhia marítima (Marítima SA) |
| Conta de gravação | `armador@maritima.com`, tela em **en** (segunda gravação em **zh**); Chrome em en-US |
| Duração-alvo | 4:14 |
| Ponto da jornada | Etapa 7 de 9: Embarque e mar (a tabela vale para todos os pedidos; também abre pelo cartão Embarque do pedido) |
| Telas e rotas | `/app/freight/tariff` (menu Pedidos → "Minha tabela de frete"), `/app/orders/[id]` (quadro "Sua tabela de frete" no cartão Embarque), `/app/notifications` |
| Dados antes de gravar | Uma planilha .xlsx no modelo da Wellmix (abas COMPARATIVO - NVT, ITJ e IOA) com o bloco da Marítima SA e **valores fictícios**; uma segunda versão com outros preços, para mostrar a substituição; um pedido em Embarque aberto (cena 3). Ponto de salvamento `antes-MAR-02`, sem tabela enviada (a faixa "Você ainda não enviou sua tabela de frete. Envie a planilha acima." aparece) |
| Depois deste vídeo | A tabela vira a vigente da companhia (a anterior fica com o selo "Substituído" no histórico); a Wellmix recebe um aviso e o comparativo e o frete por m³ passam a usá-la |
| Antes · Próximo | MAR-01 · série TRA (ou MAR-03, a roteirizar) |
| Idiomas | pt (base), en e zh |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/freight/tariff`**

- 🎬 Imagem: A tela "Minha tabela de frete": o cartão de envio e a faixa vazia "Você ainda não enviou sua tabela de frete. Envie a planilha acima."
- 🎙 Narração: "Envie a sua tabela de frete uma vez e a Wellmix já compara os seus preços com os das outras companhias."
- 🔤 Na tela: `[TÍTULO]` "MAR-02 · Enviar a tabela de frete"
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:24 · Para que serve a tabela · `/app/freight/tariff`**

- 🎬 Imagem: A mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "A tabela não é de um pedido só: é a sua lista de preços. A Wellmix a usa para comparar companhias e atualizar o frete por metro cúbico do preço."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa; `[SETA]` "Uma tabela por companhia, vale para todos os pedidos"
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:24–0:46 · Dois caminhos até a tela · menu → `/app/freight/tariff`**

- 🎬 Imagem: Abrir o menu "Pedidos" e clicar em "Minha tabela de frete" (o menu mostra "Fretes", "Minha tabela de frete" e "Pedidos"). Depois, o pedido em Embarque: clicar em "Importar planilha" no quadro "Sua tabela de frete"; a mesma tela abre, com o link "← Voltar ao pedido".
- 🎙 Narração: "Há dois caminhos. No menu Pedidos, escolha Minha tabela de frete. Ou, no pedido em Embarque, clique em Importar planilha: a tela é a mesma e traz um link para voltar ao pedido. O item Fretes é outro assunto: são os pedidos de cotação por produto."
- 🔤 Na tela: `[PASSO 1/4]` Abra a tela da tabela; `[BOTÃO]` "Minha tabela de frete"; `[BOTÃO]` "Importar planilha"; `[SETA]` "← Voltar ao pedido"; `[SETA]` "Fretes: outro assunto, não é a tabela" no item do menu
- ✂️ Edição: mostrar os dois caminhos em 8 s cada; o segundo só funciona com a etapa Embarque aberta (ver Notas).

**Cena 4 · 0:46–1:08 · A tela e quem vê · `/app/freight/tariff`**

- 🎬 Imagem: Percorrer: o subtítulo, o cartão "Enviar minha planilha de fretes" e os campos "Esta planilha vai para" (caixa cinza com "Marítima SA", só leitura), "Planilha (.xlsx ou .xlsm)", "Data de referência" e o botão "Enviar planilha".
- 🎙 Narração: "Esta é a sua tela. O campo Esta planilha vai para já mostra a sua companhia: a planilha sempre entra em seu nome. Só você e a Wellmix veem o conteúdo; as outras companhias, não."
- 🔤 Na tela: `[QUEM VÊ]` "Envie sua planilha de fretes para a Wellmix. Só você e a Wellmix veem; as outras companhias, não."; `[SETA]` "Esta planilha vai para": "Sua companhia; o nome dos blocos na planilha não importa."; `[ZOOM 150 %]` no cartão de envio
- ✂️ Edição: pausa de 2 s no campo cinza.

**Cena 5 · 1:08–1:34 · Preparar a planilha · arquivo .xlsx (fora do portal)**

- 🎬 Imagem: O arquivo de demonstração aberto no Excel, na aba "COMPARATIVO - NVT"; corte rápido nas abas "ITJ" e "IOA". Destacar: frete por container 40HQ de cada porto de origem (rota direta e rota longa), as taxas em US$ e em R$, PTAX, IOF e prazo de pagamento. Mostrar o nome do arquivo com a extensão .xlsx.
- 🎙 Narração: "Use a planilha de estimativa de frete da Wellmix, com as abas COMPARATIVO - NVT, ITJ e IOA. Preencha o frete por container 40HQ de cada porto de origem, as taxas, o PTAX, o IOF e o prazo de pagamento. Salve em xlsx ou xlsm: macros não são executadas."
- 🔤 Na tela: `[ATENÇÃO]` "Formato .xls antigo: abra no Excel e salve como .xlsx ou .xlsm."; `[ATENÇÃO]` "A planilha está protegida por senha. Abra no Excel, tire a senha de abertura (Arquivo → Informações → Proteger pasta de trabalho) e envie de novo."; `[DICA]` "Planilha grande demais (máximo 4 MB)."
- ✂️ Edição: valores da planilha de demonstração são fictícios; não os destaque como tarifa real.

**Cena 6 · 1:34–2:00 · Escolher o arquivo e enviar · `/app/freight/tariff`**

- 🎬 Imagem: No campo "Planilha (.xlsx ou .xlsm)", escolher o arquivo. Em "Data de referência", mostrar a data já preenchida e, se for outra, trocar pela data da cotação. Clicar em "Enviar planilha".
- 🎙 Narração: "Em Planilha, clique para escolher o arquivo. A Data de referência já vem preenchida com o dia de hoje: mude para a data da sua cotação, se for outra. Confira e clique em Enviar planilha."
- 🔤 Na tela: `[PASSO 2/4]` Escolha o arquivo e a data de referência; `[SETA]` "Data da sua cotação."; `[PASSO 3/4]` Envie a planilha; `[BOTÃO]` "Enviar planilha"
- ✂️ Edição: digitação/seleção em tempo real; cortar a espera do envio.

**Cena 7 · 2:00–2:30 · O resultado · `/app/freight/tariff?imported=…`**

- 🎬 Imagem: O aviso verde "Planilha enviada: 2 tarifas. A Wellmix já recebeu." aparece no alto. Embaixo, os quatro cartões: "Data de referência" com o selo "Vigente", "Câmbio da planilha", "Frete até o CD" e "Tarifas".
- 🎙 Narração: "Pronto: o aviso verde confirma, com o número de tarifas lidas. Embaixo, quatro cartões: a data de referência com o selo Vigente, o câmbio da planilha, o frete até o CD e a quantidade de tarifas. A Wellmix já recebeu o aviso."
- 🔤 Na tela: `[SETA]` "Planilha enviada: 2 tarifas. A Wellmix já recebeu."; `[SETA]` "Vigente" no cartão da data; `[ZOOM 150 %]` nos quatro cartões
- ✂️ Edição: manter 3 s nos cartões.

**Cena 8 · 2:30–2:54 · A conferência · `/app/freight/tariff`**

- 🎬 Imagem: Rolar até a faixa verde "Conferência sem avisos: os totais da planilha batem com a conta." e o quadro azul "Para saber (1)". Explicar que um aviso amarelo, quando existir, pede correção.
- 🎙 Narração: "Leia a conferência. Quando tudo bate, aparece Conferência sem avisos. Aviso amarelo pede correção: ajuste a planilha e envie de novo. Os azuis, em Para saber, são só informação."
- 🔤 Na tela: `[PASSO 4/4]` Leia a conferência; `[SETA]` "Conferência sem avisos: os totais da planilha batem com a conta."; `[SETA]` "Para saber (1): só para saber"
- ✂️ Edição: se tiver uma planilha com aviso amarelo, mostre-o 3 s; senão, só o verde.

**Cena 9 · 2:54–3:18 · As duas visões da planilha · `/app/freight/tariff`**

- 🎬 Imagem: Mostrar os dois botões "Como na planilha" e "Resumo (com PTAX e IOF)". Na primeira, a tabela como na planilha (portos e a sua companhia); na segunda, o resumo com o custo total em R$ por porto, as taxas e o PTAX / IOF.
- 🎙 Narração: "Abaixo, dois botões. Como na planilha mostra os valores como você os digitou. Resumo, com PTAX e IOF, mostra os totais que o portal calcula, e por isso eles ficam maiores que os da planilha."
- 🔤 Na tela: `[BOTÃO]` "Como na planilha"; `[BOTÃO]` "Resumo (com PTAX e IOF)"; `[SETA]` "Totais do resumo incluem PTAX e IOF"
- ✂️ Edição: alternar as duas visões em 4 s cada.

**Cena 10 · 3:18–3:44 · Trocar a tabela e o histórico · `/app/freight/tariff`**

- 🎬 Imagem: Rolar até "Importações": duas linhas, a nova com "Vigente" e a anterior com "Substituído". Clicar em "Ver" na antiga: aparece o aviso "Você está vendo um tarifário antigo (referência 10/11/2026)." com o link "Ver o vigente".
- 🎙 Narração: "Quando os preços mudarem, envie uma planilha nova. A nova passa a ser a Vigente e a anterior fica com o selo Substituído, mas continua no histórico, em Importações. Clique em Ver para abrir uma antiga: um aviso lembra que ela não é a vigente."
- 🔤 Na tela: `[SETA]` "Vigente" e "Substituído" na coluna "Situação"; `[BOTÃO]` "Ver"; `[SETA]` "Ver o vigente"
- ✂️ Edição: a data do aviso muda com o dia da gravação; não a cite na narração.

**Cena 11 · 3:44–4:00 · Depois · `/app/freight/tariff`**

- 🎬 Imagem: Clicar em "← Voltar ao pedido" e voltar ao pedido; o quadro "Sua tabela de frete" agora mostra "Última enviada: referência dd/mm/aaaa, 2 tarifas."
- 🎙 Narração: "A Wellmix recebe o aviso de tabela nova e o comparativo já usa os seus preços. Você não vê as tabelas das outras companhias."
- 🔤 Na tela: `[DEPOIS]` "A Wellmix é avisada e usa a sua tabela no comparativo e no frete por m³."; `[QUEM VÊ]` "Só você e a Wellmix veem a sua tabela"
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 12 · 4:00–4:14 · Resumo e próximo vídeo**

- 🎬 Imagem: Fundo vermelho com a lista; no fim, a chamada para a série seguinte.
- 🎙 Narração: "Resumindo: abra Minha tabela de frete, escolha a planilha e a data, clique em Enviar planilha e leia a conferência. Quando os preços mudarem, envie outra."
- 🔤 Na tela: `[RESUMO]` "1 Abra Minha tabela de frete · 2 Escolha o arquivo e a data · 3 Enviar planilha · 4 Leia a conferência"; chamada "Série TRA · Transportador" (ou o MAR-03, se for gravado)
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Erro:** arquivo que não é planilha. A tela mostra "Não consegui ler o arquivo. Envie a planilha em .xlsx ou .xlsm." → **Correção:** envie um .xlsx ou .xlsm.
- **Erro:** formato antigo. "Formato .xls antigo: abra no Excel e salve como .xlsx ou .xlsm." → **Correção:** abra no Excel e salve como .xlsx ou .xlsm.
- **Erro:** planilha com senha. "A planilha está protegida por senha. Abra no Excel, tire a senha de abertura (Arquivo → Informações → Proteger pasta de trabalho) e envie de novo." → **Correção:** tire a senha de abertura e envie de novo.
- **Erro:** planilha grande demais. "Planilha grande demais (máximo 4 MB)." → **Correção:** reduza o arquivo (a planilha modelo tem cerca de 130 KB).
- **Erro:** planilha fora do modelo. A tela mostra: `Não achei as abas "COMPARATIVO - NVT/ITJ/IOA" com a linha "USD POR 40HQ". Use a planilha modelo.` → **Correção:** use a planilha modelo da Wellmix.
- **Erro:** planilha sem nenhum frete. "A planilha não tem nenhum frete preenchido." → **Correção:** preencha os preços e envie de novo.
- **Erro:** data de referência inválida. "Data de referência inválida." → **Correção:** escolha a data pelo calendário do campo.
- **Erro:** nenhum arquivo escolhido. O campo é obrigatório e, se o envio chegar ao servidor, a tela mostra "Escolha a planilha." → **Correção:** escolha a planilha antes de clicar em "Enviar planilha".

#### Passo a passo em texto

1. No menu, abra "Pedidos" e clique em "Minha tabela de frete". (Ou, no pedido em Embarque, clique em "Importar planilha" no quadro "Sua tabela de frete"; o link "← Voltar ao pedido" volta ao pedido.)
2. Confira, em "Esta planilha vai para", que a planilha vai para a sua companhia.
3. Em "Planilha (.xlsx ou .xlsm)", escolha o arquivo no modelo da Wellmix (abas COMPARATIVO - NVT, ITJ e IOA), com os seus preços.
4. Em "Data de referência", deixe o dia de hoje ou escolha a data da sua cotação.
5. Clique em "Enviar planilha". A tela mostra "Planilha enviada: N tarifas. A Wellmix já recebeu."
6. Leia a conferência ("Conferência sem avisos: os totais da planilha batem com a conta."). Aviso amarelo pede correção: ajuste a planilha e envie de novo.
7. Use "Como na planilha" e "Resumo (com PTAX e IOF)" para ver os valores como na planilha e com PTAX e IOF.
8. Para trocar os preços, envie uma planilha nova: ela vira "Vigente" e a anterior fica "Substituído", em "Importações".

#### Legendas na tela em EN e ZH

| Marca | EN | ZH |
| --- | --- | --- |
| `[TÍTULO]` | MAR-02 · Send the freight table | MAR-02 · 上传运价表 |
| `[MAPA etapa 7]` | Stage 7 of 9: Shipping and sea | 第 7 阶段（共 9 个）：装运与海运 |
| `[SETA]` uma tabela por companhia | One table per line, valid for all orders | 每家船公司一张表，适用于所有订单 |
| `[PASSO 1/4]` | Open the table screen: "My freight table" | 打开运价表页面：“我的运价表” |
| `[BOTÃO]` menu | "My freight table" | “我的运价表” |
| `[BOTÃO]` no pedido | "Import spreadsheet" | “导入表格” |
| `[SETA]` voltar | "← Back to the order" | “← 返回订单” |
| `[SETA]` Fretes | "Freight": a different screen, not the table | “运费”：另一个页面，不是运价表 |
| `[QUEM VÊ]` | Send your freight spreadsheet to Wellmix. Only you and Wellmix see it; other lines do not. | 把你的运费表发给 Wellmix。只有你和 Wellmix 能看到，其他船公司看不到。 |
| `[SETA]` goes to | "This spreadsheet goes to": Your line; block names in the spreadsheet do not matter. | “此表上传至”：你的船公司；表中区块的名称无关紧要。 |
| `[ATENÇÃO]` xls | Old .xls format: open it in Excel and save as .xlsx or .xlsm. | 旧版 .xls 格式：请在 Excel 中另存为 .xlsx 或 .xlsm。 |
| `[ATENÇÃO]` senha | The spreadsheet is password-protected. Open it in Excel, remove the opening password (File → Info → Protect Workbook) and send it again. | 表格设有打开密码。请在 Excel 中取消打开密码（文件 → 信息 → 保护工作簿）后重新上传。 |
| `[DICA]` tamanho | Spreadsheet too large (max 4 MB). | 表格过大（最大 4 MB）。 |
| `[PASSO 2/4]` | Choose the file and the reference date: "Spreadsheet (.xlsx or .xlsm)", "Reference date" | 选择文件和参考日期：“表格（.xlsx 或 .xlsm）”、“参考日期” |
| `[SETA]` data | Date of your quotation. | 你的报价日期。 |
| `[PASSO 3/4]` | Send the spreadsheet | 上传表格 |
| `[BOTÃO]` enviar | "Send spreadsheet" | “上传表格” |
| `[SETA]` sucesso | Spreadsheet sent: 2 rates. Wellmix has received it. | 已上传：2 条运价。Wellmix 已收到。 |
| `[SETA]` vigente | "Current" | “当前” |
| `[PASSO 4/4]` | Read the check | 查看核对结果 |
| `[SETA]` conferência | Check passed: the spreadsheet totals match the calculation. | 核对无提示：表格总额与计算一致。 |
| `[SETA]` para saber | Good to know (1): just for information | 提示（1）：仅供参考 |
| `[BOTÃO]` visão 1 | "As in the spreadsheet" | “与表格相同” |
| `[BOTÃO]` visão 2 | "Summary (with PTAX and IOF)" | “摘要（含 PTAX 和 IOF）” |
| `[SETA]` totais | Summary totals include PTAX and IOF | 摘要中的总额包含 PTAX 和 IOF |
| `[SETA]` histórico | "Current" and "Replaced" in the "Status" column | “状态”列中的“当前”和“已替换” |
| `[BOTÃO]` ver | "View" | “查看” |
| `[SETA]` aviso antigo | You are viewing an old tariff (reference 11/10/2026). | 您正在查看旧运价表（参考日期 2026/11/10）。 |
| `[SETA]` ver vigente | "View the current one" | “查看当前运价表” |
| `[DEPOIS]` | Wellmix is notified and uses your table in the comparison and in the freight per m³. | Wellmix 会收到通知，并在对比和每立方米运费中使用你的运价表。 |
| `[QUEM VÊ]` depois | Only you and Wellmix see your table | 只有你和 Wellmix 能看到你的运价表 |
| `[RESUMO]` | 1 Open My freight table · 2 Choose the file and the date · 3 Send spreadsheet · 4 Read the check | 1 打开“我的运价表” · 2 选择文件和日期 · 3 上传表格 · 4 查看核对结果 |

#### Narração completa em EN

| Cena | Tempo | Narração (EN) |
| --- | --- | --- |
| 1 · Gancho | 0:00–0:10 | Send your freight table once, and Wellmix already compares your prices with those of the other shipping lines. |
| 2 · Para que serve a tabela | 0:10–0:24 | The table is not for a single order: it is your price list. Wellmix uses it to compare shipping lines and to update the freight per cubic meter in the price. |
| 3 · Dois caminhos até a tela | 0:24–0:46 | There are two ways in. In the Orders menu, choose My freight table. Or, on an order in Shipping, click Import spreadsheet: it is the same screen, with a link back to the order. The Freight item is a different matter: it holds the freight requests per product. |
| 4 · A tela e quem vê | 0:46–1:08 | This is your screen. The field This spreadsheet goes to already shows your company: the spreadsheet always goes in your name. Only you and Wellmix see the content; the other lines do not. |
| 5 · Preparar a planilha | 1:08–1:34 | Use Wellmix's freight estimate spreadsheet, with the COMPARATIVO - NVT, ITJ and IOA tabs. Fill in the freight per 40HQ container for each origin port, the fees, PTAX, IOF and payment terms. Save as xlsx or xlsm: macros are not run. |
| 6 · Escolher o arquivo e enviar | 1:34–2:00 | In Spreadsheet, click to choose the file. The Reference date is already filled in with today: change it to the date of your quotation if it is a different one. Check it and click Send spreadsheet. |
| 7 · O resultado | 2:00–2:30 | Done: the green notice confirms it, with the number of rates read. Below, four cards: the reference date with the Current badge, the spreadsheet exchange rate, the freight to the DC and the number of rates. Wellmix has already received the notice. |
| 8 · A conferência | 2:30–2:54 | Read the check. When everything matches, you see Check passed. A yellow notice asks for a correction: fix the spreadsheet and send it again. The blue ones, under Good to know, are just information. |
| 9 · As duas visões da planilha | 2:54–3:18 | Below, two buttons. As in the spreadsheet shows the values as you entered them. Summary, with PTAX and IOF, shows the totals the portal calculates, so they are higher than the spreadsheet's own. |
| 10 · Trocar a tabela e o histórico | 3:18–3:44 | When your prices change, send a new spreadsheet. The new one becomes the Current one and the previous one becomes Replaced, but stays in the history, under Imports. Click View to open an old one: a notice reminds you it is not the current one. |
| 11 · Depois | 3:44–4:00 | Wellmix is notified of the new table and the comparison already uses your prices. You do not see the other lines' tables. |
| 12 · Resumo e próximo vídeo | 4:00–4:14 | In short: open My freight table, choose the spreadsheet and the date, click Send spreadsheet and read the check. When your prices change, send another one. |

#### Narração completa em ZH

| Cena | Tempo | Narração (ZH) |
| --- | --- | --- |
| 1 · Gancho | 0:00–0:10 | 运价表只需上传一次，Wellmix 就会把你的价格与其他船公司的价格对比。 |
| 2 · Para que serve a tabela | 0:10–0:24 | 运价表不属于某一个订单，而是你的价格表。Wellmix 用它来对比船公司，并更新价格中每立方米的运费。 |
| 3 · Dois caminhos até a tela | 0:24–0:46 | 有两种进入方式。在“订单”菜单中选择“我的运价表”。或者在装运阶段的订单里点击“导入表格”：进入的是同一个页面，并带有返回订单的链接。“运费”是另一回事：那里是按产品的运费询价。 |
| 4 · A tela e quem vê | 0:46–1:08 | 这是你的页面。“此表上传至”已显示你的船公司：表格总是以你的名义导入。只有你和 Wellmix 能看到内容，其他船公司看不到。 |
| 5 · Preparar a planilha | 1:08–1:34 | 请使用 Wellmix 的运费估算表，其中有 COMPARATIVO - NVT、ITJ 和 IOA 工作表。填写每个起运港每个 40HQ 集装箱的运费、各项费用、PTAX、IOF 和付款期限。保存为 xlsx 或 xlsm：宏不会被执行。 |
| 6 · Escolher o arquivo e enviar | 1:34–2:00 | 在“表格”处点击选择文件。“参考日期”默认是今天：如果你的报价是另一天，请改成报价日期。核对后点击“上传表格”。 |
| 7 · O resultado | 2:00–2:30 | 完成：绿色提示确认上传，并显示读取到的运价条数。下方是四张卡片：带“当前”标记的参考日期、表格汇率、到配送中心的陆运和运价条数。Wellmix 已经收到通知。 |
| 8 · A conferência | 2:30–2:54 | 请查看核对结果。一切一致时会显示“核对无提示”。黄色提示需要更正：修改表格后重新上传。蓝色的“提示”只是信息。 |
| 9 · As duas visões da planilha | 2:54–3:18 | 下方有两个按钮。“与表格相同”显示你填写的原始数值。“摘要（含 PTAX 和 IOF）”显示门户计算的总额，所以比表格自身的总额更高。 |
| 10 · Trocar a tabela e o histórico | 3:18–3:44 | 价格变化时，请上传新表。新表成为“当前”，旧表变为“已替换”，但仍保留在“导入记录”里。点击“查看”可打开旧表：页面会提示它不是当前运价表。 |
| 11 · Depois | 3:44–4:00 | Wellmix 会收到新运价表的通知，对比已经使用你的价格。你看不到其他船公司的运价表。 |
| 12 · Resumo e próximo vídeo | 4:00–4:14 | 总结：打开“我的运价表”，选择表格和日期，点击“上传表格”，并查看核对结果。价格变化时，再上传一张。 |

#### Notas de gravação

- Prepare o ponto `antes-MAR-02` (guia, seção 7.2) com a Marítima SA **sem** tabela enviada. Duas gravações: en e zh.
- A planilha de demonstração tem de ter a estrutura do modelo real (abas COMPARATIVO - NVT, ITJ e IOA, linha "USD POR 40HQ", parâmetros e taxas). O modelo real não está no repositório: peça-o à Wellmix. O auxiliar `xlsxFile`/`ownSheet` de `tests/unit/freight-tariff.test.ts` mostra a estrutura mínima. Use **valores fictícios** e não os apresente como tarifa real.
- Tenha pronto um arquivo inválido (qualquer arquivo de texto renomeado para .xlsx) para a cena de erro: a mensagem sai "Could not read the file. Send the spreadsheet as .xlsx or .xlsm."
- A cena 3 (botão do pedido) exige um pedido com a etapa Embarque aberta: grave-a antes do MAR-01 confirmar o embarque. A tela de tarifário abre também com `?from=` (link "← Back to the order").
- No quadro de resultado, o bloco "NAVEGANTES tab parameters" mostra a data de referência em dd/mm/aaaa em qualquer idioma, enquanto o cartão do alto a mostra no formato do idioma (mm/dd/aaaa em en). Não dê zoom nesse bloco (ver Pontos a confirmar).
- O cartão "Rates" diz "1 shipping lines · 1 destinations" (plural fixo). Evite o zoom ou aceite o texto como está.
- A data de referência padrão é o dia de hoje em Brasília; a faixa de histórico mostra as datas no formato do idioma.
- Não mostre o aviso que a Wellmix recebe ("Tabela de frete nova: Marítima SA"): ele pertence à série da Wellmix.

#### Pontos a confirmar

- ⚠ O modelo real da planilha da Wellmix (COMPARATIVO - NVT, ITJ e IOA) é necessário para gravar; o repositório só tem a estrutura simulada dos testes.
- ⚠ A data de referência aparece em dois formatos na mesma tela: no cartão do alto, no formato do idioma (mm/dd/aaaa em en, aaaa/mm/dd em zh); no bloco "tab parameters", sempre em dd/mm/aaaa (conferi em en e em zh). Confirmar se a Wellmix quer uniformizar antes da gravação.
- ⚠ O texto "1 shipping lines · 1 destinations" não trata o singular (chaves `tariff.stat.ratesDetail`).
- ⚠ O aviso que a Wellmix recebe ("Tabela de frete nova: <companhia>") está fixo em português no código (`freight-tariff.ts`); não faz parte deste vídeo.
- ⚠ Não confirmei visualmente o aviso amarelo de conferência (só o verde e o azul "Para saber"); a cor vem do comentário do código (`WarningBoxes`).
- ⚠ A tela Fretes (pedidos de cotação de frete por produto, `/app/freight/[id]`, com "Informar o frete") não tem episódio: sugerido MAR-03.

---

## Série TRA · Transportador

Vídeos para o transportador, a empresa que leva a carga do porto até o cliente: a Trans Rodo (`transportadora@rodo.com`, tela em pt). Quem está na estrada usa o celular, por isso a série tem um episódio só para a versão móvel.

**O que o transportador vê** (docs/ACCESS.md, docs/WORKFLOW.md): menu **Início** ("Pendências", "Notificações", "Mensagens") e **Pedidos**. No pedido em que está designado vê o cartão **Carga e entrega** (a mercadoria, as caixas, o volume e o peso previstos na ficha de compra, a chegada do navio com navio e data de embarque, a liberação aduaneira e onde entregar: o cliente, o endereço e o contato) e a etapa **Transporte** (a etapa dele aparece mesmo antes de começar).

**O que o transportador não vê:** o fornecedor (em lugar nenhum), os preços e valores comerciais e as etapas dos outros parceiros.

**Conta de gravação:** `transportadora@rodo.com` (senha `wellmix123`), tela em pt. Chrome em pt-BR, para as datas saírem em dd/mm/aaaa. O TRA-02 grava-se no celular (Chrome emulando iPhone, sem o zoom do navegador, guia seção 3).

**Documentos lidos:** GUIA.md, 02-cliente.md (modelo), SCOPE.md, WORKFLOW.md (etapa Transporte, datas em ordem, quem vê o quê), ACCESS.md, `src/lib/services/order-cargo.ts`, `src/lib/workflow/stages.ts` e `engine.ts`, `src/components/requirement-form.tsx`, o módulo de dicionário `orders` e o E2E `tests/e2e/happy-path.spec.ts` (passo 12).

### TRA-01 · Registrar o transporte e a entrega

> **Promessa:** ao final do vídeo você sabe conferir a carga e o endereço, informar placa, previsão e situação do transporte e confirmar a entrega.

| Ficha | |
| --- | --- |
| Série e papel | Transportador (Trans Rodo) |
| Conta de gravação | `transportadora@rodo.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa) |
| Duração-alvo | 3:33 |
| Ponto da jornada | Etapa 8 de 9: Desembaraço e transporte |
| Telas e rotas | `/app` (Pendências), `/app/orders/[id]` (cartão Carga e entrega e etapa Transporte), `/app/notifications` |
| Dados antes de gravar | Pedido da Jarra de vidro 1,5 L (UTL-001) com o Desembaraço concluído (liberação aduaneira) e a etapa Transporte em andamento, com a Trans Rodo no pedido; o Embarque com data de embarque, previsão de chegada e navio informados; o cliente com cidade, contato e endereço em Cadastros (senão a tela mostra "Endereço de entrega não cadastrado: combine com a Wellmix."). Ponto de salvamento `antes-TRA-01` |
| Depois deste vídeo | A etapa Transporte conclui e a Entrega abre: o cliente recebe o aviso para confirmar o recebimento (sino e Pendências); com a confirmação, o pedido é encerrado |
| Antes · Próximo | Desembaraço (despachante) · TRA-02 |
| Idiomas | pt (base) |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: A tela "Minhas pendências" com a linha "Pedido #1: Transporte" em destaque; o cursor repousa perto do botão "Abrir".
- 🎙 Narração: "Carga na estrada? Em poucos toques você informa a placa, a previsão e confirma a entrega. A Wellmix e o cliente acompanham."
- 🔤 Na tela: `[TÍTULO]` "TRA-01 · Registrar o transporte e a entrega"; `[ZOOM 150 %]` na linha da pendência
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: A mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Estamos na etapa oito: desembaraço e transporte. O despachante já liberou a carga na alfândega e agora é a vez do transportador."
- 🔤 Na tela: `[MAPA etapa 8]` com "Desembaraço e transporte" acesa
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:38 · Abrir a pendência · `/app` → `/app/orders/[id]`**

- 🎬 Imagem: O cursor passa pelo sino (com o número de avisos) e pela linha da pendência (título, detalhe, tipo e prazo) e clica em "Abrir". A página do pedido carrega.
- 🎙 Narração: "Quando o transporte começa, você recebe um aviso no sino e uma pendência. Clique em Abrir, ou no título do pedido, para entrar nele."
- 🔤 Na tela: `[PASSO 1/6]` Abra a pendência; `[BOTÃO]` "Abrir"; `[SETA]` "Sino: seus avisos" apontando o sino
- ✂️ Edição: clique com onda; `[CORTE]` seco para a página do pedido. A coluna "Detalhe" lista os nomes de item gravados no sistema; não dê zoom nela (ver Notas).

**Cena 4 · 0:38–1:08 · Carga e entrega · `/app/orders/[id]`**

- 🎬 Imagem: No alto do pedido, o cartão "Carga e entrega". O cursor desce pelas linhas: "Mercadoria", "Caixas master", "Volume total (CBM)", "Peso bruto total", "Chegada do navio" (com "Navio / viagem" e "Embarcado em"), "Liberação aduaneira" e "Entregar em" (cliente, endereço e "Contato").
- 🎙 Narração: "No alto do pedido está o cartão Carga e entrega. Ele traz a mercadoria, as caixas, o volume e o peso previstos, para você conferir no carregamento. Veja também quando o navio chega e se a alfândega já liberou. Por fim, o endereço e o contato de quem recebe."
- 🔤 Na tela: `[PASSO 2/6]` Confira a carga e o endereço; `[SETA]` "O que você vai transportar e para onde. Caixas, volume e peso são os previstos na ficha de compra: confira no carregamento."; `[SETA]` "Entregar em": cliente, endereço e contato; `[ZOOM 150 %]` no cartão; `[QUEM VÊ]` "O transportador não vê o fornecedor nem os valores"
- ✂️ Edição: mantenha 3 s em cada metade do cartão. Se o endereço do cliente não estiver cadastrado, a tela mostra "Endereço de entrega não cadastrado: combine com a Wellmix.": cadastre antes de gravar (ver Notas).

**Cena 5 · 1:08–1:28 · A etapa Transporte · `/app/orders/[id]`**

- 🎬 Imagem: Rolar até a tabela "Etapas do pedido" (uma linha, "Transporte") e o cartão da etapa: "Placa do veículo", "Previsão de chegada", "Situação do transporte" ("opcional") e "Entrega realizada", todos "Pendente".
- 🎙 Narração: "Mais abaixo está a etapa Transporte, com quatro itens: placa do veículo, previsão de chegada, situação do transporte, que é opcional, e a entrega realizada."
- 🔤 Na tela: `[SETA]` "Quatro itens; só a situação é opcional"; `[ZOOM 150 %]` no cartão da etapa
- ✂️ Edição: pausa de 2 s no cartão.

**Cena 6 · 1:28–1:48 · Placa do veículo · `/app/orders/[id]`**

- 🎬 Imagem: No item "Placa do veículo", digitar "ABC1D23" e clicar em "Enviar". O item vira "Concluído" e mostra a placa, "Enviado por" e a data.
- 🎙 Narração: "Digite a placa do veículo e toque em Enviar. O item vira Concluído, com o seu nome e a data. A Wellmix acompanha a placa no pedido."
- 🔤 Na tela: `[PASSO 3/6]` Informe a placa; `[BOTÃO]` "Enviar"; `[SETA]` "Concluído · enviado por você"
- ✂️ Edição: use uma placa fictícia (formato Mercosul, ABC1D23); nunca a placa de um veículo real. Digitação em tempo real.

**Cena 7 · 1:48–2:16 · Previsão de entrega e a ordem das datas · `/app/orders/[id]`**

- 🎬 Imagem: No item "Previsão de chegada", abrir o calendário: os dias antes da chegada do navio aparecem bloqueados. Digitar uma data anterior: o campo fica com borda vermelha e o aviso aparece embaixo. Escolher uma data possível e clicar em "Enviar".
- 🎙 Narração: "Em Previsão de chegada, escolha o dia em que a carga chega ao cliente. A data nunca pode ser antes da chegada do navio: o calendário bloqueia esses dias e, se você digitar uma menor, o aviso vermelho aparece. Escolha uma data possível e clique em Enviar."
- 🔤 Na tela: `[PASSO 4/6]` Informe a previsão de entrega; `[ERRO COMUM]` "A previsão de entrega não pode ser antes da previsão de chegada do navio (18/12/2026)."; `[BOTÃO]` "Enviar"; `[ZOOM 150 %]` na mensagem vermelha
- ✂️ Edição: segure 2 s na mensagem vermelha. Atenção: nesta etapa o campo se chama "Previsão de chegada" (o mesmo nome do Embarque), mas a mensagem e a ajuda falam em "previsão de entrega" (ver Pontos a confirmar).

**Cena 8 · 2:16–2:34 · Situação do transporte (opcional) · `/app/orders/[id]`**

- 🎬 Imagem: No item "Situação do transporte", digitar "Caminhão saiu do porto de Navegantes; chegada prevista na tarde de 28/12." e clicar em "Enviar". O item vira "Concluído".
- 🎙 Narração: "A situação do transporte é opcional. Use para avisar onde a carga está, por exemplo, que o caminhão saiu do porto. Escreva a informação mais útil: o item recebe um único envio."
- 🔤 Na tela: `[PASSO 5/6]` Conte a situação (opcional); `[BOTÃO]` "Enviar"; `[ATENÇÃO]` "Depois de enviada, a situação não pode ser editada na tela; para novidades, use Conversar com a Wellmix"
- ✂️ Edição: o texto é um exemplo; troque a data pelo dia da gravação ou omita-a.

**Cena 9 · 2:34–2:58 · Entrega realizada · `/app/orders/[id]`**

- 🎬 Imagem: No item "Entrega realizada", clicar em "Confirmar". A página recarrega: o selo do pedido muda para "Entrega", a etapa "Transporte" fica "Concluída" (100 %, "4 de 4").
- 🎙 Narração: "Quando entregar, toque em Confirmar, no item Entrega realizada. Confirme só depois de a carga ter sido entregue: a tela não tem botão para desfazer. A etapa fecha com cem por cento."
- 🔤 Na tela: `[PASSO 6/6]` Confirme a entrega; `[BOTÃO]` "Confirmar"; `[ATENÇÃO]` "Confirme só depois de entregar: não há botão para desfazer"
- ✂️ Edição: clique com onda; `[CORTE]` na recarga.

**Cena 10 · 2:58–3:18 · Depois · `/app/orders/[id]` → `/app`**

- 🎬 Imagem: Voltar a "Minhas pendências": aparece "Nenhuma pendência. Bom trabalho." Em seguida, o sino: o aviso do transporte continua na lista até clicar em "Resolver".
- 🎙 Narração: "A etapa Entrega abre para o cliente, que recebe o aviso para confirmar o recebimento. Quando ele confirma, o pedido é encerrado. Para você, a lista fica limpa: Nenhuma pendência. Bom trabalho."
- 🔤 Na tela: `[DEPOIS]` "O cliente é avisado para confirmar o recebimento; com a confirmação, o pedido é encerrado."; `[SETA]` "Nenhuma pendência. Bom trabalho."
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s, depois a tela de pendências ao fundo.

**Cena 11 · 3:18–3:33 · Resumo e próximo vídeo**

- 🎬 Imagem: Fundo vermelho com a lista; no fim, a miniatura do TRA-02.
- 🎙 Narração: "Resumindo: abra a pendência, confira a carga e o endereço, informe placa e previsão, e confirme a entrega. No próximo vídeo, veja tudo isso no celular."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência · 2 Confira a carga e o endereço · 3 Placa e previsão de entrega · 4 Confirmar a entrega"; chamada "Próximo: TRA-02 · Versão no celular"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Erro:** previsão de entrega antes da chegada do navio. O campo avisa na hora "A previsão de entrega não pode ser antes da previsão de chegada do navio (18/12/2026)." e o envio fica bloqueado; se chegar ao servidor, ele recusa com "A previsão de entrega não pode ser antes da previsão de chegada do navio." → **Correção:** escolha uma data igual ou posterior à chegada do navio (o calendário já bloqueia as anteriores).
- **Erro:** data que não existe. A recusa é "Informe uma data válida." → **Correção:** escolha o dia pelo calendário.
- **Aviso:** endereço do cliente sem cadastro. O cartão mostra "Endereço de entrega não cadastrado: combine com a Wellmix." → **Correção:** combine o local de entrega com a Wellmix, por "Conversar com a Wellmix".
- **Aviso:** liberação aduaneira ainda não confirmada. O cartão mostra "Ainda não liberada" → **Correção:** espere a liberação; a etapa de transporte só começa depois dela.
- **Cuidado:** confirmar a entrega antes de entregar. A tela não tem botão para desfazer → **Correção:** confirme só com a carga entregue; em caso de engano, fale com a Wellmix.

#### Passo a passo em texto

1. No menu, abra "Pendências" e clique em "Abrir" na linha "Pedido #1: Transporte".
2. No pedido, confira o cartão "Carga e entrega": a mercadoria, as caixas, o volume e o peso previstos, a chegada do navio, a liberação aduaneira e onde entregar (cliente, endereço e contato).
3. Na etapa "Transporte", em "Placa do veículo", digite a placa e clique em "Enviar".
4. Em "Previsão de chegada", escolha o dia em que a carga chega ao cliente (nunca antes da chegada do navio) e clique em "Enviar".
5. Se quiser, em "Situação do transporte", conte onde a carga está e clique em "Enviar".
6. Depois de entregar, em "Entrega realizada", clique em "Confirmar". A etapa conclui e a Entrega abre para o cliente.
7. Dúvidas: clique em "Conversar com a Wellmix".

#### Notas de gravação

- Prepare o ponto `antes-TRA-01` (guia, seção 7.2) com a Jornada da Jarra até o Desembaraço concluído.
- Cadastre o endereço do cliente antes de gravar: em Cadastros → cliente (`/app/parties/[id]`, bloco com Cidade, Contato e Endereço). Use um endereço fictício. Sem ele a cena 4 mostra "Endereço de entrega não cadastrado: combine com a Wellmix."
- Esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3).
- A coluna "Detalhe" da pendência lista os nomes de item gravados ("Placa do veículo, Previsão de entrega, …"), e o item da previsão aparece no pedido como "Previsão de chegada". Evite o zoom na coluna e fale "previsão de chegada ao cliente" quando mostrar o campo.
- Depois de enviadas, as datas aparecem no item como valor bruto ("2026-12-28"). Evite zoom nelas.
- O aviso do transporte continua em Notificações ("Falta: Placa do veículo, Previsão de chegada, Entrega realizada") até clicar em "Resolver", mesmo com a etapa concluída; se mostrar o sino, resolva antes.
- A tabela "Documentos" no fim da página lista as fotos, a arte e o BL do pedido, que o transportador não precisa ver: não role até o fim.
- Datas: a previsão de entrega tem de ser igual ou posterior à chegada do navio informada no Embarque; não cite as datas na narração.

#### Pontos a confirmar

- ⚠ O item da previsão de entrega aparece na tela como "Previsão de chegada" (a chave `req.eta` do dicionário vale para o Embarque e para o Transporte), enquanto a ajuda da etapa, a pendência e a mensagem de erro falam em "previsão de entrega". Confirmar com a Wellmix se o rótulo deve mudar antes da gravação.
- ⚠ A situação do transporte só aceita um envio: depois de enviada o formulário some. Confirmar se é intencional (o transportador não consegue atualizar a situação durante a viagem pelo portal).
- ⚠ Datas concluídas aparecem no formato bruto AAAA-MM-DD, diferente das demais datas da tela.
- ⚠ Não há botão para desfazer "Entrega realizada" para o transportador; confirmar com a Wellmix quem corrige um engano e como.
- ⚠ A tela mostra o nome do cliente e o contato dele ao transportador ("Entregar em"); está de acordo com docs/WORKFLOW.md ("o cliente do pedido: endereço, cidade, contato"), mas confirme se o vídeo deve dizer isso.
- ⚠ O transportador vê a tabela "Documentos" do pedido (fotos, arte e BL com "Confirmar leitura"), que não é do transporte. Possível excesso de visibilidade (docs/ACCESS.md diz que o parceiro vê só a própria etapa).

---

### TRA-02 · Versão no celular

> **Promessa:** ao final do vídeo você sabe usar o portal no celular: navegar pelo menu, abrir o pedido, preencher os blocos da etapa Transporte e confirmar a entrega.

| Ficha | |
| --- | --- |
| Série e papel | Transportador (Trans Rodo) |
| Conta de gravação | `transportadora@rodo.com`, tela em pt, **no celular** (Chrome emulando iPhone, sem o zoom do navegador; a verificação visual usou iPhone 13: 390 de largura) |
| Duração-alvo | 2:16 |
| Ponto da jornada | Etapa 8 de 9: Desembaraço e transporte |
| Telas e rotas | `/app`, `/app/orders/[id]`, `/app/notifications`, `/app/messages` (todas em tela estreita) |
| Dados antes de gravar | O mesmo do TRA-01 (ponto `antes-TRA-01`): etapa Transporte em andamento, endereço do cliente cadastrado; os blocos ainda vazios |
| Depois deste vídeo | O mesmo do TRA-01 |
| Antes · Próximo | TRA-01 · JUR-01 |
| Idiomas | pt (base) |

#### Roteiro

**Cena 1 · 0:00–0:08 · Gancho · celular · `/app`**

- 🎬 Imagem: A tela do celular (iPhone emulado) na página inicial, com a mão tocando a linha da pendência.
- 🎙 Narração: "Na estrada, o celular resolve. O portal se ajusta à tela estreita. Veja o que muda."
- 🔤 Na tela: `[TÍTULO]` "TRA-02 · Versão no celular"
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s. Grave com o Chrome emulando iPhone, sem o zoom do navegador; mostre a moldura do aparelho só no título.

**Cena 2 · 0:08–0:20 · O alto da tela · celular · `/app`**

- 🎬 Imagem: A página inicial no celular: no alto, o logotipo, o ícone de Mensagens, o sino com o número de avisos e o botão de Menu (três linhas).
- 🎙 Narração: "Entre pelo navegador do celular. No alto ficam o logotipo, o ícone de Mensagens, o sino de notificações com o número de avisos e o botão de Menu."
- 🔤 Na tela: `[SETA]` "Mensagens" (ícone), sino com o número e "Menu"; `[ZOOM 150 %]` no alto da tela
- ✂️ Edição: esconda a faixa de demonstração (guia, seção 7.3).

**Cena 3 · 0:20–0:36 · O menu · celular · `/app`**

- 🎬 Imagem: Tocar em "Menu": abre um painel com o grupo "Início" ("Pendências", "Notificações", "Mensagens") e "Pedidos". Embaixo, o nome e o papel, os idiomas PT, EN e ZH e o botão "Sair".
- 🎙 Narração: "Toque em Menu. Abre uma lista com Pendências, Notificações, Mensagens e Pedidos. Embaixo ficam o seu nome, os idiomas PT, EN e ZH e o botão Sair."
- 🔤 Na tela: `[BOTÃO]` "Menu"; `[SETA]` "Idioma: PT, EN ou ZH"; `[BOTÃO]` "Sair"
- ✂️ Edição: esconda o seletor DEMO do painel (guia, seção 7.3).

**Cena 4 · 0:36–0:54 · Pendências no celular · celular · `/app`**

- 🎬 Imagem: Fechar o menu. Em "Minhas pendências", a tabela é mais larga que a tela: o dedo desliza para o lado e mostram-se as colunas "Detalhe", o tipo e o prazo, com o botão "Abrir" no fim. Depois, tocar no título em vermelho da pendência.
- 🎙 Narração: "As tabelas são mais largas que a tela. Deslize para o lado para ver as outras colunas. Para abrir o pedido, toque no título em vermelho: não precisa deslizar."
- 🔤 Na tela: `[SETA]` "Deslize para ver mais colunas"; `[DICA]` "Toque no título em vermelho para abrir o pedido"
- ✂️ Edição: mostre o gesto do dedo com o anel de destaque; movimento lento.

**Cena 5 · 0:54–1:14 · Carga e entrega no celular · celular · `/app/orders/[id]`**

- 🎬 Imagem: O pedido ocupa a largura da tela: título, selo, "Conversar com a Wellmix" e o cartão "Carga e entrega". Valores longos, como o endereço, saem cortados à direita; o dedo desliza a tabela do cartão para ler tudo.
- 🎙 Narração: "No pedido, o cartão Carga e entrega ocupa a largura da tela. Valores longos, como o endereço, ficam cortados: deslize a tabela para ler tudo, ou pergunte à Wellmix pelo botão Conversar."
- 🔤 Na tela: `[BOTÃO]` "Conversar com a Wellmix"; `[SETA]` "Deslize para ler o endereço inteiro"; `[ZOOM 150 %]` no cartão
- ✂️ Edição: cuidado para não cobrir o cartão com a mão do ícone de toque.

**Cena 6 · 1:14–1:36 · Formulários em blocos · celular · `/app/orders/[id]`**

- 🎬 Imagem: Na etapa "Transporte", cada item é um bloco: o nome e a situação em cima e, embaixo, o campo com o botão "Enviar". Digitar a placa; tocar em "Previsão de chegada": abre o calendário do celular; escolher uma data antes da chegada do navio mostra o aviso vermelho em duas linhas.
- 🎙 Narração: "Na etapa Transporte, cada item vira um bloco: o nome e a situação em cima, e o campo com o botão Enviar embaixo. A data abre o calendário do próprio celular. Se a data estiver errada, o aviso vermelho aparece na hora."
- 🔤 Na tela: `[PASSO 1/2]` Preencha os blocos; `[BOTÃO]` "Enviar"; `[ERRO COMUM]` "A previsão de entrega não pode ser antes da previsão de chegada do navio (18/12/2026)."
- ✂️ Edição: grave em pt-BR para o calendário sair em dd/mm/aaaa; o campo da data mostra "dd/mm/aaaa" no celular.

**Cena 7 · 1:36–1:50 · Confirmar a entrega · celular · `/app/orders/[id]`**

- 🎬 Imagem: Rolar até "Entrega realizada": o botão "Confirmar" fica sozinho na linha, abaixo do nome do item. Tocar nele.
- 🎙 Narração: "Para fechar, toque em Confirmar, em Entrega realizada. O botão fica sozinho na linha. Confirme só depois de entregar."
- 🔤 Na tela: `[PASSO 2/2]` Confirme a entrega; `[BOTÃO]` "Confirmar"; `[ATENÇÃO]` "Sem botão para desfazer"
- ✂️ Edição: toque com anel de destaque; `[CORTE]` na recarga.

**Cena 8 · 1:50–2:04 · Avisos e mensagens · celular · `/app/notifications`, `/app/messages`**

- 🎬 Imagem: Tocar no sino: a tela "Notificações" lista os avisos com o botão "Resolver". Voltar e tocar no ícone de Mensagens: a conversa com a Wellmix.
- 🎙 Narração: "Dúvida durante a viagem? Toque no ícone de Mensagens ou em Conversar com a Wellmix. O sino mostra os avisos novos."
- 🔤 Na tela: `[SETA]` "Notificações"; `[SETA]` "Mensagens"
- ✂️ Edição: mostre só a lista; não envie mensagem real.

**Cena 9 · 2:04–2:16 · Resumo**

- 🎬 Imagem: Fundo vermelho com a lista.
- 🎙 Narração: "Resumindo: Menu para navegar, deslizar as tabelas, tocar no título para abrir e preencher os blocos. Tudo no celular."
- 🔤 Na tela: `[RESUMO]` "1 Menu para navegar · 2 Deslize as tabelas · 3 Toque no título para abrir · 4 Preencha os blocos e confirme"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Cuidado:** tabela cortada na tela. Não é erro: as tabelas rolam para o lado dentro da própria caixa; deslize com o dedo.
- **Erro:** previsão de entrega antes da chegada do navio. O aviso vermelho diz "A previsão de entrega não pode ser antes da previsão de chegada do navio (18/12/2026)." → **Correção:** escolha uma data igual ou posterior.

#### Passo a passo em texto

1. Abra o portal no navegador do celular e entre com o seu e-mail e a senha.
2. Toque em "Menu" para ir a "Pendências", "Notificações", "Mensagens" ou "Pedidos". No mesmo painel ficam o idioma (PT, EN, ZH) e "Sair".
3. Nas listas, deslize a tabela para o lado para ver todas as colunas; toque no título em vermelho para abrir o pedido.
4. No pedido, confira o cartão "Carga e entrega" (deslize para ler os valores cortados).
5. Na etapa "Transporte", preencha cada bloco e toque em "Enviar"; no fim, toque em "Confirmar" em "Entrega realizada".
6. Dúvidas: toque no ícone de Mensagens ou em "Conversar com a Wellmix".

#### Notas de gravação

- Chrome em modo de dispositivo (iPhone), sem o zoom do navegador; grave a tela de 390 px de largura e entregue em 1920 × 1080 com o celular centralizado sobre o fundo grafite `#17181C`, ou em vertical 1080 × 1920 para publicar também como vídeo curto. Escolha uma das duas e use a mesma nos demais episódios móveis.
- O portal não tem aplicativo nativo (docs/SCOPE.md): é o mesmo site responsivo. No celular, o seletor PT / EN / ZH e o seletor DEMO ficam dentro do painel do Menu; esconda o DEMO (guia, seção 7.3).
- Grave em pt-BR para o calendário e o campo de data saírem em dd/mm/aaaa (o emulador em en-US mostra mm/dd/yyyy).
- As tabelas de pendências, de etapas e de documentos são mais largas que o celular e rolam para o lado dentro da própria caixa: mostre o gesto em vez de tentar encaixar tudo.
- O campo da placa é um campo de texto de várias linhas (`textarea`) com o botão Enviar ao lado; a tecla Enter do teclado do celular quebra a linha em vez de enviar. Mostre o toque no botão.
- Reaproveite o dado do TRA-01 (ponto `antes-TRA-01`), regravando só as cenas no celular.

#### Pontos a confirmar

- ⚠ A tabela de pendências no celular esconde o botão "Abrir" e o prazo à direita (é preciso deslizar); confirmar se a Wellmix quer uma lista em cartões para telas estreitas.
- ⚠ Os valores longos do cartão "Carga e entrega" (nome do produto, navio, endereço) saem cortados na tela estreita; confirmar se isso é aceito.
- ⚠ O teste em celular real (iOS e Android) não foi feito: usei o Chrome emulando iPhone 13. Confirmar o calendário nativo e o teclado em aparelho de verdade.
- ⚠ O campo da placa não força letras maiúsculas nem limita o tamanho; confirmar se a Wellmix quer isso (fora do roteiro).

---

## Série JUR · Jurídico

Vídeo para o jurídico da Wellmix: a Júlia Jurídico (`juridico@wellmix.com`, tela em pt). O jurídico é um login interno, com papel próprio (não é operador nem administrador da Wellmix) e cuida das **multas** dos pedidos.

**O que o jurídico vê** (docs/ACCESS.md): menu **Início** ("Pendências", "Notificações", "Mensagens") e **Pedidos** ("Pedidos" e "Multas"). Em "Pedidos" abre qualquer pedido, com o resumo (cliente, fornecedor, data), os itens sem preço, a etapa em andamento, os documentos e a seção "Multas". Em "Multas" vê **todas** as multas e muda a situação de cada uma.

**O que o jurídico não vê:** preços e valores do pedido, pagamentos, financeiro, margem, cadastros e configurações. Não **registra** multas (isso é da Wellmix: diretorias e administrador, no pedido).

**Conta de gravação:** `juridico@wellmix.com` (senha `wellmix123`), tela em pt. Chrome em pt-BR, para as datas saírem em dd/mm/aaaa.

**Documentos lidos:** GUIA.md, 02-cliente.md (modelo), SCOPE.md, WORKFLOW.md (quem vê o quê, multas, Control Tower), ACCESS.md, `src/app/app/penalties/page.tsx`, `src/app/app/actions.ts` (`createPenaltyAction`, `updatePenaltyStatusAction`), a seção de multas de `src/app/app/orders/[id]/page.tsx`, `src/lib/services/control-tower.ts` e `tower-board.ts`.

### JUR-01 · Multas: visualizar e mudar o status

> **Promessa:** ao final do vídeo você sabe encontrar as multas dos pedidos, ler o motivo, o valor e a evidência, e mudar a situação de cada uma.

| Ficha | |
| --- | --- |
| Série e papel | Jurídico (Júlia Jurídico) |
| Conta de gravação | `juridico@wellmix.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa) |
| Duração-alvo | 3:16 |
| Ponto da jornada | Fora das 9 etapas: a multa acompanha o pedido, em paralelo (use o selo "paralelo" do guia, seção 6.1) |
| Telas e rotas | `/app/notifications`, `/app/penalties` (Pedidos → Multas), `/app/orders/[id]` (seção Multas) |
| Dados antes de gravar | Um pedido com **duas multas** registradas pela Wellmix (administrador ou diretoria, no pedido, botão "Registrar multa"): "Atraso na saída do navio: embarque confirmado depois do prazo combinado." (R$ 1.500,00, responsável Marítima SA) e "Avaria na entrega: duas caixas chegaram amassadas." (R$ 820,00, responsável Trans Rodo, com uma foto de evidência fictícia). Ponto de salvamento `antes-JUR-01` |
| Depois deste vídeo | A situação das multas muda e fica na auditoria; a Control Tower deixa de contar como "Multa aberta" as que ficaram Paga ou Cancelada; ninguém recebe aviso automático |
| Antes · Próximo | TRA-02 · OCP-01 |
| Idiomas | pt (base) |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/penalties`**

- 🎬 Imagem: A tela "Multas" com duas multas, a situação "Em aberto" em vermelho e os botões de cada linha.
- 🎙 Narração: "Uma multa foi registrada e o caso está com o jurídico. Veja como acompanhar cada uma e mudar a situação, sem sair do portal."
- 🔤 Na tela: `[TÍTULO]` "JUR-01 · Multas: visualizar e mudar o status"; `[ZOOM 150 %]` na coluna da situação e nos botões
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:20 · Onde estou na jornada · `/app`**

- 🎬 Imagem: A página inicial do jurídico, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "A multa não é uma etapa da jornada: ela acompanha o pedido, em paralelo. Quem registra é a Wellmix; o jurídico acompanha."
- 🔤 Na tela: `[MAPA]` com as 9 etapas apagadas e o selo "Multas: acompanham o pedido (paralelo)"
- ✂️ Edição: o mapa sai em 6 s; use o selo "paralelo" do guia (seção 6.1).

**Cena 3 · 0:20–0:42 · O que é uma multa · `/app/orders/[id]#order-penalties`**

- 🎬 Imagem: Abrir um pedido e rolar até a seção "Multas": uma tabela com "Valor", "Situação", "Motivo" e "Responsável". Mostrar uma linha: valor, situação "Em aberto", motivo e o parceiro responsável.
- 🎙 Narração: "Multa é uma penalidade que a Wellmix registra num pedido por atraso, avaria ou descumprimento. Cada uma tem o responsável, o valor, o motivo e, às vezes, uma evidência em arquivo."
- 🔤 Na tela: `[SETA]` "Multas registradas pela Wellmix por atraso, avaria ou descumprimento, com responsável, valor e evidência. O jurídico acompanha e altera a situação: contestada, paga ou cancelada."; `[QUEM VÊ]` "Registrar multa é só da Wellmix (diretorias e administrador); o jurídico acompanha"; `[ZOOM 150 %]` na linha da multa
- ✂️ Edição: grave este trecho a partir do pedido aberto pelo jurídico (a seção é só leitura); não mostre o formulário de registro, que o jurídico não vê.

**Cena 4 · 0:42–1:00 · O aviso de multa nova · `/app/notifications`**

- 🎬 Imagem: Clicar no sino: a tela "Notificações" lista, em "Precisa de você", os avisos "Multa registrada no pedido" com o motivo embaixo, o selo "Sua vez" e "Agora é com você". Voltar a "Minhas pendências": aparece "Nenhuma pendência. Bom trabalho."
- 🎙 Narração: "Quando a Wellmix registra uma multa, você recebe um aviso no sino, com o motivo. Ele não vira pendência: fica em Notificações. Clique em Resolver para abrir o pedido."
- 🔤 Na tela: `[PASSO 1/5]` Abra o aviso no sino; `[BOTÃO]` "Resolver"; `[ATENÇÃO]` "Multa nova chega pelo sino, não por Pendências"
- ✂️ Edição: clique com onda; `[CORTE]` para a página do pedido (ou volte à lista, se for seguir direto para Multas).

**Cena 5 · 1:00–1:14 · Abrir a tela Multas · menu → `/app/penalties`**

- 🎬 Imagem: Abrir o menu "Pedidos" e clicar em "Multas". A tela mostra todas as multas, a mais nova primeiro.
- 🎙 Narração: "No menu, abra Pedidos e clique em Multas. Aqui ficam todas as multas, as mais novas primeiro."
- 🔤 Na tela: `[PASSO 2/5]` Abra Multas; `[BOTÃO]` "Multas"
- ✂️ Edição: mostre o caminho do menu e volte; `[CORTE]` seco para a tela.

**Cena 6 · 1:14–1:44 · A tabela de multas · `/app/penalties`**

- 🎬 Imagem: O cursor percorre as colunas "Pedido", "Responsável", "Motivo", "Valor", "Data" e "Situação". Na linha com arquivo, clicar no link "Evidência" (abre o arquivo em outra aba). Passar o cursor no número do pedido e no ícone de conversa.
- 🎙 Narração: "A tabela mostra o pedido, o responsável, o motivo, o valor, a data e a situação. Quando há evidência, aparece o link Evidência ao lado do motivo: clique para abrir o arquivo. O número do pedido leva à página do pedido."
- 🔤 Na tela: `[PASSO 3/5]` Leia a tabela; `[SETA]` "Evidência": abre o arquivo; `[SETA]` "#1: abre o pedido"; `[ZOOM 150 %]` na linha
- ✂️ Edição: a evidência de exemplo é uma foto fictícia; não use documento real.

**Cena 7 · 1:44–2:06 · As situações · `/app/penalties`**

- 🎬 Imagem: Destacar a coluna "Situação" e o selo de cada linha. Mostrar, em um cartão, as quatro situações: "Em aberto", "Contestada", "Paga" e "Cancelada".
- 🎙 Narração: "Toda multa nasce Em aberto. Você pode mudar para Contestada, Paga ou Cancelada. Em aberto e Contestada continuam contando como problema na Control Tower; Paga e Cancelada tiram a multa de lá."
- 🔤 Na tela: `[SETA]` "Em aberto", "Contestada", "Paga", "Cancelada"; `[DICA]` "Na Control Tower da Wellmix, o quadro Multa aberta conta Em aberto e Contestada"
- ✂️ Edição: cartão com as quatro situações em tela cheia por 4 s, com o selo vermelho (Em aberto), âmbar (Contestada) e cinza (Paga, Cancelada), como na tela.

**Cena 8 · 2:06–2:34 · Mudar a situação · `/app/penalties`**

- 🎬 Imagem: Na linha da multa "Atraso na saída do navio…", clicar em "Contestada". A situação muda na hora, sem confirmação, e os botões da linha passam a ser "Paga" e "Cancelada". Na outra linha, clicar em "Paga".
- 🎙 Narração: "Cada linha tem um botão para cada situação possível. Clique em Contestada: a situação muda na hora, sem confirmação. Os botões passam a mostrar as outras opções, e não existe botão para voltar a Em aberto. Pense antes de clicar."
- 🔤 Na tela: `[PASSO 4/5]` Mude a situação; `[BOTÃO]` "Contestada"; `[ATENÇÃO]` "Sem confirmação e sem botão para voltar a Em aberto"
- ✂️ Edição: clique com onda; mostre a linha antes e depois; `[ZOOM 150 %]` nos botões da linha.

**Cena 9 · 2:34–2:52 · Ver o pedido · `/app/orders/[id]`**

- 🎬 Imagem: Clicar em "#1" na linha: a página do pedido abre com "Resumo do pedido" (cliente, fornecedor, data e modalidade), "Itens do pedido" (sem preços), "Etapas do pedido" (só a etapa em andamento aberta, com o link "Abrir todas as etapas") e, no fim, a seção "Multas" com as multas do pedido, só para leitura, já com as situações novas.
- 🎙 Narração: "Clique no número do pedido para ver o contexto: cliente, fornecedor, itens e a etapa em andamento, sem valores. No fim da página, a seção Multas mostra as multas do pedido, só para leitura."
- 🔤 Na tela: `[PASSO 5/5]` Confira o pedido (opcional); `[QUEM VÊ]` "O jurídico não vê preços nem pagamentos"; `[BOTÃO]` "Conversar com a Wellmix"
- ✂️ Edição: role até a seção de multas e pare 3 s; não role até o fim dos documentos.

**Cena 10 · 2:52–3:04 · Depois · `/app/penalties`**

- 🎬 Imagem: Voltar a Multas e mostrar as linhas com as situações novas.
- 🎙 Narração: "A mudança fica registrada na auditoria. Ninguém recebe aviso automático: se precisar alinhar com a Wellmix, use Conversar."
- 🔤 Na tela: `[DEPOIS]` "A situação fica gravada e na auditoria; a Wellmix a vê na seção Multas do pedido. Não há aviso automático."
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 11 · 3:04–3:16 · Resumo**

- 🎬 Imagem: Fundo vermelho com a lista.
- 🎙 Narração: "Resumindo: o aviso chega no sino, a tela Multas lista tudo, e cada linha muda de situação com um clique. Pense antes de clicar."
- 🔤 Na tela: `[RESUMO]` "1 Aviso no sino · 2 Pedidos → Multas · 3 Leia o motivo, o valor e a evidência · 4 Mude a situação (sem volta para Em aberto)"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Cuidado:** clicar na situação errada. A mudança é imediata, sem confirmação, e a tela não oferece o botão "Em aberto" para voltar → **Correção:** mude para a situação certa entre "Contestada", "Paga" e "Cancelada"; se precisar reabrir, fale com a Wellmix.
- **Aviso:** a tela vazia diz "Nenhuma multa registrada." → ainda não há multa; a Wellmix registra no pedido e você recebe o aviso no sino.
- **Aviso:** abrir uma tela fora do seu acesso. A tela volta ao início com "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** o jurídico só abre Pendências, Notificações, Mensagens, Pedidos e Multas.

#### Passo a passo em texto

1. Abra "Notificações" (sino) e clique em "Resolver" no aviso da multa, ou vá direto ao próximo passo.
2. No menu, abra "Pedidos" e clique em "Multas".
3. Leia a linha da multa: "Pedido", "Responsável", "Motivo" (com o link "Evidência", quando houver), "Valor", "Data" e "Situação".
4. Para mudar a situação, clique em "Contestada", "Paga" ou "Cancelada" na linha. A mudança é imediata; não há botão para voltar a "Em aberto".
5. Para ver o contexto, clique no número do pedido: a seção "Multas" mostra as multas do pedido, só para leitura.
6. Dúvidas: clique em "Conversar com a Wellmix" no pedido.

#### Notas de gravação

- Prepare o ponto `antes-JUR-01` (guia, seção 7.2): com o administrador, abra o pedido, clique em "Registrar multa" (seção Multas) e registre as duas multas. Só o administrador e as diretorias de compras e executiva abrem esse formulário. Use motivos e valores fictícios (os dois acima funcionam).
- A foto de evidência é um arquivo de exemplo; nunca uma foto real de avaria.
- O aviso da multa nova só existe depois do registro: grave a cena 4 logo após registrar, ou restaure o ponto. O título do aviso é fixo ("Multa registrada no pedido") e não traz o número do pedido.
- Esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3).
- Na página do pedido o jurídico vê a tabela "Documentos" no fim (fotos, arte etc.); não role até lá.
- A seção Multas do pedido não mostra o link de evidência nem os botões de situação: ambos só existem na tela Pedidos → Multas.
- Depois da gravação, restaure o ponto: a mudança de situação não tem volta pelo botão da tela.

#### Pontos a confirmar

- ⚠ O significado de negócio de cada situação (Em aberto, Contestada, Paga, Cancelada) não está definido em docs/; a narração só os nomeia. Confirmar com o jurídico, por exemplo, o que significa "Contestada" e se "Paga" tem alguma consequência financeira (pelo código, mudar a situação só grava a situação e a auditoria; não mexe em pagamentos).
- ⚠ A tela não oferece o botão "Em aberto" depois da primeira mudança, embora o servidor aceite esse valor. Confirmar se é intencional.
- ⚠ A mudança de situação não avisa ninguém (nem a Wellmix, nem o parceiro responsável); só a auditoria. Confirmar se deve avisar.
- ⚠ O aviso de multa nova ("Multa registrada no pedido") está fixo em português no código, sem o número do pedido, e chega como "Sua vez / Agora é com você" em Notificações, mas não gera pendência (a lista de Pendências do jurídico fica vazia).
- ⚠ O jurídico abre qualquer pedido e vê cliente e fornecedor (docs/ACCESS.md lista Pedidos para ele); confirmar se o vídeo deve dizer isso.
- ⚠ O texto de ajuda da tela ("Multas registradas pela Wellmix por atraso, avaria ou descumprimento…") existe no código, mas o "Como funciona" saiu das telas (o E2E confere); por isso a explicação é falada, não mostrada.
- ⚠ A Control Tower conta como "Multa aberta" as multas Em aberto e Contestada (verificado no código e na tela do administrador); a narração da cena 7 depende disso.

---

## Série OCP · Organismo de certificação

Vídeos para a certificadora (OCP, o organismo de certificação): a Olga OCP (`ocp@certifica.com`, tela em pt). A OCP gera o **selo de certificação** de cada pedido; o selo vai para quem faz a arte da embalagem (a agência do pedido ou, sem ela, a Wellmix), que o aplica na arte, e a Wellmix confere (docs/CERTIFICATION.md).

**O que a OCP vê** (docs/ACCESS.md, docs/CERTIFICATION.md, seção 6.1, decisão do dono de 10/11/2026): menu **Início** ("Pendências", "Notificações", "Mensagens") e **Pedidos** ("Pedidos"). Só os pedidos em que está designada (com uma só certificadora ativa, ela é designada sozinha quando o pedido nasce). No pedido vê o cartão **Certificação** e o pedido **completo, só para ler**: cliente, fornecedor, preço de compra (FOB), itens com foto, a **ficha de compra** inteira (com o bloco de preço), o **documento do pedido**, as certificações já registradas do produto e do fornecedor e os arquivos.

**O que a OCP não vê nem faz:** preço de venda, margem, pagamentos e financeiro da Wellmix; não edita a ficha e não assina o documento do pedido. A agência vê só as duas linhas do selo; o fornecedor e o cliente não veem a certificação.

**Conta de gravação:** `ocp@certifica.com` (senha `wellmix123`), tela em pt. Chrome em pt-BR.

**Atenção ao que mudou:** docs/CERTIFICATION.md ainda descreve memorial, laudo e registro como passos do cartão. No código atual, o cartão mostra o **selo**, o **memorial descritivo** (opcional) e o **selo aplicado na arte**; laudo e registro **saíram da tela** (comentário em `src/app/app/orders/[id]/page.tsx`, decisão do dono de 10/11/2026) e só aparecem em pedido antigo que já os preencheu. Por isso o OCP-02 ensina o selo, o memorial e a validação, e **não** ensina laudo nem registro.

**Documentos lidos:** GUIA.md, 02-cliente.md (modelo), SCOPE.md, WORKFLOW.md, ACCESS.md, CERTIFICATION.md (inteiro), `src/lib/services/import-flow.ts`, `src/components/import-flow-card.tsx`, a página do pedido (`src/app/app/orders/[id]/page.tsx`), `src/lib/services/tower-board.ts` e o E2E `tests/e2e/happy-path.spec.ts` (passo 6b).

### OCP-01 · Receber o pedido de certificação e a ficha

> **Promessa:** ao final do vídeo você sabe encontrar o pedido que chegou para certificação e consultar tudo o que precisa para gerar o selo: itens, ficha de compra e documento do pedido.

| Ficha | |
| --- | --- |
| Série e papel | OCP, organismo de certificação (Olga OCP) |
| Conta de gravação | `ocp@certifica.com`, tela em pt (Chrome em pt-BR) |
| Duração-alvo | 3:45 |
| Ponto da jornada | Etapa 4 de 9: Sinal e pedido (a certificação corre ao mesmo tempo que a Preparação) |
| Telas e rotas | `/app` (Pendências), `/app/notifications`, `/app/orders/[id]#certification`, `/app/orders/[id]/purchase-sheet`, `/app/orders/[id]/purchase-order` |
| Dados antes de gravar | Um pedido recém-criado (ainda em "Pedido pré-aprovado", logo depois do sinal confirmado), com a OCP no pedido (com uma só certificadora ativa ela é designada sozinha) e **sem o selo enviado**; a ficha de compra preenchida pelo fornecedor, com fotos; uma certificação registrada no produto (Produtos → Certificações) para a cena 10. Ponto de salvamento `antes-OCP-01` |
| Depois deste vídeo | Nada muda no pedido (é só leitura); a pendência "Gerar o selo de certificação" continua com a OCP até o OCP-02 |
| Antes · Próximo | Sinal confirmado e pedido criado (Wellmix) · OCP-02 |
| Idiomas | pt (base) |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: A tela "Minhas pendências" com a pendência "Gerar o selo de certificação: pedido #1" em destaque e o cursor perto do botão "Abrir".
- 🎙 Narração: "Chegou um pedido novo e a certificação depende de você. Veja onde ele aparece e o que consultar para gerar o selo."
- 🔤 Na tela: `[TÍTULO]` "OCP-01 · Receber o pedido de certificação e a ficha"; `[ZOOM 150 %]` na linha da pendência
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:23 · Onde estou na jornada · `/app`**

- 🎬 Imagem: A mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Estamos na etapa quatro: sinal e pedido. Assim que o pedido nasce, a certificação começa, ao mesmo tempo que a arte da embalagem. Ela não espera a etapa anterior."
- 🔤 Na tela: `[MAPA etapa 4]` com "Sinal e pedido" acesa e o selo "certificação: ao mesmo tempo"
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:23–0:37 · Quem é a OCP · `/app`**

- 🎬 Imagem: O cursor abre o menu "Início" ("Pendências", "Notificações", "Mensagens") e depois "Pedidos" ("Pedidos").
- 🎙 Narração: "Você é a certificadora, a OCP. No menu, Início tem Pendências, Notificações e Mensagens, e Pedidos mostra só os pedidos em que você foi designada."
- 🔤 Na tela: `[QUEM VÊ]` "A OCP vê só os pedidos em que foi designada"
- ✂️ Edição: mostre os dois menus abertos, um de cada vez, 3 s cada.

**Cena 4 · 0:37–0:59 · A pendência e o aviso · `/app` → `/app/orders/[id]#certification`**

- 🎬 Imagem: Na linha da pendência: título "Gerar o selo de certificação: pedido #1", detalhe "Envie o arquivo do selo no pedido. Quem faz a arte recebe para aplicar na embalagem.", tipo "Certificação", sem prazo. Abrir o sino: o aviso "Pedido #1: gerar o selo de certificação". Clicar em "Abrir": o pedido abre já na seção "Certificação".
- 🎙 Narração: "Seu aviso chega ao sino e à lista de pendências: Gerar o selo de certificação, com o número do pedido. A linha diz: envie o arquivo do selo no pedido. Clique em Abrir."
- 🔤 Na tela: `[PASSO 1/5]` Abra a pendência; `[BOTÃO]` "Abrir"; `[SETA]` "Sino: o mesmo aviso, com o texto completo"
- ✂️ Edição: clique com onda; `[CORTE]` para a página do pedido; o endereço termina em `#certification`.

**Cena 5 · 0:59–1:27 · O pedido completo, só para ler · `/app/orders/[id]`**

- 🎬 Imagem: Rolar até o alto da página: título "Pedido #1", selo da etapa e "Conversar com a Wellmix". Em "Resumo do pedido": "Cliente", "Fornecedor", "FOB" em dólar, "Data" e os atalhos "Documento do pedido" ("Abrir o documento") e "Ficha de compra" ("Ver ficha de compra").
- 🎙 Narração: "O pedido abre na seção Certificação. Acima, o resumo mostra o cliente, o fornecedor, o preço FOB e a data, e os atalhos para o documento do pedido e a ficha de compra. Você vê tudo isso só para ler."
- 🔤 Na tela: `[PASSO 2/5]` Veja o resumo do pedido; `[QUEM VÊ]` "A OCP vê cliente e preço de compra (decisão do dono, 10/11/2026). Preço de venda, margem e pagamentos continuam fora."; `[ZOOM 150 %]` no resumo
- ✂️ Edição: pausa de 3 s no resumo.

**Cena 6 · 1:27–1:47 · Itens e fotos · `/app/orders/[id]#order-items`**

- 🎬 Imagem: Em "Itens do pedido": a linha da jarra com a foto (e o número de fotos), o código "UTL-001", a quantidade, "Preço unitário (FOB)" e "Total (FOB)". Clicar na foto: abre a galeria ("Ver todas as fotos").
- 🎙 Narração: "Em Itens do pedido, cada produto vem com foto, código, variação, quantidade e preço unitário e total em dólar. Clique na foto para ver todas as fotos do produto."
- 🔤 Na tela: `[SETA]` "Ver todas as fotos"; `[ZOOM 150 %]` na linha do item
- ✂️ Edição: feche a galeria com a tecla Esc.

**Cena 7 · 1:47–2:27 · A ficha de compra · `/app/orders/[id]/purchase-sheet`**

- 🎬 Imagem: Clicar em "Ver ficha de compra". A página abre com o aviso "Você pode ver a ficha, mas não editar esta parte." e os blocos: "Fornecedor", "Produto", "Caixa e embalagem", "Preço e condições", "Programação de compra", "Despachante (NCM e impostos)" e "Fotos". Os campos aparecem desabilitados; os que o fornecedor preencheu mostram o valor. Parar em "Material", "Cor / sortimento", "Medidas da caixa master (cm)" e no campo "Certificação" do bloco do despachante.
- 🎙 Narração: "Clique em Ver ficha de compra. É a ficha que o fornecedor preencheu, em blocos: fornecedor, produto, caixa e embalagem, preço e condições, programação, despachante e fotos. Uma faixa avisa que você pode ver, mas não editar. Procure o que importa ao selo: material, cores, medidas da caixa e o campo Certificação."
- 🔤 Na tela: `[PASSO 3/5]` Consulte a ficha de compra; `[BOTÃO]` "Ver ficha de compra"; `[SETA]` "Você pode ver a ficha, mas não editar esta parte."; `[ZOOM 150 %]` nos campos do produto
- ✂️ Edição: role devagar, bloco a bloco; 3 s em cada bloco citado.

**Cena 8 · 2:27–2:41 · As fotos da ficha · `/app/orders/[id]/purchase-sheet`**

- 🎬 Imagem: Rolar até o bloco "Fotos": "Balança (peso)", "Medida: com escala", "Medida: lado", "Outro ângulo", "Original (evidência)", "Foto em alta (HD)" e "Faca (die cut)", cada um com o número de fotos enviadas.
- 🎙 Narração: "No fim da ficha ficam as fotos: balança, medidas, outro ângulo, original, foto em alta e faca. É só leitura."
- 🔤 Na tela: `[SETA]` "Fotos": só leitura
- ✂️ Edição: mostre cada linha por 1 s.

**Cena 9 · 2:41–3:03 · O documento do pedido · `/app/orders/[id]/purchase-order`**

- 🎬 Imagem: Voltar ao pedido e clicar em "Abrir o documento". A página mostra o selo "Em preparação: vai para assinatura depois da arte e do selo", o botão "Baixar o documento em PDF", o quadro com os itens, o preço por unidade, o total FOB, o pedido mínimo, o prazo de produção e a condição de pagamento, e a seção "Assinaturas" (as duas assinaturas ainda em branco).
- 🎙 Narração: "Volte ao pedido e clique em Abrir o documento. Ele reúne os itens, o preço, o pedido mínimo, o prazo e a condição de pagamento. A assinatura é da Wellmix e do fornecedor: aqui você só lê, ou baixa o PDF."
- 🔤 Na tela: `[BOTÃO]` "Abrir o documento"; `[BOTÃO]` "Baixar o documento em PDF"; `[QUEM VÊ]` "A OCP lê o documento; quem assina é a Wellmix e o fornecedor"
- ✂️ Edição: não role a folha do pedido (modelo Wellmix) inteira; mostre o quadro do alto e as assinaturas.

**Cena 10 · 3:03–3:17 · Certificações já registradas · `/app/orders/[id]#certification`**

- 🎬 Imagem: De volta ao cartão "Certificação", mostrar a linha "Certificações já registradas do produto e do fornecedor:" com tipo, nome, número, emissor, situação, validade e o link "Abrir documento". Mostrar também os atalhos "Ver ficha de compra · Itens do pedido · Documentos".
- 🎙 Narração: "De volta ao cartão Certificação, a lista de certificações já registradas do produto e do fornecedor mostra tipo, número, emissor, validade e o documento."
- 🔤 Na tela: `[SETA]` "Certificações já registradas do produto e do fornecedor:"; `[BOTÃO]` "Abrir documento"
- ✂️ Edição: se o produto não tiver certificação registrada, a linha não aparece; registre uma de exemplo (ver Notas).

**Cena 11 · 3:17–3:33 · Depois · `/app/orders/[id]#certification`**

- 🎬 Imagem: O cartão "Certificação" em tela cheia, com o quadro do alto ("Selo" e "Memorial descritivo"), ainda "Pendente".
- 🎙 Narração: "Agora você tem tudo para gerar o selo. No próximo vídeo, envie o arquivo do selo e acompanhe a validação até a arte ficar pronta."
- 🔤 Na tela: `[DEPOIS]` "Próximo passo: gerar o selo e enviar o arquivo no cartão Certificação (OCP-02)"
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 12 · 3:33–3:45 · Resumo e próximo vídeo**

- 🎬 Imagem: Fundo vermelho com a lista; no fim, a miniatura do OCP-02.
- 🎙 Narração: "Resumindo: abra a pendência, leia o resumo, os itens, a ficha e o documento do pedido, só para ler. No próximo vídeo, envie o selo."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência · 2 Resumo e itens · 3 Ficha de compra · 4 Documento do pedido · 5 Certificações registradas"; chamada "Próximo: OCP-02 · Enviar o selo e o memorial e acompanhar a validação"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Aviso:** pedido sem certificadora. A OCP não recebe o aviso; a Wellmix recebe "Pedido #1: sem certificadora para o selo" e designa a certificadora em Parceiros do pedido → **Correção (Wellmix):** designar a OCP; a OCP é avisada na hora.
- **Aviso:** tentar editar a ficha. Os campos aparecem desabilitados e a faixa diz "Você pode ver a ficha, mas não editar esta parte." → **Correção:** a ficha é só para consulta; dúvidas vão para a Wellmix por "Conversar com a Wellmix".
- **Cuidado:** abrir um pedido de outra certificadora. A página não abre (a OCP só acessa os pedidos em que foi designada) → **Correção:** use a lista de Pedidos, que mostra só os seus.
- **Cuidado:** o documento do pedido não está em branco por engano: ele só vai para assinatura depois da arte e do selo (o selo "Em preparação: vai para assinatura depois da arte e do selo" é normal).

#### Passo a passo em texto

1. No menu, abra "Pendências" e clique em "Abrir" na pendência "Gerar o selo de certificação: pedido #…". O pedido abre na seção "Certificação".
2. Leia o "Resumo do pedido": cliente, fornecedor, preço FOB, data e os atalhos. É tudo só leitura.
3. Em "Itens do pedido", confira foto, código, quantidade e preços; clique na foto para ver todas.
4. Clique em "Ver ficha de compra". Consulte os blocos da ficha (fornecedor, produto, caixa e embalagem, preço e condições, programação, despachante e fotos). Você não edita nada.
5. Volte ao pedido e clique em "Abrir o documento". Leia os itens, o preço, o pedido mínimo, o prazo e a condição de pagamento; "Baixar o documento em PDF" baixa o PDF. Você não assina.
6. No cartão "Certificação", leia as certificações já registradas do produto e do fornecedor ("Abrir documento").
7. Para enviar o selo, siga o OCP-02. Dúvidas: "Conversar com a Wellmix".

#### Notas de gravação

- Prepare o ponto `antes-OCP-01` (guia, seção 7.2): a Jornada da Jarra até o **sinal confirmado** (pedido criado), antes de qualquer envio do selo. Depois do OCP-01, restaure o mesmo ponto para gravar o OCP-02.
- Registre uma certificação de exemplo no produto (Produtos → Jarra de vidro 1,5 L → Certificações e compliance → "Registrar certificação": tipo, nome, emissor, número, validade e um PDF de exemplo). Use dados fictícios; sem isso a cena 10 não mostra a lista.
- O endereço da página termina em `#certification` quando se abre pela pendência; a página rola até o cartão. Para a cena 5, role de volta ao topo.
- O número da foto (por exemplo "5") no canto da miniatura é a quantidade de fotos do item; a galeria abre em janela sobre a tela.
- A ficha mostra a data no formato do navegador (mm/dd/aaaa se o Chrome estiver em en-US); grave em pt-BR.
- A tabela "Documentos" no fim do pedido lista as fotos e arquivos do pedido; pode aparecer, mas não é o foco.
- Esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3).

#### Pontos a confirmar

- ⚠ docs/CERTIFICATION.md se contradiz: a seção 6 diz que "o cliente e o preço continuam invisíveis para OCP e agência", mas a seção 6.1 e o código (E2E, passo 6b) mostram cliente, preço FOB, ficha com o bloco Preço e o documento do pedido à OCP (decisão do dono de 10/11/2026). Este roteiro segue o código. Confirmar se o vídeo deve explicitar "com preço".
- ⚠ O texto do documento do pedido diz "depois a Wellmix assina e você assina em seguida", mesmo quando quem lê é a OCP (que não assina). Pode confundir.
- ⚠ A faixa de explicação do quadro do alto chama o quadro de "Memorial (selo)", mas os dois campos se chamam "Selo" e "Memorial descritivo"; e diz que "o pedido segue para a próxima etapa" ao enviar o selo, o que o código não faz (o selo não trava etapa; docs/CERTIFICATION.md, seção 4: "Sem trava por enquanto").
- ⚠ O cartão diz "0 de 3 concluídos" enquanto a linha da etapa na tabela de etapas diz "0 de 5" (a tabela conta também o laudo e o registro, que saíram do cartão).
- ⚠ Não confirmei se a certificação pedida na ficha ("Certificação pedida na ficha: …") aparece à OCP com o texto; o campo existe na ficha (bloco do despachante), mas na minha demonstração estava em branco.
- ⚠ O cartão do fabricante e a foto de referência do cadastro não aparecem à OCP segundo docs/CERTIFICATION.md; não os procurei na gravação.

---

### OCP-02 · Enviar o selo e o memorial e acompanhar a validação

> **Promessa:** ao final do vídeo você sabe enviar o selo de certificação e o memorial descritivo, acompanhar a arte com o selo até a Wellmix conferir e trocar o selo quando precisar.

| Ficha | |
| --- | --- |
| Série e papel | OCP, organismo de certificação (Olga OCP) |
| Conta de gravação | `ocp@certifica.com`, tela em pt (Chrome em pt-BR) |
| Duração-alvo | 3:14 |
| Ponto da jornada | Etapa 5 de 9: Preparação (arte e embalagem, ao mesmo tempo que a certificação) |
| Telas e rotas | `/app` (Pendências), `/app/orders/[id]#certification` |
| Dados antes de gravar | O mesmo pedido do OCP-01, sem o selo enviado (ponto `antes-OCP-01`). Para as cenas 7 e 8 são precisos a agência (envia a arte com o selo) e a Wellmix (recusa e valida), em gravações curtas à parte; para o caso da cena 5 em que a Wellmix envia o memorial, um segundo ponto com o memorial já enviado pela Wellmix |
| Depois deste vídeo | A agência (ou a Wellmix, sem agência) recebe o aviso e a pendência "Aplicar o selo de certificação na arte"; a Wellmix confere a arte com o selo; com a arte conferida, o documento do pedido pode ser enviado para assinatura |
| Antes · Próximo | OCP-01 · fim da série OCP |
| Idiomas | pt (base) |

#### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/orders/[id]#certification`**

- 🎬 Imagem: O cartão "Certificação" com o quadro do alto: "Selo" e "Memorial descritivo" "Pendente", e o cursor no botão "Enviar".
- 🎙 Narração: "Um arquivo e o selo está no pedido: a agência já pode aplicar na arte. Veja como enviar e acompanhar até a Wellmix conferir."
- 🔤 Na tela: `[TÍTULO]` "OCP-02 · Enviar o selo e o memorial e acompanhar a validação"; `[ZOOM 150 %]` no quadro do alto
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/orders/[id]#certification`**

- 🎬 Imagem: A mesma tela, sem ação. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Seu selo vai para a arte da embalagem. O documento do pedido só segue para assinatura depois que a arte leva o selo."
- 🔤 Na tela: `[MAPA etapa 5]` com "Preparação" acesa e o selo "certificação: ao mesmo tempo"
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:46 · O cartão Certificação · `/app/orders/[id]#certification`**

- 🎬 Imagem: O cartão "Certificação": 0 de 3 concluídos no canto. No alto, o quadro com "Selo" (campo "Nº do selo ou do registro (opcional)" e arquivo) e "Memorial descritivo" (arquivo). Embaixo, a tabela "Passo" / "Situação" / "Quem faz / valida" / "Informado" / "Enviado por" / "Ação" com três linhas: "Selo", "Selo aplicado na arte" e "Memorial descritivo".
- 🎙 Narração: "Abra a seção Certificação. No alto, um quadro com dois campos: Selo e Memorial descritivo. Abaixo, a tabela mostra quem faz e quem valida cada passo: o selo é seu; o selo na arte é da agência, validado pela Wellmix; o memorial é da Wellmix, validado por você."
- 🔤 Na tela: `[SETA]` "Faz: OCP · valida: —" na linha do selo; `[SETA]` "Faz: agência · valida: Wellmix" na linha da arte; `[SETA]` "Faz: Wellmix · valida: OCP" na linha do memorial; `[ZOOM 150 %]` na tabela
- ✂️ Edição: pausa de 2 s em cada linha da tabela.

**Cena 4 · 0:46–1:16 · Enviar o selo · `/app/orders/[id]#certification`**

- 🎬 Imagem: No quadro "Selo", digitar "SEL-0001-2026" no campo "Nº do selo ou do registro (opcional)", clicar em "Escolher arquivo" (botão do navegador), escolher o PDF do selo e clicar em "Enviar". O cartão mostra a faixa verde "Enviado."; o selo vira "Concluído" com o link "Arquivo" e o botão passa a "Enviar de novo". Voltar a "Minhas pendências": "Nenhuma pendência. Bom trabalho."
- 🎙 Narração: "No quadro Selo, escreva o número do selo ou do registro, se tiver: é opcional. Escolha o arquivo do selo e clique em Enviar. O quadro avisa Enviado, o selo vira Concluído e o botão passa a ser Enviar de novo. A pendência sai da sua lista."
- 🔤 Na tela: `[PASSO 1/4]` Envie o selo; `[BOTÃO]` "Enviar"; `[SETA]` "Enviado."; `[SETA]` "Concluído" + "Enviar de novo"
- ✂️ Edição: o selo é um PDF de exemplo ("selo-certificacao-pedido-2.pdf"); arquivos grandes sobem direto (até 50 MB). Corte a espera do envio.

**Cena 5 · 1:16–1:36 · O memorial descritivo · `/app/orders/[id]#certification`**

- 🎬 Imagem: No quadro "Memorial descritivo", escolher um PDF e clicar em "Enviar": o item vira "Concluído" e a tabela mostra "validado por Olga OCP". Mostrar, em seguida, o caso em que a Wellmix envia o memorial: a linha fica "Enviado, aguardando validação", a OCP vê os botões "Validar" e "Recusar" e o campo "Motivo (obrigatório para recusar)".
- 🎙 Narração: "O memorial descritivo também aceita um PDF, se quiser. Como é você quem valida esse passo, ele já fica Concluído, com o seu nome. Se a Wellmix enviar o memorial, você recebe a pendência e usa Validar ou Recusar."
- 🔤 Na tela: `[PASSO 2/4]` Anexe o memorial (opcional); `[BOTÃO]` "Validar"; `[BOTÃO]` "Recusar"; `[ATENÇÃO]` "Motivo (obrigatório para recusar)"
- ✂️ Edição: para o segundo caso, restaure o ponto e faça a Wellmix enviar o memorial antes; a pendência da OCP aparece como "Validar Memorial descritivo (certificação): pedido #n".

**Cena 6 · 1:36–1:52 · A agência recebe · `/app/orders/[id]#certification`**

- 🎬 Imagem: A tabela: "Selo aplicado na arte" deixa de mostrar "Depois de: Selo" e fica "Pendente", com "Faz: agência · valida: Wellmix".
- 🎙 Narração: "Com o selo enviado, a agência recebe o aviso e a pendência para aplicar o selo na arte. Você acompanha pela linha Selo aplicado na arte."
- 🔤 Na tela: `[DEPOIS]` "A agência (ou a Wellmix, sem agência) recebe o aviso e a pendência Aplicar o selo na arte"
- ✂️ Edição: cartão `[DEPOIS]` por 4 s.

**Cena 7 · 1:52–2:22 · Acompanhar a arte com o selo · `/app/orders/[id]#certification`**

- 🎬 Imagem: Mostrar a linha "Selo aplicado na arte" nas três situações: "Enviado, aguardando validação" (a agência enviou), "Recusado" com "Recusado: O selo ficou cortado na lateral da caixa." (a Wellmix recusou) e "Concluído" com "validado por Ana Admin". Clicar no link "Arquivo" da arte.
- 🎙 Narração: "Na linha Selo aplicado na arte, você vê a situação. Enviado, aguardando validação, quando a agência mandou a arte. Recusado, com o motivo da Wellmix, quando a arte volta. E Concluído, com o nome de quem validou. Em todas, o link Arquivo abre a arte."
- 🔤 Na tela: `[PASSO 3/4]` Acompanhe a arte com o selo; `[SETA]` "Enviado, aguardando validação"; `[SETA]` "Recusado"; `[SETA]` "Concluído"; `[BOTÃO]` "Arquivo"
- ✂️ Edição: as três situações vêm de gravações em sequência (agência, Wellmix recusa, agência reenvia, Wellmix valida); ou use três capturas editadas.

**Cena 8 · 2:22–2:48 · Trocar o selo · `/app/orders/[id]#certification`**

- 🎬 Imagem: No quadro "Selo" (já "Concluído"), escolher outro arquivo e clicar em "Enviar de novo". A linha da arte volta a "Recusado" com "Recusado: A certificadora trocou o selo (o arquivo ou o número). Aplique o selo atual na arte e envie a arte de novo.".
- 🎙 Narração: "Errou o arquivo ou o número? Use Enviar de novo. Se a arte com o selo antigo já tinha sido enviada, ela volta para a agência com o aviso: a certificadora trocou o selo. Reenviar sem mudar nada não reabre nem avisa."
- 🔤 Na tela: `[PASSO 4/4]` Troque o selo, se precisar; `[BOTÃO]` "Enviar de novo"; `[ATENÇÃO]` "A certificadora trocou o selo (o arquivo ou o número). Aplique o selo atual na arte e envie a arte de novo."
- ✂️ Edição: mostre a mensagem 3 s; use outro PDF de exemplo ("selo-certificacao-pedido-2-rev2.pdf").

**Cena 9 · 2:48–3:02 · Depois · `/app/orders/[id]#certification`**

- 🎬 Imagem: O cartão com 3 de 3 concluídos (ou o que ainda estiver pendente), o selo e a arte "Concluído".
- 🎙 Narração: "Com a arte conferida, a sua parte no pedido está pronta. O cartão continua aberto para consulta enquanto o pedido estiver aberto, e você só volta a agir se precisar trocar o selo."
- 🔤 Na tela: `[DEPOIS]` "Selo enviado e arte conferida pela Wellmix; o documento do pedido pode seguir para assinatura."
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 10 · 3:02–3:14 · Resumo**

- 🎬 Imagem: Fundo vermelho com a lista.
- 🎙 Narração: "Resumindo: envie o selo, anexe o memorial se quiser, acompanhe a arte com o selo e troque o selo só se precisar."
- 🔤 Na tela: `[RESUMO]` "1 Envie o selo · 2 Memorial (opcional) · 3 Acompanhe a arte com o selo · 4 Troque o selo, se precisar"
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

#### Erros comuns

- **Erro:** recusar sem escrever o motivo. A tela mostra "Escreva o motivo para recusar." no cartão → **Correção:** escreva o motivo no campo "Motivo (obrigatório para recusar)" e clique em "Recusar".
- **Erro:** arquivo grande demais. "Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado." → **Correção:** reduza o arquivo ou envie em PDF compactado (o teto é 50 MB).
- **Erro:** envio que não sobe. "O envio falhou. Verifique a conexão e tente de novo." → **Correção:** confira a conexão e envie de novo.
- **Erro:** enviar sem arquivo. O servidor recusa com "Envie o arquivo." → **Correção:** escolha o arquivo antes de clicar em "Enviar".
- **Aviso:** pedido encerrado ou cancelado. "Pedido encerrado ou cancelado." → o selo não aceita mais envio; fale com a Wellmix.
- **Aviso:** passo ainda não liberado no sistema. A tela mostra "Este passo ainda não está liberado no sistema. Avise a Wellmix e tente de novo depois." → **Correção:** avise a Wellmix (o esquema precisa ser publicado).

#### Passo a passo em texto

1. No menu, abra "Pendências" e clique em "Abrir" em "Gerar o selo de certificação: pedido #…". O pedido abre no cartão "Certificação".
2. No quadro "Selo", preencha, se tiver, o número no campo "Nº do selo ou do registro (opcional)", escolha o arquivo do selo e clique em "Enviar". A tela mostra "Enviado.", e o selo fica "Concluído".
3. Se quiser, no quadro "Memorial descritivo", escolha o PDF do memorial e clique em "Enviar". Se a Wellmix enviar o memorial, use "Validar" ou "Recusar" (o motivo é obrigatório para recusar).
4. Acompanhe a linha "Selo aplicado na arte": "Enviado, aguardando validação", "Recusado" (com o motivo) ou "Concluído" (com quem validou). O link "Arquivo" abre a arte.
5. Para trocar o selo, mude o arquivo ou o número e clique em "Enviar de novo". Se a arte com o selo antigo já tinha sido enviada, ela volta para a agência.
6. Dúvidas: clique em "Conversar com a Wellmix".

#### Notas de gravação

- Restaure o ponto `antes-OCP-01` (guia, seção 7.2). Para as cenas 7 e 8 grave, com a agência (`agencia@design.com`) e o administrador, em gravações curtas à parte: a agência envia a arte com o selo, o administrador recusa com um motivo ("O selo ficou cortado na lateral da caixa."), a agência reenvia e o administrador valida. Depois volte à conta da OCP para mostrar cada situação.
- Use PDFs de exemplo: "selo-certificacao-pedido-2.pdf" e "memorial-descritivo-UTL-001.pdf". O número do selo é fictício.
- Arquivos grandes sobem direto ao armazenamento e o botão só envia depois que o arquivo terminou de subir (docs/CERTIFICATION.md, seção 8); corte a espera do envio.
- Depois de o selo ficar "Concluído", a pendência da OCP some e o cartão passa a mostrar "1 de 3 concluídos" (o memorial e a arte ainda pendentes).
- Cena 5: o memorial enviado pela OCP já nasce "Concluído" e "validado por Olga OCP"; para mostrar Validar e Recusar é preciso que a Wellmix o envie (o aviso "Validar Memorial descritivo (certificação): pedido #n" aparece em Pendências).
- A mensagem da troca do selo (cena 8) aparece na linha da arte como "Recusado: A certificadora trocou o selo…", porque a troca reabre o passo da agência.
- Esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3).

#### Pontos a confirmar

- ⚠ Laudo e registro: docs/CERTIFICATION.md ainda os lista como passos do cartão (seção 6); o código os esconde de pedidos novos (decisão do dono de 10/11/2026) e nenhum caminho da tela os preenche. Confirmar se o título original do roteiro ("Memorial, laudo e registro") deve voltar quando eles voltarem.
- ⚠ Possível bug de regra: o quadro "Certificação pendente" da Control Tower conta o pedido como pendente enquanto o memorial, o laudo e o registro não estiverem concluídos quando há OCP no pedido (`src/lib/services/tower-board.ts`). Como o laudo e o registro não aparecem mais na tela, o pedido nunca sai do quadro, mesmo com selo, arte e memorial concluídos (conferi no administrador: os dois pedidos da demonstração continuam em "Certificação pendente"). Por isso a cena 9 não promete que o pedido saia do quadro.
- ⚠ A faixa do quadro do alto diz que, ao enviar o selo, "o pedido segue para a próxima etapa"; o selo não trava nem libera etapa (docs/CERTIFICATION.md, seção 4). Confirmar o texto.
- ⚠ O texto "Selo de certificação: a certificadora (OCP) envia o selo do pedido…" e o quadro do alto repetem a explicação; ao gravar, decida qual deixar na tela.
- ⚠ O quadro do alto chama o campo de "Selo", e a documentação, de "Selo de certificação". A narração usa "selo".
- ⚠ Memorial: a documentação diz que é a Wellmix quem o anexa e a OCP quem valida; o código também deixa a OCP anexar (e já valida). Confirmar se a OCP deve mostrar o memorial como passo seu.
- ⚠ O aviso da pendência "Validar Memorial descritivo (certificação): pedido #n" está fixo em português no código (`tasks.ts`), sem chave no dicionário.
