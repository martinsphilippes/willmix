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
- `docs/ORDER_SALE.md`: venda ao cliente por pedido e por produto (card "Venda ao cliente" no pedido, total = soma, ação "Gravar a venda ao cliente").
- `docs/LINHA_DE_VISAO.md`: modelo "Linha de visão de produto", aprovado pelo dono em 15/11/2026 (colunas e ordem, ficha completa em linha horizontal, origem de cada dado, dado ausente "—", edição pelo responsável, permissão "Ver preço de compra"). Quando o dono pedir "use a linha de visão de produto nesta tela", siga este documento.
- `docs/REQUEST_SHEET.md`: ficha completa da solicitação (seção "Solicitações": uma linha por produto e "Ver ficha completa" com Produto, Embalagem e cubagem, Valores e Pagamento; origem de cada dado, eixos das medidas, calculado × gravado e permissões).
- `docs/RESUMOS.md`: indicadores prontos (`kpi_snapshots`) e resumo por pedido (`order_summaries`), atualizados por evento e reconstruídos toda noite; mudar o formato = subir `SUMMARY_VERSION`/`KPI_VERSION`. Regra: KPIs e indicadores leem tabelas agregadas no nível do indicador, nunca tabelas por pedido ou produto.
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
