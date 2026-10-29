# Aprovação do pré-custo e funções da equipe (Fase A)

Origem: documento WA-PORTAL (fase 04, "Formação de pedido de compra") e decisão do dono: aplicar a recomendação (planner e diretoria de compras sempre; diretoria executiva a partir de um valor; reprovado volta ao comprador com motivo).

## 1. Problema

A escolha do fornecedor e o valor ao cliente valiam na hora em que o operador clicava em "Selecionar": nenhuma conferência do pré-custo pelo planner nem liberação da diretoria, como pede o processo de compras.

## 2. Regra

1. Com "Exigir aprovação" ligado (Configurações, padrão: ligado), escolher o fornecedor vira **"Enviar para aprovação"**: nada muda na solicitação, o cliente não vê nada e a proposta não sai.
2. Níveis, em ordem: **Planner** → **Diretoria de compras** → **Diretoria executiva** (só quando o valor ao cliente em BRL é igual ou maior que o limite das Configurações, padrão R$ 100.000, ou quando não há câmbio para converter).
3. Quem decide um nível: login da Wellmix com a **função** daquele nível (Gestão → Equipe e divisões) ou o administrador. Sem ninguém com a função, os administradores são avisados.
4. Segregação: quem enviou não aprova a própria escolha e ninguém decide dois níveis da mesma aprovação (o administrador pode tudo).
5. Aprovado no último nível: a seleção do fornecedor é gravada como antes (proposta, sinal, briefing, frete). Se ela não puder ser gravada (a ficha ou a cotação mudou), a aprovação fica "aprovada, mas não gravada" e o comprador é avisado para refazer.
6. Reprovado em qualquer nível: **motivo obrigatório**, a aprovação termina, o comprador (quem enviou) é avisado com o motivo e pode enviar outra escolha.
7. Enviar outra escolha com uma em aberto substitui a anterior (cancelada com o motivo). Quem enviou ou o admin pode cancelar.
8. Tudo vai para o histórico (`approval.submit`, `approval.approve`, `approval.reject`, `approval.cancel`, `approval.failed`), com usuário e data.

## 3. Funções da equipe

`users.functions` (várias por login): comprador, gerente de produto, planner, cadastro, financeiro, diretoria de compras, diretoria executiva. Editadas pelo admin em Equipe e divisões. Nesta fase, planner e diretorias definem quem aprova; as demais são usadas nas próximas fases (cadastro valida o produto, financeiro paga numerário etc.).

## 4. Telas

- **Solicitação** (Wellmix): o botão vira "Enviar para aprovação"; o cartão "Aprovação do pré-custo" mostra a escolha em aberto (valor, níveis, quem decidiu e quando) e, para quem decide o nível atual, Aprovar / Reprovar (com motivo). Abaixo, as aprovações anteriores com o motivo.
- **Pendências**: "Aprovar pré-custo (nível): produto" para quem pode decidir; "Escolher fornecedor" some enquanto a escolha aguarda aprovação.
- **Avisos**: próximo nível (ação), aprovada (concluída), reprovada ou não gravada (alerta) para quem enviou.
- **Configurações**: exigir aprovação (sim/não) e o valor da diretoria executiva.

## 5. Modelo de dados (aditivo)

Tabela `approvals` e coluna `users.functions` (ver docs/APPWRITE.md). Até o esquema ser publicado, a solicitação mostra o cartão vazio e enviar para aprovação devolve "esquema desatualizado"; desligar "Exigir aprovação" volta ao comportamento anterior.
