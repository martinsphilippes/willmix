# Painel de SLA

Cada operador da Wellmix vê o que está devendo, pelo prazo, nos clientes da carteira dele, e o que está atrasado com parceiros para ele cobrar. Quem tem equipe vê também o painel de todos abaixo dele; o administrador vê todos.

## 1. Problema

Até aqui, todos os logins da Wellmix viam a mesma lista de Pendências. Nada era de ninguém: não dava para saber quem está devendo o quê, cobrar pelo prazo ou acompanhar a equipe por cargo.

## 2. Objetivo

- Toda pendência da Wellmix tem um dono (o operador da carteira do cliente).
- Cada pessoa vê o que deve: atrasado, vence hoje, próximos 7 dias, depois.
- O chefe vê o próprio painel e o de todos abaixo dele. O administrador vê todos e o que está sem responsável.
- Indicador de cumprimento do SLA: etapas concluídas no prazo nos últimos 30 dias.

## 3. Decisões do dono

- **Dono da pendência:** carteira de clientes. Cada cliente tem um operador responsável. Trocar o responsável transfere a carteira na hora.
- **Hierarquia:** cada login tem um cargo (Analista, Coordenador, Supervisor, Gerente, Diretor) e a quem responde. A visibilidade segue a árvore, não o cargo.
- **Conteúdo:** pendências da Wellmix e, à parte, atrasos de parceiros nos clientes da carteira.

## 4. Modelo de dados (aditivo)

| Tabela | Coluna | Observação |
| --- | --- | --- |
| `users` | `jobLevel` | enum `analyst`, `coordinator`, `supervisor`, `manager`, `director`; opcional |
| `users` | `managerUserId` | a quem responde; opcional; índice `by_manager` |
| `parties` | `ownerUserId` | cliente: operador responsável; opcional; índice `by_owner` |

`Task` (src/lib/services/tasks.ts) ganhou `customerId` (em memória, não é coluna). Ele vale nas pendências de etapa, embalagem, solicitação (RFQ, escolher fornecedor, confirmar sinal), pós-venda, revisão, sourcing sob demanda e pagamento ao fornecedor.

## 5. Regras

1. Dono da pendência = `parties.ownerUserId` do cliente, se for um login ativo da Wellmix. Senão, "Sem responsável".
2. Quem vê quem (`visibleTeamIds`): o administrador vê todos os logins da Wellmix e "Sem responsável". Os demais veem o próprio painel e o de toda a equipe abaixo (subordinados e os deles). Escolher pelo endereço (`?u=`) alguém fora disso cai no padrão.
3. O padrão é "Todos" para quem tem equipe (ou é admin) e o próprio painel para quem não tem.
4. Atrasos de parceiros (não contam como atraso do operador, mas aparecem para ele cobrar):
   - etapa do pedido vencida com pendência de parceiro (fornecedor, agência, despachante, marítimo, transportador, cliente);
   - RFQ aberta sem resposta depois do prazo da solicitação;
   - embalagem da agência vencida.
5. SLA cumprido: etapas concluídas nos últimos 30 dias, com prazo, concluídas até o dia do prazo (dia em Brasília), por dono da carteira.
6. Só o administrador muda cargo, chefe e carteira. São recusados: chefe de si mesmo, ciclo (o chefe escolhido está abaixo da pessoa) e operador inativo ou de fora da Wellmix. Tudo vai para o histórico (`team.member`, `team.portfolio`).

## 6. Telas

- **Início → Painel de SLA** (`/app/sla`, toda a Wellmix):
  - Tabela da equipe (quem tem equipe): pessoa (recuada pela árvore), cargo, nº de clientes, atrasadas, vencem hoje, próximos 7 dias, parceiros atrasados e % no prazo.
  - Cartões de totais e listas por prazo, cada item com link para a tela onde se resolve.
- **Gestão → Equipe e carteira** (`/app/team`, só admin): cargo e "responde a" de cada login (a lista do chefe já esconde ele mesmo e quem está abaixo) e o operador responsável de cada cliente.

## 7. Segurança

- Só leitura no painel; leitura no servidor.
- Quem não é da Wellmix não abre (`slaBoardFor` recusa).
- Escrita só por Server Action com zod e papel de admin, conferido de novo no serviço.

## 8. Publicação

Rodar a Action "Publicar esquema Appwrite" (colunas e índices novos). Até lá, ninguém tem cargo, chefe ou carteira: o administrador vê tudo em "Sem responsável" e salvar em Equipe e carteira mostra "esquema desatualizado".

## 9. Melhorias futuras

- Aviso diário por e-mail/sino para cada operador com o que vence hoje e o que atrasou; resumo semanal para o chefe.
- Dono por função (compras × logística) quando a equipe crescer.
- Histórico do % no prazo por mês e por pessoa (gráfico).
- Reatribuir uma pendência específica sem trocar a carteira inteira.
