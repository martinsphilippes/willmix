# Novo produto com aprovação

Pedido do dono (17/11/2026, com as telas do iPad): o quadro curto "Novo produto" da lista de Produtos sai. Criar um produto passa a ser na tela do produto, com todas as especificações em branco para preencher. Depois de criado, o produto vai para as Pendências, para o administrador ou o superior aceitar ou negar.

## 1. O que muda na tela

| Onde                                   | Antes                                                        | Agora                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Produtos (`/app/products`)             | Quadro "+ Novo produto" com nome, SKU, linha e especificação | Botão "+ Novo produto" no alto, que abre a ficha em branco                                                   |
| Novo produto (`/app/products/new`)     | Não existia                                                  | Os mesmos quadros da tela do produto (Produto, Fornecedor e negociação, Embalagem e Observações), já abertos |
| Tela do produto (`/app/products/<id>`) | —                                                            | Quadro "Aprovação do produto novo" no alto enquanto aguarda; selo "Aguardando aprovação" ou "Recusado"       |
| Produtos, filtros                      | "Ver excluídos" com todo produto inativo                     | "Aguardando aprovação (N)" separado de "Ver excluídos"                                                       |
| Pendências                             | —                                                            | "Aprovar produto novo: <nome>" (filtro "Aprovar produto novo"); conta em Cadastros → Produtos no menu        |

Os campos da ficha ficam num componente só (`src/app/app/products/_components/product-form-cards.tsx`): um campo novo entra nas duas telas. As diferenças são poucas:

- No produto novo, o fornecedor é escolhido pela busca (são milhares).
- No lugar da caixa "Produto ativo" vem o aviso de que o produto nasce inativo.
- A origem é "Manual".

Fotos, medições, fornecedores, variações, ficha de compra mestre, NCM, certificações, atributos e IA precisam do produto gravado. Por isso ficam liberados logo depois de criar, na tela do produto, que abre sozinha.

## 2. Regras

1. **Criar.** O produto nasce **inativo** e aguardando aprovação (`products.approvalStatus = "pending"`). Também ficam gravados quem pediu e quando (`approvalRequestedByUserId`, `approvalRequestedAt`). Nome e linha são obrigatórios, como sempre. O nome de exemplo ("XPTO") é recusado.
2. **Quem aprova.** O **administrador** (sempre) ou um **superior** de quem pediu: a cadeia do "Responde a" da Equipe (`users.managerUserId`), do superior direto ao topo, a mesma árvore do Painel de SLA.
   - Quem saiu da equipe ou está com o login suspenso não aprova; a cadeia continua acima dele.
   - Quem pediu nunca aprova o próprio produto, a não ser que seja administrador.
   - Quem aprova precisa abrir a tela Produtos, onde fica o quadro da aprovação.
3. **Pendência e aviso.**
   - O administrador vê todas as aprovações em Pendências. O superior vê as de quem está abaixo dele.
   - O aviso (sino e e-mail) vai para o primeiro superior que abre Produtos; sem ele, para os administradores.
   - No Painel de SLA, o dono da pendência é esse superior; sem ele, fica "sem dono" (administrador).
4. **Enquanto aguarda,** o produto fica fora do catálogo, da vitrine, das novas solicitações e do Sankhya:
   - Nenhuma sincronização (`syncSoon` e a rotina de pendências do ERP pulam o produto).
   - "Restaurar" da lista não o ativa.
   - A caixa "Produto ativo" da ficha fica travada, e o servidor também recusa ativá-lo por ela.
   - O botão "+ Nova solicitação" da ficha some.
   - Fotos, medições e o resto da ficha podem ser completados normalmente.
5. **Aprovar.** O produto fica ativo (`approvalStatus = "approved"`) e segue para o Sankhya como qualquer produto novo. Quem pediu é avisado.
6. **Recusar.** Exige o motivo. O produto continua inativo (`approvalStatus = "rejected"`, com o motivo em `approvalNote`), e quem pediu é avisado com o motivo. Recusado não é pendência de ninguém.
7. **Reenviar.** Depois de corrigir, quem abre Produtos aperta "Reenviar para aprovação". O pedido volta para "pending", com quem reenviou como quem pediu (o superior dele aprova). A recusa anterior continua à vista de quem decide.
8. **Nada é apagado.** Cada passo vai para a Auditoria: `product.create`, `product.approve`, `product.reject` e `product.approval.resubmit`.

## 3. O que não passa pela aprovação

Hoje, só o produto criado à mão pela equipe (a tela Novo produto e a ação curta antiga, que não tem mais botão) passa pela aprovação. Ficam como estavam:

- A carga do Sankhya: o ERP é a origem do produto.
- A importação de planilha (CSV e ficha técnica).
- O produto que nasce da solicitação ao fornecedor (Booking): ele já tem a análise e a liberação dele (docs/SUPPLIER_REQUESTS.md).
- Os produtos de antes: `approvalStatus` vazio é "não passou pela aprovação".

Um produto aguardando aprovação que a carga do Sankhya ligue pelo SKU a um produto já existente lá deixa de aguardar se o ERP o ativar.

## 4. Decisões tomadas sem confirmação do dono (a conferir)

O pedido dizia "no painel Adm ou do superior". Estas leituras foram feitas no código e podem ser mudadas:

- **D1.** "Superior" é a cadeia inteira do "Responde a" (o direto e os acima), não só o direto. O aviso vai só para o direto.
- **D2.** O administrador também passa pela aprovação quando ele mesmo cria o produto (pode aprovar o próprio na hora).
- **D3.** Quem aprova precisa abrir a tela Produtos (a aprovação é feita na ficha). Um superior sem essa tela não recebe a pendência; o administrador recebe.
- **D4.** Só o cadastro manual passa pela aprovação (seção 3).
- **D5.** Enquanto aguarda, o produto não vai para o Sankhya; vai ao ser aprovado.

## 5. Esquema (aditivo)

Colunas novas em `products`, todas opcionais:

- `approvalStatus`: pending, approved ou rejected.
- `approvalRequestedByUserId` e `approvalRequestedAt`.
- `approvalDecidedByUserId` e `approvalDecidedAt`.
- `approvalNote`.

Índice parcial `products_by_approval` (só onde `approvalStatus` não é nulo). Publicado no Supabase pela migração só aditiva (docs/SUPABASE.md, "Publicar o esquema").

Antes de o esquema chegar ao banco, a lista de Pendências ignora a consulta que falhar. Criar um produto pela tela nova mostra "esquema desatualizado".

## 6. Código

| Parte             | Arquivo                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras      | `src/lib/product-approval.ts` (`awaitingApproval`, `pendingApproval`, `superiorsOf`, `canDecideApproval`)                                                                    |
| Serviço           | `src/lib/services/product-approval.ts` (criar, decidir, reenviar, quadro da ficha, pendências)                                                                               |
| Ações             | `createProductSheetAction` em `src/app/app/actions/catalog.ts`; `decideProductApprovalAction` e `resubmitProductApprovalAction` em `src/app/app/actions/product-approval.ts` |
| Telas             | `src/app/app/products/new/page.tsx`, `_components/approval-card.tsx` e `_components/product-form-cards.tsx`                                                                  |
| Pendências e menu | `src/lib/services/tasks.ts` (tipo `product_approve`), `src/lib/task-owner.ts` e `src/lib/flow.ts`                                                                            |
| Textos            | `src/i18n/modules/new-product.ts` (pt, en e zh)                                                                                                                              |

Testes:

- `tests/unit/product-approval.test.ts`: regras, pendências, travas, recusa, reenvio e aprovação.
- `tests/e2e/new-product.spec.ts`: da ficha em branco à aprovação, com recusa e reenvio.

## 7. Melhorias futuras

- Ação configurável "Aprovar produto novo" em Funções e acessos, para quem aprova além do superior (ex.: Gerente de produto).
- Aprovar ou recusar direto da lista de Pendências, sem abrir a ficha.
- Itens obrigatórios antes de pedir a aprovação (ex.: foto principal, NCM).
- Prazo (SLA) da aprovação, com o aviso de atraso.
