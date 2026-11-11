# Séries WBK e WSO · Wellmix, do Booking à proposta

Vídeos para quem trabalha dentro da Wellmix, do primeiro contato com a planilha do fornecedor até o pedido nascer. Dois papéis aparecem: o **operador** (`operador@wellmix.com`, funções **comprador** e **planner**) e o **administrador** (`admin@wellmix.com`). As duas séries seguem a mesma jarra, a **Jarra de vidro 1,5 L**, e acompanham a jornada na ordem:

- **WBK, o produto antes da solicitação** (etapa 1 de 9, Produto e Booking): a planilha do fornecedor vira um booking, o booking é fechado e analisado pelo Superplan, a Wellmix compara itens parecidos e pergunta ao fornecedor se ele faz o item, decide a resposta, cria o produto, liga ao Sankhya e libera na vitrine.
- **WSO, da solicitação do cliente à proposta e ao sinal** (etapas 3 e 4 de 9, Cotação e Sinal e pedido): a solicitação do cliente chega, vai a um fornecedor, a cotação volta, o preço ao cliente é fechado e aprovado, a proposta vai ao cliente, o sinal é confirmado e o pedido nasce. Fecham a série o interruptor da RFQ e a análise de viabilidade do Superplan.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e lista de qualidade). Os episódios seguem o modelo da seção 5 do guia e a forma do episódio CLI-02 ([02-cliente.md](02-cliente.md)). A ficha de cada episódio ganhou a linha **Quem faz**, porque aqui o papel muda de um episódio para o outro.

## Quem grava e o que cada conta vê

| Conta (senha `wellmix123`)  | Papel e funções                                   | O que faz nestes vídeos                                                                                                                                                  | O que **não** vê (docs/ACCESS.md)                                                                                                                                              |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `operador@wellmix.com`      | Operador Wellmix, funções Comprador e Planner     | Booking, Seleção de itens, Solicitações ao fornecedor, produto (bloco Produto e CODPROD), Solicitações do cliente, RFQ (envio a um fornecedor), cotação, preço ao cliente, envio para aprovação, pedido | Superplan (a tela), Financeiro, Contas a pagar, Configurações, Equipe e divisões, Auditoria, Linhas, Vitrine do cliente, Marketing, o interruptor da RFQ e do Sourcing, "Confirmar sinal recebido", os cartões financeiros do pedido (valor de venda, recebido, a receber, margem) |
| `admin@wellmix.com`         | Administrador (todas as telas e todos os níveis)  | Superplan, interruptor da RFQ e do Sourcing, aprovação do pré-custo (todos os níveis), "Confirmar sinal recebido", valores do pedido                                     | nada                                                                                                                                                                           |

Em cada episódio, `[QUEM VÊ]` diz quem faz o passo e quem não enxerga a tela. Regras que valem para a série toda:

- **A Wellmix vê tudo do pedido; fornecedor e cliente nunca veem o que é interno.** O fornecedor não vê o cliente, as alternativas da seleção, o Superplan, o preço de outros fornecedores nem a margem. O cliente não vê o fornecedor, o preço FOB, as cotações, a aprovação do pré-custo nem as etapas da solicitação.
- O operador **abre** as telas das suas funções: Booking, Solicitações, RFQ, Cotações, Pedidos, Embalagens, Containers, Produtos, Cadastros de parceiros (comprador e planner somados). O Superplan e tudo o que é financeiro são só do administrador (o administrador pode liberar telas a um login em Gestão → Equipe e divisões).
- Dentro de uma tela que o operador abre, **a função continua mandando**: o planner aprova o primeiro nível do pré-custo, mas quem enviou a escolha não aprova a própria escolha (WSO-02).
- Booking, aqui, é **a lista de produtos de uma planilha do fornecedor**, na Wellmix. Não é a reserva no navio (GUIA, seção 6).

Documentos lidos para esta série: `docs/SCOPE.md`, `docs/WORKFLOW.md`, `docs/ACCESS.md`, `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/RFQ_STANDBY.md`, `docs/QUOTE_FLOW.md`, `docs/APPROVALS.md`, `docs/SUPERPLAN.md`, `docs/SANKHYA.md`. Textos de tela conferidos nos dicionários pt (`src/i18n/modules/booking-lots.ts`, `supplier-requests.ts`, `supplier-request-product.ts`, `rfq-standby.ts`, `sourcing-standby.ts`, `approvals.ts`, `superplan.ts`, `superplan-rfq.ts`, `quote-flow.ts` e `src/i18n/dictionaries.ts`), no código das telas e no que o sistema mostrou ao percorrer o caminho com as contas do guia.

## Antes de gravar (ambiente e dados de cena)

- **Servidor:** build de produção, nunca `next dev` (GUIA, seção 7.1): `DATA_MODE=memory DATA_DIR=.data-video npx next start -p 3200`, entrando por `/login?intro=off`. Esconda a faixa de demonstração e o seletor DEMO com o CSS do GUIA, seção 7.3.
- **Língua:** tudo em pt. O Chrome em pt-BR faz o seletor de arquivo mostrar "Escolher arquivo" e a data do booking sair em dd/mm/aaaa (com o Chrome em inglês aparece "Choose File" e mm/dd/aaaa).
- **Perfis do Chrome:** um por papel, já logado (operador, administrador, fornecedor A em chinês, cliente). Os episódios mostram, em poucos segundos, a tela do fornecedor ou do cliente só para provar o que eles veem.
- **Pontos de salvamento** (guia, seção 7.2): um antes de cada episódio, com o nome `antes-<ID>`. A ordem de gravação é a ordem do índice abaixo.

| Ponto de salvamento | O que já precisa existir                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `antes-WBK-01`      | Carga de demonstração (fornecedores Shenzhen A, Guangzhou B e Ningbo C com login); nenhum booking; as três planilhas de teste abaixo; **sem** o fornecedor "Yiwu Glassware Co., Ltd." no cadastro |
| `antes-WBK-02`      | Booking nº 1 (planilha A), nº 2 (planilha B) e nº 3 (planilha C), todos em **Rascunho**, importados como no WBK-01                                                       |
| `antes-WBK-03`      | Os três bookings **Fechados** (o nº 3 com o fornecedor Yiwu já cadastrado, sem login)                                                                                  |
| `antes-WBK-04`      | Solicitação ao fornecedor nº 1 (jarra A) **Respondida** pelo fornecedor A (faz, 22,20 RMB, MOQ 1.000, 35 dias); uma segunda solicitação aprovada de outro item (a panela) para a cena de "Associar" |
| `antes-WBK-05`      | Solicitação nº 1 **Aprovada** com o produto "Jarra de vidro 1,5 L" (SKU UTL-001) criado e ainda fora da vitrine                                                      |
| `antes-WSO-01`      | O cliente `joao@lojista.com` enviou a solicitação de 1.200 un da "Jarra de vidro 1,5 L (UTL-001)", a criada no WBK-04 (episódio CLI-02); RFQ **em espera** (padrão) |
| `antes-WSO-02`      | A jarra já enviada ao fornecedor A (WSO-01) e a cotação **respondida** pelo fornecedor A (US$ 3,35, 35 dias, ficha completa)                                           |
| `antes-WSO-03`      | A escolha do fornecedor aprovada nos dois níveis (final do WSO-02): solicitação em "Aguardando sinal"                                                                  |
| `antes-WSO-04`      | RFQ em espera; uma solicitação ainda em "Solicitado" e outra com **duas cotações respondidas** (A e B), preparada antes, fora da gravação, com a RFQ ligada (e desligada de novo)    |
| `antes-WSO-05`      | Produto "Jarra de vidro 1,5 L" (UTL-001) no cadastro (criado no WBK-04), com o administrador logado                                                                      |

## Índice

| ID      | Episódio                                                      | Duração-alvo | Situação                                       |
| ------- | ------------------------------------------------------------- | ------------ | ---------------------------------------------- |
| WBK-01  | Importar um booking (planilha do fornecedor)                  | 3:30         | roteirizado, telas conferidas no build atual   |
| WBK-02  | Fechar o booking e ler a análise do Superplan                 | 4:30         | roteirizado, telas conferidas no build atual   |
| WBK-03  | Seleção de itens e solicitação ao fornecedor                  | 5:00         | roteirizado, telas conferidas no build atual   |
| WBK-04  | Decidir a resposta do fornecedor e criar o produto            | 5:00         | roteirizado, telas conferidas (ver ⚠ do CBM)   |
| WBK-05  | Ligar ao Sankhya e liberar na vitrine                         | 3:30         | roteirizado; busca no ERP só com credencial    |
| WSO-01  | Receber a solicitação do cliente e enviar ao fornecedor       | 4:00         | roteirizado, telas conferidas no build atual   |
| WSO-02  | Comparar a cotação e fechar o preço ao cliente                | 5:00         | roteirizado, telas conferidas no build atual   |
| WSO-03  | Proposta, sinal e nascimento do pedido                        | 4:30         | roteirizado, telas conferidas no build atual   |
| WSO-04  | RFQ em espera: o interruptor                                  | 3:30         | roteirizado, telas conferidas no build atual   |
| WSO-05  | Superplan: a viabilidade do produto                           | 5:00         | roteirizado, telas conferidas (ver ⚠ do CBM)   |

## Dados de cena: as três planilhas de booking

Use o mesmo cabeçalho do teste `tests/e2e/booking-supplier-request.spec.ts` (`HEADER`) com uma coluna a mais no fim, `COLOR ASSORTMENT`. Salve como `.xlsx`, aba `BOOKING`, uma linha de cabeçalho e uma linha por item. As planilhas abaixo foram usadas na conferência das telas.

Cabeçalho (22 colunas): `DATE`, `LOCAL`, `SUPPLIER NAME`, `SKU/FACTORY ITEM CODE`, `DESCRIPTION`, `FOB/EXW`, `CONI US $/RMB`, `PRICE`, `QTY/BOX`, `QTY/INNER`, `N.W./PC`, `G.W./PC`, `CBM`, `SIZE(CM) LENGTH`, `SIZE(CM) WIDTH`, `SIZE(CM) HEIGHT`, `CAPACITY(ML)`, `PACKAGE`, `MATERIAL`, `MOQ`, `PURCHASE QTY IN PCS`, `COLOR ASSORTMENT`.

**Planilha A** (Shenzhen Supplier A, data 2026.10.13, local Shenzhen). Duas linhas ficam incompletas de propósito (a panela sem capacidade; o pote sem CBM e sem MOQ), para o WBK-02. As linhas abaixo estão em texto com `;` e nomes de coluna abreviados, só para mostrar os valores: na planilha de verdade, use o cabeçalho completo acima, na mesma ordem, e deixe em branco o que está como "(vazio)":

```
DATE;LOCAL;SUPPLIER NAME;SKU;DESCRIPTION;FOB/EXW;COIN;PRICE;QTY/BOX;QTY/INNER;N.W.;G.W.;CBM;L;W;H;CAP(ML);PACKAGE;MATERIAL;MOQ;PURCHASE QTY;COLOR
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-JAR15;Jarra de vidro 1,5 L com tampa de bambu;FOB;RMB;22.9;12;6;1.13;1.25;0.069;12;12;24;1500;color box;glass + bamboo;1000;12000;clear
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-MORI2;Moringa de vidro 2 L com torneira;FOB;RMB;27.5;6;1;1.60;1.80;0.045;16;16;30;2000;color box;glass + bamboo;1000;6000;clear
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-THERM5;Garrafa térmica inox 500 ml;FOB;RMB;18.2;24;12;0.28;0.33;0.045;7;7;24;500;color box;stainless steel;2000;6000;black / white
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-CUP350;Copo de vidro 350 ml;FOB;USD;0.62;48;12;0.30;0.35;0.060;8;8;10;350;gift box;glass;3000;12000;clear
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-PAN24;Panela antiaderente 24 cm;FOB;USD;5.10;6;1;1.10;1.30;0.052;25;25;12;(vazio);color box;aluminium;500;1500;black
2026.10.13;Shenzhen;Shenzhen Supplier A;SZA-POT800;Pote hermético de vidro 800 ml;FOB;RMB;9.8;24;6;0.55;0.62;(vazio);14;10;8;800;color box;glass + PP;(vazio);4800;clear
```

**Planilha B** (Guangzhou Supplier B, data 2026.10.15, local Guangzhou), completa: `GZB-JAR15` "Jarra de vidro 1,5 L com tampa de bambu" USD 3.60 (caixa 12, inner 6, 1.10 kg líquido, 1.22 kg bruto, CBM 0.066, 12 × 12 × 24 cm, 1500 ml, color box, glass + bamboo, MOQ 1000, compra 12000); `GZB-CUP350` "Copo de vidro 350 ml com alça" USD 0.71; `GZB-BOT1L` "Garrafa de vidro 1 L com tampa de rosca" USD 1.05.

**Planilha C** (fornecedor que **não** está no cadastro: "Yiwu Glassware Co., Ltd.", data 2026.10.20, local Yiwu), completa: `YW-JAR15` "Jarra de vidro 1,5 L com bico dosador" RMB 23.5 (caixa 12, inner 6, CBM 0.070, 12 × 12 × 25 cm, 1500 ml, MOQ 1000, compra 6000); `YW-CUP350` "Copo de vidro 350 ml" RMB 4.1 (caixa 48, inner 12, CBM 0.060, 8 × 8 × 10 cm, 350 ml, gift box, MOQ 3000, compra 12000).

Com esses dados, depois de fechados, a busca "jarra" na Seleção de itens traz três jarras (A, B e C); a do fornecedor A sai com o menor preço mínimo (R$ 45,75, contra R$ 47,43 da B e R$ 46,88 da C no tipo de negócio padrão). As planilhas de erro do WBK-01 (uma sem cabeçalho e um arquivo de texto renomeado para `.xlsx`) saem de qualquer arquivo à mão.

---

## WBK-01 · Importar um booking (planilha do fornecedor)

> **Promessa:** ao final do vídeo você sabe subir a planilha de um fornecedor e conferir o que o sistema leu, sem criar nenhum produto ainda.

| Ficha                 |                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador                                                                                                                                                |
| Quem faz              | Operador (comprador ou planner), com a tela Booking. O administrador também faz.                                                                                 |
| Conta de gravação     | `operador@wellmix.com`, tela em pt (Chrome em pt-BR)                                                                                                             |
| Duração-alvo          | 3:30                                                                                                                                                             |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                  |
| Telas e rotas         | `/app/booking`, `/app/booking/import`, `/app/booking/lots/[id]`                                                                                                  |
| Dados antes de gravar | Ponto `antes-WBK-01`: nenhum booking carregado; planilha A em `.xlsx` (6 itens, a jarra entre eles); planilha sem cabeçalho e arquivo de texto `.xlsx` para os erros |
| Depois deste vídeo    | Nasce o **Booking nº 1** em **Rascunho** com 6 itens. Nada entra no cadastro de produtos nem no Sankhya; ninguém é avisado                                        |
| Antes · Próximo       | (abertura da série) · WBK-02                                                                                                                                     |
| Idiomas               | pt (base)                                                                                                                                                        |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/booking`**

- 🎬 Imagem: a tela **Booking** vazia, com a mensagem "Nenhum booking carregado ainda. Clique em Importar booking para subir a primeira planilha." e o botão vermelho "Importar booking". Uma janela do Excel com a planilha do fornecedor aparece ao lado e some.
- 🎙 Narração: "A planilha do fornecedor chegou. Em um minuto ela vira uma lista de itens que a Wellmix pode comparar, sem criar produto nenhum."
- 🔤 Na tela: `[TÍTULO]` "WBK-01 · Importar um booking"; `[ZOOM 150 %]` na mensagem de lista vazia.
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música sobe e baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/booking`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Este é o começo da jornada: o produto. Antes de existir pedido do cliente, a Wellmix escolhe o que vale comprar de cada fornecedor."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa e as etapas seguintes apagadas.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:40 · Abrir o Booking · menu → `/app/booking`**

- 🎬 Imagem: o cursor abre o menu **Pedidos** e clica em **Booking**. A tela mostra o título "Booking", o subtítulo "Planilhas de booking dos fornecedores. Suba a planilha, confira fornecedor, data e itens e feche: o Superplan analisa todos os itens." e, no alto à direita, os botões "Seleção de itens" e "Importar booking".
- 🎙 Narração: "No menu, abra Pedidos e clique em Booking. Aqui ficam as planilhas dos fornecedores. Para subir uma nova, clique em Importar booking."
- 🔤 Na tela: `[PASSO 1/6] Abra Pedidos → Booking`; `[BOTÃO] "Importar booking"`; `[QUEM VÊ]` "Só a Wellmix, com a tela Booking. Cliente e fornecedor não veem bookings"; `[ATENÇÃO]` "Aqui, booking é a lista de produtos da planilha. Não é a reserva no navio".
- ✂️ Edição: clique com onda de destaque; `[CORTE]` seco para a tela de importação.

**Cena 4 · 0:40–1:05 · A tela de importação · `/app/booking/import`**

- 🎬 Imagem: a tela **Importar booking** com o cartão "Planilha do booking": o campo "Arquivo" ("Excel (.xlsx ou .xls), até 80 itens."), o campo "Ou o link de uma planilha do Google Sheets" e a lista "Moeda quando a planilha não diz", com "USD". O cursor passa pelos três campos, nessa ordem.
- 🎙 Narração: "Escolha o arquivo do Excel, com até oitenta itens. Se a planilha está no Google Sheets, cole o link, compartilhado com qualquer pessoa. A moeda vale só para preços que vierem sem moeda."
- 🔤 Na tela: `[PASSO 2/6] Escolha o arquivo ou cole o link`; `[SETA]` "Até 80 itens" no campo "Arquivo"; `[SETA]` "Vale só quando a planilha não diz a moeda" em "Moeda quando a planilha não diz"; `[DICA]` "Mandou arquivo e link? Vale o arquivo."
- ✂️ Edição: `[ZOOM 150 %]` em cada campo por 2 s.

**Cena 5 · 1:05–1:40 · Colunas lidas e obrigatórias · `/app/booking/import`**

- 🎬 Imagem: `[ZOOM 150 %]` no cartão "Colunas lidas". O cursor sublinha os nomes com asterisco: FOB/EXW*, coin US$/RMB*, price*, qty/box*, qty/inner*, N.W./pc*, G.W./pc*, CBM*, size (cm) length*, width* e height*, capacity (ml)*, package*, material* e MOQ*. Depois passa pelo segundo parágrafo ("Também são guardados…").
- 🎙 Narração: "O cartão Colunas lidas mostra o que o sistema entende: fornecedor, data, código e descrição. Os campos com asterisco são obrigatórios para fechar: preço, moeda, caixa, pesos, medidas, capacidade, embalagem, material e MOQ, o pedido mínimo. Qualquer outra coluna fica guardada só como informação."
- 🔤 Na tela: `[PASSO 3/6] Confira as colunas obrigatórias`; `[SETA]` "* = obrigatório para fechar o booking"; `[ATENÇÃO]` "O cabeçalho tem de ser o do modelo: DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…".
- ✂️ Edição: manter 3 s no cartão inteiro para a leitura.

**Cena 6 · 1:40–2:00 · Importar · `/app/booking/import` → `/app/booking/lots/[id]`**

- 🎬 Imagem: clicar em "Arquivo" e escolher `booking-shenzhen-A.xlsx` (o nome do arquivo aparece ao lado do botão). Clicar em **Importar booking**: o botão mostra "Lendo a planilha…" e a página do booking abre.
- 🎙 Narração: "Escolha o arquivo e clique em Importar booking. O sistema lê a planilha e abre o booking em rascunho, com uma linha para cada item."
- 🔤 Na tela: `[PASSO 4/6] Escolha o arquivo`; `[PASSO 5/6] Clique em Importar booking`; `[BOTÃO] "Importar booking"`.
- ✂️ Edição: `[CORTE]` na abertura da página; manter o clique com onda.

**Cena 7 · 2:00–2:35 · O booking nasce em rascunho · `/app/booking/lots/[id]`**

- 🎬 Imagem: o título "Booking nº 1" com o selo **Rascunho** e o nome da planilha. O aviso verde "Booking carregado com 6 itens. Confira o fornecedor e a data, que vieram da planilha, e complete os itens." Em "Dados do booking": "Fornecedor" já escolhido (Shenzhen Supplier A) com a linha "Da planilha: Shenzhen Supplier A", "Origem" (Shenzhen) com "Cidade do fornecedor.", "Data" com "Da planilha: 13/10/2026", "Status" e "Itens" (6).
- 🎙 Narração: "Pronto: nasceu o Booking número um, em rascunho. O fornecedor e a data vieram da planilha: confira os dois. A origem é a cidade do fornecedor. Repare que nenhum produto foi criado: os itens são só linhas da planilha."
- 🔤 Na tela: `[PASSO 6/6] Confira fornecedor e data`; `[SETA]` "Veio da planilha" em "Fornecedor" e em "Data"; `[SETA]` "Cidade do fornecedor" em "Origem"; `[SETA]` "Status: Rascunho".
- ✂️ Edição: `[ZOOM 150 %]` em "Dados do booking" por 3 s.

**Cena 8 · 2:35–3:00 · O que a leitura avisa · `/app/booking/lots/[id]`**

- 🎬 Imagem: no cartão "Fechar o booking", o aviso âmbar "Falta para fechar: itens incompletos (2)." Rolar até a tabela "Itens (6)": campos obrigatórios vazios com borda âmbar e, na coluna "Conferência", "Falta: Capacidade (ml)" e "Falta: CBM, MOQ".
- 🎙 Narração: "O sistema avisa o que falta: aqui, dois itens incompletos. Os campos obrigatórios vazios ficam com borda âmbar, e a coluna Conferência diz qual falta. No próximo vídeo, completamos e fechamos."
- 🔤 Na tela: `[SETA]` "O que falta para fechar" no aviso âmbar; `[SETA]` "Campo obrigatório vazio" na borda âmbar; `[SETA]` "Qual campo falta" na coluna "Conferência".
- ✂️ Edição: `[ZOOM 150 %]` na linha do item 6 (a que tem "Falta: CBM, MOQ").

**Cena 9 · 3:00–3:15 · E agora? · `/app/booking`**

- 🎬 Imagem: voltar a **Booking** com o botão "Voltar aos bookings". A lista mostra uma linha: nº 1, "Rascunho", Shenzhen, Shenzhen Supplier A, 13/10/2026, 6 itens, 2 em "Incompletos", "Sem análise" em "Superplan".
- 🎙 Narração: "O booking fica em rascunho, só com a Wellmix. Nada vai para o cadastro de produtos nem para o Sankhya: isso só acontece depois da seleção."
- 🔤 Na tela: `[DEPOIS]` "Rascunho: só a Wellmix vê. Não existe produto, cliente nem estoque. O próximo passo é fechar o booking (WBK-02)"; `[BOTÃO] "Voltar aos bookings"`.
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 10 · 3:15–3:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WBK-02.
- 🎙 Narração: "Resumindo: abra Booking, clique em Importar booking, escolha o arquivo e confira o que foi lido. No próximo vídeo, fechamos o booking e lemos a análise."
- 🔤 Na tela: `[RESUMO]` "1 Pedidos → Booking · 2 Importar booking · 3 Escolha o arquivo e a moeda · 4 Confira fornecedor, data e o que falta"; chamada "Próximo: WBK-02 · Fechar o booking e ler a análise do Superplan".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** "Escolha a planilha (.xlsx ou .xls) ou cole o link do Google Sheets." (clicou em Importar sem arquivo e sem link) → **Correção:** escolha o arquivo ou cole o link.
- **Erro:** "Não achei o cabeçalho da ficha (DATE, SUPPLIER NAME, SKU, PRICE, QTY/BOX…). Confira se é o modelo." → **Correção:** use a planilha no modelo do fornecedor (cabeçalho na primeira linha).
- **Erro:** "Não foi possível ler o arquivo: envie a planilha em .xlsx." → **Correção:** abra no Excel e salve de novo como `.xlsx`.
- **Erro:** "A planilha não tem linhas de produto preenchidas." e "Muitos produtos de uma vez (máximo 80 por planilha): divida a planilha." → **Correção:** confira se há itens; acima de 80 itens, divida em duas planilhas.
- **Erro (Google Sheets):** "O link não é de uma planilha do Google Sheets (deve começar com https://docs.google.com/spreadsheets/d/…)." ou "O Google não entregou a planilha: ela não está compartilhada com "Qualquer pessoa com o link". Ajuste o compartilhamento e tente de novo." → **Correção:** em Compartilhar, escolha "Qualquer pessoa com o link" (Leitor) e cole o link copiado (não o de "Publicar na web").
- **Erro (arquivo antigo ou protegido):** "Arquivo .xls muito antigo (Excel 95 ou anterior): abra no Excel e salve como .xlsx." e "A planilha está protegida por senha: abra no Excel, tire a senha (Arquivo → Informações → Proteger Pasta de Trabalho) e envie de novo." → **Correção:** a que a mensagem pede.

### Passo a passo em texto

1. No menu, abra **Pedidos** e clique em **Booking**.
2. Clique em **Importar booking**.
3. Em **Arquivo**, escolha a planilha do fornecedor (Excel `.xlsx` ou `.xls`, até 80 itens). Se ela está no Google Sheets, cole o link em **Ou o link de uma planilha do Google Sheets** (compartilhada com "Qualquer pessoa com o link"). Com arquivo e link, vale o arquivo.
4. Em **Moeda quando a planilha não diz**, escolha a moeda (padrão USD). Ela vale só para os preços sem moeda.
5. Confira, em **Colunas lidas**, os campos com asterisco: eles são obrigatórios para fechar o booking (FOB/EXW, moeda, preço, qty/box, qty/inner, pesos líquido e bruto, CBM, comprimento, largura e altura, capacidade, embalagem, material e MOQ).
6. Clique em **Importar booking**.
7. O booking abre em **Rascunho**. Confira **Fornecedor** e **Data**, que vieram da planilha, e veja o aviso "Falta para fechar".
8. Nenhum produto foi criado: o booking só guarda as linhas da planilha. Siga para o fechamento (WBK-02).

### Notas de gravação

- As três planilhas de teste e o cabeçalho estão no começo deste arquivo ("Dados de cena"). Para a miniatura da linha ficar bonita, cole uma foto do produto em cada linha da planilha (coluna de foto); as planilhas de teste não têm imagem e a coluna "Foto" mostra "—".
- O seletor de arquivo é do navegador: com o Chrome em pt-BR ele mostra "Escolher arquivo / Nenhum arquivo escolhido". Combine o idioma do Chrome antes de gravar.
- A cena 8 mostra os dois itens incompletos da planilha A (a panela sem "Capacidade (ml)" e o pote sem CBM e sem MOQ). Eles são a ponte para o WBK-02.
- Os erros comuns podem ser gravados à parte e inseridos na edição: importar sem arquivo; importar uma planilha cuja primeira linha não tem o cabeçalho; importar um arquivo de texto com a extensão `.xlsx`; colar um link que não é do Google Sheets.
- Importar o mesmo arquivo duas vezes cria dois bookings. Grave a primeira importação e restaure o ponto de salvamento se precisar repetir.

### Pontos a confirmar

- ⚠ O link do Google Sheets **não foi exercitado** (a sessão de conferência não tem planilha compartilhada nem acesso ao Google). Os textos de erro acima vêm do dicionário; confirme o comportamento com uma planilha real compartilhada.
- ⚠ Arquivo grande (acima do teto da requisição, planilha com fotos): depois de escolher o arquivo o campo mostra "Planilha enviada: {name} ({size}). Agora clique em Importar e cadastrar.", mas o botão desta tela se chama **Importar booking** (o texto é o da importação da ficha técnica). Não gravei essa situação; confira com uma planilha grande antes de falar em "Importar e cadastrar".
- ⚠ Não há aviso de planilha repetida: importar o mesmo arquivo duas vezes cria dois bookings (confirmar se é a regra desejada).
- ⚠ A coluna de foto e o cartão do fornecedor da planilha (`SUPPLIER BUSINESS CARD`) não foram exercitados com imagens.

---

## WBK-02 · Fechar o booking e ler a análise do Superplan

> **Promessa:** ao final do vídeo você sabe completar um booking, fechá-lo e ler o que o Superplan calculou para cada item.

| Ficha                 |                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador                                                                                                                                                                                    |
| Quem faz              | Operador (comprador ou planner), com a tela Booking. O resultado do Superplan aparece dentro do Booking; **a tela Superplan** (a conta completa) é só do administrador (WSO-05)                         |
| Conta de gravação     | `operador@wellmix.com`, tela em pt (Chrome em pt-BR, para as datas saírem em dd/mm/aaaa)                                                                                                             |
| Duração-alvo          | 4:30                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                                      |
| Telas e rotas         | `/app/booking`, `/app/booking/lots/[id]`                                                                                                                                                             |
| Dados antes de gravar | Ponto `antes-WBK-02`: Bookings nº 1, 2 e 3 em Rascunho (planilhas A, B e C). O nº 1 tem 2 itens incompletos; o nº 3 vem de um fornecedor que ainda não está no cadastro                                |
| Depois deste vídeo    | O Booking nº 1 passa a **Fechado** e cada item guarda o retrato do Superplan (selo, preço mínimo e lucro). Os itens deixam de ser editáveis. Ninguém é avisado                                        |
| Antes · Próximo       | WBK-01 · WBK-03                                                                                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/booking/lots/[id]`**

- 🎬 Imagem: a tabela de itens de um booking **Fechado**, rolada até as últimas colunas: em "Superplan", cada item com um selo amarelo, "Mínimo R$ 45,75" e "Lucro 18,5%".
- 🎙 Narração: "Quando o booking fecha, cada item ganha o preço mínimo de venda, calculado pelo Superplan. Veja como chegar lá."
- 🔤 Na tela: `[TÍTULO]` "WBK-02 · Fechar o booking e ler a análise do Superplan"; `[ZOOM 150 %]` na coluna "Superplan".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/booking`**

- 🎬 Imagem: a lista de bookings com o Booking nº 1 em Rascunho. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Seguimos na primeira etapa. Antes de abrir qualquer pedido ao fornecedor, o booking precisa estar completo e analisado."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · A lista dos bookings · `/app/booking`**

- 🎬 Imagem: a tabela com uma linha por planilha: "Nº", "Status", "Origem", "Fornecedor", "Data", "Planilha", "Itens", "Incompletos", "Superplan", "Responsável" e "Carregado em". Digitar "shenzhen" em "Buscar em qualquer coluna" (a lista filtra enquanto se digita; abaixo do campo, "1 de 3 bookings"); apagar e clicar no cabeçalho "Fornecedor" para ordenar. Clicar no número 1.
- 🎙 Narração: "Em Booking, cada linha é uma planilha, com status, origem, fornecedor, itens e incompletos. Digite na busca para filtrar e clique no cabeçalho para ordenar. Abra o Booking número um."
- 🔤 Na tela: `[PASSO 1/7] Abra o booking`; `[SETA]` "Itens que ainda faltam completar" em "Incompletos"; `[DICA]` "A busca vale para qualquer coluna".
- ✂️ Edição: cortar a digitação da busca para 4 s.

**Cena 4 · 0:45–1:10 · Fornecedor e data · `/app/booking/lots/[id]`**

- 🎬 Imagem: em "Dados do booking", a lista "Fornecedor" (Shenzhen Supplier A · A 154678 · Shenzhen) e a linha "Da planilha: Shenzhen Supplier A". Trocar a lista para outro fornecedor e voltar: a "Origem" muda para a cidade dele. Mostrar o campo "Data" com "Da planilha: 13/10/2026". A cada troca a célula mostra "Gravando…" e depois "Gravado ✓".
- 🎙 Narração: "No rascunho, fornecedor e data gravam sozinhos, sem botão Salvar. A origem acompanha a cidade do fornecedor. Se a planilha escreveu o nome de outro jeito, escolha o certo na lista."
- 🔤 Na tela: `[PASSO 2/7] Confira fornecedor e data`; `[SETA]` "Grava sozinho" no campo; `[SETA]` "Origem = cidade do fornecedor"; `[ATENÇÃO]` "Só o rascunho é editável".
- ✂️ Edição: manter 1 s no "Gravado ✓".

**Cena 5 · 1:10–1:35 · Fornecedor que ainda não está no cadastro · `/app/booking/lots/[id]` (Booking nº 3)**

- 🎬 Imagem: abrir o Booking nº 3. No alto à direita, o cartão "Fornecedor da planilha sem cadastro" com "Nome" (Yiwu Glassware Co., Ltd.), "Nº da loja", "Telefone", "Cidade" e "País". Clicar em **Cadastrar e usar neste booking**. Aparecem o aviso verde "Fornecedor cadastrado e ligado a este booking." e o aviso âmbar "Fornecedor do Booking sem acesso ao portal: não consegue ver nem responder." com o link "Criar acesso →".
- 🎙 Narração: "Se o fornecedor da planilha ainda não existe, confira os dados e clique em Cadastrar e usar neste booking. Ele entra em Cadastros, mas sem login: por isso o aviso de sem acesso."
- 🔤 Na tela: `[PASSO 3/7] Cadastre o fornecedor da planilha`; `[BOTÃO] "Cadastrar e usar neste booking"`; `[SETA]` "Sem login: ele não vê as solicitações"; `[QUEM VÊ]` "O link "Criar acesso" abre o cadastro; só quem abre Cadastros cria o acesso".
- ✂️ Edição: `[CORTE]` de volta ao Booking nº 1.

**Cena 6 · 1:35–2:15 · Itens incompletos · `/app/booking/lots/[id]`**

- 🎬 Imagem: no Booking nº 1, o aviso "Falta para fechar: itens incompletos (2)." e a tabela "Itens (6)". Rolar para a direita até "Capacidade (ml) *" do item 5 (vazio, borda âmbar). Digitar "abc" e apertar Enter: a célula mostra "Valor que não dá para ler. Use número maior que zero, FOB ou EXW, e USD, RMB, BRL ou EUR." Trocar por "2500" e apertar Enter: "Gravado ✓". Fazer o mesmo em "CBM" (0,040) e "MOQ" (1000) do item 6. Recarregar: "Tudo preenchido: o booking pode ser fechado."
- 🎙 Narração: "Complete os campos com borda âmbar. Cada campo grava sozinho ao sair dele ou no Enter, e a célula confirma com Gravado. Valor que não dá para ler é recusado ali mesmo: use número maior que zero. Aqui faltam a capacidade da panela e o CBM e o MOQ do pote. Quando tudo estiver preenchido, o aviso fica verde."
- 🔤 Na tela: `[PASSO 4/7] Complete os campos obrigatórios`; `[SETA]` "* obrigatório para fechar" no cabeçalho; `[ERRO COMUM]` "Valor que não dá para ler. Use número maior que zero, FOB ou EXW, e USD, RMB, BRL ou EUR."; `[SETA]` "Tudo preenchido: o booking pode ser fechado.".
- ✂️ Edição: digitação em tempo real; cortar a espera do recarregamento.

**Cena 7 · 2:15–2:50 · Tipo de negócio e fechar · `/app/booking/lots/[id]`**

- 🎬 Imagem: o cartão "Fechar o booking" com "Ao fechar, o Superplan analisa todos os itens com os valores padrão (câmbio do dia, container e frete padrão) e o booking deixa de ser editável." Abrir a lista "Tipo de negócio do Superplan": vem "WELLMIX - UD - CHINA - MERCADO (padrão)" e há um tipo para cada linha (por exemplo "WELLMIX - VIDROS - CHINA - MERCADO"). Deixar o padrão e clicar em **Fechar e analisar**: o botão mostra "Analisando…" e aparece o aviso "Booking fechado. O Superplan analisou todos os itens." com o selo **Fechado**.
- 🎙 Narração: "No cartão Fechar o booking, o tipo de negócio do Superplan define markup, comissão e meta de lucro. Para esta planilha mista, o padrão serve. Clique em Fechar e analisar e espere. Depois de fechado, os itens não mudam mais."
- 🔤 Na tela: `[PASSO 5/7] Escolha o tipo de negócio e feche`; `[BOTÃO] "Fechar e analisar"`; `[ATENÇÃO]` "Depois de fechar, os itens não mudam mais"; `[DICA]` "Para comparar itens de bookings diferentes, use o mesmo tipo de negócio em todos"; `[ERRO COMUM]` "Há itens com campos obrigatórios vazios. Complete os campos marcados em cada item e feche de novo."
- ✂️ Edição: `[ZOOM 150 %]` no cartão; manter 2 s no selo "Fechado".

**Cena 8 · 2:50–3:35 · Ler a análise · `/app/booking/lots/[id]`**

- 🎬 Imagem: rolar a tabela para a direita até as colunas "Conferência" ("Completo") e "Superplan". Em cada item: o selo, o "Mínimo R$ …" (na jarra, "Mínimo R$ 45,75") e "Lucro 18,5%". Passar o cursor pelos itens da jarra, do copo e da garrafa térmica: o mínimo muda de item para item. No cartão "Superplan" (à direita do alto): "Analisado em {data} · WELLMIX - UD - CHINA - MERCADO". Voltar à lista: a coluna "Superplan" mostra "6 Abaixo da meta".
- 🎙 Narração: "O Superplan, a análise de viabilidade, calcula o custo de trazer cada item e o preço mínimo de venda. O selo diz se o lucro bate a meta: verde, viável; amarelo, abaixo da meta; vermelho, prejuízo; e falta dado quando falta preço ou câmbio. Compare os itens pelo valor do mínimo."
- 🔤 Na tela: `[PASSO 6/7] Leia o selo e o preço mínimo`; `[SETA]` "Viável" (verde), "Abaixo da meta" (amarelo), "Prejuízo" (vermelho), "Falta dado"; `[SETA]` "Mínimo R$: o menor preço de venda do tipo de negócio"; `[QUEM VÊ]` "Quem tem a tela Booking vê o resultado aqui. O fornecedor e o cliente nunca veem; a conta completa é só do administrador (WSO-05)"; `[ATENÇÃO]` "Hoje o selo sai igual para todos os itens: compare pelo Mínimo".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Superplan"; legenda do selo por 4 s.

**Cena 9 · 3:35–3:55 · Refazer a análise · `/app/booking/lots/[id]`**

- 🎬 Imagem: no cartão "Superplan", o botão **Refazer a análise**, com o mesmo seletor de tipo de negócio ao lado. Escolher "WELLMIX - VIDROS - CHINA - MERCADO" e clicar: aparece "Análise do Superplan refeita.", a linha "Analisado em {data} · WELLMIX - VIDROS - CHINA - MERCADO" e os mínimos descem um pouco (grave num booking de ensaio ou restaure o ponto de salvamento depois).
- 🎙 Narração: "Se o câmbio ou os parâmetros mudarem, clique em Refazer a análise. Dá até para trocar o tipo de negócio, e os preços mínimos são recalculados."
- 🔤 Na tela: `[BOTÃO] "Refazer a análise"`; `[DICA]` "O câmbio do dia muda: refaça antes de comparar itens"; `[SETA]` "Analisado em {data} · tipo de negócio".
- ✂️ Edição: cortar a espera do "Analisando…".

**Cena 10 · 3:55–4:15 · Status do booking · `/app/booking/lots/[id]`**

- 🎬 Imagem: o cartão "Mudar status" com "Novo status" e as opções do booking Fechado: Em andamento, Concluído e Cancelado. Mostrar a lista sem escolher nenhuma. Depois, na lista de bookings, o Booking nº 1 já como "Em andamento" (grave esta parte com um ponto de salvamento posterior ao WBK-03 ou mostre a tabela do ensaio).
- 🎙 Narração: "O status mostra em que pé o booking está: rascunho, fechado, em andamento, concluído ou cancelado. Ao abrir uma solicitação a um item, o booking fechado passa sozinho para em andamento."
- 🔤 Na tela: `[SETA]` "Mudar status" no cartão; `[SETA]` "Em andamento: já tem solicitação ao fornecedor"; `[DICA]` "Concluído volta a Em andamento, se precisar".
- ✂️ Edição: legendar os cinco status como uma linha: Rascunho → Fechado → Em andamento → Concluído; Cancelado à parte.

**Cena 11 · 4:15–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WBK-03.
- 🎙 Narração: "Resumindo: confira fornecedor e data, complete os itens, escolha o tipo de negócio e feche. Leia o preço mínimo e compare. No próximo vídeo, escolhemos o melhor item."
- 🔤 Na tela: `[RESUMO]` "1 Fornecedor e data · 2 Complete os campos com * · 3 Tipo de negócio e Fechar e analisar · 4 Compare pelo Mínimo"; chamada "Próximo: WBK-03 · Seleção de itens e solicitação ao fornecedor".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Escolha o fornecedor do booking (ou cadastre o da planilha) antes de fechar." → **Correção:** escolha o fornecedor na lista ou cadastre o da planilha (cena 5).
- **Erro:** "Informe a data do booking antes de fechar." e "Data inválida." → **Correção:** preencha o campo "Data" com uma data válida.
- **Erro:** "Há itens com campos obrigatórios vazios. Complete os campos marcados em cada item e feche de novo." → **Correção:** preencha os campos com borda âmbar (a coluna "Conferência" diz quais).
- **Erro:** "Valor que não dá para ler. Use número maior que zero, FOB ou EXW, e USD, RMB, BRL ou EUR." → **Correção:** número maior que zero; incoterm FOB ou EXW; moeda USD, RMB, BRL ou EUR.
- **Erro:** "Este booking não está mais em rascunho: os dados não mudam." → **Correção:** o booking já foi fechado; para outra conferência, use "Refazer a análise" ou fale com quem abriu o booking.
- **Erro:** "Esse status não pode vir depois do atual." → **Correção:** use um dos status da lista de "Mudar status".
- **Aviso na análise:** "Faltou: {lista}" no lugar do preço mínimo (por exemplo, "preço em RMB ou US$ (o cadastro está em outra moeda)") → **Correção:** o item não tem preço em RMB ou US$, ou falta câmbio; o booking só aceita essas duas moedas na conta.

### Passo a passo em texto

1. Em **Booking**, clique no número do booking em **Rascunho**.
2. Em **Dados do booking**, confira **Fornecedor** e **Data**. Cada campo grava sozinho. Se o fornecedor da planilha não está no cadastro, confira o cartão **Fornecedor da planilha sem cadastro** e clique em **Cadastrar e usar neste booking**.
3. Na tabela **Itens**, complete os campos obrigatórios (os com `*`, com borda âmbar). A coluna **Conferência** diz o que falta em cada item. O aviso "Falta para fechar" vira "Tudo preenchido: o booking pode ser fechado."
4. No cartão **Fechar o booking**, confira o **Tipo de negócio do Superplan** (o padrão serve para planilhas mistas; troque se a planilha é de uma linha só) e clique em **Fechar e analisar**.
5. Leia a coluna **Superplan**: o selo (**Viável**, **Abaixo da meta**, **Prejuízo** ou **Falta dado**), o **Mínimo** (preço mínimo de venda) e o **Lucro**. Compare os itens pelo valor do mínimo.
6. Se o câmbio ou os parâmetros mudarem, clique em **Refazer a análise** (o tipo de negócio pode ser trocado ali).
7. Em **Mudar status**, leve o booking a **Em andamento**, **Concluído** ou **Cancelado**. Ao abrir uma solicitação a um item, o booking fechado vira **Em andamento** sozinho.

### Notas de gravação

- Preencha os campos faltantes ao vivo (cena 6): capacidade da panela (item 5), CBM e MOQ do pote (item 6). Para o ensaio, o valor "abc" mostra a recusa na célula.
- O fechamento mostra números parecidos entre os itens do mesmo tipo (o lucro fica perto de 18,5% em todos). Isso é esperado hoje: a conta é feita no preço mínimo (ver ⚠ abaixo). Na narração, diga "compare pelo valor do mínimo", como no roteiro.
- Preços mínimos de referência da planilha A no tipo de negócio padrão, com o câmbio de 11/11/2026 (mostre o que a tela der no dia; não cite números na narração): jarra R$ 45,75, moringa R$ 55,54, garrafa térmica R$ 33,61, copo R$ 8,48, panela R$ 68,09, pote R$ 18,77. Com "WELLMIX - VIDROS - CHINA - MERCADO" (cena 9) os mínimos descem cerca de 3 %.
- Para a cena 10, o status "Em andamento" só aparece depois do WBK-03 (a solicitação ao fornecedor). Grave a lista com os três status (Rascunho, Fechado, Em andamento) depois de gravar o WBK-03 e encaixe aqui na edição.

### Pontos a confirmar

- ⚠ O botão se chama **Fechar e analisar** (`bookingLots.detail.close.submit`), não só "Fechar". A narração usa o nome real.
- ⚠ **Selo igual em todos os itens.** Ao fechar, o Superplan calcula no preço mínimo, e nesse preço o lucro depende quase só dos parâmetros: todos os itens saem "Abaixo da meta" com lucro de 18,5%. `docs/BOOKING.md` (regra 9) diz que o sinal verde, amarelo ou vermelho só existe depois de alguém testar um preço de venda, e que a análise em lote mostra "No preço mínimo" (`booking.signal.minimum`). As telas do booking por planilha (lista, detalhe, Seleção de itens e solicitação ao fornecedor) mostram o selo do preço mínimo mesmo assim. O roteiro avisa quem assiste; confirme com o dono se a tela deve mostrar "No preço mínimo" como na fila de produtos antiga.
- ⚠ **O operador vê o preço mínimo e o lucro %** de cada item (e, na Seleção de itens, o "Melhor preço mínimo"). `docs/BOOKING.md` seção 8 diz que custo, preço de venda e sinal só existem para quem abre o Superplan (administrador). Confirmar se, no booking por planilha, o operador deve ver o resultado do Superplan.
- ⚠ O Control Tower (Início) ainda mostra a faixa "BOOKING" com os quadrados da fila de produtos antiga (Novo, Em análise, Aprovado, Oferecido ao cliente, Reservado pelo cliente, Virou solicitação, Descartado), que não contam os bookings por planilha. Não use essa faixa nos vídeos até o dono decidir.
- ⚠ O campo "Data" do navegador depende do idioma do Chrome (mm/dd/aaaa em inglês; dd/mm/aaaa em pt-BR).

---

## WBK-03 · Seleção de itens e solicitação ao fornecedor

> **Promessa:** ao final do vídeo você sabe comparar itens parecidos de vários bookings, escolher o melhor e perguntar ao fornecedor dele se ele faz o que a Wellmix precisa.

| Ficha                 |                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, operador                                                                                                                                                                                |
| Quem faz              | Operador (comprador ou planner), com a tela Booking para escolher e abrir; a solicitação aparece em "Solicitações ao fornecedor" (tela Cotações, que o comprador e o planner abrem)                |
| Conta de gravação     | `operador@wellmix.com`, tela em pt. Para o fim da cena 9, uma janela com `supplier.a@china.com` (tela em chinês)                                                                                  |
| Duração-alvo          | 5:00                                                                                                                                                                                             |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                                  |
| Telas e rotas         | `/app/booking/selection`, `/app/supplier-requests/[id]`, `/app/supplier-requests`                                                                                                                |
| Dados antes de gravar | Ponto `antes-WBK-03`: três bookings **Fechados** (A, B e C), com o mesmo tipo de negócio; o fornecedor Yiwu já cadastrado e **sem login**; nenhuma solicitação ao fornecedor                         |
| Depois deste vídeo    | Nasce a **Solicitação ao fornecedor nº 1**, "Aberta", para o fornecedor da jarra escolhida. O booking dela passa a **Em andamento**. O fornecedor é avisado no sino. **Nenhum produto, cliente ou estoque nasce** |
| Antes · Próximo       | WBK-02 · WBK-04                                                                                                                                                                                  |
| Idiomas               | pt (base)                                                                                                                                                                                        |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/booking/selection`**

- 🎬 Imagem: a **Seleção de itens** filtrada por "jarra": três jarras lado a lado, de fornecedores diferentes, e uma delas com a linha destacada em verde e o selo "Melhor preço mínimo".
- 🎙 Narração: "Três fornecedores mandaram uma jarra parecida. Em poucos minutos você compara as três e abre a solicitação para a melhor."
- 🔤 Na tela: `[TÍTULO]` "WBK-03 · Seleção de itens e solicitação ao fornecedor"; `[ZOOM 150 %]` no selo "Melhor preço mínimo".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/booking/selection`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Ainda estamos antes do cliente. Aqui a Wellmix só pergunta ao fornecedor se ele faz o item. Ninguém compra nada, e nenhum produto nasce."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · Abrir a Seleção de itens · menu → `/app/booking/selection`**

- 🎬 Imagem: o cursor abre **Pedidos** e clica em **Seleção de itens** (o botão "Seleção de itens" da tela Booking leva ao mesmo lugar). A tela mostra o subtítulo "Itens dos bookings fechados. Filtre por parte da descrição, compare os parecidos e abra a solicitação ao fornecedor do melhor." e a contagem "11 itens". No alto, o aviso âmbar "Fornecedores sem acesso ao portal: a solicitação aberta a eles não chega a ninguém até o login ser criado." com o nome do fornecedor Yiwu.
- 🎙 Narração: "No menu, Pedidos, Seleção de itens. Aqui aparecem os itens dos bookings fechados, em andamento ou concluídos. O aviso no alto lembra de fornecedores que ainda não têm login."
- 🔤 Na tela: `[PASSO 1/8] Abra Pedidos → Seleção de itens`; `[QUEM VÊ]` "Só a Wellmix, com a tela Booking"; `[SETA]` "Itens de bookings fechados"; `[ATENÇÃO]` "Fornecedor sem acesso: veja a cena 10".
- ✂️ Edição: `[CORTE]` seco para a tela carregada.

**Cena 4 · 0:45–1:10 · Buscar por parte da descrição · `/app/booking/selection?q=jarra`**

- 🎬 Imagem: no campo "Buscar por parte da descrição" (com o exemplo "Ex.: copo vidro, garrafa térmica, 350") digitar "jarra" e clicar em **Filtrar**. A contagem passa a "3 itens". Mostrar o botão "Limpar".
- 🎙 Narração: "Escreva parte da descrição, como jarra, e clique em Filtrar. Cada palavra precisa aparecer no item, sem importar acento nem maiúscula. A lista fica ordenada pela descrição, para os parecidos ficarem juntos."
- 🔤 Na tela: `[PASSO 2/8] Filtre por parte da descrição`; `[BOTÃO] "Filtrar"`; `[SETA]` "A busca olha descrição, nome, código, material, embalagem e cores"; `[DICA]` "Quanto mais palavras, menos itens".
- ✂️ Edição: digitação em tempo real, sem aceleração.

**Cena 5 · 1:10–1:30 · "ver parecidos" · `/app/booking/selection`**

- 🎬 Imagem: de volta à lista completa (botão "Limpar"), clicar no link **ver parecidos** abaixo da jarra do fornecedor A. A busca vira "jarra vidro" e a lista mostra as três jarras.
- 🎙 Narração: "Quer achar os parecidos de um item? Clique em ver parecidos: o sistema busca pelas duas primeiras palavras da descrição."
- 🔤 Na tela: `[PASSO 3/8] Clique em ver parecidos`; `[SETA]` "As duas primeiras palavras da descrição"; `[DICA]` "Atalho para comparar o mesmo tipo de item".
- ✂️ Edição: `[ZOOM 150 %]` no link e no campo de busca depois do clique.

**Cena 6 · 1:30–2:15 · Comparar os itens · `/app/booking/selection?q=jarra vidro`**

- 🎬 Imagem: percorrer as colunas com o cursor: "Fornecedor" (e a cidade de origem), "Booking" (nº e data, com link), "Preço" (22,9 RMB, 3,6 USD, 23,5 RMB) e "Preço (US$)" (o RMB convertido pela cotação do dia), "MOQ", "Qtd/caixa", "CBM", "Medidas (cm)", "Capacidade (ml)", "Material / embalagem", "Qtd da planilha" e "Superplan" (selo e "Mínimo R$ …"). Terminar no selo verde **Melhor preço mínimo** do item de menor preço mínimo.
- 🎙 Narração: "Compare lado a lado. Em Preço está o valor da planilha, e em Preço em dólar, o RMB já convertido pela cotação do dia. Veja o mínimo do pedido, as peças por caixa, o CBM, as medidas e a capacidade. Na última coluna, o Superplan mostra o selo e o preço mínimo. O selo Melhor preço mínimo marca o menor entre os itens da tela, por isso filtre antes."
- 🔤 Na tela: `[PASSO 4/8] Compare as colunas`; `[SETA]` "RMB convertido pela cotação do dia" em "Preço (US$)"; `[SETA]` "Melhor preço mínimo: o menor do Superplan entre os itens mostrados"; `[ATENÇÃO]` "Filtre antes: o destaque compara só o que está na tela"; `[DICA]` "Compare itens analisados com o mesmo tipo de negócio".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Superplan" por 3 s.

**Cena 7 · 2:15–2:50 · Escolher e alternativas · `/app/booking/selection`**

- 🎬 Imagem: na jarra do fornecedor A, marcar o botão de rádio da coluna **Escolher**. Nas outras duas jarras, marcar a caixa da coluna **Alternativa**. Mostrar que só um item pode ser escolhido (o rádio), e que alternativas podem ser várias. Se houver um item que já tem solicitação em andamento, mostrar o link "Solicitação nº N" na coluna "Situação" e o rádio desligado.
- 🎙 Narração: "Marque o item escolhido: só um. A solicitação vai ao fornecedor dele. Depois, marque como alternativa os parecidos que você quer guardar: podem ser vários, até trinta. As alternativas ficam só com a Wellmix, para comparar ou abrir outra solicitação. Item que já tem solicitação em andamento mostra o número dela e não pode ser escolhido de novo."
- 🔤 Na tela: `[PASSO 5/8] Escolha um item e marque as alternativas`; `[SETA]` "Escolher: um só" na coluna; `[SETA]` "Alternativa: vários" na coluna; `[QUEM VÊ]` "As alternativas e o Superplan ficam só com a Wellmix. O fornecedor não vê"; `[ATENÇÃO]` "Item com solicitação Aberta ou Respondida não abre outra".
- ✂️ Edição: realce de 2 s em cada coluna.

**Cena 8 · 2:50–3:25 · Quantidade e o que a Wellmix precisa · `/app/booking/selection`**

- 🎬 Imagem: rolar até o cartão "Abrir solicitação ao fornecedor". Mostrar "Quantidade (peças)" com a dica "Em branco: a quantidade da planilha do item escolhido." (deixar em branco: serão 12.000). No campo "O que a Wellmix precisa no produto" (dica "Cor, embalagem, logo, ajuste… O fornecedor lê este texto.") digitar "Tampa de bambu com vedação de silicone e caixa individual com a marca Wellmix."
- 🎙 Narração: "Deixe a quantidade em branco para usar a da planilha, ou digite outra. Em O que a Wellmix precisa no produto, escreva cor, embalagem ou ajuste: o fornecedor lê esse texto."
- 🔤 Na tela: `[PASSO 6/8] Informe a quantidade e o que você precisa`; `[SETA]` "Em branco = quantidade da planilha"; `[SETA]` "O fornecedor lê este texto"; `[ERRO COMUM]` "A planilha não traz quantidade para este item: digite a quantidade."
- ✂️ Edição: digitação em tempo real; texto curto.

**Cena 9 · 3:25–4:05 · A solicitação nasce · `/app/supplier-requests/[id]`**

- 🎬 Imagem: clicar em **Abrir solicitação** (o botão mostra "Abrindo…"). Abre "Solicitação ao fornecedor nº 1", selo **Aberta**, fornecedor Shenzhen Supplier A, e o aviso verde "Solicitação aberta. O fornecedor foi avisado e responde no portal." Cartões: "O que a Wellmix pede" (item, quantidade 12.000 peças, preço do booking, MOQ e "O que a Wellmix precisa no produto"), "Alternativas (2)" com "Só a Wellmix vê: itens parecidos de outros bookings, para comparar ou abrir outra solicitação.", "Resposta do fornecedor" ("O fornecedor ainda não respondeu."), "Decisão da Wellmix" e "Booking" com o "Superplan do item escolhido". Em outra janela, o fornecedor A (em chinês) vê só o item, a quantidade, o preço que ele mesmo pôs na planilha ("Preço do booking") e o texto da Wellmix: sem alternativas, sem Superplan e sem a página do booking.
- 🎙 Narração: "Pronto: nasceu a solicitação número um, aberta, para o fornecedor da jarra escolhida. Ele foi avisado e responde pelo portal. Ele vê o item, a quantidade e o seu texto, mas não vê as alternativas, o Superplan nem outros fornecedores. Para você, ficam também as alternativas e o Superplan do item."
- 🔤 Na tela: `[PASSO 7/8] Clique em Abrir solicitação`; `[BOTÃO] "Abrir solicitação"`; `[SETA]` "Aberta: esperando o fornecedor"; `[QUEM VÊ]` "O fornecedor não vê as alternativas, o Superplan nem outros fornecedores"; `[ZOOM 150 %]` em "Alternativas (2)".
- ✂️ Edição: `[CORTE]` seco para a janela do fornecedor por 4 s e de volta.

**Cena 10 · 4:05–4:35 · Fornecedor sem acesso ao portal · `/app/supplier-requests/[id]`**

- 🎬 Imagem: na Seleção de itens, escolher o copo do fornecedor Yiwu (o selo "Sem acesso" aparece na coluna "Fornecedor") e clicar em **Abrir solicitação**. A página abre com o aviso âmbar "Fornecedor sem acesso ao portal: ele não vê nem responde esta solicitação." e o link "Yiwu Glassware Co., Ltd. · Criar acesso →"; abaixo, a dica "Crie o acesso no cadastro dele (ele passa a ver esta solicitação assim que entrar) ou registre aqui a resposta que ele der por fora (WeChat, e-mail)." O aviso verde diz "Solicitação aberta. O fornecedor ainda não tem acesso ao portal: crie o acesso ou registre a resposta dele aqui (veja o aviso acima)."
- 🎙 Narração: "Se o fornecedor não tem login, a solicitação abre, mas não chega a ninguém. Crie o acesso no cadastro dele ou registre aqui a resposta que ele mandar por WeChat ou e-mail."
- 🔤 Na tela: `[ATENÇÃO]` "Sem login, o fornecedor não vê nem responde"; `[SETA]` "Criar acesso →" no aviso; `[SETA]` "Selo Sem acesso" na coluna "Fornecedor"; `[QUEM VÊ]` "O link abre o cadastro; criar o acesso é de quem abre Cadastros".
- ✂️ Edição: `[ZOOM 150 %]` no aviso por 3 s.

**Cena 11 · 4:35–4:50 · E agora? · `/app/supplier-requests`**

- 🎬 Imagem: a lista **Solicitações ao fornecedor** (menu Pedidos): colunas "Nº", "Situação", "Fornecedor", "Item", "Quantidade", "Resposta" ("Esperando o fornecedor") e "Aberta em". Voltar à lista de bookings: o Booking nº 1 agora em "Em andamento".
- 🎙 Narração: "Agora é esperar o fornecedor. O aviso dele está no sino. Quando ele responder, o aviso chega para você. O booking dele passou sozinho para em andamento."
- 🔤 Na tela: `[DEPOIS]` "O fornecedor foi avisado no sino. Você será avisada quando ele responder (WBK-04). O booking passou a Em andamento"; `[SETA]` "Esperando o fornecedor" em "Resposta".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 12 · 4:50–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WBK-04.
- 🎙 Narração: "Resumindo: filtre, compare, escolha um item, marque as alternativas, escreva o que precisa e abra a solicitação. No próximo vídeo, decidimos a resposta."
- 🔤 Na tela: `[RESUMO]` "1 Filtrar e ver parecidos · 2 Escolher um item e marcar alternativas · 3 Quantidade e o que a Wellmix precisa · 4 Abrir solicitação"; chamada "Próximo: WBK-04 · Decidir a resposta do fornecedor e criar o produto".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Marque o item escolhido antes de abrir a solicitação." → **Correção:** marque o botão de rádio da coluna "Escolher" de um item.
- **Erro:** "Este item já tem uma solicitação em andamento. Abra a que existe." → **Correção:** abra a solicitação pelo link "Solicitação nº N" da coluna "Situação". Depois que a Wellmix decide (aprova, recusa ou cancela), o item pode ter outra.
- **Erro:** "A planilha não traz quantidade para este item: digite a quantidade." → **Correção:** preencha "Quantidade (peças)".
- **Erro:** "O booking deste item não está fechado. Feche o booking antes de abrir a solicitação." e "O booking deste item não tem fornecedor." → **Correção:** feche o booking (WBK-02) com fornecedor escolhido.
- **Erro:** "O fornecedor deste item está inativo ou não existe mais." → **Correção:** reative o fornecedor em Cadastros ou escolha o item de outro.
- **Erro:** "Algum valor não dá para ler. Use números maiores que zero." → **Correção:** a quantidade (zero, negativa ou absurda) tem de ser um número maior que zero.
- **Aviso:** "Nenhum item de booking fechado combina com a busca." → **Correção:** tire uma palavra da busca; "Nenhum booking fechado ainda. Feche um booking para os itens dele aparecerem aqui." → feche um booking.
- **Aviso:** "Mostrando {shown} de {n} itens. Refine a busca para ver o resto." (mais de 200 itens) → **Correção:** acrescente palavras à busca.

### Passo a passo em texto

1. No menu, abra **Pedidos** e clique em **Seleção de itens**. Só aparecem itens de bookings **Fechados**, **Em andamento** ou **Concluídos**.
2. Em **Buscar por parte da descrição**, escreva uma ou mais palavras (por exemplo, "jarra") e clique em **Filtrar**. Para achar os parecidos de um item, clique em **ver parecidos** abaixo dele. **Limpar** volta à lista toda.
3. Compare as colunas: **Preço** e **Preço (US$)** (o RMB é convertido pela cotação do dia), **MOQ**, **Qtd/caixa**, **CBM**, **Medidas (cm)**, **Capacidade (ml)**, **Material / embalagem**, **Qtd da planilha** e **Superplan** (selo e preço mínimo). O selo **Melhor preço mínimo** marca o menor preço mínimo entre os itens mostrados.
4. Na coluna **Escolher**, marque o item (um só). Na coluna **Alternativa**, marque os parecidos que ficam como alternativas (até 30). Item que já tem solicitação Aberta ou Respondida não pode ser escolhido de novo.
5. No cartão **Abrir solicitação ao fornecedor**, preencha **Quantidade (peças)** (em branco, vale a da planilha) e **O que a Wellmix precisa no produto**.
6. Clique em **Abrir solicitação**. Nasce a solicitação **Aberta** para o fornecedor do booking do item escolhido, e o booking passa a **Em andamento**.
7. Se o fornecedor não tem login ("Sem acesso" na coluna **Fornecedor**), crie o acesso pelo link **Criar acesso →** do aviso ou registre a resposta dele (WBK-04).

### Notas de gravação

- Faça a busca "jarra" com o ponto `antes-WBK-03`: sem solicitações abertas, os três itens aparecem com o rádio ativo. As três jarras do exemplo: A (22,9 RMB), B (3,60 USD) e C (23,5 RMB, "bico dosador"); a A sai com o "Melhor preço mínimo" no tipo de negócio padrão.
- Na coluna "Fornecedor", o fornecedor Yiwu aparece com o selo "Sem acesso" (ele foi cadastrado pelo booking, sem login). Mostre esse selo na cena 3 e use o copo dele na cena 10. Para a cena 10, o copo "Copo de vidro 350 ml" do Yiwu é o item mais simples.
- A cena 9 mostra a tela do fornecedor A em chinês por 4 s: o aviso dele fica no sino (a solicitação ao fornecedor não aparece em Pendências, ver ⚠). A tela do fornecedor mostra "供应商询单第 1 号", o item e o campo de resposta.
- A cena 11 usa a lista "Solicitações ao fornecedor": depois da cena 10 ela tem duas linhas (a da jarra, Aberta, e a do copo do Yiwu). Se quiser só a da jarra, grave antes da cena 10.
- Um item que já tem solicitação em andamento mostra o rádio desligado e o link "Solicitação nº N" na coluna "Situação" (a última coluna da tabela, rolando para a direita).

### Pontos a confirmar

- ⚠ O link se chama **ver parecidos**, com "v" minúsculo (`supplierRequests.selection.similar`). A legenda usa o texto como está na tela.
- ⚠ O selo "Melhor preço mínimo" compara **todos os itens mostrados**, não só os parecidos: sem filtro, destaca o item mais barato do conjunto (por exemplo, um copo). O roteiro avisa para filtrar antes. Confirmar se o destaque deve valer por grupo de parecidos.
- ⚠ A solicitação ao fornecedor **não aparece em Pendências** do fornecedor nem do operador: o aviso é só o sino (Notificações). Confirmar se isso é intencional, já que RFQ e outras etapas aparecem em Pendências.
- ⚠ O selo do Superplan nesta tela é o do preço mínimo e sai "Abaixo da meta" para todos os itens (ver ⚠ do WBK-02). Compare pelo "Mínimo R$".
- ⚠ O operador vê "Superplan" e "Melhor preço mínimo" (ver ⚠ do WBK-02 sobre quem vê o resultado do Superplan).

---

## WBK-04 · Decidir a resposta do fornecedor e criar o produto

> **Promessa:** ao final do vídeo você sabe aprovar ou recusar a resposta do fornecedor e, se aprovar, criar o produto (ou associá-lo a um que já existe) ligando os itens iguais.

| Ficha                 |                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador                                                                                                                                                                                          |
| Quem faz              | Operador que abre **Cotações** (para decidir) e **Produtos** (para criar ou associar): o comprador abre as duas. O planner sozinho não abre Produtos e não veria o bloco "Produto"                        |
| Conta de gravação     | `operador@wellmix.com`, tela em pt                                                                                                                                                                         |
| Duração-alvo          | 5:00                                                                                                                                                                                                       |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                                            |
| Telas e rotas         | `/app/notifications`, `/app/supplier-requests/[id]`, `/app/products/[id]`                                                                                                                                  |
| Dados antes de gravar | Ponto `antes-WBK-04`: Solicitação nº 1 (jarra A) **Respondida** pelo fornecedor (faz, 22,20 RMB, MOQ 1.000, 35 dias, observação); uma segunda solicitação **Aprovada** da panela para a cena de "Associar"     |
| Depois deste vídeo    | Solicitação **Aprovada**; produto **criado** (fora da vitrine) ou **associado**; itens ligados. O fornecedor é avisado da decisão no sino                                                                  |
| Antes · Próximo       | WBK-03 · WBK-05                                                                                                                                                                                            |
| Idiomas               | pt (base)                                                                                                                                                                                                  |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/supplier-requests/[id]`**

- 🎬 Imagem: o cartão "Resposta do fornecedor" com "Faz: 22,2 RMB", e logo abaixo o bloco "Produto" com o nome da jarra pronto para criar.
- 🎙 Narração: "O fornecedor disse que faz, e o preço é bom. Falta decidir. Um clique aprova, e o produto nasce com a ficha já preenchida."
- 🔤 Na tela: `[TÍTULO]` "WBK-04 · Decidir a resposta do fornecedor e criar o produto"; `[ZOOM 150 %]` no cartão "Resposta do fornecedor".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/supplier-requests/[id]`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Seguimos na primeira etapa. É aqui que um item da planilha deixa de ser só uma linha e vira um produto do catálogo da Wellmix."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · A resposta chega · `/app/notifications` → `/app/supplier-requests/[id]`**

- 🎬 Imagem: o sino da Wellmix com um número. Abrir **Notificações**: em "Precisa de você", "O fornecedor respondeu a solicitação nº 1 · O fornecedor disse que faz. Confira as condições na solicitação nº 1 e decida." Clicar em **Abrir**. A solicitação agora tem o selo **Respondida** e o cartão "Resposta do fornecedor": "Faz: 22,2 RMB", "Pedido mínimo (peças): 1.000", "Prazo de produção (dias): 35", a observação do fornecedor e "Respondido em {data}".
- 🎙 Narração: "Quando o fornecedor responde, o aviso chega no sino. Abra a solicitação: ela fica respondida, com preço por peça, pedido mínimo, prazo de produção e a observação dele."
- 🔤 Na tela: `[PASSO 1/8] Abra o aviso e a solicitação`; `[SETA]` "O aviso chega no sino, não em Pendências"; `[SETA]` "Respondida: falta a sua decisão"; `[ZOOM 150 %]` no cartão da resposta.
- ✂️ Edição: `[CORTE]` seco da lista de avisos para a solicitação.

**Cena 4 · 0:45–1:15 · Quando a resposta veio por fora · `/app/supplier-requests/[id]`**

- 🎬 Imagem: em uma solicitação ainda "Aberta" (a do fornecedor sem login, por exemplo), o cartão "Resposta do fornecedor" com o texto "Use quando o fornecedor respondeu por fora do portal (WeChat, e-mail)." Preencher "Faz o que foi pedido?" (Sim, faço), "Preço por peça", "Moeda", "Pedido mínimo (peças)", "Prazo de produção (dias)" e "Observação" e clicar em **Registrar a resposta do fornecedor**. Aparece "Resposta registrada." e a solicitação passa a **Respondida**.
- 🎙 Narração: "Se o fornecedor respondeu por WeChat ou e-mail, registre a resposta por ele: faz ou não faz e, se faz, o preço por peça. Ele ainda pode mudar a resposta até a Wellmix decidir."
- 🔤 Na tela: `[PASSO 2/8] Registre a resposta em nome do fornecedor`; `[BOTÃO] "Registrar a resposta do fornecedor"`; `[ERRO COMUM]` "Informe o preço por peça para dizer que faz."; `[SETA]` "Você pode mudar a resposta até a Wellmix decidir.".
- ✂️ Edição: digitação em tempo real, sem aceleração; `[ZOOM 150 %]` no botão.

**Cena 5 · 1:15–1:50 · Decidir · `/app/supplier-requests/[id]`**

- 🎬 Imagem: voltar à solicitação da jarra (Respondida). No cartão "Decisão da Wellmix", o campo "Observação da decisão" (digitar "Preço e condições aceitos.") e os botões **Aprovar** e **Recusar**. Mostrar, sem clicar, que numa solicitação ainda Aberta os botões são "Cancelar a solicitação" e "Recusar". Clicar em **Aprovar**: aparece "Solicitação aprovada. Crie o produto ou associe a um existente no bloco Produto, logo abaixo." e o selo **Aprovada**; a observação aparece como "Decidido em {data} · Preço e condições aceitos."
- 🎙 Narração: "No cartão Decisão da Wellmix, escreva uma observação e decida. Se o fornecedor disse que faz, você aprova ou recusa. Se disse que não faz, só dá para recusar. Enquanto a solicitação está aberta, também dá para cancelar. Ao aprovar, o fornecedor recebe o aviso da decisão, e o bloco Produto aparece logo abaixo."
- 🔤 Na tela: `[PASSO 3/8] Aprove ou recuse`; `[BOTÃO] "Aprovar"`; `[BOTÃO] "Recusar"`; `[ATENÇÃO]` "Depois da decisão, a resposta do fornecedor não muda mais"; `[ERRO COMUM]` "Essa decisão não vale para a situação atual da solicitação."
- ✂️ Edição: legenda curta com as três situações: Aberta (Cancelar ou Recusar), Respondida "faz" (Aprovar ou Recusar), Respondida "não faz" (Recusar).

**Cena 6 · 1:50–2:25 · Itens iguais · `/app/supplier-requests/[id]` (bloco Produto)**

- 🎬 Imagem: rolar até o bloco **Produto** ("Solicitação aprovada: crie o produto com o nome correto ou associe a um que já existe, e ligue a ele os itens iguais dos bookings."). Em "Itens de booking ligados ao produto": o item escolhido (selo "escolhido", sempre marcado) e as duas alternativas já marcadas. Desmarcar a jarra "com bico dosador" do Yiwu (outro produto). Mostrar a busca "Buscar mais itens nos bookings".
- 🎙 Narração: "Em itens de booking ligados ao produto, o escolhido sempre entra, e as alternativas já vêm marcadas. Desmarque as que não são o mesmo produto, como a jarra com bico dosador. Você também pode buscar mais itens nos bookings."
- 🔤 Na tela: `[PASSO 4/8] Marque só os itens iguais`; `[SETA]` "O escolhido sempre entra"; `[SETA]` "Desmarque o que não é o mesmo produto"; `[DICA]` "Os fornecedores dos itens marcados entram na lista de fornecedores do produto".
- ✂️ Edição: `[ZOOM 150 %]` na lista de itens por 3 s.

**Cena 7 · 2:25–3:10 · Criar produto novo · `/app/supplier-requests/[id]`**

- 🎬 Imagem: no cartão "Criar produto novo": "Nome do produto" (já vem da descrição do item; o nome sugerido é a descrição da planilha, "Jarra de vidro 1,5 L com tampa de bambu"; digitar o nome correto, "Jarra de vidro 1,5 L"), "Linha de produto" (escolher "Utilidades domésticas") e a dica "Preço, moeda e MOQ vêm da resposta do fornecedor; medidas, caixa, material e foto vêm do item. O produto nasce fora da vitrine do cliente." Clicar em **Criar produto** (o botão mostra "Gravando…"). Aparece "Produto criado e itens ligados. Ele está fora da vitrine até ser liberado." e o bloco mostra "Produto criado", o nome do produto como link e "2 itens de booking ligados".
- 🎙 Narração: "Em Criar produto novo, escreva o nome correto e escolha a linha de produto. O preço, a moeda e o MOQ vêm da resposta do fornecedor; medidas, caixa e material vêm do item. O produto nasce fora da vitrine do cliente."
- 🔤 Na tela: `[PASSO 5/8] Dê o nome e escolha a linha`; `[BOTÃO] "Criar produto"`; `[SETA]` "Preço, moeda e MOQ: da resposta do fornecedor"; `[ATENÇÃO]` "O produto nasce fora da vitrine do cliente"; `[ERRO COMUM]` "Informe o nome do produto."
- ✂️ Edição: `[ZOOM 150 %]` na dica do cartão; manter 2 s no aviso verde.

**Cena 8 · 3:10–3:40 · Ou associar a um produto que já existe · `/app/supplier-requests/[id]`**

- 🎬 Imagem: (gravada à parte, numa solicitação aprovada de outro item, a panela) em "Buscar produto no catálogo" digitar "panela" e clicar em **Buscar**. No cartão "Associar a um produto existente" aparece "Jogo de panelas antiaderentes 5 pçs · UTL-002 · SZA-PAN5". Marcar o produto e clicar em **Associar ao produto marcado**. Aparece "Solicitação associada ao produto e itens ligados." e o bloco mostra "Associada a um produto existente".
- 🎙 Narração: "Se o produto já está no catálogo, não crie outro: busque pelo nome ou código, marque o produto e clique em Associar ao produto marcado. O cadastro dele não muda; só ganha o novo fornecedor."
- 🔤 Na tela: `[PASSO 6/8] Ou associe a um produto existente`; `[BOTÃO] "Associar ao produto marcado"`; `[SETA]` "Busca por nome, código, código da fábrica ou CODPROD"; `[ERRO COMUM]` "Marque o produto do catálogo para associar."
- ✂️ Edição: `[CORTE]` para a gravação à parte; legenda "Outra solicitação, outro item".

**Cena 9 · 3:40–4:20 · O produto criado · `/app/products/[id]`**

- 🎬 Imagem: no bloco, clicar no nome do produto. A ficha abre com o título "Jarra de vidro 1,5 L", a linha "Utilidades domésticas", "CODPROD —" e "Origem: Importação". Em "Identificação", o campo "SKU" vem vazio: digitar "UTL-001" e clicar em **Salvar ficha** ("Dados salvos."). Em "Fornecedor e negociação": fornecedor "Shenzhen Supplier A", "Código no fornecedor" (SZA-JAR15), MOQ 1000 e preço 22,20 em Yuan (CNY). Rolar até "Fornecedores deste produto": Shenzhen Supplier A com os selos "Principal" e "Cotação" e Guangzhou Supplier B com "Incluído à mão".
- 🎙 Narração: "Aqui está o produto. O fornecedor da solicitação virou o principal, com o código dele, o MOQ e o preço da resposta. O da alternativa entrou na lista de fornecedores. O SKU vem vazio: digite UTL zero zero um e salve. Confira a ficha, principalmente as medidas e a caixa."
- 🔤 Na tela: `[PASSO 7/8] Confira a ficha e preencha o SKU`; `[SETA]` "Fornecedor principal: o da solicitação"; `[SETA]` "Fornecedores deste produto"; `[BOTÃO] "Salvar ficha"`; `[ATENÇÃO]` "Confira as medidas e o CBM da caixa antes de seguir".
- ✂️ Edição: não dê zoom em "Embalagem" até a correção do ⚠ 1 (Dimensões da caixa master e CBM por caixa saem trocados).

**Cena 10 · 4:20–4:45 · E agora? · `/app/supplier-requests/[id]`**

- 🎬 Imagem: voltar à solicitação. O bloco "Produto" mostra o aviso âmbar "Fora da vitrine do cliente até ser liberado." com o botão "Liberar na vitrine", e os cartões "Ligar mais itens" e "Sankhya".
- 🎙 Narração: "O produto existe, mas o cliente ainda não o vê. Os próximos passos são ligar o código do Sankhya e liberar na vitrine, e o fornecedor já foi avisado da sua decisão."
- 🔤 Na tela: `[DEPOIS]` "O produto está fora da vitrine. O fornecedor foi avisado da aprovação no sino. Próximo: CODPROD e vitrine (WBK-05)"; `[SETA]` "Ligar mais itens: busque outros itens iguais nos bookings".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 11 · 4:45–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WBK-05.
- 🎙 Narração: "Resumindo: leia a resposta, aprove ou recuse, marque os itens iguais e crie o produto ou associe a um existente. No próximo vídeo, ligamos ao Sankhya e liberamos."
- 🔤 Na tela: `[RESUMO]` "1 Leia a resposta · 2 Aprovar ou Recusar · 3 Marque os itens iguais · 4 Criar produto ou Associar"; chamada "Próximo: WBK-05 · Ligar ao Sankhya e liberar na vitrine".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Informe o preço por peça para dizer que faz." → **Correção:** preencha "Preço por peça" ao responder (ou registrar) "Sim, faço".
- **Erro:** "A Wellmix já decidiu esta solicitação: a resposta não muda mais." → **Correção:** a solicitação já foi aprovada, recusada ou cancelada; abra outra pela Seleção de itens, se precisar.
- **Erro:** "Essa decisão não vale para a situação atual da solicitação." → **Correção:** confira os botões do cartão "Decisão da Wellmix" (Aberta: Cancelar ou Recusar; Respondida que faz: Aprovar ou Recusar; Respondida que não faz: Recusar).
- **Erro:** "Só uma solicitação aprovada ganha produto." → **Correção:** aprove a solicitação primeiro.
- **Erro:** "Informe o nome do produto." → **Correção:** preencha "Nome do produto".
- **Erro:** "Escolha uma linha de produto ativa." → **Correção:** escolha uma linha em "Linha de produto". ⚠ Hoje, sem escolher a linha, a tela mostra "Algum valor não dá para ler. Use números maiores que zero." (ver ⚠ 2).
- **Erro:** "Um dos itens marcados já está ligado a outro produto. Desmarque-o." → **Correção:** desmarque o item que já pertence a outro produto.
- **Erro:** "Esta solicitação já tem produto." → **Correção:** o produto já foi criado ou associado; use "Ligar mais itens".
- **Erro:** "Marque o produto do catálogo para associar." e "Nenhum produto com esse texto." → **Correção:** busque pelo nome ou código e marque um produto da lista.

### Passo a passo em texto

1. Abra o aviso "O fornecedor respondeu a solicitação nº N" no sino (Notificações) e clique em **Abrir**. A solicitação está **Respondida**.
2. Leia o cartão **Resposta do fornecedor**: "Faz" com o preço, **Pedido mínimo (peças)**, **Prazo de produção (dias)** e a observação. Se a resposta veio por fora (WeChat, e-mail), preencha o cartão e clique em **Registrar a resposta do fornecedor**.
3. No cartão **Decisão da Wellmix**, escreva a **Observação da decisão** e clique em **Aprovar** (ou **Recusar**). Numa solicitação ainda **Aberta**, os botões são **Cancelar a solicitação** e **Recusar**.
4. Na solicitação **Aprovada**, role até o bloco **Produto**. Em **Itens de booking ligados ao produto**, o escolhido sempre entra; desmarque as alternativas que não são o mesmo produto. Use **Buscar mais itens nos bookings** para trazer outros iguais.
5. Para um produto novo: em **Criar produto novo**, confira **Nome do produto**, escolha a **Linha de produto** e clique em **Criar produto**. Preço, moeda e MOQ vêm da resposta do fornecedor; medidas, caixa, material e foto, do item. O produto nasce fora da vitrine.
6. Para um produto que já existe: em **Buscar produto no catálogo**, busque por nome, código, código da fábrica ou CODPROD, marque o produto e clique em **Associar ao produto marcado**. O cadastro dele não muda.
7. Clique no nome do produto para abrir a ficha e conferir os dados. **Ligar mais itens** acrescenta outros itens depois.

### Notas de gravação

- Para as cenas 5 a 7, use o ponto `antes-WBK-04` com a solicitação da jarra Respondida. Para a cena 4, use uma solicitação ainda "Aberta" (a do copo do Yiwu, que não tem login) e registre a resposta por ele; para a recusa, use a mesma solicitação (digite uma observação como "Preço acima do outro booking" e clique em "Recusar": aparece "Solicitação recusada.").
- A cena 8 usa **outra solicitação aprovada** (a panela SZA-PAN24, do mesmo fornecedor), porque a da jarra já terá virado produto na cena 7. Resultado: "Jogo de panelas antiaderentes 5 pçs (UTL-002)".
- **A jarra da jornada (README):** o produto criado aqui é a "Jarra de vidro 1,5 L (UTL-001)" que o cliente pede no CLI-02 e que segue até a entrega. A carga de demonstração já traz um produto com esse nome e esse SKU (sem fornecedor, sem preço e sem foto). Antes do WBK-01, **renomeie ou retire** o de demonstração em Cadastros → Produtos; senão a vitrine mostra duas jarras iguais. O produto criado pelo booking nasce **sem SKU**: digite "UTL-001" na ficha (cena 9) e clique em "Salvar ficha". Se o dono preferir manter o produto de demonstração, use **Associar** no lugar de **Criar** na solicitação da jarra (busque "jarra" em "Buscar produto no catálogo"): o cadastro dele não muda, e o WBK-05 perde o "Liberar na vitrine" (só vale para produto criado). Ver ⚠ 3.
- O nome sugerido em "Nome do produto" é a descrição do item (160 caracteres no máximo). Edite para o nome correto.
- A foto do item é copiada para o produto como "foto do fornecedor"; as planilhas de teste não têm foto, então a ficha mostra "Sem foto" (ver GUIA, seção 7.5).

### Pontos a confirmar

- ⚠ **1. Medidas e CBM da caixa saem trocados.** Ao criar o produto, as medidas **da peça** do item (12 × 12 × 24 cm) são gravadas como "Dimensões da caixa master", e o "CBM por caixa" mostra **0,0035 m³** ("Calculado das dimensões da caixa"), em vez dos **0,069 m³** do booking. O mesmo valor aparece no cartão da solicitação do cliente ("Caixa master: … 12 × 12 × 24 cm · 0,0035 m³"), na ficha da cotação (o CBM vem preenchido e travado) e no Superplan ("Volume da caixa (m³): 0,0035", que dá 21.192 peças por container em vez de 11.820). A origem parece estar em `sheetFromRequest` (`src/lib/services/supplier-request-product.ts`), que passa `lengthCm/widthCm/heightCm` do item para campos que na ficha de compra são da caixa. Não grave o zoom em "Embalagem" nem o CBM enquanto isso não for corrigido; no WSO-05 o roteiro manda corrigir o volume à mão.
- ⚠ **2. Mensagem de erro enganosa.** Clicar em "Criar produto" sem escolher a "Linha de produto" mostra "Algum valor não dá para ler. Use números maiores que zero." (código `invalid_input`), não "Escolha uma linha de produto ativa." (`request_product_line_invalid`). A mensagem certa só aparece com uma linha inativa.
- ⚠ **3. Jarra duplicada e SKU em branco.** O produto criado pelo booking nasce **sem SKU** (a ficha mostra o campo vazio), e a base de demonstração já tem "Jarra de vidro 1,5 L" com o SKU UTL-001: o roteiro cria o produto com o nome "Jarra de vidro 1,5 L" e manda digitar o SKU, o que só fica sem duplicata se o produto de demonstração sair do catálogo antes (nota acima). O sistema não recusa dois produtos com o mesmo SKU: o "Salvar ficha" com "UTL-001" gravou "Dados salvos." mesmo com outro produto já usando o código. Decidir como a história da jarra fica.
- ⚠ O bloco mostra "1 itens de booking ligados" (sem plural) quando só um item é ligado (`srProduct.linkedItems`).
- ⚠ A resposta do fornecedor chega **só no sino** (Notificações), não em Pendências: confirmar se é intencional (mesmo ⚠ do WBK-03).
- ⚠ O planner sozinho (sem a função comprador) abre Cotações, mas não abre Produtos: o bloco "Produto" não aparece para ele (`canOpen(user, "products")`). Gravar com o comprador.

---

## WBK-05 · Ligar ao Sankhya e liberar na vitrine

> **Promessa:** ao final do vídeo você sabe ligar o produto ao código dele no Sankhya e liberar o produto para o cliente ver.

| Ficha                 |                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador                                                                                                                                                                                    |
| Quem faz              | Operador que abre **Cotações** e **Produtos** (o comprador abre as duas). O administrador também faz. O planner sozinho não vê o bloco "Produto"                                                       |
| Conta de gravação     | `operador@wellmix.com`, tela em pt. No fim, uma janela com `joao@lojista.com`                                                                                                                         |
| Duração-alvo          | 3:30                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking                                                                                                                                                                      |
| Telas e rotas         | `/app/supplier-requests/[id]` (bloco Produto), `/app/products/[id]`, `/app/explore/[id]` (o cliente)                                                                                                  |
| Dados antes de gravar | Ponto `antes-WBK-05`: solicitação nº 1 **Aprovada**, com o produto "Jarra de vidro 1,5 L" (SKU UTL-001) **criado** e ainda fora da vitrine; Sankhya **sem credencial** (modo manual)                  |
| Depois deste vídeo    | O produto tem **CODPROD** gravado ("não conferido", no modo manual) e está **na vitrine**: o cliente já pode pedir. A Wellmix não recebe aviso; o cliente também não                                    |
| Antes · Próximo       | WBK-04 · WSO-01                                                                                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/explore/[id]` (o cliente)**

- 🎬 Imagem: a conta do cliente abre o endereço do produto novo e vê "Página não encontrada". Corte para depois: a mesma página mostra "Jarra de vidro 1,5 L", "Preço sob consulta", "Pedido mínimo: 1.000 un" e o botão "Adicionar ao carrinho".
- 🎙 Narração: "O cliente ainda não vê esta jarra. Com um código do Sankhya e um clique, ela aparece na vitrine, pronta para ser pedida."
- 🔤 Na tela: `[TÍTULO]` "WBK-05 · Ligar ao Sankhya e liberar na vitrine"; `[SETA]` "Antes" e "Depois" nas duas telas.
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/supplier-requests/[id]`**

- 🎬 Imagem: o bloco "Produto" da solicitação aprovada. O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "É o último passo da primeira etapa: o produto precisa do código do ERP da Wellmix e da liberação para o cliente."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:50 · O produto nasce fora da vitrine · `/app/supplier-requests/[id]`**

- 🎬 Imagem: no bloco "Produto": o selo "Produto criado", o nome do produto como link e "2 itens de booking ligados". O aviso âmbar "Fora da vitrine do cliente até ser liberado." com o botão "Liberar na vitrine".
- 🎙 Narração: "O produto criado pelo booking nasce escondido. Enquanto não for liberado, o cliente não o encontra na vitrine, no carrinho, nem pelo endereço direto. O produto associado a um existente não muda."
- 🔤 Na tela: `[SETA]` "Fora da vitrine do cliente até ser liberado."; `[QUEM VÊ]` "Escondido do cliente: vitrine, página do produto, carrinho, nova solicitação e kit de marketing"; `[ATENÇÃO]` "Só o produto criado nasce escondido".
- ✂️ Edição: `[ZOOM 150 %]` no aviso âmbar por 3 s.

**Cena 4 · 0:50–1:20 · CODPROD, o código do Sankhya · `/app/supplier-requests/[id]`**

- 🎬 Imagem: rolar até o cartão "Sankhya" (ao lado de "Ligar mais itens"): "Sem código do Sankhya.", o campo "Buscar no Sankhya (descrição ou referência)" com o botão "Buscar" e o campo "CODPROD" com "Gravar código".
- 🎙 Narração: "O Sankhya é o ERP da Wellmix, e CODPROD é o código do produto lá. O portal não cria o produto no ERP: ele só liga ao código que já existe."
- 🔤 Na tela: `[PASSO 1/5] Ache o CODPROD do produto`; `[SETA]` "CODPROD = código do produto no Sankhya"; `[ATENÇÃO]` "O portal não cria produto no Sankhya: só liga a um código existente".
- ✂️ Edição: `[ZOOM 150 %]` no cartão "Sankhya".

**Cena 5 · 1:20–1:55 · Buscar no Sankhya · `/app/supplier-requests/[id]?eq=jarra`**

- 🎬 Imagem: digitar "jarra" em "Buscar no Sankhya (descrição ou referência)" e clicar em **Buscar**. Sem credencial, o cartão mostra "Sankhya sem credencial: digite o CODPROD; ele fica gravado como não conferido." Com o Sankhya ligado (cena gravada à parte, ⚠), a lista traz código, descrição e referência de cada produto, com o botão **Usar**.
- 🎙 Narração: "Busque pela descrição ou pela referência do fornecedor. Com o Sankhya ligado, aparece a lista, e o botão Usar grava o código. Sem a credencial, digite o código: ele fica gravado como não conferido."
- 🔤 Na tela: `[PASSO 2/5] Busque no Sankhya`; `[BOTÃO] "Buscar"`; `[BOTÃO] "Usar"`; `[SETA]` "Sem credencial: digite o CODPROD"; `[ERRO COMUM]` "O Sankhya não respondeu ({code}). Digite o CODPROD ou tente de novo."
- ✂️ Edição: legenda "Modo manual: a conferência com o ERP vem com a integração".

**Cena 6 · 1:55–2:30 · Digitar e gravar o CODPROD · `/app/supplier-requests/[id]`**

- 🎬 Imagem: em "CODPROD" digitar "40123" e clicar em **Gravar código**. Aparecem "CODPROD gravado sem conferir no Sankhya." e, no cartão, "CODPROD 40123, não conferido no Sankhya (sem credencial ou o ERP não respondeu)." Abrir a ficha do produto: o cabeçalho mostra o selo "CODPROD 40123".
- 🎙 Narração: "Digite o código, só números, e clique em Gravar código. A tela avisa que ficou não conferido, porque o ERP não foi consultado. Na ficha do produto, o código aparece no cabeçalho."
- 🔤 Na tela: `[PASSO 3/5] Digite o CODPROD e grave`; `[BOTÃO] "Gravar código"`; `[SETA]` "Não conferido: sem credencial"; `[ERRO COMUM]` "O CODPROD é um número (até 10 dígitos)."
- ✂️ Edição: `[ZOOM 150 %]` no selo "CODPROD 40123" do cabeçalho da ficha.

**Cena 7 · 2:30–2:55 · Liberar na vitrine · `/app/supplier-requests/[id]`**

- 🎬 Imagem: de volta ao bloco, clicar em **Liberar na vitrine**. Aparecem "Produto liberado na vitrine." e, no bloco, "Na vitrine desde {data}."
- 🎙 Narração: "Quando a ficha estiver conferida, clique em Liberar na vitrine. Daí em diante, o cliente enxerga o produto, e o aviso fica registrado com a data."
- 🔤 Na tela: `[PASSO 4/5] Clique em Liberar na vitrine`; `[BOTÃO] "Liberar na vitrine"`; `[ATENÇÃO]` "Confira a ficha e o preço antes de liberar".
- ✂️ Edição: manter 2 s no aviso verde.

**Cena 8 · 2:55–3:15 · Conferir como o cliente · `/app/explore`**

- 🎬 Imagem: trocar para a conta do cliente. Em **Explorar**, o produto aparece na linha "Utilidades domésticas", com "Preço sob consulta" e "Pedido mínimo: 1.000 un". Abrir o produto: mesma tela do gancho.
- 🎙 Narração: "Do lado do cliente, o produto já aparece. O preço estimado só aparece quando o cadastro tem câmbio, frete e impostos. Agora ele pode pedir, e a próxima série começa daí."
- 🔤 Na tela: `[PASSO 5/5] Confira como o cliente vê`; `[DEPOIS]` "O cliente já pode pedir esta jarra. A solicitação dele chega à Wellmix (WSO-01). Ninguém é avisado da liberação"; `[QUEM VÊ]` "O cliente nunca vê o fornecedor do produto".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 9 · 3:15–3:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WSO-01.
- 🎙 Narração: "Resumindo: ligue o CODPROD, grave, confira a ficha e libere na vitrine. Com o produto no ar, o cliente pede. No próximo vídeo, a Wellmix recebe esse pedido."
- 🔤 Na tela: `[RESUMO]` "1 Buscar ou digitar o CODPROD · 2 Gravar código · 3 Conferir a ficha · 4 Liberar na vitrine"; chamada "Próximo: WSO-01 · Receber a solicitação do cliente e enviar ao fornecedor".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "O CODPROD é um número (até 10 dígitos)." → **Correção:** digite só números, no máximo 10.
- **Erro (com o Sankhya ligado):** "Esse CODPROD não existe no Sankhya." → **Correção:** confira o código no ERP ou use a busca e o botão "Usar".
- **Aviso:** "O Sankhya não respondeu ({code}). Digite o CODPROD ou tente de novo." → **Correção:** digite o código; ele fica "não conferido".
- **Aviso:** "Nenhum produto no Sankhya com esse texto." → **Correção:** busque por outra parte da descrição ou pela referência do fornecedor.
- **Erro:** "Crie ou associe o produto antes." → **Correção:** o bloco "Produto" precisa ter o produto criado ou associado (WBK-04).
- **Erro:** "Só uma solicitação aprovada ganha produto." → **Correção:** aprove a solicitação primeiro (WBK-04).

### Passo a passo em texto

1. Na solicitação **Aprovada** com o produto criado, role até o bloco **Produto**. O aviso "Fora da vitrine do cliente até ser liberado." mostra que o cliente ainda não vê o produto.
2. No cartão **Sankhya**, use **Buscar no Sankhya (descrição ou referência)** e clique em **Buscar**. Com o Sankhya ligado, clique em **Usar** no produto certo.
3. Sem credencial, ou se você já sabe o código, digite-o em **CODPROD** (só números, até 10 dígitos) e clique em **Gravar código**. Sem a credencial, o código fica gravado como **não conferido**; com o Sankhya ligado, o código é conferido e um código inexistente é recusado.
4. Abra a ficha do produto (clique no nome dele): o cabeçalho mostra "CODPROD {código}". Para tirar o código, grave o campo vazio ("CODPROD retirado do produto.").
5. Confira a ficha (nome, linha, preço, medidas) e clique em **Liberar na vitrine**. O produto passa a aparecer para o cliente, e o bloco mostra "Na vitrine desde {data}".
6. Para ligar outros itens iguais depois, use **Ligar mais itens** (busca nos bookings e **Ligar os marcados**).

### Notas de gravação

- No modo demonstração o Sankhya não tem credencial (modo manual): a busca só mostra o aviso "Sankhya sem credencial…". Grave a lista de resultados (cena 5) numa instalação com a integração configurada, ou mostre só o aviso e explique que a lista vem com a integração (GUIA, seção 7.5).
- O código "40123" é só de exemplo. O campo aceita até 10 dígitos.
- A cena 1 usa a conta do cliente antes e depois: grave as duas tomadas da página do produto (antes e depois de "Liberar na vitrine") e junte na edição.
- O produto criado pelo booking não tem foto (as planilhas de teste não têm imagem): no cliente aparece "Sem foto". Cole uma foto na planilha para a gravação ficar bonita (GUIA, seção 7.5).
- O preço do cliente fica "Preço sob consulta" até o cadastro ter câmbio, frete marítimo por CBM, caixa master, CBM, II e IPI pelo NCM e ICMS (GUIA, seção 7.5). Não prometa preço na narração.

### Pontos a confirmar

- ⚠ **Busca e conferência no Sankhya com credencial não foram exercitadas** (a sessão não tem credencial). Os textos "Esse CODPROD não existe no Sankhya." e "Nenhum produto no Sankhya com esse texto." vêm do dicionário; confirme a lista de resultados e o botão "Usar" numa instalação com a integração.
- ⚠ Cena 6: o texto do cabeçalho da ficha é "CODPROD 40123" (selo cinza), e o cartão diz "não conferido". Conferir se o dono quer um selo próprio de "não conferido" na ficha.
- ⚠ A liberação fica na auditoria (`product.showcase_release`) e o código em `product.erp_code`; não conferi a tela Auditoria desses registros (só do administrador).
- ⚠ Um produto **associado** a um existente não tem "Liberar na vitrine" (ele já estava na vitrine): o episódio vale só para o produto **criado**.

---

## WSO-01 · Receber a solicitação do cliente e enviar ao fornecedor

> **Promessa:** ao final do vídeo você sabe achar a solicitação de um cliente e enviá-la ao fornecedor certo, em um clique, com a RFQ em espera.

| Ficha                 |                                                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador                                                                                                                                                                                     |
| Quem faz              | Operador que abre **Solicitações** e **RFQ** (comprador, planner e gerente de produto abrem as duas). O administrador também faz. O interruptor da RFQ é só do administrador (WSO-04)                  |
| Conta de gravação     | `operador@wellmix.com`, tela em pt. Uma janela com `supplier.a@china.com` (chinês) no fim da cena 9                                                                                                     |
| Duração-alvo          | 4:00                                                                                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação (a solicitação do cliente, etapa 2, acabou de chegar)                                                                                                                           |
| Telas e rotas         | `/app/notifications`, `/app/tasks`, `/app/requests`, `/app/requests/[id]`, `/app/rfq`, `/app/packaging`                                                                                                |
| Dados antes de gravar | Ponto `antes-WSO-01`: a solicitação do cliente (a jarra, 1.200 un, episódio CLI-02) em **Solicitado**; RFQ **em espera** (padrão); fornecedor Shenzhen Supplier A ativo e com login; agência cadastrada    |
| Depois deste vídeo    | A solicitação passa a **RFQ aberta**, com **uma cotação** convidada ao fornecedor. O fornecedor recebe o aviso "Cotação pedida" e a pendência de responder. **Nasce o briefing de embalagem** (faca e arte) para a agência |
| Antes · Próximo       | CLI-02 (o cliente envia) · WSO-02                                                                                                                                                                     |
| Idiomas               | pt (base)                                                                                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/rfq`**

- 🎬 Imagem: a tela **RFQ** com o selo "Em espera" e, na tabela "Solicitações em cotação", a linha da jarra com a lista "Escolha o fornecedor" e o botão vermelho "Enviar ao fornecedor". O cursor repousa perto do botão.
- 🎙 Narração: "O cliente pediu a jarra. Agora é a sua vez: em um clique, o pedido de preço segue ao fornecedor, e a embalagem começa."
- 🔤 Na tela: `[TÍTULO]` "WSO-01 · Receber a solicitação do cliente e enviar ao fornecedor"; `[ZOOM 150 %]` no botão "Enviar ao fornecedor".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/rfq`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "A solicitação do cliente acabou de chegar. Agora começa a cotação: a Wellmix descobre quanto o fornecedor cobra, em quanto tempo e com que condições."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa e "Solicitação" já marcada como concluída.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:50 · O aviso e a pendência · `/app/notifications` → `/app/tasks`**

- 🎬 Imagem: o sino com um número. Abrir **Notificações**: em "Precisa de você", "Nova solicitação nº 1: Jarra de vidro 1,5 L · 1.200 un. Abra a RFQ para os fornecedores." Depois, no menu **Início**, abrir **Pendências** ("Minhas pendências"): a linha "Enviar ao fornecedor: Jarra de vidro 1,5 L", com o detalhe "Escolha o fornecedor que vai analisar o produto", o tipo "Abrir RFQ", o prazo (7 dias) e o botão "Abrir".
- 🎙 Narração: "Quando o cliente envia, o aviso chega no sino, e a pendência aparece em Início, Pendências: enviar ao fornecedor, do tipo Abrir RFQ. O prazo é o de resposta ao cliente. Clique em Abrir para ir direto à solicitação."
- 🔤 Na tela: `[PASSO 1/7] Abra Início → Pendências`; `[SETA]` "Pendência: Enviar ao fornecedor"; `[ATENÇÃO]` "O aviso ainda diz 'Abra a RFQ': com a RFQ em espera, é enviar a um fornecedor"; `[BOTÃO] "Abrir"`.
- ✂️ Edição: `[ZOOM 150 %]` na linha da pendência por 3 s.

**Cena 4 · 0:50–1:15 · Pedidos → Solicitações · `/app/requests`**

- 🎬 Imagem: no menu **Pedidos**, clicar em **Solicitações**. A tela mostra os cartões "Todas", "Em aberto", "Aguardando sinal", "Viraram pedido" e "Prazo vencido", a busca "Buscar por nº, produto, descrição ou cliente" e a tabela: "Nº", "Produto", "Quantidade", "Cliente", "Situação" ("Solicitado"), "Próximo passo" ("Abrir a cotação com fornecedores · com a Wellmix"), "Prazo de resposta (SLA)", "Pedido", "Cotações" ("Nenhum convite"), "Analista" e "Data". Clicar em **Abrir**.
- 🎙 Narração: "Em Pedidos, Solicitações, estão todas as solicitações dos clientes. Os cartões do alto filtram por situação. Esta está Solicitado, e o próximo passo é abrir a cotação com fornecedores, com a Wellmix. Clique em Abrir."
- 🔤 Na tela: `[PASSO 2/7] Abra Pedidos → Solicitações`; `[SETA]` "Situação: Solicitado"; `[SETA]` "Próximo passo e com quem está"; `[BOTÃO] "Abrir"`; `[QUEM VÊ]` "O cliente vê a mesma solicitação em Orçamentos, sem fornecedor, cotações nem próximo passo".
- ✂️ Edição: `[CORTE]` seco para a solicitação.

**Cena 5 · 1:15–1:50 · A solicitação por dentro · `/app/requests/[id]`**

- 🎬 Imagem: o título "Jarra de vidro 1,5 L", "Solicitação nº 1", o selo **Solicitado** e o nome do cliente (Loja do João Ltda). No cartão "Solicitações": quantidade, "Prazo de resposta (SLA)", descrição e observação do cliente. Abaixo, a frase "Este produto ainda não foi enviado a nenhum fornecedor. Enviar ao fornecedor" (o segundo é um link). Mais abaixo, "Solicitante do cliente" e o cartão "Etapas da solicitação" com as nove etapas: Solicitação nova, RFQ aberta, Cotações recebidas, Comparação de cotações, Valor calculado, Aprovação do pré-custo, Faca (die-cut), Proposta ao cliente e Sinal.
- 🎙 Narração: "Aqui está tudo do pedido: quantidade, prazo e a observação do cliente. As Etapas da solicitação mostram o caminho até o sinal, com responsável e prazo. A frase em destaque leva ao envio ao fornecedor."
- 🔤 Na tela: `[PASSO 3/7] Confira o pedido do cliente`; `[SETA]` "Observação do cliente: vai para o fornecedor na cotação"; `[SETA]` "Etapas da solicitação: do pedido ao sinal"; `[QUEM VÊ]` "Só a Wellmix vê as etapas. O cliente não vê"; `[BOTÃO] "Enviar ao fornecedor"` (o link da frase).
- ✂️ Edição: `[ZOOM 150 %]` na tabela de etapas por 3 s.

**Cena 6 · 1:50–2:25 · Pedidos → RFQ · `/app/rfq`**

- 🎬 Imagem: o link da frase leva a **RFQ** (o mesmo caminho do menu **Pedidos** → "RFQ (em espera)"). O título "RFQ", o selo "Em espera", o cartão "Como está funcionando agora" ("A RFQ está em espera. … um fornecedor por produto."), "O que está guardado (nada foi apagado)" e "Ligar ou deixar em espera" (com "Só o administrador liga ou coloca a RFQ em espera."). Rolar até "Solicitações em cotação".
- 🎙 Narração: "A RFQ, o pedido de cotação, está em espera: hoje cada produto vai a um fornecedor só. A disputa entre vários está guardada, e só o administrador a liga. A lista embaixo mostra os pedidos que ainda esperam fornecedor."
- 🔤 Na tela: `[PASSO 4/7] Abra Pedidos → RFQ`; `[SETA]` "Em espera: um fornecedor por produto"; `[ATENÇÃO]` "A RFQ para vários fornecedores está em espera (WSO-04)"; `[QUEM VÊ]` "O operador vê a situação; o interruptor é só do administrador".
- ✂️ Edição: `[ZOOM 150 %]` no selo "Em espera".

**Cena 7 · 2:25–3:00 · Escolher e enviar · `/app/rfq`**

- 🎬 Imagem: na linha da jarra, abrir a lista "Escolha o fornecedor". Num produto criado pelo Booking (WBK-04), o fornecedor principal já vem marcado ("O fornecedor do produto já vem marcado."); para a jarra do catálogo (UTL-001, sem fornecedor principal), escolher **Shenzhen Supplier A**. Clicar em **Enviar ao fornecedor**. Aparece "Produto enviado ao fornecedor." e a linha passa a "RFQ aberta", fornecedor "Shenzhen Supplier A", "Responderam" "0 / 1".
- 🎙 Narração: "Escolha o fornecedor que vai analisar o produto. Se o produto veio do Booking, o fornecedor dele já vem marcado. Clique em Enviar ao fornecedor. Pronto: a solicitação ganhou uma cotação, esperando resposta."
- 🔤 Na tela: `[PASSO 5/7] Escolha o fornecedor`; `[PASSO 6/7] Clique em Enviar ao fornecedor`; `[BOTÃO] "Enviar ao fornecedor"`; `[DICA]` "Produto do Booking: o fornecedor principal já vem marcado"; `[ERRO COMUM]` "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera."
- ✂️ Edição: `[CORTE]` na confirmação; manter o clique com onda.

**Cena 8 · 3:00–3:30 · O briefing de embalagem nasce junto · `/app/packaging`**

- 🎬 Imagem: no menu **Pedidos**, abrir **Embalagens**. A tela "Embalagens (faca e arte)": a linha "Jarra de vidro 1,5 L · 1.200 un", "Solicitação nº 1", responsável "Agência Criativa", "Falta enviar: Faca (die-cut), Arte da embalagem", prazo, a situação "Em preparação" e o aviso "Venda ainda não confirmada".
- 🎙 Narração: "Ao enviar, nasce também o briefing de embalagem: a faca e a arte começam na agência, em paralelo com a cotação. A venda ainda não está confirmada, e o cliente nunca vê esse briefing."
- 🔤 Na tela: `[PASSO 7/7] Confira o briefing em Pedidos → Embalagens`; `[SETA]` "Faca (die-cut) e arte: a agência trabalha junto com a cotação"; `[SETA]` "Venda ainda não confirmada"; `[QUEM VÊ]` "A agência não vê o nome do cliente. O cliente nunca vê o briefing".
- ✂️ Edição: `[ZOOM 150 %]` na linha por 3 s.

**Cena 9 · 3:30–3:50 · E agora? · `/app/requests/[id]`**

- 🎬 Imagem: voltar à solicitação: o selo mudou para **RFQ aberta** e, em "Etapas da solicitação", "Solicitação nova" aparece "Concluída" e "RFQ aberta" mostra "0 de 1 responderam". Em outra janela, o fornecedor A (em chinês) com a pendência "RFQ: Jarra de vidro 1,5 L" nas Pendências e o aviso no sino.
- 🎙 Narração: "A solicitação passou a RFQ aberta. O fornecedor recebeu o aviso Cotação pedida e a pendência para responder com preço, prazo e condições. Quando ele responder, você será avisada."
- 🔤 Na tela: `[DEPOIS]` "O fornecedor foi avisado (sino e Pendências). A agência recebeu o briefing. Você será avisada quando a cotação chegar (WSO-02)"; `[SETA]` "0 de 1 responderam".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 10 · 3:50–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WSO-02.
- 🎙 Narração: "Resumindo: ache a pendência, abra a solicitação, escolha o fornecedor em Pedidos, RFQ e envie. Próximo vídeo: a cotação chega, e fechamos o preço."
- 🔤 Na tela: `[RESUMO]` "1 Pendência: Enviar ao fornecedor · 2 Pedidos → RFQ · 3 Escolha o fornecedor · 4 Enviar ao fornecedor"; chamada "Próximo: WSO-02 · Comparar a cotação e fechar o preço ao cliente".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera." → **Correção:** com a RFQ em espera, um produto vai a um fornecedor só. Para outro fornecedor, fale com o administrador (WSO-04).
- **Erro:** "A RFQ para vários fornecedores está em espera: escolha um fornecedor só." → **Correção:** escolha um único fornecedor.
- **Erro:** "Solicitação cancelada." → **Correção:** a solicitação foi excluída; abra a lista em Pedidos → Solicitações e confira.
- **Aviso:** "Nenhuma solicitação em cotação agora." (tabela vazia em Pedidos → RFQ) → **Correção:** não há solicitação esperando fornecedor ou cotação; confira em Pedidos → Solicitações.
- **Aviso:** o aviso do sino diz "Abra a RFQ para os fornecedores." enquanto a tela diz "Enviar ao fornecedor" → **Correção:** o caminho é o da tela (Pedidos → RFQ), um fornecedor só.

### Passo a passo em texto

1. No sino (**Notificações**) ou em **Início → Pendências**, abra "Enviar ao fornecedor: {produto}" (tipo "Abrir RFQ").
2. Ou vá por **Pedidos → Solicitações**: confira a **Situação** "Solicitado" e clique em **Abrir**.
3. Confira quantidade, **Prazo de resposta (SLA)**, descrição e observação do cliente. As **Etapas da solicitação** mostram o caminho até o sinal.
4. Na frase "Este produto ainda não foi enviado a nenhum fornecedor", clique em **Enviar ao fornecedor**. Você chega a **Pedidos → RFQ**.
5. Na linha do produto, abra **Escolha o fornecedor** e escolha um (num produto do Booking, o fornecedor principal já vem marcado).
6. Clique em **Enviar ao fornecedor**. Aparece "Produto enviado ao fornecedor." e a situação vira **RFQ aberta**, com "0 / 1" em **Responderam**.
7. Em **Pedidos → Embalagens**, confira o briefing aberto junto (faca e arte, com a agência).

### Notas de gravação

- Para a base de demonstração, a jarra "Jarra de vidro 1,5 L" (UTL-001) **não tem fornecedor principal**: a lista "Escolha o fornecedor" começa vazia e a gravação escolhe "Shenzhen Supplier A". Se a solicitação for de um produto criado pelo Booking (WBK-04), a lista já vem com o fornecedor da solicitação marcado; mostre essa variação com uma frase na cena 7.
- A pendência e o aviso da cena 3 usam textos fixos em português (não existem em en e zh): grave em pt mesmo.
- A cena 4 usa o menu **Pedidos**; o cliente vê a mesma lista em "Meus pedidos → Orçamentos".
- Na cena 9, o fornecedor A abre as Pendências (em chinês) e a etapa dele é "审核 Booking" (em pt, "Analisar o Booking"), com a linha "RFQ：Jarra de vidro 1,5 L". O sino mostra "询价：Jarra de vidro 1,5 L" (em pt, "Cotação pedida: …").
- O prazo (SLA) e as datas mudam com o dia da gravação: não os cite na narração.

### Pontos a confirmar

- ⚠ O aviso do sino "Nova solicitação nº N: {produto} · {qtd} un. Abra a RFQ para os fornecedores." (`requests.ts`) continua falando em "abrir a RFQ" com a RFQ em espera, e fica em "Precisa de você" mesmo depois de enviar ao fornecedor. A pendência (`tasks.ts`) já diz "Enviar ao fornecedor". Os dois textos estão fixos em pt, fora do dicionário.
- ⚠ O item de menu continua "RFQ (em espera)" mesmo com a RFQ ligada (`nav.rfq` é um texto fixo; o mesmo vale para "Sourcing (em espera)").
- ⚠ O texto do cartão "Como está funcionando agora" fala do Booking pela **ficha técnica** ("Cada produto do Booking é do fornecedor escolhido ao subir a ficha técnica…"), que não é mais o caminho principal (docs/BOOKING.md, seção 0). Não leia esse parágrafo na narração.
- ⚠ A coluna "Próximo passo" diz "Abrir a cotação com fornecedores" (`reqList.next.rfq`), texto da época da RFQ com vários fornecedores.
- ⚠ O briefing sai para a "Agência Criativa" com "Falta enviar: Faca (die-cut), Arte da embalagem"; o aviso "Embalagem sem medidas: {produto}" também pode chegar ao sino da Wellmix (a jarra do catálogo não tem medidas da caixa). Conferir o texto na gravação.

---

## WSO-02 · Comparar a cotação e fechar o preço ao cliente

> **Promessa:** ao final do vídeo você sabe ler a cotação do fornecedor, conferir a conta do custo, definir o preço ao cliente e o sinal, e enviar a escolha para aprovação.

| Ficha                 |                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, operador (e administrador na aprovação)                                                                                                                                                                                     |
| Quem faz              | **Comprador** (operador com a tela Solicitações): compara, define o valor e envia para aprovação. **Aprovam**: quem tem a função Planner (1º nível), Diretoria de compras (2º) e Diretoria executiva (3º, acima do limite), **menos quem enviou**; o administrador decide todos os níveis |
| Conta de gravação     | `operador@wellmix.com` (envia) e `admin@wellmix.com` (aprova), tela em pt                                                                                                                                                             |
| Duração-alvo          | 5:00                                                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 3 de 9: Cotação                                                                                                                                                                                                                |
| Telas e rotas         | `/app/notifications`, `/app/tasks`, `/app/requests`, `/app/requests/[id]` (Comparação de cotações e Aprovação do pré-custo), `/app/quotes/[id]` (a ficha da cotação)                                                                  |
| Dados antes de gravar | Ponto `antes-WSO-02`: a jarra enviada ao fornecedor A (WSO-01) e a cotação **respondida** (US$ 3,35, 35 dias, ficha completa). **Configure a margem em Configurações** antes (a base de demonstração vem com margem 0%, ver ⚠). "Exigir aprovação" ligado (padrão) |
| Depois deste vídeo    | A solicitação continua em "Cotações recebidas" até a aprovação. Quando o último nível aprova, ela passa a **Aguardando sinal**, a proposta vai ao cliente e o fornecedor escolhido é avisado ("Cotação escolhida")                      |
| Antes · Próximo       | WSO-01 · WSO-03                                                                                                                                                                                                                      |
| Idiomas               | pt (base)                                                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/requests/[id]`**

- 🎬 Imagem: o cartão "Comparação de cotações" com o valor "R$ 28.000,00" no campo "Valor ao cliente", o sinal "= R$ 8.400,00 de sinal (30% de R$ 28.000,00) · restante R$ 19.600,00" e o botão vermelho "Enviar para aprovação".
- 🎙 Narração: "A cotação chegou. Em poucos minutos o preço ao cliente está definido, e a escolha segue para aprovação."
- 🔤 Na tela: `[TÍTULO]` "WSO-02 · Comparar a cotação e fechar o preço ao cliente"; `[ZOOM 150 %]` no botão "Enviar para aprovação".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/requests/[id]`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Seguimos na etapa de cotação. O fornecedor já respondeu, e a Wellmix decide o preço de venda e quanto o cliente paga de sinal."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:55 · A cotação chegou e a ficha · `/app/notifications` → `/app/tasks` → `/app/requests`**

- 🎬 Imagem: o sino da Wellmix: "Cotação recebida: Jarra de vidro 1,5 L · US$ 3,35, prazo 35 dias." Em **Pendências**, a linha "Escolher fornecedor: Jarra de vidro 1,5 L", detalhe "Cotações recebidas". Em **Pedidos → Solicitações**, a situação "Cotações recebidas", o próximo passo "Escolher o fornecedor e o preço" e "1 de 1 responderam · produção 35 dia(s)". Abrir a solicitação. (Opcional, gravar à parte: a ficha da cotação em `/app/quotes/[id]`, "Ficha de compra da cotação", com os blocos Fornecedor, Produto, Caixa e embalagem, Preço e condições e Fotos, todos "Completo".)
- 🎙 Narração: "Quando o fornecedor responde, o sino avisa e a pendência vira Escolher fornecedor. A lista mostra o preço e o prazo de produção. A ficha de compra que ele preencheu, com caixa, pesos e fotos, alimenta a conta."
- 🔤 Na tela: `[PASSO 1/8] Abra a pendência Escolher fornecedor`; `[SETA]` "Cotações recebidas: a vez é da Wellmix"; `[QUEM VÊ]` "A cotação e a ficha são só da Wellmix. O cliente nunca vê"; `[ATENÇÃO]` "A ficha da cotação não tem atalho nesta tela (ver ⚠)".
- ✂️ Edição: `[CORTE]` entre as três telas; `[ZOOM 150 %]` na linha da pendência.

**Cena 4 · 0:55–1:25 · Comparação de cotações · `/app/requests/[id]`**

- 🎬 Imagem: rolar até o cartão "Comparação de cotações". À direita, a lista "Fornecedor" com "Shenzhen Supplier A · US$ 3,35"; o campo "Frete marítimo da companhia marítima (R$)" e o texto "Pedido de frete enviado: aguardando a companhia marítima informar; até lá vale o frete estimado (por CBM)." Passar pelo cartão "Classificação fiscal (NCM)" logo acima: "Sem NCM confirmado, II e IPI ficam em 0% no valor ao cliente."
- 🎙 Narração: "Em Comparação de cotações, escolha o fornecedor. O frete marítimo vem da companhia marítima e, até ela responder, vale o estimado. E confirme o NCM, o código fiscal do produto: sem ele, o imposto de importação e o IPI ficam em zero na conta."
- 🔤 Na tela: `[PASSO 2/8] Escolha o fornecedor`; `[SETA]` "Frete: a companhia marítima informa; sem resposta, vale o estimado"; `[ATENÇÃO]` "Sem NCM confirmado, II e IPI ficam em 0%"; `[DICA]` "Com duas ou mais cotações respondidas aparece a Disputa de fornecedores (WSO-04)".
- ✂️ Edição: `[ZOOM 150 %]` no aviso do NCM por 3 s.

**Cena 5 · 1:25–2:10 · O valor ao cliente calculado · `/app/requests/[id]`**

- 🎬 Imagem: o quadro "Valor ao cliente calculado", linha a linha: "Produto (FOB): 1.200 × USD 3.35", "Câmbio USD: R$ …", "Frete marítimo", "Carga" (por exemplo "6 m³ ≈ 0,1 × 40HC"), "Valor aduaneiro", "Imposto de importação (0%)", "IPI (0%)", "PIS-importação (2,1%)", "COFINS-importação (9,65%)", "Custo importado", "Margem {pct}% ({origem})" e "Valor ao cliente". Abaixo, os avisos em laranja (por exemplo "Sem frete marítimo: a companhia marítima ainda não informou e o frete por CBM não está configurado (Configurações).").
- 🎙 Narração: "Esta é a memória de cálculo: o preço do fornecedor no câmbio do dia, o frete, os impostos da importação e o custo importado. Em cima do custo entra a margem, que vem das configurações, e sai o valor ao cliente. Confira os avisos."
- 🔤 Na tela: `[PASSO 3/8] Confira a memória de cálculo`; `[SETA]` "Custo importado = compra + frete + impostos"; `[SETA]` "Margem: do cliente, da linha ou geral"; `[SETA]` "Os avisos dizem o que falta: NCM, frete, ICMS"; `[QUEM VÊ]` "Custo e margem são só da Wellmix. Cliente e fornecedor não veem".
- ✂️ Edição: `[ZOOM 150 %]` no quadro; manter 4 s na linha "Custo importado".

**Cena 6 · 2:10–2:40 · Valor, moeda e sinal · `/app/requests/[id]`**

- 🎬 Imagem: no campo "Valor ao cliente" digitar 28000 (a conta calculada deixa de atualizar e aparece o botão "Usar valor calculado (R$ …)"). Mostrar a lista "Moeda" (Real (BRL)) e o campo "Sinal (% do valor ao cliente)" já em "30 %". Embaixo do campo, "= R$ 8.400,00 de sinal (30% de R$ 28.000,00) · restante R$ 19.600,00". Digitar 150 no sinal: o campo volta a 100.
- 🎙 Narração: "Digite o valor ao cliente, ou use o calculado. O sinal é uma porcentagem desse valor, trinta por cento por padrão, e a tela já mostra o valor do sinal e o restante. Acima de cem por cento o campo corrige."
- 🔤 Na tela: `[PASSO 4/8] Defina o valor e o sinal`; `[BOTÃO] "Usar valor calculado"`; `[SETA]` "Sinal em % do valor ao cliente (0 a 100)"; `[ERRO COMUM]` "O sinal é uma porcentagem do valor ao cliente: informe de 0 a 100."
- ✂️ Edição: digitação em tempo real; `[ZOOM 150 %]` na linha do sinal.

**Cena 7 · 2:40–3:10 · Enviar para aprovação · `/app/requests/[id]`**

- 🎬 Imagem: clicar em **Enviar para aprovação**. A página recarrega no cartão "Aprovação do pré-custo": o texto "A escolha do fornecedor e o valor ao cliente só valem depois de aprovados, nível a nível. O cliente não vê esta etapa.", o aviso verde "Escolha enviada para aprovação. A proposta só vai ao cliente depois de aprovada." e a faixa amarela "Aguardando aprovação · Valor ao cliente: R$ 28.000,00 · Enviada por … em …" com os níveis Planner (Aguardando), Diretoria de compras (Aguardando) e Diretoria executiva ("Não precisa (abaixo do limite)"), "Aguardando: Planner." e o botão "Cancelar aprovação".
- 🎙 Narração: "Clique em Enviar para aprovação. Nada muda para o cliente ainda: a proposta só sai depois de aprovada. Os níveis são planner, diretoria de compras e, acima do limite, diretoria executiva."
- 🔤 Na tela: `[PASSO 5/8] Clique em Enviar para aprovação`; `[BOTÃO] "Enviar para aprovação"`; `[SETA]` "Diretoria executiva: só acima do limite (padrão R$ 100.000)"; `[QUEM VÊ]` "O cliente não vê a aprovação do pré-custo"; `[ATENÇÃO]` "Há uma escolha aguardando aprovação. Enviar outra substitui a atual."
- ✂️ Edição: `[CORTE]` na recarga; `[ZOOM 150 %]` na faixa amarela.

**Cena 8 · 3:10–3:55 · Quem aprova · `/app/tasks` → `/app/requests/[id]`**

- 🎬 Imagem: trocar para o administrador. Em **Pendências**, a linha "Aprovar pré-custo (planner): Jarra de vidro 1,5 L", detalhe "Valor ao cliente BRL 28.000,00", tipo "Aprovação do pré-custo". Abrir a solicitação: o cartão mostra "Sua aprovação é necessária neste nível.", o campo "Motivo (obrigatório para reprovar)" e os botões "Aprovar todos os níveis", "Aprovar" e "Reprovar". Clicar em **Aprovar** no primeiro nível ("Aprovado por … em …"), depois no segundo. O cartão vira "Aprovada" e o selo da solicitação muda para **Aguardando sinal**.
- 🎙 Narração: "Quem aprova é quem tem a função do nível: planner no primeiro, diretoria de compras no segundo e diretoria executiva, só acima do limite. Quem enviou a escolha não aprova a própria, e ninguém decide dois níveis. O administrador decide todos. A pendência chega ao aprovador com o valor ao cliente, e a aprovação sobe nível a nível."
- 🔤 Na tela: `[PASSO 6/8] Aprove cada nível`; `[BOTÃO] "Aprovar"`; `[BOTÃO] "Aprovar todos os níveis"`; `[QUEM VÊ]` "O operador que enviou não vê o botão de aprovar a própria escolha. O administrador vê todos os níveis"; `[ATENÇÃO]` "Valor igual ou acima do limite (R$ 100.000, em Configurações) inclui a diretoria executiva".
- ✂️ Edição: `[CORTE]` entre as contas; legenda curta com os três níveis.

**Cena 9 · 3:55–4:20 · Reprovar · `/app/requests/[id]`**

- 🎬 Imagem: numa outra aprovação (gravada à parte), o administrador clica em **Reprovar** sem motivo: aparece "Escreva o motivo para reprovar." Digita "Valor acima do que o cliente aceita: refaça com margem menor." e reprova. De volta ao operador, o sino mostra "Pré-custo reprovado: …" com "Motivo: …"; o cartão guarda a aprovação em "Aprovações anteriores", e a pendência "Escolher fornecedor" volta.
- 🎙 Narração: "Reprovar exige um motivo. O comprador recebe o aviso com o motivo, e a pendência Escolher fornecedor volta para ele. É só ajustar o valor e enviar outra escolha: a nova substitui a anterior."
- 🔤 Na tela: `[PASSO 7/8] Reprove com motivo`; `[BOTÃO] "Reprovar"`; `[ERRO COMUM]` "Escreva o motivo para reprovar."; `[SETA]` "Aprovações anteriores: o histórico fica".
- ✂️ Edição: `[ZOOM 150 %]` no campo do motivo.

**Cena 10 · 4:20–4:45 · E agora? · `/app/requests/[id]`**

- 🎬 Imagem: de volta à solicitação aprovada: selo **Aguardando sinal** e o cartão "Aprovação do pré-custo" com "Aprovada". Em seguida, o sino do cliente com "Proposta pronta: Jarra de vidro 1,5 L" e o sino do fornecedor A com "Cotação escolhida".
- 🎙 Narração: "Aprovada no último nível, a escolha é gravada e a proposta segue para o cliente. O fornecedor escolhido recebe o aviso e passa a preparar a faca da caixa. A solicitação fica em Aguardando sinal."
- 🔤 Na tela: `[DEPOIS]` "A proposta foi ao cliente (sino e Pendências dele). O fornecedor foi avisado e envia a faca. A solicitação está em Aguardando sinal (WSO-03)"; `[SETA]` "Aguardando sinal".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 11 · 4:45–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do WSO-03.
- 🎙 Narração: "Resumindo: confira a conta, defina valor e sinal, envie para aprovação e acompanhe os níveis. No próximo vídeo, o cliente aprova a proposta e o pedido nasce."
- 🔤 Na tela: `[RESUMO]` "1 Pendência: Escolher fornecedor · 2 Confira a memória de cálculo · 3 Valor ao cliente e sinal · 4 Enviar para aprovação"; chamada "Próximo: WSO-03 · Proposta, sinal e nascimento do pedido".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "O sinal é uma porcentagem do valor ao cliente: informe de 0 a 100." → **Correção:** digite o sinal entre 0 e 100 (a tela já corrige acima de 100).
- **Erro:** "A ficha da cotação mudou depois da conta (outra quantidade de caixas). Confira o valor ao cliente na tela atualizada e selecione de novo." → **Correção:** a ficha mudou depois que você abriu a tela; confira o novo valor e envie de novo.
- **Erro:** "Essa cotação não está mais disponível." → **Correção:** o fornecedor mudou ou a cotação foi encerrada; recarregue e escolha de novo.
- **Erro:** "A solicitação não está mais na fase de escolha do fornecedor." → **Correção:** a escolha já foi aprovada ou a solicitação mudou; confira a situação.
- **Erro:** "Escreva o motivo para reprovar." → **Correção:** preencha "Motivo (obrigatório para reprovar)".
- **Aviso:** "Há uma escolha aguardando aprovação. Enviar outra substitui a atual." → **Correção:** é só um aviso; a nova escolha substitui a anterior (a anterior é cancelada com o motivo).
- **Aviso na conta:** "Margem 0%: o valor sai igual ao custo. Configure a margem em Configurações." e "NCM não confirmado: II e IPI em 0%. Confirme o NCM no quadro de classificação fiscal." → **Correção:** peça ao administrador para configurar a margem; confirme o NCM no cartão "Classificação fiscal (NCM)" (ou espere o despachante).
- **Erro:** "Aprovada, mas não gravada" (selo da aprovação) → **Correção:** a cotação ou a ficha mudou depois da aprovação; o comprador é avisado para refazer a escolha, ou use "Tentar concluir de novo" (administrador).

### Passo a passo em texto

1. No sino (**Notificações**) ou em **Início → Pendências**, abra "Escolher fornecedor: {produto}". A solicitação está em **Cotações recebidas**.
2. Em **Comparação de cotações**, escolha o **Fornecedor** (com duas ou mais cotações respondidas, a **Disputa de fornecedores** aparece acima, WSO-04).
3. Confira o quadro **Valor ao cliente calculado**: compra, frete, impostos da importação, **Custo importado**, **Margem** e **Valor ao cliente**, e os avisos em laranja (NCM, frete e ICMS).
4. Digite o **Valor ao cliente** (ou deixe o calculado; **Usar valor calculado** volta ao cálculo), confira a **Moeda** e o **Sinal (% do valor ao cliente)**.
5. Clique em **Enviar para aprovação**. O cartão **Aprovação do pré-custo** mostra os níveis: **Planner**, **Diretoria de compras** e, só do limite para cima (padrão R$ 100.000), **Diretoria executiva**.
6. Quem tem a função do nível (ou o administrador) abre a pendência "Aprovar pré-custo (nível): {produto}" e clica em **Aprovar** (ou **Aprovar todos os níveis**, no caso do administrador). Quem enviou não aprova a própria escolha.
7. Para recusar, escreva o **Motivo (obrigatório para reprovar)** e clique em **Reprovar**. O comprador recebe o aviso com o motivo e envia outra escolha.
8. Aprovada no último nível, a solicitação passa a **Aguardando sinal** e a proposta vai ao cliente.

### Notas de gravação

- **Margem:** a base de demonstração tem margem 0% e tabela fiscal vazia. Para o valor calculado sair realista, configure a margem em Configurações (administrador) antes de gravar, e carregue a TEC e a TIPI se quiser que II e IPI entrem sozinhos. Sem isso, o roteiro funciona porque o comprador digita o "Valor ao cliente" (28000) e a tela mostra o botão "Usar valor calculado".
- A ficha da cotação (cena 3) abre pela lista **Cotações** (`/app/quotes`, que não está no menu da Wellmix: digite o endereço) e o link **Abrir** da linha. Grave à parte e encaixe, ou pule a abertura e fale só do que a conta usa (ver ⚠).
- Quem aprova: o operador `operador@wellmix.com` tem as funções comprador e planner, mas **enviou a escolha**; por isso quem aprova é o administrador (que decide os dois níveis, como no teste de ponta a ponta). Para mostrar o planner aprovando, use um segundo login com a função Planner (Gestão → Equipe e divisões).
- Cena 9: grave a reprovação numa solicitação de ensaio (envie outra escolha e reprove) e restaure o ponto de salvamento antes da cena 8. A reprovação não bloqueia o comprador: ele envia outra escolha.
- Aprovar o último nível responde na hora; a gravação da escolha termina em segundos, e a tela se atualiza sozinha ("Aprovada · gravando a escolha"). Espere o selo virar "Aguardando sinal".
- O valor do exemplo (R$ 28.000,00) vem do teste de ponta a ponta. Acima de R$ 100.000 aparece "Diretoria executiva · Aguardando" no lugar de "Não precisa (abaixo do limite)".

### Pontos a confirmar

- ⚠ **Margem 0% na base de demonstração**: o "Valor ao cliente" calculado sai igual ao custo ("Margem 0%: o valor sai igual ao custo."). Configure a margem antes de gravar.
- ⚠ **Sem atalho para a ficha da cotação.** A tela da solicitação não tem link para `/app/quotes/[id]` (o link "Abrir a ficha da cotação" só aparece no aviso de volume da caixa que falta, e a lista de cotações não está no menu da Wellmix). A Wellmix chega à ficha digitando `/app/quotes` (lista Cotações, com a tela Cotações liberada, mas sem item no menu). Confirmar se é intencional.
- ⚠ O aviso "Aprovação do pré-custo: {produto} · Aguardando sua decisão (Planner)." chega também ao operador que **enviou** a escolha (ele tem a função Planner e não pode aprovar a própria escolha). Confirmar se o aviso deve pular quem enviou.
- ⚠ Os avisos "Cotação recebida: …" e "Nova solicitação nº …" ficam em "Precisa de você" depois da ação (o sino só limpa ao resolver). Os textos "Escolher fornecedor: {produto}", "Cotações recebidas" e "Cotação recebida: …" estão fixos em pt, fora do dicionário.
- ⚠ A conta usa a **caixa da ficha da cotação** e o produto do cadastro. Num produto criado pelo Booking (WBK-04), o CBM e as medidas da caixa saem trocados (⚠ 1 do WBK-04) e a ficha da cotação já vem com o CBM travado em 0,0035 m³: o fornecedor precisa trocar as medidas da caixa para o CBM sair certo.
- ⚠ "Exigir aprovação" desligado (Configurações): o botão passa a se chamar "Selecionar" e a proposta sai na hora. O roteiro mostra o caminho com a aprovação ligada (padrão).
- ⚠ Não gravei o caso "Aprovada, mas não gravada" nem "Tentar concluir de novo" (precisa de falha); as mensagens vêm do dicionário e de `docs/APPROVALS.md`.

---

## WSO-03 · Proposta, sinal e nascimento do pedido

> **Promessa:** ao final do vídeo você sabe acompanhar a proposta até o cliente aprovar e pagar o sinal, confirmar o recebimento e ver o pedido nascer com as etapas.

| Ficha                 |                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, operador e administrador (com o cliente e o fornecedor aparecendo por poucos segundos)                                                                                                                      |
| Quem faz              | **Operador:** acompanha a proposta e, se o cliente aprovou por fora, registra a aprovação. **Só o administrador:** "Confirmar sinal recebido" (o financeiro é só dele). O operador vê o pedido, mas não os cartões financeiros |
| Conta de gravação     | `operador@wellmix.com`, `admin@wellmix.com` (confirma o sinal), `joao@lojista.com` (aprova e paga), tela em pt                                                                                                        |
| Duração-alvo          | 4:30                                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 4 de 9: Sinal e pedido                                                                                                                                                                                         |
| Telas e rotas         | `/app/requests/[id]` (cartão Proposta), `/app/orders/[id]`, `/app/tasks`, `/app/notifications`                                                                                                                       |
| Dados antes de gravar | Ponto `antes-WSO-03`: escolha do fornecedor **aprovada nos dois níveis** (fim do WSO-02), solicitação em **Aguardando sinal**, valor R$ 28.000,00 e sinal de 30 % (R$ 8.400,00). Chave Pix **não** configurada (padrão)   |
| Depois deste vídeo    | O cliente aprovou e pagou; a Wellmix confirmou o sinal. **Nasce o Pedido #1** com as etapas. O cliente é avisado ("Pedido #1 criado"); o fornecedor recebe a pendência da ficha de compra; a Wellmix tem a pendência do pedido |
| Antes · Próximo       | WSO-02 · (série de preparação do pedido)                                                                                                                                                                             |
| Idiomas               | pt (base)                                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/orders/[id]`**

- 🎬 Imagem: a página do pedido recém-criado: título "Pedido #1", "Jarra de vidro 1,5 L · 1200 un", o selo "Pedido pré-aprovado" e a tabela "Etapas do pedido" com as nove etapas.
- 🎙 Narração: "O cliente aprovou, pagou o sinal, e a Wellmix confirmou. Neste instante nasce o pedido, com todas as etapas até a entrega."
- 🔤 Na tela: `[TÍTULO]` "WSO-03 · Proposta, sinal e nascimento do pedido"; `[ZOOM 150 %]` em "Etapas do pedido".
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/requests/[id]`**

- 🎬 Imagem: a solicitação em "Aguardando sinal". O mapa da jornada aparece sobre a tela.
- 🎙 Narração: "Entramos na quarta etapa: sinal e pedido. Aqui a proposta vira dinheiro na conta, e a solicitação vira pedido."
- 🔤 Na tela: `[MAPA etapa 4]` com "Sinal e pedido" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:55 · A proposta chega ao cliente · `/app/requests/[id]`**

- 🎬 Imagem: a solicitação da jarra com o selo **Aguardando sinal**. O cartão "Proposta" (com contorno vermelho) mostra "Valor ao cliente" (R$ 28.000,00), "Sinal" (R$ 8.400,00), "Situação" ("Pendente") e "Fornecedor" (Shenzhen Supplier A). Abaixo, a caixa "Aguardando o cliente aprovar a proposta." Em outra janela, o cliente vê o sino com "Proposta pronta: Jarra de vidro 1,5 L · 1.200 un por R$ 28.000,00. Aprove a proposta no portal; depois, o sinal de R$ 8.400,00 inicia o pedido." e o cartão "Proposta" sem a linha do fornecedor.
- 🎙 Narração: "Aprovado o pré-custo, a proposta vai ao cliente: valor, sinal e a situação pendente. Só a Wellmix vê o fornecedor nessa tela. O cliente recebe o aviso no sino e aprova a proposta antes de pagar."
- 🔤 Na tela: `[PASSO 1/6] Acompanhe a proposta`; `[SETA]` "Aguardando sinal"; `[QUEM VÊ]` "O cliente vê valor e sinal. Fornecedor, custo e margem são só da Wellmix"; `[SETA]` "Aguardando o cliente aprovar a proposta."
- ✂️ Edição: `[CORTE]` seco para a janela do cliente por 4 s e de volta; `[ZOOM 150 %]` no cartão.

**Cena 4 · 0:55–1:25 · A aprovação do cliente · `/app/requests/[id]`**

- 🎬 Imagem: na conta do cliente, o cartão "Proposta" com "Confira quantidade, valor e prazo. Ao aprovar, aparecem os dados para pagar o sinal." e o botão **Aprovar proposta**. Clicar: "Proposta aprovada. Agora é só pagar o sinal." e "Proposta aprovada em {data} por João Cliente." Voltar à Wellmix: se o cliente aprovou por telefone ou WhatsApp, o botão "Registrar aprovação do cliente" (com "Use quando o cliente aprovou por telefone, e-mail ou WhatsApp.") grava a aprovação e mostra "Aprovação do cliente registrada."
- 🎙 Narração: "O cliente confere e clica em Aprovar proposta. Se ele aprovou por telefone, e-mail ou WhatsApp, a Wellmix registra a aprovação por ele, com o botão Registrar aprovação do cliente."
- 🔤 Na tela: `[PASSO 2/6] O cliente aprova a proposta`; `[BOTÃO] "Aprovar proposta"`; `[BOTÃO] "Registrar aprovação do cliente"`; `[QUEM VÊ]` "Só o cliente da solicitação aprova. A Wellmix registra a aprovação dada por fora".
- ✂️ Edição: `[CORTE]` entre as duas contas.

**Cena 5 · 1:25–2:00 · O sinal · `/app/requests/[id]`**

- 🎬 Imagem: ainda no cliente, depois de aprovar: "Pague o sinal de R$ 8.400,00 para iniciar o pedido. A Wellmix confirma o recebimento." e "A Wellmix vai informar os dados para pagamento. Depois de pagar, anexe o comprovante aqui." O cliente escolhe uma foto em "Comprovante do pagamento" ("Foto ou PDF do comprovante do banco.") e clica em **Enviar comprovante**: "Comprovante enviado. A Wellmix confere o recebimento e confirma o sinal; você recebe um aviso quando o pedido for criado." Na Wellmix, o mesmo cartão: "O cliente enviou o comprovante. Confira o recebimento na conta e confirme o sinal." e "Ver comprovante".
- 🎙 Narração: "Depois de aprovar, o cliente vê o valor do sinal, paga e anexa o comprovante. Hoje o pagamento é manual: não há gateway. A Wellmix confere na conta e confirma que recebeu."
- 🔤 Na tela: `[PASSO 3/6] O cliente paga e envia o comprovante`; `[BOTÃO] "Enviar comprovante"`; `[ATENÇÃO]` "Pagamento do sinal é manual: a Wellmix confirma o recebimento"; `[SETA]` "Ver comprovante".
- ✂️ Edição: `[ZOOM 150 %]` em "Pague o sinal de R$ 8.400,00…".

**Cena 6 · 2:00–2:40 · Confirmar o sinal · `/app/requests/[id]`**

- 🎬 Imagem: primeiro na conta do operador: o mesmo cartão "Proposta", **sem** o botão de confirmar (só o texto sobre o comprovante). Trocar para o administrador: ao lado do campo "Comprovante (opcional)" aparece o botão **Confirmar sinal recebido**. Clicar.
- 🎙 Narração: "Confirmar o sinal é do administrador, porque o financeiro é só dele: o operador não vê esse botão. O administrador confere o recebimento na conta, anexa o comprovante se quiser e clica em Confirmar sinal recebido. Na hora, a tela abre o pedido que acabou de nascer."
- 🔤 Na tela: `[PASSO 4/6] Confirme o recebimento`; `[BOTÃO] "Confirmar sinal recebido"`; `[QUEM VÊ]` "Só o administrador (ou quem ele liberar) vê o botão. O operador não vê"; `[ATENÇÃO]` "Confirmado, o pedido nasce na hora".
- ✂️ Edição: `[CORTE]` entre as contas; manter o clique com onda.

**Cena 7 · 2:40–3:35 · O pedido nasce · `/app/orders/[id]`**

- 🎬 Imagem: a página abre no pedido: "Pedido #1", "Jarra de vidro 1,5 L · 1200 un", selo "Pedido pré-aprovado" e "Solicitação nº 1". Para o administrador: os cartões "Valor de venda" (R$ 28.000,00), "Recebido do cliente" (R$ 8.400,00), "A receber do cliente", "Valor de compra (FOB)" e "Margem". "Resumo do pedido" (cliente, fornecedor, FOB, valor de venda, Sankhya "ERP pendente", faturamento), "Itens do pedido" e "Etapas do pedido": 1 Pedido pré-aprovado, 2 Preparação, 3 Arte e embalagem, 4 Inspeção, 5 Embarque, 6 Desembaraço, 7 Transporte, 8 Entrega, 9 Encerramento, com responsável, prazo e "ITENS DA ETAPA" (por exemplo "0 de 2"). Rolar até a etapa aberta: "Pedido conferido e liberado ao fornecedor" (botão "Confirmar") e "Número no Sankhya" (opcional, botão "Enviar"). Trocar para o operador: a mesma página sem os cartões financeiros.
- 🎙 Narração: "Nasceu o pedido número um, pré-aprovado, com nove etapas, cada uma com responsável e prazo. O administrador vê também o valor de venda, o recebido do cliente, o valor da compra e a margem. O operador vê o pedido e o resumo, mas não os cartões financeiros. Na primeira etapa, a Wellmix confere e libera ao fornecedor; o número do Sankhya é opcional."
- 🔤 Na tela: `[PASSO 5/6] Confira o pedido e as etapas`; `[PASSO 6/6] Confirme o pedido na primeira etapa`; `[SETA]` "As nove etapas do pedido"; `[SETA]` "Pedido conferido e liberado ao fornecedor"; `[QUEM VÊ]` "Cartões de valor, recebido, a receber e margem: só o administrador. O operador não vê"; `[BOTÃO] "Confirmar"`.
- ✂️ Edição: `[ZOOM 150 %]` na tabela de etapas por 4 s; legenda "Pagamento ao fornecedor corre fora do fluxo do pedido" no selo "ao mesmo tempo".

**Cena 8 · 3:35–4:15 · E agora? · `/app/tasks` e `/app/notifications`**

- 🎬 Imagem: o cliente: sino com "Pedido #1 criado · Agora é com o fornecedor: ele prepara a ficha de compra. Acompanhe a linha do tempo.", e na solicitação o botão "Ver pedido". O fornecedor A (em chinês): "订单 #1：请填写采购单" no sino (em pt, "Pedido #1: preencha a ficha de compra"). O operador: em Pendências, "Pedido #1: Pedido pré-aprovado · Pedido conferido e liberado ao fornecedor, Número no Sankhya".
- 🎙 Narração: "Todos são avisados. O cliente vê o pedido criado e a linha do tempo. O fornecedor recebe a pendência da ficha de compra. E para a Wellmix aparece, em Pendências, a conferência do pedido: o próximo passo é só seu."
- 🔤 Na tela: `[DEPOIS]` "O cliente foi avisado no sino. O fornecedor recebeu a pendência da ficha de compra. A Wellmix tem a pendência do pedido. O pagamento ao fornecedor corre fora do fluxo do pedido"; `[SETA]` "Pedido #1: Pedido pré-aprovado" na pendência.
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 9 · 4:15–4:30 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, o mapa da jornada com a etapa 5 acesa.
- 🎙 Narração: "Resumindo: a proposta vai ao cliente, ele aprova e paga, o administrador confirma, e o pedido nasce. Daqui, o pedido segue pelas etapas de preparação."
- 🔤 Na tela: `[RESUMO]` "1 Proposta ao cliente · 2 Cliente aprova e paga · 3 Administrador: Confirmar sinal recebido · 4 Nasce o pedido com as etapas"; chamada "Próximo: preparação do pedido (série de pedidos)".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "Esta solicitação não está mais aguardando o sinal." → **Correção:** o sinal já foi confirmado ou a solicitação mudou; abra o pedido pelo botão "Ver pedido".
- **Erro:** "Escolha o arquivo do comprovante." (o cliente clicou em Enviar comprovante sem arquivo) → **Correção:** escolha uma foto ou um PDF.
- **Erro:** "Formato não aceito. Envie uma foto ou um PDF." e "Arquivo grande demais (máximo 30 MB)." → **Correção:** envie foto ou PDF de até 30 MB.
- **Erro:** "Só o cliente da solicitação envia o comprovante." → **Correção:** o comprovante é do cliente (o administrador anexa o dele no campo "Comprovante (opcional)").
- **Aviso (câmbio):** "O câmbio mudou {pct}% desde a proposta ({currency} R$ {from} → R$ {to}). Revise o valor antes de confirmar o sinal." com o botão "Atualizar proposta com o câmbio de hoje" → **Correção:** só vale para propostas em Real e antes de o cliente enviar o comprovante; o cliente é avisado da proposta atualizada ("Proposta atualizada com o câmbio de hoje. O cliente foi avisado.").
- **Erro:** "O cliente já enviou o comprovante do sinal: a proposta não pode mudar." → **Correção:** depois do comprovante, o valor não muda; confirme o sinal ou fale com o cliente.
- **Aviso (Pix):** "Pix desligado: cadastre chave, recebedor e cidade em Configurações para o cliente ver o Pix copia e cola e o QR Code." (só a Wellmix vê) → **Correção:** o administrador cadastra a chave em Configurações; sem ela, o cliente vê "A Wellmix vai informar os dados para pagamento. Depois de pagar, anexe o comprovante aqui."

### Passo a passo em texto

1. Com a escolha aprovada, a solicitação fica em **Aguardando sinal**. Abra-a em **Pedidos → Solicitações** e confira o cartão **Proposta**: **Valor ao cliente**, **Sinal**, **Situação** ("Pendente") e **Fornecedor** (só a Wellmix vê).
2. O cliente recebe o aviso "Proposta pronta" e clica em **Aprovar proposta**. Se ele aprovou por telefone, e-mail ou WhatsApp, clique em **Registrar aprovação do cliente**.
3. Depois da aprovação, o cliente vê o valor do sinal, paga e envia o **Comprovante do pagamento** em **Enviar comprovante**.
4. O administrador confere o recebimento e clica em **Confirmar sinal recebido** (o campo **Comprovante (opcional)** aceita o comprovante). O operador não vê esse botão.
5. O sistema cria o **Pedido #N** e abre a página do pedido, com o selo **Pedido pré-aprovado** e as nove **Etapas do pedido**.
6. Na primeira etapa, a Wellmix confere o pedido: clique em **Confirmar** em "Pedido conferido e liberado ao fornecedor" e, se quiser, informe o **Número no Sankhya** (opcional).
7. O cliente é avisado ("Pedido #N criado") e o fornecedor recebe a pendência de preencher a ficha de compra.

### Notas de gravação

- O Pix fica desligado na base de demonstração: o cliente vê "A Wellmix vai informar os dados para pagamento…". Para mostrar o QR Code, cadastre chave, recebedor e cidade em Configurações antes (GUIA, seção 7.5: não mostre gateway; o Pix é só um jeito de o cliente pagar, a confirmação continua manual).
- O comprovante de teste pode ser qualquer imagem pequena. Evite dados reais de banco na imagem.
- Na cena 6, o operador vê o texto "O cliente enviou o comprovante. Confira o recebimento na conta e confirme o sinal." mas não o botão; o administrador vê o botão. Se o administrador quiser mostrar a conta no Financeiro, isso é outro vídeo (a tela é só dele).
- O número do pedido ("Pedido #1") e as datas mudam com o dia da gravação. O valor do pedido "Valor de compra (FOB)" no exemplo é US$ 4.020,00 (1.200 × US$ 3,35).
- A cena 7 mostra o pedido para o operador e para o administrador. Se preferir, grave só com o administrador e cite em um selo que o operador não vê os cartões financeiros.
- Na cena 8, a conta do fornecedor A (em chinês) mostra o aviso e a pendência "请填写采购单"; o operador vê a pendência do pedido em pt. O pedido tem ainda a certificação em paralelo (OCP) e o documento do pedido com as duas assinaturas: outros vídeos.

### Pontos a confirmar

- ⚠ **O cartão financeiro do pedido** (valor de venda, recebido, a receber, margem) é visto só pelo administrador, mas o **Resumo do pedido** mostra "FOB" e "Valor de venda" também ao operador (colunas da tabela). Conferir se isso está de acordo com `docs/ACCESS.md` (que reserva ao administrador o cartão financeiro, e deixa preço de compra e preço ao cliente com quem abre Solicitações).
- ⚠ **"Câmbio mudou" e "Atualizar proposta com o câmbio de hoje"** não foram gravados (precisa mudar o câmbio do dia entre a proposta e o sinal). Os textos vêm do dicionário; confirme na tela.
- ⚠ Não exercitei o Pix com a chave configurada (QR Code e "Pix copia e cola"): o roteiro mostra o caminho sem a chave.
- ⚠ O texto do aviso ao cliente ("Proposta pronta: …") e o da pendência do pedido ("Pedido #N: Pedido pré-aprovado") são frases fixas em pt no código das notificações e das pendências; não vi a versão em en e zh.

---

## WSO-04 · RFQ em espera: o interruptor

> **Promessa:** ao final do vídeo você sabe o que muda quando a RFQ está em espera ou ativa, quem liga e desliga, e onde a disputa entre vários fornecedores aparece.

| Ficha                 |                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Wellmix, administrador (e operador, para mostrar o que ele vê)                                                                                                                                                                        |
| Quem faz              | **Só o administrador** liga e coloca em espera a RFQ e o Sourcing (`settings.rfqEnabled` e `settings.sourcingEnabled`). O operador com a tela RFQ vê a situação, sem o botão                                                              |
| Conta de gravação     | `admin@wellmix.com` (liga e desliga) e `operador@wellmix.com` (vê a diferença), tela em pt                                                                                                                                            |
| Duração-alvo          | 3:30                                                                                                                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação (vale para todas as solicitações)                                                                                                                                                                               |
| Telas e rotas         | `/app/rfq`, `/app/sourcing`, `/app/requests/[id]`, `/app/tasks`, `/app/audit`                                                                                                                                                         |
| Dados antes de gravar | Ponto `antes-WSO-04`: RFQ **em espera**; uma solicitação ainda em **Solicitado** e outra com **duas cotações respondidas** (A e B), preparada antes com a RFQ ligada (e desligada de novo). Sourcing em espera (padrão)               |
| Depois deste vídeo    | O interruptor fica como o administrador deixar. O que está em andamento continua valendo. A mudança fica na **auditoria**; ninguém recebe aviso                                                                                        |
| Antes · Próximo       | WSO-01 · WSO-05                                                                                                                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/rfq`**

- 🎬 Imagem: a tela **RFQ** com o selo verde "Ativa" e o aviso "RFQ ativada.", depois o mesmo selo trocando para "Em espera" e o aviso "RFQ em espera.".
- 🎙 Narração: "Um interruptor muda o caminho de todos os produtos: cotar com um fornecedor só ou colocar vários para disputar. Só o administrador mexe nele."
- 🔤 Na tela: `[TÍTULO]` "WSO-04 · RFQ em espera: o interruptor"; `[ZOOM 150 %]` no selo.
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:20 · Onde estou na jornada · `/app/rfq`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Isso acontece na etapa de cotação, e vale para todas as solicitações de uma vez."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:20–0:45 · O que o operador vê · `/app/rfq`**

- 🎬 Imagem: na conta do operador, **Pedidos** → **RFQ (em espera)**. O título "RFQ", o selo "Em espera", o cartão "Como está funcionando agora" e, em "Ligar ou deixar em espera", o texto "Só o administrador liga ou coloca a RFQ em espera." sem nenhum botão.
- 🎙 Narração: "O operador abre a tela RFQ e vê a situação: em espera. Mas, em Ligar ou deixar em espera, só aparece o aviso de que o interruptor é do administrador."
- 🔤 Na tela: `[PASSO 1/7] Abra Pedidos → RFQ`; `[QUEM VÊ]` "O operador vê a situação. O botão é só do administrador"; `[SETA]` "Sem botão para o operador".
- ✂️ Edição: `[ZOOM 150 %]` no cartão "Ligar ou deixar em espera".

**Cena 4 · 0:45–1:10 · O administrador liga · `/app/rfq`**

- 🎬 Imagem: na conta do administrador, o mesmo cartão agora com o botão **Ativar a RFQ**. Clicar: aparece "RFQ ativada.", o selo muda para "Ativa" e o cartão "Como está funcionando agora" diz "A RFQ está ativa. Na solicitação você escolhe vários fornecedores, compara as cotações e decide pela disputa. O produto do Booking não vai sozinho para o fornecedor: a RFQ é aberta na solicitação."
- 🎙 Narração: "O administrador clica em Ativar a RFQ. A situação vira Ativa, e a tela explica: agora a solicitação oferece vários fornecedores, e o Booking deixa de mandar o produto sozinho."
- 🔤 Na tela: `[PASSO 2/7] Clique em Ativar a RFQ`; `[BOTÃO] "Ativar a RFQ"`; `[SETA]` "Ativa: vários fornecedores e disputa"; `[ATENÇÃO]` "Vale para todas as solicitações novas".
- ✂️ Edição: `[ZOOM 150 %]` no aviso "RFQ ativada." por 2 s.

**Cena 5 · 1:10–1:50 · O que muda com a RFQ ativa · `/app/requests/[id]` e `/app/tasks`**

- 🎬 Imagem: o operador abre a solicitação ainda em "Solicitado". Agora há o cartão **Abrir RFQ**: "Selecione os fornecedores para cotar", a dica "Os fornecedores deste produto aparecem primeiro.", as caixas de seleção dos fornecedores (com o selo "já fornece" nos que já vendem o produto), a caixa "Abrir o briefing de embalagem junto com a RFQ" (marcada), a lista "Embalagem (faca e arte) com", o campo "Instruções para a agência (opcional)" e o botão **Abrir RFQ**. Marcar dois fornecedores. Em Pendências, a linha mudou para "Abrir RFQ: Jarra de vidro 1,5 L", detalhe "Selecione fornecedores".
- 🎙 Narração: "Com a RFQ ativa, a solicitação ganha o cartão Abrir RFQ: você marca vários fornecedores, e quem já vende o produto aparece primeiro. A pendência passa a se chamar Abrir RFQ. Depois de aberta, dá para convidar mais."
- 🔤 Na tela: `[PASSO 3/7] Marque os fornecedores e clique em Abrir RFQ`; `[BOTÃO] "Abrir RFQ"`; `[SETA]` "já fornece"; `[SETA]` "Pendência: Abrir RFQ"; `[ATENÇÃO]` "O menu continua dizendo RFQ (em espera) com a RFQ ativa (ver ⚠)".
- ✂️ Edição: `[ZOOM 150 %]` no cartão "Abrir RFQ" por 4 s.

**Cena 6 · 1:50–2:25 · A disputa entre fornecedores · `/app/requests/[id]`**

- 🎬 Imagem: a solicitação com duas cotações respondidas (A e B), aberta antes com a RFQ ativa. No cartão "Comparação de cotações", o quadro "Disputa de fornecedores": "Vencedor: Shenzhen Supplier A, com 100 pontos.", "Ganhou por: menor preço (US$ 3,35 por peça).", "Empate em: entrega, produção, MOQ." e a tabela com preço (peso 50), entrega (peso 20), produção (peso 15) e MOQ (peso 5), a nota e o botão "Escolhido ✓" ou "Escolher".
- 🎙 Narração: "Com duas ou mais cotações respondidas, aparece a Disputa de fornecedores: cada cotação ganha nota por preço, entrega, produção e pedido mínimo. O vencedor vem marcado, e você pode escolher outro."
- 🔤 Na tela: `[PASSO 4/7] Veja a disputa`; `[SETA]` "Vencedor, com o motivo"; `[SETA]` "Pesos dos critérios (os das Configurações)"; `[DICA]` "Só existe com duas ou mais cotações respondidas"; `[QUEM VÊ]` "A disputa é só da Wellmix. Um fornecedor nunca vê o outro".
- ✂️ Edição: `[ZOOM 150 %]` na tabela por 4 s.

**Cena 7 · 2:25–2:50 · Voltar para a espera · `/app/rfq`**

- 🎬 Imagem: o administrador volta a **RFQ** e clica em **Colocar a RFQ em espera**: "RFQ em espera." e o selo "Em espera". O cartão explica "Ao colocar em espera, cada produto volta a ir para um fornecedor só. As RFQs já abertas continuam valendo até serem concluídas." Abrir de novo a solicitação com a disputa: o quadro continua lá, e a solicitação nova em "Solicitado" volta sem o cartão "Abrir RFQ".
- 🎙 Narração: "Para voltar, clique em Colocar a RFQ em espera. Cada produto volta a ir a um fornecedor só. As RFQs que já estavam abertas continuam valendo, com a disputa e tudo."
- 🔤 Na tela: `[PASSO 5/7] Clique em Colocar a RFQ em espera`; `[BOTÃO] "Colocar a RFQ em espera"`; `[ATENÇÃO]` "As RFQs já abertas continuam valendo até serem concluídas"; `[SETA]` "O cartão Abrir RFQ some das solicitações novas".
- ✂️ Edição: `[CORTE]` entre a tela RFQ e as duas solicitações.

**Cena 8 · 2:50–3:15 · O mesmo para o Sourcing · `/app/sourcing`**

- 🎬 Imagem: em **Pedidos**, abrir **Sourcing (em espera)**. O título "Sourcing", o selo "Em espera", o cartão "Como está funcionando agora" e o botão **Ativar o Sourcing**. Clicar: "Sourcing ativado.", selo "Ativo" e o botão vira **Colocar o Sourcing em espera**. Clicar de novo: "Sourcing em espera."
- 🎙 Narração: "O Sourcing, a busca de produtos na China, funciona do mesmo jeito. Em espera, o pedido de produto fora do catálogo vira só uma solicitação. Ativo, ele abre um item de Sourcing e uma pendência para a equipe."
- 🔤 Na tela: `[PASSO 6/7] Ative ou coloque o Sourcing em espera`; `[BOTÃO] "Ativar o Sourcing"`; `[BOTÃO] "Colocar o Sourcing em espera"`; `[QUEM VÊ]` "Só o administrador liga. Visitas e itens já cadastrados ficam guardados".
- ✂️ Edição: `[ZOOM 150 %]` no selo do Sourcing.

**Cena 9 · 3:15–3:30 · E agora? e resumo**

- 🎬 Imagem: no administrador, **Gestão → Auditoria** com o módulo "Configurações": as linhas "RFQ ativada" e "RFQ colocada em espera". Depois, fundo vermelho com a lista; no fim, a miniatura do WSO-05.
- 🎙 Narração: "Cada mudança fica na auditoria, com o antes e o depois, e ninguém é avisado. Resumindo: a RFQ em espera manda um fornecedor só; ativa, abre a disputa. Próximo: o Superplan."
- 🔤 Na tela: `[DEPOIS]` "A mudança fica na Auditoria (Configurações). Nenhum aviso é enviado. O que está em andamento continua valendo"; `[RESUMO]` "1 Em espera: um fornecedor por produto · 2 Ativa: vários e disputa · 3 Só o administrador liga · 4 Sourcing funciona igual"; chamada "Próximo: WSO-05 · Superplan: a viabilidade do produto".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Erro:** "A RFQ para vários fornecedores está em espera: escolha um fornecedor só." → **Correção:** com a RFQ em espera, envie a um fornecedor só (WSO-01), ou peça ao administrador para ativar a RFQ.
- **Erro:** "Este produto já foi enviado a outro fornecedor. A RFQ para vários fornecedores está em espera." → **Correção:** com a RFQ em espera, um produto não ganha um segundo fornecedor; peça ao administrador para ativar a RFQ.
- **Erro:** "Selecione ao menos um fornecedor que ainda não foi convidado." (com a RFQ ativa) → **Correção:** marque ao menos um fornecedor que ainda não foi convidado.
- **Aviso:** o botão não aparece para o operador: "Só o administrador liga ou coloca a RFQ em espera." → **Correção:** peça ao administrador. (O mesmo vale para o Sourcing: "Só o administrador liga ou coloca o Sourcing em espera.")
- **Aviso:** o menu continua "RFQ (em espera)" com a RFQ ativa → **Correção:** confira o selo da tela ("Ativa" ou "Em espera"), não o nome do menu.

### Passo a passo em texto

1. O administrador abre **Pedidos → RFQ** (no menu, "RFQ (em espera)"). O selo mostra **Em espera** ou **Ativa**.
2. Para ligar, clique em **Ativar a RFQ**. Aparece "RFQ ativada." e a situação vira **Ativa**.
3. Com a RFQ ativa, a solicitação mostra o cartão **Abrir RFQ**: marque os fornecedores (os que já vendem o produto vêm primeiro) e clique em **Abrir RFQ**. Depois de aberta, dá para convidar mais fornecedores. A pendência passa a ser "Abrir RFQ: {produto}".
4. Com duas ou mais cotações respondidas, a solicitação mostra a **Disputa de fornecedores** (nota por preço, entrega, produção e MOQ). O vencedor vem marcado; escolha com **Escolher**.
5. Para voltar, clique em **Colocar a RFQ em espera**. Aparece "RFQ em espera." Cada produto volta a ir a um fornecedor só; as RFQs já abertas continuam valendo.
6. Em **Pedidos → Sourcing (em espera)**, o interruptor é o mesmo (**Ativar o Sourcing** e **Colocar o Sourcing em espera**). Em espera, o pedido de produto fora do catálogo vira só a solicitação.
7. Em **Gestão → Auditoria**, o módulo **Configurações** mostra cada mudança ("RFQ ativada", "RFQ colocada em espera", "Sourcing ativado", "Sourcing colocado em espera").

### Notas de gravação

- Prepare, antes de gravar: ligue a RFQ, abra a RFQ de uma solicitação para dois fornecedores (A e B), deixe os dois responderem, desligue a RFQ e salve o ponto `antes-WSO-04`. Assim a cena 6 tem a disputa pronta.
- A cena 5 usa uma solicitação ainda "Solicitado" **sem** RFQ aberta (o cartão "Abrir RFQ" só aparece nela). Se a solicitação já foi enviada, o cartão vira "Convidar mais fornecedores".
- Com a RFQ ativa, o produto criado pelo Booking mostra "já fornece" nos fornecedores da lista de fornecedores do produto (A e B no exemplo da jarra).
- O menu **não** muda de nome: "RFQ (em espera)" e "Sourcing (em espera)" são textos fixos. Não deixe o menu aberto em cima do selo "Ativa" no corte.
- A Auditoria mostra a hora em horário de Brasília (por exemplo "10/11/2026, 23:41"), enquanto Notificações e outras telas mostram a data e a hora do servidor ("11/11/2026, 02:41"). Recorte a linha da Auditoria para não mostrar a data nem o nome de outras pessoas (ver ⚠).

### Pontos a confirmar

- ⚠ **O nome do item de menu não acompanha a situação**: continua "RFQ (em espera)" (e "Sourcing (em espera)") com o interruptor ligado. Só o selo da tela muda.
- ⚠ O texto "Como está funcionando agora" da RFQ em espera cita o Booking pela **ficha técnica** ("Cada produto do Booking é do fornecedor escolhido ao subir a ficha técnica…"), caminho que não é o principal depois do booking por planilha. O roteiro não lê esse parágrafo.
- ⚠ Com a RFQ ativa, "O produto do Booking não vai sozinho para o fornecedor" (texto da tela) refere-se à fila de produtos antiga. A solicitação ao fornecedor do Booking por planilha (WBK-03) **não depende do interruptor**; confirmar com o dono.
- ⚠ Não conferi a tela **Auditoria** com as mudanças em pt formatadas: as linhas "RFQ ativada" e "RFQ colocada em espera" aparecem com a ação `settings.rfq` na coluna "Ação" (código, não texto). O filtro "Módulo → Configurações" mostra as duas.
- ⚠ **Fuso diferente entre telas**: a Auditoria mostra "10/11/2026, 23:41" para o que as Notificações mostram como "11/11/2026, 02:41" (a diferença é o fuso de Brasília). Confirmar qual é o fuso desejado, porque a data aparece diferente no mesmo dia.
- ⚠ O operador com a função comprador abre a tela Sourcing, mas não vê o botão (só o administrador liga). O mesmo vale para a RFQ.

---

## WSO-05 · Superplan: a viabilidade do produto

> **Promessa:** ao final do vídeo você sabe descobrir quanto custa trazer um container do produto, qual é o preço mínimo de venda e se o lucro bate a meta, e abrir a faca e a RFQ com o fornecedor ganho.

| Ficha                 |                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Série e papel         | Wellmix, administrador                                                                                                                                                                                                               |
| Quem faz              | **Só o administrador** (`ADMIN_ONLY`): ele pode liberar a tela a um login em Gestão → Equipe e divisões. O operador comprador e planner **não abre** a tela; o resultado do Superplan aparece dentro do Booking (WBK-02)                |
| Conta de gravação     | `admin@wellmix.com`, tela em pt. Um corte com `operador@wellmix.com` mostrando o aviso de acesso                                                                                                                                       |
| Duração-alvo          | 5:00                                                                                                                                                                                                                                 |
| Ponto da jornada      | Etapa 1 de 9: Produto e Booking (a viabilidade vem antes do pedido; o "Abrir faca e RFQ" entra na etapa 3)                                                                                                                            |
| Telas e rotas         | `/app/superplan` (e `?product=<id>`), `/app/requests/[id]` (a solicitação aberta pelo Superplan)                                                                                                                                      |
| Dados antes de gravar | Ponto `antes-WSO-05`: o produto "Jarra de vidro 1,5 L" (UTL-001) criado no WBK-04, com fornecedor, preço, caixa e pesos; câmbio do dia; parâmetros do Superplan com os valores padrão; tipo de negócio padrão "WELLMIX - UD - CHINA - MERCADO" |
| Depois deste vídeo    | Nasce a **Solicitação nº 2**, origem "Superplan" (compra para estoque), com a RFQ **só para o fornecedor ganho**. O fornecedor recebe o aviso "Superplan: envie faca, MOQ, prazo e foto em alta"; a Wellmix tem o briefing de embalagem com a faca obrigatória |
| Antes · Próximo       | WSO-04 · (série de preparação do pedido)                                                                                                                                                                                             |
| Idiomas               | pt (base)                                                                                                                                                                                                                            |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/superplan`**

- 🎬 Imagem: o painel de resultado do Superplan: o aviso amarelo "Lucro de 18,5%, abaixo da meta de 22%." com "Para lucrar 22%: preço de R$ 47,87 (markup 1,93).", e o cursor clicando em "Testar esse preço", que vira verde: "Viável: lucro de 22,0% (meta 22%)."
- 🎙 Narração: "Vale a pena trazer esta jarra? O Superplan responde em segundos: o custo, o preço mínimo e se o lucro bate a meta."
- 🔤 Na tela: `[TÍTULO]` "WSO-05 · Superplan: a viabilidade do produto"; `[ZOOM 150 %]` no aviso de resultado.
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/superplan`**

- 🎬 Imagem: a tela **Superplan** inteira. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "A viabilidade vem antes do pedido: é onde a Wellmix decide se um produto vale o preço do fornecedor, o frete e os impostos da importação."
- 🔤 Na tela: `[MAPA etapa 1]` com "Produto e Booking" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:45 · Só o administrador · menu → `/app/superplan`**

- 🎬 Imagem: na conta do operador, digitar `/app/superplan` no endereço: volta ao início com o aviso "Você não tem acesso a Superplan. Peça ao administrador em Gestão → Equipe e divisões." Trocar para o administrador: no menu **Pedidos**, aparece o item **Superplan**. Clicar.
- 🎙 Narração: "O Superplan é só do administrador: o operador que tenta abrir recebe o aviso de acesso. Ele pode liberar a tela para um login em Equipe e divisões. No menu Pedidos, clique em Superplan."
- 🔤 Na tela: `[PASSO 1/8] Abra Pedidos → Superplan`; `[QUEM VÊ]` "Só o administrador, ou quem ele liberar. O operador não vê; cliente e fornecedor nunca veem"; `[ATENÇÃO]` "O resultado de cada item aparece no Booking para quem abre o Booking (WBK-02)".
- ✂️ Edição: `[CORTE]` seco entre as duas contas.

**Cena 4 · 0:45–1:10 · Escolher o produto · `/app/superplan`**

- 🎬 Imagem: o campo "Produto do cadastro", com "Sem produto (preencher à mão)" no topo e os produtos do catálogo. Escolher "UTL-001 · Jarra de vidro 1,5 L" e clicar em **Carregar**. A página recarrega com "Dados de Jarra de vidro 1,5 L." e a dica "Preenche preço, caixa, peso, volume e os impostos do NCM; tudo continua editável."
- 🎙 Narração: "Escolha o produto do cadastro e clique em Carregar. O sistema preenche preço, caixa, peso, volume e os impostos pelo NCM. Dá para simular à mão também, sem produto."
- 🔤 Na tela: `[PASSO 2/8] Escolha o produto e clique em Carregar`; `[BOTÃO] "Carregar"`; `[SETA]` "Tudo continua editável"; `[DICA]` "Sem produto: preencha os campos à mão".
- ✂️ Edição: `[CORTE]` seco na recarga.

**Cena 5 · 1:10–1:50 · Compra e volume da caixa · `/app/superplan`**

- 🎬 Imagem: o cartão "Compra": "Preço por peça" (22,2), "Moeda" (RMB), "Peças por caixa" (12), "Peso líquido por peça (kg)", "Peso bruto por peça (kg)", "Peso médio por peça (kg)" (desligado, "Da ficha do produto (muda-se lá ou no Booking). Não entra na conta."), "Volume da caixa (m³)" e "II (%)" e "IPI (%)" vazios com o aviso "Produto sem NCM na tabela fiscal: confira II e IPI à mão." Corrigir "Volume da caixa (m³)" para 0,069 (o CBM da planilha). O resultado muda: "985 caixas · 11.820 peças por container · Limitado pelo volume (67,97 m³)."
- 🎙 Narração: "Em Compra, confira o preço, a moeda, as peças por caixa e os pesos. Confira o volume da caixa: aqui são zero vírgula zero sessenta e nove metros cúbicos. Sem NCM na tabela fiscal, preencha o II e o IPI à mão."
- 🔤 Na tela: `[PASSO 3/8] Confira a compra e o volume da caixa`; `[SETA]` "Volume da caixa: 0,069 m³ (do booking)"; `[SETA]` "Peso médio: só informação, não entra na conta"; `[ATENÇÃO]` "Hoje a tela pode trazer 0,0035 (ver ⚠ 1): corrija à mão"; `[ATENÇÃO]` "II e IPI vazios contam 0% e o custo sai menor".
- ✂️ Edição: `[ZOOM 150 %]` em "Volume da caixa (m³)"; mostrar o antes e o depois do resultado.

**Cena 6 · 1:50–2:20 · Container, câmbio e tipo de negócio · `/app/superplan`**

- 🎬 Imagem: o cartão "Container e fretes": "Container" (40HC), "Capacidade (m³)" (68), "Peso máximo (kg)" (26500), "Frete marítimo (US$ por container)" e "Frete rodoviário até o depósito (R$)". O cartão "Câmbio": "Dólar oficial (R$)", "Dólar futuro (R$)", "RMB por dólar" e "Câmbio do dia ({data}). Dólar futuro = oficial + R$ 0,25." O cartão "Tipo de negócio": a lista (WELLMIX - UD - CHINA - MERCADO) e, preenchidos sozinhos, "Markup" (1,8), "Comissão (%)" (5), "Despesas administrativas (%)" (12) e "Meta de lucro (%)" (22). Passar por "Despesas no Brasil (por container)" ("Total das despesas: R$ 12.236,00").
- 🎙 Narração: "O container, os fretes e o câmbio do dia já vêm preenchidos. Escolher o tipo de negócio preenche markup, comissão, despesas e a meta de lucro. As despesas do Brasil entram uma vez por container."
- 🔤 Na tela: `[PASSO 4/8] Confira container, câmbio e tipo de negócio`; `[SETA]` "Câmbio do dia: o dólar futuro é o oficial + R$ 0,25"; `[SETA]` "Meta de lucro: a do tipo de negócio"; `[DICA]` "Percentuais e despesas padrão ficam em Parâmetros do Superplan, embaixo da tela".
- ✂️ Edição: `[ZOOM 150 %]` no cartão "Tipo de negócio" por 3 s.

**Cena 7 · 2:20–2:55 · O custo e o preço mínimo · `/app/superplan`**

- 🎬 Imagem: o painel da direita. "Resultado": "985 caixas · 11.820 peças por container". "Preços por peça": "Preço mínimo (custo × 1,8)" R$ 44,53, "Preço de tabela (× 1,25)", "Sugestão atacado (× 1,6)", "Sugestão loja (× 1,8)", "Preço WD (+ 12%)" e "Custo por peça" (R$ 24,74). O cartão "Custo do container": compra, frete marítimo, valor aduaneiro, II, IPI, PIS-importação, COFINS-importação, AFRMM, despesas no Brasil, frete rodoviário e "Custo total do container".
- 🎙 Narração: "À direita, o resultado: quantas peças cabem no container, o custo de cada peça posta no depósito e o preço mínimo de venda, que é o custo vezes o markup do tipo de negócio. Mais abaixo, o custo do container em detalhe."
- 🔤 Na tela: `[PASSO 5/8] Leia o custo por peça e o preço mínimo`; `[SETA]` "Custo por peça = custo do container ÷ peças"; `[SETA]` "Preço mínimo = custo × markup"; `[SETA]` "Impostos da importação sobre o valor real da compra"; `[QUEM VÊ]` "Custo e margem: só o administrador e a Wellmix autorizada".
- ✂️ Edição: `[ZOOM 150 %]` em "Preços por peça" por 3 s.

**Cena 8 · 2:55–3:40 · O sinal: verde, amarelo ou vermelho · `/app/superplan`**

- 🎬 Imagem: no alto do painel, o aviso amarelo "Lucro de 18,5%, abaixo da meta de 22%." com "Vendendo a R$ 44,53 por peça (preço mínimo)." e "Para lucrar 22%: preço de R$ 47,87 (markup 1,93).", com o botão "Testar esse preço". Clicar: "Viável: lucro de 22,0% (meta 22%)." em verde. No campo "Preço de venda a testar (R$ por peça)" digitar 25: o aviso vira vermelho, "Prejuízo de R$ 5,18 por peça (-20,7%)." Apagar o campo ("Vazio: usa o preço mínimo.") e voltar ao amarelo.
- 🎙 Narração: "O aviso no alto diz o sinal. Verde, o lucro bate a meta. Amarelo, é positivo mas abaixo da meta. Vermelho, é prejuízo. A tela mostra o preço que dá a meta, e o botão Testar esse preço simula. Digite outro preço para ver o lucro."
- 🔤 Na tela: `[PASSO 6/8] Teste um preço de venda`; `[BOTÃO] "Testar esse preço"`; `[SETA]` "Viável: lucro igual ou acima da meta"; `[SETA]` "Abaixo da meta: lucro positivo"; `[SETA]` "Prejuízo"; `[DICA]` "Vazio: a conta usa o preço mínimo".
- ✂️ Edição: `[ZOOM 150 %]` no aviso a cada troca de cor, 2 s cada.

**Cena 9 · 3:40–4:20 · Abrir faca e RFQ · `/app/superplan`**

- 🎬 Imagem: o cartão "Viável? Abrir faca e RFQ com o fornecedor", com "Cria a solicitação e a RFQ só com o fornecedor ganho, com o preço e a quantidade desta simulação. Ele envia a faca (die-cut), o MOQ, o prazo e a foto em alta; a proposta espera esses quatro itens." Com o preço da meta (verde), escolher "Fornecedor ganho" (Shenzhen Supplier A (do produto)), "Para quem" ("Compra para estoque (sem cliente)", ou um cliente) e deixar "Quantidade (peças)" em branco ("Padrão: as peças que cabem no container."). Clicar em **Abrir faca e RFQ** (o botão mostra "Abrindo…"). Mostrar antes, com o preço 25: "Com prejuízo não dá para abrir: ajuste o preço ou os números." e, com lucro abaixo da meta, "Lucro abaixo da meta: dá para abrir, mas confira antes."
- 🎙 Narração: "Se é viável, abra a faca e a RFQ com o fornecedor ganho. Escolha o fornecedor, para quem é e a quantidade. Com prejuízo, o botão não abre. Com lucro abaixo da meta, abre com aviso. Clique em Abrir faca e RFQ."
- 🔤 Na tela: `[PASSO 7/8] Escolha o fornecedor e abra a RFQ`; `[BOTÃO] "Abrir faca e RFQ"`; `[SETA]` "Só o fornecedor ganho recebe a RFQ"; `[ERRO COMUM]` "Com prejuízo não dá para abrir: ajuste o preço ou os números."; `[ATENÇÃO]` "Lucro abaixo da meta: dá para abrir, mas confira antes."
- ✂️ Edição: `[ZOOM 150 %]` no cartão por 3 s; `[CORTE]` na abertura da página.

**Cena 10 · 4:20–4:45 · E agora? · `/app/requests/[id]`**

- 🎬 Imagem: a solicitação nº 2 abre com os selos "Superplan" e "Compra para estoque" e o cliente "Estoque Wellmix", o selo **RFQ aberta** e o aviso "Aberta do Superplan: a RFQ foi para o fornecedor ganho, que envia faca, MOQ, prazo e foto em alta. Superplan: Falta: Faca (die-cut), MOQ, Prazo, Foto em alta (HD)." com o link "Abrir a cotação". A observação traz o resumo da viabilidade. Em outra janela, o fornecedor A (em chinês) com o aviso "Superplan: envie faca, MOQ, prazo e foto em alta".
- 🎙 Narração: "Nasceu a solicitação aberta do Superplan, com o resumo da viabilidade. O fornecedor ganho recebe o aviso e envia a faca, o MOQ, o prazo e a foto em alta. Enquanto faltar um dos quatro, a proposta espera."
- 🔤 Na tela: `[DEPOIS]` "A solicitação nº 2 nasceu com a RFQ só para o fornecedor ganho. O fornecedor foi avisado. A escolha e a aprovação esperam os quatro itens dele"; `[SETA]` "Falta: Faca (die-cut), MOQ, Prazo, Foto em alta (HD)".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 11 · 4:45–5:00 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, o mapa da jornada.
- 🎙 Narração: "Resumindo: escolha o produto, confira os dados, leia o preço mínimo, teste um preço e, se for viável, abra a faca e a RFQ. Os percentuais ficam em Parâmetros do Superplan."
- 🔤 Na tela: `[RESUMO]` "1 Produto do cadastro e Carregar · 2 Confira compra, container e câmbio · 3 Preço mínimo e sinal · 4 Abrir faca e RFQ"; chamada "Fim da série WBK e WSO".
- ✂️ Edição: fade para a vinheta de encerramento.

### Erros comuns

- **Aviso:** "Falta preencher: preço por peça, peças por caixa, volume da caixa." (a tela não mostra conta pela metade) → **Correção:** preencha os campos que a lista aponta (ou carregue um produto com os dados).
- **Aviso:** "Produto sem NCM na tabela fiscal: confira II e IPI à mão." → **Correção:** digite o II e o IPI do NCM; sem eles, a conta usa 0% e o custo sai menor.
- **Aviso:** "Preço do cadastro em {currency}: informe em RMB ou US$." → **Correção:** o Superplan só conta em RMB ou US$; informe o preço numa das duas.
- **Aviso:** "Sem câmbio automático: informe os valores." → **Correção:** digite o dólar oficial, o dólar futuro e o RMB por dólar.
- **Aviso:** "Com esses impostos e despesas, a meta de {target} não é alcançável." → **Correção:** os impostos e as despesas passam da margem; reveja o markup, as despesas ou o preço de compra.
- **Aviso:** "ICMS da importação não configurado (Configurações → Tributos): conta como 0%." → **Correção:** o administrador configura em Configurações → Tributos.
- **Erro:** "Com prejuízo não dá para abrir: ajuste o preço ou os números." e "Complete a simulação para abrir a faca e a RFQ." → **Correção:** ajuste o preço de venda ou complete os campos.
- **Erro:** "Escolha um produto do cadastro para abrir a faca e a RFQ." → **Correção:** carregue um produto do cadastro (a simulação à mão não abre RFQ).

### Passo a passo em texto

1. O administrador abre **Pedidos → Superplan**.
2. Em **Produto do cadastro**, escolha o produto e clique em **Carregar**: o sistema preenche preço, caixa, pesos, volume e os impostos do NCM. Sem produto, preencha os campos à mão.
3. Em **Compra**, confira **Preço por peça**, **Moeda**, **Peças por caixa**, os pesos e o **Volume da caixa (m³)**. Preencha **II (%)** e **IPI (%)** se o NCM não está na tabela fiscal.
4. Em **Container e fretes** e **Câmbio**, confira container, fretes e câmbio do dia. Em **Tipo de negócio**, escolha o tipo: ele preenche **Markup**, **Comissão (%)**, **Despesas administrativas (%)** e **Meta de lucro (%)**.
5. Leia o **Resultado** (peças por container), os **Preços por peça** (o **Preço mínimo (custo × {markup})** e o **Custo por peça**) e o **Custo do container**.
6. Leia o aviso do alto: verde (**Viável**), amarelo (lucro abaixo da meta) ou vermelho (**Prejuízo**). Clique em **Testar esse preço** (o que dá a meta) ou digite outro em **Preço de venda a testar (R$ por peça)**.
7. Se for viável, no cartão **Viável? Abrir faca e RFQ com o fornecedor** escolha o **Fornecedor ganho**, **Para quem** e a **Quantidade (peças)** e clique em **Abrir faca e RFQ**. Com prejuízo, não abre; abaixo da meta, abre com aviso.
8. Nasce a solicitação com origem **Superplan**, a RFQ só para o fornecedor ganho e o briefing de embalagem com a faca obrigatória. A proposta espera os quatro itens do fornecedor (faca, MOQ, prazo e foto em alta). Os percentuais ficam em **Parâmetros do Superplan**, no fim da tela (só o administrador altera).

### Notas de gravação

- Antes de gravar, confira o **Volume da caixa (m³)** do produto carregado: ele tem de ser 0,069 (ver ⚠ 1). Se a tela vier com 0,0035, a cena 5 mostra a correção à mão; se o defeito já tiver sido corrigido, mostre só o valor certo e tire o `[ATENÇÃO]` do ⚠.
- Os números de referência da gravação de conferência (câmbio de 10/11/2026, tipo "WELLMIX - UD - CHINA - MERCADO", preço de 22,2 RMB, caixa de 12 peças, volume 0,069): 985 caixas, 11.820 peças por container, custo por peça R$ 24,74, preço mínimo R$ 44,53, lucro 18,5 %, preço para a meta R$ 47,87. Eles mudam com o câmbio do dia: não cite números na narração (só em legenda).
- O preço R$ 25 dá prejuízo de R$ 5,18 por peça no mesmo exemplo; R$ 60 dá "Viável: lucro de 31,4% (meta 22%)." Use os valores que a tela mostrar no dia.
- Para a cena 9, escolha "Compra para estoque (sem cliente)" (o padrão): a solicitação nasce com o cliente "Estoque Wellmix". Com um cliente, a solicitação nasce para ele.
- "Abrir faca e RFQ" cria uma solicitação de verdade: restaure o ponto de salvamento depois de gravar, para a lista de solicitações voltar ao estado anterior.
- O quadro "Como o Superplan calcula" (embaixo) e o botão "Como a conta é feita ↓" (no alto) explicam a conta em oito passos; mostre-os em dois segundos no corte, sem ler.

### Pontos a confirmar

- ⚠ **1. Volume da caixa trocado num produto criado pelo Booking.** Ao carregar a jarra criada pelo booking, a tela traz **"Volume da caixa (m³): 0,0035"** (as medidas da peça, 12 × 12 × 24 cm, lidas como medidas da caixa), em vez de 0,069, e o resultado sai errado: "1.766 caixas · 21.192 peças por container · Limitado pelo peso (26.490 kg)", preço mínimo R$ 41,94 e custo por peça R$ 23,30 (com 0,069 saem 985 caixas, 11.820 peças, R$ 44,53 e R$ 24,74). Causa provável: `sheetFromRequest` em `src/lib/services/supplier-request-product.ts` (WBK-04, ⚠ 1). Corrija a cena à mão ou corrija o defeito antes de gravar.
- ⚠ A solicitação aberta do Superplan com "Para quem: Compra para estoque" nasce com o cliente "Estoque Wellmix"; confirmar se o dono quer usar esse caminho com cliente real nos vídeos.
- ⚠ Não gravei o aviso "Lucro abaixo da meta: dá para abrir, mas confira antes." clicando em Abrir (só vi a mensagem); e não conferi a tela do fornecedor com os quatro itens (faca, MOQ, prazo e foto em alta): é outro vídeo (série do fornecedor).
- ⚠ A conta do Superplan e o "Booking" usam os mesmos números só quando o produto tem os dados certos; o preço mínimo do produto (R$ 44,53, com 22,2 RMB) difere do que o booking guardou (R$ 45,75, com os 22,9 RMB da planilha): é o efeito do preço negociado com o fornecedor.
