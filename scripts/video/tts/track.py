"""
Trilha dos vídeos: edita a música escolhida pelo dono (music/track.mp3) para
caber em cada vídeo, cortando e emendando só em início de compasso.

    python tts/track.py out/<vídeo>.audio.json        → out/audio/<vídeo>.music.wav

A música (2 min 15 s, 120 BPM, compasso de 2 s) tem esta forma, em compassos:
introdução calma (0–3), subida (3–12), batida (12–19), pausa (19–21), parte
cheia D (21–37), pausa (37–39), ponte E (39–47), pausa (47–49), parte cheia F
(49–65) e final (65 em diante). D e F são iguais compasso a compasso e têm
frases de 8 compassos (medido por correlação do espectro), então dá para
saltar entre elas sem o ouvido perceber.

Encaixe em cada vídeo:
- a entrada da batida (compasso 12) cai no instante em que a marca aparece no
  centro (cena "hub");
- o vídeo curto toca até o fim de uma frase de D e salta para o final;
- o vídeo completo toca a música inteira e repete blocos (pausa + D + pausa +
  E + pausa + F) até a assinatura, onde entra o final.
O script avisa quanto o final da música ficou distante da assinatura, para o
roteiro ajustar a folga (build.mjs) quando precisar.

Sem música do dono (music/track.mp3 ausente), use a trilha sintetizada:
    python tts/audio.py music out/<vídeo>.audio.json
"""
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

SR = 48000
BAR = 2.0  # 120 BPM, 4/4
GRID = 0.098  # o primeiro tempo de cada compasso cai 0,113 s depois do segundo par; corta-se 15 ms antes
BEAT_IN, B1, D, B2, E, B3, F, OUT = 12, 19, 21, 37, 39, 47, 49, 65
XFADE = 0.03

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load():
    mp3 = os.path.join(ROOT, "music", "track.mp3")
    wav = os.path.join(ROOT, "music", "track.wav")
    if not os.path.exists(wav) or os.path.getmtime(wav) < os.path.getmtime(mp3):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", wav], check=True)
    x, sr = sf.read(wav)
    assert sr == SR
    return x


def at_bar(k):
    return GRID + BAR * k


def join(parts):
    """Emenda trechos com fusão curta de potência constante."""
    n = int(XFADE * SR)
    out = parts[0]
    for p in parts[1:]:
        t = np.linspace(0, np.pi / 2, n)[:, None]
        out = np.concatenate([out[:-n], out[-n:] * np.cos(t) + p[:n] * np.sin(t), p[n:]])
    return out


def main(path):
    plan = json.load(open(path, encoding="utf-8"))
    total = plan["duration"]
    at = {s["id"]: s for s in plan["scenes"]}
    hub = at["hub"]["at"]
    logo = plan.get("logo", at["end"]["at"] + 0.55)
    x = load()
    cut = lambda a, b: x[int(a * SR) : int(b * SR) + int(XFADE * SR)]

    # A batida entra com a marca: desloca a música em relação ao vídeo.
    shift = hub - (at_bar(BEAT_IN) + 0.015)  # > 0: a música começa depois; < 0: começa já adiantada
    start = max(0.0, -shift)
    lead = max(0.0, shift)

    def video_time(bars_after_first_pass):
        return lead + (at_bar(OUT) - start) + BAR * bars_after_first_pass

    if total < 135:
        # Curto: até o fim de uma frase de D e daí o final.
        options = [D + 8, D + 16]
        to = min(options, key=lambda b: abs((lead + at_bar(b) - start) - logo))
        parts = [cut(start, at_bar(to)), x[int(at_bar(OUT) * SR) :]]
        outro_at = lead + at_bar(to) - start
        desc = f"0 → compasso {to}, final"
    else:
        # Completo: música inteira até o fim de F e blocos repetidos até a assinatura.
        loops = {0: [], 28: [B2], 46: [B1], 56: [B2, B2], 74: [B1, B2], 92: [B1, B1], 102: [B1, B2, B2], 120: [B1, B1, B2]}
        n = min(loops, key=lambda b: abs(video_time(b) - logo))
        parts = [cut(start, at_bar(OUT))] + [cut(at_bar(b), at_bar(OUT)) for b in loops[n]] + [x[int(at_bar(OUT) * SR) :]]
        outro_at = video_time(n)
        desc = f"música inteira + {n} compassos repetidos (voltas a partir dos compassos {loops[n]}), final"
    y = join(parts)
    if start > 0:
        k = int(0.5 * SR)
        y[:k] *= np.linspace(0, 1, k)[:, None] ** 2
    y = np.concatenate([np.zeros((int(lead * SR), 2)), y])
    n_total = int(total * SR)
    y = np.concatenate([y, np.zeros((max(0, n_total - len(y)), 2))])[:n_total]
    k = int(0.9 * SR)
    y[-k:] *= np.linspace(1, 0, k)[:, None] ** 1.5
    out = os.path.join(os.path.dirname(os.path.abspath(path)), "audio", os.path.basename(path).replace(".audio.json", ".music.wav"))
    sf.write(out, y, SR, subtype="PCM_16")
    end_of_music = outro_at + (len(x) / SR - at_bar(OUT))
    print(f"{out}: {desc}")
    print(f"  batida com a marca em {hub:.2f} s; final da música começa em {outro_at:.2f} s (assinatura em {logo:.2f} s: diferença {outro_at - logo:+.2f} s)")
    print(f"  a música termina em {end_of_music:.2f} s; o vídeo tem {total:.2f} s (sobra {total - end_of_music:+.2f} s)")


if __name__ == "__main__":
    main(sys.argv[1])
