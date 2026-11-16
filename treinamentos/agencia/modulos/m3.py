# Agência de arte · Módulo 3 · Ajustes, a tela Arte e a mesa de trabalho
# Tarefas A5 a A7 do levantamento: corrigir a arte quando a Wellmix aponta uma não
# conformidade (cartão Artes), baixar todas as artes, a tela do passo "Arte" do menu, a Mesa de
# trabalho e os avisos e mensagens. Dados: pontos arte-correcao e arte-final.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Ajuste de arte"
C2 = "2 · A tela Arte e a mesa de trabalho"
C3 = "3 · Avisos e mensagens"

LINHA = linha("Corrigir a arte de Glass jar")
ABRIR = abrir_na_linha("Corrigir a arte de Glass jar")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+", "rede": True}
CARTAO = "[data-artwork-card]"
AJUSTE = "tr[data-artwork-issue]"
NOTA = AJUSTE + ' input[name="fixNote"]'
CAMPO = AJUSTE + " input[type=file]"
CORRECAO = "Margem branca do código de barras ajustada dos dois lados."
MENSAGEM = "Olá! A arte final do pote segue hoje, com o selo na lateral."
SINO = "header a[href='/app/notifications']"

cenas = [
    abertura("m3-a0-abertura", "Agência de arte", "Ajustes, a tela Arte e a mesa de trabalho", 3, [
        'Aqui você descobre o que acontece depois de entregar a arte: o ajuste pedido pela Wellmix.',
        'E conhece outros dois caminhos para achar o seu trabalho, a tela "Arte" e a mesa de trabalho, além dos avisos e das mensagens.',
    ]),

    # -------------------------------------------------------------- 1 · Ajuste de arte
    capitulo("m3-c1-cartao", C1, 1, 3, "Ajuste de arte", "Quando a Wellmix aponta um problema na arte de um produto",
             "Para começar: o ajuste de arte."),
    tela("m3-c1-ajuste", C1, "arte-correcao", salvar="arte-correcao-s1", tarefa="Enviar a correção de uma arte", passos=[
        mostrar("p1", 'Mesmo depois da entrega, a Wellmix pode apontar um problema na arte de um produto. Chega uma pendência nova, pedindo a correção da arte.', LINHA),
        clicar("p2", 'Na linha dela, clique em "Abrir".', ABRIR, alvo_visual=LINHA, resumo='Em Pendências, clique em "Abrir" na linha "Corrigir a arte"',
               espera=NO_PEDIDO),
        mostrar("p3", 'Você cai no cartão das artes do pedido, direto na linha do produto. A situação é "Não conforme", e ao lado vem o que a Wellmix apontou.',
                AJUSTE),
        digitar("p4", 'Ajuste a arte. Depois, no campo "O que foi corrigido", escreva em poucas palavras o que mudou.', NOTA, CORRECAO,
                rotulo="O que foi corrigido", rotulo_lado="acima", resumo='Escreva o que mudou em "O que foi corrigido"', acao_em={"apos": "campo"}, pausa=0.4),
        anexar("p5", 'Escolha o arquivo da arte ajustada.', CAMPO, "arte-corrigida-pote-1500ml.pdf", rotulo="Arquivo", rotulo_lado="acima",
               resumo="Escolha o arquivo da arte ajustada", acao_em="fim", espera={"ms": 600}),
        clicar("p6", 'E clique em "Enviar correção".', "[data-artwork-fix]", rotulo="Enviar correção", rotulo_lado="esquerda",
               resumo='Clique em "Enviar correção"', espera={"seletor": 'tr[data-artwork-issue="fixed"]', "rede": True}),
        mostrar("p7", 'A situação muda para "Corrigida, aguardando aceite". Quem apontou o problema olha a arte nova: se aceitar, o ajuste fecha. Se reabrir, a pendência volta com o motivo.',
                AJUSTE, pausa=0.6),
        apontar("p8", 'No alto do mesmo cartão, o link "Baixar todas as artes" reúne em um único arquivo a versão mais nova de tudo: a faca, as artes e o selo.',
                "[data-artwork-zip]", rotulo="Baixar todas as artes", rotulo_lado="esquerda", zoom=1.3, conta_passo=False, sim=False),
    ]),
    sua_vez("m3-c1-suavez", C1, "Enviar a correção de uma arte", [
        'Em Pendências, clique em "Abrir" na linha "Corrigir a arte"',
        'Leia o que a Wellmix apontou, na linha "Não conforme"',
        'Escreva o que mudou e escolha o arquivo da arte ajustada',
        'Clique em "Enviar correção"',
    ], "Agora é com você: pause o vídeo e envie a correção de uma arte."),

    # --------------------------------------------- 2 · A tela Arte e a mesa de trabalho
    capitulo("m3-c2-cartao", C2, 2, 3, "A tela Arte e a mesa de trabalho", "Outros dois caminhos para o mesmo trabalho",
             "Agora: a tela Arte e a mesa de trabalho."),
    tela("m3-c2-mesa", C2, "arte-final", tarefa="Achar as artes pela tela Arte e pela mesa de trabalho", passos=[
        clicar("p1", 'As pendências não são o único caminho. Para este exemplo, o pedido aparece em um momento anterior, com a arte final ainda por enviar. No menu, abra o grupo "Pedido".', sel("aside button", "Pedido"), rotulo="Pedido",
               resumo='No menu, abra o grupo "Pedido"', espera={"seletor": "aside a[href='/app/flow/order/art']"}),
        clicar("p2", 'E clique em "Arte".', "aside a[href='/app/flow/order/art']", rotulo="Arte", resumo='Clique em "Arte"',
               espera={"url": "/app/flow/order/art", "rede": True}),
        mostrar("p3", 'Esta tela junta só o passo da arte. A aba "Pendências" lista o que espera por você, com o prazo e há quantos dias está aberto.',
                "[data-flow-tab=pending]", rotulo="Pendências", rotulo_lado="abaixo"),
        clicar("p4", 'A aba "Todos no passo" mostra todos os seus pedidos que estão na arte, mesmo sem nada pendente. Abra essa aba.', "[data-flow-tab=all]",
               rotulo="Todos no passo", rotulo_lado="abaixo", resumo='Clique na aba "Todos no passo"', acao_em="fim", espera={"url": "tab=all", "rede": True}),
        mostrar("p4b", 'Cada linha é um pedido, com a etapa em que ele está e o que continua aberto neste passo.', "main table tbody tr", foco=False),
        clicar("p4c", 'Volte para a aba "Pendências".', "[data-flow-tab=pending]", rotulo="Pendências", rotulo_lado="abaixo",
               resumo='Volte para a aba "Pendências"', espera={"seletor": "[data-flow-case-open]", "rede": True}),
        clicar("p5", 'Na linha da pendência, clique em "Resolver".', "[data-flow-case-open]", rotulo="Resolver", rotulo_lado="esquerda",
               resumo='Na linha da pendência, clique em "Resolver"', espera={"url": "/app/flow/order/art/", "rede": True}),
        mostrar("p6", 'Abre só o produto daquela linha, com as duas linhas da arte. Dá para enviar o arquivo daqui mesmo, sem abrir o pedido inteiro.',
                {"papel": "heading", "nome": "Este produto no passo", "acima": 2}, foco=False),
        clicar("p7", 'Agora, a mesa de trabalho. Volte às pendências, pelo menu.', "aside a[href='/app']", rotulo="Pendências", resumo='No menu, clique em "Pendências"',
               acao_em={"apos": "Volte"}, espera={"url": "/app$", "rede": True}),
        clicar("p8", 'Use o filtro "Todas as etapas", mesmo que já apareça marcado.', sel("main a", "Todas as etapas"), rotulo="Todas as etapas", resumo='Clique em "Todas as etapas"',
               espera={"url": "/app/tasks$", "rede": True}),
        clicar("p9", 'Com isso aparece o botão "Mesa de trabalho". Clique nele.', "[data-desk-link]", rotulo="Mesa de trabalho", rotulo_lado="esquerda",
               resumo='Clique em "Mesa de trabalho"', espera={"url": "/app/tasks/desk", "rede": True}),
        mostrar("p10", 'A mesa separa o trabalho em duas filas, por prazo: as artes a fazer e as artes finais com o selo. Aqui, uma arte final espera por você.',
                "main", foco=False),
        mostrar("p11", 'Em cada linha, "Abrir" leva ao pedido.',
                sel("main a", "Abrir"), rotulo="Abrir", rotulo_lado="esquerda", pausa=0.6),
    ]),
    sua_vez("m3-c2-suavez", C2, "A tela Arte e a mesa de trabalho", [
        'No menu, abra "Pedido" e clique em "Arte"',
        'Veja as abas "Pendências" e "Todos no passo"',
        'Clique em "Resolver" numa linha',
        'Em Pendências, clique em "Todas as etapas" e depois em "Mesa de trabalho"',
    ], "Sua vez. Pause o vídeo e ache as suas artes pela tela Arte e pela mesa de trabalho."),

    # ---------------------------------------------------------- 3 · Avisos e mensagens
    capitulo("m3-c3-cartao", C3, 3, 3, "Avisos e mensagens", "O sino e a conversa com a Wellmix",
             "Por fim: os avisos e as mensagens."),
    tela("m3-c3-avisos", C3, "arte-final", tarefa="Ler os avisos e falar com a Wellmix", passos=[
        clicar("p1", 'O sino, no alto, mostra os avisos. O número é quantos você ainda não leu. Abra o sino.', SINO, rotulo="Notificações", rotulo_lado="esquerda",
               resumo="Clique no sino", espera={"url": "/app/notifications", "rede": True}, zoom=1.3),
        mostrar("p2", 'Cada aviso diz o que aconteceu e de quem é a vez. "Sua vez" quer dizer que depende da agência.', "main table tbody tr", foco=False),
        mostrar("p3", 'O botão "Resolver" leva você para a tela certa, e o aviso sai da lista.', sel("main table tbody tr button", "Resolver"),
                rotulo="Resolver", rotulo_lado="esquerda"),
        clicar("p4", 'Para falar com a Wellmix, clique no balão de mensagens, ao lado do sino.', "header a[href='/app/messages']", rotulo="Mensagens",
               rotulo_lado="esquerda", resumo="Clique no balão de mensagens", destaque_em={"em": "balão"}, espera={"url": "/app/messages", "rede": True}),
        mostrar("p5", 'Esta conversa é da sua agência com a equipe da Wellmix. Todos os logins da agência veem as mesmas mensagens.',
                texto("Todos os logins da sua empresa veem esta conversa", exato=False)),
        digitar("p6", 'Escreva a mensagem no campo de baixo. Pode ser uma dúvida sobre a faca, o prazo ou um ajuste.', "main textarea[name=body]", MENSAGEM,
                rotulo="Mensagem", rotulo_lado="acima", resumo="Escreva a mensagem", acao_em={"apos": "baixo"}, pausa=0.5),
        clicar("p7", 'E clique em "Enviar".', sel("main form button[type=submit]", "Enviar"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar"', espera={"texto": MENSAGEM, "ms": 400}, pausa=0.6),
        mostrar("p8", 'A mensagem fica na conversa, para a equipe da Wellmix responder.',
                texto(MENSAGEM, exato=False), pausa=0.6),
    ]),
    sua_vez("m3-c3-suavez", C3, "Avisos e mensagens", [
        "Clique no sino e leia os avisos",
        "Veja de quem é a vez em cada aviso",
        "Abra as mensagens e escreva para a Wellmix",
    ], "Agora é com você: pause o vídeo, leia os avisos e mande uma mensagem."),

    encerramento("m3-z9-resumo", "Você domina o portal da agência", "Arte, selo, arte final, ajustes, a tela Arte, a mesa de trabalho e as mensagens.", [
        'Resumindo: quando a Wellmix aponta um ajuste, você envia a correção pelo cartão "Artes". Para achar o seu trabalho, use as pendências, a tela "Arte" ou a mesa de trabalho. E fale com a Wellmix pelas mensagens.',
        'Agora responda ao quiz deste módulo e, depois, ao quiz final do treinamento.',
    ]),
]

A, M, V = "m3-c1-ajuste", "m3-c2-mesa", "m3-c3-avisos"
perguntas = [
    cenario("q1", "O que é o ajuste de arte", (A, "p1"),
            'A arte do produto já tinha sido entregue e apareceu a pendência "Corrigir a arte". O que ela significa?',
            ['O pedido foi cancelado', 'A Wellmix apontou um problema na arte daquele produto e espera a correção', 'A certificadora trocou o selo', 'O fornecedor pediu outra faca'], 1,
            'É a não conformidade: a Wellmix aponta o problema num produto e quem faz a arte envia a correção.'),
    cenario("q2", "Onde ler o problema", (A, "p3"),
            'Você abriu a pendência "Corrigir a arte". Onde está escrito o que precisa mudar?',
            ['No marco "Material de arte"', 'No cartão "Artes", na linha "Não conforme" do produto', 'Na lista "Pedidos"', 'No cartão "Certificação"'], 1,
            'O cartão "Artes" traz, por produto, a situação e o texto da não conformidade.'),
    ordenar("q3", "Passos da correção", (A, "p2"),
            'Ponha em ordem os passos para enviar a correção de uma arte.',
            ['Em Pendências, clicar em "Abrir" na linha "Corrigir a arte"', 'Ler o que a Wellmix apontou',
             'Escrever o que mudou e escolher o arquivo da arte ajustada', 'Clicar em "Enviar correção"'],
            'Abra a pendência, leia o problema, descreva o que mudou, escolha o arquivo e envie a correção.'),
    clique("q4", "Enviar a correção", (A, "p6"),
           'O texto e o arquivo da arte ajustada já estão preenchidos. Clique no botão que envia a correção.',
           '"Enviar correção" manda o texto e o arquivo. A situação passa a "Corrigida, aguardando aceite".'),
    cenario("q5", "Depois da correção", (A, "p7"),
            'A linha ficou como "Corrigida, aguardando aceite". O que pode acontecer agora?',
            ['Nada mais: o ajuste fecha sozinho', 'Quem apontou aceita, e o ajuste fecha, ou reabre com o motivo', 'A certificadora valida', 'O fornecedor decide'], 1,
            'Quem apontou a não conformidade confere a arte nova: aceita ou reabre, com o motivo.'),
    clique("q6", "A tela Arte", (M, "p2"),
           'Você quer ver só o passo da arte, com todos os seus pedidos. Clique no item certo do menu.',
           'No grupo "Pedido" do menu, "Arte" abre a tela do passo, com as abas "Pendências" e "Todos no passo".'),
    cenario("q7", "A mesa de trabalho", (M, "p10"),
            'Você quer ver, numa tela só, as artes a fazer e as artes finais com o selo, por prazo. Qual tela usar?',
            ['A lista "Pedidos"', 'A "Mesa de trabalho", que abre pelo botão em Pendências, depois de "Todas as etapas"', 'As mensagens', 'O cartão "Certificação"'], 1,
            'A mesa de trabalho separa as artes a fazer e as artes finais com o selo, com o prazo de cada uma.'),
    cenario("q8", "Dúvida sobre a faca", (V, "p4"),
            'Você tem uma dúvida sobre a faca enviada pelo fornecedor. Como falar com a Wellmix pelo portal?',
            ['Enviar a dúvida dentro do arquivo da arte', 'Abrir as mensagens, pelo balão ao lado do sino, e escrever', 'Recusar a pendência', 'Esperar o prazo vencer'], 1,
            'O balão abre a conversa da agência com a equipe da Wellmix. Todos os logins da agência veem as mesmas mensagens.'),
]

MODULO = {"modulo": {"id": 3, "titulo": "Ajustes, a tela Arte e a mesa de trabalho"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
