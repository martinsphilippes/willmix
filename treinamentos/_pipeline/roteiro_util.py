"""Atalhos para escrever o roteiro de um módulo em Python (`<papel>/modulos/mN.py`, que
define `MODULO`). O `juntar_cenas.py` transforma tudo em `cenas.json` e `quiz.json`.
Escrever em Python evita o escape de aspas do JSON: os nomes de tela vão entre aspas
duplas dentro de textos com aspas simples."""
from __future__ import annotations

ARQ = "{DEMO}/arquivos/"  # pasta dos arquivos fictícios enviados nos vídeos


# ------------------------------------------------------------------- alvos --
def texto(t: str, exato: bool = False) -> dict:
    return {"texto": t, "exato": exato}


def sel(seletor: str, contem: str | None = None, dentro: dict | None = None, n: int | None = None) -> dict:
    d: dict = {"seletor": seletor}
    if contem is not None:
        d["contem"] = contem
    if dentro is not None:
        d["dentro"] = dentro
    if n is not None:
        d["n"] = n
    return d


def acima(alvo: dict, n: int = 1) -> dict:
    """O elemento N níveis acima do alvo: o cartão em volta de um título, por exemplo."""
    return {**alvo, "acima": n}


def titulo(nome: str, n: int = 1) -> dict:
    """O bloco em volta de um título da tela (N níveis acima dele)."""
    return {"papel": "heading", "nome": nome, "acima": n}


def linha(contem: str) -> dict:
    """Uma linha da tabela principal da tela."""
    return sel("main table tbody tr", contem)


def linha_solicitacao(numero: int) -> dict:
    """A linha da lista "Solicitações ao fornecedor" pelo número (a lista é no nível do pedido
    desde o PR #561, 18/11/2026: sem o nome do produto)."""
    return sel(f'[data-supplier-request-row]:has(td:first-child a:text-is("{numero}"))')


def numero_da_solicitacao(numero: int) -> dict:
    """O número (link) da solicitação na lista "Solicitações ao fornecedor"."""
    return sel(f'[data-supplier-request-row] td:first-child a:text-is("{numero}")')


def abrir_na_linha(contem: str, botao: str | None = None) -> dict:
    """O ícone de abrir no fim da linha (`OpenLink`, PR #561 de 18/11/2026): sem texto,
    só o nome acessível "Abrir: <título>". `botao` fica para um link com texto."""
    if botao:
        return sel("a", botao, dentro=linha(contem))
    return sel("a[data-open-link]", dentro=linha(contem))


# ------------------------------------------------------------------ passos --
def _passo(id: str, fala: str | None, acao: str | None, alvo=None, **kw) -> dict:
    p: dict = {"id": id}
    if fala:
        p["fala"] = fala
    if alvo is not None:
        p["alvo"] = alvo if isinstance(alvo, dict) else {"seletor": alvo}
    if acao:
        p["acao"] = acao
    p.update({k: v for k, v in kw.items() if v is not None})
    return p


def mostrar(id, fala, alvo=None, **kw):
    return _passo(id, fala, "mostrar" if alvo is not None else None, alvo, **kw)


def clicar(id, fala, alvo, **kw):
    return _passo(id, fala, "clicar", alvo, **kw)


def digitar(id, fala, alvo, valor, **kw):
    return _passo(id, fala, "digitar", alvo, valor=valor, **kw)


def escolher(id, fala, alvo, valor, **kw):
    return _passo(id, fala, "escolher", alvo, valor=valor, **kw)


def data(id, fala, alvo, dias, **kw):
    """Campo de data: `dias` a partir do dia da gravação (as datas do vídeo ficam sempre atuais)."""
    return _passo(id, fala, "data", alvo, valor=f"{dias:+d}", **kw)


def data_fixa(id, fala, alvo, iso, **kw):
    """Campo de data com uma data fixa (AAAA-MM-DD), por exemplo a validade de um certificado."""
    return _passo(id, fala, "data", alvo, valor=iso, **kw)


def item(rotulo: str) -> str:
    """Linha de um item da etapa, na tela do pedido (pelo rótulo exato)."""
    return f'main li:has(span.font-medium:text-is("{rotulo}")) '


def marcar(id, fala, alvo, **kw):
    return _passo(id, fala, "marcar", alvo, **kw)


def anexar(id, fala, alvo, arquivo, **kw):
    return _passo(id, fala, "anexar", alvo, valor=ARQ + arquivo, **kw)


def apontar(id, fala, alvo, **kw):
    """Leva o cursor ao alvo sem clicar (para botões que saem do portal, como baixar um PDF)."""
    return _passo(id, fala, "passar", alvo, **kw)


def fora(p: dict) -> dict:
    """Passo que aparece no vídeo mas não conta como "Passo N" nem entra na prática."""
    return {**p, "conta_passo": False, "sim": False}


# ------------------------------------------------------------------- cenas --
def abertura(id: str, papel: str, titulo: str, n: int, falas: list[str]) -> dict:
    return {"id": id, "tipo": "cartao", "capitulo": "Boas-vindas",
            "cartao": {"tipo": "abertura", "sobretitulo": f"Treinamento do Portal Wellmix · {papel}", "titulo": titulo, "subtitulo": f"Módulo {n}"},
            "passos": [{"id": f"f{i + 1}", "fala": f} for i, f in enumerate(falas)]}


def capitulo(id: str, nome: str, parte: int, total: int, titulo: str, subtitulo: str, fala: str) -> dict:
    return {"id": id, "tipo": "cartao", "capitulo": nome,
            "cartao": {"tipo": "capitulo", "sobretitulo": f"Parte {parte} de {total}", "titulo": titulo, "subtitulo": subtitulo},
            "passos": [{"id": "f1", "fala": fala}]}


def tela(id: str, nome: str, estado: str, passos: list[dict], *, inicio: str = "/app", antes: list[dict] | None = None,
         salvar: str | None = None, tarefa: str | None = None, cuidados: list[dict] | None = None, sim: bool | None = None) -> dict:
    c: dict = {"id": id, "tipo": "tela", "capitulo": nome, "estado": estado, "inicio": {"url": inicio}, "passos": passos}
    if antes:
        c["inicio"]["antes"] = antes
    if salvar:
        c["salvar"] = salvar
    if tarefa:
        c["tarefa"] = tarefa
    if cuidados:
        c["cuidados"] = cuidados
    if sim is not None:
        c["sim"] = sim
    return c


def cuidado(id: str, nome: str, estado: str, passos: list[dict], **kw) -> dict:
    """Cena "Cuidado": o erro comum, depois da demonstração limpa; fora da prática."""
    return tela(id, nome, estado, [fora(p) for p in passos], sim=False, **kw)


def sua_vez(id: str, nome: str, titulo: str, itens: list[str], fala: str) -> dict:
    return {"id": id, "tipo": "cartao", "capitulo": nome, "sua_vez": True, "duracao_min": 4.5,
            "cartao": {"tipo": "suavez", "titulo": titulo, "itens": itens}, "passos": [{"id": "f1", "fala": fala}]}


def encerramento(id: str, titulo: str, subtitulo: str, falas: list[str]) -> dict:
    return {"id": id, "tipo": "cartao", "capitulo": "Resumo", "cartao": {"tipo": "encerramento", "titulo": titulo, "subtitulo": subtitulo},
            "passos": [{"id": f"f{i + 1}", "fala": f} for i, f in enumerate(falas)]}


def pre(acao: str, alvo, espera: dict | None = None, **kw) -> dict:
    """Ação silenciosa antes de a cena começar (`inicio.antes`)."""
    return {"acao": acao, "alvo": alvo if isinstance(alvo, dict) else {"seletor": alvo}, **({"espera": espera} if espera else {}), **kw}


# -------------------------------------------------------------------- quiz --
def cenario(id, tema, rever, enunciado, alternativas, correta, feedback):
    return {"id": id, "tipo": "cenario", "tema": tema, "rever": {"cena": rever[0], "passo": rever[1]},
            "enunciado": enunciado, "alternativas": alternativas, "correta": correta, "feedback": feedback}


def clique(id, tema, rever, enunciado, feedback, imagem=None):
    im = imagem or rever
    return {"id": id, "tipo": "clique", "tema": tema, "rever": {"cena": rever[0], "passo": rever[1]},
            "enunciado": enunciado, "imagem": {"cena": im[0], "passo": im[1]}, "feedback": feedback}


def ordenar(id, tema, rever, enunciado, itens, feedback):
    return {"id": id, "tipo": "ordenar", "tema": tema, "rever": {"cena": rever[0], "passo": rever[1]},
            "enunciado": enunciado, "itens": itens, "feedback": feedback}
