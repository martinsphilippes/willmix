"""Piper (vozes pt_BR de falantes brasileiros; dados CC0: faber, cadu, jeff).

Vozes treinadas com gravações doadas para síntese de voz (OHF-Voice/voice-datasets,
CC0). Rápido em CPU. O texto vira fonemas de português do Brasil (espeak-ng pt-br).
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np
import soundfile as sf
from huggingface_hub import hf_hub_download
from comum import Cronometro, carregar_trabalho, relatar
from piper import PiperVoice, SynthesisConfig

trab = carregar_trabalho()
op = trab.get("opcoes", {})
nome = trab["voz"]  # faber | cadu | jeff
qual = op.get("qualidade", "medium")
base = f"pt/pt_BR/{nome}/{qual}/pt_BR-{nome}-{qual}"
modelo = hf_hub_download("rhasspy/piper-voices", base + ".onnx")
hf_hub_download("rhasspy/piper-voices", base + ".onnx.json")
voz = PiperVoice.load(modelo)
# velocidade 1.0 = normal; no Piper, length_scale maior = mais devagar.
cfg = SynthesisConfig(length_scale=1.0 / float(trab.get("velocidade", 1.0)),
                      noise_scale=float(op.get("variacao", 0.667)),
                      noise_w_scale=float(op.get("variacao_ritmo", 0.8)))
list(voz.synthesize("Olá.", syn_config=cfg))
for item in trab["itens"]:
    with Cronometro() as c:
        pedacos = [ch.audio_float_array for ch in voz.synthesize(item["texto"], syn_config=cfg)]
        a = np.concatenate(pedacos) if pedacos else np.zeros(1, dtype=np.float32)
    sr = voz.config.sample_rate
    sf.write(item["saida"], a, sr, subtype="PCM_16")
    relatar(item["id"], len(a) / sr, c.tempo)
