# Condições do pedido e contatos do cliente (Nova solicitação)

Pedido do dono (15/11/2026) para a tela `/app/requests/new`: um bloco do cliente no lugar da busca por foto ou link, condições no nível do pedido (tipo de operação, formato de venda, entrega, país de origem e grupo de produto) e um aviso claro de que não há devoluções.

## 1. Quem vê

- **Wellmix vendendo ao cliente** (representante ou vendedor; nova solicitação, fora do "adicionar produto"): tudo deste documento.
- **Compra para estoque** (caixa "Compra para estoque"): sem bloco do cliente e sem condições ("Compra para estoque: sem condições de venda nem contatos do cliente"). O país e o grupo também não são pedidos.
- **O próprio cliente** (login de cliente): a tela segue como antes, com a busca por foto ou link. Nada deste documento aparece para ele.
- **Adicionar produto a uma solicitação** (`?addTo=`): como antes (as condições ficam as da solicitação).

## 2. Bloco do cliente (no lugar de "Encontrar o produto por foto ou link")

- Coluna da direita, no alto (no celular, antes do formulário), card "Cliente".
- **Contatos:** Sócio, Comprador, Financeiro e Fiscal, Logística; cada um com telefone e e-mail. Todos obrigatórios.
- **Primeira vez pelo portal, às cegas:** enquanto o portal nunca atualizou os contatos do cliente, os campos chegam vazios. Nada do cadastro (e-mail, telefone, contato que vieram do Sankhya) vai para a tela, nem pela rota.
- **Depois de atualizados pelo portal:** a próxima venda mostra os quatro contatos, a data e quem atualizou, com "Editar contatos" (abre os campos preenchidos; "Cancelar edição" volta).
- **Grava junto com a solicitação** (os campos pertencem ao formulário pelo atributo `form`). Sem os contatos (cliente nunca atualizado e campos não enviados), o envio é recusado: "Preencha os contatos do cliente…".
- **Restrição:** nenhum contato pode ser igual ao do representante ou vendedor. O servidor compara:
  - o e-mail de quem está preenchendo e os e-mails dos logins ativos da Wellmix (admin e operador), sem diferenciar maiúsculas;
  - o telefone, só os dígitos (sem o 55 na frente), contra os telefones desses logins quando houver. **Hoje o login do portal não tem telefone**, então a regra de telefone ainda não tem com o que comparar (ver seção 7).
- **Validação:** telefone com 10 a 13 dígitos (DDD + número, com ou sem 55); e-mail válido.
- **Auditoria:** `party.contacts` ("atualizados pela primeira vez", "editados" ou "confirmados"), com o antes e o depois.

## 3. Condições do pedido (no formulário, antes dos produtos)

Card "Condições do pedido", logo abaixo de Cliente/Solicitante/RCA. Valem para todos os produtos do lote (cada solicitação do lote guarda a mesma cópia).

| Campo                            | Opções                                     | Obrigatório             |
| -------------------------------- | ------------------------------------------ | ----------------------- |
| Tipo de operação                 | TS (Trading Sales) · Venda                 | Sim                     |
| Formato de venda                 | WD · Wellmix                               | Sim                     |
| Formato Wellmix (só com Wellmix) | Pleno · Mega · Hiper · Ultra · Evo · Super | Sim, com Wellmix        |
| Entrega → Transportador          | Transportadoras do portal e do Sankhya     | Não ("Não escolhido")   |
| Entrega → Re-despacho            | As mesmas                                  | Não ("Sem re-despacho") |
| País (de origem)                 | Países dos produtos do catálogo            | Sim                     |
| Grupo de produto                 | Grupos com produto no país escolhido       | Sim                     |

### 3.1 Entrega (Transportador e Re-despacho)

- **Portal:** parceiros do tipo Transportadora, ativos (produção em 15/11/2026: 6).
- **Sankhya:** `SELECT CODPARC, NOMEPARC, NOMECID FROM TGFPAR … WHERE TRANSPORTADORA = 'S' AND ATIVO = 'S'`, lido na hora e guardado por 30 minutos (`src/lib/services/delivery-carriers.ts`). Aparecem com "(Sankhya)". A transportadora do portal ligada ao mesmo código do Sankhya aparece uma vez.
- Sem o Sankhya configurado ou com erro, só as do portal, e a tela avisa.
- Gravado: `{ source: "portal" | "sankhya", code, name }` (o nome do momento da escolha).

### 3.2 País de origem > Grupo de produto

- A ordem é essa: escolher o país libera os grupos daquele país; com os dois escolhidos, a busca de produto de cada linha só oferece os produtos deles (`/api/products/search?scope=catalog&country=…&line=…`). Sem os dois, o campo de produto espera ("Escolha o país de origem e o grupo de produto…").
- **Grupo de produto** = a linha do produto (`products.lineId`), que é o grupo do Sankhya (TGFGRU, `CODGRUPOPROD`).
- **País de origem** = o país do fornecedor do produto: o fornecedor do cadastro (`supplierId`) ou, sem ele, o fornecedor que veio do Sankhya (`sankhyaRefs.CODPARCFORN` → parceiro com esse código). Siglas e grafias se juntam ("CN", "China" e "CHINA" = CHINA).
- **Sem fornecedor com país:** o produto fica em "País não informado no cadastro", que também se escolhe (nada é inventado). Produção em 15/11/2026 (consulta de leitura): de ~14 mil produtos ativos, ~3,6 mil têm país pelo fornecedor do cadastro e ~0,7 mil pelo fornecedor do Sankhya; o resto cai em "não informado" até o cadastro do fornecedor ser completado.
- O índice produto → país e grupo é lido do banco e guardado por 10 minutos por instância (`src/lib/services/product-origin.ts`).
- **Servidor:** todo produto do catálogo do lote precisa ser do país e do grupo escolhidos; senão o envio é recusado ("Há produto de outro país ou grupo…"). Produto fora do catálogo (sourcing) não tem cadastro para conferir e passa.

### 3.3 Aviso (disclaimer)

Caixa vermelha no fim das condições, sempre visível na venda ao cliente:

> **Atenção: sem devoluções** — Não nos responsabilizamos por defeitos ou quebras de produtos neste modelo de venda, ou seja, não há devoluções previstas para esta operação. Isto acontece, pois nosso processo prevê que o cliente seja o responsável pelas inspeções e aprovações necessárias durante o processo de produção.

A solicitação grava `noReturnsNotice: true` (o aviso estava na tela no envio) e mostra o aviso de novo nas condições da solicitação.

## 4. Dados (aditivos)

| Onde                                      | O quê                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parties.customerContacts` (JSON)         | `{ partner, buyer, finance, logistics }`, cada um `{ phone, email }`.                                                                                                                                           |
| `parties.customerContactsUpdatedAt`       | Quando o portal gravou. Nulo = nunca (a tela pede às cegas).                                                                                                                                                    |
| `parties.customerContactsUpdatedByUserId` | Quem gravou.                                                                                                                                                                                                    |
| `requests.orderTerms` (JSON)              | `{ operationType, saleFormat, wellmixTier, carrier, redispatch, originCountry, originCountryName, productLineId, productLineName, noReturnsNotice }`. Nulo nas antigas, na compra para estoque e na do cliente. |

Nada existente foi removido ou alterado.

## 5. Onde aparece depois

- Página da solicitação (`/app/requests/<id>`), card Solicitações: bloco "Condições do pedido" com tudo acima e o aviso. Só a Wellmix vê.

## 6. Código

- Regras puras: `src/lib/order-terms.ts` (listas, país, validação dos contatos).
- Servidor: `src/lib/services/order-terms.ts`, `customer-contacts.ts`, `product-origin.ts`, `delivery-carriers.ts`; ação `createRequestAction` (`src/app/app/actions.ts`).
- Rotas (só Wellmix com Solicitações): `GET /api/requests/order-options` (países e transportadoras; `?country=` = grupos) e `GET /api/customers/contacts?customer=`.
- Tela: `src/components/request-order-terms.tsx`, `request-customer-contacts.tsx`, `request-order-terms-view.tsx`.
- Testes: `tests/unit/order-terms.test.ts` e `tests/e2e/order-terms.spec.ts`.

## 7. Em aberto (para o dono)

- **Telefone do representante/vendedor:** o login do portal não tem telefone. Para a regra "não pode ser igual ao do representante" valer também no telefone, falta de onde ler o telefone dele (campo no login ou o e-mail/telefone do vendedor no Sankhya, TGFVEN).
- **País dos produtos sem fornecedor:** ~10 mil produtos ativos sem país pelo fornecedor. Opções: completar o país no cadastro dos fornecedores ou ler o país de origem do produto no Sankhya (TGFPRO `CODPAIS`, preenchido só em ~190 produtos na carga atual).
- **Transportador obrigatório?** Hoje é opcional ("Não escolhido").
- **Aceite do aviso:** hoje é só exibido e registrado; dá para pedir uma caixa "Li e concordo" se quiser.
- **Envio ao Sankhya:** tipo de operação, formato e transportadora ainda não vão para a nota do Sankhya (falta saber os campos/TOP de cada um).
