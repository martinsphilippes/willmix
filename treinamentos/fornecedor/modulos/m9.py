# Fornecedor · Módulo 9 · Casos especiais: compra EXW e compra programada
# Tarefas T18 (EXW: transporte e custos na origem) e T20 (compra programada: pedido pai e filhos).
# Dados: `_demo/caminho-fornecedor-extras.mjs` (pontos forn-exw-solicitacao, forn-exw-base,
# forn-prog-solicitacao e forn-prog-filhos). Cada fluxo parte de um banco próprio: nestes
# pontos o pedido #1 é o copo (EXW) ou a tigela (programada), não o pote dos outros módulos.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Compra EXW"
C2 = "2 · Compra programada: a solicitação"
C3 = "3 · Pedido pai e pedidos filhos"

FORM = "form:has([data-supplier-answer-submit]) "
K = "#container-origin-step-"
ABRIR_1 = abrir_na_linha("Solicitação nº 1")
VAI_PRODUTO = {"url": "view=item", "rede": True}
NA_SOLICITACAO = {"url": "/app/supplier-requests/", "rede": True}


def enviar(chave: str) -> str:
    return f'{K}{chave} [data-import-submit="{chave}"]'


def feito(chave: str) -> dict:
    return {"seletor": f'{K}{chave}[data-import-status="submitted"]', "rede": True}


cenas = [
    abertura("m9-a0-abertura", "Fornecedor", "EXW e compra programada", 9, [
        'Você já conhece o caminho do pedido. Este último módulo mostra dois casos que mudam esse caminho: a compra EXW e a compra programada.',
        'Se a sua empresa não trabalha com eles hoje, vale conhecer: as telas são as mesmas, com alguns passos a mais.',
    ]),

    # ------------------------------------------------------------- 1 · Compra EXW
    capitulo("m9-c1-cartao", C1, 1, 3, "Compra EXW", "A modalidade na resposta e o transporte na origem",
             "Primeiro: a modalidade EXW."),
    tela("m9-c1-modalidade", C1, "forn-exw-solicitacao", tarefa="Responder a uma solicitação na modalidade EXW", passos=[
        mostrar("p1", 'O exemplo aqui é outro pedido, de um copo. Na modalidade EXW, o transporte da fábrica até o porto fica fora do seu preço. Ela é combinada logo na resposta da solicitação.',
                linha("Solicitação nº 1")),
        clicar("p2", 'Na linha da solicitação, clique em "Abrir".', ABRIR_1, alvo_visual=linha("Solicitação nº 1"), 
               resumo='Em Pendências, clique em "Abrir" na linha da solicitação', espera=NA_SOLICITACAO),
        clicar("p3", 'Para responder com todos os dados, use o ícone "Abrir produto".', "[data-supplier-table-open]", rotulo="Abrir produto",
               rotulo_lado="acima", resumo='Clique no ícone "Abrir produto"', espera=VAI_PRODUTO, zoom=1.4),
        escolher("p4", 'Na pergunta "Faz o que foi pedido?", a resposta é "Sim, faço".', "[data-supplier-answer-cando]", "Sim, faço", rotulo="Faz o que foi pedido?",
                 rotulo_lado="esquerda", resumo='Em "Faz o que foi pedido?", escolha "Sim, faço"'),
        digitar("p5", 'Digite o preço por peça, sem o transporte até o porto.', "[data-supplier-answer-price]", "1,18", rotulo="Preço por peça",
                rotulo_lado="esquerda", resumo="Digite o preço por peça, sem o transporte até o porto"),
        {**digitar("p6", 'Depois, o pedido mínimo.', FORM + 'input[name="moq"]', "1000", rotulo="Pedido mínimo (peças)", rotulo_lado="esquerda", resumo="Digite o pedido mínimo, em peças"), "sim": False},
        {**digitar("p7", 'E o prazo de produção, em dias.', FORM + 'input[name="leadTimeDays"]', "30", rotulo="Prazo de produção (dias)", rotulo_lado="abaixo", resumo="Digite o prazo de produção, em dias"), "sim": False},
        escolher("p8", 'Agora, o campo que muda: em "Modalidade de entrega", escolha "EXW".', "[data-supplier-answer-incoterm]", "EXW",
                 rotulo="Modalidade de entrega", rotulo_lado="esquerda", resumo='Em "Modalidade de entrega", escolha "EXW"'),
        clicar("p9", 'Confira tudo e clique em "Enviar resposta".', "[data-supplier-answer-submit]", rotulo="Enviar resposta", rotulo_lado="direita",
               resumo='Clique em "Enviar resposta"', espera={"url": "answered=1", "rede": True}),
        mostrar("p10", 'A resposta foi registrada com a modalidade EXW. Até a reserva no navio, o caminho é o mesmo que você já viu.',
                texto("Resposta registrada."), pausa=0.6),
    ]),
    tela("m9-c1-origem", C1, "forn-exw-base", salvar="forn-m9-s1", tarefa="Registrar o transporte na origem (EXW)", passos=[
        mostrar("p1", 'Depois da reserva no navio, a compra EXW traz uma pendência que a outra modalidade não tem: a transportadora na origem.',
                linha("Transportadora na origem (EXW)")),
        clicar("p2", 'Na linha dela, clique em "Abrir".', abrir_na_linha("Transportadora na origem (EXW)"), alvo_visual=linha("Transportadora na origem (EXW)"),
               resumo='Em Pendências, clique em "Abrir" na linha "Transportadora na origem (EXW)"',
               espera={"url": "/app/orders/", "seletor": K + "origin_carrier", "rede": True}),
        mostrar("p3", 'No cartão "Container na origem", a compra EXW tem oito passos. Os três primeiros são do transporte da fábrica até o porto.',
                "tbody[data-import-flow]:has(#container-origin-step-origin_carrier)", foco=False),
        digitar("p4", 'No primeiro, escreva o nome da transportadora contratada. É a empresa que leva o container da fábrica até o porto.', K + 'origin_carrier input[name="value"]', "Shenzhen Port Trucking",
                rotulo="Nome da transportadora", rotulo_lado="esquerda", resumo="Escreva o nome da transportadora", acao_em={"apos": "contratada."}),
        clicar("p5", 'E clique em "Enviar".', enviar("origin_carrier"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha da transportadora', espera=feito("origin_carrier")),
        data("p6", 'No segundo, informe a data prevista para o container vazio chegar à fábrica.', K + 'origin_carrier_eta input[name="value"]', 2,
             rotulo="Previsão do container (data)", rotulo_lado="esquerda", resumo="Informe a previsão de chegada do container"),
        clicar("p7", 'Depois, o botão "Enviar" dessa linha.', enviar("origin_carrier_eta"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha da previsão', espera=feito("origin_carrier_eta")),
        mostrar("p8", 'No terceiro, vão os custos desse transporte. Antes de digitar, confira a moeda, logo abaixo do valor. O texto de fundo do valor fala em reais, mas vale a moeda escolhida aqui.',
                K + 'origin_costs select[name="currency"]', rotulo="Moeda", rotulo_lado="abaixo"),
        digitar("p9", 'Agora, digite o valor.', K + 'origin_costs input[name="amount"]', "380",
                rotulo="Valor", rotulo_lado="esquerda", resumo="Confira a moeda e digite o valor do transporte na origem"),
        anexar("p10", 'Escolha o comprovante: o recibo da transportadora.', K + "origin_costs input[type=file]", "recibo-transporte-na-origem.pdf",
               rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo="Escolha o comprovante do transporte", acao_em="fim"),
        clicar("p11", 'E clique em "Enviar".', enviar("origin_costs"), rotulo="Enviar", rotulo_lado="esquerda",
               resumo='Clique em "Enviar" na linha dos custos', espera=feito("origin_costs")),
        mostrar("p12", 'Os custos ficam como "Enviado, aguardando validação". Quem valida é a Wellmix. Só depois disso abre o passo do container vazio, e o caminho segue como você já viu.',
                K + "origin_costs", pausa=0.6),
    ], cuidados=[
        {"erro": "O passo do container vazio não abre depois dos custos enviados.",
         "solucao": "Os custos do transporte na origem esperam a validação da Wellmix. O container vazio só abre depois dela."},
    ]),
    sua_vez("m9-c1-suavez", C1, "Compra EXW", [
        'Na resposta da solicitação, escolha "EXW" em "Modalidade de entrega"',
        "Depois da reserva no navio, informe a transportadora e a previsão do container",
        "Informe o valor do transporte, confira a moeda e escolha o comprovante",
        "Espere a Wellmix validar os custos",
    ], "Agora é com você: pause o vídeo e registre o transporte na origem de um pedido na modalidade EXW."),

    # --------------------------------------- 2 · Compra programada: a solicitação
    capitulo("m9-c2-cartao", C2, 2, 3, "Compra programada", "Uma negociação, várias programações",
             "Agora: a compra programada."),
    tela("m9-c2-solicitacao", C2, "forn-prog-solicitacao", tarefa="Ler a programação de compra na solicitação", passos=[
        mostrar("p1", 'Agora, outro exemplo, com outro produto: uma tigela. Na compra programada, a Wellmix divide a quantidade em várias programações, cada uma com a sua data. Você vê isso desde a solicitação.',
                linha("Solicitação nº 1")),
        clicar("p2", 'Na linha da solicitação, clique em "Abrir".', ABRIR_1, alvo_visual=linha("Solicitação nº 1"), 
               resumo='Em Pendências, clique em "Abrir" na linha da solicitação', espera=NA_SOLICITACAO),
        mostrar("p3", 'A tabela é larga. Do lado direito, a coluna "Programações" mostra quantas são. Aqui, duas.', "[data-supplier-table-rounds]", zoom=1.3),
        mostrar("p3b", 'E a coluna "Peças por programação" mostra as peças de cada uma: 1.800 e 1.800.', "[data-supplier-table-per-round]", zoom=1.3),
        clicar("p4", 'Para ver as datas, use o ícone "Abrir produto".', "[data-supplier-table-open]", rotulo="Abrir produto", rotulo_lado="acima",
               resumo='Clique no ícone "Abrir produto"', espera=VAI_PRODUTO, zoom=1.4),
        mostrar("p5", 'O quadro "Programação de compra" mostra cada programação: a data do pedido e as peças.', "[data-purchase-schedule]"),
        mostrar("p6", 'A sua resposta é uma só e vale para o total: o preço, o pedido mínimo e o prazo são os mesmos em todas as programações.',
                "[data-supplier-answer-form]", foco=False, pausa=0.6),
    ]),
    sua_vez("m9-c2-suavez", C2, "Ler a programação na solicitação", [
        'Em Pendências, clique em "Abrir" na linha da solicitação',
        'Na tabela, veja "Programações" e "Peças por programação"',
        'Abra o produto e leia o quadro "Programação de compra"',
        "Responda uma vez só, para o total",
    ], "Sua vez. Pause o vídeo e leia a programação de compra de uma solicitação."),

    # ------------------------------------------- 3 · Pedido pai e pedidos filhos
    capitulo("m9-c3-cartao", C3, 3, 3, "Pedido pai e pedidos filhos", "O Die Cut uma vez só; um contrato por programação",
             "Por fim: o pedido pai e os pedidos filhos."),
    tela("m9-c3-pai", C3, "forn-prog-filhos", tarefa="Acompanhar o pedido pai e os pedidos filhos", passos=[
        mostrar("p1", 'Fechada a negociação, o pedido de compra nasce como pedido pai. Nele, o Die Cut é feito uma vez só. Na data combinada, cada programação vira um pedido filho.',
                "main table tbody", foco=False),
        mostrar("p2", 'O pedido filho chega com as pendências que você já conhece. Aqui, as duas são do pedido número 2. A primeira aparece como "Aprovar a arte": é nela que você aceita o pedido de amostras. A segunda é a assinatura do contrato.',
                "main table tbody", cursor=False),
        clicar("p3", 'Use o botão "Abrir" da primeira linha.', abrir_na_linha("Pedido #2: Aprovar a arte"), alvo_visual=linha("Pedido #2: Aprovar a arte"),
               resumo='Em Pendências, clique em "Abrir" numa linha do pedido filho',
               espera={"url": "/app/orders/[^/?#]+$", "seletor": "[data-order-round-of]", "rede": True}),
        mostrar("p4", 'No alto do pedido filho, a faixa mostra de onde ele vem: a primeira de duas programações do pedido pai.', "[data-order-round-of]"),
        clicar("p5", 'Para ver o pai, use o link "Abrir o pedido pai".', "[data-order-round-of] a", rotulo="Abrir o pedido pai #1", rotulo_lado="abaixo",
               resumo='Na faixa do alto, clique em "Abrir o pedido pai"', espera={"seletor": "[data-order-rounds]", "rede": True}),
        mostrar("p6", 'No pedido pai, o cartão "Programação de compra" lista as programações. A primeira já virou o pedido número 2. A segunda mostra a data em que vai nascer.',
                "[data-order-rounds]"),
        mostrar("p7", 'O pedido pai guarda o total, a negociação e as artes. O contrato, o sinal, a produção e o embarque acontecem em cada pedido filho, um por programação.',
                "[data-order-rounds]", pausa=0.6),
    ]),
    sua_vez("m9-c3-suavez", C3, "Pedido pai e pedidos filhos", [
        'Em Pendências, clique em "Abrir" numa linha do pedido filho',
        "Veja na faixa do alto de qual programação ele é",
        'Clique em "Abrir o pedido pai"',
        'Leia o cartão "Programação de compra"',
    ], "Agora você. Pause o vídeo e abra o pedido pai a partir de um pedido filho."),

    encerramento("m9-z9-resumo", "Trilha do fornecedor concluída", "Do book ao embarque, tudo pelo portal.", [
        'Resumindo: na compra EXW, você informa a transportadora, a previsão do container e os custos do transporte na origem. Na compra programada, o pedido pai guarda o total, e cada programação vira um pedido filho.',
        'Com isso, a trilha do fornecedor está completa. Responda ao quiz deste módulo e, depois, ao quiz final.',
    ]),
]

MO, OR, SO, PA = "m9-c1-modalidade", "m9-c1-origem", "m9-c2-solicitacao", "m9-c3-pai"
perguntas = [
    cenario("q1", "O que muda no preço EXW", (MO, "p1"),
            'Na compra EXW, o que o seu preço por peça NÃO inclui?',
            ['A embalagem do produto', 'O transporte da fábrica até o porto', 'A amostra em impressora 3D', 'A caixa com a marca'], 1,
            'Na modalidade EXW, o transporte da fábrica até o porto fica fora do preço e é registrado à parte, com o custo.'),
    clique("q2", "Onde se informa a modalidade", (MO, "p8"),
           'Você vai responder a uma solicitação, e a entrega combinada é EXW. Clique no campo que informa isso.',
           'A modalidade vai no campo "Modalidade de entrega", na resposta do fornecedor.'),
    ordenar("q3", "Passos do container na compra EXW", (OR, "p3"),
            'Na compra EXW, o cartão "Container na origem" começa com passos a mais. Ponha na ordem.',
            ['Transportadora contratada na origem', 'Previsão do container na fábrica', 'Custos do transporte na origem, com comprovante', 'Container vazio na fábrica'],
            'Primeiro a transportadora, depois a previsão, depois os custos. O container vazio só vem depois dos custos validados.'),
    cenario("q4", "Custos enviados, container travado", (OR, "p12"),
            'Você enviou os custos do transporte na origem, mas o passo do container vazio não abriu. Por quê?',
            ['O comprovante não é aceito em PDF', 'A Wellmix ainda precisa validar os custos', 'Falta assinar o contrato de novo', 'O pedido voltou para a inspeção'], 1,
            'Os custos ficam como "Enviado, aguardando validação". O container vazio só abre depois que a Wellmix valida.'),
    clique("q5", "Valor do transporte", (OR, "p9"),
           'Você recebeu o recibo da transportadora. Clique no campo onde vai o valor do transporte.',
           'O valor vai no passo dos custos do transporte na origem, junto com a moeda e o comprovante.'),
    cenario("q6", "Uma resposta para o total", (SO, "p6"),
            'A solicitação mostra duas programações de 1.800 peças. Quantas respostas você envia?',
            ['Duas: uma por programação', 'Uma só, que vale para o total', 'Nenhuma: a Wellmix responde', 'Uma por caixa'], 1,
            'A resposta é uma só. O preço, o pedido mínimo e o prazo valem para todas as programações.'),
    cenario("q7", "Onde ver as datas das programações", (SO, "p5"),
            'Você quer saber em que data cada programação vai virar pedido. Onde olhar, na solicitação?',
            ['No sino de avisos', 'No quadro "Programação de compra", na tela do produto', 'Na Conta corrente', 'No Die Cut'], 1,
            'O quadro "Programação de compra" mostra cada programação, com a data do pedido e as peças.'),
    cenario("q8", "Die Cut na compra programada", (PA, "p1"),
            'Numa compra com três programações, quantas vezes você faz o Die Cut?',
            ['Três: uma em cada pedido filho', 'Uma só, no pedido pai', 'Nenhuma', 'Uma por caixa'], 1,
            'O Die Cut é feito uma vez só, no pedido pai. Os filhos já nascem com ele feito.'),
    cenario("q9", "O que acontece em cada filho", (PA, "p7"),
            'O pedido número 2 nasceu da primeira programação. O que acontece nele?',
            ['Nada: tudo fica no pedido pai', 'O contrato, o sinal, a produção e o embarque dessa programação', 'Só a negociação do preço', 'Só o Die Cut'], 1,
            'O pedido pai guarda o total, a negociação e as artes. Contrato, sinal, produção e embarque acontecem em cada pedido filho.'),
    clique("q10", "Voltar ao pedido pai", (PA, "p5"),
           'Você está num pedido filho e quer ver todas as programações. Clique no lugar certo.',
           'O link "Abrir o pedido pai", na faixa do alto, leva ao cartão "Programação de compra".'),
]

MODULO = {"modulo": {"id": 9, "titulo": "Casos especiais: EXW e compra programada"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
