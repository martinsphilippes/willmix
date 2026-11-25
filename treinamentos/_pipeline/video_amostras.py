#!/usr/bin/env python3
"""Junta as amostras de voz num vídeo só (letra e nome na tela), para ouvir em
qualquer aparelho quando o tocador de áudio não funcionar."""
import subprocess
from pathlib import Path

AM = Path(__file__).resolve().parent.parent / "_config" / "amostras-voz"
B = AM / "_build"
NEG, MED = "/usr/share/fonts/opentype/inter/Inter-Bold.otf", "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
import sys
from rodadas import RODADAS

RODADA = int(sys.argv[1]) if len(sys.argv) > 1 else max(RODADAS)
VOZES = [(l, i, n) for l, i, n, _ in RODADAS[RODADA]["vozes"] if (AM / f"{i}.wav").exists()]


def dur(arq):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                 str(arq)], capture_output=True, text=True, check=True).stdout)


B.mkdir(exist_ok=True)
partes = []
for i, (letra, ident, nome) in enumerate(VOZES, 1):
    d = dur(AM / f"{ident}.wav") + 1.0
    for nome_arq, texto in (("l.txt", letra), ("n.txt", nome), ("k.txt", f"Amostra {i} de {len(VOZES)}")):
        (B / nome_arq).write_text(texto, encoding="utf-8")
    seg = B / f"r{RODADA}_seg_{i}.mp4"
    vf = (f"drawbox=x=0:y=0:w=1280:h=14:color=0xBF2026:t=fill,"
          f"drawtext=fontfile={NEG}:textfile={B / 'l.txt'}:fontsize=220:fontcolor=white:x=(w-text_w)/2:y=170,"
          f"drawtext=fontfile={MED}:textfile={B / 'n.txt'}:fontsize=44:fontcolor=white:x=(w-text_w)/2:y=450,"
          f"drawtext=fontfile={MED}:textfile={B / 'k.txt'}:fontsize=30:fontcolor=0xB9B4B6:x=(w-text_w)/2:y=540")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-t", f"{d:.2f}", "-i",
                    "color=c=0x17181C:s=1280x720:r=30", "-i", str(AM / f"{ident}.wav"),
                    "-filter_complex", f"[0:v]{vf}[v];[1:a]apad=whole_dur={d:.2f}[a]", "-map", "[v]", "-map", "[a]",
                    "-t", f"{d:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-tune", "stillimage",
                    "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
                    str(seg)], check=True)
    partes.append(seg)
lista = B / "lista.txt"
lista.write_text("".join(f"file '{p}'\n" for p in partes), encoding="utf-8")
saida = AM / (f"amostras-de-voz-rodada-{RODADA}.mp4" if RODADA > 1 else "amostras-de-voz.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy",
                "-movflags", "+faststart", str(saida)], check=True)
print(saida, round(dur(saida), 1), "s", round(saida.stat().st_size / 1e6, 2), "MB")
