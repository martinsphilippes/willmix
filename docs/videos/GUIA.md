# Guia de produção dos vídeos explicativos

Como gravar, editar e publicar os vídeos que ensinam cada operador do Portal Wellmix. O índice dos vídeos, a ordem de gravação e as trilhas por papel estão em [README.md](README.md). Cada roteiro fica no arquivo da sua série (`01-…`, `02-…`) e segue o modelo da seção 5.

**Meta:** quem assistir entende de fato como usar o sistema, sem precisar de ninguém ao lado, e sente que a Wellmix é uma empresa grande e organizada. Para isso, cada vídeo mostra a tela real, passo a passo, com o texto na imagem e a mesma explicação por escrito.

## 1. Princípios

1. **Uma história só.** Todos os vídeos acompanham o mesmo produto, a **Jarra de vidro 1,5 L**, do pedido do cliente até a entrega (a "Jornada da Jarra", no README). Quem assiste vê a mesma jarra chegando na tela de cada papel; isso ensina o fluxo inteiro sem uma aula teórica.
2. **Tela real, nunca slide.** O sistema aparece de verdade, com zoom e destaque. Slides só para o mapa da jornada e para o resumo final.
3. **Um vídeo, uma tarefa.** Entre 2 e 5 minutos (máximo 6). Tarefa grande vira vários episódios com capítulos.
4. **Texto sempre na imagem.** Todo passo tem legenda na tela, o nome exato do botão entre aspas e a legenda de fala (SRT). Quem assiste sem som entende tudo.
5. **Explique o porquê e o depois.** Não basta "clique aqui": diga por que existe, o que acontece em seguida e quem é avisado.
6. **Mostre o erro comum.** Cada episódio tem de um a três erros frequentes, com a mensagem real que o sistema mostra.
7. **Honestidade.** Recurso em espera, manual ou de demonstração aparece como tal (seção 7.5). Nunca se mostra dado inventado como se fosse real.
8. **Cada papel vê só o seu.** O vídeo de um papel nunca mostra o que ele não vê (valores, outros fornecedores, margem). O que está escondido vira uma nota de roteiro ("o fornecedor não vê o cliente").

## 2. Idioma e conta de gravação

A tela do portal muda de idioma com o login (botões PT / EN / ZH). O texto que aparece na imagem muda junto, por isso **cada idioma pede uma gravação própria** do mesmo roteiro.

| Papel                          | Conta de gravação (senha `wellmix123`)  | Idioma da tela e da narração                                 |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| Cliente                        | `joao@lojista.com`                      | pt                                                           |
| Fornecedor                     | `supplier.a@china.com` (Li Wei)         | **zh** e **en** (`supplier.b@china.com`, Chen Yu, é a conta em inglês) |
| Agência                        | `agencia@design.com`                    | pt                                                           |
| Despachante                    | `despachante@comex.com`                 | pt                                                           |
| Companhia marítima             | `armador@maritima.com`                  | **en** (e zh, trocando o idioma no PT / EN / ZH)             |
| Transportador                  | `transportadora@rodo.com`               | pt                                                           |
| Jurídico                       | `juridico@wellmix.com`                  | pt                                                           |
| Comex, Agente de carga, OCP    | `comex@assessoria.com`, `agente@cargo.com`, `ocp@certifica.com` | pt             |
| Admin Wellmix                  | `admin@wellmix.com`                     | pt                                                           |
| Operador Wellmix (por função)  | `operador@wellmix.com` (comprador e planner) | pt                                                      |

- O roteiro-base é em **pt-BR**. Os episódios do fornecedor e da companhia marítima trazem também a narração e as legendas em **en** e **zh**.
- Os nomes de botões, menus e campos vêm **sempre do dicionário do sistema** (`src/i18n/dictionaries.ts` e `src/i18n/modules/*.ts`), na língua da gravação. Não traduza rótulo de tela à mão: copie o valor da mesma chave em `en` ou `zh`.
- Só existe um login interno de demonstração com função: `operador@wellmix.com` (comprador e planner). Para gravar os papéis de financeiro, diretorias, designer, cadastro e gerente de produto, **crie antes um login interno para cada um** e depois marque as funções dele em **Gestão → Equipe e divisões → Editar acessos** (docs/ACCESS.md). A tela de Equipe só marca funções e telas; ela **não cria login**. A tela de acesso ao portal, dentro de um cadastro, oferece o papel "Operador Wellmix" (o roteiro WGE-10 explica o caminho; ⚠ confirmar na primeira gravação).

## 3. Formato técnico

| Item              | Padrão                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Captura           | 2560 × 1440, ou 1920 × 1080 com o zoom do navegador em 125 %. Entrega em **1920 × 1080**; assim os zooms de 150 % a 200 % continuam nítidos. |
| Quadros           | 30 fps na gravação de tela; a vinheta de abertura é 60 fps                                                                              |
| Navegador         | Chrome em janela limpa (sem favoritos nem extensões visíveis), um **perfil por papel** já logado e no idioma certo                      |
| Cursor            | Anel de destaque e onda no clique, movimento lento com aceleração suave, pausa de 1 s depois de cada clique                              |
| Digitação         | Natural e visível; textos longos podem acelerar 2×, nunca cortar                                                                        |
| Voz               | −16 LUFS, sem ruído; música a −28 dB sob a voz (ducking), ausente nos trechos de formulário longo                                       |
| Duração           | 2 a 5 min por episódio (máximo 6). Capítulos marcados na descrição                                                                      |
| Ritmo da narração | pt-BR: 140 a 150 palavras por minuto (≈ 2,4 palavras por segundo). en: ≈ 150. zh: ≈ 240 a 270 caracteres por minuto (≈ 4 a 4,5 por segundo)  |
| Legenda de fala   | Branca com contorno, até 2 linhas. pt e en: até 42 caracteres por linha e 17 caracteres por segundo. zh: até 16 caracteres por linha e 9 por segundo. Mínimo 1,2 s na tela |
| Margens seguras   | 5 % em todos os lados; nenhum texto sobre o cursor nem sobre o campo em uso                                                              |
| Dispositivo       | Desktop, exceto o transportador e o fornecedor em campo, que podem ganhar uma versão em celular (Chrome emulando iPhone, sem o zoom do navegador) |

## 4. Identidade visual dos vídeos

- **Abertura (vinheta):** use o arquivo `wellmix-intro-desktop.mp4` (6,5 s, 1920 × 1080, 60 fps), o mesmo da abertura do portal. Guarde-o com os arquivos de edição; ele não fica no repositório por causa do tamanho. Depois dele, um cartão de título de 2 s.
- **Cores:** vermelho Wellmix `#BF2026` (cor do portal), branco, grafite `#17181C`. A abertura animada usa `#DF1A21`, um pouco mais vivo; use o da peça só na vinheta.
- **Fonte dos textos sobrepostos:** Montserrat 600 e 700 (a mesma da abertura); em chinês, Noto Sans SC.
- **Elementos de tela** (sempre os mesmos, em todos os vídeos). No roteiro aparecem assim:

| Marca no roteiro        | O que é                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `[TÍTULO]`              | Cartão de título em tela cheia, vermelho `#BF2026`, com o código e o nome do episódio (2 s)                        |
| `[MAPA etapa N]`        | Faixa da jornada no alto, com as 9 etapas e a etapa atual acesa (mostrar nos primeiros 8 s)                        |
| `[PASSO n/N] texto`     | Círculo vermelho com o número e o texto curto no rodapé central                                                    |
| `[BOTÃO] "Texto exato"` | Contorno vermelho no botão com um rótulo branco sobre fundo grafite, repetindo o nome do botão entre aspas         |
| `[SETA] texto`          | Seta e caixa de explicação apontando o campo, o selo ou a coluna                                                   |
| `[ZOOM 150 %]`          | Aproximação suave (600 ms, ease in-out) centrada no elemento; no máximo 200 %                                      |
| `[DICA]`                | Selo verde `#1F8F4D` com um atalho ou um jeito melhor de fazer                                                     |
| `[ATENÇÃO]`             | Selo âmbar `#B45309` com algo que o sistema recusa ou que não dá para desfazer                                     |
| `[ERRO COMUM]`          | Selo vermelho com o erro e a mensagem real do sistema, em seguida a correção                                       |
| `[QUEM VÊ]`             | Etiqueta pequena dizendo quem enxerga aquela informação ("só a Wellmix", "o fornecedor não vê")                    |
| `[DEPOIS]`              | Cartão curto de "o que acontece agora e quem é avisado"                                                            |
| `[RESUMO]`              | Lista final de 3 a 5 itens em tela cheia                                                                           |
| `[CORTE]`               | Corte seco ou transição de 200 ms; evite efeitos                                                                   |

## 5. Modelo de episódio

Todo episódio usa **exatamente** esta estrutura, para o editor e o narrador saberem onde procurar cada coisa.

````markdown
## CLI-02 · Fazer uma nova solicitação

> **Promessa:** ao final do vídeo você sabe pedir um produto e acompanhar a resposta da Wellmix.

| Ficha                 |                                                                    |
| --------------------- | ------------------------------------------------------------------ |
| Série e papel         | Cliente                                                            |
| Conta de gravação     | `joao@lojista.com`, tela em pt                                     |
| Duração-alvo          | 3:30                                                               |
| Ponto da jornada      | Etapa 1 de 9: Solicitação                                          |
| Telas e rotas         | `/app/requests`, `/app/requests/new`                               |
| Dados antes de gravar | o que já precisa existir (e qual episódio cria isso)               |
| Depois deste vídeo    | o que acontece e quem recebe aviso                                 |
| Antes · Próximo       | CLI-01 · CLI-03                                                    |
| Idiomas               | pt (base)                                                          |

### Roteiro

**Cena 1 · 0:00–0:10 · Gancho · `/app/requests`**

- 🎬 Imagem: o que aparece na tela e o que o cursor faz.
- 🎙 Narração: "Texto exato, no ritmo da seção 3."
- 🔤 Na tela: `[TÍTULO]` …, `[MAPA etapa 1]`, `[PASSO 1/6] …`, `[BOTÃO] "…"`
- ✂️ Edição: zoom, corte, pausa, som.

### Erros comuns

- **Erro:** mensagem exata do sistema → **Correção:** …

### Passo a passo em texto

1. Frase curta no imperativo, com o nome exato do botão.

### Legendas na tela em EN e ZH  (só nas séries com versão em outro idioma)

| Marca       | EN  | ZH  |
| ----------- | --- | --- |
| PASSO 1/6   | …   | …   |

### Notas de gravação

- Dados, atalhos e cuidados para repetir a mesma gravação.

### Pontos a confirmar

- ⚠ Tudo o que o roteirista não conseguiu confirmar no código ou na tela.
````

Regras do roteiro:

- **Tempo fecha com palavra.** O texto da narração de cada cena cabe no tempo da cena (2,4 palavras por segundo em pt). Cena de 10 s tem no máximo 24 palavras.
- **Gancho** (primeiros 10 s): mostra o resultado ou a dor, nunca "olá, neste vídeo vamos aprender".
- **Estrutura:** gancho → onde estou na jornada → passo a passo numerado → `[DEPOIS]` → erros comuns → `[RESUMO]` → chamada para o próximo vídeo.
- **Uma ação por cena.** Cada clique importante tem o nome exato do botão, a rota e o que muda na tela.
- **Nomes exatos.** Todo botão, menu, campo, selo e mensagem entre aspas é copiado do dicionário do sistema. Se o texto não existe no dicionário, é ⚠ confirmar.
- **Quem vê o quê.** Use `[QUEM VÊ]` toda vez que o papel tiver uma restrição (docs/ACCESS.md, docs/WORKFLOW.md).
- **Nada inventado.** Regra de negócio, prazo, tolerância ou valor vem do código ou dos documentos; se não der para confirmar, escreva ⚠ em **Pontos a confirmar**.

## 6. Tom e vocabulário

- **Voz:** calma, próxima e segura. Trate a pessoa por "você". Frases de até 20 palavras. Imperativo gentil ("Clique em", "Escolha", "Confira"). Explique o porquê antes do clique.
- **Sem jargão solto.** A primeira vez que aparecer uma sigla, diga o que é ("RFQ, o pedido de cotação"). Depois use só a sigla.
- **Pronúncia de "Wellmix":** combine uma vez com a marca e mantenha igual em todos os vídeos e nas vozes de todos os idiomas.
- **Boas-vindas curtas:** o gancho vem antes do nome do papel. Quem é o apresentador (voz humana ou sintética de boa qualidade) é uma decisão de produção; o roteiro vale para os dois.

### Glossário fixo (diga sempre do mesmo jeito)

| Termo                | Como explicar em uma frase                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Solicitação          | O pedido de um produto: o que, quanto e até quando. Nasce do cliente (ou da Wellmix por ele) e acompanha a compra até virar pedido.    |
| Cotação              | A resposta do fornecedor com preço, prazo e pedido mínimo.                                                                           |
| RFQ                  | O pedido de cotação enviado ao fornecedor. Hoje vai a **um fornecedor por produto**; a disputa entre vários está em espera (docs/RFQ_STANDBY.md). |
| Proposta             | O preço e as condições que a Wellmix oferece ao cliente.                                                                             |
| Sinal                | A entrada paga pelo cliente para o pedido nascer. A Wellmix confirma o pagamento à mão.                                              |
| Pedido               | A solicitação aprovada e paga. Tem etapas, cada uma com requisitos e um responsável.                                                 |
| Etapa e requisito    | A etapa é um passo da jornada; o requisito é cada coisa que alguém precisa fazer nela. Cumpridos todos os obrigatórios, a próxima etapa abre sozinha. |
| Pendência            | O que está esperando por você agora. Aparece em Pendências com o botão para abrir.                                                   |
| Booking              | **A lista de produtos de uma planilha do fornecedor**, na Wellmix, antes de existir solicitação. Não confundir com a reserva no navio: nos vídeos de embarque diga sempre "reserva no navio". |
| Seleção de itens     | Tela da Wellmix que compara itens parecidos de vários bookings e abre a solicitação ao fornecedor do melhor.                         |
| Ficha de compra      | A ficha técnica que o fornecedor preenche (preço, caixa, pesos, medidas, programação e fotos).                                        |
| Die cut (faca)       | O molde da caixa. Só o fornecedor escolhido o envia, depois da cotação.                                                              |
| Briefing de embalagem| O pedido de arte e faca à agência (ou ao marketing da Wellmix), aberto junto com a cotação.                                          |
| Inspeção cega        | A inspeção em que o inspetor informa o que encontrou sem ver o valor esperado; o sistema compara com a ficha congelada no pedido.    |
| Fila de revisão      | Onde caem as divergências (peso, medidas, certificação) que a Wellmix precisa decidir.                                                |
| BL                   | Conhecimento de embarque: o documento do transporte marítimo.                                                                        |
| DI e desembaraço     | Declaração de importação e a liberação da carga na alfândega.                                                                        |
| Numerário            | O valor em reais que a assessoria de comex pede para cobrir os custos do desembaraço; o financeiro da Wellmix valida e paga (docs/IMPORT_FLOW.md). |
| NCM                  | Código fiscal do produto, usado nos impostos (II, IPI).                                                                              |
| CODPROD              | O código do produto no Sankhya, o ERP da Wellmix.                                                                                    |
| Superplan            | A análise de viabilidade de um produto (custo do container, preço mínimo e lucro). Só o administrador.                               |
| Control Tower        | O painel de comando da Wellmix: o pedido de ponta a ponta, em quadrados por etapa.                                                    |
| SLA                  | O prazo combinado para cada resposta ou etapa.                                                                                       |

## 6.1 As 9 etapas da jornada (mapa `[MAPA]`)

Use sempre estas nove marcas, na mesma ordem, no mini mapa e nas aberturas de episódio. Elas agrupam os estados reais do sistema (docs/WORKFLOW.md).

| N   | Marca no mapa           | O que reúne                                                                                   |
| --- | ----------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Produto e Booking       | Planilha do fornecedor, seleção de itens, solicitação ao fornecedor, produto na vitrine        |
| 2   | Solicitação             | O cliente pede (vitrine ou formulário)                                                         |
| 3   | Cotação                 | Fornecedor responde; Wellmix compara, define o preço ao cliente e envia a proposta             |
| 4   | Sinal e pedido          | Cliente paga o sinal, a Wellmix confirma, o pedido nasce e é conferido (Sankhya)               |
| 5   | Preparação              | Ficha de compra, arte e embalagem, assinatura do pedido                                        |
| 6   | Inspeção                | Fotos, peso e medidas na fábrica; comparação com o que foi comprado                            |
| 7   | Embarque e mar          | Reserva no navio, embarque, documentos                                                         |
| 8   | Desembaraço e transporte| Alfândega, liberação, caminhão até o cliente                                                   |
| 9   | Entrega e pós-venda     | Recebimento, avaliação, comprar de novo                                                        |

O pagamento ao fornecedor corre **fora** do fluxo do pedido (docs/WORKFLOW.md): mostre-o como um selo "paralelo" nas etapas 4 a 9, nunca como uma etapa.

## 7. Ambiente e dados de gravação

### 7.1 Servidor

Grave sempre contra **o build de produção**, nunca contra `next dev`: o modo de desenvolvimento mostra o selo "N · 1 Issue" do Next.js na tela e é lento.

```bash
npm ci && npm run build
DATA_MODE=memory DATA_DIR=.data-video npx next start -p 3200
# abrir http://localhost:3200/login?intro=off
```

Na primeira visita a `/login` o banco vazio ganha a carga inicial e as contas de demonstração (docs/AMBIENTE.md).

### 7.2 Pontos de salvamento (voltar a um ponto da história)

O modo memória grava tudo em `DATA_DIR`: `db.json` e a pasta `files/`, lidos quando o servidor sobe. Para repetir uma tomada:

```bash
# antes de gravar o episódio
cp -r .data-video snapshots/antes-CLI-02
# para repetir: parar o servidor, restaurar e subir de novo
rm -rf .data-video && cp -r snapshots/antes-CLI-02 .data-video
DATA_MODE=memory DATA_DIR=.data-video npx next start -p 3200
```

Grave a Jornada da Jarra **em ordem** (README), guardando um ponto de salvamento antes de cada episódio.

### 7.3 Tirar o que denuncia "demonstração"

No modo memória o portal mostra uma faixa âmbar ("Modo demonstração: dados em memória…") e, no cabeçalho, o seletor **DEMO** de contas. Esconda os dois durante a gravação com este estilo (testado), colado no Stylus ou injetado pelo Playwright:

```css
header label:has(> select) { display: none !important; }
div.bg-amber-100.text-amber-900 { display: none !important; }
/* Só na tela de login: o quadro "Contas de demonstração" com e-mails e senha */
form + div.border-dashed { display: none !important; }
```

As duas primeiras regras escondem o seletor DEMO e a faixa âmbar nas telas do portal; a terceira esconde o quadro de contas de demonstração do `/login` (a senha comum aparece ali). Sem ela, o vídeo GER-01 mostraria as contas e a senha.

Sem o seletor, troque de papel abrindo **outro perfil do Chrome** já logado, ou saindo e entrando de novo (o vídeo de "Primeiros passos" mostra o login de verdade).

### 7.4 Abertura animada

A abertura do portal toca na primeira abertura do dia e ao dar F5 em `/app` ou `/login` (docs/ARQUITETURA.md, seção 6). Nas gravações dos tutoriais, entre por `/login?intro=off` e, se precisar, grave no localStorage `wellmix-intro-day` com a data de hoje (`AAAA-M-D`). Só o vídeo GER-01 mostra a abertura de propósito.

### 7.5 Dados de cena (o que precisa existir para a tela ficar bonita)

A carga de demonstração é mínima: quatro produtos **sem foto e sem preço** ("Sem foto", "Preço sob consulta"). Antes da primeira gravação, prepare o cenário:

| Item                       | Como deixar                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fotos dos produtos         | 2 a 3 fotos limpas por produto (própria, comprada ou gerada; nunca imagem de terceiros nem de outra marca), em Produtos → ficha |
| Preços na vitrine          | Para o preço estimado aparecer, o produto precisa de preço do fornecedor, câmbio da moeda, frete marítimo por CBM (Configurações), caixa master e CBM, II e IPI pelo NCM e ICMS (Configurações). O aviso "Para o preço aparecer, falta:" lista exatamente o que falta |
| Nome das empresas          | Mantenha os nomes da carga: empresas Loja do João Ltda, Shenzhen Supplier A, Guangzhou Supplier B, Agência Criativa, Comex Despachos, Marítima SA, Trans Rodo (Diego Despachante é o **nome da pessoa** no login do despachante, não o da empresa) |
| Fornecedor com condição de pagamento | Shenzhen Supplier A já vem com 30 % no pedido e 70 % 90 dias após a entrega                                          |
| Planilha de booking de exemplo | Um `.xlsx` com 6 a 10 itens e a **jarra** entre eles, com as colunas de docs/BOOKING.md (seção 0). O cabeçalho pronto está em `tests/e2e/booking-supplier-request.spec.ts` (`HEADER`: DATE, LOCAL, SUPPLIER NAME, SKU/FACTORY ITEM CODE, DESCRIPTION, FOB/EXW, …). A planilha `tests/fixtures/produtos-china.xlsx` é uma planilha em chinês da **importação de cadastros** (Cadastros → Importar), outro fluxo, não um booking |
| Idioma de cada conta       | Confira o idioma de cada login antes de gravar (seção 2)                                                                  |

**Recursos em espera ou manuais. Não apresente como ao vivo:**

| Recurso                               | Estado                                                                              | O que fazer no vídeo                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Busca por foto ou link (Nova solicitação) | Pausada ("aguarda Cartão de Crédito" no card da tela)                          | Mostre o card em uma frase ("em breve") ou deixe fora do episódio                      |
| RFQ com vários fornecedores           | Em espera (docs/RFQ_STANDBY.md); hoje a solicitação vai a um fornecedor             | Ensine o caminho de **um fornecedor** (Pedidos → RFQ, "Enviar ao fornecedor")          |
| Sourcing                              | Em espera, com interruptor do administrador                                          | Só cite; o episódio do administrador mostra o interruptor                              |
| E-mail e WhatsApp                     | Mock: só o sino do portal avisa de verdade                                           | Mostre o sino e as Notificações; não prometa e-mail nem WhatsApp                       |
| Sankhya                               | Manual: o CODPROD é digitado e fica "não conferido" sem credencial                   | Mostre o campo e explique que a conferência com o ERP vem com a integração              |
| Pagamento do sinal                    | Manual: a Wellmix confirma que recebeu                                               | Diga "a Wellmix confirma o recebimento"; não mostre gateway                            |

## 8. Fluxo de produção de cada episódio

1. **Preparar:** conferir a ficha do roteiro, restaurar o ponto de salvamento, abrir o perfil do papel no idioma, esconder a faixa e o seletor (7.3).
2. **Ensaiar:** executar a cena uma vez sem gravar, no ritmo da narração.
3. **Gravar a tela** cena por cena (tomadas curtas), sem narração. Repetir erros de cursor sem cortar.
4. **Gravar a narração** em arquivo separado, lendo o texto da cena, no ritmo da seção 3.
5. **Editar:** vinheta → título → mapa → cenas → `[DEPOIS]` → erros comuns → `[RESUMO]`. Aplicar os elementos de tela da seção 4 na ordem do roteiro.
6. **Legendar:** exportar o SRT da narração por idioma (limites da seção 3).
7. **Revisar** com a lista da seção 9.
8. **Publicar** (seção 10) e marcar o episódio como concluído no README.

## 9. Lista de qualidade (antes de publicar)

- [ ] Todo botão, campo, menu e mensagem aparece **igual** ao da tela (sem erro de acento ou de caixa).
- [ ] O nome do botão está entre aspas na legenda toda vez que o clique é mostrado.
- [ ] Não aparece dado real, e-mail pessoal, chave, senha nem a faixa de demonstração.
- [ ] O vídeo mostra só o que aquele papel vê (conferir contra docs/ACCESS.md).
- [ ] Os termos seguem o glossário da seção 6 e "booking" nunca aparece com o sentido de "reserva no navio".
- [ ] A narração cabe no tempo de cada cena (2,4 palavras por segundo); a legenda de fala respeita os limites.
- [ ] Sem som, o vídeo ainda se entende (legendas na imagem em todos os passos).
- [ ] Contraste das legendas sobre a tela ≥ 4,5:1; nada pisca mais de 3 vezes por segundo.
- [ ] O `[DEPOIS]` diz quem é avisado e onde (sino, Pendências).
- [ ] Os erros comuns usam a mensagem real do sistema.
- [ ] A versão em en e zh foi revisada por quem fala o idioma (nome do botão conferido na tela do próprio idioma).
- [ ] O **Passo a passo em texto** foi publicado junto, na descrição ou na ajuda.

## 10. Entrega e publicação

- **Nome do arquivo:** `WM-<SÉRIE>-<NN>_<slug>_<idioma>_v<versão>.mp4`, por exemplo `WM-CLI-02_nova-solicitacao_pt_v1.mp4`. Legenda: o mesmo nome com `.srt`. Texto de apoio: o mesmo nome com `.md`.
- **Miniatura:** 1280 × 720, fundo vermelho `#BF2026`, o código do episódio, o título curto e a conta do papel.
- **Descrição:** a promessa, os capítulos com horário (um por cena de passo) e o link do próximo episódio.
- **Onde:** uma lista de reprodução por papel (Cliente, Fornecedor, Agência…). Quando o link de cada vídeo estiver definido, anote no README e, em uma próxima etapa, coloque o botão "Assistir vídeo" na tela correspondente do portal.
- **Texto:** o "Passo a passo em texto" de cada episódio é o artigo de ajuda do mesmo tema; publique os dois juntos.

## 11. Manter os vídeos atualizados

O sistema muda toda semana. Cada episódio lista as **rotas que cobre** na ficha. Quando um PR mudar uma dessas telas, o episódio entra na lista "Regravar" do README. Antes de gravar de novo, confira os documentos citados em cada série (`docs/WORKFLOW.md`, `docs/ACCESS.md`, `docs/BOOKING.md`, `docs/SUPPLIER_REQUESTS.md`, `docs/QUOTE_FLOW.md`, `docs/ORDER_SIGNATURE.md`), porque as regras de negócio também mudam (por exemplo, a RFQ em espera).
