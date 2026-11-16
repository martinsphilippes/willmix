#!/usr/bin/env python3
"""Auditoria de um módulo: um quadro por passo (antes e depois da ação) em folhas de
4 quadros, volume, silêncios longos e as divergências do STT.
Uso: python3 auditar.py <pasta-do-papel> [modulo]"""
import json, math, subprocess, sys
from pathlib import Path

pasta = Path(sys.argv[1]).resolve(); n = sys.argv[2] if len(sys.argv) > 2 else "1"
b = pasta / "_build"; out = b / "auditoria" / f"m{n}"; out.mkdir(parents=True, exist_ok=True)  # uma pasta por módulo
video = pasta / f"modulo-{n}.mp4"
mod = json.loads((b / f"modulo-{n}.json").read_text())
pontos = []
for c in mod["cenas"]:
    arq = b / "video" / f"{c['cena']}.json"
    if not arq.exists():
        pontos.append((c["cena"], "cartao", c["inicio"] + min(2.0, c["duracao"] / 2))); continue
    for p in json.loads(arq.read_text())["passos"]:
        ev = {e["tipo"]: e["t"] for e in p["eventos"]}
        t = ev["acao"] - 0.25 if "acao" in ev else ev["destaque"] + 1.2 if "destaque" in ev else p["inicio"] + 1.5
        pontos.append((c["cena"], p["passo"], c["inicio"] + min(t, p["fim"] - 0.1)))
        if "resultado" in ev:
            pontos.append((c["cena"], p["passo"] + "+", c["inicio"] + min(ev["resultado"] + 0.9, p["fim"] - 0.1)))
fonte = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
for i, (cena, passo, t) in enumerate(pontos):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", "-vf",
        f"scale=960:540,drawtext=fontfile={fonte}:text='{i:02d} {cena} {passo} {t:.1f}s':x=8:y=8:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7",
        str(out / f"f{i:02d}.png")], check=True)
folhas = math.ceil(len(pontos) / 4)
for k in range(folhas):
    arqs = [str(out / f"f{i:02d}.png") for i in range(k * 4, min(len(pontos), k * 4 + 4))]
    arqs += [arqs[-1]] * (4 - len(arqs))
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for a in arqs: cmd += ["-i", a]
    subprocess.run(cmd + ["-filter_complex", "[0][1]hstack[a];[2][3]hstack[b];[a][b]vstack", str(out / f"folha{k:02d}.png")], check=True)
linha = ""
for i, (c, p, t) in enumerate(pontos):
    if i % 4 == 0:
        if linha: print(linha)
        linha = f"folha{i // 4:02d}: "
    linha += f"{c}/{p}@{t:.0f}s  "
print(linha)
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af",
    "loudnorm=I=-16:TP=-1.5:print_format=summary,silencedetect=noise=-45dB:d=2.5", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
for l in r.splitlines():
    if "Input Integrated" in l or "Input True Peak" in l or "silence_duration" in l: print(l.split("] ")[-1].strip())
q = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames",
    "-show_entries", "format=duration", "-of", "csv=p=0", str(video)], capture_output=True, text=True).stdout.split()
print("quadros", q[0], "· duração", q[1], "s ·", round(int(q[0]) / float(q[1]), 2), "qps")
t = json.loads((b / "audio" / "tempos.json").read_text())
print("STT:", [(c, k, v["diferencas"]) for c, ps in t.items() for k, v in ps.items() if v.get("diferencas")])
