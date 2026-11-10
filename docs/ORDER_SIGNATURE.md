# Documento do pedido com duas assinaturas

Racional do dono (10/11/2026): depois das duas confirmações (a Wellmix selecionou; o fornecedor deu OK na embalagem, docs/QUOTE_FLOW.md), o pedido tem um **documento assinado pelas duas partes**. Decisões do dono: assinam **o fornecedor e a Wellmix**, por **aceite no portal**.

## 1. Problema

O pedido nascia e seguia para a produção sem um registro de que as duas partes concordaram com o mesmo conteúdo (produto, quantidade, preço, prazo, pagamento).

## 2. Como funciona

1. Todo pedido novo nasce com dois itens obrigatórios:
   - **Documento do pedido assinado pela Wellmix**, na etapa "Pedido criado";
   - **Documento do pedido assinado pelo fornecedor**, o primeiro item da Preparação.
2. Os dois levam à página **Documento do pedido** (`/app/orders/{id}/purchase-order`): comprador, fornecedor, itens (quantidade, preço por unidade, total), incoterm, prazo de produção, condição de pagamento e, quando houve, a proposta de embalagem com o OK do fornecedor.
3. **A Wellmix assina primeiro**; o fornecedor é avisado ("sua vez") e **assina em seguida**. Sem a assinatura da Wellmix, o fornecedor não assina.
4. Assinar = digitar o **nome completo**, marcar **"Li e concordo"** e tocar em Assinar. O sistema grava o nome digitado, o login, a data e a hora e a **versão exata do documento** (impressão digital SHA-256 do conteúdo). É um aceite no portal, **não um certificado digital**.
5. **O pedido só segue com as duas**: "Pedido criado" não conclui sem a da Wellmix; a Preparação não conclui sem a do fornecedor.
6. Os itens de assinatura não têm o "Confirmar" comum (`signature_required`): só a página do documento os conclui.
7. Se o pedido mudar depois de uma assinatura (quantidade, preço…), a versão muda e a tela avisa que aquela assinatura é de uma **versão anterior**. Se mudar enquanto a pessoa lê, o envio é recusado e ela relê (`signature_document_changed`).
8. **Assinatura recebida por fora** (papel, e-mail): só o **administrador** registra, com o nome de quem assinou pelo fornecedor; fica marcado quem registrou.
9. A página imprime (Ctrl/⌘ + P) para guardar em PDF.

## 3. Casos especiais

- **Pedidos antigos** (de antes desta mudança) não têm os itens: seguem como estavam e o documento fica só para consulta.
- Pedido cancelado ou encerrado: não aceita assinatura.
- Compra para estoque: vale igual (o fornecedor é o mesmo tipo de parte).

## 4. Papéis e permissões

- O documento tem o **preço de compra**: só a **Wellmix** e o **fornecedor do pedido** abrem. Cliente, outro fornecedor e demais parceiros recebem "não encontrado".
- Wellmix: qualquer login da equipe com a tela Pedidos assina pela Wellmix (em aberto: restringir a quem tem alçada, por função).
- Fornecedor: o login do fornecedor do pedido.

## 5. Dados

Sem coluna nova: a assinatura fica no próprio item da etapa (`requirements.value`, JSON `{side, name, userId, userName, at, hash, onBehalf?}`). Não precisa publicar esquema.

## 6. Auditoria e avisos

`order.signed` (quem, nome digitado, versão; e quem registrou, quando veio por fora) e `requirement.submit`. Avisos: ao fornecedor quando a Wellmix assina; à Wellmix quando o fornecedor assina.

## 7. Código

`src/lib/services/order-signature.ts`, `src/app/app/actions/order-signature.ts`, `src/app/app/orders/[id]/purchase-order/page.tsx`, chaves em `src/lib/workflow/stages.ts` (`ORDER_SIGNATURE_KEYS`) e a trava em `submitRequirement`. Testes: `tests/unit/order-signature.test.ts` e o E2E do caminho principal.

## 8. Melhorias futuras

- Assinatura com validade jurídica por serviço externo (Clicksign, DocuSign) quando contratado.
- Alçada por função para a assinatura da Wellmix e reassinatura obrigatória quando o documento muda.
- Guardar o PDF gerado junto ao pedido e lembrete por prazo ao fornecedor.
