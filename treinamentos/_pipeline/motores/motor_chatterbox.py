"""Chatterbox Multilingual pt-BR (MIT, código e pesos; ResembleAI/Chatterbox-Multilingual-pt-br).

A voz vem de um áudio de referência. Regra do projeto: NUNCA uma pessoa real.
Usamos a voz embutida do modelo ("embutida") ou uma referência sintética
gerada por outro motor local (opcoes.referencia = caminho do WAV sintético).
"""
import sys
import warnings
warnings.filterwarnings("ignore")
from pathlib import Path
import torch
import soundfile as sf
from comum import Cronometro, carregar_trabalho, relatar

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / ".cache" / "chatterbox-ptbr-space" / "chatterbox" / "src"))
from chatterbox.tts import ChatterboxTTS  # código da demo oficial pt-BR (V3)

trab = carregar_trabalho()
op = trab.get("opcoes", {})
torch.set_num_threads(int(op.get("threads", 4)))
m = ChatterboxTTS.from_pretrained("cpu")
ref = op.get("referencia")
if ref and trab["voz"] != "embutida":
    m.prepare_conditionals(ref, exaggeration=float(op.get("expressividade", 0.5)))
for i, item in enumerate(trab["itens"]):
    torch.manual_seed(int(trab.get("seed", 7)) + i)
    with Cronometro() as c, torch.inference_mode():
        wav = m.generate(item["texto"], language_id="pt",
                         exaggeration=float(op.get("expressividade", 0.5)),
                         temperature=float(op.get("temperatura", 0.7)),
                         cfg_weight=float(op.get("cfg", 0.5)))
        a = wav.squeeze(0).cpu().numpy()
    sf.write(item["saida"], a, m.sr, subtype="PCM_16")
    relatar(item["id"], len(a) / m.sr, c.tempo)
