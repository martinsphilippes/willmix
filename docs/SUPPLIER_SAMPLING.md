# Amostragem da solicitação ao fornecedor

> **22/11/2026:** a amostragem passou a poder começar desde o começo da cotação do item, o fornecedor conhecido do produto pula a etapa e só vence a cotação quem tem a amostra aprovada. Veja "Amostragem desde a cotação", no fim. O que está abaixo continua valendo para a solicitação aprovada.

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

- **Tela do produto** (`/app/supplier-requests/[id]?view=item`): cartão **Amostragem** no topo (situação, rodada, fotos e vídeos, envio e validação). O bloco "Histórico da amostragem" saiu do cartão em 13/11/2026 (pedido do dono: repetia o painel "Histórico de interações", que continua com os envios, as validações e os comentários; `sampling.history` segue gravado).
- **Tabela da solicitação**: na coluna Situação, o selo "Amostragem: …" com link para o cartão. Na coluna **Vez** (dono, 24/11/2026; docs/TURNS.md), a aprovada com a amostra pendente ou reprovada mostra "Aguardando fornecedor · Enviar a amostragem" e, para a Wellmix, quem age (o nome; o login no balão, só para o administrador); a enviada, "Aguardando Wellmix · Validar a amostragem"; a amostra aprovada, "—". Antes, a aprovada aparecia com "—" mesmo com a amostra pendente. A lista de cotações usa a mesma regra.
- **Linha do tempo**: envio, aprovação e reprovação da amostra.
- **Pendências**: do fornecedor, na nova etapa **"Enviar a amostragem"** (`supplier.sampling`, depois de "Responder a solicitação"), enquanto pendente ou reprovada; da Wellmix com a ação, **"Validar amostragem"** (`sampling_validate`) enquanto enviada.

Situações: `pending` (esperando a amostra) → `submitted` (esperando a validação) → `approved` ou `rejected` (volta a esperar a amostra, rodada + 1).

**Aba da lista de cotações** (dono, 24/11/2026): a solicitação aprovada com a amostra ainda não aprovada (pendente, enviada ou reprovada) fica em **Em andamento**, não em Encerradas, até a amostra ser aprovada; a dispensada conta como aprovada, e a que já está num pedido de compra, como encerrada (`requestClosed`, `src/lib/supplier-request-closing.ts`).

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

## Amostragem desde a cotação (dono, 22/11/2026)

Regras confirmadas pelo dono:

1. **Começa junto com a cotação do item.** O fornecedor não espera a decisão da Wellmix para fazer a amostra.
2. **Todos os que responderam enviam.** Na cotação com vários fornecedores, cada um envia a amostra de cada produto.
3. **Fornecedor conhecido do produto pula a amostragem.** Conhecido é quem já vendeu aquele produto à Wellmix (o mesmo critério da ficha técnica: pedido de compra não cancelado com o produto, ou o vínculo do Sankhya com a última compra; `soldBeforeProducts`). No book, que é produto novo, sempre há amostragem.
4. **A trava continua.** Para quem não é conhecido, o produto (criar ou associar) e o pedido de compra seguem bloqueados até a amostra aprovada.
5. **Só vence quem tem a amostra aprovada**, ou é conhecido do produto.
6. **Fotos para fazer a amostra.** Produto da base: o fornecedor vê as fotos do cadastro do produto desde o convite da cotação. Book: ele vê a foto do item do book na solicitação (já era assim).

### Na cotação de compra (encomenda e reposição)

- Na cotação dele (`/app/purchase-quotes/[id]`), o card **"Fotos do produto e amostragem"** mostra, por produto, as fotos do nosso cadastro e o cartão da amostragem (subir fotos e vídeos, enviar para a validação). O conhecido do produto vê o aviso de que não precisa enviar.
- A amostragem fica na resposta do fornecedor, por produto (`purchase_quote_responses.sampling`, coluna nova e aditiva). Mesmas situações e rodadas da amostragem da solicitação (`pending` → `submitted` → `approved` ou `rejected`). Sem prazo próprio: corre enquanto a cotação está aberta ou com a vencedora escolhida.
- A Wellmix valida na **tela do produto da cotação** (`/app/supplier-requests/<cotação>?view=item&product=…`), no card Imagens da coluna da direita: a amostra de cada fornecedor (ou "Dispensada"), com aprovar e reprovar (ação "Validar a amostragem"). Veja "Imagens na tela do item".
- **Escolha da vencedora**: quem não tem a amostra de todos os produtos aprovada (nem é conhecido) aparece desabilitado na lista, com o motivo; o serviço recusa (`quote_winner_sampling`).
- **Passagem para a solicitação**: aprovada a vencedora, a solicitação ao fornecedor nasce com a amostragem já resolvida (a aprovada na cotação, com os arquivos, ou a dispensada, `sampling.skipped`). Ela não pede a amostra de novo, e o pedido de compra fica liberado.
- **Pendências e avisos**: a cotação continua nas Pendências do fornecedor enquanto ele tem amostra a enviar ou reprovada; a Wellmix (quem abriu a cotação) é avisada do envio, e o fornecedor, da aprovação e da reprovação.
- **Arquivos**: documentos sem pedido nem solicitação; só a Wellmix e quem enviou abrem. As fotos do cadastro abrem para o fornecedor convidado a cotar aquele produto (`supplierQuotesProduct`).

### Na solicitação ao fornecedor (book)

- Com a solicitação **em andamento** (aberta ou respondida), o fornecedor já vê o cartão da Amostragem (abaixo da negociação) e pode enviar; a Wellmix vê e valida no card Imagens, antes mesmo de decidir (`samplingFor`).
- **Sem prazo antes da aprovação**: o SLA de 1 dia, o "Atrasada", a pendência e o aviso de atraso continuam contando só depois da aprovação.
- **Na aprovação** (`samplingOnApproval`): a amostra já enviada ou aprovada segue como está; a pendente recomeça o prazo, mantendo os arquivos que ele já subiu.
- A aprovação da solicitação **não** passou a exigir a amostra aprovada: aprovar e depois validar a amostra continua funcionando, com a trava do produto e do pedido de compra. A regra "só vence com a amostra aprovada" vale na escolha da vencedora da cotação de compra, que é onde há uma vencedora entre vários.

### Imagens na tela do item (dono, 22/11/2026)

A amostra pode ser aprovada depois, mas precisa poder ser enviada antes, para os dois lados negociarem vendo o que está em discussão. As imagens **não ficam dentro do chat** (tirariam o espaço de digitar): ficam na tela do item da cotação, na coluna da direita, sempre à vista (card **Imagens**, `_components/item-images.tsx`), em grupos com nome:

| Grupo                       | O que é                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Referência da Wellmix**   | O que a Wellmix mandou ao fornecedor: as fotos do cadastro do produto ou a foto do item do book.                                                              |
| **Amostra de <fornecedor>** | As fotos e os vídeos que cada fornecedor já subiu na rodada atual, com a situação, mesmo antes de aprovada. O conhecido do produto aparece como "Dispensada". |

- Cada foto abre grande num clique e tem o botão de **copiar** (`CopyImageButton`): a imagem vai para a área de transferência e pode ser **colada no chat**, para citar um ponto.
- A imagem colada no campo de mensagem vira o **anexo** da mensagem (`attachPastedImage`), nas duas conversas: a da solicitação ao fornecedor (que já aceitava anexo) e a da cotação de compra (que passou a aceitar foto, PDF e Excel; o fornecedor da resposta abre o anexo, `supplierSeesQuoteFile`).
- **Um lugar só** (dono, 22/11/2026: nada de dois blocos da mesma página falando da mesma coisa). Na tela da Wellmix, o card Imagens é o único lugar da amostragem: a situação, o prazo, o motivo da reprovação, as rodadas anteriores e o **aprovar ou reprovar** ficam no grupo do fornecedor. Não há cartão de Amostragem à parte, nem coluna "Amostra" no quadro comparativo, nem a foto repetida no card "Produto da cotação".
- Para o fornecedor, as imagens estão na cotação dele, no card "Fotos do produto e amostragem": a referência da Wellmix e, em "Sua amostra", o que ele enviou.

### Onde está

| Parte        | Arquivo                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| Regras puras | `src/lib/quote-sampling.ts`, `src/lib/supplier-request-sampling.ts`     |
| Serviço      | `src/lib/services/quote-sampling.ts`                                    |
| Ações        | `src/app/app/actions/quotation.ts`                                      |
| Tela         | `_components/sampling.tsx` (`SamplingPanel`, usado nos dois casos)      |
| Testes       | `tests/unit/quote-sampling.test.ts`, `tests/e2e/purchase-quote.spec.ts` |
