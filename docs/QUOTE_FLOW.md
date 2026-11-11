# Cotação: negociação e proposta de embalagem

Racional do dono (10/11/2026) para o caminho Booking → Superplan → RFQ → pedido (hoje, Booking por planilha → Seleção de itens → solicitação ao fornecedor; docs/SUPPLIER_REQUESTS.md). Este documento cobre o que acontece **na cotação**, entre a resposta do fornecedor e a escolha dele. Tudo é aditivo: cotação sem negociação nem proposta segue como sempre.

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

## 3a. Preço desejado e fotos do Booking antigo (removidos em 11/11/2026)

O "preço desejado" (o fornecedor do produto confirmava, mandava outro ou não aceitava o preço da ficha) e as "fotos que já vieram com o produto" só valiam para a solicitação nascida do **Booking antigo** (fila de produtos). Saíram junto com ele (docs/BOOKING.md): `quoteOfferFor`, `replyQuoteOffer`, `replyQuoteOfferAction`, `QuoteOfferCard` e a dispensa das fotos de conferência na cotação. As rodadas `offer`, `confirm` e `decline` já gravadas em `quotes.negotiation` continuam aparecendo no histórico da negociação e na etiqueta "Preço desejado: fornecedor não aceitou".

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

- `quotes.negotiation` (JSON): rodadas `{at, byUserId, byName, side, kind: return|accept|counter|keep|offer|confirm|decline, comment, currency, targetPrice, previousPrice, price}`.
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
