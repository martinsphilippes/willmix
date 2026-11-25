#!/usr/bin/env python3
"""Junta os módulos de um papel em `cenas.json` e `quiz.json`.

Cada módulo é escrito num arquivo próprio, `<papel>/modulos/mN.json` ou `mN.py` (que define MODULO):
  { "modulo": {"id": N, "titulo": "..."}, "cenas": [...], "quiz": {"corte": 0.8, "perguntas": [...]} }
O cabeçalho do papel (conta, título) fica em `<papel>/modulos/papel.json`.
O resto do pipeline lê só o `cenas.json` e o `quiz.json` gerados aqui.

Uso: python3 juntar_cenas.py <pasta-do-papel>
"""
from __future__ import annotations

import json
import random
import re
import runpy
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))  # os módulos em Python importam roteiro_util


def embaralhar(q: dict, semente: str) -> dict:
    """Embaralha as alternativas de uma pergunta de cenário (sempre igual para a mesma pergunta),
    para a resposta certa não cair sempre na mesma letra."""
    if q.get("tipo") != "cenario":
        return q
    ordem = list(range(len(q["alternativas"])))
    random.Random(semente).shuffle(ordem)
    return {**q, "alternativas": [q["alternativas"][i] for i in ordem], "correta": ordem.index(q["correta"])}


def gravar(arq: Path, dados) -> None:
    """Escreve de uma vez (arquivo temporário + troca), para ninguém ler o arquivo pela metade."""
    tmp = arq.with_suffix(arq.suffix + ".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(arq)


def juntar(pasta: Path) -> None:
    fontes = pasta / "modulos"
    papel = json.loads((fontes / "papel.json").read_text(encoding="utf-8"))
    arquivos = sorted([*fontes.glob("m*.json"), *fontes.glob("m*.py")],
                      key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", p.stem)])
    modulos, cenas, quizzes, vistos = [], [], [], set()
    for arq in arquivos:
        # Módulo em JSON ou em Python (este define MODULO; ver roteiro_util.py).
        m = json.loads(arq.read_text(encoding="utf-8")) if arq.suffix == ".json" else runpy.run_path(str(arq))["MODULO"]
        n = m["modulo"]["id"]
        modulos.append(m["modulo"])
        for c in m["cenas"]:
            if c["id"] in vistos:
                raise SystemExit(f"{arq.name}: cena repetida: {c['id']}")
            vistos.add(c["id"])
            cenas.append({**c, "modulo": n})
        if m.get("quiz"):
            quizzes.append({"modulo": n, **m["quiz"], "perguntas": [embaralhar(q, f"m{n}-{q['id']}") for q in m["quiz"]["perguntas"]]})
    gravar(pasta / "cenas.json", {**papel, "modulos": modulos, "cenas": cenas})
    gravar(pasta / "quiz.json", quizzes)
    # Quiz final do papel: `modulos/final.py` define FINAL = {"corte": 0.8, "perguntas": [...]}.
    final = fontes / "final.py"
    if final.exists():
        f = runpy.run_path(str(final))["FINAL"]
        for q in f["perguntas"]:
            for ref in (q.get("rever"), q.get("imagem")):
                if ref and ref["cena"] not in vistos:
                    raise SystemExit(f"final.py: a pergunta {q['id']} aponta para a cena inexistente {ref['cena']}")
        gravar(pasta / "quiz-final.json", {**f, "perguntas": [embaralhar(q, f"final-{q['id']}") for q in f["perguntas"]]})
        print(f"quiz final: {len(f['perguntas'])} perguntas")
    print(f"{pasta.name}: {len(modulos)} módulo(s), {len(cenas)} cenas, " + ", ".join(f"M{q['modulo']}: {len(q['perguntas'])} perguntas" for q in quizzes))


if __name__ == "__main__":
    juntar(Path(sys.argv[1]).resolve())
