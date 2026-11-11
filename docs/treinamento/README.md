# Treinamento gamificado: mini vídeos, perguntas e percentual

Cada pessoa que usa o portal (cliente, fornecedor, parceiro ou equipe Wellmix) recebe uma **trilha** com os vídeos do seu papel. Cada vídeo é um **módulo** dividido em **capítulos** (mini vídeos de cerca de 1 minuto). Para chegar a **100 %** num módulo, a pessoa assiste e **passa numa prova curta**; o percentual da trilha é a soma dos módulos.

Este diretório traz o **conteúdo e as regras**; a programação é separada. O que há aqui:

| Arquivo                                                                    | O que é                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [README.md](README.md)                                                     | A mecânica: conceitos, percentuais, prova, selos, decisões em aberto.                                              |
| [FORMATO.md](FORMATO.md)                                                   | Como os módulos (capítulos e perguntas) são escritos em YAML.                                                      |
| [trilhas.yaml](trilhas.yaml)                                               | Que módulos cada tipo de login deve concluir, e em que ordem.                                                      |
| `modulos/<SÉRIE>/<ID>.yaml`                                                | Um arquivo por episódio: capítulos e banco de perguntas (e traduções en/zh no fornecedor e na companhia marítima). |
| [`scripts/treinamento-validar.mjs`](../../scripts/treinamento-validar.mjs) | Valida todos os módulos (`node scripts/treinamento-validar.mjs`).                                                  |
| [BANCO-DE-PERGUNTAS.md](BANCO-DE-PERGUNTAS.md)                             | Resumo do que foi escrito (contagens por série) e o que revisar.                                                   |

Os roteiros, a narração e o texto na tela dos vídeos continuam em [docs/videos](../videos/README.md). **Este conteúdo deve acompanhar os vídeos**: se um episódio for regravado ou mudar, revise os capítulos e as perguntas dele (seção 8).

---

## 1. Os conceitos

```text
Trilha (por papel)  ─┬─ Módulo = 1 episódio (GER-01, FOR-02, WPE-05…)
                     │     ├─ Capítulo 1 · mini vídeo (≈ 1 min)
                     │     ├─ Capítulo 2 · mini vídeo
                     │     ├─ Capítulo 3 · mini vídeo
                     │     └─ Prova do módulo (5 perguntas sorteadas de um banco de 8)
                     └─ …
                          └─ Desafio final da trilha (10 perguntas de situação, sorteadas de todos os módulos)
```

- **Trilha**: lista ordenada de módulos de um papel (`trilhas.yaml`). São 18 trilhas, uma por tipo de login e por função de operador.
- **Módulo**: um episódio dos vídeos. 74 módulos no total; GER-01 e GER-02 aparecem em quase todas as trilhas e valem **uma vez só** (concluído em uma trilha, vale em todas).
- **Capítulo**: o mini vídeo, de 2 a 4 por módulo, com título, resumo e tempo de início e fim dentro do vídeo do episódio. É a unidade de "assistido".
- **Prova do módulo**: 5 perguntas sorteadas do banco de 8 do módulo.
- **Desafio final da trilha**: 10 perguntas de situação (nível 3) sorteadas dos módulos da trilha. Dá o selo e o certificado.

## 2. Como o percentual é calculado

**Módulo (0 a 100 %)**

| Marco                                                             | Percentual do módulo                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Nada feito                                                        | 0 %                                                                            |
| Cada capítulo assistido                                           | sobe de forma proporcional até **50 %** (com 3 capítulos, cada um vale 16,7 %) |
| Todos os capítulos assistidos, prova ainda não feita ou reprovada | **50 %** (o máximo sem passar)                                                 |
| **Prova aprovada**                                                | **100 %**                                                                      |

Assim "100 %" só existe quando a pessoa **passou na prova**, como pediu o dono. Assistir sozinho nunca passa de 50 %.

**Capítulo "assistido"**: o vídeo tocou até pelo menos **90 %** do trecho do capítulo, sem pular o final (arrastar a barra para o fim não conta). Quem já sabe pode ir direto à prova (seção 3, "Já sei isso").

**Trilha (0 a 100 %)**: média dos percentuais dos módulos, **ponderada pela duração** de cada episódio (um vídeo de 5:30 pesa mais que um de 2:16). O campo `duracao` de cada módulo dá o peso.

```text
% da trilha = Σ (% do módulo × duração do módulo) ÷ Σ duração dos módulos
```

O desafio final não entra no percentual: é o fecho que dá o selo "Trilha concluída" quando todos os módulos estão em 100 %.

## 3. A prova

Regras sugeridas (decisões do dono marcadas na seção 7):

1. **5 perguntas** sorteadas do banco de 8 do módulo, sempre com **pelo menos 1 de nível 3** (situação) e **no máximo 1 de nível 1**.
2. **Nota de aprovação: 80 %** (4 de 5 certas). Em `multipla` e `ordem`, só vale **tudo certo**, sem meio ponto.
3. **Tentativas ilimitadas**, mas a cada nova tentativa o sorteio **evita as perguntas já vistas** enquanto houver (com 8 no banco, a 2ª tentativa traz pelo menos 2 novas e a 3ª repete algumas).
4. **Depois de cada pergunta**, a tela mostra se acertou, a `explicacao` e, quando errou, o botão **Rever este trecho** (leva ao capítulo que contém a `cena` da pergunta, já no tempo certo). A pessoa só avança depois de ler.
5. Ao reprovar: "Você acertou 3 de 5. Reveja os trechos marcados e tente de novo". Lista os capítulos a rever (os das perguntas erradas). Sem punição, sem espera.
6. Ao aprovar: o módulo vai a **100 %**, aparece a animação do selo do módulo e a próxima aula é oferecida.
7. **Idioma**: a prova aparece no idioma do usuário quando o módulo o tem (fornecedor e companhia marítima: pt, en, zh); nos demais, em pt.
8. **"Já sei isso"**: o botão permite ir direto à prova sem assistir. Se passar, o módulo vai a 100 % (e os capítulos contam como assistidos). Quem erra ganha as explicações e a indicação dos capítulos.

## 4. Gamificação (tudo opcional, em ordem de valor)

| Elemento                   | Regra sugerida                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anel de progresso**      | Percentual da trilha no topo da tela de treinamento e, discreto, no menu.                                                                                                                                 |
| **Selo por módulo**        | Um selo com o nome do episódio ao passar (ex.: "Cotação respondida"). Os selos formam o álbum do aluno.                                                                                                   |
| **Sequência (streak)**     | Dias seguidos com pelo menos um capítulo assistido ou prova feita. Sem punição ao quebrar.                                                                                                                |
| **Nota perfeita**          | Selo extra para quem passa na 1ª tentativa com 5 de 5.                                                                                                                                                    |
| **Títulos da trilha**      | 25 %: "Iniciante"; 50 %: "Em campo"; 75 %: "Quase lá"; 100 % + desafio final: título do papel (ex.: "Fornecedor Wellmix certificado", "Comprador Wellmix certificado").                                   |
| **Certificado**            | Ao fechar a trilha: página/PDF com nome, papel, data, nota do desafio final e um código de verificação.                                                                                                   |
| **Painel do gestor**       | O administrador vê, por pessoa e por trilha: percentual, módulos concluídos, pontos fracos (perguntas mais erradas) e quem está parado há mais de X dias. Útil para convidar o parceiro que nunca entrou. |
| **Perguntas mais erradas** | Relatório por pergunta (taxa de erro): aponta a pergunta mal escrita ou o trecho do vídeo que ficou confuso. É a melhor fonte para melhorar vídeo e prova.                                                |

Tom: encorajador e direto, sem infantilizar. O treinamento é para profissionais; a recompensa é saber fazer o trabalho (e o selo).

## 5. Ordem e liberdade

- **Recomendada**: a ordem da trilha (`trilhas.yaml`), que acompanha a jornada (da entrada no portal ao pós-venda).
- **Livre**: a pessoa pode abrir qualquer módulo da sua trilha; o próximo módulo é apenas sugerido ("Continuar de onde parei").
- **Trava só em dois lugares**: o desafio final só abre com todos os módulos em 100 %; e a página de treinamento de uma pessoa só mostra a trilha do seu papel (mais o que o administrador liberar).
- Um mesmo login pode acumular mais de uma trilha (ex.: operador comprador + designer). O percentual de cada uma é separado.

## 6. O que o programa precisa guardar (sugestão de dados)

Só para a programação se orientar; o desenho final é do dono.

| Dado                  | Campos principais                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Progresso de capítulo | usuário, módulo, capítulo, `assistido_em`, maior ponto alcançado (s), versão do vídeo                    |
| Tentativa de prova    | usuário, módulo, `iniciada_em`, `terminada_em`, perguntas sorteadas, respostas, nota, aprovada (sim/não) |
| Resposta              | tentativa, pergunta, resposta dada, certa (sim/não), tempo                                               |
| Selo                  | usuário, módulo ou trilha, `conquistado_em`                                                              |
| Certificado           | usuário, trilha, nota do desafio, código, emitido em                                                     |

- **Versão do conteúdo**: cada módulo tem uma versão (a do vídeo + a do banco). Se o vídeo for regravado de forma que mude o que se faz na tela, aumente a versão: quem já tinha 100 % **mantém o selo**, mas ganha o aviso "Este vídeo foi atualizado" e a opção de rever sem perder nada.
- **Leitura só no servidor e escrita por Server Action com checagem de papel** (regra do projeto). O percentual é calculado no servidor; o navegador só envia "assisti até o segundo N" e as respostas, nunca a nota.
- **Gabarito nunca vai ao navegador antes da resposta.** A tela recebe enunciado e opções; a correção é feita no servidor, que devolve `correta` e `explicacao` depois.
- **Dados de demonstração**: o modo memória precisa de uma pessoa por papel já com progresso parcial, para os vídeos de treinamento e os testes.
- Esquema novo em `src/lib/db/schema.ts` é **aditivo** (docs/EVOLUTION_PLAN.md) e, quando o PR mexer nele, publicar no Supabase (docs/SUPABASE.md).

## 7. Decisões que dependem do dono

Os arquivos funcionam com qualquer escolha; ficam marcadas as sugestões.

| #   | Decisão                         | Sugestão                                                                                                                                                                                                                               |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Nota de aprovação**           | 80 % (4 de 5). Mais rígido (100 %) frustra; mais frouxo (60 %) deixa passar quem não aprendeu.                                                                                                                                         |
| 2   | **Obrigatório ou voluntário?**  | Para a equipe Wellmix, obrigatório nos primeiros 30 dias; para cliente e parceiro, voluntário, com convite e lembrete.                                                                                                                 |
| 3   | **Bloqueio do portal**          | Não bloquear nada por falta de treinamento. O treinamento convida; não impede o trabalho.                                                                                                                                              |
| 4   | **Quem vê o progresso**         | Administrador vê todos; diretoria vê a equipe; cada pessoa vê o seu. Cliente e parceiro: a Wellmix vê só o percentual e a data da conclusão, não as respostas.                                                                         |
| 5   | **Certificado**                 | Sim, com código, para a equipe e para parceiros (útil para fornecedor mostrar à sua chefia).                                                                                                                                           |
| 6   | **Idiomas da prova**            | pt para a equipe e o cliente; pt, en e zh para o fornecedor; pt, en e zh para a companhia marítima. As traduções em zh precisam de revisão por quem fala a língua.                                                                     |
| 7   | **Onde mora o vídeo**           | Depende da decisão 5 de [docs/videos/README.md](../videos/README.md) (YouTube não listado, Vimeo ou arquivo no próprio portal). O capítulo precisa de um player que aceite começar e parar em tempos marcados e informe o ponto atual. |
| 8   | **Quando um vídeo é regravado** | Quem já concluiu mantém o selo, com aviso e opção de rever (seção 6).                                                                                                                                                                  |
| 9   | **Prazo**                       | Sem prazo no começo. Depois, um lembrete por e-mail ou pelo sino para quem parou há mais de 7 dias.                                                                                                                                    |
| 10  | **Prova final da trilha**       | 10 perguntas, aprovação com 80 %, sem limite de tentativas, com 1 dia de espera após a 3ª reprovação (para estimular rever os vídeos).                                                                                                 |

## 8. Manter o conteúdo atualizado

1. Quando uma tela mudar e um episódio for regravado (tabela "Regravar" em docs/videos/README.md), abra o módulo do episódio e confira: **tempos dos capítulos**, **nomes de botões nas perguntas e nas explicações** e **respostas que dependem da regra que mudou**.
2. Rode `node scripts/treinamento-validar.mjs` depois de qualquer edição.
3. Use o relatório de "perguntas mais erradas" (seção 4): pergunta com mais de 60 % de erro é, quase sempre, enunciado ambíguo ou trecho do vídeo ruim. Corrija a pergunta antes de culpar o aluno.
4. Quando a matriz de telas de docs/ACCESS.md mudar, ajuste `trilhas.yaml` e a tabela de trilhas de docs/videos/README.md.

## 9. Sugestões para os vídeos de treinamento (não para o portal)

- Cada **capítulo** deve terminar com a ação concluída e a tela estável por 1 s: é o ponto de corte do mini vídeo.
- Grave o episódio **uma vez só** e corte nos capítulos na edição (não grave capítulo a capítulo): a narração e o ritmo ficam contínuos.
- No fim de cada **módulo**, uma tela de 3 s: "Agora vem a prova: 5 perguntas, você precisa acertar 4." Cria o gancho para o quiz.
- Para o **zh** e o **en** do fornecedor, a prova usa os mesmos nomes de botão que o vídeo mostra na tela.
