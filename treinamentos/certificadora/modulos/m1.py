# Certificadora (OCP) · Módulo 1 · Entrar, ler o pedido e enviar o certificado
# Tarefas O1 e O4 do levantamento (`_recon/parceiros-externos.md`), no portal de 15/11/2026:
# o certificado é um item do marco "Certificação" do pedido de compra (docs/MILESTONES.md),
# liberado na criação do pedido. A certificadora vê o pedido completo, só para ler
# (docs/CERTIFICATION.md). Dados: ponto cert-base (`_demo/caminho-arte-certificacao.mjs`).
from roteiro_util import *  # noqa: F401,F403

T1 = "1 · Entrar e se localizar"
C1 = "2 · Suas pendências"
C2 = "3 · Ler o pedido"
C3 = "4 · Enviar o certificado"

PRODUTO = "Glass jar 1.5L with lid"
CERT = item(f"Certificado (Inmetro) · {PRODUTO}")
APROVACAO = item("Certificação aprovada pelo GP")
ARQUIVO = CERT + 'input[aria-label="Escolher arquivo"]'
BOTAO = CERT + "[data-file-button]"
LINHA = linha("Certificado (Inmetro)")
ABRIR = abrir_na_linha("Certificado (Inmetro)")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+$", "rede": True}
ENVIADO = {"some": CERT + "form:has(input[name=requirementId]):not([data-requirement-clear])", "rede": True}
MARCO = 'main details:has(> summary:has-text("Sua tarefa"))'
SINO = "header a[href='/app/notifications']"

cenas = [
    abertura("m1-a0-abertura", "Certificadora", "Entrar, ler o pedido e enviar o certificado", 1, [
        'Olá! Você é da certificadora que cuida dos produtos da Wellmix. É pelo portal que você recebe cada pedido, lê os dados do produto e envia o certificado, o memorial e o selo.',
        'Aqui no primeiro módulo, você aprende a entrar, a ler o pedido e a enviar o certificado de um produto.',
    ]),

    # ------------------------------------------------------ 1 · Entrar e se localizar
    capitulo("m1-t0-cartao", T1, 1, 4, "Entrar e se localizar", "O login e o menu da certificadora",
             "Para começar: a entrada e o menu."),
    {**tela("m1-t1-entrar", T1, "cert-base", inicio="/login?intro=off", tarefa="Entrar no portal", sim=False, passos=[
        mostrar("p1", 'Esta é a entrada do portal. O idioma se escolhe aqui no alto: português, inglês ou chinês.',
                {"papel": "button", "nome": "Português", "acima": 1}, rotulo="Idioma", rotulo_lado="esquerda", destaque_em={"em": "idioma"}),
        digitar("p2", 'Em "Login ou e-mail", digite o seu login.', {"rotulo": "Login ou e-mail"}, "ocp@certifica.com",
                rotulo="Login ou e-mail", rotulo_lado="esquerda", resumo="Digite o seu login", acao_em={"apos": "digite"}, pausa=0.6),
        digitar("p3", 'Logo abaixo, a sua senha.', {"rotulo": "Senha"}, "wellmix123", rotulo="Senha", rotulo_lado="esquerda",
                resumo="Digite a sua senha", acao_em=1.0),
        clicar("p4", 'Depois, clique em "Entrar", o botão vermelho.', {"papel": "button", "nome": "Entrar"}, rotulo="Entrar",
               rotulo_lado="esquerda", resumo='Clique em "Entrar"', espera={"url": "/app", "rede": True}),
        mostrar("p5", 'Você cai direto em "Minhas pendências": tudo o que depende da certificadora.', {"papel": "heading", "nome": "Minhas pendências"}, foco=False),
        mostrar("p6", 'No menu da esquerda, "Pendências" mostra quantas coisas esperam por você.', "aside a[href='/app']", rotulo="Pendências",
                destaque_em={"em": "Pendências"}),
        mostrar("p7", 'Logo abaixo, "Certificação" reúne o passo da certificação de todos os seus pedidos.', "aside a[href='/app/flow/order/certification']",
                rotulo="Certificação"),
        mostrar("p8", 'E "Pedidos" mostra os pedidos em que a sua certificadora foi designada.', "aside a[href='/app/orders']", rotulo="Pedidos"),
        mostrar("p9", 'No alto, à direita, o balão abre as mensagens, e o sino mostra os avisos.', "header a[href='/app/messages']",
                rotulo="Mensagens", rotulo_lado="esquerda", destaque_em={"em": "balão"},
                destaques=[{"alvo": {"seletor": SINO}, "rotulo": "Avisos", "rotulo_lado": "esquerda", "em": {"em": "sino"}}]),
        mostrar("p10", 'E aqui embaixo, o seu nome e o seu papel no portal: certificação.', {"seletor": "[data-user-role]", "acima": 1},
                pausa=0.6, cursor=False),
    ]), "login": False},

    # ------------------------------------------------------------ 2 · Suas pendências
    capitulo("m1-c1-cartao", C1, 2, 4, "Suas pendências", "O ponto de partida de todo dia",
             "Agora: a tela das pendências."),
    tela("m1-c1-pendencias", C1, "cert-base", tarefa="Achar as suas pendências", passos=[
        {"id": "p1", "fala": 'Todo dia, comece por aqui. Esta tela mostra tudo o que depende da certificadora. O mais urgente vem primeiro.'},
        mostrar("p2", 'Cada pedido de produto com certificação traz três tarefas. A primeira é o certificado do produto, uma linha para cada produto do pedido.', LINHA),
        mostrar("p3", 'As outras duas valem para o pedido inteiro: esta, enviar o memorial descritivo, e a de baixo, gerar o selo de certificação.',
                linha("Enviar o memorial descritivo"), foco=False, destaques=[{"alvo": linha("Gerar o selo de certificação"), "em": {"em": "selo"}, "foco": False}]),
        mostrar("p4", 'A coluna "Prazo" mostra a data e em quantos dias vence. O certificado tem prazo. O memorial e o selo aparecem sem data.',
                'main table tbody tr td:has(span:has-text("vence em"))', cursor=False),
        mostrar("p5", 'Acima da lista, os filtros de prazo e de tipo mostram só uma parte das pendências.', {"seletor": "main a[data-task-filter='due:all']", "acima": 2},
                rotulo="Filtros", rotulo_lado="acima", foco=False, cursor=False),
        mostrar("p6", 'E o ícone de abrir, no fim de cada linha, leva você ao pedido daquela tarefa.', ABRIR, rotulo="Abrir", rotulo_lado="esquerda",
                destaque_em={"em": "botão"}, pausa=0.6),
    ]),
    sua_vez("m1-c1-suavez", C1, "Suas pendências", [
        'Entre no portal e veja "Minhas pendências"',
        "Ache a linha do certificado de um produto e o prazo dela",
        "Ache as linhas do memorial descritivo e do selo",
        'Ache o ícone de abrir de cada linha',
    ], "Agora é com você: pause o vídeo e ache as suas pendências."),

    # ------------------------------------------------------------------ 3 · Ler o pedido
    capitulo("m1-c2-cartao", C2, 3, 4, "Ler o pedido", "O que a certificadora vê para certificar",
             "Agora: como ler o pedido antes de certificar."),
    tela("m1-c2-pedido", C2, "cert-base", tarefa="Ler o pedido antes de certificar", passos=[
        clicar("p1", 'Antes de certificar, você precisa conhecer o produto. Na linha do certificado, clique no ícone de abrir, à direita.', ABRIR, alvo_visual=LINHA,
               resumo='Em Pendências, clique no ícone de abrir na linha do certificado', espera=NO_PEDIDO),
        mostrar("p2", 'Você abre o pedido número 1. O resumo traz o cliente, o fornecedor e a data.', {"papel": "heading", "nome": "Resumo do pedido", "acima": 2}, foco=False),
        mostrar("p3", 'O quadro "Itens do pedido" traz os produtos, com a foto, o código, as peças por caixa, a quantidade e as caixas. Aqui, um pote de vidro: duas mil e quatrocentas peças, em duzentas caixas.',
                {"papel": "heading", "nome": "Itens do pedido", "acima": 2}, foco=False),
        mostrar("p4", 'A miniatura mostra a foto do produto, e o número sobre ela diz quantas fotos há. Um clique abre todas.', "[data-gallery-open]",
                rotulo="Fotos do produto", rotulo_lado="direita", zoom=1.3),
        clicar("p5", 'Para os dados técnicos, clique em "Ver ficha de compra", no resumo.', sel("main a", "Ver ficha de compra", n=0), rotulo="Ver ficha de compra",
               rotulo_lado="esquerda", resumo='No resumo, clique em "Ver ficha de compra"', espera={"url": "/purchase-sheet", "rede": True}),
        mostrar("p6", 'A ficha de compra abre só para leitura. Ela traz os dados do fornecedor, do produto e da caixa.',
                texto("Ficha de compra do pedido, para a certificação", exato=False)),
        mostrar("p7", 'No bloco "Produto" estão o peso por peça, a capacidade, o material e a cor.', {"papel": "heading", "nome": "Produto", "acima": 2},
                foco=False, cursor=False),
        mostrar("p7b", 'Mais abaixo, o bloco "Caixa e embalagem" traz as peças por caixa e o tipo de embalagem.', {"papel": "heading", "nome": "Caixa e embalagem", "acima": 2},
                foco=False, cursor=False),
        clicar("p8", 'Para voltar, use "Voltar ao pedido".', sel("main a", "Voltar ao pedido"), rotulo="Voltar ao pedido", rotulo_lado="esquerda",
               resumo='Clique em "Voltar ao pedido"', espera=NO_PEDIDO),
    ]),
    sua_vez("m1-c2-suavez", C2, "Ler o pedido", [
        'Em Pendências, clique no ícone de abrir na linha do certificado',
        'Leia o resumo e os itens do pedido, com as fotos',
        'Clique em "Ver ficha de compra" e leia os dados do produto',
        'Volte com "Voltar ao pedido"',
    ], "Sua vez. Pause o vídeo e leia um pedido, com a ficha de compra."),

    # ------------------------------------------------------------ 4 · Enviar o certificado
    capitulo("m1-c3-cartao", C3, 4, 4, "Enviar o certificado", "O certificado de cada produto do pedido",
             "Por fim: enviar o certificado do produto."),
    tela("m1-c3-certificado", C3, "cert-base", salvar="cert-s1", tarefa="Enviar o certificado de um produto",
         antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'No pedido, mais abaixo, ficam os marcos: as etapas em que a certificadora atua ou que ela acompanha. O marco "Certificação" vem marcado com "Sua tarefa".',
                MARCO, foco=False),
        mostrar("p2", 'A linha do certificado traz o nome do produto. Ela está pendente, e está com a sua certificadora.', CERT.strip()),
        anexar("p3", 'Com o certificado emitido, use o botão "Escolher arquivo" e selecione o PDF.', ARQUIVO, "certificado-de-conformidade-pote-1500ml.pdf",
               alvo_visual=BOTAO, rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo='Na linha do certificado, clique em "Escolher arquivo" e selecione o PDF', acao_em="fim", espera=ENVIADO),
        mostrar("p4", 'O envio acontece na hora, sem outro botão. A linha passa para "Concluído", com o nome do arquivo.', CERT.strip()),
        mostrar("p5", 'A linha de baixo não é sua: quem aprova a certificação é a Wellmix. Ela continua pendente, agora com a equipe dela.', APROVACAO.strip()),
        {"id": "p6", "fala": 'Se o pedido tiver mais de um produto, cada um tem a sua linha, e você repete o envio em cada uma.'},
    ], cuidados=[
        {"erro": '"Formato não aceito: envie foto (JPG, PNG, WEBP, HEIC) ou PDF."',
         "solucao": "Arquivo do Word não entra, e nada foi enviado. Salve o certificado em PDF e envie de novo."},
        {"erro": '"Esta tarefa é de outro responsável do pedido: só quem a recebe (ou o administrador) pode enviar, trocar o arquivo ou validar."',
         "solucao": "O certificado só pode ser enviado pela certificadora designada no pedido. Fale com a Wellmix pelas mensagens."},
    ]),
    cuidado("m1-c3-cuidado", C3, "cert-base", antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'Agora, um ponto de atenção. Voltamos ao momento antes do envio, com a linha do certificado ainda pendente. Ela aceita PDF ou imagem. Arquivo do Word não entra.', CERT.strip(), foco=False),
        anexar("p2", 'Veja o que acontece quando o arquivo escolhido é um documento do Word.', ARQUIVO, "certificado-de-conformidade.docx", alvo_visual=BOTAO,
               acao_em="fim", espera={"url": "error=", "rede": True}),
        mostrar("p3", 'O portal avisa, no alto do pedido, que o formato não é aceito, e nada é enviado. Salve o certificado em PDF e mande outra vez.',
                texto("Formato não aceito", exato=False), pausa=0.6),
    ]),
    sua_vez("m1-c3-suavez", C3, "Enviar o certificado", [
        'Abra o pedido pela linha do certificado, em Pendências',
        'No marco "Certificação", ache a linha do certificado do produto',
        'Clique em "Escolher arquivo" e selecione o PDF do certificado',
        'Veja a linha passar para "Concluído"',
    ], "Agora é com você: pause o vídeo e envie o certificado de um produto."),

    encerramento("m1-z9-resumo", "Certificado enviado", "Entrar, achar as pendências, ler o pedido e enviar o certificado de cada produto.", [
        'Resumindo: você entra com o seu login, começa pelas pendências, lê o pedido e a ficha de compra, e envia o certificado na linha de cada produto.',
        'Agora responda ao quiz deste módulo. No próximo, você envia o selo e o memorial descritivo.',
    ]),
]

E, P, L, C, CU = "m1-t1-entrar", "m1-c1-pendencias", "m1-c2-pedido", "m1-c3-certificado", "m1-c3-cuidado"
perguntas = [
    cenario("q1", "Por onde começar", (P, "p1"),
            'Você entrou no portal de manhã. Onde você vê tudo o que a Wellmix espera da certificadora?',
            ['Na lista "Pedidos"', 'Em "Minhas pendências", a primeira tela', 'Nas mensagens', 'Na ficha de compra'], 1,
            'A conta da certificadora abre em "Minhas pendências", com tudo o que depende de você, por prazo.'),
    cenario("q2", "As três tarefas de um pedido", (P, "p3"),
            'Chegou um pedido novo, de um produto com certificação. Quais tarefas aparecem para a certificadora?',
            ['Só o selo', 'O certificado de cada produto, o memorial descritivo e o selo', 'A arte da embalagem e o selo', 'O contrato e o certificado'], 1,
            'São três: o certificado, uma linha por produto, e, para o pedido inteiro, o memorial descritivo e o selo.'),
    clique("q3", "Abrir a tarefa", (P, "p6"),
           'Você quer ir direto ao lugar onde se envia o certificado do produto. Clique no lugar certo.',
           'O ícone de abrir, no fim da linha, leva você ao pedido daquela tarefa.'),
    cenario("q4", "Onde estão os dados técnicos", (L, "p6"),
            'Para certificar, você precisa do peso, do material e da embalagem do produto. Onde eles estão?',
            ['Nas mensagens', 'Na ficha de compra, que abre por "Ver ficha de compra", só para leitura', 'No cartão "Artes"', 'A Wellmix manda por e-mail'], 1,
            'A ficha de compra traz os dados do fornecedor, do produto e da caixa. A certificadora vê tudo, sem editar.'),
    clique("q5", "Abrir a ficha de compra", (L, "p5"),
           'Você está no pedido e quer os dados técnicos do produto. Clique no lugar certo.',
           '"Ver ficha de compra", no resumo do pedido, abre a ficha só para leitura.'),
    cenario("q6", "O documento do pedido", (L, "p2"),
            'Você quer ver o documento do pedido, o contrato entre a Wellmix e o fornecedor. O que acontece?',
            ['A certificadora assina antes do fornecedor', 'Ele não abre para a certificadora: traz o preço de compra. Os dados para certificar estão na ficha de compra', 'A certificadora assina depois da Wellmix', 'Ele abre só se o pedido tiver selo'], 1,
            'O documento do pedido traz o preço de compra e é assinado só pela Wellmix e pelo fornecedor. A certificadora não o abre: o que ela precisa está na ficha de compra.'),
    ordenar("q7", "Passos para enviar o certificado", (C, "p3"),
            'Ponha em ordem os passos para enviar o certificado de um produto.',
            ['Em Pendências, clicar no ícone de abrir na linha do certificado', 'No marco "Certificação", achar a linha do certificado do produto',
             'Clicar em "Escolher arquivo" e selecionar o PDF', 'Ver a linha passar para "Concluído"'],
            'Abra a pendência, ache a linha do produto no marco "Certificação", suba o PDF e veja a situação mudar.'),
    cenario("q8", "Depois de escolher o arquivo", (C, "p4"),
            'Você selecionou o PDF do certificado em "Escolher arquivo". O que falta para enviar?',
            ['Clicar em "Enviar"', 'Nada: o envio acontece na hora e a linha passa para "Concluído"', 'Avisar a Wellmix por mensagem', 'Assinar o documento do pedido'], 1,
            'Na linha do certificado, o arquivo é enviado assim que você seleciona. Não há outro botão.'),
    cenario("q9", "Formato não aceito", (CU, "p3"),
            'Você selecionou o certificado em Word e o portal respondeu "Formato não aceito". O que fazer?',
            ['Tentar de novo com o mesmo arquivo', 'Salvar o certificado em PDF e enviar de novo', 'Mandar o Word pelo cartão "Artes"', 'Esperar a Wellmix liberar o formato'], 1,
            'Arquivo do Word não entra na linha do certificado, e o que é recusado não é enviado. Salve em PDF e envie de novo.'),
    cenario("q10", "Pedido com vários produtos", (C, "p6"),
            'O pedido tem três produtos com certificação. Como você envia os certificados?',
            ['Um arquivo só, em qualquer linha', 'Um certificado em cada linha: cada produto tem a sua', 'Pelas mensagens', 'Só o do primeiro produto'], 1,
            'O certificado é por produto: cada produto do pedido tem a própria linha no marco "Certificação".'),
]

MODULO = {"modulo": {"id": 1, "titulo": "Entrar, ler o pedido e enviar o certificado"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
