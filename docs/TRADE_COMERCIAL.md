# Trade e Comercial no portal (Projeto Campineira)

Pedido do dono (17/11/2026): levar para o portal o painel "Projeto Campineira — Etapa 1" (HTML feito com IA para a coordenadora de trade, apresentado ao Wellington), com os dados vindo da base do portal e do Sankhya, para a área de trade e para o comercial. Prioridades do dono: **controle das atividades com SLA das pessoas envolvidas**, **dias de cliente sem atendimento** e, depois, **sugestão de mix de produtos com IA** e **as abas do painel**.

Situação (18/11/2026): especificação aprovada pelo dono, com os 5 pontos que estavam "a confirmar" aceitos como recomendados. **Fase 1 no código (PR 1)**: grupos econômicos, responsável pela carteira, atendimento confirmado pelos dois lados, prazo em Configurações, tela "Carteira e atendimento" e as pendências (seção "Entregue no PR 1", no fim). Fases 1b, 0, 2 e 3 seguem a especificação, um PR por vez.

## 1. Problema

- O painel de hoje é um HTML parado, com uma planilha extraída à mão: 4.549 linhas "produto × cliente" do grupo Campineira (5 códigos de parceiro: 7197, 3295, 4286, 4094 e 5901), 752 SKUs, 701.934 peças, 10 grupos de produto, última compra de 12/2024 a 10/2026 e o estoque por SKU.
- A planilha só tem a **última compra** e a quantidade acumulada: não tem pedidos, meses nem valores. O próprio painel avisa que recompra, vendas por período e 2025 × 2026 não são calculáveis com ela (mostra só a data da última compra).
- Não existe registro de atendimento ao cliente nem prazo para atender: ninguém sabe há quantos dias um cliente está sem atendimento, nem quem deveria ter atendido.
- As ações do plano de trade não têm dono, prazo nem acompanhamento.
- O portal não tem o conceito de **grupo econômico** (vários CNPJs de um mesmo grupo, como a Campineira).

## 2. Objetivo

1. Cada cliente acompanhado tem um responsável, e todo mundo vê há quantos dias ele está sem atendimento, contra um prazo único que o administrador muda.
2. Atendimento só vale quando **quem atendeu e quem foi atendido confirmam** (decisão do dono).
3. As ações de trade viram atividades com responsável, prazo, evidência e cumprimento do SLA, nas Pendências e no Painel de SLA.
4. As abas do painel passam a ler dados reais do Sankhya (pedidos com data, produto, quantidade e valor), por cliente e por grupo econômico.
5. O portal sugere um mix de produtos por cliente (só sugestão, decisão do dono), com a IA explicando o porquê.

## 3. Requisitos funcionais

**Fase 1 (prioridade do dono)**

- Grupos econômicos: lista montada à mão (decisão do dono): criar, renomear, arquivar, incluir e tirar clientes. Um cliente fica em no máximo um grupo.
- Responsável pela carteira: por cliente, a pessoa da Wellmix que atende. Padrão: o login ligado ao vendedor do Sankhya do cliente (RCA, `CODVEND`); o administrador pode escolher outra pessoa no cliente ou no grupo.
- Registrar atendimento: cliente, data e hora, canal (visita, ligação, WhatsApp, e-mail, videochamada, outro), resumo, próximo passo e fotos opcionais. Quem registra é quem atendeu e, ao registrar, já confirma o lado dele.
- Confirmação do cliente: por um link (não precisa de login; só 2 clientes têm login no portal). O link vai por e-mail quando o provedor de e-mail existir; até lá, quem atendeu copia o link e manda pelo WhatsApp ou pelo e-mail dele. No link, o cliente vê o resumo e escolhe "Confirmo" ou "Não aconteceu" (com o nome de quem confirma e, no segundo caso, o motivo).
- Tela "Carteira e atendimento": clientes com responsável, grupo, último atendimento confirmado, dias sem atendimento, situação do prazo (em dia, vence em 7 dias, atrasado, nunca atendido) e atendimentos aguardando o cliente. Filtros por responsável, grupo e situação; ordem padrão pelo mais atrasado.
- Histórico de atendimentos na ficha do cliente e do grupo.
- Prazo único de atendimento em Configurações (decisão do dono), só o administrador muda.

**Fase 1b**

- Atividades de trade (o "Plano de ação Trade" do painel): título, descrição, cliente ou grupo, responsável, prazo, situação (aberta, em andamento, concluída, cancelada), evidência ao concluir (foto ou arquivo) e observação.
- Cada atividade aberta é pendência do responsável e entra no Painel de SLA (cumprimento no prazo).

**Fase 0 (base de vendas, antes da Fase 2)**

- Carga do Sankhya (DbExplorer, view `VW_AD_PEDCLIENTE_ITEM_WELL`, a mesma do histórico da Nova solicitação, docs/PURCHASE_HISTORY.md seção 9) gravada numa tabela resumida: mês × cliente × produto (peças pedidas e entregues, valor, número de pedidos, última data).
- Com ela, na carteira: **dias sem compra** ao lado de dias sem atendimento.

**Fase 2 (as abas do painel, por cliente ou grupo)**

Visão executiva, ranking, curva ABC (por peças; por valor só para o administrador), frequência por SKU, venda por mês, 2025 × 2026 (agora com venda real), mix e categorias, estoque e disponibilidade, ciclo de vida, grupo, diagnóstico e plano de ação. Cada aba com exportação CSV, como no HTML.

**Fase 3 (sugestão de mix com IA)**

- Por cliente: itens que clientes parecidos compram e ele não; itens fortes do grupo de produto que faltam nele; itens com estoque disponível; sem itens sem estoque ou parados.
- As regras escolhem os itens com os dados reais; a IA só ordena e escreve o porquê (nada inventado). O vendedor ajusta e leva a sugestão (não vira oferta, decisão do dono).

## 4. Regras de negócio

1. **Atendimento válido** = confirmado pelos dois lados. **Confirmado pelo dono (18/11/2026):** só ele zera o contador de dias sem atendimento; o registrado e não confirmado aparece como "aguardando o cliente" e não zera.
2. **Prazo:** o mesmo para todos os clientes (decisão do dono), em dias (de 1 a 365), em Configurações; só o administrador muda. **Confirmado:** valor inicial de 30 dias.
3. **Situação do cliente:** em dia (dias sem atendimento ≤ prazo − 7), vence em 7 dias, atrasado (> prazo) ou nunca atendido. Os dias contam no calendário de Brasília. Com prazo curto (menos de 8 dias), a janela de "vence em breve" fica com prazo − 1 dias.
4. **Quem recebe pendência:** **confirmado:** só os clientes acompanhados (num grupo econômico ativo ou com responsável escolhido) geram a pendência "Atender {cliente}" para o responsável quando passam do prazo ou nunca foram atendidos (evita milhares de pendências: 2.336 clientes têm vendedor no Sankhya). Cliente acompanhado sem responsável: a pendência fica com quem gere a carteira (e o administrador). Os outros clientes não entram na carteira; a busca da tela abre qualquer um para registrar o atendimento.
5. **Responsável:** o escolhido pelo administrador no cliente; senão o do grupo; senão o login ligado ao vendedor do Sankhya do cliente; senão "Sem responsável".
6. **Link de confirmação:** vale 14 dias e uma vez só; vencido, quem atendeu gera outro. "Não aconteceu" marca o atendimento como contestado, avisa quem atendeu e o responsável, e não conta.
7. **Valores em R$:** só o administrador (decisão do dono; "Ver valores e margem"). Trade e comercial veem peças, SKUs, clientes e datas.
8. **Sugestão de mix:** só sugestão, sem preço nem desconto (decisão do dono).
9. **Grupo econômico:** lista à mão (decisão do dono). **Confirmado:** quem mantém grupos, responsáveis e atividades: o administrador e quem ele liberar pela ação nova "Gerir carteira e trade" (Funções e acessos, grupo "Vendas e trade"; padrão: ninguém além do administrador), por exemplo a coordenadora de trade.

## 5. Casos especiais

- Cliente sem e-mail: o link é copiado e enviado pelo WhatsApp (botão "Copiar link").
- Mesmo código do Sankhya em dois cadastros: a carga do Sankhya guarda um cadastro por tipo (cliente e fornecedor). Conferido em 18/11/2026: o 7197 (Campineira) aparece duas vezes porque está marcado como cliente **e** como fornecedor no Sankhya; o mais antigo é o de fornecedor e o de cliente é o mais novo. Não é duplicado, e nada foi unificado (unificar "ficando o mais antigo" desativaria o cliente). A carteira, os atendimentos e as vendas usam só o cadastro de cliente. Se a Campineira não for fornecedora, o certo é desmarcar "fornecedor" no Sankhya (decisão do dono).
- Atendimento registrado por quem não é o responsável: vale (o cliente foi atendido); aparece com o nome de quem atendeu.
- Atendimento no mesmo dia, mais de um: conta o último confirmado.
- Pessoa sai da empresa: os clientes dela ficam "Sem responsável" até o administrador escolher outro; o histórico fica.
- Cliente que muda de grupo: os atendimentos e as atividades antigas continuam com o cliente; o grupo novo passa a vê-los.
- Sem o Sankhya configurado: Fases 0, 2 e 3 mostram o aviso e nada inventado; Fase 1 funciona.

## 6. Fluxo do usuário

1. O administrador (ou quem tem "Gerir carteira e trade") monta o grupo Campineira com os 5 clientes e escolhe o responsável.
2. O vendedor abre "Carteira e atendimento", vê os clientes atrasados no topo e registra o atendimento depois da visita ou da ligação.
3. O portal mostra o link de confirmação; o vendedor manda ao cliente pelo WhatsApp (ou o e-mail sai sozinho quando houver provedor).
4. O cliente abre o link e confirma; o contador zera e o cliente volta para "em dia".
5. Passou do prazo: o responsável recebe a pendência "Atender {cliente}"; a equipe acima dele vê no Painel de SLA.
6. A coordenadora de trade cria as atividades do plano de ação, com responsável e prazo; o responsável conclui com a foto ou o arquivo de evidência.

## 7. Papéis e permissões

| Quem                                                                 | Vê                                                                                           | Faz                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Administrador                                                        | tudo, inclusive valores em R$                                                                | tudo; muda o prazo; unifica clientes             |
| Com "Gerir carteira e trade" (padrão: ninguém além do administrador) | todos os clientes e atividades                                                               | grupos, responsáveis, atividades                 |
| Vendedor, promotor, coordenadora (login com a tela nova)             | os clientes da própria carteira e os da equipe abaixo dele (a mesma árvore do Painel de SLA) | registra atendimento; conclui as atividades dele |
| Cliente (sem login)                                                  | só o atendimento do link                                                                     | confirma ou diz que não aconteceu                |

As pessoas da demanda terão login no portal (decisão do dono).

## 8. Estrutura do banco de dados (só aditiva)

| Tabela / coluna                   | O quê                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customer_groups`                 | grupo econômico: nome, observação, responsável (opcional), arquivado em, criado por                                                                                                                                                                                                                        |
| `parties.customerGroupId`         | grupo do cliente (opcional; índice)                                                                                                                                                                                                                                                                        |
| `parties.ownerUserId`             | já existe, sem uso: passa a ser o responsável escolhido pelo administrador                                                                                                                                                                                                                                 |
| `users.sellerCode`                | código do vendedor no Sankhya (`CODVEND`) do login, para a carteira automática                                                                                                                                                                                                                             |
| `customer_attendances`            | cliente, quem atendeu, canal, data e hora, resumo, próximo passo, fotos, situação (aguardando o cliente, confirmado, contestado, cancelado), confirmação do cliente (data, nome, por link ou login), motivo da contestação, parte aleatória do link (o link é assinado pelo servidor, seção 15) e validade |
| `trade_activities`                | título, descrição, cliente ou grupo, responsável, prazo, situação, concluída em, evidência, observação, criada por                                                                                                                                                                                         |
| `settings.attendanceSlaDays`      | prazo de atendimento em dias                                                                                                                                                                                                                                                                               |
| `customer_sales_monthly` (Fase 0) | mês × cliente × produto: peças pedidas e entregues, valor, pedidos, última data, carregado em                                                                                                                                                                                                              |

Indicadores seguem docs/RESUMOS.md: telas de indicador leem tabelas resumidas, nunca pedido a pedido.

## 9. APIs e integrações

- **Sankhya (DbExplorer):** `VW_AD_PEDCLIENTE_ITEM_WELL` (pedidos do cliente: data, produto, quantidade pedida e entregue, preço, desconto). Fase 0 depende de o usuário do portal ter acesso a ela em produção (conferir pelo card "Do Sankhya, consultado agora" na Nova solicitação).
- **E-mail e WhatsApp:** em simulação hoje (docs/INTEGRATIONS.md, itens 4 e 5). O link de confirmação funciona sem eles (copiar e mandar); com o provedor, o e-mail sai sozinho.
- **IA:** a mesma do portal (docs/INTEGRATIONS.md, item 7), só para ordenar e explicar a sugestão de mix.

## 10. Automações

- A situação dos clientes e as pendências são calculadas na hora em que a tela abre (sem rotina noturna): a pendência "Atender {cliente}" aparece quando o acompanhado passa do prazo e some quando o atendimento é confirmado.
- Atendimento aguardando o cliente há 3 dias: pendência "Cobrar a confirmação de {cliente}" para quem atendeu (reenviar o link ou gerar outro).
- "Não aconteceu" no link: aviso no portal para quem atendeu e para o responsável.
- Atividade de trade vencida: atrasada no Painel de SLA do responsável e da equipe acima.
- Fase 0: carga noturna das vendas do Sankhya (e "Atualizar agora" para o administrador).

## 11. Relatórios

CSV em cada tela: carteira (cliente, responsável, grupo, último atendimento, dias sem atendimento, situação), atendimentos (período, pessoa, canal, situação), atividades (responsável, prazo, situação, no prazo ou não) e as abas da Fase 2, como no HTML.

## 12. Dashboards

- Fase 1: topo da "Carteira e atendimento" com os totais por situação e por responsável.
- Fase 2: "Painel do cliente e do grupo" com as abas do HTML, agora com venda real por mês (recompra, período e 2025 × 2026 deixam de ser só "data da última compra").

## 13. Indicadores

- % de clientes acompanhados em dia; média de dias sem atendimento.
- Atendimentos confirmados por pessoa no mês; taxa de confirmação pelo cliente; contestados.
- Atividades de trade concluídas no prazo (%); tempo médio para concluir.
- Fase 0 em diante: dias sem compra, recompra, curva ABC, frequência por SKU, cobertura do mix.

## 14. Auditoria

Tudo no histórico (Auditoria): grupo criado, alterado, arquivado; cliente incluído ou retirado do grupo; responsável alterado; atendimento registrado, confirmado, contestado, cancelado, link gerado de novo; atividade criada, alterada, concluída; prazo alterado; clientes unificados.

## 15. Segurança

- Link de confirmação: `/atendimento/<id>.<assinatura>`, assinado pelo servidor (HMAC com a chave da sessão) sobre uma parte aleatória guardada no atendimento; o link em si não fica no banco. Validade de 14 dias e uso único (respondido ou cancelado, a página só mostra a situação); "Gerar outro link" troca a parte aleatória e o anterior deixa de valer. A página mostra só o necessário (nome do cliente, primeiro nome de quem atendeu, data, canal e resumo; nunca o próximo passo nem as fotos), não é indexada e não abre nada do portal.
- Leitura e permissões no servidor; quem não vê um cliente não o recebe nem por endereço.
- Valores em R$ só para o administrador.
- Dados de contato do cliente (LGPD): só para quem atende o cliente.

## 16. Melhorias futuras

- E-mail e WhatsApp automáticos (provedor e chave).
- Check-in da visita com localização e foto obrigatória.
- Prazo por classe de cliente (A, B, C) e roteiro de visitas.
- Metas por pessoa e por grupo; ranking de atendimento.
- Sugestão de mix aprendendo com o que virou pedido.

## Plano de entrega (um PR por linha)

| PR  | Conteúdo                                                                                                                                                                      | Depende de               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Grupos econômicos, responsável pela carteira, atendimentos com confirmação dos dois lados, prazo em Configurações, "Carteira e atendimento" e a pendência "Atender {cliente}" | entregue (18/11/2026)    |
| 2   | Atividades de trade com SLA (Pendências e Painel de SLA): o Plano de ação Trade                                                                                               | entregue (19/11/2026)    |
| 3   | Fase 0: base de vendas do Sankhya e "dias sem compra" na carteira                                                                                                             | acesso à view no Sankhya |
| 4   | Fase 2: painel do cliente e do grupo com as abas                                                                                                                              | PR 3                     |
| 5   | Fase 3: sugestão de mix com IA                                                                                                                                                | PR 3                     |

## Dados de produção (17 e 18/11/2026, leitura)

- Os 5 clientes do grupo estão no portal, com e-mail e telefone, todos com o vendedor 101 no Sankhya e nenhum com login. O 7197 aparece duas vezes porque é cliente e fornecedor no Sankhya (um cadastro por tipo; seção 5).
- No portal: 26.688 clientes, 24.579 com e-mail, 2.336 com vendedor do Sankhya (118 vendedores); 2 clientes com login; 58 logins da Wellmix.

## Entregue no PR 1 (Fase 1, 18/11/2026)

- **Telas:** Vendas → "Carteira e atendimento" (`/app/portfolio`): totais por situação (atrasado, nunca atendido, vence em até 7 dias, em dia) que filtram a lista; filtros por responsável (e "Sem responsável"), grupo, situação e cliente ou código; ordem pelo mais atrasado; e a busca "Registrar atendimento de outro cliente" (nome, código do Sankhya ou CNPJ). A ficha do cliente na carteira (`/app/portfolio/<cliente>`): situação, prazo, responsável e de onde ele vem (escolhido no cliente, do grupo ou vendedor do Sankhya), "Carteira do cliente" (grupo e responsável, para quem gere), "Registrar atendimento" (canal, data e hora de Brasília, resumo, próximo passo e até 6 fotos) e o histórico com o link para o cliente ("Copiar link", "Gerar outro link", "Cancelar atendimento"). Grupos econômicos (`/app/portfolio/groups` e `/app/portfolio/groups/<id>`), só para quem gere: criar, renomear, responsável, observação, arquivar ou reativar, incluir (busca) e tirar clientes; incluir num grupo tira do anterior.
- **Link público:** `/atendimento/<código>`, sem login: "Confirmo o atendimento" ou "Não aconteceu" (com o nome de quem responde e, no segundo, o motivo).
- **Acesso:** tela `portfolio` (Funções e acessos, módulo Vendas; padrão da função Vendas) e ação `trade.manage` "Gerir carteira e trade" (grupo "Vendas e trade"; padrão: só o administrador). Sem "Gerir", cada pessoa vê os clientes da própria carteira e os da equipe abaixo dela (a árvore do Painel de SLA).
- **Código do vendedor:** na página da pessoa (Equipe Interna), o administrador grava o código do vendedor do Sankhya (`CODVEND`) do login; os clientes com esse RCA ficam com ela quando não há responsável no cliente nem no grupo.
- **Configurações:** "Prazo de atendimento ao cliente (dias)", padrão 30, só o administrador.
- **Pendências:** "Atender {cliente}" (passo Vendas → Carteira e atendimento) e "Cobrar a confirmação de {cliente}"; entram no Painel de SLA do responsável e da equipe acima.
- **Banco (aditivo):** `customer_groups`, `customer_attendances`, `parties.customerGroupId` e `users.sellerCode`.
- **Auditoria:** `portfolio.group.*`, `portfolio.customer_group`, `portfolio.customer_owner`, `attendance.register`, `attendance.link`, `attendance.cancel`, `attendance.confirm`, `attendance.dispute` e `team.seller_code`.
- **Fica para os próximos PRs:** exportação CSV da carteira e dos atendimentos, histórico de atendimentos também na ficha do grupo e no cadastro do cliente, e os totais por responsável no topo.

## Entregue no PR 2 (Plano de ação Trade, 19/11/2026)

Decisão do dono (19/11/2026): seguir com a base de vendas do Sankhya e o painel (PRs 3 e 4), "com o plano de ação junto". A consulta ao Sankhya funciona em produção (o histórico de compras da Campineira aparece na Nova solicitação).

- **O que é:** a tela 12 do painel do Projeto Campineira ("Plano de ação Trade"), agora gravada no portal: no HTML os cartões ficavam só na sessão; aqui cada ação tem responsável, prazo e situação, e fica no histórico.
- **Telas:** Vendas → "Plano de ação Trade" (`/app/portfolio/plan`): totais por situação (pendente de validação, investigar, piloto aprovado, atrasadas, concluídas), filtros por situação, responsável, grupo e busca, a lista e "Nova ação" (quem gere a carteira); a ação (`/app/portfolio/plan/<id>`) com a situação, a resposta da gestão e as fotos de evidência, e "Editar ação" (quem gere, enquanto aberta); "Exportar CSV" com os filtros da tela. Nas fichas do cliente e do grupo, o quadro "Ações de trade" com "Nova ação" já preenchendo o cliente ou o grupo.
- **Situações (as do HTML):** Pendente de validação, Investigar, Piloto aprovado, Concluída; mais Cancelada (só quem gere). Em aberto: as três primeiras.
- **Regras:**
  - a ação é de um cliente ou de um grupo econômico (um dos dois);
  - prazo de hoje em diante ao criar;
  - concluir pede a resposta ou uma evidência (foto, até 6 por ação);
  - o responsável avança a situação das ações dele;
  - quem gere a carteira cria, edita, cancela e reabre a concluída;
  - quem não gere vê as próprias e as da equipe abaixo (a árvore do Painel de SLA).
- **Pendências e SLA:** cada ação em aberta é a pendência "Ação de trade: {ação}" do responsável, com o prazo dela (passado o prazo, atrasada); entra no Painel de SLA do responsável e da equipe acima. Concluída: "No prazo" ou "Com atraso".
- **Avisos:** o responsável é avisado ao receber a ação; quem criou, quando ela é concluída.
- **Do diagnóstico (PR 4):** a ação guarda o produto (CODPROD e nome) e o foco do diagnóstico, para o painel abrir "Nova ação" já preenchida a partir de um SKU.
- **Banco (aditivo):** tabela nova `trade_activities`.
- **Auditoria:** `trade.activity.create`, `trade.activity.update` e `trade.activity.status`.
