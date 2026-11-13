# Pedido de amostras (contrato secundário do pedido de compra)

Mapa do processo, etapa Pedido: P10 (regras de mix) e P17 (contratos secundários de amostras). Decisões do dono (13/11/2026):

- **Quantidade**: para cada produto do pedido, **5 × 3 × Nm** peças, onde Nm é o número de variantes ativas do produto (sem variantes cadastradas, conta 1). É a "regra de mix/assortment" do quadro; o "12+3" do quadro não representa nada.
- **Documento à parte** do contrato (documento do pedido), com aceite próprio do fornecedor.
- **Decidir sempre**: antes de a Wellmix assinar o contrato, ela gera o pedido de amostras ou marca "sem amostras". A assinatura espera.
- Destino das amostras: o show room no Brasil e a agência de marketing na China. A retirada e os envios (R12 a R15) são da etapa Produção e ainda não estão no portal.

## Como funciona

1. As raias concluem e o pedido chega ao contrato (etapa "Contrato e assinaturas").
2. A Wellmix abre **Pedido de amostras** (`/app/orders/{id}/samples`, atalho na linha do pedido e no documento do pedido) e:
   - **Gera o pedido de amostras**: as linhas saem pela regra (produto, variantes, peças) e o fornecedor é avisado; ou
   - **Sem amostras neste pedido** (motivo opcional): o aceite do fornecedor fica dispensado.
3. Só então a Wellmix assina o contrato (`signature_samples_pending`). No documento do pedido, ela vê o aviso com o atalho.
4. O fornecedor do pedido abre a mesma tela, confere e **aceita** (nome completo + "li e concordo"), sobre a versão que viu (`hash`). A Wellmix é avisada.
5. A etapa do contrato conclui com as duas assinaturas, o pedido de amostras aceito (ou dispensado) e o sinal (docs/PURCHASE_ORDER.md, seção 1a).

Cada rodada de uma programação de compra (pedido filho) tem o próprio contrato e o próprio pedido de amostras; a Wellmix marca "sem amostras" nas rodadas que não precisam.

## Itens e prazos

| Item | Quem | Depende de | Prazo |
| --- | --- | --- | --- |
| `sample_order` "Pedido de amostras definido" | Wellmix | início do contrato | `purchaseSignatureSlaDays` (2) |
| `sample_order_supplier` "Pedido de amostras aceito pelo fornecedor" | fornecedor | pedido de amostras gerado | `purchaseSignatureSlaDays` (2) |
| `order_signed_wellmix` | diretorias | `sample_order` | `purchaseSignatureSlaDays` (2) |

Os dois itens só concluem pela tela do pedido de amostras (`sample_order_required`).

## Dados

Sem tabela nem coluna nova: o documento (linhas, decisão, quem e quando, versão) fica no `value` do item `sample_order`; o aceite, no `value` de `sample_order_supplier`. Pedidos já abertos antes desta entrega não têm os itens e seguem como antes.

## Código

- Regras puras: `src/lib/sample-order.ts` (`sampleQuantity`, `sampleLines`, `sampleOrderHash`).
- Serviço: `src/lib/services/sample-order.ts`; ação: `src/app/app/actions/sample-order.ts`; tela: `src/app/app/orders/[id]/samples/page.tsx`.
- Ordem: `prerequisitesOf` em `src/lib/purchase-lanes.ts`; itens em `PURCHASE_CONTRACT_REQUIREMENTS` (`src/lib/workflow/stages.ts`).
- Textos: `src/i18n/modules/sample-order.ts`. Testes: `tests/unit/purchase-order.test.ts` e o E2E do caminho principal.
