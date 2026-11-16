"""Qwen3-TTS (Apache-2.0, código e pesos). CustomVoice 0.6B: vozes prontas."""
import warnings
warnings.filterwarnings("ignore")
import soundfile as sf
import torch
from comum import Cronometro, carregar_trabalho, relatar
from qwen_tts import Qwen3TTSModel

trab = carregar_trabalho()
op = trab.get("opcoes", {})
torch.set_num_threads(int(op.get("threads", 4)))
m = Qwen3TTSModel.from_pretrained(op.get("modelo", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"),
                                  device_map="cpu", dtype=torch.float32)
for i, item in enumerate(trab["itens"]):
    torch.manual_seed(int(trab.get("seed", 7)) + i)
    with Cronometro() as c:
        kw = {"instruct": op["instrucao"]} if op.get("instrucao") else {}
        wavs, sr = m.generate_custom_voice(text=item["texto"], language="Portuguese",
                                           speaker=trab["voz"], **kw)
    sf.write(item["saida"], wavs[0], sr, subtype="PCM_16")
    relatar(item["id"], len(wavs[0]) / sr, c.tempo)
