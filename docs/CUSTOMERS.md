# Clientes

Tela Cadastros → Clientes (`/app/customers`), ao lado da lista de Empresas (que continua igual).

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
