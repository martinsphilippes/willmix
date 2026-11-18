# Certificadora (OCP) · Módulo 2 · Selo, memorial e os outros caminhos
# Tarefas O2, O3 e O5 do levantamento: o selo e o memorial descritivo no quadro do alto do
# cartão Certificação (docs/CERTIFICATION.md, seções 14 e 15), a troca de arquivo, a tela do
# passo "Certificação", a Mesa de trabalho e os avisos e mensagens.
# Dados: pontos cert-s1 (deixado pela cena do certificado, Módulo 1) e cert-base.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Enviar o selo"
C2 = "2 · Enviar o memorial descritivo"
C3 = "3 · Substituir um arquivo"
C4 = "4 · A tela Certificação e a mesa de trabalho"
C5 = "5 · Avisos e mensagens"

LINHA_SELO = linha("Gerar o selo de certificação")
ABRIR_SELO = abrir_na_linha("Gerar o selo de certificação")
LINHA_MEMORIAL = linha("Enviar o memorial descritivo")
ABRIR_MEMORIAL = abrir_na_linha("Enviar o memorial descritivo")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+", "rede": True}
ALTO = "#certification-featured"
SELO = '[data-import-featured="cert_seal"]'
MEMORIAL = '[data-import-featured="cert_memorial"]'
ENVIADO = {"url": "certStep=submitted", "rede": True}
NUMERO = "SELO-2026-0115"
SINO = "header a[href='/app/notifications']"
MENSAGEM = "Olá! Para emitir o certificado do pote, preciso da ficha técnica da tampa."

cenas = [
    abertura("m2-a0-abertura", "Certificadora", "Selo, memorial e os outros caminhos", 2, [
        'Neste módulo você envia os dois documentos do pedido: o selo de certificação e o memorial descritivo. E aprende a trocar um arquivo enviado.',
        'No fim, conhece a tela "Certificação", a mesa de trabalho, os avisos e as mensagens.',
    ]),

    # ------------------------------------------------------------------ 1 · Enviar o selo
    capitulo("m2-c1-cartao", C1, 1, 5, "Enviar o selo", "O selo de certificação do pedido",
             "Para começar: o selo."),
    tela("m2-c1-selo", C1, "cert-s1", salvar="cert-s2", tarefa="Enviar o selo de certificação", passos=[
        mostrar("p1", 'Com o certificado do produto enviado, ficam as duas tarefas do pedido: o selo e o memorial descritivo.', LINHA_SELO, foco=False,
                destaques=[{"alvo": LINHA_MEMORIAL, "em": {"em": "memorial"}, "foco": False}]),
        clicar("p2", 'Na linha "Gerar o selo de certificação", clique em "Abrir".', ABRIR_SELO, alvo_visual=LINHA_SELO,
               resumo='Em Pendências, clique em "Abrir" na linha "Gerar o selo de certificação"', espera=NO_PEDIDO),
        mostrar("p3", 'Você cai no cartão "Certificação" do pedido. O primeiro quadro é o seu. É ali que você envia o selo e o memorial.', ALTO, foco=False),
        digitar("p4", 'No quadro "Selo", digite o número do selo ou do registro, se houver. Este campo é opcional.', SELO + " input[name=value]", NUMERO,
                rotulo="Nº do selo ou do registro", rotulo_lado="abaixo", resumo="Digite o número do selo ou do registro (opcional)", acao_em={"apos": "digite"}, pausa=0.4),
        anexar("p5", 'Depois, use "Escolher arquivo" e selecione o arquivo do selo.', SELO + " input[type=file]", "selo-de-certificacao-pote-1500ml.png",
               rotulo="Escolher arquivo", rotulo_lado="abaixo", resumo='Clique em "Escolher arquivo" e selecione o selo', acao_em="fim", espera={"ms": 600}),
        clicar("p6", 'Aqui o envio não é automático. Clique em "Enviar".', '[data-import-submit="cert_seal"]', rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar"', espera=ENVIADO),
        mostrar("p7", 'O quadro do selo passa para "Concluído", com o link do arquivo e o número que você digitou.', SELO),
        mostrar("p8", 'Com o selo enviado, quem faz a arte da embalagem recebe um aviso: baixa o selo, aplica na arte e envia a arte com o selo. A Wellmix valida. Essa linha você só acompanha.',
                "#certification-step-cert_seal_art", pausa=0.6),
    ]),
    sua_vez("m2-c1-suavez", C1, "Enviar o selo", [
        'Em Pendências, clique em "Abrir" na linha "Gerar o selo de certificação"',
        'No quadro "Selo", digite o número do selo, se houver',
        'Clique em "Escolher arquivo" e selecione o selo',
        'Clique em "Enviar"',
    ], "Agora é com você: pause o vídeo e envie o selo de um pedido."),

    # ------------------------------------------------ 2 · Enviar o memorial descritivo
    capitulo("m2-c2-cartao", C2, 2, 5, "Enviar o memorial descritivo", "O documento que descreve o produto certificado",
             "Agora: o memorial descritivo."),
    tela("m2-c2-memorial", C2, "cert-s2", salvar="cert-s3", tarefa="Enviar o memorial descritivo", passos=[
        mostrar("p1", 'Agora só falta o memorial descritivo. O portal pede esse arquivo em PDF.', LINHA_MEMORIAL),
        clicar("p2", 'Na linha do memorial, clique em "Abrir".', ABRIR_MEMORIAL, alvo_visual=LINHA_MEMORIAL,
               resumo='Em Pendências, clique em "Abrir" na linha "Enviar o memorial descritivo"', espera=NO_PEDIDO),
        mostrar("p3", 'É o mesmo quadro do alto. O selo já está concluído. Ao lado dele, o memorial descritivo, ainda pendente.', MEMORIAL),
        anexar("p4", 'Use "Escolher arquivo" e selecione o PDF do memorial.', MEMORIAL + " input[type=file]", "memorial-descritivo-pote-1500ml.pdf",
               rotulo="Escolher arquivo", rotulo_lado="abaixo", resumo='Clique em "Escolher arquivo" e selecione o PDF do memorial', acao_em="fim", espera={"ms": 600}),
        clicar("p5", 'E clique em "Enviar".', '[data-import-submit="cert_memorial"]', rotulo="Enviar", rotulo_lado="esquerda", resumo='Clique em "Enviar"',
               espera=ENVIADO),
        mostrar("p6", 'Pronto: selo e memorial concluídos. Da parte da certificadora, o pedido está completo.', ALTO, foco=False, pausa=0.6),
    ]),
    sua_vez("m2-c2-suavez", C2, "Enviar o memorial descritivo", [
        'Em Pendências, clique em "Abrir" na linha "Enviar o memorial descritivo"',
        'No quadro "Memorial descritivo", clique em "Escolher arquivo" e selecione o PDF',
        'Clique em "Enviar"',
    ], "Sua vez. Pause o vídeo e envie o memorial descritivo de um pedido."),

    # ---------------------------------------------------------- 3 · Substituir um arquivo
    capitulo("m2-c3-cartao", C3, 3, 5, "Substituir um arquivo", "Trocar o selo ou o memorial já enviado",
             "Agora: como trocar um arquivo já enviado."),
    tela("m2-c3-substituir", C3, "cert-s3", tarefa="Substituir o arquivo do selo", passos=[
        clicar("p1", 'Depois de enviar tudo, a lista de pendências fica vazia. Para trocar um arquivo, abra "Pedidos", no menu.', "aside a[href='/app/orders']",
               rotulo="Pedidos", resumo='No menu, clique em "Pedidos"', acao_em="fim", espera={"url": "/app/orders$", "rede": True}),
        clicar("p1b", 'E clique no número do pedido.', sel('main a[href^="/app/orders/"]', "#1", n=0), rotulo="Pedido #1", rotulo_lado="direita",
               resumo="Clique no número do pedido", espera=NO_PEDIDO),
        mostrar("p2", 'No cartão "Certificação", o quadro do selo, já concluído, traz o botão "Substituir arquivo".', SELO),
        anexar("p3", 'Clique em "Substituir arquivo" e selecione o arquivo novo.', 'input[data-replace-file="cert_seal"]', "selo-de-certificacao-pote-1500ml-v2.png",
               alvo_visual='[data-replace-start="cert_seal"]', rotulo="Substituir arquivo", rotulo_lado="abaixo",
               resumo='No quadro do selo, clique em "Substituir arquivo" e selecione o arquivo novo', acao_em="fim",
               espera={"seletor": "[data-replace-chosen]", "ms": 300}),
        mostrar("p4", 'O portal mostra o nome do arquivo novo e espera a sua confirmação. Até lá, nada mudou: dá para cancelar.', "[data-replace-chosen]"),
        clicar("p5", 'Clique em "Confirmar substituição".', "[data-replace-confirm]", rotulo="Confirmar substituição", rotulo_lado="acima",
               resumo='Clique em "Confirmar substituição"', espera={"texto": "Arquivo substituído", "rede": True}),
        mostrar("p6", 'O aviso confirma: arquivo substituído. O número do selo continua o mesmo.', texto("Arquivo substituído", exato=False)),
        {"id": "p7", "fala": 'Se a arte com o selo já tinha sido enviada, o passo dela volta para quem faz a arte, que aplica o selo novo e envia outra vez. O memorial se troca do mesmo jeito.'},
    ]),
    sua_vez("m2-c3-suavez", C3, "Substituir um arquivo", [
        'Em "Pedidos", abra o pedido',
        'No quadro do selo, clique em "Substituir arquivo" e selecione o arquivo novo',
        'Veja o nome do arquivo novo',
        'Clique em "Confirmar substituição"',
    ], "Agora é com você: pause o vídeo e substitua o arquivo de um selo."),

    # -------------------------------------- 4 · A tela Certificação e a mesa de trabalho
    capitulo("m2-c4-cartao", C4, 4, 5, "A tela Certificação e a mesa de trabalho", "Outros dois caminhos para o mesmo trabalho",
             "Agora: a tela Certificação e a mesa de trabalho."),
    tela("m2-c4-mesa", C4, "cert-base", tarefa="Achar os certificados pela tela Certificação e pela mesa de trabalho", passos=[
        clicar("p1", 'As pendências não são o único caminho. Para este exemplo, o pedido aparece em um momento anterior, sem nada enviado ainda. No menu, abra "Certificação".', "aside a[href='/app/flow/order/certification']",
               rotulo="Certificação", resumo='No menu, clique em "Certificação"', espera={"url": "/app/flow/order/certification", "rede": True}),
        mostrar("p2", 'Esta tela junta só o passo da certificação. A aba "Pendências" lista o que espera por você, com o prazo e há quantos dias está aberto.',
                "[data-flow-tab=pending]", rotulo="Pendências", rotulo_lado="abaixo"),
        clicar("p3", 'A aba "Todos no passo" mostra todos os seus pedidos que estão na certificação, mesmo sem nada pendente. Abra essa aba.', "[data-flow-tab=all]",
               rotulo="Todos no passo", rotulo_lado="abaixo", resumo='Clique na aba "Todos no passo"', acao_em="fim", espera={"url": "tab=all", "rede": True}),
        mostrar("p3b", 'Cada linha é um pedido, com a etapa em que ele está e o que continua aberto neste passo.', "main table tbody tr", foco=False),
        clicar("p3c", 'Volte para a aba "Pendências".', "[data-flow-tab=pending]", rotulo="Pendências", rotulo_lado="abaixo",
               resumo='Volte para a aba "Pendências"', espera={"seletor": "[data-flow-case-open]", "rede": True}),
        clicar("p4", 'Na linha do certificado, clique em "Resolver".', sel("[data-flow-case-open]", n=0), rotulo="Resolver", rotulo_lado="esquerda",
               resumo='Na linha do certificado, clique em "Resolver"', espera={"url": "/app/flow/order/certification/", "rede": True}),
        mostrar("p5", 'Abre só o produto daquela linha. Dá para enviar o certificado daqui mesmo, sem abrir o pedido inteiro.',
                {"papel": "heading", "nome": "Este produto no passo", "acima": 2}, foco=False),
        clicar("p6", 'Agora, a mesa de trabalho. Volte às pendências, pelo menu.', "aside a[href='/app']", rotulo="Pendências", resumo='No menu, clique em "Pendências"',
               acao_em={"apos": "Volte"}, espera={"url": "/app$", "rede": True}),
        clicar("p7", 'Use um filtro de prazo, como "Todas", mesmo que já apareça marcado.', sel("main a[data-task-filter='due:all']", n=0), rotulo="Prazo: Todas", rotulo_lado="acima",
               resumo='Clique num filtro de prazo, como "Todas"', espera={"url": "/app/tasks", "rede": True}),
        clicar("p8", 'Com isso aparece o botão "Mesa de trabalho". Clique nele.', "[data-desk-link]", rotulo="Mesa de trabalho", rotulo_lado="esquerda",
               resumo='Clique em "Mesa de trabalho"', espera={"url": "/app/tasks/desk", "rede": True}),
        mostrar("p9", 'A mesa mostra a fila "Certificados a emitir": um produto por linha, com o pedido e o prazo.',
                {"papel": "heading", "nome": "Certificados a emitir", "acima": 2}, foco=False),
        mostrar("p10", 'Em cada linha, "Abrir" leva ao pedido.', sel("main a", "Abrir"), rotulo="Abrir", rotulo_lado="esquerda", pausa=0.6),
    ]),
    sua_vez("m2-c4-suavez", C4, "A tela Certificação e a mesa de trabalho", [
        'No menu, clique em "Certificação"',
        'Veja as abas "Pendências" e "Todos no passo"',
        'Clique em "Resolver" numa linha',
        'Em Pendências, clique num filtro de prazo e depois em "Mesa de trabalho"',
    ], "Sua vez. Pause o vídeo e ache os seus certificados pela tela Certificação e pela mesa de trabalho."),

    # ---------------------------------------------------------- 5 · Avisos e mensagens
    capitulo("m2-c5-cartao", C5, 5, 5, "Avisos e mensagens", "O sino e a conversa com a Wellmix",
             "Por fim: os avisos e as mensagens."),
    tela("m2-c5-avisos", C5, "cert-base", tarefa="Ler os avisos e falar com a Wellmix", passos=[
        clicar("p1", 'O sino, no alto, mostra os avisos. O número é quantos você ainda não leu. Abra o sino.', SINO, rotulo="Notificações", rotulo_lado="esquerda",
               resumo="Clique no sino", espera={"url": "/app/notifications", "rede": True}, zoom=1.3),
        mostrar("p2", 'Quando um pedido com certificação nasce, o aviso chega aqui. "Sua vez" quer dizer que depende da certificadora.', "main table tbody tr", foco=False),
        mostrar("p3", 'O botão "Resolver" leva você para a tela certa, e o aviso sai da lista.', sel("main table tbody tr button", "Resolver"),
                rotulo="Resolver", rotulo_lado="esquerda"),
        clicar("p4", 'Para falar com a Wellmix, clique no balão de mensagens, ao lado do sino.', "header a[href='/app/messages']", rotulo="Mensagens",
               rotulo_lado="esquerda", resumo="Clique no balão de mensagens", destaque_em={"em": "balão"}, espera={"url": "/app/messages", "rede": True}),
        mostrar("p5", 'Esta conversa é da sua empresa com a equipe da Wellmix. Todos os logins da certificadora veem as mesmas mensagens.',
                texto("Todos os logins da sua empresa veem esta conversa", exato=False)),
        digitar("p6", 'Escreva a mensagem no campo de baixo. Pode ser uma dúvida sobre o produto, um prazo ou um documento que falta.', "main textarea[name=body]", MENSAGEM,
                rotulo="Mensagem", rotulo_lado="acima", resumo="Escreva a mensagem", acao_em={"apos": "baixo"}, pausa=0.5),
        clicar("p7", 'E clique em "Enviar".', sel("main form button[type=submit]", "Enviar"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar"', espera={"texto": MENSAGEM, "ms": 400}, pausa=0.6),
        mostrar("p8", 'A mensagem fica na conversa, para a equipe da Wellmix responder.',
                texto(MENSAGEM, exato=False), pausa=0.6),
    ]),
    sua_vez("m2-c5-suavez", C5, "Avisos e mensagens", [
        "Clique no sino e leia os avisos",
        "Veja de quem é a vez em cada aviso",
        "Abra as mensagens e escreva para a Wellmix",
    ], "Agora é com você: pause o vídeo, leia os avisos e mande uma mensagem."),

    encerramento("m2-z9-resumo", "Você domina o portal da certificadora", "Certificado, selo, memorial, troca de arquivo, a tela Certificação, a mesa de trabalho e as mensagens.", [
        'Resumindo: no quadro do alto do cartão "Certificação", você envia o selo e o memorial, e troca um arquivo quando precisar. Para achar o seu trabalho, use as pendências, a tela "Certificação" ou a mesa de trabalho.',
        'Agora responda ao quiz deste módulo e, depois, ao quiz final do treinamento.',
    ]),
]

S, M, T, ME, V = "m2-c1-selo", "m2-c2-memorial", "m2-c3-substituir", "m2-c4-mesa", "m2-c5-avisos"
perguntas = [
    cenario("q1", "Onde entram o selo e o memorial", (S, "p3"),
            'Você precisa enviar o selo e o memorial descritivo de um pedido. Onde isso é feito?',
            ['Nas mensagens', 'No quadro do alto do cartão "Certificação", no pedido', 'Na ficha de compra', 'Na lista "Pedidos"'], 1,
            'O quadro do alto do cartão "Certificação" tem um espaço para o selo e outro para o memorial descritivo.'),
    cenario("q2", "O número do selo", (S, "p4"),
            'O selo que você vai enviar ainda não tem número de registro. Dá para enviar?',
            ['Não: o número é obrigatório', 'Sim: o campo do número é opcional', 'Só depois de o memorial ser enviado', 'Só com a aprovação da Wellmix'], 1,
            'O campo "Nº do selo ou do registro" é opcional: selecione o arquivo do selo e envie.'),
    ordenar("q3", "Passos para enviar o selo", (S, "p2"),
            'Ponha em ordem os passos para enviar o selo de um pedido.',
            ['Em Pendências, clicar em "Abrir" na linha "Gerar o selo de certificação"', 'Digitar o número do selo, se houver',
             'Clicar em "Escolher arquivo" e selecionar o selo', 'Clicar em "Enviar"'],
            'Abra a pendência, digite o número (se houver), selecione o arquivo e clique em "Enviar".'),
    clique("q4", "Enviar o selo", (S, "p6"),
           'O número e o arquivo do selo já estão preenchidos. Clique no botão que envia o selo.',
           'No quadro do alto, selecionar o arquivo não envia: é o botão "Enviar" que manda.'),
    cenario("q5", "Depois do selo", (S, "p8"),
            'Você enviou o selo. Quem aplica o selo na arte da embalagem?',
            ['A certificadora', 'Quem faz a arte: baixa o selo, aplica e envia a arte com o selo; a Wellmix valida', 'O fornecedor', 'O portal, sozinho'], 1,
            'Com o selo enviado, quem faz a arte recebe o aviso. A linha "Selo aplicado na arte" a certificadora só acompanha.'),
    clique("q6", "Enviar o memorial", (M, "p4"),
           'Você está no quadro do alto e quer selecionar o PDF do memorial descritivo. Clique no lugar certo.',
           'No quadro "Memorial descritivo", "Escolher arquivo" seleciona o PDF. Depois, "Enviar".'),
    cenario("q7", "Arquivo errado", (T, "p3"),
            'Você enviou o selo e percebeu que o arquivo estava errado. O que fazer?',
            ['Pedir para a Wellmix apagar o pedido', 'Abrir o pedido e usar "Substituir arquivo" no quadro do selo', 'Enviar o arquivo certo pelas mensagens', 'Nada: não dá para trocar'], 1,
            '"Substituir arquivo" troca o arquivo do selo ou do memorial. O número do selo continua o mesmo.'),
    cenario("q8", "Antes de confirmar a troca", (T, "p4"),
            'Você clicou em "Substituir arquivo" e selecionou o arquivo novo. O arquivo antigo já foi trocado?',
            ['Sim, na hora', 'Ainda não: só depois de "Confirmar substituição"; até lá, dá para cancelar', 'Só amanhã', 'Só se a Wellmix aceitar'], 1,
            'O portal mostra o nome do arquivo novo e espera a confirmação. Sem ela, o arquivo anterior continua valendo.'),
    cenario("q9", "A mesa de trabalho", (ME, "p9"),
            'Você quer ver, numa tela só, todos os certificados que ainda precisa emitir, por prazo. Qual tela usar?',
            ['A ficha de compra', 'A "Mesa de trabalho", que abre pelo botão em Pendências, depois de clicar num filtro', 'O documento do pedido', 'O cartão "Artes"'], 1,
            'A mesa de trabalho da certificadora tem a fila "Certificados a emitir", com o pedido e o prazo de cada produto.'),
    cenario("q10", "Falar com a Wellmix", (V, "p4"),
            'Falta um dado do produto para emitir o certificado. Como pedir à Wellmix pelo portal?',
            ['Recusar a pendência', 'Abrir as mensagens, pelo balão ao lado do sino, e escrever', 'Enviar um certificado em branco', 'Esperar o prazo vencer'], 1,
            'O balão abre a conversa da certificadora com a equipe da Wellmix. Todos os logins da certificadora veem as mesmas mensagens.'),
]

MODULO = {"modulo": {"id": 2, "titulo": "Selo, memorial e os outros caminhos"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
