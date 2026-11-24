# Vídeos institucionais do Portal Wellmix

Vídeos para o dono compartilhar o portal com clientes, fornecedores e parceiros, pedidos em 15/11/2026 (a versão em português do Brasil, em 16/11/2026):

| Vídeo                               | Para quê                                                                            | Duração | Arquivos                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| **Curto**                           | Os benefícios do portal, para mandar por mensagem ou rede social                    | 0:59    | `wellmix-short-pt.mp4`, `wellmix-short-zh.mp4` |
| **Completo**                        | O que cada papel faz, a comunicação centralizada e os atributos do portal           | 5:15    | `wellmix-full-pt.mp4`, `wellmix-full-zh.mp4`   |
| **Completo em português do Brasil** | O mesmo vídeo completo, com telas, textos e narração em português e **sem legenda** | 5:55    | `wellmix-full_br-pt.mp4`                       |

- **Formato:** 1920 × 1080 (Full HD), 60 quadros por segundo, H.264 + AAC, pronto para YouTube, LinkedIn e WhatsApp.
- **Áudio:** narração em **inglês**, igual nas quatro versões em inglês. A versão em português do Brasil tem narração em português, com voz feminina gerada pelo dono no ElevenLabs (seção 4).
- **Legenda:** queimada na imagem, em **português** (`-pt`) ou **mandarim** (`-zh`).
- **Idioma das telas do portal:** no vídeo **curto**, o da legenda (pt ou zh). No **completo**, **inglês** nas duas versões (pedido do dono em 15/11/2026): o portal de verdade com o idioma em EN e a base de demonstração também em inglês (`scripts/video/data-en.mjs`). A cena dos três idiomas continua mostrando pt, en e zh.
- **Abertura:** a vinheta do portal (`public/intro/wellmix-intro.mp4`), sem alteração; o vídeo continua do último quadro dela.
- **Música:** a faixa enviada pelo dono (`scripts/video/music/track.mp3`), editada nos compassos para caber em cada vídeo.
- **Telas:** são capturas reais do portal em modo demonstração (dados fictícios; nenhuma informação de produção aparece).

Os MP4 **não ficam no repositório** (são grandes e podem ser refeitos); as legendas em texto ficam em [`legendas/`](legendas/) (pt, zh e en, prontas para subir no YouTube como legenda opcional). Tudo o que gera os vídeos está em `scripts/video/`.

## 1. Mapa de benefícios e atributos

Levantado dos documentos e do código em 15/11/2026. A coluna "Onde está" aponta a fonte de cada afirmação; os vídeos só dizem o que está aqui.

### 1.1 O que cada papel faz e o que ganha

| Papel                                             | O que faz no portal                                                                                                                                                                                                                                                                | O que ganha                                               | Onde está                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cliente**                                       | Faz o pedido (encomenda) e acompanha a situação; conversa com a Wellmix. Como cliente do pedido, vê forma de pagamento, parcelas e boletos, confirma o recebimento e avalia a compra (ver a nota em 1.3)                                                                           | Situação do pedido e dos pagamentos sem telefonar         | `docs/PURCHASE_DEMAND.md`, `docs/CUSTOMER_PAYMENT.md`, `docs/WORKFLOW.md`                                                                                                        |
| **Fornecedor**                                    | Responde às solicitações (faz ou não faz, preço, mínimo, prazo) e às cotações de compra, envia fotos e vídeos de amostra, faca e foto em alta, documento assinado, datas de produção, evidências de inspeção, check list de carga e packing list; consulta a previsão de pagamento | Uma lista única de tarefas com prazo, em chinês ou inglês | `docs/SUPPLIER_REQUESTS.md`, `docs/SUPPLIER_SAMPLING.md`, `docs/PURCHASE_DEMAND.md`, `docs/PURCHASE_ORDER.md`, `docs/PRODUCTION.md`, `docs/SHIPPING_DOCS.md`, `docs/WORKFLOW.md` |
| **Agência de arte**                               | Recebe a faca e as fotos, envia a arte, refaz quando a Wellmix devolve com o motivo, aplica o selo e entrega a arte final (nas telas do pedido não vê preços)                                                                                                                      | Insumos, prazo e retorno na mesma mesa de trabalho        | `docs/PURCHASE_ORDER.md`, `docs/DESKS.md`                                                                                                                                        |
| **Certificadora (OCP)**                           | Lê a ficha de compra (sem o preço), as fotos do produto e os documentos de certificação; envia memorial, selo e certificado. Não abre o documento do pedido (dono, 15/11/2026)                                                                                                     | Uma fila única de certificados a emitir                   | `docs/CERTIFICATION.md`                                                                                                                                                          |
| **Agência de marketing (na origem; hoje, China)** | Confirma a chegada da amostra, envia fotos e vídeos reais por produto, devolve a amostra                                                                                                                                                                                           | Aprovação ou pedido de refação com motivo, no portal      | `docs/SAMPLE_FLOW.md`                                                                                                                                                            |
| **Agente de carga**                               | Registra a reserva no navio (booking) e acompanha o container na origem; no pedido de compra, o BL é da companhia marítima                                                                                                                                                         | Validação ou recusa com motivo no mesmo passo             | `docs/IMPORT_FLOW.md`, `docs/ORIGIN_CONTAINER.md`, `docs/SHIPPING_DOCS.md`                                                                                                       |
| **Companhia marítima**                            | Responde às cotações de frete, envia a própria tabela, faz o BL (conferido linha a linha com a invoice) e confirma o embarque; não vê o cliente                                                                                                                                    | Cotação e confirmação de embarque em um lugar             | `docs/WORKFLOW.md`, `docs/PURCHASE_ORDER.md`, `docs/SHIPPING_DOCS.md`                                                                                                            |
| **Comex (assessoria)**                            | LPCO, presença de carga, numerário, canal, DI/DUIMP, CE Mercante, comprovante de importação (no pedido de compra não há rascunho do BL: o BL vem conferido dos documentos do embarque)                                                                                             | Cada passo diz quem faz e quem valida                     | `docs/IMPORT_FLOW.md`, `docs/MAPA_PROCESSO.md`                                                                                                                                   |
| **Despachante**                                   | Número do processo, documentos, custos reais, liberação; valida o NCM do produto                                                                                                                                                                                                   | Lê os dados do embarque sem perguntar                     | `docs/WORKFLOW.md`, `docs/BOOKING.md`                                                                                                                                            |
| **Transportador**                                 | Vê a carga e o endereço, informa placa, previsão e situação, confirma a entrega (inclusive pelo celular)                                                                                                                                                                           | Tudo o que precisa para a entrega em um cartão            | `docs/WORKFLOW.md`, `docs/DELIVERY.md`, `docs/PWA.md`                                                                                                                            |
| **Jurídico**                                      | Vê as multas e muda a situação                                                                                                                                                                                                                                                     | Uma visão própria, sem o resto da operação                | `docs/SCOPE.md`, `docs/ACCESS.md`                                                                                                                                                |
| **Wellmix · Comprador**                           | Importa books, seleciona itens, abre e decide solicitações, escolhe estratégia de compra e cotação vencedora                                                                                                                                                                       | Do book ao pedido sem planilha paralela                   | `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/PURCHASE_DEMAND.md`                                                                                                        |
| **Wellmix · Gerente de produto**                  | Avalia amostras; produtos, linhas e certificados pendentes                                                                                                                                                                                                                         | Ficha do produto em um lugar                              | `docs/DESKS.md`, `docs/ACCESS.md`                                                                                                                                                |
| **Wellmix · Planner**                             | Abre reposições, acompanha ETD e os follow-ups de produção, containers e fretes                                                                                                                                                                                                    | Datas e ocupação de container visíveis                    | `docs/PURCHASE_DEMAND.md`, `docs/PRODUCTION.md`, `docs/ACCESS.md`                                                                                                                |
| **Wellmix · Cadastro**                            | Valida NCM, completa a ficha mestre, importa planilhas                                                                                                                                                                                                                             | Pendências de cadastro em fila                            | `docs/DESKS.md`, `docs/ACCESS.md`                                                                                                                                                |
| **Wellmix · Financeiro**                          | Valida e paga o numerário, registra a DANFE, é avisado de gerar o boleto                                                                                                                                                                                                           | Custos de importação conferidos no passo                  | `docs/IMPORT_FLOW.md`, `docs/DELIVERY.md`, `docs/CUSTOMER_PAYMENT.md`                                                                                                            |
| **Wellmix · Qualidade (CD)**                      | Confere o recebimento: lacre, fotos, checklist e contagem por SKU                                                                                                                                                                                                                  | Divergência registrada na chegada                         | `docs/RECEIVING.md`                                                                                                                                                              |
| **Wellmix · Vendas**                              | Lança encomendas pelo cliente, registra ofertas, abre ordens de venda com reserva e data de entrega                                                                                                                                                                                | Oferta, ordem e agenda no mesmo fluxo                     | `docs/PURCHASE_DEMAND.md`, `docs/SALES_ORDERS.md`                                                                                                                                |
| **Wellmix · Designer**                            | Faz a arte quando não há agência; aprova as fotos reais                                                                                                                                                                                                                            | Aprovação que ativa a venda                               | `docs/PURCHASE_ORDER.md`, `docs/SAMPLE_FLOW.md`                                                                                                                                  |
| **Wellmix · Diretorias**                          | Aprovam a estratégia de compra e a cotação vencedora, assinam o contrato; painéis e auditoria                                                                                                                                                                                      | Decisão registrada, com quem e quando                     | `docs/PURCHASE_DEMAND.md`, `docs/ORDER_SIGNATURE.md`, `docs/DASHBOARDS.md`                                                                                                       |
| **Wellmix · Comex interno**                       | Lança todo dia a situação do container                                                                                                                                                                                                                                             | Rastreio diário no pedido                                 | `docs/ORIGIN_CONTAINER.md`                                                                                                                                                       |
| **Wellmix · Administrador**                       | Todas as telas: configurações (SLA, tolerâncias, formas de pagamento), equipe e acessos, tipos de parceiro, finanças, retomar pedido pausado                                                                                                                                       | Controle de quem vê e faz o quê                           | `docs/ACCESS.md`, `docs/DELIVERY.md`, `docs/CUSTOMER_PAYMENT.md`, `docs/PARTNER_TYPES.md`                                                                                        |

### 1.2 Benefícios e atributos do portal

| #   | Benefício ou atributo                           | O que é, de concreto                                                                                                                                                                                                     | Onde está                                                              |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | **Um fluxo só**                                 | Menu pelos blocos do processo (Book, Pedido, Produção, Entrega, Vendas), com contador do que espera por você em cada passo                                                                                               | `docs/FLOW_MENU.md`                                                    |
| 2   | **Comunicação centralizada**                    | Uma conversa por empresa, com um assunto geral e um por solicitação, pedido ou item; fotos, vídeos e arquivos de até 50 MB                                                                                               | `src/lib/services/messages.ts`, `src/lib/services/documents.ts`        |
| 3   | **Quem deve a resposta**                        | Controladoria de mensagens, com prazo de resposta de 1 dia útil                                                                                                                                                          | `docs/SLA_PANEL.md`                                                    |
| 4   | **Pendências e mesas de trabalho**              | Caixa de tarefas por login e mesa por papel                                                                                                                                                                              | `docs/DESKS.md`                                                        |
| 5   | **Notificações**                                | Sino e lista dentro do portal, no idioma de quem recebe                                                                                                                                                                  | `src/lib/services/notifications.ts`                                    |
| 6   | **Três idiomas**                                | Português, inglês e chinês, com troca no login                                                                                                                                                                           | `src/lib/db/schema.ts` (`LOCALES`), `docs/ACCESS.md`                   |
| 7   | **Acesso por papel**                            | Telas e ações por função; cada parceiro vê só os dados da própria empresa                                                                                                                                                | `docs/ACCESS.md`, `docs/PARTNER_ACCESS.md`                             |
| 8   | **Preço de compra reservado**                   | O cliente nunca vê fornecedor, FOB nem margem; permissão "Ver preço de compra"                                                                                                                                           | `docs/LINHA_DE_VISAO.md`                                               |
| 9   | **Responsável, prazo e situação em cada etapa** | 16 marcos por pedido, com dependências e andamento                                                                                                                                                                       | `docs/MILESTONES.md`                                                   |
| 10  | **Control Tower**                               | O processo por etapa, com contagens, atrasos e "precisa de ação agora"                                                                                                                                                   | `docs/WORKFLOW.md`                                                     |
| 11  | **Painel de SLA**                               | Atrasado, vence hoje, próximos 7 dias, atraso de parceiros, responsável por tarefa                                                                                                                                       | `docs/SLA_PANEL.md`                                                    |
| 12  | **Painéis e indicadores**                       | Painéis por área (números calculados na hora), painel do dono e fluxo de caixa; os indicadores prontos da Control Tower, do Overview dos blocos e do Painel de SLA são atualizados por evento e reconstruídos toda noite | `docs/RESUMOS.md`, `docs/DASHBOARDS.md`                                |
| 13  | **Auditoria**                                   | Quem fez, quando, o quê, antes e depois                                                                                                                                                                                  | `docs/DASHBOARDS.md`                                                   |
| 14  | **Book e previsão de preço**                    | Planilhas dos fornecedores importadas, com a previsão de preço do Sankhya em cada item (custo por peça, venda prevista, meta)                                                                                            | `docs/BOOKING.md`                                                      |
| 15  | **Negociação e amostragem**                     | Rodadas de fotos e vídeos da amostra com o fornecedor                                                                                                                                                                    | `docs/SUPPLIER_SAMPLING.md`                                            |
| 16  | **Compra por demanda**                          | Encomenda do cliente, reposição, estratégia de compra e cotação de 24 h com aprovação da diretoria                                                                                                                       | `docs/PURCHASE_DEMAND.md`                                              |
| 17  | **Programação de compra**                       | Pedido pai com pedidos filhos por rodada                                                                                                                                                                                 | `docs/PURCHASE_SCHEDULE.md`                                            |
| 18  | **Arte e certificação em paralelo**             | Faca, arte, validação da Wellmix e arte final com o selo                                                                                                                                                                 | `docs/PURCHASE_ORDER.md`, `docs/CERTIFICATION.md`                      |
| 19  | **Contrato com as duas assinaturas**            | Documento do pedido com versão identificada; o pedido segue depois das duas assinaturas                                                                                                                                  | `docs/ORDER_SIGNATURE.md`                                              |
| 20  | **Inspeção documentada**                        | Fotos, peso, vídeo, declaração de conformidade, aprovação por SKU e fila de revisão                                                                                                                                      | `docs/PRODUCTION.md`, `docs/WORKFLOW.md`                               |
| 21  | **Container na origem**                         | Fotos e vídeos do container vazio e do carregamento, lacre e número                                                                                                                                                      | `docs/ORIGIN_CONTAINER.md`                                             |
| 22  | **Documentos conferidos linha a linha**         | Check list de carga, packing list, invoice e BL (caixas, peças, pesos)                                                                                                                                                   | `docs/SHIPPING_DOCS.md`                                                |
| 23  | **Amostras e fotos reais**                      | As fotos reais aprovadas substituem as de referência e ativam a venda                                                                                                                                                    | `docs/SAMPLE_FLOW.md`                                                  |
| 24  | **Entrega com quem faz e quem valida**          | Canal cinza ou vermelho pausa o pedido; transportadora padrão pelo porto; conferência no recebimento                                                                                                                     | `docs/DELIVERY.md`, `docs/RECEIVING.md`                                |
| 25  | **Containers**                                  | CBM, ocupação e regra de consolidação (produtos do mesmo cliente no container); comparativo das tabelas de frete das companhias                                                                                          | `src/lib/services/containers.ts`, `src/lib/services/freight-tariff.ts` |
| 26  | **Pagamento do cliente e vendas**               | Formas de pagamento, parcelas e boletos; ordens de venda com reserva e agenda de entregas                                                                                                                                | `docs/CUSTOMER_PAYMENT.md`, `docs/SALES_ORDERS.md`                     |
| 27  | **Aplicativo instalável**                       | Funciona no celular, no tablet e no computador e instala como aplicativo                                                                                                                                                 | `docs/PWA.md`                                                          |
| 28  | **Feito para o ERP da Wellmix** (Sankhya)       | Cadastros e histórico carregados do ERP; envio de pedido e cadastro ao ERP                                                                                                                                               | `docs/SANKHYA.md`                                                      |

### 1.3 O que os vídeos não prometem

Estas coisas **não** estão ditas nem mostradas, porque não é assim que o portal funciona hoje. Quem mexer no roteiro precisa manter isso.

- **E-mail e WhatsApp:** hoje só o sino do portal avisa (os dois são simulados).
- **Rastreio automático e reserva automática de navio:** o rastreio é lançado todo dia pelo Comex interno.
- **Pagamento on-line:** não há gateway; o boleto nasce no Sankhya e o portal só lê.
- **Sincronia em tempo real com o ERP:** o vídeo diz "built to work with Wellmix's ERP" (a escrita no ERP começa desligada, em simulação).
- **Chat direto entre parceiros:** não existe. Cada empresa conversa só com a Wellmix (`src/lib/services/messages.ts`); entre a agência de arte e o fornecedor o que passa são as pendências e os arquivos do pedido (`docs/PURCHASE_ORDER.md`).
- **Tradução automática das mensagens:** só funciona com a IA ligada (`src/lib/services/message-translation.ts`); o vídeo não fala dela.
- **Tela da Wellmix atualizando sozinha na inspeção:** a cena mostra a tela antes e depois do envio; a narração diz que a Wellmix vê cada item no pedido, não que é ao vivo. Também não diz "pronto para aprovar": a aprovação de cada produto ainda pede o vídeo da produção e a declaração do fornecedor (`docs/PRODUCTION.md`).
- **Quem deve a resposta:** a controladoria de mensagens é só da Wellmix; o vídeo diz "Wellmix sees who owes a reply".
- **Assinatura digital certificada:** o pedido de compra é assinado enviando o PDF assinado e carimbado.
- **Uso sem conexão**, **IA que decide sozinha** e a **vitrine do cliente** (escondida do menu).
- **Fluxo antigo:** RFQ, cotação ao cliente, proposta e sinal saíram em 11/11/2026 (`docs/QUOTE_FLOW.md`).
- **"Tempo real":** a tela atualiza ao abrir; o vídeo diz "a gestão vê", não "em tempo real".

Decisões do dono em 15/11/2026, depois de assistir à primeira versão:

- **Sem país de origem.** A Wellmix não importa só da China: a narração fala em "a factory abroad" e "at origin", e o mapa da abertura mostra várias origens sem destacar nenhuma. Chinês e inglês continuam citados só como **idiomas** do portal.
- **Cena do cliente mantida.** Ela mostra forma de pagamento, parcelas, boletos e a confirmação do recebimento. Essas telas existem para o **cliente do pedido**; hoje todo pedido de compra é da própria Wellmix ("clientes terceiros só virão com a vitrine", `src/lib/services/purchase-order.ts`), então o login de um cliente vê a encomenda dele, a situação dela e a conversa com a Wellmix. O dono preferiu manter a cena como está.

Pedidos do dono em 15/11/2026 para o vídeo **completo**, depois de assistir às versões finais (o curto não mudou):

| Pedido                                          | Como ficou                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telas em inglês                                 | Todas as telas do completo vêm do portal em inglês, com a base de demonstração em inglês (produtos, textos digitados). Nomes de pessoas e empresas fictícias continuam                                                                                                  |
| Etapa do financeiro                             | A jornada passou a ter seis blocos; o sexto é **Finance**: contas a pagar ao fornecedor, a receber do cliente, fluxo de caixa e comissões (menu Financeiro, `docs/FLOW_MENU.md`). Multas ficaram de fora do bloco                                                       |
| Agência de arte no Brasil falando com a fábrica | Fala nova: "Agency in Brazil, factory abroad: files and tasks flow through the portal, and each side chats with Wellmix. No e-mails." O portal **não tem chat direto** entre agência e fornecedor (cada um conversa com a Wellmix), então o vídeo não diz "diretamente" |
| Inspeção pelo celular                           | Cena nova antes do frete: o passo Produção > Inspeção com o login do fornecedor em um celular (telas reais: escolhe a foto, o portal salva na hora, digita o peso, envia) e, ao lado, o mesmo passo na tela da Wellmix                                                  |
| BL só abreviado                                 | Conferido: o portal em inglês escreve "BL" (sem barra) em 29 rótulos. A narração, a tela e as três legendas dizem "BL"                                                                                                                                                  |
| Sem o nome do Sankhya                           | Narração e tela dizem "Wellmix's ERP" (o ERP é o da Wellmix, não o do parceiro). Nas capturas, onde o portal escreve o nome do ERP a tela do vídeo mostra "ERP" (`shots.mjs`, troca só do texto visível)                                                                |
| Foco nos chats: o e-mail acaba, sem bagunça     | Cena nova "E-mail threads end here.": a tela real de Mensagens com uma conversa por pedido (texto e foto), a mesma conversa no celular do fornecedor, e os canais antigos riscados. Fala: "The scattered e-mail threads end here." e "Nothing gets lost. No mess."      |

Limites que a revisão independente encontrou e o roteiro respeita:

- **BL:** no pedido de compra quem faz o BL é a companhia marítima (`docs/SHIPPING_DOCS.md`), não o agente de carga.
- **Certificadora:** não abre o documento do pedido (tem o preço de compra); usa a ficha de compra e os documentos de certificação (`docs/ORDER_SIGNATURE.md`).
- **Fornecedor, preço e margem:** o cliente nunca vê o fornecedor, o preço de compra nem a margem; o fornecedor nunca vê o valor de venda ao cliente; a margem é só da Wellmix (`src/lib/auth/permissions.ts`). Cada parceiro só abre os pedidos em que a empresa dele trabalha. O cartão de acesso do vídeo mostra só isso (cliente, fornecedor e parceiros de serviço), porque as outras regras têm exceção: a companhia marítima vê o fornecedor e o preço da invoice, e os arquivos de invoice e packing list do embarque abrem para a agência, o transportador e o jurídico do pedido (`docs/LINHA_DE_VISAO.md`, seção 8).
- **"O cliente nunca vê o fornecedor"** é a regra de acesso (`canSeeSupplier`); há um ponto em aberto em `docs/PARTNER_ACCESS.md` (multas dentro do pedido mostram o nome do responsável).
- **Mesa de trabalho** existe para cinco mesas (`docs/DESKS.md`); o vídeo diz que cada função tem as suas telas e pendências.
- **Lacre:** no carregamento vão a foto do lacre e o número do container; o número do lacre é conferido no recebimento.

No vídeo **curto**, os balões de conversa da cena de comunicação são **ilustrações** desenhadas sobre a tela real do pedido (os botões "Conversar com" são do portal). No **completo** a conversa é de verdade: as mensagens foram enviadas pelo próprio portal de demonstração (`scripts/video/seed-chat.mjs`, cerca de 5 minutos, porque espera um minuto entre as mensagens), e as fotos da inspeção e do chat são desenhos gerados aqui (nenhuma imagem baixada). A tela de Mensagens é capturada em uma janela mais alta, para a conversa inteira caber na caixa. A cena de pendências usa a lista do despachante, porque as pendências internas ainda têm rótulos sem tradução em inglês.

## 2. Estrutura dos vídeos

### Curto (0:59)

| Tempo | Cena                                                                                    | Narração (inglês)                                                                                     |
| ----- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0:00  | Vinheta do portal                                                                       | (música)                                                                                              |
| 0:06  | Mapa: rotas de várias origens no exterior até o Brasil e as mãos por onde a carga passa | From a factory abroad to a customer in Brazil, an import takes dozens of handoffs.                    |
| 0:13  | Cada um no seu canal                                                                    | Suppliers, agencies, freight, customs, carriers. Each one in a different inbox, spreadsheet and chat. |
| 0:20  | A marca no centro, os 12 papéis em volta                                                | The Wellmix Portal brings them all into one workflow.                                                 |
| 0:25  | Linha do tempo do pedido (tela real)                                                    | Every step has an owner, a deadline and a status.                                                     |
| 0:29  | Conversa em cima do pedido                                                              | Every message, photo and document stays with the order.                                               |
| 0:34  | A mesma tela em pt, en e zh                                                             | Each partner sees only its own part, in Portuguese, English or Chinese.                               |
| 0:40  | Documentos do embarque conferidos (tela real)                                           | Inspections, samples and shipping documents are checked before the cargo moves.                       |
| 0:45  | Control Tower (tela real)                                                               | And management sees what is late, what is next and who is responsible.                                |
| 0:51  | Assinatura                                                                              | Wellmix. Imports from order to delivery, in one place.                                                |

### Completo (5:15)

| Tempo | Capítulo              | Cena                                                                                                       |
| ----- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0:00  |                       | Vinheta do portal                                                                                          |
| 0:06  |                       | "O desafio" (título da cena): as rotas e as mãos por onde a carga passa; cada um no seu canal              |
| 0:24  |                       | Um portal, um fluxo (os papéis em volta da marca)                                                          |
| 0:37  | A jornada             | Os seis blocos: Book, Pedido, Produção, Entrega, Vendas e Financeiro                                       |
| 1:11  | Quem faz o quê        | Cliente                                                                                                    |
| 1:24  |                       | Fornecedor                                                                                                 |
| 1:41  |                       | Agência de arte (recebe da fábrica a faca e as fotos do produto; arquivos e pendências correm pelo portal) |
| 2:03  |                       | Certificadora                                                                                              |
| 2:13  |                       | Inspeção pelo celular: o fornecedor envia fotos e peso; a Wellmix vê no pedido                             |
| 2:28  |                       | Agência de marketing na origem                                                                             |
| 2:38  |                       | Agente de carga e companhia marítima (BL)                                                                  |
| 2:50  |                       | Comex e despachante                                                                                        |
| 3:01  |                       | Transportador (com o celular)                                                                              |
| 3:10  |                       | Dentro da Wellmix: comprador, gerente de produto, planner, cadastro, designer, jurídico                    |
| 3:30  |                       | Financeiro, qualidade, vendas, diretorias, administrador, comex interno                                    |
| 3:51  | Uma conversa          | O chat no lugar dos e-mails: uma conversa por empresa, por pedido e por item, com fotos, vídeos e arquivos |
| 4:09  |                       | Sino, pendências e, para a Wellmix, quem deve a resposta (controladoria de mensagens)                      |
| 4:17  | Feito para o controle | Três idiomas                                                                                               |
| 4:22  |                       | Acesso por papel (o que cada um vê e o que fica oculto)                                                    |
| 4:32  |                       | Qualidade documentada: inspeção, carregamento, documentos                                                  |
| 4:45  |                       | Control Tower, painel de SLA, painéis e auditoria                                                          |
| 4:59  |                       | Qualquer tela, instala como aplicativo; feito para o ERP da Wellmix                                        |
| 5:06  |                       | Assinatura                                                                                                 |

O texto completo da narração e das legendas está em `scripts/video/script.mjs` (uma fala por linha, com pt e zh ao lado) e nos arquivos de [`legendas/`](legendas/).

## 3. Como os vídeos são feitos

Nada é gravado à mão: o vídeo é desenhado em HTML e renderizado quadro a quadro, então dá para refazer quando o portal mudar.

| Etapa           | Arquivo                                       | O que faz                                                                                                                                                                                                                                                                            |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Roteiro         | `scripts/video/script.mjs`                    | Cenas, narração (en) e legendas (pt, zh)                                                                                                                                                                                                                                             |
| Telas           | `scrub.mjs`, `shots.mjs`                      | Limpa os nomes de teste da base de demonstração e captura as telas reais em pt, zh e en. Onde a tela escreve o nome do ERP, a captura mostra "ERP"                                                                                                                                   |
| Telas em inglês | `data-en.mjs`, `seed-chat.mjs`, `inspection/` | Só para o completo: copia a base com os textos gravados em inglês, envia pelo portal a conversa da cena do chat e leva um pedido até a inspeção para capturar o passo no celular (`inspection/flow.mjs`, fotos desenhadas por `inspection/photos.py`)                                |
| Voz             | `tts/tts.py`, `tts/check.py`                  | Narração sintética em inglês, gerada na máquina (modelo aberto Kokoro, voz `af_heart`), e conferência por transcrição                                                                                                                                                                |
| Linha do tempo  | `build.mjs`                                   | Mede cada fala, calcula a duração das cenas e das legendas e grava os `.srt` (em `out/` e em `legendas/`). Confere o tamanho da linha e as duas linhas por legenda de `docs/videos/GUIA.md`; a velocidade de leitura do guia (17 caracteres por segundo em pt, 9 em zh) ele só avisa |
| Faixa de voz    | `tts/audio.py`                                | Põe cada fala no instante dela e grava a faixa de voz que o `mix.mjs` usa                                                                                                                                                                                                            |
| Música          | `tts/track.py`                                | Corta a faixa do dono nos compassos: a batida entra quando a marca aparece e o acorde final cai na assinatura                                                                                                                                                                        |
| Mapa e ícones   | `map.mjs`, `icons.mjs`                        | Geram o mapa-múndi e os ícones do palco a partir dos pacotes npm                                                                                                                                                                                                                     |
| Imagem          | `film/`, `render.mjs`                         | O palco (HTML e CSS) e o renderizador (60 quadros por segundo)                                                                                                                                                                                                                       |
| Fechamento      | `mix.mjs`                                     | Voz + música (a música abaixa cerca de 12 dB sob a fala), −16 LUFS, vinheta + filme                                                                                                                                                                                                  |

Para refazer tudo:

```bash
# 1. Portal em modo demonstração com a base do E2E (pedidos em várias etapas)
npm ci && npm run test:e2e                      # deixa a base em .data-e2e
rm -rf .data-video && cp -r .data-e2e .data-video
node scripts/video/scrub.mjs .data-video        # nomes apresentáveis no lugar dos de teste
DATA_MODE=memory DATA_DIR=.data-video npx next start -p 3200 &

# 2. Dependências dos vídeos (fora do portal)
cd scripts/video && npm ci && node map.mjs && node icons.mjs
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile scipy faster-whisper
# modelos da voz em tts/models/ (ver o cabeçalho de tts/tts.py)

# 3. Telas, voz, linha do tempo, música
for l in pt zh en; do node shots.mjs $l; done       # telas do curto (base em português)

# 3a. Telas do completo: em inglês, com a base em inglês (pasta film/shots/intl)
node data-en.mjs                                    # .data-video → .data-video-en
(cd ../.. && DATA_MODE=memory DATA_DIR=.data-video-en npx next start -p 3201 &)
PORTAL=http://localhost:3201 node seed-chat.mjs     # a conversa da cena do chat
export PORTAL=http://localhost:3201 DATA_DIR=$PWD/../../.data-video-en
node shots.mjs en --out intl
node shots.mjs pt supplier --out intl-pt && node shots.mjs zh supplier --out intl-zh   # cena dos três idiomas
unset PORTAL DATA_DIR
# 3b. Inspeção pelo celular (base nova, porta 3300; uns 2 min)
python3 inspection/photos.py
(cd ../.. && DATA_MODE=memory DATA_DIR=.data-video-insp npx next start -p 3300 &)
node inspection/flow.mjs

for v in short full; do
  node build.mjs $v --tts && .venv/bin/python tts/tts.py out/$v.tts.json && .venv/bin/python tts/check.py out/$v.tts.json
  node build.mjs $v
  .venv/bin/python tts/audio.py voice out/$v.audio.json
  .venv/bin/python tts/track.py out/$v.audio.json
done

# 4. Imagem e fechamento (cerca de 10 min por versão do completo)
for v in short full; do for l in pt zh; do node render.mjs $v $l && node mix.mjs $v $l --audio; done; done
# saída: scripts/video/out/wellmix-<vídeo>-<idioma>.mp4
```

Para conferir uma cena sem renderizar: `node still.mjs full pt 70,88` grava quadros soltos em `out/still/`.

Mudou o texto de uma fala? Só ela é gerada de novo, e a duração das cenas se ajusta sozinha; depois de cada `build.mjs`, refaça a voz e a trilha (o `mix.mjs` para com erro se elas estiverem mais antigas que a linha do tempo). As legendas em português passam um pouco da velocidade de leitura do guia em algumas falas (até 19 caracteres por segundo, contra 17): o guia é o dos tutoriais, e a narração de um vídeo institucional é mais corrida. `tts/track.py` avisa se o acorde final da música deixou de cair na assinatura; ajuste as folgas (`pre` e `post`) da cena final em `script.mjs`. O aviso só vale se a conta das voltas estiver certa: o script calcula os compassos de cada combinação de voltas (antes o número era escrito à mão e uma combinação errada deixou o acorde final 4 s depois da marca, o que a conferência independente pegou). Confirme sempre medindo: o início do final da música (compasso 65 da trilha original) tem de cair em `logo` de `out/<vídeo>.audio.json`.

## 4. Versão em português do Brasil (16/11/2026)

Pedido do dono: "o vídeo completo com as telas e o áudio em português do Brasil, voz feminina e humana, sem legenda". É o mesmo vídeo completo (as 23 cenas, na mesma ordem), com:

- **Roteiro:** `scripts/video/script.br.mjs` (`VIDEOS_BR.full_br`): texto da tela e narração em português, revisados por duas lentes independentes (português natural e nomes do portal; fidelidade à versão em inglês e riscos de leitura pela voz); nove correções confirmadas e aplicadas. `speak()` troca nomes e siglas pela leitura ("Uélmiks" = Wellmix, "bê-éle" = BL, "érre-pê" = ERP, "ésse-éle-á" = SLA...). `ui` traduz os rótulos fixos das cenas (Brasil, Vê, Nunca vê, canais soltos).
- **Telas:** o portal em português com a base de demonstração em português (`data-pt.mjs`), a conversa do chat em português (`seed-chat.mjs` com `LANGUAGE=pt`) e a inspeção no celular em português (`inspection/flow.mjs` com `LANGUAGE=pt`), em `film/shots/br`. A tela de auditoria sai sem a coluna "Ação" (códigos técnicos como `team.member.delete`), pedido do dono.
- **Sem legenda:** `noSubs` no roteiro; `build.mjs` não grava `.srt` para esta versão.
- **Voz:** feminina, gerada pelo dono no ElevenLabs a partir do pacote `narracao-ptbr/` (LEIA-ME, três partes para colar e a tabela das 72 falas, feitos por `narration-export.mjs`). `tts/import_voice.py` reconhece cada parte pelo conteúdo (o nome do arquivo não importa), transcreve com o Whisper local, alinha as palavras ao roteiro e corta uma fala por arquivo; também aceita um arquivo por fala e `--fix id=arquivo` para trocar uma fala só. Na narração do dono, as 72 falas entraram sem nenhuma a rever.
- **Corte das falas pelo som:** o tempo das palavras do Whisper só diz onde procurar. O corte entre duas falas vai para o meio do silêncio medido no áudio (quadros de 10 ms abaixo de −60 dBFS), e as pontas de cada fala saem pelo som: entram as consoantes fracas do começo (o "f" de "Fornecedores", o estalo do "c" de "Consulta") e as sílabas finais quase sem voz ("embarque", "contrato"); a respiração separada da fala fica de fora. A primeira versão cortava pelo tempo das palavras e perdeu "Entrega" (o Whisper ouviu "Pega" e marcou a palavra seguinte), o "F" de "Fornecedores" e o "C" de "Consulta"; a transcrição fala por fala não acusou (o Whisper completa a palavra pelo contexto). Quem achou foi a conferência independente, comparando com o áudio original. Agora o importador avisa quando sobra som de fala fora de todas as falas, e `--cache` guarda a transcrição para refazer o corte sem transcrever de novo.
- **Vozes locais testadas antes (não usadas):** Kokoro `pf_dora`, Chatterbox (ajuste pt-BR), Supertonic e Qwen3-TTS (`tts/tts_pt.py`). A Qwen3-TTS clonada foi a melhor nas medidas de naturalidade, mas **o dono ouviu sotaque de Portugal**; uma medida de sotaque feita depois (fonemas ouvidos comparados à pronúncia esperada no Brasil e em Portugal) confirmou: só 2 de 14 frases soavam brasileiras. O dono preferiu trazer a voz do ElevenLabs. Lição: medir o sotaque antes de mostrar uma voz.
- **Música e tempos:** `tts/track.py` agora escolhe, entre combinações de até quatro voltas que recomeçam em início de bloco, a que põe o acorde final na marca; o resto se acerta com as folgas do vídeo (`post: 0.595`) e da cena final (`pre: 0.2`, `post: 0.55`). Na versão final, o acorde cai 0,01 s antes da marca. Como a marca demora mais a aparecer do que na versão em inglês, a música precisa começar antes: a introdução calma ganha dois compassos (repete a frase dos compassos 1 e 2), na mesma grade. A primeira tentativa punha compassos do começo na frente e recomeçava a faixa do zero, o que deixou 70 ms de silêncio e uma queda de 10 dB no meio da vinheta (achado da conferência).
- **Conferência independente (16/11/2026):** quatro inspetores (telas, cenas de risco, áudio e quadro a quadro) e um revisor cético para cada achado. Na primeira versão enviada confirmaram nove defeitos de montagem, todos corrigidos: rótulos "Agência de arte" e "Fornecedor" sobrepostos no mapa (o rótulo agora aceita `pos`), título de comex em duas linhas desalinhando as janelas (virou "Licenças, numerário e DI/DUIMP"), selo "O que a Wellmix vê" sobre a barra da janela, selo de carregamento fora da margem ("nº do container"), os três cortes de fala, o silêncio na música da vinheta e a linha vermelha da jornada piscando ao nascer (crescia por `transform` a partir de zero; agora cresce pela largura). Ficou um ponto que é do áudio do dono (seção 6, ponto 13). Lição: texto em português é mais longo que o inglês para o qual o desenho foi feito; conferir quadro a quadro toda cena com texto novo.

Para refazer (de `scripts/video`; portais em modo demonstração como na seção 3):

```bash
# Telas em português (base .data-video-br, porta 3203)
node data-pt.mjs                                       # .data-video → .data-video-br
(cd ../.. && DATA_MODE=memory DATA_DIR=.data-video-br npx next start -p 3203 &)
PORTAL=http://localhost:3203 LANGUAGE=pt node seed-chat.mjs   # conversa (uns 5 min)
# pare o portal, traduza o que a conversa gravou e suba de novo
node data-pt.mjs .data-video-br .data-video-br
export PORTAL=http://localhost:3203 DATA_DIR=$PWD/../../.data-video-br
node shots.mjs pt customer,supplier,agency,ocp,marketing,forwarder,line,comex,broker,carrier,m-carrier,m-tower,m-supplier,order-inspection,order-container,shipping-docs,tower,sla,audit,messages,m-messages,messages-control --out br
for l in pt en zh; do node shots.mjs $l supplier --out br-$l; done   # cena dos três idiomas
unset PORTAL DATA_DIR
# Inspeção pelo celular (cópia de .data-video-insp-before em .data-video-insp-br, porta 3300)
LANGUAGE=pt node inspection/flow.mjs --only phone

# Narração: pacote para o ElevenLabs e, com os áudios de volta, o corte
node narration-export.mjs                              # docs/videos/institucional/narracao-ptbr
python tts/import_voice.py out/full_br.tts.json --manifest out/full_br.voice-parts.json --audio <pasta com os áudios> --cache out/full_br.whisper.json

# Linha do tempo, trilha, imagem e fechamento
node build.mjs full_br && python tts/audio.py voice out/full_br.audio.json && python tts/track.py out/full_br.audio.json
node render.mjs full_br pt && node mix.mjs full_br pt --audio
```

O `import_voice.py` precisa do `faster-whisper` (modelo "medium", baixado do Hugging Face na primeira vez). Mudou o texto de uma fala? Rode `narration-export.mjs`, gere de novo só aquela fala no ElevenLabs (com a mesma voz) e use `--fix <id>=<arquivo>`.

## 5. Versão em mandarim (24/11/2026)

Pedido do dono: "esse vídeo em mandarim, tanto as telas quanto a voz". É o mesmo vídeo completo da seção 4 (as 23 cenas, na mesma ordem, sem legenda), com:

- **Roteiro:** `scripts/video/script.zh.mjs` (`VIDEOS_ZH.full_zh`), em chinês simplificado e mandarim padrão. Os termos são os que o próprio portal mostra em chinês (`src/i18n`: 待办, 验货, 装柜, 提单, 报关行, 控制塔, 实物照片...), para a voz e os textos da cena dizerem o que a tela mostra. Revisado por cinco lentes independentes (mandarim falado natural; termos iguais aos do portal; fidelidade ao roteiro em português; riscos de leitura pela voz e de entendimento só pelo ouvido, já que não há legenda; textos da tela), com um segundo revisor para cada proposta.
- **Palco:** chinês não separa as palavras com espaço. `film.js` separa cada linha de título com o `Intl.Segmenter` do navegador (as palavras continuam subindo uma a uma), a pontuação fica com a palavra anterior e as quebras de linha dos títulos são escritas no roteiro (`\n`), porque a quebra automática corta a frase em lugar ruim. `fonts.css` traz a Noto Sans SC nos pesos dos títulos (400 a 800).
- **Telas:** o portal em chinês com a base de demonstração em chinês (`data-zh.mjs`: produtos, fábricas, tradings e as pessoas do lado da China; empresas e pessoas do Brasil ficam como estão, são nomes próprios), a conversa do chat em chinês (`seed-chat.mjs` com `LANGUAGE=zh`) e a inspeção pelo celular em chinês (`inspection/flow.mjs` com `LANGUAGE=zh`), em `film/shots/cn`. `shots.mjs --latin` lista, por captura, o que a tela ainda mostra em letras latinas (foi assim que os nomes de arquivo "foto.png" e o prefixo "attachment:" da auditoria apareceram).
- **Datas da base:** as bases de demonstração são de 15/11/2026. Dias depois, todos os prazos apareceriam vencidos; `data-shift.mjs` soma os mesmos dias a toda data gravada, e o portal mostra hoje o que mostrava no dia das telas originais.
- **Mesma versão do portal:** as telas vêm da compilação de 16/11/2026 (a das versões em inglês e em português), para os três vídeos mostrarem o mesmo portal.
- **Voz:** pelo mesmo caminho da versão em português: pacote `narracao-zh/` (LEIA-ME em português, três partes em chinês para colar e a tabela das 72 falas com a fala em português ao lado), voz gerada pelo dono no ElevenLabs e importada por `tts/import_voice.py`. Em mandarim o importador conta um caractere por palavra, casa caracteres de mesma pronúncia (o Whisper troca homófonos; `pypinyin`) e passa o tradicional para simplificado (`zhconv`).
- **Abertura:** a vinheta é a peça do dono, com os nomes dos países desenhados em português; fica como está.

Para refazer (de `scripts/video`):

```bash
# Telas em chinês (base .data-video-zh, porta 3204)
node data-zh.mjs && node data-shift.mjs .data-video-zh    # .data-video → .data-video-zh, datas em hoje
(cd ../.. && DATA_MODE=memory DATA_DIR=.data-video-zh npx next start -p 3204 &)
PORTAL=http://localhost:3204 LANGUAGE=zh node seed-chat.mjs   # conversa (uns 5 min)
# pare o portal (os dois processos: "next start" e "next-server"), traduza o que a conversa gravou e suba de novo
node data-zh.mjs .data-video-zh .data-video-zh
export PORTAL=http://localhost:3204 DATA_DIR=$PWD/../../.data-video-zh
node shots.mjs zh customer,supplier,agency,ocp,marketing,forwarder,line,comex,broker,carrier,m-carrier,m-tower,m-supplier,order-inspection,order-container,shipping-docs,tower,sla,audit,messages,m-messages,messages-control --out cn --latin
for l in pt en zh; do node shots.mjs $l supplier --out cn-$l; done   # cena dos três idiomas
unset PORTAL DATA_DIR
# Inspeção pelo celular (base .data-video-insp-zh, porta 3300)
node data-zh.mjs .data-video-insp-before .data-video-insp-zh && node data-shift.mjs .data-video-insp-zh
LANGUAGE=zh node inspection/flow.mjs --only phone

# Narração: pacote para o ElevenLabs e, com os áudios de volta, o corte
node build.mjs full_zh --tts && node narration-export.mjs full_zh   # docs/videos/institucional/narracao-zh
python tts/import_voice.py out/full_zh.tts.json --manifest out/full_zh.voice-parts.json --audio <pasta com os áudios> --cache out/full_zh.whisper.json

# Linha do tempo, trilha, imagem e fechamento
node build.mjs full_zh && python tts/audio.py voice out/full_zh.audio.json && python tts/track.py out/full_zh.audio.json
node render.mjs full_zh zh && node mix.mjs full_zh zh --audio
```

## 6. Pontos para o dono decidir ou conferir

1. **Áudio.** Quem montou não ouve áudio: a narração foi conferida por transcrição automática (todas as falas batem com o roteiro) e os volumes por medição (−16 LUFS, música cerca de 12 dB abaixo da fala). O dono assistiu à primeira versão em 15/11/2026 e aprovou; pediu só tirar a China do exemplo.
2. **Voz.** É sintética (boa qualidade, sem custo). Para trocar por locutor, basta gravar as falas de `script.mjs` com os mesmos nomes de arquivo; o resto se ajusta.
3. **Música no completo.** A faixa enviada tem 2:15 e o nome dela fala em vídeo curto; no completo ela foi estendida repetindo blocos inteiros (sem emenda audível na medição). Se preferir outra música para o completo, é só trocar `scripts/video/music/track.mp3` (o encaixe pressupõe 120 BPM e a forma descrita em `tts/track.py`).
4. **"Importação direta · desde 2010"** aparece desenhado na vinheta; a narração não repete a data.
5. **Versão só em inglês** (sem legenda queimada) não foi pedida; as telas do completo já estão em inglês, então sai com mais uma renderização.
6. **Onde publicar** (YouTube não listado, Vimeo, LinkedIn) e se o portal ganha um link para o vídeo completo.
7. **Chat direto entre agência e fornecedor.** O dono pediu para o vídeo dizer que a agência de arte no Brasil fala direto com a fábrica pelo chat. Hoje o portal não permite: cada empresa conversa só com a Wellmix. O vídeo diz que arquivos e pendências correm pelo portal e que cada lado conversa com a Wellmix, sem e-mails. Abrir conversa direta entre parceiros é decisão de produto (quem vê o quê, preço, quem responde).
8. **Curto com tela em inglês e sem o nome do ERP?** O curto não mudou: a narração dele já não cita BL nem o ERP, mas as telas continuam em pt ou zh e a Control Tower mostra, em letra pequena, o cartão "Sem nº Sankhya". Para deixar igual ao completo basta refazer as capturas (`shots.mjs` já troca o nome por "ERP") e renderizar de novo.
9. **Pendências internas em inglês.** A lista de pendências dos logins da Wellmix ainda mostra rótulos sem tradução em inglês (`tasks.group.purchase_strategy`, títulos "Estratégia de compra: …"). Por isso a cena de pendências usa a lista do despachante. Vale corrigir no portal.
10. **Tradução automática do chat.** Se a IA estiver ligada em produção, dá para acrescentar "cada um escreve no seu idioma" na cena do chat.
11. **Licença da voz.** A narração em português foi gerada na conta do dono no ElevenLabs; para uso comercial (vídeo da empresa), o plano precisa incluir licença comercial.
12. **Legenda opcional da versão em português.** O vídeo sai sem legenda, como pedido. Se quiser publicar com legenda opcional (YouTube), dá para gerar o `.srt` da narração em português a partir da linha do tempo.
13. **"Toca em enviar" na inspeção (versão em português, perto de 2:45).** O roteiro diz "Depois digita o peso medido e toca em enviar". Na narração do ElevenLabs, a transcrição automática ouve "toque em enviar": o "a" de "toca" se junta ao "em", como na fala corrida. É do áudio do dono, não do corte. Se incomodar ao ouvir, gere de novo só essa frase no ElevenLabs, com a mesma voz e o texto "Depois digita o peso medido e toca no botão Enviar.", e troque com `--fix inspect.2=<arquivo>`.
