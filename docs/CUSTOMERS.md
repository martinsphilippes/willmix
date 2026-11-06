# Clientes e Fornecedores

Telas Cadastros → Clientes (`/app/customers`) e Cadastros → Fornecedores (`/app/suppliers`), ao lado da lista de Empresas (que continua igual). As duas são a mesma tela (`src/app/app/_party-accounts`), cada uma do seu lado da conta.

## Lista

- Cinco cartões com a conta de todos os clientes listados: **Valor do contrato**, **Entregue**, **Pagamento antecipado**, **A receber** e **Recebido**.
- Busca por nome, CNPJ, telefone, e-mail ou cidade; filtro Ativos, Inativos e Todos.
- Operação em lote: ativar ou desativar os marcados (nada é apagado; vai para a auditoria) e exportar a lista em CSV.
- Uma linha por cliente com a conta dele e os atalhos no fim da linha: nova solicitação, ficha, editar cadastro e conversa.

## Ficha (`/app/customers/[id]`)

- Barra de contas a receber com as cinco partes.
- Abas: **Registros de vendas** (um pedido por linha, com recebimento e entrega; atalhos Registrar recebimento, Só entregues e Nova solicitação), **Recebimentos** (cada pagamento do cliente, inclusive o sinal da solicitação) e **Informações do cliente** (cadastro e logins da empresa).

## Regras

1. Nada novo no banco: tudo vem dos pedidos e dos recebimentos já lançados.
2. Valor do contrato: venda dos pedidos não cancelados. Entregue: pedidos com etapa Entregue ou Encerrado.
3. Pagamento antecipado: recebido de pedidos ainda não entregues (até o valor da venda) mais o sinal pago na solicitação.
4. A receber: venda menos o recebido de cada pedido, nunca negativo. Recebido: tudo o que entrou (confirmado ou recebido).
5. Cada moeda fica separada; real e dólar nunca são somados.
6. Acesso: a tela é da Wellmix com acesso a Cadastros. Os valores só aparecem (e só saem no CSV) para quem abre Finanças.

## Fornecedores

A mesma tela, do lado da compra (como em Contas a pagar):

1. Valor do contrato: FOB dos pedidos não cancelados, na moeda do FOB.
2. Mercadoria entregue: FOB dos pedidos já embarcados (etapas Desembaraço, Transporte, Entregue ou Encerrado). No FOB, o fornecedor entrega no embarque.
3. Pagamento antecipado: pago em pedidos ainda não embarcados (até o FOB).
4. A pagar: FOB menos o pago de cada pedido. Pago: tudo o que já foi pago ao fornecedor na moeda do FOB.
5. Na linha, "abertas" são as cotações ainda por responder. Sem o atalho de nova solicitação (isso é do cliente).
6. A ficha mostra Registros de compras, Pagamentos (atalho "Registrar pagamento" abre o pagamento ao fornecedor do pedido) e Informações do fornecedor, com nº da loja, condição de pagamento e dados bancários.
