"""
Traz para o vídeo a narração gerada em outro lugar (por exemplo, no ElevenLabs).

    python tts/import_voice.py out/<vídeo>.tts.json \
        --manifest out/<vídeo>.voice-parts.json --audio <pasta> [--out-dir <pasta>] \
        [--fix id=arquivo ...]

Lê a lista de falas (a mesma de tts.py: [{"file": ..., "text": ...}]) e grava um
WAV por fala (48 kHz, mono, PCM_16) no lugar onde o vídeo espera
(out/audio/<vídeo>/<cena>.<n>.wav), com as pontas sem silêncio.

A pasta <audio> pode ter:
  - um arquivo por fala, com o nome do id ("route.0.mp3", "hub.2.wav"...): é só
    converter e aparar; ou
  - um arquivo por PARTE do roteiro (parte-1, parte-2, parte-3, em mp3, wav, m4a,
    flac...; o número da parte tem de estar no nome): o áudio é transcrito (Whisper
    local, em português), as palavras são alinhadas às do roteiro e o áudio é
    cortado no meio do silêncio entre uma fala e a seguinte, medido no próprio som
    (o tempo das palavras do Whisper só diz onde procurar).
--fix id=arquivo troca uma fala por um arquivo só dela (a fala refeita).

As pontas de cada fala saem pelo som: começa no primeiro som de fala (inclusive
consoantes fracas como o "f" e o estalo do "c") e termina no último, sem as
respirações separadas da fala.

Depois das importações imprime uma tabela com, por fala, quanto do texto foi
reconhecido, a duração e a velocidade de fala, e lista as falas a rever (texto
reconhecido muito diferente do roteiro, fala curta ou longa demais) e os avisos
dos cortes (som de fala que ficou fora de todas as falas; corte sem silêncio
claro por perto). Nada sai da
máquina: o Whisper roda aqui (modelo "medium", baixado do Hugging Face na primeira
vez; HF_HOME escolhe o cache).
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

SR = 48000
FRAME = 0.01  # quadro de 10 ms para medir o nível
SIL_DB = -60.0  # abaixo disto é silêncio; f, s, ch e o estalo do c e do p ficam acima
LOUD = 0.012  # amostra "alta" (−38 dBFS): o corpo da fala
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".opus", ".webm")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def decode(path, sr=SR):
    """Qualquer áudio → float32 mono em `sr` (pelo ffmpeg)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def norm_tokens(text):
    """Palavras sem acento, minúsculas, sem pontuação; hífen separa (bê-éle → be, ele)."""
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return [w for w in re.split(r"[^a-z0-9]+", t) if w]


def tidy(x, lead=0.0, tail=0.0, fade=0.008):
    """Fades curtos nas pontas e pico abaixo de 0,97 (como tts.py)."""
    y = x.astype(np.float64).copy()
    n = int(fade * SR)
    if len(y) > 2 * n:
        y[:n] *= np.linspace(0, 1, n)
        y[-n:] *= np.linspace(1, 0, n)
    peak = np.abs(y).max()
    if peak > 0.97:
        y *= 0.97 / peak
    return y.astype(np.float32)


def level_db(x):
    """Nível da fala (RMS dos trechos ativos), em dBFS."""
    w = int(0.05 * SR)
    n = len(x) // w
    if n == 0:
        return -90.0
    r = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1))
    act = r[r > 10 ** (-45 / 20)]
    return 20 * np.log10(np.sqrt((act**2).mean())) if len(act) else -90.0


_HP = butter(4, 150, "highpass", fs=SR, output="sos")


def frames_db(x):
    """Nível de cada quadro de 10 ms (dBFS), sem os graves abaixo de 150 Hz."""
    y = sosfiltfilt(_HP, x.astype(np.float64)) if len(x) > 64 else x.astype(np.float64)
    f = int(FRAME * SR)
    n = len(y) // f
    if n == 0:
        return np.full(1, -120.0)
    return 20 * np.log10(np.sqrt((y[: n * f].reshape(n, f) ** 2).mean(axis=1)) + 1e-12)


def speech_bounds(x):
    """Começo e fim da fala em `x` (amostras). Parte do primeiro e do último som alto e
    anda pelos quadros acima do silêncio, atravessando até 30 ms quietos: assim entram
    o "f" de "Fornecedores", o estalo do "c" de "Consulta" e o "s" final, que ficam
    abaixo do som alto. Uma respiração separada da fala por 40 ms de silêncio fica de
    fora. Nunca corta mais que a regra antiga (60 ms antes do primeiro som alto, 120 ms
    depois do último)."""
    loud = np.flatnonzero(np.abs(x) > LOUD)
    if len(loud) == 0:
        return 0, len(x)
    act = frames_db(x) > SIL_DB
    f = int(FRAME * SR)

    def walk(k, step):
        edge, quiet = k, 0
        while 0 <= k + step < len(act):
            k += step
            if act[k]:
                edge, quiet = k, 0
            else:
                quiet += 1
                if quiet >= 4:
                    break
        return edge

    first = walk(min(loud[0] // f, len(act) - 1), -1)
    last = walk(min(loud[-1] // f, len(act) - 1), 1)
    a = max(0, min(first * f - int(0.03 * SR), loud[0] - int(0.06 * SR)))
    b = min(len(x), max((last + 1) * f + int(0.03 * SR), loud[-1] + int(0.12 * SR)))
    return a, b


def trim_silence(x):
    a, b = speech_bounds(x)
    return x[a:b]


def silent_runs(db, lo, hi, min_len=0.08):
    """Trechos de silêncio (quadros abaixo de SIL_DB) com pelo menos `min_len` segundos
    entre `lo` e `hi` (segundos): [(início, fim)]."""
    i0, i1 = max(0, int(lo / FRAME)), min(len(db), int(np.ceil(hi / FRAME)))
    quiet = np.r_[False, db[i0:i1] < SIL_DB, False].astype(int)
    edges = np.flatnonzero(np.diff(quiet))
    return [
        ((i0 + s) * FRAME, (i0 + e) * FRAME)
        for s, e in zip(edges[::2], edges[1::2])
        if (e - s) * FRAME >= min_len - 1e-9
    ]


def write_clip(path, x, source):
    sf.write(path, tidy(x), SR, subtype="PCM_16")
    open(path + ".key", "w").write("import:" + hashlib.sha1(source.encode()).hexdigest())


# ───────────────────────── alinhamento palavra a palavra ─────────────────────────
def align(script, heard):
    """Alinha duas listas de palavras (Needleman-Wunsch); devolve, para cada palavra do
    roteiro, o índice da palavra ouvida ou None."""
    n, m = len(script), len(heard)
    sim = lambda a, b: difflib.SequenceMatcher(None, a, b).ratio()
    GAP = -0.7
    S = np.zeros((n + 1, m + 1))
    S[:, 0] = np.arange(n + 1) * GAP
    S[0, :] = np.arange(m + 1) * GAP
    sc = np.zeros((n, m))
    for i in range(n):
        for j in range(m):
            r = sim(script[i], heard[j])
            sc[i, j] = (2.0 * r - 0.6) if r >= 0.5 else -1.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            S[i, j] = max(S[i - 1, j - 1] + sc[i - 1, j - 1], S[i - 1, j] + GAP, S[i, j - 1] + GAP)
    i, j = n, m
    out = [None] * n
    while i > 0 and j > 0:
        if S[i, j] == S[i - 1, j - 1] + sc[i - 1, j - 1]:
            if sc[i - 1, j - 1] > 0:
                out[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif S[i, j] == S[i - 1, j] + GAP:
            i -= 1
        else:
            j -= 1
    return out


_model = None


def transcribe(x48):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel("medium", device="cpu", compute_type="int8")
    x16 = resample_poly(x48, 1, 3).astype(np.float32)  # 48 kHz → 16 kHz
    segs, _ = _model.transcribe(
        x16,
        language="pt",
        word_timestamps=True,
        beam_size=5,
        condition_on_previous_text=False,
        vad_filter=False,
    )
    words = []
    for s in segs:
        for w in s.words or []:
            toks = norm_tokens(w.word)
            for k, t in enumerate(toks):  # "bê-éle" vira duas palavras: reparte o tempo
                a = w.start + (w.end - w.start) * k / len(toks)
                b = w.start + (w.end - w.start) * (k + 1) / len(toks)
                words.append((t, a, b))
    return words


def split_part(x48, heard, lines):
    """Corta o áudio de uma parte em uma fala por linha. Devolve [(trecho, casamento)]."""
    htoks = [w[0] for w in heard]
    # palavras de cada fala, na ordem
    stoks, owner = [], []
    for k, ln in enumerate(lines):
        for t in norm_tokens(ln["text"]):
            stoks.append(t)
            owner.append(k)
    link = align(stoks, htoks)
    first = [None] * len(lines)
    last = [None] * len(lines)
    hit = [0] * len(lines)
    cnt = [0] * len(lines)
    for t, k in enumerate(owner):
        cnt[k] += 1
        j = link[t]
        if j is None:
            continue
        hit[k] += 1
        first[k] = j if first[k] is None else min(first[k], j)
        last[k] = j if last[k] is None else max(last[k], j)
    # fala sem nenhuma palavra reconhecida: sem âncora (fica para rever)
    dur = len(x48) / SR
    t0 = [heard[first[k]][1] if first[k] is not None else None for k in range(len(lines))]
    t1 = [heard[last[k]][2] if last[k] is not None else None for k in range(len(lines))]
    # Ponto de corte entre falas seguidas: no silêncio entre elas, medido no áudio. Os
    # tempos do Whisper só dizem onde procurar: erram por décimos de segundo e, quando
    # ele ouve errado a primeira palavra de uma fala ("Pega" por "Entrega"), apontam
    # para a palavra seguinte. Entre o fim da fala anterior e o começo desta (com meio
    # segundo de folga para cada lado), o corte vai para o meio do silêncio mais longo;
    # empate: o mais perto do meio da pausa que o Whisper ouviu.
    db = frames_db(x48)
    cut = [0.0]
    doubtful = []  # cortes sem silêncio claro por perto: rever
    for k in range(len(lines) - 1):
        if last[k] is None or first[k + 1] is None:
            cut.append(None)
            continue
        a, b = last[k], first[k + 1]
        best, at = -1.0, None
        for j in range(a, b):
            gap = heard[j + 1][1] - heard[j][2]
            if gap > best:
                best, at = gap, (heard[j][2] + heard[j + 1][1]) / 2
        guess = at if at is not None else (heard[a][2] + heard[b][1]) / 2
        prev = next((c for c in reversed(cut) if c is not None), 0.0)
        lo = max(prev + 0.05, heard[a][2] - 0.5)
        hi = min(dur, heard[b][1] + 0.5)
        runs = silent_runs(db, lo, hi)
        if runs:
            s, e = max(runs, key=lambda r: (r[1] - r[0]) - 0.3 * abs((r[0] + r[1]) / 2 - guess))
            cut.append((s + e) / 2)
        else:
            # sem silêncio de 80 ms: o ponto mais quieto (40 ms) na mesma janela
            w = int(0.04 * SR)
            i0, i1 = int(lo * SR), max(int(lo * SR) + 1, int(hi * SR))
            env = np.sqrt(np.convolve(x48[i0:i1].astype(np.float64) ** 2, np.ones(w) / w, mode="same"))
            cut.append((i0 + int(np.argmin(env))) / SR)
            doubtful.append(k + 1)
    cut.append(dur)
    clips = []
    for k in range(len(lines)):
        if t0[k] is None or t1[k] is None:
            clips.append((None, 0.0, None))
            continue
        # A fala vai de um corte ao outro; speech_bounds tira o silêncio das pontas pelo
        # som (sem depender do tempo das palavras).
        a = int((cut[k] if cut[k] is not None else 0.0) * SR)
        b = int((cut[k + 1] if cut[k + 1] is not None else dur) * SR)
        s, e = speech_bounds(x48[a:b])
        clips.append((x48[a + s : a + e], hit[k] / max(1, cnt[k]), (a + s, a + e, k in doubtful)))
    return clips


def lost_speech(x48, bounds, floor_db=-45.0, min_len=0.03):
    """Som de fala (acima de `floor_db`, por `min_len` segundos ou mais) que ficou fora de
    todas as falas: entre uma e outra, antes da primeira e depois da última. Respirações
    ficam abaixo de −45 dBFS e não contam. Devolve [(início, fim, nível)]."""
    db = frames_db(x48)
    keep = np.zeros(len(db), bool)
    for a, b in bounds:
        keep[a // int(FRAME * SR) : -(-b // int(FRAME * SR))] = True
    loud = np.r_[False, (db > floor_db) & ~keep, False].astype(int)
    edges = np.flatnonzero(np.diff(loud))
    return [
        (s * FRAME, e * FRAME, float(db[s:e].max()))
        for s, e in zip(edges[::2], edges[1::2])
        if (e - s) * FRAME >= min_len - 1e-9
    ]


def bag(tokens):
    d = {}
    for t in tokens:
        d[t] = d.get(t, 0) + 1
    return d


def overlap(a, b):
    """Quanto das palavras de `a` aparece em `b` (sacos de palavras)."""
    tot = sum(a.values()) or 1
    return sum(min(n, b.get(t, 0)) for t, n in a.items()) / tot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("list")
    ap.add_argument("--manifest")
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out-dir")
    ap.add_argument("--fix", action="append", default=[], help="id=arquivo")
    args = ap.parse_args()
    items = json.load(open(args.list, encoding="utf-8"))
    ids = [os.path.basename(it["file"])[: -len(".wav")] for it in items]
    by_id = {i: it for i, it in zip(ids, items)}
    out_dir = args.out_dir or os.path.dirname(items[0]["file"])
    os.makedirs(out_dir, exist_ok=True)
    report = []  # (id, casamento, duração, cps)
    notes = []  # avisos dos cortes (fala fora dos cortes, corte sem silêncio claro)

    def put(i, x, match, source, trimmed=False):
        if not trimmed:
            x = trim_silence(x)
        write_clip(os.path.join(out_dir, i + ".wav"), x, source)
        d = len(x) / SR
        cps = len(by_id[i]["text"]) / d if d else 0
        report.append((i, match, d, cps))

    # 1. uma fala por arquivo?
    files = {}
    for f in os.listdir(args.audio):
        stem, ext = os.path.splitext(f)
        if ext.lower() in AUDIO_EXT and stem in by_id:
            files[stem] = os.path.join(args.audio, f)
    if len(files) == len(ids):
        for i in ids:
            put(i, decode(files[i]), 1.0, files[i])
    else:
        if not args.manifest:
            sys.exit("faltam arquivos por fala e não há --manifest para cortar as partes")
        manifest = json.load(open(args.manifest, encoding="utf-8"))
        parts = manifest["parts"]
        paths = sorted(
            os.path.join(args.audio, f)
            for f in os.listdir(args.audio)
            if f.lower().endswith(AUDIO_EXT) and os.path.splitext(f)[0] not in by_id
        )
        if len(paths) != len(parts):
            sys.exit(f"esperava {len(parts)} áudios (um por parte) em {args.audio}; achei {len(paths)}")
        # Cada arquivo é transcrito uma vez; a parte dele é a que tem mais palavras em comum
        # com o que foi ouvido (o nome que o ElevenLabs dá ao arquivo não serve de guia).
        heard_of = {}
        for path in paths:
            print(f"transcrevendo {os.path.basename(path)} …", flush=True)
            x = decode(path)
            heard_of[path] = (x, transcribe(x))
        want = [bag(norm_tokens(" ".join(by_id[i]["text"] for i in p["ids"]))) for p in parts]
        score = {
            (path, k): overlap(want[k], bag([w[0] for w in heard_of[path][1]]))
            for path in paths
            for k in range(len(parts))
        }
        assign, used = {}, set()
        for (path, k), v in sorted(score.items(), key=lambda kv: -kv[1]):
            if path in assign or k in used:
                continue
            assign[path] = k
            used.add(k)
        for path in paths:
            k = assign[path]
            print(f"  {os.path.basename(path)} → parte {parts[k]['part']} ({score[(path, k)]:.0%} das palavras)")
            if score[(path, k)] < 0.6:
                sys.exit(f"{os.path.basename(path)} não parece nenhuma parte do roteiro (melhor: {score[(path, k)]:.0%}); confira se é o áudio certo")
        for path in sorted(paths, key=lambda p: assign[p]):
            part = parts[assign[path]]
            x, heard = heard_of[path]
            # mesmo nível nas três partes (a fala em cerca de −24 dBFS RMS)
            x = x * (10 ** ((-24 - level_db(x)) / 20))
            lines = [{"id": i, "text": by_id[i]["text"]} for i in part["ids"]]
            clips = split_part(x, heard, lines)
            bounds = []
            for ln, (seg, match, where) in zip(lines, clips):
                if seg is None or len(seg) < 0.2 * SR:
                    report.append((ln["id"], 0.0, 0.0, 0.0))
                    continue
                put(ln["id"], seg, match, path, trimmed=True)
                bounds.append(where[:2])
                if where[2]:
                    notes.append(f"{ln['id']}: corte sem silêncio claro antes da fala (em {where[0] / SR:.2f} s de {os.path.basename(path)})")
            for s, e, lvl in lost_speech(x, bounds):
                notes.append(f"{os.path.basename(path)} {s:.2f}–{e:.2f} s: som de fala ({lvl:.0f} dBFS) fora de todas as falas")
    for fx in args.fix:
        i, f = fx.split("=", 1)
        if i not in by_id:
            sys.exit(f"--fix: id desconhecido: {i}")
        report = [r for r in report if r[0] != i]
        put(i, decode(f), 1.0, f)

    order = {i: k for k, i in enumerate(ids)}
    report.sort(key=lambda r: order[r[0]])
    bad = []
    print(f"\n{'fala':14s} {'casou':>6s} {'dur':>6s} {'letras/s':>8s}")
    for i, m, d, cps in report:
        flag = ""
        if m < 0.75 or d < 0.8 or d > 16 or cps < 7 or cps > 26:
            flag = "  ← rever"
            bad.append(i)
        print(f"{i:14s} {m:6.0%} {d:6.2f} {cps:8.1f}{flag}")
    total = sum(r[2] for r in report)
    print(f"\n{len(report)} falas em {out_dir}, {total:.1f} s de fala")
    print("a rever: " + (", ".join(bad) if bad else "nenhuma"))
    for n in notes:
        print("  ! " + n)


if __name__ == "__main__":
    main()
