# Fornecedor · Módulo 5 · Produção e inspeção
# Tarefas T11 (produção e ETD; SKU reprovado) e T10 (inspeção: fotos, peso, vídeo, declaração).
# Dados: pontos forn-m5-base e forn-m5-reprovado.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Produção e ETD"
C2 = "2 · Inspeção"
C3 = "3 · SKU reprovado"

PLANO = "[data-production-plan] "
ABRIR = abrir_na_linha("Pedido #1: Inspeção")
ABRIR_SKU = abrir_na_linha("Corrigir SKU reprovado")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+", "rede": True}
ENVIADO = lambda rotulo: {"some": item(rotulo) + "form:has(input[name=requirementId]):not([data-requirement-clear])", "rede": True}  # noqa: E731
CORRECAO = "Trocamos o molde da tampa e refizemos as peças com rebarba."

cenas = [
    abertura("m5-a0-abertura", "Fornecedor", "Produção e inspeção", 5, [
        'Sinal confirmado, a produção começa. Aqui você aprende a manter a data de saída da carga em dia e a registrar a inspeção do produto pronto.',
        'E vê o que fazer quando a Wellmix reprova um item.',
    ]),

    # ---------------------------------------------------------- 1 · Produção e ETD
    capitulo("m5-c1-cartao", C1, 1, 3, "Produção e ETD", "A data prevista de saída da carga",
             "Para começar: a produção e a data de saída."),
    tela("m5-c1-producao", C1, "forn-m5-base", salvar="forn-m5-s1", tarefa="Informar a produção e o ETD", passos=[
        mostrar("p1", 'Com o sinal aprovado pela Wellmix, chega a pendência do pedido: "Inspeção". Antes dela, você informa a produção e a data de saída.', linha("Pedido #1: Inspeção")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR, alvo_visual=linha("Pedido #1: Inspeção"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Inspeção"', espera=NO_PEDIDO),
        mostrar("p3", 'Esta é a tela do pedido. Em "Marcos do pedido", cada etapa em que você atua aparece numa faixa. A pré-produção já está concluída, com o sinal verde, e a inspeção está em andamento.',
                "#order-stages", foco=False),
        mostrar("p3b", 'Mais abaixo, a linha "Ficha de compra" aparece em andamento, mas ela não gera pendência para você.',
                '[data-order-part="sheet"]'),
        mostrar("p4", 'Mais abaixo fica o cartão "Produção". É nele que você informa a data prevista de saída da carga, o ETD.', PLANO.strip(), foco=False),
        escolher("p5", 'Em "Fornecedor é", diga se você é a fábrica ou uma revenda. Sendo revenda, informe também a fábrica e o endereço dela, porque a inspeção acontece lá.',
                 PLANO + 'select[name="mode"]', "Fábrica", rotulo="Fornecedor é", rotulo_lado="acima", resumo='Em "Fornecedor é", escolha "Fábrica" ou "Trade (revenda)"',
                 acao_em={"apos": "revenda."}),
        mostrar("p6", 'O início da produção entra sozinho: é o dia do contrato assinado.', PLANO + 'input[name="productionStartAt"]',
                rotulo="Início da produção", rotulo_lado="acima"),
        data("p7", 'No campo do ETD, informe a saída prevista.', PLANO + "[data-production-etd]", 35, rotulo="ETD (saída prevista)", rotulo_lado="acima",
             resumo="Informe o ETD, a saída prevista da carga"),
        clicar("p8", 'E clique em "Salvar produção".', PLANO + "[data-production-save]", rotulo="Salvar produção", rotulo_lado="acima",
               resumo='Clique em "Salvar produção"', espera={"url": "production=saved", "rede": True}),
        mostrar("p9", 'Produção salva. Mantenha essa data em dia: se o ETD mudar, volte aqui, corrija a data e escreva o motivo. A Wellmix é avisada a cada mudança.',
                PLANO + "[data-production-etd]", rotulo="ETD (saída prevista)", rotulo_lado="acima", pausa=0.6),
    ], cuidados=[
        {"erro": '"Informe o motivo da mudança do ETD."',
         "solucao": 'Depois do primeiro ETD, toda mudança de data pede o motivo. Preencha "Motivo da mudança do ETD" e salve de novo.'},
    ]),
    cuidado("m5-c1-cuidado", C1, "forn-m5-s1", antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'Agora um cuidado. Depois do primeiro ETD, toda mudança de data pede o motivo.', PLANO.strip(), foco=False),
        data("p2", 'Veja: mudo o ETD para cinco dias depois.', PLANO + "[data-production-etd]", 40, rotulo="ETD (saída prevista)", rotulo_lado="acima"),
        clicar("p3", 'E salvo sem escrever o motivo.', PLANO + "[data-production-save]", espera={"url": "error=", "rede": True}),
        mostrar("p4", 'O portal pede o motivo da mudança do ETD, e nada é gravado.', texto("Informe o motivo da mudança do ETD")),
        mostrar("p5", 'O motivo vai neste campo, na mesma linha do ETD. Repare que a data voltou para a anterior: informe a nova data de novo, escreva o motivo e salve.', PLANO + 'input[name="etdReason"]',
                rotulo="Motivo da mudança do ETD", rotulo_lado="abaixo", pausa=0.6),
    ]),
    sua_vez("m5-c1-suavez", C1, "Informar o ETD", [
        'Em Pendências, clique no ícone de abrir na linha "Inspeção"',
        'Desça até o cartão "Produção"',
        'Escolha "Fábrica" ou "Trade" e informe o ETD',
        'Clique em "Salvar produção"',
    ], "Agora é com você: pause o vídeo e informe o ETD de um pedido."),

    # ------------------------------------------------------------------ 2 · Inspeção
    capitulo("m5-c2-cartao", C2, 2, 3, "Inspeção", "Fotos, peso, vídeo e a declaração de conformidade",
             "Agora: a inspeção do produto pronto."),
    tela("m5-c2-inspecao", C2, "forn-m5-s1", salvar="forn-m5-s2", tarefa="Registrar a inspeção do produto", antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'Com o produto pronto, você registra a inspeção. No pedido, a etapa "Inspeção" lista os itens, um por linha.',
                item("Foto sem embalagem").strip(), foco=False),
        mostrar("p2", 'Este aviso explica a inspeção cega: você informa exatamente o que encontrou, sem ver os valores esperados. A comparação fica com a Wellmix, que avisa se houver diferença.',
                texto("Inspeção cega")),
        anexar("p3", 'Comece pelo item "Foto sem embalagem": use "Tirar ou escolher foto".', item("Foto sem embalagem") + "input[type=file]", "inspecao-sem-embalagem.jpg",
               alvo_visual=item("Foto sem embalagem") + "[data-photo-button]", rotulo="Tirar ou escolher foto", rotulo_lado="esquerda",
               resumo='Em "Foto sem embalagem", escolha a foto', acao_em="fim", espera=ENVIADO("Foto sem embalagem")),
        anexar("p4", 'Depois, a foto com embalagem.', item("Foto com embalagem") + "input[type=file]", "inspecao-com-embalagem.jpg",
               alvo_visual=item("Foto com embalagem") + "[data-photo-button]", rotulo="Tirar ou escolher foto", rotulo_lado="esquerda",
               resumo='Em "Foto com embalagem", escolha a foto', acao_em="fim", espera=ENVIADO("Foto com embalagem")),
        anexar("p5", 'E a foto na balança, com o peso aparecendo.', item("Foto na balança") + "input[type=file]", "inspecao-na-balanca.jpg",
               alvo_visual=item("Foto na balança") + "[data-photo-button]", rotulo="Tirar ou escolher foto", rotulo_lado="esquerda",
               resumo='Em "Foto na balança", escolha a foto', acao_em="fim", espera=ENVIADO("Foto na balança")),
        digitar("p6", 'Em "Peso medido", digite o peso de uma peça, em quilos, como a balança mostrou.', item("Peso medido (kg)") + 'input[name="value"]', "0.62",
                rotulo="Peso medido (kg)", rotulo_lado="esquerda", resumo='Em "Peso medido (kg)", digite o peso', acao_em={"apos": "peça,"}),
        clicar("p7", 'E clique em "Enviar", na mesma linha.', item("Peso medido (kg)") + "button[type=submit]", rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha do peso', espera=ENVIADO("Peso medido (kg)")),
        mostrar("p8", 'Os itens marcados como opcionais, como o peso bruto, as medidas, os dados da caixa, o material e a cor, você só preenche quando a Wellmix pedir.',
                item("Peso bruto medido (kg)").strip()),
        anexar("p9", 'Em "Vídeo da produção", use "Escolher arquivo" para mandar o vídeo.', item("Vídeo da produção") + 'input[aria-label="Escolher arquivo"]',
               "producao-video.mp4", alvo_visual=item("Vídeo da produção") + "[data-file-button]", rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo='Em "Vídeo da produção", escolha o vídeo', acao_em="fim", espera=ENVIADO("Vídeo da produção")),
        clicar("p10", 'Por último, a declaração de que o produto está conforme o pedido. O botão "Confirmar" só aparece depois das fotos, do peso e do vídeo. Quando aparecer, é só confirmar.',
               item("Produto conforme o pedido (declaração do fornecedor)") + "button[type=submit]", rotulo="Confirmar", rotulo_lado="esquerda",
               resumo='Na declaração de conformidade, clique em "Confirmar"', destaque_em={"em": "botão"},
               espera=ENVIADO("Produto conforme o pedido (declaração do fornecedor)")),
        mostrar("p11", 'Declaração feita. A partir daqui, a Wellmix inspeciona cada item do pedido e aprova ou reprova.',
                item("Inspeção aprovada pela Wellmix (todos os SKUs)").strip(), pausa=0.6),
    ], cuidados=[
        {"erro": "Enviei um valor errado na inspeção (peso ou medida).",
         "solucao": 'A inspeção é cega: o portal aceita o que você digitar. Use "Nova medição" para abrir o campo de novo e envie o valor certo.'},
    ]),
    cuidado("m5-c2-cuidado", C2, "forn-m5-s1", antes=[pre("clicar", ABRIR, NO_PEDIDO)], passos=[
        mostrar("p1", 'Agora um cuidado com os números. Voltei à hora de digitar o peso. Na inspeção cega, o portal aceita o valor que você digitar. Ele não avisa se o número está fora do esperado.',
                item("Peso medido (kg)").strip(), foco=False),
        digitar("p2", 'Veja o que acontece com um peso dez vezes maior, digitado por engano.', item("Peso medido (kg)") + 'input[name="value"]', "6.2",
                rotulo="Peso medido (kg)", rotulo_lado="esquerda"),
        clicar("p3", 'Depois, o botão de enviar.', item("Peso medido (kg)") + "button[type=submit]", espera=ENVIADO("Peso medido (kg)")),
        mostrar("p4", 'O item fica concluído, com o valor errado.', item("Peso medido (kg)").strip()),
        clicar("p5", 'Para corrigir, use "Nova medição".', sel("main a", "Nova medição"), rotulo="Nova medição", rotulo_lado="acima",
               espera={"url": "remeasure=1", "rede": True}),
        mostrar("p6", 'O campo abre de novo. Digite o peso certo e envie. Confira sempre o número antes de enviar.',
                item("Peso medido (kg)") + 'input[name="value"]', rotulo="Peso medido (kg)", rotulo_lado="esquerda", pausa=0.6),
    ]),
    sua_vez("m5-c2-suavez", C2, "Registrar a inspeção", [
        'No pedido, vá até a etapa "Inspeção"',
        "Envie as três fotos: sem embalagem, com embalagem e na balança",
        'Digite o peso medido, clique em "Enviar" e mande o vídeo da produção',
        'Clique em "Confirmar" na declaração de conformidade',
    ], "Sua vez. Pause o vídeo e registre a inspeção de um pedido."),

    # ------------------------------------------------------------- 3 · SKU reprovado
    capitulo("m5-c3-cartao", C3, 3, 3, "SKU reprovado", "Corrigir, avisar e enviar a inspeção de novo",
             "Por fim: quando um item é reprovado."),
    tela("m5-c3-reprovado", C3, "forn-m5-reprovado", tarefa="Corrigir um SKU reprovado", passos=[
        mostrar("p1", 'A Wellmix inspeciona cada item do pedido, que o portal chama de SKU. Se ela reprova um, chega a pendência "Corrigir SKU reprovado", já com o motivo.',
                linha("Corrigir SKU reprovado")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_SKU, alvo_visual=linha("Corrigir SKU reprovado"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Corrigir SKU reprovado"', espera=NO_PEDIDO),
        mostrar("p3", 'Você cai no cartão "Produção". Em "Inspeção por SKU", o resultado aparece como "Reprovado", com a observação da Wellmix.',
                "[data-sku-item]"),
        {**digitar("p4", 'Primeiro, resolva o problema na fábrica. Depois, no campo "O que foi corrigido", descreva o que foi feito.',
                   '[data-sku-item] textarea[name="action"]', CORRECAO, rotulo="O que foi corrigido", rotulo_lado="acima", resumo='Em "O que foi corrigido", descreva o que foi feito', acao_em={"apos": "fábrica."}, pausa=0.4), "sim": False},
        clicar("p5", 'E clique em "Enviar correção".', "[data-sku-respond]", rotulo="Enviar correção", rotulo_lado="acima", resumo='Clique em "Enviar correção"',
               espera={"url": "production=", "rede": True}),
        mostrar("p6", 'Correção enviada. A Wellmix vai inspecionar de novo.', "[data-sku-item]"),
        mostrar("p7", 'Atenção: quando um item é reprovado, as fotos, o peso, o vídeo e a declaração voltam a ficar pendentes. Envie tudo de novo, agora com o produto corrigido.',
                item("Foto sem embalagem").strip()),
        mostrar("p8", 'Agora, o ETD: a cada reprovação, o portal adia a data em um dia. A tela mostra o primeiro ETD, para comparar.', texto("Primeiro ETD"), pausa=0.6),
    ]),
    sua_vez("m5-c3-suavez", C3, "Corrigir um SKU reprovado", [
        'Em Pendências, clique no ícone de abrir na linha "Corrigir SKU reprovado"',
        'Leia a observação em "Inspeção por SKU"',
        'Descreva a correção em "O que foi corrigido" e clique em "Enviar correção"',
        "Envie de novo as fotos, o peso, o vídeo e a declaração",
    ], "Agora você. Pause o vídeo e veja como corrigir um item reprovado."),

    encerramento("m5-z9-resumo", "Produção acompanhada", "ETD em dia, inspeção registrada e correção quando precisar.", [
        'Resumindo: você mantém o ETD atualizado, registra a inspeção com fotos, peso, vídeo e declaração, e, se algo for reprovado, envia a correção.',
        'Agora responda ao quiz deste módulo. No próximo, as amostras do pedido e o container.',
    ]),
]

P, CUP, I, CUI, R = "m5-c1-producao", "m5-c1-cuidado", "m5-c2-inspecao", "m5-c2-cuidado", "m5-c3-reprovado"
perguntas = [
    cenario("q1", "O que é o ETD", (P, "p4"),
            'No cartão "Produção", o que você informa no campo ETD?',
            ['A data em que o contrato foi assinado', 'A data prevista de saída da carga', 'A data do pagamento do sinal', 'A data da inspeção da Wellmix'], 1,
            'ETD é a saída prevista da carga. A Wellmix acompanha a produção por essa data.'),
    clique("q2", "Onde fica o ETD", (P, "p7"),
           'A produção vai atrasar e você precisa mudar a saída prevista. Clique no campo certo.',
           'O campo "ETD (saída prevista)" fica no cartão "Produção", na tela do pedido.'),
    cenario("q3", "Mudar o ETD", (CUP, "p4"),
            'Você mudou o ETD, clicou em "Salvar produção" e o portal respondeu: "Informe o motivo da mudança do ETD." O que fazer?',
            ['Voltar a data antiga', 'Informar a data de novo, escrever o motivo no campo "Motivo da mudança do ETD" e salvar', 'Mandar o motivo só por mensagem', 'Esperar a Wellmix mudar a data'], 1,
            'Depois do primeiro ETD, toda mudança pede o motivo. Sem ele, nada é gravado, e a data volta para a anterior: informe de novo, escreva o motivo e salve.'),
    cenario("q4", "Fábrica ou revenda", (P, "p5"),
            'A sua empresa revende e o produto é feito em outra fábrica. O que muda no cartão "Produção"?',
            ['Nada', 'Você escolhe "Trade (revenda)" e informa a fábrica e o endereço dela', 'Você não preenche o ETD', 'A inspeção deixa de existir'], 1,
            'A Wellmix inspeciona onde o produto é feito. Sendo revenda, a fábrica e o endereço precisam estar no cartão.'),
    cenario("q5", "Inspeção cega", (I, "p2"),
            'A tela avisa que a inspeção é cega. O que isso quer dizer?',
            ['Que você não precisa enviar fotos', 'Que você informa o que encontrou sem ver os valores esperados; a Wellmix compara', 'Que a Wellmix não vê o que você envia', 'Que o peso é opcional'], 1,
            'Você informa exatamente o que mediu. Os valores esperados não aparecem, e a comparação é feita pela Wellmix.'),
    ordenar("q6", "Ordem da inspeção", (I, "p3"),
            'Ponha em ordem o registro da inspeção.',
            ['Enviar as fotos sem embalagem, com embalagem e na balança', 'Digitar o peso medido e clicar em "Enviar"',
             'Enviar o vídeo da produção', 'Clicar em "Confirmar" na declaração de conformidade'],
            'A declaração vem por último: o botão "Confirmar" só aparece depois das fotos, do peso e do vídeo.'),
    clique("q7", "Enviar o peso medido", (I, "p7"),
           'Você digitou o peso medido. Clique no botão que envia esse valor.',
           'Cada item de valor tem o seu próprio "Enviar", na mesma linha.'),
    cenario("q8", "Valor errado na inspeção", (CUI, "p5"),
            'Você enviou o peso e percebeu que digitou 6,2 em vez de 0,62. O item aparece como concluído. O que fazer?',
            ['Nada: o portal corrige sozinho', 'Usar "Nova medição" para abrir o campo de novo e enviar o valor certo', 'Esperar a Wellmix reprovar', 'Apagar o pedido'], 1,
            'A inspeção é cega: o portal aceita o valor digitado. "Nova medição" reabre o campo para você enviar o número certo.'),
    cenario("q9", "Itens opcionais", (I, "p8"),
            'Na lista da inspeção há itens marcados "(opcional)", como as medidas e a cor. O que fazer com eles?',
            ['Preencher todos antes da declaração', 'Preencher só quando a Wellmix pedir', 'Apagar da lista', 'Enviar por mensagem'], 1,
            'Os obrigatórios são as três fotos, o peso medido, o vídeo e a declaração. Os opcionais entram quando a Wellmix pede.'),
    cenario("q10", "Depois de corrigir o SKU", (R, "p7"),
            'A Wellmix reprovou um SKU. Você corrigiu e clicou em "Enviar correção". O que mais precisa fazer?',
            ['Nada: a correção basta', 'Enviar de novo as fotos, o peso, o vídeo e a declaração, com o produto corrigido', 'Assinar o contrato outra vez', 'Abrir uma nova solicitação'], 1,
            'Depois de uma reprovação, os itens da inspeção voltam a pendentes e precisam ser reenviados.'),
    clique("q11", "Onde descrever a correção", (R, "p4"),
           'O SKU foi reprovado por rebarba na tampa e você já corrigiu na fábrica. Clique no campo onde descreve a correção.',
           'Em "Inspeção por SKU", o campo "O que foi corrigido" fica na linha do item reprovado, ao lado de "Enviar correção".'),
]

MODULO = {"modulo": {"id": 5, "titulo": "Produção e inspeção"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
