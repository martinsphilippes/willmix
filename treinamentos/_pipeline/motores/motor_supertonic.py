"""Supertonic 3 (pesos OpenRAIL-M; código MIT). Vozes prontas F1–F5 e M1–M5."""
import warnings
warnings.filterwarnings("ignore")
import numpy as np
import soundfile as sf
from comum import Cronometro, carregar_trabalho, relatar
from supertonic import TTS

trab = carregar_trabalho()
op = trab.get("opcoes", {})
np.random.seed(int(trab.get("seed", 7)))
tts = TTS(model="supertonic-3", intra_op_num_threads=int(op.get("threads", 4)))
estilo = tts.get_voice_style(trab["voz"])
vel = float(trab.get("velocidade", 1.0))
passos = int(op.get("passos", 12))
tts.synthesize("Olá.", voice_style=estilo, lang="pt", speed=vel, total_steps=passos)
for item in trab["itens"]:
    with Cronometro() as c:
        wav, _ = tts.synthesize(item["texto"], voice_style=estilo, lang="pt", speed=vel,
                                total_steps=passos, silence_duration=0.0)
        a = np.asarray(wav, dtype=np.float32).squeeze()
    sf.write(item["saida"], a, tts.sample_rate, subtype="PCM_16")
    relatar(item["id"], len(a) / tts.sample_rate, c.tempo)
