# Booking: os produtos antes da solicitação

Tela **Pedidos → Booking** (`/app/booking`), só da Wellmix. É onde os produtos que chegam pela ficha técnica (planilha SUPPLIER INFO) são trabalhados antes de existir solicitação: análise de preço no Superplan, aprovação, oferta ao cliente, reserva e, no fim, "Gerar solicitação".

O nome "booking" também existe na etapa de embarque (reserva no navio, `import_steps`). São coisas diferentes: esta tela é a fila de produtos antes do pedido; a reserva do navio continua onde está.

Onde está cada parte:

| Parte                                                     | Arquivo                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Regras puras (etapas, quem move, filtros, colunas)        | `src/lib/booking.ts`                                                    |
| Peso bruto estimado                                       | `src/lib/weights.ts`                                                    |
| Serviço (ler linhas, gravar, analisar, gerar solicitação) | `src/lib/services/booking.ts`                                           |
| Entrada pela importação                                   | `src/lib/services/booking-intake.ts`                                    |
| Vitrine (quem está escondido do cliente)                  | `src/lib/services/booking-visibility.ts`                                |
| Ações                                                     | `src/app/app/actions/booking.ts`                                        |
| Telas                                                     | `src/app/app/booking/`                                                  |
| Textos                                                    | `src/i18n/modules/booking.ts`, `booking-screen.ts`, `booking-detail.ts` |

## 1. Problema

- A ficha técnica importada virava **um produto com variações** (uma variação por linha). Para o dono, cada linha é um **produto diferente**.
- O produto importado aparecia na vitrine do cliente na hora, antes de alguém olhar preço, margem e se vale a pena.
- Tudo o que acontece entre "chegou a planilha da feira" e "abrir a solicitação" (analisar, aprovar, oferecer, reservar para um cliente) ficava fora do sistema.

## 2. Objetivo

Uma tela em linhas, uma por produto, alimentada pela importação da ficha, onde a Wellmix:

- vê tudo o que veio da planilha e filtra por **qualquer coluna**;
- acompanha a **etapa** de cada produto;
- guarda a **análise do Superplan** (preço de venda e sinal verde/amarelo/vermelho);
- reserva quantidade para um cliente;
- marca várias linhas e gera **uma solicitação** (lote) com todas.

## 3. Decisões do dono (9/11/2026)

1. Etapas: Novo → Em análise → Aprovado → Oferecido ao cliente → Reservado pelo cliente → Virou solicitação; e Descartado.
2. Só a Wellmix usa.
3. Cada linha da ficha vira produto do cadastro na hora (ficha mestre, fotos, fornecedor), mas **fica fora da vitrine até ser aprovada no Booking**.
4. Linhas seguidas com o mesmo código e só a cor diferente são **um produto só**; as cores ficam como cores dele.
5. Colunas: as da planilha, mais etapa, cliente, quantidade reservada, preço de venda e sinal do Superplan, responsável, data de entrada, planilha de origem e observação; e os pesos (**líquido, bruto e "médio"**), que também vão para o Superplan.
6. Saída: marcar as linhas, escolher o cliente e "Gerar solicitação" (um lote com as quantidades reservadas).
7. Planilhas antigas (importadas como variações) ficam como estão; há um botão para reimportar uma planilha antiga direto no Booking.

**Pendente de confirmação do dono: o que é o "peso médio".** Não existe esse campo em nenhuma planilha lida até hoje. Há duas leituras possíveis, e as duas estão na tela, cada uma com o seu nome:

- **Peso estimado (kg)**: o peso bruto da ficha quando ela traz; senão o peso líquido mais a folga da embalagem (8% por padrão; a planilha da feira usa `N.W × 1,08`).
- **Média (US$)**: a média informada pelo despachante na ficha mestre (`purchase_sheets.averagePrice`), que já existia.

## 4. Requisitos funcionais

- **Entrada**: na importação da ficha técnica, a opção "Mandar para o Booking (um produto por linha)" é a primeira e já vem marcada para quem abre o Booking. Cada grupo de linhas vira um produto (como o modo "um produto por linha") e uma linha do Booking, ligada à planilha de origem. As outras duas opções continuam.
- **Reimportar uma planilha antiga**: no resultado de uma importação antiga, "Mandar para o Booking" relê o arquivo guardado e cria os produtos e as linhas. O produto antigo com variações não é alterado.
- **Lista**: uma linha por produto, 100 por página, com cartões das etapas (contagem; tocar filtra), busca geral, filtro em toda coluna (logo abaixo do título), ordenação por qualquer coluna e o filtro guardado no endereço. A coluna do produto fica parada ao rolar para o lado.
- **Ações em várias linhas** (barra acima da tabela): salvar cliente e quantidades, mover de etapa, trocar o responsável, analisar no Superplan, gerar solicitação.
- **Página da linha** (`/app/booking/[id]`): etapa, cliente, quantidade reservada, responsável e observação num formulário; dados da ficha; análise do Superplan; histórico. Só o que a pessoa mudou é gravado: salvar uma observação numa página aberta há tempo não desfaz a etapa, o cliente ou a reserva que alguém mudou nesse meio-tempo.
- **Superplan**: aberto a partir da linha (`/app/superplan?booking=<id>`), já com o produto; "Gravar no Booking" guarda o tipo de negócio, o preço testado e o resultado. Também há "Analisar no Superplan" para várias linhas de uma vez (com os valores padrão).
- **Vitrine**: produto em Novo, Em análise ou Descartado não aparece para o cliente (vitrine, página do produto, carrinho, nova solicitação, busca por foto, fotos e documentos do produto, kits de marketing).

## 5. Regras de negócio

1. Uma linha do Booking por produto (índice único). Reimportar a mesma planilha atualiza o produto e **não** cria outra linha nem muda a etapa.
2. **Entrada**: o produto que a planilha **criou** entra em **Novo** (fora da vitrine). O produto que **já existia** no cadastro (a planilha só o atualizou) entra em **Aprovado**: ele já estava na vitrine e a importação não tira da vitrine o que já se vende.
3. **Etapas** (`BOOKING_FLOW` + `discarded`):
   - "Virou solicitação" só é gravada pelo "Gerar solicitação".
   - Mudança que **põe o produto na vitrine ou tira dela** (aprovar; voltar um aprovado para Novo ou Em análise; descartar um aprovado; recuperar um descartado direto para aprovado) é de quem **analisa**: quem abre a tela Superplan (hoje, o administrador; ele pode liberar a tela a outro login em Equipe).
   - Reabrir uma linha que já virou solicitação: também de quem analisa. A ligação com a solicitação antiga sai da linha (fica no histórico).
   - O resto (Novo ↔ Em análise; descartar ou recuperar antes de aprovar; Aprovado ↔ Oferecido ↔ Reservado): qualquer login com a tela.
4. **O que a etapa exige**: Oferecido precisa de cliente; Reservado, de cliente e quantidade. A quantidade reservada é inteira, positiva e **nunca abaixo do pedido mínimo** do produto (ficha mestre, senão cadastro).
5. **Cliente**: empresa cliente ativa, ou "Estoque Wellmix" (compra para estoque, a mesma empresa interna da Nova solicitação). Oferecer ou reservar confere de novo: cliente que deixou de estar ativo é recusado, com a linha. **Responsável**: login ativo da Wellmix; quem importou a planilha, até alguém trocar.
6. **Várias linhas**: tudo ou nada. Primeiro todas são conferidas; a primeira recusa cancela a ação inteira e a tela destaca a linha. No máximo 100 linhas por ação. A quantidade digitada na linha e o cliente escolhido na barra valem só para as linhas marcadas.
7. **Vitrine**: escondem o produto as etapas Novo, Em análise e Descartado. Aprovado em diante aparece. Produto sem linha no Booking nunca é escondido.
8. **Gerar solicitação**: só linhas em Aprovado, Oferecido ou Reservado, no máximo 30 por vez, e só para quem também abre Solicitações. Todas viram um lote do cliente escolhido (sem escolha, o cliente das linhas, se for um só). Linha reservada para **outro** cliente recusa o envio inteiro (nada é criado). Quantidade: a digitada na linha, senão a reservada, senão o pedido mínimo do produto; sem nenhuma, recusa dizendo qual linha. Produto com variações recusa (use a Nova solicitação, que pede a variação). Depois: as linhas vão para "Virou solicitação" com o cliente, a quantidade e o número da solicitação, e ficam travadas (cliente e quantidade mudam na solicitação). As linhas são tomadas (vão para "Virou solicitação") **antes** de a solicitação nascer e relidas: duas chamadas juntas para a mesma linha não criam duas solicitações, e se a criação falhar as linhas voltam para onde estavam. **Excluir a solicitação** gerada solta a linha: ela volta para Reservado (ou Aprovado, sem cliente e quantidade), sem a ligação, e pode gerar de novo.
9. **Análise do Superplan** (só quem abre o Superplan): guarda um retrato (`analysis`): tipo de negócio, preço de venda, custo por peça, preço mínimo, lucro %, meta, sinal, preço para a meta, o que faltou e o que foi considerado (câmbio, II/IPI, container, frete, peso estimado). O resultado é sempre refeito no servidor; nunca vem do navegador. A lista mostra o retrato com a data; não recalcula sozinha. Analisar uma linha em Novo leva para Em análise.
10. **Pesos**: peso líquido e peso bruto por peça, cada um na sua coluna, do jeito que a planilha traz (N.W e G.W). **Peso bruto vazio fica vazio**: o líquido nunca é lido como bruto. O peso estimado (regra da decisão 5) é só uma conta, marcada com "≈", e nunca é gravado como peso bruto do produto.
11. **Média (US$)**: só informação. Não entra em nenhuma conta de imposto ou custo; os impostos são sempre sobre o valor real da compra (ver `docs/SUPERPLAN.md`).

## 6. Casos especiais

- Tabela `bookings` ainda não publicada no Appwrite: a tela mostra o aviso de esquema desatualizado; a importação para o Booking recusa antes de criar qualquer produto; a vitrine e as outras telas seguem como antes (ninguém fica escondido nem a página quebra).
- Produto apagado ou desativado no cadastro: a linha continua, marcada "produto fora do cadastro", fica de fora da análise em lote e não gera solicitação. Excluir o produto de vez apaga a linha dele.
- Limpeza dos dados de venda (Configurações): a linha fica; a que tinha virado solicitação volta para Reservado (ou Aprovado, sem reserva), sem a ligação.
- Planilha com mais de 80 produtos: a importação recusa, como hoje (dividir a planilha).
- Importação interrompida ou com falha: a linha do Booking de um produto novo nasce **antes** do próprio produto (com o id que ele vai ter), então em nenhum momento existe produto novo no cadastro sem a linha que o mantém fora da vitrine. Se a criação do produto falhar, a linha sai junto. Se a importação cair entre a linha e o produto, sobra uma linha em Novo sem produto: a importação seguinte a retira (depois de 10 minutos, para não mexer numa importação ainda rodando). Reimportar completa o que faltou; produto que nasceu numa importação com falha continua em Novo (não é tratado como "já estava no cadastro").
- Sem câmbio do dia, sem volume da caixa ou sem preço: a análise fica "falta dado" e diz o quê.
- Produto sem NCM na tabela fiscal: a análise usa II e IPI 0 e avisa "sem NCM" (o sinal sai otimista; ajustar no Superplan e gravar).
- Cliente inativo ou que não é cliente: recusado.
- Filtro com endereço estragado: o que não dá para ler é ignorado.
- Recompra pelo pedido ("comprar de novo"): continua como era, mesmo que o produto esteja escondido ou desativado (o produto vem do pedido que o cliente já tem, não do formulário).
- Produto que volta a ficar escondido depois de um pedido ou kit: o kit já oferecido continua aberto para o cliente; kit novo e oferta nova são recusados.

## 7. Fluxo do usuário

1. Cadastros → Produtos → Importar ficha técnica → envia a planilha (opção "Mandar para o Booking" já marcada).
2. Pedidos → Booking: as linhas aparecem em **Novo**.
3. Marca as linhas → "Analisar no Superplan": cada uma ganha custo, preço mínimo, lucro e sinal, e vai para **Em análise**. Para ajustar uma, abre o Superplan pela linha, testa o preço e "Gravar no Booking".
4. Aprova as que valem a pena (**Aprovado**): entram na vitrine. Descarta as outras.
5. Escolhe o cliente na barra, digita a quantidade nas linhas e move para **Oferecido** ou **Reservado**.
6. Marca as linhas do cliente → "Gerar solicitação": nasce o lote; as linhas vão para **Virou solicitação** com o link.

## 8. Papéis e permissões

| Quem                                                                                               | O que pode                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador                                                                                      | Tudo.                                                                                                                                                             |
| Operador com a tela Booking (funções comprador, gerente de produto, planner, cadastro; diretorias) | Ver, filtrar, editar cliente, quantidade, responsável e observação, mover entre etapas que não mexem na vitrine, gerar solicitação (se também abre Solicitações). |
| Quem abre o Superplan (hoje só o administrador)                                                    | Além disso: analisar, ver preço de venda, custo e sinal, aprovar, tirar da vitrine, reabrir.                                                                      |
| Cliente, fornecedor, parceiros                                                                     | Nada: não veem a tela nem os produtos escondidos.                                                                                                                 |

Colunas e filtros de preço de venda e sinal só existem para quem abre o Superplan (a análise nem sai do servidor para os outros).

## 9. Estrutura do banco de dados

Tabela nova `bookings` (aditiva):

| Coluna                                     | Tipo            | Observação                                                                                         |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `productId`                                | id, obrigatório | único (`product_unique`)                                                                           |
| `status`                                   | enum            | `new`, `analysis`, `approved`, `offered`, `reserved`, `requested`, `discarded`; índice `by_status` |
| `importBatchId`                            | id              | lote da importação; índice `by_batch`                                                              |
| `sourceFileName`                           | texto 200       | planilha de origem                                                                                 |
| `sourceRows`                               | texto 40        | linhas da planilha ("3-5")                                                                         |
| `sourceOrder`                              | inteiro         | primeira linha (ordem da planilha)                                                                 |
| `customerId`                               | id              | cliente da oferta ou reserva                                                                       |
| `reservedQty`                              | inteiro         |                                                                                                    |
| `ownerUserId`                              | id              | responsável                                                                                        |
| `note`                                     | texto 500       | observação                                                                                         |
| `analysis`                                 | JSON            | retrato da análise do Superplan                                                                    |
| `requestId`, `requestGroupId`              | id              | solicitação gerada                                                                                 |
| `requestNumber`                            | inteiro         |                                                                                                    |
| `statusChangedAt`, `statusChangedByUserId` | data, id        | última mudança de etapa                                                                            |
| `createdByUserId`                          | id              | quem importou                                                                                      |

Nenhuma coluna nova nas tabelas que já existem. O "escondido da vitrine" não é uma coluna do produto: sai da etapa da linha (uma fonte só da verdade).

## 10. APIs e integrações

Sem integração externa. Server Actions (todas conferem papel Wellmix e a tela Booking):

- `bulkBookingAction`: a barra de ações (`op` = `assign`, `move`, `owner`, `analyze`, `request`).
- `saveBookingRowAction`: o formulário da página da linha.
- `saveBookingAnalysisAction`: "Gravar no Booking" do Superplan (pede também a tela Superplan).
- `reimportSheetToBookingAction` (em `actions/product-sheet-import.ts`): reimportar planilha antiga.

## 11. Automações

- A importação cria as linhas, liga à planilha e põe o importador como responsável.
- "Analisar no Superplan" em lote, com os valores padrão (câmbio do dia, container e tipo de negócio padrão, despesas dos parâmetros, II/IPI do NCM).
- Analisar leva de Novo para Em análise; gerar solicitação leva para "Virou solicitação".
- Aprovar põe o produto na vitrine sem outro passo.
- Digitar a quantidade numa linha já marca a linha; escolher um filtro de opção ou de data já filtra.

## 12. Relatórios, 13. Dashboards, 14. Indicadores

Na própria tela: cartões com a contagem por etapa (viram filtro), total filtrado e, para quem abre o Superplan, o filtro "sinal" (viável, abaixo da meta, prejuízo, falta dado, sem análise).

## 15. Auditoria

Toda mudança grava em `audit_log` (entidade `booking`): `booking.create` (importação), `booking.move` (etapa), `booking.update` (cliente, quantidade, responsável, observação), `booking.analysis`, `booking.request`, `booking.release` (a solicitação foi excluída e a linha voltou) e `booking.sweep` (linha sem produto retirada), com o antes e o depois. A página da linha mostra o histórico. O registro de `booking.analysis` guarda só a etapa, o sinal e a data: **custo, preço e lucro não vão para a auditoria**, porque a tela Auditoria é aberta por quem não abre o Superplan.

## 16. Segurança

- Página com `requireScreen("booking")`; toda ação e todo serviço conferem papel Wellmix e a tela; aprovar e analisar conferem a tela Superplan; gerar solicitação confere a tela Solicitações.
- Cliente, fornecedor e parceiros não recebem nada do Booking.
- Produto escondido não abre para o cliente nem pelo endereço direto: vitrine, página do produto, carrinho, nova solicitação (lista, envio e nome do produto), busca por foto (o produto nem vai para a IA), fotos da vitrine e documentos do produto (`/api/files`), kit de marketing novo. A recusa é a mesma para "não existe", "desativado" e "escondido" (não dá para descobrir se um produto existe).
- Entradas validadas no servidor (zod): ids, quantidade, etapa, texto com tamanho máximo, simulação do Superplan (números com limite).
- Nada foi afrouxado: todas as mudanças nas telas do cliente só acrescentam restrição.

## 17. Limites conhecidos

- A lista lê todas as linhas e filtra em memória (como as outras telas). O armazenamento devolve até 10.000 linhas por leitura; muito antes disso vale arquivar os descartados.
- A marcação das linhas vale para a página atual (100 linhas) e se perde ao filtrar ou trocar de página.
- O armazenamento não tem "trocar só se ainda estiver como li". O "Gerar solicitação" toma as linhas e relê antes de criar, o que cobre o toque duplo, duas abas e dois logins; sobra uma janela de poucos milissegundos em que duas chamadas simultâneas ainda poderiam passar juntas.
- Nos filtros de número, colunas de peças e caixas leem "1.200" como mil e duzentos; preço, peso e CBM leem o ponto como decimal.
- A foto da linha é o arquivo original (o `/api/files` não gera miniatura).
- O navegador guarda a foto por até uma hora: esconder de novo um produto não apaga a foto que o cliente já abriu.

## 18. Melhorias futuras

- Reserva por vários clientes no mesmo produto e quantidade por cor.
- Ler as colunas da Wellmix na planilha da feira (caixas por programação, total de peças, CBM e containers): o plano de compra já viria pronto.
- Reanalisar sozinho quando o câmbio ou o frete mudam e avisar quem passou de verde para amarelo ou vermelho.
- Cartão do Booking na Control Tower (antes do pedido).
- Aviso ao responsável quando a linha dele é aprovada, e ao cliente quando um produto oferecido a ele entra na vitrine.
- Colunas escolhidas e filtros salvos por login; exportar a lista filtrada.
