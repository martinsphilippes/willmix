#!/usr/bin/env python3
"""Montagem: junta a gravação de cada cena com a narração (posta no instante real
de cada passo), aplica o zoom e as sobreposições de marca e gera o MP4 do módulo
(H.264 + AAC, 1080p, 30 qps, yuv420p, faststart) e as legendas .vtt (não queimadas).

Uso: .venv-stt/bin/python montar.py <pasta-do-papel|cenas.json> [--cena ID ...] [--so-cenas]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
QPS = 30
L, A = 1920, 1080
ZOOM_ENTRA = 0.7   # s para aproximar
ZOOM_SAI = 0.6     # s para voltar
CENTRALIZA = 0.7   # quanto o alvo caminha para o centro da tela no zoom (0–1)


CODEC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high",
         "-pix_fmt", "yuv420p", "-r", str(QPS), "-g", str(QPS * 2),
         "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def duracao(arq: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(arq)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


# ------------------------------------------------------------------ zoom ----

def _suave(u: str) -> str:
    return f"(({u})*({u})*(3-2*({u})))"


def _progresso(j: dict) -> str:
    a, b, c, d = j["a"], j["b"], j["c"], j["d"]
    return (f"if(lt(t,{a}),0,if(lt(t,{b}),{_suave(f'(t-{a})/{b - a:.3f}')},"
            f"if(lt(t,{c}),1,if(lt(t,{d}),1-{_suave(f'(t-{c})/{d - c:.3f}')},0))))")


def filtro_zoom(janelas: list[dict]) -> str:
    """scale por quadro + crop: aproxima no alvo e volta, sempre a partir da captura grande."""
    if not janelas:
        return f"scale={L}:{A}:flags=lanczos"
    z = "1" + "".join(f"+({j['z'] - 1:.3f})*({_progresso(j)})" for j in janelas)
    x = "+".join(
        f"between(t,{j['a']},{j['d']})*(({j['cx']:.1f})*({z})-(({j['cx']:.1f})+({L / 2 - j['cx']:.1f})*{CENTRALIZA}*({_progresso(j)})))"
        for j in janelas)
    y = "+".join(
        f"between(t,{j['a']},{j['d']})*(({j['cy']:.1f})*({z})-(({j['cy']:.1f})+({A / 2 - j['cy']:.1f})*{CENTRALIZA}*({_progresso(j)})))"
        for j in janelas)
    return (f"scale=w='trunc({L}*({z})/2)*2':h='trunc({A}*({z})/2)*2':eval=frame:flags=lanczos,"
            # O crop mede a entrada uma vez só: o limite usa o tamanho calculado do quadro.
            f"crop={L}:{A}:x='max(0,min({L}*({z})-{L},{x}))':y='max(0,min({A}*({z})-{A},{y}))'")


def janelas_de_zoom(cena: dict, linha: list[dict]) -> list[dict]:
    por_id = {p["id"]: p for p in cena["passos"]}
    janelas = []
    for reg in linha:
        passo = por_id[reg["passo"]]
        z = passo.get("zoom")
        caixa = reg.get("caixa")
        if not z or not caixa:
            continue
        dest = next((e["t"] for e in reg["eventos"] if e["tipo"] == "destaque"), reg["inicio"])
        a = max(reg["inicio"], dest - 0.15)
        d = reg["fim"] - 0.05
        if d - a < ZOOM_ENTRA + ZOOM_SAI + 0.4:
            continue
        janelas.append({"a": round(a, 3), "b": round(a + ZOOM_ENTRA, 3),
                        "c": round(d - ZOOM_SAI, 3), "d": round(d, 3), "z": float(z),
                        "cx": caixa["x"] + caixa["w"] / 2, "cy": caixa["y"] + caixa["h"] / 2})
    return janelas


# ------------------------------------------------------------- legendas ----

def _quebrar(texto: str, largura: int = 42) -> list[str]:
    """Blocos de até 2 linhas de ~42 caracteres, equilibrados (sem sobrar um resto curto)."""
    linhas = textwrap.wrap(texto, largura)
    if len(linhas) <= 2:
        return ["\n".join(linhas)]
    n = -(-len(linhas) // 2)  # número de blocos
    alvo = -(-len(texto) // n)
    blocos, atual = [], ""
    for palavra in texto.split():
        if atual and len(atual) + 1 + len(palavra) > alvo + 6 and len(blocos) < n - 1:
            blocos.append(atual)
            atual = palavra
        else:
            atual = (atual + " " + palavra).strip()
    blocos.append(atual)
    return ["\n".join(textwrap.wrap(b, max(largura, -(-len(b) // 2) + 2))[:2]) for b in blocos]


def _hora(t: float) -> str:
    h, r = divmod(max(0.0, t), 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def legendas_da_cena(linha: list[dict], tempos: dict, desloc: float) -> list[tuple[float, float, str]]:
    falas = []
    for reg in linha:
        tp = tempos.get(reg["passo"], {})
        for fr in tp.get("frases", []):
            ini, fim = desloc + reg["inicio"] + fr["inicio"], desloc + reg["inicio"] + fr["fim"]
            blocos = _quebrar(fr["texto"])
            total = sum(len(b) for b in blocos) or 1
            t = ini
            for b in blocos:  # divide o tempo da frase pelo tamanho de cada bloco
                dur = (fim - ini) * len(b) / total
                falas.append((t, t + dur, b))
                t += dur
    return falas


def escrever_vtt(falas: list[tuple[float, float, str]], destino: Path) -> None:
    partes = ["WEBVTT", ""]
    for i, (a, b, texto) in enumerate(falas, 1):
        fim = max(b, a + 0.8)
        if i < len(falas):  # nunca passa do começo da próxima
            fim = min(fim, max(falas[i][0] - 0.02, a + 0.3))
        partes += [str(i), f"{_hora(a)} --> {_hora(fim)}", texto, ""]
    destino.write_text("\n".join(partes), encoding="utf-8")


# ----------------------------------------------------------------- cena ----

def montar_cena(pasta: Path, cena: dict, tempos: dict, render: bool = True) -> dict:
    build = pasta / "_build"
    reg = json.loads((build / "video" / f"{cena['id']}.json").read_text(encoding="utf-8"))
    bruto = build / "video" / reg["bruto"]
    linha, dur = reg["passos"], reg["duracao"]
    saida = build / "cenas" / f"{cena['id']}.mp4"
    saida.parent.mkdir(parents=True, exist_ok=True)
    if not render and saida.exists():
        return {"cena": cena["id"], "arquivo": saida, "duracao": duracao(saida), "linha": linha}

    # Indicador "Passo N de M" (sobreposição desenhada com a identidade da marca).
    por_id = {p["id"]: p for p in cena["passos"]}
    pedidos, pilulas = [], []
    for r in linha:
        if r.get("numero"):
            png = build / "sobreposicoes" / cena["id"] / f"passo-{r['passo']}.png"
            pedidos.append({"tipo": "passo", "numero": r["numero"], "total": r["total"],
                            "texto": por_id[r["passo"]].get("resumo"), "saida": str(png)})
            pilulas.append((png, r["inicio"] + 0.15, r["fim"] - 0.1))
    if pedidos:
        arq = build / "sobreposicoes" / f"{cena['id']}.json"
        arq.parent.mkdir(parents=True, exist_ok=True)
        arq.write_text(json.dumps(pedidos, ensure_ascii=False), encoding="utf-8")
        subprocess.run(["node", str(AQUI / "cartoes.mjs"), str(arq)], check=True)

    entradas = ["-ss", f"{reg['zero']:.3f}", "-t", f"{dur:.3f}", "-i", str(bruto)]
    posicoes = []
    for png, _, _ in pilulas:
        # A pílula é desenhada num quadro inteiro transparente. Sobrepor o quadro inteiro, a cada
        # quadro do vídeo, custa caro: recorta só a parte desenhada e guarda onde ela fica.
        with Image.open(png) as im:
            x0, y0, x1, y1 = im.getbbox() or (0, 0, im.width, im.height)
            x0, y0 = x0 - x0 % 2, y0 - y0 % 2
            rec = png.with_suffix(".rec.png")
            im.crop((x0, y0, x1, y1)).save(rec)
        posicoes.append((x0, y0))
        # Imagem parada vira um fluxo com a duração da cena (o fade precisa de quadros).
        entradas += ["-loop", "1", "-framerate", str(QPS), "-t", f"{dur:.3f}", "-i", str(rec)]
    falas = [(r, build / "audio" / cena["id"] / f"{r['passo']}.wav") for r in linha
             if r.get("duracao_fala")]
    for _, wav in falas:
        entradas += ["-i", str(wav)]

    grafo = [f"[0:v]setpts=PTS-STARTPTS,fps={QPS},{filtro_zoom(janelas_de_zoom(cena, linha))},format=yuv420p[v0]"]
    atual = "v0"
    for i, (_, a, b) in enumerate(pilulas, 1):
        # A pílula entra e sai com um fade curto.
        grafo.append(f"[{i}:v]format=rgba,fade=t=in:st={a:.3f}:d=0.2:alpha=1,"
                     f"fade=t=out:st={b - 0.2:.3f}:d=0.2:alpha=1[p{i}]")
        x, y = posicoes[i - 1]
        grafo.append(f"[{atual}][p{i}]overlay={x}:{y}:enable='between(t,{a:.3f},{b:.3f})'[v{i}]")
        atual = f"v{i}"
    base = 1 + len(pilulas)
    rotulos = []
    for k, (r, _) in enumerate(falas):
        ms = int(round(r["inicio"] * 1000))
        grafo.append(f"[{base + k}:a]adelay={ms}:all=1[a{k}]")
        rotulos.append(f"[a{k}]")
    if rotulos:
        grafo.append(f"{''.join(rotulos)}amix=inputs={len(rotulos)}:normalize=0:dropout_transition=0,"
                     f"apad=whole_dur={dur:.3f},atrim=0:{dur:.3f}[aout]")
    else:
        grafo.append(f"anullsrc=r=48000:cl=mono,atrim=0:{dur:.3f}[aout]")
    script = build / "cenas" / f"{cena['id']}.filtro.txt"
    script.write_text(";\n".join(grafo), encoding="utf-8")
    ff(*entradas, "-filter_complex_script", str(script), "-map", f"[{atual}]", "-map", "[aout]",
       *CODEC, "-t", f"{dur:.3f}", "-movflags", "+faststart", str(saida))
    return {"cena": cena["id"], "arquivo": saida, "duracao": duracao(saida), "linha": linha}


def montar_cartao(pasta: Path, cena: dict, tempos: dict, render: bool = True) -> dict:
    """Cartão de marca (abertura, capítulo, Sua vez, encerramento) com a fala por cima."""
    build = pasta / "_build"
    png = build / "sobreposicoes" / cena["id"] / "cartao.png"
    pedido = build / "sobreposicoes" / f"{cena['id']}.json"
    pedido.parent.mkdir(parents=True, exist_ok=True)
    pronto = build / "cenas" / f"{cena['id']}.mp4"
    render = render or not pronto.exists()
    if render:
        pedido.write_text(json.dumps([{**cena["cartao"], "saida": str(png)}], ensure_ascii=False),
                          encoding="utf-8")
        subprocess.run(["node", str(AQUI / "cartoes.mjs"), str(pedido)], check=True)
    linha, t = [], float(cena.get("espera_inicial", 0.45))
    for passo in cena.get("passos", []):
        d = tempos.get(passo["id"], {}).get("duracao", 0)
        if not d:
            continue
        linha.append({"passo": passo["id"], "inicio": t, "fim": t + d, "duracao_fala": d,
                      "fala": passo.get("fala"), "eventos": []})
        t += d + 0.35
    dur = max(float(cena.get("duracao_min", 2.6)), t + float(cena.get("espera_final", 0.5)))
    saida = pronto
    saida.parent.mkdir(parents=True, exist_ok=True)
    if not render:
        return {"cena": cena["id"], "arquivo": saida, "duracao": duracao(saida), "linha": linha}
    entradas = ["-loop", "1", "-framerate", str(QPS), "-t", f"{dur:.3f}", "-i", str(png)]
    grafo = [f"[0:v]scale={L}:{A},format=yuv420p,fade=t=in:st=0:d=0.25,"
             f"fade=t=out:st={dur - 0.25:.3f}:d=0.25[v]"]
    rot = []
    for k, r in enumerate(linha, 1):
        entradas += ["-i", str(build / "audio" / cena["id"] / f"{r['passo']}.wav")]
        grafo.append(f"[{k}:a]adelay={int(r['inicio'] * 1000)}:all=1[a{k}]")
        rot.append(f"[a{k}]")
    if rot:
        grafo.append(f"{''.join(rot)}amix=inputs={len(rot)}:normalize=0:dropout_transition=0,"
                     f"apad=whole_dur={dur:.3f},atrim=0:{dur:.3f}[aout]")
    else:
        grafo.append(f"anullsrc=r=48000:cl=mono,atrim=0:{dur:.3f}[aout]")
    script = build / "cenas" / f"{cena['id']}.filtro.txt"
    script.write_text(";\n".join(grafo), encoding="utf-8")
    ff(*entradas, "-filter_complex_script", str(script), "-map", "[v]", "-map", "[aout]", *CODEC,
       "-t", f"{dur:.3f}", "-movflags", "+faststart", str(saida))
    return {"cena": cena["id"], "arquivo": saida, "duracao": duracao(saida), "linha": linha}


def juntar(cenas: list[dict], destino: Path) -> None:
    lista = destino.with_suffix(".lista.txt")
    lista.write_text("".join(f"file '{Path(c['arquivo']).resolve()}'\n" for c in cenas),
                     encoding="utf-8")
    ff("-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", "-movflags", "+faststart",
       str(destino))
    lista.unlink()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("alvo")
    ap.add_argument("--cena", action="append")
    ap.add_argument("--so-cenas", action="store_true", help="não junta os módulos")
    ap.add_argument("--modulo", action="append", help="só este módulo (os outros nem são tocados)")
    a = ap.parse_args()
    caminho = Path(a.alvo).resolve()
    if caminho.is_dir():
        caminho = caminho / "cenas.json"
    pasta = caminho.parent
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    tempos = json.loads((pasta / "_build" / "audio" / "tempos.json").read_text(encoding="utf-8"))
    prontas: dict[str, list[dict]] = {}
    if a.modulo:
        dados["cenas"] = [c for c in dados["cenas"] if str(c.get("modulo", 1)) in a.modulo]
    for cena in dados["cenas"]:
        # Com --cena, só essas são refeitas; as outras entram como já estavam montadas.
        refazer = not a.cena or cena["id"] in a.cena
        if cena.get("tipo", "tela") == "tela":
            r = montar_cena(pasta, cena, tempos.get(cena["id"], {}), render=refazer)
        else:
            r = montar_cartao(pasta, cena, tempos.get(cena["id"], {}), render=refazer)
        r["titulo"] = cena.get("capitulo")
        print(f"cena {'montada' if refazer else 'reaproveitada'} · {cena['id']} · {r['duracao']:.1f} s")
        prontas.setdefault(str(cena.get("modulo", 1)), []).append(r)
    if a.so_cenas:
        return 0
    for modulo, cenas in prontas.items():
        destino = pasta / f"modulo-{modulo}.mp4"
        juntar(cenas, destino)
        falas, desloc, capitulos = [], 0.0, []
        for c in cenas:
            falas += legendas_da_cena(c["linha"], tempos.get(c["cena"], {}), desloc)
            capitulos.append({"cena": c["cena"], "inicio": round(desloc, 3),
                              "duracao": round(c["duracao"], 3), "capitulo": c.get("titulo")})
            desloc += c["duracao"]
        escrever_vtt(falas, pasta / f"modulo-{modulo}.pt-BR.vtt")
        (pasta / "_build" / f"modulo-{modulo}.json").write_text(
            json.dumps({"duracao": round(desloc, 3), "cenas": capitulos}, indent=1), encoding="utf-8")
        print(f"módulo {modulo}: {destino.name} · {desloc:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
