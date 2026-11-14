# Entrega: canal, transportadora pelo porto e NF

Mapa do processo, etapa Entrega (E7?, E11, E12?, E13, E14 e E16). Decisões
do dono em 14/11/2026.

## Canal cinza ou vermelho pausa o pedido (E7?, E11)

- Quando o canal do despacho sai **vermelho ou cinza**, o pedido **pausa por
  tempo indeterminado** (`orders.pausedAt`, `pauseReason` =
  `channel_red` ou `channel_grey`).
- Os **administradores** recebem alerta. O aviso de canal de antes, para a
  Wellmix, continua.
- Pausado, nada anda: itens de etapa (envio e decisão) e passos do embarque
  e da certificação (envio e validação) recusam com `order_paused`.
- A tela do pedido mostra o aviso "Pedido pausado". **Só o administrador**
  retoma, com observação opcional registrada na auditoria
  (`order.paused` e `order.resumed`).
- Canal verde ou amarelo segue normalmente.

## Transportadora pelo porto de chegada (E12?, E13, E14)

- Cartão **Porto de chegada e transportadora** no pedido, para a Wellmix,
  do Embarque ao Transporte.
- A Wellmix informa o porto (`orders.arrivalPort`): Itapoá, Itajaí,
  Navegantes ou outro.
- A transportadora padrão vem de Configurações, pelo nome do cadastro:
  - **Itapoá → West Log** (`carrierItapoaName`);
  - **os demais → Edual** (`carrierDefaultName`).
- **Basta contratar no pedido.** O botão "Contratar <nome>" designa a
  transportadora em Parceiros do pedido, a mesma ação de sempre: as tarefas
  do Transporte passam a ela.
- Sem a transportadora cadastrada com esse nome, o cartão avisa para
  cadastrar ou ajustar o nome em Configurações.

## NF da mercadoria nacionalizada (E16)

O financeiro emite a NF no Sankhya. O portal registra o número e o arquivo
no passo **DANFE** do embarque, que passou a ser do **financeiro**: a
permissão "Numerário" (padrão: função financeiro) ou o administrador. Antes
era de qualquer login da Wellmix.

## Entrega no CD do comprador (E17?, E18)

- O sistema vê quem é o comprador. A Wellmix é o cadastro de cliente com o
  CODEMP do Sankhya (`purchaseOrderCustomer`).
- **Comprador ≠ Wellmix:** cartão **Entrega no CD do comprador** no pedido,
  para a Wellmix e a transportadora, do Desembaraço à Entrega. Mostra o
  comprador, o endereço de entrega do cadastro (com aviso se faltar), a
  transportadora e quem confirma: o comprador, no item "Recebimento
  confirmado" da etapa Entrega, que já existia.
- **Comprador = Wellmix:** a carga vai ao CD da Wellmix (cartão
  Recebimento).

## Qualidade no CD (E19, E19?, E22)

O dono não detalhou como a qualidade confere; ficou o padrão abaixo, para
confirmar.

- Função nova **Qualidade (CD)** e a ação **"Concluir a conferência da
  qualidade no CD"** (Equipe → Funções e acessos, módulo Entrega). Sem
  ninguém com a ação na equipe, a Wellmix conclui, como antes; o
  administrador sempre pode.
- No cartão **Recebimento**, quadro **Qualidade (CD)**: depois da contagem
  por SKU (que já existia), a qualidade conclui.
  - **Sem divergência:** o produto fica **armazenado** (`storedAt`) e vendas
    é avisada.
  - **Com divergência:** a observação é obrigatória, Compras (analista e
    "Acompanhar o recebimento") é avisada, e o pedido segue a trilha do lote.
- Pendência **"Conferir a carga no CD"** (grupo Qualidade) com a descarga
  registrada e a conferência por concluir.
- Dados: em `receivings`, `qualityResult` (`ok`/`divergent`),
  `qualityAt`, `qualityByUserId`, `qualityNote` e `storedAt`.

## Fica para depois

- Lote com divergência (E21, E24 a E27: comunicar Compras → Fornecedor →
  Evidência → Financeiro). Está com a sessão "Overview com entidades e
  timeline".

Código: `src/lib/services/delivery.ts`, ações em
`src/app/app/actions/delivery.ts`. Teste: `tests/unit/delivery.test.ts`.
