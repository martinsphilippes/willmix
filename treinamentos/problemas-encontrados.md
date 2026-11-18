# Problemas encontrados na plataforma

Só entra aqui o que eu vi acontecer na tela, com os passos para repetir e a captura. O que veio só da leitura da documentação e do código está no `00-mapa-de-papeis.md` (seções 6 e 7), marcado como "a confirmar".

Nenhum fluxo quebrou até agora. Nada foi disfarçado em gravação. Os itens abaixo são comportamentos que confundem quem aprende ou textos de tela que não batem com o que a tela faz; todos esperam decisão do dono.

## 001 · Cliente entra e cai numa tela que o menu não mostra

- **Onde:** login do cliente.
- **Passos:** abrir `/login`, entrar com `joao@lojista.com` (conta de demonstração, modo memória).
- **O que acontece:** o portal abre em `/app/explore` (a vitrine). O menu lateral dele tem só "Pendências" e "Pedidos"; a vitrine não está no menu.
- **O que a documentação diz:** `src/lib/nav.ts` tira a vitrine do menu de todos ("a vitrine ainda não abriu"); o teste E2E do caminho principal espera exatamente este redirecionamento.
- **Efeito no treinamento:** não dá para ensinar "o início do cliente" sem decidir qual das duas coisas vale. Proposta: deixar o papel Cliente para quando a vitrine abrir.
- **Captura:** `_problemas/001-cliente-inicio-vitrine.png`

## 002 · O aviso do convite continua como "Sua vez" depois de o fornecedor enviar o book

- **Onde:** Notificações (sino) do fornecedor.
- **Passos:** a Wellmix convida o fornecedor A a enviar o book de um item (Seleção de itens, "Convidar"). O fornecedor entra (`supplier.a@china.com`), abre a pendência "Enviar book concorrente", envia a planilha no modelo e volta. Depois abre o sino. Para repetir sem refazer tudo: `node _demo/problema-002.mjs` (parte do ponto `forn-m1-s2`, com o book já enviado).
- **O que acontece:** o convite saiu de "Minhas pendências" (o contador do menu cai de 2 para 1) e a tela "Convites de book" mostra "Book enviado". Mas em Notificações o aviso "Convite de book nº 1" continua em "Precisa de você", com o selo "Sua vez" e "Agora é com você", e o sino continua contando 2. O botão "Resolver" leva de volta a um convite já respondido.
- **O que a tela diz:** "Aviso resolvido (lido) sai da lista". Ou seja, o aviso só sai quando a pessoa clica em "Resolver" ou "Excluir", não quando a tarefa é feita por outro caminho. Pode ser de propósito; registro porque o selo "Sua vez" fica dizendo que depende do fornecedor quando já não depende, e o número do sino deixa de bater com o de Pendências.
- **Efeito no treinamento:** nenhum disfarce. A cena dos avisos (capítulo 4) foi gravada antes do envio do book, quando os dois avisos de fato dependem do fornecedor. O vídeo ensina a começar por Pendências, que é a lista que bate.
- **Captura:** `_problemas/002-aviso-do-convite-continua-sua-vez.png`

## 003 · O aceite do pedido de amostras aparece em Pendências com o título de outra tarefa

- **Onde:** Minhas pendências do fornecedor, depois que a Wellmix gera o pedido de amostras.
- **Passos:** ponto `forn-m4-contrato` (`node _demo/caminho-fornecedor.mjs m4-contrato`), entrar como `supplier.a@china.com`, abrir `/app`.
- **O que acontece hoje (18/11/2026, `wellmix` 7f6352b):** chegam duas linhas iguais, "Pedido #1: Assinar o pedido", com o mesmo detalhe ("Assine o documento do pedido no portal ou envie o PDF assinado.") e a mesma etapa. Só o destino muda: uma abre a página do pedido (onde está o item "Pedido de amostras aceito pelo fornecedor", com o botão "Pedido de amostras"), a outra abre o documento do pedido. No pedido filho da compra programada acontece o mesmo.
- **Antes (15/11/2026):** a linha do aceite vinha como "Pedido #1: Aprovar a arte", com o texto da arte da embalagem.
- **Efeito no treinamento:** o Módulo 4 (`m4-c2-amostras`) e o Módulo 9 (`m9-c3-pai`) dizem com todas as letras que as duas linhas têm o mesmo título e que a do aceite é a que abre a página do pedido. Se o título for corrigido, regravar essas duas cenas e trocar o alvo (`LINHA_AMOSTRAS` em `fornecedor/modulos/m4.py`, `LINHA_FILHO` em `m9.py`).

### 003 (registro de 15/11/2026)

- **Onde:** Minhas pendências do fornecedor, depois que a Wellmix gera o pedido de amostras.
- **Passos:** ponto `forn-m4-contrato` (`node _demo/caminho-fornecedor.mjs m4-contrato`), entrar como `supplier.a@china.com`, abrir `/app`.
- **O que acontece:** a pendência do aceite vem com o título "Pedido #1: Aprovar a arte", o detalhe "Confira a arte da embalagem e aprove, ou reprove dizendo o que mudar." e a etapa "Aprovar a arte". O "Abrir" leva ao pedido, não à tela do pedido de amostras. No pedido, o item pendente é "Pedido de amostras aceito pelo fornecedor", com o botão "Pedido de amostras".
- **Efeito no treinamento:** o Módulo 4 mostra como é hoje e diz isso com todas as letras ("hoje ela aparece na lista com o título Aprovar a arte"). Se o título for corrigido, regravo a cena `m4-c2-amostras`.
- **Texto de ajuda da etapa:** dentro do pedido, o cartão "Contrato e assinaturas" ainda explica o fluxo antigo ("O fornecedor confere e aprova para produzir, ou reprova com observação"). No pedido de compra de hoje o fornecedor não aprova a arte: quem valida é a Wellmix (item "Validação da arte pela Wellmix"). Um revisor independente leu a tela e entendeu que faltava ensinar a aprovação da arte.
- **Captura:** `_problemas/003-aceite-das-amostras-aparece-como-aprovar-a-arte.png`

## 004 · Documento do pedido (contrato): código interno, MOQ e prazo em branco, "Opção 2" sem opção 1

- **Onde:** `/app/orders/<id>/purchase-order`, visto pelo fornecedor na vez dele de assinar.
- **Passos:** ponto `forn-m4-contrato`, entrar como o fornecedor, Pendências → "Pedido #1: Assinar o pedido" → "Abrir".
- **O que acontece:**
  - em "Suas pendências neste pedido" aparece "Pedido #1: PACKAGING" (o código interno da etapa);
  - "Pedido mínimo (MOQ)" e "Prazo de produção" saem com "—", mesmo depois de o fornecedor confirmar 1.200 peças e 35 dias no Die Cut;
  - o formulário de envio se chama "Opção 2: enviar o documento assinado" e não existe opção 1 nesta tela;
  - a pendência em `/app` diz "Assine o documento do pedido no portal ou envie o PDF assinado", e no pedido de compra só existe o envio do arquivo.
- **Suposição (leitura do código, não testada):** a tela busca o MOQ na ficha de compra do fluxo antigo, e o prazo fica sempre vazio.
- **Efeito no treinamento:** o vídeo manda conferir produto, quantidade, preço, total e condição de pagamento (o que a tela mostra preenchido) e não cita o MOQ nem o prazo nesta tela.
- **Captura:** `_problemas/004-contrato-packaging-e-moq-em-branco.png`

## 005 · A pendência "Produção e inspeção" continua depois de o fornecedor enviar tudo

- **Onde:** Minhas pendências e o passo Produção → Inspeção do fornecedor.
- **Passos:** ponto `forn-m5-enviado` (fotos, peso, vídeo e declaração já enviados), entrar como o fornecedor, abrir `/app`.
- **O que acontece:** a pendência "Pedido #1: Produção e inspeção" segue na lista. O passo Produção → Inspeção lista os 9 itens marcados "(opcional)" como "O que espera".
- **Efeito no treinamento:** o Módulo 5 explica que os itens opcionais continuam aparecendo e que a vez passa à Wellmix depois da declaração.
- **Captura:** `_problemas/005-pendencia-continua-depois-de-enviar-tudo.png`

## 006 · Textos e números fora do padrão na Conta corrente e na pendência do pagamento

- **Onde:** Minhas pendências e Conta corrente do fornecedor, ponto `forn-m4-pagamento`.
- **O que acontece:**
  - a pendência mostra "USD 1,569.60" (ponto e vírgula no padrão inglês); na Conta corrente o mesmo valor é "US$ 1.569,60";
  - a Conta corrente diz "confirme o recebimento na lista acima", e a lista com o botão fica abaixo;
  - no Histórico, o registro sai colado e sem formato: "Pagamento registradoUSD 1569.6".
- **Capturas:** `_problemas/006-valor-em-formato-ingles-na-pendencia.png`, `_problemas/006-conta-corrente-lista-acima.png`

## 007 · Seleção de itens: a cesta não esvazia depois de "Agrupar" (lado da Wellmix)

- **Onde:** Seleção de itens, login da Wellmix (visto ao montar os dados da trilha).
- **Passos:** como `operador@wellmix.com`, buscar "jar", marcar todos, "Agrupar" e abrir a solicitação; depois buscar "350": a cesta ainda guarda os dois potes, e a solicitação seguinte nasce com eles como alternativas. Trocar de login na mesma aba também não esvazia.
- **Efeito no treinamento:** nenhum na trilha do Fornecedor (ele não vê as alternativas). O preparo de dados passou a clicar em "Limpar" antes de cada grupo. Vale para o treinamento do Comprador.

## 008 · Outros pontos vistos nas telas do fornecedor (sem efeito nos vídeos)

- Container vazio: o passo "Fotos e vídeos do container vazio" guarda um arquivo só; "Enviar de novo" troca o anterior.
- Cartão Produção: o "Início da produção" vem fechado para o fornecedor ("Automático: dia do contrato assinado"); ele só escolhe Fábrica ou Trade e o ETD.
- A agência de marketing já tem o botão "Enviar" da devolução da amostra antes de as fotos reais serem aprovadas (não cliquei; só vi o botão).

## 009 · "Ficha de compra" fica "Em andamento · Faltam 4 campos" até o embarque

- **Onde:** tela do pedido (tabela "Etapas do pedido") e `/app/orders/<id>/purchase-sheet`, login do fornecedor.
- **Passos:** qualquer ponto do pedido, por exemplo `forn-fim` (tudo do fornecedor feito). Abrir o pedido #1 e clicar em "Abrir" na linha "Ficha de compra".
- **O que acontece:** a linha mostra "Ficha de compra · Em andamento · Wellmix e fornecedor · Faltam 4 campos" do começo ao fim do pedido. Na ficha, os quatro campos que faltam são "FOB / EXW", "Moeda", "Preço por peça" e "MOQ", todos já negociados na solicitação (USD 2,18, FOB, 1.200 peças). O fornecedor pode preencher e salvar, mas nenhuma pendência pede isso e o pedido chega ao embarque sem a ficha.
- **Efeito no treinamento:** o Módulo 5 diz, ao mostrar a tabela, que a linha aparece em andamento e não gera pendência para o fornecedor. Não ensino a preencher a ficha.
- **Decisão do dono:** no pedido de compra, o fornecedor deve preencher a Ficha de compra? Se sim, vira um capítulo do Módulo 4. Se não, a linha poderia sair da visão dele ou vir preenchida com a negociação.
- **Captura:** `_problemas/009-ficha-de-compra-faltam-campos.png`

## 010 · A pendência do packing list continua depois de o packing list ser conferido

- **Onde:** Minhas pendências do fornecedor, documentos do embarque.
- **Passos:** ponto `forn-m7-base`; fazer o check list de carga (200 caixas) e enviar o packing list; voltar a `/app`.
- **O que acontece:** o packing list fica "Conferido", mas a linha "Packing list: pedido #1 · A carga está completa. Confira peças e pesos e envie o packing list." segue na lista, ao lado da nova "Invoice: pedido #1". Só some quando a invoice é aceita. Pela leitura do código (`shippingDocTasks`), a pendência existe enquanto o fornecedor ainda pode reenviar o documento, e não enquanto falta enviar.
- **Efeito no treinamento:** o Módulo 7 avisa que a linha continua na lista até a invoice ser enviada.
- **Captura:** `_problemas/010-pendencia-do-packing-list-continua.png`

## 011 · O contrato da compra EXW diz FOB

- **Onde:** Documento do pedido (o que o fornecedor assina), numa compra respondida com "Modalidade de entrega: EXW".
- **Passos:** `node _demo/caminho-fornecedor-extras.mjs exw-solicitacao..exw-contrato`, entrar como o fornecedor, abrir "Assinar o pedido".
- **O que acontece:** o documento mostra "Total FOB USD 3.398,40" e, na folha do pedido, "Incoterm: FOB". Não cita EXW, embora a solicitação mostre "1,18 USD EXW" e a Wellmix veja "INCOTERM: EXW" no pedido. O resto do fluxo trata o pedido como EXW (os três passos do transporte na origem aparecem).
- **Suposição (leitura do código, não testada):** o texto do documento viria do item do book, e não da resposta do fornecedor (`src/lib/services/order-signature.ts`).
- **Efeito no treinamento:** o Módulo 9 mostra a modalidade na resposta e os passos do transporte na origem; não mostra o contrato da compra EXW.
- **Captura:** `_problemas/011-contrato-exw-diz-fob.png`

## 012 · Compra programada: o pedido pai aparece com contrato e parcelas próprias

- **Onde:** Conta corrente, Pedidos e Documento do pedido, login do fornecedor, numa compra com duas programações.
- **Passos:** `node _demo/caminho-fornecedor-extras.mjs prog` (pontos `forn-prog-nascido` e `forn-prog-filhos`).
- **O que acontece:**
  - A Conta corrente soma o pai e o filho: TOTAL US$ 4.968,00 = pai #1 (US$ 3.312,00, as 3.600 peças) + filho #2 (US$ 1.656,00, as 1.800 da primeira programação). O pai tem parcelas próprias (1/2 US$ 993,60), ao lado das do filho. Com o segundo filho, o total passaria do contratado (suposição: só vi o caso com um filho).
  - O cartão do pai diz que ele "não vai a contrato nem produção", mas o Documento do pedido #1 aparece como "Pronto para assinatura: esperando a Wellmix", com 3.600 peças.
  - A lista "Pedidos" mostra #1 e #2 sem marca de pai ou filho; o pai segue "Em andamento".
  - A folha do pedido filho diz "Rodada 1 de 2", e as telas dizem "programação".
- **Efeito no treinamento:** o Módulo 9 mostra a solicitação com as programações, o pedido filho e o cartão "Programação de compra" do pai. Não mostra a Conta corrente nem o documento do pai.
- **Capturas:** `_problemas/012-conta-corrente-soma-pai-e-filho.png`, `_problemas/012-pedido-pai-mostra-contrato.png`

## 013 · Textos de tela a acertar (vistos na revisão dos vídeos)

- "Trading": a tela chama o fornecedor de "trading" nas amostras ("Devolução da amostra à trading") e nos documentos ("3. Invoice (trading)"), sem explicar. O Módulo 6 explica.
- Inglês no meio do português: "Follow da produção" e a coluna "FOLLOW"; a "Folha do pedido (modelo Wellmix)" inteira ("Order issued by", "Payment Condition").
- Nome de sistema interno para o fornecedor: selo "Assinado pelos dois: pedido autorizado, falta gerar no Sankhya".
- Concordância: "RODADAS ANTERIORES · 1 ARQUIVOS"; "Primeiro ETD: 20/12/2026 (1 dias de diferença)".
- Custos de origem (EXW): o campo do valor traz "Valor (R$)" de fundo com a moeda em USD. O Módulo 9 avisa.
- O aviso verde "Enviado." ou "Validado." repete em cartões onde nada foi enviado ("Amostras", "Embarque e desembaraço").
- Inspeção: "Responsável: Operador Wellmix" no alto, com todos os itens "Pendente · Fornecedor" logo abaixo.
- Inspeção cega: o portal aceita qualquer peso sem avisar (digitei 6,2 kg no lugar de 0,62). O Módulo 5 mostra isso e ensina a "Nova medição".
- Lado da Wellmix: no cartão do container, "Faz: importFlow.actor.comex_internal" (chave de texto crua).
- Dado de demonstração da plataforma com domínio que existe de verdade: o transitário aparece como "Cargo Agentes de Carga · agente@cargo.com" na folha do pedido. Vale trocar por um domínio de exemplo (`.example`).
- Conta corrente, "Resumo por pedido": a coluna "A confirmar" mostra US$ 0,00 com um pagamento de US$ 1.569,60 esperando a confirmação do fornecedor (não sei se é o esperado para essa coluna).
- Produção: "Automático: dia do contrato assinado mais 0 dia(s) (prazo do fornecedor)" sob o início da produção.
- Inspeção: a linha "Vídeo da produção" oferece o botão "Tirar ou escolher foto" (o vídeo entra por "Escolher arquivo"); depois de uma reprovação, a etapa mostra 86% ao lado de "0 de 16".
- Inspeção e documentos: números com ponto ("0.62" kg; preço "2,18" no campo e "2.18" depois de conferido).
- Amostras: "Validar Devolução" com D maiúsculo; "Enviado por — · 15/11/2026" no passo da agência; "4 × 3 × Nm" sem explicação no cartão.
- Documentos do embarque: depois de enviado, o arquivo do packing list não aparece em lugar nenhum; a invoice devolvida passa a mostrar "Arquivo (opcional)", embora o arquivo seja obrigatório no primeiro envio.

## 014 · Documentos do embarque: cabeçalhos desalinhados dos campos

- **Onde:** `/app/orders/<id>/shipping-docs`, formulários do packing list e da invoice (login do fornecedor).
- **Passos:** ponto `forn-m7-base`, fazer o check list (200 caixas) e abrir o packing list.
- **O que acontece:** nas tabelas com campos, cada cabeçalho fica à direita da coluna e o campo à esquerda. O campo parece estar sob o cabeçalho anterior: no packing list, "PEÇAS" fica logo antes do campo do peso líquido (1488) e "PESO BRUTO (KG)" fica sem nada embaixo; na invoice, "PREÇO POR PEÇA (USD)" fica vazio. Depois de conferido, os números alinham certo. Quem achou foi o revisor independente dos quadros do Módulo 7.
- **Suposição (leitura do código, não testada):** a célula tem alinhamento à direita e o campo ocupa a linha inteira (`src/app/app/orders/[id]/shipping-docs/page.tsx`).
- **Efeito no treinamento:** o Módulo 7 destaca a linha inteira e fala os campos na ordem em que aparecem. Se a tela for corrigida, regravo as cenas `m7-c2-packing` e `m7-c3-invoice`.
- **Captura:** `_problemas/014-colunas-desalinhadas-nos-documentos.png`


## 015 · Agência: a pendência da arte sai com o título de outro marco e com o tipo em código

- **Onde:** Minhas pendências da agência de arte.
- **Passos:** ponto `arte-base` (`node _demo/caminho-arte-certificacao.mjs arte-base`), entrar como `agencia@design.com`, abrir `/app`.
- **O que acontece:** a linha da arte vem com o título "Pedido #1: 2. Certificação" (o marco atual do pedido), embora a tarefa seja do marco 4, Arte; o que identifica a tarefa é a coluna "Detalhe" ("Arte · Glass jar 1.5L with lid"). Na coluna "Tipo" aparece a chave interna `stage.agency.art`, e não o nome da etapa ("Arte do pedido"). A pendência do selo sai certa ("Selo na arte"). O mesmo título vale para a certificadora ("Pedido #1: 2. Certificação" na linha do certificado; ali o marco coincide).
- **Efeito no treinamento:** nada foi escondido. A narração manda ler a coluna "Detalhe" e não cita o título nem o tipo. Se o texto for corrigido, regravo as cenas `m1-c1-pendencias`, `m1-c2-arte` e `m2-c2-final` da agência.
- **Captura:** `_problemas/015-agencia-pendencia-da-arte.png`

## 016 · Parceiros: todo marco do pedido abre com o texto de ajuda da ficha de compra

- **Onde:** detalhe do pedido, seção "Marcos do pedido", visto pela agência de arte e pela certificadora.
- **Passos:** ponto `arte-base`, entrar como `agencia@design.com` (ou `ocp@certifica.com`), abrir o pedido #1.
- **O que acontece:** dentro de cada marco aberto (Pedido novo, Certificação, Material de arte, Arte) aparece a mesma frase: "Fornecedor preenche a ficha de compra (dados da planilha de compras: fornecedor, preço, caixa, pesos, medidas, programação e fotos, com a foto na balança). O peso líquido por peça da ficha é o peso comparado na inspeção." A frase é da etapa antiga "Preparação" e não tem relação com a arte nem com a certificação.
- **Efeito no treinamento:** a frase aparece nos vídeos, porque está na tela. A narração não a cita.
- **Captura:** `_problemas/016-agencia-texto-da-ficha-nos-marcos.png`

## 017 · "Formato não aceito" cita só foto e PDF, mas a linha aceita arquivo de arte

- **Onde:** itens de arquivo dos marcos (arte, arte final, certificado).
- **Passos:** ponto `arte-base`, agência, pedido #1, linha "Arte · Glass jar 1.5L with lid", "Escolher arquivo" com um vídeo (`_demo/arquivos/amostra-3d-video.mp4`).
- **O que acontece:** o portal volta com "Formato não aceito: envie foto (JPG, PNG, WEBP, HEIC) ou PDF." A mesma linha aceita PSD (testei com um arquivo .psd: ficou "Concluído"), e `ALLOWED_MIME` (`src/lib/services/documents.ts`) aceita também AI/EPS, CDR, TIFF, SVG, planilha e ZIP. A mensagem diz menos do que o portal aceita.
- **Efeito no treinamento:** as cenas "Cuidado" mostram a mensagem como ela é. A narração diz o que é verdade ("vale PDF, imagem ou o arquivo aberto da arte"), e o guia rápido avisa que o aviso cita só foto e PDF.
- **Captura:** `_problemas/017-formato-nao-aceito.png`

## 018 · Avisos e textos da certificação e da agência que não batem com quem faz

- **Onde:** Notificações e Minhas pendências da agência de arte.
- **O que aparece:**
  - o aviso "Pedido #1: selo de certificação disponível" diz "O despachante enviou o selo de certificação", mas só a certificadora envia o selo (docs/CERTIFICATION.md, seção 14);
  - o aviso do selo recusado termina com dois pontos seguidos: "…envie de novo.. Corrija e envie de novo.";
  - a introdução das pendências da agência diz "da arte na cotação até o selo" (a arte na cotação saiu com a RFQ), e a dica da etapa "Arte do pedido" diz "se o fornecedor reprovar" (no pedido de compra quem valida e devolve é a Wellmix);
  - depois de a arte reprovada ser reenviada, a linha "Arte" fica "Concluído" e continua mostrando o motivo antigo ao lado da versão nova.
- **Efeito no treinamento:** nenhum disfarce; a narração diz quem faz cada coisa de verdade (a certificadora envia o selo; a Wellmix valida a arte).
- **Captura:** `_problemas/018-aviso-do-selo-cita-o-despachante.png`

## 019 · A arte com o selo é pedida em dois lugares

- **Onde:** pedido de compra com certificação, visto pela agência de arte.
- **O que acontece:** a mesma arte com o selo é enviada duas vezes: no passo "Selo aplicado na arte" do cartão Certificação (a Wellmix valida ou recusa) e na linha "Arte final com o selo" do marco Arte (conclui ao enviar). `docs/CERTIFICATION.md`, seção 12, já lista a unificação como melhoria futura.
- **Efeito no treinamento:** o Módulo 2 da agência ensina os dois envios e diz com todas as letras que hoje o portal pede o arquivo nos dois lugares. Se virar um envio só, regravo `m2-c1-selo` e `m2-c2-final`.

## 020 · Mesa de trabalho: o botão não aparece na primeira tela do parceiro

- **Onde:** Minhas pendências da agência de arte e da certificadora.
- **O que acontece:** o menu "Pendências" abre `/app`, que não tem o botão "Mesa de trabalho". O botão só aparece em `/app/tasks`, aonde se chega clicando em "Todas as etapas" (agência) ou num filtro de prazo (certificadora). `docs/DESKS.md` diz "Pendências → Mesa de trabalho".
- **Efeito no treinamento:** os vídeos mostram o caminho que funciona hoje (o clique no filtro e depois o botão).

## 021 · Dois prazos para a mesma tarefa: um na lista de pendências, outro no marco do pedido

- **Onde:** Minhas pendências e detalhe do pedido, vistos pela agência de arte e pela certificadora.
- **Passos:** ponto `arte-base`, agência: a pendência da arte mostra "20/11/2026 · vence em 5 dias"; no pedido, o marco "4 · Arte" mostra "Prazo: 16/11/2026". Ponto `cert-base`, certificadora: a pendência do certificado mostra "30/11/2026 · vence em 15 dias"; o marco "2 · Certificação" mostra "Prazo: 16/11/2026".
- **O que parece ser:** a lista usa o prazo da tarefa (5 dias da arte, 15 do certificado) e o cabeçalho do marco usa o prazo do marco. Para quem aprende, são duas datas para a mesma coisa, sem explicação na tela.
- **Efeito no treinamento:** a narração fala do prazo da lista de pendências e não cita a data do marco.

## 022 · Tela do passo (Arte, Certificação): códigos internos e o marco atual errado

- **Onde:** `/app/flow/order/art` e `/app/flow/order/certification`, vistos pelos parceiros.
- **O que aparece:** o subtítulo traz os códigos do mapa do processo ("Arte, validação da Wellmix e arte final com o selo (P5, P5?, P7)."; "Certificação com o OCP e o selo, quando a linha exige (P6, P8, P15)."). Na tela aberta pelo "Resolver", o quadro do pedido diz "Marco atual: 1. Pedido novo" mesmo com o pedido no marco da arte. Na lista "Pedidos", o marco atual também fica "1. Pedido novo" com o progresso "Preparação, arte e certificação".
- **Efeito no treinamento:** aparece nos vídeos, porque está na tela; a narração não cita.

## 023 · Mais textos e números da certificação que não batem

- **"O despachante trocou o selo":** quando a certificadora usa "Substituir arquivo" no selo e a arte com o selo já tinha sido enviada, o passo da agência volta como "Recusado: O despachante trocou o selo (o arquivo ou o número). Aplique o selo atual na arte e envie a arte de novo." Quem troca é a certificadora. (Conferido na tela: ponto `arte-final-s1`, certificadora troca o selo, agência abre o pedido.)
- **Marco "Certificação" em andamento com 100%:** para a agência, depois da arte final enviada, o marco 2 aparece "Em andamento · 100% · 1 de 1".
- **Botão "Enviar de novo" antes de qualquer recusa:** no passo "Selo aplicado na arte", logo depois do primeiro envio (situação "Enviado, aguardando validação"), o botão já se chama "Enviar de novo".
- **Horário das mensagens:** a mensagem enviada em Mensagens sai com um horário duas horas atrás do horário dos avisos da mesma sessão (parece fuso diferente entre as duas telas).
- **Ficha de compra com campos em branco:** a certificadora abre a ficha de compra com Data, Peso médio, FOB/EXW, MOQ e medidas da caixa em branco, embora o marco diga "Ficha mestre completa · Concluído" (são fichas diferentes; para quem certifica, faltam as medidas).
- **Efeito no treinamento:** a narração diz só o que a tela mostra (por exemplo, "o botão desta linha é Enviar de novo"; o bloco da caixa "traz as peças por caixa e o tipo de embalagem").

## 024 · Avisos antigos continuam como "Sua vez" depois da tarefa feita (agência e certificadora)

- Igual ao problema 002 do fornecedor: o aviso só sai de "Precisa de você" quando a pessoa clica em "Resolver", "Excluir" ou marca tudo como lido, e não quando a tarefa é feita por outro caminho. Na primeira gravação, a tela de Notificações da agência chegou a mostrar cinco avisos "Sua vez", quatro deles de tarefas já feitas.
- **Efeito no treinamento:** o caminho de dados passou a marcar os avisos como lidos depois de cada tarefa (`lerAvisos`, o botão "✓ N" da tela), como faz quem usa o sino no dia a dia. As cenas mostram só os avisos do momento.

## 025 · O cartão Produção (ETD) não gera pendência, e o Planner aprova a pré-produção antes dele

- **Onde:** pedido de compra, depois do sinal (Fase 5g dos marcos, motor sem etapas).
- **Passos:** ponto `forn-m4-pagamento`; o fornecedor confirma o recebimento do sinal; a Wellmix (administrador) abre o pedido.
- **O que acontece:** o marco "Pré-produção" tem um item só, "Pré-produção (dados e ETD) aprovada pelo Planner", que fica liberado na hora: nada nele espera os dados e o ETD do fornecedor (`MILESTONE_APPROVALS.preProduction.requires` vazio em `src/lib/purchase-lanes.ts`). O fornecedor não recebe pendência para o cartão Produção; a primeira pendência dele depois do sinal é "Pedido #1: Inspeção", que só chega depois da aprovação do Planner. Antes da Fase 5g a pendência se chamava "Produção e inspeção".
- **Visto também:** com o sinal aprovado e a pré-produção ainda não, a lista "Pedidos" do fornecedor mostrou o pedido em "8. Inspeção · Aguardando você", enquanto a página do pedido mostrava "7. Pré-produção · Aguardando Wellmix".
- **Decisão do dono:** a aprovação do Planner deve esperar os dados e o ETD do fornecedor? O cartão Produção deve gerar pendência para o fornecedor?
- **Efeito no treinamento:** o caminho de dados confirma as duas aprovações (sinal e pré-produção) logo depois do sinal; o Módulo 5 parte da pendência "Inspeção" e ensina a preencher o cartão Produção antes da inspeção.

## 026 · O marco seguinte só abre com as aprovações do mapa e com o selo aplicado na arte

- **Onde:** pedido de compra, Fase 5g dos marcos (15/11/2026).
- **O que mudou:** "Cadastro e fiscal aprovados pelo GP", "Material de arte aprovado pelo Comprador", "Certificação aprovada pelo GP", "Sinal aprovado pela Diretoria de compras" e "Pré-produção aprovada pelo Planner" travam o marco seguinte; o marco "Certificação" só conclui com o passo "Selo aplicado na arte" validado. Sem isso o pedido de amostras não é gerado ("O pedido de amostras é definido quando o pedido chega ao contrato").
- **Efeito no treinamento:** não é problema da tela; é a regra nova. O caminho de dados (`confirmarAprovacoes`, `enviarSeloAplicado` e `decidirSeloAplicado` em `_demo/preparo-pedido.mjs`) passou a fazer esses passos como a Wellmix e a agência fariam. As falas da Agência ("a pendência entra na sua lista quando ... a Wellmix aprovou") continuam certas.


## 027 · Pendências da agência: a coluna "Tipo" mostra a chave sem tradução

- **Onde:** Minhas pendências da agência de arte (`agencia@design.com`), ponto `arte-base`, em 18/11/2026 (`wellmix` 7f6352b).
- **O que aparece:** na coluna "Tipo", o texto `stage.agency.art`. A tela monta a chave `stage.<grupo>` (`src/components/task-list.tsx`), e só existe `tasks.group.agency.art` nos textos.
- **Efeito no treinamento:** a narração não cita a coluna "Tipo"; aparece no vídeo porque está na tela.
