# Certificadora (OCP) · Quiz final do papel
# Perguntas que juntam os dois módulos: as três tarefas de um pedido, onde fica cada coisa, o que
# envia na hora e o que pede o botão "Enviar", e quem faz o quê depois do selo.
from roteiro_util import *  # noqa: F401,F403

perguntas = [
    ordenar("f1", "Trocar o arquivo do selo", ("m2-c3-substituir", "p3"),
            'O selo de um pedido foi enviado com o arquivo errado e não há mais pendência na lista. Ponha em ordem os passos para trocar o arquivo.',
            ['Abrir "Pedidos", no menu, e clicar no número do pedido', 'No quadro do selo, clicar em "Substituir arquivo" e selecionar o arquivo novo',
             'Conferir o nome do arquivo novo', 'Clicar em "Confirmar substituição"'],
            'Sem pendência, o caminho é a lista "Pedidos". No quadro do selo, "Substituir arquivo" abre a troca, que só vale depois de "Confirmar substituição".'),
    cenario("f2", "Por onde começar o dia", ("m1-c1-pendencias", "p1"),
            'Você entra no portal com vários pedidos em andamento. Como saber o que fazer primeiro?',
            ['Abrir cada pedido e procurar o que falta', 'Olhar "Minhas pendências", que já vem com o mais urgente primeiro, e usar "Abrir"',
             'Esperar a Wellmix ligar', 'Abrir a ficha de compra de cada pedido'], 1,
            'Tudo o que depende da certificadora aparece em "Minhas pendências", por prazo. O botão "Abrir" leva direto ao lugar da tarefa.'),
    cenario("f3", "Dois jeitos de enviar", ("m2-c1-selo", "p6"),
            'Na linha do certificado, o arquivo é enviado assim que você seleciona. E no quadro do alto, para o selo e o memorial?',
            ['É igual: o envio é automático', 'Você seleciona o arquivo e depois clica em "Enviar"', 'Não se envia arquivo ali', 'Quem envia é a Wellmix'], 1,
            'Nos itens dos marcos, selecionar o arquivo já envia. No quadro do alto do cartão "Certificação", é o botão "Enviar" que manda.'),
    cenario("f4", "Certificado por produto, selo por pedido", ("m1-c1-pendencias", "p2"),
            'Um pedido tem dois produtos com certificação. Quantos certificados e quantos selos o portal pede?',
            ['Um certificado e dois selos', 'Dois certificados, um por produto, e um selo para o pedido', 'Dois certificados e dois selos', 'Um certificado e um selo'], 1,
            'O certificado tem uma linha por produto. O selo e o memorial descritivo são do pedido inteiro.'),
    cenario("f5", "O que a certificadora pode fazer no pedido", ("m1-c2-pedido", "p6"),
            'No pedido, você vê a ficha de compra e o documento do pedido. O que dá para fazer com eles?',
            ['Editar a ficha e assinar o documento', 'Só ler: a ficha abre sem edição, e o documento é assinado pela Wellmix e pelo fornecedor',
             'Apagar os dois', 'Aprovar o preço'], 1,
            'A certificadora vê o pedido completo para certificar, mas só lê. O que ela envia é o certificado, o selo e o memorial.'),
    cenario("f6", "Quem faz o quê depois do selo", ("m2-c1-selo", "p8"),
            'O selo foi enviado. O que acontece em seguida, e com quem?',
            ['A certificadora aplica o selo na arte', 'Quem faz a arte baixa o selo, aplica e envia a arte com o selo; a Wellmix valida',
             'O fornecedor valida o selo', 'Nada mais acontece'], 1,
            'A certificadora envia o selo. Quem faz a arte aplica e envia a arte com o selo. A Wellmix confere.'),
    clique("f7", "Enviar o certificado", ("m1-c3-certificado", "p3"),
           'Você está no marco "Certificação" e o certificado do produto já está emitido, em PDF. Clique no lugar certo para enviar.',
           'Na linha do certificado, "Escolher arquivo" envia na hora o PDF selecionado.'),
    clique("f8", "Trocar o arquivo do selo", ("m2-c3-substituir", "p3"),
           'O selo enviado estava com o arquivo errado. Clique no lugar certo para trocar.',
           '"Substituir arquivo", no quadro do selo, abre a troca. Depois, "Confirmar substituição".'),
    cenario("f9", "Achar o trabalho por outro caminho", ("m2-c4-mesa", "p2"),
            'Você quer ver só o passo da certificação, com todos os seus pedidos. Onde olhar?',
            ['Em "Certificação", no menu: abas "Pendências" e "Todos no passo"', 'Na ficha de compra', 'No documento do pedido', 'Na tela de entrada'], 0,
            'No menu, "Certificação" abre a tela do passo. A aba "Pendências" mostra o que espera por você; "Todos no passo", todos os pedidos naquele passo.'),
]

FINAL = {"corte": 0.8, "perguntas": perguntas}
