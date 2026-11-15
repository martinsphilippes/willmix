"""
Narração dos vídeos institucionais: voz sintética em inglês, gerada na própria
máquina (modelo aberto Kokoro; nenhum texto sai para serviço externo).

    python tts/tts.py out/<vídeo>.tts.json [--voice af_heart] [--speed 1.0]

Lê a lista de falas gravada por `node build.mjs <vídeo> --tts` e grava um WAV
(48 kHz, mono) por fala. Só refaz a fala cujo texto, voz ou velocidade mudou.
Modelos (não versionados): tts/models/kokoro-v1.0.onnx e voices-v1.0.bin, de
https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
"""
import argparse
import hashlib
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("KOKORO_MODELS", os.path.join(HERE, "models"))


def trim(x, sr, floor=0.012, pad=0.045):
    """Tira o silêncio das pontas, deixando uma folga curta."""
    loud = np.where(np.abs(x) > floor)[0]
    if len(loud) == 0:
        return x
    a = max(0, loud[0] - int(pad * sr))
    b = min(len(x), loud[-1] + int(pad * 2 * sr))
    y = x[a:b].copy()
    n = int(0.008 * sr)
    y[:n] *= np.linspace(0, 1, n)
    y[-n:] *= np.linspace(1, 0, n)
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("list")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=1.0)
    args = ap.parse_args()
    items = json.load(open(args.list, encoding="utf-8"))
    kokoro = None
    made = 0
    for it in items:
        key = hashlib.sha1(f"{it['text']}|{args.voice}|{args.speed}".encode()).hexdigest()
        mark = it["file"] + ".key"
        if os.path.exists(it["file"]) and os.path.exists(mark) and open(mark).read() == key:
            continue
        if kokoro is None:
            kokoro = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
        samples, sr = kokoro.create(it["text"], voice=args.voice, speed=args.speed, lang="en-us")
        y = resample_poly(trim(samples.astype(np.float64), sr), 2, 1)  # 24 kHz → 48 kHz
        y /= max(1.0, np.abs(y).max() / 0.97)  # sem estouro no WAV de 16 bits
        os.makedirs(os.path.dirname(it["file"]), exist_ok=True)
        sf.write(it["file"], y.astype(np.float32), sr * 2, subtype="PCM_16")
        open(mark, "w").write(key)
        made += 1
        print(f"{os.path.basename(it['file'])}  {len(y) / (sr * 2):5.2f} s  {it['text'][:70]}")
    print(f"{made} falas geradas, {len(items) - made} já prontas")


if __name__ == "__main__":
    sys.exit(main())
