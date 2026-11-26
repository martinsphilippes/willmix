# Cotação: três telas do mesmo passo viraram uma

Pedido do dono (22/11/2026). No portal interno (visão Wellmix), "Cotação de compra", "Negociação" e "Convites de book" eram três itens do menu, um depois do outro, mas são o mesmo marco: depois da Estratégia de compra, a Wellmix cota com os fornecedores escolhidos, e é dentro da cotação que negocia com eles até decidir de qual fornecedor o pedido nasce. Terminada a cotação, não há mais o que negociar.

**O fluxo não mudou.** As entidades, as regras, as permissões, as pendências e os avisos são os de antes. O que mudou foi onde a Wellmix vê e faz cada coisa. Nenhuma tela, rota, campo ou dado foi removido: os endereços antigos continuam abrindo.

## 1. Menu

A seção "Produto novo" passou a se chamar **Cotação** (a chave do grupo continua `nav.group.newProduct`; o bloco do fluxo continua `new-product`, para não mexer em endereços nem em indicadores gravados).

| Item                       | Abre                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Overview                   | `/app/flow/new-product`                                                                |
| **Entrada** (abre e fecha) | Book (`/app/booking`), Reposição (`/app/replenishment`) e Encomendas (`/app/requests`) |
| Seleção de itens           | `/app/booking/selection`                                                               |
| Estratégia de compra       | `/app/purchase-strategy`                                                               |
| **Cotação**                | `/app/supplier-requests`                                                               |
| **Cadastrar produto**      | `/app/product-registration` (dono, 26/11/2026; docs/PRODUCT_REGISTRATION.md)           |

- "Entrada" não tem tela própria: o nome abre e fecha os três subitens (`NavLink.children`, `NavSubGroup` em `src/components/app-nav.tsx`). Abre sozinho quando a tela atual é de um dos três. Cada subitem mantém o seu contador; fechado, "Entrada" mostra a soma.
- "Cotação" acende também em `/app/purchase-quotes` e em `/app/supplier-requests/invites` (`NavLink.match`).
- No fluxo (`src/lib/flow.ts`), os passos `quotes` (convites) e `purchase-quotes` saíram: as pendências deles (`booking_invite` e as `purchase_quote_*`) contam no passo `negotiations`, que agora se chama Cotação. O Overview da seção mostra Books, Seleção de itens, Encomendas, Reposição, Estratégia de compra e Cotação.
- O menu do fornecedor e dos outros parceiros não mudou.

## 2. A lista: `/app/supplier-requests`

Para a Wellmix, o título é **Cotação** e a tabela mostra todas as cotações:

- as **solicitações ao fornecedor** (uma linha por solicitação, como antes);
- as **cotações de compra** ainda com os fornecedores (aberta, com vencedora escolhida ou sem resposta): número, quantos fornecedores, produtos, peças, quantos responderam, o prazo e de quem é a vez. A cotação de compra **aprovada** não aparece em dobro: ela segue na linha da solicitação que nasceu dela. A cancelada vai para Encerradas.

A coluna **Origem** diz de onde a cotação veio. São três origens, e todas passam pela Estratégia de compra e pela Cotação: **Book**, **Encomenda** ou **Reposição** (dono, 22/11/2026). Sem book, vale a demanda de onde a cotação nasceu (`requests.origin`: `replenishment` é Reposição; as outras, Encomenda); cotação que junta as duas mostra as duas.

Abas: **Em andamento**, **Encerradas** e **Convites de book** (a mesma tabela de `/app/supplier-requests/invites`, em `_components/invites-table.tsx`). A solicitação aprovada com a amostra ainda não aprovada fica em **Em andamento** até a amostra ser aprovada (dono, 24/11/2026; docs/SUPPLIER_REQUESTS.md, "Abas").

Para o fornecedor, a lista é a de sempre (só as solicitações dele, com os textos de antes).

## 3. A cotação: `/app/supplier-requests/[id]`

O mesmo endereço abre os dois tipos (a página procura a solicitação e, não achando, a cotação de compra, só para a Wellmix):

- **Solicitação ao fornecedor**: a tabela dos produtos, como estava. Para a Wellmix o título é "Cotação nº N".
- **Cotação de compra**: o quadro de sempre (produtos, quadro comparativo de todas as respostas, ficha técnica, escolha da vencedora, aprovação e o que fazer sem resposta), no componente `purchase-quotes/_components/quote-board.tsx`, que também serve `/app/purchase-quotes/[id]`. Na tabela de produtos, o ícone "Abrir o produto na cotação" leva ao item. As ações feitas daqui voltam para cá (campo `home`).

## 4. O produto da cotação: `?view=item`

Para a Wellmix, no lugar do card "O que está sendo negociado":

- **Produto da cotação**: o resumo e a ficha do produto. O link "Ver a ficha completa no Book" só aparece quando a cotação veio de um book.
- **Quadro comparativo** (`_components/quotation-board.tsx`): uma linha por fornecedor, com situação, preço, incoterm, mínimo, prazo e condições, e a última compra do produto como referência. Em cada linha:
  - o ícone de **conversa** abre, num modal, o chat com aquele fornecedor sobre aquele produto;
  - o ícone de **propostas e contrapropostas** abre, num modal, a sequência do que ele propôs e do que a Wellmix devolveu;
  - a **caixa de marcar** escolhe quem recebe a contraproposta.
- **Devolver com contraproposta**: à direita, abaixo do Book (a lateral fica fixa na rolagem). Os mesmos campos de antes e o comentário obrigatório. "Enviar aos marcados" manda para as linhas marcadas; "Enviar a todos" manda para todos os que podem receber.
- A Decisão da Wellmix, as Alternativas, as ligadas, a Amostragem e o Produto continuam na tela, com as mesmas regras.

De onde vêm as linhas do quadro:

| Tela                                            | Linhas                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Solicitação que veio de um book                 | Ela e as solicitações ligadas (o item e as alternativas, com os outros fornecedores). Todas aceitam conversa, histórico e contraproposta. |
| Solicitação que nasceu de uma cotação de compra | Ela (a vencedora) e, só para comparar, o que os outros convidados responderam.                                                            |
| Cotação de compra (`&product=<produto>`)        | Uma linha por fornecedor convidado, com a resposta dele para o produto.                                                                   |

Para o fornecedor, a tela do produto é a de sempre.

## 5. Negociação dentro da cotação de compra

Para o quadro valer também antes da escolha da vencedora, a resposta de cada fornecedor (`purchase_quote_responses`) ganhou a coluna `negotiation` (lista de passos; aditiva, nula nas antigas):

| Passo      | Quem       | O que guarda                                                                                       |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `answer`   | Fornecedor | Cada envio da resposta: preço de cada produto, moeda, incoterm, mínimo, prazo, porto e observação. |
| `decline`  | Fornecedor | A recusa.                                                                                          |
| `proposal` | Wellmix    | A contraproposta de um produto: preço, moeda, mínimo, prazo, incoterm e o comentário.              |
| `message`  | Os dois    | A mensagem da conversa do par (com o produto, quando há).                                          |

Regras (`src/lib/quote-negotiation.ts` e `src/lib/services/quote-negotiation.ts`):

- **Contraproposta**: só a Wellmix com a ação "Escolher a vencedora" (`purchaseQuote.choose`), com a cotação aberta, e só para quem **já respondeu**. Comentário obrigatório e ao menos um valor. Sem "Ver preço de compra", o preço não vai. Se um dos marcados não pode receber, nada é enviado a ninguém.
- **Prazo**: quem recebe ganha um prazo novo (as horas da cotação, a contar do envio) para corrigir a resposta. Quem já respondeu continua "respondido", então a escolha da vencedora não fica travada por causa da contraproposta.
- **Fornecedor**: recebe o aviso e a pendência, vê a contraproposta no alto da cotação dele (`/app/purchase-quotes/[id]`, card "Negociação com a Wellmix"), corrige a resposta no formulário de sempre e reenvia. Ele continua vendo só a própria linha: nunca os outros convidados nem as respostas deles.
- **Conversa**: a Wellmix escreve para uma resposta; o fornecedor, só na dele. Vale enquanto a cotação está aberta ou com a vencedora escolhida.
- **Histórico**: resposta de antes desta mudança aparece uma vez, com os valores de hoje.

Nas solicitações ao fornecedor, a contraproposta, a conversa e o histórico são os que já existiam (`supplier_requests.negotiation`); o quadro só os reúne.

## 6. O que ficou igual

- Os endereços `/app/purchase-quotes`, `/app/purchase-quotes/[id]` e `/app/supplier-requests/invites` continuam abrindo. Os avisos e as pendências antigas continuam levando a eles.
- A cotação de compra aprovada continua virando a solicitação ao fornecedor da vencedora, e é nela que seguem a decisão, a amostragem, o produto e o pedido de compra.
- Permissões: tela `quotes` para tudo; escolher e aprovar a vencedora, decidir a solicitação e ver preço de compra como antes.

## 7. Conferência: o que a etapa Negociação fazia e onde ficou

Pedido do dono (22/11/2026): trocar o nome para Cotação não pode perder processo. Cada coisa que a Wellmix fazia na tela da Negociação, e onde está agora:

| O que a Negociação fazia                                                      | Onde ficou                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lista com as abas "Em negociação" e "Encerradas"                              | A mesma lista, com as abas "Em andamento" e "Encerradas" (e mais as cotações de compra e a aba dos convites). |
| "Gerar pedido" e o quadro "Gerar pedido de compra" na aba Encerradas          | Igual, na aba Encerradas.                                                                                     |
| Tabela dos produtos da solicitação (ações rápidas, SLA, amostragem por linha) | Igual (`/app/supplier-requests/[id]`).                                                                        |
| Resumo do produto, condições negociadas e a previsão de preço refeita         | Card "Produto da cotação".                                                                                    |
| Ficha do produto                                                              | Card "Produto da cotação" (o link do Book só com book).                                                       |
| Resposta do fornecedor (oferta de hoje)                                       | Linha dele no Quadro comparativo.                                                                             |
| Rodadas anteriores (respostas e contrapropostas)                              | Ícone de propostas e contrapropostas da linha (modal) e o Histórico à direita.                                |
| Devolver com contraproposta, com a estimativa da previsão de preço            | Bloco à direita, agora também para vários fornecedores de uma vez.                                            |
| Aviso de contraproposta esperando o fornecedor e a trava do "Aprovar"         | Selo "Contraproposta enviada" na linha; a trava do "Aprovar" continua na Decisão.                             |
| Conversa com o fornecedor, com anexo (foto, PDF, Excel)                       | Ícone de conversa da linha (modal), com o mesmo anexo.                                                        |
| Decisão da Wellmix (aprovar, recusar, cancelar, com a observação)             | Igual, abaixo do quadro.                                                                                      |
| Alternativas e "Abrir solicitação para esta"                                  | Igual, abaixo da Decisão.                                                                                     |
| Solicitações ligadas ("continuar negociando" ou recusar)                      | Igual; as ligadas também aparecem como linhas do quadro.                                                      |
| Amostragem (fotos e vídeos, validar)                                          | Igual depois da aprovação; desde 22/11/2026 também pode começar na cotação (docs/SUPPLIER_SAMPLING.md).       |
| Produto (criar, associar, liberar na vitrine, código do Sankhya)              | Desde 26/11/2026, na tela Cadastrar produto (docs/PRODUCT_REGISTRATION.md); na cotação, o atalho.             |
| Aviso do pedido de compra (gerar ou abrir o pedido)                           | Igual.                                                                                                        |
| Book, seleção e a previsão de preço do item escolhido                         | Card Book, à direita (só quando há book).                                                                     |
| Histórico de interações                                                       | Igual, à direita.                                                                                             |
| Linha do tempo entre os blocos (Cotação, Pedido, Produção, Entrega)           | Igual.                                                                                                        |
| Aviso de fornecedor sem login e "gerar o login"                               | Igual.                                                                                                        |
| SLA (prazo, atraso e os avisos de atraso)                                     | Igual.                                                                                                        |
| Pendências e contador do menu                                                 | As mesmas pendências, contando no item Cotação.                                                               |

Nenhuma ação saiu. O que mudou de lugar foi a resposta do fornecedor (da faixa para a linha do quadro), a conversa (para o modal) e a contraproposta (para a direita). Para o fornecedor, nada mudou. O E2E do caminho principal (book → seleção → solicitação → negociação → amostragem → produto → pedido de compra) passa com a tela nova.

## 8. Em aberto (para o dono decidir)

1. **Número**: a solicitação ao fornecedor e a cotação de compra têm numerações separadas, então pode haver duas "nº 3" na lista (a coluna Origem e o título da tela as diferenciam). Unificar a numeração mexe em dados gravados.
2. **Nome para o fornecedor**: ele continua vendo "Solicitações ao fornecedor" e "Cotações de compra" no menu dele.
3. **Uma cotação só do começo ao fim**: hoje a cotação de compra aprovada cria a solicitação da vencedora (dois registros para a mesma cotação). Juntar os dois num registro só é mudança de fluxo e de dados.
