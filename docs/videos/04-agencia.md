# Série AGE · Agência

Vídeos para a agência de design e marketing que faz a arte da embalagem: a Agência Criativa (`agencia@design.com`, tela em pt). A agência abre **Pendências** (o início), **Notificações**, **Mensagens**, e, no grupo **Pedidos**, **Embalagens** (os briefings de faca e arte) e **Pedidos** (docs/ACCESS.md, seção 5). O menu mostra dois grupos: **Início** (Pendências, Notificações, Mensagens) e **Pedidos** (Embalagens, Pedidos).

**O que a agência não vê:** preços, cotações, fornecedores concorrentes, o cliente (padrão: `agencyShowsCustomer` desligado) e as etapas dos outros papéis. O fornecedor escolhido só aparece depois da escolha. Se tentar abrir Solicitações ou Cotações, o portal volta ao início com o aviso "Você não tem acesso a Solicitações. Peça ao administrador em Gestão → Equipe e divisões." (docs/WORKFLOW.md, "Embalagem já na RFQ"; docs/SCOPE.md).

**Atenção ao escopo (diferença em relação ao pedido de roteiro):** a **faca (die-cut) não é enviada pela agência**. Quem a envia é o **fornecedor escolhido**, depois da comparação das cotações, porque é ele quem fabrica a caixa; a Wellmix pode enviar no lugar dele. A agência só **recebe e baixa** a faca (docs/WORKFLOW.md; `canSendDieline` em `src/lib/services/packaging-brief.ts`). Por isso o AGE-02 ensina a enviar a **arte**, os **arquivos para a gráfica** e a **foto da embalagem física**, e mostra como a faca chega.

Antes de gravar: leia o [GUIA.md](GUIA.md) (formato, ambiente, elementos de tela e a lista de qualidade). Os episódios seguem o modelo da seção 5 do guia. Documentos de apoio desta série: `docs/WORKFLOW.md` ("Arte e embalagem", "Embalagem já na RFQ"), `docs/ORDER_SIGNATURE.md` (seção 2c, a assinatura depois da arte e do selo), `docs/CERTIFICATION.md` (o selo na arte), `docs/RFQ_STANDBY.md` e `docs/ACCESS.md`.

| ID     | Episódio                                          | Duração-alvo | Situação     |
| ------ | ------------------------------------------------- | ------------ | ------------ |
| AGE-01 | Receber o briefing de embalagem                   | 3:50         | roteirizado  |
| AGE-02 | Enviar a arte e os arquivos para a gráfica (a faca vem do fornecedor) | 4:20 | roteirizado  |
| AGE-03 | Prompt para criar a arte (ChatGPT)                | 2:55         | roteirizado  |
| AGE-04 | Arte reprovada, prazo e valor por item            | 4:40         | roteirizado  |
| AGE-05 | Selo de certificação na arte                      | 4:10         | roteirizado  |

## Como chegar a cada estado (dados de gravação)

O briefing de embalagem nasce **na hora em que a Wellmix envia a solicitação ao fornecedor** (com a RFQ em espera, é o botão "Enviar ao fornecedor" em Pedidos → RFQ; docs/RFQ_STANDBY.md). Com uma única agência ativa, ela é escolhida sozinha. Grave a série em ordem, com um ponto de salvamento antes de cada episódio (guia, seção 7.2). Caminho testado nesta preparação (porta própria, modo memória):

| Estado                                      | Como chegar                                                                                                                                                                       | Episódio |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Briefing aberto, nada enviado               | `joao@lojista.com` envia a solicitação da Jarra de vidro 1,5 L (1.200 un); `operador@wellmix.com` abre Pedidos → RFQ e clica em "Enviar ao fornecedor" para Shenzhen Supplier A    | AGE-01   |
| Medidas provisórias                         | `supplier.a@china.com` responde a cotação (a ficha traz a caixa master 50 × 40 × 30 cm, 24 un/caixa)                                                                              | AGE-01   |
| Fornecedor escolhido e faca enviada         | operador escolhe o fornecedor e clica em "Enviar para aprovação"; `admin@wellmix.com` aprova os dois níveis; João aprova a proposta; o fornecedor envia a faca na pendência "Die Cut" | AGE-02   |
| Pedido criado, selo pendente                | `admin@wellmix.com` clica em "Confirmar sinal recebido" na solicitação                                                                                                            | AGE-04, AGE-05 |
| Selo enviado                                | `ocp@certifica.com` envia o selo no quadro "Memorial (selo)" do cartão Certificação                                                                                               | AGE-05   |
| Etapa Arte e embalagem aberta               | `operador@wellmix.com` conclui o item do pedido conferido e a programação da ficha de compra; o fornecedor vê a etapa aberta                                                      | AGE-04   |

---

## AGE-01 · Receber o briefing de embalagem

> **Promessa:** ao final do vídeo você sabe onde o pedido de embalagem chega, o que o briefing mostra (e esconde de você) e qual é o prazo.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agência                                                                                                                               |
| Conta de gravação     | `agencia@design.com`, tela em pt                                                                                                      |
| Duração-alvo          | 3:50                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação (o briefing nasce junto com a cotação)                                                                          |
| Telas e rotas         | `/app/tasks` (Minhas pendências), `/app/notifications`, `/app/packaging` (Embalagens), `/app/packaging/[id]` (o briefing)             |
| Dados antes de gravar | Solicitação da Jarra de vidro 1,5 L enviada ao fornecedor (briefing aberto, "Em preparação", sem arquivos); depois, a cotação respondida para a cena 9. Ponto de salvamento `antes-AGE-01` com o briefing recém-aberto |
| Depois deste vídeo    | A agência passa a preparar os entregáveis (AGE-02)                                                                                     |
| Antes · Próximo       | (início da série) · AGE-02                                                                                                            |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/tasks`**

- 🎬 Imagem: a tela **Minhas pendências** com a linha "Solicitação nº 1: embalagem (faca e arte): Jarra de vidro 1,5 L". O sino do cabeçalho mostra "1". O cursor repousa perto do botão "Abrir".
- 🎙 Narração: "Chegou um pedido de embalagem. Antes mesmo de o cliente fechar a compra, você já pode começar a arte da jarra."
- 🔤 Na tela: `[TÍTULO]` "AGE-01 · Receber o briefing de embalagem"; `[ZOOM 150 %]` na linha da pendência.
- ✂️ Edição: vinheta de 6,5 s antes; entrada do título em 2 s; música baixa para −28 dB quando a voz começa.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/tasks`**

- 🎬 Imagem: a mesma tela, sem ação. O mapa da jornada aparece sobre ela.
- 🎙 Narração: "Isto acontece na etapa da cotação. Enquanto o fornecedor responde o preço, a arte e a faca andam em paralelo."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa.
- ✂️ Edição: o mapa sai em 8 s, deslizando para cima.

**Cena 3 · 0:22–0:46 · Suas pendências · `/app/tasks`**

- 🎬 Imagem: a faixa "Etapas que chegam até você" com os três quadrados numerados: "Arte na cotação" (amarelo, com o número 1), "Arte do pedido" e "Selo na arte" (verdes). Em seguida a legenda ("Atrasado", "A fazer, no prazo", "Concluído ou nada a fazer") e a tabela com as colunas "Pendência", "Detalhe", "Tipo" e "Prazo". O cursor vai ao botão "Abrir".
- 🎙 Narração: "Sua conta abre em Minhas pendências. Os três quadrados mostram o caminho da agência: arte na cotação, arte do pedido e selo na arte. Amarelo é o que há para fazer no prazo; vermelho, o que atrasou. A linha traz o produto, o que falta e o prazo."
- 🔤 Na tela: `[PASSO 1/6] Abra Minhas pendências`; `[SETA]` "Etapas que chegam até você" nos três quadrados; `[SETA]` "O que falta e o prazo" na linha; `[BOTÃO] "Abrir"`.
- ✂️ Edição: `[ZOOM 150 %]` nos quadrados por 3 s e depois na linha da tabela; pausa de 1 s antes do clique.

**Cena 4 · 0:46–1:08 · O aviso no sino · `/app/notifications`**

- 🎬 Imagem: clicar no sino do cabeçalho. A tela **Notificações** abre com o grupo "Precisa de você" e o cartão "Sua vez": "Embalagem para preparar: Jarra de vidro 1,5 L (solicitação nº 1)", "Agora é com você", e o botão "Resolver". O cursor percorre o texto do aviso (quantidade, o que enviar e o prazo) e termina em "Resolver".
- 🎙 Narração: "O sino também avisa. Em Notificações, o cartão Sua vez diz: Embalagem para preparar. Traz a quantidade, o que enviar e o prazo. Resolver marca o aviso como lido e leva você ao briefing."
- 🔤 Na tela: `[PASSO 2/6] Leia o aviso Sua vez`; `[BOTÃO] "Resolver"`; `[SETA]` "Aviso lido sai da lista".
- ✂️ Edição: `[CORTE]` seco para o briefing depois do clique, ou volte ao menu para a cena 5 (veja as notas de gravação).

**Cena 5 · 1:08–1:30 · A lista de Embalagens · menu Pedidos → `/app/packaging`**

- 🎬 Imagem: abrir o menu **Pedidos** e clicar em **Embalagens**. A tela "Embalagens (faca e arte)" mostra uma linha: "Jarra de vidro 1,5 L, 1.200 un", "Solicitação nº 1", "Falta enviar: Faca (die-cut), Arte da embalagem", o prazo e os selos "Em preparação" e "Venda ainda não confirmada".
- 🎙 Narração: "No menu Pedidos, abra Embalagens. Cada linha é um briefing: produto, solicitação, o que falta enviar, prazo e situação. O selo amarelo lembra que a venda ainda não foi confirmada."
- 🔤 Na tela: `[PASSO 3/6] Abra Pedidos → Embalagens`; `[SETA]` "Em preparação: ainda falta enviar" no selo; `[SETA]` "Venda ainda não confirmada" no selo amarelo; `[ZOOM 150 %]` na linha.
- ✂️ Edição: manter 2 s parado na linha; clique com onda de destaque no nome do produto.

**Cena 6 · 1:30–2:15 · O que o briefing mostra · `/app/packaging/[id]`**

- 🎬 Imagem: a tela **Embalagem: Jarra de vidro 1,5 L**. O cursor passa pelo alerta azul ("A cotação com os fornecedores corre em paralelo. Se a solicitação não virar pedido, você é avisado para parar."), pelo cartão "O que é" (Produto, Quantidade, Fornecedor escolhido, Descrição), por "Medidas da caixa" e por "Instruções da Wellmix" ("Sem instruções adicionais."). Depois aponta, à direita, o cartão "Entregáveis".
- 🎙 Narração: "Abra o briefing. À esquerda, o que é: produto, quantidade e a descrição do pedido. Em Medidas da caixa ficam o tamanho da caixa master e as peças por caixa. Em Instruções da Wellmix, marca, acabamento e idioma do rótulo. À direita estão os entregáveis."
- 🔤 Na tela: `[PASSO 4/6] Leia o briefing`; `[SETA]` "O que é" no cartão; `[SETA]` "Medidas da caixa: da ficha do produto ou da cotação" no segundo cartão; `[SETA]` "Instruções da Wellmix" no terceiro; `[SETA]` "Entregáveis: AGE-02" no cartão da direita.
- ✂️ Edição: `[ZOOM 150 %]` em cada cartão por cerca de 4 s; sem cortes entre eles, o cursor guia a leitura.

**Cena 7 · 2:15–2:45 · O que você não vê · `/app/packaging/[id]`**

- 🎬 Imagem: o cartão "O que é" com a linha "Fornecedor escolhido: Fornecedor ainda em cotação". Um contorno vermelho passa pelo espaço onde estariam o preço e o cliente (não existem na tela). Em seguida, inserir um quadro curto da mensagem "Você não tem acesso a Solicitações. Peça ao administrador em Gestão → Equipe e divisões." (tela das Pendências com o aviso âmbar).
- 🎙 Narração: "Repare no que não aparece: preço, cotações, outros fornecedores e o nome do cliente. É de propósito. O fornecedor escolhido só aparece depois da escolha. Se tentar abrir Solicitações, o portal avisa que você não tem acesso."
- 🔤 Na tela: `[QUEM VÊ]` "Só você e a Wellmix veem este briefing"; `[QUEM VÊ]` "O fornecedor e o cliente não veem"; `[ATENÇÃO]` "Sem preço, sem cotação, sem cliente".
- ✂️ Edição: o quadro do aviso âmbar entra por 3 s, com o texto legível.

**Cena 8 · 2:45–3:10 · O prazo · `/app/packaging` e `/app/packaging/[id]`**

- 🎬 Imagem: a coluna "Prazo" na lista ("17/11/2026") e, no cabeçalho do briefing, "Prazo: 17/11/2026" ao lado de "Solicitação nº 1". Mostrar também, como imagem de apoio (sem gravar ao vivo), a data em vermelho de um briefing vencido.
- 🎙 Narração: "O prazo aparece na lista e no alto do briefing. Fica em vermelho quando vence. O sistema lembra você perto do vencimento e quando atrasa. Se a venda não for adiante, você é avisado para parar."
- 🔤 Na tela: `[PASSO 5/6] Confira o prazo`; `[SETA]` "Prazo" na coluna; `[ATENÇÃO]` "Vermelho: prazo vencido"; `[DICA]` "Resolvido o pendente, o lembrete para."
- ✂️ Edição: a imagem do prazo vencido leva a etiqueta "exemplo" no canto, porque a gravação não tem briefing vencido (veja as notas).

**Cena 9 · 3:10–3:35 · As medidas chegam · `/app/notifications` e `/app/packaging/[id]`**

- 🎬 Imagem: em Notificações, o cartão "Aviso": "Medidas provisórias da embalagem: Jarra de vidro 1,5 L — Caixa master 50 × 40 × 30 cm, 24 un/caixa. Confira a faca e a arte." Depois o cartão "Medidas da caixa" do briefing, com "(provisórias, de uma cotação ainda em disputa)" e, em seguida, "(da cotação escolhida)" e o aviso "Fornecedor escolhido: Jarra de vidro 1,5 L".
- 🎙 Narração: "Quando o fornecedor responde, as medidas da caixa chegam como provisórias, e você recebe um aviso. Ao escolher o fornecedor, elas passam a valer. Se mudarem, o portal avisa: confira a faca e a arte."
- 🔤 Na tela: `[PASSO 6/6] Confira as medidas`; `[SETA]` "provisórias" no cartão; `[SETA]` "da cotação escolhida" no cartão; `[DICA]` "Medidas mudaram? Use o botão de conferência depois de ajustar."
- ✂️ Edição: dois quadros lado a lado (antes e depois da escolha) com um `[CORTE]` de 200 ms.

**Cena 10 · 3:35–3:50 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do AGE-02.
- 🎙 Narração: "Resumindo: abra a pendência, leia o briefing e confira prazo e medidas. No próximo vídeo, envie a arte e os arquivos para a gráfica."
- 🔤 Na tela: `[RESUMO]` "1 Abra a pendência ou o aviso · 2 Leia o briefing · 3 Confira prazo e medidas"; chamada "Próximo: AGE-02 · Enviar a arte e os arquivos".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** a agência tenta abrir o que não é dela (Solicitações, Cotações, Financeiro). O portal volta ao início e avisa "Você não tem acesso a {tela}. Peça ao administrador em Gestão → Equipe e divisões." → **Correção:** a agência trabalha em Embalagens e Pedidos; dúvida sobre preço ou cliente vai para a Wellmix pelo botão de conversa.
- **Erro:** abrir um briefing que é de outra agência ou já não existe. A tela responde "não encontrado" (página 404), por isolamento. → **Correção:** abra o briefing pela lista Embalagens.
- **Aviso:** briefing cancelado. A tela mostra "Briefing cancelado: a solicitação não seguiu para pedido. Nada mais a fazer." → **Correção:** pare o trabalho; a Wellmix já cancelou.
- **Erro:** o briefing é de outro responsável. Ao salvar, o portal diz "Só o responsável pelo briefing (ou a Wellmix) altera." → **Correção:** fale com a Wellmix; ela pode trocar quem faz.

### Passo a passo em texto

1. Entre com a conta da agência. O início é **Minhas pendências**.
2. Procure a pendência "Solicitação nº N: embalagem (faca e arte): produto" na etapa **Arte na cotação** e clique em **Abrir**. Se preferir, abra o sino, leia o aviso "Embalagem para preparar" e clique em **Resolver**.
3. Para ver todos os briefings, abra o menu **Pedidos** e clique em **Embalagens**. A coluna **Entregáveis** diz o que falta enviar; **Situação** mostra **Em preparação** e **Venda ainda não confirmada**.
4. Abra o briefing e leia **O que é**, **Medidas da caixa** e **Instruções da Wellmix**.
5. Confira o **Prazo**, no alto do briefing. Ele fica vermelho quando vence.
6. Quando o fornecedor responde, as medidas chegam como provisórias, com aviso. Ao escolher o fornecedor, passam a valer.
7. Você não vê preço, cotações, concorrentes nem o cliente. Dúvidas: botão de conversa com a Wellmix.

### Notas de gravação

- Prepare o ponto de salvamento `antes-AGE-01` com o briefing recém-aberto e **sem** a cotação respondida. Grave as cenas 1 a 8; depois faça o fornecedor responder a cotação e grave a cena 9.
- A tela de Pendências da agência tem **um erro de texto**: na coluna "Tipo" a pendência do briefing aparece como `stage.agency.brief` em vez de "Arte na cotação" (veja Pontos a confirmar). Grave a tabela com **zoom na coluna "Pendência" e "Detalhe"** e deixe a coluna "Tipo" fora do enquadramento, ou aguarde a correção.
- Os selos de prazo ("vence em 7 dias") mudam com o dia da gravação; não os cite na narração.
- A Jarra não tem foto de vitrine no seed. Para o cartão "O que é" mostrar "Fotos do catálogo", suba 2 ou 3 fotos limpas em Produtos → ficha (guia, seção 7.5).
- A cena 8 mostra um briefing vencido como imagem de apoio. O seed não tem um; altere a data da solicitação ou use a imagem de apoio com a etiqueta "exemplo".
- Esconda a faixa âmbar de demonstração e o seletor DEMO (guia, seção 7.3).

### Pontos a confirmar

- ⚠ O menu da agência diz **"Embalagens"** (`nav.packaging`) e o título da tela é "Embalagens (faca e arte)". O texto do pedido de roteiro falava em "Embalagem"; o roteiro usa o rótulo do dicionário.
- ⚠ **Possível erro de tela:** na tabela de Pendências da agência, a coluna "Tipo" mostra a chave `stage.agency.brief` (e `stage.agency.art`) em vez do nome da etapa ("Arte na cotação", "Arte do pedido"). Causa provável: `groupLabel` em `src/components/task-list.tsx` trata como "etapa do pedido" a pendência que tem `stageKey` e monta `stage.<grupo>`. A pendência do selo aparece certo ("Selo na arte").
- ⚠ O prazo do briefing usa o prazo da solicitação; sem ele, o padrão de `packagingBriefDueDays` (7 dias no código). Confirmar o valor em produção (Configurações).
- ⚠ O lembrete usa `reminderDaysBeforeDue` (1 dia por padrão) e sai no máximo uma vez a cada 24 horas; confirmar o valor em produção antes de citar "um dia antes" na narração (o roteiro diz só "perto do vencimento").
- ⚠ O rótulo "(provisórias, de uma cotação ainda em disputa)" fala em "disputa", mas com a RFQ em espera há um único fornecedor por produto. Confirmar com o dono se o texto muda.
- ⚠ O aviso "Medidas mudaram em {data}: confira a faca e a arte." e o botão "Conferi: faca e arte estão de acordo com as medidas" não foram vistos em tela nesta preparação (exigem a Wellmix mudar as medidas). Gravar só depois de conferir.
- ⚠ Com `agencyShowsCustomer` ligado nas Configurações, o cartão "O que é" ganha a linha "Cliente". O roteiro assume o padrão (desligado); confirmar a configuração de produção.

---

## AGE-02 · Enviar a arte e os arquivos para a gráfica (a faca vem do fornecedor)

> **Promessa:** ao final do vídeo você sabe enviar a arte, os arquivos da gráfica e a foto da embalagem, trocar por uma nova versão e entende quando o briefing fica **Pronta** e quem envia a faca.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agência                                                                                                                               |
| Conta de gravação     | `agencia@design.com`, tela em pt                                                                                                      |
| Duração-alvo          | 4:20                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação (a arte segue para a etapa 5, Preparação)                                                                       |
| Telas e rotas         | `/app/packaging/[id]` (Entregáveis), `/app/notifications`, `/app/tasks`                                                               |
| Dados antes de gravar | Briefing da AGE-01 ("Em preparação"), com um PDF de arte (`arte-jarra-v1.pdf` e `arte-jarra-v2.pdf`), um PDF para a gráfica e uma foto da embalagem. O fornecedor escolhido envia a faca **durante** a gravação (cena 4) ou antes, para a cena 8. Ponto de salvamento `antes-AGE-02` |
| Depois deste vídeo    | O briefing fica **Pronta**; a Wellmix recebe "Embalagem pronta"; com o sinal, a arte vai para o pedido e o fornecedor a aprova                |
| Antes · Próximo       | AGE-01 · AGE-03                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/packaging/[id]`**

- 🎬 Imagem: o briefing com o selo verde "Pronta" e o alerta "Pronto: faca e arte enviadas. O fornecedor aprova a arte na etapa Arte e embalagem do pedido." Os quatro entregáveis com o visto verde.
- 🎙 Narração: "Arte enviada, arquivos prontos: o briefing vira Pronta. Veja como entregar cada item, passo a passo."
- 🔤 Na tela: `[TÍTULO]` "AGE-02 · Enviar a arte e os arquivos para a gráfica"; `[ZOOM 150 %]` no selo "Pronta".
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB ao começar a voz.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/packaging/[id]`**

- 🎬 Imagem: o briefing sem ação, com o mapa sobre ele.
- 🎙 Narração: "Seguimos na etapa da cotação. A arte nasce agora e depois segue com o pedido, até o fornecedor aprovar."
- 🔤 Na tela: `[MAPA etapa 3]` com "Cotação" acesa e uma seta tracejada até "Preparação" (etapa 5).
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:55 · Os quatro entregáveis · `/app/packaging/[id]`**

- 🎬 Imagem: o cartão "Entregáveis" no estado inicial. O cursor desce pela lista: "Faca (die-cut) (obrigatório)", "Arte da embalagem (obrigatório)", "Arquivos para a gráfica (opcional)", "Foto da embalagem física (opcional)". Cada linha mostra o círculo vazio e "Falta enviar" (a faca mostra outro texto).
- 🎙 Narração: "Em Entregáveis há quatro itens. Faca e Arte da embalagem são obrigatórios. Arquivos para a gráfica e Foto da embalagem física são opcionais. O círculo vazio é pendente; o visto verde, enviado. O número da versão aparece ao lado do arquivo."
- 🔤 Na tela: `[PASSO 1/6] Veja os entregáveis`; `[SETA]` "obrigatório" na faca e na arte; `[SETA]` "opcional" nos dois últimos; `[SETA]` "○ pendente · ✓ enviado".
- ✂️ Edição: `[ZOOM 150 %]` no cartão por 4 s.

**Cena 4 · 0:55–1:25 · A faca vem do fornecedor · `/app/packaging/[id]`**

- 🎬 Imagem: a linha da faca com o texto "O fornecedor escolhido envia, depois da comparação das cotações" e "Aguardando o fornecedor escolhido enviar". Corte para o briefing depois da escolha: "com o fornecedor (Shenzhen Supplier A)". Em seguida, o aviso em Notificações: "Faca (die-cut) recebida: Jarra de vidro 1,5 L — O fornecedor enviou a faca. Já dá para fazer a arte em cima dela." e a linha da faca com o visto e o link do arquivo (`jarra-faca-diecut.pdf`, "v1").
- 🎙 Narração: "A faca, o molde da caixa, não é sua: quem envia é o fornecedor escolhido, depois da comparação das cotações. Até lá, a linha diz que aguarda o fornecedor. Quando ele envia, você recebe Faca recebida e baixa o arquivo para fazer a arte em cima dele."
- 🔤 Na tela: `[PASSO 2/6] A faca vem do fornecedor`; `[SETA]` "Sem botão de envio: a faca não é da agência" na linha; `[QUEM VÊ]` "O fornecedor escolhido envia; a Wellmix pode enviar no lugar dele"; `[DICA]` "Baixe a faca antes de começar a arte".
- ✂️ Edição: três quadros em sequência (antes da escolha, aviso, depois do envio) com `[CORTE]` de 200 ms; `[ZOOM 150 %]` no aviso.

**Cena 5 · 1:25–2:00 · Enviar a arte · `/app/packaging/[id]`**

- 🎬 Imagem: na linha "Arte da embalagem", o cursor clica em **Escolher arquivo** e escolhe `arte-jarra-v1.pdf`. O arquivo sobe sozinho. Aparecem o alerta verde "Arquivo enviado.", o selo "Arquivo enviado." na linha, o nome do arquivo e "v1 · 11/11/2026". Mostrar também o botão vizinho "Tirar ou escolher foto".
- 🎙 Narração: "Para enviar a arte, clique em Escolher arquivo. Aceita PDF e arquivos de arte, como AI, PSD e EPS. Se for uma foto, use Tirar ou escolher foto. O arquivo sobe sozinho, sem botão de enviar. Aparecem Arquivo enviado, o nome, a versão v1 e a data."
- 🔤 Na tela: `[PASSO 3/6] Envie a arte`; `[BOTÃO] "Escolher arquivo"`; `[BOTÃO] "Tirar ou escolher foto"`; `[SETA]` "v1 · data" ao lado do nome do arquivo.
- ✂️ Edição: `[CORTE]` na abertura do seletor de arquivos (não mostrar as pastas do computador); pausa de 1 s no selo "Arquivo enviado.".

**Cena 6 · 2:00–2:30 · Nova versão e excluir · `/app/packaging/[id]`**

- 🎬 Imagem: enviar `arte-jarra-v2.pdf` pelo mesmo botão. A linha passa a mostrar "v2". Passar o cursor no link vermelho "Excluir" (sem clicar) e mostrar a caixa de confirmação "Excluir?".
- 🎙 Narração: "Ajustou a arte? Envie de novo: cada envio vira uma nova versão, v2, v3, e assim por diante. Excluir apaga o arquivo atual, e o item volta a Falta enviar. Se o briefing estava Pronta, ele volta a Em preparação."
- 🔤 Na tela: `[PASSO 4/6] Envie uma nova versão quando ajustar`; `[ATENÇÃO]` "Excluir apaga o arquivo atual"; `[BOTÃO] "Excluir"`.
- ✂️ Edição: não confirmar a exclusão na gravação (ou grave em uma cópia do ponto de salvamento).

**Cena 7 · 2:30–3:00 · Arquivos da gráfica e foto · `/app/packaging/[id]`**

- 🎬 Imagem: enviar `jarra-grafica.pdf` em "Arquivos para a gráfica" e uma foto em "Foto da embalagem física" (botão "Tirar ou escolher foto"). Em seguida, rolar até o cartão "Observações (gráfica, fornecedor)" e mostrar o texto digitado "Gráfica indicada: Gráfica Alfa. Prova de cor antes da impressão." com o botão "Salvar observações".
- 🎙 Narração: "Os dois últimos itens são opcionais. Em Arquivos para a gráfica, envie os arquivos prontos para imprimir. Em Foto da embalagem física, mostre a embalagem real, se houver. Recados como a prova de cor vão em Observações."
- 🔤 Na tela: `[PASSO 5/6] Envie os arquivos da gráfica e a foto (opcional)`; `[BOTÃO] "Salvar observações"`; `[DICA]` "Opcionais não seguram o briefing".
- ✂️ Edição: a foto escolhida deve ser da jarra física, sem marca de terceiros.

**Cena 8 · 3:00–3:30 · Quando fica Pronta · `/app/packaging/[id]`, `/app/tasks`**

- 🎬 Imagem: o briefing com a faca e a arte enviadas: o selo muda de "Em preparação" para "Pronta" e surge o alerta verde "Pronto: faca e arte enviadas. O fornecedor aprova a arte na etapa Arte e embalagem do pedido." Depois, a tela Minhas pendências: "Nenhuma pendência. Bom trabalho."
- 🎙 Narração: "Com a faca e a arte enviadas, o briefing vira Pronta, e aparece o aviso verde. A Wellmix recebe Embalagem pronta, e a sua pendência some da lista. Os opcionais não seguram o briefing."
- 🔤 Na tela: `[PASSO 6/6] Confira o selo Pronta`; `[SETA]` "Pronta" no selo; `[DEPOIS]` "A Wellmix é avisada: Embalagem pronta."
- ✂️ Edição: transição de 200 ms do selo "Em preparação" para "Pronta"; pausa de 2 s no alerta verde.

**Cena 9 · 3:30–4:05 · E depois do sinal · `/app/packaging/[id]`**

- 🎬 Imagem: o briefing já "No pedido", com o alerta azul "Agora no pedido #1: a arte segue para a aprovação do fornecedor." e o link "Abrir o pedido →". Sob ele, as linhas "Aguardando a aprovação do fornecedor" e o recado do selo de certificação.
- 🎙 Narração: "Quando o cliente paga o sinal, nasce o pedido. O briefing passa a No pedido, os arquivos seguem para o pedido, e a arte enviada já conta como pronta. Quando a etapa abre, o fornecedor é avisado para aprovar. Se você enviar uma arte nova, ele aprova de novo."
- 🔤 Na tela: `[DEPOIS]` "Sinal confirmado: o pedido nasce e o fornecedor aprova a arte na etapa Arte e embalagem"; `[QUEM VÊ]` "Depois do pedido, o fornecedor escolhido abre os arquivos; o cliente nunca".
- ✂️ Edição: cartão `[DEPOIS]` em tela cheia por 4 s, com o briefing ao fundo.

**Cena 10 · 4:05–4:20 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do AGE-03.
- 🎙 Narração: "Resumindo: baixe a faca, envie a arte, os arquivos da gráfica e a foto, e confira o selo Pronta. A seguir, um atalho para criar a arte."
- 🔤 Na tela: `[RESUMO]` "1 Baixe a faca do fornecedor · 2 Envie a arte (v1, v2…) · 3 Envie gráfica e foto · 4 Confira Pronta"; chamada "Próximo: AGE-03 · Prompt para criar a arte".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** clicar para enviar sem escolher arquivo. O portal responde "Escolha um arquivo." → **Correção:** escolha o arquivo antes de confirmar (o envio é automático ao escolher).
- **Erro:** formato não aceito. A mensagem é "Formato de arquivo não aceito: envie PDF, imagem, planilha, ZIP ou arte (AI, PSD, EPS, CDR, TIFF)." → **Correção:** exporte em PDF ou num dos formatos de arte.
- **Erro:** arquivo grande demais. O portal diz "Arquivo grande demais (máx. 50 MB)." → **Correção:** comprima o arquivo ou envie em partes.
- **Aviso:** quando o envio falha por conexão, a tela mostra "O envio falhou. Verifique a conexão e tente de novo." → **Correção:** tente de novo.
- **Erro:** mexer num briefing já encerrado. "Este briefing já foi encerrado (cancelado ou concluído)." → **Correção:** não há mais o que enviar; fale com a Wellmix.
- **Erro:** trocar a arte depois que o fornecedor aprovou. "A arte já foi aprovada no pedido: para trocar, a Wellmix reabre o item pelo pedido." → **Correção:** peça à Wellmix para reabrir o item.
- **Erro:** a linha da faca não tem botão de envio. Não é falha: a faca é do fornecedor escolhido ("Aguardando o fornecedor escolhido enviar"). → **Correção:** aguarde o aviso "Faca (die-cut) recebida".

### Passo a passo em texto

1. Abra **Pedidos → Embalagens** e clique no produto. O cartão **Entregáveis** lista **Faca (die-cut)**, **Arte da embalagem**, **Arquivos para a gráfica** e **Foto da embalagem física**.
2. A **faca** é enviada pelo fornecedor escolhido (ou pela Wellmix). Quando chegar, você recebe o aviso "Faca (die-cut) recebida". Baixe o arquivo pelo link da linha.
3. Em **Arte da embalagem**, clique em **Escolher arquivo** (PDF, AI, PSD, EPS, CDR, TIFF, imagem) ou em **Tirar ou escolher foto**. O arquivo sobe sozinho e a linha mostra o nome, a versão (**v1**) e a data.
4. Para corrigir, envie de novo: nasce a **v2**, e assim por diante. **Excluir** apaga o arquivo atual.
5. Envie, se houver, **Arquivos para a gráfica** e **Foto da embalagem física**. Recados para a gráfica vão em **Observações (gráfica, fornecedor)** → **Salvar observações**.
6. Com a faca e a arte enviadas, o briefing fica **Pronta** e a Wellmix recebe "Embalagem pronta".
7. Quando o sinal é confirmado, o briefing passa a **No pedido**: a arte segue para a aprovação do fornecedor (AGE-04).

### Notas de gravação

- Ponto de salvamento `antes-AGE-02`: briefing "Em preparação" com a cotação respondida e o fornecedor ainda **não** escolhido. Para a cena 4, escolha o fornecedor (operador "Enviar para aprovação"; admin aprova os dois níveis; João aprova a proposta) e deixe o fornecedor enviar a faca. A faca é enviada pela pendência "Die Cut" do fornecedor (tela de cotação, `#die-cut`), com o arquivo `jarra-faca-diecut.pdf`.
- O seletor de arquivos do sistema operacional não deve aparecer: grave a escolha com `setInputFiles` ou corte o quadro.
- A cena 6 mostra a caixa "Excluir?" sem confirmar. Excluir apaga o arquivo e a versão anterior deixa de aparecer no briefing; não grave a confirmação no ponto de salvamento principal.
- O nome do arquivo (`arte-jarra-v1.pdf`) aparece na tela; use nomes limpos, sem dados reais.
- Ao concluir o episódio, a pendência da agência some ("Nenhuma pendência. Bom trabalho."): guarde essa captura para a cena 8.
- Depois do envio, a tela mostra **dois** avisos de arquivo enviado: o alerta verde no alto ("Arquivo enviado.") e o selo na linha. Não é duplicidade de envio.

### Pontos a confirmar

- ⚠ Divergência com o pedido de roteiro: a agência **não envia a faca** (fornecedor escolhido ou Wellmix). Confirmar com o dono se o título do AGE-02 deve citar a faca ou só a arte.
- ⚠ Na aba de documentos do pedido, a faca aparece como **"Faca de corte"** (tipo do documento), enquanto o briefing diz "Faca (die-cut)". Confirmar o nome oficial.
- ⚠ O texto do aviso "Faca (die-cut) recebida" aparece com "Agora é com: Fornecedor" na coluna "Com quem", embora a vez seja da agência (fazer a arte). Parece o rótulo de quem enviou; confirmar se é intencional.
- ⚠ O aviso "Pedido #N criado: arte da embalagem já enviada" e o aviso da faca aparecem como "Aviso" em "Novidades", enquanto a faca recebida aparece em "Precisa de você" com o botão "Abrir". Conferir a classificação.
- ⚠ **Excluir** apaga o arquivo atual do armazenamento. Confirmar se a versão anterior (por exemplo, v1 ao excluir a v2) deve voltar a valer; hoje o item volta a "Falta enviar".
- ⚠ A faca só chega depois da escolha do fornecedor. Em produção, confirmar o tempo habitual entre a RFQ e a escolha para não prometer na narração que a faca chega logo.

---

## AGE-03 · Prompt para criar a arte (ChatGPT)

> **Promessa:** ao final do vídeo você sabe montar, copiar e usar o prompt do briefing para criar a arte no ChatGPT e depois enviá-la ao portal.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agência (a Wellmix usa a mesma caixa)                                                                                                 |
| Conta de gravação     | `agencia@design.com`, tela em pt (Chrome com permissão de área de transferência liberada, para o botão "Copiar prompt")               |
| Duração-alvo          | 2:55                                                                                                                                  |
| Ponto da jornada      | Etapa 3 de 9: Cotação                                                                                                                 |
| Telas e rotas         | `/app/packaging/[id]` (caixa `#art-prompt`)                                                                                           |
| Dados antes de gravar | Briefing da Jarra com medidas da caixa e a observação da agência já salvas (para o prompt sair com mais linhas). Ponto de salvamento `antes-AGE-03` |
| Depois deste vídeo    | A arte criada fora do portal é enviada em "Arte da embalagem" (AGE-02); o portal não grava o prompt                                    |
| Antes · Próximo       | AGE-02 · AGE-04                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/packaging/[id]`**

- 🎬 Imagem: a caixa "Prompt para criar a arte (ChatGPT)" com o texto do prompt já gerado e o botão "Copiar prompt" em destaque.
- 🎙 Narração: "Sem ideia por onde começar a arte? O portal monta o texto do pedido para você levar ao ChatGPT, com os dados da jarra."
- 🔤 Na tela: `[TÍTULO]` "AGE-03 · Prompt para criar a arte (ChatGPT)"; `[ZOOM 150 %]` na caixa.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:20 · Onde estou na jornada · `/app/packaging/[id]`**

- 🎬 Imagem: o briefing com o mapa sobre ele.
- 🎙 Narração: "A caixa fica no briefing, abaixo dos entregáveis, ainda na etapa da cotação."
- 🔤 Na tela: `[MAPA etapa 3]`.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:20–0:50 · O que o prompt leva · `/app/packaging/[id]`**

- 🎬 Imagem: rolar até o cartão "Prompt para criar a arte (ChatGPT)". Passar o cursor pelo texto de ajuda ("Escreva o que a arte deve ter e toque em Gerar prompt. O texto sai com os dados deste briefing, pronto para copiar e colar no ChatGPT junto com as fotos do produto. A imagem é criada lá; depois envie em Arte da embalagem.").
- 🎙 Narração: "A caixa usa os dados do briefing: produto, quantidade, descrição, medidas da caixa, material, cores Pantone e as instruções da Wellmix. O que estiver vazio fica de fora; nada é inventado. O portal não chama inteligência artificial nem guarda o seu texto no sistema."
- 🔤 Na tela: `[PASSO 1/6] Abra a caixa do prompt`; `[SETA]` "Dados do briefing entram sozinhos" no texto de ajuda; `[QUEM VÊ]` "Só quem abre o briefing: a agência e a Wellmix".
- ✂️ Edição: `[ZOOM 150 %]` no texto de ajuda por 5 s.

**Cena 4 · 0:50–1:20 · Escrever o que você quer · `/app/packaging/[id]`**

- 🎬 Imagem: clicar no campo "O que você quer na arte" (placeholder: "Estilo, cores, textos da frente e do verso, marca, público, referências…") e digitar: "Estilo clean e moderno, fundo branco com detalhes em verde-folha. Frente: foto da jarra e o nome Jarra de vidro 1,5 L. Verso: dicas de uso e lavagem. Público: famílias."
- 🎙 Narração: "Em O que você quer na arte, descreva estilo, cores, textos da frente e do verso, marca, público e referências. Cabem até dois mil caracteres. O texto fica guardado só neste computador, por briefing, para não se perder se você sair da tela."
- 🔤 Na tela: `[PASSO 2/6] Escreva o que quer na arte`; `[SETA]` "Até 2.000 caracteres"; `[ATENÇÃO]` "Guardado só neste aparelho: outro computador não vê".
- ✂️ Edição: digitação em tempo real, sem aceleração (texto curto).

**Cena 5 · 1:20–1:45 · Gerar o prompt · `/app/packaging/[id]`**

- 🎬 Imagem: clicar em **Gerar prompt**. O campo "Prompt pronto (pode ajustar antes de copiar)" aparece, em letra de máquina, com as linhas: "Crie a arte da embalagem do produto abaixo, pronta para impressão.", "Produto: Jarra de vidro 1,5 L", "Quantidade: 1.200 un", "Descrição: …", as medidas, "O que você quer na arte: …" e as "Regras: …".
- 🎙 Narração: "Clique em Gerar prompt. Aparece o Prompt pronto, num campo de texto. Você pode ajustar antes de copiar. Atenção: gerar de novo refaz o texto e apaga os seus ajustes."
- 🔤 Na tela: `[PASSO 3/6] Clique em Gerar prompt`; `[BOTÃO] "Gerar prompt"`; `[SETA]` "Pode editar antes de copiar"; `[ATENÇÃO]` "Gerar de novo apaga os ajustes".
- ✂️ Edição: `[ZOOM 150 %]` no campo do prompt; pausa de 3 s para leitura.

**Cena 6 · 1:45–2:15 · Copiar e abrir o ChatGPT · `/app/packaging/[id]`**

- 🎬 Imagem: clicar em **Copiar prompt**: o botão passa a "Copiado ✓". Clicar no link "Abrir o ChatGPT →" (abre outra aba; mostrar só a aba aberta, sem conta nem conversas).
- 🎙 Narração: "Clique em Copiar prompt. O botão mostra Copiado. Depois clique em Abrir o ChatGPT, cole o texto e anexe as fotos do produto, que servem de referência para a imagem."
- 🔤 Na tela: `[PASSO 4/6] Copie e abra o ChatGPT`; `[BOTÃO] "Copiar prompt"`; `[SETA]` "Copiado ✓"; `[SETA]` "Abrir o ChatGPT →"; `[DICA]` "Anexe as fotos do produto no ChatGPT".
- ✂️ Edição: na aba do ChatGPT, esconda qualquer dado de conta (use perfil limpo) ou mostre só a caixa de texto vazia.

**Cena 7 · 2:15–2:40 · Voltar e enviar a arte · `/app/packaging/[id]`**

- 🎬 Imagem: de volta ao briefing, rolar até "Entregáveis" e clicar em **Escolher arquivo** na linha "Arte da embalagem" para enviar a imagem baixada.
- 🎙 Narração: "A imagem é criada no ChatGPT, fora do portal. Quando ficar boa, baixe e envie em Arte da embalagem. O prompt pede que a imagem respeite as medidas, mas confira a faca mesmo assim."
- 🔤 Na tela: `[PASSO 5/6] Envie a arte em Arte da embalagem`; `[BOTÃO] "Escolher arquivo"`; `[ATENÇÃO]` "Confira a arte em cima da faca antes de enviar".
- ✂️ Edição: não mostrar a imagem real de terceiros; use uma arte de exemplo própria.

**Cena 8 · 2:40–2:55 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do AGE-04.
- 🎙 Narração: "Resumindo: escreva, gere, copie, crie no ChatGPT e envie a arte. No próximo vídeo, veja o que fazer quando o fornecedor reprova."
- 🔤 Na tela: `[RESUMO]` "1 Escreva o que quer · 2 Gerar prompt · 3 Copiar prompt · 4 Crie no ChatGPT · 5 Envie em Arte da embalagem"; chamada "Próximo: AGE-04 · Arte reprovada, prazo e valor por item".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Aviso:** o navegador bloqueia a cópia automática. A tela mostra "Não deu para copiar sozinho: selecione o texto e copie." → **Correção:** clique dentro do campo (ele seleciona tudo) e copie com Ctrl+C (⌘+C).
- **Engano:** gerar o prompt de novo depois de ajustar o texto. O ajuste se perde, porque o texto é refeito com os dados do briefing e o que está em "O que você quer na arte". → **Correção:** ajuste o texto só depois do último "Gerar prompt".
- **Engano:** achar que o portal guardou o prompt. Ele não grava nada: só o que você escreve em "O que você quer na arte" fica no aparelho. → **Correção:** cole o prompt no ChatGPT na hora, ou salve o texto em outro lugar.
- **Observação:** com o briefing cancelado, a caixa do prompt some.

### Passo a passo em texto

1. Abra o briefing em **Pedidos → Embalagens** e role até **Prompt para criar a arte (ChatGPT)**.
2. Em **O que você quer na arte**, escreva estilo, cores, textos da frente e do verso, marca, público e referências (até 2.000 caracteres).
3. Clique em **Gerar prompt**. O campo **Prompt pronto (pode ajustar antes de copiar)** mostra o texto com os dados do briefing: produto, quantidade, descrição, especificação, caixa master, peças por caixa, tipo de embalagem, material, cores Pantone, instruções da Wellmix e as suas observações. O que está vazio fica de fora.
4. Ajuste o texto, se quiser, e clique em **Copiar prompt** (o botão mostra **Copiado ✓**).
5. Clique em **Abrir o ChatGPT →**, cole o texto e anexe as fotos do produto.
6. Baixe a imagem criada e envie em **Arte da embalagem** (**Escolher arquivo**), como no AGE-02.

### Notas de gravação

- O Chrome da gravação precisa permitir a área de transferência para o site; sem isso, a tela mostra "Não deu para copiar sozinho: selecione o texto e copie." (use esse caso na seção de erros, se preferir).
- Na preparação, a caixa gerou exatamente este texto (com a observação da agência já salva em "Observações"): "Crie a arte da embalagem do produto abaixo, pronta para impressão. / Produto: Jarra de vidro 1,5 L / Quantidade: 1.200 un / Descrição: Jarra de vidro com tampa de bambu / Observações da agência: … / O que você quer na arte: … / Regras: respeite a proporção das medidas informadas; alta resolução; deixe espaço para o código de barras e para as informações obrigatórias; não invente dados técnicos que não estão acima; use as fotos do produto que vou anexar como referência fiel do produto." Com as medidas da cotação, entram também a linha da caixa master, as peças por caixa, o tipo de embalagem, o material e as cores Pantone.
- O ChatGPT é um serviço de fora: não grave contas, conversas nem cobranças. Mostre só a caixa de texto.
- O texto digitado em "O que você quer na arte" fica no navegador (`localStorage`), por briefing. Limpe o armazenamento entre tomadas para repetir a cena 4 do zero.

### Pontos a confirmar

- ⚠ A ajuda da caixa diz "toque em Gerar prompt" (texto para celular). A narração diz "clique", por ser desktop; confirmar se mantém assim.
- ⚠ O prompt inclui as "Observações da agência" (campo do cartão "Observações (gráfica, fornecedor)"), que também falam de gráfica e fornecedor. Conferir se não é indesejável levar esse recado ao ChatGPT.
- ⚠ Não confirmado em tela: o texto do prompt com as medidas da caixa preenchidas (nesta preparação a caixa foi gerada antes das medidas chegarem). Conferir na gravação que a linha "Caixa master (C × L × A): 50 × 40 × 30 cm" aparece.
- ⚠ Não há limite de tamanho do prompt gerado além dos 2.000 caracteres do campo "O que você quer na arte"; confirmar se o ChatGPT aceita o texto completo com as fotos.

---

## AGE-04 · Arte reprovada, prazo e valor por item

> **Promessa:** ao final do vídeo você sabe o que fazer quando o fornecedor reprova a arte, como o prazo é cobrado e onde informar o valor por item, que só a agência e a Wellmix veem.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agência                                                                                                                               |
| Conta de gravação     | `agencia@design.com`, tela em pt                                                                                                      |
| Duração-alvo          | 4:40                                                                                                                                  |
| Ponto da jornada      | Etapa 5 de 9: Preparação (arte e embalagem)                                                                                           |
| Telas e rotas         | `/app/packaging/[id]` (Observações, Valor por item), `/app/tasks`, `/app/notifications`, `/app/orders/[id]` (etapa "Arte e embalagem")  |
| Dados antes de gravar | Pedido criado (sinal confirmado), arte v2 enviada pelo briefing, etapa "Arte e embalagem" aberta, e o fornecedor **reprovando** a arte com uma observação durante a gravação (ou antes, na cena 6). Ponto de salvamento `antes-AGE-04` com a etapa aberta e a arte ainda não reprovada |
| Depois deste vídeo    | A agência reenvia a arte (nova versão); a aprovação do fornecedor volta a pendente; o fornecedor é avisado                              |
| Antes · Próximo       | AGE-03 · AGE-05                                                                                                                       |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/notifications`**

- 🎬 Imagem: a tela Notificações com o cartão "Sua vez": "Pedido #1: Aprovação da arte pelo fornecedor reprovado, refaça" e, embaixo, a observação do fornecedor ("Código de barras fora da área permitida; mover para a lateral e reenviar.").
- 🎙 Narração: "O fornecedor reprovou a arte. Calma: o portal diz o motivo e o que fazer. Vamos ver o prazo e o valor por item."
- 🔤 Na tela: `[TÍTULO]` "AGE-04 · Arte reprovada, prazo e valor por item"; `[ZOOM 150 %]` no motivo.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:22 · Onde estou na jornada · `/app/notifications`**

- 🎬 Imagem: a mesma tela, com o mapa sobre ela.
- 🎙 Narração: "Estamos na etapa de preparação, em Arte e embalagem. É aqui que o fornecedor confere a arte e aprova, ou reprova."
- 🔤 Na tela: `[MAPA etapa 5]` com "Preparação" acesa.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:22–0:55 · O prazo do briefing (SLA) · `/app/packaging` e `/app/packaging/[id]`**

- 🎬 Imagem: a lista Embalagens com a coluna "Prazo" e o cabeçalho do briefing ("Prazo: 17/11/2026"). Um quadro de apoio mostra a data em vermelho quando o prazo vence. Depois, em Notificações, o texto de um lembrete: "Embalagem vence em breve: Jarra de vidro 1,5 L (solicitação nº 1)" e "ATRASADA: embalagem de Jarra de vidro 1,5 L (solicitação nº 1)", com "Falta enviar: Arte da embalagem."
- 🎙 Narração: "O briefing tem prazo. Vem da solicitação; sem ela, a Wellmix define um padrão de dias. Perto do vencimento e quando atrasa, o sistema manda um lembrete com o que falta. Depois do pedido, quem cobra a arte é a etapa, que também tem prazo."
- 🔤 Na tela: `[PASSO 1/6] Acompanhe o prazo`; `[SETA]` "Prazo" no cabeçalho; `[ATENÇÃO]` "Vermelho: prazo vencido"; `[DICA]` "Um lembrete por dia, no máximo".
- ✂️ Edição: quadros de lembrete com a etiqueta "exemplo" se a gravação não tiver briefing vencido; `[ZOOM 150 %]` na data.

**Cena 4 · 0:55–1:40 · Valor por item · `/app/packaging/[id]`**

- 🎬 Imagem: rolar até o cartão "Observações (gráfica, fornecedor)". Digitar no campo "Valor por item (agência)" o valor 12,50; escolher a moeda em "Moeda" (BRL, USD ou CNY); ler a dica ("Quanto a agência cobra por este item (criação e finalização da arte). Opcional; fica só entre a agência e a Wellmix."); clicar em **Salvar observações**. A tela volta com "Salvo."
- 🎙 Narração: "Aqui você informa o valor por item. Digite o valor, escolha a moeda e clique em Salvar observações. É o que a agência cobra pela criação e finalização da arte, e é opcional. Só a agência e a Wellmix veem este valor: o fornecedor e o cliente não veem o briefing."
- 🔤 Na tela: `[PASSO 2/6] Informe o valor por item`; `[BOTÃO] "Salvar observações"`; `[QUEM VÊ]` "Só a agência e a Wellmix"; `[QUEM VÊ]` "O fornecedor e o cliente não veem o briefing"; `[SETA]` "Moeda: BRL, USD ou CNY".
- ✂️ Edição: `[ZOOM 150 %]` nos dois campos; pausa de 2 s em "Salvo.".

**Cena 5 · 1:40–2:15 · A etapa Arte e embalagem no pedido · `/app/orders/[id]`**

- 🎬 Imagem: Pedidos → o pedido #1. Em "Etapas do pedido", a linha "Arte e embalagem" ("Em andamento", "Prazo: 18/11/2026"). Embaixo, a etapa aberta com os itens: "Arte da embalagem" (Concluído, Agência, com o arquivo da arte "Enviada na solicitação nº 1"), "Aprovação da arte pelo fornecedor" (Pendente), "Documento do pedido enviado para assinatura" (Pendente, Agência), e as assinaturas da Wellmix e do fornecedor.
- 🎙 Narração: "Com o pedido criado, a arte segue para a etapa Arte e embalagem. A arte do briefing já conta como enviada. Agora o fornecedor confere e aprova. Você vê a etapa, mas só os itens da sua parte pedem ação."
- 🔤 Na tela: `[PASSO 3/6] Abra o pedido`; `[SETA]` "Arte da embalagem: concluído" no item; `[SETA]` "Aprovação do fornecedor: pendente" no item; `[QUEM VÊ]` "A agência vê só esta etapa e o selo".
- ✂️ Edição: `[ZOOM 150 %]` na lista de itens da etapa; pausa de 2 s.

**Cena 6 · 2:15–2:55 · O fornecedor reprova · `/app/orders/[id]`, `/app/tasks`**

- 🎬 Imagem: depois da reprovação, a tela Minhas pendências com a pendência "Pedido #1: Arte e embalagem — Arte da embalagem" na etapa "Arte do pedido" (o quadrado 2 fica amarelo com o número 1). Abrir o pedido: o item "Arte da embalagem" agora está **Reprovado**, mostra a observação do fornecedor, e "Aprovação da arte pelo fornecedor" também está **Reprovado**, com "Aguardando a arte (agência ou Wellmix)".
- 🎙 Narração: "Quando o fornecedor reprova, a arte volta para você, com a observação dele. A pendência aparece em Arte do pedido. No pedido, a Arte da embalagem fica Reprovado, e a aprovação espera uma arte nova. Leia a observação com atenção."
- 🔤 Na tela: `[PASSO 4/6] Leia a observação do fornecedor`; `[SETA]` "Reprovado + motivo" no item; `[ERRO COMUM]` "Arte reprovada: o fornecedor escreveu o motivo"; `[SETA]` "Arte do pedido" no quadrado 2.
- ✂️ Edição: `[ZOOM 150 %]` na observação por 4 s.

**Cena 7 · 2:55–3:45 · Refazer e reenviar · `/app/orders/[id]`**

- 🎬 Imagem: no item "Arte da embalagem" (Reprovado), clicar em **Escolher arquivo** e enviar `arte-jarra-v3.pdf`. O item volta a **Concluído**, com "arte-jarra-v3.pdf (v3)"; "Aprovação da arte pelo fornecedor" volta a **Pendente**; a barra da etapa avança. Em seguida, mostrar o item "Documento do pedido enviado para assinatura" com a dica "Aguardando a arte da embalagem: o documento só vai para assinatura depois dela." (que desaparece quando a arte é reenviada).
- 🎙 Narração: "Refaça a arte e envie em Escolher arquivo. Nasce uma nova versão, a v3, e a aprovação volta a ficar pendente: o fornecedor é avisado. Enquanto a arte está reprovada, o documento do pedido não pode ir para assinatura."
- 🔤 Na tela: `[PASSO 5/6] Reenvie a arte`; `[BOTÃO] "Escolher arquivo"`; `[SETA]` "v3: nova versão"; `[SETA]` "Aprovação: pendente de novo"; `[DEPOIS]` "O fornecedor recebe o aviso e aprova de novo".
- ✂️ Edição: `[CORTE]` na abertura do seletor de arquivos; pausa de 2 s no "Concluído".

**Cena 8 · 3:45–4:25 · Se acontecer de novo · `/app/orders/[id]`**

- 🎬 Imagem: quadro de resumo com as três respostas possíveis do fornecedor: aprova (o item fica Concluído e a etapa segue), reprova (volta para a agência) e, depois de decidida, só a Wellmix refaz. Mostrar a mensagem "Esta aprovação já foi decidida; só a Wellmix pode refazer." e a mensagem da agência "A arte já foi aprovada no pedido: para trocar, a Wellmix reabre o item pelo pedido."
- 🎙 Narração: "Pode haver outras rodadas. Se o fornecedor aprovar, a arte fica travada: para trocar, peça à Wellmix que reabra o item. Sempre que reprovar, volte a esta tela, leia o motivo, corrija e reenvie."
- 🔤 Na tela: `[ATENÇÃO]` "Arte aprovada: só a Wellmix reabre"; `[DICA]` "Dúvida na observação? Use Conversar com a Wellmix"; `[BOTÃO] "Conversar com a Wellmix"`.
- ✂️ Edição: cartão de resumo em tela cheia por 5 s.

**Cena 9 · 4:25–4:40 · Resumo e próximo vídeo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, a miniatura do AGE-05.
- 🎙 Narração: "Resumindo: acompanhe o prazo, informe o valor por item, leia o motivo da reprovação e reenvie a arte. Agora, o selo de certificação."
- 🔤 Na tela: `[RESUMO]` "1 Acompanhe o prazo · 2 Informe o valor por item · 3 Leia o motivo da reprovação · 4 Reenvie a arte"; chamada "Próximo: AGE-05 · Selo de certificação na arte".
- ✂️ Edição: fade para a vinheta de encerramento (3 s).

### Erros comuns

- **Erro:** valor por item inválido. O portal diz "Informe o valor por item como número maior que zero." → **Correção:** digite só o número (ex.: 12,50); deixe o campo vazio para apagar.
- **Erro:** trocar a arte já aprovada. "A arte já foi aprovada no pedido: para trocar, a Wellmix reabre o item pelo pedido." → **Correção:** peça à Wellmix para reabrir o item pelo pedido.
- **Erro:** enviar o documento do pedido para assinatura com a arte reprovada. A linha diz "Aguardando a arte da embalagem: o documento só vai para assinatura depois dela." e, se a ação chegar ao servidor, "Falta a arte da embalagem para enviar o documento para assinatura." → **Correção:** reenvie a arte primeiro.
- **Erro:** mexer num briefing encerrado ou de outro responsável. "Este briefing já foi encerrado (cancelado ou concluído)." ou "Só o responsável pelo briefing (ou a Wellmix) altera." → **Correção:** fale com a Wellmix.
- **Aviso (fornecedor):** o fornecedor só aprova depois da arte. Sem a arte ele vê "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar." → **Correção:** envie a arte (a aprovação só vira pendência depois dela).

### Passo a passo em texto

1. No briefing (**Pedidos → Embalagens**), confira o **Prazo** no alto e na lista. Perto do vencimento e quando atrasa, o portal manda um lembrete com o que falta.
2. Para informar o **Valor por item (agência)**, vá ao cartão **Observações (gráfica, fornecedor)**, digite o valor, escolha a **Moeda** (BRL, USD ou CNY) e clique em **Salvar observações**. Só a agência e a Wellmix veem.
3. Com o pedido criado, abra **Pedidos** e o pedido. A etapa **Arte e embalagem** mostra **Arte da embalagem** (sua) e **Aprovação da arte pelo fornecedor**.
4. Se o fornecedor reprovar, você recebe o aviso "Aprovação da arte pelo fornecedor reprovado, refaça" e a pendência **Arte do pedido**. Abra o pedido e leia a observação, no item **Arte da embalagem** (**Reprovado**).
5. Corrija a arte e clique em **Escolher arquivo** (ou **Tirar ou escolher foto**) no item. Nasce uma nova versão e a aprovação volta a **Pendente**.
6. Arte aprovada não se troca por aqui: peça à Wellmix para reabrir o item.

### Notas de gravação

- A reprovação é feita pelo fornecedor (`supplier.a@china.com`, tela em zh) no item "Aprovação da arte pelo fornecedor", com uma observação. Grave essa parte numa gravação separada do AGE-04 ou use o ponto de salvamento já reprovado; na tela da agência só aparece o resultado.
- Texto sugerido para a observação (não é texto do sistema): "Código de barras fora da área permitida; mover para a lateral e reenviar."
- A observação **permanece** na linha da arte depois do reenvio (a v3 mostra o texto da reprovação como se fosse a nota da nova arte). Se isso confundir, grave a cena 7 cortando o quadro antes da linha de detalhes.
- O prazo do briefing ("Prazo: 17/11/2026") e o prazo da etapa ("Prazo: 18/11/2026") mudam com o dia; não os cite na narração.
- Os valores de exemplo (12,50 BRL) são só de demonstração; não use valor real de agência.
- Ao salvar, o portal volta ao cartão "Observações" (âncora `#notes`) e o alerta verde "Salvo." fica **acima** da tela. Role até o topo para mostrá-lo na cena 4.
- O número exibido volta sem o zero final ("12,5") depois de salvar; mostre o campo cheio e depois salvo, sem ler o número em voz alta.

### Pontos a confirmar

- ⚠ **Texto estranho:** o aviso ao reprovar sai como "Pedido #1: Aprovação da arte pelo fornecedor reprovado, refaça" (concordância: "Aprovação … reprovado"). Confirmar se o texto deve mudar para "Arte reprovada pelo fornecedor, refaça".
- ⚠ **Possível erro:** a observação da reprovação continua gravada na linha da arte reenviada (a v3 mostra o motivo antigo ao lado do nome do arquivo). Confirmar se a nota deveria ser limpa ao reenviar.
- ⚠ O briefing "No pedido" ainda mostra "Excluir" na arte enquanto a etapa não abriu (só some quando a etapa está aberta ou concluída). Confirmar o que o dono espera da exclusão nessa fase.
- ⚠ A coluna "Tipo" das pendências mostra `stage.agency.art` para a pendência "Pedido #N: Arte e embalagem" (mesmo defeito do AGE-01).
- ⚠ O prazo do briefing e o lembrete usam valores das Configurações (`packagingBriefDueDays` 7 e `reminderDaysBeforeDue` 1 por padrão no código); a narração não cita números. Confirmar os valores de produção.
- ⚠ O valor por item é gravado na auditoria (`packaging_brief.agency_price`). A narração diz só que fica entre a agência e a Wellmix; confirmar se o dono quer citar a auditoria.
- ⚠ A mensagem "A arte ainda não foi enviada: o fornecedor aprova depois que ela chegar." é do lado do fornecedor; está listada aqui só para contexto. Não aparece na tela da agência.

---

## AGE-05 · Selo de certificação na arte

> **Promessa:** ao final do vídeo você sabe baixar o selo da certificadora, aplicá-lo na arte, enviar a arte com o selo e o que acontece quando a Wellmix confere ou recusa.

| Ficha                 |                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Série e papel         | Agência (quando é ela quem faz a arte; sem agência no pedido, a Wellmix)                                                              |
| Conta de gravação     | `agencia@design.com`, tela em pt                                                                                                      |
| Duração-alvo          | 4:10                                                                                                                                  |
| Ponto da jornada      | Etapa 5 de 9: Preparação (o selo corre em paralelo à arte)                                                                            |
| Telas e rotas         | `/app/tasks` (etapa "Selo na arte"), `/app/notifications`, `/app/orders/[id]#certification`, `/app/packaging/[id]`                     |
| Dados antes de gravar | Pedido criado e o selo já enviado pela certificadora (`ocp@certifica.com`, quadro "Memorial (selo)" do cartão Certificação). A arte já está no pedido. Ponto de salvamento `antes-AGE-05` com o selo enviado e "Selo aplicado na arte" ainda pendente |
| Depois deste vídeo    | A Wellmix valida (ou recusa); com a arte e o selo aplicado, a agência aperta "Enviar para assinatura"                                 |
| Antes · Próximo       | AGE-04 · (fim da série)                                                                                                               |
| Idiomas               | pt (base)                                                                                                                             |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/notifications`**

- 🎬 Imagem: a tela Notificações com o cartão "Sua vez": "Pedido #1: selo de certificação disponível — A certificadora enviou o selo de certificação. Baixe o selo no pedido, aplique na arte da embalagem e envie a arte com o selo."
- 🎙 Narração: "A certificadora enviou o selo. Agora a embalagem precisa dele: baixe o selo, aplique na arte e devolva. Veja como."
- 🔤 Na tela: `[TÍTULO]` "AGE-05 · Selo de certificação na arte"; `[ZOOM 150 %]` no cartão do aviso.
- ✂️ Edição: vinheta de 6,5 s antes; título em 2 s; música baixa para −28 dB.

**Cena 2 · 0:10–0:25 · Onde estou na jornada · `/app/notifications`**

- 🎬 Imagem: a mesma tela, com o mapa sobre ela.
- 🎙 Narração: "Todo pedido precisa de um selo de certificação. Ele corre ao lado da arte, na preparação, e a Wellmix confere no fim."
- 🔤 Na tela: `[MAPA etapa 5]` com "Preparação" acesa.
- ✂️ Edição: o mapa sai em 8 s.

**Cena 3 · 0:25–0:55 · Antes do selo: deixe o espaço · `/app/packaging/[id]`**

- 🎬 Imagem: o briefing "No pedido" com o alerta azul: "Selo de certificação: aguardando a certificadora. Deixe o espaço do selo na arte." e o link "Ver no pedido →".
- 🎙 Narração: "No briefing, enquanto a certificadora não manda o selo, o aviso pede que você deixe o espaço dele na arte. Quando o selo chega, o aviso muda: baixe no pedido, aplique na arte e envie a arte com o selo."
- 🔤 Na tela: `[PASSO 1/6] Deixe o espaço do selo na arte`; `[SETA]` "Aguardando a certificadora" no alerta; `[BOTÃO] "Ver no pedido →"`.
- ✂️ Edição: dois quadros do alerta (antes e depois do selo): "Selo de certificação disponível: baixe no pedido, aplique na arte e envie a arte com o selo." Ligue com `[CORTE]` de 200 ms.

**Cena 4 · 0:55–1:20 · A pendência do selo · `/app/tasks`**

- 🎬 Imagem: Minhas pendências: o quadrado "Selo na arte" fica amarelo, com o número 1. A linha "Aplicar o selo de certificação na arte: pedido #1", detalhe "Baixe o selo no pedido e envie a arte com o selo aplicado.", tipo "Selo na arte". Clicar em **Abrir**.
- 🎙 Narração: "Em Minhas pendências, o quadrado Selo na arte fica amarelo. A linha diz: Aplicar o selo de certificação na arte. Clique em Abrir. Ela leva direto ao cartão Certificação do pedido."
- 🔤 Na tela: `[PASSO 2/6] Abra a pendência Selo na arte`; `[BOTÃO] "Abrir"`; `[SETA]` "Selo na arte" no quadrado 3; `[ZOOM 150 %]` na linha.
- ✂️ Edição: `[CORTE]` seco para o pedido ao clicar.

**Cena 5 · 1:20–2:05 · Baixar o selo · `/app/orders/[id]#certification`**

- 🎬 Imagem: o cartão "Certificação" do pedido: "1 de 2 concluídos". O quadro do alto mostra "Selo" com o selo "Concluído" e o link "Arquivo". Abaixo, a tabela com as colunas "Passo", "Situação", "Quem faz / valida", "Informado", "Enviado por" e "Ação": "Selo — Concluído — Faz: OCP · valida: —" e "Selo aplicado na arte — Pendente — Faz: agência · valida: Wellmix — Depois de: Selo". O cursor clica no link "Arquivo" do selo.
- 🎙 Narração: "No cartão Certificação, a linha Selo está Concluída: a certificadora já enviou. Clique em Arquivo para baixar. A linha de baixo, Selo aplicado na arte, é a sua: você faz e a Wellmix valida."
- 🔤 Na tela: `[PASSO 3/6] Baixe o selo (link "Arquivo")`; `[SETA]` "Faz: OCP" na linha Selo; `[SETA]` "Faz: agência · valida: Wellmix" na linha da arte; `[QUEM VÊ]` "Você vê só as duas linhas do selo, não os passos de memorial, laudo e registro".
- ✂️ Edição: `[ZOOM 150 %]` na tabela; o arquivo do selo não precisa abrir em tela.

**Cena 6 · 2:05–2:50 · Enviar a arte com o selo · `/app/orders/[id]#certification`**

- 🎬 Imagem: na linha "Selo aplicado na arte", clicar em **Escolher arquivo** (campo do arquivo) e escolher `arte-com-selo-v1.pdf`. O nome do arquivo aparece ao lado do botão (em arquivo grande, a linha mostra "Arquivo pronto: {nome} ({tamanho}). Agora clique no botão para enviar."). Clicar em **Enviar**. A linha passa a "Enviado, aguardando validação", com "Enviado por: Agência Criativa · data".
- 🎙 Narração: "Aplique o selo na arte e envie o arquivo na linha Selo aplicado na arte. Escolha o arquivo e clique em Enviar. Se o arquivo for grande, espere o aviso de arquivo pronto. A situação vira Enviado, aguardando validação."
- 🔤 Na tela: `[PASSO 4/6] Envie a arte com o selo`; `[BOTÃO] "Enviar"`; `[SETA]` "Enviado, aguardando validação" no selo; `[ATENÇÃO]` "Arquivo grande: espere o aviso Arquivo pronto antes de clicar em Enviar".
- ✂️ Edição: `[CORTE]` na abertura do seletor; pausa de 2 s no selo "Enviado, aguardando validação".

**Cena 7 · 2:50–3:35 · A Wellmix confere (ou recusa) · `/app/orders/[id]#certification`, `/app/notifications`**

- 🎬 Imagem: a linha "Selo aplicado na arte" com a situação **Recusado** em vermelho e o texto "Recusado: O selo ficou pequeno demais; aumente e envie de novo", com o botão **Enviar de novo**. Em Notificações, o cartão "Sua vez": "Pedido #1: Selo aplicado na arte recusado — Motivo: …. Corrija e envie de novo." Depois, o reenvio e a linha **Concluído**, "validado por Ana Admin", e o alerta do briefing "Selo de certificação aplicado na arte e conferido."
- 🎙 Narração: "A Wellmix confere. Se recusar, ela escreve o motivo, e você recebe o aviso Selo aplicado na arte recusado. Corrija e clique em Enviar de novo. Quando a Wellmix valida, a linha fica Concluído, e o briefing mostra: Selo de certificação aplicado na arte e conferido."
- 🔤 Na tela: `[PASSO 5/6] Se recusarem, corrija e clique em Enviar de novo`; `[BOTÃO] "Enviar de novo"`; `[ERRO COMUM]` "Recusado: motivo escrito pela Wellmix"; `[DEPOIS]` "A Wellmix valida; a linha fica Concluído".
- ✂️ Edição: três quadros em sequência (recusado, reenvio, concluído) com `[CORTE]` de 200 ms.

**Cena 8 · 3:35–4:00 · Enviar para assinatura · `/app/orders/[id]`**

- 🎬 Imagem: na etapa "Arte e embalagem", o item "Documento do pedido enviado para assinatura" (Pendente, Agência) com o botão **Enviar para assinatura**. O cursor clica. O item passa a **Concluído** ("Enviado por: Agência Criativa"). Mostrar também, em quadro à parte, as mensagens de bloqueio "Aguardando o selo da certificadora aplicado na arte: o documento só vai para assinatura depois dele." e "Aguardando a arte da embalagem: o documento só vai para assinatura depois dela."
- 🎙 Narração: "Com a arte enviada e o selo aplicado, aparece Enviar para assinatura. Quem faz a arte aperta o botão. A Wellmix assina primeiro, e o fornecedor assina em seguida. Sem a arte ou sem o selo, o botão não aparece."
- 🔤 Na tela: `[PASSO 6/6] Clique em Enviar para assinatura`; `[BOTÃO] "Enviar para assinatura"`; `[DEPOIS]` "A Wellmix recebe o aviso para assinar; depois o fornecedor"; `[ATENÇÃO]` "Sem arte ou sem selo aplicado, o botão não aparece".
- ✂️ Edição: `[ZOOM 150 %]` no item e no botão; pausa de 1 s depois do clique.

**Cena 9 · 4:00–4:10 · Resumo**

- 🎬 Imagem: fundo vermelho com a lista; no fim, o logo da Wellmix (fim da série).
- 🎙 Narração: "Resumindo: baixe o selo, aplique na arte, envie e aguarde a conferência. Depois, envie o documento para assinatura."
- 🔤 Na tela: `[RESUMO]` "1 Baixe o selo · 2 Aplique na arte · 3 Envie em Selo aplicado na arte · 4 Corrija se recusarem · 5 Enviar para assinatura"; chamada "Fim da série AGE".
- ✂️ Edição: fade para a vinheta de encerramento (logo Wellmix, 3 s).

### Erros comuns

- **Erro:** a Wellmix recusa a arte com o selo. O passo fica **Recusado** e o aviso diz "Motivo: {motivo}. Corrija e envie de novo." → **Correção:** corrija a arte e use **Enviar de novo**.
- **Erro:** enviar a arte do selo antes de o selo existir. A linha "Selo aplicado na arte" fica com "Depois de: Selo" e a tela nem oferece o formulário; se a ação chegar ao servidor, a mensagem é "Conclua antes o passo anterior." → **Correção:** espere a certificadora enviar o selo.
- **Erro:** enviar sem arquivo. O portal diz "Envie o arquivo." → **Correção:** escolha o arquivo; se for grande, espere o aviso "Arquivo pronto: {nome} ({tamanho}). Agora clique no botão para enviar."
- **Erro:** passo já validado. "Este passo já foi validado." → **Correção:** não há mais o que enviar; se o selo foi trocado, o passo reabre sozinho.
- **Erro:** passo ainda não liberado no sistema. "Este passo ainda não está liberado no sistema. Avise a Wellmix e tente de novo depois." → **Correção:** avise a Wellmix (esquema do banco ainda não publicado).
- **Erro:** enviar o documento do pedido para assinatura sem a arte ou sem o selo aplicado. "Falta a arte da embalagem para enviar o documento para assinatura." ou "Falta o selo da certificadora aplicado na arte para enviar o documento para assinatura." → **Correção:** conclua os dois e tente de novo.
- **Aviso:** a certificadora trocou o selo. O passo da arte reabre com o texto "A certificadora trocou o selo (o arquivo ou o número). Aplique o selo atual na arte e envie a arte de novo." → **Correção:** baixe o selo novo, aplique na arte e envie de novo; o aviso é "Pedido #N: selo de certificação trocado".
- **Aviso:** arte feita pela Wellmix (configuração "Arte da embalagem feita pela agência" desligada). A agência só acompanha as linhas do selo e não envia a arte com o selo. → **Correção:** a Wellmix envia; nada a fazer.

### Passo a passo em texto

1. Quando a certificadora envia o selo, você recebe o aviso "Pedido #N: selo de certificação disponível" e a pendência **Aplicar o selo de certificação na arte** (etapa **Selo na arte**). Clique em **Abrir**.
2. No cartão **Certificação** do pedido, na linha **Selo**, clique em **Arquivo** e baixe o selo.
3. Aplique o selo na arte da embalagem.
4. Na linha **Selo aplicado na arte**, escolha o arquivo da arte com o selo (se for grande, espere o aviso "Arquivo pronto…") e clique em **Enviar**. A situação vira **Enviado, aguardando validação**.
5. A Wellmix confere. Se **recusar**, leia o motivo, corrija e clique em **Enviar de novo**. Se **validar**, a linha fica **Concluído**.
6. Com a arte enviada e o selo aplicado, na etapa **Arte e embalagem** clique em **Enviar para assinatura**. A Wellmix assina primeiro e o fornecedor depois.

### Notas de gravação

- Grave a certificadora enviando o selo em outra conta (`ocp@certifica.com`) antes do episódio; use o arquivo `selo-inmetro.png`, só de exemplo. O nome "Inmetro" é de exemplo de arquivo, não de regra de negócio do episódio.
- A cena 5 mostra o quadro do alto do cartão, que tem um texto dirigido à **certificadora** ("Memorial (selo): anexe aqui o selo e, se quiser, o memorial em PDF…"). A agência também o vê; deixe esse trecho fora do zoom ou explique que é a linha do selo da OCP (veja Pontos a confirmar).
- O campo de arquivo da linha "Selo aplicado na arte" é o botão nativo do navegador (nas capturas de automação aparece em inglês, "Choose File"; no Chrome em pt-BR, "Escolher arquivo"). A mensagem "Arquivo pronto…" só aparece quando o arquivo é grande e sobe direto ao armazenamento (acima de cerca de 3,5 MB, docs/IMPORT_FLOW.md); para arquivos pequenos o nome aparece ao lado do botão.
- A recusa e o reenvio (cena 7) vêm de duas contas (a Wellmix recusa com um motivo curto). Motivo usado na preparação: "O selo ficou pequeno demais; aumente e envie de novo" (sem ponto final: a mensagem do portal já termina com ponto).
- Para a cena 8, o item "Documento do pedido enviado para assinatura" só aparece na etapa "Arte e embalagem" aberta, com a arte concluída e o selo enviado.
- Esconda a faixa âmbar de demonstração e o seletor DEMO (guia, seção 7.3).

### Pontos a confirmar

- ⚠ **Texto estranho:** no cartão Certificação, a agência vê o quadro verde com o texto dirigido à certificadora ("Memorial (selo): anexe aqui o selo e, se quiser, o memorial em PDF. Ao enviar o selo…"). A agência não anexa o selo. Confirmar se esse quadro deve ficar escondido para a agência.
- ⚠ A frase da recusa sai com ponto duplicado quando o motivo termina em ponto ("Motivo: …. Corrija e envie de novo."). Texto do modelo: "Motivo: {motivo}. Corrija e envie de novo."
- ⚠ O aviso "Pedido #N: selo de certificação disponível" continua em "Precisa de você" mesmo depois de a agência ter enviado a arte. Conferir se o aviso deveria sair da lista sozinho.
- ⚠ No pedido, a agência vê muitos documentos (fotos da ficha do fornecedor, a faca, a arte, os arquivos da gráfica) na tabela "Documentos". O docs/CERTIFICATION.md diz que a agência vê "só as duas linhas do selo e os dois arquivos". Confirmar com o dono se a lista de documentos para a agência é a esperada (não há preço nos documentos vistos).
- ⚠ O botão "Enviar para assinatura" depende de a etapa "Arte e embalagem" estar aberta (docs/ORDER_SIGNATURE.md, seção 2c). Confirmar o momento exato em que a agência vê o botão na gravação.
- ⚠ Pedidos sem certificadora (ou com mais de uma ativa) ficam sem selo para a agência até a Wellmix designar a certificadora em "Parceiros do pedido" (docs/CERTIFICATION.md, seção 5). O roteiro assume a certificadora única ("Certificadora OCP") do seed.
