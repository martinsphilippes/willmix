#!/usr/bin/env python3
"""Narração de um papel: sintetiza a fala de cada passo do `cenas.json` (frase a
frase, com cache), monta o áudio do passo, confere por STT e mede os tempos.

Áudio primeiro: a gravação da tela lê `_build/audio/tempos.json` e ritma as ações
pela duração de cada fala (e pelo instante de cada palavra).

Uso: .venv-stt/bin/python narrar.py <pasta-do-papel|cenas.json> [--cena ID ...]
                                    [--voz _config/voice.config.json] [--sem-stt]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from audio import comparar, montar, preparar_falas, sintetizar, transcrever

RAIZ = Path(__file__).resolve().parent.parent
VOZ_PADRAO = RAIZ / "_config" / "voice.config.json"
WER_MAXIMO = 0.0  # qualquer palavra ou número diferente é divergência a resolver


def carregar_voz(caminho: Path) -> dict:
    cfg = json.loads(caminho.read_text(encoding="utf-8"))
    return {"motor": cfg["motor"], "cfg": {k: cfg[k] for k in ("voz", "velocidade", "seed", "opcoes")
                                           if k in cfg}}


SEGUNDA_OPINIAO = "large-v3"  # reconhecedor maior, só para as falas que o principal estranhou


def segunda_opiniao(fala: str, wav: Path, registro: dict) -> bool:
    """O reconhecedor principal (turbo) erra consoantes de vez em quando com esta voz. Antes de
    mandar reescrever, um segundo reconhecedor, maior, ouve a mesma fala: se ele entende o
    roteiro, a divergência era do reconhecedor, não da voz. Fica tudo anotado nos tempos."""
    if registro.get("stt2") is None:
        registro["stt2"] = transcrever(wav, SEGUNDA_OPINIAO)["texto"]
    conf2 = comparar(fala, registro["stt2"])
    registro["wer2"] = conf2["wer"]
    if conf2["wer"] > WER_MAXIMO:
        registro["diferencas2"] = conf2["diferencas"]
        return False
    registro.update(conferido_por=SEGUNDA_OPINIAO, diferencas_do_principal=registro.get("diferencas", []), diferencas=[])
    return True


def narrar(cenas_json: Path, voz: dict, so_cenas: list[str] | None, stt: bool) -> int:
    dados = json.loads(cenas_json.read_text(encoding="utf-8"))
    build = cenas_json.parent / "_build" / "audio"
    build.mkdir(parents=True, exist_ok=True)
    arq_tempos = build / "tempos.json"
    tempos = json.loads(arq_tempos.read_text(encoding="utf-8")) if arq_tempos.exists() else {}
    divergencias = 0
    for cena in dados["cenas"]:
        if so_cenas and cena["id"] not in so_cenas:
            continue
        pasta = build / cena["id"]
        pasta.mkdir(exist_ok=True)
        tcena = tempos.setdefault(cena["id"], {})
        for passo in cena.get("passos", []):
            fala = (passo.get("fala") or "").strip()
            if not fala:
                tcena[passo["id"]] = {"duracao": 0, "palavras": []}
                continue
            assinatura = hashlib.sha1(json.dumps([voz, fala], sort_keys=True,
                                                 ensure_ascii=False).encode()).hexdigest()[:16]
            wav = pasta / f"{passo['id']}.wav"
            anterior = tcena.get(passo["id"], {})
            falas = preparar_falas(fala, voz["motor"])
            falado = " ".join(f["falado"] for f in falas)
            # Mesma fala, mesma voz e mesmo texto falado (o dicionário de pronúncias e o
            # normalizador podem ter mudado sem a fala mudar): o áudio guardado continua valendo.
            if anterior.get("assinatura") == assinatura and anterior.get("falado") == falado and wav.exists():
                # Nada mudou nesta fala: só refaz a comparação com o que o STT já ouviu
                # (as regras de comparação e as equivalências podem ter mudado).
                if stt and anterior.get("stt"):
                    conf = comparar(fala, anterior["stt"])
                    anterior.update(wer=conf["wer"], diferencas=conf["diferencas"])
                    anterior.pop("conferido_por", None)
                    if conf["wer"] > WER_MAXIMO and not segunda_opiniao(fala, wav, anterior):
                        divergencias += 1
                        print(f"  ≠ {cena['id']}/{passo['id']}: {conf['diferencas']} · 2ª opinião: {anterior.get('diferencas2')}")
                continue
            res = sintetizar(voz["motor"], voz["cfg"], [f["falado"] for f in falas])
            for f, r in zip(falas, res):
                f["wav"] = r["wav"]
            medida = montar(falas, wav, pausa_inicial=0.0, pausa_final=0.0)
            registro = {"assinatura": assinatura, "duracao": medida["duracao"],
                        "lufs": medida["lufs"], "pico_dbtp": medida["pico_dbtp"],
                        "frases": [{"texto": f["original"], **t}
                                   for f, t in zip(falas, medida["frases"])],
                        "falado": falado, "palavras": []}
            if stt:
                ouvido = transcrever(wav)
                conf = comparar(fala, ouvido["texto"])
                registro.update(palavras=ouvido["palavras"], stt=ouvido["texto"],
                                wer=conf["wer"], diferencas=conf["diferencas"])
                if conf["wer"] > WER_MAXIMO and not segunda_opiniao(fala, wav, registro):
                    divergencias += 1
                    print(f"  ≠ {cena['id']}/{passo['id']}: {conf['diferencas']} · 2ª opinião: {registro.get('diferencas2')}")
            tcena[passo["id"]] = registro
            print(f"{cena['id']}/{passo['id']}: {registro['duracao']:.2f} s")
            arq_tempos.write_text(json.dumps(tempos, ensure_ascii=False, indent=1),
                                  encoding="utf-8")
    arq_tempos.write_text(json.dumps(tempos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"narração pronta · divergências no STT: {divergencias}")
    return divergencias


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("alvo")
    ap.add_argument("--cena", action="append")
    ap.add_argument("--modulo", action="append", help="só as cenas deste módulo")
    ap.add_argument("--voz", default=str(VOZ_PADRAO))
    ap.add_argument("--sem-stt", action="store_true")
    a = ap.parse_args()
    caminho = Path(a.alvo)
    if caminho.is_dir():
        caminho = caminho / "cenas.json"
    cenas = a.cena
    if a.modulo and not cenas:
        todas = json.loads(caminho.read_text(encoding="utf-8"))["cenas"]
        cenas = [c["id"] for c in todas if str(c.get("modulo", 1)) in a.modulo]
    narrar(caminho, carregar_voz(Path(a.voz)), cenas, not a.sem_stt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
