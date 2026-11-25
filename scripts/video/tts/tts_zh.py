"""
Narração do vídeo em mandarim, voz feminina, gerada na própria máquina (modelo
aberto, em CPU); nenhum texto sai para serviço externo. Pedido do dono
(25/11/2026): a voz em mandarim feita aqui, sem o ElevenLabs.

    HF_HOME=<cache> <venv>/bin/python tts/tts_zh.py out/full_zh.tts.json \
        [--speaker Serena] [--instruct "..."] [--takes 3] [--only id,id] [--out-dir pasta]

Motor: Qwen3-TTS-12Hz-1.7B-CustomVoice (Alibaba, Apache-2.0, uso comercial
livre), com uma das vozes prontas do modelo cuja língua nativa é o chinês:
"Serena" (voz feminina jovem, quente e suave; padrão) ou "Vivian" (feminina,
clara e mais incisiva). São vozes sintéticas do próprio modelo: não é gravação
nem clone de pessoa real. Pesos baixados do Hugging Face na primeira execução
(cerca de 4,5 GB); sem GPU, bf16 em CPU (uns 4 s de cálculo por segundo de fala).

Para cada fala (a lista de tts.py: [{"file": ..., "text": ...}]):
  - gera até `--takes` versões com sementes diferentes (a semente vem do texto: rodar
    de novo dá o mesmo áudio) e para na primeira que passa na conferência;
  - confere cada versão: transcrição local (Whisper medium, em chinês) comparada ao
    roteiro caractere a caractere, aceitando homófonos (o Whisper troca 像/向),
    velocidade plausível (caracteres por segundo) e nota de naturalidade (UTMOS22,
    local: pega chiado, estalo e voz robótica que a transcrição não mostra);
  - se nenhuma passa, fica com a melhor (casamento com o roteiro, depois a nota);
  - a frase com ponto final no meio (agency.3) é gerada frase a frase e emendada com
    uma pausa de frase;
  - tira o silêncio das pontas e grava WAV de 48 kHz, mono, PCM_16 em
    out/audio/<vídeo>/<id>.wav (mais um .key: só refaz a fala cujo texto, voz ou
    instrução mudou) e o relatório em <pasta>/tts_zh.report.json.

A transcrição não mostra a leitura de caracteres com duas pronúncias (escreve o mesmo
caractere): o roteiro já evita os casos de risco (script.zh.mjs) e o relatório lista
o que conferir de ouvido.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import zlib

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

VERSION = "zh1"
MODEL = os.environ.get("TTS_ZH_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
MOS_MODEL = os.environ.get("TTS_ZH_UTMOS", "prj-beatrice/utmos22-torch-native")
MOS_MIN = 3.4  # abaixo disto a versão tem defeito audível (piloto: 3,8 a 4,2 nas boas)
INSTRUCT = "用温暖、亲切又专业的企业宣传片旁白语气，吐字清晰，语速适中，自然流畅，像在向合作伙伴介绍公司。"
OUT_SR = 48000
HAN = re.compile(r"[㐀-鿿]")
PAUSE_SENTENCE = 0.42  # pausa entre duas frases da mesma fala (ponto final no meio)
MAX_GAP = 0.75  # pausa interna mais longa que isto é encurtada
CPS = (3.0, 7.0)  # caracteres chineses por segundo plausíveis


# ---- texto e conferência ----------------------------------------------------
def simplified(text):
    try:
        import zhconv

        return zhconv.convert(text, "zh-cn")
    except ImportError:
        return text


_py = {}


def pinyin(ch):
    if ch not in _py:
        from pypinyin import lazy_pinyin

        _py[ch] = lazy_pinyin(ch)[0]
    return _py[ch]


def tokens(text):
    """Um caractere chinês por token; palavra latina e número inteiros, em minúsculas."""
    return [m.group(0).lower() for m in re.finditer(r"[㐀-鿿]|[A-Za-z]+|\d+", simplified(text))]


LATIN = {  # como o Whisper escreve as palavras latinas do roteiro
    "wellmix": {"wellmix", "wellmx", "welmix", "wellmax", "willmix", "wellmeeks", "wellmixs"},
    "book": {"book", "buk", "books"},
    "erp": {"erp", "e", "r", "p"},
    "sla": {"sla", "s", "l", "a"},
}


def match(script, heard):
    """Fração dos tokens do roteiro reconhecidos, na ordem (alinhamento por programação
    dinâmica; mesmo caractere conta 1, mesmo pinyin 0,85, palavra latina pela lista)."""

    def sim(a, b):
        if a == b:
            return 1.0
        if HAN.match(a) and HAN.match(b):
            return 0.85 if pinyin(a) == pinyin(b) else 0.0
        if a in LATIN and b in LATIN[a]:
            return 1.0
        return 0.0

    n, m = len(script), len(heard)
    if not n:
        return 1.0
    S = np.zeros((n + 1, m + 1))
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            S[i, j] = max(S[i - 1, j], S[i, j - 1], S[i - 1, j - 1] + sim(script[i - 1], heard[j - 1]))
    extra = max(0, m - n)  # palavras ouvidas a mais (repetição, sílaba inventada) pesam
    return max(0.0, (S[n, m] - 0.5 * extra) / n)


# ---- áudio --------------------------------------------------------------------
def frames_db(x, sr, hop=0.01):
    h = int(hop * sr)
    n = len(x) // h
    if n == 0:
        return np.array([-120.0])
    r = np.sqrt((x[: n * h].reshape(n, h).astype(np.float64) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(r)


def trim(x, sr, floor_db=-50.0, lead=0.04, tail=0.12):
    db = frames_db(x, sr)
    on = np.flatnonzero(db > floor_db)
    if not len(on):
        return x
    a = max(0, int((on[0] * 0.01 - lead) * sr))
    b = min(len(x), int(((on[-1] + 1) * 0.01 + tail) * sr))
    y = x[a:b].astype(np.float32).copy()
    n = int(0.006 * sr)
    y[:n] *= np.linspace(0, 1, n)
    y[-n:] *= np.linspace(1, 0, n)
    return y


def squeeze(x, sr, cap=MAX_GAP, thr_db=-48.0):
    """Encurta silêncio interno maior que `cap` (tira do meio dele)."""
    db = frames_db(x, sr)
    h = int(0.01 * sr)
    out, start, i, n = [], 0, 0, len(db)
    while i < n:
        if db[i] >= thr_db:
            i += 1
            continue
        j = i
        while j < n and db[j] < thr_db:
            j += 1
        if (j - i) * 0.01 > cap and i > 0 and j < n:
            keep = int(cap / 0.01) // 2
            out.append(x[start : (i + keep) * h])
            start = (j - keep) * h
        i = j
    out.append(x[start:])
    return np.concatenate(out) if len(out) > 1 else x


# ---- motor --------------------------------------------------------------------
class Voice:
    sr = 24000

    def __init__(self, speaker, instruct, threads):
        import torch
        from qwen_tts import Qwen3TTSModel

        self.torch = torch
        torch.set_num_threads(threads)
        self.m = Qwen3TTSModel.from_pretrained(MODEL, device_map="cpu", dtype=torch.bfloat16)
        self.speaker, self.instruct = speaker, instruct

    def say(self, text, seed):
        self.torch.manual_seed(seed)
        w, sr = self.m.generate_custom_voice(
            text=text, language="Chinese", speaker=self.speaker, instruct=self.instruct or None
        )
        assert sr == self.sr, sr
        return np.asarray(w[0], dtype=np.float32).reshape(-1)


class Judge:
    """Nota de naturalidade (UTMOS22, 1 a 5). Sem o modelo, não pesa na escolha."""

    def __init__(self):
        try:
            import torch
            from transformers import AutoModel

            self.torch = torch
            self.m = AutoModel.from_pretrained(MOS_MODEL, trust_remote_code=True).eval()
        except Exception as e:  # noqa: BLE001
            print(f"aviso: sem a nota de naturalidade ({e})", file=sys.stderr)
            self.m = None

    def score(self, x, sr):
        if self.m is None:
            return None
        with self.torch.inference_mode():
            return round(float(self.m(self.torch.from_numpy(x.astype(np.float32)), sampling_rate=sr).scores[0]), 2)


class Ear:
    def __init__(self):
        from faster_whisper import WhisperModel

        self.m = WhisperModel("medium", device="cpu", compute_type="int8", cpu_threads=4)

    def hear(self, x, sr):
        x16 = resample_poly(x.astype(np.float64), 16000, sr).astype(np.float32)
        pad = np.zeros(4800, np.float32)
        segs, _ = self.m.transcribe(
            np.concatenate([pad, x16, pad]),
            language="zh",
            initial_prompt="以下是普通话的句子，使用简体中文。",
            beam_size=5,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        return "".join(s.text.strip() for s in segs)


def sentences(text):
    """Frases da fala: corta depois de 。！？ que não estejam no fim."""
    parts = [p for p in re.split(r"(?<=[。！？])", text) if p.strip()]
    return parts or [text]


def make_take(voice, text, seed):
    """Uma versão da fala inteira (frase a frase se houver ponto no meio), no sr do motor."""
    chunks = []
    for k, s in enumerate(sentences(text)):
        x = trim(voice.say(s, (seed + k * 104729) & 0x7FFFFFFF), voice.sr)
        chunks += [x, np.zeros(int(PAUSE_SENTENCE * voice.sr), np.float32)]
    return np.concatenate(chunks[:-1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("list")
    ap.add_argument("--speaker", default=os.environ.get("TTS_ZH_SPEAKER", "Serena"))
    ap.add_argument("--instruct", default=os.environ.get("TTS_ZH_INSTRUCT", INSTRUCT))
    ap.add_argument("--takes", type=int, default=3, help="versões por fala (fica a melhor)")
    ap.add_argument("--only", help="ids separados por vírgula (route.0,hub.2)")
    ap.add_argument("--out-dir", help="pasta de saída (padrão: a do arquivo de cada fala)")
    ap.add_argument("--threads", type=int, default=int(os.environ.get("TTS_ZH_THREADS", "4")))
    ap.add_argument("--force", action="store_true", help="refaz mesmo com o .key em dia")
    args = ap.parse_args()

    items = json.load(open(args.list, encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None
    voice_id = f"{MODEL}|{args.speaker}|{args.instruct}|{VERSION}"
    todo = []
    for it in items:
        i = os.path.basename(it["file"])[: -len(".wav")]
        if only and i not in only:
            continue
        out = os.path.join(args.out_dir, i + ".wav") if args.out_dir else it["file"]
        key = hashlib.sha1(f"{it['text']}|{voice_id}".encode()).hexdigest()
        if not args.force and os.path.exists(out) and os.path.exists(out + ".key") and open(out + ".key").read() == key:
            continue
        todo.append((i, it["text"], out, key))
    if not todo:
        print("nada a fazer (todas as falas em dia)")
        return
    os.makedirs(os.path.dirname(todo[0][2]), exist_ok=True)
    rep_path = os.path.join(os.path.dirname(todo[0][2]), "tts_zh.report.json")
    report = json.load(open(rep_path, encoding="utf-8")) if os.path.exists(rep_path) else {}

    voice, ear, judge = Voice(args.speaker, args.instruct, args.threads), Ear(), Judge()
    t0 = time.time()
    for n, (i, text, out, key) in enumerate(todo, 1):
        want = tokens(text)
        han = len(HAN.findall(text))
        base = zlib.crc32(text.encode("utf-8")) & 0x7FFFFFFF
        takes = []
        for k in range(args.takes):
            seed = (base + k * 7919) & 0x7FFFFFFF
            x = squeeze(make_take(voice, text, seed), voice.sr)
            d = len(x) / voice.sr
            cps = han / d if d else 0
            heard = ear.hear(x, voice.sr)
            score = match(want, tokens(heard))
            mos = judge.score(x, voice.sr)
            ok = score >= 0.92 and CPS[0] <= cps <= CPS[1] and (mos is None or mos >= MOS_MIN)
            takes.append(dict(seed=seed, x=x, dur=round(d, 2), cps=round(cps, 2), match=round(score, 3), mos=mos, heard=heard, ok=ok))
            if ok:
                break
        best = max(takes, key=lambda t: (t["ok"], round(t["match"], 2), t["mos"] or 0))
        y = resample_poly(best["x"].astype(np.float64), OUT_SR // 8000, voice.sr // 8000)
        y = (y / max(1.0, np.abs(y).max() / 0.97)).astype(np.float32)
        sf.write(out, y, OUT_SR, subtype="PCM_16")
        open(out + ".key", "w").write(key)
        report[i] = {
            "text": text,
            "speaker": args.speaker,
            "seed": best["seed"],
            "dur": best["dur"],
            "cps": best["cps"],
            "match": best["match"],
            "mos": best["mos"],
            "heard": best["heard"],
            "ok": best["ok"],
            "takes": [{k: v for k, v in t.items() if k != "x"} for t in takes],
        }
        json.dump(report, open(rep_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        flag = "" if best["ok"] else "  ← rever"
        el = time.time() - t0
        print(
            f"[{n}/{len(todo)}] {i:12s} {best['dur']:5.2f} s {best['cps']:4.1f} c/s casou {best['match']:.0%}"
            f" nota {best['mos']} ({len(takes)} versão(ões)) {el / 60:5.1f} min{flag}\n      ouvido: {best['heard']}",
            flush=True,
        )
    bad = [i for i, r in report.items() if not r["ok"]]
    print(f"\n{len(report)} falas no relatório; a rever: {', '.join(bad) if bad else 'nenhuma'}")


if __name__ == "__main__":
    main()
