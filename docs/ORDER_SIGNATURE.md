# Documento do pedido com duas assinaturas

Racional do dono (10/11/2026): depois das duas confirmações (a Wellmix selecionou; o fornecedor deu OK na embalagem, docs/QUOTE_FLOW.md), o pedido tem um **documento assinado pelas duas partes**. Decisões do dono: assinam **o fornecedor e a Wellmix**. O fornecedor **baixa o documento em PDF, assina e anexa de volta** no portal (correção do dono, 10/11); o **aceite no portal** continua como opção.

## 1. Problema

O pedido nascia e seguia para a produção sem um registro de que as duas partes concordaram com o mesmo conteúdo (produto, quantidade, preço, prazo, pagamento).

## 2. Como funciona

1. Todo pedido novo nasce com dois itens obrigatórios:
   - **Documento do pedido assinado pela Wellmix**, na etapa "Pedido criado";
   - **Documento do pedido assinado pelo fornecedor**, o primeiro item da Preparação.
2. Os dois levam à página **Documento do pedido** (`/app/orders/{id}/purchase-order`): comprador, fornecedor, itens (quantidade, preço por unidade, total), incoterm, prazo de produção, condição de pagamento e, quando houve, a proposta de embalagem com o OK do fornecedor.
3. **A Wellmix assina primeiro**; o fornecedor é avisado ("sua vez") e **assina em seguida**. Sem a assinatura da Wellmix, o fornecedor não assina.
4. **Fornecedor, por PDF**: na página há "Baixar o documento em PDF" (rótulos em inglês e português, com a versão no rodapé e o quadro de assinatura). Ele assina, carimba e **anexa o arquivo assinado** (PDF ou foto) no mesmo formulário. O arquivo fica guardado no pedido como interno: só a Wellmix e quem o enviou abrem (tem o preço de compra). Sem arquivo, vale o aceite. Arquivo errado ou ilegível: o **administrador devolve a assinatura** com o motivo (enquanto a Preparação está aberta) e o fornecedor assina de novo.
5. **Depois das duas assinaturas o pedido vai ao Sankhya** (antes ia ao nascer): com a integração ligada, o número volta sozinho; sem ela, a Wellmix recebe "pedido autorizado: gere-o no Sankhya e informe o número". A página mostra a situação: pronto para assinatura (esperando a Wellmix) → enviado ao fornecedor → assinado pelos dois (pedido autorizado) → gerado no Sankhya.
6. O documento traz também o **MOQ** combinado (da cotação ou da ficha).
7. Aceite no portal = digitar o **nome completo**, marcar **"Li e concordo"** e tocar em Assinar. O sistema grava o nome digitado, o login, a data e a hora e a **versão exata do documento** (impressão digital SHA-256 do conteúdo). É um aceite no portal, **não um certificado digital**.
8. **O pedido só segue com as duas**: "Pedido criado" não conclui sem a da Wellmix; a Preparação não conclui sem a do fornecedor.
9. Os itens de assinatura não têm o "Confirmar" comum (`signature_required`): só a página do documento os conclui.
10. Se o pedido mudar depois de uma assinatura (quantidade, preço…), a versão muda e a tela avisa que aquela assinatura é de uma **versão anterior**. Se mudar enquanto a pessoa lê, o envio é recusado e ela relê (`signature_document_changed`).
11. **Assinatura recebida por fora** (papel, e-mail): só o **administrador** registra, com o nome de quem assinou pelo fornecedor; fica marcado quem registrou.
12. A página imprime (Ctrl/⌘ + P) para guardar em PDF.

## 3. Casos especiais

- **Pedidos antigos** (de antes desta mudança) não têm os itens: seguem como estavam e o documento fica só para consulta.
- Pedido cancelado ou encerrado: não aceita assinatura.
- Compra para estoque: vale igual (o fornecedor é o mesmo tipo de parte).

## 4. Papéis e permissões

- O documento tem o **preço de compra**: só a **Wellmix** e o **fornecedor do pedido** abrem. Cliente, outro fornecedor e demais parceiros recebem "não encontrado".
- Wellmix: qualquer login da equipe com a tela Pedidos assina pela Wellmix (em aberto: restringir a quem tem alçada, por função).
- Fornecedor: o login do fornecedor do pedido.

## 5. Dados

Sem coluna nova: a assinatura fica no próprio item da etapa (`requirements.value`, JSON `{side, name, userId, userName, at, hash, method: accept|file, documentId?, onBehalf?}`). Não precisa publicar esquema.

## 6. Auditoria e avisos

`order.signed` (quem, nome digitado, versão, se foi por arquivo; e quem registrou, quando veio por fora), `order.signature_reopened`, `order.erp_sync` e `requirement.submit`. Avisos: ao fornecedor quando a Wellmix assina; à Wellmix quando o fornecedor assina.

## 7. Código

`src/lib/services/order-signature.ts`, `src/app/app/actions/order-signature.ts`, `src/app/app/orders/[id]/purchase-order/page.tsx`, o PDF em `src/app/api/orders/[id]/purchase-order/route.ts` e `src/lib/simple-pdf.ts` (gerador sem dependências; caracteres fora do alfabeto latino são omitidos no PDF), chaves em `src/lib/workflow/stages.ts` (`ORDER_SIGNATURE_KEYS`) e a trava em `submitRequirement`. Testes: `tests/unit/order-signature.test.ts` e o E2E do caminho principal.

## 8. Melhorias futuras

- Assinatura com validade jurídica por serviço externo (Clicksign, DocuSign) quando contratado.
- Alçada por função para a assinatura da Wellmix e reassinatura obrigatória quando o documento muda.
- Guardar o PDF gerado junto ao pedido e lembrete por prazo ao fornecedor.
