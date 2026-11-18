# Fornecedor · Módulo 7 · Documentos de carga
# Tarefa T14 do levantamento: check list de carga, packing list e invoice, conferidos linha a
# linha pelo portal. Dados: ponto forn-m7-base (container vazio já registrado).
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Check list de carga"
C2 = "2 · Packing list"
C3 = "3 · Invoice"

DOC = lambda tipo: f"[data-shipping-doc={tipo}]"  # noqa: E731
CAIXAS = 'form[data-shipping-load-form] input[name^="add_"]'
REGISTRAR = "form[data-shipping-load-form] button[type=submit]"
PL = "form[data-shipping-form=packing_list] "
INV = "form[data-shipping-form=invoice] "
NOS_DOCS = {"url": "/shipping-docs", "rede": True}
ABRIR_PACKING = abrir_na_linha("Packing list: pedido #1")
ABRIR_INVOICE = abrir_na_linha("Invoice: pedido #1")

cenas = [
    abertura("m7-a0-abertura", "Fornecedor", "Documentos de carga", 7, [
        'Este é o último módulo do caminho do pedido. Aqui você aprende a fazer os documentos do embarque: o check list de carga, o packing list e a invoice.',
        'Eles andam junto com o carregamento. Por isso, voltamos ao momento em que o container vazio já está na fábrica.',
        'O portal confere cada documento com o anterior, linha a linha. Número errado volta para ser refeito.',
    ]),

    # ------------------------------------------------------- 1 · Check list de carga
    capitulo("m7-c1-cartao", C1, 1, 3, "Check list de carga", "A contagem das caixas que subiram no container",
             "Primeiro: o check list de carga."),
    tela("m7-c1-checklist", C1, "forn-m7-base", salvar="forn-m7-s1", tarefa="Fazer o check list de carga", passos=[
        mostrar("p1", 'Com o container vazio registrado, abrem os documentos do embarque. São quatro, em ordem. A pendência do primeiro é o check list de carga. A linha de cima, do carregamento, continua aberta enquanto você faz os documentos.',
                linha("Check list de carga")),
        clicar("p2", 'Na linha do check list, clique no ícone de abrir, à direita.', abrir_na_linha("Check list de carga"), alvo_visual=linha("Check list de carga"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Check list de carga"', espera=NOS_DOCS),
        mostrar("p3", 'Esta tela reúne os quatro documentos. O check list é a contagem das caixas que subiram no container, item por item.', DOC("load"), foco=False),
        mostrar("p4", 'A tabela mostra as caixas do pedido, as carregadas e as que faltam. Aqui, o total do pedido é 200.', "[data-load-line]"),
        digitar("p5", 'Em "Subiram agora", digite quantas caixas subiram neste lançamento. Não precisa ser tudo de uma vez.', CAIXAS, "120", rotulo="Subiram agora",
                rotulo_lado="acima", resumo='Em "Subiram agora", digite as caixas deste lançamento', acao_em={"apos": "lançamento."}),
        clicar("p6", 'E clique em "Registrar as caixas".', REGISTRAR, rotulo="Registrar as caixas", rotulo_lado="direita", resumo='Clique em "Registrar as caixas"',
               espera={"url": "done=load", "rede": True}),
        mostrar("p7", 'O pedido vai sendo abatido: cento e vinte carregadas, faltam oitenta.', "[data-load-line]"),
        digitar("p8", 'Quando o resto subir, lance as caixas que faltavam.', CAIXAS, "80", rotulo="Subiram agora", rotulo_lado="acima",
                resumo="Lance as caixas que faltavam"),
        clicar("p9", 'E registre de novo.', REGISTRAR, rotulo="Registrar as caixas", rotulo_lado="direita", resumo='Clique em "Registrar as caixas"',
               espera={"texto": "Carga completa", "rede": True}),
        mostrar("p10", 'Carga completa: todas as caixas do pedido estão no container. O check list fica conferido, e o packing list abre.',
                texto("Carga completa"), pausa=0.6),
    ]),
    sua_vez("m7-c1-suavez", C1, "Fazer o check list de carga", [
        'Em Pendências, clique no ícone de abrir na linha "Check list de carga"',
        'Em "Subiram agora", digite as caixas que subiram',
        'Clique em "Registrar as caixas"',
        'Repita até a tela mostrar "Carga completa"',
    ], "Agora é com você: pause o vídeo e faça o check list de carga de um pedido."),

    # ------------------------------------------------------------- 2 · Packing list
    capitulo("m7-c2-cartao", C2, 2, 3, "Packing list", "Caixas, peças e pesos de cada item",
             "Agora: o packing list."),
    tela("m7-c2-packing", C2, "forn-m7-s1", salvar="forn-m7-s2", tarefa="Enviar o packing list", passos=[
        mostrar("p1", 'Com a carga completa, a pendência passa a ser o packing list.', linha("Packing list: pedido #1")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_PACKING, alvo_visual=linha("Packing list: pedido #1"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Packing list"', espera=NOS_DOCS),
        mostrar("p3", 'O packing list é a lista da carga: caixas, peças e pesos de cada item. As caixas já vêm do check list.', DOC("packing_list"), foco=False),
        mostrar("p4", 'Confira as peças, o peso líquido e o peso bruto. Os campos já vêm preenchidos pelo portal. Corrija, se a carga real for diferente.',
                PL + "[data-doc-line]"),
        anexar("p5", 'Se quiser, escolha o arquivo do seu packing list. Aqui ele é opcional.', PL + "input[type=file]", "packing-list-PL-2026-0115.pdf",
               rotulo="Arquivo (opcional)", rotulo_lado="acima", resumo="Confira os números e, se quiser, escolha o arquivo", acao_em="fim"),
        clicar("p6", 'E clique em "Enviar o packing list".', PL + "button[type=submit]", rotulo="Enviar o packing list", rotulo_lado="direita",
               resumo='Clique em "Enviar o packing list"', espera={"url": "done=packing_list", "rede": True}),
        mostrar("p7", 'O packing list foi conferido com o check list. Agora abre a invoice.', DOC("packing_list") + " [data-shipping-status]", pausa=0.6),
    ]),
    sua_vez("m7-c2-suavez", C2, "Enviar o packing list", [
        'Em Pendências, clique no ícone de abrir na linha "Packing list"',
        "Confira as peças, o peso líquido e o peso bruto de cada item",
        "Se quiser, escolha o arquivo do packing list",
        'Clique em "Enviar o packing list"',
    ], "Sua vez. Pause o vídeo e envie o packing list de um pedido."),

    # ------------------------------------------------------------------ 3 · Invoice
    capitulo("m7-c3-cartao", C3, 3, 3, "Invoice", "A fatura comercial, conferida com o packing list",
             "Por fim: a invoice."),
    tela("m7-c3-invoice", C3, "forn-m7-s2", salvar="forn-m7-s3", tarefa="Enviar a invoice", passos=[
        mostrar("p1", 'Com o packing list conferido, chega a pendência da invoice. A linha do packing list continua na lista até a invoice ser enviada, mas ele já está conferido.', linha("Invoice: pedido #1")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_INVOICE, alvo_visual=linha("Invoice: pedido #1"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Invoice"', espera=NOS_DOCS),
        mostrar("p3", 'A invoice é a fatura comercial da carga. Na tela, ela aparece como "Invoice (trading)": a trading é você, que entra com o login do fornecedor. A invoice precisa bater com o packing list, linha por linha.', DOC("invoice"), foco=False),
        mostrar("p4", 'Veja se as caixas, as peças, os pesos e o preço por peça estão certos.', INV + "[data-doc-line]"),
        digitar("p5", 'Digite o número da invoice.', INV + "input[name=number]", "INV-2026-0115", rotulo="Nº da invoice", rotulo_lado="acima",
                resumo="Digite o número da invoice"),
        anexar("p6", 'E escolha o arquivo do documento. Na invoice, o arquivo é obrigatório.', INV + "input[type=file]", "invoice-INV-2026-0115.pdf",
               rotulo="Arquivo do documento", rotulo_lado="acima", resumo="Escolha o arquivo da invoice", acao_em="fim"),
        clicar("p7", 'Depois, clique em "Enviar a invoice".', INV + "button[type=submit]", rotulo="Enviar a invoice", rotulo_lado="direita",
               resumo='Clique em "Enviar a invoice"', espera={"seletor": DOC("invoice") + ' [data-shipping-status="accepted"]', "rede": True}),
        mostrar("p8", 'A invoice bateu com o packing list e ficou conferida. A companhia marítima é avisada para fazer o último documento.',
                DOC("invoice") + " [data-shipping-status]"),
        mostrar("p9", 'O último documento, o BL, não é seu: quem preenche é a companhia marítima. Você só acompanha.', DOC("bl"), pausa=0.6),
    ], cuidados=[
        {"erro": '"Não bateu: refazer", com o quadro "Diferenças encontradas".',
         "solucao": "Um número da invoice não bate com o packing list. O quadro mostra o item, o campo, o valor esperado e o informado. Corrija e envie de novo."},
        {"erro": '"Informe o número do documento." ou "Envie o arquivo do documento."',
         "solucao": "Na invoice, o número e o arquivo são obrigatórios."},
    ]),
    cuidado("m7-c3-cuidado", C3, "forn-m7-s2", antes=[pre("clicar", ABRIR_INVOICE, NOS_DOCS)], passos=[
        mostrar("p1", 'Atenção a este cuidado. Voltei para antes do envio da invoice. Se algum número da invoice não bate com o packing list, o portal devolve o documento.', DOC("invoice"), foco=False),
        digitar("p2", 'Veja: por engano, digito cem peças a menos.', INV + '[data-doc-line] input[name^="pieces_"]', "2300", rotulo="Peças", rotulo_lado="acima"),
        digitar("p3", 'Depois, o número da invoice.', INV + "input[name=number]", "INV-2026-0115", pausa=0.2),
        anexar("p4", 'E o arquivo.', INV + "input[type=file]", "invoice-INV-2026-0115.pdf", acao_em="fim", pausa=0.2),
        clicar("p5", 'E envio.', INV + "button[type=submit]", espera={"texto": "Diferenças encontradas", "rede": True}),
        mostrar("p6", 'O portal responde que não bateu, e o quadro "Diferenças encontradas" mostra o item, o campo, o valor esperado e o informado. Acerte o número e envie de novo.',
                acima(texto("Diferenças encontradas"), 1), pausa=0.8),
    ]),
    sua_vez("m7-c3-suavez", C3, "Enviar a invoice", [
        'Em Pendências, clique no ícone de abrir na linha "Invoice"',
        "Confira caixas, peças, pesos e preço por peça",
        "Digite o número da invoice e escolha o arquivo do documento",
        'Clique em "Enviar a invoice"',
    ], "Agora você. Pause o vídeo e envie a invoice de um pedido."),

    encerramento("m7-z9-resumo", "Documentos conferidos", "Check list de carga, packing list e invoice.", [
        'Resumindo: você conta as caixas no check list, confere e envia o packing list, e fecha com a invoice, que tem de bater com ele.',
        'Agora responda ao quiz deste módulo. Depois dele, você aprende a acompanhar os pedidos e a registrar certificações.',
    ]),
]

CK, PK, IV, CU = "m7-c1-checklist", "m7-c2-packing", "m7-c3-invoice", "m7-c3-cuidado"
perguntas = [
    ordenar("q1", "Ordem dos documentos do embarque", (CK, "p3"),
            'Ponha os documentos do embarque na ordem em que são feitos.',
            ['Check list de carga', 'Packing list', 'Invoice', 'BL, pela companhia marítima'],
            'Cada documento só abre depois do anterior, e o portal confere um com o outro.'),
    cenario("q2", "Quando os documentos abrem", (CK, "p1"),
            'A partir de que momento você consegue fazer o check list de carga?',
            ['Assim que o contrato é assinado', 'Depois de registrar o container vazio na fábrica, com as fotos', 'Só depois do lacre', 'Só depois do BL'], 1,
            'Os documentos do embarque abrem quando o container vazio está registrado, com as fotos.'),
    clique("q3", "Lançar as caixas carregadas", (CK, "p5"),
           'Subiram 120 caixas no container. Clique no campo onde você lança esse número.',
           'O campo "Subiram agora" recebe as caixas de cada lançamento. O pedido vai sendo abatido até terminar.'),
    cenario("q4", "Check list em partes", (CK, "p7"),
            'Você lançou 120 das 200 caixas e o carregamento parou por hoje. O que acontece?',
            ['O check list é recusado', 'Ele fica em andamento, com 80 caixas faltando, e você lança o resto depois', 'O packing list abre assim mesmo', 'O pedido é cancelado'], 1,
            'O check list aceita vários lançamentos. Os outros documentos só abrem com a carga completa.'),
    cenario("q5", "De onde vêm as caixas do packing list", (PK, "p3"),
            'No packing list, o número de caixas de cada item já aparece preenchido. De onde ele vem?',
            ['Da invoice', 'Do check list de carga', 'Do contrato', 'Do book'], 1,
            'As caixas do packing list vêm do check list. Você confere peças, peso líquido e peso bruto.'),
    clique("q6", "Enviar o packing list", (PK, "p6"),
           'Os números do packing list estão conferidos. Clique no botão que envia o documento.',
           '"Enviar o packing list" manda o documento para a conferência com o check list.'),
    cenario("q7", "O que é obrigatório na invoice", (IV, "p6"),
            'Na invoice, além dos números da tabela, o que você precisa informar?',
            ['Nada mais', 'O número da invoice e o arquivo do documento', 'Só a foto do lacre', 'O rastreio das amostras'], 1,
            'Na invoice, o número e o arquivo são obrigatórios. No packing list, o arquivo é opcional.'),
    cenario("q8", "Invoice que não bate", (CU, "p6"),
            'Você enviou a invoice e o selo ficou "Não bateu: refazer", com a linha "peças esperado 2400, informado 2300". O que fazer?',
            ['Enviar o packing list de novo', 'Corrigir as peças na invoice para bater com o packing list e enviar de novo', 'Esperar a Wellmix aceitar', 'Refazer o check list'], 1,
            'O quadro "Diferenças encontradas" diz o item e o campo. A invoice tem de bater com o packing list, linha a linha.'),
    cenario("q9", "Quem faz o BL", (IV, "p9"),
            'Depois da invoice conferida, quem preenche o BL?',
            ['Você, na mesma tela', 'A companhia marítima; você só acompanha', 'A agência de marketing', 'A certificadora'], 1,
            'O BL é da companhia marítima. Com a invoice conferida, ela é avisada para fazer o documento.'),
    clique("q10", "Número da invoice", (IV, "p5"),
           'Clique no campo onde vai o número da invoice.',
           'O campo "Nº da invoice" fica abaixo da tabela, ao lado do arquivo do documento.'),
]

MODULO = {"modulo": {"id": 7, "titulo": "Documentos de carga"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
