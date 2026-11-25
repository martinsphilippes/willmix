# Fornecedor · Módulo 6 · Amostras do pedido e container na origem
# Tarefas T12 (amostras: retirada, envios, validar a devolução) e T13 (container na origem).
# Dados: pontos forn-m6-amostras, forn-m6-devolucao, forn-m6-container, forn-m7-base,
# forn-m6-lacre e forn-m6-recusado.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Amostras do pedido"
C2 = "2 · Validar a devolução da amostra"
C3 = "3 · Container vazio na fábrica"
C4 = "4 · Carregamento, lacre e porto"

A = "#samples-flow-step-"      # linhas do cartão Amostras
K = "#container-origin-step-"  # linhas do cartão Container na origem


def campo(linha: str) -> str:
    return linha + ' input[name="value"]'


def arquivo(linha: str) -> str:
    return linha + " input[type=file]"


def enviar(chave: str) -> str:
    return f'[data-import-submit="{chave}"]'


def feito(linha: str) -> dict:
    return {"seletor": linha + '[data-import-status="submitted"]', "rede": True}


def abre(texto_da_linha: str, linha_do_cartao: str) -> dict:
    return dict(alvo_visual=linha(texto_da_linha),
                espera={"url": "/app/orders/", "seletor": linha_do_cartao, "rede": True})


cenas = [
    abertura("m6-a0-abertura", "Fornecedor", "Amostras e container na origem", 6, [
        'Inspeção aprovada, o pedido caminha para o embarque. Aqui você aprende a registrar as amostras do pedido e os passos do container na sua fábrica.',
        'São registros simples, mas em ordem: cada passo abre o seguinte.',
    ]),

    # -------------------------------------------------------- 1 · Amostras do pedido
    capitulo("m6-c1-cartao", C1, 1, 4, "Amostras do pedido", "Retirada, envio ao Brasil e envio à China",
             "Primeiro: as amostras do pedido."),
    tela("m6-c1-amostras", C1, "forn-m6-amostras", salvar="forn-m6-s1", tarefa="Registrar a retirada e os envios das amostras", passos=[
        mostrar("p1", 'Com a inspeção aprovada, é hora das amostras do pedido: as peças do pedido de amostras que você aceitou junto com o contrato.',
                linha("Retirada das amostras")),
        clicar("p2", 'Na linha "Retirada das amostras", clique no ícone de abrir, à direita.', abrir_na_linha("Retirada das amostras"),
               resumo='Em Pendências, clique no ícone de abrir na linha "Retirada das amostras"', **abre("Retirada das amostras", A + "samples_picked")),
        mostrar("p3", 'O cartão "Amostras" mostra a divisão por produto: quantas peças vão para o show room no Brasil e quantas para a agência de marketing na China.',
                sel("main table", "Agência (China)")),
        data("p4", 'Na tabela de passos, comece pela retirada: informe a data em que as amostras foram separadas.', campo(A + "samples_picked"), 0,
             rotulo="Retirada das amostras (data)", rotulo_lado="esquerda", resumo="Informe a data da retirada das amostras", acao_em={"apos": "retirada:"}),
        clicar("p5", 'E clique em "Enviar".', A + "samples_picked " + enviar("samples_picked"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha da retirada', espera=feito(A + "samples_picked")),
        digitar("p6", 'Com a retirada registrada, os dois envios abrem. Comece pelo envio ao show room no Brasil: digite o rastreio.', campo(A + "samples_brazil"), "784-5521 9034",
                rotulo="Rastreio", rotulo_lado="esquerda", resumo="No envio ao Brasil, digite o rastreio", acao_em={"apos": "Brasil:"}),
        anexar("p7", 'Escolha também o comprovante do envio. Aqui o arquivo é obrigatório.', arquivo(A + "samples_brazil"), "amostras-envio-brasil.pdf",
               rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo="Escolha o comprovante do envio ao Brasil", acao_em="fim"),
        clicar("p8", 'Depois, o botão "Enviar" dessa linha.', A + "samples_brazil " + enviar("samples_brazil"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do envio ao Brasil', espera=feito(A + "samples_brazil")),
        digitar("p9", 'Repita os passos para o envio à agência de marketing na China: o rastreio.', campo(A + "samples_china"), "SF 1029 3847 5566",
                rotulo="Rastreio", rotulo_lado="esquerda", resumo="No envio à China, digite o rastreio", acao_em={"apos": "China:"}),
        anexar("p10", 'O comprovante.', arquivo(A + "samples_china"), "amostras-envio-china.pdf", rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo="Escolha o comprovante do envio à China", acao_em="fim"),
        clicar("p11", 'E o botão "Enviar".', A + "samples_china " + enviar("samples_china"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do envio à China', espera=feito(A + "samples_china")),
        mostrar("p12", 'O passo seguinte é da agência de marketing: ela registra que recebeu as amostras.', A + "samples_china_received", cursor=False),
        mostrar("p12b", 'Depois das fotos, a agência devolve uma amostra para você. A tela fala em "trading": é você, que entra com o login do fornecedor.',
                A + "samples_returned", cursor=False, pausa=0.6),
    ]),
    sua_vez("m6-c1-suavez", C1, "Registrar as amostras do pedido", [
        'Em Pendências, clique no ícone de abrir na linha "Retirada das amostras"',
        "Informe a data da retirada e envie",
        "No envio ao Brasil, digite o rastreio, escolha o comprovante e envie",
        "Faça o mesmo no envio à China",
    ], "Agora é com você: pause o vídeo e registre as amostras de um pedido."),

    # ------------------------------------------- 2 · Validar a devolução da amostra
    capitulo("m6-c2-cartao", C2, 2, 4, "Validar a devolução da amostra", "A amostra da China volta para seguir com a carga",
             "Agora: a devolução da amostra."),
    tela("m6-c2-devolucao", C2, "forn-m6-devolucao", salvar="forn-m6-s2", tarefa="Validar a devolução da amostra", passos=[
        mostrar("p1", 'A agência de marketing fez as fotos e registrou a devolução da amostra. Falta você confirmar que ela chegou de volta.',
                linha("Validar Devolução da amostra")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', abrir_na_linha("Validar Devolução da amostra"),
               resumo='Em Pendências, clique no ícone de abrir na linha da devolução da amostra', **abre("Validar Devolução da amostra", A + "samples_returned")),
        mostrar("p3", 'A linha da devolução mostra "Enviado, aguardando validação". Quem valida é você, a trading.', A + "samples_returned"),
        mostrar("p4", 'Se a amostra não chegou, ou chegou errada, escreva o motivo neste campo e use "Recusar".', A + 'samples_returned input[name="reason"]',
                rotulo="Motivo (obrigatório para recusar)", rotulo_lado="esquerda"),
        clicar("p5", 'Se chegou, use o botão "Validar".', A + 'samples_returned [data-import-validate="samples_returned"]', rotulo="Validar", rotulo_lado="esquerda",
               resumo='Confira a amostra e clique em "Validar"', espera={"url": "importStep=validated", "rede": True}),
        mostrar("p6", 'Validado. Esse passo é importante: o container só pode ser carregado depois que essa amostra volta.', A + "samples_returned", pausa=0.6),
    ]),
    sua_vez("m6-c2-suavez", C2, "Validar a devolução da amostra", [
        'Em Pendências, clique no ícone de abrir na linha da devolução da amostra',
        "Confira se a amostra chegou de volta",
        'Se chegou, clique em "Validar"',
        'Se não chegou, escreva o motivo e clique em "Recusar"',
    ], "Sua vez. Pause o vídeo e valide a devolução de uma amostra."),

    # ----------------------------------------------- 3 · Container vazio na fábrica
    capitulo("m6-c3-cartao", C3, 3, 4, "Container vazio na fábrica", "A chegada do container e as fotos dele vazio",
             "Agora: o container na sua fábrica."),
    tela("m6-c3-vazio", C3, "forn-m6-container", salvar="forn-m6-s3", tarefa="Registrar o container vazio na fábrica", passos=[
        mostrar("p1", 'Com a reserva no navio confirmada, o container vazio vai para a sua fábrica. O portal acompanha cada passo, até ele voltar lacrado ao porto.',
                linha("Container vazio na fábrica")),
        clicar("p2", 'Na linha "Container vazio na fábrica", clique no ícone de abrir, à direita.', abrir_na_linha("Container vazio na fábrica"),
               resumo='Em Pendências, clique no ícone de abrir na linha "Container vazio na fábrica"', **abre("Container vazio na fábrica", K + "container_at_factory")),
        mostrar("p3", 'O cartão "Container na origem" tem cinco passos, em ordem. Cada um só abre depois do anterior.',
                "tbody[data-import-flow]:has(#container-origin-step-container_at_factory)", foco=False),
        data("p4", 'O primeiro passo pede a data em que o container vazio chegou ao depósito da fábrica.', campo(K + "container_at_factory"), 0,
             rotulo="Container vazio no depósito da fábrica (data)", rotulo_lado="esquerda", resumo="Informe a data de chegada do container vazio"),
        clicar("p5", 'E clique em "Enviar".', K + "container_at_factory " + enviar("container_at_factory"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do container vazio', espera=feito(K + "container_at_factory")),
        anexar("p6", 'No segundo passo, registre o container vazio por dentro, antes de carregar. Vale foto, vídeo ou PDF.', arquivo(K + "container_empty"),
               "container-vazio.jpg", rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo="Escolha a foto, o vídeo ou o PDF do container vazio", acao_em="fim"),
        clicar("p7", 'Depois, o botão "Enviar" dessa linha.', K + "container_empty " + enviar("container_empty"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha das fotos', espera=feito(K + "container_empty")),
        mostrar("p8", 'Atenção: este passo guarda um arquivo só. Se você usar "Enviar de novo", o arquivo novo substitui o anterior.', K + "container_empty"),
        mostrar("p9", 'Com o container vazio registrado, o check list de carga fica liberado. Ele faz parte dos documentos do embarque, que você vê no próximo módulo.', "[data-shipping-docs-link]",
                rotulo="Documentos do embarque", rotulo_lado="esquerda", pausa=0.6),
    ]),
    sua_vez("m6-c3-suavez", C3, "Registrar o container vazio", [
        'Em Pendências, clique no ícone de abrir na linha "Container vazio na fábrica"',
        "Informe a data de chegada do container e envie",
        "Escolha a foto, o vídeo ou o PDF do container vazio",
        'Clique em "Enviar"',
    ], "Agora você. Pause o vídeo e registre a chegada de um container."),

    # ---------------------------------------------- 4 · Carregamento, lacre e porto
    capitulo("m6-c4-cartao", C4, 4, 4, "Carregamento, lacre e porto", "Os três últimos passos do container",
             "Por fim: carregamento, lacre e porto."),
    tela("m6-c4-carregamento", C4, "forn-m7-base", tarefa="Registrar o carregamento do container", passos=[
        mostrar("p1", 'Na hora de carregar, aparecem duas pendências: o check list de carga, que você preenche durante o carregamento e aprende no próximo módulo, e o carregamento do container.', "main table tbody", cursor=False),
        clicar("p2", 'Na linha do carregamento, clique no ícone de abrir, à direita.', abrir_na_linha("Carregamento do container"),
               resumo='Em Pendências, clique no ícone de abrir na linha "Carregamento do container"', **abre("Carregamento do container", K + "container_loaded")),
        {**digitar("p3", 'Em seguida, escreva o resumo do carregamento no campo do check de carga: quantas caixas subiram, se houve danos e as observações.', campo(K + "container_loaded"),
                   "200 caixas, sem avarias.", rotulo="Check de carga", rotulo_lado="esquerda", resumo="Escreva o check de carga: caixas, danos e observações", acao_em={"apos": "carregamento:"}), "sim": False},
        anexar("p4", 'Escolha a foto ou o vídeo do carregamento.', arquivo(K + "container_loaded"), "container-carregamento.jpg", rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo="Escolha a foto ou o vídeo do carregamento", acao_em="fim"),
        clicar("p5", 'E clique em "Enviar".', K + "container_loaded " + enviar("container_loaded"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do carregamento', espera=feito(K + "container_loaded")),
        mostrar("p6", 'O passo fica como "Enviado, aguardando validação". Este é o único do container que a Wellmix precisa validar.', K + "container_loaded", pausa=0.6),
    ], cuidados=[
        {"erro": '"Recusado", com o motivo da Wellmix, no passo do carregamento.',
         "solucao": 'Leia o motivo, corrija (por exemplo, refaça a foto) e use "Enviar de novo" na mesma linha.'},
        {"erro": '"Conclua antes o passo anterior."',
         "solucao": "Os passos do container seguem uma ordem fixa. Envie o passo anterior primeiro."},
    ]),
    cuidado("m6-c4-cuidado", C4, "forn-m6-recusado", antes=[
        pre("clicar", abrir_na_linha("Carregamento do container"), {"url": "/app/orders/", "seletor": K + "container_loaded", "rede": True}),
    ], passos=[
        mostrar("p1", 'Agora um cuidado. A Wellmix pode recusar o carregamento. Neste exemplo, ela recusou.', K + "container_loaded", foco=False),
        mostrar("p2", 'A linha mostra "Recusado" e o motivo: a foto está escura.', K + "container_loaded", cursor=False),
        mostrar("p3", 'Refaça a foto, escolha o arquivo novo e use "Enviar de novo", na mesma linha.', K + "container_loaded " + enviar("container_loaded"),
                rotulo="Enviar de novo", rotulo_lado="esquerda", pausa=0.6),
    ]),
    tela("m6-c4-lacre", C4, "forn-m6-lacre", salvar="forn-m6-s4", tarefa="Registrar o lacre e a chegada ao porto", passos=[
        mostrar("p1", 'Com o carregamento validado, falta fechar o container. A pendência agora é a do lacre e do número do container.', linha("Lacre e número do container")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', abrir_na_linha("Lacre e número do container"),
               resumo='Em Pendências, clique no ícone de abrir na linha do lacre', **abre("Lacre e número do container", K + "container_sealed")),
        digitar("p3", 'No passo do lacre, digite o número do container.', campo(K + "container_sealed"), "WMXU4829135", rotulo="Nº do container", rotulo_lado="esquerda",
                resumo="Digite o número do container"),
        anexar("p4", 'Escolha a foto do lacre.', arquivo(K + "container_sealed"), "container-lacre.jpg", rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo="Escolha a foto do lacre", acao_em="fim"),
        clicar("p5", 'E clique em "Enviar".', K + "container_sealed " + enviar("container_sealed"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do lacre', espera=feito(K + "container_sealed")),
        data("p6", 'Por último, a data em que o container lacrado chegou ao porto.', campo(K + "container_at_port"), 0, rotulo="Container lacrado no porto (data)", rotulo_lado="esquerda",
             resumo="Informe a data de chegada ao porto"),
        clicar("p7", 'Depois, o botão "Enviar".', K + "container_at_port " + enviar("container_at_port"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do porto', espera=feito(K + "container_at_port")),
        mostrar("p8", 'Os cinco passos do container estão concluídos. Ficam faltando os documentos do embarque, que são o assunto do próximo módulo.', texto("5 de 5 concluídos"), pausa=0.6),
    ]),
    sua_vez("m6-c4-suavez", C4, "Carregamento, lacre e porto", [
        "No carregamento, escreva o check de carga, escolha a foto e envie",
        "Espere a Wellmix validar o carregamento",
        "No lacre, digite o número do container, escolha a foto e envie",
        "Informe a data de chegada do container ao porto",
    ], "Sua vez. Pause o vídeo e registre o carregamento de um container."),

    encerramento("m6-z9-resumo", "Container lacrado e no porto", "Amostras enviadas, devolução validada e os cinco passos do container.", [
        'Resumindo: você registra a retirada e os envios das amostras, valida a devolução, e depois acompanha o container: vazio, carregado, lacrado e no porto.',
        'Agora responda ao quiz deste módulo. No próximo, os documentos de carga.',
    ]),
]

AM, DV, VZ, CG, CU, LC = "m6-c1-amostras", "m6-c2-devolucao", "m6-c3-vazio", "m6-c4-carregamento", "m6-c4-cuidado", "m6-c4-lacre"
perguntas = [
    cenario("q1", "Para onde vão as amostras", (AM, "p3"),
            'O cartão "Amostras" divide as peças de cada produto em dois destinos. Quais?',
            ['O cliente final e o porto', 'O show room no Brasil e a agência de marketing na China', 'A certificadora e o despachante', 'A fábrica e a transportadora'], 1,
            'A maior parte vai ao show room no Brasil; a outra vai à agência de marketing na China, que faz as fotos e devolve uma amostra.'),
    ordenar("q2", "Ordem dos passos das amostras", (AM, "p4"),
            'Ponha em ordem o que você registra no cartão "Amostras".',
            ['A data da retirada das amostras', 'O envio ao show room no Brasil, com rastreio e comprovante',
             'O envio à agência de marketing na China, com rastreio e comprovante', 'A validação da amostra devolvida pela agência'],
            'Os envios só abrem depois da retirada; a devolução só chega depois que a agência recebe e faz as fotos.'),
    clique("q3", "Registrar a retirada", (AM, "p5"),
           'Você já informou a data da retirada das amostras. Clique no botão que grava esse passo.',
           'Cada passo tem o seu "Enviar", na coluna "Ação" da própria linha.'),
    cenario("q4", "O que o envio pede", (AM, "p7"),
            'No envio das amostras ao Brasil, o que é obrigatório informar?',
            ['Só a data', 'O rastreio e o arquivo do comprovante', 'O número do container', 'A foto do lacre'], 1,
            'Os dois envios pedem o rastreio e o comprovante em arquivo.'),
    cenario("q5", "Amostra que não voltou", (DV, "p4"),
            'A agência registrou a devolução, mas a amostra não chegou à sua fábrica. O que fazer?',
            ['Clicar em "Validar" assim mesmo', 'Escrever o motivo e clicar em "Recusar"', 'Não fazer nada', 'Enviar outra amostra ao Brasil'], 1,
            'Validar confirma que a amostra chegou. Se não chegou, recuse com o motivo: a agência é avisada.'),
    cenario("q6", "Por que validar a devolução", (DV, "p6"),
            'Por que a validação da amostra devolvida é importante para o embarque?',
            ['Porque libera o pagamento', 'Porque o container só pode ser carregado depois que a amostra volta', 'Porque encerra o pedido', 'Porque troca o ETD'], 1,
            'A amostra da China segue junto com a carga. Sem a devolução validada, o carregamento não é aceito.'),
    cenario("q7", "Arquivo do container vazio", (VZ, "p8"),
            'Você já enviou a foto do container vazio e quer mandar também um vídeo pelo "Enviar de novo". O que acontece?',
            ['Os dois arquivos ficam guardados', 'O vídeo substitui a foto: o passo guarda um arquivo só', 'O portal recusa o vídeo', 'O passo volta a pendente'], 1,
            'O passo das fotos do container vazio guarda um único arquivo. "Enviar de novo" troca o anterior.'),
    clique("q8", "Check de carga", (CG, "p3"),
           'Você vai registrar o carregamento. Clique no campo onde escreve o resumo: caixas, avarias e observações.',
           'O campo "Check de carga" fica na linha "Carregamento", junto do arquivo e do botão "Enviar".'),
    cenario("q9", "Carregamento recusado", (CU, "p3"),
            'A linha do carregamento mostra "Recusado: Foto escura". O que fazer?',
            ['Esperar a Wellmix validar', 'Refazer a foto, escolher o arquivo novo e usar "Enviar de novo"', 'Pular para o lacre', 'Abrir outro pedido'], 1,
            'O motivo da recusa aparece na linha. Corrija e reenvie pelo "Enviar de novo"; o lacre só abre com o carregamento validado.'),
    ordenar("q10", "Os cinco passos do container", (VZ, "p3"),
            'Ponha em ordem os passos do cartão "Container na origem".',
            ['Container vazio no depósito da fábrica (data)', 'Fotos e vídeos do container vazio', 'Carregamento: fotos, vídeos e check de carga',
             'Lacre: foto e número do container', 'Container lacrado no porto (data)'],
            'A ordem é fixa e cada passo só abre depois do anterior.'),
    cenario("q11", "Quem valida o quê", (CG, "p6"),
            'Dos passos do container, qual precisa da validação da Wellmix?',
            ['A data do container vazio', 'O carregamento', 'O lacre', 'A chegada ao porto'], 1,
            'Só o carregamento é validado pela Wellmix. Os outros passos ficam concluídos quando você envia.'),
]

MODULO = {"modulo": {"id": 6, "titulo": "Amostras do pedido e container na origem"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
