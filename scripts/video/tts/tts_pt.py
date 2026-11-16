"""
Narração do vídeo em português do Brasil, voz feminina, gerada na própria
máquina (modelos abertos, em CPU); nenhum texto sai para serviço externo.
Mesma interface do tts.py.

    HF_HOME=<cache> <venv>/bin/python tts/tts_pt.py out/<vídeo>.tts.json \
        --voice <referencia.wav> [--engine qwen|supertonic] [--no-verify]

Motor padrão (qwen): Qwen3-TTS-12Hz-1.7B-Base (Alibaba, Apache-2.0, uso
comercial livre), voz clonada de um trecho de referência. Pesos baixados do
Hugging Face na primeira execução (cerca de 4,5 GB); sem GPU, bf16 em CPU.

Voz de referência (--voice ou TTS_PT_REF; a transcrição fica em <ref>.txt, ou
--ref-text, ou TTS_PT_REF_TEXT): trecho de 9,7 s gerado por nós com
Qwen3-TTS-12Hz-1.7B-VoiceDesign (Apache-2.0), idioma Portuguese, semente 22, descrição
"A Brazilian woman in her early thirties from São Paulo, native Brazilian Portuguese
accent. Warm, clear, professional corporate narrator voice, medium pitch, calm natural
pace with gentle pauses to breathe, friendly and confident." e o texto "Bom dia. Eu
acompanho cada etapa da importação, do pedido até a entrega, e aviso o cliente sempre
que alguma coisa muda no caminho." É voz sintética: não é gravação nem clone de pessoa
real, sem terceiros e sem licença a pagar. O arquivo fica fora do repositório (a pasta
tts/models/ é ignorada pelo git).

Dependências (venv próprio, Python 3.13): torch/torchaudio (CPU), qwen-tts (instalado
com --no-deps) com transformers==4.57.3, accelerate==1.12.0, diffusers/huggingface_hub
<1.0, librosa, einops, sox, onnxruntime, soundfile, scipy; faster-whisper (conferência);
supertonic (só para a alternativa). Os pesos vêm do Hugging Face (HF_HOME define o cache).

Alternativa (--engine supertonic): Supertonic 3 (OpenRAIL-M: uso comercial
permitido, com restrições de uso), voz F2 (ou --voice F1..F5), em ONNX; bem mais
rápida e estável, um pouco menos expressiva.

Comportamento (igual ao tts.py): lê [{"file": ..., "text": ...}], só refaz a fala
cujo texto, voz ou motor mudou (marca .key), tira o silêncio das pontas e grava
WAV de 48 kHz, mono, PCM_16. Além disso:
  - fala longa é sintetizada frase a frase e emendada com 180 a 260 ms de pausa;
  - a semente de cada frase vem do texto (crc32): rodar de novo dá o mesmo áudio;
  - pausa interna maior que 0,5 s é encurtada; respiro ou estalo curto solto no fim da\n    frase é cortado; duração implausível por letra reprova;
  - com --verify (padrão, se o faster-whisper estiver instalado) cada frase é
    transcrita (Whisper, local) e comparada com o texto; se diverge, sorteia outra
    semente (até 4 vezes) e fica com a melhor; as que não passam saem na lista
    "revisar" no fim.
Sem controle de velocidade: --speed é aceito (compatibilidade com o tts.py) mas ignorado. Os avisos de "sox" e
"flash-attn" na partida do Qwen são inofensivos.
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
import unicodedata
import zlib
from difflib import SequenceMatcher

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

VERSION = "pt3"
MODEL = os.environ.get("TTS_PT_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
WHISPER = os.environ.get("TTS_PT_WHISPER", "medium")
OUT_SR = 48000
MAX_TRIES = 4
OK_SIMILARITY = 0.90
MAX_GAP = 0.5  # pausa interna máxima dentro de uma frase, em segundos
PAD = 0.135  # folga que o trim() deixa nas pontas de cada frase (0,045 + 0,09 s)


def trim(x, sr, floor=0.012, pad=0.045):
    """Tira o silêncio das pontas, deixando uma folga curta (mesma regra do tts.py)."""
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


def drop_islands(x, sr, gap=0.35, short=0.18, thr_db=-45.0):
    """Tira respiro ou estalo curto solto numa ponta, separado da fala por uma pausa longa."""
    hop = int(0.01 * sr)
    n = len(x) // hop
    if n < 20:
        return x
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    idx = np.where(20 * np.log10(rms / (np.percentile(rms, 95) + 1e-9) + 1e-9) > thr_db)[0]
    if len(idx) == 0:
        return x
    islands, a, b = [], idx[0], idx[0]
    for k in idx[1:]:
        if (k - b - 1) * 0.01 >= gap:
            islands.append((a, b))
            a = k
        b = k
    islands.append((a, b))
    lo, hi = 0, len(x)
    if len(islands) > 1 and (islands[0][1] - islands[0][0] + 1) * 0.01 < short:
        lo = islands[1][0] * hop
    if len(islands) > 1 and (islands[-1][1] - islands[-1][0] + 1) * 0.01 < short:
        hi = (islands[-2][1] + 1) * hop
    return x[lo:hi] if hi - lo > 0 else x


def squeeze_gaps(x, sr, cap=MAX_GAP, thr_db=-45.0):
    """Encurta silêncios internos maiores que `cap` (corta o meio do silêncio)."""
    hop = int(0.01 * sr)
    n = len(x) // hop
    if n < 10:
        return x
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    quiet = 20 * np.log10(rms / (np.percentile(rms, 95) + 1e-9) + 1e-9) < thr_db
    keep_frames = int(cap / 0.01)
    parts, start, i = [], 0, 0
    while i < n:
        if not quiet[i]:
            i += 1
            continue
        j = i
        while j < n and quiet[j]:
            j += 1
        if j - i > keep_frames and i > 0 and j < n:
            half = keep_frames // 2
            parts.append(x[start : (i + half) * hop])
            start = (j - half) * hop
        i = j
    parts.append(x[start:])
    return np.concatenate(parts) if len(parts) > 1 else x


# ---- texto -----------------------------------------------------------------
def split_text(text, max_chars=150):
    """Divide em frases (. ! ? …); frase muito longa também em ; : , . Devolve [(frase, pausa_s)]."""
    out = []
    for s in re.split(r"(?<=[.!?…])\s+", text.strip()):
        s = s.strip()
        if s:
            out.extend(_split_long(s, max_chars))
    return out


def _pause(s):
    return 0.26 if s[-1:] in "!?" else 0.24 if s[-1:] in ".…" else 0.18


def _split_long(s, max_chars):
    if len(s) <= max_chars:
        return [(s, _pause(s))]
    cuts = [m.end() for m in re.finditer(r"[;:,]\s", s)]
    cuts = [c for c in cuts if 30 <= c <= len(s) - 30]
    if not cuts:
        return [(s, _pause(s))]
    c = min(cuts, key=lambda c: abs(c - len(s) / 2))
    return _split_long(s[:c].strip(), max_chars) + _split_long(s[c:].strip(), max_chars)


EQUIV = [  # grafias que o Whisper escreve para o que o roteiro respelha
    (r"\b(?:u|w|wh|h)?e?l+m[iy](?:ks|x|cs|cks|ques|k)\b", "wellmix"),
    (r"\b(?:bl|b l|bele|be ele|b e l e)\b", "bl"),
    (r"\b(?:sla|s l a|esse ele a|essele a)\b", "sla"),
    (r"\b(?:erp|e r p|erre pe|erre p|errepe|rp|r p|e erre pe)\b", "erp"),
    (r"\b(?:control|controle|kontrol|kontrole)\s+(?:tower|tauer|taue|towel)\b", "controltower"),
    (r"\bimeiu?s?\b|\be ?mails?\b", "email"),
    (r"\bbuques?\b|\bbooks?\b", "book"),
    (r"\b(?:pekin|peking|packing) list\b", "packinglist"),
    (r"\binvois\b|\binvoices?\b", "invoice"),
    (r"\bplaners?\b|\bplanners?\b", "planner"),
    (r"\bconteineres?\b|\bcontainers?\b", "container"),
    (r"\bseis\b", "6"),
]


def canon(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s.replace("-", " "))
    s = re.sub(r"\s+", " ", s).strip()
    for pat, rep in EQUIV:
        s = re.sub(pat, rep, s)
    return s.split()


def similarity(ref, heard):
    return SequenceMatcher(None, canon(ref), canon(heard)).ratio()


# ---- motores ---------------------------------------------------------------
class Qwen:
    sr = 24000

    def __init__(self, ref, ref_text, threads):
        import torch
        from qwen_tts import Qwen3TTSModel

        self.torch = torch
        torch.set_num_threads(threads)
        self.m = Qwen3TTSModel.from_pretrained(MODEL, device_map="cpu", dtype=torch.bfloat16)
        self.prompt = self.m.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text)

    def synth(self, text, seed):
        self.torch.manual_seed(seed)
        w, sr = self.m.generate_voice_clone(text=text, language="Portuguese", voice_clone_prompt=self.prompt)
        assert sr == self.sr, sr
        return np.asarray(w[0], dtype=np.float32)


class Supertonic:
    sr = 44100

    def __init__(self, voice):
        from supertonic import TTS

        self.tts = TTS(auto_download=True)
        self.style = self.tts.get_voice_style(voice_name=voice)
        self.sr = self.tts.sample_rate

    def synth(self, text, seed):
        np.random.seed(seed)
        w, _ = self.tts.synthesize(text, voice_style=self.style, lang="pt")
        return np.asarray(w, dtype=np.float32).squeeze()


class Verifier:
    def __init__(self):
        from faster_whisper import WhisperModel

        self.m = WhisperModel(WHISPER, device="cpu", compute_type="int8", cpu_threads=4)

    def heard(self, x, sr):
        g = math.gcd(16000, sr)
        x16 = resample_poly(x.astype(np.float64), 16000 // g, sr // g).astype(np.float32)
        segs, _ = self.m.transcribe(x16, language="pt", beam_size=1, condition_on_previous_text=False)
        return " ".join(s.text.strip() for s in segs)


# ---- síntese ---------------------------------------------------------------
STATS = {"frases": 0, "refeitas": 0, "tentativas": 0}


def synth_sentence(eng, ver, sent, problems):
    """Frase → áudio aparado (no sr do motor). Tenta outras sementes se a conferência reprova."""
    letters = len(re.sub(r"[^a-zà-ú0-9]", "", sent.lower()))
    base = zlib.crc32(sent.encode("utf-8"))
    best, tries = None, 0
    for k in range(MAX_TRIES):
        tries += 1
        seed = (base + k * 7919) & 0x7FFFFFFF
        x = squeeze_gaps(trim(drop_islands(trim(eng.synth(sent, seed), eng.sr), eng.sr), eng.sr), eng.sr)
        cps = letters / max(0.1, len(x) / eng.sr)
        score, heard = 1.0, ""
        if not 6.5 <= cps <= 24:  # fala cortada ou ruído esticando o fim
            score = 0.0
        elif ver is not None:
            heard = ver.heard(x, eng.sr)
            score = similarity(sent, heard)
        if best is None or score > best[0]:
            best = (score, x, heard, k)
        if score >= OK_SIMILARITY:
            break
    score, x, heard, k = best
    STATS["frases"] += 1
    STATS["tentativas"] += tries
    STATS["refeitas"] += tries > 1
    if score < OK_SIMILARITY:
        problems.append((sent, score, heard))
    return x


def render(eng, ver, text, problems):
    chunks = []
    for sent, pause in split_text(text):
        # a pausa pedida é o silêncio total entre as frases: desconta a folga das duas pontas
        chunks += [synth_sentence(eng, ver, sent, problems), np.zeros(int(max(0.0, pause - PAD) * eng.sr), dtype=np.float32)]
    y = trim(np.concatenate(chunks[:-1]), eng.sr)  # sem pausa depois da última frase
    g = math.gcd(OUT_SR, eng.sr)
    y = resample_poly(y.astype(np.float64), OUT_SR // g, eng.sr // g)
    y /= max(1.0, np.abs(y).max() / 0.97)  # sem estouro no WAV de 16 bits
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("list")
    ap.add_argument("--engine", choices=["qwen", "supertonic"], default="qwen")
    ap.add_argument("--voice", default=os.environ.get("TTS_PT_REF"), help="qwen: WAV de referência; supertonic: F1..F5/M1..M5")
    ap.add_argument("--ref-text", default=os.environ.get("TTS_PT_REF_TEXT"), help="transcrição da referência (ou <ref>.txt)")
    ap.add_argument("--speed", type=float, default=1.0, help="ignorado (os motores não têm velocidade); aceito por compatibilidade com o tts.py")
    ap.add_argument("--verify", action=argparse.BooleanOptionalAction, default=True)
    ap.add_argument("--threads", type=int, default=int(os.environ.get("TTS_PT_THREADS", "4")))
    args = ap.parse_args()

    if args.speed != 1.0:
        print("aviso: --speed ignorado (sem controle de velocidade neste motor)", file=sys.stderr)
    ref_text = None
    if args.engine == "qwen":
        if not args.voice or not os.path.exists(args.voice):
            sys.exit("Informe a voz de referência: --voice <ref.wav> (ou TTS_PT_REF); veja o cabeçalho deste arquivo.")
        ref_text = args.ref_text
        if not ref_text and os.path.exists(os.path.splitext(args.voice)[0] + ".txt"):
            ref_text = open(os.path.splitext(args.voice)[0] + ".txt", encoding="utf-8").read().strip()
        if not ref_text:
            sys.exit("Falta a transcrição da referência: --ref-text, TTS_PT_REF_TEXT ou <ref>.txt ao lado do WAV.")
        voice_id = hashlib.sha1(open(args.voice, "rb").read() + ref_text.encode()).hexdigest()[:12]
        model_id = MODEL
    else:
        args.voice = args.voice or "F2"
        voice_id, model_id = args.voice, "supertonic-3"

    items = json.load(open(args.list, encoding="utf-8"))
    keys = [hashlib.sha1(f"{it['text']}|{voice_id}|{model_id}|{VERSION}".encode()).hexdigest() for it in items]
    todo = [
        (it, key)
        for it, key in zip(items, keys)
        if not (os.path.exists(it["file"]) and os.path.exists(it["file"] + ".key") and open(it["file"] + ".key").read() == key)
    ]
    made, problems, eng, ver, t0 = 0, [], None, None, time.time()
    for it, key in todo:
        if eng is None:
            eng = Qwen(args.voice, ref_text, args.threads) if args.engine == "qwen" else Supertonic(args.voice)
            if args.verify:
                try:
                    ver = Verifier()
                except ImportError:
                    print("aviso: faster-whisper não instalado; sem conferência por transcrição", file=sys.stderr)
        y = render(eng, ver, it["text"], problems)
        os.makedirs(os.path.dirname(it["file"]), exist_ok=True)
        sf.write(it["file"], y.astype(np.float32), OUT_SR, subtype="PCM_16")
        open(it["file"] + ".key", "w").write(key)
        made += 1
        print(f"{os.path.basename(it['file'])}  {len(y) / OUT_SR:5.2f} s  {it['text'][:70]}", flush=True)
    print(f"{made} falas geradas, {len(items) - made} já prontas")
    if STATS["frases"]:
        print(f"{STATS['frases']} frases, {STATS['refeitas']} refeitas com outra semente "
              f"({STATS['tentativas']} sínteses), {(time.time() - t0) / 60:.1f} min")
    if problems:
        print(f"revisar: {len(problems)} frase(s) abaixo de {OK_SIMILARITY:.2f} de similaridade com o texto")
        for sent, score, heard in problems:
            print(f"  {score:.2f}  {sent}\n        ouvido: {heard}")


if __name__ == "__main__":
    sys.exit(main())
