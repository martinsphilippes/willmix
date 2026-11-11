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

