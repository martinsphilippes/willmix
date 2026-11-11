# Série WPE e WLO · Wellmix: do pedido à entrega e a logística

Vídeos para a equipe da Wellmix que conduz o pedido **depois do sinal**: conferir o pedido e o Sankhya, validar a ficha de compra, acompanhar arte e assinatura, decidir a inspeção, tocar o embarque, o desembaraço, o transporte e a entrega, e cuidar de fretes, containers, estoque e produção. A conta de gravação é o **operador da Wellmix com as funções comprador e planner** (`operador@wellmix.com`, tela em pt) e, onde o episódio disser, o **administrador** (`admin@wellmix.com`).

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os episódios seguem o modelo da seção 5 do guia, com o episódio CLI-02 ([02-cliente.md](02-cliente.md)) como padrão de detalhe.

## Quem é este papel e o que ele vê

- **A Wellmix vê tudo do pedido**: itens com foto, código e preço FOB, as nove etapas, o cartão de cada parte (produção, embarque e desembaraço, certificação, recebimento, artes), os parceiros designados e o "Comprado (snapshot)". Os **parceiros veem só a etapa deles**; o cliente vê o andamento (docs/WORKFLOW.md, "Quem vê o quê no pedido").
- **O menu do operador** é montado pelas funções (docs/ACCESS.md): o básico (Control Tower, Pendências, Painel de SLA, Notificações, Mensagens) mais as telas do comprador e do planner. Em **Pedidos**: Solicitações, Pedidos, Revisão, Fretes, Tarifário de frete, Embalagens, Containers (e RFQ e Sourcing, que estão em espera). Em **Cadastros**: Produtos e **Estoque**. O nome da tela aberta pelo item "Revisão" é "Itens para revisão" (o glossário do guia a chama de fila de revisão).
- **O que o operador não vê**: Financeiro, Contas a pagar, conta corrente do fornecedor, Configurações, Equipe, Auditoria; no pedido, os cartões coloridos de valores (venda, recebido, a receber, compra, pago, a pagar, margem), o "Financeiro do pedido", os pagamentos, o pagamento ao fornecedor e o cartão "Cancelar pedido". Ele **vê** FOB e valor de venda na linha do "Resumo do pedido", porque são o trabalho de compra (docs/ACCESS.md, regra 6). Tentar abrir uma tela fora das funções devolve ao início com o aviso "Você não tem acesso a {tela}. Peça ao administrador em Gestão → Equipe e divisões."
- **O que só o administrador faz** neste roteiro: cancelar o pedido e responder ao pedido de cancelamento do cliente; validar e pagar o numerário (ou quem tem a função financeiro); abrir o inventário às cegas e aprovar a contagem final; mudar tolerâncias, prazos por etapa, "Quem confirma a entrega", "Container com vários clientes" e "Ocupação máxima do container (%)" em Configurações.

## Estado do negócio que a série segue (guia, seção 7.5)

- A RFQ com vários fornecedores está **em espera** (docs/RFQ_STANDBY.md): os episódios partem de um pedido que já nasceu e não ensinam a disputa. O Booking é por planilha (docs/BOOKING.md).
- **Sankhya manual**: sem credencial, o número do pedido é digitado e a coluna mostra "ERP pendente" até lá (docs/SANKHYA.md).
- **E-mail e WhatsApp são mock**: só o sino e as Notificações do portal avisam de verdade. Nenhum episódio promete outro aviso.
- **Pagamento ao fornecedor** corre fora do fluxo do pedido (só o administrador mexe); aparece aqui apenas como selo "paralelo".
- Booking aparece com dois sentidos: a **tela Booking** (produtos antes da solicitação) e o passo "Booking" do cartão "Embarque e desembaraço", que é a **reserva no navio**. Nos vídeos de embarque diga sempre "reserva no navio" e cite o rótulo "Booking" só como o nome do passo na tela.

## Dados do cenário e pontos de salvamento

Os episódios seguem a **Jornada da Jarra** (README, ordem de gravação) com o **Pedido #1: Jarra de vidro 1,5 L (UTL-001), 1.200 un, Shenzhen Supplier A, cliente Loja do João Ltda**. Para mostrar o que a jarra não mostra, a série usa três pedidos de apoio, todos de demonstração:

| Apoio                                    | Para que serve                                                                                                   | Onde entra                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Pedido da **Piscina inflável 2.000 L** (Ningbo Supplier C, linha Infláveis, que exige Inmetro; o produto não tem certificação válida) | O item "Conformidade: certificação obrigatória conferida" e o pedido de cancelamento do cliente | WPE-01, WPE-07 |
| Dois pedidos da **jarra de 6.000 un** (#3 e #4) e uma **compra para estoque** (Jogo de panelas, "Estoque Wellmix") | Containers, produção, follow, inspeção bloqueada e estoque | WLO-02, WLO-03, WLO-04, WPE-07 |
| Uma **planilha de tarifário de frete** de demonstração (abas COMPARATIVO - NVT e ITJ, FORNECEDORES e PORTOS) | Importar o tarifário; os valores são inventados para a gravação e vêm do modelo da planilha, nunca de uma companhia real | WLO-01, WPE-05 |

Guarde um ponto de salvamento (guia, seção 7.2) com o nome `antes-<ID>` antes de cada episódio. O que cada ponto precisa:

| Ponto               | Estado do pedido #1 ao começar                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `antes-WPE-01`      | Sinal confirmado: pedido recém-nascido, etapa "Pedido pré-aprovado" aberta; pedido da piscina na mesma etapa |
| `antes-WPE-02`      | Pedido conferido; "Preparação" em andamento, ficha vinda da cotação, sem a programação de compra              |
| `antes-WPE-03`      | Preparação concluída; "Arte e embalagem" aberta; selo enviado pela certificadora; fornecedor e agência prontos |
| `antes-WPE-04`      | Documento assinado, arte aprovada; "Inspeção" aberta; o fornecedor vai enviar peso e medidas fora da tolerância |
| `antes-WLO-01`      | Inspeção concluída; "Embarque" aberta; Fretes com o pedido de frete da jarra; nenhuma planilha de tarifário    |
| `antes-WPE-05`      | Tarifário importado; passos de "Embarque e desembaraço" sem nenhum enviado; companhia, agente, comex e despachante designados |
| `antes-WPE-06`      | Desembaraço concluído; "Transporte" aberta, ainda sem placa                                                  |
| `antes-WLO-02`      | Dois pedidos de 6.000 un da jarra do mesmo cliente e uma compra para estoque, sem container                  |
| `antes-WLO-03`      | Um container de estoque "Chegou"; nenhum limite, reserva ou inventário                                       |
| `antes-WLO-04`      | Pedido assinado há dias (início da produção automático) e nenhum follow registrado                           |
| `antes-WPE-07`      | Um pedido atrasado, um bloqueado e o da piscina ainda em "Pedido pré-aprovado" (ver notas do episódio)         |

## Episódios

| ID      | Episódio                                          | Duração-alvo | Situação      |
| ------- | ------------------------------------------------- | ------------ | ------------- |
| WPE-01  | Conferir o pedido e o Sankhya                     | 3:45         | roteirizado   |
| WPE-02  | Preparação: a ficha de compra e a validação       | 3:45         | roteirizado   |
| WPE-03  | Arte e embalagem vistas pela Wellmix              | 5:45         | roteirizado   |
| WPE-04  | Inspeção cega e fila de revisão                   | 4:30         | roteirizado   |
| WPE-05  | Embarque e desembaraço pela Wellmix               | 5:00         | roteirizado   |
| WPE-06  | Transporte, entrega e encerramento                | 4:15         | roteirizado   |
| WPE-07  | Pedidos parados, atrasos e cancelamento           | 4:45         | roteirizado   |
| WLO-01  | Fretes e tarifário de frete                       | 4:15         | roteirizado   |
| WLO-02  | Containers: CBM, mix e ocupação                   | 4:15         | roteirizado   |
| WLO-03  | Estoque                                           | 4:45         | roteirizado   |
| WLO-04  | Produção: follow e ETD                            | 4:15         | roteirizado   |

---

## WPE-01 · Conferir o pedido e o Sankhya

> **Promessa:** ao final do vídeo você abre o pedido que acabou de nascer, entende a tela em linhas, informa o número do Sankhya e libera o pedido ao fornecedor.

| Ficha                 |                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner)                                                                                                    |
| Conta de gravação     | `operador@wellmix.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa)                                                              |
| Duração-alvo          | 3:45                                                                                                                                               |
| Ponto da jornada      | Etapa 4 de 9: Sinal e pedido                                                                                                                       |
| Telas e rotas         | `/app` (Control Tower), `/app/orders` (Pedidos), `/app/orders/[id]` (a tela do pedido), `/app/reviews` (Itens para revisão)                          |
| Dados antes de gravar | Ponto `antes-WPE-01`: Pedido #1 da jarra recém-criado (sinal confirmado em WSO-03) e o pedido da Piscina inflável 2.000 L na mesma etapa; nenhum número no Sankhya |
| Depois deste vídeo    | A etapa "Pedido pré-aprovado" conclui e a "Preparação" abre (WPE-02); a certificadora do pedido já tem o selo a gerar (OCP-01)                         |
| Antes · Próximo       | WSO-03 · WPE-02                                                                                                                                    |
| Idiomas               | pt (base)                                                                                                                                          |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a Control Tower, bloco "Onde o pedido está agora". O quadrado azul **Conferência e Sankhya** mostra 1. O cursor repousa sobre ele.
- 🎙 Narração: "Acabou de nascer um pedido. Antes de o fornecedor começar, a Wellmix confere tudo aqui, e isso leva poucos minutos."
- 🔤 Na tela: `[TÍTULO]` "WPE-01 · Conferir o pedido e o Sankhya"; `[ZOOM 150 %]` no quadrado "Conferência e Sankhya".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "O sinal foi confirmado e o pedido nasceu como Pedido pré-aprovado. Esta é a etapa 4: conferir o pedido e levá-lo ao ERP, o Sankhya."
- 🔤 Na tela: `[MAPA etapa 4]` com "Sinal e pedido" acesa; `[SETA]` "Sankhya: o ERP da Wellmix" no quadrado.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:40 · Abrir o pedido · menu Pedidos → Pedidos → `/app/orders/[id]`**

- 🎬 Imagem: o cursor abre o menu **Pedidos** e clica em **Pedidos**. A lista mostra a linha **#1** (Jarra de vidro 1,5 L, Loja do João Ltda, Shenzhen Supplier A), a situação "Em andamento" e, na coluna Progresso, a barra com "Conferência e Sankhya". Clique no número **#1**.
- 🎙 Narração: "No menu, abra Pedidos e clique no número do pedido. A coluna Progresso diz em que ponto da viagem ele está: aqui, Conferência e Sankhya."
- 🔤 Na tela: `[PASSO 1/6] Abra Pedidos e clique no número do pedido`; `[SETA]` "Progresso: o passo da viagem" na barra; `[DICA]` "Na Control Tower, tocar no quadrado mostra os pedidos dele logo abaixo."
- ✂️ Edição: `[CORTE]` seco para a tela do pedido quando ela termina de carregar.

**Cena 4 · 0:40–1:08 · A tela em linhas · `/app/orders/[id]`**

- 🎬 Imagem: a tela do pedido, uma coluna só. O cursor desce pelo cabeçalho "Pedido #1 · Jarra de vidro 1,5 L · 1200 un" com o selo "Pedido pré-aprovado" e para no **Resumo do pedido**: Cliente, Fornecedor, FOB, Valor de venda, Sankhya ("ERP pendente"), Faturamento, Data, Modalidade de operação, Classificação fiscal (NCM). Em seguida, a tabela **Itens do pedido**.
- 🎙 Narração: "A tela é uma coluna só, em tabelas. No Resumo do pedido estão cliente, fornecedor, valor de compra e de venda, o Sankhya, a data e a classificação fiscal. Abaixo, os itens do pedido."
- 🔤 Na tela: `[PASSO 2/6] Leia o Resumo do pedido`; `[ZOOM 150 %]` no Resumo; `[SETA]` "ERP pendente: ainda sem número no Sankhya" na coluna Sankhya; `[QUEM VÊ]` "Os cartões coloridos de venda, recebido e margem são só do administrador"; `[CORTE]` rápido para o admin mostrando os cartões (2 s).
- ✂️ Edição: manter o Resumo 3 s em tela. O operador vê FOB e Valor de venda nesta linha; os cartões coloridos acima dela só aparecem na gravação do administrador.

**Cena 5 · 1:08–1:35 · Etapas do pedido · `/app/orders/[id]`**

- 🎬 Imagem: a tabela **Etapas do pedido**: nove linhas, cada uma com Situação, Responsável, Prazo, Concluída em, Andamento e Itens da etapa. A primeira ("Pedido pré-aprovado", "Em andamento", Operador Wellmix) está em destaque. O cursor passa pela linha recuada "↳ Certificação" com o selo "ao mesmo tempo" e por **Ver detalhes**, e para em **Abrir todas as etapas**.
- 🎙 Narração: "Etapas do pedido: uma linha por etapa, com responsável e prazo. As linhas recuadas são partes que andam em paralelo, como a Certificação. Ver detalhes abre uma etapa; Abrir todas as etapas mostra tudo."
- 🔤 Na tela: `[PASSO 3/6] Veja a etapa em andamento`; `[SETA]` "Etapa em andamento: aberta embaixo da tabela" na linha 1; `[SETA]` "ao mesmo tempo: não espera a etapa anterior" no selo; `[BOTÃO] "Abrir todas as etapas"`.
- ✂️ Edição: sem aceleração; pausa de 1 s ao clicar em "Abrir todas as etapas" e volta a "Mostrar só a etapa em andamento".

**Cena 6 · 1:35–2:00 · O que foi comprado · `/app/orders/[id]`**

- 🎬 Imagem: o cursor rola até o fim da página e para no cartão **Comprado (snapshot)**: Nome, Preço unitário (US$ 2,35 / un), Quantidade, MOQ, Material, Cor, Caixa master, Condições, "Registrado em".
- 🎙 Narração: "No fim da página está o Comprado: uma cópia congelada da ficha e da cotação no dia em que o pedido nasceu. O cadastro pode mudar depois; esta cópia não. É com ela que a inspeção vai comparar."
- 🔤 Na tela: `[SETA]` "Cópia congelada da compra" no título; `[QUEM VÊ]` "Só a Wellmix vê o snapshot"; `[ZOOM 150 %]` em "Preço unitário" e "Quantidade".
- ✂️ Edição: manter 3 s parado na tabela.

**Cena 7 · 2:00–2:32 · Número no Sankhya · `/app/orders/[id]`**

- 🎬 Imagem: o cursor sobe até o cartão aberto **Pedido pré-aprovado**. No item **Número no Sankhya (opcional)**, digitar `40871` e clicar em **Enviar**. A coluna Sankhya do Resumo troca o selo "ERP pendente" pelo número, e o aviso "Sincronização com o ERP pendente (modo mock). Informe o número manualmente." some.
- 🎙 Narração: "O Sankhya continua sendo o ERP. Sem a integração ligada, o número é digitado aqui. Gere o pedido no Sankhya, digite o número e clique em Enviar. A coluna Sankhya troca ERP pendente pelo número."
- 🔤 Na tela: `[PASSO 4/6] Informe o número no Sankhya`; `[BOTÃO] "Enviar"`; `[SETA]` "O número aparece no Resumo" na coluna Sankhya; `[ATENÇÃO]` "Digite o número antes de confirmar o pedido: ao concluir a etapa, o campo some."
- ✂️ Edição: digitação em tempo real. `[ZOOM 150 %]` no Resumo antes e depois, em corte lado a lado de 3 s.

**Cena 8 · 2:32–3:08 · Conformidade (pedido da piscina) · `/app/orders/[id]` e `/app/reviews`**

- 🎬 Imagem: abre o **Pedido #2** (Piscina inflável 2.000 L). No cartão da etapa, um terceiro item: **Conformidade: certificação obrigatória conferida**, com o aviso laranja "Faltam: Inmetro" e o botão **Confirmar**. Corte para **Pedidos → Revisão** ("Itens para revisão"): um cartão do Pedido #2, "Produto sem certificação válida exigida pela linha: Inmetro", com Esperado "Inmetro", Encontrado "nenhuma" e os botões **Resolver** e **Dispensar**.
- 🎙 Narração: "Algumas linhas exigem certificação, como o Inmetro nos infláveis. Se o produto não tem certificado válido, o pedido ganha o item Conformidade e um aviso na fila de revisão. Registrar a certificação no produto fecha os dois."
- 🔤 Na tela: `[PASSO 5/6] Confira a conformidade, quando houver`; `[SETA]` "Faltam: Inmetro" no item; `[SETA]` "Aviso da regra, com esperado e encontrado" no cartão da fila; `[ATENÇÃO]` "Confirmar à mão conclui o item mesmo sem a certificação, e o aviso na fila continua aberto."
- ✂️ Edição: `[CORTE]` entre as duas telas; manter 2 s no cartão da fila. Não clicar em Confirmar nem em Resolver nesta cena.

**Cena 9 · 3:08–3:30 · Confirmar e liberar · `/app/orders/[id]`**

- 🎬 Imagem: de volta ao Pedido #1, no cartão **Pedido pré-aprovado**: o item **Pedido conferido e liberado ao fornecedor** ("Pendente", Operador Wellmix). Clicar em **Confirmar**. A linha da etapa vira "Concluída" e a **Preparação** passa a "Em andamento".
- 🎙 Narração: "Conferiu tudo? Clique em Confirmar no item Pedido conferido e liberado ao fornecedor. A etapa conclui e a Preparação abre."
- 🔤 Na tela: `[PASSO 6/6] Confirme o pedido conferido`; `[BOTÃO] "Confirmar"`; `[SETA]` "Preparação: em andamento" na tabela de etapas.
- ✂️ Edição: manter o clique com onda; pausa de 1 s; `[CORTE]` para a tabela já atualizada.

**Cena 10 · 3:30–3:45 · Depois e resumo**

- 🎬 Imagem: cartão `[DEPOIS]` e, em seguida, fundo vermelho com a lista.
- 🎙 Narração: "Resumindo: abra o pedido, leia o Resumo, informe o Sankhya, veja a conformidade e confirme. Em seguida, a ficha de compra."
- 🔤 Na tela: `[DEPOIS]` "A Preparação abre. A Wellmix valida a ficha e as fotos (WPE-02). A certificadora já tem o selo para gerar."; `[RESUMO]` "1 Abra o pedido pelo número · 2 Leia o Resumo · 3 Informe o Sankhya · 4 Veja a conformidade · 5 Confirme"; chamada "Próximo: WPE-02 · Preparação".
- ✂️ Edição: `[DEPOIS]` 4 s em tela cheia; fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Aviso:** a coluna Sankhya mostra "ERP pendente" e, abaixo do Resumo, "Sincronização com o ERP pendente (modo mock). Informe o número manualmente." → **Correção:** não é falha: sem credencial a integração é manual. Digite o número no item "Número no Sankhya".
- **Erro:** abrir uma tela fora das suas funções, como Contas a pagar. O portal volta ao início com "Você não tem acesso a Contas a pagar. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** a tela é do administrador, ou ele precisa marcar a função em Equipe e divisões.
- **Erro:** pedido antigo, de antes do snapshot, mostra "Este pedido não tem snapshot da negociação (foi criado antes do recurso)." → **Correção:** use o botão "Gerar snapshot" (o portal avisa que o registro será retroativo e pode não refletir a negociação original).
- **Atenção:** o item "Conformidade: certificação obrigatória conferida" aceita "Confirmar" mesmo com "Faltam: Inmetro". → **Correção:** registre ou valide a certificação no produto; confirmar à mão deixa o aviso aberto em Itens para revisão.

### Passo a passo em texto

1. No menu **Pedidos**, clique em **Pedidos** e abra o pedido pelo número. A coluna **Progresso** mostra o passo da viagem.
2. Leia o **Resumo do pedido**: cliente, fornecedor, FOB, valor de venda, Sankhya, faturamento, data, modalidade de operação e classificação fiscal (NCM). Os cartões coloridos de valores são do administrador.
3. Em **Etapas do pedido**, confira a etapa em andamento ("Pedido pré-aprovado"). As linhas recuadas são partes em paralelo; **Ver detalhes** abre uma etapa e **Abrir todas as etapas** mostra todas.
4. Confira o cartão **Comprado (snapshot)**, a cópia congelada da compra. Só a Wellmix a vê.
5. No item **Número no Sankhya (opcional)**, digite o número gerado no ERP e clique em **Enviar**. A coluna Sankhya do Resumo passa a mostrar o número.
6. Se o item **Conformidade: certificação obrigatória conferida** aparecer, registre a certificação no produto. O aviso correspondente fica em **Pedidos → Revisão**.
7. No item **Pedido conferido e liberado ao fornecedor**, clique em **Confirmar**. A etapa conclui e a Preparação abre.
8. Quando quiser registrar o faturamento, use **Registrar faturamento** na linha Faturamento do Resumo (o portal pede confirmação e roda a regra "Pedido faturado", de Configurações → Processos).

### Notas de gravação

- Grave o Resumo na conta do operador e use um corte curto na conta do administrador só para mostrar os cartões coloridos (cena 4). Entre os dois, esconda a faixa de demonstração e o seletor DEMO (guia, seção 7.3).
- O pedido da piscina vem do mesmo caminho da jarra (solicitação ao fornecedor, cotação, aprovação, sinal). Ela é o único produto da carga cuja linha exige Inmetro sem certificação válida.
- Na cena 7 o número `40871` é de demonstração. Não use número de pedido real do Sankhya.
- Se o dia da gravação cair entre 21h e meia-noite em Brasília, a "Data" do Resumo (UTC) e as datas do documento do pedido (Brasília) saem em dias diferentes. Grave de manhã.
- Não cite datas nem prazos na narração; mostre-os.

### Pontos a confirmar

- ⚠ **O número do Sankhya some depois de confirmar o pedido.** O campo é o item opcional `erp_number` da etapa "Pedido pré-aprovado"; ao concluir a etapa ele deixa de aparecer. Mesmo assim, o aviso da segunda assinatura diz "Pedido autorizado: gere-o no Sankhya e informe o número no pedido" (docs/ORDER_SIGNATURE.md, seção 2, item 5). Confirmar com o dono onde o número deve ser informado depois; se mudar, regravar a cena 7.
- ⚠ Se registrar a certificação no produto realmente fecha o item de conformidade e o aviso da fila sozinho (docs/WORKFLOW.md, "Conformidade"). Não foi executado na verificação; a narração da cena 8 segue o documento.
- ⚠ A rota "Conformidade" mostra na fila de revisão o código da regra ("compliance.missingCertification") no lugar de um nome em português. Se for traduzido, atualizar a cena 8.
- ⚠ Quem recebe aviso quando a Preparação abre (a ficha vem completa da cotação, então o fornecedor pode não ter nada a fazer). A cena 9 diz só que a Preparação abre.

---

## WPE-02 · Preparação: a ficha de compra e a validação

> **Promessa:** ao final do vídeo você abre a ficha de compra do fornecedor, faz a programação de compra, valida a ficha e o cadastro do produto e deixa a Preparação pronta para a arte.

| Ficha                 |                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix · operador (funções comprador e planner); o administrador também recebe a pendência da programação                                              |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; um corte curto com `admin@wellmix.com` na cena 1                                                                     |
| Duração-alvo          | 3:45                                                                                                                                                   |
| Ponto da jornada      | Etapa 5 de 9: Preparação                                                                                                                               |
| Telas e rotas         | `/app/tasks` (Pendências), `/app/orders/[id]` (cartão Preparação), `/app/orders/[id]/purchase-sheet` (Ficha de compra)                                    |
| Dados antes de gravar | Ponto `antes-WPE-02`: Pedido #1 conferido (WPE-01), Preparação em andamento. A ficha veio completa da cotação (FOR-03), com as 5 fotos, e ainda sem o "1º lote da programação" |
| Depois deste vídeo    | A Preparação conclui e a "Arte e embalagem" abre (WPE-03). O início da produção só entra depois das duas assinaturas do documento do pedido                |
| Antes · Próximo       | WPE-01 · WPE-03                                                                                                                                        |
| Idiomas               | pt (base)                                                                                                                                              |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/tasks`**

- 🎬 Imagem: a tela **Minhas pendências**. A linha "Pedido #1: Preparação" mostra o detalhe "Ficha e imagens validadas pelo comprador, Cadastro do produto validado (cadastro)", o tipo "Preparação" e o prazo.
- 🎙 Narração: "O fornecedor já mandou a ficha de compra. Agora é a sua vez: conferir a ficha e as fotos e validar o cadastro do produto."
- 🔤 Na tela: `[TÍTULO]` "WPE-02 · Preparação: a ficha de compra e a validação"; `[ZOOM 150 %]` na linha da pendência.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/tasks`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapa 5, Preparação. A ficha de compra é o retrato do produto: preço, caixa, pesos, medidas e fotos. A inspeção vai comparar com ela."
- 🔤 Na tela: `[MAPA etapa 5]` com "Preparação" acesa; `[SETA]` "A ficha é a referência da inspeção".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · Abrir a ficha · `/app/tasks` → `/app/orders/[id]`**

- 🎬 Imagem: clicar em **Abrir** na pendência. No pedido, o cartão **Preparação** mostra o item **Ficha de compra** ("Concluído", "FOB USD 2.35") com o botão **Ver ficha de compra**, e embaixo os dois itens da Wellmix. Clicar em **Ver ficha de compra**.
- 🎙 Narração: "Abra a pendência. No cartão Preparação, a ficha do fornecedor já aparece concluída, porque veio completa da cotação. Clique em Ver ficha de compra para conferir."
- 🔤 Na tela: `[PASSO 1/6] Abra o pedido e a ficha de compra`; `[BOTÃO] "Ver ficha de compra"`; `[SETA]` "Itens da Wellmix: validar a ficha e o cadastro" nos dois itens pendentes.
- ✂️ Edição: `[CORTE]` seco para a tela da ficha.

**Cena 4 · 0:45–1:12 · A ficha, bloco a bloco · `/app/orders/[id]/purchase-sheet`**

- 🎬 Imagem: a tela **Ficha de compra**. O aviso azul diz "Falta para concluir: 1º lote da programação." A tabela de blocos mostra Fornecedor, Produto, Caixa e embalagem, Preço e condições, Fotos como "Completo"; **Programação de compra** em vermelho ("Faltam: 1º lote da programação"); Despachante (NCM e impostos) e Descrição para e-commerce como "Opcional". O cursor passa por cada linha.
- 🎙 Narração: "A ficha é dividida em blocos. Completo está certo. Em vermelho está o que falta: aqui, só a Programação de compra. Despachante e e-commerce são opcionais."
- 🔤 Na tela: `[PASSO 2/6] Veja o que falta na ficha`; `[SETA]` "Em vermelho: o que falta" na linha da Programação; `[QUEM VÊ]` "O fornecedor não vê a Programação de compra, o Despachante nem a Descrição para e-commerce: são da Wellmix".
- ✂️ Edição: manter a tabela 3 s em tela. Não abrir o recurso "Ficha pela foto do quadro" (depende de IA; fora do episódio).

**Cena 5 · 1:12–1:52 · Programação de compra · `/app/orders/[id]/purchase-sheet`**

- 🎬 Imagem: clicar na linha **Programação de compra**. O bloco mostra "Início da produção" (campo cinza, só leitura), "Container para o cálculo" (40HC · 68 m³) e a tabela **Prog. · Saída em (dias) · Caixas master · Peças · CBM · Saída prevista**. Na linha 1, digitar `30` em "Saída em (dias)" e `50` em "Caixas master". Aparecem Peças 1.200, CBM 3 m³ e, no resumo, "Peças no total 1.200 · CBM total 3 m³ · Containers (40HC, 68 m³) 0,04". O quadro amarelo **Fechar o container** sugere "Aumentar para 1: +1.083 caixas". Passar o cursor sobre o botão sem clicar.
- 🎙 Narração: "A programação é da Wellmix. Em quantos dias sai o primeiro lote, e quantas caixas master? O portal calcula peças, CBM e containers enquanto você digita. A sugestão de fechar o container é opcional; aqui, não vamos aplicar."
- 🔤 Na tela: `[PASSO 3/6] Faça a programação de compra`; `[SETA]` "Início da produção: automático, depois da assinatura" no campo cinza; `[SETA]` "A conta acompanha o que você digita" nos totais; `[DICA]` "O botão 'Gerar programação' divide as caixas igualmente em várias saídas."
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` nos totais; pausa de 1 s no quadro "Fechar o container".

**Cena 6 · 1:52–2:12 · Salvar a ficha · `/app/orders/[id]/purchase-sheet`**

- 🎬 Imagem: rolar até o fim e clicar em **Salvar ficha**. A tela mostra o selo "Ficha completa" no alto e o aviso "Ficha salva e completa." A tabela de blocos fica toda "Completo".
- 🎙 Narração: "Rolar até o fim e clicar em Salvar ficha. Com os blocos completos, a tela mostra Ficha salva e completa."
- 🔤 Na tela: `[PASSO 4/6] Salve a ficha`; `[BOTÃO] "Salvar ficha"`; `[SETA]` "Ficha completa" no selo.
- ✂️ Edição: `[CORTE]` na recarga da página; clique com onda e pausa de 1 s.

**Cena 7 · 2:12–2:48 · Validar a ficha e as imagens · `/app/orders/[id]`**

- 🎬 Imagem: clicar em **Voltar ao pedido**. Antes de validar, passar pelas 5 fotos do produto na ficha (balança, régua, lateral, ângulos e original). No cartão Preparação, no item **Ficha e imagens validadas pelo comprador**, clicar em **Confirmar**. Replay curto do erro: se a programação não estivesse salva, aparece "Antes de validar a ficha, faça a Programação de compra (1º lote) na ficha de compra do pedido."
- 🎙 Narração: "De volta ao pedido, confira as fotos e clique em Confirmar em Ficha e imagens validadas pelo comprador. Sem a programação, o sistema recusa e avisa o que falta."
- 🔤 Na tela: `[PASSO 5/6] Valide a ficha e as imagens`; `[BOTÃO] "Confirmar"`; `[ERRO COMUM]` "Antes de validar a ficha, faça a Programação de compra (1º lote) na ficha de compra do pedido." → "Volte à ficha, preencha a programação e salve."
- ✂️ Edição: o replay do erro dura 4 s, em corte com selo vermelho; depois, a tela já com a programação salva e o clique certo.

**Cena 8 · 2:48–3:15 · Validar o cadastro do produto · `/app/orders/[id]`**

- 🎬 Imagem: no item **Cadastro do produto validado (cadastro)**, clicar em **Confirmar**. Corte para a ficha: ao lado do botão "Salvar ficha", o quadro "Atualizar cadastro do produto com esta ficha". Mostrar sem clicar (ou clicar e mostrar "Cadastro do produto atualizado com esta ficha.").
- 🎙 Narração: "Agora o Cadastro do produto validado: confirme que o produto está certo no catálogo. Dica: Atualizar cadastro do produto com esta ficha leva o que o fornecedor informou para a ficha mestre, sem apagar nada."
- 🔤 Na tela: `[PASSO 6/6] Valide o cadastro do produto`; `[BOTÃO] "Confirmar"`; `[DICA]` "Atualizar cadastro do produto com esta ficha: campo em branco não apaga o que o cadastro já tem."
- ✂️ Edição: manter o texto do quadro 3 s; sem aceleração.

**Cena 9 · 3:15–3:35 · Resultado · `/app/orders/[id]`**

- 🎬 Imagem: a tabela de etapas: **Preparação** vira "Concluída" (100 %, 3 de 3) e **Arte e embalagem** passa a "Em andamento" com prazo e responsável "Agência".
- 🎙 Narração: "Pronto. A Preparação concluiu e a Arte e embalagem abriu, com a agência como responsável."
- 🔤 Na tela: `[SETA]` "Preparação: Concluída" e `[SETA]` "Arte e embalagem: Em andamento"; `[DEPOIS]` "A Arte e embalagem abre (WPE-03). O início da produção entra sozinho depois das duas assinaturas."
- ✂️ Edição: `[CORTE]` para a tabela atualizada; `[DEPOIS]` por 4 s.

**Cena 10 · 3:35–3:45 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WPE-03.
- 🎙 Narração: "Resumindo: confira a ficha, faça a programação, valide ficha e cadastro. No próximo vídeo, a arte e a assinatura."
- 🔤 Na tela: `[RESUMO]` "1 Abra a ficha de compra · 2 Faça a programação · 3 Salve · 4 Valide ficha e imagens · 5 Valide o cadastro"; chamada "Próximo: WPE-03 · Arte e embalagem".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** validar a ficha sem a programação. A tela mostra "Antes de validar a ficha, faça a Programação de compra (1º lote) na ficha de compra do pedido." → **Correção:** abra a ficha, preencha "Saída em (dias)" e "Caixas master" na linha 1 e clique em "Salvar ficha".
- **Erro:** campo da ficha com valor que o portal não lê. A tela mostra "Alguns campos não puderam ser lidos e ficaram sem salvar; o resto foi salvo. Veja abaixo." ou "Algum campo tem valor inválido. Confira números (sem letras), datas e NCM (só números e pontos)." → **Correção:** o portal aponta o campo com link; corrija e salve de novo. A ficha aceita "1.000" e "0,4 kg" sem erro.
- **Erro:** tentar editar uma ficha sem permissão. A tela mostra "Você não pode editar esta ficha." → **Correção:** a ficha é editada pela Wellmix e pelo fornecedor do pedido; os demais papéis só leem.
- **Aviso:** a ficha mostra "Falta para concluir: 1º lote da programação." → **Correção:** não é erro: a programação é da Wellmix e é a única coisa que falta quando a cotação trouxe tudo.

### Passo a passo em texto

1. Em **Minhas pendências**, abra "Pedido #N: Preparação" (ou abra o pedido pelo menu Pedidos).
2. No cartão **Preparação**, clique em **Ver ficha de compra** (ou **Completar ficha** quando faltar algo do fornecedor).
3. Confira a tabela de blocos: Fornecedor, Produto, Caixa e embalagem, Preço e condições, Programação de compra, Fotos. Em vermelho está o que falta.
4. Em **Programação de compra**, informe **Saída em (dias)** e **Caixas master** na linha 1. Use **+ Programação** para mais saídas ou **Gerar programação** para dividir as caixas. O **Início da produção** entra sozinho depois da assinatura do contrato.
5. Clique em **Salvar ficha**. Com todos os blocos completos, a tela mostra "Ficha salva e completa."
6. Volte ao pedido. Confira as cinco fotos e clique em **Confirmar** no item **Ficha e imagens validadas pelo comprador**.
7. Clique em **Confirmar** no item **Cadastro do produto validado (cadastro)**. Se quiser, use **Atualizar cadastro do produto com esta ficha** para levar a ficha para o cadastro.
8. Com os três itens feitos, a Preparação conclui e a Arte e embalagem abre.

### Notas de gravação

- O ponto `antes-WPE-02` precisa ter a ficha **completa** (campos e as 5 fotos) vinda da cotação. A programação fica em branco de propósito.
- A pendência "Fazer a programação de compra: pedido #N" ("Informe os lotes (caixas e dias de saída) na ficha de compra do pedido") aparece **só para o administrador**. No corte da cena 1, mostre-a na conta do admin para explicar de onde vem a tarefa; o operador vê apenas "Pedido #N: Preparação".
- Não clique em "Aumentar para 1" na cena 5: o botão muda as caixas e a quantidade do pedido. Se quiser mostrá-lo, grave numa cópia do ponto de salvamento.
- A data do campo "Início da produção" aparece em branco até a assinatura; depois mostra o dia da assinatura somado ao prazo do fornecedor. Não a cite.
- Os números de peças, CBM e containers da cena 5 dependem da caixa master da ficha (24 peças, 0,06 m³ na carga de demonstração). Se a carga mudar, mostre os números sem citá-los na narração.

### Pontos a confirmar

- ⚠ O texto de ajuda da etapa Preparação, exibido na tela, ainda diz "Fornecedor preenche a ficha de compra (… programação e fotos …)". Desde 10/11/2026 a programação é da Wellmix (docs/EVOLUTION_PLAN.md). A narração segue a regra nova; confirmar se o texto da tela será atualizado.
- ⚠ O item "Ficha de compra" aparece com "Enviado por: Otávio Operador" mesmo quando quem preencheu foi o fornecedor, na cotação (o envio é registrado quando a etapa abre). A cena 3 não cita quem enviou.
- ⚠ Quem pode validar "Cadastro do produto validado (cadastro)": o item é do papel operador (qualquer login da Wellmix com a tela Pedidos), embora docs/ACCESS.md diga que é a função cadastro. Conferir se a narração deve falar em "a Wellmix" ou em "o cadastro".
- ⚠ O número exato de fotos conferidas ("as 5 fotos") vem de docs/EVOLUTION_PLAN.md; confirmar na ficha da gravação se a lista aparece com as cinco.

---

## WPE-03 · Arte e embalagem vistas pela Wellmix

> **Promessa:** ao final do vídeo você acompanha a faca e a arte desde o briefing, valida o selo, entende a aprovação e a reprovação do fornecedor, troca a agência e assina o documento do pedido pela Wellmix.

| Ficha                 |                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner; a tela Embalagens também é do designer e do gerente de produto)                                            |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; cortes curtos com `agencia@design.com`, `supplier.a@china.com` e `admin@wellmix.com` quando a cena disser                |
| Duração-alvo          | 5:45 (dois capítulos: arte e selo até 3:15; documento e assinaturas depois; dá para cortar em dois vídeos sem mudar o texto)                                  |
| Ponto da jornada      | Etapa 5 de 9: Preparação (arte e embalagem, assinatura do pedido)                                                                                          |
| Telas e rotas         | `/app/packaging` (Embalagens), `/app/packaging/[id]` (briefing), `/app/orders/[id]` (cartões Arte e embalagem, Certificação e Parceiros do pedido), `/app/orders/[id]/purchase-order` (Documento do pedido) |
| Dados antes de gravar | Ponto `antes-WPE-03`: Preparação concluída (WPE-02); selo já enviado pela certificadora (OCP-01); briefing da jarra "No pedido"; fornecedor A e a agência com login; a faca ainda "com o fornecedor" |
| Depois deste vídeo    | Arte aprovada e documento assinado pelos dois: a "Arte e embalagem" conclui, o início da produção entra sozinho e a "Inspeção" abre (WPE-04). A Wellmix recebe o aviso de gerar o pedido no Sankhya |
| Antes · Próximo       | WPE-02 (e AGE-04, FOR-06, FOR-07 na ordem de gravação) · WPE-04                                                                                            |
| Idiomas               | pt (base)                                                                                                                                                  |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/packaging`**

- 🎬 Imagem: a tela **Embalagens (faca e arte)**. A linha da Jarra de vidro 1,5 L mostra o selo azul "No pedido". O cursor repousa nela.
- 🎙 Narração: "A embalagem não espera o pedido: a agência começa a faca e a arte junto com a cotação. Veja como a Wellmix acompanha tudo até a assinatura."
- 🔤 Na tela: `[TÍTULO]` "WPE-03 · Arte e embalagem vistas pela Wellmix"; `[ZOOM 150 %]` na linha da jarra.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/packaging`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Ainda na etapa 5. Depois da ficha, o pedido precisa de uma arte aprovada e de um documento assinado pelas duas partes."
- 🔤 Na tela: `[MAPA etapa 5]` com "Preparação" acesa; `[SETA]` "Arte, selo e assinatura".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:48 · A lista de embalagens · menu Pedidos → Embalagens → `/app/packaging`**

- 🎬 Imagem: o cursor abre **Pedidos** e clica em **Embalagens**. A tabela mostra Produto, Solicitação, Responsável (Agência Criativa), Entregáveis, Prazo e Situação. Três linhas: "Em preparação" com o selo "Venda ainda não confirmada" (a piscina, ainda em cotação), "No pedido" (a piscina cancelada ou outra) e "No pedido" (a jarra).
- 🎙 Narração: "Em Pedidos, Embalagens: um briefing por solicitação. Ele abre quando a solicitação vai ao fornecedor. O responsável é a agência ou, sem agência, o marketing da Wellmix. A situação diz se a venda já foi confirmada."
- 🔤 Na tela: `[PASSO 1/9] Abra Pedidos → Embalagens`; `[SETA]` "Venda ainda não confirmada: a cotação corre junto" no selo amarelo; `[SETA]` "No pedido: a arte já está no pedido" no selo azul.
- ✂️ Edição: `[CORTE]` seco para a tela de Embalagens; manter a tabela 3 s.

**Cena 4 · 0:48–1:22 · O briefing · `/app/packaging/[id]`**

- 🎬 Imagem: clicar na Jarra de vidro 1,5 L. A tela **Embalagem: Jarra de vidro 1,5 L**: avisos no alto ("Agora no pedido #1: a arte segue para a aprovação do fornecedor", "Selo de certificação: aguardando a certificadora. Deixe o espaço do selo na arte."), cartão **O que é** (produto, quantidade, cliente, fornecedor escolhido, quem faz), **Medidas da caixa** e, à direita, **Entregáveis**: Faca (die-cut), Arte da embalagem (obrigatórios), Arquivos para a gráfica e Foto da embalagem física (opcionais). Embaixo, **Instruções da Wellmix**, o quadro **Prompt para criar a arte (ChatGPT)** e **Valor por item (agência)**.
- 🎙 Narração: "No briefing estão o produto, as medidas da caixa e os entregáveis. A faca vem do fornecedor escolhido; a arte, da agência. Há também instruções da Wellmix e um prompt para criar a arte fora do portal."
- 🔤 Na tela: `[PASSO 2/9] Abra o briefing`; `[SETA]` "Faca: só o fornecedor escolhido envia" em "com o fornecedor (Shenzhen Supplier A)"; `[SETA]` "O prompt é um texto para copiar: o portal não chama IA" no quadro do prompt; `[QUEM VÊ]` "O valor por item da agência fica só entre a agência e a Wellmix; fornecedor e cliente não veem o briefing".
- ✂️ Edição: `[ZOOM 150 %]` em "Entregáveis"; rolar devagar; não clicar em "Gerar prompt" (opcional).

**Cena 5 · 1:22–1:48 · A etapa no pedido · `/app/orders/[id]`**

- 🎬 Imagem: o botão "Abrir o pedido →" do aviso leva ao pedido. No cartão **Arte e embalagem** (Em andamento, Responsável: Agência), cinco itens: **Arte da embalagem**, **Aprovação da arte pelo fornecedor**, **Documento do pedido enviado para assinatura**, **Documento do pedido assinado pela Wellmix** e **Documento do pedido assinado pelo fornecedor**. O cursor passa por cada um.
- 🎙 Narração: "No pedido, a etapa Arte e embalagem tem cinco itens: a arte, a aprovação do fornecedor, o envio para assinatura e as duas assinaturas. Cada item mostra quem faz."
- 🔤 Na tela: `[PASSO 3/9] Veja os itens da etapa Arte e embalagem`; `[SETA]` "Quem faz cada item" na coluna de papel; `[SETA]` "Aguardando a arte (agência ou Wellmix)" na aprovação.
- ✂️ Edição: sem aceleração; `[ZOOM 150 %]` no cartão.

**Cena 6 · 1:48–2:20 · O selo de certificação · `/app/orders/[id]#certification`**

- 🎬 Imagem: o cursor desce até o cartão **Certificação**. O quadro verde **Memorial (selo)** mostra "Selo · Concluído" e o link "Arquivo". Na tabela, a linha **Selo aplicado na arte** está "Enviado, aguardando validação" (Faz: agência · valida: Wellmix), com o campo "Motivo (obrigatório para recusar)" e os botões **Validar** e **Recusar**. Clicar em **Validar**; a linha vira "Validado".
- 🎙 Narração: "Todo pedido precisa do selo. A certificadora envia o selo, quem faz a arte o aplica, e a Wellmix confere: Validar, ou Recusar com o motivo. Quem enviou a arte não valida a própria."
- 🔤 Na tela: `[PASSO 4/9] Valide o selo aplicado na arte`; `[BOTÃO] "Validar"`; `[BOTÃO] "Recusar"`; `[ERRO COMUM]` "Escreva o motivo para recusar." → "Recusar exige o motivo."
- ✂️ Edição: manter 2 s no estado "Enviado, aguardando validação" antes do clique; `[ZOOM 150 %]` na linha.

**Cena 7 · 2:20–2:50 · Aprovada ou reprovada · `/app/orders/[id]`**

- 🎬 Imagem: corte para a conta do fornecedor A: no item **Aprovação da arte pelo fornecedor**, escrever uma observação e clicar em **Reprovar**. Volta à conta do operador: o item **Arte da embalagem** aparece "Reprovado", com o nome do arquivo e a observação; a aprovação também "Reprovado". A agência refaz e reenvia; a aprovação volta a "Pendente".
- 🎙 Narração: "O fornecedor confere a arte e aprova, ou reprova com uma observação. Reprovada, a arte volta para quem a fez, com aviso. Quando ela é reenviada, a aprovação volta a ficar pendente."
- 🔤 Na tela: `[PASSO 5/9] Acompanhe a aprovação`; `[BOTÃO] "Reprovar"`; `[SETA]` "A observação do fornecedor aparece aqui" na linha da arte; `[QUEM VÊ]` "Só a Wellmix refaz uma aprovação já decidida".
- ✂️ Edição: dois cortes rápidos de conta; legenda "Fornecedor" e "Wellmix" no canto; 2 s no estado "Reprovado".

**Cena 8 · 2:50–3:15 · Trocar a agência · `/app/orders/[id]`**

- 🎬 Imagem: descer até **Parceiros do pedido**. Na linha **Agência**, abrir a lista ("—" e "Agência Criativa") e clicar em **Designar**.
- 🎙 Narração: "Precisa trocar quem faz a arte? Em Parceiros do pedido, escolha a agência e clique em Designar. A arte ainda não enviada passa para ela; sem agência, passa para a Wellmix. O novo responsável é avisado."
- 🔤 Na tela: `[PASSO 6/9] Troque a agência, se precisar`; `[BOTÃO] "Designar"`; `[SETA]` "—: sem agência, a Wellmix faz a arte" na primeira opção da lista; `[DICA]` "Em Configurações, 'Arte da embalagem feita pela agência' desligado faz a Wellmix enviar a arte nos pedidos novos."
- ✂️ Edição: no vídeo gravado, designar a mesma agência (não muda nada) ou usar uma cópia do ponto de salvamento se for mostrar o "—".

**Cena 9 · 3:15–3:45 · Enviar para assinatura · `/app/orders/[id]`**

- 🎬 Imagem: de volta ao cartão Arte e embalagem. Com a arte enviada e o selo validado, o item **Documento do pedido enviado para assinatura** mostra o botão **Enviar para assinatura** (a agência ou a Wellmix clicam). Mostrar antes, em um pedido ainda sem selo, a mensagem "Aguardando o selo da certificadora aplicado na arte: o documento só vai para assinatura depois dele."
- 🎙 Narração: "O documento só vai para assinatura com a arte enviada e o selo aplicado. Quem fez a arte clica em Enviar para assinatura; a Wellmix também pode. Ao enviar, a Wellmix recebe o aviso para assinar."
- 🔤 Na tela: `[PASSO 7/9] Envie o documento para assinatura`; `[BOTÃO] "Enviar para assinatura"`; `[ATENÇÃO]` "Sem a arte ou sem o selo aplicado, o envio é recusado."
- ✂️ Edição: `[CORTE]` entre os dois pedidos; manter a mensagem 3 s.

**Cena 10 · 3:45–4:25 · Assinar pela Wellmix · `/app/orders/[id]/purchase-order`**

- 🎬 Imagem: o item **Documento do pedido assinado pela Wellmix** tem o botão **Abrir e assinar o documento**. A página **Documento do pedido #1** mostra o selo "Pronto para assinatura: esperando a Wellmix", o botão "Baixar o documento em PDF" e o quadro **Sua vez de assinar**: "Seu nome completo" (já preenchido), a caixa "Li o documento acima e concordo com produto, quantidade, preço, prazo e condição de pagamento." e **Assinar o documento**. Abaixo, comprador, fornecedor, itens, MOQ, prazo de produção, condição de pagamento e a "Folha do pedido (modelo Wellmix)". Marcar a caixa e clicar em **Assinar o documento**.
- 🎙 Narração: "A Wellmix assina primeiro. Confira produto, quantidade, preço, prazo e pagamento, marque Li e concordo e clique em Assinar o documento. A assinatura grava seu nome, seu login, a data e a versão. É um aceite no portal, não um certificado digital."
- 🔤 Na tela: `[PASSO 8/9] Assine pela Wellmix`; `[BOTÃO] "Assinar o documento"`; `[SETA]` "Versão do documento: a assinatura vale para esta versão" na linha da versão; `[QUEM VÊ]` "O documento tem o preço de compra: só a Wellmix, o fornecedor do pedido e a certificadora (só leitura) o abrem".
- ✂️ Edição: `[ZOOM 150 %]` no quadro "Sua vez de assinar"; 3 s na nota de rodapé do quadro.

**Cena 11 · 4:25–5:00 · O fornecedor assina · `/app/orders/[id]/purchase-order`**

- 🎬 Imagem: corte para o fornecedor A: no mesmo documento, o quadro **Sua vez de assinar** mostra as duas opções, "Opção 1: assinar aqui no portal" e "Opção 2: enviar o documento assinado" (baixar o PDF, assinar, carimbar e anexar). Ele envia um PDF. Volta à conta do operador: a seção **Assinaturas** mostra a Wellmix ("Aceite no portal") e o fornecedor ("Arquivo assinado"), e o selo no alto diz "Assinado pelos dois: pedido autorizado, falta gerar no Sankhya".
- 🎙 Narração: "O fornecedor assina em seguida: no portal, ou baixando o PDF e anexando o arquivo assinado. Com as duas assinaturas, o pedido está autorizado. Se o Sankhya ainda não tem o pedido, falta gerá-lo e informar o número."
- 🔤 Na tela: `[PASSO 9/9] Confira as duas assinaturas`; `[SETA]` "Aceite no portal" e "Arquivo assinado" na seção Assinaturas; `[SETA]` "Falta gerar no Sankhya" no selo; `[QUEM VÊ]` "O administrador devolve ou registra assinaturas recebidas por fora; o operador não".
- ✂️ Edição: corte de conta com a legenda "Fornecedor" no canto; o arquivo anexado é um PDF de demonstração, nunca um contrato real.

**Cena 12 · 5:00–5:30 · Arte aprovada, etapa concluída · `/app/orders/[id]`**

- 🎬 Imagem: o fornecedor clica em **Aprovar** na aprovação da arte. Na conta do operador, o cartão **Arte e embalagem** vira "Concluída" (5 de 5) e a **Inspeção** passa a "Em andamento". O cartão Produção mostra o "Início da produção" automático preenchido e os follows de 5, 15 e 25 dias.
- 🎙 Narração: "O fornecedor aprova a arte, e a etapa conclui. A Inspeção abre, e o início da produção entra sozinho, no dia do contrato assinado."
- 🔤 Na tela: `[BOTÃO] "Aprovar"`; `[SETA]` "Início da produção: automático" no cartão Produção; `[DEPOIS]` "A Inspeção abre (WPE-04). A Wellmix gera o pedido no Sankhya e informa o número."
- ✂️ Edição: `[DEPOIS]` por 4 s.

**Cena 13 · 5:30–5:45 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WPE-04.
- 🎙 Narração: "Resumindo: acompanhe o briefing, valide o selo, veja a aprovação, envie para assinatura e assine. Em seguida, a inspeção."
- 🔤 Na tela: `[RESUMO]` "1 Abra o briefing · 2 Valide o selo na arte · 3 Acompanhe aprovação e reprovação · 4 Envie para assinatura · 5 Assine pela Wellmix"; chamada "Próximo: WPE-04 · Inspeção cega e fila de revisão".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** aprovar a arte antes de ela chegar. O portal mostra "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar." e, no item, "Aguardando a arte (agência ou Wellmix)". → **Correção:** a agência (ou a Wellmix) envia a arte primeiro.
- **Erro:** tentar enviar o documento para assinatura sem a arte ou sem o selo. O portal mostra "Falta a arte da embalagem para enviar o documento para assinatura." ou "Falta o selo da certificadora aplicado na arte para enviar o documento para assinatura." → **Correção:** envie a arte, aguarde o selo e a validação, e só então envie.
- **Erro:** assinar sem marcar o aceite. O portal mostra "Marque que leu e concorda para assinar." → **Correção:** marque "Li o documento acima…" e assine.
- **Erro:** o fornecedor tenta assinar antes da Wellmix. O portal mostra "A Wellmix assina primeiro. Aguarde a assinatura dela." → **Correção:** assine pela Wellmix primeiro.
- **Erro:** o pedido muda enquanto a pessoa lê o documento. O portal mostra "O pedido mudou enquanto você leu. Confira o documento de novo e assine." → **Correção:** releia a versão nova e assine de novo. Uma assinatura de versão anterior aparece como "Assinou uma versão anterior deste documento (o pedido mudou depois)."
- **Erro:** recusar o selo sem motivo. O portal mostra "Escreva o motivo para recusar." → **Correção:** escreva o motivo; quem fez a arte recebe o aviso.
- **Erro:** tentar refazer uma aprovação já decidida. O portal mostra "Esta aprovação já foi decidida; só a Wellmix pode refazer." → **Correção:** peça à Wellmix.

### Passo a passo em texto

1. No menu **Pedidos**, clique em **Embalagens** e abra o briefing do produto. Veja o que é, as medidas da caixa e os entregáveis (faca, arte, arquivos para a gráfica, foto da embalagem física).
2. Abra o pedido. No cartão **Arte e embalagem**, confira os cinco itens e quem faz cada um.
3. Em **Certificação**, a linha **Selo aplicado na arte** chega como "Enviado, aguardando validação". Clique em **Validar** ou, com o motivo escrito, em **Recusar**.
4. Quando o fornecedor reprovar a arte, ela volta para quem a fez, com a observação. Quando for reenviada, a aprovação volta a "Pendente".
5. Para trocar quem faz a arte, vá a **Parceiros do pedido**, escolha a agência na linha **Agência** e clique em **Designar**. Sem agência, a Wellmix faz a arte.
6. Com a arte e o selo aplicado, o item **Documento do pedido enviado para assinatura** libera **Enviar para assinatura** (quem fez a arte, ou a Wellmix).
7. Abra **Documento do pedido**. No quadro **Sua vez de assinar**, confira o documento, marque o aceite e clique em **Assinar o documento**.
8. O fornecedor assina em seguida, no portal ou anexando o PDF assinado. O selo da página muda para "Assinado pelos dois: pedido autorizado, falta gerar no Sankhya".
9. Quando o fornecedor aprovar a arte, a etapa conclui, o início da produção entra sozinho e a Inspeção abre.

### Notas de gravação

- A cena 3 precisa de três briefings na lista, um deles "Em preparação" com "Venda ainda não confirmada". Se a carga tiver só a jarra, mostre a lista com ela e cite o selo apenas no texto.
- Na cena 7 a observação do fornecedor aparece na tela da Wellmix exatamente como foi escrita, sem tradução. Escreva-a em pt no vídeo (por exemplo, "Pantone da tampa diferente do aprovado") para o espectador entender.
- A cena 9 mostra duas situações do mesmo botão. Grave a mensagem "Aguardando o selo…" num pedido ainda sem selo validado (o pedido de apoio) e o botão "Enviar para assinatura" no pedido da jarra.
- O PDF anexado pelo fornecedor e o nome digitado são de demonstração. Mostre a "Folha do pedido (modelo Wellmix)" sem citar valores.
- Não mostre os campos em branco da folha (foto, trading code, EAN, DUN, LI, comissão): o próprio texto da tela explica que são dados que ainda não estão no portal.
- A hora das datas no documento (Brasília) pode diferir do dia mostrado em outras telas (UTC) perto da meia-noite. Grave de manhã.

### Pontos a confirmar

- ⚠ Quem pode "Trocar responsável" no briefing: a tela mostra "Quem faz: Agência Criativa" como texto, sem o seletor. O dicionário tem "Trocar responsável", e docs/WORKFLOW.md diz que o dono pode ser trocado na solicitação ou no briefing. Conferir se o seletor só aparece com mais de uma agência.
- ⚠ O formulário "Devolver para assinar de novo" ("Devolver a assinatura do fornecedor (administrador)") e o registro de assinatura "recebida por fora": docs/ORDER_SIGNATURE.md diz que o administrador os usa "enquanto a Preparação está aberta", texto de antes da inversão da ordem (a assinatura agora fica na etapa Arte e embalagem). Não os vi na tela do pedido #3, já assinado. Conferir quando o formulário aparece antes de gravar a cena 11.
- ⚠ Se a faca (die-cut) trava alguma etapa: no teste, o pedido seguiu para a assinatura e a inspeção com a faca ainda "com o fornecedor". A cena 4 só diz que a faca vem do fornecedor escolhido.
- ⚠ O aviso à Wellmix ao concluir a segunda assinatura ("Pedido autorizado: gere-o no Sankhya e informe o número no pedido") não tem um campo depois que a etapa "Pedido pré-aprovado" conclui (ver WPE-01, pontos a confirmar). A cena 11 diz só "falta gerar no Sankhya".
- ⚠ A tabela de etapas mostra a linha "Artes da embalagem" com situação "Não começou" mesmo com a etapa concluída; ela é o cartão de designer e de não conformidade (nada a ver com o envio da arte). Se confundir quem assiste, cortar a linha da cena 5.

---

## WPE-04 · Inspeção cega e fila de revisão

> **Promessa:** ao final do vídeo você lê a comparação entre o que foi comprado e o que o inspetor encontrou, decide uma divergência (aprovar ou pedir nova medição) e sabe usar a tela Itens para revisão sem deixar o pedido parado.

| Ficha                 |                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner; a tela Revisão também abre para gerente de produto e cadastro)                                                  |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; um corte curto com `supplier.a@china.com` (zh) na cena 3                                                                      |
| Duração-alvo          | 4:30                                                                                                                                                           |
| Ponto da jornada      | Etapa 6 de 9: Inspeção                                                                                                                                         |
| Telas e rotas         | `/app` (Control Tower), `/app/orders/[id]` (etapa Inspeção e "Resultado da inspeção"), `/app/reviews` (Itens para revisão)                                       |
| Dados antes de gravar | Ponto `antes-WPE-04`: documento do pedido assinado e arte aprovada (WPE-03); "Inspeção" aberta; o fornecedor ainda não enviou. Para a divergência, ele envia as 3 fotos, peso líquido 0,55 e unidades por caixa master 20, contra 0,4 e 24 da ficha |
| Depois deste vídeo    | Com Aprovar, a Inspeção conclui e o "Embarque" abre. Com Reprovar, o fornecedor mede de novo (FOR-08) e, dentro da tolerância, a etapa libera sozinha          |
| Antes · Próximo       | WPE-03 (e FOR-08 na ordem de gravação) · WLO-01 e WPE-05                                                                                                       |
| Idiomas               | pt (base)                                                                                                                                                      |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a Control Tower. O quadrado **Inspeção com problema** mostra 1 e, no bloco "Problemas", **Bloqueados** mostra 1. O cursor toca em "Inspeção com problema" e a lista logo abaixo mostra o pedido.
- 🎙 Narração: "O fornecedor mediu a jarra e o peso não bate com o que foi comprado. O pedido parou, e agora quem decide é a Wellmix."
- 🔤 Na tela: `[TÍTULO]` "WPE-04 · Inspeção cega e fila de revisão"; `[ZOOM 150 %]` no quadrado.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapa 6, Inspeção. Antes de a carga sair da China, o inspetor mede e fotografa, e o portal compara com o que foi comprado."
- 🔤 Na tela: `[MAPA etapa 6]` com "Inspeção" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:50 · Inspeção cega · `/app/orders/[id]` (conta do fornecedor, depois do operador)**

- 🎬 Imagem: corte curto para a conta do fornecedor A (tela em zh): o cartão da Inspeção traz a faixa com o aviso de inspeção cega e os campos de peso e medidas, sem nenhum valor esperado. Volta para a conta do operador, no cartão **Inspeção**: o fornecedor enviou "Foto sem embalagem", "Foto com embalagem", "Foto na balança", "Peso medido (kg)" e as medidas opcionais.
- 🎙 Narração: "A inspeção é cega: o inspetor informa o que encontrou, sem ver o valor esperado. Quem compara é o portal, com a ficha de compra e o Comprado do pedido."
- 🔤 Na tela: `[PASSO 1/6] Abra o pedido da inspeção`; `[QUEM VÊ]` "O fornecedor nunca vê o valor esperado"; `[SETA]` "O inspetor informa só o que encontrou" no aviso do fornecedor.
- ✂️ Edição: legenda "Fornecedor" e "Wellmix" no canto em cada corte; mostrar o texto do aviso em pt (o aviso é "Inspeção cega: informe exatamente o que encontrou (peso, medidas, caixa, material, cor)…").

**Cena 4 · 0:50–1:25 · O resultado e as tolerâncias · `/app/orders/[id]`**

- 🎬 Imagem: o cartão **Resultado da inspeção**, com o selo "Divergente: aguardando decisão". A tabela **O que o fornecedor mediu** tem Atributo, Esperado, Encontrado, Tolerância e Situação: Peso líquido (kg) 0,4 · 0.55 · 3 % · Divergente; Peso bruto (kg) 0,5 · 0.5 · 5 % · OK; Unidades por caixa master 24 · 20 · 0 % · Divergente; Unidades por inner box 6 · 6 · 0 % · OK; CBM da caixa (m³) 0,06 · 0.06 · 5 % · OK; Material GLASS · GLASS · OK; Cor · "Sem referência". Embaixo, "Fotos da inspeção".
- 🎙 Narração: "O resultado mostra esperado, encontrado e a tolerância de cada medida. No padrão, são 3% para o peso líquido, 5% para peso bruto, CBM e dimensões, e nenhuma para unidades por caixa. O administrador ajusta isso em Configurações."
- 🔤 Na tela: `[PASSO 2/6] Leia o Resultado da inspeção`; `[ZOOM 150 %]` na coluna Tolerância; `[SETA]` "Divergente: fora da tolerância" nas linhas vermelhas; `[SETA]` "Sem referência: a ficha não tem esse valor" em Cor; `[QUEM VÊ]` "Mudar tolerância é só do administrador (Configurações)".
- ✂️ Edição: manter a tabela 4 s em tela. Corte de 3 s para Configurações na conta do admin, mostrando "Tolerância de peso (%)", "Tolerância de dimensões (%)", "Tolerância de CBM e peso (%)" e "Tolerância de quantidade (%)".

**Cena 5 · 1:25–2:00 · A etapa bloqueada · `/app/orders/[id]`**

- 🎬 Imagem: o topo do pedido mostra "Inspeção · Bloqueada" e a faixa vermelha "Revisão necessária: Divergência comprado × inspecionado: Peso líquido (kg) esperado 0.4, encontrado 0.55; Unidades por caixa master esperado 24, encontrado 20. REVISÃO NECESSÁRIA." No cartão da etapa, o último item é **Revisão da divergência na inspeção (Wellmix)**, com o campo "Observação" e os botões **Aprovar** e **Reprovar**; abaixo, **Liberar etapa**. Na parte de baixo do resultado, "Divergências registradas 2" e o link "Abrir fila de revisão →".
- 🎙 Narração: "Divergência fora da tolerância bloqueia a etapa e abre um item de revisão para cada medida. Você decide aqui, em Revisão da divergência na inspeção: Aprovar, ou Reprovar para pedir nova medição."
- 🔤 Na tela: `[PASSO 3/6] Decida a divergência`; `[SETA]` "Etapa bloqueada: aguarda a Wellmix" no selo; `[BOTÃO] "Aprovar"`; `[BOTÃO] "Reprovar"`; `[SETA]` "Cada divergência vira um item na fila" em "Divergências registradas".
- ✂️ Edição: `[ZOOM 150 %]` na faixa vermelha; 2 s na linha "Revisão da divergência…".

**Cena 6 · 2:00–2:40 · Itens para revisão · menu Pedidos → Revisão → `/app/reviews`**

- 🎬 Imagem: clicar em "Abrir fila de revisão →" (ou no menu **Pedidos → Revisão**). A tela **Itens para revisão**: filtros **Abertos**, **Resolvidos** e **Dispensados**, cada um com a contagem. Dois cartões do Pedido #N: "Inspeção: peso líquido" e "Inspeção: un/caixa master", cada um com Esperado, Encontrado, Responsável ("Operador Wellmix") e Ação necessária ("Revisar com o fornecedor; aprovar a divergência ou pedir nova medição."), o campo "Observação opcional (motivo da decisão)" e os botões **Resolver** e **Dispensar**. O link **Abrir** leva ao pedido.
- 🎙 Narração: "Todo item que violou uma regra vai para esta fila: inspeção, preço zerado, container cheio demais, certificação que falta. Cada cartão mostra o esperado, o encontrado, quem resolve e o que fazer."
- 🔤 Na tela: `[PASSO 4/6] Abra Pedidos → Revisão`; `[SETA]` "Esperado × encontrado" nos campos; `[BOTÃO] "Resolver"`; `[BOTÃO] "Dispensar"`; `[ATENÇÃO]` "Resolver e Dispensar só marcam o item na fila: não liberam a etapa bloqueada do pedido."
- ✂️ Edição: manter o `[ATENÇÃO]` 4 s em tela; não clicar em Resolver nesta cena.

**Cena 7 · 2:40–3:15 · Aprovar libera · `/app/orders/[id]`**

- 🎬 Imagem: de volta ao pedido, escrever no campo "Observação" do item "Revisão da divergência na inspeção (Wellmix)" um motivo (por exemplo, "Peso a mais é da tampa de bambu; aceito.") e clicar em **Aprovar**. O pedido sai de "Bloqueada": a etapa Inspeção vira "Concluída" e o **Embarque** passa a "Em andamento". Em "Decisão da Wellmix", aparece "Divergência aceita", com o nome, a data e o motivo. Na fila, os itens do pedido passam a **Resolvidos**.
- 🎙 Narração: "Aprovar aceita a divergência: escreva o motivo, clique em Aprovar, e a etapa libera. A decisão fica registrada, com seu nome, a data e o motivo, e os itens da fila passam para Resolvidos."
- 🔤 Na tela: `[PASSO 5/6] Aprove, com o motivo`; `[BOTÃO] "Aprovar"`; `[SETA]` "Divergência aceita" em "Decisão da Wellmix"; `[SETA]` "Embarque: em andamento".
- ✂️ Edição: clique com onda; `[CORTE]` para a tabela de etapas; 2 s na linha "Decisão da Wellmix".

**Cena 8 · 3:15–3:55 · Reprovar pede nova medição · `/app/orders/[id]`**

- 🎬 Imagem: em outro pedido bloqueado (cópia do ponto de salvamento), escrever "Meça de novo o peso líquido por peça" e clicar em **Reprovar**. A etapa deixa de estar bloqueada e fica "Em andamento", com o fornecedor como responsável: as medidas e a foto na balança voltam para "Reprovado", com a observação ("Nova medição solicitada pela Wellmix: …"). Corte para o fornecedor: link **Nova medição →**, ele reenvia as medidas dentro da tolerância. Volta ao operador: "Liberada automaticamente: nova medição dentro da tolerância".
- 🎙 Narração: "Reprovar pede nova medição: as medidas voltam para o fornecedor com a sua observação. Se o novo valor ficar dentro da tolerância, a etapa libera sozinha, sem você precisar aprovar."
- 🔤 Na tela: `[PASSO 6/6] Ou reprove e peça nova medição`; `[BOTÃO] "Reprovar"`; `[SETA]` "Nova medição solicitada" nas linhas reprovadas; `[SETA]` "Liberada automaticamente" em "Decisão da Wellmix".
- ✂️ Edição: três cortes de conta com legenda no canto; a observação aparece em pt também na tela do fornecedor.

**Cena 9 · 3:55–4:15 · O botão Liberar etapa · `/app/orders/[id]`**

- 🎬 Imagem: no pedido bloqueado, o botão **Liberar etapa** abaixo dos itens. Mostrar o resultado: o selo volta a "Em andamento", os itens de revisão vão para **Dispensados**, mas o item "Revisão da divergência na inspeção (Wellmix)" continua "Pendente".
- 🎙 Narração: "O botão Liberar etapa só reabre a etapa e dispensa os itens da fila. O item de revisão continua pendente: para concluir, ainda é preciso Aprovar ou Reprovar."
- 🔤 Na tela: `[ATENÇÃO]` "Liberar etapa não aprova a divergência."; `[BOTÃO] "Liberar etapa"`.
- ✂️ Edição: `[ZOOM 150 %]` no item pendente; 3 s em tela.

**Cena 10 · 4:15–4:30 · Depois e resumo**

- 🎬 Imagem: cartão `[DEPOIS]` e fundo vermelho com a lista; no fim, a miniatura do WLO-01.
- 🎙 Narração: "Resumindo: leia o resultado, decida no pedido e use a fila para ver o que está aberto. Agora a carga pode ir para o embarque."
- 🔤 Na tela: `[DEPOIS]` "Aprovada a inspeção, o Embarque abre. Frete e container são os próximos assuntos (WLO-01 e WLO-02)."; `[RESUMO]` "1 Leia o Resultado da inspeção · 2 Aprove com motivo ou Reprove · 3 Use Pedidos → Revisão para ver o que está aberto · 4 Resolver na fila não libera a etapa"; chamada "Próximo: WLO-01 · Fretes e tarifário de frete".
- ✂️ Edição: `[DEPOIS]` 4 s; fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Aviso (do fornecedor):** enquanto a divergência está pendente, ele vê "Divergência detectada; aguardando revisão da Wellmix." sem nenhum valor esperado. → **Correção:** nada a fazer do lado dele; a Wellmix decide.
- **Aviso:** o resultado mostra "Nenhuma comparação ainda: aguardando as medidas do fornecedor (ou o pedido não tem snapshot)." → **Correção:** espere o envio do peso e das medidas; pedido antigo, sem snapshot, só compara o peso.
- **Erro:** achar que "Resolver" na fila libera o pedido. O item vai para Resolvidos e a etapa continua "Bloqueada". → **Correção:** decida no pedido, em "Aprovar" ou "Reprovar".
- **Erro:** usar "Liberar etapa" esperando aprovar. A etapa reabre, mas "Revisão da divergência na inspeção (Wellmix)" continua pendente. → **Correção:** clique em "Aprovar" (ou "Reprovar").
- **Erro:** item de revisão inexistente. A tela mostra "Item de revisão não encontrado." → **Correção:** recarregue a fila; outro login pode ter decidido o item.
- **Erro:** dados inválidos no formulário da fila. A tela mostra "Dados inválidos. Verifique os campos." → **Correção:** o campo de observação aceita até 2.000 caracteres.

### Passo a passo em texto

1. Na **Control Tower**, toque no quadrado **Inspeção com problema** e abra o pedido (ou use **Pedidos → Pedidos**).
2. Em **Resultado da inspeção**, leia a tabela **O que o fornecedor mediu**: esperado, encontrado, tolerância e situação. As tolerâncias são as de Configurações.
3. No cartão **Inspeção**, no item **Revisão da divergência na inspeção (Wellmix)**, escolha:
   - **Aprovar**, com a observação: a divergência é aceita ("Divergência aceita"), a etapa conclui e o Embarque abre.
   - **Reprovar**, com a observação: as medidas voltam ao fornecedor (**Nova medição**); dentro da tolerância, a etapa libera sozinha.
4. Para ver tudo o que está aberto, abra **Pedidos → Revisão** (**Itens para revisão**). Use os filtros **Abertos**, **Resolvidos** e **Dispensados** e o link **Abrir** de cada cartão.
5. Em um cartão da fila, **Resolver** e **Dispensar** (com a observação opcional) só registram a decisão do item. Eles não liberam a etapa do pedido.
6. **Liberar etapa** reabre a etapa bloqueada e dispensa os itens da fila, mas o item de revisão continua pendente até você aprovar ou reprovar.

### Notas de gravação

- Para repetir a divergência, o fornecedor envia as 3 fotos, **Peso medido (kg)** = 0,55 e **Unidades por caixa master encontradas** = 20. O peso é por peça (o peso líquido por peça da ficha é o comparado). As demais medidas opcionais podem ser enviadas com os valores da ficha, para aparecerem como "OK".
- A cena 8 usa um segundo pedido bloqueado ou o ponto de salvamento do pedido antes do Aprovar. Se for gravar Aprovar e Reprovar no mesmo pedido, grave Reprovar primeiro; depois do Reprovar, o fornecedor reenvia e a etapa libera sozinha.
- A observação do Reprovar chega ao fornecedor com o prefixo "Nova medição solicitada pela Wellmix:" em português, mesmo na tela dele em zh ou en. Use texto curto.
- No cartão da fila, o nome da regra de inspeção sai em pt ("Inspeção: peso líquido"). O texto do problema e da ação foi gravado em pt pelo sistema.
- A faixa "Revisão necessária" lista as divergências no topo; o item de revisão do cartão mostra só a primeira. Não leia a faixa e o item como se fossem a mesma frase.
- O resultado ("Resultado da inspeção") pode continuar com o selo "Nova medição solicitada" depois que a etapa concluiu, se alguma medida opcional não foi reenviada. Termine a gravação reenviando todas as medidas, ou corte a imagem antes dessa tela.

### Pontos a confirmar

- ⚠ **Resolver e Dispensar na fila não liberam a etapa.** Em `decideReviewAction` e `resolveReviewById`, a decisão só atualiza o item de revisão. A tela da fila não avisa disso. Confirmar com o dono se é o comportamento desejado; se mudar, regravar as cenas 6 e 7.
- ⚠ "Liberar etapa" (`unblockStage`) dispensa os itens "inspection." com a nota "Etapa liberada manualmente pela Wellmix.", mas não conclui o item `inspection_review`. A cena 9 descreve o que a tela mostrou.
- ⚠ O nome da tela: o menu diz "Revisão", o título da tela diz "Itens para revisão" e o glossário do guia diz "Fila de revisão". A narração usa "a fila" e "Itens para revisão"; escolher um nome único.
- ⚠ Valores de tolerância (3 %, 5 %, 0 %) são os padrões de `src/lib/settings.ts`. O dono pode tê-los mudado em Configurações; conferir antes de citar os números na narração.
- ⚠ Se o inspetor é o próprio fornecedor ou um terceiro: o portal registra "Medido por: Li Wei" (o login do fornecedor). A cena 3 diz "inspetor" no sentido de quem informa as medidas.

---

## WPE-05 · Embarque e desembaraço pela Wellmix

> **Promessa:** ao final do vídeo você sabe designar os parceiros do pedido, ler o frete do tarifário, acompanhar os treze passos de embarque e desembaraço, validar o que é seu e enviar o DANFE.

| Ficha                 |                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner); o numerário pede o administrador (ou a função financeiro)                                                            |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; cortes curtos com `admin@wellmix.com` (cena 8) e com as contas dos parceiros quando a cena disser                                    |
| Duração-alvo          | 5:00                                                                                                                                                                  |
| Ponto da jornada      | Etapas 7 e 8 de 9: Embarque e mar · Desembaraço e transporte                                                                                                           |
| Telas e rotas         | `/app/orders/[id]` (cartões Embarque, Embarque e desembaraço, Parceiros do pedido), `/app/orders/[id]/invoice` (Invoice e packing list), `/app/freight/tariff`          |
| Dados antes de gravar | Ponto `antes-WPE-05`: Inspeção concluída; tarifário importado (WLO-01); companhia, agente de carga, comex e despachante designados; nenhum passo do cartão enviado           |
| Depois deste vídeo    | Com os 13 passos concluídos e o "Embarque confirmado", o Embarque conclui e o Desembaraço, do despachante, abre; depois, o Transporte (WPE-06)                           |
| Antes · Próximo       | WLO-01 e WLO-02 (e MAR-01, MAR-02, LOG-01, COM-01, DES-01, DES-02 na ordem de gravação) · WPE-06                                                                       |
| Idiomas               | pt (base)                                                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/orders/[id]`**

- 🎬 Imagem: o cartão **Embarque e desembaraço** do pedido, com "13 de 13 concluídos" no canto e a tabela de passos toda "Concluído".
- 🎙 Narração: "Treze passos, cinco parceiros, uma tela só. Aqui a Wellmix vê quem faz cada passo, quem valida e o que ainda falta."
- 🔤 Na tela: `[TÍTULO]` "WPE-05 · Embarque e desembaraço pela Wellmix"; `[ZOOM 150 %]` em "13 de 13 concluídos".
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s. Esta imagem é do fim da gravação (grave por último e use como abertura).

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/orders/[id]`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapas 7 e 8: embarque e mar, desembaraço e transporte. A carga sai da China, passa pela alfândega e segue para o cliente."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa e "Desembaraço e transporte" em destaque suave; `[SETA]` "A reserva no navio é o passo Booking, nesta tela".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:50 · Designar os parceiros · `/app/orders/[id]`**

- 🎬 Imagem: rolar até **Parceiros do pedido**. A tabela traz Parceiro, Designado e Trocar, com sete linhas: Agência, Despachante, Companhia marítima, Transportador, Comex (assessoria), Agente de carga e OCP (certificação). Em cada linha, uma lista e o botão **Designar**.
- 🎙 Narração: "Em Parceiros do pedido, a Wellmix designa quem atua neste pedido. Sem parceiro designado, a Wellmix faz a parte dele. Se só existe uma empresa daquele tipo, ela entra sozinha nos pedidos novos."
- 🔤 Na tela: `[PASSO 1/6] Confira os parceiros do pedido`; `[BOTÃO] "Designar"`; `[SETA]` "Sem parceiro: a Wellmix faz" na lista; `[QUEM VÊ]` "Cada parceiro vê só a etapa dele".
- ✂️ Edição: `[ZOOM 150 %]` na tabela; não clicar em Designar nesta cena (já está tudo designado).

**Cena 4 · 0:50–1:25 · Frete pelo tarifário · `/app/orders/[id]`**

- 🎬 Imagem: no cartão **Embarque** (Em andamento, Responsável: Companhia marítima), o quadro azul **Frete pelo tarifário**: "Tabelas até {data} · origem SHENZHEN", a linha "Marítima SA (ALFA LINES) → NAVEGANTES", o selo "companhia do pedido", o valor em R$ e "US$ 3.500,00 · longa · prazo 120 dias"; a lista **Porto de embarque** com o botão **Ver frete**; os links **Ver tarifário completo** e **Importar planilha da companhia marítima**.
- 🎙 Narração: "No Embarque, a Wellmix vê o frete das tabelas de todas as companhias para a rota do pedido, do mais barato ao mais caro, com a companhia do pedido marcada. Ver tarifário completo abre o comparativo."
- 🔤 Na tela: `[PASSO 2/6] Veja o frete pelo tarifário`; `[SETA]` "Companhia do pedido" no selo; `[BOTÃO] "Importar planilha da companhia marítima"`; `[QUEM VÊ]` "A companhia marítima não vê o comparativo: vê só o botão de enviar a tabela dela".
- ✂️ Edição: `[ZOOM 150 %]` no quadro; 3 s parado; se o local do fornecedor na ficha não for um porto do tarifário, o quadro mostra a lista para escolher o porto (cite só no texto).

**Cena 5 · 1:25–1:58 · A companhia confirma o embarque · `/app/orders/[id]`**

- 🎬 Imagem: os itens do cartão: **Data de embarque** (opcional), **Previsão de chegada** ("Aguardando a data de embarque" até a data entrar), **Navio / viagem**, **Bill of Lading (BL)** e **Embarque confirmado (data, chegada, navio e BL são opcionais)**. Corte para a conta da companhia: ela envia as datas e o navio e clica em **Confirmar**. Volta à Wellmix: o cartão vira "Concluída", o Desembaraço abre.
- 🎙 Narração: "A companhia marítima confirma o embarque. Data, chegada, navio e BL são opcionais: o que conclui a etapa é Embarque confirmado. A chegada nunca pode ser antes da data de embarque."
- 🔤 Na tela: `[PASSO 3/6] Acompanhe a confirmação do embarque`; `[BOTÃO] "Confirmar"`; `[ERRO COMUM]` "A previsão de chegada não pode ser antes da data de embarque." → "Escolha uma data igual ou depois do embarque."; `[DICA]` "Na Control Tower: 'Esperando reserva no navio', 'Esperando o navio sair', 'No mar' e 'No porto / alfândega' mostram onde cada pedido está."
- ✂️ Edição: dois cortes de conta com legenda no canto; `[ZOOM 150 %]` em "Aguardando a data de embarque".

**Cena 6 · 1:58–2:45 · O cartão Embarque e desembaraço · `/app/orders/[id]`**

- 🎬 Imagem: o cartão **Embarque e desembaraço** com a tabela **Passo · Situação · Quem faz / valida · Informado · Enviado por · Ação**. O cursor percorre as linhas: Booking, Draft do BL, Invoice e packing list (com o link "Gerar invoice e packing list"), Invoice e packing assinados, BL (original), Presença de carga, Numerário, Numerário pago, Canal de parametrização, DI/DUIMP e XML, CE Mercante, Comprovante de importação (CI) e DANFE (nota de entrada). Sobrepor, passo a passo, o "Faz … · valida …" de cada linha. Clicar em **Gerar invoice e packing list**: abre a página com a invoice comercial e o packing list montados com os itens e a ficha de compra.
- 🎙 Narração: "Cada linha diz quem faz e quem valida. O agente de carga manda a reserva no navio e o rascunho do BL; o comex, a invoice e o numerário; o fornecedor assina a invoice. Um passo só abre depois do anterior."
- 🔤 Na tela: `[PASSO 4/6] Leia o cartão Embarque e desembaraço`; `[SETA]` "Faz … · valida …" em cada linha; `[SETA]` "Depois de: …" em "Draft do BL" e "BL (original)"; `[DICA]` "Gerar invoice e packing list monta o PDF com os itens, o preço da cotação e a ficha de compra."; `[ZOOM 150 %]` em "Numerário".
- ✂️ Edição: a tabela inteira cabe em duas telas: rolar devagar; legenda de cada passo por 2 s. Mostrar a tabela da seção "Passo a passo em texto" como cartão fixo no canto.

**Cena 7 · 2:45–3:22 · Validar ou recusar · `/app/orders/[id]`**

- 🎬 Imagem: o passo **Booking** chega "Enviado, aguardando validação", com o número informado (`BK-778123`) e "Enviado por: Lucas Logística". Na coluna Ação: o campo "Motivo (obrigatório para recusar)" e os botões **Validar** e **Recusar**. Clicar em **Validar**: a linha vira "Concluído · validado por Otávio Operador" e o passo seguinte, "Draft do BL", abre.
- 🎙 Narração: "Quando um passo chega aguardando validação e é a sua vez, clique em Validar. Para recusar, escreva o motivo: quem fez recebe o aviso e envia de novo. Quem enviou não valida o próprio passo."
- 🔤 Na tela: `[PASSO 5/6] Valide ou recuse os passos que são seus`; `[BOTÃO] "Validar"`; `[BOTÃO] "Recusar"`; `[ERRO COMUM]` "Quem enviou não valida o próprio passo." → "Peça a outra pessoa; só o administrador valida o que ele mesmo enviou."; `[SETA]` "Validado por …" na linha.
- ✂️ Edição: legenda "Agente de carga" no corte do envio e "Wellmix" no da validação; 2 s no "validado por".

**Cena 8 · 3:22–3:58 · Numerário e canal · `/app/orders/[id]`**

- 🎬 Imagem: a linha **Numerário** (Faz: comex · valida: financeiro) chega com "R$ 18.500,00" e o arquivo. Na conta do operador, a linha não tem o botão Validar. Corte para o administrador: a mesma linha com **Validar**; depois, **Numerário pago** (Faz: financeiro) recebe o comprovante. Em seguida, a linha **Canal de parametrização** (Verde, Amarelo, Vermelho, Cinza). No painel, o quadrado "Numerário para pagar" e, no bloco "Acontece ao mesmo tempo", "Canal amarelo/vermelho".
- 🎙 Narração: "Numerário é o dinheiro que o comex pede para cobrir o desembaraço. O financeiro, ou o administrador, valida e paga e anexa o comprovante. O operador não vê esse botão. Canal vermelho ou cinza avisa a Wellmix sobre prazo e armazenagem."
- 🔤 Na tela: `[PASSO 6/6] Acompanhe numerário e canal`; `[QUEM VÊ]` "Validar e pagar o numerário: só o administrador ou a função financeiro"; `[ERRO COMUM]` "Não foi possível concluir. Verifique os dados. (invalid_input)" → "No campo Valor (R$), digite sem o ponto de milhar: 18500,00"; `[SETA]` "Numerário para pagar" no quadrado.
- ✂️ Edição: `[CORTE]` de conta com legenda "Operador" e "Administrador"; `[ZOOM 150 %]` no campo "Valor (R$)".

**Cena 9 · 3:58–4:30 · DANFE, desembaraço e liberação · `/app/orders/[id]`**

- 🎬 Imagem: a linha **DANFE (nota de entrada)** (Faz: Wellmix; "Depois de: DI/DUIMP e XML"). Digitar `NF-000123` em "Nº da nota fiscal", escolher o arquivo e clicar em **Enviar**. Corte: a etapa **Desembaraço** (Responsável: Despachante) com "Número do processo", "Documentos aduaneiros", "Custos previstos", "Custos realizados" e "Liberação aduaneira", todos concluídos pelo despachante.
- 🎙 Narração: "O DANFE, a nota de entrada, é da Wellmix: digite o número da nota, anexe o arquivo e envie. A etapa Desembaraço é do despachante: processo, documentos, custos e liberação. Quando ele libera, o pedido segue para o transporte."
- 🔤 Na tela: `[BOTÃO] "Enviar"`; `[SETA]` "O DANFE é da Wellmix" na linha; `[SETA]` "Liberação aduaneira: o despachante conclui" no cartão do Desembaraço; `[DEPOIS]` "O Transporte abre. A Wellmix acompanha (WPE-06)."
- ✂️ Edição: digitação em tempo real; o arquivo é um PDF de demonstração; `[DEPOIS]` por 4 s.

**Cena 10 · 4:30–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WPE-06.
- 🎙 Narração: "Resumindo: designe os parceiros, confira o frete, valide o que é seu, acompanhe o numerário e envie o DANFE. Em seguida, o transporte e a entrega."
- 🔤 Na tela: `[RESUMO]` "1 Designe os parceiros · 2 Veja o frete pelo tarifário · 3 Valide os passos que são seus · 4 Numerário: financeiro ou administrador · 5 Envie o DANFE"; chamada "Próximo: WPE-06 · Transporte, entrega e encerramento".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Quem faz e quem valida cada passo (cartão "Embarque e desembaraço")

| Passo                            | Faz            | Valida         | Depois de              |
| -------------------------------- | -------------- | -------------- | ---------------------- |
| Booking (reserva no navio)       | agente de carga| Wellmix        | —                      |
| Draft do BL                      | agente de carga| comex          | Booking                |
| Invoice e packing list           | comex          | fornecedor     | —                      |
| Invoice e packing assinados      | fornecedor     | comex          | Invoice e packing list |
| BL (original)                    | agente de carga| comex          | Draft do BL            |
| Presença de carga                | comex          | —              | BL (original)          |
| Numerário                        | comex          | financeiro     | —                      |
| Numerário pago                   | financeiro     | —              | Numerário              |
| Canal de parametrização          | comex          | —              | —                      |
| DI/DUIMP e XML                   | comex          | —              | —                      |
| CE Mercante                      | comex          | —              | —                      |
| Comprovante de importação (CI)   | comex          | —              | —                      |
| DANFE (nota de entrada)          | Wellmix        | —              | DI/DUIMP e XML         |

(docs/IMPORT_FLOW.md; os rótulos são os da tela. Quem enviou não valida o próprio passo, exceto o administrador.)

### Erros comuns

- **Erro:** passo antes da hora. O portal mostra "Conclua antes o passo anterior." → **Correção:** espere o passo "Depois de" ser concluído (e validado, quando tiver validação).
- **Erro:** validar o que você mesmo enviou. O portal mostra "Quem enviou não valida o próprio passo." → **Correção:** outra pessoa valida; o administrador pode validar o próprio envio.
- **Erro:** recusar sem motivo. O portal mostra "Escreva o motivo para recusar." → **Correção:** escreva o motivo; quem fez recebe o aviso "Recusado; quem fez foi avisado." e corrige.
- **Erro:** enviar passo sem arquivo ou sem valor. O portal mostra "Envie o arquivo.", "Informe o valor." ou "Preencha o número/data." → **Correção:** complete o campo do passo.
- **Erro:** numerário com ponto de milhar. No campo "Valor (R$)", "18.500,00" volta com "Não foi possível concluir. Verifique os dados. (invalid_input)". → **Correção:** digite "18500,00" ou "18500".
- **Erro:** previsão de chegada antes do embarque. O portal mostra "A previsão de chegada não pode ser antes da data de embarque." → **Correção:** corrija a data. Se a chegada já foi informada, o embarque também não passa dela: "A data de embarque não pode ser depois da previsão de chegada já informada."
- **Erro:** arquivo em formato fora da lista. O portal mostra "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." → **Correção:** converta o arquivo.
- **Aviso:** "Este passo ainda não está liberado no sistema. Avise a Wellmix e tente de novo depois." → **Correção:** o esquema do banco ainda não foi publicado; avise o administrador.

### Passo a passo em texto

1. No pedido, em **Parceiros do pedido**, confira ou troque cada parceiro (Agência, Despachante, Companhia marítima, Transportador, Comex, Agente de carga, OCP) com **Designar**. Sem parceiro, a Wellmix faz a parte dele.
2. No cartão **Embarque**, leia o **Frete pelo tarifário** (rota do pedido, da opção mais barata para a mais cara, com a **companhia do pedido** marcada). **Ver tarifário completo** abre o comparativo; **Importar planilha da companhia marítima** leva à tela do tarifário.
3. Acompanhe a companhia marítima: **Data de embarque**, **Previsão de chegada** (só depois da data), **Navio / viagem** e **Bill of Lading (BL)** são opcionais; **Embarque confirmado** conclui a etapa.
4. No cartão **Embarque e desembaraço**, leia a tabela: quem faz e quem valida cada passo, o que foi informado e quem enviou. Use **Gerar invoice e packing list** para montar o PDF que o comex confere.
5. Nos passos em que a Wellmix valida (por exemplo, **Booking**), clique em **Validar** ou escreva o motivo e clique em **Recusar**.
6. O **Numerário** é validado e pago pelo financeiro ou pelo administrador, que anexa o comprovante em **Numerário pago**. O **Canal de parametrização** amarelo, vermelho ou cinza avisa a Wellmix.
7. O **DANFE (nota de entrada)** é da Wellmix: digite o número da nota, anexe o arquivo e clique em **Enviar**.
8. Quando o despachante conclui o **Desembaraço** (Número do processo, Documentos aduaneiros, Custos realizados e Liberação aduaneira), o Transporte abre.

### Notas de gravação

- Grave os parceiros em ordem (agente, comex, fornecedor, financeiro) usando as contas deles, para a linha de tempo ficar coerente, e monte o episódio com as telas da Wellmix. A tela do operador mostra o cartão do início ao fim.
- O passo "Booking" é a **reserva no navio**: na narração diga "reserva no navio" e cite "Booking" só como o nome do passo.
- Não grave o envio do numerário com ponto de milhar, a não ser na cena de erro. Use 18500,00 (valor de demonstração).
- O link "Gerar invoice e packing list" abre uma página própria (com "Imprimir → Salvar como PDF"). Mostre-a por 3 s e volte ao cartão.
- Todos os arquivos enviados (draft do BL, invoice, BL, DI, CI, DANFE) são PDFs de demonstração sem dados reais; a "Folha do pedido" e o numerário não mostram valores reais.
- Aviso de tamanho: arquivo acima de cerca de 3,5 MB sobe direto do navegador ao armazenamento (até 50 MB); durante o envio o passo não vai. Não grave arquivo grande.

### Pontos a confirmar

- ⚠ **Numerário com ponto de milhar** devolve "Não foi possível concluir. Verifique os dados. (invalid_input)": o campo "Valor (R$)" troca só a primeira vírgula por ponto. Os outros campos de dinheiro do portal aceitam "1.234,56". Confirmar com o dono se este campo será corrigido; se mudar, tirar o erro da cena 8.
- ⚠ Docs/IMPORT_FLOW.md diz que o cartão "não substitui as etapas Embarque e Desembaraço do pedido" e que o BL e os custos continuam também nelas. A cena 9 trata o Desembaraço como etapa própria do despachante, e o Embarque como confirmação da companhia, como mostra a tela.
- ⚠ Quem valida o Booking quando a Wellmix o envia no lugar do agente (a regra "quem enviou não valida" faz o administrador validar). Não foi testado.
- ⚠ A tela do pedido mostra datas de requisito em formato AAAA-MM-DD ("2026-11-20") nos itens de Embarque, e dd/mm/aaaa nas demais telas. Não é erro, mas aparece na imagem; a legenda não deve ler a data.
- ⚠ O item de Transporte "Previsão de entrega" aparece na tela como "Previsão de chegada" (o rótulo vem da chave `eta`). Ver WPE-06.
- ⚠ A designação da OCP: com uma só certificadora ativa, ela é designada sozinha ao nascer o pedido. A cena 3 cita "se só existe uma empresa daquele tipo, ela entra sozinha" para os parceiros do embarque, como diz docs/IMPORT_FLOW.md; para a OCP, ver docs/CERTIFICATION.md.

---

## WPE-06 · Transporte, entrega e encerramento

> **Promessa:** ao final do vídeo você acompanha o caminhão, sabe quem confirma o recebimento, preenche o cartão Recebimento, vê o pedido encerrar e entende o pós-venda que abre.

| Ficha                 |                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner)                                                                                                                      |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; cortes curtos com `transportadora@rodo.com` (cena 3) e `joao@lojista.com` (cenas 5 e 8)                                            |
| Duração-alvo          | 4:15                                                                                                                                                                 |
| Ponto da jornada      | Etapas 8 e 9 de 9: Desembaraço e transporte · Entrega e pós-venda                                                                                                      |
| Telas e rotas         | `/app` (Control Tower), `/app/orders/[id]` (Transporte, Entrega, cartão Recebimento, Pós-venda), `/app/after-sales` (Pós-venda)                                          |
| Dados antes de gravar | Ponto `antes-WPE-06`: Desembaraço concluído (WPE-05); "Transporte" aberta, sem placa; transportador designado; o cliente com a pendência de confirmar o recebimento                |
| Depois deste vídeo    | O pedido encerra; abre o Pós-venda (o cliente recebe "Avalie a compra"); a parcela do fornecedor de 70% "90 dias após a entrega" passa a contar (WGE-03, só admin)                  |
| Antes · Próximo       | WPE-05 (e TRA-01, TRA-02, CLI-04, CLI-05, CLI-06 na ordem de gravação) · WPE-07                                                                                         |
| Idiomas               | pt (base)                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a Control Tower. O quadrado azul **Entregue, falta confirmar** mostra 1. O cursor toca nele; a lista mostra o pedido.
- 🎙 Narração: "A carga chegou ao cliente. Falta um clique para encerrar o pedido, e esse clique pode ser seu."
- 🔤 Na tela: `[TÍTULO]` "WPE-06 · Transporte, entrega e encerramento"; `[ZOOM 150 %]` no quadrado.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapas 8 e 9: do porto até o cliente, e depois a entrega e o pós-venda. É a reta final da jornada da jarra."
- 🔤 Na tela: `[MAPA etapa 8]` com "Desembaraço e transporte" acesa e "Entrega e pós-venda" em destaque suave.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:58 · O transporte · `/app/orders/[id]`**

- 🎬 Imagem: o pedido na etapa **Transporte** (Em andamento, Responsável: Transportador). Itens: **Placa do veículo**, **Previsão de chegada** (a previsão de entrega, com a data), **Situação do transporte** (opcional) e **Entrega realizada**. Corte curto para a conta do transportador: o cartão **Carga e entrega** (mercadoria, caixas master, volume total, peso bruto total, chegada do navio, liberação aduaneira, "Entregar em") e os campos que ele preenche. Volta ao operador: itens "Concluído" e **Entrega realizada** ainda "Pendente".
- 🎙 Narração: "O transportador informa a placa, a previsão de entrega e a situação, e confirma a entrega. A previsão nunca fica antes da chegada do navio. Ele vê a carga e onde entregar, mas não vê o fornecedor nem valores."
- 🔤 Na tela: `[PASSO 1/6] Acompanhe o Transporte`; `[SETA]` "Placa do veículo: o caminhão está a caminho" na linha; `[QUEM VÊ]` "O transportador não vê o fornecedor nem os valores; vê Carga e entrega"; `[ERRO COMUM]` "A previsão de entrega não pode ser antes da previsão de chegada do navio." → "Escolha uma data igual ou depois da chegada."
- ✂️ Edição: dois cortes de conta com legenda no canto; `[ZOOM 150 %]` na linha "Placa do veículo".

**Cena 4 · 0:58–1:25 · O que a Control Tower mostra · `/app`**

- 🎬 Imagem: no bloco "Onde o pedido está agora", os quadrados **Esperando caminhão**, **A caminho do cliente** e **Entregue, falta confirmar**. O pedido passa de um para o outro conforme a placa e a entrega são informadas.
- 🎙 Narração: "Sem placa, o pedido está em Esperando caminhão. Com a placa, A caminho do cliente. Com a entrega feita, Entregue, falta confirmar. Cada pedido aparece em um quadrado só."
- 🔤 Na tela: `[PASSO 2/6] Confira o quadrado do pedido`; `[SETA]` "Placa informada: a caminho do cliente"; `[DICA]` "Tocar no quadrado de novo fecha a lista."
- ✂️ Edição: sequência de três imagens curtas (2 s cada) com o mesmo pedido em quadrados diferentes.

**Cena 5 · 1:25–2:00 · Quem confirma o recebimento · `/app/orders/[id]`**

- 🎬 Imagem: o cartão **Entrega** (Em andamento, Responsável: Cliente): "Cliente confirma o recebimento (a Wellmix pode confirmar por ele). Com a confirmação o pedido é encerrado." O item **Recebimento confirmado** ("Pendente", Cliente) tem o botão **Confirmar**. Corte curto para o cliente, que também vê o botão. Volta ao operador, que clica em **Confirmar**. Em seguida, no admin, Configurações mostra "Quem confirma a entrega" com as opções Ambos, Cliente e Wellmix.
- 🎙 Narração: "Quem confirma o recebimento é o cliente, e a Wellmix pode confirmar por ele, por exemplo quando o cliente não responde. Clique em Confirmar. A regra fica em Configurações, em Quem confirma a entrega."
- 🔤 Na tela: `[PASSO 3/6] Confirme o recebimento`; `[BOTÃO] "Confirmar"`; `[QUEM VÊ]` "Mudar 'Quem confirma a entrega' é só do administrador"; `[SETA]` "Ambos, Cliente ou Wellmix" na lista.
- ✂️ Edição: dois cortes de conta; clique com onda; 2 s no resultado.

**Cena 6 · 2:00–2:40 · O cartão Recebimento · `/app/orders/[id]`**

- 🎬 Imagem: o cartão **Recebimento**, só da Wellmix. Descarga: "Nº do lacre", "Lacre" (Íntegro ou Violado), "Foto do lacre", "Fotos do container (aberto, carga, descarga)" e o checklist ("Lacre confere com o BL", "Container sem avarias", "Sem umidade ou mau cheiro", "Paletes e caixas íntegros", "Etiquetas e marcações conferidas", "Volumes contados") com **Salvar descarga**. Conferência por SKU: "Esperado", "Recebido", "Avariado", "Observação" e **Salvar conferência**. RIC e **Devolução do container**, com **Salvar RIC** e **Salvar devolução**. Fechamento: Cliente e Fornecedor, "pago … de …", o aviso "Falta: …" e **Encerrar recebimento**.
- 🎙 Narração: "O Recebimento é a conferência no armazém: lacre, fotos, checklist, o recebido de cada item, o RIC e a devolução do container. Recebido diferente do esperado vira divergência e avisa a equipe. O Fechamento mostra o que falta pagar."
- 🔤 Na tela: `[PASSO 4/6] Preencha o Recebimento`; `[SETA]` "Lacre violado alerta a equipe" no campo Lacre; `[SETA]` "Avariado não pode passar do recebido" na conferência; `[BOTÃO] "Encerrar recebimento"`; `[QUEM VÊ]` "O cartão Recebimento é só da Wellmix".
- ✂️ Edição: rolar devagar; `[ZOOM 150 %]` no "Falta: …" do Fechamento; não clicar em Encerrar recebimento nesta cena.

**Cena 7 · 2:40–3:08 · O pedido encerra · `/app/orders/[id]`**

- 🎬 Imagem: depois do Confirmar, a tabela de etapas mostra **Entrega** "Concluída" e **Encerramento** "Concluída", e o topo do pedido o selo "Encerramento". Na Control Tower, o quadrado **Encerrados no mês** passa a 1.
- 🎙 Narração: "Com a confirmação, a Entrega conclui e o pedido se encerra sozinho: o Encerramento não tem item a fazer. Ele passa a contar em Encerrados no mês."
- 🔤 Na tela: `[PASSO 5/6] Veja o pedido encerrar`; `[SETA]` "Encerramento: automático" na linha 9; `[SETA]` "Encerrados no mês" no quadrado.
- ✂️ Edição: `[CORTE]` entre o pedido e a Control Tower.

**Cena 8 · 3:08–3:50 · O pós-venda · `/app/orders/[id]` e `/app/after-sales`**

- 🎬 Imagem: no pedido encerrado, o cartão **Pós-venda** ("Aguardando cliente"): "O cliente ainda não respondeu. Ele foi avisado por notificação." com o campo "Observação da Wellmix" e **Encerrar pós-venda**; abaixo, **Comprar de novo / Nova proposta** (produto, última quantidade, último preço unitário de venda, data da compra; "Nova quantidade", "Prazo de resposta (SLA)", "Observação para a Wellmix"; botões **Comprar de novo** e **Quero nova proposta**). Corte para o cliente: em Pendências, "Avalie a compra: pedido #1". Depois, **Gestão → Pós-venda**: a lista com filtros Aguardando cliente, Respondidos e Encerrados.
- 🎙 Narração: "O processo não termina na entrega. O cliente recebe Avalie a compra e responde nota, problemas e interesse em recompra. A Wellmix usa as respostas e encerra. Do pedido, também sai a recompra, já pré-preenchida."
- 🔤 Na tela: `[PASSO 6/6] Acompanhe o pós-venda`; `[BOTÃO] "Encerrar pós-venda"`; `[BOTÃO] "Comprar de novo"`; `[SETA]` "Avalie a compra: a pendência do cliente"; `[QUEM VÊ]` "A avaliação é do cliente e da Wellmix; o fornecedor não a vê".
- ✂️ Edição: dois cortes de conta com legenda; `[ZOOM 150 %]` no cartão "Comprar de novo / Nova proposta"; não clicar em Comprar de novo.

**Cena 9 · 3:50–4:15 · Depois e resumo**

- 🎬 Imagem: cartão `[DEPOIS]` e fundo vermelho com a lista; no fim, a miniatura do WPE-07.
- 🎙 Narração: "Resumindo: acompanhe a placa, confirme o recebimento quando for com a Wellmix, feche o Recebimento e acompanhe o pós-venda. Depois, o que fazer com pedidos parados."
- 🔤 Na tela: `[DEPOIS]` "O pedido encerrou. O pagamento ao fornecedor de 90 dias passa a contar da entrega (só o administrador, WGE-03)."; `[RESUMO]` "1 Acompanhe o Transporte · 2 Confirme o recebimento · 3 Preencha o Recebimento · 4 Veja o encerramento · 5 Acompanhe o pós-venda"; chamada "Próximo: WPE-07 · Pedidos parados, atrasos e cancelamento".
- ✂️ Edição: `[DEPOIS]` por 4 s; fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** previsão de entrega antes da chegada do navio. O portal mostra "A previsão de entrega não pode ser antes da previsão de chegada do navio." → **Correção:** use uma data igual ou depois da chegada. No sentido contrário: "A previsão de chegada não pode ser depois da previsão de entrega já informada."
- **Erro:** conferência com avariado maior que o recebido. O portal mostra "Quantidade inválida (avariado não pode passar do recebido)." → **Correção:** corrija os números e salve a conferência.
- **Erro:** encerrar o recebimento com itens faltando. O portal mostra "Ainda falta conferir algo antes de encerrar." e, no Fechamento, "Falta: lacre, fotos do lacre e do container, checklist completo, conferência de todos os SKUs, RIC, devolução do container." → **Correção:** complete cada parte e salve.
- **Erro:** mexer num recebimento já encerrado. O portal mostra "O recebimento já foi encerrado." → **Correção:** depois de encerrado, o cartão é só leitura.
- **Erro:** confirmar o recebimento sem poder. O portal recusa se o login não é o do cliente do pedido nem da Wellmix. → **Correção:** quem confirma é o cliente do pedido ou a Wellmix.
- **Aviso:** a avaliação ainda aparece como "Aguardando cliente". → **Correção:** não é erro: o cliente foi avisado por notificação; o pós-venda só encerra quando a Wellmix o encerra.

### Passo a passo em texto

1. No pedido, na etapa **Transporte**, acompanhe **Placa do veículo**, **Previsão de entrega** (exibida como "Previsão de chegada"), **Situação do transporte** e **Entrega realizada**. Sem transportador designado, a Wellmix preenche.
2. Na **Control Tower**, o pedido aparece em **Esperando caminhão** (sem placa), **A caminho do cliente** (com placa) e **Entregue, falta confirmar** (entrega feita).
3. Na etapa **Entrega**, clique em **Confirmar** no item **Recebimento confirmado** quando o cliente não o fizer (a Wellmix pode confirmar por ele). O administrador define quem confirma em Configurações, em **Quem confirma a entrega**.
4. No cartão **Recebimento** (só da Wellmix), preencha a descarga (lacre, fotos, checklist), a conferência por SKU, o RIC e a devolução do container. Em **Fechamento**, confira o que falta e clique em **Encerrar recebimento**.
5. Depois da confirmação, a Entrega conclui e o pedido se encerra sozinho (**Encerramento**).
6. Acompanhe o **Pós-venda**: o cliente responde a **Avalie a compra**; a Wellmix pode escrever a **Observação da Wellmix** e clicar em **Encerrar pós-venda**. Do pedido encerrado saem **Comprar de novo** e **Quero nova proposta**.

### Notas de gravação

- O cartão Recebimento só aparece para a Wellmix, do desembaraço em diante. Grave-o preenchido pela metade, para o "Falta: …" ficar à vista, e depois do pedido encerrado, para mostrar que ele continua disponível.
- As fotos de lacre e de container são imagens de demonstração; não use foto de container real.
- Na cena 5 mostre a lista de "Quem confirma a entrega" só em corte do administrador. As três opções são Ambos, Cliente e Wellmix.
- A cena 8 mostra a resposta do cliente em vídeo separado (CLI-06). Aqui basta a pendência "Avalie a compra: pedido #N" e o cartão da Wellmix.
- O valor de "último preço unitário de venda" do cartão de recompra é o do pedido; mostre-o sem citar.
- As datas do requisito de Transporte aparecem no formato AAAA-MM-DD no histórico do item; não as leia na narração.

### Pontos a confirmar

- ⚠ **"Ambos" e "Cliente" em "Quem confirma a entrega" têm o mesmo efeito no código** (`stages.ts`): o responsável é o cliente nos dois, e a Wellmix pode confirmar em qualquer caso. Só "Wellmix" muda o responsável para o operador. Confirmar com o dono o que "Ambos" deve significar; a cena 5 descreve o que a tela faz.
- ⚠ O item de Transporte chama-se "Previsão de entrega" no fluxo (`stages.ts`), mas a tela mostra "Previsão de chegada" (mesma chave `eta` do embarque). Na narração usei "previsão de entrega"; confirmar qual rótulo a tela terá.
- ⚠ Quem é avisado quando o cliente responde ao pós-venda e quando a Wellmix o encerra: docs/WORKFLOW.md diz que "a Wellmix é avisada e encerra". Não gravei a resposta do cliente.
- ⚠ Se o aviso "Pedido #N: Entrega precisa de você" do cliente sai da lista quando a Wellmix confirma por ele: no teste, ele continuou em "Precisa de você" depois do encerramento, até o cliente tocar em Resolver. A cena 8 não mostra a lista de avisos do cliente.
- ⚠ O texto do aviso de fim de recebimento ("Recebimento encerrado; o financeiro foi avisado.") fala em "financeiro". Confirmar que o aviso vai para o administrador, já que o operador não tem a função financeiro; a cena 6 não clica em Encerrar recebimento.

---

## WPE-07 · Pedidos parados, atrasos e cancelamento

> **Promessa:** ao final do vídeo você encontra o que está atrasado ou bloqueado, entende os lembretes por prazo e sabe tratar um pedido de cancelamento do cliente, e o que só o administrador decide.

| Ficha                 |                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix · operador (funções comprador e planner); a decisão do cancelamento é do administrador                                                                            |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; cortes com `admin@wellmix.com` (cenas 5 a 7) e `joao@lojista.com` (cenas 5 e 6)                                                         |
| Duração-alvo          | 4:45                                                                                                                                                                     |
| Ponto da jornada      | Etapas 4 a 9 de 9 (vale para qualquer etapa do pedido)                                                                                                                    |
| Telas e rotas         | `/app` (Control Tower), `/app/tasks` (Pendências), `/app/sla` (Painel de SLA), `/app/notifications` (Notificações), `/app/orders/[id]` (alerta e cartão Cancelar pedido)       |
| Dados antes de gravar | Ponto `antes-WPE-07`: um pedido com a etapa vencida (por exemplo, o da piscina em "Pedido pré-aprovado"), um pedido com a inspeção atrasada com o fornecedor e um bloqueado por divergência; o cliente ainda sem pedido de cancelamento. Ver a nota sobre como envelhecer os prazos |
| Depois deste vídeo    | O cancelado fica "Cancelado" com o histórico (nada é apagado), sai dos containers e dos fretes em aberto e todos os envolvidos são avisados                                |
| Antes · Próximo       | WPE-06 · WGE-01 (Control Tower do administrador)                                                                                                                          |
| Idiomas               | pt (base)                                                                                                                                                                |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app`**

- 🎬 Imagem: a Control Tower com o bloco "Problemas". O quadrado vermelho **Atrasados** mostra 2. O cursor toca nele e a lista logo abaixo mostra duas linhas com o **Prazo** em vermelho.
- 🎙 Narração: "Pedido atrasado custa dinheiro. Aqui você vê o que venceu, com quem está parado e qual é a etapa."
- 🔤 Na tela: `[TÍTULO]` "WPE-07 · Pedidos parados, atrasos e cancelamento"; `[ZOOM 150 %]` na coluna Prazo.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Isto vale para qualquer etapa. Toda etapa tem prazo, um responsável e, quando vence, um lembrete."
- 🔤 Na tela: `[MAPA etapa 4]` ao `[MAPA etapa 9]`, todas acesas em sequência.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:58 · Atrasados e bloqueados · `/app`**

- 🎬 Imagem: no bloco "Problemas": **Atrasados**, **Bloqueados**, **Documento rejeitado**, **Sem número no Sankhya**, **Multa aberta**, **Itens para revisão**, **Certificação vencendo** e **Pedido de cancelamento**. Tocar em **Atrasados**: a tabela traz #, Cliente, Produto, Etapa, Responsável e Prazo (vermelho). Nos quadrados dos outros blocos, o selo "1 atrasado" aparece ao lado da contagem.
- 🎙 Narração: "No bloco Problemas, Atrasados é a etapa ativa com prazo vencido. Toque para ver o pedido, a etapa, quem é o responsável e a data. Bloqueados são as etapas paradas por uma divergência."
- 🔤 Na tela: `[PASSO 1/6] Toque em Atrasados`; `[SETA]` "Etapa ativa com prazo vencido" no quadrado; `[SETA]` "Responsável: Operador Wellmix ou Fornecedor" na coluna; `[DICA]` "Tocar de novo no quadrado fecha a lista."
- ✂️ Edição: `[ZOOM 150 %]` na tabela; 3 s parado nas datas em vermelho.

**Cena 4 · 0:58–1:30 · Pendências e Painel de SLA · `/app/tasks` e `/app/sla`**

- 🎬 Imagem: a tela **Minhas pendências**, com os filtros **Prazo** (Todas, Atrasadas, Vencem hoje, Até 7 dias…) e **Tipo**. Cada linha mostra "vence amanhã" ou "atrasada há N dias". Corte para o **Painel de SLA** na conta do administrador: a tabela **Equipe** e os cartões Atrasadas, Vencem hoje, Próx. 7 dias, Parceiros atrasados e "Etapas no prazo (30 dias)".
- 🎙 Narração: "Em Pendências, as mais urgentes vêm primeiro, com o prazo e quantos dias de atraso. O Painel de SLA reúne o que cada analista deve e o que está atrasado com parceiros, para você cobrar."
- 🔤 Na tela: `[PASSO 2/6] Confira Pendências e o Painel de SLA`; `[SETA]` "atrasada há N dias" na linha; `[QUEM VÊ]` "O Painel de SLA só mostra a divisão do analista; sem divisão, a tela diz 'Você ainda não tem divisão, por isso o painel está vazio.'"
- ✂️ Edição: corte de conta com a legenda "Operador" e "Administrador"; 2 s no cartão "Parceiros atrasados".

**Cena 5 · 1:30–2:05 · Lembretes por prazo · `/app/notifications`**

- 🎬 Imagem: o sino abre a tela **Notificações**, grupo "Precisa de você": "Vence em breve: pedido #5, Pedido pré-aprovado", com a linha "Falta: Pedido conferido e liberado ao fornecedor." e o botão **Resolver**. Em outra conta (fornecedor), o aviso "Atrasado: pedido #3, Inspeção". Corte para o administrador em Configurações: "Prazo por etapa (JSON, dias)" e "Lembrete antes do vencimento (dias)".
- 🎙 Narração: "Todo dia o portal confere os prazos. Quando falta um dia, ou quando já venceu, o responsável recebe um aviso: Vence em breve, ou Atrasado. Cada etapa avisa no máximo uma vez a cada vinte e quatro horas."
- 🔤 Na tela: `[PASSO 3/6] Entenda o lembrete por prazo`; `[SETA]` "Vence em breve: faltam até 1 dia" e `[SETA]` "Atrasado: já venceu" nos dois avisos; `[QUEM VÊ]` "Prazos por etapa e 'Lembrete antes do vencimento (dias)' são do administrador (Configurações)"; `[ATENÇÃO]` "E-mail e WhatsApp são de demonstração: só o sino do portal avisa."
- ✂️ Edição: `[CORTE]` de conta; 3 s no aviso; não mostre o endereço do agendador do lembrete.

**Cena 6 · 2:05–2:40 · Pedido bloqueado · `/app/orders/[id]`**

- 🎬 Imagem: o pedido com "Inspeção · Bloqueada" e a faixa vermelha "Revisão necessária". Mostrar de relance o item "Revisão da divergência na inspeção (Wellmix)" com **Aprovar** e **Reprovar**, e o botão **Liberar etapa**. Na Control Tower, o mesmo pedido em "Inspeção com problema" e em "Bloqueados".
- 🎙 Narração: "Etapa bloqueada espera a Wellmix. O caminho é o do vídeo da inspeção: Aprovar, ou Reprovar para pedir nova medição. Liberar etapa só reabre a etapa, não aprova."
- 🔤 Na tela: `[PASSO 4/6] Resolva o bloqueado`; `[BOTÃO] "Aprovar"`; `[BOTÃO] "Reprovar"`; `[ATENÇÃO]` "Liberar etapa não aprova a divergência (WPE-04)."
- ✂️ Edição: `[ZOOM 150 %]` na faixa; 3 s no botão.

**Cena 7 · 2:40–3:20 · O cliente pede o cancelamento · `/app/orders/[id]`**

- 🎬 Imagem: corte para o cliente, no pedido ainda em "Pedido pré-aprovado": o cartão **Solicitar cancelamento** ("Você pode pedir o cancelamento até o produto entrar em produção. A Wellmix analisa e responde."), o campo "Por que deseja cancelar?" e o botão **Solicitar cancelamento**. Depois do envio: "Pedido de cancelamento enviado. A Wellmix vai responder." Corte para o operador: no alto do pedido, o alerta amarelo **Cliente pediu o cancelamento** com "Em {data}: {motivo}", sem formulário; na Control Tower, o quadrado **Pedido de cancelamento** mostra 1.
- 🎙 Narração: "O cliente pode pedir o cancelamento até o produto entrar em produção, e precisa dizer o motivo. A Wellmix vê o alerta no pedido e na Control Tower. Quem decide é o administrador."
- 🔤 Na tela: `[PASSO 5/6] Veja o pedido de cancelamento`; `[BOTÃO] "Solicitar cancelamento"`; `[SETA]` "Cliente pediu o cancelamento" no alerta; `[QUEM VÊ]` "O operador vê o alerta; só o administrador responde"; `[ERRO COMUM]` "O produto já entrou em produção: o cancelamento só pode ser tratado diretamente com a Wellmix." → "Depois da produção, o cliente fala com a Wellmix."
- ✂️ Edição: dois cortes de conta com legenda; `[ZOOM 150 %]` no alerta; 2 s no quadrado da Control Tower.

**Cena 8 · 3:20–4:05 · A decisão do administrador · `/app/orders/[id]`**

- 🎬 Imagem: conta do administrador. No alerta, o campo **Resposta ao cliente** e o botão **Recusar pedido de cancelamento**: escrever a resposta e clicar. O cliente passa a ver "A Wellmix recusou o cancelamento: …". Em seguida, num segundo pedido de cancelamento, rolar até o cartão **Cancelar pedido** (no fim da página): "Recebido do cliente: R$ 8.000,00 · Pago ao fornecedor: US$ 0,00", **Motivo** (Desistência do cliente, Problema com o fornecedor, Qualidade reprovada, Preço ou prazo, Outro), **Observação (opcional)**, **Acerto financeiro com o cliente (opcional)**, a caixa "Cancelar este pedido? As etapas abertas serão encerradas e todos serão avisados." e o botão **Cancelar pedido**.
- 🎙 Narração: "O administrador pode recusar, com uma resposta ao cliente, ou cancelar. Para cancelar, escolhe o motivo, registra o acerto financeiro, marca a confirmação e clica em Cancelar pedido. Nada é apagado."
- 🔤 Na tela: `[PASSO 6/6] Recuse ou cancele (administrador)`; `[BOTÃO] "Recusar pedido de cancelamento"`; `[BOTÃO] "Cancelar pedido"`; `[QUEM VÊ]` "Cancelar é só do administrador, em qualquer etapa"; `[ATENÇÃO]` "O portal não calcula devolução: o acerto financeiro é texto livre."
- ✂️ Edição: clique com onda; `[ZOOM 150 %]` no cartão "Cancelar pedido"; 3 s em "Acerto financeiro com o cliente (opcional)".

**Cena 9 · 4:05–4:30 · O que muda depois · `/app/orders/[id]` e `/app`**

- 🎬 Imagem: o pedido cancelado: selo "Cancelado" no topo, o aviso verde "Pedido cancelado." e a faixa vermelha "Pedido cancelado em {data} por {nome}. Estava na etapa: Pedido pré-aprovado. Motivo: Desistência do cliente". O cartão "Acerto financeiro com o cliente" com **Salvar acerto**. Na Control Tower, o quadrado **Cancelados no mês** soma 1.
- 🎙 Narração: "O pedido fica Cancelado, com o histórico e a etapa em que parou. As etapas abertas se encerram, ele sai dos containers e dos fretes em aberto, e todos são avisados. Se já tem número no Sankhya, cancele lá também."
- 🔤 Na tela: `[SETA]` "Estava na etapa: …" na faixa; `[SETA]` "Cancelados no mês" no quadrado; `[ATENÇÃO]` "Com número no Sankhya, cancele também no Sankhya."
- ✂️ Edição: `[CORTE]` para a Control Tower; 2 s nos números.

**Cena 10 · 4:30–4:45 · Depois e resumo**

- 🎬 Imagem: cartão `[DEPOIS]` e fundo vermelho com a lista.
- 🎙 Narração: "Resumindo: ache o atrasado, entenda o lembrete, resolva o bloqueado e leve o cancelamento ao administrador."
- 🔤 Na tela: `[DEPOIS]` "Cliente, fornecedor e parceiros recebem o aviso de cancelamento no sino."; `[RESUMO]` "1 Atrasados e Bloqueados na Control Tower · 2 Pendências e Painel de SLA · 3 Lembretes: Vence em breve e Atrasado · 4 Aprovar ou Reprovar o bloqueado · 5 Cancelamento: o administrador decide".
- ✂️ Edição: `[DEPOIS]` 4 s; fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** o cliente tenta cancelar depois que a produção começou. O portal mostra "O cancelamento não é mais possível pelo portal: o produto já entrou em produção." e o cartão diz "O produto já entrou em produção: o cancelamento só pode ser tratado diretamente com a Wellmix." → **Correção:** a Wellmix trata com o cliente; só o administrador cancela.
- **Erro:** cancelar um pedido já cancelado. O portal mostra "Este pedido já está cancelado." → **Correção:** abra o pedido e confira a faixa "Pedido cancelado em …".
- **Erro:** responder um cancelamento que não existe. O portal mostra "Não há pedido de cancelamento em aberto." → **Correção:** atualize a página; o pedido de cancelamento pode ter sido respondido por outro administrador.
- **Erro:** recusar sem escrever a resposta. A resposta é obrigatória (mínimo de 3 letras). → **Correção:** escreva a "Resposta ao cliente" e clique em "Recusar pedido de cancelamento".
- **Erro:** pedido cancelado não avança. Requisito, aprovação e desbloqueio são recusados. → **Correção:** se foi um engano, o cancelamento não tem botão de desfazer no portal: avise o administrador.
- **Aviso:** "Vence em breve" chega com o prazo ainda no futuro e "Atrasado" com o prazo vencido; os dois dizem o que falta: "Falta: …". → **Correção:** não é erro: abra pelo botão do aviso e resolva o item.

### Passo a passo em texto

1. Na **Control Tower**, no bloco **Problemas**, toque em **Atrasados** para ver o pedido, a etapa, o responsável e o prazo vencido. **Bloqueados** são as etapas paradas por divergência.
2. Em **Pendências**, filtre por **Prazo: Atrasadas** e veja "atrasada há N dias". No **Painel de SLA**, veja o que cada analista deve e os **Parceiros atrasados** para cobrar.
3. Entenda o lembrete: todo dia o portal avisa o responsável das etapas que vencem em até 1 dia (padrão) ou que já venceram, no máximo uma vez a cada 24 horas por etapa. O aviso é "Vence em breve: pedido #N, Etapa" ou "Atrasado: pedido #N, Etapa".
4. Para uma etapa bloqueada, abra o pedido e use **Aprovar** ou **Reprovar** no item "Revisão da divergência na inspeção (Wellmix)". **Liberar etapa** só reabre a etapa.
5. Quando o cliente pedir o cancelamento (até a produção começar), o pedido mostra **Cliente pediu o cancelamento** e a Control Tower soma em **Pedido de cancelamento**.
6. O administrador responde: **Recusar pedido de cancelamento**, com a **Resposta ao cliente**, ou **Cancelar pedido**, com o motivo, a observação e o acerto financeiro. O pedido fica **Cancelado**, com o histórico.

### Notas de gravação

- **Como envelhecer os prazos** (só em dados de demonstração): o portal não deixa mudar o prazo de uma etapa pela tela. Para a gravação, pare o servidor da gravação, edite as datas `dueAt` das etapas no arquivo `db.json` do diretório de dados (`DATA_DIR`), suba o servidor de novo e acione o job diário de lembretes uma vez. Nunca faça isso em dados de produção.
- O lembrete "Atrasado" chega ao responsável da etapa (aqui, o fornecedor da inspeção); "Vence em breve" chega a quem tem o item pendente (aqui, a Wellmix na conferência). Para mostrar os dois, grave os avisos em duas contas.
- A lista de Pendências da Wellmix também inclui itens que são do fornecedor ou de parceiros (por exemplo, as fotos da inspeção); isso é esperado, porque a Wellmix pode preencher qualquer requisito. Não use essa tela para explicar "o que é só seu".
- O Painel de SLA só mostra pendências para quem tem divisão (Equipe e divisões). Grave-o na conta do administrador, que enxerga "Sem responsável" com as pendências sem dono.
- Não use pedido de cancelamento de pedido real. O texto de acerto financeiro da demonstração ("Sinal de R$ 8.000,00 fica como crédito…") é inventado.
- O cartão "Cancelar pedido" só aparece para o administrador, no fim da página. No operador, ele não existe.

### Pontos a confirmar

- ⚠ **Pelo teste, o cliente vê itens internos** no cartão da etapa "Pedido pré-aprovado": "Número no Sankhya (opcional)" e "Conformidade: certificação obrigatória conferida", com a observação "Faltam: Inmetro" (tela do pedido da piscina). docs/SCOPE.md diz que o cliente não vê fornecedor, FOB, margem nem cotações; o Sankhya e a falta de certificação não estão listados, mas confirmar com o dono se devem aparecer ao cliente. Não filmar esse cartão na conta do cliente até decidir.
- ⚠ O aviso de "Vence em breve" para a Wellmix e "Atrasado" para o fornecedor foram vistos depois de rodar o job de lembretes uma vez; o intervalo de 24 h por etapa vem do código (`runReminders`). O agendador real (cron) só roda em produção; em demonstração, o job é acionado à mão.
- ⚠ Notificação de cancelamento: o texto exato que cliente, fornecedor e parceiros recebem não foi capturado. A cena 10 diz só que todos são avisados, como diz docs/WORKFLOW.md.
- ⚠ Se o operador (sem ser administrador) pode ver o botão **Recusar pedido de cancelamento**: no teste, ele viu só o alerta. A ação é restrita ao administrador no servidor (`rejectCancelRequestAction`).
- ⚠ Pedidos antigos, de antes do pagamento ao fornecedor sair do fluxo, têm regras de cancelamento próprias (docs/WORKFLOW.md). Não entram no roteiro.

---

## WLO-01 · Fretes e tarifário de frete

> **Promessa:** ao final do vídeo você responde um pedido de frete em nome da companhia, importa a planilha de frete, lê a conferência e o comparativo por porto e sabe onde o frete aparece no pedido.

| Ficha                 |                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner; as telas Fretes e Tarifário de frete abrem para as duas)                                                           |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; um corte curto com `armador@maritima.com` (tela em en) na cena 9                                                                  |
| Duração-alvo          | 4:15                                                                                                                                                                |
| Ponto da jornada      | Etapa 7 de 9: Embarque e mar                                                                                                                                         |
| Telas e rotas         | `/app/freight` (Fretes), `/app/freight/[id]` (pedido de frete), `/app/freight/tariff` (Tarifário de frete), cartão Embarque em `/app/orders/[id]`                      |
| Dados antes de gravar | Ponto `antes-WLO-01`: Inspeção concluída e Embarque aberta (WPE-04); pedidos de frete da jarra e de outro produto "Aguardando valor"; nenhuma planilha de tarifário importada. Arquivo `tarifario-demo.xlsx` (abas COMPARATIVO - NVT e ITJ, FORNECEDORES e PORTOS) com valores inventados |
| Depois deste vídeo    | O comparativo passa a mostrar o menor custo por porto, o "Frete pelo tarifário" aparece no cartão Embarque (WPE-05) e o frete por m³ do preço é atualizado                      |
| Antes · Próximo       | WPE-04 · WLO-02                                                                                                                                                     |
| Idiomas               | pt (base)                                                                                                                                                           |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/freight/tariff`**

- 🎬 Imagem: a tela **Tarifário de frete**, a tabela de custo por porto com as células verdes de menor custo e a coluna "Menor custo". O cursor passa pela célula verde de Ningbo.
- 🎙 Narração: "Qual companhia leva a carga mais barato? O tarifário responde por porto, em reais, com o mesmo câmbio para todas."
- 🔤 Na tela: `[TÍTULO]` "WLO-01 · Fretes e tarifário de frete"; `[ZOOM 150 %]` na célula verde.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz. Use a imagem do fim da gravação como abertura.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/freight/tariff`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapa 7, embarque e mar. Antes de reservar o navio, a Wellmix compara o frete das companhias e acompanha o pedido de frete de cada compra."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa; `[SETA]` "O tarifário é só da Wellmix".
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:55 · Pedidos de frete · menu Pedidos → Fretes → `/app/freight`**

- 🎬 Imagem: o cursor abre **Pedidos** e clica em **Fretes**. A tela **Cotações de frete**: "Pedidos de frete gerados quando o fornecedor envia a cotação. Informe o valor para a cotação já sair com o frete correto." A tabela traz Produto (com o selo "Aguardando valor"), Companhia marítima, Carga ("50 caixas · 3 m³ · 600 kg"), Responder até e Frete.
- 🎙 Narração: "Quando o fornecedor envia a cotação, a companhia marítima recebe um pedido de frete com a carga: caixas, volume e peso. Sem a resposta dela, o preço usa um frete estimado por metro cúbico."
- 🔤 Na tela: `[PASSO 1/6] Abra Pedidos → Fretes`; `[SETA]` "Aguardando valor: a companhia ainda não respondeu" no selo; `[SETA]` "Carga: caixas · m³ · kg" na coluna; `[QUEM VÊ]` "A companhia vê só a carga: nunca preço, fornecedor nem cliente."
- ✂️ Edição: `[CORTE]` seco para a tela; manter a tabela 3 s.

**Cena 4 · 0:55–1:30 · Informar o frete em nome da companhia · `/app/freight/[id]`**

- 🎬 Imagem: clicar no produto da jarra. A tela **Frete: Jarra de vidro 1,5 L** mostra "Características da carga" (Quantidade, Caixas master, Volume total (CBM), Peso bruto total, Peças por caixa, CBM por caixa, Medidas da caixa, Incoterm, Origem, Embalagem…). Abaixo, **Informar o frete**: "Valor do frete" (2.400,00), "Moeda" (Dólar (USD)), "Tempo de trânsito (dias)" (35), "Válido até" e "Observações (rota, transbordo, taxas inclusas)". Clicar em **Enviar frete**: aparece "Frete enviado à Wellmix." e a situação vira "Frete informado".
- 🎙 Narração: "Quem informa o frete é a companhia marítima. Se ela mandou por e-mail, a Wellmix registra em nome dela: valor, moeda, dias de trânsito e validade. Ao salvar, o valor entra no custo da cotação e fica na auditoria."
- 🔤 Na tela: `[PASSO 2/6] Informe o frete, quando for por ela`; `[BOTÃO] "Enviar frete"`; `[ERRO COMUM]` "Informe um valor de frete maior que zero." → "Digite o valor total do frete."; `[SETA]` "Frete enviado à Wellmix" no aviso verde.
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` na carga; pausa de 1 s no clique.

**Cena 5 · 1:30–2:05 · Importar a planilha · menu Pedidos → Tarifário de frete → `/app/freight/tariff`**

- 🎬 Imagem: o cursor abre **Pedidos** e clica em **Tarifário de frete**. O quadro **Importar planilha da companhia marítima**: "De quem é a planilha" (Escolha…, "Marítima SA", "Várias companhias (planilha consolidada)"), "Planilha (.xlsx ou .xlsm)", "Data de referência" e **Importar planilha**. Escolher "Marítima SA", o arquivo `tarifario-demo.xlsx`, e clicar em **Importar planilha**. A tela mostra "Planilha importada (Marítima SA): 6 tarifas de 3 companhias. O comparativo já usa ela."
- 🎙 Narração: "Cada companhia manda a própria planilha de estimativa de frete. Importe escolhendo de quem é; a nova substitui só a anterior daquela companhia. A planilha consolidada vale para quem ainda não mandou a sua."
- 🔤 Na tela: `[PASSO 3/6] Importe a planilha`; `[BOTÃO] "Importar planilha"`; `[SETA]` "Substitui só a anterior dela" em "De quem é a planilha"; `[ATENÇÃO]` "A planilha de demonstração tem valores inventados: nunca use tarifa de uma companhia real no vídeo."
- ✂️ Edição: `[CORTE]` na importação; `[ZOOM 150 %]` no aviso verde.

**Cena 6 · 2:05–2:40 · A conferência da planilha · `/app/freight/tariff`**

- 🎬 Imagem: o quadro amarelo **Conferência da planilha (7)**, com avisos como "NVT: na planilha, o total em R$ de BETA CARGO soma as taxas de ALFA LINES (1 rotas). O portal recalculou com as taxas da própria BETA CARGO.", "Porto SHENZHEN sem ID na aba PORTOS. Lá existe "SHENZEN" (ID 47)…" e "NVT: GAMA sem PTAX/IOF na planilha; o total dele fica sem esse acréscimo.". Abaixo, o quadro azul **Para saber (1)** (PTAX e IOF entram nos totais).
- 🎙 Narração: "O portal confere a planilha e aponta o que parece estranho: fórmula que soma as taxas de outra companhia, porto sem código, PTAX que faltou. Onde há erro de conta, ele recalcula e usa a conta dele."
- 🔤 Na tela: `[PASSO 4/6] Leia a conferência`; `[SETA]` "O portal recalcula e avisa" no primeiro aviso; `[DICA]` "A conferência sem avisos diz: 'Conferência sem avisos: os totais da planilha batem com a conta.'"
- ✂️ Edição: rolar devagar; 2 s por aviso, no máximo três avisos na imagem.

**Cena 7 · 2:40–3:20 · O comparativo · `/app/freight/tariff`**

- 🎬 Imagem: os quatro números do alto: **Tabela mais nova**, **Câmbio do comparativo** ("dólar do dia (PTAX de …) + spread da planilha da Wellmix, o mesmo para todas"), **Frete até o CD** e **Tarifas**. Depois o quadro **Destino** (NAVEGANTES, ITAJAÍ) e a tabela **Porto de origem** × companhia, com **Menor custo** em verde. Embaixo, **Taxas por companhia** (COURIER FEE/FREE, BL FEE/FREE, THD/THC, TRS, "Total das taxas (planilha)", "PTAX / IOF", "Taxas em R$ no embarque").
- 🎙 Narração: "O comparativo mostra, por destino e por porto de origem, o custo total de um container de quarenta pés em reais: frete e taxas em dólar, com câmbio, PTAX e IOF da companhia, mais o frete até o CD. Em verde, o menor custo."
- 🔤 Na tela: `[PASSO 5/6] Leia o comparativo`; `[ZOOM 150 %]` na tabela; `[SETA]` "Menor custo de cada porto" na coluna; `[SETA]` "Mesmo câmbio para todas" no número do câmbio.
- ✂️ Edição: manter a tabela 5 s em tela. Troca de destino por clique em ITAJAÍ (2 s).

**Cena 8 · 3:20–3:50 · Frete por m³ e CSV do Sankhya · `/app/freight/tariff`**

- 🎬 Imagem: o quadro **Frete por m³**: "Mediana do menor custo de 4 portos até NAVEGANTES: R$ … por container ÷ 68 m³ (40HC) = R$ … por m³." e "Hoje nas Configurações: …". O botão **Baixar CSV do Sankhya (AD_FREINT)** no alto. Corte: a lista **Importações** com companhia, referência, arquivo, tarifas, quem importou e "Vigente".
- 🎙 Narração: "O frete por metro cúbico do preço atualiza sozinho a cada tabela; se a variação passar de trinta por cento, o valor antigo fica até o administrador conferir. O botão Baixar CSV gera o arquivo para o Sankhya, sem macro."
- 🔤 Na tela: `[SETA]` "Atualiza o preço da vitrine e do valor ao cliente" no quadro; `[BOTÃO] "Baixar CSV do Sankhya (AD_FREINT)"`; `[QUEM VÊ]` "Aplicar o frete por m³ à mão é só do administrador"; `[ATENÇÃO]` "Linhas sem código (CODPARC) ou sem ID de porto ficam fora do CSV."
- ✂️ Edição: não abrir o CSV na imagem; `[ZOOM 150 %]` em "Frete por m³".

**Cena 9 · 3:50–4:05 · No pedido e na conta da companhia · `/app/orders/[id]` e `/app/freight/tariff`**

- 🎬 Imagem: o cartão **Embarque** do pedido, com o quadro **Frete pelo tarifário** e o botão **Importar planilha da companhia marítima**. Corte curto para a conta da companhia marítima (tela em en): o item do menu **Minha tabela de frete** (en: "My freight table") e o botão para enviar a planilha dela, sem comparativo.
- 🎙 Narração: "No pedido, o Embarque mostra o frete do tarifário para a rota daquela carga. A companhia marítima só vê o botão de enviar a tabela dela, em Minha tabela de frete."
- 🔤 Na tela: `[PASSO 6/6] Use o frete no pedido`; `[SETA]` "Frete pelo tarifário" no quadro; `[QUEM VÊ]` "A companhia vê só a própria tabela; as outras não"; `[DEPOIS]` "Com o frete definido, a Wellmix escolhe o container (WLO-02) e acompanha o embarque (WPE-05)."
- ✂️ Edição: corte de conta com legenda "Companhia marítima" no canto; `[DEPOIS]` por 4 s.

**Cena 10 · 4:05–4:15 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WLO-02.
- 🎙 Narração: "Resumindo: responda o pedido de frete, importe a planilha, leia a conferência e o comparativo. Agora, o container."
- 🔤 Na tela: `[RESUMO]` "1 Fretes: informe o valor em nome da companhia · 2 Tarifário: importe a planilha · 3 Leia a conferência · 4 Compare por porto · 5 Use o frete no pedido"; chamada "Próximo: WLO-02 · Containers: CBM, mix e ocupação".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** importar sem escolher o arquivo. O portal mostra "Escolha a planilha." → **Correção:** escolha o `.xlsx` ou `.xlsm`.
- **Erro:** planilha no formato antigo. O portal mostra "Formato .xls antigo: abra no Excel e salve como .xlsx ou .xlsm." → **Correção:** salve de novo no formato novo.
- **Erro:** planilha fora do modelo. O portal mostra "Não achei as abas "COMPARATIVO - NVT/ITJ/IOA" com a linha "USD POR 40HQ". Use a planilha modelo." → **Correção:** use o modelo da Wellmix, com as abas e a linha esperadas.
- **Erro:** planilha com senha. O portal mostra "A planilha está protegida por senha. Abra no Excel, tire a senha de abertura (Arquivo → Informações → Proteger pasta de trabalho) e envie de novo." → **Correção:** tire a senha e envie.
- **Erro:** arquivo grande. O portal mostra "Planilha grande demais (máximo 4 MB)." → **Correção:** reduza o arquivo.
- **Erro:** planilha sem câmbio ou vazia. O portal mostra "Não achei o câmbio (fica abaixo da lista de portos, na coluna dos portos)." ou "A planilha não tem nenhum frete preenchido." → **Correção:** preencha o câmbio e ao menos um frete.
- **Erro:** data de referência inválida. O portal mostra "Data de referência inválida." → **Correção:** informe uma data válida.
- **Erro:** valor de frete zerado no pedido de frete. O portal mostra "Informe um valor de frete maior que zero." → **Correção:** digite o valor total do frete.
- **Erro:** pedido de frete já encerrado. O portal mostra "Este pedido de frete já foi encerrado." → **Correção:** outro fornecedor foi escolhido ou a solicitação foi cancelada; nada a fazer.
- **Erro:** quem não é administrador tenta aplicar o frete por m³. O portal mostra "Sem permissão. Mudar o frete por m³ das Configurações é só do admin." → **Correção:** peça ao administrador.

### Passo a passo em texto

1. No menu **Pedidos**, clique em **Fretes**. Cada linha é um pedido de frete: produto, companhia, carga (caixas · m³ · kg), "Responder até" e o frete. "Aguardando valor" é o que ainda não foi respondido.
2. Para registrar o valor em nome da companhia, abra o produto, preencha **Valor do frete**, **Moeda**, **Tempo de trânsito (dias)** e **Válido até** e clique em **Enviar frete**. A Wellmix recebe o aviso e o valor entra no custo da cotação.
3. No menu **Pedidos**, clique em **Tarifário de frete**. Em **Importar planilha da companhia marítima**, escolha **De quem é a planilha**, o arquivo `.xlsx` ou `.xlsm` e a **Data de referência**, e clique em **Importar planilha**. A nova planilha substitui só a anterior daquela companhia.
4. Leia a **Conferência da planilha** e o quadro **Para saber**: eles apontam fórmulas, taxas, portos e PTAX/IOF que não batem.
5. No comparativo, escolha o **Destino** e leia o custo por porto de origem. Em verde está o **Menor custo** de cada porto. **Taxas por companhia** mostra a conta.
6. **Frete por m³** atualiza o preço sozinho a cada tabela (variação acima de 30% espera o administrador). **Baixar CSV do Sankhya (AD_FREINT)** gera o arquivo para o ERP.
7. No pedido, o cartão **Embarque** mostra o **Frete pelo tarifário** da rota da carga, com a companhia do pedido marcada.

### Notas de gravação

- A planilha `tarifario-demo.xlsx` foi montada com os valores de teste do projeto (ALFA LINES, BETA CARGO e GAMA, destinos Navegantes e Itajaí); todos os valores são inventados. Na gravação importamos tudo como "Marítima SA". Não use a planilha real de uma companhia nem mostre nomes de companhias reais.
- Depois da importação, o frete por m³ das Configurações muda sozinho (aqui, para R$ 325,77/m³) e a vitrine e o valor ao cliente passam a usar o novo valor. Restaure o ponto de salvamento depois de gravar, para não carregar esse número nos episódios seguintes.
- Os totais em reais dependem do câmbio do dia (PTAX); eles mudam a cada gravação. Mostre-os sem citar na narração.
- A tela da companhia marítima (en) mostra a conferência e o comparativo da própria planilha importada como dela, porque a gravação importou os três blocos no nome dela. Em produção, ela vê só o que enviou.
- O campo de data de referência segue o idioma do Chrome: grave em pt-BR para sair dd/mm/aaaa.
- Os números do pedido de frete (caixas, CBM, peso) vêm da ficha de compra; a carga da jarra aparece como "50 caixas · 3 m³ · 600 kg" no pedido de 1.200 un.

### Pontos a confirmar

- ⚠ A importação do tarifário **atualiza o frete por m³ das Configurações sozinha** (frase "Última atualização automática … aplicado"), inclusive quando quem importa é o operador. O texto da tela diz que "aplicar à mão é só do admin". Confirmar com o dono se a atualização automática por qualquer importador é desejada; a cena 8 descreve o que a tela mostra.
- ⚠ O pedido de frete criado quando o fornecedor envia a cotação gera uma linha por cotação (a piscina aparece duas vezes por causa de duas solicitações). A cena 3 mostra a lista como está.
- ⚠ O frete registrado em nome da companhia aparece como "Frete informado" e "Frete enviado à Wellmix", sem dizer que foi a Wellmix quem o registrou (a auditoria registra). Confirmar se a tela deve indicar isso.
- ⚠ Se a planilha de uma companhia nova precisa de cadastro prévio (a conferência diz "{companhia} não tem código do Sankhya… cadastre a companhia com o nome do bloco dela na planilha consolidada"). A cena 6 só lista avisos de exemplo.
- ⚠ Aviso no pedido quando não há tabela: "Nenhuma tabela de frete ainda. Cada companhia envia a dela pelo portal; você também pode importar." O texto aparece no cartão Embarque antes da importação; a cena 9 mostra o cartão já com a tabela.

---

## WLO-02 · Containers: CBM, mix e ocupação

> **Promessa:** ao final do vídeo você cria um container, coloca nele os itens dos pedidos do mesmo cliente, confere a ocupação em m³ e em quilos e entende a regra de não juntar clientes diferentes.

| Ficha                 |                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix · operador (funções comprador e planner; a tela Containers também abre para diretorias)                                                                       |
| Conta de gravação     | `operador@wellmix.com`, tela em pt; um corte curto com `admin@wellmix.com` na cena 5                                                                                    |
| Duração-alvo          | 4:15                                                                                                                                                                  |
| Ponto da jornada      | Etapa 7 de 9: Embarque e mar                                                                                                                                           |
| Telas e rotas         | `/app/containers` (lista e Novo container), `/app/containers/[id]` (o container), `/app/reviews` (Itens para revisão)                                                    |
| Dados antes de gravar | Ponto `antes-WLO-02`: dois pedidos da jarra de 6.000 un do mesmo cliente (Loja do João) e uma compra para estoque ("Estoque Wellmix"), todos fora de container. A caixa master e o CBM do produto preenchidos (WPE-02, "Atualizar cadastro do produto com esta ficha") |
| Depois deste vídeo    | O container carrega os dois pedidos; ao chegar, a mercadoria sem pedido alimenta o Estoque (WLO-03)                                                                    |
| Antes · Próximo       | WLO-01 · WPE-05 (e WLO-03)                                                                                                                                            |
| Idiomas               | pt (base)                                                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/containers/[id]`**

- 🎬 Imagem: a tela do container **MSKU4421907**, com o cartão **Ocupação**: a barra vermelha em 44 % e "30 / 68 m³ · 44,1%", e o peso "6.000 / 26.500 kg · 22,6%".
- 🎙 Narração: "Quanto cabe no container? O portal soma caixas, metros cúbicos e quilos de cada item e mostra a ocupação na hora."
- 🔤 Na tela: `[TÍTULO]` "WLO-02 · Containers: CBM, mix e ocupação"; `[ZOOM 150 %]` na barra de ocupação.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz. Use a imagem do fim da gravação como abertura.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/containers/[id]`**

- 🎬 Imagem: a mesma tela; o mapa da jornada aparece sobre ela.
- 🎙 Narração: "Etapa 7, embarque e mar. O container é o planejamento da carga que vai no mesmo navio, antes de ela sair da China."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:55 · Criar o container · menu Pedidos → Containers → `/app/containers`**

- 🎬 Imagem: o cursor abre **Pedidos** e clica em **Containers**. A tela **Containers** mostra a lista (Código, Tipo, Cliente, Situação, Ocupação, Caixas, Vendido / disponível) e, ao lado, o cartão **Novo container**: "Código" (dica: "Ex.: número do booking ou do container (MSKU1234567)."), "Tipo" ("40HC · 68 m³ · 26.500 kg"), "Cliente (opcional)", "ETD (saída prevista)", "ETA (chegada prevista)", "Observações". Digitar `MSKU4421907`, escolher o tipo e o cliente, as datas, e clicar em **Criar container**.
- 🎙 Narração: "Em Pedidos, Containers, preencha o código, o tipo, o cliente e as datas de saída e de chegada previstas. Os tipos e as capacidades vêm das Configurações; nada é fixo no código."
- 🔤 Na tela: `[PASSO 1/6] Crie o container`; `[BOTÃO] "Criar container"`; `[SETA]` "Tipo: capacidade em m³ e em kg" na lista; `[ERRO COMUM]` "A chegada prevista (ETA) não pode ser antes da saída prevista (ETD)." → "Corrija a data de chegada."
- ✂️ Edição: digitação em tempo real; `[CORTE]` para a página do container ao criar.

**Cena 4 · 0:55–1:30 · Adicionar os itens por pedido · `/app/containers/[id]`**

- 🎬 Imagem: no cartão **Adicionar item · Por pedido**, abrir a lista **Pedido ativo com item** ("#3 · Jarra de vidro 1,5 L · Loja do João Ltda (6.000 un)", "#4 · …"), deixar a **Quantidade** vazia e clicar em **Adicionar ao container**. Repetir com o outro pedido. A tabela **Itens no container** mostra Nome, Pedido, Cliente, Quantidade, Un/caixa, Caixas, CBM/caixa, CBM total, Peso (kg) e "Vendido / Disponível" ("Vendido").
- 🎙 Narração: "Escolha o pedido e adicione. A quantidade padrão é a do item do pedido; as caixas, o CBM e o peso vêm da ficha do produto. Cada item aparece com as caixas, o CBM total e o peso."
- 🔤 Na tela: `[PASSO 2/6] Adicione os itens por pedido`; `[BOTÃO] "Adicionar ao container"`; `[SETA]` "Caixa e CBM vêm da ficha do produto" nas colunas; `[ERRO COMUM]` "Informe o CBM por caixa (ou cadastre as dimensões da caixa na ficha do produto)." → "Preencha a caixa do produto ou digite o CBM por caixa."
- ✂️ Edição: manter a tabela 3 s com os dois itens; `[ZOOM 150 %]` em "CBM total".

**Cena 5 · 1:30–2:05 · O mix e a regra de consolidação · `/app/containers/[id]`**

- 🎬 Imagem: o título do container mostra "40HC · 68 m³ · 26.500 kg · Loja do João Ltda": o cliente foi definido pelo primeiro pedido. Tentar adicionar o pedido da compra para estoque ("#5 · … · Estoque Wellmix"): o alerta vermelho "Regra de consolidação: este container já é de outro cliente. Clientes diferentes não são juntados automaticamente; libere em Configurações (containerAllowMultiCustomer) se for uma consolidação manual." Corte para o administrador: em Configurações, o campo "Container com vários clientes".
- 🎙 Narração: "Vários produtos do mesmo cliente podem dividir o container. Clientes diferentes não são juntados automaticamente: o sistema recusa. Só o administrador, em Configurações, libera uma consolidação manual."
- 🔤 Na tela: `[PASSO 3/6] Respeite o cliente do container`; `[SETA]` "O primeiro pedido define o cliente" no subtítulo; `[QUEM VÊ]` "Liberar clientes diferentes é só do administrador"; `[ATENÇÃO]` "A mensagem cita o nome técnico containerAllowMultiCustomer: é a opção 'Container com vários clientes'."
- ✂️ Edição: `[ZOOM 150 %]` no alerta; 3 s em tela; corte de conta com legenda "Administrador".

**Cena 6 · 2:05–2:45 · A ocupação e o limite · `/app/containers/[id]` e `/app/reviews`**

- 🎬 Imagem: o cartão **Ocupação** com "CBM usado / capacidade", **Peso**, **Caixas**, **Capacidade**, **ETD** e **ETA**. Num container de estoque com mais carga, o aviso amarelo "Ocupação acima do máximo recomendado (95%): 96,4%." e a barra laranja. Corte para **Pedidos → Revisão**: o cartão "Container: acima da capacidade" ("Container … acima da ocupação permitida", Esperado "≤ 95% de 68 m³", Encontrado "96,4% (65,58 m³)", Responsável "Operador Wellmix", Ação necessária "Remover itens ou trocar o tipo de container."). Voltar, clicar em **Remover** no maior item: o aviso e o cartão da fila vão para Resolvidos.
- 🎙 Narração: "Passou de noventa e cinco por cento, o portal avisa e abre um item na fila de revisão. Acima da capacidade, ou do peso máximo, também. Remova itens ou troque o tipo de container, e o aviso se resolve sozinho."
- 🔤 Na tela: `[PASSO 4/6] Confira a ocupação`; `[SETA]` "Ocupação máxima recomendada: 95 %" no aviso; `[BOTÃO] "Remover"`; `[SETA]` "Esperado × encontrado" no cartão da fila; `[QUEM VÊ]` "A ocupação máxima é um parâmetro do administrador: 'Ocupação máxima do container (%)'."
- ✂️ Edição: `[CORTE]` entre as telas; manter 3 s no cartão da fila.

**Cena 7 · 2:45–3:15 · Vendido e disponível · `/app/containers/[id]`**

- 🎬 Imagem: o cartão **Visão comercial**: "Valor vendido", "Vendido (volume)" e "Disponível (volume)", com a nota "Disponível = itens sem pedido (estoque dentro do container). Só dados lançados; nada é estimado." Abaixo, o cartão **Adicionar item · Estoque / produto**: escolher um produto, digitar a quantidade e clicar em **Adicionar ao container**; a linha aparece como "Disponível".
- 🎙 Narração: "Item com pedido é vendido; item sem pedido é estoque dentro do container, e aparece como disponível. A visão comercial só soma o que foi lançado; nada é estimado."
- 🔤 Na tela: `[PASSO 5/6] Veja o vendido e o disponível`; `[SETA]` "Disponível: sem pedido, é estoque" no selo; `[BOTÃO] "Adicionar ao container"`; `[ATENÇÃO]` "Compra para estoque também aparece como 'Vendido' enquanto tiver pedido."
- ✂️ Edição: `[ZOOM 150 %]` no cartão; 2 s no selo "Disponível".

**Cena 8 · 3:15–3:50 · Mudar a situação · `/app/containers/[id]` e `/app`**

- 🎬 Imagem: no alto da página, a lista com Planejamento, Em carregamento, Embarcado, Chegou e Encerrado e o botão **Mudar situação**. Avançar até "Embarcado" e, depois, "Chegou". Na Control Tower, o quadrado **Containers abertos** mostra a contagem e a "Ocupação média"; ao lado, **Container para devolver**. No fim, tentar adicionar item a um container "Encerrado": "Container encerrado: não aceita mais itens."
- 🎙 Narração: "A situação do container segue a viagem: planejamento, carregamento, embarcado, chegou e encerrado. Container encerrado não aceita itens. Quando chega, a mercadoria sem pedido passa a contar no estoque."
- 🔤 Na tela: `[PASSO 6/6] Avance a situação`; `[BOTÃO] "Mudar situação"`; `[ERRO COMUM]` "Container encerrado: não aceita mais itens." → "Crie outro container."; `[DEPOIS]` "A mercadoria sem pedido de um container que chegou entra em 'No Brasil' no Estoque (WLO-03)."
- ✂️ Edição: `[DEPOIS]` por 4 s.

**Cena 9 · 3:50–4:15 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WPE-05 (ou do WLO-03, na trilha do planner).
- 🎙 Narração: "Resumindo: crie o container, adicione os itens do mesmo cliente, vigie a ocupação e avance a situação. Agora, o embarque do pedido."
- 🔤 Na tela: `[RESUMO]` "1 Crie o container · 2 Adicione itens por pedido · 3 Um cliente por container · 4 Vigie a ocupação (95 %) · 5 Avance a situação"; chamada "Próximo: WPE-05 · Embarque e desembaraço".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** juntar clientes diferentes. O portal mostra "Regra de consolidação: este container já é de outro cliente. Clientes diferentes não são juntados automaticamente; libere em Configurações (containerAllowMultiCustomer) se for uma consolidação manual." → **Correção:** use outro container, ou peça ao administrador para liberar "Container com vários clientes".
- **Erro:** produto sem caixa ou CBM. O portal mostra "Informe o CBM por caixa (ou cadastre as dimensões da caixa na ficha do produto)." ou "Informe o número de caixas (ou as unidades por caixa na ficha do produto)." → **Correção:** preencha os campos "Un/caixa", "Caixas" e "CBM/caixa" ou complete a ficha do produto.
- **Erro:** quantidade em branco num item sem pedido. O portal mostra "Informe a quantidade." → **Correção:** digite a quantidade.
- **Erro:** container encerrado. O portal mostra "Container encerrado: não aceita mais itens." → **Correção:** crie outro container.
- **Erro:** tipo desconhecido. O portal mostra "Tipo de container desconhecido. Cadastre em Configurações." → **Correção:** peça ao administrador para cadastrar o tipo.
- **Erro:** chegada antes da saída. O portal mostra "A chegada prevista (ETA) não pode ser antes da saída prevista (ETD)." → **Correção:** corrija as datas.
- **Aviso:** "Ocupação acima do máximo recomendado (95%): …", "Acima da capacidade: … m³ usados de … m³." e "Acima do peso máximo: … kg de … kg." → **Correção:** não bloqueiam; abrem um item em Revisão. Remova itens ou troque o tipo.

### Passo a passo em texto

1. No menu **Pedidos**, clique em **Containers**. No cartão **Novo container**, preencha **Código**, **Tipo**, **Cliente (opcional)**, **ETD** e **ETA** e clique em **Criar container**.
2. Abra o container. Em **Adicionar item · Por pedido**, escolha o **Pedido ativo com item** e clique em **Adicionar ao container**. Caixa, CBM e peso vêm da ficha do produto; preencha **Un/caixa · CBM/caixa · Peso (kg)** se a ficha não os tiver.
3. O primeiro pedido define o **cliente** do container. Pedidos de outro cliente são recusados; só o administrador libera ("Container com vários clientes", em Configurações).
4. Confira o cartão **Ocupação**: **CBM usado / capacidade** e **Peso**. Acima de 95 % (parâmetro "Ocupação máxima do container (%)"), da capacidade ou do peso máximo, o portal avisa e abre um item em **Pedidos → Revisão**. **Remover** um item resolve o aviso.
5. Em **Adicionar item · Estoque / produto**, adicione mercadoria sem pedido. Ela aparece como **Disponível** na **Visão comercial**; os itens de pedido, como **Vendido**.
6. Use **Mudar situação** para avançar: Planejamento, Em carregamento, Embarcado, Chegou e Encerrado. Um container encerrado não aceita mais itens.

### Notas de gravação

- Os números dos itens da jarra (24 peças por caixa, 0,06 m³ por caixa, 250 caixas e 15 m³ por pedido de 6.000 un) vêm da caixa master adotada da ficha de compra. Se o produto estiver sem caixa, o container pede os valores à mão. Grave depois de "Atualizar cadastro do produto com esta ficha" (WPE-02).
- Para a cena 6, monte um container de estoque com cerca de 96 % de ocupação (por exemplo, o item da compra para estoque mais um item "Estoque / produto" grande) e remova o item maior ao fim. Restaure o ponto de salvamento depois.
- A cena 5 pede um segundo "cliente": a compra para estoque ("Estoque Wellmix") serve, sem criar outro cliente.
- A lista de containers mostra "Vendido / disponível" em porcentagem do volume; o valor vendido e a conversão para a moeda do primeiro pedido aparecem no container. Não cite valores na narração.
- O tipo "40HC" vem de Configurações (20GP 28 m³, 40GP 58 m³ e 40HC 68 m³ no padrão). Confira antes de citar capacidades.

### Pontos a confirmar

- ⚠ A mensagem da regra de consolidação cita o nome técnico "containerAllowMultiCustomer" em vez do rótulo da tela ("Container com vários clientes"). A cena 5 explica o equivalente; confirmar se o texto será trocado.
- ⚠ O item de revisão de ocupação alta aparece com a regra "Container: acima da capacidade" mesmo quando a carga está entre 95 % e 100 % (o problema diz "acima da ocupação permitida"). Confirmar se o nome da regra deve mudar.
- ⚠ O cartão **Visão comercial** mostra "Valor vendido" (em R$) ao operador. docs/ACCESS.md diz que os valores em R$ de Operação e a "Comercial por container" da Control Tower são só de quem abre Financeiro. Confirmar se o container deve esconder o valor do operador; a cena 7 não cita o número.
- ⚠ Compra para estoque entra como "Vendido" na visão comercial (pedido da empresa interna "Estoque Wellmix"). Confirmar se o estoque da Wellmix deve contar como "Disponível" desde o pedido.
- ⚠ O texto do pedido pelo item de estoque sem pedido: o cliente mostrado é "Estoque" para item sem pedido e "Estoque Wellmix" para o item do pedido de estoque. Confirmar se é o mesmo conceito.

---

