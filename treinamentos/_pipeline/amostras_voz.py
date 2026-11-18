#!/usr/bin/env python3
"""Gera as amostras de voz para o dono escolher (PARADA A).

O MESMO texto de teste (~25 s: saudação, pergunta, valor em reais, data,
siglas e a marca) em cada combinação motor + voz, com a ficha de cada uma:
licença, velocidade nesta máquina, ritmo, volume e conferência por STT.

Uso: .venv-stt/bin/python amostras_voz.py [id ...]   (sem id = todas)
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

from audio import (comparar, montar, palavras_por_minuto, preparar_falas, silencios,
                   sintetizar, transcrever)

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "_config" / "amostras-voz"

TEXTO = (
    "Olá! Bem-vindo ao treinamento da Wellmix. Pronto para começar? ¶ "
    "Hoje vamos conferir um pedido de R$ 12.480,50, com entrega prevista para 23/11/2026. ¶ "
    "Olha aqui no canto direito: é o botão \"Novo pedido\". Clica nele. "
    "Antes de salvar, confira o CNPJ do fornecedor e o número da NF-e."
)

CANDIDATOS = {
    "kokoro-dora": {
        "motor": "kokoro", "rotulo": "Kokoro-82M · voz Dora (feminina)",
        "cfg": {"voz": "pf_dora", "velocidade": 0.86, "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: hexgrad/Kokoro-82M). Uso comercial liberado.",
    },
    "kokoro-alex": {
        "motor": "kokoro", "rotulo": "Kokoro-82M · voz Alex (masculina)",
        "cfg": {"voz": "pm_alex", "velocidade": 0.86, "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: hexgrad/Kokoro-82M). Uso comercial liberado.",
    },
    "kokoro-santa": {
        "motor": "kokoro", "rotulo": "Kokoro-82M · voz Santa (masculina)",
        "cfg": {"voz": "pm_santa", "velocidade": 0.86, "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: hexgrad/Kokoro-82M). Uso comercial liberado.",
    },
    "supertonic-f1": {
        "motor": "supertonic", "rotulo": "Supertonic 3 · voz F1 (feminina)",
        "cfg": {"voz": "F1", "velocidade": 1.1, "seed": 7, "opcoes": {"passos": 12}},
        "licenca": ("Pesos: BigScience OpenRAIL-M (Supertone/supertonic-3); código MIT. Uso "
                    "comercial permitido, com restrições de uso: é obrigatório avisar que o "
                    "conteúdo é gerado por máquina (Anexo A, item e)."),
    },
    "supertonic-m1": {
        "motor": "supertonic", "rotulo": "Supertonic 3 · voz M1 (masculina)",
        "cfg": {"voz": "M1", "velocidade": 1.1, "seed": 7, "opcoes": {"passos": 12}},
        "licenca": ("Pesos: BigScience OpenRAIL-M (Supertone/supertonic-3); código MIT. Uso "
                    "comercial permitido, com restrições de uso: é obrigatório avisar que o "
                    "conteúdo é gerado por máquina (Anexo A, item e)."),
    },
    "chatterbox-embutida": {
        "motor": "chatterbox", "rotulo": "Chatterbox Multilingual pt-BR · voz embutida do modelo",
        "cfg": {"voz": "embutida", "seed": 7,
                "opcoes": {"temperatura": 0.7, "cfg": 0.3, "expressividade": 0.5}},
        "tempo": 0.9,
        "licenca": ("MIT (código e pesos: ResembleAI/Chatterbox-Multilingual-pt-br). Uso "
                    "comercial liberado. O áudio sai com marca d'água inaudível (Perth)."),
    },
    "chatterbox-dora": {
        "motor": "chatterbox",
        "rotulo": "Chatterbox Multilingual pt-BR · timbre sintético (referência: Kokoro Dora, feminina)",
        "cfg": {"voz": "ref-sintetica-dora", "seed": 7,
                "opcoes": {"temperatura": 0.7, "cfg": 0.3, "expressividade": 0.5,
                           "referencia": str(SAIDA / "kokoro-dora.wav")}},
        "licenca": ("MIT (código e pesos: ResembleAI/Chatterbox-Multilingual-pt-br). A referência de "
                    "timbre é um áudio sintético do Kokoro (Apache-2.0): nenhuma pessoa real é "
                    "clonada. O áudio sai com marca d'água inaudível (Perth)."),
    },
    "piper-faber": {
        "motor": "piper", "rotulo": "Piper · Faber (masculina, falante brasileiro)",
        "cfg": {"voz": "faber", "velocidade": 0.88, "seed": 7},
        "licenca": "Vozes: dados CC0 (OHF-Voice/voice-datasets, gravações doadas para síntese de voz); modelos em rhasspy/piper-voices (MIT). Programa piper-tts: GPL-3.0 (só gera o áudio; não é distribuído). Uso comercial do áudio liberado.",
    },
    "piper-cadu": {
        "motor": "piper", "rotulo": "Piper · Cadu (masculina, falante brasileiro)",
        "cfg": {"voz": "cadu", "velocidade": 0.94, "seed": 7},
        "licenca": "Vozes: dados CC0 (OHF-Voice/voice-datasets, gravações doadas para síntese de voz); modelos em rhasspy/piper-voices (MIT). Programa piper-tts: GPL-3.0 (só gera o áudio; não é distribuído). Uso comercial do áudio liberado.",
    },
    "piper-jeff": {
        "motor": "piper", "rotulo": "Piper · Jeff (masculina, falante brasileiro)",
        "cfg": {"voz": "jeff", "velocidade": 1.0, "seed": 7},
        "licenca": "Vozes: dados CC0 (OHF-Voice/voice-datasets, gravações doadas para síntese de voz); modelos em rhasspy/piper-voices (MIT). Programa piper-tts: GPL-3.0 (só gera o áudio; não é distribuído). Uso comercial do áudio liberado.",
    },
    "chatterbox-faber": {
        "motor": "chatterbox",
        "rotulo": "Chatterbox pt-BR · timbre e sotaque da voz Faber (masculina)",
        "cfg": {"voz": "ref-piper-faber", "seed": 11,
                "opcoes": {"temperatura": 0.7, "cfg": 0.4, "expressividade": 0.5,
                           "referencia": str(SAIDA / "piper-faber.wav")}},
        "licenca": ("MIT (código e pesos: ResembleAI/Chatterbox-Multilingual-pt-br, ajuste fino para o "
                    "português do Brasil). A referência de timbre e sotaque é um áudio sintético "
                    "(não é gravação de pessoa). O áudio sai com marca d'água inaudível (Perth)."),
    },
    "chatterbox-cadu": {
        "motor": "chatterbox",
        "rotulo": "Chatterbox pt-BR · timbre e sotaque da voz Cadu (masculina)",
        "cfg": {"voz": "ref-piper-cadu", "seed": 11,
                "opcoes": {"temperatura": 0.7, "cfg": 0.4, "expressividade": 0.5,
                           "referencia": str(SAIDA / "piper-cadu.wav")}},
        "licenca": ("MIT (código e pesos: ResembleAI/Chatterbox-Multilingual-pt-br, ajuste fino para o "
                    "português do Brasil). A referência de timbre e sotaque é um áudio sintético "
                    "(não é gravação de pessoa). O áudio sai com marca d'água inaudível (Perth)."),
    },
    "chatterbox-feminina": {
        "motor": "chatterbox",
        "rotulo": "Chatterbox pt-BR · timbre feminino sintético, sotaque só do modelo brasileiro",
        "cfg": {"voz": "ref-supertonic-f1-cfg0", "seed": 11,
                "opcoes": {"temperatura": 0.7, "cfg": 0.0, "expressividade": 0.5,
                           "referencia": str(SAIDA / "supertonic-f1.wav")}},
        "licenca": ("MIT (código e pesos: ResembleAI/Chatterbox-Multilingual-pt-br, ajuste fino para o "
                    "português do Brasil). A referência de timbre e sotaque é um áudio sintético "
                    "(não é gravação de pessoa). O áudio sai com marca d'água inaudível (Perth)."),
    },
    "parler-sophia": {
        "motor": "parler", "rotulo": "Parler-TTS multilíngue · Sophia (feminina)",
        "cfg": {"voz": "Sophia", "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: parler-tts/parler-tts-mini-multilingual-v1.1). Uso comercial liberado.",
    },
    "parler-nicholas": {
        "motor": "parler", "rotulo": "Parler-TTS multilíngue · Nicholas (masculina)",
        "cfg": {"voz": "Nicholas", "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: parler-tts/parler-tts-mini-multilingual-v1.1). Uso comercial liberado.",
    },
    "qwen-serena": {
        "motor": "qwen", "rotulo": "Qwen3-TTS 0.6B CustomVoice · voz Serena (feminina)",
        "cfg": {"voz": "Serena", "seed": 7},
        "licenca": "Apache-2.0 (código e pesos: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice).",
    },
}


def gerar(ident: str) -> dict:
    c = CANDIDATOS[ident]
    falas = preparar_falas(TEXTO, c["motor"])
    t0 = time.time()
    res = sintetizar(c["motor"], c["cfg"], [f["falado"] for f in falas])
    parede = time.time() - t0
    for f, r in zip(falas, res):
        f.update(wav=r["wav"])
    wav = SAIDA / f"{ident}.wav"
    tempo = float(c.get("tempo", 1.0))
    if tempo != 1.0:
        # Motor sem controle de velocidade: ajuste fino do andamento, sem mudar o tom.
        for f in falas:
            lento = Path(f["wav"]).with_suffix(f".t{int(tempo * 100)}.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f["wav"], "-af",
                            f"atempo={tempo}", str(lento)], check=True)
            f["wav"] = str(lento)
    medida = montar(falas, wav)
    mp3 = wav.with_suffix(".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame",
                    "-b:a", "160k", str(mp3)], check=True)
    fala_bruta = sum(r["duracao"] for r in res)
    fala_total = fala_bruta / tempo
    sintese_total = sum(r["tempo_sintese"] for r in res)
    stt = transcrever(wav)
    falado = " ".join(f["falado"] for f in falas)
    conf = comparar(TEXTO, stt["texto"])
    ficha = {
        "id": ident, "rotulo": c["rotulo"], "motor": c["motor"], "config": c["cfg"],
        "licenca": c["licenca"],
        "duracao_s": medida["duracao"],
        "velocidade_x_tempo_real": round(sintese_total / fala_bruta, 2), "ajuste_de_andamento": tempo,
        "tempo_sintese_s": round(sintese_total, 1), "tempo_total_com_carga_s": round(parede, 1),
        "do_cache": all(r["do_cache"] for r in res),
        "palavras_por_minuto": palavras_por_minuto(falado, fala_total),
        "lufs": medida["lufs"], "pico_dbtp": medida["pico_dbtp"],
        "silencios_maiores_que_2s": silencios(wav),
        "texto_falado": falado, "stt": stt["texto"],
        "stt_wer": conf["wer"], "stt_diferencas": conf["diferencas"],
        "fonemas": [r.get("fonemas") for r in res if r.get("fonemas")],
    }
    (SAIDA / f"{ident}.json").write_text(json.dumps(ficha, ensure_ascii=False, indent=2),
                                         encoding="utf-8")
    return ficha


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "texto-de-teste.txt").write_text(TEXTO.replace(" ¶ ", "\n\n") + "\n",
                                              encoding="utf-8")
    for ident in sys.argv[1:] or list(CANDIDATOS):
        try:
            f = gerar(ident)
            print(f"{ident}: {f['duracao_s']} s · {f['velocidade_x_tempo_real']}× · "
                  f"{f['palavras_por_minuto']} ppm · {f['lufs']} LUFS · "
                  f"pico {f['pico_dbtp']} dBTP · WER {f['stt_wer']}")
            print("   STT:", f["stt"])
            for d in f["stt_diferencas"]:
                print("   ≠", d)
        except Exception as e:  # um motor que falha não derruba os outros
            print(f"{ident}: FALHOU · {str(e)[-600:]}")


if __name__ == "__main__":
    main()
