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

## 2a. A folha do pedido no modelo da Wellmix

O dono enviou (10/11/2026) o modelo do pedido assinado pelo fornecedor. O PDF que o fornecedor baixa e a página do documento passaram a seguir esse modelo (folha deitada):

1. **Cabeçalho**: nome da empresa, Order Issued by (analista responsável), Date of issuance, On (quando o arquivo foi gerado), Lote (`número-ano`, o ano do ETD ou, sem ele, o da emissão), Partner, Forwarding Agent (o agente de carga do pedido, com o e-mail), Incoterm, Payment Condition, Order print by (quem baixou), Date ETD (da Produção), Purchase Order (o número no Sankhya, quando existe), WELLMIX Number (o número do pedido no portal), Commission % e Sent to partner on (quando a Wellmix assinou). No canto, os dois quadros de assinatura: o do fornecedor em cima (para assinar e carimbar no papel) e o da Wellmix embaixo.
2. **Cada item em duas faixas**: identificação (item, contato, foto, arte, Pantone, código da fábrica, trading, código Wellmix, EAN, DUN master, DUN inner, descrição, descrição em português, pilhas, NCM, LI) e, embaixo, embalagem, medidas da peça em metros, CBM da caixa master e total, pesos líquido e bruto (por peça e do pedido), peças por inner e por master, total de caixas, total de peças, preço e valor. Depois, "Comments / Specifications" do item e "Factory".
3. **Totais**: CBM, peso líquido, peso bruto, valor, comissão e valor com comissão. Depois o quadro geral "Comments /Specifications" (com o MOQ, o prazo de produção e a proposta de embalagem aprovada).
4. **WELLMIX PROCEDURES**: página própria com o texto padrão (`src/lib/order-procedures.ts`).

Os valores vêm da ficha do pedido (`purchase_sheets`), da variação pedida e do cadastro do produto, nessa ordem. Caixas e totais só são calculados com a quantidade em peças; um total só aparece quando todos os itens têm o dado (total parcial enganaria).

**Campo sem dado fica em branco, nunca inventado.** Hoje ficam em branco, por não existirem no portal: foto na folha, Trading Code, EAN, DUN master e inner, medidas da embalagem da peça, LI, comissão. A página "Shipping Mark" do modelo (as marcas de embarque por linha) ainda não sai no PDF.

A folha é **apresentação**: a versão que as partes assinam (a impressão digital) continua sendo o conteúdo comercial do `OrderDocument` (produto, quantidade, preço, total, incoterm, MOQ, prazo, pagamento, embalagem). Preencher a ficha depois da assinatura muda a folha, não a versão assinada.

## 2c. Ordem nova: a assinatura vem depois da arte e do selo (10/11/2026)

Decisão do dono: a assinatura do documento sai do começo do pedido e vai para **depois da arte**. A tela de assinatura não muda; muda a ordem das etapas.

**Caminho** (etapa "Arte e embalagem"):

1. O fornecedor manda a faca (die-cut); a agência faz a arte e envia (item "Arte da embalagem").
2. A certificadora envia o selo e quem fez a arte aplica o selo na arte (cartão Certificação, passos `cert_seal` e `cert_seal_art`).
3. Quem fez a arte aperta **"Enviar para assinatura"** (item `order_sign_send`, "Documento do pedido enviado para assinatura"). A Wellmix também pode apertar.
4. A Wellmix assina; o fornecedor assina em seguida (as duas formas da seção 2b). A etapa só conclui com as duas assinaturas e a arte aprovada pelo fornecedor.

**Regras**

- **Trava (decisão do dono)**: o envio só é aceito com a arte enviada **e** o selo já aplicado nela (a arte com o selo enviada e não recusada). Sem um deles, o botão não aparece e a linha diz o que falta; a tentativa é recusada com `sign_send_art_required` ou `sign_send_seal_required` (`signSendBlockers`).
- Antes do envio ninguém assina (`signature_not_sent`); o documento aparece como **"Em preparação"** (`awaiting_send`). O fornecedor vê o aviso de que assina depois da arte e do selo.
- Quem envia: o papel do item "Arte" (`artRole`: a agência do pedido; sem agência, a Wellmix). A Wellmix sempre pode. Ao enviar, a Wellmix recebe o aviso para assinar.
- Pendências: o envio só vira pendência com a arte enviada e o selo aplicado; a assinatura da Wellmix, depois do envio; a do fornecedor, depois da Wellmix.
- Tabela "Etapas do pedido": a linha "Documento do pedido (assinaturas)" fica debaixo de "Arte e embalagem", depois de "Artes da embalagem" e antes de "Produção e inspeção".
- Booking: linha que virou pedido mostra "Pedido: arte e selo" (`prepare_document`) até o envio; depois, "assinar documento".
- O pedido só vai ao Sankhya depois das duas assinaturas (como antes), agora mais adiante no fluxo.
- **Pedidos criados antes desta decisão** guardam os itens onde nasceram (Wellmix em "Pedido criado", fornecedor na Preparação), não têm o item de envio e seguem como eram, inclusive a liberação automática da seção 2b.
- Sem mudança de esquema: os itens são linhas de `requirements` criadas quando o pedido nasce.

## 2b. As duas formas de o fornecedor assinar (10/11/2026)

Correção do dono: o fornecedor baixava o PDF e não achava onde devolver assinado. Três causas, três consertos:

- **A assinatura da Wellmix libera o pedido.** O item "Pedido conferido e liberado ao fornecedor" (`ORDER_CONFIRMED`, mesma etapa da assinatura dela) conclui junto, em nome de quem assinou (`releaseOrderBySignature`). Antes, sem esse item marcado à parte, a Preparação não abria: o fornecedor era avisado para assinar e a tela não mostrava onde. Pedido que já estava assim é liberado ao abrir o documento; se a liberação não for possível, um aviso diz a cada lado o que falta (`supplierBlocked`).
- **Quadro "Sua vez de assinar" no topo**, com as duas opções lado a lado para o fornecedor: **1) assinar no portal** (nome + "li e concordo") e **2) enviar o documento assinado** (baixa o PDF, assina, carimba e escolhe o arquivo; escolher já registra a assinatura). A Wellmix vê só a opção do portal. O administrador continua registrando a assinatura recebida por fora, no quadro Assinaturas.
- **Arquivo grande** (foto do celular, PDF escaneado): acima de 4 MB sobe direto ao armazenamento (`FileAutoInput`, `uploadedFileId` → `signedFileKey`), sem passar pelo teto da requisição na Vercel. Só PDF ou foto; outro tipo é recusado e apagado.

## 3. Casos especiais

- **Pedidos antigos** (de antes desta mudança) não têm os itens: seguem como estavam e o documento fica só para consulta.
- Pedido cancelado ou encerrado: não aceita assinatura.
- Compra para estoque: vale igual (o fornecedor é o mesmo tipo de parte).

## 4. Papéis e permissões

- O documento tem o **preço de compra**: só a **Wellmix**, o **fornecedor do pedido** e a **certificadora do pedido** (só leitura) abrem. Cliente, outro fornecedor e demais parceiros recebem "não encontrado".
- Wellmix: qualquer login da equipe com a tela Pedidos assina pela Wellmix (em aberto: restringir a quem tem alçada, por função).
- Fornecedor: o login do fornecedor do pedido.
- **Certificadora do pedido** (10/11/2026): abre o documento só para ler (vê tudo do pedido para gerar o selo); não assina.
- **Fornecedor**: a lista de pedidos abre direto o documento; no alto, as pendências dele naquele pedido. O arquivo assinado (PDF ou foto, até 50 MB) sobe direto ao armazenamento quando é grande e fica guardado no pedido sem prazo.

## 5. Dados

Sem coluna nova: a assinatura fica no próprio item da etapa (`requirements.value`, JSON `{side, name, userId, userName, at, hash, method: accept|file, documentId?, onBehalf?}`). Não precisa publicar esquema.

## 6. Auditoria e avisos

`order.signed` (quem, nome digitado, versão, se foi por arquivo; e quem registrou, quando veio por fora), `order.signature_reopened`, `order.erp_sync` e `requirement.submit`. Avisos: ao fornecedor quando a Wellmix assina; à Wellmix quando o fornecedor assina.

## 7. Código

`src/lib/services/order-signature.ts`, `src/app/app/actions/order-signature.ts`, `src/app/app/orders/[id]/purchase-order/page.tsx`, o PDF em `src/app/api/orders/[id]/purchase-order/route.ts` e `src/lib/simple-pdf.ts` (gerador sem dependências; caracteres fora do alfabeto latino são omitidos no PDF), a folha no modelo em `src/lib/services/order-sheet.ts` (dados), `src/lib/order-sheet-layout.ts` (colunas e células, comum ao PDF e à tela), `src/lib/services/order-sheet-pdf.ts` (PDF deitado) e `src/components/order-sheet-view.tsx` (tela), chaves em `src/lib/workflow/stages.ts` (`ORDER_SIGNATURE_KEYS`) e a trava em `submitRequirement`. Testes: `tests/unit/order-signature.test.ts`, `tests/unit/order-sheet.test.ts` e o E2E do caminho principal.

## 8. Melhorias futuras

- Assinatura com validade jurídica por serviço externo (Clicksign, DocuSign) quando contratado.
- Alçada por função para a assinatura da Wellmix e reassinatura obrigatória quando o documento muda.
- Guardar o PDF gerado junto ao pedido e lembrete por prazo ao fornecedor.
- Folha do pedido: foto do produto e a página "Shipping Mark" no PDF (o gerador ainda não embute imagens); campos de EAN, DUN, trading, LI, comissão e medidas da embalagem da peça no cadastro; texto dos procedimentos editável nas Configurações.
