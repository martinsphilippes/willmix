# Agência de arte · Módulo 2 · O selo e a arte final
# Tarefas A3 e A4 do levantamento: a arte com o selo de certificação. Hoje o portal pede esse
# arquivo em dois lugares (divergência 6 do mapa): no passo "Selo aplicado na arte" do cartão
# Certificação, que a Wellmix valida ou recusa, e na linha "Arte final com o selo" do marco
# Arte, por produto. O módulo ensina os dois, como existem.
# Dados: pontos arte-final e arte-selo-recusado (`_demo/caminho-arte-certificacao.mjs`).
from roteiro_util import *  # noqa: F401,F403

C1 = "1 · Aplicar o selo na arte"
C2 = "2 · Arte final com o selo"
C3 = "3 · Selo recusado"

PRODUTO = "Glass jar 1.5L with lid"
FINAL = item(f"Arte final com o selo · {PRODUTO}")
ARQUIVO_FINAL = FINAL + 'input[aria-label="Escolher arquivo"]'
BOTAO_FINAL = FINAL + "[data-file-button]"
FINAL_ENVIADA = {"some": FINAL + "form:has(input[name=requirementId]):not([data-requirement-clear])", "rede": True}
LINHA_SELO = linha("Aplicar o selo de certificação na arte")
ABRIR_SELO = abrir_na_linha("Aplicar o selo de certificação na arte")
LINHA_FINAL = linha("Arte final com o selo")
ABRIR_FINAL = abrir_na_linha("Arte final com o selo")
NO_PEDIDO = {"url": "/app/orders/[^/?#]+", "rede": True}
PASSO_SELO = "#certification-step-cert_seal"
PASSO_ARTE = "#certification-step-cert_seal_art"
CAMPO = PASSO_ARTE + " input[type=file]"
ENVIAR = '[data-import-submit="cert_seal_art"]'
ENVIADO = {"url": "certStep=submitted", "rede": True}
SINO = "header a[href='/app/notifications']"
AVISO = sel("main table tbody tr", "Selo aplicado na arte recusado")
MARCO_ARTE = 'main details > summary:has-text("2 de 2")'

cenas = [
    abertura("m2-a0-abertura", "Agência de arte", "O selo e a arte final", 2, [
        'Aqui você fecha o trabalho da arte: aplica o selo de certificação e envia a arte final.',
        'E descobre o que fazer quando a Wellmix recusa a arte com o selo.',
    ]),

    # ------------------------------------------------------ 1 · Aplicar o selo na arte
    capitulo("m2-c1-cartao", C1, 1, 3, "Aplicar o selo na arte", "Baixar o selo e enviar a arte com ele",
             "Para começar: o selo de certificação."),
    tela("m2-c1-selo", C1, "arte-final", salvar="arte-final-s1", tarefa="Enviar a arte com o selo aplicado", passos=[
        mostrar("p1", 'A Wellmix validou a sua arte, e a certificadora enviou o certificado e o selo do produto. Com isso, chegam duas pendências novas.',
                "main table tbody", foco=False),
        mostrar("p2", 'Comece por esta: aplicar o selo de certificação na arte. Ela fica na etapa "Selo na arte".', LINHA_SELO),
        clicar("p3", 'Na linha dela, clique no ícone de abrir, à direita.', ABRIR_SELO, alvo_visual=LINHA_SELO,
               resumo='Em Pendências, clique no ícone de abrir na linha "Aplicar o selo de certificação na arte"', espera=NO_PEDIDO),
        mostrar("p4", 'Você cai no cartão "Certificação" do pedido. A primeira linha é o selo: a certificadora já enviou, e o número dele aparece ao lado.',
                PASSO_SELO),
        mostrar("p5", 'A segunda linha é a sua: "Selo aplicado na arte". A agência faz, e a Wellmix valida.', PASSO_ARTE),
        apontar("p6", 'Use o link "Baixar o selo" para pegar o arquivo do selo.', "[data-seal-download]", rotulo="Baixar o selo", rotulo_lado="esquerda",
                resumo='Clique em "Baixar o selo"', zoom=1.3),
        {"id": "p7", "fala": 'Aplique o selo na arte, no seu programa de arte, e exporte o arquivo.'},
        anexar("p8", 'De volta ao portal, use o botão "Escolher arquivo", na mesma linha, e selecione a arte com o selo.', CAMPO, "arte-final-com-selo-pote-1500ml.pdf",
               rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo='Clique em "Escolher arquivo" e selecione a arte com o selo', acao_em="fim",
               espera={"ms": 600}),
        mostrar("p9", 'O nome do arquivo aparece ao lado do botão. Aqui o envio não é automático: falta um passo.', CAMPO),
        clicar("p10", 'Clique em "Enviar".', ENVIAR, rotulo="Enviar", rotulo_lado="esquerda", resumo='Clique em "Enviar"', espera=ENVIADO),
        mostrar("p11", 'A linha passa para "Enviado, aguardando validação", e o botão vira "Enviar de novo". A Wellmix olha a arte com o selo e valida, ou devolve com o motivo.',
                PASSO_ARTE, pausa=0.6),
    ]),
    sua_vez("m2-c1-suavez", C1, "Aplicar o selo na arte", [
        'Em Pendências, clique no ícone de abrir na linha "Aplicar o selo de certificação na arte"',
        'No cartão "Certificação", clique em "Baixar o selo"',
        'Aplique o selo na arte e selecione o arquivo em "Escolher arquivo"',
        'Clique em "Enviar"',
    ], "Agora é com você: pause o vídeo e envie a arte com o selo aplicado."),

    # ------------------------------------------------------ 2 · Arte final com o selo
    capitulo("m2-c2-cartao", C2, 2, 3, "Arte final com o selo", "A mesma arte, na linha do produto",
             "Agora: a arte final, no marco da arte."),
    tela("m2-c2-final", C2, "arte-final-s1", salvar="arte-final-s2", tarefa="Enviar a arte final com o selo", passos=[
        mostrar("p1", 'Falta a outra pendência: a arte final com o selo. Hoje o portal pede a arte com o selo em dois lugares. Um é o cartão da certificação, que você acabou de ver. O outro é a linha "Arte final com o selo", no marco da arte.',
                LINHA_FINAL),
        clicar("p2", 'Na linha dessa pendência, clique no ícone de abrir, à direita.', ABRIR_FINAL, alvo_visual=LINHA_FINAL,
               resumo='Em Pendências, clique no ícone de abrir na linha da arte final com o selo', espera=NO_PEDIDO),
        mostrar("p3", 'Mais abaixo, no marco da arte, a arte final com o selo já pode ser enviada. Essa linha traz dois arquivos de apoio.', FINAL.strip()),
        fora(apontar("p4", 'O primeiro é a arte que a Wellmix validou.', sel(FINAL + "a", "arte-caixa-pote-1500ml-v2.pdf"), zoom=1.3)),
        fora(apontar("p5", 'O segundo é o certificado do produto. Os dois abrem pelo nome do arquivo.', sel(FINAL + "a", "certificado-de-conformidade"), zoom=1.3)),
        anexar("p6", 'Use o botão "Escolher arquivo" e selecione a arte final, a mesma que tem o selo aplicado.', ARQUIVO_FINAL, "arte-final-com-selo-pote-1500ml.pdf",
               alvo_visual=BOTAO_FINAL, rotulo="Escolher arquivo", rotulo_lado="esquerda",
               resumo='Na linha "Arte final com o selo", clique em "Escolher arquivo" e selecione a arte final', acao_em="fim", espera=FINAL_ENVIADA),
        mostrar("p7", 'Como na primeira arte, o envio acontece na hora. O marco "Arte" fecha como "Concluído", com as duas linhas feitas.', MARCO_ARTE),
        mostrar("p8", 'Agora falta só a Wellmix validar a arte com o selo, no cartão da certificação. Depois disso, o pedido segue para o contrato. Para rever o que foi enviado, use "Ver detalhes".',
                sel(MARCO_ARTE + " span, " + MARCO_ARTE + " div", "Ver detalhes", n=-1), pausa=0.6),
    ]),
    sua_vez("m2-c2-suavez", C2, "Enviar a arte final com o selo", [
        'Em Pendências, clique no ícone de abrir na linha da arte final com o selo',
        'No marco "Arte", clique em "Escolher arquivo" e selecione a arte final',
        'Veja o marco "Arte" fechar como "Concluído"',
    ], "Sua vez. Pause o vídeo e envie a arte final com o selo."),

    # --------------------------------------------------------------- 3 · Selo recusado
    capitulo("m2-c3-cartao", C3, 3, 3, "Selo recusado", "Ler o motivo e enviar de novo",
             "Por fim: quando a Wellmix recusa a arte com o selo."),
    tela("m2-c3-recusado", C3, "arte-selo-recusado", salvar="arte-recusado-s1", tarefa="Reenviar a arte com o selo recusada", passos=[
        clicar("p1", 'A Wellmix olhou a arte com o selo e não aceitou. O aviso chega pelo sino. Abra o sino.', SINO, rotulo="Notificações", rotulo_lado="esquerda",
               resumo="Clique no sino", espera={"url": "/app/notifications", "rede": True}, zoom=1.3),
        mostrar("p2", 'O aviso diz que o selo aplicado na arte foi recusado, e traz o motivo: o selo ficou sobre o código de barras.', AVISO, foco=False),
        clicar("p3", 'Use o botão "Resolver" para ir ao pedido.', sel("button", "Resolver", dentro=AVISO), rotulo="Resolver", rotulo_lado="esquerda",
               resumo='No aviso, clique em "Resolver"', espera=NO_PEDIDO),
        mostrar("p4", 'No cartão "Certificação", a linha "Selo aplicado na arte" está como "Recusado", com o motivo escrito logo abaixo.', PASSO_ARTE),
        anexar("p5", 'Ajuste a arte, mudando o selo de lugar, e selecione o arquivo novo em "Escolher arquivo".', CAMPO, "arte-final-com-selo-pote-1500ml-v2.pdf",
               rotulo="Escolher arquivo", rotulo_lado="esquerda", resumo='Clique em "Escolher arquivo" e selecione a arte ajustada', acao_em="fim",
               espera={"ms": 600}),
        clicar("p6", 'O botão desta linha é "Enviar de novo". Clique nele.', ENVIAR, rotulo="Enviar de novo", rotulo_lado="esquerda",
               resumo='Clique em "Enviar de novo"', espera=ENVIADO),
        mostrar("p7", 'A linha volta para "Enviado, aguardando validação", e a Wellmix olha de novo. A nova versão é enviada só aqui, no cartão da certificação. É ela que a Wellmix valida.', PASSO_ARTE, pausa=0.6),
    ]),
    sua_vez("m2-c3-suavez", C3, "Reenviar a arte com o selo", [
        'Abra o sino e clique em "Resolver" no aviso do selo recusado',
        'Leia o motivo na linha "Selo aplicado na arte"',
        'Selecione a arte ajustada em "Escolher arquivo"',
        'Clique em "Enviar de novo"',
    ], "Agora é com você: pause o vídeo e reenvie uma arte com o selo."),

    encerramento("m2-z9-resumo", "Selo aplicado, arte final enviada", "Baixar o selo, enviar a arte com ele nos dois lugares e reenviar quando a Wellmix recusa.", [
        'Resumindo: você baixa o selo no cartão da certificação, aplica na arte e envia. Depois, envia a mesma arte na linha "Arte final com o selo". Se a Wellmix recusar, você lê o motivo e envia de novo.',
        'Agora responda ao quiz deste módulo. No próximo, os ajustes de arte, a mesa de trabalho e os avisos.',
    ]),
]

S, F, R = "m2-c1-selo", "m2-c2-final", "m2-c3-recusado"
perguntas = [
    cenario("q1", "Quando o selo chega", (S, "p1"),
            'Apareceu nas suas pendências "Aplicar o selo de certificação na arte". O que aconteceu antes?',
            ['O fornecedor assinou o contrato', 'A certificadora enviou o selo do produto no pedido', 'A Wellmix cancelou a arte', 'O pedido embarcou'], 1,
            'A pendência nasce quando a certificadora envia o selo. Quem faz a arte baixa o selo, aplica e envia a arte com ele.'),
    clique("q2", "Baixar o selo", (S, "p6"),
           'Você está no cartão "Certificação" e precisa do arquivo do selo. Clique no lugar certo.',
           'Na linha "Selo aplicado na arte", o link "Baixar o selo" traz o arquivo enviado pela certificadora.'),
    ordenar("q3", "Passos do selo aplicado na arte", (S, "p3"),
            'Ponha em ordem os passos para enviar a arte com o selo aplicado.',
            ['Em Pendências, clicar no ícone de abrir na linha "Aplicar o selo de certificação na arte"', 'Clicar em "Baixar o selo"',
             'Selecionar a arte com o selo em "Escolher arquivo"', 'Clicar em "Enviar"'],
            'Abra a pendência, baixe o selo, selecione o arquivo da arte com o selo e clique em "Enviar".'),
    cenario("q4", "Arquivo escolhido", (S, "p9"),
            'No cartão "Certificação", você selecionou o arquivo e o nome dele apareceu ao lado do botão. A arte com o selo já foi enviada?',
            ['Sim, o envio é automático', 'Ainda não: falta clicar em "Enviar"', 'Só depois de atualizar a página', 'Só se a Wellmix liberar'], 1,
            'No cartão "Certificação", escolher o arquivo só prepara o envio. É o botão "Enviar" que manda.'),
    cenario("q5", "Depois de enviar", (S, "p11"),
            'A linha "Selo aplicado na arte" ficou como "Enviado, aguardando validação". O que acontece agora?',
            ['A agência valida a própria arte', 'A Wellmix olha a arte com o selo e valida, ou devolve com o motivo', 'A certificadora envia outro selo', 'O fornecedor aprova a arte'], 1,
            'Quem valida o selo aplicado na arte é a Wellmix. Se ela recusar, o motivo aparece na linha.'),
    cenario("q6", "Dois envios da arte com o selo", (F, "p1"),
            'Você já enviou a arte com o selo no cartão "Certificação". A linha "Arte final com o selo", no marco "Arte", continua pendente. O que fazer?',
            ['Nada: o portal copia o arquivo sozinho', 'Enviar a arte final também nessa linha, pelo botão "Escolher arquivo"', 'Pedir para a certificadora enviar', 'Apagar o envio do cartão "Certificação"'], 1,
            'Hoje o portal pede a arte com o selo nos dois lugares. Envie também na linha "Arte final com o selo" do produto.'),
    clique("q7", "Enviar a arte final", (F, "p6"),
           'Você está no marco "Arte" e quer enviar a arte final com o selo. Clique no lugar certo.',
           'Na linha "Arte final com o selo", o botão "Escolher arquivo" envia na hora o arquivo escolhido.'),
    cenario("q8", "Selo recusado", (R, "p4"),
            'A linha "Selo aplicado na arte" voltou como "Recusado". Qual é o primeiro passo?',
            ['Enviar o mesmo arquivo de novo', 'Ler o motivo escrito na linha e ajustar a arte', 'Pedir outro selo à certificadora', 'Esperar a Wellmix corrigir'], 1,
            'O motivo da recusa fica na própria linha (e no aviso do sino). É ele que diz o que mudar antes de enviar de novo.'),
    clique("q9", "Enviar de novo", (R, "p6"),
           'A arte ajustada já está selecionada, com o nome ao lado de "Escolher arquivo". Clique no botão que manda de novo para a Wellmix.',
           'Depois do primeiro envio, o botão desta linha se chama "Enviar de novo". É ele que manda a arte ajustada.'),
]

MODULO = {"modulo": {"id": 2, "titulo": "O selo e a arte final"}, "cenas": cenas, "quiz": {"corte": 0.8, "perguntas": perguntas}}
