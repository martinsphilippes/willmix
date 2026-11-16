# Fornecedor · Módulo 8 · Acompanhar pedidos e certificações
# Tarefas T15 (acompanhar pedidos e documentos) e T19 (certificações da fábrica).
# Dados: ponto forn-fim (pedido com tudo do fornecedor feito até o embarque).
from roteiro_util import *  # noqa: F401,F403

PARTES = 2
C1 = "1 · Acompanhar os pedidos"
C2 = "2 · Certificações da fábrica"

CERT = "form:has(input[name=kind]) "
MENU_BOOKS = sel("aside button", "Meus books")

cenas = [
    abertura("m8-a0-abertura", "Fornecedor", "Acompanhar pedidos e certificações", 8, [
        'Você já sabe fazer cada tarefa do pedido. Aqui você aprende a acompanhar um pedido inteiro, mesmo quando não há pendência.',
        'E a registrar as certificações da sua fábrica.',
    ]),

    # ---------------------------------------------------- 1 · Acompanhar os pedidos
    capitulo("m8-c1-cartao", C1, 1, PARTES, "Acompanhar os pedidos", "A lista de pedidos e a tela do pedido",
             "Primeiro: acompanhar os pedidos."),
    tela("m8-c1-pedidos", C1, "forn-fim", tarefa="Acompanhar um pedido", passos=[
        mostrar("p1", 'Quando tudo o que dependia de você está feito, a lista de pendências fica vazia. Mas o pedido continua andando, e você pode acompanhar.',
                texto("Nenhuma pendência agora"), foco=False),
        clicar("p2", 'No menu, abra o grupo "Meus books".', MENU_BOOKS, rotulo="Meus books", resumo='Abra o grupo "Meus books"',
               espera={"seletor": "aside a[href='/app/orders']"}),
        clicar("p3", 'E clique em "Pedidos".', "aside a[href='/app/orders']", rotulo="Pedidos", resumo='Clique em "Pedidos"',
               espera={"url": "/app/orders$", "rede": True}),
        mostrar("p4", 'A lista mostra todos os seus pedidos: o produto, a etapa, a situação, o progresso e o prazo.', sel("main table tbody tr", "#1"), foco=False),
        mostrar("p5", 'Com muitos pedidos, use os filtros do cabeçalho: por número, por produto, por etapa, por situação ou por prazo.',
                '[data-orders-filter="ph"]', rotulo="Filtro por etapa", rotulo_lado="abaixo"),
        clicar("p6", 'Para abrir um pedido, clique no número dele.', sel("main table tbody tr a", "#1", n=0), alvo_visual=sel("main table tbody tr", "#1"), rotulo="Nº do pedido", rotulo_lado="abaixo",
               resumo="Clique no número do pedido", espera={"url": "/purchase-order", "rede": True}),
        mostrar("p7", 'O número abre o documento do pedido, que é o contrato.', {"papel": "heading", "nome": "Documento do pedido #1"}),
        clicar("p8", 'Para ver o pedido inteiro, use o link "Etapas e pendências do pedido".', sel("main a", "Etapas e pendências do pedido"),
               rotulo="Etapas e pendências do pedido", rotulo_lado="abaixo", resumo='Clique em "Etapas e pendências do pedido"',
               espera={"url": "/app/orders/[^/?#]+$", "rede": True}),
        mostrar("p9", 'A tabela de etapas mostra onde o pedido está. Aqui, o contrato, a produção e a inspeção estão concluídos. A Ficha de compra segue em andamento, como você viu no módulo 5.',
                sel("#order-stages table", n=0), foco=False),
        mostrar("p9b", 'Embaixo da tabela aparece a etapa em andamento: o embarque, que está com a companhia marítima.',
                sel("#order-stages section", "Companhia marítima (ou a Wellmix")),
        clicar("p10", 'Numa etapa concluída, como a inspeção, "Ver detalhes" mostra o que foi enviado.', '[data-stage-open="INSPECTION"]', rotulo="Ver detalhes",
               rotulo_lado="esquerda", resumo='Numa etapa concluída, clique em "Ver detalhes"', espera={"url": "stage=INSPECTION", "rede": True}),
        mostrar("p10b", 'A etapa abre logo abaixo da tabela, com tudo o que foi enviado nela. Os itens opcionais que não foram preenchidos continuam como "Pendente".', sel("#order-stages section", "Foto sem embalagem"), foco=False),
        mostrar("p11", 'Mais abaixo, a lista de documentos mostra os arquivos do pedido, com a data de envio e se já foram vistos.',
                "#order-documents"),
        mostrar("p12", 'E para falar sobre este pedido, use "Conversar com a Wellmix", no alto da página.', '[data-chat-target="own"]',
                rotulo="Conversar com a Wellmix", rotulo_lado="abaixo", pausa=0.6),
    ]),
    sua_vez("m8-c1-suavez", C1, "Acompanhar um pedido", [
        'Abra "Meus books" e clique em "Pedidos"',
        "Clique no número de um pedido",
        'Clique em "Etapas e pendências do pedido"',
        'Use "Ver detalhes" numa etapa concluída',
    ], "Agora é com você: pause o vídeo e acompanhe um pedido pelo menu."),

    # ------------------------------------------------- 2 · Certificações da fábrica
    capitulo("m8-c2-cartao", C2, 2, PARTES, "Certificações da fábrica", "Registrar um certificado para a Wellmix validar",
             "Agora: as certificações da fábrica."),
    tela("m8-c2-certificacao", C2, "forn-fim", salvar="forn-m8-s1", tarefa="Registrar uma certificação da fábrica", passos=[
        clicar("p1", 'As certificações ficam na Conta corrente. No menu, abra "Meus books".', MENU_BOOKS, rotulo="Meus books", resumo='Abra o grupo "Meus books"',
               espera={"seletor": "aside a[href='/app/account']"}),
        clicar("p2", 'E clique em "Conta corrente".', "aside a[href='/app/account']", rotulo="Conta corrente", resumo='Clique em "Conta corrente"',
               espera={"url": "/app/account", "rede": True}),
        mostrar("p3", 'No fim da página fica o quadro "Certificações do fornecedor": as certificações da fábrica, como a ISO e as auditorias.',
                {"papel": "heading", "nome": "Certificações do fornecedor"}),
        digitar("p4", 'Para registrar uma, comece pelo tipo, que é obrigatório: a norma, como ISO 9001.', CERT + "input[name=kind]", "ISO 9001", rotulo="Tipo", rotulo_lado="acima",
                resumo='Em "Tipo", escreva a norma, como ISO 9001'),
        {**digitar("p5", 'Depois, o título do certificado, como está no documento. Neste exemplo, um sistema de gestão da qualidade.', CERT + "input[name=name]", "Sistema de gestão da qualidade", rotulo="Nome / título", rotulo_lado="acima", resumo="Escreva o nome ou título", acao_em={"apos": "documento."}), "sim": False},
        digitar("p6", 'O órgão emissor: a entidade que emitiu o certificado.', CERT + "input[name=issuer]", "SGS", rotulo="Órgão emissor", rotulo_lado="acima", resumo="Informe o órgão emissor"),
        {**digitar("p7", 'O número do certificado, igual ao do documento.', CERT + "input[name=number]", "QMS-2026-04471", rotulo="Número", rotulo_lado="acima", resumo="Digite o número do certificado"), "sim": False},
        data_fixa("p8", 'E a data de validade.', CERT + "input[name=validUntil]", "2028-06-30", rotulo="Validade", rotulo_lado="acima", resumo="Informe a validade"),
        anexar("p9", 'Escolha o documento: o PDF ou uma imagem do certificado.', CERT + "input[name=document]", "certificado-iso-9001.pdf", rotulo="Documento",
               rotulo_lado="esquerda", resumo="Escolha o arquivo do certificado", acao_em="fim"),
        clicar("p10", 'E clique em "Registrar certificação".', CERT + "button[type=submit]", rotulo="Registrar certificação", rotulo_lado="direita",
               resumo='Clique em "Registrar certificação"', espera={"texto": "QMS-2026-04471", "rede": True}),
        mostrar("p11", 'A certificação aparece na lista como "Pendente". Quem valida é a Wellmix: depois da conferência, a situação muda.',
                sel("main li", "QMS-2026-04471"), pausa=0.6),
    ]),
    sua_vez("m8-c2-suavez", C2, "Registrar uma certificação", [
        'Abra "Meus books" e clique em "Conta corrente"',
        'Desça até "Certificações do fornecedor"',
        "Preencha o tipo, o órgão emissor, o número e a validade",
        'Escolha o documento e clique em "Registrar certificação"',
    ], "Sua vez. Pause o vídeo e registre uma certificação da fábrica."),

    encerramento("m8-z9-resumo", "Pedidos e certificações em dia", "Acompanhar pelo menu e registrar na Conta corrente.", [
        'Resumindo: pelo menu, você acompanha qualquer pedido, etapa por etapa, e registra as certificações da fábrica na Conta corrente.',
        'Com isso, você viu o caminho inteiro: do book ao embarque. Responda ao quiz deste módulo. O próximo, que é o último, mostra dois casos especiais: a compra EXW e a compra programada.',
    ]),
]

PD, CT = "m8-c1-pedidos", "m8-c2-certificacao"
perguntas = [
    cenario("q1", "Acompanhar sem pendência", (PD, "p1"),
            'A sua lista de pendências está vazia, mas você quer saber em que etapa está o pedido #1. Por onde vai?',
            ['Não dá: sem pendência, o pedido some', 'Pelo menu "Meus books", em "Pedidos"', 'Pelo sino de avisos', 'Pela tela de login'], 1,
            'Pendências mostra só o que depende de você. A lista "Pedidos" mostra todos os seus pedidos, com a etapa e o progresso.'),
    clique("q2", "Abrir a lista de pedidos", (PD, "p3"),
           'Você quer ver todos os seus pedidos. Clique no item certo do menu.',
           'Em "Meus books", "Pedidos" lista todos os pedidos da sua empresa.'),
    cenario("q3", "O que a linha do pedido abre", (PD, "p7"),
            'Na lista de pedidos, você clicou no número de um pedido. O que abre?',
            ['A Conta corrente', 'O documento do pedido, que é o contrato', 'A solicitação original', 'O book'], 1,
            'A linha abre o documento do pedido. De lá, "Etapas e pendências do pedido" leva à tela completa.'),
    clique("q4", "Ver o pedido inteiro", (PD, "p8"),
           'Você está no documento do pedido e quer ver todas as etapas. Clique no lugar certo.',
           '"Etapas e pendências do pedido" abre a tela com as etapas, os documentos, a produção e o container.'),
    cenario("q5", "Rever o que foi enviado", (PD, "p10"),
            'Você quer conferir as fotos que enviou na inspeção, que já está concluída. O que usar na tabela de etapas?',
            ['O botão "Voltar"', '"Ver detalhes", na linha da etapa "Inspeção"', 'O filtro de prazo', 'A Conta corrente'], 1,
            '"Ver detalhes" abre a etapa concluída com tudo o que foi enviado nela.'),
    cenario("q6", "Onde ficam as certificações", (CT, "p3"),
            'Sua fábrica renovou a ISO 9001. Onde você registra o novo certificado?',
            ['Na solicitação ao fornecedor', 'Na Conta corrente, no quadro "Certificações do fornecedor"', 'No Die Cut', 'Nos documentos do embarque'], 1,
            'As certificações da fábrica ficam no fim da Conta corrente, separadas das certificações de cada produto.'),
    cenario("q7", "Depois de registrar a certificação", (CT, "p11"),
            'Você registrou a certificação e ela apareceu como "Pendente". O que falta?',
            ['Registrar de novo', 'A Wellmix conferir e validar', 'Assinar o contrato', 'Enviar a amostragem'], 1,
            'A certificação registrada pelo fornecedor fica pendente até a Wellmix validar.'),
    clique("q8", "Campo obrigatório da certificação", (CT, "p4"),
           'Ao registrar uma certificação, um campo é obrigatório: o nome dela. Clique nesse campo.',
           'O campo "Tipo" recebe o nome da certificação, por exemplo ISO 9001. Sem ele, o registro não é aceito.'),
]

MODULO = {"modulo": {"id": 8, "titulo": "Acompanhar pedidos e certificações"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
