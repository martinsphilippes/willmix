"""Kokoro-82M (Apache-2.0, código e pesos). Vozes pt-BR: pf_dora, pm_alex, pm_santa.

O texto vira fonemas (G2P pt-BR), as correções de `_config/pronuncias.json`
("fonemas_kokoro") são aplicadas sobre os fonemas e a síntese parte deles: é assim
que a marca sai exatamente como UÉL-miks (/wˈɛʊmiks/, duas sílabas).
"""
import json
import warnings
warnings.filterwarnings("ignore")
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from comum import Cronometro, carregar_trabalho, relatar

trab = carregar_trabalho()
torch.set_num_threads(int(trab.get("opcoes", {}).get("threads", 4)))
torch.manual_seed(int(trab.get("seed", 7)))
from kokoro import KPipeline

PRON = Path(__file__).resolve().parents[2] / "_config" / "pronuncias.json"
TROCAS = json.loads(PRON.read_text(encoding="utf-8")).get("fonemas_kokoro", []) if PRON.exists() else []

pipe = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M")
voz, vel = trab["voz"], float(trab.get("velocidade", 1.0))
# Aquecimento: a primeira síntese carrega a voz e distorce a medição.
for _ in pipe("Olá.", voice=voz, speed=vel):
    pass
for item in trab["itens"]:
    with Cronometro() as c:
        ps, _ = pipe.g2p(item["texto"])
        for troca in TROCAS:
            ps = ps.replace(troca["de"], troca["para"])
        partes = []
        # O modelo aceita até 510 fonemas por vez; frase maior é dividida nas pausas.
        blocos, atual = [], ""
        for pedaco in ps.replace(", ", ",\n").replace(": ", ":\n").split("\n") if len(ps) > 500 else [ps]:
            if len(atual) + len(pedaco) + 1 > 500 and atual:
                blocos.append(atual); atual = pedaco
            else:
                atual = (atual + " " + pedaco).strip()
        if atual:
            blocos.append(atual)
        for bloco in blocos:
            for r in pipe.generate_from_tokens(bloco[:510], voice=voz, speed=vel):
                a = r.audio
                partes.append(a.numpy() if hasattr(a, "numpy") else np.asarray(a))
        a = np.concatenate(partes) if partes else np.zeros(1, dtype=np.float32)
    sf.write(item["saida"], a, 24000, subtype="PCM_16")
    relatar(item["id"], len(a) / 24000, c.tempo, fonemas=ps)
