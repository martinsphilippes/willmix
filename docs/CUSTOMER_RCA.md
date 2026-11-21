# RCA do cliente (vendedor do Sankhya)

Pedido do dono (15/11/2026, com as fotos da Nova solicitação e de Cadastros → Parceiros no iPad): vincular um RCA ao cadastro do cliente e mostrar esse vínculo na Nova solicitação, com o solicitante preenchido pela sessão e o seletor de acesso do cliente separado.

## 1. Decisões do dono

- **Origem do RCA:** o vendedor do Sankhya (TGFVEN: `CODVEND` e `APELIDO`). O portal traz a lista e o vínculo usa o código do vendedor.
- **Divergência:** o Sankhya manda. A carga do Sankhya sempre sobrescreve o RCA do portal; uma troca feita no portal vale até a próxima carga daquele cliente.

## 2. Dados

| Onde | O quê |
| --- | --- |
| `parties.rcaCode` (texto, opcional) | Código do vendedor do Sankhya. `"0"` = sem RCA (escolhido no portal ou vindo do Sankhya). Nulo = nunca gravado: vale o vendedor que veio na carga (`sankhyaRefs.CODVEND`). |
| `settings`, chave `sankhyaSellers` | Cópia da lista de vendedores: `{ syncedAt, sellers: [{ code, name, active }] }`. Ativos e inativos; o vendedor 0 ("sem vendedor") fica de fora. |

- Como o nulo cai no `sankhyaRefs.CODVEND`, os clientes já carregados mostram o RCA sem migração de dados.
- Produção em 15/11/2026 (consulta de leitura): 26.688 clientes; 2.341 com vendedor no Sankhya (118 códigos diferentes); 24.347 com `CODVEND` 0, sem RCA.
- Demonstração (modo memória): três vendedores marcados como demonstração (Ana 101, Bruno 102 e Carla 103, inativa); Loja do João com a Ana e Wellmix SC com o Bruno. A tela diz "Lista de demonstração".

## 3. Cadastro do cliente (`/app/parties/<id>`)

- **Campo "RCA responsável"**, só no cadastro de cliente.
  - Opções: "Sem RCA" e os vendedores ativos, como "Nome (código)".
  - O RCA atual inativo aparece como "(inativo)".
  - Um código fora da lista aparece como "Vendedor X (fora da lista)".
- **Gravar:** pelo botão Salvar do cadastro (`savePartyAction` → `setCustomerRca`).
  - Só grava quando muda.
  - Na Auditoria: `party.rca`, "RCA do cliente: antes → depois".
- **Reabrir:** mostra o RCA atual (`rcaCodeOf`: o gravado ou, sem nada gravado, o da carga).
- **"Trazer a lista do Sankhya"** (`refreshRcaListAction`):
  - Lê `SELECT CODVEND, APELIDO, ATIVO FROM TGFVEN`.
  - Precisa da integração do Sankhya configurada. Sem ela: "Não deu para ler os vendedores no Sankhya…", e a lista de antes fica.
  - Na Auditoria: `rca.list`.
  - Em produção, a lista começa vazia até o primeiro clique; o campo mostra "Vendedor fora da lista do Sankhya" enquanto isso. Na lista, cada vendedor aparece como "CODPARC - APELIDO" (dono, 16/11/2026; o CODVEND é interno).
- **Permissões:** as de editar o cadastro (Wellmix com a tela Parceiros), no servidor. O cliente não vê o campo.

## 4. Carga do Sankhya

- `upsertParty` (clientes) grava `rcaCode` com o `CODVEND` do parceiro quando a carga cria ou atualiza o cliente: o Sankhya manda.
- Um registro sem `CODVEND` não mexe no RCA.
- Fornecedor não ganha RCA.
- O portal não escreve o RCA no Sankhya.

## 5. Nova solicitação (`/app/requests/new`)

### Wellmix

Duas linhas: **Cliente | Login do cliente com acesso** e **Solicitante | RCA do cliente**.

- **RCA do cliente:** só consulta.
  - Ao escolher o cliente, a tela busca `/api/parties/rca?customer=<id>`.
    - Responde à Wellmix que abre uma tela de nova solicitação (Encomendas, TS ou Venda); para os outros, 404.
    - O que aparece (dono, 16/11/2026) é **"CODPARC - APELIDO"**: o código do vendedor como parceiro na empresa (`TGFVEN.CODPARC`) e o apelido. O `CODVEND` é interno do Sankhya: continua sendo o vínculo do cliente (`parties.rcaCode`), mas não aparece na tela.
    - A cópia da lista guarda o CODPARC (`SELECT CODVEND, CODPARC, APELIDO, ATIVO FROM TGFVEN`). Sem o apelido ou o CODPARC na cópia (lista trazida antes ou vendedor novo), a tela lê direto do Sankhya, `SELECT CODVEND, CODPARC, APELIDO, ATIVO FROM TGFVEN WHERE CODVEND = <código>` (só leitura). Sem o Sankhya, fica o que a lista tem.
    - Sem cache (`private, no-store`).
  - Troca junto com o cliente.
  - Estados:
    - "Escolha o cliente para ver o RCA."
    - "Buscando o RCA…"
    - "CODPARC - APELIDO" (antes "Nome (código)"); sem CODPARC, só o apelido
    - "Vendedor sem cadastro no Sankhya" (o vendedor não está na lista nem no Sankhya; antes "Vendedor X")
    - "Sem RCA vinculado"
    - "Não deu para buscar o RCA."
  - Compra para estoque: "Compra para estoque: sem RCA."
- **Solicitante:** o nome de quem está criando, só consulta.
  - O campo não vai no formulário.
  - O servidor grava `createdByUserId` pela sessão (como antes).
- **Login do cliente com acesso:** o seletor de antes (`requestedForUserId`, antes "Solicitante (login do cliente)").
  - Só traz os logins ativos do cliente escolhido.
  - Trocar de cliente volta para "Nenhum".
  - Desligado sem cliente, quando o cliente não tem login e em compra para estoque.
  - O servidor continua recusando login de outro cliente (`invalid_requester`) e grava nulo em compra para estoque.

### Cliente (o próprio cliente abre)

- **Solicitante:** ele.
- **Login do cliente com acesso:** o login dele ("O seu login: você vê a solicitação e o pedido.").
  - O servidor grava `requestedForUserId` = ele.
  - A regra de antes vale: o cliente só cria para a própria empresa, com "Cliente pode criar solicitação" ligado.
- O cliente não vê o RCA: é dado interno da Wellmix, e a rota responde 404 para ele.

## 6. Regras de visibilidade (não mudaram)

- Do lado do cliente, só o login com acesso vê a solicitação e o pedido. Sem login escolhido, só a Wellmix vê.
- Adicionar produto a uma solicitação: o acesso é o da solicitação.
- Na solicitação aberta, o quadro "Solicitante do cliente" continua trocando o login com acesso, como antes.

## 7. Peças

- Serviço: `src/lib/services/rca.ts`.
- Rota: `src/app/api/parties/rca/route.ts`.
- Ações:
  - `src/app/app/actions/customer-rca.ts` (lista do Sankhya);
  - `savePartyAction` em `src/app/app/actions.ts` (vínculo).
- Telas:
  - `src/components/party-form.tsx` e `src/app/app/parties/[id]/page.tsx`;
  - `src/components/request-people-fields.tsx` e `src/app/app/requests/new/page.tsx`.
- Carga: `upsertParty` em `src/lib/integrations/sankhya-import.ts`.
- Textos: `src/i18n/modules/customer-rca.ts` (pt/en/zh).
- Banco: coluna nova `parties.rcaCode` (opcional, migração só aditiva).
- Testes:
  - `tests/unit/customer-rca.test.ts`;
  - `tests/e2e/customer-rca.spec.ts`.

## 7.1 Cliente sem RCA: vários RCAs até um fechar a venda (dono, 19/11/2026)

Pedido do dono: "Caso o cliente não tenha RCA vinculado, o campo do RCA do cliente fica aberto para cadastro de um (podem ter múltiplos até algum fechar uma venda e prender ele como padrão por 30 dias)". Decisões (19/11/2026): os RCAs vêm da lista de vendedores do Sankhya (TGFVEN) e "fechar a venda" é o cliente confirmar o pedido (sair de "Aguardando cliente").

- **Quando abre:** o cliente não tem RCA no cadastro (nem no Sankhya, `rcaCode`/`sankhyaRefs.CODVEND`, nem escolhido no portal) e nenhum RCA preso. O campo "RCA do cliente" da Nova solicitação vira uma lista (`rcaCode`), com "RCAs já cadastrados para este cliente" e "Outros vendedores" (os ativos da lista do Sankhya, "CODPARC - APELIDO"). Sem escolha, o pedido vai sem RCA. Sem a lista trazida do Sankhya, o campo diz para trazer no cadastro do cliente.
- **Vários RCAs:** cada RCA escolhido num pedido entra em `parties.rcaPortal.candidates` (os do cliente; histórico `party.rca_candidate`). Vendedor inativo ou fora da lista é recusado (`rca_invalid`).
- **No pedido:** o RCA vai em `requests.orderTerms.rca` (`{ code, source }`): `customer` (o do cadastro), `locked` (o preso) ou `chosen` (o escolhido).
- **Fechar a venda:** quando o cliente confirma o pedido (`confirmCustomerOrder`), o RCA `chosen` (ou o `locked`, que renova) vira o padrão do cliente por 30 dias: `rcaPortal.lockedCode`, `lockedUntil` e `lockedByRequestId` (histórico `party.rca_lock`). Enquanto vale, o campo mostra o RCA, só consulta, com "Fechou a última venda: padrão do cliente até DD/MM/AAAA", e os pedidos levam esse RCA. Passados os 30 dias, o campo volta a abrir.
- **O cadastro manda:** cliente com RCA no cadastro (Sankhya ou portal) não abre nada e nada é preso; a carga do Sankhya continua sobrescrevendo.
- **Previsão de preço:** o vendedor (CODVEND) da cotação é o do cadastro ou, sem ele, o preso (`effectiveRcaCode`). O escolhido na tela, antes de fechar a venda, não vai para a cotação.
- **Código:** `src/lib/services/rca.ts` (`customerRcaField`, `resolveRequestRca`, `lockRcaOnSale`, `RCA_LOCK_DAYS`), `/api/parties/rca`, `src/components/request-people-fields.tsx`; testes `tests/unit/request-rca-open.test.ts` e `tests/e2e/customer-rca.spec.ts`.

## 7.2 Buscador único no RCA (dono, 21/11/2026)

O campo aberto do cliente sem RCA deixou de ser uma lista simples: é o buscador único dos formulários (docs/ORDER_TERMS.md seção 11.23), com busca por palavras soltas, os grupos "RCAs já cadastrados para este cliente" e "Outros vendedores" e, escolhido, "CODPARC - APELIDO" abaixo do campo. Grava o mesmo `rcaCode`; o servidor não mudou.

## 8. Fica para depois

- RCA na lista de clientes, com filtro por RCA.
- Escrever no Sankhya o RCA trocado no portal (hoje o Sankhya manda).
- Guardar na solicitação o RCA do momento: hoje ele é lido do cadastro na hora, só para consulta. Serve se o RCA entrar em comissão ou relatório.
- Mostrar o solicitante (quem criou) na solicitação aberta e renomear ali "Solicitante do cliente" para "Login do cliente com acesso".
