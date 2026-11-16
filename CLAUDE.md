@AGENTS.md

# Wellmix

Portal Operacional de Importações. Next.js 16 na Vercel; Supabase em produção (desde 11/11/2026; o Appwrite ficou parado) e modo memória para desenvolver e testar. Leia antes de codificar:

- `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/OPEN_DECISIONS.md`: o que o sistema faz e as regras.
- `docs/ARQUITETURA.md`: decisões, módulos e convenções.
- `docs/APPWRITE.md` e `docs/AMBIENTE.md`: esquema, permissões, variáveis e limitações da sessão cloud.
- `docs/SUPABASE.md`: troca do Appwrite pelo Supabase (etapas, esquema gerado, publicação).
- `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/SUPERPLAN.md`, `docs/ORDER_SIGNATURE.md`, `docs/PURCHASE_ORDER.md`, `docs/SAMPLE_ORDER.md`, `docs/PURCHASE_SCHEDULE.md` e `docs/SUPPLIER_SAMPLING.md`: do Booking ao pedido (bookings por planilha, seleção de itens e solicitação ao fornecedor, análise, negociação, amostragem (fotos e vídeos da amostra depois da aprovação), documento com as duas assinaturas, programação de compra com pedido pai e filhos). A RFQ e a cotação saíram em 11/11/2026 (`docs/QUOTE_FLOW.md`).
- `docs/PRODUCTION.md` e `docs/ORIGIN_CONTAINER.md`: produção, inspeção pelo mapa (vídeo, conformidade, tentativas) e o container na origem com o rastreio diário do Comex interno; `docs/SHIPPING_DOCS.md`: check list de carga, packing list, invoice e BL conferidos linha a linha. `docs/SAMPLE_FLOW.md`: amostras depois da inspeção (Brasil 4 × 3 × Nm, China 1 × 3 × Nm), agência de marketing na China, fotos reais aprovadas pelo marketing e devolução da amostra antes do carregamento.
- `docs/DELIVERY.md`: Entrega (canal cinza ou vermelho pausa o pedido até o admin retomar, transportadora padrão pelo porto de chegada, NF do financeiro no passo DANFE).
- `docs/SALES_ORDERS.md`: Venda (decisão do cliente na oferta, ordem de venda com reserva e Sankhya, agenda de entregas).
- `docs/PURCHASE_DEMAND.md`: compra por demanda (reposição B10 e encomenda do cliente B14 → estratégia de compra B10? → pedido de compra ou cotação de compra B13), decisões do dono de 15/11/2026. `docs/MAPA_PROCESSO.md` é gerado do data.json do mapa por `scripts/mapa-processo.mjs` (não editar à mão).
- `docs/FLOW_MENU.md`: menu lateral pelos blocos do mapa (Produto novo, Pedido, Produção, Entrega, Vendas, Financeiro, Painéis, Cadastros), contadores por passo, Overview com linha do tempo e telas dos passos; no rodapé, Equipe Acessos e Parceiros (Equipe, Funções e acessos, Linha de produto e divisão e Parceiros, nos endereços de sempre); Cadastros → Clientes (`/app/customers`; os clientes saíram de Parceiros).
- `docs/DESKS.md`: mesas de trabalho por papel (GP, cadastro, marketing, agência, certificadora) em Pendências.
- `docs/PURCHASE_HISTORY.md`: histórico de compras do cliente na Nova solicitação (origem de cada campo, "Ficha atual", programação pai/filhos, permissões e o que falta nos dados).
- `docs/CUSTOMER_PAYMENT.md`: forma de pagamento do cliente no pedido (formas configuráveis com alçada e juros depois da entrega, vendedor, parcelas pelos eventos do pedido, boletos do Sankhya pelo TGFFIN e aviso de gerar o boleto).
- `docs/CUSTOMER_RCA.md`: RCA do cliente (vendedor do Sankhya pelo código, `parties.rcaCode`, a carga manda), campo "RCA responsável" no cadastro e, na Nova solicitação, Solicitante pela sessão, "RCA do cliente" só consulta e "Login do cliente com acesso".
- `docs/ORDER_TERMS.md`: Nova solicitação da Wellmix para o cliente: bloco do cliente no lugar da busca por foto/link (contatos sócio, comprador, financeiro e fiscal, logística; às cegas na 1ª vez, depois com "Editar"; nunca iguais aos do vendedor) e condições do pedido (TS ou Venda, formato WD ou Wellmix com Pleno…Super, Transportador obrigatório e Re-despacho do portal e do Sankhya, País de origem > Grupo de produto filtrando a busca (produto sem país não aparece), aviso "sem devoluções" com "Li e concordo") e, na lateral fixa (sticky), a Composição de containers (containers × programações, linha aberta mostra cada produto) acima do histórico de compras. Terceira rodada (seção 9): só TS (Venda e BRASIL desabilitados), re-despacho Sim/Não, grupo = família (grupo pai no Sankhya pela API), login do cliente obrigatório, rascunho (`request_drafts`) e a confirmação do pedido pelo cliente (status `AWAITING_CUSTOMER`, aviso + CNPJ da transportadora pela BrasilAPI). Quarta e quinta rodadas (seções 10 e 11): família = 1º nível da árvore de grupos do Sankhya (`TGFGRU.GRAU = 1`) de cada produto pelo DbExplorer, agrupada pelo nome (`fm:<NOME>`); composição fixa e histórico com rolagem própria na lateral; histórico de compras filtra pela família, clique acrescenta o produto e marca "No pedido", e a composição leva até a linha do produto. Sexta rodada (11.3 e 11.4): aviso ao trocar país ou família com produtos no pedido; histórico com cabeçalho fixo, foto e código Wellmix; código (e CNPJ do transportador) abaixo do cliente e do transportador. Seletor de produtos pela lupa (11.5): Grupo, Sub grupo e Coleção do grupo abaixo da família, foto grande, seleção múltipla, quantidade padrão e filtro visto. Quem chama o transportador (11.6): Cliente (ele informa as transportadoras na confirmação; rota PORTO_CLIENTE) ou Wellmix (o vendedor escolhe; com re-despacho, duas; rota VIA_DEPOSITO); previsão de preço pela cotação V2 do Sankhya (`FN_AD_ENC_COTACAO_V2_WELL`, VIP pelo nível, frete de entrega padrão nas Configurações). Limpeza (11.8): sem o quadro "Produto do catálogo Wellmix"; previsão automática só com Preço (com frete quando a Wellmix chama, WD quando é o cliente) e Valor total; Valor do transporte abaixo do Transportador; Valor total do pedido ao lado do Formato de venda; preço desejado só na compra para estoque (que limpa o cliente). 11.7: "+ Adicionar outro produto" recolhe os produtos anteriores na tabela "Produtos no pedido" (Abrir/Recolher, marca Incompleto); Produto (Nome), Descrição e Especificação só fora do catálogo; transportador só pela lista, sem busca.
- `docs/REQUEST_SCREENS.md`: telas TS - Trading Sales e Venda - Encomenda no Produto novo (logo abaixo do Overview): a Nova solicitação da Wellmix com o tipo de operação fixo pela tela (`/app/new-request/ts` e `/app/new-request/sale`), telas `requestTs`/`requestSale` no controle de acesso (Comprador só TS; Gerente de produto e diretorias as duas), `knownScreens` para as funções já gravadas; a Nova solicitação de Encomendas não muda.
- `docs/TRAINING.md`: Treinamento do Portal (capelo na barra vermelha entre o seletor de idiomas e as mensagens, mesmo estilo dos ícones; página `/app/training` só com o título, aberta a todo login, da equipe e de fora, sem controle de telas; PT, EN e ZH). Vídeos, quizzes e provas por login ficam para depois.
- `docs/ORDER_SALE.md`: venda ao cliente por pedido e por produto (card "Venda ao cliente" no pedido, total = soma, ação "Gravar a venda ao cliente").
- `docs/LINHA_DE_VISAO.md`: modelo "Linha de visão de produto", aprovado pelo dono em 15/11/2026 (colunas e ordem, ficha completa em linha horizontal, origem de cada dado, dado ausente "—", edição pelo responsável, permissão "Ver preço de compra"). Quando o dono pedir "use a linha de visão de produto nesta tela", siga este documento.
- `docs/REQUEST_SHEET.md`: ficha completa da solicitação (seção "Solicitações": uma linha por produto e "Ver ficha completa" com Produto, Embalagem e cubagem, Valores e Pagamento; origem de cada dado, eixos das medidas, calculado × gravado e permissões).
- `docs/RESUMOS.md`: indicadores prontos (`kpi_snapshots`) e resumo por pedido (`order_summaries`), atualizados por evento e reconstruídos toda noite; mudar o formato = subir `SUMMARY_VERSION`/`KPI_VERSION`. Regra: KPIs e indicadores leem tabelas agregadas no nível do indicador, nunca tabelas por pedido ou produto.
- `docs/videos/institucional/README.md`: vídeos institucionais (curto de benefícios e completo por papel; narração em inglês, legenda pt ou zh), com o mapa de benefícios e atributos, o que os vídeos não prometem e como refazer (`scripts/video/`).
- `docs/PWA.md`: aplicativo instalável (manifesto, service worker, tela sem conexão) e responsividade.
- `docs/INTEGRATIONS.md`: adaptadores mock/manual e dependências externas pendentes; `docs/SANKHYA.md` para o ERP.
- Skills `.claude/skills/appwrite-cli` e `.claude/skills/appwrite-typescript` antes de rodar o CLI ou escrever código com o SDK.

Regras fixas: toda escrita passa por Server Action em `src/app/app/actions.ts` ou `src/app/app/actions/*.ts` (helpers em `actions/helpers.ts`) com zod e checagem de papel; textos novos em `src/i18n/modules/*.ts` (pt/en/zh, mesmas chaves); evolução aditiva conforme `docs/EVOLUTION_PLAN.md` (não remover telas, rotas, campos ou dados); leitura só no servidor; esquema em `src/lib/db/schema.ts` e `appwrite.config.json` gerado por `npm run appwrite:config`; use `TablesDB` (não `Databases`) e parâmetros por objeto no SDK. Antes de commitar: `npm run lint && npm run typecheck && npm test`. O E2E (`npm run test:e2e`) é o teste do caminho principal; mantenha-o passando.

Velocidade: prefira a solução simples que funciona hoje; integrações sem credencial ganham modo manual/mock, nunca dados falsos apresentados como reais.

## Entrega sem perguntar (autorização do dono)

Ao terminar uma tarefa, sem pedir confirmação:

1. Rodar `npm run lint && npm run typecheck && npm test` e o E2E (`npm run test:e2e`).
2. Abrir o PR para `wellmix`.
3. Esperar o CI (`verify`) ficar verde e mesclar o PR.
4. Se o PR mexeu em `src/lib/db/schema.ts`, publicar o esquema no **Supabase** (banco de produção desde 11/11/2026, projeto `rokbtrvkzllowyqzcauq`) logo depois do merge: migração só aditiva com o que falta do `supabase/schema.sql` (`scripts/supabase-missing.ts`, docs/SUPABASE.md "Publicar o esquema"), aplicada pela ferramenta do Supabase, e conferir as colunas por tabela. Se falhar, avisar o dono com o erro. O Appwrite não recebe mais o esquema.

Exceções (parar e avisar o dono em vez de mesclar):

- CI ou E2E falhando.
- Conflito com a base ou outro PR aberto mexendo na mesma tela ou regra.
- Decisão de negócio tomada sem confirmação do dono.
- Mudança que apaga ou altera dados, telas, rotas ou campos existentes.

## Mensagem final (pedido do dono, 13/11/2026)

Toda vez que for parar de responder (a resposta que encerra o turno), termine com uma mensagem final em duas partes, para a próxima decisão ficar fácil:

- **Do meu lado (Claude):** o que ainda falta fazer, o que está rodando ou esperando (CI, merge, publicação) e o que ficou de fora.
- **Do seu lado (dono):** o que você precisa decidir, conferir ou fazer, com o link ou o caminho na tela.

Se nada falta de um dos lados, diga isso ("Do meu lado: nada pendente").
