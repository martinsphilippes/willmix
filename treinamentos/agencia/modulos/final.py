# Agência de arte · Quiz final do papel
# Perguntas que juntam os três módulos: a ordem do trabalho da agência, onde fica cada coisa e o
# que fazer quando a Wellmix devolve, recusa ou aponta um ajuste. Cada pergunta aponta para o
# trecho do vídeo que a responde.
from roteiro_util import *  # noqa: F401,F403

perguntas = [
    ordenar("f1", "O caminho da arte, do começo ao fim", ("m1-c2-arte", "p1"),
            'Ponha na ordem em que acontecem as tarefas da agência num pedido com certificação.',
            ['Enviar a arte do produto', 'Reenviar a arte, se a Wellmix reprovar na validação', 'Aplicar o selo e enviar a arte com ele, no cartão "Certificação"',
             'Enviar a arte final com o selo, na linha do produto'],
            'Primeiro a arte sobre a faca e a foto. Com a arte validada e o selo enviado pela certificadora, vêm o selo aplicado na arte e a arte final.'),
    cenario("f2", "Por onde começar o dia", ("m1-c1-pendencias", "p1"),
            'Você entra no portal com vários pedidos em andamento. Como saber o que fazer primeiro?',
            ['Abrir cada pedido e procurar o que falta', 'Olhar "Minhas pendências", que já vem com o mais urgente primeiro, e usar "Abrir"',
             'Esperar a Wellmix ligar', 'Abrir o cartão "Certificação" de cada pedido'], 1,
            'Tudo o que depende da agência aparece em "Minhas pendências", por prazo. O botão "Abrir" leva direto ao lugar da tarefa.'),
    cenario("f3", "A arte ainda não apareceu", ("m1-c2-arte", "p1"),
            'A Wellmix avisou por telefone que há um pedido novo, mas a arte não aparece nas suas pendências. Qual é a explicação mais provável?',
            ['A sua conta foi bloqueada', 'O material de arte ainda não está pronto: falta a faca ou a foto do fornecedor, ou a aprovação desse material',
             'A arte já foi feita por outra agência', 'O pedido não precisa de arte'], 1,
            'A arte só libera quando o fornecedor enviou a faca e a foto em alta e a Wellmix aprovou esse material.'),
    cenario("f4", "Dois jeitos de enviar", ("m2-c1-selo", "p9"),
            'Na linha da arte, o arquivo é enviado assim que você escolhe. E no cartão "Certificação", no passo "Selo aplicado na arte"?',
            ['É igual: o envio é automático', 'Você escolhe o arquivo e depois clica em "Enviar"', 'Não se envia arquivo ali', 'Quem envia é a certificadora'], 1,
            'Nos itens dos marcos, escolher o arquivo já envia. No cartão "Certificação", o arquivo fica selecionado e é o botão "Enviar" que manda.'),
    cenario("f5", "Quem faz o quê na certificação", ("m2-c1-selo", "p5"),
            'No cartão "Certificação", quem envia o selo e quem valida a arte com o selo aplicado?',
            ['A agência envia o selo e a certificadora valida', 'A certificadora envia o selo; a agência aplica na arte e envia; a Wellmix valida',
             'A Wellmix envia o selo e o fornecedor valida', 'O fornecedor envia o selo e a agência valida'], 1,
            'A certificadora envia o selo. A agência baixa, aplica na arte e envia. A Wellmix valida, ou recusa com o motivo.'),
    cenario("f6", "Três devoluções diferentes", ("m3-c1-ajuste", "p3"),
            'A Wellmix pode devolver o seu trabalho de três jeitos. Qual deles se resolve no cartão "Artes", com "Enviar correção"?',
            ['A arte reprovada na validação', 'A não conformidade apontada na arte de um produto', 'O selo aplicado na arte recusado', 'Nenhum deles'], 1,
            'Arte reprovada: nova versão na linha da arte. Selo recusado: "Enviar de novo" no cartão "Certificação". Não conformidade: "Enviar correção" no cartão "Artes".'),
    clique("f7", "Arte reprovada", ("m1-c3-devolvida", "p5"),
           'A arte voltou como "Reprovado" e você já fez o ajuste. Clique no lugar certo para enviar a nova versão.',
           'A nova versão sobe pelo botão "Escolher arquivo", na própria linha da arte.'),
    clique("f8", "Selo recusado", ("m2-c3-recusado", "p6"),
           'O selo aplicado na arte foi recusado e a arte ajustada já está selecionada. Clique no botão certo.',
           'Depois do primeiro envio, o botão do passo se chama "Enviar de novo". É ele que manda a arte ajustada.'),
    cenario("f9", "Onde está o material do fornecedor", ("m1-c2-arte", "p5"),
            'Você precisa da faca da caixa e da foto do produto para começar a arte. Onde elas estão?',
            ['Nas mensagens', 'No pedido, no marco "Material de arte", cada uma no nome do arquivo', 'No cartão "Certificação"', 'A Wellmix manda por e-mail'], 1,
            'O marco "Material de arte" do pedido traz a faca e a foto em alta enviadas pelo fornecedor. O nome do arquivo é o link.'),
    cenario("f10", "Achar o trabalho por outro caminho", ("m3-c2-mesa", "p3"),
            'Você quer ver todos os pedidos que estão no passo da arte, mesmo os que não têm nada pendente. Onde olhar?',
            ['Na aba "Todos no passo" da tela "Arte"', 'No sino', 'No cartão "Artes" de um pedido', 'Na tela de entrada'], 0,
            'No menu, "Pedido" e depois "Arte". A aba "Pendências" mostra o que espera por você; "Todos no passo", todos os pedidos naquele passo.'),
]

FINAL = {"corte": 0.8, "perguntas": perguntas}
