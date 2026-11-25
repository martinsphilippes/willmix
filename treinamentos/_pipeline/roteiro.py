#!/usr/bin/env python3
"""Gera o `roteiro.md` de um papel a partir do `cenas.json` (fonte única): um título por
módulo, os capítulos dentro dele e, no fim de cada módulo, as perguntas do quiz."""
import json
import sys
from pathlib import Path

caminho = Path(sys.argv[1]).resolve()
if caminho.is_dir():
    caminho = caminho / "cenas.json"
d = json.loads(caminho.read_text(encoding="utf-8"))
quiz = json.loads((caminho.parent / "quiz.json").read_text(encoding="utf-8")) if (caminho.parent / "quiz.json").exists() else []
quiz = quiz if isinstance(quiz, list) else [quiz]
ACOES = {"clicar": "clica", "digitar": "digita", "anexar": "anexa o arquivo", "marcar": "marca",
         "escolher": "escolhe", "mostrar": "mostra", "passar": "aponta", "data": "preenche a data", None: "fala"}
TIPOS = {"cenario": "cenário", "clique": "clique no lugar certo", "ordenar": "ordene os passos"}
modulos = d.get("modulos", [{"id": 1, "titulo": d["titulo"]}])
linhas = [f"# Roteiro · {d['titulo']}", "",
          f"Conta usada na gravação: `{d['conta']['email']}` (conta de demonstração, dados fictícios).", ""]
for mod in modulos:
    linhas += [f"# Módulo {mod['id']} · {mod['titulo']}", ""]
    capitulo = None
    for cena in [c for c in d["cenas"] if c.get("modulo", 1) == mod["id"]]:
        if cena.get("capitulo") != capitulo:
            capitulo = cena.get("capitulo")
            linhas += [f"## {capitulo}", ""]
        if cena.get("tipo") == "cartao":
            c = cena["cartao"]
            linhas += [f"**Cartão ({c['tipo']}):** {c.get('titulo', '')}"
                       + (f" · {c['subtitulo']}" if c.get("subtitulo") else ""), ""]
            for item in c.get("itens", []):
                linhas.append(f"- {item}")
            if c.get("itens"):
                linhas.append("")
        elif cena.get("sim") is False and all(x.get("conta_passo") is False for x in cena.get("passos", [])):
            # Cena "Cuidado": fora da prática e sem passo contado (a cena do login também tem
            # `sim: false`, mas os passos dela contam).
            linhas += ["**Cuidado (erro comum, mostrado de verdade):**", ""]
        n = 0
        for p in cena.get("passos", []):
            acao = p.get("acao")
            if acao and acao != "mostrar":
                conta = p.get("conta_passo") is not False
                n += 1 if conta else 0
                marca = f"**Passo {n}** ({ACOES.get(acao, acao)}" if conta else f"*({ACOES.get(acao, acao)}"
                if p.get("valor") and acao == "digitar":
                    marca += f": `{p['valor']}`"
                marca += ")" if conta else ")*"
            elif acao == "mostrar":
                marca = "*(mostra na tela)*"
            else:
                marca = "*(fala)*"
            linhas.append(f"- {marca} {p.get('fala', '')}")
        linhas.append("")
    q = next((x for x in quiz if x.get("modulo") == mod["id"]), None)
    if q and q.get("perguntas"):
        linhas += [f"## Quiz do módulo {mod['id']} ({len(q['perguntas'])} perguntas, nota mínima {round(q.get('corte', 0.8) * 100)}%)", ""]
        for i, p in enumerate(q["perguntas"], 1):
            linhas.append(f"{i}. *({TIPOS.get(p['tipo'], p['tipo'])})* {p['enunciado']}")
            for j, alt in enumerate(p.get("alternativas", [])):
                linhas.append(f"   - {'**' if j == p['correta'] else ''}{'ABCD'[j]}) {alt}{'** (certa)' if j == p['correta'] else ''}")
            for j, item in enumerate(p.get("itens", []), 1):
                linhas.append(f"   - {j}º {item}")
            linhas.append(f"   - Retorno: {p['feedback']}")
        linhas.append("")
saida = caminho.parent / "roteiro.md"
saida.write_text("\n".join(linhas), encoding="utf-8")
print(saida)
