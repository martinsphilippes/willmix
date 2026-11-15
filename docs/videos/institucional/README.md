# Vídeos institucionais do Portal Wellmix

Dois vídeos para o dono compartilhar o portal com clientes, fornecedores e parceiros, pedidos em 15/11/2026:

| Vídeo        | Para quê                                                                  | Duração | Arquivos                                       |
| ------------ | ------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| **Curto**    | Os benefícios do portal, para mandar por mensagem ou rede social          | 0:59    | `wellmix-short-pt.mp4`, `wellmix-short-zh.mp4` |
| **Completo** | O que cada papel faz, a comunicação centralizada e os atributos do portal | 4:43    | `wellmix-full-pt.mp4`, `wellmix-full-zh.mp4`   |

- **Formato:** 1920 × 1080 (Full HD), 60 quadros por segundo, H.264 + AAC, pronto para YouTube, LinkedIn e WhatsApp.
- **Áudio:** narração em **inglês**, igual nas quatro versões.
- **Legenda:** queimada na imagem, em **português** (`-pt`) ou **mandarim** (`-zh`). A tela do portal que aparece no vídeo também está no idioma da legenda (o portal de verdade, em pt ou zh).
- **Abertura:** a vinheta do portal (`public/intro/wellmix-intro.mp4`), sem alteração; o vídeo continua do último quadro dela.
- **Música:** a faixa enviada pelo dono (`scripts/video/music/track.mp3`), editada nos compassos para caber em cada vídeo.
- **Telas:** são capturas reais do portal em modo demonstração (dados fictícios; nenhuma informação de produção aparece).

Os MP4 **não ficam no repositório** (são grandes e podem ser refeitos); as legendas em texto ficam em [`legendas/`](legendas/) (pt, zh e en, prontas para subir no YouTube como legenda opcional). Tudo o que gera os vídeos está em `scripts/video/`.

## 1. Mapa de benefícios e atributos

Levantado dos documentos e do código em 15/11/2026. A coluna "Onde está" aponta a fonte de cada afirmação; os vídeos só dizem o que está aqui.

### 1.1 O que cada papel faz e o que ganha

| Papel                                             | O que faz no portal                                                                                                                                                                                                                                                                | O que ganha                                               | Onde está                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Cliente**                                       | Faz o pedido (encomenda) e acompanha a situação; conversa com a Wellmix. Como cliente do pedido, vê forma de pagamento, parcelas e boletos, confirma o recebimento e avalia a compra (ver a nota em 1.3)                                                                           | Situação do pedido e dos pagamentos sem telefonar         | `docs/PURCHASE_DEMAND.md`, `docs/CUSTOMER_PAYMENT.md`                          |
| **Fornecedor**                                    | Responde às solicitações (faz ou não faz, preço, mínimo, prazo) e às cotações de compra, envia fotos e vídeos de amostra, faca e foto em alta, documento assinado, datas de produção, evidências de inspeção, check list de carga e packing list; consulta a previsão de pagamento | Uma lista única de tarefas com prazo, em chinês ou inglês | `docs/SUPPLIER_REQUESTS.md`, `docs/SUPPLIER_SAMPLING.md`, `docs/PRODUCTION.md` |
| **Agência de arte**                               | Recebe a faca e as fotos, envia a arte, refaz quando a Wellmix devolve com o motivo, aplica o selo e entrega a arte final (não vê preços)                                                                                                                                          | Insumos, prazo e retorno na mesma mesa de trabalho        | `docs/PURCHASE_ORDER.md`, `docs/DESKS.md`                                      |
| **Certificadora (OCP)**                           | Lê a ficha de compra (sem o preço), as fotos do produto e os documentos de certificação; envia memorial, selo e certificado. Não abre o documento do pedido (dono, 15/11/2026)                                                                                                     | Uma fila única de certificados a emitir                   | `docs/CERTIFICATION.md`                                                        |
| **Agência de marketing (na origem; hoje, China)** | Confirma a chegada da amostra, envia fotos e vídeos reais por produto, devolve a amostra                                                                                                                                                                                           | Aprovação ou pedido de refação com motivo, no portal      | `docs/SAMPLE_FLOW.md`                                                          |
| **Agente de carga**                               | Registra a reserva no navio (booking) e acompanha o container na origem; no pedido de compra, o BL é da companhia marítima                                                                                                                                                         | Validação ou recusa com motivo no mesmo passo             | `docs/IMPORT_FLOW.md`, `docs/SHIPPING_DOCS.md`                                 |
| **Companhia marítima**                            | Responde às cotações de frete, envia a própria tabela, faz o BL (conferido linha a linha com a invoice) e confirma o embarque; não vê o cliente                                                                                                                                    | Cotação e confirmação de embarque em um lugar             | `docs/WORKFLOW.md`, `docs/IMPORT_FLOW.md`                                      |
| **Comex (assessoria)**                            | LPCO, presença de carga, numerário, canal, DI/DUIMP, CE Mercante, comprovante de importação; valida o rascunho do BL                                                                                                                                                               | Cada passo diz quem faz e quem valida                     | `docs/IMPORT_FLOW.md`, `docs/MAPA_PROCESSO.md`                                 |
| **Despachante**                                   | Número do processo, documentos, custos reais, liberação; valida o NCM do produto                                                                                                                                                                                                   | Lê os dados do embarque sem perguntar                     | `docs/IMPORT_FLOW.md`, `docs/CERTIFICATION.md`                                 |
| **Transportador**                                 | Vê a carga e o endereço, informa placa, previsão e situação, confirma a entrega (inclusive pelo celular)                                                                                                                                                                           | Tudo o que precisa para a entrega em um cartão            | `docs/DELIVERY.md`, `docs/PWA.md`                                              |
| **Jurídico**                                      | Vê as multas e muda a situação                                                                                                                                                                                                                                                     | Uma visão própria, sem o resto da operação                | `docs/WORKFLOW.md`                                                             |
| **Wellmix · Comprador**                           | Importa books, seleciona itens, abre e decide solicitações, escolhe estratégia de compra e cotação vencedora                                                                                                                                                                       | Do book ao pedido sem planilha paralela                   | `docs/BOOKING.md`, `docs/PURCHASE_DEMAND.md`                                   |
| **Wellmix · Gerente de produto**                  | Avalia amostras; produtos, linhas e certificados pendentes                                                                                                                                                                                                                         | Ficha do produto em um lugar                              | `docs/DESKS.md`, `docs/ACCESS.md`                                              |
| **Wellmix · Planner**                             | Abre reposições, acompanha ETD e os follow-ups de produção, containers e fretes                                                                                                                                                                                                    | Datas e ocupação de container visíveis                    | `docs/PRODUCTION.md`                                                           |
| **Wellmix · Cadastro**                            | Valida NCM, completa a ficha mestre, importa planilhas                                                                                                                                                                                                                             | Pendências de cadastro em fila                            | `docs/DESKS.md`                                                                |
| **Wellmix · Financeiro**                          | Valida e paga o numerário, registra a DANFE, é avisado de gerar o boleto                                                                                                                                                                                                           | Custos de importação conferidos no passo                  | `docs/IMPORT_FLOW.md`, `docs/CUSTOMER_PAYMENT.md`                              |
| **Wellmix · Qualidade (CD)**                      | Confere o recebimento: lacre, fotos, checklist e contagem por SKU                                                                                                                                                                                                                  | Divergência registrada na chegada                         | `docs/RECEIVING.md`                                                            |
| **Wellmix · Vendas**                              | Lança encomendas pelo cliente, registra ofertas, abre ordens de venda com reserva e data de entrega                                                                                                                                                                                | Oferta, ordem e agenda no mesmo fluxo                     | `docs/SALES_ORDERS.md`                                                         |
| **Wellmix · Designer**                            | Faz a arte quando não há agência; aprova as fotos reais                                                                                                                                                                                                                            | Aprovação que ativa a venda                               | `docs/SAMPLE_FLOW.md`                                                          |
| **Wellmix · Diretorias**                          | Aprovam a estratégia de compra e a cotação vencedora, assinam o contrato; painéis e auditoria                                                                                                                                                                                      | Decisão registrada, com quem e quando                     | `docs/PURCHASE_DEMAND.md`, `docs/ORDER_SIGNATURE.md`                           |
| **Wellmix · Comex interno**                       | Lança todo dia a situação do container                                                                                                                                                                                                                                             | Rastreio diário no pedido                                 | `docs/ORIGIN_CONTAINER.md`                                                     |
| **Wellmix · Administrador**                       | Todas as telas: configurações (SLA, tolerâncias, formas de pagamento), equipe e acessos, tipos de parceiro, finanças, retomar pedido pausado                                                                                                                                       | Controle de quem vê e faz o quê                           | `docs/ACCESS.md`                                                               |

### 1.2 Benefícios e atributos do portal

| #   | Benefício ou atributo                           | O que é, de concreto                                                                                                       | Onde está                                          |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **Um fluxo só**                                 | Menu pelos blocos do processo (Book, Pedido, Produção, Entrega, Vendas), com contador do que espera por você em cada passo | `docs/FLOW_MENU.md`                                |
| 2   | **Comunicação centralizada**                    | Uma conversa por empresa, com um assunto geral e um por solicitação, pedido ou item; fotos, vídeos e arquivos de até 50 MB | `src/lib/services/messages.ts`                     |
| 3   | **Quem deve a resposta**                        | Controle de mensagens com prazo de resposta de 1 dia útil                                                                  | `docs/SLA_PANEL.md`                                |
| 4   | **Pendências e mesas de trabalho**              | Caixa de tarefas por login e mesa por papel                                                                                | `docs/DESKS.md`                                    |
| 5   | **Notificações**                                | Sino e lista dentro do portal, no idioma de quem recebe                                                                    | `src/lib/services/notifications.ts`                |
| 6   | **Três idiomas**                                | Português, inglês e chinês, com troca no login                                                                             | `src/lib/db/schema.ts` (`LOCALES`)                 |
| 7   | **Acesso por papel**                            | Telas e ações por função; cada parceiro vê só os dados da própria empresa                                                  | `docs/ACCESS.md`, `docs/PARTNER_ACCESS.md`         |
| 8   | **Preço de compra reservado**                   | O cliente nunca vê fornecedor, FOB nem margem; permissão "Ver preço de compra"                                             | `docs/LINHA_DE_VISAO.md`                           |
| 9   | **Responsável, prazo e situação em cada etapa** | 16 marcos por pedido, com dependências e andamento                                                                         | `docs/MILESTONES.md`                               |
| 10  | **Control Tower**                               | O processo por etapa, com contagens, atrasos e "precisa de ação agora"                                                     | `docs/WORKFLOW.md`                                 |
| 11  | **Painel de SLA**                               | Atrasado, vence hoje, próximos 7 dias, atraso de parceiros, responsável por tarefa                                         | `docs/SLA_PANEL.md`                                |
| 12  | **Painéis e indicadores**                       | Painéis por área, painel do dono e fluxo de caixa, reconstruídos toda noite                                                | `docs/RESUMOS.md`, `docs/DASHBOARDS.md`            |
| 13  | **Auditoria**                                   | Quem fez, quando, o quê, antes e depois                                                                                    | `docs/DASHBOARDS.md`                               |
| 14  | **Book e Superplan**                            | Planilhas dos fornecedores importadas e analisadas (custo por peça, preço mínimo, alvo)                                    | `docs/BOOKING.md`, `docs/SUPERPLAN.md`             |
| 15  | **Negociação e amostragem**                     | Rodadas de fotos e vídeos da amostra com o fornecedor                                                                      | `docs/SUPPLIER_SAMPLING.md`                        |
| 16  | **Compra por demanda**                          | Encomenda do cliente, reposição, estratégia de compra e cotação de 24 h com aprovação da diretoria                         | `docs/PURCHASE_DEMAND.md`                          |
| 17  | **Programação de compra**                       | Pedido pai com pedidos filhos por rodada                                                                                   | `docs/PURCHASE_SCHEDULE.md`                        |
| 18  | **Arte e certificação em paralelo**             | Faca, arte, validação da Wellmix e arte final com o selo                                                                   | `docs/PURCHASE_ORDER.md`, `docs/CERTIFICATION.md`  |
| 19  | **Contrato com as duas assinaturas**            | Documento do pedido com versão identificada; o pedido segue depois das duas assinaturas                                    | `docs/ORDER_SIGNATURE.md`                          |
| 20  | **Inspeção documentada**                        | Fotos, peso, vídeo, declaração de conformidade, aprovação por SKU e fila de revisão                                        | `docs/PRODUCTION.md`                               |
| 21  | **Container na origem**                         | Fotos e vídeos do container vazio e do carregamento, lacre e número                                                        | `docs/ORIGIN_CONTAINER.md`                         |
| 22  | **Documentos conferidos linha a linha**         | Check list de carga, packing list, invoice e BL (caixas, peças, pesos)                                                     | `docs/SHIPPING_DOCS.md`                            |
| 23  | **Amostras e fotos reais**                      | As fotos reais aprovadas substituem as de referência e ativam a venda                                                      | `docs/SAMPLE_FLOW.md`                              |
| 24  | **Entrega com quem faz e quem valida**          | Canal cinza ou vermelho pausa o pedido; transportadora padrão pelo porto; conferência no recebimento                       | `docs/DELIVERY.md`, `docs/RECEIVING.md`            |
| 25  | **Containers**                                  | CBM, ocupação e regra de mix; comparação de tabelas de frete                                                               | `src/lib/services/containers.ts`                   |
| 26  | **Pagamento do cliente e vendas**               | Formas de pagamento, parcelas e boletos; ordens de venda com reserva e agenda de entregas                                  | `docs/CUSTOMER_PAYMENT.md`, `docs/SALES_ORDERS.md` |
| 27  | **Aplicativo instalável**                       | Funciona no celular, no tablet e no computador e instala como aplicativo                                                   | `docs/PWA.md`                                      |
| 28  | **Feito para o Sankhya**                        | Cadastros e histórico carregados do ERP; envio de pedido e cadastro ao ERP                                                 | `docs/SANKHYA.md`                                  |

### 1.3 O que os vídeos não prometem

Estas coisas **não** estão ditas nem mostradas, porque não é assim que o portal funciona hoje. Quem mexer no roteiro precisa manter isso.

- **E-mail e WhatsApp:** hoje só o sino do portal avisa (os dois são simulados).
- **Rastreio automático e reserva automática de navio:** o rastreio é lançado todo dia pelo Comex interno.
- **Pagamento on-line:** não há gateway; o boleto nasce no Sankhya e o portal só lê.
- **Sincronia em tempo real com o ERP:** o vídeo diz "feito para trabalhar com o Sankhya" (a escrita no ERP começa desligada, em simulação).
- **Assinatura digital certificada:** o pedido de compra é assinado enviando o PDF assinado e carimbado.
- **Uso sem conexão**, **IA que decide sozinha** e a **vitrine do cliente** (escondida do menu).
- **Fluxo antigo:** RFQ, cotação ao cliente, proposta e sinal saíram em 11/11/2026 (`docs/QUOTE_FLOW.md`).
- **"Tempo real":** a tela atualiza ao abrir; o vídeo diz "a gestão vê", não "em tempo real".

Decisões do dono em 15/11/2026, depois de assistir à primeira versão:

- **Sem país de origem.** A Wellmix não importa só da China: a narração fala em "a factory abroad" e "at origin", e o mapa da abertura mostra várias origens sem destacar nenhuma. Chinês e inglês continuam citados só como **idiomas** do portal.
- **Cena do cliente mantida.** Ela mostra forma de pagamento, parcelas, boletos e a confirmação do recebimento. Essas telas existem para o **cliente do pedido**; hoje todo pedido de compra é da própria Wellmix ("clientes terceiros só virão com a vitrine", `src/lib/services/purchase-order.ts`), então o login de um cliente vê a encomenda dele, a situação dela e a conversa com a Wellmix. O dono preferiu manter a cena como está.

Limites que a revisão independente encontrou e o roteiro respeita:

- **BL:** no pedido de compra quem faz o BL é a companhia marítima (`docs/SHIPPING_DOCS.md`), não o agente de carga.
- **Certificadora:** não abre o documento do pedido (tem o preço de compra); usa a ficha de compra e os documentos de certificação (`docs/ORDER_SIGNATURE.md`).
- **Quem não vê fornecedor nem preço:** o transportador (e o cliente). A companhia marítima vê o fornecedor e, nos documentos do embarque, o preço da invoice; por isso o cartão de acesso mostra o transportador.
- **"O cliente nunca vê o fornecedor"** é a regra de acesso (`canSeeSupplier`); há um ponto em aberto em `docs/PARTNER_ACCESS.md` (multas dentro do pedido mostram o nome do responsável).
- **Mesa de trabalho** existe para cinco mesas (`docs/DESKS.md`); o vídeo diz que cada função tem as suas telas e pendências.
- **Lacre:** no carregamento vão a foto do lacre e o número do container; o número do lacre é conferido no recebimento.

Os balões de conversa e os cartões "Notifications · 3 new" da cena de comunicação são **ilustrações** desenhadas sobre a tela real do pedido (os botões "Conversar com" são do portal).

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

### Completo (4:43)

| Tempo | Capítulo              | Cena                                                                                                |
| ----- | --------------------- | --------------------------------------------------------------------------------------------------- |
| 0:00  |                       | Vinheta do portal                                                                                   |
| 0:06  | O desafio             | A rota e as mãos por onde a carga passa; cada um no seu canal                                       |
| 0:24  |                       | Um portal, um fluxo (os papéis em volta da marca)                                                   |
| 0:37  | A jornada             | Os cinco blocos: Book, Pedido, Produção, Entrega e Vendas                                           |
| 1:06  | Quem faz o quê        | Cliente                                                                                             |
| 1:19  |                       | Fornecedor                                                                                          |
| 1:36  |                       | Agência de arte                                                                                     |
| 1:49  |                       | Certificadora                                                                                       |
| 1:59  |                       | Agência de marketing na origem                                                                      |
| 2:10  |                       | Agente de carga e companhia marítima                                                                |
| 2:22  |                       | Comex e despachante                                                                                 |
| 2:33  |                       | Transportador (com o celular)                                                                       |
| 2:42  |                       | Dentro da Wellmix: comprador, gerente de produto, planner, cadastro, designer, jurídico             |
| 3:02  |                       | Financeiro, qualidade, vendas, diretorias, administrador, comex interno                             |
| 3:23  | Uma conversa          | Comunicação dentro do portal: conversa por empresa, anexos, sino, pendências e quem deve a resposta |
| 3:45  | Feito para o controle | Três idiomas                                                                                        |
| 3:49  |                       | Acesso por papel (o que cada um vê e o que fica oculto)                                             |
| 3:59  |                       | Qualidade documentada: inspeção, carregamento, documentos                                           |
| 4:13  |                       | Control Tower, painel de SLA, painéis e auditoria                                                   |
| 4:26  |                       | Qualquer tela, instala como aplicativo; feito para o Sankhya                                        |
| 4:34  |                       | Assinatura                                                                                          |

O texto completo da narração e das legendas está em `scripts/video/script.mjs` (uma fala por linha, com pt e zh ao lado) e nos arquivos de [`legendas/`](legendas/).

## 3. Como os vídeos são feitos

Nada é gravado à mão: o vídeo é desenhado em HTML e renderizado quadro a quadro, então dá para refazer quando o portal mudar.

| Etapa          | Arquivo                      | O que faz                                                                                                             |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Roteiro        | `scripts/video/script.mjs`   | Cenas, narração (en) e legendas (pt, zh)                                                                              |
| Telas          | `scrub.mjs`, `shots.mjs`     | Limpa os nomes de teste da base de demonstração e captura as telas reais em pt, zh e en                               |
| Voz            | `tts/tts.py`, `tts/check.py` | Narração sintética em inglês, gerada na máquina (modelo aberto Kokoro, voz `af_heart`), e conferência por transcrição |
| Linha do tempo | `build.mjs`                  | Mede cada fala e calcula a duração das cenas e das legendas (confere os limites de `docs/videos/GUIA.md`)             |
| Música         | `tts/track.py`               | Corta a faixa do dono nos compassos: a batida entra quando a marca aparece e o acorde final cai na assinatura         |
| Imagem         | `film/`, `render.mjs`        | O palco (HTML e CSS) e o renderizador (60 quadros por segundo)                                                        |
| Fechamento     | `mix.mjs`                    | Voz + música (a música abaixa cerca de 12 dB sob a fala), −16 LUFS, vinheta + filme                                   |

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
for l in pt zh en; do node shots.mjs $l; done
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

Mudou o texto de uma fala? Só ela é gerada de novo, e a duração das cenas se ajusta sozinha. `tts/track.py` avisa se o acorde final da música deixou de cair na assinatura; ajuste as folgas (`pre` e `post`) da cena final em `script.mjs`.

## 4. Pontos para o dono decidir ou conferir

1. **Áudio.** Quem montou não ouve áudio: a narração foi conferida por transcrição automática (todas as falas batem com o roteiro) e os volumes por medição (−16 LUFS, música cerca de 12 dB abaixo da fala). O dono assistiu à primeira versão em 15/11/2026 e aprovou; pediu só tirar a China do exemplo.
2. **Voz.** É sintética (boa qualidade, sem custo). Para trocar por locutor, basta gravar as falas de `script.mjs` com os mesmos nomes de arquivo; o resto se ajusta.
3. **Música no completo.** A faixa enviada tem 2:15 e o nome dela fala em vídeo curto; no completo ela foi estendida repetindo blocos inteiros (sem emenda audível na medição). Se preferir outra música para o completo, é só trocar `scripts/video/music/track.mp3` (o encaixe pressupõe 120 BPM e a forma descrita em `tts/track.py`).
4. **"Importação direta · desde 2010"** aparece desenhado na vinheta; a narração não repete a data.
5. **Versão só em inglês** (sem legenda queimada, com a tela em inglês) não foi pedida; sai com mais uma renderização.
6. **Onde publicar** (YouTube não listado, Vimeo, LinkedIn) e se o portal ganha um link para o vídeo completo.
