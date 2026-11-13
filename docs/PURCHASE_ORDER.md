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

- **Programação de compra:** produtos com rodadas fazem do pedido o **pedido pai**; cada rodada nasce como pedido filho no dia combinado (docs/PURCHASE_SCHEDULE.md).

## 1a. Sequência e dependências (mapa do processo, 13/11/2026)

Decisões do dono (13/11/2026), a partir do mapeamento dos processos (etapa Pedido, passos P1 a P17): vale o mapa. As dependências bloqueiam: um passo só abre quando o anterior conclui, e nenhuma etapa conclui com um passo aberto.

```
Pedido gerado ──► Vendas avisada (P2 → V1)
   │
   ├─ Cadastro e fiscal: NCM validado (P9/P16) + Ficha mestre completa (P14) ──────────────┐
   ├─ Fornecedor: faca + foto em alta ──► Agência: arte ──► Wellmix valida ─┐               │
   │                 + MOQ + prazo                                          ├─► Arte final  │
   └─ Linha exige certificação? (P6) ──► Certificadora: certificado (P15) ──┘   com selo    │
         (certificação válida pelo período do pedido: não renova, P8)          (P7)        │
                                                                                            ▼
                     Contrato (P10) ──► Wellmix assina ──► Fornecedor assina (P11) ──► Sinal ou conta corrente (P12?/P12) ──► Produção (R1)
```

| Passo | Quem faz | Depende de | Prazo (Configurações → SLA) | Quem é avisado |
| --- | --- | --- | --- | --- |
| NCM validado (`ncm_validated__item`) | Cadastro e fiscal, na tela fiscal do produto | pedido gerado | `purchaseRegistrationSlaDays` (3) do pedido | Wellmix, no pedido gerado, com os produtos que faltam |
| Ficha mestre completa (`sheet_complete__item`) | Cadastro, na tela do produto (campos e 5 fotos) | pedido gerado | `purchaseRegistrationSlaDays` (3) do pedido | idem |
| Faca, foto em alta, MOQ, prazo | Fornecedor (quadro Die Cut) | pedido gerado | `purchaseDieCutSlaDays` (7) do pedido | fornecedor, no pedido gerado |
| Arte | Agência (sem ela, a Wellmix) | faca **e** foto em alta do produto | `purchaseArtSlaDays` (5) da faca/foto | agência, quando a faca e a foto chegam |
| Validação da arte | Wellmix (`art.validate`) | arte | `purchaseArtReviewSlaDays` (2) do envio | Wellmix, a cada envio |
| Certificado | Certificadora (sem ela, a Wellmix) | pedido gerado; só se a linha exige certificação | `purchaseCertSlaDays` (15) do pedido | certificadora, no pedido gerado |
| Arte final com o selo | Agência | arte validada **e** certificado; só se a linha exige certificação | `purchaseArtFinalSlaDays` (3) da liberação | agência, quando libera |
| Assinatura da Wellmix | Diretorias (`contract.sign`) | todas as raias concluídas | `purchaseSignatureSlaDays` (2) do início do contrato | responsável da etapa |
| Assinatura do fornecedor | Fornecedor | assinatura da Wellmix | `purchaseSignatureSlaDays` (2) da Wellmix | fornecedor |
| Sinal ou conta corrente (`down_payment`) | Financeiro (Contas a pagar) | as duas assinaturas | `purchaseDownPaymentSlaDays` (3) das assinaturas | financeiro, com as duas assinaturas; fornecedor, "produção liberada" |

- **Itens conferidos pelo sistema** (`AUTO_GATE_KEYS`, `src/lib/services/purchase-gates.ts`): NCM validado, ficha completa e sinal não têm botão; concluem quando a área dona faz a parte dela na tela dela (a linha do pedido mostra o atalho: "Validar o NCM do produto", "Completar a ficha do produto", "Pagamento ao fornecedor"). A conferência roda ao validar o NCM, salvar a ficha ou o cadastro do produto, subir fotos, registrar ou validar certificação, registrar, pagar ou confirmar pagamento, mudar a condição do fornecedor, assinar o contrato, no pedido gerado e no job diário.
- **Certificação pela linha (P6):** a linha com certificação exigida (`product_lines.requiredCertifications`) põe o certificado e a arte final com o selo; sem exigência, o pedido não tem esses itens, a certificadora não é avisada e a **arte validada vai direto ao contrato**.
- **Certificação válida (P8):** produto com certificação válida de cada tipo exigido até hoje + `certificationHorizonDays` (120, Configurações → Conformidade) tem o certificado concluído sozinho ("sem renovação"). Renovada no cadastro do produto, o item fecha sozinho.
- **Sinal ou conta corrente (P12?/P12; "CC" = conta corrente, dono 13/11/2026):** a condição de pagamento do pedido sem parcela no marco "pedido gerado" é conta corrente e a produção abre com as duas assinaturas. Com parcela no pedido gerado, ela é o sinal: só **paga** (pela Wellmix) ou **recebida** (confirmada pelo fornecedor) libera; pedida ao banco não. Sem condição configurada, o item espera o financeiro configurar.
- **Início da produção:** conta da liberação (sinal pago ou conta corrente) mais o prazo do fornecedor, não da assinatura. Os follows de 5/15/25 dias contam dele.
- **Assinatura pela Wellmix (dono, 13/11/2026):** só funções específicas, por padrão Diretoria de compras e Diretoria executiva; o administrador muda em Equipe → Funções e acessos (ação "Assinar o contrato pela Wellmix") e sempre pode.
- **Vendas (P2 → V1):** o pedido gerado avisa quem tem a ação "Receber o aviso de pedido de compra (Vendas)" (padrão: quem abre Pós-venda; sem ninguém, os administradores), com produtos e quantidades.
- **Control Tower:** "Cadastro: NCM validado e ficha completa" ao lado da Preparação e "Sinal ao fornecedor (libera a produção)" no Contrato.
- **Pedidos já abertos** antes desta entrega não ganham os itens novos (as etapas só criam o que falta na criação). A arte deles passa a esperar a faca e a foto em alta.

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
- **SLA** (Configurações → SLA, em dias corridos; todos os passos na seção 1a):
  - a arte de cada produto conta da faca e da foto em alta (`purchaseArtSlaDays`, padrão 5; antes de 13/11/2026, do pedido);
  - a validação da Wellmix conta do envio da arte (`purchaseArtReviewSlaDays`, padrão 2);
  - o prazo aparece em Minhas pendências e no Painel de SLA.
- **Avisos:**
  - arte enviada → a Wellmix valida;
  - arte validada e certificado emitido → a agência faz a arte final.
- **Passos do selo:** os passos do cartão Certificação (selo e arte com o selo) não viram pendência nestes pedidos, porque a certificação é a raia da certificadora.
- **Fim da etapa:** a etapa conclui quando todos os itens das três raias estão feitos.

## 2b. Quadro Die Cut (13/11/2026)

- **O que é:** os quatro itens do fornecedor (die-cut, foto em alta, pedido mínimo e prazo de entrega) juntos, produto a produto, em `/app/orders/{id}/die-cut`. São os mesmos requisitos da raia dele; a página do pedido continua mostrando cada um e ganha o atalho "Abrir o Die Cut".
- **Como chega:** em Minhas pendências, a etapa **Die Cut** do fornecedor traz uma linha por produto ("Die Cut: produto"); "Abrir" leva ao quadro, já no produto.
- **Pedido mínimo e prazo:** vêm com o negociado na solicitação ao fornecedor; ele confirma os dois de uma vez ou corrige. Enquanto a Preparação está aberta dá para corrigir de novo.
- **Depois de confirmar** (pedido do dono, 13/11/2026): o bloco troca o formulário por um resumo de leitura: o selo verde **Confirmado** no título, os valores salvos no formato do idioma ("132.000 peças · 15 dias") e quem confirmou, com a data (o envio mais recente dos dois). Sem o botão de confirmar e sem o "Confira os números". Enquanto a Preparação está aberta e quem vê pode enviar, **Editar** (botão secundário) abre o mesmo formulário com os valores salvos, com **Cancelar** para voltar ao resumo; fechada a etapa, só o resumo. O estado vem do registro salvo (os dois requisitos concluídos), então recarregar a página ou voltar ao quadro mostra o mesmo.
- **Envio:** o botão fica desativado enquanto grava (sem clique repetido). Se a gravação é recusada, a tela não muda: o erro aparece logo abaixo do formulário, o campo recusado fica marcado e o que foi digitado continua. Deu certo, a página volta com o aviso de salvo e o bloco no resumo. As regras de validação (pedido mínimo inteiro maior que zero; prazo de 1 a 720 dias) e o aviso à Wellmix quando o valor muda depois de completo são os mesmos.
- **Avisos à Wellmix:** quando os quatro itens de um produto ficam completos (com o valor negociado, se o confirmado saiu diferente) e a cada mudança posterior de pedido mínimo ou prazo, com o valor de antes.
- **Quem abre:** a Wellmix e o fornecedor do pedido.

## 2c. O que o fornecedor vê na seção da etapa (13/11/2026)

Na página do pedido, a seção "Preparação, arte e certificação" mostrava ao fornecedor as tarefas de todas as raias. Pedido do dono: ele vê **só três tarefas por produto**:

- **Faca (die cut)** e **Foto em alta resolução**, com os mesmos controles de envio.
- **Prazo de produção confirmado (dias)**: o campo já vem com o **prazo registrado para o item na solicitação ao fornecedor** (a resposta dele, com o que a negociação mudou: `supplierLeadTimeDays`, por `negotiatedTerms`). O preenchimento só traz o valor: ele confere, muda se quiser e aperta "Enviar", como antes. Sem prazo registrado, o campo fica vazio. Já confirmado nesta etapa, a linha mostra o valor confirmado.

O que muda e o que não muda:

- **Só a visão do fornecedor nessa seção.** MOQ, arte, validação da arte, certificado, arte final e qualquer outro item (um NCM ou um item a mais da linha do produto) deixam de aparecer para ele ali. A Wellmix e os outros papéis veem a seção como antes.
- **Nada some do pedido:** as tarefas de cada produto continuam existindo, obrigatórias, com as mesmas regras; a etapa só conclui com todas feitas.
- **MOQ:** continua sendo uma tarefa do fornecedor. Ele confirma no quadro Die Cut (o atalho "Abrir o Die Cut" continua na seção e fica em destaque enquanto faltar item), com o negociado já no campo; a Wellmix também pode confirmar.
- **Textos:** para o fornecedor, a ajuda da seção e a frase do atalho do Die Cut falam só das três tarefas (`dieCut.stageHelp.supplier`, `dieCut.orderHint.supplier`).
- **Regra** (`supplierSeesLaneRequirement`, `src/lib/purchase-lanes.ts`): uma lista fechada com as três chaves (`die_cut`, `hd_photo`, `lead_time_confirmed`) de cada item do pedido.

## 3. Contrato e assinaturas (etapa "Arte e embalagem")

- Concluída a Preparação, o sistema monta o **contrato**: o documento do pedido (`/app/orders/{id}/purchase-order`) com os dados, os produtos, o MOQ e o prazo negociados de cada um e a **arte final com o selo** de cada produto (sem certificação na linha, a arte validada).
- As duas partes **baixam o PDF, assinam, carimbam e sobem o arquivo**: primeiro a Wellmix, depois o fornecedor. Nestes pedidos não há o aceite no portal, só o arquivo (`signature_file_required`).
- **Com os dois arquivos o pedido vai ao Sankhya** (como no documento assinado de sempre). A etapa conclui com o sinal pago ou a conta corrente (seção 1a).

## 3b. Responsável pelo booking e fábrica (11/11/2026)

- O pedido sai em nome do **responsável pelo booking** (docs/BOOKING.md, "Responsável pelo booking"), que pode ser uma trading.
- O **contrato** mostra também a **fábrica que executa a produção**, ou seja, o fornecedor do booking, quando ela não é o fornecedor do pedido. A planilha do pedido traz a mesma linha "Manufacturer (production)".
- Nos pedidos do próprio fornecedor o documento não muda, e a versão assinada continua a mesma.

## 3a. Frete marítimo (11/11/2026)

- **Onde:** no pedido, cartão "Frete marítimo" (só a Wellmix). Até 11/11/2026 o frete nascia da cotação do fornecedor, que saiu.
- **Pedir o frete:** "Pedir frete às companhias marítimas" manda a carga do pedido a cada companhia marítima ativa (pendência + aviso). A carga é a soma dos itens: caixas, volume e peso da ficha de compra do pedido (pedido de um item) e do cadastro do produto (`orderCargo`).
- **Pedir de novo:** com a carga mudada, o frete já informado volta a "Aguardando valor" para a companhia revisar; sem mudança, nada muda.
- **Recusas:** sem companhia marítima ativa (`no_carriers`); sem caixas nem volume conhecidos (`no_cargo`).
- **Resposta:** a companhia informa valor, moeda, trânsito, validade e observação na tela do frete (`/app/freight/[id]`); a Wellmix é avisada no pedido. A companhia vê o número do pedido e os itens, nunca preço, fornecedor ou cliente.
- **Pedido cancelado:** os pedidos de frete em aberto são encerrados.
- **Dados:** `freight_quotes.orderId` (no lugar de `quoteId`).

## 4. Depois

Com o sinal pago (ou a conta corrente) a produção começa (seção 1a); as outras parcelas seguem a condição do fornecedor, fora do fluxo. Depois vem a inspeção, e o resto do fluxo é igual.

## Onde está

| Parte                                      | Arquivo                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Raias (regras puras: itens, ordem, prazos) | `src/lib/purchase-lanes.ts`                                                                                         |
| Gerar o pedido, avisos das raias, SLA      | `src/lib/services/purchase-order.ts`                                                                                |
| Itens conferidos pelo sistema              | `src/lib/services/purchase-gates.ts` (NCM, ficha, certificação válida, sinal)                                       |
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
