# Cotação: negociação e proposta de embalagem

Racional do dono (10/11/2026) para o caminho Booking → Superplan → RFQ → pedido. Este documento cobre o que acontece **na cotação**, entre a resposta do fornecedor e a escolha dele. Tudo é aditivo: cotação sem negociação nem proposta segue como sempre.

## 1. Problema

- Quando a Wellmix não aceitava o preço, a conversa acontecia fora do portal: o motivo e os preços de cada rodada não ficavam registrados.
- A embalagem proposta ia ao fornecedor por mensagem solta; o "consigo produzir assim" dele não ficava em lugar nenhum.
- Nada impedia escolher um fornecedor com negociação em aberto ou que recusou a embalagem.

## 2. Objetivo

Registrar, na própria cotação, a negociação de preço e o OK do fornecedor na embalagem, e só deixar a escolha seguir quando os dois estiverem resolvidos.

## 3. Negociação ("devolver com comentário")

1. **A Wellmix devolve** uma cotação respondida: escreve o **motivo** (obrigatório, o fornecedor lê) e, se quiser, o **preço que propõe**. O campo já vem com **10% a menos** que o preço da cotação (`NEGOTIATION_DISCOUNT_PCT`), editável; pode ser apagado. O preço proposto tem de ser menor que o da cotação.
2. **O fornecedor é avisado** ("sua vez") e, na cotação, responde: **aceita** o preço proposto, **manda outro preço** (a tréplica) ou **mantém** o dele (com o motivo). A Wellmix pode registrar a resposta que ele deu por fora (chat, telefone).
3. O preço novo vale na **cotação e na ficha da cotação** (é de onde sai a conta do valor ao cliente).
4. Pode haver várias rodadas (até 30); o **histórico** fica na cotação, com quem, quando, preço antes e depois e o comentário.
5. Enquanto a devolução espera resposta, **a escolha do fornecedor fica parada** (`negotiation_pending`), na seleção direta e no envio para aprovação.
6. O chat da solicitação continua no alto da página para conversar antes de responder.

## 3a. Preço desejado: a solicitação que nasce do Booking

Pedido do dono (10/11/2026): pelo Booking, o lançamento já tem o preço que a Wellmix quer pagar. O fornecedor não precisa preencher a cotação inteira (pesos, fotos, cartão do fabricante): ele recebe o preço e **confirma** ou **manda o dele**.

1. **Quando vale** (`quoteOfferFor`): a solicitação tem uma linha do Booking ligada a ela, a cotação ainda espera a primeira resposta (`invited`, sem rodadas) e o fornecedor da cotação é o **principal do produto**. O preço é o da ficha do produto (o que a equipe ajusta na tabela do Booking), na moeda da ficha. Sem preço ou moeda na ficha, a cotação segue como sempre.
2. **Só o fornecedor do produto vê o preço.** Outros fornecedores convidados para a mesma RFQ cotam do jeito de sempre e não veem o valor (o preço da ficha é do fornecedor dela: isolamento entre fornecedores).
3. **É lido na hora.** Nada é gravado até o fornecedor responder; por isso a RFQ aberta antes desta regra também mostra o preço, e uma mudança de preço no Booking antes da resposta é a que ele recebe.
4. **Na cotação**, o fornecedor (ou a Wellmix, registrando por ele) vê o cartão "Preço desejado pela Wellmix" com o preço, a quantidade e três campos: prazo de produção em dias (obrigatório), outro preço e comentário.
   - **Confirmar**: a cotação fica **respondida** com o preço desejado e o prazo, pelo mesmo `answerQuote` de sempre (situação da solicitação, vínculo do fornecedor com o produto, auditoria, aviso à Wellmix). A ficha da cotação continua disponível, mas não é exigida.
   - **Enviar outro preço**: a cotação fica respondida com o preço **dele**; a Wellmix recebe o aviso "Preço diferente do desejado" e os dois lados veem, no cartão da negociação, a diferença e o botão das mensagens. A Wellmix pode **devolver com comentário**, e o campo do preço proposto já vem com o **preço desejado** (em vez dos 10% a menos). Daí em diante é a negociação da seção 3.
   - Outro preço igual ao desejado conta como confirmação.
5. **Histórico**: duas rodadas em `quotes.negotiation`: `offer` (Wellmix, com `targetPrice`) e `confirm` ou `counter` (fornecedor, com `previousPrice` e `price`). Auditoria `quote.offer_reply`.
6. **Erros**: `offer_none` (não há preço desejado esperando), `offer_lead_time_required`, `offer_price_required`.
7. **Código**: `quoteOfferFor` e `replyQuoteOffer` (`src/lib/services/quote-flow.ts`), `replyQuoteOfferAction`, `QuoteOfferCard` (`src/components/quote-flow-cards.tsx`), `offerRoundOf` e `suggestedReturnPrice` (`src/lib/quote-flow.ts`). Sem coluna nova.

## 3b. Fotos que já vieram com o produto no Booking

Pedido do dono (10/11/2026): na cotação que nasce do Booking, as fotos também têm de vir preenchidas, como o preço e os outros dados.

1. **Quando vale**: a mesma condição do preço desejado, sem depender da situação da cotação (`bookingProductOf`: a solicitação tem linha do Booking e o fornecedor da cotação é o principal do produto), e o produto tem ao menos uma foto no cadastro (a da coluna PHOTO da ficha técnica, por exemplo).
2. **O que muda na cotação**: o bloco Fotos mostra, no alto, as fotos que vieram com o produto, e aparece como "Completo". As cinco fotos de conferência (balança, régua, lado, outro ângulo e original) ficam **opcionais nesta cotação** (`waivedPhotoKinds`); quem quiser já pode enviá-las.
3. **O que não muda**: a foto da planilha continua sendo "foto do fornecedor", não vira foto de balança nem original (nada é copiado nem reclassificado). As cinco fotos de conferência **continuam obrigatórias na Preparação do pedido**, como sempre. Outro fornecedor convidado para a mesma RFQ e a solicitação comum não mudam: as cinco fotos seguem exigidas.
4. **Acesso ao arquivo**: a miniatura só aparece para quem já podia abrir aquele arquivo (`canAccessDocument`); nenhuma permissão nova. Quem não pode abrir vê só o aviso de que o produto já veio com foto.
5. **Código**: `bookingGivenPhotos` e `quotePhotoCoverage` (`src/lib/services/quote-sheet.ts`), `SheetPhotosCard` (`given`, `waivedKinds`).

## 4. Proposta de embalagem (o OK do fornecedor)

1. **A Wellmix envia** a imagem da embalagem proposta (gerada na ferramenta que a equipe já usa) e, se quiser, o **prompt** que a gerou (fica guardado). Sem gerador de imagem dentro do portal: decisão do dono.
2. **O fornecedor responde OK ou Não** (o Não pede o motivo). A Wellmix pode registrar a resposta por ele.
3. **Não**: a Wellmix recebe um aviso de atenção para rever a seleção (enviar outra proposta ou escolher outro fornecedor). Uma proposta nova guarda a anterior no histórico e volta a esperar.
4. Com proposta enviada, **a escolha do fornecedor espera o OK** (`packaging_ok_waiting` / `packaging_ok_refused`). Cotação sem proposta não é travada.
5. **As duas confirmações** do racional (a Wellmix selecionou; o fornecedor deu OK na embalagem) ficam, assim, registradas antes de o cadastro e o pedido seguirem.

## 5. Papéis e permissões

- Devolver e enviar proposta: só a Wellmix com a tela Cotações.
- Responder à devolução e dar o OK/Não: o fornecedor **daquela cotação** (ou a Wellmix, registrando).
- A imagem da proposta (`documents.quoteId`) só abre para a Wellmix e para o fornecedor daquela cotação: outros fornecedores da mesma RFQ, o cliente e os demais parceiros nunca.

## 6. Dados (aditivo)

- `quotes.negotiation` (JSON): rodadas `{at, byUserId, byName, side, kind: return|accept|counter|keep|offer|confirm, comment, currency, targetPrice, previousPrice, price}`.
- `quotes.packagingProposal` (JSON): `{version, prompt, imageDocumentId, sentAt, sentBy…, decision: ok|no|null, decidedAt, decidedBy…, comment, history[]}`.
- `documents.quoteId` (opcional): só gravado nos arquivos da cotação.
- Antes de o esquema ser publicado, as ações novas voltam "esquema desatualizado"; o resto da cotação funciona.

## 7. Auditoria e avisos

`quote.return`, `quote.negotiation_reply`, `quote.packaging_proposal`, `quote.packaging_decision`, com antes e depois. Avisos: ao fornecedor (devolução e proposta, no idioma dele) e à Wellmix (resposta, OK ou Não).

## 8. Código

`src/lib/quote-flow.ts` (regra pura), `src/lib/services/quote-flow.ts`, `src/app/app/actions/quote-flow.ts`, `src/components/quote-flow-cards.tsx`; testes em `tests/unit/quote-flow.test.ts`.

## 9. Em aberto / melhorias futuras

- Regra de quando aplicar os 10% (hoje é sugestão editável em cada devolução; pode virar parâmetro por linha de produto).
- Gerar a imagem dentro do portal (precisa de um serviço de imagem contratado).
- Prazo de resposta do fornecedor com lembrete, e indicador de economia obtida na negociação.
