# Marcos do pedido (motor por marcos)

Pedido do dono (14/11/2026). As 10 etapas antigas do motor (Pedido criado, Preparação, Pagamento ao fornecedor, Arte e embalagem, Inspeção, Embarque, Desembaraço, Transporte, Entregue, Encerrado) não seguem mais o desenho. Elas dão lugar a **16 marcos**, na ordem definida pelo dono em 14/11/2026 e com as dependências do mapa do processo (`docs/MAPA_PROCESSO.md`, copiado de `attilasm/wellmix-presentation`). Os marcos estão divididos nos mesmos blocos do menu lateral.

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

| #   | Marco            | Depende de                      | Passos do mapa           | Atividades (subtarefas no sistema)                                                                                                                                                                        | Faz                          | Aprova                   | Informado                            | No sistema hoje                                                                                                                                               |
| --- | ---------------- | ------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pedido novo      | —                               | P1, P2, P3, P9, P14, P16 | Pedido de compra gerado (Vendas avisada), programação de compra, pedido confirmado, nº do Sankhya; cadastro e fiscal do produto: NCM validado, ficha mestre completa, ficha de compra, produto cadastrado | Comprador, Planner, Cadastro | Diretoria de compras, GP | Vendas, Financeiro, Fornecedor       | Comprador gera; função Cadastro faz NCM e ficha (concluem sozinhos na tela fiscal e na do produto); Vendas é avisada. **Falta a aprovação do GP no cadastro** |
| 2   | Certificação     | Pedido novo                     | P6, P8, P15              | Certificado; passos da certificação (memorial, laboratório, registro, selo, arte com o selo)                                                                                                              | OCP, Agência, Cadastro       | GP                       | Comex, Comprador                     | Certificadora (OCP) do pedido; selo aplicado por quem faz a arte; validação pelo analista. **Falta a aprovação do GP**                                        |
| 3   | Material de arte | Pedido novo                     | P4                       | Faca (die cut), foto em alta, MOQ e prazo confirmados (por produto)                                                                                                                                       | Fornecedor                   | Comprador                | Agência                              | Fornecedor do pedido (quadro Die Cut). **Falta a aprovação do Comprador**                                                                                     |
| 4   | Arte             | Material de arte                | P5, P5?, P7?, P7         | Arte, validação da arte, arte final com o selo, aprovação da arte                                                                                                                                         | Agência (designer)           | Marketing                | Fornecedor, OCP, Comprador           | Arte e arte final: designer do pedido ou agência. Validação: o analista com "Validar a arte" (não o Marketing)                                                |
| 5   | Contrato         | Pedido novo, Certificação, Arte | P10, P17, P11            | Pedido de amostras e aceite, envio para assinatura, assinatura Wellmix, assinatura do fornecedor                                                                                                          | Comprador, Fornecedor        | Diretoria de compras     | Dono, Financeiro, Trading, Marketing | Assinatura Wellmix: quem tem "Assinar o contrato pela Wellmix" (padrão: Diretorias). Resto: analista do pedido                                                |
| 6   | Sinal            | Contrato                        | P12?, P12                | Sinal pago ou conta corrente                                                                                                                                                                              | Financeiro                   | Diretoria de compras     | Dono, Fornecedor                     | Quem abre o Financeiro (Contas a pagar); conclui sozinho. **Falta a aprovação da Diretoria**                                                                  |

### Produção

| #   | Marco                     | Depende de                | Passos do mapa          | Atividades                                                                                                                                          | Faz                                            | Aprova                          | Informado                | No sistema hoje                                                                |
| --- | ------------------------- | ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| 7   | Pré-produção              | Sinal                     | R1                      | Dados da produção (fábrica ou trade) e ETD                                                                                                          | Fornecedor                                     | Planner                         | Comprador, Vendas        | Analista do pedido (cartão de produção). **Falta o Planner como aprovador**    |
| 8   | Inspeção                  | Pré-produção              | R3, R4?, R10, R11       | Fotos (desembalado, embalado, balança), peso, medidas, vídeo, conformidade, aprovação por SKU, tentativas; follow de 5, 15 e 25 dias até a inspeção | Fornecedor                                     | Analista, Trading               | GP                       | Fornecedor envia; analista aprova o SKU                                        |
| 9   | Amostras                  | Inspeção                  | R12–R16, R5             | Retirada, envio ao Brasil, envio à agência na China, recebimento, devolução, fotos reais, ativa venda                                               | Trading, Marketing, Agência de marketing China | Analista, Marketing, Vendas, GP | Cliente, Vendas          | Trading ou fornecedor; fotos reais: agência de marketing; aprovação: Marketing |
| 10  | Produção                  | Inspeção                  | R1                      | Produção concluída e liberada para carregar (inspeção aprovada)                                                                                     | Fornecedor                                     | Planner                         | Comprador, Vendas        | Conclui sozinha quando a inspeção conclui                                      |
| 11  | Booking e logística       | Produção                  | R8, R17?, R17, R18, R19 | Booking (reserva no navio), transportadora e custos de origem (EXW), container na fábrica e vazio, frete                                            | Fornecedor, Trading, Marítima                  | Analista                        | Ag. de carga, Financeiro | Logística ou marítima; analista valida                                         |
| 12  | Carregamento e documentos | Booking e logística       | R20, R7, R21–R25        | Container carregado e lacrado, fotos, packing list, invoice, BL e conferências                                                                      | Fornecedor, Trading, Marítima                  | Analista, Financeiro            | Comex, Dono              | Documentos de embarque conferidos linha a linha; analista valida               |
| 13  | Embarque                  | Carregamento e documentos | R26, R27                | Data, navio, embarcado, container no porto, rastreio diário                                                                                         | Marítima, Trading                              | Analista                        | Planner, Vendas          | Comex interno (rastreio) e analista                                            |

### Entrega

| #   | Marco                    | Depende de      | Passos do mapa             | Atividades                                                                                                                                                                                                         | Faz                           | Aprova                    | Informado                      | No sistema hoje                                                                                                           |
| --- | ------------------------ | --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 14  | Desembaraço              | Embarque        | E5, E5?, E6, E7, E7?, E11  | LPCO (NCM que exige), presença de carga, numerário (e pago), DI, CE Mercante, CI, canal; processo, documentos, custos e liberação                                                                                  | Comex                         | Analista, Financeiro      | Dono (canal cinza ou vermelho) | Despachante e comex; numerário pelo financeiro                                                                            |
| 15  | Nota fiscal e transporte | Desembaraço     | E12?, E13–E16              | DANFE, placa, atualização de status, programar entrega                                                                                                                                                             | Analista, Planner, Financeiro | Analista, Planner         | Cliente, Vendas                | Analista e financeiro                                                                                                     |
| 16  | Entrega e recebimento    | NF e transporte | E17?, E9, E18–E22, E24–E27 | Entregue, recebimento confirmado, descarga (lacre, fotos, checklist, contagem), RIC, devolução do container, lote, armazenamento; Comunicar a Compras, Fornecedor, Evidência e Financeiro (caminho da divergência) | Transportador, Qualidade      | Analista, Planner, Vendas | Cliente                        | Quem abre Containers (recebimento). **E24–E27 (divergência no recebimento) ainda sem tarefa no sistema: próxima entrega** |

Também ficam fora dos 16 marcos: a Revisão (fila da Wellmix, não é do pedido), o pós-venda e recompra (E10, Vendas) e a oferta de amostra (E23, Vendas), que já estão no bloco Vendas do menu.

## Quem vê o quê (fase 3)

- **Time interno:** todos veem a linha do tempo inteira (os 16 marcos, a situação e o andamento) para se situar. Os campos de preenchimento aparecem só nos marcos em que o login tem tarefa liberada agora, pela regra de encaminhamento de cada subtarefa. O resto fica em "ver detalhes", só leitura. O administrador vê tudo.
- **Parceiros** (fornecedor, trading, agência, OCP, marítima, despachante, transportador): veem só os marcos e as subtarefas deles, como hoje (`src/lib/order-view.ts`).
- **Informados (I):** recebem aviso quando o marco conclui. Pedido do histórico em espera não gera aviso (fase 1).

## Aprovações do mapa (decisão do dono, 14/11/2026)

Cada aprovação é um item obrigatório do pedido de compra, no fim do marco (`MILESTONE_APPROVALS`, `src/lib/purchase-lanes.ts`):

| Marco            | Item                                                    | Quem aprova (ação em Equipe → Funções e acessos)                       | Libera quando                                                 |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Pedido novo      | `approval_registration`                                 | GP ("Aprovar o cadastro e a certificação", `approve.productManager`)   | NCM validado e ficha mestre completa de todos os produtos     |
| Certificação     | `approval_certification` (só com certificação na linha) | GP (a mesma ação)                                                      | Certificado de todos os produtos                              |
| Material de arte | `approval_art_material`                                 | Comprador ("Aprovar o material de arte", `approve.buyer`)              | Faca, foto em alta, MOQ e prazo de todos os produtos          |
| Pré-produção     | `approval_pre_production` (na etapa da inspeção)        | Planner ("Aprovar a pré-produção", `approve.planner`)                  | Etapa da inspeção começou (dados e ETD no cartão de produção) |
| Sinal            | `approval_down_payment` (na etapa do contrato)          | Diretoria de compras ("Aprovar o sinal", `approve.purchasingDirector`) | Sinal pago ou conta corrente                                  |

- **Quem recebe a tarefa:** o analista do pedido, se ele tem a ação; senão quem tem (`wellmixRequirementRoute`). O servidor recusa quem não tem a ação (`canSubmitRequirement`). O administrador sempre pode.
- **O marco seguinte só libera depois:** o item é obrigatório, então a etapa do motor não conclui sem ele. Assim o contrato espera as três aprovações da Preparação, e a produção espera a do sinal.
- **Pedidos já abertos:** não ganham os itens novos, como nas outras mudanças de etapa. Valem os pedidos de compra gerados a partir de agora.
- **Padrão das ações:** GP (`product_manager`), Comprador (`buyer`), Planner (`planner`) e Diretoria de compras (`purchasing_director`). **Em produção as funções já têm as ações gravadas.** Enquanto o dono não marcar as ações novas em Equipe e acessos, só o administrador aprova.
- **Validar a arte pelo Marketing (P5?):** a troca é feita em Equipe e acessos: desmarcar "Validar a arte" das funções que têm hoje (Comprador e outras) e marcar na função Designer (o Marketing). O padrão do código continua o de antes (quem abre Pedidos), porque não muda o que está gravado.

## Lacunas que faltam

1. **E24–E27:** decisão do dono (14/11/2026). O caminho da divergência no recebimento entra como passos do marco 16, na próxima entrega:
   - Comunicar a Compras: faz a Qualidade, aprova o Planner;
   - Fornecedor: faz o Comprador, e o fornecedor também responde pelo portal;
   - Evidência: faz a Qualidade, aprova o Analista;
   - Financeiro: faz o Financeiro, aprova a Diretoria de compras.

## Código

- Regra pura: `src/lib/milestones.ts` (`MILESTONES`, `orderMilestones`). Os marcos juntam os passos do menu (`src/lib/flow.ts`), então cada item do pedido e cada passo do embarque já cai no marco certo.
- Subtarefas de um pedido: `src/lib/services/milestones.ts` (`orderSubtasks`, `milestonesOf`).
- Tela: cartão "Marcos do pedido" no detalhe do pedido (Wellmix), `src/components/order-milestones-card.tsx`.
- Textos: `src/i18n/modules/milestones.ts`.
- Testes: `tests/unit/milestones.test.ts` e `tests/unit/milestones-order.test.ts`.
