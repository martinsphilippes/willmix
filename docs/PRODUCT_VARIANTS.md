# Variações de produto

Um produto do catálogo pode ter **variações** (modelo, tamanho, acabamento): "Porta-retrato" com GRECIE 4X6 / 10 X 15, STONE MARBLE A4, WD STRIBY VERT 8X10… Cada variação tem preço, pedido mínimo (MOQ), caixa master/inner, pesos, medidas, CBM, cores, material, embalagem, código de fábrica e foto próprios. A variação é escolhida na solicitação, cotação, pedido e vitrine, e os valores dela viajam como **cópia** (snapshot) para a solicitação e o pedido, como o resto da ficha.

## 1. Problema

A planilha da ficha técnica do fornecedor (modelo SUPPLIER INFO) lista um produto por planilha com dezenas de linhas (tamanhos/acabamentos). A importação criava um produto por linha: 20 "produtos" para um porta-retrato, poluindo o catálogo e a vitrine, sem relação entre eles.

## 2. Objetivo

Um produto por planilha; cada linha (grupo de linhas com as mesmas medidas/preço, cores juntas) vira uma variação. Quem pede escolhe a variação e o portal usa o preço, o MOQ e o CBM dela. Produtos sem variação continuam exatamente como hoje (nada é removido).

## 3. Modelo de dados (aditivo)

### Tabela nova `product_variants`

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `productId` | id, obrigatório | produto dono; índice `by_product` |
| `name` | str 160, obrigatório | "GRECIE 4X6 / 10 X 15" (descrição/OBS + tamanho, ou a coluna NAME) |
| `key` | str 80, obrigatório | chave normalizada (código de fábrica + nome, minúsculas, sem acentos/espaços repetidos) para a reimportação achar a mesma variação; índice único `product_key_unique` (`productId`, `key`) |
| `sortOrder` | int | ordem da planilha |
| `active` | bool | desativar em vez de apagar |
| `factoryItemCode` | str 60 | SKU/código na fábrica |
| `sizeText` | str 60 | texto do tamanho ("8X10 / 20X25") |
| `price` | float | preço do fornecedor de referência |
| `currency` | str 3 | USD/CNY/BRL/EUR |
| `moq` | int | pedido mínimo da variação |
| `masterBoxQty`, `innerBoxQty` | int | |
| `netWeightKg`, `grossWeightKg` | float | por peça |
| `lengthCm`, `widthCm`, `heightCm` | float | medidas da peça |
| `cbm` | float | CBM por caixa master |
| `colorAssortment` | str 200 | cores juntas ("White / Gray / bege") |
| `material` | str 200 | |
| `packageType` | str 120 | |
| `capacityMl` | float | |
| `notes` | text | |
| `photoDocumentId` | id (nulo) | foto da variação (documento) |
| `importBatchId` | id (nulo) | lote que criou/atualizou |

### Colunas novas (todas opcionais; linhas antigas ficam nulas)

- `product_photos.variantId` (+ índice `by_variant`): foto de uma variação (a da coluna PHOTO, tipo `supplier`, uma por variação).
- `requests.variantId` e `requests.variant` (JSON, snapshot: `{ id, name, factoryItemCode, price, currency, moq, masterBoxQty, innerBoxQty, netWeightKg, grossWeightKg, lengthCm, widthCm, heightCm, cbm, colorAssortment, material, packageType }`).
- `order_items.variantId` e `order_items.variant` (mesmo snapshot, copiado da solicitação).
- `purchase_snapshots.variantId` (os valores do snapshot de compra vêm da variação quando há uma).
- `cart_items.variantId`.

### Índice do carrinho

`cart_items` tinha o índice único `user_product_unique` (`userId`, `productId`): impedia duas variações do mesmo produto no carrinho. Passa a `user_product_variant_unique` (`userId`, `productId`, `variantId`). `IndexDef` ganha `drops?: string[]` (chaves de índices antigos que o publicador remove antes de criar o novo); `scripts/appwrite-push.ts` apaga só os índices listados em `drops`, nunca outros. O carrinho continua juntando no mesmo item pela regra do serviço (produto + variação), sem depender do índice.

### Colunas do produto

Com variações, as colunas comerciais do produto (`price`, `currency`, `moq`, `masterBoxQty`, `innerBoxQty`, pesos, medidas, `cbm`, `color`, `material`) e a ficha mestre espelham a **variação de referência**: a de menor preço (empate: a primeira). É o que o catálogo e a vitrine mostram como "a partir de". `syncProductFromVariants(productId)` recalcula isso sempre que uma variação é criada, editada, desativada ou adotada por um pedido.

## 4. Regras de negócio

1. Produto com variações ativas: solicitação, carrinho e "pedir agora" **exigem** a variação (`variant_required`); a variação tem de ser do produto e estar ativa (`variant_invalid`).
2. MOQ: `effectiveMoq(variant.moq, sheet.moq, product.moq)` — a variação vence a ficha mestre, que vence o cadastro. Mesma regra na tela (piso ao sair do campo) e no servidor (`below_moq`).
3. Nome na solicitação: `productName` = "Produto · Variação" (cortado em 160), para listas, avisos e títulos mostrarem a variação sem mudar outras telas; `variantId` e `variant` guardam o dado estruturado.
4. Cotação: a ficha de cotação do fornecedor nasce com medidas, caixa, pesos, CBM, cores, material e embalagem da variação; preço e MOQ só quando o fornecedor cotado é o fornecedor de referência do produto (mesma regra de isolamento de hoje).
5. Pedido: `order_items` leva `variantId` + snapshot; o snapshot de compra (`purchase_snapshots`) usa os valores da variação; a ficha do pedido adotada ("adopt") grava de volta na **variação** (preço, MOQ, caixa, pesos, medidas, CBM) e depois `syncProductFromVariants`. Sem variação, tudo como hoje.
6. Vitrine: a página do produto lista as variações (foto, nome, preço estimado em BRL quando a fórmula fecha, MOQ); o cliente escolhe uma; o passo de quantidade usa o MOQ dela; um item de carrinho por produto + variação; o checkout cria uma solicitação por item com a variação. O cartão do catálogo mostra "a partir de" e "N variações". O cliente nunca vê fornecedor, preço FOB, moeda ou código de fábrica.
7. Importação: por padrão **um produto por planilha** ("Um produto com variações"); opção "Um produto por linha" mantém o comportamento antigo. Nome do produto = "Nome base" informado, senão o nome do primeiro grupo. Cada grupo vira uma variação (upsert por `key`); a foto da coluna PHOTO vira a foto da variação (tipo `supplier`, com `variantId`); o cartão de visita vale para o produto. A ficha mestre e as colunas do produto espelham a variação de referência. Reimportar a mesma planilha atualiza o mesmo produto e as mesmas variações, sem duplicar.
8. Produtos importados pela versão anterior (um por linha) continuam válidos; ninguém os apaga. Reimportar a planilha no modo novo cria o produto único; os antigos podem ser desativados à mão.
9. Fotos: a foto de uma variação é visível ao cliente como as outras fotos do catálogo (tipos escondidos continuam escondidos), sem o teto de 8 por produto bloquear o acesso.

## 5. Telas

- **Cadastro do produto**: seção "Variações" (tabela: foto, nome, código de fábrica, tamanho, preço, MOQ, caixa master/inner, pesos, medidas, CBM, cores, material; situação), com formulário para adicionar/editar e botão desativar/reativar. Ações: `saveProductVariantAction`, `toggleProductVariantAction`.
- **Catálogo (lista)**: preço "a partir de" e selo "N variações".
- **Importar ficha técnica**: opção "Resultado" (um produto com variações / um produto por linha); o resultado mostra o produto e as variações criadas/atualizadas.
- **Nova solicitação**: ao escolher um produto com variações aparece o campo "Variação" (obrigatório), que preenche especificação, MOQ e foto.
- **Solicitação, cotação e pedido**: mostram a variação (nome e, para a Wellmix, os valores do snapshot).
- **Vitrine**: seletor de variação na página do produto; carrinho com a variação em cada item.

## 6. Papéis

Wellmix (admin/operador) cria e edita variações; cliente escolhe na vitrine e na solicitação; fornecedor vê a variação na cotação e no pedido como parte da ficha. Nenhuma permissão nova.

## 7. Testes

Unitários: serviço de variações (upsert por chave, referência, sync), importação (um produto com N variações; reimportação sem duplicar; modo antigo), MOQ por variação, solicitação com/sem variação (`variant_required`, `variant_invalid`, snapshot), cotação prefill, pedido (snapshot e adopt na variação), carrinho (duas variações do mesmo produto, MOQ, checkout) e vitrine (filtro do cliente). E2E: caminho principal continua com produtos sem variação.

## 8. Publicação

`npm run appwrite:config` e, depois do deploy, a Action "Publicar esquema Appwrite" (tabela nova, colunas novas e a troca do índice do carrinho). Até lá, o portal lê "sem variações" (`isSchemaMissing`) e só envia as colunas novas quando há variação.
