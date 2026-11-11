# Séries DES, COM e LOG · Despachante, Comex e Agente de carga

Três séries curtas num arquivo, para os parceiros que cuidam da chegada da carga: o despachante aduaneiro (DES), a assessoria de comex (COM) e o agente de carga (LOG). Os três trabalham **no pedido**, depois que ele nasce, e abrem só quatro coisas (docs/ACCESS.md, seção 5): **Pendências**, **Notificações**, **Mensagens** e **Pedidos**. O despachante abre ainda a classificação fiscal (NCM) do produto, a partir da pendência ou do pedido. Mostre apenas essas telas.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os episódios seguem o modelo da seção 5 do guia. Documentos de apoio: `docs/IMPORT_FLOW.md` (o cartão **Embarque e desembaraço**, com quem faz, quem valida e quem vê cada passo), `docs/WORKFLOW.md` (etapas Embarque e Desembaraço, "Quem vê o quê no pedido"), `docs/ACCESS.md`, `docs/CERTIFICATION.md` (o NCM aparece na ficha do pedido) e os módulos de i18n `import-flow`, `import-taxes`, `ncm-sheet` e `catalog`.

| Papel                | Conta de gravação (senha `wellmix123`) | O que abre                                                       | O que não vê                                                                                                       |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Despachante          | `despachante@comex.com` (Diego Despachante), pt | Pendências, Notificações, Mensagens, Pedidos e a classificação fiscal (NCM) | Valores comerciais, margem, pagamentos, cliente; as etapas dos outros (ele lê só o Embarque: BL, navio, chegada) |
| Comex (assessoria)   | `comex@assessoria.com` (Carla Comex), pt         | Pendências, Notificações, Mensagens, Pedidos                      | Financeiro, margem, cliente; fica só com o cartão Embarque e desembaraço e a etapa Embarque                       |
| Agente de carga      | `agente@cargo.com` (Lucas Logística), pt         | Pendências, Notificações, Mensagens, Pedidos                      | Financeiro, margem, cliente; vê 9 dos 13 passos do cartão (não vê numerário, DI nem CI)                            |

**Cuidado com a palavra "booking".** No cartão de embarque, o passo se chama **"Booking"** (campo "Nº do booking") e é a **reserva do espaço no navio**. Nos vídeos, a narração diz sempre **"reserva no navio"**, para não confundir com o Booking de produtos (a lista de uma planilha do fornecedor; GUIA, glossário). O nome **entre aspas na tela** continua sendo o do sistema, "Booking" (ver Pontos a confirmar). A própria lista de Pedidos usa "Esperando reserva no navio".

**Ordem de gravação sugerida** (os passos dependem uns dos outros): LOG-01 → COM-01 → DES-01. O DES-02 pode ser gravado a qualquer hora (a pendência de NCM nasce junto com a solicitação).

| ID     | Episódio                                              | Duração-alvo | Situação     |
| ------ | ----------------------------------------------------- | ------------ | ------------ |
| DES-01 | Desembaraço no pedido                                 | 4:40         | roteirizado  |
| DES-02 | Classificação fiscal (NCM) do produto                 | 4:00         | roteirizado  |
| COM-01 | Comex (assessoria): documentos, numerário e DI        | 5:20         | roteirizado  |
| LOG-01 | Agente de carga: reserva no navio e BL                | 3:40         | roteirizado  |

## Como chegar a cada estado (dados de gravação)

Todos usam o **Pedido #1 (Jarra de vidro 1,5 L, UTL-001, 1.200 un)** da série de agência (04-agencia.md) ou do E2E (`tests/e2e/happy-path.spec.ts`). Caminho testado nesta preparação (porta própria, modo memória):

| Estado                                                | Como chegar                                                                                                                                                              | Episódio |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Pendência de NCM aberta                               | `joao@lojista.com` envia a solicitação; o despachante recebe a pendência "Classificar NCM: produto" e o aviso na hora                                                    | DES-02   |
| Pedido com o cartão Embarque e desembaraço            | O pedido nasce com o sinal confirmado; o cartão aparece a partir da Preparação. Com a etapa "Arte e embalagem" concluída e a inspeção resolvida, o pedido chega ao Embarque | LOG-01, COM-01 |
| Embarque concluído, Desembaraço em andamento          | `armador@maritima.com` (tela em en) informa data de embarque, previsão de chegada, navio, envia o BL e confirma ("Shipment confirmed")                                    | DES-01   |
| Passos do cartão concluídos                           | LOG-01 e COM-01 deixam 12 dos 13 passos concluídos; falta só o DANFE (da Wellmix)                                                                                        | DES-01   |

---

## DES-01 · Desembaraço no pedido

> **Promessa:** ao final do vídeo você sabe o que o despachante vê do embarque, o que registra na etapa Desembaraço e como liberar o pedido para o transporte.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Despachante                                                                                                                           |
| Conta de gravação     | `despachante@comex.com`, tela em pt                                                                                                   |
| Duração-alvo          | 4:40                                                                                                                                  |
| Ponto da jornada      | Etapa 8 de 9: Desembaraço e transporte                                                                                                |
| Telas e rotas         | `/app/tasks` (Minhas pendências), `/app/notifications`, `/app/orders/[id]` (etapa Desembaraço; `?stage=SHIPPING` para ver o Embarque) |
| Dados antes de gravar | Pedido #1 com o **Embarque concluído** (data de embarque, previsão de chegada, navio e BL enviados) e a etapa **Desembaraço em andamento**, sem nenhum item feito. Ponto de salvamento `antes-DES-01` |
| Depois deste vídeo    | A etapa Desembaraço conclui e o pedido vai para o **Transporte**; o transportador é avisado                                            |
| Antes · Próximo       | COM-01 · DES-02                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/notifications`**

- 🎬 Imagem: a tela Notificações com o cartão "Sua vez": "Pedido #1: Desembaraço precisa de você — Falta: Número do processo, Documentos aduaneiros, Custos realizados, Liberação aduaneira." e "Agora é com você". O cursor repousa no botão "Resolver".
- 🎙 Narração: "O embarque foi confirmado e o desembaraço agora é com você. Veja o que registrar para liberar a carga."
- 🔤 Na tela: `[TÍTULO]` "DES-01 · Desembaraço no pedido"; `[ZOOM 150 %]` no texto "Falta: …".
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/notifications`**

- 🎬 Imagem: a mesma tela, com o mapa sobre ela.
- 🎙 Narração: "Estamos na etapa de desembaraço e transporte: a alfândega libera a carga para o caminhão seguir até o cliente."
- 🔤 Na tela: `[MAPA etapa 8]` com "Desembaraço e transporte" acesa.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:50 · Suas pendências · `/app/tasks`**

- 🎬 Imagem: abrir **Início → Pendências** (a tela "Minhas pendências", com "Olá, Diego Despachante"). A tabela mostra a linha "Pedido #1: Desembaraço", detalhe "Número do processo, Documentos aduaneiros, Custos previstos, Custos realizados, Liberação aduaneira", tipo "Desembaraço" e o prazo. O cursor clica em **Abrir**.
- 🎙 Narração: "Seu início é Minhas pendências. A linha Pedido 1, Desembaraço, lista o que falta e traz o prazo. O sino repete o aviso com o que falta. Clique em Abrir."
- 🔤 Na tela: `[PASSO 1/7] Abra a pendência`; `[BOTÃO] "Abrir"`; `[SETA]` "O que falta e o prazo" na linha; `[QUEM VÊ]` "O despachante abre só Pendências, Notificações, Mensagens e Pedidos".
- ✂️ Edição: `[ZOOM 150 %]` na linha; `[CORTE]` seco para o pedido ao clicar.

**Cena 4 · 0:50–1:25 · O pedido: resumo e etapas · `/app/orders/[id]`**

- 🎬 Imagem: o pedido "Pedido #1", situação "Desembaraço". O "Resumo do pedido" tem três colunas: "Fornecedor", "Modalidade de operação" ("Via trade") e "Classificação fiscal (NCM)" (o link "Não classificado" ou o código). Em "Etapas do pedido", três linhas: "Embarque" (Concluída), "Embarque e desembaraço" (recuada, Concluído, "1 de 1") e "Desembaraço" (Em andamento, "Responsável: Despachante", o prazo).
- 🎙 Narração: "No pedido, o resumo mostra o fornecedor, a modalidade de operação e a classificação fiscal, o NCM. Nas etapas, o Embarque está concluído e o Desembaraço, em andamento: essa é a sua."
- 🔤 Na tela: `[PASSO 2/7] Abra o pedido`; `[SETA]` "Classificação fiscal (NCM): DES-02" na coluna; `[SETA]` "Sua etapa: Desembaraço" na linha vermelha.
- ✂️ Edição: `[ZOOM 150 %]` no resumo por 3 s e depois na tabela de etapas.

**Cena 5 · 1:25–2:10 · O que você vê do embarque · `/app/orders/[id]?stage=SHIPPING`**

- 🎬 Imagem: clicar em **Ver detalhes** na linha "Embarque". A etapa abre embaixo com os itens: "Data de embarque", "Previsão de chegada", "Navio / viagem", "Bill of Lading (BL)" (arquivo e versão, "bl-original.pdf (v1)") e "Embarque confirmado (data, chegada, navio e BL são opcionais)", todos "Concluído", "Companhia marítima". Rolar até o cartão "Embarque e desembaraço" ("1 de 1 concluídos"), que mostra só o passo "BL (original)" com o número e o link "Arquivo".
- 🎙 Narração: "Para desembaraçar, você precisa do embarque. Clique em Ver detalhes na linha Embarque: estão a data, a previsão de chegada, o navio e o BL, o conhecimento de embarque. No cartão Embarque e desembaraço, o BL original traz o número e o arquivo."
- 🔤 Na tela: `[PASSO 3/7] Confira o embarque`; `[BOTÃO] "Ver detalhes"`; `[SETA]` "BL, navio e chegada: só leitura" na etapa; `[QUEM VÊ]` "Do cartão Embarque e desembaraço, o despachante vê só o BL"; `[QUEM VÊ]` "Numerário, DI e CI são do comex".
- ✂️ Edição: `[ZOOM 150 %]` na lista de itens do Embarque por 4 s; depois, no passo "BL (original)".

**Cena 6 · 2:10–2:45 · Número do processo e documentos · `/app/orders/[id]`**

- 🎬 Imagem: voltar à etapa "Desembaraço", aberta embaixo da tabela: "Despachante registra o número do processo, documentos aduaneiros, custos previstos e realizados e a liberação." No item "Número do processo" digitar "DES-2026-00417" e clicar em **Enviar**. No item "Documentos aduaneiros" clicar em **Escolher arquivo** (ou "Tirar ou escolher foto") e enviar `documentos-aduaneiros.pdf`.
- 🎙 Narração: "Na etapa Desembaraço, registre o Número do processo e clique em Enviar. Em Documentos aduaneiros, escolha o arquivo ou tire uma foto. Os dois são obrigatórios."
- 🔤 Na tela: `[PASSO 4/7] Registre o processo e os documentos`; `[BOTÃO] "Enviar"`; `[BOTÃO] "Escolher arquivo"`; `[SETA]` "Obrigatório" nos dois itens (sem a marca "opcional").
- ✂️ Edição: digitação em tempo real; `[CORTE]` na abertura do seletor de arquivos.

**Cena 7 · 2:45–3:25 · Custos previstos e realizados · `/app/orders/[id]`**

- 🎬 Imagem: no item "Custos previstos" (marcado "opcional") escolher a moeda "Real (BRL)" e digitar 5.200,00; clicar em **Enviar**. No item "Custos realizados" escolher "Real (BRL)", digitar 5.480,35 e clicar em **Enviar**. Mostrar o aviso "Informe o valor (ex.: 1.234,56)." ao tentar enviar vazio.
- 🎙 Narração: "Custos previstos são opcionais: dá para informar uma estimativa. Custos realizados são obrigatórios. Escolha a moeda, em geral Real, digite o valor e clique em Enviar. Se o valor ficar vazio, o portal pede que você informe."
- 🔤 Na tela: `[PASSO 5/7] Informe os custos`; `[SETA]` "opcional" em Custos previstos; `[SETA]` "Moeda + valor" no campo; `[ERRO COMUM]` "Informe o valor (ex.: 1.234,56)."
- ✂️ Edição: `[ZOOM 150 %]` nos campos de moeda e valor; os valores são de exemplo.

**Cena 8 · 3:25–3:55 · Liberação aduaneira · `/app/orders/[id]`**

- 🎬 Imagem: no item "Liberação aduaneira" clicar em **Confirmar**. Os cinco itens ficam "Concluído"; a linha "Desembaraço" passa a "Concluída", 100 %, "5 de 5"; o título do pedido muda para "Transporte".
- 🎙 Narração: "Por fim, Liberação aduaneira: clique em Confirmar quando a carga for liberada. Com os itens obrigatórios feitos, a etapa conclui e o pedido segue para o transporte. O transportador é avisado."
- 🔤 Na tela: `[PASSO 6/7] Clique em Confirmar na Liberação aduaneira`; `[BOTÃO] "Confirmar"`; `[DEPOIS]` "A etapa Desembaraço conclui; o pedido vai para o Transporte e o transportador é avisado."
- ✂️ Edição: `[ZOOM 150 %]` na linha da etapa; cartão `[DEPOIS]` em tela cheia por 4 s.

**Cena 9 · 3:55–4:25 · O que você não vê · `/app/orders/[id]`**

- 🎬 Imagem: o pedido inteiro, rolando devagar: não há preços, margem, pagamentos nem nome do cliente; as etapas de produção, inspeção e arte não aparecem na tabela. Mostrar o botão "Conversar com a Wellmix". Em um quadro curto, a mensagem "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões."
- 🎙 Narração: "Repare no que não aparece: preços, margem, pagamentos e o nome do cliente. Você também não vê as etapas dos outros, como produção e inspeção. Se tiver dúvida, use Conversar com a Wellmix."
- 🔤 Na tela: `[PASSO 7/7] Tire dúvidas com a Wellmix`; `[QUEM VÊ]` "Sem valores comerciais, sem cliente"; `[BOTÃO] "Conversar com a Wellmix"`.
- ✂️ Edição: o quadro do aviso entra por 3 s com o texto legível.

**Cena 10 · 4:25–4:40 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do DES-02.
- 🎙 Narração: "Resumindo: confira o embarque, registre processo, documentos e custos, e confirme a liberação. No próximo vídeo, a classificação fiscal."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência · 2 Confira o embarque · 3 Processo e documentos · 4 Custos realizados · 5 Liberação aduaneira"; chamada "Próximo: DES-02 · Classificação fiscal (NCM)".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** custo sem valor. O portal diz "Informe o valor (ex.: 1.234,56)." → **Correção:** digite o valor, com vírgula nos centavos.
- **Erro:** formato de arquivo não aceito. "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." → **Correção:** envie PDF ou imagem.
- **Erro:** arquivo grande demais. "Arquivo grande demais (máx. 50 MB)." → **Correção:** comprima ou divida o arquivo.
- **Aviso:** o envio falha por conexão. "O envio falhou. Verifique a conexão e tente de novo." → **Correção:** tente de novo.
- **Erro:** tentar abrir uma tela que não é sua (Financeiro, Solicitações). O portal volta ao início com "Você não tem acesso a Financeiro. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** o despachante trabalha em Pedidos; dúvidas pelo botão de conversa.
- **Erro:** abrir um pedido que não é do seu despachante. A página não abre (resposta "não encontrado", por isolamento; não testado nesta preparação) → **Correção:** confira se o pedido é o seu (a Wellmix designa o despachante em "Parceiros do pedido").

### Passo a passo em texto

1. Abra **Início → Pendências** e clique em **Abrir** na linha "Pedido #N: Desembaraço" (ou clique em **Resolver** no aviso do sino).
2. No pedido, confira o **Resumo do pedido** (fornecedor, modalidade de operação e **Classificação fiscal (NCM)**).
3. Na linha **Embarque**, clique em **Ver detalhes** para ver data de embarque, previsão de chegada, navio e **Bill of Lading (BL)**. No cartão **Embarque e desembaraço** você vê o passo **BL (original)**.
4. Na etapa **Desembaraço**, digite o **Número do processo** e clique em **Enviar**; em **Documentos aduaneiros**, envie o arquivo (ou foto).
5. Informe **Custos previstos** (opcional) e **Custos realizados** (obrigatório): escolha a moeda, digite o valor e clique em **Enviar**.
6. Clique em **Confirmar** em **Liberação aduaneira**. Com todos os obrigatórios feitos, a etapa conclui e o pedido vai ao **Transporte**.

### Notas de gravação

- Prepare o ponto de salvamento `antes-DES-01`: Embarque concluído pela companhia marítima (`armador@maritima.com`, tela em en; datas, navio "MSC AURORA V.145E" e BL de exemplo) e o cartão Embarque e desembaraço com os passos de LOG-01 e COM-01 já concluídos. A etapa Desembaraço deve estar com 0 de 5 itens.
- As datas do Embarque aparecem em formato ISO ("2026-11-08") nos itens da etapa Embarque; as demais datas do portal saem em dd/mm/aaaa. Evite fazer zoom nessas linhas ou cite a data só pela tela.
- Os valores de custo (5.200,00 e 5.480,35) e o número do processo ("DES-2026-00417") são de demonstração, escolhidos nesta preparação; não leia-os em voz alta.
- A tabela **Documentos** do pedido mostra, para o despachante, vários arquivos (fotos, arte, faca e BL). Mantenha o enquadramento no topo e nos itens da etapa; role a tabela rápido (veja Pontos a confirmar).
- Na preparação, a "Liberação aduaneira" foi aceita **antes** dos outros itens (a ordem dos itens não é obrigatória; a etapa só conclui quando todos os obrigatórios estão feitos). Na gravação, siga a ordem do roteiro.
- Esconda a faixa âmbar de demonstração e o seletor DEMO (guia, seção 7.3).

### Pontos a confirmar

- ⚠ A data do Embarque (data de embarque e previsão de chegada) sai em formato ISO ("2026-11-08") na etapa Embarque, diferente das demais telas (dd/mm/aaaa). Possível ajuste de formato.
- ⚠ A tabela "Documentos" do pedido, para o despachante (e também para a comex e o agente de carga), lista fotos da ficha do fornecedor, a arte, a faca e os arquivos da gráfica. O docs/WORKFLOW.md diz que o parceiro vê só a etapa em que tem o que fazer e o Embarque (BL, navio, chegada). Confirmar com o dono se esses arquivos devem aparecer para esses papéis (não há preço neles).
- ⚠ "Liberação aduaneira" pode ser confirmada antes do número do processo, dos documentos e dos custos. Confirmar se é intencional.
- ⚠ A pendência mostra "Custos previstos" na lista do que falta ("Número do processo, Documentos aduaneiros, Custos previstos, Custos realizados, Liberação aduaneira"), mas o aviso do sino diz "Falta: Número do processo, Documentos aduaneiros, Custos realizados, Liberação aduaneira" (sem os previstos, que são opcionais). Texto ligeiramente diferente entre as duas telas.
- ⚠ A frase "O transportador é avisado" vem de docs/WORKFLOW.md ("quando a etapa seguinte abre, o responsável recebe uma ação"); não foi conferida na conta do transportador nesta preparação.
- ⚠ O prazo da etapa (por exemplo, "26/11/2026") vem de `stageDueDays`; não é citado na narração. Confirmar o prazo real em produção antes de citá-lo.

---

## DES-02 · Classificação fiscal (NCM) do produto

> **Promessa:** ao final do vídeo você sabe abrir a classificação de um produto, conferir as sugestões e validar o NCM, sabendo que a sugestão nunca vale sozinha.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Despachante (a Wellmix também pode classificar)                                                                                        |
| Conta de gravação     | `despachante@comex.com`, tela em pt                                                                                                   |
| Duração-alvo          | 4:00                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação (o NCM entra no valor ao cliente), com a classificação visível no pedido (etapa 8)                               |
| Telas e rotas         | `/app/tasks`, `/app/notifications`, `/app/requests/[id]/ncm` (Classificar NCM), `/app/orders/[id]` (Resumo), `/app/products/[id]/tax` (classificação do produto) |
| Dados antes de gravar | Produto **sem NCM validado** (a Jarra de vidro 1,5 L, UTL-001), uma solicitação aberta dele (a pendência "Classificar NCM" nasce com ela) e o Pedido #1 dessa jarra (para o caminho a partir do pedido). Ponto de salvamento `antes-DES-02` |
| Depois deste vídeo    | O NCM validado vai para a ficha do produto e aparece no resumo do pedido; II e IPI deixam de ficar em 0 % no valor ao cliente            |
| Antes · Próximo       | DES-01 · COM-01                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/requests/[id]/ncm`**

- 🎬 Imagem: a tela "Classificar NCM" com o aviso âmbar "Sem NCM confirmado, II e IPI ficam em 0% no valor ao cliente." em destaque.
- 🎙 Narração: "O NCM define os impostos da importação. Sem ele, o valor ao cliente sai sem II e sem IPI. Quem classifica é você."
- 🔤 Na tela: `[TÍTULO]` "DES-02 · Classificação fiscal (NCM) do produto"; `[ZOOM 150 %]` no aviso.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/requests/[id]/ncm`**

- 🎬 Imagem: a mesma tela, com o mapa sobre ela.
- 🎙 Narração: "O NCM entra já na proposta ao cliente, na etapa da cotação, e continua valendo no pedido até o desembaraço."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa e uma seta tracejada até "Desembaraço e transporte" (etapa 8).
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:55 · A pendência e o aviso · `/app/tasks`, `/app/notifications`**

- 🎬 Imagem: em Minhas pendências, a linha "Classificar NCM: Jarra de vidro 1,5 L", detalhe "Solicitação nº 1 · confira as sugestões e confirme o NCM", tipo "Classificar NCM". Em Notificações, o cartão "Sua vez": "Classificar NCM: Jarra de vidro 1,5 L — Produto novo sem NCM. Abra, confira as sugestões e confirme a classificação." O cursor clica em **Abrir**.
- 🎙 Narração: "Quando um produto novo chega sem NCM, você recebe a pendência Classificar NCM e um aviso no sino. O detalhe diz: confira as sugestões e confirme o NCM. Clique em Abrir."
- 🔤 Na tela: `[PASSO 1/6] Abra Classificar NCM`; `[BOTÃO] "Abrir"`; `[SETA]` "Produto novo sem NCM" no aviso.
- ✂️ Edição: `[ZOOM 150 %]` na linha da pendência; `[CORTE]` ao clicar.

**Cena 4 · 0:55–1:40 · A tela Classificar NCM · `/app/requests/[id]/ncm`**

- 🎬 Imagem: a tela "Classificar NCM" ("Solicitação nº 1 · Jarra de vidro 1,5 L"). À esquerda, o cartão "Classificação fiscal (NCM)" com o texto "O NCM define o II (TEC) e o IPI (TIPI) do valor ao cliente. Quem classifica é o despachante; a Wellmix também pode confirmar. A IA só sugere.", o bloco "Sugestões" ("Nenhuma sugestão ainda." ou a lista), o botão "Sugerir com IA", o campo "Outro NCM (8 dígitos)" e o botão "Confirmar". À direita, o cartão "Produto" (nome, categoria, material, cor, "HS informado pelo fornecedor", descrição e especificação).
- 🎙 Narração: "Esta é a tela de trabalho. À esquerda, as sugestões, o campo Outro NCM, com oito dígitos, e o botão Confirmar. À direita, o produto: nome, material, cor, descrição e especificação. Você não vê cliente, quantidade, fornecedor nem preço."
- 🔤 Na tela: `[PASSO 2/6] Leia o produto`; `[SETA]` "Sugestões: nunca definitivas" no bloco; `[SETA]` "Dados do produto para classificar" no cartão da direita; `[QUEM VÊ]` "Sem cliente, fornecedor, quantidade nem preço".
- ✂️ Edição: `[ZOOM 150 %]` no cartão do produto por 4 s; pausa de 2 s no texto de ajuda.

**Cena 5 · 1:40–2:10 · Confirmar o NCM · `/app/requests/[id]/ncm`**

- 🎬 Imagem: digitar o NCM de 8 dígitos no campo "Outro NCM (8 dígitos)" e clicar em **Confirmar**. A tela mostra "NCM confirmado: II e IPI atualizados no valor ao cliente." e o bloco "NCM confirmado" com o código, a origem ("digitado") e o botão "Alterar NCM". Se a tabela fiscal não está carregada, o aviso "A Wellmix ainda não carregou a tabela fiscal (TEC/TIPI): as alíquotas não aparecem aqui, mas o NCM pode ser confirmado."
- 🎙 Narração: "Escolha uma sugestão ou digite o NCM de oito dígitos e clique em Confirmar. O portal avisa: NCM confirmado, II e IPI atualizados no valor ao cliente. Para corrigir, use Alterar NCM."
- 🔤 Na tela: `[PASSO 3/6] Confirme o NCM`; `[BOTÃO] "Confirmar"`; `[BOTÃO] "Alterar NCM"`; `[ERRO COMUM]` "NCM inválido: informe os 8 dígitos."; `[ATENÇÃO]` "O NCM do exemplo é só de demonstração".
- ✂️ Edição: o código digitado é de exemplo; não leia o número em voz alta.

**Cena 6 · 2:10–2:50 · A partir do pedido · `/app/orders/[id]`, `/app/products/[id]/tax`**

- 🎬 Imagem: no pedido, em "Resumo do pedido", a coluna "Classificação fiscal (NCM)" mostra o link vermelho "Não classificado". Clicar. Abre a tela do produto: título "Jarra de vidro 1,5 L", subtítulo "Classificação fiscal do produto", o código "UTL-001" e o selo da linha; o cartão "Classificação fiscal (NCM)" com o selo "Não classificado" e o aviso azul "Sugestões automáticas por palavra-chave (e por IA, quando configurada); nunca definitivas: valide com o despachante." com o botão **Sugerir NCM**.
- 🎙 Narração: "Também dá para classificar pelo pedido. No resumo, clique em Classificação fiscal: se estiver Não classificado, abre a tela do produto. Clique em Sugerir NCM: o portal procura pelas palavras do nome, do material e da especificação."
- 🔤 Na tela: `[PASSO 4/6] No pedido, abra a Classificação fiscal`; `[BOTÃO] "Sugerir NCM"`; `[SETA]` "Não classificado" no link; `[QUEM VÊ]` "Só a Wellmix e o despachante".
- ✂️ Edição: `[CORTE]` ao clicar no link; `[ZOOM 150 %]` no aviso azul.

**Cena 7 · 2:50–3:25 · Validar: a decisão é humana · `/app/products/[id]/tax`**

- 🎬 Imagem: em "Candidatas" aparece a candidata (por exemplo, "7013.37", o selo "Sugerida", o selo "Heurística (palavras-chave)", a descrição e "Referência da fonte: palavras: vidro, glass, jarra", "Sugerida por …"). Os botões **Validar** e **Rejeitar**, com o campo "Motivo (opcional)". Clicar em **Validar**: o selo muda para "Validada" e o topo mostra "NCM validado: 7013.37 … Validada por Diego Despachante · 11/11/2026". Embaixo, a regra "Só uma classificação validada por produto; validar outra substitui a atual."
- 🎙 Narração: "Cada candidata mostra o código, a origem e a fonte. A sugestão nunca vale sozinha: uma pessoa precisa clicar em Validar. Aí o topo mostra NCM validado, com quem validou e quando. Só uma validada por produto: validar outra substitui. Rejeitar guarda o motivo, para ninguém repetir."
- 🔤 Na tela: `[PASSO 5/6] Valide a candidata correta`; `[BOTÃO] "Validar"`; `[BOTÃO] "Rejeitar"`; `[ATENÇÃO]` "Sugestão não é decisão: só vale depois de Validar"; `[SETA]` "Validada por (nome, data)".
- ✂️ Edição: `[ZOOM 150 %]` na candidata e depois no selo "NCM validado"; pausa de 2 s.

**Cena 8 · 3:25–3:45 · Adicionar uma candidata · `/app/products/[id]/tax`**

- 🎬 Imagem: o formulário "Adicionar candidata": "NCM" ("4, 6 ou 8 dígitos (ex.: 7615.10 ou 76151000)"), "Descrição da posição", "Alíquotas (%), se conhecidas" (II, IPI, PIS, COFINS, ICMS), "Tratamento administrativo" ("Ex.: LI automática, anuência Inmetro, sem tratamento"), "Referência da fonte" e "Observação"; o botão "+ Adicionar candidata". A candidata nova entra como "Sugerida", fonte "Despachante".
- 🎙 Narração: "Achou outro código? Em Adicionar candidata, informe o NCM, a descrição, as alíquotas, se souber, e a fonte, como a tabela TEC ou o seu parecer. Ela entra como Sugerida, e você valida depois."
- 🔤 Na tela: `[PASSO 6/6] Adicione sua candidata (opcional)`; `[BOTÃO] "+ Adicionar candidata"`; `[SETA]` "Fonte: Despachante" na candidata; `[DICA]` "Sempre registre a fonte".
- ✂️ Edição: não preencher tudo na gravação; mostrar os campos e preencher só NCM, descrição e fonte.

**Cena 9 · 3:45–4:00 · Resumo e próximo vídeo**

- 🎬 Imagem: o resumo do pedido com o NCM validado no lugar de "Não classificado"; depois fundo vermelho com a lista e a miniatura do COM-01.
- 🎙 Narração: "Resumindo: abra a pendência, confira o produto, valide um NCM e registre a fonte. A seguir, a assessoria de comex."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência · 2 Leia o produto · 3 Confirme ou valide o NCM · 4 Registre a fonte"; chamada "Próximo: COM-01 · Comex: documentos, numerário e DI".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** NCM digitado fora do padrão. A tela de Classificar NCM mostra "Não foi possível concluir. Verifique os dados. (invalid_input)" (e o texto do dicionário "NCM inválido: informe os 8 dígitos." existe para o caso de 8 dígitos errados) → **Correção:** informe os 8 dígitos do NCM (veja Pontos a confirmar).
- **Erro:** NCM que não está na tabela fiscal carregada. "Este NCM não existe na tabela fiscal (TEC/TIPI) carregada. Confira o código." → **Correção:** confira o código na tabela TEC/TIPI.
- **Aviso:** sem tabela fiscal. "A Wellmix ainda não carregou a tabela fiscal (TEC/TIPI): as alíquotas não aparecem aqui, mas o NCM pode ser confirmado." → **Correção:** confirme o NCM; as alíquotas entram quando a tabela for carregada.
- **Erro:** nenhuma sugestão. "Nenhuma palavra-chave reconhecida em nome, material, categoria ou especificação, e a IA não está configurada ou não sugeriu. Adicione a candidata manualmente ou detalhe o nome e a categoria do produto." → **Correção:** use **Adicionar candidata**.
- **Aviso:** a IA não está disponível. "IA indisponível ({motivo}); sugestões só pelas palavras-chave." (e "IA não configurada") → **Correção:** siga com as sugestões por palavra-chave.
- **Aviso:** solicitação que já virou pedido. "Esta solicitação já virou pedido ou foi encerrada: o NCM não muda mais por aqui." → **Correção:** classifique pelo produto, a partir do pedido.
- **Aviso:** sem permissão. "Você não tem permissão para esta ação." → **Correção:** a classificação é do despachante e da Wellmix.

### Passo a passo em texto

1. Em **Minhas pendências**, abra "Classificar NCM: produto" (ou clique em **Resolver** no aviso do sino).
2. Na tela **Classificar NCM**, leia o cartão **Produto** (nome, categoria, material, cor, descrição e especificação).
3. Clique em **Sugerir com IA** (ou use as sugestões que já aparecem), ou digite o NCM de 8 dígitos em **Outro NCM (8 dígitos)**, e clique em **Confirmar**. O portal avisa "NCM confirmado: II e IPI atualizados no valor ao cliente."
4. Para classificar pelo produto, abra o pedido e clique no link de **Classificação fiscal (NCM)** do **Resumo do pedido**.
5. Em **Classificação fiscal (NCM)**, clique em **Sugerir NCM**, confira cada candidata (código, origem, fonte) e clique em **Validar** na correta. **Rejeitar** pede um motivo opcional.
6. Para incluir outro código, preencha **Adicionar candidata** (NCM, descrição, alíquotas, tratamento administrativo, fonte) e clique em **+ Adicionar candidata**.
7. Só **uma** classificação validada vale por produto; validar outra substitui a atual.

### Notas de gravação

- A pendência "Classificar NCM" nasce junto com a solicitação (na preparação, o aviso chegou às 02:20, no mesmo minuto em que o cliente enviou a solicitação). Grave a cena 3 logo depois de a solicitação nascer.
- A tela do pedido só leva ao produto enquanto o pedido existir; a tela "Classificar NCM" (da solicitação) é aberta pela pendência e **fecha** quando a solicitação vira pedido ("Esta solicitação já virou pedido ou foi encerrada…"). Grave a cena 4 e a cena 5 numa solicitação ainda aberta (na preparação usou-se uma segunda solicitação, "Jogo de panelas antiaderentes 5 pçs").
- O NCM digitado é de demonstração; não o apresente como a classificação correta da jarra. A sugestão automática desta preparação foi "7013.37 — Objetos de vidro para serviço de mesa ou cozinha", com fonte "palavras: vidro, glass, jarra".
- O botão "Sugerir com IA" só gera sugestões com a IA configurada. Em modo manual ou sem chave, a tela mostra "IA não configurada" e segue com as palavras-chave (ou com "Nenhuma sugestão ainda."). Não prometa a IA ao vivo.
- A tabela fiscal (TEC/TIPI) do seed está vazia: as alíquotas (II, IPI) não aparecem. Carregue a tabela em Configurações antes, se quiser mostrar "II … · IPI …".
- O botão "Voltar" aparece duas vezes na tela do produto (no alto à esquerda e à direita). Enquadre sem o segundo, ou aceite.

### Pontos a confirmar

- ⚠ **Possível inconsistência:** a tela Classificar NCM (da solicitação) pede **8 dígitos** ("Outro NCM (8 dígitos)"; mensagem "NCM inválido: informe os 8 dígitos."), mas a tela do produto aceita **4, 6 ou 8 dígitos** ("4, 6 ou 8 dígitos (ex.: 7615.10 ou 76151000)") e validou a sugestão de 6 dígitos "7013.37". Confirmar com o dono qual regra vale (e se a II/IPI só entram com 8 dígitos).
- ⚠ **Possível erro de mensagem:** ao confirmar um NCM com 4 dígitos na tela Classificar NCM, o portal mostrou "Não foi possível concluir. Verifique os dados. (invalid_input)", e não "NCM inválido: informe os 8 dígitos." Confirmar qual texto deve aparecer.
- ⚠ **Texto estranho:** o aviso "Sugestões automáticas por palavra-chave (e por IA, quando configurada); nunca definitivas: valide com o despachante." aparece também para o próprio despachante. Confirmar se o texto muda para ele.
- ⚠ Na tela do produto, quando o despachante gera e valida a mesma candidata, o texto diz "Sugerida por Diego Despachante … Validada por Diego Despachante". A **validação humana** é registrada (nome e data), mas quem sugere e valida pode ser a mesma pessoa. Confirmar se o dono quer separar as duas funções.
- ⚠ Duas pendências de NCM podem existir para o mesmo produto (a do aviso do sino e a da lista). O aviso "Classificar NCM: Jarra de vidro 1,5 L" continua em Notificações depois de o NCM ser validado pelo produto. Confirmar se o aviso deve sumir sozinho.
- ⚠ "Sugerir com IA" não foi exercitado com IA real (sem chave). O texto do cartão diz "A IA só sugere."
- ⚠ Depois de confirmar o NCM na tela Classificar NCM, o bloco mostrou o código, "NCM confirmado" e "digitado", mas **não** mostrou "Confirmado por {nome}" (a chave `ncm.confirmedBy` existe). Conferir se a linha deveria aparecer para o despachante.
- ⚠ O botão "Voltar" duplicado e a ausência de um rótulo próprio para a candidata rejeitada ("Rejeitada") em tela não foram vistos; confirmar na gravação.

---

## COM-01 · Comex (assessoria): documentos, numerário e DI

> **Promessa:** ao final do vídeo você sabe os passos do cartão Embarque e desembaraço que são da comex, quem valida cada um e a ordem em que eles liberam o pedido.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Comex (assessoria)                                                                                                                    |
| Conta de gravação     | `comex@assessoria.com`, tela em pt; contas de apoio: `supplier.a@china.com` (valida a invoice), `admin@wellmix.com` (financeiro: valida e paga o numerário), `agente@cargo.com` e `operador@wellmix.com` (passos anteriores) |
| Duração-alvo          | 5:20                                                                                                                                  |
| Ponto da jornada      | Etapas 7 e 8 de 9: Embarque e mar, Desembaraço e transporte                                                                          |
| Telas e rotas         | `/app/tasks`, `/app/notifications`, `/app/orders/[id]#import-flow`, `/app/orders/[id]/invoice`                                         |
| Dados antes de gravar | Pedido #1 com o cartão "Embarque e desembaraço" no começo: reserva no navio (Booking) e Draft do BL já enviados pelo agente (ponto de salvamento `antes-COM-01`, depois do LOG-01). Para o numerário, a conta do financeiro é o `admin@wellmix.com` |
| Depois deste vídeo    | 12 dos 13 passos concluídos; falta o DANFE (da Wellmix); com a liberação, o despachante fecha a etapa Desembaraço (DES-01)             |
| Antes · Próximo       | LOG-01 · DES-01                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o cartão "Embarque e desembaraço" com "12 de 13 concluídos" e quase todos os passos "Concluído", exceto o DANFE.
- 🎙 Narração: "Treze passos levam o pedido do embarque à liberação. Veja quais são seus, quem valida cada um e a ordem certa."
- 🔤 Na tela: `[TÍTULO]` "COM-01 · Comex: documentos, numerário e DI"; `[ZOOM 150 %]` em "12 de 13 concluídos".
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o cartão, com o mapa sobre ele.
- 🎙 Narração: "Estes passos cobrem o embarque e o desembaraço: documentos antes da saída do navio, e custos e declaração na chegada."
- 🔤 Na tela: `[MAPA etapa 7]` e `[MAPA etapa 8]` acesas.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:55 · Pendências e avisos · `/app/tasks`, `/app/notifications`**

- 🎬 Imagem: o menu **Início** (Pendências, Notificações, Mensagens) e **Pedidos**. Em Notificações, os cartões "Sua vez": "Pedido #1: sua vez, Presença de carga — O passo anterior foi validado." e "Pedido #1: validar BL (original) — Foi enviado e aguarda a sua validação." O botão "Resolver" leva ao cartão.
- 🎙 Narração: "Você abre Pendências, Notificações, Mensagens e Pedidos. Dois avisos importam: sua vez, quando o passo anterior foi validado, e validar, quando alguém enviou algo para você conferir."
- 🔤 Na tela: `[PASSO 1/8] Veja avisos e pendências`; `[SETA]` "Sua vez: faça o passo" no primeiro aviso; `[SETA]` "Validar: confira o que foi enviado" no segundo; `[BOTÃO] "Resolver"`; `[QUEM VÊ]` "Comex abre só Pendências, Notificações, Mensagens e Pedidos".
- ✂️ Edição: `[ZOOM 150 %]` em cada aviso por 4 s.

**Cena 4 · 0:55–1:35 · Ler o cartão · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: abrir o pedido e rolar até o cartão "Embarque e desembaraço". A tabela tem as colunas "Passo", "Situação", "Quem faz / valida", "Informado", "Enviado por" e "Ação". O cursor passa pelas situações ("Pendente", "Enviado, aguardando validação", "Concluído", "Recusado") e por "Faz: comex · valida: financeiro" no Numerário. Em "Invoice e packing assinados" aparece "Depois de: Invoice e packing list".
- 🎙 Narração: "No cartão, cada linha diz quem faz e quem valida. Pendente espera o passo. Enviado, aguardando validação, espera alguém conferir. Concluído está pronto. Recusado volta com o motivo. Depois de indica o passo que precisa vir antes."
- 🔤 Na tela: `[PASSO 2/8] Leia o cartão`; `[SETA]` "Faz: … · valida: …" na coluna; `[SETA]` "Depois de: …" no passo que espera; `[QUEM VÊ]` "A comex vê os 13 passos; o agente de carga vê 9; o fornecedor vê Booking, Draft do BL, as invoices e o BL".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Quem faz / valida"; pausa de 2 s.

**Cena 5 · 1:35–2:25 · Invoice e packing list · `/app/orders/[id]/invoice`**

- 🎬 Imagem: no passo "Invoice e packing list", clicar no link **Gerar invoice e packing list**. Abre a página "Invoice e packing list · pedido #1" ("Gerado dos dados do pedido e da ficha de compra. Confira, salve em PDF (Imprimir → Salvar como PDF) e envie no passo."): "COMMERCIAL INVOICE" (exportador, importador, item, quantidade, preço unitário, total) e "PACKING LIST" (caixas, pesos, CBM). Voltar, escolher o PDF salvo e clicar em **Enviar**.
- 🎙 Narração: "O primeiro passo é seu: Invoice e packing list. Clique em Gerar invoice e packing list. O portal monta os dois documentos com o pedido e a ficha de compra. Confira, salve em PDF e envie no passo. O fornecedor valida e devolve assinado."
- 🔤 Na tela: `[PASSO 3/8] Gere, confira e envie a invoice`; `[BOTÃO] "Gerar invoice e packing list"`; `[BOTÃO] "Enviar"`; `[QUEM VÊ]` "O fornecedor vê Booking, Draft do BL, as invoices e o BL; nunca numerário, DI nem CI"; `[DEPOIS]` "O fornecedor valida e envia 'Invoice e packing assinados'; você valida o assinado".
- ✂️ Edição: `[CORTE]` na abertura da nova aba e do seletor de arquivos; `[ZOOM 150 %]` nas tabelas da invoice por 4 s.

**Cena 6 · 2:25–3:00 · Validar o que os outros enviam · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: no passo "Draft do BL" (enviado pelo agente), o campo "Motivo (obrigatório para recusar)" e os botões **Validar** e **Recusar**. Clicar em **Recusar** com o motivo "Peso bruto diferente da invoice"; a linha mostra "Recusado: Peso bruto diferente da invoice". Depois, o agente reenvia e a comex clica em **Validar**. Repetir em "BL (original)" e em "Invoice e packing assinados".
- 🎙 Narração: "Você valida o Draft do BL, o BL original e a invoice assinada. Se estiver certo, clique em Validar. Se não, escreva o motivo e clique em Recusar: o passo volta a quem enviou, com aviso. Quem enviou não valida o próprio passo."
- 🔤 Na tela: `[PASSO 4/8] Valide ou recuse`; `[BOTÃO] "Validar"`; `[BOTÃO] "Recusar"`; `[SETA]` "Motivo obrigatório para recusar"; `[ERRO COMUM]` "Escreva o motivo para recusar."
- ✂️ Edição: `[ZOOM 150 %]` na linha recusada; `[CORTE]` de 200 ms entre recusa e validação.

**Cena 7 · 3:00–3:25 · Presença de carga · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o passo "Presença de carga" ("Depois de: BL (original)") libera quando o BL está validado. Escolher a data e clicar em **Enviar**. A situação vira "Concluído", com a data informada.
- 🎙 Narração: "Com o BL validado, vem a Presença de carga: informe a data e clique em Enviar. Este passo não tem validação: enviou, está concluído."
- 🔤 Na tela: `[PASSO 5/8] Informe a Presença de carga`; `[BOTÃO] "Enviar"`; `[SETA]` "Depois de: BL (original)"; `[SETA]` "Sem validação".
- ✂️ Edição: o campo de data aparece no formato dd/mm/aaaa (Chrome em pt-BR).

**Cena 8 · 3:25–4:10 · Numerário · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: no passo "Numerário", digitar o "Valor (R$)" (18.450,00) e escolher o demonstrativo em PDF; clicar em **Enviar**. Mostrar "Faz: comex · valida: financeiro". Corte para a conta do financeiro (`admin@wellmix.com`): **Validar**. Voltar à comex: "Numerário" Concluído e "Numerário pago" Concluído (o financeiro envia o comprovante).
- 🎙 Narração: "O Numerário é o valor em reais para cobrir os custos do desembaraço. Digite o valor, anexe o demonstrativo e clique em Enviar. Quem valida é o financeiro da Wellmix. Depois do pagamento, o financeiro anexa o comprovante em Numerário pago, e você acompanha."
- 🔤 Na tela: `[PASSO 6/8] Envie o Numerário`; `[SETA]` "Valor (R$) + demonstrativo"; `[QUEM VÊ]` "Só o financeiro valida e paga; o fornecedor nunca vê"; `[DEPOIS]` "O financeiro valida e paga; você vê 'Numerário pago'".
- ✂️ Edição: `[CORTE]` entre as contas (perfis de navegador); `[ZOOM 150 %]` no "Valor (R$)"; o valor é de exemplo.

**Cena 9 · 4:10–4:50 · Canal, DI, CE Mercante e CI · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: no passo "Canal de parametrização", o menu com "Verde", "Amarelo", "Vermelho" e "Cinza"; escolher "Verde" e clicar em **Enviar**. No passo "DI/DUIMP e XML", digitar o número no campo "Nº da DI/DUIMP", escolher o XML e clicar em **Enviar**. Depois "CE Mercante" (campo "Nº do CE Mercante") e "Comprovante de importação (CI)" (arquivo). Todos "Concluído".
- 🎙 Narração: "Agora os passos do desembaraço. No Canal de parametrização, escolha a cor: vermelho ou cinza avisam a Wellmix sobre prazo e armazenagem. Em DI/DUIMP, informe o número e o XML. Depois o CE Mercante e o Comprovante de importação."
- 🔤 Na tela: `[PASSO 7/8] Informe canal, DI, CE Mercante e CI`; `[SETA]` "Vermelho ou cinza: alerta à Wellmix"; `[BOTÃO] "Enviar"`; `[ERRO COMUM]` "Preencha o número/data."
- ✂️ Edição: quatro cortes curtos, um por passo; pausa de 1 s em cada "Concluído".

**Cena 10 · 4:50–5:05 · O DANFE é da Wellmix · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: a última linha, "DANFE (nota de entrada)", "Depois de: DI/DUIMP e XML", "Faz: Wellmix", "Pendente". O contador "12 de 13 concluídos".
- 🎙 Narração: "O último passo, o DANFE, a nota de entrada, é da Wellmix e vem depois da DI. Você só acompanha."
- 🔤 Na tela: `[SETA]` "DANFE: da Wellmix"; `[QUEM VÊ]` "Você vê o DANFE; quem faz é a Wellmix".
- ✂️ Edição: `[ZOOM 150 %]` na linha.

**Cena 11 · 5:05–5:20 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do DES-01.
- 🎙 Narração: "Resumindo: gere a invoice, valide os BLs, informe presença, numerário, canal, DI, CE Mercante e CI. Agora, o despachante fecha o desembaraço."
- 🔤 Na tela: `[RESUMO]` "1 Invoice e packing list · 2 Valide Draft do BL, BL e invoice assinada · 3 Presença de carga · 4 Numerário · 5 Canal, DI, CE Mercante, CI"; chamada "Próximo: DES-01 · Desembaraço no pedido".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** recusar sem motivo. "Escreva o motivo para recusar." → **Correção:** preencha o campo "Motivo (obrigatório para recusar)".
- **Erro:** passo fora de ordem. "Conclua antes o passo anterior." (o passo mostra "Depois de: …") → **Correção:** conclua o passo anterior.
- **Erro:** campo vazio. "Preencha o número/data." → **Correção:** digite o número ou a data.
- **Erro:** numerário sem valor. "Informe o valor." → **Correção:** digite o "Valor (R$)".
- **Erro:** enviar sem arquivo. "Envie o arquivo." → **Correção:** escolha o arquivo (o passo só envia depois que o arquivo termina de subir).
- **Erro:** canal inválido. "Canal inválido." → **Correção:** escolha Verde, Amarelo, Vermelho ou Cinza.
- **Erro:** validar o próprio passo. "Quem enviou não valida o próprio passo." → **Correção:** outra pessoa valida (o financeiro, no numerário).
- **Erro:** passo que não pede validação, ou que não está esperando. "Este passo não tem validação." / "Este passo não está aguardando validação." / "Este passo já foi validado." → **Correção:** recarregue a página.
- **Aviso:** pedido encerrado ou cancelado. "Pedido encerrado ou cancelado." → **Correção:** nada mais a enviar.
- **Aviso:** passo ainda não liberado no sistema. "Este passo ainda não está liberado no sistema. Avise a Wellmix e tente de novo depois." → **Correção:** avise a Wellmix.

### Passo a passo em texto

1. Em **Pendências** ou **Notificações**, abra o pedido ("Pedido #N: sua vez, …" ou "validar …").
2. No cartão **Embarque e desembaraço**, leia **Quem faz / valida** em cada linha.
3. Em **Invoice e packing list**, clique em **Gerar invoice e packing list**, confira, salve em PDF e envie em **Enviar**. O fornecedor valida e devolve **Invoice e packing assinados**, que você valida.
4. Valide ou recuse o **Draft do BL** e o **BL (original)** enviados pelo agente de carga: **Validar**, ou o motivo e **Recusar**.
5. Com o BL validado, informe a **Presença de carga** (data).
6. Envie o **Numerário**: **Valor (R$)** e o demonstrativo. O financeiro valida e paga; depois você vê **Numerário pago**.
7. Informe o **Canal de parametrização** (Verde, Amarelo, Vermelho ou Cinza), a **DI/DUIMP e XML**, o **CE Mercante** e o **Comprovante de importação (CI)**.
8. O **DANFE (nota de entrada)** é da Wellmix e vem depois da DI.

### Notas de gravação

- Grave com **cinco perfis de navegador** já logados: comex, agente de carga, fornecedor, operador (valida o Booking) e administrador (financeiro). Troque de perfil no corte, sem mostrar o login (guia, seção 7.3).
- O financeiro é uma **função** da Wellmix (ou o administrador). O operador de demonstração (comprador e planner) **não** valida nem paga o numerário. Use `admin@wellmix.com` para a cena 8.
- A página da invoice abre em outra aba (`target="_blank"`). O "Salvar como PDF" do navegador não precisa aparecer: use um PDF já pronto (`invoice-packing-jarra.pdf`) para a escolha do arquivo.
- A invoice mostra o preço FOB (USD 2,3500 por unidade, total USD 2.820,00 nesta preparação), porque é o documento aduaneiro. É dado de demonstração.
- Datas aparecem no formato do navegador (nesta preparação, `mm/dd/aaaa` no Chrome em inglês). Grave com o Chrome em pt-BR para sair dd/mm/aaaa.
- A cena 9 usa o canal "Verde". Os canais "Vermelho" e "Cinza" disparam aviso à Wellmix ("Pedido #N: canal Vermelho/Cinza"); o "Amarelo" **não** dispara aviso (código e docs/IMPORT_FLOW.md falam em "vermelho ou cinza").
- Os arquivos de exemplo (`demonstrativo-numerario.pdf`, `di-0001.xml`, `ci-comprovante.pdf`) são vazios e de demonstração.
- Para os cartões de aviso das cenas 3 e 6, grave antes de resolver os avisos (Resolver tira o aviso da lista).

### Pontos a confirmar

- ⚠ O passo **"Booking"** é a reserva no navio (docs/IMPORT_FLOW.md). O rótulo na tela e o campo "Nº do booking" usam a palavra "Booking", que o glossário reserva ao Booking de produtos. Confirmar se o dono quer renomear o rótulo para "Reserva no navio".
- ⚠ A comex vê o preço FOB na página da invoice (é o documento aduaneiro). O docs/SCOPE.md fala em "valores comerciais" para o despachante e não trata a comex. Confirmar com o dono.
- ⚠ A tabela "Documentos" do pedido (para comex, despachante e agente de carga) lista fotos da ficha, a arte, a faca e os arquivos da gráfica. Confirmar se é o esperado.
- ⚠ O aviso "Pedido #N: validar Draft do BL" chegou **duas vezes** (uma por envio, depois do reenvio). Confirmar se o aviso do primeiro envio deveria sair quando o passo é recusado.
- ⚠ O contador do cartão é "N de 13" para a comex e "N de 9" para o agente de carga (cada papel conta os passos que vê). Na narração a comex fala em "treze passos"; confirmar.
- ⚠ O passo "Número de registro (certificado)" (certificação, que a comex também vê no desenho do docs/CERTIFICATION.md) não aparece no cartão da comex nesta preparação (sem OCP no pedido). Conferir se deve ser citado.
- ⚠ O significado de "Presença de carga" não está explicado no código nem nos documentos (só "data", depois do BL). A narração usa o nome do passo, sem definir; confirmar a explicação com o dono.
- ⚠ Não confirmado em tela: o aviso da Wellmix para canal vermelho ou cinza ("Pedido #N: canal Vermelho/Cinza — A DI caiu em canal com conferência; acompanhe o prazo de liberação e os custos de armazenagem.") e o fluxo de recusa do numerário pelo financeiro.

---

## LOG-01 · Agente de carga: reserva no navio e BL

> **Promessa:** ao final do vídeo você sabe informar a reserva no navio, enviar o rascunho do BL e o BL original e o que fazer quando a comex recusa um documento.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agente de carga                                                                                                                       |
| Conta de gravação     | `agente@cargo.com`, tela em pt; contas de apoio: `operador@wellmix.com` (valida o Booking) e `comex@assessoria.com` (valida o draft e o BL) |
| Duração-alvo          | 3:40                                                                                                                                  |
| Ponto da jornada      | Etapa 7 de 9: Embarque e mar                                                                                                          |
| Telas e rotas         | `/app/tasks`, `/app/notifications`, `/app/orders` (lista), `/app/orders/[id]#import-flow`                                              |
| Dados antes de gravar | Pedido #1 já criado (o cartão Embarque e desembaraço aparece a partir da Preparação), **sem nenhum passo enviado**. Ponto de salvamento `antes-LOG-01` |
| Depois deste vídeo    | A Wellmix valida a reserva; a comex valida o rascunho e o BL; o despachante passa a ver o BL original (COM-01, DES-01)                 |
| Antes · Próximo       | (início do bloco) · COM-01                                                                                                            |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o cartão "Embarque e desembaraço" com "Booking" e "Draft do BL" e "BL (original)" já "Concluído", na conta do agente.
- 🎙 Narração: "Antes de a carga embarcar, o pedido precisa da reserva no navio e do conhecimento de embarque, o BL. Esses passos são seus."
- 🔤 Na tela: `[TÍTULO]` "LOG-01 · Agente de carga: reserva no navio e BL"; `[ZOOM 150 %]` nas três linhas.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o cartão, com o mapa sobre ele.
- 🎙 Narração: "Estamos na etapa do embarque e do mar. A Control Tower da Wellmix acompanha o pedido enquanto ele espera a reserva no navio."
- 🔤 Na tela: `[MAPA etapa 7]` com "Embarque e mar" acesa.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:55 · Sua pendência · `/app/tasks`**

- 🎬 Imagem: abrir **Início → Pendências** (a tela "Minhas pendências", "Olá, Lucas Logística"). A tabela mostra "Booking: pedido #1", tipo "Embarque e desembaraço", sem prazo. O cursor clica em **Abrir**. Em um quadro, a lista **Pedidos**, com a coluna "Progresso" ("Esperando reserva no navio (65%)") e o filtro por etapa.
- 🎙 Narração: "Em Minhas pendências, a linha Booking, pedido 1, é a reserva no navio. Clique em Abrir. Na lista de Pedidos, o progresso mostra Esperando reserva no navio até você informar a reserva."
- 🔤 Na tela: `[PASSO 1/6] Abra a pendência`; `[BOTÃO] "Abrir"`; `[SETA]` "Booking = reserva no navio" na linha; `[QUEM VÊ]` "O agente de carga abre só Pendências, Notificações, Mensagens e Pedidos".
- ✂️ Edição: `[ZOOM 150 %]` na linha; a coluna "Progresso" só aparece se o pedido estiver nesse ponto (veja as notas).

**Cena 4 · 0:55–1:30 · O cartão: seus 9 passos · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o pedido aberto; o cartão "Embarque e desembaraço" mostra "0 de 9 concluídos" e nove passos: "Booking", "Draft do BL", "Invoice e packing list", "Invoice e packing assinados", "BL (original)", "Presença de carga", "Canal de parametrização", "CE Mercante" e "DANFE (nota de entrada)". O cursor destaca "Faz: agente de carga · valida: Wellmix" no Booking, e "valida: comex" no Draft do BL e no BL.
- 🎙 Narração: "No cartão você vê nove passos. Três são seus: Booking, Draft do BL e BL original. Os outros você só acompanha. Em cada linha, Faz diz quem trabalha e valida diz quem confere: a Wellmix confere o Booking, e a comex confere os BLs."
- 🔤 Na tela: `[PASSO 2/6] Leia o cartão`; `[SETA]` "Seus passos: Booking, Draft do BL, BL (original)"; `[SETA]` "Só leitura" nos demais; `[QUEM VÊ]` "Numerário, DI e CI não aparecem para o agente".
- ✂️ Edição: `[ZOOM 150 %]` na coluna "Quem faz / valida"; pausa de 2 s.

**Cena 5 · 1:30–2:05 · Informar a reserva no navio · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: no passo "Booking", clicar no campo "Nº do booking", digitar "BK-2026-0451" e clicar em **Enviar**. A linha passa a "Enviado, aguardando validação", com "BK-2026-0451" e "Lucas Logística · data". Depois, a Wellmix valida: "Concluído", "validado por Otávio Operador".
- 🎙 Narração: "No passo Booking, digite o número da reserva no navio e clique em Enviar. A situação vira Enviado, aguardando validação. A Wellmix confere e valida. Só depois o próximo passo, o Draft do BL, libera para você."
- 🔤 Na tela: `[PASSO 3/6] Informe o número da reserva`; `[BOTÃO] "Enviar"`; `[SETA]` "Nº do booking" no campo; `[DEPOIS]` "A Wellmix valida; o Draft do BL libera para você".
- ✂️ Edição: `[CORTE]` de 200 ms entre o envio e a validação (troca de perfil); pausa de 2 s no "Concluído".

**Cena 6 · 2:05–2:45 · Draft do BL e recusa · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o passo "Draft do BL" ("Depois de: Booking") libera. Clicar em "Escolher arquivo" e enviar `draft-bl-jarra.pdf`; clicar em **Enviar**. Corte para a comex recusando com o motivo "Peso bruto diferente da invoice". De volta ao agente, o aviso "Pedido #1: Draft do BL recusado — Motivo: Peso bruto diferente da invoice. Corrija e envie de novo." e a linha "Recusado" com o texto do motivo e o botão **Enviar de novo**. Reenviar `draft-bl-jarra-v2.pdf`.
- 🎙 Narração: "Com a reserva validada, envie o Draft do BL, o rascunho do conhecimento. A comex confere. Se recusar, você recebe o aviso com o motivo, e a linha fica Recusado. Corrija o arquivo e clique em Enviar de novo."
- 🔤 Na tela: `[PASSO 4/6] Envie o Draft do BL`; `[BOTÃO] "Enviar de novo"`; `[ERRO COMUM]` "Draft do BL recusado — Motivo: …"; `[SETA]` "Recusado + motivo" na linha.
- ✂️ Edição: três quadros em sequência (enviado, recusado, reenviado), `[CORTE]` de 200 ms.

**Cena 7 · 2:45–3:20 · O BL original · `/app/orders/[id]#import-flow`**

- 🎬 Imagem: o aviso "Pedido #1: sua vez, BL (original) — O passo anterior foi validado." No passo "BL (original)" ("Depois de: Draft do BL"), digitar "BL-HKG-77120" no campo "Nº do BL", escolher `bl-original.pdf` e clicar em **Enviar**. A comex valida e a linha fica "Concluído".
- 🎙 Narração: "Com o rascunho validado, chega a sua vez no BL original. Digite o número, anexe o arquivo e clique em Enviar. A comex valida. O BL original também aparece para o fornecedor, a comex e o despachante."
- 🔤 Na tela: `[PASSO 5/6] Envie o BL original`; `[BOTÃO] "Enviar"`; `[SETA]` "Nº do BL + arquivo"; `[QUEM VÊ]` "Veem o BL: agente, comex, fornecedor e despachante".
- ✂️ Edição: `[ZOOM 150 %]` no campo do número; pausa de 1 s no "Concluído".

**Cena 8 · 3:20–3:40 · Resumo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do COM-01.
- 🎙 Narração: "Resumindo: informe a reserva no navio, envie o Draft do BL e depois o BL original. Se recusarem, corrija e reenvie."
- 🔤 Na tela: `[RESUMO]` "1 Booking: nº da reserva no navio · 2 Draft do BL · 3 BL (original) · 4 Se recusarem: corrija e reenvie"; chamada "Próximo: COM-01 · Comex: documentos, numerário e DI".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** passo fora de ordem. O passo mostra "Depois de: {passo}" e, se a ação chegar ao servidor, "Conclua antes o passo anterior." → **Correção:** espere o passo anterior ser validado.
- **Erro:** número em branco. "Preencha o número/data." → **Correção:** digite o "Nº do booking" ou o "Nº do BL".
- **Erro:** enviar sem arquivo. "Envie o arquivo." → **Correção:** escolha o arquivo (rascunho do BL ou BL original).
- **Aviso:** recusado. "Pedido #N: Draft do BL recusado" com "Motivo: {motivo}. Corrija e envie de novo." → **Correção:** corrija e use **Enviar de novo**.
- **Erro:** formato ou tamanho. "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." e "Arquivo grande demais (máx. 50 MB)." → **Correção:** envie PDF ou comprima.
- **Aviso:** pedido encerrado ou cancelado. "Pedido encerrado ou cancelado." → **Correção:** nada mais a enviar.
- **Aviso:** passo já validado. "Este passo já foi validado." → **Correção:** não há mais o que enviar.

### Passo a passo em texto

1. Abra **Início → Pendências** e clique em **Abrir** na linha "Booking: pedido #N" (a reserva no navio).
2. No cartão **Embarque e desembaraço**, no passo **Booking**, digite o número em **Nº do booking** e clique em **Enviar**. A Wellmix valida.
3. Quando o **Draft do BL** liberar ("Depois de: Booking"), escolha o arquivo e clique em **Enviar**. A comex valida; se recusar, corrija e clique em **Enviar de novo**.
4. Com o rascunho validado, no **BL (original)** digite o **Nº do BL**, escolha o arquivo e clique em **Enviar**. A comex valida.
5. Acompanhe os outros passos (invoice, presença de carga, canal, CE Mercante e DANFE), que são só leitura para você.

### Notas de gravação

- O pedido só mostra a coluna "Progresso: Esperando reserva no navio (65%)" enquanto o Booking não foi informado e o pedido está nesse ponto da viagem (`journey.ts`). Na preparação, o pedido já estava em "Transporte (85%)"; para a cena 3, grave a lista de Pedidos antes de informar a reserva, ou use um pedido recém-liberado do Embarque.
- Para a cena 5, a validação do Booking é da Wellmix: use `operador@wellmix.com` (validou como "Otávio Operador"). O Draft do BL e o BL são validados pela comex (`comex@assessoria.com`, "Carla Comex").
- A recusa da cena 6 é combinada com a comex: use o motivo "Peso bruto diferente da invoice" (sem ponto final: a mensagem do portal já termina em ponto).
- Os números de exemplo são de demonstração: "BK-2026-0451" (reserva) e "BL-HKG-77120" (BL).
- A palavra "Booking" aparece na tela (rótulo, pendência e "Nº do booking"). Na narração diga "reserva no navio"; não substitua o nome do botão nas legendas.
- A faixa âmbar de demonstração e o seletor DEMO devem estar escondidos (guia, seção 7.3).

### Pontos a confirmar

- ⚠ O rótulo do passo é "Booking" (e o campo "Nº do booking"). O glossário pede "reserva no navio". Confirmar se o rótulo da tela muda; até lá, o roteiro cita o nome entre aspas e narra "reserva no navio".
- ⚠ A frase "A Control Tower da Wellmix acompanha o pedido enquanto ele espera a reserva no navio" vem de docs/WORKFLOW.md (quadrado "esperando reserva no navio"). Não foi conferida na Control Tower nesta preparação; confirmar antes de gravar.
- ⚠ Não foi capturado o texto da coluna "Progresso" da lista de Pedidos no ponto "Esperando reserva no navio" (só o filtro com "Esperando reserva no navio (65%)" e o pedido já em "Transporte"); conferir na gravação.
- ⚠ O texto do aviso ao agente é "Pedido #1: sua vez, Draft do BL — O passo anterior foi validado.". O mesmo texto serve para qualquer passo; confirmar se o dono quer mensagens diferentes.
- ⚠ O BL também existe como item opcional da etapa **Embarque** (enviado pela companhia marítima) e como passo "BL (original)" do cartão (enviado pelo agente de carga). O docs/IMPORT_FLOW.md diz que "o BL e os custos continuam também nelas, por enquanto". Confirmar se o vídeo deve explicar a diferença.
- ⚠ O agente de carga vê no pedido o fornecedor ("Resumo do pedido: Fornecedor") e a lista de Documentos do pedido. O docs/ACCESS.md e o WORKFLOW não citam isso para o agente. Confirmar se é intencional.
