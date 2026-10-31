# Fluxo de compras: Fase B

Comparação com os fluxos BPMN da Wellmix (Força de compras / Inspection). O que a Fase B acrescenta ao portal.

## Despachante na ficha da cotação

Na parte "Despachante" da ficha de compra (cotação e pedido), além de NCM, II e IPI:

- **Dumping** (Sim/Não) e observação. Com "Sim":
  - o gerente de produto e o comprador recebem aviso (sem ninguém com a função, os admins);
  - a escolha do fornecedor (seleção direta ou envio para aprovação) fica bloqueada (`dumping_release_required`) até alguém com a função **gerente de produto** ou **comprador** (ou admin) clicar em **Liberar dumping** na cotação;
  - marcar de novo depois de liberado anula a liberação.
- **Média (US$)**: na recompra, se a média mudou em relação à ficha mestre do produto, a diretoria de compras recebe alerta para o despachante esclarecer.
- **Precisa de certificação** (Sim/Não) e qual certificação. A Fase F usa isso para o fluxo do OCP.

Tudo é registrado na auditoria (`dumping.flag`, `dumping.release`, `average.changed`).

## Fotos HD e faca (die cut)

A ficha aceita mais dois tipos de foto, opcionais: **Foto em alta (HD)** e **Faca (die cut)**. Não contam para "ficha completa". Só a Wellmix as adiciona na ficha (a faca vem do briefing de embalagem da agência): o fornecedor vê na sua ficha apenas as 5 fotos obrigatórias, os blocos dele (Fornecedor, Produto, Caixa, Preço, Programação) e o container do cálculo só para ver; Despachante e Descrição para e-commerce são da Wellmix e não aparecem para ele.

## Validações da Wellmix na Preparação

A etapa Preparação passou a ter, além da ficha do fornecedor, duas confirmações da Wellmix (obrigatórias):

1. **Ficha e imagens validadas pelo comprador**.
2. **Cadastro do produto validado (cadastro)**.

A etapa só conclui (e o pedido só vai para Arte e embalagem) depois das duas. Se a linha de produto tiver requisitos próprios, as validações entram também.

## Compra para estoque (sem cliente)

Na nova solicitação, a Wellmix escolhe **Compra para estoque (sem cliente)** no lugar do cliente. O portal usa a empresa interna "Estoque Wellmix" (id `wellmix-estoque`, criada na primeira vez). Diferenças:

- não há sinal nem proposta ao cliente;
- escolhido o fornecedor (e, se ligada, aprovado em todos os níveis), o **pedido nasce na hora**;
- a solicitação mostra o selo "Compra para estoque".
