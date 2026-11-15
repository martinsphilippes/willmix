"""
Áudio dos vídeos institucionais: monta a faixa de voz e compõe a trilha.

    python tts/audio.py voice out/<vídeo>.audio.json   → out/audio/<vídeo>.voice.wav
    python tts/audio.py music out/<vídeo>.audio.json   → out/audio/<vídeo>.music.wav

A trilha é sintetizada aqui mesmo (osciladores, envelopes e reverberação por
convolução), sem amostras nem música de terceiros: não há licença a pagar nem
crédito a dar. Ela segue a linha do tempo do vídeo: clima suspenso no
problema, entrada do tema quando a marca aparece, batida leve nos capítulos e
acorde final na assinatura. A mixagem (voz + trilha com a trilha abaixando sob
a voz) é feita por mix.mjs com o ffmpeg.
"""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, lfilter

SR = 48000
rng = np.random.default_rng(2026)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, d, s, r):
    """Envelope em amostras: ataque, decaimento, sustentação (nível) e soltura."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    hold = max(0, n - a - d - r)
    return np.concatenate(
        [np.linspace(0, 1, a, endpoint=False), np.linspace(1, s, d, endpoint=False), np.full(hold, s), np.linspace(s, 0, r)]
    )[:n]


def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def onepole_hp(x, cutoff):
    return x - onepole_lp(x, cutoff)


class Mix:
    """Trilha estéreo com um envio para a reverberação."""

    def __init__(self, seconds):
        self.n = int(seconds * SR) + SR * 4
        self.dry = np.zeros((self.n, 2))
        self.wet = np.zeros((self.n, 2))

    def add(self, t, x, gain=1.0, pan=0.0, send=0.0):
        i = int(t * SR)
        if i >= self.n or i + len(x) <= 0:
            return
        if i < 0:
            x, i = x[-i:], 0
        x = x[: self.n - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        st = np.stack([x * l, x * r], axis=1) * gain
        self.dry[i : i + len(x)] += st
        if send:
            self.wet[i : i + len(x)] += st * send

    def render(self, seconds):
        # Resposta ao impulso: ruído que decai (sala grande, agudos amaciados).
        n = int(2.6 * SR)
        t = np.arange(n) / SR
        ir = np.stack([onepole_lp(rng.standard_normal(n), 5200) * np.exp(-t / 0.62) for _ in range(2)], axis=1)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt((ir**2).sum(axis=0))
        wet = np.stack([fftconvolve(self.wet[:, c], ir[:, c])[: self.n] for c in range(2)], axis=1)
        out = self.dry + wet * 0.9
        return out[: int(seconds * SR)]


def pad(freqs, dur, bright=1.0):
    """Acorde sustentado: dentes de serra suaves, três vozes desafinadas por nota."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for f in freqs:
        for cents, pan in ((-7, -0.6), (0, 0.0), (7, 0.6)):
            ff = f * 2 ** (cents / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            v = np.zeros(n)
            for h in range(1, 9):
                if ff * h > 5000:
                    break
                v += np.sin(2 * np.pi * ff * h * t + ph * h) / (h ** (2.1 - 0.5 * bright))
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            out[:, 0] += v * l
            out[:, 1] += v * r
    e = env_adsr(n, min(0.9, dur * 0.3), 0.3, 0.85, min(1.4, dur * 0.35))
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.23 * t)
    out = onepole_hp(out.T, 130).T  # sem grave embolado: o grave é do baixo
    return out * (e * trem)[:, None] / (len(freqs) * 2.2)


def pluck(f, dur=0.5, tau=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 3 * f * t)
    e = np.exp(-t / tau)
    e[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return x * e


def bell(f, dur=2.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t + 1.6 * np.exp(-t / 0.35) * np.sin(2 * np.pi * 3.01 * f * t))
    e = np.exp(-t / 0.9)
    e[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return x * e


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * 2 * f * t)
    return np.tanh(1.4 * x) * env_adsr(n, 0.02, 0.12, 0.8, min(0.18, dur * 0.4))


def kick():
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 46 + 86 * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    return x


def shaker():
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    return onepole_hp(rng.standard_normal(n), 6000) * np.exp(-t / 0.018)


def riser(dur, power=2.2):
    """Ruído que sobe (anuncia uma virada)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    lo = onepole_lp(x, 900)
    hi = onepole_hp(onepole_lp(x, 7000), 1800)
    k = (t / dur) ** power
    y = (lo * (1 - k) * 0.5 + hi * k) * k
    y[-int(0.02 * SR) :] *= np.linspace(1, 0, int(0.02 * SR))
    return y


def impact():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    low = np.sin(2 * np.pi * (38 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.55)
    thud = onepole_lp(rng.standard_normal(n), 420) * np.exp(-t / 0.16) * 0.7
    return np.tanh(1.6 * (low + thud))


def whoosh(dur=0.7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = onepole_hp(onepole_lp(rng.standard_normal(n), 3600), 500)
    return x * np.sin(np.pi * t / dur) ** 2


# Acordes (notas MIDI): ré maior, com o relativo menor para o "problema".
CH = {
    "D": [50, 57, 62, 66, 69], "A": [49, 57, 61, 64, 69], "Bm": [47, 54, 59, 62, 66], "G": [43, 55, 59, 62, 67],
    "Em": [52, 55, 59, 64, 67], "F#m": [42, 54, 57, 61, 66],
}
ROOT = {"D": 38, "A": 45, "Bm": 35, "G": 43, "Em": 40, "F#m": 42}
LOOP_A = ["D", "A", "Bm", "G"]
LOOP_B = ["G", "D", "Em", "A"]
ARP = [0, 2, 3, 2, 4, 2, 3, 2]  # índices do acorde, em colcheias


def music(plan):
    intro, total = plan["intro"], plan["duration"]
    scenes = plan["scenes"]
    at = {s["id"]: s["at"] for s in scenes}
    hub, end = at["hub"], at["end"]
    # Andamento: o compasso é ajustado para a marca cair no início de um compasso.
    bars_to_hub = max(2, round((hub - intro) / 2.4))
    bar = (hub - intro) / bars_to_hub
    beat = bar / 4
    m = Mix(total)

    # ── Vinheta: nota grave que cresce, subida e batida quando a marca surge.
    m.dry[: int(intro * SR)] += pad([midi(50), midi(57), midi(62), midi(69)], intro + 0.6, bright=0.8)[: int(intro * SR)] * 0.7
    m.add(0.0, bass(midi(38), intro), gain=0.1)
    m.add(1.0, riser(3.95), gain=0.16, send=0.5)
    m.add(4.95, impact(), gain=0.4, send=0.35)
    for j, n in enumerate((74, 78, 81)):
        m.add(4.95 + j * 0.14, bell(midi(n)), gain=0.1, pan=(-0.3, 0.3, 0)[j], send=0.9)
    m.add(5.6, riser(1.15, 3.0), gain=0.2, send=0.4)
    m.add(intro - 0.05, impact(), gain=0.22, send=0.4)

    # ── Problema (até a marca): acordes menores, pulso contido, sem batida.
    for k in range(bars_to_hub):
        t = intro + k * bar
        name = ["Bm", "G", "Bm", "F#m"][k % 4]
        st = pad([midi(n) for n in CH[name][1:]], bar + 0.5, bright=0.8)
        i = int(t * SR)
        m.dry[i : i + len(st)] += st * 0.62
        m.wet[i : i + len(st)] += st * 0.3
        for e in range(8):
            if e % 2 == 0 or k >= bars_to_hub // 2:
                m.add(t + e * beat / 2, pluck(midi(CH[name][2] + 12), 0.4, 0.09), gain=0.09, pan=(-0.4 if e % 2 else 0.4), send=0.6)
        m.add(t, bass(midi(ROOT[name] + 12), bar * 0.9), gain=0.1)
    m.add(hub - 2.2, riser(2.2, 2.6), gain=0.2, send=0.5)

    # ── Tema (da marca ao encerramento).
    m.add(hub, impact(), gain=0.34, send=0.4)
    n_bars = int(np.ceil((total - hub) / bar))
    lifts = sorted(s["at"] for s in scenes if s["at"] > hub + bar and s["type"] in ("journey", "comms", "trio", "end"))
    for k in range(n_bars):
        t = hub + k * bar
        if t > end + 0.2:
            break
        phrase = k // 8
        name = (LOOP_B if phrase % 3 == 2 else LOOP_A)[k % 4]
        chord = CH[name]
        # Respiro: os dois primeiros compassos de cada frase de 8 ficam sem batida.
        quiet = k % 8 < 2 and k > 0
        near_end = t > end - bar * 2
        st = pad([midi(n) for n in chord[1:]], bar + 0.5, bright=1.0)
        i = int(t * SR)
        m.dry[i : i + len(st)] += st[: m.n - i] * 0.6
        m.wet[i : i + len(st)] += st[: m.n - i] * 0.28
        # Baixo: fundamental no 1 e antecipação no "e" do 3.
        m.add(t, bass(midi(ROOT[name] + 12), beat * 1.8), gain=0.15)
        if not quiet:
            m.add(t + beat * 2.5, bass(midi(ROOT[name] + 12), beat * 1.3), gain=0.12)
        # Arpejo em colcheias, alternando os lados.
        for e in range(8):
            note = chord[ARP[(e + (k % 2) * 4) % 8]] + 12
            m.add(t + e * beat / 2, pluck(midi(note), 0.5, 0.16), gain=0.13 if not quiet else 0.09, pan=(-0.55 if e % 2 else 0.55), send=0.55)
        # Batida leve e chocalho.
        if not quiet and not near_end and k > 1:
            for b in range(4):
                m.add(t + b * beat, kick(), gain=0.2)
                m.add(t + (b + 0.5) * beat, shaker(), gain=0.045, pan=0.3)
        # Motivo de sino a cada dois compassos.
        if k % 2 == 0:
            for j, (off, deg) in enumerate(((0, 4), (1.5, 3), (3, 2))):
                m.add(t + off * beat, bell(midi(chord[deg] + 12)), gain=0.09, pan=(-0.3, 0.3, 0)[j], send=0.9)
    for t in lifts:
        m.add(t - 1.6, riser(1.6, 2.6), gain=0.13, send=0.5)
        m.add(t, impact(), gain=0.18, send=0.4)
    # Passagens de cena: um sopro discreto.
    for s in scenes[1:]:
        m.add(s["at"] - 0.1, whoosh(), gain=0.055, pan=rng.uniform(-0.5, 0.5), send=0.4)

    # ── Assinatura: acorde final de ré maior, sino e cauda.
    sig = end + 0.4
    st = pad([midi(n) for n in (50, 57, 62, 66, 69, 74)], total - sig + 1.5, bright=1.1)
    i = int(sig * SR)
    m.dry[i : i + len(st)] += st[: m.n - i] * 0.8
    m.wet[i : i + len(st)] += st[: m.n - i] * 0.4
    m.add(sig, bass(midi(38), total - sig), gain=0.12)
    for j, n in enumerate((62, 66, 69, 74)):
        m.add(sig + j * 0.16, bell(midi(n + 12)), gain=0.1, pan=(-0.4, 0.4, -0.2, 0.2)[j], send=1.0)

    out = m.render(total)
    out = onepole_hp(out.T, 38).T
    # Saída: sem estouro, com fim em desvanecimento.
    out = np.tanh(out * 1.6) / 1.6
    fade = int(2.4 * SR)
    out[-fade:] *= (np.linspace(1, 0, fade) ** 1.6)[:, None]
    out[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    return out / np.abs(out).max() * 0.89, 60 / beat


def voice(plan):
    out = np.zeros(int(plan["duration"] * SR) + SR)
    for c in plan["cues"]:
        x, sr = sf.read(c["file"])
        assert sr == SR, c["file"]
        i = int(c["at"] * SR)
        out[i : i + len(x)] += x
    return out[: int(plan["duration"] * SR)]


if __name__ == "__main__":
    kind, path = sys.argv[1], sys.argv[2]
    plan = json.load(open(path, encoding="utf-8"))
    name = path.replace(".audio.json", "").replace("out/", "out/audio/")
    if kind == "voice":
        v = voice(plan)
        sf.write(f"{name}.voice.wav", v, SR, subtype="PCM_16")
        print(f"{name}.voice.wav  {len(v) / SR:.1f} s  pico {np.abs(v).max():.2f}")
    else:
        y, bpm = music(plan)
        sf.write(f"{name}.music.wav", y, SR, subtype="PCM_16")
        print(f"{name}.music.wav  {len(y) / SR:.1f} s  {bpm:.1f} bpm")
