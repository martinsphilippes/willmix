# Plano de evolução incremental

Regra desta etapa: **preservar → analisar → reaproveitar → complementar → integrar → testar**. Nada foi removido: telas, rotas, campos, tabelas e fluxos anteriores continuam iguais. Tudo aqui é aditivo e compatível com registros antigos (colunas novas são opcionais; registros antigos ficam com `null`).

## Classificação dos requisitos (Prioridade Agora)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 8 | Sourcing / compras na China | Não existia (o fluxo começava na solicitação) | **Novo**: `supplier_visits`, `sourcing_items`, `product_photos`, `measurements`; telas em `/app/sourcing` |
| 9 | Experiência mobile para sourcing | PWA/manifest já existia; formulários eram de mesa | **Ampliado**: formulários mobile-first, `PhotoInput` com câmera e compressão no aparelho |
| 10 | Histórico de visitas | Não existia | **Novo**: `supplier_visits` (participantes, produtos encontrados, próxima visita, follow-up) |
| 11 | Importação do sistema chinês | Existia CSV direto para parceiros/produtos/linhas (`services/import.ts`), sem preview nem matching | **Ampliado**: `import_batches` com XLSX/CSV → mapeamento → preview → decisão por linha (criar/atualizar/ignorar). O CSV direto antigo continua funcionando |
| 12 | Ficha completa do produto | `Product` tinha só nome, SKU, linha, especificação | **Ampliado**: 25 colunas opcionais (fornecedor, MOQ, preço, caixas, pesos, dimensões, CBM, material, cor, Pantone, fotos, origem, data da negociação). Sem segundo cadastro |
| 13 | Foto original como evidência | Documentos já tinham versionamento; fotos eram só por requisito de pedido | **Novo**: `product_photos.kind` (original × commercial) com `derivedFromPhotoId`; a original nunca é substituída |
| 14 | Evidências de dimensões | Não existia | **Novo**: `product_photos.kind` dimension_front/side/depth/height/scale/other. Sem LiDAR |
| 15 | Evidência de peso | Só requisito `weight` por pedido | **Novo**: `measurements` (declarado × medido, unidade, foto, responsável, data) |
| 16 | Snapshot da negociação | Pedido copiava só FOB e preço de venda | **Novo**: `purchase_snapshots` criado ao nascer o pedido; retroativo sob demanda (`ensureSnapshot`) |
| 17 | Programação de compra | Não existia | **Novo**: `purchase_schedules`, ligado a produto/cliente/pedido |
| 18 | Container e CBM | Não existia | **Novo**: `containers` + `container_items`; tipos e capacidades em `settings.containerTypes` (nada fixo em 68 m³); cálculo determinístico em `src/lib/logistics/cbm.ts` |
| 19 | Mix de produtos | — | Vários itens por container; o mesmo cliente pode ter vários produtos |
| 20 | Regra de consolidação | — | Documentada e codificada: clientes diferentes não são juntados automaticamente (`containerAllowMultiCustomer = false`) |
| 21 | Financeiro do fornecedor | Conta corrente existia (`/app/account`) com pedidos, pagamentos, saldo e confirmação | **Ampliado**: trilha visualizado/confirmado por pagamento, câmbio e comprovante na tabela |
| 22 | Confirmação de visualização | Não existia (só `notifications.readAt`) | **Novo**: `acknowledgements` (viewed ≠ confirmed) para documentos e pagamentos |
| 23 | Inspeção cega | Fornecedor via o peso declarado; comparação só de peso | **Ampliado**: inspetor informa só o encontrado; esperado vem do snapshot e fica oculto; requisitos extras opcionais na inspeção |
| 24 | Comparação comprado × inspecionado | Só peso vs. preparação | **Ampliado**: `inspection_results` com peso líquido/bruto, dimensões, CBM da caixa, caixas, material, cor; tolerâncias em settings |
| 25 | Gates e fila de revisão | Bloqueio de etapa + `blockReason` só para peso | **Novo**: `review_items` (esperado × encontrado, regra, responsável, ação) alimentado pela inspeção, preço zerado e container; tela `/app/reviews` |
| 26 | IA ≠ regra de negócio | — | Princípio registrado abaixo; nenhuma regra determinística usa IA |
| 27 | Dashboard financeiro/operacional | Control Tower tinha buckets por etapa; financeiro em `/app/finance` | **Ampliado**: `loadTowerTotals` reutiliza o financeiro (nenhuma segunda Control Tower) |
| 28 | Visão comercial | Não existia | **Novo, só com dados reais**: vendido × disponível por container = itens com pedido × sem pedido (volume) |

## Classificação dos requisitos (Segunda Onda)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 30 | NCM / tributação | Nenhum campo ou tabela | **Novo**: `tax_classifications` (candidatas por heurística de palavras-chave, despachante, manual ou IA quando houver) com validação humana obrigatória; só a validada vai para `products.ncm` e para o snapshot. Rota `/app/products/[id]/tax` para o despachante |
| 31 | Integração mais profunda com o sistema chinês | Sem API, exportação estruturada ou webhook conhecidos | **Desconsiderado por ora**: XLSX/CSV continua o método oficial (`docs/INTEGRATIONS.md` traz a lista do que verificar antes de automatizar). Nada de scraping |
| 32 | Certificações e compliance | Nada além do checklist da linha | **Novo**: `certifications` (produto ou fornecedor, documento, validade), `product_lines.requiredCertifications`; gate na criação do pedido (item de revisão + requisito `compliance_check`); certificação a vencer vira exceção na Control Tower |
| 33 | Pós-venda | `CLOSED` era o fim | **Novo, sem mudar `STAGE_KEYS`**: `after_sales` aberto ao concluir DELIVERED; pendência do cliente; Wellmix encerra |
| 34 | Análise de oportunidade | Nenhuma | **Novo, determinístico**: faixas de preço (`products.priceTiers`) → custo marginal até a próxima faixa com fórmula exibida; espaço livre em container do cliente → caixas que cabem. Nada estimado por IA |
| 35 | Reposição | Fluxo de solicitação já existia | **Reutilizado**: `createFollowUpRequest` cria a solicitação (origem `replenishment`) a partir do pedido; nenhum segundo motor de compras |
| 36 | Nova proposta | Idem | **Reutilizado**: mesma função com origem `proposal`; pré-preenchida com produto, quantidade e especificação |
| 37 | Histórico comercial | Financeiro e Control Tower existiam; nada por cliente × produto | **Novo**: `loadCommercialHistory` (compras, quantidade, custo, datas, frequência média, reposições, interesse em recompra); FOB só para a Wellmix |
| 38 | Sourcing sob demanda | Solicitação sem produto já era possível | **Ampliado**: origem `sourcing_demand` cria item de sourcing para o time na China; promovido, o produto volta à solicitação e a RFQ segue normal |

### Desconsiderado (já atendido ou fora desta onda)

- **Cadastro de fornecedor, produto, cliente, pedido, pagamento, documento, notificação**: já existem; foram ampliados, não recriados.
- **Workflow de pedidos e etapas**: preservado por inteiro; `STAGE_KEYS` não mudou (pós-venda virá como entidade própria, não como etapa nova, para não migrar pedidos abertos).
- **Aplicativo nativo**: o PWA responsivo resolve; fora do escopo.
- **Medição 3D/LiDAR**: estrutura preparada (`product_photos.kind`), sem implementação.
- **Motor automático de consolidação entre clientes**: proibido por regra de negócio.
- **Estoque/“disponível” fora de container**: não há dados; a visão comercial só calcula sobre itens de container sem pedido.
- **Segunda parcela do fornecedor, extrato por período, câmbio de referência**: continuam no `BACKLOG_FUTURO.md`.

## Classificação dos requisitos (Visão de Produto)

| # | Requisito | Situação encontrada | Decisão |
| --- | --- | --- | --- |
| 40 | IA de cadastro por foto | Fotos e ficha existiam; nenhuma sugestão automática | **Novo**: `ai_suggestions` + `src/lib/integrations/ai.ts` (modos `api` com `ANTHROPIC_API_KEY`, `mock` rotulado, `manual`). FOTO → ANÁLISE → SUGESTÃO → HUMANO CONFIRMA campo a campo → CADASTRO. Material e dados comerciais só entram se o operador escolher; preço/MOQ/dimensões nunca são sugeridos |
| 41 | Prompts por Product Line | Nenhum prompt no sistema | **Novo, centralizado**: `src/lib/ai/prompts.ts` (Prompt Base + Linha + Produto + Contexto) e `product_lines.prompts` (descrição, marketing, imagem, atributos exigidos, regras). Atributos exigidos são conferidos por código (`checkRequiredAttributes`), não por IA |
| 42 | Marketing studio | Fotos comerciais (`product_photos.kind = commercial`) existiam | **Novo, alimentado pela ficha**: `marketing_kits` (conceito, slogan, descrição, campanha, cores, Pantone, prévias, arquivos finais); textos sugeridos por IA com confirmação; reutiliza documentos e fotos |
| 43 | Prévia do marketing | Nenhuma | **Novo**: prévias visíveis ao cliente a partir da oferta; arquivos finais só depois da liberação (`canViewKitDocument`) |
| 44 | Venda de kit de marketing | Nenhuma | **Novo, reutilizando `payments`**: preço por kit com padrão em `marketingKitDefaultPrice` (nada de R$ 200 fixo); compra cria pagamento `customer_in` (modo manual); Wellmix confirma e libera |
| 45 | Plataforma multi-importador | Wellmix implícita em `WELLMIX_ROLES` e nas configurações globais | **Preparado, sem virar SaaS**: `users.importerId` e `parties.importerId` (nulos = Wellmix), `importerName` nas configurações e estratégia registrada em `docs/ARQUITETURA.md`. Nenhum filtro mudou |
| 46 | Cliente com ou sem RADAR | Nenhum campo | **Novo**: `parties.operationMode` (importação própria, via trade, outra) + `radar`; o pedido copia a modalidade (`orders.operationMode`); importação própria sem RADAR abre item de revisão (`customer.radarMissing`). Cadastro antigo = "não informado", sem gate |
| 47 | Ciclo contínuo | Fluxo terminava no pedido; pós-venda e reposição vieram na Segunda Onda | **Ampliado**: `loadProductCycle` reúne sourcing → produto → solicitações → pedidos → pós-venda → reposição → kits por relacionamento; macrofluxo em `docs/SCOPE.md` |
| 48 | Princípio de dados | Produto já era a origem da ficha e do snapshot | **Reutilizado**: nada duplicado; kit, sugestão e ciclo apontam para o produto; snapshots continuam onde a história importa |

## Implementado na Visão de Produto

- Esquema aditivo (34 tabelas): `ai_suggestions`, `marketing_kits`; `product_lines.prompts`; `parties.operationMode/radar/radarNotes/importerId`; `users.importerId`; `orders.operationMode`; `documents.kitId`; `payments.kitId`.
- `src/lib/ai/prompts.ts` (prompts centralizados, conferência determinística de atributos), `src/lib/integrations/ai.ts` (adaptador api/mock/manual), `services/ai-suggestions.ts`, `services/marketing.ts`, `services/operations.ts`, `services/product-cycle.ts`; gate de operação em `createOrderFromRequest`; acesso a arquivos de kit em `canAccessDocument`.
- Configurações: `aiMode`, `aiModel`, `marketingEnabled`, `marketingKitDefaultPrice`, `marketingKitCurrency`, `radarGateEnabled`, `importerName`.
- Actions em `src/app/app/actions/vision.ts`; 7 testes novos (29 no total).

### Busca de produto por foto ou link (nova solicitação)

- `/app/requests/new` ganhou "Encontrar o produto por foto ou link" (cliente e Wellmix). A foto dispara a busca sozinha; o link é lido com segurança (Open Graph e JSON-LD, sem endereços internos, tempo e tamanho limitados).
- Catálogo: mesma foto por impressão digital visual (dHash via `sharp`, sem IA; `documents.imageHash`), mesma foto do link, nome ou SKU parecido com o do link e, com IA, produto reconhecido na lista do catálogo. "Usar este produto" seleciona o item.
- Sem produto: cada campo (nome, descrição, especificação) recebe várias sugestões com a origem (link, catálogo, IA). "Nenhuma dessas" vem marcado; nada é preenchido sem a escolha da pessoa. Sem correspondência, "produto fora do catálogo" vem marcado.
- A foto enviada vira anexo da solicitação e o link vai para a observação. Registro em `product_lookups`. Serviços: `services/product-lookup.ts`, `services/image-hash.ts`, `integrations/link-preview.ts`.
- Reconhecer o mesmo produto em outra foto (ângulo, mão, fundo diferentes) é trabalho da IA: a foto do cliente e as fotos do catálogo (rotuladas com o id) vão juntas na mesma chamada, e só confiança média/alta vira correspondência. A impressão digital continua achando a mesma foto sem IA. Medido: descritores simples (cor, contorno) não separam o produto do fundo quando as fotos são tiradas no mesmo lugar; modelo local (CLIP) não cabe numa função da Vercel (motor de 536 MB).
- Relacionados: além do mesmo produto, a busca lista os cadastrados da mesma família (grupos da tabela de NCM: "iPhone" e "Celular" caem em smartphones) ou com palavra significativa em comum (plural tratado; cores e termos de anúncio ignorados). Sugestões de preenchimento vêm só do que parece ser o mesmo produto.
- Mercado Livre: link lido pela API oficial (`/items`, `/products`, `/categories`: título, fotos, marca, modelo, cor, categoria); a página só é lida se a API não responder, e título que é só o nome da loja ("Mercado Libre") não conta como produto. `MERCADOLIVRE_ACCESS_TOKEN` é opcional, para quando a API exigir autenticação.
- Limite: muitos marketplaces chineses bloqueiam a leitura automática do link (a tela avisa).
- Escolher um produto da Wellmix preenche nome, descrição e especificação com a ficha e mostra as fotos do cadastro (até 8; principal primeiro). O cliente abre só as fotos de produto ativo; uma original com versão comercial dá lugar a ela, e a original segue como evidência para a Wellmix (`catalogShowcasePhotos` e `canAccessDocument` em `services/documents.ts`). Fornecedor e fotos só de sourcing continuam fechados.

### Ficha de compra na Preparação (planilha COMPRAS)

- Nova tabela `purchase_sheets` (uma por pedido) com todos os campos da planilha: data, local, fornecedor, nº da loja em Yiwu, telefone, código do item na fábrica, FOB/EXW, moeda U$/RMB, preço, MOQ, peças por caixa master e inner, peso líquido e bruto por peça, CBM e medidas da caixa master, capacidade (ml), embalagem, cor/sortimento, material, função/energia, início da produção, programação em até 3 lotes, NCM, I.I., IPI e descrição para e-commerce.
- Calculado, não digitado (`services/purchase-sheet-calc.ts`): peças e CBM por lote, totais, containers (CBM ÷ capacidade do tipo escolhido em Configurações) e datas de saída (início da produção + intervalos acumulados). Conferido com os números da planilha.
- Tela `/app/orders/[id]/purchase-sheet`, pensada para o celular: rascunho pré-preenchido com o cadastro do produto, a cotação e o fornecedor; salvar a qualquer momento; fotos por tipo, várias por tipo (balança, régua, lado, outros ângulos, origem, prompt, cartão de visita), guardadas no pedido e nunca no catálogo do cliente.
- Checklist padrão da Preparação: só "Ficha de compra", que se conclui sozinha com os obrigatórios e as 2 fotos obrigatórias (balança e régua/medida com escala). Fotos: uma linha por tipo, verde com check quando enviada; escolher ou tirar a foto já envia (redução no aparelho em paralelo, envio em paralelo no servidor). Cada miniatura tem a lixeira (com confirmação) para quem pode enviar fotos: a foto sai da ficha e dos documentos do pedido, o arquivo é apagado e a exclusão fica na auditoria. O peso comparado na inspeção é o peso líquido por peça da ficha (pedidos antigos sem ficha usam o item "Peso (kg)"). Dieline, foto profissional, peso, foto na balança e etiqueta saíram do checklist a pedido: a ficha os substitui. O item "Ficha de compra" não aceita envio direto.
- Acesso: Wellmix e fornecedor do pedido editam; despachante do pedido edita só NCM/I.I./IPI; cliente nunca vê.
- Dados existentes: `npm run appwrite:purchase-sheet` (simulação; `-- --apply` grava) deixa só a ficha nas linhas com o checklist padrão antigo e, nos pedidos com Preparação em aberto, adiciona a ficha e remove os cinco itens antigos quando estão vazios. Item já enviado fica.
- Próximos passos: importar a planilha (.xlsx) direto na ficha, exportar a ficha em Excel, aplicar os dados conferidos na ficha do produto e gerar `purchase_schedules` a partir dos lotes.

### Sinal por Pix e comprovante do cliente

- Proposta aguardando sinal mostra "Pague com Pix": QR Code, Pix copia e cola com botão de copiar, recebedor, chave, valor e referência da solicitação (`WMX` + id). Código BR Code estático do Banco Central gerado no servidor (`services/pix.ts`, CRC16 conferido com o manual), sem banco: a confirmação continua manual.
- A chave (CPF, CNPJ, e-mail, celular +55 ou aleatória, validada no servidor) fica em Configurações (admin). Sem chave, ou com valor fora de BRL, a tela explica e não mostra Pix.
- Recebedor e cidade não aparecem mais na tela. São obrigatórios dentro do código, mas só informativos: quem paga vê, na confirmação do banco, o titular real da chave. O sistema usa o que já estiver salvo; se estiver vazio, usa o nome da importadora e "BRASIL" (`pixReceiver`).
- O cliente anexa o comprovante (foto ou PDF) na própria solicitação (`submitDownPaymentProofAction`; só o login que vê a solicitação, só aguardando sinal). O pagamento segue pendente, a Wellmix é avisada, vê o comprovante e confirma; a pendência sai do cliente e a da Wellmix diz que o comprovante chegou. Fornecedor não abre o comprovante.

### Pagamento ao fornecedor

- Na etapa "Pagamento ao fornecedor" o painel mostra o valor a pagar: FOB do pedido menos o que já foi registrado na mesma moeda (`services/supplier-payment.ts`).
- Três ações de um clique: copiar os dados de transferência para o banco (beneficiário, banco, conta/IBAN, SWIFT, valor e referência `WELLMIX PO #N`, em inglês), pedir ao financeiro por e-mail (`mailto:`) ou pedir por WhatsApp (`wa.me`). Cada uma registra o pagamento como pendente, conclui o item "Pagamento ao fornecedor registrado" e avisa o fornecedor.
- O registro manual com valor, câmbio e comprovante continua, recolhido em "Já pagou?", e grava o pagamento como confirmado.
- O fornecedor confirma o recebimento também de pagamentos pendentes, o que fecha a etapa. Pendente não conta como pago na conta corrente.
- Dados bancários do fornecedor ficam no cadastro do parceiro (`bank*`, só para fornecedores). O e-mail e o WhatsApp do financeiro ficam em Configurações (admin).
- Aprovação automática na conta exige API de banco ou de pagamentos com credencial. Não há, então não foi simulada.

### Nova medição na inspeção

- Reprovar a revisão da inspeção agora pede uma nova medição. As medidas e a foto na balança voltam a "reprovado" para o fornecedor reenviar, e a etapa fica em andamento. Os valores antigos continuam no item e na auditoria (`inspection.remeasure_requested`).
- A nova medição é comparada de novo:
  - divergente: bloqueia e reabre a revisão;
  - dentro da tolerância: fecha a revisão sozinha, e a etapa conclui quando os obrigatórios estiverem feitos.
- "Nova medição" (medidas e fotos) aparece enquanto a inspeção estiver aberta, bloqueada ou em andamento, e não só quando bloqueada. Isso destrava pedidos que ficaram parados depois de uma reprovação.

### Relatório da inspeção

- O card "Resultado da inspeção" (só Wellmix) agora é um relatório calculado na hora a partir dos itens da etapa (`services/inspection-report.ts`). Funciona também em pedidos que já passaram da inspeção e nos que não têm snapshot. Ele mostra:
  - o resultado: aprovada, aprovada com divergência aceita, divergente ou nova medição solicitada;
  - cada medida enviada com esperado × encontrado, tolerância e situação;
  - as fotos;
  - a decisão da revisão: quem, quando e a observação;
  - as divergências registradas, abertas e resolvidas, com quem resolveu;
  - a linha do tempo tirada da auditoria.
- Referência da comparação (`inspectionReference`): a ficha de compra vale primeiro para peso líquido e bruto, unidades por caixa, CBM e material. O snapshot completa as medidas da peça e a cor.
  - A comparação que bloqueia a etapa usa a mesma referência, então pedidos sem snapshot, mas com ficha, também são comparados.
  - A regra antiga de peso declarado fica só para pedidos sem ficha, para não abrir duas revisões do mesmo peso.
- O link para a fila de revisão só aparece quando há item aberto.

### SLA de resposta da cotação

- O antigo "Prazo desejado" da solicitação passa a ser o **prazo de resposta da Wellmix (SLA)**. O campo é o mesmo (`requests.deadline`), e ele já era o vencimento da tarefa da Wellmix e da Control Tower.
- A Wellmix define em Configurações quantos dias úteis tem para responder (`quoteSlaBusinessDays`, padrão 5, de 1 a 60). A conta usa dias de segunda a sexta, a partir de hoje no horário de Brasília, sem feriados (`src/lib/sla.ts`).
- O prazo é calculado no servidor (`createRequest`):
  - o cliente vê o prazo preenchido e não pode alterar, e qualquer data enviada por ele é ignorada;
  - a Wellmix vê o padrão e pode ajustar uma solicitação específica.
- Vale para nova solicitação e para recompra/nova proposta. Solicitações antigas ficam com o prazo que já tinham.

### Produto do catálogo e estoque na nova solicitação

- Ao escolher um produto existente, o quadro acima ("Produto ainda não está no catálogo") muda para um quadro verde marcado: "Produto do catálogo Wellmix". Ele traz um atalho para voltar a "fora do catálogo".
- O estoque vem de dados lançados (`availableStockByProduct` em `services/containers.ts`): itens de container sem pedido, em containers não encerrados.
  - Com estoque, o quadro diz "Em estoque na Wellmix". Só a Wellmix vê a quantidade e quanto está a caminho; o cliente vê apenas que há estoque.
  - Sem estoque, o quadro diz que a Wellmix cota com o fornecedor.
- Limite: não há baixa de estoque por venda fora de pedido. Containers encerrados saem da conta.

### Excluir solicitações (uma, várias ou todas)

- Na lista de solicitações há uma caixa em cada linha, "Selecionar todas" (no cabeçalho e na barra), "Excluir selecionadas (N)" e um botão de lixeira por linha. Toda exclusão pede confirmação antes.
- Excluir não apaga dados (`deleteRequests` em `services/requests.ts`):
  - a solicitação passa para `CANCELLED`, status que já existia;
  - as cotações em aberto (convidadas ou respondidas) são encerradas como `rejected`, e somem das pendências do fornecedor;
  - a ação fica na auditoria como `request.delete`.
- As excluídas saem da lista e ficam no filtro "Ver excluídas".
- Quem pode excluir: a Wellmix, qualquer solicitação; o cliente, só as dele (`canViewRequest`). Só vale para solicitação que ainda não virou pedido.
- Solicitação com pedido criado aparece com a caixa desabilitada, porque o pedido continua. Cancelar pedido é outra decisão: exige status novo de pedido e regras para pagamentos e containers.

### RFQ pela ficha de compra e valor ao cliente automático

- **Resposta da RFQ:** o fornecedor responde preenchendo a ficha de compra completa, a mesma da Preparação. Os campos obrigatórios estão em `SHEET_REQUIRED_FIELDS`; as fotos são opcionais nessa fase.
  - O formulário tem "Salvar rascunho" e "Enviar cotação". Só envia com a ficha completa, e o preço e a moeda da cotação vêm da ficha.
  - A Wellmix pode completar NCM, imposto de importação e IPI na ficha da cotação.
- **Onde a ficha fica:** a ficha da cotação fica em `purchase_sheets`, com `orderId` = id da cotação (`services/quote-sheet.ts`). Não há coluna nova: os ids são únicos entre tabelas. Ao confirmar o sinal, a ficha da cotação escolhida é copiada para o pedido, e a Preparação nasce preenchida, faltando só as fotos.
- **Componente compartilhado:** os campos da ficha viraram o componente `PurchaseSheetFields`, usado no pedido e na cotação.
- **Valor ao cliente:** na seleção do fornecedor, o valor vem calculado (`src/lib/pricing.ts`, funções puras):
  - FOB = preço da ficha × quantidade × câmbio;
  - mais o frete: o informado pelo transportador ou o estimado (CBM total × frete por CBM das Configurações);
  - mais o imposto de importação sobre o CIF e o IPI sobre CIF + II. Os percentuais vêm da ficha ou da classificação fiscal validada do produto;
  - mais a margem.
- **Margem facultativa:** vale a do cliente; se não houver, a da linha; se não houver, a geral. Tudo é editável em Configurações → Preço ao cliente.
- **Câmbio:** do dia, 1x por dia: PTAX do Banco Central, AwesomeAPI ou Banco Central Europeu, nessa ordem; o botão "Buscar" de Configurações força na hora e a tela mostra a fonte e o motivo de falhas (`docs/INTEGRATIONS.md`).
- **Edição e registro:**
  - a tela mostra a memória de cálculo e o que faltou (CBM, II, IPI, câmbio, frete);
  - o operador pode ajustar o valor;
  - o servidor refaz a conta e grava a memória na auditoria (`quote.select`).
- **Variação cambial:** se o câmbio mudou desde a proposta, a solicitação mostra a variação e o botão "Atualizar proposta com o câmbio de hoje" (`proposal.refresh`).
  - A atualização mantém margem, frete e um eventual ajuste manual, e o sinal acompanha o novo valor. O cliente é avisado.
  - Fica bloqueada depois que o cliente envia o comprovante do sinal.
- **Fora da conta:** PIS, COFINS, ICMS, seguro e despesas portuárias não entram no custo importado; ficam cobertos pela margem.

### Início do cliente

- O cliente entra em `/app/requests` (o `/app` redireciona). No topo: atalho grande para nova solicitação, "Precisa da sua ação" (sinal a pagar, recebimento a confirmar, compra a avaliar; só aparece quando há algo) e "Pedidos em andamento" (etapa, progresso, com quem está o próximo passo, prazo da etapa e chegada prevista do container quando informada). Abaixo, as solicitações.
- A página de pendências continua em `/app/tasks` (item "Pendências" do menu do cliente), com ajuda escrita para o cliente. Demais papéis não mudam. Serviço: `services/customer-home.ts`.

### Telas entregues na Visão de Produto

- `/app/lines`: "Prompts e regras (IA)" por linha (prompts de descrição, marketing e imagem; atributos exigidos; regras), com badges-resumo.
- `/app/products/[id]`: cards "Atributos exigidos pela linha" (conferência determinística: presente, faltando, manual), "Sugestão por foto (IA)" (foto escolhida, contexto, sugestão rotulada mock/api com modelo, prompt em auditoria; aplicação campo a campo com caixas desmarcadas, material e cor por escolha explícita, descarte com nota) e "Ciclo do produto" (sourcing de origem, solicitações, pedidos com pós-venda e recompra, kits, programações). `/app/sourcing/items/[id]`: a mesma sugestão por foto.
- `/app/marketing` (Wellmix: todos os kits com filtros; cliente: os seus a partir da oferta), `/app/marketing/new` (produto, cliente, preço padrão das configurações) e `/app/marketing/[id]` (studio: produto e imagens comerciais da ficha, textos do kit, sugestão de textos por IA confirmada, prévias, arquivos finais, linha do tempo prévia → oferta → compra → pagamento → liberação e ações por situação; cliente compra, acompanha e baixa depois da liberação).
- `/app/parties/[id]` (cliente): "Modalidade de operação" (importação própria, via trade, outra; RADAR; observações) com aviso quando importação própria sem RADAR; badge na lista de parceiros; pedido mostra a modalidade para Wellmix, cliente, despachante e jurídico.
- `/app/settings`: seção "IA, marketing e operação" com o modo efetivo da IA (api/mock/manual) sem expor a chave.

### Validação da Visão de Produto

Lint, typecheck, 29 testes unitários, E2E do caminho principal sobre o banco anterior à onda e sobre seed novo, build de produção, esquema publicado no Appwrite (aditivo); isolamento conferido no navegador pelos revisores com admin, operador, cliente, fornecedor, despachante, agência, armador, transportador e jurídico.

## Implementado na Segunda Onda

- Esquema aditivo publicado (32 tabelas): `tax_classifications`, `certifications`, `after_sales`; `products.ncm`/`priceTiers`; `product_lines.requiredCertifications`; `requests.origin`/`sourceOrderId`; `sourcing_items.requestId`/`priceTiers`; `purchase_snapshots.ncm`.
- Serviços: `taxes.ts`, `compliance.ts`, `after-sales.ts`, `history.ts`, `opportunities.ts`; `requests.ts` (`createFollowUpRequest`, sourcing sob demanda, gate de conformidade); `sourcing.ts` (promoção devolve o produto à solicitação); `tasks.ts` (pendências de pós-venda e de demanda); `control-tower.ts` (certificação a vencer); `engine.ts` (pós-venda ao concluir a entrega).
- Configurações: `afterSalesEnabled`, `complianceGateEnabled`, `certificationExpiryWarningDays`.
- Configurações expostas em `/app/settings` (seção "Conformidade e pós-venda").
- 7 testes novos (22 no total).

### Telas entregues na Segunda Onda

- `/app/products/[id]`: seções "Classificação fiscal (NCM)" (sugestão heurística por palavra-chave, candidatas manuais/do despachante, validar/rejeitar; só a validada vai para o produto), "Certificações e compliance" (exigido pela linha × válido, vencendo, documento, validar/vencer/rejeitar) e "Oportunidade" (faixas de preço editáveis e custo marginal até a próxima faixa, com a fórmula; containers do cliente com espaço).
- `/app/products/[id]/tax`: página só de classificação fiscal para Wellmix e despachante (sem preço, fornecedor ou cliente); o pedido linka para ela (Wellmix e despachante).
- `/app/lines`: certificações obrigatórias por linha (badges + formulário). `/app/parties/[id]` (fornecedor): certificações do fornecedor. `/app/account` (fornecedor): registra as próprias certificações, que entram pendentes.
- `/app/sourcing` e `/app/sourcing/items/[id]`: badge "Demanda de cliente" com link à solicitação, faixas de preço do item (copiadas na promoção), vínculo manual item ↔ solicitação em aberto sem produto.
- Pedido: card "Pós-venda" (cliente avalia: nota 1–5, experiência, problemas, custos percebidos, sugestões, interesse em repor; Wellmix vê e encerra), card "Comprar de novo / Nova proposta" (solicitação derivada pré-preenchida), badge de origem e link ao pedido de origem (só para quem pode abri-lo). `/app/requests/[id]` mostra a mesma origem.
- `/app/requests/new`: "produto fora do catálogo" cria a solicitação como sourcing sob demanda (item de sourcing + pendência da Wellmix).
- `/app/after-sales` (Wellmix): avaliações por situação, nota, problemas e interesse. `/app/history` (Wellmix filtra por cliente; cliente vê o seu): produto → compras → quantidade → custo (FOB só Wellmix) → frequência → reposição.
- Acesso a documentos: certificado (PDF) abre para o despachante e para o fornecedor dono do cadastro/produto; cliente e outros fornecedores não.

### Validação da Segunda Onda

Lint, typecheck, 22 testes unitários, E2E do caminho principal sobre o banco antigo (`.data-e2e` anterior à onda) e sobre seed novo, build de produção, esquema publicado no Appwrite (aditivo).

## Implementado na Prioridade Agora

- Esquema aditivo (`src/lib/db/schema.ts`): colunas novas em `parties`, `products`, `documents`; 12 tabelas novas; `PARTY_EXTRA_DEFAULTS`, `PRODUCT_EXTRA_DEFAULTS`, `DOCUMENT_EXTRA_DEFAULTS` para criar registros sem conhecer cada coluna nova.
- Camada de dados: coluna `json_large` (longtext) para planilhas; `appwrite-push` acrescenta valores a enums existentes e extensões ao bucket; `AppwriteStore.list` pagina (não trunca mais em 500) e traduz `id` nos filtros.
- Serviços: `sourcing.ts`, `import-batches.ts` (+ `xlsx.ts` sem dependências), `snapshots.ts`, `inspection.ts`, `reviews.ts`, `acknowledgements.ts`, `containers.ts`, `logistics/cbm.ts`; `control-tower.ts` ganhou totais e exceções de revisão.
- Motor: contexto `inspectionExtendedChecks`; hook de comparação após cada medida da inspeção; aprovação/liberação resolvem os itens de revisão; preço zerado gera item de revisão na criação do pedido.
- Configurações novas (`src/lib/settings.ts`): tolerâncias de dimensão/CBM/quantidade, `inspectionExtendedChecks`, `reviewOnZeroPrice`, `containerTypes`, `containerAllowMultiCustomer`, `containerMaxOccupancyPercent`.

### Telas entregues nesta onda

- `/app/sourcing` (itens e visitas), `/app/sourcing/visits/new|[id]`, `/app/sourcing/items/new|[id]`: mobile-first, câmera com compressão no aparelho, galeria por tipo de foto, medições, promoção a produto, descarte sem apagar.
- `/app/products/[id]` (ficha completa, fotos, medições, programação de compra → nova solicitação pré-preenchida); `/app/products` com colunas novas; `/app/parties/[id]` com contato/WeChat, visitas e produtos do fornecedor.
- `/app/import` (lote XLSX/CSV ao lado do CSV direto antigo) e `/app/import/[batchId]` (mapeamento → conferência → decisão → resumo).
- `/app/containers` e `/app/containers/[id]` (ocupação, peso, visão comercial, itens por pedido ou estoque, regra de consolidação); `/app/reviews` (fila com filtro e histórico); Control Tower com faixas Financeiro e Operação e visão comercial por container; `/app/settings` com as chaves novas.
- Pedido: snapshot da compra (Wellmix), resultado da inspeção, itens em revisão, nova medição (`?remeasure=1`), containers do pedido, trilha enviado → visualizado → confirmado em pagamentos e documentos; conta corrente com comprovante, câmbio e trilha.
- `src/app/app/error.tsx`: limite de erro amigável (papel sem acesso ou falha) em vez da tela padrão.

### Validação da onda

Lint, typecheck, 15 testes unitários, E2E do caminho principal sobre o banco antigo (registros sem as colunas novas) e sobre seed novo, build de produção, esquema publicado no Appwrite (`npm run appwrite:push`, aditivo).

## Cotação de frete pela companhia marítima

- Ao enviar a cotação com a ficha de compra, cada companhia marítima ativa recebe um pedido de frete (`freight_quotes`): notificação, pendência em "Minhas tarefas" e item "Fretes" no menu. Reenvio com carga diferente volta o pedido a pendente.
- A tela `/app/freight/[id]` mostra só a carga (quantidade, caixas, CBM, peso bruto, medidas, incoterm, origem, embalagem, container, início da produção, NCM). Preço, fornecedor e cliente não aparecem. Acesso: Wellmix ou a própria companhia (`canViewFreight`).
- O frete informado (o menor, convertido para reais pelo câmbio do dia) entra no custo importado: pré-preenche "Frete do transportador" na escolha do fornecedor. O operador pode digitar outro valor, que prevalece. Sem resposta, vale o frete por CBM.
- Escolher um fornecedor ou excluir a solicitação encerra os pedidos de frete das outras cotações.
- Tabela nova: precisa rodar o workflow "Publicar esquema Appwrite" (ver `docs/APPWRITE.md`).
- Próximos passos possíveis: frete por mais de um modal (rodoviário no Brasil, despachante), validade do frete com alerta, comparação de companhias na própria tela.

## Ficha completa na RFQ; Preparação automática

- A resposta da RFQ exige a ficha inteira, como a Preparação: campos com *, 1º lote da programação e as fotos da balança e da régua (fotos da cotação: `product_photos.orderId` = id da cotação; documento sem pedido/solicitação, visível só à Wellmix e a quem enviou).
- Ao confirmar o sinal, ficha e fotos da cotação escolhida vão para o pedido (o documento passa a ser do pedido, visível aos parceiros).
- Quando a Preparação começa (após "Pedido conferido"), se a ficha está completa os requisitos se cumprem na hora e a etapa se conclui sozinha (`syncPreparationFromSheet` no `activateStage`). Pedidos antigos ou cotações registradas sem ficha seguem com a Preparação normal, que mostra o que falta.

## Cancelamento de pedido; todas as fotos da ficha obrigatórias

- **Fotos da ficha:** as 7 fotos (balança, régua, lateral, ângulos, original, prompt, cartão de visita) são obrigatórias na RFQ e na Preparação (`REQUIRED_SHEET_PHOTOS`); requisitos do tipo foto são sempre obrigatórios.
- **Quem cancela:** só o administrador, em qualquer etapa (`cancelOrder`). Nada é apagado: o pedido passa a `CANCELLED` (novo valor de `orders.status`), guarda a etapa em que estava (`cancelStageKey`), motivo, observação, quem e quando; etapas não concluídas viram `cancelled` (novo valor de `stages.status`); o pedido sai dos containers e os fretes em aberto da solicitação são cancelados. Cliente, fornecedor e parceiros são avisados; com número no Sankhya, a Wellmix recebe o lembrete de cancelar lá. Pedido cancelado não avança: requisito, aprovação e desbloqueio são recusados.
- **Acerto financeiro:** texto livre (`cancelSettlement`), opcional no cancelamento e editável depois pelo admin; o portal não calcula devolução. Pedido cancelado sai de "a receber"/"a pagar", das listas abertas, da Control Tower, do compliance e das pendências de ERP; o histórico de pagamentos continua.
- **Pedido do cliente:** o cliente (o login solicitante) pede o cancelamento com motivo até o produto entrar em produção: etapas Pedido criado, Preparação ou Pagamento ao fornecedor e antes da data de início da produção da ficha. A Wellmix vê o alerta no pedido e recusa com resposta ou cancela (o pedido fica `approved`). Colunas novas em `orders`: `cancelledAt`, `cancelledByUserId`, `cancelReason`, `cancelNote`, `cancelSettlement`, `cancelStageKey`, `cancelRequestStatus`, `cancelRequestedAt`, `cancelRequestedByUserId`, `cancelRequestReason`, `cancelRequestResponse`.

## Tributos da importação no valor ao cliente

- **Tabela fiscal (TEC + TIPI):** upload da planilha oficial (XLSX/CSV, título acima do cabeçalho, linhas "Ex" ignoradas, "NT" = 0%) e robô mensal pelos links oficiais (`/api/jobs/fiscal`). Fica como JSON no armazenamento; metadados em `settings.fiscalTable`. Cada upload substitui só a sua parte e informa quantas alíquotas mudaram (auditoria `fiscal.import`). Tabela incompleta ou com mais de 90 dias: aviso.
- **NCM da solicitação:** do cadastro do produto (validado) vale direto; sem ele, a IA (modo API) e as palavras-chave × tabela sugerem, automaticamente na primeira abertura pela Wellmix e no botão "Sugerir com IA". A Wellmix confirma (o NCM precisa existir na tabela carregada). Confirmar leva o NCM ao cadastro do produto quando ele não tem. Colunas novas em `requests`: `ncm`, `ncmSource`, `ncmConfirmedByUserId`, `ncmConfirmedAt`, `ncmSuggestions`.
- **Custo importado:** valor aduaneiro (FOB + frete + seguro) + II (TEC) + IPI (TIPI, sobre aduaneiro + II) + PIS-importação 2,1% + COFINS-importação 9,65% (gerais, editáveis) + ICMS por dentro (alíquota do estado, em Configurações). Valor digitado na ficha pela Wellmix continua prevalecendo sobre a tabela. Na seleção, NCM, II e IPI usados vão para a ficha escolhida (e dela para o pedido).
- Registros de proposta antigos (sem os novos campos) seguem com a conta anterior.
- Próximos passos possíveis: AFRMM (8% do frete marítimo) e taxa Siscomex; PIS/COFINS diferenciados por NCM; Ex-tarifários e antidumping como ajuste com motivo; CBS/IBS quando a reforma tributária passar a cobrar (2027).

## Reutilizado

`uploadDocument` (versionamento e visibilidade), `audit`, `notify`/`notifyWellmix`, `getSettings`, `loadFinance`, `loadControlTower`, `createRequest`/RFQ (para reposição e sourcing sob demanda na Segunda Onda), kit de componentes `ui.tsx`, `PageHeader` com ajuda contextual, dicionários pt/en/zh.

## Ampliado

`Party`, `Product`, `Document`, `StageContext`/`STAGE_TEMPLATES` (INSPECTION), `submitRequirement`/`decideRequirement`/`unblockStage`, `createOrderFromRequest`, `TowerException`, seed de demonstração, navegação (`navFor`), `docs/`.

## Pendente (próximas ondas)

- Segunda Onda: NCM/tributação com validação humana, integração mais profunda com o sistema chinês (só se houver API oficial), certificações por linha, pós-venda (entidade própria após DELIVERED), análise de oportunidade com fórmula reproduzível, reposição e “nova proposta” reaproveitando solicitação/RFQ, sourcing sob demanda.
- Visão de Produto, próximos passos: geração de imagem comercial por IA (hoje só o prompt de imagem), cobrança do kit por gateway (hoje manual), importador como entidade própria quando houver um segundo importador (ver `docs/ARQUITETURA.md`), medição 3D/LiDAR.

## Decisões técnicas

- **Aditivo sempre**: `ADD` antes de `DROP/RENAME`; enums só ganham valores; nenhum registro é apagado.
- **IA ≠ regra**: cálculo, saldo, CBM, tolerância, comparação, workflow, autorização e validação são código determinístico e auditável. IA fica para sugestões (descrição, categoria, leitura de imagem) sempre com confirmação humana.
- **IA sem credencial = manual, nunca inventada**: sem `ANTHROPIC_API_KEY` o adaptador é manual (a tela explica); `aiMode = MOCK` devolve um exemplo com "(mock)" em todo campo, para demonstração e testes. Toda sugestão guarda prompt, origem e modelo e só vira cadastro pelo formulário de confirmação.
- **Multi-importador por preparação, não por refatoração**: colunas `importerId` nulas (= Wellmix) hoje; a separação real vem com entidade `importers`, configurações por importador e filtro em `canView*` quando houver um segundo importador.
- **Modalidade de operação é dado do cliente e snapshot do pedido**: nenhum cliente é presumido com ou sem RADAR; só o cadastro explícito dispara o gate.
- **Snapshot em vez de referência**: o pedido guarda o que foi comprado; o cadastro mestre pode evoluir.
- **Inspeção cega**: o esperado nunca aparece ao inspetor; o motivo do bloqueio detalhado é visível só para a Wellmix.
- **Container**: capacidade por tipo em settings; consolidação entre clientes proibida por padrão; “disponível” só existe para itens sem pedido dentro do container.
- **Server Actions divididas** em `src/app/app/actions.ts` (existentes) e `src/app/app/actions/*.ts` (novas), com os mesmos helpers (`zod`, `assert*`, `audit`, `run`).
- **Dicionários por módulo** em `src/i18n/modules/*.ts`, fundidos em `dictionaries.ts`; o teste de paridade pt/en/zh cobre tudo.
- **Fotos no celular**: compressão no aparelho (`PhotoInput`) e `serverActions.bodySizeLimit` de 10 MB; na Vercel o corpo da requisição tem teto de ~4,5 MB, por isso a compressão é obrigatória, não opcional.
- **Limites conhecidos**: `nextNumber` não é atômico (colisão vira 409 no índice único); datas no Appwrite voltam com `+00:00`; MemoryStore não valida enum/tamanho (erros de esquema só aparecem em produção ou no E2E com `E2E_REUSE=1`).

## Recomendações futuras (não executadas por serem remoções ou mudanças de comportamento)

- Correspondência de fornecedor na importação por nome em chinês (hoje só por nome cadastrado, CNPJ e e-mail): acrescentar um nome alternativo ao parceiro.
- `PageHelp` recolhido por padrão nas telas de campo (o painel empurra o campo de foto para baixo da primeira dobra no celular).
- Programação de compra como cards no celular (a tabela rola na horizontal).
- Excluir container vazio em planejamento (hoje só encerra).
- Unificar `savePartyAction` com os campos de contato/WeChat (hoje um segundo formulário na tela do parceiro).

- Unificar `checkWeightDivergence` (peso declarado × medido) dentro de `compareInspection` quando todos os pedidos abertos tiverem snapshot.
- Reduzir as 3 notificações por evento (in-app, e-mail e WhatsApp mock) quando houver provedor real.
