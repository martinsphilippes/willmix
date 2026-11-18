# Fornecedor · Módulo 3 · Amostragem
# Tarefa T5 do levantamento: fotos e vídeos da amostra depois da aprovação, e a nova rodada
# quando a amostra é reprovada. Dados: pontos forn-m3-base e forn-m3-reprovada.
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Enviar a amostragem"
C2 = "2 · Amostra reprovada: nova rodada"

ARQUIVO = "[data-sampling-upload] input[type=file]"
BOTAO = "[data-sampling-upload] [data-file-button], [data-sampling-upload] [data-photo-button]"
DA_RODADA = "[data-sampling-file]:not(details [data-sampling-file])"
ABRIR_1 = abrir_na_linha("Amostragem da solicitação nº 1")
ABRIR_2 = abrir_na_linha("Amostragem da solicitação nº 2")
NA_AMOSTRAGEM = {"url": "/app/supplier-requests/", "seletor": "#amostragem", "rede": True}

cenas = [
    abertura("m3-a0-abertura", "Fornecedor", "Amostragem", 3, [
        'Aqui você aprende a enviar a amostragem: as fotos e os vídeos da amostra, depois que a Wellmix aprova a sua oferta.',
        'E descobre o que fazer quando a amostra é reprovada.',
    ]),

    # ------------------------------------------------------ 1 · Enviar a amostragem
    capitulo("m3-c1-cartao", C1, 1, 2, "Enviar a amostragem", "Fotos e vídeos da amostra do item",
             "Para começar: como enviar a amostragem."),
    tela("m3-c1-enviar", C1, "forn-m3-base", salvar="forn-m3-s1", tarefa="Enviar a amostragem", passos=[
        mostrar("p1", 'A Wellmix aprovou a sua oferta. Antes de fazer o pedido, ela quer ver uma amostra do item. Por isso aparece uma pendência nova: a amostragem.',
                linha("Amostragem da solicitação nº 1")),
        clicar("p2", 'Na linha da amostragem da solicitação número 1, clique no ícone de abrir, à direita.', ABRIR_1,
               alvo_visual=linha("Amostragem da solicitação nº 1"), 
               resumo='Em Pendências, clique no ícone de abrir na linha da amostragem', espera=NA_AMOSTRAGEM),
        mostrar("p3", 'Você cai direto no cartão "Amostragem". Ele mostra a rodada e o prazo para enviar.', "#amostragem", foco=False),
        mostrar("p4", 'A amostra é a do item, feita em impressora 3D. Você manda fotos e vídeos dela, mostrando detalhes, medidas e encaixes. A amostra física não é enviada.',
                texto("A amostra física não é enviada.")),
        anexar("p5", 'Use o botão "Adicionar foto ou vídeo" e escolha o primeiro arquivo. Vai um arquivo de cada vez.', ARQUIVO, "amostra-3d-frente.jpg",
               alvo_visual=BOTAO, rotulo="Adicionar foto ou vídeo", rotulo_lado="acima", resumo='Clique em "Adicionar foto ou vídeo" e escolha a foto',
               acao_em="fim", espera={"seletor": DA_RODADA, "rede": True}),
        mostrar("p6", 'A foto entrou na lista da rodada.', DA_RODADA),
        anexar("p7", 'Adicione a outra foto do mesmo jeito.', ARQUIVO, "amostra-3d-tampa.jpg", alvo_visual=BOTAO, rotulo="Adicionar foto ou vídeo",
               rotulo_lado="acima", resumo="Adicione a segunda foto", acao_em="fim", espera={"seletor": DA_RODADA + " >> nth=1", "rede": True}),
        anexar("p8", 'E também o vídeo da amostra.', ARQUIVO, "amostra-3d-video.mp4", alvo_visual=BOTAO, rotulo="Adicionar foto ou vídeo",
               rotulo_lado="acima", resumo="Adicione o vídeo", acao_em="fim", espera={"seletor": DA_RODADA + " >> nth=2", "rede": True}),
        mostrar("p9", 'Se escolher o arquivo errado, use o xis ao lado dele para tirar da lista.', sel(DA_RODADA + " button", n=0), zoom=1.3),
        {**digitar("p10", 'Se quiser, escreva uma observação para a Wellmix.', '[data-sampling-submit-form] textarea[name="note"]',
                   "Amostra em impressora 3D, com a tampa preta.", rotulo="Observação para a Wellmix (opcional)", rotulo_lado="acima", resumo="Se quiser, escreva uma observação", acao_em={"apos": "quiser"}, pausa=0.4), "sim": False},
        clicar("p11", 'Com tudo na lista, clique em "Enviar para a validação".', "[data-sampling-submit]", rotulo="Enviar para a validação",
               rotulo_lado="direita", resumo='Clique em "Enviar para a validação"', espera={"seletor": "[data-sampling=submitted]", "rede": True}),
        mostrar("p12", 'Enviada. O selo agora diz "Esperando a validação da Wellmix". Ela confere e avisa você.', texto("Esperando a validação da Wellmix"), rotulo="Situação", rotulo_lado="abaixo", pausa=0.6),
    ], cuidados=[
        {"erro": '"Envie uma foto (JPG, PNG, HEIC) ou um vídeo (MP4, MOV)."',
         "solucao": "A amostragem só aceita foto e vídeo. O arquivo não entrou na lista: escolha uma foto ou um vídeo."},
        {"erro": '"Arquivo acima de 50 MB. Grave um vídeo mais curto."',
         "solucao": "Cada arquivo pode ter até 50 MB. Grave um vídeo mais curto e adicione de novo."},
    ]),
    cuidado("m3-c1-cuidado", C1, "forn-m3-s1", antes=[pre("clicar", ABRIR_2, NA_AMOSTRAGEM)], passos=[
        mostrar("p1", 'Agora um cuidado, na amostra do copo, que ainda falta enviar. A amostragem aceita foto e vídeo. Documento não entra.', "#amostragem", foco=False),
        anexar("p2", 'Veja o que acontece se eu escolher um PDF.', ARQUIVO, "faca-caixa-pote-1500ml.pdf", alvo_visual=BOTAO, acao_em="fim",
               espera={"url": "error=", "rede": True}),
        mostrar("p3", 'O portal pede uma foto ou um vídeo, e nada entra na lista.', texto("Envie uma foto")),
        mostrar("p4", 'Outro limite: cada arquivo pode ter até cinquenta megas. Se o vídeo passar disso, grave um mais curto.',
                texto("50 MB"), pausa=0.6),
    ]),
    sua_vez("m3-c1-suavez", C1, "Enviar a amostragem", [
        'Em Pendências, clique no ícone de abrir na linha da amostragem',
        'Clique em "Adicionar foto ou vídeo" e escolha um arquivo de cada vez',
        "Confira a lista da rodada",
        'Clique em "Enviar para a validação"',
    ], "Agora é com você: pause o vídeo e envie uma amostragem."),

    # ------------------------------------------ 2 · Amostra reprovada: nova rodada
    capitulo("m3-c2-cartao", C2, 2, 2, "Amostra reprovada: nova rodada", "Ler o motivo e enviar de novo",
             "Agora: quando a amostra é reprovada."),
    tela("m3-c2-rodada", C2, "forn-m3-reprovada", tarefa="Enviar a nova rodada de uma amostra reprovada", passos=[
        mostrar("p1", 'A Wellmix confere cada amostra. Você enviou também a do copo. A do pote foi aprovada. A do copo voltou: a pendência reaparece, avisando que a amostra foi reprovada.',
                linha("Amostragem da solicitação nº 2")),
        clicar("p2", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_2, alvo_visual=linha("Amostragem da solicitação nº 2"), 
               resumo='Em Pendências, clique no ícone de abrir na amostragem reprovada', espera=NA_AMOSTRAGEM),
        mostrar("p3", 'O selo avisa: amostra reprovada, envie de novo.', texto("Amostra reprovada: envie de novo"), zoom=1.3),
        mostrar("p4", 'E o motivo vem escrito no cartão. Aqui, a foto não mostra a borda do copo, e a Wellmix pede fotos da borda e do fundo.', texto("A foto não mostra a borda do copo.")),
        mostrar("p5", 'O portal abriu a rodada 2.', texto("Rodada 2"), zoom=1.3),
        mostrar("p5b", 'O arquivo da primeira rodada fica guardado em "Rodadas anteriores".', texto("Rodadas anteriores")),
        anexar("p6", 'Adicione as fotos que faltavam, com o mesmo botão. Primeiro, a da borda.', ARQUIVO, "amostra-copo-borda.jpg", alvo_visual=BOTAO, rotulo="Adicionar foto ou vídeo",
               rotulo_lado="acima", resumo='Clique em "Adicionar foto ou vídeo" e escolha a foto da borda', acao_em="fim",
               espera={"seletor": DA_RODADA, "rede": True}),
        anexar("p6b", 'Depois, a do fundo.', ARQUIVO, "amostra-copo-fundo.jpg", alvo_visual=BOTAO, rotulo="Adicionar foto ou vídeo",
               rotulo_lado="acima", resumo="Adicione a foto do fundo", acao_em="fim", espera={"seletor": DA_RODADA + " >> nth=1", "rede": True}),
        clicar("p7", 'E clique em "Enviar para a validação".', "[data-sampling-submit]", rotulo="Enviar para a validação", rotulo_lado="direita",
               resumo='Clique em "Enviar para a validação"', espera={"seletor": "[data-sampling=submitted]", "rede": True}),
        mostrar("p8", 'Pronto: a rodada 2 foi para a validação.', texto("Esperando a validação da Wellmix")),
        mostrar("p9", 'Quando a Wellmix aprovar, o selo passa a dizer "Amostra aprovada". Só depois disso ela cria o produto e gera o pedido de compra.',
                "#amostragem", foco=False, pausa=0.6),
    ]),
    sua_vez("m3-c2-suavez", C2, "Enviar a nova rodada", [
        'Em Pendências, clique no ícone de abrir na amostragem reprovada',
        "Leia o motivo no cartão",
        'Adicione os arquivos que faltaram em "Adicionar foto ou vídeo"',
        'Clique em "Enviar para a validação"',
    ], "Sua vez. Pause o vídeo e envie a nova rodada de uma amostra."),

    encerramento("m3-z9-resumo", "Amostragem em dia", "Enviar fotos e vídeos, ler o motivo da reprovação e mandar a nova rodada.", [
        'Resumindo: depois da aprovação, você envia fotos e vídeos da amostra. Se ela for reprovada, você lê o motivo e envia a nova rodada.',
        'Agora responda ao quiz deste módulo. No próximo, chega o pedido de compra.',
    ]),
]

E, CU, RO = "m3-c1-enviar", "m3-c1-cuidado", "m3-c2-rodada"
perguntas = [
    cenario("q1", "Quando a amostragem chega", (E, "p1"),
            'Apareceu nas suas pendências "Amostragem da solicitação nº 1". O que aconteceu antes?',
            ['A Wellmix recusou a sua oferta', 'A Wellmix aprovou a sua oferta e quer ver uma amostra do item', 'O pedido de compra já foi assinado', 'A Wellmix pagou o sinal'], 1,
            'A amostragem vem depois da aprovação da solicitação e antes do produto e do pedido de compra.'),
    cenario("q2", "O que é a amostragem", (E, "p4"),
            'O que você envia na amostragem?',
            ['A amostra física, pelo correio', 'Fotos e vídeos da amostra do item, pelo portal', 'A planilha do book', 'O contrato assinado'], 1,
            'Você envia fotos e vídeos da amostra feita em impressora 3D. A amostra física não é enviada.'),
    clique("q3", "Adicionar um arquivo à rodada", (E, "p5"),
           'Você está no cartão "Amostragem" e quer subir a primeira foto. Clique no lugar certo.',
           'O botão "Adicionar foto ou vídeo" sobe um arquivo de cada vez; cada um aparece na lista da rodada.'),
    ordenar("q4", "Passos para enviar a amostragem", (E, "p2"),
            'Ponha em ordem os passos para enviar a amostragem.',
            ['Em Pendências, clicar no ícone de abrir na linha da amostragem', 'Adicionar as fotos e o vídeo, um arquivo de cada vez',
             'Conferir a lista da rodada', 'Clicar em "Enviar para a validação"'],
            'Abra a pendência, suba os arquivos um a um, confira a lista e só então envie para a validação.'),
    cenario("q5", "Arquivo recusado na amostragem", (CU, "p3"),
            'Você escolheu um PDF na amostragem e o portal respondeu: "Envie uma foto (JPG, PNG, HEIC) ou um vídeo (MP4, MOV)". O que fazer?',
            ['Enviar para a validação assim mesmo', 'Escolher uma foto ou um vídeo: o PDF não entrou na lista', 'Mandar o PDF pela Conta corrente', 'Esperar a Wellmix liberar'], 1,
            'A amostragem só aceita foto e vídeo, com até 50 MB por arquivo. O que é recusado não entra na lista.'),
    cenario("q6", "Amostra reprovada", (RO, "p4"),
            'A pendência da amostragem voltou com o aviso de que a amostra foi reprovada. Qual é o primeiro passo?',
            ['Enviar as mesmas fotos de novo', 'Abrir a amostragem e ler o motivo escrito no cartão', 'Recusar a solicitação', 'Esperar a Wellmix abrir outra solicitação'], 1,
            'O motivo da reprovação vem escrito no cartão. É ele que diz o que falta na nova rodada.'),
    cenario("q7", "Arquivos da rodada anterior", (RO, "p5b"),
            'O portal abriu a rodada 2 da amostra. O que aconteceu com os arquivos da rodada 1?',
            ['Foram apagados', 'Ficam guardados em "Rodadas anteriores"', 'Foram enviados de novo sozinhos', 'Voltaram para o book'], 1,
            'Cada rodada guarda os seus arquivos. Os das rodadas anteriores ficam em "Rodadas anteriores", para consulta.'),
    clique("q8", "Enviar a nova rodada", (RO, "p7"),
           'As fotos que faltavam já estão na lista da rodada 2. Clique no botão que manda a rodada para a Wellmix.',
           '"Enviar para a validação" manda a rodada. O selo passa a "Esperando a validação da Wellmix".'),
]

MODULO = {"modulo": {"id": 3, "titulo": "Amostragem"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
