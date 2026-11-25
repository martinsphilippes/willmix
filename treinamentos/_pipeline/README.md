# Pipeline do treinamento em vídeo

Tudo roda nesta máquina. Nenhum serviço externo é chamado para voz, vídeo ou legendas.

## Peças

| Arquivo | O que faz |
| --- | --- |
| `normalizar.py` | Texto do roteiro → texto falado: números, moeda, datas, horas, %, unidades, siglas e as pronúncias de `_config/pronuncias.json`. `--teste` roda os casos embutidos |
| `motores/motor_*.py` | Um adaptador por motor de voz, cada um no seu ambiente |
| `audio.py` | Síntese frase a frase com cache, montagem com pausas, −16 LUFS e pico ≤ −1,5 dBTP, transcrição local e comparação com o roteiro |
| `narrar.py` | Narração de cada passo do `cenas.json`; grava `_build/audio/tempos.json` |
| `amostras_voz.py` | As amostras comparáveis da PARADA A |
| `lib.mjs` | Servidor de treino, pontos de salvamento, tela virtual, navegador, alvos |
| `overlays.js` | Camada didática injetada na página: cursor, destaque, rótulo, clique |
| `cena.mjs` | Executor de cena: ensaio e gravação |
| `gravar.mjs` | Ensaio + gravação de cada cena (Xvfb + ffmpeg) |
| `cartoes.mjs` | Cartões e sobreposições com a marca (PNG) |
| `montar.py` | Vídeo + narração + zoom + sobreposições → MP4 do módulo e `.vtt` |
| `prova/` | Cena de prova técnica (não é conteúdo de treinamento) |

## Ambientes

```bash
uv venv --python 3.12 .venv-kokoro     && uv pip install --python .venv-kokoro/bin/python --torch-backend=cpu "kokoro>=0.9.4" soundfile "misaki[en]"
uv venv --python 3.12 .venv-stt        && uv pip install --python .venv-stt/bin/python faster-whisper soundfile pyloudnorm num2words
uv venv --python 3.12 .venv-supertonic && uv pip install --python .venv-supertonic/bin/python supertonic soundfile
uv venv --python 3.11 .venv-chatterbox && uv pip install --python .venv-chatterbox/bin/python --torch-backend=cpu chatterbox-tts soundfile "setuptools<81"
uv venv --python 3.12 .venv-qwen       && uv pip install --python .venv-qwen/bin/python --torch-backend=cpu qwen-tts soundfile
```

O Chatterbox pt-BR usa o código da demonstração oficial (`ResembleAI/Chatterbox-Multilingual-TTS-pt-br`, baixado em `.cache/chatterbox-ptbr-space`) com os pesos `ResembleAI/Chatterbox-Multilingual-pt-br`. Os pesos de todos os motores ficam em `.cache/hf`.

## Formato do `cenas.json` (resumo)

```json
{
  "papel": "comprador",
  "conta": { "email": "operador@wellmix.com", "idioma": "pt" },
  "cenas": [{
    "id": "m1-c1", "modulo": 1, "tipo": "tela",
    "estado": "nome-do-ponto-de-salvamento", "salvar": "ponto-seguinte",
    "inicio": { "url": "/app/tasks" },
    "passos": [{
      "id": "p1",
      "fala": "Olha aqui no menu da esquerda: \"Pendências\". Clica nele.",
      "alvo": { "papel": "link", "nome": "Pendências" },
      "rotulo": "Pendências", "resumo": "Abra as Pendências",
      "acao": "clicar", "espera": { "url": "/app/tasks" },
      "destaque_em": { "em": "Pendências" }, "acao_em": "fim", "zoom": 1.3
    }]
  }]
}
```

Ações: `clicar`, `digitar`, `escolher`, `marcar`, `anexar`, `tecla`, `passar`, `ir`, `enviar`, `mostrar` (só explica). Alvos: seletor CSS, `{papel, nome}`, `{rotulo}`, `{texto}`.
