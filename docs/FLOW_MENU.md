# Menu por blocos do mapa e contadores de trabalho

Pedido do dono (14/11/2026): o menu lateral segue os blocos do mapa do processo (repositório `attilasm/wellmix-presentation`, aba Mapa) para o analista ver onde tem trabalho esperando por ele. Cada passo do menu tem uma bolinha com quantas pendências esperam ação ali, vermelha quando alguma já passou do prazo.

## Estrutura

| Bloco (mapa) | Itens |
| --- | --- |
| Produto novo (Book) | Overview, Books, Seleção de itens, Cotações (convites de book), Negociações (solicitações ao fornecedor, com a amostragem) |
| Pedido | Overview, Pedidos, Certificação, Material de arte, Arte, Revisão, Contrato |
| Produção | Overview (`/app/production`), Pré-produção, Inspeção, Amostra, Produção, Booking (marítima), Logística, Carregamento, Documentos de carga, Embarque |
| Entrega | Overview, LPCO, Presença de carga, Canal cinza ou vermelho, Logística, Nota fiscal, Entrega, Retorno, Armazenagem; Containers, Fretes e Tarifário seguem no fim |
| Vendas | Estoque, Amostras, Ofertas, Venda |
| Financeiro | Financeiro, Contas a pagar, Fluxo de caixa (saiu de Painéis), Acordos e comissões, Multas |
| Painéis | Painel do dono, Painéis por área, Painel de SLA (só leitura, sem contador) |
| Cadastros | Parceiros, Produtos, Linhas |

Mensagens e Notificações saíram do menu de todos os papéis; ficam no cabeçalho, com o contador de não lidas. O Superplan saiu de Painéis e virou atalho em Configurações. Nenhuma tela ou rota foi removida.

## Telas

- **Overview do bloco** (`/app/flow/<bloco>`; o da Produção é `/app/production`): à esquerda, a linha do tempo vertical dos passos na ordem do mapa, com quantas esperam ação, quantas atrasaram e há quantos dias (média e a mais antiga); à direita, a tabela com os casos do passo escolhido (`?step=…`) e o atalho para resolver.
- **Tela do passo** (`/app/flow/<bloco>/<passo>`): os casos do passo, com o prazo, há quantos dias chegaram, filtros de prazo (`?due=overdue|today|week`) e o botão Resolver, que leva à tela focada do pedido quando ela existe (Die Cut, documento do pedido, documentos de embarque, amostras, fotos reais) ou ao ponto do pedido onde se faz.
- **Resolver aqui** (na tela do passo): para cada pedido com caso aberto no passo (até 15), o mesmo cartão de passos do detalhe do pedido, só com os passos deste ponto do mapa: Certificação (memorial, selo e arte com o selo), Booking, Logística (container na fábrica e vazio), Carregamento (carregado e lacrado), Documentos de carga (draft BL, invoice e packing, BL), Embarque (container no porto e rastreio), Amostra (retirada, envios, devolução), Presença de carga (presença, numerário, DI, CE Mercante, CI), Canal e Nota fiscal (DANFE). Mesmas regras e Server Actions do pedido; a ação volta para a tela do passo (`returnTo`, só `/app/flow/<bloco>/<passo>`). O detalhe do pedido continua com tudo.
- Passos que já tinham tela (Books, Seleção, Cotações, Negociações, Pedidos, Revisão, Estoque) abrem a tela de sempre, com o contador.
- Passos sem fonte de pendência ainda (Pré-produção, LPCO, Retorno, Armazenagem, Amostras e Ofertas de Vendas) aparecem com a tela vazia e a explicação; nada inventado.

## De onde vem o contador

- As mesmas pendências da tela Pendências (`pendingTasksFor` + `tasksForFunctions`: o operador vê só as das funções dele), lidas uma vez por página (`flowTasksFor`, cache do React). Só leitura; nada novo no banco. A bolinha de Pendências é o total.
- Cada pendência cai no passo de onde vem (`flowStepsOf` em `src/lib/flow.ts`): pelo item da etapa (arte, certificado, die cut, assinatura, inspeção…), pelo passo do embarque e da importação (`stepKey`) ou pelo tipo. A pendência de etapa que junta itens de passos diferentes conta uma vez em cada um. Mensagem a responder não entra (fica no cabeçalho).
- Grupo fechado mostra a soma dos itens; com o menu recolhido, um ponto. Vermelho quando alguma atrasou.

## Próximas etapas (divisão das telas que juntam muitas atividades)

O detalhe do pedido (`/app/orders/[id]`) concentra quase todas as ações. Esta entrega já tira dele os passos do embarque, da importação, da certificação e das amostras (seção "Resolver aqui") e leva os demais casos à tela focada quando ela existe (Die Cut, documento do pedido, documentos de embarque, fotos reais). Falta trazer para as telas dos passos as raias de arte e as linhas de requisito (arte, validação, arte final), a inspeção dos SKUs e o follow da produção. A divisão segue por blocos, uma entrega por vez, sem remover o detalhe do pedido: as ações de cada passo passam a aparecer também na tela do passo (Arte, Certificação, Inspeção, Documentos de carga, Presença de carga…), reaproveitando os mesmos componentes e Server Actions.

Código: `src/lib/flow.ts` (blocos, passos e classificação), `src/lib/services/flow.ts`, `src/components/flow-overview.tsx`, `src/components/flow-cases.tsx`, `src/app/app/flow/`, textos em `src/i18n/modules/flow.ts`. Testes: `tests/unit/flow-menu.test.ts`, `tests/unit/nav.test.ts` e `tests/e2e/production-screen.spec.ts`.
