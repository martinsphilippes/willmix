# Inventário do papel FORNECEDOR (`supplier`) no portal Wellmix

Levantamento só de leitura (docs + código + E2E), feito em 14/11/2026 sobre o branch atual (`ddba121`). Nada foi alterado no repositório e nada foi executado na tela: o que está aqui vem da leitura do código e dos testes de ponta a ponta. Onde digo "E2E" o comportamento é exercitado por um teste Playwright; onde digo "leitura do código" ele não foi reproduzido na tela.

**Como ler os rótulos.** Todo texto de tela vem do dicionário pt já fundido (`src/i18n/dictionaries.ts` + `src/i18n/modules/*.ts`), no formato **"Texto exato"** (`chave.i18n`). As contas de demonstração do fornecedor abrem em outro idioma (`supplier.a@china.com` zh, `supplier.b@china.com` en, `supplier.c@china.com` zh; senha `wellmix123`): para gravar em português é preciso trocar o idioma no seletor **"Idioma"** (`nav.language`).

**Estado inicial dos dados.** A carga de demonstração (`src/lib/seed.ts`) cria contas, cadastros, linhas e produtos, mas **nenhum book, solicitação ao fornecedor ou pedido**. Todas as telas do fornecedor começam vazias; cada tarefa abaixo diz o que a Wellmix precisa fazer antes (e como o E2E chega lá).

**Quem é "fornecedor" aqui.** O papel `supplier` cobre o Fornecedor de verdade (cadastro tipo `supplier`) e também os tipos Trading, Factory, Supplier (`supplier_partner`), GP e os tipos criados no painel com login, que "entram como o Fornecedor entra" (docs/PARTNER_TYPES.md, regra 8). A diferença prática: esses tipos recebem a tela **Book** de fábrica; o Fornecedor de verdade não (seção 4, D-P1).

---

## 1. Menu e telas do fornecedor

Fonte: `src/lib/nav.ts` (`navFor`, ramo dos parceiros), `src/lib/flow.ts` (`PARTNER_FLOW_STEPS.supplier`), `src/lib/auth/screens.ts` (`ROLE_SCREENS.supplier` = home, tasks, notifications, messages, orders, quotes, account).

### 1.1 Cabeçalho (ícones, fora da barra lateral)

| Rótulo pt | Chave | Rota |
| --- | --- | --- |
| **Mensagens** | `nav.messages` | `/app/messages` |
| **Notificações** | `nav.notifications` | `/app/notifications` |

Mensagens e Notificações ficam só nos ícones do cabeçalho, com contador (`SIDEBAR_HIDDEN`, dono 14/11/2026; E2E `home-screens.spec.ts`, "Mensagens e Notificações ficam só nos ícones do cabeçalho").

### 1.2 Barra lateral, na ordem

| # | Grupo | Item (rótulo pt) | Chave | Rota |
| - | --- | --- | --- | --- |
| 1 | (link direto) | **Pendências** (com contador) | `nav.tasks` | `/app` |
| 2 | **Pedido** (`nav.group.order`) | **Pedidos** | `flow.step.order.orders` | `/app/flow/order/orders` |
| 3 | Pedido | **Material de arte** | `flow.step.order.art-material` | `/app/flow/order/art-material` |
| 4 | Pedido | **Contrato** | `flow.step.order.contract` | `/app/flow/order/contract` |
| 5 | **Produção** (`nav.production`) | **Inspeção** | `flow.step.production.inspection` | `/app/flow/production/inspection` |
| 6 | Produção | **Amostra** | `flow.step.production.sample` | `/app/flow/production/sample` |
| 7 | Produção | **Logística** | `flow.step.production.logistics` | `/app/flow/production/logistics` |
| 8 | Produção | **Carregamento** | `flow.step.production.loading` | `/app/flow/production/loading` |
| 9 | Produção | **Documentos de carga** | `flow.step.production.cargo-docs` | `/app/flow/production/cargo-docs` |
| 10 | Produção | **Embarque** | `flow.step.production.shipment` | `/app/flow/production/shipment` |
| 11 | **Meus books** (`nav.group.myBookings`) | **Book** (só com a tela liberada; ver D-P1) | `nav.booking` | `/app/booking` |
| 12 | Meus books | **Convites de book** | `nav.bookingInvites` | `/app/supplier-requests/invites` |
| 13 | Meus books | **Solicitações ao fornecedor** | `nav.supplierRequests` | `/app/supplier-requests` |
| 14 | Meus books | **Pedidos** | `nav.orders` | `/app/orders` |
| 15 | Meus books | **Conta corrente** | `nav.account` | `/app/account` |

Observações:

- O item 1 chama-se **Pendências** no menu, mas o título da tela é **"Minhas pendências"** (`tasks.title`), com o subtítulo **"Olá, {name}"** (`home.welcome`). Sem a tela Pendências no perfil, o item vira **"Início"** (`nav.home`).
- Os fornecedores não têm "Overview" de bloco (só a Wellmix). Bloco **Entrega** não aparece (nenhum passo dele é do fornecedor).
- Cada passo dos blocos tem contador do que espera ação do fornecedor (**"{n} esperando ação"**, `flow.badge`).
- Dois itens chamam-se **Pedidos**: o passo do bloco Pedido (`/app/flow/order/orders`, só o que espera ação) e a lista de todos (`/app/orders`). A tela do passo tem o link **"Lista de todos os pedidos"** (`flow.orders.list`).
- Menu do usuário (pé do menu): **"Idioma"** (`nav.language`), link para `/app/password` (**"Trocar senha"**, `password.menu`) e **"Sair"** (`nav.logout`). Embaixo do nome aparece o papel **"Fornecedor"** (`role.supplier`) ou, nos tipos Trading/Factory/GP, o nome do tipo.

### 1.3 Telas que se abrem a partir das de cima (sem item próprio no menu)

| Tela | Rota |
| --- | --- |
| Pendências com filtros | `/app/tasks?due=…&type=…` |
| Solicitação (tabela dos produtos) | `/app/supplier-requests/[id]` |
| Solicitação, tela do produto | `/app/supplier-requests/[id]?view=item` (âncora `#amostragem`) |
| Um convite de book | `/app/supplier-requests/invites/[id]` |
| Detalhe do pedido | `/app/orders/[id]` (âncoras `#production`, `#container-origin`, `#samples-flow`, `#import-flow`, `#supplier-payment`, `#order-documents`) |
| Quadro Die Cut | `/app/orders/[id]/die-cut` |
| Documento do pedido (contrato) | `/app/orders/[id]/purchase-order` e o PDF em `/api/orders/[id]/purchase-order` |
| Pedido de amostras | `/app/orders/[id]/samples` |
| Documentos do embarque | `/app/orders/[id]/shipping-docs` |
| Ficha de compra | `/app/orders/[id]/purchase-sheet` (ver seção 3, D9) |
| Pedido dentro de um passo | `/app/flow/<bloco>/<passo>/<pedido>` (só nos passos dele) |
| Lançar book / um book | `/app/booking/import`, `/app/booking/lots/[id]` (só com a tela Book) |

### 1.4 Como são as telas dos passos do menu (itens 2 a 10)

Todas iguais (`src/app/app/flow/[block]/[step]/page.tsx`): título = nome do passo, duas abas **"Pendências"** (`flow.tab.pending`) e **"Todos no passo"** (`flow.tab.all`), filtros de prazo **"Todas"**, **"Atrasadas"**, **"Hoje"**, **"Até 7 dias"** (`flow.due.*`), tabela com **"O que espera"**, **"Prazo"**, **"Há"** (`flow.cases.what|due|since`) e o botão **"Resolver"** (`flow.cases.open`). Embaixo, os cartões **"Resolver aqui"** (`flow.work.title`) com o mesmo formulário do pedido e o link **"Abrir o pedido completo"** (`flow.work.openOrder`). Vazio: **"Nada esperando ação neste passo."** (`flow.cases.empty`). Passo que não é dele dá 404 (E2E `happy-path.spec.ts`: `/app/flow/delivery/storage/<pedido>` → 404).

O mesmo trabalho pode ser feito por três caminhos: Pendências → **"Abrir"**; menu do passo → **"Resolver"**; ou Pedidos → pedido → cartão. Nos passo a passo abaixo uso o caminho que o E2E percorre.

---

## 2. Tarefas

Ordem: da mais frequente e crítica para a mais rara. Frequência e criticidade são **estimativas** minhas a partir do fluxo (o código não mede uso).

Legenda de cobertura: **E2E-HP** = `tests/e2e/happy-path.spec.ts`, teste "booking → seleção → solicitação ao fornecedor → produto → pedido de compra → raias → contrato → pagamento → inspeção → embarque → desembaraço → transporte → entrega"; **E2E-BSR** = `tests/e2e/booking-supplier-request.spec.ts`.

### T1. Conferir as pendências do dia (tela inicial)

- **Quando e por quê:** todo acesso. É a tela inicial: reúne tudo que depende do fornecedor, do Book ao embarque.
- **Frequência / criticidade:** diária / alta (é por onde se chega a todas as outras tarefas).
- **Rota:** `/app` (menu **Pendências**); filtros em `/app/tasks?...`.
- **Pré-condição:** nenhuma para abrir. Vazia: **"Nenhuma pendência agora. Quando algo chegar para você, aparece aqui, na etapa certa."** (`supplierTasks.empty`).
- **Passo a passo:**
  1. Ler a faixa **"Etapas que chegam até você"** (`supplierTasks.steps.title`), com nove quadrados numerados na ordem: **"Analisar o Book"** (`tasks.group.supplier.booking`), **"Responder a solicitação"** (`.request`), **"Enviar a amostragem"** (`.sampling`), **"Die Cut"** (`.dieline`), **"Ficha de compra"** (`.sheet`), **"Aprovar a arte"** (`.art`), **"Assinar o pedido"** (`.sign`), **"Produção e inspeção"** (`.inspection`), **"Embarque"** (`.shipping`). Cores: **"Atrasado"** (vermelho), **"A fazer, no prazo"** (amarelo), **"Concluído ou nada a fazer"** (verde) (`supplierTasks.legend.*`).
  2. Tocar numa etapa filtra a lista e mostra a explicação dela; **"Todas as etapas"** (`supplierTasks.steps.all`) tira o filtro.
  3. Filtro **"Prazo"** (`tasks.filter.due`): **"Todas"**, **"Atrasadas"**, **"Vencem hoje"**, **"Até 7 dias"**, **"Mais adiante"**, **"Sem prazo"**; **"Limpar filtros"** (`tasks.filter.clear`).
  4. Tabela: **"Pendência"**, **"Detalhe"**, **"Etapa"** (`supplierTasks.col.step`), **"Com você desde"** (`supplierTasks.col.since`), **"Prazo"**; em cada linha, o botão **"Abrir"** (`tasks.open`) e o ícone de conversa (**"Conversar sobre este pedido ou solicitação"**, `chat.open`). Selos **"Atrasado"** (`common.overdue`) e **"vence hoje"** (`tasks.due.today`).
- **Depois:** nada muda; a pendência sai sozinha quando a ação é feita.
- **Erros / bloqueios:** tela negada mostra **"Você não tem acesso a {screen}. Peça ao administrador em Gestão → Equipe e divisões."** (`access.denied`; o caminho citado só existe para a Wellmix, achado 24 do ACHADOS.md).
- **Regras:** a lista vem ordenada pelo prazo (**"Prazo: escolha pelo vencimento. A lista já vem com as mais urgentes primeiro."**, `supplierTasks.due.hint`); "atrasada" só no dia seguinte ao prazo (dia civil de Brasília). Rodapé: **"Depois do embarque (desembaraço, transporte e entrega ao cliente) nada depende de você. Para acompanhar, abra Pedidos."** (`supplierTasks.after`).
- **E2E:** E2E-HP (abre `/app/tasks` como fornecedor e localiza a pendência do Die Cut pelo grupo `supplier.dieline`).
- **Complexidade:** baixa.
- **Atenção para o roteiro:** três das nove etapas têm nome ou explicação do fluxo antigo (seção 3, D1 a D3).

### T2. Responder a solicitação ao fornecedor (aprovar, renegociar ou recusar a oferta)

- **Quando e por quê:** a Wellmix escolheu um item do book dele e pergunta se ele faz, em que preço, MOQ, entrega e prazo. É o começo de todo negócio.
- **Frequência / criticidade:** por solicitação (várias por semana para um fornecedor ativo, estimativa) / **muito alta**: o SLA padrão da negociação é de **30 minutos** entre a abertura e a decisão da Wellmix (`supplierRequestSlaMinutes`, Configurações → SLA, de 1 a 86.400).
- **Rotas:** `/app/supplier-requests` → `/app/supplier-requests/[id]` (tabela) → `?view=item` (tela do produto).
- **Pré-condição:** uma solicitação aberta para o cadastro dele. Quem cria: a Wellmix (book fechado → Seleção de itens → **Gravar escolha** → abrir a solicitação dos blocos). E2E: `importAndClose` + `selectAndOpenSupplierRequest` (`tests/e2e/helpers.ts`), com a planilha de `bookingSheet("Shenzhen Supplier A", …)` (FOB, USD 1,25, 48 peças/caixa, MOQ 1.000).
- **Passo a passo (pela tabela, o caminho do E2E):**
  1. Menu **Solicitações ao fornecedor**. A lista (**"Pedidos da Wellmix para saber se você faz um item e em que condições. Abra e responda."**, `supplierRequests.list.subtitleSupplier`) tem as colunas **"Nº"**, **"Situação"**, **"Item"**, **"Quantidade"**, **"Produtos distintos"**, **"Resposta"**, **"Aberta em"**, **"Finalizada em"** (`supplierRequests.col.*`). Clicar no número.
  2. Abre **"Solicitação ao fornecedor nº {n}"** (`supplierRequests.detail.title`) com o cartão **"Produtos desta solicitação"** (`supplierRequests.table.title`): uma linha por produto (numeradas 2.1, 2.2… quando há vários), com a ficha do item, **"Condições iniciais (book)"** e **"Condições finais (última proposta)"**, **"Vez"**, e as colunas fixas à direita **"Situação / SLA"** e **"Ações"**.
  3. Na coluna **Ações**, linha de baixo, três ícones (legenda **"Na linha de baixo, por item:"**, `supplierRequests.table.hintAnswers`):
     - ✓ **"Aprovar oferta"** (`supplierRequests.table.approve`; nome completo **"Aprovar oferta: {price}/peça"**, `.confirm`). Abre a caixa **"Aprovar oferta · solicitação nº {n}"** com produto, **"Preço"**, **"MOQ"**, **"FOB/EXW"**, **"Prazo (dias)"** e a explicação (**"Aceita a oferta do book como está: preço, moeda, pedido mínimo e entrega."**, `.confirmHint.book`). Só o botão verde **"Aprovar oferta"** envia; **"Cancelar"**, ×, Esc ou tocar fora fecham sem gravar.
     - ⇄ **"Renegociar"** (`.renegotiate`; dica **"Mudar as condições e enviar uma contraproposta"**). Caixa **"Renegociar · solicitação nº {n}"** com **"Preço por peça"** (obrigatório), **"Moeda"** (USD, RMB, BRL, EUR), **"Pedido mínimo (peças)"**, **"Modalidade de entrega"** (FOB/EXW), **"Observação"** e o botão **"Enviar contraproposta"** (`.renegotiateSend`). O prazo não aparece aqui (**"As condições em vigor já estão preenchidas. Mude o que quiser e envie; o item fica em negociação até a Wellmix responder."**, `.renegotiateText`).
     - ✕ **"Recusar oferta"** (`.refuse`). Caixa **"Recusar oferta · solicitação nº {n}"**; botão vermelho **"Recusar oferta"** (**"Responde que não faz este item."**, `.refuseHint.book`).
  4. Para informar também o **prazo de produção**, usar o ícone **"Abrir produto"** (`supplierRequests.table.open`) e o cartão **"Resposta do fornecedor"** (`supplierRequests.detail.answer.title`): **"Faz o que foi pedido?"** (**"Sim, faço"** / **"Não faço"**), **"Preço por peça"**, **"Moeda"**, **"Pedido mínimo (peças)"**, **"Prazo de produção (dias)"**, **"Modalidade de entrega"**, **"Observação"**, botão **"Enviar resposta"** (`supplierRequests.detail.answer.submit`). Depois de gravado aparece **"✓ Enviado"** (`.answer.sent`) ao lado do botão. **"Ver todos os produtos"** (`supplierRequests.table.back`) volta à tabela.
- **Depois:** a situação passa de **"Aberta"** a **"Respondida"**; a coluna **"Faz?"** mostra **"Faz"** ou **"Não faz"**; a vez passa à Wellmix (**"Esperando a Wellmix"**, `supplierRequests.negotiation.turn.wellmix`); quem abriu a solicitação é avisado (sino). Avisos na tela: **"Resposta registrada."**, **"Oferta confirmada."**, **"Oferta recusada."**. A pendência sai de "Responder a solicitação".
- **Erros / bloqueios:**
  - **"A oferta deste item mudou desde que a tela foi aberta. Nada foi gravado: confira os valores atuais e responda de novo."** (`supplierRequests.error.supplier_request_offer_changed`).
  - **"Informe o preço por peça para dizer que faz."** (`…supplier_request_price_required`).
  - **"A Wellmix já decidiu esta solicitação: a resposta não muda mais."** (`…supplier_request_closed`).
  - **"Algum valor não dá para ler. Use números maiores que zero."** (`…invalid_input`).
- **Regras:** só o fornecedor responde (a Wellmix, mesmo admin, não responde por ele). Pode mudar a resposta até a Wellmix decidir (**"Você pode mudar a resposta até a Wellmix decidir."**). ✓ só aparece quando há preço na oferta e a oferta não é a própria resposta dele. Ele não vê as alternativas (outros fornecedores), o Superplan nem o book. Outro fornecedor recebe 404. Situações: **Aberta → Respondida → Aprovada / Recusada**, ou **Cancelada**. Selo de SLA **"No prazo"** / **"Atrasada"**, com o **"+"** que mostra a data e a hora do prazo.
- **E2E:** E2E-BSR, testes "booking → seleção de itens → solicitação ao fornecedor → produto" (renegociar, isolamento, 404 do fornecedor B) e "tabela da solicitação: aprovar e recusar pedem confirmação"; E2E-HP passo 3.
- **Complexidade:** média (tabela larga, com rolagem horizontal; três ícones sem texto).

### T3. Responder a contraproposta da Wellmix (aceitar, nova proposta ou recusar)

- **Quando e por quê:** ele respondeu "faz" e a Wellmix devolveu com outros valores e um comentário.
- **Frequência / criticidade:** por negociação / alta (enquanto ele não responde, a Wellmix não aprova).
- **Rotas:** `/app/supplier-requests/[id]` e `?view=item`.
- **Pré-condição:** solicitação **Respondida** com "faz" + contraproposta da Wellmix (**"Devolver com contraproposta"**, comentário obrigatório). E2E-BSR passo 3b (admin propõe 1,30 USD, 35 dias, FOB).
- **Passo a passo:**
  1. Pendência **"Solicitação nº {n}: {product}"** com o detalhe **"A Wellmix enviou uma contraproposta: aceite, proponha de novo ou recuse"** (`supplierTasks.request.counter`) → **"Abrir"**.
  2. Na tabela, a coluna **Vez** mostra **"Contraproposta esperando você: confirme, renegocie ou recuse."** (`supplierRequests.table.proposalPending`). O ✓ passa a valer para a contraproposta (**"Aceita a contraproposta da Wellmix como está."**).
  3. Ou abrir o produto: cartão **"Negociação e conversa"** (`supplierRequests.negotiation.title`) com o aviso **"A Wellmix devolveu com uma contraproposta. Aceite, responda com outra proposta ou recuse."** e o formulário **"Responder à contraproposta"**: mesmos campos (preço, moeda, MOQ, prazo, modalidade), **"Comentário (opcional)"** e três botões: **"Aceitar"**, **"Enviar nova proposta"**, **"Recusar"** (`supplierRequests.negotiation.accept|counter|reject`).
- **Depois:** **"Contraproposta aceita: os valores propostos viraram a resposta."** / **"Nova proposta enviada."** / **"Contraproposta recusada: fica a resposta anterior."** (`supplierRequests.negotiation.notice.*`). A vez volta à Wellmix; quem abriu é avisado. No **"Histórico de interações"** (`supplierRequests.timeline.title`) entra o passo. Na ficha, **"Preço negociado"** com o do book riscado ao lado.
- **Erros:** **"Não há contraproposta esperando resposta."** (`…supplier_request_no_proposal`); nova proposta sem preço → **"Informe o preço por peça para dizer que faz."**. Com contraproposta esperando, o formulário comum de resposta é recusado: **"Há uma contraproposta esperando o fornecedor: ele aceita, responde com outra proposta ou recusa."** (`…supplier_request_proposal_pending`).
- **Regras:** sem limite de rodadas; só uma contraproposta espera de cada vez; a modalidade (FOB/EXW) aceita vira a do fornecedor.
- **E2E:** aceitar pela tela do produto: E2E-BSR. Nova proposta e recusa da contraproposta: **não cobertas por E2E** (há `tests/unit/supplier-request-negotiation.test.ts`).
- **Complexidade:** média.

### T4. Conversar na solicitação (mensagem e arquivo)

- **Quando:** dúvida ou combinado fora dos campos, com foto, PDF ou Excel.
- **Frequência / criticidade:** por negociação / média.
- **Rotas:** tabela e tela do produto da solicitação.
- **Pré-condição:** solicitação **Aberta, Respondida ou Aprovada**.
- **Passo a passo:** (a) na tabela, ícone **"Mensagem"** (`supplierRequests.table.message`) → caixa **"Mensagem à Wellmix · solicitação nº {n}"** → campo **"Mensagem"** → **"Enviar"**; (b) na tela do produto, o ícone flutuante **"Abrir a conversa"** (`supplierRequests.chat.open`) → janela **"Conversa · solicitação nº {n}"** → **"Escreva uma mensagem"**, **"Arquivo (opcional)"**, **"Enviar"**.
- **Depois:** **"Mensagem enviada."**; a Wellmix é avisada; a mensagem entra no Histórico de interações.
- **Erros:** **"Escreva a mensagem ou escolha um arquivo."** (`…supplier_request_message_empty`); **"Arquivo não aceito: envie foto, PDF ou Excel."** (`…supplier_request_file_type`). Encerrada: **"Solicitação encerrada: a conversa fica só para leitura."**
- **Regras:** texto até 4.000 caracteres; arquivo PDF, PNG, JPG, WEBP, HEIC ou Excel; só a Wellmix e o fornecedor da solicitação abrem o arquivo.
- **E2E:** E2E-BSR (mensagem pela tabela e pelo chat flutuante).
- **Complexidade:** baixa.

### T5. Enviar a amostragem (fotos e vídeos da amostra) depois da aprovação

- **Quando e por quê:** a Wellmix aprovou a solicitação. Antes de criar o produto e gerar o pedido, ela valida fotos e vídeos de uma amostra feita em impressora 3D. Sem amostra aprovada não há produto nem pedido.
- **Frequência / criticidade:** uma vez por produto aprovado (mais uma rodada a cada reprovação) / alta; prazo padrão de **1 dia** (`samplingSlaDays`, 1 a 30).
- **Rota:** `/app/supplier-requests/[id]?view=item#amostragem`.
- **Pré-condição:** solicitação **Aprovada** (decisão da Wellmix). E2E-BSR passo 4 / E2E-HP passo 4.
- **Passo a passo:**
  1. Pendência **"Amostragem da solicitação nº {n}: {product}"** (`supplierTasks.sampling.title`), detalhe **"Envie fotos e vídeos de uma amostra do item"**, na etapa **"Enviar a amostragem"** → **"Abrir"**. Na tabela, a coluna Situação mostra **"Amostragem"** + selo **"Esperando a amostra"** (`sampling.status.pending`), que é link para o cartão.
  2. Cartão **"Amostragem"** (`sampling.title`), com **"Rodada {n}"** e **"Prazo: {date}"**. Texto: **"A Wellmix aprovou este produto. Agora envie fotos e vídeos da amostra do item feita em impressora 3D (detalhes, medidas, encaixes) e mande para a validação. A amostra física não é enviada."** (`sampling.intro.supplier`).
  3. Botão **"Adicionar foto ou vídeo"** (`sampling.upload.label`), um arquivo por vez. Cada arquivo aparece em **"Fotos e vídeos da rodada {n}"**; o ✕ tira (**"Tirar {name}"**).
  4. Opcional: **"Observação para a Wellmix (opcional)"**. Botão **"Enviar para a validação"** (`sampling.submit.button`).
- **Depois:** selo **"Esperando a validação da Wellmix"**; texto **"Enviada em {date}. A Wellmix vai conferir e avisar."**; quem abriu a solicitação é avisado. Aprovada: **"Amostra aprovada"** / **"Aprovada em {date}."**. Reprovada: selo **"Amostra reprovada: envie de novo"**, o motivo em vermelho no cartão, nova rodada; os arquivos antigos ficam em **"Rodadas anteriores"**; nova pendência com **"A Wellmix reprovou a amostra: envie de novo"**.
- **Erros / bloqueios:** sem arquivo o botão não aparece: **"Adicione ao menos uma foto ou vídeo para enviar."** (`sampling.submit.needFile`); **"Arquivo acima de 50 MB. Grave um vídeo mais curto."** (`sampling.upload.tooBig`); **"Envie uma foto (JPG, PNG, HEIC) ou um vídeo (MP4, MOV)."** (`…sampling_file_type`); **"Limite de arquivos da rodada atingido."** (`…sampling_too_many`); **"A amostragem não aceita arquivos agora (enviada ou já aprovada)."** (`…sampling_closed`).
- **Regras:** até 50 MB por arquivo, até 30 por rodada; foto JPG, PNG, WEBP, HEIC/HEIF; vídeo MP4, MOV, WEBM, 3GP (`SAMPLING_PHOTO_MIME`, `SAMPLING_VIDEO_MIME`); só o responsável pelo book envia; outro fornecedor não vê (404). Passado o prazo: **"Atrasada"** no cartão e na tabela, e um aviso por rodada.
- **E2E:** E2E-BSR (4.1) e E2E-HP (uma foto, enviar, aprovada). Reprovação e segunda rodada: **não cobertas por E2E** (`tests/unit/supplier-request-sampling.test.ts`).
- **Complexidade:** baixa.

### T6. Die Cut: enviar a faca e a foto em alta e confirmar pedido mínimo e prazo

- **Quando e por quê:** a Wellmix gerou o pedido de compra. A agência só faz a arte depois da faca e da foto em alta de cada produto; MOQ e prazo confirmados entram no contrato.
- **Frequência / criticidade:** uma vez por produto de cada pedido / alta; prazo de **7 dias** do pedido (`purchaseDieCutSlaDays`).
- **Rotas:** `/app/orders/[id]/die-cut` (quadro); também `/app/flow/order/art-material` e a seção da etapa em `/app/orders/[id]`.
- **Pré-condição:** pedido de compra gerado (Wellmix: amostra aprovada → produto criado → **Gerar pedido de compra** em Solicitações ao fornecedor). E2E-HP passos 4 a 5.
- **Passo a passo:**
  1. Pendência **"Die Cut: {product}"** (`tasks.dieline.title`), detalhe **"Pedido #{n} · die-cut, foto em alta, pedido mínimo e prazo de entrega"**, etapa **"Die Cut"** → **"Abrir"** leva ao quadro, já no produto. (Pelo pedido: botão **"Abrir o Die Cut"**, `dieCut.open`.)
  2. Tela **"Die Cut"** (`dieCut.title`), subtítulo **"Pedido #{n}"**. Um cartão por produto, com **"Falta: {list}."** (`dieCut.missing`) e os selos **"Pendente"** / **"Feito"**.
  3. **"Die Cut"** (`dieCut.item.dieline`; dica **"Arquivo ou foto do die-cut (a faca da caixa)."**): **"Tirar ou escolher foto"** (`requirement.photo.add`) ou **"Escolher arquivo"** (`requirement.file.add`). O envio é automático ao escolher.
  4. **"Foto em alta"** (`dieCut.item.hd`; **"Foto do produto em alta resolução."**): **"Tirar ou escolher foto"**.
  5. Depois do primeiro arquivo, o **"+"** (**"Adicionar foto"**, `dieCut.photo.add`) acrescenta outras; o ícone de lixeira (**"Excluir"**) pede **"Excluir este arquivo? O item volta a pendente e você pode enviar outro."**
  6. **"Pedido mínimo (MOQ) · Prazo de entrega"**: os campos **"Pedido mínimo (peças)"** e **"Prazo de entrega (dias)"** vêm com o negociado (**"Negociado: {moq} peças · {days} dias."**); texto **"Confira os números. Se estiverem certos, é só confirmar; se mudaram, corrija e confirme."**; botão **"Confirmar pedido mínimo e prazo"** (`dieCut.terms.submit`).
- **Depois:** avisos **"Die-cut enviado."**, **"Foto em alta enviada."**, **"Pedido mínimo e prazo de entrega confirmados."**; o bloco vira resumo com o selo **"Confirmado"**, **"{moq} peças · {days} dias"**, quem confirmou e a data, e o botão **"Editar"** enquanto a etapa está aberta. Com os quatro feitos: **"Os quatro itens estão feitos. Obrigado!"** (`dieCut.complete`). O designer do pedido é avisado quando faca e foto chegam; a Wellmix, quando os quatro ficam completos (e a cada mudança posterior de MOQ ou prazo).
- **Erros:** **"Pedido mínimo inválido: informe um número inteiro de peças, maior que zero."** (`dieCut.error.invalid_moq`); **"Prazo inválido: informe um número inteiro de dias, de 1 a 720."** (`dieCut.error.invalid_lead_time`); **"Envie primeiro o arquivo do item; depois o + acrescenta outras fotos."** (`dieCut.error.die_cut_send_first`); **"Arquivo grande demais (máx. 50 MB). Reduza ou envie em PDF compactado."** (`requirement.file.tooBig`). Etapa fechada: **"Esta etapa do pedido não está aberta: os itens ficam só para consulta."**
- **Regras:** só a Wellmix e o fornecedor do pedido abrem o quadro. Na seção da etapa, no pedido, o fornecedor vê só **três** tarefas por produto (faca, foto em alta e **"Prazo de produção confirmado (dias)"**); o MOQ ele confirma só no quadro Die Cut. O campo do prazo já vem com o negociado na solicitação.
- **E2E:** E2E-HP passo 6a (envio, "+", excluir, confirmar, editar, cancelar, valor inválido); E2E-BSR passo 7 (visão da seção com três tarefas e o prazo de 35 dias preenchido).
- **Complexidade:** média.

### T7. Assinar o contrato (documento do pedido): baixar o PDF, assinar, carimbar e enviar

- **Quando e por quê:** as raias terminaram (arte final com selo, certificado, cadastro) e a Wellmix já assinou. O pedido só segue com as duas assinaturas.
- **Frequência / criticidade:** uma vez por pedido (e por pedido filho de cada programação) / **muito alta**; prazo de **2 dias** da assinatura da Wellmix (`purchaseSignatureSlaDays`).
- **Rota:** `/app/orders/[id]/purchase-order` (a lista **Pedidos** do fornecedor já abre nesta página).
- **Pré-condição:** Wellmix: raias concluídas, pedido de amostras definido e o arquivo dela assinado. E2E-HP passo 7 (`uploadSignedContract` como admin, depois como fornecedor).
- **Passo a passo:**
  1. Pendência **"Pedido #{n}: Assinar o pedido"** → **"Abrir"**; ou menu **Pedido → Contrato** → **"Resolver"**.
  2. Tela **"Documento do pedido #{n}"** (`orderSign.title`). Selo **"Enviado ao fornecedor: esperando a assinatura dele"** (`orderSign.status.sent_to_supplier`). Conferir produto, **"Quantidade"**, **"Preço por unidade"**, **"Total"**, **"Pedido mínimo (MOQ)"**, **"Prazo de produção"**, **"Condição de pagamento"**, o cartão **"Arte final de cada produto (com o selo)"** e a **"Folha do pedido (modelo Wellmix)"**.
  3. Cartão **"Sua vez de assinar"** (`orderSign.turn.title`): **"Baixe o contrato em PDF, assine, carimbe e suba o arquivo. O contrato só conclui com os dois arquivos: o da Wellmix e o do fornecedor."** (`purchaseOrder.sign.hint`).
  4. **"Baixar o documento em PDF"** (`orderSign.download`). Assinar e carimbar no papel.
  5. Campo **"Nome de quem assinou"** (`orderSign.option.file.name`, vem com o nome do login) e o botão **"Enviar o documento assinado (PDF ou foto)"** (`orderSign.option.file.send`). **Escolher o arquivo já registra a assinatura** (**"Ao escolher o arquivo, a assinatura já fica registrada com o arquivo guardado no pedido."**).
- **Depois:** **"Assinatura registrada."**; selo **"Assinado pelos dois: pedido autorizado, falta gerar no Sankhya"**; a Wellmix é avisada; o pedido vai ao Sankhya; o financeiro é avisado do sinal. A produção só abre com o sinal pago ou a conta corrente (T9).
- **Erros / bloqueios:** **"A Wellmix ainda não assinou. Você assina depois dela."** (`orderSign.waitingWellmix`); **"Suba o contrato assinado e carimbado (PDF ou foto)."** (`orderSign.error.signature_file_required`); **"O arquivo assinado precisa ser PDF ou foto (JPG, PNG ou WebP)."** (`…signature_file_invalid`); **"O pedido mudou enquanto você lia. Confira o documento de novo e assine."** (`…signature_document_changed`).
- **Regras:** no pedido de compra **não existe o aceite no portal**, só o arquivo (PDF, JPG, PNG ou WebP, até 50 MB). Arquivo errado: o administrador devolve a assinatura com o motivo (**"Devolver a assinatura do fornecedor (administrador)"**) e ele assina de novo. O documento tem o preço de compra: só a Wellmix, o fornecedor do pedido e a certificadora (leitura) abrem. No alto da página, **"Suas pendências neste pedido"** lista o que mais é dele naquele pedido; o link de volta chama-se **"Etapas e pendências do pedido"** (`orderSign.back.supplier`).
- **E2E:** E2E-HP passo 7 (inclui baixar o PDF pela rota de arquivo). Devolução da assinatura: não coberta por E2E (`tests/unit/order-signature.test.ts`).
- **Complexidade:** média (sai do portal para assinar no papel).
- **Atenção:** o título do formulário na tela é **"Opção 2: enviar o documento assinado"** (`orderSign.option.file`), sem existir "Opção 1" no pedido de compra; e o PDF omite caracteres não latinos (seção 3, D4 e D12).

### T8. Aceitar o pedido de amostras (contrato à parte)

- **Quando e por quê:** a Wellmix gerou o pedido de amostras (5 × 3 peças por variante de cada produto) antes de assinar o contrato. O fornecedor aceita à parte; a etapa do contrato só conclui com esse aceite.
- **Frequência / criticidade:** uma vez por pedido, quando há amostras / alta; prazo de 2 dias (`purchaseSignatureSlaDays`).
- **Rota:** `/app/orders/[id]/samples`.
- **Pré-condição:** Wellmix clicou **"Gerar o pedido de amostras"**. Se ela marcou **"Sem amostras neste pedido"**, não há o que aceitar. E2E-HP passo 7a.
- **Passo a passo:**
  1. No pedido (`/app/orders/[id]`), etapa **"Contrato e assinaturas"**, item **"Pedido de amostras aceito pelo fornecedor"** (`req.sample_order_supplier`) → botão **"Pedido de amostras"** (`sampleOrder.open`).
  2. Tela **"Pedido de amostras · pedido #{n}"**; cartão **"Amostras por produto"** com **"Produto"**, **"Variantes"**, **"Amostras (peças)"**, **"Total"** e a regra **"Regra: 15 peças (5 × 3) por variante de cada produto do pedido. Produto sem variantes cadastradas conta uma."** (`sampleOrder.rule`). Selo **"Aguardando o fornecedor"**.
  3. Cartão **"Aceitar o pedido de amostras"**: **"Nome completo de quem aceita"**, marcar **"Li o pedido de amostras e concordo em produzir e separar estas quantidades."**, botão **"Aceitar o pedido de amostras"** (`sampleOrder.accept.submit`).
- **Depois:** **"Pedido de amostras aceito."**; selo **"Aceito pelo fornecedor"**; a Wellmix é avisada. Mais tarde isso abre o cartão **Amostras** do pedido (T12).
- **Erros:** **"Digite o nome completo (de 3 a 120 letras)."**; **"Marque o \"li e concordo\"."**; **"O pedido de amostras mudou: confira de novo antes de aceitar."** (`sampleOrder.error.*`).
- **Regras:** o aceite vale para a versão que ele viu; pode aceitar antes ou depois de assinar o contrato (o E2E assina primeiro).
- **E2E:** E2E-HP passo 7 (aceita como "Li Wei").
- **Complexidade:** baixa.
- **Atenção:** por leitura do código, esta pendência aparece na etapa **"Aprovar a arte"** da tela de pendências, com texto de arte (seção 3, D1). Confirmar na tela antes de gravar.

### T9. Confirmar o recebimento de um pagamento (Conta corrente)

- **Quando e por quê:** a Wellmix registrou um pagamento. No pedido de compra, a parcela do marco "pedido gerado" é o **sinal**: paga pela Wellmix **ou recebida (confirmada pelo fornecedor)** libera a produção.
- **Frequência / criticidade:** por parcela (em geral 1 a 3 por pedido) / alta.
- **Rota:** `/app/account`.
- **Pré-condição:** pagamento ao fornecedor registrado pela Wellmix no pedido (no E2E, o admin usa "Copiar dados para o banco", que deixa a parcela como solicitada). O Supplier A tem condição 30% no pedido + 70% 90 dias após a entrega; o Supplier B não tem condição cadastrada (`src/lib/demo-data.ts`).
- **Passo a passo:**
  1. Pendência **"Confirmar recebimento: pedido #{n}"** → **"Abrir"**, ou menu **Conta corrente**.
  2. Tela **"Conta corrente"**: indicadores **"Total"**, **"Recebido"**, **"Saldo"**; cartão **"Previsão de pagamentos"** (**"Parcela"**, **"Vencimento"**, **"Valor"**, **"Situação"**); tabela de pagamentos por pedido com **"Comprovante"** e **"Trilha"**; **"Resumo por pedido"** (**"Contratado"**, **"Pago"**, **"A confirmar"**, **"Saldo"**); **"Histórico"**.
  3. Na linha do pagamento, botão **"Confirmar recebimento"** (`account.confirm`).
- **Depois:** a parcela passa a **"Recebido pelo fornecedor"** (`supplierTerms.status.received`); a pendência some; se era o sinal, o item "Sinal pago ao fornecedor (ou conta corrente)" conclui e a Inspeção abre para ele.
- **Erros / bloqueios:** sem condição cadastrada: **"A condição de pagamento ainda não foi configurada pela Wellmix."** (`account.forecast.missing`).
- **Regras:** abrir a tela registra "visualizado" na trilha; confirmar é ato explícito. O job diário lembra de pagamento feito há mais de 3 dias sem confirmação.
- **E2E:** E2E-HP passo 8.
- **Complexidade:** baixa.

### T10. Inspeção: fotos, peso, vídeo da produção e declaração de conformidade

- **Quando e por quê:** a produção foi liberada (sinal pago ou conta corrente). O embarque espera a aprovação da Wellmix, SKU a SKU, que só começa depois da declaração do fornecedor.
- **Frequência / criticidade:** uma vez por pedido (repete a cada reprovação) / **muito alta**; prazo de **7 dias** do início da etapa (`purchaseInspectionMediaSlaDays`).
- **Rotas:** `/app/orders/[id]` (etapa **Inspeção**) ou menu **Produção → Inspeção**.
- **Pré-condição:** contrato assinado pelos dois, pedido de amostras aceito ou dispensado e sinal quitado. E2E-HP passos 7 e 8.
- **Passo a passo:**
  1. Pendência **"Pedido #{n}: Produção e inspeção"** → **"Abrir"**.
  2. No cartão da etapa, o aviso **"Inspeção cega: informe exatamente o que encontrou (peso, medidas, caixa, material, cor). Os valores esperados não são exibidos; a Wellmix faz a comparação e avisa se houver divergência."** (`orders.inspection.blindHint`).
  3. Enviar, item a item: **"Foto sem embalagem"**, **"Foto com embalagem"**, **"Foto na balança"** (botão **"Tirar ou escolher foto"**), **"Peso medido (kg)"** (campo + **"Enviar"**), **"Vídeo da produção"** (**"Escolher arquivo"**).
  4. Opcionais (marcados **"(opcional)"**), quando a inspeção ampliada está ligada: peso bruto, comprimento, largura, altura, CBM da caixa master, unidades por caixa master e por inner box, material e cor encontrados.
  5. Por último, **"Produto conforme o pedido (declaração do fornecedor)"** (`req.supplier_conformity`) → botão **"Confirmar"** (`common.confirm`). Só libera depois das fotos, do peso e do vídeo.
- **Depois:** a Wellmix inspeciona cada SKU (prazo de 2 dias da declaração). Aprovados todos, o pedido vai ao Embarque. Reprovado: T11.
- **Erros / bloqueios:** peso fora da tolerância bloqueia a etapa; para o fornecedor aparece só **"Divergência detectada; aguardando revisão da Wellmix."** (`orders.inspection.genericBlock`). Ele pode reenviar por **"Nova medição →"** (`orders.inspection.remeasure`).
- **Regras:** fotos e arquivos até 50 MB; o vídeo aceita MP4, MOV, WEBM, 3GP. Com as medidas extras ligadas são 15 itens do fornecedor (comentário do E2E).
- **E2E:** E2E-HP passo 9 (`fillMyRequirements` preenche tudo; também abre **Produção → Inspeção**, aba **Todos no passo**).
- **Complexidade:** média (muitos itens; ordem obrigatória no fim).

### T11. Produção: manter início e ETD e corrigir SKU reprovado

- **Quando e por quê:** durante a produção. O ETD alimenta o acompanhamento da Wellmix; SKU reprovado volta para o fornecedor dizer o que corrigiu.
- **Frequência / criticidade:** ETD: quando muda (por pedido); correção: rara / alta quando ocorre (limite de 3 tentativas; na 4ª reprovação o pedido vai para cancelamento por qualidade).
- **Rota:** `/app/orders/[id]#production` (cartão **"Produção"**).
- **Pré-condição:** pedido em andamento; para a correção, um SKU reprovado pela Wellmix.
- **Passo a passo (ETD):** cartão **"Produção"** → **"Fornecedor é"** (**"Fábrica"** / **"Trade (revenda)"**; com Trade, **"Fábrica"** e **"Endereço da fábrica"**), **"Início da produção"**, **"ETD (saída prevista)"**, **"Motivo da mudança do ETD (obrigatório ao mudar)"** → **"Salvar produção"** (`production.save`). Dica na tela: **"Mantenha o início e o ETD atualizados; a Wellmix é avisada quando o ETD muda."**
- **Passo a passo (SKU reprovado):** pendência **"Corrigir SKU reprovado: pedido #{n}"** → no cartão, **"Inspeção por SKU"**, linha **"Reprovado"** com o motivo → campo **"O que foi corrigido"** (`production.sku.action`) → **"Enviar correção"** (`production.sku.respond`). No pedido de compra, as fotos, o peso, o vídeo e a declaração voltam a pendentes: refazer a T10.
- **Depois:** **"Produção salva."** / **"Correção enviada à Wellmix."**; ETD mudado pelo fornecedor alerta o analista, o planner e o comprador; a correção vira pendência "Inspecionar de novo" da Wellmix; cada reprovação soma 1 dia ao ETD.
- **Erros:** **"Informe o motivo da mudança do ETD."** (`production.error.etd_reason_required`); **"Escreva o que foi corrigido."** (`production.error.action_required`).
- **Regras:** o primeiro ETD não pede motivo; sem endereço da fábrica (Trade) a Wellmix não agenda a inspeção; follows de 5/15/25 dias, agendar e inspecionar são só da Wellmix.
- **E2E:** **não coberto como fornecedor** (o E2E aprova o SKU de primeira e o ETD não é preenchido por ele); `tests/unit/production.test.ts`. ⚠ não confirmado na tela: quais partes do cartão aparecem para o fornecedor dentro do passo **Produção → Inspeção**.
- **Complexidade:** média.

### T12. Amostras do pedido: retirada, envio ao Brasil e à China, e confirmar a devolução

- **Quando e por quê:** pedido com pedido de amostras, depois do SKU aprovado. De cada 5 amostras, 4 vão ao show room no Brasil e 1 à agência de marketing na China; a da China volta ao fornecedor para seguir com a carga. **O container só pode ser carregado depois dessa devolução confirmada.**
- **Frequência / criticidade:** uma vez por pedido com amostras / alta (trava o carregamento).
- **Rota:** `/app/orders/[id]#samples-flow` (cartão **"Amostras"**) ou menu **Produção → Amostra**.
- **Pré-condição:** pedido de amostras gerado e SKU aprovado. A agência (ou a Wellmix, sem agência designada) registra o recebimento, as fotos reais e a devolução; o marketing aprova as fotos. E2E-HP (trecho "Amostras").
- **Passo a passo:**
  1. Cartão **"Amostras"** (`samplesFlow.title`), com a divisão por produto: **"Show room (Brasil)"**, **"Agência (China)"**, **"Total"**.
  2. **"Retirada das amostras (data)"** → data → **"Enviar"**.
  3. **"Envio ao show room no Brasil (rastreio e comprovante)"** → campo **"Rastreio / AWB"** + arquivo → **"Enviar"**.
  4. **"Envio à agência de marketing na China (rastreio e comprovante)"** → **"Rastreio / transportadora"** + arquivo → **"Enviar"**.
  5. Mais tarde, na linha **"Amostra devolvida à trading para seguir com o pedido"**, botão **"Validar"** (`importFlow.validate`), ou **"Recusar"** com **"Motivo (obrigatório para recusar)"**.
- **Depois:** **"Enviado."** / **"Validado."**; depois da validação, o passo "Carregamento" do container fica liberado.
- **Erros:** **"Conclua antes o passo anterior."** (`importFlow.error.previous_step`); **"Os passos das amostras abrem com o SKU aprovado e o pedido de amostras gerado."** (`…samples_closed`); **"Envie o arquivo."**; **"Preencha o número/data."**.
- **Regras:** envio ao Brasil e à China só depois da retirada; arquivo obrigatório nos dois envios.
- **E2E:** E2E-HP (retirada, Brasil, China, validar a devolução).
- **Complexidade:** média.

### T13. Container na origem: container vazio, fotos, carregamento, lacre e porto

- **Quando e por quê:** depois da reserva no navio (booking) validada. Registra o container na fábrica até voltar lacrado ao porto; o embarque só é confirmado com o container no porto e o BL conferido.
- **Frequência / criticidade:** uma sequência por pedido / **muito alta**.
- **Rota:** `/app/orders/[id]#container-origin` (cartão **"Container na origem"**) ou menus **Produção → Logística**, **Carregamento** e **Embarque**.
- **Pré-condição:** pedido da Inspeção em diante; passo **Booking** enviado pelo agente de carga (ou pela Wellmix) e validado. E2E-HP: admin envia `BK-E2E`, operador valida.
- **Passo a passo** (tabela **"Passo"**, **"Situação"**, **"Quem faz / valida"**, **"Informado"**, **"Enviado por"**, **"Ação"**):
  1. **"Container vazio no depósito da fábrica (data)"** → data → **"Enviar"**.
  2. **"Fotos e vídeos do container vazio"** → arquivo → **"Enviar"**. (Isto abre o check list de carga da T14.)
  3. **"Carregamento: fotos, vídeos e check de carga"** → arquivo + texto **"Check de carga (caixas, avarias, observações)"** → **"Enviar"**. A Wellmix valida.
  4. **"Lacre: foto e número do container"** → **"Nº do container"** + foto → **"Enviar"**.
  5. **"Container lacrado no porto (data)"** → data → **"Enviar"**.
- **Depois:** cada passo fica **"Concluído"** ou **"Enviado, aguardando validação"**; recusado mostra **"Recusado: {reason}"** e o botão **"Enviar de novo"**. O rastreio diário do container é do Comex interno (o fornecedor não vê).
- **Erros / bloqueios:** **"Conclua antes o passo anterior."**; **"O container só é carregado depois que a amostra da China volta à trading (cartão Amostras)."** (`importFlow.error.samples_return_required`); **"Envie o arquivo."**; **"O arquivo passa do tamanho máximo (50 MB)."**
- **Regras:** ordem fixa, cada passo depende do anterior; container vazio e carregamento aceitam vídeo (MP4, MOV, WebM), foto e PDF.
- **E2E:** E2E-HP (os cinco passos, com a validação do carregamento pelo admin).
- **Complexidade:** média.

### T14. Documentos do embarque: check list de carga, packing list e invoice

- **Quando e por quê:** com as fotos do container vazio enviadas. O sistema confere cada documento com o anterior, linha a linha (caixas, peças, peso líquido e bruto); o BL da companhia marítima só abre com a invoice conferida.
- **Frequência / criticidade:** uma vez por pedido / **muito alta** (erro de número devolve o documento).
- **Rota:** `/app/orders/[id]/shipping-docs` (no pedido, **"Documentos do embarque"**, `shippingDocs.open`) ou menu **Produção → Documentos de carga**.
- **Pré-condição:** passo "Fotos e vídeos do container vazio" enviado (T13).
- **Passo a passo:**
  1. **"1. Check list de carga"** (`shippingDocs.load.title`): **"Em cada item, marque quantas caixas subiram no container. O pedido vai sendo abatido até terminar."**; colunas **"Caixas do pedido"**, **"Caixas carregadas"**, **"Faltam"**, **"Subiram agora"**; botão **"Registrar as caixas"**. Pode ser feito em vários lançamentos.
  2. **"2. Packing list (fornecedor)"**: as caixas vêm do check list; conferir **"Peças"**, **"Peso líquido (kg)"**, **"Peso bruto (kg)"**; **"Arquivo (opcional)"**; botão **"Enviar o packing list"**.
  3. **"3. Invoice (trading)"**: mesmas colunas, mais **"Preço por peça"**; **"Nº da invoice"** e **"Arquivo do documento"** (obrigatórios); botão **"Enviar a invoice"**.
  4. **"4. BL (companhia marítima)"**: só leitura para ele.
- **Depois:** selos **"Em andamento"**, **"Enviado"**, **"Conferido"**, **"Não bateu: refazer"**, **"Aguardando"** (`shippingDocs.status.*`). Carga completa: **"Carga completa: todas as caixas do pedido estão no container."**. Invoice conferida avisa a companhia marítima (ou a Wellmix) para fazer o BL.
- **Erros / bloqueios:** **"Mais caixas do que faltam para o item: confira o número."** (`shippingDocs.error.shipping_load_over`); **"Informe peças, peso líquido e peso bruto de todos os itens."** (`…shipping_lines_required`); **"Informe o número do documento."**; **"Envie o arquivo do documento."**. Invoice que não bate: quadro **"Diferenças encontradas"** com linhas **"{item}: {field} esperado {expected}, informado {found}"**, e o documento volta para ser refeito.
- **Regras:** peso bate até o centésimo de kg; item que falta ou sobra também é diferença. Caixas esperadas = quantidade ÷ caixa master do cadastro, para cima; sem caixa master, o check list aceita qualquer número (aviso **"sem caixa master no cadastro"**). O login do fornecedor do pedido faz os três documentos (a "trading" da invoice é esse mesmo login).
- **E2E:** E2E-HP (check list, packing list com pesos, invoice `INV-E2E`). Invoice que não bate: não coberta por E2E.
- **Complexidade:** alta (números por linha, com conferência automática).

### T15. Acompanhar pedidos, documentos, mensagens e avisos

- **Quando:** a qualquer momento, para saber em que etapa cada pedido está e ler o que chegou.
- **Frequência / criticidade:** diária ou semanal / média.
- **Rotas:** `/app/orders`, `/app/orders/[id]`, `/app/notifications`, `/app/messages`.
- **Pré-condição:** ter pedido (para Pedidos).
- **Passo a passo:**
  - **Pedidos** (`orders.title`): lista com etapa, situação, progresso e prazo; a linha do fornecedor abre direto o **Documento do pedido**; de lá, **"Etapas e pendências do pedido"** leva ao detalhe.
  - Detalhe do pedido: **"Ir para:"**, **"Resumo do pedido"**, **"Itens do pedido"**, **"Etapas do pedido"** (com **"Ver detalhes"** e **"Abrir todas as etapas"**), **"Documentos"** (com **"Confirmar leitura"**, `orders.ack.confirmDoc`), **"Pagamento ao fornecedor"** (só a previsão), **"Produção"**, **"Amostras"**, **"Container na origem"**, **"Embarque e desembaraço"**.
  - **Notificações**: grupos **"Precisa de você"**, **"Atenção"**, **"Novidades"**; botão **"Resolver"** (`notif.open.action`); **"Marcar todas como lidas"**; **"Excluir"**.
  - **Mensagens**: **"Fale com a equipe Wellmix. Todos os logins da sua empresa veem esta conversa."** (`messages.subtitle.external`); **"Nova conversa"**, **"Enviar"**.
- **Regras:** o fornecedor não vê o cliente, outros fornecedores, o preço de venda nem a margem; nos itens do pedido, foto, código e preço FOB são só da Wellmix. Etapa do pedido de compra com o login Trading aparece como **"Die-Cut"**; para os outros, o cartão da etapa 2 tem as três tarefas da T6.
- **E2E:** parcial (E2E-HP abre o pedido como fornecedor; `orders-list.spec.ts` é da Wellmix; isolamento: Supplier B recebe 404 no pedido e no contrato).
- **Complexidade:** baixa.
- **Atenção:** e-mail e WhatsApp estão em modo mock (docs/INTEGRATIONS.md): só o sino e a tela Notificações avisam de verdade.

### T16. Responder a um convite de book (enviar o book concorrente)

- **Quando e por quê:** a Wellmix quer comparar preços e convida fornecedores e tradings a mandar a planilha de um item parecido.
- **Frequência / criticidade:** ocasional / média; prazo padrão de **1 dia** (`bookingInviteSlaDays`, 1 a 30).
- **Rotas:** `/app/supplier-requests/invites` → `/app/supplier-requests/invites/[id]`.
- **Pré-condição:** convite aberto. Quem cria: a Wellmix, em Seleção de itens → aba Itens → **"Abrir cotação"** do item → marca o parceiro. E2E `tests/e2e/booking-invite.spec.ts`.
- **Passo a passo:**
  1. Pendência **"Enviar book concorrente: {item}"** (`bookingInvites.task.title`), detalhe **"{qty} peças · convite nº {n}"**, etapa **"Analisar o Book"** → **"Abrir"**; ou menu **Convites de book** (colunas **"Nº"**, **"Item"**, **"Quantidade (peças)"**, **"Prazo"**, **"Situação"**; selo **"Aguardando o book"**).
  2. Tela **"Convite de book nº {n}"**: cartão **"O que a Wellmix procura"** (item, **"Código da fábrica"**, quantidade, **"Material"**, **"Medidas (C × L × A, cm)"**, **"Capacidade (ml)"**, **"Embalagem"**, **"Cores"**, **"Prazo"**) e **"O que a Wellmix precisa"**.
  3. Cartão **"Enviar o book"**: **"Arquivo"** (planilha), **"Moeda quando a planilha não diz"**, botão **"Enviar book"** (`bookingInvites.detail.submit`).
- **Depois:** **"Book enviado. A Wellmix foi avisada e vai avaliar."**; selo **"Book enviado"**; **"Book nº {n} enviado em {date}."**. O book nasce em rascunho, com ele como responsável; as solicitações dos itens desse book vão para ele.
- **Erros:** **"Este convite não está mais aberto."** (`bookingInvites.error.booking_invite_closed`); erros de leitura da planilha, por exemplo **"Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo."**, **"Muitos produtos de uma vez (máximo 80 por planilha): divida a planilha."**, **"A planilha está protegida por senha…"** (`sheetImport.error.*`).
- **Regras:** Excel .xlsx ou .xls, até 80 itens, mesmas colunas do book; ele não vê o book de origem, o fornecedor dele nem o preço; passado o prazo, **"Atrasado"**.
- **E2E:** `booking-invite.spec.ts`, "seleção → abrir cotação → convidado sobe o booking concorrente" (como `supplier.b@china.com`).
- **Complexidade:** média (depende da planilha no modelo certo).

### T17. Lançar um book próprio (só com a tela Book)

- **Quando e por quê:** o parceiro quer oferecer produtos por iniciativa própria.
- **Frequência / criticidade:** ocasional / média. **Não está disponível para o Fornecedor de fábrica** (D-P1): vem aberta para Trading, Factory, Supplier (tipo) e GP.
- **Rotas:** `/app/booking` → `/app/booking/import` → `/app/booking/lots/[id]`.
- **Pré-condição:** login com a tela Book e cadastro ativo de um tipo que responde por book. E2E `tests/e2e/partner-access.spec.ts`, "Trading com login: lança o booking dele e vê só os bookings dele" (o teste cria a Trading e o login pelo admin).
- **Passo a passo:**
  1. Menu **Book** → tela **"Book"** (**"Os books da sua empresa: os que ela lançou e os que a Wellmix carregou em nome dela."**) → botão **"Lançar book"** (`bookingLots.partner.launch`).
  2. **"Planilha do book"**: **"Arquivo"** (**"Excel (.xlsx ou .xls), até 80 itens."**), **"Moeda quando a planilha não diz"** → **"Carregar planilha"**.
  3. Conferir os campos, todos abertos e preenchidos (**"Tudo veio da planilha e pode ser corrigido aqui: cada campo grava ao sair dele. Com * os que a Wellmix precisa para fechar o book."**); os com * em branco ficam em amarelo.
  4. **"Enviar para Wellmix Conferir"** (`bookingLots.partner.send`). Ou **"Descartar"**.
- **Depois:** **"Book nº {n} enviado. A Wellmix foi avisada e vai conferir."**; situação nas palavras dele: **"Em preenchimento: falta enviar"** → **"Em conferência na Wellmix"** → **"Conferido pela Wellmix"**. Depois de enviado ele só consulta.
- **Erros:** **"Ainda há {n} campo(s) com * em branco. Enviar assim mesmo?"** (confirmação); **"Este book já foi enviado para a Wellmix. Para corrigir ou cancelar, fale com a Wellmix."**; **"Sua empresa já lançou muitos books nas últimas 24 horas. Tente mais tarde ou fale com a Wellmix."** (limite de 20 em 24 h).
- **Regras:** só arquivo (sem link do Google Sheets); antes do envio a Wellmix não vê o book; ele não vê a análise (Superplan), o NCM nem books de outras empresas (404).
- **E2E:** `partner-access.spec.ts` (Trading).
- **Complexidade:** média.

### T18. Compra EXW: transportadora, previsão e custos de origem (POP)

- **Quando:** o pedido é EXW (algum produto EXW). Antes do container chegar à fábrica.
- **Frequência / criticidade:** só em pedido EXW / alta quando ocorre (trava o "container vazio").
- **Rota:** `/app/orders/[id]#container-origin`.
- **Passo a passo:** **"Transportadora contratada na origem (EXW)"** (campo **"Nome da transportadora"**) → **"Previsão do container no depósito da fábrica (EXW)"** (data) → **"Custos do transporte na origem (POP): valor, moeda e comprovante"** (valor, moeda USD/RMB/BRL, arquivo) → **"Enviar"**. A Wellmix valida os custos.
- **Regras:** o container vazio só é registrado depois dos custos validados; os custos entram no custo do pedido.
- **E2E:** **não coberto** (docs/ORIGIN_CONTAINER.md; ⚠ não confirmado na tela).
- **Complexidade:** média.

### T19. Registrar certificações da fábrica

- **Quando:** ISO, BSCI, auditorias; entram pendentes e a Wellmix valida.
- **Rota:** `/app/account`, cartão **"Certificações do fornecedor"** (`catalog.cert.party.title`) → **"Registrar certificação"** (`catalog.cert.add`), com **"Tipo"**, **"Nome / título"**, **"Órgão emissor"**, **"Número"**, **"Validade"** e **"Documento"** (**"PDF ou imagem do certificado"**) (`catalog.cert.*`).
- **Frequência / criticidade:** rara / baixa.
- **Depois:** entra como **"Pendente"** (`catalog.cert.status.pending`); só a Wellmix muda para **"Válida"**, **"Vencida"** ou **"Rejeitada"**.
- **E2E:** **não coberto**. ⚠ não confirmado na tela: a ordem e a obrigatoriedade dos campos (o servidor exige o tipo, `kind_required`).
- **Complexidade:** baixa.

### T20. Pedidos de uma programação de compra (pedido pai e filhos)

- **O que muda para o fornecedor:** na solicitação, as colunas **"Programações"** e **"Peças por programação"** e o quadro **Programação de compra**; o pedido pai faz só a preparação (T6); cada programação nasce como pedido filho (aviso **"Pedido de compra #{n}: programação {round}"**), com contrato próprio (T7), pedido de amostras próprio (T8) e o resto do fluxo. No filho: **"Programação {n} de {rounds} do pedido pai"**.
- **Frequência / criticidade:** só em compras programadas / média.
- **E2E:** não coberto do lado do fornecedor (`booking-selection.spec.ts` cobre a Seleção; `tests/unit/purchase-rounds.test.ts`).
- **Complexidade:** média (conceito novo; as telas são as mesmas).

---

## 3. Divergências doc × código / documentado e não implementado

Nada aqui é tarefa: são pontos para o dono decidir antes de gravar.

**D1. Etapas "Ficha de compra" e "Aprovar a arte" na tela de pendências são do fluxo antigo.** O pedido de compra (único que nasce hoje: `orders` só é criado em `purchase-order.ts` e `purchase-rounds.ts`) não tem o item "ficha de compra" nem "aprovação da arte pelo fornecedor". Mas as duas etapas continuam nos nove quadrados. Por leitura do código (`SUPPLIER_STAGE_STEP` em `src/lib/services/tasks.ts`), a pendência **"Pedido de amostras aceito pelo fornecedor"** cai na etapa **"Aprovar a arte"**, com o título **"Pedido #{n}: Aprovar a arte"** e o detalhe **"Confira a arte da embalagem e aprove, ou reprove dizendo o que mudar."**, e o **"Abrir"** leva ao pedido, não à página do pedido de amostras. Não reproduzido na tela.

**D2. Explicação da etapa "Analisar o Book" é da cotação antiga.** `supplierTasks.help.booking`: "Confira preço, pedido mínimo, prazo e fotos do produto e envie a resposta." Hoje a etapa só recebe a pendência **"Enviar book concorrente"** (convite de book).

**D3. Explicação da etapa "Embarque" é do fluxo antigo.** `supplierTasks.help.shipping`: "Confira a invoice e o packing list e envie a invoice assinada." No pedido de compra os passos "Invoice e packing list" e "Invoice assinada" não existem (`PURCHASE_HIDDEN_STEPS`); o que cai nessa etapa são o container na origem, as amostras e os documentos do embarque. A de "Produção e inspeção" não cita o vídeo nem a declaração.

**D4. Assinatura: textos falam em "assinar no portal", que não existe no pedido de compra.** `supplierTasks.help.sign` ("Assine o documento do pedido no portal ou envie o PDF assinado.") e docs/ORDER_SIGNATURE.md (seções 2 e 2b, duas opções) valem para pedidos de antes do pedido de compra. No pedido de compra só aparece o envio do arquivo, e o título do formulário continua **"Opção 2: enviar o documento assinado"** sem haver opção 1 (`src/app/app/orders/[id]/purchase-order/page.tsx`).

**D5. Ajuda das etapas no detalhe do pedido.** Para o fornecedor, a etapa "Contrato e assinaturas" mostra `help.stage.PACKAGING` (fala de a agência fazer a arte e o fornecedor aprovar) e a "Inspeção" mostra `help.stage.INSPECTION` (sem vídeo nem declaração). Só a Preparação tem texto próprio do fornecedor. Leitura do código.

**D6. docs/WORKFLOW.md descreve fluxos removidos.** Tabela da solicitação com RFQ (`openRfq`, `answerQuote`), checklist da Preparação, "Embalagem já na RFQ", faca na cotação (`/app/quotes/{id}#die-cut`): a rota `/app/quotes` não existe mais. docs/SUPPLIER_REQUESTS.md ainda diz que o fornecedor tem "Solicitações ao fornecedor ao lado de Cotações": não há item "Cotações" no menu dele.

**D7. docs/FLOW_MENU.md se contradiz.** As seções de cima dizem "Todos no passo (só a Wellmix)" e que os parceiros "seguem no detalhe do pedido"; a seção "Parceiros nos passos" e o código dão aos parceiros as duas abas e o pedido dentro do passo (E2E-HP confirma para o fornecedor).

**D8. docs/PARTNER_TYPES.md × docs/BOOKING.md.** PARTNER_TYPES diz que Trading, Factory, Supplier e GP "não entram em cotação, booking nem pedido como fornecedor" e que "as telas abrem vazias". BOOKING.md e o código dizem que o responsável pelo book (que pode ser uma Trading) recebe as solicitações e que o pedido sai em nome dele (`bookingRecipientId`).

**D9. Ficha de compra no pedido de compra.** A raia do fornecedor exclui a ficha ("é do fluxo antigo", `laneRequirements`), mas o fornecedor do pedido ainda abre e edita `/app/orders/[id]/purchase-sheet` (`sheetAccess`), e a linha "Ficha de compra" aparece em "Etapas do pedido". A ajuda do passo Pedidos cita "ficha do pedido". Não está claro se ele deve preencher.

**D10. Ordem entre os dois cartões do carregamento.** O check list de carga ("caixas que subiram no container") abre com as fotos do container vazio e pode ser concluído, junto com packing list e invoice, **antes** do passo "Carregamento" e antes de a amostra voltar da China (que trava só o passo "Carregamento"). O E2E faz nessa ordem. Vale decidir que ordem o vídeo ensina.

**D11. Textos de tela que não batem com a tela.**
- Depois de escolher a planilha (convite e lançar book) aparece `sheetImport.uploaded`: "Planilha enviada: … Agora clique em Importar e cadastrar.", mas os botões são **"Enviar book"** e **"Carregar planilha"**.
- `account.forecast.hint`: "confirme o recebimento na lista acima"; a lista fica abaixo (achado 37 do ACHADOS.md, ainda no dicionário).
- `sampling.upload.hint` lista JPG, PNG, HEIC, MP4, MOV; o código aceita também WEBP, HEIF, WEBM e 3GP.
- `access.denied` manda o fornecedor para "Gestão → Equipe e divisões" (achado 24).

**D12. Pendências só em português para quem usa zh ou en.** Títulos montados sem tradução: "Container vazio na fábrica: pedido #N", "Carregamento do container: pedido #N", "Retirada das amostras: pedido #N", "Corrigir SKU reprovado: pedido #N", "Confirmar recebimento: pedido #N" (`IMPORT_STEP_LABEL` e `productionTasks`). Os rótulos dos itens da inspeção também são gravados em português. E o **PDF do contrato omite caracteres não latinos** (docs/ORDER_SIGNATURE.md seção 7; achado 38).

**D13. Roteiro antigo `docs/videos/03-fornecedor.md` desatualizado.** FOR-03 (cotação em `/app/quotes`), FOR-05 (ficha de compra), FOR-06 (aprovar a arte) e FOR-09 (validar invoice e enviar a assinada) não existem no pedido de compra. FOR-02 e o achado 20 dizem que a solicitação não vira pendência: hoje vira (`supplierRequestTasks`). Faltam no roteiro antigo: amostragem, pedido de amostras, amostras do pedido, container na origem, documentos do embarque, convite de book, vídeo e declaração na inspeção.

**Documentado e não implementado (ou em aberto):**
- docs/SAMPLE_FLOW.md: recebimento das amostras no show room do Brasil ("fica para depois").
- docs/BOOKING.md: a Wellmix devolver o book ao parceiro para corrigir; o parceiro ver as fotos e baixar um modelo de planilha; avisos quando o book é conferido; lembrete de book não enviado.
- docs/ORDER_SIGNATURE.md seção 8: assinatura com validade jurídica; foto do produto e página "Shipping Mark" no PDF; lembrete por prazo ao fornecedor.
- docs/ORIGIN_CONTAINER.md: rastreio do container por API (hoje é pendência diária do Comex interno).
- E-mail e WhatsApp: mock.

---

## 4. Dúvidas de permissão

**D-P1. Quem tem a tela Book.** De fábrica: Trading, Factory, Supplier (tipo) e GP (`PROFILE_EXTRA`). O Fornecedor de verdade (`role:supplier`) nasce com ela **bloqueada**; o administrador libera em Parceiros → Acessos externos (E2E `partner-access.spec.ts` confere o "blocked"). As contas de demonstração `supplier.a/b/c` são Fornecedor: **não têm o item Book nem "Lançar book"**. Para gravar a T17 é preciso um login de Trading ou liberar a tela.

**D-P2. Trading como fornecedor do pedido.** Ver D8: a documentação diverge sobre uma Trading receber solicitações e pedidos. O código permite quando ela é a responsável pelo book.

**D-P3. Itens a mais do checklist da linha do produto.** São do papel fornecedor e obrigatórios, mas ficam fora da seção da etapa na visão dele (`supplierSeesLaneRequirement` só mostra faca, foto e prazo). Pela leitura do código, virariam pendência dele na etapa "Ficha de compra" e apareceriam no passo **Pedido → Pedidos** do menu. Nas linhas de demonstração não há item a mais, então não foi possível confirmar onde ele os preenche.

**D-P4. Multas dentro do pedido.** docs/PARTNER_ACCESS.md ("Em aberto"): na página do pedido o fornecedor ainda vê todas as multas daquele pedido, inclusive as de outros parceiros, com valor, motivo e nome do responsável. Espera decisão do dono.

**D-P5. Ficha de compra.** Ver D9: ele pode editar, mas não é exigido.

**D-P6. Produção.** O fornecedor edita "Fornecedor é", fábrica, endereço, início e ETD (`canEditProduction`). Os passos Pré-produção e Produção do menu não são dele; ele chega ao cartão pelo pedido (`#production`) ou pelo passo Inspeção. ⚠ não confirmado o que o cartão mostra dentro do passo.

**D-P7. Vários logins da mesma empresa.** Qualquer login do cadastro responde, assina e confirma recebimento; a conversa em Mensagens é uma só por empresa. Não há alçada por usuário para logins externos (docs/PARTNER_ACCESS.md, "Ainda não").

**D-P8. Página `/app/orders/[id]/invoice`.** É do passo antigo "Invoice e packing list", que o papel fornecedor "vê"; no pedido de compra o passo não se aplica. ⚠ não confirmado se a página ainda abre para ele.

---

## 5. Termos de negócio e siglas que o fornecedor encontra

| Termo | O que é (uma frase) | Pronúncia |
| --- | --- | --- |
| **Book** | A planilha de produtos que um fornecedor manda, com preço e ficha de cada item; é de onde saem as solicitações. | ⚠ ambígua: inglês "buk". |
| **Booking** | Outra coisa: a reserva de espaço no navio, passo do embarque. | ⚠ "búquin"; não confundir com Book. |
| **Convite de book** | Pedido da Wellmix para ele mandar um book concorrente de um item. | — |
| **Solicitação ao fornecedor** | A pergunta da Wellmix: "você faz este item, e em que condições?". | — |
| **Oferta / contraproposta** | Oferta é o conjunto de condições que vale agora; contraproposta é a devolução com outros valores. | — |
| **Condições iniciais (book) / finais** | As do book com que a solicitação abriu / as da última proposta enviada. | — |
| **MOQ** | Pedido mínimo, em peças (minimum order quantity). | ⚠ letra a letra ("eme-ó-quê") ou "móc". |
| **FOB** | Entrega no porto de origem, a bordo; o fornecedor leva até o navio. | ⚠ "fób" ou letra a letra. |
| **EXW** | Entrega na porta da fábrica (ex works); o transporte até o porto é à parte. | ⚠ letra a letra ou "ex works". |
| **Modalidade de entrega** | Nome na tela para FOB/EXW (incoterm). | — |
| **Incoterm** | Regra internacional de quem paga e responde por cada trecho do transporte. | ⚠ "íncoterm". |
| **RMB / USD** | Moedas: yuan chinês e dólar americano. | ⚠ RMB: letra a letra ou "renminbi". |
| **SLA** | Prazo combinado para uma etapa; passou, aparece "Atrasada". | ⚠ letra a letra ("esse-ele-á"). |
| **Vez** | De quem é a próxima ação: "Esperando o fornecedor" ou "Esperando a Wellmix". | — |
| **Amostragem** | Fotos e vídeos de uma amostra feita em impressora 3D, depois da aprovação da solicitação; nada é enviado fisicamente. | — |
| **Rodada** | Cada tentativa da amostragem (a reprovada abre a seguinte). | — |
| **Pedido de amostras** | Contrato à parte do pedido: 5 × 3 peças por variante, para o show room no Brasil e a agência na China. | — |
| **Amostras (do pedido)** | As peças físicas retiradas e enviadas depois da inspeção; diferente da amostragem. | — |
| **Show room** | Espaço de exposição da Wellmix no Brasil. | ⚠ inglês "xôu rum". |
| **Pedido de compra** | O pedido da Wellmix ao fornecedor, gerado dos produtos aprovados. | — |
| **Programação (de compra)** | Compra dividida em várias datas; cada programação vira um pedido. | — |
| **Pedido pai / pedido filho** | O pai guarda o total e a preparação; cada filho é uma programação, com contrato próprio. | — |
| **Die Cut / faca** | O desenho de corte da caixa, sobre o qual a agência faz a arte. | ⚠ inglês "dai-cât"; na tela aparece Die Cut, Die-Cut e die-cut. |
| **Foto em alta** | Foto do produto em alta resolução, para a arte. | — |
| **Material de arte** | Nome do passo do menu que reúne faca, foto em alta, MOQ e prazo. | — |
| **Contrato / Documento do pedido** | O mesmo documento, com dois nomes na tela: o que as duas partes assinam. | — |
| **Folha do pedido (modelo Wellmix)** | A forma como o contrato sai no PDF. | — |
| **Sankhya** | O sistema de gestão (ERP) da Wellmix; aparece no selo do contrato. | ⚠ "sânquia". |
| **Sinal** | Parcela paga no pedido gerado; libera a produção. | — |
| **Conta corrente** | Extrato do fornecedor: pedidos, pagamentos, saldo e previsão; também o caso de não haver sinal. | — |
| **Trilha** | Registro de quem visualizou e quem confirmou um pagamento ou documento. | — |
| **ETD** | Data prevista de saída da carga (estimated time of departure). | ⚠ letra a letra ("ê-tê-dê"). |
| **Inspeção cega** | O fornecedor informa o que mediu sem ver o valor esperado. | — |
| **SKU** | Cada item do pedido, para a inspeção. | ⚠ letra a letra ou "esquiú". |
| **Declaração de conformidade** | Confirmação do fornecedor de que o produto está conforme o pedido. | — |
| **Nova medição** | Reenvio de medidas ou fotos quando houve divergência. | — |
| **Fábrica / Trade (revenda)** | Se quem vende fabrica ou revende; com Trade, informa-se a fábrica e o endereço. | ⚠ "trêid". |
| **Trading** | Empresa que revende e responde pelo book e pelo pedido; entra com o login do fornecedor. | ⚠ "trêidin". |
| **Caixa master / caixa interna (inner)** | A caixa de embarque e a caixa menor dentro dela. | ⚠ "máster", "íner". |
| **CBM / cubagem** | Volume em metros cúbicos (da caixa e total). | ⚠ letra a letra ("cê-bê-eme"). |
| **Container na origem** | O container vazio na fábrica até voltar lacrado ao porto. | — |
| **Lacre** | O selo numerado que fecha o container. | — |
| **Check list de carga** | Contagem das caixas que subiram no container, item a item. | ⚠ "tchéc list". |
| **Packing list** | Lista da carga: caixas, peças e pesos por item. | ⚠ "péquin list". |
| **Invoice** | Fatura comercial da carga, com preço por peça. | ⚠ "ínvois". |
| **BL** | Conhecimento de embarque, emitido pela companhia marítima (bill of lading). | ⚠ letra a letra ("bê-éle"). |
| **POP** | Custos do transporte na origem, na compra EXW. | ⚠ "póp" ou letra a letra; o código não expande a sigla. |
| **AWB** | Número de rastreio do envio aéreo das amostras. | ⚠ letra a letra. |
| **Peso líquido / peso bruto** | Sem e com a embalagem. | — |

---

## 6. Sugestão de módulos

Agrupamento por momento do negócio. Durações estimadas para vídeo com tela gravada e narração.

| # | Módulo | Tarefas | Duração | Observação |
| - | --- | --- | --- | --- |
| 1 | **Primeiros passos: o portal do fornecedor** | T1, T15 | 10 min | Entrar, idioma, menu, Pendências e as nove etapas, sino, mensagens. Decidir antes como tratar D1 a D3. |
| 2 | **Solicitação ao fornecedor: responder e negociar** | T2, T3, T4 | 15 min | O coração do trabalho. Mostrar os três ícones, a caixa de confirmação, a contraproposta, a conversa e o SLA de 30 minutos. |
| 3 | **Aprovado: enviar a amostragem** | T5 | 8 min | Fotos e vídeos, enviar, reprovação e nova rodada. Pode fechar o módulo 2 se couber. |
| 4 | **Pedido de compra: Die Cut, pedido de amostras e contrato** | T6, T8, T7, T9 | 15 min | Da preparação ao sinal. Cuidado com D4 ("Opção 2") e D1 (onde aparece o aceite das amostras). |
| 5 | **Produção e inspeção** | T10, T11 | 12 min | Fotos, peso, vídeo, declaração; ETD; o que acontece numa reprovação. |
| 6 | **Amostras e container na origem** | T12, T13 | 12 min | A devolução da amostra trava o carregamento: explicar a ordem (D10). |
| 7 | **Documentos do embarque** | T14 | 10 min | Check list, packing list e invoice, com um exemplo de invoice que não bate. |
| A | **Avançado** | T16, T17, T18, T19, T20 | 12 a 15 min | Convite de book; lançar book (só Trading e perfis com a tela, D-P1); compra EXW; certificações; programação de compra. |

Total estimado: cerca de 95 minutos. Os módulos 2 e 4 são os mais densos; se for preciso encurtar, o 3 e o 7 são os candidatos a virar capítulos do 2 e do 6.

Dados para gravar: os módulos 2 a 7 são uma história só, na ordem do E2E-HP (book do Supplier A → solicitação → amostragem → pedido → contrato → sinal → inspeção → amostras → container → documentos). Cada módulo começa onde o anterior termina, então vale gravar na sequência, com um ponto de salvamento por módulo. O Supplier A é o único fornecedor de demonstração com condição de pagamento que gera sinal (30% no pedido).
