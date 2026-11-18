# Fornecedor · Módulo 4 · Pedido de compra: Die Cut, amostras, contrato e sinal
# Tarefas T6 (Die Cut), T8 (aceitar o pedido de amostras), T7 (assinar o contrato) e
# T9 (confirmar o recebimento). Dados: pontos forn-m4-diecut, forn-m4-contrato e forn-m4-pagamento.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Die Cut"
C2 = "2 · Aceitar o pedido de amostras"
C3 = "3 · Assinar o contrato"
C4 = "4 · Confirmar o recebimento do sinal"

FACA = '[data-die-cut-item="dieline"] '
FOTO = '[data-die-cut-item="hd"] '
TERMOS = '[data-die-cut-item="terms"] '
ABRIR_DIECUT = abrir_na_linha("Die Cut:")
# Desde 18/11/2026 o aceite do pedido de amostras chega com o mesmo título e texto da assinatura
# ("Pedido #1: Assinar o pedido"); muda só o destino: a página do pedido (aceite) ou o documento.
LINHA_AMOSTRAS = sel('main table tbody tr:has(a[data-open-link]:not([href*="purchase-order"]))', "Pedido #1: Assinar o pedido")
LINHA_CONTRATO = sel('main table tbody tr:has(a[data-open-link][href$="/purchase-order"])', "Pedido #1: Assinar o pedido")
ABRIR_AMOSTRAS = sel("a[data-open-link]", dentro=LINHA_AMOSTRAS)
ABRIR_CONTRATO = sel("a[data-open-link]", dentro=LINHA_CONTRATO)
ABRIR_RECEBIMENTO = abrir_na_linha("Confirmar recebimento: pedido #1")
ACEITE = "form[data-sample-order-accept] "
ASSINAR = "[data-order-sign-file] "

cenas = [
    abertura("m4-a0-abertura", "Fornecedor", "Pedido de compra", 4, [
        'A amostra foi aprovada e a Wellmix emitiu o pedido de compra. Aqui você aprende o que é seu até a produção começar.',
        'São quatro tarefas: o Die Cut, o aceite do pedido de amostras, a assinatura do contrato e a confirmação do sinal.',
    ]),

    # ------------------------------------------------------------------ 1 · Die Cut
    capitulo("m4-c1-cartao", C1, 1, 4, "Die Cut", "A faca da caixa, a foto em alta, o pedido mínimo e o prazo",
             "Primeiro: o Die Cut."),
    tela("m4-c1-diecut", C1, "forn-m4-diecut", salvar="forn-m4-s1", tarefa="Fazer o Die Cut do pedido", passos=[
        mostrar("p1", 'A primeira tarefa do pedido é o Die Cut: a faca da caixa e a foto do produto em alta. Sem elas, a agência não começa a arte.',
                linha("Die Cut:")),
        clicar("p2", 'Na linha do Die Cut, clique no ícone de abrir, à direita.', ABRIR_DIECUT, alvo_visual=linha("Die Cut:"), 
               resumo='Em Pendências, clique no ícone de abrir na linha do Die Cut', espera={"url": "/die-cut", "rede": True}),
        mostrar("p3", 'O quadro tem um cartão por produto e avisa o que falta. Aqui faltam os quatro itens.', texto("Falta:"), rotulo="O que falta", rotulo_lado="acima"),
        anexar("p4", 'No item "Die Cut", envie a faca da caixa. Para um PDF, use "Escolher arquivo". Para uma imagem, "Tirar ou escolher foto". O envio é automático.',
               FACA + 'input[aria-label="Escolher arquivo"]', "faca-caixa-pote-1500ml.pdf", alvo_visual=FACA + "[data-file-button]",
               rotulo="Escolher arquivo", rotulo_lado="acima", resumo='No item "Die Cut", escolha o arquivo da faca', destaque_em={"em": "Escolher"},
               acao_em="fim", espera={"seletor": FACA.strip()[:-1] + '][data-done="yes"]', "rede": True}),
        mostrar("p5", 'O arquivo foi enviado e o item passou para "Feito".', FACA.strip()),
        anexar("p6", 'Em "Foto em alta", envie a foto do produto em alta resolução.', FOTO + "input[type=file]", "foto-alta-pote-1500ml.jpg",
               alvo_visual=FOTO + "[data-photo-button]", rotulo="Tirar ou escolher foto", rotulo_lado="acima",
               resumo='Em "Foto em alta", escolha a foto do produto', acao_em="fim", espera={"seletor": FOTO.strip()[:-1] + '][data-done="yes"]', "rede": True}),
        mostrar("p7", 'Depois do primeiro arquivo, o sinal de mais acrescenta outras fotos, e a lixeira exclui a que foi por engano.', FOTO.strip()),
        mostrar("p8", 'Por último, o pedido mínimo e o prazo de entrega. Os campos já vêm com o que foi negociado: mínimo de 1.200 e prazo de 35 dias.',
                TERMOS.strip(), rotulo="Pedido mínimo e prazo", rotulo_lado="acima"),
        clicar("p9", 'Se os números estiverem certos, é só confirmar. Se mudaram, corrija antes. Clique em "Confirmar pedido mínimo e prazo".',
               TERMOS + "[data-die-cut-terms] button[type=submit]", rotulo="Confirmar pedido mínimo e prazo", rotulo_lado="direita",
               resumo='Confira os números e clique em "Confirmar pedido mínimo e prazo"', acao_em={"apos": "antes."}, espera={"url": "saved=terms", "rede": True}),
        mostrar("p10", 'Pronto: os quatro itens estão feitos. A Wellmix e a agência são avisadas, e a arte pode começar.',
                texto("Os quatro itens estão feitos"), pausa=0.6),
    ], cuidados=[
        {"erro": '"Prazo inválido: informe um número inteiro de dias, de 1 a 720."',
         "solucao": "O prazo de entrega é em dias inteiros, de 1 a 720. Corrija o número e confirme de novo."},
        {"erro": '"Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado."',
         "solucao": "Cada arquivo pode ter até 50 MB. Reduza o arquivo e envie de novo."},
    ]),
    cuidado("m4-c1-cuidado", C1, "forn-m4-diecut", antes=[pre("clicar", ABRIR_DIECUT, {"url": "/die-cut", "rede": True})], passos=[
        mostrar("p1", 'Um cuidado com o prazo de entrega: ele vai em dias inteiros. Voltei para o começo do Die Cut.', TERMOS.strip(), foco=False),
        digitar("p2", 'Veja o que acontece com um prazo de zero dias.', TERMOS + "[data-die-cut-terms] input[name=leadTimeDays]", "0",
                rotulo="Prazo de entrega (dias)", rotulo_lado="acima"),
        clicar("p3", 'Tento confirmar.', TERMOS + "[data-die-cut-terms] button[type=submit]", espera={"texto": "Prazo inválido", "ms": 300}),
        mostrar("p4", 'O portal avisa que o prazo é inválido: tem de ser um número de 1 a 720 dias. Corrija e confirme de novo.',
                texto("Prazo inválido"), pausa=0.6),
    ]),
    sua_vez("m4-c1-suavez", C1, "Fazer o Die Cut", [
        'Em Pendências, clique no ícone de abrir na linha do Die Cut',
        'Envie a faca no item "Die Cut" e a foto em "Foto em alta"',
        "Confira o pedido mínimo e o prazo de entrega",
        'Clique em "Confirmar pedido mínimo e prazo"',
    ], "Agora é com você: pause o vídeo e faça o Die Cut de um pedido."),

    # ------------------------------------------- 2 · Aceitar o pedido de amostras
    capitulo("m4-c2-cartao", C2, 2, 4, "Aceitar o pedido de amostras", "Um contrato à parte do pedido de compra",
             "Agora: o pedido de amostras."),
    tela("m4-c2-amostras", C2, "forn-m4-contrato", salvar="forn-m4-s2", tarefa="Aceitar o pedido de amostras", passos=[
        mostrar("p1", 'Com a arte e o certificado prontos, a Wellmix gera o pedido de amostras e assina o contrato. Chegam duas pendências para você.',
                "main table tbody", foco=False),
        clicar("p2", 'Atenção: hoje as duas aparecem com o mesmo título, "Assinar o pedido", e o mesmo texto. Uma leva ao documento do pedido, para a assinatura. A outra leva à página do pedido, onde está o aceite das amostras. Comece por ela: use o ícone de abrir dessa linha.',
               ABRIR_AMOSTRAS, alvo_visual=LINHA_AMOSTRAS, 
               resumo='Em Pendências, abra a linha "Assinar o pedido" que leva à página do pedido', destaque_em={"em": "outra"},
               espera={"url": "/app/orders/[^/?#]+$", "rede": True}),
        mostrar("p3", 'O pedido abre no marco "Contrato". Há dois itens esperando você: comece pelo "Pedido de amostras aceito pelo fornecedor".',
                sel("main li", "Pedido de amostras aceito pelo fornecedor")),
        clicar("p4", 'Nesse item, clique em "Pedido de amostras".', 'a[data-sample-order-link="sample_order_supplier"]', rotulo="Pedido de amostras",
               rotulo_lado="acima", resumo='No item do aceite, clique no botão vermelho "Pedido de amostras"', espera={"url": "/samples", "rede": True}, zoom=1.3),
        mostrar("p5", 'É um contrato separado do pedido de compra: amostras para o show room no Brasil e para a agência de marketing na China. A regra é de quinze peças por variante de cada produto.',
                texto("Regra: 15 peças")),
        digitar("p6", 'Para dar o aceite, escreva o nome completo de quem aceita.', ACEITE + "input[name=name]", "Li Wei", rotulo="Nome completo de quem aceita",
                rotulo_lado="acima", resumo="Escreva o nome completo de quem aceita"),
        marcar("p7", 'Marque a caixinha: você confirma a leitura do pedido de amostras e concorda em produzir e separar essas quantidades.', ACEITE + "input[name=agree]",
               alvo_visual=sel(ACEITE + "label", "Li o pedido de amostras"), resumo='Marque a caixinha "Li o pedido de amostras e concordo…"'),
        clicar("p8", 'E clique em "Aceitar o pedido de amostras".', ACEITE + "button[type=submit]", rotulo="Aceitar o pedido de amostras",
               rotulo_lado="direita", resumo='Clique em "Aceitar o pedido de amostras"', espera={"url": "accepted=1", "rede": True}),
        mostrar("p9", 'Pedido de amostras aceito. Essas amostras voltam mais adiante, depois da inspeção.', texto("Pedido de amostras aceito."), pausa=0.6),
    ]),
    sua_vez("m4-c2-suavez", C2, "Aceitar o pedido de amostras", [
        'Em Pendências, abra a linha "Assinar o pedido" que leva à página do pedido (não ao documento)',
        'No item "Pedido de amostras aceito pelo fornecedor", clique no botão vermelho "Pedido de amostras"',
        'Escreva o nome completo e marque a caixinha "Li o pedido de amostras e concordo…"',
        'Clique em "Aceitar o pedido de amostras"',
    ], "Sua vez. Pause o vídeo e aceite um pedido de amostras."),

    # ----------------------------------------------------- 3 · Assinar o contrato
    capitulo("m4-c3-cartao", C3, 3, 4, "Assinar o contrato", "Baixar, assinar, carimbar e enviar o arquivo",
             "Agora: a assinatura do contrato."),
    tela("m4-c3-contrato", C3, "forn-m4-s2", salvar="forn-m4-s3", tarefa="Assinar o contrato do pedido", passos=[
        mostrar("p1", 'A outra pendência é a assinatura. A Wellmix assina primeiro e você assina em seguida. O pedido só segue com as duas assinaturas.',
                LINHA_CONTRATO),
        clicar("p2", 'Na linha "Assinar o pedido", clique no ícone de abrir, à direita.', ABRIR_CONTRATO, alvo_visual=LINHA_CONTRATO, 
               resumo='Em Pendências, clique no ícone de abrir na linha "Assinar o pedido"', espera={"url": "/purchase-order", "rede": True}),
        mostrar("p3", 'Este é o documento do pedido. O selo mostra que ele foi enviado a você e espera a sua assinatura.', "[data-order-document-status]"),
        mostrar("p4", 'Confira o que foi combinado: o produto, a quantidade, o preço por unidade, o total e a condição de pagamento. Hoje, o pedido mínimo e o prazo aparecem em branco nesta tela: os números são os que você confirmou no Die Cut.',
                "section[data-order-document]", rotulo="O que foi combinado", rotulo_lado="acima"),
        apontar("p5", 'No quadro "Sua vez de assinar", que hoje mostra só a "Opção 2", baixe o documento em PDF. Imprima, assine e carimbe.', "[data-order-pdf-step]",
                rotulo="Baixar o documento em PDF", rotulo_lado="direita", resumo='Baixe o documento em PDF, imprima, assine e carimbe',
                destaque_em={"em": "baixe"}),
        mostrar("p6", 'De volta ao portal, confira o nome de quem assinou.', ASSINAR + "input[name=name]", rotulo="Nome de quem assinou", rotulo_lado="acima"),
        anexar("p7", 'Depois, use o botão "Enviar o documento assinado" e escolha o arquivo: o PDF ou uma foto do contrato assinado e carimbado. Atenção: escolher o arquivo já registra a assinatura.',
               ASSINAR + "input[type=file]", "contrato-assinado-e-carimbado.pdf", alvo_visual=ASSINAR + "[data-file-button]",
               rotulo="Enviar o documento assinado (PDF ou foto)", rotulo_lado="acima", resumo='Clique em "Enviar o documento assinado" e escolha o arquivo',
               destaque_em={"em": "botão"}, acao_em="fim", espera={"url": "signed=1", "rede": True}),
        mostrar("p8", 'Assinatura registrada. O selo agora mostra o contrato assinado pelos dois, e a Wellmix é avisada. O resto do texto do selo é um passo interno dela.', "[data-order-document-status]", pausa=0.6),
    ], cuidados=[
        {"erro": '"A Wellmix ainda não assinou. Você assina depois dela."',
         "solucao": "O contrato ainda está com a Wellmix. Espere a pendência \"Assinar o pedido\" chegar: o campo de envio só aparece na sua vez."},
        {"erro": '"O arquivo assinado precisa ser PDF ou foto (JPG, PNG ou WebP)."',
         "solucao": "Envie o contrato assinado em PDF ou como foto, com até 50 MB."},
    ]),
    cuidado("m4-c3-cuidado", C3, "forn-m4-s1", passos=[
        mostrar("p1", 'Agora um cuidado. Você só assina depois da Wellmix. Voltei no tempo, para logo depois do Die Cut.', "main", foco=False),
        clicar("p2", 'Pelo menu, abro "Meus books".', sel("aside button", "Meus books"), espera={"seletor": "aside a[href='/app/orders']"}),
        clicar("p3", 'E depois "Pedidos".', "aside a[href='/app/orders']", espera={"url": "/app/orders$", "rede": True}),
        clicar("p4", 'O número do pedido abre o documento.', sel("main table tbody tr a", n=0), alvo_visual=linha("#1"), rotulo="Nº do pedido", rotulo_lado="acima", espera={"url": "/purchase-order", "rede": True}),
        mostrar("p5", 'O portal avisa que a Wellmix ainda não assinou, e o campo de envio não aparece. É só esperar: quando for a sua vez, a pendência chega.',
                texto("A Wellmix ainda não assinou"), pausa=0.6),
    ]),
    sua_vez("m4-c3-suavez", C3, "Assinar o contrato", [
        'Em Pendências, clique no ícone de abrir na linha "Assinar o pedido"',
        "Confira o documento e baixe o PDF",
        "Imprima, assine e carimbe",
        'Use "Enviar o documento assinado" para subir o arquivo',
    ], "Agora você. Pause o vídeo e assine o contrato de um pedido."),

    # -------------------------------------- 4 · Confirmar o recebimento do sinal
    capitulo("m4-c4-cartao", C4, 4, 4, "Confirmar o recebimento do sinal", "A Conta corrente e a primeira parcela",
             "Por fim: o sinal."),
    tela("m4-c4-sinal", C4, "forn-m4-pagamento", salvar="forn-m4-s4", tarefa="Confirmar o recebimento de um pagamento", passos=[
        mostrar("p1", 'Com o contrato assinado, a Wellmix paga o sinal, que é a primeira parcela. Quando ela registra o pagamento, chega a pendência "Confirmar recebimento".',
                linha("Confirmar recebimento: pedido #1")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_RECEBIMENTO, alvo_visual=linha("Confirmar recebimento: pedido #1"), 
               resumo='Em Pendências, clique no ícone de abrir na linha "Confirmar recebimento"', espera={"url": "/app/account", "rede": True}),
        mostrar("p3", 'Esta é a Conta corrente. No alto, o total dos pedidos, o que você já recebeu e o saldo.', 'div:has(> div > div:text-is("Total")):has(> div > div:text-is("Saldo"))', foco=False),
        mostrar("p4", 'A previsão mostra as parcelas pela condição combinada. Aqui, trinta por cento na data do pedido. O restante, noventa dias após a entrega ao cliente.',
                "section:has(#forecast)"),
        mostrar("p5", 'Mais abaixo fica o pagamento que a Wellmix registrou, ainda pendente. Antes de confirmar, confira no seu banco se o dinheiro chegou.',
                sel("main tr", "Confirmar recebimento")),
        clicar("p6", 'Se chegou, use o botão "Confirmar recebimento".', {"papel": "button", "nome": "Confirmar recebimento"}, rotulo="Confirmar recebimento",
               rotulo_lado="esquerda", resumo='Confira no banco e clique em "Confirmar recebimento"', espera={"some": "main button:has-text('Confirmar recebimento')", "rede": True}),
        mostrar("p7", 'Recebimento confirmado. Com o sinal quitado, a produção está liberada, e a inspeção abre para você.',
                'div:has(> div:text-is("Recebido"))', rotulo="Recebido", rotulo_lado="abaixo", pausa=0.6),
    ]),
    sua_vez("m4-c4-suavez", C4, "Confirmar um recebimento", [
        'Em Pendências, clique no ícone de abrir na linha "Confirmar recebimento"',
        "Confira a parcela na Conta corrente",
        "Confira no seu banco se o dinheiro chegou",
        'Clique em "Confirmar recebimento"',
    ], "Sua vez. Pause o vídeo e confirme o recebimento de um pagamento."),

    encerramento("m4-z9-resumo", "Pedido pronto para produzir", "Die Cut, pedido de amostras, contrato e sinal.", [
        'Resumindo: você faz o Die Cut, aceita o pedido de amostras, assina o contrato depois da Wellmix e confirma o recebimento do sinal.',
        'Agora responda ao quiz deste módulo. No próximo, a produção e a inspeção.',
    ]),
]

D, CUD, AM, CO, CUC, SI = "m4-c1-diecut", "m4-c1-cuidado", "m4-c2-amostras", "m4-c3-contrato", "m4-c3-cuidado", "m4-c4-sinal"
perguntas = [
    cenario("q1", "Para que serve o Die Cut", (D, "p1"),
            'A Wellmix gerou o pedido de compra e apareceu a pendência "Die Cut". Por que ela vem primeiro?',
            ['Porque sem ela o pagamento não sai', 'Porque a agência só faz a arte da caixa depois da faca e da foto em alta', 'Porque ela substitui o contrato', 'Porque libera o embarque'], 1,
            'A arte da embalagem é feita em cima da faca (die-cut) e usa a foto do produto em alta resolução.'),
    clique("q2", "Enviar a faca em PDF", (D, "p4"),
           'Você tem a faca da caixa em PDF. Clique no botão certo para enviar.',
           'No item "Die Cut", "Escolher arquivo" aceita PDF. "Tirar ou escolher foto" é para imagem.'),
    cenario("q3", "Pedido mínimo e prazo no Die Cut", (D, "p9"),
            'No Die Cut, os campos de pedido mínimo e prazo já vêm preenchidos com 1.200 peças e 35 dias, e o prazo mudou para 40 dias. O que fazer?',
            ['Confirmar como está e avisar depois', 'Corrigir o prazo para 40 e clicar em "Confirmar pedido mínimo e prazo"', 'Deixar o item sem confirmar', 'Recusar o pedido'], 1,
            'Os campos vêm com o negociado. Se os números mudaram, corrija antes de confirmar: são eles que valem para o pedido.'),
    cenario("q4", "Prazo inválido", (CUD, "p4"),
            'Você digitou 0 no prazo de entrega e o portal respondeu "Prazo inválido: informe um número inteiro de dias, de 1 a 720". O que fazer?',
            ['Deixar em branco', 'Digitar o prazo em dias inteiros, de 1 a 720, e confirmar de novo', 'Enviar a faca outra vez', 'Esperar a Wellmix corrigir'], 1,
            'O prazo de entrega é um número inteiro de dias, de 1 a 720.'),
    cenario("q5", "Onde aceitar o pedido de amostras", (AM, "p2"),
            'Chegou a hora de aceitar o pedido de amostras. Como você chega até ele hoje?',
            ['Pela Conta corrente', 'Pela pendência "Assinar o pedido" que abre a página do pedido e, nela, pelo botão "Pedido de amostras"', 'Pelo menu "Convites de book"', 'Pela conversa da solicitação'], 1,
            'Hoje o aceite aparece em Pendências com o mesmo título da assinatura, "Assinar o pedido". A linha do aceite abre a página do pedido; no item pendente, o botão "Pedido de amostras" leva ao aceite.'),
    ordenar("q6", "Passos para aceitar o pedido de amostras", (AM, "p4"),
            'Ponha em ordem os passos para aceitar o pedido de amostras.',
            ['Abrir o pedido pela pendência', 'Clicar em "Pedido de amostras" no item pendente',
             'Escrever o nome completo e marcar a caixinha de leitura e concordância', 'Clicar em "Aceitar o pedido de amostras"'],
            'Primeiro o pedido, depois a tela do pedido de amostras; o aceite pede o nome completo e a marcação de que você leu e concorda.'),
    cenario("q7", "Quem assina primeiro", (CUC, "p5"),
            'Você abriu o documento do pedido e leu: "A Wellmix ainda não assinou. Você assina depois dela." O que fazer?',
            ['Enviar o contrato assinado por mensagem', 'Esperar: quando for a sua vez, chega a pendência "Assinar o pedido"', 'Assinar outro pedido no lugar', 'Refazer o Die Cut'], 1,
            'A Wellmix assina primeiro. O campo de envio só aparece quando é a sua vez, e a pendência avisa.'),
    ordenar("q8", "Passos para assinar o contrato", (CO, "p2"),
            'Ponha em ordem os passos para assinar o contrato.',
            ['Abrir a pendência "Assinar o pedido"', 'Conferir o documento e baixar o PDF', 'Imprimir, assinar e carimbar',
             'Subir o arquivo em "Enviar o documento assinado"'],
            'Confira antes de baixar; assine e carimbe no papel; e só então suba o arquivo.'),
    cenario("q9", "O que registra a assinatura", (CO, "p7"),
            'No documento do pedido, o que registra a sua assinatura?',
            ['Clicar em "Baixar o documento em PDF"', 'Escolher o arquivo assinado em "Enviar o documento assinado"', 'Digitar o nome de quem assinou', 'Abrir a pendência'], 1,
            'Escolher o arquivo já registra a assinatura, com o arquivo guardado no pedido. Confira o arquivo antes de escolher.'),
    clique("q10", "Subir o contrato assinado", (CO, "p7"),
           'O contrato está assinado e carimbado, salvo em PDF. Clique no lugar por onde ele sobe.',
           '"Enviar o documento assinado (PDF ou foto)" abre a escolha do arquivo e registra a assinatura.'),
    cenario("q11", "Quando confirmar o recebimento", (SI, "p5"),
            'Apareceu a pendência "Confirmar recebimento: pedido #1". Quando você clica em "Confirmar recebimento"?',
            ['Assim que a pendência aparece', 'Depois de conferir no banco que o dinheiro chegou', 'Só depois do embarque', 'Nunca: quem confirma é a Wellmix'], 1,
            'A confirmação é um registro seu de que o dinheiro chegou. Confira no banco antes.'),
    cenario("q12", "O que o sinal libera", (SI, "p7"),
            'Você confirmou o recebimento do sinal. O que acontece no pedido?',
            ['O pedido é encerrado', 'A produção é liberada e a inspeção abre para você', 'O contrato precisa ser assinado de novo', 'O Die Cut volta a pendente'], 1,
            'Com o sinal quitado, a produção está liberada e a etapa de inspeção abre para o fornecedor.'),
]

MODULO = {"modulo": {"id": 4, "titulo": "Pedido de compra: Die Cut, amostras, contrato e sinal"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
