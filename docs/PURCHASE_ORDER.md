# Pedido de compra (das solicitações ao fornecedor)

Decisão do dono (11/11/2026). O portal começa para uso interno: a vitrine ainda não é aberta ao público e o Booking antigo saiu. O caminho de hoje é:

1. Booking por planilha (docs/BOOKING.md, seção 0).
2. Seleção de itens.
3. Solicitação ao fornecedor e negociação (docs/SUPPLIER_REQUESTS.md).
4. Aprovação e cadastro do produto vencedor, ligado aos itens comparados na seleção.
5. **Pedido de compra.**

A solicitação do cliente (vitrine, tabela `requests`) e a reposição pedida pelo Sankhya vão seguir o mesmo processo de avaliação e negociação, mas sem criar produto. Ficam para depois.

## 1. Gerar o pedido

- **Onde:** em Solicitações ao fornecedor, no quadro **"Gerar pedido de compra"**. Só a Wellmix vê, e é preciso abrir a tela Pedidos.
- **Quais produtos entram:** os aprovados com produto cadastrado e ainda fora de pedido, agrupados por fornecedor.
- **Um pedido por fornecedor:** marque os produtos, ajuste a quantidade (vem a da solicitação) e gere.
- **Valores negociados:** preço, moeda, MOQ e prazo vêm da resposta do fornecedor. Todos os produtos precisam estar na mesma moeda (`purchase_order_currency_mixed`).
- **Limites e recusas:**
  - no máximo 30 produtos por pedido;
  - produto já em outro pedido é recusado (`purchase_order_taken`).
- **Comprador (cliente do pedido):** a própria Wellmix, a empresa que emite o pedido de compra no Sankhya (CODEMP das configurações do Sankhya, hoje 3: WELLMIX - SC). É o cadastro de **cliente** com esse código do Sankhya; o cadastro de fornecedor da mesma empresa não entra. Sem ele, a geração é recusada (`purchase_order_customer_missing`). Clientes terceiros só virão com a vitrine.
- **O que fica no banco:**
  - o pedido grava `orders.flow = "supplier_request"` e uma solicitação própria (`requests.origin = "supplier_request"`, já "pedido"), porque todo pedido tem uma;
  - cada produto vira um item do pedido, com quantidade e preço negociado;
  - a solicitação ao fornecedor fica presa ao pedido (`supplier_requests.orderId`).
- **Ao nascer:** recebe a condição de pagamento do fornecedor e os parceiros padrão. Quando há uma só agência e uma só certificadora ativas, elas são designadas sozinhas.

## 2. As três raias (etapa "Preparação, arte e certificação")

"Pedido criado" conclui na hora. A Preparação abre com as três raias **em paralelo**, produto a produto: a chave de cada item leva o id do item do pedido, `chave__item`. Cada raia recebe o seu aviso.

| Raia                    | Quem                                           | Itens por produto                                                                                                                                     |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fornecedor              | o fornecedor do pedido                         | Faca (die cut), Foto em alta resolução, os itens a mais do checklist da linha do produto, MOQ confirmado (peças), Prazo de produção confirmado (dias) |
| Agência de arte         | a agência do pedido (sem ela, a Wellmix)       | Arte → **Validação da arte pela Wellmix** (aprova ou devolve com o motivo) → Arte final com o selo                                                    |
| Certificadora (Inmetro) | a certificadora do pedido (sem ela, a Wellmix) | Certificado                                                                                                                                           |

Regras:

- **Ordem dentro da raia:**
  - a Wellmix só valida a arte enviada;
  - **a arte final só sobe com a arte validada e o certificado** (`lane_prerequisite`);
  - a pendência só aparece quando o passo anterior está feito.
- **Devolver a arte:**
  - a arte volta para a agência, que recebe o aviso com o motivo;
  - a arte reenviada volta para a validação.
- **SLA** (Configurações → SLA, ambos em dias corridos):
  - a arte de cada produto conta do pedido (`purchaseArtSlaDays`, padrão 5);
  - a validação da Wellmix conta do envio da arte (`purchaseArtReviewSlaDays`, padrão 2);
  - o prazo aparece em Minhas pendências e no Painel de SLA.
- **Avisos:**
  - arte enviada → a Wellmix valida;
  - arte validada e certificado emitido → a agência faz a arte final.
- **Passos do selo:** os passos do cartão Certificação (selo e arte com o selo) não viram pendência nestes pedidos, porque a certificação é a raia da certificadora.
- **Fim da etapa:** a etapa conclui quando todos os itens das três raias estão feitos.

## 3. Contrato e assinaturas (etapa "Arte e embalagem")

- Concluída a Preparação, o sistema monta o **contrato**: o documento do pedido (`/app/orders/{id}/purchase-order`) com os dados, os produtos, o MOQ e o prazo negociados de cada um e a **arte final com o selo** de cada produto.
- As duas partes **baixam o PDF, assinam, carimbam e sobem o arquivo**: primeiro a Wellmix, depois o fornecedor. Nestes pedidos não há o aceite no portal, só o arquivo (`signature_file_required`).
- **Com os dois arquivos a etapa conclui.** O pedido vai ao Sankhya (como no documento assinado de sempre) e segue.

## 3a. Frete marítimo (11/11/2026)

- **Onde:** no pedido, cartão "Frete marítimo" (só a Wellmix). Até 11/11/2026 o frete nascia da cotação do fornecedor, que saiu.
- **Pedir o frete:** "Pedir frete às companhias marítimas" manda a carga do pedido a cada companhia marítima ativa (pendência + aviso). A carga é a soma dos itens: caixas, volume e peso da ficha de compra do pedido (pedido de um item) e do cadastro do produto (`orderCargo`).
- **Pedir de novo:** com a carga mudada, o frete já informado volta a "Aguardando valor" para a companhia revisar; sem mudança, nada muda.
- **Recusas:** sem companhia marítima ativa (`no_carriers`); sem caixas nem volume conhecidos (`no_cargo`).
- **Resposta:** a companhia informa valor, moeda, trânsito, validade e observação na tela do frete (`/app/freight/[id]`); a Wellmix é avisada no pedido. A companhia vê o número do pedido e os itens, nunca preço, fornecedor ou cliente.
- **Pedido cancelado:** os pedidos de frete em aberto são encerrados.
- **Dados:** `freight_quotes.orderId` (no lugar de `quoteId`).

## 4. Depois

Pagamento do sinal ao fornecedor e produção seguem como já estão no portal. O pagamento é a etapa fora do fluxo, pela condição do fornecedor. Depois vem a inspeção, e o resto do fluxo é igual. Revisar o sinal e a produção é a próxima etapa (ponto 9 do dono).

## Onde está

| Parte                                      | Arquivo                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Raias (regras puras: itens, ordem, prazos) | `src/lib/purchase-lanes.ts`                                                                                         |
| Gerar o pedido, avisos das raias, SLA      | `src/lib/services/purchase-order.ts`                                                                                |
| Etapas do pedido de compra                 | `src/lib/workflow/stages.ts` (`isPurchaseFlow`, `PURCHASE_CONTRACT_REQUIREMENTS`), `src/lib/workflow/engine.ts`     |
| Contrato                                   | `src/lib/services/order-signature.ts` (`finalArts`, arquivo obrigatório), `src/app/app/orders/[id]/purchase-order/` |
| Ação                                       | `src/app/app/actions/purchase-order.ts`                                                                             |
| Tela                                       | `src/app/app/supplier-requests/_components/purchase-order.tsx`                                                      |
| Textos                                     | `src/i18n/modules/purchase-order.ts`                                                                                |
| Testes                                     | `tests/unit/purchase-order.test.ts`; de ponta a ponta em `tests/e2e/booking-supplier-request.spec.ts` (passo 6)     |

## Banco

Só colunas opcionais e um valor novo de enum, nada é apagado:

- `orders.flow` (enum `supplier_request`);
- `supplier_requests.orderId` (índice `by_order`);
- `requests.origin` ganha `supplier_request`.
