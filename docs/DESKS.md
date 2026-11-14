# Mesas de trabalho por papel

Mapa do processo, "Mesas de trabalho" (personas GP, Cadastro e fiscal, Marketing, Agência de arte e Certificadora). Cada área vê, numa tela só, o que espera por ela na etapa Pedido, com o prazo de cada passo (Configurações → SLA, docs/PURCHASE_ORDER.md seção 1a) e o atalho para a tela onde se faz.

- **Onde:** Pendências → **Mesa de trabalho** (`/app/tasks/desk`, `?desk=gp|cadastro|mkt|agency|ocp`). Fica dentro de Pendências: todos os papéis com mesa já abrem essa tela.
- **Quem:** a Wellmix vê todas as mesas e abre na da função (Cadastro → cadastro, Designer → marketing, Gerente de produto → GP); a agência de arte e a certificadora veem só a delas, com os pedidos em que estão.
- **Só leitura:** as filas saem dos mesmos itens das raias e das pendências; nada novo no banco. Um item só aparece quando já está liberado (o anterior feito).
- **Só para quem recebe (dono, 14/11/2026):** arte, validação, certificado e arte final aparecem só para o login que recebe cada uma (docs/PURCHASE_ORDER.md, seção 2, "Quem faz cada tarefa"): a arte e a arte final, para o designer do pedido; a validação, para o operador responsável; o certificado, para a certificadora do pedido. O administrador vê todas.

| Mesa | Filas |
| --- | --- |
| Gerente de produto | Amostras a avaliar (solicitações com a amostra enviada); certificados pendentes nos pedidos de compra |
| Cadastro e fiscal | NCM a validar e fichas mestre incompletas (seguram o contrato); certificações a vencer (aviso de Configurações); falhas da sincronização com o Sankhya nos últimos 7 dias |
| Marketing | Artes a validar; produtos novos fora da vitrine |
| Agência de arte | Artes a fazer (com as devolvidas e o motivo); artes finais com o selo |
| Certificadora | Certificados a emitir |

Prazo vencido aparece em vermelho, "atrasado". As outras mesas do mapa (diretoria, comprador, planner, financeiro, vendas, parceiros da logística) ficam para as próximas etapas.

Código: `src/lib/services/desks.ts`, `src/app/app/tasks/desk/page.tsx`, textos em `src/i18n/modules/desks.ts`. Teste: `tests/unit/purchase-order.test.ts` ("mesas de trabalho"), `tests/unit/purchase-lane-owners.test.ts` ("mesas") e o E2E do caminho principal.
