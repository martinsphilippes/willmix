# Quem envia e quem recebe nos chats (conversa privada entre dois logins)

Decisões do dono de 18/11/2026. Esta especificação substitui o modelo antigo, em que havia uma conversa por empresa, vista por todos os logins dela e por toda a equipe Wellmix.

## Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Guardar o destinatário em cada mensagem? | Não precisa. A conversa nasce entre dois logins e só os dois leem e escrevem. O destinatário de cada mensagem é sempre o outro login da conversa. |
| 2 | Quem é de fora vê os logins da equipe Wellmix? | Não. Vê só o login da pessoa com quem já está conversando (privacidade). |
| 3 | Regra do aviso | Continua a mesma (sino, um aviso não lido por assunto até ler), mas vai só para o outro login da conversa. |
| 4 | Chat da solicitação ao fornecedor (`supplier_requests.negotiation`) | Vai ser unificado com este num trabalho separado. Fica como está. |
| 5 | Auditoria | O administrador lê todas as conversas, sem escrever. A Controladoria e o SLA continuam. |
| 6 | Quem atende quem é de fora | O responsável do pedido ou da solicitação (`ownerUserId`). Sem responsável, a lista curta: quem criou a solicitação, as pessoas com quem ele já conversa e, sem ninguém, os administradores. |
| 7 | Conversas antigas, por empresa | Continuam visíveis como antes, só para leitura. As novas já nascem privadas. |
| 8 | Aviso para a equipe toda | Não. Só a outra pessoa da conversa é avisada. |

## Modelo

- `conversations.wellmixUserId` e `conversations.externalUserId` (colunas novas, opcionais) identificam a conversa privada. `partyId` continua sendo a empresa de quem é de fora. Com as duas colunas nulas, a conversa é antiga e só de leitura.
- Lê a conversa privada: os dois logins e o administrador. Escrevem só os dois, e só se o outro login estiver ativo (nem desativado nem suspenso). Caso contrário, o envio volta `peer_inactive` e a tela mostra a conversa só para leitura.
- Lê a conversa antiga: a Wellmix e os logins da empresa, como antes. Ninguém escreve (`read_only`).
- Assuntos (Geral, solicitação, pedido, produto do pedido): as regras de sempre. O login de fora da conversa precisa ver a solicitação ou o pedido.
- Assunto do rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 8):
  - "Solicitação #N (rascunho)" (`conversation_topics.kind = "draft"` e `draftId`).
  - Só quem salvou o rascunho abre a conversa pelo rascunho, com um login do cliente dele. O login de fora lê o assunto pela conversa privada.
  - No envio, o assunto passa a ser o da solicitação, com as mensagens.
- Não lidas, selo do menu e faixa "Nova mensagem": só das conversas em que o login escreve.
- Controladoria: o analista de uma conversa privada é a pessoa da Wellmix dela. A pendência "Responder" abre direto a conversa com a pessoa de fora (`peerUserId`).

## Tela (painel lateral, caixa flutuante e Mensagens)

Componente único: `src/components/chat-identity.tsx`.

- Topo: **ENVIANDO COMO** (nome · Você, depois "Login: e-mail · empresa ou Wellmix") e **DESTINATÁRIO** (nome, depois "Login: e-mail · empresa"). Quando o administrador lê uma conversa de outros, aparece **PARTICIPANTES** com os dois.
- **Escolher conversa** (painel): lista as pessoas com quem dá para conversar naquele pedido ou solicitação, com o login, a empresa e a marca "conversa aberta" ou "nova conversa".
  - Wellmix: os logins de fora ativos, que veem o pedido e têm a tela Mensagens, com filtro por empresa. Empresa com um login só abre direto; com vários, abre a conversa mais recente ou pede a escolha (`choose_login`).
  - De fora: a lista curta, com o responsável marcado e sem o e-mail de quem ainda não conversa com ele. Abre na conversa que já existe sobre aquele assunto; sem ela, com o responsável.
- **Sobre** (pedido inteiro ou produto): como antes.
- Cada mensagem mostra autor (· Você), empresa ou equipe, data e hora, "Login: …" do autor e "Para: nome (login)". Nas conversas antigas aparece "Destinatário não identificado no histórico".
- Acima do campo de escrita: **Enviando para** nome · login · empresa.
- Trocar de conversa troca juntos o cabeçalho, o histórico, o destino e o rascunho, que é guardado por conversa. O destino fica vazio até a nova conversa carregar. O envio leva a conversa mostrada, e o servidor recusa (`conversation_changed`) se o assunto não for dela. Anexos em envio continuam indo para a conversa em que foram escolhidos.
- Mensagens: a lista mostra a outra pessoa com o login. "Nova conversa" da Wellmix busca o login pelo nome, pelo e-mail ou pela empresa. Quem é de fora tem "Falar com a Wellmix", com a lista curta.
- Não mostra "entregue" nem "lido": o portal guarda só até onde cada login leu o assunto (`message_reads`), o que não comprova a leitura de cada mensagem.

## Fora deste trabalho

- O chat da solicitação ao fornecedor (`/app/supplier-requests/[id]`, `request-chat.tsx`) continua mostrando só "Wellmix" ou "Fornecedor". A unificação fica para um trabalho separado (decisão 4).
