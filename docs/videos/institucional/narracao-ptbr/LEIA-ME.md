# Narração do vídeo completo (português do Brasil) para o ElevenLabs

O vídeo em português está pronto, **menos a voz**. Este pacote tem o texto da narração para você gerar a voz no ElevenLabs e me trazer o áudio; eu corto, monto, renderizo e entrego o vídeo.

## Arquivos

| Arquivo                                     | Para quê                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `parte-1.txt`, `parte-2.txt`, `parte-3.txt` | O texto para colar no ElevenLabs, uma parte de cada vez (26, 24 e 22 falas; menos de 2.000 caracteres cada)               |
| `roteiro-falas.csv`                         | As 72 falas numeradas (abre no Excel ou no Google Planilhas): parte, cena, texto da voz, texto original e dica de leitura |

## Passo a passo no ElevenLabs

1. **Escolha a voz.** Voices → Voice Library, com os filtros Idioma **Português**, Sotaque **Brasileiro** (Brazilian), Gênero **Feminina**, Uso **Narração** (narrative / corporate). Teste com o começo do `parte-1.txt` antes de decidir. A voz tem de soar do Brasil (palavras como "dia", "tipo" e "cidade" com "dji" e "tchi"), dizer "Uélmiks" (Wellmix) e as siglas com naturalidade.
2. **Modelo:** Eleven Multilingual v2 (o mais estável em português). O v3 também serve, se a sua conta tiver e você preferir mais emoção.
3. **Configurações sugeridas:** Stability 50 · Similarity 75 · Style 0 a 15 · Speaker boost ligado · Speed 1,0. Use **a mesma voz e as mesmas configurações nas três partes**.
4. **Gere a parte 1:** cole o `parte-1.txt` inteiro, sem editar, e gere. Ouça. Repita com `parte-2.txt` e `parte-3.txt`.
5. **Baixe** cada parte (MP3 na maior qualidade da sua conta; WAV, se tiver).
6. **Me envie os três arquivos** (o nome pode ser qualquer um, desde que traga 1, 2 ou 3 no nome).

Se uma frase sair estranha, não refaça tudo: me diga o número dela (coluna `id` do CSV, por exemplo `inspect.2`), que eu ajusto a grafia e você gera só aquela frase.

## Regras do texto

- **Um parágrafo é uma fala do vídeo.** Não junte nem separe parágrafos, não apague as linhas em branco e não acrescente nada (nem título de cena). É por esses parágrafos que o áudio volta a ser cortado.
- **As grafias estranhas são de propósito:** dizem à voz como ler nomes e siglas.

| Aparece no texto       | Lê-se                 | É                          |
| ---------------------- | --------------------- | -------------------------- |
| Uélmiks                | Wellmix               | o nome da empresa          |
| bê-éle                 | B, L                  | BL (documento de embarque) |
| érre-pê                | R, P                  | ERP                        |
| ésse-éle-á             | S, L, A               | SLA                        |
| imeiu, imeius          | e-mail                | e-mail                     |
| contêiner, contêineres | container             | container                  |
| Pékin list, ínvóis     | packing list, invoice | documentos de carga        |
| Plânner, Plânners      | planner               | função da equipe           |
| cômex                  | comex                 | comércio exterior          |

- **Control Tower** e **Book** ficam como estão (são nomes do portal).
- Pausas e velocidade: não precisa cuidar. O vídeo é montado em cima da sua narração: cada fala é cortada, e o tempo de cada cena se ajusta à duração dela.

## O que acontece depois

Cortar o áudio em 72 falas → montar a linha do tempo pela duração de cada fala → renderizar (uns 25 minutos) → misturar com a música → conferência independente → enviar o vídeo, sem legenda.

## Se preferir gerar fala por fala

Dá mais trabalho, mas também funciona: 72 arquivos com o nome do `id` (por exemplo `route.0.mp3`, `hub.2.mp3`), cada um com o texto da coluna `texto_para_a_voz`.
