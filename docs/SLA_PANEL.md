# Painel de SLA

Cada analista da Wellmix vê o que está devendo, pelo prazo, nas solicitações e pedidos que caíram para ele, e o que está atrasado com parceiros para ele cobrar. Quem tem equipe vê também o painel de todos abaixo dele; o administrador vê todos.

## 1. Problema

Até aqui, todos os logins da Wellmix viam a mesma lista de Pendências. Nada era de ninguém: não dava para saber quem está devendo o quê, cobrar pelo prazo ou acompanhar a equipe por cargo.

## 2. Objetivo

- Toda pendência da Wellmix tem um dono, escolhido sozinho pelo sistema (ninguém escolhe à mão).
- Cada pessoa vê o que deve: atrasado, vence hoje, próximos 7 dias, depois.
- O chefe vê o próprio painel e o de todos abaixo dele. O administrador vê todos e o que está sem responsável.
- Indicador de cumprimento do SLA: etapas concluídas no prazo nos últimos 30 dias.

## 3. Decisões do dono

- **Dono da pendência:** automático, por divisão (segmento). Cada linha de produto pertence a uma divisão: **Wellmix** (Limpeza, Organização, Cutelaria, Cerâmica, Vidros, Mesa posta, Decoração, Eletro, Presentes) ou **WellKids** (Brinquedos, Primeira idade, Funs: infláveis, casa e lazer). Cada analista pertence a uma divisão. A solicitação nova cai no analista da divisão da linha do produto com menos pendências abertas; o pedido herda. (Versão anterior, por carteira de clientes escolhida à mão, foi trocada a pedido do dono; a coluna `parties.ownerUserId` fica sem uso.)
- **Hierarquia:** cada login tem um cargo (Analista, Coordenador, Supervisor, Gerente, Diretor) e a quem responde. A visibilidade segue a árvore, não o cargo.
- **Conteúdo:** pendências da Wellmix e, à parte, atrasos de parceiros nos clientes da carteira.

## 4. Modelo de dados (aditivo)

| Tabela          | Coluna          | Observação                                                                   |
| --------------- | --------------- | ---------------------------------------------------------------------------- |
| `users`         | `jobLevel`      | enum `analyst`, `coordinator`, `supervisor`, `manager`, `director`; opcional |
| `users`         | `managerUserId` | a quem responde; opcional; índice `by_manager`                               |
| `users`         | `division`      | `wellmix` ou `wellkids`: divisão que o analista atende; opcional             |
| `product_lines` | `division`      | divisão da linha; opcional                                                   |
| `requests`      | `ownerUserId`   | analista responsável (automático); opcional; índice `by_owner`               |
| `orders`        | `ownerUserId`   | herdado da solicitação; opcional; índice `by_owner`                          |
| `parties`       | `ownerUserId`   | da versão por carteira; sem uso                                              |

`Task` (src/lib/services/tasks.ts) ganhou `customerId` e `ownerUserId` (em memória, não são colunas; o dono vem da solicitação ou do pedido). Ele vale nas pendências de etapa, embalagem, solicitação (RFQ, escolher fornecedor, confirmar sinal), pós-venda, revisão, sourcing sob demanda e pagamento ao fornecedor.

## 5. Regras

1. Dono da pendência = `ownerUserId` da solicitação (ou do pedido), se for um login ativo da Wellmix. Senão, "Sem responsável" (produto fora do catálogo, linha sem divisão, divisão sem analista ou dado de antes da regra).
   1a. Escolha automática (`pickOwner`): produto → linha → divisão → analistas ativos da divisão → o com menos pendências abertas (solicitações antes do pedido + pedidos em andamento); empate pela ordem do nome. Feita ao criar a solicitação (inclusive lote e "Adicionar produto"); o pedido copia ao nascer.
   1b. "Distribuir agora" (admin) aplica a mesma regra a tudo que está aberto e sem responsável.
2. Quem vê quem (`visibleTeamIds`): o administrador vê todos os logins da Wellmix e "Sem responsável". Os demais veem o próprio painel e o de toda a equipe abaixo (subordinados e os deles). Escolher pelo endereço (`?u=`) alguém fora disso cai no padrão.
3. O padrão é "Todos" para quem tem equipe (ou é admin) e o próprio painel para quem não tem.
4. Atrasos de parceiros (não contam como atraso do operador, mas aparecem para ele cobrar):
   - etapa do pedido vencida com pendência de parceiro (fornecedor, agência, despachante, marítimo, transportador, cliente);
   - RFQ aberta sem resposta depois do prazo da solicitação;
   - embalagem da agência vencida.
5. SLA cumprido: etapas concluídas nos últimos 30 dias, com prazo, concluídas até o dia do prazo (dia em Brasília), por dono da carteira.
6. Só o administrador muda cargo, chefe, divisão do analista e divisão da linha. São recusados: chefe de si mesmo e ciclo (o chefe escolhido está abaixo da pessoa). Tudo vai para o histórico (`team.member`, `team.line_division`, `team.distribute`).

## 6. Telas

- **Início → Painel de SLA** (`/app/sla`, toda a Wellmix):
  - Tabela da equipe (quem tem equipe): pessoa (recuada pela árvore), cargo, divisão, atrasadas, vencem hoje, próximos 7 dias, parceiros atrasados e % no prazo.
  - Cartões de totais menores, que funcionam como filtros (`?show=overdue|today|week|later|partner|onTime`): tocar num deles abre, embaixo, na mesma tela, a tabela em linhas daquele grupo (pendência, detalhe, cliente, responsável quando a visão é de todos, aguardando quem, prazo e Abrir). Sem escolha, a tabela mostra todas as pendências da pessoa. O cartão "Etapas no prazo (30 dias)" abre a tabela das etapas por trás do indicador (pedido, etapa, cliente, prazo, concluída em, no prazo ou fora do prazo).
- **Gestão → Equipe e divisões** (`/app/team`, só admin): cargo, divisão e "responde a" de cada login (a lista do chefe já esconde ele mesmo e quem está abaixo), a divisão de cada linha de produto e o botão "Distribuir agora".

## 7. Segurança

- Só leitura no painel; leitura no servidor.
- Quem não é da Wellmix não abre (`slaBoardFor` recusa).
- Escrita só por Server Action com zod e papel de admin, conferido de novo no serviço.

## 8. Publicação

Rodar a Action "Publicar esquema Appwrite" (colunas e índices novos). Até lá, ninguém tem cargo, chefe ou divisão: o administrador vê tudo em "Sem responsável" e salvar em Equipe e divisões mostra "esquema desatualizado". Depois: definir a divisão de cada linha e de cada analista e tocar em "Distribuir agora" para o que já está em aberto.

## 9. Melhorias futuras

- Aviso diário por e-mail/sino para cada operador com o que vence hoje e o que atrasou; resumo semanal para o chefe.
- Dono por função (compras × logística) quando a equipe crescer.
- Histórico do % no prazo por mês e por pessoa (gráfico).
- Reatribuir à mão uma solicitação específica (exceção), com histórico.
- Escolher a linha (e a divisão) na solicitação de produto fora do catálogo, para ela também cair sozinha.
