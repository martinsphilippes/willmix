# Produção dos vídeos institucionais

Gera os vídeos de `docs/videos/institucional/` (curto e completo, narração em inglês, legenda em português ou mandarim): o roteiro, as telas reais do portal, a voz, a música e a imagem, renderizada quadro a quadro. O que cada vídeo diz, o mapa de benefícios e o passo a passo para refazer estão em [docs/videos/institucional/README.md](../../docs/videos/institucional/README.md).

| Arquivo                        | Papel                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `script.mjs`                   | Roteiro: cenas, narração (en) e legendas (pt, zh)                                               |
| `build.mjs`                    | Linha do tempo a partir da duração real das falas; legendas `.srt`                              |
| `scrub.mjs`, `shots.mjs`       | Base de demonstração apresentável e captura das telas do portal                                 |
| `tts/tts.py`, `tts/check.py`   | Voz sintética (na máquina) e conferência por transcrição                                        |
| `tts/track.py`, `tts/audio.py` | Música do dono cortada nos compassos; faixa de voz (e uma trilha sintetizada de reserva)        |
| `film/`                        | O palco: `index.html`, `film.css` (visual e animações), `film.js` (motor) e `scenes.js` (cenas) |
| `map.mjs`, `icons.mjs`         | Mapa-múndi e ícones usados pelo palco (gerados dos pacotes npm)                                 |
| `render.mjs`, `still.mjs`      | Renderização do filme e quadros soltos para conferência                                         |
| `mix.mjs`                      | Mixagem e fechamento: vinheta do portal + filme + áudio                                         |
| `music/track.mp3`              | A música enviada pelo dono em 15/11/2026                                                        |

As dependências daqui (`package.json` desta pasta e os pacotes Python `kokoro-onnx`, `soundfile`, `scipy` e `faster-whisper`, do passo 2 de docs/videos/institucional/README.md) são só da produção dos vídeos: o portal não usa nenhuma. No sentido contrário, os scripts usam o `playwright` instalado na raiz do portal (`npm ci` na raiz) e o `ffmpeg` da máquina. `out/`, as telas capturadas, o mapa e os ícones gerados e os modelos da voz não são versionados.
