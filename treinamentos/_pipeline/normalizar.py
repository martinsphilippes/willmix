#!/usr/bin/env python3
"""Normalização de texto para FALA em português do Brasil.

Transforma o texto do roteiro (como aparece na tela e nas legendas) no texto
que o motor de voz recebe: números, moeda, datas, horas, porcentagens,
unidades e siglas por extenso, mais as pronúncias de `_config/pronuncias.json`.

A legenda continua com a grafia original ("Wellmix", "R$ 1.250,00"); só a
síntese e a conferência por STT usam o texto normalizado.

Uso:
    python normalizar.py "Pedido de R$ 1.250,00 em 23/11/2026"
    python normalizar.py --motor kokoro --arquivo falas.txt
    python normalizar.py --teste
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from num2words import num2words

RAIZ = Path(__file__).resolve().parent.parent
PRONUNCIAS = RAIZ / "_config" / "pronuncias.json"

MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro",
]

# Unidades depois de número: (singular, plural)
UNIDADES = {
    "kg": ("quilo", "quilos"),
    "g": ("grama", "gramas"),
    "mm": ("milímetro", "milímetros"),
    "cm": ("centímetro", "centímetros"),
    "m": ("metro", "metros"),
    "km": ("quilômetro", "quilômetros"),
    "m³": ("metro cúbico", "metros cúbicos"),
    "m3": ("metro cúbico", "metros cúbicos"),
    "ml": ("mililitro", "mililitros"),
    "mL": ("mililitro", "mililitros"),
    "L": ("litro", "litros"),
    "l": ("litro", "litros"),
    "un": ("unidade", "unidades"),
    "pç": ("peça", "peças"),
    "pçs": ("peça", "peças"),
    "h": ("hora", "horas"),
    "min": ("minuto", "minutos"),
    "s": ("segundo", "segundos"),
}
# Unidades femininas (o número concorda: "duas horas", "uma peça").
FEMININAS = {"g", "un", "pç", "pçs", "h"}
# Substantivos femininos comuns nos roteiros: o número antes deles concorda ("duzentas caixas").
SUBST_FEMININOS = ("peças?|caixas?|fotos?|amostras?|horas?|semanas?|pendências?|perguntas?|etapas?|assinaturas?|"
                   "vias?|linhas?|unidades?|rodadas?|tentativas?|parcelas?|imagens?|imagem|medidas?|solicitações|"
                   "solicitação|ofertas?|mensagens?|mensagem|telas?|tarefas?|páginas?|pessoas?|fábricas?|cópias?")

MOEDAS = {
    "R$": ("real", "reais", "centavo", "centavos"),
    "US$": ("dólar", "dólares", "centavo", "centavos"),
    "USD": ("dólar", "dólares", "centavo", "centavos"),
    "€": ("euro", "euros", "centavo", "centavos"),
    "EUR": ("euro", "euros", "centavo", "centavos"),
    "RMB": ("iuane", "iuanes", "centavo", "centavos"),
    "CNY": ("iuane", "iuanes", "centavo", "centavos"),
    "¥": ("iuane", "iuanes", "centavo", "centavos"),
}


def extenso(n: int, feminino: bool = False) -> str:
    """Cardinal por extenso, no jeito falado no Brasil (sem vírgulas)."""
    if n < 0:
        return "menos " + extenso(-n, feminino)
    texto = num2words(n, lang="pt_BR").replace(",", "")
    texto = re.sub(r"\s+", " ", texto).strip()
    if feminino:
        texto = re.sub(r"\bum$", "uma", texto)
        texto = re.sub(r"\bdois(?= mil\b|$)", "duas", texto)
        texto = re.sub(r"\bum mil\b", "mil", texto)
        for masc, fem in (
            ("duzentos", "duzentas"), ("trezentos", "trezentas"),
            ("quatrocentos", "quatrocentas"), ("quinhentos", "quinhentas"),
            ("seiscentos", "seiscentas"), ("setecentos", "setecentas"),
            ("oitocentos", "oitocentas"), ("novecentos", "novecentas"),
        ):
            texto = re.sub(rf"\b{masc}\b", fem, texto)
    return texto


def _inteiro(texto: str) -> int:
    return int(texto.replace(".", ""))


def decimal_extenso(inteira: str, fracao: str, feminino: bool = False) -> str:
    """"1,5" → "um vírgula cinco"; "0,069" → "zero vírgula zero seis nove"."""
    cabeca = extenso(_inteiro(inteira), feminino)
    if len(fracao) <= 2 and not fracao.startswith("0"):
        cauda = extenso(int(fracao))
    else:
        cauda = " ".join(extenso(int(d)) for d in fracao)
    return f"{cabeca} vírgula {cauda}"


def numero_extenso(texto: str, feminino: bool = False) -> str:
    """Número no formato brasileiro ("12.480", "1,5", "0,069")."""
    if "," in texto:
        inteira, fracao = texto.split(",", 1)
        return decimal_extenso(inteira, fracao, feminino)
    return extenso(_inteiro(texto), feminino)


NUM = r"\d{1,3}(?:\.\d{3})+|\d+"  # inteiro com ou sem ponto de milhar


def _moeda(m: re.Match) -> str:
    simbolo, inteira, cent = m.group("s"), m.group("i"), m.group("c")
    um, varios, cu, cv = MOEDAS[simbolo]
    valor = _inteiro(inteira)
    partes = []
    if valor or not cent or int(cent) == 0:
        nome = um if valor == 1 else varios
        ext = extenso(valor)
        # "um milhão de reais", "dois milhões de dólares"
        if valor and valor % 1_000_000 == 0:
            nome = "de " + nome
        partes.append(f"{ext} {nome}")
    if cent and int(cent):
        c = int(cent)
        partes.append(f"{extenso(c)} {cu if c == 1 else cv}")
    return " e ".join(partes)


def _data(dia: str, mes: str, ano: str | None) -> str:
    d, mm = int(dia), int(mes)
    if not (1 <= mm <= 12 and 1 <= d <= 31):
        return f"{dia}/{mes}" + (f"/{ano}" if ano else "")
    dia_txt = "primeiro" if d == 1 else extenso(d)
    saida = f"{dia_txt} de {MESES[mm - 1]}"
    if ano:
        saida += f" de {extenso(int(ano))}"
    return saida


def _hora(m: re.Match) -> str:
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    hora = extenso(h, feminino=True)
    nome = "hora" if h == 1 else "horas"
    if mi == 0:
        return f"{hora} {nome}"
    if mi == 30:
        return f"{hora} e meia"
    return f"{hora} e {extenso(mi)}"


def _ordinal(m: re.Match) -> str:
    n, genero = int(m.group(1)), m.group(2)
    texto = num2words(n, lang="pt_BR", to="ordinal")
    if genero == "ª":
        texto = " ".join(p[:-1] + "a" if p.endswith("o") else p for p in texto.split())
    return texto


def carregar_pronuncias(motor: str | None = None) -> list[tuple[re.Pattern, str]]:
    """Lista (padrão, fala) do pronuncias.json, a mais longa primeiro."""
    if not PRONUNCIAS.exists():
        return []
    dados = json.loads(PRONUNCIAS.read_text(encoding="utf-8"))
    regras = []
    for item in dados.get("termos", []):
        fala = item["fala"]
        if motor and motor in item.get("fala_por_motor", {}):
            fala = item["fala_por_motor"][motor]
        escrito = item["escrito"]
        if item.get("regex"):
            padrao = re.compile(escrito, 0 if item.get("caixa") else re.IGNORECASE)
        else:
            flags = 0 if item.get("caixa") else re.IGNORECASE
            padrao = re.compile(
                rf"(?<![\wÀ-ÿ]){re.escape(escrito)}(?![\wÀ-ÿ])", flags
            )
        regras.append((len(escrito), padrao, fala))
    regras.sort(key=lambda r: -r[0])
    return [(p, f) for _, p, f in regras]


def normalizar(texto: str, motor: str | None = None,
               pronuncias: list[tuple[re.Pattern, str]] | None = None) -> str:
    t = texto
    # Aspas e travessões não são falados; viram pausa leve.
    t = t.replace("“", "").replace("”", "").replace('"', "")
    t = t.replace("‘", "").replace("’", "").replace("«", "").replace("»", "")
    t = re.sub(r"\s+[–—]\s+", ", ", t)
    t = t.replace("→", ", depois ").replace("›", ", ").replace("&", " e ")

    # 1. Pronúncias fixas (marca, siglas, termos): antes dos números.
    for padrao, fala in (pronuncias if pronuncias is not None
                         else carregar_pronuncias(motor)):
        t = padrao.sub(fala, t)

    # 2. Moeda: R$ 1.250,00 · US$ 1,25 · USD 846,00
    simbolos = "|".join(re.escape(s) for s in sorted(MOEDAS, key=len, reverse=True))
    t = re.sub(
        rf"(?P<s>{simbolos})\s?(?P<i>{NUM})(?:,(?P<c>\d{{2}}))?(?!\d)", _moeda, t
    )

    # 3. Datas: 23/11/2026 · 23/11 · 2026-11-23
    t = re.sub(r"\b(\d{4})-(\d{2})-(\d{2})\b",
               lambda m: _data(m.group(3), m.group(2), m.group(1)), t)
    t = re.sub(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b",
               lambda m: _data(m.group(1), m.group(2), m.group(3)), t)
    t = re.sub(r"\b(\d{1,2})/(\d{1,2})\b(?!/)",
               lambda m: _data(m.group(1), m.group(2), None), t)

    # 4. Horas: 14:30 · 14h30 · 9h
    t = re.sub(r"\b(\d{1,2})[:h](\d{2})\b(?!\s?%)", _hora, t)
    t = re.sub(r"\b(\d{1,2})\s?h\b", _hora_cheia, t)

    # 5. Porcentagem: 18,5% · 30 %
    t = re.sub(
        rf"({NUM})(?:,(\d+))?\s?%",
        lambda m: (decimal_extenso(m.group(1), m.group(2)) if m.group(2)
                   else extenso(_inteiro(m.group(1)))) + " por cento",
        t,
    )

    # 6. Ordinais: 1º, 2ª
    t = re.sub(r"\b(\d{1,3})([ºª°])", _ordinal, t)

    # 7. Multiplicação de medidas: 10 × 8 × 20 → "dez por oito por vinte"
    t = re.sub(r"(?<=\d)\s?[×x]\s?(?=\d)", " por ", t)

    # 8. Número + unidade: 1,5 L · 20 cm · 0,069 m³
    unidades = "|".join(re.escape(u) for u in sorted(UNIDADES, key=len, reverse=True))

    def _unidade(m: re.Match) -> str:
        bruto, uni = m.group(1), m.group(2)
        fem = uni in FEMININAS
        valor = numero_extenso(bruto, fem)
        singular = bruto in ("1", "0,5") or bruto.startswith("0,")
        um, varios = UNIDADES[uni]
        return f"{valor} {um if singular else varios}"

    t = re.sub(rf"((?:{NUM})(?:,\d+)?)\s?({unidades})(?![\wÀ-ÿ])", _unidade, t)

    # 9. Números restantes (cardinais e decimais)
    t = re.sub(rf"(?<![\w,.])((?:{NUM})(?:,\d+)?)(?= (?:{SUBST_FEMININOS})\b)",
               lambda m: numero_extenso(m.group(1), True), t)
    t = re.sub(rf"(?<![\w,.])((?:{NUM})(?:,\d+)?)(?![\w%])",
               lambda m: numero_extenso(m.group(1)), t)

    # 10. Sinais que sobraram
    t = t.replace("%", " por cento").replace("+", " mais ").replace("=", " igual a ")
    t = re.sub(r"\s*/\s*", " ou ", t) if re.search(r"\w\s*/\s*\w", t) else t
    t = re.sub(r"[()\[\]]", ", ", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    t = re.sub(r",\s*,", ",", t)
    t = re.sub(r",\s*([.!?])", r"\1", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    if motor in ("kokoro", "piper"):
        # O Kokoro emenda as sílabas ligadas por hífen ("ene-efe-é" vira uma palavra só):
        # com espaço ele fala cada letra da sigla separada.
        t = re.sub(r"(?<=[\wÀ-ÿ])-(?=[\wÀ-ÿ])", " ", t)
    return t


def _hora_cheia(m: re.Match) -> str:
    h = int(m.group(1))
    return f"{extenso(h, feminino=True)} {'hora' if h == 1 else 'horas'}"


def restos(texto: str) -> list[str]:
    """Dígitos ou símbolos que sobraram depois de normalizar (devem ser zero)."""
    return re.findall(r"\d+|[$%#@_=<>|\\]", texto)


def dividir_frases(texto: str) -> list[str]:
    """Divide em frases (a síntese é frase a frase)."""
    partes = re.split(r"(?<=[.!?…])\s+(?=[A-ZÀ-Ý\"“'(])", texto.strip())
    return [p.strip() for p in partes if p.strip()]


TESTES = [
    ("Pedido de R$ 1.250,00.", "Pedido de mil duzentos e cinquenta reais."),
    ("Total: R$ 12.480,50", "Total: doze mil quatrocentos e oitenta reais e cinquenta centavos"),
    ("Custa US$ 1,25 a peça.", "Custa um dólar e vinte e cinco centavos a peça."),
    ("R$ 1,00 e R$ 0,01", "um real e um centavo"),
    ("R$ 2.000.000,00", "dois milhões de reais"),
    ("Entrega em 23/11/2026.", "Entrega em vinte e três de novembro de dois mil e vinte e seis."),
    ("Dia 1/3 tem reunião.", "Dia primeiro de março tem reunião."),
    ("Margem de 18,5%.", "Margem de dezoito vírgula cinco por cento."),
    ("Sinal de 30 %.", "Sinal de trinta por cento."),
    ("Jarra de 1,5 L.", "Jarra de um vírgula cinco litros."),
    ("Caixa com 0,069 m³.", "Caixa com zero vírgula zero seis nove metro cúbico."),
    ("Mede 10 × 8 × 20 cm.", "Mede dez por oito por vinte centímetros."),
    ("Passo 3 de 7.", "Passo três de sete."),
    ("Às 14:30.", "Às catorze e meia."),
    ("Reunião às 9h15.", "Reunião às nove e quinze."),
    ("O 1º passo e a 2ª etapa.", "O primeiro passo e a segunda etapa."),
    ("São 3.000 peças.", "São três mil peças."),
]


def _rodar_testes() -> int:
    falhas = 0
    for entrada, esperado in TESTES:
        saida = normalizar(entrada, pronuncias=[])
        ok = saida == esperado
        falhas += not ok
        print(("ok  " if ok else "ERRO"), repr(entrada), "→", repr(saida),
              "" if ok else f"(esperado {esperado!r})")
    print(f"{len(TESTES) - falhas}/{len(TESTES)} testes passaram")
    return 1 if falhas else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("texto", nargs="*")
    ap.add_argument("--motor", help="aplica as pronúncias específicas do motor")
    ap.add_argument("--arquivo", help="um texto por linha")
    ap.add_argument("--teste", action="store_true")
    a = ap.parse_args()
    if a.teste:
        return _rodar_testes()
    linhas = (Path(a.arquivo).read_text(encoding="utf-8").splitlines()
              if a.arquivo else [" ".join(a.texto)])
    for linha in linhas:
        if linha.strip():
            saida = normalizar(linha, a.motor)
            print(saida)
            if restos(saida):
                print("  ⚠ sobrou sem normalizar:", restos(saida), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
