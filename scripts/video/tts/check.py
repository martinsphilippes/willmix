"""
Conferência da narração: transcreve cada fala (Whisper, na própria máquina) e
compara com o texto do roteiro. Quem escreve o roteiro não ouve o áudio; esta
conferência pega palavra engolida ou pronúncia que virou outra palavra.

    python tts/check.py out/<vídeo>.tts.json
"""
import json
import re
import sys
from difflib import SequenceMatcher

import soundfile as sf
from faster_whisper import WhisperModel
from scipy.signal import resample_poly

norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ")).split()
model = WhisperModel("small.en", device="cpu", compute_type="int8")
bad = 0
items = json.load(open(sys.argv[1], encoding="utf-8"))
for it in items:
    x, sr = sf.read(it["file"], dtype="float32")
    audio = resample_poly(x, 16000, sr).astype("float32")  # o Whisper ouve em 16 kHz
    segs, _ = model.transcribe(audio, language="en", beam_size=3, initial_prompt="Wellmix Portal, ERP, Comex, BL.")
    heard = " ".join(s.text.strip() for s in segs)
    ratio = SequenceMatcher(None, norm(it["text"]), norm(heard)).ratio()
    if ratio < 0.93:
        bad += 1
        print(f"{ratio:.2f}  {it['file'].split('/')[-1]}\n      roteiro: {it['text']}\n      ouvido:  {heard}")
print(f"{len(items) - bad} de {len(items)} falas conferem com o roteiro")
