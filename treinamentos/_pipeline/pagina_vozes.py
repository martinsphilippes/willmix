#!/usr/bin/env python3
"""Reescreve o miolo da página de escuta (`_config/amostras-voz/ouvir.html`) com a
rodada de vozes pedida, a partir das fichas medidas (JSON de cada amostra)."""
import html
import json
import re
import sys
from pathlib import Path

from rodadas import RODADAS

AM = Path(__file__).resolve().parent.parent / "_config" / "amostras-voz"
RODADA = int(sys.argv[1]) if len(sys.argv) > 1 else max(RODADAS)


def num(v, casas=2):
    return f"{v:.{casas}f}".replace(".", ",")


def conferencia(f):
    if not f["stt_diferencas"]:
        return "igual ao roteiro"
    return "; ".join(f"“{d['esperado'] or '∅'}” ouvido como “{d['ouvido'] or '∅'}”" for d in f["stt_diferencas"])


cartoes, arquivos = [], {}
for letra, ident, nome, nota in RODADAS[RODADA]["vozes"]:
    arq = AM / f"{ident}.json"
    if not arq.exists():
        continue
    f = json.loads(arq.read_text(encoding="utf-8"))
    v = f["velocidade_x_tempo_real"]
    classe, extra = ("ok", "") if v <= 2 else ("fora", " (limite: 2×)")
    chave = f"audio/r{RODADA}-{letra.lower()}.mp3"
    arquivos[chave] = str(AM / f"{ident}.mp3")
    cartoes.append(f"""
    <article class="voz">
      <div class="cab"><span class="letra">{html.escape(letra)}</span><div><p class="nome">{html.escape(nome)}</p><p class="nota">{html.escape(nota)}</p></div></div>
      <audio id="voz-{RODADA}-{letra.lower()}" controls preload="metadata" src="{chave}"></audio>
      <div class="tocar"><button type="button" id="tocar-{RODADA}-{letra.lower()}">Tocar</button><span></span></div>
      <dl><dt>Licença</dt><dd>{html.escape(f['licenca'])}</dd>
        <dt>Velocidade</dt><dd class="{classe}">{num(v)}× o tempo do áudio{extra}</dd>
        <dt>Ritmo</dt><dd>{round(f['palavras_por_minuto'])} palavras por minuto</dd>
        <dt>Conferência</dt><dd>{html.escape(conferencia(f))}</dd></dl>
    </article>""")

video = f"video/amostras-rodada-{RODADA}.mp4"
arquivos[video] = str(AM / f"amostras-de-voz-rodada-{RODADA}.mp4")
miolo = f"""<main>
  <header style="display:flex;flex-direction:column;gap:8px">
    <h1>Vozes do treinamento</h1>
    <p class="sub">Rodada {RODADA}. {html.escape(RODADAS[RODADA]['situacao'])} O mesmo texto em cada voz, sintetizado na máquina da sessão, sem serviço externo.</p>
  </header>

  <section class="texto" aria-label="Texto de teste">
    <p>Olá! Bem-vindo ao treinamento da Wellmix. Pronto para começar?</p>
    <p>Hoje vamos conferir um pedido de R$ 12.480,50, com entrega prevista para 23/11/2026.</p>
    <p>Olha aqui no canto direito: é o botão "Novo pedido". Clica nele. Antes de salvar, confira o CNPJ do fornecedor e o número da NF-e.</p>
  </section>

  <h2>Todas em sequência</h2>
  <p class="sub">Um vídeo com as {len(cartoes)} vozes, uma depois da outra. O número de cada uma aparece na tela.</p>
  <video id="todas" controls preload="metadata" src="{video}"></video>

  <h2>Uma por uma</h2>
  <div class="lista">{''.join(cartoes)}
  </div>
</main>"""
pagina = AM / "ouvir.html"
texto = pagina.read_text(encoding="utf-8")
novo = re.sub(r"<main>.*?</main>", lambda _: miolo, texto, count=1, flags=re.S)
pagina.write_text(novo, encoding="utf-8")
(AM / "_build").mkdir(exist_ok=True)
(AM / "_build" / "arquivos-da-pagina.json").write_text(json.dumps(arquivos, indent=1), encoding="utf-8")
print(len(cartoes), "vozes na página ·", json.dumps(arquivos, indent=1))
