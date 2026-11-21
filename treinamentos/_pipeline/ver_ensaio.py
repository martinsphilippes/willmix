#!/usr/bin/env python3
"""Folha de conferência do ENSAIO de uma cena: cada tela parada com a caixa do alvo desenhada,
para ver, antes de gravar, se cada passo aponta para o lugar certo.

Uso: python3 ver_ensaio.py <pasta-do-papel> <cena> [<cena> ...] [--saida pasta] [--colunas 3]
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith("--")}
args = [a for a in args if a not in opt.values()]
pasta, cenas = Path(args[0]).resolve(), args[1:]
saida = Path(opt.get("saida", pasta / "_build" / "ensaio"))
saida.mkdir(parents=True, exist_ok=True)
colunas = int(opt.get("colunas", 3))
fonte = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
L, A = 960, 540
for cena in cenas:
    q = json.loads((pasta / "_build" / "quadros" / cena / "quadros.json").read_text())
    itens = []
    for p in q:
        arq = pasta / "_build" / "quadros" / cena / f"{p['passo']}.png"
        if not arq.exists():
            continue
        im = Image.open(arq).convert("RGB")
        d = ImageDraw.Draw(im)
        cx = p.get("caixa")
        if cx:
            d.rectangle([cx["x"] - 4, cx["y"] - 4, cx["x"] + cx["w"] + 4, cx["y"] + cx["h"] + 4], outline=(255, 0, 255), width=6)
        d.rectangle([0, 0, 520, 50], fill=(0, 0, 0))
        d.text((10, 6), f"{cena.split('-', 1)[-1]} {p['passo']}" + ("" if cx else " (sem alvo)"), font=fonte, fill=(255, 255, 0))
        itens.append(im.resize((L, A)))
    fim = pasta / "_build" / "quadros" / cena / "_fim.png"
    if fim.exists():
        im = Image.open(fim).convert("RGB"); d = ImageDraw.Draw(im); d.rectangle([0, 0, 520, 50], fill=(0, 0, 0)); d.text((10, 6), "fim", font=fonte, fill=(0, 255, 255))
        itens.append(im.resize((L, A)))
    por_folha = colunas * 4
    for f in range(0, len(itens), por_folha):
        bloco = itens[f:f + por_folha]
        linhas = (len(bloco) + colunas - 1) // colunas
        folha = Image.new("RGB", (L * colunas, A * linhas), "white")
        for i, im in enumerate(bloco):
            folha.paste(im, ((i % colunas) * L, (i // colunas) * A))
        destino = saida / f"{cena}-{f // por_folha + 1}.png"
        folha.save(destino)
        print(destino)
