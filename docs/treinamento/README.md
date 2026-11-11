# Treinamento: mini vídeos, perguntas e % de completude

Cada pessoa que usa o portal (cliente, fornecedor, parceiro ou equipe Wellmix) recebe uma **trilha** com os vídeos do seu papel, e o treinamento é **obrigatório**. Cada vídeo é um **módulo** dividido em **capítulos** (mini vídeos de cerca de 1 minuto) e tem o seu **percentual de completude**. Para chegar a **100 % (OK)** num módulo, a pessoa assiste e **passa numa prova curta**. Não há certificado: o resultado é só o **OK de completude** registrado no sistema.

Este diretório traz o **conteúdo e as regras**; a programação é separada. O que há aqui:

| Arquivo                                                                    | O que é                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [README.md](README.md)                                                     | A mecânica: conceitos, percentuais, prova, vídeo no portal, decisões.                                              |
| [FORMATO.md](FORMATO.md)                                                   | Como os módulos (capítulos e perguntas) são escritos em YAML.                                                      |
| [trilhas.yaml](trilhas.yaml)                                               | Que módulos cada tipo de login deve concluir, e em que ordem.                                                      |
| `modulos/<SÉRIE>/<ID>.yaml`                                                | Um arquivo por episódio: capítulos e banco de perguntas (e traduções en/zh no fornecedor e na companhia marítima). |
| [`scripts/treinamento-validar.mjs`](../../scripts/treinamento-validar.mjs) | Valida todos os módulos (`node scripts/treinamento-validar.mjs`).                                                  |
| [BANCO-DE-PERGUNTAS.md](BANCO-DE-PERGUNTAS.md)                             | Resumo do que foi escrito (contagens por série) e o que revisar.                                                   |

Os roteiros, a narração e o texto na tela dos vídeos continuam em [docs/videos](../videos/README.md). **Este conteúdo deve acompanhar os vídeos**: se um episódio for regravado ou mudar, revise os capítulos e as perguntas dele (seção 9).

## Decisões já tomadas (11/11/2026)

| Tema                    | Decisão do dono                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Percentual              | Cada vídeo (módulo) tem o seu percentual de completude; a trilha mostra o conjunto.                                               |
| Nota de aprovação       | **80 %** na prova (4 de 5 certas).                                                                                                |
| Obrigatoriedade         | **Obrigatório.** (O que acontece com quem não conclui está em aberto: seção 8, itens 1 e 2.)                                      |
| Onde ficam os vídeos    | **No próprio portal**, tocando direto (sem YouTube nem Vimeo). Seção 6.                                                           |
| Certificado e premiação | **Nenhum certificado.** Só o OK de completude no sistema. Sem selos, títulos nem sequência de dias (podem vir depois, se quiser). |

---

## 1. Os conceitos

```text
Trilha (por papel)  ─┬─ Módulo = 1 episódio (GER-01, FOR-02, WPE-05…)   → tem o seu % de completude
                     │     ├─ Capítulo 1 · mini vídeo (≈ 1 min)
                     │     ├─ Capítulo 2 · mini vídeo
                     │     ├─ Capítulo 3 · mini vídeo
                     │     └─ Prova do módulo (5 perguntas sorteadas de um banco de 8)
                     └─ …
```

- **Trilha**: lista ordenada de módulos de um papel (`trilhas.yaml`). São 18 trilhas, uma por tipo de login e por função de operador.
- **Módulo**: um episódio dos vídeos. 74 módulos no total; GER-01 e GER-02 aparecem em quase todas as trilhas e valem **uma vez só** (concluído em uma trilha, vale em todas).
- **Capítulo**: o mini vídeo, de 2 a 4 por módulo, com título, resumo e tempo de início e fim dentro do vídeo do episódio. É a unidade de "assistido".
- **Prova do módulo**: 5 perguntas sorteadas do banco de 8 do módulo.
- **OK de completude**: o módulo em 100 % (assistido e aprovado). A trilha está **concluída** quando todos os seus módulos têm OK.

## 2. Como o percentual é calculado

**Módulo (0 a 100 %)**

| Marco                                                             | Percentual do módulo                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Nada feito                                                        | 0 %                                                                            |
| Cada capítulo assistido                                           | sobe de forma proporcional até **50 %** (com 3 capítulos, cada um vale 16,7 %) |
| Todos os capítulos assistidos, prova ainda não feita ou reprovada | **50 %** (o máximo sem passar)                                                 |
| **Prova aprovada**                                                | **100 % = OK**                                                                 |

Assim "100 %" só existe quando a pessoa **passou na prova**. Assistir sozinho nunca passa de 50 %.

**Capítulo "assistido"**: o vídeo tocou até pelo menos **90 %** do trecho do capítulo, sem pular o final (arrastar a barra para o fim não conta). Quem já sabe pode ir direto à prova (seção 3, "Já sei isso").

**Trilha (0 a 100 %)**: média dos percentuais dos módulos, **ponderada pela duração** de cada episódio (um vídeo de 5:30 pesa mais que um de 2:16). O campo `duracao` de cada módulo dá o peso.

```text
% da trilha = Σ (% do módulo × duração do módulo) ÷ Σ duração dos módulos
```

## 3. A prova

1. **5 perguntas** sorteadas do banco de 8 do módulo, sempre com **pelo menos 1 de nível 3** (situação) e **no máximo 1 de nível 1**.
2. **Nota de aprovação: 80 %** (4 de 5 certas). Em `multipla` e `ordem`, só vale **tudo certo**, sem meio ponto.
3. **Tentativas ilimitadas**, mas a cada nova tentativa o sorteio **evita as perguntas já vistas** enquanto houver (com 8 no banco, a 2ª tentativa traz pelo menos 2 novas e a 3ª repete algumas).
4. **Depois de cada pergunta**, a tela mostra se acertou, a `explicacao` e, quando errou, o botão **Rever este trecho** (leva ao capítulo que contém a `cena` da pergunta, já no tempo certo). A pessoa só avança depois de ler.
5. Ao reprovar: "Você acertou 3 de 5. Reveja os trechos marcados e tente de novo". Lista os capítulos a rever (os das perguntas erradas). Sem punição, sem espera.
6. Ao aprovar: o módulo vai a **100 %**, ganha a marca **OK** e a próxima aula é oferecida.
7. **Idioma**: a prova aparece no idioma do usuário quando o módulo o tem (fornecedor e companhia marítima: pt, en, zh); nos demais, em pt.
8. **"Já sei isso"**: o botão permite ir direto à prova sem assistir. Se passar, o módulo vai a 100 % (e os capítulos contam como assistidos). Quem erra ganha as explicações e a indicação dos capítulos.

## 4. O que a pessoa e o gestor veem

**A pessoa**

- Uma tela **Treinamento** com a sua trilha (ou trilhas): um cartão por vídeo com o **percentual** (0, 50 ou 100 %), a marca **OK** quando concluído, os capítulos com um tique quando assistidos e o botão "Continuar de onde parei".
- O **percentual da trilha** no topo e, discreto, no menu.
- Treinamento pendente aparece como **pendência** e no sino, como as demais pendências do portal (sugestão: reaproveita um mecanismo que o usuário já conhece).

**O gestor (administrador; diretoria vê a equipe)**

- Por pessoa e por trilha: percentual, módulos com OK, módulos parados e há quantos dias não há atividade. É o que torna a obrigatoriedade acompanhável.
- Por pergunta: taxa de erro. Aponta a pergunta mal escrita ou o trecho do vídeo que ficou confuso, a melhor fonte para melhorar vídeo e prova.

Tom do texto: direto e respeitoso, sem infantilizar. É treinamento de trabalho.

## 5. Ordem e liberdade

- **Recomendada**: a ordem da trilha (`trilhas.yaml`), que acompanha a jornada (da entrada no portal ao pós-venda).
- **Livre**: a pessoa pode abrir qualquer módulo da sua trilha; o próximo módulo é apenas sugerido.
- A página de treinamento de uma pessoa só mostra a trilha do seu papel (mais o que o administrador liberar).
- Um mesmo login pode acumular mais de uma trilha (ex.: operador comprador + designer). O percentual de cada uma é separado.

## 6. Os vídeos no próprio portal

O vídeo toca dentro do portal, em um player próprio (tag `<video>` com controles do projeto), sem serviço externo. Pontos a resolver na programação:

**Arquivo e formato**

- **Um arquivo por episódio e por idioma**: `FOR-02.pt.mp4`, `FOR-02.en.mp4`, `FOR-02.zh.mp4`. Os capítulos **não** são arquivos separados: são faixas de tempo (`inicio` e `fim`) dentro do arquivo do episódio, como nos YAML.
- **MP4, H.264 + AAC**, 1080p (ou 720p), com `moov` no início (`-movflags +faststart`) para começar a tocar logo. Cada episódio ganha um pôster (`.jpg`) e **legendas em WebVTT** (`.pt.vtt`, `.en.vtt`, `.zh.vtt`), que saem das legendas dos roteiros.
- **Tamanho**: os 74 episódios somam 5 h 11 min. A cerca de 2,5 Mbps (bom para gravação de tela), são **≈ 5,8 GB** em pt; os episódios do fornecedor e da companhia marítima em en e zh (46 min em cada idioma) somam **≈ 1,7 GB** a mais. Com 1,5 Mbps, cai para cerca de 60 % disso. Confirme o bitrate com uma gravação-piloto.

**Onde guardar** (decisão da programação)

- Não dá para pôr esse volume em `public/` no repositório nem no deploy da Vercel. A sugestão é um **bucket privado do Supabase Storage** (o banco de produção já é o Supabase), com a leitura liberada só a quem está logado e tem o episódio na trilha, via **URL assinada de curta duração**. Confira antes o limite de tamanho por arquivo e de armazenamento e de tráfego do plano do projeto; outra opção é o Vercel Blob.
- O servidor de arquivos precisa aceitar **requisições por faixa de bytes (Range)** para a pessoa poder avançar e voltar.

**Player e acompanhamento**

- O player começa e para nos tempos do capítulo (`currentTime` e `timeupdate`) e oferece "capítulo anterior / próximo".
- A cada poucos segundos o navegador envia ao servidor "estou no segundo N do episódio X". O **servidor** soma os trechos realmente vistos de cada capítulo e decide se passou dos 90 % (seção 2). O navegador não manda "assisti", manda só a posição.
- Vídeo que falha ao carregar não pode travar a pessoa: mostrar o erro e um botão de tentar de novo, e **não** contar o capítulo como assistido.
- No celular (transportador e fornecedor em campo): `playsInline`, controles grandes e retomar do ponto onde parou.

## 7. O que o programa precisa guardar (sugestão de dados)

Só para a programação se orientar; o desenho final é do dono.

| Dado                  | Campos principais                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Progresso de capítulo | usuário, módulo, capítulo, trechos vistos (faixas em segundos), `assistido_em`, versão do vídeo           |
| Tentativa de prova    | usuário, módulo, `iniciada_em`, `terminada_em`, perguntas sorteadas, respostas, nota, aprovada (sim/não)  |
| Resposta              | tentativa, pergunta, resposta dada, certa (sim/não), tempo                                                |
| Conclusão do módulo   | usuário, módulo, versão, `concluido_em`, nota da aprovação, como concluiu ("assistindo" ou "já sei isso") |

- **Versão do conteúdo**: cada módulo tem uma versão (a do vídeo + a do banco). Se o vídeo for regravado de forma que mude o que se faz na tela, aumente a versão: quem já tinha o OK **mantém o OK**, mas ganha o aviso "Este vídeo foi atualizado" e a opção de rever sem perder nada. (Sugestão; ver seção 8, item 4.)
- **Leitura só no servidor e escrita por Server Action com checagem de papel** (regra do projeto). O percentual é calculado no servidor; o navegador só envia a posição do vídeo e as respostas, nunca a nota.
- **Gabarito nunca vai ao navegador antes da resposta.** A tela recebe enunciado e opções; a correção é feita no servidor, que devolve `correta` e `explicacao` depois.
- **Dados de demonstração**: o modo memória precisa de uma pessoa por papel já com progresso parcial, para os vídeos de treinamento e os testes.
- Esquema novo em `src/lib/db/schema.ts` é **aditivo** (docs/EVOLUTION_PLAN.md) e, quando o PR mexer nele, publicar no Supabase (docs/SUPABASE.md).

## 8. O que ainda está em aberto

Os arquivos funcionam com qualquer escolha; a sugestão vai na coluna da direita.

| #   | Em aberto                           | Sugestão                                                                                                                                                                                 |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Obrigatório significa bloquear?** | Não bloquear o portal: vira pendência e aviso, e o gestor acompanha. Bloquear um cliente ou fornecedor que precisa de uma cotação urgente costuma custar mais do que o treinamento vale. |
| 2   | **Prazo e lembrete**                | Equipe Wellmix: 30 dias a partir do primeiro login. Cliente e parceiro: sem prazo fixo, lembrete pelo sino a cada 7 dias parado. O que o gestor faz quando o prazo vence é decisão sua.  |
| 3   | **Quem vê o progresso**             | Administrador vê todos; diretoria vê a equipe; cada pessoa vê o seu. Cliente e parceiro: a Wellmix vê o percentual e a data do OK, não as respostas.                                     |
| 4   | **Quando um vídeo é regravado**     | Quem já tem o OK mantém, com aviso e opção de rever (seção 7).                                                                                                                           |
| 5   | **Quem é obrigado**                 | Quem tem a trilha, ou só a equipe e os parceiros que operam (fornecedor, agência, despachante…) e o cliente fica convidado? Hoje a trilha do cliente tem 10 vídeos.                      |
| 6   | **Idiomas da prova**                | pt para a equipe e o cliente; pt, en e zh para o fornecedor e a companhia marítima. As traduções em zh precisam de revisão por quem fala a língua.                                       |

## 9. Manter o conteúdo atualizado

1. Quando uma tela mudar e um episódio for regravado (tabela "Regravar" em docs/videos/README.md), abra o módulo do episódio e confira: **tempos dos capítulos**, **nomes de botões nas perguntas e nas explicações** e **respostas que dependem da regra que mudou**.
2. Rode `node scripts/treinamento-validar.mjs` depois de qualquer edição.
3. Use o relatório de erros por pergunta (seção 4): pergunta com mais de 60 % de erro é, quase sempre, enunciado ambíguo ou trecho do vídeo ruim. Corrija a pergunta antes de culpar o aluno.
4. Quando a matriz de telas de docs/ACCESS.md mudar, ajuste `trilhas.yaml` e a tabela de trilhas de docs/videos/README.md.

## 10. Sugestões para a gravação dos vídeos

- Cada **capítulo** deve terminar com a ação concluída e a tela estável por 1 s: é o ponto de corte do mini vídeo.
- Grave o episódio **uma vez só** e corte nos capítulos na edição (não grave capítulo a capítulo): a narração e o ritmo ficam contínuos.
- No fim de cada **módulo**, uma tela de 3 s: "Agora vem a prova: 5 perguntas, você precisa acertar 4." Cria o gancho para o quiz.
- Para o **zh** e o **en** do fornecedor, a prova usa os mesmos nomes de botão que o vídeo mostra na tela.
- Exporte já no formato da seção 6 (MP4 H.264 + AAC, faststart) e entregue as legendas em WebVTT, um arquivo por idioma.
