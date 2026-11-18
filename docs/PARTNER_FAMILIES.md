# Grupo de produto (família) no cadastro do parceiro

Pedido do dono (18/11/2026): em Equipe Acessos e Parceiros > Equipe Externa, ampliar o recurso "Linhas atendidas" e levá-lo ao cadastro dos parceiros **Fornecedor, Trading, Supplier e Factory**, com o título **Grupo de produto (família)**, e usar as famílias marcadas para decidir quem entra na cotação de compra.

## Decisões do dono (18/11/2026)

1. **Trading, Supplier e Factory entram na cotação de compra (B13)** como o Fornecedor. Se um deles vence, vira o fornecedor da solicitação ao fornecedor (B7) e do pedido de compra. A decisão de 11/11/2026 (docs/PARTNER_TYPES.md, "parceiros à parte") muda só para a cotação de compra.
2. **O cadastro de famílias é o que o portal já usa**: o 1º nível da árvore de grupos do Sankhya (TGFGRU, `GRAU = 1`). É a mesma família da Nova solicitação (docs/ORDER_TERMS.md, seções 10 e 11), gravada pelo código do Sankhya.
3. **Marcar uma família convida o parceiro para a cotação de compra de todas as linhas dela.**

## As duas classificações

São dois níveis da mesma árvore de grupos do Sankhya.

|               | Linhas atendidas (até 18/11/2026)                               | Grupo de produto (família) (agora)                  |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Nível         | O grupo do último nível (a linha de produto)                    | O grupo do 1º nível (o topo da árvore)              |
| Cadastro      | `product_lines` (carga do Sankhya, `sankhyaCode`)               | `product_families` (carga do Sankhya, `code`)       |
| Identificador | O id da linha                                                   | O código do grupo no Sankhya (CODGRUPOPROD)         |
| Vínculo       | `supplier_lines` (fornecedor × linha), só o Fornecedor          | `party_families` (parceiro × família), os 4 tipos   |
| Em produção   | 1.080 linhas, com 240 nomes repetidos em 502 linhas (ramos diferentes) | As famílias do 1º nível, cada uma com o código |

Nomes repetidos são grupos diferentes do Sankhya, como BRINQUEDOS 10000000 e BRINQUEDOS 110000000. A tela mostra o código ao lado do nome para distinguir.

## Regras

1. **Tipos** (`FAMILY_PARTY_TYPES`, `src/lib/party-families.ts`):
   - Fornecedor (`supplier`): "Fornecedores" no pedido do dono é este tipo;
   - Trading (`trading`);
   - Supplier (`supplier_partner`);
   - Factory (`factory`).
2. **Onde fica a seção** (âncora `#families`):
   - na ficha do Fornecedor (`/app/suppliers/<id>`, aba Informações), no lugar das "Linhas atendidas";
   - na ficha da Trading, do Supplier e da Factory (`/app/parties/<id>`), antes das certificações.
3. **Seleção**:
   - várias famílias por parceiro;
   - busca por nome (sem acento e sem caixa) ou por código;
   - as selecionadas ficam à vista, com o código, e saem pelo "×";
   - gravar troca a lista inteira daquele parceiro, e cada parceiro tem as suas;
   - ao reabrir, a ficha carrega as gravadas.
4. **Identificadores**:
   - cada código aparece uma vez só;
   - o código aparece sempre ao lado do nome, para distinguir famílias de mesmo nome.
5. **Família que saiu do Sankhya**:
   - fica inativa e não é apagada;
   - continua na ficha de quem já a tinha, com "(inativa no Sankhya)";
   - não aparece para quem não a tinha.
6. **Quem edita**:
   - a equipe Wellmix com a tela Cadastros (`parties`), a mesma regra das "Linhas atendidas", conferida pelo serviço;
   - o login do parceiro não vê a seção;
   - "Atualizar do Sankhya" é só do administrador;
   - as permissões de telas e ações continuam na gestão de acessos.
7. **Auditoria**:
   - `party.families`, com a lista antes e depois;
   - `product_families.sync`, com quantas famílias foram criadas, alteradas e inativadas, quantas linhas e quantos vínculos convertidos.

## Cadastro de famílias (`product_families`)

- **Origem**: a árvore de grupos do Sankhya (`sankhyaProductGroups`), a mesma leitura da Nova solicitação, guardada por 30 minutos.
- **Quando carrega**:
  - sozinho, quando o cadastro está vazio, na primeira abertura da ficha de um parceiro desses tipos (autocorreção, como os resumos dos pedidos);
  - sem o Sankhya, tenta de novo depois de 10 minutos;
  - pelo botão "Atualizar do Sankhya" (administrador).
- **Atualização pelo código**:
  - cria a família nova, atualiza o nome e reativa;
  - a família que sumiu da árvore fica inativa;
  - nada é apagado.
- `nameKey`: a chave da Nova solicitação (`fm:<NOME>`).
- **Família da linha** (`product_lines.familyCode`): sobe a árvore a partir do grupo da linha (`sankhyaCode`) até o topo.
  - Na atualização, é gravada em lotes.
  - Na cotação, quando falta, é calculada na hora e gravada.

## Cotação de compra (B13)

**Quem é convidado** (`supplierIdsForLines`), cada parceiro uma vez só, mesmo que se qualifique por mais de um critério:

1. quem marcou a família de alguma das linhas da cotação;
2. o fornecedor principal dos produtos ativos das linhas (`products.supplierId`), como sempre;
3. os fornecedores ligados aos produtos cotados (`product_suppliers`), como sempre;
4. o vínculo antigo das "Linhas atendidas" ainda não convertido (abaixo).

Entram só os parceiros ativos dos quatro tipos. O resto do fluxo não muda:

- a estratégia "cotar entre fornecedores";
- a aprovação da Diretoria de compras;
- o prazo e os lembretes;
- a escolha e a aprovação da vencedora.

**Outros pontos da cotação**:

- **Convite manual** ("Convidar outro"): a busca vai nos quatro tipos, e o tipo aparece na dica quando não é Fornecedor.
- **Vencedora**: vira o fornecedor da solicitação ao fornecedor (B7) e do pedido de compra, qualquer que seja o tipo (decisão 1).
- **Compra direta pela "última compra"** (a estratégia sem cotação): continua só com o Fornecedor.
- **Telas**:
  - a Trading, o Supplier e a Factory já tinham "Cotações de compra" no perfil de telas (Acessos externos);
  - eles entram com o papel `supplier` e veem só os próprios convites, como o Fornecedor.

## Condição de pagamento, início da produção e fatura (dono, 18/11/2026)

Quem vence a cotação vira o fornecedor do pedido (decisão 1), então os três quadros do fornecedor na ficha (`/app/parties/<id>`) valem para os quatro tipos: Fornecedor, Trading, Supplier e Factory.

- **Condição de pagamento ao fornecedor** (`#payment-terms`, quem abre o Financeiro): o pedido novo copia a condição, e as travas do pedido de compra esperam por ela (sinal ou conta corrente). Antes, só o Fornecedor gravava, e o pedido de uma Trading vencedora ficava parado nessa espera.
- **Início da produção** (`#production-start`, só o administrador): dias depois do contrato assinado. Vazio: o padrão das Configurações.
- **Fatura ativa** (`#invoice-days`, só o administrador): dias depois dos documentos do embarque conferidos. Vazio: o padrão das Configurações.
- **No servidor**: `saveSupplierPaymentTerms`, `setSupplierProductionStartDays` e `setSupplierInvoiceDays` aceitam os quatro tipos (`servesFamilies`). Os outros tipos continuam recusados.
- **Continuam só do Fornecedor**:
  - a compra direta pela "última compra";
  - a página de conta do fornecedor (`/app/suppliers/<id>`, só consulta);
  - o preenchimento automático da cidade, da loja e do telefone na ficha de compra (`src/lib/services/sheet-records.ts`).
- **Testes**: `tests/unit/supplier-settings-types.test.ts` e `tests/e2e/partner-order-settings.spec.ts`.

## Dados reaproveitados e convertidos

- **Reaproveitados**:
  - a árvore de grupos do Sankhya e os códigos dela, como identificadores;
  - as linhas (`product_lines.sankhyaCode`);
  - os tipos de parceiro de sempre;
  - a regra de edição (Cadastros).
- **Convertidos**: cada vínculo antigo "Linhas atendidas" (`supplier_lines`) vira a família da linha em `party_families` na carga do cadastro.
  - Converte uma vez só e fica marcado (`supplier_lines.familyConvertedAt`).
  - O vínculo antigo fica no banco.
  - Depois de convertido, a família manda: desmarcá-la tira o parceiro da cotação, e outra atualização não a refaz.
  - O vínculo de uma linha sem grupo do Sankhya não é convertido e continua valendo na cotação como antes.
- **Em produção (18/11/2026)**: 0 vínculos em `supplier_lines` e 0 cotações de compra. Nada a converter.

## Banco (aditivo)

- Tabela `product_families`:
  - colunas `code` (único), `name`, `nameKey`, `active`, `syncedAt`.
- Tabela `party_families`:
  - colunas `partyId`, `familyCode`, `createdByUserId`;
  - índices por parceiro e por família.
- Coluna `product_lines.familyCode`, com o índice `product_lines_by_family`.
- Coluna `supplier_lines.familyConvertedAt`.

Nada sai:

- a tabela `supplier_lines` continua;
- a ação e o serviço das "Linhas atendidas" continuam, sem tela que os chame.

## Onde está

| Parte          | Arquivo                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras puras   | `src/lib/party-families.ts`                                                                                                                                                                              |
| Serviço        | `src/lib/services/product-families.ts`                                                                                                                                                                   |
| Cotação        | `src/lib/services/purchase-quote.ts` (`supplierIdsForLines`, `inviteMore`)                                                                                                                               |
| Ações          | `src/app/app/actions/party-families.ts`                                                                                                                                                                  |
| Telas          | `src/components/party-families-card.tsx`, `src/components/party-families-picker.tsx`, `src/app/app/_party-accounts/detail.tsx` (Fornecedor), `src/app/app/parties/_record/party-record.tsx` (os outros) |
| Convite manual | `src/lib/services/party-search.ts`, `src/app/api/parties/search/route.ts`, `src/components/party-picker.tsx`                                                                                            |
| Textos         | `src/i18n/modules/party-families.ts`                                                                                                                                                                     |
| Testes         | `tests/unit/party-families.test.ts`, `tests/e2e/party-families.spec.ts`, `tests/e2e/purchase-quote.spec.ts`                                                                                             |

## O que ficou de fora

- **Nova solicitação**: continua juntando as famílias pelo nome (`fm:<NOME>`), então as duas BRINQUEDOS aparecem como uma só lá. O cadastro do parceiro distingue pelo código. Levar a Nova solicitação para o código é uma decisão à parte.
- **Outras operações**: Trading, Supplier e Factory continuam fora do booking como fornecedor e do pedido fora da cotação (docs/PARTNER_TYPES.md, "Vínculo com a operação").
