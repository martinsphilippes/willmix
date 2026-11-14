# Documentos do embarque (pedido de compra)

Mapa do processo, etapa Embarque (R7, R21 a R23). Decisão do dono em
14/11/2026: **o despachante não faz nada nestes documentos**; vale o mapa.
Tela: pedido → cartão **Documentos do embarque** →
`/app/orders/<id>/shipping-docs`.

## Sequência

| #   | Documento           | Quem faz                                                         | Abre quando                                                           | Conferência                                                                                                               |
| --- | ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Check list de carga | Fornecedor                                                       | Fotos/vídeos do container vazio enviados (cartão Container na origem) | Em cada item, as caixas que subiram no container, abatendo do pedido até zerar. Não aceita mais caixas do que faltam.     |
| 2   | Packing list        | Fornecedor                                                       | Check list completo                                                   | As caixas vêm do check list (não são digitadas); ele confere peças, peso líquido e bruto. Arquivo opcional.               |
| 3   | Invoice             | Trading (entra com o login do fornecedor do pedido)              | Packing list enviado                                                  | Linha a linha com o packing list. Não bateu: fica "Não bateu: refazer", a trading recebe aviso com as diferenças e refaz. |
| 4   | BL                  | Companhia marítima do pedido (sem marítima designada, a Wellmix) | Invoice conferida                                                     | Linha a linha com a invoice. Não bateu: a marítima é avisada e refaz.                                                     |

Conferência (decisão do dono): **caixas, peças, peso líquido e peso bruto,
linha a linha** (item a item). Peso bate até o centésimo de kg. Item que
falta ou sobra também é diferença.

Caixas esperadas por item = quantidade ÷ caixa master do cadastro (variante,
senão produto), arredondando para cima. Item sem caixa master no cadastro:
o check list aceita qualquer número de caixas (o item precisa ter ao menos
uma) e a tela avisa "sem caixa master no cadastro".

## O que muda no resto do pedido

- **BL conferido** conclui sozinho o passo "BL" do desembaraço (com o número
  e o arquivo), e a presença de carga segue normalmente.
- No pedido de compra **não aparecem** os passos antigos "Draft do BL",
  "Invoice e packing list" e "Invoice assinada" (do despachante e do agente);
  o passo "BL" fica só leitura (vem desta tela). Os pedidos clássicos
  continuam como antes.
- **Embarque confirmado** (etapa Embarque) só é aceito com o container
  lacrado no porto (`container_at_port`) e o BL conferido
  (`orders.error.shipping_docs_required`).

## Avisos e pendências

- Carga completa → fornecedor: fazer o packing list.
- Packing list enviado → fornecedor/trading: fazer a invoice.
- Invoice não bateu → trading: refazer (com o número de diferenças).
- Invoice conferida → marítima (ou a Wellmix): fazer o BL.
- BL não bateu → marítima: refazer.
- BL conferido → Wellmix: documentos conferidos, embarque pode ser confirmado.

Em Pendências cada documento aberto aparece para quem o faz (grupo Embarque
do fornecedor), com link direto para o cartão.

## Dados

Tabela `shipping_docs` (uma linha por pedido e documento: `load`,
`packing_list`, `invoice`, `bl`): `lines` (item, caixas, peças, pesos e,
na invoice, preço), `entries` (lançamentos do check list), `mismatches`
(diferenças da última conferência), `status`
(`draft`/`submitted`/`accepted`/`rejected`), `number`, `containerNumber`,
`documentId`, `version`. Regras puras em `src/lib/shipping-docs.ts`; serviço
em `src/lib/services/shipping-docs.ts`; ações em
`src/app/app/actions/shipping-docs.ts`.

## Fica para depois

- Fatura do fornecedor com N dias fixos por fornecedor contados dos
  documentos conferidos (pendência do financeiro).
