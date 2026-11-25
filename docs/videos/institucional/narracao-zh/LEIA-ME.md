# Narração do vídeo completo em mandarim para o ElevenLabs

O vídeo em mandarim está pronto, **menos a voz**: roteiro em chinês simplificado, telas do portal em chinês e a mesma montagem da versão em português. Este pacote tem o texto da narração para você gerar a voz no ElevenLabs e me trazer o áudio; eu corto, monto, renderizo e entrego o vídeo. Você não precisa entender o chinês: é copiar e colar o texto inteiro.

## Arquivos

| Arquivo                                     | Para quê                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `parte-1.txt`, `parte-2.txt`, `parte-3.txt` | O texto em chinês para colar no ElevenLabs, uma parte de cada vez                                                      |
| `roteiro-falas.csv`                         | As 72 falas numeradas (abre no Excel ou no Google Planilhas): parte, cena, texto em chinês e a mesma fala em português |
| `para-quem-vai-ouvir.md`                    | Um recado pronto, em chinês, para encaminhar a alguém que fale mandarim e possa ouvir o resultado                      |

O texto todo tem 72 falas e cerca de 1.600 caracteres (608, 517 e 446 nas três partes).

## Passo a passo no ElevenLabs

1. **Escolha a voz.** Voices → Voice Library, com os filtros Idioma **Chinese** (chinês; às vezes aparece como Mandarin), Gênero **Female**, Uso **Narration** (narrative, informative ou corporate). Prefira uma voz cuja descrição diga mandarim nativo (Mandarin, Mainland China, Standard, Beijing). **Evite** as marcadas como Taiwan ou Cantonese: o público do vídeo é a China continental, e cantonês é outro idioma.
2. **Idioma do texto:** se a tela tiver o campo Language (na sua estava em "Auto"), escolha **Chinese**. Em "Auto" o modelo pode trocar de idioma nas frases curtas que têm palavras em inglês (Wellmix, Book, ERP).
3. **Modelo:** o mesmo que você usou na versão em português (o mais novo da sua conta). O Eleven Multilingual v2 também serve.
4. **Configurações:** as mesmas da versão em português: Stability 50 · Similarity 75 · Style 0 a 15 · Speaker boost ligado · Speed 1,0. Use **a mesma voz e as mesmas configurações nas três partes**.
5. **Gere a parte 1:** cole o `parte-1.txt` inteiro, sem editar, e gere. Repita com `parte-2.txt` e `parte-3.txt`.
6. **Baixe** cada parte (MP3 na maior qualidade da sua conta; WAV, se tiver).
7. **Me envie os três arquivos** (o nome pode ser qualquer um).

## Regras do texto

- **Um parágrafo é uma fala do vídeo.** Não junte nem separe parágrafos, não apague as linhas em branco e não acrescente nada. É por esses parágrafos que o áudio volta a ser cortado.
- As palavras em letras latinas (**Wellmix**, **Book**, **ERP**, **SLA**) ficam como estão: em mandarim a voz lê o nome em inglês e as siglas letra por letra.
- Pausas e velocidade: não precisa cuidar. O vídeo é montado em cima da sua narração: cada fala é cortada, e o tempo de cada cena se ajusta à duração dela.
- Se um dia for gerar de novo uma fala só (porque alguém apontou um erro), gere junto a fala de antes ou a de depois, no mesmo texto: uma frase curta sozinha que começa com palavra em inglês (Wellmix, Book, SLA) pode sair com sotaque de inglês.

## Como eu confiro o áudio

- Transcrição automática em chinês de cada fala, comparada com o roteiro caractere a caractere (se uma fala sair diferente do texto, eu aviso qual é e você gera só ela de novo).
- Velocidade de cada fala, cortes medidos no som e volume das três partes.
- **O que eu não consigo conferir:** se a voz soa natural para um chinês (sotaque, entonação) e a leitura dos caracteres que têm duas pronúncias: a transcrição escreve o mesmo caractere nos dois casos. O roteiro já evita os casos de maior risco, mas vale pedir a alguém que fale mandarim (um contato da fábrica ou da trading) para ouvir antes de publicar; o recado para essa pessoa está pronto em `para-quem-vai-ouvir.md`.

## O que acontece depois

Cortar o áudio em 72 falas → montar a linha do tempo pela duração de cada fala → renderizar (uns 40 minutos) → misturar com a música → conferência → enviar o vídeo, sem legenda.

## Se preferir gerar fala por fala

Dá mais trabalho, mas também funciona: 72 arquivos com o nome do `id` (por exemplo `route.0.mp3`, `hub.2.mp3`), cada um com o texto da coluna `texto_para_a_voz`.
