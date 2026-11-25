#!/usr/bin/env python3
"""Empacota um papel: gera `index.html` + `assets/` (player com capítulos e legendas,
pausas "Sua vez", simulação clicável e quiz) e `guia-rapido.html`, tudo a partir do
`cenas.json`, do `quiz.json` e do que a gravação registrou. Sem backend e sem nada
externo: abre direto do disco.

Uso: .venv-stt/bin/python empacotar.py <pasta-do-papel> [--artefato]
"""
from __future__ import annotations

import html
import json
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
TREINO = AQUI.parent
MODELO = AQUI / "pacote"
ACOES_SIM = {"clicar", "digitar", "anexar", "marcar", "escolher", "passar", "data"}  # "passar": botão que sai do portal (baixar PDF)
USADOS: set[str] = set()  # telas paradas que este pacote usa (as outras são sobras e saem)


def ler(arq: Path, padrao=None):
    return json.loads(arq.read_text(encoding="utf-8")) if arq.exists() else padrao


def vtt_para_lista(arq: Path) -> list[list]:
    def seg(h: str) -> float:
        hh, mm, ss = h.split(":")
        return int(hh) * 3600 + int(mm) * 60 + float(ss)
    saida = []
    for bloco in re.split(r"\n\s*\n", arq.read_text(encoding="utf-8")):
        m = re.search(r"(\d+:\d+:[\d.]+) --> (\d+:\d+:[\d.]+)\n(.+)", bloco, re.S)
        if m:
            saida.append([round(seg(m.group(1)), 3), round(seg(m.group(2)), 3), m.group(3).strip()])
    return saida


def quadro_jpg(pasta: Path, cena: str, passo: str) -> str:
    """Tela parada do ensaio (PNG) → JPEG leve em assets/quadros; devolve o caminho relativo."""
    origem = pasta / "_build" / "quadros" / cena / f"{passo}.png"
    destino = pasta / "assets" / "quadros" / f"{cena}-{passo.strip('_')}.jpg"
    destino.parent.mkdir(parents=True, exist_ok=True)
    if not destino.exists() or destino.stat().st_mtime < origem.stat().st_mtime:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(origem), "-q:v", "3", str(destino)], check=True)
    USADOS.add(destino.name)
    return f"assets/quadros/{destino.name}"


def empacotar(pasta: Path) -> None:
    d = ler(pasta / "cenas.json")
    quiz_todos = ler(pasta / "quiz.json")
    quiz_lista = quiz_todos if isinstance(quiz_todos, list) else [quiz_todos]
    por_id = {c["id"]: c for c in d["cenas"]}
    modulos, guia = [], []
    onde: dict = {}        # (cena, passo) → (módulo, instante): para o quiz final
    todos_quadros: dict = {}
    for mod in d.get("modulos", [{"id": 1, "titulo": d["titulo"]}]):
        n = mod["id"]
        mapa = ler(pasta / "_build" / f"modulo-{n}.json")
        if not mapa:
            continue
        inicio = {c["cena"]: c for c in mapa["cenas"]}
        linhas = {}  # (cena, passo) → instante no vídeo do módulo
        quadros = {}
        for c in mapa["cenas"]:
            reg = ler(pasta / "_build" / "video" / f"{c['cena']}.json")
            for p in (reg or {}).get("passos", []):
                linhas[(c["cena"], p["passo"])] = round(c["inicio"] + p["inicio"], 2)
            for q in ler(pasta / "_build" / "quadros" / c["cena"] / "quadros.json", []):
                quadros[(c["cena"], q["passo"])] = q
        onde.update({k: (n, t) for k, t in linhas.items()})
        onde.update({(c["cena"], None): (n, round(c["inicio"], 2)) for c in mapa["cenas"]})
        todos_quadros.update(quadros)
        capitulos = []
        for c in mapa["cenas"]:
            if c.get("capitulo") and (not capitulos or capitulos[-1]["titulo"] != c["capitulo"]):
                capitulos.append({"titulo": c["capitulo"], "inicio": round(c["inicio"], 2)})

        simulacoes, pausas = [], []
        ultima_tela = None
        for c in mapa["cenas"]:
            cena = por_id[c["cena"]]
            if cena.get("tipo", "tela") == "tela":
                ultima_tela = cena
                passos = []
                for p in cena["passos"]:
                    q = quadros.get((cena["id"], p["id"]))
                    if (p.get("acao") in ACOES_SIM and p.get("sim") is not False and cena.get("sim") is not False
                            and q and q.get("caixa")):
                        cx = q["caixa"]
                        senha = "senha" in json.dumps(p.get("alvo", ""), ensure_ascii=False).lower()
                        passos.append({
                            "img": quadro_jpg(pasta, cena["id"], p["id"]),
                            "caixa": {k: round(cx[k], 1) for k in "xywh"},
                            "tipo": "digitar" if p["acao"] == "digitar" and not senha else "clique",
                            "valor": p.get("valor") if p["acao"] == "digitar" else None,
                            "instrucao": p.get("resumo") or p.get("fala", ""),
                            "dica": p.get("dica") or (f"procure “{p['rotulo']}” na tela." if p.get("rotulo")
                                                      else "releia a instrução e olhe a tela com calma."),
                        })
                if passos:
                    simulacoes.append({"id": cena["id"], "titulo": cena.get("tarefa") or cena["capitulo"],
                                       "passos": passos, "fim": quadro_jpg(pasta, cena["id"], "_fim")})
                # Guia rápido: os passos resumidos e os erros mais comuns de cada tarefa.
                resumo = [p["resumo"] for p in cena["passos"] if p.get("resumo") and p.get("sim") is not False]
                if resumo:
                    guia.append({"modulo": n, "tarefa": cena.get("tarefa") or cena["capitulo"],
                                 "passos": resumo, "cuidados": cena.get("cuidados", []),
                                 "rever": round(c["inicio"], 1)})
            elif cena.get("sua_vez"):
                sim = ultima_tela["id"] if ultima_tela and any(s["id"] == ultima_tela["id"] for s in simulacoes) else None
                pausas.append({"t": round(c["inicio"] + c["duracao"] - 0.35, 2), "titulo": cena["cartao"]["titulo"],
                               "itens": cena["cartao"].get("itens", []), "sim": sim})

        perguntas = []
        quiz = next((q for q in quiz_lista if q and q.get("modulo") == n), None) or {"corte": 0.8, "perguntas": []}
        for q in quiz["perguntas"]:
            item = {k: q[k] for k in ("id", "tipo", "enunciado", "feedback", "tema") if k in q}
            r = q.get("rever")
            item["rever"] = linhas.get((r["cena"], r["passo"])) if r else None
            if r and item["rever"] is None:
                item["rever"] = round(inicio[r["cena"]]["inicio"], 2) if r["cena"] in inicio else None
            if q["tipo"] == "cenario":
                item.update(alternativas=q["alternativas"], correta=q["correta"])
            elif q["tipo"] == "clique":
                im = q["imagem"]
                item["img"] = quadro_jpg(pasta, im["cena"], im["passo"])
                cx = q.get("caixa") or quadros[(im["cena"], im["passo"])]["caixa"]
                item["caixa"] = {k: round(cx[k], 1) for k in "xywh"}
            elif q["tipo"] == "ordenar":
                ordem = list(range(len(q["itens"])))
                rnd = random.Random(q["id"])  # embaralhado sempre igual (e nunca já na ordem certa)
                while ordem == sorted(ordem):
                    rnd.shuffle(ordem)
                item.update(itens=q["itens"], embaralhado=ordem)
            perguntas.append(item)

        modulos.append({"id": n, "titulo": mod["titulo"], "video": f"modulo-{n}.mp4",
                        "duracao": mapa["duracao"], "capitulos": capitulos,
                        "legendas": vtt_para_lista(pasta / f"modulo-{n}.pt-BR.vtt"),
                        "pausas": pausas, "simulacoes": simulacoes,
                        "quiz": {"corte": quiz.get("corte", 0.8), "perguntas": perguntas}})

    # Quiz final do papel (quando há mais de um módulo): perguntas que juntam os módulos.
    final = ler(pasta / "quiz-final.json")
    if final and len(modulos) > 1:
        perguntas = []
        for q in final["perguntas"]:
            item = {k: q[k] for k in ("id", "tipo", "enunciado", "feedback", "tema") if k in q}
            r = q.get("rever")
            alvo = onde.get((r["cena"], r["passo"])) or onde.get((r["cena"], None)) if r else None
            item["rever"] = {"modulo": alvo[0], "t": alvo[1]} if alvo else None
            if q["tipo"] == "cenario":
                item.update(alternativas=q["alternativas"], correta=q["correta"])
            elif q["tipo"] == "clique":
                im = q["imagem"]
                item["img"] = quadro_jpg(pasta, im["cena"], im["passo"])
                cx = q.get("caixa") or todos_quadros[(im["cena"], im["passo"])]["caixa"]
                item["caixa"] = {k: round(cx[k], 1) for k in "xywh"}
            elif q["tipo"] == "ordenar":
                ordem = list(range(len(q["itens"])))
                rnd = random.Random("final-" + q["id"])
                while ordem == sorted(ordem):
                    rnd.shuffle(ordem)
                item.update(itens=q["itens"], embaralhado=ordem)
            perguntas.append(item)
        modulos.append({"id": "final", "final": True, "titulo": "Quiz final", "video": None, "duracao": 0, "capitulos": [],
                        "legendas": [], "pausas": [], "simulacoes": [], "quiz": {"corte": final.get("corte", 0.8), "perguntas": perguntas}})

    # Nome do papel como se escreve (`nome` em modulos/papel.json: "Agência de arte"); sem ele,
    # a chave do papel com maiúscula ("Fornecedor").
    papel = d.get("nome") or d["papel"].capitalize()
    dados = {"papel": papel, "titulo": f"Treinamento · {papel}", "modulos": modulos}
    assets = pasta / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "dados.js").write_text("window.TREINO = " + json.dumps(dados, ensure_ascii=False) + ";\n", encoding="utf-8")
    for nome in ("player.css", "player.js"):
        shutil.copy(MODELO / nome, assets / nome)
    shutil.copy(TREINO / "_config" / "marca" / "Geist-latin.woff2", assets / "Geist-latin.woff2")
    shutil.copy(TREINO / "_config" / "marca" / "wellmix-logo.svg", assets / "logo.svg")
    (pasta / "index.html").write_text(
        (MODELO / "index.html").read_text(encoding="utf-8").replace("__TITULO__", html.escape(dados["titulo"])),
        encoding="utf-8")
    (pasta / "guia-rapido.html").write_text(guia_html(papel, guia), encoding="utf-8")
    for sobra in (assets / "quadros").glob("*.jpg"):
        if sobra.name not in USADOS:
            sobra.unlink()
    print(f"{pasta.name}: {len(modulos)} módulo(s) · "
          + " · ".join(f"quiz final: {len(m['quiz']['perguntas'])} perguntas" if m.get("final") else
                       f"M{m['id']}: {len(m['capitulos'])} capítulos, {len(m['pausas'])} pausas, "
                       f"{len(m['simulacoes'])} práticas, {len(m['quiz']['perguntas'])} perguntas" for m in modulos))


def pagina_artefato(pasta: Path) -> None:
    """Versão do pacote para publicar como página privada (Artifact): a mesma página, sem
    o cabeçalho de documento (a publicação põe o dela), e o vídeo em 720p, porque lá cada
    arquivo binário tem limite de 15 MB. O pacote de verdade continua sendo a pasta do papel."""
    destino = pasta / "_build" / "artefato"
    destino.mkdir(parents=True, exist_ok=True)
    pagina = (pasta / "index.html").read_text(encoding="utf-8")
    titulo = re.search(r"<title>(.*?)</title>", pagina, re.S).group(1)
    corpo = re.search(r"<body>(.*)</body>", pagina, re.S).group(1).strip()
    # O nome da página é o título do papel ("Treinamento da Agência de arte"), quando há.
    nome_pagina = html.escape((ler(pasta / "cenas.json") or {}).get("titulo") or "") or titulo.replace(" · ", " do ")
    (destino / "index.html").write_text(
        f"<title>{nome_pagina}</title>\n"
        '<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<link rel="stylesheet" href="assets/player.css">\n' + corpo + "\n", encoding="utf-8")
    for video in sorted(pasta.glob("modulo-*.mp4")):
        leve = destino / video.name
        if not leve.exists() or leve.stat().st_mtime < video.stat().st_mtime:
            for crf in (25, 27, 29, 31):  # sobe a compressão até caber no limite de 15 MB por arquivo
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", "scale=1280:720:flags=lanczos",
                                "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-r", "30",
                                "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", str(leve)], check=True)
                if leve.stat().st_size < 14.5e6:
                    break
        print(f"artefato: {leve.name} · {leve.stat().st_size / 1e6:.1f} MB")


def guia_html(papel: str, guia: list[dict]) -> str:
    e = html.escape
    blocos = []
    for g in guia:
        passos = "".join(f"<li>{e(p)}</li>" for p in g["passos"])
        cuidados = "".join(f"<li><strong>{e(c['erro'])}</strong> {e(c['solucao'])}</li>" for c in g["cuidados"])
        blocos.append(f"""<section><p class="mod">Módulo {g['modulo']}</p><h2>{e(g['tarefa'])}</h2><ol>{passos}</ol>"""
                      + (f"""<h3>Se der errado</h3><ul class="cuidado">{cuidados}</ul>""" if cuidados else "") + "</section>")
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guia rápido · {e(papel)}</title>
<style>
@font-face {{ font-family: "Geist"; font-weight: 100 900; src: url("assets/Geist-latin.woff2") format("woff2"); }}
body {{ font: 15px/1.5 "Geist", system-ui, sans-serif; color: #17181c; margin: 0; padding: 24px; background: #fff; }}
header {{ display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #bf2026; padding-bottom: 12px; margin-bottom: 18px; }}
header img {{ height: 34px; }} h1 {{ font-size: 22px; margin: 0; }} header a {{ margin-left: auto; color: #bf2026; font-weight: 600; }}
main {{ columns: 2 340px; column-gap: 28px; max-width: 1100px; }}
section {{ break-inside: avoid; border: 1px solid #e2e3e7; border-radius: 10px; padding: 14px 16px; margin: 0 0 16px; }}
.mod {{ margin: 0; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #bf2026; font-weight: 600; }}
h2 {{ font-size: 17px; margin: 2px 0 8px; }} h3 {{ font-size: 13px; margin: 10px 0 4px; color: #b45309; }}
ol, ul {{ margin: 0; padding-left: 20px; }} li {{ margin: 3px 0; }} .cuidado {{ list-style: none; padding-left: 0; }}
footer {{ color: #5c6069; font-size: 12px; margin-top: 10px; }}
@media print {{ body {{ padding: 0; }} header a {{ display: none; }} section {{ border-color: #999; }} }}
</style></head><body>
<header><img src="assets/logo.svg" alt="Wellmix"><h1>Guia rápido · {e(papel)}</h1><a href="index.html">Voltar ao treinamento</a></header>
<main>{''.join(blocos)}</main>
<footer>Os nomes entre aspas são os que aparecem na tela do portal. Gerado do roteiro do treinamento.</footer>
</body></html>
"""


if __name__ == "__main__":
    alvo = Path(next(a for a in sys.argv[1:] if not a.startswith("--"))).resolve()
    empacotar(alvo)
    if "--artefato" in sys.argv:
        pagina_artefato(alvo)
