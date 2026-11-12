# Amostragem da solicitação ao fornecedor

Pedido do dono (12/11/2026, acompanhando a solicitação nº 1): depois do aceite da Wellmix (solicitação **Aprovada**), abre-se a etapa de **Amostragem** do lado do **responsável pelo booking** do item escolhido (o fornecedor da solicitação, docs/SUPPLIER_REQUESTS.md, "Regras da solicitação" 2). Ele envia **fotos e vídeos de uma amostra** do item e o time da Wellmix **valida**.

## Fluxo

1. **Abre na aprovação** (`decideSupplierRequest` com "approved" grava `sampling` pendente e avisa o responsável: sino, e-mail e WhatsApp em modo mock, com o link `?view=item#amostragem`). A solicitação aprovada antes desta etapa (ex.: a nº 1) fica com a amostragem **pendente** sem precisar de ajuste no banco (`samplingOf` lê a aprovada sem `sampling` como pendente, aberta na data da decisão).
2. **O responsável sobe os arquivos** no cartão **Amostragem** da tela do produto da solicitação: um por vez, foto (JPG, PNG, WEBP, HEIC) ou vídeo (MP4, MOV, WEBM, 3GP), até **50 MB** e até **30 por rodada**. Até ~4 MB o arquivo vai no formulário; acima disso sobe direto ao armazenamento (`FileAutoInput`, o mesmo envio da arte da embalagem) e a ação só registra o documento. Enquanto não envia, pode **tirar** um arquivo da rodada (o documento fica guardado).
3. **Envia para a validação** (com observação opcional; pede ao menos um arquivo). A Wellmix (quem abriu a solicitação) é avisada.
4. **A Wellmix valida**: **aprovar** ou **reprovar** com o motivo (obrigatório). Precisa da ação **"Validar a amostragem"** (`sampling.validate`, Equipe → Funções e acessos; padrão: quem abre Cotações, como "Decidir a solicitação").
5. **Reprovada**: o responsável é avisado com o motivo e abre-se a **rodada seguinte**; os arquivos da reprovada ficam em "Rodadas anteriores". **Aprovada**: fim da etapa.

Só o responsável envia (a Wellmix, mesmo admin, não envia por ele: `sampling_supplier_only`); outro fornecedor não vê (404). Os arquivos são documentos com `supplierRequestId`: só a Wellmix e o fornecedor da solicitação abrem (`canAccessDocument`). Vídeo toca na própria tela (`/api/files` responde por pedaços).

## Decisões do dono (12/11/2026)

1. **Bloqueia até a aprovação**: criar ou associar o produto e gerar o pedido de compra só depois da amostra aprovada. Na tela, o bloco Produto dá lugar ao aviso "O produto (criar ou associar) e o pedido de compra ficam liberados depois que a Wellmix aprovar a amostra"; o serviço recusa (`request_product_sampling_pending`) e a lista do pedido de compra não traz a solicitação sem amostra aprovada (`purchase_order_sampling_pending` se vier assim mesmo). Regra em `samplingApproved` (`src/lib/supplier-request-sampling.ts`).
2. **Prazo padrão de 1 dia** (Configurações → SLA → "Prazo da amostragem (dias)", `samplingSlaDays`, de 1 a 30): conta da abertura da amostragem (aprovação da solicitação) ou da última reprovação até o responsável enviar. O cartão mostra "Prazo: …" e, passado, "Atrasada" (também no selo da tabela); a pendência do fornecedor ganha o prazo; o aviso de atraso sai **uma vez por rodada** ao responsável e a quem abriu (`notifyLateSampling`, ao abrir as telas das solicitações e no job diário `/api/jobs/reminders`; `sampling.lateNotifiedAt`).
3. **Sem amostra física**: a amostra é feita em **impressora 3D** e não é enviada; só vão as fotos e os vídeos dela. Os textos da tela dizem isso ao responsável.

## Onde aparece

- **Tela do produto** (`/app/supplier-requests/[id]?view=item`): cartão **Amostragem** no topo (situação, rodada, fotos e vídeos, envio, validação e histórico).
- **Tabela da solicitação**: na coluna Situação, o selo "Amostragem: …" com link para o cartão.
- **Linha do tempo**: envio, aprovação e reprovação da amostra.
- **Pendências**: do fornecedor, na nova etapa **"Enviar a amostragem"** (`supplier.sampling`, depois de "Responder a solicitação"), enquanto pendente ou reprovada; da Wellmix com a ação, **"Validar amostragem"** (`sampling_validate`) enquanto enviada.

Situações: `pending` (esperando a amostra) → `submitted` (esperando a validação) → `approved` ou `rejected` (volta a esperar a amostra, rodada + 1).

## Banco

`supplier_requests.sampling` (JSON grande, opcional): `status`, `round`, `openedAt`, `files` (`documentId`, `fileName`, `mime`, `kind` photo/video, `round`, `at`, `byUserId`), `history` (`open`/`submit`/`approve`/`reject`, com lado, rodada, texto e nº de arquivos), `submittedAt`, `reviewedAt`, `reviewedByUserId`, `lateNotifiedAt`. Auditoria: `sampling.file`, `sampling.file_remove`, `sampling.submit`, `sampling.approve`, `sampling.reject`.

## Onde está

| Parte        | Arquivo                                                     |
| ------------ | ----------------------------------------------------------- |
| Regras puras | `src/lib/supplier-request-sampling.ts`                      |
| Serviço      | `src/lib/services/supplier-request-sampling.ts`             |
| Ações        | `src/app/app/actions/supplier-requests.ts` (fim do arquivo) |
| Tela         | `src/app/app/supplier-requests/_components/sampling.tsx`    |
| Textos       | `src/i18n/modules/sampling.ts`                              |
| Testes       | `tests/unit/supplier-request-sampling.test.ts`              |
