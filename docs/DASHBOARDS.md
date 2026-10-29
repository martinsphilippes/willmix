# Auditoria e painéis por área (Fase G)

## Auditoria (`/app/audit`)
- **Quem vê**: admin e quem tem a função diretoria de compras ou diretoria executiva. O link fica no menu do admin e no topo dos painéis.
- **Filtros**: período, módulo (prefixo da ação: solicitações, cotações, aprovações, pedidos, pagamentos, documentos, dumping, produção, embarque, recebimento, artes, equipe, configurações), pessoa, nº do pedido (traz o pedido e a solicitação dele) e texto.
- **Cada linha**: quando, quem, ação, resumo com link para a tela, e o antes/depois quando a ação gravou.
- **Limite**: a camada de dados só filtra por igualdade. Por isso a tela lê as 3.000 entradas mais recentes (já filtradas por pessoa ou pedido, quando informados) e filtra o resto em memória, 100 por página. Quando chega ao teto, a tela avisa.

## Painéis por área (`/app/dashboards`, só a Wellmix)
Números calculados na hora; cada um leva à tela onde se age. Abaixo, os pedidos que pedem atenção.

| Área | Indicadores |
|---|---|
| Compras | solicitações abertas, aguardando cotação, a escolher fornecedor, aprovações pendentes, dias médios para aprovar, taxa de reprovação, seguradas por dumping |
| Produção | pedidos acompanhados, follow vencido, atraso informado, ETD alterado, variação média do ETD, % de SKUs reprovados |
| Embarque e desembaraço | em embarque/desembaraço/transporte, passos aguardando validação, recusados, canais verde/amarelo/vermelho-cinza |
| Recebimento | abertos, com divergência, lacre violado, container sem devolução |
| Certificação e artes | certificações em andamento, registros obtidos, artes não conformes, correções aguardando aceite, dias médios para corrigir |
| Financeiro | sinais a confirmar, pagamentos a fornecedor pendentes, numerários a validar (quantidade e valor), pedidos sem lançamento no ERP |

## Sankhya
A integração real depende das credenciais. Até lá:
- o pedido segue em modo manual (o número do ERP é informado no pedido);
- o painel financeiro conta os pedidos com lançamento pendente ou com falha.
