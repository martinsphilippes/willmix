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
  - Em produção, a lista começa vazia até o primeiro clique; o campo já mostra o código do RCA de cada cliente ("Vendedor X (fora da lista)") enquanto isso.
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
    - Responde à Wellmix que abre Solicitações; para os outros, 404.
    - Sem cache (`private, no-store`).
  - Troca junto com o cliente.
  - Estados:
    - "Escolha o cliente para ver o RCA."
    - "Buscando o RCA…"
    - "Nome (código)"
    - "Vendedor X" (código fora da lista)
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

## 8. Fica para depois

- RCA na lista de clientes, com filtro por RCA.
- Escrever no Sankhya o RCA trocado no portal (hoje o Sankhya manda).
- Guardar na solicitação o RCA do momento: hoje ele é lido do cadastro na hora, só para consulta. Serve se o RCA entrar em comissão ou relatório.
- Mostrar o solicitante (quem criou) na solicitação aberta e renomear ali "Solicitante do cliente" para "Login do cliente com acesso".
