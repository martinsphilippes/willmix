# Agência de arte · Módulo 1 · Entrar, Pendências e a arte do pedido
# Tarefas A1 e A2 do levantamento (`_recon/parceiros-externos.md`), no portal de 15/11/2026:
# a arte é um item do marco "Arte" do pedido (docs/MILESTONES.md) e libera quando o material
# de arte do fornecedor foi aprovado pelo Comprador. Dados: pontos arte-base e arte-devolvida
# (`_demo/caminho-arte-certificacao.mjs`).
from roteiro_util import *  # noqa: F401,F403

T1 = "1 · Entrar e se localizar"
C1 = "2 · Suas pendências"
C2 = "3 · Enviar a arte do produto"
C3 = "4 · Arte devolvida"

PRODUTO = "Glass jar 1.5L with lid"
ARTE = item(f"Arte · {PRODUTO}")
FACA = item(f"Faca (die cut) · {PRODUTO}")
FOTO = item(f"Foto em alta resolução · {PRODUTO}")
FINAL = item(f"Arte final com o selo · {PRODUTO}")
ARQUIVO = ARTE + 'input[aria-label="Escolher arquivo"]'
BOTAO = ARTE + "[data-file-button]"
LINHA = linha("Arte · Glass jar")
ABRIR = abrir_na_linha("Arte · Glass jar")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+", "rede": True}
ENVIADA = {"some": ARTE + "form:has(input[name=requirementId]):not([data-requirement-clear])", "rede": True}
MARCO_MATERIAL = 'main details:has(> summary:has-text("Material de arte"))'
MARCO_ARTE = 'main details:has(> summary:has-text("Sua tarefa"))'
ETAPA_ARTE = "main a[href='/app/tasks?type=agency.art']"
ETAPA_SELO = "main a[href='/app/tasks?type=agency.seal']"
SINO = "header a[href='/app/notifications']"
MOTIVO = "A marca Wellmix precisa ficar maior na frente da caixa."

cenas = [
    abertura("m1-a0-abertura", "Agência de arte", "Entrar, Pendências e a arte do pedido", 1, [
        'Olá! Você é da agência que faz a arte das embalagens da Wellmix. É pelo portal que você recebe cada arte, envia os arquivos e acompanha a validação.',
        'Aqui no primeiro módulo, você aprende a entrar, a achar o que depende de você e a enviar a arte de um produto.',
    ]),

    # ------------------------------------------------------ 1 · Entrar e se localizar
    capitulo("m1-t0-cartao", T1, 1, 4, "Entrar e se localizar", "O login e o menu da agência",
             "Para começar: a entrada e o menu."),
    {**tela("m1-t1-entrar", T1, "arte-base", inicio="/login?intro=off", tarefa="Entrar no portal", sim=False, passos=[
        mostrar("p1", 'Esta é a entrada do portal. O idioma se escolhe aqui no alto: português, inglês ou chinês.',
                {"papel": "button", "nome": "Português", "acima": 1}, rotulo="Idioma", rotulo_lado="esquerda", destaque_em={"em": "idioma"}),
        digitar("p2", 'Em "Login ou e-mail", digite o seu login.', {"rotulo": "Login ou e-mail"}, "agencia@design.com",
                rotulo="Login ou e-mail", rotulo_lado="esquerda", resumo="Digite o seu login", acao_em={"apos": "digite"}, pausa=0.6),
        digitar("p3", 'Logo abaixo, a sua senha.', {"rotulo": "Senha"}, "wellmix123", rotulo="Senha", rotulo_lado="esquerda",
                resumo="Digite a sua senha", acao_em=1.0),
        clicar("p4", 'Depois, clique em "Entrar", o botão vermelho.', {"papel": "button", "nome": "Entrar"}, rotulo="Entrar",
               rotulo_lado="esquerda", resumo='Clique em "Entrar"', espera={"url": "/app", "rede": True}),
        mostrar("p5", 'Você cai direto em "Minhas pendências": tudo o que depende da agência.', {"papel": "heading", "nome": "Minhas pendências"}, foco=False),
        mostrar("p6", 'No menu da esquerda, "Pendências" mostra quantas coisas esperam por você.', "aside a[href='/app']", rotulo="Pendências",
                destaque_em={"em": "menu"}),
        clicar("p7", 'Abra o grupo "Pedido". Ele tem dois passos seus: "Certificação", onde entra o selo, e "Arte".',
               sel("aside button", "Pedido"), rotulo="Pedido", resumo='Abra o grupo "Pedido"', destaque_em={"em": "Abra"}, acao_em={"apos": "Pedido"},
               espera={"seletor": "aside a[href='/app/flow/order/art']"}),
        mostrar("p8", 'E "Pedidos" mostra os pedidos em que a sua agência trabalha.', "aside a[href='/app/orders']", rotulo="Pedidos"),
        mostrar("p9", 'No alto, à direita, o balão abre as mensagens, e o sino mostra os avisos.', "header a[href='/app/messages']",
                rotulo="Mensagens", rotulo_lado="esquerda", destaque_em={"em": "balão"},
                destaques=[{"alvo": {"seletor": SINO}, "rotulo": "Notificações", "rotulo_lado": "esquerda", "em": {"em": "sino"}}]),
        mostrar("p10", 'E aqui embaixo, o nome da sua conta e o seu papel no portal: Agência.', {"seletor": "[data-user-role]", "acima": 1},
                pausa=0.6, cursor=False),
    ]), "login": False},

    # ------------------------------------------------------------ 2 · Suas pendências
    capitulo("m1-c1-cartao", C1, 2, 4, "Suas pendências", "O ponto de partida de todo dia",
             "Agora: a tela das pendências."),
    tela("m1-c1-pendencias", C1, "arte-base", tarefa="Achar as suas pendências", passos=[
        {"id": "p1", "fala": 'Todo dia, comece por aqui. Esta tela junta tudo o que a Wellmix espera da agência.'},
        mostrar("p2", 'O caminho da agência tem duas etapas: "Arte do pedido" e "Selo na arte". A bolinha depois do nome diz quantas pendências há ali. Etapa sem bolinha não tem nada esperando.',
                ETAPA_ARTE, zoom=1.3, cursor=False),
        mostrar("p3", 'As cores avisam: amarelo é a fazer, no prazo. Vermelho é atrasado. Verde é nada a fazer.',
                {"texto": "A fazer, no prazo", "exato": False, "acima": 1}, foco=False, cursor=False),
        clicar("p4", 'Clique em uma etapa para ver só as pendências dela. Por exemplo, "Arte do pedido".', ETAPA_ARTE, rotulo="Arte do pedido",
               resumo="Clique numa etapa para filtrar", acao_em={"apos": "exemplo"}, espera={"url": "type=agency.art", "rede": True}),
        mostrar("p5", 'A lista mostra só as pendências dessa etapa. Aqui continua a mesma linha: é a única pendência.', "main table tbody tr", foco=False),
        clicar("p6", 'Para voltar a ver tudo, escolha "Todas as etapas".', sel("main a", "Todas as etapas"), rotulo="Todas as etapas",
               resumo='Clique em "Todas as etapas"', espera={"url": "/app/tasks$", "rede": True}),
        mostrar("p7", 'Cada linha traz o pedido, o detalhe e o prazo. A coluna "Detalhe" diz o que falta: aqui, a arte do pote de vidro do pedido número 1.',
                LINHA, foco=False),
        mostrar("p8", 'Embaixo da data, o portal diz em quantos dias a pendência vence. A lista já vem com o mais urgente primeiro.',
                'main table tbody tr td:has(span:has-text("vence em"))', cursor=False),
        mostrar("p9", 'E o ícone de abrir, no fim da linha, leva você direto ao pedido.', ABRIR, rotulo="Abrir", rotulo_lado="esquerda",
                destaque_em={"em": "botão"}, pausa=0.6),
    ]),
    sua_vez("m1-c1-suavez", C1, "Suas pendências", [
        'Entre no portal e veja "Minhas pendências"',
        "Clique numa etapa para filtrar a lista",
        'Volte com "Todas as etapas"',
        'Ache o ícone de abrir da pendência mais urgente',
    ], "Agora é com você: pause o vídeo e ache as suas pendências."),

    # -------------------------------------------------- 3 · Enviar a arte do produto
    capitulo("m1-c2-cartao", C2, 3, 4, "Enviar a arte do produto", "Baixar a faca e a foto, e subir a arte",
             "Agora, a tarefa principal: enviar a arte."),
    tela("m1-c2-arte", C2, "arte-base", salvar="arte-s1", tarefa="Enviar a arte de um produto", passos=[
        mostrar("p1", 'A arte aparece para você quando o material está pronto: o fornecedor enviou a faca da caixa e a foto do produto, e a Wellmix aprovou. Aí a pendência entra na sua lista.',
                LINHA),
        clicar("p2", 'Na linha da arte, clique no ícone de abrir, à direita.', ABRIR, alvo_visual=LINHA, resumo='Em Pendências, clique no ícone de abrir na linha da arte',
               espera=NO_PEDIDO),
        mostrar("p3", 'Você está no pedido número 1: o pote de vidro, duas mil e quatrocentas peças.', {"papel": "heading", "nome": "Pedido #1", "acima": 1}, foco=False),
        mostrar("p4", 'Mais abaixo estão os marcos do pedido. São as etapas em que a agência atua, e as que ela só acompanha.',
                {"papel": "heading", "nome": "Marcos do pedido"}),
        mostrar("p5", 'No marco "Material de arte" está o que o fornecedor enviou. A faca é o desenho da caixa aberta, com as medidas e as dobras.',
                FACA.strip()),
        apontar("p6", 'O nome do arquivo é um link. É por ele que você baixa a faca, para montar a arte em cima dela.',
                sel("main a", "faca-caixa-pote-1500ml.pdf"), rotulo="Baixar a faca", rotulo_lado="direita", resumo="Baixe a faca pelo nome do arquivo", zoom=1.3),
        apontar("p7", 'Logo abaixo, do mesmo jeito, a foto do produto em alta resolução.', sel(FOTO + "a", "foto-alta-pote-1500ml.jpg"),
                rotulo="Baixar a foto", rotulo_lado="direita", resumo="Baixe a foto em alta resolução", zoom=1.3),
        mostrar("p8", 'O marco "Arte" vem marcado com "Sua tarefa". A linha da arte do produto está pendente, e está com a sua agência.',
                MARCO_ARTE, foco=False),
        anexar("p9", 'Com a arte pronta, use o botão "Escolher arquivo" e selecione o arquivo. Vale PDF, imagem ou o arquivo aberto da arte.',
               ARQUIVO, "arte-caixa-pote-1500ml.pdf", alvo_visual=BOTAO, rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo='Na linha da arte, clique em "Escolher arquivo" e selecione a arte', acao_em="fim", espera=ENVIADA),
        mostrar("p10", 'O envio acontece na hora, sem outro botão. A linha passa para "Concluído", com o nome do arquivo e a versão.',
                ARTE.strip()),
        mostrar("p11", 'Agora a Wellmix valida a sua arte. A linha de baixo, a arte final com o selo, ainda espera essa validação e o certificado do produto. Ela fica para o próximo módulo.',
                FINAL.strip(), pausa=0.6),
    ], cuidados=[
        {"erro": '"Formato não aceito: envie foto (JPG, PNG, WEBP, HEIC) ou PDF."',
         "solucao": "Vídeo não entra, e nada foi enviado. Exporte a arte em PDF ou imagem e envie de novo. O arquivo aberto da arte (AI, PSD, EPS, CDR, TIFF) também é aceito, embora o aviso cite só foto e PDF."},
        {"erro": '"Arquivo grande demais (máx. 50 MB)."',
         "solucao": "Cada arquivo pode ter até 50 MB. Reduza o arquivo ou envie em PDF compactado."},
    ]),
    cuidado("m1-c2-cuidado", C2, "arte-base", antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'Agora, um ponto de atenção. Voltamos ao momento antes do envio, com a linha da arte ainda pendente. Ela aceita PDF, imagem e arquivo de arte. Vídeo não entra.', ARTE.strip(), foco=False),
        anexar("p2", 'Veja o que acontece quando o arquivo escolhido é um vídeo.', ARQUIVO, "amostra-3d-video.mp4", alvo_visual=BOTAO, acao_em="fim",
               espera={"url": "error=", "rede": True}),
        mostrar("p3", 'O portal avisa que o formato não é aceito, e nada é enviado. Salve a arte em PDF e mande outra vez.', texto("Formato não aceito", exato=False), pausa=0.6),
    ]),
    sua_vez("m1-c2-suavez", C2, "Enviar a arte do produto", [
        'Em Pendências, clique no ícone de abrir na linha da arte',
        'No marco "Material de arte", baixe a faca e a foto em alta',
        'No marco "Arte", clique em "Escolher arquivo" e selecione a arte',
        'Veja a linha passar para "Concluído"',
    ], "Sua vez. Pause o vídeo e envie a arte de um produto."),

    # ------------------------------------------------------------- 4 · Arte devolvida
    capitulo("m1-c3-cartao", C3, 4, 4, "Arte devolvida", "Ler o motivo e enviar a nova versão",
             "Por fim: quando a arte volta para a agência."),
    tela("m1-c3-devolvida", C3, "arte-devolvida", salvar="arte-s2", tarefa="Reenviar uma arte devolvida", passos=[
        clicar("p1", 'Às vezes a arte volta: a equipe da Wellmix olhou e pediu um ajuste. O aviso chega pelo sino, aqui no alto. Abra o sino.', SINO, rotulo="Notificações", rotulo_lado="esquerda",
               resumo="Clique no sino", espera={"url": "/app/notifications", "rede": True}, zoom=1.3),
        mostrar("p2", 'O aviso diz que a arte foi reprovada, e traz o motivo: a marca precisa ficar maior na frente da caixa.',
                sel("main table tbody tr", "reprovado"), foco=False),
        clicar("p3", 'Use o botão "Resolver" para ir ao pedido.', sel("button", "Resolver", dentro=sel("main table tbody tr", "reprovado")),
               rotulo="Resolver", rotulo_lado="esquerda", resumo='No aviso, clique em "Resolver"', espera=NO_PEDIDO),
        mostrar("p4", 'No marco da arte, a linha voltou para "Reprovado". O motivo aparece logo abaixo, junto do arquivo que você tinha enviado.',
                ARTE.strip()),
        anexar("p5", 'Ajuste a arte e envie a nova versão pelo mesmo botão, "Escolher arquivo".', ARQUIVO, "arte-caixa-pote-1500ml-v2.pdf",
               alvo_visual=BOTAO, rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo='Clique em "Escolher arquivo" e selecione a nova versão',
               acao_em="fim", espera=ENVIADA),
        mostrar("p6", 'Pronto: a linha mostra a versão 2. O motivo antigo continua escrito ali, mas a arte já voltou para a validação da Wellmix.', ARTE.strip(), pausa=0.6),
    ]),
    sua_vez("m1-c3-suavez", C3, "Reenviar a arte devolvida", [
        'Abra o sino e leia o aviso da arte reprovada',
        'Clique em "Resolver"',
        'No marco "Arte", leia o motivo na linha da arte',
        'Clique em "Escolher arquivo" e selecione a nova versão',
    ], "Agora é com você: pause o vídeo e envie a nova versão de uma arte."),

    encerramento("m1-z9-resumo", "A arte está com a Wellmix", "Entrar, achar as pendências, enviar a arte e reenviar quando ela volta.", [
        'Resumindo: você entra com o seu login, começa pelas pendências, baixa a faca e a foto, e envia a arte na linha do produto. Se a arte voltar, você lê o motivo e envia a nova versão.',
        'Agora responda ao quiz deste módulo. No próximo, você aplica o selo e envia a arte final.',
    ]),
]

E, P, A, CU, D = "m1-t1-entrar", "m1-c1-pendencias", "m1-c2-arte", "m1-c2-cuidado", "m1-c3-devolvida"
perguntas = [
    cenario("q1", "Por onde começar", (P, "p1"),
            'Você entrou no portal de manhã. Onde você vê tudo o que a Wellmix espera da agência?',
            ['Na lista "Pedidos"', 'Em "Minhas pendências", a primeira tela', 'Nas mensagens', 'No rodapé da tela'], 1,
            'A conta da agência abre em "Minhas pendências", com tudo o que depende de você, por prazo.'),
    clique("q2", "Filtrar por etapa", (P, "p4"),
           'Você quer ver só as pendências da etapa "Arte do pedido". Clique no lugar certo.',
           'Clicar numa etapa do caminho filtra a lista. "Todas as etapas" volta a mostrar tudo.'),
    cenario("q3", "Quando a arte chega", (A, "p1"),
            'Apareceu nas suas pendências a arte de um produto. O que aconteceu antes?',
            ['A Wellmix assinou o contrato', 'O fornecedor enviou a faca e a foto em alta, e a Wellmix aprovou esse material', 'A certificadora enviou o selo', 'O pedido embarcou'], 1,
            'A arte libera quando o material de arte do fornecedor (faca e foto em alta) está enviado e aprovado.'),
    clique("q4", "Baixar a faca", (A, "p6"),
           'Você está no pedido e precisa da faca da caixa para montar a arte. Clique no lugar certo.',
           'No marco "Material de arte", o nome do arquivo da faca é o link para baixar.'),
    ordenar("q5", "Passos para enviar a arte", (A, "p2"),
            'Ponha em ordem os passos para enviar a arte de um produto.',
            ['Em Pendências, clicar no ícone de abrir na linha da arte', 'Baixar a faca e a foto em alta, no marco "Material de arte"',
             'No marco "Arte", clicar em "Escolher arquivo" e selecionar a arte', 'Ver a linha passar para "Concluído"'],
            'Abra a pendência, baixe o material do fornecedor, suba a arte na linha do produto e veja a situação mudar.'),
    cenario("q6", "Depois de escolher o arquivo", (A, "p10"),
            'Você escolheu o arquivo da arte em "Escolher arquivo". O que falta para enviar?',
            ['Clicar em "Enviar"', 'Nada: o envio acontece na hora e a linha passa para "Concluído"', 'Avisar a Wellmix por mensagem', 'Abrir o cartão Certificação'], 1,
            'Na linha da arte, o arquivo é enviado assim que você escolhe. Não há outro botão.'),
    cenario("q7", "Formato não aceito", (CU, "p3"),
            'Você escolheu um vídeo na linha da arte e o portal respondeu "Formato não aceito". O que fazer?',
            ['Tentar de novo com o mesmo vídeo', 'Exportar a arte em PDF ou imagem e enviar de novo', 'Mandar o vídeo pelas mensagens', 'Esperar a Wellmix liberar o formato'], 1,
            'Vídeo não entra na linha da arte, e o que é recusado não é enviado. Exporte a arte em PDF ou imagem e envie de novo.'),
    cenario("q8", "Arte devolvida", (D, "p4"),
            'Chegou o aviso de que a arte foi reprovada. Onde está escrito o que a Wellmix quer que mude?',
            ['Na lista "Pedidos"', 'No aviso do sino e na linha da arte, junto de "Reprovado"', 'No marco "Material de arte"', 'Só por telefone'], 1,
            'O motivo vem no aviso e fica na linha da arte, no marco "Arte", ao lado da situação "Reprovado".'),
    clique("q9", "Enviar a nova versão", (D, "p5"),
           'Você ajustou a arte que voltou. Clique no botão que envia a nova versão.',
           'A nova versão sobe pelo mesmo botão, "Escolher arquivo", na linha da arte. A linha mostra a versão 2.'),
]

MODULO = {"modulo": {"id": 1, "titulo": "Entrar, Pendências e a arte do pedido"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
