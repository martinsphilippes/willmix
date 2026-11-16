#!/usr/bin/env python3
"""Áudio da narração: síntese frase a frase, montagem com pausas, pós-processo
(−16 LUFS, pico ≤ −1,5 dBTP) e conferência automática por transcrição (STT).

Roda no ambiente `.venv-stt` (faster-whisper, soundfile, num2words). Cada motor
de voz roda no próprio ambiente e é chamado por subprocesso (motores/).
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf

from normalizar import carregar_pronuncias, dividir_frases, normalizar

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
CACHE = AQUI / ".cache"
SR = 48000  # taxa final de trabalho

MOTORES = {
    "kokoro": {"venv": ".venv-kokoro", "script": "motor_kokoro.py", "versao": 2},
    "supertonic": {"venv": ".venv-supertonic", "script": "motor_supertonic.py"},
    "piper": {"venv": ".venv-piper", "script": "motor_piper.py"},
    "parler": {"venv": ".venv-parler", "script": "motor_parler.py"},
    "chatterbox": {"venv": ".venv-chatterbox", "script": "motor_chatterbox.py"},
    "qwen": {"venv": ".venv-qwen", "script": "motor_qwen.py"},
}

PAUSA_FRASE = 0.32   # entre frases
PAUSA_IDEIA = 0.70   # entre ideias (parágrafo ou marcador "¶")


# ------------------------------------------------------------------ síntese --

def chave_cache(motor: str, cfg: dict, texto: str) -> str:
    base = json.dumps({"m": motor, "mv": MOTORES[motor].get("versao", 1),
                       "v": cfg.get("voz"), "vel": cfg.get("velocidade"),
                       "seed": cfg.get("seed"), "op": cfg.get("opcoes", {}), "t": texto},
                      sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:20]


def sintetizar(motor: str, cfg: dict, textos: list[str], pasta_cache: Path | None = None
               ) -> list[dict]:
    """Sintetiza cada texto (já normalizado) num WAV; usa o cache por frase.

    Devolve, na ordem, {texto, wav, duracao, tempo_sintese, do_cache}.
    """
    pasta = pasta_cache or (CACHE / "frases" / motor)
    pasta.mkdir(parents=True, exist_ok=True)
    itens, saida = [], []
    for texto in textos:
        k = chave_cache(motor, cfg, texto)
        wav, meta = pasta / f"{k}.wav", pasta / f"{k}.json"
        # TREINO_SEM_CACHE=1 refaz a síntese (medir a velocidade com a máquina livre).
        usar_cache = wav.exists() and meta.exists() and not os.environ.get("TREINO_SEM_CACHE")
        registro = {"texto": texto, "wav": str(wav), "do_cache": usar_cache}
        if registro["do_cache"]:
            registro.update(json.loads(meta.read_text(encoding="utf-8")))
        else:
            itens.append({"id": k, "texto": texto, "saida": str(wav)})
        saida.append(registro)
    if itens:
        info = MOTORES[motor]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                         encoding="utf-8") as f:
            json.dump({**cfg, "itens": itens}, f, ensure_ascii=False)
            trabalho = f.name
        env = {**os.environ, "HF_HOME": str(CACHE / "hf"), "PYTHONWARNINGS": "ignore",
               "TOKENIZERS_PARALLELISM": "false"}
        proc = subprocess.run(
            [str(AQUI / info["venv"] / "bin" / "python"), info["script"], trabalho],
            cwd=AQUI / "motores", env=env, capture_output=True, text=True)
        os.unlink(trabalho)
        if proc.returncode != 0:
            raise RuntimeError(f"motor {motor} falhou:\n{proc.stderr[-3000:]}")
        medidas = {}
        for linha in proc.stdout.splitlines():
            if linha.startswith("{"):
                d = json.loads(linha)
                medidas[d.pop("id")] = d
        for registro in saida:
            k = Path(registro["wav"]).stem
            if k in medidas:
                registro.update(medidas[k])
                (pasta / f"{k}.json").write_text(
                    json.dumps(medidas[k], ensure_ascii=False), encoding="utf-8")
    return saida


# ----------------------------------------------------------------- montagem --

def ler_mono(caminho: str | Path, sr: int = SR) -> np.ndarray:
    """Lê um áudio como mono float32 na taxa de trabalho (reamostra com ffmpeg/soxr)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(caminho), "-ac", "1", "-ar", str(sr),
           "-af", "aresample=resampler=soxr:precision=28", "-f", "f32le", "-"]
    bruto = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(bruto, dtype=np.float32).copy()


def aparar_silencio(a: np.ndarray, sr: int = SR, limiar_db: float = -45.0,
                    margem: float = 0.03) -> np.ndarray:
    """Tira o silêncio das pontas (as pausas são postas na montagem, iguais em todos)."""
    if a.size == 0:
        return a
    janela = max(1, int(sr * 0.01))
    n = a.size // janela
    if n == 0:
        return a
    rms = np.sqrt(np.mean(a[: n * janela].reshape(n, janela) ** 2, axis=1) + 1e-12)
    vivos = np.where(20 * np.log10(rms) > limiar_db)[0]
    if vivos.size == 0:
        return a
    ini = max(0, vivos[0] * janela - int(margem * sr))
    fim = min(a.size, (vivos[-1] + 1) * janela + int(margem * sr))
    return a[ini:fim]


def suavizar_pontas(a: np.ndarray, sr: int = SR, ms: float = 8.0) -> np.ndarray:
    """Fade curto nas pontas: evita o clique na emenda."""
    n = min(int(sr * ms / 1000), a.size // 2)
    if n > 0:
        rampa = np.linspace(0.0, 1.0, n, dtype=np.float32)
        a[:n] *= rampa
        a[-n:] *= rampa[::-1]
    return a


def montar(frases: list[dict], destino: Path, pausa_inicial: float = 0.15,
           pausa_final: float = 0.25) -> dict:
    """Junta as frases com pausas naturais e normaliza o volume.

    `frases`: [{wav, pausa_depois?}] em ordem. Devolve os tempos de cada frase
    (início e fim, em segundos, já no áudio final), a duração e o volume medido.
    """
    pedacos, tempos, t = [np.zeros(int(pausa_inicial * SR), dtype=np.float32)], [], pausa_inicial
    for i, f in enumerate(frases):
        a = suavizar_pontas(aparar_silencio(ler_mono(f["wav"])))
        tempos.append({"inicio": round(t, 3), "fim": round(t + a.size / SR, 3)})
        pedacos.append(a)
        t += a.size / SR
        ultimo = i == len(frases) - 1
        pausa = pausa_final if ultimo else float(f.get("pausa_depois", PAUSA_FRASE))
        pedacos.append(np.zeros(int(pausa * SR), dtype=np.float32))
        t += pausa
    bruto = destino.with_suffix(".bruto.wav")
    sf.write(bruto, np.concatenate(pedacos), SR, subtype="PCM_24")
    medida = normalizar_volume(bruto, destino)
    bruto.unlink()
    return {"frases": tempos, "duracao": round(t, 3), **medida}


def _loudnorm_medir(caminho: Path, filtro_extra: str = "") -> dict:
    af = (filtro_extra + "," if filtro_extra else "") + \
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json"
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(caminho), "-af", af,
                        "-f", "null", "-"], capture_output=True, text=True)
    return json.loads(re.search(r"\{[^{}]+\}\s*$", p.stderr.strip(), re.S).group(0))


def normalizar_volume(origem: Path, destino: Path) -> dict:
    """−16 LUFS integrados, pico real ≤ −1,5 dBTP; passa-altas leve (tira ronco). Sem efeitos."""
    pre = "highpass=f=60"
    m = _loudnorm_medir(origem, pre)
    af = (f"{pre},loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:"
          f"measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(origem), "-af", af,
                    "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", str(destino)], check=True)
    final = _loudnorm_medir(destino)
    return {"lufs": float(final["input_i"]), "pico_dbtp": float(final["input_tp"])}


def silencios(caminho: Path, minimo: float = 2.0, limiar_db: int = -45) -> list[dict]:
    """Trechos de silêncio com mais de `minimo` segundos (não intencionais = problema)."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(caminho), "-af",
                        f"silencedetect=noise={limiar_db}dB:d={minimo}", "-f", "null", "-"],
                       capture_output=True, text=True)
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", p.stderr)]
    dur = [float(x) for x in re.findall(r"silence_duration: ([\d.]+)", p.stderr)]
    return [{"inicio": a, "duracao": b} for a, b in zip(ini, dur)]


# -------------------------------------------------------------------- STT ----

_WHISPER = None


def transcrever(caminho: Path, modelo: str = "large-v3-turbo") -> dict:
    """Transcreve com faster-whisper local (CPU). Devolve texto e palavras com tempo."""
    global _WHISPER
    if _WHISPER is None:
        _WHISPER = {}
    if modelo not in _WHISPER:  # um modelo por nome: o principal e o da segunda opinião
        from faster_whisper import WhisperModel
        os.environ.setdefault("HF_HOME", str(CACHE / "hf"))
        _WHISPER[modelo] = WhisperModel(modelo, device="cpu", compute_type="int8", cpu_threads=4,
                                        download_root=str(CACHE / "whisper"))
    # Entrega o áudio já decodificado (16 kHz mono): não depende do PyAV.
    segs, _ = _WHISPER[modelo].transcribe(ler_mono(caminho, 16000), language="pt", beam_size=5,
                                  word_timestamps=True, vad_filter=False,
                                  condition_on_previous_text=False)
    palavras, texto = [], []
    for s in segs:
        texto.append(s.text.strip())
        for w in s.words or []:
            palavras.append({"p": w.word.strip(), "ini": round(w.start, 2), "fim": round(w.end, 2)})
    return {"texto": " ".join(texto), "palavras": palavras}


# Grafias que o STT usa para a marca: todas contam como "wellmix".
_MARCA = re.compile(r"\b(u[eé]l[\s-]?mi(?:x|ks|cs|ques|que)|well?[\s-]?mi(?:x|ks|cs)|"
                    r"wel[\s-]?mix|uel[\s-]?mix|u[eé]u[\s-]?mi(?:x|ks))\b", re.I)


def _equivalentes() -> list[dict]:
    """Grafias do reconhecedor que valem como a do roteiro (pronuncias.json)."""
    arq = RAIZ / "_config" / "pronuncias.json"
    return json.loads(arq.read_text(encoding="utf-8")).get("stt_equivalentes", []) if arq.exists() else []


def _chave(texto: str, pron) -> list[str]:
    """Texto → palavras comparáveis (sem acento, pontuação nem diferença de grafia)."""
    t = _MARCA.sub("wellmix", texto)
    for eq in _equivalentes():
        t = re.sub(rf"(?<![\wÀ-ÿ]){re.escape(eq['ouvido'])}(?![\wÀ-ÿ-])", eq["escrito"], t, flags=re.I)
    t = normalizar(t, pronuncias=pron)
    t = _MARCA.sub("wellmix", t)
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9\s]", " ", t.replace("-", " "))
    return t.split()


def _fundir(texto: str) -> str:
    """Junta as palavras e funde vogais vizinhas iguais ou em hiato ("envie a" → "envia")."""
    return re.sub(r"[ea](?=a)|o(?=o)|e(?=e)", "", texto.replace(" ", ""))


def comparar(roteiro: str, transcricao: str) -> dict:
    """Compara o roteiro (grafia original) com o que o STT ouviu, palavra a palavra."""
    pron = carregar_pronuncias()
    a, b = _chave(roteiro, pron), _chave(transcricao, pron)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    difs, erros = [], 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        esperado, ouvido = " ".join(a[i1:i2]), " ".join(b[j1:j2])
        # Junções inofensivas: "bem vindo" × "bemvindo", "a gente" × "agente".
        if esperado.replace(" ", "") == ouvido.replace(" ", ""):
            continue
        # Vogais que se fundem na fala corrida e o reconhecedor não separa: "envie a" × "envia",
        # "para a" × "para". E artigo ou conjunção de uma letra que some ou sobra ("a", "o", "e").
        if _fundir(esperado) == _fundir(ouvido):
            continue
        if not (set(esperado.split()) | set(ouvido.split())) - {"a", "o", "e"} and (not esperado or not ouvido):
            continue
        erros += max(i2 - i1, j2 - j1)
        difs.append({"esperado": esperado, "ouvido": ouvido})
    return {"palavras": len(a), "erros": erros,
            "wer": round(erros / max(1, len(a)), 4), "diferencas": difs}


def palavras_por_minuto(texto_falado: str, duracao_fala: float) -> float:
    return round(len(texto_falado.split()) / max(0.1, duracao_fala) * 60, 1)


def preparar_falas(texto: str, motor: str) -> list[dict]:
    """Roteiro → frases normalizadas para o motor, com a pausa depois de cada uma.

    "¶" ou linha em branco marca mudança de ideia (pausa maior).
    """
    pron = carregar_pronuncias(motor)
    saida = []
    blocos = [b.strip() for b in re.split(r"\s*(?:¶|\n\s*\n)\s*", texto) if b.strip()]
    for bi, bloco in enumerate(blocos):
        frases = dividir_frases(bloco)
        for fi, frase in enumerate(frases):
            fim_de_ideia = fi == len(frases) - 1 and bi < len(blocos) - 1
            saida.append({"original": frase,
                          "falado": normalizar(frase, motor, pron),
                          "pausa_depois": PAUSA_IDEIA if fim_de_ideia else PAUSA_FRASE})
    return saida
