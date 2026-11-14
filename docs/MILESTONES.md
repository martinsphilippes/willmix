# Marcos do pedido (motor por marcos)

Pedido do dono (14/11/2026). As 10 etapas antigas do motor (Pedido criado, Preparação, Pagamento ao fornecedor, Arte e embalagem, Inspeção, Embarque, Desembaraço, Transporte, Entregue, Encerrado) não seguem mais o desenho. Elas dão lugar a **16 marcos**, na ordem do mapa do processo (`docs/MAPA_PROCESSO.md`, copiado de `attilasm/wellmix-presentation`). Os marcos estão divididos nos mesmos blocos do menu lateral.

## Plano em fases (aprovado pelo dono em 14/11/2026)

| Fase | O que entra                                                                                                                                                                     | Apaga dados?          | Situação                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Histórico do Sankhya na situação real, sem avisos                                                                                                                               | Não                   | Feita: PR #430                                                                                                                        |
| 2    | Modelo dos 16 marcos, com dependências do mapa e situação calculada das subtarefas                                                                                              | Não                   | Esta entrega: regra (`src/lib/milestones.ts`), subtarefas (`src/lib/services/milestones.ts`) e cartão "Marcos do pedido" (só leitura) |
| 3    | Tela do pedido nova: linha do tempo dos marcos no lugar de "Etapas do pedido"; formulários só nos marcos em que o login tem tarefa; "Parceiros do pedido" vira botão com janela | Não                   | A fazer                                                                                                                               |
| 4    | Pendências, lembretes, SLA, Control Tower, Financeiro e Sankhya leem os marcos; book, seleção, produto e pedido ligados pelo mapa                                               | Não                   | A fazer                                                                                                                               |
| 5    | Migração dos dados para os marcos e remoção das etapas antigas (código e banco), com backup e conferência                                                                       | **Sim, irreversível** | Só com o "ok" do dono na hora                                                                                                         |

## Situação de um marco

- **Concluído:** todas as subtarefas feitas. Pedido encerrado conta tudo como concluído.
- **Em andamento:** os marcos anteriores (dependências) estão concluídos e falta alguma subtarefa.
- **Aguardando:** falta concluir um marco anterior. A tela mostra qual, por exemplo "Aguardando Arte".
- **Não se aplica:** o marco não tem subtarefa no pedido (certificação numa linha que não exige, amostras sem pedido de amostras). Pedido cancelado fica todo assim. O marco que não se aplica é transparente: o seguinte espera as dependências dele.
- **Andamento:** subtarefas feitas ÷ total. O prazo é o da subtarefa aberta mais antiga.

## Os 16 marcos

Legenda dos papéis, pelo RACI do mapa: **faz** (R), **aprova** (A), **é informado** (I). "No sistema hoje" diz quem recebe a tarefa na plataforma agora, pelas regras de encaminhamento que já existem (`cert-art-routing.ts`, `order-timeline.ts`, funções em Equipe e acessos).

### Pedido

| #   | Marco             | Depende de                   | Passos do mapa        | Atividades (subtarefas no sistema)                                                                                                 | Faz                            | Aprova               | Informado                                    | No sistema hoje                                                                                                                                   |
| --- | ----------------- | ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cadastro e fiscal | —                            | P1, P9, P14, P16      | NCM validado, ficha mestre completa (por produto), ficha de compra, produto cadastrado                                             | Cadastro                       | GP                   | Financeiro, Planner                          | Função Cadastro; NCM e ficha concluem sozinhos na tela fiscal e na do produto. **Falta a aprovação do GP**                                        |
| 2   | Material de arte  | —                            | P4                    | Faca (die cut), foto em alta, MOQ e prazo confirmados (por produto)                                                                | Fornecedor                     | Comprador            | Agência                                      | Fornecedor do pedido (quadro Die Cut). **Falta a aprovação do Comprador**                                                                         |
| 3   | Arte              | Material de arte             | P5, P5?, P7?, P7      | Arte, validação da arte, arte final com o selo, aprovação da arte                                                                  | Agência (designer)             | Marketing            | Fornecedor, OCP, Comprador                   | Arte e arte final: designer do pedido ou agência. Validação: o analista com "Validar a arte" (não o Marketing)                                    |
| 4   | Certificação      | —                            | P6, P8, P15           | Certificado; passos da certificação (memorial, laboratório, registro, selo, arte com o selo)                                       | OCP, Agência, Cadastro         | GP                   | Comex, Comprador                             | Certificadora (OCP) do pedido; selo aplicado por quem faz a arte; validação pelo analista. **Falta a aprovação do GP**                            |
| 5   | Contrato          | Cadastro, Arte, Certificação | P2, P3, P10, P17, P11 | Pedido confirmado, nº do Sankhya, pedido de amostras e aceite, envio para assinatura, assinatura Wellmix, assinatura do fornecedor | Comprador, Fornecedor, Planner | Diretoria de compras | Vendas, Financeiro, Dono, Trading, Marketing | Assinatura Wellmix: quem tem "Assinar o contrato pela Wellmix" (padrão: Diretorias). Resto: analista do pedido. Vendas é avisada no pedido gerado |
| 6   | Sinal             | Contrato                     | P12?, P12             | Sinal pago ou conta corrente                                                                                                       | Financeiro                     | Diretoria de compras | Dono, Fornecedor                             | Quem abre o Financeiro (Contas a pagar); conclui sozinho. **Falta a aprovação da Diretoria**                                                      |

### Produção

| #   | Marco                     | Depende de          | Passos do mapa          | Atividades                                                                                                | Faz                                            | Aprova                          | Informado                | No sistema hoje                                                                |
| --- | ------------------------- | ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| 7   | Pré-produção              | Sinal               | R1                      | Dados da produção e ETD                                                                                   | Fornecedor                                     | Planner                         | Comprador, Vendas        | Analista do pedido (cartão de produção). **Falta o Planner como aprovador**    |
| 8   | Produção                  | Pré-produção        | R1                      | Follow de 5, 15 e 25 dias; produção concluída quando a inspeção começa                                    | Fornecedor                                     | Planner                         | Comprador, Vendas        | Analista do pedido (follows)                                                   |
| 9   | Inspeção                  | Produção            | R3, R4?, R10, R11       | Fotos (desembalado, embalado, balança), peso, medidas, vídeo, conformidade, aprovação por SKU, tentativas | Fornecedor                                     | Analista, Trading               | GP                       | Fornecedor envia; analista aprova o SKU                                        |
| 10  | Amostras                  | Inspeção            | R12–R16, R5             | Retirada, envio ao Brasil, envio à agência na China, recebimento, devolução, fotos reais, ativa venda     | Trading, Marketing, Agência de marketing China | Analista, Marketing, Vendas, GP | Cliente, Vendas          | Trading ou fornecedor; fotos reais: agência de marketing; aprovação: Marketing |
| 11  | Booking e logística       | Inspeção            | R8, R17?, R17, R18, R19 | Booking, transportadora e custos de origem (EXW), container na fábrica e vazio, frete                     | Fornecedor, Trading, Marítima                  | Analista                        | Ag. de carga, Financeiro | Logística ou marítima; analista valida                                         |
| 12  | Carregamento e documentos | Booking e logística | R20, R7, R21–R25        | Container carregado e lacrado, fotos, packing list, invoice, BL e conferências                            | Fornecedor, Trading, Marítima                  | Analista, Financeiro            | Comex, Dono              | Documentos de embarque conferidos linha a linha; analista valida               |
| 13  | Embarque                  | Carregamento        | R26, R27                | Data, navio, embarcado, container no porto, rastreio diário                                               | Marítima, Trading                              | Analista                        | Planner, Vendas          | Comex interno (rastreio) e analista                                            |

### Entrega

| #   | Marco                    | Depende de      | Passos do mapa             | Atividades                                                                                                                                                                   | Faz                           | Aprova                    | Informado                      | No sistema hoje                                                                      |
| --- | ------------------------ | --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| 14  | Desembaraço              | Embarque        | E5, E5?, E6, E7, E7?, E11  | LPCO (NCM que exige), presença de carga, numerário (e pago), DI, CE Mercante, CI, canal; processo, documentos, custos e liberação                                            | Comex                         | Analista, Financeiro      | Dono (canal cinza ou vermelho) | Despachante e comex; numerário pelo financeiro                                       |
| 15  | Nota fiscal e transporte | Desembaraço     | E12?, E13–E16              | DANFE, placa, atualização de status, programar entrega                                                                                                                       | Analista, Planner, Financeiro | Analista, Planner         | Cliente, Vendas                | Analista e financeiro                                                                |
| 16  | Entrega e recebimento    | NF e transporte | E17?, E9, E18–E22, E24–E27 | Entregue, recebimento confirmado, descarga (lacre, fotos, checklist, contagem), RIC, devolução do container, lote, armazenamento; Compras, Fornecedor, Evidência, Financeiro | Transportador, Qualidade      | Analista, Planner, Vendas | Cliente                        | Quem abre Containers (recebimento). **E24–E27 ainda sem RACI nem tarefa no sistema** |

Também ficam fora dos 16 marcos: a Revisão (fila da Wellmix, não é do pedido), o pós-venda e recompra (E10, Vendas) e a oferta de amostra (E23, Vendas), que já estão no bloco Vendas do menu.

## Quem vê o quê (fase 3)

- **Time interno:** todos veem a linha do tempo inteira (os 16 marcos, a situação e o andamento) para se situar. Os campos de preenchimento aparecem só nos marcos em que o login tem tarefa liberada agora, pela regra de encaminhamento de cada subtarefa. O resto fica em "ver detalhes", só leitura. O administrador vê tudo.
- **Parceiros** (fornecedor, trading, agência, OCP, marítima, despachante, transportador): veem só os marcos e as subtarefas deles, como hoje (`src/lib/order-view.ts`).
- **Informados (I):** recebem aviso quando o marco conclui. Pedido do histórico em espera não gera aviso (fase 1).

## Lacunas para o dono decidir antes da fase 4

1. **Aprovações que o mapa pede e o sistema ainda não tem como passo:**
   - GP aprova o cadastro e a certificação;
   - Comprador aprova o material de arte;
   - Planner aprova a pré-produção;
   - Diretoria de compras aprova o sinal.

   A proposta é virar uma subtarefa "Aprovado por X" no fim do marco, que só libera o marco seguinte depois da aprovação. Cada uma precisa do sim do dono.

2. **Validação da arte:** no mapa quem aprova é o Marketing; hoje é o analista com a ação "Validar a arte". Manter ou trocar para a função Marketing?
3. **E24–E27 (Compras, Fornecedor, Evidência, Financeiro):** o que é cada atividade, quem faz e quem aprova.
4. **Pré-produção e Produção** cobrem o mesmo passo do mapa (R1). Ficam separadas, como já são no menu, ou viram um marco só?

## Código

- Regra pura: `src/lib/milestones.ts` (`MILESTONES`, `orderMilestones`). Os marcos juntam os passos do menu (`src/lib/flow.ts`), então cada item do pedido e cada passo do embarque já cai no marco certo.
- Subtarefas de um pedido: `src/lib/services/milestones.ts` (`orderSubtasks`, `milestonesOf`).
- Tela: cartão "Marcos do pedido" no detalhe do pedido (Wellmix), `src/components/order-milestones-card.tsx`.
- Textos: `src/i18n/modules/milestones.ts`.
- Testes: `tests/unit/milestones.test.ts` e `tests/unit/milestones-order.test.ts`.
