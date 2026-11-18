# Progresso do treinamento em vídeo · Portal Wellmix

Ao retomar uma sessão, leia este arquivo primeiro. Depois, `00-mapa-de-papeis.md`.

## Revisão de 18/11/2026: roteiros acertados para o portal de hoje

Pedido do dono (18/11/2026): "corrija e reflita tudo" para as telas de hoje. Base: `wellmix` em 7f6352b (PR #565). Feito nos roteiros e no caminho de dados do Fornecedor (9 módulos), da Agência de arte (3) e da Certificadora (2); as fontes estão no repositório (PR deste ramo, que substitui o rascunho #535). **Os vídeos, as legendas e as páginas publicadas ainda são os de 15 a 17/11**: falta narrar, regravar, montar, auditar e empacotar de novo (quem tem as gravações e as vozes: as sessões que publicaram as páginas).

O que mudou no portal e como ficou o treinamento:

| Mudança no portal | Onde | O que mudou aqui |
| --- | --- | --- |
| "Abrir" virou ícone sem texto (`OpenLink`, `a[data-open-link]`, PR #561) | Pendências, Mesa de trabalho, todas as tabelas | `abrir_na_linha` aponta para o ícone; falas, resumos, "Sua vez" e quizzes dizem "ícone de abrir" (48 cenas) |
| Solicitações ao fornecedor sem o nome do produto e com as abas "Em negociação" e "Encerradas" (PRs #561 e #559) | Fornecedor M2; preparo de dados | cenas acham a linha pelo número (`linha_solicitacao`, `numero_da_solicitacao`); fala da lista com Produtos, Programações e as abas; o preparo procura nas duas abas e gera o pedido de compra na aba "Encerradas" |
| Pedidos com Produtos (contagem) e "Com quem está" (PRs #561 e #565) | Fornecedor M8 | fala da lista |
| Marcos do pedido no lugar da tabela "Etapas do pedido" | Fornecedor M5 e M8 | falas e alvos por `#order-stages`, `[data-order-part]`, `[data-milestone-details]` |
| Aprovações do mapa travam o marco seguinte e o marco Certificação exige o "Selo aplicado na arte" (Fase 5g) | caminho de dados do Fornecedor e dos extras | `confirmarAprovacoes`, `enviarSeloAplicado`, `decidirSeloAplicado` (`_demo/preparo-pedido.mjs`); problema 026 |
| Aceite do pedido de amostras chega como uma segunda linha "Assinar o pedido" | Fornecedor M4 e M9 | alvo pelo destino da linha; falas, "Sua vez" e quiz; problema 003 |
| Depois do sinal a pendência é "Inspeção" (não "Produção e inspeção") e o cartão Produção não gera pendência | Fornecedor M5 | falas e alvo; problema 025 |
| Inspeção por SKU só no cartão Produção do pedido (a tela do passo virou lista com "Resolver") | preparo de dados | `inspecionarSku` usa a página do pedido |
| A certificadora não abre o documento do pedido (dono, 15/11/2026: tem o preço de compra) | Certificadora M1 | saiu o passo "Abrir o documento"; quiz q6 e f5 refeitos |
| Pendências do fornecedor "do Book até a Invoice" | Fornecedor M1 | fala de abertura das Pendências e retorno do quiz |
| Itens do pedido com peças por caixa e caixas | Certificadora M1 | fala do quadro "Itens do pedido" |

Conferência: `gravar.mjs --so-ensaio` em todas as cenas dos três papéis contra o portal de 7f6352b, com os dados refeitos do zero (`preparar-fornecedor-m1.mjs`, `caminho-fornecedor.mjs`, `caminho-fornecedor-extras.mjs exw` e `prog`, `caminho-arte-certificacao.mjs`).

Próximos passos, na sessão que tem as gravações: `juntar_cenas.py` → `narrar.py` → `gravar.mjs` → `montar.py` → `auditar.py` → `empacotar.py --artefato` (gera de novo `index.html`, `assets/dados.js` e `guia-rapido.html`) → `testar_pacote.mjs` → publicar na mesma página. Rodar os caminhos de dados no dia da gravação (as datas são do dia).

## Onde estamos

**Fornecedor: Módulo 1 aprovado ("do treinamento gostei"); em produção os módulos 2 a 7 e o avançado, tudo de uma vez, com parada só no fim do papel (decisão do dono, 15/11/2026).** Voz: Piper · Faber. Segue aberta a pergunta sobre guardar o trabalho (commit e push só com a palavra do dono).

| Etapa | Situação |
| --- | --- |
| 0 · Reconhecimento | feito: `00-mapa-de-papeis.md`, `_recon/` |
| 1A · Voz | escolhida: Piper · Faber (`_config/voice.config.json`) |
| 1B · Pipeline | completo: captura, narração, cartões, zoom, montagem, legendas, player com pausa "Sua vez", simulação clicável, quiz, guia rápido, auditoria e teste do pacote |
| 2 · Papéis | Fornecedor em andamento: Módulo 1 entregue, aguardando aprovação |

## Status por papel

| Ordem | Papel | Módulos | Situação |
| --- | --- | --- | --- |
| 1 | Fornecedor (o dono mandou começar por ele, em português) | 7 + avançado | M1 entregue, aguardando "aprovado" |
| 2 | Comprador (com a trilha comum da equipe) | COM-1 a 4, PN-1 a 7, PE-2, PE-3, PR-1 a 3, EN-1 a 3, VE-1, CA-1, CA-2 | aguardando |
| 3 | Planner | 2 próprios | aguardando |
| 4 | Cadastro e Gerente de produto | 3 próprios + PE-1, CA-3 | aguardando |
| 5 | Administrador | 7 próprios | aguardando |
| 6 | Designer, Financeiro, Comex interno, Diretorias | 8 próprios | aguardando |
| 7 | Agência de arte, OCP, Despachante, Comex (assessoria) | 9 | aguardando |
| 8 | Companhia marítima, Agente de carga, Transportador, Agência de marketing, Jurídico | 7 | aguardando |
| 9 | Cliente | 1 | esperar a vitrine abrir |

## Decisões tomadas (técnicas, minhas)

- **Ambiente de gravação:** portal compilado (`next build` + `next start`) na porta 3200, em modo memória (`DATA_MODE=memory`, dados em `_demo/.data-treino`), com as contas de demonstração do próprio portal. O servidor sobe sem nenhuma variável de Supabase, Appwrite, Sankhya ou IA: não fala com produção nem com serviço externo. E-mail e WhatsApp já são simulados pelo portal; pagamento é registro manual.
- **Dados repetíveis:** pontos de salvamento da pasta de dados (`_demo/snapshots/`). Cada cena declara de que ponto parte; o gravador restaura e reinicia o servidor antes.
- **Captura:** Chromium em tela cheia numa tela virtual (Xvfb) de 2560×1440, gravada pelo ffmpeg (x11grab) a 30 qps sem perdas, e reduzida para 1920×1080 na montagem. A gravação nativa do Playwright borra o texto. Medido: 780 quadros em 26,0 s, nenhum perdido.
- **Duas passadas por cena:** ensaio sem cabeça (valida os passos, tira as telas paradas e as caixas dos alvos para a simulação) e gravação em tempo real no ritmo da narração.
- **Sincronia:** áudio primeiro. A narração de cada passo é sintetizada e medida; a gravação registra o instante real de cada passo e a montagem põe a fala nesse instante. O destaque e o clique podem ser presos à palavra falada (tempos por palavra vêm do STT).
- **Didática na página:** cursor desenhado, destaque com rótulo numerado e onda no clique são injetados no navegador da gravação. O indicador "Passo N de M", o zoom e os cartões entram na montagem.
- **O que escondo na gravação:** só o que denuncia o modo demonstração e não existe em produção (faixa âmbar, seletor DEMO, quadro de contas no login). O convite "Instale o aplicativo" entra como já dispensado ("Agora não") e a abertura animada como já vista no dia.
- **Marca:** logo, cores e a fonte Geist tirados do repositório (`_config/marca.json`).
- **Voz:** quatro motores instalados e medidos nesta máquina (4 núcleos, sem GPU). Fichas em `_config/amostras-voz/FICHAS.md`.
- **Conferência da voz:** cada fala é transcrita com faster-whisper local e comparada, palavra a palavra, com o roteiro já normalizado.

## Cuidados

- **O contêiner da sessão é passageiro.** Sem commit e push (regra do dono), tudo o que está em `treinamentos/` some se a sessão for reciclada. Pergunta feita na PARADA A.
- **Disco:** a captura sem perdas pesa cerca de 170 MB por minuto. Depois de montar cada cena, o arquivo bruto pode sair (o MP4 da cena fica). Livre em 14/11: 17 GB.
- **Chatterbox** troca ou acrescenta uma palavra de vez em quando (modelo generativo). A conferência por STT pega; refaço a frase com outra semente.

## Como o dono ouve as amostras

- A página `PARADA-A-vozes.html` (áudio embutido) não tocou no aplicativo dele (14/11/2026).
- Publiquei as amostras como página privada no claude.ai (`_config/amostras-voz/ouvir.html`, https://claude.ai/artifact/UqGUKu46XUzxkZzp44Gn3E) e enviei `_config/amostras-voz/amostras-de-voz.mp4` (as sete vozes em sequência). Se ele pedir, apago a página.
- Para as próximas entregas com áudio: mandar sempre também em MP4.

## Decisões do dono

- 14/11/2026: Wellmix se pronuncia UÉLMIX (definitivo).
- 14/11/2026: **rodada 1 de vozes reprovada** ("a voz não está brasileira, horrível"). Kokoro, Supertonic e o Chatterbox com referência não brasileira ficam fora. A voz tem de soar brasileira de verdade.

## Voz escolhida e vídeo de avaliação (14/11/2026)

- **Voz do treinamento: número 1 da rodada 2, Piper · Faber** (`_config/voice.config.json`, velocidade 0,88). Vale para todos os papéis.
- O dono pediu um vídeo de um processo complexo para avaliar antes de seguir. Entregue: `_avaliacao/video-de-avaliacao-do-book-a-solicitacao.mp4` (4 min, 1080p), com `roteiro.md` e `modulo-1.pt-BR.vtt`. Processo: importar o book, conferir e fechar, Seleção de itens, abrir a solicitação ao fornecedor (papel Comprador, conta `operador@wellmix.com`).
- Dados: planilhas fictícias em `_demo/planilhas/`; preparo em `_demo/preparo.mjs`; pontos de salvamento `aval-base`, `aval-s1` a `aval-s4`.
- Auditoria feita: um quadro por passo conferido, −16,4 LUFS, pico −3,8 dBTP, 7.212 quadros em 240,4 s (30 qps), legendas sem sobreposição, um único trecho de 2,8 s sem fala (digitação).
- **Aguardando a avaliação do dono** (tom, ritmo, visual). Nenhum papel começa antes disso.

### O que aprendi nesta rodada

- O servidor de treino roda em UTC, como a Vercel: com o fuso de São Paulo no servidor, a data da planilha aparecia um dia antes.
- O Piper pronuncia certo, mas o reconhecedor de fala troca "clica" por "clique" e "fechar" por "fichar". Conferi pelos fonemas e registrei as equivalências em `pronuncias.json`. Frases que ele entende mal de verdade eu reescrevo.
- Pronúncias a confirmar com o dono depois de ouvir: "book" sai "búqui", "Superplan" sai "superplã", "SLA" e "NCM" são soletrados.
- Campo de arquivo aparece como "Escolher arquivo" porque o navegador da gravação está em português.
- `montar.py --cena X` refaz só a cena X e reaproveita as outras.

## Primeiro papel: Fornecedor, em português (decisão do dono, 15/11/2026)

O dono mandou seguir "do login do fornecedor, do processo de book em diante", com os vídeos primeiro em português. O vídeo de avaliação não recebeu correção. A trilha, na ordem do processo:

| Módulo | Conteúdo | Situação |
| --- | --- | --- |
| M1 · Entrar, Pendências e o book | Boas-vindas, tour (login, idioma, menu), Pendências, enviar o book de um convite, avisos e mensagens | **entregue em 15/11, aguardando "aprovado"** |
| M2 · Solicitação: responder e negociar | Aprovar, renegociar, recusar; contraproposta; conversa | a fazer |
| M3 · Amostragem | Fotos e vídeos da amostra | a fazer |
| M4 · Pedido de compra | Die Cut, pedido de amostras, contrato, confirmar pagamento | a fazer |
| M5 · Produção e inspeção | Fotos, peso, vídeo, declaração, ETD | a fazer |
| M6 · Amostras e container na origem | Retirada, envios, container, lacre, porto | a fazer |
| M7 · Documentos de carga | Check list, packing list, invoice | a fazer |
| Avançado | Lançar book próprio (só com a tela Book), EXW, certificações, programação | a fazer |

Conta de gravação: `supplier.a@china.com` (Shenzhen Supplier A), com o idioma da tela em português (cookie `wm_locale`). Outros idiomas ficam para depois.

### Módulo 1 do Fornecedor: o que foi entregue (15/11/2026)

- **Arquivos** em `fornecedor/`: `modulo-1.mp4` (4 min 47 s, 1080p, 30 qps), `modulo-1.pt-BR.vtt` (legendas), `roteiro.md`, `cenas.json`, `quiz.json`, `index.html` + `assets/` (player), `guia-rapido.html`.
- **Conteúdo:** 6 capítulos (Boas-vindas; 1 Entrar e se localizar; 2 Suas pendências; 3 Enviar o book de um convite; 4 Avisos e mensagens; Resumo), 3 pausas "Sua vez", 3 práticas clicáveis, 10 perguntas (6 de cenário, 3 de clicar no lugar certo, 1 de ordenar), nota de corte 80%.
- **Dados:** `_demo/preparar-fornecedor-m1.mjs` monta tudo do zero (dois books fictícios, uma solicitação, um convite de book) e salva o ponto `forn-m1-base`. As datas são do dia da gravação: se for regravar em outro dia, rode o preparo de novo.
- **Verificação:** um quadro por passo conferido; −16,5 LUFS, pico −4,1 dBTP; 8.619 quadros em 287,4 s (30 qps); um único silêncio acima de 2,5 s (2,7 s, digitação do login); narração transcrita igual ao roteiro em todas as falas; pacote testado em três modos (direto do disco, servidor com Range, servidor sem Range), 73 conferências, nenhuma falha.
- **Teste do aprendiz:** um agente que recebeu só a transcrição acertou as 7 perguntas de texto, todas com apoio em frase do vídeo. Das observações dele entraram no vídeo: explicar o nome "book concorrente", dizer que o modelo é o do book de sempre (colunas listadas na tela), o que fazer com a moeda e o que acontece depois do envio (vem uma solicitação).
- **Página de teste para o dono:** https://claude.ai/artifact/HyAyhfxNgrQt24C8PsjEEp (privada; vídeo em 720p por causa do limite de 15 MB por arquivo). Gerada por `empacotar.py <papel> --artefato` em `fornecedor/_build/artefato/`. Para atualizar, publicar de novo o mesmo arquivo.

### O que aprendi no Módulo 1

- **Erro comum vai em cena própria, depois da demonstração limpa.** Na primeira montagem o erro da planilha ficava no meio da demonstração e a tela da prática aparecia com a mensagem de erro sem o aprendiz ter errado. Agora: demonstração (`c2-convite`), depois "Cuidado" (`c2-cuidado`, com `sim: false`, partindo do mesmo ponto de salvamento e abrindo o convite em `inicio.antes`), depois "Sua vez". É a ordem do método.
- **O ensaio usa o navegador completo** (`channel: "chromium"`), não o "headless shell", que só traz inglês: sem isso a tela parada da prática mostrava "Choose File" e o vídeo, "Escolher arquivo".
- **Piper e o som "cl":** "clique" logo depois de vírgula foi ouvido como "fique" pelo reconhecedor. Onde aconteceu, troquei por "use o botão". "Segue" foi ouvido como "cede"; reescrevi a frase.
- **Player em servidor simples:** servidor que não atende Range (como o `python -m http.server`) não deixa saltar de trecho. O player testa isso e, se for o caso, baixa o vídeo inteiro e toca da memória.
- **Notificação gerada no idioma da conta:** a conta do fornecedor de demonstração nasce em chinês; o preparo troca para português antes de a Wellmix criar os avisos.
- `empacotar.py` apaga as telas paradas que sobraram de versões anteriores do roteiro.
- As etapas "Ficha de compra" e "Aprovar a arte" da faixa de Pendências existem hoje no portal (não são sobra); entram no Módulo 4.

## Rodada 2 de vozes (entregue em 14/11/2026)

Só falantes brasileiros ou modelos ajustados para o português do Brasil (`_pipeline/rodadas.py`):

| Nº | Voz | Velocidade aqui | Conferência |
| --- | --- | --- | --- |
| 1 | Piper · Faber (masc., dados CC0) | 0,04× | "clica" ouvido como "clique" |
| 2 | Piper · Cadu (masc., dados CC0) | 0,04× | marca ouvida como "wellmits" |
| 3 | Chatterbox pt-BR com o timbre do Faber | 5,5× | "novo" ouvido como "movo" |
| 4 | Chatterbox pt-BR com o timbre do Cadu | 5,3× | "olha" ouvido como "olhe" |
| 5 | Chatterbox pt-BR com timbre feminino (cfg 0) | 5,3× | igual ao roteiro |
| 6 | Parler-TTS · Sophia (fem.) | 5,8× | várias palavras erradas |
| 7 | Parler-TTS · Nicholas (masc.) | 6,2× | marca errada |

- Piper Jeff ficou fora (palavras ininteligíveis). As vozes Piper pt-BR "dii" e "miro" têm licença não comercial.
- Não achei voz feminina de falante brasileira com licença comercial que rode aqui. A 5 e a 6 são as tentativas.
- Eu não ouço o áudio: sotaque e naturalidade só o dono julga. A conferência por transcrição mede palavra certa, não sotaque.
- Se nenhuma servir: o caminho que resta localmente é o Chatterbox pt-BR com 10 a 15 s de referência de uma pessoa brasileira que autorize (hoje proibido pela regra "não clonar pessoa real"), ou uma máquina com placa de vídeo para modelos maiores.

## Decisão do dono (15/11/2026, tarde): voz mantida e trilha inteira do Fornecedor

- "Esqueça o ElevenLabs, vamos com a voz do último vídeo": a voz continua **Piper · Faber**. A regra 1 (voz 100% local) segue valendo. A seção abaixo sobre o ElevenLabs fica só como histórico.
- "Quero agora todos os vídeos desse operador naquele portalzinho + as perguntas... papel a papel, todos os vídeos de cada papel, seja bem completo e preciso": li como **aprovação do Módulo 1** e mudança de ritmo: produzir **todos os módulos do papel** (Fornecedor, o do último vídeo) no mesmo player, com prática e quiz, e **parar só no fim do papel** (não mais a cada módulo). Depois, o papel seguinte.
- Caminho de dados da trilha: `_demo/caminho-fornecedor.mjs` (história em `HISTORIA`, um ponto de salvamento por cena; rodar de novo no dia da gravação). Arquivos fictícios que o fornecedor envia: `_demo/arquivos/` (`gerar_arquivos.py`).
- Segundo servidor de treino para preparar dados sem atrapalhar a gravação: `TREINO_PORTA=3201 TREINO_DADOS=.data-caminho`.

## Trilha do Fornecedor: estado da produção (atualizar a cada passo)

Fonte de cada módulo: `fornecedor/modulos/mN.py` (roteiro e quiz em Python; `m1.json` é o Módulo 1). `python3 _pipeline/juntar_cenas.py fornecedor` gera `cenas.json` e `quiz.json`. Quiz final do papel: `fornecedor/modulos/final.py` (define `FINAL`), ainda por escrever.

| Módulo | Cenas de tela | Pontos de dados | Situação em 15/11/2026, 16:35 UTC |
| --- | --- | --- | --- |
| M1 · Entrar, Pendências e o book | 5 | forn-m1-base | pronto e aprovado; gravado com o gravador antigo (ver "Gravador") |
| M2 · Solicitação: responder e negociar | 7 | forn-m2-base, forn-m2-contra | regravado e montado (7 min 51 s); auditoria: −16,5 LUFS, pico −3,9 dBTP, 30 qps; revisão quadro a quadro em andamento |
| M3 · Amostragem | 3 | forn-m3-base, forn-m3-reprovada | roteiro revisado; gravando |
| M4 · Pedido de compra | 6 | forn-m4-diecut, -contrato, -pagamento | roteiro revisado; na fila da gravação |
| M5 · Produção e inspeção | 5 | forn-m5-base, -reprovado | idem |
| M6 · Amostras e container | 6 | forn-m6-amostras, -devolucao, -container, forn-m7-base, forn-m6-lacre, forn-m6-recusado | idem |
| M7 · Documentos de carga | 4 | forn-m7-base | idem |
| M8 · Acompanhar pedidos e certificações | 2 | forn-fim | idem |
| M9 · Casos especiais: EXW e compra programada | 4 | forn-exw-solicitacao, forn-exw-base, forn-prog-solicitacao, forn-prog-filhos | escrito em 15/11 com os dados de `_demo/caminho-fornecedor-extras.mjs`; ensaio conferido; na fila da gravação |

Quiz final do papel: `fornecedor/modulos/final.py`, 16 perguntas (as duas últimas são do Módulo 9).

### Revisão das telas ensaiadas (M3 a M8), antes de gravar

Um revisor independente comparou as 204 telas ensaiadas com a narração: 161 batiam; 43 apontamentos (1 sério, 16 que confundem, 25 cosméticos). O que mudou nos roteiros:

- M4: a fala da pendência "Aprovar a arte" explica que o título e o texto falam de arte, mas a linha leva ao aceite das amostras (no pedido de compra o fornecedor não aprova arte: conferi em `PURCHASE_CONTRACT_REQUIREMENTS`). O contrato mostra pedido mínimo e prazo em branco: a fala diz isso.
- M5: a tabela de etapas é descrita com os nomes da tela; a linha "Ficha de compra · Em andamento" ganhou um passo próprio ("não gera pendência para você", problema 009); o motivo do ETD ganhou um passo que mostra o campo.
- M6 e M7: os documentos do embarque correm junto com o carregamento. O M6 avisa que o check list fica para o módulo seguinte e termina dizendo que faltam os documentos; o M7 abre dizendo que volta ao momento do container vazio. O M6 explica que "trading", na tela, é o próprio fornecedor.
- M7: a pendência do packing list continua na lista até a invoice (problema 010); a fala avisa.
- M8: a tabela de etapas e o cartão do embarque viraram dois passos; "Ver detalhes" ganhou um passo que mostra a etapa aberta.
- Alvos: cartão ou tabela inteira no lugar de só o título (`acima`, `titulo` em `roteiro_util.py`; `alvo()` em `lib.mjs` aceita `acima: N`).

### Montagem dez vezes mais rápida

A pílula "Passo N de M" era sobreposta como quadro inteiro transparente, uma por passo, durante a cena toda. `montar.py` agora recorta só a parte desenhada (`passo-pN.rec.png`) e sobrepõe na posição certa: uma cena de 58 s monta em 1 min (antes, mais de 10 min). O ambiente `.venv-stt` ganhou o Pillow (`uv pip install --python .venv-stt/bin/python pillow`).

### Concordância dos números por extenso

O normalizador falava "mil e duzentos peças". Agora o número concorda com o substantivo feminino que vem depois ("duas mil e quatrocentas peças"); a lista de substantivos está em `SUBST_FEMININOS` (`normalizar.py`). Tirei a equivalência "duzentos = duzentas" do reconhecedor, que escondia esse erro. `narrar.py` refaz o áudio quando o texto falado muda (antes só quando a fala escrita mudava).

Ordem de trabalho por módulo: `juntar_cenas.py` → `narrar.py --modulo N` (até zerar as divergências) → `gravar.mjs --so-ensaio --modulo N` → `ver_ensaio.py` (folhas com a caixa do alvo) → `gravar.mjs --modulo N` → `montar.py --modulo N` → `auditar.py <papel> N` (folhas em `_build/auditoria/mN/`) → revisão quadro a quadro por um agente independente → `empacotar.py --artefato` → `testar_pacote.mjs`.

### Gravador: correções de 15/11 (depois da revisão do Módulo 2)

- Cursor e rótulo vão no alvo de verdade (o botão "Abrir"), e não no meio da linha destacada (`alvo_visual`).
- A camada didática entra na "camada do topo" do navegador (popover): cursor e destaque aparecem por cima das caixas de diálogo nativas.
- Tabela larga rola para o lado até a coluna do alvo (`caixaDe` em `lib.mjs`).
- Passo fora da contagem não mostra mais a pílula "Passo N de M"; em passo só de explicação o cursor fica logo abaixo da caixa (não cobre o texto).
- Sem corretor ortográfico no navegador da gravação.
- Ações novas: `data` (campo de data, em dias a partir de hoje ou AAAA-MM-DD) e `passar` (aponta sem clicar, para botão que baixa arquivo).
- O Módulo 1 foi gravado antes dessas correções (tem o cursor no meio da linha em três passos). Regravar no fim, se der tempo, no mesmo dia (o ponto `forn-m1-base` tem datas de 15/11).

### Conferência da narração: duas opiniões

O reconhecedor principal (faster-whisper large-v3-turbo) erra consoantes com a voz Piper · Faber em cerca de uma fala a cada oito. `narrar.py` agora pede uma segunda opinião (large-v3) para as falas estranhadas: se o segundo entende o roteiro, a divergência era do reconhecedor. Se os dois ouvem outra coisa, reescrevo a frase. Palavras que os dois erraram com esta voz: "lacrar", "lacre" no fim da frase, "avarias", "reprovação", "corrija", "confira", "cega", verbos em primeira pessoa ("digito", "preencho", "escolho") e "Um cuidado" no começo da frase. Evitar.

### Dados que os vídeos mostram

História em `_demo/caminho-fornecedor.mjs` (`HISTORIA`): pote SZ-JR15, 2.400 peças, book USD 2,10, resposta USD 2,25, contraproposta aceita USD 2,18, FOB, pedido mínimo 1.200, 35 dias; pedido #1; 200 caixas; invoice INV-2026-0115. Arquivos enviados: `_demo/arquivos/`. Os pontos `forn-*` em uso vieram das corridas de 15/11 (13:36 a 14:00 UTC); a corrida do zero está em `ensaio-forn-*` (iguais para o fornecedor). **Em outro dia, rodar o caminho de novo antes de gravar.**

## Voz: o dono quis trocar por ElevenLabs (15/11/2026, desistiu no mesmo dia)

- O dono gostou do Módulo 1 ("do treinamento gostei"), mas quer voz melhor e perguntou como ligar o ElevenLabs. Isso muda a regra 1 da missão (voz 100% local); só vale quando ele salvar a chave. Até lá a voz continua Piper · Faber.
- Ele fechou o formulário da chave. Não abrir de novo: a chave entra pelas configurações do ambiente (`supabase-mcp`, rede sem restrição), em "Network secrets", host `api.elevenlabs.io`, cabeçalho `xi-api-key` (sem prefixo).
- Quando a chave existir: criar `_pipeline/motores/motor_elevenlabs.py` (mesma interface dos outros motores, cache por frase), gerar a mesma fala do Módulo 1 em algumas vozes de falantes brasileiros para ele escolher, e só então refazer o Módulo 1 (regravar: o ritmo da gravação segue a duração das falas). Modelos vistos na documentação: `eleven_multilingual_v2` (mais estável em narração longa, pt-BR explícito, 1 crédito por caractere) e `eleven_v4` (o mais novo; custo por caractere não publicado).
- **Estimativa de caracteres** (medido: Módulo 1 = 4.045 caracteres em 287 s; vídeo de avaliação = 3.253 em 240 s; média de 830 caracteres por minuto de vídeo): equipe 480 min = 398 mil; avançado da equipe 150 min = 125 mil; Fornecedor 95 min = 79 mil; demais papéis de fora 170 a 200 min = 141 a 166 mil. **Total planejado: 750 a 800 mil caracteres em português**, mais 20 a 30% de frases refeitas (até cerca de 1 milhão). O Módulo 1 saiu com metade da duração prevista no mapa; se os outros seguirem assim, o total cai para perto de 400 mil. Outros idiomas não entram nessa conta.

## Correções de estilo pedidas pelo dono

Nenhuma ainda.

## Pendências

- "Aprovado" do dono para o Módulo 1 do Fornecedor (ou a lista do que mudar).
- Guardar o trabalho: commit e push de `treinamentos/` no ramo `claude/brave-goldberg-m469a6` só se o dono autorizar. Até lá, tudo vive só neste contêiner.
- Problema 002 (`problemas-encontrados.md`): o aviso do convite continua como "Sua vez" depois do envio do book. Decisão do dono.
- Pronúncias marcadas como "proposto" em `_config/pronuncias.json` ("book" sai "búqui", "Superplan" sai "superplã").
- Criar logins das sete funções sem conta de demonstração quando chegar a vez de cada uma.
- Divergências e dúvidas de permissão do mapa (seções 6 e 7): cada uma precisa de decisão antes de o papel afetado ser roteirizado.

## Como rodar

```bash
# na raiz do repositório, uma vez
npm ci && DATA_MODE=memory npx next build

# em treinamentos/_pipeline
node ../_demo/preparar-fornecedor-m1.mjs                # dados do dia (ponto forn-m1-base)
.venv-stt/bin/python narrar.py ../fornecedor            # narração por passo + conferência
node gravar.mjs ../fornecedor                           # ensaio + gravação de cada cena
.venv-stt/bin/python montar.py ../fornecedor            # MP4 do módulo + legendas .vtt
.venv-stt/bin/python roteiro.py ../fornecedor           # roteiro.md
.venv-stt/bin/python empacotar.py ../fornecedor --artefato   # player, prática, quiz, guia rápido
node testar_pacote.mjs ../fornecedor                    # teste do pacote em três modos
.venv-stt/bin/python auditar.py ../fornecedor           # folhas de quadros, volume, silêncios, STT
```

`--cena ID` (pode repetir) refaz só uma cena em `narrar.py`, `gravar.mjs` e `montar.py`. Depois de gravar, desligar o servidor de treino: `fuser -k 3200/tcp`.

Os ambientes dos motores (`_pipeline/.venv-*`), os pesos (`_pipeline/.cache/`) e os dados de demonstração não são versionados (`treinamentos/.gitignore`). Para recriar: `uv venv` + `uv pip install` dos pacotes listados em `_pipeline/README.md`.

## Agência de arte e Certificadora (sessão de 15/11/2026, noite, em outra máquina)

Pedido do dono nesta sessão: "criar agora o treinamento para a agência de marketing que faz as artes e também para a certificadora, um e depois o outro na mesma requisição", usando esta conversa como modelo. Li como: os dois papéis inteiros, sem parada entre eles (a regra "um papel por vez, com aprovado" foi trocada por ele, só para estes dois).

- **"Agência de marketing que faz as artes" = Agência de arte** (papel `agency`, conta `agencia@design.com`, Agência Criativa). A agência de marketing da China (`agencia@marketing.cn`, fotos reais das amostras) é outro papel e continua na fila.
- **Como este trabalho chegou aqui:** a pasta `treinamentos/` não estava no repositório (regra "sem commit e push"). Reconstruí os arquivos de texto a partir do histórico da conversa do Fornecedor (as gravações de arquivo e os remendos, refeitos em ordem numa caixa de areia) e conferi: `_pipeline/pacote/player.js` e `player.css` saíram idênticos, byte a byte, aos publicados na página do Fornecedor. Vídeos, áudios e pontos de salvamento do Fornecedor **não** vieram (são pesados e ficam só na máquina daquela sessão). Aqui há só o que estes dois papéis precisam.
- **Voz, marca e método:** os mesmos (Piper · Faber, `_config/voice.config.json`; `_config/marca.json`; o método da missão).

### O portal mudou desde o levantamento (marcos do pedido, docs/MILESTONES.md)

O levantamento (`_recon/parceiros-externos.md`) é de 14/11. O portal de hoje anda pelos 16 marcos do pedido. O que muda para estes papéis, conferido na tela:

- O parceiro vê **"Marcos do pedido"** no lugar de "Etapas do pedido"; o marco com tarefa liberada vem aberto, com "Sua tarefa"; marco concluído fecha ("Ver detalhes").
- A **arte** só libera com o marco **Material de arte** inteiro (faca, foto, pedido mínimo e prazo do fornecedor) **e a aprovação do Comprador**. O caminho de dados faz essa aprovação pela tela (`aprovar`, em `caminho-arte-certificacao.mjs`).
- O **certificado**, o **selo** e o **memorial** liberam na criação do pedido, em paralelo.
- A tela "Embalagens" (briefing) citada nos roteiros antigos de `docs/videos/04-agencia.md` não existe mais.

### Dados

`_demo/caminho-arte-certificacao.mjs` continua o caminho do Fornecedor a partir do ponto `forn-m4-diecut` (a mesma história: pote SZ-JR15, 2.400 peças, pedido #1). Antes dele, rodar as cinco primeiras etapas de `caminho-fornecedor.mjs` (m2-base, m2-contra, m3-base, m3-reprovada, m4-diecut). Pontos: `cert-base` (certificadora), `arte-base`, `arte-devolvida`, `arte-final`, `arte-selo-recusado`, `arte-correcao` (agência). As cenas salvam os pontos intermediários (`arte-s1`, `arte-final-s1`, `cert-s1` a `cert-s3`…). Arquivos fictícios novos: `_demo/arquivos/gerar_arquivos_arte.py` (artes, selo de exemplo sem marca de órgão nenhum, memorial, certificado, um Word para a cena do formato recusado). **Em outro dia, rodar o caminho de novo antes de gravar** (as datas são do dia).

### Trilhas

| Papel | Módulo | Conteúdo | Fonte |
| --- | --- | --- | --- |
| Agência de arte | M1 · Entrar, Pendências e a arte do pedido | tour, pendências, enviar a arte (baixar faca e foto), formato recusado, arte devolvida | `agencia/modulos/m1.py` |
| Agência de arte | M2 · O selo e a arte final | selo aplicado na arte (cartão Certificação), arte final com o selo (marco Arte), selo recusado | `agencia/modulos/m2.py` |
| Agência de arte | M3 · Ajustes, a tela Arte e a mesa de trabalho | não conformidade (cartão Artes), baixar todas as artes, tela Arte, mesa de trabalho, avisos e mensagens | `agencia/modulos/m3.py` |
| Certificadora | M1 · Entrar, ler o pedido e enviar o certificado | tour, pendências, ler o pedido e a ficha de compra, certificado por produto, formato recusado | `certificadora/modulos/m1.py` |
| Certificadora | M2 · Selo, memorial e os outros caminhos | selo, memorial, substituir arquivo, tela Certificação, mesa de trabalho, avisos e mensagens | `certificadora/modulos/m2.py` |

Quiz final de cada papel em `modulos/final.py`. Problemas de tela vistos nestes papéis: 015 a 020 em `problemas-encontrados.md`.

### O que aprendi com a voz nestes roteiros

Palavras e encaixes que os dois reconhecedores ouviram errado com a Piper · Faber e que reescrevi: "Neste" no começo da frase ("deste"), "chega" ("cheira"), "lista os", "marco Arte" ("marquarte": usar "marco da arte"), "liberada" ("liderada"), "arte entregue", "junta num arquivo só", "Prazo" no começo da frase ("trazo"), "entram o", "pela Wellmix" no fim de oração, "Clique em Resolver" ("fique": usar "Use o botão"), e a marca logo depois de "a equipe da" numa frase longa.

### Verificação antes da entrega (15/11/2026)

- **Narração:** todas as falas dos cinco módulos transcritas iguais ao roteiro pelos dois reconhecedores (zero divergências).
- **Auditoria (primeira montagem):** −16,3 a −16,4 LUFS, pico −3,9 a −4,2 dBTP, 30 qps em todos; um silêncio de 2,6 s no M2 da agência (escolha do arquivo).
- **Teste do aprendiz:** um agente por papel, só com a transcrição, acertou todas as perguntas de texto (agência 26 de 26; certificadora 23 de 23). Das observações deles entraram: "selo" não é mais usado para a etiqueta de prazo; a pergunta de ordenar do quiz final da certificadora virou a troca de arquivo (selo e memorial não têm ordem obrigatória); "Reenviar a arte, se a Wellmix reprovar na validação" no quiz final da agência.
- **Revisão quadro a quadro:** um revisor independente por módulo (cinco). Veredito igual nos cinco: "pronto com ressalvas", nenhum passo ensina o clique errado. O que confundia e foi corrigido antes da regravação:
  - o número das etapas (bolinha de contagem × número de ordem) e a "etiqueta" do prazo, no M1 da agência;
  - cenas "Cuidado" e capítulos que voltam no tempo agora dizem isso na fala;
  - a pílula "Passo N de M" sem instrução (passos de apoio saíram da contagem) e os cartões "Sua vez" alinhados com os passos;
  - falas que a tela não mostrava (prazo vencido em vermelho, "Conversar com a Wellmix", "a Wellmix recebe um aviso", medidas e fotos da ficha) saíram ou foram trocadas pelo que aparece;
  - o número do sino é o de avisos não lidos; o rótulo do sino passou a "Notificações";
  - a aba "Todos no passo" agora é aberta de verdade; a troca de arquivo começa pelo menu "Pedidos";
  - o botão "Enviar de novo" existe desde o primeiro envio (a fala dizia que mudava depois da recusa).
- **Regra em aberto (decisão do dono):** depois de a Wellmix recusar a arte com o selo, a agência reenvia só no cartão Certificação. O vídeo diz isso ("é ela que a Wellmix valida") e não afirma nada sobre trocar também o arquivo da linha "Arte final com o selo", que continua concluída com o arquivo antigo.

### Entrega dos dois papéis (15/11/2026, 22h UTC)

| Papel | Módulo | Duração | Capítulos | Pausas "Sua vez" | Práticas | Perguntas |
| --- | --- | --- | --- | --- | --- | --- |
| Agência de arte | M1 · Entrar, Pendências e a arte do pedido | 5 min 08 s | 6 | 3 | 3 | 9 |
| Agência de arte | M2 · O selo e a arte final | 3 min 49 s | 5 | 3 | 3 | 9 |
| Agência de arte | M3 · Ajustes, a tela Arte e a mesa de trabalho | 3 min 55 s | 5 | 3 | 3 | 8 |
| Agência de arte | Quiz final | | | | | 10 |
| Certificadora | M1 · Entrar, ler o pedido e enviar o certificado | 4 min 41 s | 6 | 3 | 2 | 10 |
| Certificadora | M2 · Selo, memorial e os outros caminhos | 5 min 25 s | 7 | 5 | 5 | 10 |
| Certificadora | Quiz final | | | | | 9 |

- **Total:** Agência 12 min 52 s; Certificadora 10 min 06 s. O mapa estimava 30 a 35 min e 20 a 25 min; como no Fornecedor, o vídeo saiu bem mais curto que a estimativa.
- **Arquivos:** `agencia/` e `certificadora/` (`modulo-N.mp4` 1080p, `modulo-N.pt-BR.vtt`, `roteiro.md`, `cenas.json`, `quiz.json`, `quiz-final.json`, `index.html` + `assets/`, `guia-rapido.html`).
- **Auditoria final (depois da regravação):** −16,3 a −16,4 LUFS, pico −3,9 a −4,2 dBTP, 30 qps, nenhum silêncio acima de 2,5 s, narração igual ao roteiro em todas as falas, nenhuma cena com quadro perdido.
- **Teste do pacote:** três modos (direto do disco, servidor com Range, servidor sem Range): Agência 157 conferências, Certificadora 134, nenhuma falha.
- **Páginas de teste (privadas, vídeo em 720p):** Agência https://claude.ai/artifact/1cAV1Rk2AGq4q8in9SwxkV · Certificadora https://claude.ai/artifact/Q3uSsirjadhE2yvmwChXks. Para atualizar, publicar de novo `<papel>/_build/artefato/index.html` (em outra conversa, passando o endereço).
- **`empacotar.py`:** o nome do papel na página vem de `nome` em `modulos/papel.json` ("Agência de arte"); sem ele, vale a chave com maiúscula, como no Fornecedor. `roteiro.py` só chama de "Cuidado" a cena sem passo contado.

### Pendências destes dois papéis (do dono)

- "Aprovado" ou a lista do que mudar em cada papel.
- Guardar o trabalho: `treinamentos/` continua fora do repositório (regra 5 da missão). Nesta máquina ele some se a sessão for reciclada; as páginas publicadas guardam os vídeos em 720p, o player, a prática, o quiz e o guia.
- Textos do portal a corrigir (problemas 015 a 024), em especial "O despachante enviou/trocou o selo", "se o fornecedor reprovar" e a chave `stage.agency.art` na coluna "Tipo".
- Regra de negócio em aberto: depois da recusa da arte com o selo, a linha "Arte final com o selo" do marco Arte precisa receber o arquivo novo também?

### Correção do player: texto dos botões no tema escuro (15/11/2026)

O dono avisou que alguns botões da página publicada apareciam "com texto em branco". Causa: os botões que não definiam a própria cor (módulos, lista de capítulos, alternativas e setas do quiz) usavam a cor de texto do sistema; com o aplicativo em tema escuro ela vira branco, sobre o fundo branco da página. `_pipeline/pacote/player.css` agora fixa `color-scheme: light` e dá cor explícita a botões e campos (`button { color: inherit }`). Conferido com o esquema escuro forçado em todas as telas dos dois papéis (114 e 85), teste do pacote repetido e páginas republicadas no mesmo endereço. **A página do Fornecedor (e a do Analista) usa o mesmo `player.css` e tem o mesmo defeito: aplicar a mesma mudança nas sessões delas e republicar.**
