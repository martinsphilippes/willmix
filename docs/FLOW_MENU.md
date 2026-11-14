# Menu por blocos do mapa e contadores de trabalho

Pedido do dono (14/11/2026): o menu lateral segue os blocos do mapa do processo (repositório `attilasm/wellmix-presentation`, aba Mapa) para o analista ver onde tem trabalho esperando por ele. Cada passo do menu tem uma bolinha com quantas pendências esperam ação ali, vermelha quando alguma já passou do prazo.

## Estrutura

| Bloco (mapa)        | Itens                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto novo (Book) | Overview, Books, Seleção de itens, Cotações (convites de book), Negociações (solicitações ao fornecedor, com a amostragem)                                      |
| Pedido              | Overview, Pedidos, Certificação, Material de arte, Arte, Revisão, Contrato                                                                                      |
| Produção            | Overview (`/app/production`), Pré-produção, Inspeção, Amostra, Produção, Booking (marítima), Logística, Carregamento, Documentos de carga, Embarque             |
| Entrega             | Overview, LPCO, Presença de carga, Canal cinza ou vermelho, Logística, Nota fiscal, Entrega, Retorno, Armazenagem; Containers, Fretes e Tarifário seguem no fim |
| Vendas              | Estoque, Amostras, Ofertas, Venda                                                                                                                               |
| Financeiro          | Financeiro, Contas a pagar, Fluxo de caixa (saiu de Painéis), Acordos e comissões, Multas                                                                       |
| Painéis             | Painel do dono, Painéis por área, Painel de SLA (só leitura, sem contador)                                                                                      |
| Cadastros           | Parceiros, Produtos, Linhas                                                                                                                                     |

Mensagens e Notificações saíram do menu de todos os papéis; ficam no cabeçalho, com o contador de não lidas. O Superplan saiu de Painéis e virou atalho em Configurações. Nenhuma tela ou rota foi removida.

## Telas

- **Overview do bloco** (`/app/flow/<bloco>`; o da Produção é `/app/production`): à esquerda, a linha do tempo vertical dos passos na ordem do mapa, com quantas esperam ação, quantas atrasaram e há quantos dias (média e a mais antiga); à direita, a tabela com os casos do passo escolhido (`?step=…`) e o atalho para resolver.
- **Tela do passo** (`/app/flow/<bloco>/<passo>`): os casos do passo, com o prazo, há quantos dias chegaram, filtros de prazo (`?due=overdue|today|week`) e o botão Resolver, que leva à tela focada do pedido quando ela existe (Die Cut, documento do pedido, documentos de embarque, amostras, fotos reais) ou ao ponto do pedido onde se faz.
- **Resolver aqui** (na tela do passo): para cada pedido com caso aberto no passo (até 15), o mesmo cartão de passos do detalhe do pedido, só com os passos deste ponto do mapa: Certificação (memorial, selo e arte com o selo), Booking, Logística (container na fábrica e vazio), Carregamento (carregado e lacrado), Documentos de carga (draft BL, invoice e packing, BL), Embarque (container no porto e rastreio), Amostra (retirada, envios, devolução), Presença de carga (presença, numerário, DI, CE Mercante, CI), Canal e Nota fiscal (DANFE). Mesmas regras e Server Actions do pedido; a ação volta para a tela do passo (`returnTo`, só `/app/flow/<bloco>/<passo>`). O detalhe do pedido continua com tudo.
- **Itens de etapa e produção na tela do passo** (segunda parte, 14/11/2026): os itens de etapa do pedido que caem no passo, pedido a pedido, com o mesmo formulário do detalhe do pedido (`RequirementForm`): arte, validação (com a arte enviada para abrir) e arte final com o selo em Arte; o certificado em Certificação; medidas, ficha e assinatura nos passos deles. Só aparecem os itens que o login pode fazer agora (mesma regra do pedido, com a do responsável por login nas quatro tarefas da Preparação). Em Produção → Produção, o cartão de produção com dados, ETD e follow 5/15/25; em Produção → Inspeção, a agenda e a inspeção por SKU com a correção do fornecedor; em Pedido → Arte, as não conformidades da arte (correção da agência e revisão da Wellmix). As Server Actions de requisito, produção, arte e embarque aceitam `returnTo` (só `/app/flow/<bloco>/<passo>`, `flowReturnTo` em `src/app/app/actions/helpers.ts`) e voltam para a tela do passo.
- **Terceira parte** (14/11/2026):
  - **Itens com tela e ação próprias** não ganham o formulário comum na tela do passo (o envio comum recusa): o documento do pedido e as assinaturas (documento do pedido), o pedido de amostras, o pedido mínimo e o prazo (quadro Die Cut) e a ficha de compra. No lugar, o botão para a tela deles (`ownScreenOf` em `src/components/flow-step-forms.tsx`).
  - **Recebimento no CD** em Entrega: Armazenagem (descarga, lacre, fotos, checklist e contagem por SKU) e Retorno (RIC, devolução do container e fechamento), com o cartão de recebimento do pedido dividido em duas partes (`sections`). Os casos saem dos recebimentos abertos de pedidos já entregues no CD (ou com a descarga começada): falta descarga ou contagem, Armazenagem; senão, Retorno. Contam no menu, mas não são pendências: a tela Pendências e a bolinha dela não mudam (`flowReceivingCasesFor` em `src/lib/services/flow.ts`, só para a Wellmix com a tela Containers).
- **Quarta parte** (14/11/2026):
  - **Pré-produção** ganha casos: pedido em andamento com o sinal ao fornecedor pago (item `down_payment` concluído) e a produção sem ETD. A tela mostra a parte "dados e ETD" do cartão de produção; salvar o ETD tira o caso. Contam no menu, fora das Pendências (`flowPreProductionCasesFor`, Wellmix com a tela Produção).
  - **Produção → Logística** traz o frete marítimo do pedido (pedir às companhias e as respostas), para os pedidos com caso no passo. O pedido de frete aceita `returnTo` e volta para a tela do passo.
- **Quinta parte** (14/11/2026): o **relatório da inspeção** (medidas × comprado, fotos, decisão da revisão, divergências) saiu do detalhe do pedido para um componente próprio (`src/components/inspection-result-card.tsx`) e aparece também em Produção → Inspeção, ao lado da agenda e da decisão por SKU, para todo pedido com caso no passo (inclusive o item "inspeção aprovada pela Wellmix" da etapa). O caminho principal aprova o SKU nessa tela.
- Passos que já tinham tela (Books, Seleção, Cotações, Negociações, Pedidos, Revisão, Estoque) abrem a tela de sempre, com o contador.
- Passos sem fonte de pendência ainda (LPCO, Amostras e Ofertas de Vendas) aparecem com a tela vazia e a explicação; nada inventado.

## Abas da tela do passo (14/11/2026)

- **Pendências** (padrão): o que espera ação do login no passo, como acima.
- **Todos no passo** (`?tab=all`, só a Wellmix): todos os pedidos que estão no passo agora, de qualquer responsável, com o fornecedor, a etapa do pedido, o que está aberto no passo e há quantos dias; o link abre o detalhe do pedido. Fonte (`flowAllFor` em `src/lib/services/flow.ts`, leitura sob demanda, fora do menu):
  - itens de etapa não concluídos das etapas em andamento (ou bloqueadas), no passo do item;
  - passos do embarque, da origem, da certificação e das amostras prontos e não concluídos (`openImportStepKeys` em `src/lib/services/import-flow.ts`): embarque, origem e amostras só do pedido da inspeção em diante; certificação só com ela começada; amostras só com elas pedidas;
  - recebimentos abertos (Armazenagem e Retorno) e a pré-produção, os mesmos casos do menu;
  - produção em andamento: pedido na etapa de inspeção com ETD.
- O Overview do bloco mostra, em cada passo da linha do tempo, quantos pedidos estão nele ("N no passo"), além das pendências. Passos com tela de antes (Books, Pedidos, Revisão, Estoque) listam na própria tela.

## Overview pelos pedidos e visão do pedido entre os blocos (14/11/2026)

Pedido do dono: o Overview de Pedido, Produção e Entrega (só a Wellmix) passa a mostrar os pedidos do bloco, e não só as pendências.

- **KPIs no topo** (`data-flow-kpis`): pedidos no bloco, atrasados no bloco, completude média do bloco, completude geral média e as pendências (com o pedido há mais tempo no bloco).
- **Linha do tempo geral** (`data-flow-general`): os três blocos (Pedido → Produção → Entrega) com quantos pedidos estão em cada um, a completude média do bloco e os atrasados; o bloco aberto em cor, os outros em cinza; cada um leva ao Overview dele.
- **Passos à esquerda**: o número grande é quantos pedidos estão no passo; as pendências, os atrasos e os dias ficam embaixo, em letra menor. "Todos os passos" no topo mostra o bloco inteiro (padrão).
- **Tabela dos pedidos** (`FlowEntities`, `src/components/flow-entities.tsx`): pedido, fornecedor, passos (na visão do bloco inteiro), etapa, há quantos dias está no bloco, atraso, % do bloco e % geral; os atrasados primeiro, até 500 linhas. Com um passo escolhido, as pendências dele aparecem embaixo, como antes.
- **Visão do pedido** (`OrderProgressCard`, `src/components/order-progress-card.tsx`, no topo do detalhe do pedido para a Wellmix; o Overview abre com `?from=<bloco>#order-progress`): a viagem inteira do pedido, com a completude geral; o bloco de onde veio em cor, com as etapas (situação, %, prazo, conclusão e atraso) e o relatório de atraso (atraso agora e etapas concluídas depois do prazo); os outros blocos em cinza com o percentual. Clicar num bloco muda o foco. Sem `from`, o foco é o bloco atual do pedido.
- **Regra** (`src/lib/flow-progress.ts`, pura): cada etapa do pedido cai num bloco (Pedido: criação, preparação, embalagem; Produção: inspeção, embarque; Entrega: desembaraço, transporte, entrega e encerramento; o pagamento ao fornecedor, fora do fluxo, não conta). Etapa concluída vale 100%, em andamento ou bloqueada o percentual dela, não começada 0%; cancelada não entra. O bloco é a média das etapas dele; o geral, a média de todas. Atraso: etapa aberta com o prazo vencido (dias desde o prazo) e etapa concluída depois do prazo.
- **Leitura**: os pedidos do bloco são os do "Todos no passo" (`flowBlockEntities`), e a completude sai das etapas que essa mesma leitura já traz (`flowProgressFor`); nada novo no banco. Os KPIs são contados sobre essa mesma lista, sem tabela agregada (`kpi_snapshots`) por enquanto; ver "Pendências" abaixo.
- Produto novo e os logins de fora da Wellmix seguem com o Overview das pendências.
- **Pendência**: a regra de docs/RESUMOS.md pede indicadores em tabela agregada. Estes KPIs são contados na leitura dos pedidos em andamento, como já era o "N no passo". Se a tela pesar em produção, o próximo passo é guardar a contribuição de cada pedido (bloco, passos, %, atraso) no resumo e somar num `kpi_snapshots` próprio.

## De onde vem o contador

- As mesmas pendências da tela Pendências (`pendingTasksFor` + `tasksForFunctions`: o operador vê só as das funções dele), lidas uma vez por página (`flowTasksFor`, cache do React). Só leitura; nada novo no banco. A bolinha de Pendências é o total.
- Cada pendência cai no passo de onde vem (`flowStepsOf` em `src/lib/flow.ts`): pelo item da etapa (arte, certificado, die cut, assinatura, inspeção…), pelo passo do embarque e da importação (`stepKey`) ou pelo tipo. A pendência de etapa que junta itens de passos diferentes conta uma vez em cada um. Mensagem a responder não entra (fica no cabeçalho).
- Grupo fechado mostra a soma dos itens; com o menu recolhido, um ponto. Vermelho quando alguma atrasou.

## Próximas etapas (divisão das telas que juntam muitas atividades)

O detalhe do pedido (`/app/orders/[id]`) concentra quase todas as ações. Esta entrega já tira dele os passos do embarque, da importação, da certificação e das amostras (seção "Resolver aqui") e leva os demais casos à tela focada quando ela existe (Die Cut, documento do pedido, documentos de embarque, fotos reais). A segunda parte trouxe as raias de arte e as linhas de requisito (arte, validação, arte final, certificado), a inspeção dos SKUs, o follow da produção e as não conformidades da arte. A divisão segue por blocos, uma entrega por vez, sem remover o detalhe do pedido: as ações de cada passo passam a aparecer também na tela do passo (Arte, Certificação, Inspeção, Documentos de carga, Presença de carga…), reaproveitando os mesmos componentes e Server Actions.

Código: `src/lib/flow.ts` (blocos, passos e classificação), `src/lib/services/flow.ts`, `src/components/flow-overview.tsx`, `src/components/flow-cases.tsx`, `src/components/flow-step-work.tsx` (passos do embarque e da certificação), `src/components/flow-step-forms.tsx` (itens de etapa, produção e arte), `laneInputKeys` em `src/lib/purchase-lanes.ts` (arquivos que a validação e a arte final usam, no pedido e no passo), `src/app/app/flow/`, textos em `src/i18n/modules/flow.ts`. Testes: `tests/unit/flow-menu.test.ts`, `tests/unit/nav.test.ts`, `tests/e2e/production-screen.spec.ts` e o caminho principal (`tests/e2e/happy-path.spec.ts`: a Wellmix valida a arte reenviada na tela Pedido → Arte).
