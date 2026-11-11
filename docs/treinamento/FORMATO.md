# Formato dos dados de treinamento

Cada episódio de [docs/videos](../videos/README.md) vira um **módulo** de treinamento. O arquivo do módulo fica em `docs/treinamento/modulos/<SÉRIE>/<ID>.yaml` (por exemplo `modulos/FOR/FOR-02.yaml`) e traz, num só lugar, tudo o que a programação precisa: os capítulos do vídeo (os "mini vídeos") e o banco de perguntas.

A mecânica (percentuais, aprovação, trilhas) está em [README.md](README.md). Este arquivo só define **como os dados são escritos**. Rode `node scripts/treinamento-validar.mjs` para conferir tudo.

## Estrutura do arquivo

```yaml
episodio: FOR-02 # o ID do episódio, igual ao do roteiro
titulo: Responder à solicitação do Booking
serie: FOR
papel: fornecedor # papel de quem assiste (ver docs/ACCESS.md)
duracao: "3:30" # a duração-alvo do roteiro, m:ss
idiomas: [pt, en, zh] # os idiomas em que o módulo existe (pt sempre)
capitulos:
  - id: FOR-02-C1
    titulo: Onde chega a solicitação
    inicio: "0:12" # início no vídeo, m:ss (vem dos tempos das cenas do roteiro)
    fim: "1:05"
    cenas: [2, 4] # da cena 2 à 4 do roteiro
    resumo: Uma frase do que se aprende neste trecho.
perguntas:
  - id: FOR-02-Q1
    tipo: unica
    nivel: 1
    capitulo: FOR-02-C1
    cena: 3
    enunciado: "Texto da pergunta."
    opcoes:
      a: "Primeira alternativa"
      b: "Segunda alternativa"
      c: "Terceira alternativa"
      d: "Quarta alternativa"
    correta: [b]
    explicacao: "Por que b está certa, com o nome real do botão ou da tela."
    traducoes: # só nos módulos com idiomas além do pt
      en:
        enunciado: "..."
        opcoes: { a: "...", b: "...", c: "...", d: "..." }
        explicacao: "..."
      zh:
        enunciado: "..."
        opcoes: { a: "...", b: "...", c: "...", d: "..." }
        explicacao: "..."
```

## Capítulos (os mini vídeos)

- Cada episódio tem de **2 a 4 capítulos**, de 45 s a 2 min. O capítulo é a unidade que o aluno vê, revê e marca como assistida; o vídeo inteiro continua existindo para quem quiser ver direto.
- Os tempos `inicio` e `fim` vêm dos tempos das cenas no roteiro (`Cena 4 · 1:05–1:30`). Os capítulos juntos cobrem o vídeo, sem buraco nem sobreposição.
- O **gancho** (cena 1) e o **fechamento** (última cena) entram no primeiro e no último capítulo.
- O título do capítulo é uma ação ("Responder com preço e prazo"), não um assunto.

## Perguntas

Cada módulo tem um **banco de 8 perguntas** (o GER-00, 10). A prova sorteia 5 do banco (README, seção 3), então todas precisam ser boas.

### Tipos

| `tipo`     | Como responde                    | `opcoes`                               | `correta`                         |
| ---------- | -------------------------------- | -------------------------------------- | --------------------------------- |
| `unica`    | escolhe uma entre 3 e 4          | `a`, `b`, `c` (e `d`)                  | uma letra: `[b]`                  |
| `multipla` | marca todas as certas (de 4 a 5) | `a` a `e`                              | duas ou mais letras: `[a, c]`     |
| `vf`       | verdadeiro ou falso              | `a: Verdadeiro`, `b: Falso`            | `[a]` ou `[b]`                    |
| `ordem`    | coloca os passos na ordem certa  | de 3 a 5 passos (as letras são só ids) | a sequência completa: `[c, a, b]` |

Em `ordem`, a tela embaralha os passos; `correta` é a ordem certa.

### Nível

- `1` · **Lembrar**: onde fica, como se chama, qual botão.
- `2` · **Aplicar**: a ordem dos passos, o que acontece depois de uma ação.
- `3` · **Decidir**: uma situação real ("O fornecedor respondeu X, o que você faz?") em que é preciso escolher.

Distribuição por módulo de 8: **2 de nível 1, 3 de nível 2, 3 de nível 3** (no GER-00, de 10: pelo menos 2 de nível 1 e 3 de nível 3). Pelo menos metade em formato de situação (nível 3 ou enunciado que descreve um caso).

### Regras de redação

1. **Só o que o vídeo ensina.** Cada pergunta se apoia no roteiro do episódio (cenas, "Passo a passo em texto", "Erros comuns"). Nada de curiosidade, cor, duração ou número que não importe para o trabalho.
2. **Nomes reais da tela.** Botões, abas, situações e mensagens como aparecem no portal, entre aspas ou em negrito (`**Enviar**`). As mensagens de erro vêm de "Erros comuns".
3. **Alternativas erradas plausíveis**: o erro que a pessoa de fato cometeria (os "Erros comuns" são a melhor fonte). Nada de alternativa absurda, "todas as anteriores" ou "nenhuma das anteriores".
4. **Sem pista no formato**: a certa não é a mais longa nem a mais detalhada; varie a letra da certa entre as perguntas.
5. **Uma ideia por pergunta**; enunciado de até 2 frases (situação) e alternativas curtas.
6. **A explicação ensina**: 1 a 3 frases, diz por que a certa está certa e, quando ajuda, por que a tentação errada não serve. É o que o aluno lê quando erra.
7. **`cena`** é o número da cena do roteiro onde a resposta aparece. A tela usa isso para o botão "Rever este trecho" (leva ao capítulo que contém a cena).
8. **Não pergunte o que está em "Pontos a confirmar"** do episódio, nem o que está em [ACHADOS.md](../videos/ACHADOS.md): a regra ainda não é firme.
9. **Pergunte sobre o que o papel faz**, não sobre o código ou o banco de dados.
10. Tom do portal: segunda pessoa, direto, sem jargão sem explicar.

### Idiomas

- O módulo é escrito em **pt**. Quando o episódio tem outros idiomas (FOR e MAR: en e zh), cada pergunta traz `traducoes` com `en` e `zh`, com as mesmas letras de `opcoes`, e os capítulos trazem `titulo_en`, `titulo_zh`, `resumo_en` e `resumo_zh`.
- Os nomes de botões e telas ficam como estão no portal **naquele idioma** (use os de `src/i18n`). Uma revisão por falante nativo é necessária antes de publicar o zh.
- Os campos `tipo`, `nivel`, `capitulo`, `cena` e `correta` não se traduzem.

## O que o validador confere

`node scripts/treinamento-validar.mjs` falha se: o ID não bate com o nome do arquivo; faltam campos; há menos de 2 ou mais de 4 capítulos; os capítulos têm buraco, sobreposição ou tempo fora da duração; o banco não tem 8 perguntas (10 no GER-00); há menos de 2 perguntas de nível 1 ou de 3 de nível 3; o tipo não bate com `opcoes` e `correta`; uma letra de `correta` não existe; `cena` ou `capitulo` apontam para algo inexistente; a explicação está vazia; ou falta tradução num módulo multilíngue. Avisa (sem falhar) se a certa for sempre a mesma letra ou a mais longa em mais de 60 % das perguntas.
