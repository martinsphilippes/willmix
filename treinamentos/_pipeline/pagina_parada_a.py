#!/usr/bin/env python3
"""Gera as fichas das amostras de voz (FICHAS.md) e a página de escuta da PARADA A
(um HTML só, com os áudios e o vídeo de prova embutidos: abre direto do disco)."""
from __future__ import annotations

import base64
import html
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AMOSTRAS = RAIZ / "_config" / "amostras-voz"
MARCA = json.loads((RAIZ / "_config" / "marca.json").read_text(encoding="utf-8"))

# Ordem de apresentação: A, B e C são as três recomendadas; as demais ficam como extras.
ORDEM = [
    ("A", "kokoro-dora", "Feminina. Passa nos três critérios."),
    ("B", "kokoro-alex", "Masculina. Passa nos três critérios."),
    ("C", "chatterbox-dora",
     "Feminina. Modelo mais expressivo, mas lento nesta máquina: fora do critério de velocidade."),
    ("C2", "chatterbox-embutida", "A voz que vem com o modelo. Mesma ressalva de velocidade."),
    ("D", "supertonic-f1", "Feminina. Rápida; a licença exige avisar que a voz é sintética."),
    ("E", "supertonic-m1", "Masculina. Rápida; mesma ressalva de licença."),
    ("F", "kokoro-santa", "Masculina, alternativa à B."),
]

CRITERIO_VELOCIDADE = 2.0


def carregar() -> list[dict]:
    fichas = []
    for letra, ident, nota in ORDEM:
        arq = AMOSTRAS / f"{ident}.json"
        if not arq.exists():
            continue
        f = json.loads(arq.read_text(encoding="utf-8"))
        f.update(letra=letra, nota=nota, mp3=AMOSTRAS / f"{ident}.mp3")
        fichas.append(f)
    return fichas


def veloc(f: dict) -> str:
    v = f["velocidade_x_tempo_real"]
    ok = "dentro" if v <= CRITERIO_VELOCIDADE else "FORA"
    return f"{str(v).replace('.', ',')}× o tempo do áudio ({ok} do limite de 2×)"


def stt(f: dict) -> str:
    if not f["stt_diferencas"]:
        return "igual ao roteiro"
    return "; ".join(f"esperado “{d['esperado'] or '∅'}”, ouvido “{d['ouvido'] or '∅'}”"
                     for d in f["stt_diferencas"])


def fichas_md(fichas: list[dict]) -> str:
    texto = (AMOSTRAS / "texto-de-teste.txt").read_text(encoding="utf-8").strip()
    partes = [
        "# Amostras de voz · fichas", "",
        "Todas falam o mesmo texto, sintetizado frase a frase nesta máquina (4 núcleos, sem GPU), "
        "com as pausas, o volume (−16 LUFS, pico ≤ −1,5 dBTP) e a pronúncia UÉLMIX do pipeline. "
        "Nenhuma voz é clone de pessoa real.", "",
        "Texto de teste:", "", "> " + texto.replace("\n\n", "\n>\n> "), "",
        "A conferência é automática: cada áudio foi transcrito por um reconhecedor de fala local "
        "(faster-whisper) e comparado, palavra a palavra, com o roteiro. Eu não ouço o áudio: "
        "naturalidade e sotaque são para o seu ouvido.", "",
    ]
    for f in fichas:
        partes += [
            f"## {f['letra']} · {f['rotulo']}", "",
            f"- **Arquivo:** `{f['mp3'].name}` ({str(f['duracao_s']).replace('.', ',')} s)",
            f"- **Licença:** {f['licenca']}",
            f"- **Velocidade nesta máquina:** {veloc(f)}",
            f"- **Ritmo:** {str(f['palavras_por_minuto']).replace('.', ',')} palavras faladas por minuto"
            + (f" (andamento ajustado em {int(f['ajuste_de_andamento'] * 100)}%)"
               if f.get("ajuste_de_andamento", 1) != 1 else ""),
            f"- **Volume:** {str(f['lufs']).replace('.', ',')} LUFS, pico {str(f['pico_dbtp']).replace('.', ',')} dBTP",
            f"- **Transcrição × roteiro:** {stt(f)}",
            f"- **Observação:** {f['nota']}", "",
        ]
    partes += [
        "## Descartados", "",
        "- **Qwen3-TTS 0.6B CustomVoice** (Apache-2.0): 4,5× o tempo do áudio e palavras trocadas "
        "em português (as vozes prontas não são nativas). Amostra em `qwen-serena.mp3`, só como registro.",
        "- **XTTS-v2, F5-TTS, Fish Speech/OpenAudio, MMS-TTS:** pesos com licença não comercial.",
        "- **Piper:** fica como reserva leve; não foi preciso.", "",
    ]
    return "\n".join(partes)


def b64(arq: Path) -> str:
    return base64.b64encode(arq.read_bytes()).decode()


def pagina(fichas: list[dict]) -> str:
    c = MARCA["cores"]
    logo = b64(RAIZ / "_config" / MARCA["logo"]["cor"])
    prova = RAIZ / "_pipeline" / "prova" / "modulo-1.mp4"
    vtt = RAIZ / "_pipeline" / "prova" / "modulo-1.pt-BR.vtt"
    cartoes = []
    for f in fichas:
        principal = f["letra"] in ("A", "B", "C")
        fora = f["velocidade_x_tempo_real"] > CRITERIO_VELOCIDADE
        cartoes.append(f"""
      <article class="amostra{' extra' if not principal else ''}">
        <header><span class="letra">{html.escape(f['letra'])}</span>
          <div><h3>{html.escape(f['rotulo'])}</h3><p class="nota">{html.escape(f['nota'])}</p></div></header>
        <audio controls preload="metadata" src="data:audio/mpeg;base64,{b64(f['mp3'])}"></audio>
        <dl>
          <dt>Licença</dt><dd>{html.escape(f['licenca'])}</dd>
          <dt>Velocidade aqui</dt><dd class="{'fora' if fora else 'ok'}">{html.escape(veloc(f))}</dd>
          <dt>Ritmo</dt><dd>{str(f['palavras_por_minuto']).replace('.', ',')} palavras por minuto</dd>
          <dt>Volume</dt><dd>{str(f['lufs']).replace('.', ',')} LUFS · pico {str(f['pico_dbtp']).replace('.', ',')} dBTP</dd>
          <dt>Transcrição × roteiro</dt><dd>{html.escape(stt(f))}</dd>
        </dl>
      </article>""")
    texto = html.escape((AMOSTRAS / "texto-de-teste.txt").read_text(encoding="utf-8").strip()
                        ).replace("\n\n", "</p><p>")
    video = ""
    if prova.exists():
        faixa = (f'<track kind="subtitles" srclang="pt-BR" label="Português" default '
                 f'src="data:text/vtt;base64,{b64(vtt)}">' if vtt.exists() else "")
        video = f"""
    <section>
      <h2>Prova técnica da gravação</h2>
      <p>Não é conteúdo de treinamento: é o teste do pipeline na tela de entrada do portal, em modo
      demonstração. Mostra a nitidez da captura, o cursor, o destaque numerado, o zoom, o indicador de
      passo, a narração no tempo da ação e as legendas. A voz usada aqui é a amostra A.</p>
      <video controls preload="metadata" src="data:video/mp4;base64,{b64(prova)}">{faixa}</video>
    </section>"""
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PARADA A · Vozes</title>
<style>
  :root {{ --vermelho:{c['vermelho']}; --grafite:{c['grafite']}; --fundo:#f5f5f6; --cartao:#fff; --texto:#17181c;
    --suave:#5b5f6b; --linha:#e3e4e8; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --fundo:#131418; --cartao:#1c1e24; --texto:#f1f1f3; --suave:#a5a9b5; --linha:#2c2f38; }} }}
  * {{ box-sizing:border-box }} body {{ margin:0; background:var(--fundo); color:var(--texto);
    font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }}
  main {{ max-width:880px; margin:0 auto; padding:28px 16px 60px; }}
  .topo {{ display:flex; align-items:center; gap:14px; margin-bottom:6px; }} .topo img {{ height:38px; }}
  h1 {{ font-size:26px; margin:0; }} h2 {{ font-size:20px; margin:34px 0 8px; }} h3 {{ font-size:17px; margin:0; }}
  p {{ margin:8px 0; }} .sub {{ color:var(--suave); }}
  blockquote {{ margin:12px 0; padding:12px 16px; background:var(--cartao); border-left:4px solid var(--vermelho);
    border-radius:6px; }}
  .amostra {{ background:var(--cartao); border:1px solid var(--linha); border-radius:12px; padding:16px; margin:14px 0; }}
  .amostra.extra {{ opacity:.92; }}
  .amostra header {{ display:flex; gap:14px; align-items:flex-start; margin-bottom:10px; }}
  .letra {{ flex:none; min-width:44px; height:44px; padding:0 8px; border-radius:999px; background:var(--vermelho); color:#fff;
    font-weight:700; font-size:19px; display:flex; align-items:center; justify-content:center; }}
  .extra .letra {{ background:var(--grafite); }}
  .nota {{ color:var(--suave); margin:2px 0 0; font-size:14.5px; }}
  audio, video {{ width:100%; margin:6px 0 10px; border-radius:8px; }} video {{ background:#000; }}
  dl {{ display:grid; grid-template-columns:minmax(120px,170px) 1fr; gap:6px 14px; margin:0; font-size:14.5px; }}
  dt {{ color:var(--suave); }} dd {{ margin:0; }} dd.fora {{ color:#b45309; font-weight:600; }} dd.ok {{ color:#1f8f4d; }}
  @media (max-width:560px) {{ dl {{ grid-template-columns:1fr; }} dt {{ margin-top:6px; }} }}
</style></head><body><main>
  <div class="topo"><img alt="Wellmix" src="data:image/svg+xml;base64,{logo}"><h1>PARADA A · escolha da voz</h1></div>
  <p class="sub">Treinamento em vídeo do Portal Wellmix. O mesmo texto em cada voz, sintetizado nesta máquina,
  sem nenhum serviço externo. A escolha vale para todos os papéis.</p>
  <h2>Texto de teste</h2>
  <blockquote><p>{texto}</p></blockquote>
  <p class="sub">Na fala, “Wellmix” é dito UÉLMIX, os valores e a data vão por extenso e as siglas são soletradas
  (CNPJ: cê, ene, pê, jota · NF-e: ene, efe, é).</p>
  <h2>Amostras</h2>
  <p>A, B e C são as três que recomendo ouvir primeiro. As outras ficam como alternativa.</p>
  {''.join(cartoes)}
  {video}
</main></body></html>"""


def main() -> None:
    fichas = carregar()
    (AMOSTRAS / "FICHAS.md").write_text(fichas_md(fichas), encoding="utf-8")
    destino = RAIZ / "PARADA-A-vozes.html"
    destino.write_text(pagina(fichas), encoding="utf-8")
    print(f"{len(fichas)} fichas · {destino} · {destino.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
