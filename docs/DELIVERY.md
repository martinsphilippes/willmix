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

## Fica para depois

- Lote com divergência (E21, E24 a E27: comunicar Compras → Fornecedor →
  Evidência → Financeiro). Está com a sessão "Overview com entidades e
  timeline".
- Entrega no CD do comprador quando ele não é a Wellmix (E17?, E18) e a
  conferência pela qualidade (E19, E19?).

Código: `src/lib/services/delivery.ts`, ações em
`src/app/app/actions/delivery.ts`. Teste: `tests/unit/delivery.test.ts`.
